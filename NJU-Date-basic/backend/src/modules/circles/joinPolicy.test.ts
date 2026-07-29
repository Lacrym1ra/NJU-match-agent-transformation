import test from 'node:test';
import assert from 'node:assert/strict';
import { ConflictError, ValidationError } from '../../utils/errors.js';
import {
  assertCircleCapacityAvailable,
  assertNoKeywordRuleHits,
  hashInviteCode,
  inviteCodeMatches,
  normalizeCapacityLimit,
  normalizeJoinApplication,
  normalizeJoinQuestions,
  normalizeKeywordRules,
  throwJoinCircleConflict,
} from './joinPolicy.js';

test('circle join policy normalizes capacity and keyword rules', () => {
  assert.equal(normalizeCapacityLimit(undefined), undefined);
  assert.equal(normalizeCapacityLimit(null), null);
  assert.equal(normalizeCapacityLimit(20), 20);
  assert.throws(() => normalizeCapacityLimit(0), ValidationError);

  assert.deepEqual(normalizeKeywordRules([
    { keyword: ' 代写 ', action: 'reject' },
    { keyword: '代写', action: 'reject' },
  ]), [{ keyword: '代写', action: 'reject' }]);
});

test('circle join policy validates questions and applications', () => {
  const questions = normalizeJoinQuestions([
    { id: ' why join? ', question: '为什么想加入？' },
  ]);
  assert.equal(questions[0]?.id, 'why_join_');

  const application = normalizeJoinApplication({
    joinQuestions: questions,
    keywordRules: [{ keyword: '广告', action: 'reject' }],
  }, {
    answers: { [questions[0]!.id]: '一起学习' },
    applicationReason: '找复习搭子',
  });
  assert.equal(application.applicationAnswer, '一起学习');
  assert.throws(() => normalizeJoinApplication({
    joinQuestions: questions,
  }, { answers: {} }), ValidationError);
  assert.throws(
    () => assertNoKeywordRuleHits([{ label: '申请理由', value: '我想发广告' }], [{ keyword: '广告', action: 'reject' }]),
    ValidationError,
  );
});

test('circle join policy handles invite, capacity and existing membership conflicts', () => {
  const inviteCodeHash = hashInviteCode('secret-code');
  assert.equal(inviteCodeMatches('secret-code', { inviteCodeHash }), true);
  assert.equal(inviteCodeMatches('wrong', { inviteCodeHash }), false);

  assert.doesNotThrow(() => assertCircleCapacityAvailable({ capacityLimit: 2, memberCount: 1 }));
  assert.throws(() => assertCircleCapacityAvailable({ capacityLimit: 2, memberCount: 2 }), ConflictError);
  assert.throws(() => throwJoinCircleConflict('pending'), ConflictError);
});
