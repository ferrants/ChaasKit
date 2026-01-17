/**
 * Scheduled Prompt Job Handlers
 *
 * Handles execution and notification of scheduled prompts (automations).
 */

import { db } from '@chaaskit/db';
import { registerJobHandler, type ReceivedJob, type JobContext } from '../index.js';
import { createAgentService, type ChatMessage } from '../../services/agent.js';
import { getAgentById, getDefaultAgent, toAgentConfig, isBuiltInAgent } from '../../services/agents.js';
import { sendEmail, isEmailEnabled } from '../../services/email/index.js';
import { getConfig } from '../../config/loader.js';
import { getQueueProvider } from '../index.js';

// Job payloads
export interface ScheduledPromptExecutePayload {
  scheduledPromptId: string;
}

export interface ScheduledPromptNotifyPayload {
  scheduledPromptId: string;
  threadId: string;
  result: string;
  runDuration: number;
}

/**
 * scheduled-prompt:execute
 *
 * Executes a scheduled prompt:
 * 1. Loads the ScheduledPrompt with user/team context
 * 2. Gets or creates the dedicated thread
 * 3. Creates user message with the prompt
 * 4. Runs the agent and collects the response
 * 5. Saves the assistant message
 * 6. Updates tracking (lastRunAt, runCount)
 * 7. Enqueues notification job
 */
registerJobHandler<ScheduledPromptExecutePayload>(
  'scheduled-prompt:execute',
  async (job: ReceivedJob<ScheduledPromptExecutePayload>, ctx: JobContext) => {
    const { scheduledPromptId } = job.payload;
    const startTime = Date.now();

    ctx.log(`Executing scheduled prompt: ${scheduledPromptId}`);

    // 1. Load the scheduled prompt
    const prompt = await db.scheduledPrompt.findUnique({
      where: { id: scheduledPromptId },
      include: {
        thread: true,
        user: true,
        team: {
          include: {
            slackIntegration: true,
          },
        },
      },
    });

    if (!prompt) {
      throw new Error(`Scheduled prompt not found: ${scheduledPromptId}`);
    }

    if (!prompt.enabled) {
      ctx.log('Scheduled prompt is disabled, skipping execution');
      return;
    }

    ctx.log(`Running prompt: "${prompt.name}"`);

    try {
      // 2. Get or create dedicated thread
      let thread = prompt.thread;
      if (!thread) {
        thread = await db.thread.create({
          data: {
            title: `[Auto] ${prompt.name}`,
            userId: prompt.userId,
            teamId: prompt.teamId,
            agentId: prompt.agentId,
          },
        });

        // Update the scheduled prompt with the new thread
        await db.scheduledPrompt.update({
          where: { id: scheduledPromptId },
          data: { threadId: thread.id },
        });

        ctx.log(`Created new thread: ${thread.id}`);
      }

      // 3. Create user message
      await db.message.create({
        data: {
          threadId: thread.id,
          role: 'user',
          content: prompt.prompt,
        },
      });

      // 4. Get agent and run
      const agent = prompt.agentId
        ? getAgentById(prompt.agentId)
        : getDefaultAgent();

      if (!agent) {
        throw new Error(`Agent not found: ${prompt.agentId || 'default'}`);
      }

      const agentConfig = toAgentConfig(agent);
      const agentService = createAgentService(agentConfig);

      // Get system prompt
      let systemPrompt = 'You are a helpful assistant.';
      if (isBuiltInAgent(agent)) {
        systemPrompt = agent.systemPrompt;
      }

      // Add team context if applicable
      let teamContext: string | null = null;
      if (prompt.team?.context) {
        teamContext = prompt.team.context;
      }

      // Load thread messages for context
      const messages = await db.message.findMany({
        where: { threadId: thread.id },
        orderBy: { createdAt: 'asc' },
      });

      const chatMessages: ChatMessage[] = messages.map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      }));

      // Run agent
      let result = '';
      let inputTokens = 0;
      let outputTokens = 0;

      ctx.log('Running agent...');

      for await (const chunk of agentService.chat(chatMessages, {
        systemPrompt,
        teamContext,
      })) {
        if (chunk.type === 'text' && chunk.content) {
          result += chunk.content;
        } else if (chunk.type === 'usage' && chunk.usage) {
          inputTokens = chunk.usage.inputTokens;
          outputTokens = chunk.usage.outputTokens;
        }
      }

      ctx.log(`Agent response: ${result.length} chars, ${inputTokens} in / ${outputTokens} out`);

      // 5. Save assistant message
      await db.message.create({
        data: {
          threadId: thread.id,
          role: 'assistant',
          content: result,
          inputTokens,
          outputTokens,
        },
      });

      const runDuration = Date.now() - startTime;

      // 6. Update tracking
      await db.scheduledPrompt.update({
        where: { id: scheduledPromptId },
        data: {
          lastRunAt: new Date(),
          lastRunStatus: 'success',
          lastError: null,
          runCount: { increment: 1 },
        },
      });

      // 7. Enqueue notification
      if (prompt.notifySlack || prompt.notifyEmail) {
        const queue = getQueueProvider();
        await queue.enqueue<ScheduledPromptNotifyPayload>('scheduled-prompt:notify', {
          scheduledPromptId,
          threadId: thread.id,
          result,
          runDuration,
        });
        ctx.log('Notification job enqueued');
      }

      ctx.log(`Completed in ${runDuration}ms`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Update tracking with failure
      await db.scheduledPrompt.update({
        where: { id: scheduledPromptId },
        data: {
          lastRunAt: new Date(),
          lastRunStatus: 'failed',
          lastError: errorMessage,
        },
      });

      throw error;
    }
  },
  'Execute scheduled prompt and store result'
);

/**
 * scheduled-prompt:notify
 *
 * Sends notifications after a scheduled prompt completes:
 * 1. Slack notification (if enabled and team has integration)
 * 2. Email notification (if enabled and recipients configured)
 */
registerJobHandler<ScheduledPromptNotifyPayload>(
  'scheduled-prompt:notify',
  async (job: ReceivedJob<ScheduledPromptNotifyPayload>, ctx: JobContext) => {
    const { scheduledPromptId, threadId, result, runDuration } = job.payload;

    ctx.log(`Sending notifications for scheduled prompt: ${scheduledPromptId}`);

    // Load prompt with team and slack integration
    const prompt = await db.scheduledPrompt.findUnique({
      where: { id: scheduledPromptId },
      include: {
        user: true,
        team: {
          include: {
            slackIntegration: true,
          },
        },
      },
    });

    if (!prompt) {
      throw new Error(`Scheduled prompt not found: ${scheduledPromptId}`);
    }

    const config = getConfig();
    const appUrl = config.app.url;
    const appName = config.app.name;
    const threadUrl = `${appUrl}/chat/${threadId}`;

    // Helper to truncate text
    const truncate = (text: string, maxLength: number): string => {
      if (text.length <= maxLength) return text;
      return text.slice(0, maxLength - 3) + '...';
    };

    // Slack notification
    if (prompt.notifySlack && prompt.team?.slackIntegration) {
      try {
        const { SlackClient } = await import('../../services/slack/client.js');
        const integration = prompt.team.slackIntegration;

        if (integration.status === 'active' && integration.notificationChannel) {
          const client = SlackClient.fromEncrypted(integration.encryptedTokens);
          const message = [
            `*${prompt.name}* completed in ${(runDuration / 1000).toFixed(1)}s`,
            '',
            truncate(result, 500),
            '',
            `<${threadUrl}|View full thread>`,
          ].join('\n');

          await client.postMessage(integration.notificationChannel, message);

          ctx.log('Slack notification sent');
        }
      } catch (error) {
        ctx.log(`Slack notification failed: ${error instanceof Error ? error.message : error}`);
        // Don't throw - continue with email
      }
    }

    // Email notification
    if (prompt.notifyEmail && prompt.emailRecipients && isEmailEnabled()) {
      try {
        const emails: string[] = JSON.parse(prompt.emailRecipients);

        for (const email of emails) {
          await sendEmail({
            to: email,
            subject: `[${appName}] ${prompt.name} completed`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>${prompt.name}</h2>
                <p style="color: #666;">Completed in ${(runDuration / 1000).toFixed(1)} seconds</p>

                <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
                  <pre style="white-space: pre-wrap; word-break: break-word; margin: 0;">${truncate(result, 1000)}</pre>
                </div>

                <p>
                  <a href="${threadUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px;">
                    View Full Thread
                  </a>
                </p>

                <p style="color: #999; font-size: 12px; margin-top: 32px;">
                  This email was sent by ${appName}.
                  <a href="${appUrl}/automations">Manage automations</a>
                </p>
              </div>
            `,
            text: `${prompt.name} completed in ${(runDuration / 1000).toFixed(1)} seconds\n\n${truncate(result, 1000)}\n\nView thread: ${threadUrl}`,
          });

          ctx.log(`Email sent to ${email}`);
        }
      } catch (error) {
        ctx.log(`Email notification failed: ${error instanceof Error ? error.message : error}`);
        throw error;
      }
    }

    ctx.log('Notifications complete');
  },
  'Send notifications for completed scheduled prompt'
);
