import { z } from 'zod';

export const projectSharingSchema = z.enum(['private', 'team']);

export const createProjectSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color'),
  context: z.string().max(10000).optional(),
  teamId: z.string().min(1).optional(),
  sharing: projectSharingSchema.optional().default('private'),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color').optional(),
  context: z.string().max(10000).nullable().optional(),
  sharing: projectSharingSchema.optional(),
});

export const projectIdParamSchema = z.object({
  projectId: z.string().min(1),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
