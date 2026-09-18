#!/usr/bin/env bash
#
# muxe.org deploy script — runs on the server as the `deploy` user.
#
# This is the ONLY command the CI SSH key is allowed to run (pinned via
# command="..." in ~/.ssh/authorized_keys). It reads a gzipped tarball of the
# built app from stdin, atomically swaps it into place, installs production
# dependencies (there are none at runtime, but this keeps it future-proof),
# and restarts the systemd user service.
#
# The CI side does roughly:
#   tar czf - -C dist . package.json | ssh deploy@server
# and this script receives that tarball on stdin.

set -euo pipefail

APP_DIR="${HOME}/muxe"
RELEASES_DIR="${APP_DIR}/releases"
CURRENT_LINK="${APP_DIR}/current"
DATA_DIR="${APP_DIR}/data"
DB_FILE="${DATA_DIR}/muxe.db"
BACKUPS_DIR="${APP_DIR}/backups"
SERVICE="muxe.service"
KEEP_RELEASES=5
KEEP_BACKUPS=10
# Pin dbmate: dev, CI, and prod all use the same version for reproducibility.
DBMATE_VERSION="v2.35.1"

timestamp="$(date +%Y%m%d%H%M%S)"
release_dir="${RELEASES_DIR}/${timestamp}"

log() { echo "[deploy ${timestamp}] $*"; }

mkdir -p "${RELEASES_DIR}"

log "Extracting incoming build into ${release_dir}"
mkdir -p "${release_dir}"
# Read the tarball from stdin. --no-same-owner so files are owned by `deploy`.
tar xzf - -C "${release_dir}" --no-same-owner

# Sanity check: the artifact must contain the built entrypoint.
if [[ ! -f "${release_dir}/dist/server.js" ]]; then
  log "ERROR: dist/server.js missing from artifact — aborting, leaving current release untouched."
  rm -rf "${release_dir}"
  exit 1
fi

# Sanity check: migrations must ship with the release so we can migrate.
if [[ ! -d "${release_dir}/db/migrations" ]]; then
  log "ERROR: db/migrations missing from artifact — aborting, leaving current release untouched."
  rm -rf "${release_dir}"
  exit 1
fi

# Run database migrations BEFORE swapping the symlink and restarting, so the
# new code never runs against an un-migrated schema. dbmate is a standalone
# binary (installed at ~/.local/bin/dbmate — see SERVER_SETUP.md). The SQLite
# file lives in DATA_DIR, outside the release dirs, so it survives deploys.
#
# Migrations are additive/backward-compatible by convention, so the currently
# running (old) release keeps working against the migrated DB until we swap.
mkdir -p "${DATA_DIR}"
DBMATE="${HOME}/.local/bin/dbmate"
if [[ ! -x "${DBMATE}" ]]; then
  log "ERROR: dbmate not found at ${DBMATE}. Install it (see SERVER_SETUP.md) — aborting."
  rm -rf "${release_dir}"
  exit 1
fi

# Warn (don't abort) if the installed dbmate isn't the pinned version — dev,
# CI and prod are meant to match. A mismatch is worth surfacing in the logs.
installed_dbmate="$(cd "${HOME}" && "${DBMATE}" --version 2>/dev/null || echo unknown)"
if [[ "${installed_dbmate}" != *"${DBMATE_VERSION#v}"* ]]; then
  log "WARNING: dbmate is '${installed_dbmate}', expected ${DBMATE_VERSION}."
fi

# Back up the SQLite DB before migrating — a near-free, production-grade safety
# net. If a migration corrupts or unexpectedly drops data, the pre-migration
# copy is right here. Only back up when the DB already exists (skip first ever
# deploy). WAL checkpoint first so the .db file is self-contained.
if [[ -f "${DB_FILE}" ]]; then
  mkdir -p "${BACKUPS_DIR}"
  backup_file="${BACKUPS_DIR}/muxe.db.${timestamp}"
  log "Backing up ${DB_FILE} -> ${backup_file}"
  # .backup uses SQLite's online backup API (safe on a live DB, WAL-aware).
  if ! sqlite3 "${DB_FILE}" ".backup '${backup_file}'" 2>/dev/null; then
    # Fall back to a plain copy if sqlite3 CLI isn't installed.
    cp "${DB_FILE}" "${backup_file}"
  fi
  # Rotate: keep only the newest KEEP_BACKUPS.
  (cd "${BACKUPS_DIR}" && ls -1t muxe.db.* 2>/dev/null | tail -n "+$((KEEP_BACKUPS + 1))" | xargs -r rm -f)
fi

log "Running migrations against ${DB_FILE}"
# Run from a directory the deploy user owns. dbmate auto-loads a .env from the
# cwd if present; it tolerates a MISSING one, but an UNREADABLE one (e.g. if
# invoked from someone else's home) is a hard error. DATABASE_URL is passed
# explicitly, so no .env is needed — DATA_DIR has none.
if ! (cd "${DATA_DIR}" && DATABASE_URL="sqlite:${DB_FILE}" "${DBMATE}" \
      --migrations-dir "${release_dir}/db/migrations" \
      --no-dump-schema \
      up); then
  log "ERROR: migrations failed — aborting, leaving current release live."
  rm -rf "${release_dir}"
  exit 1
fi

# Atomic symlink swap: build the new symlink then rename over the old one.
log "Pointing 'current' -> ${release_dir}"
ln -sfn "${release_dir}" "${CURRENT_LINK}.tmp"
mv -Tf "${CURRENT_LINK}.tmp" "${CURRENT_LINK}"

log "Restarting ${SERVICE}"
# User service — no sudo required. Requires lingering enabled for the user
# (loginctl enable-linger deploy) so the service runs without an active login.
systemctl --user restart "${SERVICE}"

# Give it a moment and verify it came up.
sleep 1
if ! systemctl --user is-active --quiet "${SERVICE}"; then
  log "ERROR: ${SERVICE} failed to start. Recent logs:"
  journalctl --user -u "${SERVICE}" -n 30 --no-pager || true
  exit 1
fi

log "Pruning old releases (keeping ${KEEP_RELEASES})"
# List releases oldest-first, drop the newest KEEP_RELEASES, remove the rest.
(cd "${RELEASES_DIR}" && ls -1dt */ 2>/dev/null | tail -n "+$((KEEP_RELEASES + 1))" | xargs -r rm -rf)

log "Deploy complete: ${release_dir}"
