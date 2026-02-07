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

test('viewer cannot update a team project', async () => {
  const appPromise = createTestApp({
    teams: { enabled: true },
    projects: { enabled: true, colors: ['#6366f1'] },
  });

  const owner = await createAuthedAgent(appPromise, 'proj-owner');
  const viewer = await createAuthedAgent(appPromise, 'proj-viewer');

  const teamRes = await owner.agent.post('/api/teams').send({ name: 'Team Project' });
  const teamId = teamRes.body.team.id as string;

  await prisma.teamMember.create({
    data: {
      teamId,
      userId: viewer.userId,
      role: 'viewer',
    },
  });

  const projectRes = await owner.agent.post('/api/projects').send({
    name: 'Team Project',
    color: '#6366f1',
    teamId,
    sharing: 'team',
  });
  const projectId = projectRes.body.project.id as string;

  const patchRes = await viewer.agent.patch(`/api/projects/${projectId}`).send({
    name: 'Nope',
  });

  expect(patchRes.status).toBe(403);
});

test('invalid project color is rejected on update', async () => {
  const appPromise = createTestApp({
    projects: { enabled: true, colors: ['#6366f1'] },
  });

  const owner = await createAuthedAgent(appPromise, 'proj-color');

  const projectRes = await owner.agent.post('/api/projects').send({
    name: 'Color Project',
    color: '#6366f1',
  });
  const projectId = projectRes.body.project.id as string;

  const patchRes = await owner.agent.patch(`/api/projects/${projectId}`).send({
    color: '#ff0000',
  });

  expect(patchRes.status).toBe(400);
});

test('personal projects cannot be updated to team sharing', async () => {
  const appPromise = createTestApp({
    projects: { enabled: true, colors: ['#6366f1'] },
  });

  const owner = await createAuthedAgent(appPromise, 'proj-sharing');

  const projectRes = await owner.agent.post('/api/projects').send({
    name: 'Personal Project',
    color: '#6366f1',
  });
  const projectId = projectRes.body.project.id as string;

  const patchRes = await owner.agent.patch(`/api/projects/${projectId}`).send({
    sharing: 'team',
  });

  expect(patchRes.status).toBe(400);
});

test('archiving a project archives its threads', async () => {
  const appPromise = createTestApp({
    projects: { enabled: true, colors: ['#6366f1'] },
  });

  const owner = await createAuthedAgent(appPromise, 'proj-archive');

  const projectRes = await owner.agent.post('/api/projects').send({
    name: 'Archive Project',
    color: '#6366f1',
  });
  const projectId = projectRes.body.project.id as string;

  const thread = await prisma.thread.create({
    data: {
      title: 'Thread To Archive',
      userId: owner.userId,
      projectId,
    },
  });

  const archiveRes = await owner.agent.post(`/api/projects/${projectId}/archive`);
  expect(archiveRes.status).toBe(200);
  expect(archiveRes.body.success).toBe(true);

  const archivedProject = await prisma.project.findUnique({ where: { id: projectId } });
  const archivedThread = await prisma.thread.findUnique({ where: { id: thread.id } });

  expect(archivedProject?.archivedAt).toBeTruthy();
  expect(archivedThread?.archivedAt).toBeTruthy();
});
