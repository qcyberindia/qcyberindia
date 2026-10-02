// Read models for the QCyberIndia admin's QFinera users section. Never
// selects password hashes or tokens; admins see account metadata only.
import { one, readDb } from "@/lib/fund/db";
import { notFoundError } from "@/lib/fund/errors";

export type AdminUserRow = {
  id: number;
  displayName: string;
  email: string;
  status: string;
  createdAt: Date;
  lastLoginAt: Date | null;
  emailVerified: boolean;
  hasPassword: boolean;
  poolCount: number;
  activeSessions: number;
};

export async function adminListUsers(opts: { q: string | null; status: string | null; pageSize: number; offset: number }) {
  const db = readDb();
  const q = opts.q ? `%${opts.q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
  const where = `($1::text IS NULL OR u.email ILIKE $1 OR u.display_name ILIKE $1) AND ($2::text IS NULL OR u.status = $2)`;
  const total = await one<{ n: number }>(db, `SELECT COUNT(*)::int AS n FROM qfinance_users u WHERE ${where}`, [q, opts.status]);
  const { rows } = await db.query<{
    id: number; display_name: string; email: string; status: string; created_at: Date; last_login_at: Date | null;
    email_verified: boolean; has_password: boolean; pool_count: number; active_sessions: number;
  }>(
    `SELECT u.id, u.display_name, u.email, u.status, u.created_at, u.last_login_at,
            (u.email_verified_at IS NOT NULL) AS email_verified, (u.password_hash IS NOT NULL) AS has_password,
            (SELECT COUNT(*) FROM qfinera_fund_memberships m WHERE m.user_id = u.id AND m.status <> 'removed')::int AS pool_count,
            (SELECT COUNT(*) FROM qfinance_sessions s WHERE s.user_id = u.id AND s.revoked_at IS NULL AND s.expires_at > now())::int AS active_sessions
       FROM qfinance_users u WHERE ${where}
      ORDER BY u.created_at DESC, u.id DESC LIMIT $3 OFFSET $4`,
    [q, opts.status, opts.pageSize, opts.offset]
  );
  return {
    total: total?.n ?? 0,
    users: rows.map<AdminUserRow>((r) => ({
      id: r.id,
      displayName: r.display_name,
      email: r.email,
      status: r.status,
      createdAt: r.created_at,
      lastLoginAt: r.last_login_at,
      emailVerified: r.email_verified,
      hasPassword: r.has_password,
      poolCount: r.pool_count,
      activeSessions: r.active_sessions,
    })),
  };
}

export async function adminGetUser(id: number) {
  const db = readDb();
  const user = await one<{
    id: number; display_name: string; email: string; status: string; created_at: Date; last_login_at: Date | null;
    email_verified_at: Date | null; password_updated_at: Date | null; has_password: boolean;
  }>(
    db,
    `SELECT id, display_name, email, status, created_at, last_login_at, email_verified_at, password_updated_at,
            (password_hash IS NOT NULL) AS has_password
       FROM qfinance_users WHERE id = $1`,
    [id]
  );
  if (!user) throw notFoundError("User");
  const [memberships, sessions, events, community] = await Promise.all([
    db.query<{ fund_id: number; name: string; role: string; status: string; joined_at: Date }>(
      `SELECT m.fund_id, f.name, m.role, m.status, m.joined_at FROM qfinera_fund_memberships m
         JOIN qfinera_funds f ON f.id = m.fund_id WHERE m.user_id = $1 ORDER BY m.joined_at`,
      [id]
    ),
    db.query<{ id: string; created_at: Date; last_seen_at: Date; expires_at: Date; user_agent: string | null }>(
      `SELECT id, created_at, last_seen_at, expires_at, user_agent FROM qfinance_sessions
        WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now() ORDER BY last_seen_at DESC LIMIT 20`,
      [id]
    ),
    db.query<{ id: string; action: string; details: Record<string, unknown> | null; created_at: Date }>(
      "SELECT id, action, details, created_at FROM qfinance_admin_audit WHERE user_id = $1 ORDER BY id DESC LIMIT 50",
      [id]
    ),
    one<{ posts: number; replies: number }>(
      db,
      `SELECT (SELECT COUNT(*) FROM qfinance_community_posts WHERE author_id = $1)::int AS posts,
              (SELECT COUNT(*) FROM qfinance_community_replies WHERE author_id = $1)::int AS replies`,
      [id]
    ),
  ]);
  return {
    user: {
      id: user.id,
      displayName: user.display_name,
      email: user.email,
      status: user.status,
      createdAt: user.created_at,
      lastLoginAt: user.last_login_at,
      emailVerifiedAt: user.email_verified_at,
      passwordUpdatedAt: user.password_updated_at,
      hasPassword: user.has_password,
    },
    memberships: memberships.rows.map((m) => ({ poolId: m.fund_id, poolName: m.name, role: m.role, status: m.status, joinedAt: m.joined_at })),
    sessions: sessions.rows.map((s) => ({ id: Number(s.id), createdAt: s.created_at, lastSeenAt: s.last_seen_at, expiresAt: s.expires_at, userAgent: s.user_agent })),
    events: events.rows.map((e) => ({ id: Number(e.id), action: e.action, details: e.details, createdAt: e.created_at })),
    community: community ?? { posts: 0, replies: 0 },
  };
}

export async function adminCountUsers(): Promise<number> {
  const row = await one<{ n: number }>(readDb(), "SELECT COUNT(*)::int AS n FROM qfinance_users");
  return row?.n ?? 0;
}
