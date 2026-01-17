import { Router } from 'express';
import { db } from '@chaaskit/db';
import { HTTP_STATUS, updateUserSettingsSchema } from '@chaaskit/shared';
import { requireAuth } from '../middleware/auth.js';
import { getConfig } from '../config/loader.js';
import { getPlanLimits } from '../services/usage.js';

export const userRouter = Router();

// Get user settings
userRouter.get('/settings', requireAuth, async (req, res, next) => {
  try {
    const user = await db.user.findUnique({
      where: { id: req.user!.id },
      select: {
        settings: true,
        themePreference: true,
      },
    });

    res.json({
      settings: user?.settings || {},
      themePreference: user?.themePreference,
    });
  } catch (error) {
    next(error);
  }
});

// Update user settings
userRouter.patch('/settings', requireAuth, async (req, res, next) => {
  try {
    const data = updateUserSettingsSchema.parse(req.body);

    const { themePreference, ...settingsData } = data;

    const user = await db.user.update({
      where: { id: req.user!.id },
      data: {
        settings: JSON.parse(JSON.stringify(settingsData)),
        themePreference,
      },
      select: {
        settings: true,
        themePreference: true,
      },
    });

    res.json({
      settings: user.settings,
      themePreference: user.themePreference,
    });
  } catch (error) {
    next(error);
  }
});

// Get subscription status
userRouter.get('/subscription', requireAuth, async (req, res, next) => {
  try {
    const config = getConfig();

    const user = await db.user.findUnique({
      where: { id: req.user!.id },
      select: {
        plan: true,
        credits: true,
        messagesThisMonth: true,
        stripeCustomerId: true,
      },
    });

    if (!user) {
      res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'User not found' });
      return;
    }

    const planLimits = getPlanLimits(user.plan);
    const plan = config.payments.plans.find((p) => p.id === user.plan);

    res.json({
      plan: user.plan,
      planName: plan?.name || 'Unknown',
      credits: user.credits,
      messagesThisMonth: user.messagesThisMonth,
      monthlyLimit: planLimits.monthlyMessageLimit,
      hasStripeCustomer: !!user.stripeCustomerId,
    });
  } catch (error) {
    next(error);
  }
});

// Get usage info
userRouter.get('/usage', requireAuth, async (req, res, next) => {
  try {
    const user = await db.user.findUnique({
      where: { id: req.user!.id },
      select: {
        plan: true,
        credits: true,
        messagesThisMonth: true,
      },
    });

    if (!user) {
      res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'User not found' });
      return;
    }

    const planLimits = getPlanLimits(user.plan);

    res.json({
      messagesThisMonth: user.messagesThisMonth,
      monthlyLimit: planLimits.monthlyMessageLimit,
      credits: user.credits,
      plan: user.plan,
    });
  } catch (error) {
    next(error);
  }
});
