import { Router } from 'express';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { db } from '@chaaskit/db';
import { HTTP_STATUS } from '@chaaskit/shared';
import { requireAuth } from '../middleware/auth.js';
import { getConfig } from '../config/loader.js';

export const apiKeysRouter = Router();

// Check if user can access API keys feature
function canAccessApiKeys(user: { plan: string }): boolean {
  const config = getConfig();
  if (!config.api?.enabled) return false;
  if (!config.api.allowedPlans) return true;
  return config.api.allowedPlans.includes(user.plan);
}

// List user's API keys (masked)
apiKeysRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    if (!canAccessApiKeys(req.user!)) {
      res.status(HTTP_STATUS.FORBIDDEN).json({ error: 'API access not available for your plan' });
      return;
    }

    const keys = await db.apiKey.findMany({
      where: { userId: req.user!.id },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        teamId: true,
        team: { select: { id: true, name: true } },
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ keys });
  } catch (error) {
    next(error);
  }
});

// Create new API key
apiKeysRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    if (!canAccessApiKeys(req.user!)) {
      res.status(HTTP_STATUS.FORBIDDEN).json({ error: 'API access not available for your plan' });
      return;
    }

    const { name, expiresAt, teamId } = req.body;

    // If teamId provided, verify user is a member of that team
    if (teamId) {
      const membership = await db.teamMember.findFirst({
        where: { userId: req.user!.id, teamId },
      });
      if (!membership) {
        res.status(HTTP_STATUS.FORBIDDEN).json({ error: 'You are not a member of this team' });
        return;
      }
    }

    // Generate key: <prefix><48 random chars>
    const config = getConfig();
    const prefix = config.api?.keyPrefix || 'sk-';
    const rawKey = `${prefix}${randomBytes(24).toString('hex')}`;
    // Store enough chars to identify the key (prefix + first few random chars)
    const keyPrefix = rawKey.slice(0, prefix.length + 6);
    const keyHash = await bcrypt.hash(rawKey, 10);

    const apiKey = await db.apiKey.create({
      data: {
        userId: req.user!.id,
        teamId: teamId || null,
        name: name || 'Untitled Key',
        keyPrefix,
        keyHash,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      include: { team: { select: { id: true, name: true } } },
    });

    // Return full key ONLY on creation (never again)
    res.json({
      key: {
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix,
        teamId: apiKey.teamId,
        teamName: apiKey.team?.name,
        createdAt: apiKey.createdAt,
        expiresAt: apiKey.expiresAt,
      },
      secret: rawKey,  // Show once, user must copy
    });
  } catch (error) {
    next(error);
  }
});

// Delete API key
apiKeysRouter.delete('/:keyId', requireAuth, async (req, res, next) => {
  try {
    const { keyId } = req.params;

    const key = await db.apiKey.findFirst({
      where: { id: keyId, userId: req.user!.id },
    });

    if (!key) {
      res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'API key not found' });
      return;
    }

    await db.apiKey.delete({ where: { id: keyId } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Check if user can access API keys (for UI)
apiKeysRouter.get('/access', requireAuth, async (req, res) => {
  const canAccess = canAccessApiKeys(req.user!);
  res.json({ canAccess });
});
