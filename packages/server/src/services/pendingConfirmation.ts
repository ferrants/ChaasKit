/**
 * PendingConfirmationManager - Manages pending tool confirmations
 *
 * When a tool requires user confirmation, a pending confirmation is created
 * that holds a promise resolver. The chat handler awaits this promise while
 * the user is shown a confirmation modal. When the user responds via the
 * /confirm-tool API, the promise resolves and the tool continues.
 */

export type ConfirmationScope = 'once' | 'thread' | 'always';

export interface PendingConfirmation {
  id: string;
  visitorId: string;  // visitorId for SSE connection lookup
  threadId: string;
  userId: string;
  serverId: string;
  toolName: string;
  toolArgs: unknown;
  resolve: (result: { approved: boolean; scope?: ConfirmationScope }) => void;
  createdAt: number;
}

export interface CreatePendingParams {
  visitorId: string;
  threadId: string;
  userId: string;
  serverId: string;
  toolName: string;
  toolArgs: unknown;
}

export interface ConfirmationResult {
  approved: boolean;
  scope?: ConfirmationScope;
}

class PendingConfirmationManager {
  private pending = new Map<string, PendingConfirmation>();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Check every minute
  }

  /**
   * Create a new pending confirmation
   * Returns an id and a promise that resolves when the user responds
   */
  create(params: CreatePendingParams): {
    id: string;
    promise: Promise<ConfirmationResult>;
  } {
    const id = `confirm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    let resolveFunc: (result: ConfirmationResult) => void;
    const promise = new Promise<ConfirmationResult>((resolve) => {
      resolveFunc = resolve;
    });

    const confirmation: PendingConfirmation = {
      id,
      visitorId: params.visitorId,
      threadId: params.threadId,
      userId: params.userId,
      serverId: params.serverId,
      toolName: params.toolName,
      toolArgs: params.toolArgs,
      resolve: resolveFunc!,
      createdAt: Date.now(),
    };

    this.pending.set(id, confirmation);
    console.log(`[PendingConfirmation] Created: ${id} for tool ${params.serverId}:${params.toolName}`);

    return { id, promise };
  }

  /**
   * Resolve a pending confirmation
   * Called when the user responds to the confirmation modal
   */
  resolve(id: string, approved: boolean, scope?: ConfirmationScope): boolean {
    const confirmation = this.pending.get(id);
    if (!confirmation) {
      console.log(`[PendingConfirmation] Not found: ${id}`);
      return false;
    }

    console.log(`[PendingConfirmation] Resolved: ${id} approved=${approved} scope=${scope}`);
    confirmation.resolve({ approved, scope });
    this.pending.delete(id);
    return true;
  }

  /**
   * Get a pending confirmation by ID
   */
  get(id: string): PendingConfirmation | undefined {
    return this.pending.get(id);
  }

  /**
   * Clean up expired confirmations (5 minute timeout)
   * Expired confirmations are auto-denied
   */
  cleanup(): void {
    const now = Date.now();
    const expiredIds: string[] = [];

    for (const [id, confirmation] of this.pending.entries()) {
      if (now - confirmation.createdAt > this.TIMEOUT_MS) {
        expiredIds.push(id);
      }
    }

    for (const id of expiredIds) {
      const confirmation = this.pending.get(id);
      if (confirmation) {
        console.log(`[PendingConfirmation] Expired: ${id}`);
        confirmation.resolve({ approved: false }); // Auto-deny expired confirmations
        this.pending.delete(id);
      }
    }

    if (expiredIds.length > 0) {
      console.log(`[PendingConfirmation] Cleaned up ${expiredIds.length} expired confirmations`);
    }
  }

  /**
   * Get count of pending confirmations (for monitoring)
   */
  getPendingCount(): number {
    return this.pending.size;
  }

  /**
   * Shutdown - cleanup interval
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Singleton instance
export const pendingConfirmations = new PendingConfirmationManager();
