/**
 * MCP Server API Routes
 *
 * Exposes this app as an MCP server for external clients.
 *
 * Endpoints:
 * - POST /mcp - JSON-RPC 2.0 endpoint for MCP protocol
 * - GET /mcp/.well-known/oauth-protected-resource - RFC 9728 resource metadata
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { getConfig } from '../config/loader.js';
import { mcpServerAuth } from '../middleware/mcpServerAuth.js';
import {
  handleMCPRequest,
  parseJsonRpcRequest,
  createErrorResponse,
} from '../mcp/server.js';

export const mcpServerRouter = Router();

/**
 * RFC 9728 OAuth Protected Resource Metadata
 *
 * Tells MCP clients where to find the OAuth authorization server.
 */
mcpServerRouter.get('/.well-known/oauth-protected-resource', (req: Request, res: Response) => {
  const config = getConfig();
  const serverConfig = config.mcp?.server;

  if (!serverConfig?.enabled) {
    res.status(404).json({ error: 'MCP server is not enabled' });
    return;
  }

  const apiUrl = process.env.API_URL || 'http://localhost:3000';
  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  const appName = config.app?.name || 'Chat SaaS';

  // Build the resource metadata
  const metadata: Record<string, unknown> = {
    resource: `${apiUrl}/mcp`,
    authorization_servers: [`${apiUrl}`],
  };

  // Add bearer methods supported
  const bearerMethods: string[] = ['header'];

  // If OAuth is enabled, include it
  if (serverConfig.oauth?.enabled) {
    metadata.bearer_methods_supported = bearerMethods;
    metadata.scopes_supported = ['mcp:tools', 'mcp:resources'];
  }

  res.json(metadata);
});

/**
 * MCP JSON-RPC 2.0 Endpoint
 *
 * Handles all MCP protocol methods:
 * - initialize
 * - ping
 * - tools/list
 * - tools/call
 * - resources/list
 * - resources/read
 */
mcpServerRouter.post('/', mcpServerAuth, async (req: Request, res: Response) => {
  // Parse the JSON-RPC request
  const parsed = parseJsonRpcRequest(req.body);

  // Check for parse errors
  if ('code' in parsed) {
    res.json(createErrorResponse(parsed));
    return;
  }

  // Handle the request
  const context = {
    userId: req.mcpContext?.userId,
    teamId: req.mcpContext?.teamId,
    scopes: req.mcpContext?.scopes,
  };

  const response = await handleMCPRequest(parsed, context);

  // Don't send response for notifications (id is null/undefined)
  if (parsed.id === null || parsed.id === undefined) {
    res.status(204).end();
    return;
  }

  res.json(response);
});

/**
 * OPTIONS for CORS preflight
 */
mcpServerRouter.options('/', (req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.status(204).end();
});
