// Pool invitations.
//
// Security model:
//   * The token is 32 random bytes (base64url). Only its SHA-256 hash is
//     stored; the raw token exists once, in the invite link.
//   * An invite is bound to an email address: it can only be accepted by a
//     signed-in QFinera account with that email (magic-link sign-in proves
//     control of the address). A forwarded link is useless to anyone else.
//   * Single use, expires after INVITE_TTL_DAYS, revocable. At most one open
//     invite per (pool, email) (unique index from migration 008).
//   * Accepting never grants units: units come only from contributions.
//   * An invalid, expired, used or revoked token gets the same answer, so a
//     token's state cannot be probed.
import { createHash, randomBytes } from "node:crypto";
import { writeAudit, type RequestMeta } from "@/lib/fund/audit";
import { inTransaction, lockFund, one, type Db } from "@/lib/fund/db";
import { FundError, conflictError, notFoundError } from "@/lib/fund/errors";
import { assertPermission, canInviteRole, type FundRole } from "@/lib/fund/rbac";
import { INVITE_TTL_DAYS, MAX_POOL_MEMBERS } from "@/lib/fund/product-gate";
import { assertFundActive, isUniqueViolation, type ServiceCtx } from "@/lib/fund/services/types";

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function newInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Shape check before any lookup: 43 base64url characters. */
export function isWellFormedInviteToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export type InviteStatus = "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";

export type InviteRow = {
  id: number;
  email: string;
  role: FundRole;
  status: InviteStatus;
  createdByName: string | null;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
};

const INVITE_SELECT = `
  SELECT i.id, i.email, i.role, i.created_at, i.expires_at, i.used_at, i.revoked_at, u.display_name AS created_by_name,
         CASE WHEN i.used_at IS NOT NULL THEN 'ACCEPTED'
              WHEN i.revoked_at IS NOT NULL THEN 'REVOKED'
              WHEN i.expires_at <= now() THEN 'EXPIRED'
              ELSE 'PENDING' END AS status
    FROM qfinera_fund_invites i
    LEFT JOIN qfinance_users u ON u.id = i.created_by`;

type InviteDbRow = {
  id: number;
  email: string;
  role: FundRole;
  created_at: Date;
  expires_at: Date;
  used_at: Date | null;
  revoked_at: Date | null;
  created_by_name: string | null;
  status: InviteStatus;
};

function toInvite(r: InviteDbRow): InviteRow {
  return {
    id: r.id,
    email: r.email,
    role: r.role,
    status: r.status,
    createdByName: r.created_by_name,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    usedAt: r.used_at,
    revokedAt: r.revoked_at,
  };
}

async function countSeats(db: Db, fundId: number): Promise<number> {
  const row = await one<{ n: number }>(
    db,
    `SELECT ((SELECT COUNT(*) FROM qfinera_fund_memberships WHERE fund_id = $1 AND status <> 'removed')
           + (SELECT COUNT(*) FROM qfinera_fund_invites
               WHERE fund_id = $1 AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now()))::int AS n`,
    [fundId]
  );
  return row?.n ?? 0;
}

export async function listInvites(db: Db, ctx: ServiceCtx): Promise<InviteRow[]> {
  assertPermission(ctx.actor, "members:invite");
  const { rows } = await db.query<InviteDbRow>(
    `${INVITE_SELECT} WHERE i.fund_id = $1 ORDER BY i.created_at DESC, i.id DESC LIMIT 200`,
    [ctx.fundId]
  );
  return rows.map(toInvite);
}

/** Creates an invite. The raw token is returned ONCE, to build the link. */
export async function createInvite(
  ctx: ServiceCtx,
  input: { email: string; role: FundRole }
): Promise<{ invite: InviteRow; token: string }> {
  assertPermission(ctx.actor, "members:invite");
  if (!canInviteRole(ctx.actor, input.role)) {
    throw new FundError("FORBIDDEN", "You can only invite people with the Member role.", 403);
  }
  const email = input.email.trim().toLowerCase();
  const token = newInviteToken();

  try {
    return await inTransaction(async (db) => {
      await lockFund(db, ctx.fundId);
      await assertFundActive(db, ctx.fundId);

      const member = await one<{ status: string }>(
        db,
        `SELECT m.status FROM qfinera_fund_memberships m JOIN qfinance_users u ON u.id = m.user_id
          WHERE m.fund_id = $1 AND lower(u.email) = $2`,
        [ctx.fundId, email]
      );
      if (member && member.status !== "removed") throw conflictError("That person is already a member of this pool.");

      // An expired, unused invite still occupies the "one open invite" slot: retire it.
      await db.query(
        `UPDATE qfinera_fund_invites SET revoked_at = now(), revoked_by = $3
          WHERE fund_id = $1 AND lower(email) = $2 AND used_at IS NULL AND revoked_at IS NULL AND expires_at <= now()`,
        [ctx.fundId, email, ctx.actor.userId]
      );
      if ((await countSeats(db, ctx.fundId)) >= MAX_POOL_MEMBERS) {
        throw conflictError(`A pool can have at most ${MAX_POOL_MEMBERS} members, including pending invites.`);
      }

      const ins = await one<{ id: number }>(
        db,
        `INSERT INTO qfinera_fund_invites (fund_id, email, role, token_hash, created_by, expires_at)
         VALUES ($1, $2, $3, $4, $5, now() + make_interval(days => $6)) RETURNING id`,
        [ctx.fundId, email, input.role, hashInviteToken(token), ctx.actor.userId, INVITE_TTL_DAYS]
      );
      if (!ins) throw new Error("invite insert returned no row");
      const row = await one<InviteDbRow>(db, `${INVITE_SELECT} WHERE i.id = $1`, [ins.id]);
      if (!row) throw new Error("invite not found after insert");

      await writeAudit(db, {
        fundId: ctx.fundId,
        userId: ctx.actor.userId,
        action: "invite.created",
        entityType: "invite",
        entityId: ins.id,
        after: { email, role: input.role, expires_at: row.expires_at.toISOString() },
        meta: ctx.meta,
      });
      return { invite: toInvite(row), token };
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw conflictError("There is already an open invite for that email.");
    throw err;
  }
}

export async function revokeInvite(ctx: ServiceCtx, id: number): Promise<InviteRow> {
  assertPermission(ctx.actor, "members:invite");
  return inTransaction(async (db) => {
    const before = await one<InviteDbRow>(db, `${INVITE_SELECT} WHERE i.id = $1 AND i.fund_id = $2 FOR UPDATE OF i`, [
      id,
      ctx.fundId,
    ]);
    if (!before) throw notFoundError("Invite");
    if (before.status !== "PENDING") throw conflictError(`This invite is already ${before.status.toLowerCase()}.`);
    await db.query("UPDATE qfinera_fund_invites SET revoked_at = now(), revoked_by = $2 WHERE id = $1", [id, ctx.actor.userId]);
    const after = await one<InviteDbRow>(db, `${INVITE_SELECT} WHERE i.id = $1`, [id]);
    await writeAudit(db, {
      fundId: ctx.fundId,
      userId: ctx.actor.userId,
      action: "invite.revoked",
      entityType: "invite",
      entityId: id,
      before: { status: before.status, email: before.email },
      after: { status: after?.status ?? "REVOKED", email: before.email },
      meta: ctx.meta,
    });
    if (!after) throw notFoundError("Invite");
    return toInvite(after);
  });
}

const INVALID_INVITE = () =>
  new FundError("NOT_FOUND", "This invite link is not valid. It may have expired, been used, or been revoked.", 404);

type OpenInvite = { id: number; fund_id: number; email: string; role: FundRole; expires_at: Date; pool_name: string; inviter: string | null };

async function findOpenInvite(db: Db, token: string, lock: boolean): Promise<OpenInvite> {
  if (!isWellFormedInviteToken(token)) throw INVALID_INVITE();
  const row = await one<OpenInvite>(
    db,
    `SELECT i.id, i.fund_id, i.email, i.role, i.expires_at, f.name AS pool_name, u.display_name AS inviter
       FROM qfinera_fund_invites i
       JOIN qfinera_funds f ON f.id = i.fund_id
       LEFT JOIN qfinance_users u ON u.id = i.created_by
      WHERE i.token_hash = $1 AND i.used_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now()
        AND f.status = 'active' AND f.deleted_at IS NULL
      ${lock ? "FOR UPDATE OF i" : ""}`,
    [hashInviteToken(token)]
  );
  if (!row) throw INVALID_INVITE();
  return row;
}

export type InvitePreview = {
  poolName: string;
  invitedBy: string | null;
  role: FundRole;
  expiresAt: Date;
  /** Whether the signed-in account's email is the invited one. The invited email itself is not revealed. */
  emailMatches: boolean;
};

export async function previewInvite(db: Db, token: string, sessionEmail: string): Promise<InvitePreview> {
  const inv = await findOpenInvite(db, token, false);
  return {
    poolName: inv.pool_name,
    invitedBy: inv.inviter,
    role: inv.role,
    expiresAt: inv.expires_at,
    emailMatches: inv.email.toLowerCase() === sessionEmail.trim().toLowerCase(),
  };
}

export async function acceptInvite(
  session: { userId: number; email: string; meta?: RequestMeta | null },
  token: string
): Promise<{ poolId: number; role: FundRole }> {
  return inTransaction(async (db) => {
    const inv = await findOpenInvite(db, token, true);
    await lockFund(db, inv.fund_id);
    const user = await one<{ email: string; status: string; email_verified_at: Date | null }>(
      db,
      "SELECT email, status, email_verified_at FROM qfinance_users WHERE id = $1",
      [session.userId]
    );
    if (!user || user.status !== "active") throw new FundError("FORBIDDEN", "Your QFinera account is not active.", 403);
    // The invite is bound to an email address, so the address must be proven.
    if (!user.email_verified_at) throw new FundError("FORBIDDEN", "Confirm your email address before joining a pool.", 403);
    if (user.email.toLowerCase() !== inv.email.toLowerCase()) {
      throw new FundError(
        "FORBIDDEN",
        "This invite was sent to a different email address. Sign in with the invited email to accept it.",
        403
      );
    }

    const existing = await one<{ status: string }>(
      db,
      "SELECT status FROM qfinera_fund_memberships WHERE fund_id = $1 AND user_id = $2 FOR UPDATE",
      [inv.fund_id, session.userId]
    );
    if (existing?.status === "active") throw conflictError("You are already a member of this pool.");
    if (existing?.status === "suspended") {
      throw new FundError("FORBIDDEN", "Your membership of this pool is suspended. Contact the pool administrator.", 403);
    }
    const seats = await one<{ n: number }>(
      db,
      "SELECT COUNT(*)::int AS n FROM qfinera_fund_memberships WHERE fund_id = $1 AND status <> 'removed'",
      [inv.fund_id]
    );
    if ((seats?.n ?? 0) >= MAX_POOL_MEMBERS) throw conflictError("This pool is full.");

    if (existing) {
      // A removed member returning: their history is kept, units are zero (CHECK in migration 009).
      await db.query(
        `UPDATE qfinera_fund_memberships SET status = 'active', role = $3, removed_at = NULL, removed_by = NULL, updated_at = now()
          WHERE fund_id = $1 AND user_id = $2`,
        [inv.fund_id, session.userId, inv.role]
      );
    } else {
      await db.query(
        `INSERT INTO qfinera_fund_memberships (fund_id, user_id, role, status, units) VALUES ($1, $2, $3, 'active', 0)`,
        [inv.fund_id, session.userId, inv.role]
      );
    }
    await db.query("UPDATE qfinera_fund_invites SET used_at = now(), used_by = $2 WHERE id = $1", [inv.id, session.userId]);
    await writeAudit(db, {
      fundId: inv.fund_id,
      userId: session.userId,
      action: existing ? "member.rejoined" : "member.joined",
      entityType: "member",
      entityId: session.userId,
      after: { role: inv.role, status: "active", invite_id: inv.id },
      meta: session.meta,
    });
    return { poolId: inv.fund_id, role: inv.role };
  });
}

/** Invites addressed to this email that can still be accepted (for the pools page). */
export async function pendingInvitesFor(db: Db, email: string): Promise<Array<{ poolName: string; role: FundRole; expiresAt: Date }>> {
  const { rows } = await db.query<{ pool_name: string; role: FundRole; expires_at: Date }>(
    `SELECT f.name AS pool_name, i.role, i.expires_at
       FROM qfinera_fund_invites i JOIN qfinera_funds f ON f.id = i.fund_id
      WHERE lower(i.email) = lower($1) AND i.used_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now()
        AND f.status = 'active' AND f.deleted_at IS NULL
      ORDER BY i.created_at DESC LIMIT 20`,
    [email]
  );
  return rows.map((r) => ({ poolName: r.pool_name, role: r.role, expiresAt: r.expires_at }));
}
