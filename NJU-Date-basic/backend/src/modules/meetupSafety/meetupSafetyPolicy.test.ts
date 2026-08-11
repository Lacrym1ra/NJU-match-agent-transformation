import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertMeetupTransition,
  deriveMeetupStatus,
  validateMeetupWindow,
} from './meetupSafetyPolicy.js';

test('meetup window requires a future start and a later end', () => {
  const now = Date.parse('2026-08-11T10:00:00.000Z');
  assert.deepEqual(validateMeetupWindow(
    '2026-08-11T11:00:00.000Z', '2026-08-11T13:00:00.000Z', now,
  ), {
    meetingAt: '2026-08-11T11:00:00.000Z',
    expectedEndAt: '2026-08-11T13:00:00.000Z',
  });
  assert.throws(() => validateMeetupWindow(
    '2026-08-11T09:00:00.000Z', '2026-08-11T13:00:00.000Z', now,
  ));
  assert.throws(() => validateMeetupWindow(
    '2026-08-11T11:00:00.000Z', '2026-08-11T10:30:00.000Z', now,
  ));
});

test('scheduled plans become overdue in views but remain recoverable', () => {
  assert.equal(deriveMeetupStatus(
    'scheduled', '2026-08-11T12:00:00.000Z', Date.parse('2026-08-11T12:01:00.000Z'),
  ), 'overdue');
  assert.equal(deriveMeetupStatus(
    'checked_in', '2026-08-11T12:00:00.000Z', Date.parse('2026-08-11T13:00:00.000Z'),
  ), 'checked_in');
});

test('manual check-in is required before completion', () => {
  assert.doesNotThrow(() => assertMeetupTransition('scheduled', 'check_in'));
  assert.doesNotThrow(() => assertMeetupTransition('checked_in', 'complete'));
  assert.doesNotThrow(() => assertMeetupTransition('scheduled', 'cancel'));
  assert.throws(() => assertMeetupTransition('scheduled', 'complete'));
  assert.throws(() => assertMeetupTransition('completed', 'cancel'));
});
