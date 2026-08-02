#!/usr/bin/env bash
#
# Deploy the Mandelbrot explorer to mandelbrot.jefamirault.com.
#
# Static site, no build step — just sync the three site files (plus CLAUDE.md
# is intentionally excluded) to the nginx docroot over ssh.
#
# Usage:
#   ./deploy.sh            # sync to the live server
#   ./deploy.sh --dry-run  # show what would change, transfer nothing
#
set -euo pipefail

cd "$(dirname "$0")"

# Deploy target lives in .env (gitignored). Copy .env.example to get started.
[[ -f .env ]] || { echo "missing .env — copy .env.example and fill it in" >&2; exit 1; }
set -a; source .env; set +a

HOST="${DEPLOY_HOST:?DEPLOY_HOST not set in .env}"
USER="${DEPLOY_USER:?DEPLOY_USER not set in .env}"
DEST="${DEPLOY_DEST:?DEPLOY_DEST not set in .env}"
DOMAIN="${DEPLOY_DOMAIN:?DEPLOY_DOMAIN not set in .env}"

# Only the files the site actually serves. Anything not listed here never
# reaches the server, so CLAUDE.md / .git / deploy.sh stay local.
# server.js is the shared painted-tile API: run it on the box (e.g. a systemd
# unit running `node server.js 8000` in $DEST) and add to the nginx site:
#   location /api/ { proxy_pass http://127.0.0.1:8000; }
# Without it the site still works, but painting stays per-browser (local only).
FILES=(index.html app.js style.css server.js)

# ── Deploy stamp ─────────────────────────────────────────────────────────────
# Ship a deploy.json alongside the site so "what's live?" is answerable from
# outside — the status dashboard reads it over plain https, and so can you.
# Timestamp + short SHA + branch leak nothing actionable; keep it public.
# Degrades to no stamp outside a git checkout rather than failing the deploy.
if git rev-parse HEAD >/dev/null 2>&1; then
  DIRTY=false; git diff --quiet HEAD -- 2>/dev/null || DIRTY=true
  printf '{"deployed_at":"%s","commit":"%s","branch":"%s","dirty":%s}\n' \
    "$(date -u +%FT%TZ)" "$(git rev-parse --short HEAD)" \
    "$(git rev-parse --abbrev-ref HEAD)" "$DIRTY" > deploy.json
  FILES+=(deploy.json)
fi

# Verify the payload exists before we touch the network.
for f in "${FILES[@]}"; do
  [[ -f "$f" ]] || { echo "missing file: $f" >&2; exit 1; }
done

RSYNC_OPTS=(-avz --checksum --delete-after)
if [[ "${1:-}" == "--dry-run" || "${1:-}" == "-n" ]]; then
  RSYNC_OPTS+=(--dry-run)
  echo "── dry run: no files will be transferred ──"
fi

echo "Deploying to ${USER}@${HOST}:${DEST}/ (${DOMAIN})"
rsync "${RSYNC_OPTS[@]}" "${FILES[@]}" "${USER}@${HOST}:${DEST}/"

echo "Done. → https://${DOMAIN}/"
