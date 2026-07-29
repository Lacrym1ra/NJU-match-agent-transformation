import test, { after, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';
import { db } from '../../src/db/connection.js';
import {
  contactUnlockGrants,
  contactUnlockRequests,
  friendships,
  friendRequests,
  globalFriendships,
} from '../../src/db/schema.js';
import { AppError } from '../../src/utils/errors.js';
import {
  deleteAllFriends,
  deleteFriend,
  handleFriendRequest,
  sendFriendRequest,
} from '../../src/modules/friends/requests.js';
import {
  getUnlockedContacts,
  handleContactUnlockRequest,
  sendContactUnlockRequest,
} from '../../src/modules/contacts/unlocks.js';
import {
  upsertMyCircleContact,
} from '../../src/modules/contacts/circleContacts.js';
import {
  cleanupTestData,
  closeDb,
  seedCircle,
  seedUsers,
} from './helpers.js';

beforeEach(cleanupTestData);
afterEach(cleanupTestData);
after(closeDb);

async function seedFriendRoom(suffix: string) {
  const users = await seedUsers(suffix, ['a', 'b', 'c']);
  const circleId = await seedCircle(suffix, [users.a, users.b, users.c]);
  return { users, circleId };
}

async function makeCircleFriends(suffix: string) {
  const seeded = await seedFriendRoom(suffix);
  const request = await sendFriendRequest(seeded.users.a, seeded.users.b, seeded.circleId, '一起刷题');
  await handleFriendRequest(seeded.users.b, request.requestId, 'accept');
  return seeded;
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

test('friend/contact db: sendFriendRequest and handleFriendRequest accept create circle and global friendships', async () => {
  const { users, circleId } = await seedFriendRoom('friend-accept');

  const request = await sendFriendRequest(users.a, users.b, circleId, '一起刷题');
  assert.equal(request.message, '申请已发送');

  const handled = await handleFriendRequest(users.b, request.requestId, 'accept');
  assert.equal(handled.message, '已在该圈成为好友');

  const requestRows = await db.select().from(friendRequests)
    .where(eq(friendRequests.id, request.requestId));
  assert.equal(requestRows[0].status, 'accepted');

  const friendshipRows = await db.select().from(friendships)
    .where(eq(friendships.circleId, circleId));
  assert.equal(friendshipRows.length, 1);
  assert.deepEqual([friendshipRows[0].userAId, friendshipRows[0].userBId].sort(), [users.a, users.b].sort());

  const globalRows = await db.select().from(globalFriendships)
    .where(and(eq(globalFriendships.userAId, users.a), eq(globalFriendships.userBId, users.b)));
  assert.equal(globalRows.length, 1);
});

test('friend/contact db: concurrent reverse friend requests leave only one pending request', async () => {
  const { users, circleId } = await seedFriendRoom('friend-request-concurrent');

  const results = await Promise.allSettled([
    sendFriendRequest(users.a, users.b, circleId, 'A 到 B'),
    sendFriendRequest(users.b, users.a, circleId, 'B 到 A'),
  ]);

  const fulfilled = results.filter((result) => result.status === 'fulfilled');
  const rejected = results.filter((result) => result.status === 'rejected');
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);

  const rejectedError = (rejected[0] as PromiseRejectedResult).reason;
  assert.equal(rejectedError instanceof AppError, true);
  assert.equal((rejectedError as AppError).code, 'REQUEST_EXISTS');

  const pendingRows = await db.select().from(friendRequests)
    .where(and(
      eq(friendRequests.circleId, circleId),
      eq(friendRequests.status, 'pending'),
    ));
  assert.equal(pendingRows.length, 1);
});

test('friend/contact db: concurrent accepting the same request only succeeds once', async () => {
  const { users, circleId } = await seedFriendRoom('friend-accept-concurrent');
  const request = await sendFriendRequest(users.a, users.b, circleId, '并发接受');

  const results = await Promise.allSettled([
    handleFriendRequest(users.b, request.requestId, 'accept'),
    handleFriendRequest(users.b, request.requestId, 'accept'),
  ]);

  const fulfilled = results.filter((result) => result.status === 'fulfilled');
  const rejected = results.filter((result) => result.status === 'rejected');
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);

  const rejectedError = (rejected[0] as PromiseRejectedResult).reason;
  assert.equal(rejectedError instanceof AppError, true);
  assert.equal((rejectedError as AppError).code, 'ALREADY_PROCESSED');

  const requestRows = await db.select().from(friendRequests)
    .where(eq(friendRequests.id, request.requestId));
  assert.equal(requestRows[0].status, 'accepted');

  const friendshipRows = await db.select().from(friendships)
    .where(eq(friendships.circleId, circleId));
  const globalRows = await db.select().from(globalFriendships)
    .where(and(eq(globalFriendships.userAId, users.a), eq(globalFriendships.userBId, users.b)));
  assert.equal(friendshipRows.length, 1);
  assert.equal(globalRows.length, 1);
});

test('friend/contact db: rejecting and duplicate pending friend requests update durable state', async () => {
  const { users, circleId } = await seedFriendRoom('friend-reject');

  const pending = await sendFriendRequest(users.a, users.b, circleId, '第一次申请');
  await assertAppError(
    () => sendFriendRequest(users.b, users.a, circleId, '反向重复申请'),
    { statusCode: 409, code: 'REQUEST_EXISTS' },
  );

  const rejected = await handleFriendRequest(users.b, pending.requestId, 'reject');
  assert.equal(rejected.message, '已拒绝好友申请');

  const rows = await db.select().from(friendRequests)
    .where(eq(friendRequests.id, pending.requestId));
  assert.equal(rows[0].status, 'rejected');

  const friendshipRows = await db.select().from(friendships)
    .where(eq(friendships.circleId, circleId));
  assert.equal(friendshipRows.length, 0);
});

test('friend/contact db: deleteFriend removes the circle friendship and orphaned global friendship', async () => {
  const { users, circleId } = await makeCircleFriends('friend-delete');

  const result = await deleteFriend(users.a, users.b, circleId);
  assert.equal(result.removedCircleCount, 1);
  assert.equal(result.revokedGlobalFriendshipCount, 1);

  const circleRows = await db.select().from(friendships)
    .where(eq(friendships.circleId, circleId));
  assert.equal(circleRows.length, 0);
  const globalRows = await db.select().from(globalFriendships)
    .where(and(eq(globalFriendships.userAId, users.a), eq(globalFriendships.userBId, users.b)));
  assert.equal(globalRows.length, 0);
});

test('friend/contact db: deleteAllFriends atomically removes friendships and contact unlock records', async () => {
  const { users, circleId } = await makeCircleFriends('friend-delete-all');
  const saved = await upsertMyCircleContact(users.b, circleId, {
    fieldKey: 'contact_wechat',
    label: '微信',
    value: 'delete_all_target_wx',
    isEnabled: true,
  });
  const request = await sendContactUnlockRequest(users.a, users.b, {
    sourceType: 'circle',
    circleId,
    message: '删除前先交换',
  });
  await handleContactUnlockRequest(users.b, request.requestId, 'approve', {
    contactIds: [saved.contact.id],
  });

  const result = await deleteAllFriends(users.a, users.b);
  assert.equal(result.removedCircleCount, 1);
  assert.equal(result.removedGlobalFriendshipCount, 1);
  assert.equal(result.deletedContactUnlockCount, 1);

  const circleRows = await db.select().from(friendships)
    .where(eq(friendships.circleId, circleId));
  const globalRows = await db.select().from(globalFriendships)
    .where(and(eq(globalFriendships.userAId, users.a), eq(globalFriendships.userBId, users.b)));
  const requestRows = await db.select().from(contactUnlockRequests)
    .where(eq(contactUnlockRequests.id, request.requestId));
  const grantRows = await db.select().from(contactUnlockGrants)
    .where(and(
      eq(contactUnlockGrants.requesterId, users.a),
      eq(contactUnlockGrants.targetId, users.b),
      eq(contactUnlockGrants.circleId, circleId),
    ));

  assert.equal(circleRows.length, 0);
  assert.equal(globalRows.length, 0);
  assert.equal(requestRows.length, 0);
  assert.equal(grantRows.length, 0);
});

test('friend/contact db: contact unlock approve grants and reveals circle contact value', async () => {
  const { users, circleId } = await makeCircleFriends('contact-approve');
  const saved = await upsertMyCircleContact(users.b, circleId, {
    fieldKey: 'contact_wechat',
    label: '微信',
    value: 'target_circle_wx',
    isEnabled: true,
  });

  const request = await sendContactUnlockRequest(users.a, users.b, {
    sourceType: 'circle',
    circleId,
    message: '想交换联系方式',
  });
  assert.equal(request.message, '联系方式交换申请已发送');

  const handled = await handleContactUnlockRequest(users.b, request.requestId, 'approve', {
    contactIds: [saved.contact.id],
  });
  assert.equal(handled.message, '已同意交换联系方式');

  const grantRows = await db.select().from(contactUnlockGrants)
    .where(and(
      eq(contactUnlockGrants.requesterId, users.a),
      eq(contactUnlockGrants.targetId, users.b),
      eq(contactUnlockGrants.circleId, circleId),
    ));
  assert.equal(grantRows.length, 1);
  assert.equal(grantRows[0].status, 'active');

  const unlocked = await getUnlockedContacts(users.a, users.b, { circleId });
  assert.deepEqual(unlocked.contacts.map((contact) => ({
    fieldKey: contact.fieldKey,
    value: contact.value,
  })), [{ fieldKey: 'contact_wechat', value: 'target_circle_wx' }]);
});

test('friend/contact db: contact unlock reject does not reveal contacts', async () => {
  const { users, circleId } = await makeCircleFriends('contact-reject');
  const saved = await upsertMyCircleContact(users.b, circleId, {
    fieldKey: 'contact_wechat',
    label: '微信',
    value: 'reject_target_wx',
    isEnabled: true,
  });
  assert.equal(Boolean(saved.contact.id), true);

  const request = await sendContactUnlockRequest(users.a, users.b, {
    sourceType: 'circle',
    circleId,
    message: '想交换联系方式',
  });
  await handleContactUnlockRequest(users.b, request.requestId, 'reject');

  const requestRows = await db.select().from(contactUnlockRequests)
    .where(eq(contactUnlockRequests.id, request.requestId));
  assert.equal(requestRows[0].status, 'rejected');

  await assertAppError(
    () => getUnlockedContacts(users.a, users.b, { circleId }),
    { statusCode: 403, code: 'CONTACT_NOT_UNLOCKED' },
  );
});

test('friend/contact db: concurrent contact unlock decisions only apply once', async () => {
  const { users, circleId } = await makeCircleFriends('contact-concurrent');
  const saved = await upsertMyCircleContact(users.b, circleId, {
    fieldKey: 'contact_wechat',
    label: '微信',
    value: 'concurrent_target_wx',
    isEnabled: true,
  });
  const request = await sendContactUnlockRequest(users.a, users.b, {
    sourceType: 'circle',
    circleId,
    message: '并发审批',
  });

  const results = await Promise.allSettled([
    handleContactUnlockRequest(users.b, request.requestId, 'approve', {
      contactIds: [saved.contact.id],
    }),
    handleContactUnlockRequest(users.b, request.requestId, 'reject'),
  ]);

  const fulfilled = results.filter((result) => result.status === 'fulfilled');
  const rejected = results.filter((result) => result.status === 'rejected');
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);

  const rejectedError = (rejected[0] as PromiseRejectedResult).reason;
  assert.equal(rejectedError instanceof AppError, true);
  assert.equal((rejectedError as AppError).code, 'CONTACT_REQUEST_PROCESSED');

  const successfulAction = (fulfilled[0] as PromiseFulfilledResult<{
    action: 'approve' | 'reject';
  }>).value.action;
  const requestRows = await db.select().from(contactUnlockRequests)
    .where(eq(contactUnlockRequests.id, request.requestId));
  assert.equal(requestRows.length, 1);
  assert.equal(requestRows[0].status, successfulAction === 'approve' ? 'approved' : 'rejected');

  const grantRows = await db.select().from(contactUnlockGrants)
    .where(and(
      eq(contactUnlockGrants.requesterId, users.a),
      eq(contactUnlockGrants.targetId, users.b),
      eq(contactUnlockGrants.circleId, circleId),
    ));
  assert.equal(grantRows.length, successfulAction === 'approve' ? 1 : 0);
});

test('friend/contact db: non-friends cannot request contact unlock', async () => {
  const { users, circleId } = await seedFriendRoom('contact-non-friend');
  await upsertMyCircleContact(users.b, circleId, {
    fieldKey: 'contact_wechat',
    label: '微信',
    value: 'non_friend_target_wx',
    isEnabled: true,
  });

  await assertAppError(
    () => sendContactUnlockRequest(users.a, users.b, {
      sourceType: 'circle',
      circleId,
      message: '还不是好友',
    }),
    { statusCode: 403, code: 'NOT_FRIEND' },
  );
});
