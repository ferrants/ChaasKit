/**
 * Queue Scheduler
 *
 * Database-backed scheduler for delayed and recurring jobs.
 * - One-time scheduled jobs: stored in ScheduledJob table, enqueued when due
 * - Recurring jobs: stored in RecurringJob table, enqueued on schedule
 *
 * Supports both cron expressions and interval syntax.
 */

import type { QueueSchedulerConfig } from '@chaaskit/shared';
import { db } from '@chaaskit/db';
import { CronExpressionParser } from 'cron-parser';
import type { QueueProvider, EnqueueOptions } from './types.js';

// Use Awaited to infer types from Prisma queries
type ScheduledJob = Awaited<ReturnType<typeof db.scheduledJob.create>>;
type RecurringJob = Awaited<ReturnType<typeof db.recurringJob.create>>;

export interface SchedulerOptions {
  /** Queue provider to enqueue jobs to */
  provider: QueueProvider;
  /** Scheduler configuration */
  config: QueueSchedulerConfig;
}

export interface RecurringJobInput {
  /** Unique name for this recurring job */
  name: string;
  /** Job type to enqueue */
  type: string;
  /** Payload for each job */
  payload: unknown;
  /** Schedule: cron expression or interval (e.g., "every 1 hour") */
  schedule: string;
  /** Timezone for cron expressions (default: UTC) */
  timezone?: string;
  /** Additional enqueue options */
  options?: Omit<EnqueueOptions, 'delay' | 'scheduledFor'>;
}

/**
 * Parse an interval string like "every 5 minutes" into milliseconds
 */
function parseInterval(schedule: string): number | null {
  const match = schedule.match(/^every\s+(\d+)\s+(second|minute|hour|day|week)s?$/i);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  const multipliers: Record<string, number> = {
    second: 1000,
    minute: 60 * 1000,
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
  };

  return value * (multipliers[unit] || 0);
}

/**
 * Calculate the next run time for a schedule
 */
function calculateNextRun(schedule: string, timezone: string, fromDate?: Date): Date {
  // Try interval syntax first
  const intervalMs = parseInterval(schedule);
  if (intervalMs !== null) {
    const from = fromDate || new Date();
    return new Date(from.getTime() + intervalMs);
  }

  // Parse as cron expression
  try {
    const options = {
      currentDate: fromDate || new Date(),
      tz: timezone,
    };
    const interval = CronExpressionParser.parse(schedule, options);
    return interval.next().toDate();
  } catch (error) {
    throw new Error(
      `Invalid schedule format: "${schedule}". Use cron expression (e.g., "0 9 * * *") ` +
        `or interval (e.g., "every 5 minutes")`
    );
  }
}

/**
 * Scheduler for delayed and recurring jobs.
 */
export class Scheduler {
  private provider: QueueProvider;
  private pollInterval: number;
  private running = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: SchedulerOptions) {
    this.provider = options.provider;
    this.pollInterval = options.config.pollInterval ?? 60000;
  }

  /**
   * Start the scheduler.
   */
  async start(): Promise<void> {
    if (this.running) {
      console.warn('[Scheduler] Already running');
      return;
    }

    this.running = true;
    console.log(`[Scheduler] Starting with poll interval ${this.pollInterval}ms`);

    // Run immediately on start
    await this.poll();

    // Schedule periodic polling
    this.pollTimer = setInterval(async () => {
      try {
        await this.poll();
      } catch (error) {
        console.error('[Scheduler] Error during poll:', error);
      }
    }, this.pollInterval);
  }

  /**
   * Stop the scheduler.
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    console.log('[Scheduler] Stopping...');
    this.running = false;

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    console.log('[Scheduler] Stopped');
  }

  /**
   * Schedule a one-time job for future execution.
   */
  async schedule<T>(
    type: string,
    payload: T,
    scheduledFor: Date,
    options?: Omit<EnqueueOptions, 'delay' | 'scheduledFor'>
  ): Promise<ScheduledJob> {
    console.log(`[Scheduler] Scheduling job ${type} for ${scheduledFor.toISOString()}`);

    const job = await db.scheduledJob.create({
      data: {
        type,
        payload: JSON.stringify(payload),
        options: JSON.stringify(options || {}),
        scheduledFor,
        status: 'scheduled',
      },
    });

    return job;
  }

  /**
   * Cancel a scheduled job.
   */
  async cancelScheduledJob(jobId: string): Promise<boolean> {
    const result = await db.scheduledJob.updateMany({
      where: {
        id: jobId,
        status: 'scheduled',
      },
      data: {
        status: 'cancelled',
      },
    });

    return result.count > 0;
  }

  /**
   * Register or update a recurring job.
   */
  async registerRecurring(input: RecurringJobInput): Promise<RecurringJob> {
    // Validate schedule by calculating next run
    const nextRunAt = calculateNextRun(input.schedule, input.timezone || 'UTC');

    console.log(
      `[Scheduler] Registering recurring job "${input.name}" with schedule "${input.schedule}", ` +
        `next run: ${nextRunAt.toISOString()}`
    );

    const job = await db.recurringJob.upsert({
      where: { name: input.name },
      create: {
        name: input.name,
        type: input.type,
        payload: JSON.stringify(input.payload),
        options: JSON.stringify(input.options || {}),
        schedule: input.schedule,
        timezone: input.timezone || 'UTC',
        enabled: true,
        nextRunAt,
      },
      update: {
        type: input.type,
        payload: JSON.stringify(input.payload),
        options: JSON.stringify(input.options || {}),
        schedule: input.schedule,
        timezone: input.timezone || 'UTC',
        enabled: true,
        nextRunAt,
        lastError: null,
      },
    });

    return job;
  }

  /**
   * Disable a recurring job.
   */
  async disableRecurring(name: string): Promise<boolean> {
    const result = await db.recurringJob.updateMany({
      where: { name },
      data: { enabled: false },
    });

    return result.count > 0;
  }

  /**
   * Enable a recurring job.
   */
  async enableRecurring(name: string): Promise<boolean> {
    const job = await db.recurringJob.findUnique({ where: { name } });
    if (!job) return false;

    const nextRunAt = calculateNextRun(job.schedule, job.timezone);

    await db.recurringJob.update({
      where: { name },
      data: {
        enabled: true,
        nextRunAt,
        lastError: null,
      },
    });

    return true;
  }

  /**
   * Delete a recurring job.
   */
  async deleteRecurring(name: string): Promise<boolean> {
    const result = await db.recurringJob.deleteMany({
      where: { name },
    });

    return result.count > 0;
  }

  /**
   * Get all recurring jobs.
   */
  async listRecurring(): Promise<RecurringJob[]> {
    return db.recurringJob.findMany({
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Poll for due jobs and enqueue them.
   */
  private async poll(): Promise<void> {
    const now = new Date();

    // Process one-time scheduled jobs
    await this.processScheduledJobs(now);

    // Process recurring jobs
    await this.processRecurringJobs(now);
  }

  /**
   * Process one-time scheduled jobs that are due.
   */
  private async processScheduledJobs(now: Date): Promise<void> {
    // Find jobs that are due
    const dueJobs = await db.scheduledJob.findMany({
      where: {
        status: 'scheduled',
        scheduledFor: { lte: now },
      },
      take: 100, // Process in batches
    });

    for (const job of dueJobs) {
      try {
        const payload = JSON.parse(job.payload);
        const options = JSON.parse(job.options) as EnqueueOptions;

        await this.provider.enqueue(job.type, payload, options);

        await db.scheduledJob.update({
          where: { id: job.id },
          data: { status: 'enqueued' },
        });

        console.log(`[Scheduler] Enqueued scheduled job ${job.id} (type: ${job.type})`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[Scheduler] Failed to enqueue scheduled job ${job.id}:`, errorMessage);

        await db.scheduledJob.update({
          where: { id: job.id },
          data: {
            status: 'scheduled', // Keep it scheduled for retry
            error: errorMessage,
          },
        });
      }
    }
  }

  /**
   * Process recurring jobs that are due.
   */
  private async processRecurringJobs(now: Date): Promise<void> {
    // Find recurring jobs that are due
    const dueJobs = await db.recurringJob.findMany({
      where: {
        enabled: true,
        nextRunAt: { lte: now },
      },
    });

    for (const job of dueJobs) {
      try {
        const payload = JSON.parse(job.payload);
        const options = JSON.parse(job.options) as EnqueueOptions;

        await this.provider.enqueue(job.type, payload, options);

        // Calculate next run time
        const nextRunAt = calculateNextRun(job.schedule, job.timezone, now);

        await db.recurringJob.update({
          where: { id: job.id },
          data: {
            lastRunAt: now,
            nextRunAt,
            lastError: null,
          },
        });

        console.log(
          `[Scheduler] Enqueued recurring job "${job.name}" (type: ${job.type}), ` +
            `next run: ${nextRunAt.toISOString()}`
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[Scheduler] Failed to enqueue recurring job "${job.name}":`, errorMessage);

        // Still calculate next run, but store the error
        let nextRunAt: Date;
        try {
          nextRunAt = calculateNextRun(job.schedule, job.timezone, now);
        } catch {
          // If schedule is invalid, disable the job
          await db.recurringJob.update({
            where: { id: job.id },
            data: {
              enabled: false,
              lastError: `Invalid schedule: ${errorMessage}`,
            },
          });
          continue;
        }

        await db.recurringJob.update({
          where: { id: job.id },
          data: {
            nextRunAt,
            lastError: errorMessage,
          },
        });
      }
    }
  }
}

// Singleton scheduler instance
let schedulerInstance: Scheduler | null = null;

/**
 * Get or create the scheduler singleton.
 */
export function getScheduler(options?: SchedulerOptions): Scheduler | null {
  if (!schedulerInstance && options) {
    schedulerInstance = new Scheduler(options);
  }
  return schedulerInstance;
}

/**
 * Start the scheduler with the given options.
 */
export async function startScheduler(options: SchedulerOptions): Promise<Scheduler> {
  if (schedulerInstance) {
    console.warn('[Scheduler] Scheduler already exists');
    return schedulerInstance;
  }

  schedulerInstance = new Scheduler(options);
  await schedulerInstance.start();

  return schedulerInstance;
}

/**
 * Stop the scheduler.
 */
export async function stopScheduler(): Promise<void> {
  if (schedulerInstance) {
    await schedulerInstance.stop();
    schedulerInstance = null;
  }
}

/**
 * Reset the scheduler singleton (for testing).
 */
export function resetScheduler(): void {
  schedulerInstance = null;
}
