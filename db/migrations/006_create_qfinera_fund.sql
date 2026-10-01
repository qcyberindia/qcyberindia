-- QFinera Fund: private pooled-fund accounting domain.
--
-- Identity: reuses qfinance_users (see 003_create_qfinance_community.sql)
-- as-is \u2014 no duplicate user table. Fund membership is a separate join
-- table (qfinera_fund_memberships) keyed to qfinance_users.id, per the
-- approved identity decision. A QFinance Community user does NOT
-- automatically become a Fund member.
--
-- Precision: NAV and units are NUMERIC(20,4) \u2014 4 decimal places,
-- authoritative \u2014 per the approved MVP V1 accounting decisions. Rupee
-- amount columns (cash, contributions, charges, expenses) are
-- NUMERIC(20,2); they don't need 4dp precision, but computing them
-- through the same 4dp-scaled BigInt arithmetic (see lib/accounting/money.ts)
-- before storage is safe \u2014 more precision carried through calculation
-- than the column strictly needs, never less.
--
-- Run manually via the Neon SQL editor, or:
--   psql "$DATABASE_URL" -f db/migrations/006_create_qfinera_fund.sql

CREATE TABLE IF NOT EXISTS qfinera_funds (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  currency TEXT NOT NULL DEFAULT 'INR',
  initial_nav NUMERIC(20,4) NOT NULL DEFAULT 10.0000 CHECK (initial_nav > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_by INTEGER NOT NULL REFERENCES qfinance_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fund starts with zero capital and zero units per the approved decision;
-- no seed/founder row is inserted here \u2014 the first real approved
-- contribution is what creates the fund's first units, exactly like any
-- other contribution.

CREATE TABLE IF NOT EXISTS qfinera_fund_memberships (
  id SERIAL PRIMARY KEY,
  fund_id INTEGER NOT NULL REFERENCES qfinera_funds(id),
  user_id INTEGER NOT NULL REFERENCES qfinance_users(id),
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'MANAGER', 'MEMBER')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  -- Denormalized running balance for fast reads; always derivable from
  -- summing qfinera_fund_ledger_entries.units_delta for this (fund, user)
  -- \u2014 the ledger is the authoritative source, this is a cache of it.
  units NUMERIC(20,4) NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (fund_id, user_id)
);

CREATE TABLE IF NOT EXISTS qfinera_fund_invites (
  id SERIAL PRIMARY KEY,
  fund_id INTEGER NOT NULL REFERENCES qfinera_funds(id),
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'MANAGER', 'MEMBER')),
  -- SHA-256 hash of the invite token, never the raw token \u2014 same
  -- principle as never storing a raw magic-link token (see
  -- lib/qfinance-community-auth.ts), applied here via a stored hash
  -- instead of a stateless signed token specifically because invite
  -- one-time-use enforcement needs a real DB row to check against.
  token_hash TEXT NOT NULL UNIQUE,
  created_by INTEGER NOT NULL REFERENCES qfinance_users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  used_by INTEGER REFERENCES qfinance_users(id),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qfinera_fund_contributions (
  id SERIAL PRIMARY KEY,
  fund_id INTEGER NOT NULL REFERENCES qfinera_funds(id),
  member_id INTEGER NOT NULL REFERENCES qfinance_users(id),
  amount NUMERIC(20,2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL,
  utr TEXT,
  payment_proof_reference TEXT, -- opaque private-storage reference; never a public URL
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  -- Populated only on approval, using the next applicable EOD NAV per the
  -- approved effective-date rule \u2014 never at request time.
  nav_used NUMERIC(20,4),
  units_allocated NUMERIC(20,4),
  approved_by INTEGER REFERENCES qfinance_users(id),
  approved_at TIMESTAMPTZ,
  is_backdated BOOLEAN NOT NULL DEFAULT false,
  backdated_reason TEXT,
  created_by INTEGER NOT NULL REFERENCES qfinance_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status != 'APPROVED' OR (nav_used IS NOT NULL AND units_allocated IS NOT NULL AND approved_by IS NOT NULL AND approved_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS qfinera_fund_withdrawals (
  id SERIAL PRIMARY KEY,
  fund_id INTEGER NOT NULL REFERENCES qfinera_funds(id),
  member_id INTEGER NOT NULL REFERENCES qfinance_users(id),
  -- Approved decision: support both request shapes.
  request_type TEXT NOT NULL CHECK (request_type IN ('AMOUNT', 'UNITS')),
  requested_amount NUMERIC(20,2),
  requested_units NUMERIC(20,4),
  nav_used NUMERIC(20,4),
  units_redeemed NUMERIC(20,4),
  gross_amount NUMERIC(20,2),
  charges NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (charges >= 0),
  net_amount NUMERIC(20,2),
  status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED')),
  approved_by INTEGER REFERENCES qfinance_users(id),
  approved_at TIMESTAMPTZ,
  is_backdated BOOLEAN NOT NULL DEFAULT false,
  backdated_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (request_type = 'AMOUNT' AND requested_amount IS NOT NULL AND requested_amount > 0) OR
    (request_type = 'UNITS' AND requested_units IS NOT NULL AND requested_units > 0)
  )
);

CREATE TABLE IF NOT EXISTS qfinera_fund_instruments (
  id SERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  exchange TEXT NOT NULL CHECK (exchange IN ('NSE', 'BSE')),
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (symbol, exchange)
);

CREATE TABLE IF NOT EXISTS qfinera_fund_trades (
  id SERIAL PRIMARY KEY,
  fund_id INTEGER NOT NULL REFERENCES qfinera_funds(id),
  instrument_id INTEGER NOT NULL REFERENCES qfinera_fund_instruments(id),
  trade_date DATE NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
  quantity NUMERIC(20,4) NOT NULL CHECK (quantity > 0),
  price NUMERIC(20,4) NOT NULL CHECK (price > 0),
  brokerage NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (brokerage >= 0),
  stt NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (stt >= 0),
  gst NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (gst >= 0),
  stamp_duty NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (stamp_duty >= 0),
  other_charges NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (other_charges >= 0),
  -- true if any charge above was manually entered/overridden rather than
  -- automatically calculated \u2014 audited per the approved charges decision.
  charges_overridden BOOLEAN NOT NULL DEFAULT false,
  net_value NUMERIC(20,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'FINALIZED' CHECK (status IN ('FINALIZED', 'REVERSED')),
  is_backdated BOOLEAN NOT NULL DEFAULT false,
  backdated_reason TEXT,
  created_by INTEGER NOT NULL REFERENCES qfinance_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qfinera_fund_price_snapshots (
  id SERIAL PRIMARY KEY,
  instrument_id INTEGER NOT NULL REFERENCES qfinera_fund_instruments(id),
  price NUMERIC(20,4) NOT NULL CHECK (price > 0),
  quality TEXT NOT NULL CHECK (quality IN ('LIVE', 'DELAYED', 'EOD', 'MANUAL')),
  source TEXT NOT NULL,
  as_of TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qfinera_fund_nav_snapshots (
  id SERIAL PRIMARY KEY,
  fund_id INTEGER NOT NULL REFERENCES qfinera_funds(id),
  as_of_date DATE NOT NULL,
  nav NUMERIC(20,4) NOT NULL CHECK (nav > 0),
  cash NUMERIC(20,2) NOT NULL,
  holdings_value NUMERIC(20,2) NOT NULL,
  fund_value NUMERIC(20,2) NOT NULL,
  outstanding_units NUMERIC(20,4) NOT NULL,
  calculation_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One official snapshot per fund per day \u2014 never silently overwritten;
  -- a correction is a new row with a higher calculation_version, and the
  -- application layer (not this constraint) decides which version is
  -- "official" for reporting.
  UNIQUE (fund_id, as_of_date, calculation_version)
);

CREATE TABLE IF NOT EXISTS qfinera_fund_ledger_entries (
  id SERIAL PRIMARY KEY,
  fund_id INTEGER NOT NULL REFERENCES qfinera_funds(id),
  member_id INTEGER REFERENCES qfinance_users(id), -- null for fund-level entries (trades, expenses)
  entry_type TEXT NOT NULL CHECK (entry_type IN ('CONTRIBUTION', 'WITHDRAWAL', 'BUY', 'SELL', 'EXPENSE', 'ADJUSTMENT', 'REVERSAL')),
  reference_table TEXT NOT NULL,
  reference_id INTEGER NOT NULL,
  entry_date DATE NOT NULL,
  cash_delta NUMERIC(20,2) NOT NULL DEFAULT 0,
  units_delta NUMERIC(20,4) NOT NULL DEFAULT 0,
  description TEXT,
  is_backdated BOOLEAN NOT NULL DEFAULT false,
  backdated_reason TEXT,
  created_by INTEGER NOT NULL REFERENCES qfinance_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  -- Append-only by convention (enforced at the application layer, same
  -- pattern as qfinance_community_reports' audit trail) \u2014 corrections are
  -- new REVERSAL/ADJUSTMENT rows, never an UPDATE/DELETE of a finalized entry.
);

CREATE TABLE IF NOT EXISTS qfinera_fund_watchlist_items (
  id SERIAL PRIMARY KEY,
  fund_id INTEGER NOT NULL REFERENCES qfinera_funds(id),
  instrument_id INTEGER REFERENCES qfinera_fund_instruments(id),
  symbol TEXT NOT NULL,
  title TEXT NOT NULL,
  thesis TEXT,
  target_price NUMERIC(20,4),
  stop_loss NUMERIC(20,4),
  status TEXT NOT NULL DEFAULT 'IDEA' CHECK (status IN ('IDEA', 'WATCHING', 'ACTIVE', 'INVALIDATED', 'COMPLETED')),
  created_by INTEGER NOT NULL REFERENCES qfinance_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qfinera_fund_watchlist_comments (
  id SERIAL PRIMARY KEY,
  watchlist_item_id INTEGER NOT NULL REFERENCES qfinera_fund_watchlist_items(id),
  author_id INTEGER NOT NULL REFERENCES qfinance_users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qfinera_fund_expenses (
  id SERIAL PRIMARY KEY,
  fund_id INTEGER NOT NULL REFERENCES qfinera_funds(id),
  category TEXT NOT NULL,
  amount NUMERIC(20,2) NOT NULL CHECK (amount > 0),
  expense_date DATE NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'APPROVED' CHECK (status IN ('APPROVED', 'PENDING')),
  created_by INTEGER NOT NULL REFERENCES qfinance_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qfinera_fund_audit_log (
  id SERIAL PRIMARY KEY,
  fund_id INTEGER REFERENCES qfinera_funds(id),
  user_id INTEGER REFERENCES qfinance_users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  before_state JSONB,
  after_state JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  -- Append-only: normal application code paths never UPDATE/DELETE this
  -- table. No CHECK constraint can enforce that at the schema level in
  -- Postgres without a trigger, which is deliberately deferred rather
  -- than added speculatively \u2014 see the implementation report.
);

CREATE INDEX IF NOT EXISTS idx_qfund_memberships_fund ON qfinera_fund_memberships (fund_id);
CREATE INDEX IF NOT EXISTS idx_qfund_memberships_user ON qfinera_fund_memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_qfund_invites_fund ON qfinera_fund_invites (fund_id);
CREATE INDEX IF NOT EXISTS idx_qfund_contributions_fund_status ON qfinera_fund_contributions (fund_id, status);
CREATE INDEX IF NOT EXISTS idx_qfund_contributions_member ON qfinera_fund_contributions (fund_id, member_id);
CREATE INDEX IF NOT EXISTS idx_qfund_withdrawals_fund_status ON qfinera_fund_withdrawals (fund_id, status);
CREATE INDEX IF NOT EXISTS idx_qfund_withdrawals_member ON qfinera_fund_withdrawals (fund_id, member_id);
CREATE INDEX IF NOT EXISTS idx_qfund_trades_fund_date ON qfinera_fund_trades (fund_id, trade_date);
CREATE INDEX IF NOT EXISTS idx_qfund_trades_fund_instrument ON qfinera_fund_trades (fund_id, instrument_id);
CREATE INDEX IF NOT EXISTS idx_qfund_price_snapshots_instrument ON qfinera_fund_price_snapshots (instrument_id, as_of DESC);
CREATE INDEX IF NOT EXISTS idx_qfund_nav_snapshots_fund_date ON qfinera_fund_nav_snapshots (fund_id, as_of_date DESC);
CREATE INDEX IF NOT EXISTS idx_qfund_ledger_fund_date ON qfinera_fund_ledger_entries (fund_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_qfund_ledger_fund_member ON qfinera_fund_ledger_entries (fund_id, member_id);
CREATE INDEX IF NOT EXISTS idx_qfund_ledger_reference ON qfinera_fund_ledger_entries (reference_table, reference_id);
CREATE INDEX IF NOT EXISTS idx_qfund_watchlist_fund ON qfinera_fund_watchlist_items (fund_id);
CREATE INDEX IF NOT EXISTS idx_qfund_watchlist_comments_item ON qfinera_fund_watchlist_comments (watchlist_item_id);
CREATE INDEX IF NOT EXISTS idx_qfund_expenses_fund_date ON qfinera_fund_expenses (fund_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_qfund_audit_fund ON qfinera_fund_audit_log (fund_id, created_at DESC);
