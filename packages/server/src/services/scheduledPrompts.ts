/**
 * Scheduled Prompts Service
 *
 * Manages scheduled prompts lifecycle and sync with recurring jobs.
 */

import { db } from '@chaaskit/db';
import { getScheduler } from '../queue/index.js';

/**
 * Sync all enabled scheduled prompts to recurring jobs.
 * Called on server startup to ensure scheduler has all jobs.
 *
 * @returns Number of prompts synced
 */
export async function syncScheduledPromptsToRecurringJobs(): Promise<number> {
  const scheduler = getScheduler();
  if (!scheduler) {
    console.log('[ScheduledPrompts] Scheduler not available');
    return 0;
  }

  // Get all enabled scheduled prompts
  const prompts = await db.scheduledPrompt.findMany({
    where: { enabled: true },
  });

  console.log(`[ScheduledPrompts] Found ${prompts.length} enabled prompts to sync`);

  for (const prompt of prompts) {
    const recurringJobName = `scheduled-prompt:${prompt.id}`;

    try {
      await scheduler.registerRecurring({
        name: recurringJobName,
        type: 'scheduled-prompt:execute',
        payload: { scheduledPromptId: prompt.id },
        schedule: prompt.schedule,
        timezone: prompt.timezone,
      });
    } catch (error) {
      console.error(
        `[ScheduledPrompts] Failed to sync prompt ${prompt.id}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  // Clean up orphaned recurring jobs (prompts that were deleted while server was down)
  const allRecurringJobs = await db.recurringJob.findMany({
    where: {
      name: { startsWith: 'scheduled-prompt:' },
    },
  });

  const promptIds = new Set(prompts.map((p: { id: string }) => p.id));

  for (const job of allRecurringJobs) {
    const promptId = job.name.replace('scheduled-prompt:', '');
    if (!promptIds.has(promptId)) {
      console.log(`[ScheduledPrompts] Cleaning up orphaned job: ${job.name}`);
      await db.recurringJob.delete({
        where: { id: job.id },
      }).catch(() => {
        // Ignore deletion errors
      });
    }
  }

  // Also disable recurring jobs for disabled prompts
  const disabledPrompts = await db.scheduledPrompt.findMany({
    where: { enabled: false },
  });

  for (const prompt of disabledPrompts) {
    const recurringJobName = `scheduled-prompt:${prompt.id}`;
    await scheduler.disableRecurring(recurringJobName).catch(() => {
      // Ignore if job doesn't exist
    });
  }

  return prompts.length;
}
