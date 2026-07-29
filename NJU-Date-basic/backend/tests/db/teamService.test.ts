import test, { after, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';
import { db } from '../../src/db/connection.js';
import {
  teamupApplications,
  teamupMembers,
  teamups,
} from '../../src/db/schema.js';
import { AppError } from '../../src/utils/errors.js';
import {
  createTeamup,
  getTeamupContacts,
  joinTeamupDirect,
  leaveTeamup,
  type CreateTeamupInput,
  type TeamupContactInput,
} from '../../src/modules/teamups/flow.js';
import {
  cleanupTestData,
  closeDb,
  futureIso,
  pastIso,
  seedCircle,
  seedUsers,
  testId,
} from './helpers.js';

beforeEach(cleanupTestData);
afterEach(cleanupTestData);
after(closeDb);

async function seedTeamRoom(suffix: string) {
  const users = await seedUsers(suffix, ['leader', 'b', 'c', 'outsider']);
  const circleId = await seedCircle(suffix, [users.leader, users.b, users.c]);
  return { users, circleId };
}

function createInput(suffix: string, overrides: Partial<CreateTeamupInput> = {}): CreateTeamupInput {
  return {
    title: `${suffix} 期末复习小队`,
    description: '一起复习软件工程，不在描述里放联系方式',
    maxMembers: 2,
    deadlineAt: futureIso(1),
    endAt: futureIso(5),
    teamupType: 'short_term',
    joinMode: 'direct',
    isPublic: false,
    contacts: [{ type: 'wechat', label: '微信', value: `${suffix}_leader_wx` }],
    ...overrides,
  };
}

function contact(type: string, value: string): TeamupContactInput[] {
  return [{ type, label: type, value }];
}

async function assertAppError(
  action: () => Promise<unknown>,
  expected: { statusCode: number; code: string },
) {
  await assert.rejects(
    action,
    (err: unknown) => {
      assert.equal(err instanceof AppError, true);
      const appError = err as AppError;
      assert.equal(appError.statusCode, expected.statusCode);
      assert.equal(appError.code, expected.code);
      return true;
    },
  );
}

test('teamService db: createTeamup creates teamup, leader member, and encrypted contact payload', async () => {
  const { users, circleId } = await seedTeamRoom('team-create');

  const result = await createTeamup(users.leader, circleId, createInput('team-create'));

  assert.equal(result.message, '组队已发布');
  assert.equal(result.teamup.currentMemberCount, 1);
  assert.equal(result.teamup.leader?.userId, users.leader);

  const teamupRows = await db.select().from(teamups)
    .where(eq(teamups.id, result.teamup.id));
  assert.equal(teamupRows.length, 1);
  assert.equal(teamupRows[0].title, 'team-create 期末复习小队');

  const memberRows = await db.select().from(teamupMembers)
    .where(and(eq(teamupMembers.teamupId, result.teamup.id), eq(teamupMembers.userId, users.leader)));
  assert.equal(memberRows.length, 1);
  assert.equal(memberRows[0].memberRole, 'leader');
  assert.equal(memberRows[0].membershipStatus, 'active');
});

test('teamService db: joinTeamupDirect joins until full, waitlists overflow, and leaveTeamup promotes waitlist', async () => {
  const { users, circleId } = await seedTeamRoom('team-waitlist');
  const created = await createTeamup(users.leader, circleId, createInput('team-waitlist'));

  const joined = await joinTeamupDirect(users.b, circleId, created.teamup.id, contact('phone', '13812345678'));
  assert.equal(joined.message, '已加入组队');
  assert.equal(joined.currentMemberCount, 2);
  assert.equal(joined.status, 'full');

  const waitlisted = await joinTeamupDirect(users.c, circleId, created.teamup.id, contact('email', 'candidate@example.com'));
  assert.equal(waitlisted.message, '候补已登记');
  assert.equal(waitlisted.currentMemberCount, 2);
  assert.equal(waitlisted.status, 'full');
  assert.equal(waitlisted.application?.applicationType, 'waitlist');
  assert.equal(waitlisted.application?.waitlistPosition, 1);

  const cBeforePromotion = await db.select().from(teamupMembers)
    .where(and(eq(teamupMembers.teamupId, created.teamup.id), eq(teamupMembers.userId, users.c)));
  assert.equal(cBeforePromotion.length, 0);

  const leaveResult = await leaveTeamup(users.b, circleId, created.teamup.id);
  assert.equal(leaveResult.currentMemberCount, 2);
  assert.equal(leaveResult.status, 'full');

  const memberRows = await db.select().from(teamupMembers)
    .where(and(eq(teamupMembers.teamupId, created.teamup.id), eq(teamupMembers.userId, users.c)));
  assert.equal(memberRows.length, 1);
  assert.equal(memberRows[0].membershipStatus, 'active');

  const applicationRows = await db.select().from(teamupApplications)
    .where(eq(teamupApplications.id, waitlisted.application!.id));
  assert.equal(applicationRows[0].status, 'approved');
  assert.equal(Boolean(applicationRows[0].waitlistJoinedAt), true);

  await db.update(teamups)
    .set({ deadlineAt: pastIso(1), updatedAt: new Date().toISOString() })
    .where(eq(teamups.id, created.teamup.id));

  const contacts = await getTeamupContacts(users.c, circleId, created.teamup.id);
  assert.deepEqual(
    contacts.members.map((member) => member.userId).sort(),
    [users.c, users.leader].sort(),
  );
  const leaderContacts = contacts.members.find((member) => member.userId === users.leader)?.contacts ?? [];
  const cContacts = contacts.members.find((member) => member.userId === users.c)?.contacts ?? [];
  assert.equal(leaderContacts[0].value, 'team-waitlist_leader_wx');
  assert.equal(cContacts[0].value, 'candidate@example.com');
});

test('teamService db: leader cannot leave directly', async () => {
  const { users, circleId } = await seedTeamRoom('team-leader-leave');
  const created = await createTeamup(users.leader, circleId, createInput('team-leader-leave'));

  await assertAppError(
    () => leaveTeamup(users.leader, circleId, created.teamup.id),
    { statusCode: 409, code: 'LEADER_LEAVE_REQUIRES_CANCEL' },
  );
});

test('teamService db: getTeamupContacts rejects non-members', async () => {
  const { users, circleId } = await seedTeamRoom('team-contact-permission');
  const created = await createTeamup(users.leader, circleId, createInput('team-contact-permission', {
    deadlineAt: futureIso(1),
  }));
  await db.update(teamups)
    .set({ deadlineAt: pastIso(1), updatedAt: new Date().toISOString() })
    .where(eq(teamups.id, created.teamup.id));

  await assertAppError(
    () => getTeamupContacts(users.outsider, circleId, created.teamup.id),
    { statusCode: 403, code: 'JOIN_CIRCLE_REQUIRED' },
  );
});
