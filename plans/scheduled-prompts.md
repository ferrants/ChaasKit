# Scheduled Prompts (Automations) Feature

## Overview

User and team-configurable scheduled prompts that run on a schedule, create threads with results, and send notifications via Slack and email.

## Architecture

```
ScheduledPrompt (DB) ──► RecurringJob (scheduler)
         │                        │
         │                        ▼
         │              scheduled-prompt:execute
         │                        │
         │              ┌─────────┴─────────┐
         │              ▼                   ▼
         │         Run Agent           Create Thread
         │              │                   │
         │              └─────────┬─────────┘
         │                        ▼
         │              scheduled-prompt:notify
         │                        │
         └──────────────┬─────────┴─────────┐
                        ▼                   ▼
                   Slack Message       Email (new)
```

## Scope

- **Ownership**: Both users and teams can create scheduled prompts
- **Results**: Create/append to thread AND send notification
- **Notifications**: Slack + Email (email service is new)
- **UI**: Full management page with cron builder

## Database Schema

```prisma
// packages/db/prisma/schema/base.prisma

model ScheduledPrompt {
  id              String    @id @default(cuid())
  name            String                       // "Daily Summary", "Weekly Report"
  prompt          String    @db.Text           // The prompt text to run
  agentId         String?                      // Agent to use (null = default)

  // Schedule
  schedule        String                       // Cron: "0 9 * * 1-5" or interval: "every 1 day"
  timezone        String    @default("UTC")
  enabled         Boolean   @default(true)

  // Notification settings
  notifySlack     Boolean   @default(true)
  notifyEmail     Boolean   @default(false)
  emailRecipients String?   @db.Text           // JSON array of emails

  // Results storage
  threadId        String?                      // Dedicated thread for results (created on first run)
  thread          Thread?   @relation(fields: [threadId], references: [id], onDelete: SetNull)

  // Ownership (one of these must be set)
  userId          String?
  user            User?     @relation(fields: [userId], references: [id], onDelete: Cascade)
  teamId          String?
  team            Team?     @relation(fields: [teamId], references: [id], onDelete: Cascade)

  // Tracking
  lastRunAt       DateTime?
  lastRunStatus   String?                      // "success" | "failed"
  lastError       String?
  runCount        Int       @default(0)

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([userId])
  @@index([teamId])
  @@index([enabled])
}
```

Also add relations to User and Team models:
```prisma
// In User model
scheduledPrompts ScheduledPrompt[]

// In Team model
scheduledPrompts ScheduledPrompt[]
```

## Configuration

```typescript
// packages/shared/src/types/config.ts

export interface ScheduledPromptsPlanLimits {
  plan: string;                      // Plan ID to match
  maxUserPrompts?: number;           // Max prompts per user on this plan
  maxTeamPrompts?: number;           // Max prompts per team on this plan
}

export interface ScheduledPromptsConfig {
  enabled: boolean;
  featureName?: string;              // Display name: "Automations", "Scheduled Prompts" (default)
  allowUserPrompts?: boolean;        // Default: true
  allowTeamPrompts?: boolean;        // Default: true
  defaultTimezone?: string;          // Default: "UTC"
  planLimits?: ScheduledPromptsPlanLimits[];  // Limits per plan
  defaultMaxUserPrompts?: number;    // Fallback if plan not in list (default: 0)
  defaultMaxTeamPrompts?: number;    // Fallback if plan not in list (default: 0)
}

// Example config:
// scheduledPrompts: {
//   enabled: true,
//   featureName: 'Automations',
//   planLimits: [
//     { plan: 'free', maxUserPrompts: 1, maxTeamPrompts: 0 },
//     { plan: 'pro', maxUserPrompts: 5, maxTeamPrompts: 10 },
//     { plan: 'enterprise', maxUserPrompts: 20, maxTeamPrompts: 50 },
//   ],
//   defaultMaxUserPrompts: 0,  // Plans not listed get no access
//   defaultMaxTeamPrompts: 0,
// }

// Email provider configs as discriminated union (like QueueProviderConfig)
export interface SESEmailProviderConfig {
  type: 'ses';
  region: string;
  // Uses AWS credentials from environment (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
}

// Future providers can be added:
// export interface ResendEmailProviderConfig { type: 'resend'; apiKeyEnvVar: string; }
// export interface SendGridEmailProviderConfig { type: 'sendgrid'; apiKeyEnvVar: string; }

export type EmailProviderConfig = SESEmailProviderConfig; // | ResendEmailProviderConfig | ...

export interface EmailConfig {
  enabled: boolean;
  providerConfig: EmailProviderConfig;
  fromAddress: string;
  fromName?: string;
}

// Add to AppConfig
scheduledPrompts?: ScheduledPromptsConfig;
email?: EmailConfig;
```

## Implementation Phases

### Phase 1: Email Service (Foundation)
1. Add `EmailConfig` and `EmailProviderConfig` to shared types
2. Create `packages/server/src/services/email/`:
   - `types.ts` - EmailProvider interface, EmailMessage type
   - `providers/ses.ts` - AWS SES provider (uses @aws-sdk/client-ses)
   - `index.ts` - Factory and singleton (pattern matches queue provider)
3. Add `@aws-sdk/client-ses` as optional peer dependency
4. Add config defaults to loader.ts
5. Register job handler `email:send`

### Phase 2: Database & Config
1. Add `ScheduledPromptsConfig` to shared types
2. Add `ScheduledPrompt` model to Prisma schema
3. Add relations to User and Team
4. Run `pnpm db:push && pnpm db:generate`
5. Add config defaults

### Phase 3: Job Handlers
1. Create `packages/server/src/queue/handlers/scheduled-prompt.ts`:
   - `scheduled-prompt:execute` - Run prompt against agent, store result
   - `scheduled-prompt:notify` - Send Slack + email notifications
2. Register handlers on server startup
3. Create helper to sync ScheduledPrompt → RecurringJob

### Phase 4: API Endpoints
Create `packages/server/src/api/scheduled-prompts.ts`:
- `GET /api/scheduled-prompts` - List (filtered by user/team)
- `POST /api/scheduled-prompts` - Create (checks plan's `scheduledPromptsLimit`)
- `GET /api/scheduled-prompts/:id` - Get single
- `PUT /api/scheduled-prompts/:id` - Update
- `DELETE /api/scheduled-prompts/:id` - Delete
- `POST /api/scheduled-prompts/:id/run` - Manual trigger
- `GET /api/scheduled-prompts/:id/history` - Run history

**Plan limit enforcement:**
```typescript
// On create, check limit from scheduledPrompts.planLimits config
const userPlan = user.plan; // e.g., 'pro'
const config = getConfig().scheduledPrompts;
const planLimits = config.planLimits?.find(p => p.plan === userPlan);
const limit = planLimits?.maxUserPrompts ?? config.defaultMaxUserPrompts ?? 0;

const currentCount = await db.scheduledPrompt.count({ where: { userId } });
if (currentCount >= limit) {
  throw new Error(`Plan limit reached (${limit} scheduled prompts)`);
}
```

### Phase 5: Frontend UI
1. Add route and page `packages/client/src/pages/ScheduledPromptsPage.tsx`
2. Components:
   - `ScheduledPromptList` - List with enable/disable toggles
   - `ScheduledPromptForm` - Create/edit form
   - `ScheduleBuilder` - Cron/interval selector (simple presets + custom)
   - `AgentSelector` - Dropdown if multi-agent
3. Add to sidebar navigation
4. API hooks in `stores/scheduledPromptsStore.ts`

### Phase 6: Sync & Lifecycle
1. On server startup: sync enabled ScheduledPrompts to RecurringJobs
2. On create/update: upsert RecurringJob
3. On delete/disable: remove RecurringJob
4. Handle agent deletion (fallback to default)

## File Structure

```
packages/server/src/
├── services/
│   └── email/
│       ├── index.ts           # Factory, getEmailProvider(), createEmailProvider()
│       ├── types.ts           # EmailProvider interface, EmailMessage type
│       └── providers/
│           └── ses.ts         # AWS SES implementation
├── api/
│   └── scheduled-prompts.ts   # CRUD endpoints
└── queue/
    └── handlers/
        └── scheduled-prompt.ts # Job handlers

packages/client/src/
├── pages/
│   └── ScheduledPromptsPage.tsx
├── components/
│   └── scheduled-prompts/
│       ├── ScheduledPromptList.tsx
│       ├── ScheduledPromptForm.tsx
│       ├── ScheduleBuilder.tsx
│       └── AgentSelector.tsx
└── stores/
    └── scheduledPromptsStore.ts
```

## Email Provider Interface

```typescript
// packages/server/src/services/email/types.ts

export interface EmailMessage {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<{ messageId: string }>;
  close(): Promise<void>;
}

// packages/server/src/services/email/index.ts

export async function createEmailProvider(config: EmailProviderConfig): Promise<EmailProvider> {
  switch (config.type) {
    case 'ses':
      // Dynamic import - @aws-sdk/client-ses is optional peer dependency
      try {
        const { SESEmailProvider } = await import('./providers/ses.js');
        return new SESEmailProvider(config);
      } catch (e) {
        throw new Error(
          'SES provider requires @aws-sdk/client-ses. Install it with: pnpm add @aws-sdk/client-ses'
        );
      }
    // Future: case 'resend': ...
    // Future: case 'sendgrid': ...
    default:
      throw new Error(`Unknown email provider: ${config.type}`);
  }
}
```

## Job Handler Details

### scheduled-prompt:execute

```typescript
registerJobHandler('scheduled-prompt:execute', async (job, ctx) => {
  const { scheduledPromptId } = job.payload;

  // 1. Load ScheduledPrompt with user/team context
  const prompt = await db.scheduledPrompt.findUnique({ ... });

  // 2. Get or create dedicated thread
  let thread = prompt.thread;
  if (!thread) {
    thread = await db.thread.create({
      data: {
        title: `[Auto] ${prompt.name}`,
        userId: prompt.userId,
        teamId: prompt.teamId,
        agentId: prompt.agentId,
      }
    });
    await db.scheduledPrompt.update({ threadId: thread.id });
  }

  // 3. Create user message
  await db.message.create({
    data: { threadId: thread.id, role: 'user', content: prompt.prompt }
  });

  // 4. Run agent
  const agent = prompt.agentId ? getAgentById(prompt.agentId) : getDefaultAgent();
  const agentService = createAgentService(toAgentConfig(agent));

  const messages = await loadThreadMessages(thread.id);
  let result = '';

  for await (const chunk of agentService.chat(messages, { ... })) {
    if (chunk.type === 'text') result += chunk.content;
  }

  // 5. Save assistant message
  await db.message.create({
    data: { threadId: thread.id, role: 'assistant', content: result }
  });

  // 6. Update tracking
  await db.scheduledPrompt.update({
    where: { id: scheduledPromptId },
    data: { lastRunAt: new Date(), lastRunStatus: 'success', runCount: { increment: 1 } }
  });

  // 7. Enqueue notification
  await queue.enqueue('scheduled-prompt:notify', {
    scheduledPromptId,
    threadId: thread.id,
    result,
  });
});
```

### scheduled-prompt:notify

```typescript
registerJobHandler('scheduled-prompt:notify', async (job, ctx) => {
  const { scheduledPromptId, threadId, result } = job.payload;
  const prompt = await db.scheduledPrompt.findUnique({ include: { team: true, user: true } });

  // Slack notification
  if (prompt.notifySlack && prompt.team?.slackIntegration) {
    await sendSlackMessage(prompt.team.slackIntegration, {
      text: `*${prompt.name}* completed`,
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: truncate(result, 500) } },
        { type: 'section', text: { type: 'mrkdwn', text: `<${threadUrl}|View full thread>` } },
      ],
    });
  }

  // Email notification
  if (prompt.notifyEmail && prompt.emailRecipients) {
    const emails = JSON.parse(prompt.emailRecipients);
    const emailService = getEmailService();

    for (const email of emails) {
      await emailService.send({
        to: email,
        subject: `[${appName}] ${prompt.name} completed`,
        html: renderEmailTemplate('scheduled-prompt-result', { prompt, result, threadUrl }),
      });
    }
  }
});
```

## UI Components

### ScheduleBuilder (Simple Presets)

```tsx
const PRESETS = [
  { label: 'Every morning (9 AM)', cron: '0 9 * * *' },
  { label: 'Every evening (6 PM)', cron: '0 18 * * *' },
  { label: 'Weekdays at 9 AM', cron: '0 9 * * 1-5' },
  { label: 'Every Monday', cron: '0 9 * * 1' },
  { label: 'First of month', cron: '0 9 1 * *' },
  { label: 'Every hour', cron: '0 * * * *' },
  { label: 'Custom...', cron: 'custom' },
];

// Custom mode shows time picker + day checkboxes
```

### Sidebar Entry

Add to sidebar when feature enabled:
```tsx
{config.scheduledPrompts?.enabled && (
  <SidebarLink to="/automations" icon={ClockIcon}>
    {config.scheduledPrompts.featureName || 'Scheduled Prompts'}
  </SidebarLink>
)}
```

## API Response Types

```typescript
// packages/shared/src/types/scheduled-prompt.ts

export interface ScheduledPromptSummary {
  id: string;
  name: string;
  schedule: string;
  timezone: string;
  enabled: boolean;
  agentId: string | null;
  agentName: string;
  lastRunAt: string | null;
  lastRunStatus: 'success' | 'failed' | null;
  nextRunAt: string | null;
}

export interface ScheduledPromptDetail extends ScheduledPromptSummary {
  prompt: string;
  notifySlack: boolean;
  notifyEmail: boolean;
  emailRecipients: string[];
  threadId: string | null;
  runCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduledPromptRequest {
  name: string;
  prompt: string;
  agentId?: string;
  schedule: string;
  timezone?: string;
  notifySlack?: boolean;
  notifyEmail?: boolean;
  emailRecipients?: string[];
  teamId?: string;  // If creating for team
}
```

## Verification

1. **Email Service**: Configure Resend, send test email via API
2. **Create Prompt**: Create scheduled prompt via UI, verify RecurringJob created
3. **Manual Run**: Trigger manual run, verify thread created and notifications sent
4. **Scheduled Run**: Wait for schedule, verify automatic execution
5. **Disable/Enable**: Toggle prompt, verify RecurringJob updated
6. **Delete**: Delete prompt, verify RecurringJob removed
7. **Team Prompts**: Create team prompt, verify team members see it

## Dependencies

**New npm packages:**
- `@aws-sdk/client-ses` (optional peer dependency, like SQS)

**Environment Variables:**
```bash
# AWS credentials (same as SQS if already configured)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1  # or set in config
```

## Critical Files

- `packages/shared/src/types/config.ts` - Add ScheduledPromptsConfig, EmailConfig
- `packages/db/prisma/schema/base.prisma` - Add ScheduledPrompt model
- `packages/server/src/services/email/index.ts` - Email service factory
- `packages/server/src/api/scheduled-prompts.ts` - CRUD endpoints
- `packages/server/src/queue/handlers/scheduled-prompt.ts` - Job handlers
- `packages/client/src/pages/ScheduledPromptsPage.tsx` - Main UI
