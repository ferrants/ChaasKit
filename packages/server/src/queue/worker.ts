/**
 * Queue Worker
 *
 * Processes jobs from the queue using registered handlers.
 * Supports concurrent job processing with configurable concurrency.
 */

import type { QueueWorkerConfig } from '@chaaskit/shared';
import type { QueueProvider, ReceivedJob, JobContext } from './types.js';
import { executeJob, hasJobHandler } from './handlers/index.js';

export interface WorkerOptions {
  /** Queue provider to receive jobs from */
  provider: QueueProvider;
  /** Worker configuration */
  config: QueueWorkerConfig;
}

export interface WorkerStats {
  /** Number of jobs processed since worker started */
  processed: number;
  /** Number of successful jobs */
  succeeded: number;
  /** Number of failed jobs */
  failed: number;
  /** Number of jobs currently being processed */
  active: number;
  /** Whether the worker is running */
  running: boolean;
}

/**
 * Worker that processes jobs from a queue.
 */
export class Worker {
  private provider: QueueProvider;
  private concurrency: number;
  private shutdownTimeout: number;
  private running = false;
  private shuttingDown = false;
  private activeJobs = new Set<string>();
  private stats = {
    processed: 0,
    succeeded: 0,
    failed: 0,
  };
  private abortController: AbortController | null = null;

  constructor(options: WorkerOptions) {
    this.provider = options.provider;
    this.concurrency = options.config.concurrency ?? 5;
    this.shutdownTimeout = options.config.shutdownTimeout ?? 30000;
  }

  /**
   * Start the worker.
   * The worker will continuously poll for jobs and process them.
   */
  async start(): Promise<void> {
    if (this.running) {
      console.warn('[Worker] Already running');
      return;
    }

    this.running = true;
    this.shuttingDown = false;
    this.abortController = new AbortController();

    console.log(`[Worker] Starting with concurrency ${this.concurrency}`);

    // Start multiple concurrent worker loops
    const workers = Array.from({ length: this.concurrency }, (_, i) =>
      this.workerLoop(i)
    );

    // Wait for all worker loops to complete (they run until stop() is called)
    await Promise.all(workers);

    console.log('[Worker] Stopped');
  }

  /**
   * Stop the worker gracefully.
   * Waits for active jobs to complete up to shutdownTimeout.
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    console.log('[Worker] Stopping...');
    this.shuttingDown = true;
    this.abortController?.abort();

    // Wait for active jobs to complete
    const deadline = Date.now() + this.shutdownTimeout;
    while (this.activeJobs.size > 0 && Date.now() < deadline) {
      console.log(`[Worker] Waiting for ${this.activeJobs.size} active job(s)...`);
      await sleep(1000);
    }

    if (this.activeJobs.size > 0) {
      console.warn(`[Worker] Forcing shutdown with ${this.activeJobs.size} active job(s)`);
    }

    this.running = false;
  }

  /**
   * Get worker statistics.
   */
  getStats(): WorkerStats {
    return {
      ...this.stats,
      active: this.activeJobs.size,
      running: this.running,
    };
  }

  /**
   * Check if the worker is running.
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Individual worker loop that receives and processes jobs.
   */
  private async workerLoop(workerId: number): Promise<void> {
    const prefix = `[Worker:${workerId}]`;

    while (this.running && !this.shuttingDown) {
      try {
        // Wait for a job from the queue (long polling)
        const jobs = await this.provider.receive(1, 20);

        if (jobs.length === 0) {
          // No jobs received, loop will continue and poll again
          continue;
        }

        const job = jobs[0];

        // Check if we have a handler for this job type
        if (!hasJobHandler(job.type)) {
          console.error(`${prefix} No handler for job type: ${job.type}, failing job`);
          await this.provider.fail(job.receiptHandle, new Error(`No handler for job type: ${job.type}`));
          continue;
        }

        // Process the job
        await this.processJob(job, prefix);
      } catch (error) {
        // Only log if not shutting down
        if (!this.shuttingDown) {
          console.error(`${prefix} Error in worker loop:`, error);
          // Brief pause before retrying to avoid tight error loops
          await sleep(1000);
        }
      }
    }
  }

  /**
   * Process a single job.
   */
  private async processJob(job: ReceivedJob, prefix: string): Promise<void> {
    this.activeJobs.add(job.id);
    const startTime = Date.now();

    console.log(`${prefix} Processing job ${job.id} (type: ${job.type}, attempt: ${job.attempts})`);

    // Create abort controller for job timeout
    const jobAbortController = new AbortController();
    const timeoutId = setTimeout(() => {
      jobAbortController.abort();
    }, job.options.timeout);

    // Create job context
    const ctx: JobContext = {
      jobId: job.id,
      attempt: job.attempts,
      log: (message: string, ...args: unknown[]) => {
        console.log(`${prefix} [${job.id}] ${message}`, ...args);
      },
      progress: (percent: number) => {
        // Progress reporting could be extended to update job metadata
        console.log(`${prefix} [${job.id}] Progress: ${percent}%`);
      },
      signal: jobAbortController.signal,
    };

    try {
      // Execute the job handler
      await executeJob(job, ctx);

      // Acknowledge successful completion
      await this.provider.acknowledge(job.receiptHandle);

      const duration = Date.now() - startTime;
      console.log(`${prefix} Job ${job.id} completed in ${duration}ms`);

      this.stats.processed++;
      this.stats.succeeded++;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (jobAbortController.signal.aborted) {
        console.error(`${prefix} Job ${job.id} timed out after ${duration}ms`);
      } else {
        console.error(`${prefix} Job ${job.id} failed after ${duration}ms:`, errorMessage);
      }

      // Mark job as failed (will be retried if attempts remain)
      try {
        await this.provider.fail(
          job.receiptHandle,
          error instanceof Error ? error : new Error(errorMessage)
        );
      } catch (failError) {
        console.error(`${prefix} Error failing job ${job.id}:`, failError);
      }

      this.stats.processed++;
      this.stats.failed++;
    } finally {
      clearTimeout(timeoutId);
      this.activeJobs.delete(job.id);
    }
  }
}

/**
 * Helper to sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Singleton worker instance
let workerInstance: Worker | null = null;

/**
 * Get or create the worker singleton.
 */
export function getWorker(options?: WorkerOptions): Worker | null {
  if (!workerInstance && options) {
    workerInstance = new Worker(options);
  }
  return workerInstance;
}

/**
 * Start the worker with the given options.
 * Returns the worker instance.
 */
export async function startWorker(options: WorkerOptions): Promise<Worker> {
  if (workerInstance) {
    console.warn('[Worker] Worker already exists');
    if (!workerInstance.isRunning()) {
      await workerInstance.start();
    }
    return workerInstance;
  }

  workerInstance = new Worker(options);
  // Start in background (don't await)
  workerInstance.start().catch((error) => {
    console.error('[Worker] Worker crashed:', error);
  });

  return workerInstance;
}

/**
 * Stop the worker.
 */
export async function stopWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.stop();
    workerInstance = null;
  }
}

/**
 * Reset the worker singleton (for testing).
 */
export function resetWorker(): void {
  workerInstance = null;
}
