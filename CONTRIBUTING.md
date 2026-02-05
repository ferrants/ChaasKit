# Contributing to ChaasKit

Thank you for your interest in contributing! This guide covers how to set up the development environment, work on the packages, and test your changes.

## Prerequisites

- **Node.js** 18 or higher
- **pnpm** 8 or higher
- **PostgreSQL** 14 or higher

## Getting Started

### 1. Clone and Install

```bash
git clone <repo-url>
cd chaaskit
pnpm install
```

### 2. Set Up Environment

```bash
cp .env.example .env
# Edit .env with your database URL and API keys
```

### 3. Set Up Database

```bash
pnpm db:generate
pnpm db:push
```

### 4. Start Development

```bash
pnpm dev
```

This starts the backend (port 3000) and frontend (port 5173) with hot reload.

## Demo App (Recommended for Local Dev)

There is a persistent demo app in `examples/demo` wired to local workspace packages (`workspace:*`). This avoids publishing or rebuilding tarballs to test changes.

### Quick Start

```bash
# From repo root
pnpm install
cp examples/demo/.env.example examples/demo/.env
pnpm --filter chaaskit-demo db:push
pnpm dev:demo
```

### What It Runs

- `@chaaskit/server` in watch mode
- `@chaaskit/client` library build in watch mode
- Demo app at `http://localhost:5173`

The API server runs at `http://localhost:3000` (API only; root path returns 404 in dev).

## Project Structure

```
chaaskit/
├── packages/
│   ├── shared/              # Types and validation (npm: @chaaskit/shared)
│   ├── db/                  # Prisma database (npm: @chaaskit/db)
│   ├── server/         # Express backend (npm: @chaaskit/server)
│   ├── client/         # React frontend (npm: @chaaskit/client)
│   └── create-chaaskit/    # CLI tool (npm: create-chaaskit)
├── config/                  # App configuration
├── extensions/              # Custom extensions
├── docs/                    # Documentation
└── public/                  # Static assets
```

## Building Packages

```bash
# Build all packages
pnpm build

# Build specific package
cd packages/server && pnpm build

# Type check all packages
pnpm typecheck
```

## Testing Changes in Another Project

Before packages are published to npm, you can test them locally using the `pack:local` script. This creates tarballs that simulate the npm-published packages.

### Step 1: Pack the Packages

```bash
# In the chaaskit directory
pnpm pack:local
```

This will:
1. Build all packages
2. Create tarballs in `dist/` with `workspace:*` replaced by version numbers
3. Print instructions for using them

### Step 2: Configure Your Test Project

Create a new project directory with these required files:

**package.json:**

```json
{
  "name": "my-test-app",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "concurrently \"chaaskit-server\" \"vite\"",
    "build": "vite build",
    "start": "NODE_ENV=production chaaskit-server",
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:studio": "prisma studio"
  },
  "dependencies": {
    "@chaaskit/server": "file:../chaaskit/dist/chat-saas-server-0.1.0.tgz",
    "@chaaskit/client": "file:../chaaskit/dist/chat-saas-client-0.1.0.tgz",
    "@chaaskit/db": "file:../chaaskit/dist/chat-saas-db-0.1.0.tgz",
    "@chaaskit/shared": "file:../chaaskit/dist/chat-saas-shared-0.1.0.tgz",
    "@prisma/client": "^6.0.0",
    "@vitejs/plugin-react": "^5.1.2",
    "concurrently": "^9.2.1",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.22.0",
    "vite": "^5.4.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "prisma": "^6.0.0",
    "typescript": "^5.6.0"
  },
  "pnpm": {
    "overrides": {
      "@chaaskit/shared": "file:../chaaskit/dist/chat-saas-shared-0.1.0.tgz",
      "@chaaskit/db": "file:../chaaskit/dist/chat-saas-db-0.1.0.tgz",
      "@chaaskit/server": "file:../chaaskit/dist/chat-saas-server-0.1.0.tgz",
      "@chaaskit/client": "file:../chaaskit/dist/chat-saas-client-0.1.0.tgz"
    }
  }
}
```

**Important notes:**
- The `pnpm.overrides` section is required because the packages reference each other by version number (e.g., `@chaaskit/db: "0.1.0"`). Without overrides, pnpm would try to fetch them from npm.
- `react`, `react-dom`, and `react-router-dom` must be direct dependencies (the library externalizes these).

**vite.config.ts:**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Ensure single instances of React and react-router-dom
    // This prevents issues when using pre-built libraries that externalize React
    dedupe: ['react', 'react-dom', 'react-router-dom'],
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
```

**src/main.tsx:**

```tsx
import { renderApp } from '@chaaskit/client';
import '@chaaskit/client/styles';

renderApp(document.getElementById('root'));
```

**index.html:**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My Chat App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### Step 3: Setup and Run

```bash
# Install dependencies
pnpm install

# Setup database (copy schema from package, generate client, then push)
mkdir -p prisma
cp node_modules/@chaaskit/db/prisma/schema.prisma prisma/
pnpm db:generate
pnpm db:push

# Start development
pnpm dev
```

### Step 4: Iterate

After making changes to the monorepo:

```bash
# In the monorepo
pnpm pack:local

# In your test project - reinstall to pick up changes
pnpm install
# Or for a clean install:
rm -rf node_modules/.pnpm/@chat-saas* node_modules/.vite
pnpm install
```

### Why Tarballs Instead of `pnpm link`?

The packages use `workspace:*` protocol internally (e.g., `@chaaskit/server` depends on `@chaaskit/db@workspace:*`). This only works inside a pnpm workspace.

When you run `pnpm pack`, it replaces `workspace:*` with actual version numbers (e.g., `0.1.0`), simulating how packages would work when published to npm. This is the most accurate way to test the packages as consumers would use them.

### Common Issues

**React infinite loop / "Maximum update depth exceeded":**
- Ensure `resolve.dedupe` is set in vite.config.ts
- Ensure react, react-dom, react-router-dom are direct dependencies

**CSS not loading:**
- Import styles with: `import '@chaaskit/client/styles';`

**Prisma client errors ("Cannot find module '.prisma/client/default'"):**
- Run `pnpm db:generate` to generate the Prisma client
- Then run `pnpm db:push` to push the schema to your database

## Making Changes

### Adding a New API Endpoint

1. Create the route in `packages/server/src/api/`
2. Register it in `packages/server/src/app.ts`
3. Add types to `packages/shared/src/types/api.ts`

### Adding a New Database Model

1. Edit `packages/db/prisma/schema.prisma`
2. Run `pnpm db:push && pnpm db:generate`

### Adding a New Component

1. Create in `packages/client/src/components/`
2. Import and use in the appropriate page

### Modifying the Config System

Config resolution happens in `packages/server/src/config/loader.ts`. The priority order is:
1. Programmatic config via `setConfig()`
2. `CHAASKIT_CONFIG_PATH` environment variable
3. `./config/app.config.ts` relative to cwd
4. Monorepo fallback path
5. Built-in defaults

## Code Style

- TypeScript strict mode enabled
- Use ESNext modules (`import`/`export`)
- Follow existing patterns in the codebase
- Run `pnpm typecheck` before committing

## TypeScript Notes

- Base config in `tsconfig.base.json` has `noEmit: true`
- Packages that emit JS (server, db, create-chaaskit) override with `noEmit: false`
- Use `composite: true` for incremental builds

## Documentation

- User docs are in `docs/`
- Update relevant docs when making user-facing changes
- CLAUDE.md contains developer/AI assistant guidance

## Questions?

- Check existing docs in `docs/`
- Look at similar code in the codebase
- Open an issue for discussion
