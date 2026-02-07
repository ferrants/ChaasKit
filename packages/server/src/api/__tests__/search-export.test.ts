import request from 'supertest';
import { prisma } from '@chaaskit/db';
import { createTestApp, uniqueEmail } from '../../__tests__/test-utils.js';

afterAll(async () => {
  await prisma.$disconnect();
});

async function createAuthedAgent(app: ReturnType<typeof createTestApp>) {
  const agent = request.agent(await app);
  const email = uniqueEmail('search');
  const registerRes = await agent.post('/api/auth/register').send({ email, password: 'password123' });
  return { agent, userId: registerRes.body.user.id as string };
}

test('search returns matching messages', async () => {
  const appPromise = createTestApp();
  const { agent, userId } = await createAuthedAgent(appPromise);

  const thread = await prisma.thread.create({
    data: {
      title: 'Search Thread',
      userId,
    },
  });

  await prisma.message.create({
    data: {
      threadId: thread.id,
      role: 'user',
      content: 'Find me in search',
    },
  });

  const res = await agent.get('/api/search').query({ q: 'Find me' });
  expect(res.status).toBe(200);
  expect(res.body.results.length).toBeGreaterThanOrEqual(1);
  expect(res.body.total).toBeGreaterThanOrEqual(1);
});

test('export returns markdown for thread', async () => {
  const appPromise = createTestApp();
  const { agent, userId } = await createAuthedAgent(appPromise);

  const thread = await prisma.thread.create({
    data: {
      title: 'Export Thread',
      userId,
    },
  });

  await prisma.message.create({
    data: {
      threadId: thread.id,
      role: 'user',
      content: 'Export me',
    },
  });

  const res = await agent.get(`/api/export/${thread.id}`).query({ format: 'markdown' });
  expect(res.status).toBe(200);
  expect(res.headers['content-type']).toContain('text/markdown');
  expect(res.text).toContain('Export Thread');
});
