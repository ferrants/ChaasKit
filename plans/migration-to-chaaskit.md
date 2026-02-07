# Migrating from Chat-SaaS to ChaasKit

This guide walks you through upgrading from the `chat-saas` packages to the new `chaaskit` packages.

## Overview of Changes

| Old | New |
|-----|-----|
| `@chat-saas/core-server` | `@chaaskit/server` |
| `@chat-saas/core-client` | `@chaaskit/client` |
| `@chat-saas/shared` | `@chaaskit/shared` |
| `@chat-saas/db` | `@chaaskit/db` |
| `chat-saas-template` (CLI) | `chaaskit` |
| `chat-saas-server` (command) | `chaaskit-server` |
| `chat-saas-queue-worker` (command) | `chaaskit-worker` |
| `CHAT_SAAS_CONFIG_PATH` | `CHAASKIT_CONFIG_PATH` |

## Step 1: Update package.json

Replace the old package names with the new ones:

**Before:**
```json
{
  "dependencies": {
    "@chat-saas/core-server": "^0.1.0",
    "@chat-saas/core-client": "^0.1.0",
    "@chat-saas/db": "^0.1.0",
    "@chat-saas/shared": "^0.1.0"
  },
  "scripts": {
    "dev": "concurrently \"chat-saas-server\" \"vite\"",
    "start": "NODE_ENV=production chat-saas-server",
    "db:sync": "chat-saas-server db:sync"
  }
}
```

**After:**
```json
{
  "dependencies": {
    "@chaaskit/server": "^0.1.0",
    "@chaaskit/client": "^0.1.0",
    "@chaaskit/db": "^0.1.0",
    "@chaaskit/shared": "^0.1.0"
  },
  "scripts": {
    "dev": "concurrently \"chaaskit-server\" \"vite\"",
    "start": "NODE_ENV=production chaaskit-server",
    "db:sync": "chaaskit-server db:sync"
  }
}
```

## Step 2: Update Import Statements

Update all imports in your TypeScript/JavaScript files:

**Before:**
```typescript
import { createServer } from '@chat-saas/core-server';
import { renderApp } from '@chat-saas/core-client';
import { db } from '@chat-saas/db';
import type { AppConfig } from '@chat-saas/shared';
```

**After:**
```typescript
import { createServer } from '@chaaskit/server';
import { renderApp } from '@chaaskit/client';
import { db } from '@chaaskit/db';
import type { AppConfig } from '@chaaskit/shared';
```

### Quick Find & Replace

Run these commands from your project root to update all files:

```bash
# Update imports (order matters - do longer patterns first)
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \) \
  -not -path "*/node_modules/*" \
  -exec sed -i 's/@chat-saas\/core-server/@chaaskit\/server/g' {} +

find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \) \
  -not -path "*/node_modules/*" \
  -exec sed -i 's/@chat-saas\/core-client/@chaaskit\/client/g' {} +

find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \) \
  -not -path "*/node_modules/*" \
  -exec sed -i 's/@chat-saas\/shared/@chaaskit\/shared/g' {} +

find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \) \
  -not -path "*/node_modules/*" \
  -exec sed -i 's/@chat-saas\/db/@chaaskit\/db/g' {} +
```

## Step 3: Update Environment Variables

If you use `CHAT_SAAS_CONFIG_PATH`, rename it:

**Before (.env):**
```bash
CHAT_SAAS_CONFIG_PATH=./config/app.config.ts
```

**After (.env):**
```bash
CHAASKIT_CONFIG_PATH=./config/app.config.ts
```

## Step 4: Update Database Name (Optional)

For consistency, you may want to rename your database:

**Before (.env):**
```bash
DATABASE_URL="postgresql://user:password@localhost:5432/chat_saas?schema=public"
```

**After (.env):**
```bash
DATABASE_URL="postgresql://user:password@localhost:5432/chaaskit?schema=public"
```

If renaming the database:
```bash
# Create new database
psql -U postgres -c "CREATE DATABASE chaaskit;"

# Dump old database and restore to new
pg_dump -U postgres chat_saas | psql -U postgres chaaskit

# Or simply rename (requires no active connections)
psql -U postgres -c "ALTER DATABASE chat_saas RENAME TO chaaskit;"
```

## Step 5: Update Docker Compose (if applicable)

**Before:**
```yaml
services:
  db:
    environment:
      - POSTGRES_DB=chat_saas
  app:
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/chat_saas
```

**After:**
```yaml
services:
  db:
    environment:
      - POSTGRES_DB=chaaskit
  app:
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/chaaskit
```

## Step 6: Update config/app.config.ts

Update the import at the top of your config file:

**Before:**
```typescript
import type { AppConfig } from '@chat-saas/shared';
```

**After:**
```typescript
import type { AppConfig } from '@chaaskit/shared';
```

## Step 7: Update Extensions (if applicable)

If you have custom extensions, update their imports:

**Before (extensions/agents/my-agent.ts):**
```typescript
import { registry, BaseAgent } from '@chat-saas/core-server';
```

**After (extensions/agents/my-agent.ts):**
```typescript
import { registry, BaseAgent } from '@chaaskit/server';
```

## Step 8: Update Client Entry Point

**Before (src/main.tsx):**
```typescript
import { renderApp } from '@chat-saas/core-client';
import '@chat-saas/core-client/styles';
```

**After (src/main.tsx):**
```typescript
import { renderApp } from '@chaaskit/client';
import '@chaaskit/client/styles';
```

## Step 9: Reinstall Dependencies

```bash
# Remove old node_modules and lockfile
rm -rf node_modules pnpm-lock.yaml

# Reinstall
pnpm install

# Regenerate Prisma client
pnpm db:generate
```

## Step 10: Verify

```bash
# Type check
pnpm typecheck

# Start dev server
pnpm dev
```

## Complete Migration Script

Save this as `migrate-to-chaaskit.sh` and run it from your project root:

```bash
#!/bin/bash
set -e

echo "Migrating from chat-saas to chaaskit..."

# Update package.json
echo "Updating package.json..."
sed -i 's/@chat-saas\/core-server/@chaaskit\/server/g' package.json
sed -i 's/@chat-saas\/core-client/@chaaskit\/client/g' package.json
sed -i 's/@chat-saas\/shared/@chaaskit\/shared/g' package.json
sed -i 's/@chat-saas\/db/@chaaskit\/db/g' package.json
sed -i 's/chat-saas-server/chaaskit-server/g' package.json
sed -i 's/chat-saas-queue-worker/chaaskit-worker/g' package.json

# Update TypeScript/JavaScript files
echo "Updating import statements..."
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \) \
  -not -path "*/node_modules/*" -not -path "*/dist/*" \
  -exec sed -i 's/@chat-saas\/core-server/@chaaskit\/server/g' {} +

find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \) \
  -not -path "*/node_modules/*" -not -path "*/dist/*" \
  -exec sed -i 's/@chat-saas\/core-client/@chaaskit\/client/g' {} +

find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \) \
  -not -path "*/node_modules/*" -not -path "*/dist/*" \
  -exec sed -i 's/@chat-saas\/shared/@chaaskit\/shared/g' {} +

find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \) \
  -not -path "*/node_modules/*" -not -path "*/dist/*" \
  -exec sed -i 's/@chat-saas\/db/@chaaskit\/db/g' {} +

# Update .env if it exists
if [ -f ".env" ]; then
  echo "Updating .env..."
  sed -i 's/CHAT_SAAS_CONFIG_PATH/CHAASKIT_CONFIG_PATH/g' .env
  # Optionally update database name
  # sed -i 's/chat_saas/chaaskit/g' .env
fi

# Clean and reinstall
echo "Cleaning old dependencies..."
rm -rf node_modules pnpm-lock.yaml

echo "Installing new dependencies..."
pnpm install

echo "Regenerating Prisma client..."
pnpm db:generate

echo ""
echo "Migration complete!"
echo ""
echo "Next steps:"
echo "  1. Review the changes with: git diff"
echo "  2. Run type checking: pnpm typecheck"
echo "  3. Test your app: pnpm dev"
echo ""
echo "If you need to update your database name, run:"
echo "  psql -U postgres -c \"ALTER DATABASE chat_saas RENAME TO chaaskit;\""
echo "  Then update DATABASE_URL in .env"
```

Run it:
```bash
chmod +x migrate-to-chaaskit.sh
./migrate-to-chaaskit.sh
```

## Troubleshooting

### "Cannot find module '@chaaskit/...'"
- Run `pnpm install` to install the new packages
- Make sure you've updated all import statements

### TypeScript errors after migration
- Run `pnpm db:generate` to regenerate Prisma types
- Clear TypeScript cache: `rm -rf node_modules/.cache`

### Database connection errors
- If you renamed your database, update `DATABASE_URL` in `.env`
- Run `pnpm db:push` to ensure schema is synced
