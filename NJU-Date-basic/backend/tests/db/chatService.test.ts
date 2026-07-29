import test, { after, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';
import { db } from '../../src/db/connection.js';
import {
  circleChatMessages,
  circleChatReadStates,
} from '../../src/db/schema.js';
import { AppError } from '../../src/utils/errors.js';
import {
  deleteCircleChatMessage,
  listCircleChatMessages,
  sendCircleChatMessage,
  updateCircleChatReadState,
} from '../../src/modules/chat/circleChat.js';
import {
  cleanupTestData,
  closeDb,
  seedCircle,
  seedUsers,
  testId,
} from './helpers.js';

beforeEach(cleanupTestData);
afterEach(cleanupTestData);
after(closeDb);

async function seedChatRoom(suffix: string) {
  const users = await seedUsers(suffix, ['a', 'b', 'outsider']);
  const circleId = await seedCircle(suffix, [users.a, users.b]);
  return { users, circleId };
}

async function assertAppError(
  action: () => Promise<unknown>,
  expected: { statusCode: number; code: string },
) {
  await assert.rejects(
    action,
    (err: unknown) => {
      assert.equal(err instanceof AppError, true);
      const appError = err as AppError;
      assert.equal(appError.statusCode, expected.statusCode);
      assert.equal(appError.code, expected.code);
      return true;
    },
  );
}

test('chatService db: sendCircleChatMessage writes a visible message and listCircleChatMessages returns it to another member', async () => {
  const { users, circleId } = await seedChatRoom('chat-send');

  const sent = await sendCircleChatMessage(users.a, circleId, {
    clientMessageId: ' client-message-1 ',
    content: '  明早仙林见  ',
    mentions: [users.b, ` ${users.b} `, ''],
  });

  assert.equal(sent.content, '明早仙林见');
  assert.deepEqual(sent.mentions, [users.b]);
  assert.equal(sent.sender.userId, users.a);
  assert.equal(sent.isOwn, true);

  const rows = await db.select().from(circleChatMessages)
    .where(eq(circleChatMessages.id, sent.id));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].content, '明早仙林见');
  assert.equal(rows[0].status, 'visible');

  const historyForB = await listCircleChatMessages(users.b, circleId);
  assert.equal(historyForB.messages.length, 1);
  assert.equal(historyForB.messages[0].id, sent.id);
  assert.equal(historyForB.messages[0].content, '明早仙林见');
  assert.equal(historyForB.messages[0].isOwn, false);
});

test('chatService db: duplicate clientMessageId is idempotent', async () => {
  const { users, circleId } = await seedChatRoom('chat-dedup');
  const clientMessageId = testId('chat-dedup-client');

  const first = await sendCircleChatMessage(users.a, circleId, {
    clientMessageId,
    content: '第一条会落库',
  });
  const second = await sendCircleChatMessage(users.a, circleId, {
    clientMessageId,
    content: '重复提交不能新建消息',
  });

  assert.equal(second.id, first.id);
  assert.equal(second.content, '第一条会落库');
  const rows = await db.select().from(circleChatMessages)
    .where(and(
      eq(circleChatMessages.circleId, circleId),
      eq(circleChatMessages.senderId, users.a),
      eq(circleChatMessages.clientMessageId, clientMessageId),
    ));
  assert.equal(rows.length, 1);
});

test('chatService db: non-members cannot send or list circle chat history', async () => {
  const { users, circleId } = await seedChatRoom('chat-permission');

  await assertAppError(
    () => sendCircleChatMessage(users.outsider, circleId, {
      clientMessageId: testId('outsider-message'),
      content: '我不该进来',
    }),
    { statusCode: 403, code: 'FORBIDDEN' },
  );
  await assertAppError(
    () => listCircleChatMessages(users.outsider, circleId),
    { statusCode: 403, code: 'FORBIDDEN' },
  );
});

test('chatService db: deleteCircleChatMessage marks own message deleted and hides content in history', async () => {
  const { users, circleId } = await seedChatRoom('chat-delete');
  const sent = await sendCircleChatMessage(users.a, circleId, {
    clientMessageId: testId('delete-message'),
    content: '这条稍后删除',
  });

  const deleted = await deleteCircleChatMessage(users.a, circleId, sent.id);
  assert.equal(deleted.messageId, sent.id);

  const rows = await db.select().from(circleChatMessages)
    .where(eq(circleChatMessages.id, sent.id));
  assert.equal(rows[0].status, 'deleted');
  assert.equal(rows[0].deletedBy, users.a);
  assert.equal(Boolean(rows[0].deletedAt), true);

  const history = await listCircleChatMessages(users.b, circleId);
  assert.equal(history.messages.length, 1);
  assert.equal(history.messages[0].content, '');
  assert.equal(Boolean(history.messages[0].deletedAt), true);
});

test('chatService db: updateCircleChatReadState upserts state and returns unread count', async () => {
  const { users, circleId } = await seedChatRoom('chat-read');
  const first = await sendCircleChatMessage(users.a, circleId, {
    clientMessageId: testId('read-1'),
    content: '第一条',
  });
  await new Promise((resolve) => setTimeout(resolve, 5));
  await sendCircleChatMessage(users.a, circleId, {
    clientMessageId: testId('read-2'),
    content: '第二条',
  });

  const result = await updateCircleChatReadState(users.b, circleId, {
    lastReadMessageId: first.id,
    lastReadAt: first.createdAt,
  });

  assert.equal(result.lastReadMessageId, first.id);
  assert.equal(result.lastReadAt, first.createdAt);
  assert.equal(result.unreadCount, 1);

  const states = await db.select().from(circleChatReadStates)
    .where(and(
      eq(circleChatReadStates.userId, users.b),
      eq(circleChatReadStates.circleId, circleId),
    ));
  assert.equal(states.length, 1);
  assert.equal(states[0].lastReadMessageId, first.id);
});
