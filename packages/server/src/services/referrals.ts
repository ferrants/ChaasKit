import crypto from 'crypto';
import { db } from '@chaaskit/db';
import { getConfig } from '../config/loader.js';
import { grantCredits } from './credits.js';

export type ReferralEvent = 'signup' | 'first_message' | 'paying';

async function generateReferralCode(): Promise<string> {
  return crypto.randomBytes(6).toString('hex');
}

export async function ensureReferralCodeForUser(userId: string): Promise<string> {
  const existing = await db.referralCode.findFirst({
    where: { userId },
    select: { code: true },
  });

  if (existing) {
    return existing.code;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = await generateReferralCode();
    try {
      const created = await db.referralCode.create({
        data: {
          code,
          userId,
        },
      });
      return created.code;
    } catch (error) {
      if (attempt === 4) {
        throw error;
      }
    }
  }

  throw new Error('Failed to generate referral code');
}

export async function createReferralFromCode(params: {
  referredUserId: string;
  referralCode?: string | null;
}): Promise<{ referralId: string; referrerUserId: string } | null> {
  const { referredUserId, referralCode } = params;
  if (!referralCode) {
    return null;
  }

  const normalized = referralCode.trim().toLowerCase();
  const code = await db.referralCode.findUnique({
    where: { code: normalized },
  });

  if (!code) {
    return null;
  }

  if (code.userId === referredUserId) {
    return null;
  }

  const existing = await db.referral.findFirst({
    where: {
      referrerUserId: code.userId,
      referredUserId,
    },
  });

  if (existing) {
    return { referralId: existing.id, referrerUserId: existing.referrerUserId };
  }

  const referral = await db.referral.create({
    data: {
      referrerUserId: code.userId,
      referredUserId,
    },
  });

  return { referralId: referral.id, referrerUserId: referral.referrerUserId };
}

export async function grantReferralCreditsIfEligible(params: {
  referralId: string;
  event: ReferralEvent;
}): Promise<boolean> {
  const { referralId, event } = params;
  const config = getConfig();

  if (!config.credits?.enabled) {
    return false;
  }

  const triggers = config.credits.referralTriggers;
  if (!triggers) {
    return false;
  }

  if (event === 'signup' && !triggers.signup) {
    return false;
  }
  if (event === 'first_message' && !triggers.firstMessage) {
    return false;
  }
  if (event === 'paying' && !triggers.paying) {
    return false;
  }

  const referral = await db.referral.findUnique({
    where: { id: referralId },
  });

  if (!referral) {
    return false;
  }

  const existingGrant = await db.referralGrant.findFirst({
    where: {
      referralId,
      event,
    },
  });

  if (existingGrant) {
    return false;
  }

  const reward = config.credits.referralRewardCredits ?? 0;
  if (reward <= 0) {
    return false;
  }

  await db.$transaction(async (tx) => {
    await tx.referralGrant.create({
      data: {
        referralId,
        event,
      },
    });

    await grantCredits({
      ownerType: 'user',
      ownerId: referral.referrerUserId,
      amount: reward,
      reason: `referral_${event}`,
      sourceType: 'referral',
      metadata: {
        referralId,
        event,
      },
      tx,
    });
  });

  return true;
}

export async function getReferralForUser(referredUserId: string): Promise<{ id: string } | null> {
  return db.referral.findFirst({
    where: { referredUserId },
    select: { id: true },
  });
}
