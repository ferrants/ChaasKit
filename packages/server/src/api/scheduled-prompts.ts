/**
 * Scheduled Prompts (Automations) API
 *
 * CRUD endpoints for scheduled prompts that run on a schedule,
 * create threads with results, and send notifications.
 */

import { Router } from 'express';
import { db } from '@chaaskit/db';
import { HTTP_STATUS } from '@chaaskit/shared';
import type {
  ScheduledPromptSummary,
  ScheduledPromptDetail,
  CreateScheduledPromptRequest,
  UpdateScheduledPromptRequest,
} from '@chaaskit/shared';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { getConfig } from '../config/loader.js';
import { getAgentById, getDefaultAgent, getAgentClientInfo } from '../services/agents.js';
import { getScheduler, getQueueProvider } from '../queue/index.js';
import { CronExpressionParser } from 'cron-parser';
import type { ScheduledPromptExecutePayload } from '../queue/handlers/scheduled-prompt.js';

export const scheduledPromptsRouter = Router();

// All routes require authentication
scheduledPromptsRouter.use(requireAuth);

/**
 * Helper to check if scheduled prompts feature is enabled
 */
function requireFeatureEnabled() {
  const config = getConfig();
  if (!config.scheduledPrompts?.enabled) {
    throw new AppError(HTTP_STATUS.FORBIDDEN, 'Scheduled prompts feature is disabled');
  }
}

/**
 * Get the user's plan limits for scheduled prompts
 */
function getPlanLimits(plan: string): { maxUserPrompts: number; maxTeamPrompts: number } {
  const config = getConfig().scheduledPrompts;
  if (!config) {
    return { maxUserPrompts: 0, maxTeamPrompts: 0 };
  }

  const planLimits = config.planLimits?.find((p) => p.plan === plan);

  return {
    maxUserPrompts: planLimits?.maxUserPrompts ?? config.defaultMaxUserPrompts ?? 0,
    maxTeamPrompts: planLimits?.maxTeamPrompts ?? config.defaultMaxTeamPrompts ?? 0,
  };
}

/**
 * Calculate next run time for a schedule
 */
function calculateNextRun(schedule: string, timezone: string): Date | null {
  // Try interval syntax first
  const intervalMatch = schedule.match(/^every\s+(\d+)\s+(second|minute|hour|day|week)s?$/i);
  if (intervalMatch) {
    const value = parseInt(intervalMatch[1], 10);
    const unit = intervalMatch[2].toLowerCase();
    const multipliers: Record<string, number> = {
      second: 1000,
      minute: 60 * 1000,
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
    };
    return new Date(Date.now() + value * (multipliers[unit] || 0));
  }

  // Parse as cron expression
  try {
    const interval = CronExpressionParser.parse(schedule, {
      currentDate: new Date(),
      tz: timezone,
    });
    return interval.next().toDate();
  } catch {
    return null;
  }
}

/**
 * Convert database record to summary response
 */
function toSummary(prompt: {
  id: string;
  name: string;
  schedule: string;
  timezone: string;
  enabled: boolean;
  agentId: string | null;
  lastRunAt: Date | null;
  lastRunStatus: string | null;
  runCount: number;
  userId: string | null;
  teamId: string | null;
}): ScheduledPromptSummary {
  const agent = prompt.agentId ? getAgentById(prompt.agentId) : getDefaultAgent();
  const agentName = agent?.name ?? 'Unknown';
  const nextRunAt = prompt.enabled
    ? calculateNextRun(prompt.schedule, prompt.timezone)
    : null;

  return {
    id: prompt.id,
    name: prompt.name,
    schedule: prompt.schedule,
    timezone: prompt.timezone,
    enabled: prompt.enabled,
    agentId: prompt.agentId,
    agentName,
    lastRunAt: prompt.lastRunAt?.toISOString() ?? null,
    lastRunStatus: prompt.lastRunStatus as 'success' | 'failed' | null,
    nextRunAt: nextRunAt?.toISOString() ?? null,
    runCount: prompt.runCount,
    userId: prompt.userId,
    teamId: prompt.teamId,
  };
}

/**
 * Convert database record to detail response
 */
function toDetail(prompt: {
  id: string;
  name: string;
  prompt: string;
  schedule: string;
  timezone: string;
  enabled: boolean;
  agentId: string | null;
  notifySlack: boolean;
  notifyEmail: boolean;
  emailRecipients: string | null;
  threadId: string | null;
  lastRunAt: Date | null;
  lastRunStatus: string | null;
  runCount: number;
  userId: string | null;
  teamId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ScheduledPromptDetail {
  const summary = toSummary(prompt);
  let emailRecipients: string[] = [];
  try {
    if (prompt.emailRecipients) {
      emailRecipients = JSON.parse(prompt.emailRecipients);
    }
  } catch {
    // Invalid JSON, return empty array
  }

  return {
    ...summary,
    prompt: prompt.prompt,
    notifySlack: prompt.notifySlack,
    notifyEmail: prompt.notifyEmail,
    emailRecipients,
    threadId: prompt.threadId,
    createdAt: prompt.createdAt.toISOString(),
    updatedAt: prompt.updatedAt.toISOString(),
  };
}

/**
 * Sync a scheduled prompt to the RecurringJob table
 */
async function syncToRecurringJob(promptId: string, enabled: boolean): Promise<void> {
  const scheduler = getScheduler();
  if (!scheduler) {
    return; // Scheduler not running
  }

  const recurringJobName = `scheduled-prompt:${promptId}`;

  if (!enabled) {
    // Disable the recurring job
    await scheduler.disableRecurring(recurringJobName);
    return;
  }

  // Get the prompt details
  const prompt = await db.scheduledPrompt.findUnique({
    where: { id: promptId },
  });

  if (!prompt) return;

  // Register/update the recurring job
  await scheduler.registerRecurring({
    name: recurringJobName,
    type: 'scheduled-prompt:execute',
    payload: { scheduledPromptId: promptId },
    schedule: prompt.schedule,
    timezone: prompt.timezone,
  });
}

/**
 * Remove a scheduled prompt's recurring job
 */
async function removeRecurringJob(promptId: string): Promise<void> {
  const recurringJobName = `scheduled-prompt:${promptId}`;

  await db.recurringJob.deleteMany({
    where: { name: recurringJobName },
  });
}

/**
 * GET /api/scheduled-prompts
 * List scheduled prompts for the current user and their teams
 *
 * Query params:
 * - teamId: Filter to specific team
 * - personal: Set to "true" to filter to personal prompts only
 */
scheduledPromptsRouter.get('/', async (req, res, next) => {
  try {
    requireFeatureEnabled();

    const userId = req.user!.id;
    const userPlan = req.user!.plan;
    const { teamId, personal } = req.query;

    // Build where clause
    const whereClause: {
      OR?: Array<{ userId?: string; teamId?: string }>;
      teamId?: string | null;
      userId?: string;
    } = {};

    // Variables for limits response
    let currentCount = 0;
    let maxCount = 0;
    let limitContext: 'personal' | 'team' | 'all' = 'all';

    if (teamId && typeof teamId === 'string') {
      // Filter to specific team - verify membership
      const membership = await db.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId,
            userId,
          },
        },
        include: { team: true },
      });

      if (!membership) {
        throw new AppError(HTTP_STATUS.FORBIDDEN, 'Not a member of this team');
      }

      whereClause.teamId = teamId;
      limitContext = 'team';

      // Get limits for this team
      const teamPlan = membership.team.plan;
      const limits = getPlanLimits(teamPlan);
      maxCount = limits.maxTeamPrompts;
      currentCount = await db.scheduledPrompt.count({
        where: { teamId },
      });
    } else if (personal === 'true') {
      // Filter to personal prompts only
      whereClause.userId = userId;
      whereClause.teamId = null;
      limitContext = 'personal';

      // Get limits for user
      const limits = getPlanLimits(userPlan);
      maxCount = limits.maxUserPrompts;
      currentCount = await db.scheduledPrompt.count({
        where: { userId, teamId: null },
      });
    } else {
      // Get user's prompts + team prompts they can access
      const teamMemberships = await db.teamMember.findMany({
        where: { userId },
        select: { teamId: true },
      });

      const teamIds = teamMemberships.map((m) => m.teamId);

      whereClause.OR = [
        { userId },
        ...(teamIds.length > 0 ? teamIds.map((id) => ({ teamId: id })) : []),
      ];
    }

    const prompts = await db.scheduledPrompt.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    const summaries = prompts.map(toSummary);

    res.json({
      prompts: summaries,
      limits: {
        context: limitContext,
        current: currentCount,
        max: maxCount,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/scheduled-prompts/:id
 * Get a single scheduled prompt
 */
scheduledPromptsRouter.get('/:id', async (req, res, next) => {
  try {
    requireFeatureEnabled();

    const userId = req.user!.id;
    const { id } = req.params;

    const prompt = await db.scheduledPrompt.findUnique({
      where: { id },
    });

    if (!prompt) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Scheduled prompt not found');
    }

    // Check access
    if (prompt.userId && prompt.userId !== userId) {
      throw new AppError(HTTP_STATUS.FORBIDDEN, 'Access denied');
    }

    if (prompt.teamId) {
      const membership = await db.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId: prompt.teamId,
            userId,
          },
        },
      });

      if (!membership) {
        throw new AppError(HTTP_STATUS.FORBIDDEN, 'Access denied');
      }
    }

    res.json({ prompt: toDetail(prompt) });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/scheduled-prompts
 * Create a new scheduled prompt
 */
scheduledPromptsRouter.post('/', async (req, res, next) => {
  try {
    requireFeatureEnabled();

    const userId = req.user!.id;
    const userPlan = req.user!.plan;
    const body = req.body as CreateScheduledPromptRequest;

    // Validate required fields
    if (!body.name?.trim()) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Name is required');
    }
    if (!body.prompt?.trim()) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Prompt is required');
    }
    if (!body.schedule?.trim()) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Schedule is required');
    }

    // Validate schedule format
    const timezone = body.timezone || 'UTC';
    const nextRun = calculateNextRun(body.schedule, timezone);
    if (!nextRun) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Invalid schedule format');
    }

    // Validate agent if provided
    if (body.agentId) {
      const agent = getAgentById(body.agentId);
      if (!agent) {
        throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Invalid agent');
      }
    }

    // Determine ownership and check limits
    let ownerUserId: string | null = null;
    let ownerTeamId: string | null = null;

    if (body.teamId) {
      // Creating for team - check membership and admin role
      const membership = await db.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId: body.teamId,
            userId,
          },
        },
        include: { team: true },
      });

      if (!membership) {
        throw new AppError(HTTP_STATUS.FORBIDDEN, 'Not a member of this team');
      }

      if (membership.role !== 'owner' && membership.role !== 'admin') {
        throw new AppError(HTTP_STATUS.FORBIDDEN, 'Only team owners and admins can create scheduled prompts');
      }

      // Check team limit
      const teamPlan = membership.team.plan;
      const limits = getPlanLimits(teamPlan);
      const currentCount = await db.scheduledPrompt.count({
        where: { teamId: body.teamId },
      });

      if (currentCount >= limits.maxTeamPrompts) {
        throw new AppError(
          HTTP_STATUS.FORBIDDEN,
          `Team plan limit reached (${limits.maxTeamPrompts} scheduled prompts)`
        );
      }

      ownerTeamId = body.teamId;
    } else {
      // Creating for user
      const limits = getPlanLimits(userPlan);
      const currentCount = await db.scheduledPrompt.count({
        where: { userId },
      });

      if (currentCount >= limits.maxUserPrompts) {
        throw new AppError(
          HTTP_STATUS.FORBIDDEN,
          `Plan limit reached (${limits.maxUserPrompts} scheduled prompts)`
        );
      }

      ownerUserId = userId;
    }

    // Create the scheduled prompt
    const prompt = await db.scheduledPrompt.create({
      data: {
        name: body.name.trim(),
        prompt: body.prompt.trim(),
        agentId: body.agentId || null,
        schedule: body.schedule.trim(),
        timezone,
        enabled: true,
        notifySlack: body.notifySlack ?? true,
        notifyEmail: body.notifyEmail ?? false,
        emailRecipients: body.emailRecipients ? JSON.stringify(body.emailRecipients) : null,
        userId: ownerUserId,
        teamId: ownerTeamId,
      },
    });

    // Sync to recurring job
    await syncToRecurringJob(prompt.id, true);

    res.status(HTTP_STATUS.CREATED).json({ prompt: toDetail(prompt) });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/scheduled-prompts/:id
 * Update an existing scheduled prompt
 */
scheduledPromptsRouter.put('/:id', async (req, res, next) => {
  try {
    requireFeatureEnabled();

    const userId = req.user!.id;
    const { id } = req.params;
    const body = req.body as UpdateScheduledPromptRequest;

    // Get existing prompt
    const existing = await db.scheduledPrompt.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Scheduled prompt not found');
    }

    // Check access - only owner or team admin can update
    if (existing.userId && existing.userId !== userId) {
      throw new AppError(HTTP_STATUS.FORBIDDEN, 'Access denied');
    }

    if (existing.teamId) {
      const membership = await db.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId: existing.teamId,
            userId,
          },
        },
      });

      if (!membership) {
        throw new AppError(HTTP_STATUS.FORBIDDEN, 'Access denied');
      }

      if (membership.role !== 'owner' && membership.role !== 'admin') {
        throw new AppError(HTTP_STATUS.FORBIDDEN, 'Only team owners and admins can update scheduled prompts');
      }
    }

    // Validate schedule if provided
    if (body.schedule) {
      const timezone = body.timezone || existing.timezone;
      const nextRun = calculateNextRun(body.schedule, timezone);
      if (!nextRun) {
        throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Invalid schedule format');
      }
    }

    // Validate agent if provided
    if (body.agentId !== undefined && body.agentId !== null) {
      const agent = getAgentById(body.agentId);
      if (!agent) {
        throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Invalid agent');
      }
    }

    // Update the prompt
    const prompt = await db.scheduledPrompt.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.prompt !== undefined && { prompt: body.prompt.trim() }),
        ...(body.agentId !== undefined && { agentId: body.agentId }),
        ...(body.schedule !== undefined && { schedule: body.schedule.trim() }),
        ...(body.timezone !== undefined && { timezone: body.timezone }),
        ...(body.enabled !== undefined && { enabled: body.enabled }),
        ...(body.notifySlack !== undefined && { notifySlack: body.notifySlack }),
        ...(body.notifyEmail !== undefined && { notifyEmail: body.notifyEmail }),
        ...(body.emailRecipients !== undefined && {
          emailRecipients: JSON.stringify(body.emailRecipients || []),
        }),
      },
    });

    // Sync to recurring job
    const enabled = body.enabled !== undefined ? body.enabled : existing.enabled;
    await syncToRecurringJob(prompt.id, enabled);

    res.json({ prompt: toDetail(prompt) });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/scheduled-prompts/:id
 * Delete a scheduled prompt
 */
scheduledPromptsRouter.delete('/:id', async (req, res, next) => {
  try {
    requireFeatureEnabled();

    const userId = req.user!.id;
    const { id } = req.params;

    // Get existing prompt
    const existing = await db.scheduledPrompt.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Scheduled prompt not found');
    }

    // Check access
    if (existing.userId && existing.userId !== userId) {
      throw new AppError(HTTP_STATUS.FORBIDDEN, 'Access denied');
    }

    if (existing.teamId) {
      const membership = await db.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId: existing.teamId,
            userId,
          },
        },
      });

      if (!membership) {
        throw new AppError(HTTP_STATUS.FORBIDDEN, 'Access denied');
      }

      if (membership.role !== 'owner' && membership.role !== 'admin') {
        throw new AppError(HTTP_STATUS.FORBIDDEN, 'Only team owners and admins can delete scheduled prompts');
      }
    }

    // Remove recurring job
    await removeRecurringJob(id);

    // Delete the prompt
    await db.scheduledPrompt.delete({
      where: { id },
    });

    res.status(HTTP_STATUS.NO_CONTENT).send();
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/scheduled-prompts/:id/run
 * Manually trigger a scheduled prompt
 */
scheduledPromptsRouter.post('/:id/run', async (req, res, next) => {
  try {
    requireFeatureEnabled();

    const userId = req.user!.id;
    const { id } = req.params;

    // Get the prompt
    const prompt = await db.scheduledPrompt.findUnique({
      where: { id },
    });

    if (!prompt) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Scheduled prompt not found');
    }

    // Check access
    if (prompt.userId && prompt.userId !== userId) {
      throw new AppError(HTTP_STATUS.FORBIDDEN, 'Access denied');
    }

    if (prompt.teamId) {
      const membership = await db.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId: prompt.teamId,
            userId,
          },
        },
      });

      if (!membership) {
        throw new AppError(HTTP_STATUS.FORBIDDEN, 'Access denied');
      }
    }

    // Enqueue the job immediately
    const queue = getQueueProvider();
    const job = await queue.enqueue<ScheduledPromptExecutePayload>(
      'scheduled-prompt:execute',
      { scheduledPromptId: id }
    );

    res.json({ message: 'Run triggered', jobId: job.id });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/scheduled-prompts/:id/history
 * Get run history for a scheduled prompt (via thread messages)
 */
scheduledPromptsRouter.get('/:id/history', async (req, res, next) => {
  try {
    requireFeatureEnabled();

    const userId = req.user!.id;
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;

    // Get the prompt
    const prompt = await db.scheduledPrompt.findUnique({
      where: { id },
      include: {
        thread: {
          include: {
            messages: {
              where: { role: 'user' },
              orderBy: { createdAt: 'desc' },
              take: limit,
              select: {
                id: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!prompt) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Scheduled prompt not found');
    }

    // Check access
    if (prompt.userId && prompt.userId !== userId) {
      throw new AppError(HTTP_STATUS.FORBIDDEN, 'Access denied');
    }

    if (prompt.teamId) {
      const membership = await db.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId: prompt.teamId,
            userId,
          },
        },
      });

      if (!membership) {
        throw new AppError(HTTP_STATUS.FORBIDDEN, 'Access denied');
      }
    }

    // Build history from thread messages
    const history = prompt.thread?.messages.map((msg: { id: string; createdAt: Date }) => ({
      id: msg.id,
      runAt: msg.createdAt.toISOString(),
    })) ?? [];

    res.json({
      history,
      threadId: prompt.threadId,
      runCount: prompt.runCount,
      lastRunAt: prompt.lastRunAt?.toISOString() ?? null,
      lastRunStatus: prompt.lastRunStatus,
    });
  } catch (error) {
    next(error);
  }
});
