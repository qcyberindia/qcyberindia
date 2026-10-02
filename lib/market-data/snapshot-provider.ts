// "manual" market data provider: serves ONLY prices already recorded in
// qfinera_fund_price_snapshots (entered by an operator, or written by a
// future vendor adapter). It contacts no external service and never
// fabricates, estimates, or carries a price across days.
//
//   - A snapshot recorded as LIVE is reported LIVE only while it is younger
//     than `liveWindowMs`; after that it is honestly reported DELAYED.
//   - No snapshot at all -> an UNAVAILABLE quote with a reason.
//   - Market status is derived from the trading calendar and standard NSE/BSE
//     cash-session hours (09:15-15:30 IST). It says basis: "schedule" so no
//     one mistakes it for a live exchange feed.
import type { Db } from "@/lib/fund/db";
import {
  addDays,
  daysBetween,
  isTradingDay,
  isValidIsoDate,
  toIstParts,
} from "@/lib/accounting/nav-cutoff";
import type {
  DateRange,
  HistoricalPrice,
  InstrumentRef,
  MarketDataProvider,
  MarketStatus,
  Quote,
  QuoteQuality,
  TradingDay,
} from "@/lib/market-data/types";

export const DEFAULT_LIVE_WINDOW_MS = 5 * 60_000;
const MAX_RANGE_DAYS = 3660;

const SESSION_OPEN_MIN = 9 * 60 + 15;
const SESSION_CLOSE_MIN = 15 * 60 + 30;

export type SnapshotProviderOptions = {
  db: Db;
  /**
   * The fund asking. Snapshots recorded by THIS fund and provider-wide
   * snapshots (fund_id NULL) are visible; another fund's manual prices
   * never are. Without a fund, only provider-wide snapshots are used.
   */
  fundId?: number | null;
  /** Configured market holidays (ISO dates), from fund settings. */
  holidays?: readonly string[];
  liveWindowMs?: number;
  /** Injectable clock for tests. */
  now?: () => Date;
};

type SnapshotRow = {
  instrument_id: number;
  price: string;
  quality: "LIVE" | "DELAYED" | "EOD" | "MANUAL";
  source: string;
  as_of: Date;
};

// Visible snapshots: provider-wide ones, plus this fund's own ($2 = fund id or NULL).
const FUND_SCOPE = "(fund_id IS NULL OR fund_id = $2::int)";

/**
 * The most recent trading day whose session has CLOSED at `at`: today after
 * 15:30 IST on a trading day, otherwise the previous trading day.
 */
export function lastCompletedSession(at: Date, holidays: readonly string[]): string {
  const { date, msOfDay } = toIstParts(at);
  if (isTradingDay(date, holidays) && Math.floor(msOfDay / 60_000) >= SESSION_CLOSE_MIN) return date;
  let d = date;
  for (let i = 0; i < 400; i++) {
    d = addDays(d, -1);
    if (isTradingDay(d, holidays)) return d;
  }
  return d;
}

function assertRange(range: DateRange): void {
  if (!isValidIsoDate(range.from) || !isValidIsoDate(range.to)) {
    throw new Error("range dates must be valid ISO dates (YYYY-MM-DD)");
  }
  const span = daysBetween(range.from, range.to);
  if (span < 0) throw new Error("range.from must not be after range.to");
  if (span > MAX_RANGE_DAYS) throw new Error(`range is too large (max ${MAX_RANGE_DAYS} days)`);
}

export function createSnapshotProvider(options: SnapshotProviderOptions): MarketDataProvider {
  const { db } = options;
  const holidays = options.holidays ?? [];
  const liveWindowMs = options.liveWindowMs ?? DEFAULT_LIVE_WINDOW_MS;
  const clock = options.now ?? (() => new Date());
  const fundId = options.fundId ?? null;

  function toQuote(instrument: InstrumentRef, row: SnapshotRow | undefined): Quote {
    if (!row) {
      return {
        available: false,
        instrument,
        quality: "UNAVAILABLE",
        reason: "No price has been recorded for this instrument.",
      };
    }
    let quality: QuoteQuality = row.quality;
    if (row.quality === "LIVE" && clock().getTime() - row.as_of.getTime() > liveWindowMs) {
      quality = "DELAYED";
    }
    return {
      available: true,
      instrument,
      price: row.price,
      quality,
      source: row.source,
      asOf: row.as_of.toISOString(),
      stale: toIstParts(row.as_of).date < lastCompletedSession(clock(), holidays),
    };
  }

  async function latestByInstrument(ids: number[]): Promise<Map<number, SnapshotRow>> {
    const out = new Map<number, SnapshotRow>();
    if (ids.length === 0) return out;
    const { rows } = await db.query<SnapshotRow>(
      `SELECT DISTINCT ON (instrument_id) instrument_id, price::text AS price, quality, source, as_of
         FROM qfinera_fund_price_snapshots
        WHERE instrument_id = ANY($1::int[]) AND ${FUND_SCOPE}
        ORDER BY instrument_id, as_of DESC, id DESC`,
      [ids, fundId]
    );
    for (const r of rows) out.set(r.instrument_id, r);
    return out;
  }

  return {
    name: "manual",

    async getQuote(instrument) {
      const rows = await latestByInstrument([instrument.instrumentId]);
      return toQuote(instrument, rows.get(instrument.instrumentId));
    },

    async getQuotes(instruments) {
      const ids = [...new Set(instruments.map((i) => i.instrumentId))];
      const rows = await latestByInstrument(ids);
      return instruments.map((i) => toQuote(i, rows.get(i.instrumentId)));
    },

    async getHistoricalPrices(instrument, range): Promise<HistoricalPrice[]> {
      assertRange(range);
      const { rows } = await db.query<{
        date: string;
        price: string;
        quality: "EOD" | "MANUAL";
        source: string;
      }>(
        `SELECT DISTINCT ON ((as_of AT TIME ZONE 'Asia/Kolkata')::date)
                (as_of AT TIME ZONE 'Asia/Kolkata')::date::text AS date,
                price::text AS price, quality, source
           FROM qfinera_fund_price_snapshots
          WHERE instrument_id = $1 AND ${FUND_SCOPE.replace("$2", "$4")}
            AND quality IN ('EOD', 'MANUAL')
            AND (as_of AT TIME ZONE 'Asia/Kolkata')::date BETWEEN $2::date AND $3::date
          ORDER BY (as_of AT TIME ZONE 'Asia/Kolkata')::date, as_of DESC, id DESC`,
        [instrument.instrumentId, range.from, range.to, fundId]
      );
      return rows.map((r) => ({ date: r.date, price: r.price, quality: r.quality, source: r.source }));
    },

    async getMarketStatus(at = clock()): Promise<MarketStatus> {
      const { date, msOfDay } = toIstParts(at);
      const minutes = Math.floor(msOfDay / 60_000);
      const base = { basis: "schedule" as const, at: at.toISOString() };

      if (!isTradingDay(date, holidays)) {
        const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
        const weekend = dow === 0 || dow === 6;
        return { ...base, state: "CLOSED", reason: weekend ? "Weekend" : "Market holiday" };
      }
      if (minutes < SESSION_OPEN_MIN) return { ...base, state: "CLOSED", reason: "Before the session opens" };
      if (minutes >= SESSION_CLOSE_MIN) return { ...base, state: "CLOSED", reason: "Session closed for the day" };
      return { ...base, state: "OPEN", reason: "Trading hours" };
    },

    async getTradingCalendar(range): Promise<TradingDay[]> {
      assertRange(range);
      const days: TradingDay[] = [];
      for (let d = range.from; d <= range.to; d = addDays(d, 1)) {
        const trading = isTradingDay(d, holidays);
        const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
        const isWeekday = dow !== 0 && dow !== 6;
        days.push({
          date: d,
          isTradingDay: trading,
          ...(isWeekday && !trading ? { holiday: true as const } : {}),
        });
      }
      return days;
    },
  };
}
