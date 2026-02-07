import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '@chaaskit/db';
import { HTTP_STATUS } from '@chaaskit/shared';
import { getConfig } from '../config/loader.js';

/**
 * Check if a path matches a pattern.
 * Supports:
 * - Exact match: "/api/threads"
 * - Single segment wildcard: "/api/threads/*" matches "/api/threads/123" but not "/api/threads/123/messages"
 * - Multi-segment wildcard: "/api/threads/**" matches "/api/threads/123" and "/api/threads/123/messages"
 */
function matchesPattern(path: string, pattern: string): boolean {
  // Exact match
  if (pattern === path) {
    return true;
  }

  // Handle ** (matches any depth)
  if (pattern.endsWith('/**')) {
    const prefix = pattern.slice(0, -3);
    return path === prefix || path.startsWith(prefix + '/');
  }

  // Handle * (matches single segment)
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -2);
    if (!path.startsWith(prefix + '/')) {
      return false;
    }
    const remainder = path.slice(prefix.length + 1);
    // Should not contain another slash (single segment only)
    return !remainder.includes('/');
  }

  return false;
}

/**
 * Check if the request path is allowed for API key access.
 */
function isEndpointAllowed(path: string, allowedEndpoints: string[]): boolean {
  for (const pattern of allowedEndpoints) {
    if (matchesPattern(path, pattern)) {
      return true;
    }
  }
  return false;
}

/**
 * Middleware to authenticate requests using API keys.
 * Should be used before requireAuth in the middleware chain.
 *
 * API key access is restricted to endpoints listed in config.api.allowedEndpoints.
 * If no endpoints are configured, API keys cannot be used for any endpoint.
 */
export async function apiKeyAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const config = getConfig();
    const keyPrefix = config.api?.keyPrefix || 'sk-';

    // Check if this looks like an API key
    const isApiKeyAuth = authHeader?.startsWith(`Bearer ${keyPrefix}`);

    if (!isApiKeyAuth) {
      return next();  // Not an API key, let other auth handle it
    }

    // It's an API key - check if this endpoint is allowed
    const allowedEndpoints = config.api?.allowedEndpoints || [];

    if (allowedEndpoints.length === 0) {
      res.status(HTTP_STATUS.FORBIDDEN).json({
        error: 'API key access is not enabled for any endpoints'
      });
      return;
    }

    const fullPath = `${req.baseUrl || ''}${req.path || ''}` || req.path;

    if (!isEndpointAllowed(fullPath, allowedEndpoints)) {
      res.status(HTTP_STATUS.FORBIDDEN).json({
        error: 'API key access is not allowed for this endpoint'
      });
      return;
    }

    const apiKey = authHeader!.slice(7);  // Remove "Bearer "

    // Find keys by prefix and check hash
    // The stored keyPrefix is: configuredPrefix + 6 random chars
    const storedPrefixLength = keyPrefix.length + 6;
    const searchPrefix = apiKey.slice(0, storedPrefixLength);
    const candidates = await db.apiKey.findMany({
      where: { keyPrefix: searchPrefix },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            isAdmin: true,
            emailVerified: true,
            plan: true,
            credits: true,
            messagesThisMonth: true,
            themePreference: true,
          },
        },
        team: true,
      },
    });

    for (const candidate of candidates) {
      if (await bcrypt.compare(apiKey, candidate.keyHash)) {
        // Check expiration
        if (candidate.expiresAt && candidate.expiresAt < new Date()) {
          res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: 'API key expired' });
          return;
        }

        // If team-scoped, verify user is still a member
        if (candidate.teamId) {
          const membership = await db.teamMember.findFirst({
            where: { userId: candidate.userId, teamId: candidate.teamId },
          });
          if (!membership) {
            res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: 'API key invalid - no longer a team member' });
            return;
          }
        }

        // Update lastUsedAt (fire and forget)
        db.apiKey.update({
          where: { id: candidate.id },
          data: { lastUsedAt: new Date() },
        }).catch(() => {});

        req.user = candidate.user;
        // Set team context for team-scoped keys
        req.apiKeyTeamId = candidate.teamId || undefined;
        return next();
      }
    }

    // No valid key found
    res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: 'Invalid API key' });
  } catch (error) {
    next(error);
  }
}
