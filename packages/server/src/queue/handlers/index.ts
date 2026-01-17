/**
 * Job Handler Registry
 *
 * Provides a central registry for job handlers. Job handlers are functions
 * that process jobs of a specific type.
 *
 * @example
 * ```typescript
 * import { registerJobHandler } from './queue/handlers/index.js';
 *
 * registerJobHandler('email:send', async (job, ctx) => {
 *   ctx.log('Sending email to', job.payload.to);
 *   await sendEmail(job.payload);
 * });
 * ```
 */

import type { JobHandler, ReceivedJob, JobContext } from '../types.js';

export interface RegisteredHandler {
  handler: JobHandler;
  description?: string;
}

// Registry of job handlers by type
const handlers = new Map<string, RegisteredHandler>();

/**
 * Register a handler for a specific job type.
 *
 * @param type - The job type to handle (e.g., 'email:send', 'report:generate')
 * @param handler - The function that processes jobs of this type
 * @param description - Optional description for debugging/monitoring
 */
export function registerJobHandler<TPayload = unknown, TResult = unknown>(
  type: string,
  handler: JobHandler<TPayload, TResult>,
  description?: string
): void {
  if (handlers.has(type)) {
    console.warn(`[Queue] Overwriting existing handler for job type: ${type}`);
  }

  handlers.set(type, {
    handler: handler as JobHandler,
    description,
  });

  console.log(`[Queue] Registered handler for job type: ${type}${description ? ` (${description})` : ''}`);
}

/**
 * Get the handler for a specific job type.
 *
 * @param type - The job type
 * @returns The registered handler, or undefined if not found
 */
export function getJobHandler(type: string): RegisteredHandler | undefined {
  return handlers.get(type);
}

/**
 * Check if a handler exists for a specific job type.
 *
 * @param type - The job type
 * @returns True if a handler is registered
 */
export function hasJobHandler(type: string): boolean {
  return handlers.has(type);
}

/**
 * Get all registered job types.
 *
 * @returns Array of registered job type strings
 */
export function getRegisteredJobTypes(): string[] {
  return Array.from(handlers.keys());
}

/**
 * Unregister a handler (mainly for testing).
 *
 * @param type - The job type to unregister
 */
export function unregisterJobHandler(type: string): boolean {
  return handlers.delete(type);
}

/**
 * Clear all handlers (mainly for testing).
 */
export function clearJobHandlers(): void {
  handlers.clear();
}

/**
 * Execute a job using its registered handler.
 *
 * @param job - The job to execute
 * @param ctx - The job context
 * @returns The result from the handler
 * @throws Error if no handler is registered for the job type
 */
export async function executeJob<TPayload = unknown, TResult = unknown>(
  job: ReceivedJob<TPayload>,
  ctx: JobContext
): Promise<TResult> {
  const registered = handlers.get(job.type);

  if (!registered) {
    throw new Error(`No handler registered for job type: ${job.type}`);
  }

  return registered.handler(job, ctx) as Promise<TResult>;
}
