import type { Request, Response, NextFunction } from 'express';

// ---- Hoisted mocks ----

const mockDbMCPCredential = vi.hoisted(() => ({
  findMany: vi.fn().mockResolvedValue([]),
  findFirst: vi.fn().mockResolvedValue(null),
  create: vi.fn().mockResolvedValue({ id: 'cred-1' }),
  update: vi.fn().mockResolvedValue({ id: 'cred-1' }),
  deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
}));

vi.mock('@chaaskit/db', () => ({
  db: {
    mCPCredential: mockDbMCPCredential,
    team: {
      findUnique: vi.fn().mockResolvedValue({ id: 'team-1', archivedAt: null }),
    },
    teamMember: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'member-1',
        teamId: 'team-1',
        userId: 'user-1',
        role: 'admin',
        createdAt: new Date(),
        user: { id: 'user-1', email: 'admin@example.com', name: 'Admin', avatarUrl: null },
      }),
    },
  },
}));

vi.mock('../../config/loader.js', () => ({
  getConfig: () => ({
    mcp: {
      servers: [
        {
          id: 'team-api-server',
          name: 'Team API Server',
          transport: 'streamable-http',
          url: 'https://api.example.com/mcp',
          enabled: true,
          authMode: 'team-apikey',
          userInstructions: 'Enter team API key',
        },
        {
          id: 'team-oauth-server',
          name: 'Team OAuth Server',
          transport: 'streamable-http',
          url: 'https://oauth.example.com/mcp',
          enabled: true,
          authMode: 'team-oauth',
        },
        {
          id: 'user-server',
          name: 'User Server',
          transport: 'streamable-http',
          url: 'https://user.example.com/mcp',
          enabled: true,
          authMode: 'user-apikey',
        },
      ],
    },
  }),
}));

vi.mock('../../services/encryption.js', () => ({
  encryptCredential: vi.fn().mockReturnValue('encrypted-data'),
  generateOAuthState: vi.fn().mockReturnValue('oauth-state-123'),
  generatePKCE: vi.fn().mockReturnValue({
    codeVerifier: 'verifier-123',
    codeChallenge: 'challenge-123',
  }),
}));

vi.mock('../../services/oauth-discovery.js', () => ({
  discoverOAuthConfig: vi.fn().mockResolvedValue({
    authorizationEndpoint: 'https://oauth.example.com/authorize',
    tokenEndpoint: 'https://oauth.example.com/token',
    clientId: 'client-id-123',
    scopes: ['read', 'write'],
  }),
}));

const mockDisconnectTeam = vi.fn().mockResolvedValue(undefined);
vi.mock('../../mcp/client.js', () => ({
  mcpManager: {
    disconnectTeam: mockDisconnectTeam,
    disconnectUser: vi.fn().mockResolvedValue(undefined),
    isConnected: vi.fn().mockReturnValue(false),
    listAllTools: vi.fn().mockResolvedValue([]),
    listTools: vi.fn().mockResolvedValue([]),
  },
}));

// Import after mocks are set up
const { mcpRouter } = await import('../mcp.js');
import express from 'express';

// Build a test app with the MCP router + auth simulation
function buildApp(userOverrides: Partial<{ id: string; role: string }> = {}) {
  const app = express();
  app.use(express.json());

  // Simulate authenticated user
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).user = { id: 'user-1', email: 'admin@example.com', ...userOverrides };
    next();
  });

  app.use('/api/mcp', mcpRouter);
  return app;
}

// Supertest import
const request = (await import('supertest')).default;

afterEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/mcp/team/:teamId/credentials', () => {
  test('returns team credential statuses for team-auth servers', async () => {
    mockDbMCPCredential.findMany.mockResolvedValue([
      { serverId: 'team-api-server', credentialType: 'api_key' },
    ]);

    const app = buildApp();
    const res = await request(app).get('/api/mcp/team/team-1/credentials');

    expect(res.status).toBe(200);
    expect(res.body.credentials).toHaveLength(2); // team-api-server + team-oauth-server (not user-server)

    const apiServer = res.body.credentials.find(
      (c: any) => c.serverId === 'team-api-server'
    );
    expect(apiServer).toBeDefined();
    expect(apiServer.hasCredential).toBe(true);
    expect(apiServer.credentialType).toBe('api_key');
    expect(apiServer.authMode).toBe('team-apikey');

    const oauthServer = res.body.credentials.find(
      (c: any) => c.serverId === 'team-oauth-server'
    );
    expect(oauthServer).toBeDefined();
    expect(oauthServer.hasCredential).toBe(false);
    expect(oauthServer.authMode).toBe('team-oauth');
  });

  test('does not include user-auth servers', async () => {
    mockDbMCPCredential.findMany.mockResolvedValue([]);

    const app = buildApp();
    const res = await request(app).get('/api/mcp/team/team-1/credentials');

    expect(res.status).toBe(200);
    const serverIds = res.body.credentials.map((c: any) => c.serverId);
    expect(serverIds).not.toContain('user-server');
  });
});

describe('POST /api/mcp/team/:teamId/credentials/:serverId/apikey', () => {
  test('creates a new team credential', async () => {
    mockDbMCPCredential.findFirst.mockResolvedValue(null); // No existing credential

    const app = buildApp();
    const res = await request(app)
      .post('/api/mcp/team/team-1/credentials/team-api-server/apikey')
      .send({ apiKey: 'sk-team-key-123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockDbMCPCredential.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        teamId: 'team-1',
        serverId: 'team-api-server',
        credentialType: 'api_key',
        encryptedData: 'encrypted-data',
      }),
    });
    expect(mockDisconnectTeam).toHaveBeenCalledWith('team-1', 'team-api-server');
  });

  test('updates an existing team credential', async () => {
    mockDbMCPCredential.findFirst.mockResolvedValue({
      id: 'existing-cred',
      teamId: 'team-1',
      serverId: 'team-api-server',
    });

    const app = buildApp();
    const res = await request(app)
      .post('/api/mcp/team/team-1/credentials/team-api-server/apikey')
      .send({ apiKey: 'sk-new-key' });

    expect(res.status).toBe(200);
    expect(mockDbMCPCredential.update).toHaveBeenCalledWith({
      where: { id: 'existing-cred' },
      data: expect.objectContaining({
        credentialType: 'api_key',
        encryptedData: 'encrypted-data',
      }),
    });
  });

  test('rejects missing API key', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/mcp/team/team-1/credentials/team-api-server/apikey')
      .send({});

    expect(res.status).toBe(400);
  });

  test('rejects wrong auth mode', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/mcp/team/team-1/credentials/team-oauth-server/apikey')
      .send({ apiKey: 'sk-key' });

    expect(res.status).toBe(400);
  });

  test('rejects unknown server', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/mcp/team/team-1/credentials/nonexistent/apikey')
      .send({ apiKey: 'sk-key' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/mcp/team/:teamId/credentials/:serverId', () => {
  test('deletes team credential and disconnects client', async () => {
    const app = buildApp();
    const res = await request(app).delete(
      '/api/mcp/team/team-1/credentials/team-api-server'
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockDbMCPCredential.deleteMany).toHaveBeenCalledWith({
      where: { teamId: 'team-1', serverId: 'team-api-server' },
    });
    expect(mockDisconnectTeam).toHaveBeenCalledWith('team-1', 'team-api-server');
  });
});

describe('GET /api/mcp/team/:teamId/oauth/:serverId/authorize', () => {
  test('returns authorization URL with team state prefix', async () => {
    mockDbMCPCredential.findFirst.mockResolvedValue(null); // No existing credential

    const app = buildApp();
    const res = await request(app).get(
      '/api/mcp/team/team-1/oauth/team-oauth-server/authorize'
    );

    expect(res.status).toBe(200);
    expect(res.body.authorizationUrl).toBeDefined();

    const url = new URL(res.body.authorizationUrl);
    expect(url.origin).toBe('https://oauth.example.com');
    expect(url.pathname).toBe('/authorize');

    // State should be team:teamId:serverId:oauthState
    const state = url.searchParams.get('state');
    expect(state).toBe('team:team-1:team-oauth-server:oauth-state-123');

    expect(url.searchParams.get('code_challenge')).toBe('challenge-123');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('client_id')).toBe('client-id-123');
  });

  test('creates a new credential record for team OAuth', async () => {
    mockDbMCPCredential.findFirst.mockResolvedValue(null);

    const app = buildApp();
    await request(app).get('/api/mcp/team/team-1/oauth/team-oauth-server/authorize');

    expect(mockDbMCPCredential.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        teamId: 'team-1',
        serverId: 'team-oauth-server',
        credentialType: 'oauth',
        oauthState: 'oauth-state-123',
      }),
    });
  });

  test('updates existing credential when re-authorizing', async () => {
    mockDbMCPCredential.findFirst.mockResolvedValue({
      id: 'existing-oauth-cred',
      teamId: 'team-1',
      serverId: 'team-oauth-server',
    });

    const app = buildApp();
    await request(app).get('/api/mcp/team/team-1/oauth/team-oauth-server/authorize');

    expect(mockDbMCPCredential.update).toHaveBeenCalledWith({
      where: { id: 'existing-oauth-cred' },
      data: expect.objectContaining({
        oauthState: 'oauth-state-123',
      }),
    });
  });

  test('rejects non-team-oauth server', async () => {
    const app = buildApp();
    const res = await request(app).get(
      '/api/mcp/team/team-1/oauth/team-api-server/authorize'
    );

    expect(res.status).toBe(400);
  });
});
