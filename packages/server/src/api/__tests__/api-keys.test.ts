import request from 'supertest';
import { createTestApp, uniqueEmail } from '../../__tests__/test-utils.js';

test('create API key and access allowed endpoint', async () => {
  const app = await createTestApp({
    api: {
      enabled: true,
      keyPrefix: 'sk-',
      allowedEndpoints: ['/api/threads'],
    },
  });

  const agent = request.agent(app);
  const email = uniqueEmail('apikey');

  const registerRes = await agent
    .post('/api/auth/register')
    .send({ email, password: 'password123' });

  expect(registerRes.status).toBe(201);

  const createRes = await agent
    .post('/api/api-keys')
    .send({ name: 'Test Key' });

  expect(createRes.status).toBe(200);
  expect(createRes.body.secret).toBeTruthy();

  const apiKey = createRes.body.secret as string;

  const threadsRes = await request(app)
    .get('/api/threads')
    .set('Authorization', `Bearer ${apiKey}`);

  expect(threadsRes.status).toBe(200);
  expect(Array.isArray(threadsRes.body.threads)).toBe(true);
});
