import request from 'supertest';
import { prisma } from '@chaaskit/db';
import { createTestApp, uniqueEmail } from '../../__tests__/test-utils.js';

afterAll(async () => {
  await prisma.$disconnect();
});

async function createAuthedAgent(
  app: ReturnType<typeof createTestApp>,
  prefix: string
) {
  const agent = request.agent(await app);
  const email = uniqueEmail(prefix);
  const registerRes = await agent.post('/api/auth/register').send({
    email,
    password: 'password123',
  });

  return { agent, userId: registerRes.body.user.id as string, email };
}

test('non-admin users cannot access admin routes', async () => {
  const appPromise = createTestApp({
    admin: { emails: [] },
  });

  const user = await createAuthedAgent(appPromise, 'non-admin');

  const res = await user.agent.get('/api/admin/stats');
  expect(res.status).toBe(403);
});

test('config admin email grants access to admin routes', async () => {
  const adminEmail = uniqueEmail('config-admin');
  const appPromise = createTestApp({
    admin: { emails: [adminEmail] },
  });

  const adminUser = await createAuthedAgent(appPromise, 'config-admin');
  await prisma.user.update({
    where: { id: adminUser.userId },
    data: { email: adminEmail },
  });

  const res = await adminUser.agent.get('/api/admin/stats');
  expect(res.status).toBe(200);
  expect(res.body.totalUsers).toBeGreaterThanOrEqual(1);
});

test('config admin email match is case-insensitive', async () => {
  const adminEmail = uniqueEmail('config-admin-case');
  const appPromise = createTestApp({
    admin: { emails: [adminEmail.toUpperCase()] },
  });

  const adminUser = await createAuthedAgent(appPromise, 'config-admin-case');
  await prisma.user.update({
    where: { id: adminUser.userId },
    data: { email: adminEmail.toLowerCase() },
  });

  const res = await adminUser.agent.get('/api/admin/stats');
  expect(res.status).toBe(200);
});

test('config admin list does not grant access to non-listed users', async () => {
  const adminEmail = uniqueEmail('config-admin-other');
  const appPromise = createTestApp({
    admin: { emails: [adminEmail] },
  });

  const user = await createAuthedAgent(appPromise, 'config-admin-other');
  const res = await user.agent.get('/api/admin/stats');
  expect(res.status).toBe(403);
});

test('database admin flag grants access and cannot self-demote', async () => {
  const appPromise = createTestApp();
  const adminUser = await createAuthedAgent(appPromise, 'db-admin');

  await prisma.user.update({
    where: { id: adminUser.userId },
    data: { isAdmin: true },
  });

  const statsRes = await adminUser.agent.get('/api/admin/stats');
  expect(statsRes.status).toBe(200);

  const patchRes = await adminUser.agent
    .patch(`/api/admin/users/${adminUser.userId}`)
    .send({ isAdmin: false });
  expect(patchRes.status).toBe(400);
});
