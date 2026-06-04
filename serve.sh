#!/usr/bin/env bash
# Serve the current directory over HTTP on port 8000.
set -euo pipefail

PORT="${1:-8000}"
cd "$(dirname "$0")"

echo "Serving $(pwd) at http://localhost:${PORT}/ (Ctrl-C to stop)"
exec python3 -m http.server "$PORT"
