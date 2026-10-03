-- QFinera: contribution payment details + proof files, and executed-trade
-- corrections.
--
-- 006-012 are NOT modified. This migration:
--   * contributions: `payment_method` and `notes` (the member's payment
--     details shown to the reviewing administrator).
--   * qfinera_fund_contribution_proofs: payment screenshots / PDFs, stored in
--     the database (no public URL ever exists). Append-only: a wrong file is
--     superseded by uploading another, never edited or deleted.
--   * qfinera_fund_trade_revisions: one row per correction of an executed
--     trade, holding the values before and after, who, when and why.
--     Append-only. The trade row carries the corrected values; the revision
--     rows (and the audit log) preserve every earlier version.
--   * trades: corrected_at / corrected_by / correction_count.
--
-- Safe to re-run. Runs in one transaction.
--
--   psql "$DATABASE_URL" -f db/migrations/013_qfinera_contribution_proofs_trade_corrections.sql

BEGIN;

-- -----------------------------------------------------------------------
-- Contributions: payment details
-- -----------------------------------------------------------------------
ALTER TABLE qfinera_fund_contributions
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'qfinera_fund_contributions'::regclass AND conname = 'qfinera_fund_contributions_payment_method_check'
  ) THEN
    ALTER TABLE qfinera_fund_contributions ADD CONSTRAINT qfinera_fund_contributions_payment_method_check
      CHECK (payment_method IS NULL OR payment_method IN ('UPI', 'IMPS', 'NEFT', 'RTGS', 'BANK_TRANSFER', 'CHEQUE', 'CASH', 'OTHER'));
  END IF;
END $$;

-- -----------------------------------------------------------------------
-- Contribution proofs
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS qfinera_fund_contribution_proofs (
  id SERIAL PRIMARY KEY,
  fund_id INTEGER NOT NULL REFERENCES qfinera_funds(id),
  contribution_id INTEGER NOT NULL REFERENCES qfinera_fund_contributions(id),
  file_name TEXT NOT NULL CHECK (length(file_name) BETWEEN 1 AND 200),
  content_type TEXT NOT NULL CHECK (content_type IN ('image/png', 'image/jpeg', 'image/webp', 'application/pdf')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 2097152),
  sha256 TEXT NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  data BYTEA NOT NULL,
  uploaded_by INTEGER NOT NULL REFERENCES qfinance_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (octet_length(data) = size_bytes)
);

CREATE INDEX IF NOT EXISTS idx_qfund_contribution_proofs_contribution
  ON qfinera_fund_contribution_proofs (fund_id, contribution_id);

-- (qfinera_fund_forbid_mutation() is defined in migration 007.)
DROP TRIGGER IF EXISTS trg_qfund_proofs_no_mutation ON qfinera_fund_contribution_proofs;
CREATE TRIGGER trg_qfund_proofs_no_mutation
  BEFORE UPDATE OR DELETE ON qfinera_fund_contribution_proofs
  FOR EACH ROW EXECUTE FUNCTION qfinera_fund_forbid_mutation();

-- -----------------------------------------------------------------------
-- Trade corrections
-- -----------------------------------------------------------------------
ALTER TABLE qfinera_fund_trades
  ADD COLUMN IF NOT EXISTS corrected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS corrected_by INTEGER REFERENCES qfinance_users(id),
  ADD COLUMN IF NOT EXISTS correction_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS qfinera_fund_trade_revisions (
  id SERIAL PRIMARY KEY,
  fund_id INTEGER NOT NULL REFERENCES qfinera_funds(id),
  trade_id INTEGER NOT NULL REFERENCES qfinera_fund_trades(id),
  revision INTEGER NOT NULL CHECK (revision > 0),
  before_values JSONB NOT NULL,
  after_values JSONB NOT NULL,
  reason TEXT NOT NULL CHECK (length(btrim(reason)) >= 10),
  corrected_by INTEGER NOT NULL REFERENCES qfinance_users(id),
  corrected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trade_id, revision)
);

CREATE INDEX IF NOT EXISTS idx_qfund_trade_revisions_trade ON qfinera_fund_trade_revisions (fund_id, trade_id);

DROP TRIGGER IF EXISTS trg_qfund_trade_revisions_no_mutation ON qfinera_fund_trade_revisions;
CREATE TRIGGER trg_qfund_trade_revisions_no_mutation
  BEFORE UPDATE OR DELETE ON qfinera_fund_trade_revisions
  FOR EACH ROW EXECUTE FUNCTION qfinera_fund_forbid_mutation();

COMMIT;
