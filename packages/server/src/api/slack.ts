import { Router, type RequestHandler } from 'express';
import crypto from 'crypto';
import { db } from '@chaaskit/db';
import { HTTP_STATUS } from '@chaaskit/shared';
import { requireAuth } from '../middleware/auth.js';
import { requireTeamRole } from '../middleware/team.js';
import { AppError } from '../middleware/errorHandler.js';
import { getConfig } from '../config/loader.js';
import {
  verifySlackSignature,
  verifyInternalSecret,
  getInternalSecret,
  buildOAuthUrl,
  exchangeCodeForTokens,
  encryptTokens,
  SlackClient,
  decryptTokens,
} from '../services/slack/index.js';
import { processSlackEvent } from '../services/slack/events.js';

export const slackRouter = Router();

// Store for OAuth state tokens (in production, use Redis or similar)
const oauthStates = new Map<string, { teamId: string; nonce: string; createdAt: number }>();

// Clean up expired states every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of oauthStates.entries()) {
    if (now - value.createdAt > 10 * 60 * 1000) {
      oauthStates.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Middleware to check if Slack feature is enabled
const requireSlackEnabled: RequestHandler = (req, res, next) => {
  const config = getConfig();
  if (!config.slack?.enabled) {
    return next(new AppError(HTTP_STATUS.FORBIDDEN, 'Slack integration is not enabled'));
  }
  next();
};

// Middleware to check if teams feature is enabled (Slack requires teams)
const requireTeamsEnabled: RequestHandler = (req, res, next) => {
  const config = getConfig();
  if (!config.teams?.enabled) {
    return next(new AppError(HTTP_STATUS.FORBIDDEN, 'Teams feature is required for Slack integration'));
  }
  next();
};

// Check if team's plan is allowed for Slack
async function checkPlanAllowed(teamId: string): Promise<boolean> {
  const config = getConfig();
  if (!config.slack?.allowedPlans || config.slack.allowedPlans.length === 0) {
    return true;
  }

  const team = await db.team.findUnique({
    where: { id: teamId },
    select: { plan: true },
  });

  if (!team) {
    return false;
  }

  return config.slack.allowedPlans.includes(team.plan);
}

// ============================================================================
// OAuth Flow
// ============================================================================

/**
 * GET /api/slack/install/:teamId - Initiate OAuth flow
 */
slackRouter.get(
  '/install/:teamId',
  requireSlackEnabled,
  requireTeamsEnabled,
  requireAuth,
  requireTeamRole('admin'),
  async (req, res, next) => {
    try {
      const { teamId } = req.params;

      // Check if team plan is allowed
      const planAllowed = await checkPlanAllowed(teamId);
      if (!planAllowed) {
        throw new AppError(HTTP_STATUS.FORBIDDEN, 'Your plan does not include Slack integration');
      }

      // Check if already connected
      const existing = await db.slackIntegration.findUnique({
        where: { teamId },
      });
      if (existing && existing.status === 'active') {
        throw new AppError(HTTP_STATUS.CONFLICT, 'Slack is already connected to this team');
      }

      // Generate state for CSRF protection
      const nonce = crypto.randomBytes(16).toString('hex');
      const state = `${teamId}:${nonce}`;

      oauthStates.set(state, {
        teamId,
        nonce,
        createdAt: Date.now(),
      });

      // Build redirect URL (use API_URL since callback is on the server)
      const apiUrl = process.env.API_URL || 'http://localhost:3000';
      const redirectUri = `${apiUrl}/api/slack/callback`;
      const authUrl = buildOAuthUrl(state, redirectUri);

      res.redirect(authUrl);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/slack/callback - OAuth callback
 */
slackRouter.get('/callback', requireSlackEnabled, async (req, res, next) => {
  try {
    const { code, state, error: oauthError } = req.query;
    const appUrl = process.env.APP_URL || 'http://localhost:5173';
    const apiUrl = process.env.API_URL || 'http://localhost:3000';
    const config = getConfig();
    const basePath = config.app?.basePath || '';

    // Handle OAuth errors
    if (oauthError) {
      console.error('[Slack] OAuth error:', oauthError);
      return res.redirect(`${appUrl}${basePath}/teams?slack=error&message=${encodeURIComponent(String(oauthError))}`);
    }

    if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
      return res.redirect(`${appUrl}${basePath}/teams?slack=error&message=invalid_request`);
    }

    // Validate state
    const stateData = oauthStates.get(state);
    if (!stateData) {
      return res.redirect(`${appUrl}${basePath}/teams?slack=error&message=invalid_state`);
    }
    oauthStates.delete(state);

    const { teamId } = stateData;

    // Exchange code for tokens (redirect URI must match what was sent in the auth request)
    const redirectUri = `${apiUrl}/api/slack/callback`;
    const tokenResponse = await exchangeCodeForTokens(code, redirectUri);

    if (!tokenResponse.ok || !tokenResponse.access_token) {
      console.error('[Slack] Token exchange failed:', tokenResponse.error);
      return res.redirect(`${appUrl}${basePath}/team/${teamId}/settings?slack=error&message=${encodeURIComponent(tokenResponse.error || 'token_error')}`);
    }

    // Encrypt tokens for storage
    const encryptedTokens = encryptTokens({
      botToken: tokenResponse.access_token,
      userAccessToken: tokenResponse.authed_user?.access_token,
    });

    // Get the user who initiated (we'll use system for now since we don't have auth context)
    // In a full implementation, we'd pass the user ID through the state
    const team = await db.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          where: { role: 'owner' },
          take: 1,
        },
      },
    });

    if (!team || !team.members[0]) {
      return res.redirect(`${appUrl}${basePath}/teams?slack=error&message=team_not_found`);
    }

    // Upsert the integration
    await db.slackIntegration.upsert({
      where: { teamId },
      create: {
        teamId,
        slackWorkspaceId: tokenResponse.team?.id || '',
        slackWorkspaceName: tokenResponse.team?.name || 'Unknown Workspace',
        slackBotUserId: tokenResponse.bot_user_id || '',
        encryptedTokens,
        installedBy: team.members[0].userId,
        status: 'active',
      },
      update: {
        slackWorkspaceId: tokenResponse.team?.id || '',
        slackWorkspaceName: tokenResponse.team?.name || 'Unknown Workspace',
        slackBotUserId: tokenResponse.bot_user_id || '',
        encryptedTokens,
        status: 'active',
        statusMessage: null,
      },
    });

    console.log('[Slack] Successfully connected workspace:', tokenResponse.team?.name, 'to team:', teamId);

    res.redirect(`${appUrl}${basePath}/team/${teamId}/settings?slack=connected`);
  } catch (error) {
    console.error('[Slack] Callback error:', error);
    const appUrl = process.env.APP_URL || 'http://localhost:5173';
    const config = getConfig();
    const basePath = config.app?.basePath || '';
    res.redirect(`${appUrl}${basePath}/teams?slack=error&message=server_error`);
  }
});

// ============================================================================
// Integration Management
// ============================================================================

/**
 * GET /api/slack/:teamId/status - Get Slack integration status
 */
slackRouter.get(
  '/:teamId/status',
  requireSlackEnabled,
  requireTeamsEnabled,
  requireAuth,
  requireTeamRole('viewer'),
  async (req, res, next) => {
    try {
      const { teamId } = req.params;

      const integration = await db.slackIntegration.findUnique({
        where: { teamId },
        select: {
          id: true,
          slackWorkspaceId: true,
          slackWorkspaceName: true,
          notificationChannel: true,
          aiChatEnabled: true,
          status: true,
          statusMessage: true,
          installedAt: true,
        },
      });

      if (!integration) {
        return res.json({ connected: false });
      }

      res.json({
        connected: integration.status === 'active',
        integration: {
          id: integration.id,
          workspaceId: integration.slackWorkspaceId,
          workspaceName: integration.slackWorkspaceName,
          notificationChannel: integration.notificationChannel,
          aiChatEnabled: integration.aiChatEnabled,
          status: integration.status,
          statusMessage: integration.statusMessage,
          installedAt: integration.installedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/slack/:teamId - Disconnect Slack integration
 */
slackRouter.delete(
  '/:teamId',
  requireSlackEnabled,
  requireTeamsEnabled,
  requireAuth,
  requireTeamRole('admin'),
  async (req, res, next) => {
    try {
      const { teamId } = req.params;

      const integration = await db.slackIntegration.findUnique({
        where: { teamId },
      });

      if (!integration) {
        throw new AppError(HTTP_STATUS.NOT_FOUND, 'Slack integration not found');
      }

      // Delete the integration
      await db.slackIntegration.delete({
        where: { id: integration.id },
      });

      console.log('[Slack] Disconnected workspace from team:', teamId);

      res.status(HTTP_STATUS.NO_CONTENT).send();
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/slack/:teamId/settings - Update integration settings
 */
slackRouter.patch(
  '/:teamId/settings',
  requireSlackEnabled,
  requireTeamsEnabled,
  requireAuth,
  requireTeamRole('admin'),
  async (req, res, next) => {
    try {
      const { teamId } = req.params;
      const { notificationChannel, aiChatEnabled } = req.body;

      const integration = await db.slackIntegration.findUnique({
        where: { teamId },
      });

      if (!integration) {
        throw new AppError(HTTP_STATUS.NOT_FOUND, 'Slack integration not found');
      }

      const updateData: { notificationChannel?: string | null; aiChatEnabled?: boolean } = {};
      if (notificationChannel !== undefined) updateData.notificationChannel = notificationChannel;
      if (aiChatEnabled !== undefined) updateData.aiChatEnabled = aiChatEnabled;

      const updated = await db.slackIntegration.update({
        where: { id: integration.id },
        data: updateData,
        select: {
          id: true,
          notificationChannel: true,
          aiChatEnabled: true,
        },
      });

      res.json({ integration: updated });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================================
// Webhook Endpoints
// ============================================================================

// We need raw body for signature verification
// This is handled at app level with express.raw middleware

/**
 * POST /api/slack/events - Receive Slack events
 */
slackRouter.post('/events', requireSlackEnabled, async (req, res, next) => {
  try {
    // Get raw body for signature verification
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const signature = req.headers['x-slack-signature'] as string | undefined;
    const timestamp = req.headers['x-slack-request-timestamp'] as string | undefined;

    // Verify signature
    if (!verifySlackSignature(signature, timestamp, rawBody)) {
      console.warn('[Slack] Invalid signature');
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: 'Invalid signature' });
    }

    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    // Handle URL verification challenge
    if (event.type === 'url_verification') {
      return res.json({ challenge: event.challenge });
    }

    // Handle event callbacks
    if (event.type === 'event_callback') {
      const workspaceId = event.team_id;
      const innerEvent = event.event;

      // Find integration by workspace ID
      const integration = await db.slackIntegration.findUnique({
        where: { slackWorkspaceId: workspaceId },
      });

      if (!integration) {
        // Silently ignore events from unknown workspaces
        console.log('[Slack] Event from unknown workspace:', workspaceId);
        return res.status(HTTP_STATUS.OK).send();
      }

      if (integration.status !== 'active') {
        console.log('[Slack] Event from inactive integration:', integration.id);
        return res.status(HTTP_STATUS.OK).send();
      }

      // Check for app_mention or message events
      if (innerEvent.type === 'app_mention' || innerEvent.type === 'message') {
        // Skip bot messages to avoid loops
        if (innerEvent.bot_id || innerEvent.subtype === 'bot_message') {
          return res.status(HTTP_STATUS.OK).send();
        }

        // For message events (not app_mention), only respond to thread replies
        // where the bot has already participated
        if (innerEvent.type === 'message') {
          // Must be in a thread
          if (!innerEvent.thread_ts) {
            return res.status(HTTP_STATUS.OK).send();
          }

          // Check if bot has already participated in this thread
          const botParticipated = await db.slackMessageEvent.findFirst({
            where: {
              integrationId: integration.id,
              slackChannelId: innerEvent.channel,
              slackThreadTs: innerEvent.thread_ts,
              status: { in: ['completed', 'processing', 'pending'] },
            },
          });

          if (!botParticipated) {
            // Bot hasn't been mentioned in this thread, ignore the message
            return res.status(HTTP_STATUS.OK).send();
          }
        }

        // Check for deduplication
        const existingEvent = await db.slackMessageEvent.findUnique({
          where: { slackEventId: event.event_id },
        });

        if (existingEvent) {
          console.log('[Slack] Duplicate event:', event.event_id);
          return res.status(HTTP_STATUS.OK).send();
        }

        // Create pending event record
        const slackEvent = await db.slackMessageEvent.create({
          data: {
            integrationId: integration.id,
            slackEventId: event.event_id,
            slackChannelId: innerEvent.channel,
            slackThreadTs: innerEvent.thread_ts || null,
            slackMessageTs: innerEvent.ts,
            slackUserId: innerEvent.user,
            messageText: innerEvent.text,
            status: 'pending',
          },
        });

        // Fire-and-forget async processing
        const apiUrl = process.env.API_URL || 'http://localhost:3000';
        fetch(`${apiUrl}/api/slack/internal/process`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Slack-Internal-Secret': getInternalSecret(),
          },
          body: JSON.stringify({ eventId: slackEvent.id }),
        }).catch(err => {
          console.error('[Slack] Failed to trigger processing:', err);
        });
      }

      // Always respond quickly to Slack
      return res.status(HTTP_STATUS.OK).send();
    }

    // Unknown event type
    res.status(HTTP_STATUS.OK).send();
  } catch (error) {
    console.error('[Slack] Event handler error:', error);
    // Still return 200 to avoid Slack retrying on our errors
    res.status(HTTP_STATUS.OK).send();
  }
});

// ============================================================================
// Internal Processing Endpoints
// ============================================================================

/**
 * POST /api/slack/internal/process - Process a pending event
 */
slackRouter.post('/internal/process', requireSlackEnabled, async (req, res, next) => {
  try {
    // Verify internal secret
    const internalSecret = req.headers['x-slack-internal-secret'] as string | undefined;
    if (!verifyInternalSecret(internalSecret)) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: 'Unauthorized' });
    }

    const { eventId } = req.body;
    if (!eventId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Missing eventId' });
    }

    // Process the event
    await processSlackEvent(eventId);

    res.status(HTTP_STATUS.OK).json({ processed: true });
  } catch (error) {
    console.error('[Slack] Process error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: error instanceof Error ? error.message : 'Processing failed',
    });
  }
});

/**
 * POST /api/slack/internal/retry - Retry stale events
 */
slackRouter.post('/internal/retry', requireSlackEnabled, async (req, res, next) => {
  try {
    // Verify internal secret
    const internalSecret = req.headers['x-slack-internal-secret'] as string | undefined;
    if (!verifyInternalSecret(internalSecret)) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: 'Unauthorized' });
    }

    // Find stale events
    const staleThreshold = new Date(Date.now() - 3 * 60 * 1000); // 3 minutes ago
    const staleEvents = await db.slackMessageEvent.findMany({
      where: {
        status: { in: ['pending', 'processing'] },
        updatedAt: { lt: staleThreshold },
        retryCount: { lt: 3 },
      },
      take: 10,
    });

    const apiUrl = process.env.API_URL || 'http://localhost:3000';
    let retriedCount = 0;

    for (const event of staleEvents) {
      // Increment retry count
      await db.slackMessageEvent.update({
        where: { id: event.id },
        data: {
          retryCount: { increment: 1 },
          status: 'pending',
        },
      });

      // Trigger reprocessing
      fetch(`${apiUrl}/api/slack/internal/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Slack-Internal-Secret': getInternalSecret(),
        },
        body: JSON.stringify({ eventId: event.id }),
      }).catch(err => {
        console.error('[Slack] Failed to trigger retry:', err);
      });

      retriedCount++;
    }

    res.json({ retriedCount });
  } catch (error) {
    console.error('[Slack] Retry error:', error);
    next(error);
  }
});
