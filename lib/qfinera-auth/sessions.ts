// Server-side sessions for QFinera.
//
//   * Cookie: an opaque random token (no personal data), httpOnly,
//     SameSite=Lax, Secure in production, path "/".
//   * Database: only the token's SHA-256 hash, the user, and an ABSOLUTE
//     expiry 30 days after sign-in. Activity does not extend it, so a session
//     can never become permanent; after 30 days the user signs in again.
//   * A new token is issued at every sign-in (and the token presented before
//     sign-in, if any, is revoked), which defeats session fixation.
//   * Revocation: logout, password change/reset, suspension, admin action.
//   * A session is valid only while the account is active.
import { one, type Db } from "@/lib/fund/db";
import type { RequestMeta } from "@/lib/fund/audit";
import { hashSecretToken, isWellFormedSecretToken, newSecretToken } from "@/lib/qfinera-auth/tokens";

export const SESSION_COOKIE = "qf_sid";
export const SESSION_TTL_DAYS = 30;
export const SESSION_TTL_SECONDS = SESSION_TTL_DAYS * 24 * 60 * 60;
/** last_seen_at is refreshed at most this often, to avoid a write per request. */
const TOUCH_INTERVAL_MS = 10 * 60_000;

export type AuthSession = {
  sessionId: number;
  userId: number;
  email: string;
  displayName: string;
  expiresAt: Date;
  emailVerified: boolean;
};

export async function createSession(db: Db, userId: number, meta: RequestMeta | null): Promise<{ token: string; expiresAt: Date }> {
  const token = newSecretToken();
  const row = await one<{ expires_at: Date }>(
    db,
    `INSERT INTO qfinance_sessions (user_id, token_hash, expires_at, ip_address, user_agent)
     VALUES ($1, $2, now() + make_interval(days => $3), $4, $5) RETURNING expires_at`,
    [userId, hashSecretToken(token), SESSION_TTL_DAYS, meta?.ip ?? null, meta?.userAgent ?? null]
  );
  if (!row) throw new Error("session insert returned no row");
  return { token, expiresAt: row.expires_at };
}

/** The live session for a cookie value, or null (missing, malformed, expired, revoked, or account not active). */
export async function getSession(db: Db, token: string | undefined | null): Promise<AuthSession | null> {
  if (!isWellFormedSecretToken(token)) return null;
  const row = await one<{
    id: number;
    user_id: number;
    email: string;
    display_name: string;
    expires_at: Date;
    last_seen_at: Date;
    email_verified_at: Date | null;
  }>(
    db,
    `SELECT s.id, s.user_id, u.email, u.display_name, s.expires_at, s.last_seen_at, u.email_verified_at
       FROM qfinance_sessions s JOIN qfinance_users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now() AND u.status = 'active'`,
    [hashSecretToken(token)]
  );
  if (!row) return null;
  if (Date.now() - row.last_seen_at.getTime() > TOUCH_INTERVAL_MS) {
    await db.query("UPDATE qfinance_sessions SET last_seen_at = now() WHERE id = $1", [row.id]);
  }
  return {
    sessionId: Number(row.id),
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
    expiresAt: row.expires_at,
    emailVerified: row.email_verified_at !== null,
  };
}

export async function revokeSessionByToken(db: Db, token: string | undefined | null, reason: string): Promise<void> {
  if (!isWellFormedSecretToken(token)) return;
  await db.query(
    "UPDATE qfinance_sessions SET revoked_at = now(), revoked_reason = $2 WHERE token_hash = $1 AND revoked_at IS NULL",
    [hashSecretToken(token), reason]
  );
}

/** Revokes every live session of a user (optionally keeping one). Returns how many were revoked. */
export async function revokeUserSessions(db: Db, userId: number, reason: string, exceptSessionId?: number): Promise<number> {
  const res = await db.query(
    `UPDATE qfinance_sessions SET revoked_at = now(), revoked_reason = $2
      WHERE user_id = $1 AND revoked_at IS NULL AND ($3::bigint IS NULL OR id <> $3)`,
    [userId, reason, exceptSessionId ?? null]
  );
  return res.rowCount ?? 0;
}

export type SessionListRow = { id: number; createdAt: Date; lastSeenAt: Date; expiresAt: Date; userAgent: string | null; ipAddress: string | null };

export async function listActiveSessions(db: Db, userId: number): Promise<SessionListRow[]> {
  const { rows } = await db.query<{ id: string; created_at: Date; last_seen_at: Date; expires_at: Date; user_agent: string | null; ip_address: string | null }>(
    `SELECT id, created_at, last_seen_at, expires_at, user_agent, ip_address FROM qfinance_sessions
      WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now() ORDER BY last_seen_at DESC LIMIT 50`,
    [userId]
  );
  return rows.map((r) => ({
    id: Number(r.id),
    createdAt: r.created_at,
    lastSeenAt: r.last_seen_at,
    expiresAt: r.expires_at,
    userAgent: r.user_agent,
    ipAddress: r.ip_address,
  }));
}

export function sessionCookie(token: string, expiresAt: Date) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  };
}

export function clearedSessionCookie() {
  return { name: SESSION_COOKIE, value: "", httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 };
}
