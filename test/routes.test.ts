import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { startServer, type TestServer } from "./helpers/server.ts";

describe("routing & content", () => {
  let server: TestServer;

  before(async () => {
    server = await startServer();
  });
  after(async () => {
    await server.stop();
  });

  test("GET / returns the profile with discoverable _links", async () => {
    const res = await fetch(`${server.baseUrl}/`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.handle, "muxe");
    // The new reaction routes are advertised.
    assert.equal(body._links.reactions.href, "/reactions");
    assert.equal(body._links.react.method, "POST");
  });

  test("browsers (Accept: text/html) get the HTML viewer", async () => {
    const res = await fetch(`${server.baseUrl}/`, {
      headers: { Accept: "text/html" },
    });
    assert.equal(res.status, 200);
    assert.match(
      res.headers.get("content-type") ?? "",
      /text\/html/,
      "should negotiate HTML for browsers",
    );
    const text = await res.text();
    assert.match(text, /<!DOCTYPE html>/);
  });

  test("GET /health returns ok as JSON", async () => {
    const res = await fetch(`${server.baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "ok");
  });

  test("redirect routes return 302 to the external profile", async () => {
    const res = await fetch(`${server.baseUrl}/github`, { redirect: "manual" });
    assert.equal(res.status, 302);
    assert.match(res.headers.get("location") ?? "", /github\.com/);
  });

  test("unknown route returns 404 with an available-routes list", async () => {
    const res = await fetch(`${server.baseUrl}/does-not-exist`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error, "not_found");
    assert.ok(Array.isArray(body.availableRoutes));
    assert.ok(body.availableRoutes.includes("POST /reactions/{key}"));
  });

  test("wrong method on an existing path returns 405", async () => {
    // /reactions exists for GET (and /reactions/:key for POST); DELETE matches
    // neither method on a known path shape -> 405.
    const res = await fetch(`${server.baseUrl}/reactions/rocket`, {
      method: "DELETE",
    });
    assert.equal(res.status, 405);
    const body = await res.json();
    assert.equal(body.error, "method_not_allowed");
  });

  test("security headers are present", async () => {
    const res = await fetch(`${server.baseUrl}/health`);
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.equal(res.headers.get("referrer-policy"), "no-referrer");
  });
});
