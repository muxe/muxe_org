---
inclusion: always
---

# muxe.org

Personal website served as a REST API. Browsers get an HTML viewer of the same
JSON; `curl` gets JSON. Zero dependencies — hand-rolled on `node:http`. No web
framework; don't add one.

## Layout (`src/`)
- `data.ts` — all editable content. Routes derive from it.
- `routes.ts` — route definitions + content negotiation.
- `router.ts` — tiny exact-match router with `:param` support.
- `http.ts` — `json()` / `redirect()` / `html()` helpers, security headers.
- `db.ts` — SQLite (reactions). `config.ts` — env config. `ratelimit.ts` — token bucket.
- `server.ts` — `node:http` server, logging, shutdown.

Node >= 24, TypeScript run via `--experimental-strip-types` (no build step in dev).
