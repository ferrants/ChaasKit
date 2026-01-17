import { Router, type RequestHandler } from 'express';
import { db } from '@chaaskit/db';
import {
  HTTP_STATUS,
  createProjectSchema,
  updateProjectSchema,
} from '@chaaskit/shared';
import type { Project, ProjectWithThreadCount, ProjectSharing } from '@chaaskit/shared';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { getConfig } from '../config/loader.js';

export const projectsRouter = Router();

// Middleware to check if projects feature is enabled
const requireProjectsEnabled: RequestHandler = (req, res, next) => {
  const config = getConfig();
  if (!config.projects?.enabled) {
    return next(new AppError(HTTP_STATUS.FORBIDDEN, 'Projects are not enabled'));
  }
  next();
};

// Apply projects enabled check to all routes
projectsRouter.use(requireProjectsEnabled);

// Helper to check if user can view a project
async function canViewProject(userId: string, project: { userId: string; teamId: string | null; sharing: string }): Promise<boolean> {
  // Creator can always view
  if (project.userId === userId) return true;

  // Personal projects are private to creator
  if (!project.teamId) return false;

  // Team projects with 'private' sharing are only for creator
  if (project.sharing === 'private') return false;

  // Team projects with 'team' sharing - check membership
  const membership = await db.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId: project.teamId,
        userId,
      },
    },
  });

  return !!membership;
}

// Helper to check if user can edit a project
async function canEditProject(userId: string, project: { userId: string; teamId: string | null }): Promise<boolean> {
  // Creator can always edit
  if (project.userId === userId) return true;

  // Personal projects - only creator
  if (!project.teamId) return false;

  // Team projects - check if user is owner or admin
  const membership = await db.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId: project.teamId,
        userId,
      },
    },
  });

  return membership?.role === 'owner' || membership?.role === 'admin';
}

// List user's projects
projectsRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { teamId } = req.query;

    // Build where clause
    const whereClause: {
      archivedAt: null;
      OR?: Array<{
        userId?: string;
        AND?: Array<{
          teamId: string;
          sharing: string;
        }>;
      }>;
      teamId?: string | null;
      userId?: string;
    } = {
      archivedAt: null,
    };

    if (teamId && typeof teamId === 'string') {
      // Filter by specific team - show user's projects and team-shared projects
      whereClause.teamId = teamId;
      whereClause.OR = [
        { userId }, // User's own projects in this team
        { AND: [{ teamId, sharing: 'team' }] }, // Team-shared projects
      ];
    } else {
      // Personal view - only return personal projects (no teamId)
      whereClause.userId = userId;
      whereClause.teamId = null;
    }

    const projects = await db.project.findMany({
      where: whereClause,
      include: {
        _count: {
          select: {
            threads: {
              where: { archivedAt: null },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result: ProjectWithThreadCount[] = projects.map((p) => ({
      id: p.id,
      name: p.name,
      context: p.context,
      color: p.color,
      sharing: p.sharing as ProjectSharing,
      userId: p.userId,
      teamId: p.teamId,
      archivedAt: p.archivedAt,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      threadCount: p._count.threads,
    }));

    res.json({ projects: result });
  } catch (error) {
    next(error);
  }
});

// Create project
projectsRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const config = getConfig();
    const { name, color, context, teamId, sharing } = createProjectSchema.parse(req.body);

    // Validate color is in allowed colors
    const allowedColors = config.projects?.colors || [];
    if (!allowedColors.includes(color)) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Invalid project color');
    }

    // If teamId provided, validate membership and permissions
    if (teamId) {
      const membership = await db.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId,
            userId,
          },
        },
      });

      if (!membership) {
        throw new AppError(HTTP_STATUS.FORBIDDEN, 'You are not a member of this team');
      }

      // Viewers cannot create projects
      if (membership.role === 'viewer') {
        throw new AppError(HTTP_STATUS.FORBIDDEN, 'Viewers cannot create projects');
      }
    } else {
      // Personal projects are always private
      if (sharing === 'team') {
        throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Personal projects cannot have team sharing');
      }
    }

    const project = await db.project.create({
      data: {
        name,
        color,
        context: context || null,
        sharing: teamId ? (sharing || 'private') : 'private',
        userId,
        teamId: teamId || null,
      },
    });

    const result: Project = {
      id: project.id,
      name: project.name,
      context: project.context,
      color: project.color,
      sharing: project.sharing as ProjectSharing,
      userId: project.userId,
      teamId: project.teamId,
      archivedAt: project.archivedAt,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };

    res.status(HTTP_STATUS.CREATED).json({ project: result });
  } catch (error) {
    next(error);
  }
});

// Get project details
projectsRouter.get('/:projectId', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { projectId } = req.params;

    const project = await db.project.findUnique({
      where: { id: projectId },
    });

    if (!project || project.archivedAt) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Project not found');
    }

    const canView = await canViewProject(userId, project);
    if (!canView) {
      throw new AppError(HTTP_STATUS.FORBIDDEN, 'Access denied');
    }

    const result: Project = {
      id: project.id,
      name: project.name,
      context: project.context,
      color: project.color,
      sharing: project.sharing as ProjectSharing,
      userId: project.userId,
      teamId: project.teamId,
      archivedAt: project.archivedAt,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };

    res.json({ project: result });
  } catch (error) {
    next(error);
  }
});

// Update project
projectsRouter.patch('/:projectId', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { projectId } = req.params;
    const config = getConfig();
    const { name, color, context, sharing } = updateProjectSchema.parse(req.body);

    const project = await db.project.findUnique({
      where: { id: projectId },
    });

    if (!project || project.archivedAt) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Project not found');
    }

    const canEdit = await canEditProject(userId, project);
    if (!canEdit) {
      throw new AppError(HTTP_STATUS.FORBIDDEN, 'Access denied');
    }

    // Validate color if provided
    if (color) {
      const allowedColors = config.projects?.colors || [];
      if (!allowedColors.includes(color)) {
        throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Invalid project color');
      }
    }

    // Personal projects cannot have team sharing
    if (!project.teamId && sharing === 'team') {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Personal projects cannot have team sharing');
    }

    const updateData: { name?: string; color?: string; context?: string | null; sharing?: string } = {};
    if (name !== undefined) updateData.name = name;
    if (color !== undefined) updateData.color = color;
    if (context !== undefined) updateData.context = context;
    if (sharing !== undefined && project.teamId) updateData.sharing = sharing;

    const updated = await db.project.update({
      where: { id: projectId },
      data: updateData,
    });

    const result: Project = {
      id: updated.id,
      name: updated.name,
      context: updated.context,
      color: updated.color,
      sharing: updated.sharing as ProjectSharing,
      userId: updated.userId,
      teamId: updated.teamId,
      archivedAt: updated.archivedAt,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };

    res.json({ project: result });
  } catch (error) {
    next(error);
  }
});

// Archive project (and its threads)
projectsRouter.post('/:projectId/archive', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { projectId } = req.params;

    const project = await db.project.findUnique({
      where: { id: projectId },
    });

    if (!project || project.archivedAt) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Project not found');
    }

    const canEdit = await canEditProject(userId, project);
    if (!canEdit) {
      throw new AppError(HTTP_STATUS.FORBIDDEN, 'Access denied');
    }

    const now = new Date();

    // Archive project and all its threads in a transaction
    await db.$transaction([
      db.project.update({
        where: { id: projectId },
        data: { archivedAt: now },
      }),
      db.thread.updateMany({
        where: { projectId, archivedAt: null },
        data: { archivedAt: now },
      }),
    ]);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
