// Pools: the tenant of QFinera's private pooled accounting. A pool is a row
// of qfinera_funds; everything financial is keyed by its id, so pools are
// isolated from each other at the data level, and every request is
// authorized against the caller's membership of THAT pool (lib/fund/auth.ts).
//
//   createPool   any active QFinera account. The creator becomes the pool's
//                ADMIN. The pool starts with zero capital and zero units at
//                the initial NAV of 10.0000 (accounting rules, section 6).
//   listMyPools  only pools the caller is a (non-removed) member of.
import { Money } from "@/lib/accounting/money";
import { writeAudit } from "@/lib/fund/audit";
import { memberValue } from "@/lib/fund/metrics";
import { inTransaction, one, type Db } from "@/lib/fund/db";
import { FundError, conflictError, validationError } from "@/lib/fund/errors";
import type { FundRole } from "@/lib/fund/rbac";
import { MAX_POOLS_CREATED_PER_USER, PARTICIPATION_MODE } from "@/lib/fund/product-gate";
import type { RequestMeta } from "@/lib/fund/audit";

export type PoolSummary = {
  id: number;
  name: string;
  description: string | null;
  status: string;
  role: FundRole;
  membershipStatus: string;
  memberCount: number;
  latestNav: { date: string; nav: string } | null;
  myUnits: string;
  /** My units at the latest official NAV; null before the first NAV. */
  myValue: string | null;
  lastActivityAt: Date | null;
  createdAt: Date;
};

export async function listMyPools(db: Db, userId: number): Promise<PoolSummary[]> {
  const { rows } = await db.query<{
    id: number;
    name: string;
    description: string | null;
    status: string;
    role: FundRole;
    membership_status: string;
    member_count: number;
    nav_date: string | null;
    nav: string | null;
    units: string;
    last_activity_at: Date | null;
    created_at: Date;
  }>(
    `SELECT f.id, f.name, f.description, f.status, m.role, m.status AS membership_status,
            (SELECT COUNT(*) FROM qfinera_fund_memberships x WHERE x.fund_id = f.id AND x.status = 'active')::int AS member_count,
            n.as_of_date::text AS nav_date, n.nav::text AS nav, m.units::text AS units, f.created_at,
            (SELECT MAX(a.created_at) FROM qfinera_fund_audit_log a WHERE a.fund_id = f.id) AS last_activity_at
       FROM qfinera_fund_memberships m
       JOIN qfinera_funds f ON f.id = m.fund_id
       LEFT JOIN LATERAL (
         SELECT as_of_date, nav FROM qfinera_fund_nav_snapshots s
          WHERE s.fund_id = f.id AND s.is_official ORDER BY as_of_date DESC LIMIT 1
       ) n ON true
      WHERE m.user_id = $1 AND m.status <> 'removed' AND f.deleted_at IS NULL
      ORDER BY f.status, f.name, f.id`,
    [userId]
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    status: r.status,
    role: r.role,
    membershipStatus: r.membership_status,
    memberCount: r.member_count,
    latestNav: r.nav_date && r.nav ? { date: r.nav_date, nav: r.nav } : null,
    myUnits: r.units,
    myValue: memberValue(Money.fromDecimalString(r.units), r.nav ? Money.fromDecimalString(r.nav) : null)?.toDecimalString(2) ?? null,
    lastActivityAt: r.last_activity_at,
    createdAt: r.created_at,
  }));
}

export async function createPool(
  user: { userId: number; meta?: RequestMeta | null },
  input: { name: string; description: string | null; acknowledgePrivate: boolean }
): Promise<{ id: number; name: string }> {
  if (!input.acknowledgePrivate) {
    throw validationError("Confirm that this pool is private and invite-only.", { acknowledgePrivate: "Required" });
  }
  return inTransaction(async (db) => {
    // Serialize this user's pool creation so the limit cannot be raced.
    const account = await one<{ status: string }>(db, "SELECT status FROM qfinance_users WHERE id = $1 FOR UPDATE", [
      user.userId,
    ]);
    if (account?.status !== "active") throw new FundError("FORBIDDEN", "Your QFinera account is not active.", 403);

    const created = await one<{ n: number }>(db, "SELECT COUNT(*)::int AS n FROM qfinera_funds WHERE created_by = $1", [
      user.userId,
    ]);
    if ((created?.n ?? 0) >= MAX_POOLS_CREATED_PER_USER) {
      throw conflictError(`You can create at most ${MAX_POOLS_CREATED_PER_USER} pools.`);
    }

    const pool = await one<{ id: number; name: string }>(
      db,
      `INSERT INTO qfinera_funds (name, description, created_by, participation_mode)
       VALUES ($1, $2, $3, $4) RETURNING id, name`,
      [input.name, input.description, user.userId, PARTICIPATION_MODE]
    );
    if (!pool) throw new Error("pool insert returned no row");
    await db.query(
      `INSERT INTO qfinera_fund_memberships (fund_id, user_id, role, status, units) VALUES ($1, $2, 'ADMIN', 'active', 0)`,
      [pool.id, user.userId]
    );
    await db.query("INSERT INTO qfinera_fund_settings (fund_id, updated_by) VALUES ($1, $2)", [pool.id, user.userId]);
    await writeAudit(db, {
      fundId: pool.id,
      userId: user.userId,
      action: "pool.created",
      entityType: "pool",
      entityId: pool.id,
      after: { name: input.name, description: input.description, participation_mode: PARTICIPATION_MODE, acknowledged_private: true },
      meta: user.meta,
    });
    return pool;
  });
}
