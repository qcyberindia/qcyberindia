-- QFinera trading model: products, position actions, derivative contracts.
--
-- 006-011 are NOT modified. This migration:
--   * trades: `product` (EQUITY_DELIVERY | EQUITY_INTRADAY | FUTURES |
--     OPTIONS) and `position_action` (OPEN_LONG | OPEN_SHORT | CLOSE_LONG |
--     CLOSE_SHORT). The side stays the execution side and must agree with
--     the action (OPEN_LONG/CLOSE_SHORT = BUY, OPEN_SHORT/CLOSE_LONG = SELL).
--     Delivery is long-only. Existing trades are backfilled as
--     EQUITY_DELIVERY with BUY -> OPEN_LONG and SELL -> CLOSE_LONG, which is
--     exactly how they were accounted before, so no position, cash or NAV
--     changes.
--   * instruments: `instrument_type` (EQUITY | FUTURE | OPTION) plus the
--     contract fields a derivative needs (underlying, expiry, strike, CE/PE).
--     A CHECK keeps an EQUITY row free of contract fields and requires them
--     on derivatives, so an equity master row can never stand in for a
--     contract. Existing rows become EQUITY. Lot size reuses 011's column.
--   * ledger: entry type TRADE_MTM, the cash posting of a mark-to-market
--     product trade (EQUITY_INTRADAY, FUTURES): charges on open, the price
--     difference less charges on close. Its cash may be negative, zero or
--     positive. It counts as a primary posting (one per trade).
--
-- Safe to re-run. Runs in one transaction.
--
--   psql "$DATABASE_URL" -f db/migrations/012_qfinera_positions_derivatives.sql

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
-- Instruments
-- -----------------------------------------------------------------------
ALTER TABLE qfinera_fund_instruments
  ADD COLUMN IF NOT EXISTS instrument_type TEXT NOT NULL DEFAULT 'EQUITY',
  ADD COLUMN IF NOT EXISTS underlying_symbol TEXT,
  ADD COLUMN IF NOT EXISTS expiry_date DATE,
  ADD COLUMN IF NOT EXISTS strike_price NUMERIC(20,4),
  ADD COLUMN IF NOT EXISTS option_type TEXT;

SELECT pg_temp.qf_add_constraint('qfinera_fund_instruments'::regclass, 'qfinera_fund_instruments_type_check',
  $c$CHECK (
    CASE instrument_type
      WHEN 'EQUITY' THEN underlying_symbol IS NULL AND expiry_date IS NULL AND strike_price IS NULL AND option_type IS NULL
      WHEN 'FUTURE' THEN underlying_symbol IS NOT NULL AND expiry_date IS NOT NULL
                         AND strike_price IS NULL AND option_type IS NULL
      WHEN 'OPTION' THEN underlying_symbol IS NOT NULL AND expiry_date IS NOT NULL
                         AND strike_price IS NOT NULL AND strike_price > 0 AND option_type IN ('CE', 'PE')
      ELSE false
    END
  )$c$);

-- One row per contract.
CREATE UNIQUE INDEX IF NOT EXISTS uq_qfund_instruments_contract
  ON qfinera_fund_instruments (exchange, underlying_symbol, expiry_date, instrument_type, COALESCE(strike_price, 0), COALESCE(option_type, ''))
  WHERE instrument_type <> 'EQUITY';

CREATE INDEX IF NOT EXISTS idx_qfund_instruments_type_underlying
  ON qfinera_fund_instruments (instrument_type, underlying_symbol, expiry_date);

-- -----------------------------------------------------------------------
-- Trades
-- -----------------------------------------------------------------------
ALTER TABLE qfinera_fund_trades
  ADD COLUMN IF NOT EXISTS product TEXT NOT NULL DEFAULT 'EQUITY_DELIVERY',
  ADD COLUMN IF NOT EXISTS position_action TEXT;

UPDATE qfinera_fund_trades
   SET position_action = CASE side WHEN 'BUY' THEN 'OPEN_LONG' ELSE 'CLOSE_LONG' END
 WHERE position_action IS NULL;

ALTER TABLE qfinera_fund_trades ALTER COLUMN position_action SET NOT NULL;

SELECT pg_temp.qf_add_constraint('qfinera_fund_trades'::regclass, 'qfinera_fund_trades_product_check',
  $c$CHECK (product IN ('EQUITY_DELIVERY', 'EQUITY_INTRADAY', 'FUTURES', 'OPTIONS'))$c$);

SELECT pg_temp.qf_add_constraint('qfinera_fund_trades'::regclass, 'qfinera_fund_trades_action_check',
  $c$CHECK (
    position_action IN ('OPEN_LONG', 'OPEN_SHORT', 'CLOSE_LONG', 'CLOSE_SHORT')
    AND side = CASE WHEN position_action IN ('OPEN_LONG', 'CLOSE_SHORT') THEN 'BUY' ELSE 'SELL' END
    AND (product <> 'EQUITY_DELIVERY' OR position_action IN ('OPEN_LONG', 'CLOSE_LONG'))
  )$c$);

CREATE INDEX IF NOT EXISTS idx_qfund_trades_fund_product ON qfinera_fund_trades (fund_id, instrument_id, product);

-- -----------------------------------------------------------------------
-- Ledger: TRADE_MTM
-- -----------------------------------------------------------------------
-- 006's inline entry_type list.
SELECT pg_temp.qf_drop_checks('qfinera_fund_ledger_entries'::regclass, '%entry_type = ANY%');
SELECT pg_temp.qf_add_constraint('qfinera_fund_ledger_entries'::regclass, 'qfinera_fund_ledger_entry_type_v2_check',
  $c$CHECK (entry_type IN ('CONTRIBUTION', 'WITHDRAWAL', 'BUY', 'SELL', 'EXPENSE', 'ADJUSTMENT', 'REVERSAL', 'TRADE_MTM'))$c$);

ALTER TABLE qfinera_fund_ledger_entries DROP CONSTRAINT IF EXISTS qfinera_fund_ledger_shape_check;
SELECT pg_temp.qf_add_constraint('qfinera_fund_ledger_entries'::regclass, 'qfinera_fund_ledger_shape_v2_check',
  $c$CHECK (
    CASE entry_type
      WHEN 'CONTRIBUTION' THEN member_id IS NOT NULL AND units_delta > 0 AND cash_delta > 0
      WHEN 'WITHDRAWAL'   THEN member_id IS NOT NULL AND units_delta < 0 AND cash_delta < 0
      WHEN 'BUY'          THEN member_id IS NULL AND units_delta = 0 AND cash_delta < 0
      WHEN 'SELL'         THEN member_id IS NULL AND units_delta = 0
      WHEN 'EXPENSE'      THEN member_id IS NULL AND units_delta = 0 AND cash_delta < 0
      WHEN 'TRADE_MTM'    THEN member_id IS NULL AND units_delta = 0
      ELSE true
    END
  )$c$);

CREATE UNIQUE INDEX IF NOT EXISTS uq_qfund_ledger_single_posting_v2
  ON qfinera_fund_ledger_entries (reference_table, reference_id, entry_type)
  WHERE entry_type IN ('CONTRIBUTION', 'WITHDRAWAL', 'BUY', 'SELL', 'EXPENSE', 'TRADE_MTM');
DROP INDEX IF EXISTS uq_qfund_ledger_single_posting;

COMMIT;
