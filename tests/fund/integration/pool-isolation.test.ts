// Multi-pool isolation against a real database: every cross-pool read or
// write attempt must look exactly like a missing record (404), and one
// pool's prices, settings and members must never affect another pool.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, createUser, integrationEnabled, json, params, request, type TestDb, type TestUser } from "./harness";

import * as poolsRoute from "@/app/api/qfinera/pools/route";
import * as poolRoute from "@/app/api/qfinera/pools/[poolId]/route";
import * as contributionsRoute from "@/app/api/qfinera/pools/[poolId]/contributions/route";
import * as contributionRoute from "@/app/api/qfinera/pools/[poolId]/contributions/[id]/route";
import * as instrumentsRoute from "@/app/api/qfinera/pools/[poolId]/instruments/route";
import * as instrumentRoute from "@/app/api/qfinera/pools/[poolId]/instruments/[id]/route";
import * as tradesRoute from "@/app/api/qfinera/pools/[poolId]/trades/route";
import * as tradeRoute from "@/app/api/qfinera/pools/[poolId]/trades/[id]/route";
import * as watchlistRoute from "@/app/api/qfinera/pools/[poolId]/watchlist/route";
import * as watchItemRoute from "@/app/api/qfinera/pools/[poolId]/watchlist/[id]/route";
import * as invitesRoute from "@/app/api/qfinera/pools/[poolId]/invites/route";
import * as inviteRoute from "@/app/api/qfinera/pools/[poolId]/invites/[id]/route";
import * as membersRoute from "@/app/api/qfinera/pools/[poolId]/members/route";
import * as memberRoute from "@/app/api/qfinera/pools/[poolId]/members/[id]/route";
import * as settingsRoute from "@/app/api/qfinera/pools/[poolId]/settings/route";
import * as auditRoute from "@/app/api/qfinera/pools/[poolId]/audit/route";
import * as navRoute from "@/app/api/qfinera/pools/[poolId]/nav/route";

const suite = integrationEnabled ? describe : describe.skip;

suite("multi-pool isolation (real database)", () => {
  let db: TestDb;
  let alice: TestUser;
  let mallory: TestUser;
  let poolA = "";
  let poolB = "";
  let contributionA = 0;
  let tradeA = 0;
  let watchA = 0;
  let infy = 0;

  const P = (poolId: string) => params({ poolId });
  const PI = (poolId: string, id: number) => params({ poolId, id: String(id) });

  async function createPool(user: TestUser, name: string) {
    const r = await json(await poolsRoute.POST(request(user, "/api/qfinera/pools", { body: { name, acknowledgePrivate: true } })));
    expect(r.status).toBe(201);
    return String(r.body.data.pool.id);
  }

  beforeAll(async () => {
    db = await createTestDatabase();
    alice = await createUser(db, "alice");
    mallory = await createUser(db, "mallory");
    poolA = await createPool(alice, "Pool A");
    poolB = await createPool(mallory, "Pool B");

    const c = await json(
      await contributionsRoute.POST(
        request(alice, `/api/qfinera/pools/${poolA}/contributions`, { body: { amount: "5000.00", paymentDate: "2026-08-31" } }),
        P(poolA)
      )
    );
    contributionA = c.body.data.contribution.id;
    const i = await json(
      await instrumentsRoute.POST(request(alice, `/api/qfinera/pools/${poolA}/instruments`, { body: { symbol: "INFY", exchange: "NSE" } }), P(poolA))
    );
    infy = i.body.data.instrument.id;
    const t = await json(
      await tradesRoute.POST(
        request(alice, `/api/qfinera/pools/${poolA}/trades`, {
          body: { instrumentId: infy, side: "BUY", tradeDate: "2026-09-02", quantity: "1", price: "100" },
        }),
        P(poolA)
      )
    );
    tradeA = t.body.data.trade.id;
    const w = await json(
      await watchlistRoute.POST(
        request(alice, `/api/qfinera/pools/${poolA}/watchlist`, { body: { instrumentId: infy, title: "Research note" } }),
        P(poolA)
      )
    );
    watchA = w.body.data.item.id;
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  it("lists only the caller's own pools", async () => {
    const r = await json(await poolsRoute.GET(request(mallory, "/api/qfinera/pools")));
    expect(r.body.data.pools.map((p: { id: number }) => String(p.id))).toEqual([poolB]);
  });

  it("a non-member cannot open another pool at all", async () => {
    expect((await poolRoute.GET(request(mallory, `/api/qfinera/pools/${poolA}`), P(poolA))).status).toBe(404);
    expect((await poolRoute.GET(request(mallory, `/api/qfinera/pools/999999`), P("999999"))).status).toBe(404);
  });

  it("a pool A record addressed through pool B's path is not found (no IDOR), even for an admin of B", async () => {
    const attempts: Array<[string, Response]> = [
      ["contribution read", await contributionRoute.GET(request(mallory, `/api/qfinera/pools/${poolB}/contributions/${contributionA}`), PI(poolB, contributionA))],
      [
        "contribution approve",
        await contributionRoute.POST(
          request(mallory, `/api/qfinera/pools/${poolB}/contributions/${contributionA}`, { body: { action: "approve" } }),
          PI(poolB, contributionA)
        ),
      ],
      ["trade read", await tradeRoute.GET(request(mallory, `/api/qfinera/pools/${poolB}/trades/${tradeA}`), PI(poolB, tradeA))],
      [
        "trade execute",
        await tradeRoute.POST(request(mallory, `/api/qfinera/pools/${poolB}/trades/${tradeA}`, { body: { action: "execute" } }), PI(poolB, tradeA)),
      ],
      ["watchlist read", await watchItemRoute.GET(request(mallory, `/api/qfinera/pools/${poolB}/watchlist/${watchA}`), PI(poolB, watchA))],
      [
        "watchlist comment",
        await watchItemRoute.POST(
          request(mallory, `/api/qfinera/pools/${poolB}/watchlist/${watchA}`, { body: { action: "comment", body: "hi" } }),
          PI(poolB, watchA)
        ),
      ],
      [
        "member change",
        await memberRoute.PATCH(
          request(mallory, `/api/qfinera/pools/${poolB}/members/${alice.id}`, { method: "PATCH", body: { status: "suspended" } }),
          PI(poolB, alice.id)
        ),
      ],
    ];
    for (const [what, res] of attempts) expect(res.status, what).toBe(404);

    const { rows } = await db.query("SELECT status FROM qfinera_fund_contributions WHERE id = $1", [contributionA]);
    expect(rows[0].status).toBe("PENDING");
    const t = await db.query("SELECT status FROM qfinera_fund_trades WHERE id = $1", [tradeA]);
    expect(t.rows[0].status).toBe("DRAFT");
  });

  it("a member of BOTH pools still cannot reach pool A records through pool B", async () => {
    const inv = await json(await invitesRoute.POST(request(mallory, `/api/qfinera/pools/${poolB}/invites`, { body: { email: alice.email } }), P(poolB)));
    const token = new URL(inv.body.data.link).searchParams.get("token") as string;
    const { POST } = await import("@/app/api/qfinera/pools/join/route");
    expect((await POST(request(alice, "/api/qfinera/pools/join", { body: { token } }))).status).toBe(200);

    const res = await contributionRoute.GET(request(alice, `/api/qfinera/pools/${poolB}/contributions/${contributionA}`), PI(poolB, contributionA));
    expect(res.status).toBe(404);
    const list = await json(await contributionsRoute.GET(request(alice, `/api/qfinera/pools/${poolB}/contributions`), P(poolB)));
    expect(list.body.data.contributions).toEqual([]);
    // In pool B alice is only a MEMBER: no admin powers carried over from pool A.
    expect((await settingsRoute.GET(request(alice, `/api/qfinera/pools/${poolB}/settings`), P(poolB))).status).toBe(403);
    expect((await auditRoute.GET(request(alice, `/api/qfinera/pools/${poolB}/audit`), P(poolB))).status).toBe(403);
  });

  it("one pool's manually recorded price never feeds another pool's quotes or NAV", async () => {
    const r = await instrumentRoute.POST(
      request(mallory, `/api/qfinera/pools/${poolB}/instruments/${infy}`, {
        body: { action: "record-price", price: "99999.0000", date: "2026-09-02" },
      }),
      PI(poolB, infy)
    );
    expect(r.status).toBe(201);
    const inA = await json(await instrumentRoute.GET(request(alice, `/api/qfinera/pools/${poolA}/instruments/${infy}`), PI(poolA, infy)));
    expect(inA.body.data.quote).toMatchObject({ available: false, quality: "UNAVAILABLE" });
    const inB = await json(await instrumentRoute.GET(request(mallory, `/api/qfinera/pools/${poolB}/instruments/${infy}`), PI(poolB, infy)));
    expect(inB.body.data.quote).toMatchObject({ available: true, price: "99999.0000", stale: true });

    const preview = await json(await navRoute.GET(request(alice, `/api/qfinera/pools/${poolA}/nav?date=2026-09-02`), P(poolA)));
    expect(preview.body.data.preview.holdings).toEqual([]); // the draft trade has no accounting effect
  });

  it("watchlist: members comment; only MANAGER/ADMIN edit; no duplicate active items", async () => {
    const dup = await watchlistRoute.POST(
      request(alice, `/api/qfinera/pools/${poolA}/watchlist`, { body: { instrumentId: infy, title: "Again" } }),
      P(poolA)
    );
    expect(dup.status).toBe(409);
    const badLink = await watchlistRoute.POST(
      request(mallory, `/api/qfinera/pools/${poolB}/watchlist`, { body: { instrumentId: infy, title: "Note", researchUrl: "javascript:alert(1)" } }),
      P(poolB)
    );
    expect(badLink.status).toBe(400);
    const created = await json(
      await watchlistRoute.POST(request(mallory, `/api/qfinera/pools/${poolB}/watchlist`, { body: { instrumentId: infy, title: "Note B" } }), P(poolB))
    );
    const id = created.body.data.item.id as number;
    const editByMember = await watchItemRoute.PATCH(
      request(alice, `/api/qfinera/pools/${poolB}/watchlist/${id}`, { method: "PATCH", body: { status: "WATCHING" } }),
      PI(poolB, id)
    );
    expect(editByMember.status).toBe(403);
    const comment = await watchItemRoute.POST(
      request(alice, `/api/qfinera/pools/${poolB}/watchlist/${id}`, { body: { action: "comment", body: "Worth a look at the annual report." } }),
      PI(poolB, id)
    );
    expect(comment.status).toBe(201);
    const detail = await json(await watchItemRoute.GET(request(alice, `/api/qfinera/pools/${poolB}/watchlist/${id}`), PI(poolB, id)));
    expect(detail.body.data.comments).toHaveLength(1);
  });

  it("settings: ADMIN-only, validated, audited, and isolated per pool", async () => {
    const bad = await settingsRoute.PATCH(
      request(alice, `/api/qfinera/pools/${poolA}/settings`, { method: "PATCH", body: { cutoffTimeIst: "25:00" } }),
      P(poolA)
    );
    expect(bad.status).toBe(400);
    const badRate = await settingsRoute.PATCH(
      request(alice, `/api/qfinera/pools/${poolA}/settings`, { method: "PATCH", body: { stcgRate: "120" } }),
      P(poolA)
    );
    expect(badRate.status).toBe(400);
    const provider = await settingsRoute.PATCH(
      request(alice, `/api/qfinera/pools/${poolA}/settings`, { method: "PATCH", body: { marketDataProvider: "made-up-feed" } }),
      P(poolA)
    );
    expect(provider.status).toBe(400);
    const ok = await json(
      await settingsRoute.PATCH(
        request(alice, `/api/qfinera/pools/${poolA}/settings`, { method: "PATCH", body: { cutoffTimeIst: "15:45", holidays: ["2026-10-02"] } }),
        P(poolA)
      )
    );
    expect(ok.status).toBe(200);
    expect(ok.body.data.settings.nav).toEqual({ cutoffTimeIst: "15:45", holidays: ["2026-10-02"] });
    const b = await json(await settingsRoute.GET(request(mallory, `/api/qfinera/pools/${poolB}/settings`), P(poolB)));
    expect(b.body.data.settings.nav.cutoffTimeIst).toBe("16:00");
    const audit = await json(await auditRoute.GET(request(alice, `/api/qfinera/pools/${poolA}/audit?entityType=settings`), P(poolA)));
    expect(audit.body.data.audit[0].changes).toHaveProperty("cutoff_time_ist");
  });

  it("invites: revocable; a revoked link no longer works; admin sees only their pool's invites", async () => {
    const outsider = await createUser(db, "zoe");
    const inv = await json(await invitesRoute.POST(request(alice, `/api/qfinera/pools/${poolA}/invites`, { body: { email: outsider.email } }), P(poolA)));
    const token = new URL(inv.body.data.link).searchParams.get("token") as string;
    const crossRevoke = await inviteRoute.POST(
      request(mallory, `/api/qfinera/pools/${poolB}/invites/${inv.body.data.invite.id}`, { body: { action: "revoke" } }),
      PI(poolB, inv.body.data.invite.id)
    );
    expect(crossRevoke.status).toBe(404);
    expect(
      (await inviteRoute.POST(request(alice, `/api/qfinera/pools/${poolA}/invites/${inv.body.data.invite.id}`, { body: { action: "revoke" } }), PI(poolA, inv.body.data.invite.id)))
        .status
    ).toBe(200);
    const { POST } = await import("@/app/api/qfinera/pools/join/route");
    expect((await POST(request(outsider, "/api/qfinera/pools/join", { body: { token } }))).status).toBe(404);
    const listB = await json(await invitesRoute.GET(request(mallory, `/api/qfinera/pools/${poolB}/invites`), P(poolB)));
    expect(listB.body.data.invites.every((i: { email: string }) => i.email === alice.email)).toBe(true);
  });

  it("removed members lose access but keep history, and can be re-invited", async () => {
    const r = await memberRoute.PATCH(
      request(mallory, `/api/qfinera/pools/${poolB}/members/${alice.id}`, { method: "PATCH", body: { status: "removed" } }),
      PI(poolB, alice.id)
    );
    expect(r.status).toBe(200);
    expect((await poolRoute.GET(request(alice, `/api/qfinera/pools/${poolB}`), P(poolB))).status).toBe(404);
    const members = await json(await membersRoute.GET(request(mallory, `/api/qfinera/pools/${poolB}/members?removed=1`), P(poolB)));
    expect(members.body.data.members.find((m: { userId: number }) => m.userId === alice.id).status).toBe("removed");
    const again = await json(await invitesRoute.POST(request(mallory, `/api/qfinera/pools/${poolB}/invites`, { body: { email: alice.email } }), P(poolB)));
    expect(again.status).toBe(201);
  });

  it("a pool creator is limited to a few pools", async () => {
    for (let i = 0; i < 4; i++) await createPool(mallory, `Extra ${i}`);
    const r = await poolsRoute.POST(request(mallory, "/api/qfinera/pools", { body: { name: "One too many", acknowledgePrivate: true } }));
    expect(r.status).toBe(409);
  });
});
