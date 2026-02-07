# ChaasKit

A full-stack AI chat application framework built with React Router v7 and Express.js. Create production-ready AI chat applications with authentication, team workspaces, MCP tool integration, and more.

## Features

- **Multi-provider AI Support**: Anthropic (Claude) and OpenAI out of the box
- **Multi-Agent Support**: Configure multiple agents with different models
- **Real-time Streaming**: SSE-based response streaming
- **Team Workspaces**: Collaborative workspaces with shared threads
- **Mentionable Documents**: Upload and reference documents with @-mentions
- **MCP Integration**: Model Context Protocol support for tool use
- **Flexible Authentication**: Email/password, OAuth (Google, GitHub), Magic Links
- **Subscription Payments**: Stripe integration with monthly plans
- **Theming**: Light/dark mode with full customization via CSS variables
- **Extensible**: Registry pattern for custom agents, payment plans, and pages

## Screenshot

![chaaskit dark mode screenshot](public/dark_screenshot.png)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React Router v7 (framework mode) |
| Frontend | React + TypeScript |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL + Prisma |
| Auth | JWT + Passport.js |
| Payments | Stripe |
| AI | Anthropic SDK + OpenAI SDK |
| Styling | Tailwind CSS + CSS Variables |
| Packages | pnpm workspaces |

---

## Quick Start

### Prerequisites

- **Node.js** 18 or higher
- **pnpm** 8 or higher (recommended) or npm/yarn
- **PostgreSQL** 14 or higher

### Local Demo (Monorepo)

If you’re working in this monorepo, there’s a persistent demo app in `examples/demo` wired to local workspace packages.

```bash
pnpm install
cp examples/demo/.env.example examples/demo/.env
pnpm --filter chaaskit-demo db:push
pnpm dev:demo
```

### Publishing (GitHub Actions + npm OIDC)

This repo uses Changesets and npm Trusted Publishing (OIDC) for releases.

Setup:
- Configure each package as a Trusted Publisher in npm (workflow file: `changesets-release.yml`).
- Ensure the GitHub Actions workflow has `id-token: write` permissions (already set).
- No `NPM_TOKEN` secret is required when using OIDC.

Release flow:
1. Run `pnpm changeset` and select a patch bump (`0.1.2` from `0.1.1`).
2. Commit and push to `main`.
3. GitHub Actions opens a “Version Packages” PR.
4. Merge that PR to publish to npm via OIDC.

### 1. Create a New Project

```bash
# Create a new ChaasKit project
npx chaaskit create my-app
cd my-app
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Database (required)
DATABASE_URL="postgresql://user:password@localhost:5432/my_app"

# Auth secrets (required - generate with: openssl rand -base64 32)
SESSION_SECRET="your-session-secret-min-32-chars-long"
JWT_SECRET="your-jwt-secret-min-32-chars-long"

# AI Provider (at least one required)
ANTHROPIC_API_KEY="sk-ant-..."
# OPENAI_API_KEY="sk-..."

# App URLs (optional in development)
APP_URL="http://localhost:5173"
API_URL="http://localhost:3000"
```

### 3. Set Up Database

```bash
# Push schema to database
pnpm db:push
```

### 4. Start Development

```bash
pnpm dev
```

This starts the React Router v7 dev server with HMR at `http://localhost:5173`, which proxies API requests to the Express backend at `http://localhost:3000`.

### 5. Create Your First Account

1. Open http://localhost:5173
2. Click "Get Started" and register an account
3. Start chatting!

---

## Project Structure

When you run `npx chaaskit create`, you get a React Router v7 framework mode application:

```
my-app/
├── app/
│   ├── routes/                    # React Router v7 routes
│   │   ├── _index.tsx             # Landing page (/)
│   │   ├── login.tsx              # Login page (/login)
│   │   ├── register.tsx           # Register page (/register)
│   │   ├── chat._index.tsx        # Main chat (/chat)
│   │   ├── chat.thread.$threadId.tsx  # Thread view
│   │   ├── chat.documents.tsx     # Documents (/chat/documents)
│   │   └── ...                    # Other routes
│   ├── components/                # Client wrapper components
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
│       ├── base.prisma            # ChaasKit models (synced from package)
│       └── custom.prisma          # Your custom models
├── public/
│   ├── logo.svg                   # Your logo
│   └── favicon.svg                # Favicon
├── .env                           # Environment variables
├── server.js                      # Production server
├── tailwind.config.ts             # Theme colors and styling
├── vite.config.ts                 # Vite configuration
├── react-router.config.ts         # React Router configuration
└── package.json
```

---

## Configuration

Application settings are in `config/app.config.ts`, while theming is in `tailwind.config.ts`. Here are the key sections:

### App Info

```typescript
app: {
  name: 'My AI Assistant',
  description: 'Your helpful AI companion',
  url: 'https://myapp.com',
  basePath: '/chat',  // Chat app routes live under /chat
},
```

### AI Agent

```typescript
// Built-in provider
agent: {
  type: 'built-in',
  provider: 'anthropic',  // or 'openai'
  model: 'claude-sonnet-4-20250514',
  systemPrompt: 'You are a helpful AI assistant.',
  maxTokens: 4096,
},

// OR external agent
agent: {
  type: 'external',
  endpoint: 'https://my-agent.com/api/chat',
  headers: { 'Authorization': 'Bearer ${AGENT_API_KEY}' },
},
```

### Features

```typescript
// Enable team workspaces
teams: { enabled: true },

// Enable projects (folders for organizing conversations)
projects: {
  enabled: true,
  colors: ['#6366f1', '#8b5cf6', '#ec4899'],
},

// Enable mentionable documents
documents: {
  enabled: true,
  storage: { provider: 'database' },
},
```

### Theming

Theming is configured in `tailwind.config.ts` using the ChaasKit Tailwind preset:

```typescript
// tailwind.config.ts
import { createChaaskitPreset } from '@chaaskit/client/tailwind-preset';

export default {
  presets: [
    createChaaskitPreset({
      themes: {
        light: {
          primary: '#6366f1',
          primaryHover: '#4f46e5',
          background: '#ffffff',
          // ... see full color palette in tailwind.config.ts
        },
        dark: {
          primary: '#818cf8',
          // ...
        },
      },
      defaultTheme: 'light',
      fonts: {
        sans: "'Inter', system-ui, sans-serif",
        mono: "'JetBrains Mono', Menlo, monospace",
      },
    }),
  ],
  content: ['./app/**/*.{js,ts,jsx,tsx}', ...],
};
```

See `docs/styling.md` for styling conventions and available CSS variables.

---

## Customization Examples

### Adding a Custom Route

React Router v7 uses file-based routing. Create a new route in `app/routes/`:

```tsx
// app/routes/chat.my-page.tsx
// Creates a route at /chat/my-page

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

### Adding a Custom Agent

```typescript
// extensions/agents/my-agent.ts
import { BaseAgent, registry } from '@chaaskit/server';

export class MyAgent extends BaseAgent {
  async *chat(messages, options) {
    yield { type: 'text', content: 'Hello from custom agent!' };
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

### Adding Custom Database Models

Edit `prisma/schema/custom.prisma`:

```prisma
model MyModel {
  id        String   @id @default(cuid())
  name      String
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  createdAt DateTime @default(now())
}
```

Then apply:

```bash
pnpm db:push      # Development
pnpm db:generate  # Regenerate client
```

---

## Deployment

### Build for Production

```bash
pnpm build
```

This creates:
- `build/server/` - Server bundle for Node.js
- `build/client/` - Client assets (JS, CSS)

### Start Production Server

```bash
pnpm start
```

This runs `server.js` which starts the production server on port 3000 (or `PORT` env var). The server handles both API routes and serves the React Router v7 application.

### Docker Deployment

```dockerfile
FROM node:20-slim

RUN corepack enable pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY config/ ./config/
COPY prisma/ ./prisma/

RUN pnpm install --frozen-lockfile --prod

COPY build/ ./build/
COPY server.js ./

RUN npx prisma generate --schema=./prisma/schema

EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "server.js"]
```

Build and run:

```bash
pnpm build
docker build -t my-chat-app .
docker run -p 3000:3000 --env-file .env.production my-chat-app
```

### Platform Deployments

**Railway / Render / Fly.io:**
- Build command: `pnpm install && pnpm build && npx prisma generate`
- Start command: `node server.js`

See `docs/deployment.md` for detailed instructions on each platform.

### Reverse Proxy (nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # SSE support for chat streaming
        proxy_buffering off;
        proxy_read_timeout 86400;
    }
}
```

### Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | Session encryption key (min 32 chars) |
| `JWT_SECRET` | Yes | JWT signing key (min 32 chars) |
| `ANTHROPIC_API_KEY` | * | Anthropic API key |
| `OPENAI_API_KEY` | * | OpenAI API key |
| `APP_URL` | No | Frontend URL (default: `http://localhost:5173`) |
| `API_URL` | No | Backend URL (default: `http://localhost:3000`) |
| `PORT` | No | Server port (default: 3000) |
| `STRIPE_SECRET_KEY` | ** | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | ** | Stripe webhook secret |
| `GOOGLE_CLIENT_ID` | *** | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | *** | Google OAuth client secret |
| `GITHUB_CLIENT_ID` | *** | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | *** | GitHub OAuth client secret |

\* At least one AI provider key required
\*\* Required if payments enabled
\*\*\* Required if OAuth provider enabled in config

---

## Scripts Reference

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start development server with HMR |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:push` | Push schema to database (dev) |
| `pnpm db:migrate` | Create and run migrations (prod) |
| `pnpm db:studio` | Open Prisma Studio GUI |
| `pnpm db:sync` | Sync base.prisma from @chaaskit/db |

---

## Updating ChaasKit

When new versions are released:

```bash
# Update the packages
pnpm update @chaaskit/server @chaaskit/client @chaaskit/db @chaaskit/shared

# Sync the database schema (preserves your custom models)
pnpm db:sync

# Regenerate Prisma client and apply changes
pnpm db:generate
pnpm db:push
```

---

## Troubleshooting

### Database connection issues

- Ensure PostgreSQL is running
- Check the connection string format in `DATABASE_URL`
- Verify the database exists: `createdb my_app`

### "Module not found" errors

```bash
rm -rf node_modules
pnpm install
```

### Config not loading

The server looks for config in this order:
1. Programmatic config via `setConfig()`
2. `CHAASKIT_CONFIG_PATH` environment variable
3. `./config/app.config.ts` (relative to cwd)
4. `./config/app.config.js`
5. Default built-in config

### AI Provider errors

- Ensure the corresponding API key is set in `.env`
- Empty strings (`ANTHROPIC_API_KEY=""`) are treated as not set
- Verify the key format (Anthropic: `sk-ant-...`, OpenAI: `sk-...`)

### Streaming not working

Ensure your reverse proxy supports SSE:
```nginx
proxy_buffering off;
proxy_read_timeout 86400;
```

### Theme/hydration warnings

If you see hydration warnings about `data-theme`, ensure your `app/root.tsx` uses the cookie-based theme sync pattern.

---

## Documentation

For detailed documentation, see the `docs/` directory:

- [Installation](docs/installation.md) - Detailed setup instructions
- [Configuration](docs/configuration.md) - All configuration options
- [Development](docs/development.md) - Development workflow
- [Extensions](docs/extensions.md) - Custom agents, pages, payment plans
- [Custom Pages](docs/custom-pages.md) - Adding landing pages and marketing pages
- [MCP Integration](docs/mcp.md) - Model Context Protocol tools
- [Deployment](docs/deployment.md) - Production deployment
- [AWS Deployment](docs/deployment-aws.md) - Deploy to AWS with CDK
- [API Reference](docs/api-reference.md) - Complete REST API documentation

---

## License

MIT
