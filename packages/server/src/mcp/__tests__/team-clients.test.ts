import type { MCPServerConfig } from '@chaaskit/shared';

// Mock db before importing mcpManager
const mockFindFirst = vi.fn();
const mockFindUnique = vi.fn();

vi.mock('@chaaskit/db', () => ({
  db: {
    mCPCredential: {
      findFirst: mockFindFirst,
      findUnique: mockFindUnique,
    },
  },
}));

// Mock the encryption module
vi.mock('../../services/encryption.js', () => ({
  decryptCredential: vi.fn().mockReturnValue({ apiKey: 'test-api-key' }),
  isTokenExpired: vi.fn().mockReturnValue(false),
}));

// Mock MCP SDK transports and client to avoid real connections
const mockConnect = vi.fn().mockResolvedValue(undefined);
const mockClose = vi.fn().mockResolvedValue(undefined);
const mockListTools = vi.fn().mockResolvedValue({
  tools: [
    {
      name: 'test-tool',
      description: 'A test tool',
      inputSchema: { type: 'object', properties: {} },
    },
  ],
});
const mockCallTool = vi.fn().mockResolvedValue({
  content: [{ type: 'text', text: 'tool result' }],
  isError: false,
});
const mockReadResource = vi.fn().mockResolvedValue({
  contents: [{ uri: 'test://resource', text: 'resource content', mimeType: 'text/plain' }],
});

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: mockConnect,
    close: mockClose,
    listTools: mockListTools,
    callTool: mockCallTool,
    readResource: mockReadResource,
  })),
}));

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: vi.fn(),
}));

vi.mock('@modelcontextprotocol/sdk/client/sse.js', () => ({
  SSEClientTransport: vi.fn(),
}));

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: vi.fn().mockImplementation(() => ({})),
}));

// Now import the manager (uses the mocked modules)
const { mcpManager } = await import('../client.js');

const teamServerConfig: MCPServerConfig = {
  id: 'team-tool-server',
  name: 'Team Tool Server',
  transport: 'streamable-http',
  url: 'https://tools.example.com/mcp',
  enabled: true,
  authMode: 'team-apikey',
};

const teamOAuthServerConfig: MCPServerConfig = {
  id: 'team-oauth-server',
  name: 'Team OAuth Server',
  transport: 'streamable-http',
  url: 'https://oauth-tools.example.com/mcp',
  enabled: true,
  authMode: 'team-oauth',
};

const userServerConfig: MCPServerConfig = {
  id: 'user-tool-server',
  name: 'User Tool Server',
  transport: 'streamable-http',
  url: 'https://user-tools.example.com/mcp',
  enabled: true,
  authMode: 'user-apikey',
};

const globalServerConfig: MCPServerConfig = {
  id: 'global-server',
  name: 'Global Server',
  transport: 'streamable-http',
  url: 'https://global.example.com/mcp',
  enabled: true,
  authMode: 'none',
};

afterEach(async () => {
  vi.clearAllMocks();
  // Clean up any clients created during tests
  await mcpManager.disconnectAll();
});

describe('MCPClientManager team client support', () => {
  describe('getClientForTeam', () => {
    test('returns null when no team credential exists', async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await mcpManager.getClientForTeam(
        'team-tool-server',
        'team-123',
        teamServerConfig
      );

      expect(result).toBeNull();
      expect(mockFindFirst).toHaveBeenCalledWith({
        where: { teamId: 'team-123', serverId: 'team-tool-server' },
      });
    });

    test('creates and caches a client when team credential exists', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'cred-1',
        teamId: 'team-123',
        userId: 'admin-user',
        serverId: 'team-tool-server',
        credentialType: 'api_key',
        encryptedData: 'encrypted-data',
      });

      const result = await mcpManager.getClientForTeam(
        'team-tool-server',
        'team-123',
        teamServerConfig
      );

      expect(result).not.toBeNull();
      expect(result!.tools).toHaveLength(1);
      expect(result!.tools[0].name).toBe('test-tool');
      expect(mockConnect).toHaveBeenCalled();

      // Second call should use cached client (no new db lookup)
      mockFindFirst.mockClear();
      mockConnect.mockClear();

      const cachedResult = await mcpManager.getClientForTeam(
        'team-tool-server',
        'team-123',
        teamServerConfig
      );

      expect(cachedResult).toBe(result);
      expect(mockFindFirst).not.toHaveBeenCalled();
      expect(mockConnect).not.toHaveBeenCalled();
    });
  });

  describe('disconnectTeam', () => {
    test('closes and removes a team client', async () => {
      // First create a client
      mockFindFirst.mockResolvedValue({
        id: 'cred-1',
        teamId: 'team-456',
        userId: 'admin-user',
        serverId: 'team-tool-server',
        credentialType: 'api_key',
        encryptedData: 'encrypted-data',
      });

      await mcpManager.getClientForTeam('team-tool-server', 'team-456', teamServerConfig);
      mockClose.mockClear();

      // Disconnect
      await mcpManager.disconnectTeam('team-456', 'team-tool-server');

      expect(mockClose).toHaveBeenCalled();

      // Next access should trigger a new db lookup
      mockFindFirst.mockResolvedValue(null);
      const result = await mcpManager.getClientForTeam(
        'team-tool-server',
        'team-456',
        teamServerConfig
      );
      expect(result).toBeNull();
      expect(mockFindFirst).toHaveBeenCalled();
    });
  });

  describe('listAllToolsForUser with teamId', () => {
    test('includes team-auth server tools when teamId is provided', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'cred-1',
        teamId: 'team-789',
        serverId: 'team-tool-server',
        credentialType: 'api_key',
        encryptedData: 'encrypted-data',
      });

      const tools = await mcpManager.listAllToolsForUser(
        'user-1',
        [teamServerConfig],
        'team-789'
      );

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('test-tool');
      expect(tools[0].serverId).toBe('team-tool-server');
    });

    test('skips team-auth server tools when no teamId (personal thread)', async () => {
      const tools = await mcpManager.listAllToolsForUser(
        'user-1',
        [teamServerConfig],
        null
      );

      expect(tools).toHaveLength(0);
      expect(mockFindFirst).not.toHaveBeenCalled();
    });

    test('skips team-auth server tools when teamId is undefined', async () => {
      const tools = await mcpManager.listAllToolsForUser(
        'user-1',
        [teamServerConfig]
      );

      expect(tools).toHaveLength(0);
    });

    test('includes team-oauth server tools when teamId and credential exist', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'cred-2',
        teamId: 'team-789',
        serverId: 'team-oauth-server',
        credentialType: 'api_key',
        encryptedData: 'encrypted-data',
      });

      const tools = await mcpManager.listAllToolsForUser(
        'user-1',
        [teamOAuthServerConfig],
        'team-789'
      );

      expect(tools).toHaveLength(1);
      expect(tools[0].serverId).toBe('team-oauth-server');
    });

    test('returns empty for team-auth server when no team credential exists', async () => {
      mockFindFirst.mockResolvedValue(null);

      const tools = await mcpManager.listAllToolsForUser(
        'user-1',
        [teamServerConfig],
        'team-789'
      );

      expect(tools).toHaveLength(0);
    });
  });

  describe('callToolForUser with teamId', () => {
    test('uses team client for team-apikey server', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'cred-1',
        teamId: 'team-100',
        serverId: 'team-tool-server',
        credentialType: 'api_key',
        encryptedData: 'encrypted-data',
      });

      const result = await mcpManager.callToolForUser(
        'user-1',
        'team-tool-server',
        'test-tool',
        { param: 'value' },
        teamServerConfig,
        'team-100'
      );

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toBe('tool result');
      expect(mockCallTool).toHaveBeenCalledWith({
        name: 'test-tool',
        arguments: { param: 'value' },
      });
    });

    test('returns error for team-auth server without teamId', async () => {
      const result = await mcpManager.callToolForUser(
        'user-1',
        'team-tool-server',
        'test-tool',
        {},
        teamServerConfig,
        null
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Team tools are only available in team threads');
    });

    test('returns error when no team credential exists', async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await mcpManager.callToolForUser(
        'user-1',
        'team-tool-server',
        'test-tool',
        {},
        teamServerConfig,
        'team-no-cred'
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Team Settings');
    });

    test('still uses user client for user-apikey server even when teamId is set', async () => {
      mockFindUnique.mockResolvedValue({
        id: 'user-cred-1',
        userId: 'user-1',
        serverId: 'user-tool-server',
        credentialType: 'api_key',
        encryptedData: 'encrypted-data',
      });

      const result = await mcpManager.callToolForUser(
        'user-1',
        'user-tool-server',
        'test-tool',
        {},
        userServerConfig,
        'team-100'
      );

      expect(result.isError).toBeFalsy();
      // Should have used findUnique (user lookup), not findFirst (team lookup)
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { userId_serverId: { userId: 'user-1', serverId: 'user-tool-server' } },
      });
    });
  });

  describe('readResourceForUser with teamId', () => {
    test('uses team client for team-auth server', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'cred-1',
        teamId: 'team-200',
        serverId: 'team-tool-server',
        credentialType: 'api_key',
        encryptedData: 'encrypted-data',
      });

      const result = await mcpManager.readResourceForUser(
        'user-1',
        'team-tool-server',
        'test://resource',
        teamServerConfig,
        'team-200'
      );

      expect(result).not.toBeNull();
      expect(result!.text).toBe('resource content');
      expect(mockReadResource).toHaveBeenCalledWith({ uri: 'test://resource' });
    });

    test('returns null for team-auth server without teamId', async () => {
      // Falls through to user-credential path which will look up user credential
      mockFindUnique.mockResolvedValue(null);

      const result = await mcpManager.readResourceForUser(
        'user-1',
        'team-tool-server',
        'test://resource',
        teamServerConfig,
        null
      );

      expect(result).toBeNull();
    });
  });
});
