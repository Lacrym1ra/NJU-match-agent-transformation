import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProjectBDemoFixtures, PROJECT_B_DEMO_RECORD_IDS } from './projectBDemoFixtures.js';

test('Project B demo fixtures cover every capsule and meetup lifecycle state', () => {
  const now = new Date('2026-08-11T08:00:00.000Z');
  const fixtures = buildProjectBDemoFixtures(now);

  assert.deepEqual(
    new Set(fixtures.capsules.map((capsule) => capsule.status)),
    new Set(['awaiting_participant', 'collecting', 'revealed', 'cancelled']),
  );
  assert.deepEqual(
    new Set(fixtures.meetups.map((plan) => plan.scenario)),
    new Set(['scheduled', 'checked_in', 'completed', 'overdue', 'cancelled']),
  );
});

test('Project B demo fixtures are deterministic, valid, and safe to reset by id', () => {
  const fixtures = buildProjectBDemoFixtures(new Date('2026-08-11T08:00:00.000Z'));
  const allIds = [
    ...fixtures.capsules.map((capsule) => capsule.id),
    ...fixtures.meetups.map((plan) => plan.id),
  ];

  assert.equal(new Set(allIds).size, allIds.length);
  assert.deepEqual(new Set(allIds), new Set(PROJECT_B_DEMO_RECORD_IDS));
  assert.ok(allIds.every((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/.test(id)));
  assert.ok(fixtures.capsules.every((capsule) => /^[A-HJ-NP-Z2-9]{8}$/.test(capsule.inviteCode)));
  assert.ok(fixtures.capsules.every((capsule) => capsule.creatorEmail !== capsule.participantEmail));
  assert.ok(fixtures.meetups.every((plan) => Date.parse(plan.expectedEndAt) > Date.parse(plan.meetingAt)));

  const overdue = fixtures.meetups.find((plan) => plan.scenario === 'overdue');
  assert.equal(overdue?.storedStatus, 'scheduled');
  assert.ok(Date.parse(overdue?.expectedEndAt ?? '') < Date.parse('2026-08-11T08:00:00.000Z'));
});
