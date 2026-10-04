// Join requests: a VIEWER asks to become a MEMBER of the pool.
//
//   create    VIEWER (members:request_join), with an optional note. One open
//             request per person (unique index).
//   withdraw  the requester.
//   review    MANAGER or ADMIN (join_requests:review).
//               ADMIN approve   -> the role becomes MEMBER at once.
//               MANAGER approve -> a "member.update" change request; the
//                                  role changes only when an ADMIN approves.
//               reject (either) -> closed; nothing about the membership
//                                  changes, so no admin approval is needed.
// Every step is audited. The viewer's identity always comes from the session.
import { writeAudit } from "@/lib/fund/audit";
import { insertChangeRequest, type ChangeRequest } from "@/lib/fund/change-request-store";
import { inTransaction, lockFund, one, type Db } from "@/lib/fund/db";
import { conflictError, notFoundError } from "@/lib/fund/errors";
import { assertPermission, hasPermission } from "@/lib/fund/rbac";
import { loadMembership, updateMemberInDb } from "@/lib/fund/services/members";
import { assertFundActive, isUniqueViolation, type ServiceCtx } from "@/lib/fund/services/types";

export type JoinRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN";

export type JoinRequest = {
  id: number;
  userId: number;
  displayName: string | null;
  note: string | null;
  status: JoinRequestStatus;
  /** Set while a MANAGER's approval waits for an ADMIN. */
  changeRequestId: number | null;
  reviewedByName: string | null;
  reviewedAt: Date | null;
  reviewReason: string | null;
  createdAt: Date;
};

type Row = {
  id: number;
  user_id: number;
  display_name: string | null;
  note: string | null;
  status: JoinRequestStatus;
  change_request_id: number | null;
  reviewed_by_name: string | null;
  reviewed_at: Date | null;
  review_reason: string | null;
  created_at: Date;
};

const SELECT = `
  SELECT j.id, j.user_id, u.display_name, j.note, j.status, j.change_request_id, r.display_name AS reviewed_by_name,
         j.reviewed_at, j.review_reason, j.created_at
    FROM qfinera_fund_join_requests j
    JOIN qfinance_users u ON u.id = j.user_id
    LEFT JOIN qfinance_users r ON r.id = j.reviewed_by`;

function toJoinRequest(r: Row): JoinRequest {
  return {
    id: r.id,
    userId: r.user_id,
    displayName: r.display_name,
    note: r.note,
    status: r.status,
    changeRequestId: r.change_request_id,
    reviewedByName: r.reviewed_by_name,
    reviewedAt: r.reviewed_at,
    reviewReason: r.review_reason,
    createdAt: r.created_at,
  };
}

/** Reviewers see every request; a viewer sees only their own. */
export async function listJoinRequests(db: Db, ctx: ServiceCtx, opts: { openOnly?: boolean } = {}): Promise<JoinRequest[]> {
  const mineOnly = !hasPermission(ctx.actor, "join_requests:review");
  const { rows } = await db.query<Row>(
    `${SELECT}
      WHERE j.fund_id = $1 AND ($2::int IS NULL OR j.user_id = $2) AND (NOT $3::boolean OR j.status = 'PENDING')
      ORDER BY (j.status = 'PENDING') DESC, j.created_at DESC LIMIT 100`,
    [ctx.fundId, mineOnly ? ctx.actor.userId : null, opts.openOnly === true]
  );
  return rows.map(toJoinRequest);
}

export async function createJoinRequest(ctx: ServiceCtx, note: string | null): Promise<JoinRequest> {
  assertPermission(ctx.actor, "members:request_join");
  try {
    return await inTransaction(async (db) => {
      await assertFundActive(db, ctx.fundId);
      const ins = await one<{ id: number }>(
        db,
        "INSERT INTO qfinera_fund_join_requests (fund_id, user_id, note) VALUES ($1, $2, $3) RETURNING id",
        [ctx.fundId, ctx.actor.userId, note]
      );
      if (!ins) throw new Error("join request insert returned no row");
      await writeAudit(db, {
        fundId: ctx.fundId,
        userId: ctx.actor.userId,
        action: "join_request.created",
        entityType: "join_request",
        entityId: ins.id,
        after: { status: "PENDING", requested_role: "MEMBER", note },
        meta: ctx.meta,
      });
      return toJoinRequest((await one<Row>(db, `${SELECT} WHERE j.id = $1`, [ins.id])) as Row);
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw conflictError("You already have a request waiting for review.");
    throw err;
  }
}

async function lockRequest(db: Db, fundId: number, id: number): Promise<Row & { fund_id: number }> {
  const row = await one<Row & { fund_id: number }>(
    db,
    `${SELECT.replace("SELECT j.id", "SELECT j.fund_id, j.id")} WHERE j.id = $1 AND j.fund_id = $2 FOR UPDATE OF j`,
    [id, fundId]
  );
  if (!row) throw notFoundError("Request");
  return row;
}

export async function withdrawJoinRequest(ctx: ServiceCtx, id: number): Promise<JoinRequest> {
  return inTransaction(async (db) => {
    const row = await lockRequest(db, ctx.fundId, id);
    // Someone else's request does not exist for you.
    if (row.user_id !== ctx.actor.userId) throw notFoundError("Request");
    if (row.status !== "PENDING") throw conflictError("This request is no longer pending.");
    if (row.change_request_id) {
      await db.query(
        `UPDATE qfinera_change_requests SET status = 'CANCELLED', reviewed_by = $2, reviewed_at = now(),
                review_reason = 'The join request was withdrawn', updated_at = now()
          WHERE id = $1 AND status = 'PENDING'`,
        [row.change_request_id, ctx.actor.userId]
      );
    }
    await db.query(
      `UPDATE qfinera_fund_join_requests SET status = 'WITHDRAWN', reviewed_by = $2, reviewed_at = now() WHERE id = $1`,
      [id, ctx.actor.userId]
    );
    await writeAudit(db, {
      fundId: ctx.fundId,
      userId: ctx.actor.userId,
      action: "join_request.withdrawn",
      entityType: "join_request",
      entityId: id,
      before: { status: "PENDING" },
      after: { status: "WITHDRAWN" },
      meta: ctx.meta,
    });
    return toJoinRequest((await one<Row>(db, `${SELECT} WHERE j.id = $1`, [id])) as Row);
  });
}

export type JoinReviewResult = { joinRequest: JoinRequest; pendingApproval: ChangeRequest | null };

export async function reviewJoinRequest(
  ctx: ServiceCtx,
  id: number,
  decision: "approve" | "reject",
  reason: string | null
): Promise<JoinReviewResult> {
  assertPermission(ctx.actor, "join_requests:review");
  return inTransaction(async (db) => {
    await lockFund(db, ctx.fundId);
    const row = await lockRequest(db, ctx.fundId, id);
    if (row.status !== "PENDING") throw conflictError("This request is no longer pending.");
    if (row.change_request_id && decision === "approve") {
      throw conflictError("This request is already waiting for an administrator's approval.");
    }
    const membership = await loadMembership(db, ctx.fundId, row.user_id);
    if (!membership || membership.status !== "active" || membership.role !== "VIEWER") {
      throw conflictError("This person is no longer an active viewer of the pool.");
    }

    let pendingApproval: ChangeRequest | null = null;
    if (decision === "reject") {
      await db.query(
        `UPDATE qfinera_fund_join_requests SET status = 'REJECTED', reviewed_by = $2, reviewed_at = now(), review_reason = $3
          WHERE id = $1`,
        [id, ctx.actor.userId, reason]
      );
      if (row.change_request_id) {
        await db.query(
          `UPDATE qfinera_change_requests SET status = 'CANCELLED', reviewed_by = $2, reviewed_at = now(),
                  review_reason = 'The join request was rejected', updated_at = now()
            WHERE id = $1 AND status = 'PENDING'`,
          [row.change_request_id, ctx.actor.userId]
        );
      }
      await writeAudit(db, {
        fundId: ctx.fundId,
        userId: ctx.actor.userId,
        action: "join_request.rejected",
        entityType: "join_request",
        entityId: id,
        before: { status: "PENDING" },
        after: { status: "REJECTED" },
        reason,
        meta: ctx.meta,
      });
    } else if (hasPermission(ctx.actor, "members:change_role")) {
      // ADMIN: the role change itself settles the request (updateMemberInDb).
      await updateMemberInDb(db, ctx, row.user_id, {
        role: "MEMBER",
        reason: reason ?? `Join request #${id} approved`,
      });
      await writeAudit(db, {
        fundId: ctx.fundId,
        userId: ctx.actor.userId,
        action: "join_request.approved",
        entityType: "join_request",
        entityId: id,
        before: { status: "PENDING", role: "VIEWER" },
        after: { status: "APPROVED", role: "MEMBER" },
        reason,
        meta: ctx.meta,
      });
    } else {
      // MANAGER: recommend; an ADMIN makes the change.
      pendingApproval = await insertChangeRequest(db, {
        scope: "fund",
        fundId: ctx.fundId,
        action: "member.update",
        entityType: "member",
        entityId: row.user_id,
        payload: { role: "MEMBER", reason: reason ?? `Join request #${id}`, joinRequestId: id },
        beforeState: { role: membership.role, status: membership.status, display_name: membership.display_name },
        proposedState: { role: "MEMBER" },
        reason: reason ?? `Approve join request #${id} from ${membership.display_name}`,
        requestedBy: ctx.actor.userId,
        meta: ctx.meta,
      });
      await db.query("UPDATE qfinera_fund_join_requests SET change_request_id = $2 WHERE id = $1", [id, pendingApproval.id]);
    }
    const joinRequest = toJoinRequest((await one<Row>(db, `${SELECT} WHERE j.id = $1`, [id])) as Row);
    return { joinRequest, pendingApproval };
  });
}
