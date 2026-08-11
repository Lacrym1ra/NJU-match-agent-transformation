import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach } from 'node:test';
import { eq } from 'drizzle-orm';
import { cleanupTestData, closeDb, futureIso, seedUsers } from './helpers.js';
import { db } from '../../src/db/connection.js';
import { agentActionRecords } from '../../src/db/schema.js';
import {
  createResonanceCapsule, getResonanceCapsule, joinResonanceCapsule,
  listResonanceCapsules, respondToResonanceCapsule,
} from '../../src/services/resonanceService.js';
import {
  createMeetupSafetyPlan, getMeetupSafetyPlan, listMeetupSafetyPlans,
  transitionMeetupSafetyPlan,
} from '../../src/services/meetupSafetyService.js';
import { agentActionService } from '../../src/services/agentActionService.js';

beforeEach(cleanupTestData);
afterEach(cleanupTestData);
after(closeDb);

test('Project B db: resonance answers remain sealed until both users respond', async () => {
  const users = await seedUsers('project-b-resonance', ['creator', 'guest']);
  const created = await createResonanceCapsule(users.creator, {
    title: '慢慢认识', prompt: '什么让你感到安心？', expiresInDays: 7,
  });
  await joinResonanceCapsule(users.guest, created.inviteCode);
  await respondToResonanceCapsule(users.creator, created.capsule.id, '我喜欢被认真倾听。');

  const guestBefore = await getResonanceCapsule(users.guest, created.capsule.id);
  assert.equal(guestBefore.capsule.isRevealed, false);
  assert.equal(guestBefore.capsule.otherResponse, null);

  await respondToResonanceCapsule(users.guest, created.capsule.id, '我喜欢清楚而坦诚的表达。');
  const creatorAfter = await getResonanceCapsule(users.creator, created.capsule.id);
  assert.equal(creatorAfter.capsule.isRevealed, true);
  assert.equal(creatorAfter.capsule.myResponse, '我喜欢被认真倾听。');
  assert.equal(creatorAfter.capsule.otherResponse, '我喜欢清楚而坦诚的表达。');
});

test('Project B db: meetup plan enforces owner-only manual check-in before completion', async () => {
  const users = await seedUsers('project-b-safety', ['owner', 'outsider']);
  const created = await createMeetupSafetyPlan(users.owner, {
    title: '先锋书店见面', meetingPlace: '广州路先锋书店',
    meetingAt: futureIso(1), expectedEndAt: futureIso(1.1), note: '抵达后手动签到',
  });

  await assert.rejects(() => getMeetupSafetyPlan(users.outsider, created.plan.id));
  await assert.rejects(() => transitionMeetupSafetyPlan(users.owner, created.plan.id, 'complete'));
  const checkedIn = await transitionMeetupSafetyPlan(users.owner, created.plan.id, 'check_in');
  assert.equal(checkedIn.plan.status, 'checked_in');
  const completed = await transitionMeetupSafetyPlan(users.owner, created.plan.id, 'complete');
  assert.equal(completed.plan.status, 'completed');
});

test('Project B db: Agent creates both new-module records only after single-use confirmation', async () => {
  const users = await seedUsers('project-b-agent', ['owner']);
  const resonanceDraft = await agentActionService.createAction(users.owner, 'create_resonance_capsule', {
    title: '慢慢认识', prompt: '哪个瞬间让你感到被理解？', expiresInDays: 7,
  });
  await assert.rejects(() => agentActionService.executeAction(
    users.owner, resonanceDraft.actionId, 'create_resonance_capsule', 'not-confirmed',
  ));
  assert.equal((await listResonanceCapsules(users.owner)).capsules.length, 0);

  const resonanceConfirmation = await agentActionService.requestConfirmation(
    users.owner, 'create_resonance_capsule', resonanceDraft.actionId,
  );
  const resonanceResult = await agentActionService.executeAction(
    users.owner, resonanceDraft.actionId, 'create_resonance_capsule',
    resonanceConfirmation.confirmationToken,
  ) as { inviteCode: string };
  assert.equal(resonanceResult.inviteCode.length, 8);
  assert.equal((await listResonanceCapsules(users.owner)).capsules.length, 1);
  await assert.rejects(() => agentActionService.executeAction(
    users.owner, resonanceDraft.actionId, 'create_resonance_capsule',
    resonanceConfirmation.confirmationToken,
  ));

  const [storedAction] = await db.select().from(agentActionRecords)
    .where(eq(agentActionRecords.id, resonanceDraft.actionId)).limit(1);
  assert.equal(JSON.stringify(storedAction?.result).includes(resonanceResult.inviteCode), false);
  assert.equal((storedAction?.result as Record<string, unknown>)?.inviteCodeDeliveredToUser, true);

  const safetyDraft = await agentActionService.createAction(users.owner, 'create_meetup_safety_plan', {
    title: '先锋书店见面', meetingPlace: '广州路先锋书店',
    meetingAt: futureIso(2), expectedEndAt: futureIso(2.1), note: '抵达后由本人签到',
  });
  const safetyConfirmation = await agentActionService.requestConfirmation(
    users.owner, 'create_meetup_safety_plan', safetyDraft.actionId,
  );
  await agentActionService.executeAction(
    users.owner, safetyDraft.actionId, 'create_meetup_safety_plan',
    safetyConfirmation.confirmationToken,
  );
  assert.equal((await listMeetupSafetyPlans(users.owner)).plans.length, 1);
});
