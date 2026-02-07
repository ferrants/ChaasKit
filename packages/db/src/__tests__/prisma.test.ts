import { prisma } from '../index.js';

afterAll(async () => {
  await prisma.$disconnect();
});

test('prisma can connect and write to Postgres test database', async () => {
  const user = await prisma.user.create({
    data: {
      email: `test-${Date.now()}@example.com`,
    },
  });

  expect(user.id).toBeTruthy();
});
