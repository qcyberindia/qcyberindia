import { describe, expect, it } from "vitest";
import type { Db } from "@/lib/fund/db";
import { getMarketDataProvider } from "@/lib/market-data";
import { createSnapshotProvider } from "@/lib/market-data/snapshot-provider";
import type { InstrumentRef } from "@/lib/market-data/types";

const INFY: InstrumentRef = { instrumentId: 1, symbol: "INFY", exchange: "NSE" };
const TCS: InstrumentRef = { instrumentId: 2, symbol: "TCS", exchange: "NSE" };
const NOW = new Date("2026-10-05T05:00:00Z"); // Monday 10:30 IST

type Row = Record<string, unknown>;

/** A fake Db that returns canned rows and records every call. */
function fakeDb(rows: Row[]) {
  const calls: Array<{ text: string; values?: unknown[] }> = [];
  const db = {
    query: async (text: string, values?: unknown[]) => {
      calls.push({ text, values });
      return { rows };
    },
  } as unknown as Db;
  return { db, calls };
}

function snapshot(over: Partial<Row> = {}): Row {
  return {
    instrument_id: 1,
    price: "1500.2500",
    quality: "EOD",
    source: "operator",
    as_of: new Date("2026-10-05T04:00:00Z"),
    ...over,
  };
}

describe("snapshot provider: quotes", () => {
  it("reports an instrument with no recorded price as unavailable, with no price", async () => {
    const { db } = fakeDb([]);
    const q = await createSnapshotProvider({ db, now: () => NOW }).getQuote(INFY);
    expect(q.available).toBe(false);
    expect(q.quality).toBe("UNAVAILABLE");
    expect("price" in q).toBe(false);
  });

  it("keeps a recent LIVE snapshot LIVE", async () => {
    const { db } = fakeDb([snapshot({ quality: "LIVE", as_of: new Date(NOW.getTime() - 60_000) })]);
    const q = await createSnapshotProvider({ db, now: () => NOW }).getQuote(INFY);
    expect(q).toMatchObject({ available: true, quality: "LIVE", price: "1500.2500" });
  });

  it("downgrades an old LIVE snapshot to DELAYED rather than presenting it as live", async () => {
    const { db } = fakeDb([snapshot({ quality: "LIVE", as_of: new Date(NOW.getTime() - 10 * 60_000) })]);
    const q = await createSnapshotProvider({ db, now: () => NOW }).getQuote(INFY);
    expect(q).toMatchObject({ available: true, quality: "DELAYED" });
  });

  it("honours a custom live window", async () => {
    const { db } = fakeDb([snapshot({ quality: "LIVE", as_of: new Date(NOW.getTime() - 10 * 60_000) })]);
    const q = await createSnapshotProvider({ db, now: () => NOW, liveWindowMs: 15 * 60_000 }).getQuote(INFY);
    expect(q).toMatchObject({ quality: "LIVE" });
  });

  it("leaves EOD and MANUAL quality unchanged regardless of age", async () => {
    const old = new Date("2026-01-01T00:00:00Z");
    for (const quality of ["EOD", "MANUAL"] as const) {
      const { db } = fakeDb([snapshot({ quality, as_of: old })]);
      const q = await createSnapshotProvider({ db, now: () => NOW }).getQuote(INFY);
      expect(q).toMatchObject({ available: true, quality });
    }
  });

  it("returns the price as the stored decimal string, untouched", async () => {
    const { db } = fakeDb([snapshot({ price: "0.1000" })]);
    const q = await createSnapshotProvider({ db, now: () => NOW }).getQuote(INFY);
    expect(q.available && q.price).toBe("0.1000");
  });

  it("getQuotes preserves input order and marks missing instruments unavailable", async () => {
    const { db, calls } = fakeDb([snapshot({ instrument_id: 2, price: "3000.0000" })]);
    const quotes = await createSnapshotProvider({ db, now: () => NOW }).getQuotes([INFY, TCS, INFY]);
    expect(quotes.map((q) => q.instrument.symbol)).toEqual(["INFY", "TCS", "INFY"]);
    expect(quotes.map((q) => q.available)).toEqual([false, true, false]);
    // instrument ids are de-duplicated before the single query
    expect(calls).toHaveLength(1);
    // unscoped provider: fund id parameter is null (provider-wide prices only)
    expect(calls[0].values).toEqual([[1, 2], null]);
  });

  it("getQuotes with no instruments does not query", async () => {
    const { db, calls } = fakeDb([]);
    expect(await createSnapshotProvider({ db }).getQuotes([])).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});

describe("snapshot provider: historical prices", () => {
  it("maps rows and passes parameters, never interpolating values into SQL", async () => {
    const { db, calls } = fakeDb([{ date: "2026-10-01", price: "1490.0000", quality: "EOD", source: "operator" }]);
    const out = await createSnapshotProvider({ db }).getHistoricalPrices(INFY, { from: "2026-10-01", to: "2026-10-05" });
    expect(out).toEqual([{ date: "2026-10-01", price: "1490.0000", quality: "EOD", source: "operator" }]);
    expect(calls[0].values).toEqual([1, "2026-10-01", "2026-10-05", null]);
    expect(calls[0].text).not.toContain("2026-10-01");
  });

  it("rejects malformed, inverted, and oversized ranges", async () => {
    const p = createSnapshotProvider({ db: fakeDb([]).db });
    await expect(p.getHistoricalPrices(INFY, { from: "2026-13-01", to: "2026-10-05" })).rejects.toThrow(/valid ISO/);
    await expect(p.getHistoricalPrices(INFY, { from: "2026-10-05", to: "2026-10-01" })).rejects.toThrow(/after/);
    await expect(p.getHistoricalPrices(INFY, { from: "2000-01-01", to: "2026-10-01" })).rejects.toThrow(/too large/);
  });
});

describe("snapshot provider: market status (schedule-based)", () => {
  const provider = createSnapshotProvider({ db: fakeDb([]).db, holidays: ["2026-10-02"] });

  it("is open during trading hours and says it is schedule-based", async () => {
    const s = await provider.getMarketStatus(new Date("2026-10-05T04:30:00Z")); // Mon 10:00 IST
    expect(s).toMatchObject({ state: "OPEN", basis: "schedule" });
  });

  it("opens at 09:15 and closes at 15:30 IST", async () => {
    expect((await provider.getMarketStatus(new Date("2026-10-05T03:44:00Z"))).state).toBe("CLOSED"); // 09:14
    expect((await provider.getMarketStatus(new Date("2026-10-05T03:45:00Z"))).state).toBe("OPEN"); // 09:15
    expect((await provider.getMarketStatus(new Date("2026-10-05T09:59:00Z"))).state).toBe("OPEN"); // 15:29
    expect((await provider.getMarketStatus(new Date("2026-10-05T10:00:00Z"))).state).toBe("CLOSED"); // 15:30
  });

  it("is closed on weekends and configured holidays, with the reason", async () => {
    expect(await provider.getMarketStatus(new Date("2026-10-03T04:30:00Z"))).toMatchObject({
      state: "CLOSED",
      reason: "Weekend",
    });
    expect(await provider.getMarketStatus(new Date("2026-10-02T04:30:00Z"))).toMatchObject({
      state: "CLOSED",
      reason: "Market holiday",
    });
  });
});

describe("snapshot provider: trading calendar", () => {
  it("flags weekends as non-trading and weekday holidays as holidays", async () => {
    const provider = createSnapshotProvider({ db: fakeDb([]).db, holidays: ["2026-10-02"] });
    const cal = await provider.getTradingCalendar({ from: "2026-10-01", to: "2026-10-05" });
    expect(cal).toEqual([
      { date: "2026-10-01", isTradingDay: true },
      { date: "2026-10-02", isTradingDay: false, holiday: true },
      { date: "2026-10-03", isTradingDay: false },
      { date: "2026-10-04", isTradingDay: false },
      { date: "2026-10-05", isTradingDay: true },
    ]);
  });
});

describe("provider factory", () => {
  it("returns the manual provider", () => {
    expect(getMarketDataProvider("manual", { db: fakeDb([]).db }).name).toBe("manual");
  });

  it("throws on an unknown provider instead of silently substituting one", () => {
    expect(() => getMarketDataProvider("acme-feed", { db: fakeDb([]).db })).toThrow(/Unknown market data provider/);
  });
});

describe("snapshot provider: fund scope", () => {
  it("passes the fund id so only this fund's and provider-wide prices are visible", async () => {
    const { db, calls } = fakeDb([]);
    await createSnapshotProvider({ db, fundId: 7, now: () => NOW }).getQuote(INFY);
    expect(calls[0].values).toEqual([[1], 7]);
    expect(calls[0].text).toContain("fund_id IS NULL OR fund_id = $2");
  });

  it("scopes historical prices by fund too", async () => {
    const { db, calls } = fakeDb([]);
    await createSnapshotProvider({ db, fundId: 7 }).getHistoricalPrices(INFY, { from: "2026-10-01", to: "2026-10-05" });
    expect(calls[0].values).toEqual([1, "2026-10-01", "2026-10-05", 7]);
    expect(calls[0].text).toContain("fund_id = $4");
  });
});

describe("snapshot provider: staleness", () => {
  // NOW is Monday 2026-10-05 10:30 IST: the last completed session is Friday 2026-10-02.
  it("does not flag the previous session's EOD price as stale", async () => {
    const { db } = fakeDb([snapshot({ quality: "EOD", as_of: new Date("2026-10-02T10:00:00Z") })]);
    const q = await createSnapshotProvider({ db, now: () => NOW }).getQuote(INFY);
    expect(q).toMatchObject({ available: true, stale: false });
  });

  it("flags a price older than the last completed session as stale, but still reports it", async () => {
    const { db } = fakeDb([snapshot({ quality: "EOD", as_of: new Date("2026-10-01T10:00:00Z") })]);
    const q = await createSnapshotProvider({ db, now: () => NOW }).getQuote(INFY);
    expect(q).toMatchObject({ available: true, quality: "EOD", price: "1500.2500", stale: true });
  });

  it("treats configured holidays as non-sessions", async () => {
    // Friday 2026-10-02 is a holiday here, so the last completed session is Thursday 2026-10-01.
    const { db } = fakeDb([snapshot({ quality: "EOD", as_of: new Date("2026-10-01T10:00:00Z") })]);
    const q = await createSnapshotProvider({ db, now: () => NOW, holidays: ["2026-10-02"] }).getQuote(INFY);
    expect(q).toMatchObject({ stale: false });
  });
});
