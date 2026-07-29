import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildContactUnlockRequestPayload,
  mapContactUnlockReply,
  mapContactUnlockRequest,
} from './unlockTransforms';

test('contact unlock transform maps inbox requests and fallback labels', () => {
  assert.deepEqual(mapContactUnlockRequest({
    requestId: 'req-1',
    sourceType: 'address_book',
    requester: { userId: 'user-1', nickname: null, avatarUrl: null },
    status: 'pending',
    createdAt: '2026-06-05T00:00:00.000Z',
  }), {
    request_id: 'req-1',
    user_id: 'user-1',
    nickname: '神秘同窗',
    avatar_url: undefined,
    message: undefined,
    circle_id: undefined,
    circle_name: undefined,
    source_type: 'address_book',
    field_key: undefined,
    source_label: '同窗名录',
    card_preview: undefined,
    status: 'pending',
    expires_at: undefined,
    revoked_at: undefined,
    created_at: '2026-06-05T00:00:00.000Z',
  });
});

test('contact unlock transform maps replies and builds legacy-compatible payloads', () => {
  assert.equal(
    buildContactUnlockRequestPayload({ targetUserId: 'target', sourceType: 'circle', circleId: 'circle-1' }).fieldKey,
    'contact_primary',
  );
  assert.equal(
    buildContactUnlockRequestPayload({
      targetUserId: 'target',
      sourceType: 'circle',
      circleId: 'circle-1',
      fieldKey: 'wechat',
    }).fieldKey,
    'wechat',
  );

  const reply = mapContactUnlockReply({
    requestId: 'req-2',
    circleId: 'circle-1',
    circleName: '算法圈',
    sourceType: 'circle',
    fieldKey: 'wechat',
    target: { userId: 'user-2', nickname: '小北', avatarUrl: null },
    status: 'approved',
    message: 'ok',
    createdAt: '2026-06-05T00:00:00.000Z',
    respondedAt: '2026-06-05T01:00:00.000Z',
  });

  assert.equal(reply.nickname, '小北');
  assert.equal(reply.source_label, '算法圈');
  assert.equal(reply.responded_at, '2026-06-05T01:00:00.000Z');
});
