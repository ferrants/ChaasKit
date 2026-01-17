import crypto from 'crypto';
import { getConfig } from '../../config/loader.js';

/**
 * Verify Slack request signature using HMAC-SHA256.
 * See: https://api.slack.com/authentication/verifying-requests-from-slack
 */
export function verifySlackSignature(
  signature: string | undefined,
  timestamp: string | undefined,
  rawBody: string
): boolean {
  if (!signature || !timestamp) {
    return false;
  }

  const config = getConfig();
  const signingSecretEnvVar = config.slack?.signingSecretEnvVar || 'SLACK_SIGNING_SECRET';
  const signingSecret = process.env[signingSecretEnvVar];

  if (!signingSecret) {
    console.error('[Slack] Missing signing secret:', signingSecretEnvVar);
    return false;
  }

  // Verify timestamp to prevent replay attacks (allow 5 minutes)
  const requestTimestamp = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - requestTimestamp) > 300) {
    console.warn('[Slack] Request timestamp too old:', requestTimestamp);
    return false;
  }

  // Construct the base string
  const baseString = `v0:${timestamp}:${rawBody}`;

  // Compute HMAC-SHA256
  const hmac = crypto.createHmac('sha256', signingSecret);
  hmac.update(baseString);
  const expectedSignature = `v0=${hmac.digest('hex')}`;

  // Timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    // Buffers have different lengths
    return false;
  }
}

/**
 * Verify internal secret for self-calling endpoints.
 */
export function verifyInternalSecret(headerValue: string | undefined): boolean {
  const config = getConfig();
  const internalSecretEnvVar = config.slack?.internalSecretEnvVar || 'SLACK_INTERNAL_SECRET';
  const internalSecret = process.env[internalSecretEnvVar];

  if (!internalSecret) {
    console.error('[Slack] Missing internal secret:', internalSecretEnvVar);
    return false;
  }

  if (!headerValue) {
    return false;
  }

  // Timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(headerValue),
      Buffer.from(internalSecret)
    );
  } catch {
    return false;
  }
}

/**
 * Get the internal secret for self-calling endpoints.
 */
export function getInternalSecret(): string {
  const config = getConfig();
  const internalSecretEnvVar = config.slack?.internalSecretEnvVar || 'SLACK_INTERNAL_SECRET';
  const internalSecret = process.env[internalSecretEnvVar];

  if (!internalSecret) {
    throw new Error(`Missing required environment variable: ${internalSecretEnvVar}`);
  }

  return internalSecret;
}
