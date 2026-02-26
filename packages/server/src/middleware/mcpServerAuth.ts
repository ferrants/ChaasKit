/**
 * MCP Server Authentication Middleware
 *
 * Authenticates requests to the MCP server endpoint using:
 * 1. API keys (Bearer token matching API key format)
 * 2. OAuth tokens (Phase 2 - to be added)
 *
 * Returns 401 with WWW-Authenticate header if not authorized.
 */

import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '@chaaskit/db';
import { HTTP_STATUS } from '@chaaskit/shared';
import { getConfig } from '../config/loader.js';

// Extend Express Request to include MCP context
declare global {
  namespace Express {
    interface Request {
      mcpContext?: {
        userId: string;
        teamId?: string;
        scopes?: string[];
      };
    }
  }
}

/**
 * Build the OAuth authorization server URL for WWW-Authenticate header
 */
function getAuthorizationServerUrl(): string {
  const apiUrl = process.env.API_URL || 'http://localhost:3000';
  return `${apiUrl}/.well-known/oauth-authorization-server`;
}

/**
 * Validate an API key and return user info if valid
 */
async function validateApiKey(
  apiKey: string
): Promise<{ userId: string; teamId?: string } | null> {
  const config = getConfig();
  const keyPrefix = config.api?.keyPrefix || 'sk-';

  // Check if it looks like our API key format
  if (!apiKey.startsWith(keyPrefix)) {
    return null;
  }

  // Find keys by prefix and check hash
  const storedPrefixLength = keyPrefix.length + 6;
  const searchPrefix = apiKey.slice(0, storedPrefixLength);

  const candidates = await db.apiKey.findMany({
    where: { keyPrefix: searchPrefix },
    select: {
      id: true,
      keyHash: true,
      userId: true,
      teamId: true,
      expiresAt: true,
    },
  });

  for (const candidate of candidates) {
    if (await bcrypt.compare(apiKey, candidate.keyHash)) {
      // Check expiration
      if (candidate.expiresAt && candidate.expiresAt < new Date()) {
        return null;
      }

      // If team-scoped, verify user is still a member
      if (candidate.teamId) {
        const membership = await db.teamMember.findFirst({
          where: { userId: candidate.userId, teamId: candidate.teamId },
        });
        if (!membership) {
          return null;
        }
      }

      // Update lastUsedAt (fire and forget)
      db.apiKey
        .update({
          where: { id: candidate.id },
          data: { lastUsedAt: new Date() },
        })
        .catch(() => {});

      return {
        userId: candidate.userId,
        teamId: candidate.teamId || undefined,
      };
    }
  }

  return null;
}

/**
 * Validate an OAuth access token and return user info if valid
 */
async function validateOAuthToken(
  token: string
): Promise<{ userId: string; teamId?: string; scopes?: string[] } | null> {
  // Hash the token to look it up
  const crypto = await import('crypto');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const oauthToken = await db.oAuthToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      revokedAt: true,
      scope: true,
      client: {
        select: {
          isActive: true,
        },
      },
    },
  });

  if (!oauthToken) {
    return null;
  }

  // Check if token is expired
  if (oauthToken.expiresAt < new Date()) {
    return null;
  }

  // Check if token is revoked
  if (oauthToken.revokedAt) {
    return null;
  }

  // Check if client is still active
  if (!oauthToken.client.isActive) {
    return null;
  }

  return {
    userId: oauthToken.userId,
    scopes: oauthToken.scope ? oauthToken.scope.split(' ').filter(Boolean) : undefined,
  };
}

/**
 * MCP Server Authentication Middleware
 *
 * Checks for Bearer token in Authorization header and validates it as either
 * an API key or OAuth access token.
 */
export async function mcpServerAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const config = getConfig();
  const serverConfig = config.mcp?.server;

  // Check if MCP server is enabled
  if (!serverConfig?.enabled) {
    res.status(HTTP_STATUS.NOT_FOUND).json({
      error: 'MCP server is not enabled',
    });
    return;
  }

  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    // No auth provided - return 401 with WWW-Authenticate
    res.status(HTTP_STATUS.UNAUTHORIZED);
    res.setHeader(
      'WWW-Authenticate',
      `Bearer resource_metadata="${getAuthorizationServerUrl()}"`
    );
    res.json({
      error: 'unauthorized',
      error_description: 'Bearer token required',
    });
    return;
  }

  const token = authHeader.slice(7); // Remove "Bearer "

  // Try API key validation first
  const apiKeyResult = await validateApiKey(token);
  if (apiKeyResult) {
    req.mcpContext = apiKeyResult;
    return next();
  }

  // Try OAuth token validation if OAuth is enabled
  if (serverConfig.oauth?.enabled) {
    const oauthResult = await validateOAuthToken(token);
    if (oauthResult) {
      req.mcpContext = oauthResult;
      return next();
    }
  }

  // No valid token found
  res.status(HTTP_STATUS.UNAUTHORIZED);
  res.setHeader(
    'WWW-Authenticate',
    `Bearer resource_metadata="${getAuthorizationServerUrl()}", error="invalid_token"`
  );
  res.json({
    error: 'invalid_token',
    error_description: 'The access token is invalid or expired',
  });
}
