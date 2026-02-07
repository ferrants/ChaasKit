# Development

This guide covers the development workflow for ChaasKit projects.

## Starting Development

```bash
# In your project directory
pnpm dev
```

This starts the React Router v7 dev server with HMR at `http://localhost:5173`, which proxies API requests to the Express backend at `http://localhost:3000`.

---

## Monorepo Demo App

For contributors working inside the monorepo, use the persistent demo app in `examples/demo`. It’s wired to local workspace packages to avoid publishing or rebuilding tarballs.

```bash
# From repo root
pnpm install
cp examples/demo/.env.example examples/demo/.env
pnpm --filter chaaskit-demo db:push
pnpm dev:demo
```

The demo app runs at `http://localhost:5173`. The API server runs at `http://localhost:3000` (root path returns 404 in dev).

---

## Project Structure

```
my-app/
├── app/
│   ├── routes/                    # React Router v7 routes
│   │   ├── _index.tsx             # Landing page (/)
│   │   ├── login.tsx              # Login page (/login)
│   │   ├── register.tsx           # Registration (/register)
│   │   ├── chat._index.tsx        # Main chat (/chat)
│   │   ├── chat.thread.$threadId.tsx  # Thread view
│   │   ├── chat.documents.tsx     # Documents (/chat/documents)
│   │   ├── chat.api-keys.tsx      # API Keys (/chat/api-keys)
│   │   └── ...
│   ├── components/                # Client wrapper components
│   │   ├── ChatClient.tsx         # Chat page client wrapper
│   │   └── ClientOnly.tsx         # SSR boundary component
│   ├── root.tsx                   # HTML shell, theme, providers
│   ├── routes.ts                  # Route configuration
│   ├── entry.client.tsx           # Client hydration
│   └── entry.server.tsx           # Server rendering
├── config/
│   └── app.config.ts              # Application configuration
├── extensions/
│   ├── agents/                    # Custom AI agents
│   ├── payment-plans/             # Custom pricing plans
│   └── pages/                     # Custom frontend pages
├── prisma/
│   └── schema/
│       ├── base.prisma            # ChaasKit models (synced)
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

---

## Commands

### Development

```bash
pnpm dev          # Start dev server with HMR
pnpm build        # Build for production
pnpm typecheck    # Run TypeScript checks
pnpm start        # Start production server
```

### Testing

```bash
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5433/chat_saas_test?schema=public" pnpm test
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5433/chat_saas_test?schema=public" pnpm test:watch
./scripts/test.sh
```

Tests use a Postgres test database. Set `TEST_DATABASE_URL` (preferred) or `DATABASE_URL`.

### Database

```bash
pnpm db:generate  # Generate Prisma client
pnpm db:push      # Push schema changes (dev)
pnpm db:migrate   # Create and run migrations (prod)
pnpm db:studio    # Open Prisma Studio
pnpm db:sync      # Sync base.prisma from @chaaskit/db
```

---

## Common Tasks

### Customize Configuration

Edit `config/app.config.ts`:

```typescript
import type { AppConfig } from '@chaaskit/shared';

export const config: AppConfig = {
  app: {
    name: 'My App',
    description: 'My AI chat application',
    url: 'http://localhost:5173',
    basePath: '/chat',
  },
  agent: {
    type: 'built-in',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    systemPrompt: 'You are a helpful assistant.',
  },
  // ... other options
};
```

The server automatically reloads when config changes.

### Add a Custom Agent

Create `extensions/agents/my-agent.ts`:

```typescript
import { BaseAgent, registry } from '@chaaskit/server';

export class MyAgent extends BaseAgent {
  async *chat(messages, options) {
    yield { type: 'text', content: 'Hello!' };
    yield { type: 'done' };
  }
}

registry.register('agent', 'my-agent', MyAgent);
```

Then reference it in config:

```typescript
agent: {
  type: 'custom',
  agentId: 'my-agent',
}
```

### Add a Custom Route

Create a new route file in `app/routes/`. React Router v7 uses file-based routing:

```tsx
// app/routes/chat.my-page.tsx
// This creates a route at /chat/my-page

import { ChatProviders } from '@chaaskit/client';

export default function MyPage() {
  return (
    <ChatProviders>
      <div className="min-h-screen bg-background p-8">
        <h1 className="text-2xl font-bold text-text-primary">
          My Custom Page
        </h1>
      </div>
    </ChatProviders>
  );
}
```

For pages that need data loading:

```tsx
// app/routes/chat.stats.tsx
import type { Route } from './+types/chat.stats';
import { ChatProviders } from '@chaaskit/client';

export async function loader({ request }: Route.LoaderArgs) {
  // Server-side data loading
  return { stats: { threads: 42 } };
}

export default function StatsPage({ loaderData }: Route.ComponentProps) {
  return (
    <ChatProviders>
      <div className="p-8">
        <h1>Stats</h1>
        <p>Total threads: {loaderData.stats.threads}</p>
      </div>
    </ChatProviders>
  );
}
```

### Add a Custom Database Model

1. Edit `prisma/schema/custom.prisma`:

```prisma
model MyModel {
  id        String   @id @default(cuid())
  name      String
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  createdAt DateTime @default(now())
}
```

2. Apply changes:

```bash
pnpm db:push      # Development
pnpm db:generate  # Regenerate client
```

3. Use in your code:

```typescript
import { db } from '@chaaskit/db';

const items = await db.myModel.findMany({
  where: { userId: user.id }
});
```

---

## Adding Custom API Routes

Create a custom server entry point to add routes alongside ChaasKit's API.

### Custom Server

Create `src/server.ts`:

```typescript
import { createApp } from '@chaaskit/server';
import { Router } from 'express';
import { config } from '../config/app.config.js';

async function start() {
  const app = await createApp({ config });

  // Add custom routes
  const customRouter = Router();

  customRouter.get('/api/custom/hello', (req, res) => {
    res.json({ message: 'Hello!' });
  });

  app.use(customRouter);

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

start().catch(console.error);
```

### Using Auth Middleware

```typescript
import { requireAuth, optionalAuth } from '@chaaskit/server';

// Protected route
customRouter.get('/api/custom/profile', requireAuth, (req, res) => {
  res.json({
    userId: req.user!.id,
    email: req.user!.email,
  });
});

// Optional auth
customRouter.get('/api/custom/public', optionalAuth, (req, res) => {
  if (req.user) {
    res.json({ greeting: `Hello, ${req.user.email}!` });
  } else {
    res.json({ greeting: 'Hello, guest!' });
  }
});
```

### Accessing the Database

```typescript
import { db } from '@chaaskit/db';
import { requireAuth } from '@chaaskit/server';

customRouter.get('/api/custom/stats', requireAuth, async (req, res) => {
  const threadCount = await db.thread.count({
    where: { userId: req.user!.id },
  });

  res.json({ threads: threadCount });
});
```

---

## Route Naming Convention

React Router v7 uses dot notation for nested routes:

| File | URL Path |
|------|----------|
| `app/routes/_index.tsx` | `/` |
| `app/routes/login.tsx` | `/login` |
| `app/routes/chat._index.tsx` | `/chat` |
| `app/routes/chat.thread.$threadId.tsx` | `/chat/thread/:threadId` |
| `app/routes/chat.documents.tsx` | `/chat/documents` |
| `app/routes/shared.$shareId.tsx` | `/shared/:shareId` |

The `$` prefix creates dynamic segments. The `_index` suffix creates index routes.

---

## Client-Side Navigation

Use `useAppPath` for navigation that respects `basePath`:

```tsx
import { useAppPath } from '@chaaskit/client';
import { Link } from 'react-router';

function MyComponent() {
  const appPath = useAppPath();

  return (
    <Link to={appPath('/documents')}>
      Go to Documents
    </Link>
  );
}
```

This ensures links work correctly whether `basePath` is `/` or `/chat`.

---

## Debugging

### Server Logs

Watch the terminal for:
- Request logs: `GET /api/threads 200 15ms`
- Config loading: `[Config] Loaded from ./config/app.config.ts`
- Extension loading: `[Extensions] Loaded: extensions/agents/my-agent.ts`
- Errors with stack traces

### Database Inspection

```bash
pnpm db:studio  # Opens at http://localhost:5555
```

### Frontend DevTools

- React DevTools for component inspection
- Network tab for API requests
- Console for errors

---

## Type Checking

```bash
pnpm typecheck
```

This runs TypeScript across all files to catch type errors.

---

## Network Access

To access from other devices on your network:

1. The dev server exposes on `0.0.0.0:5173` via the `--host` flag
2. Add allowed hostnames to `vite.config.ts`:

```typescript
server: {
  host: true,
  allowedHosts: ['my-machine.local', '192.168.1.100'],
}
```

---

## Monorepo Development

If you're contributing to ChaasKit itself, see the main repository's CLAUDE.md for monorepo-specific instructions.

### Building Packages

```bash
pnpm build
```

### Linking for Local Development

```bash
# In the chaaskit monorepo
pnpm build
pnpm -r exec pnpm link --global

# In your test project
pnpm link --global @chaaskit/server @chaaskit/client @chaaskit/db @chaaskit/shared
```

### Testing the CLI

```bash
# Build and run directly
cd packages/create-chaaskit
pnpm build
node dist/index.js create my-test-app --skip-install

# Or use the test script
./scripts/create-test-project.sh
```
