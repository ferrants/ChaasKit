import type Stripe from 'stripe';

const sendEmailMock = vi.hoisted(() => vi.fn().mockResolvedValue({ messageId: 'msg-1' }));
const dbMocks = vi.hoisted(() => ({
  team: { findFirst: vi.fn() },
  teamMember: { findMany: vi.fn() },
  user: { findFirst: vi.fn() },
}));

vi.mock('../../config/loader.js', () => ({
  getConfig: () => ({
    app: { name: 'Test App', url: 'http://localhost:5173' },
  }),
}));

vi.mock('../../services/email/index.js', () => ({
  isEmailEnabled: () => true,
  sendEmail: (...args: unknown[]) => sendEmailMock(...args),
  generatePaymentFailedEmailHtml: () => '<html>payment failed</html>',
  generatePaymentFailedEmailText: () => 'payment failed',
}));

vi.mock('@chaaskit/db', () => ({
  db: dbMocks,
}));

beforeEach(() => {
  sendEmailMock.mockClear();
  dbMocks.team.findFirst.mockReset();
  dbMocks.teamMember.findMany.mockReset();
  dbMocks.user.findFirst.mockReset();
});

test('sends payment failed email to team owners', async () => {
  const { notifyPaymentFailed } = await import('../payments.js');
  dbMocks.team.findFirst.mockResolvedValue({
    id: 'team-1',
    name: 'Acme',
    members: [{ user: { email: 'owner@example.com', name: 'Owner' } }],
  });

  const invoice = {
    customer: 'cus_team',
    amount_due: 2500,
    currency: 'usd',
    hosted_invoice_url: 'http://invoice.test',
  } as Stripe.Invoice;

  await notifyPaymentFailed(invoice);

  expect(sendEmailMock).toHaveBeenCalledTimes(1);
  const payload = sendEmailMock.mock.calls[0][0] as { to: string[]; subject: string };
  expect(payload.to).toEqual(['owner@example.com']);
  expect(payload.subject).toContain('Payment failed');
});

test('sends payment failed email to user when no team', async () => {
  const { notifyPaymentFailed } = await import('../payments.js');
  dbMocks.team.findFirst.mockResolvedValue(null);
  dbMocks.user.findFirst.mockResolvedValue({ email: 'user@example.com' });

  const invoice = {
    customer: 'cus_user',
    amount_due: 1200,
    currency: 'usd',
    hosted_invoice_url: null,
  } as Stripe.Invoice;

  await notifyPaymentFailed(invoice);

  expect(sendEmailMock).toHaveBeenCalledTimes(1);
  const payload = sendEmailMock.mock.calls[0][0] as { to: string[] };
  expect(payload.to).toEqual(['user@example.com']);
});
