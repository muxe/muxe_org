CREATE TABLE IF NOT EXISTS "schema_migrations" (version varchar(128) primary key);
CREATE TABLE reactions (
  key   TEXT PRIMARY KEY
        CHECK (key IN ('rocket', 'whale', 'coffee', 'thumbsup')),
  emoji TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
        CHECK (count >= 0)
);
-- Dbmate schema migrations
INSERT INTO "schema_migrations" (version) VALUES
  ('20260918120000');
