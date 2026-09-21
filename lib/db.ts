import { Pool } from "pg";

// Lazily-created singleton pool, mirroring lib/email.ts's pattern: if
// DATABASE_URL isn't set, every function here becomes a safe no-op instead
// of crashing the request. This lets local dev and early deploys work
// before a database is provisioned.
let pool: Pool | null = null;
let triedInit = false;

function getPool(): Pool | null {
  if (pool) return pool;
  if (triedInit) return null; // already tried and failed/skipped
  triedInit = true;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;

  pool = new Pool({
    connectionString,
    // Most managed Postgres providers (Neon, RDS, Supabase) require SSL.
    // Allow opting out for a local/self-hosted DB via DATABASE_SSL=false.
    ssl:
      process.env.DATABASE_SSL === "false"
        ? undefined
        : { rejectUnauthorized: false },
    max: 5,
  });

  return pool;
}

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

// Creates the qbids_registrations table if it doesn't exist yet. Safe to
// call on every request — CREATE TABLE IF NOT EXISTS is idempotent. Avoids
// requiring a separate manual migration step before first deploy.
export async function ensureQbidsTable(): Promise<void> {
  const p = getPool();
  if (!p) return;

  await p.query(`
    CREATE TABLE IF NOT EXISTS qbids_registrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      company TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL,
      portals TEXT[] NOT NULL DEFAULT '{}',
      challenge TEXT,
      status TEXT NOT NULL DEFAULT 'new'
        CHECK (status IN ('new', 'reviewed', 'qualified', 'invited', 'active', 'declined')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

export type QbidsRegistrationRow = {
  id: number;
  name: string;
  company: string;
  email: string;
  phone: string;
  portals: string[];
  challenge: string | null;
  status: string;
  created_at: string;
};

export async function getQbidsRegistrations(): Promise<QbidsRegistrationRow[]> {
  const p = getPool();
  if (!p) return [];

  const { rows } = await p.query(
    `SELECT id, name, company, email, phone, portals, challenge, status, created_at
     FROM qbids_registrations
     ORDER BY created_at DESC`
  );
  return rows;
}

const VALID_STATUSES = ["new", "reviewed", "qualified", "invited", "active", "declined"];

export async function updateQbidsRegistrationStatus(
  id: number,
  status: string
): Promise<{ ok: boolean; error?: string }> {
  if (!VALID_STATUSES.includes(status)) {
    return { ok: false, error: "Invalid status" };
  }

  const p = getPool();
  if (!p) return { ok: false, error: "Database is not configured." };

  try {
    await p.query(`UPDATE qbids_registrations SET status = $1 WHERE id = $2`, [status, id]);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown database error" };
  }
}

export type QbidsRegistrationInput = {
  name: string;
  company: string;
  email: string;
  phone: string;
  portals: string[];
  challenge?: string;
};

export type InsertResult =
  | { ok: true; duplicate: false }
  | { ok: true; duplicate: true }
  | { ok: false; error: string };

// Inserts a new registration. Returns duplicate: true instead of an error
// if the email already exists — a repeat signup shouldn't look like a
// failure to the person submitting it.
export async function insertQbidsRegistration(
  input: QbidsRegistrationInput
): Promise<InsertResult> {
  const p = getPool();
  if (!p) {
    return { ok: false, error: "Database is not configured (DATABASE_URL missing)." };
  }

  try {
    await ensureQbidsTable();

    await p.query(
      `INSERT INTO qbids_registrations (name, company, email, phone, portals, challenge)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        input.name,
        input.company,
        input.email.toLowerCase(),
        input.phone,
        input.portals,
        input.challenge || null,
      ]
    );

    return { ok: true, duplicate: false };
  } catch (err: unknown) {
    // Postgres unique_violation error code
    const code = (err as { code?: string })?.code;
    if (code === "23505") {
      return { ok: true, duplicate: true };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown database error",
    };
  }
}

// ---------------------------------------------------------------------------
// QFinance Community — users, posts, replies, reports. Schema matches
// db/migrations/003_create_qfinance_community.sql; ensureQFinanceCommunityTables
// is an idempotent runtime fallback for the same reason ensureQbidsTable is.
// ---------------------------------------------------------------------------

export async function ensureQFinanceCommunityTables(): Promise<void> {
  const p = getPool();
  if (!p) return;

  await p.query(`
    CREATE TABLE IF NOT EXISTS qfinance_users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS qfinance_community_posts (
      id SERIAL PRIMARY KEY,
      author_id INTEGER NOT NULL REFERENCES qfinance_users(id),
      title TEXT NOT NULL,
      body TEXT,
      category TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden', 'removed')),
      is_seed BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS qfinance_community_replies (
      id SERIAL PRIMARY KEY,
      post_id INTEGER NOT NULL REFERENCES qfinance_community_posts(id),
      author_id INTEGER NOT NULL REFERENCES qfinance_users(id),
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden', 'removed')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS qfinance_community_reports (
      id SERIAL PRIMARY KEY,
      reporter_id INTEGER NOT NULL REFERENCES qfinance_users(id),
      target_type TEXT NOT NULL CHECK (target_type IN ('post', 'reply')),
      target_id INTEGER NOT NULL,
      reason TEXT NOT NULL CHECK (reason IN ('spam', 'scam', 'harassment', 'misleading_claim', 'personal_info', 'other')),
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      resolved_at TIMESTAMPTZ,
      resolved_by TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_qf_posts_created_at ON qfinance_community_posts (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_qf_posts_category ON qfinance_community_posts (category);
    CREATE INDEX IF NOT EXISTS idx_qf_posts_status ON qfinance_community_posts (status);
    CREATE INDEX IF NOT EXISTS idx_qf_replies_post_id ON qfinance_community_replies (post_id);
    CREATE INDEX IF NOT EXISTS idx_qf_reports_status ON qfinance_community_reports (status);

    -- Runtime fallback for the 004 migration, for any deploy that never ran
    -- it: makes body optional even on an already-existing table. A no-op if
    -- the column is already nullable.
    ALTER TABLE qfinance_community_posts ALTER COLUMN body DROP NOT NULL;
  `);
}

const MAX_TITLE_LEN = 150;
const MAX_BODY_LEN = 4000;
const MAX_DISPLAY_NAME_LEN = 40;

export const QFINANCE_COMMUNITY_CATEGORIES = [
  "Getting Started",
  "Stocks",
  "Mutual Funds & ETFs",
  "Markets",
  "Risk & Safety",
  "Costs & Taxes",
  "Apps & Accounts",
  "General",
] as const;

// Lightweight, deterministic keyword heuristic — no external AI service,
// no network call. Good enough for a "here's a starting guess" suggestion
// the user can freely override; never blocks posting if nothing matches.
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Stocks: ["stock", "share", "shares", "equity", "ipo", "dividend"],
  "Mutual Funds & ETFs": ["mutual fund", "mf", "etf", "sip", "nav", "index fund"],
  Markets: ["nifty", "sensex", "market", "index", "bull", "bear", "crash", "rally", "correction"],
  "Risk & Safety": ["scam", "fraud", "safe", "risk", "guarantee", "loss", "lose everything"],
  "Costs & Taxes": ["tax", "brokerage", "charges", "fee", "stt", "gst", "capital gains"],
  "Apps & Accounts": ["demat", "broker", "app", "account", "kyc", "kite", "groww", "zerodha"],
  "Getting Started": ["beginner", "start", "new to", "how do i begin", "first time"],
};

export function suggestQFinanceCategory(question: string): (typeof QFINANCE_COMMUNITY_CATEGORIES)[number] {
  const q = question.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => q.includes(kw))) {
      return category as (typeof QFINANCE_COMMUNITY_CATEGORIES)[number];
    }
  }
  return "General";
}

export type QFinanceUser = { id: number; email: string; display_name: string };

// Passwordless: a "sign up" and "sign in" are the same operation — get or
// create the user row for this email, then a magic link is sent either way.
export async function getOrCreateQFinanceUser(
  email: string,
  displayName: string
): Promise<QFinanceUser | null> {
  const p = getPool();
  if (!p) return null;

  await ensureQFinanceCommunityTables();

  const normalizedEmail = email.toLowerCase().trim();
  const safeDisplayName = displayName.trim().slice(0, MAX_DISPLAY_NAME_LEN) || "QFinance Member";

  const existing = await p.query(
    `SELECT id, email, display_name FROM qfinance_users WHERE email = $1`,
    [normalizedEmail]
  );
  if (existing.rows[0]) return existing.rows[0];

  const inserted = await p.query(
    `INSERT INTO qfinance_users (email, display_name) VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
     RETURNING id, email, display_name`,
    [normalizedEmail, safeDisplayName]
  );
  return inserted.rows[0] ?? null;
}

export async function getQFinanceUserById(id: number): Promise<QFinanceUser | null> {
  const p = getPool();
  if (!p) return null;
  const { rows } = await p.query(
    `SELECT id, email, display_name FROM qfinance_users WHERE id = $1 AND status = 'active'`,
    [id]
  );
  return rows[0] ?? null;
}

export type QFinancePost = {
  id: number;
  title: string;
  body: string | null;
  category: string;
  status: string;
  is_seed: boolean;
  created_at: string;
  author_display_name: string;
  /** Server-side only — used to compute an `isOwner` boolean before
   * rendering; never send this raw value to the client (see doc's privacy
   * requirement: don't expose internal user IDs in the UI). */
  author_id: number;
  reply_count: number;
};

const POSTS_PER_PAGE = 20;

export async function listQFinanceCommunityPosts(opts: {
  category?: string;
  page?: number;
}): Promise<{ posts: QFinancePost[]; total: number; page: number; pageCount: number }> {
  const p = getPool();
  // Number(garbage) is NaN, and Math.max(1, NaN) is itself NaN in JS —
  // guard explicitly so a malformed ?page= value can't turn into
  // `OFFSET NaN` in the query below instead of silently falling back to 1.
  const requestedPage = opts.page;
  const page = Number.isFinite(requestedPage) && (requestedPage as number) >= 1 ? Math.floor(requestedPage as number) : 1;
  if (!p) return { posts: [], total: 0, page, pageCount: 0 };

  await ensureQFinanceCommunityTables();

  const category =
    opts.category && (QFINANCE_COMMUNITY_CATEGORIES as readonly string[]).includes(opts.category)
      ? opts.category
      : null;

  const whereCategory = category ? `AND p.category = $2` : "";
  const params: (string | number)[] = category ? ["published", category] : ["published"];

  const totalRes = await p.query(
    `SELECT COUNT(*)::int AS count FROM qfinance_community_posts p WHERE p.status = $1 ${whereCategory}`,
    params
  );
  const total = totalRes.rows[0]?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / POSTS_PER_PAGE));
  const offset = (page - 1) * POSTS_PER_PAGE;

  const { rows } = await p.query(
    `SELECT p.id, p.title, p.body, p.category, p.status, p.is_seed, p.created_at,
            u.display_name AS author_display_name,
            (SELECT COUNT(*)::int FROM qfinance_community_replies r WHERE r.post_id = p.id AND r.status = 'published') AS reply_count
     FROM qfinance_community_posts p
     JOIN qfinance_users u ON u.id = p.author_id
     WHERE p.status = $1 ${whereCategory}
     ORDER BY p.created_at DESC
     LIMIT ${POSTS_PER_PAGE} OFFSET ${offset}`,
    params
  );

  return { posts: rows, total, page, pageCount };
}

export type QFinanceReply = {
  id: number;
  body: string;
  status: string;
  created_at: string;
  author_display_name: string;
  /** Server-side only, same reasoning as QFinancePost.author_id. */
  author_id: number;
};

// Returns null if the post doesn't exist or isn't publicly visible
// (status !== 'published') — callers should render a 404 in that case,
// never expose hidden/removed content to normal visitors.
export async function getQFinanceCommunityPost(
  id: number
): Promise<{ post: QFinancePost; replies: QFinanceReply[] } | null> {
  const p = getPool();
  if (!p) return null;

  await ensureQFinanceCommunityTables();

  const postRes = await p.query(
    `SELECT p.id, p.title, p.body, p.category, p.status, p.is_seed, p.created_at, p.author_id,
            u.display_name AS author_display_name,
            (SELECT COUNT(*)::int FROM qfinance_community_replies r WHERE r.post_id = p.id AND r.status = 'published') AS reply_count
     FROM qfinance_community_posts p
     JOIN qfinance_users u ON u.id = p.author_id
     WHERE p.id = $1 AND p.status = 'published'`,
    [id]
  );
  const post = postRes.rows[0];
  if (!post) return null;

  const repliesRes = await p.query(
    `SELECT r.id, r.body, r.status, r.created_at, r.author_id, u.display_name AS author_display_name
     FROM qfinance_community_replies r
     JOIN qfinance_users u ON u.id = r.author_id
     WHERE r.post_id = $1 AND r.status = 'published'
     ORDER BY r.created_at ASC`,
    [id]
  );

  return { post, replies: repliesRes.rows };
}

// Simple DB-backed cooldown instead of an external rate-limit service — good
// enough for MVP anti-spam. Returns true if the user posted within the
// cooldown window.
async function isUnderCooldown(authorId: number, table: "qfinance_community_posts" | "qfinance_community_replies", seconds: number): Promise<boolean> {
  const p = getPool();
  if (!p) return false;
  const { rows } = await p.query(
    `SELECT 1 FROM ${table} WHERE author_id = $1 AND created_at > now() - ($2 || ' seconds')::interval LIMIT 1`,
    [authorId, seconds]
  );
  return rows.length > 0;
}

export type CreatePostResult =
  | { ok: true; id: number }
  | { ok: false; error: string };

export async function createQFinanceCommunityPost(input: {
  authorId: number;
  title: string;
  body?: string;
  category: string;
}): Promise<CreatePostResult> {
  const p = getPool();
  if (!p) return { ok: false, error: "Database is not configured." };

  const title = input.title.trim().slice(0, MAX_TITLE_LEN);
  // Context/body is optional — a question stands on its own. Store null
  // rather than an empty string so "no context given" is unambiguous.
  const trimmedBody = (input.body ?? "").trim().slice(0, MAX_BODY_LEN);
  const body = trimmedBody || null;

  if (!title) return { ok: false, error: "A question is required." };
  if (!(QFINANCE_COMMUNITY_CATEGORIES as readonly string[]).includes(input.category)) {
    return { ok: false, error: "Invalid category." };
  }

  await ensureQFinanceCommunityTables();

  if (await isUnderCooldown(input.authorId, "qfinance_community_posts", 30)) {
    return { ok: false, error: "Please wait a moment before posting again." };
  }

  const { rows } = await p.query(
    `INSERT INTO qfinance_community_posts (author_id, title, body, category) VALUES ($1, $2, $3, $4) RETURNING id`,
    [input.authorId, title, body, input.category]
  );
  return { ok: true, id: rows[0].id };
}

export async function createQFinanceCommunityReply(input: {
  authorId: number;
  postId: number;
  body: string;
}): Promise<CreatePostResult> {
  const p = getPool();
  if (!p) return { ok: false, error: "Database is not configured." };

  const body = input.body.trim().slice(0, MAX_BODY_LEN);
  if (!body) return { ok: false, error: "Reply can't be empty." };

  await ensureQFinanceCommunityTables();

  const postExists = await p.query(
    `SELECT 1 FROM qfinance_community_posts WHERE id = $1 AND status = 'published'`,
    [input.postId]
  );
  if (postExists.rows.length === 0) return { ok: false, error: "This post no longer exists." };

  if (await isUnderCooldown(input.authorId, "qfinance_community_replies", 10)) {
    return { ok: false, error: "Please wait a moment before replying again." };
  }

  const { rows } = await p.query(
    `INSERT INTO qfinance_community_replies (author_id, post_id, body) VALUES ($1, $2, $3) RETURNING id`,
    [input.authorId, input.postId, body]
  );
  return { ok: true, id: rows[0].id };
}

export type ReportReason = "spam" | "scam" | "harassment" | "misleading_claim" | "personal_info" | "other";

// --- Owner-managed edit/delete for posts and replies ----------------------
// Ownership is always re-fetched from the database and compared to the
// server-verified session id passed in by the caller (an API route) —
// never trusted from the request body. Soft-delete (status = 'removed')
// rather than a hard DELETE, consistent with the existing moderation model
// (see ensureQFinanceCommunityTables' status CHECK) — a member deleting
// their own post shouldn't behave differently, at the data layer, from a
// moderator removing it. This also means a reply thread's structure stays
// intact even after a post is "deleted" by its author.

export async function getQFinancePostAuthorId(id: number): Promise<number | null> {
  const p = getPool();
  if (!p) return null;
  const { rows } = await p.query(
    `SELECT author_id FROM qfinance_community_posts WHERE id = $1 AND status != 'removed'`,
    [id]
  );
  return rows[0]?.author_id ?? null;
}

export async function getQFinanceReplyAuthorId(id: number): Promise<number | null> {
  const p = getPool();
  if (!p) return null;
  const { rows } = await p.query(
    `SELECT author_id FROM qfinance_community_replies WHERE id = $1 AND status != 'removed'`,
    [id]
  );
  return rows[0]?.author_id ?? null;
}

export async function updateOwnQFinanceCommunityPost(
  id: number,
  authorId: number,
  input: { title: string; body?: string }
): Promise<{ ok: boolean; error?: string }> {
  const p = getPool();
  if (!p) return { ok: false, error: "Database is not configured." };

  const title = input.title.trim().slice(0, MAX_TITLE_LEN);
  const trimmedBody = (input.body ?? "").trim().slice(0, MAX_BODY_LEN);
  const body = trimmedBody || null;
  if (!title) return { ok: false, error: "A question is required." };

  // The WHERE clause itself enforces ownership — an UPDATE that matches
  // zero rows (wrong owner, or post already removed) is indistinguishable
  // at the SQL level from "nothing to update", which is exactly the
  // behavior we want: no row leaks whether it existed for the wrong user.
  const { rowCount } = await p.query(
    `UPDATE qfinance_community_posts
     SET title = $1, body = $2, updated_at = now()
     WHERE id = $3 AND author_id = $4 AND status = 'published'`,
    [title, body, id, authorId]
  );

  if (rowCount === 0) return { ok: false, error: "Post not found or you don't have permission to edit it." };
  return { ok: true };
}

export async function softDeleteOwnQFinanceCommunityPost(
  id: number,
  authorId: number
): Promise<{ ok: boolean; error?: string }> {
  const p = getPool();
  if (!p) return { ok: false, error: "Database is not configured." };

  const { rowCount } = await p.query(
    `UPDATE qfinance_community_posts
     SET status = 'removed', updated_at = now()
     WHERE id = $1 AND author_id = $2 AND status = 'published'`,
    [id, authorId]
  );

  if (rowCount === 0) return { ok: false, error: "Post not found or you don't have permission to delete it." };
  return { ok: true };
}

export async function updateOwnQFinanceCommunityReply(
  id: number,
  authorId: number,
  body: string
): Promise<{ ok: boolean; error?: string }> {
  const p = getPool();
  if (!p) return { ok: false, error: "Database is not configured." };

  const trimmedBody = body.trim().slice(0, MAX_BODY_LEN);
  if (!trimmedBody) return { ok: false, error: "Reply can't be empty." };

  const { rowCount } = await p.query(
    `UPDATE qfinance_community_replies
     SET body = $1, updated_at = now()
     WHERE id = $2 AND author_id = $3 AND status = 'published'`,
    [trimmedBody, id, authorId]
  );

  if (rowCount === 0) return { ok: false, error: "Reply not found or you don't have permission to edit it." };
  return { ok: true };
}

export async function softDeleteOwnQFinanceCommunityReply(
  id: number,
  authorId: number
): Promise<{ ok: boolean; error?: string }> {
  const p = getPool();
  if (!p) return { ok: false, error: "Database is not configured." };

  const { rowCount } = await p.query(
    `UPDATE qfinance_community_replies
     SET status = 'removed', updated_at = now()
     WHERE id = $1 AND author_id = $2 AND status = 'published'`,
    [id, authorId]
  );

  if (rowCount === 0) return { ok: false, error: "Reply not found or you don't have permission to delete it." };
  return { ok: true };
}

export async function createQFinanceCommunityReport(input: {
  reporterId: number;
  targetType: "post" | "reply";
  targetId: number;
  reason: ReportReason;
}): Promise<{ ok: boolean; error?: string }> {
  const p = getPool();
  if (!p) return { ok: false, error: "Database is not configured." };

  await ensureQFinanceCommunityTables();

  // One open report per (reporter, target) — prevents trivial report-spam
  // on a single item without needing a separate rate-limit mechanism.
  const dup = await p.query(
    `SELECT 1 FROM qfinance_community_reports
     WHERE reporter_id = $1 AND target_type = $2 AND target_id = $3 AND status = 'open'`,
    [input.reporterId, input.targetType, input.targetId]
  );
  if (dup.rows.length > 0) return { ok: true }; // already reported — treat as success, no error shown

  await p.query(
    `INSERT INTO qfinance_community_reports (reporter_id, target_type, target_id, reason) VALUES ($1, $2, $3, $4)`,
    [input.reporterId, input.targetType, input.targetId, input.reason]
  );
  return { ok: true };
}

// --- Admin/moderation ------------------------------------------------------

export type AdminQFinancePost = QFinancePost & { author_email: string };

export async function adminListQFinanceCommunityPosts(): Promise<AdminQFinancePost[]> {
  const p = getPool();
  if (!p) return [];
  await ensureQFinanceCommunityTables();
  const { rows } = await p.query(
    `SELECT p.id, p.title, p.body, p.category, p.status, p.is_seed, p.created_at,
            u.display_name AS author_display_name, u.email AS author_email,
            (SELECT COUNT(*)::int FROM qfinance_community_replies r WHERE r.post_id = p.id) AS reply_count
     FROM qfinance_community_posts p
     JOIN qfinance_users u ON u.id = p.author_id
     ORDER BY p.created_at DESC
     LIMIT 200`
  );
  return rows;
}

export async function adminUpdateQFinancePostStatus(id: number, status: string): Promise<{ ok: boolean; error?: string }> {
  if (!["published", "hidden", "removed"].includes(status)) return { ok: false, error: "Invalid status" };
  const p = getPool();
  if (!p) return { ok: false, error: "Database is not configured." };
  await p.query(`UPDATE qfinance_community_posts SET status = $1, updated_at = now() WHERE id = $2`, [status, id]);
  return { ok: true };
}

export async function adminUpdateQFinanceReplyStatus(id: number, status: string): Promise<{ ok: boolean; error?: string }> {
  if (!["published", "hidden", "removed"].includes(status)) return { ok: false, error: "Invalid status" };
  const p = getPool();
  if (!p) return { ok: false, error: "Database is not configured." };
  await p.query(`UPDATE qfinance_community_replies SET status = $1, updated_at = now() WHERE id = $2`, [status, id]);
  return { ok: true };
}

export type AdminQFinanceReport = {
  id: number;
  target_type: string;
  target_id: number;
  reason: string;
  status: string;
  created_at: string;
  reporter_display_name: string;
  target_title_or_body: string | null;
};

export async function adminListQFinanceCommunityReports(): Promise<AdminQFinanceReport[]> {
  const p = getPool();
  if (!p) return [];
  await ensureQFinanceCommunityTables();
  const { rows } = await p.query(
    `SELECT r.id, r.target_type, r.target_id, r.reason, r.status, r.created_at,
            u.display_name AS reporter_display_name,
            COALESCE(
              (SELECT title FROM qfinance_community_posts WHERE id = r.target_id AND r.target_type = 'post'),
              (SELECT body FROM qfinance_community_replies WHERE id = r.target_id AND r.target_type = 'reply')
            ) AS target_title_or_body
     FROM qfinance_community_reports r
     JOIN qfinance_users u ON u.id = r.reporter_id
     ORDER BY (r.status = 'open') DESC, r.created_at DESC
     LIMIT 200`
  );
  return rows;
}

export async function adminResolveQFinanceCommunityReport(
  id: number,
  status: "resolved" | "dismissed",
  resolvedBy: string
): Promise<{ ok: boolean; error?: string }> {
  const p = getPool();
  if (!p) return { ok: false, error: "Database is not configured." };
  await p.query(
    `UPDATE qfinance_community_reports SET status = $1, resolved_at = now(), resolved_by = $2 WHERE id = $3`,
    [status, resolvedBy, id]
  );
  return { ok: true };
}

export async function countQbidsRegistrations(): Promise<number> {
  const p = getPool();
  if (!p) return 0;
  const { rows } = await p.query(`SELECT COUNT(*)::int AS count FROM qbids_registrations`);
  return rows[0]?.count ?? 0;
}

// ---------------------------------------------------------------------------
// QFinance registrations — separate table, separate functions. No status
// workflow yet (the product doesn't have one), unlike Qbids.
// ---------------------------------------------------------------------------

export async function ensureQFinanceRegistrationsTable(): Promise<void> {
  const p = getPool();
  if (!p) return;

  await p.query(`
    CREATE TABLE IF NOT EXISTS qfinance_registrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

export type QFinanceRegistrationRow = {
  id: number;
  name: string;
  email: string;
  created_at: string;
};

export async function getQFinanceRegistrations(): Promise<QFinanceRegistrationRow[]> {
  const p = getPool();
  if (!p) return [];

  await ensureQFinanceRegistrationsTable();

  const { rows } = await p.query(
    `SELECT id, name, email, created_at FROM qfinance_registrations ORDER BY created_at DESC`
  );
  return rows;
}

export async function countQFinanceRegistrations(): Promise<number> {
  const p = getPool();
  if (!p) return 0;

  await ensureQFinanceRegistrationsTable();

  const { rows } = await p.query(`SELECT COUNT(*)::int AS count FROM qfinance_registrations`);
  return rows[0]?.count ?? 0;
}

export type QFinanceRegistrationInput = {
  name: string;
  email: string;
};

// Called by app/api/qfinance/route.ts (the live Beta registration form's
// API) whenever DATABASE_URL is configured, following the same
// duplicate-email-is-not-an-error pattern as insertQbidsRegistration.
export async function insertQFinanceRegistration(
  input: QFinanceRegistrationInput
): Promise<InsertResult> {
  const p = getPool();
  if (!p) {
    return { ok: false, error: "Database is not configured (DATABASE_URL missing)." };
  }

  try {
    await ensureQFinanceRegistrationsTable();

    await p.query(
      `INSERT INTO qfinance_registrations (name, email) VALUES ($1, $2)`,
      [input.name, input.email.toLowerCase()]
    );

    return { ok: true, duplicate: false };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "23505") {
      return { ok: true, duplicate: true };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown database error",
    };
  }
}
