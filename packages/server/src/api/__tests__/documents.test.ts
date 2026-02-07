import request from 'supertest';
import { createTestApp, uniqueEmail } from '../../__tests__/test-utils.js';

async function createAuthedAgent(app: ReturnType<typeof createTestApp>) {
  const agent = request.agent(await app);
  const email = uniqueEmail('docs');
  await agent.post('/api/auth/register').send({ email, password: 'password123' });
  return { agent, email };
}

test('create and list documents', async () => {
  const appPromise = createTestApp({
    documents: {
      enabled: true,
      storage: { provider: 'database' },
      maxFileSizeMB: 10,
      hybridThreshold: 1000,
      acceptedTypes: ['text/plain'],
    },
  });

  const { agent } = await createAuthedAgent(appPromise);

  const createRes = await agent
    .post('/api/documents')
    .send({ name: 'Doc One', content: 'Hello world', mimeType: 'text/plain' });

  expect(createRes.status).toBe(201);
  expect(createRes.body.document.name).toBe('Doc One');

  const listRes = await agent.get('/api/documents');
  expect(listRes.status).toBe(200);
  expect(listRes.body.documents.length).toBeGreaterThanOrEqual(1);
});
