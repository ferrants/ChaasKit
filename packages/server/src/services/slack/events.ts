import { db } from '@chaaskit/db';
import { getConfig } from '../../config/loader.js';
import { createAgentService, type ChatMessage } from '../agent.js';
import { getDefaultAgent, toAgentConfig, isBuiltInAgent } from '../agents.js';
import { SlackClient } from './client.js';
import {
  buildSlackThreadContext,
  findOrCreateInternalThread,
  getInternalThreadHistory,
  saveToInternalThread,
  cleanSlackMessage,
  formatForSlack,
  SLACK_FORMAT_INSTRUCTIONS,
} from './thread-context.js';

/**
 * Process a pending Slack event.
 */
export async function processSlackEvent(eventId: string): Promise<void> {
  // Atomic claim: UPDATE SET status='processing' WHERE id=? AND status='pending'
  const event = await db.slackMessageEvent.findUnique({
    where: { id: eventId },
    include: {
      integration: {
        include: {
          team: true,
        },
      },
    },
  });

  if (!event) {
    console.log('[Slack] Event not found:', eventId);
    return;
  }

  // Atomic claim with WHERE status='pending'
  const claimResult = await db.slackMessageEvent.updateMany({
    where: {
      id: eventId,
      status: 'pending',
    },
    data: {
      status: 'processing',
    },
  });

  if (claimResult.count === 0) {
    // Already claimed or not pending
    console.log('[Slack] Event already claimed:', eventId);
    return;
  }

  const integration = event.integration;

  // Check if AI chat is enabled
  const config = getConfig();
  if (!config.slack?.aiChat?.enabled || !integration.aiChatEnabled) {
    console.log('[Slack] AI chat disabled for this integration');
    await markEventCompleted(eventId);
    return;
  }

  try {
    // Create Slack client
    const client = SlackClient.fromEncrypted(integration.encryptedTokens);

    // Add eyes reaction to indicate processing
    try {
      await client.addReaction(event.slackChannelId, event.slackMessageTs, 'eyes');
    } catch (err) {
      // Non-critical, continue processing
      console.warn('[Slack] Failed to add reaction:', err);
    }

    // Clean the incoming message
    const cleanedMessage = cleanSlackMessage(
      event.messageText || '',
      integration.slackBotUserId
    );

    if (!cleanedMessage) {
      console.log('[Slack] Empty message after cleaning');
      await markEventFailed(eventId, 'Empty message');
      return;
    }

    // Build context from Slack thread (if in a thread)
    let slackContext = await buildSlackThreadContext(
      client,
      event.slackChannelId,
      event.slackThreadTs,
      integration.slackBotUserId
    );

    // Find or create internal thread for continuity
    const internalThreadId = await findOrCreateInternalThread(
      integration.teamId,
      event.slackChannelId,
      event.slackThreadTs
    );

    // Update event with internal thread linkage
    await db.slackMessageEvent.update({
      where: { id: eventId },
      data: { internalThreadId },
    });

    // Get history from internal thread (for context continuity)
    const internalHistory = await getInternalThreadHistory(internalThreadId);

    // Build messages for agent
    const messages: ChatMessage[] = [];

    // Use internal history if available (preferred for continuity)
    if (config.slack?.aiChat?.threadContinuity && internalHistory.length > 0) {
      messages.push(...internalHistory);
    } else if (slackContext && slackContext.messages.length > 0) {
      // Fall back to Slack thread context
      messages.push(...slackContext.messages);
    }

    // Add current message
    messages.push({
      role: 'user',
      content: cleanedMessage,
    });

    // Save user message to internal thread
    await saveToInternalThread(internalThreadId, 'user', cleanedMessage);

    // Get the default agent
    const agent = getDefaultAgent();
    const agentConfig = toAgentConfig(agent);

    // Get system prompt and add Slack formatting instructions
    const baseSystemPrompt = isBuiltInAgent(agent) ? agent.systemPrompt : undefined;
    const systemPrompt = baseSystemPrompt
      ? `${baseSystemPrompt}\n\n${SLACK_FORMAT_INSTRUCTIONS}`
      : SLACK_FORMAT_INSTRUCTIONS;

    // Create agent service and generate response
    const agentService = createAgentService(agentConfig);

    // Collect the full response
    let fullResponse = '';
    const chunks = agentService.chat(messages, {
      systemPrompt,
      teamContext: integration.team?.context || null,
    });

    for await (const chunk of chunks) {
      if (chunk.type === 'text' && chunk.content) {
        fullResponse += chunk.content;
      }
    }

    if (!fullResponse.trim()) {
      console.log('[Slack] Empty response from agent');
      await markEventFailed(eventId, 'Empty response from agent');
      return;
    }

    // Format response for Slack
    const formattedResponse = formatForSlack(fullResponse);

    // Save assistant response to internal thread
    await saveToInternalThread(internalThreadId, 'assistant', fullResponse);

    // Post response to Slack
    const threadTs = event.slackThreadTs || event.slackMessageTs; // Reply in thread
    const postResult = await client.postMessage(
      event.slackChannelId,
      formattedResponse,
      { threadTs }
    );

    if (!postResult.ok) {
      console.error('[Slack] Failed to post message:', postResult.error);
      await markEventFailed(eventId, `Failed to post: ${postResult.error}`);

      // Try to add error reaction
      try {
        await client.removeReaction(event.slackChannelId, event.slackMessageTs, 'eyes');
        await client.addReaction(event.slackChannelId, event.slackMessageTs, 'x');
      } catch {}

      return;
    }

    // Replace eyes with checkmark
    try {
      await client.removeReaction(event.slackChannelId, event.slackMessageTs, 'eyes');
      await client.addReaction(event.slackChannelId, event.slackMessageTs, 'white_check_mark');
    } catch (err) {
      // Non-critical
      console.warn('[Slack] Failed to update reaction:', err);
    }

    // Mark event as completed
    await db.slackMessageEvent.update({
      where: { id: eventId },
      data: {
        status: 'completed',
        processedAt: new Date(),
        responseTs: postResult.ts,
      },
    });

    console.log('[Slack] Successfully processed event:', eventId);
  } catch (error) {
    console.error('[Slack] Error processing event:', error);
    await markEventFailed(eventId, error instanceof Error ? error.message : 'Unknown error');

    // Try to add error reaction
    try {
      const client = SlackClient.fromEncrypted(integration.encryptedTokens);
      await client.removeReaction(event.slackChannelId, event.slackMessageTs, 'eyes');
      await client.addReaction(event.slackChannelId, event.slackMessageTs, 'x');
    } catch {}
  }
}

async function markEventCompleted(eventId: string): Promise<void> {
  await db.slackMessageEvent.update({
    where: { id: eventId },
    data: {
      status: 'completed',
      processedAt: new Date(),
    },
  });
}

async function markEventFailed(eventId: string, error: string): Promise<void> {
  await db.slackMessageEvent.update({
    where: { id: eventId },
    data: {
      status: 'failed',
      lastError: error,
    },
  });
}
