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

test('teams endpoints are forbidden when teams are disabled', async () => {
  const appPromise = createTestApp({
    teams: { enabled: false },
  });

  const res = await request(await appPromise).get('/api/teams');
  expect(res.status).toBe(403);
});

test('viewer cannot update team details', async () => {
  const appPromise = createTestApp({
    teams: { enabled: true },
  });

  const owner = await createAuthedAgent(appPromise, 'team-owner');
  const viewer = await createAuthedAgent(appPromise, 'team-viewer');

  const createRes = await owner.agent.post('/api/teams').send({ name: 'My Team' });
  const teamId = createRes.body.team.id as string;

  await prisma.teamMember.create({
    data: {
      teamId,
      userId: viewer.userId,
      role: 'viewer',
    },
  });

  const patchRes = await viewer.agent.patch(`/api/teams/${teamId}`).send({ name: 'Nope' });
  expect(patchRes.status).toBe(403);
});

test('viewer cannot create a team project', async () => {
  const appPromise = createTestApp({
    teams: { enabled: true },
    projects: { enabled: true, colors: ['#6366f1'] },
  });

  const owner = await createAuthedAgent(appPromise, 'proj-owner');
  const viewer = await createAuthedAgent(appPromise, 'proj-viewer');

  const createRes = await owner.agent.post('/api/teams').send({ name: 'Project Team' });
  const teamId = createRes.body.team.id as string;

  await prisma.teamMember.create({
    data: {
      teamId,
      userId: viewer.userId,
      role: 'viewer',
    },
  });

  const projectRes = await viewer.agent.post('/api/projects').send({
    name: 'Viewer Project',
    color: '#6366f1',
    teamId,
    sharing: 'team',
  });

  expect(projectRes.status).toBe(403);
});

test('team-shared project is visible to team members', async () => {
  const appPromise = createTestApp({
    teams: { enabled: true },
    projects: { enabled: true, colors: ['#6366f1'] },
  });

  const owner = await createAuthedAgent(appPromise, 'proj-owner2');
  const viewer = await createAuthedAgent(appPromise, 'proj-viewer2');

  const createRes = await owner.agent.post('/api/teams').send({ name: 'Shared Team' });
  const teamId = createRes.body.team.id as string;

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

  const getRes = await viewer.agent.get(`/api/projects/${projectId}`);
  expect(getRes.status).toBe(200);
  expect(getRes.body.project.name).toBe('Shared Project');
});

test('personal projects are not visible to other users', async () => {
  const appPromise = createTestApp({
    projects: { enabled: true, colors: ['#6366f1'] },
  });

  const owner = await createAuthedAgent(appPromise, 'proj-owner3');
  const other = await createAuthedAgent(appPromise, 'proj-other3');

  const projectRes = await owner.agent.post('/api/projects').send({
    name: 'Private Project',
    color: '#6366f1',
  });

  const projectId = projectRes.body.project.id as string;

  const getRes = await other.agent.get(`/api/projects/${projectId}`);
  expect(getRes.status).toBe(403);
});
