import { Router } from 'express';
import { z } from 'zod';
import { db } from '@chaaskit/db';
import { HTTP_STATUS } from '@chaaskit/shared';
import type { CreditsBalanceResponse, RedeemPromoCodeRequest, RedeemPromoCodeResponse, GrantCreditsRequest, GrantCreditsResponse } from '@chaaskit/shared';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { getConfig } from '../config/loader.js';
import { getCreditsBalance, grantCredits } from '../services/credits.js';

export const creditsRouter = Router();

const redeemSchema = z.object({
  code: z.string().min(3),
});

const grantSchema = z.object({
  ownerType: z.enum(['user', 'team']),
  ownerId: z.string(),
  amount: z.number().int().positive(),
  reason: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

// Get current user's personal credits balance
creditsRouter.get('/balance', requireAuth, async (req, res, next) => {
  try {
    const config = getConfig();
    if (!config.credits?.enabled) {
      const response: CreditsBalanceResponse = { balance: 0 };
      res.json(response);
      return;
    }
    const balance = await getCreditsBalance('user', req.user!.id);
    const response: CreditsBalanceResponse = {
      balance: balance.balance,
      expiresSoonestAt: balance.expiresSoonestAt ?? undefined,
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

// Redeem promo code
creditsRouter.post('/redeem', requireAuth, async (req, res, next) => {
  try {
    const config = getConfig();
    if (!config.credits?.enabled || !config.credits.promoEnabled) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Promo codes are disabled');
    }

    const { code } = redeemSchema.parse(req.body as RedeemPromoCodeRequest);
    const normalized = code.trim().toUpperCase();

    const promo = await db.promoCode.findUnique({
      where: { code: normalized },
      include: { redemptions: true },
    });

    if (!promo) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Invalid promo code');
    }

    const now = new Date();
    if (promo.startsAt && promo.startsAt > now) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Promo code is not active yet');
    }
    if (promo.endsAt && promo.endsAt < now) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Promo code has expired');
    }

    if (promo.redemptions.length >= promo.maxUses) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Promo code has reached its usage limit');
    }

    const existingRedemption = await db.promoCodeRedemption.findFirst({
      where: {
        promoCodeId: promo.id,
        userId: req.user!.id,
      },
    });

    if (existingRedemption) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'You have already redeemed this promo code');
    }

    await db.promoCodeRedemption.create({
      data: {
        promoCodeId: promo.id,
        userId: req.user!.id,
      },
    });

    const balance = await grantCredits({
      ownerType: 'user',
      ownerId: req.user!.id,
      amount: promo.credits,
      reason: 'promo_code',
      sourceType: 'promo',
      expiresAt: promo.creditsExpiresAt ?? undefined,
      metadata: { promoCodeId: promo.id, code: promo.code },
    });

    const response: RedeemPromoCodeResponse = {
      balance,
      granted: promo.credits,
      expiresAt: promo.creditsExpiresAt ?? undefined,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// Admin grant credits
creditsRouter.post('/grant', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const payload = grantSchema.parse(req.body as GrantCreditsRequest);
    const expiresAt = payload.expiresAt ? new Date(payload.expiresAt) : undefined;

    const balance = await grantCredits({
      ownerType: payload.ownerType,
      ownerId: payload.ownerId,
      amount: payload.amount,
      reason: payload.reason ?? 'admin_grant',
      sourceType: 'admin',
      expiresAt,
      metadata: { grantedBy: req.user!.id },
    });

    const response: GrantCreditsResponse = { balance };
    res.json(response);
  } catch (error) {
    next(error);
  }
});
