-- QFinera Fund: additive workflow support on top of 006 + 007.
--
-- 006 and 007 are NOT modified. This migration:
--   * trades: DRAFT -> EXECUTED -> SETTLED (+ CANCELLED / REVERSED), with
--     settlement_date, notes and execution metadata. Legacy FINALIZED rows
--     remain valid and are treated as EXECUTED.
--   * expenses: payment reference + approval-consistency check
--   * watchlist: notes, research link, soft-archive
--   * settings: per-fund NAV cutoff (IST) and market holidays
--   * a few lookup indexes
--
-- Safe to re-run. Runs in one transaction.
--
--   psql "$DATABASE_URL" -f db/migrations/008_qfinera_fund_workflow.sql

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

CREATE OR REPLACE FUNCTION pg_temp.qf_add_constraint(tbl regclass, cname text, ddl text) RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = tbl AND conname = cname) THEN
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', tbl, cname, ddl);
  END IF;
END $$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------
-- Trades
--   DRAFT      recorded, no accounting effect
--   EXECUTED   cash + holdings change on trade_date (ledger BUY/SELL posted)
--   SETTLED    informational: broker settlement confirmed
--   CANCELLED  a DRAFT that was discarded (never had accounting effect)
--   REVERSED   an EXECUTED/SETTLED trade undone by a REVERSAL ledger entry
--   FINALIZED  legacy value from 006; treated as EXECUTED
-- -----------------------------------------------------------------------
ALTER TABLE qfinera_fund_trades
  ADD COLUMN IF NOT EXISTS settlement_date DATE,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS executed_by INTEGER REFERENCES qfinance_users(id),
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS settled_by INTEGER REFERENCES qfinance_users(id),
  ADD COLUMN IF NOT EXISTS reversal_reason TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

SELECT pg_temp.qf_drop_checks('qfinera_fund_trades'::regclass, '%FINALIZED%');

SELECT pg_temp.qf_add_constraint('qfinera_fund_trades'::regclass, 'qfinera_fund_trades_status_v2_check',
  $c$CHECK (status IN ('DRAFT', 'EXECUTED', 'SETTLED', 'CANCELLED', 'REVERSED', 'FINALIZED'))$c$);

ALTER TABLE qfinera_fund_trades ALTER COLUMN status SET DEFAULT 'DRAFT';

SELECT pg_temp.qf_add_constraint('qfinera_fund_trades'::regclass, 'qfinera_fund_trades_lifecycle_check',
  $c$CHECK (
    (status NOT IN ('EXECUTED', 'SETTLED') OR (executed_at IS NOT NULL AND executed_by IS NOT NULL))
    AND (status != 'SETTLED' OR settled_at IS NOT NULL)
    AND (status != 'REVERSED' OR length(btrim(coalesce(reversal_reason, ''))) > 0)
  )$c$);

CREATE INDEX IF NOT EXISTS idx_qfund_trades_fund_status ON qfinera_fund_trades (fund_id, status);

-- -----------------------------------------------------------------------
-- Expenses: an APPROVED expense must record who approved it and when.
-- NOT VALID so any pre-existing rows are not re-checked.
-- -----------------------------------------------------------------------
ALTER TABLE qfinera_fund_expenses
  ADD COLUMN IF NOT EXISTS payment_reference TEXT;

ALTER TABLE qfinera_fund_expenses ALTER COLUMN status SET DEFAULT 'PENDING';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'qfinera_fund_expenses'::regclass AND conname = 'qfinera_fund_expenses_approval_check'
  ) THEN
    ALTER TABLE qfinera_fund_expenses
      ADD CONSTRAINT qfinera_fund_expenses_approval_check
      CHECK (status NOT IN ('APPROVED', 'REVERSED') OR (approved_by IS NOT NULL AND approved_at IS NOT NULL))
      NOT VALID;
  END IF;
END $$;

-- -----------------------------------------------------------------------
-- Watchlist: informational only; never touches accounting.
-- -----------------------------------------------------------------------
ALTER TABLE qfinera_fund_watchlist_items
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS research_url TEXT,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by INTEGER REFERENCES qfinance_users(id);

CREATE INDEX IF NOT EXISTS idx_qfund_watchlist_active ON qfinera_fund_watchlist_items (fund_id) WHERE archived_at IS NULL;

-- -----------------------------------------------------------------------
-- Settings: NAV cutoff (IST) and market holidays, per fund.
--   {"cutoff_time_ist": "16:00", "holidays": ["2026-10-02", ...]}
-- A request confirmed/approved at or before the cutoff on a trading day
-- takes that day's EOD NAV; otherwise the next trading day's.
-- -----------------------------------------------------------------------
ALTER TABLE qfinera_fund_settings
  ADD COLUMN IF NOT EXISTS nav_settings JSONB NOT NULL
  DEFAULT '{"cutoff_time_ist": "16:00", "holidays": []}'::jsonb;

-- -----------------------------------------------------------------------
-- Lookup indexes
-- -----------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_qfund_audit_entity ON qfinera_fund_audit_log (fund_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_qfund_price_snapshots_asof ON qfinera_fund_price_snapshots (instrument_id, as_of);

-- One OPEN invite per (fund, email). Expired/used/revoked invites do not count.
CREATE UNIQUE INDEX IF NOT EXISTS uq_qfund_invites_open
  ON qfinera_fund_invites (fund_id, lower(email))
  WHERE used_at IS NULL AND revoked_at IS NULL;

COMMIT;
