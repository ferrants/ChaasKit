import { db } from '@chaaskit/db';
import { getConfig } from '../config/loader.js';
import { calculateCreditsCost, consumeCredits, getCreditsBalance } from './credits.js';
import type { FreePlanParams, MonthlyPlanParams, BillingContext } from '@chaaskit/shared';

export interface PlanLimits {
  monthlyMessageLimit: number;
  canUseCredits: boolean;
}

export function getPlanLimits(planId: string): PlanLimits {
  const config = getConfig();
  const plan = config.payments.plans.find((p) => p.id === planId);

  if (!plan) {
    return { monthlyMessageLimit: 0, canUseCredits: false };
  }

  if (plan.type === 'free') {
    const params = plan.params as FreePlanParams;
    return {
      monthlyMessageLimit: params.monthlyMessageLimit,
      canUseCredits: false,
    };
  }

  if (plan.type === 'monthly') {
    const params = plan.params as MonthlyPlanParams;
    return {
      monthlyMessageLimit: params.monthlyMessageLimit,
      canUseCredits: false,
    };
  }

  if (plan.type === 'credits') {
    return {
      monthlyMessageLimit: -1, // Unlimited with credits
      canUseCredits: true,
    };
  }

  return { monthlyMessageLimit: 0, canUseCredits: false };
}

/**
 * Determine the billing context for a message.
 * - Personal thread: Use user's personal plan/credits
 * - Team thread with team plan: Use team's pool
 * - Team thread without team plan: Fall back to user's personal plan
 */
export async function getBillingContext(userId: string, teamId?: string): Promise<BillingContext | null> {
  const config = getConfig();

  if (!config.payments.enabled) {
    return null;
  }

  // If team thread, check if team has a plan
  if (teamId) {
    const team = await db.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        plan: true,
        messagesThisMonth: true,
      },
    });

    if (team) {
      const teamPlanConfig = config.payments.plans.find((p) => p.id === team.plan);
      const teamUsesPlan = team.plan !== 'free' || (teamPlanConfig?.scope === 'team' || teamPlanConfig?.scope === 'both');

      // Check if team has a paid plan or if the team's free plan should be used
      if (teamUsesPlan) {
        const limits = getPlanLimits(team.plan);
        const credits = await getCreditsBalance('team', team.id);
        return {
          type: 'team',
          entityId: team.id,
          plan: team.plan,
          credits: credits.balance,
          messagesThisMonth: team.messagesThisMonth,
          monthlyLimit: limits.monthlyMessageLimit,
        };
      }
    }
  }

  // Fall back to personal billing
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      plan: true,
      messagesThisMonth: true,
    },
  });

  if (!user) {
    return null;
  }

  const limits = getPlanLimits(user.plan);
  const credits = await getCreditsBalance('user', user.id);
  return {
    type: 'personal',
    entityId: user.id,
    plan: user.plan,
    credits: credits.balance,
    messagesThisMonth: user.messagesThisMonth,
    monthlyLimit: limits.monthlyMessageLimit,
  };
}

/**
 * Check if user/team can send a message based on their usage limits.
 * For team threads, checks team's quota first, then falls back to user's personal quota.
 */
export async function checkUsageLimits(userId: string, teamId?: string): Promise<boolean> {
  const config = getConfig();

  if (!config.payments.enabled) {
    return true; // No limits if payments disabled
  }

  const context = await getBillingContext(userId, teamId);
  if (!context) {
    return false;
  }

  // Unlimited plan
  if (context.monthlyLimit === -1) {
    if (!config.credits?.enabled) {
      return false;
    }
    return context.credits > 0;
  }

  // Check monthly limit
  if (context.messagesThisMonth < context.monthlyLimit) {
    return true;
  }

  // Check if entity has credits
  if (config.credits?.enabled && context.credits > 0) {
    return true;
  }

  return false;
}

/**
 * Increment usage on the correct entity (user or team).
 * For team threads with team billing, increments team's usage.
 * Otherwise, increments user's personal usage.
 */
export async function incrementUsage(
  userId: string,
  teamId?: string,
  usage?: { inputTokens?: number; outputTokens?: number }
): Promise<void> {
  const config = getConfig();

  if (!config.payments.enabled) {
    return;
  }

  const context = await getBillingContext(userId, teamId);
  if (!context) {
    return;
  }

  const totalTokens = (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0);
  const creditsCost = calculateCreditsCost(totalTokens);

  // If unlimited plan, increment monthly usage for tracking purposes
  if (context.monthlyLimit === -1) {
    if (context.type === 'team') {
      await db.team.update({
        where: { id: context.entityId },
        data: {
          messagesThisMonth: { increment: 1 },
        },
      });
    } else {
      await db.user.update({
        where: { id: context.entityId },
        data: {
          messagesThisMonth: { increment: 1 },
        },
      });
    }
    if (config.credits?.enabled) {
      await consumeCredits({
        ownerType: context.type === 'team' ? 'team' : 'user',
        ownerId: context.entityId,
        amount: creditsCost,
        reason: 'usage',
        sourceType: 'usage',
        metadata: {
          inputTokens: usage?.inputTokens ?? 0,
          outputTokens: usage?.outputTokens ?? 0,
        },
      });
    }
    return;
  }

  // If under monthly limit, increment monthly usage
  if (context.messagesThisMonth < context.monthlyLimit) {
    if (context.type === 'team') {
      await db.team.update({
        where: { id: context.entityId },
        data: {
          messagesThisMonth: { increment: 1 },
        },
      });
    } else {
      await db.user.update({
        where: { id: context.entityId },
        data: {
          messagesThisMonth: { increment: 1 },
        },
      });
    }
    return;
  }

  // Otherwise, deduct a credit
  if (config.credits?.enabled && context.credits > 0) {
    await consumeCredits({
      ownerType: context.type === 'team' ? 'team' : 'user',
      ownerId: context.entityId,
      amount: creditsCost,
      reason: 'usage',
      sourceType: 'usage',
      metadata: {
        inputTokens: usage?.inputTokens ?? 0,
        outputTokens: usage?.outputTokens ?? 0,
      },
    });
  }
}

/**
 * Reset monthly usage for all users AND teams.
 * Call via cron job at start of month.
 */
export async function resetMonthlyUsage(): Promise<void> {
  // Reset users
  await db.user.updateMany({
    data: {
      messagesThisMonth: 0,
    },
  });

  // Reset teams
  await db.team.updateMany({
    data: {
      messagesThisMonth: 0,
    },
  });
}

/**
 * Get team subscription info.
 */
export async function getTeamSubscription(teamId: string): Promise<{
  plan: string;
  planName: string;
  messagesThisMonth: number;
  monthlyLimit: number;
  credits: number;
  hasStripeCustomer: boolean;
} | null> {
  const config = getConfig();

  const team = await db.team.findUnique({
    where: { id: teamId },
    select: {
      plan: true,
      messagesThisMonth: true,
      stripeCustomerId: true,
    },
  });

  if (!team) {
    return null;
  }

  const limits = getPlanLimits(team.plan);
  const planConfig = config.payments.plans.find((p) => p.id === team.plan);
  const credits = await getCreditsBalance('team', teamId);

  return {
    plan: team.plan,
    planName: planConfig?.name || 'Unknown',
    messagesThisMonth: team.messagesThisMonth,
    monthlyLimit: limits.monthlyMessageLimit,
    credits: credits.balance,
    hasStripeCustomer: !!team.stripeCustomerId,
  };
}
