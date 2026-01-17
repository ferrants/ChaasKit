#!/usr/bin/env node
/**
 * Standalone Queue Worker CLI
 *
 * Runs queue workers as a separate process from the main server.
 * Useful for:
 * - Scaling workers independently from web servers
 * - Running workers on dedicated compute (e.g., ECS tasks, K8s jobs)
 * - Separating concerns in production deployments
 *
 * Usage:
 *   pnpm queue-worker
 *
 * Environment variables:
 *   QUEUE_CONCURRENCY - Number of concurrent job processors (default: 5)
 *   QUEUE_POLL_INTERVAL - Fallback poll interval in ms (default: 1000)
 *   QUEUE_SHUTDOWN_TIMEOUT - Graceful shutdown timeout in ms (default: 30000)
 *   SCHEDULER_ENABLED - Enable the scheduler (default: false)
 *   SCHEDULER_POLL_INTERVAL - Scheduler poll interval in ms (default: 60000)
 */

import 'dotenv/config';
import { loadConfigAsync, getConfig } from '../config/loader.js';
import {
  initializeQueueProvider,
  closeQueueProvider,
  getQueueProvider,
  startWorker,
  stopWorker,
  startScheduler,
  stopScheduler,
} from './index.js';

// Parse environment variables
const concurrency = parseInt(process.env.QUEUE_CONCURRENCY || '5', 10);
const pollInterval = parseInt(process.env.QUEUE_POLL_INTERVAL || '1000', 10);
const shutdownTimeout = parseInt(process.env.QUEUE_SHUTDOWN_TIMEOUT || '30000', 10);
const schedulerEnabled = process.env.SCHEDULER_ENABLED === 'true';
const schedulerPollInterval = parseInt(process.env.SCHEDULER_POLL_INTERVAL || '60000', 10);

async function main(): Promise<void> {
  console.log('[Queue Worker] Starting standalone worker...');
  console.log(`[Queue Worker] Concurrency: ${concurrency}`);
  console.log(`[Queue Worker] Scheduler: ${schedulerEnabled ? 'enabled' : 'disabled'}`);

  // Load application config
  await loadConfigAsync();
  const config = getConfig();

  if (!config.queue?.enabled) {
    console.error('[Queue Worker] Queue system is disabled in config');
    process.exit(1);
  }

  // Initialize queue provider
  await initializeQueueProvider(config.queue);
  const provider = getQueueProvider();

  // Start worker
  const workerConfig = {
    mode: 'standalone' as const,
    concurrency,
    pollInterval,
    shutdownTimeout,
  };

  console.log('[Queue Worker] Starting worker...');
  await startWorker({ provider, config: workerConfig });
  console.log('[Queue Worker] Worker started');

  // Start scheduler if enabled
  if (schedulerEnabled || config.queue.scheduler?.enabled) {
    const schedulerConfig = {
      enabled: true,
      pollInterval: schedulerPollInterval,
    };

    console.log('[Queue Worker] Starting scheduler...');
    await startScheduler({ provider, config: schedulerConfig });
    console.log('[Queue Worker] Scheduler started');
  }

  // Setup graceful shutdown
  let isShuttingDown = false;

  const shutdown = async (signal: string) => {
    if (isShuttingDown) {
      console.log('[Queue Worker] Forced shutdown');
      process.exit(1);
    }

    isShuttingDown = true;
    console.log(`[Queue Worker] Received ${signal}, shutting down...`);

    try {
      await stopScheduler();
      await stopWorker();
      await closeQueueProvider();
      console.log('[Queue Worker] Shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('[Queue Worker] Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  console.log('[Queue Worker] Ready and waiting for jobs...');
}

main().catch((error) => {
  console.error('[Queue Worker] Fatal error:', error);
  process.exit(1);
});
