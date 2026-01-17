import type { Application } from 'express';
import type { Server } from 'http';
import type { AppConfig } from '@chaaskit/shared';
import { createApp, type CreateAppOptions } from './app.js';
import { getConfig } from './config/loader.js';
import { mcpManager } from './mcp/client.js';
import {
  initializeQueueProvider,
  closeQueueProvider,
  startWorker,
  stopWorker,
  getQueueProvider,
  startScheduler,
  stopScheduler,
} from './queue/index.js';
import {
  initializeEmailProvider,
  closeEmailProvider,
} from './services/email/index.js';

// Import scheduled prompt handlers to register them
import './queue/handlers/scheduled-prompt.js';
import { syncScheduledPromptsToRecurringJobs } from './services/scheduledPrompts.js';

export interface ServerOptions extends CreateAppOptions {
  /**
   * Port to listen on. Defaults to PORT env var or 3000.
   */
  port?: number;
}

export interface ServerInstance {
  app: Application;
  server: Server;
  port: number;
  close: () => Promise<void>;
}

/**
 * Initialize the queue system based on configuration.
 * Starts the worker and scheduler in in-process mode if configured.
 */
async function initializeQueue(): Promise<void> {
  const config = getConfig();

  if (!config.queue?.enabled) {
    console.log('[Queue] Queue system is disabled');
    return;
  }

  // Initialize the queue provider
  await initializeQueueProvider(config.queue);
  const provider = getQueueProvider();

  // Start worker if in-process mode
  const workerMode = config.queue.worker?.mode ?? 'in-process';
  if (workerMode === 'in-process') {
    const workerConfig = {
      mode: workerMode,
      concurrency: config.queue.worker?.concurrency ?? 5,
      pollInterval: config.queue.worker?.pollInterval ?? 1000,
      shutdownTimeout: config.queue.worker?.shutdownTimeout ?? 30000,
    };

    console.log('[Queue] Starting in-process worker...');
    await startWorker({ provider, config: workerConfig });
    console.log('[Queue] In-process worker started');
  } else {
    console.log('[Queue] Worker mode is standalone - not starting worker');
    console.log('[Queue] Run `pnpm queue-worker` to start standalone workers');
  }

  // Start scheduler if enabled
  if (config.queue.scheduler?.enabled) {
    const schedulerConfig = {
      enabled: true,
      pollInterval: config.queue.scheduler.pollInterval ?? 60000,
    };

    console.log('[Queue] Starting scheduler...');
    await startScheduler({ provider, config: schedulerConfig });
    console.log('[Queue] Scheduler started');
  }
}

/**
 * Initialize email provider based on configuration.
 */
async function initializeEmail(): Promise<void> {
  const config = getConfig();

  if (!config.email?.enabled) {
    console.log('[Email] Email system is disabled');
    return;
  }

  try {
    await initializeEmailProvider(config.email);
  } catch (error) {
    console.error('[Email] Failed to initialize:', error instanceof Error ? error.message : error);
  }
}

/**
 * Initialize scheduled prompts by syncing to recurring jobs.
 * Only runs if scheduler is enabled.
 */
async function initializeScheduledPrompts(): Promise<void> {
  const config = getConfig();

  if (!config.scheduledPrompts?.enabled) {
    console.log('[ScheduledPrompts] Feature is disabled');
    return;
  }

  if (!config.queue?.scheduler?.enabled) {
    console.log('[ScheduledPrompts] Scheduler is disabled, skipping sync');
    return;
  }

  try {
    const count = await syncScheduledPromptsToRecurringJobs();
    console.log(`[ScheduledPrompts] Synced ${count} enabled prompts to recurring jobs`);
  } catch (error) {
    console.error('[ScheduledPrompts] Failed to sync:', error instanceof Error ? error.message : error);
  }
}

/**
 * Initialize MCP servers based on configuration.
 * Only connects to servers that don't require user credentials at startup.
 */
async function initializeMCP(): Promise<void> {
  const config = getConfig();

  if (!config.mcp?.servers || config.mcp.servers.length === 0) {
    console.log('[MCP] No MCP servers configured');
    return;
  }

  // Filter to only servers that can connect without user credentials
  const globalServers = config.mcp.servers.filter(server => {
    const authMode = server.authMode || 'none';
    return authMode === 'none' || authMode === 'admin';
  });

  const userServers = config.mcp.servers.filter(server => {
    const authMode = server.authMode || 'none';
    return authMode === 'user-apikey' || authMode === 'user-oauth';
  });

  if (globalServers.length === 0 && userServers.length === 0) {
    console.log('[MCP] No MCP servers configured');
    return;
  }

  if (globalServers.length > 0) {
    console.log(`[MCP] Initializing ${globalServers.length} global MCP server(s)...`);
  }

  if (userServers.length > 0) {
    console.log(`[MCP] ${userServers.length} MCP server(s) require user credentials (will connect on-demand)`);
    for (const server of userServers) {
      if (server.enabled) {
        console.log(`[MCP]   - ${server.name} (${server.authMode})`);
      }
    }
  }

  for (const server of globalServers) {
    if (!server.enabled) {
      console.log(`[MCP] Skipping disabled server: ${server.name}`);
      continue;
    }

    try {
      await mcpManager.connect(server);
      console.log(`[MCP] Connected to ${server.name}`);
    } catch (error) {
      console.error(`[MCP] Failed to connect to ${server.name}:`, error instanceof Error ? error.message : error);
    }
  }
}

/**
 * Creates and starts an HTTP server with the ChaasKit application.
 */
export async function createServer(options: ServerOptions = {}): Promise<ServerInstance> {
  const app = await createApp(options);
  const port = options.port || parseInt(process.env.PORT || '3000', 10);

  return new Promise((resolve, reject) => {
    const server = app.listen(port, async () => {
      console.log(`Server running on port ${port}`);

      // Initialize MCP servers
      await initializeMCP();

      // Initialize email system
      await initializeEmail();

      // Initialize queue system
      await initializeQueue();

      // Sync scheduled prompts to recurring jobs
      await initializeScheduledPrompts();

      // Setup graceful shutdown
      let isShuttingDown = false;
      const shutdown = async () => {
        if (isShuttingDown) {
          // Already shutting down, force exit on second signal
          console.log('[Server] Forced shutdown');
          process.exit(1);
        }
        isShuttingDown = true;
        console.log('[Server] Shutting down...');

        try {
          // Stop queue system (worker and scheduler)
          await stopScheduler();
          await stopWorker();
          await closeQueueProvider();

          // Close email provider
          await closeEmailProvider();

          await mcpManager.disconnectAll();
          server.close(() => {
            console.log('[Server] Closed');
            process.exit(0);
          });
        } catch (error) {
          console.error('[Server] Error during shutdown:', error);
          process.exit(1);
        }
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);

      resolve({
        app,
        server,
        port,
        close: async () => {
          await stopScheduler();
          await stopWorker();
          await closeQueueProvider();
          await closeEmailProvider();
          await mcpManager.disconnectAll();
          return new Promise((res) => server.close(() => res()));
        },
      });
    });

    server.on('error', reject);
  });
}

/**
 * Convenience function to start the server and log to console.
 * For programmatic use, prefer createServer() which returns the server instance.
 */
export async function startServer(options: ServerOptions = {}): Promise<void> {
  await createServer(options);
}
