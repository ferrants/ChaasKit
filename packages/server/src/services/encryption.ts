import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getEncryptionKey(): Buffer {
  const keySource = process.env.MCP_CREDENTIAL_KEY || process.env.SESSION_SECRET;

  if (!keySource || keySource.length < 32) {
    throw new Error(
      'MCP_CREDENTIAL_KEY or SESSION_SECRET must be set and at least 32 characters'
    );
  }

  // Derive a 32-byte key from the source using SHA-256
  return crypto.createHash('sha256').update(keySource).digest();
}

export interface EncryptedCredential {
  iv: string;
  authTag: string;
  ciphertext: string;
}

export function encryptCredential(data: Record<string, unknown>): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const plaintext = JSON.stringify(data);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext (all base64)
  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

export function decryptCredential<T = Record<string, unknown>>(
  encryptedString: string
): T {
  const key = getEncryptionKey();
  const parts = encryptedString.split(':');

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted credential format');
  }

  const [ivBase64, authTagBase64, ciphertextBase64] = parts;
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');
  const ciphertext = Buffer.from(ciphertextBase64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString('utf8')) as T;
}

// Types for stored credential data
export interface ApiKeyCredentialData {
  apiKey: string;
}

export interface OAuthCredentialData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number; // Unix timestamp
  tokenType?: string;
}

// Helper to check if OAuth token is expired (with 5 min buffer)
export function isTokenExpired(expiresAt?: number): boolean {
  if (!expiresAt) return false;
  const bufferMs = 5 * 60 * 1000; // 5 minutes
  return Date.now() >= (expiresAt * 1000) - bufferMs;
}

// Generate PKCE code verifier and challenge
export function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  return { codeVerifier, codeChallenge };
}

// Generate state for OAuth CSRF protection
export function generateOAuthState(): string {
  return crypto.randomBytes(32).toString('base64url');
}
