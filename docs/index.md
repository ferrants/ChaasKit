# ChaasKit Documentation

Welcome to ChaasKit - a full-stack AI chat application framework built with React Router v7 and Express.js. Create production-ready AI chat applications with authentication, team workspaces, MCP tool integration, and more.

## Quick Start

```bash
# Create a new project
npx create-chaaskit create my-app
cd my-app

# Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL and API keys

# Setup database and start development
pnpm db:push
pnpm dev
```

Your app will be available at `http://localhost:5173`.

See [Installation](./installation.md) for detailed setup instructions.

## How ChaasKit Works

ChaasKit provides a set of npm packages that work together:

```
@chaaskit/shared      # Types, validation schemas, constants
       ↓
@chaaskit/db          # Prisma database layer
       ↓
@chaaskit/server      # Express.js backend API
       ↓
@chaaskit/client      # React components and pages

create-chaaskit       # CLI scaffolding tool
```

When you run `npx create-chaaskit create`, you get a **React Router v7 framework mode** application that:

- Uses server-side rendering for public pages (login, register, shared threads)
- Provides a rich client-side chat experience with real-time streaming
- Bundles everything into a single service (no separate frontend/backend)
- Includes all authentication, theming, and routing out of the box

### Project Structure

```
my-app/
├── app/
│   ├── routes/           # React Router v7 routes
│   │   ├── _index.tsx    # Landing page
│   │   ├── login.tsx     # Login page
│   │   ├── chat._index.tsx    # Main chat (at /chat)
│   │   └── chat.thread.$threadId.tsx
│   ├── components/       # Client wrapper components
│   ├── root.tsx          # HTML shell and providers
│   └── entry.*.tsx       # Client/server entry points
├── config/
│   └── app.config.ts     # Your configuration
├── extensions/           # Custom agents, pages, payment plans
├── prisma/
│   └── schema/           # Database schema files
├── public/               # Static assets
├── server.js             # Production server
└── package.json
```

## Documentation

### Getting Started
- [Installation](./installation.md) - Create a project and configure your environment
- [Configuration](./configuration.md) - All configuration options
- [Development](./development.md) - Development workflow and tips

### Core Features
- [Authentication](./authentication.md) - Email/password, OAuth, Magic Links
- [Signup Gating and Waitlist](./authentication.md#signup-gating-and-waitlist) - Invite-only and capped signups
- [API Keys](./api-keys.md) - Programmatic API access
- [Mentionable Documents](./documents.md) - Reference documents in chat with @mentions
- [MCP Integration](./mcp.md) - Connect AI to external tools via Model Context Protocol
- [Native Tools](./native-tools.md) - Built-in tools and creating custom ones

### Team Features
- [Team Workspaces](./configuration.md#team-workspaces) - Collaborative team features
- [Projects](./configuration.md#projects) - Organize conversations into folders
- [Slack Integration](./slack.md) - Chat with your AI from Slack
- [Scheduled Prompts](./scheduled-prompts.md) - Automated prompts on a schedule

### Advanced
- [Extensions](./extensions.md) - Custom agents, payment plans, and pages
- [Custom Pages](./custom-pages.md) - Add landing pages, marketing pages, etc.
- [Job Queue](./queue.md) - Background job processing with scheduling
- [Admin Dashboard](./admin.md) - Site-wide administration
- [User Settings](./settings.md) - User settings and preferences
- [Styling Guide](./styling.md) - UI conventions and theming
- [Deployment](./deployment.md) - Deploy to production
- [AWS Deployment](./deployment-aws.md) - Deploy to AWS with CDK

### Reference
- [API Reference](./api-reference.md) - Complete REST API documentation

## Key Features

- **Multiple AI Providers**: Anthropic (Claude) and OpenAI support
- **Multi-Agent Support**: Configure multiple agents with different models
- **Real-time Streaming**: SSE-based response streaming
- **MCP Tool Integration**: Connect AI to external tools via Model Context Protocol
- **Native Tools**: Built-in tools like web scraping
- **Mentionable Documents**: Upload and reference documents with @-mentions
- **Team Workspaces**: Collaborative workspaces with shared threads
- **Projects**: Organize conversations with custom AI context
- **Slack Integration**: Chat with AI directly from Slack
- **Job Queue**: Background job processing with scheduling
- **Theming**: Light/dark mode with customizable colors
- **Authentication**: Email/password, OAuth, Magic Links
- **Signup Gating and Waitlist**: Invite-only, closed, timed, or capacity-limited signups
- **API Keys**: Programmatic API access
- **Credits and Promo Codes**: Ledger-based credits with expirations and promo codes
- **Usage Metering**: Prompt and completion token tracking
- **Payments**: Stripe integration for subscriptions
- **Search & Export**: Full-text search and chat export

## Updating ChaasKit

When new versions are released, update your project:

```bash
# Update dependencies
pnpm update @chaaskit/server @chaaskit/client @chaaskit/db @chaaskit/shared

# Sync the database schema (preserves your custom models)
pnpm db:sync

# Regenerate Prisma client
pnpm db:generate

# Push any schema changes
pnpm db:push
```

The `db:sync` command updates `prisma/schema/base.prisma` with the latest models from `@chaaskit/db` while preserving your custom models in `prisma/schema/custom.prisma`.

## Getting Help

- Check the [Troubleshooting](./installation.md#troubleshooting) section
- Review the [Configuration](./configuration.md) reference
- Look at the generated project's code for examples
