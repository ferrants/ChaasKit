import request from 'supertest';
import { createTestApp, uniqueEmail } from '../../__tests__/test-utils.js';
import { createInviteTokenForEmail } from '../../services/waitlist.js';

const password = 'password123';

test('invite-only mode blocks registration without invite', async () => {
  const app = await createTestApp({
    auth: {
      methods: ['email-password'],
      allowUnauthenticated: false,
      magicLink: { enabled: true, expiresInMinutes: 15 },
      gating: { mode: 'invite_only', inviteExpiryDays: 7, waitlistEnabled: true },
    },
  });

  const email = uniqueEmail('invite-only');
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password });

  expect(res.status).toBe(403);
  expect(res.body.code).toBe('invite_only');
});

test('invite-only mode allows registration with invite token', async () => {
  const app = await createTestApp({
    auth: {
      methods: ['email-password'],
      allowUnauthenticated: false,
      magicLink: { enabled: true, expiresInMinutes: 15 },
      gating: { mode: 'invite_only', inviteExpiryDays: 7, waitlistEnabled: true },
    },
  });

  const email = uniqueEmail('invite-accept');
  const invite = await createInviteTokenForEmail({ email });

  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password, inviteToken: invite.token });

  expect(res.status).toBe(201);
  expect(res.body.user.email).toBe(email);
});

test('waitlist endpoint accepts entries when enabled', async () => {
  const app = await createTestApp({
    auth: {
      methods: ['email-password'],
      allowUnauthenticated: false,
      magicLink: { enabled: true, expiresInMinutes: 15 },
      gating: { mode: 'closed', inviteExpiryDays: 7, waitlistEnabled: true },
    },
  });

  const email = uniqueEmail('waitlist');
  const res = await request(app)
    .post('/api/auth/waitlist')
    .send({ email, name: 'Test User' });

  expect(res.status).toBe(201);
  expect(res.body.entry.email).toBe(email);
});
