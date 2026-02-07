import crypto from 'crypto';
import { db } from '@chaaskit/db';
import { getConfig } from '../config/loader.js';

export async function addToWaitlist(params: { email: string; name?: string | null }) {
  const { email, name } = params;

  const existing = await db.waitlistEntry.findUnique({
    where: { email },
  });

  if (existing) {
    if (existing.status === 'removed') {
      return db.waitlistEntry.update({
        where: { id: existing.id },
        data: {
          status: 'pending',
          name: name ?? existing.name,
        },
      });
    }

    return existing;
  }

  return db.waitlistEntry.create({
    data: {
      email,
      name: name ?? undefined,
      status: 'pending',
    },
  });
}

function getInviteExpiryDays(): number {
  const config = getConfig();
  return config.auth.gating?.inviteExpiryDays ?? 7;
}

function generateInviteToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

export async function createInviteTokenForEmail(params: { email: string; createdByUserId?: string | null }) {
  const { email, createdByUserId } = params;
  const expiresAt = new Date(Date.now() + getInviteExpiryDays() * 24 * 60 * 60 * 1000);
  const token = generateInviteToken();

  return db.inviteToken.create({
    data: {
      email,
      token,
      expiresAt,
      createdByUserId: createdByUserId ?? undefined,
    },
  });
}

export async function createInviteForWaitlistEntry(params: { entryId: string; createdByUserId?: string | null }) {
  const entry = await db.waitlistEntry.findUnique({
    where: { id: params.entryId },
  });

  if (!entry) {
    return null;
  }

  const invite = await createInviteTokenForEmail({
    email: entry.email,
    createdByUserId: params.createdByUserId ?? undefined,
  });

  await db.waitlistEntry.update({
    where: { id: entry.id },
    data: {
      status: 'invited',
      invitedAt: new Date(),
      invitedByUserId: params.createdByUserId ?? undefined,
    },
  });

  return invite;
}

export async function validateInviteToken(params: { token: string; email?: string | null }) {
  const { token, email } = params;
  const invite = await db.inviteToken.findUnique({
    where: { token },
  });

  if (!invite) {
    return null;
  }

  if (invite.usedAt) {
    return null;
  }

  if (invite.expiresAt < new Date()) {
    return null;
  }

  if (email && invite.email.toLowerCase() !== email.toLowerCase()) {
    return null;
  }

  return invite;
}

export async function consumeInviteToken(params: { token: string; userId: string }) {
  return db.inviteToken.update({
    where: { token: params.token },
    data: {
      usedAt: new Date(),
      usedByUserId: params.userId,
    },
  });
}

export async function listWaitlist() {
  const [entries, total] = await Promise.all([
    db.waitlistEntry.findMany({
      orderBy: { createdAt: 'desc' },
    }),
    db.waitlistEntry.count(),
  ]);

  return { entries, total };
}

export function evaluateSignupGate(params: { email: string; inviteValid: boolean; capacityReached?: boolean }): {
  allowed: boolean;
  reason?: string;
  waitlistEnabled: boolean;
} {
  const config = getConfig();
  const gating = config.auth.gating;
  const waitlistEnabled = gating?.waitlistEnabled ?? false;

  if (!gating || gating.mode === 'open') {
    return { allowed: true, waitlistEnabled };
  }

  if (params.inviteValid) {
    return { allowed: true, waitlistEnabled };
  }

  const now = new Date();

  switch (gating.mode) {
    case 'invite_only':
      return { allowed: false, reason: 'invite_only', waitlistEnabled };
    case 'closed':
      return { allowed: false, reason: 'closed', waitlistEnabled };
    case 'capacity_limit':
      if (params.capacityReached) {
        return { allowed: false, reason: 'capacity_limit', waitlistEnabled };
      }
      return { allowed: true, waitlistEnabled };
    case 'timed_window': {
      const start = gating.windowStart ? new Date(gating.windowStart) : null;
      const end = gating.windowEnd ? new Date(gating.windowEnd) : null;
      const withinStart = !start || now >= start;
      const withinEnd = !end || now <= end;
      if (withinStart && withinEnd) {
        return { allowed: true, waitlistEnabled };
      }
      return { allowed: false, reason: 'timed_window', waitlistEnabled };
    }
    default:
      return { allowed: false, reason: 'closed', waitlistEnabled };
  }
}
