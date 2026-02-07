import request from 'supertest';
import { prisma } from '@chaaskit/db';
import { createTestApp, uniqueEmail } from '../../__tests__/test-utils.js';

afterAll(async () => {
  await prisma.$disconnect();
});

async function createAuthedAgent(
  app: ReturnType<typeof createTestApp>,
  prefix: string
) {
  const agent = request.agent(await app);
  const email = uniqueEmail(prefix);
  const registerRes = await agent.post('/api/auth/register').send({
    email,
    password: 'password123',
  });

  return { agent, userId: registerRes.body.user.id as string, email };
}

test('admin can invite member; viewer cannot', async () => {
  const appPromise = createTestApp({
    teams: { enabled: true },
  });

  const owner = await createAuthedAgent(appPromise, 'invite-owner');
  const viewer = await createAuthedAgent(appPromise, 'invite-viewer');

  const teamRes = await owner.agent.post('/api/teams').send({ name: 'Invite Team' });
  const teamId = teamRes.body.team.id as string;

  await prisma.teamMember.create({
    data: {
      teamId,
      userId: viewer.userId,
      role: 'viewer',
    },
  });

  const viewerInvite = await viewer.agent
    .post(`/api/teams/${teamId}/invite`)
    .send({ email: uniqueEmail('invitee'), role: 'member' });
  expect(viewerInvite.status).toBe(403);

  const ownerInvite = await owner.agent
    .post(`/api/teams/${teamId}/invite`)
    .send({ email: uniqueEmail('invitee'), role: 'member' });
  expect(ownerInvite.status).toBe(201);
  expect(ownerInvite.body.invite).toBeTruthy();
  expect(ownerInvite.body.inviteUrl).toContain('/invite/');
});

test('invite can be accepted by the invited user', async () => {
  const appPromise = createTestApp({
    teams: { enabled: true },
  });

  const owner = await createAuthedAgent(appPromise, 'accept-owner');

  const teamRes = await owner.agent.post('/api/teams').send({ name: 'Accept Team' });
  const teamId = teamRes.body.team.id as string;

  const invitedEmail = uniqueEmail('invitee');
  const inviteRes = await owner.agent
    .post(`/api/teams/${teamId}/invite`)
    .send({ email: invitedEmail, role: 'member' });

  const token = inviteRes.body.invite.token as string;

  const invitedUser = await createAuthedAgent(appPromise, 'invitee');
  await prisma.user.update({
    where: { id: invitedUser.userId },
    data: { email: invitedEmail },
  });

  const acceptRes = await invitedUser.agent.post(`/api/teams/invite/${token}/accept`);
  expect(acceptRes.status).toBe(200);
  expect(acceptRes.body.team.id).toBe(teamId);

  const membership = await prisma.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId,
        userId: invitedUser.userId,
      },
    },
  });
  expect(membership).toBeTruthy();
});

test('owner can update member role; admin cannot remove another admin', async () => {
  const appPromise = createTestApp({
    teams: { enabled: true },
  });

  const owner = await createAuthedAgent(appPromise, 'role-owner');
  const adminA = await createAuthedAgent(appPromise, 'role-admin-a');
  const adminB = await createAuthedAgent(appPromise, 'role-admin-b');

  const teamRes = await owner.agent.post('/api/teams').send({ name: 'Role Team' });
  const teamId = teamRes.body.team.id as string;

  await prisma.teamMember.createMany({
    data: [
      { teamId, userId: adminA.userId, role: 'admin' },
      { teamId, userId: adminB.userId, role: 'admin' },
    ],
  });

  const updateRes = await owner.agent
    .patch(`/api/teams/${teamId}/members/${adminA.userId}`)
    .send({ role: 'member' });
  expect(updateRes.status).toBe(200);
  expect(updateRes.body.member.role).toBe('member');

  const removeRes = await adminA.agent.delete(`/api/teams/${teamId}/members/${adminB.userId}`);
  expect(removeRes.status).toBe(403);
});

test('owner cannot leave team; member can leave', async () => {
  const appPromise = createTestApp({
    teams: { enabled: true },
  });

  const owner = await createAuthedAgent(appPromise, 'leave-owner');
  const member = await createAuthedAgent(appPromise, 'leave-member');

  const teamRes = await owner.agent.post('/api/teams').send({ name: 'Leave Team' });
  const teamId = teamRes.body.team.id as string;

  await prisma.teamMember.create({
    data: {
      teamId,
      userId: member.userId,
      role: 'member',
    },
  });

  const ownerLeave = await owner.agent.post(`/api/teams/${teamId}/leave`);
  expect(ownerLeave.status).toBe(400);

  const memberLeave = await member.agent.post(`/api/teams/${teamId}/leave`);
  expect(memberLeave.status).toBe(204);

  const membership = await prisma.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId,
        userId: member.userId,
      },
    },
  });
  expect(membership).toBeNull();
});
