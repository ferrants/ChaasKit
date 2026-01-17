import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '@chaaskit/db';
import type { TokenPayload, UserSession } from '@chaaskit/shared';
import { AppError } from './errorHandler.js';
import { HTTP_STATUS } from '@chaaskit/shared';
import { getConfig } from '../config/loader.js';

declare global {
  namespace Express {
    interface Request {
      user?: UserSession;
      apiKeyTeamId?: string;  // Set when authenticating with a team-scoped API key
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export function generateToken(userId: string, email: string): string {
  return jwt.sign(
    { userId, email } as Omit<TokenPayload, 'iat' | 'exp'>,
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // If user is already authenticated (e.g., by apiKeyAuth middleware), skip JWT validation
    if (req.user) {
      next();
      return;
    }

    const config = getConfig();

    // Check for token in Authorization header or cookie
    const authHeader = req.headers.authorization;
    const cookieToken = req.cookies?.token;

    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : cookieToken;

    if (!token) {
      // Allow unauthenticated access if configured
      if (config.auth.allowUnauthenticated) {
        next();
        return;
      }
      throw new AppError(HTTP_STATUS.UNAUTHORIZED, 'Authentication required');
    }

    const payload = verifyToken(token);

    const user = await db.user.findUnique({
      where: { id: payload.userId },
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
    });

    if (!user) {
      throw new AppError(HTTP_STATUS.UNAUTHORIZED, 'User not found');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    next(new AppError(HTTP_STATUS.UNAUTHORIZED, 'Invalid token'));
  }
}

export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // If user is already authenticated (e.g., by apiKeyAuth middleware), skip JWT validation
    if (req.user) {
      next();
      return;
    }

    const authHeader = req.headers.authorization;
    const cookieToken = req.cookies?.token;

    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : cookieToken;

    if (!token) {
      next();
      return;
    }

    const payload = verifyToken(token);

    const user = await db.user.findUnique({
      where: { id: payload.userId },
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
    });

    if (user) {
      req.user = user;
    }

    next();
  } catch {
    // Invalid token, continue without auth
    next();
  }
}

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    next(new AppError(HTTP_STATUS.UNAUTHORIZED, 'Authentication required'));
    return;
  }

  const config = getConfig();
  const adminEmails = config.admin?.emails || [];

  // Check if user's email is in the admin list
  const isConfigAdmin = adminEmails.some(
    (email) => email.toLowerCase() === req.user!.email.toLowerCase()
  );

  // Also check the database isAdmin flag for backward compatibility
  if (!isConfigAdmin && !req.user.isAdmin) {
    next(new AppError(HTTP_STATUS.FORBIDDEN, 'Admin access required'));
    return;
  }

  next();
}

import { isEmailEnabled } from '../services/email/index.js';

/**
 * Check if email verification is required for the current user.
 * Returns true if user needs verification, false otherwise.
 */
function shouldBlockUnverifiedUser(req: Request): boolean {
  const config = getConfig();

  // No user = nothing to verify
  if (!req.user) {
    return false;
  }

  // Feature not enabled
  if (!config.auth.emailVerification?.enabled) {
    return false;
  }

  // Email provider not configured (graceful degradation)
  if (!isEmailEnabled()) {
    return false;
  }

  // User is already verified
  if (req.user.emailVerified) {
    return false;
  }

  // User needs verification
  return true;
}

/**
 * Middleware that requires the user to have a verified email.
 * Skips the check if email verification is not enabled or email provider is not configured.
 * Use after requireAuth middleware.
 */
export async function requireVerifiedEmail(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    next(new AppError(HTTP_STATUS.UNAUTHORIZED, 'Authentication required'));
    return;
  }

  if (shouldBlockUnverifiedUser(req)) {
    res.status(HTTP_STATUS.FORBIDDEN).json({
      error: 'Email not verified',
      code: 'EMAIL_NOT_VERIFIED',
      message: 'Please verify your email address to continue',
    });
    return;
  }

  next();
}

/**
 * Middleware that checks email verification for optional auth routes.
 * If user is authenticated but not verified, blocks the request.
 * If user is not authenticated, allows the request (for allowUnauthenticated mode).
 * Use after optionalAuth middleware.
 */
export async function optionalVerifiedEmail(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // If no user, allow (unauthenticated access may be allowed)
  if (!req.user) {
    next();
    return;
  }

  // If user exists but needs verification, block
  if (shouldBlockUnverifiedUser(req)) {
    res.status(HTTP_STATUS.FORBIDDEN).json({
      error: 'Email not verified',
      code: 'EMAIL_NOT_VERIFIED',
      message: 'Please verify your email address to continue',
    });
    return;
  }

  next();
}
