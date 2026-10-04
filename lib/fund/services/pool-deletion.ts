// Pool deletion with a 30-day retention period.
//
//   scheduleDeletion  ADMIN (pool:delete). The caller must type the pool's
//                     exact name. Nothing is erased: the pool is marked
//                     deleted, becomes invisible and inaccessible to every
//                     member (lib/fund/auth.ts ignores deleted pools), and is
//                     scheduled for purge 30 days later.
//   restorePool       ADMIN of that pool, any time before the purge. The
//                     pool comes back exactly as it was.
//   purge             lib/fund/pool-purge.ts, run periodically; the database
//                     refuses to purge a pool that is not deleted and past
//                     its retention period.
//
// A deleted pool cannot be reached through poolRoute(), so restore has its
// own entry point (restorePool) that checks the caller's ADMIN membership
// directly.
import { writeAudit, type RequestMeta } from "@/lib/fund/audit";
import { inTransaction, one, type Db } from "@/lib/fund/db";
import { FundError, conflictError, notFoundError, validationError } from "@/lib/fund/errors";
import { assertPermission } from "@/lib/fund/rbac";
import type { ServiceCtx } from "@/lib/fund/services/types";

export const DELETION_RETENTION_DAYS = 30;

export type DeletionInput = { confirmName: string; reason: string | null };

export type DeletedPool = {
  id: number;
  name: string;
  deletedAt: Date;
  deletedByName: string | null;
  deletionReason: string | null;
  purgeAfter: Date;
};

/** Exact match after trimming; case matters, so the name was really typed. */
export function confirmationMatches(poolName: string, typed: string): boolean {
  return typed.trim() === poolName.trim() && poolName.trim().length > 0;
}

/** When a pool deleted at `deletedAt` may be purged. */
export function purgeDate(deletedAt: Date): Date {
  return new Date(deletedAt.getTime() + DELETION_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

export async function scheduleDeletion(ctx: ServiceCtx, input: DeletionInput): Promise<DeletedPool> {
  assertPermission(ctx.actor, "pool:delete");
  return inTransaction(async (db) => {
    const pool = await one<{ id: number; name: string; status: string; deleted_at: Date | null }>(
      db,
      "SELECT id, name, status, deleted_at FROM qfinera_funds WHERE id = $1 FOR UPDATE",
      [ctx.fundId]
    );
    if (!pool) throw notFoundError("Pool");
    if (pool.deleted_at) throw conflictError("This pool is already scheduled for deletion.");
    if (!confirmationMatches(pool.name, input.confirmName)) {
      throw validationError("Type the pool's name exactly to confirm.", { confirmName: "Does not match the pool name" });
    }

    // Open requests would otherwise wait on a pool nobody can open.
    await db.query(
      `UPDATE qfinera_change_requests SET status = 'CANCELLED', reviewed_by = $2, reviewed_at = now(),
              review_reason = 'Pool scheduled for deletion', updated_at = now()
        WHERE fund_id = $1 AND status = 'PENDING'`,
      [ctx.fundId, ctx.actor.userId]
    );
    await db.query(
      `UPDATE qfinera_fund_invites SET revoked_at = now(), revoked_by = $2
        WHERE fund_id = $1 AND used_at IS NULL AND revoked_at IS NULL`,
      [ctx.fundId, ctx.actor.userId]
    );

    const row = await one<{ deleted_at: Date; purge_after: Date }>(
      db,
      `UPDATE qfinera_funds
          SET deleted_at = now(), deleted_by = $2, deletion_reason = $3,
              purge_after = now() + make_interval(days => $4), updated_at = now()
        WHERE id = $1 RETURNING deleted_at, purge_after`,
      [ctx.fundId, ctx.actor.userId, input.reason, DELETION_RETENTION_DAYS]
    );
    if (!row) throw new Error("pool deletion update returned no row");
    await writeAudit(db, {
      fundId: ctx.fundId,
      userId: ctx.actor.userId,
      action: "pool.deletion_scheduled",
      entityType: "pool",
      entityId: ctx.fundId,
      before: { name: pool.name, deleted_at: null },
      after: { name: pool.name, deleted_at: row.deleted_at.toISOString(), purge_after: row.purge_after.toISOString() },
      reason: input.reason,
      meta: ctx.meta,
    });
    return {
      id: pool.id,
      name: pool.name,
      deletedAt: row.deleted_at,
      deletedByName: null,
      deletionReason: input.reason,
      purgeAfter: row.purge_after,
    };
  });
}

/** Restores a deleted pool. The caller must be an ACTIVE ADMIN of it. */
export async function restorePool(user: { userId: number; meta?: RequestMeta | null }, fundId: number): Promise<{ id: number; name: string }> {
  return inTransaction(async (db) => {
    const membership = await one<{ role: string; status: string }>(
      db,
      "SELECT role, status FROM qfinera_fund_memberships WHERE fund_id = $1 AND user_id = $2",
      [fundId, user.userId]
    );
    // Not an admin of this pool: indistinguishable from "no such pool".
    if (!membership || membership.status !== "active" || membership.role !== "ADMIN") throw notFoundError("Pool");

    const pool = await one<{ name: string; deleted_at: Date | null; purge_after: Date | null }>(
      db,
      "SELECT name, deleted_at, purge_after FROM qfinera_funds WHERE id = $1 FOR UPDATE",
      [fundId]
    );
    if (!pool) throw notFoundError("Pool");
    if (!pool.deleted_at) throw conflictError("This pool is not deleted.");
    if (pool.purge_after && pool.purge_after.getTime() <= Date.now()) {
      throw new FundError("CONFLICT", "The retention period has ended; this pool can no longer be restored.", 409);
    }
    await db.query(
      `UPDATE qfinera_funds SET deleted_at = NULL, deleted_by = NULL, deletion_reason = NULL, purge_after = NULL, updated_at = now()
        WHERE id = $1`,
      [fundId]
    );
    await writeAudit(db, {
      fundId,
      userId: user.userId,
      action: "pool.restored",
      entityType: "pool",
      entityId: fundId,
      before: { deleted_at: pool.deleted_at.toISOString(), purge_after: pool.purge_after?.toISOString() ?? null },
      after: { deleted_at: null },
      meta: user.meta,
    });
    return { id: fundId, name: pool.name };
  });
}

/** Deleted pools the user administers (the only people who can restore them). */
export async function listDeletedPoolsFor(db: Db, userId: number): Promise<DeletedPool[]> {
  const { rows } = await db.query<{
    id: number;
    name: string;
    deleted_at: Date;
    deleted_by_name: string | null;
    deletion_reason: string | null;
    purge_after: Date;
  }>(
    `SELECT f.id, f.name, f.deleted_at, u.display_name AS deleted_by_name, f.deletion_reason, f.purge_after
       FROM qfinera_fund_memberships m
       JOIN qfinera_funds f ON f.id = m.fund_id
       LEFT JOIN qfinance_users u ON u.id = f.deleted_by
      WHERE m.user_id = $1 AND m.role = 'ADMIN' AND m.status = 'active'
        AND f.deleted_at IS NOT NULL AND f.purge_after > now()
      ORDER BY f.purge_after`,
    [userId]
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    deletedAt: r.deleted_at,
    deletedByName: r.deleted_by_name,
    deletionReason: r.deletion_reason,
    purgeAfter: r.purge_after,
  }));
}
