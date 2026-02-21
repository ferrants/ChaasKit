import { Router } from 'express';
import { db } from '@chaaskit/db';
import { HTTP_STATUS, createThreadSchema, updateThreadSchema } from '@chaaskit/shared';
import { requireAuth, optionalAuth, requireVerifiedEmail } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { getAgentById, canAccessAgent, getDefaultAgent } from '../services/agents.js';

export const threadsRouter = Router();

// List user's threads (personal or team, optionally filtered by project)
threadsRouter.get('/', requireAuth, requireVerifiedEmail, async (req, res, next) => {
  try {
    const teamId = req.query.teamId as string | undefined;
    const projectId = req.query.projectId as string | undefined;

    // If teamId is provided, verify membership
    let teamMembership: { role: string } | null = null;
    if (teamId) {
      teamMembership = await db.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId,
            userId: req.user!.id,
          },
        },
      });

      if (!teamMembership) {
        throw new AppError(HTTP_STATUS.FORBIDDEN, 'You are not a member of this team');
      }
    }

    // If projectId is provided, verify project access
    if (projectId) {
      const project = await db.project.findUnique({
        where: { id: projectId },
      });

      if (!project || project.archivedAt) {
        throw new AppError(HTTP_STATUS.NOT_FOUND, 'Project not found');
      }

      // Check project access based on sharing settings
      if (project.userId !== req.user!.id) {
        if (!project.teamId || project.sharing === 'private') {
          throw new AppError(HTTP_STATUS.FORBIDDEN, 'Access denied');
        }
        // For team-shared projects, verify team membership
        const membership = await db.teamMember.findUnique({
          where: {
            teamId_userId: {
              teamId: project.teamId,
              userId: req.user!.id,
            },
          },
        });
        if (!membership) {
          throw new AppError(HTTP_STATUS.FORBIDDEN, 'Access denied');
        }
      }
    }

    // Build where clause
    const whereClause: Record<string, unknown> = {};

    if (teamId) {
      whereClause.teamId = teamId;
      // Admins/owners see everything; members/viewers see shared + own private
      if (!teamMembership || !['owner', 'admin'].includes(teamMembership.role)) {
        whereClause.OR = [
          { visibility: { not: 'private' } },
          { visibility: 'private', userId: req.user!.id },
        ];
      }
    } else {
      whereClause.userId = req.user!.id;
      whereClause.teamId = null;
    }

    // Filter by projectId if provided, or explicitly null for non-project threads
    if (projectId !== undefined) {
      whereClause.projectId = projectId || null;
    }

    // Exclude archived threads
    whereClause.archivedAt = null;

    const threads = await db.thread.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        agentId: true,
        projectId: true,
        threadType: true,
        visibility: true,
        parentThreadId: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { messages: true },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const threadSummaries = threads.map((thread) => {
      const agent = getAgentById(thread.agentId);
      return {
        id: thread.id,
        title: thread.title,
        agentId: thread.agentId,
        agentName: agent?.name,
        threadType: (thread.threadType || 'chat') as 'chat' | 'branch' | 'sub-agent',
        visibility: thread.visibility as 'shared' | 'private',
        projectId: thread.projectId || undefined,
        parentThreadId: thread.parentThreadId || undefined,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
        messageCount: thread._count.messages,
        lastMessagePreview: thread.messages[0]?.content.slice(0, 100),
      };
    });

    res.json({ threads: threadSummaries });
  } catch (error) {
    next(error);
  }
});

// Create new thread
threadsRouter.post('/', optionalAuth, async (req, res, next) => {
  try {
    const { title, agentId, teamId, projectId, visibility } = createThreadSchema.parse(req.body);

    // If teamId is provided, verify membership and write permission
    if (teamId) {
      if (!req.user) {
        throw new AppError(HTTP_STATUS.UNAUTHORIZED, 'Authentication required for team threads');
      }

      const membership = await db.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId,
            userId: req.user.id,
          },
        },
      });

      if (!membership) {
        throw new AppError(HTTP_STATUS.FORBIDDEN, 'You are not a member of this team');
      }

      // Viewers cannot create threads
      if (membership.role === 'viewer') {
        throw new AppError(HTTP_STATUS.FORBIDDEN, 'Viewers cannot create team threads');
      }
    }

    // If projectId is provided, validate access and permissions
    let effectiveTeamId = teamId || null;
    if (projectId) {
      if (!req.user) {
        throw new AppError(HTTP_STATUS.UNAUTHORIZED, 'Authentication required for project threads');
      }

      const project = await db.project.findUnique({
        where: { id: projectId },
      });

      if (!project || project.archivedAt) {
        throw new AppError(HTTP_STATUS.NOT_FOUND, 'Project not found');
      }

      // Check project access
      if (project.userId !== req.user.id) {
        if (!project.teamId || project.sharing === 'private') {
          throw new AppError(HTTP_STATUS.FORBIDDEN, 'Access denied');
        }

        // For team-shared projects, verify team membership and write permission
        const membership = await db.teamMember.findUnique({
          where: {
            teamId_userId: {
              teamId: project.teamId,
              userId: req.user.id,
            },
          },
        });

        if (!membership) {
          throw new AppError(HTTP_STATUS.FORBIDDEN, 'Access denied');
        }

        if (membership.role === 'viewer') {
          throw new AppError(HTTP_STATUS.FORBIDDEN, 'Viewers cannot create threads');
        }
      }

      // Thread inherits teamId from project
      effectiveTeamId = project.teamId;
    }

    // Validate agent access if specified
    if (agentId) {
      if (!canAccessAgent(agentId, req.user?.plan)) {
        throw new AppError(HTTP_STATUS.FORBIDDEN, 'You do not have access to this agent');
      }
    }

    // Use specified agent or default
    const effectiveAgentId = agentId || getDefaultAgent().id;
    const agent = getAgentById(effectiveAgentId);

    const thread = await db.thread.create({
      data: {
        title: title || 'New Chat',
        userId: req.user?.id,
        teamId: effectiveTeamId,
        projectId: projectId || null,
        agentId: effectiveAgentId,
        visibility: effectiveTeamId ? (visibility || 'private') : 'shared',
      },
    });

    res.status(HTTP_STATUS.CREATED).json({
      thread: {
        ...thread,
        agentName: agent?.name,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get thread with messages
threadsRouter.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const thread = await db.thread.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!thread) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Thread not found');
    }

    // Check access - team threads require membership
    if (thread.teamId) {
      if (!req.user) {
        throw new AppError(HTTP_STATUS.UNAUTHORIZED, 'Authentication required');
      }
      const membership = await db.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId: thread.teamId,
            userId: req.user.id,
          },
        },
      });
      if (!membership) {
        throw new AppError(HTTP_STATUS.FORBIDDEN, 'Access denied');
      }
      // Private threads only visible to creator and admins/owners
      if (thread.visibility === 'private' && thread.userId !== req.user.id) {
        if (!['owner', 'admin'].includes(membership.role)) {
          throw new AppError(HTTP_STATUS.FORBIDDEN, 'Access denied');
        }
      }
    } else if (thread.userId && thread.userId !== req.user?.id) {
      throw new AppError(HTTP_STATUS.FORBIDDEN, 'Access denied');
    }

    // Get agent info
    const agent = getAgentById(thread.agentId);

    res.json({
      thread: {
        ...thread,
        agentName: agent?.name,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Update thread (rename)
threadsRouter.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, visibility } = updateThreadSchema.parse(req.body);

    const thread = await db.thread.findUnique({
      where: { id },
    });

    if (!thread) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Thread not found');
    }

    // Check access - team threads require admin+ role
    if (thread.teamId) {
      const membership = await db.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId: thread.teamId,
            userId: req.user!.id,
          },
        },
      });
      if (!membership || membership.role === 'viewer') {
        throw new AppError(HTTP_STATUS.FORBIDDEN, 'Access denied');
      }
    } else if (thread.userId !== req.user!.id) {
      throw new AppError(HTTP_STATUS.FORBIDDEN, 'Access denied');
    }

    // Only the thread creator can toggle visibility
    if (visibility !== undefined && thread.userId !== req.user!.id) {
      throw new AppError(HTTP_STATUS.FORBIDDEN, 'Only the thread creator can change visibility');
    }

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (visibility !== undefined) updateData.visibility = visibility;

    const updatedThread = await db.thread.update({
      where: { id },
      data: updateData,
    });

    res.json({ thread: updatedThread });
  } catch (error) {
    next(error);
  }
});

// Delete thread
threadsRouter.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const thread = await db.thread.findUnique({
      where: { id },
    });

    if (!thread) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Thread not found');
    }

    // Check access - team threads require admin+ role to delete
    if (thread.teamId) {
      const membership = await db.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId: thread.teamId,
            userId: req.user!.id,
          },
        },
      });
      if (!membership || !['owner', 'admin'].includes(membership.role)) {
        throw new AppError(HTTP_STATUS.FORBIDDEN, 'Access denied');
      }
    } else if (thread.userId !== req.user!.id) {
      throw new AppError(HTTP_STATUS.FORBIDDEN, 'Access denied');
    }

    await db.thread.delete({
      where: { id },
    });

    res.status(HTTP_STATUS.NO_CONTENT).send();
  } catch (error) {
    next(error);
  }
});
