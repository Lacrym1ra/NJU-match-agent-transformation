import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVE_MATCH_STATUSES, canSetSignalIn24h, isActiveMainlineStatus } from './heartboxPolicy.js';

test('ACTIVE_MATCH_STATUSES remains expected contract', () => {
  assert.deepEqual(ACTIVE_MATCH_STATUSES, ['LOCKED', 'REVEALED', 'MUTUAL']);
});

test('isActiveMainlineStatus accepts only active statuses', () => {
  assert.equal(isActiveMainlineStatus('LOCKED'), true);
  assert.equal(isActiveMainlineStatus('REVEALED'), true);
  assert.equal(isActiveMainlineStatus('MUTUAL'), true);
  assert.equal(isActiveMainlineStatus('MISSED'), false);
  assert.equal(isActiveMainlineStatus('EXPIRED'), false);
});

test('canSetSignalIn24h enforces one-change-per-day gate', () => {
  assert.equal(canSetSignalIn24h(0), true);
  assert.equal(canSetSignalIn24h(1), false);
  assert.equal(canSetSignalIn24h(100), false);
});

