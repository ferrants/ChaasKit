import { Router } from 'express';
import Stripe from 'stripe';
import { db } from '@chaaskit/db';
import { HTTP_STATUS } from '@chaaskit/shared';
import type { PlanScope } from '@chaaskit/shared';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { getConfig } from '../config/loader.js';
import { getTeamSubscription, getPlanLimits } from '../services/usage.js';
import { grantCredits } from '../services/credits.js';
import { getReferralForUser, grantReferralCreditsIfEligible } from '../services/referrals.js';
import {
  isEmailEnabled,
  sendEmail,
  generatePaymentFailedEmailHtml,
  generatePaymentFailedEmailText,
} from '../services/email/index.js';

export const paymentsRouter = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

/**
 * Helper to check if a plan can be used for the given scope
 */
function canUseForScope(planScope: PlanScope | undefined, targetScope: 'personal' | 'team'): boolean {
  const scope = planScope || 'personal'; // Default to personal if not specified
  return scope === 'both' || scope === targetScope;
}

/**
 * Helper to verify team admin/owner access
 */
async function verifyTeamAdmin(userId: string, teamId: string): Promise<void> {
  const membership = await db.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId,
        userId,
      },
    },
  });

  if (!membership) {
    throw new AppError(HTTP_STATUS.FORBIDDEN, 'Not a member of this team');
  }

  if (membership.role !== 'owner' && membership.role !== 'admin') {
    throw new AppError(HTTP_STATUS.FORBIDDEN, 'Only team owners and admins can manage billing');
  }
}

function formatAmount(amount: number | null | undefined, currency: string | null | undefined): string | undefined {
  if (typeof amount !== 'number' || !currency) return undefined;
  const value = (amount / 100).toFixed(2);
  return `${value} ${currency.toUpperCase()}`;
}

async function notifyPaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const config = getConfig();
  if (!isEmailEnabled()) {
    console.log('[Payments] Email disabled, skipping payment failed notification');
    return;
  }

  const customerId = invoice.customer as string | null;
  if (!customerId) {
    return;
  }

  const amountDue = formatAmount(invoice.amount_due, invoice.currency);
  const invoiceUrl = invoice.hosted_invoice_url || null;

  const team = await db.team.findFirst({
    where: { stripeCustomerId: customerId },
    include: {
      members: {
        where: { role: 'owner' },
        select: {
          user: { select: { email: true, name: true } },
        },
      },
    },
  });

  let recipients: string[] = [];
  let subjectName = 'your account';

  if (team) {
    subjectName = `team ${team.name}`;
    recipients = team.members.map((m) => m.user.email);

    if (recipients.length === 0) {
      const admins = await db.teamMember.findMany({
        where: { teamId: team.id, role: 'admin' },
        select: { user: { select: { email: true } } },
      });
      recipients = admins.map((m) => m.user.email);
    }
  } else {
    const user = await db.user.findFirst({
      where: { stripeCustomerId: customerId },
      select: { email: true },
    });
    if (user) {
      recipients = [user.email];
    }
  }

  if (recipients.length === 0) {
    return;
  }

  const html = generatePaymentFailedEmailHtml(
    { subjectName, amountDue, invoiceUrl },
    config
  );
  const text = generatePaymentFailedEmailText(
    { subjectName, amountDue, invoiceUrl },
    config
  );

  await sendEmail({
    to: recipients,
    subject: `Payment failed for ${config.app.name}`,
    html,
    text,
  });
}

// Get all plans (public endpoint for pricing page)
paymentsRouter.get('/plans', async (_req, res, next) => {
  try {
    const config = getConfig();

    if (!config.payments.enabled) {
      res.json({ plans: [] });
      return;
    }

    // Return plans with pricing info (but not sensitive data like stripe IDs)
    const plans = config.payments.plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      type: plan.type,
      scope: plan.scope || 'personal',
      priceUSD: plan.type === 'monthly' ? (plan.params as { priceUSD: number }).priceUSD :
                plan.type === 'credits' ? (plan.params as { pricePerCredit: number }).pricePerCredit : 0,
      monthlyMessageLimit: (plan.params as { monthlyMessageLimit?: number }).monthlyMessageLimit,
    }));

    res.json({ plans });
  } catch (error) {
    next(error);
  }
});

// Create checkout session (supports both personal and team)
paymentsRouter.post('/checkout', requireAuth, async (req, res, next) => {
  try {
    const config = getConfig();
    const { planId, teamId } = req.body;

    if (!config.payments.enabled) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Payments are disabled');
    }

    const plan = config.payments.plans.find((p) => p.id === planId);
    if (!plan) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Invalid plan');
    }

    if (plan.type === 'free') {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Cannot checkout for free plan');
    }

    if (plan.type !== 'monthly') {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Only monthly plans support checkout');
    }

    // Determine if this is a team or personal checkout
    const isTeamCheckout = !!teamId;
    const targetScope = isTeamCheckout ? 'team' : 'personal';

    // Validate plan scope
    if (!canUseForScope(plan.scope, targetScope)) {
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        isTeamCheckout
          ? 'This plan is not available for teams'
          : 'This plan is only available for teams'
      );
    }

    const params = plan.params as { stripePriceId: string };
    let customerId: string;
    let successUrl: string;
    let cancelUrl: string;

    if (isTeamCheckout) {
      // Team checkout - verify admin access
      await verifyTeamAdmin(req.user!.id, teamId);

      // Get or create Stripe customer for team
      let team = await db.team.findUnique({
        where: { id: teamId },
      });

      if (!team) {
        throw new AppError(HTTP_STATUS.NOT_FOUND, 'Team not found');
      }

      customerId = team.stripeCustomerId || '';

      if (!customerId) {
        const customer = await stripe.customers.create({
          name: team.name,
          metadata: { teamId: team.id },
        });
        customerId = customer.id;

        await db.team.update({
          where: { id: teamId },
          data: { stripeCustomerId: customerId },
        });
      }

      successUrl = `${process.env.APP_URL}/team/${teamId}/settings?payment=success`;
      cancelUrl = `${process.env.APP_URL}/team/${teamId}/settings?payment=cancelled`;
    } else {
      // Personal checkout
      let user = await db.user.findUnique({
        where: { id: req.user!.id },
      });

      customerId = user?.stripeCustomerId || '';

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: req.user!.email,
          metadata: { userId: req.user!.id },
        });
        customerId = customer.id;

        await db.user.update({
          where: { id: req.user!.id },
          data: { stripeCustomerId: customerId },
        });
      }

      successUrl = `${process.env.APP_URL}/settings?payment=success`;
      cancelUrl = `${process.env.APP_URL}/settings?payment=cancelled`;
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: params.stripePriceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId: req.user!.id,
        planId: plan.id,
        ...(isTeamCheckout ? { teamId } : {}),
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    next(error);
  }
});

// Buy credits (supports both personal and team)
paymentsRouter.post('/buy-credits', requireAuth, async (req, res, next) => {
  try {
    const config = getConfig();
    const { amount, teamId } = req.body;

    if (!config.payments.enabled) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Payments are disabled');
    }

    const creditsPlan = config.payments.plans.find((p) => p.type === 'credits');
    if (!creditsPlan) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Credits plan not available');
    }

    const params = creditsPlan.params as { pricePerCredit: number };
    const totalPrice = Math.round(amount * params.pricePerCredit * 100); // cents

    const isTeamPurchase = !!teamId;
    let customerId: string;
    let successUrl: string;
    let cancelUrl: string;

    if (isTeamPurchase) {
      // Team purchase - verify admin access
      await verifyTeamAdmin(req.user!.id, teamId);

      let team = await db.team.findUnique({
        where: { id: teamId },
      });

      if (!team) {
        throw new AppError(HTTP_STATUS.NOT_FOUND, 'Team not found');
      }

      customerId = team.stripeCustomerId || '';

      if (!customerId) {
        const customer = await stripe.customers.create({
          name: team.name,
          metadata: { teamId: team.id },
        });
        customerId = customer.id;

        await db.team.update({
          where: { id: teamId },
          data: { stripeCustomerId: customerId },
        });
      }

      successUrl = `${process.env.APP_URL}/team/${teamId}/settings?credits=success`;
      cancelUrl = `${process.env.APP_URL}/team/${teamId}/settings?credits=cancelled`;
    } else {
      // Personal purchase
      let user = await db.user.findUnique({
        where: { id: req.user!.id },
      });

      customerId = user?.stripeCustomerId || '';

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: req.user!.email,
          metadata: { userId: req.user!.id },
        });
        customerId = customer.id;

        await db.user.update({
          where: { id: req.user!.id },
          data: { stripeCustomerId: customerId },
        });
      }

      successUrl = `${process.env.APP_URL}/settings?credits=success`;
      cancelUrl = `${process.env.APP_URL}/settings?credits=cancelled`;
    }

    // Create checkout session for one-time payment
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${amount} Credits${isTeamPurchase ? ' (Team)' : ''}`,
            },
            unit_amount: totalPrice,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId: req.user!.id,
        credits: amount.toString(),
        ...(isTeamPurchase ? { teamId } : {}),
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    next(error);
  }
});

// Billing portal (personal)
paymentsRouter.post('/billing-portal', requireAuth, async (req, res, next) => {
  try {
    const user = await db.user.findUnique({
      where: { id: req.user!.id },
    });

    if (!user?.stripeCustomerId) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'No billing account found');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.APP_URL}/settings`,
    });

    res.json({ url: session.url });
  } catch (error) {
    next(error);
  }
});

// Team billing portal
paymentsRouter.post('/team/:teamId/billing-portal', requireAuth, async (req, res, next) => {
  try {
    const { teamId } = req.params;

    // Verify admin access
    await verifyTeamAdmin(req.user!.id, teamId);

    const team = await db.team.findUnique({
      where: { id: teamId },
    });

    if (!team?.stripeCustomerId) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'No billing account found for this team');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: team.stripeCustomerId,
      return_url: `${process.env.APP_URL}/team/${teamId}/settings`,
    });

    res.json({ url: session.url });
  } catch (error) {
    next(error);
  }
});

// Get team subscription info
paymentsRouter.get('/team/:teamId/subscription', requireAuth, async (req, res, next) => {
  try {
    const { teamId } = req.params;

    // Verify membership (any role can view)
    const membership = await db.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId: req.user!.id,
        },
      },
    });

    if (!membership) {
      throw new AppError(HTTP_STATUS.FORBIDDEN, 'Not a member of this team');
    }

    const subscription = await getTeamSubscription(teamId);

    if (!subscription) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Team not found');
    }

    res.json(subscription);
  } catch (error) {
    next(error);
  }
});

// Webhook handler
paymentsRouter.post(
  '/webhook',
  // Stripe requires raw body for webhook verification
  async (req, res) => {
    const sig = req.headers['stripe-signature'];

    if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
      res.status(400).send('Missing signature');
      return;
    }

    let event: Stripe.Event;

    try {
      // Note: In production, you'd need to use express.raw() for this route
      const rawBody =
        typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      event = stripe.webhooks.constructEvent(
        rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      res.status(400).send('Webhook error');
      return;
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          const teamId = session.metadata?.teamId;
          const userId = session.metadata?.userId;
          const planId = session.metadata?.planId;
          const credits = parseInt(session.metadata?.credits || '0', 10);

          if (session.mode === 'subscription') {
            // Update plan on user or team
            if (teamId && planId) {
              await db.team.update({
                where: { id: teamId },
                data: {
                  plan: planId,
                  messagesThisMonth: 0, // Reset usage
                },
              });
              console.log(`[Webhook] Updated team ${teamId} to plan ${planId}`);
            } else if (userId && planId) {
              await db.user.update({
                where: { id: userId },
                data: {
                  plan: planId,
                  messagesThisMonth: 0, // Reset usage
                },
              });
              console.log(`[Webhook] Updated user ${userId} to plan ${planId}`);

              if (planId !== 'free') {
                const referral = await getReferralForUser(userId);
                if (referral) {
                  await grantReferralCreditsIfEligible({ referralId: referral.id, event: 'paying' });
                }
              }
            }
          } else if (session.mode === 'payment' && credits > 0) {
            // Add credits to user or team
            if (teamId) {
              await grantCredits({
                ownerType: 'team',
                ownerId: teamId,
                amount: credits,
                reason: 'purchase',
                sourceType: 'purchase',
                metadata: { checkoutSessionId: session.id },
              });
              console.log(`[Webhook] Added ${credits} credits to team ${teamId}`);
            } else if (userId) {
              await grantCredits({
                ownerType: 'user',
                ownerId: userId,
                amount: credits,
                reason: 'purchase',
                sourceType: 'purchase',
                metadata: { checkoutSessionId: session.id },
              });
              console.log(`[Webhook] Added ${credits} credits to user ${userId}`);
            }
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;

          // Check if this is a team or user customer
          const team = await db.team.findFirst({
            where: { stripeCustomerId: customerId },
          });

          if (team) {
            await db.team.update({
              where: { id: team.id },
              data: { plan: 'free' },
            });
            console.log(`[Webhook] Team ${team.id} subscription cancelled, reverted to free`);
          } else {
            const user = await db.user.findFirst({
              where: { stripeCustomerId: customerId },
            });

            if (user) {
              await db.user.update({
                where: { id: user.id },
                data: { plan: 'free' },
              });
              console.log(`[Webhook] User ${user.id} subscription cancelled, reverted to free`);
            }
          }
          break;
        }

        case 'customer.subscription.updated': {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;

          // Handle plan changes
          if (subscription.status === 'active') {
            const planId = subscription.metadata?.planId;

            // Check if this is a team or user customer
            const team = await db.team.findFirst({
              where: { stripeCustomerId: customerId },
            });

            if (team && planId) {
              await db.team.update({
                where: { id: team.id },
                data: { plan: planId },
              });
              console.log(`[Webhook] Team ${team.id} plan updated to ${planId}`);
            } else {
              const user = await db.user.findFirst({
                where: { stripeCustomerId: customerId },
              });

              if (user && planId) {
                await db.user.update({
                  where: { id: user.id },
                  data: { plan: planId },
                });
                console.log(`[Webhook] User ${user.id} plan updated to ${planId}`);

                if (planId !== 'free') {
                  const referral = await getReferralForUser(user.id);
                  if (referral) {
                    await grantReferralCreditsIfEligible({ referralId: referral.id, event: 'paying' });
                  }
                }
              }
            }
          }
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice;
          console.error('Payment failed for customer:', invoice.customer);
          await notifyPaymentFailed(invoice);
          break;
        }
      }

      res.json({ received: true });
    } catch (error) {
      console.error('Webhook handler error:', error);
      res.status(500).json({ error: 'Webhook handler failed' });
    }
  }
);

export { notifyPaymentFailed };
