import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { REACTION_KEYS, type ReactionKey } from "./data.ts";

/**
 * SQLite persistence via the built-in `node:sqlite` driver — no npm package,
 * no native addon to compile. Schema is owned by dbmate migrations (see
 * db/migrations); this module only opens the already-migrated database and
 * exposes typed operations over it.
 */

/**
 * Where the database lives. Configurable so dev uses a local ./data/muxe.db
 * while production points at a stable path OUTSIDE the release dirs (the
 * systemd unit sets DB_PATH=%h/muxe/data/muxe.db). Must match the path dbmate
 * migrates against.
 */
const DB_PATH = resolve(process.env.DB_PATH ?? "./data/muxe.db");

export interface Reaction {
  key: ReactionKey;
  emoji: string;
  count: number;
}

let db: DatabaseSync | undefined;

/** Open the database once (lazily) and configure pragmas. */
function getDb(): DatabaseSync {
  if (db) return db;

  // dbmate won't create the parent directory; make sure it exists so a fresh
  // box (or a dev machine that hasn't run migrations yet) doesn't crash on open.
  mkdirSync(dirname(DB_PATH), { recursive: true });

  const handle = new DatabaseSync(DB_PATH);
  // WAL: better read/write concurrency and crash resilience than the default
  // rollback journal. NORMAL sync is the standard, safe-with-WAL durability
  // tradeoff. foreign_keys on for correctness if the schema grows.
  handle.exec("PRAGMA journal_mode = WAL;");
  handle.exec("PRAGMA synchronous = NORMAL;");
  handle.exec("PRAGMA foreign_keys = ON;");

  assertSchema(handle);
  db = handle;
  return db;
}

/**
 * Fail fast with a clear message if the reactions table is missing — that
 * means migrations haven't been run against this DB_PATH yet.
 */
function assertSchema(handle: DatabaseSync): void {
  const row = handle
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'reactions'")
    .get();
  if (!row) {
    throw new Error(
      `reactions table not found in ${DB_PATH}. Run migrations first: ` +
        `'npm run db:migrate' (dev) or the deploy migration step (prod).`,
    );
  }
}

/** All reaction counts, ordered by the fixed key list for stable output. */
export function getReactions(): Reaction[] {
  const rows = getDb()
    .prepare("SELECT key, emoji, count FROM reactions")
    .all() as unknown as Reaction[];
  const byKey = new Map(rows.map((r) => [r.key, r]));
  // Preserve the declared order regardless of row order from SQLite.
  return REACTION_KEYS.map((key) => byKey.get(key)).filter((r): r is Reaction => r !== undefined);
}

/**
 * Atomically increment one reaction and return the updated row. Returns
 * undefined if the key isn't a known reaction (defensive — callers validate
 * against REACTION_KEYS first, and the table CHECK constraint backstops it).
 */
export function incrementReaction(key: ReactionKey): Reaction | undefined {
  const updated = getDb()
    .prepare(
      "UPDATE reactions SET count = count + 1 WHERE key = ? " + "RETURNING key, emoji, count",
    )
    .get(key) as unknown as Reaction | undefined;
  return updated;
}
