import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { spawn, type ChildProcess } from 'child_process';
import { db } from '@chaaskit/db';
import type { MCPServerConfig, MCPTool, MCPToolResponse, MCPContentItem } from '@chaaskit/shared';
import {
  decryptCredential,
  encryptCredential,
  type ApiKeyCredentialData,
  type OAuthCredentialData,
  isTokenExpired,
} from '../services/encryption.js';
import { getConfig } from '../config/loader.js';
import { discoverOAuthConfig } from '../services/oauth-discovery.js';

type AnyTransport = StdioClientTransport | SSEClientTransport | StreamableHTTPClientTransport;

interface ManagedClient {
  client: Client;
  tools: MCPTool[];
  transport: AnyTransport;
  childProcess?: ChildProcess;
  lastUsed: number;
}

function redactSensitive(value: unknown): unknown {
  const REDACT_KEYS = [
    'secret',
    'token',
    'password',
    'apiKey',
    'apikey',
    'key',
    'authorization',
    'auth',
  ];

  const isRedactKey = (key: string): boolean =>
    REDACT_KEYS.some((needle) => key.toLowerCase().includes(needle));

  const redact = (input: unknown): unknown => {
    if (Array.isArray(input)) {
      return input.map(redact);
    }
    if (input && typeof input === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(input)) {
        if (isRedactKey(key)) {
          result[key] = '[REDACTED]';
        } else {
          result[key] = redact(val);
        }
      }
      return result;
    }
    if (typeof input === 'string') {
      return input.length > 200 ? `${input.slice(0, 200)}...` : input;
    }
    return input;
  };

  return redact(value);
}

// Cache expiration for user clients (5 minutes)
const USER_CLIENT_TTL_MS = 5 * 60 * 1000;

class MCPClientManager {
  // Global clients for stdio/admin servers
  private globalClients = new Map<string, ManagedClient>();

  // Per-user clients for user-credential servers
  // Key format: `${userId}:${serverId}`
  private userClients = new Map<string, ManagedClient>();

  // Per-team clients for team-credential servers
  // Key format: `team:${teamId}:${serverId}`
  private teamClients = new Map<string, ManagedClient>();

  // Cleanup interval handle
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => this.cleanupStaleClients(), 60000);
  }

  // Clean up stale user and team clients
  private cleanupStaleClients(): void {
    const now = Date.now();
    for (const [key, managedClient] of this.userClients) {
      if (now - managedClient.lastUsed > USER_CLIENT_TTL_MS) {
        console.log(`[MCP] Cleaning up stale user client: ${key}`);
        this.disconnectUserClient(key);
      }
    }
    for (const [key, managedClient] of this.teamClients) {
      if (now - managedClient.lastUsed > USER_CLIENT_TTL_MS) {
        console.log(`[MCP] Cleaning up stale team client: ${key}`);
        this.disconnectTeamClient(key);
      }
    }
  }

  private async disconnectUserClient(key: string): Promise<void> {
    const managedClient = this.userClients.get(key);
    if (managedClient) {
      try {
        await managedClient.client.close();
      } catch (error) {
        console.error(`[MCP] Error closing user client ${key}:`, error);
      }
      this.userClients.delete(key);
    }
  }

  async connect(serverConfig: MCPServerConfig): Promise<void> {
    if (this.globalClients.has(serverConfig.id)) {
      return; // Already connected
    }

    const managedClient = await this.createClient(serverConfig);
    this.globalClients.set(serverConfig.id, managedClient);
  }

  async disconnect(serverId: string): Promise<void> {
    const managedClient = this.globalClients.get(serverId);
    if (managedClient) {
      try {
        await managedClient.client.close();
      } catch (error) {
        console.error(`[MCP] Error closing client for ${serverId}:`, error);
      }

      // Kill child process if stdio transport
      if (managedClient.childProcess) {
        managedClient.childProcess.kill();
      }

      this.globalClients.delete(serverId);
    }
  }

  // Disconnect a user's client for a specific server (e.g., after credential change)
  async disconnectUser(userId: string, serverId: string): Promise<void> {
    const key = `${userId}:${serverId}`;
    await this.disconnectUserClient(key);
  }

  private async disconnectTeamClient(key: string): Promise<void> {
    const managedClient = this.teamClients.get(key);
    if (managedClient) {
      try {
        await managedClient.client.close();
      } catch (error) {
        console.error(`[MCP] Error closing team client ${key}:`, error);
      }
      this.teamClients.delete(key);
    }
  }

  // Disconnect a team's client for a specific server (e.g., after credential change)
  async disconnectTeam(teamId: string, serverId: string): Promise<void> {
    const key = `team:${teamId}:${serverId}`;
    await this.disconnectTeamClient(key);
  }

  isConnected(serverId: string): boolean {
    return this.globalClients.has(serverId);
  }

  async listTools(serverId: string): Promise<MCPTool[]> {
    const managedClient = this.globalClients.get(serverId);
    if (!managedClient) {
      throw new Error(`Server ${serverId} not connected`);
    }
    return managedClient.tools;
  }

  async listAllTools(): Promise<Array<MCPTool & { serverId: string }>> {
    const allTools: Array<MCPTool & { serverId: string }> = [];

    for (const [serverId, managedClient] of this.globalClients) {
      for (const tool of managedClient.tools) {
        allTools.push({ ...tool, serverId });
      }
    }

    return allTools;
  }

  // Get or list all tools available to a user (including user-credential and team-credential servers)
  async listAllToolsForUser(
    userId: string | undefined,
    serverConfigs: MCPServerConfig[],
    teamId?: string | null
  ): Promise<Array<MCPTool & { serverId: string }>> {
    const allTools: Array<MCPTool & { serverId: string }> = [];

    console.log(`[MCP] listAllToolsForUser: userId=${userId || 'anonymous'}, teamId=${teamId || 'none'}, ${serverConfigs.length} server configs`);

    for (const config of serverConfigs) {
      if (!config.enabled) {
        console.log(`[MCP]   - ${config.name} (${config.id}): SKIPPED (disabled)`);
        continue;
      }

      const authMode = config.authMode || 'none';

      // For none/admin auth modes, use global client
      if (authMode === 'none' || authMode === 'admin') {
        const managedClient = this.globalClients.get(config.id);
        if (managedClient) {
          console.log(`[MCP]   - ${config.name} (${config.id}): ${managedClient.tools.length} tools from global client`);
          for (const tool of managedClient.tools) {
            allTools.push({ ...tool, serverId: config.id });
          }
        } else {
          console.log(`[MCP]   - ${config.name} (${config.id}): NO global client connected`);
        }
        continue;
      }

      // For team-apikey/team-oauth, only available in team threads
      if (authMode === 'team-apikey' || authMode === 'team-oauth') {
        if (teamId) {
          try {
            const managedClient = await this.getClientForTeam(config.id, teamId, config);
            if (managedClient) {
              console.log(`[MCP]   - ${config.name} (${config.id}): ${managedClient.tools.length} tools from team client`);
              for (const tool of managedClient.tools) {
                allTools.push({ ...tool, serverId: config.id });
              }
            } else {
              console.log(`[MCP]   - ${config.name} (${config.id}): NO team credentials`);
            }
          } catch (error) {
            console.log(`[MCP]   - ${config.name} (${config.id}): ERROR - ${error instanceof Error ? error.message : error}`);
          }
        } else {
          console.log(`[MCP]   - ${config.name} (${config.id}): SKIPPED (requires team context, not a team thread)`);
        }
        continue;
      }

      // For user-apikey/user-oauth, check if user has credential and try to get client
      if (userId && (authMode === 'user-apikey' || authMode === 'user-oauth')) {
        try {
          const managedClient = await this.getClientForUser(config.id, userId, config);
          if (managedClient) {
            console.log(`[MCP]   - ${config.name} (${config.id}): ${managedClient.tools.length} tools from user client`);
            for (const tool of managedClient.tools) {
              allTools.push({ ...tool, serverId: config.id });
            }
          } else {
            console.log(`[MCP]   - ${config.name} (${config.id}): NO user credentials`);
          }
        } catch (error) {
          console.log(`[MCP]   - ${config.name} (${config.id}): ERROR - ${error instanceof Error ? error.message : error}`);
        }
      } else if (!userId) {
        console.log(`[MCP]   - ${config.name} (${config.id}): SKIPPED (requires user auth, no userId)`);
      }
    }

    console.log(`[MCP] Total tools available: ${allTools.length}`);
    if (allTools.length > 0) {
      console.log(`[MCP] Tool names: ${allTools.map(t => `${t.serverId}:${t.name}`).join(', ')}`);
    }

    return allTools;
  }

  async callTool(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<MCPToolResponse> {
    const managedClient = this.globalClients.get(serverId);
    if (!managedClient) {
      throw new Error(`Server ${serverId} not connected`);
    }

    return this.executeToolCall(managedClient, serverId, toolName, args);
  }

  // Call a tool with user context (handles user-credential and team-credential servers)
  async callToolForUser(
    userId: string | undefined,
    serverId: string,
    toolName: string,
    args: Record<string, unknown>,
    config: MCPServerConfig,
    teamId?: string | null
  ): Promise<MCPToolResponse> {
    const authMode = config.authMode || 'none';

    // For none/admin auth modes, use global client
    if (authMode === 'none' || authMode === 'admin') {
      return this.callTool(serverId, toolName, args);
    }

    // For team-credential modes, get team-specific client
    if (authMode === 'team-apikey' || authMode === 'team-oauth') {
      if (!teamId) {
        return {
          content: [{ type: 'text', text: 'Team tools are only available in team threads' }],
          isError: true,
        };
      }

      try {
        const managedClient = await this.getClientForTeam(serverId, teamId, config);
        if (!managedClient) {
          return {
            content: [{ type: 'text', text: 'Please configure team credentials for this server in Team Settings' }],
            isError: true,
          };
        }

        return this.executeToolCall(managedClient, serverId, toolName, args);
      } catch (error) {
        console.error(`[MCP] Team tool call error:`, error);
        return {
          content: [{ type: 'text', text: error instanceof Error ? error.message : 'Tool execution failed' }],
          isError: true,
        };
      }
    }

    // For user-credential modes, get user-specific client
    if (!userId) {
      return {
        content: [{ type: 'text', text: 'Authentication required for this tool' }],
        isError: true,
      };
    }

    try {
      const managedClient = await this.getClientForUser(serverId, userId, config);
      if (!managedClient) {
        return {
          content: [{ type: 'text', text: 'Please configure your credentials for this server in Settings' }],
          isError: true,
        };
      }

      return this.executeToolCall(managedClient, serverId, toolName, args);
    } catch (error) {
      console.error(`[MCP] User tool call error:`, error);
      return {
        content: [{ type: 'text', text: error instanceof Error ? error.message : 'Tool execution failed' }],
        isError: true,
      };
    }
  }

  private async executeToolCall(
    managedClient: ManagedClient,
    serverId: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<MCPToolResponse> {
    const logDetails = getConfig().mcp?.logToolDetails === true;
    console.log(`[MCP] Executing tool: ${toolName} on server ${serverId}`);
    if (logDetails) {
      console.log(`[MCP]   Arguments: ${JSON.stringify(redactSensitive(args))}`);
    }

    try {
      const startTime = Date.now();
      const result = await managedClient.client.callTool({
        name: toolName,
        arguments: args,
      });
      const duration = Date.now() - startTime;

      // Convert MCP SDK result to our MCPToolResponse format
      const content: MCPContentItem[] = (result.content as Array<{ type: string; text?: string; data?: string; mimeType?: string }>).map((item) => {
        if (item.type === 'text') {
          return { type: 'text' as const, text: item.text };
        } else if (item.type === 'image') {
          return { type: 'image' as const, data: item.data, mimeType: item.mimeType };
        }
        return { type: 'text' as const, text: JSON.stringify(item) };
      });

      console.log(`[MCP] Tool ${toolName} completed in ${duration}ms, isError=${result.isError === true}`);
      if (logDetails) {
        console.log(`[MCP] Full tool response:`, JSON.stringify(redactSensitive(result), null, 2));
        console.log(`[MCP] Tool response content:`);
        for (const item of content) {
          if (item.type === 'text') {
            console.log(`[MCP]   ${redactSensitive(item.text)}`);
          } else if (item.type === 'image') {
            console.log(`[MCP]   [Image: ${item.mimeType}]`);
          }
        }
      }

      return {
        content,
        isError: result.isError === true,
        structuredContent: (result as { structuredContent?: Record<string, unknown> }).structuredContent,
      };
    } catch (error) {
      console.error(`[MCP] Tool call error for ${toolName}:`, error);
      return {
        content: [{ type: 'text', text: error instanceof Error ? error.message : 'Tool execution failed' }],
        isError: true,
      };
    }
  }

  // Get or create a user-specific client
  async getClientForUser(
    serverId: string,
    userId: string,
    config: MCPServerConfig
  ): Promise<ManagedClient | null> {
    const key = `${userId}:${serverId}`;

    // Check existing client
    const existing = this.userClients.get(key);
    if (existing) {
      existing.lastUsed = Date.now();
      return existing;
    }

    // Get user's credential
    const credential = await db.mCPCredential.findUnique({
      where: {
        userId_serverId: { userId, serverId },
      },
    });

    if (!credential) {
      return null;
    }

    // Create client with user's credentials
    const managedClient = await this.createUserClient(config, credential);
    if (managedClient) {
      this.userClients.set(key, managedClient);
    }

    return managedClient;
  }

  // Get or create a team-specific client
  async getClientForTeam(
    serverId: string,
    teamId: string,
    config: MCPServerConfig
  ): Promise<ManagedClient | null> {
    const key = `team:${teamId}:${serverId}`;

    // Check existing client
    const existing = this.teamClients.get(key);
    if (existing) {
      existing.lastUsed = Date.now();
      return existing;
    }

    // Get team's credential
    const credential = await db.mCPCredential.findFirst({
      where: { teamId, serverId },
    });

    if (!credential) {
      return null;
    }

    // Create client with team's credentials (same transport/auth logic as user clients)
    const managedClient = await this.createUserClient(config, credential);
    if (managedClient) {
      this.teamClients.set(key, managedClient);
    }

    return managedClient;
  }

  private async createClient(config: MCPServerConfig): Promise<ManagedClient> {
    if (config.transport === 'stdio') {
      return this.createStdioClient(config);
    } else if (config.transport === 'sse') {
      return this.createSSEClient(config);
    } else if (config.transport === 'streamable-http') {
      return this.createStreamableHTTPClient(config);
    }

    throw new Error(`Unsupported transport: ${config.transport}`);
  }

  private async createUserClient(
    config: MCPServerConfig,
    credential: { id: string; credentialType: string; encryptedData: string }
  ): Promise<ManagedClient> {
    if (config.transport !== 'streamable-http') {
      throw new Error('User credentials only supported for streamable-http transport');
    }

    if (!config.url) {
      throw new Error(`No URL specified for server ${config.id}`);
    }

    let authHeader: string | undefined;

    if (credential.credentialType === 'api_key') {
      const data = decryptCredential<ApiKeyCredentialData>(credential.encryptedData);
      authHeader = `Bearer ${data.apiKey}`;
    } else if (credential.credentialType === 'oauth') {
      let data = decryptCredential<OAuthCredentialData>(credential.encryptedData);

      // Refresh token if expired
      if (isTokenExpired(data.expiresAt)) {
        if (!data.refreshToken) {
          throw new Error('OAuth token expired - please re-authenticate');
        }

        data = await this.refreshOAuthToken(config, data, credential.id);
      }

      authHeader = `${data.tokenType || 'Bearer'} ${data.accessToken}`;
    }

    console.log(`[MCP] Connecting user client to: ${config.url}`);

    const transport = new StreamableHTTPClientTransport(new URL(config.url), {
      requestInit: authHeader
        ? { headers: { Authorization: authHeader } }
        : undefined,
    });

    const client = new Client({
      name: 'chaaskit',
      version: '1.0.0',
    });

    await client.connect(transport);
    console.log(`[MCP] User connected to ${config.name}`);

    // Fetch available tools
    console.log(`[MCP] Fetching tools from ${config.name} for user...`);
    const toolsResult = await client.listTools();

    // Log raw tool data from MCP
    console.log(`[MCP] ${config.name} raw tools from MCP:`);
    for (const tool of toolsResult.tools) {
      console.log(`[MCP] Raw tool: ${JSON.stringify(tool, null, 2)}`);
    }

    const tools: MCPTool[] = toolsResult.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as MCPTool['inputSchema'],
      _meta: (tool as Record<string, unknown>)._meta as MCPTool['_meta'],
      annotations: (tool as Record<string, unknown>).annotations as MCPTool['annotations'],
    }));

    console.log(`[MCP] ${config.name} provides ${tools.length} tools for user`)

    return {
      client,
      tools,
      transport,
      lastUsed: Date.now(),
    };
  }

  private async refreshOAuthToken(
    config: MCPServerConfig,
    data: OAuthCredentialData,
    credentialId: string
  ): Promise<OAuthCredentialData> {
    const oauthConfig = await discoverOAuthConfig(config);
    if (!oauthConfig) {
      throw new Error('OAuth discovery failed - please re-authenticate');
    }

    const params: Record<string, string> = {
      grant_type: 'refresh_token',
      refresh_token: data.refreshToken || '',
      client_id: oauthConfig.clientId,
    };

    if (oauthConfig.clientSecret) {
      params.client_secret = oauthConfig.clientSecret;
    }

    const response = await fetch(oauthConfig.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OAuth token refresh failed: ${errorText}`);
    }

    const tokenData = await response.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      token_type?: string;
    };

    const expiresAt = tokenData.expires_in
      ? Math.floor(Date.now() / 1000) + tokenData.expires_in
      : data.expiresAt;

    const updated: OAuthCredentialData = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || data.refreshToken,
      expiresAt,
      tokenType: tokenData.token_type || data.tokenType || 'Bearer',
    };

    await db.mCPCredential.update({
      where: { id: credentialId },
      data: {
        encryptedData: encryptCredential(updated),
        updatedAt: new Date(),
      },
    });

    return updated;
  }

  private async createStdioClient(config: MCPServerConfig): Promise<ManagedClient> {
    if (!config.command) {
      throw new Error(`No command specified for stdio server ${config.id}`);
    }

    console.log(`[MCP] Connecting to stdio server: ${config.command} ${config.args?.join(' ') || ''}`);

    // Spawn the child process
    const childProcess = spawn(config.command, config.args || [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    // Handle stderr for debugging
    childProcess.stderr?.on('data', (data) => {
      console.error(`[MCP:${config.id}] stderr:`, data.toString());
    });

    // Create transport with the child process streams
    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args || [],
    });

    // Create and connect the client
    const client = new Client({
      name: 'chaaskit',
      version: '1.0.0',
    });

    await client.connect(transport);
    console.log(`[MCP] Connected to ${config.name}`);

    // Fetch available tools
    const toolsResult = await client.listTools();

    // Log raw tool data from MCP
    console.log(`[MCP] ${config.name} raw tools from MCP:`);
    for (const tool of toolsResult.tools) {
      console.log(`[MCP] Raw tool: ${JSON.stringify(tool, null, 2)}`);
    }

    const tools: MCPTool[] = toolsResult.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as MCPTool['inputSchema'],
      _meta: (tool as Record<string, unknown>)._meta as MCPTool['_meta'],
      annotations: (tool as Record<string, unknown>).annotations as MCPTool['annotations'],
    }));

    console.log(`[MCP] ${config.name} provides ${tools.length} tools`);

    return {
      client,
      tools,
      transport,
      childProcess,
      lastUsed: Date.now(),
    };
  }

  private async createSSEClient(config: MCPServerConfig): Promise<ManagedClient> {
    if (!config.url) {
      throw new Error(`No URL specified for SSE server ${config.id}`);
    }

    console.log(`[MCP] Connecting to SSE server: ${config.url}`);

    // Create SSE transport
    const transport = new SSEClientTransport(new URL(config.url));

    // Create and connect the client
    const client = new Client({
      name: 'chaaskit',
      version: '1.0.0',
    });

    await client.connect(transport);
    console.log(`[MCP] Connected to ${config.name}`);

    // Fetch available tools
    const toolsResult = await client.listTools();

    // Log raw tool data from MCP
    console.log(`[MCP] ${config.name} raw tools from MCP:`);
    for (const tool of toolsResult.tools) {
      console.log(`[MCP] Raw tool: ${JSON.stringify(tool, null, 2)}`);
    }

    const tools: MCPTool[] = toolsResult.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as MCPTool['inputSchema'],
      _meta: (tool as Record<string, unknown>)._meta as MCPTool['_meta'],
      annotations: (tool as Record<string, unknown>).annotations as MCPTool['annotations'],
    }));

    console.log(`[MCP] ${config.name} provides ${tools.length} tools`);

    return {
      client,
      tools,
      transport,
      lastUsed: Date.now(),
    };
  }

  private async createStreamableHTTPClient(config: MCPServerConfig): Promise<ManagedClient> {
    if (!config.url) {
      throw new Error(`No URL specified for streamable-http server ${config.id}`);
    }

    console.log(`[MCP] Connecting to streamable-http server: ${config.url}`);

    // Get auth header for admin mode
    let authHeader: string | undefined;
    if (config.authMode === 'admin' && config.adminApiKeyEnvVar) {
      const apiKey = process.env[config.adminApiKeyEnvVar];
      if (!apiKey) {
        throw new Error(`Admin API key not found in env var: ${config.adminApiKeyEnvVar}`);
      }
      authHeader = `Bearer ${apiKey}`;
    }

    // Create Streamable HTTP transport
    const transport = new StreamableHTTPClientTransport(new URL(config.url), {
      requestInit: authHeader
        ? { headers: { Authorization: authHeader } }
        : undefined,
    });

    // Create and connect the client
    const client = new Client({
      name: 'chaaskit',
      version: '1.0.0',
    });

    await client.connect(transport);
    console.log(`[MCP] Connected to ${config.name}`);

    // Fetch available tools
    const toolsResult = await client.listTools();

    // Log raw tool data from MCP
    console.log(`[MCP] ${config.name} raw tools from MCP:`);
    for (const tool of toolsResult.tools) {
      console.log(`[MCP] Raw tool: ${JSON.stringify(tool, null, 2)}`);
    }

    const tools: MCPTool[] = toolsResult.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as MCPTool['inputSchema'],
      _meta: (tool as Record<string, unknown>)._meta as MCPTool['_meta'],
      annotations: (tool as Record<string, unknown>).annotations as MCPTool['annotations'],
    }));

    console.log(`[MCP] ${config.name} provides ${tools.length} tools`);

    return {
      client,
      tools,
      transport,
      lastUsed: Date.now(),
    };
  }

  // List resources from a server
  async listResources(serverId: string): Promise<Array<{ uri: string; name?: string; description?: string; mimeType?: string }>> {
    const managedClient = this.globalClients.get(serverId);
    if (!managedClient) {
      throw new Error(`Server ${serverId} not connected`);
    }

    try {
      const result = await managedClient.client.listResources();
      console.log(`[MCP] Listed ${result.resources.length} resources from ${serverId}`);
      return result.resources.map(r => ({
        uri: r.uri,
        name: r.name,
        description: r.description,
        mimeType: r.mimeType,
      }));
    } catch (error) {
      console.error(`[MCP] Failed to list resources from ${serverId}:`, error);
      return [];
    }
  }

  // Read a resource from a server
  async readResource(serverId: string, uri: string): Promise<{ text?: string; blob?: string; mimeType?: string } | null> {
    const managedClient = this.globalClients.get(serverId);
    if (!managedClient) {
      throw new Error(`Server ${serverId} not connected`);
    }

    try {
      console.log(`[MCP] Reading resource ${uri} from ${serverId}`);
      const result = await managedClient.client.readResource({ uri });

      if (result.contents.length === 0) {
        console.log(`[MCP] Resource ${uri} returned no contents`);
        return null;
      }

      const content = result.contents[0] as { uri: string; mimeType?: string; text?: string; blob?: string };
      console.log(`[MCP] Resource ${uri} read successfully, mimeType=${content.mimeType}`);

      return {
        text: content.text,
        blob: content.blob,
        mimeType: content.mimeType,
      };
    } catch (error) {
      console.error(`[MCP] Failed to read resource ${uri} from ${serverId}:`, error);
      return null;
    }
  }

  // Read a resource for a specific user (handles user-credential and team-credential servers)
  async readResourceForUser(
    userId: string,
    serverId: string,
    uri: string,
    config: MCPServerConfig,
    teamId?: string | null
  ): Promise<{ text?: string; blob?: string; mimeType?: string } | null> {
    const authMode = config.authMode || 'none';

    // For none/admin auth modes, use global client
    if (authMode === 'none' || authMode === 'admin') {
      return this.readResource(serverId, uri);
    }

    // For team-credential modes, get team-specific client
    if ((authMode === 'team-apikey' || authMode === 'team-oauth') && teamId) {
      try {
        const managedClient = await this.getClientForTeam(serverId, teamId, config);
        if (!managedClient) {
          console.error(`[MCP] No team client available for ${serverId}`);
          return null;
        }

        console.log(`[MCP] Reading resource ${uri} from ${serverId} for team ${teamId}`);
        const result = await managedClient.client.readResource({ uri });

        if (result.contents.length === 0) {
          console.log(`[MCP] Resource ${uri} returned no contents`);
          return null;
        }

        const content = result.contents[0] as { uri: string; mimeType?: string; text?: string; blob?: string };
        console.log(`[MCP] Resource ${uri} read successfully, mimeType=${content.mimeType}`);

        return {
          text: content.text,
          blob: content.blob,
          mimeType: content.mimeType,
        };
      } catch (error) {
        console.error(`[MCP] Failed to read resource ${uri} for team:`, error);
        return null;
      }
    }

    // For user-credential modes, get user-specific client
    try {
      const managedClient = await this.getClientForUser(serverId, userId, config);
      if (!managedClient) {
        console.error(`[MCP] No user client available for ${serverId}`);
        return null;
      }

      console.log(`[MCP] Reading resource ${uri} from ${serverId} for user ${userId}`);
      const result = await managedClient.client.readResource({ uri });

      if (result.contents.length === 0) {
        console.log(`[MCP] Resource ${uri} returned no contents`);
        return null;
      }

      const content = result.contents[0] as { uri: string; mimeType?: string; text?: string; blob?: string };
      console.log(`[MCP] Resource ${uri} read successfully, mimeType=${content.mimeType}`);

      return {
        text: content.text,
        blob: content.blob,
        mimeType: content.mimeType,
      };
    } catch (error) {
      console.error(`[MCP] Failed to read resource ${uri} for user:`, error);
      return null;
    }
  }

  // Clean up all connections on shutdown
  async disconnectAll(): Promise<void> {
    // Disconnect global clients
    const globalIds = Array.from(this.globalClients.keys());
    await Promise.all(globalIds.map(id => this.disconnect(id)));

    // Disconnect user clients
    const userKeys = Array.from(this.userClients.keys());
    await Promise.all(userKeys.map(key => this.disconnectUserClient(key)));

    // Disconnect team clients
    const teamKeys = Array.from(this.teamClients.keys());
    await Promise.all(teamKeys.map(key => this.disconnectTeamClient(key)));

    // Stop cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Singleton instance
export const mcpManager = new MCPClientManager();
