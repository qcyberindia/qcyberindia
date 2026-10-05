-- QFinera: private Pool Chat.
--
-- One conversation per pool, visible only to the pool's active members
-- (every role, VIEWER included). Authorization is enforced by the app on
-- every request (lib/fund/services/chat.ts); this table only stores.
--
--   * A message is edited or removed in place: edited_at / deleted_at.
--     A removed message keeps its row (deleted_by records who removed it)
--     and its body is cleared from the conversation. When an ADMIN removes
--     someone else's message, the removed text is kept in that audit row
--     so the moderation can be reviewed.
--   * Chat is conversation, not accounting: ordinary messages are NOT
--     written to the financial audit log. An ADMIN removing someone else's
--     message is (action chat.message_removed).
--   * Purged with the pool (lib/fund/pool-purge.ts). No append-only trigger,
--     so no purge exception is needed.
--
-- 001-015 are NOT modified. Safe to re-run. Runs in one transaction.
--
--   psql "$DATABASE_URL" -f db/migrations/016_qfinera_pool_chat.sql

BEGIN;

CREATE TABLE IF NOT EXISTS qfinera_fund_messages (
  id SERIAL PRIMARY KEY,
  fund_id INTEGER NOT NULL REFERENCES qfinera_funds(id),
  user_id INTEGER NOT NULL REFERENCES qfinance_users(id),
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  deleted_by INTEGER REFERENCES qfinance_users(id),
  -- A live message has 1..2000 characters; a removed one has none.
  CHECK (
    (deleted_at IS NULL AND deleted_by IS NULL AND length(btrim(body)) BETWEEN 1 AND 2000)
    OR (deleted_at IS NOT NULL AND deleted_by IS NOT NULL AND body = '')
  )
);

-- Newest-first pages and "since" polling within one pool.
CREATE INDEX IF NOT EXISTS idx_qfund_messages_fund_id ON qfinera_fund_messages (fund_id, id DESC);
-- Per-user rate limit lookups.
CREATE INDEX IF NOT EXISTS idx_qfund_messages_fund_user_time ON qfinera_fund_messages (fund_id, user_id, created_at DESC);

COMMIT;
