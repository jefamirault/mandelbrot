#!/usr/bin/env bash
# Serve the site + shared painted-tile API on the given port (default 8000).
# The old python http.server would serve the files but 501 the /api/ calls,
# leaving the app in local-only painting mode — use the node server instead.
set -euo pipefail

PORT="${1:-8000}"
cd "$(dirname "$0")"

exec node server.js "$PORT"
