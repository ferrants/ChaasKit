# API Reference

ChaasKit provides a comprehensive REST API for all functionality. All endpoints are prefixed with `/api/` unless otherwise noted.

## Authentication

Most endpoints require authentication via:
- **JWT Token**: `Authorization: Bearer <token>` header
- **Cookie**: `token` httpOnly cookie (set automatically on login)
- **API Key**: `Authorization: Bearer <api-key>` or `X-API-Key: <api-key>` header

## Rate Limiting

Global rate limit: 1000 requests per 15 minutes per IP (configurable in `app.config.ts`).

---

## Auth (`/api/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/register` | - | Register new user with email/password |
| POST | `/login` | - | Login with email/password |
| POST | `/magic-link` | - | Send magic link to email |
| GET | `/magic-link/verify` | - | Verify magic link token (`?token=`) |
| POST | `/logout` | Yes | Clear authentication session |
| GET | `/me` | Yes | Get current authenticated user |
| GET | `/oauth/:provider` | - | Redirect to OAuth provider (google/github) |
| GET | `/callback/:provider` | - | OAuth callback handler |
| POST | `/verify-email` | Yes | Verify email with 6-digit code |
| POST | `/resend-verification` | Yes | Resend email verification code |

---

## Threads (`/api/threads`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Yes | List threads (query: `teamId`, `projectId`) |
| POST | `/` | Yes | Create new thread |
| GET | `/:id` | Yes | Get thread with messages |
| PATCH | `/:id` | Yes | Update thread (rename) |
| DELETE | `/:id` | Yes | Delete thread |

---

## Chat (`/api/chat`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/` | Yes | Send message with streaming SSE response |
| POST | `/regenerate/:messageId` | Yes | Regenerate assistant message |
| POST | `/branch/:messageId` | Yes | Create new thread branching from message |
| POST | `/feedback/:messageId` | Yes | Submit feedback (thumbs up/down) |
| POST | `/confirm-tool` | Yes | Confirm or deny tool call execution |

### SSE Events (POST `/`)

The chat endpoint returns Server-Sent Events:

| Event | Data | Description |
|-------|------|-------------|
| `thread` | `{ threadId }` | New thread created |
| `start` | `{ messageId }` | Response started |
| `delta` | `{ content }` | Content chunk |
| `tool_call` | `{ toolName, args, ... }` | Tool execution |
| `tool_result` | `{ toolName, result, ... }` | Tool result |
| `done` | `{ messageId }` | Response complete |
| `error` | `{ message }` | Error occurred |

---

## User (`/api/user`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/settings` | Yes | Get user settings and preferences |
| PATCH | `/settings` | Yes | Update user settings |
| GET | `/subscription` | Yes | Get subscription and plan status |
| GET | `/usage` | Yes | Get usage info (messages, credits) |

---

## Teams (`/api/teams`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Yes | List user's teams |
| POST | `/` | Yes | Create new team |
| GET | `/:teamId` | Yes | Get team details with members |
| PATCH | `/:teamId` | Admin | Update team (name, context) |
| POST | `/:teamId/archive` | Owner | Archive team |
| POST | `/:teamId/unarchive` | Owner | Unarchive team |
| POST | `/:teamId/invite` | Admin | Invite member to team |
| GET | `/invite/:token` | - | Get invite details (public) |
| POST | `/invite/:token/accept` | Yes | Accept team invite |
| DELETE | `/:teamId/invite/:inviteId` | Admin | Cancel invite |
| DELETE | `/:teamId/members/:userId` | Admin | Remove member |
| PATCH | `/:teamId/members/:userId` | Owner | Update member role |
| POST | `/:teamId/leave` | Yes | Leave team |
| GET | `/:teamId/threads` | Yes | Get team threads |
| GET | `/:teamId/stats` | Yes | Get team statistics |

---

## Projects (`/api/projects`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Yes | List projects (query: `teamId`) |
| POST | `/` | Yes | Create new project |
| GET | `/:projectId` | Yes | Get project details |
| PATCH | `/:projectId` | Yes | Update project |
| POST | `/:projectId/archive` | Yes | Archive project |

---

## Payments (`/api/payments`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/plans` | - | Get all pricing plans |
| POST | `/checkout` | Yes | Create Stripe checkout session |
| POST | `/buy-credits` | Yes | Create credit purchase session |
| POST | `/billing-portal` | Yes | Get Stripe billing portal link |
| POST | `/team/:teamId/billing-portal` | Admin | Get team billing portal link |
| GET | `/team/:teamId/subscription` | Yes | Get team subscription info |
| POST | `/webhook` | - | Stripe webhook handler |

---

## Search (`/api/search`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Yes | Search threads and messages (query: `q`, `teamId`) |

---

## Share (`/api/share`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/:threadId` | Yes | Create shareable link |
| GET | `/view/:shareId` | - | Get shared thread (public) |
| GET | `/thread/:threadId` | Yes | Get existing shares for thread |
| DELETE | `/:shareId` | Yes | Delete shared link |

---

## Export (`/api/export`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/:threadId` | Yes | Export thread (query: `format=json|markdown`) |

---

## Templates (`/api/templates`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Yes | List prompt templates |
| POST | `/` | Yes | Create user template |
| PATCH | `/:id` | Yes | Update user template |
| DELETE | `/:id` | Yes | Delete user template |

---

## MCP Tools (`/api/mcp`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/servers` | Yes | List available MCP servers |
| GET | `/tools` | Yes | List tools from all servers |
| GET | `/servers/:serverId/tools` | Yes | List tools from specific server |
| POST | `/tools/:serverId/:toolName` | Yes | Invoke a tool |
| POST | `/servers/:serverId/connect` | Yes | Connect to server |
| POST | `/servers/:serverId/disconnect` | Yes | Disconnect from server |
| GET | `/credentials` | Yes | List credential status for servers |
| POST | `/credentials/:serverId/apikey` | Yes | Set API key for server |
| DELETE | `/credentials/:serverId` | Yes | Remove credential |
| GET | `/oauth/:serverId/authorize` | Yes | Start OAuth flow for server |
| GET | `/oauth/callback` | Yes | OAuth callback handler |

---

## Agents (`/api/agents`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Yes | List agents available to user |

---

## Admin (`/api/admin`)

All admin endpoints require `isAdmin: true` on the user.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/stats` | Dashboard stats (users, teams, threads, messages) |
| GET | `/usage` | Usage data over time with token counts |
| GET | `/feedback` | Feedback stats and recent feedback |
| GET | `/users` | Paginated user list (query: `search`, `page`) |
| PATCH | `/users/:userId` | Update user (isAdmin, plan) |
| GET | `/teams` | Paginated team list (query: `search`, `page`) |
| GET | `/teams/:teamId` | Team details with members |

---

## API Keys (`/api/api-keys`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Yes | List user's API keys (masked) |
| POST | `/` | Yes | Create new API key |
| DELETE | `/:keyId` | Yes | Delete API key |
| GET | `/access` | Yes | Check if user can access API keys |

---

## Documents (`/api/documents`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Yes | List documents (query: `scope`, `teamId`, `projectId`) |
| POST | `/` | Yes | Create document with text content |
| POST | `/upload` | Yes | Upload document file (multipart) |
| GET | `/:id` | Yes | Get document metadata |
| GET | `/:id/content` | Yes | Get document content |
| PATCH | `/:id` | Yes | Update document |
| DELETE | `/:id` | Yes | Delete document |

---

## Mentions (`/api/mentions`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/search` | Yes | Search mentionable resources (query: `q`, `types`) |
| POST | `/resolve` | Yes | Resolve document paths to metadata |
| GET | `/types` | Yes | Get available mention types |

---

## Slack (`/api/slack`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/install/:teamId` | Yes | Initiate Slack OAuth flow |
| GET | `/callback` | - | Slack OAuth callback |
| GET | `/:teamId/status` | Yes | Get integration status |
| DELETE | `/:teamId` | Admin | Disconnect Slack |
| PATCH | `/:teamId/settings` | Admin | Update Slack settings |
| POST | `/events` | - | Slack events webhook |

---

## Scheduled Prompts (`/api/scheduled-prompts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Yes | List prompts (query: `teamId`, `personal`) |
| GET | `/:id` | Yes | Get single prompt |
| POST | `/` | Yes | Create new prompt |
| PUT | `/:id` | Yes | Update prompt |
| DELETE | `/:id` | Yes | Delete prompt |
| POST | `/:id/run` | Yes | Manually trigger prompt |
| GET | `/:id/history` | Yes | Get run history |

---

## Health (`/api/health`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | - | Health status (checks DB) |
| GET | `/ready` | - | Readiness status |

---

## Config (`/api/config`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | - | Get client-safe configuration |

---

## Special Endpoints

### OpenAI-Compatible API (`/v1`)

For programmatic access using OpenAI SDK format. Requires API key authentication.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/chat/completions` | OpenAI-compatible chat completions |

### MCP Server (`/mcp`)

Server-Sent Events endpoint for external MCP clients.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/mcp` | MCP SSE connection endpoint |

---

## Error Responses

All errors follow a consistent format:

```json
{
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE"
  }
}
```

Common HTTP status codes:
- `400` - Bad Request (validation error)
- `401` - Unauthorized (not authenticated)
- `403` - Forbidden (not authorized)
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error
