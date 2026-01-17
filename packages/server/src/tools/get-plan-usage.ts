import { db } from '@chaaskit/db';
import { getConfig } from '../config/loader.js';
import { getBillingContext, getPlanLimits } from '../services/usage.js';
import type { NativeTool } from './types.js';

export const getPlanUsageTool: NativeTool = {
  name: 'get-plan-usage',
  description: 'Get the current user\'s plan information and usage statistics including messages used, message limits, and available credits.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  _meta: {
    'ui/templateFile': 'get-plan-usage.html',
  },

  async execute(input, context) {
    const config = getConfig();

    // If payments not enabled, return simple message
    if (!config.payments.enabled) {
      return {
        content: [{ type: 'text', text: 'Payments are not enabled. Usage tracking is disabled.' }],
        structuredContent: {
          planName: 'Free',
          billingContext: 'personal',
          messagesUsed: 0,
          messageLimit: null,
          credits: null,
          periodEnd: null,
        },
      };
    }

    // Must have a user context
    if (!context.userId) {
      return {
        content: [{ type: 'text', text: 'Unable to retrieve plan information: User not authenticated.' }],
        isError: true,
      };
    }

    // Get billing context (could be personal or team-based)
    const billingContext = await getBillingContext(context.userId);

    if (!billingContext) {
      return {
        content: [{ type: 'text', text: 'Unable to retrieve billing information.' }],
        isError: true,
      };
    }

    // Get plan config to get the name
    const planConfig = config.payments.plans.find((p) => p.id === billingContext.plan);
    const planName = planConfig?.name || billingContext.plan;

    // Calculate period end (next month start)
    const now = new Date();
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Build text summary
    const lines = [
      `Plan: ${planName}`,
      `Messages used this period: ${billingContext.messagesThisMonth}`,
    ];

    if (billingContext.monthlyLimit === -1) {
      lines.push('Message limit: Unlimited');
    } else {
      lines.push(`Message limit: ${billingContext.monthlyLimit}`);
      const remaining = Math.max(0, billingContext.monthlyLimit - billingContext.messagesThisMonth);
      lines.push(`Messages remaining: ${remaining}`);
    }

    if (billingContext.credits !== undefined && billingContext.credits !== null) {
      lines.push(`Available credits: ${billingContext.credits}`);
    }

    lines.push(`Period resets: ${periodEnd.toLocaleDateString()}`);

    return {
      content: [{ type: 'text', text: lines.join('\n') }],
      structuredContent: {
        planName,
        planId: billingContext.plan,
        billingContext: billingContext.type,
        messagesUsed: billingContext.messagesThisMonth,
        messageLimit: billingContext.monthlyLimit === -1 ? null : billingContext.monthlyLimit,
        credits: billingContext.credits,
        periodEnd: periodEnd.toISOString(),
      },
    };
  },
};
