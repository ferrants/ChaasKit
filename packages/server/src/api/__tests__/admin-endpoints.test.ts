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

test('admin can list users and update another user', async () => {
  const adminEmail = uniqueEmail('admin-users');
  const appPromise = createTestApp({
    admin: { emails: [adminEmail] },
  });

  const adminUser = await createAuthedAgent(appPromise, 'admin-users');
  await prisma.user.update({
    where: { id: adminUser.userId },
    data: { email: adminEmail },
  });

  const otherUser = await createAuthedAgent(appPromise, 'regular-user');

  const listRes = await adminUser.agent.get('/api/admin/users').query({ page: 1, pageSize: 10 });
  expect(listRes.status).toBe(200);
  expect(listRes.body.users.length).toBeGreaterThanOrEqual(1);

  const patchRes = await adminUser.agent
    .patch(`/api/admin/users/${otherUser.userId}`)
    .send({ isAdmin: true, plan: 'pro' });

  expect(patchRes.status).toBe(200);
  expect(patchRes.body.user.isAdmin).toBe(true);
  expect(patchRes.body.user.plan).toBe('pro');
});

test('admin can list teams and fetch team details', async () => {
  const adminEmail = uniqueEmail('admin-teams');
  const appPromise = createTestApp({
    admin: { emails: [adminEmail] },
    teams: { enabled: true },
  });

  const adminUser = await createAuthedAgent(appPromise, 'admin-teams');
  await prisma.user.update({
    where: { id: adminUser.userId },
    data: { email: adminEmail },
  });

  const teamRes = await adminUser.agent.post('/api/teams').send({ name: 'Admin Team' });
  const teamId = teamRes.body.team.id as string;

  const listRes = await adminUser.agent.get('/api/admin/teams').query({ page: 1, pageSize: 10 });
  expect(listRes.status).toBe(200);
  expect(listRes.body.teams.length).toBeGreaterThanOrEqual(1);

  const detailRes = await adminUser.agent.get(`/api/admin/teams/${teamId}`);
  expect(detailRes.status).toBe(200);
  expect(detailRes.body.id).toBe(teamId);
  expect(detailRes.body.memberCount).toBeGreaterThanOrEqual(1);
});

test('archived teams are excluded unless includeArchived=true', async () => {
  const adminEmail = uniqueEmail('admin-archived');
  const appPromise = createTestApp({
    admin: { emails: [adminEmail] },
    teams: { enabled: true },
  });

  const adminUser = await createAuthedAgent(appPromise, 'admin-archived');
  await prisma.user.update({
    where: { id: adminUser.userId },
    data: { email: adminEmail },
  });

  const teamRes = await adminUser.agent.post('/api/teams').send({ name: 'Archived Team' });
  const teamId = teamRes.body.team.id as string;

  await adminUser.agent.post(`/api/teams/${teamId}/archive`);

  const listDefault = await adminUser.agent.get('/api/admin/teams');
  const defaultIds = listDefault.body.teams.map((t: { id: string }) => t.id);
  expect(defaultIds.includes(teamId)).toBe(false);

  const listArchived = await adminUser.agent
    .get('/api/admin/teams')
    .query({ includeArchived: 'true' });
  const archivedIds = listArchived.body.teams.map((t: { id: string }) => t.id);
  expect(archivedIds.includes(teamId)).toBe(true);
});
