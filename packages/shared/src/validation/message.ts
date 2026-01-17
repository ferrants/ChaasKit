import { z } from 'zod';

export const sendMessageSchema = z.object({
  threadId: z.string().optional(),
  content: z.string().min(1).max(100000),
  files: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    size: z.number(),
    content: z.string().optional(),
  })).optional(),
  agentId: z.string().max(100).optional(), // Agent to use when creating a new thread
});

export const regenerateMessageSchema = z.object({
  messageId: z.string(),
});

export const editMessageSchema = z.object({
  messageId: z.string(),
  content: z.string().min(1).max(100000),
});

export const branchFromMessageSchema = z.object({
  messageId: z.string(),
  content: z.string().min(1).max(100000).optional(),
});

export const messageFeedbackSchema = z.object({
  type: z.enum(['up', 'down']),
  comment: z.string().max(1000).optional(),
});

export const toolApprovalSchema = z.object({
  toolCallId: z.string(),
  approved: z.boolean(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type RegenerateMessageInput = z.infer<typeof regenerateMessageSchema>;
export type EditMessageInput = z.infer<typeof editMessageSchema>;
export type BranchFromMessageInput = z.infer<typeof branchFromMessageSchema>;
export type MessageFeedbackInput = z.infer<typeof messageFeedbackSchema>;
export type ToolApprovalInput = z.infer<typeof toolApprovalSchema>;
