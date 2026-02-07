import { db } from '@chaaskit/db';
import type { Prisma } from '@chaaskit/db';
import { getConfig } from '../config/loader.js';

export type CreditsOwnerType = 'user' | 'team';

const DEFAULT_TOKENS_PER_CREDIT = 1000;

function getTokensPerCredit(): number {
  const config = getConfig();
  return config.credits?.tokensPerCredit ?? DEFAULT_TOKENS_PER_CREDIT;
}

function getDefaultExpiryDays(): number | undefined {
  const config = getConfig();
  if (!config.credits?.expiryEnabled) {
    return undefined;
  }
  return config.credits.defaultExpiryDays ?? undefined;
}

type DbClient = Prisma.TransactionClient | typeof db;

async function setOwnerCreditsCache(
  tx: DbClient,
  ownerType: CreditsOwnerType,
  ownerId: string,
  balance: number
): Promise<void> {
  if (ownerType === 'team') {
    await tx.team.update({
      where: { id: ownerId },
      data: { credits: balance },
    });
    return;
  }

  await tx.user.update({
    where: { id: ownerId },
    data: { credits: balance },
  });
}

async function adjustCreditsBalance(
  tx: DbClient,
  ownerType: CreditsOwnerType,
  ownerId: string,
  delta: number
): Promise<number> {
  const existing = await tx.creditsBalance.findUnique({
    where: { ownerType_ownerId: { ownerType, ownerId } },
  });

  const nextBalance = Math.max(0, (existing?.balance ?? 0) + delta);

  await tx.creditsBalance.upsert({
    where: { ownerType_ownerId: { ownerType, ownerId } },
    update: { balance: nextBalance },
    create: { ownerType, ownerId, balance: nextBalance },
  });

  await setOwnerCreditsCache(tx, ownerType, ownerId, nextBalance);

  return nextBalance;
}

async function expireCreditsIfNeeded(
  tx: DbClient,
  ownerType: CreditsOwnerType,
  ownerId: string
): Promise<void> {
  const now = new Date();
  const expiredGrants = await tx.creditsGrant.findMany({
    where: {
      ownerType,
      ownerId,
      remaining: { gt: 0 },
      expiresAt: { lt: now },
    },
  });

  if (expiredGrants.length === 0) {
    return;
  }

  let totalExpired = 0;
  for (const grant of expiredGrants) {
    totalExpired += grant.remaining;
  }

  await tx.creditsGrant.updateMany({
    where: { id: { in: expiredGrants.map((g) => g.id) } },
    data: { remaining: 0 },
  });

  for (const grant of expiredGrants) {
    await tx.creditsLedger.create({
      data: {
        ownerType,
        ownerId,
        delta: -grant.remaining,
        reason: 'expired',
        sourceType: 'expiry',
        expiresAt: grant.expiresAt ?? undefined,
        metadata: {
          grantId: grant.id,
          expiredAt: now.toISOString(),
        },
      },
    });
  }

  await adjustCreditsBalance(tx, ownerType, ownerId, -totalExpired);
}

export async function getCreditsBalance(ownerType: CreditsOwnerType, ownerId: string): Promise<{ balance: number; expiresSoonestAt?: Date | null }> {
  const [balance, soonestExpiry] = await db.$transaction(async (tx) => {
    await expireCreditsIfNeeded(tx, ownerType, ownerId);

    const current = await tx.creditsBalance.findUnique({
      where: { ownerType_ownerId: { ownerType, ownerId } },
    });

    const nextExpiry = await tx.creditsGrant.findFirst({
      where: {
        ownerType,
        ownerId,
        remaining: { gt: 0 },
        expiresAt: { not: null },
      },
      orderBy: { expiresAt: 'asc' },
      select: { expiresAt: true },
    });

    return [current?.balance ?? 0, nextExpiry?.expiresAt ?? null] as const;
  });

  return {
    balance,
    expiresSoonestAt: soonestExpiry,
  };
}

export async function grantCredits(params: {
  ownerType: CreditsOwnerType;
  ownerId: string;
  amount: number;
  reason?: string;
  sourceType: string;
  expiresAt?: Date | null;
  metadata?: Record<string, unknown>;
  tx?: DbClient;
}): Promise<number> {
  const { ownerType, ownerId, amount, reason, sourceType, metadata } = params;
  const expiresAt = params.expiresAt ?? undefined;

  if (amount <= 0) {
    return getCreditsBalance(ownerType, ownerId).then((b) => b.balance);
  }

  const defaultExpiryDays = getDefaultExpiryDays();
  const resolvedExpiresAt = expiresAt ?? (defaultExpiryDays ? new Date(Date.now() + defaultExpiryDays * 24 * 60 * 60 * 1000) : undefined);

  const run = async (tx: DbClient) => {
    const ledger = await tx.creditsLedger.create({
      data: {
        ownerType,
        ownerId,
        delta: amount,
        reason,
        sourceType,
        expiresAt: resolvedExpiresAt,
        metadata,
      },
    });

    await tx.creditsGrant.create({
      data: {
        ownerType,
        ownerId,
        total: amount,
        remaining: amount,
        expiresAt: resolvedExpiresAt,
        ledgerId: ledger.id,
      },
    });

    return adjustCreditsBalance(tx, ownerType, ownerId, amount);
  };

  const balance = params.tx ? await run(params.tx) : await db.$transaction(run);

  return balance;
}

export async function consumeCredits(params: {
  ownerType: CreditsOwnerType;
  ownerId: string;
  amount: number;
  reason?: string;
  sourceType: string;
  metadata?: Record<string, unknown>;
}): Promise<{ consumed: number; shortfall: number; balance: number }> {
  const { ownerType, ownerId, amount, reason, sourceType, metadata } = params;

  if (amount <= 0) {
    const current = await getCreditsBalance(ownerType, ownerId);
    return { consumed: 0, shortfall: 0, balance: current.balance };
  }

  const result = await db.$transaction(async (tx) => {
    await expireCreditsIfNeeded(tx, ownerType, ownerId);

    const expiring = await tx.creditsGrant.findMany({
      where: {
        ownerType,
        ownerId,
        remaining: { gt: 0 },
        expiresAt: { not: null },
      },
      orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }],
    });

    const nonExpiring = await tx.creditsGrant.findMany({
      where: {
        ownerType,
        ownerId,
        remaining: { gt: 0 },
        expiresAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });

    const grants = [...expiring, ...nonExpiring];

    let remainingToConsume = amount;
    let consumed = 0;

    for (const grant of grants) {
      if (remainingToConsume <= 0) {
        break;
      }
      const useAmount = Math.min(grant.remaining, remainingToConsume);
      if (useAmount <= 0) {
        continue;
      }

      await tx.creditsGrant.update({
        where: { id: grant.id },
        data: { remaining: grant.remaining - useAmount },
      });

      remainingToConsume -= useAmount;
      consumed += useAmount;
    }

    if (consumed > 0) {
      await tx.creditsLedger.create({
        data: {
          ownerType,
          ownerId,
          delta: -consumed,
          reason,
          sourceType,
          metadata,
        },
      });
    }

    const balance = await adjustCreditsBalance(tx, ownerType, ownerId, -consumed);

    return { consumed, shortfall: remainingToConsume, balance };
  });

  return result;
}

export function calculateCreditsCost(totalTokens: number): number {
  const tokensPerCredit = getTokensPerCredit();
  if (totalTokens <= 0) {
    return 1;
  }
  return Math.max(1, Math.ceil(totalTokens / tokensPerCredit));
}
