import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mapAcceptedFriendRequest,
  mapFriendRequest,
  mapSentFriendRequest,
} from './requestTransforms';

test('friend request transform maps incoming and accepted requests', () => {
  assert.deepEqual(mapFriendRequest({
    requestId: 'req-1',
    sender: { userId: 'user-1', nickname: '小南', avatarUrl: 'avatar.png', gender: 'x' },
    message: 'hello',
    circleId: 'circle-1',
    circleName: '算法圈',
    createdAt: '2026-06-05T00:00:00.000Z',
  }), {
    request_id: 'req-1',
    user_id: 'user-1',
    nickname: '小南',
    avatar_url: 'avatar.png',
    gender: 'x',
    message: 'hello',
    circle_id: 'circle-1',
    circle_name: '算法圈',
    card_preview: undefined,
    status: 'pending',
    expires_at: undefined,
    created_at: '2026-06-05T00:00:00.000Z',
  });

  const accepted = mapAcceptedFriendRequest({
    requestId: 'req-2',
    responder: { userId: 'user-2', nickname: '小北', avatarUrl: null },
    status: 'accepted',
    created_at: 'legacy-created',
    responded_at: 'legacy-responded',
  } as any);

  assert.equal(accepted.user_id, 'user-2');
  assert.equal(accepted.created_at, 'legacy-created');
  assert.equal(accepted.responded_at, 'legacy-responded');
});

test('friend request transform maps sent requests with fallback target shapes', () => {
  const sent = mapSentFriendRequest({
    requestId: 'req-3',
    receiver: { userId: 'user-3' },
    nickname: 'fallback',
    createdAt: '2026-06-05T00:00:00.000Z',
  });

  assert.equal(sent.user_id, 'user-3');
  assert.equal(sent.nickname, 'fallback');
  assert.equal(sent.status, 'pending');
});
