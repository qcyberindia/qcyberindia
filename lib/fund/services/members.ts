// Pool membership administration (people join through invites:
// lib/fund/services/invites.ts).
//
//   update  ADMIN changes a role, suspends/reactivates, or removes a member.
//           Nobody can change their own membership, and the pool always
//           keeps at least one active ADMIN. Suspension blocks access; it
//           never touches units or history. Removal needs zero units and no
//           open requests (withdraw first); the membership row and all history
//           are kept with status 'removed', and the person can be re-invited.
import { writeAudit } from "@/lib/fund/audit";
import { inTransaction, lockFund, one } from "@/lib/fund/db";
import { FundError, conflictError, notFoundError } from "@/lib/fund/errors";
import { assertPermission, type FundMembershipStatus, type FundRole } from "@/lib/fund/rbac";
import { getMemberUnits } from "@/lib/fund/state";
import type { ServiceCtx } from "@/lib/fund/services/types";

type MembershipRow = { user_id: number; role: FundRole; status: FundMembershipStatus; display_name: string };

export async function updateMember(
  ctx: ServiceCtx,
  userId: number,
  patch: { role?: FundRole; status?: FundMembershipStatus; reason: string | null }
): Promise<{ userId: number; role: FundRole; status: FundMembershipStatus }> {
  if (patch.role !== undefined) assertPermission(ctx.actor, "members:change_role");
  if (patch.status !== undefined) assertPermission(ctx.actor, "members:suspend");
  if (patch.role === undefined && patch.status === undefined) assertPermission(ctx.actor, "members:change_role");
  if (userId === ctx.actor.userId) {
    throw new FundError("FORBIDDEN", "You cannot change your own role or status. Ask another administrator.", 403);
  }

  return inTransaction(async (db) => {
    await lockFund(db, ctx.fundId);
    const before = await one<MembershipRow>(
      db,
      `SELECT m.user_id, m.role, m.status, u.display_name FROM qfinera_fund_memberships m
         JOIN qfinance_users u ON u.id = m.user_id
        WHERE m.fund_id = $1 AND m.user_id = $2 FOR UPDATE OF m`,
      [ctx.fundId, userId]
    );
    if (!before) throw notFoundError("Member");

    if (before.status === "removed") {
      throw conflictError("This person was removed from the pool. Send them a new invite to bring them back.");
    }
    const role = patch.role ?? before.role;
    const status = patch.status ?? before.status;
    if (role === before.role && status === before.status) throw conflictError("Nothing to change.");

    if (status === "removed") {
      const units = await getMemberUnits(db, ctx.fundId, userId);
      if (!units.isZero()) {
        throw conflictError(`This member still holds ${units.toDecimalString(4)} units. They must withdraw fully before removal.`);
      }
      const open = await one<{ n: number }>(
        db,
        `SELECT ((SELECT COUNT(*) FROM qfinera_fund_contributions
                   WHERE fund_id = $1 AND member_id = $2 AND status IN ('PENDING', 'APPROVED', 'AWAITING_NAV'))
               + (SELECT COUNT(*) FROM qfinera_fund_withdrawals
                   WHERE fund_id = $1 AND member_id = $2 AND status IN ('REQUESTED', 'APPROVED', 'AWAITING_NAV')))::int AS n`,
        [ctx.fundId, userId]
      );
      if ((open?.n ?? 0) > 0) throw conflictError("This member has open contributions or withdrawals. Resolve them first.");
    }

    if (before.role === "ADMIN" && before.status === "active" && (role !== "ADMIN" || status !== "active")) {
      const admins = await one<{ n: number }>(
        db,
        `SELECT COUNT(*)::int AS n FROM qfinera_fund_memberships
          WHERE fund_id = $1 AND role = 'ADMIN' AND status = 'active' AND user_id <> $2`,
        [ctx.fundId, userId]
      );
      if ((admins?.n ?? 0) === 0) throw conflictError("The fund must keep at least one active administrator.");
    }

    await db.query(
      `UPDATE qfinera_fund_memberships
          SET role = $3, status = $4, updated_at = now(),
              removed_at = CASE WHEN $4 = 'removed' THEN now() ELSE NULL END,
              removed_by = CASE WHEN $4 = 'removed' THEN $5::int ELSE NULL END
        WHERE fund_id = $1 AND user_id = $2`,
      [ctx.fundId, userId, role, status, ctx.actor.userId]
    );
    await writeAudit(db, {
      fundId: ctx.fundId,
      userId: ctx.actor.userId,
      action:
        status === before.status
          ? "member.role_changed"
          : status === "removed"
            ? "member.removed"
            : status === "suspended"
              ? "member.suspended"
              : "member.reactivated",
      entityType: "member",
      entityId: userId,
      before: { role: before.role, status: before.status },
      after: { role, status },
      reason: patch.reason,
      meta: ctx.meta,
    });
    return { userId, role, status };
  });
}
