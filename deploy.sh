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
FILES=(index.html app.js style.css)

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
