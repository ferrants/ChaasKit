import request from 'supertest';
import { vi } from 'vitest';
import { createTestApp, uniqueEmail } from '../../__tests__/test-utils.js';

vi.mock('../../services/agent.js', async () => {
  const actual = await vi.importActual<typeof import('../../services/agent.js')>('../../services/agent.js');
  return {
    ...actual,
    createAgentService: () => ({
      chat: async function* () {
        yield { type: 'text', content: 'Hello from mock agent.' };
        yield { type: 'usage', usage: { inputTokens: 5, outputTokens: 7 } };
        yield { type: 'stop', stopReason: 'end_turn' };
      },
    }),
  };
});

async function createAuthedAgent(app: ReturnType<typeof createTestApp>) {
  const agent = request.agent(await app);
  const email = uniqueEmail('chat-credits');
  await agent.post('/api/auth/register').send({ email, password: 'password123' });
  return { agent, email };
}

test('chat succeeds when payments + credits are enabled (mocked agent)', async () => {
  const appPromise = createTestApp({
    payments: {
      enabled: true,
      provider: 'stripe',
      plans: [
        {
          id: 'free',
          name: 'Free',
          type: 'free',
          scope: 'both',
          params: { monthlyMessageLimit: 10 },
        },
      ],
    },
    credits: {
      enabled: true,
      expiryEnabled: false,
      tokensPerCredit: 1000,
      referralRewardCredits: 10,
      referralTriggers: { signup: false, firstMessage: false, paying: false },
      promoEnabled: true,
    },
  });

  const { agent } = await createAuthedAgent(appPromise);

  const response = await agent.post('/api/chat').send({ content: 'Hello world' });

  expect(response.status).toBe(200);
  expect(response.text).toContain('"type":"done"');
});
