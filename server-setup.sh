#!/usr/bin/env bash
#
# One-time (idempotent) production setup for the game server. Run ON the
# server, as root, after deploy.sh has copied server.js into place:
#
#   scp server-setup.sh deploy@<host>:/tmp/ && ssh -t deploy@<host> 'sudo bash /tmp/server-setup.sh'
#
# It does two things deploy.sh can't (they need root):
#   1. a systemd service running `node server.js 8000` in the docroot as the
#      deploy user (so data/rooms/ is writable and survives deploys)
#   2. an nginx `location /api/` proxy in the mandelbrot site, with the
#      settings the presence stream (SSE) needs
# The nginx edit is backed up and validated with `nginx -t`; on failure the
# backup is restored and nginx is left untouched.
set -euo pipefail

APP_USER="${APP_USER:-deploy}"
APP_DIR="${APP_DIR:-/var/www/mandelbrot}"
PORT="${PORT:-8000}"
SITE="${SITE:-/etc/nginx/sites-enabled/mandelbrot}"
UNIT=/etc/systemd/system/mandelbrot.service

[[ $EUID -eq 0 ]] || { echo "run as root (sudo bash $0)" >&2; exit 1; }
[[ -f "$APP_DIR/server.js" ]] || { echo "missing $APP_DIR/server.js — run ./deploy.sh first" >&2; exit 1; }

# Absolute node path as the app user sees it (may be nvm-managed); systemd
# doesn't load login shells, so it needs the full path.
NODE="$(sudo -u "$APP_USER" bash -lc 'command -v node' || true)"
[[ -x "$NODE" ]] || { echo "node not found for $APP_USER" >&2; exit 1; }
echo "node: $NODE ($("$NODE" -v))"

# Port must be free (or already ours).
if ss -ltn "sport = :$PORT" | grep -q LISTEN && ! systemctl is-active --quiet mandelbrot; then
  echo "port $PORT is already in use by something else:" >&2
  ss -ltnp "sport = :$PORT" >&2
  exit 1
fi

# ── 1. systemd service ───────────────────────────────────────────────────────
install -d -o "$APP_USER" -g "$APP_USER" "$APP_DIR/data"
cat > "$UNIT" <<EOF
[Unit]
Description=Mandelbrot Expedition game server
After=network.target

[Service]
User=$APP_USER
WorkingDirectory=$APP_DIR
ExecStart=$NODE server.js $PORT
Restart=always
RestartSec=2
# Uncomment to require a key to create rooms (the lobby has a field for it):
#Environment=ROOM_CREATE_KEY=change-me

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now mandelbrot
systemctl restart mandelbrot   # pick up a freshly deployed server.js
sleep 1
systemctl is-active --quiet mandelbrot || { journalctl -u mandelbrot -n 30 --no-pager; exit 1; }
echo "service: running on 127.0.0.1:$PORT"

# ── 2. nginx /api/ proxy ─────────────────────────────────────────────────────
TARGET="$(readlink -f "$SITE")"
if grep -q "location /api/" "$TARGET"; then
  echo "nginx: /api/ proxy already present in $TARGET"
else
  # Backups live outside sites-enabled/: nginx includes every file there, so
  # a copy beside the site loads as a duplicate server block.
  install -d /etc/nginx/backup
  BACKUP="/etc/nginx/backup/$(basename "$TARGET").$(date +%Y%m%d%H%M%S)"
  cp -a "$TARGET" "$BACKUP"
  # Insert before the first `location / {` — the server block that serves the
  # docroot (the later blocks are certbot's redirects).
  python3 - "$TARGET" "$PORT" <<'PY'
import re, sys
path, port = sys.argv[1], sys.argv[2]
s = open(path).read()
m = re.search(r'^([ \t]*)location / \{', s, re.M)
if not m:
    sys.exit("no 'location / {' found")
ind = m.group(1)
block = (
    f"{ind}# Game server (server.js via systemd unit mandelbrot.service).\n"
    f"{ind}location /api/ {{\n"
    f"{ind}  proxy_pass http://127.0.0.1:{port};\n"
    f"{ind}  proxy_http_version 1.1;\n"
    f"{ind}  proxy_set_header Connection \"\";\n"
    f"{ind}  proxy_set_header Host $host;\n"
    f"{ind}  proxy_buffering off;      # live presence stream (SSE)\n"
    f"{ind}  proxy_read_timeout 1h;\n"
    f"{ind}}}\n\n"
)
open(path, "w").write(s[:m.start()] + block + s[m.start():])
PY
  if nginx -t; then
    systemctl reload nginx
    echo "nginx: added /api/ proxy (backup: $BACKUP)"
  else
    cp -a "$BACKUP" "$TARGET"
    echo "nginx: config test FAILED — restored the backup, nothing changed" >&2
    exit 1
  fi
fi

# ── Smoke test through nginx's upstream ──────────────────────────────────────
code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/api/rooms/ZZZZZ/state")"
[[ "$code" == 404 ]] && echo "smoke test: game server answering (expected 404 for a fake room)" \
  || echo "smoke test: unexpected HTTP $code from the game server" >&2
echo "Done."
