// NSE instrument master import against a real database: idempotent upsert,
// preservation of existing records, and the imported rows flowing through
// pool search, trades, holdings and watchlist without breaking isolation.
// Opt-in: see harness.ts.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, createUser, integrationEnabled, json, params, request, type TestDb, type TestUser } from "./harness";
import { applyEquityImport, parseEquityList } from "@/lib/market-data/nse-equity-import";

import * as poolsRoute from "@/app/api/qfinera/pools/route";
import * as contributionsRoute from "@/app/api/qfinera/pools/[poolId]/contributions/route";
import * as contributionRoute from "@/app/api/qfinera/pools/[poolId]/contributions/[id]/route";
import * as navRoute from "@/app/api/qfinera/pools/[poolId]/nav/route";
import * as instrumentsRoute from "@/app/api/qfinera/pools/[poolId]/instruments/route";
import * as instrumentRoute from "@/app/api/qfinera/pools/[poolId]/instruments/[id]/route";
import * as tradesRoute from "@/app/api/qfinera/pools/[poolId]/trades/route";
import * as holdingsRoute from "@/app/api/qfinera/pools/[poolId]/holdings/route";
import * as watchlistRoute from "@/app/api/qfinera/pools/[poolId]/watchlist/route";

// Real rows from NSE's EQUITY_L.csv (one per series), header as published.
const NSE_CSV = [
  "SYMBOL,NAME OF COMPANY, SERIES, DATE OF LISTING, PAID UP VALUE, MARKET LOT, ISIN NUMBER, FACE VALUE",
  "20MICRONS,20 Microns Limited,EQ,06-OCT-2008,5,1,INE144J01027,5",
  "INFY,Infosys Limited,EQ,08-FEB-1995,5,1,INE009A01021,5",
  "TCS,Tata Consultancy Services Limited,EQ,25-AUG-2004,1,1,INE467B01029,1",
  "21STCENMGM,21st Century Management Services Limited,BE,03-MAY-1995,10,1,INE253B01015,10",
].join("\n");

const suite = integrationEnabled ? describe : describe.skip;

suite("NSE instrument master (real database)", () => {
  let db: TestDb;
  let alice: TestUser; // ADMIN of pool A
  let carol: TestUser; // MANAGER of pool A
  let mallory: TestUser; // ADMIN of pool B
  let poolA = "";
  let poolB = "";
  let infy = 0;

  const P = (poolId: string) => params({ poolId });

  async function runImport(text: string) {
    const parsed = parseEquityList(text);
    await db.query("BEGIN");
    try {
      const r = await applyEquityImport(db, parsed.rows, { exchange: "NSE", source: "NSE:test.csv" });
      await db.query("COMMIT");
      return r;
    } catch (err) {
      await db.query("ROLLBACK");
      throw err;
    }
  }

  async function search(user: TestUser, poolId: string, q: string) {
    const r = await json(await instrumentsRoute.GET(request(user, `/api/qfinera/pools/${poolId}/instruments?q=${encodeURIComponent(q)}`), P(poolId)));
    expect(r.status).toBe(200);
    return r.body.data.instruments as Array<{ id: number; symbol: string; exchange: string; name: string; isin: string; series: string }>;
  }

  beforeAll(async () => {
    db = await createTestDatabase();
    alice = await createUser(db, "alice");
    carol = await createUser(db, "carol");
    mallory = await createUser(db, "mallory");
    const a = await json(await poolsRoute.POST(request(alice, "/api/qfinera/pools", { body: { name: "Pool A", acknowledgePrivate: true } })));
    poolA = String(a.body.data.pool.id);
    const b = await json(await poolsRoute.POST(request(mallory, "/api/qfinera/pools", { body: { name: "Pool B", acknowledgePrivate: true } })));
    poolB = String(b.body.data.pool.id);
    await db.query("INSERT INTO qfinera_fund_memberships (fund_id, user_id, role) VALUES ($1, $2, 'MANAGER')", [poolA, carol.id]);
    // A pre-existing, hand-entered record that the import must not clobber.
    await db.query("INSERT INTO qfinera_fund_instruments (symbol, exchange, name) VALUES ('TCS', 'NSE', 'TCS (manual)')");
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  it("imports new rows, enriches existing ones without overwriting their name", async () => {
    const r = await runImport(NSE_CSV);
    expect(r).toEqual({ imported: 3, updated: 1, skipped: 0, rejected: [] });
    const { rows } = await db.query(
      `SELECT symbol, exchange, name, isin, series, listing_date::text AS listing_date, lot_size,
              face_value::text AS face_value, paid_up_value::text AS paid_up_value
         FROM qfinera_fund_instruments ORDER BY symbol`
    );
    expect(rows).toHaveLength(4);
    expect(rows.find((x) => x.symbol === "INFY")).toEqual({
      symbol: "INFY",
      exchange: "NSE",
      name: "Infosys Limited",
      isin: "INE009A01021",
      series: "EQ",
      listing_date: "1995-02-08",
      lot_size: 1,
      face_value: "5.0000",
      paid_up_value: "5.0000",
    });
    expect(rows.find((x) => x.symbol === "TCS")).toMatchObject({ name: "TCS (manual)", isin: "INE467B01029" });
    expect(rows.find((x) => x.symbol === "21STCENMGM")).toMatchObject({ series: "BE" });
  });

  it("is idempotent: re-running the same file changes nothing", async () => {
    const before = await db.query("SELECT id, master_synced_at FROM qfinera_fund_instruments ORDER BY id");
    expect(await runImport(NSE_CSV)).toEqual({ imported: 0, updated: 0, skipped: 4, rejected: [] });
    const after = await db.query("SELECT id, master_synced_at FROM qfinera_fund_instruments ORDER BY id");
    expect(after.rows).toEqual(before.rows);
  });

  it("rejects ISIN conflicts with stored records instead of overwriting", async () => {
    const renamed = NSE_CSV.replace("INFY,Infosys Limited", "INFYNEW,Infosys Limited");
    const r = await runImport(renamed);
    expect(r.imported).toBe(0);
    expect(r.rejected).toEqual([{ line: 3, symbol: "INFYNEW", reason: "ISIN INE009A01021 already belongs to INFY" }]);
    const { rows } = await db.query("SELECT count(*)::int AS n FROM qfinera_fund_instruments WHERE symbol = 'INFYNEW'");
    expect(rows[0].n).toBe(0);
  });

  it("INFY is found by symbol, company name and ISIN, exact symbol first", async () => {
    const bySymbol = await search(carol, poolA, "INFY");
    expect(bySymbol[0]).toMatchObject({ symbol: "INFY", exchange: "NSE", name: "Infosys Limited", isin: "INE009A01021", series: "EQ" });
    infy = bySymbol[0].id;
    expect((await search(carol, poolA, "Infosys")).map((i) => i.symbol)).toEqual(["INFY"]);
    expect((await search(carol, poolA, "infosys")).map((i) => i.symbol)).toEqual(["INFY"]);
    expect((await search(carol, poolA, "INE009A01021")).map((i) => i.symbol)).toEqual(["INFY"]);
    // The same shared reference row is visible from any pool.
    expect((await search(mallory, poolB, "INFY"))[0].id).toBe(infy);
  });

  it("a manager cannot create a duplicate INFY; the existing master row is reused", async () => {
    const dup = await json(
      await instrumentsRoute.POST(request(carol, `/api/qfinera/pools/${poolA}/instruments`, { body: { symbol: "infy", exchange: "NSE" } }), P(poolA))
    );
    expect(dup.status).toBe(409);
    const { rows } = await db.query("SELECT count(*)::int AS n FROM qfinera_fund_instruments WHERE symbol = 'INFY'");
    expect(rows[0].n).toBe(1);
  });

  it("a manager trades INFY in pool A and it appears in pool A's holdings only", async () => {
    const c = await json(
      await contributionsRoute.POST(
        request(alice, `/api/qfinera/pools/${poolA}/contributions`, { body: { amount: "10000.00", paymentDate: "2026-08-31", utr: "UTR-IM-1" } }),
        P(poolA)
      )
    );
    expect(c.status).toBe(201);
    const cid = c.body.data.contribution.id;
    for (const action of ["approve", "confirm-funds"]) {
      const r = await contributionRoute.POST(request(alice, `/api/qfinera/pools/${poolA}/contributions/${cid}`, { body: { action } }), params({ poolId: poolA, id: String(cid) }));
      expect(r.status).toBe(200);
    }
    const nav = await navRoute.POST(request(alice, `/api/qfinera/pools/${poolA}/nav`, { body: { date: "2026-09-01" } }), P(poolA));
    expect(nav.status).toBe(200);

    const trade = await json(
      await tradesRoute.POST(
        request(carol, `/api/qfinera/pools/${poolA}/trades`, {
          body: { instrumentId: infy, side: "BUY", tradeDate: "2026-09-02", quantity: "3", price: "1500", execute: true },
        }),
        P(poolA)
      )
    );
    expect(trade.status, JSON.stringify(trade.body)).toBe(201);

    const holdingsA = await json(await holdingsRoute.GET(request(carol, `/api/qfinera/pools/${poolA}/holdings`), P(poolA)));
    expect(holdingsA.body.data.rows).toEqual([expect.objectContaining({ instrumentId: infy, symbol: "INFY", quantity: "3.0000" })]);
    const holdingsB = await json(await holdingsRoute.GET(request(mallory, `/api/qfinera/pools/${poolB}/holdings`), P(poolB)));
    expect(holdingsB.body.data.rows).toEqual([]);
  });

  it("INFY can be put on the watchlist; one open item per instrument per pool, isolated per pool", async () => {
    const w = await json(
      await watchlistRoute.POST(request(carol, `/api/qfinera/pools/${poolA}/watchlist`, { body: { instrumentId: infy, title: "Infosys research" } }), P(poolA))
    );
    expect(w.status).toBe(201);
    expect(w.body.data.item).toMatchObject({ symbol: "INFY" });
    const again = await watchlistRoute.POST(
      request(carol, `/api/qfinera/pools/${poolA}/watchlist`, { body: { instrumentId: infy, title: "Again" } }),
      P(poolA)
    );
    expect(again.status).toBe(409);
    const inB = await watchlistRoute.POST(
      request(mallory, `/api/qfinera/pools/${poolB}/watchlist`, { body: { instrumentId: infy, title: "Pool B note" } }),
      P(poolB)
    );
    expect(inB.status).toBe(201);
    const listB = await json(await watchlistRoute.GET(request(mallory, `/api/qfinera/pools/${poolB}/watchlist`), P(poolB)));
    expect(listB.body.data.watchlist.map((i: { title: string }) => i.title)).toEqual(["Pool B note"]);
  });

  it("pool B cannot record a price that moves pool A's view of INFY", async () => {
    const r = await instrumentRoute.POST(
      request(mallory, `/api/qfinera/pools/${poolB}/instruments/${infy}`, { body: { action: "record-price", price: "1.0000", date: "2026-09-02" } }),
      params({ poolId: poolB, id: String(infy) })
    );
    expect(r.status).toBe(201);
    const inA = await json(await instrumentRoute.GET(request(carol, `/api/qfinera/pools/${poolA}/instruments/${infy}`), params({ poolId: poolA, id: String(infy) })));
    expect(inA.body.data.quote).toMatchObject({ available: false });
  });
});
