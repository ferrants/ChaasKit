import { Router, type RequestHandler } from 'express';
import { db } from '@chaaskit/db';
import crypto from 'crypto';
import {
  HTTP_STATUS,
  createTeamSchema,
  updateTeamSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
} from '@chaaskit/shared';
import type {
  TeamWithRole,
  TeamDetails,
  TeamInvite,
  TeamRole,
  TeamStats,
  TeamActivityItem,
} from '@chaaskit/shared';
import { requireAuth } from '../middleware/auth.js';
import { requireTeamRole } from '../middleware/team.js';
import { AppError } from '../middleware/errorHandler.js';
import { getAgentById } from '../services/agents.js';
import { getConfig } from '../config/loader.js';
import { notifyTeamMemberJoined } from '../services/slack/notifications.js';
import {
  isEmailEnabled,
  sendEmail,
  generateTeamInviteEmailHtml,
  generateTeamInviteEmailText,
} from '../services/email/index.js';

export const teamsRouter = Router();

// Middleware to check if teams feature is enabled
const requireTeamsEnabled: RequestHandler = (req, res, next) => {
  const config = getConfig();
  if (!config.teams?.enabled) {
    return next(new AppError(HTTP_STATUS.FORBIDDEN, 'Team workspaces are not enabled'));
  }
  next();
};

// Apply teams enabled check to all routes
teamsRouter.use(requireTeamsEnabled);

// List user's teams
teamsRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const memberships = await db.teamMember.findMany({
      where: { userId: req.user!.id },
      include: {
        team: {
          include: {
            _count: {
              select: {
                members: true,
                threads: true,
              },
            },
          },
        },
      },
    });

    const teams: TeamWithRole[] = memberships
      .filter((m) => !m.team.archivedAt) // Exclude archived teams
      .map((m) => ({
        id: m.team.id,
        name: m.team.name,
        archivedAt: m.team.archivedAt,
        createdAt: m.team.createdAt,
        updatedAt: m.team.updatedAt,
        role: m.role as TeamRole,
        memberCount: m.team._count.members,
        threadCount: m.team._count.threads,
      }));

    res.json({ teams });
  } catch (error) {
    next(error);
  }
});

// Create new team
teamsRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name } = createTeamSchema.parse(req.body);

    const team = await db.team.create({
      data: {
        name,
        members: {
          create: {
            userId: req.user!.id,
            role: 'owner',
          },
        },
      },
      include: {
        members: {
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
        },
        invites: true,
      },
    });

    const teamDetails: TeamDetails = {
      id: team.id,
      name: team.name,
      context: team.context,
      archivedAt: team.archivedAt,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
      members: team.members.map((m) => ({
        id: m.id,
        teamId: m.teamId,
        userId: m.userId,
        role: m.role as TeamRole,
        createdAt: m.createdAt,
        user: m.user,
      })),
      invites: team.invites as TeamInvite[],
    };

    res.status(HTTP_STATUS.CREATED).json({ team: teamDetails });
  } catch (error) {
    next(error);
  }
});

// Get team details
teamsRouter.get('/:teamId', requireAuth, requireTeamRole('viewer'), async (req, res, next) => {
  try {
    const { teamId } = req.params;

    const team = await db.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
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
        },
        invites: {
          where: {
            acceptedAt: null,
            expiresAt: { gt: new Date() },
          },
        },
      },
    });

    if (!team) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Team not found');
    }

    const teamDetails: TeamDetails = {
      id: team.id,
      name: team.name,
      context: team.context,
      archivedAt: team.archivedAt,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
      members: team.members.map((m) => ({
        id: m.id,
        teamId: m.teamId,
        userId: m.userId,
        role: m.role as TeamRole,
        createdAt: m.createdAt,
        user: m.user,
      })),
      invites: team.invites as TeamInvite[],
    };

    res.json({ team: teamDetails });
  } catch (error) {
    next(error);
  }
});

// Update team
teamsRouter.patch('/:teamId', requireAuth, requireTeamRole('admin'), async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const { name, context } = updateTeamSchema.parse(req.body);

    const updateData: { name?: string; context?: string | null } = {};
    if (name !== undefined) updateData.name = name;
    if (context !== undefined) updateData.context = context;

    const team = await db.team.update({
      where: { id: teamId },
      data: updateData,
    });

    res.json({ team });
  } catch (error) {
    next(error);
  }
});

// Archive team (owner only)
teamsRouter.post('/:teamId/archive', requireAuth, requireTeamRole('owner'), async (req, res, next) => {
  try {
    const { teamId } = req.params;

    const team = await db.team.update({
      where: { id: teamId },
      data: { archivedAt: new Date() },
    });

    res.json({ team });
  } catch (error) {
    next(error);
  }
});

// Unarchive team (owner only)
teamsRouter.post('/:teamId/unarchive', requireAuth, requireTeamRole('owner'), async (req, res, next) => {
  try {
    const { teamId } = req.params;

    // Need to bypass the archived check in middleware for unarchiving
    const team = await db.team.findUnique({
      where: { id: teamId },
    });

    if (!team) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Team not found');
    }

    const updatedTeam = await db.team.update({
      where: { id: teamId },
      data: { archivedAt: null },
    });

    res.json({ team: updatedTeam });
  } catch (error) {
    next(error);
  }
});

// Invite member (admin+)
teamsRouter.post('/:teamId/invite', requireAuth, requireTeamRole('admin'), async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const { email, role } = inviteMemberSchema.parse(req.body);

    // Check if user is already a member
    const existingMember = await db.teamMember.findFirst({
      where: {
        teamId,
        user: { email },
      },
    });

    if (existingMember) {
      throw new AppError(HTTP_STATUS.CONFLICT, 'User is already a member of this team');
    }

    // Check if there's already a pending invite
    const existingInvite = await db.teamInvite.findUnique({
      where: {
        teamId_email: { teamId, email },
      },
    });

    if (existingInvite && !existingInvite.acceptedAt && existingInvite.expiresAt > new Date()) {
      throw new AppError(HTTP_STATUS.CONFLICT, 'An invite already exists for this email');
    }

    // Delete expired or used invites for this email
    if (existingInvite) {
      await db.teamInvite.delete({
        where: { id: existingInvite.id },
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invite = await db.teamInvite.create({
      data: {
        teamId,
        email,
        role,
        token,
        invitedBy: req.user!.id,
        expiresAt,
      },
    });

    const config = getConfig();
    const appUrl = process.env.APP_URL || 'http://localhost:5173';
    const inviteUrl = `${appUrl}/invite/${token}`;

    // Get team name for email
    const team = await db.team.findUnique({
      where: { id: teamId },
      select: { name: true },
    });

    // Send invitation email if email is enabled
    let emailSent = false;
    if (isEmailEnabled() && team) {
      const inviterName = req.user!.name || null;
      const html = generateTeamInviteEmailHtml(team.name, inviteUrl, inviterName, config);
      const text = generateTeamInviteEmailText(team.name, inviteUrl, inviterName, config);

      try {
        const result = await sendEmail({
          to: email,
          subject: `You're invited to join ${team.name} on ${config.app.name}`,
          html,
          text,
        });
        emailSent = !!result;
        if (result) {
          console.log(`[Teams] Invitation email sent to ${email} (messageId: ${result.messageId})`);
        }
      } catch (err) {
        console.error(`[Teams] Failed to send invitation email to ${email}:`, err);
        // Continue even if email fails - the invite is still created
      }
    } else {
      // Email disabled - log the invite URL for development
      console.log(`[Teams] Email disabled - invitation URL for ${email}: ${inviteUrl}`);
    }

    res.status(HTTP_STATUS.CREATED).json({
      invite: invite as TeamInvite,
      inviteUrl,
      emailSent,
    });
  } catch (error) {
    next(error);
  }
});

// Get invite details (public - for invite acceptance page)
teamsRouter.get('/invite/:token', async (req, res, next) => {
  try {
    const { token } = req.params;

    const invite = await db.teamInvite.findUnique({
      where: { token },
      include: {
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!invite) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Invite not found');
    }

    if (invite.acceptedAt) {
      throw new AppError(HTTP_STATUS.GONE, 'Invite has already been used');
    }

    if (invite.expiresAt < new Date()) {
      throw new AppError(HTTP_STATUS.GONE, 'Invite has expired');
    }

    res.json({
      invite: {
        email: invite.email,
        role: invite.role,
        teamName: invite.team.name,
        expiresAt: invite.expiresAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Accept invite
teamsRouter.post('/invite/:token/accept', requireAuth, async (req, res, next) => {
  try {
    const { token } = req.params;

    const invite = await db.teamInvite.findUnique({
      where: { token },
      include: {
        team: true,
      },
    });

    if (!invite) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Invite not found');
    }

    if (invite.acceptedAt) {
      throw new AppError(HTTP_STATUS.GONE, 'Invite has already been used');
    }

    if (invite.expiresAt < new Date()) {
      throw new AppError(HTTP_STATUS.GONE, 'Invite has expired');
    }

    // Verify email matches (optional - could allow any authenticated user)
    if (invite.email.toLowerCase() !== req.user!.email.toLowerCase()) {
      throw new AppError(HTTP_STATUS.FORBIDDEN, 'This invite is for a different email address');
    }

    // Check if already a member
    const existingMember = await db.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId: invite.teamId,
          userId: req.user!.id,
        },
      },
    });

    if (existingMember) {
      throw new AppError(HTTP_STATUS.CONFLICT, 'You are already a member of this team');
    }

    // Create membership and mark invite as accepted
    await db.$transaction([
      db.teamMember.create({
        data: {
          teamId: invite.teamId,
          userId: req.user!.id,
          role: invite.role,
        },
      }),
      db.teamInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      }),
    ]);

    // Send Slack notification for new team member
    notifyTeamMemberJoined(
      invite.teamId,
      req.user!.name,
      req.user!.email,
      invite.team.name
    ).catch(err => console.error('[Teams] Slack notification failed:', err));

    res.json({
      team: {
        id: invite.team.id,
        name: invite.team.name,
        archivedAt: invite.team.archivedAt,
        createdAt: invite.team.createdAt,
        updatedAt: invite.team.updatedAt,
      },
      role: invite.role as TeamRole,
    });
  } catch (error) {
    next(error);
  }
});

// Cancel/delete invite (admin+)
teamsRouter.delete('/:teamId/invite/:inviteId', requireAuth, requireTeamRole('admin'), async (req, res, next) => {
  try {
    const { teamId, inviteId } = req.params;

    const invite = await db.teamInvite.findUnique({
      where: { id: inviteId },
    });

    if (!invite || invite.teamId !== teamId) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Invite not found');
    }

    await db.teamInvite.delete({
      where: { id: inviteId },
    });

    res.status(HTTP_STATUS.NO_CONTENT).send();
  } catch (error) {
    next(error);
  }
});

// Remove member (admin+)
teamsRouter.delete('/:teamId/members/:userId', requireAuth, requireTeamRole('admin'), async (req, res, next) => {
  try {
    const { teamId, userId } = req.params;

    // Can't remove yourself via this endpoint
    if (userId === req.user!.id) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Use leave endpoint to remove yourself');
    }

    const membership = await db.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId },
      },
    });

    if (!membership) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Member not found');
    }

    // Can't remove owner
    if (membership.role === 'owner') {
      throw new AppError(HTTP_STATUS.FORBIDDEN, 'Cannot remove the team owner');
    }

    // Admins can't remove other admins (only owner can)
    if (membership.role === 'admin' && req.teamMember?.role !== 'owner') {
      throw new AppError(HTTP_STATUS.FORBIDDEN, 'Only the owner can remove admins');
    }

    await db.teamMember.delete({
      where: { id: membership.id },
    });

    res.status(HTTP_STATUS.NO_CONTENT).send();
  } catch (error) {
    next(error);
  }
});

// Update member role (owner only)
teamsRouter.patch('/:teamId/members/:userId', requireAuth, requireTeamRole('owner'), async (req, res, next) => {
  try {
    const { teamId, userId } = req.params;
    const { role } = updateMemberRoleSchema.parse(req.body);

    // Can't change your own role
    if (userId === req.user!.id) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Cannot change your own role');
    }

    const membership = await db.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId },
      },
    });

    if (!membership) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Member not found');
    }

    // Can't make someone else an owner (would need ownership transfer)
    if (role === 'owner') {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Cannot assign owner role. Use ownership transfer instead.');
    }

    const updatedMembership = await db.teamMember.update({
      where: { id: membership.id },
      data: { role },
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

    res.json({
      member: {
        id: updatedMembership.id,
        teamId: updatedMembership.teamId,
        userId: updatedMembership.userId,
        role: updatedMembership.role as TeamRole,
        createdAt: updatedMembership.createdAt,
        user: updatedMembership.user,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Leave team
teamsRouter.post('/:teamId/leave', requireAuth, requireTeamRole('viewer'), async (req, res, next) => {
  try {
    const { teamId } = req.params;

    // Owner can't leave without transferring ownership
    if (req.teamMember?.role === 'owner') {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Owner cannot leave. Transfer ownership first or archive the team.');
    }

    await db.teamMember.delete({
      where: {
        teamId_userId: {
          teamId,
          userId: req.user!.id,
        },
      },
    });

    res.status(HTTP_STATUS.NO_CONTENT).send();
  } catch (error) {
    next(error);
  }
});

// Get team threads
teamsRouter.get('/:teamId/threads', requireAuth, requireTeamRole('viewer'), async (req, res, next) => {
  try {
    const { teamId } = req.params;

    const threads = await db.thread.findMany({
      where: { teamId },
      select: {
        id: true,
        title: true,
        agentId: true,
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

// Get team stats
teamsRouter.get('/:teamId/stats', requireAuth, requireTeamRole('viewer'), async (req, res, next) => {
  try {
    const { teamId } = req.params;

    // Get the start of the current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Run all queries in parallel for efficiency
    const [
      totalThreads,
      totalMessages,
      messagesThisMonth,
      threadsThisMonth,
      memberCount,
      recentThreads,
      recentMembers,
    ] = await Promise.all([
      // Total threads
      db.thread.count({
        where: { teamId },
      }),
      // Total messages (in team threads)
      db.message.count({
        where: {
          thread: { teamId },
        },
      }),
      // Messages this month
      db.message.count({
        where: {
          thread: { teamId },
          createdAt: { gte: startOfMonth },
        },
      }),
      // Threads this month
      db.thread.count({
        where: {
          teamId,
          createdAt: { gte: startOfMonth },
        },
      }),
      // Member count
      db.teamMember.count({
        where: { teamId },
      }),
      // Recent threads (for activity)
      db.thread.findMany({
        where: { teamId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          title: true,
          createdAt: true,
          userId: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      // Recent member joins (for activity)
      db.teamMember.findMany({
        where: { teamId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
    ]);

    const stats: TeamStats = {
      totalThreads,
      totalMessages,
      messagesThisMonth,
      threadsThisMonth,
      memberCount,
    };

    // Combine and sort activity items (filter out any with null users)
    const activityItems: TeamActivityItem[] = [
      ...recentThreads
        .filter((thread) => thread.user !== null)
        .map((thread) => ({
          type: 'thread_created' as const,
          timestamp: thread.createdAt,
          user: {
            id: thread.user!.id,
            name: thread.user!.name,
            email: thread.user!.email,
          },
          details: thread.title || 'Untitled thread',
        })),
      ...recentMembers.map((member) => ({
        type: 'member_joined' as const,
        timestamp: member.createdAt,
        user: {
          id: member.user.id,
          name: member.user.name,
          email: member.user.email,
        },
      })),
    ];

    // Sort by timestamp descending and take the 10 most recent
    const recentActivity = activityItems
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);

    res.json({ stats, recentActivity });
  } catch (error) {
    next(error);
  }
});
