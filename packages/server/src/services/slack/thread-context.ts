import { db } from '@chaaskit/db';
import { SlackClient, type SlackMessage } from './client.js';

export interface SlackThreadContext {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    slackUserId?: string;
  }>;
  slackThreadTs: string;
}

/**
 * Build thread context from Slack conversation history.
 */
export async function buildSlackThreadContext(
  client: SlackClient,
  channelId: string,
  threadTs: string | null,
  botUserId: string
): Promise<SlackThreadContext | null> {
  // If not in a thread, no context to build
  if (!threadTs) {
    return null;
  }

  try {
    const history = await client.getConversationHistory(channelId, {
      threadTs,
      limit: 20, // Get last 20 messages in thread
    });

    if (!history.ok || !history.messages) {
      console.error('[Slack] Failed to get thread history:', history.error);
      return null;
    }

    // Convert Slack messages to context format
    // Messages come newest-first, so reverse them
    const messages = history.messages
      .slice()
      .reverse()
      .filter(msg => msg.text && msg.ts !== threadTs) // Exclude parent message
      .map(msg => ({
        role: (msg.bot_id || msg.user === botUserId ? 'assistant' : 'user') as 'user' | 'assistant',
        content: cleanSlackMessage(msg.text || '', botUserId),
        slackUserId: msg.user,
      }));

    return {
      messages,
      slackThreadTs: threadTs,
    };
  } catch (error) {
    console.error('[Slack] Error building thread context:', error);
    return null;
  }
}

/**
 * Find or create an internal thread for Slack context continuity.
 */
export async function findOrCreateInternalThread(
  teamId: string,
  slackChannelId: string,
  slackThreadTs: string | null
): Promise<string> {
  // If no thread timestamp, always create a new thread
  if (!slackThreadTs) {
    const thread = await db.thread.create({
      data: {
        title: 'Slack Chat',
        teamId,
      },
    });
    return thread.id;
  }

  // Look for existing event with same channel/thread that has an internal thread
  const existingEvent = await db.slackMessageEvent.findFirst({
    where: {
      slackChannelId,
      slackThreadTs,
      internalThreadId: { not: null },
    },
    orderBy: { createdAt: 'desc' },
    select: { internalThreadId: true },
  });

  if (existingEvent?.internalThreadId) {
    // Verify thread still exists
    const thread = await db.thread.findUnique({
      where: { id: existingEvent.internalThreadId },
    });
    if (thread) {
      return existingEvent.internalThreadId;
    }
  }

  // Create new internal thread
  const thread = await db.thread.create({
    data: {
      title: 'Slack Thread',
      teamId,
    },
  });

  return thread.id;
}

/**
 * Get message history from internal thread.
 */
export async function getInternalThreadHistory(
  threadId: string
): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  const messages = await db.message.findMany({
    where: { threadId },
    orderBy: { createdAt: 'asc' },
    take: 20, // Last 20 messages
    select: {
      role: true,
      content: true,
    },
  });

  return messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
}

/**
 * Save a message to internal thread.
 */
export async function saveToInternalThread(
  threadId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<void> {
  await db.message.create({
    data: {
      threadId,
      role,
      content,
    },
  });

  // Update thread's updatedAt
  await db.thread.update({
    where: { id: threadId },
    data: { updatedAt: new Date() },
  });
}

/**
 * Clean Slack message text:
 * - Remove @mentions of the bot
 * - Convert user mentions to readable format
 * - Handle formatting
 */
export function cleanSlackMessage(text: string, botUserId: string): string {
  // Remove bot mentions
  const botMentionRegex = new RegExp(`<@${botUserId}>`, 'g');
  let cleaned = text.replace(botMentionRegex, '').trim();

  // Convert user mentions <@U123> to @user
  cleaned = cleaned.replace(/<@([A-Z0-9]+)>/g, '@user');

  // Convert links <url|text> to just text or url
  cleaned = cleaned.replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, '$2');
  cleaned = cleaned.replace(/<(https?:\/\/[^>]+)>/g, '$1');

  // Convert channel references <#C123|channel-name> to #channel-name
  cleaned = cleaned.replace(/<#[A-Z0-9]+\|([^>]+)>/g, '#$1');

  return cleaned.trim();
}

/**
 * Format response for Slack mrkdwn:
 * - Convert standard markdown to Slack mrkdwn syntax
 * - Handle bold, italic, strikethrough, links
 */
export function formatForSlack(text: string): string {
  let result = text;

  // Preserve code blocks first (we don't want to process inside them)
  const codeBlocks: string[] = [];
  result = result.replace(/```[\s\S]*?```/g, match => {
    codeBlocks.push(match);
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
  });

  // Preserve inline code
  const inlineCode: string[] = [];
  result = result.replace(/`[^`]+`/g, match => {
    inlineCode.push(match);
    return `__INLINE_CODE_${inlineCode.length - 1}__`;
  });

  // Convert markdown links [text](url) to Slack format <url|text>
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<$2|$1>');

  // Convert markdown bold **text** to Slack bold *text*
  // Be careful not to convert already single asterisks
  result = result.replace(/\*\*([^*]+)\*\*/g, '*$1*');

  // Convert markdown strikethrough ~~text~~ to Slack ~text~
  result = result.replace(/~~([^~]+)~~/g, '~$1~');

  // Markdown italic with underscores _text_ already works in Slack
  // Markdown italic with single asterisks *text* would conflict with Slack bold,
  // but after converting **bold** to *bold*, remaining single asterisks should be fine

  // Restore inline code
  inlineCode.forEach((code, i) => {
    result = result.replace(`__INLINE_CODE_${i}__`, code);
  });

  // Restore code blocks
  codeBlocks.forEach((block, i) => {
    result = result.replace(`__CODE_BLOCK_${i}__`, block);
  });

  return result;
}

/**
 * System prompt suffix for Slack responses.
 * Instructs the AI to format responses using Slack's mrkdwn syntax.
 */
export const SLACK_FORMAT_INSTRUCTIONS = `
Format your responses using Slack's mrkdwn syntax:
- Bold: *bold text*
- Italic: _italic text_
- Strikethrough: ~strikethrough~
- Code: \`inline code\` or \`\`\`code block\`\`\`
- Links: <https://example.com|link text>
- Lists: Use - or • for bullets
- Quotes: >quoted text
Keep responses concise and well-formatted for chat.`.trim();
