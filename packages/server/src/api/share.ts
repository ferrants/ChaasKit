import { Router } from 'express';
import { db } from '@chaaskit/db';
import { HTTP_STATUS, shareThreadSchema } from '@chaaskit/shared';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { getConfig } from '../config/loader.js';
import { notifyThreadShared } from '../services/slack/notifications.js';

export const shareRouter = Router();

// Create shareable link for a thread
shareRouter.post('/:threadId', requireAuth, async (req, res, next) => {
  try {
    const config = getConfig();

    if (!config.sharing?.enabled) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Sharing is disabled');
    }

    const { threadId } = req.params;
    const { expiresIn } = shareThreadSchema.parse(req.body);

    // Verify thread ownership
    const thread = await db.thread.findUnique({
      where: { id: threadId },
    });

    if (!thread) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Thread not found');
    }

    if (thread.userId !== req.user!.id) {
      throw new AppError(HTTP_STATUS.FORBIDDEN, 'Access denied');
    }

    // Calculate expiration
    let expiresAt: Date | null = null;
    if (expiresIn && expiresIn !== 'never') {
      const durations: Record<string, number> = {
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
      };
      expiresAt = new Date(Date.now() + durations[expiresIn]!);
    }

    // Create shared link
    const shared = await db.sharedThread.create({
      data: {
        threadId,
        expiresAt,
      },
    });

    const shareUrl = `${process.env.APP_URL}/shared/${shared.shareId}`;

    // Send Slack notification if this is a team thread
    if (thread.teamId) {
      notifyThreadShared(
        thread.teamId,
        req.user!.name,
        req.user!.email,
        thread.title,
        shareUrl
      ).catch(err => console.error('[Share] Slack notification failed:', err));
    }

    res.status(HTTP_STATUS.CREATED).json({
      shareId: shared.shareId,
      url: shareUrl,
      expiresAt: shared.expiresAt,
    });
  } catch (error) {
    next(error);
  }
});

// Get shared thread (public or team-scoped based on config)
shareRouter.get('/view/:shareId', optionalAuth, async (req, res, next) => {
  try {
    const config = getConfig();
    const { shareId } = req.params;

    const shared = await db.sharedThread.findUnique({
      where: { shareId },
      include: {
        thread: {
          include: {
            user: {
              include: {
                teamMemberships: {
                  select: { teamId: true },
                },
              },
            },
            messages: {
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                role: true,
                content: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!shared) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Shared thread not found');
    }

    // Check expiration
    if (shared.expiresAt && shared.expiresAt < new Date()) {
      throw new AppError(HTTP_STATUS.GONE, 'Share link has expired');
    }

    // Check team scope access
    if (config.sharing?.scope === 'team') {
      if (!req.user) {
        throw new AppError(HTTP_STATUS.UNAUTHORIZED, 'Authentication required to view this shared thread');
      }

      // Get the viewer's team IDs
      const viewerTeams = await db.teamMember.findMany({
        where: { userId: req.user.id },
        select: { teamId: true },
      });
      const viewerTeamIds = new Set(viewerTeams.map((t) => t.teamId));

      // Get the thread owner's team IDs
      const ownerTeamIds = shared.thread.user?.teamMemberships.map((t) => t.teamId) || [];

      // Check if viewer shares a team with the owner
      const hasSharedTeam = ownerTeamIds.some((teamId) => viewerTeamIds.has(teamId));

      // Also allow the owner themselves to view
      const isOwner = req.user.id === shared.thread.userId;

      if (!hasSharedTeam && !isOwner) {
        throw new AppError(HTTP_STATUS.FORBIDDEN, 'You must be a team member to view this shared thread');
      }
    }

    res.json({
      thread: {
        id: shared.thread.id,
        title: shared.thread.title,
        messages: shared.thread.messages,
        createdAt: shared.thread.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get existing shares for a thread
shareRouter.get('/thread/:threadId', requireAuth, async (req, res, next) => {
  try {
    const { threadId } = req.params;

    // Verify thread ownership
    const thread = await db.thread.findUnique({
      where: { id: threadId },
    });

    if (!thread) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Thread not found');
    }

    if (thread.userId !== req.user!.id) {
      throw new AppError(HTTP_STATUS.FORBIDDEN, 'Access denied');
    }

    const shares = await db.sharedThread.findMany({
      where: { threadId },
      orderBy: { createdAt: 'desc' },
    });

    // Filter out expired shares and format response
    const activeShares = shares
      .filter((s) => !s.expiresAt || s.expiresAt > new Date())
      .map((s) => ({
        shareId: s.shareId,
        url: `${process.env.APP_URL}/shared/${s.shareId}`,
        expiresAt: s.expiresAt,
        createdAt: s.createdAt,
      }));

    res.json({ shares: activeShares });
  } catch (error) {
    next(error);
  }
});

// Delete shared link
shareRouter.delete('/:shareId', requireAuth, async (req, res, next) => {
  try {
    const { shareId } = req.params;

    const shared = await db.sharedThread.findUnique({
      where: { shareId },
      include: { thread: true },
    });

    if (!shared) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Shared link not found');
    }

    if (shared.thread.userId !== req.user!.id) {
      throw new AppError(HTTP_STATUS.FORBIDDEN, 'Access denied');
    }

    await db.sharedThread.delete({
      where: { id: shared.id },
    });

    res.status(HTTP_STATUS.NO_CONTENT).send();
  } catch (error) {
    next(error);
  }
});
