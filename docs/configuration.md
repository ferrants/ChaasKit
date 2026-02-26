# Configuration

Application configuration is split between two files:
- `config/app.config.ts` - Controls UI, authentication, AI agent, payments, MCP, and more
- `tailwind.config.ts` - Controls theming (colors, fonts, styling)

## Configuration File

```typescript
// config/app.config.ts
import type { AppConfig } from '@chaaskit/shared';

const config: AppConfig = {
  app: { ... },
  ui: { ... },
  auth: { ... },
  agent: { ... },
  payments: { ... },
  legal: { ... },
  userSettings: { ... },
  mcp: { ... },
  sharing: { ... },
  promptTemplates: { ... },
  teams: { ... },
  projects: { ... },
  admin: { ... },
  api: { ... },
  documents: { ... },
  slack: { ... },
  queue: { ... },
  email: { ... },
  scheduledPrompts: { ... },
};

export default config;
```

## Public Config Boundary

The server exposes a client-safe config via `/api/config`. This is an allowlist of safe fields and intentionally excludes secrets, internal flags, plan IDs, and agent prompts.

If you add new config values that must be visible on the client, update the public config mapping in the server.

## Environment Variables

Required variables in `.env`:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` |
| `SESSION_SECRET` | Session encryption key (32+ chars) | `your-secret-key` |
| `JWT_SECRET` | JWT signing key (32+ chars) | `your-jwt-key` |
| `APP_URL` | Frontend URL | `http://localhost:5173` |
| `API_URL` | Backend URL | `http://localhost:3000` |

AI Provider (at least one required):

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `OPENAI_API_KEY` | OpenAI API key |

MCP (optional):

| Variable | Description |
|----------|-------------|
| `MCP_CREDENTIAL_KEY` | Encryption key for user credentials (32+ chars, falls back to SESSION_SECRET) |

Payments (optional):

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret |

OAuth (optional):

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth client secret |

Slack (optional):

| Variable | Description |
|----------|-------------|
| `SLACK_CLIENT_ID` | Slack OAuth client ID |
| `SLACK_CLIENT_SECRET` | Slack OAuth client secret |
| `SLACK_SIGNING_SECRET` | Slack request signing secret |
| `SLACK_INTERNAL_SECRET` | Random secret for internal endpoints |

Queue (optional, for SQS provider):

| Variable | Description |
|----------|-------------|
| `AWS_ACCESS_KEY_ID` | AWS access key (or use IAM role) |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key (or use IAM role) |
| `SQS_QUEUE_URL` | SQS queue URL |
| `SQS_DLQ_URL` | SQS dead letter queue URL (optional) |

## Configuration Sections

### App Info

```typescript
app: {
  name: 'AI Chat',
  description: 'Your AI assistant',
  url: process.env.APP_URL || 'http://localhost:5173',
  basePath: '/chat',  // Optional: run chat app under a path (default: /chat)
}
```

### Base Path (Marketing Site Integration)

The `basePath` option allows you to run the authenticated chat application under a sub-path (default: `/chat`), freeing up the root URL for a marketing site or other public pages.

**Default behavior** (no basePath configured):
- Chat app routes: `/chat`, `/chat/thread/:id`, etc.

**With basePath: '/chat'**:
- Chat app routes: `/chat`, `/chat/thread/:id`, `/chat/documents`, etc.
- Auth routes: `/login`, `/register` (remain at root for better UX)
- Root path `/` is free for your landing page

**Example configuration:**

```typescript
// config/app.config.ts
app: {
  name: 'My App',
  basePath: '/chat',  // Chat app lives under /chat/*
}
```

**Adding custom pages:**

With React Router v7, add pages by creating files in `app/routes/`:

```tsx
// app/routes/_index.tsx - Landing page at /
// app/routes/pricing.tsx - Pricing page at /pricing
// app/routes/about.tsx - About page at /about
// app/routes/chat._index.tsx - Main chat at /chat
```

See [Custom Pages](./custom-pages.md) for detailed examples.

**Notes:**
- The API routes (`/api/*`) are unaffected - they always live at the root
- Use `useAppPath()` hook to build paths that respect the basePath
- Shared thread links use the appropriate path (e.g., `/shared/:id`)

### UI Settings

```typescript
ui: {
  welcomeTitle: 'Welcome to AI Chat',
  welcomeSubtitle: 'How can I help you today?',
  inputPlaceholder: 'Type your message...',
  logo: '/logo.svg',  // or { light: '/logo-light.svg', dark: '/logo-dark.svg' }
  samplePrompts: [
    { label: 'Explain a concept', prompt: 'Explain quantum computing...' },
    { label: 'Write code', prompt: 'Write a function to sort...' },
  ],
}
```

### Theming

Theming is configured in `tailwind.config.ts` (not in `app.config.ts`) using the ChaasKit Tailwind preset. This allows theme colors to be processed at build time for optimal CSS generation.

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
          secondary: '#8b5cf6',
          background: '#ffffff',
          backgroundSecondary: '#f9fafb',
          sidebar: '#f3f4f6',
          textPrimary: '#111827',
          textSecondary: '#6b7280',
          textMuted: '#9ca3af',
          border: '#e5e7eb',
          inputBackground: '#ffffff',
          inputBorder: '#d1d5db',
          userMessageBg: '#6366f1',
          userMessageText: '#ffffff',
          assistantMessageBg: '#f3f4f6',
          assistantMessageText: '#111827',
          success: '#10b981',
          warning: '#f59e0b',
          error: '#ef4444',
        },
        dark: {
          primary: '#818cf8',
          // ... dark theme colors
        },
      },
      defaultTheme: 'light',
      fonts: {
        sans: "'Inter', system-ui, sans-serif",
        mono: "'JetBrains Mono', Menlo, monospace",
      },
    }),
  ],
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './node_modules/@chaaskit/client/src/**/*.{js,ts,jsx,tsx}',
    './node_modules/@chaaskit/client/dist/**/*.js',
  ],
};
```

The preset generates CSS variables for all theme colors that are used by Tailwind utilities (e.g., `bg-primary`, `text-text-primary`).

See [Styling Guide](./styling.md) for CSS variables and component styling conventions.

### AI Agent

The platform supports both single-agent and multi-agent configurations.

#### Multi-Agent Configuration (Recommended)

Configure multiple AI agents with different providers, models, and capabilities:

```typescript
agent: {
  agents: [
    // General purpose assistant - available to all users
    {
      id: 'general',
      name: 'General Assistant',
      provider: 'openai',
      model: 'gpt-4o-mini',
      systemPrompt: 'You are a helpful AI assistant.',
      maxTokens: 4096,
      isDefault: true,
      // No allowedTools = all tools available
      // No plans = available to all users
    },
    // Code expert - available to pro users only
    {
      id: 'code-expert',
      name: 'Code Expert',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      systemPrompt: 'You are an expert programmer.',
      maxTokens: 8192,
      allowedTools: ['github:*', 'filesystem:read_file'],
      plans: ['pro', 'enterprise'],
    },
    // External agent - custom endpoint
    {
      id: 'custom-agent',
      name: 'Custom Agent',
      type: 'external',
      endpoint: 'https://my-agent.example.com/chat',
      headers: { 'Authorization': 'Bearer ${CUSTOM_AGENT_KEY}' },
      plans: ['enterprise'],
    },
  ],
}
```

**Agent Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Unique identifier for the agent |
| `name` | string | Display name shown in the selector |
| `provider` | `'anthropic'` \| `'openai'` | AI provider (for built-in agents) |
| `model` | string | Model identifier (e.g., `gpt-4o-mini`, `claude-sonnet-4-20250514`) |
| `systemPrompt` | string | System prompt for the agent |
| `maxTokens` | number | Maximum tokens per response |
| `isDefault` | boolean | If true, this agent is used for new threads by default |
| `allowedTools` | string[] | Tool patterns to restrict access (optional) |
| `plans` | string[] | Plan IDs that can access this agent (optional, omit for all plans) |

**Tool Pattern Syntax:**

- `server:*` - All tools from an MCP server (e.g., `github:*`)
- `server:tool-name` - Specific MCP tool (e.g., `filesystem:read_file`)
- `native:*` - All native tools (built into the application)
- `native:tool-name` - Specific native tool (e.g., `native:web-scrape`)
- Omit `allowedTools` to allow all MCP tools (native tools are opt-in)

**Native Tools:**

Native tools are built into the application and don't require external MCP servers. They are opt-in and must be explicitly listed in `allowedTools` to be available to an agent.

| Tool | Description |
|------|-------------|
| `native:web-scrape` | Fetches a URL and returns the content as plain text. Useful for reading web pages, documentation, or articles. |

Example enabling native tools:

```typescript
{
  id: 'research-assistant',
  name: 'Research Assistant',
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  systemPrompt: 'You are a research assistant.',
  maxTokens: 8192,
  allowedTools: ['native:web-scrape', 'search:*'],  // Native web-scrape + all search server tools
}
```

See [Native Tools](./native-tools.md) for the full list of available native tools and how to create custom ones.

**Agent Selection:**

- When multiple agents are configured, a selector appears on the welcome screen
- Each thread is locked to the agent it was created with
- If only one agent is configured or available to the user, the selector is hidden

#### Legacy Single-Agent Configuration

For simpler setups, you can still use the legacy single-agent configuration:

Built-in provider:

```typescript
agent: {
  type: 'built-in',
  provider: 'anthropic',  // or 'openai'
  model: 'claude-sonnet-4-20250514',
  systemPrompt: 'You are a helpful AI assistant.',
  maxTokens: 4096,
}
```

External provider:

```typescript
agent: {
  type: 'external',
  endpoint: 'https://your-api.com/chat',
  headers: {
    'Authorization': '${API_KEY}',  // Env var substitution
  },
}
```

### Authentication

```typescript
auth: {
  methods: ['email-password', 'google', 'github', 'magic-link'],
  allowUnauthenticated: false,  // Allow anonymous chats
  magicLink: {
    enabled: true,
    expiresInMinutes: 15,
  },
  gating: {
    mode: 'open',
    inviteExpiryDays: 7,
    waitlistEnabled: true,
    windowStart: '2026-02-01T00:00:00Z',
    windowEnd: '2026-02-28T23:59:59Z',
    capacityLimit: 1000,
  },
  emailVerification: {
    enabled: true,              // Require email verification for new users
    codeLength: 6,              // Length of verification code (default: 6)
    expiresInMinutes: 15,       // Code expiration time (default: 15)
    allowResendAfterSeconds: 60, // Cooldown before resend (default: 60)
  },
}
```

#### Signup Gating

Controls who can register and whether a waitlist is available.

**Modes:**
- `open`
- `invite_only`
- `closed`
- `timed_window`
- `capacity_limit`

**Notes:**
- Invite tokens bypass gating.
- `timed_window` uses `windowStart` and `windowEnd` (ISO strings).
- `capacity_limit` uses `capacityLimit` and compares against user count.

#### Email Verification

When email verification is enabled, new users registering with email/password will need to verify their email address before accessing protected features.

**How it works:**
1. User registers with email/password
2. A 6-digit numeric code is sent to their email
3. User is redirected to the verification page
4. User enters the code to verify their email
5. After verification, user can access all features

**Graceful degradation:** If email verification is enabled but the email provider isn't configured, users are auto-verified on registration. This allows you to enable the feature in config before setting up email.

**OAuth and Magic Link users:** Users who sign in via OAuth (Google, GitHub) or magic link are automatically verified since they've already proven email ownership through those flows.

**Existing users:** When you enable email verification on an existing app, previously unverified users will be prompted to verify their email on their next protected action.

See [Authentication](./authentication.md) for full documentation on auth methods, OAuth setup, and customization.

### MCP Integration

```typescript
mcp: {
  servers: [
    // Stdio server (local process, no auth)
    {
      id: 'filesystem',
      name: 'File System',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
      enabled: true,
    },
    // Streamable HTTP with admin API key
    {
      id: 'company-tools',
      name: 'Company Tools',
      transport: 'streamable-http',
      url: 'https://tools.company.com/mcp',
      enabled: true,
      authMode: 'admin',
      adminApiKeyEnvVar: 'COMPANY_TOOLS_API_KEY',
    },
    // Streamable HTTP with user API key
    {
      id: 'openai-tools',
      name: 'OpenAI Tools',
      transport: 'streamable-http',
      url: 'https://mcp.openai.com',
      enabled: true,
      authMode: 'user-apikey',
      userInstructions: 'Enter your OpenAI API key',
    },
    // Streamable HTTP with user OAuth
    {
      id: 'github-tools',
      name: 'GitHub Tools',
      transport: 'streamable-http',
      url: 'https://github-mcp.example.com',
      enabled: true,
      authMode: 'user-oauth',
      oauth: {
        authorizationEndpoint: 'https://github.com/login/oauth/authorize',
        tokenEndpoint: 'https://github.com/login/oauth/access_token',
        clientId: '${GITHUB_MCP_CLIENT_ID}',
        clientSecretEnvVar: 'GITHUB_MCP_CLIENT_SECRET',
        scopes: ['repo', 'read:user'],
      },
      userInstructions: 'Connect your GitHub account',
    },
  ],
  allowUserServers: true,
  toolConfirmation: {
    mode: 'all',
  },
  toolTimeout: 30000,
  showToolCalls: true,  // Set to false to hide tool execution cards
  logToolDetails: false,  // Set to true to log full tool args/results
}
```

See [MCP Integration](./mcp.md) for full documentation.

### Credits and Metering

Credits are used for usage-based access. Token metering records prompt and completion tokens for supported providers.

```typescript
credits: {
  enabled: true,
  promoEnabled: true,
  expiryEnabled: true,
  tokensPerCredit: 1000,
  referralRewardCredits: 10,
  referralTriggers: {
    signup: true,
    firstMessage: true,
    paying: true,
  },
},
metering: {
  enabled: true,
  recordPromptCompletion: true,
},
```

Notes:
- Credits are granted via ledger entries and consumed FIFO by soonest expiry.
- Team credits are used when a request is in team context; otherwise personal credits are used.
- Promo codes enforce max uses, one use per user, and optional time windows.

### Payments

```typescript
payments: {
  enabled: true,
  provider: 'stripe',
  plans: [
    {
      id: 'free',
      name: 'Free',
      type: 'free',
      params: { monthlyMessageLimit: 20 },
    },
    {
      id: 'pro',
      name: 'Pro',
      type: 'subscription',
      params: {
        stripePriceId: 'price_...',
        monthlyMessageLimit: 1000,
      },
    },
  ],
}
```

### Legal

Configure required legal document links:

```typescript
legal: {
  privacyPolicyUrl: 'https://example.com/privacy',
  termsOfServiceUrl: 'https://example.com/terms',
}
```

These URLs are displayed in the registration form and footer.

### User Settings

Define custom settings fields that users can configure in their profile. These settings provide context to the AI:

```typescript
userSettings: {
  fields: [
    {
      key: 'name',
      label: 'Your Name',
      type: 'text',
      placeholder: 'Enter your name',
    },
    {
      key: 'role',
      label: 'Your Role',
      type: 'select',
      options: ['Developer', 'Designer', 'Manager', 'Other'],
    },
    {
      key: 'context',
      label: 'Additional Context',
      type: 'textarea',
      placeholder: 'Any context the AI should know about you...',
    },
  ],
}
```

**Field Types:**

| Type | Description |
|------|-------------|
| `text` | Single-line text input |
| `select` | Dropdown selection from predefined options |
| `textarea` | Multi-line text input |

See [User Settings](./settings.md) for full documentation on settings integration and MCP credentials.

### Prompt Templates

Enable reusable prompt templates with variable substitution:

```typescript
promptTemplates: {
  enabled: true,
  allowUserTemplates: true,  // Allow users to create their own templates
  builtIn: [
    {
      id: 'code-review',
      name: 'Code Review',
      prompt: 'Review this {{language}} code for best practices:\n\n{{code}}',
      variables: ['language', 'code'],
    },
    {
      id: 'explain-concept',
      name: 'Explain Concept',
      prompt: 'Explain {{concept}} in simple terms for a {{audience}}.',
      variables: ['concept', 'audience'],
    },
  ],
}
```

Templates use `{{variable}}` syntax for substitution. Users fill in the variables when using a template.

### Admin Dashboard

Configure admin access for site-wide management:

```typescript
admin: {
  emails: [
    'admin@example.com',
    'another-admin@example.com',
  ],
}
```

Users whose email addresses are in this list have access to the admin dashboard with user management, team management, and usage analytics.

See [Admin Dashboard](./admin.md) for full documentation.

### API Keys

Enable programmatic API access via API keys:

```typescript
api: {
  enabled: true,
  keyPrefix: 'myapp-',                    // Optional, default: "sk-"
  allowedPlans: ['pro', 'enterprise'],    // Optional: restrict to specific plans
  allowedEndpoints: [                     // Required: whitelist endpoints
    '/api/chat',
    '/api/threads',
    '/api/threads/*',
    '/api/threads/**',
    '/api/search',
    '/api/export/*',
  ],
}
```

**Endpoint Patterns (matched against full request path):**
- `/api/threads` - Exact match only
- `/api/threads/*` - Single path segment (e.g., `/api/threads/123`)
- `/api/threads/**` - Any depth (e.g., `/api/threads/123/messages`)

See [API Keys](./api-keys.md) for full documentation.

### Sharing

```typescript
sharing: {
  enabled: true,           // Enable thread sharing feature
  scope: 'public',         // 'public' = anyone with link, 'team' = team members only
  expirationOptions: ['1h', '24h', '7d', '30d', 'never'],
}
```

See [Thread Sharing](#thread-sharing) below for more details.

## Config API Endpoint

The frontend loads configuration from the server via `/api/config`:

```http
GET /api/config
```

Response includes client-safe configuration (excludes sensitive server-side settings like API keys).

This allows the frontend to stay in sync with `config/app.config.ts` without hardcoding values.

## Hot Reloading

The backend watches the config directory and auto-restarts on changes:

```bash
# In package.json (server)
"dev": "tsx watch --watch=../../config src/index.ts"
```

## Type Safety

The configuration is fully typed. Import types from `@chaaskit/shared`:

```typescript
import type { AppConfig, AgentConfig, MCPConfig } from '@chaaskit/shared';
```

## Thread Sharing

Thread sharing allows users to create read-only links to share conversations with others.

### Configuration

```typescript
sharing: {
  enabled: false,          // Set to true to enable sharing
  scope: 'public',         // Who can view shared links
  expirationOptions: ['1h', '24h', '7d', '30d', 'never'],
}
```

### Scope Options

| Scope | Description |
|-------|-------------|
| `public` | Anyone with the link can view the conversation |
| `team` | Only authenticated users who share a team with the thread owner can view |

### How It Works

1. **Creating a share**: Users click "Share" in the sidebar when viewing a conversation
2. **Choose expiration**: Select how long the link should remain active
3. **Copy link**: The shareable URL is automatically copied to clipboard
4. **Managing shares**: Users can view active shares and revoke them at any time

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/share/:threadId` | Create a shareable link |
| `GET` | `/api/share/thread/:threadId` | List active shares for a thread |
| `GET` | `/api/share/view/:shareId` | View a shared thread (public or team-scoped) |
| `DELETE` | `/api/share/:shareId` | Revoke a share link |

### Shared Thread Page

Shared threads are viewable at `/shared/:shareId`. The page displays:
- Thread title and messages (read-only)
- App branding with link to sign up
- Appropriate error messages for expired or inaccessible links

### Team Scope Behavior

When `scope: 'team'`:
- Viewers must be authenticated
- Viewers must be a member of the thread's team
- Unauthenticated users see "Please sign in to view this shared conversation"
- Users without team access see "You don't have access to this conversation"

## Team Workspaces

Team workspaces allow users to collaborate on conversations within shared team contexts.

### Configuration

```typescript
teams: {
  enabled: true,  // Set to false to disable team workspaces (personal only)
}
```

### Enabling/Disabling Teams

| Setting | Behavior |
|---------|----------|
| `enabled: true` | Team selector shown in sidebar, team settings accessible, team threads supported |
| `enabled: false` | Team features completely hidden, API endpoints blocked, personal workspaces only |

When teams are disabled:
- Team selector is hidden from the sidebar
- Team settings page redirects to home
- All `/api/teams/*` endpoints return 403 Forbidden
- `teamId` parameter is ignored in chat requests
- Team context is not sent to the AI agent
- Existing team data is preserved (can re-enable later)

### Team Features

**Team Selector**: Users can switch between personal workspace and team workspaces in the sidebar.

**Team Roles**:

| Role | Permissions |
|------|-------------|
| `owner` | Full control, can archive team, manage all members |
| `admin` | Can invite/remove members, edit team settings, create threads |
| `member` | Can create and participate in team threads |
| `viewer` | Can view team threads (read-only) |

**Team Context**: Admins and owners can set team-wide context that is automatically included in all team conversations. This is useful for:
- Project guidelines and coding standards
- Company policies or preferences
- Domain-specific knowledge
- Team conventions

The team context is combined with user context when sent to the AI:

```
Team context:
<team context here>

User context:
<user context here>
```

### URL-Based Team Selection

Team selection is persisted via URL query parameter (`?team=<teamId>`), enabling:
- Bookmarkable team-specific URLs
- Shareable links that open in the correct team context
- Persistence across page reloads

Priority: URL parameter > localStorage

### Team Settings Page

Accessible at `/team/:teamId/settings` for team members. Features include:
- **Team Name**: Editable by admins and owners
- **Team Context**: AI context editable by admins and owners
- **Invite Members**: Send email invitations (admins and owners)
- **Manage Members**: Update roles, remove members (admins and owners)
- **Danger Zone**: Archive team (owner) or leave team (members)

### API Endpoints

| Method | Endpoint | Description | Required Role |
|--------|----------|-------------|---------------|
| `GET` | `/api/teams` | List user's teams | Authenticated |
| `POST` | `/api/teams` | Create a new team | Authenticated |
| `GET` | `/api/teams/:teamId` | Get team details | Team member |
| `PATCH` | `/api/teams/:teamId` | Update team name/context | Admin |
| `POST` | `/api/teams/:teamId/archive` | Archive team | Owner |
| `POST` | `/api/teams/:teamId/invite` | Invite a member | Admin |
| `DELETE` | `/api/teams/:teamId/invite/:inviteId` | Cancel invite | Admin |
| `POST` | `/api/teams/:teamId/leave` | Leave team | Member (not owner) |
| `DELETE` | `/api/teams/:teamId/members/:userId` | Remove member | Admin |
| `PATCH` | `/api/teams/:teamId/members/:userId` | Update member role | Owner |
| `POST` | `/api/teams/accept-invite/:token` | Accept invitation | Authenticated |

### Database Schema

Teams are stored with the following structure:

```prisma
model Team {
  id         String       @id @default(cuid())
  name       String
  context    String?      // AI context for team conversations
  archivedAt DateTime?    // null = active, set = archived
  members    TeamMember[]
  threads    Thread[]
  invites    TeamInvite[]
  createdAt  DateTime     @default(now())
  updatedAt  DateTime     @updatedAt
}

model TeamMember {
  id        String   @id @default(cuid())
  teamId    String
  userId    String
  role      String   // 'owner' | 'admin' | 'member' | 'viewer'
  team      Team     @relation(...)
  user      User     @relation(...)
  createdAt DateTime @default(now())
}
```

## Projects

Projects allow users to organize conversations into folders with shared AI context. Projects can be personal or team-based, with configurable sharing settings.

### Configuration

```typescript
projects: {
  enabled: true,  // Set to false to disable projects feature
  colors: [       // Preset colors for project folders
    '#ef4444',    // red
    '#f97316',    // orange
    '#eab308',    // yellow
    '#22c55e',    // green
    '#14b8a6',    // teal
    '#3b82f6',    // blue
    '#8b5cf6',    // purple
    '#ec4899',    // pink
  ],
}
```

### Enabling/Disabling Projects

| Setting | Behavior |
|---------|----------|
| `enabled: true` | Project folders shown in sidebar, create/edit project buttons visible |
| `enabled: false` | Project features completely hidden, API endpoints blocked, threads have no project association |

When projects are disabled:
- Project folders are hidden from the sidebar
- "New Project" button is hidden
- All `/api/projects/*` endpoints return 403 Forbidden
- `projectId` parameter is ignored in thread creation
- Project context is not sent to the AI agent
- Existing project data is preserved (can re-enable later)

### Project Features

**Project Folders**: Display in the sidebar with collapsible thread lists. Each project shows a colored folder icon and thread count.

**Project Context**: Each project can have AI context that is automatically included in all conversations within the project. This is combined with team and user context in the following order:

```
Team context:
<team context here>

Project context:
<project context here>

User context:
<user context here>
```

**Project Colors**: Projects are assigned a color from the configured preset list, displayed as a colored folder icon.

### Project Sharing

Projects can be personal (private) or team-based with configurable sharing:

| Sharing | Description |
|---------|-------------|
| `private` | Only the project creator can see the project and its threads |
| `team` | All team members can see and contribute to the project |

Personal projects (no team association) are always private to the creator.

### Project Hierarchy

- **Personal Projects**: Created without a team, visible only to the creator
- **Team Projects**: Created within a team context, can be private or team-shared
- **Thread Assignment**: Threads belong to exactly one project (or no project). Threads cannot be moved between projects after creation.

### Project Archiving

When a project is archived:
- The project is hidden from the sidebar
- All threads within the project are also archived
- Archived data is preserved (can be restored if needed via database)

### Permissions

| Action | Personal Project | Team Project (Private) | Team Project (Team-shared) |
|--------|-----------------|----------------------|---------------------------|
| View | Creator only | Creator only | All team members |
| Create threads | Creator | Creator | Team members (except viewers) |
| Edit project | Creator | Creator | Owner/Admin |
| Archive project | Creator | Creator | Owner/Admin |

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/projects` | List user's accessible projects |
| `GET` | `/api/projects?teamId=<id>` | List projects for a specific team |
| `POST` | `/api/projects` | Create a new project |
| `GET` | `/api/projects/:projectId` | Get project details |
| `PATCH` | `/api/projects/:projectId` | Update project name/context/sharing |
| `POST` | `/api/projects/:projectId/archive` | Archive project and its threads |

### Database Schema

Projects are stored with the following structure:

```prisma
model Project {
  id         String    @id @default(cuid())
  name       String
  context    String?   // AI context for project threads
  color      String    // Hex color from preset list
  sharing    String    @default("private") // 'private' | 'team'
  userId     String    // Creator
  teamId     String?   // Optional team association
  threads    Thread[]
  archivedAt DateTime? // null = active, set = archived
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
}

model Thread {
  id         String    @id @default(cuid())
  title      String
  projectId  String?   // Optional project association
  project    Project?  @relation(...)
  archivedAt DateTime? // null = active, set = archived
  // ... other fields
}
```

### User Interface

**Sidebar Behavior**:
- Project folders are collapsible - click to expand/collapse
- Threads within projects are displayed nested under the folder
- The currently viewed thread is highlighted with a subtle background
- Threads without a project appear in an "Other Threads" section

**Project Context Bar**:
When creating a new chat within a project or viewing a thread that belongs to a project, a context bar appears at the top of the chat pane showing:
- The project's colored folder icon
- The project name
- For new chats: "New chat will be added to this project"

**Thread-Driven Selection**:
- Viewing a thread automatically updates the project context to match the thread's project
- Clicking the main "New Chat" button clears any project selection
- Clicking the "+" button on a project folder creates a new chat within that project

---

## Documents

Mentionable documents allow users to upload and reference content in chat using @-mentions.

### Configuration

```typescript
documents: {
  enabled: true,
  storage: {
    provider: 'database',  // 'database' | 'filesystem' | 's3'
    // filesystem: { basePath: './uploads/documents' },
    // s3: { bucket: 'my-bucket', region: 'us-east-1' },
  },
  maxFileSizeMB: 10,
  hybridThreshold: 1000,  // Documents under this char count are injected into context
  acceptedTypes: [
    'text/plain',
    'text/markdown',
    'text/x-markdown',
    'text/csv',
    'application/json',
  ],
}
```

### Key Features

- **Scoped documents**: Personal (`@my/`), team (`@team/slug/`), project (`@project/slug/`)
- **Hybrid access**: Small docs injected into context, large docs accessed via AI tools
- **File attachments**: Chat attachments automatically upload as documents with @-mentions
- **AI tools**: `list_documents`, `read_document`, `search_in_document`, `save_document`

See [Mentionable Documents](./documents.md) for full documentation.

---

## Slack Integration

Connect your team's Slack workspace to chat with the AI assistant via @mentions.

### Configuration

```typescript
slack: {
  enabled: true,
  clientIdEnvVar: 'SLACK_CLIENT_ID',
  clientSecretEnvVar: 'SLACK_CLIENT_SECRET',
  signingSecretEnvVar: 'SLACK_SIGNING_SECRET',
  internalSecretEnvVar: 'SLACK_INTERNAL_SECRET',

  // Optional: Restrict to specific plans
  allowedPlans: ['pro', 'enterprise'],

  aiChat: {
    enabled: true,
    threadContinuity: true,  // Maintain context across Slack thread replies
  },

  notifications: {
    events: [
      { event: 'thread_shared', enabled: true },
      { event: 'message_liked', enabled: true },
      { event: 'team_member_joined', enabled: true },
    ],
  },
}
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `SLACK_CLIENT_ID` | OAuth Client ID from your Slack app |
| `SLACK_CLIENT_SECRET` | OAuth Client Secret from your Slack app |
| `SLACK_SIGNING_SECRET` | Signing secret for request verification |
| `SLACK_INTERNAL_SECRET` | Random secret for internal endpoint auth |

### Key Features

- **AI Chat via @mentions**: Team members mention the bot in Slack to get AI responses
- **Thread Continuity**: Follow-up messages in a Slack thread maintain conversation context
- **Team Notifications**: Get notified when threads are shared, messages are liked, or members join
- **Per-Team Connection**: Each team connects their own Slack workspace

See [Slack Integration](./slack.md) for setup instructions and full documentation.

---

## Email

Transactional email support for email verification, team invitations, and notifications.

### Configuration

The SES provider requires the AWS SDK as a peer dependency. Install it first:

```bash
pnpm --filter @chaaskit/server add @aws-sdk/client-ses
```

Then configure the email provider in `config/app.config.ts`:

```typescript
email: {
  enabled: true,
  providerConfig: {
    type: 'ses',
    region: 'us-east-1',
  },
  fromAddress: 'noreply@example.com',
  fromName: 'My App',
}
```

### AWS Credentials

The SES provider uses the AWS SDK's default credential chain, which automatically checks (in order):

1. **Environment variables** - `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
2. **Shared credentials file** - `~/.aws/credentials`
3. **ECS container credentials** - Task IAM role
4. **EC2 instance metadata** - Instance IAM role
5. **Web identity token** - For EKS pods

**For local development**, set environment variables in `.env`:
```
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

**For production on AWS**, use IAM roles (recommended):
- EC2: Attach an IAM role with SES permissions to your instance
- ECS: Configure a task IAM role with SES permissions
- Lambda: The execution role needs SES permissions

No explicit credentials are needed when using IAM roles - the SDK discovers them automatically.

### Supported Providers

Currently supported:
- **SES** (Amazon Simple Email Service)

Future providers (not yet implemented):
- Resend
- SendGrid
- Postmark

### Email Features

When email is configured, the following features are available:

| Feature | Description |
|---------|-------------|
| **Email Verification** | 6-digit codes sent to verify new user emails |
| **Team Invitations** | Invitation emails when users are invited to teams |
| **Magic Links** | Login links sent via email (existing feature) |

### Graceful Degradation

Email features gracefully handle the case where email is not configured:
- **Email Verification**: Users are auto-verified on registration
- **Team Invitations**: Invite URL is returned but no email sent
- **Magic Links**: Link is logged to console in development

This allows you to develop locally without email setup and add it when deploying.

### Testing Email

In development, when email is not configured, verification codes and invitation URLs are logged to the console:

```
[Auth] Email disabled - verification code for user@example.com: 123456
[Teams] Email disabled - invitation URL for user@example.com: http://localhost:5173/invite/abc123
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/verify-email` | Verify email with 6-digit code |
| `POST` | `/api/auth/resend-verification` | Resend verification email |

### Database Schema

```prisma
model EmailVerification {
  id        String    @id @default(cuid())
  code      String    // Hashed 6-digit code
  userId    String
  user      User      @relation(...)
  expiresAt DateTime
  usedAt    DateTime?
  attempts  Int       @default(0)  // Brute force protection
  createdAt DateTime  @default(now())
}
```

---

## Job Queue

Background job processing for async tasks, scheduled jobs, and recurring workflows.

### Configuration

```typescript
queue: {
  enabled: true,

  // Provider: 'memory' for dev, 'sqs' for production
  providerConfig: {
    type: 'memory',
    maxHistorySize: 1000,
  },
  // Or for production:
  // providerConfig: {
  //   type: 'sqs',
  //   region: 'us-east-1',
  //   queueUrl: process.env.SQS_QUEUE_URL!,
  //   deadLetterQueueUrl: process.env.SQS_DLQ_URL,
  //   visibilityTimeout: 60,
  // },

  worker: {
    mode: 'in-process',  // 'in-process' | 'standalone'
    concurrency: 5,
    pollInterval: 1000,
    shutdownTimeout: 30000,
  },

  scheduler: {
    enabled: true,
    pollInterval: 60000,
  },
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable the queue system |
| `providerConfig.type` | `'memory'` \| `'sqs'` | - | Queue backend |
| `worker.mode` | `'in-process'` \| `'standalone'` | `'in-process'` | Run workers in server process or separately |
| `worker.concurrency` | number | `5` | Concurrent jobs per worker |
| `scheduler.enabled` | boolean | `false` | Enable database-backed job scheduling |

See [Job Queue](./queue.md) for full documentation on handlers, scheduling, and production deployment.

---

## Scheduled Prompts (Automations)

Run AI prompts automatically on a schedule with notifications.

### Configuration

```typescript
scheduledPrompts: {
  enabled: true,
  featureName: 'Automations',  // Display name in UI
  allowUserPrompts: true,       // Personal automations
  allowTeamPrompts: true,       // Team automations
  defaultTimezone: 'UTC',

  // Plan-based limits
  planLimits: [
    { plan: 'free', maxUserPrompts: 1, maxTeamPrompts: 0 },
    { plan: 'pro', maxUserPrompts: 5, maxTeamPrompts: 10 },
    { plan: 'enterprise', maxUserPrompts: 20, maxTeamPrompts: 50 },
  ],
  defaultMaxUserPrompts: 0,  // Fallback for unlisted plans
  defaultMaxTeamPrompts: 0,
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable scheduled prompts |
| `featureName` | string | `"Scheduled Prompts"` | Display name in sidebar |
| `allowUserPrompts` | boolean | `true` | Allow personal automations |
| `allowTeamPrompts` | boolean | `true` | Allow team automations |
| `defaultTimezone` | string | `"UTC"` | Default timezone for new prompts |
| `planLimits` | array | `[]` | Limits per subscription plan |

**Note:** Scheduled prompts require the [Job Queue](#job-queue) to be enabled.

See [Scheduled Prompts](./scheduled-prompts.md) for full documentation on creating automations and notifications.
