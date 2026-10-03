// Contribution review (payment details, proof files, segregation of duties,
// self-confirmation), estimated trade charges and executed-trade corrections
// against a real database. Opt-in: see harness.ts.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, createUser, integrationEnabled, json, params, request, type TestDb, type TestUser } from "./harness";

import * as poolsRoute from "@/app/api/qfinera/pools/route";
import * as contributionsRoute from "@/app/api/qfinera/pools/[poolId]/contributions/route";
import * as contributionRoute from "@/app/api/qfinera/pools/[poolId]/contributions/[id]/route";
import * as proofsRoute from "@/app/api/qfinera/pools/[poolId]/contributions/[id]/proofs/route";
import * as proofRoute from "@/app/api/qfinera/pools/[poolId]/contributions/[id]/proofs/[proofId]/route";
import * as navRoute from "@/app/api/qfinera/pools/[poolId]/nav/route";
import * as tradesRoute from "@/app/api/qfinera/pools/[poolId]/trades/route";
import * as tradeRoute from "@/app/api/qfinera/pools/[poolId]/trades/[id]/route";
import * as holdingsRoute from "@/app/api/qfinera/pools/[poolId]/holdings/route";

const suite = integrationEnabled ? describe : describe.skip;

// Smallest valid PNG (1x1).
const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0005000201a3c6a5a40000000049454e44ae426082",
  "hex"
);

suite("pool workflow: contribution review and trade corrections (real database)", () => {
  let db: TestDb;
  let alice: TestUser; // ADMIN of pool A (sole admin at first)
  let bob: TestUser; // MEMBER
  let carol: TestUser; // MANAGER
  let dave: TestUser; // second ADMIN, added later
  let eve: TestUser; // another MEMBER
  let mallory: TestUser; // ADMIN of pool B
  let poolA = "";
  let poolB = "";
  let infy = 0;
  let tcs = 0;

  const P = (poolId: string) => params({ poolId });
  const PI = (poolId: string, id: number) => params({ poolId, id: String(id) });

  async function contribute(user: TestUser, body: Record<string, unknown>) {
    return json(await contributionsRoute.POST(request(user, `/api/qfinera/pools/${poolA}/contributions`, { body: { paymentDate: "2026-08-31", ...body } }), P(poolA)));
  }
  async function step(user: TestUser, id: number, action: string, extra: Record<string, unknown> = {}) {
    return json(await contributionRoute.POST(request(user, `/api/qfinera/pools/${poolA}/contributions/${id}`, { body: { action, ...extra } }), PI(poolA, id)));
  }
  async function upload(user: TestUser, id: number, bytes: Buffer, fileName = "upi.png") {
    return json(
      await proofsRoute.POST(
        request(user, `/api/qfinera/pools/${poolA}/contributions/${id}/proofs`, { body: { fileName, dataBase64: bytes.toString("base64") } }),
        PI(poolA, id)
      )
    );
  }
  function download(user: TestUser, id: number, proofId: number) {
    return proofRoute.GET(
      request(user, `/api/qfinera/pools/${poolA}/contributions/${id}/proofs/${proofId}`),
      { params: Promise.resolve({ poolId: poolA, id: String(id), proofId: String(proofId) }) }
    );
  }
  async function trade(user: TestUser, body: Record<string, unknown>, poolId = poolA) {
    return json(await tradesRoute.POST(request(user, `/api/qfinera/pools/${poolId}/trades`, { body: { tradeDate: "2026-09-02", execute: true, ...body } }), P(poolId)));
  }
  async function correct(user: TestUser, id: number, body: Record<string, unknown>, poolId = poolA) {
    return json(await tradeRoute.POST(request(user, `/api/qfinera/pools/${poolId}/trades/${id}`, { body: { action: "correct", ...body } }), PI(poolId, id)));
  }
  async function cashOf(tradeId: number) {
    const { rows } = await db.query(
      "SELECT COALESCE(SUM(cash_delta), 0)::text AS c FROM qfinera_fund_ledger_entries WHERE reference_table = 'qfinera_fund_trades' AND reference_id = $1",
      [tradeId]
    );
    return rows[0].c as string;
  }
  async function positions(user: TestUser) {
    return (await json(await holdingsRoute.GET(request(user, `/api/qfinera/pools/${poolA}/holdings`), P(poolA)))).body.data;
  }

  beforeAll(async () => {
    db = await createTestDatabase();
    [alice, bob, carol, dave, eve, mallory] = await Promise.all(["alice", "bob", "carol", "dave", "eve", "mallory"].map((h) => createUser(db, h)));
    poolA = String((await json(await poolsRoute.POST(request(alice, "/api/qfinera/pools", { body: { name: "Pool A", acknowledgePrivate: true } })))).body.data.pool.id);
    poolB = String((await json(await poolsRoute.POST(request(mallory, "/api/qfinera/pools", { body: { name: "Pool B", acknowledgePrivate: true } })))).body.data.pool.id);
    for (const [u, role] of [[bob, "MEMBER"], [carol, "MANAGER"], [eve, "MEMBER"]] as const) {
      await db.query("INSERT INTO qfinera_fund_memberships (fund_id, user_id, role) VALUES ($1, $2, $3)", [poolA, u.id, role]);
    }
    const { rows } = await db.query("INSERT INTO qfinera_fund_instruments (symbol, exchange, name) VALUES ('INFY', 'NSE', 'Infosys Limited'), ('TCS', 'NSE', 'TCS') RETURNING id");
    [infy, tcs] = rows.map((r) => r.id as number);
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  // ------------------------------------------------------------ contributions

  let bobContribution = 0;
  let proofId = 0;

  it("a member records payment details and attaches a proof screenshot", async () => {
    const c = await contribute(bob, { amount: "50000.00", utr: "UTR-B-1", paymentMethod: "UPI", notes: "Sent from HDFC" });
    expect(c.status).toBe(201);
    expect(c.body.data.contribution).toMatchObject({ status: "PENDING", payment_method: "UPI", notes: "Sent from HDFC", utr: "UTR-B-1" });
    bobContribution = c.body.data.contribution.id;

    const up = await upload(bob, bobContribution, PNG, "../../etc/upi screenshot.png");
    expect(up.status).toBe(201);
    expect(up.body.data.proof).toMatchObject({ fileName: "upi screenshot.png", contentType: "image/png", sizeBytes: PNG.length });
    proofId = up.body.data.proof.id;
    expect((await upload(bob, bobContribution, PNG)).status).toBe(409); // same file twice
  });

  it("only real images/PDFs up to 2 MB are accepted, whatever the file is called", async () => {
    const html = await upload(bob, bobContribution, Buffer.from("<html><script>alert(1)</script></html>"), "proof.png");
    expect(html.status).toBe(400);
    const big = await upload(bob, bobContribution, Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]));
    expect(big.status).toBe(400);
  });

  it("the proof is visible to the contributor and managers/admins only, served safely", async () => {
    const res = await download(alice, bobContribution, proofId);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-security-policy")).toMatch(/sandbox/);
    expect(Buffer.from(await res.arrayBuffer()).equals(PNG)).toBe(true);
    expect((await download(bob, bobContribution, proofId)).status).toBe(200);
    expect((await download(carol, bobContribution, proofId)).status).toBe(200);
    expect((await download(eve, bobContribution, proofId)).status).toBe(404);
    expect((await upload(eve, bobContribution, PNG)).status).toBe(404);
    const viaB = await proofRoute.GET(request(mallory, `/api/qfinera/pools/${poolB}/contributions/${bobContribution}/proofs/${proofId}`), {
      params: Promise.resolve({ poolId: poolB, id: String(bobContribution), proofId: String(proofId) }),
    });
    expect(viaB.status).toBe(404);
  });

  it("the admin's review shows payment details and proofs; the workflow follows the roles", async () => {
    const review = await json(await contributionRoute.GET(request(alice, `/api/qfinera/pools/${poolA}/contributions/${bobContribution}`), PI(poolA, bobContribution)));
    expect(review.body.data.contribution).toMatchObject({ payment_method: "UPI", utr: "UTR-B-1", notes: "Sent from HDFC" });
    expect(review.body.data.proofs).toEqual([expect.objectContaining({ id: proofId, contentType: "image/png", uploaderName: "bob" })]);
    const list = await json(await contributionsRoute.GET(request(alice, `/api/qfinera/pools/${poolA}/contributions`), P(poolA)));
    expect(list.body.data.contributions[0]).toMatchObject({ id: bobContribution, proofCount: 1, paymentMethod: "UPI" });

    expect((await step(bob, bobContribution, "approve")).status).toBe(403);
    expect((await step(carol, bobContribution, "approve")).status).toBe(403);
    expect((await step(alice, bobContribution, "confirm-funds")).status).toBe(409); // must be approved first
    expect((await step(alice, bobContribution, "approve")).status).toBe(200);
    const confirmed = await step(alice, bobContribution, "confirm-funds");
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.contribution.status).toBe("AWAITING_NAV");
    expect((await upload(bob, bobContribution, Buffer.concat([PNG, Buffer.from([0])]))).status).toBe(201); // still open
  });

  it("a rejected contribution needs a reason and allocates nothing", async () => {
    const c = await contribute(eve, { amount: "100.00", paymentMethod: "NEFT" });
    expect((await step(alice, c.body.data.contribution.id, "reject")).status).toBe(400);
    const r = await step(alice, c.body.data.contribution.id, "reject", { reason: "No matching transfer" });
    expect(r.body.data.contribution).toMatchObject({ status: "REJECTED", units_allocated: null });
  });

  it("a sole admin may approve and confirm their own contribution, audited as self-confirmed", async () => {
    const c = await contribute(alice, { amount: "1000000.00", paymentMethod: "RTGS", utr: "UTR-A-1" });
    const id = c.body.data.contribution.id;
    expect((await step(alice, id, "approve")).status).toBe(200);
    expect((await step(alice, id, "confirm-funds")).status).toBe(200);
    const { rows } = await db.query(
      "SELECT action, diff->>'reason' AS reason, after_state->>'self_confirmed' AS self FROM qfinera_fund_audit_log WHERE entity_type = 'contribution' AND entity_id = $1 ORDER BY id",
      [id]
    );
    expect(rows.slice(1)).toEqual([
      { action: "contribution.self_approved", reason: "Self-confirmed (sole administrator)", self: "true" },
      { action: "contribution.self_confirmed_funds", reason: "Self-confirmed (sole administrator)", self: "true" },
    ]);
    // Bob's ordinary approval is not marked self-confirmed.
    const bobRows = await db.query("SELECT action FROM qfinera_fund_audit_log WHERE entity_type = 'contribution' AND entity_id = $1 AND action LIKE '%approved'", [bobContribution]);
    expect(bobRows.rows.map((r) => r.action)).toEqual(["contribution.approved"]);

    // Units still only at the next official NAV (test clock control).
    await db.query("UPDATE qfinera_fund_contributions SET effective_date = '2026-09-01' WHERE status = 'AWAITING_NAV'");
    expect((await navRoute.POST(request(alice, `/api/qfinera/pools/${poolA}/nav`, { body: { date: "2026-09-01" } }), P(poolA))).status).toBe(201);
    const { rows: done } = await db.query("SELECT status, units_allocated::text AS u FROM qfinera_fund_contributions WHERE id = ANY($1::int[]) ORDER BY id", [[bobContribution, id]]);
    expect(done).toEqual([{ status: "FINALIZED", u: "5000.0000" }, { status: "FINALIZED", u: "100000.0000" }]);
  });

  it("with a second admin, an admin cannot approve their own contribution; the other admin can", async () => {
    await db.query("INSERT INTO qfinera_fund_memberships (fund_id, user_id, role) VALUES ($1, $2, 'ADMIN')", [poolA, dave.id]);
    const c = await contribute(alice, { amount: "10.00", paymentMethod: "UPI" });
    const id = c.body.data.contribution.id;
    const own = await step(alice, id, "approve");
    expect(own.status).toBe(409);
    expect(own.body.error.message).toMatch(/Another administrator/);
    expect((await step(dave, id, "approve")).status).toBe(200);
    expect((await step(alice, id, "confirm-funds")).status).toBe(409);
    expect((await step(dave, id, "confirm-funds")).status).toBe(200);
  });

  // ------------------------------------------------------------ estimated charges

  it("trades take one estimated-charges total", async () => {
    const t = await trade(carol, { instrumentId: tcs, product: "EQUITY_DELIVERY", action: "OPEN_LONG", quantity: "10", price: "100", estimatedCharges: "12.34" });
    expect(t.status).toBe(201);
    expect(t.body.data.trade).toMatchObject({ other_charges: "12.34", brokerage: "0.00", stt: "0.00", gst: "0.00", stamp_duty: "0.00" });
    expect(await cashOf(t.body.data.trade.id)).toBe("-1012.34");
    const both = await trade(carol, { instrumentId: tcs, product: "EQUITY_DELIVERY", action: "OPEN_LONG", quantity: "1", price: "100", estimatedCharges: "1.00", brokerage: "1.00" });
    expect(both.status).toBe(400);
  });

  // ------------------------------------------------------------ corrections

  let buy = 0;

  it("only an admin corrects an executed trade, with a reason", async () => {
    buy = (await trade(carol, { instrumentId: infy, product: "EQUITY_DELIVERY", action: "OPEN_LONG", quantity: "10", price: "1500", estimatedCharges: "20.00" })).body.data.trade.id;
    const body = { trade: { instrumentId: infy, product: "EQUITY_DELIVERY", action: "OPEN_LONG", tradeDate: "2026-09-02", quantity: "12", price: "1500", estimatedCharges: "20.00" }, reason: "Contract note shows 12 shares" };
    expect((await correct(carol, buy, body)).status).toBe(403);
    expect((await correct(bob, buy, body)).status).toBe(403);
    expect((await correct(alice, buy, { ...body, reason: "typo" })).status).toBe(400);
    expect((await correct(mallory, buy, body, poolB)).status).toBe(404); // another pool's trade
  });

  it("a correction keeps the original values, adjusts cash with a dated entry and re-derives positions", async () => {
    const r = await correct(alice, buy, {
      trade: { instrumentId: infy, product: "EQUITY_DELIVERY", action: "OPEN_LONG", tradeDate: "2026-09-02", quantity: "12", price: "1500", estimatedCharges: "20.00" },
      reason: "Contract note shows 12 shares",
    });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data).toMatchObject({ revision: 1, adjustments: [{ tradeId: buy, entryDate: "2026-09-02", cashDelta: "-3000.00", isBackdated: false }] });
    expect(r.body.data.trade).toMatchObject({ quantity: "12.0000", correction_count: 1, status: "EXECUTED" });
    expect(await cashOf(buy)).toBe("-18020.00");
    // The original posting is untouched; the adjustment explains the change.
    const { rows: ledger } = await db.query("SELECT entry_type, cash_delta::text AS c FROM qfinera_fund_ledger_entries WHERE reference_table = 'qfinera_fund_trades' AND reference_id = $1 ORDER BY id", [buy]);
    expect(ledger).toEqual([{ entry_type: "BUY", c: "-15020.00" }, { entry_type: "ADJUSTMENT", c: "-3000.00" }]);

    const { rows: rev } = await db.query("SELECT revision, before_values->>'quantity' AS b, after_values->>'quantity' AS a, reason, corrected_by FROM qfinera_fund_trade_revisions WHERE trade_id = $1", [buy]);
    expect(rev).toEqual([{ revision: 1, b: "10.0000", a: "12.0000", reason: "Contract note shows 12 shares", corrected_by: alice.id }]);
    const { rows: audit } = await db.query("SELECT before_state->>'quantity' AS b, after_state->>'quantity' AS a, diff->>'reason' AS reason, user_id FROM qfinera_fund_audit_log WHERE action = 'trade.corrected' AND entity_id = $1", [buy]);
    expect(audit).toEqual([{ b: "10.0000", a: "12.0000", reason: "Contract note shows 12 shares", user_id: alice.id }]);

    const infyRow = (await positions(alice)).rows.find((x: { symbol: string }) => x.symbol === "INFY");
    expect(infyRow).toMatchObject({ quantity: "12.0000", costBasis: "18020.00" });

    // Revisions show on the trade detail.
    const detail = await json(await tradeRoute.GET(request(alice, `/api/qfinera/pools/${poolA}/trades/${buy}`), PI(poolA, buy)));
    expect(detail.body.data.revisions).toHaveLength(1);
  });

  it("a second correction is revision 2; an unchanged correction is refused", async () => {
    const t = { instrumentId: infy, product: "EQUITY_DELIVERY", action: "OPEN_LONG", tradeDate: "2026-09-02", quantity: "12", price: "1490", estimatedCharges: "20.00" };
    const r = await correct(alice, buy, { trade: t, reason: "Price on the contract note is 1490" });
    expect(r.body.data.revision).toBe(2);
    expect(await cashOf(buy)).toBe("-17900.00");
    expect((await correct(alice, buy, { trade: t, reason: "Price on the contract note is 1490" })).status).toBe(400);
  });

  it("a correction that would leave the history invalid is refused and changes nothing", async () => {
    await trade(carol, { instrumentId: infy, product: "EQUITY_DELIVERY", action: "CLOSE_LONG", tradeDate: "2026-09-03", quantity: "11", price: "1520" });
    const r = await correct(alice, buy, {
      trade: { instrumentId: infy, product: "EQUITY_DELIVERY", action: "OPEN_LONG", tradeDate: "2026-09-02", quantity: "5", price: "1490", estimatedCharges: "20.00" },
      reason: "Testing an impossible correction",
    });
    expect(r.status).toBe(409);
    expect(r.body.error.message).toMatch(/oversell INFY/);
    expect(await cashOf(buy)).toBe("-17900.00");
    const { rows } = await db.query("SELECT quantity::text AS q, correction_count FROM qfinera_fund_trades WHERE id = $1", [buy]);
    expect(rows[0]).toEqual({ q: "12.0000", correction_count: 2 });
  });

  it("correcting an intraday open re-derives the later close's cash and P&L", async () => {
    const open = (await trade(carol, { instrumentId: tcs, product: "EQUITY_INTRADAY", action: "OPEN_SHORT", tradeDate: "2026-09-03", quantity: "100", price: "1520" })).body.data.trade.id;
    const close = (await trade(carol, { instrumentId: tcs, product: "EQUITY_INTRADAY", action: "CLOSE_SHORT", tradeDate: "2026-09-03", quantity: "100", price: "1490" })).body.data.trade.id;
    expect(await cashOf(close)).toBe("3000.00");
    const r = await correct(alice, open, {
      trade: { instrumentId: tcs, product: "EQUITY_INTRADAY", action: "OPEN_SHORT", tradeDate: "2026-09-03", quantity: "100", price: "1530" },
      reason: "Short was filled at 1530",
    });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data.adjustments).toEqual([{ tradeId: close, entryDate: "2026-09-03", cashDelta: "1000.00", isBackdated: false }]);
    expect(await cashOf(close)).toBe("4000.00");
    const closed = (await positions(alice)).closed.find((x: { symbol: string; product: string }) => x.symbol === "TCS" && x.product === "EQUITY_INTRADAY");
    expect(closed.realizedPnl).toBe("4000.00");
  });

  it("changing the trade date moves the cash to the new date", async () => {
    const r = await correct(alice, buy, {
      trade: { instrumentId: infy, product: "EQUITY_DELIVERY", action: "OPEN_LONG", tradeDate: "2026-09-03", quantity: "12", price: "1490", estimatedCharges: "20.00" },
      reason: "Executed on the 3rd, not the 2nd",
    });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data.adjustments).toEqual([
      { tradeId: buy, entryDate: "2026-09-02", cashDelta: "17900.00", isBackdated: false },
      { tradeId: buy, entryDate: "2026-09-03", cashDelta: "-17900.00", isBackdated: false },
    ]);
  });

  it("a correction reaching an official NAV needs confirmation and reports the affected NAV dates", async () => {
    const target = (await trade(carol, { instrumentId: tcs, product: "EQUITY_DELIVERY", action: "OPEN_LONG", tradeDate: "2026-09-04", quantity: "1", price: "100" })).body.data.trade.id;
    await db.query(
      "INSERT INTO qfinera_fund_price_snapshots (instrument_id, price, quality, source, as_of, fund_id) VALUES ($1, 1500, 'EOD', 't', '2026-09-04T10:00:00Z', $3), ($2, 100, 'EOD', 't', '2026-09-04T10:00:00Z', $3)",
      [infy, tcs, poolA]
    );
    expect((await navRoute.POST(request(alice, `/api/qfinera/pools/${poolA}/nav`, { body: { date: "2026-09-04" } }), P(poolA))).status).toBe(201);
    const body = {
      trade: { instrumentId: tcs, product: "EQUITY_DELIVERY", action: "OPEN_LONG", tradeDate: "2026-09-04", quantity: "2", price: "100" },
      reason: "Two shares were bought, not one",
    };
    const unconfirmed = await correct(alice, target, body);
    expect(unconfirmed.status).toBe(409);
    expect(unconfirmed.body.error.message).toMatch(/Confirm it/);
    const r = await correct(alice, target, { ...body, confirm: true });
    expect(r.status).toBe(200);
    expect(r.body.data.affectedOfficialNavDates).toEqual(["2026-09-04"]);
    expect(r.body.data.adjustments[0]).toMatchObject({ cashDelta: "-100.00", isBackdated: true });
    // The official snapshot itself is never rewritten.
    const { rows } = await db.query("SELECT COUNT(*)::int AS n FROM qfinera_fund_nav_snapshots WHERE fund_id = $1 AND as_of_date = '2026-09-04'", [poolA]);
    expect(rows[0].n).toBe(1);
  });

  it("reversing a corrected trade undoes its whole cash effect, adjustments included", async () => {
    const t = (await trade(carol, { instrumentId: tcs, product: "EQUITY_DELIVERY", action: "OPEN_LONG", tradeDate: "2026-09-07", quantity: "1", price: "100", estimatedCharges: "1.00" })).body.data.trade.id;
    await correct(alice, t, {
      trade: { instrumentId: tcs, product: "EQUITY_DELIVERY", action: "OPEN_LONG", tradeDate: "2026-09-07", quantity: "3", price: "100", estimatedCharges: "1.00" },
      reason: "Three shares on the contract note",
      confirm: true,
    });
    expect(await cashOf(t)).toBe("-301.00");
    const rev = await json(await tradeRoute.POST(request(alice, `/api/qfinera/pools/${poolA}/trades/${t}`, { body: { action: "reverse", reason: "Duplicate of another entry", confirm: true } }), PI(poolA, t)));
    expect(rev.status, JSON.stringify(rev.body)).toBe(200);
    expect(await cashOf(t)).toBe("0.00");
    expect((await correct(alice, t, { trade: { instrumentId: tcs, product: "EQUITY_DELIVERY", action: "OPEN_LONG", tradeDate: "2026-09-07", quantity: "4", price: "100" }, reason: "Cannot correct a reversed trade" })).status).toBe(409);
  });

  it("pool B's cash and positions are untouched by pool A's corrections", async () => {
    const b = (await json(await holdingsRoute.GET(request(mallory, `/api/qfinera/pools/${poolB}/holdings`), P(poolB)))).body.data;
    expect(b.rows).toEqual([]);
    const { rows } = await db.query("SELECT COUNT(*)::int AS n FROM qfinera_fund_ledger_entries WHERE fund_id = $1", [poolB]);
    expect(rows[0].n).toBe(0);
  });
});
