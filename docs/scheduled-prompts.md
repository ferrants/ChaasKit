# Scheduled Prompts (Automations)

Scheduled Prompts allow you to run AI prompts automatically on a schedule. Results are stored in dedicated threads and can trigger notifications via Slack and email.

## Overview

- **Schedule prompts** to run at specific times (daily, weekly, custom cron)
- **Store results** in dedicated threads for history and context
- **Get notified** via Slack or email when prompts complete
- **Team or personal** - create automations for yourself or your team

## Configuration

Enable scheduled prompts in your `config/app.config.ts`:

```typescript
export const config: AppConfig = {
  // ... other config

  scheduledPrompts: {
    enabled: true,
    featureName: 'Automations',  // Display name in UI (default: "Scheduled Prompts")
    allowUserPrompts: true,       // Allow personal automations
    allowTeamPrompts: true,       // Allow team automations
    defaultTimezone: 'UTC',

    // Plan-based limits
    planLimits: [
      { plan: 'free', maxUserPrompts: 1, maxTeamPrompts: 0 },
      { plan: 'pro', maxUserPrompts: 5, maxTeamPrompts: 10 },
      { plan: 'enterprise', maxUserPrompts: 20, maxTeamPrompts: 50 },
    ],
    defaultMaxUserPrompts: 0,  // Plans not listed get no access
    defaultMaxTeamPrompts: 0,
  },
};
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable the scheduled prompts feature |
| `featureName` | string | `"Scheduled Prompts"` | Display name in sidebar and UI |
| `allowUserPrompts` | boolean | `true` | Allow personal automations |
| `allowTeamPrompts` | boolean | `true` | Allow team automations |
| `defaultTimezone` | string | `"UTC"` | Default timezone for new prompts |
| `planLimits` | array | `[]` | Limits per subscription plan |
| `defaultMaxUserPrompts` | number | `0` | Fallback limit for unlisted plans |
| `defaultMaxTeamPrompts` | number | `0` | Fallback limit for unlisted plans |

## Email Notifications

To enable email notifications, configure the email service:

```typescript
export const config: AppConfig = {
  // ... other config

  email: {
    enabled: true,
    fromAddress: 'noreply@yourapp.com',
    fromName: 'Your App',
    providerConfig: {
      type: 'ses',
      region: 'us-east-1',
    },
  },
};
```

### AWS SES Setup

1. Install the AWS SDK:
   ```bash
   pnpm add @aws-sdk/client-ses
   ```

2. Set AWS credentials in your environment:
   ```bash
   AWS_ACCESS_KEY_ID=your-access-key
   AWS_SECRET_ACCESS_KEY=your-secret-key
   ```

3. Verify your sender email address in the [AWS SES Console](https://console.aws.amazon.com/ses/)

4. If in sandbox mode, also verify recipient email addresses

## Queue Requirement

Scheduled prompts require the [Job Queue](./queue.md) to be enabled:

```typescript
export const config: AppConfig = {
  queue: {
    enabled: true,
    providerConfig: {
      type: 'memory',  // or 'sqs' for production
    },
  },
};
```

The scheduler polls for due recurring jobs and enqueues them for execution.

## Usage

The Automations page shows prompts based on your sidebar selection:
- **Personal**: Shows your personal automations and usage (e.g., "2 of 5 used")
- **Team**: Shows the selected team's automations and usage against the team plan

### Creating a Scheduled Prompt

1. Navigate to **Automations** in the sidebar
2. Click **New Automation** (disabled if plan limit reached)
3. Fill in the form:
   - **Name**: A descriptive name (e.g., "Daily Summary")
   - **Prompt**: The prompt text to run
   - **Agent**: Which AI agent to use
   - **Schedule**: When to run (presets or custom cron)
   - **Timezone**: Your local timezone
   - **Notifications**: Enable Slack and/or email

### Schedule Presets

| Preset | Cron Expression |
|--------|-----------------|
| Every morning (9 AM) | `0 9 * * *` |
| Every evening (6 PM) | `0 18 * * *` |
| Weekdays at 9 AM | `0 9 * * 1-5` |
| Every Monday | `0 9 * * 1` |
| First of month | `0 9 1 * *` |
| Every hour | `0 * * * *` |

You can also enter custom cron expressions for more complex schedules.

### Viewing Results

Each scheduled prompt has a dedicated thread where all runs are stored:
- The prompt is sent as a user message
- The AI response is saved as an assistant message
- Previous context is maintained across runs

Click the thread link in the automation list to view the full history.

### Manual Execution

You can trigger a scheduled prompt immediately:
1. Click the **Run Now** button on any automation
2. The prompt executes with the current context
3. Results appear in the thread and trigger notifications

## API Endpoints

### List Scheduled Prompts

```http
GET /api/scheduled-prompts?personal=true    # Personal prompts only
GET /api/scheduled-prompts?teamId=team_xxx  # Team prompts only
```

Response includes usage limits:

```json
{
  "prompts": [...],
  "limits": {
    "context": "personal",  // or "team"
    "current": 2,           // Number currently configured
    "max": 5                // Maximum allowed by plan
  }
}
```

### Create Scheduled Prompt

```http
POST /api/scheduled-prompts
Content-Type: application/json

{
  "name": "Daily Summary",
  "prompt": "Summarize the key developments from today.",
  "agentId": "default",
  "schedule": "0 18 * * *",
  "timezone": "America/New_York",
  "notifySlack": true,
  "notifyEmail": true,
  "emailRecipients": ["user@example.com"],
  "teamId": "team_xxx"  // Optional, for team prompts
}
```

### Update Scheduled Prompt

```http
PUT /api/scheduled-prompts/:id
Content-Type: application/json

{
  "name": "Updated Name",
  "enabled": false
}
```

### Delete Scheduled Prompt

```http
DELETE /api/scheduled-prompts/:id
```

### Manual Run

```http
POST /api/scheduled-prompts/:id/run
```

## Slack Notifications

If your team has [Slack integration](./slack.md) configured, scheduled prompts can post results to your notification channel.

The notification includes:
- Prompt name and completion time
- Truncated result (first 500 characters)
- Link to view the full thread

## Database Schema

The feature adds a `ScheduledPrompt` model:

```prisma
model ScheduledPrompt {
  id              String    @id @default(cuid())
  name            String
  prompt          String    @db.Text
  agentId         String?
  schedule        String
  timezone        String    @default("UTC")
  enabled         Boolean   @default(true)
  notifySlack     Boolean   @default(true)
  notifyEmail     Boolean   @default(false)
  emailRecipients String?   @db.Text
  threadId        String?
  userId          String?
  teamId          String?
  lastRunAt       DateTime?
  lastRunStatus   String?
  lastError       String?
  runCount        Int       @default(0)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

## Troubleshooting

### Prompt not running

1. Check that the queue is enabled and processing jobs
2. Verify the prompt is enabled (not toggled off)
3. Check the `lastError` field for execution errors
4. Review server logs for job handler errors

### Email not sending

1. Verify email is enabled in config
2. Check AWS credentials are set correctly
3. Confirm sender address is verified in SES
4. In SES sandbox mode, recipient must also be verified

### Slack notification not appearing

1. Confirm team has active Slack integration
2. Check notification channel is configured
3. Verify the bot has permission to post to the channel

### Plan limit reached

Users see an error when creating more prompts than their plan allows. Upgrade to a higher plan or delete unused automations.
