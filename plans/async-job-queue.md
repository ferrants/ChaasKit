# Extensible Async Job Queue Infrastructure

## Implementation Status: COMPLETE

All phases have been implemented:
- [x] Phase 1: Core Types & Memory Provider
- [x] Phase 2: Worker & Handlers
- [x] Phase 3: Scheduler & Recurring Jobs
- [x] Phase 4: SQS Provider
- [x] Phase 5: Standalone Worker CLI

**Files created:**
- `packages/shared/src/types/config.ts` - QueueConfig types added
- `packages/server/src/queue/types.ts` - Core interfaces
- `packages/server/src/queue/index.ts` - Factory and exports
- `packages/server/src/queue/providers/memory.ts` - Memory provider
- `packages/server/src/queue/providers/sqs.ts` - SQS provider
- `packages/server/src/queue/handlers/index.ts` - Handler registry
- `packages/server/src/queue/worker.ts` - Worker class
- `packages/server/src/queue/scheduler.ts` - Scheduler class
- `packages/server/src/queue/cli.ts` - Standalone worker CLI
- `packages/db/prisma/schema/base.prisma` - ScheduledJob, RecurringJob models

---

## Overview

Provider-agnostic job queue infrastructure supporting multiple backends (memory for dev, SQS initially, others in future) with scheduling capabilities and flexible worker deployment.

## Architecture

```
QueueConfig.providerConfig ──► QueueProvider Interface
      │                              │
      │                    ┌─────────┴─────────┐
      │                    ▼                   ▼
      │            MemoryQueueProvider   SQSQueueProvider
      │                    │                   │
      │                    └─────────┬─────────┘
      │                              ▼
      │                     Worker (processes jobs)
      │                     ├── In-process mode
      │                     └── Standalone mode
      │                              │
      │                              ▼
      │                 JobHandler Registry (type → handler)
      │                              │
      ▼                              ▼
QueueConfig.scheduler ──► Scheduler (database-backed, for long delays)
```

**Key Abstractions:**
- `QueueProvider` - Interface that all queue backends implement
- `QueueProviderConfig` - Discriminated union (`{ type: 'memory', ... } | { type: 'sqs', ... }`)
- Factory function uses `providerConfig.type` to instantiate the right provider

**Event-Driven Notification (No Wasteful Polling):**
- **SQS**: Uses native long polling - `receive()` blocks until message arrives or 20s timeout
- **Memory**: Uses `EventEmitter` - `receive()` returns a Promise that resolves immediately when `enqueue()` emits an event
- Worker loop calls `receive()` which blocks efficiently, no CPU-wasting sleep loops

## Design Decisions

- **Worker flexibility**: Support both in-process (simpler) and separate process (scalable) via config
- **Scheduler included**: Database-backed scheduler for delayed and recurring jobs
- **Event-driven workers**: Use long polling (SQS) or EventEmitter (memory) for instant notification - no wasteful polling
- **Optional dependencies**: Provider SDKs (like `@aws-sdk/client-sqs`) are optional peer deps, loaded dynamically only when configured
- **Slack unchanged**: Keep existing Slack fire-and-forget; can migrate later if needed

## Core Interface

```typescript
// Queue provider interface - implemented by MemoryQueueProvider, SQSQueueProvider, etc.
interface QueueProvider {
  readonly name: string;
  enqueue<T>(type: string, payload: T, options?: EnqueueOptions): Promise<Job<T>>;

  // Blocks until messages arrive OR waitTimeSeconds expires (long polling)
  // SQS: uses native long polling (efficient, instant when message arrives)
  // Memory: uses EventEmitter (instant notification, no polling)
  receive(maxMessages?: number, waitTimeSeconds?: number): Promise<ReceivedJob[]>;

  acknowledge(receiptHandle: string): Promise<void>;
  fail(receiptHandle: string, error: Error): Promise<void>;
  getJob(jobId: string): Promise<Job | null>;
  getStats(): Promise<QueueStats>;
  close(): Promise<void>;
}

// Factory function - creates provider based on config type
// Uses dynamic imports for optional dependencies (SQS SDK only loaded if needed)
async function getQueueProvider(config: QueueProviderConfig): Promise<QueueProvider> {
  switch (config.type) {
    case 'memory':
      return new MemoryQueueProvider(config);
    case 'sqs':
      // Dynamic import - @aws-sdk/client-sqs is optional peer dependency
      try {
        const { SQSQueueProvider } = await import('./providers/sqs.js');
        return new SQSQueueProvider(config);
      } catch (e) {
        throw new Error(
          'SQS provider requires @aws-sdk/client-sqs. Install it with: pnpm add @aws-sdk/client-sqs'
        );
      }
    default:
      throw new Error(`Unknown queue provider: ${config.type}`);
  }
}

interface Job<TPayload> {
  id: string;
  type: string;
  payload: TPayload;
  options: JobOptions;
  status: 'pending' | 'scheduled' | 'processing' | 'completed' | 'failed' | 'dead';
  attempts: number;
  createdAt: Date;
  scheduledFor?: Date;
  lastError?: string;
}

interface EnqueueOptions {
  delay?: number;           // Delay in ms
  scheduledFor?: Date;      // Specific execution time
  maxRetries?: number;      // Default: 3
  timeout?: number;         // Job timeout in ms
  deduplicationKey?: string; // Prevent duplicate jobs
}
```

## Config

```typescript
// packages/shared/src/types/config.ts

// Provider configs as discriminated union - easy to extend
export interface MemoryProviderConfig {
  type: 'memory';
  maxHistorySize?: number;
}

export interface SQSProviderConfig {
  type: 'sqs';
  region: string;
  queueUrl: string;
  deadLetterQueueUrl?: string;
  visibilityTimeout?: number; // Default: 30s
}

// Add more providers here in the future:
// export interface RedisProviderConfig { type: 'redis'; connectionUrl: string; }

export type QueueProviderConfig = MemoryProviderConfig | SQSProviderConfig;

// Future providers can be added to the union:
// | RedisProviderConfig
// | RabbitMQProviderConfig

export interface QueueConfig {
  enabled: boolean;
  providerConfig: QueueProviderConfig;

  worker?: {
    mode: 'in-process' | 'standalone';  // Default: 'in-process'
    concurrency?: number;               // Default: 5
    pollInterval?: number;              // Default: 1000ms
    shutdownTimeout?: number;           // Default: 30000ms
  };

  scheduler?: {
    enabled: boolean;                   // Default: false
    pollInterval?: number;              // Default: 60000ms (1 min)
  };
}

// In AppConfig
queue?: QueueConfig;
```

**Environment Variables (for SQS):**
```bash
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

## File Structure

```
packages/server/src/queue/
├── index.ts              # Exports, getQueueProvider(), startWorker()
├── types.ts              # Interface definitions
├── providers/
│   ├── memory.ts         # Dev/testing provider
│   └── sqs.ts            # AWS SQS provider
├── worker.ts             # Job processing worker (in-process or standalone)
├── scheduler.ts          # Database-backed scheduler for long delays
├── handlers/
│   └── index.ts          # Job handler registry
└── cli.ts                # CLI entry point for standalone worker mode

packages/db/prisma/schema/
└── base.prisma           # Add ScheduledJob model
```

## Implementation Phases

### Phase 1: Core Types & Memory Provider
1. Add `QueueConfig` to `packages/shared/src/types/config.ts`
2. Create `packages/server/src/queue/types.ts` with all interfaces
3. Create `packages/server/src/queue/providers/memory.ts`
4. Create `packages/server/src/queue/index.ts` with factory
5. Add config defaults to `packages/server/src/config/loader.ts`

### Phase 2: Worker & Handlers
1. Create `packages/server/src/queue/handlers/index.ts` (registry)
2. Create `packages/server/src/queue/worker.ts` with Worker class
3. Add `startWorker()` function that respects `worker.mode` config
4. Wire into `packages/server/src/server.ts` for in-process mode

### Phase 3: Scheduler & Recurring Jobs
1. Add `ScheduledJob` and `RecurringJob` models to `packages/db/prisma/schema/base.prisma`
2. Run `pnpm db:push && pnpm db:generate`
3. Create `packages/server/src/queue/scheduler.ts` with:
   - `schedule()` for one-time delayed jobs
   - `registerRecurring()` for cron-style recurring jobs
   - Cron expression parser (use `cron-parser` package)
4. Integrate scheduler startup with worker

### Phase 4: SQS Provider
1. Add `@aws-sdk/client-sqs` as **optional peer dependency** in server's package.json
2. Create `packages/server/src/queue/providers/sqs.ts`
3. Use dynamic `import()` in factory to load SQS provider only when configured
4. Handle SQS-specific concerns (visibility timeout, long polling, DLQ)
5. Test with LocalStack or real SQS

**package.json setup:**
```json
{
  "peerDependencies": {
    "@aws-sdk/client-sqs": "^3.0.0"
  },
  "peerDependenciesMeta": {
    "@aws-sdk/client-sqs": {
      "optional": true
    }
  }
}
```

### Phase 5: Standalone Worker CLI
1. Create `packages/server/src/queue/cli.ts` for standalone mode
2. Add `queue-worker` script to package.json
3. Document standalone deployment option

## Usage Example

```typescript
// Enqueue a job (immediate)
import { getQueueProvider } from './queue/index.js';

const queue = getQueueProvider();
await queue.enqueue('email:send', { to: 'user@example.com', subject: 'Hello' });

// With short delay (up to 15 min for SQS)
await queue.enqueue('reminder:send', { userId: '123' }, { delay: 60000 });

// Schedule for later (uses database scheduler for delays > 15 min)
import { getScheduler } from './queue/index.js';

const scheduler = getScheduler();
await scheduler.schedule(
  'daily:report',
  { teamId: 'abc' },
  new Date('2024-12-01T09:00:00Z')
);

// Register handler
import { registerJobHandler } from './queue/handlers/index.js';

registerJobHandler('email:send', async (job, ctx) => {
  ctx.log('Sending email', job.payload);
  await sendEmail(job.payload);
});
```

**Config Examples:**

```typescript
// Development (in-process, memory queue)
queue: {
  enabled: true,
  providerConfig: { type: 'memory', maxHistorySize: 1000 },
  worker: { mode: 'in-process', concurrency: 2 },
  scheduler: { enabled: true },
}

// Production (in-process worker, SQS queue)
// First: pnpm add @aws-sdk/client-sqs
queue: {
  enabled: true,
  providerConfig: {
    type: 'sqs',
    region: 'us-east-1',
    queueUrl: process.env.SQS_QUEUE_URL!,
  },
  worker: { mode: 'in-process', concurrency: 5 },
  scheduler: { enabled: true, pollInterval: 60000 },
}

// Production (standalone workers, SQS queue)
queue: {
  enabled: true,
  providerConfig: {
    type: 'sqs',
    region: 'us-east-1',
    queueUrl: process.env.SQS_QUEUE_URL!,
  },
  worker: { mode: 'standalone' },  // Don't start worker with server
  scheduler: { enabled: true },
}
// Then run: pnpm queue-worker (separate process)
```

## Verification

1. Start server with memory provider, enqueue job, verify instant processing (no delay)
2. Schedule a one-time job 1 minute out, verify it processes at the scheduled time
3. Register a recurring job with `"every 1 minute"`, verify it runs repeatedly
4. Test retry logic by throwing error in handler, verify retries and eventual failure
5. Test deduplication with same deduplicationKey, verify only one job runs
6. Configure SQS provider (LocalStack or real), verify messages flow through
7. Test standalone worker mode by setting `mode: 'standalone'` and running CLI

## Database Schema Addition

```prisma
// packages/db/prisma/schema/base.prisma

// One-time scheduled jobs (delayed execution)
model ScheduledJob {
  id           String   @id @default(cuid())
  type         String
  payload      String   @db.Text
  options      String   @db.Text  // JSON EnqueueOptions
  scheduledFor DateTime
  status       String   @default("scheduled")  // scheduled | enqueued | cancelled
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([status, scheduledFor])
  @@index([type])
}

// Recurring jobs (cron-style)
model RecurringJob {
  id          String    @id @default(cuid())
  name        String    @unique  // e.g., "daily-report", "hourly-cleanup"
  type        String              // Job type to enqueue
  payload     String    @db.Text  // JSON payload
  options     String    @db.Text  // JSON EnqueueOptions (minus scheduling)
  schedule    String              // Cron expression: "0 9 * * *" or interval: "every 1 hour"
  timezone    String    @default("UTC")
  enabled     Boolean   @default(true)
  nextRunAt   DateTime?
  lastRunAt   DateTime?
  lastError   String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([enabled, nextRunAt])
}
```

## Recurring Jobs

**Schedule formats supported:**
- Cron expressions: `"0 9 * * *"` (daily at 9am), `"*/15 * * * *"` (every 15 min)
- Intervals: `"every 1 hour"`, `"every 30 minutes"`, `"every 1 day"`

**How it works:**
1. Scheduler polls `RecurringJob` where `enabled=true AND nextRunAt <= now()`
2. For each due job: enqueue to queue, calculate next run, update `nextRunAt`
3. If job fails, store error but still schedule next occurrence

```typescript
// Register a recurring job
await scheduler.registerRecurring({
  name: 'daily-team-report',
  type: 'report:generate',
  payload: { reportType: 'daily' },
  schedule: '0 9 * * *',  // Every day at 9am
  timezone: 'America/New_York',
});

// Or with interval syntax
await scheduler.registerRecurring({
  name: 'cache-cleanup',
  type: 'maintenance:cleanup',
  payload: {},
  schedule: 'every 1 hour',
});
```

## Critical Files

- `packages/shared/src/types/config.ts` - Add QueueConfig type
- `packages/server/src/queue/types.ts` - Core interfaces
- `packages/server/src/queue/index.ts` - Factory (follows storage/index.ts pattern)
- `packages/server/src/queue/providers/sqs.ts` - SQS implementation
- `packages/server/src/queue/scheduler.ts` - Database-backed scheduler
- `packages/server/src/server.ts` - Start worker in in-process mode
