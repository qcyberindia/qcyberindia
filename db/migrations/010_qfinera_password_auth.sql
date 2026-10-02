-- QFinera: password authentication with server-side sessions.
--
-- qfinance_users stays the ONE canonical identity table (no second user
-- table). Earlier migrations are not modified. This migration only adds:
--   * qfinance_users: password hash (scrypt, never plaintext), email
--     verification, last login, password-change time. Existing magic-link
--     accounts are preserved as-is with no password; they set one through
--     the password-reset flow, which also proves they own the email.
--   * qfinance_sessions: server-side sessions. The cookie holds a random
--     token; only its SHA-256 hash is stored. Sessions expire, and can be
--     revoked (logout, password change/reset, admin action, suspension).
--   * qfinance_auth_tokens: single-use, hashed, short-lived tokens for email
--     verification and password reset.
--   * qfinance_auth_attempts: rate-limit / brute-force counters.
--   * qfinance_admin_audit: append-only log of QCyberIndia admin actions on
--     QFinera accounts.
--
-- Safe to re-run. One transaction. ABORTS (rather than guessing) if two
-- accounts differ only by email letter case.
--
--   psql "$DATABASE_URL" -f db/migrations/010_qfinera_password_auth.sql

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT lower(email) FROM qfinance_users GROUP BY lower(email) HAVING COUNT(*) > 1) THEN
    RAISE EXCEPTION 'Migration 010 aborted: qfinance_users has emails differing only by case. Merge them manually first.';
  END IF;
END $$;

ALTER TABLE qfinance_users
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS password_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS uq_qfinance_users_email_lower ON qfinance_users (lower(email));

CREATE TABLE IF NOT EXISTS qfinance_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES qfinance_users(id),
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  ip_address TEXT,
  user_agent TEXT,
  CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS idx_qfinance_sessions_user ON qfinance_sessions (user_id) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS qfinance_auth_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES qfinance_users(id),
  purpose TEXT NOT NULL CHECK (purpose IN ('EMAIL_VERIFY', 'PASSWORD_RESET')),
  token_hash TEXT NOT NULL UNIQUE,
  -- EMAIL_VERIFY only: the scrypt hash of the password chosen at
  -- registration. It is applied to the account only when the link is opened
  -- AND that same password is re-entered, so an unverified registration
  -- made by someone else with your email can never become your account.
  pending_password_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  CHECK (expires_at > created_at)
);
ALTER TABLE qfinance_auth_tokens ADD COLUMN IF NOT EXISTS pending_password_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_qfinance_auth_tokens_user ON qfinance_auth_tokens (user_id, purpose) WHERE used_at IS NULL;

CREATE TABLE IF NOT EXISTS qfinance_auth_attempts (
  id BIGSERIAL PRIMARY KEY,
  bucket TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_qfinance_auth_attempts_bucket ON qfinance_auth_attempts (bucket, created_at);

CREATE TABLE IF NOT EXISTS qfinance_admin_audit (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES qfinance_users(id),
  action TEXT NOT NULL,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_qfinance_admin_audit_user ON qfinance_admin_audit (user_id, created_at DESC);

-- Admin actions on accounts are append-only, like the pool audit log
-- (qfinera_fund_forbid_mutation() is defined in migration 007).
DROP TRIGGER IF EXISTS trg_qfinance_admin_audit_no_mutation ON qfinance_admin_audit;
CREATE TRIGGER trg_qfinance_admin_audit_no_mutation
  BEFORE UPDATE OR DELETE ON qfinance_admin_audit
  FOR EACH ROW EXECUTE FUNCTION qfinera_fund_forbid_mutation();

COMMIT;
