import { db } from '@chaaskit/db';
import { getConfig } from '../config/loader.js';
import type { FreePlanParams, MonthlyPlanParams, CreditsPlanParams, BillingContext } from '@chaaskit/shared';

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
        credits: true,
        messagesThisMonth: true,
      },
    });

    if (team) {
      const teamPlanConfig = config.payments.plans.find((p) => p.id === team.plan);
      // Use team billing if team has an active plan (not 'free' or explicitly team-scoped)
      const teamHasActivePlan = team.plan !== 'free' || (teamPlanConfig?.scope === 'team' || teamPlanConfig?.scope === 'both');

      // Check if team has a paid plan or if the team's free plan should be used
      if (team.plan !== 'free' || teamPlanConfig?.scope === 'team') {
        const limits = getPlanLimits(team.plan);
        return {
          type: 'team',
          entityId: team.id,
          plan: team.plan,
          credits: team.credits,
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
      credits: true,
      messagesThisMonth: true,
    },
  });

  if (!user) {
    return null;
  }

  const limits = getPlanLimits(user.plan);
  return {
    type: 'personal',
    entityId: user.id,
    plan: user.plan,
    credits: user.credits,
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
    return true;
  }

  // Check monthly limit
  if (context.messagesThisMonth < context.monthlyLimit) {
    return true;
  }

  // Check if entity has credits
  if (context.credits > 0) {
    return true;
  }

  return false;
}

/**
 * Increment usage on the correct entity (user or team).
 * For team threads with team billing, increments team's usage.
 * Otherwise, increments user's personal usage.
 */
export async function incrementUsage(userId: string, teamId?: string): Promise<void> {
  const config = getConfig();

  if (!config.payments.enabled) {
    return;
  }

  const context = await getBillingContext(userId, teamId);
  if (!context) {
    return;
  }

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
  if (context.credits > 0) {
    if (context.type === 'team') {
      await db.team.update({
        where: { id: context.entityId },
        data: {
          credits: { decrement: 1 },
        },
      });
    } else {
      await db.user.update({
        where: { id: context.entityId },
        data: {
          credits: { decrement: 1 },
        },
      });
    }
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
      credits: true,
      messagesThisMonth: true,
      stripeCustomerId: true,
    },
  });

  if (!team) {
    return null;
  }

  const limits = getPlanLimits(team.plan);
  const planConfig = config.payments.plans.find((p) => p.id === team.plan);

  return {
    plan: team.plan,
    planName: planConfig?.name || 'Unknown',
    messagesThisMonth: team.messagesThisMonth,
    monthlyLimit: limits.monthlyMessageLimit,
    credits: team.credits,
    hasStripeCustomer: !!team.stripeCustomerId,
  };
}
