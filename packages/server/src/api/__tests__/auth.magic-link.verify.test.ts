import request from 'supertest';
import { prisma } from '@chaaskit/db';
import { createTestApp, uniqueEmail } from '../../__tests__/test-utils.js';

afterAll(async () => {
  await prisma.$disconnect();
});

test('magic link verify marks user verified and returns token', async () => {
  const app = await createTestApp({
    auth: {
      methods: ['magic-link'],
      magicLink: { enabled: true, expiresInMinutes: 15 },
    },
  });

  const email = uniqueEmail('magic-verify');

  const sendRes = await request(app)
    .post('/api/auth/magic-link')
    .send({ email });
  expect(sendRes.status).toBe(200);

  const user = await prisma.user.findUnique({ where: { email } });
  expect(user).toBeTruthy();

  const magicLink = await prisma.magicLink.findFirst({
    where: { userId: user!.id },
    orderBy: { createdAt: 'desc' },
  });
  expect(magicLink).toBeTruthy();

  const verifyRes = await request(app)
    .get('/api/auth/magic-link/verify')
    .query({ token: magicLink!.token });

  expect(verifyRes.status).toBe(200);
  expect(verifyRes.body.user.email).toBe(email);
  expect(verifyRes.body.token).toBeTruthy();
  expect(verifyRes.headers['set-cookie']?.join('') || '').toContain('token=');

  const verifiedUser = await prisma.user.findUnique({ where: { id: user!.id } });
  expect(verifiedUser?.emailVerified).toBe(true);
});
