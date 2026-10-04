// Watchlist: the fund's shared research notes. Informational only: it never
// touches accounting, and it carries no buy/sell signals, targets or advice.
//
//   MANAGER/ADMIN (watchlist:write)  add, edit, change status, archive/restore any item
//   MEMBER (watchlist:create)        add, and edit/archive/restore their OWN items
//   MEMBER and above (watchlist:comment) read and comment; VIEWER reads
//
// Comments are append-only discussion; items are archived, never deleted.
import { writeAudit } from "@/lib/fund/audit";
import { inTransaction, one, type Db } from "@/lib/fund/db";
import { conflictError, notFoundError, validationError } from "@/lib/fund/errors";
import { ForbiddenError, assertPermission, hasPermission, type FundActor } from "@/lib/fund/rbac";
import { quotesFor, type Instrument } from "@/lib/fund/services/market";
import { assertFundActive, type ServiceCtx } from "@/lib/fund/services/types";
import type { Quote } from "@/lib/market-data";

export type WatchlistStatus = "IDEA" | "WATCHING" | "ACTIVE" | "INVALIDATED" | "COMPLETED";
export const WATCHLIST_STATUSES: readonly WatchlistStatus[] = ["IDEA", "WATCHING", "ACTIVE", "INVALIDATED", "COMPLETED"];

type ItemRow = {
  id: number;
  instrument_id: number | null;
  symbol: string;
  exchange: "NSE" | "BSE" | null;
  instrument_name: string | null;
  title: string;
  thesis: string | null;
  notes: string | null;
  research_url: string | null;
  status: WatchlistStatus;
  created_by: number;
  created_by_name: string | null;
  created_at: Date;
  updated_at: Date;
  archived_at: Date | null;
  comment_count: number;
};

export type WatchlistItem = {
  id: number;
  instrumentId: number | null;
  symbol: string;
  exchange: string | null;
  instrumentName: string | null;
  title: string;
  thesis: string | null;
  notes: string | null;
  researchUrl: string | null;
  status: WatchlistStatus;
  createdBy: number;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
  commentCount: number;
  quote: Quote | null;
};

const ITEM_SELECT = `
  SELECT w.id, w.instrument_id, w.symbol, i.exchange, i.name AS instrument_name, w.title, w.thesis, w.notes,
         w.research_url, w.status, w.created_by, u.display_name AS created_by_name, w.created_at, w.updated_at,
         w.archived_at,
         (SELECT COUNT(*) FROM qfinera_fund_watchlist_comments c WHERE c.watchlist_item_id = w.id)::int AS comment_count
    FROM qfinera_fund_watchlist_items w
    LEFT JOIN qfinera_fund_instruments i ON i.id = w.instrument_id
    LEFT JOIN qfinance_users u ON u.id = w.created_by`;

function toItem(r: ItemRow, quote: Quote | null): WatchlistItem {
  return {
    id: r.id,
    instrumentId: r.instrument_id,
    symbol: r.symbol,
    exchange: r.exchange,
    instrumentName: r.instrument_name,
    title: r.title,
    thesis: r.thesis,
    notes: r.notes,
    researchUrl: r.research_url,
    status: r.status,
    createdBy: r.created_by,
    createdByName: r.created_by_name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    archivedAt: r.archived_at,
    commentCount: r.comment_count,
    quote,
  };
}

function auditState(r: ItemRow): Record<string, unknown> {
  return {
    title: r.title,
    symbol: r.symbol,
    status: r.status,
    thesis: r.thesis,
    notes: r.notes,
    research_url: r.research_url,
    archived: r.archived_at !== null,
  };
}

async function withQuotes(db: Db, fundId: number, rows: ItemRow[]): Promise<WatchlistItem[]> {
  const instruments: Instrument[] = rows
    .filter((r) => r.instrument_id !== null && r.exchange !== null)
    .map((r) => ({ id: r.instrument_id as number, symbol: r.symbol, exchange: r.exchange as "NSE" | "BSE", name: r.instrument_name }));
  const unique = [...new Map(instruments.map((i) => [i.id, i])).values()];
  const quotes = await quotesFor(db, fundId, unique);
  return rows.map((r) => toItem(r, r.instrument_id ? (quotes.get(r.instrument_id) ?? null) : null));
}

async function loadItem(db: Db, fundId: number, id: number): Promise<ItemRow> {
  const row = await one<ItemRow>(db, `${ITEM_SELECT} WHERE w.id = $1 AND w.fund_id = $2`, [id, fundId]);
  if (!row) throw notFoundError("Watchlist item");
  return row;
}

export async function listWatchlist(
  db: Db,
  ctx: ServiceCtx,
  opts: { status: WatchlistStatus | null; archived: boolean }
): Promise<WatchlistItem[]> {
  assertPermission(ctx.actor, "watchlist:view");
  const { rows } = await db.query<ItemRow>(
    `${ITEM_SELECT}
      WHERE w.fund_id = $1 AND ($2::text IS NULL OR w.status = $2)
        AND (CASE WHEN $3::boolean THEN w.archived_at IS NOT NULL ELSE w.archived_at IS NULL END)
      ORDER BY w.updated_at DESC, w.id DESC
      LIMIT 200`,
    [ctx.fundId, opts.status, opts.archived]
  );
  return withQuotes(db, ctx.fundId, rows);
}

export type WatchlistComment = { id: number; authorName: string; body: string; createdAt: Date };

export async function getWatchlistItem(
  db: Db,
  ctx: ServiceCtx,
  id: number
): Promise<{ item: WatchlistItem; comments: WatchlistComment[] }> {
  assertPermission(ctx.actor, "watchlist:view");
  const row = await loadItem(db, ctx.fundId, id);
  const [item] = await withQuotes(db, ctx.fundId, [row]);
  const { rows } = await db.query<{ id: number; author_name: string; body: string; created_at: Date }>(
    `SELECT c.id, u.display_name AS author_name, c.body, c.created_at
       FROM qfinera_fund_watchlist_comments c
       JOIN qfinance_users u ON u.id = c.author_id
      WHERE c.watchlist_item_id = $1
      ORDER BY c.created_at, c.id`,
    [id]
  );
  return {
    item,
    comments: rows.map((c) => ({ id: c.id, authorName: c.author_name, body: c.body, createdAt: c.created_at })),
  };
}

export type WatchlistInput = {
  title: string;
  thesis: string | null;
  notes: string | null;
  researchUrl: string | null;
  status: WatchlistStatus;
};

/** MANAGER/ADMIN edit any item; a MEMBER edits only the items they created. */
export function canEditWatchlistItem(actor: FundActor, createdBy: number): boolean {
  if (hasPermission(actor, "watchlist:write")) return true;
  return hasPermission(actor, "watchlist:create") && actor.userId === createdBy;
}

function assertCanEdit(ctx: ServiceCtx, createdBy: number): void {
  if (!canEditWatchlistItem(ctx.actor, createdBy)) throw new ForbiddenError("Only the author or a pool manager can change this item.");
}

export async function createWatchlistItem(
  ctx: ServiceCtx,
  input: WatchlistInput & { instrumentId: number }
): Promise<WatchlistItem> {
  if (!hasPermission(ctx.actor, "watchlist:write")) assertPermission(ctx.actor, "watchlist:create");
  return inTransaction(async (db) => {
    await assertFundActive(db, ctx.fundId);
    const instrument = await one<{ id: number; symbol: string }>(
      db,
      "SELECT id, symbol FROM qfinera_fund_instruments WHERE id = $1",
      [input.instrumentId]
    );
    if (!instrument) throw validationError("Choose a valid instrument.", { instrumentId: "Unknown instrument" });
    const dup = await one<{ id: number }>(
      db,
      "SELECT id FROM qfinera_fund_watchlist_items WHERE fund_id = $1 AND instrument_id = $2 AND archived_at IS NULL",
      [ctx.fundId, instrument.id]
    );
    if (dup) throw conflictError(`${instrument.symbol} is already on the watchlist (#${dup.id}).`);

    const ins = await one<{ id: number }>(
      db,
      `INSERT INTO qfinera_fund_watchlist_items
         (fund_id, instrument_id, symbol, title, thesis, notes, research_url, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [ctx.fundId, instrument.id, instrument.symbol, input.title, input.thesis, input.notes, input.researchUrl, input.status, ctx.actor.userId]
    );
    if (!ins) throw new Error("watchlist insert returned no row");
    const row = await loadItem(db, ctx.fundId, ins.id);
    await writeAudit(db, {
      fundId: ctx.fundId,
      userId: ctx.actor.userId,
      action: "watchlist.created",
      entityType: "watchlist_item",
      entityId: row.id,
      after: auditState(row),
      meta: ctx.meta,
    });
    const [item] = await withQuotes(db, ctx.fundId, [row]);
    return item;
  });
}

export async function updateWatchlistItem(ctx: ServiceCtx, id: number, patch: Partial<WatchlistInput>): Promise<WatchlistItem> {
  assertPermission(ctx.actor, "watchlist:view");
  return inTransaction(async (db) => {
    await db.query("SELECT id FROM qfinera_fund_watchlist_items WHERE id = $1 AND fund_id = $2 FOR UPDATE", [id, ctx.fundId]);
    const before = await loadItem(db, ctx.fundId, id);
    assertCanEdit(ctx, before.created_by);
    if (before.archived_at) throw conflictError("Restore this item before editing it.");
    await db.query(
      `UPDATE qfinera_fund_watchlist_items
          SET title = COALESCE($3, title),
              thesis = CASE WHEN $4::boolean THEN $5 ELSE thesis END,
              notes = CASE WHEN $6::boolean THEN $7 ELSE notes END,
              research_url = CASE WHEN $8::boolean THEN $9 ELSE research_url END,
              status = COALESCE($10, status),
              updated_at = now()
        WHERE id = $1 AND fund_id = $2`,
      [
        id,
        ctx.fundId,
        patch.title ?? null,
        patch.thesis !== undefined,
        patch.thesis ?? null,
        patch.notes !== undefined,
        patch.notes ?? null,
        patch.researchUrl !== undefined,
        patch.researchUrl ?? null,
        patch.status ?? null,
      ]
    );
    const after = await loadItem(db, ctx.fundId, id);
    await writeAudit(db, {
      fundId: ctx.fundId,
      userId: ctx.actor.userId,
      action: "watchlist.updated",
      entityType: "watchlist_item",
      entityId: id,
      before: auditState(before),
      after: auditState(after),
      meta: ctx.meta,
    });
    const [item] = await withQuotes(db, ctx.fundId, [after]);
    return item;
  });
}

export async function setWatchlistArchived(ctx: ServiceCtx, id: number, archived: boolean): Promise<WatchlistItem> {
  assertPermission(ctx.actor, "watchlist:view");
  return inTransaction(async (db) => {
    await db.query("SELECT id FROM qfinera_fund_watchlist_items WHERE id = $1 AND fund_id = $2 FOR UPDATE", [id, ctx.fundId]);
    const before = await loadItem(db, ctx.fundId, id);
    assertCanEdit(ctx, before.created_by);
    if ((before.archived_at !== null) === archived) {
      throw conflictError(archived ? "This item is already archived." : "This item is not archived.");
    }
    if (!archived && before.instrument_id) {
      const dup = await one<{ id: number }>(
        db,
        "SELECT id FROM qfinera_fund_watchlist_items WHERE fund_id = $1 AND instrument_id = $2 AND archived_at IS NULL AND id <> $3",
        [ctx.fundId, before.instrument_id, id]
      );
      if (dup) throw conflictError(`${before.symbol} already has an active watchlist item (#${dup.id}).`);
    }
    await db.query(
      `UPDATE qfinera_fund_watchlist_items
          SET archived_at = CASE WHEN $3::boolean THEN now() ELSE NULL END,
              archived_by = CASE WHEN $3::boolean THEN $4::int ELSE NULL END,
              updated_at = now()
        WHERE id = $1 AND fund_id = $2`,
      [id, ctx.fundId, archived, ctx.actor.userId]
    );
    const after = await loadItem(db, ctx.fundId, id);
    await writeAudit(db, {
      fundId: ctx.fundId,
      userId: ctx.actor.userId,
      action: archived ? "watchlist.archived" : "watchlist.restored",
      entityType: "watchlist_item",
      entityId: id,
      before: auditState(before),
      after: auditState(after),
      meta: ctx.meta,
    });
    const [item] = await withQuotes(db, ctx.fundId, [after]);
    return item;
  });
}

export async function addWatchlistComment(ctx: ServiceCtx, id: number, body: string): Promise<WatchlistComment> {
  assertPermission(ctx.actor, "watchlist:comment");
  return inTransaction(async (db) => {
    const item = await loadItem(db, ctx.fundId, id);
    if (item.archived_at) throw conflictError("This item is archived; comments are closed.");
    const row = await one<{ id: number; created_at: Date }>(
      db,
      `INSERT INTO qfinera_fund_watchlist_comments (watchlist_item_id, author_id, body)
       VALUES ($1, $2, $3) RETURNING id, created_at`,
      [id, ctx.actor.userId, body]
    );
    if (!row) throw new Error("comment insert returned no row");
    const author = await one<{ display_name: string }>(db, "SELECT display_name FROM qfinance_users WHERE id = $1", [
      ctx.actor.userId,
    ]);
    await db.query("UPDATE qfinera_fund_watchlist_items SET updated_at = now() WHERE id = $1", [id]);
    return { id: row.id, authorName: author?.display_name ?? "Member", body, createdAt: row.created_at };
  });
}
