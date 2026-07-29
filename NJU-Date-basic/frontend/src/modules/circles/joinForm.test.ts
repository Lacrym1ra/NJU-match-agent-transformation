import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildJoinCirclePayload,
  getJoinFormError,
  getJoinPolicyMode,
  normalizeJoinAnswers,
} from './joinForm';

test('circle join form policy validates invite and required answers', () => {
  assert.equal(getJoinPolicyMode(undefined), 'public');
  assert.equal(getJoinPolicyMode({ mode: 'invite' }), 'invite');
  assert.equal(getJoinFormError({
    joinPolicy: 'invite',
    inviteCode: '  ',
    questions: [],
    answers: {},
  }), '请输入邀请码');
  assert.equal(getJoinFormError({
    joinPolicy: 'review',
    inviteCode: '',
    questions: [{ id: 'q1', question: '为什么想加入？', required: true }],
    answers: { q1: '   ' },
  }), '请填写：为什么想加入？');
});

test('circle join form policy trims answers and builds payload', () => {
  assert.deepEqual(normalizeJoinAnswers({ q1: '  hello ', q2: ' ' }), { q1: 'hello' });
  assert.deepEqual(
    buildJoinCirclePayload({
      inviteCode: ' code-1 ',
      applicationReason: ' 想一起学习 ',
      answers: { q1: '  answer ', q2: ' ' },
    }),
    {
      inviteCode: 'code-1',
      applicationReason: '想一起学习',
      answers: { q1: 'answer' },
      answer: 'answer',
    },
  );
});
