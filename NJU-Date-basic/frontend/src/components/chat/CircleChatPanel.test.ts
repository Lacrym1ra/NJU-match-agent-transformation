import test from 'node:test';
import assert from 'node:assert/strict';
import type { ChatMessage } from '../../api/chat';
import { createClientMessageId, formatMessageTime, mergeMessage } from './CircleChatPanel';

function makeMessage(id: string, createdAt: string, content = id): ChatMessage {
  return {
    id,
    roomType: 'circle',
    circleId: 'circle-1',
    sender: {
      userId: `user-${id}`,
      nickname: `User ${id}`,
      avatarUrl: null,
    },
    content,
    mentions: [],
    createdAt,
    updatedAt: null,
    deletedAt: null,
    isOwn: false,
  };
}

test('CircleChatPanel helpers merge realtime messages without rendering chat', () => {
  const older = makeMessage('older', '2026-06-05T08:00:00.000Z');
  const newer = makeMessage('newer', '2026-06-05T09:00:00.000Z');
  const inserted = mergeMessage([newer], older);

  assert.deepEqual(inserted.map((message) => message.id), ['older', 'newer']);

  const updated = mergeMessage(inserted, makeMessage('older', '2026-06-05T08:00:00.000Z', 'edited'));
  assert.equal(updated.length, 2);
  assert.equal(updated[0].content, 'edited');
});

test('CircleChatPanel helpers format invalid times and generate ids', () => {
  assert.equal(formatMessageTime('not-a-date'), '');
  assert.match(createClientMessageId(), /^(chat-|[0-9a-f-]{36})/i);
});
