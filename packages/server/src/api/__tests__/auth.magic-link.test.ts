import express from 'express';
import request from 'supertest';
import { authRouter } from '../auth.js';

const sendEmailMock = vi.hoisted(() => vi.fn().mockResolvedValue({ messageId: 'msg-1' }));

vi.mock('../../config/loader.js', () => ({
  getConfig: () => ({
    app: { name: 'Test App', url: 'http://localhost:5173' },
    auth: { magicLink: { enabled: true, expiresInMinutes: 15 }, methods: ['magic-link'] },
  }),
}));

vi.mock('@chaaskit/db', () => ({
  db: {
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'user-1', email: 'user@example.com' }),
    },
    magicLink: {
      create: vi.fn().mockResolvedValue({}),
    },
    referralCode: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ code: 'ref-1' }),
    },
  },
}));

vi.mock('../../services/email/index.js', async () => {
  const actual = await vi.importActual<typeof import('../../services/email/index.js')>(
    '../../services/email/index.js'
  );
  return {
    ...actual,
    sendEmail: sendEmailMock,
  };
});

test('magic link endpoint sends email with verify URL', async () => {
  process.env.API_URL = 'http://localhost:3000';

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);

  const res = await request(app)
    .post('/api/auth/magic-link')
    .send({ email: 'user@example.com' });

  expect(res.status).toBe(200);
  expect(sendEmailMock).toHaveBeenCalled();

  const payload = sendEmailMock.mock.calls[0][0];
  expect(payload.to).toBe('user@example.com');
  expect(payload.subject).toContain('Test App');
  expect(payload.html).toContain('/api/auth/magic-link/verify?token=');
  expect(payload.text).toContain('/api/auth/magic-link/verify?token=');
});
