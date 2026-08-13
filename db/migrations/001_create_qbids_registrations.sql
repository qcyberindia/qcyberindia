-- Qbids beta registrations — explicit schema, run once against production
-- before launch instead of relying on the app's runtime
-- CREATE TABLE IF NOT EXISTS fallback (see lib/db.ts ensureQbidsTable).
--
-- Run manually via the Neon SQL editor, or:
--   psql "$DATABASE_URL" -f db/migrations/001_create_qbids_registrations.sql

CREATE TABLE IF NOT EXISTS qbids_registrations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  portals TEXT[] NOT NULL DEFAULT '{}',
  challenge TEXT,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'reviewed', 'qualified', 'invited', 'active', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qbids_registrations_status ON qbids_registrations (status);
CREATE INDEX IF NOT EXISTS idx_qbids_registrations_created_at ON qbids_registrations (created_at DESC);
