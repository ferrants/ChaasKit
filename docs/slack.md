# Slack Integration

Connect your team's Slack workspace to chat with your AI assistant directly from Slack. Team members can @mention the bot in any channel to get instant AI responses.

## Features

- **AI Chat via @mentions**: Mention your bot in any channel to get AI responses
- **Thread Continuity**: Follow-up messages in a Slack thread maintain conversation context
- **Team Notifications**: Get notified in Slack when threads are shared, messages are liked, or new members join
- **Per-Team Configuration**: Each team can connect their own Slack workspace

## Prerequisites

Before enabling Slack integration, you need:

1. **Teams feature enabled** - Slack integration requires the teams feature
2. **A Slack App** - Create one at https://api.slack.com/apps

## Creating a Slack App

### 1. Create the App

1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. Name your app and select your workspace
4. Note the **Client ID**, **Client Secret**, and **Signing Secret** from "Basic Information"

### 2. Configure Bot Token Scopes

Go to "OAuth & Permissions" and add these Bot Token Scopes:

| Scope | Purpose |
|-------|---------|
| `app_mentions:read` | Receive @mention events |
| `channels:history` | Read channel messages for thread context |
| `groups:history` | Read private channel messages |
| `im:history` | Read direct messages |
| `chat:write` | Send messages as the bot |
| `reactions:write` | Add reactions (processing indicators) |
| `users:read` | Look up user information |

### 3. Enable Event Subscriptions

1. Go to "Event Subscriptions"
2. Turn on "Enable Events"
3. Set the Request URL to: `{API_URL}/api/slack/events` (e.g., `https://api.your-app.com/api/slack/events`)
4. Subscribe to these bot events:
   - `app_mention` - When someone @mentions your bot
   - `message.channels` - Messages in public channels (optional, for DM support)
   - `message.groups` - Messages in private channels (optional)
   - `message.im` - Direct messages to the bot (optional)

### 4. Set OAuth Redirect URL

1. Go to "OAuth & Permissions"
2. Add a Redirect URL: `{API_URL}/api/slack/callback` (e.g., `https://api.your-app.com/api/slack/callback`)

### Sample App Manifest

You can use this manifest as a starting point when creating your Slack app. Go to "App Manifest" in your app settings and paste this JSON (update the URLs to match your deployment):

```json
{
  "display_information": {
    "name": "My AI Assistant",
    "description": "Chat with AI directly in Slack",
    "background_color": "#6366f1"
  },
  "features": {
    "app_home": {
      "messages_tab_enabled": true,
      "messages_tab_read_only_enabled": false
    },
    "bot_user": {
      "display_name": "AI Assistant",
      "always_online": true
    }
  },
  "oauth_config": {
    "redirect_urls": [
      "https://api.your-app.com/api/slack/callback"
    ],
    "scopes": {
      "bot": [
        "app_mentions:read",
        "channels:history",
        "groups:history",
        "im:history",
        "chat:write",
        "reactions:write",
        "users:read"
      ]
    }
  },
  "settings": {
    "event_subscriptions": {
      "request_url": "https://api.your-app.com/api/slack/events",
      "bot_events": [
        "app_mention",
        "message.channels",
        "message.groups",
        "message.im"
      ]
    },
    "org_deploy_enabled": false,
    "socket_mode_enabled": false,
    "token_rotation_enabled": false
  }
}
```

**Note**: Replace `api.your-app.com` with your actual API domain (the value of `API_URL`). Both the `request_url` and `redirect_urls` must be publicly accessible.

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
SLACK_CLIENT_ID=your-client-id
SLACK_CLIENT_SECRET=your-client-secret
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_INTERNAL_SECRET=any-random-secret-for-internal-calls
```

Generate the internal secret with:
```bash
openssl rand -hex 32
```

### App Configuration

Enable Slack in your `config/app.config.ts`:

```typescript
import type { AppConfig } from '@chaaskit/shared';

export const config: AppConfig = {
  // ... other config

  teams: {
    enabled: true,  // Required for Slack
  },

  slack: {
    enabled: true,
    clientIdEnvVar: 'SLACK_CLIENT_ID',
    clientSecretEnvVar: 'SLACK_CLIENT_SECRET',
    signingSecretEnvVar: 'SLACK_SIGNING_SECRET',
    internalSecretEnvVar: 'SLACK_INTERNAL_SECRET',

    // Optional: Restrict to specific plans
    allowedPlans: ['pro', 'enterprise'],

    // AI chat settings
    aiChat: {
      enabled: true,
      threadContinuity: true,  // Maintain context across Slack thread replies
    },

    // Team notifications
    notifications: {
      events: [
        { event: 'thread_shared', enabled: true },
        { event: 'message_liked', enabled: true },
        { event: 'team_member_joined', enabled: true },
      ],
    },
  },
};
```

## Connecting a Team

Once configured, team admins can connect Slack from the Team Settings page:

1. Go to Team Settings
2. Find the "Slack Integration" section
3. Click "Add to Slack"
4. Authorize the app in your Slack workspace
5. You'll be redirected back with a success message

## Using the Bot

### Basic Usage

Mention the bot in any channel:

```
@YourBot What's the weather like today?
```

The bot will:
1. Add an 👀 reaction to show it's processing
2. Generate a response using your AI agent
3. Reply in a thread
4. Replace the 👀 with ✅ when complete

**Note:** The bot only responds to messages that @mention it. Regular channel messages without an @mention are ignored.

### Thread Continuity

Once you've @mentioned the bot, you can continue the conversation in the thread **without** needing to @mention it again:

```
User: @YourBot Explain quantum computing
Bot: Quantum computing uses quantum bits (qubits)...

User: Can you give me an example?
Bot: Sure! A classic example is Shor's algorithm...
```

The bot automatically responds to all messages in threads where it has been mentioned, maintaining context from the conversation.

### Response Formatting

The bot formats responses using Slack's mrkdwn syntax, so you'll see proper formatting for bold text, code blocks, lists, and links.

### Context from Your App

The bot uses the same AI agent and team context as your web app. If you've configured team context in Team Settings, it will be included in Slack conversations.

## Notifications

When enabled, your team's Slack channel will receive notifications for:

| Event | Notification |
|-------|--------------|
| Thread Shared | When a team member shares a conversation |
| Message Liked | When someone gives positive feedback on an AI response |
| Member Joined | When a new member joins the team |

### Configuring Notification Channel

1. Go to Team Settings → Slack Integration
2. Enter the notification channel (e.g., `#general`)
3. Click "Save Settings"

## Architecture

### Event Flow

```
1. User @mentions bot in Slack
2. Slack sends event to /api/slack/events
3. Server verifies signature, stores event, responds 200 OK (within 3s)
4. Server triggers /api/slack/internal/process asynchronously
5. Event processor:
   - Fetches Slack thread history for context
   - Finds/creates internal thread for continuity
   - Calls AI agent with conversation
   - Posts response back to Slack
```

### Data Storage

| Model | Purpose |
|-------|---------|
| `SlackIntegration` | Stores team's Slack connection (workspace ID, encrypted tokens, settings) |
| `SlackMessageEvent` | Tracks incoming events for deduplication and retry |

Tokens are encrypted at rest using AES-256-GCM.

### Retry Logic

Failed events are automatically retried:
- Events stuck in "pending" or "processing" for >3 minutes are retried
- Maximum 3 retry attempts per event
- Use `POST /api/slack/internal/retry` to trigger retry (requires internal secret)

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/slack/install/:teamId` | GET | User (Admin) | Start OAuth flow |
| `/api/slack/callback` | GET | None | OAuth callback |
| `/api/slack/:teamId/status` | GET | User (Viewer+) | Get integration status |
| `/api/slack/:teamId/settings` | PATCH | User (Admin) | Update settings |
| `/api/slack/:teamId` | DELETE | User (Admin) | Disconnect Slack |
| `/api/slack/events` | POST | Slack Signature | Receive Slack events |
| `/api/slack/internal/process` | POST | Internal Secret | Process an event |
| `/api/slack/internal/retry` | POST | Internal Secret | Retry stale events |

## Troubleshooting

### Bot doesn't respond

1. Check that your Slack app has the required scopes
2. Verify Event Subscriptions URL is correct and verified
3. Check server logs for errors
4. Ensure the team has Slack connected (check Team Settings)

### "Invalid signature" errors

- Verify `SLACK_SIGNING_SECRET` matches your Slack app's signing secret
- Ensure raw request body is being used for signature verification

### Events timing out

Slack requires a response within 3 seconds. The integration handles this by:
1. Quickly acknowledging the event
2. Processing asynchronously via internal endpoint

If you see timeout errors, check that `/api/slack/internal/process` is accessible from your server.

### Thread context not working

- Ensure `threadContinuity` is enabled in config
- The bot needs `channels:history` (or equivalent) scope to read thread history
- Private channels require `groups:history`

## Security Considerations

- **Token Encryption**: Slack tokens are encrypted at rest using your `SESSION_SECRET`
- **Signature Verification**: All incoming Slack requests are verified using HMAC-SHA256
- **Internal Endpoints**: Protected by a separate secret to prevent external access
- **Scope Minimization**: Only request the Slack scopes you need
