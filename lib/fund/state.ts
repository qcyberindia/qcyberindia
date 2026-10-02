// Derived accounting state for one fund, read inside a transaction (or not).
//
//   cash          = SUM(ledger.cash_delta)       (the ledger is authoritative)
//   units         = SUM(ledger.units_delta)
//   positions     = replay of accounting-effective trades
//
// There is no stored cash column; nothing here is a cache that could drift.
import { Money } from "@/lib/accounting/money";
import {
  assertNoViolations,
  checkCashNonNegative,
  checkNoNegativeMemberUnits,
  checkUnitsReconcile,
  type InvariantViolation,
} from "@/lib/accounting/invariants";
import { parseNavCutoffConfig, type NavCutoffConfig } from "@/lib/accounting/nav-cutoff";
import { replayPositions, type ReplayTrade } from "@/lib/accounting/portfolio";
import type { Position } from "@/lib/accounting/holdings";
import { one, type Db } from "@/lib/fund/db";

const m = (s: string | null | undefined) => Money.fromDecimalString(s ?? "0");

/**
 * Ledger basis for the NAV struck on `date`: everything strictly before the
 * date, plus that date's trades/expenses/adjustments, but NOT that date's
 * contributions/withdrawals - those are allocated AT the NAV, after it is
 * struck, so they cannot be part of its basis.
 */
const NAV_BASIS = `(entry_date < $2::date OR (entry_date = $2::date AND entry_type NOT IN ('CONTRIBUTION', 'WITHDRAWAL')))`;

export async function ledgerStateAsOf(db: Db, fundId: number, date: string): Promise<{ cash: Money; units: Money }> {
  const row = await one<{ cash: string; units: string }>(
    db,
    `SELECT COALESCE(SUM(cash_delta), 0)::text AS cash, COALESCE(SUM(units_delta), 0)::text AS units
       FROM qfinera_fund_ledger_entries
      WHERE fund_id = $1 AND ${NAV_BASIS}`,
    [fundId, date]
  );
  return { cash: m(row?.cash), units: m(row?.units) };
}

export async function ledgerStateNow(db: Db, fundId: number): Promise<{ cash: Money; units: Money }> {
  const row = await one<{ cash: string; units: string }>(
    db,
    `SELECT COALESCE(SUM(cash_delta), 0)::text AS cash, COALESCE(SUM(units_delta), 0)::text AS units
       FROM qfinera_fund_ledger_entries WHERE fund_id = $1`,
    [fundId]
  );
  return { cash: m(row?.cash), units: m(row?.units) };
}

export async function getMemberUnits(db: Db, fundId: number, memberId: number): Promise<Money> {
  const row = await one<{ units: string }>(
    db,
    `SELECT COALESCE(SUM(units_delta), 0)::text AS units
       FROM qfinera_fund_ledger_entries WHERE fund_id = $1 AND member_id = $2`,
    [fundId, memberId]
  );
  return m(row?.units);
}

/**
 * Hard rule: the running cash balance may never be negative at any point
 * from `fromDate` onward. Run AFTER posting a ledger entry, inside the
 * transaction, so a violation rolls everything back.
 */
export async function assertCashNeverNegativeFrom(db: Db, fundId: number, fromDate: string): Promise<void> {
  const row = await one<{ min_cash: string | null }>(
    db,
    `SELECT MIN(running)::text AS min_cash FROM (
       SELECT entry_date, SUM(cash_delta) OVER (ORDER BY entry_date, id) AS running
         FROM qfinera_fund_ledger_entries WHERE fund_id = $1
     ) t WHERE entry_date >= $2::date`,
    [fundId, fromDate]
  );
  if (row?.min_cash != null) assertNoViolations(checkCashNonNegative(m(row.min_cash)));
}

/** Ledger units must equal the membership unit cache, per member and in total. */
export async function assertUnitsReconcile(db: Db, fundId: number): Promise<void> {
  const { rows: ledger } = await db.query<{ member_id: number; units: string }>(
    `SELECT member_id, SUM(units_delta)::text AS units
       FROM qfinera_fund_ledger_entries
      WHERE fund_id = $1 AND member_id IS NOT NULL GROUP BY member_id`,
    [fundId]
  );
  const { rows: cache } = await db.query<{ user_id: number; units: string }>(
    "SELECT user_id, units::text AS units FROM qfinera_fund_memberships WHERE fund_id = $1",
    [fundId]
  );

  const ledgerByMember = new Map(ledger.map((r) => [r.member_id, m(r.units)]));
  const violations: InvariantViolation[] = [];
  const memberUnits: Money[] = [];

  for (const c of cache) {
    const cached = m(c.units);
    memberUnits.push(cached);
    const fromLedger = ledgerByMember.get(c.user_id) ?? Money.zero();
    if (!cached.equals(fromLedger)) {
      violations.push({
        code: "UNITS_MISMATCH",
        message: `member ${c.user_id} cached units ${cached.toDecimalString(4)} != ledger ${fromLedger.toDecimalString(4)}`,
      });
    }
  }
  violations.push(...checkNoNegativeMemberUnits(cache.map((c) => ({ memberId: c.user_id, units: m(c.units) }))));

  const fundUnits = await one<{ units: string }>(
    db,
    "SELECT COALESCE(SUM(units_delta), 0)::text AS units FROM qfinera_fund_ledger_entries WHERE fund_id = $1",
    [fundId]
  );
  violations.push(...checkUnitsReconcile(m(fundUnits?.units), memberUnits));
  assertNoViolations(violations);
}

type TradeRow = {
  id: number;
  instrument_id: number;
  trade_date: string;
  side: "BUY" | "SELL";
  quantity: string;
  price: string;
  charges: string;
};

/**
 * Accounting-effective trades (cash and holdings already moved) as of
 * `asOfDate`, or all of them when omitted. A REVERSED trade still counts for
 * dates before it was reversed.
 */
export async function loadAccountingTrades(db: Db, fundId: number, asOfDate?: string): Promise<ReplayTrade[]> {
  const { rows } = await db.query<TradeRow>(
    `SELECT id, instrument_id, trade_date::text AS trade_date, side, quantity::text AS quantity,
            price::text AS price, (brokerage + stt + gst + stamp_duty + other_charges)::text AS charges
       FROM qfinera_fund_trades
      WHERE fund_id = $1
        AND ($2::date IS NULL OR trade_date <= $2::date)
        AND (
          status IN ('EXECUTED', 'SETTLED', 'FINALIZED')
          OR (status = 'REVERSED' AND $2::date IS NOT NULL
              AND (reversed_at AT TIME ZONE 'Asia/Kolkata')::date > $2::date)
        )
      ORDER BY trade_date, id`,
    [fundId, asOfDate ?? null]
  );
  return rows.map((r) => ({
    id: r.id,
    instrumentId: r.instrument_id,
    tradeDate: r.trade_date,
    side: r.side,
    quantity: m(r.quantity),
    price: m(r.price),
    charges: m(r.charges),
  }));
}

/** Positions with non-zero quantity. Throws if the history oversells. */
export async function loadPositions(db: Db, fundId: number, asOfDate?: string): Promise<Map<number, Position>> {
  const positions = replayPositions(await loadAccountingTrades(db, fundId, asOfDate));
  for (const [id, p] of positions) if (p.quantity.isZero()) positions.delete(id);
  return positions;
}

export type OfficialPrice = {
  instrumentId: number;
  price: Money;
  quality: string;
  asOf: string;
};

/**
 * The latest EOD/MANUAL price recorded WITHIN the IST calendar day `date`
 * for each instrument (this fund's own snapshots or provider-wide ones). A price from another day is never substituted: a
 * missing price is surfaced to the caller, never guessed.
 */
export async function loadOfficialPrices(
  db: Db,
  fundId: number,
  instrumentIds: number[],
  date: string
): Promise<Map<number, OfficialPrice>> {
  const out = new Map<number, OfficialPrice>();
  if (instrumentIds.length === 0) return out;
  const { rows } = await db.query<{ instrument_id: number; price: string; quality: string; as_of: Date }>(
    `SELECT DISTINCT ON (ps.instrument_id) ps.instrument_id, ps.price::text AS price, ps.quality, ps.as_of
       FROM qfinera_fund_price_snapshots ps
      WHERE ps.instrument_id = ANY($1::int[])
        AND (ps.fund_id IS NULL OR ps.fund_id = $3)
        AND ps.quality IN ('EOD', 'MANUAL')
        AND ps.as_of >= ($2::date)::timestamp AT TIME ZONE 'Asia/Kolkata'
        AND ps.as_of <  (($2::date + 1))::timestamp AT TIME ZONE 'Asia/Kolkata'
      ORDER BY ps.instrument_id, ps.as_of DESC, ps.id DESC`,
    [instrumentIds, date, fundId]
  );
  for (const r of rows) {
    out.set(r.instrument_id, {
      instrumentId: r.instrument_id,
      price: m(r.price),
      quality: r.quality,
      asOf: r.as_of.toISOString(),
    });
  }
  return out;
}

export type FundSettings = {
  nav: NavCutoffConfig;
  taxAssumptions: { stcgRate: string; ltcgRate: string };
  marketDataProvider: string;
  chargeConfig: Record<string, unknown>;
};

const DEFAULT_TAX = { stcgRate: "20", ltcgRate: "12.5" };

export async function loadSettings(db: Db, fundId: number): Promise<FundSettings> {
  const row = await one<{
    nav_settings: unknown;
    tax_assumptions: Record<string, unknown> | null;
    market_data_provider: string;
    charge_config: Record<string, unknown> | null;
  }>(
    db,
    `SELECT nav_settings, tax_assumptions, market_data_provider, charge_config
       FROM qfinera_fund_settings WHERE fund_id = $1`,
    [fundId]
  );
  const tax = row?.tax_assumptions ?? {};
  return {
    nav: parseNavCutoffConfig(row?.nav_settings),
    taxAssumptions: {
      stcgRate: typeof tax.stcg_rate === "string" ? tax.stcg_rate : DEFAULT_TAX.stcgRate,
      ltcgRate: typeof tax.ltcg_rate === "string" ? tax.ltcg_rate : DEFAULT_TAX.ltcgRate,
    },
    marketDataProvider: row?.market_data_provider ?? "manual",
    chargeConfig: row?.charge_config ?? {},
  };
}

export async function latestOfficialNavDate(db: Db, fundId: number): Promise<string | null> {
  const row = await one<{ d: string | null }>(
    db,
    `SELECT MAX(as_of_date)::text AS d FROM qfinera_fund_nav_snapshots WHERE fund_id = $1 AND is_official`,
    [fundId]
  );
  return row?.d ?? null;
}
