/**
 * Scheduled Prompt (Automation) Types
 *
 * Types for scheduled prompts that run on a schedule, create threads with results,
 * and send notifications via Slack and email.
 */

/**
 * Summary view of a scheduled prompt (for list view)
 */
export interface ScheduledPromptSummary {
  id: string;
  name: string;
  schedule: string;
  timezone: string;
  enabled: boolean;
  agentId: string | null;
  agentName: string;
  lastRunAt: string | null;
  lastRunStatus: 'success' | 'failed' | null;
  nextRunAt: string | null;
  runCount: number;
  // Ownership
  userId: string | null;
  teamId: string | null;
}

/**
 * Full details of a scheduled prompt
 */
export interface ScheduledPromptDetail extends ScheduledPromptSummary {
  prompt: string;
  notifySlack: boolean;
  notifyEmail: boolean;
  emailRecipients: string[];
  threadId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Request to create a new scheduled prompt
 */
export interface CreateScheduledPromptRequest {
  name: string;
  prompt: string;
  agentId?: string;
  schedule: string;
  timezone?: string;
  notifySlack?: boolean;
  notifyEmail?: boolean;
  emailRecipients?: string[];
  teamId?: string;  // If creating for team (user must be team admin)
}

/**
 * Request to update an existing scheduled prompt
 */
export interface UpdateScheduledPromptRequest {
  name?: string;
  prompt?: string;
  agentId?: string | null;
  schedule?: string;
  timezone?: string;
  enabled?: boolean;
  notifySlack?: boolean;
  notifyEmail?: boolean;
  emailRecipients?: string[];
}

/**
 * Run history entry for a scheduled prompt
 */
export interface ScheduledPromptRunHistory {
  id: string;
  scheduledPromptId: string;
  status: 'success' | 'failed';
  error?: string;
  threadId?: string;
  runAt: string;
  duration: number; // ms
}

/**
 * Common schedule presets for the UI
 */
export const SCHEDULE_PRESETS = [
  { label: 'Every morning (9 AM)', cron: '0 9 * * *' },
  { label: 'Every evening (6 PM)', cron: '0 18 * * *' },
  { label: 'Weekdays at 9 AM', cron: '0 9 * * 1-5' },
  { label: 'Every Monday', cron: '0 9 * * 1' },
  { label: 'First of month', cron: '0 9 1 * *' },
  { label: 'Every hour', cron: '0 * * * *' },
] as const;
