import request from 'supertest';
import { createTestApp } from '../../__tests__/test-utils.js';

test('config endpoint returns client-safe fields', async () => {
  const app = await createTestApp({
    documents: {
      enabled: true,
      storage: { provider: 'filesystem', filesystem: { basePath: '/tmp' } },
      maxFileSizeMB: 10,
      hybridThreshold: 1000,
      acceptedTypes: ['text/plain'],
    },
    api: {
      enabled: true,
      keyPrefix: 'sk-',
      allowedEndpoints: ['/api/threads'],
    },
  });

  const res = await request(app).get('/api/config');

  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('app');
  expect(res.body).toHaveProperty('ui');
  expect(res.body).not.toHaveProperty('agent');
  expect(res.body.payments?.plans).toBeUndefined();
  expect(res.body.promptTemplates?.builtIn).toBeUndefined();
  expect(res.body.admin).toBeUndefined();
  expect(res.body.documents).toBeDefined();
  expect(res.body.documents.storage).toBeUndefined();
  expect(res.body.api).toBeDefined();
  expect(res.body.api.keyPrefix).toBeUndefined();
});
