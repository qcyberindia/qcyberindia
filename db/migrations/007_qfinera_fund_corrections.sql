-- QFinera Fund: additive corrections to migration 006.
--
-- 006 is NOT modified (it may already be applied). This migration:
--   * adds the AWAITING_NAV / FINALIZED lifecycle for contributions and
--     withdrawals (units are only allocated/redeemed once the applicable
--     EOD NAV exists), plus effective_date / nav_snapshot_id / residual
--   * adds ledger.accounting_version and ledger shape CHECKs
--   * ties member-level rows to fund membership (composite FKs)
--   * makes the ledger and audit log append-only (triggers)
--   * adds a settings table
--
-- Safety: the whole file is one transaction. It ABORTS (rather than guessing)
-- if rows already exist in states the new lifecycle cannot represent.
--
-- Run manually via the Neon SQL editor, or:
--   psql "$DATABASE_URL" -f db/migrations/007_qfinera_fund_corrections.sql

BEGIN;

-- -----------------------------------------------------------------------
-- Guard: refuse to run over data we would have to reinterpret.
-- -----------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM qfinera_fund_contributions WHERE status = 'APPROVED')
     OR EXISTS (SELECT 1 FROM qfinera_fund_withdrawals WHERE status IN ('APPROVED', 'COMPLETED'))
     OR EXISTS (SELECT 1 FROM qfinera_fund_ledger_entries) THEN
    RAISE EXCEPTION 'Migration 007 aborted: finalized contributions/withdrawals or ledger entries already exist. Review manually before migrating.';
  END IF;
END $$;

-- -----------------------------------------------------------------------
-- Session-local helpers (pg_temp: dropped automatically at session end).
-- -----------------------------------------------------------------------
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

CREATE OR REPLACE FUNCTION pg_temp.qf_add_constraint(tbl regclass, cname text, ddl text) RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = tbl AND conname = cname) THEN
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', tbl, cname, ddl);
  END IF;
END $$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------
-- NAV snapshots (created first: contributions/withdrawals reference it).
-- A correction is a new row with a higher calculation_version; exactly one
-- row per (fund, date) is official at a time.
-- -----------------------------------------------------------------------
ALTER TABLE qfinera_fund_nav_snapshots
  ADD COLUMN IF NOT EXISTS is_official BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS correction_reason TEXT,
  ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES qfinance_users(id); -- null = system job

SELECT pg_temp.qf_add_constraint('qfinera_fund_nav_snapshots'::regclass, 'qfinera_fund_nav_snapshots_value_check',
  'CHECK (fund_value = cash + holdings_value AND outstanding_units >= 0)');

CREATE UNIQUE INDEX IF NOT EXISTS uq_qfund_nav_official_per_day
  ON qfinera_fund_nav_snapshots (fund_id, as_of_date) WHERE is_official;

-- -----------------------------------------------------------------------
-- Memberships
-- -----------------------------------------------------------------------
ALTER TABLE qfinera_fund_memberships
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

SELECT pg_temp.qf_add_constraint('qfinera_fund_memberships'::regclass, 'qfinera_fund_memberships_units_check',
  'CHECK (units >= 0)');

-- -----------------------------------------------------------------------
-- Invites
-- -----------------------------------------------------------------------
SELECT pg_temp.qf_add_constraint('qfinera_fund_invites'::regclass, 'qfinera_fund_invites_expiry_check',
  'CHECK (expires_at > created_at)');
CREATE INDEX IF NOT EXISTS idx_qfund_invites_email ON qfinera_fund_invites (lower(email));

-- -----------------------------------------------------------------------
-- Contributions: PENDING -> APPROVED -> AWAITING_NAV -> FINALIZED
--   APPROVED       admin approved
--   AWAITING_NAV   funds confirmed received; waiting for the next EOD NAV
--   FINALIZED      units allocated at that NAV
-- Units/NAV are NULL until FINALIZED ("never allocate units before the
-- applicable EOD NAV exists").
-- -----------------------------------------------------------------------
SELECT pg_temp.qf_drop_checks('qfinera_fund_contributions'::regclass, '%status%');

ALTER TABLE qfinera_fund_contributions
  ADD COLUMN IF NOT EXISTS funds_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS funds_confirmed_by INTEGER REFERENCES qfinance_users(id),
  ADD COLUMN IF NOT EXISTS effective_date DATE,
  ADD COLUMN IF NOT EXISTS nav_snapshot_id INTEGER REFERENCES qfinera_fund_nav_snapshots(id),
  ADD COLUMN IF NOT EXISTS residual NUMERIC(20,8), -- amount - units x NAV; positive = fund keeps it
  ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ;

SELECT pg_temp.qf_add_constraint('qfinera_fund_contributions'::regclass, 'qfinera_fund_contributions_status_check',
  $c$CHECK (status IN ('PENDING', 'APPROVED', 'AWAITING_NAV', 'FINALIZED', 'REJECTED', 'CANCELLED'))$c$);

SELECT pg_temp.qf_add_constraint('qfinera_fund_contributions'::regclass, 'qfinera_fund_contributions_lifecycle_check',
  $c$CHECK (
    (status NOT IN ('APPROVED', 'AWAITING_NAV', 'FINALIZED')
       OR (approved_by IS NOT NULL AND approved_at IS NOT NULL))
    AND (status NOT IN ('AWAITING_NAV', 'FINALIZED')
       OR (funds_confirmed_at IS NOT NULL AND funds_confirmed_by IS NOT NULL))
    AND (status = 'FINALIZED'
       OR (nav_used IS NULL AND units_allocated IS NULL AND residual IS NULL AND finalized_at IS NULL))
    AND (status != 'FINALIZED'
       OR (nav_used > 0 AND units_allocated > 0 AND residual IS NOT NULL
           AND effective_date IS NOT NULL AND finalized_at IS NOT NULL AND nav_snapshot_id IS NOT NULL))
  )$c$);

SELECT pg_temp.qf_add_constraint('qfinera_fund_contributions'::regclass, 'qfinera_fund_contributions_backdate_check',
  $c$CHECK (NOT is_backdated OR length(btrim(coalesce(backdated_reason, ''))) > 0)$c$);

SELECT pg_temp.qf_add_constraint('qfinera_fund_contributions'::regclass, 'qfinera_fund_contributions_member_fk',
  'FOREIGN KEY (fund_id, member_id) REFERENCES qfinera_fund_memberships (fund_id, user_id)');

CREATE INDEX IF NOT EXISTS idx_qfund_contributions_effective ON qfinera_fund_contributions (fund_id, effective_date);
CREATE INDEX IF NOT EXISTS idx_qfund_contributions_awaiting ON qfinera_fund_contributions (fund_id, approved_at) WHERE status = 'AWAITING_NAV';

-- Duplicate-payment protection (a UTR identifies one bank transfer).
CREATE UNIQUE INDEX IF NOT EXISTS uq_qfund_contributions_utr
  ON qfinera_fund_contributions (fund_id, utr)
  WHERE utr IS NOT NULL AND status NOT IN ('REJECTED', 'CANCELLED');

-- -----------------------------------------------------------------------
-- Withdrawals: REQUESTED -> APPROVED -> AWAITING_NAV -> FINALIZED
-- (COMPLETED from 006 is replaced by FINALIZED.)
-- -----------------------------------------------------------------------
SELECT pg_temp.qf_drop_checks('qfinera_fund_withdrawals'::regclass, '%status%');

ALTER TABLE qfinera_fund_withdrawals
  ADD COLUMN IF NOT EXISTS approved_amount NUMERIC(20,2),
  ADD COLUMN IF NOT EXISTS approved_units NUMERIC(20,4),
  ADD COLUMN IF NOT EXISTS effective_date DATE,
  ADD COLUMN IF NOT EXISTS nav_snapshot_id INTEGER REFERENCES qfinera_fund_nav_snapshots(id),
  ADD COLUMN IF NOT EXISTS residual NUMERIC(20,8), -- sign convention documented in ACCOUNTING_RULES.md
  ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES qfinance_users(id);

UPDATE qfinera_fund_withdrawals SET created_by = member_id WHERE created_by IS NULL;
ALTER TABLE qfinera_fund_withdrawals ALTER COLUMN created_by SET NOT NULL;

SELECT pg_temp.qf_add_constraint('qfinera_fund_withdrawals'::regclass, 'qfinera_fund_withdrawals_status_check',
  $c$CHECK (status IN ('REQUESTED', 'APPROVED', 'AWAITING_NAV', 'FINALIZED', 'REJECTED', 'CANCELLED'))$c$);

SELECT pg_temp.qf_add_constraint('qfinera_fund_withdrawals'::regclass, 'qfinera_fund_withdrawals_lifecycle_check',
  $c$CHECK (
    (approved_amount IS NULL OR approved_amount > 0)
    AND (approved_units IS NULL OR approved_units > 0)
    AND (status NOT IN ('APPROVED', 'AWAITING_NAV', 'FINALIZED')
       OR (approved_by IS NOT NULL AND approved_at IS NOT NULL
           AND (approved_amount IS NOT NULL OR approved_units IS NOT NULL)))
    AND (status = 'FINALIZED'
       OR (nav_used IS NULL AND units_redeemed IS NULL AND gross_amount IS NULL
           AND net_amount IS NULL AND residual IS NULL AND finalized_at IS NULL))
    AND (status != 'FINALIZED'
       OR (nav_used > 0 AND units_redeemed > 0 AND gross_amount > 0 AND net_amount IS NOT NULL
           AND net_amount = gross_amount - charges AND residual IS NOT NULL
           AND effective_date IS NOT NULL AND finalized_at IS NOT NULL AND nav_snapshot_id IS NOT NULL))
  )$c$);

SELECT pg_temp.qf_add_constraint('qfinera_fund_withdrawals'::regclass, 'qfinera_fund_withdrawals_backdate_check',
  $c$CHECK (NOT is_backdated OR length(btrim(coalesce(backdated_reason, ''))) > 0)$c$);

SELECT pg_temp.qf_add_constraint('qfinera_fund_withdrawals'::regclass, 'qfinera_fund_withdrawals_member_fk',
  'FOREIGN KEY (fund_id, member_id) REFERENCES qfinera_fund_memberships (fund_id, user_id)');

CREATE INDEX IF NOT EXISTS idx_qfund_withdrawals_effective ON qfinera_fund_withdrawals (fund_id, effective_date);
CREATE INDEX IF NOT EXISTS idx_qfund_withdrawals_awaiting ON qfinera_fund_withdrawals (fund_id, approved_at) WHERE status = 'AWAITING_NAV';

-- -----------------------------------------------------------------------
-- Trades
-- -----------------------------------------------------------------------
ALTER TABLE qfinera_fund_trades
  ADD COLUMN IF NOT EXISTS charges_override_reason TEXT,
  ADD COLUMN IF NOT EXISTS external_ref TEXT, -- broker contract-note/trade id; CSV duplicate detection
  ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reversed_by INTEGER REFERENCES qfinance_users(id);

SELECT pg_temp.qf_add_constraint('qfinera_fund_trades'::regclass, 'qfinera_fund_trades_override_check',
  $c$CHECK (NOT charges_overridden OR length(btrim(coalesce(charges_override_reason, ''))) > 0)$c$);
SELECT pg_temp.qf_add_constraint('qfinera_fund_trades'::regclass, 'qfinera_fund_trades_backdate_check',
  $c$CHECK (NOT is_backdated OR length(btrim(coalesce(backdated_reason, ''))) > 0)$c$);
SELECT pg_temp.qf_add_constraint('qfinera_fund_trades'::regclass, 'qfinera_fund_trades_reversal_check',
  $c$CHECK ((status = 'REVERSED') = (reversed_at IS NOT NULL))$c$);

CREATE UNIQUE INDEX IF NOT EXISTS uq_qfund_trades_external_ref
  ON qfinera_fund_trades (fund_id, external_ref) WHERE external_ref IS NOT NULL;

-- -----------------------------------------------------------------------
-- Expenses: an approved expense reduces fund cash on expense_date.
-- -----------------------------------------------------------------------
SELECT pg_temp.qf_drop_checks('qfinera_fund_expenses'::regclass, '%status%');

ALTER TABLE qfinera_fund_expenses
  ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES qfinance_users(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

SELECT pg_temp.qf_add_constraint('qfinera_fund_expenses'::regclass, 'qfinera_fund_expenses_status_check',
  $c$CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'REVERSED'))$c$);

-- -----------------------------------------------------------------------
-- Ledger
-- -----------------------------------------------------------------------
ALTER TABLE qfinera_fund_ledger_entries
  ADD COLUMN IF NOT EXISTS accounting_version INTEGER NOT NULL DEFAULT 1;

SELECT pg_temp.qf_add_constraint('qfinera_fund_ledger_entries'::regclass, 'qfinera_fund_ledger_version_check',
  'CHECK (accounting_version > 0)');

SELECT pg_temp.qf_add_constraint('qfinera_fund_ledger_entries'::regclass, 'qfinera_fund_ledger_shape_check',
  $c$CHECK (
    CASE entry_type
      WHEN 'CONTRIBUTION' THEN member_id IS NOT NULL AND units_delta > 0 AND cash_delta > 0
      WHEN 'WITHDRAWAL'   THEN member_id IS NOT NULL AND units_delta < 0 AND cash_delta < 0
      WHEN 'BUY'          THEN member_id IS NULL AND units_delta = 0 AND cash_delta < 0
      WHEN 'SELL'         THEN member_id IS NULL AND units_delta = 0
      WHEN 'EXPENSE'      THEN member_id IS NULL AND units_delta = 0 AND cash_delta < 0
      ELSE true
    END
  )$c$);

SELECT pg_temp.qf_add_constraint('qfinera_fund_ledger_entries'::regclass, 'qfinera_fund_ledger_backdate_check',
  $c$CHECK (NOT is_backdated OR length(btrim(coalesce(backdated_reason, ''))) > 0)$c$);

-- member_id is nullable; with the default MATCH SIMPLE, a NULL member_id
-- skips this FK (fund-level entries) and a non-null one must be a member.
SELECT pg_temp.qf_add_constraint('qfinera_fund_ledger_entries'::regclass, 'qfinera_fund_ledger_member_fk',
  'FOREIGN KEY (fund_id, member_id) REFERENCES qfinera_fund_memberships (fund_id, user_id)');

-- One primary posting per source record: prevents duplicate finalization
-- (a second CONTRIBUTION/WITHDRAWAL/BUY/SELL/EXPENSE for the same row).
-- Corrections use REVERSAL / ADJUSTMENT, which are exempt.
CREATE UNIQUE INDEX IF NOT EXISTS uq_qfund_ledger_single_posting
  ON qfinera_fund_ledger_entries (reference_table, reference_id, entry_type)
  WHERE entry_type IN ('CONTRIBUTION', 'WITHDRAWAL', 'BUY', 'SELL', 'EXPENSE');

-- -----------------------------------------------------------------------
-- Audit log
-- -----------------------------------------------------------------------
ALTER TABLE qfinera_fund_audit_log
  ADD COLUMN IF NOT EXISTS diff JSONB;

-- -----------------------------------------------------------------------
-- Settings (one row per fund). Tax rates are informational only and never
-- affect NAV or units.
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS qfinera_fund_settings (
  fund_id INTEGER PRIMARY KEY REFERENCES qfinera_funds(id),
  charge_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  tax_assumptions JSONB NOT NULL DEFAULT '{"stcg_rate": "20", "ltcg_rate": "12.5"}'::jsonb,
  report_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  market_data_provider TEXT NOT NULL DEFAULT 'manual',
  updated_by INTEGER REFERENCES qfinance_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------
-- Append-only protection.
-- Guards against application bugs and ad-hoc SQL by non-owners; a database
-- OWNER can still drop a trigger, so this is defense in depth, not a
-- substitute for access control on the database role.
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION qfinera_fund_forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% on % is not permitted: append-only table (record a REVERSAL/ADJUSTMENT instead)', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_qfund_ledger_no_mutation ON qfinera_fund_ledger_entries;
CREATE TRIGGER trg_qfund_ledger_no_mutation
  BEFORE UPDATE OR DELETE ON qfinera_fund_ledger_entries
  FOR EACH ROW EXECUTE FUNCTION qfinera_fund_forbid_mutation();

DROP TRIGGER IF EXISTS trg_qfund_ledger_no_truncate ON qfinera_fund_ledger_entries;
CREATE TRIGGER trg_qfund_ledger_no_truncate
  BEFORE TRUNCATE ON qfinera_fund_ledger_entries
  FOR EACH STATEMENT EXECUTE FUNCTION qfinera_fund_forbid_mutation();

DROP TRIGGER IF EXISTS trg_qfund_audit_no_mutation ON qfinera_fund_audit_log;
CREATE TRIGGER trg_qfund_audit_no_mutation
  BEFORE UPDATE OR DELETE ON qfinera_fund_audit_log
  FOR EACH ROW EXECUTE FUNCTION qfinera_fund_forbid_mutation();

DROP TRIGGER IF EXISTS trg_qfund_audit_no_truncate ON qfinera_fund_audit_log;
CREATE TRIGGER trg_qfund_audit_no_truncate
  BEFORE TRUNCATE ON qfinera_fund_audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION qfinera_fund_forbid_mutation();

-- NAV snapshots: never deleted; the only permitted UPDATE is flipping
-- is_official when a correction supersedes a snapshot.
CREATE OR REPLACE FUNCTION qfinera_fund_nav_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'DELETE on % is not permitted: NAV history is append-only', TG_TABLE_NAME
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF (to_jsonb(NEW) - 'is_official') IS DISTINCT FROM (to_jsonb(OLD) - 'is_official') THEN
    RAISE EXCEPTION 'UPDATE on % may only change is_official; record a corrected snapshot instead', TG_TABLE_NAME
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_qfund_nav_guard ON qfinera_fund_nav_snapshots;
CREATE TRIGGER trg_qfund_nav_guard
  BEFORE UPDATE OR DELETE ON qfinera_fund_nav_snapshots
  FOR EACH ROW EXECUTE FUNCTION qfinera_fund_nav_guard();

COMMIT;
