# Job Queue

The job queue system provides background job processing with support for multiple backends, scheduled jobs, recurring jobs, and flexible worker deployment.

## Overview

The queue system consists of:

- **Queue Providers**: Pluggable backends (memory for dev, SQS for production)
- **Workers**: Process jobs with configurable concurrency
- **Scheduler**: Database-backed scheduling for delayed and recurring jobs
- **Handler Registry**: Register functions to process specific job types

## Quick Start

### 1. Enable the Queue

```typescript
// config/app.config.ts
export const config: AppConfig = {
  // ... other config
  queue: {
    enabled: true,
    providerConfig: { type: 'memory' },
    worker: { mode: 'in-process', concurrency: 5 },
    scheduler: { enabled: true },
  },
};
```

### 2. Register Job Handlers

Place job handlers in `extensions/jobs/*.ts` (auto-loaded by the server) or import them manually during startup.

```typescript
// extensions/jobs/email.ts
import { registerJobHandler } from '@chaaskit/server';

registerJobHandler('email:send', async (job, ctx) => {
  ctx.log('Sending email to', job.payload.to);
  await sendEmail(job.payload);
});

registerJobHandler('report:generate', async (job, ctx) => {
  ctx.log('Generating report', job.payload.reportId);
  ctx.progress(50); // Report progress
  const report = await generateReport(job.payload);
  ctx.progress(100);
  return report;
});
```

### 3. Enqueue Jobs

```typescript
import { getQueueProvider } from '@chaaskit/server';

const queue = getQueueProvider();

// Immediate job
await queue.enqueue('email:send', {
  to: 'user@example.com',
  subject: 'Welcome!'
});

// Delayed job (up to 15 min for SQS)
await queue.enqueue('reminder:send', { userId: '123' }, {
  delay: 60000  // 1 minute
});

// Job with retry configuration
await queue.enqueue('webhook:send', { url: '...' }, {
  maxRetries: 5,
  timeout: 30000,
});
```

### 4. Push Schema Changes

```bash
pnpm db:push
```

## Configuration

### Full Config Options

```typescript
queue: {
  enabled: boolean;

  // Provider configuration (discriminated union)
  providerConfig:
    | { type: 'memory'; maxHistorySize?: number }
    | {
        type: 'sqs';
        region: string;
        queueUrl: string;
        deadLetterQueueUrl?: string;
        visibilityTimeout?: number;  // Default: 30s
      };

  // Worker configuration
  worker?: {
    mode: 'in-process' | 'standalone';  // Default: 'in-process'
    concurrency?: number;                // Default: 5
    pollInterval?: number;               // Default: 1000ms
    shutdownTimeout?: number;            // Default: 30000ms
  };

  // Scheduler configuration
  scheduler?: {
    enabled: boolean;       // Default: false
    pollInterval?: number;  // Default: 60000ms (1 min)
  };
}
```

### Development Config

```typescript
queue: {
  enabled: true,
  providerConfig: { type: 'memory', maxHistorySize: 1000 },
  worker: { mode: 'in-process', concurrency: 2 },
  scheduler: { enabled: true },
}
```

### Production Config (SQS)

```typescript
queue: {
  enabled: true,
  providerConfig: {
    type: 'sqs',
    region: 'us-east-1',
    queueUrl: process.env.SQS_QUEUE_URL!,
    deadLetterQueueUrl: process.env.SQS_DLQ_URL,
    visibilityTimeout: 60,
  },
  worker: { mode: 'in-process', concurrency: 10 },
  scheduler: { enabled: true, pollInterval: 30000 },
}
```

## Queue Providers

### Memory Provider

In-memory queue for development and testing. Uses EventEmitter for instant job notification (no polling).

```typescript
providerConfig: {
  type: 'memory',
  maxHistorySize: 1000  // Keep last N completed jobs
}
```

**Features:**
- Instant job processing (EventEmitter-based)
- Job history for debugging
- Deduplication support
- Priority queues

### SQS Provider

AWS SQS for production deployments. Requires `@aws-sdk/client-sqs`:

```bash
pnpm add @aws-sdk/client-sqs
```

```typescript
providerConfig: {
  type: 'sqs',
  region: 'us-east-1',
  queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/my-queue',
  deadLetterQueueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/my-dlq',
  visibilityTimeout: 30,
}
```

**Environment Variables:**
```bash
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
SQS_QUEUE_URL=https://sqs...
```

**Features:**
- Long polling (efficient, no wasted requests)
- Visibility timeout for at-least-once delivery
- Dead letter queue support
- FIFO queue support with deduplication

**Limitations:**
- Max delay: 15 minutes (use scheduler for longer delays)
- Max message size: 256 KB

## Job Handlers

### Registering Handlers

```typescript
import { registerJobHandler } from '@chaaskit/server';

registerJobHandler<PayloadType, ResultType>(
  'job:type',
  async (job, ctx) => {
    // job.id - Unique job ID
    // job.type - Job type string
    // job.payload - Your typed payload
    // job.attempts - Current attempt number
    // job.options - Job options (maxRetries, timeout, etc.)

    // ctx.jobId - Same as job.id
    // ctx.attempt - Current attempt (1-based)
    // ctx.log() - Job-specific logging
    // ctx.progress() - Report progress (0-100)
    // ctx.signal - AbortSignal for cancellation

    return result;
  },
  'Optional description for debugging'
);
```

### Error Handling & Retries

Jobs automatically retry on failure:

```typescript
registerJobHandler('flaky:job', async (job, ctx) => {
  if (Math.random() < 0.5) {
    throw new Error('Random failure');
    // Job will be retried up to maxRetries times
  }
  return 'success';
});

// Configure retries per job
await queue.enqueue('flaky:job', {}, {
  maxRetries: 5,      // Default: 3
  timeout: 60000,     // Job timeout in ms
});
```

### Timeout Handling

```typescript
registerJobHandler('long:task', async (job, ctx) => {
  // Check if job was cancelled/timed out
  if (ctx.signal.aborted) {
    throw new Error('Job cancelled');
  }

  // For long operations, periodically check the signal
  for (const item of items) {
    if (ctx.signal.aborted) break;
    await processItem(item);
  }
});
```

## Scheduler

The scheduler enables delayed execution and recurring jobs using database storage.

### One-Time Scheduled Jobs

For delays longer than provider limits (e.g., > 15 min for SQS):

```typescript
import { getScheduler } from '@chaaskit/server';

const scheduler = getScheduler();

// Schedule for a specific time
await scheduler.schedule(
  'report:send',
  { reportId: '123', recipients: ['user@example.com'] },
  new Date('2024-12-25T09:00:00Z')
);

// Cancel a scheduled job
await scheduler.cancelScheduledJob(jobId);
```

### Recurring Jobs

```typescript
// Cron expression (daily at 9am)
await scheduler.registerRecurring({
  name: 'daily-digest',
  type: 'email:digest',
  payload: { digestType: 'daily' },
  schedule: '0 9 * * *',
  timezone: 'America/New_York',
});

// Interval syntax
await scheduler.registerRecurring({
  name: 'cache-cleanup',
  type: 'maintenance:cleanup',
  payload: {},
  schedule: 'every 1 hour',
});

// Manage recurring jobs
await scheduler.disableRecurring('daily-digest');
await scheduler.enableRecurring('daily-digest');
await scheduler.deleteRecurring('daily-digest');

// List all recurring jobs
const jobs = await scheduler.listRecurring();
```

**Supported Schedule Formats:**
- Cron: `"0 9 * * *"` (daily at 9am), `"*/15 * * * *"` (every 15 min)
- Intervals: `"every 1 hour"`, `"every 30 minutes"`, `"every 1 day"`

## Worker Modes

### In-Process Mode (Default)

Worker runs within the main server process:

```typescript
worker: {
  mode: 'in-process',
  concurrency: 5
}
```

**Pros:** Simple setup, no extra processes
**Cons:** Shares resources with web server

### Standalone Mode

Run workers as separate processes for better scaling:

```typescript
// config/app.config.ts
worker: {
  mode: 'standalone'  // Server won't start workers
}
```

Then run workers separately:

```bash
# Using the CLI
pnpm queue-worker

# Or with environment overrides
QUEUE_CONCURRENCY=10 pnpm queue-worker
SCHEDULER_ENABLED=true pnpm queue-worker
```

**Environment Variables for Standalone Workers:**
```bash
QUEUE_CONCURRENCY=5         # Number of concurrent jobs
QUEUE_POLL_INTERVAL=1000    # Poll interval (ms)
QUEUE_SHUTDOWN_TIMEOUT=30000 # Graceful shutdown timeout (ms)
SCHEDULER_ENABLED=false     # Enable scheduler in this worker
SCHEDULER_POLL_INTERVAL=60000 # Scheduler poll interval (ms)
```

## API Reference

### Queue Provider

```typescript
interface QueueProvider {
  readonly name: string;

  // Enqueue a job
  enqueue<T>(type: string, payload: T, options?: EnqueueOptions): Promise<Job<T>>;

  // Receive jobs (long polling)
  receive(maxMessages?: number, waitTimeSeconds?: number): Promise<ReceivedJob[]>;

  // Acknowledge successful completion
  acknowledge(receiptHandle: string): Promise<void>;

  // Mark job as failed (will retry if attempts remain)
  fail(receiptHandle: string, error: Error): Promise<void>;

  // Get job by ID
  getJob(jobId: string): Promise<Job | null>;

  // Get queue statistics
  getStats(): Promise<QueueStats>;

  // Close provider
  close(): Promise<void>;
}
```

### Enqueue Options

```typescript
interface EnqueueOptions {
  delay?: number;           // Delay in ms
  scheduledFor?: Date;      // Specific execution time
  maxRetries?: number;      // Default: 3
  timeout?: number;         // Job timeout in ms (default: 30000)
  deduplicationKey?: string; // Prevent duplicate jobs
  priority?: number;        // Lower = higher priority (default: 0)
}
```

### Job Context

```typescript
interface JobContext {
  jobId: string;
  attempt: number;                    // 1-based attempt number
  log: (msg: string, ...args) => void; // Job-specific logging
  progress: (percent: number) => void; // Report progress 0-100
  signal: AbortSignal;                // Check for cancellation
}
```

## Database Models

The scheduler uses two database tables:

```prisma
model ScheduledJob {
  id           String   @id
  type         String
  payload      String   @db.Text
  options      String   @db.Text
  scheduledFor DateTime
  status       String   // scheduled | enqueued | cancelled
  error        String?
  createdAt    DateTime
  updatedAt    DateTime
}

model RecurringJob {
  id          String    @id
  name        String    @unique
  type        String
  payload     String    @db.Text
  options     String    @db.Text
  schedule    String    // Cron or interval
  timezone    String
  enabled     Boolean
  nextRunAt   DateTime?
  lastRunAt   DateTime?
  lastError   String?
  createdAt   DateTime
  updatedAt   DateTime
}
```

## Best Practices

### Job Design

1. **Keep jobs idempotent** - Jobs may run more than once
2. **Store minimal data** - Put IDs in payload, not full objects
3. **Handle timeouts gracefully** - Check `ctx.signal.aborted`
4. **Use meaningful job types** - `email:welcome`, `report:daily`, `webhook:send`

### Production Setup

1. **Use SQS with DLQ** - Failed jobs go to dead letter queue for inspection
2. **Run standalone workers** - Scale workers independently from web servers
3. **Monitor queue depth** - Alert when jobs back up
4. **Set appropriate timeouts** - Match job execution time

### Error Handling

```typescript
registerJobHandler('critical:job', async (job, ctx) => {
  try {
    await riskyOperation();
  } catch (error) {
    // Log with context
    ctx.log('Operation failed', { error: error.message, attempt: ctx.attempt });

    // Re-throw to trigger retry
    throw error;

    // Or handle gracefully and don't retry
    // return { status: 'failed', reason: error.message };
  }
});
```

## Troubleshooting

### Jobs Not Processing

1. Check queue is enabled: `queue.enabled: true`
2. Check worker mode matches your setup
3. Verify handler is registered for job type
4. Check server logs for errors

### SQS Connection Issues

1. Verify AWS credentials are set
2. Check queue URL is correct
3. Ensure IAM permissions include SQS actions
4. Test with AWS CLI: `aws sqs get-queue-attributes --queue-url ...`

### Scheduler Not Running

1. Enable scheduler: `scheduler.enabled: true`
2. Run `pnpm db:push` to create tables
3. Check database connectivity
4. Verify recurring job schedules are valid
