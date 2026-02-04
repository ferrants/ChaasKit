// Main library exports for @chaaskit/server
// This file exports factory functions and utilities for programmatic use.
// For CLI usage, use the bin/cli.ts entry point.

// App and Server factories
export { createApp, type CreateAppOptions } from './app.js';
export { createServer, startServer, type ServerOptions, type ServerInstance } from './server.js';

// Config management
export {
  loadConfigAsync,
  loadConfig,
  getConfig,
  setConfig,
  resetConfig,
} from './config/loader.js';

// Secrets management
export { loadSecrets } from './secrets/index.js';

// Registry and base classes for extensions
export {
  registry,
  BaseAgent,
  BasePricingPlan,
  BaseAuthProvider,
} from './registry/index.js';

// Extension loader
export { loadExtensions } from './extensions/loader.js';

// Services
export { createAgentService } from './services/agent.js';

// Queue system
export {
  // Provider
  createQueueProvider,
  initializeQueueProvider,
  closeQueueProvider,
  getQueueProvider,
  resetQueueProvider,
  getDefaultProviderConfig,
  // Worker
  Worker,
  startWorker,
  stopWorker,
  getWorker,
  resetWorker,
  // Scheduler
  Scheduler,
  startScheduler,
  stopScheduler,
  getScheduler,
  resetScheduler,
  // Handlers
  registerJobHandler,
  getJobHandler,
  hasJobHandler,
  getRegisteredJobTypes,
  unregisterJobHandler,
  clearJobHandlers,
  executeJob,
  // Types
  type QueueProvider,
  type Job,
  type ReceivedJob,
  type EnqueueOptions,
  type QueueStats,
  type JobHandler,
  type JobContext,
  type WorkerOptions,
  type WorkerStats,
  type SchedulerOptions,
  type RecurringJobInput,
} from './queue/index.js';

// Re-export useful types
export type { AppConfig } from '@chaaskit/shared';
