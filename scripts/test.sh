#!/usr/bin/env bash
set -euo pipefail

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm not found. Install pnpm first." >&2
  exit 1
fi

if [ -z "${TEST_DATABASE_URL:-}" ] && [ -z "${DATABASE_URL:-}" ]; then
  echo "TEST_DATABASE_URL (preferred) or DATABASE_URL is required to run tests." >&2
  echo "Example:" >&2
  echo "  TEST_DATABASE_URL=\"postgresql://postgres:postgres@localhost:5433/chat_saas_test?schema=public\" ./scripts/test.sh" >&2
  exit 1
fi

if [ -n "${DATABASE_URL:-}" ] && [ -z "${TEST_DATABASE_URL:-}" ]; then
  echo "Warning: Using DATABASE_URL for tests. Prefer TEST_DATABASE_URL to avoid contaminating dev data." >&2
fi

pnpm test
