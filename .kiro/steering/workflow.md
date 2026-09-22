---
inclusion: always
---

# Commit & deploy

## Before committing (matches CI, run in order)
1. `npm run lint` (or `npm run lint:fix`)
2. `npm run typecheck`
3. `npm test`

All three are CI gates. If any fails, CI fails — fix locally first.

## App ↔ DB sync
Reaction keys are a closed set. Adding one means BOTH:
- add the key to `REACTION_KEYS` in `src/data.ts`, and
- `npm run db:new`, then a migration with a matching seed row + `CHECK` clause.

They drift silently otherwise.

## Deploy
Push to `master`/`main` → GitHub Actions lints, typechecks, builds, tests, then
ships over SSH. `deploy.sh` applies migrations and restarts. Don't push if CI
would fail. Ops/rollback: `deploy/SERVER_SETUP.md`.
