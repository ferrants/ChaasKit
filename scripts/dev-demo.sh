#!/usr/bin/env bash
set -euo pipefail

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm not found. Install pnpm first." >&2
  exit 1
fi

# Start server in dev mode (tsx watch)
pnpm --filter @chaaskit/server dev &
SERVER_PID=$!

# Watch-build the client library (so demo app picks up changes)
pnpm --filter @chaaskit/client build:lib -- --watch &
CLIENT_PID=$!

# Start demo app
pnpm --filter chaaskit-demo dev &
DEMO_PID=$!

cleanup() {
  echo "\nShutting down dev processes..."
  kill $SERVER_PID $CLIENT_PID $DEMO_PID 2>/dev/null || true
  wait $SERVER_PID $CLIENT_PID $DEMO_PID 2>/dev/null || true
}

trap cleanup INT TERM
wait
