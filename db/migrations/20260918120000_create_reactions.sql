-- migrate:up
-- Fixed-set reaction counters. Keys are constrained to a closed vocabulary so
-- the public POST endpoint has zero free-text surface: the only accepted keys
-- are the ones seeded here, enforced both in the app and by the CHECK below.
CREATE TABLE reactions (
  key   TEXT PRIMARY KEY
        CHECK (key IN ('rocket', 'whale', 'coffee', 'thumbsup')),
  emoji TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
        CHECK (count >= 0)
);

INSERT INTO reactions (key, emoji, count) VALUES
  ('rocket',   '🚀', 0),
  ('whale',    '🐳', 0),
  ('coffee',   '☕', 0),
  ('thumbsup', '👍', 0);

-- migrate:down
DROP TABLE reactions;
