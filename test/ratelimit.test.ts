import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { startServer, type TestServer } from "./helpers/server.ts";

describe("rate limiting", () => {
  let server: TestServer;

  before(async () => {
    // Small, deterministic bucket: capacity 3, slow refill so it won't top up
    // mid-test. This exercises the same limiter the app uses in production.
    server = await startServer({
      env: {
        RATE_LIMIT_CAPACITY: "3",
        RATE_LIMIT_REFILL_PER_SEC: "0.01",
      },
    });
  });
  after(async () => {
    await server.stop();
  });

  async function post(ip: string): Promise<Response> {
    return fetch(`${server.baseUrl}/reactions/rocket`, {
      method: "POST",
      headers: { "X-Forwarded-For": ip },
    });
  }

  test("allows a burst up to capacity, then returns 429", async () => {
    const ip = "203.0.113.10";
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      statuses.push((await post(ip)).status);
    }
    // First 3 allowed (capacity), remainder limited.
    assert.deepEqual(statuses, [200, 200, 200, 429, 429]);
  });

  test("429 response carries a Retry-After header and body", async () => {
    const ip = "203.0.113.11";
    // Drain the bucket.
    for (let i = 0; i < 3; i++) await post(ip);
    const res = await post(ip);
    assert.equal(res.status, 429);
    assert.ok(
      res.headers.get("retry-after"),
      "Retry-After header should be set",
    );
    const body = await res.json();
    assert.equal(body.error, "rate_limited");
    assert.equal(typeof body.retryAfter, "number");
  });

  test("limits are per-IP: a different X-Forwarded-For is unaffected", async () => {
    const busy = "203.0.113.12";
    for (let i = 0; i < 3; i++) await post(busy); // drain busy IP
    assert.equal((await post(busy)).status, 429);
    // A fresh IP still has a full bucket.
    assert.equal((await post("198.51.100.42")).status, 200);
  });
});
