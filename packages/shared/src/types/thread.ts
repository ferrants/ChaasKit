import type { Message } from './message.js';

export interface Thread {
  id: string;
  title: string;
  userId?: string;
  teamId?: string | null;
  projectId?: string | null;
  agentId?: string | null;
  agentName?: string;
  parentThreadId?: string;
  parentMessageId?: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ThreadSummary {
  id: string;
  title: string;
  teamId?: string | null;
  projectId?: string | null;
  agentId?: string | null;
  agentName?: string;
  parentThreadId?: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  lastMessagePreview?: string;
}

export interface SharedThread {
  id: string;
  shareId: string;
  threadId: string;
  expiresAt?: Date;
  createdAt: Date;
}

export interface ThreadExport {
  thread: Thread;
  format: 'markdown' | 'json' | 'pdf';
  exportedAt: Date;
}
