// End-to-end pool lifecycle against a real PostgreSQL database, driven
// through the actual API route handlers with signed session cookies:
// create pool -> invite -> join -> contribute -> NAV/units -> trade ->
// holdings -> NAV -> withdraw -> reports/audit. Opt-in: see harness.ts.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, createUser, integrationEnabled, json, params, request, type TestDb, type TestUser } from "./harness";

import * as poolsRoute from "@/app/api/qfinera/pools/route";
import * as joinRoute from "@/app/api/qfinera/pools/join/route";
import * as invitesRoute from "@/app/api/qfinera/pools/[poolId]/invites/route";
import * as contributionsRoute from "@/app/api/qfinera/pools/[poolId]/contributions/route";
import * as contributionRoute from "@/app/api/qfinera/pools/[poolId]/contributions/[id]/route";
import * as navRoute from "@/app/api/qfinera/pools/[poolId]/nav/route";
import * as instrumentsRoute from "@/app/api/qfinera/pools/[poolId]/instruments/route";
import * as instrumentRoute from "@/app/api/qfinera/pools/[poolId]/instruments/[id]/route";
import * as tradesRoute from "@/app/api/qfinera/pools/[poolId]/trades/route";
import * as tradeRoute from "@/app/api/qfinera/pools/[poolId]/trades/[id]/route";
import * as holdingsRoute from "@/app/api/qfinera/pools/[poolId]/holdings/route";
import * as withdrawalsRoute from "@/app/api/qfinera/pools/[poolId]/withdrawals/route";
import * as withdrawalRoute from "@/app/api/qfinera/pools/[poolId]/withdrawals/[id]/route";
import * as expensesRoute from "@/app/api/qfinera/pools/[poolId]/expenses/route";
import * as expenseRoute from "@/app/api/qfinera/pools/[poolId]/expenses/[id]/route";
import * as dashboardRoute from "@/app/api/qfinera/pools/[poolId]/dashboard/route";
import * as reportsRoute from "@/app/api/qfinera/pools/[poolId]/reports/route";
import * as auditRoute from "@/app/api/qfinera/pools/[poolId]/audit/route";
import * as membersRoute from "@/app/api/qfinera/pools/[poolId]/members/route";
import * as memberRoute from "@/app/api/qfinera/pools/[poolId]/members/[id]/route";

const suite = integrationEnabled ? describe : describe.skip;

suite("pool lifecycle (real database)", () => {
  let db: TestDb;
  let alice: TestUser; // creator -> ADMIN
  let bob: TestUser; // MEMBER
  let carol: TestUser; // MANAGER
  let eve: TestUser; // never invited
  let poolId = "";
  let infyId = 0;

  const P = () => params({ poolId });
  const PI = (id: number | string) => params({ poolId, id: String(id) });
  const base = () => `/api/qfinera/pools/${poolId}`;

  /** Move a confirmed/approved request's NAV date into the past (test clock control). */
  async function setNavDate(table: string, id: number, date: string) {
    await db.query(`UPDATE ${table} SET effective_date = $2::date WHERE id = $1`, [id, date]);
  }

  async function strike(date: string, user = alice, extra: Record<string, unknown> = {}) {
    return json(await navRoute.POST(request(user, `${base()}/nav`, { body: { date, ...extra } }), P()));
  }

  async function price(date: string, value: string) {
    return json(
      await instrumentRoute.POST(
        request(alice, `${base()}/instruments/${infyId}`, { body: { action: "record-price", price: value, date } }),
        PI(infyId)
      )
    );
  }

  async function contribute(user: TestUser, amount: string, utr: string) {
    const created = await json(
      await contributionsRoute.POST(request(user, `${base()}/contributions`, { body: { amount, paymentDate: "2026-08-31", utr } }), P())
    );
    expect(created.status).toBe(201);
    const id = created.body.data.contribution.id as number;
    for (const action of ["approve", "confirm-funds"]) {
      const r = await json(await contributionRoute.POST(request(alice, `${base()}/contributions/${id}`, { body: { action } }), PI(id)));
      expect(r.status, `${action}: ${JSON.stringify(r.body)}`).toBe(200);
    }
    return id;
  }

  beforeAll(async () => {
    db = await createTestDatabase();
    alice = await createUser(db, "alice");
    bob = await createUser(db, "bob");
    carol = await createUser(db, "carol");
    eve = await createUser(db, "eve");
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  it("refuses to create a pool without the private-pool acknowledgement", async () => {
    const r = await json(await poolsRoute.POST(request(alice, "/api/qfinera/pools", { body: { name: "Friends Pool" } })));
    expect(r.status).toBe(400);
    expect(r.body.error.fields).toHaveProperty("acknowledgePrivate");
  });

  it("requires sign-in to create a pool", async () => {
    const r = await json(await poolsRoute.POST(request(null, "/api/qfinera/pools", { body: { name: "X", acknowledgePrivate: true } })));
    expect(r.status).toBe(401);
  });

  it("creates a private pool with the creator as ADMIN, zero capital and the gate recorded", async () => {
    const r = await json(
      await poolsRoute.POST(request(alice, "/api/qfinera/pools", { body: { name: "Friends Pool", acknowledgePrivate: true } }))
    );
    expect(r.status).toBe(201);
    poolId = String(r.body.data.pool.id);
    const { rows } = await db.query(
      `SELECT f.participation_mode, m.role, m.units::text AS units FROM qfinera_funds f
         JOIN qfinera_fund_memberships m ON m.fund_id = f.id WHERE f.id = $1`,
      [poolId]
    );
    expect(rows).toEqual([{ participation_mode: "PRIVATE_INVITE_ONLY", role: "ADMIN", units: "0.0000" }]);
    const list = await json(await poolsRoute.GET(request(alice, "/api/qfinera/pools")));
    expect(list.body.data.pools.map((p: { id: number }) => String(p.id))).toEqual([poolId]);
  });

  it("the database itself refuses a public participation mode", async () => {
    await expect(db.query("UPDATE qfinera_funds SET participation_mode = 'PUBLIC' WHERE id = $1", [poolId])).rejects.toThrow(
      /participation_check/
    );
  });

  it("invites by email: token stored only as a hash, bound to the invitee, single use", async () => {
    const inv = await json(await invitesRoute.POST(request(alice, `${base()}/invites`, { body: { email: bob.email, role: "MEMBER" } }), P()));
    expect(inv.status).toBe(201);
    const token = new URL(inv.body.data.link).searchParams.get("token") as string;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const stored = await db.query("SELECT token_hash FROM qfinera_fund_invites WHERE id = $1", [inv.body.data.invite.id]);
    expect(stored.rows[0].token_hash).not.toContain(token);
    expect(stored.rows[0].token_hash).toMatch(/^[0-9a-f]{64}$/);

    // A forwarded link is useless to someone else.
    const wrong = await json(await joinRoute.POST(request(eve, "/api/qfinera/pools/join", { body: { token } })));
    expect(wrong.status).toBe(403);
    const preview = await json(await joinRoute.GET(request(eve, `/api/qfinera/pools/join?token=${token}`)));
    expect(preview.body.data.invite.emailMatches).toBe(false);
    expect(JSON.stringify(preview.body)).not.toContain(bob.email);

    const ok = await json(await joinRoute.POST(request(bob, "/api/qfinera/pools/join", { body: { token } })));
    expect(ok.status).toBe(200);
    expect(String(ok.body.data.poolId)).toBe(poolId);

    const again = await json(await joinRoute.POST(request(bob, "/api/qfinera/pools/join", { body: { token } })));
    expect(again.status).toBe(404);
    const junk = await json(await joinRoute.POST(request(bob, "/api/qfinera/pools/join", { body: { token: "x".repeat(43) } })));
    expect(junk.status).toBe(404);
  });

  it("a MEMBER cannot invite; a MANAGER may invite MEMBERs only", async () => {
    const byBob = await json(await invitesRoute.POST(request(bob, `${base()}/invites`, { body: { email: "z@example.test" } }), P()));
    expect(byBob.status).toBe(403);

    const inv = await json(await invitesRoute.POST(request(alice, `${base()}/invites`, { body: { email: carol.email, role: "MANAGER" } }), P()));
    const token = new URL(inv.body.data.link).searchParams.get("token") as string;
    expect((await joinRoute.POST(request(carol, "/api/qfinera/pools/join", { body: { token } }))).status).toBe(200);

    const adminByManager = await json(
      await invitesRoute.POST(request(carol, `${base()}/invites`, { body: { email: "y@example.test", role: "ADMIN" } }), P())
    );
    expect(adminByManager.status).toBe(403);
    const dup = await json(await invitesRoute.POST(request(alice, `${base()}/invites`, { body: { email: bob.email } }), P()));
    expect(dup.status).toBe(409);
  });

  it("an outsider gets 404 for every pool route (no existence leak)", async () => {
    for (const res of [
      await contributionsRoute.GET(request(eve, `${base()}/contributions`), P()),
      await dashboardRoute.GET(request(eve, `${base()}/dashboard`), P()),
      await contributionsRoute.POST(request(eve, `${base()}/contributions`, { body: { amount: "1.00", paymentDate: "2026-08-31" } }), P()),
    ]) {
      expect(res.status).toBe(404);
    }
    const malformed = await contributionsRoute.GET(request(alice, "/api/qfinera/pools/abc/contributions"), params({ poolId: "abc" }));
    expect(malformed.status).toBe(404);
  });

  it("rejects malformed money, dates and non-JSON mutations", async () => {
    const bad = [
      { amount: 1000, paymentDate: "2026-08-31" }, // JSON number, not a decimal string
      { amount: "10.001", paymentDate: "2026-08-31" },
      { amount: "-5", paymentDate: "2026-08-31" },
      { amount: "0", paymentDate: "2026-08-31" },
      { amount: "100.00", paymentDate: "2026-02-30" },
      { amount: "100.00", paymentDate: "2999-01-01" },
    ];
    for (const body of bad) {
      const r = await contributionsRoute.POST(request(bob, `${base()}/contributions`, { body }), P());
      expect(r.status, JSON.stringify(body)).toBe(400);
    }
    const form = await contributionsRoute.POST(
      new (await import("next/server")).NextRequest(`http://localhost:3000${base()}/contributions`, {
        method: "POST",
        headers: { cookie: bob.cookie, "content-type": "application/x-www-form-urlencoded", host: "localhost:3000" },
        body: "amount=1",
      }),
      P()
    );
    expect(form.status).toBe(415);
    const crossSite = await contributionsRoute.POST(
      new (await import("next/server")).NextRequest(`http://localhost:3000${base()}/contributions`, {
        method: "POST",
        headers: { cookie: bob.cookie, "content-type": "application/json", host: "localhost:3000", origin: "https://evil.example" },
        body: JSON.stringify({ amount: "1.00", paymentDate: "2026-08-31" }),
      }),
      P()
    );
    expect(crossSite.status).toBe(403);
  });

  let bobContribution = 0;

  it("contributions: a MEMBER cannot approve; units only at the applicable EOD NAV", async () => {
    const created = await json(
      await contributionsRoute.POST(request(bob, `${base()}/contributions`, { body: { amount: "10000.00", paymentDate: "2026-08-31", utr: "UTR001" } }), P())
    );
    bobContribution = created.body.data.contribution.id;
    const selfApprove = await contributionRoute.POST(
      request(bob, `${base()}/contributions/${bobContribution}`, { body: { action: "approve" } }),
      PI(bobContribution)
    );
    expect(selfApprove.status).toBe(403);
    const managerApprove = await contributionRoute.POST(
      request(carol, `${base()}/contributions/${bobContribution}`, { body: { action: "approve" } }),
      PI(bobContribution)
    );
    // A MANAGER's approval is only a request for ADMIN approval: nothing changes yet.
    expect(managerApprove.status).toBe(202);
    expect((await managerApprove.json()).data.pendingApproval).toBe(true);
    expect((await db.query("SELECT status FROM qfinera_fund_contributions WHERE id = $1", [bobContribution])).rows[0].status).toBe("PENDING");

    for (const action of ["approve", "confirm-funds"]) {
      expect((await contributionRoute.POST(request(alice, `${base()}/contributions/${bobContribution}`, { body: { action } }), PI(bobContribution))).status).toBe(200);
    }
    const twice = await contributionRoute.POST(
      request(alice, `${base()}/contributions/${bobContribution}`, { body: { action: "confirm-funds" } }),
      PI(bobContribution)
    );
    expect(twice.status).toBe(409);

    const dupUtr = await contributionsRoute.POST(
      request(bob, `${base()}/contributions`, { body: { amount: "5.00", paymentDate: "2026-08-31", utr: "UTR001" } }),
      P()
    );
    expect(dupUtr.status).toBe(409);

    const { rows } = await db.query("SELECT status, units_allocated FROM qfinera_fund_contributions WHERE id = $1", [bobContribution]);
    expect(rows[0]).toEqual({ status: "AWAITING_NAV", units_allocated: null });
  });

  it("only ADMIN strikes NAV (a MANAGER's strike waits for approval); the first NAV is the initial 10.0000 and finalizes waiting contributions", async () => {
    await setNavDate("qfinera_fund_contributions", bobContribution, "2026-09-01");
    expect((await strike("2026-09-01", carol)).status).toBe(202);
    expect((await db.query("SELECT COUNT(*)::int AS n FROM qfinera_fund_nav_snapshots WHERE fund_id = $1", [poolId])).rows[0].n).toBe(0);
    expect((await strike("2026-09-05")).status).toBe(409); // Saturday: not a trading day
    expect((await strike("2999-01-01")).status).toBe(400); // future

    const r = await strike("2026-09-01");
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.data.snapshot.nav).toBe("10.0000");
    expect(r.body.data.finalized.contributions).toEqual([bobContribution]);

    const { rows } = await db.query(
      "SELECT status, units_allocated::text AS u, nav_used::text AS n, residual::text AS r FROM qfinera_fund_contributions WHERE id = $1",
      [bobContribution]
    );
    expect(rows[0]).toEqual({ status: "FINALIZED", u: "1000.0000", n: "10.0000", r: "0.00000000" });

    const finalizeAgain = await contributionRoute.POST(
      request(alice, `${base()}/contributions/${bobContribution}`, { body: { action: "finalize" } }),
      PI(bobContribution)
    );
    expect(finalizeAgain.status).toBe(409);
    expect((await strike("2026-09-01")).status).toBe(400); // already official: needs an explicit correction
  });

  it("instruments: validates NSE/BSE symbols; prices are ADMIN-only and never invented", async () => {
    const bad = await instrumentsRoute.POST(request(carol, `${base()}/instruments`, { body: { symbol: "IN FY", exchange: "NSE" } }), P());
    expect(bad.status).toBe(400);
    const lse = await instrumentsRoute.POST(request(carol, `${base()}/instruments`, { body: { symbol: "INFY", exchange: "LSE" } }), P());
    expect(lse.status).toBe(400);
    const r = await json(await instrumentsRoute.POST(request(carol, `${base()}/instruments`, { body: { symbol: "infy", exchange: "NSE", name: "Infosys" } }), P()));
    expect(r.status).toBe(201);
    expect(r.body.data.instrument.symbol).toBe("INFY");
    infyId = r.body.data.instrument.id;

    const q = await json(await instrumentRoute.GET(request(bob, `${base()}/instruments/${infyId}`), PI(infyId)));
    expect(q.body.data.quote).toMatchObject({ available: false, quality: "UNAVAILABLE" });
    const byManager = await instrumentRoute.POST(
      request(carol, `${base()}/instruments/${infyId}`, { body: { action: "record-price", price: "1.0000", date: "2026-09-02" } }),
      PI(infyId)
    );
    expect(byManager.status).toBe(403);
  });

  let buyId = 0;

  it("trades: negative cash is a hard failure; a valid BUY moves cash on the trade date", async () => {
    const tooBig = await json(
      await tradesRoute.POST(
        request(carol, `${base()}/trades`, {
          body: { instrumentId: infyId, side: "BUY", tradeDate: "2026-09-02", quantity: "10", price: "1500", brokerage: "20.00", execute: true },
        }),
        P()
      )
    );
    expect(tooBig.status).toBe(409);
    expect(tooBig.body.error.code).toBe("INVARIANT");
    const { rows: none } = await db.query("SELECT COUNT(*)::int AS n FROM qfinera_fund_trades");
    expect(none[0].n).toBe(0); // the whole transaction rolled back, draft included

    const r = await json(
      await tradesRoute.POST(
        request(carol, `${base()}/trades`, {
          body: { instrumentId: infyId, side: "BUY", tradeDate: "2026-09-02", quantity: "5", price: "1500", brokerage: "20.00", execute: true, externalRef: "CN-1" },
        }),
        P()
      )
    );
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.data.trade).toMatchObject({ status: "EXECUTED", net_value: "7520.00" });
    buyId = r.body.data.trade.id;

    const dupRef = await tradesRoute.POST(
      request(carol, `${base()}/trades`, {
        body: { instrumentId: infyId, side: "BUY", tradeDate: "2026-09-02", quantity: "1", price: "1", externalRef: "CN-1" },
      }),
      P()
    );
    expect(dupRef.status).toBe(409);

    const oversell = await json(
      await tradesRoute.POST(
        request(carol, `${base()}/trades`, {
          body: { instrumentId: infyId, side: "SELL", tradeDate: "2026-09-02", quantity: "6", price: "1500", execute: true },
        }),
        P()
      )
    );
    expect(oversell.status).toBe(409);
    expect(oversell.body.error.message).toMatch(/oversell INFY/);

    const memberTrade = await tradesRoute.POST(
      request(bob, `${base()}/trades`, { body: { instrumentId: infyId, side: "BUY", tradeDate: "2026-09-02", quantity: "1", price: "1" } }),
      P()
    );
    expect(memberTrade.status).toBe(403);
  });

  it("NAV refuses to strike while a holding has no price for the day", async () => {
    const r = await strike("2026-09-02");
    expect(r.status).toBe(409);
    expect(r.body.error.message).toMatch(/No end-of-day price .* INFY/);
  });

  it("NAV = (cash + holdings at that day's price) / units, 4dp", async () => {
    expect((await price("2026-09-02", "1510.5000")).status).toBe(201);
    const r = await strike("2026-09-02");
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    // cash 10000 - 7520 = 2480.00; holdings 5 x 1510.50 = 7552.50; FV 10032.50; units 1000
    expect(r.body.data.snapshot).toMatchObject({ cash: "2480.00", holdingsValue: "7552.50", fundValue: "10032.50", nav: "10.0325" });
  });

  it("backdating: MANAGER refused; ADMIN needs reason + confirmation; it is flagged and audited", async () => {
    const body = { instrumentId: infyId, side: "SELL", tradeDate: "2026-09-02", quantity: "1", price: "1500", execute: true };
    const mgr = await tradesRoute.POST(request(carol, `${base()}/trades`, { body }), P());
    expect(mgr.status).toBe(403);
    const noReason = await tradesRoute.POST(request(alice, `${base()}/trades`, { body }), P());
    expect(noReason.status).toBe(400);
    const ok = await json(
      await tradesRoute.POST(
        request(alice, `${base()}/trades`, {
          body: { ...body, backdateReason: "Contract note received late from broker", confirmBackdate: true },
        }),
        P()
      )
    );
    expect(ok.status, JSON.stringify(ok.body)).toBe(201);
    expect(ok.body.data.trade.is_backdated).toBe(true);
    const { rows } = await db.query(
      "SELECT is_backdated, backdated_reason FROM qfinera_fund_ledger_entries WHERE reference_table = 'qfinera_fund_trades' AND reference_id = $1",
      [ok.body.data.trade.id]
    );
    expect(rows[0]).toEqual({ is_backdated: true, backdated_reason: "Contract note received late from broker" });
    // The struck NAV for that date is preserved, not rewritten.
    const nav = await db.query("SELECT nav::text AS nav FROM qfinera_fund_nav_snapshots WHERE fund_id = $1 AND as_of_date = '2026-09-02'", [poolId]);
    expect(nav.rows).toEqual([{ nav: "10.0325" }]);
  });

  it("contribution rounding: units HALF_UP at 4dp; the residual belongs to the pool", async () => {
    await price("2026-09-03", "1490.0000");
    const id = await contribute(carol, "3333.33", "UTR-C1");
    await setNavDate("qfinera_fund_contributions", id, "2026-09-03");
    const r = await strike("2026-09-03");
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    // cash 2480 + 1500 (backdated sell) = 3980.00; holdings 4 x 1490 = 5960.00; FV 9940.00; NAV 9.9400
    expect(r.body.data.snapshot.nav).toBe("9.9400");
    const { rows } = await db.query(
      "SELECT units_allocated::text AS u, residual::text AS r FROM qfinera_fund_contributions WHERE id = $1",
      [id]
    );
    // 3333.33 / 9.94 = 335.34507... -> 335.3451; residual = 3333.33 - 335.3451 x 9.94 = -0.000294
    expect(rows[0]).toEqual({ u: "335.3451", r: "-0.00029400" });
    const units = await db.query("SELECT SUM(units)::text AS s FROM qfinera_fund_memberships WHERE fund_id = $1", [poolId]);
    const ledger = await db.query("SELECT SUM(units_delta)::text AS s FROM qfinera_fund_ledger_entries WHERE fund_id = $1", [poolId]);
    expect(units.rows[0].s).toBe(ledger.rows[0].s);
  });

  let bobWithdrawal = 0;

  it("withdrawals: one open request per member; ADMIN approves; redeemed at the next NAV; pool keeps the charge", async () => {
    const tooMany = await withdrawalsRoute.POST(
      request(bob, `${base()}/withdrawals`, { body: { requestType: "UNITS", units: "1000.0001" } }),
      P()
    );
    expect(tooMany.status).toBe(400);
    const w = await json(await withdrawalsRoute.POST(request(bob, `${base()}/withdrawals`, { body: { requestType: "UNITS", units: "100" } }), P()));
    expect(w.status).toBe(201);
    bobWithdrawal = w.body.data.withdrawal.id;
    const second = await withdrawalsRoute.POST(request(bob, `${base()}/withdrawals`, { body: { requestType: "AMOUNT", amount: "10.00" } }), P());
    expect(second.status).toBe(409);
    const selfApprove = await withdrawalRoute.POST(
      request(bob, `${base()}/withdrawals/${bobWithdrawal}`, { body: { action: "approve" } }),
      PI(bobWithdrawal)
    );
    expect(selfApprove.status).toBe(403);
    const approved = await json(
      await withdrawalRoute.POST(request(alice, `${base()}/withdrawals/${bobWithdrawal}`, { body: { action: "approve", charges: "5.00" } }), PI(bobWithdrawal))
    );
    expect(approved.status).toBe(200);
    expect(approved.body.data.withdrawal.status).toBe("AWAITING_NAV");

    await setNavDate("qfinera_fund_withdrawals", bobWithdrawal, "2026-09-04");
    await price("2026-09-04", "1490.0000");
    const r = await strike("2026-09-04");
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.data.finalized.withdrawals).toEqual([bobWithdrawal]);
    const nav = r.body.data.snapshot.nav as string; // unchanged prices: 9940 + 3333.33 = 13273.33 / 1335.3451
    expect(nav).toBe("9.9400");
    const { rows } = await db.query(
      `SELECT units_redeemed::text AS u, gross_amount::text AS g, net_amount::text AS n, charges::text AS c
         FROM qfinera_fund_withdrawals WHERE id = $1`,
      [bobWithdrawal]
    );
    expect(rows[0]).toEqual({ u: "100.0000", g: "994.00", n: "989.00", c: "5.00" });
    const ledger = await db.query(
      "SELECT cash_delta::text AS c, units_delta::text AS u FROM qfinera_fund_ledger_entries WHERE reference_table = 'qfinera_fund_withdrawals' AND reference_id = $1",
      [bobWithdrawal]
    );
    expect(ledger.rows[0]).toEqual({ c: "-989.00", u: "-100.0000" }); // the 5.00 charge stays in the pool
  });

  it("a withdrawal the pool has no cash for is blocked, not forced; the NAV is still struck", async () => {
    const w = await json(await withdrawalsRoute.POST(request(carol, `${base()}/withdrawals`, { body: { requestType: "UNITS", units: "335.3451" } }), P()));
    const id = w.body.data.withdrawal.id as number;
    await withdrawalRoute.POST(request(alice, `${base()}/withdrawals/${id}`, { body: { action: "approve" } }), PI(id));
    // Spend the cash first: buy shares with almost all of it.
    await tradesRoute.POST(
      request(carol, `${base()}/trades`, {
        body: { instrumentId: infyId, side: "BUY", tradeDate: "2026-09-07", quantity: "4", price: "1490", execute: true },
      }),
      P()
    );
    await setNavDate("qfinera_fund_withdrawals", id, "2026-09-07");
    await price("2026-09-07", "1490.0000");
    const r = await strike("2026-09-07");
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.data.finalized.withdrawals).toEqual([]);
    expect(r.body.data.blocked).toEqual([expect.objectContaining({ kind: "withdrawal", id, reason: expect.stringMatching(/cash would be -/) })]);
    const { rows } = await db.query("SELECT status FROM qfinera_fund_withdrawals WHERE id = $1", [id]);
    expect(rows[0].status).toBe("AWAITING_NAV");
  });

  it("expenses reduce cash without changing units; an unaffordable expense hard-fails", async () => {
    const before = await db.query("SELECT SUM(units_delta)::text AS u, SUM(cash_delta)::text AS c FROM qfinera_fund_ledger_entries WHERE fund_id = $1", [poolId]);
    const e = await json(
      await expensesRoute.POST(
        request(carol, `${base()}/expenses`, { body: { category: "BANK_CHARGES", amount: "100.00", expenseDate: "2026-09-08", description: "Bank charges" } }),
        P()
      )
    );
    expect(e.status).toBe(201);
    const byManager = await expenseRoute.POST(request(carol, `${base()}/expenses/${e.body.data.expense.id}`, { body: { action: "approve" } }), PI(e.body.data.expense.id));
    expect(byManager.status).toBe(202); // pending ADMIN approval; the expense stays PENDING
    expect((await db.query("SELECT status FROM qfinera_fund_expenses WHERE id = $1", [e.body.data.expense.id])).rows[0].status).toBe("PENDING");
    expect((await expenseRoute.POST(request(alice, `${base()}/expenses/${e.body.data.expense.id}`, { body: { action: "approve" } }), PI(e.body.data.expense.id))).status).toBe(200);
    const after = await db.query("SELECT SUM(units_delta)::text AS u, SUM(cash_delta)::text AS c FROM qfinera_fund_ledger_entries WHERE fund_id = $1", [poolId]);
    expect(after.rows[0].u).toBe(before.rows[0].u);
    expect(Number(before.rows[0].c) - Number(after.rows[0].c)).toBeCloseTo(100, 2);

    const huge = await json(
      await expensesRoute.POST(
        request(carol, `${base()}/expenses`, { body: { category: "OTHER", amount: "999999.00", expenseDate: "2026-09-08", description: "Too much" } }),
        P()
      )
    );
    const r = await json(await expenseRoute.POST(request(alice, `${base()}/expenses/${huge.body.data.expense.id}`, { body: { action: "approve" } }), PI(huge.body.data.expense.id)));
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe("INVARIANT");
  });

  it("reversal: ADMIN only (a MANAGER's reversal waits for approval), with a reason; refuses a reversal that would oversell", async () => {
    const byManager = await tradeRoute.POST(
      request(carol, `${base()}/trades/${buyId}`, { body: { action: "reverse", reason: "Entered against the wrong pool", confirm: true } }),
      PI(buyId)
    );
    expect(byManager.status).toBe(202);
    expect((await db.query("SELECT status FROM qfinera_fund_trades WHERE id = $1", [buyId])).rows[0].status).not.toBe("REVERSED");
    // Clear the proposal so it cannot interfere with the checks below.
    await db.query("UPDATE qfinera_change_requests SET status = 'CANCELLED' WHERE fund_id = $1 AND action = 'trade.reverse'", [poolId]);
    // Reversing the first BUY would leave the later SELL overselling.
    const r = await json(
      await tradeRoute.POST(
        request(alice, `${base()}/trades/${buyId}`, { body: { action: "reverse", reason: "Entered against the wrong pool", confirm: true } }),
        PI(buyId)
      )
    );
    expect(r.status).toBe(409);
  });

  it("holdings come from accounting trades, priced through the provider with quality labels", async () => {
    const r = await json(await holdingsRoute.GET(request(bob, `${base()}/holdings`), P()));
    expect(r.status).toBe(200);
    expect(r.body.data.rows).toEqual([
      expect.objectContaining({ symbol: "INFY", quantity: "8.0000", price: "1490.0000", priceQuality: "EOD", priceStale: true }),
    ]);
    expect(r.body.data.rows[0]).toHaveProperty("priceStale");
  });

  it("member privacy: a MEMBER sees only their own contributions and statement", async () => {
    const list = await json(await contributionsRoute.GET(request(bob, `${base()}/contributions?member=${alice.id}`), P()));
    expect(list.body.data.contributions.every((c: { memberId: number }) => c.memberId === bob.id)).toBe(true);
    const others = await reportsRoute.GET(request(bob, `${base()}/reports?type=statement&member=${carol.id}`), P());
    expect(others.status).toBe(404);
    const own = await json(await reportsRoute.GET(request(bob, `${base()}/reports?type=statement`), P()));
    expect(own.body.data.position.units).toBe("900.0000");
    const daily = await json(await reportsRoute.GET(request(bob, `${base()}/reports?type=daily&date=2026-09-03`), P()));
    expect(daily.body.data.contributions.rows).toBeNull(); // aggregates only
    expect(daily.body.data.preview).toBeNull(); // the unofficial preview is ADMIN-only
    const members = await json(await membersRoute.GET(request(bob, `${base()}/members`), P()));
    expect(members.body.data.members).toHaveLength(1);
    expect(members.body.data.members[0].email).toBeNull();
  });

  it("dashboard: real figures; audit activity only for ADMIN", async () => {
    const asBob = await json(await dashboardRoute.GET(request(bob, `${base()}/dashboard`), P()));
    expect(asBob.status).toBe(200);
    expect(asBob.body.data.officialNav.asOfDate).toBe("2026-09-07");
    expect(asBob.body.data.recentActivity).toBeNull();
    expect(asBob.body.data.me.units).toBe("900.0000");
    const asAlice = await json(await dashboardRoute.GET(request(alice, `${base()}/dashboard`), P()));
    expect(asAlice.body.data.recentActivity.length).toBeGreaterThan(0);
  });

  it("tax estimate is labelled informational", async () => {
    const r = await json(await reportsRoute.GET(request(bob, `${base()}/reports?type=tax`), P()));
    expect(r.body.data.disclaimer).toBe("ESTIMATE — NOT TAX ADVICE");
  });

  it("audit: ADMIN and MANAGER read it, members cannot, and the log and ledger cannot be edited or deleted", async () => {
    expect((await auditRoute.GET(request(carol, `${base()}/audit`), P())).status).toBe(200);
    expect((await auditRoute.GET(request(bob, `${base()}/audit`), P())).status).toBe(403);
    const r = await json(await auditRoute.GET(request(alice, `${base()}/audit?entityType=trade`), P()));
    expect(r.body.data.audit.some((a: { action: string }) => a.action === "trade.executed_backdated")).toBe(true);

    await expect(db.query("UPDATE qfinera_fund_audit_log SET action = 'x'")).rejects.toThrow(/append-only/);
    await expect(db.query("DELETE FROM qfinera_fund_audit_log")).rejects.toThrow(/append-only/);
    await expect(db.query("UPDATE qfinera_fund_ledger_entries SET cash_delta = 0")).rejects.toThrow(/append-only/);
    await expect(db.query("DELETE FROM qfinera_fund_ledger_entries")).rejects.toThrow(/append-only/);
    await expect(db.query("UPDATE qfinera_fund_price_snapshots SET price = 1")).rejects.toThrow(/append-only/);
    await expect(db.query("UPDATE qfinera_fund_nav_snapshots SET nav = 1")).rejects.toThrow(/may only change is_official/);
  });

  it("members: ADMIN cannot remove someone holding units, nor change themselves; the last admin stays", async () => {
    const holding = await json(await memberRoute.PATCH(request(alice, `${base()}/members/${bob.id}`, { method: "PATCH", body: { status: "removed" } }), PI(bob.id)));
    expect(holding.status).toBe(409);
    const self = await memberRoute.PATCH(request(alice, `${base()}/members/${alice.id}`, { method: "PATCH", body: { role: "MEMBER" } }), PI(alice.id));
    expect(self.status).toBe(403);
    const byManager = await memberRoute.PATCH(request(carol, `${base()}/members/${bob.id}`, { method: "PATCH", body: { status: "suspended" } }), PI(bob.id));
    expect(byManager.status).toBe(202); // a request for ADMIN approval; bob is still active
    expect((await db.query("SELECT status FROM qfinera_fund_memberships WHERE fund_id = $1 AND user_id = $2", [poolId, bob.id])).rows[0].status).toBe("active");
    await db.query("UPDATE qfinera_change_requests SET status = 'CANCELLED' WHERE fund_id = $1 AND action = 'member.update'", [poolId]);
    const suspend = await memberRoute.PATCH(request(alice, `${base()}/members/${bob.id}`, { method: "PATCH", body: { status: "suspended" } }), PI(bob.id));
    expect(suspend.status).toBe(200);
    expect((await dashboardRoute.GET(request(bob, `${base()}/dashboard`), P())).status).toBe(403);
    await memberRoute.PATCH(request(alice, `${base()}/members/${bob.id}`, { method: "PATCH", body: { status: "active" } }), PI(bob.id));
    expect((await dashboardRoute.GET(request(bob, `${base()}/dashboard`), P())).status).toBe(200);
  });

  it("ledger reconciles: member units == pool units, and cash never went negative", async () => {
    const { rows } = await db.query(
      `SELECT (SELECT SUM(units) FROM qfinera_fund_memberships WHERE fund_id = $1)::text AS members,
              (SELECT SUM(units_delta) FROM qfinera_fund_ledger_entries WHERE fund_id = $1)::text AS ledger,
              (SELECT MIN(running) FROM (SELECT SUM(cash_delta) OVER (ORDER BY entry_date, id) AS running
                 FROM qfinera_fund_ledger_entries WHERE fund_id = $1) t)::numeric >= 0 AS cash_ok`,
      [poolId]
    );
    expect(rows[0].members).toBe(rows[0].ledger);
    expect(rows[0].cash_ok).toBe(true);
  });
});
