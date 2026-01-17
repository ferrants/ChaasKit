import { Router } from 'express';
import { db } from '@chaaskit/db';
import { z } from 'zod';
import { HTTP_STATUS } from '@chaaskit/shared';
import type {
  AdminStats,
  UsageDataPoint,
  FeedbackStats,
  FeedbackItem,
  AdminUser,
  AdminTeam,
  AdminTeamDetails,
  AdminTeamMember,
} from '@chaaskit/shared';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

export const adminRouter = Router();

// All admin routes require authentication and admin role
adminRouter.use(requireAuth, requireAdmin);

// Get admin dashboard stats
adminRouter.get('/stats', async (req, res, next) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalUsers,
      totalTeams,
      totalThreads,
      totalMessages,
      newUsersLast30Days,
      messagesLast30Days,
      planCounts,
    ] = await Promise.all([
      db.user.count(),
      db.team.count({ where: { archivedAt: null } }),
      db.thread.count(),
      db.message.count(),
      db.user.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
      db.message.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
      db.user.groupBy({
        by: ['plan'],
        _count: { plan: true },
      }),
    ]);

    const planDistribution: Record<string, number> = {};
    for (const item of planCounts) {
      planDistribution[item.plan] = item._count.plan;
    }

    const stats: AdminStats = {
      totalUsers,
      totalTeams,
      totalThreads,
      totalMessages,
      planDistribution,
      newUsersLast30Days,
      messagesLast30Days,
    };

    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// Get usage data over time
adminRouter.get('/usage', async (req, res, next) => {
  try {
    const periodParam = (req.query.period as string) || 'day';
    const daysParam = parseInt(req.query.days as string) || 30;

    // Limit to reasonable ranges
    const days = Math.min(Math.max(daysParam, 1), 365);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Get messages with token counts grouped by date
    const messages = await db.message.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      select: {
        createdAt: true,
        inputTokens: true,
        outputTokens: true,
      },
    });

    // Group by date
    const usageByDate = new Map<string, UsageDataPoint>();

    for (const msg of messages) {
      const dateKey = msg.createdAt.toISOString().split('T')[0];

      if (!usageByDate.has(dateKey)) {
        usageByDate.set(dateKey, {
          date: dateKey,
          messages: 0,
          inputTokens: 0,
          outputTokens: 0,
        });
      }

      const data = usageByDate.get(dateKey)!;
      data.messages += 1;
      data.inputTokens += msg.inputTokens || 0;
      data.outputTokens += msg.outputTokens || 0;
    }

    // Fill in missing dates with zeros
    const usage: UsageDataPoint[] = [];
    const currentDate = new Date(startDate);
    const endDate = new Date();

    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0];
      usage.push(
        usageByDate.get(dateKey) || {
          date: dateKey,
          messages: 0,
          inputTokens: 0,
          outputTokens: 0,
        }
      );
      currentDate.setDate(currentDate.getDate() + 1);
    }

    res.json({
      usage,
      period: periodParam as 'day' | 'week' | 'month',
    });
  } catch (error) {
    next(error);
  }
});

// Get feedback stats and recent feedback
adminRouter.get('/feedback', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    const [totalUp, totalDown, recentFeedback] = await Promise.all([
      db.messageFeedback.count({ where: { type: 'up' } }),
      db.messageFeedback.count({ where: { type: 'down' } }),
      db.messageFeedback.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          message: {
            select: {
              id: true,
              content: true,
              threadId: true,
            },
          },
        },
      }),
    ]);

    const feedbackItems: FeedbackItem[] = recentFeedback.map((f) => ({
      id: f.id,
      type: f.type as 'up' | 'down',
      comment: f.comment,
      createdAt: f.createdAt,
      user: f.user,
      message: {
        ...f.message,
        content: f.message.content.slice(0, 200) + (f.message.content.length > 200 ? '...' : ''),
      },
    }));

    const stats: FeedbackStats = {
      totalUp,
      totalDown,
      recentFeedback: feedbackItems,
    };

    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// Get paginated user list
adminRouter.get('/users', async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize as string) || 20, 1), 100);
    const search = (req.query.search as string) || '';

    const skip = (page - 1) * pageSize;

    const whereClause = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { name: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      db.user.findMany({
        where: whereClause,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          isAdmin: true,
          plan: true,
          messagesThisMonth: true,
          credits: true,
          emailVerified: true,
          oauthProvider: true,
          createdAt: true,
          _count: {
            select: {
              threads: true,
              teamMemberships: true,
            },
          },
          teamMemberships: {
            select: {
              role: true,
              team: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      db.user.count({ where: whereClause }),
    ]);

    const adminUsers: AdminUser[] = users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      avatarUrl: u.avatarUrl,
      isAdmin: u.isAdmin,
      plan: u.plan,
      messagesThisMonth: u.messagesThisMonth,
      credits: u.credits,
      emailVerified: u.emailVerified,
      oauthProvider: u.oauthProvider,
      createdAt: u.createdAt,
      threadCount: u._count.threads,
      teamCount: u._count.teamMemberships,
      teams: u.teamMemberships.map((tm) => ({
        id: tm.team.id,
        name: tm.team.name,
        role: tm.role,
      })),
    }));

    res.json({
      users: adminUsers,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    next(error);
  }
});

// Update user (admin toggle, plan change)
const updateUserSchema = z.object({
  isAdmin: z.boolean().optional(),
  plan: z.string().optional(),
});

adminRouter.patch('/users/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const updates = updateUserSchema.parse(req.body);

    // Prevent self-demotion
    if (userId === req.user!.id && updates.isAdmin === false) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Cannot remove your own admin status');
    }

    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'User not found');
    }

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: updates,
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        isAdmin: true,
        plan: true,
        messagesThisMonth: true,
        credits: true,
        emailVerified: true,
        oauthProvider: true,
        createdAt: true,
        teamMemberships: {
          select: {
            role: true,
            team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            threads: true,
            teamMemberships: true,
          },
        },
      },
    });

    const adminUser: AdminUser = {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      avatarUrl: updatedUser.avatarUrl,
      isAdmin: updatedUser.isAdmin,
      plan: updatedUser.plan,
      messagesThisMonth: updatedUser.messagesThisMonth,
      credits: updatedUser.credits,
      emailVerified: updatedUser.emailVerified,
      oauthProvider: updatedUser.oauthProvider,
      createdAt: updatedUser.createdAt,
      threadCount: updatedUser._count.threads,
      teamCount: updatedUser._count.teamMemberships,
      teams: updatedUser.teamMemberships.map((tm) => ({
        id: tm.team.id,
        name: tm.team.name,
        role: tm.role,
      })),
    };

    res.json({ user: adminUser });
  } catch (error) {
    next(error);
  }
});

// Get paginated team list
adminRouter.get('/teams', async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize as string) || 20, 1), 100);
    const search = (req.query.search as string) || '';
    const includeArchived = req.query.includeArchived === 'true';

    const skip = (page - 1) * pageSize;

    const whereClause = {
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
      ...(includeArchived ? {} : { archivedAt: null }),
    };

    const [teams, total] = await Promise.all([
      db.team.findMany({
        where: whereClause,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          createdAt: true,
          archivedAt: true,
          _count: {
            select: {
              members: true,
              threads: true,
            },
          },
        },
      }),
      db.team.count({ where: whereClause }),
    ]);

    const adminTeams: AdminTeam[] = teams.map((t) => ({
      id: t.id,
      name: t.name,
      memberCount: t._count.members,
      threadCount: t._count.threads,
      createdAt: t.createdAt,
      archivedAt: t.archivedAt,
    }));

    res.json({
      teams: adminTeams,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    next(error);
  }
});

// Get single team with members
adminRouter.get('/teams/:teamId', async (req, res, next) => {
  try {
    const { teamId } = req.params;

    const team = await db.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        name: true,
        context: true,
        createdAt: true,
        archivedAt: true,
        _count: {
          select: {
            members: true,
            threads: true,
          },
        },
        members: {
          select: {
            role: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!team) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Team not found');
    }

    const adminTeamDetails: AdminTeamDetails = {
      id: team.id,
      name: team.name,
      context: team.context,
      memberCount: team._count.members,
      threadCount: team._count.threads,
      createdAt: team.createdAt,
      archivedAt: team.archivedAt,
      members: team.members.map((m): AdminTeamMember => ({
        id: m.user.id,
        email: m.user.email,
        name: m.user.name,
        avatarUrl: m.user.avatarUrl,
        role: m.role,
        joinedAt: m.createdAt,
      })),
    };

    res.json(adminTeamDetails);
  } catch (error) {
    next(error);
  }
});
