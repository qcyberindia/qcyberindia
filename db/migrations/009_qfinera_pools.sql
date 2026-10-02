-- QFinera Pools: multi-pool tenancy and integrity additions on top of
-- 006 + 007 + 008. A "pool" is a row of qfinera_funds; every accounting
-- table is already keyed by fund_id, so each pool's members, capital, units,
-- NAV, cash, trades, holdings, expenses, reports and audit are isolated.
--
-- 006, 007 and 008 are NOT modified. This migration:
--   * pools: participation mode, fixed at PRIVATE_INVITE_ONLY by a CHECK.
--     Public participation cannot be switched on by configuration: it needs
--     a new migration, which needs the legal/regulatory review described in
--     docs/qfinera-fund/LEGAL_GATE.md.
--   * memberships: a 'removed' status, so a member who leaves keeps their
--     history (contributions, ledger rows reference the membership).
--   * invites: who revoked an invite.
--   * price snapshots: optional fund scope + recorder, and append-only.
--     A manually recorded price belongs to the fund that recorded it, so one
--     fund's operator can never move another fund's official NAV. fund_id
--     NULL is reserved for provider-wide snapshots (a future vendor adapter).
--   * withdrawals: at most one OPEN request per member (duplicate protection
--     that also holds under concurrent requests).
--
-- Safe to re-run. Runs in one transaction. ABORTS (rather than guessing) if
-- existing rows would violate the new withdrawal rule.
--
--   psql "$DATABASE_URL" -f db/migrations/009_qfinera_fund_integrity.sql

BEGIN;

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
-- Pools
-- -----------------------------------------------------------------------
ALTER TABLE qfinera_funds
  ADD COLUMN IF NOT EXISTS participation_mode TEXT NOT NULL DEFAULT 'PRIVATE_INVITE_ONLY';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'qfinera_funds'::regclass AND conname = 'qfinera_funds_participation_check'
  ) THEN
    ALTER TABLE qfinera_funds ADD CONSTRAINT qfinera_funds_participation_check
      CHECK (participation_mode = 'PRIVATE_INVITE_ONLY');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_qfund_funds_created_by ON qfinera_funds (created_by);

-- -----------------------------------------------------------------------
-- Memberships: active | suspended | removed
-- (the 006 status CHECK is replaced; existing values stay valid)
-- -----------------------------------------------------------------------
SELECT pg_temp.qf_drop_checks('qfinera_fund_memberships'::regclass, '%suspended%');

ALTER TABLE qfinera_fund_memberships
  ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS removed_by INTEGER REFERENCES qfinance_users(id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'qfinera_fund_memberships'::regclass AND conname = 'qfinera_fund_memberships_status_v2_check'
  ) THEN
    ALTER TABLE qfinera_fund_memberships ADD CONSTRAINT qfinera_fund_memberships_status_v2_check
      CHECK (status IN ('active', 'suspended', 'removed') AND (status <> 'removed' OR units = 0));
  END IF;
END $$;

-- -----------------------------------------------------------------------
-- Invites
-- -----------------------------------------------------------------------
ALTER TABLE qfinera_fund_invites
  ADD COLUMN IF NOT EXISTS revoked_by INTEGER REFERENCES qfinance_users(id);

-- -----------------------------------------------------------------------
-- Price snapshots
-- -----------------------------------------------------------------------
ALTER TABLE qfinera_fund_price_snapshots
  ADD COLUMN IF NOT EXISTS fund_id INTEGER REFERENCES qfinera_funds(id),
  ADD COLUMN IF NOT EXISTS recorded_by INTEGER REFERENCES qfinance_users(id);

CREATE INDEX IF NOT EXISTS idx_qfund_price_snapshots_fund_instrument
  ON qfinera_fund_price_snapshots (fund_id, instrument_id, as_of DESC);

-- Prices feed official NAV snapshots, so their history is preserved: a wrong
-- price is superseded by recording a newer snapshot, never edited away.
-- (qfinera_fund_forbid_mutation() is defined in migration 007.)
DROP TRIGGER IF EXISTS trg_qfund_price_no_mutation ON qfinera_fund_price_snapshots;
CREATE TRIGGER trg_qfund_price_no_mutation
  BEFORE UPDATE OR DELETE ON qfinera_fund_price_snapshots
  FOR EACH ROW EXECUTE FUNCTION qfinera_fund_forbid_mutation();

DROP TRIGGER IF EXISTS trg_qfund_price_no_truncate ON qfinera_fund_price_snapshots;
CREATE TRIGGER trg_qfund_price_no_truncate
  BEFORE TRUNCATE ON qfinera_fund_price_snapshots
  FOR EACH STATEMENT EXECUTE FUNCTION qfinera_fund_forbid_mutation();

-- -----------------------------------------------------------------------
-- Withdrawals: one open request per member.
-- -----------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM qfinera_fund_withdrawals
     WHERE status IN ('REQUESTED', 'APPROVED', 'AWAITING_NAV')
     GROUP BY fund_id, member_id HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Migration 009 aborted: a member has more than one open withdrawal. Resolve them manually before migrating.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_qfund_withdrawals_one_open
  ON qfinera_fund_withdrawals (fund_id, member_id)
  WHERE status IN ('REQUESTED', 'APPROVED', 'AWAITING_NAV');

COMMIT;
