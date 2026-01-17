/**
 * Data loaders for React Router v7 routes.
 *
 * These functions load data on the server for SSR pages.
 * Import them in your React Router route loaders.
 *
 * @example
 * ```tsx
 * // app/routes/shared.$shareId.tsx
 * import { loadSharedThread } from '@chaaskit/server/loaders';
 *
 * export async function loader({ params }: Route.LoaderArgs) {
 *   const data = await loadSharedThread(params.shareId!);
 *   return data;
 * }
 * ```
 */

import { db } from '@chaaskit/db';

// ============================================
// Types
// ============================================

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
  threadId: string;
}

export interface SharedThreadData {
  thread: {
    id: string;
    title: string;
    messages: Message[];
    createdAt: Date;
  };
}

export interface LoaderError extends Error {
  status: number;
}

// ============================================
// Shared Thread Loader
// ============================================

/**
 * Loads a shared thread by its share ID.
 * Returns the thread data including all messages.
 *
 * @throws Error with status 404 if thread not found
 * @throws Error with status 410 if share link has expired
 */
export async function loadSharedThread(shareId: string): Promise<SharedThreadData> {
  const shared = await db.sharedThread.findUnique({
    where: { shareId },
    include: {
      thread: {
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              role: true,
              content: true,
              createdAt: true,
              threadId: true,
            },
          },
        },
      },
    },
  });

  if (!shared) {
    const error = new Error('Shared thread not found') as LoaderError;
    error.status = 404;
    throw error;
  }

  // Check expiration
  if (shared.expiresAt && shared.expiresAt < new Date()) {
    const error = new Error('Share link has expired') as LoaderError;
    error.status = 410;
    throw error;
  }

  return {
    thread: {
      id: shared.thread.id,
      title: shared.thread.title,
      messages: shared.thread.messages.map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
        createdAt: m.createdAt,
        threadId: m.threadId,
      })),
      createdAt: shared.thread.createdAt,
    },
  };
}
