/**
 * OAuth 2.1 API Routes
 *
 * Implements OAuth 2.1 endpoints for MCP client authentication.
 *
 * Endpoints:
 * - GET /.well-known/oauth-authorization-server - RFC 8414 metadata
 * - POST /oauth/register - RFC 7591 dynamic client registration
 * - GET/POST /oauth/authorize - Authorization endpoint
 * - POST /oauth/token - Token endpoint
 * - POST /oauth/revoke - Token revocation
 * - GET /api/oauth/apps - List authorized apps
 * - DELETE /api/oauth/apps/:clientId - Revoke app access
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { HTTP_STATUS } from '@chaaskit/shared';
import { getConfig } from '../config/loader.js';
import { requireAuth } from '../middleware/auth.js';
import {
  registerClient,
  generateAuthorizationCode,
  exchangeCodeForTokens,
  refreshAccessToken,
  revokeToken,
  revokeAllTokensForClient,
  getAuthorizedApps,
  getAuthorizationServerMetadata,
} from '../oauth/server.js';

export const oauthRouter = Router();

// =============================================================================
// Well-Known Endpoint
// =============================================================================

/**
 * OAuth 2.0 Authorization Server Metadata (RFC 8414)
 */
oauthRouter.get('/.well-known/oauth-authorization-server', (req: Request, res: Response) => {
  const config = getConfig();

  if (!config.mcp?.server?.oauth?.enabled) {
    res.status(404).json({ error: 'OAuth is not enabled' });
    return;
  }

  res.json(getAuthorizationServerMetadata());
});

/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728)
 *
 * This endpoint tells MCP clients where the authorization server is located.
 * Supports both root-level and resource-specific paths per RFC 9728.
 */
function handleProtectedResourceMetadata(req: Request, res: Response) {
  const config = getConfig();
  const serverConfig = config.mcp?.server;

  if (!serverConfig?.enabled) {
    res.status(404).json({ error: 'MCP server is not enabled' });
    return;
  }

  const apiUrl = process.env.API_URL || 'http://localhost:3000';

  // Build the resource metadata
  const metadata: Record<string, unknown> = {
    resource: `${apiUrl}/mcp`,
    authorization_servers: [`${apiUrl}`],
  };

  // Add bearer methods supported
  if (serverConfig.oauth?.enabled) {
    metadata.bearer_methods_supported = ['header'];
    metadata.scopes_supported = ['mcp:tools', 'mcp:resources'];
  }

  res.json(metadata);
}

// Root-level protected resource metadata
oauthRouter.get('/.well-known/oauth-protected-resource', handleProtectedResourceMetadata);

// Resource-specific path (RFC 9728 allows appending resource path)
oauthRouter.get('/.well-known/oauth-protected-resource/mcp', handleProtectedResourceMetadata);

// =============================================================================
// Dynamic Client Registration
// =============================================================================

/**
 * RFC 7591 Dynamic Client Registration
 */
oauthRouter.post('/oauth/register', async (req: Request, res: Response) => {
  const config = getConfig();

  if (!config.mcp?.server?.oauth?.enabled) {
    res.status(404).json({ error: 'OAuth is not enabled' });
    return;
  }

  if (!config.mcp.server.oauth.allowDynamicRegistration) {
    res.status(403).json({
      error: 'invalid_request',
      error_description: 'Dynamic client registration is not enabled',
    });
    return;
  }

  try {
    const { client_name, redirect_uris, grant_types, response_types, token_endpoint_auth_method, client_uri } =
      req.body;

    // Validate required fields
    if (!client_name || typeof client_name !== 'string') {
      res.status(400).json({
        error: 'invalid_client_metadata',
        error_description: 'client_name is required',
      });
      return;
    }

    if (!redirect_uris || !Array.isArray(redirect_uris) || redirect_uris.length === 0) {
      res.status(400).json({
        error: 'invalid_client_metadata',
        error_description: 'redirect_uris is required and must be a non-empty array',
      });
      return;
    }

    // Validate redirect URIs
    for (const uri of redirect_uris) {
      try {
        new URL(uri);
      } catch {
        res.status(400).json({
          error: 'invalid_redirect_uri',
          error_description: `Invalid redirect URI: ${uri}`,
        });
        return;
      }
    }

    const client = await registerClient({
      client_name,
      redirect_uris,
      grant_types,
      response_types,
      token_endpoint_auth_method,
      client_uri,
    });

    res.status(201).json(client);
  } catch (error) {
    console.error('[OAuth] Registration error:', error);
    res.status(400).json({
      error: 'invalid_client_metadata',
      error_description: error instanceof Error ? error.message : 'Registration failed',
    });
  }
});

// =============================================================================
// Authorization Endpoint
// =============================================================================

/**
 * Authorization endpoint - GET shows consent page, POST processes consent
 */
oauthRouter.get('/oauth/authorize', requireAuth, async (req: Request, res: Response) => {
  const config = getConfig();

  if (!config.mcp?.server?.oauth?.enabled) {
    res.status(404).json({ error: 'OAuth is not enabled' });
    return;
  }

  const {
    client_id,
    redirect_uri,
    response_type,
    scope,
    state,
    code_challenge,
    code_challenge_method,
  } = req.query;

  // Validate required parameters
  if (response_type !== 'code') {
    res.status(400).json({
      error: 'unsupported_response_type',
      error_description: 'Only response_type=code is supported',
    });
    return;
  }

  if (!client_id || typeof client_id !== 'string') {
    res.status(400).json({
      error: 'invalid_request',
      error_description: 'client_id is required',
    });
    return;
  }

  if (!redirect_uri || typeof redirect_uri !== 'string') {
    res.status(400).json({
      error: 'invalid_request',
      error_description: 'redirect_uri is required',
    });
    return;
  }

  if (!code_challenge || typeof code_challenge !== 'string') {
    res.status(400).json({
      error: 'invalid_request',
      error_description: 'code_challenge is required (PKCE)',
    });
    return;
  }

  // Redirect to frontend consent page with query params
  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  const basePath = (config.app as { basePath?: string })?.basePath || '';
  const consentPath = basePath ? `${basePath}/oauth/consent` : '/oauth/consent';
  const consentUrl = new URL(consentPath, appUrl);
  consentUrl.searchParams.set('client_id', client_id);
  consentUrl.searchParams.set('redirect_uri', redirect_uri);
  if (scope) consentUrl.searchParams.set('scope', scope as string);
  if (state) consentUrl.searchParams.set('state', state as string);
  consentUrl.searchParams.set('code_challenge', code_challenge);
  if (code_challenge_method) {
    consentUrl.searchParams.set('code_challenge_method', code_challenge_method as string);
  }

  res.redirect(consentUrl.toString());
});

/**
 * Authorization endpoint - POST processes consent decision
 */
oauthRouter.post('/oauth/authorize', requireAuth, async (req: Request, res: Response) => {
  const config = getConfig();

  if (!config.mcp?.server?.oauth?.enabled) {
    res.status(404).json({ error: 'OAuth is not enabled' });
    return;
  }

  const {
    client_id,
    redirect_uri,
    scope,
    state,
    code_challenge,
    code_challenge_method,
    consent,
  } = req.body;

  // Validate consent
  if (consent !== 'approve') {
    // User denied - redirect with error
    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('error', 'access_denied');
    redirectUrl.searchParams.set('error_description', 'User denied the request');
    if (state) redirectUrl.searchParams.set('state', state);
    res.json({ redirect: redirectUrl.toString() });
    return;
  }

  try {
    // Generate authorization code
    const code = await generateAuthorizationCode({
      clientId: client_id,
      userId: req.user!.id,
      redirectUri: redirect_uri,
      scope,
      codeChallenge: code_challenge,
      codeChallengeMethod: code_challenge_method || 'S256',
    });

    // Build redirect URL with code
    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('code', code);
    if (state) redirectUrl.searchParams.set('state', state);

    res.json({ redirect: redirectUrl.toString() });
  } catch (error) {
    console.error('[OAuth] Authorization error:', error);
    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('error', 'server_error');
    redirectUrl.searchParams.set(
      'error_description',
      error instanceof Error ? error.message : 'Authorization failed'
    );
    if (state) redirectUrl.searchParams.set('state', state);
    res.json({ redirect: redirectUrl.toString() });
  }
});

// =============================================================================
// Token Endpoint
// =============================================================================

/**
 * Token endpoint - exchange code for tokens or refresh tokens
 */
oauthRouter.post('/oauth/token', async (req: Request, res: Response) => {
  const config = getConfig();

  if (!config.mcp?.server?.oauth?.enabled) {
    res.status(404).json({ error: 'OAuth is not enabled' });
    return;
  }

  const { grant_type, code, redirect_uri, client_id, code_verifier, refresh_token } = req.body;

  try {
    if (grant_type === 'authorization_code') {
      // Validate required parameters
      if (!code || !redirect_uri || !client_id || !code_verifier) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'Missing required parameters: code, redirect_uri, client_id, code_verifier',
        });
        return;
      }

      const tokens = await exchangeCodeForTokens({
        code,
        clientId: client_id,
        redirectUri: redirect_uri,
        codeVerifier: code_verifier,
      });

      res.json(tokens);
    } else if (grant_type === 'refresh_token') {
      if (!refresh_token || !client_id) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'Missing required parameters: refresh_token, client_id',
        });
        return;
      }

      const tokens = await refreshAccessToken({
        refreshToken: refresh_token,
        clientId: client_id,
      });

      res.json(tokens);
    } else {
      res.status(400).json({
        error: 'unsupported_grant_type',
        error_description: 'Only authorization_code and refresh_token grant types are supported',
      });
    }
  } catch (error) {
    console.error('[OAuth] Token error:', error);
    res.status(400).json({
      error: 'invalid_grant',
      error_description: error instanceof Error ? error.message : 'Token exchange failed',
    });
  }
});

// =============================================================================
// Token Revocation
// =============================================================================

/**
 * Token revocation endpoint (RFC 7009)
 */
oauthRouter.post('/oauth/revoke', async (req: Request, res: Response) => {
  const config = getConfig();

  if (!config.mcp?.server?.oauth?.enabled) {
    res.status(404).json({ error: 'OAuth is not enabled' });
    return;
  }

  const { token, token_type_hint } = req.body;

  if (!token) {
    res.status(400).json({
      error: 'invalid_request',
      error_description: 'token is required',
    });
    return;
  }

  try {
    await revokeToken({
      token,
      tokenTypeHint: token_type_hint,
    });

    // Always return 200 OK per RFC 7009
    res.status(200).end();
  } catch (error) {
    console.error('[OAuth] Revocation error:', error);
    res.status(200).end(); // Still return 200 per spec
  }
});

// =============================================================================
// User App Management API
// =============================================================================

/**
 * List OAuth apps authorized by the current user
 */
oauthRouter.get('/api/oauth/apps', requireAuth, async (req: Request, res: Response) => {
  try {
    const apps = await getAuthorizedApps(req.user!.id);
    res.json({ apps });
  } catch (error) {
    console.error('[OAuth] Error listing apps:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Failed to list authorized apps',
    });
  }
});

/**
 * Revoke access for an OAuth app
 */
oauthRouter.delete('/api/oauth/apps/:clientId', requireAuth, async (req: Request, res: Response) => {
  const { clientId } = req.params;

  try {
    await revokeAllTokensForClient(clientId, req.user!.id);
    res.status(204).end();
  } catch (error) {
    console.error('[OAuth] Error revoking app:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Failed to revoke app access',
    });
  }
});
