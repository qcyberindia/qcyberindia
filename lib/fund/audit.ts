// Append-only audit trail for QFinera Fund (qfinera_fund_audit_log).
//
// Every sensitive action writes one row INSIDE the same transaction as the
// change it describes, so an audited action and its audit row commit or roll
// back together. The table is protected from UPDATE/DELETE/TRUNCATE by the
// trigger in migration 007.
//
// The table has no dedicated "reason" column (006/007 are not rewritten), so
// the reason and a computed field-level diff are stored in the `diff` JSONB:
//   { "reason": "...", "changes": { "status": { "from": "PENDING", "to": "APPROVED" } } }
import type { Db } from "@/lib/fund/db";

export type RequestMeta = { ip: string | null; userAgent: string | null };

export type AuditInput = {
  fundId: number | null;
  userId: number | null;
  /** e.g. "contribution.approved". */
  action: string;
  entityType: string;
  entityId?: number | null;
  /** Plain JSON-safe snapshots. Money must already be decimal strings. */
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
  meta?: RequestMeta | null;
};

export const NO_META: RequestMeta = { ip: null, userAgent: null };

export function requestMeta(req: Request): RequestMeta {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = (forwarded ? forwarded.split(",")[0] : req.headers.get("x-real-ip"))?.trim() || null;
  const userAgent = req.headers.get("user-agent")?.slice(0, 300) || null;
  return { ip: ip ? ip.slice(0, 64) : null, userAgent };
}

export function computeChanges(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const key of keys) {
    const from = before?.[key] ?? null;
    const to = after?.[key] ?? null;
    if (JSON.stringify(from) !== JSON.stringify(to)) changes[key] = { from, to };
  }
  return changes;
}

export async function writeAudit(db: Db, input: AuditInput): Promise<void> {
  const diff = {
    reason: input.reason ?? null,
    changes: computeChanges(input.before, input.after),
  };
  await db.query(
    `INSERT INTO qfinera_fund_audit_log
       (fund_id, user_id, action, entity_type, entity_id, before_state, after_state, diff, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10)`,
    [
      input.fundId,
      input.userId,
      input.action,
      input.entityType,
      input.entityId ?? null,
      input.before ? JSON.stringify(input.before) : null,
      input.after ? JSON.stringify(input.after) : null,
      JSON.stringify(diff),
      input.meta?.ip ?? null,
      input.meta?.userAgent ?? null,
    ]
  );
}

export type AuditRecord = {
  id: number;
  action: string;
  entityType: string;
  entityId: number | null;
  userId: number | null;
  actorName: string | null;
  createdAt: Date;
  reason: string | null;
  changes: Record<string, { from: unknown; to: unknown }>;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};

type AuditRow = {
  id: number;
  action: string;
  entity_type: string;
  entity_id: number | null;
  user_id: number | null;
  actor_name: string | null;
  created_at: Date;
  reason: string | null;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
};

const AUDIT_SELECT = `
  SELECT a.id, a.action, a.entity_type, a.entity_id, a.user_id, u.display_name AS actor_name, a.created_at,
         a.diff->>'reason' AS reason, a.diff->'changes' AS changes, a.before_state, a.after_state
    FROM qfinera_fund_audit_log a
    LEFT JOIN qfinance_users u ON u.id = a.user_id`;

function toAuditRecord(r: AuditRow): AuditRecord {
  return {
    id: r.id,
    action: r.action,
    entityType: r.entity_type,
    entityId: r.entity_id,
    userId: r.user_id,
    actorName: r.actor_name,
    createdAt: r.created_at,
    reason: r.reason,
    changes: r.changes ?? {},
    before: r.before_state,
    after: r.after_state,
  };
}

/** The audit trail of one record, oldest first. Callers check audit:view. */
export async function loadEntityAudit(db: Db, fundId: number, entityType: string, entityId: number): Promise<AuditRecord[]> {
  const { rows } = await db.query<AuditRow>(
    `${AUDIT_SELECT} WHERE a.fund_id = $1 AND a.entity_type = $2 AND a.entity_id = $3 ORDER BY a.id`,
    [fundId, entityType, entityId]
  );
  return rows.map(toAuditRecord);
}

export type AuditFilter = {
  entityType: string | null;
  entityId: number | null;
  action: string | null;
  userId: number | null;
  from: string | null;
  to: string | null;
  pageSize: number;
  offset: number;
};

/** Fund audit log, newest first. Dates are IST calendar dates, inclusive. */
export async function listAudit(db: Db, fundId: number, f: AuditFilter): Promise<{ rows: AuditRecord[]; total: number }> {
  const where = `a.fund_id = $1
    AND ($2::text IS NULL OR a.entity_type = $2)
    AND ($3::int IS NULL OR a.entity_id = $3)
    AND ($4::text IS NULL OR a.action = $4)
    AND ($5::int IS NULL OR a.user_id = $5)
    AND ($6::date IS NULL OR a.created_at >= ($6::date)::timestamp AT TIME ZONE 'Asia/Kolkata')
    AND ($7::date IS NULL OR a.created_at < ($7::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata')`;
  const args = [fundId, f.entityType, f.entityId, f.action, f.userId, f.from, f.to];
  const count = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM qfinera_fund_audit_log a WHERE ${where}`,
    args
  );
  const { rows } = await db.query<AuditRow>(
    `${AUDIT_SELECT} WHERE ${where} ORDER BY a.id DESC LIMIT $8 OFFSET $9`,
    [...args, f.pageSize, f.offset]
  );
  return { rows: rows.map(toAuditRecord), total: count.rows[0]?.n ?? 0 };
}
