#!/usr/bin/env bash
#
# One-shot server-side provisioning for the `deploy` user.
# Run this ON THE SERVER as `max` (it uses sudo internally):
#
#   scp deploy/provision-deploy-user.sh hetzner:/tmp/
#   ssh hetzner 'bash /tmp/provision-deploy-user.sh'
#
# Prereqs already done:
#   - `deploy` user exists (uid 1001), lingering enabled
#   - /tmp/deploy.sh and /tmp/muxe.service copied to the server
#
# This is idempotent-ish: re-running appends the key only if missing.

set -euo pipefail

DEPLOY_UID="$(id -u deploy)"
RUNTIME_DIR="/run/user/${DEPLOY_UID}"

# The CI public key, pinned so it can ONLY run deploy.sh — no shell, no
# port/agent/X11 forwarding, no pty. Kept on a single line on purpose.
AUTH_LINE='command="/home/deploy/muxe/deploy.sh",no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEh5sL2wgUbcyDr6J6bHVcuk60DOXjLWKhrmMDlkGwQ/ github-actions-muxe-deploy'

echo "==> Placing deploy.sh and the systemd unit"
sudo install -o deploy -g deploy -m 700 /tmp/deploy.sh /home/deploy/muxe/deploy.sh
sudo install -o deploy -g deploy -m 644 /tmp/muxe.service /home/deploy/.config/systemd/user/muxe.service

echo "==> Installing the CI public key (only if not already present)"
if sudo grep -qF "github-actions-muxe-deploy" /home/deploy/.ssh/authorized_keys 2>/dev/null; then
  echo "    key already present, skipping"
else
  # Write via a temp file owned by deploy, then append — avoids heredoc/paste issues.
  printf '%s\n' "$AUTH_LINE" | sudo tee -a /home/deploy/.ssh/authorized_keys >/dev/null
  sudo chown deploy:deploy /home/deploy/.ssh/authorized_keys
  sudo chmod 600 /home/deploy/.ssh/authorized_keys
  echo "    key installed"
fi

echo "==> Registering the systemd user service (enable; may not start until first deploy)"
sudo -u deploy XDG_RUNTIME_DIR="${RUNTIME_DIR}" systemctl --user daemon-reload
sudo -u deploy XDG_RUNTIME_DIR="${RUNTIME_DIR}" systemctl --user enable muxe.service || true

echo
echo "==> Verification"
echo "--- /home/deploy/muxe ---"
sudo ls -la /home/deploy/muxe
echo "--- /home/deploy/.ssh ---"
sudo ls -la /home/deploy/.ssh
echo "--- /home/deploy/.config/systemd/user ---"
sudo ls -la /home/deploy/.config/systemd/user
echo "--- authorized_keys ---"
sudo cat /home/deploy/.ssh/authorized_keys
echo
echo "Done."
