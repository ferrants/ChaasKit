#!/bin/bash
# Pack all packages for local development testing
# This creates tarballs that can be used as dependencies in other projects

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$ROOT_DIR/dist"

echo "🔨 Building all packages..."
cd "$ROOT_DIR"
pnpm build

echo ""
echo "📦 Packing packages..."

# Create dist directory
mkdir -p "$DIST_DIR"

# Remove old tarballs
rm -f "$DIST_DIR"/*.tgz

# Pack each package
PACKAGES=("shared" "db" "server" "client" "create-chaaskit")
for pkg in "${PACKAGES[@]}"; do
  echo "  Packing $pkg..."
  cd "$ROOT_DIR/packages/$pkg"
  pnpm pack --pack-destination "$DIST_DIR"
done

echo ""
echo "✅ Packages packed to $DIST_DIR:"
ls -la "$DIST_DIR"/*.tgz

# Get version from shared package
VERSION=$(node -p "require('$ROOT_DIR/packages/shared/package.json').version")

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 To use these packages in another project:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Add to your package.json dependencies:"
echo ""
cat << EOF
{
  "dependencies": {
    "@chaaskit/server": "file:PATH_TO_MONOREPO/dist/chaaskit-server-${VERSION}.tgz",
    "@chaaskit/client": "file:PATH_TO_MONOREPO/dist/chaaskit-client-${VERSION}.tgz",
    "@chaaskit/db": "file:PATH_TO_MONOREPO/dist/chaaskit-db-${VERSION}.tgz",
    "@chaaskit/shared": "file:PATH_TO_MONOREPO/dist/chaaskit-shared-${VERSION}.tgz",
    "chaaskit": "file:PATH_TO_MONOREPO/dist/chaaskit-${VERSION}.tgz"
  },
  "pnpm": {
    "overrides": {
      "@chaaskit/shared": "file:PATH_TO_MONOREPO/dist/chaaskit-shared-${VERSION}.tgz",
      "@chaaskit/db": "file:PATH_TO_MONOREPO/dist/chaaskit-db-${VERSION}.tgz",
      "@chaaskit/server": "file:PATH_TO_MONOREPO/dist/chaaskit-server-${VERSION}.tgz",
      "@chaaskit/client": "file:PATH_TO_MONOREPO/dist/chaaskit-client-${VERSION}.tgz"
    }
  }
}
EOF
echo ""
echo "2. Replace PATH_TO_MONOREPO with the actual path (e.g., ../chaaskit)"
echo ""
echo "3. Run: pnpm install"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
