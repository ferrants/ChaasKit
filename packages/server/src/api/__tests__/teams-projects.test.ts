import request from 'supertest';
import { createTestApp, uniqueEmail } from '../../__tests__/test-utils.js';

async function createAuthedAgent(app: ReturnType<typeof createTestApp>) {
  const agent = request.agent(await app);
  const email = uniqueEmail('team');
  await agent.post('/api/auth/register').send({ email, password: 'password123' });
  return { agent };
}

test('create team and list teams', async () => {
  const appPromise = createTestApp({
    teams: { enabled: true },
  });
  const { agent } = await createAuthedAgent(appPromise);

  const createRes = await agent.post('/api/teams').send({ name: 'My Team' });
  expect(createRes.status).toBe(201);
  expect(createRes.body.team.name).toBe('My Team');

  const listRes = await agent.get('/api/teams');
  expect(listRes.status).toBe(200);
  expect(listRes.body.teams.length).toBeGreaterThanOrEqual(1);
});

test('create personal project and list projects', async () => {
  const appPromise = createTestApp({
    projects: { enabled: true, colors: ['#6366f1'] },
  });
  const { agent } = await createAuthedAgent(appPromise);

  const createRes = await agent
    .post('/api/projects')
    .send({ name: 'My Project', color: '#6366f1' });

  expect(createRes.status).toBe(201);
  expect(createRes.body.project.name).toBe('My Project');

  const listRes = await agent.get('/api/projects');
  expect(listRes.status).toBe(200);
  expect(listRes.body.projects.length).toBeGreaterThanOrEqual(1);
});
