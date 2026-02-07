#!/usr/bin/env bash
set -euo pipefail

API_URL=${API_URL:-http://localhost:3000}
APP_URL=${APP_URL:-http://localhost:5173}

printf "Testing CORS allowlist...\n"
status_ok=$(curl -s -o /dev/null -w "%{http_code}" -H "Origin: $APP_URL" "$API_URL/api/health")
status_bad=$(curl -s -o /dev/null -w "%{http_code}" -H "Origin: https://example.com" "$API_URL/api/health")

printf "  Allowed origin status: %s\n" "$status_ok"
printf "  Disallowed origin status: %s (expected 500 from CORS error in dev)\n" "$status_bad"

printf "\nJWT secret check (production)...\n"
NODE_ENV=production JWT_SECRET="" pnpm --filter @chaaskit/server dev >/dev/null 2>&1 && echo "  Unexpected: server started" || echo "  OK: server refused to start without JWT_SECRET"
