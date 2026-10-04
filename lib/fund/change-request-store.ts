// Persistence for change requests (qfinera_change_requests, migration 015):
// a change a MANAGER proposed that only an ADMIN can approve. One table and
// one lifecycle for every kind of change; what a request DOES is decided by
// the action registry (lib/fund/services/change-requests.ts), which this
// module deliberately does not import, so services can create requests
// without an import cycle.
//
//   PENDING ──approve──▶ EXECUTING ──ok──▶ APPROVED
//      │                     └──error──▶ PENDING (last_error set)
//      ├──reject──▶ REJECTED
//      └──cancel (requester)──▶ CANCELLED
//
// EXECUTING is a claim: the UPDATE ... WHERE status = 'PENDING' lets exactly
// one reviewer run a request, so a double click or two admins approving at
// once can never apply a change twice.
import { writeAudit, type RequestMeta } from "@/lib/fund/audit";
import { inTransaction, one, type Db } from "@/lib/fund/db";
import { conflictError, notFoundError } from "@/lib/fund/errors";
import { isUniqueViolation } from "@/lib/fund/services/types";

export type ChangeRequestScope = "fund" | "platform";
export type ChangeRequestStatus = "PENDING" | "EXECUTING" | "APPROVED" | "REJECTED" | "CANCELLED";

export type ChangeRequest = {
  id: number;
  scope: ChangeRequestScope;
  fundId: number | null;
  action: string;
  entityType: string;
  entityId: number | null;
  payload: Record<string, unknown>;
  beforeState: Record<string, unknown> | null;
  proposedState: Record<string, unknown> | null;
  reason: string | null;
  status: ChangeRequestStatus;
  requestedBy: number;
  requestedByName: string | null;
  reviewedBy: number | null;
  reviewedByName: string | null;
  reviewedAt: Date | null;
  reviewReason: string | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type Row = {
  id: number;
  scope: ChangeRequestScope;
  fund_id: number | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  payload: Record<string, unknown>;
  before_state: Record<string, unknown> | null;
  proposed_state: Record<string, unknown> | null;
  reason: string | null;
  status: ChangeRequestStatus;
  requested_by: number;
  requested_by_name: string | null;
  reviewed_by: number | null;
  reviewed_by_name: string | null;
  reviewed_at: Date | null;
  review_reason: string | null;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
};

const SELECT = `
  SELECT r.id, r.scope, r.fund_id, r.action, r.entity_type, r.entity_id, r.payload, r.before_state, r.proposed_state,
         r.reason, r.status, r.requested_by, ru.display_name AS requested_by_name, r.reviewed_by,
         vu.display_name AS reviewed_by_name, r.reviewed_at, r.review_reason, r.last_error, r.created_at, r.updated_at
    FROM qfinera_change_requests r
    LEFT JOIN qfinance_users ru ON ru.id = r.requested_by
    LEFT JOIN qfinance_users vu ON vu.id = r.reviewed_by`;

function toRequest(r: Row): ChangeRequest {
  return {
    id: r.id,
    scope: r.scope,
    fundId: r.fund_id,
    action: r.action,
    entityType: r.entity_type,
    entityId: r.entity_id,
    payload: r.payload ?? {},
    beforeState: r.before_state,
    proposedState: r.proposed_state,
    reason: r.reason,
    status: r.status,
    requestedBy: r.requested_by,
    requestedByName: r.requested_by_name,
    reviewedBy: r.reviewed_by,
    reviewedByName: r.reviewed_by_name,
    reviewedAt: r.reviewed_at,
    reviewReason: r.review_reason,
    lastError: r.last_error,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Audit rows of platform-scope requests have fund_id NULL. */
function auditFundId(scope: ChangeRequestScope, fundId: number | null): number | null {
  return scope === "fund" ? fundId : null;
}

export type NewChangeRequest = {
  scope: ChangeRequestScope;
  fundId: number | null;
  action: string;
  entityType: string;
  entityId: number | null;
  payload: Record<string, unknown>;
  beforeState: Record<string, unknown> | null;
  proposedState: Record<string, unknown> | null;
  reason: string | null;
  requestedBy: number;
  meta?: RequestMeta | null;
};

/** Inserts a PENDING request (and its audit row) using the caller's transaction. */
export async function insertChangeRequest(db: Db, input: NewChangeRequest): Promise<ChangeRequest> {
  let id: number;
  try {
    const row = await one<{ id: number }>(
      db,
      `INSERT INTO qfinera_change_requests
         (scope, fund_id, action, entity_type, entity_id, payload, before_state, proposed_state, reason, requested_by)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10) RETURNING id`,
      [
        input.scope,
        input.fundId,
        input.action,
        input.entityType,
        input.entityId,
        JSON.stringify(input.payload),
        input.beforeState ? JSON.stringify(input.beforeState) : null,
        input.proposedState ? JSON.stringify(input.proposedState) : null,
        input.reason,
        input.requestedBy,
      ]
    );
    if (!row) throw new Error("change request insert returned no row");
    id = row.id;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw conflictError("The same change is already waiting for administrator approval.");
    }
    throw err;
  }
  await writeAudit(db, {
    fundId: auditFundId(input.scope, input.fundId),
    userId: input.requestedBy,
    action: "change_request.created",
    entityType: "change_request",
    entityId: id,
    before: input.beforeState,
    after: { action: input.action, entity_type: input.entityType, entity_id: input.entityId, ...(input.proposedState ?? {}) },
    reason: input.reason,
    meta: input.meta,
  });
  const created = await one<Row>(db, `${SELECT} WHERE r.id = $1`, [id]);
  if (!created) throw new Error("change request not found after insert");
  return toRequest(created);
}

export async function createChangeRequest(input: NewChangeRequest): Promise<ChangeRequest> {
  return inTransaction((db) => insertChangeRequest(db, input));
}

export type ChangeRequestFilter = {
  scope: ChangeRequestScope;
  fundId: number | null;
  status: "open" | "closed" | "all";
  /** Restrict to one requester (a MANAGER sees their own; an ADMIN sees all). */
  requestedBy: number | null;
  limit: number;
};

export async function listChangeRequests(db: Db, f: ChangeRequestFilter): Promise<ChangeRequest[]> {
  const statuses =
    f.status === "open" ? ["PENDING", "EXECUTING"] : f.status === "closed" ? ["APPROVED", "REJECTED", "CANCELLED"] : null;
  const { rows } = await db.query<Row>(
    `${SELECT}
      WHERE r.scope = $1
        AND (($1 = 'fund' AND r.fund_id = $2) OR ($1 = 'platform' AND r.fund_id IS NULL))
        AND ($3::text[] IS NULL OR r.status = ANY($3::text[]))
        AND ($4::int IS NULL OR r.requested_by = $4)
      ORDER BY (r.status IN ('PENDING', 'EXECUTING')) DESC, r.created_at DESC, r.id DESC
      LIMIT $5`,
    [f.scope, f.fundId, statuses, f.requestedBy, f.limit]
  );
  return rows.map(toRequest);
}

export async function countOpenChangeRequests(db: Db, scope: ChangeRequestScope, fundId: number | null): Promise<number> {
  const row = await one<{ n: number }>(
    db,
    `SELECT COUNT(*)::int AS n FROM qfinera_change_requests
      WHERE scope = $1 AND (($1 = 'fund' AND fund_id = $2) OR ($1 = 'platform' AND fund_id IS NULL)) AND status = 'PENDING'`,
    [scope, fundId]
  );
  return row?.n ?? 0;
}

/** A request in the given scope, or 404 (a request of another pool does not exist for you). */
export async function getChangeRequest(db: Db, scope: ChangeRequestScope, fundId: number | null, id: number): Promise<ChangeRequest> {
  const row = await one<Row>(
    db,
    `${SELECT} WHERE r.id = $1 AND r.scope = $2 AND (($2 = 'fund' AND r.fund_id = $3) OR ($2 = 'platform' AND r.fund_id IS NULL))`,
    [id, scope, fundId]
  );
  if (!row) throw notFoundError("Request");
  return toRequest(row);
}

/** Requests stuck in EXECUTING longer than this (a crashed process) can be claimed again. */
const STALE_CLAIM_MINUTES = 10;

/** Claims a PENDING request for execution. Throws if it is no longer open. */
export async function claimChangeRequest(scope: ChangeRequestScope, fundId: number | null, id: number, reviewerId: number): Promise<ChangeRequest> {
  return inTransaction(async (db) => {
    const current = await getChangeRequest(db, scope, fundId, id);
    const row = await one<Row>(
      db,
      `UPDATE qfinera_change_requests
          SET status = 'EXECUTING', reviewed_by = $2, updated_at = now()
        WHERE id = $1
          AND (status = 'PENDING' OR (status = 'EXECUTING' AND updated_at < now() - make_interval(mins => $3)))
        RETURNING id`,
      [id, reviewerId, STALE_CLAIM_MINUTES]
    );
    if (!row) {
      throw conflictError(
        current.status === "EXECUTING" ? "This request is being applied right now." : "This request was already reviewed."
      );
    }
    return current;
  });
}

/** Marks a claimed request APPROVED and audits the approval. */
export async function completeChangeRequest(
  req: ChangeRequest,
  reviewer: { userId: number; meta?: RequestMeta | null },
  reviewReason: string | null,
  result: Record<string, unknown> | null
): Promise<ChangeRequest> {
  return inTransaction(async (db) => {
    await db.query(
      `UPDATE qfinera_change_requests
          SET status = 'APPROVED', reviewed_by = $2, reviewed_at = now(), review_reason = $3, result = $4::jsonb,
              last_error = NULL, updated_at = now()
        WHERE id = $1 AND status = 'EXECUTING'`,
      [req.id, reviewer.userId, reviewReason, result ? JSON.stringify(result) : null]
    );
    await writeAudit(db, {
      fundId: auditFundId(req.scope, req.fundId),
      userId: reviewer.userId,
      action: "change_request.approved",
      entityType: "change_request",
      entityId: req.id,
      before: { status: "PENDING" },
      after: { status: "APPROVED", action: req.action, entity_type: req.entityType, entity_id: req.entityId, requested_by: req.requestedBy },
      reason: reviewReason,
      meta: reviewer.meta,
    });
    const row = await one<Row>(db, `${SELECT} WHERE r.id = $1`, [req.id]);
    return toRequest(row as Row);
  });
}

/** Execution failed: the request goes back to PENDING with the (safe) error message. */
export async function releaseChangeRequest(id: number, message: string): Promise<void> {
  await inTransaction(async (db) => {
    await db.query(
      `UPDATE qfinera_change_requests SET status = 'PENDING', reviewed_by = NULL, last_error = $2, updated_at = now()
        WHERE id = $1 AND status = 'EXECUTING'`,
      [id, message.slice(0, 500)]
    );
  });
}

/** REJECTED (by a reviewer) or CANCELLED (by the requester). */
export async function closeChangeRequest(
  scope: ChangeRequestScope,
  fundId: number | null,
  id: number,
  outcome: "REJECTED" | "CANCELLED",
  actor: { userId: number; meta?: RequestMeta | null },
  reason: string | null,
  /** Extra work in the same transaction (e.g. reopening a linked join request). */
  also?: (db: Db, req: ChangeRequest) => Promise<void>
): Promise<ChangeRequest> {
  return inTransaction(async (db) => {
    const req = await getChangeRequest(db, scope, fundId, id);
    const updated = await one<{ id: number }>(
      db,
      `UPDATE qfinera_change_requests
          SET status = $2, reviewed_by = $3, reviewed_at = now(), review_reason = $4, updated_at = now()
        WHERE id = $1 AND status = 'PENDING' RETURNING id`,
      [id, outcome, actor.userId, reason]
    );
    if (!updated) throw conflictError("This request is no longer pending.");
    if (also) await also(db, req);
    await writeAudit(db, {
      fundId: auditFundId(scope, fundId),
      userId: actor.userId,
      action: outcome === "REJECTED" ? "change_request.rejected" : "change_request.cancelled",
      entityType: "change_request",
      entityId: id,
      before: { status: "PENDING" },
      after: { status: outcome, action: req.action, entity_type: req.entityType, entity_id: req.entityId },
      reason,
      meta: actor.meta,
    });
    const row = await one<Row>(db, `${SELECT} WHERE r.id = $1`, [id]);
    return toRequest(row as Row);
  });
}
