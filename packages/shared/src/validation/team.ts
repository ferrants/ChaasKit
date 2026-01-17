import { z } from 'zod';

export const teamRoleSchema = z.enum(['owner', 'admin', 'member', 'viewer']);
export const inviteRoleSchema = z.enum(['admin', 'member', 'viewer']);

export const createTeamSchema = z.object({
  name: z.string().min(1).max(100).trim(),
});

export const updateTeamSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  context: z.string().max(10000).nullable().optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email().max(255),
  role: inviteRoleSchema,
});

export const updateMemberRoleSchema = z.object({
  role: teamRoleSchema,
});

export const teamIdParamSchema = z.object({
  teamId: z.string().min(1),
});

export const userIdParamSchema = z.object({
  userId: z.string().min(1),
});

export const inviteTokenParamSchema = z.object({
  token: z.string().min(1),
});

export type InviteRole = z.infer<typeof inviteRoleSchema>;
export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
