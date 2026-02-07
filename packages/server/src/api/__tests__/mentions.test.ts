import request from 'supertest';
import { createTestApp, uniqueEmail } from '../../__tests__/test-utils.js';

async function createAuthedAgent(app: ReturnType<typeof createTestApp>) {
  const agent = request.agent(await app);
  const email = uniqueEmail('mentions');
  await agent.post('/api/auth/register').send({ email, password: 'password123' });
  return { agent, email };
}

test('mentions search returns created document', async () => {
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

  await agent
    .post('/api/documents')
    .send({ name: 'Searchable Doc', content: 'Searchable content', mimeType: 'text/plain' });

  const res = await agent.get('/api/mentions/search').query({ q: 'Searchable' });

  expect(res.status).toBe(200);
  expect(res.body.documents.length).toBeGreaterThanOrEqual(1);
  expect(res.body.grouped.my.length).toBeGreaterThanOrEqual(1);
});

test('mentions types endpoint returns document type', async () => {
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

  const res = await agent.get('/api/mentions/types');
  expect(res.status).toBe(200);
  expect(res.body.types[0].type).toBe('document');
});
