-- QFinera: two kinds of contribution proof.
--
--   PAYMENT   the contributor's evidence that they paid (screenshot, receipt),
--             attached when the contribution is submitted.
--   RECEIVED  an administrator's or manager's evidence that the money was
--             received / verified against the pool's bank statement,
--             attached from the review workflow.
--
-- 013 is NOT modified. Existing proofs were all uploaded by contributors
-- (or on their behalf), so they become PAYMENT. Adding a column with a
-- default does not fire the append-only row trigger.
--
-- Safe to re-run. Runs in one transaction.
--
--   psql "$DATABASE_URL" -f db/migrations/014_qfinera_proof_kinds.sql

BEGIN;

ALTER TABLE qfinera_fund_contribution_proofs
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'PAYMENT';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'qfinera_fund_contribution_proofs'::regclass AND conname = 'qfinera_fund_contribution_proofs_kind_check'
  ) THEN
    ALTER TABLE qfinera_fund_contribution_proofs ADD CONSTRAINT qfinera_fund_contribution_proofs_kind_check
      CHECK (kind IN ('PAYMENT', 'RECEIVED'));
  END IF;
END $$;

COMMIT;
