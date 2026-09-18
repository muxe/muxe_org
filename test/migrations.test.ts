import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import { migrate, rollback } from "./helpers/server.ts";

/**
 * Migration rollback round-trip. A `migrate:down` that has never been run is
 * effectively no rollback at all — so we prove up -> down -> up works against
 * a real SQLite database using the real dbmate binary.
 */
describe("migrations", () => {
  function tableExists(dbPath: string, name: string): boolean {
    const db = new DatabaseSync(dbPath);
    try {
      const row = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
        )
        .get(name);
      return row !== undefined;
    } finally {
      db.close();
    }
  }

  test("up creates the reactions table, down removes it, up restores it", () => {
    const dir = mkdtempSync(join(tmpdir(), "muxe-migrate-"));
    const dbPath = join(dir, "muxe.db");
    try {
      // up
      migrate(dbPath);
      assert.ok(
        tableExists(dbPath, "reactions"),
        "reactions table should exist after up",
      );

      // down
      const down = rollback(dbPath);
      assert.equal(down.status, 0, `down should succeed:\n${down.stdout}`);
      assert.equal(
        tableExists(dbPath, "reactions"),
        false,
        "reactions table should be gone after down",
      );

      // up again — proves the migration is re-appliable and down was clean
      migrate(dbPath);
      assert.ok(
        tableExists(dbPath, "reactions"),
        "reactions table should be recreated after second up",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("seed data is present and counts start at zero after migrate", () => {
    const dir = mkdtempSync(join(tmpdir(), "muxe-migrate-"));
    const dbPath = join(dir, "muxe.db");
    try {
      migrate(dbPath);
      const db = new DatabaseSync(dbPath);
      try {
        const rows = db
          .prepare("SELECT key, count FROM reactions ORDER BY key")
          .all() as Array<{ key: string; count: number }>;
        assert.deepEqual(
          rows.map((r) => r.key),
          ["coffee", "rocket", "thumbsup", "whale"],
        );
        assert.ok(
          rows.every((r) => r.count === 0),
          "all seeded counts start at 0",
        );
      } finally {
        db.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
