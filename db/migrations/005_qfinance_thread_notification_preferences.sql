-- Per-thread notification mute for QFinance Community reply notifications.
-- Deliberately minimal — not a general notification-preferences system.
-- Absence of a row = notifications on (the default); a row here means
-- "this user muted this specific discussion."
--
-- Run manually via the Neon SQL editor, or:
--   psql "$DATABASE_URL" -f db/migrations/005_qfinance_thread_notification_preferences.sql

CREATE TABLE IF NOT EXISTS qfinance_community_thread_notification_preferences (
  post_id INTEGER NOT NULL REFERENCES qfinance_community_posts(id),
  user_id INTEGER NOT NULL REFERENCES qfinance_users(id),
  muted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_qf_thread_mute_post_user
  ON qfinance_community_thread_notification_preferences (post_id, user_id);
