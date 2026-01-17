/**
 * Queue system type definitions
 */

export type JobStatus = 'pending' | 'scheduled' | 'processing' | 'completed' | 'failed' | 'dead';

/**
 * Options for enqueueing a job
 */
export interface EnqueueOptions {
  /** Delay in milliseconds before the job becomes visible */
  delay?: number;
  /** Specific time when the job should be executed (uses scheduler for long delays) */
  scheduledFor?: Date;
  /** Maximum retry attempts. Default: 3 */
  maxRetries?: number;
  /** Job timeout in milliseconds. Default: 30000 */
  timeout?: number;
  /** Deduplication key to prevent duplicate jobs */
  deduplicationKey?: string;
  /** Priority (lower = higher priority). Default: 0 */
  priority?: number;
}

/**
 * Internal job options after defaults are applied
 */
export interface JobOptions {
  maxRetries: number;
  timeout: number;
  priority: number;
  deduplicationKey?: string;
}

/**
 * A job in the queue
 */
export interface Job<TPayload = unknown> {
  id: string;
  type: string;
  payload: TPayload;
  options: JobOptions;
  status: JobStatus;
  attempts: number;
  createdAt: Date;
  scheduledFor?: Date;
  startedAt?: Date;
  completedAt?: Date;
  lastError?: string;
}

/**
 * A job received from the queue for processing
 * Includes receipt handle for acknowledgement
 */
export interface ReceivedJob<TPayload = unknown> extends Job<TPayload> {
  /** Handle used to acknowledge or fail the job */
  receiptHandle: string;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  /** Number of jobs waiting to be processed */
  pending: number;
  /** Number of jobs currently being processed */
  processing: number;
  /** Number of completed jobs (may be limited by history size) */
  completed: number;
  /** Number of failed jobs */
  failed: number;
  /** Number of dead jobs (exhausted retries) */
  dead: number;
  /** Number of scheduled jobs (delayed) */
  scheduled: number;
}

/**
 * Context provided to job handlers
 */
export interface JobContext {
  /** Job ID */
  jobId: string;
  /** Current attempt number (1-based) */
  attempt: number;
  /** Log function for job-specific logging */
  log: (message: string, ...args: unknown[]) => void;
  /** Report progress (0-100) */
  progress: (percent: number) => void;
  /** Signal for cancellation checking */
  signal: AbortSignal;
}

/**
 * Job handler function signature
 */
export type JobHandler<TPayload = unknown, TResult = unknown> = (
  job: ReceivedJob<TPayload>,
  ctx: JobContext
) => Promise<TResult>;

/**
 * Queue provider interface - implemented by MemoryQueueProvider, SQSQueueProvider, etc.
 */
export interface QueueProvider {
  /** Provider name for logging/debugging */
  readonly name: string;

  /**
   * Enqueue a job for processing
   */
  enqueue<T>(type: string, payload: T, options?: EnqueueOptions): Promise<Job<T>>;

  /**
   * Receive jobs from the queue (long polling)
   * Blocks until messages arrive OR waitTimeSeconds expires
   * - SQS: uses native long polling (efficient, instant when message arrives)
   * - Memory: uses EventEmitter (instant notification, no polling)
   *
   * @param maxMessages Maximum number of messages to receive (default: 1)
   * @param waitTimeSeconds Maximum time to wait for messages (default: 20)
   */
  receive(maxMessages?: number, waitTimeSeconds?: number): Promise<ReceivedJob[]>;

  /**
   * Acknowledge successful job completion
   */
  acknowledge(receiptHandle: string): Promise<void>;

  /**
   * Mark a job as failed (will be retried if attempts remain)
   */
  fail(receiptHandle: string, error: Error): Promise<void>;

  /**
   * Get a job by ID
   */
  getJob(jobId: string): Promise<Job | null>;

  /**
   * Get queue statistics
   */
  getStats(): Promise<QueueStats>;

  /**
   * Close the provider and release resources
   */
  close(): Promise<void>;
}

/**
 * Events emitted by queue providers
 */
export interface QueueEvents {
  /** Emitted when a job is enqueued */
  enqueued: (job: Job) => void;
  /** Emitted when a job starts processing */
  processing: (job: Job) => void;
  /** Emitted when a job completes successfully */
  completed: (job: Job) => void;
  /** Emitted when a job fails (may be retried) */
  failed: (job: Job, error: Error) => void;
  /** Emitted when a job is dead (no more retries) */
  dead: (job: Job) => void;
}
