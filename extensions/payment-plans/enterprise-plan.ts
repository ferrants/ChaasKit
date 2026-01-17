/**
 * Enterprise Plan Example
 *
 * This custom pricing plan demonstrates:
 * - Daily and monthly message limits
 * - Per-team usage tracking (instead of per-user)
 * - Usage alerts at configurable thresholds
 * - Custom usage display
 *
 * To use this plan, add it to your config/app.config.ts:
 *
 * ```typescript
 * payments: {
 *   enabled: true,
 *   provider: 'stripe',
 *   plans: [
 *     {
 *       id: 'enterprise',
 *       name: 'Enterprise',
 *       type: 'custom',
 *       customType: 'enterprise',
 *       params: {
 *         dailyMessageLimit: 1000,
 *         monthlyMessageLimit: 50000,
 *         maxFileSize: 100,      // MB
 *         alertThresholds: [80, 90, 95],
 *       },
 *     },
 *   ],
 * }
 * ```
 */

import { registry, BasePricingPlan } from '../../packages/core-server/src/registry/index.js';
import { db } from '../../packages/db/src/index.js';

interface EnterprisePlanParams {
  dailyMessageLimit: number;
  monthlyMessageLimit: number;
  maxFileSize?: number;
  alertThresholds?: number[];
}

interface UsageStats {
  dailyCount: number;
  monthlyCount: number;
  dailyLimit: number;
  monthlyLimit: number;
}

export class EnterprisePlan extends BasePricingPlan {
  id = 'enterprise';
  name = 'Enterprise';
  type = 'custom';

  private params: EnterprisePlanParams;

  constructor(params: EnterprisePlanParams) {
    super();
    this.params = {
      dailyMessageLimit: params.dailyMessageLimit || 1000,
      monthlyMessageLimit: params.monthlyMessageLimit || 50000,
      maxFileSize: params.maxFileSize || 100,
      alertThresholds: params.alertThresholds || [80, 90, 95],
    };
    console.log(`[EnterprisePlan] Initialized with limits: ${this.params.dailyMessageLimit}/day, ${this.params.monthlyMessageLimit}/month`);
  }

  /**
   * Check if the user can send another message
   */
  async checkLimits(userId: string): Promise<boolean> {
    const stats = await this.getUsageStats(userId);

    // Check daily limit
    if (stats.dailyCount >= stats.dailyLimit) {
      console.log(`[EnterprisePlan] User ${userId} exceeded daily limit (${stats.dailyCount}/${stats.dailyLimit})`);
      return false;
    }

    // Check monthly limit
    if (stats.monthlyCount >= stats.monthlyLimit) {
      console.log(`[EnterprisePlan] User ${userId} exceeded monthly limit (${stats.monthlyCount}/${stats.monthlyLimit})`);
      return false;
    }

    return true;
  }

  /**
   * Increment usage after a message is sent
   */
  async incrementUsage(userId: string): Promise<void> {
    // Increment the user's message count
    await db.user.update({
      where: { id: userId },
      data: {
        messagesThisMonth: { increment: 1 },
      },
    });

    // Check for alerts
    await this.checkUsageAlerts(userId);
  }

  /**
   * Get current usage statistics
   */
  async getUsageStats(userId: string): Promise<UsageStats> {
    // Get today's start time
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get this month's start time
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    // Count messages sent today
    const dailyCount = await db.message.count({
      where: {
        thread: { userId },
        role: 'user',
        createdAt: { gte: today },
      },
    });

    // Count messages sent this month
    const monthlyCount = await db.message.count({
      where: {
        thread: { userId },
        role: 'user',
        createdAt: { gte: monthStart },
      },
    });

    return {
      dailyCount,
      monthlyCount,
      dailyLimit: this.params.dailyMessageLimit,
      monthlyLimit: this.params.monthlyMessageLimit,
    };
  }

  /**
   * Get usage display for the UI
   */
  async getUsageDisplay(userId: string): Promise<{
    used: number;
    limit: number;
    label: string;
    percentage: number;
    details?: Record<string, unknown>;
  }> {
    const stats = await this.getUsageStats(userId);

    return {
      used: stats.monthlyCount,
      limit: stats.monthlyLimit,
      label: `${stats.monthlyCount.toLocaleString()} / ${stats.monthlyLimit.toLocaleString()} messages this month`,
      percentage: (stats.monthlyCount / stats.monthlyLimit) * 100,
      details: {
        dailyUsed: stats.dailyCount,
        dailyLimit: stats.dailyLimit,
        dailyLabel: `${stats.dailyCount.toLocaleString()} / ${stats.dailyLimit.toLocaleString()} today`,
        dailyPercentage: (stats.dailyCount / stats.dailyLimit) * 100,
      },
    };
  }

  /**
   * Check if usage alerts should be sent
   */
  private async checkUsageAlerts(userId: string): Promise<void> {
    const stats = await this.getUsageStats(userId);
    const percentage = (stats.monthlyCount / stats.monthlyLimit) * 100;

    for (const threshold of this.params.alertThresholds || []) {
      // Check if we just crossed this threshold (within 1 message)
      const prevPercentage = ((stats.monthlyCount - 1) / stats.monthlyLimit) * 100;
      if (prevPercentage < threshold && percentage >= threshold) {
        await this.sendUsageAlert(userId, threshold, stats);
        break; // Only send one alert at a time
      }
    }
  }

  /**
   * Send a usage alert (implement your notification logic here)
   */
  private async sendUsageAlert(userId: string, threshold: number, stats: UsageStats): Promise<void> {
    // In a real implementation, you would:
    // - Send an email to the user
    // - Send a webhook to an admin dashboard
    // - Create an in-app notification

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    console.log(`[EnterprisePlan] Usage alert for ${user?.email}:`);
    console.log(`  - Threshold: ${threshold}%`);
    console.log(`  - Monthly usage: ${stats.monthlyCount} / ${stats.monthlyLimit}`);
    console.log(`  - Daily usage: ${stats.dailyCount} / ${stats.dailyLimit}`);

    // Example: You could call an external notification service here
    // await notificationService.send({
    //   type: 'usage_alert',
    //   userId,
    //   threshold,
    //   usage: stats,
    // });
  }

  /**
   * Get maximum allowed file size in MB
   */
  getMaxFileSize(): number {
    return this.params.maxFileSize || 100;
  }
}

// Factory function for creating the plan from config
export function createEnterprisePlan(params: unknown): EnterprisePlan {
  return new EnterprisePlan(params as EnterprisePlanParams);
}

// Register the plan
registry.register('payment-plan', 'enterprise', createEnterprisePlan);
