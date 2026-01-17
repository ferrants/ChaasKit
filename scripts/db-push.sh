#!/bin/bash

# Load DATABASE_URL from .env file and run db:push
# Usage: ./scripts/db-push.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$ROOT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env file not found at $ENV_FILE"
  exit 1
fi

# Extract DATABASE_URL from .env (handles quotes and spaces)
DATABASE_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | sed 's/^DATABASE_URL=//' | sed 's/^["'"'"']//' | sed 's/["'"'"']$//')

if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL not found in .env file"
  exit 1
fi

echo "Running db:push with DATABASE_URL from .env..."
export DATABASE_URL
cd "$ROOT_DIR"

# Pass through any arguments (e.g., --accept-data-loss)
if [ "$1" = "--accept-data-loss" ] || [ "$1" = "-f" ]; then
  cd packages/db && npx prisma db push --accept-data-loss
else
  pnpm db:push
fi
