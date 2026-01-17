import type { QueueProviderConfig, QueueConfig } from '@chaaskit/shared';
import type { QueueProvider, Job, ReceivedJob, EnqueueOptions, QueueStats, JobHandler, JobContext } from './types.js';
import { MemoryQueueProvider } from './providers/memory.js';

// Re-export types
export type {
  QueueProvider,
  Job,
  ReceivedJob,
  EnqueueOptions,
  QueueStats,
  JobHandler,
  JobContext,
};
export * from './types.js';

// Re-export handlers
export {
  registerJobHandler,
  getJobHandler,
  hasJobHandler,
  getRegisteredJobTypes,
  unregisterJobHandler,
  clearJobHandlers,
  executeJob,
} from './handlers/index.js';

// Re-export worker
export {
  Worker,
  startWorker,
  stopWorker,
  getWorker,
  resetWorker,
  type WorkerOptions,
  type WorkerStats,
} from './worker.js';

// Re-export scheduler
export {
  Scheduler,
  startScheduler,
  stopScheduler,
  getScheduler,
  resetScheduler,
  type SchedulerOptions,
  type RecurringJobInput,
} from './scheduler.js';

let queueProvider: QueueProvider | null = null;

/**
 * Get default queue provider config for development
 */
export function getDefaultProviderConfig(): QueueProviderConfig {
  return {
    type: 'memory',
    maxHistorySize: 1000,
  };
}

/**
 * Create a queue provider based on configuration.
 * Uses dynamic imports for optional dependencies (SQS SDK only loaded if needed).
 */
export async function createQueueProvider(config: QueueProviderConfig): Promise<QueueProvider> {
  switch (config.type) {
    case 'memory':
      return new MemoryQueueProvider(config);

    case 'sqs':
      // Dynamic import - @aws-sdk/client-sqs is optional peer dependency
      try {
        const { SQSQueueProvider } = await import('./providers/sqs.js');
        return new SQSQueueProvider(config);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND') {
          throw new Error(
            'SQS provider requires @aws-sdk/client-sqs. Install it with: pnpm add @aws-sdk/client-sqs'
          );
        }
        throw e;
      }

    default:
      throw new Error(`Unknown queue provider type: ${(config as QueueProviderConfig).type}`);
  }
}

/**
 * Get or create the queue provider singleton.
 * Must be initialized with initializeQueueProvider() first, or returns a memory provider.
 */
export function getQueueProvider(): QueueProvider {
  if (!queueProvider) {
    // Default to memory provider if not initialized
    console.warn('[Queue] Provider not initialized, using default memory provider');
    queueProvider = new MemoryQueueProvider({ type: 'memory' });
  }
  return queueProvider;
}

/**
 * Initialize the queue provider singleton.
 * Call this during server startup with the app's queue config.
 */
export async function initializeQueueProvider(config: QueueConfig): Promise<QueueProvider> {
  if (queueProvider) {
    console.warn('[Queue] Provider already initialized');
    return queueProvider;
  }

  if (!config.enabled) {
    console.log('[Queue] Queue system is disabled');
    // Return a no-op provider that just logs
    queueProvider = new MemoryQueueProvider({ type: 'memory' });
    return queueProvider;
  }

  console.log(`[Queue] Initializing ${config.providerConfig.type} provider...`);
  queueProvider = await createQueueProvider(config.providerConfig);
  console.log(`[Queue] ${queueProvider.name} provider initialized`);

  return queueProvider;
}

/**
 * Close and reset the queue provider (for testing or shutdown)
 */
export async function closeQueueProvider(): Promise<void> {
  if (queueProvider) {
    await queueProvider.close();
    queueProvider = null;
    console.log('[Queue] Provider closed');
  }
}

/**
 * Reset the queue provider singleton (for testing)
 */
export function resetQueueProvider(): void {
  queueProvider = null;
}
