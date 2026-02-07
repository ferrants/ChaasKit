import request from 'supertest';
import { createTestApp } from './test-utils.js';

describe.sequential('cors allowlist', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('allows configured origins', async () => {
    vi.stubEnv('APP_URL', 'http://allowed.test');
    vi.stubEnv('API_URL', 'http://api.test');
    vi.stubEnv('CORS_ALLOWED_ORIGINS', 'http://extra.test');

    const app = await createTestApp();

    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'http://allowed.test');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://allowed.test');
  });

  test('blocks disallowed origins', async () => {
    vi.stubEnv('APP_URL', 'http://allowed.test');
    vi.stubEnv('API_URL', 'http://api.test');
    vi.stubEnv('CORS_ALLOWED_ORIGINS', 'http://extra.test');

    const app = await createTestApp();

    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'http://evil.test');

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
