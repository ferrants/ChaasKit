# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## General Conventions

This is a TypeScript-first monorepo. Default to TypeScript for all new files. Use `.ts`/`.tsx` extensions unless explicitly told otherwise.

## Documentation

For detailed documentation on specific features, see the `docs/` directory or start with `docs/index.md` for an overview of available documentation.

When updating documentation, always check for related docs files (README.md, CHANGELOG.md, docs/ folder) that may also need updates for consistency.

## Styling

This project uses Tailwind CSS for styling. Do not introduce CSS modules, styled-components, or other CSS-in-JS solutions. All styling should use Tailwind utility classes and the tailwind.config file.

## Build & Development Commands

```bash
# Install dependencies
pnpm install

# Start development servers (frontend + backend concurrently)
pnpm dev

# Build all packages
pnpm build

# Type checking
pnpm typecheck

# Database commands
pnpm db:generate    # Generate Prisma client
pnpm db:push        # Push schema to database (development)
pnpm db:migrate     # Create and run migrations (production)
pnpm db:studio      # Open Prisma Studio GUI

# Database push with .env loading (useful when DATABASE_URL isn't in environment)
./scripts/db-push.sh
```

## Architecture Overview

This is a **pnpm monorepo** containing publishable npm packages for an AI ChaasKit application:

### Package Dependency Graph
```
config/app.config.ts
        ↓
@chaaskit/shared  ←─────────────────┐
        ↓                            │
@chaaskit/db                        │
        ↓                            │
@chaaskit/server ──────────────┤
        ↓                            │
@chaaskit/client ──────────────┘

create-chaaskit (CLI scaffolding tool)
```

### Packages

**`packages/shared`** - Shared TypeScript types and Zod validation schemas
- Types: `config.ts`, `theme.ts`, `payment.ts`, `mcp.ts`, `api.ts`
- Validation: `auth.ts`, `threads.ts`, `messages.ts`
- Constants: HTTP status codes, error messages

**`packages/db`** - Prisma database layer (PostgreSQL)
- Schema: User, Thread, Message, Team, TeamMember, MessageFeedback, SharedThread, PromptTemplate, MagicLink, PasswordReset
- Exports the Prisma client as `db`
- Schema helpers: `copySchemaToProject()`, `initializePrisma()`

**`packages/server`** - Express.js backend (port 3000)
- **Factory Functions**: `createApp()`, `createServer()` for programmatic use
- **API Routes** (`src/api/`): auth, threads, chat, user, payments, search, share, export, templates, mcp, upload, health
- **Services** (`src/services/`): `agent.ts` (AI provider abstraction), `usage.ts` (rate limiting)
- **Middleware** (`src/middleware/`): auth (JWT), errorHandler, requestLogger
- **MCP** (`src/mcp/`): Model Context Protocol client for tool integration
- **Registry** (`src/registry/`): Plugin system for custom agents, payment plans, auth providers
- **Extensions** (`src/extensions/`): Auto-discovery loader for user extensions
- **CLI** (`src/bin/cli.ts`): `chaaskit-server` command

**`packages/client`** - React + Vite frontend (port 5173)
- **Pages** (`src/pages/`): ChatPage, LoginPage, RegisterPage, SharedThreadPage
- **Components** (`src/components/`): Sidebar, MessageList, MessageItem, content renderers
- **Contexts** (`src/contexts/`): AuthContext, ThemeContext, ConfigContext
- **Stores** (`src/stores/`): chatStore (Zustand) for chat state and SSE streaming
- **Extensions** (`src/extensions/`): Client-side extension registry for custom pages/tools

**`packages/create-chaaskit`** - CLI scaffolding tool (package name: `create-chaaskit`)
- `create-chaaskit create <project-name>` - Scaffold a new project
- `create-chaaskit dev` - Start dev servers
- `create-chaaskit build` - Production build

**`config/`** - Central configuration
- `app.config.ts`: All app settings (UI, auth methods, AI agent, payments, MCP, etc.)

**`tailwind.config.ts`** - Theme configuration
- Uses `createChaaskitPreset()` from `@chaaskit/client/tailwind-preset`
- Defines theme colors (light/dark), fonts, and border radius

## Building and Linking for Local Development

To use these packages in another project before npm publishing:

```bash
# 1. Build all packages
pnpm build

# 2. Link packages globally
pnpm -r exec pnpm link --global

# Or link sequentially to avoid race conditions:
cd packages/shared && pnpm link --global
cd ../db && pnpm link --global
cd ../server && pnpm link --global
cd ../client && pnpm link --global
cd ../create-chaaskit && pnpm link --global
```

In your consumer project:
```bash
pnpm link --global @chaaskit/server @chaaskit/client @chaaskit/db @chaaskit/shared create-chaaskit
```

After making changes to the monorepo, rebuild to update linked packages:
```bash
pnpm build
```

## Key Files to Modify

When customizing the application, these are the primary files to edit:

| File | Purpose |
|------|---------|
| `config/app.config.ts` | Main configuration (UI, auth, AI agent, payments) |
| `tailwind.config.ts` | Theme colors, fonts, and styling configuration |
| `.env` | Environment variables and secrets |
| `packages/db/prisma/schema/base.prisma` | Core database schema (all platform models) |
| `packages/db/prisma/schema/custom.prisma` | Consumer's custom models (empty by default) |
| `packages/client/vite.config.ts` | Frontend dev server config (allowed hosts, proxy) |
| `public/logo.svg` | Application logo |
| `extensions/` | Custom agents, payment plans, components |

## Key Architectural Patterns

**Server Factory Functions** (`server/src/app.ts`, `server/src/server.ts`)
- `createApp(options)` - Creates Express app without starting server
- `createServer(options)` - Creates and starts HTTP server
- Supports programmatic config via `setConfig()` or file-based config resolution

**Config Resolution** (`server/src/config/loader.ts`)
Priority order:
1. Programmatic config via `setConfig()`
2. `CHAASKIT_CONFIG_PATH` environment variable
3. `./config/app.config.ts` (relative to cwd)
4. `./config/app.config.js`
5. Monorepo path (for development)
6. Built-in defaults

**AI Agent Abstraction** (`server/src/services/agent.ts`)
- `createAgentService(config)` factory returns `AnthropicAgentService`, `OpenAIAgentService`, or `ExternalAgentService`
- All implement `AgentService` interface with async generator `chat()` method for streaming
- API keys are validated before use - empty strings throw clear errors

**Registry Pattern** (`server/src/registry/index.ts`)
- Singleton registry for extensibility: `registry.register('agent', 'name', Implementation)`
- Categories: `agent`, `payment-plan`, `auth-provider`, `content-renderer`
- Base classes: `BaseAgent`, `BasePricingPlan`, `BaseAuthProvider`

**Extension Auto-Discovery** (`server/src/extensions/loader.ts`)
- Automatically loads extensions from `extensions/agents/`, `extensions/payment-plans/`, `extensions/auth-providers/`
- Extensions self-register with the registry when imported

**Client Extension System** (`client/src/extensions/`)
- `clientRegistry.registerPage()` - Add custom pages to the app
- `clientRegistry.registerTool()` - Add custom tool result renderers
- React hooks: `useExtensionPages()`, `useSidebarPages()`, `useToolRenderer()`

**SSE Streaming** (`server/src/api/chat.ts` → `client/src/stores/chatStore.ts`)
- Server sends SSE events: `thread`, `start`, `delta`, `done`, `error`
- Client parses via `ReadableStream` and updates Zustand store

**Theming System**
- Themes configured in `tailwind.config.ts` using `createChaaskitPreset()` from `@chaaskit/client/tailwind-preset`
- CSS variables generated at build time by the Tailwind preset
- `ThemeContext` manages runtime switching via `data-theme` attribute
- Tailwind utilities (e.g., `bg-primary`, `text-text-primary`) use CSS variable colors

## Development Workflow

### Hot Reload
- **Frontend**: Vite HMR provides instant updates
- **Backend**: `tsx watch` auto-restarts on changes to `packages/server/src/`
- **Config**: Backend also watches `config/` directory via `--watch=../../config` flag

### Demo App (Recommended)
Use the persistent demo app in `examples/demo` for local development with workspace packages.

Quick start:
```bash
pnpm install
cp examples/demo/.env.example examples/demo/.env
pnpm --filter chaaskit-demo db:push
pnpm dev:demo
```

Demo config + tools:
- The demo server must load `examples/demo/config/app.config.ts` (via `CHAASKIT_CONFIG_PATH`) to pick up demo-specific settings like `allowedTools: ['native:*']`.
- Use `pnpm dev:demo` (or `CHAASKIT_CONFIG_PATH=examples/demo/config/app.config.ts pnpm --filter @chaaskit/server dev`) so the demo config is actually loaded.

### Sync Checklist (When Adding/Changing Features)
- Update `packages/create-chaaskit/src/templates/`
- Update `examples/demo/`
- Update relevant `docs/` files

### Tests (When Adding/Changing Features)
- Add or update tests for new behavior (Vitest, run via `pnpm test`)
- Prefer unit tests with mocks; use Postgres test DB for persistence-sensitive logic

### Network Access
To access the dev server from other machines:
1. Frontend is exposed on `0.0.0.0:5173` via `--host` flag
2. Add hostnames to `allowedHosts` in `packages/client/vite.config.ts`

### Database Changes
1. Modify `packages/db/prisma/schema/base.prisma`
2. Run `pnpm db:push` to apply changes
3. Run `pnpm db:generate` if you added new models

**IMPORTANT: `base.prisma` vs `custom.prisma`**
- **`base.prisma`**: All core platform models go here. This is what ships with `@chaaskit/db` and gets overwritten by `db:sync`. Any model that the platform depends on (or that `base.prisma` has relations to) MUST be in `base.prisma`.
- **`custom.prisma`**: Reserved for consumer's own application-specific models. Should be empty in the package source — consumers add their own models here.
- **Never put core models in `custom.prisma`** — they won't ship with the package and will break relation references in `base.prisma`.

Schema sync (3 locations must stay in sync):
- `packages/db/prisma/schema/` (source of truth)
- `examples/demo/prisma/schema/` (copy both files here)
- `packages/create-chaaskit/src/templates/prisma/schema/` (copy `base.prisma` here)

### Switching AI Providers
1. Edit `config/app.config.ts`:
   ```typescript
   agent: {
     type: 'built-in',
     provider: 'openai',  // or 'anthropic'
     model: 'gpt-4o-mini',
   }
   ```
2. Ensure corresponding API key is set in `.env`
3. Backend auto-restarts with new config

## Extensions

Custom code goes in `extensions/` directory:
- `extensions/agents/` - Custom AI agents (server-side)
- `extensions/payment-plans/` - Custom pricing plans (server-side)
- `extensions/auth-providers/` - Additional OAuth providers (server-side)
- `extensions/pages/` - Custom frontend pages (client-side)
- `extensions/tools/` - Custom tool result renderers (client-side)

## Environment Setup

Required in `.env`:
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET`, `JWT_SECRET` - Auth secrets (min 32 chars)
- `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` - AI provider key (at least one required)
- `APP_URL`, `API_URL` - Frontend and backend URLs

Optional:
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` - For payments
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - For Google OAuth
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` - For GitHub OAuth

**Note**: Empty API keys (e.g., `ANTHROPIC_API_KEY=""`) are treated as unset and will throw clear errors.

## TypeScript Configuration

- Base config in `tsconfig.base.json` with `ES2022` target
- Project references between packages (shared → db → server, shared → client)
- Packages use `composite: true` for incremental builds
- Module system: ESNext with bundler resolution
- Note: Base config has `noEmit: true`; packages that emit JS must override with `noEmit: false`

## Common Tasks

### Add a new API endpoint
1. Create route file in `packages/server/src/api/`
2. Register in `packages/server/src/app.ts`
3. Add types to `packages/shared/src/types/api.ts`

### Add a new database model
1. Add model to `packages/db/prisma/schema/base.prisma` (core platform models) or `custom.prisma` (consumer-only models)
2. Run `pnpm db:push && pnpm db:generate`
3. Import from `@chaaskit/db` in server code
4. Sync schema to `examples/demo/prisma/schema/` and `packages/create-chaaskit/src/templates/prisma/schema/`

### Add a new frontend page
1. Create component in `packages/client/src/pages/`
2. Add route in `packages/client/src/App.tsx`

### Test chat functionality
1. Ensure an AI provider key is set in `.env`
2. Check `config/app.config.ts` matches the provider with a key
3. Register/login and send a message
4. Check server logs for errors if chat fails

### Demo build note
- The demo app uses React Router SSR and includes loaders/actions. Do not disable SSR for demo builds; SPA mode will fail on routes that export `loader`.

## Debugging

### Server logs
Watch the terminal running `pnpm dev` for:
- Request logs: `GET /api/threads 200 15ms`
- Config loading: `[Config] Loaded from ./config/app.config.ts`
- Extension loading: `[Extensions] Loaded: extensions/agents/my-agent.ts`
- Errors: Stack traces with file locations
- Restart messages: `[tsx] change in ./src/... Restarting...`

### Database inspection
```bash
pnpm db:studio  # Opens Prisma Studio at http://localhost:5555
```

### Check current config
The config loader in `packages/server/src/config/loader.ts` provides defaults.
To see active config, add a log statement or check the `/api/health` endpoint.
