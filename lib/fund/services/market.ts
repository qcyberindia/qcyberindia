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

export type InstrumentType = "EQUITY" | "FUTURE" | "OPTION";
export const INSTRUMENT_TYPES: readonly InstrumentType[] = ["EQUITY", "FUTURE", "OPTION"];
export type OptionType = "CE" | "PE";

/**
 * isin/series come from the exchange master import (migration 011,
 * scripts/import-nse-equity.ts); hand-added instruments may lack them.
 * Derivative contracts (migration 012) carry underlying/expiry and, for
 * options, strike + CE/PE; an EQUITY row never does (database CHECK).
 */
export type Instrument = {
  id: number;
  symbol: string;
  exchange: Exchange;
  name: string | null;
  isin?: string | null;
  series?: string | null;
  instrumentType?: InstrumentType;
  underlying?: string | null;
  expiryDate?: string | null;
  strikePrice?: string | null;
  optionType?: OptionType | null;
  lotSize?: number | null;
};

const INSTRUMENT_COLS = `id, symbol, exchange, name, isin, series, instrument_type AS "instrumentType",
  underlying_symbol AS underlying, expiry_date::text AS "expiryDate", strike_price::text AS "strikePrice",
  option_type AS "optionType", lot_size AS "lotSize"`;

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** Exchange-style contract symbol: NIFTY26NOV2026FUT, NIFTY26NOV202625000CE. */
export function contractSymbol(underlying: string, expiry: string, type: "FUTURE" | "OPTION", strike?: string | null, optionType?: OptionType | null): string {
  const [y, mo, d] = expiry.split("-");
  const date = `${d}${MONTHS[Number(mo) - 1]}${y}`;
  if (type === "FUTURE") return `${underlying}${date}FUT`;
  const k = (strike ?? "").replace(/\.?0+$/, "");
  return `${underlying}${date}${k}${optionType}`;
}

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
  opts: {
    q: string | null;
    exchange: Exchange | null;
    ids?: number[] | null;
    limit: number;
    type?: InstrumentType | null;
    expiry?: string | null;
    strike?: string | null;
    optionType?: OptionType | null;
  }
): Promise<Instrument[]> {
  const term = opts.q?.trim() ? opts.q.trim() : null;
  const q = term ? `%${escapeLike(term)}%` : null;
  // With ~2.6k master rows a broad term ("IND") matches many, so exact
  // symbol/ISIN/underlying hits rank first, then prefixes, then name
  // matches; contracts then sort by nearest expiry and strike.
  const { rows } = await db.query<Instrument>(
    `SELECT ${INSTRUMENT_COLS} FROM qfinera_fund_instruments
      WHERE ($1::text IS NULL OR symbol ILIKE $1 OR name ILIKE $1 OR isin = upper($5) OR underlying_symbol ILIKE $1)
        AND ($2::text IS NULL OR exchange = $2)
        AND ($3::int[] IS NULL OR id = ANY($3::int[]))
        AND ($7::text IS NULL OR instrument_type = $7)
        AND ($8::date IS NULL OR expiry_date = $8::date)
        AND ($9::numeric IS NULL OR strike_price = $9::numeric)
        AND ($10::text IS NULL OR option_type = $10)
      ORDER BY CASE WHEN upper(symbol) = upper($5) OR isin = upper($5) OR upper(underlying_symbol) = upper($5) THEN 0
                    WHEN symbol ILIKE $6 OR underlying_symbol ILIKE $6 THEN 1
                    ELSE 2 END,
               COALESCE(underlying_symbol, symbol), expiry_date NULLS FIRST, strike_price NULLS FIRST, option_type NULLS FIRST,
               symbol, exchange
      LIMIT $4`,
    [
      q,
      opts.exchange,
      opts.ids ?? null,
      opts.limit,
      term,
      term ? `${escapeLike(term)}%` : null,
      opts.type ?? null,
      opts.expiry ?? null,
      opts.strike ?? null,
      opts.optionType ?? null,
    ]
  );
  return rows;
}

export type NewInstrument =
  | { instrumentType: "EQUITY"; symbol: string; exchange: Exchange; name: string | null }
  | {
      instrumentType: "FUTURE" | "OPTION";
      underlying: string;
      exchange: Exchange;
      expiryDate: string;
      strikePrice: Money | null;
      optionType: OptionType | null;
      lotSize: number | null;
    };

export async function createInstrument(ctx: ServiceCtx, input: NewInstrument): Promise<Instrument> {
  if (!hasPermission(ctx.actor, "trades:create") && !hasPermission(ctx.actor, "watchlist:write")) {
    assertPermission(ctx.actor, "trades:create");
  }
  let symbol: string;
  let values: unknown[];
  if (input.instrumentType === "EQUITY") {
    symbol = normalizeSymbol(input.symbol);
    values = [symbol, input.exchange, input.name, "EQUITY", null, null, null, null, null];
  } else {
    const underlying = normalizeSymbol(input.underlying);
    if (input.instrumentType === "OPTION") {
      if (!input.strikePrice || input.strikePrice.compare(Money.zero()) <= 0) {
        throw validationError("An option needs a strike price greater than zero.", { strikePrice: "Required" });
      }
      if (!input.optionType) throw validationError("An option must be a CE (call) or PE (put).", { optionType: "Required" });
    } else if (input.strikePrice || input.optionType) {
      throw validationError("A future has no strike price or option type.", { strikePrice: "Not allowed for a future" });
    }
    const strike = input.instrumentType === "OPTION" ? input.strikePrice!.toDecimalString(4) : null;
    const optionType = input.instrumentType === "OPTION" ? input.optionType : null;
    symbol = contractSymbol(underlying, input.expiryDate, input.instrumentType, strike, optionType);
    values = [symbol, input.exchange, null, input.instrumentType, underlying, input.expiryDate, strike, optionType, input.lotSize];
  }
  try {
    return await inTransaction(async (db) => {
      const row = await one<Instrument>(
        db,
        `INSERT INTO qfinera_fund_instruments
           (symbol, exchange, name, instrument_type, underlying_symbol, expiry_date, strike_price, option_type, lot_size)
         VALUES ($1, $2, $3, $4, $5, $6::date, $7::numeric, $8, $9)
         RETURNING ${INSTRUMENT_COLS}`,
        values
      );
      if (!row) throw new Error("instrument insert returned no row");
      await writeAudit(db, {
        fundId: ctx.fundId,
        userId: ctx.actor.userId,
        action: "instrument.created",
        entityType: "instrument",
        entityId: row.id,
        after: {
          symbol: row.symbol,
          exchange: row.exchange,
          name: row.name,
          instrument_type: row.instrumentType,
          underlying: row.underlying,
          expiry_date: row.expiryDate,
          strike_price: row.strikePrice,
          option_type: row.optionType,
          lot_size: row.lotSize,
        },
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
    const instrument = await one<Instrument>(db, `SELECT ${INSTRUMENT_COLS} FROM qfinera_fund_instruments WHERE id = $1`, [
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
