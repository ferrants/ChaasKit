#!/bin/bash
# Quick setup script for testing chaaskit packages locally
# Usage: ./scripts/create-test-project.sh <project-name> [parent-dir]
#
# Example:
#   ./scripts/create-test-project.sh my-test-app
#   ./scripts/create-test-project.sh my-test-app /home/matt/code

set -e

PROJECT_NAME="${1:-my-chat-app}"
PARENT_DIR="${2:-$(dirname "$(pwd)")}"
MONOREPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "Creating test project: $PROJECT_NAME"
echo "Parent directory: $PARENT_DIR"
echo "Monorepo: $MONOREPO_DIR"
echo ""

# Ensure packages are built and packed
echo "Building and packing packages..."
cd "$MONOREPO_DIR"
pnpm run pack:local

# Create project using CLI
echo ""
echo "Creating project with CLI..."
cd "$PARENT_DIR"
rm -rf "$PROJECT_NAME"
node "$MONOREPO_DIR/packages/create-chaaskit/dist/index.js" create "$PROJECT_NAME" --skip-install

# Update package.json with file: paths using jq
# This preserves the CLI-generated package.json and only patches the @chaaskit/* dependencies
echo ""
echo "Updating package.json with local package paths..."
cd "$PROJECT_NAME"

# Read version from shared package (all packages use the same version)
VERSION=$(node -p "require('$MONOREPO_DIR/packages/shared/package.json').version")
echo "Using package version: $VERSION"

# Use jq to patch the dependencies to use local tgz files
jq --arg dir "$MONOREPO_DIR" --arg ver "$VERSION" '
  .dependencies["@chaaskit/server"] = "file:\($dir)/dist/chaaskit-server-\($ver).tgz" |
  .dependencies["@chaaskit/client"] = "file:\($dir)/dist/chaaskit-client-\($ver).tgz" |
  .dependencies["@chaaskit/db"] = "file:\($dir)/dist/chaaskit-db-\($ver).tgz" |
  .dependencies["@chaaskit/shared"] = "file:\($dir)/dist/chaaskit-shared-\($ver).tgz" |
  .pnpm.overrides["@chaaskit/server"] = "file:\($dir)/dist/chaaskit-server-\($ver).tgz" |
  .pnpm.overrides["@chaaskit/client"] = "file:\($dir)/dist/chaaskit-client-\($ver).tgz" |
  .pnpm.overrides["@chaaskit/db"] = "file:\($dir)/dist/chaaskit-db-\($ver).tgz" |
  .pnpm.overrides["@chaaskit/shared"] = "file:\($dir)/dist/chaaskit-shared-\($ver).tgz"
' package.json > package.json.tmp && mv package.json.tmp package.json

# Convert project name to database name (replace dashes with underscores, lowercase)
DB_NAME=$(echo "$PROJECT_NAME" | tr '-' '_' | tr '[:upper:]' '[:lower:]')

# Copy .env from monorepo if it exists, otherwise use .env.example
if [ -f "$MONOREPO_DIR/.env" ]; then
  echo "Copying .env from monorepo..."
  cp "$MONOREPO_DIR/.env" .env
else
  echo "Copying .env.example to .env..."
  cp .env.example .env
fi

# Update DATABASE_URL with project-specific database name
echo "Updating DATABASE_URL to use database: $DB_NAME"
sed -i "s|/chaaskit|/${DB_NAME}|g" .env

# Install dependencies
echo ""
echo "Installing dependencies..."
pnpm install

# Generate Prisma client
echo ""
echo "Generating Prisma client..."
pnpm db:generate

# Push database schema
echo ""
echo "Pushing database schema..."
pnpm db:push

echo ""
echo "=========================================="
echo "Project created successfully!"
echo ""
echo "To start development:"
echo "  cd $PARENT_DIR/$PROJECT_NAME"
echo "  pnpm dev"
echo ""
echo "The app will be available at:"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:3000"
echo ""
echo "To pull in changes from the monorepo:"
echo "  # In the monorepo directory:"
echo "  cd $MONOREPO_DIR"
echo "  pnpm run pack:local"
echo ""
echo "  # Then in this project:"
echo "  cd $PARENT_DIR/$PROJECT_NAME"
echo "  pnpm install --force"
echo "=========================================="
