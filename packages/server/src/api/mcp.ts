import { Router } from 'express';
import { db } from '@chaaskit/db';
import { HTTP_STATUS } from '@chaaskit/shared';
import type { MCPCredentialStatus } from '@chaaskit/shared';
import { requireAuth } from '../middleware/auth.js';
import { requireTeamRole } from '../middleware/team.js';
import { AppError } from '../middleware/errorHandler.js';
import { getConfig } from '../config/loader.js';
import { mcpManager } from '../mcp/client.js';
import {
  encryptCredential,
  generateOAuthState,
  generatePKCE,
} from '../services/encryption.js';
import { discoverOAuthConfig } from '../services/oauth-discovery.js';

export const mcpRouter = Router();

// List available MCP servers
mcpRouter.get('/servers', requireAuth, async (req, res, next) => {
  try {
    const config = getConfig();

    if (!config.mcp) {
      res.json({ servers: [] });
      return;
    }

    const servers = config.mcp.servers.map((server) => ({
      id: server.id,
      name: server.name,
      transport: server.transport,
      enabled: server.enabled,
      connected: mcpManager.isConnected(server.id),
    }));

    res.json({ servers });
  } catch (error) {
    next(error);
  }
});

// List tools from all connected servers
mcpRouter.get('/tools', requireAuth, async (req, res, next) => {
  try {
    const tools = await mcpManager.listAllTools();

    res.json({ tools });
  } catch (error) {
    next(error);
  }
});

// List tools from specific server
mcpRouter.get('/servers/:serverId/tools', requireAuth, async (req, res, next) => {
  try {
    const { serverId } = req.params;

    const tools = await mcpManager.listTools(serverId);

    res.json({ tools });
  } catch (error) {
    next(error);
  }
});

// Invoke a tool
mcpRouter.post('/tools/:serverId/:toolName', requireAuth, async (req, res, next) => {
  try {
    const config = getConfig();
    const { serverId, toolName } = req.params;
    const { arguments: args } = req.body;

    if (!config.mcp) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'MCP is not configured');
    }

    // Check if tool confirmation is required (for direct API calls, use simple mode check)
    const confirmationMode = config.mcp.toolConfirmation?.mode || 'none';
    if (confirmationMode !== 'none' && !req.body.confirmed) {
      // Return the tool call for confirmation
      res.json({
        requiresConfirmation: true,
        serverId,
        toolName,
        arguments: args,
      });
      return;
    }

    const result = await mcpManager.callTool(serverId, toolName, args);

    res.json({ result });
  } catch (error) {
    next(error);
  }
});

// Connect to a server
mcpRouter.post('/servers/:serverId/connect', requireAuth, async (req, res, next) => {
  try {
    const config = getConfig();
    const { serverId } = req.params;

    if (!config.mcp) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'MCP is not configured');
    }

    const serverConfig = config.mcp.servers.find((s) => s.id === serverId);

    if (!serverConfig) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Server not found');
    }

    await mcpManager.connect(serverConfig);

    res.json({ connected: true });
  } catch (error) {
    next(error);
  }
});

// Disconnect from a server
mcpRouter.post('/servers/:serverId/disconnect', requireAuth, async (req, res, next) => {
  try {
    const { serverId } = req.params;

    await mcpManager.disconnect(serverId);

    res.json({ connected: false });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// Credential Management Endpoints
// ============================================================

// List credential status for all servers requiring user credentials
mcpRouter.get('/credentials', requireAuth, async (req, res, next) => {
  try {
    const config = getConfig();
    const userId = req.user!.id;

    if (!config.mcp) {
      res.json({ credentials: [] });
      return;
    }

    // Get user's existing credentials
    const userCredentials = await db.mCPCredential.findMany({
      where: { userId },
      select: { serverId: true, credentialType: true },
    });

    const credentialMap = new Map(
      userCredentials.map((c) => [c.serverId, c.credentialType])
    );

    // Build status for servers that require user credentials
    const credentials: MCPCredentialStatus[] = config.mcp.servers
      .filter((server) => {
        const authMode = server.authMode || 'none';
        return authMode === 'user-apikey' || authMode === 'user-oauth';
      })
      .map((server) => ({
        serverId: server.id,
        serverName: server.name,
        authMode: server.authMode || 'none',
        hasCredential: credentialMap.has(server.id),
        credentialType: credentialMap.get(server.id) as 'api_key' | 'oauth' | undefined,
        userInstructions: server.userInstructions,
      }));

    console.log(`[MCP] Returning ${credentials.length} credential statuses for user ${userId}`);
    res.json({ credentials });
  } catch (error) {
    next(error);
  }
});

// Set API key for a server
mcpRouter.post('/credentials/:serverId/apikey', requireAuth, async (req, res, next) => {
  try {
    const config = getConfig();
    const { serverId } = req.params;
    const { apiKey } = req.body;
    const userId = req.user!.id;

    if (!apiKey || typeof apiKey !== 'string') {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'API key is required');
    }

    if (!config.mcp) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'MCP is not configured');
    }

    const serverConfig = config.mcp.servers.find((s) => s.id === serverId);
    if (!serverConfig) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Server not found');
    }

    if (serverConfig.authMode !== 'user-apikey') {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Server does not accept user API keys');
    }

    // Encrypt and store the credential
    const encryptedData = encryptCredential({ apiKey });

    await db.mCPCredential.upsert({
      where: {
        userId_serverId: { userId, serverId },
      },
      update: {
        credentialType: 'api_key',
        encryptedData,
        oauthState: null,
        codeVerifier: null,
        updatedAt: new Date(),
      },
      create: {
        userId,
        serverId,
        credentialType: 'api_key',
        encryptedData,
      },
    });

    // Disconnect existing user client so it reconnects with new credentials
    await mcpManager.disconnectUser(userId, serverId);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Remove credential for a server
mcpRouter.delete('/credentials/:serverId', requireAuth, async (req, res, next) => {
  try {
    const { serverId } = req.params;
    const userId = req.user!.id;

    await db.mCPCredential.deleteMany({
      where: { userId, serverId },
    });

    // Disconnect user client
    await mcpManager.disconnectUser(userId, serverId);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// OAuth Flow Endpoints
// ============================================================

// Start OAuth flow - returns authorization URL
mcpRouter.get('/oauth/:serverId/authorize', requireAuth, async (req, res, next) => {
  try {
    const config = getConfig();
    const { serverId } = req.params;
    const userId = req.user!.id;

    if (!config.mcp) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'MCP is not configured');
    }

    const serverConfig = config.mcp.servers.find((s) => s.id === serverId);
    if (!serverConfig) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Server not found');
    }

    if (serverConfig.authMode !== 'user-oauth') {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Server does not support OAuth');
    }

    // Discover OAuth configuration (endpoints + client registration)
    const oauthConfig = await discoverOAuthConfig(serverConfig);
    if (!oauthConfig) {
      throw new AppError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        'Failed to discover OAuth configuration for this server'
      );
    }

    // Generate PKCE challenge and state
    const { codeVerifier, codeChallenge } = generatePKCE();
    const state = generateOAuthState();

    // Store state and code verifier in credential record
    const encryptedVerifier = encryptCredential({ codeVerifier });

    await db.mCPCredential.upsert({
      where: {
        userId_serverId: { userId, serverId },
      },
      update: {
        oauthState: state,
        codeVerifier: encryptedVerifier,
        updatedAt: new Date(),
      },
      create: {
        userId,
        serverId,
        credentialType: 'oauth',
        encryptedData: '', // Will be updated after OAuth completes
        oauthState: state,
        codeVerifier: encryptedVerifier,
      },
    });

    // Build authorization URL
    const apiUrl = process.env.API_URL || 'http://localhost:3000';
    const redirectUri = `${apiUrl}/api/mcp/oauth/callback`;

    const authUrl = new URL(oauthConfig.authorizationEndpoint);
    authUrl.searchParams.set('client_id', oauthConfig.clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', `${serverId}:${state}`);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    // RFC 8707: Resource indicator for audience binding (required by MCP spec)
    if (serverConfig.url) {
      authUrl.searchParams.set('resource', serverConfig.url);
    }

    if (oauthConfig.scopes && oauthConfig.scopes.length > 0) {
      authUrl.searchParams.set('scope', oauthConfig.scopes.join(' '));
    }

    res.json({ authorizationUrl: authUrl.toString() });
  } catch (error) {
    next(error);
  }
});

// OAuth callback - exchanges code for tokens
mcpRouter.get('/oauth/callback', async (req, res, next) => {
  try {
    const config = getConfig();
    const { code, state, error: oauthError, error_description } = req.query;

    const appUrl = process.env.APP_URL || 'http://localhost:5173';
    const settingsUrl = `${appUrl}/settings`;

    if (oauthError) {
      console.error(`[MCP OAuth] Error: ${oauthError} - ${error_description}`);
      res.redirect(`${settingsUrl}?error=oauth_${oauthError}`);
      return;
    }

    if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
      res.redirect(`${settingsUrl}?error=oauth_invalid_response`);
      return;
    }

    // Parse state: either "serverId:oauthState" (user) or "team:teamId:serverId:oauthState" (team)
    let serverId: string;
    let oauthState: string;
    let isTeamOAuth = false;
    let teamId: string | undefined;

    if (state.startsWith('team:')) {
      // Team OAuth: "team:teamId:serverId:oauthState"
      const parts = state.slice(5); // Remove "team:" prefix
      const firstColon = parts.indexOf(':');
      const secondColon = parts.indexOf(':', firstColon + 1);
      if (firstColon === -1 || secondColon === -1) {
        res.redirect(`${settingsUrl}?error=oauth_invalid_state`);
        return;
      }
      teamId = parts.slice(0, firstColon);
      serverId = parts.slice(firstColon + 1, secondColon);
      oauthState = parts.slice(secondColon + 1);
      isTeamOAuth = true;
    } else {
      // User OAuth: "serverId:oauthState"
      const stateIndex = state.indexOf(':');
      if (stateIndex === -1) {
        res.redirect(`${settingsUrl}?error=oauth_invalid_state`);
        return;
      }
      serverId = state.slice(0, stateIndex);
      oauthState = state.slice(stateIndex + 1);
    }

    if (!config.mcp) {
      res.redirect(`${settingsUrl}?error=mcp_not_configured`);
      return;
    }

    const serverConfig = config.mcp.servers.find((s) => s.id === serverId);
    if (!serverConfig) {
      res.redirect(`${settingsUrl}?error=server_not_found`);
      return;
    }

    // Find credential with matching state
    const credential = await db.mCPCredential.findFirst({
      where: {
        serverId,
        oauthState,
        ...(isTeamOAuth ? { teamId } : {}),
      },
    });

    if (!credential || !credential.codeVerifier) {
      res.redirect(`${settingsUrl}?error=oauth_state_mismatch`);
      return;
    }

    // Discover OAuth configuration
    const oauthConfig = await discoverOAuthConfig(serverConfig);
    if (!oauthConfig) {
      res.redirect(`${settingsUrl}?error=oauth_discovery_failed`);
      return;
    }

    // Decrypt code verifier
    const { decryptCredential } = await import('../services/encryption.js');
    const { codeVerifier } = decryptCredential<{ codeVerifier: string }>(credential.codeVerifier);

    const apiUrl = process.env.API_URL || 'http://localhost:3000';
    const redirectUri = `${apiUrl}/api/mcp/oauth/callback`;

    // Exchange code for tokens
    // RFC 8707: Include resource parameter for audience binding (required by MCP spec)
    const tokenParams: Record<string, string> = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: oauthConfig.clientId,
      code_verifier: codeVerifier,
    };

    if (oauthConfig.clientSecret) {
      tokenParams.client_secret = oauthConfig.clientSecret;
    }

    // Include resource parameter for token audience binding
    if (serverConfig.url) {
      tokenParams.resource = serverConfig.url;
    }

    const tokenResponse = await fetch(oauthConfig.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams(tokenParams),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error(`[MCP OAuth] Token exchange failed:`, errorText);
      res.redirect(`${settingsUrl}?error=oauth_token_exchange_failed`);
      return;
    }

    const tokenData = await tokenResponse.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      token_type?: string;
    };

    // Store tokens
    const expiresAt = tokenData.expires_in
      ? Math.floor(Date.now() / 1000) + tokenData.expires_in
      : undefined;

    const encryptedData = encryptCredential({
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt,
      tokenType: tokenData.token_type || 'Bearer',
    });

    await db.mCPCredential.update({
      where: { id: credential.id },
      data: {
        credentialType: 'oauth',
        encryptedData,
        oauthState: null,
        codeVerifier: null,
        updatedAt: new Date(),
      },
    });

    // Disconnect existing client so it reconnects with new credentials
    if (isTeamOAuth && teamId) {
      await mcpManager.disconnectTeam(teamId, serverId);
      res.redirect(`${appUrl}/team/${teamId}/settings?success=oauth_connected&server=${serverId}`);
    } else {
      await mcpManager.disconnectUser(credential.userId, serverId);
      res.redirect(`${appUrl}/?openSettings=true&success=oauth_connected&server=${serverId}`);
    }
  } catch (error) {
    console.error('[MCP OAuth] Callback error:', error);
    const appUrl = process.env.APP_URL || 'http://localhost:5173';
    res.redirect(`${appUrl}/?openSettings=true&error=oauth_callback_error`);
  }
});

// ============================================================
// Team Credential Management Endpoints
// ============================================================

// List credential status for all servers requiring team credentials
mcpRouter.get('/team/:teamId/credentials', requireAuth, requireTeamRole('admin'), async (req, res, next) => {
  try {
    const config = getConfig();
    const { teamId } = req.params;

    if (!config.mcp) {
      res.json({ credentials: [] });
      return;
    }

    // Get team's existing credentials
    const teamCredentials = await db.mCPCredential.findMany({
      where: { teamId },
      select: { serverId: true, credentialType: true },
    });

    const credentialMap = new Map(
      teamCredentials.map((c) => [c.serverId, c.credentialType])
    );

    // Build status for servers that require team credentials
    const credentials: MCPCredentialStatus[] = config.mcp.servers
      .filter((server) => {
        const authMode = server.authMode || 'none';
        return authMode === 'team-apikey' || authMode === 'team-oauth';
      })
      .map((server) => ({
        serverId: server.id,
        serverName: server.name,
        authMode: server.authMode || 'none',
        hasCredential: credentialMap.has(server.id),
        credentialType: credentialMap.get(server.id) as 'api_key' | 'oauth' | undefined,
        userInstructions: server.userInstructions,
      }));

    res.json({ credentials });
  } catch (error) {
    next(error);
  }
});

// Set API key for a team server
mcpRouter.post('/team/:teamId/credentials/:serverId/apikey', requireAuth, requireTeamRole('admin'), async (req, res, next) => {
  try {
    const config = getConfig();
    const { teamId, serverId } = req.params;
    const { apiKey } = req.body;
    const userId = req.user!.id;

    if (!apiKey || typeof apiKey !== 'string') {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'API key is required');
    }

    if (!config.mcp) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'MCP is not configured');
    }

    const serverConfig = config.mcp.servers.find((s) => s.id === serverId);
    if (!serverConfig) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Server not found');
    }

    if (serverConfig.authMode !== 'team-apikey') {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Server does not accept team API keys');
    }

    // Encrypt and store the credential
    const encryptedData = encryptCredential({ apiKey });

    // Find existing team credential for this server
    const existing = await db.mCPCredential.findFirst({
      where: { teamId, serverId },
    });

    if (existing) {
      await db.mCPCredential.update({
        where: { id: existing.id },
        data: {
          credentialType: 'api_key',
          encryptedData,
          oauthState: null,
          codeVerifier: null,
          updatedAt: new Date(),
        },
      });
    } else {
      await db.mCPCredential.create({
        data: {
          userId, // Audit trail: who set this credential
          teamId,
          serverId,
          credentialType: 'api_key',
          encryptedData,
        },
      });
    }

    // Disconnect existing team client so it reconnects with new credentials
    await mcpManager.disconnectTeam(teamId, serverId);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Remove team credential for a server
mcpRouter.delete('/team/:teamId/credentials/:serverId', requireAuth, requireTeamRole('admin'), async (req, res, next) => {
  try {
    const { teamId, serverId } = req.params;

    await db.mCPCredential.deleteMany({
      where: { teamId, serverId },
    });

    // Disconnect team client
    await mcpManager.disconnectTeam(teamId, serverId);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Start OAuth flow for a team server - returns authorization URL
mcpRouter.get('/team/:teamId/oauth/:serverId/authorize', requireAuth, requireTeamRole('admin'), async (req, res, next) => {
  try {
    const config = getConfig();
    const { teamId, serverId } = req.params;
    const userId = req.user!.id;

    if (!config.mcp) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'MCP is not configured');
    }

    const serverConfig = config.mcp.servers.find((s) => s.id === serverId);
    if (!serverConfig) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Server not found');
    }

    if (serverConfig.authMode !== 'team-oauth') {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Server does not support team OAuth');
    }

    // Discover OAuth configuration (endpoints + client registration)
    const oauthConfig = await discoverOAuthConfig(serverConfig);
    if (!oauthConfig) {
      throw new AppError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        'Failed to discover OAuth configuration for this server'
      );
    }

    // Generate PKCE challenge and state
    const { codeVerifier, codeChallenge } = generatePKCE();
    const state = generateOAuthState();

    // Store state and code verifier in credential record
    const encryptedVerifier = encryptCredential({ codeVerifier });

    // Find existing team credential for this server
    const existing = await db.mCPCredential.findFirst({
      where: { teamId, serverId },
    });

    if (existing) {
      await db.mCPCredential.update({
        where: { id: existing.id },
        data: {
          oauthState: state,
          codeVerifier: encryptedVerifier,
          updatedAt: new Date(),
        },
      });
    } else {
      await db.mCPCredential.create({
        data: {
          userId, // Audit trail: who initiated the OAuth flow
          teamId,
          serverId,
          credentialType: 'oauth',
          encryptedData: '', // Will be updated after OAuth completes
          oauthState: state,
          codeVerifier: encryptedVerifier,
        },
      });
    }

    // Build authorization URL
    const apiUrl = process.env.API_URL || 'http://localhost:3000';
    const redirectUri = `${apiUrl}/api/mcp/oauth/callback`;

    const authUrl = new URL(oauthConfig.authorizationEndpoint);
    authUrl.searchParams.set('client_id', oauthConfig.clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    // State format: team:teamId:serverId:oauthState
    authUrl.searchParams.set('state', `team:${teamId}:${serverId}:${state}`);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    // RFC 8707: Resource indicator for audience binding (required by MCP spec)
    if (serverConfig.url) {
      authUrl.searchParams.set('resource', serverConfig.url);
    }

    if (oauthConfig.scopes && oauthConfig.scopes.length > 0) {
      authUrl.searchParams.set('scope', oauthConfig.scopes.join(' '));
    }

    res.json({ authorizationUrl: authUrl.toString() });
  } catch (error) {
    next(error);
  }
});
