# muxe.org

My personal website — as a REST API. Because I'm a backend developer and a
business card should return JSON.

Visit [muxe.org](https://muxe.org) with `curl` and you get JSON. Visit it in a
browser and you get a lightly styled viewer of that same JSON. Some routes
(`/github`, `/linkedin`) just redirect to my profiles.

Built on zero-dependency `node:http` + TypeScript. No web framework — the whole
thing is the Node standard library.

## API

| Method | Route        | Description                                  |
|--------|--------------|----------------------------------------------|
| GET    | `/`          | Profile + `_links` to every other route      |
| GET    | `/github`    | `302` redirect to GitHub                      |
| GET    | `/linkedin`  | `302` redirect to LinkedIn                    |
| GET    | `/projects`  | List of projects (JSON)                       |
| GET    | `/contact`   | Contact details (JSON)                        |
| GET    | `/health`    | `{ "status": "ok", "uptime": ... }`           |

Unknown paths return a `404` JSON body listing the available routes. Non-GET
methods return `405` (the API is read-only). Browsers (`Accept: text/html`) get
an HTML viewer; everything else gets pretty-printed JSON.

```bash
curl https://muxe.org
curl https://muxe.org/projects
curl -sI https://muxe.org/github   # see the 302 Location header
```

## Editing content

All content lives in [`src/data.ts`](src/data.ts): `profile`, `socials`
(each key becomes a `/redirect` route), and `projects`. Edit those, commit, and
the deploy pipeline ships it. The GitHub/LinkedIn URLs there are placeholders —
update them.

## Local development

Requires Node.js >= 24.

```bash
npm install          # installs dev deps only (typescript, @types/node)
npm run dev          # runs src/server.ts with --watch, no build step
```

Then hit it:

```bash
curl -s localhost:3000 | jq
curl -sI localhost:3000/github
```

`PORT` and `HOST` are configurable via env (defaults `3000` / `127.0.0.1`).

### Scripts

| Script              | What it does                                        |
|---------------------|-----------------------------------------------------|
| `npm run dev`       | Run from TS source with `--watch` (strips types)    |
| `npm run typecheck` | `tsc --noEmit` — type check only                    |
| `npm run build`     | Compile `src/` → `dist/` with `tsc`                 |
| `npm start`         | Run the compiled `dist/server.js`                   |

## Architecture

```
Internet ──▶ Caddy (:443, auto-TLS, muxe.org) ──▶ reverse_proxy ──▶ Node app (127.0.0.1:3000)
```

- **Caddy** terminates TLS (automatic Let's Encrypt certs) and reverse-proxies
  to the app. The app binds to localhost only and is never directly exposed.
- **systemd user service** (`muxe.service`) runs the app, restarts on failure,
  and starts on boot (via lingering).
- Source layout:
  - `src/server.ts` — `node:http` server, request context, logging, shutdown
  - `src/router.ts` — tiny exact-match router + path normalization
  - `src/routes.ts` — route definitions + content negotiation
  - `src/http.ts` — `json()` / `redirect()` / `html()` helpers
  - `src/data.ts` — all editable content

## Deployment

Pushing to `main`/`master` triggers
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which:

1. Installs deps, type-checks, and builds `dist/`.
2. Packs `dist/` + `package.json` into a tarball and streams it over SSH to the
   server.

On the server, the CI SSH key is **pinned to a single forced command**
(`deploy.sh`) — it cannot open a shell or do anything else. `deploy.sh`
unpacks the release, atomically swaps the `current` symlink, and restarts the
service.

### Server setup & operations

The site runs on a Hetzner box (`46.224.106.45`) behind Caddy, as a systemd
user service under the `deploy` user. See
[`deploy/SERVER_SETUP.md`](deploy/SERVER_SETUP.md) — it's both the one-time
provisioning walkthrough **and** the operations runbook (how to check status,
read logs, restart, deploy manually, and roll back). Start there if you're
returning to this after a while: it opens with the concrete facts and the
mental model.

Required repo secrets: `SSH_PRIVATE_KEY`, `SSH_HOST`, `SSH_USER`,
`SSH_KNOWN_HOSTS`.

### Deploy security summary

If the CI deploy key leaks, it can only trigger a redeploy of this public app
and restart its service — no shell, no port forwarding, no root, no lateral
movement. Rotating it is deleting one line from `authorized_keys` and
generating a new key.
