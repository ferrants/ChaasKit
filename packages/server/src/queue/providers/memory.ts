import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import type { MemoryQueueProviderConfig } from '@chaaskit/shared';
import type {
  QueueProvider,
  Job,
  ReceivedJob,
  EnqueueOptions,
  JobOptions,
  QueueStats,
  JobStatus,
} from '../types.js';

interface InternalJob extends Job {
  receiptHandle?: string;
  visibleAt: Date;
}

/**
 * In-memory queue provider for development and testing.
 * Uses EventEmitter for instant notification when jobs are enqueued.
 */
export class MemoryQueueProvider implements QueueProvider {
  readonly name = 'memory';

  private jobs: Map<string, InternalJob> = new Map();
  private pendingQueue: string[] = []; // Job IDs in order
  private completedHistory: string[] = [];
  private maxHistorySize: number;
  private emitter: EventEmitter;
  private deduplicationKeys: Map<string, string> = new Map(); // dedupKey -> jobId
  private closed = false;

  constructor(config: MemoryQueueProviderConfig) {
    this.maxHistorySize = config.maxHistorySize ?? 1000;
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100); // Allow many concurrent receivers
  }

  async enqueue<T>(type: string, payload: T, options?: EnqueueOptions): Promise<Job<T>> {
    if (this.closed) {
      throw new Error('Queue provider is closed');
    }

    // Check deduplication
    if (options?.deduplicationKey) {
      const existingJobId = this.deduplicationKeys.get(options.deduplicationKey);
      if (existingJobId) {
        const existingJob = this.jobs.get(existingJobId);
        if (existingJob && !['completed', 'failed', 'dead'].includes(existingJob.status)) {
          // Return existing job instead of creating duplicate
          return existingJob as Job<T>;
        }
        // Clean up old dedup key if job is done
        this.deduplicationKeys.delete(options.deduplicationKey);
      }
    }

    const now = new Date();
    const jobOptions: JobOptions = {
      maxRetries: options?.maxRetries ?? 3,
      timeout: options?.timeout ?? 30000,
      priority: options?.priority ?? 0,
      deduplicationKey: options?.deduplicationKey,
    };

    // Calculate when job becomes visible
    let visibleAt = now;
    let status: JobStatus = 'pending';
    let scheduledFor: Date | undefined;

    if (options?.scheduledFor) {
      visibleAt = options.scheduledFor;
      scheduledFor = options.scheduledFor;
      status = 'scheduled';
    } else if (options?.delay) {
      visibleAt = new Date(now.getTime() + options.delay);
      scheduledFor = visibleAt;
      status = options.delay > 0 ? 'scheduled' : 'pending';
    }

    const job: InternalJob = {
      id: randomUUID(),
      type,
      payload,
      options: jobOptions,
      status,
      attempts: 0,
      createdAt: now,
      scheduledFor,
      visibleAt,
    };

    this.jobs.set(job.id, job);

    if (options?.deduplicationKey) {
      this.deduplicationKeys.set(options.deduplicationKey, job.id);
    }

    // Add to pending queue based on visibility
    if (status === 'pending') {
      this.insertIntoQueue(job.id);
      // Emit event to wake up any waiting receivers
      this.emitter.emit('job');
    } else {
      // Schedule for later
      const delay = visibleAt.getTime() - now.getTime();
      setTimeout(() => {
        const j = this.jobs.get(job.id);
        if (j && j.status === 'scheduled') {
          j.status = 'pending';
          this.insertIntoQueue(job.id);
          this.emitter.emit('job');
        }
      }, delay);
    }

    // Return job without internal fields
    return this.toPublicJob(job) as Job<T>;
  }

  async receive(maxMessages = 1, waitTimeSeconds = 20): Promise<ReceivedJob[]> {
    if (this.closed) {
      return [];
    }

    const jobs = this.getVisibleJobs(maxMessages);
    if (jobs.length > 0) {
      return jobs;
    }

    // Wait for jobs to arrive
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.emitter.removeListener('job', onJob);
        resolve([]);
      }, waitTimeSeconds * 1000);

      const onJob = () => {
        const jobs = this.getVisibleJobs(maxMessages);
        if (jobs.length > 0) {
          clearTimeout(timeout);
          this.emitter.removeListener('job', onJob);
          resolve(jobs);
        }
      };

      this.emitter.on('job', onJob);

      // Check if closed while waiting
      const onClose = () => {
        clearTimeout(timeout);
        this.emitter.removeListener('job', onJob);
        this.emitter.removeListener('close', onClose);
        resolve([]);
      };
      this.emitter.once('close', onClose);
    });
  }

  private getVisibleJobs(maxMessages: number): ReceivedJob[] {
    const now = new Date();
    const results: ReceivedJob[] = [];
    const toRemove: number[] = [];

    for (let i = 0; i < this.pendingQueue.length && results.length < maxMessages; i++) {
      const jobId = this.pendingQueue[i];
      const job = this.jobs.get(jobId);

      if (!job) {
        toRemove.push(i);
        continue;
      }

      if (job.status !== 'pending' || job.visibleAt > now) {
        continue;
      }

      // Mark as processing and create receipt handle
      const receiptHandle = randomUUID();
      job.status = 'processing';
      job.receiptHandle = receiptHandle;
      job.startedAt = now;
      job.attempts += 1;
      toRemove.push(i);

      results.push({
        ...this.toPublicJob(job),
        receiptHandle,
      } as ReceivedJob);
    }

    // Remove processed jobs from queue (in reverse to maintain indices)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.pendingQueue.splice(toRemove[i], 1);
    }

    return results;
  }

  async acknowledge(receiptHandle: string): Promise<void> {
    const job = this.findByReceiptHandle(receiptHandle);
    if (!job) {
      throw new Error(`Job not found for receipt handle: ${receiptHandle}`);
    }

    job.status = 'completed';
    job.completedAt = new Date();
    delete job.receiptHandle;

    // Add to completed history
    this.completedHistory.push(job.id);
    this.trimHistory();

    // Clean up deduplication key
    if (job.options.deduplicationKey) {
      this.deduplicationKeys.delete(job.options.deduplicationKey);
    }
  }

  async fail(receiptHandle: string, error: Error): Promise<void> {
    const job = this.findByReceiptHandle(receiptHandle);
    if (!job) {
      throw new Error(`Job not found for receipt handle: ${receiptHandle}`);
    }

    job.lastError = error.message;
    delete job.receiptHandle;

    if (job.attempts >= job.options.maxRetries) {
      // No more retries, mark as dead
      job.status = 'dead';
      job.completedAt = new Date();

      // Clean up deduplication key
      if (job.options.deduplicationKey) {
        this.deduplicationKeys.delete(job.options.deduplicationKey);
      }
    } else {
      // Requeue with exponential backoff
      const backoffMs = Math.min(1000 * Math.pow(2, job.attempts), 60000);
      job.status = 'pending';
      job.visibleAt = new Date(Date.now() + backoffMs);

      setTimeout(() => {
        if (job.status === 'pending') {
          this.insertIntoQueue(job.id);
          this.emitter.emit('job');
        }
      }, backoffMs);
    }
  }

  async getJob(jobId: string): Promise<Job | null> {
    const job = this.jobs.get(jobId);
    return job ? this.toPublicJob(job) : null;
  }

  async getStats(): Promise<QueueStats> {
    let pending = 0;
    let processing = 0;
    let completed = 0;
    let failed = 0;
    let dead = 0;
    let scheduled = 0;

    for (const job of this.jobs.values()) {
      switch (job.status) {
        case 'pending':
          pending++;
          break;
        case 'scheduled':
          scheduled++;
          break;
        case 'processing':
          processing++;
          break;
        case 'completed':
          completed++;
          break;
        case 'failed':
          failed++;
          break;
        case 'dead':
          dead++;
          break;
      }
    }

    return { pending, processing, completed, failed, dead, scheduled };
  }

  async close(): Promise<void> {
    this.closed = true;
    this.emitter.emit('close');
    this.emitter.removeAllListeners();
  }

  private findByReceiptHandle(receiptHandle: string): InternalJob | undefined {
    for (const job of this.jobs.values()) {
      if (job.receiptHandle === receiptHandle) {
        return job;
      }
    }
    return undefined;
  }

  private insertIntoQueue(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    // Insert by priority (lower = higher priority)
    let insertIndex = this.pendingQueue.length;
    for (let i = 0; i < this.pendingQueue.length; i++) {
      const existingJob = this.jobs.get(this.pendingQueue[i]);
      if (existingJob && job.options.priority < existingJob.options.priority) {
        insertIndex = i;
        break;
      }
    }
    this.pendingQueue.splice(insertIndex, 0, jobId);
  }

  private trimHistory(): void {
    // Remove oldest completed jobs if we exceed maxHistorySize
    while (this.completedHistory.length > this.maxHistorySize) {
      const oldJobId = this.completedHistory.shift();
      if (oldJobId) {
        const job = this.jobs.get(oldJobId);
        if (job && job.status === 'completed') {
          this.jobs.delete(oldJobId);
        }
      }
    }
  }

  private toPublicJob(job: InternalJob): Job {
    return {
      id: job.id,
      type: job.type,
      payload: job.payload,
      options: job.options,
      status: job.status,
      attempts: job.attempts,
      createdAt: job.createdAt,
      scheduledFor: job.scheduledFor,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      lastError: job.lastError,
    };
  }
}
