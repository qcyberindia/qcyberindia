-- QFinance registration table. Deliberately minimal — the QFinance Beta
-- registration flow (app/qfinance/beta) isn't built yet, so this only
-- captures the fields that flow is certain to need. Kept in its own table
-- (qfinance_registrations), never merged with qbids_registrations — the two
-- products' registrant data stays logically separate even though both are
-- viewable from the unified /admin UI.
CREATE TABLE IF NOT EXISTS qfinance_registrations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
