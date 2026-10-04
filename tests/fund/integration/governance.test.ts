// Roles, manager -> admin approvals, join requests, pool deletion/restore/
// purge, and Global Watch, against a real PostgreSQL database through the
// actual route handlers. Opt-in: see harness.ts.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { createTestDatabase, createUser, integrationEnabled, json, params, request, type TestDb, type TestUser } from "./harness";
import { purgeExpiredPools, purgePoolInTransaction } from "@/lib/fund/pool-purge";

import * as poolsRoute from "@/app/api/qfinera/pools/route";
import * as poolRoute from "@/app/api/qfinera/pools/[poolId]/route";
import * as dashboardRoute from "@/app/api/qfinera/pools/[poolId]/dashboard/route";
import * as contributionsRoute from "@/app/api/qfinera/pools/[poolId]/contributions/route";
import * as contributionRoute from "@/app/api/qfinera/pools/[poolId]/contributions/[id]/route";
import * as memberRoute from "@/app/api/qfinera/pools/[poolId]/members/[id]/route";
import * as requestsRoute from "@/app/api/qfinera/pools/[poolId]/requests/route";
import * as requestRoute from "@/app/api/qfinera/pools/[poolId]/requests/[id]/route";
import * as joinRequestsRoute from "@/app/api/qfinera/pools/[poolId]/join-requests/route";
import * as joinRequestRoute from "@/app/api/qfinera/pools/[poolId]/join-requests/[id]/route";
import * as deletionRoute from "@/app/api/qfinera/pools/[poolId]/deletion/route";
import * as restoreRoute from "@/app/api/qfinera/pools/[poolId]/restore/route";
import * as settingsRoute from "@/app/api/qfinera/pools/[poolId]/settings/route";
import * as watchlistRoute from "@/app/api/qfinera/pools/[poolId]/watchlist/route";
import * as watchRoute from "@/app/api/qfinera/watch/route";
import * as watchItemRoute from "@/app/api/qfinera/watch/[id]/route";
import * as watchRequestRoute from "@/app/api/qfinera/watch/requests/[id]/route";

const suite = integrationEnabled ? describe : describe.skip;

suite("governance: roles, approvals, deletion, Global Watch (real database)", () => {
  let db: TestDb;
  let admin: TestUser;
  let manager: TestUser;
  let member: TestUser;
  let viewer: TestUser;
  let outsider: TestUser;
  let poolId = "";
  let otherPoolId = "";

  const P = (id = poolId) => params({ poolId: id });
  const PI = (id: number | string, pool = poolId) => params({ poolId: pool, id: String(id) });
  const base = (id = poolId) => `/api/qfinera/pools/${id}`;

  async function role(userId: number, pool = poolId): Promise<string> {
    return (await db.query("SELECT role FROM qfinera_fund_memberships WHERE fund_id = $1 AND user_id = $2", [pool, userId])).rows[0]
      ?.role as string;
  }

  beforeAll(async () => {
    db = await createTestDatabase();
    [admin, manager, member, viewer, outsider] = await Promise.all(
      ["admin", "manager", "member", "viewer", "outsider"].map((h) => createUser(db, h))
    );
    const created = await json(
      await poolsRoute.POST(request(admin, "/api/qfinera/pools", { body: { name: "Family Pool", acknowledgePrivate: true } }))
    );
    poolId = String(created.body.data.pool.id);
    const other = await json(
      await poolsRoute.POST(request(outsider, "/api/qfinera/pools", { body: { name: "Other Pool", acknowledgePrivate: true } }))
    );
    otherPoolId = String(other.body.data.pool.id);
    for (const [u, r] of [[manager, "MANAGER"], [member, "MEMBER"], [viewer, "VIEWER"]] as const) {
      await db.query("INSERT INTO qfinera_fund_memberships (fund_id, user_id, role) VALUES ($1, $2, $3)", [poolId, u.id, r]);
    }
  });

  afterAll(async () => {
    await db?.close();
  });

  // ------------------------------------------------------------- viewer

  it("a VIEWER sees the pool read-only and cannot create anything", async () => {
    const ctx = await json(await poolRoute.GET(request(viewer, base()), P()));
    expect(ctx.body.data.role).toBe("VIEWER");
    expect(ctx.body.data.permissions).toContain("members:request_join");
    expect((await dashboardRoute.GET(request(viewer, `${base()}/dashboard`), P())).status).toBe(200);

    const contribution = await contributionsRoute.POST(
      request(viewer, `${base()}/contributions`, { body: { amount: "100.00", paymentDate: "2026-08-31", utr: "V-1" } }),
      P()
    );
    expect(contribution.status).toBe(403);
    const note = await watchlistRoute.POST(request(viewer, `${base()}/watchlist`, { body: { instrumentId: 1, title: "Note" } }), P());
    expect(note.status).toBe(403);
    const escalate = await memberRoute.PATCH(request(viewer, `${base()}/members/${viewer.id}`, { method: "PATCH", body: { role: "ADMIN" } }), PI(viewer.id));
    expect(escalate.status).toBe(403);
    expect(await role(viewer.id)).toBe("VIEWER");
  });

  it("nobody can contribute on behalf of a VIEWER", async () => {
    const r = await json(
      await contributionsRoute.POST(
        request(admin, `${base()}/contributions`, { body: { amount: "100.00", paymentDate: "2026-08-31", memberId: viewer.id, paymentMethod: "CASH" } }),
        P()
      )
    );
    expect(r.status).toBe(409);
  });

  // ------------------------------------------------------- join requests

  let joinId = 0;

  it("a VIEWER asks to join as MEMBER; only one open request at a time", async () => {
    const r = await json(await joinRequestsRoute.POST(request(viewer, `${base()}/join-requests`, { body: { note: "I'd like to contribute monthly." } }), P()));
    expect(r.status).toBe(201);
    joinId = r.body.data.joinRequest.id;
    expect((await joinRequestsRoute.POST(request(viewer, `${base()}/join-requests`, { body: {} }), P())).status).toBe(409);
    expect((await joinRequestsRoute.POST(request(member, `${base()}/join-requests`, { body: {} }), P())).status).toBe(403);
    // the viewer sees only their own; a member cannot review
    const mine = await json(await joinRequestsRoute.GET(request(viewer, `${base()}/join-requests`), P()));
    expect(mine.body.data.joinRequests).toHaveLength(1);
    expect((await joinRequestRoute.POST(request(member, `${base()}/join-requests/${joinId}`, { body: { action: "approve" } }), PI(joinId))).status).toBe(403);
  });

  it("a MANAGER's approval waits for an ADMIN; the role changes only on ADMIN approval", async () => {
    const r = await json(await joinRequestRoute.POST(request(manager, `${base()}/join-requests/${joinId}`, { body: { action: "approve" } }), PI(joinId)));
    expect(r.status).toBe(202);
    const requestId = r.body.data.pendingApproval.id as number;
    expect(await role(viewer.id)).toBe("VIEWER");

    // the manager cannot approve their own request
    expect((await requestRoute.POST(request(manager, `${base()}/requests/${requestId}`, { body: { action: "approve" } }), PI(requestId))).status).toBe(403);
    const queue = await json(await requestsRoute.GET(request(admin, `${base()}/requests?status=open`), P()));
    expect(queue.body.data.requests.map((q: { id: number }) => q.id)).toContain(requestId);

    const approved = await json(await requestRoute.POST(request(admin, `${base()}/requests/${requestId}`, { body: { action: "approve" } }), PI(requestId)));
    expect(approved.status).toBe(200);
    expect(await role(viewer.id)).toBe("MEMBER");
    const jr = (await db.query("SELECT status FROM qfinera_fund_join_requests WHERE id = $1", [joinId])).rows[0];
    expect(jr.status).toBe("APPROVED");
    // approving twice is impossible
    expect((await requestRoute.POST(request(admin, `${base()}/requests/${requestId}`, { body: { action: "approve" } }), PI(requestId))).status).toBe(409);
  });

  // ------------------------------------------------- role changes / audit

  it("ADMIN changes roles directly, audited with before/after and reason", async () => {
    const r = await memberRoute.PATCH(
      request(admin, `${base()}/members/${viewer.id}`, { method: "PATCH", body: { role: "VIEWER", reason: "Back to read-only" } }),
      PI(viewer.id)
    );
    expect(r.status).toBe(200);
    expect(await role(viewer.id)).toBe("VIEWER");
    const audit = (
      await db.query(
        "SELECT user_id, before_state, after_state, diff->>'reason' AS reason FROM qfinera_fund_audit_log WHERE fund_id = $1 AND action = 'member.role_changed' ORDER BY id DESC LIMIT 1",
        [poolId]
      )
    ).rows[0];
    expect(audit).toMatchObject({ user_id: admin.id, before_state: { role: "MEMBER" }, after_state: { role: "VIEWER" }, reason: "Back to read-only" });
  });

  it("a MANAGER's role change is a request; a manager cannot change their own role; rejection changes nothing", async () => {
    const self = await memberRoute.PATCH(request(manager, `${base()}/members/${manager.id}`, { method: "PATCH", body: { role: "ADMIN" } }), PI(manager.id));
    expect(self.status).toBe(403);
    const r = await json(await memberRoute.PATCH(request(manager, `${base()}/members/${member.id}`, { method: "PATCH", body: { role: "MANAGER" } }), PI(member.id)));
    expect(r.status).toBe(202);
    expect(r.body.data.request).toMatchObject({ action: "member.update", beforeState: { role: "MEMBER" }, status: "PENDING" });
    expect(await role(member.id)).toBe("MEMBER");
    const dup = await memberRoute.PATCH(request(manager, `${base()}/members/${member.id}`, { method: "PATCH", body: { role: "MANAGER" } }), PI(member.id));
    expect(dup.status).toBe(409);
    const rejected = await requestRoute.POST(
      request(admin, `${base()}/requests/${r.body.data.request.id}`, { body: { action: "reject", reason: "Not yet" } }),
      PI(r.body.data.request.id)
    );
    expect(rejected.status).toBe(200);
    expect(await role(member.id)).toBe("MEMBER");
  });

  it("a MANAGER cannot propose against another pool's records", async () => {
    const r = await memberRoute.PATCH(request(manager, `${base(otherPoolId)}/members/${outsider.id}`, { method: "PATCH", body: { role: "VIEWER" } }), PI(outsider.id, otherPoolId));
    expect(r.status).toBe(404);
  });

  it("accounting approvals by a MANAGER are applied, through the normal service, only when an ADMIN approves", async () => {
    const c = await json(
      await contributionsRoute.POST(request(member, `${base()}/contributions`, { body: { amount: "1000.00", paymentDate: "2026-08-31", utr: "M-1" } }), P())
    );
    const cid = c.body.data.contribution.id as number;
    const proposed = await json(await contributionRoute.POST(request(manager, `${base()}/contributions/${cid}`, { body: { action: "approve" } }), PI(cid)));
    expect(proposed.status).toBe(202);
    expect((await db.query("SELECT status FROM qfinera_fund_contributions WHERE id = $1", [cid])).rows[0].status).toBe("PENDING");
    const rid = proposed.body.data.request.id as number;
    expect((await requestRoute.POST(request(member, `${base()}/requests/${rid}`, { body: { action: "approve" } }), PI(rid))).status).toBe(403);
    const ok = await requestRoute.POST(request(admin, `${base()}/requests/${rid}`, { body: { action: "approve" } }), PI(rid));
    expect(ok.status).toBe(200);
    expect((await db.query("SELECT status, approved_by FROM qfinera_fund_contributions WHERE id = $1", [cid])).rows[0]).toMatchObject({
      status: "APPROVED",
      approved_by: admin.id,
    });
    const actions = (await db.query("SELECT action FROM qfinera_fund_audit_log WHERE fund_id = $1 ORDER BY id", [poolId])).rows.map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(["change_request.created", "contribution.approved", "change_request.approved"]));
  });

  it("a MANAGER may read settings, but a settings change waits for an ADMIN", async () => {
    expect((await settingsRoute.GET(request(manager, `${base()}/settings`), P())).status).toBe(200);
    const r = await settingsRoute.PATCH(request(manager, `${base()}/settings`, { method: "PATCH", body: { name: "Renamed by manager" } }), P());
    expect(r.status).toBe(202);
    expect((await db.query("SELECT name FROM qfinera_funds WHERE id = $1", [poolId])).rows[0].name).toBe("Family Pool");
    expect((await settingsRoute.PATCH(request(member, `${base()}/settings`, { method: "PATCH", body: { name: "Nope" } }), P())).status).toBe(403);
  });

  // --------------------------------------------------------- deletion

  it("deletion: ADMIN only, typed name required; the pool becomes inaccessible but restorable", async () => {
    expect((await deletionRoute.POST(request(member, `${base()}/deletion`, { body: { confirmName: "Family Pool" } }), P())).status).toBe(403);
    expect((await deletionRoute.POST(request(admin, `${base()}/deletion`, { body: { confirmName: "family pool" } }), P())).status).toBe(400);

    const del = await json(await deletionRoute.POST(request(admin, `${base()}/deletion`, { body: { confirmName: "Family Pool", reason: "Group wound up" } }), P()));
    expect(del.status).toBe(200);
    const row = (await db.query("SELECT deleted_by, deletion_reason, purge_after - deleted_at AS retention FROM qfinera_funds WHERE id = $1", [poolId])).rows[0];
    expect(row.deleted_by).toBe(admin.id);
    expect(row.deletion_reason).toBe("Group wound up");
    // Open proposals were cancelled with the pool.
    expect((await db.query("SELECT COUNT(*)::int AS n FROM qfinera_change_requests WHERE fund_id = $1 AND status = 'PENDING'", [poolId])).rows[0].n).toBe(0);

    for (const u of [admin, member, viewer]) expect((await dashboardRoute.GET(request(u, `${base()}/dashboard`), P())).status).toBe(404);
    const adminList = await json(await poolsRoute.GET(request(admin, "/api/qfinera/pools")));
    expect(adminList.body.data.pools.map((p: { id: number }) => String(p.id))).not.toContain(poolId);
    expect(adminList.body.data.deleted.map((p: { id: number }) => String(p.id))).toContain(poolId);
    const memberList = await json(await poolsRoute.GET(request(member, "/api/qfinera/pools")));
    expect(memberList.body.data.deleted).toEqual([]);

    expect((await restoreRoute.POST(request(member, `${base()}/restore`, { body: {} }), P())).status).toBe(404);
    expect((await restoreRoute.POST(request(admin, `${base()}/restore`, { body: {} }), P())).status).toBe(200);
    expect((await dashboardRoute.GET(request(member, `${base()}/dashboard`), P())).status).toBe(200);
  });

  it("purge protection: active and in-retention pools are never purged, even by direct SQL", async () => {
    const client = new Client({ connectionString: db.url });
    await client.connect();
    try {
      await client.query("BEGIN");
      expect(await purgePoolInTransaction(client, Number(poolId))).toBeNull();
      await client.query("ROLLBACK");

      // Even naming the pool in the session setting does not unlock an active pool.
      await client.query("BEGIN");
      await client.query("SELECT set_config('qfinera.purge_fund_id', $1, true)", [poolId]);
      await expect(client.query("DELETE FROM qfinera_fund_audit_log WHERE fund_id = $1", [poolId])).rejects.toThrow(/append-only/);
      await client.query("ROLLBACK");
      await client.query("BEGIN");
      await expect(client.query("DELETE FROM qfinera_funds WHERE id = $1", [poolId])).rejects.toThrow(/purge/);
      await client.query("ROLLBACK");

      // Deleted but still within retention: not purged.
      await deletionRoute.POST(request(admin, `${base()}/deletion`, { body: { confirmName: "Family Pool" } }), P());
      expect((await purgeExpiredPools(client)).purged).toEqual([]);
    } finally {
      await client.end();
    }
  });

  it("after the retention period the pool and all its records are purged; other pools are untouched", async () => {
    // Test clock: move the deletion 31 days into the past (the CHECK keeps purge_after >= deleted_at + 30 days).
    await db.query(
      "UPDATE qfinera_funds SET deleted_at = now() - interval '31 days', purge_after = now() - interval '1 day' WHERE id = $1",
      [poolId]
    );
    const client = new Client({ connectionString: db.url });
    await client.connect();
    try {
      const { purged, failed } = await purgeExpiredPools(client);
      expect(failed).toEqual([]);
      expect(purged.map((p) => String(p.fundId))).toEqual([poolId]);
    } finally {
      await client.end();
    }
    for (const t of ["qfinera_funds", "qfinera_fund_memberships", "qfinera_fund_audit_log", "qfinera_fund_ledger_entries", "qfinera_change_requests"]) {
      const col = t === "qfinera_funds" ? "id" : "fund_id";
      expect((await db.query(`SELECT COUNT(*)::int AS n FROM ${t} WHERE ${col} = $1`, [poolId])).rows[0].n, t).toBe(0);
    }
    const tomb = (await db.query("SELECT details FROM qfinance_admin_audit WHERE action = 'qfinera.pool.purged'")).rows[0];
    expect(tomb.details).toMatchObject({ fund_id: Number(poolId), name: "Family Pool" });
    expect((await db.query("SELECT COUNT(*)::int AS n FROM qfinera_funds WHERE id = $1", [otherPoolId])).rows[0].n).toBe(1);
    // The append-only guard is back in force.
    await expect(db.query("DELETE FROM qfinera_fund_audit_log WHERE fund_id = $1", [otherPoolId])).rejects.toThrow(/append-only/);
  });

  // ------------------------------------------------------- Global Watch

  let itemId = 0;
  const item = {
    title: "Capex announcement",
    summary: "Company announced a new plant; worth reading the investor presentation.",
    category: "STOCK",
    company: "Example Industries",
    tags: ["Capex", "manufacturing"],
    links: [{ url: "https://example.com/presentation.pdf", label: "Investor presentation", kind: "DOCUMENT" }],
  };

  it("publishing needs a signed-in account; published items are visible to every account", async () => {
    expect((await watchRoute.GET(request(null, "/api/qfinera/watch"))).status).toBe(401);
    const bad = await watchRoute.POST(request(member, "/api/qfinera/watch", { body: { ...item, links: [{ url: "javascript:alert(1)" }] } }));
    expect(bad.status).toBe(400);
    const r = await json(await watchRoute.POST(request(member, "/api/qfinera/watch", { body: item })));
    expect(r.status).toBe(201);
    itemId = r.body.data.item.id;
    expect(r.body.data.item.tags).toEqual(["capex", "manufacturing"]);
    const feed = await json(await watchRoute.GET(request(outsider, "/api/qfinera/watch?q=capex")));
    expect(feed.body.data.items.map((i: { id: number }) => i.id)).toContain(itemId);
  });

  it("the author edits; another user cannot", async () => {
    const own = await watchItemRoute.PATCH(request(member, `/api/qfinera/watch/${itemId}`, { method: "PATCH", body: { priority: "HIGH" } }), params({ id: String(itemId) }));
    expect(own.status).toBe(200);
    const other = await watchItemRoute.PATCH(request(outsider, `/api/qfinera/watch/${itemId}`, { method: "PATCH", body: { title: "Hijacked" } }), params({ id: String(itemId) }));
    expect(other.status).toBe(403);
    const del = await watchItemRoute.POST(request(outsider, `/api/qfinera/watch/${itemId}`, { body: { action: "delete" } }), params({ id: String(itemId) }));
    expect(del.status).toBe(403);
  });

  it("a platform MANAGER's edit/delete of another's item needs platform ADMIN approval; ADMIN acts directly", async () => {
    await db.query("UPDATE qfinance_users SET platform_role = 'MANAGER' WHERE id = $1", [manager.id]);
    await db.query("UPDATE qfinance_users SET platform_role = 'ADMIN' WHERE id = $1", [admin.id]);
    const id = params({ id: String(itemId) });

    const proposed = await json(await watchItemRoute.PATCH(request(manager, `/api/qfinera/watch/${itemId}`, { method: "PATCH", body: { title: "Capex plan (clarified)" } }), id));
    expect(proposed.status).toBe(202);
    expect((await db.query("SELECT title FROM qfinera_watch_items WHERE id = $1", [itemId])).rows[0].title).toBe("Capex announcement");
    const rid = proposed.body.data.request.id as number;
    expect((await watchRequestRoute.POST(request(manager, `/api/qfinera/watch/requests/${rid}`, { body: { action: "approve" } }), params({ id: String(rid) }))).status).toBe(403);
    expect((await watchRequestRoute.POST(request(admin, `/api/qfinera/watch/requests/${rid}`, { body: { action: "approve" } }), params({ id: String(rid) }))).status).toBe(200);
    expect((await db.query("SELECT title FROM qfinera_watch_items WHERE id = $1", [itemId])).rows[0].title).toBe("Capex plan (clarified)");

    // archiving is direct moderation for a manager, and reversible
    expect((await watchItemRoute.POST(request(manager, `/api/qfinera/watch/${itemId}`, { body: { action: "archive" } }), id)).status).toBe(200);
    const hidden = await json(await watchRoute.GET(request(outsider, "/api/qfinera/watch")));
    expect(hidden.body.data.items.map((i: { id: number }) => i.id)).not.toContain(itemId);
    expect((await watchItemRoute.GET(request(outsider, `/api/qfinera/watch/${itemId}`), id)).status).toBe(404);
    expect((await watchItemRoute.POST(request(admin, `/api/qfinera/watch/${itemId}`, { body: { action: "restore" } }), id)).status).toBe(200);

    const delProposal = await watchItemRoute.POST(request(manager, `/api/qfinera/watch/${itemId}`, { body: { action: "delete", reason: "Duplicate of another item" } }), id);
    expect(delProposal.status).toBe(202);
    const adminEdit = await watchItemRoute.PATCH(request(admin, `/api/qfinera/watch/${itemId}`, { method: "PATCH", body: { priority: "LOW" } }), id);
    expect(adminEdit.status).toBe(200);
  });

  it("the author deletes (soft); the item disappears for everyone but stays audited", async () => {
    const id = params({ id: String(itemId) });
    expect((await watchItemRoute.POST(request(member, `/api/qfinera/watch/${itemId}`, { body: { action: "delete" } }), id)).status).toBe(200);
    expect((await watchItemRoute.GET(request(member, `/api/qfinera/watch/${itemId}`), id)).status).toBe(404);
    expect((await db.query("SELECT status FROM qfinera_watch_items WHERE id = $1", [itemId])).rows[0].status).toBe("REMOVED");
    // the pending manager delete request was closed with it
    expect((await db.query("SELECT COUNT(*)::int AS n FROM qfinera_change_requests WHERE scope = 'platform' AND status = 'PENDING'")).rows[0].n).toBe(0);
    const audit = (await db.query("SELECT action FROM qfinera_fund_audit_log WHERE fund_id IS NULL AND entity_type = 'watch_item' AND entity_id = $1 ORDER BY id", [itemId])).rows.map((r) => r.action);
    expect(audit).toEqual(expect.arrayContaining(["watch.created", "watch.updated", "watch.archived", "watch.restored", "watch.deleted"]));
  });

  it("a platform ADMIN can delete another user's item directly", async () => {
    const r = await json(await watchRoute.POST(request(outsider, "/api/qfinera/watch", { body: { ...item, title: "Another note" } })));
    const id = params({ id: String(r.body.data.item.id) });
    expect((await watchItemRoute.POST(request(admin, `/api/qfinera/watch/${r.body.data.item.id}`, { body: { action: "delete", reason: "Off-topic" } }), id)).status).toBe(200);
  });
});
