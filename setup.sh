#!/usr/bin/env bash
# Project Dashboard setup. Run from inside the project-dashboard directory.
#
#   ./setup.sh [--target-dir PATH] [--port N] [--host ADDR] [--password PW]
#
# Defaults: target-dir = sibling guess, port 8080, host 0.0.0.0.
# Writes config.json, installs deps, initializes the DB, prints the LAN URL,
# and starts the server.
set -euo pipefail

cd "$(dirname "$0")"

# --- defaults ---
TARGET_DIR=""
PORT="8080"
HOST="0.0.0.0"
PASSWORD=""

# --- parse args ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    --target-dir) TARGET_DIR="$2"; shift 2 ;;
    --port)       PORT="$2"; shift 2 ;;
    --host)       HOST="$2"; shift 2 ;;
    --password)   PASSWORD="$2"; shift 2 ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

# --- requirements ---
command -v node >/dev/null 2>&1 || { echo "ERROR: node not found. Install Node.js >= 18." >&2; exit 1; }
command -v npm  >/dev/null 2>&1 || { echo "ERROR: npm not found." >&2; exit 1; }
command -v tmux >/dev/null 2>&1 || echo "WARNING: tmux not found — starting Claude sessions will fail until installed." >&2
command -v claude >/dev/null 2>&1 || echo "WARNING: 'claude' CLI not found — session spawning needs Claude Code installed & logged in." >&2

# --- resolve target dir ---
if [[ -z "$TARGET_DIR" ]]; then
  # Default: a sibling directory (the most likely target-project layout).
  PARENT="$(cd .. && pwd)"
  TARGET_DIR="$PARENT"
  echo "No --target-dir given; defaulting to parent: $TARGET_DIR"
fi
TARGET_DIR="$(cd "$TARGET_DIR" 2>/dev/null && pwd || echo "$TARGET_DIR")"

# --- secret + password ---
SECRET="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
if [[ -z "$PASSWORD" ]]; then
  echo "WARNING: no --password set. Auth will be DISABLED (anyone on the LAN can spawn Claude sessions)."
fi

# --- write config.json ---
node - "$TARGET_DIR" "$HOST" "$PORT" "$PASSWORD" "$SECRET" <<'NODE'
const fs = require('fs');
const [, , target_dir, host, port, password, secret] = process.argv;
const cfg = { target_dir, host, port: Number(port), password, secret };
fs.writeFileSync('config.json', JSON.stringify(cfg, null, 2) + '\n');
console.log('Wrote config.json');
NODE

# --- install + init ---
echo "Installing dependencies…"
npm install --no-audit --no-fund

echo "Initializing database…"
npm run init-db

# --- LAN IP detection ---
LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
[[ -z "$LAN_IP" ]] && LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
[[ -z "$LAN_IP" ]] && LAN_IP="127.0.0.1"

echo ""
echo "========================================================"
echo "  Project Dashboard ready."
echo "  Local:   http://127.0.0.1:${PORT}"
echo "  LAN:     http://${LAN_IP}:${PORT}"
echo "  Target:  ${TARGET_DIR}"
echo "========================================================"
echo ""

exec npm start
