/**
 * OAuth 2.1 Server Implementation
 *
 * Implements OAuth 2.1 with PKCE for MCP client authentication.
 * Supports:
 * - Dynamic client registration (RFC 7591)
 * - Authorization code flow with PKCE
 * - Token refresh
 * - Token revocation
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { db } from '@chaaskit/db';
import { getConfig } from '../config/loader.js';

// =============================================================================
// Types
// =============================================================================

export interface OAuthClientRegistration {
  client_name: string;
  redirect_uris: string[];
  grant_types?: string[];
  response_types?: string[];
  token_endpoint_auth_method?: string;
  client_uri?: string;
}

export interface OAuthClientResponse {
  client_id: string;
  client_secret?: string;
  client_name: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: string;
  client_uri?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export interface TokenInfo {
  userId: string;
  clientId: string;
  scope?: string;
  expiresAt: Date;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Generate a cryptographically secure random string
 */
function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash a token for storage
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Verify PKCE code challenge
 */
function verifyCodeChallenge(
  codeVerifier: string,
  codeChallenge: string,
  method: string
): boolean {
  if (method === 'S256') {
    const hash = crypto.createHash('sha256').update(codeVerifier).digest();
    const computed = hash
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    return computed === codeChallenge;
  }
  // Plain method (not recommended but supported)
  return codeVerifier === codeChallenge;
}

/**
 * Get OAuth configuration with defaults
 */
function getOAuthConfig() {
  const config = getConfig();
  const oauthConfig = config.mcp?.server?.oauth;

  return {
    enabled: oauthConfig?.enabled ?? false,
    allowDynamicRegistration: oauthConfig?.allowDynamicRegistration ?? false,
    accessTokenTTLSeconds: oauthConfig?.accessTokenTTLSeconds ?? 3600,
    refreshTokenTTLSeconds: oauthConfig?.refreshTokenTTLSeconds ?? 30 * 24 * 60 * 60, // 30 days
  };
}

// =============================================================================
// Client Registration
// =============================================================================

/**
 * Register a new OAuth client (RFC 7591 Dynamic Client Registration)
 */
export async function registerClient(
  registration: OAuthClientRegistration
): Promise<OAuthClientResponse> {
  const oauthConfig = getOAuthConfig();

  if (!oauthConfig.allowDynamicRegistration) {
    throw new Error('Dynamic client registration is not enabled');
  }

  // Generate client credentials
  const clientId = `mcp_${generateSecureToken(16)}`;
  const clientSecret = generateSecureToken(32);

  // Determine auth method
  const tokenEndpointAuthMethod = registration.token_endpoint_auth_method || 'none';
  const needsSecret = tokenEndpointAuthMethod !== 'none';

  // Create client in database
  await db.oAuthClient.create({
    data: {
      clientId,
      clientSecretHash: needsSecret ? await bcrypt.hash(clientSecret, 10) : null,
      clientName: registration.client_name,
      clientUri: registration.client_uri,
      redirectUris: JSON.stringify(registration.redirect_uris),
      grantTypes: JSON.stringify(registration.grant_types || ['authorization_code', 'refresh_token']),
      responseTypes: JSON.stringify(registration.response_types || ['code']),
      tokenEndpointAuth: tokenEndpointAuthMethod,
      isActive: true,
    },
  });

  console.log(`[OAuth] Registered new client: ${registration.client_name} (${clientId})`);

  return {
    client_id: clientId,
    client_secret: needsSecret ? clientSecret : undefined,
    client_name: registration.client_name,
    redirect_uris: registration.redirect_uris,
    grant_types: registration.grant_types || ['authorization_code', 'refresh_token'],
    response_types: registration.response_types || ['code'],
    token_endpoint_auth_method: tokenEndpointAuthMethod,
    client_uri: registration.client_uri,
  };
}

// =============================================================================
// Authorization Code
// =============================================================================

/**
 * Generate an authorization code for the OAuth flow
 */
export async function generateAuthorizationCode(params: {
  clientId: string;
  userId: string;
  redirectUri: string;
  scope?: string;
  codeChallenge: string;
  codeChallengeMethod?: string;
}): Promise<string> {
  const { clientId, userId, redirectUri, scope, codeChallenge, codeChallengeMethod } = params;

  // Verify client exists
  const client = await db.oAuthClient.findUnique({
    where: { clientId },
  });

  if (!client || !client.isActive) {
    throw new Error('Invalid client');
  }

  // Verify redirect URI
  const allowedRedirectUris = JSON.parse(client.redirectUris) as string[];
  if (!allowedRedirectUris.includes(redirectUri)) {
    throw new Error('Invalid redirect URI');
  }

  // Generate authorization code
  const code = generateSecureToken(32);

  // Store in database (expires in 10 minutes)
  await db.oAuthAuthorizationCode.create({
    data: {
      code,
      clientId: client.id,
      userId,
      redirectUri,
      scope,
      codeChallenge,
      codeChallengeMethod: codeChallengeMethod || 'S256',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  console.log(`[OAuth] Generated auth code for user ${userId}, client ${clientId}`);

  return code;
}

// =============================================================================
// Token Exchange
// =============================================================================

/**
 * Exchange an authorization code for tokens
 */
export async function exchangeCodeForTokens(params: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<TokenResponse> {
  const { code, clientId, redirectUri, codeVerifier } = params;
  const oauthConfig = getOAuthConfig();

  // Find the authorization code
  const authCode = await db.oAuthAuthorizationCode.findUnique({
    where: { code },
    include: {
      client: true,
    },
  });

  if (!authCode) {
    throw new Error('Invalid authorization code');
  }

  // Verify code hasn't expired
  if (authCode.expiresAt < new Date()) {
    await db.oAuthAuthorizationCode.delete({ where: { id: authCode.id } });
    throw new Error('Authorization code expired');
  }

  // Verify code hasn't been used
  if (authCode.usedAt) {
    throw new Error('Authorization code already used');
  }

  // Verify client
  if (authCode.client.clientId !== clientId) {
    throw new Error('Client mismatch');
  }

  // Verify redirect URI
  if (authCode.redirectUri !== redirectUri) {
    throw new Error('Redirect URI mismatch');
  }

  // Verify PKCE code verifier
  if (!verifyCodeChallenge(codeVerifier, authCode.codeChallenge, authCode.codeChallengeMethod)) {
    throw new Error('Invalid code verifier');
  }

  // Mark code as used
  await db.oAuthAuthorizationCode.update({
    where: { id: authCode.id },
    data: { usedAt: new Date() },
  });

  // Generate tokens
  const accessToken = generateSecureToken(32);
  const refreshToken = generateSecureToken(32);

  const accessTokenExpiresAt = new Date(Date.now() + oauthConfig.accessTokenTTLSeconds * 1000);
  const refreshTokenExpiresAt = new Date(Date.now() + oauthConfig.refreshTokenTTLSeconds * 1000);

  // Store tokens
  await db.oAuthToken.create({
    data: {
      tokenHash: hashToken(accessToken),
      refreshTokenHash: hashToken(refreshToken),
      clientId: authCode.client.id,
      userId: authCode.userId,
      scope: authCode.scope,
      expiresAt: accessTokenExpiresAt,
      refreshExpiresAt: refreshTokenExpiresAt,
    },
  });

  console.log(`[OAuth] Issued tokens for user ${authCode.userId}, client ${clientId}`);

  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: oauthConfig.accessTokenTTLSeconds,
    refresh_token: refreshToken,
    scope: authCode.scope || undefined,
  };
}

/**
 * Refresh an access token
 */
export async function refreshAccessToken(params: {
  refreshToken: string;
  clientId: string;
}): Promise<TokenResponse> {
  const { refreshToken, clientId } = params;
  const oauthConfig = getOAuthConfig();

  const refreshTokenHash = hashToken(refreshToken);

  // Find the token
  const token = await db.oAuthToken.findUnique({
    where: { refreshTokenHash },
    include: {
      client: true,
    },
  });

  if (!token) {
    throw new Error('Invalid refresh token');
  }

  // Verify client
  if (token.client.clientId !== clientId) {
    throw new Error('Client mismatch');
  }

  // Verify token isn't revoked
  if (token.revokedAt) {
    throw new Error('Token has been revoked');
  }

  // Verify refresh token hasn't expired
  if (token.refreshExpiresAt && token.refreshExpiresAt < new Date()) {
    throw new Error('Refresh token expired');
  }

  // Generate new access token (keep same refresh token)
  const newAccessToken = generateSecureToken(32);
  const accessTokenExpiresAt = new Date(Date.now() + oauthConfig.accessTokenTTLSeconds * 1000);

  // Update token record
  await db.oAuthToken.update({
    where: { id: token.id },
    data: {
      tokenHash: hashToken(newAccessToken),
      expiresAt: accessTokenExpiresAt,
    },
  });

  console.log(`[OAuth] Refreshed token for user ${token.userId}, client ${clientId}`);

  return {
    access_token: newAccessToken,
    token_type: 'Bearer',
    expires_in: oauthConfig.accessTokenTTLSeconds,
    scope: token.scope || undefined,
  };
}

// =============================================================================
// Token Revocation
// =============================================================================

/**
 * Revoke a token
 */
export async function revokeToken(params: {
  token: string;
  tokenTypeHint?: 'access_token' | 'refresh_token';
}): Promise<void> {
  const { token, tokenTypeHint } = params;
  const tokenHash = hashToken(token);

  // Try to find by access token hash
  let oauthToken = await db.oAuthToken.findUnique({
    where: { tokenHash },
  });

  // If not found and hint is refresh_token, try refresh token hash
  if (!oauthToken && tokenTypeHint === 'refresh_token') {
    oauthToken = await db.oAuthToken.findUnique({
      where: { refreshTokenHash: tokenHash },
    });
  }

  // If still not found, try refresh token hash anyway
  if (!oauthToken) {
    oauthToken = await db.oAuthToken.findUnique({
      where: { refreshTokenHash: tokenHash },
    });
  }

  if (oauthToken && !oauthToken.revokedAt) {
    await db.oAuthToken.update({
      where: { id: oauthToken.id },
      data: { revokedAt: new Date() },
    });
    console.log(`[OAuth] Revoked token for user ${oauthToken.userId}`);
  }
}

/**
 * Revoke all tokens for a client-user pair
 */
export async function revokeAllTokensForClient(clientId: string, userId: string): Promise<void> {
  const client = await db.oAuthClient.findUnique({
    where: { clientId },
  });

  if (!client) {
    return;
  }

  await db.oAuthToken.updateMany({
    where: {
      clientId: client.id,
      userId,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });

  console.log(`[OAuth] Revoked all tokens for user ${userId}, client ${clientId}`);
}

// =============================================================================
// Token Validation
// =============================================================================

/**
 * Validate an access token and return token info
 */
export async function validateAccessToken(accessToken: string): Promise<TokenInfo | null> {
  const tokenHash = hashToken(accessToken);

  const token = await db.oAuthToken.findUnique({
    where: { tokenHash },
    include: {
      client: true,
    },
  });

  if (!token) {
    return null;
  }

  // Check if expired
  if (token.expiresAt < new Date()) {
    return null;
  }

  // Check if revoked
  if (token.revokedAt) {
    return null;
  }

  // Check if client is still active
  if (!token.client.isActive) {
    return null;
  }

  return {
    userId: token.userId,
    clientId: token.client.clientId,
    scope: token.scope || undefined,
    expiresAt: token.expiresAt,
  };
}

// =============================================================================
// Client Management
// =============================================================================

/**
 * Get OAuth apps authorized by a user
 */
export async function getAuthorizedApps(userId: string): Promise<
  Array<{
    clientId: string;
    clientName: string;
    clientUri?: string;
    scope?: string;
    authorizedAt: Date;
  }>
> {
  // Find all active tokens for this user
  const tokens = await db.oAuthToken.findMany({
    where: {
      userId,
      revokedAt: null,
    },
    include: {
      client: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Group by client (use most recent token per client)
  const clientMap = new Map<
    string,
    {
      clientId: string;
      clientName: string;
      clientUri?: string;
      scope?: string;
      authorizedAt: Date;
    }
  >();

  for (const token of tokens) {
    if (!clientMap.has(token.client.clientId)) {
      clientMap.set(token.client.clientId, {
        clientId: token.client.clientId,
        clientName: token.client.clientName,
        clientUri: token.client.clientUri || undefined,
        scope: token.scope || undefined,
        authorizedAt: token.createdAt,
      });
    }
  }

  return Array.from(clientMap.values());
}

// =============================================================================
// Server Metadata
// =============================================================================

/**
 * Get OAuth 2.0 Authorization Server Metadata (RFC 8414)
 */
export function getAuthorizationServerMetadata(): Record<string, unknown> {
  const config = getConfig();
  const oauthConfig = getOAuthConfig();
  const apiUrl = process.env.API_URL || 'http://localhost:3000';

  const metadata: Record<string, unknown> = {
    issuer: apiUrl,
    authorization_endpoint: `${apiUrl}/oauth/authorize`,
    token_endpoint: `${apiUrl}/oauth/token`,
    revocation_endpoint: `${apiUrl}/oauth/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_basic', 'client_secret_post'],
    code_challenge_methods_supported: ['S256'],
    scopes_supported: ['mcp:tools', 'mcp:resources'],
  };

  // Add registration endpoint if enabled
  if (oauthConfig.allowDynamicRegistration) {
    metadata.registration_endpoint = `${apiUrl}/oauth/register`;
  }

  return metadata;
}
