import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { startServer, type TestServer } from "./helpers/server.ts";

describe("reactions", () => {
  let server: TestServer;

  before(async () => {
    server = await startServer();
  });
  after(async () => {
    await server.stop();
  });

  test("GET /reactions starts at zero for all keys", async () => {
    const res = await fetch(`${server.baseUrl}/reactions`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.reactions, {
      rocket: 0,
      whale: 0,
      coffee: 0,
      thumbsup: 0,
    });
    // Emoji map is present and covers the same keys.
    assert.deepEqual(Object.keys(body.emoji).sort(), [
      "coffee",
      "rocket",
      "thumbsup",
      "whale",
    ]);
  });

  test("POST /reactions/:key increments and returns the new count", async () => {
    const res = await fetch(`${server.baseUrl}/reactions/rocket`, {
      method: "POST",
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.key, "rocket");
    assert.equal(body.emoji, "🚀");
    assert.equal(body.count, 1);
    assert.equal(typeof body.remaining, "number");
  });

  test("counts accumulate across requests and are reflected in GET", async () => {
    await fetch(`${server.baseUrl}/reactions/coffee`, { method: "POST" });
    await fetch(`${server.baseUrl}/reactions/coffee`, { method: "POST" });
    const res = await fetch(`${server.baseUrl}/reactions`);
    const body = await res.json();
    assert.equal(body.reactions.coffee, 2);
    // rocket still 1 from the previous test (shared DB within this file).
    assert.equal(body.reactions.rocket, 1);
  });

  test("POST with an unknown key is rejected with 400", async () => {
    const res = await fetch(`${server.baseUrl}/reactions/banana`, {
      method: "POST",
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, "invalid_reaction");
    // Unknown key must NOT have created a row / counter.
    const list = await (await fetch(`${server.baseUrl}/reactions`)).json();
    assert.equal(list.reactions.banana, undefined);
  });

  test("counts persist across a server restart (real SQLite durability)", async () => {
    const before = await (await fetch(`${server.baseUrl}/reactions`)).json();
    await server.restart();
    const after = await (await fetch(`${server.baseUrl}/reactions`)).json();
    assert.deepEqual(after.reactions, before.reactions);
    assert.ok(after.reactions.rocket >= 1, "rocket count should have survived");
  });
});

describe("reactions without migrations", () => {
  test("server errors clearly when the DB has no schema", async () => {
    // Start WITHOUT running migrations; the reactions table won't exist.
    const server = await startServer({ skipMigrate: true });
    try {
      const res = await fetch(`${server.baseUrl}/reactions`);
      // The handler throws -> unhandled error path returns 500.
      assert.equal(res.status, 500);
    } finally {
      await server.stop();
    }
  });
});
