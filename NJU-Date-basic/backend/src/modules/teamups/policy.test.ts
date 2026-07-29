import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError, ValidationError } from '../../utils/errors.js';
import {
  buildDescriptionPreview,
  containsContactLikeText,
  getEffectiveStatus,
  isJoinable,
  isWaitlistable,
  normalizeContacts,
  normalizeDescription,
  normalizeTeamupType,
  validateTimeWindow,
} from './policy.js';

function futureIso(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function pastIso(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

test('teamup policy normalizes contacts and rejects invalid payloads', () => {
  assert.deepEqual(normalizeContacts([
    { type: ' wechat ', value: ' nju-date ', label: ' 微信 ' },
  ]), [
    { type: 'wechat', value: 'nju-date', label: '微信' },
  ]);

  assert.throws(() => normalizeContacts([]), AppError);
  assert.throws(() => normalizeContacts([{ type: ' ', value: 'x' }]), ValidationError);
});

test('teamup policy blocks contact-like description text', () => {
  assert.equal(containsContactLikeText('微信: nju_date_2026'), true);
  assert.equal(containsContactLikeText('一起复习软件工程'), false);
  assert.throws(() => normalizeDescription('手机号 13812345678'), AppError);
  assert.equal(buildDescriptionPreview('联系我 微信: abc123 一起复习'), '联系我 [联系方式已隐藏] 一起复习');
});

test('teamup policy evaluates status and joinability', () => {
  const recruiting = {
    status: 'recruiting',
    deadlineAt: futureIso(1),
    endAt: futureIso(2),
    currentMemberCount: 1,
    maxMembers: 2,
  };

  assert.equal(getEffectiveStatus(recruiting), 'recruiting');
  assert.equal(isJoinable(recruiting), true);
  assert.equal(isWaitlistable({ ...recruiting, currentMemberCount: 2 }), true);
  assert.equal(getEffectiveStatus({ ...recruiting, deadlineAt: pastIso(1) }), 'expired');
  assert.equal(getEffectiveStatus({ ...recruiting, endAt: pastIso(1) }), 'ended');
});

test('teamup policy validates time windows and teamup type', () => {
  assert.equal(normalizeTeamupType('short_term'), 'short_term');
  assert.throws(() => normalizeTeamupType('weekly'), ValidationError);
  assert.doesNotThrow(() => validateTimeWindow(futureIso(1), futureIso(2)));
  assert.throws(() => validateTimeWindow(pastIso(1), futureIso(2)), AppError);
  assert.throws(() => validateTimeWindow(futureIso(2), futureIso(1)), AppError);
});
