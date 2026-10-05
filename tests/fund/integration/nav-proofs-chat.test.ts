// The "Intraday" acceptance scenario against a real PostgreSQL database,
// through the actual route handlers:
//   * four contributions (750, 500, 1000, 1000) with payment proofs uploaded
//     as multipart (the app's encoding), persisted and private;
//   * NAV status explains what is waiting; the official NAV allocates units
//     once, atomically, and refuses to skip an earlier un-struck date;
//   * Pool Chat for ADMIN, MANAGER, MEMBER and VIEWER; never for outsiders,
//     suspended members or anonymous callers; own edit/remove; ADMIN
//     moderation (audited); plain-text storage; paging in server order.
// Opt-in: see harness.ts.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { createTestDatabase, createUser, integrationEnabled, json, params, request, type TestDb, type TestUser } from "./harness";

import * as poolsRoute from "@/app/api/qfinera/pools/route";
import * as contributionsRoute from "@/app/api/qfinera/pools/[poolId]/contributions/route";
import * as contributionRoute from "@/app/api/qfinera/pools/[poolId]/contributions/[id]/route";
import * as proofsRoute from "@/app/api/qfinera/pools/[poolId]/contributions/[id]/proofs/route";
import * as proofRoute from "@/app/api/qfinera/pools/[poolId]/contributions/[id]/proofs/[proofId]/route";
import * as navRoute from "@/app/api/qfinera/pools/[poolId]/nav/route";
import * as navStatusRoute from "@/app/api/qfinera/pools/[poolId]/nav/status/route";
import * as chatRoute from "@/app/api/qfinera/pools/[poolId]/chat/route";
import * as chatItemRoute from "@/app/api/qfinera/pools/[poolId]/chat/[id]/route";

const suite = integrationEnabled ? describe : describe.skip;

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("fake-png-body")]);

suite("Intraday pool: NAV allocation, payment proofs, Pool Chat (real database)", () => {
  let db: TestDb;
  let admin: TestUser;
  let manager: TestUser;
  let member: TestUser;
  let member2: TestUser;
  let viewer: TestUser;
  let outsider: TestUser;
  let suspended: TestUser;
  let poolId = "";
  let otherPoolId = "";
  const contributions: number[] = []; // 750, 500, 1000, 1000
  let early = 0; // 250, due one trading day earlier
  const proofs = new Map<number, number>(); // contribution -> proof id

  const P = (id = poolId) => params({ poolId: id });
  const PI = (id: number | string, pool = poolId) => params({ poolId: pool, id: String(id) });
  const base = (id = poolId) => `/api/qfinera/pools/${id}`;

  function multipart(user: TestUser | null, path: string, form: FormData, origin: string | null = "http://localhost:3000") {
    const headers: Record<string, string> = { host: "localhost:3000" };
    if (user) headers.cookie = user.cookie;
    if (origin) headers.origin = origin;
    return new NextRequest(`http://localhost:3000${path}`, { method: "POST", headers, body: form });
  }

  function proofForm(bytes: Buffer, name = "upi.png", kind = "PAYMENT") {
    const form = new FormData();
    form.append("file", new File([new Uint8Array(bytes)], name, { type: "image/png" }));
    form.append("kind", kind);
    return form;
  }

  async function upload(user: TestUser, id: number, bytes: Buffer, name = "upi.png", origin: string | null = "http://localhost:3000") {
    return json(await proofsRoute.POST(multipart(user, `${base()}/contributions/${id}/proofs`, proofForm(bytes, name), origin), PI(id)));
  }

  function download(user: TestUser | null, id: number, proofId: number, pool = poolId) {
    return proofRoute.GET(request(user, `${base(pool)}/contributions/${id}/proofs/${proofId}`), {
      params: Promise.resolve({ poolId: pool, id: String(id), proofId: String(proofId) }),
    });
  }

  async function contribute(user: TestUser, amount: string, utr: string) {
    const r = await json(
      await contributionsRoute.POST(
        request(user, `${base()}/contributions`, { body: { amount, paymentDate: "2026-09-13", utr, paymentMethod: "UPI" } }),
        P()
      )
    );
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    return r.body.data.contribution.id as number;
  }

  const strike = async (date: string, user = admin) => json(await navRoute.POST(request(user, `${base()}/nav`, { body: { date } }), P()));
  const status = async (user: TestUser) => json(await navStatusRoute.GET(request(user, `${base()}/nav/status`), P()));
  const post = async (user: TestUser | null, body: unknown, pool = poolId) =>
    json(await chatRoute.POST(request(user, `${base(pool)}/chat`, { body: { body } }), P(pool)));
  const list = async (user: TestUser | null, query = "", pool = poolId) => json(await chatRoute.GET(request(user, `${base(pool)}/chat${query}`), P(pool)));
  const act = async (user: TestUser, id: number, body: Record<string, unknown>, pool = poolId) =>
    json(await chatItemRoute.POST(request(user, `${base(pool)}/chat/${id}`, { body }), PI(id, pool)));

  beforeAll(async () => {
    db = await createTestDatabase();
    [admin, manager, member, member2, viewer, outsider, suspended] = await Promise.all(
      ["admin", "manager", "member", "member2", "viewer", "outsider", "suspended"].map((h) => createUser(db, h))
    );
    const created = await json(await poolsRoute.POST(request(admin, "/api/qfinera/pools", { body: { name: "Intraday", acknowledgePrivate: true } })));
    poolId = String(created.body.data.pool.id);
    const other = await json(await poolsRoute.POST(request(outsider, "/api/qfinera/pools", { body: { name: "Other", acknowledgePrivate: true } })));
    otherPoolId = String(other.body.data.pool.id);
    for (const [u, r] of [[manager, "MANAGER"], [member, "MEMBER"], [member2, "MEMBER"], [viewer, "VIEWER"], [suspended, "MEMBER"]] as const) {
      await db.query("INSERT INTO qfinera_fund_memberships (fund_id, user_id, role) VALUES ($1, $2, $3)", [poolId, u.id, r]);
    }
  });

  afterAll(async () => {
    await db?.close();
  });

  // ------------------------------------------------------------ proofs

  it("members contribute 750, 500, 1000, 1000 and attach payment proofs (multipart)", async () => {
    contributions.push(await contribute(member, "750.00", "UTR-750"));
    contributions.push(await contribute(member2, "500.00", "UTR-500"));
    contributions.push(await contribute(manager, "1000.00", "UTR-1000A"));
    contributions.push(await contribute(member, "1000.00", "UTR-1000B"));
    early = await contribute(member2, "250.00", "UTR-250");

    const owners = [member, member2, manager, member];
    for (const [i, id] of contributions.entries()) {
      const bytes = Buffer.concat([PNG, Buffer.from(`#${i}`)]);
      const r = await upload(owners[i], id, bytes, `proof ${i}.png`);
      expect(r.status, JSON.stringify(r.body)).toBe(201);
      expect(r.body.data.proof).toMatchObject({ kind: "PAYMENT", contentType: "image/png", sizeBytes: bytes.length });
      proofs.set(id, r.body.data.proof.id);
    }
  });

  it("a proof survives a fresh read (refresh / another device / new session) and its bytes are intact", async () => {
    for (const id of contributions) {
      const detail = await json(await contributionRoute.GET(request(admin, `${base()}/contributions/${id}`), PI(id)));
      expect(detail.status).toBe(200);
      expect(detail.body.data.proofs.map((p: { id: number }) => p.id)).toEqual([proofs.get(id)]);
    }
    const list = await json(await contributionsRoute.GET(request(member, `${base()}/contributions`), P()));
    expect(list.body.data.contributions.filter((c: { proofCount: number }) => c.proofCount === 1)).toHaveLength(2);

    const res = await download(member, contributions[0], proofs.get(contributions[0]) as number);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(Buffer.from(await res.arrayBuffer()).subarray(0, 8)).toEqual(PNG.subarray(0, 8));
  });

  it("a proof is private: other members, other pools and anonymous callers get nothing", async () => {
    const [c750] = contributions;
    const p = proofs.get(c750) as number;
    expect((await download(member2, c750, p)).status).toBe(404); // another member of the same pool
    expect((await download(viewer, c750, p)).status).toBe(404);
    expect((await download(outsider, c750, p)).status).toBe(404); // not a member
    expect((await download(outsider, c750, p, otherPoolId)).status).toBe(404); // through their own pool's path
    expect((await download(null, c750, p)).status).toBe(401);
    expect((await download(admin, c750, p)).status).toBe(200);
    expect((await download(manager, c750, p)).status).toBe(200);
    // Someone else cannot attach "payment proof" to your contribution.
    expect((await upload(member2, c750, Buffer.concat([PNG, Buffer.from("x")]))).status).toBe(404);
  });

  it("uploads are validated: real content type, size, and a same-origin multipart request", async () => {
    const id = contributions[0];
    const html = await upload(member, id, Buffer.from("<html><script>alert(1)</script></html>"), "proof.png");
    expect(html.status).toBe(400);
    const big = await upload(member, id, Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]));
    expect(big.status).toBe(400);
    const noOrigin = await upload(member, id, Buffer.concat([PNG, Buffer.from("no-origin")]), "a.png", null);
    expect(noOrigin.status).toBe(403);
    const crossSite = await upload(member, id, Buffer.concat([PNG, Buffer.from("cross")]), "a.png", "https://evil.example");
    expect(crossSite.status).toBe(403);
    const dup = await upload(member, id, Buffer.concat([PNG, Buffer.from("#0")]));
    expect(dup.status).toBe(409);
    const count = await db.query("SELECT COUNT(*)::int AS n FROM qfinera_fund_contribution_proofs WHERE contribution_id = $1", [id]);
    expect(count.rows[0].n).toBe(1);
  });

  // --------------------------------------------------------------- NAV

  it("after review the contributions await a NAV, and NAV status explains it to everyone", async () => {
    for (const id of [...contributions, early]) {
      for (const action of ["approve", "confirm-funds"]) {
        const r = await contributionRoute.POST(request(admin, `${base()}/contributions/${id}`, { body: { action } }), PI(id));
        expect(r.status, `${action} #${id}`).toBe(200);
      }
    }
    // Test clock control: Monday 14 Sep 2026 for the four, Friday 11 Sep for the early one.
    await db.query("UPDATE qfinera_fund_contributions SET effective_date = '2026-09-14' WHERE id = ANY($1::int[])", [contributions]);
    await db.query("UPDATE qfinera_fund_contributions SET effective_date = '2026-09-11' WHERE id = $1", [early]);

    const asMember = await status(member);
    expect(asMember.status).toBe(200);
    expect(asMember.body.data.status.next).toMatchObject({ navDate: "2026-09-11", contributions: 1, official: null });
    expect(asMember.body.data.status.due.map((d: { navDate: string }) => d.navDate)).toEqual(["2026-09-11", "2026-09-14"]);
    expect(asMember.body.data.status.due[1]).toMatchObject({ contributions: 4, mine: 2 });
    expect(asMember.body.data.status.readiness).toBeNull(); // members do not see the strike preview

    const asAdmin = await status(admin);
    expect(asAdmin.body.data.status.readiness).toMatchObject({ problems: [], dueCount: 1, nav: "10.0000" });
    expect((await status(viewer)).status).toBe(200);
    expect((await json(await navStatusRoute.GET(request(outsider, `${base()}/nav/status`), P()))).status).toBe(404);
  });

  it("only ADMIN strikes; members, viewers and direct calls cannot allocate units", async () => {
    expect((await strike("2026-09-11", member)).status).toBe(403);
    expect((await strike("2026-09-11", viewer)).status).toBe(403);
    const finalize = await contributionRoute.POST(request(member, `${base()}/contributions/${contributions[0]}`, { body: { action: "finalize" } }), PI(contributions[0]));
    expect([403, 404]).toContain(finalize.status);
    const units = await db.query("SELECT COUNT(*)::int AS n FROM qfinera_fund_contributions WHERE units_allocated IS NOT NULL AND fund_id = $1", [poolId]);
    expect(units.rows[0].n).toBe(0);
  });

  it("a later NAV cannot be struck while an earlier due date is un-struck (no stranded contributions)", async () => {
    const r = await strike("2026-09-14");
    expect(r.status).toBe(409);
    expect(r.body.error.message).toContain("2026-09-11");
    expect((await db.query("SELECT COUNT(*)::int AS n FROM qfinera_fund_nav_snapshots WHERE fund_id = $1", [poolId])).rows[0].n).toBe(0);
  });

  it("striking the NAVs allocates every waiting contribution, once, with NAV, units and a ledger reference", async () => {
    const first = await strike("2026-09-11");
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    expect(first.body.data.finalized.contributions).toEqual([early]);

    const second = await strike("2026-09-14");
    expect(second.status, JSON.stringify(second.body)).toBe(201);
    expect(second.body.data.snapshot.nav).toBe("10.0000");
    expect([...second.body.data.finalized.contributions].sort()).toEqual([...contributions].sort());

    const { rows } = await db.query(
      `SELECT id, status, nav_used::text AS nav, units_allocated::text AS units, effective_date::text AS d
         FROM qfinera_fund_contributions WHERE id = ANY($1::int[]) ORDER BY id`,
      [contributions]
    );
    expect(rows.map((r) => [r.status, r.nav, r.units, r.d])).toEqual([
      ["FINALIZED", "10.0000", "75.0000", "2026-09-14"],
      ["FINALIZED", "10.0000", "50.0000", "2026-09-14"],
      ["FINALIZED", "10.0000", "100.0000", "2026-09-14"],
      ["FINALIZED", "10.0000", "100.0000", "2026-09-14"],
    ]);

    // Idempotent: striking again is a correction (refused without one), and never duplicates units.
    expect((await strike("2026-09-14")).status).toBe(400);
    const again = await json(await navRoute.POST(request(admin, `${base()}/nav`, { body: { date: "2026-09-14", correctionReason: "Re-run of the same day", confirmCorrection: true } }), P()));
    expect(again.status).toBe(409); // units were allocated at this NAV: it cannot be re-struck
    const ledger = await db.query("SELECT COUNT(*)::int AS n FROM qfinera_fund_ledger_entries WHERE fund_id = $1 AND entry_type = 'CONTRIBUTION'", [poolId]);
    expect(ledger.rows[0].n).toBe(5);
    const units = await db.query("SELECT user_id, units::text AS u FROM qfinera_fund_memberships WHERE fund_id = $1 AND user_id = ANY($2::int[]) ORDER BY user_id", [
      poolId,
      [member.id, member2.id, manager.id],
    ]);
    expect(Object.fromEntries(units.rows.map((r) => [r.user_id, r.u]))).toEqual({
      [member.id]: "175.0000",
      [member2.id]: "75.0000",
      [manager.id]: "100.0000",
    });

    // The record shows who reviewed it and the accounting reference; the proof is still there.
    const detail = await json(await contributionRoute.GET(request(member, `${base()}/contributions/${contributions[0]}`), PI(contributions[0])));
    expect(detail.body.data).toMatchObject({ approvedByName: "admin", fundsConfirmedByName: "admin" });
    expect(detail.body.data.ledgerEntryId).toEqual(expect.any(Number));
    expect(detail.body.data.proofs).toHaveLength(1);

    const after = await status(member);
    expect(after.body.data.status).toMatchObject({ next: null, due: [] });
    expect(after.body.data.status.latest).toMatchObject({ asOfDate: "2026-09-14", nav: "10.0000" });
  });

  // -------------------------------------------------------------- chat

  it("ADMIN, MANAGER, MEMBER and VIEWER can all read and post in Pool Chat", async () => {
    for (const [u, text] of [
      [admin, "Should we review today's holdings before the EOD report?"],
      [manager, "Today's report is available."],
      [member, "Payment sent for my contribution."],
      [viewer, "Can someone explain today's NAV?"],
    ] as const) {
      const r = await post(u, text);
      expect(r.status, JSON.stringify(r.body)).toBe(201);
      expect(r.body.data.message).toMatchObject({ userId: u.id, body: text, deleted: false });
    }
    const page = await list(viewer);
    expect(page.status).toBe(200);
    expect(page.body.data.messages.map((m: { body: string }) => m.body)).toEqual([
      "Should we review today's holdings before the EOD report?",
      "Today's report is available.",
      "Payment sent for my contribution.",
      "Can someone explain today's NAV?",
    ]);
    expect(page.body.data.messages[3]).toMatchObject({ authorName: "viewer", authorRole: "VIEWER" });
  });

  it("outsiders, other pools, anonymous callers and suspended members cannot read or post", async () => {
    expect((await list(outsider)).status).toBe(404);
    expect((await post(outsider, "hello")).status).toBe(404);
    expect((await list(null)).status).toBe(401);
    expect((await post(null, "hello")).status).toBe(401);

    // A message id from this pool is not reachable through another pool.
    const mine = (await post(member, "Can we discuss this watchlist idea?")).body.data.message.id as number;
    expect((await act(outsider, mine, { action: "remove", reason: "not yours" }, otherPoolId)).status).toBe(404);
    expect((await list(outsider, "", otherPoolId)).body.data.messages).toEqual([]);

    await db.query("UPDATE qfinera_fund_memberships SET status = 'suspended' WHERE fund_id = $1 AND user_id = $2", [poolId, suspended.id]);
    expect((await list(suspended)).status).toBe(403);
    expect((await post(suspended, "still here?")).status).toBe(403);
    await db.query("UPDATE qfinera_fund_memberships SET status = 'removed' WHERE fund_id = $1 AND user_id = $2", [poolId, suspended.id]);
    expect((await post(suspended, "still here?")).status).toBe(404);
  });

  it("messages are validated and stored as plain text", async () => {
    expect((await post(member, "   ")).status).toBe(400);
    expect((await post(member, 42)).status).toBe(400);
    expect((await post(member, "x".repeat(2001))).status).toBe(400);
    const xss = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
    const r = await post(member, `  ${xss}\u0000‮  `);
    expect(r.status).toBe(201);
    // Stored verbatim (minus control characters); the UI renders it as text, never HTML.
    expect(r.body.data.message.body).toBe(xss);
  });

  it("authors edit and delete their own messages only; ADMIN moderation is audited", async () => {
    const own = (await post(member, "Why did we reduce the posiion?")).body.data.message.id as number;
    const edited = await act(member, own, { action: "edit", body: "Why did we reduce the position?" });
    expect(edited.status).toBe(200);
    expect(edited.body.data.message).toMatchObject({ body: "Why did we reduce the position?", editedAt: expect.any(String) });

    expect((await act(member2, own, { action: "edit", body: "hijacked" })).status).toBe(403);
    expect((await act(admin, own, { action: "edit", body: "hijacked" })).status).toBe(403); // nobody edits someone else's words
    expect((await act(member2, own, { action: "remove" })).status).toBe(403);
    expect((await act(viewer, own, { action: "remove" })).status).toBe(403);
    expect((await act(manager, own, { action: "remove", reason: "off topic" })).status).toBe(403); // MANAGER does not moderate

    const another = (await post(member2, "temporary")).body.data.message.id as number;
    const selfRemoved = await act(member2, another, { action: "remove" });
    expect(selfRemoved.status).toBe(200);
    expect(selfRemoved.body.data.message).toMatchObject({ deleted: true, body: "", removedByModerator: false });

    expect((await act(admin, own, { action: "remove" })).status).toBe(400); // a reason is required
    const moderated = await act(admin, own, { action: "remove", reason: "Duplicate question" });
    expect(moderated.status).toBe(200);
    expect(moderated.body.data.message).toMatchObject({ deleted: true, body: "", removedByModerator: true });
    expect((await act(member, own, { action: "edit", body: "back again" })).status).toBe(409);

    const audit = await db.query("SELECT action, entity_id, diff->>'reason' AS reason FROM qfinera_fund_audit_log WHERE fund_id = $1 AND entity_type = 'chat_message'", [poolId]);
    expect(audit.rows).toEqual([{ action: "chat.message_removed", entity_id: own, reason: "Duplicate question" }]);
    // Ordinary chat is not written to the financial audit log.
    const stored = await db.query("SELECT body FROM qfinera_fund_messages WHERE id = $1", [own]);
    expect(stored.rows[0].body).toBe("");
  });

  it("posting is rate limited per person", async () => {
    let last = 0;
    for (let i = 0; i < 25 && last !== 429; i++) last = (await post(member2, `burst ${i}`)).status;
    expect(last).toBe(429);
    expect((await post(member, "others are unaffected")).status).toBe(201);
  });

  it("history pages by server order: latest 50, then older on request", async () => {
    await db.query(
      `INSERT INTO qfinera_fund_messages (fund_id, user_id, body, created_at)
       SELECT $1, $2, 'old ' || g, now() - interval '2 days' + g * interval '1 second' FROM generate_series(1, 70) g`,
      [poolId, admin.id]
    );
    const latest = await list(member);
    expect(latest.body.data.messages).toHaveLength(50);
    expect(latest.body.data.hasOlder).toBe(true);
    const ids: number[] = latest.body.data.messages.map((m: { id: number }) => m.id);
    expect([...ids].sort((a, b) => a - b)).toEqual(ids);

    const older = await list(member, `?before=${ids[0]}`);
    const olderIds: number[] = older.body.data.messages.map((m: { id: number }) => m.id);
    expect(olderIds.length).toBeGreaterThan(0);
    expect(Math.max(...olderIds)).toBeLessThan(ids[0]);
    let cursor = olderIds[0];
    let hasOlder = older.body.data.hasOlder as boolean;
    let total = ids.length + olderIds.length;
    while (hasOlder) {
      const next = await list(member, `?before=${cursor}`);
      total += next.body.data.messages.length;
      cursor = next.body.data.messages[0].id;
      hasOlder = next.body.data.hasOlder;
    }
    const all = await db.query("SELECT COUNT(*)::int AS n FROM qfinera_fund_messages WHERE fund_id = $1", [poolId]);
    expect(total).toBe(all.rows[0].n);
    expect((await list(member, "?before=abc")).status).toBe(400);
  });
});
