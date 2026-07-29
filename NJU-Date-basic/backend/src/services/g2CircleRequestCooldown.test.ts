import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../utils/errors.js';
import {
  G2_CIRCLE_REQUEST_COOLDOWN_POLICY,
  assertG2CircleRequestCooldown,
  calculateG2CircleRequestRetryAt,
  getG2CircleRequestRejectWindowStart,
} from './g2CircleRequestCooldown.js';

test('G2 circle request cooldown policy stays aligned with anti-harassment contract', () => {
  assert.deepEqual(G2_CIRCLE_REQUEST_COOLDOWN_POLICY, {
    rejectLimit: 2,
    rejectWindowDays: 30,
    cooldownDays: 7,
  });
});

test('getG2CircleRequestRejectWindowStart returns the 30-day lookback boundary', () => {
  assert.equal(
    getG2CircleRequestRejectWindowStart(new Date('2026-05-30T12:00:00.000Z')),
    '2026-04-30T12:00:00.000Z',
  );
});

test('calculateG2CircleRequestRetryAt ignores rows below reject limit', () => {
  const retryAt = calculateG2CircleRequestRetryAt([
    { updatedAt: '2026-05-29T12:00:00.000Z' },
  ], new Date('2026-05-30T12:00:00.000Z'));

  assert.equal(retryAt, null);
});

test('calculateG2CircleRequestRetryAt uses latest valid rejection timestamp', () => {
  const retryAt = calculateG2CircleRequestRetryAt([
    { updatedAt: '2026-05-25T08:00:00.000Z' },
    { createdAt: '2026-05-28T10:30:00.000Z' },
  ], new Date('2026-05-30T12:00:00.000Z'));

  assert.equal(retryAt, '2026-06-04T10:30:00.000Z');
});

test('calculateG2CircleRequestRetryAt returns null after cooldown expires', () => {
  const retryAt = calculateG2CircleRequestRetryAt([
    { updatedAt: '2026-05-20T12:00:00.000Z' },
    { updatedAt: '2026-05-21T12:00:00.000Z' },
  ], new Date('2026-05-30T12:00:00.000Z'));

  assert.equal(retryAt, null);
});

test('calculateG2CircleRequestRetryAt ignores invalid rejection timestamps', () => {
  const retryAt = calculateG2CircleRequestRetryAt([
    { updatedAt: 'not-a-date' },
    { createdAt: '' },
  ], new Date('2026-05-30T12:00:00.000Z'));

  assert.equal(retryAt, null);
});

test('calculateG2CircleRequestRetryAt treats exact retry boundary as available', () => {
  const retryAt = calculateG2CircleRequestRetryAt([
    { updatedAt: '2026-05-23T12:00:00.000Z' },
    { updatedAt: '2026-05-22T12:00:00.000Z' },
  ], new Date('2026-05-30T12:00:00.000Z'));

  assert.equal(retryAt, null);
});

test('assertG2CircleRequestCooldown throws standard REQUEST_RATE_LIMITED error', () => {
  assert.throws(
    () => assertG2CircleRequestCooldown(
      [
        { updatedAt: '2026-05-28T12:00:00.000Z' },
        { updatedAt: '2026-05-29T12:00:00.000Z' },
      ],
      '圈子请求被拒绝次数较多，请稍后再试',
      new Date('2026-05-30T12:00:00.000Z'),
    ),
    (err: unknown) => {
      assert.equal(err instanceof AppError, true);
      const appError = err as AppError & { retryAt?: string };
      assert.equal(appError.statusCode, 429);
      assert.equal(appError.code, 'REQUEST_RATE_LIMITED');
      assert.equal(appError.message, '圈子请求被拒绝次数较多，请稍后再试');
      assert.equal(appError.retryAt, '2026-06-05T12:00:00.000Z');
      return true;
    },
  );
});
