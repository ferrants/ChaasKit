import type { Request, Response } from 'express';
import { apiKeyAuth } from '../apiKeyAuth.js';

let config = {
  api: {
    keyPrefix: 'sk-',
    allowedEndpoints: ['/api/threads'],
  },
};

vi.mock('../../config/loader.js', () => ({
  getConfig: () => config,
}));

vi.mock('@chaaskit/db', () => ({
  db: {
    apiKey: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    teamMember: {
      findFirst: vi.fn(),
    },
  },
}));

function createRes() {
  const res = {
    statusCode: 200,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json: vi.fn(),
  } as unknown as Response;
  return res;
}

test('apiKeyAuth matches full /api path for allowedEndpoints', async () => {
  config = {
    api: {
      keyPrefix: 'sk-',
      allowedEndpoints: ['/api/threads'],
    },
  };

  const req = {
    headers: { authorization: 'Bearer sk-abc123' },
    baseUrl: '/api',
    path: '/threads',
  } as unknown as Request;

  const res = createRes();
  const next = vi.fn();

  await apiKeyAuth(req, res, next);

  expect(res.statusCode).toBe(401);
  expect(res.json).toHaveBeenCalledWith({ error: 'Invalid API key' });
  expect(next).not.toHaveBeenCalled();
});

test('apiKeyAuth allows wildcard subpaths under /api', async () => {
  config = {
    api: {
      keyPrefix: 'sk-',
      allowedEndpoints: ['/api/threads/**'],
    },
  };

  const req = {
    headers: { authorization: 'Bearer sk-abc123' },
    baseUrl: '/api',
    path: '/threads/123/messages',
  } as unknown as Request;

  const res = createRes();
  const next = vi.fn();

  await apiKeyAuth(req, res, next);

  expect(res.statusCode).toBe(401);
  expect(res.json).toHaveBeenCalledWith({ error: 'Invalid API key' });
  expect(next).not.toHaveBeenCalled();
});
