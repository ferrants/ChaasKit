import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@chaaskit/db';
import { HTTP_STATUS } from '@chaaskit/shared';
import { AppError } from '../middleware/errorHandler.js';
import { generateToken, requireAuth } from '../middleware/auth.js';
import { getConfig } from '../config/loader.js';
import { z } from 'zod';
import {
  isEmailEnabled,
  sendEmail,
  generateVerificationEmailHtml,
  generateVerificationEmailText,
  generateMagicLinkEmailHtml,
  generateMagicLinkEmailText,
} from '../services/email/index.js';
import {
  addToWaitlist,
  validateInviteToken,
  consumeInviteToken,
  evaluateSignupGate,
} from '../services/waitlist.js';
import {
  createReferralFromCode,
  ensureReferralCodeForUser,
  grantReferralCreditsIfEligible,
} from '../services/referrals.js';

export const authRouter = Router();

// Helper function to generate a 6-digit numeric verification code
function generateVerificationCode(length: number = 6): string {
  const digits = '0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += digits[crypto.randomInt(0, digits.length)];
  }
  return code;
}

// Helper function to check if email verification is required
function isEmailVerificationRequired(): boolean {
  const config = getConfig();
  return config.auth.emailVerification?.enabled === true && isEmailEnabled();
}

// Helper function to create and send verification code
async function createAndSendVerificationCode(
  userId: string,
  email: string
): Promise<void> {
  const config = getConfig();
  const codeLength = config.auth.emailVerification?.codeLength ?? 6;
  const expiresInMinutes = config.auth.emailVerification?.expiresInMinutes ?? 15;

  // Generate plain code
  const code = generateVerificationCode(codeLength);

  // Hash the code for storage
  const codeHash = await bcrypt.hash(code, 10);

  // Calculate expiration
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  // Invalidate existing codes for this user
  await db.emailVerification.updateMany({
    where: {
      userId,
      usedAt: null,
    },
    data: {
      usedAt: new Date(), // Mark as used to invalidate
    },
  });

  // Create new verification record
  await db.emailVerification.create({
    data: {
      code: codeHash,
      userId,
      expiresAt,
    },
  });

  // Send verification email
  const html = generateVerificationEmailHtml(code, config);
  const text = generateVerificationEmailText(code, config);

  const result = await sendEmail({
    to: email,
    subject: `Your ${config.app.name} verification code: ${code}`,
    html,
    text,
  });

  if (result) {
    console.log(`[Auth] Verification email sent to ${email} (messageId: ${result.messageId})`);
  } else {
    // Email disabled - log the code for development
    console.log(`[Auth] Email disabled - verification code for ${email}: ${code}`);
  }
}

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
  inviteToken: z.string().optional(),
  referralCode: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const magicLinkSchema = z.object({
  email: z.string().email(),
  inviteToken: z.string().optional(),
});

const waitlistSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

// Register with email/password
authRouter.post('/register', async (req, res, next) => {
  try {
    const config = getConfig();

    if (!config.auth.methods.includes('email-password')) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Email/password registration is not enabled');
    }

    const { email, password, name, inviteToken, referralCode } = registerSchema.parse(req.body);

    const invite = inviteToken
      ? await validateInviteToken({ token: inviteToken, email })
      : null;

    const gating = config.auth.gating;
    const capacityReached = gating?.mode === 'capacity_limit' && gating.capacityLimit
      ? (await db.user.count()) >= gating.capacityLimit
      : false;

    const gate = evaluateSignupGate({ email, inviteValid: !!invite, capacityReached });
    if (!gate.allowed) {
      res.status(HTTP_STATUS.FORBIDDEN).json({
        error: 'Signups are currently restricted',
        code: gate.reason,
        waitlistEnabled: gate.waitlistEnabled,
      });
      return;
    }

    // Check if user exists
    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new AppError(HTTP_STATUS.CONFLICT, 'Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Determine if email verification is required
    const requiresVerification = isEmailVerificationRequired();

    // Create user - auto-verify if email verification is not configured
    const user = await db.user.create({
      data: {
        email,
        passwordHash,
        name,
        emailVerified: !requiresVerification,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        emailVerified: true,
        plan: true,
      },
    });

    const token = generateToken(user.id, user.email);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Send verification email if required
    if (requiresVerification) {
      await createAndSendVerificationCode(user.id, user.email);
    }

    if (invite) {
      await consumeInviteToken({ token: invite.token, userId: user.id });
    }

    const referral = await createReferralFromCode({
      referredUserId: user.id,
      referralCode,
    });

    if (referral) {
      await grantReferralCreditsIfEligible({ referralId: referral.referralId, event: 'signup' });
    }

    await ensureReferralCodeForUser(user.id);

    res.status(HTTP_STATUS.CREATED).json({
      user,
      token,
      requiresVerification,
    });
  } catch (error) {
    next(error);
  }
});

// Login with email/password
authRouter.post('/login', async (req, res, next) => {
  try {
    const config = getConfig();

    if (!config.auth.methods.includes('email-password')) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Email/password login is not enabled');
    }

    const { email, password } = loginSchema.parse(req.body);

    const user = await db.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      throw new AppError(HTTP_STATUS.UNAUTHORIZED, 'Invalid credentials');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      throw new AppError(HTTP_STATUS.UNAUTHORIZED, 'Invalid credentials');
    }

    const token = generateToken(user.id, user.email);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Check if user needs to verify email
    const requiresVerification = isEmailVerificationRequired() && !user.emailVerified;

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        emailVerified: user.emailVerified,
        plan: user.plan,
      },
      token,
      requiresVerification,
    });
  } catch (error) {
    next(error);
  }
});

// Send magic link
authRouter.post('/magic-link', async (req, res, next) => {
  try {
    const config = getConfig();

    if (!config.auth.magicLink.enabled) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Magic link is not enabled');
    }

    const { email, inviteToken } = magicLinkSchema.parse(req.body);

    // Find or create user
    let user = await db.user.findUnique({ where: { email } });

    if (!user) {
      const invite = inviteToken
        ? await validateInviteToken({ token: inviteToken, email })
        : null;

      const gating = config.auth.gating;
      const capacityReached = gating?.mode === 'capacity_limit' && gating.capacityLimit
        ? (await db.user.count()) >= gating.capacityLimit
        : false;

      const gate = evaluateSignupGate({ email, inviteValid: !!invite, capacityReached });
      if (!gate.allowed) {
        res.status(HTTP_STATUS.FORBIDDEN).json({
          error: 'Signups are currently restricted',
          code: gate.reason,
          waitlistEnabled: gate.waitlistEnabled,
        });
        return;
      }

      user = await db.user.create({
        data: { email },
      });

      if (invite) {
        await consumeInviteToken({ token: invite.token, userId: user.id });
      }

      await ensureReferralCodeForUser(user.id);
    }

    // Create magic link token
    const token = uuidv4();
    const expiresAt = new Date(
      Date.now() + config.auth.magicLink.expiresInMinutes * 60 * 1000
    );

    await db.magicLink.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      },
    });

    const baseUrl = process.env.API_URL || config.app.url;
    const magicLinkUrl = `${baseUrl}/api/auth/magic-link/verify?token=${token}`;

    const html = generateMagicLinkEmailHtml(magicLinkUrl, config);
    const text = generateMagicLinkEmailText(magicLinkUrl, config);

    const result = await sendEmail({
      to: email,
      subject: `Your ${config.app.name} magic link`,
      html,
      text,
    });

    if (result) {
      console.log(`[Auth] Magic link email sent to ${email} (messageId: ${result.messageId})`);
    } else {
      // Email disabled - log the link for development
      console.log(`[Auth] Email disabled - magic link for ${email}: ${magicLinkUrl}`);
    }

    res.json({ message: 'Magic link sent' });
  } catch (error) {
    next(error);
  }
});

// Verify magic link
authRouter.get('/magic-link/verify', async (req, res, next) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Token is required');
    }

    const magicLink = await db.magicLink.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!magicLink || magicLink.usedAt || magicLink.expiresAt < new Date()) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Invalid or expired token');
    }

    // Mark as used
    await db.magicLink.update({
      where: { id: magicLink.id },
      data: { usedAt: new Date() },
    });

    // Update user as verified
    await db.user.update({
      where: { id: magicLink.userId },
      data: { emailVerified: true },
    });

    const authToken = generateToken(magicLink.user.id, magicLink.user.email);

    res.cookie('token', authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      user: {
        id: magicLink.user.id,
        email: magicLink.user.email,
        name: magicLink.user.name,
        avatarUrl: magicLink.user.avatarUrl,
        plan: magicLink.user.plan,
      },
      token: authToken,
    });
  } catch (error) {
    next(error);
  }
});

// Logout
authRouter.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

// Join waitlist
authRouter.post('/waitlist', async (req, res, next) => {
  try {
    const { email, name } = waitlistSchema.parse(req.body);
    const config = getConfig();

    if (!config.auth.gating?.waitlistEnabled) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Waitlist is not enabled');
    }

    const entry = await addToWaitlist({ email, name });
    res.status(HTTP_STATUS.CREATED).json({ entry });
  } catch (error) {
    next(error);
  }
});

// Get current user
authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// OAuth routes (Google, GitHub)
authRouter.get('/oauth/:provider', (req, res, next) => {
  const { provider } = req.params;
  const config = getConfig();

  if (!config.auth.methods.includes(provider as 'google' | 'github')) {
    return next(new AppError(HTTP_STATUS.BAD_REQUEST, `OAuth provider ${provider} is not enabled`));
  }

  // Redirect to OAuth provider
  // In a full implementation, this would use passport.js
  res.redirect(`/api/auth/${provider}/redirect`);
});

authRouter.get('/callback/:provider', async (req, res, next) => {
  // Handle OAuth callback
  // In a full implementation, this would use passport.js
  try {
    const { provider } = req.params;

    // Placeholder for OAuth callback handling
    res.redirect(`${process.env.APP_URL}?auth=success`);
  } catch (error) {
    next(error);
  }
});

// Verify email with 6-digit code
const verifyEmailSchema = z.object({
  code: z.string().min(4).max(8),
});

authRouter.post('/verify-email', requireAuth, async (req, res, next) => {
  try {
    const { code } = verifyEmailSchema.parse(req.body);
    const userId = req.user!.id;

    // Check if user is already verified
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { emailVerified: true, email: true },
    });

    if (user?.emailVerified) {
      res.json({ message: 'Email already verified', verified: true });
      return;
    }

    // Find the most recent unused verification code for this user
    const verification = await db.emailVerification.findFirst({
      where: {
        userId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!verification) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'No valid verification code found. Please request a new code.');
    }

    // Check if too many attempts
    const MAX_ATTEMPTS = 5;
    if (verification.attempts >= MAX_ATTEMPTS) {
      throw new AppError(HTTP_STATUS.TOO_MANY_REQUESTS, 'Too many attempts. Please request a new code.');
    }

    // Increment attempt counter
    await db.emailVerification.update({
      where: { id: verification.id },
      data: { attempts: { increment: 1 } },
    });

    // Verify the code
    const isValid = await bcrypt.compare(code, verification.code);

    if (!isValid) {
      const remainingAttempts = MAX_ATTEMPTS - verification.attempts - 1;
      throw new AppError(
        HTTP_STATUS.BAD_REQUEST,
        `Invalid verification code. ${remainingAttempts} attempts remaining.`
      );
    }

    // Mark code as used and verify user's email
    await db.$transaction([
      db.emailVerification.update({
        where: { id: verification.id },
        data: { usedAt: new Date() },
      }),
      db.user.update({
        where: { id: userId },
        data: { emailVerified: true },
      }),
    ]);

    console.log(`[Auth] Email verified for user ${userId}`);

    res.json({ message: 'Email verified successfully', verified: true });
  } catch (error) {
    next(error);
  }
});

// Resend verification email
authRouter.post('/resend-verification', requireAuth, async (req, res, next) => {
  try {
    const config = getConfig();
    const userId = req.user!.id;

    // Check if user is already verified
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { emailVerified: true, email: true },
    });

    if (user?.emailVerified) {
      res.json({ message: 'Email already verified' });
      return;
    }

    // Check rate limiting - find the most recent verification code
    const recentCode = await db.emailVerification.findFirst({
      where: {
        userId,
        usedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recentCode) {
      const cooldownSeconds = config.auth.emailVerification?.allowResendAfterSeconds ?? 60;
      const cooldownTime = new Date(recentCode.createdAt.getTime() + cooldownSeconds * 1000);

      if (new Date() < cooldownTime) {
        const remainingSeconds = Math.ceil((cooldownTime.getTime() - Date.now()) / 1000);
        throw new AppError(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          `Please wait ${remainingSeconds} seconds before requesting a new code`
        );
      }
    }

    // Create and send new verification code
    await createAndSendVerificationCode(userId, user!.email);

    res.json({ message: 'Verification code sent' });
  } catch (error) {
    next(error);
  }
});
