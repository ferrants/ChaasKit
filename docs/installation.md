# Installation

ChaasKit uses React Router v7 framework mode to provide a full-stack application with server-side rendering and a rich client experience.

## Prerequisites

- **Node.js** 18 or higher
- **pnpm** 8 or higher (recommended) or npm/yarn
- **PostgreSQL** 14 or higher

## Create a New Project

```bash
# Create a new ChaasKit project
npx chaaskit create my-app

# Navigate to your project
cd my-app
```

Or with options:
```bash
npx chaaskit create my-app --skip-install --use-npm
```

## Configure Environment

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```bash
# Database (required)
DATABASE_URL="postgresql://user:password@localhost:5432/my_app"

# Auth secrets (required - generate with: openssl rand -base64 32)
SESSION_SECRET=your-session-secret-min-32-chars
JWT_SECRET=your-jwt-secret-min-32-chars

# AI Provider (at least one required)
OPENAI_API_KEY=sk-...
# or
ANTHROPIC_API_KEY=sk-ant-...

# Application URLs (optional in development)
APP_URL=http://localhost:5173
API_URL=http://localhost:3000
```

## Setup Database

Push the schema to your database:

```bash
pnpm db:push
```

This creates all the required tables. For production, use migrations instead:

```bash
pnpm db:migrate
```

## Start Development

```bash
pnpm dev
```

This starts:
- The React Router dev server with HMR at `http://localhost:5173`
- The Express API server at `http://localhost:3000`

Visit `http://localhost:5173` to see your app!

## Project Structure

```
my-app/
├── app/
│   ├── routes/                    # React Router v7 routes
│   │   ├── _index.tsx             # Landing page (/)
│   │   ├── login.tsx              # Login page (/login)
│   │   ├── register.tsx           # Register page (/register)
│   │   ├── chat._index.tsx        # Main chat (/chat)
│   │   ├── chat.thread.$threadId.tsx  # Thread view (/chat/thread/:id)
│   │   ├── chat.documents.tsx     # Documents page (/chat/documents)
│   │   └── ...                    # Other routes
│   ├── components/                # Client wrapper components
│   │   ├── ChatClient.tsx         # Chat page client wrapper
│   │   ├── ClientOnly.tsx         # SSR boundary component
│   │   └── ...
│   ├── root.tsx                   # HTML shell, theme, providers
│   ├── routes.ts                  # Route configuration
│   ├── entry.client.tsx           # Client-side entry
│   └── entry.server.tsx           # Server-side entry
├── config/
│   └── app.config.ts              # Application configuration
├── extensions/
│   ├── agents/                    # Custom AI agents
│   ├── payment-plans/             # Custom pricing plans
│   └── pages/                     # Custom frontend pages
├── prisma/
│   └── schema/
│       ├── base.prisma            # ChaasKit models (synced from package)
│       └── custom.prisma          # Your custom models
├── public/
│   ├── logo.svg                   # Your logo
│   └── favicon.svg                # Favicon
├── .env                           # Environment variables
├── server.js                      # Production server
├── vite.config.ts                 # Vite configuration
├── react-router.config.ts         # React Router configuration
└── package.json
```

## Configure Your App

Edit `config/app.config.ts` to customize your application:

```typescript
import type { AppConfig } from '@chaaskit/shared';

export const config: AppConfig = {
  app: {
    name: 'My Chat App',
    description: 'AI-powered chat application',
    url: 'http://localhost:5173',
    basePath: '/chat',  // Chat app routes live under /chat
  },

  agent: {
    type: 'built-in',
    provider: 'openai',  // or 'anthropic'
    model: 'gpt-4o-mini',
    systemPrompt: 'You are a helpful AI assistant.',
  },

  // Enable features
  teams: { enabled: true },
  projects: {
    enabled: true,
    colors: ['#6366f1', '#8b5cf6', '#ec4899', /* ... */],
  },
  documents: {
    enabled: true,
    storage: { provider: 'database' },
  },

  // ... see Configuration docs for all options
};
```

See [Configuration](./configuration.md) for all available options.

## Updating ChaasKit

When new versions of ChaasKit are released:

```bash
# 1. Update the packages
pnpm update @chaaskit/server @chaaskit/client @chaaskit/db @chaaskit/shared

# 2. Sync the database schema
# This updates base.prisma with new models while preserving your custom.prisma
pnpm db:sync

# 3. Regenerate Prisma client
pnpm db:generate

# 4. Apply any schema changes to your database
pnpm db:push
```

The `db:sync` command is safe to run - it only updates `prisma/schema/base.prisma` (the ChaasKit models) and never touches your custom models in `prisma/schema/custom.prisma`.

## Database Options

### Local PostgreSQL

```bash
# Create a database
createdb my_app

# Connection string
DATABASE_URL="postgresql://localhost:5432/my_app"
```

### Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to Settings > Database
3. Use the "Transaction pooler" connection string for Prisma

### Neon

1. Create a project at [neon.tech](https://neon.tech)
2. Copy the connection string
3. Enable connection pooling for production

## AI Provider Setup

### Anthropic

1. Get an API key from [console.anthropic.com](https://console.anthropic.com)
2. Set `ANTHROPIC_API_KEY` in `.env`
3. Configure in `config/app.config.ts`:
   ```typescript
   agent: {
     type: 'built-in',
     provider: 'anthropic',
     model: 'claude-sonnet-4-20250514',
   }
   ```

### OpenAI

1. Get an API key from [platform.openai.com](https://platform.openai.com)
2. Set `OPENAI_API_KEY` in `.env`
3. Configure in `config/app.config.ts`:
   ```typescript
   agent: {
     type: 'built-in',
     provider: 'openai',
     model: 'gpt-4o-mini',
   }
   ```

## Verification

After setup, verify everything works:

1. Open `http://localhost:5173`
2. You should see the landing page
3. Click "Get Started" or navigate to `/login`
4. Register a new account
5. Send a test message in the chat
6. Check the terminal for any errors

## Troubleshooting

### Database connection issues

- Ensure PostgreSQL is running
- Check the connection string format
- Verify the database exists: `createdb my_app`

### "Module not found" errors

```bash
# Clean install
rm -rf node_modules
pnpm install
```

### Config not loading

The server looks for config in this order:
1. Programmatic config (via `setConfig()`)
2. `CHAASKIT_CONFIG_PATH` environment variable
3. `./config/app.config.ts` (relative to cwd)
4. `./config/app.config.js`
5. Default built-in config

### Type errors

```bash
# Regenerate Prisma client
pnpm db:generate
pnpm typecheck
```

### Theme/hydration warnings

If you see hydration warnings about `data-theme`, ensure your `app/root.tsx` uses the cookie-based theme sync pattern (this is set up by default in new projects).

## Next Steps

- [Configuration](./configuration.md) - Customize the application
- [Extensions](./extensions.md) - Add custom functionality
- [Development](./development.md) - Learn the development workflow
- [Deployment](./deployment.md) - Deploy to production
