#!/bin/bash
set -e

# Build script for packaging ChaasKit app for Elastic Beanstalk deployment
# Run this from the cdk/ directory

BUILD_VERSION=${BUILD_VERSION:-$(git rev-parse --short HEAD 2>/dev/null || echo "latest")}

echo "========================================"
echo "Building ChaasKit for Elastic Beanstalk"
echo "Version: ${BUILD_VERSION}"
echo "========================================"

# Navigate to project root
cd ..

# Install dependencies
echo ""
echo "Installing dependencies..."
pnpm install --frozen-lockfile

# Build the application
echo ""
echo "Building application..."
pnpm build

# Generate Prisma client
echo ""
echo "Generating Prisma client..."
pnpm db:generate

# Create deployment package
echo ""
echo "Creating deployment package..."
PACKAGE_NAME="cdk/app-${BUILD_VERSION}.zip"

# Remove old package if exists
rm -f "${PACKAGE_NAME}"

# Create zip with required files
# Note: We use --symlinks to preserve symlinks in node_modules
zip -r "${PACKAGE_NAME}" \
  build/ \
  node_modules/ \
  package.json \
  server.js \
  prisma/ \
  config/ \
  extensions/ \
  -x "*.git*" \
  -x "*node_modules/.cache*" \
  -x "*.env*" \
  -x "*cdk/*" \
  -x "*test*" \
  -x "*.test.*" \
  -x "*.spec.*"

echo ""
echo "========================================"
echo "Build complete!"
echo "Package: ${PACKAGE_NAME}"
echo "Size: $(du -h "${PACKAGE_NAME}" | cut -f1)"
echo "========================================"
