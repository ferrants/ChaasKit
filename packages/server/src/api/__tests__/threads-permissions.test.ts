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

  return { agent, userId: registerRes.body.user.id as string };
}

test('viewer cannot create a team thread', async () => {
  const appPromise = createTestApp({
    teams: { enabled: true },
  });

  const owner = await createAuthedAgent(appPromise, 'thread-owner');
  const viewer = await createAuthedAgent(appPromise, 'thread-viewer');

  const teamRes = await owner.agent.post('/api/teams').send({ name: 'Thread Team' });
  const teamId = teamRes.body.team.id as string;

  await prisma.teamMember.create({
    data: {
      teamId,
      userId: viewer.userId,
      role: 'viewer',
    },
  });

  const createRes = await viewer.agent.post('/api/threads').send({
    title: 'Viewer Thread',
    teamId,
  });

  expect(createRes.status).toBe(403);
});

test('non-member cannot list team threads', async () => {
  const appPromise = createTestApp({
    teams: { enabled: true },
  });

  const owner = await createAuthedAgent(appPromise, 'thread-owner2');
  const outsider = await createAuthedAgent(appPromise, 'thread-outsider');

  const teamRes = await owner.agent.post('/api/teams').send({ name: 'Thread Team 2' });
  const teamId = teamRes.body.team.id as string;

  await prisma.thread.create({
    data: {
      title: 'Team Thread',
      userId: owner.userId,
      teamId,
      agentId: 'default',
    },
  });

  const listRes = await outsider.agent.get('/api/threads').query({ teamId });
  expect(listRes.status).toBe(403);
});

test('viewer cannot create thread in team-shared project', async () => {
  const appPromise = createTestApp({
    teams: { enabled: true },
    projects: { enabled: true, colors: ['#6366f1'] },
  });

  const owner = await createAuthedAgent(appPromise, 'thread-owner3');
  const viewer = await createAuthedAgent(appPromise, 'thread-viewer3');

  const teamRes = await owner.agent.post('/api/teams').send({ name: 'Project Team' });
  const teamId = teamRes.body.team.id as string;

  await prisma.teamMember.create({
    data: {
      teamId,
      userId: viewer.userId,
      role: 'viewer',
    },
  });

  const projectRes = await owner.agent.post('/api/projects').send({
    name: 'Shared Project',
    color: '#6366f1',
    teamId,
    sharing: 'team',
  });
  const projectId = projectRes.body.project.id as string;

  const createRes = await viewer.agent.post('/api/threads').send({
    title: 'Viewer Project Thread',
    projectId,
  });

  expect(createRes.status).toBe(403);
});

test('team member can fetch team thread; outsider cannot', async () => {
  const appPromise = createTestApp({
    teams: { enabled: true },
  });

  const owner = await createAuthedAgent(appPromise, 'thread-owner4');
  const member = await createAuthedAgent(appPromise, 'thread-member4');
  const outsider = await createAuthedAgent(appPromise, 'thread-outsider4');

  const teamRes = await owner.agent.post('/api/teams').send({ name: 'Thread Team 4' });
  const teamId = teamRes.body.team.id as string;

  await prisma.teamMember.create({
    data: {
      teamId,
      userId: member.userId,
      role: 'member',
    },
  });

  const thread = await prisma.thread.create({
    data: {
      title: 'Team Thread',
      userId: owner.userId,
      teamId,
      agentId: 'default',
    },
  });

  const memberRes = await member.agent.get(`/api/threads/${thread.id}`);
  expect(memberRes.status).toBe(200);

  const outsiderRes = await outsider.agent.get(`/api/threads/${thread.id}`);
  expect(outsiderRes.status).toBe(403);
});

test('viewer cannot rename a team thread', async () => {
  const appPromise = createTestApp({
    teams: { enabled: true },
  });

  const owner = await createAuthedAgent(appPromise, 'thread-owner5');
  const viewer = await createAuthedAgent(appPromise, 'thread-viewer5');

  const teamRes = await owner.agent.post('/api/teams').send({ name: 'Thread Team 5' });
  const teamId = teamRes.body.team.id as string;

  await prisma.teamMember.create({
    data: {
      teamId,
      userId: viewer.userId,
      role: 'viewer',
    },
  });

  const thread = await prisma.thread.create({
    data: {
      title: 'Team Thread',
      userId: owner.userId,
      teamId,
      agentId: 'default',
    },
  });

  const patchRes = await viewer.agent.patch(`/api/threads/${thread.id}`).send({
    title: 'Updated Title',
  });

  expect(patchRes.status).toBe(403);
});
