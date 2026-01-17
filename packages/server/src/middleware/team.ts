import type { Request, Response, NextFunction } from 'express';
import { db } from '@chaaskit/db';
import { AppError } from './errorHandler.js';
import { HTTP_STATUS } from '@chaaskit/shared';
import type { TeamRole, TeamMember } from '@chaaskit/shared';

declare global {
  namespace Express {
    interface Request {
      teamMember?: TeamMember;
    }
  }
}

const ROLE_HIERARCHY: Record<TeamRole, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

/**
 * Middleware factory that requires the user to have at least the specified role in a team.
 * Expects teamId to be in req.params.teamId
 */
export function requireTeamRole(minRole: TeamRole) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw new AppError(HTTP_STATUS.UNAUTHORIZED, 'Authentication required');
      }

      const teamId = req.params.teamId;
      if (!teamId) {
        throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Team ID is required');
      }

      // Check if team exists and is not archived
      const team = await db.team.findUnique({
        where: { id: teamId },
        select: { id: true, archivedAt: true },
      });

      if (!team) {
        throw new AppError(HTTP_STATUS.NOT_FOUND, 'Team not found');
      }

      if (team.archivedAt) {
        throw new AppError(HTTP_STATUS.FORBIDDEN, 'Team is archived');
      }

      // Get user's membership in this team
      const membership = await db.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId,
            userId: req.user.id,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
      });

      if (!membership) {
        throw new AppError(HTTP_STATUS.FORBIDDEN, 'You are not a member of this team');
      }

      const userRoleLevel = ROLE_HIERARCHY[membership.role as TeamRole] || 0;
      const requiredRoleLevel = ROLE_HIERARCHY[minRole];

      if (userRoleLevel < requiredRoleLevel) {
        throw new AppError(
          HTTP_STATUS.FORBIDDEN,
          `This action requires at least ${minRole} role`
        );
      }

      req.teamMember = {
        id: membership.id,
        teamId: membership.teamId,
        userId: membership.userId,
        role: membership.role as TeamRole,
        createdAt: membership.createdAt,
        user: membership.user,
      };

      next();
    } catch (error) {
      if (error instanceof AppError) {
        next(error);
        return;
      }
      next(new AppError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Team authorization failed'));
    }
  };
}

/**
 * Middleware to verify user has access to a team thread.
 * Expects threadId to be in req.params.threadId or req.body.threadId
 */
export async function requireTeamThreadAccess(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(HTTP_STATUS.UNAUTHORIZED, 'Authentication required');
    }

    const threadId = req.params.threadId || req.body.threadId;
    if (!threadId) {
      next();
      return;
    }

    const thread = await db.thread.findUnique({
      where: { id: threadId },
      select: { id: true, teamId: true, userId: true },
    });

    if (!thread) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Thread not found');
    }

    // If it's a personal thread, check ownership
    if (!thread.teamId) {
      if (thread.userId !== req.user.id) {
        throw new AppError(HTTP_STATUS.FORBIDDEN, 'You do not have access to this thread');
      }
      next();
      return;
    }

    // If it's a team thread, check membership
    const membership = await db.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId: thread.teamId,
          userId: req.user.id,
        },
      },
    });

    if (!membership) {
      throw new AppError(HTTP_STATUS.FORBIDDEN, 'You do not have access to this team thread');
    }

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    next(new AppError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Thread authorization failed'));
  }
}
