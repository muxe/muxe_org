---
inclusion: fileMatch
fileMatchPattern: 'test/**|src/**'
---

# Testing

Runner: `node:test`. Run with `npm test` (builds first).

## Strategy
Integration over mocks. Tests spin up a real server (`test/helpers/server.ts`)
and hit it over HTTP; reactions tests use real SQLite (incl. a restart-durability
test). Match that style.

- New route → a routing/content test.
- New write endpoint → rate-limit + input-validation tests.

Don't add tests unless asked. When you do, follow the shape above.
