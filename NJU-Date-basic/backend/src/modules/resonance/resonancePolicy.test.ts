import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deriveResonanceState,
  normalizeInviteCode,
  redactResonanceCapsule,
  validateResonanceResponse,
} from './resonancePolicy.js';

test('invite codes are normalized without accepting ambiguous punctuation', () => {
  assert.equal(normalizeInviteCode(' abcd-2345 '), 'ABCD2345');
  assert.throws(() => normalizeInviteCode('bad/code'));
});

test('capsule is revealed only after both participants have answered', () => {
  assert.equal(deriveResonanceState(null, null, false), 'awaiting_participant');
  assert.equal(deriveResonanceState(null, null, true), 'collecting');
  assert.equal(deriveResonanceState('creator', null, true), 'collecting');
  assert.equal(deriveResonanceState('creator', 'guest', true), 'revealed');
});

test('response validator rejects empty and oversized responses', () => {
  assert.equal(validateResonanceResponse('  我也想慢慢认识你。 '), '我也想慢慢认识你。');
  assert.throws(() => validateResonanceResponse('   '));
  assert.throws(() => validateResonanceResponse('x'.repeat(2001)));
});

test('one-sided responses are never exposed before reveal', () => {
  const hidden = redactResonanceCapsule({
    id: 'capsule-1', creatorId: 'u1', participantId: 'u2',
    creatorResponse: 'creator secret', participantResponse: null,
    status: 'collecting', title: '一次对话', prompt: '什么让你安心？',
  }, 'u2');
  assert.equal(hidden.myResponse, null);
  assert.equal(hidden.otherResponse, null);
  assert.equal(hidden.isRevealed, false);

  const revealed = redactResonanceCapsule({
    id: 'capsule-1', creatorId: 'u1', participantId: 'u2',
    creatorResponse: 'creator secret', participantResponse: 'participant secret',
    status: 'revealed', title: '一次对话', prompt: '什么让你安心？',
  }, 'u2');
  assert.equal(revealed.myResponse, 'participant secret');
  assert.equal(revealed.otherResponse, 'creator secret');
  assert.equal(revealed.isRevealed, true);
});
