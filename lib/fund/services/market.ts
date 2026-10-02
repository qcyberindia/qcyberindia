// Instruments and price snapshots for QFinera Fund.
//
// Market data is kept separate from accounting authority:
//   * Quotes for display come ONLY through the market-data provider
//     abstraction (lib/market-data), which labels quality (LIVE / DELAYED /
//     EOD / MANUAL), flags stale prices and reports UNAVAILABLE honestly.
//   * The official NAV uses only EOD/MANUAL snapshots recorded within the
//     NAV date (lib/fund/state.ts loadOfficialPrices), never a quote.
//   * A manually recorded snapshot belongs to the fund that recorded it
//     (migration 009) and is append-only: a wrong price is superseded by a
//     newer snapshot, never edited.
import { Money } from "@/lib/accounting/money";
import { cutoffInstant, isTradingDay } from "@/lib/accounting/nav-cutoff";
import { writeAudit } from "@/lib/fund/audit";
import { inTransaction, one, type Db } from "@/lib/fund/db";
import { FundError, conflictError, validationError } from "@/lib/fund/errors";
import { assertPermission, hasPermission } from "@/lib/fund/rbac";
import { loadSettings } from "@/lib/fund/state";
import { isUniqueViolation, type ServiceCtx } from "@/lib/fund/services/types";
import { getMarketDataProvider, type Exchange, type Quote } from "@/lib/market-data";

export const EXCHANGES: readonly Exchange[] = ["NSE", "BSE"];

export type Instrument = { id: number; symbol: string; exchange: Exchange; name: string | null };

/** NSE/BSE trading symbols: upper-case letters, digits and & - . _ (e.g. M&M, BAJAJ-AUTO). */
export function normalizeSymbol(raw: string): string {
  const symbol = raw.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9&._-]{0,29}$/.test(symbol)) {
    throw validationError("Enter a valid exchange symbol (letters, digits, & - . _).", { symbol: "Invalid symbol" });
  }
  return symbol;
}

function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function listInstruments(
  db: Db,
  opts: { q: string | null; exchange: Exchange | null; ids?: number[] | null; limit: number }
): Promise<Instrument[]> {
  const q = opts.q ? `%${escapeLike(opts.q.trim())}%` : null;
  const { rows } = await db.query<Instrument>(
    `SELECT id, symbol, exchange, name FROM qfinera_fund_instruments
      WHERE ($1::text IS NULL OR symbol ILIKE $1 OR name ILIKE $1)
        AND ($2::text IS NULL OR exchange = $2)
        AND ($3::int[] IS NULL OR id = ANY($3::int[]))
      ORDER BY symbol, exchange
      LIMIT $4`,
    [q, opts.exchange, opts.ids ?? null, opts.limit]
  );
  return rows;
}

export async function createInstrument(
  ctx: ServiceCtx,
  input: { symbol: string; exchange: Exchange; name: string | null }
): Promise<Instrument> {
  if (!hasPermission(ctx.actor, "trades:create") && !hasPermission(ctx.actor, "watchlist:write")) {
    assertPermission(ctx.actor, "trades:create");
  }
  const symbol = normalizeSymbol(input.symbol);
  try {
    return await inTransaction(async (db) => {
      const row = await one<Instrument>(
        db,
        `INSERT INTO qfinera_fund_instruments (symbol, exchange, name) VALUES ($1, $2, $3)
         RETURNING id, symbol, exchange, name`,
        [symbol, input.exchange, input.name]
      );
      if (!row) throw new Error("instrument insert returned no row");
      await writeAudit(db, {
        fundId: ctx.fundId,
        userId: ctx.actor.userId,
        action: "instrument.created",
        entityType: "instrument",
        entityId: row.id,
        after: { symbol: row.symbol, exchange: row.exchange, name: row.name },
        meta: ctx.meta,
      });
      return row;
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw conflictError(`${symbol} on ${input.exchange} already exists.`);
    throw err;
  }
}

export type PriceQualityInput = "EOD" | "MANUAL";

export type RecordedPrice = {
  id: number;
  instrumentId: number;
  price: string;
  quality: PriceQualityInput;
  source: string;
  asOf: Date;
};

/**
 * ADMIN records a closing (EOD) or operator (MANUAL) price for this fund.
 * The time defaults to the session close (15:30 IST); a price can never be
 * recorded for a moment that has not happened yet.
 */
export async function recordPrice(
  ctx: ServiceCtx,
  input: { instrumentId: number; price: Money; quality: PriceQualityInput; date: string; time: string | null },
  now: Date = new Date()
): Promise<RecordedPrice> {
  assertPermission(ctx.actor, "nav:finalize");
  if (input.price.compare(Money.zero()) <= 0) throw validationError("Price must be greater than zero.", { price: "Must be positive" });
  const asOf = cutoffInstant(input.date, { cutoffTimeIst: input.time ?? "15:30", holidays: [] });
  if (asOf.getTime() > now.getTime()) {
    throw validationError("A price cannot be recorded for a time in the future.", { date: "In the future" });
  }

  return inTransaction(async (db) => {
    const instrument = await one<Instrument>(db, "SELECT id, symbol, exchange, name FROM qfinera_fund_instruments WHERE id = $1", [
      input.instrumentId,
    ]);
    if (!instrument) throw validationError("Choose a valid instrument.", { instrumentId: "Unknown instrument" });
    const settings = await loadSettings(db, ctx.fundId);
    if (input.quality === "EOD" && !isTradingDay(input.date, settings.nav.holidays)) {
      throw conflictError(`${input.date} is not a trading day, so there is no closing price for it.`);
    }

    const row = await one<{ id: number; as_of: Date }>(
      db,
      `INSERT INTO qfinera_fund_price_snapshots (instrument_id, price, quality, source, as_of, fund_id, recorded_by)
       VALUES ($1, $2, $3, 'manual-entry', $4, $5, $6) RETURNING id, as_of`,
      [instrument.id, input.price.toDecimalString(4), input.quality, asOf, ctx.fundId, ctx.actor.userId]
    );
    if (!row) throw new Error("price insert returned no row");
    await writeAudit(db, {
      fundId: ctx.fundId,
      userId: ctx.actor.userId,
      action: "price.recorded",
      entityType: "price_snapshot",
      entityId: row.id,
      after: {
        instrument: `${instrument.symbol}:${instrument.exchange}`,
        price: input.price.toDecimalString(4),
        quality: input.quality,
        as_of: row.as_of.toISOString(),
      },
      meta: ctx.meta,
    });
    return {
      id: row.id,
      instrumentId: instrument.id,
      price: input.price.toDecimalString(4),
      quality: input.quality,
      source: "manual-entry",
      asOf: row.as_of,
    };
  });
}

/** Display quotes for instruments, through the configured provider. */
export async function quotesFor(db: Db, fundId: number, instruments: readonly Instrument[]): Promise<Map<number, Quote>> {
  const out = new Map<number, Quote>();
  if (instruments.length === 0) return out;
  const settings = await loadSettings(db, fundId);
  let provider;
  try {
    provider = getMarketDataProvider(settings.marketDataProvider, { db, fundId, holidays: settings.nav.holidays });
  } catch {
    throw new FundError("UNAVAILABLE", "The configured market data provider is not available.", 503);
  }
  const quotes = await provider.getQuotes(
    instruments.map((i) => ({ instrumentId: i.id, symbol: i.symbol, exchange: i.exchange }))
  );
  for (const q of quotes) out.set(q.instrument.instrumentId, q);
  return out;
}

export async function marketStatus(db: Db, fundId: number) {
  const settings = await loadSettings(db, fundId);
  try {
    return await getMarketDataProvider(settings.marketDataProvider, { db, fundId, holidays: settings.nav.holidays }).getMarketStatus();
  } catch {
    return null;
  }
}
