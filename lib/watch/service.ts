// Global Watch: intelligence any QFinera member can publish for everyone.
//
// One member finds something useful (an announcement, an article, a risk, a
// management interview), publishes it, and every signed-in QFinera account
// can read it, follow its links and open its attachments. It is
// informational: never a buy/sell signal, target or recommendation, and it
// never touches pool accounting.
//
// Permissions: lib/watch/permissions.ts. Every change is audited in
// qfinera_fund_audit_log with fund_id NULL (entity_type "watch_item").
// Delete is a soft removal. A platform MANAGER's edit or delete of someone
// else's item is stored as a platform-scope change request and applied only
// when a platform ADMIN approves it.
import { createHash } from "node:crypto";
import { writeAudit, type RequestMeta } from "@/lib/fund/audit";
import {
  claimChangeRequest,
  closeChangeRequest,
  completeChangeRequest,
  createChangeRequest,
  getChangeRequest,
  listChangeRequests,
  releaseChangeRequest,
  type ChangeRequest,
} from "@/lib/fund/change-request-store";
import { inTransaction, one, readDb, type Db } from "@/lib/fund/db";
import { FundError, conflictError, notFoundError, unauthenticatedError, validationError } from "@/lib/fund/errors";
import { ForbiddenError } from "@/lib/fund/rbac";
import { cleanFileName, decodeProof, sniffProofType, type ProofContentType } from "@/lib/fund/services/contribution-proofs";
import { parseEnum, parseOptionalId, parseOptionalText, parseText, type JsonObject } from "@/lib/fund/validation";
import { getRequestSession } from "@/lib/qfinera-auth/http";
import {
  PLATFORM_ROLES,
  canViewWatchItem,
  decideWatch,
  watchCapabilities,
  type PlatformRole,
  type WatchActor,
  type WatchStatus,
} from "@/lib/watch/permissions";

export type WatchCategory = "STOCK" | "INDUSTRY" | "ECONOMY" | "NEWS" | "RESEARCH" | "RISK" | "OPPORTUNITY" | "REGULATORY" | "OTHER";
export const WATCH_CATEGORIES: readonly WatchCategory[] = [
  "STOCK",
  "INDUSTRY",
  "ECONOMY",
  "NEWS",
  "RESEARCH",
  "RISK",
  "OPPORTUNITY",
  "REGULATORY",
  "OTHER",
];
export type WatchPriority = "LOW" | "NORMAL" | "HIGH";
export const WATCH_PRIORITIES: readonly WatchPriority[] = ["LOW", "NORMAL", "HIGH"];
export type WatchLinkKind = "ARTICLE" | "VIDEO" | "DOCUMENT" | "OTHER";
export const WATCH_LINK_KINDS: readonly WatchLinkKind[] = ["ARTICLE", "VIDEO", "DOCUMENT", "OTHER"];
export type WatchLink = { url: string; label: string | null; kind: WatchLinkKind };

export const MAX_WATCH_ATTACHMENTS = 6;
export const WATCH_PAGE_SIZE = 20;

export type WatchInput = {
  title: string;
  summary: string;
  details: string | null;
  category: WatchCategory;
  instrumentId: number | null;
  symbol: string | null;
  company: string | null;
  industry: string | null;
  tags: string[];
  links: WatchLink[];
  source: string | null;
  contact: string | null;
  priority: WatchPriority;
};

export type WatchAttachment = {
  id: number;
  fileName: string;
  contentType: ProofContentType;
  sizeBytes: number;
  uploaderName: string | null;
  createdAt: Date;
};

export type WatchItem = {
  id: number;
  title: string;
  summary: string;
  details: string | null;
  category: WatchCategory;
  instrumentId: number | null;
  instrumentName: string | null;
  exchange: string | null;
  symbol: string | null;
  company: string | null;
  industry: string | null;
  tags: string[];
  links: WatchLink[];
  source: string | null;
  contact: string | null;
  priority: WatchPriority;
  status: WatchStatus;
  createdBy: number;
  authorName: string | null;
  updatedByName: string | null;
  createdAt: Date;
  updatedAt: Date;
  attachmentCount: number;
};

export type WatchItemDetail = WatchItem & {
  attachments: WatchAttachment[];
  can: ReturnType<typeof watchCapabilities>;
  pendingRequests: number;
};

// ---------------------------------------------------------------- actor

/** The signed-in account and its platform role, read from the database on every request. */
export async function loadWatchActor(db: Db, userId: number): Promise<WatchActor | null> {
  const row = await one<{ platform_role: PlatformRole; status: string }>(
    db,
    "SELECT platform_role, status FROM qfinance_users WHERE id = $1",
    [userId]
  );
  if (!row || row.status !== "active") return null;
  return { userId, platformRole: PLATFORM_ROLES.includes(row.platform_role) ? row.platform_role : "USER" };
}

type CookieReader = { cookies: { get(name: string): { value: string } | undefined } };

export async function requireWatchActor(req: CookieReader, db: Db): Promise<WatchActor & { displayName: string }> {
  const session = await getRequestSession(req);
  if (!session) throw unauthenticatedError();
  const actor = await loadWatchActor(db, session.userId);
  if (!actor) throw unauthenticatedError();
  return { ...actor, displayName: session.displayName };
}

// ----------------------------------------------------------- validation

function parseTags(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw validationError("Tags must be a list.", { tags: "Invalid" });
  const tags = [
    ...new Set(
      value.map((t) => {
        if (typeof t !== "string") throw validationError("Tags must be text.", { tags: "Invalid" });
        return t.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9&.-]/g, "").slice(0, 30);
      })
    ),
  ].filter(Boolean);
  if (tags.length > 8) throw validationError("Use at most 8 tags.", { tags: "At most 8" });
  return tags;
}

function parseLinks(value: unknown): WatchLink[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw validationError("Links must be a list.", { links: "Invalid" });
  if (value.length > 10) throw validationError("Add at most 10 links.", { links: "At most 10" });
  return value.map((raw, i) => {
    const l = (raw ?? {}) as JsonObject;
    const urlText = parseText(l.url, `links[${i}].url`, { min: 8, max: 500 });
    let url: string;
    try {
      const u = new URL(urlText);
      if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("scheme");
      url = u.toString();
    } catch {
      throw validationError("Every link must be a valid http(s) address.", { links: `Link ${i + 1} is not a valid http(s) address` });
    }
    return {
      url,
      label: parseOptionalText(l.label, `links[${i}].label`, 120),
      kind: l.kind === undefined ? "ARTICLE" : parseEnum(l.kind, `links[${i}].kind`, WATCH_LINK_KINDS),
    };
  });
}

/** Full validation for create; `partial` validates only the fields present (edit). */
export function parseWatchInput(body: JsonObject, partial: false): WatchInput;
export function parseWatchInput(body: JsonObject, partial: true): Partial<WatchInput>;
export function parseWatchInput(body: JsonObject, partial: boolean): Partial<WatchInput> {
  const out: Partial<WatchInput> = {};
  const has = (k: string) => !partial || body[k] !== undefined;
  if (has("title")) out.title = parseText(body.title, "title", { min: 3, max: 160 });
  if (has("summary")) out.summary = parseText(body.summary, "summary", { min: 10, max: 400 });
  if (has("details")) out.details = parseOptionalText(body.details, "details", 10000);
  if (has("category")) out.category = parseEnum(body.category, "category", WATCH_CATEGORIES);
  if (has("instrumentId")) out.instrumentId = parseOptionalId(body.instrumentId, "instrumentId");
  if (has("symbol")) {
    const s = parseOptionalText(body.symbol, "symbol", 40);
    out.symbol = s ? s.toUpperCase() : null;
  }
  if (has("company")) out.company = parseOptionalText(body.company, "company", 160);
  if (has("industry")) out.industry = parseOptionalText(body.industry, "industry", 120);
  if (has("tags")) out.tags = parseTags(body.tags);
  if (has("links")) out.links = parseLinks(body.links);
  if (has("source")) out.source = parseOptionalText(body.source, "source", 200);
  if (has("contact")) out.contact = parseOptionalText(body.contact, "contact", 200);
  if (has("priority")) out.priority = body.priority === undefined ? "NORMAL" : parseEnum(body.priority, "priority", WATCH_PRIORITIES);
  if (partial && Object.keys(out).length === 0) throw validationError("Nothing to change.");
  return out;
}

// --------------------------------------------------------------- reads

type ItemRow = {
  id: number;
  title: string;
  summary: string;
  details: string | null;
  category: WatchCategory;
  instrument_id: number | null;
  instrument_name: string | null;
  exchange: string | null;
  symbol: string | null;
  company: string | null;
  industry: string | null;
  tags: string[];
  links: WatchLink[];
  source: string | null;
  contact: string | null;
  priority: WatchPriority;
  status: WatchStatus;
  created_by: number;
  author_name: string | null;
  updated_by_name: string | null;
  created_at: Date;
  updated_at: Date;
  attachment_count: number;
};

const ITEM_SELECT = `
  SELECT w.id, w.title, w.summary, w.details, w.category, w.instrument_id, i.name AS instrument_name, i.exchange,
         COALESCE(w.symbol, i.symbol) AS symbol, w.company, w.industry, w.tags, w.links, w.source, w.contact, w.priority,
         w.status, w.created_by, a.display_name AS author_name, e.display_name AS updated_by_name, w.created_at, w.updated_at,
         (SELECT COUNT(*) FROM qfinera_watch_attachments x WHERE x.item_id = w.id AND x.removed_at IS NULL)::int AS attachment_count
    FROM qfinera_watch_items w
    LEFT JOIN qfinera_fund_instruments i ON i.id = w.instrument_id
    LEFT JOIN qfinance_users a ON a.id = w.created_by
    LEFT JOIN qfinance_users e ON e.id = w.updated_by`;

function toItem(r: ItemRow): WatchItem {
  return {
    id: r.id,
    title: r.title,
    summary: r.summary,
    details: r.details,
    category: r.category,
    instrumentId: r.instrument_id,
    instrumentName: r.instrument_name,
    exchange: r.exchange,
    symbol: r.symbol,
    company: r.company,
    industry: r.industry,
    tags: r.tags ?? [],
    links: Array.isArray(r.links) ? r.links : [],
    source: r.source,
    contact: r.contact,
    priority: r.priority,
    status: r.status,
    createdBy: r.created_by,
    authorName: r.author_name,
    updatedByName: r.updated_by_name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    attachmentCount: r.attachment_count,
  };
}

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export type WatchFilter = {
  q: string | null;
  category: WatchCategory | null;
  sort: "latest" | "updated";
  /** Only my items (published and archived). */
  mine: boolean;
  /** Moderators may list archived items. */
  status: "PUBLISHED" | "ARCHIVED";
  page: number;
};

export async function listWatch(db: Db, actor: WatchActor, f: WatchFilter): Promise<{ items: WatchItem[]; total: number; page: number; pageSize: number }> {
  const q = f.q?.trim() ? `%${escapeLike(f.q.trim())}%` : null;
  const archived = f.status === "ARCHIVED";
  if (archived && !f.mine && actor.platformRole === "USER") throw new ForbiddenError();
  const where = `
        ${f.mine ? "w.created_by = $1 AND w.status IN ('PUBLISHED', 'ARCHIVED')" : archived ? "w.status = 'ARCHIVED'" : "w.status = 'PUBLISHED'"}
        AND ($2::text IS NULL OR w.title ILIKE $2 OR w.summary ILIKE $2 OR w.company ILIKE $2 OR w.industry ILIKE $2
             OR w.symbol ILIKE $2 OR i.symbol ILIKE $2 OR array_to_string(w.tags, ' ') ILIKE $2)
        AND ($3::text IS NULL OR w.category = $3)
        AND ($1::int IS NOT NULL)`;
  const args = [actor.userId, q, f.category];
  const count = await one<{ n: number }>(
    db,
    `SELECT COUNT(*)::int AS n FROM qfinera_watch_items w LEFT JOIN qfinera_fund_instruments i ON i.id = w.instrument_id WHERE ${where}`,
    args
  );
  const order = f.sort === "updated" ? "w.updated_at DESC, w.id DESC" : "w.created_at DESC, w.id DESC";
  const { rows } = await db.query<ItemRow>(`${ITEM_SELECT} WHERE ${where} ORDER BY ${order} LIMIT $4 OFFSET $5`, [
    ...args,
    WATCH_PAGE_SIZE,
    (f.page - 1) * WATCH_PAGE_SIZE,
  ]);
  return { items: rows.map(toItem), total: count?.n ?? 0, page: f.page, pageSize: WATCH_PAGE_SIZE };
}

async function loadRow(db: Db, id: number, lock = false): Promise<ItemRow | null> {
  if (lock) await db.query("SELECT id FROM qfinera_watch_items WHERE id = $1 FOR UPDATE", [id]);
  return one<ItemRow>(db, `${ITEM_SELECT} WHERE w.id = $1`, [id]);
}

async function loadVisible(db: Db, actor: WatchActor, id: number, lock = false): Promise<ItemRow> {
  const row = await loadRow(db, id, lock);
  // An item you may not see does not exist for you.
  if (!row || !canViewWatchItem(actor, { createdBy: row.created_by, status: row.status })) throw notFoundError("Item");
  return row;
}

export async function listAttachments(db: Db, itemId: number): Promise<WatchAttachment[]> {
  const { rows } = await db.query<WatchAttachment>(
    `SELECT x.id, x.file_name AS "fileName", x.content_type AS "contentType", x.size_bytes AS "sizeBytes",
            u.display_name AS "uploaderName", x.created_at AS "createdAt"
       FROM qfinera_watch_attachments x LEFT JOIN qfinance_users u ON u.id = x.uploaded_by
      WHERE x.item_id = $1 AND x.removed_at IS NULL ORDER BY x.id`,
    [itemId]
  );
  return rows;
}

export async function getWatchItem(db: Db, actor: WatchActor, id: number): Promise<WatchItemDetail> {
  const row = await loadVisible(db, actor, id);
  const item = toItem(row);
  const [attachments, pending] = await Promise.all([
    listAttachments(db, id),
    one<{ n: number }>(
      db,
      `SELECT COUNT(*)::int AS n FROM qfinera_change_requests
        WHERE scope = 'platform' AND entity_type = 'watch_item' AND entity_id = $1 AND status = 'PENDING'`,
      [id]
    ),
  ]);
  return {
    ...item,
    attachments,
    can: watchCapabilities(actor, { createdBy: item.createdBy, status: item.status }),
    pendingRequests: pending?.n ?? 0,
  };
}

// -------------------------------------------------------------- writes

function auditState(r: ItemRow) {
  return {
    title: r.title,
    summary: r.summary,
    category: r.category,
    symbol: r.symbol,
    company: r.company,
    industry: r.industry,
    tags: r.tags,
    links: r.links,
    source: r.source,
    contact: r.contact,
    priority: r.priority,
    status: r.status,
    details_length: r.details?.length ?? 0,
  };
}

async function resolveInstrument(db: Db, instrumentId: number | null | undefined): Promise<{ id: number; symbol: string } | null> {
  if (!instrumentId) return null;
  const row = await one<{ id: number; symbol: string }>(db, "SELECT id, symbol FROM qfinera_fund_instruments WHERE id = $1", [instrumentId]);
  if (!row) throw validationError("Choose a valid instrument.", { instrumentId: "Unknown instrument" });
  return row;
}

export async function createWatchItem(actor: WatchActor, input: WatchInput, meta?: RequestMeta | null): Promise<WatchItem> {
  return inTransaction(async (db) => {
    const instrument = await resolveInstrument(db, input.instrumentId);
    const ins = await one<{ id: number }>(
      db,
      `INSERT INTO qfinera_watch_items
         (title, summary, details, category, instrument_id, symbol, company, industry, tags, links, source, contact, priority, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::text[], $10::jsonb, $11, $12, $13, $14, $14) RETURNING id`,
      [
        input.title,
        input.summary,
        input.details,
        input.category,
        instrument?.id ?? null,
        input.symbol ?? instrument?.symbol ?? null,
        input.company,
        input.industry,
        input.tags,
        JSON.stringify(input.links),
        input.source,
        input.contact,
        input.priority,
        actor.userId,
      ]
    );
    if (!ins) throw new Error("watch insert returned no row");
    const row = (await loadRow(db, ins.id)) as ItemRow;
    await writeAudit(db, {
      fundId: null,
      userId: actor.userId,
      action: "watch.created",
      entityType: "watch_item",
      entityId: ins.id,
      after: auditState(row),
      meta,
    });
    return toItem(row);
  });
}

/** Applies an edit. The caller has decided the actor may do it directly. */
async function applyUpdate(actor: WatchActor, id: number, patch: Partial<WatchInput>, meta: RequestMeta | null | undefined, reason: string | null) {
  return inTransaction(async (db) => {
    const before = await loadVisible(db, actor, id, true);
    if (before.status !== "PUBLISHED" && before.status !== "ARCHIVED") throw conflictError("This item was deleted.");
    const instrument = patch.instrumentId !== undefined ? await resolveInstrument(db, patch.instrumentId) : undefined;
    const set: string[] = [];
    const args: unknown[] = [id];
    const add = (col: string, value: unknown, cast = "") => {
      args.push(value);
      set.push(`${col} = $${args.length}${cast}`);
    };
    if (patch.title !== undefined) add("title", patch.title);
    if (patch.summary !== undefined) add("summary", patch.summary);
    if (patch.details !== undefined) add("details", patch.details);
    if (patch.category !== undefined) add("category", patch.category);
    if (instrument !== undefined) add("instrument_id", instrument?.id ?? null);
    if (patch.symbol !== undefined || instrument) add("symbol", patch.symbol ?? instrument?.symbol ?? null);
    if (patch.company !== undefined) add("company", patch.company);
    if (patch.industry !== undefined) add("industry", patch.industry);
    if (patch.tags !== undefined) add("tags", patch.tags, "::text[]");
    if (patch.links !== undefined) add("links", JSON.stringify(patch.links), "::jsonb");
    if (patch.source !== undefined) add("source", patch.source);
    if (patch.contact !== undefined) add("contact", patch.contact);
    if (patch.priority !== undefined) add("priority", patch.priority);
    add("updated_by", actor.userId);
    await db.query(`UPDATE qfinera_watch_items SET ${set.join(", ")}, updated_at = now() WHERE id = $1`, args);
    const after = (await loadRow(db, id)) as ItemRow;
    await writeAudit(db, {
      fundId: null,
      userId: actor.userId,
      action: "watch.updated",
      entityType: "watch_item",
      entityId: id,
      before: auditState(before),
      after: auditState(after),
      reason,
      meta,
    });
    return toItem(after);
  });
}

async function applyRemove(actor: WatchActor, id: number, reason: string | null, meta: RequestMeta | null | undefined) {
  return inTransaction(async (db) => {
    const before = await loadVisible(db, actor, id, true);
    if (before.status === "REMOVED") throw conflictError("This item was already deleted.");
    await db.query(
      `UPDATE qfinera_watch_items SET status = 'REMOVED', removed_at = now(), removed_by = $2, removal_reason = $3, updated_at = now()
        WHERE id = $1`,
      [id, actor.userId, reason]
    );
    await db.query(
      `UPDATE qfinera_change_requests SET status = 'CANCELLED', reviewed_by = $2, reviewed_at = now(),
              review_reason = 'The item was deleted', updated_at = now()
        WHERE scope = 'platform' AND entity_type = 'watch_item' AND entity_id = $1 AND status = 'PENDING'`,
      [id, actor.userId]
    );
    await writeAudit(db, {
      fundId: null,
      userId: actor.userId,
      action: before.created_by === actor.userId ? "watch.deleted" : "watch.removed_by_moderator",
      entityType: "watch_item",
      entityId: id,
      before: { status: before.status, title: before.title },
      after: { status: "REMOVED" },
      reason,
      meta,
    });
    return { id, status: "REMOVED" as const };
  });
}

export type WatchChangeResult<T> = { kind: "done"; data: T } | { kind: "proposed"; request: ChangeRequest };

async function propose(actor: WatchActor, id: number, action: "watch.update" | "watch.delete", payload: JsonObject, reason: string | null, meta?: RequestMeta | null) {
  const before = await one<ItemRow>(readDb(), `${ITEM_SELECT} WHERE w.id = $1`, [id]);
  return createChangeRequest({
    scope: "platform",
    fundId: null,
    action,
    entityType: "watch_item",
    entityId: id,
    payload,
    beforeState: before ? auditState(before) : null,
    proposedState: action === "watch.delete" ? { status: "REMOVED" } : payload,
    reason,
    requestedBy: actor.userId,
    meta,
  });
}

async function decisionFor(db: Db, actor: WatchActor, id: number, op: "edit" | "delete" | "archive") {
  const row = await loadVisible(db, actor, id);
  const decision = decideWatch(actor, { createdBy: row.created_by, status: row.status }, op);
  if (decision === "deny") throw new ForbiddenError("Only the author or a moderator can change this item.");
  return decision;
}

export async function updateWatchItem(
  db: Db,
  actor: WatchActor,
  id: number,
  body: JsonObject,
  meta?: RequestMeta | null
): Promise<WatchChangeResult<WatchItem>> {
  const patch = parseWatchInput(body, true);
  const reason = parseOptionalText(body.reason, "reason", 500);
  if ((await decisionFor(db, actor, id, "edit")) === "propose") {
    return { kind: "proposed", request: await propose(actor, id, "watch.update", { ...body, reason }, reason, meta) };
  }
  return { kind: "done", data: await applyUpdate(actor, id, patch, meta, reason) };
}

export async function deleteWatchItem(
  db: Db,
  actor: WatchActor,
  id: number,
  reason: string | null,
  meta?: RequestMeta | null
): Promise<WatchChangeResult<{ id: number; status: "REMOVED" }>> {
  if ((await decisionFor(db, actor, id, "delete")) === "propose") {
    if (!reason || reason.length < 3) throw validationError("Give a reason for the administrator.", { reason: "Required" });
    return { kind: "proposed", request: await propose(actor, id, "watch.delete", { reason }, reason, meta) };
  }
  return { kind: "done", data: await applyRemove(actor, id, reason, meta) };
}

/** Archive (hide from the feed, reversible) or restore. Owner and moderators, directly. */
export async function setWatchArchived(db: Db, actor: WatchActor, id: number, archived: boolean, meta?: RequestMeta | null): Promise<WatchItem> {
  await decisionFor(db, actor, id, "archive");
  return inTransaction(async (tx) => {
    const before = await loadVisible(tx, actor, id, true);
    const target: WatchStatus = archived ? "ARCHIVED" : "PUBLISHED";
    if (before.status === target) throw conflictError(archived ? "This item is already archived." : "This item is already published.");
    await tx.query(
      `UPDATE qfinera_watch_items SET status = $2, archived_at = CASE WHEN $3::boolean THEN now() ELSE NULL END,
              archived_by = CASE WHEN $3::boolean THEN $4::int ELSE NULL END, updated_at = now()
        WHERE id = $1`,
      [id, target, archived, actor.userId]
    );
    await writeAudit(tx, {
      fundId: null,
      userId: actor.userId,
      action: archived ? "watch.archived" : "watch.restored",
      entityType: "watch_item",
      entityId: id,
      before: { status: before.status },
      after: { status: target },
      meta,
    });
    return toItem((await loadRow(tx, id)) as ItemRow);
  });
}

// --------------------------------------------------------- attachments

export async function addWatchAttachment(
  actor: WatchActor,
  itemId: number,
  input: { fileName: string; dataBase64: string },
  meta?: RequestMeta | null
): Promise<WatchAttachment> {
  const bytes = decodeProof(input.dataBase64);
  const contentType = sniffProofType(bytes);
  if (!contentType) throw validationError("Upload a PNG, JPEG or WebP image, or a PDF.", { file: "Unsupported file type" });
  const fileName = cleanFileName(input.fileName);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  return inTransaction(async (db) => {
    const row = await loadVisible(db, actor, itemId, true);
    if (decideWatch(actor, { createdBy: row.created_by, status: row.status }, "edit") !== "direct") {
      throw new ForbiddenError("Only the author or an administrator can add files.");
    }
    const count = await one<{ n: number; dup: boolean }>(
      db,
      `SELECT COUNT(*)::int AS n, bool_or(sha256 = $2) AS dup FROM qfinera_watch_attachments WHERE item_id = $1 AND removed_at IS NULL`,
      [itemId, sha256]
    );
    if (count?.dup) throw conflictError("This file is already attached.");
    if ((count?.n ?? 0) >= MAX_WATCH_ATTACHMENTS) throw conflictError(`An item can have at most ${MAX_WATCH_ATTACHMENTS} files.`);
    const ins = await one<{ id: number; created_at: Date }>(
      db,
      `INSERT INTO qfinera_watch_attachments (item_id, file_name, content_type, size_bytes, sha256, data, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at`,
      [itemId, fileName, contentType, bytes.length, sha256, bytes, actor.userId]
    );
    if (!ins) throw new Error("attachment insert returned no row");
    await db.query("UPDATE qfinera_watch_items SET updated_at = now(), updated_by = $2 WHERE id = $1", [itemId, actor.userId]);
    await writeAudit(db, {
      fundId: null,
      userId: actor.userId,
      action: "watch.attachment_added",
      entityType: "watch_item",
      entityId: itemId,
      after: { attachment_id: ins.id, file_name: fileName, content_type: contentType, size_bytes: bytes.length, sha256 },
      meta,
    });
    return { id: ins.id, fileName, contentType, sizeBytes: bytes.length, uploaderName: null, createdAt: ins.created_at };
  });
}

export async function removeWatchAttachment(actor: WatchActor, itemId: number, attachmentId: number, meta?: RequestMeta | null): Promise<void> {
  await inTransaction(async (db) => {
    const row = await loadVisible(db, actor, itemId, true);
    if (decideWatch(actor, { createdBy: row.created_by, status: row.status }, "edit") !== "direct") {
      throw new ForbiddenError("Only the author or an administrator can remove files.");
    }
    const res = await one<{ id: number; file_name: string }>(
      db,
      `UPDATE qfinera_watch_attachments SET removed_at = now(), removed_by = $3
        WHERE id = $1 AND item_id = $2 AND removed_at IS NULL RETURNING id, file_name`,
      [attachmentId, itemId, actor.userId]
    );
    if (!res) throw notFoundError("File");
    await writeAudit(db, {
      fundId: null,
      userId: actor.userId,
      action: "watch.attachment_removed",
      entityType: "watch_item",
      entityId: itemId,
      before: { attachment_id: res.id, file_name: res.file_name },
      meta,
    });
  });
}

export async function getWatchAttachmentFile(db: Db, actor: WatchActor, itemId: number, attachmentId: number) {
  await loadVisible(db, actor, itemId);
  const row = await one<{ file_name: string; content_type: ProofContentType; data: Buffer }>(
    db,
    "SELECT file_name, content_type, data FROM qfinera_watch_attachments WHERE id = $1 AND item_id = $2 AND removed_at IS NULL",
    [attachmentId, itemId]
  );
  if (!row) throw notFoundError("File");
  return { fileName: row.file_name, contentType: row.content_type, data: row.data };
}

// ----------------------------------------------- moderation requests

function assertPlatformAdmin(actor: WatchActor) {
  if (actor.platformRole !== "ADMIN") throw new ForbiddenError("Only a QFinera administrator can review requests.");
}

/** ADMIN: every platform request. MANAGER: their own. USER: none. */
export async function listWatchRequests(db: Db, actor: WatchActor, status: "open" | "closed" | "all"): Promise<ChangeRequest[]> {
  if (actor.platformRole === "USER") throw new ForbiddenError();
  return listChangeRequests(db, {
    scope: "platform",
    fundId: null,
    status,
    requestedBy: actor.platformRole === "ADMIN" ? null : actor.userId,
    limit: 100,
  });
}

export async function approveWatchRequest(actor: WatchActor, requestId: number, reviewReason: string | null, meta?: RequestMeta | null) {
  assertPlatformAdmin(actor);
  const req = await claimChangeRequest("platform", null, requestId, actor.userId);
  let data: unknown;
  try {
    if (req.requestedBy === actor.userId) throw new FundError("FORBIDDEN", "You cannot approve your own request.", 403);
    if (req.entityId === null) throw notFoundError("Item");
    if (req.action === "watch.update") {
      data = await applyUpdate(actor, req.entityId, parseWatchInput(req.payload, true), meta, (req.payload.reason as string | null) ?? null);
    } else if (req.action === "watch.delete") {
      data = await applyRemove(actor, req.entityId, (req.payload.reason as string | null) ?? null, meta);
    } else {
      throw validationError("This kind of request is not supported.");
    }
  } catch (err) {
    const message = err instanceof FundError || err instanceof ForbiddenError ? err.message : "The change could not be applied.";
    await releaseChangeRequest(req.id, message);
    throw err;
  }
  const request = await completeChangeRequest(req, { userId: actor.userId, meta }, reviewReason, { applied: true });
  return { request, result: data };
}

export async function rejectWatchRequest(actor: WatchActor, requestId: number, reason: string, meta?: RequestMeta | null) {
  assertPlatformAdmin(actor);
  return closeChangeRequest("platform", null, requestId, "REJECTED", { userId: actor.userId, meta }, reason);
}

export async function cancelWatchRequest(db: Db, actor: WatchActor, requestId: number, meta?: RequestMeta | null) {
  const req = await getChangeRequest(db, "platform", null, requestId);
  if (req.requestedBy !== actor.userId) throw notFoundError("Request");
  return closeChangeRequest("platform", null, requestId, "CANCELLED", { userId: actor.userId, meta }, null);
}
