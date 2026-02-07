#!/bin/bash

# ChaasKit NPM Publishing Script
# Uses changesets to version and publish all packages

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== ChaasKit NPM Publishing ===${NC}"
echo ""

# Check if logged in to npm
echo -e "${YELLOW}Checking npm login status...${NC}"
if ! npm whoami &> /dev/null; then
    echo -e "${RED}Error: Not logged in to npm. Run 'npm login' first.${NC}"
    exit 1
fi

NPM_USER=$(npm whoami)
echo -e "${GREEN}Logged in as: ${NPM_USER}${NC}"
echo ""

# Check for uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
    echo -e "${YELLOW}Warning: You have uncommitted changes.${NC}"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check if there are changesets to publish
CHANGESET_COUNT=$(ls -1 .changeset/*.md 2>/dev/null | grep -v README.md | wc -l)

if [ "$CHANGESET_COUNT" -eq 0 ]; then
    echo -e "${YELLOW}No changesets found.${NC}"
    echo ""
    read -p "Create a changeset now? (Y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        pnpm changeset
        echo ""
    else
        echo -e "${RED}Cannot publish without a changeset. Run 'pnpm changeset' first.${NC}"
        exit 1
    fi
fi

# Version packages
echo -e "${YELLOW}Bumping versions and updating changelogs...${NC}"
pnpm changeset version
echo -e "${GREEN}Versions updated!${NC}"
echo ""

# Commit version changes
echo -e "${YELLOW}Committing version changes...${NC}"
git add -A
git commit -m "Version packages"
echo -e "${GREEN}Committed!${NC}"
echo ""

# Build all packages
echo -e "${YELLOW}Building all packages...${NC}"
pnpm build
echo -e "${GREEN}Build complete!${NC}"
echo ""

# Publish
echo -e "${YELLOW}Publishing to npm...${NC}"
pnpm changeset publish
echo -e "${GREEN}Published!${NC}"
echo ""

# Push to git
echo -e "${YELLOW}Pushing to git...${NC}"
git push && git push --tags
echo -e "${GREEN}Pushed!${NC}"
echo ""

echo -e "${GREEN}=== All packages published successfully! ===${NC}"
echo ""
echo "Users can now install with:"
echo "  npm create chaaskit my-app"
echo "  # or"
echo "  npx create-chaaskit my-app"
echo ""
echo "Or install individual packages:"
echo "  npm install @chaaskit/server @chaaskit/client @chaaskit/db @chaaskit/shared"
