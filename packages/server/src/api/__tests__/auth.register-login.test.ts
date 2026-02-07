import request from 'supertest';
import { createTestApp, uniqueEmail } from '../../__tests__/test-utils.js';

test('register and login with email/password', async () => {
  const app = await createTestApp();
  const email = uniqueEmail('register');

  const registerRes = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'password123' });

  expect(registerRes.status).toBe(201);
  expect(registerRes.body.user.email).toBe(email);

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email, password: 'password123' });

  expect(loginRes.status).toBe(200);
  expect(loginRes.body.user.email).toBe(email);
});
