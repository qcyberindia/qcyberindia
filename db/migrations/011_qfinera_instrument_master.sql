-- QFinera instrument master: exchange reference attributes on the existing
-- shared qfinera_fund_instruments table, so it can be bulk-populated from
-- an exchange equity list (e.g. NSE EQUITY_L.csv) by
-- scripts/import-nse-equity.ts.
--
-- 006-010 are NOT modified. Every column is nullable and additive: rows
-- created by hand through the instruments API keep working unchanged, and
-- the importer only ever fills/refreshes these columns (it never deletes).
--
--   isin           ISIN as published by the exchange (12 chars, upper-case)
--   series         exchange security series, verbatim (EQ, BE, BZ, ...).
--                  Not constrained to a list: the exchange adds series.
--   listing_date   date of listing on that exchange
--   lot_size       market lot
--   face_value     face value per share (INR)
--   paid_up_value  paid-up value per share (INR)
--   master_source  which reference file last wrote these columns
--   master_synced_at  when it did
--
-- One ISIN maps to at most one symbol per exchange (the same ISIN may be
-- listed on both NSE and BSE).
--
-- Safe to re-run. Runs in one transaction.
--
--   psql "$DATABASE_URL" -f db/migrations/011_qfinera_instrument_master.sql

BEGIN;

ALTER TABLE qfinera_fund_instruments
  ADD COLUMN IF NOT EXISTS isin TEXT,
  ADD COLUMN IF NOT EXISTS series TEXT,
  ADD COLUMN IF NOT EXISTS listing_date DATE,
  ADD COLUMN IF NOT EXISTS lot_size INTEGER,
  ADD COLUMN IF NOT EXISTS face_value NUMERIC(20,4),
  ADD COLUMN IF NOT EXISTS paid_up_value NUMERIC(20,4),
  ADD COLUMN IF NOT EXISTS master_source TEXT,
  ADD COLUMN IF NOT EXISTS master_synced_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'qfinera_fund_instruments'::regclass AND conname = 'qfinera_fund_instruments_master_check'
  ) THEN
    ALTER TABLE qfinera_fund_instruments ADD CONSTRAINT qfinera_fund_instruments_master_check
      CHECK (
        (isin IS NULL OR isin ~ '^[A-Z]{2}[A-Z0-9]{9}[0-9]$')
        AND (lot_size IS NULL OR lot_size > 0)
        AND (face_value IS NULL OR face_value >= 0)
        AND (paid_up_value IS NULL OR paid_up_value >= 0)
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_qfund_instruments_exchange_isin
  ON qfinera_fund_instruments (exchange, isin) WHERE isin IS NOT NULL;

-- ISIN lookup across exchanges (search accepts an ISIN).
CREATE INDEX IF NOT EXISTS idx_qfund_instruments_isin ON qfinera_fund_instruments (isin) WHERE isin IS NOT NULL;

COMMIT;
