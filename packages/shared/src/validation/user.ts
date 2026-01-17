import { z } from 'zod';

export const updateUserSettingsSchema = z.object({
  name: z.string().max(100).optional(),
  role: z.string().max(50).optional(),
  context: z.string().max(2000).optional(),
  themePreference: z.string().optional(),
  mcpServers: z.array(z.object({
    id: z.string(),
    name: z.string(),
    transport: z.enum(['stdio', 'sse']),
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    url: z.string().optional(),
    enabled: z.boolean(),
  })).optional(),
  // Tools the user has permanently allowed (format: "serverId:toolName")
  allowedTools: z.array(z.string()).optional(),
}).passthrough();

export const createThreadSchema = z.object({
  title: z.string().max(200).optional(),
  agentId: z.string().max(100).optional(),
  teamId: z.string().optional(),
  projectId: z.string().optional(),
});

export const updateThreadSchema = z.object({
  title: z.string().min(1).max(200),
});

export const shareThreadSchema = z.object({
  expiresIn: z.enum(['1h', '24h', '7d', '30d', 'never']).optional(),
});

export const searchSchema = z.object({
  q: z.string().min(1).max(200),
  threadId: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  offset: z.coerce.number().min(0).optional(),
});

export type UpdateUserSettingsInput = z.infer<typeof updateUserSettingsSchema>;
export type CreateThreadInput = z.infer<typeof createThreadSchema>;
export type UpdateThreadInput = z.infer<typeof updateThreadSchema>;
export type ShareThreadInput = z.infer<typeof shareThreadSchema>;
export type SearchInput = z.infer<typeof searchSchema>;
