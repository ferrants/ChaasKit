import request from 'supertest';
import { db } from '@chaaskit/db';
import { createTestApp, uniqueEmail } from '../../__tests__/test-utils.js';

async function createAuthedAgent(app: ReturnType<typeof createTestApp>) {
  const agent = request.agent(await app);
  const email = uniqueEmail('credits');
  await agent.post('/api/auth/register').send({ email, password: 'password123' });
  return { agent, email };
}

test('promo code redemption grants credits and enforces one-time use', async () => {
  const appPromise = createTestApp({
    credits: {
      enabled: true,
      promoEnabled: true,
      expiryEnabled: false,
      tokensPerCredit: 1000,
      referralRewardCredits: 10,
      referralTriggers: { signup: false, firstMessage: false, paying: false },
    },
  });

  const { agent } = await createAuthedAgent(appPromise);

  const promoCode = `WELCOME10-${Date.now()}`;
  const promo = await db.promoCode.create({
    data: {
      code: promoCode,
      credits: 10,
      maxUses: 5,
    },
  });

  const first = await agent.post('/api/credits/redeem').send({ code: promo.code });
  expect(first.status).toBe(200);
  expect(first.body.granted).toBe(10);

  const second = await agent.post('/api/credits/redeem').send({ code: promo.code });
  expect(second.status).toBe(400);
});
