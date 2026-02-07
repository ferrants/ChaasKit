# Wishlist

Future features and ideas for ChaasKit Template.

## Implementation Effort Summary

| Feature | Effort | Dependencies | Notes |
|---------|--------|--------------|-------|
| ~~Flexible Routing~~ | ~~Low~~ | ~~None~~ | ✅ Done |
| ~~API Key Management~~ | ~~Low~~ | ~~None~~ | ✅ Done |
| ~~OpenAI-Compatible API~~ | ~~Low~~ | ~~API Keys~~ | ✅ Done |
| ~~MCP Server~~ | ~~Medium~~ | ~~API Keys~~ | ✅ Done |
| ~~Mentionable Resources~~ | ~~Medium~~ | ~~None~~ | ✅ Done |
| ~~Slack Integration~~ | ~~Medium~~ | ~~None~~ | ✅ Done |
| ~~Job Queue~~ | ~~Medium~~ | ~~None~~ | ✅ Done - Memory & SQS providers |
| ~~Scheduled Prompts~~ | ~~Medium~~ | ~~Job Queue~~ | ✅ Done - Automations feature |
| ~~Email Service~~ | ~~Low~~ | ~~None~~ | ✅ Done - AWS SES provider |
| React Native Client | High | None | Full mobile app build |
| Webhooks | Low-Medium | Job Queue | Outbound event notifications |
| Usage Analytics Dashboard | Medium | None | Token usage, costs, trends |
| Conversation Branching | Medium | None | Fork threads, explore alternatives |
| Multi-modal Support | Medium | None | Image/audio input & generation |

---

## React Native Client

**Effort: High** | No dependencies

A React Native mobile app that works with the existing server.

- Share authentication with web client
- Native push notifications
- Offline message queuing
- Voice input support

---

## API Access & MCP Server

**Effort: Low-Medium** | No dependencies

Allow admins to enable API access to certain features and tools.

- ✅ API key management for programmatic access
- ✅ `/v1/chat/completions` endpoint (OpenAI-compatible API)
- ✅ `/v1/models` endpoint (list available agents as models)
- ✅ Expose native tools via an MCP server (with OAuth 2.1 support)
- ✅ Rate limiting and usage tracking per API key

### Config to enable OpenAI-compatible API:

```typescript
api: {
  enabled: true,
  keyPrefix: 'sk-',
  allowedPlans: ['pro', 'enterprise'],
  allowedEndpoints: [
    '/v1/models',
    '/v1/models/*',
    '/v1/chat/completions',
    // existing endpoints...
    '/api/chat',
    '/api/threads/**',
  ],
}
```

### OpenAI-Compatible Endpoints (✅ Complete)

**`GET /v1/models`** - List available models (agents)
```bash
curl -H "Authorization: Bearer sk-..." https://your-app.com/v1/models
```

**`GET /v1/models/:model`** - Get specific model info
```bash
curl -H "Authorization: Bearer sk-..." https://your-app.com/v1/models/default
```

**`POST /v1/chat/completions`** - Chat completions (streaming & non-streaming)
```bash
curl -X POST https://your-app.com/v1/chat/completions \
  -H "Authorization: Bearer sk-..." \
  -H "Content-Type: application/json" \
  -d '{
    "model": "default",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": true
  }'
```

The `model` parameter maps to agent IDs. Use `/v1/models` to list available agents.

### MCP Server (✅ Complete)

Implemented MCP server with:
- Streamable HTTP transport at `/mcp`
- OAuth 2.1 authentication (RFC 8414, RFC 7591, PKCE)
- API key authentication
- Native tools exposed via `tools/list` and `tools/call`
- Resources support via `resources/list` and `resources/read`
- Dynamic client registration for MCP clients

See `plans/mcp-server-implementation-summary.md` for full details.

---

## Slack Integration (✅ Complete)

**Effort: Medium** | No dependencies

Implemented full Slack integration for team workspaces.

### Features Implemented

- ✅ OAuth 2.0 flow for workspace connection
- ✅ Per-team Slack integration management
- ✅ AI chat via @mentions in channels
- ✅ Thread continuity (follow-ups don't need @mention)
- ✅ Slack mrkdwn formatting for responses
- ✅ Team notifications (thread shared, message liked, member joined)
- ✅ Encrypted token storage (AES-256-GCM)
- ✅ Event deduplication and retry logic
- ✅ Plan-based access control

### Config

```typescript
slack: {
  enabled: true,
  clientIdEnvVar: 'SLACK_CLIENT_ID',
  clientSecretEnvVar: 'SLACK_CLIENT_SECRET',
  signingSecretEnvVar: 'SLACK_SIGNING_SECRET',
  internalSecretEnvVar: 'SLACK_INTERNAL_SECRET',
  allowedPlans: ['pro', 'enterprise'],
  aiChat: { enabled: true, threadContinuity: true },
  notifications: {
    events: [
      { event: 'thread_shared', enabled: true },
      { event: 'message_liked', enabled: true },
      { event: 'team_member_joined', enabled: true },
    ],
  },
}
```

### Documentation

See `docs/slack.md` for full documentation including Slack app setup and manifest.

---

## Scheduled Prompts / Automations (✅ Complete)

**Effort: Medium** | Depends on: Job Queue

Implemented as "Scheduled Prompts" (configurable display name: "Automations").

### Features Implemented

- ✅ User and team-configurable scheduled prompts
- ✅ Cron-style scheduling with presets and custom expressions
- ✅ Timezone support
- ✅ Dedicated threads for result history with context continuity
- ✅ Slack notifications (when team has integration)
- ✅ Email notifications (AWS SES)
- ✅ Plan-based limits (maxUserPrompts, maxTeamPrompts per plan)
- ✅ Manual trigger option
- ✅ Enable/disable toggle
- ✅ Usage display per Personal/Team context

### Config

```typescript
scheduledPrompts: {
  enabled: true,
  featureName: 'Automations',
  planLimits: [
    { plan: 'free', maxUserPrompts: 1, maxTeamPrompts: 0 },
    { plan: 'pro', maxUserPrompts: 5, maxTeamPrompts: 10 },
  ],
},
email: {
  enabled: true,
  fromAddress: 'noreply@yourapp.com',
  providerConfig: { type: 'ses', region: 'us-east-1' },
},
```

### Documentation

See `docs/scheduled-prompts.md` for full documentation.

---

## Job Queue (✅ Complete)

**Effort: Medium** | No dependencies (foundational)

Extensible background job processing system.

### Features Implemented

- ✅ Pluggable providers (memory for dev, SQS for production)
- ✅ Job scheduling with delay support
- ✅ Recurring jobs with cron/interval expressions
- ✅ Timezone-aware scheduling
- ✅ Job handlers registry pattern
- ✅ Standalone worker mode for horizontal scaling
- ✅ Graceful shutdown

### Documentation

See `docs/queue.md` for full documentation.

---

## Flexible Routing / Marketing Site Integration

**Effort: Low** | No dependencies

Allow the chat app to run on a different route, freeing up `/` for a marketing site.

- Configure chat app base route (e.g., `/app` or `/chat`)
- Implementing project can add custom pages at `/`, `/pricing`, `/about`, etc.
- Shared layout components available for consistency
- SSR/SSG support for marketing pages

### Implementation Scope

**Config changes:**
```typescript
app: {
  basePath: '/app',  // Chat app lives under /app/*
}
```

**Tasks:**
1. Add `basePath` to AppConfig type
2. Update React Router to use `basename` prop
3. Update API proxy in vite.config.ts template
4. Export reusable layout components (Header, Footer, Container)
5. Update auth redirects to respect basePath
6. Document how to add marketing pages in implementing project

**Files to modify:**
- `packages/shared/src/types/config.ts` - Add basePath
- `packages/client/src/App.tsx` - Router basename
- `packages/client/src/index.ts` - Export layout components
- Template vite.config.ts - Dynamic proxy config

**Estimated scope:** 1-2 days

---

## Mentionable Resources (✅ Complete)

**Effort: Medium** | No dependencies

Implemented as "Mentionable Documents" - users can upload documents and reference them in chat with @-mentions.

### Features Implemented

- ✅ Document management page (`/documents`)
- ✅ Upload text, markdown, CSV, JSON files
- ✅ Scoped documents: personal (`@my/`), team (`@team/slug/`), project (`@project/slug/`)
- ✅ @-mention autocomplete in chat input
- ✅ Hybrid context injection: small docs injected, large docs via AI tools
- ✅ AI tools: `list_documents`, `read_document`, `search_in_document`, `save_document`
- ✅ File attachments in chat automatically upload as documents with @-mentions
- ✅ Configurable storage providers (database, filesystem, S3)

### Config

```typescript
documents: {
  enabled: true,
  storage: { provider: 'database' },
  maxFileSizeMB: 10,
  hybridThreshold: 1000,  // chars - smaller docs injected, larger via tools
  acceptedTypes: ['text/plain', 'text/markdown', 'text/x-markdown', 'text/csv', 'application/json'],
}
```

### Documentation

See `docs/documents.md` for full documentation.

---

## Webhooks

**Effort: Low-Medium** | Depends on: Job Queue

Outbound webhooks for external integrations.

- Configure webhook endpoints per team
- Event types: thread created, message received, automation completed, etc.
- Retry logic with exponential backoff
- Signature verification (HMAC)
- Webhook logs and delivery status

### Implementation Scope

- Add `Webhook` model (url, events, secret, teamId)
- Add `WebhookDelivery` model for logging
- Job handler `webhook:deliver` with retry
- API endpoints for webhook CRUD
- Settings UI for webhook management

---

## Usage Analytics Dashboard

**Effort: Medium** | No dependencies

Help users and admins understand AI usage patterns and costs.

- Token usage over time (input/output)
- Cost estimates per user/team/agent
- Popular prompts and agents
- Rate limit usage visualization
- Export usage reports

### Implementation Scope

- Aggregate usage data from existing Message table
- Add `/api/analytics` endpoints
- Admin dashboard page with charts
- Team-level analytics for team owners

---

## Conversation Branching

**Effort: Medium** | No dependencies

Let users fork conversations to explore alternatives without losing context.

- "Branch from here" button on any message
- Creates new thread with history up to that point
- Visual indication of branched threads
- Navigate between branches

---

## Multi-modal Support

**Effort: Medium** | No dependencies

Support for image and audio in conversations.

- Image input (upload or paste)
- Image generation (DALL-E, Stable Diffusion)
- Voice input (speech-to-text)
- Voice output (text-to-speech)
- Model-specific capability detection

---

## Other Ideas

_Add new ideas here as they come up._

- Admin impersonation (view as user for support)
- Thread templates (pre-filled conversations)
- Prompt library (save and share prompts)
- Agent A/B testing (compare responses)
- Conversation summarization
- Auto-tagging/categorization of threads


## New ideas (unsorted, needs handling)
- use hatchet for async workers
