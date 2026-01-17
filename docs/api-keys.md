# API Keys

API Keys allow users to access the API programmatically. This is useful for building integrations, CLI tools, or automated workflows.

## Configuration

Enable API keys in `config/app.config.ts`:

```typescript
api: {
  enabled: true,
  keyPrefix: 'myapp-',              // Optional, default: "sk-"
  allowedPlans: ['pro', 'enterprise'],  // Optional: restrict to specific plans
  allowedEndpoints: [               // Required: whitelist endpoints for API key access
    '/api/chat',
    '/api/threads',
    '/api/threads/**',
  ],
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable API key creation and management |
| `keyPrefix` | string | `"sk-"` | Prefix for generated API keys |
| `allowedPlans` | string[] | `undefined` | If set, only these plans can create keys |
| `allowedEndpoints` | string[] | `[]` | Endpoints accessible via API keys (required) |

### Endpoint Patterns

The `allowedEndpoints` array supports pattern matching:

| Pattern | Matches | Does NOT Match |
|---------|---------|----------------|
| `/api/threads` | `/api/threads` (exact) | `/api/threads/123` |
| `/api/threads/*` | `/api/threads/123` | `/api/threads/123/messages` |
| `/api/threads/**` | `/api/threads/123`, `/api/threads/123/messages` | `/api/thread` |

**Pattern Types:**
- **Exact match**: `/api/chat` - matches only that exact path
- **Single segment wildcard (`*`)**: `/api/threads/*` - matches one path segment
- **Multi-segment wildcard (`**`)**: `/api/threads/**` - matches any depth

### Example Configurations

**Minimal (chat only):**
```typescript
api: {
  enabled: true,
  allowedEndpoints: ['/api/chat'],
}
```

**Full access:**
```typescript
api: {
  enabled: true,
  allowedEndpoints: [
    '/api/chat',
    '/api/threads',
    '/api/threads/**',
    '/api/search',
    '/api/export/*',
  ],
}
```

**Restricted to pro users with custom prefix:**
```typescript
api: {
  enabled: true,
  keyPrefix: 'myapp-',
  allowedPlans: ['pro', 'enterprise'],
  allowedEndpoints: [
    '/api/chat',
    '/api/threads',
    '/api/threads/*',
  ],
}
```

## User Interface

When API keys are enabled, users can manage their keys from the Settings modal.

### Settings Modal

A link to "Manage API Keys" appears in the Settings modal for users who have access to the feature (based on `allowedPlans`).

### API Keys Page

The dedicated `/api-keys` page allows users to:

1. **View existing keys** - Shows key name, prefix, scope, creation date, last used, and expiration
2. **Create new keys** - With options for:
   - **Name**: A label for the key (e.g., "My CLI Tool")
   - **Scope**: Personal or team (if teams are enabled)
   - **Expiration**: Never, 30 days, 90 days, or 1 year
3. **Revoke keys** - Immediately invalidates a key

### Key Display

- Keys are shown with a masked prefix (e.g., `sk-a1b2c3...`)
- The full key is only displayed once at creation time
- Users must copy and securely store their key immediately

## API Key Format

Generated keys follow this format:

```
{prefix}{48 random hex characters}
```

Examples:
- Default prefix: `sk-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4`
- Custom prefix: `myapp-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4`

## Security

### Key Storage

- Keys are hashed with bcrypt before storage (like passwords)
- The full key cannot be retrieved after creation
- Only the prefix is stored in plain text for display purposes

### Key Validation

On each request:
1. The key prefix is used to find candidate keys
2. The full key is verified against the bcrypt hash
3. Expiration date is checked
4. For team-scoped keys, team membership is verified

### Endpoint Restrictions

- API keys can only access endpoints listed in `allowedEndpoints`
- If no endpoints are configured, API keys cannot access any endpoint
- Attempts to access non-whitelisted endpoints return 403 Forbidden

### Automatic Invalidation

Team-scoped keys are automatically invalidated if:
- The user is removed from the team
- The team is deleted

## Team-Scoped Keys

When teams are enabled, users can create keys scoped to a specific team.

### Behavior

| Key Scope | Behavior |
|-----------|----------|
| Personal | API requests operate as the user's personal account |
| Team | API requests use the team context (threads, projects, etc.) |

### Creating Team-Scoped Keys

1. In the "Create API Key" modal, select a team from the "Scope" dropdown
2. The user must be a member of the team to create a key for it
3. The key will have access to team resources only

### Team Context

When using a team-scoped key:
- Thread listing returns team threads
- New threads are created in the team context
- Team context is injected into AI prompts
- The `teamId` in request bodies is overridden by the key's team scope

## Using API Keys

### Authentication

Include the API key in the `Authorization` header:

```bash
curl -H "Authorization: Bearer sk-your-api-key-here" \
  https://your-app.com/api/threads
```

### Available Endpoints

The following endpoints can be enabled for API key access:

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/api/threads` | GET, POST | List threads, create new thread |
| `/api/threads/*` | GET, PATCH, DELETE | Get, update, delete a specific thread |
| `/api/threads/**` | Various | Thread sub-routes (messages, etc.) |
| `/api/chat` | POST | Send messages, streaming responses |
| `/api/search` | GET | Search threads by query |
| `/api/export/*` | GET | Export a thread (JSON, Markdown) |
| `/api/templates` | GET, POST, PATCH, DELETE | Prompt templates |
| `/api/user/settings` | GET, PATCH | User settings |
| `/api/user/usage` | GET | Usage statistics |
| `/api/projects` | GET, POST | Project management |
| `/api/projects/*` | GET, PATCH, DELETE | Specific project operations |

### Example: Create a Thread

```bash
curl -X POST \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"title": "New Thread"}' \
  https://your-app.com/api/threads
```

### Example: Send a Message

```bash
curl -X POST \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"threadId": "thread-id", "content": "Hello!"}' \
  https://your-app.com/api/chat
```

### Example: Stream Response (SSE)

```bash
curl -N \
  -H "Authorization: Bearer sk-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"threadId": "thread-id", "content": "Hello!"}' \
  https://your-app.com/api/chat
```

The response is a Server-Sent Events stream with events:
- `thread` - Thread metadata
- `start` - Message ID
- `delta` - Content chunks
- `done` - Completion signal

## API Endpoints

### List API Keys

```http
GET /api/api-keys
Authorization: Bearer <jwt-token>
```

Returns the user's API keys (masked):

```json
{
  "keys": [
    {
      "id": "key-id",
      "name": "My CLI Tool",
      "keyPrefix": "sk-a1b2c3",
      "teamId": null,
      "team": null,
      "lastUsedAt": "2024-01-15T10:30:00Z",
      "expiresAt": null,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Create API Key

```http
POST /api/api-keys
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "name": "My CLI Tool",
  "teamId": "optional-team-id",
  "expiresAt": "2024-12-31T23:59:59Z"
}
```

Returns the full key (only shown once):

```json
{
  "key": {
    "id": "key-id",
    "name": "My CLI Tool",
    "keyPrefix": "sk-a1b2c3",
    "teamId": null,
    "teamName": null,
    "createdAt": "2024-01-01T00:00:00Z",
    "expiresAt": null
  },
  "secret": "sk-a1b2c3d4e5f6..."
}
```

### Delete API Key

```http
DELETE /api/api-keys/:keyId
Authorization: Bearer <jwt-token>
```

### Check Access

```http
GET /api/api-keys/access
Authorization: Bearer <jwt-token>
```

Returns whether the user can create API keys:

```json
{
  "canAccess": true
}
```

## Error Responses

### 401 Unauthorized

```json
{"error": "Invalid API key"}
{"error": "API key expired"}
{"error": "API key invalid - no longer a team member"}
```

### 403 Forbidden

```json
{"error": "API key access is not enabled for any endpoints"}
{"error": "API key access is not allowed for this endpoint"}
{"error": "API access not available for your plan"}
{"error": "You are not a member of this team"}
```

## Database Schema

```prisma
model ApiKey {
  id           String    @id @default(cuid())
  userId       String
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  teamId       String?
  team         Team?     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  name         String
  keyPrefix    String    // First chars for display
  keyHash      String    // bcrypt hash
  lastUsedAt   DateTime?
  expiresAt    DateTime?
  createdAt    DateTime  @default(now())

  @@index([userId])
  @@index([teamId])
  @@index([keyPrefix])
}
```

## Best Practices

1. **Restrict Endpoints**: Only whitelist endpoints that are actually needed
2. **Use Plan Restrictions**: Limit API access to paid plans if appropriate
3. **Set Expiration Dates**: Encourage or require expiration for security
4. **Use Team Scoping**: For team-related integrations, use team-scoped keys
5. **Rotate Keys Regularly**: Periodically revoke and recreate keys
6. **Monitor Usage**: Check `lastUsedAt` to identify unused keys
7. **Custom Prefix**: Use a custom prefix to identify your app's keys

## Troubleshooting

### "API key access is not enabled for any endpoints"

The `allowedEndpoints` array is empty. Add the endpoints you want to allow:

```typescript
api: {
  enabled: true,
  allowedEndpoints: ['/api/chat', '/api/threads/**'],
}
```

### "API key access is not allowed for this endpoint"

The endpoint you're trying to access is not in the `allowedEndpoints` list. Add it:

```typescript
allowedEndpoints: [
  '/api/search',  // Add missing endpoint
]
```

### "API access not available for your plan"

The user's plan is not in the `allowedPlans` list. Either:
- Upgrade the user's plan
- Add their plan to `allowedPlans`
- Remove `allowedPlans` to allow all plans

### Keys not working after team removal

Team-scoped keys are invalidated when the user is removed from the team. The user needs to create a new personal key or be re-added to the team.
