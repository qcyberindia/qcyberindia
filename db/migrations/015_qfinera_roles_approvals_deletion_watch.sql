-- QFinera: Viewer role, join requests, manager -> admin approvals, pool
-- deletion with a 30-day retention period, and Global Watch.
--
-- 006 to 014 are NOT modified. This migration:
--   * memberships/invites: a read-only VIEWER role.
--   * qfinera_fund_join_requests: a viewer asks to become a MEMBER.
--   * qfinera_change_requests: one generic "pending admin approval" record
--     for changes a MANAGER proposes (fund scope) and for Global Watch
--     moderation a platform MANAGER proposes (platform scope). The proposed
--     change is applied only when an ADMIN approves it.
--   * pools: soft deletion (deleted_at / deleted_by / deletion_reason /
--     purge_after). A deleted pool is inaccessible but intact until
--     purge_after; an ADMIN can restore it until then.
--   * purge: the append-only triggers gain ONE narrow exception. Rows of a
--     pool may be deleted only inside a transaction that names that pool in
--     the qfinera.purge_fund_id setting AND only when the pool was deleted
--     and its retention period has ended. An active pool (deleted_at NULL)
--     can never be purged, whatever the session setting says; the pool row
--     itself is protected by the same rule.
--   * qfinance_users.platform_role: who moderates Global Watch.
--   * qfinera_watch_items / qfinera_watch_attachments: Global Watch.
--     Global Watch audit rows go to qfinera_fund_audit_log with fund_id NULL.
--
-- Safe to re-run. Runs in one transaction.
--
--   psql "$DATABASE_URL" -f db/migrations/015_qfinera_roles_approvals_deletion_watch.sql

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.qf_add_constraint(tbl regclass, cname text, ddl text) RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = tbl AND conname = cname) THEN
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', tbl, cname, ddl);
  END IF;
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pg_temp.qf_drop_checks(tbl regclass, pattern text) RETURNS void AS $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = tbl AND contype = 'c' AND pg_get_constraintdef(oid) LIKE pattern
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', tbl, c.conname);
  END LOOP;
END $$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------
-- VIEWER role (006's inline role CHECKs are replaced; existing values stay valid)
-- -----------------------------------------------------------------------
SELECT pg_temp.qf_drop_checks('qfinera_fund_memberships'::regclass, '%role = ANY%');
SELECT pg_temp.qf_add_constraint('qfinera_fund_memberships'::regclass, 'qfinera_fund_memberships_role_v2_check',
  $c$CHECK (role IN ('ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'))$c$);

SELECT pg_temp.qf_drop_checks('qfinera_fund_invites'::regclass, '%role = ANY%');
SELECT pg_temp.qf_add_constraint('qfinera_fund_invites'::regclass, 'qfinera_fund_invites_role_v2_check',
  $c$CHECK (role IN ('ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'))$c$);

-- -----------------------------------------------------------------------
-- Pool soft deletion
-- -----------------------------------------------------------------------
ALTER TABLE qfinera_funds
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES qfinance_users(id),
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT,
  ADD COLUMN IF NOT EXISTS purge_after TIMESTAMPTZ;

-- Deleted <=> scheduled for purge, never earlier than 30 days after deletion.
SELECT pg_temp.qf_add_constraint('qfinera_funds'::regclass, 'qfinera_funds_deletion_check',
  $c$CHECK (
    (deleted_at IS NULL AND deleted_by IS NULL AND purge_after IS NULL)
    OR (deleted_at IS NOT NULL AND deleted_by IS NOT NULL AND purge_after >= deleted_at + interval '30 days')
  )$c$);

CREATE INDEX IF NOT EXISTS idx_qfund_funds_purge ON qfinera_funds (purge_after) WHERE deleted_at IS NOT NULL;

-- True only inside a purge transaction for THIS pool, and only once the pool
-- is deleted and past its retention period.
CREATE OR REPLACE FUNCTION qfinera_purge_allowed(fid integer) RETURNS boolean AS $$
  SELECT fid IS NOT NULL
     AND coalesce(current_setting('qfinera.purge_fund_id', true), '') = fid::text
     AND EXISTS (
       SELECT 1 FROM qfinera_funds f
        WHERE f.id = fid AND f.deleted_at IS NOT NULL AND f.purge_after IS NOT NULL AND f.purge_after <= now()
     );
$$ LANGUAGE sql STABLE;

-- Append-only guard (007), now with the purge exception for row DELETEs.
-- UPDATE and TRUNCATE remain forbidden in every case. Tables without a
-- fund_id column (e.g. qfinance_admin_audit) never qualify.
CREATE OR REPLACE FUNCTION qfinera_fund_forbid_mutation() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND TG_LEVEL = 'ROW'
     AND qfinera_purge_allowed(NULLIF(to_jsonb(OLD)->>'fund_id', '')::integer) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION '% on % is not permitted: append-only table (record a REVERSAL/ADJUSTMENT instead)', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END $$ LANGUAGE plpgsql;

-- NAV guard (007), with the same purge exception.
CREATE OR REPLACE FUNCTION qfinera_fund_nav_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF qfinera_purge_allowed(OLD.fund_id) THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'DELETE on % is not permitted: NAV history is append-only', TG_TABLE_NAME
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF (to_jsonb(NEW) - 'is_official') IS DISTINCT FROM (to_jsonb(OLD) - 'is_official') THEN
    RAISE EXCEPTION 'UPDATE on % may only change is_official; record a corrected snapshot instead', TG_TABLE_NAME
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- The pool row itself: deletable only by a purge, never while active.
CREATE OR REPLACE FUNCTION qfinera_fund_delete_guard() RETURNS trigger AS $$
BEGIN
  IF qfinera_purge_allowed(OLD.id) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'DELETE on qfinera_funds is only permitted by a purge after the retention period'
    USING ERRCODE = 'restrict_violation';
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_qfund_funds_delete_guard ON qfinera_funds;
CREATE TRIGGER trg_qfund_funds_delete_guard
  BEFORE DELETE ON qfinera_funds
  FOR EACH ROW EXECUTE FUNCTION qfinera_fund_delete_guard();

DROP TRIGGER IF EXISTS trg_qfund_funds_no_truncate ON qfinera_funds;
CREATE TRIGGER trg_qfund_funds_no_truncate
  BEFORE TRUNCATE ON qfinera_funds
  FOR EACH STATEMENT EXECUTE FUNCTION qfinera_fund_forbid_mutation();

-- -----------------------------------------------------------------------
-- Join requests (VIEWER -> MEMBER)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS qfinera_fund_join_requests (
  id SERIAL PRIMARY KEY,
  fund_id INTEGER NOT NULL REFERENCES qfinera_funds(id),
  user_id INTEGER NOT NULL REFERENCES qfinance_users(id),
  note TEXT CHECK (note IS NULL OR length(note) <= 1000),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN')),
  -- Set when a MANAGER recommended approval and it awaits an ADMIN.
  change_request_id INTEGER,
  reviewed_by INTEGER REFERENCES qfinance_users(id),
  reviewed_at TIMESTAMPTZ,
  review_reason TEXT CHECK (review_reason IS NULL OR length(review_reason) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (fund_id, user_id) REFERENCES qfinera_fund_memberships (fund_id, user_id),
  CHECK ((status = 'PENDING') = (reviewed_at IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_qfund_join_requests_one_open
  ON qfinera_fund_join_requests (fund_id, user_id) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_qfund_join_requests_fund ON qfinera_fund_join_requests (fund_id, status, created_at DESC);

-- -----------------------------------------------------------------------
-- Change requests (pending admin approval)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS qfinera_change_requests (
  id SERIAL PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('fund', 'platform')),
  fund_id INTEGER REFERENCES qfinera_funds(id),
  -- e.g. "member.update", "trade.reverse", "watch.delete". Executed by the
  -- registry in lib/fund/services/change-requests.ts.
  action TEXT NOT NULL CHECK (action ~ '^[a-z_]+\.[a-z_]+$'),
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  -- The validated arguments the approving ADMIN's call will receive.
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  before_state JSONB,
  proposed_state JSONB,
  reason TEXT CHECK (reason IS NULL OR length(reason) <= 1000),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'EXECUTING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  requested_by INTEGER NOT NULL REFERENCES qfinance_users(id),
  reviewed_by INTEGER REFERENCES qfinance_users(id),
  reviewed_at TIMESTAMPTZ,
  review_reason TEXT CHECK (review_reason IS NULL OR length(review_reason) <= 1000),
  -- The last execution error shown to the reviewer (the request stays PENDING).
  last_error TEXT,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((scope = 'fund') = (fund_id IS NOT NULL))
);

-- One open request per action and record, so a change is not proposed twice.
CREATE UNIQUE INDEX IF NOT EXISTS uq_qchange_requests_one_open
  ON qfinera_change_requests (scope, coalesce(fund_id, 0), action, entity_type, coalesce(entity_id, 0))
  WHERE status IN ('PENDING', 'EXECUTING');
CREATE INDEX IF NOT EXISTS idx_qchange_requests_fund ON qfinera_change_requests (fund_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qchange_requests_platform ON qfinera_change_requests (status, created_at DESC) WHERE scope = 'platform';

SELECT pg_temp.qf_add_constraint('qfinera_fund_join_requests'::regclass, 'qfinera_fund_join_requests_change_request_fk',
  'FOREIGN KEY (change_request_id) REFERENCES qfinera_change_requests (id)');

-- -----------------------------------------------------------------------
-- Platform role (Global Watch moderation). Assigned by the QCyberIndia
-- site administrator; never by the user.
-- -----------------------------------------------------------------------
ALTER TABLE qfinance_users
  ADD COLUMN IF NOT EXISTS platform_role TEXT NOT NULL DEFAULT 'USER';
SELECT pg_temp.qf_add_constraint('qfinance_users'::regclass, 'qfinance_users_platform_role_check',
  $c$CHECK (platform_role IN ('USER', 'MANAGER', 'ADMIN'))$c$);

-- -----------------------------------------------------------------------
-- Global Watch
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS qfinera_watch_items (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 3 AND 160),
  summary TEXT NOT NULL CHECK (length(summary) BETWEEN 10 AND 400),
  details TEXT CHECK (details IS NULL OR length(details) <= 10000),
  category TEXT NOT NULL CHECK (category IN ('STOCK', 'INDUSTRY', 'ECONOMY', 'NEWS', 'RESEARCH', 'RISK', 'OPPORTUNITY', 'REGULATORY', 'OTHER')),
  instrument_id INTEGER REFERENCES qfinera_fund_instruments(id),
  symbol TEXT CHECK (symbol IS NULL OR length(symbol) <= 40),
  company TEXT CHECK (company IS NULL OR length(company) <= 160),
  industry TEXT CHECK (industry IS NULL OR length(industry) <= 120),
  tags TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(tags) <= 8),
  -- [{ "url": "https://...", "label": "...", "kind": "ARTICLE|VIDEO|DOCUMENT|OTHER" }], validated by the app.
  links JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(links) = 'array' AND jsonb_array_length(links) <= 10),
  source TEXT CHECK (source IS NULL OR length(source) <= 200),
  contact TEXT CHECK (contact IS NULL OR length(contact) <= 200),
  priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH')),
  status TEXT NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('PUBLISHED', 'ARCHIVED', 'REMOVED')),
  created_by INTEGER NOT NULL REFERENCES qfinance_users(id),
  updated_by INTEGER REFERENCES qfinance_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ,
  archived_by INTEGER REFERENCES qfinance_users(id),
  removed_at TIMESTAMPTZ,
  removed_by INTEGER REFERENCES qfinance_users(id),
  removal_reason TEXT CHECK (removal_reason IS NULL OR length(removal_reason) <= 500),
  CHECK ((status = 'REMOVED') = (removed_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_qwatch_items_status_created ON qfinera_watch_items (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qwatch_items_status_updated ON qfinera_watch_items (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_qwatch_items_category ON qfinera_watch_items (category, created_at DESC) WHERE status = 'PUBLISHED';
CREATE INDEX IF NOT EXISTS idx_qwatch_items_author ON qfinera_watch_items (created_by, created_at DESC);

-- Screenshots, images and PDFs. Stored in the database (never at a public
-- URL) and served only to signed-in accounts, like contribution proofs.
CREATE TABLE IF NOT EXISTS qfinera_watch_attachments (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES qfinera_watch_items(id),
  file_name TEXT NOT NULL CHECK (length(file_name) BETWEEN 1 AND 200),
  content_type TEXT NOT NULL CHECK (content_type IN ('image/png', 'image/jpeg', 'image/webp', 'application/pdf')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 2097152),
  sha256 TEXT NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  data BYTEA NOT NULL,
  uploaded_by INTEGER NOT NULL REFERENCES qfinance_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  removed_at TIMESTAMPTZ,
  removed_by INTEGER REFERENCES qfinance_users(id),
  CHECK (octet_length(data) = size_bytes)
);

CREATE INDEX IF NOT EXISTS idx_qwatch_attachments_item ON qfinera_watch_attachments (item_id) WHERE removed_at IS NULL;

COMMIT;
