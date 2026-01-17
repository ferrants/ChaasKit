/**
 * AWS SQS Queue Provider
 *
 * Production-ready queue provider using Amazon SQS.
 * Features:
 * - Long polling for efficient message retrieval
 * - Visibility timeout for at-least-once delivery
 * - Optional dead letter queue support
 * - Message deduplication (for FIFO queues)
 *
 * Requires @aws-sdk/client-sqs to be installed:
 *   pnpm add @aws-sdk/client-sqs
 */

import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  ChangeMessageVisibilityCommand,
  GetQueueAttributesCommand,
  type Message as SQSMessage,
} from '@aws-sdk/client-sqs';
import { randomUUID } from 'crypto';
import type { SQSQueueProviderConfig } from '@chaaskit/shared';
import type {
  QueueProvider,
  Job,
  ReceivedJob,
  EnqueueOptions,
  JobOptions,
  QueueStats,
  JobStatus,
} from '../types.js';

// SQS max delay is 15 minutes (900 seconds)
const SQS_MAX_DELAY_SECONDS = 900;

// Job metadata stored in SQS message attributes
interface JobMetadata {
  id: string;
  type: string;
  options: JobOptions;
  status: JobStatus;
  attempts: number;
  createdAt: string;
  scheduledFor?: string;
}

/**
 * AWS SQS Queue Provider
 */
export class SQSQueueProvider implements QueueProvider {
  readonly name = 'sqs';

  private client: SQSClient;
  private queueUrl: string;
  private deadLetterQueueUrl?: string;
  private visibilityTimeout: number;
  private closed = false;

  // In-memory tracking for job metadata (SQS doesn't store this)
  private jobMetadata: Map<string, JobMetadata> = new Map();

  constructor(config: SQSQueueProviderConfig) {
    this.client = new SQSClient({
      region: config.region,
    });
    this.queueUrl = config.queueUrl;
    this.deadLetterQueueUrl = config.deadLetterQueueUrl;
    this.visibilityTimeout = config.visibilityTimeout ?? 30;

    console.log(`[SQS] Initialized with queue: ${this.queueUrl}`);
  }

  async enqueue<T>(type: string, payload: T, options?: EnqueueOptions): Promise<Job<T>> {
    if (this.closed) {
      throw new Error('Queue provider is closed');
    }

    const now = new Date();
    const jobOptions: JobOptions = {
      maxRetries: options?.maxRetries ?? 3,
      timeout: options?.timeout ?? 30000,
      priority: options?.priority ?? 0,
      deduplicationKey: options?.deduplicationKey,
    };

    const jobId = randomUUID();
    let delaySeconds = 0;
    let scheduledFor: Date | undefined;
    let status: JobStatus = 'pending';

    // Handle delay
    if (options?.scheduledFor) {
      const delayMs = options.scheduledFor.getTime() - now.getTime();
      if (delayMs > 0) {
        // SQS max delay is 15 minutes
        if (delayMs > SQS_MAX_DELAY_SECONDS * 1000) {
          // For longer delays, caller should use the scheduler
          console.warn(
            `[SQS] Delay of ${delayMs}ms exceeds SQS max (${SQS_MAX_DELAY_SECONDS}s). ` +
              'Consider using the scheduler for long delays.'
          );
          delaySeconds = SQS_MAX_DELAY_SECONDS;
        } else {
          delaySeconds = Math.ceil(delayMs / 1000);
        }
        scheduledFor = options.scheduledFor;
        status = 'scheduled';
      }
    } else if (options?.delay) {
      if (options.delay > SQS_MAX_DELAY_SECONDS * 1000) {
        console.warn(
          `[SQS] Delay of ${options.delay}ms exceeds SQS max (${SQS_MAX_DELAY_SECONDS}s). ` +
            'Consider using the scheduler for long delays.'
        );
        delaySeconds = SQS_MAX_DELAY_SECONDS;
      } else {
        delaySeconds = Math.ceil(options.delay / 1000);
      }
      scheduledFor = new Date(now.getTime() + delaySeconds * 1000);
      status = delaySeconds > 0 ? 'scheduled' : 'pending';
    }

    // Create job metadata
    const metadata: JobMetadata = {
      id: jobId,
      type,
      options: jobOptions,
      status,
      attempts: 0,
      createdAt: now.toISOString(),
      scheduledFor: scheduledFor?.toISOString(),
    };

    // Store metadata locally
    this.jobMetadata.set(jobId, metadata);

    // Build message body
    const messageBody = JSON.stringify({
      jobId,
      type,
      payload,
      options: jobOptions,
      createdAt: now.toISOString(),
      scheduledFor: scheduledFor?.toISOString(),
    });

    // Send to SQS
    const command = new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: messageBody,
      DelaySeconds: delaySeconds,
      MessageAttributes: {
        JobId: { DataType: 'String', StringValue: jobId },
        JobType: { DataType: 'String', StringValue: type },
      },
      // For FIFO queues, use deduplication key
      ...(options?.deduplicationKey && {
        MessageDeduplicationId: options.deduplicationKey,
        MessageGroupId: type, // Group by job type for ordering
      }),
    });

    await this.client.send(command);

    const job: Job<T> = {
      id: jobId,
      type,
      payload,
      options: jobOptions,
      status,
      attempts: 0,
      createdAt: now,
      scheduledFor,
    };

    console.log(`[SQS] Enqueued job ${jobId} (type: ${type}${delaySeconds > 0 ? `, delay: ${delaySeconds}s` : ''})`);

    return job;
  }

  async receive(maxMessages = 1, waitTimeSeconds = 20): Promise<ReceivedJob[]> {
    if (this.closed) {
      return [];
    }

    // Long polling - blocks until messages arrive or timeout
    const command = new ReceiveMessageCommand({
      QueueUrl: this.queueUrl,
      MaxNumberOfMessages: Math.min(maxMessages, 10), // SQS max is 10
      WaitTimeSeconds: Math.min(waitTimeSeconds, 20), // SQS max is 20
      VisibilityTimeout: this.visibilityTimeout,
      MessageAttributeNames: ['All'],
      MessageSystemAttributeNames: ['ApproximateReceiveCount'],
    });

    const response = await this.client.send(command);

    if (!response.Messages || response.Messages.length === 0) {
      return [];
    }

    const jobs: ReceivedJob[] = [];

    for (const message of response.Messages) {
      try {
        const job = this.parseMessage(message);
        if (job) {
          jobs.push(job);
        }
      } catch (error) {
        console.error('[SQS] Failed to parse message:', error);
        // Delete malformed message to prevent infinite retries
        if (message.ReceiptHandle) {
          try {
            await this.deleteMessage(message.ReceiptHandle);
          } catch {
            // Ignore deletion errors
          }
        }
      }
    }

    return jobs;
  }

  async acknowledge(receiptHandle: string): Promise<void> {
    await this.deleteMessage(receiptHandle);
    console.log('[SQS] Acknowledged message');
  }

  async fail(receiptHandle: string, error: Error): Promise<void> {
    // Make message visible again immediately for retry
    // The retry delay is handled by SQS's built-in retry mechanism
    try {
      const command = new ChangeMessageVisibilityCommand({
        QueueUrl: this.queueUrl,
        ReceiptHandle: receiptHandle,
        VisibilityTimeout: 0, // Make visible immediately
      });
      await this.client.send(command);
      console.log('[SQS] Failed message, returning to queue:', error.message);
    } catch (sqsError) {
      // If changing visibility fails, the message will eventually become visible again
      console.error('[SQS] Failed to change message visibility:', sqsError);
    }
  }

  async getJob(jobId: string): Promise<Job | null> {
    // SQS doesn't support fetching by ID, use local metadata
    const metadata = this.jobMetadata.get(jobId);
    if (!metadata) {
      return null;
    }

    return {
      id: metadata.id,
      type: metadata.type,
      payload: null, // Payload not stored in metadata
      options: metadata.options,
      status: metadata.status,
      attempts: metadata.attempts,
      createdAt: new Date(metadata.createdAt),
      scheduledFor: metadata.scheduledFor ? new Date(metadata.scheduledFor) : undefined,
    };
  }

  async getStats(): Promise<QueueStats> {
    try {
      const command = new GetQueueAttributesCommand({
        QueueUrl: this.queueUrl,
        AttributeNames: [
          'ApproximateNumberOfMessages',
          'ApproximateNumberOfMessagesNotVisible',
          'ApproximateNumberOfMessagesDelayed',
        ],
      });

      const response = await this.client.send(command);
      const attrs = response.Attributes || {};

      return {
        pending: parseInt(attrs.ApproximateNumberOfMessages || '0', 10),
        processing: parseInt(attrs.ApproximateNumberOfMessagesNotVisible || '0', 10),
        scheduled: parseInt(attrs.ApproximateNumberOfMessagesDelayed || '0', 10),
        completed: 0, // SQS doesn't track completed
        failed: 0, // Would need DLQ stats
        dead: 0,
      };
    } catch (error) {
      console.error('[SQS] Failed to get queue stats:', error);
      return { pending: 0, processing: 0, completed: 0, failed: 0, dead: 0, scheduled: 0 };
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    this.client.destroy();
    console.log('[SQS] Provider closed');
  }

  private async deleteMessage(receiptHandle: string): Promise<void> {
    const command = new DeleteMessageCommand({
      QueueUrl: this.queueUrl,
      ReceiptHandle: receiptHandle,
    });
    await this.client.send(command);
  }

  private parseMessage(message: SQSMessage): ReceivedJob | null {
    if (!message.Body || !message.ReceiptHandle) {
      return null;
    }

    const body = JSON.parse(message.Body);
    const receiveCount = parseInt(message.Attributes?.ApproximateReceiveCount || '1', 10);

    // Update local metadata
    const metadata = this.jobMetadata.get(body.jobId);
    if (metadata) {
      metadata.attempts = receiveCount;
      metadata.status = 'processing';
    }

    return {
      id: body.jobId,
      type: body.type,
      payload: body.payload,
      options: body.options,
      status: 'processing',
      attempts: receiveCount,
      createdAt: new Date(body.createdAt),
      scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : undefined,
      receiptHandle: message.ReceiptHandle,
    };
  }
}
