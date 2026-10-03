// Trading model (migration 012) against a real database: products,
// position actions, intraday shorts without holdings, partial/full closes,
// reversal as two executions, futures and options contracts, P&L, charges,
// NAV/cash, audit, duplicate prevention and pool isolation.
// Opt-in: see harness.ts.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, createUser, integrationEnabled, json, params, request, type TestDb, type TestUser } from "./harness";

import * as poolsRoute from "@/app/api/qfinera/pools/route";
import * as contributionsRoute from "@/app/api/qfinera/pools/[poolId]/contributions/route";
import * as contributionRoute from "@/app/api/qfinera/pools/[poolId]/contributions/[id]/route";
import * as navRoute from "@/app/api/qfinera/pools/[poolId]/nav/route";
import * as instrumentsRoute from "@/app/api/qfinera/pools/[poolId]/instruments/route";
import * as instrumentRoute from "@/app/api/qfinera/pools/[poolId]/instruments/[id]/route";
import * as tradesRoute from "@/app/api/qfinera/pools/[poolId]/trades/route";
import * as tradeRoute from "@/app/api/qfinera/pools/[poolId]/trades/[id]/route";
import * as previewRoute from "@/app/api/qfinera/pools/[poolId]/trades/preview/route";
import * as holdingsRoute from "@/app/api/qfinera/pools/[poolId]/holdings/route";
import * as reportsRoute from "@/app/api/qfinera/pools/[poolId]/reports/route";

const suite = integrationEnabled ? describe : describe.skip;

type Ticket = {
  instrumentId: number;
  product?: string;
  action?: string;
  side?: string;
  tradeDate?: string;
  quantity: string;
  price: string;
  brokerage?: string;
  externalRef?: string;
  execute?: boolean;
};

suite("trading: products, positions and P&L (real database)", () => {
  let db: TestDb;
  let alice: TestUser; // ADMIN of pool A
  let carol: TestUser; // MANAGER of pool A
  let mallory: TestUser; // ADMIN of pool B
  let poolA = "";
  let poolB = "";
  const ids: Record<string, number> = {};

  const P = (poolId: string) => params({ poolId });

  async function trade(user: TestUser, poolId: string, t: Ticket) {
    return json(
      await tradesRoute.POST(
        request(user, `/api/qfinera/pools/${poolId}/trades`, { body: { tradeDate: "2026-09-02", execute: true, ...t } }),
        P(poolId)
      )
    );
  }

  async function preview(user: TestUser, poolId: string, t: Ticket) {
    return json(
      await previewRoute.POST(request(user, `/api/qfinera/pools/${poolId}/trades/preview`, { body: { tradeDate: "2026-09-02", ...t } }), P(poolId))
    );
  }

  async function holdings(user: TestUser, poolId: string) {
    const r = await json(await holdingsRoute.GET(request(user, `/api/qfinera/pools/${poolId}/holdings`), P(poolId)));
    expect(r.status).toBe(200);
    return r.body.data;
  }

  async function ledgerCash(tradeId: number) {
    const { rows } = await db.query(
      "SELECT entry_type, cash_delta::text AS cash FROM qfinera_fund_ledger_entries WHERE reference_table = 'qfinera_fund_trades' AND reference_id = $1 ORDER BY id",
      [tradeId]
    );
    return rows.map((r) => `${r.entry_type} ${r.cash}`);
  }

  const position = (h: { rows: Array<Record<string, unknown>> }, symbol: string, product: string) =>
    h.rows.find((r) => r.symbol === symbol && r.product === product);

  beforeAll(async () => {
    db = await createTestDatabase();
    alice = await createUser(db, "alice");
    carol = await createUser(db, "carol");
    mallory = await createUser(db, "mallory");
    poolA = String((await json(await poolsRoute.POST(request(alice, "/api/qfinera/pools", { body: { name: "Pool A", acknowledgePrivate: true } })))).body.data.pool.id);
    poolB = String((await json(await poolsRoute.POST(request(mallory, "/api/qfinera/pools", { body: { name: "Pool B", acknowledgePrivate: true } })))).body.data.pool.id);
    await db.query("INSERT INTO qfinera_fund_memberships (fund_id, user_id, role) VALUES ($1, $2, 'MANAGER')", [poolA, carol.id]);

    for (const [symbol, name] of [["INFY", "Infosys Limited"], ["TCS", "Tata Consultancy Services Limited"], ["RELIANCE", "Reliance Industries Limited"]]) {
      const { rows } = await db.query("INSERT INTO qfinera_fund_instruments (symbol, exchange, name) VALUES ($1, 'NSE', $2) RETURNING id", [symbol, name]);
      ids[symbol] = rows[0].id as number;
    }

    // Fund pool A with 10,00,000 at the initial NAV (test clock control on the NAV date).
    const c = await json(
      await contributionsRoute.POST(
        request(alice, `/api/qfinera/pools/${poolA}/contributions`, { body: { amount: "1000000.00", paymentDate: "2026-08-31", utr: "UTR-T-1" } }),
        P(poolA)
      )
    );
    const cid = c.body.data.contribution.id;
    for (const action of ["approve", "confirm-funds"]) {
      await contributionRoute.POST(request(alice, `/api/qfinera/pools/${poolA}/contributions/${cid}`, { body: { action } }), params({ poolId: poolA, id: String(cid) }));
    }
    await db.query("UPDATE qfinera_fund_contributions SET effective_date = '2026-09-01' WHERE id = $1", [cid]);
    const nav = await navRoute.POST(request(alice, `/api/qfinera/pools/${poolA}/nav`, { body: { date: "2026-09-01" } }), P(poolA));
    expect(nav.status).toBe(201);
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  // ------------------------------------------------------------- equity delivery

  it("1. buy equity delivery: full value plus charges leaves cash", async () => {
    const r = await trade(carol, poolA, { instrumentId: ids.TCS, product: "EQUITY_DELIVERY", action: "OPEN_LONG", quantity: "10", price: "4000", brokerage: "20.00" });
    expect(r.status).toBe(201);
    expect(r.body.data.trade).toMatchObject({ product: "EQUITY_DELIVERY", position_action: "OPEN_LONG", side: "BUY", status: "EXECUTED" });
    expect(await ledgerCash(r.body.data.trade.id)).toEqual(["BUY -40020.00"]);
  });

  it("2. sell equity delivery (legacy side-only request = close long)", async () => {
    const r = await trade(carol, poolA, { instrumentId: ids.TCS, side: "SELL", quantity: "4", price: "4100", brokerage: "10.00" });
    expect(r.status).toBe(201);
    expect(r.body.data.trade).toMatchObject({ product: "EQUITY_DELIVERY", position_action: "CLOSE_LONG" });
    expect(await ledgerCash(r.body.data.trade.id)).toEqual(["SELL 16390.00"]);
    const tcs = position(await holdings(carol, poolA), "TCS", "EQUITY_DELIVERY");
    // cost 40020 -> 4/10 removed = 16008.00; realized = 16390 - 16008 = 382.00
    expect(tcs).toMatchObject({ direction: "LONG", quantity: "6.0000", realizedPnl: "382.00", costBasis: "24012.00" });
  });

  it("3. a delivery short is refused (no short delivery); overselling delivery is refused", async () => {
    const short = await trade(carol, poolA, { instrumentId: ids.INFY, product: "EQUITY_DELIVERY", action: "OPEN_SHORT", quantity: "1", price: "1500" });
    expect(short.status).toBe(400);
    expect(short.body.error.message).toMatch(/long-only/);
    const oversell = await trade(carol, poolA, { instrumentId: ids.TCS, side: "SELL", quantity: "7", price: "4100" });
    expect(oversell.status).toBe(409);
    expect(oversell.body.error.message).toMatch(/oversell TCS/);
  });

  // ------------------------------------------------------------- equity intraday

  it("6. open an equity intraday SHORT with no holding at all", async () => {
    const before = await holdings(carol, poolA);
    expect(before.rows.some((r: { symbol: string }) => r.symbol === "INFY")).toBe(false);
    const r = await trade(carol, poolA, { instrumentId: ids.INFY, product: "EQUITY_INTRADAY", action: "OPEN_SHORT", quantity: "100", price: "1520" });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.data.trade).toMatchObject({ side: "SELL", position_action: "OPEN_SHORT" });
    expect(await ledgerCash(r.body.data.trade.id)).toEqual(["TRADE_MTM 0.00"]); // no notional moves; no ownership created
    const infy = position(await holdings(carol, poolA), "INFY", "EQUITY_INTRADAY");
    expect(infy).toMatchObject({ direction: "SHORT", quantity: "100.0000", averageEntryPrice: "1520.0000" });
  });

  it("7. partial close of the short: preview, then BUY 40 @ 1500", async () => {
    const p = await preview(carol, poolA, { instrumentId: ids.INFY, product: "EQUITY_INTRADAY", action: "CLOSE_SHORT", quantity: "40", price: "1500" });
    expect(p.status).toBe(200);
    expect(p.body.data.preview).toMatchObject({
      side: "BUY",
      before: { direction: "SHORT", quantity: "100.0000", averageEntryPrice: "1520.0000" },
      after: { direction: "SHORT", quantity: "60.0000" },
      realizedPnl: "800.00",
      cashImpact: "800.00",
      problem: null,
    });
    const r = await trade(carol, poolA, { instrumentId: ids.INFY, product: "EQUITY_INTRADAY", action: "CLOSE_SHORT", quantity: "40", price: "1500" });
    expect(r.status).toBe(201);
    expect(await ledgerCash(r.body.data.trade.id)).toEqual(["TRADE_MTM 800.00"]);
    expect(position(await holdings(carol, poolA), "INFY", "EQUITY_INTRADAY")).toMatchObject({ direction: "SHORT", quantity: "60.0000", realizedPnl: "800.00" });
  });

  it("8. full close of the short: BUY 60 @ 1490 closes it; total realized 2,600", async () => {
    const r = await trade(carol, poolA, { instrumentId: ids.INFY, product: "EQUITY_INTRADAY", action: "CLOSE_SHORT", quantity: "60", price: "1490" });
    expect(r.status).toBe(201);
    expect(await ledgerCash(r.body.data.trade.id)).toEqual(["TRADE_MTM 1800.00"]);
    const h = await holdings(carol, poolA);
    expect(position(h, "INFY", "EQUITY_INTRADAY")).toBeUndefined();
    expect(h.closed.find((r: { symbol: string }) => r.symbol === "INFY")).toMatchObject({ direction: null, quantity: "0.0000", realizedPnl: "2600.00" });
  });

  it("4/5. open and close an equity intraday long", async () => {
    const open = await trade(carol, poolA, { instrumentId: ids.RELIANCE, product: "EQUITY_INTRADAY", action: "OPEN_LONG", quantity: "50", price: "2900", brokerage: "15.00" });
    expect(open.status).toBe(201);
    expect(await ledgerCash(open.body.data.trade.id)).toEqual(["TRADE_MTM -15.00"]);
    const close = await trade(carol, poolA, { instrumentId: ids.RELIANCE, product: "EQUITY_INTRADAY", action: "CLOSE_LONG", quantity: "50", price: "2920", brokerage: "15.00" });
    expect(close.status).toBe(201);
    expect(await ledgerCash(close.body.data.trade.id)).toEqual(["TRADE_MTM 985.00"]);
    expect((await holdings(carol, poolA)).closed.find((r: { symbol: string }) => r.symbol === "RELIANCE")).toMatchObject({ realizedPnl: "970.00", chargesPaid: "30.00" });
  });

  it("9. reverse long to short: one execution crossing zero is refused; close then open works", async () => {
    await trade(carol, poolA, { instrumentId: ids.RELIANCE, product: "EQUITY_INTRADAY", action: "OPEN_LONG", quantity: "50", price: "2900" });
    const cross = await trade(carol, poolA, { instrumentId: ids.RELIANCE, product: "EQUITY_INTRADAY", action: "CLOSE_LONG", quantity: "80", price: "2910" });
    expect(cross.status).toBe(409);
    const openShortWhileLong = await trade(carol, poolA, { instrumentId: ids.RELIANCE, product: "EQUITY_INTRADAY", action: "OPEN_SHORT", quantity: "30", price: "2910" });
    expect(openShortWhileLong.status).toBe(409);
    expect(openShortWhileLong.body.error.message).toMatch(/close it before opening SHORT/);
    expect((await trade(carol, poolA, { instrumentId: ids.RELIANCE, product: "EQUITY_INTRADAY", action: "CLOSE_LONG", quantity: "50", price: "2910" })).status).toBe(201);
    expect((await trade(carol, poolA, { instrumentId: ids.RELIANCE, product: "EQUITY_INTRADAY", action: "OPEN_SHORT", quantity: "30", price: "2910" })).status).toBe(201);
    expect(position(await holdings(carol, poolA), "RELIANCE", "EQUITY_INTRADAY")).toMatchObject({ direction: "SHORT", quantity: "30.0000" });
  });

  it("10. reverse short to long the same way", async () => {
    const openLongWhileShort = await trade(carol, poolA, { instrumentId: ids.RELIANCE, product: "EQUITY_INTRADAY", action: "OPEN_LONG", quantity: "10", price: "2905" });
    expect(openLongWhileShort.status).toBe(409);
    expect((await trade(carol, poolA, { instrumentId: ids.RELIANCE, product: "EQUITY_INTRADAY", action: "CLOSE_SHORT", quantity: "30", price: "2905" })).status).toBe(201);
    expect((await trade(carol, poolA, { instrumentId: ids.RELIANCE, product: "EQUITY_INTRADAY", action: "OPEN_LONG", quantity: "10", price: "2905" })).status).toBe(201);
    expect(position(await holdings(carol, poolA), "RELIANCE", "EQUITY_INTRADAY")).toMatchObject({ direction: "LONG", quantity: "10.0000" });
  });

  // ------------------------------------------------------------- contracts

  it("15/16. an option needs a strike and an expiry; a future needs an expiry", async () => {
    const post = (body: Record<string, unknown>) => instrumentsRoute.POST(request(carol, `/api/qfinera/pools/${poolA}/instruments`, { body }), P(poolA));
    expect((await post({ instrumentType: "OPTION", exchange: "NSE", underlying: "NIFTY", expiryDate: "2026-11-26", optionType: "CE" })).status).toBe(400);
    expect((await post({ instrumentType: "OPTION", exchange: "NSE", underlying: "NIFTY", strikePrice: "25000", optionType: "CE" })).status).toBe(400);
    expect((await post({ instrumentType: "OPTION", exchange: "NSE", underlying: "NIFTY", expiryDate: "2026-11-26", strikePrice: "25000" })).status).toBe(400);
    expect((await post({ instrumentType: "FUTURE", exchange: "NSE", underlying: "NIFTY" })).status).toBe(400);
    expect((await post({ instrumentType: "FUTURE", exchange: "NSE", underlying: "NIFTY", expiryDate: "2026-11-26", strikePrice: "1" })).status).toBe(400);
    // The database refuses an equity row carrying contract fields.
    await expect(
      db.query("INSERT INTO qfinera_fund_instruments (symbol, exchange, expiry_date) VALUES ('BAD', 'NSE', '2026-11-26')")
    ).rejects.toThrow(/type_check/);
  });

  it("creates futures and options contracts as separate, searchable instruments", async () => {
    const post = async (body: Record<string, unknown>) =>
      json(await instrumentsRoute.POST(request(carol, `/api/qfinera/pools/${poolA}/instruments`, { body: { exchange: "NSE", underlying: "NIFTY", expiryDate: "2026-11-26", lotSize: 75, ...body } }), P(poolA)));
    const fut = await post({ instrumentType: "FUTURE" });
    expect(fut.status).toBe(201);
    expect(fut.body.data.instrument).toMatchObject({ symbol: "NIFTY26NOV2026FUT", instrumentType: "FUTURE", expiryDate: "2026-11-26", lotSize: 75 });
    ids.FUT = fut.body.data.instrument.id;
    const ce = await post({ instrumentType: "OPTION", strikePrice: "25000", optionType: "CE" });
    expect(ce.body.data.instrument).toMatchObject({ symbol: "NIFTY26NOV202625000CE", strikePrice: "25000.0000", optionType: "CE" });
    ids.CE = ce.body.data.instrument.id;
    ids.PE = (await post({ instrumentType: "OPTION", strikePrice: "24000", optionType: "PE" })).body.data.instrument.id;
    expect((await post({ instrumentType: "OPTION", strikePrice: "25000", optionType: "CE" })).status).toBe(409); // duplicate contract

    const search = async (query: string) =>
      (await json(await instrumentsRoute.GET(request(carol, `/api/qfinera/pools/${poolA}/instruments?${query}`), P(poolA)))).body.data.instruments.map((i: { symbol: string }) => i.symbol);
    expect(await search("q=NIFTY&type=OPTION&strike=25000&optionType=CE&expiry=2026-11-26")).toEqual(["NIFTY26NOV202625000CE"]);
    expect(await search("q=NIFTY&type=FUTURE")).toEqual(["NIFTY26NOV2026FUT"]);
    expect(await search("q=INFY&type=OPTION")).toEqual([]); // an equity row never shows up as a contract
  });

  it("a product only trades its own instrument type; derivatives need whole lots", async () => {
    expect((await trade(carol, poolA, { instrumentId: ids.CE, product: "EQUITY_INTRADAY", action: "OPEN_LONG", quantity: "75", price: "100" })).status).toBe(400);
    expect((await trade(carol, poolA, { instrumentId: ids.INFY, product: "FUTURES", action: "OPEN_LONG", quantity: "75", price: "100" })).status).toBe(400);
    const lots = await trade(carol, poolA, { instrumentId: ids.FUT, product: "FUTURES", action: "OPEN_LONG", quantity: "50", price: "25000" });
    expect(lots.status).toBe(400);
    expect(lots.body.error.message).toMatch(/lot size 75/);
  });

  it("11. futures long: mark-to-market open and close", async () => {
    const open = await trade(carol, poolA, { instrumentId: ids.FUT, product: "FUTURES", action: "OPEN_LONG", quantity: "75", price: "25000", brokerage: "20.00" });
    expect(open.status).toBe(201);
    expect(await ledgerCash(open.body.data.trade.id)).toEqual(["TRADE_MTM -20.00"]); // no 18.75 lakh notional leaves cash
    const close = await trade(carol, poolA, { instrumentId: ids.FUT, product: "FUTURES", action: "CLOSE_LONG", quantity: "75", price: "25100", brokerage: "20.00" });
    expect(await ledgerCash(close.body.data.trade.id)).toEqual(["TRADE_MTM 7480.00"]);
  });

  it("12. futures short", async () => {
    const open = await trade(carol, poolA, { instrumentId: ids.FUT, product: "FUTURES", action: "OPEN_SHORT", quantity: "150", price: "25100" });
    expect(open.status).toBe(201);
    expect(position(await holdings(carol, poolA), "NIFTY26NOV2026FUT", "FUTURES")).toMatchObject({ direction: "SHORT", quantity: "150.0000", instrumentType: "FUTURE" });
    const close = await trade(carol, poolA, { instrumentId: ids.FUT, product: "FUTURES", action: "CLOSE_SHORT", quantity: "150", price: "25050" });
    expect(await ledgerCash(close.body.data.trade.id)).toEqual(["TRADE_MTM 7500.00"]);
  });

  it("13. options long pays the premium", async () => {
    const r = await trade(carol, poolA, { instrumentId: ids.CE, product: "OPTIONS", action: "OPEN_LONG", quantity: "75", price: "120", brokerage: "20.00" });
    expect(r.status).toBe(201);
    expect(await ledgerCash(r.body.data.trade.id)).toEqual(["BUY -9020.00"]);
  });

  it("14. options short receives the premium and is carried as a short position", async () => {
    const r = await trade(carol, poolA, { instrumentId: ids.PE, product: "OPTIONS", action: "OPEN_SHORT", quantity: "75", price: "80" });
    expect(r.status).toBe(201);
    expect(await ledgerCash(r.body.data.trade.id)).toEqual(["SELL 6000.00"]);
    expect(position(await holdings(carol, poolA), "NIFTY26NOV202624000PE", "OPTIONS")).toMatchObject({ direction: "SHORT", quantity: "75.0000" });
  });

  // ------------------------------------------------------------- NAV / cash

  it("20. NAV is blocked while an intraday position is open, then values every product correctly", async () => {
    const blocked = await json(await navRoute.GET(request(alice, `/api/qfinera/pools/${poolA}/nav?date=2026-09-02`), P(poolA)));
    expect(blocked.body.data.preview.problems.join(" ")).toMatch(/Intraday positions are still open on 2026-09-02: RELIANCE LONG 10\.0000/);
    expect((await trade(carol, poolA, { instrumentId: ids.RELIANCE, product: "EQUITY_INTRADAY", action: "CLOSE_LONG", quantity: "10", price: "2915" })).status).toBe(201);

    for (const [id, price] of [[ids.TCS, "4050"], [ids.CE, "130"], [ids.PE, "70"]] as const) {
      const r = await instrumentRoute.POST(
        request(alice, `/api/qfinera/pools/${poolA}/instruments/${id}`, { body: { action: "record-price", price, date: "2026-09-02" } }),
        params({ poolId: poolA, id: String(id) })
      );
      expect(r.status).toBe(201);
    }
    const p = (await json(await navRoute.GET(request(alice, `/api/qfinera/pools/${poolA}/nav?date=2026-09-02`), P(poolA)))).body.data.preview;
    expect(p.problems).toEqual([]);

    // Cash = 10,00,000 + every trade's posting.
    const { rows } = await db.query(
      "SELECT COALESCE(SUM(cash_delta), 0)::text AS c FROM qfinera_fund_ledger_entries WHERE fund_id = $1 AND reference_table = 'qfinera_fund_trades'",
      [poolA]
    );
    // TCS -40020 +16390 | INFY +800 +1800 | RELIANCE -15 +985, +500, +150, +100 | FUT -20 +7480, +7500 | CE -9020 | PE +6000
    expect(rows[0].c).toBe("-7370.00");
    expect(p.cash).toBe("992630.00");
    const value = (symbol: string) => p.holdings.find((h: { symbol: string }) => h.symbol === symbol).value;
    expect(value("TCS")).toBe("24300.00"); // 6 x 4050, an asset
    expect(value("NIFTY26NOV202625000CE")).toBe("9750.00"); // 75 x 130, an asset
    expect(value("NIFTY26NOV202624000PE")).toBe("-5250.00"); // 75 x 70, a liability
    expect(p.result).toMatchObject({ holdingsValue: "28800.00", fundValue: "1021430.00", nav: "10.2143" });
  });

  // ------------------------------------------------------------- P&L, charges, audit

  it("18/19. realized/unrealized P&L, trading charges and exposure are reported per product", async () => {
    const r = await json(await reportsRoute.GET(request(carol, `/api/qfinera/pools/${poolA}/reports?type=positions`), P(poolA)));
    expect(r.status).toBe(200);
    const by = Object.fromEntries(r.body.data.byProduct.map((x: { product: string }) => [x.product, x]));
    expect(by.EQUITY_DELIVERY).toMatchObject({ realizedPnl: "382.00", charges: "30.00", openPositions: 1 });
    // INFY 2600 + RELIANCE 970 + 500 + 150 + 100 = 4320; charges 30
    expect(by.EQUITY_INTRADAY).toMatchObject({ realizedPnl: "4320.00", charges: "30.00", openPositions: 0 });
    expect(by.FUTURES).toMatchObject({ realizedPnl: "14960.00", charges: "40.00" }); // 7500 - 40 + 7500
    expect(by.OPTIONS).toMatchObject({ realizedPnl: "0.00", charges: "20.00", openPositions: 2 });
    expect(r.body.data.tradingCharges).toBe("120.00");
    expect(r.body.data.realizedPnl).toBe("19662.00");
  });

  it("21. the audit trail records product and position action for every execution", async () => {
    const { rows } = await db.query(
      `SELECT action, after_state FROM qfinera_fund_audit_log
        WHERE fund_id = $1 AND entity_type = 'trade' AND action = 'trade.executed' ORDER BY id`,
      [poolA]
    );
    expect(rows.length).toBeGreaterThan(15);
    const shortOpen = rows.find((r) => (r.after_state as Record<string, unknown>).position_action === "OPEN_SHORT");
    expect(shortOpen?.after_state).toMatchObject({ product: "EQUITY_INTRADAY", side: "SELL", instrument: "INFY:NSE" });
  });

  it("22. duplicate and invalid executions are refused", async () => {
    const first = await trade(carol, poolA, { instrumentId: ids.TCS, product: "EQUITY_DELIVERY", action: "OPEN_LONG", quantity: "1", price: "4000", externalRef: "CN-777" });
    expect(first.status).toBe(201);
    const dup = await trade(carol, poolA, { instrumentId: ids.TCS, product: "EQUITY_DELIVERY", action: "OPEN_LONG", quantity: "1", price: "4000", externalRef: "CN-777" });
    expect(dup.status).toBe(409);
    const again = await tradeRoute.POST(
      request(carol, `/api/qfinera/pools/${poolA}/trades/${first.body.data.trade.id}`, { body: { action: "execute" } }),
      params({ poolId: poolA, id: String(first.body.data.trade.id) })
    );
    expect(again.status).toBe(409);
    const contradiction = await trade(carol, poolA, { instrumentId: ids.INFY, product: "EQUITY_INTRADAY", action: "OPEN_SHORT", side: "BUY", quantity: "1", price: "1500" });
    expect(contradiction.status).toBe(400);
    const noAction = await trade(carol, poolA, { instrumentId: ids.INFY, product: "EQUITY_INTRADAY", side: "SELL", quantity: "1", price: "1500" });
    expect(noAction.status).toBe(400); // a SELL is never assumed to open or close anything outside delivery
    const closeNothing = await trade(carol, poolA, { instrumentId: ids.INFY, product: "EQUITY_INTRADAY", action: "CLOSE_SHORT", quantity: "1", price: "1500" });
    expect(closeNothing.status).toBe(409);
  });

  it("a mark-to-market open cannot be reversed while a later close depends on it", async () => {
    const { rows } = await db.query(
      "SELECT id FROM qfinera_fund_trades WHERE fund_id = $1 AND instrument_id = $2 AND position_action = 'OPEN_SHORT' AND product = 'EQUITY_INTRADAY'",
      [poolA, ids.INFY]
    );
    const r = await json(
      await tradeRoute.POST(
        request(alice, `/api/qfinera/pools/${poolA}/trades/${rows[0].id}`, { body: { action: "reverse", reason: "Entered on the wrong pool", confirm: true } }),
        params({ poolId: poolA, id: String(rows[0].id) })
      )
    );
    expect(r.status).toBe(409);
    expect(r.body.error.message).toMatch(/later intraday execution/);
  });

  // ------------------------------------------------------------- isolation

  it("17. positions, trades, P&L and cash never leak between pools", async () => {
    const b = await holdings(mallory, poolB);
    expect(b.rows).toEqual([]);
    expect(b.closed).toEqual([]);
    expect(b.realizedPnl).toBe("0.00");
    // Pool B has no INFY short to close, whatever pool A did.
    const p = await preview(mallory, poolB, { instrumentId: ids.INFY, product: "EQUITY_INTRADAY", action: "CLOSE_SHORT", quantity: "1", price: "1500" });
    expect(p.body.data.preview.before).toMatchObject({ direction: null, quantity: "0.0000" });
    expect(p.body.data.preview.problem).toMatch(/no open SHORT/);
    // Pool A's trades are invisible through pool B, even to pool B's admin.
    const list = await json(await tradesRoute.GET(request(mallory, `/api/qfinera/pools/${poolB}/trades?product=EQUITY_INTRADAY`), P(poolB)));
    expect(list.body.data.trades).toEqual([]);
    expect((await holdingsRoute.GET(request(mallory, `/api/qfinera/pools/${poolA}/holdings`), P(poolA))).status).toBe(404);
    expect((await previewRoute.POST(request(mallory, `/api/qfinera/pools/${poolA}/trades/preview`, { body: { instrumentId: ids.INFY, product: "EQUITY_INTRADAY", action: "OPEN_SHORT", tradeDate: "2026-09-02", quantity: "1", price: "1" } }), P(poolA))).status).toBe(404);
  });

  it("trades can be filtered by product, direction and open/close", async () => {
    const list = async (q: string) =>
      (await json(await tradesRoute.GET(request(carol, `/api/qfinera/pools/${poolA}/trades?${q}`), P(poolA)))).body.data;
    const shorts = await list("product=EQUITY_INTRADAY&direction=SHORT&instrument=" + ids.INFY);
    expect(shorts.total).toBe(3);
    expect(shorts.trades.map((t: { position_action: string }) => t.position_action).sort()).toEqual(["CLOSE_SHORT", "CLOSE_SHORT", "OPEN_SHORT"]);
    expect((await list("product=OPTIONS&phase=OPEN")).total).toBe(2);
    expect((await list("product=FUTURES&direction=LONG&phase=CLOSE")).total).toBe(1);
  });
});
