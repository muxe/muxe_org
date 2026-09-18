# Server setup & operations — muxe.org

This documents how the muxe.org server is **actually** set up (as-built), and
how to operate it. If you're reading this a year later: start with
[The mental model](#the-mental-model) and [Operations runbook](#operations-runbook).
The step-by-step provisioning at the bottom is only needed to rebuild from
scratch.

---

## Concrete facts (as-built)

| Thing | Value |
|-------|-------|
| Server | Hetzner Cloud, `ubuntu-4gb-fsn1-1` (Falkenstein) |
| OS | Ubuntu 24.04 LTS |
| Public IP | `46.224.106.45` |
| Admin user | `max` (sudo, **password required** for sudo) |
| SSH alias | `ssh hetzner` (see `~/.ssh/config` locally → user `max`, key `~/.ssh/id_ed25519`) |
| Deploy user | `deploy`, **uid 1001** (matters: `XDG_RUNTIME_DIR=/run/user/1001`) |
| App runtime | Node.js 24 (system, via NodeSource) |
| Web server | Caddy (system service, official apt repo), auto-TLS via Let's Encrypt |
| DNS | Registrar + DNS at **INWX**; `A muxe.org` and `A www` → `46.224.106.45` |
| Cloud firewall | **None attached** (ports 80/443/22 open at the host) |
| App location | `/home/deploy/muxe` (releases/ + `current` symlink) |
| Database | SQLite at `/home/deploy/muxe/data/muxe.db` (built-in `node:sqlite`; outside releases so it survives deploys) |
| Migrations | [dbmate](https://github.com/amacneil/dbmate) at `/home/deploy/.local/bin/dbmate`, run by `deploy.sh` before each restart |
| Old n8n stack | `/home/max/n8n-docker` — **dormant, do not start** (would grab 80/443) |

---

## The mental model

```
Internet
  │  (DNS: muxe.org → 46.224.106.45, managed at INWX)
  ▼
Caddy  (system service, :80 + :443, auto Let's Encrypt TLS)
  │    config: /etc/caddy/Caddyfile
  │    reverse_proxy →
  ▼
Node app  (127.0.0.1:3000, NOT exposed publicly)
           run by a systemd **user** service `muxe.service` as user `deploy`
           serves from /home/deploy/muxe/current/dist/server.js
```

- **Caddy** terminates TLS and proxies to the app on localhost. It logs to the
  **systemd journal** (not a file — see the gotcha below).
- **The app** is a zero-dependency `node:http` server. It only listens on
  localhost; the only way in from outside is through Caddy.
- **Deploys** happen by GitHub Actions streaming a build tarball over SSH to a
  key that is **locked to run one script** (`deploy.sh`). That script unpacks a
  new release into `/home/deploy/muxe/releases/<timestamp>/`, atomically points
  the `current` symlink at it, and restarts the user service.

### Release layout on the server
```
/home/deploy/muxe/
├── deploy.sh                 # the ONLY command the CI key can run
├── current -> releases/2026… # atomic symlink to the live release
├── data/                     # SQLite DB — OUTSIDE releases, survives deploys
│   └── muxe.db               #   (+ muxe.db-wal / muxe.db-shm in WAL mode)
├── backups/                  # pre-migration DB snapshots (newest 10 kept)
│   └── muxe.db.20260918…     #   taken by deploy.sh before each `dbmate up`
└── releases/
    ├── 20260916061855/       # each deploy = one timestamped dir
    │   ├── dist/server.js
    │   ├── db/migrations/     # dbmate migrations, applied before restart
    │   └── package.json
    └── …                     # only the newest 5 are kept
```

The database deliberately lives in `data/`, **not** inside a release dir: the
`current` symlink swaps on every deploy and old releases are pruned, so a DB
under a release would be lost. `deploy.sh` runs `dbmate up` against
`data/muxe.db` (using the incoming release's migration files) *before* swapping
the symlink and restarting, so new code never sees an un-migrated schema.

**Rollback philosophy (roll forward, not back).** In production the real
rollback mechanism is the atomic **release** swap (repoint `current` at the
previous release — see the runbook), *not* `dbmate down`. Rolling a schema back
after new rows exist can lose data, so migrations should be
backward-compatible: the old and new code both work against the migrated schema
during a deploy. `dbmate down` exists and is tested (the migration ships a
`migrate:down`), but it's for local/dev use, not routine prod rollback. The
pre-migration snapshot in `backups/` is the safety net if a migration ever goes
wrong.

---

## Operations runbook

All of these run in an `ssh hetzner` session (as `max`). The service is a
**user** service owned by `deploy` (uid 1001), so commands go through
`sudo -u deploy XDG_RUNTIME_DIR=/run/user/1001 systemctl --user …`.

Tip: set a shell alias for the session to save typing:
```bash
alias dctl='sudo -u deploy XDG_RUNTIME_DIR=/run/user/1001 systemctl --user'
alias djournal='sudo -u deploy XDG_RUNTIME_DIR=/run/user/1001 journalctl --user'
```

**Is the app running?**
```bash
dctl status muxe.service
```

**App logs (access log + errors from the Node app):**
```bash
djournal -u muxe.service -n 50 --no-pager    # last 50 lines
djournal -u muxe.service -f                  # follow live
```

**Restart the app:**
```bash
dctl restart muxe.service
```

**Caddy status / logs (TLS, proxying, HTTP):**
```bash
sudo systemctl status caddy --no-pager
sudo journalctl -u caddy -n 50 --no-pager
```

**Reload Caddy after editing `/etc/caddy/Caddyfile`:**
```bash
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl reload caddy
```

**Manually deploy (same thing CI does), from your LOCAL machine:**
```bash
cd <repo>
npm run build
tar czf - dist package.json db \
  | ssh -i /path/to/muxe_deploy_key deploy@46.224.106.45 "ignored"
```
(The SSH command string is ignored — the key is pinned to `deploy.sh`. The
tarball arrives on the script's stdin.)

**Roll back to a previous release** (no CI needed):
```bash
ssh hetzner
sudo ls -1 /home/deploy/muxe/releases                    # list timestamps
sudo -u deploy ln -sfn /home/deploy/muxe/releases/<OLD_TS> /home/deploy/muxe/current.tmp
sudo -u deploy mv -Tf /home/deploy/muxe/current.tmp /home/deploy/muxe/current
sudo -u deploy XDG_RUNTIME_DIR=/run/user/1001 systemctl --user restart muxe.service
```

**Check the live site from outside:**
```bash
curl -sS https://muxe.org/ | head
curl -sI https://muxe.org/github        # expect 302 to GitHub
```

**TLS certs** renew automatically (Caddy). Cert state lives in
`/var/lib/caddy/.local/share/caddy`. Nothing to do manually.

**Rotate / revoke the CI deploy key** (if it leaks): see
[Deploy key](#4-install-the-ci-public-key-locked-to-one-command) — delete the
line from `/home/deploy/.ssh/authorized_keys`, generate a new key, update the
`SSH_PRIVATE_KEY` GitHub secret.

---

## Gotchas we hit (so you don't re-hit them)

- **Caddy file logging fails with permission denied.** The Debian/Ubuntu Caddy
  package sandboxes the service and won't write to `/var/log/caddy` by default.
  We **removed the `log { output file … }` block** from the Caddyfile; Caddy now
  logs to the **journal** (`journalctl -u caddy`). Don't re-add file logging
  without also fixing the systemd unit's `ReadWritePaths`.
- **`deploy` user commands need `XDG_RUNTIME_DIR=/run/user/1001`.** Because it's
  a *user* systemd service and `deploy` has no login session, `systemctl --user`
  needs the runtime dir pointed at uid 1001 explicitly. Lingering
  (`loginctl enable-linger deploy`) is what makes `/run/user/1001` exist at boot.
- **sudo needs a password for `max`.** Non-interactive `ssh hetzner 'sudo …'`
  will fail silently. Run sudo steps in an interactive session.
- **Don't start the old n8n stack.** `/home/max/n8n-docker` contains a Caddy
  container that binds 80/443 and would fight the system Caddy. It's kept for
  reference only; no containers currently exist so it won't auto-start.
- **The `authorized_keys` line must be ONE line.** Pasting it manually often
  breaks. Use `deploy/provision-deploy-user.sh` which writes it safely.

---

## Rebuild from scratch (full provisioning)

Only needed if the box is wiped. Run as `max` (sudo, interactive). Assumes DNS
already points `muxe.org` at the server.

### 1. Install Node 24 + Caddy

```bash
# Node.js 24 (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs

# Caddy (official repo)
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update && sudo apt-get install -y caddy

node --version && caddy version   # expect v24.x and v2.x
```

### 1b. Install dbmate (migration tool)

dbmate is a standalone binary — no npm, independent of the app's `node:sqlite`
runtime driver. `deploy.sh` expects it at `/home/deploy/.local/bin/dbmate`.

```bash
sudo -u deploy mkdir -p /home/deploy/.local/bin
sudo -u deploy curl -fsSL -o /home/deploy/.local/bin/dbmate \
  https://github.com/amacneil/dbmate/releases/download/v2.35.1/dbmate-linux-amd64
sudo -u deploy chmod +x /home/deploy/.local/bin/dbmate
sudo -u deploy /home/deploy/.local/bin/dbmate --version   # expect v2.35.1
```

The version is **pinned** (not `latest`) so dev, CI, and prod all run the same
migration tool. It's referenced as `DBMATE_VERSION` in `deploy/deploy.sh` and
the CI workflow — bump all three together.

### 2. Create the locked-down `deploy` user

```bash
sudo adduser --disabled-password --gecos "" deploy   # no password login, key-only
sudo loginctl enable-linger deploy                   # user service runs without login
sudo -u deploy mkdir -p /home/deploy/muxe /home/deploy/.ssh /home/deploy/.config/systemd/user
sudo -u deploy chmod 700 /home/deploy/.ssh
```

### 3. Generate the CI deploy key (on your LOCAL machine)

```bash
ssh-keygen -t ed25519 -C "github-actions-muxe-deploy" -f muxe_deploy_key -N ""
# muxe_deploy_key      → PRIVATE → GitHub secret SSH_PRIVATE_KEY
# muxe_deploy_key.pub  → PUBLIC  → into the server (next step)
```

### 4. Install the CI public key, locked to one command

Put the **public key** into the `AUTH_LINE` inside
`deploy/provision-deploy-user.sh`, copy `deploy.sh`, `muxe.service`, and that
script to the server, then run it. The script writes the `authorized_keys` line
(a single line, `command="…"`-pinned) safely, installs the files with correct
ownership/perms, and enables the service.

```bash
# from LOCAL repo:
scp deploy/deploy.sh deploy/muxe.service deploy/provision-deploy-user.sh hetzner:/tmp/
ssh hetzner 'bash /tmp/provision-deploy-user.sh'
```

The pinned line looks like (all on ONE line):
```
command="/home/deploy/muxe/deploy.sh",no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty ssh-ed25519 AAAA…pubkey… github-actions-muxe-deploy
```
The forced command means a stolen key can only trigger `deploy.sh` — no shell,
no forwarding. The tarball still arrives on the script's stdin.

### 5. Install the Caddyfile

```bash
scp deploy/Caddyfile hetzner:/tmp/Caddyfile          # from LOCAL repo
ssh hetzner
sudo cp /tmp/Caddyfile /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl reload caddy                          # fetches TLS cert automatically
```
(No `/var/log/caddy` needed — logging goes to the journal. See gotchas.)

### 6. First deploy

Trigger the GitHub Actions workflow (push to main, or "Run workflow"), or do a
manual deploy (see the runbook). Then verify:
```bash
curl -sS https://muxe.org/ | head
```

### 7. Add GitHub Actions secrets

**Settings → Secrets and variables → Actions:**

| Secret | Value |
|--------|-------|
| `SSH_PRIVATE_KEY` | contents of `muxe_deploy_key` (incl. BEGIN/END lines) |
| `SSH_HOST` | `46.224.106.45` |
| `SSH_USER` | `deploy` |
| `SSH_KNOWN_HOSTS` | output of `ssh-keyscan -t ed25519 46.224.106.45` |

### 8. Harden sshd  ✅ APPLIED

> **Status: applied.** Password auth and root SSH are disabled server-wide;
> key auth only. Verified a fresh key login still works and password auth is
> refused (`Permission denied (publickey)`).

Implemented as an Ubuntu drop-in (overrides the defaults in
`/etc/ssh/sshd_config.d/*.conf`) at
**`/etc/ssh/sshd_config.d/99-muxe-hardening.conf`**:
```
PasswordAuthentication no
PermitRootLogin no
PubkeyAuthentication yes
```
(No `AllowUsers` whitelist — decided against it.)

Effective settings (`sudo sshd -T | grep -iE 'passwordauth|permitroot|pubkey'`):
`passwordauthentication no`, `permitrootlogin no`, `pubkeyauthentication yes`.

**If you ever need to redo this** (e.g. rebuilt box), the paste-safe apply:
```bash
printf '%s\n' 'PasswordAuthentication no' 'PermitRootLogin no' 'PubkeyAuthentication yes' \
  | sudo tee /etc/ssh/sshd_config.d/99-muxe-hardening.conf >/dev/null
sudo sshd -t && echo "CONFIG OK"     # validate BEFORE reloading
sudo systemctl reload ssh            # reload keeps existing sessions alive
```
Then, **without closing your current session**, verify from a new terminal:
```bash
ssh hetzner 'echo OK'
```
If it fails, revert from the still-open session:
```bash
sudo rm /etc/ssh/sshd_config.d/99-muxe-hardening.conf && sudo systemctl reload ssh
```

Optional, not applied: `sudo apt install -y fail2ban` for brute-force
protection (defense in depth).

---

## Blast radius if the CI key leaks

The key can only: SSH in as `deploy` (no root, no shell, no forwarding), run
`deploy.sh` (redeploys the public app), and restart the `muxe` user service.
It cannot get a shell, read other users' files, or pivot. Revoke by deleting
the line from `/home/deploy/.ssh/authorized_keys` and rotating the key.
