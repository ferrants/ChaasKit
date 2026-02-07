import request from 'supertest';
import { createTestApp } from '../../__tests__/test-utils.js';

test('agents endpoint filters by plan and returns client info', async () => {
  const app = await createTestApp();
  const res = await request(app).get('/api/agents');

  expect(res.status).toBe(200);
  const agents = res.body.agents;
  expect(Array.isArray(agents)).toBe(true);
  expect(agents.length).toBe(1);
  expect(agents[0].id).toBe('default');
  expect(agents[0]).toHaveProperty('name');
  expect(agents[0]).toHaveProperty('isDefault');
});
