// Pool Chat (migration 016): one private conversation per pool.
//
// Who:
//   * Every ACTIVE member of the pool, VIEWER included, reads and posts
//     (chat:view, chat:post). A suspended or removed member, a member of
//     another pool and an anonymous caller never reach these functions:
//     requireFundContext answers 403/404 first, and the permission is
//     checked again here.
//   * An author edits or removes their own message. An ADMIN
//     (chat:moderate) may also remove anyone's message; that removal is
//     written to the audit log with the reason. Nobody edits another
//     person's message.
// What:
//   * Plain text only, 1..2000 characters after trimming. It is stored as
//     typed and rendered by React as text (never as HTML), so markup in a
//     message is shown, not executed. Control characters other than
//     newline and tab are stripped.
//   * Order is the server's: ids are assigned by the database in insert
//     order, and pages are cut by id. The client's clock is never used.
//   * Ordinary messages are conversation, not accounting: they are not
//     written to the financial audit log.
import { writeAudit } from "@/lib/fund/audit";
import { inTransaction, one, type Db } from "@/lib/fund/db";
import { FundError, conflictError, notFoundError, validationError } from "@/lib/fund/errors";
import { ForbiddenError, assertPermission, hasPermission, type FundActor, type FundRole } from "@/lib/fund/rbac";
import { assertFundActive, type ServiceCtx } from "@/lib/fund/services/types";

export const MAX_MESSAGE_CHARS = 2000;
export const CHAT_PAGE_SIZE = 50;
/** Messages one person may post in one pool per minute. */
export const CHAT_RATE_PER_MINUTE = 20;

export type ChatMessage = {
  id: number;
  userId: number;
  authorName: string;
  /** The author's current role in this pool, or null if they have left it. */
  authorRole: FundRole | null;
  /** Empty for a removed message. */
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  deleted: boolean;
  /** True when someone other than the author removed it. */
  removedByModerator: boolean;
};

type Row = {
  id: number;
  user_id: number;
  author_name: string | null;
  author_role: FundRole | null;
  body: string;
  created_at: Date;
  edited_at: Date | null;
  deleted_at: Date | null;
  deleted_by: number | null;
};

const SELECT = `SELECT m.id, m.user_id, u.display_name AS author_name, fm.role AS author_role, m.body,
                       m.created_at, m.edited_at, m.deleted_at, m.deleted_by
                  FROM qfinera_fund_messages m
                  JOIN qfinance_users u ON u.id = m.user_id
                  LEFT JOIN qfinera_fund_memberships fm
                    ON fm.fund_id = m.fund_id AND fm.user_id = m.user_id AND fm.status <> 'removed'`;

function toMessage(r: Row): ChatMessage {
  const deleted = r.deleted_at !== null;
  return {
    id: r.id,
    userId: r.user_id,
    authorName: r.author_name ?? "Former member",
    authorRole: r.author_role,
    body: deleted ? "" : r.body,
    createdAt: r.created_at,
    editedAt: r.edited_at,
    deleted,
    removedByModerator: deleted && r.deleted_by !== r.user_id,
  };
}

/** Trims, strips control characters (keeping newline and tab), and checks length. */
export function cleanMessageBody(raw: unknown): string {
  if (typeof raw !== "string") throw validationError("Write a message first.", { body: "Required" });
  const body = raw
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f​-‏‪-‮⁦-⁩]/g, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
  if (body.length === 0) throw validationError("Write a message first.", { body: "Required" });
  if (body.length > MAX_MESSAGE_CHARS) {
    throw validationError(`A message can be at most ${MAX_MESSAGE_CHARS} characters.`, { body: "Too long" });
  }
  return body;
}

export type ChatPage = {
  messages: ChatMessage[];
  /** True when older messages exist before the first one returned. */
  hasOlder: boolean;
  /** Active members of this pool (everyone who can read the chat); latest page only. */
  participantCount?: number;
};

/**
 * Messages in server order (oldest first within the page).
 *   default            the latest CHAT_PAGE_SIZE
 *   before = id        the page just older than message `id`
 */
export async function listMessages(
  db: Db,
  actor: FundActor,
  fundId: number,
  opts: { before?: number | null; limit?: number } = {}
): Promise<ChatPage> {
  assertPermission(actor, "chat:view");
  const limit = Math.min(Math.max(opts.limit ?? CHAT_PAGE_SIZE, 1), 100);
  const { rows } = await db.query<Row>(
    `${SELECT}
      WHERE m.fund_id = $1 AND ($2::int IS NULL OR m.id < $2::int)
      ORDER BY m.id DESC
      LIMIT $3`,
    [fundId, opts.before ?? null, limit + 1]
  );
  const hasOlder = rows.length > limit;
  const page: ChatPage = { messages: rows.slice(0, limit).reverse().map(toMessage), hasOlder };
  if (opts.before == null) {
    const count = await one<{ n: number }>(
      db,
      "SELECT COUNT(*)::int AS n FROM qfinera_fund_memberships WHERE fund_id = $1 AND status = 'active'",
      [fundId]
    );
    page.participantCount = count?.n ?? 0;
  }
  return page;
}

async function loadOne(db: Db, fundId: number, id: number, forUpdate = false): Promise<Row | null> {
  // FOR UPDATE cannot apply to the nullable side of the outer join.
  return one<Row>(db, `${SELECT} WHERE m.fund_id = $1 AND m.id = $2 ${forUpdate ? "FOR UPDATE OF m" : ""}`, [fundId, id]);
}

export async function postMessage(ctx: ServiceCtx, rawBody: unknown): Promise<ChatMessage> {
  assertPermission(ctx.actor, "chat:post");
  const body = cleanMessageBody(rawBody);
  return inTransaction(async (db) => {
    await assertFundActive(db, ctx.fundId);
    const recent = await one<{ n: number }>(
      db,
      `SELECT COUNT(*)::int AS n FROM qfinera_fund_messages
        WHERE fund_id = $1 AND user_id = $2 AND created_at > now() - interval '1 minute'`,
      [ctx.fundId, ctx.actor.userId]
    );
    if ((recent?.n ?? 0) >= CHAT_RATE_PER_MINUTE) {
      throw new FundError("RATE_LIMITED", "You are sending messages too quickly. Wait a moment and try again.", 429);
    }
    const inserted = await one<{ id: number }>(
      db,
      "INSERT INTO qfinera_fund_messages (fund_id, user_id, body) VALUES ($1, $2, $3) RETURNING id",
      [ctx.fundId, ctx.actor.userId, body]
    );
    if (!inserted) throw new Error("message insert returned no row");
    const row = await loadOne(db, ctx.fundId, inserted.id);
    if (!row) throw new Error("inserted message not found");
    return toMessage(row);
  });
}

/** The author edits their own live message. Nobody edits someone else's. */
export async function editMessage(ctx: ServiceCtx, id: number, rawBody: unknown): Promise<ChatMessage> {
  assertPermission(ctx.actor, "chat:post");
  const body = cleanMessageBody(rawBody);
  return inTransaction(async (db) => {
    await assertFundActive(db, ctx.fundId);
    const row = await loadOne(db, ctx.fundId, id, true);
    if (!row) throw notFoundError("Message");
    if (row.user_id !== ctx.actor.userId) throw new ForbiddenError("You can only edit your own messages.");
    if (row.deleted_at) throw conflictError("This message was removed.");
    if (row.body === body) return toMessage(row);
    await db.query(
      "UPDATE qfinera_fund_messages SET body = $3, edited_at = now(), updated_at = now() WHERE fund_id = $1 AND id = $2",
      [ctx.fundId, id, body]
    );
    const after = await loadOne(db, ctx.fundId, id);
    if (!after) throw notFoundError("Message");
    return toMessage(after);
  });
}

/**
 * The author removes their own message, or an ADMIN removes anyone's
 * (moderation: reason required, written to the audit log). The body is
 * cleared; the row stays so the conversation keeps its shape.
 */
export async function removeMessage(ctx: ServiceCtx, id: number, reason: string | null): Promise<ChatMessage> {
  assertPermission(ctx.actor, "chat:view");
  return inTransaction(async (db) => {
    const row = await loadOne(db, ctx.fundId, id, true);
    if (!row) throw notFoundError("Message");
    const own = row.user_id === ctx.actor.userId;
    if (own) {
      assertPermission(ctx.actor, "chat:post");
    } else if (!hasPermission(ctx.actor, "chat:moderate")) {
      throw new ForbiddenError("You can only remove your own messages.");
    }
    if (row.deleted_at) return toMessage(row);
    const why = reason?.trim() ?? "";
    if (!own && why.length < 3) {
      throw validationError("Give a short reason for removing this message.", { reason: "Required" });
    }
    await db.query(
      `UPDATE qfinera_fund_messages SET body = '', deleted_at = now(), deleted_by = $3, updated_at = now()
        WHERE fund_id = $1 AND id = $2`,
      [ctx.fundId, id, ctx.actor.userId]
    );
    if (!own) {
      await writeAudit(db, {
        fundId: ctx.fundId,
        userId: ctx.actor.userId,
        action: "chat.message_removed",
        entityType: "chat_message",
        entityId: id,
        // The removed text is kept in the audit row so the moderation can be reviewed.
        before: { author_id: row.user_id, body: row.body, created_at: row.created_at.toISOString() },
        after: { removed: true },
        reason: why,
        meta: ctx.meta,
      });
    }
    const after = await loadOne(db, ctx.fundId, id);
    if (!after) throw notFoundError("Message");
    return toMessage(after);
  });
}
