# Slack Integration Project Brief

## Executive Summary

Add a Slack integration to ChaasKit Template that allows teams to interact with their AI assistant directly from Slack. Users can @mention the bot to ask questions and receive AI-powered responses, while administrators receive configurable notifications about team activity.

This integration is **team-scoped**, meaning each team can connect their own Slack workspace. The feature requires the teams feature to be enabled.

---

## Goals

1. **AI Chat in Slack**: Team members can @mention the bot in any channel to get AI responses
2. **Thread Continuity**: Follow-up messages in Slack threads maintain conversation context
3. **Notifications**: Configurable alerts for team events (shared threads, liked messages, new members)
4. **Self-Service Installation**: Team admins can install the Slack app without developer intervention
5. **Plan-Based Access Control**: Optionally restrict Slack to specific payment plans

---

## Dependencies & Requirements

### Required Features
- `teams.enabled = true` - Slack is team-scoped only
- Agent configuration - Required for AI chat functionality

### Optional Feature Dependencies
- `sharing.enabled` - Required for "thread shared" notifications
- `payments.enabled` - Required if using plan-based access restrictions

### External Requirements
- Slack App created in Slack API dashboard
- OAuth credentials (Client ID, Client Secret)
- Signing Secret for webhook verification
- Bot token scopes configured

---

## User Stories

### Team Admin
- As a team admin, I can connect my team's Slack workspace from the team settings page
- As a team admin, I can configure which notifications are sent to Slack
- As a team admin, I can disconnect the Slack integration at any time
- As a team admin, I can see the connection status and which workspace is connected

### Team Member
- As a team member, I can @mention the bot in any channel where it's invited
- As a team member, I can have multi-turn conversations in Slack threads
- As a team member, I receive notifications about relevant team activity

### App Administrator
- As an app admin, I can enable/disable Slack integration globally via config
- As an app admin, I can restrict Slack access to specific payment plans
- As an app admin, I can configure which notification types are available

---

## Configuration

### App Configuration (`config/app.config.ts`)

```typescript
slack: {
  enabled: true,

  // OAuth credentials (indirect env var references)
  clientIdEnvVar: 'SLACK_CLIENT_ID',
  clientSecretEnvVar: 'SLACK_CLIENT_SECRET',
  signingSecretEnvVar: 'SLACK_SIGNING_SECRET',
  internalSecretEnvVar: 'SLACK_INTERNAL_SECRET',

  // Optional: restrict to specific plans
  allowedPlans: ['pro', 'enterprise'],

  // AI chat configuration
  aiChat: {
    enabled: true,
    threadContinuity: true,  // Maintain context across Slack threads
  },

  // Notification configuration
  notifications: {
    events: [
      { event: 'thread_shared', enabled: true },
      { event: 'message_liked', enabled: true },
      { event: 'team_member_joined', enabled: true },
    ],
  },
},
```

### Environment Variables

```bash
# Slack App Credentials (from api.slack.com)
SLACK_CLIENT_ID=1234567890.1234567890
SLACK_CLIENT_SECRET=abcdef1234567890
SLACK_SIGNING_SECRET=abcdef1234567890

# Internal secret for self-calling endpoints (generate a random 32+ char string)
SLACK_INTERNAL_SECRET=your-random-internal-secret-here
```

### Type Definition

```typescript
export type SlackNotificationEvent = 'thread_shared' | 'message_liked' | 'team_member_joined';

export interface SlackNotificationConfig {
  event: SlackNotificationEvent;
  enabled: boolean;
}

export interface SlackConfig {
  enabled: boolean;
  clientIdEnvVar: string;
  clientSecretEnvVar: string;
  signingSecretEnvVar: string;
  internalSecretEnvVar: string;
  allowedPlans?: string[];
  aiChat?: {
    enabled: boolean;
    threadContinuity: boolean;
  };
  notifications?: {
    events: SlackNotificationConfig[];
  };
}
```

---

## Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SLACK WORKSPACE                              │
│                                                                      │
│   User: @Bot what's our monthly revenue?                            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Event webhook
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    POST /api/slack/events                           │
│                                                                      │
│   1. Verify Slack signature (HMAC-SHA256)                           │
│   2. Handle URL verification challenge (if present)                  │
│   3. Look up SlackIntegration by workspace ID                       │
│   4. Deduplicate event (check SlackMessageEvent table)              │
│   5. Insert event record with status='pending'                       │
│   6. Fire-and-forget HTTP to /api/slack/internal/process            │
│   7. Return 200 OK immediately (must be < 3 seconds)                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Async HTTP call
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│               POST /api/slack/internal/process                       │
│                                                                      │
│   1. Verify X-Slack-Internal-Secret header                          │
│   2. Atomic claim: UPDATE SET status='processing'                    │
│      WHERE id=? AND status='pending'                                │
│   3. If no rows updated → already claimed, return 200               │
│   4. Add 👀 reaction to indicate processing                          │
│   5. Fetch Slack thread history for context (if in thread)          │
│   6. Find or create internal Thread for continuity                   │
│   7. Build message history from internal Thread                      │
│   8. Invoke agent service (streaming)                                │
│   9. Post response to Slack (in thread)                              │
│  10. Update event: status='completed', processedAt=now()            │
│  11. Replace 👀 with ✅                                               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         SLACK WORKSPACE                              │
│                                                                      │
│   Bot: Based on your data, monthly revenue is $1.2M...              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Retry Mechanism

```
┌─────────────────────────────────────────────────────────────────────┐
│            POST /api/slack/internal/retry (cron or manual)          │
│                                                                      │
│   1. Verify X-Slack-Internal-Secret header                          │
│   2. Query SlackMessageEvent where:                                  │
│      - status IN ('pending', 'processing')                          │
│      - updatedAt < 3 minutes ago                                     │
│      - retryCount < 3                                                │
│   3. For each stale event:                                           │
│      - Increment retryCount                                          │
│      - Fire HTTP to /api/slack/internal/process                     │
│   4. Return count of retried events                                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### OAuth Installation Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │     │   Backend    │     │    Slack     │     │   Backend    │
│  Team Page   │     │  /install    │     │    OAuth     │     │  /callback   │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │                    │
       │ Click "Add to      │                    │                    │
       │ Slack" button      │                    │                    │
       │───────────────────>│                    │                    │
       │                    │                    │                    │
       │                    │ Validate:          │                    │
       │                    │ - User is admin    │                    │
       │                    │ - Teams enabled    │                    │
       │                    │ - Plan allowed     │                    │
       │                    │                    │                    │
       │                    │ Generate state     │                    │
       │                    │ (teamId:nonce)     │                    │
       │                    │                    │                    │
       │<───────────────────│                    │                    │
       │ Redirect to Slack  │                    │                    │
       │                    │                    │                    │
       │────────────────────────────────────────>│                    │
       │                    │                    │                    │
       │                    │                    │ User authorizes    │
       │                    │                    │ app permissions    │
       │                    │                    │                    │
       │<───────────────────────────────────────────────────────────>│
       │                    │                    │ Redirect with code │
       │                    │                    │                    │
       │                    │                    │                    │
       │                    │                    │                    │───┐
       │                    │                    │                    │   │ Exchange code
       │                    │                    │                    │   │ for tokens
       │                    │                    │<───────────────────│   │
       │                    │                    │───────────────────>│   │
       │                    │                    │                    │<──┘
       │                    │                    │                    │
       │                    │                    │                    │ Store encrypted
       │                    │                    │                    │ tokens in DB
       │                    │                    │                    │
       │<────────────────────────────────────────────────────────────│
       │                    │ Redirect to team   │                    │
       │                    │ settings with      │                    │
       │                    │ ?slack=connected   │                    │
       │                    │                    │                    │
       ▼                    ▼                    ▼                    ▼
```

---

## Database Schema

### SlackIntegration

Stores the connection between a team and their Slack workspace.

```prisma
model SlackIntegration {
  id                  String    @id @default(cuid())

  // Team relationship (one-to-one)
  teamId              String    @unique
  team                Team      @relation(fields: [teamId], references: [id], onDelete: Cascade)

  // Slack workspace info
  slackWorkspaceId    String    @unique  // Slack's team/workspace ID (T01234567)
  slackWorkspaceName  String              // Human-readable workspace name
  slackBotUserId      String              // Bot's user ID for @mention detection

  // Encrypted credentials
  encryptedTokens     String              // AES-encrypted JSON: {botToken, accessToken?}

  // Per-team settings
  notificationChannel String?             // Default channel for notifications (#general)
  aiChatEnabled       Boolean   @default(true)

  // Status tracking
  status              String    @default("active")  // 'active' | 'disconnected' | 'error'
  statusMessage       String?             // Error details if status='error'

  // Audit
  installedBy         String              // User ID who installed
  installedAt         DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  // Relations
  messageEvents       SlackMessageEvent[]

  @@index([teamId])
  @@index([slackWorkspaceId])
}
```

### SlackMessageEvent

Tracks incoming Slack events for deduplication, status tracking, and retry logic.

```prisma
model SlackMessageEvent {
  id                  String    @id @default(cuid())

  // Integration relationship
  integrationId       String
  integration         SlackIntegration @relation(fields: [integrationId], references: [id], onDelete: Cascade)

  // Slack message identifiers
  slackEventId        String    @unique   // Slack's event_id for deduplication
  slackChannelId      String              // Channel ID (C01234567)
  slackThreadTs       String?             // Parent message timestamp (for threads)
  slackMessageTs      String              // This message's timestamp
  slackUserId         String              // User who sent the message
  messageText         String?             // Original message text (for debugging)

  // Processing state
  status              String    @default("pending")  // pending|processing|completed|failed
  retryCount          Int       @default(0)
  lastError           String?             // Error message if failed

  // Internal thread linkage (for context continuity)
  internalThreadId    String?
  internalThread      Thread?   @relation(fields: [internalThreadId], references: [id], onDelete: SetNull)

  // Response tracking
  responseTs          String?             // Timestamp of bot's response message

  // Timing
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  processedAt         DateTime?

  @@index([integrationId])
  @@index([slackEventId])
  @@index([status, updatedAt])           // For retry queries
  @@index([slackChannelId, slackThreadTs]) // For thread context lookup
}
```

### Model Updates

```prisma
// Add to existing Team model
model Team {
  // ... existing fields
  slackIntegration SlackIntegration?
}

// Add to existing Thread model
model Thread {
  // ... existing fields
  slackEvents SlackMessageEvent[]
}
```

---

## API Endpoints

### Public Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/slack/install/:teamId` | Session + Team Admin | Initiates OAuth flow |
| GET | `/api/slack/callback` | None (state validation) | OAuth callback |
| GET | `/api/slack/:teamId/status` | Session + Team Member | Get integration status |
| DELETE | `/api/slack/:teamId` | Session + Team Admin | Disconnect integration |
| PATCH | `/api/slack/:teamId/settings` | Session + Team Admin | Update settings |

### Webhook Endpoint

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/slack/events` | Slack Signature | Receives all Slack events |

### Internal Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/slack/internal/process` | X-Slack-Internal-Secret | Process pending event |
| POST | `/api/slack/internal/retry` | X-Slack-Internal-Secret | Retry stale events |

### Endpoint Details

#### GET /api/slack/install/:teamId

Initiates the Slack OAuth flow.

**Validation:**
1. User must be authenticated
2. User must be team admin (owner or admin role)
3. `slack.enabled` must be true
4. `teams.enabled` must be true
5. If `slack.allowedPlans` is set, team's plan must be in the list

**Response:** Redirect to Slack OAuth authorization URL

#### POST /api/slack/events

Receives webhooks from Slack.

**Handled Event Types:**
- `url_verification` - Returns challenge for Slack to verify endpoint
- `app_mention` - User @mentioned the bot
- `message` (in threads where bot has responded) - Follow-up messages

**Response:** 200 OK (must respond within 3 seconds)

#### POST /api/slack/internal/process

Processes a single pending event.

**Request Body:**
```json
{
  "eventId": "clxyz123..."
}
```

**Processing Steps:**
1. Atomic claim (prevents duplicate processing)
2. Add 👀 reaction
3. Build context from Slack thread history
4. Find/create internal Thread
5. Invoke agent service
6. Post response to Slack
7. Update status, swap reaction to ✅

---

## File Structure

### New Files

```
packages/server/src/
├── api/
│   └── slack.ts                      # Express router with all endpoints
├── services/
│   └── slack/
│       ├── index.ts                  # Re-exports
│       ├── client.ts                 # Slack Web API wrapper
│       ├── signature.ts              # HMAC-SHA256 webhook verification
│       ├── events.ts                 # Event handlers (mention, message)
│       ├── notifications.ts          # Outbound notification service
│       └── thread-context.ts         # Thread history & context building

packages/shared/src/types/
└── slack.ts                          # Slack-specific types (or add to config.ts)
```

### Modified Files

```
packages/shared/src/types/config.ts   # Add SlackConfig interface
packages/db/prisma/schema/base.prisma # Add SlackIntegration, SlackMessageEvent
packages/server/src/app.ts       # Register slack router
packages/server/src/api/config.ts # Add slack to buildClientConfig
packages/server/src/config/loader.ts # Add slack defaults
packages/client/src/pages/TeamSettingsPage.tsx # Add Slack UI section
```

---

## Security Considerations

### Webhook Security
- **Signature Verification**: All Slack webhooks verified using HMAC-SHA256 with signing secret
- **Timestamp Validation**: Reject requests older than 5 minutes (replay attack prevention)
- **Request Body Integrity**: Signature computed over raw request body

### Token Security
- **Encryption at Rest**: Bot tokens encrypted using AES-256 via existing encryption service
- **No Token Logging**: Tokens excluded from all log output
- **Minimal Token Scope**: Request only necessary OAuth scopes

### Access Control
- **Team Scope**: Each integration tied to exactly one team
- **Admin-Only Installation**: Only team owners/admins can install or remove
- **Plan Enforcement**: Optional restriction to specific payment plans
- **Internal Endpoint Auth**: X-Slack-Internal-Secret header for self-calling endpoints

### OAuth Security
- **State Parameter**: Format `teamId:nonce` prevents CSRF attacks
- **State Validation**: Nonce stored temporarily, validated on callback
- **Secure Redirect**: Callback only redirects to app URL, not arbitrary URLs

---

## Slack App Configuration

### Required Bot Token Scopes

| Scope | Purpose |
|-------|---------|
| `app_mentions:read` | Receive @mention events |
| `channels:history` | Read channel messages for thread context |
| `groups:history` | Read private channel messages for thread context |
| `im:history` | Read DM history for thread context |
| `chat:write` | Post responses to channels |
| `reactions:write` | Add/remove emoji reactions (👀, ✅, ❌) |
| `users:read` | Get user information for context |

### Event Subscriptions

**Request URL:** `https://your-app.com/api/slack/events`

**Bot Events:**
- `app_mention` - When bot is @mentioned
- `message.channels` - Messages in public channels (for thread follow-ups)
- `message.groups` - Messages in private channels (for thread follow-ups)
- `message.im` - Direct messages to bot

### OAuth Redirect URL

`https://your-app.com/api/slack/callback`

---

## Notification Events

### thread_shared
Triggered when a team member shares a thread externally.

**Requires:** `sharing.enabled = true`

**Message Format:**
```
📤 Thread Shared
{user_name} shared "{thread_title}"
View: {share_url}
```

### message_liked
Triggered when a message receives positive feedback.

**Message Format:**
```
👍 Message Liked
{user_name} liked a response in "{thread_title}"
```

### team_member_joined
Triggered when a new member joins the team.

**Message Format:**
```
👋 New Team Member
{user_name} joined {team_name}
```

---

## Frontend UI

### Team Settings Page Addition

Add a "Slack Integration" section to `TeamSettingsPage.tsx`:

**When not connected:**
- "Add to Slack" button (styled with Slack branding)
- Brief description of capabilities
- Note about admin-only access (if viewer/member)

**When connected:**
- Connected workspace name and status indicator
- Notification toggles (per event type)
- AI chat enable/disable toggle
- Default notification channel selector
- "Disconnect" button in danger zone

**When plan not allowed:**
- Upgrade prompt with link to pricing page

---

## Error Handling

### Webhook Errors
- Invalid signature → 401 Unauthorized (logged)
- Unknown workspace → 200 OK (silently ignore, don't reveal info)
- Database error → 500 Internal Server Error (logged, Slack will retry)

### Processing Errors
- Agent timeout → Mark event failed, add ❌ reaction, log error
- Slack API error → Mark event failed, add ❌ reaction, log error
- Recoverable errors → Increment retryCount, leave for retry job

### User-Facing Errors
- OAuth failure → Redirect to team settings with error query param
- Rate limit → Return 429, Slack handles backoff
- Plan not allowed → Show upgrade prompt in UI

---

## Implementation Phases

### Phase 1: Foundation
1. Add SlackConfig type to shared package
2. Add database models (SlackIntegration, SlackMessageEvent)
3. Run migrations
4. Create signature verification service
5. Create Slack API client wrapper

### Phase 2: OAuth Flow
6. Create slack router with OAuth endpoints
7. Register router in app.ts
8. Update buildClientConfig for frontend
9. Test OAuth flow end-to-end

### Phase 3: Event Processing
10. Add webhook endpoint with signature verification
11. Add internal processing endpoint
12. Create event handler service
13. Create thread context service
14. Test @mention → response flow

### Phase 4: AI Chat Integration
15. Integrate with existing agent service
16. Implement thread continuity (internal Thread linkage)
17. Format responses for Slack (code blocks, links, etc.)
18. Test multi-turn conversations

### Phase 5: Notifications
19. Create notification service
20. Hook into existing events (share, feedback, team membership)
21. Test each notification type

### Phase 6: Frontend
22. Add Slack section to TeamSettingsPage
23. Handle OAuth success/error query params
24. Add settings controls (toggles, channel selector)
25. Style with Slack branding

### Phase 7: Polish & Reliability
26. Add retry endpoint
27. Add health check for integrations
28. Add error logging and monitoring hooks
29. Write documentation

---

## Testing Checklist

### Configuration
- [ ] Server starts with slack config enabled
- [ ] Server starts with slack config disabled
- [ ] Env var resolution works correctly

### OAuth Flow
- [ ] "Add to Slack" redirects to Slack OAuth
- [ ] Successful auth stores encrypted tokens
- [ ] Callback redirects to team settings
- [ ] State validation rejects invalid states
- [ ] Plan restriction prevents unauthorized install

### Webhook Processing
- [ ] URL verification challenge succeeds
- [ ] Invalid signature returns 401
- [ ] Valid @mention creates pending event
- [ ] Webhook returns 200 within 3 seconds
- [ ] Duplicate events are ignored

### AI Chat
- [ ] Bot responds to @mentions
- [ ] 👀 reaction added during processing
- [ ] ✅ reaction replaces 👀 on success
- [ ] ❌ reaction added on failure
- [ ] Thread continuity preserves context
- [ ] Multi-turn conversation works

### Notifications
- [ ] thread_shared sends notification
- [ ] message_liked sends notification
- [ ] team_member_joined sends notification
- [ ] Disabled notifications don't send

### Error Handling
- [ ] Failed processing retries correctly
- [ ] Max retries stops retrying
- [ ] Disconnected integration handles gracefully

### Frontend
- [ ] Shows "Add to Slack" when not connected
- [ ] Shows connected status when connected
- [ ] Disconnect removes integration
- [ ] Settings toggles update correctly
- [ ] Plan restriction shows upgrade prompt

---

## Future Enhancements

Not in scope for initial implementation, but potential future work:

1. **Slash Commands**: `/ask [question]` instead of @mentions
2. **App Home Tab**: Dashboard showing team stats in Slack
3. **File Attachments**: Process files shared with bot
4. **Scheduled Reports**: Daily/weekly AI-generated summaries
5. **Multiple Workspaces**: Allow team to connect multiple workspaces
6. **Channel-Specific Agents**: Different AI agents for different channels
