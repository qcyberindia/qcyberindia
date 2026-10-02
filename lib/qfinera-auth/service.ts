// QFinera account service: registration, email verification, sign-in,
// sign-out, password reset/change, profile, and QCyberIndia-admin actions.
//
// Identity is qfinance_users (the one canonical user table). Error messages
// are deliberately generic wherever an answer could reveal whether an email
// is registered: registration and password-reset ALWAYS give the same
// response, and a failed sign-in never says which part was wrong.
import type { RequestMeta } from "@/lib/fund/audit";
import { inTransaction, one, readDb, type Db } from "@/lib/fund/db";
import { FundError, validationError } from "@/lib/fund/errors";
import {
  sendAlreadyRegisteredEmail,
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
  sendVerifyEmail,
} from "@/lib/qfinera-auth/emails";
import { burnTime, hashPassword, needsRehash, passwordProblem, verifyPassword } from "@/lib/qfinera-auth/password";
import { assertUnderLimit, clear, consume, record } from "@/lib/qfinera-auth/rate-limit";
import { createSession, revokeSessionByToken, revokeUserSessions, type AuthSession } from "@/lib/qfinera-auth/sessions";
import { hashSecretToken, isWellFormedSecretToken, newSecretToken } from "@/lib/qfinera-auth/tokens";

export const VERIFY_TTL_HOURS = 24;
export const RESET_TTL_MINUTES = 30;

const WINDOW = 15;
export const LIMITS = {
  loginIp: (ip: string) => ({ bucket: `login:ip:${ip}`, max: 40, windowMinutes: WINDOW }),
  loginFailEmail: (email: string) => ({ bucket: `login-fail:email:${email}`, max: 8, windowMinutes: WINDOW }),
  registerIp: (ip: string) => ({ bucket: `register:ip:${ip}`, max: 10, windowMinutes: 60 }),
  registerEmail: (email: string) => ({ bucket: `register:email:${email}`, max: 3, windowMinutes: 60 }),
  resetIp: (ip: string) => ({ bucket: `reset:ip:${ip}`, max: 10, windowMinutes: 60 }),
  resetEmail: (email: string) => ({ bucket: `reset:email:${email}`, max: 3, windowMinutes: 60 }),
  tokenIp: (ip: string) => ({ bucket: `token:ip:${ip}`, max: 30, windowMinutes: WINDOW }),
};

const GENERIC_LOGIN_ERROR = () => new FundError("UNAUTHENTICATED", "Email or password is incorrect.", 401);
const INVALID_LINK = () =>
  new FundError("NOT_FOUND", "This link is not valid. It may have expired or already been used. Request a new one.", 404);

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const ipOf = (meta: RequestMeta | null | undefined) => meta?.ip ?? "unknown";

function assertPassword(password: string, confirm: string, context: { email?: string; displayName?: string }) {
  const problem = passwordProblem(password, context);
  if (problem) throw validationError(problem, { password: problem });
  if (password !== confirm) throw validationError("The passwords do not match.", { confirmPassword: "Does not match" });
}

type UserRow = {
  id: number;
  email: string;
  display_name: string;
  status: string;
  password_hash: string | null;
  email_verified_at: Date | null;
};

async function findUserByEmail(db: Db, email: string, lock = false): Promise<UserRow | null> {
  return one<UserRow>(
    db,
    `SELECT id, email, display_name, status, password_hash, email_verified_at
       FROM qfinance_users WHERE lower(email) = $1 ${lock ? "FOR UPDATE" : ""}`,
    [email]
  );
}

async function issueToken(
  db: Db,
  userId: number,
  purpose: "EMAIL_VERIFY" | "PASSWORD_RESET",
  ttl: { hours?: number; minutes?: number },
  pendingPasswordHash: string | null = null
): Promise<string> {
  // Only the newest link of each kind works.
  await db.query("UPDATE qfinance_auth_tokens SET used_at = now() WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL", [userId, purpose]);
  const token = newSecretToken();
  await db.query(
    `INSERT INTO qfinance_auth_tokens (user_id, purpose, token_hash, pending_password_hash, expires_at)
     VALUES ($1, $2, $3, $4, now() + make_interval(hours => $5, mins => $6))`,
    [userId, purpose, hashSecretToken(token), pendingPasswordHash, ttl.hours ?? 0, ttl.minutes ?? 0]
  );
  return token;
}

// ------------------------------------------------------------- register

export type RegisterInput = { displayName: string; email: string; password: string; confirmPassword: string; acceptTerms: boolean };

/**
 * Always resolves the same way for a well-formed request, whether or not the
 * email is registered. New and not-yet-verified accounts get a verification
 * link carrying the chosen password as a pending hash; verified accounts get
 * an "you already have an account" email instead.
 */
export async function register(input: RegisterInput, meta: RequestMeta | null): Promise<void> {
  const email = normalizeEmail(input.email);
  const displayName = input.displayName.trim();
  if (!input.acceptTerms) throw validationError("Please accept the terms to continue.", { acceptTerms: "Required" });
  assertPassword(input.password, input.confirmPassword, { email, displayName });

  const db = readDb();
  await consume(db, [LIMITS.registerIp(ipOf(meta)), LIMITS.registerEmail(email)]);
  // Hash before any lookup so the response time does not depend on whether the account exists.
  const pendingHash = await hashPassword(input.password);

  const outcome = await inTransaction(async (tx) => {
    let user = await findUserByEmail(tx, email, true);
    if (user && user.status !== "active") return { kind: "silent" as const };
    if (user?.email_verified_at && user.password_hash) return { kind: "existing" as const, user };
    if (!user) {
      user = await one<UserRow>(
        tx,
        `INSERT INTO qfinance_users (email, display_name) VALUES ($1, $2)
         RETURNING id, email, display_name, status, password_hash, email_verified_at`,
        [email, displayName]
      );
      if (!user) throw new Error("user insert returned no row");
    }
    const token = await issueToken(tx, user.id, "EMAIL_VERIFY", { hours: VERIFY_TTL_HOURS }, pendingHash);
    return { kind: "verify" as const, user, token };
  });

  if (outcome.kind === "existing") await sendAlreadyRegisteredEmail(outcome.user.email, outcome.user.display_name);
  if (outcome.kind === "verify") await sendVerifyEmail(outcome.user.email, outcome.user.display_name, outcome.token);
}

/**
 * Opens the verification link. The person must re-enter the password chosen
 * at registration: only the inbox owner who also knows that password can
 * activate the account. Success signs them in.
 */
export async function verifyEmail(
  input: { token: string; password: string },
  meta: RequestMeta | null
): Promise<{ session: { token: string; expiresAt: Date }; userId: number }> {
  const db = readDb();
  await consume(db, [LIMITS.tokenIp(ipOf(meta))]);
  if (!isWellFormedSecretToken(input.token)) throw INVALID_LINK();

  return inTransaction(async (tx) => {
    const row = await one<{ id: number; user_id: number; pending_password_hash: string | null; status: string }>(
      tx,
      `SELECT t.id, t.user_id, t.pending_password_hash, u.status
         FROM qfinance_auth_tokens t JOIN qfinance_users u ON u.id = t.user_id
        WHERE t.token_hash = $1 AND t.purpose = 'EMAIL_VERIFY' AND t.used_at IS NULL AND t.expires_at > now()
        FOR UPDATE OF t`,
      [hashSecretToken(input.token)]
    );
    if (!row || row.status !== "active" || !row.pending_password_hash) throw INVALID_LINK();
    if (!(await verifyPassword(input.password, row.pending_password_hash))) {
      throw new FundError("UNAUTHENTICATED", "That is not the password you chose when you registered.", 401);
    }
    await tx.query("UPDATE qfinance_auth_tokens SET used_at = now() WHERE id = $1", [row.id]);
    await tx.query(
      `UPDATE qfinance_users
          SET password_hash = $2, password_updated_at = now(), email_verified_at = COALESCE(email_verified_at, now()),
              last_login_at = now(), updated_at = now()
        WHERE id = $1`,
      [row.user_id, row.pending_password_hash]
    );
    await revokeUserSessions(tx, row.user_id, "password-set");
    const session = await createSession(tx, row.user_id, meta ?? null);
    return { session, userId: row.user_id };
  });
}

// ------------------------------------------------------------- sign in/out

export async function login(
  input: { email: string; password: string; previousToken?: string | null },
  meta: RequestMeta | null
): Promise<{ token: string; expiresAt: Date; userId: number }> {
  const email = normalizeEmail(input.email);
  const db = readDb();
  await consume(db, [LIMITS.loginIp(ipOf(meta))]);
  await assertUnderLimit(db, LIMITS.loginFailEmail(email));

  const user = await findUserByEmail(db, email);
  const ok = user?.password_hash ? await verifyPassword(input.password, user.password_hash) : (await burnTime(input.password), false);
  if (!user || !ok) {
    await record(db, LIMITS.loginFailEmail(email).bucket);
    throw GENERIC_LOGIN_ERROR();
  }
  // The password was right: it is now safe to say why sign-in cannot proceed.
  if (user.status !== "active") {
    throw new FundError("FORBIDDEN", "This account is suspended. Contact QFinera support.", 403);
  }
  if (!user.email_verified_at) {
    throw new FundError("FORBIDDEN", "Confirm your email first, using the link we sent when you registered.", 403);
  }
  await clear(db, LIMITS.loginFailEmail(email).bucket);

  const upgraded = needsRehash(user.password_hash as string) ? await hashPassword(input.password) : null;
  return inTransaction(async (tx) => {
    // Session fixation: whatever session token came in with this request is retired.
    await revokeSessionByToken(tx, input.previousToken, "replaced-at-login");
    if (upgraded) await tx.query("UPDATE qfinance_users SET password_hash = $2 WHERE id = $1", [user.id, upgraded]);
    await tx.query("UPDATE qfinance_users SET last_login_at = now() WHERE id = $1", [user.id]);
    const session = await createSession(tx, user.id, meta);
    return { ...session, userId: user.id };
  });
}

export async function logout(token: string | null | undefined): Promise<void> {
  await revokeSessionByToken(readDb(), token, "logout");
}

// ------------------------------------------------------------- password reset

/** Always resolves the same way. Sends a link only to an existing, active account. */
export async function requestPasswordReset(emailInput: string, meta: RequestMeta | null): Promise<void> {
  const email = normalizeEmail(emailInput);
  const db = readDb();
  await consume(db, [LIMITS.resetIp(ipOf(meta)), LIMITS.resetEmail(email)]);
  const user = await findUserByEmail(db, email);
  if (!user || user.status !== "active") return;
  const token = await inTransaction((tx) => issueToken(tx, user.id, "PASSWORD_RESET", { minutes: RESET_TTL_MINUTES }));
  await sendPasswordResetEmail(user.email, user.display_name, token);
}

/** Sets a new password from a reset link and signs the account out everywhere. Does not sign in. */
export async function resetPassword(input: { token: string; password: string; confirmPassword: string }, meta: RequestMeta | null): Promise<void> {
  const db = readDb();
  await consume(db, [LIMITS.tokenIp(ipOf(meta))]);
  if (!isWellFormedSecretToken(input.token)) throw INVALID_LINK();
  const row = await one<{ id: number; user_id: number; email: string; display_name: string; status: string }>(
    db,
    `SELECT t.id, t.user_id, u.email, u.display_name, u.status
       FROM qfinance_auth_tokens t JOIN qfinance_users u ON u.id = t.user_id
      WHERE t.token_hash = $1 AND t.purpose = 'PASSWORD_RESET' AND t.used_at IS NULL AND t.expires_at > now()`,
    [hashSecretToken(input.token)]
  );
  if (!row || row.status !== "active") throw INVALID_LINK();
  assertPassword(input.password, input.confirmPassword, { email: row.email, displayName: row.display_name });
  const hash = await hashPassword(input.password);

  await inTransaction(async (tx) => {
    const claimed = await tx.query(
      "UPDATE qfinance_auth_tokens SET used_at = now() WHERE id = $1 AND used_at IS NULL AND expires_at > now()",
      [row.id]
    );
    if (claimed.rowCount !== 1) throw INVALID_LINK(); // used concurrently
    await tx.query(
      "UPDATE qfinance_auth_tokens SET used_at = now() WHERE user_id = $1 AND purpose = 'PASSWORD_RESET' AND used_at IS NULL",
      [row.user_id]
    );
    // Opening the emailed link proves ownership of the address.
    await tx.query(
      `UPDATE qfinance_users SET password_hash = $2, password_updated_at = now(),
              email_verified_at = COALESCE(email_verified_at, now()), updated_at = now()
        WHERE id = $1`,
      [row.user_id, hash]
    );
    await revokeUserSessions(tx, row.user_id, "password-reset");
  });
  await clear(db, LIMITS.loginFailEmail(row.email.toLowerCase()).bucket);
  await sendPasswordChangedEmail(row.email, row.display_name);
}

// ------------------------------------------------------------- account

/** Requires the current password. All sessions are revoked and the current one is replaced. */
export async function changePassword(
  session: AuthSession,
  input: { currentPassword: string; password: string; confirmPassword: string },
  meta: RequestMeta | null
): Promise<{ token: string; expiresAt: Date }> {
  const db = readDb();
  await consume(db, [LIMITS.loginIp(ipOf(meta))]);
  await assertUnderLimit(db, LIMITS.loginFailEmail(session.email));
  const user = await one<{ password_hash: string | null }>(db, "SELECT password_hash FROM qfinance_users WHERE id = $1", [session.userId]);
  if (!user?.password_hash || !(await verifyPassword(input.currentPassword, user.password_hash))) {
    await record(db, LIMITS.loginFailEmail(session.email).bucket);
    throw new FundError("UNAUTHENTICATED", "Your current password is incorrect.", 401);
  }
  assertPassword(input.password, input.confirmPassword, { email: session.email, displayName: session.displayName });
  const hash = await hashPassword(input.password);
  const fresh = await inTransaction(async (tx) => {
    await tx.query("UPDATE qfinance_users SET password_hash = $2, password_updated_at = now(), updated_at = now() WHERE id = $1", [
      session.userId,
      hash,
    ]);
    await revokeUserSessions(tx, session.userId, "password-change");
    return createSession(tx, session.userId, meta);
  });
  await sendPasswordChangedEmail(session.email, session.displayName);
  return fresh;
}

export async function updateDisplayName(userId: number, displayName: string): Promise<string> {
  const name = displayName.trim();
  if (name.length < 2 || name.length > 60) throw validationError("Display name must be 2 to 60 characters.", { displayName: "2 to 60 characters" });
  await readDb().query("UPDATE qfinance_users SET display_name = $2, updated_at = now() WHERE id = $1", [userId, name]);
  return name;
}

export type AccountView = {
  userId: number;
  displayName: string;
  email: string;
  status: string;
  createdAt: Date;
  lastLoginAt: Date | null;
  passwordUpdatedAt: Date | null;
  emailVerifiedAt: Date | null;
};

export async function getAccount(userId: number): Promise<AccountView | null> {
  const row = await one<{
    id: number; display_name: string; email: string; status: string; created_at: Date;
    last_login_at: Date | null; password_updated_at: Date | null; email_verified_at: Date | null;
  }>(
    readDb(),
    `SELECT id, display_name, email, status, created_at, last_login_at, password_updated_at, email_verified_at
       FROM qfinance_users WHERE id = $1`,
    [userId]
  );
  return row
    ? {
        userId: row.id,
        displayName: row.display_name,
        email: row.email,
        status: row.status,
        createdAt: row.created_at,
        lastLoginAt: row.last_login_at,
        passwordUpdatedAt: row.password_updated_at,
        emailVerifiedAt: row.email_verified_at,
      }
    : null;
}

// ------------------------------------------------------------- admin

async function adminAudit(db: Db, userId: number, action: string, details: Record<string, unknown>, ip: string | null) {
  await db.query("INSERT INTO qfinance_admin_audit (user_id, action, details, ip_address) VALUES ($1, $2, $3::jsonb, $4)", [
    userId,
    action,
    JSON.stringify(details),
    ip,
  ]);
}

/** Suspend (also signs out everywhere) or restore an account. */
export async function adminSetUserStatus(userId: number, status: "active" | "suspended", reason: string, ip: string | null): Promise<void> {
  await inTransaction(async (tx) => {
    const row = await one<{ status: string }>(tx, "SELECT status FROM qfinance_users WHERE id = $1 FOR UPDATE", [userId]);
    if (!row) throw new FundError("NOT_FOUND", "User not found.", 404);
    if (row.status === status) throw new FundError("CONFLICT", `The account is already ${status}.`, 409);
    await tx.query("UPDATE qfinance_users SET status = $2, updated_at = now() WHERE id = $1", [userId, status]);
    const revoked = status === "suspended" ? await revokeUserSessions(tx, userId, "suspended") : 0;
    await adminAudit(tx, userId, status === "suspended" ? "user.suspended" : "user.restored", { reason, sessions_revoked: revoked }, ip);
  });
}

export async function adminRevokeSessions(userId: number, reason: string, ip: string | null): Promise<number> {
  return inTransaction(async (tx) => {
    const exists = await one<{ id: number }>(tx, "SELECT id FROM qfinance_users WHERE id = $1", [userId]);
    if (!exists) throw new FundError("NOT_FOUND", "User not found.", 404);
    const n = await revokeUserSessions(tx, userId, "admin");
    await adminAudit(tx, userId, "user.sessions_revoked", { reason, sessions_revoked: n }, ip);
    return n;
  });
}

/** Emails the user a reset link. The admin never sees the token or any password. */
export async function adminSendPasswordReset(userId: number, ip: string | null): Promise<void> {
  const user = await one<{ email: string; display_name: string; status: string }>(
    readDb(),
    "SELECT email, display_name, status FROM qfinance_users WHERE id = $1",
    [userId]
  );
  if (!user) throw new FundError("NOT_FOUND", "User not found.", 404);
  if (user.status !== "active") throw new FundError("CONFLICT", "Restore the account before sending a reset link.", 409);
  const token = await inTransaction(async (tx) => {
    const t = await issueToken(tx, userId, "PASSWORD_RESET", { minutes: RESET_TTL_MINUTES });
    await adminAudit(tx, userId, "user.password_reset_sent", {}, ip);
    return t;
  });
  await sendPasswordResetEmail(user.email, user.display_name, token);
}
