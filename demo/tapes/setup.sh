#!/usr/bin/env bash
# Boots a local Chroma server, seeds two demo collections, and writes a
# sandboxed lazyvec config. Idempotent — safe to source before every VHS tape.
#
# Usage (from repo root):   source demo/tapes/setup.sh
#
# Effects:
#   - Starts `chroma run` on localhost:8000 (if not already listening).
#   - Seeds `movies` and `articles` collections via scratch/seed-chroma.ts.
#   - Writes ~/.lazyvec/config.toml in a sandboxed HOME ($LAZYVEC_DEMO_HOME).
#   - Exports HOME=$LAZYVEC_DEMO_HOME so the VHS session uses the demo config
#     without touching your real ~/.lazyvec/.
#   - Sets a short PS1 and clears the screen.

set -euo pipefail

: "${LAZYVEC_DEMO_HOME:=/tmp/lazyvec-demo-home}"
: "${LAZYVEC_DEMO_CHROMA_DATA:=/tmp/lazyvec-demo-chroma}"
: "${LAZYVEC_DEMO_CHROMA_PORT:=8000}"

# 1. Start Chroma in the background if it isn't already listening.
if ! curl -sSf "http://localhost:${LAZYVEC_DEMO_CHROMA_PORT}/api/v2/version" >/dev/null 2>&1; then
  mkdir -p "$LAZYVEC_DEMO_CHROMA_DATA"
  (bunx chroma run --path "$LAZYVEC_DEMO_CHROMA_DATA" --host localhost --port "$LAZYVEC_DEMO_CHROMA_PORT" \
    >/tmp/lazyvec-demo-chroma.log 2>&1 &) >/dev/null 2>&1

  # Wait up to 20s for the server to accept requests.
  for _ in $(seq 1 40); do
    curl -sSf "http://localhost:${LAZYVEC_DEMO_CHROMA_PORT}/api/v2/version" >/dev/null 2>&1 && break
    sleep 0.5
  done
fi

# 2. Seed demo collections (noop if already populated — seeder uses upsert).
bun run scratch/seed-chroma.ts >/dev/null 2>&1 || true

# 3. Sandbox HOME and write a minimal config file there.
mkdir -p "$LAZYVEC_DEMO_HOME/.lazyvec"
cat >"$LAZYVEC_DEMO_HOME/.lazyvec/config.toml" <<EOF
default = "local-chroma"

[connections.local-chroma]
provider = "chroma"
url = "http://localhost:${LAZYVEC_DEMO_CHROMA_PORT}"
EOF

export HOME="$LAZYVEC_DEMO_HOME"

# 4. Clean prompt and screen for recording.
export PS1="~/lazyvec $ "
clear
