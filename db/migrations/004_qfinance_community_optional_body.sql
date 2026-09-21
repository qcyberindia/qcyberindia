-- Makes the question body/context optional, per the discussion-first UX
-- redesign: a question is valid on its own; additional context is a bonus,
-- not a requirement. Existing rows are untouched (they all have a body
-- already, from when it was required).
ALTER TABLE qfinance_community_posts ALTER COLUMN body DROP NOT NULL;
