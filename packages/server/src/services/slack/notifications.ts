import { db } from '@chaaskit/db';
import { getConfig } from '../../config/loader.js';
import type { SlackNotificationEvent } from '@chaaskit/shared';
import { SlackClient } from './client.js';

interface NotificationPayload {
  event: SlackNotificationEvent;
  teamId: string;
  data: {
    userName?: string;
    userEmail?: string;
    threadTitle?: string;
    shareUrl?: string;
    teamName?: string;
  };
}

/**
 * Check if a notification event is enabled in config.
 */
function isEventEnabled(event: SlackNotificationEvent): boolean {
  const config = getConfig();
  if (!config.slack?.notifications?.events) {
    return false;
  }

  const eventConfig = config.slack.notifications.events.find(e => e.event === event);
  return eventConfig?.enabled ?? false;
}

/**
 * Format notification message based on event type.
 */
function formatNotificationMessage(payload: NotificationPayload): string {
  const { event, data } = payload;

  switch (event) {
    case 'thread_shared':
      return [
        ':outbox_tray: *Thread Shared*',
        `${data.userName || data.userEmail || 'Someone'} shared "${data.threadTitle || 'a thread'}"`,
        data.shareUrl ? `View: ${data.shareUrl}` : '',
      ].filter(Boolean).join('\n');

    case 'message_liked':
      return [
        ':thumbsup: *Message Liked*',
        `${data.userName || data.userEmail || 'Someone'} liked a response in "${data.threadTitle || 'a thread'}"`,
      ].join('\n');

    case 'team_member_joined':
      return [
        ':wave: *New Team Member*',
        `${data.userName || data.userEmail || 'Someone'} joined ${data.teamName || 'the team'}`,
      ].join('\n');

    default:
      return `Notification: ${event}`;
  }
}

/**
 * Send a notification to a team's Slack workspace.
 */
export async function sendSlackNotification(payload: NotificationPayload): Promise<boolean> {
  const config = getConfig();

  // Check if Slack is enabled
  if (!config.slack?.enabled) {
    return false;
  }

  // Check if this event type is enabled
  if (!isEventEnabled(payload.event)) {
    return false;
  }

  // Get the team's Slack integration
  const integration = await db.slackIntegration.findUnique({
    where: { teamId: payload.teamId },
  });

  if (!integration || integration.status !== 'active') {
    return false;
  }

  // Must have a notification channel configured
  if (!integration.notificationChannel) {
    console.log('[Slack] No notification channel configured for team:', payload.teamId);
    return false;
  }

  try {
    const client = SlackClient.fromEncrypted(integration.encryptedTokens);
    const message = formatNotificationMessage(payload);

    const result = await client.postMessage(integration.notificationChannel, message);

    if (!result.ok) {
      console.error('[Slack] Failed to send notification:', result.error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[Slack] Error sending notification:', error);
    return false;
  }
}

/**
 * Send notification when a thread is shared.
 */
export async function notifyThreadShared(
  teamId: string,
  userName: string | null | undefined,
  userEmail: string,
  threadTitle: string,
  shareUrl: string
): Promise<void> {
  await sendSlackNotification({
    event: 'thread_shared',
    teamId,
    data: {
      userName: userName || undefined,
      userEmail,
      threadTitle,
      shareUrl,
    },
  });
}

/**
 * Send notification when a message is liked.
 */
export async function notifyMessageLiked(
  teamId: string,
  userName: string | null | undefined,
  userEmail: string,
  threadTitle: string
): Promise<void> {
  await sendSlackNotification({
    event: 'message_liked',
    teamId,
    data: {
      userName: userName || undefined,
      userEmail,
      threadTitle,
    },
  });
}

/**
 * Send notification when a team member joins.
 */
export async function notifyTeamMemberJoined(
  teamId: string,
  userName: string | null | undefined,
  userEmail: string,
  teamName: string
): Promise<void> {
  await sendSlackNotification({
    event: 'team_member_joined',
    teamId,
    data: {
      userName: userName || undefined,
      userEmail,
      teamName,
    },
  });
}
