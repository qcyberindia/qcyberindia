-- QFinance Community — users, posts, replies, reports.
--
-- Auth model: passwordless magic-link (see lib/qfinance-community-auth.ts).
-- No password hash is ever stored — there is no password. The magic-link
-- token itself is a self-contained signed value (HMAC + expiry), not a
-- database row, so there's no separate "magic_links" table to manage/expire.
--
-- Moderation model: status-based, never a hard DELETE from a client action
-- (see lib/db.ts's community functions) — 'removed' is a status, not a
-- disappearance, so moderation stays auditable.
--
-- Run manually via the Neon SQL editor, or:
--   psql "$DATABASE_URL" -f db/migrations/003_create_qfinance_community.sql

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
  body TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden', 'removed')),
  is_seed BOOLEAN NOT NULL DEFAULT false, -- true only for the transparently-labeled starter discussions
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
  resolved_by TEXT -- free-text admin label, not a FK — the admin session has no user row of its own
);

CREATE INDEX IF NOT EXISTS idx_qf_posts_created_at ON qfinance_community_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qf_posts_category ON qfinance_community_posts (category);
CREATE INDEX IF NOT EXISTS idx_qf_posts_status ON qfinance_community_posts (status);
CREATE INDEX IF NOT EXISTS idx_qf_replies_post_id ON qfinance_community_replies (post_id);
CREATE INDEX IF NOT EXISTS idx_qf_reports_status ON qfinance_community_reports (status);

-- Starter discussions — transparently labeled via is_seed, not fake users
-- pretending to be real members. A single "QFinance Team" account authors
-- all of them.
INSERT INTO qfinance_users (email, display_name)
VALUES ('team@qfinance.internal', 'QFinance Team')
ON CONFLICT (email) DO NOTHING;

INSERT INTO qfinance_community_posts (author_id, title, body, category, is_seed)
SELECT u.id, p.title, p.body, p.category, true
FROM qfinance_users u,
(VALUES
  ('What exactly do I own when I buy a share?', 'I keep hearing "you own a piece of the company" but what does that actually mean in practice? Do I get anything physical, a certificate, a say in decisions?', 'Getting Started'),
  ('What''s the difference between a demat account and a trading account?', 'I opened both when I signed up with a broker and I still don''t understand what each one is actually for. Can someone explain simply?', 'Apps & Accounts'),
  ('Why does my portfolio value fall even when I haven''t sold anything?', 'This confused me the first time it happened. If I didn''t sell, why did my money "go down"?', 'Risk & Safety'),
  ('How does an index fund actually hold many companies at once?', 'If I put in ₹500, does the fund really go and buy tiny slices of 50 different companies with that?', 'Mutual Funds & ETFs')
) AS p(title, body, category)
WHERE u.email = 'team@qfinance.internal'
ON CONFLICT DO NOTHING;
