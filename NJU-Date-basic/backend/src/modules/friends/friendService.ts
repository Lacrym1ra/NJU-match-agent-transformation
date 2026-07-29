import { v4 as uuid } from 'uuid';
import { and, desc, eq, gte, inArray, lte, or, sql } from 'drizzle-orm';
import { db } from '../../db/connection.js';
import {
  auditLogs,
  circleMembers,
  circles,
  friendships,
  friendRequests,
  globalFriendships,
  users,
} from '../../db/schema.js';
import { AppError, NotFoundError, ValidationError } from '../../utils/errors.js';
import {
  getFriendRequestCardSnapshot,
  getGlobalFriendRequestCardSnapshot,
  getPublicCardSnapshot,
  parseStoredCardSnapshot,
} from '../cards/index.js';
import {
  deleteContactUnlockRecordsBetweenUsers,
  getFriendContactAvailabilityMap,
} from '../contacts/index.js';
import {
  areUsersCircleFriends,
  areUsersBlocked,
  areUsersGlobalFriends,
  buildCircleFriendPairCondition,
  buildGlobalFriendPairCondition,
  ensureGlobalFriendship,
  listCircleFriendshipsForTargets,
  normalizeFriendPair,
  revokeOrphanedGlobalFriendshipsForCirclePairs,
} from '../socialGraph/relationships.js';
import { CIRCLE_MEMBERSHIP_STATUS } from '../../utils/circleMembership.js';
import {
  G2_CIRCLE_REQUEST_COOLDOWN_POLICY,
  assertG2CircleRequestCooldown,
  getG2CircleRequestRejectWindowStart,
} from '../../services/g2CircleRequestCooldown.js';
import { createUserNotification } from '../../services/notificationService.js';

type FriendRequestAction = 'accept' | 'reject';
type FriendRequestTerminalAction = 'withdraw' | 'silent-reject';
type FriendRequestSourceType = 'circle' | 'global';
const REQUEST_EXPIRES_AFTER_DAYS = 7;
const FRIEND_REQUEST_PENDING_UNIQUE_INDEXES = [
  'idx_friend_requests_circle_sender_receiver',
  'idx_friend_requests_circle_pair_pending',
  'idx_friend_requests_global_sender_receiver',
  'idx_friend_requests_global_pair_pending',
];

function addDaysIso(value: Date, days: number) {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function isExpired(expiresAt?: string | null, now = Date.now()) {
  const time = Date.parse(expiresAt ?? '');
  return Number.isFinite(time) && time <= now;
}

async function expirePendingFriendRequestsForUser(userId: string) {
  const now = new Date().toISOString();
  await db.update(friendRequests)
    .set({ status: 'expired', updatedAt: now })
    .where(and(
      eq(friendRequests.status, 'pending'),
      lte(friendRequests.expiresAt, now),
      or(eq(friendRequests.senderId, userId), eq(friendRequests.receiverId, userId)),
    ));
}

async function expirePendingFriendRequestsBetween(userId: string, targetUserId: string, circleId: string, client: any = db) {
  const now = new Date().toISOString();
  await client.update(friendRequests)
    .set({ status: 'expired', updatedAt: now })
    .where(and(
      eq(friendRequests.circleId, circleId),
      eq(friendRequests.sourceType, 'circle'),
      eq(friendRequests.status, 'pending'),
      lte(friendRequests.expiresAt, now),
      or(
        and(eq(friendRequests.senderId, userId), eq(friendRequests.receiverId, targetUserId)),
        and(eq(friendRequests.senderId, targetUserId), eq(friendRequests.receiverId, userId)),
      ),
    ));
}

async function expirePendingGlobalFriendRequestsBetween(userId: string, targetUserId: string, client: any = db) {
  const now = new Date().toISOString();
  await client.update(friendRequests)
    .set({ status: 'expired', updatedAt: now })
    .where(and(
      eq(friendRequests.sourceType, 'global'),
      eq(friendRequests.status, 'pending'),
      lte(friendRequests.expiresAt, now),
      or(
        and(eq(friendRequests.senderId, userId), eq(friendRequests.receiverId, targetUserId)),
        and(eq(friendRequests.senderId, targetUserId), eq(friendRequests.receiverId, userId)),
      ),
    ));
}

async function expireLockedFriendRequestIfNeeded(client: any, request: typeof friendRequests.$inferSelect) {
  if (!isExpired(request.expiresAt)) return false;

  const now = new Date().toISOString();
  await client.update(friendRequests)
    .set({ status: 'expired', updatedAt: now })
    .where(eq(friendRequests.id, request.id));
  return true;
}

function throwFriendRequestExpired(): never {
  throw new AppError(409, 'REQUEST_EXPIRED', '好友申请已过期，请重新发送');
}

function isFriendRequestPendingUniqueViolation(error: unknown) {
  const pgError = error as { code?: string; constraint?: string; name?: string; message?: string; detail?: string };
  if (pgError?.code !== '23505') return false;
  const text = [pgError.constraint, pgError.name, pgError.message, pgError.detail]
    .filter(Boolean)
    .join(' ');
  return FRIEND_REQUEST_PENDING_UNIQUE_INDEXES.some((indexName) => text.includes(indexName));
}

async function lockPendingFriendRequestPair(client: any, scopeKey: string, userId: string, targetUserId: string) {
  const { userAId, userBId } = normalizeFriendPair(userId, targetUserId);
  await client.execute(sql`
    SELECT pg_advisory_xact_lock(
      hashtext('g2_friend_request_pending'),
      hashtext(${`${scopeKey}:${userAId}:${userBId}`})
    )
  `);
}

async function getCircleName(circleId: string, client: any = db) {
  const rows = await client.select({ name: circles.name }).from(circles)
    .where(eq(circles.id, circleId))
    .limit(1);
  return rows[0]?.name ?? '该圈子';
}

async function assertFriendRequestRejectCooldown(userId: string, targetUserId: string) {
  const windowStart = getG2CircleRequestRejectWindowStart();
  const rejectedRows = await db.select({
    createdAt: friendRequests.createdAt,
    updatedAt: friendRequests.updatedAt,
  }).from(friendRequests)
    .where(and(
      eq(friendRequests.senderId, userId),
      eq(friendRequests.receiverId, targetUserId),
      eq(friendRequests.status, 'rejected'),
      gte(friendRequests.updatedAt, windowStart),
    ))
    .orderBy(desc(friendRequests.updatedAt))
    .limit(G2_CIRCLE_REQUEST_COOLDOWN_POLICY.rejectLimit);

  assertG2CircleRequestCooldown(
    rejectedRows,
    '你向该同窗发送好友申请被拒绝次数较多，请稍后再试',
  );
}

async function ensureUserExists(userId: string) {
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!rows[0]) throw new NotFoundError('用户不存在');
}

async function ensureUsersShareCircle(circleId: string, userId: string, targetUserId: string, client: any = db) {
  const rows: Array<{ userId: string }> = await client.select({ userId: circleMembers.userId }).from(circleMembers)
    .where(and(
      eq(circleMembers.circleId, circleId),
      inArray(circleMembers.userId, [userId, targetUserId]),
      eq(circleMembers.membershipStatus, CIRCLE_MEMBERSHIP_STATUS.ACTIVE),
      eq(circleMembers.isActive, true),
    ))
    .limit(2);

  const userIds = new Set(rows.map((row) => row.userId));
  if (!userIds.has(userId) || !userIds.has(targetUserId)) {
    throw new AppError(403, 'NOT_IN_TARGET_CIRCLE', '不在同一圈子频道中，无法发起好友申请');
  }
}

function getFriendRequestSourceType(request: Pick<typeof friendRequests.$inferSelect, 'sourceType'>): FriendRequestSourceType {
  return request.sourceType === 'global' ? 'global' : 'circle';
}

export async function getFriends(userId: string) {
  const rows = await db.select({
    circleId: friendships.circleId,
    userAId: friendships.userAId,
    userBId: friendships.userBId,
    createdAt: friendships.createdAt,
    circleName: circles.name,
  }).from(friendships)
    .innerJoin(circles, eq(friendships.circleId, circles.id))
    .where(or(eq(friendships.userAId, userId), eq(friendships.userBId, userId)))
    .orderBy(desc(friendships.createdAt));

  const friendIds = Array.from(new Set(
    rows.map((row) => (row.userAId === userId ? row.userBId : row.userAId)),
  ));
  const userRows = friendIds.length > 0
    ? await db.select({
        id: users.id,
        nickname: users.nickname,
        avatarUrl: users.avatarUrl,
      }).from(users).where(inArray(users.id, friendIds))
    : [];
  const usersById = new Map(userRows.map((row) => [row.id, row]));

  return {
    friends: rows.map((row) => {
      const friendId = row.userAId === userId ? row.userBId : row.userAId;
      const friend = usersById.get(friendId);
      return {
        userId: friendId,
        nickname: friend?.nickname ?? null,
        avatarUrl: friend?.avatarUrl ?? null,
        circleId: row.circleId,
        circleName: row.circleName,
        friendSince: row.createdAt,
      };
    }),
  };
}

export async function getGroupedFriends(userId: string) {
  const globalRows = await db.select({
    userAId: globalFriendships.userAId,
    userBId: globalFriendships.userBId,
    createdAt: globalFriendships.createdAt,
  }).from(globalFriendships)
    .where(or(
      eq(globalFriendships.userAId, userId),
      eq(globalFriendships.userBId, userId),
    ))
    .orderBy(desc(globalFriendships.createdAt));

  const friendIds = Array.from(new Set(
    globalRows.map((row) => (row.userAId === userId ? row.userBId : row.userAId)),
  ));

  const [userRows, circleRows] = await Promise.all([
    friendIds.length > 0
      ? db.select({
          id: users.id,
          nickname: users.nickname,
          avatarUrl: users.avatarUrl,
        }).from(users).where(inArray(users.id, friendIds))
      : Promise.resolve([]),
    listCircleFriendshipsForTargets(userId, friendIds),
  ]);

  const usersById = new Map(userRows.map((row) => [row.id, row]));
  const circleIds = Array.from(new Set(circleRows.map((row) => row.circleId)));
  const membershipRows = circleIds.length > 0
    ? await db.select({
        circleId: circleMembers.circleId,
        memberUserId: circleMembers.userId,
      }).from(circleMembers)
        .where(and(
          inArray(circleMembers.circleId, circleIds),
          inArray(circleMembers.userId, [userId, ...friendIds]),
          eq(circleMembers.membershipStatus, CIRCLE_MEMBERSHIP_STATUS.ACTIVE),
          eq(circleMembers.isActive, true),
        ))
    : [];
  const activeMembersByCircleId = new Map<string, Set<string>>();
  for (const row of membershipRows) {
    const memberSet = activeMembersByCircleId.get(row.circleId) ?? new Set<string>();
    memberSet.add(row.memberUserId);
    activeMembersByCircleId.set(row.circleId, memberSet);
  }

  const grouped = new Map<string, {
    userId: string;
    nickname: string | null;
    avatarUrl: string | null;
    friendSince: string;
    circles: Array<{
      circleId: string;
      circleName: string;
      friendSince: string;
    }>;
  }>();

  for (const row of globalRows) {
    const friendId = row.userAId === userId ? row.userBId : row.userAId;
    const friend = usersById.get(friendId);
    grouped.set(friendId, {
      userId: friendId,
      nickname: friend?.nickname ?? null,
      avatarUrl: friend?.avatarUrl ?? null,
      friendSince: row.createdAt ?? new Date(0).toISOString(),
      circles: [],
    });
  }

  for (const row of circleRows) {
    const friendId = row.userAId === userId ? row.userBId : row.userAId;
    const memberSet = activeMembersByCircleId.get(row.circleId);
    if (!memberSet?.has(userId) || !memberSet.has(friendId)) {
      continue;
    }

    const existing = grouped.get(friendId);
    if (!existing) {
      continue;
    }

    existing.circles.push({
      circleId: row.circleId,
      circleName: row.circleName ?? '未知圈子',
      friendSince: row.createdAt ?? new Date(0).toISOString(),
    });
  }

  const groupedFriends = Array.from(grouped.values()).map((friend) => ({
    ...friend,
    circleCount: friend.circles.length,
    circles: friend.circles.sort((a, b) => b.friendSince.localeCompare(a.friendSince)),
  })).sort((a, b) => b.friendSince.localeCompare(a.friendSince));

  const contactAvailabilityMap = await getFriendContactAvailabilityMap(
    userId,
    groupedFriends.map((friend) => friend.userId),
  );

  return {
    friends: groupedFriends.map((friend) => {
      const contactAvailability = contactAvailabilityMap.get(friend.userId) ?? {
        status: 'idle',
        hasUnlockedContacts: false,
      };
      return {
        ...friend,
        contactStatus: contactAvailability.status,
        contactCircleId: contactAvailability.circleId,
        hasUnlockedContacts: contactAvailability.hasUnlockedContacts,
      };
    }),
  };
}

export async function sendFriendRequest(
  userId: string,
  targetUserId: string,
  circleId: string,
  message?: string,
) {
  if (userId === targetUserId) {
    throw new AppError(400, 'CANNOT_ADD_SELF', '不能加自己为好友');
  }

  await ensureUserExists(targetUserId);
  await ensureUsersShareCircle(circleId, userId, targetUserId);

  if (await areUsersBlocked(userId, targetUserId)) {
    throw new AppError(403, 'USER_BLOCKED', '当前无法发起好友申请');
  }

  await expirePendingFriendRequestsBetween(userId, targetUserId, circleId);
  await assertFriendRequestRejectCooldown(userId, targetUserId);

  const alreadyFriends = await areUsersCircleFriends(userId, targetUserId, circleId);
  if (alreadyFriends) {
    throw new AppError(409, 'ALREADY_FRIENDS', '已在该圈成为好友');
  }

  const cardSnapshot = await getFriendRequestCardSnapshot(userId, circleId);

  const requestId = uuid();
  const now = new Date();
  const createdAt = now.toISOString();
  const circleName = await getCircleName(circleId);

  try {
    await db.transaction(async (tx) => {
      await lockPendingFriendRequestPair(tx, `circle:${circleId}`, userId, targetUserId);
      await expirePendingFriendRequestsBetween(userId, targetUserId, circleId, tx);

      const pendingRows = await tx.select({ id: friendRequests.id }).from(friendRequests)
        .where(and(
          eq(friendRequests.circleId, circleId),
          eq(friendRequests.sourceType, 'circle'),
          eq(friendRequests.status, 'pending'),
          or(
            and(eq(friendRequests.senderId, userId), eq(friendRequests.receiverId, targetUserId)),
            and(eq(friendRequests.senderId, targetUserId), eq(friendRequests.receiverId, userId)),
          ),
        ))
        .limit(1);

      if (pendingRows[0]) {
        throw new AppError(409, 'REQUEST_EXISTS', '该圈已有待审申请');
      }

      await tx.insert(friendRequests).values({
        id: requestId,
        circleId,
        sourceType: 'circle',
        senderId: userId,
        receiverId: targetUserId,
        message: message || null,
        cardSnapshot: cardSnapshot as unknown as Record<string, unknown>,
        status: 'pending',
        expiresAt: addDaysIso(now, REQUEST_EXPIRES_AFTER_DAYS),
        createdAt,
        updatedAt: createdAt,
      });

      await tx.insert(auditLogs).values({
        operatorId: userId,
        action: 'friend_request_sent',
        target: circleId,
        detail: JSON.stringify({
          requestId,
          circleId,
          senderId: userId,
          receiverId: targetUserId,
          hasMessage: Boolean(message?.trim()),
        }),
        createdAt,
      });

      await createUserNotification({
        recipientId: targetUserId,
        actorId: userId,
        type: 'friend_request_received',
        title: '新的好友申请',
        content: `有人想在「${circleName}」与你成为好友`,
        meta: {
          circleId,
          requestId,
          senderId: userId,
          actionUrl: `/settings?tab=friends`,
        },
      }, tx);
    });
  } catch (error) {
    if (isFriendRequestPendingUniqueViolation(error)) {
      throw new AppError(409, 'REQUEST_EXISTS', '该圈已有待审申请');
    }
    throw error;
  }

  return { requestId, message: '申请已发送' };
}

export async function sendGlobalFriendRequest(
  userId: string,
  targetUserId: string,
  message?: string,
) {
  if (userId === targetUserId) {
    throw new AppError(400, 'CANNOT_ADD_SELF', '不能加自己为好友');
  }

  await ensureUserExists(targetUserId);

  if (await areUsersBlocked(userId, targetUserId)) {
    throw new AppError(403, 'USER_BLOCKED', '当前无法发起好友申请');
  }

  await expirePendingGlobalFriendRequestsBetween(userId, targetUserId);
  await assertFriendRequestRejectCooldown(userId, targetUserId);

  const alreadyFriends = await areUsersGlobalFriends(userId, targetUserId);
  if (alreadyFriends) {
    throw new AppError(409, 'ALREADY_FRIENDS', '你们已经是全局好友');
  }

  const cardSnapshot = await getGlobalFriendRequestCardSnapshot(userId);

  const requestId = uuid();
  const now = new Date();
  const createdAt = now.toISOString();

  try {
    await db.transaction(async (tx) => {
      await lockPendingFriendRequestPair(tx, 'global', userId, targetUserId);
      await expirePendingGlobalFriendRequestsBetween(userId, targetUserId, tx);

      const pendingRows = await tx.select({ id: friendRequests.id }).from(friendRequests)
        .where(and(
          eq(friendRequests.sourceType, 'global'),
          eq(friendRequests.status, 'pending'),
          or(
            and(eq(friendRequests.senderId, userId), eq(friendRequests.receiverId, targetUserId)),
            and(eq(friendRequests.senderId, targetUserId), eq(friendRequests.receiverId, userId)),
          ),
        ))
        .limit(1);

      if (pendingRows[0]) {
        throw new AppError(409, 'REQUEST_EXISTS', '已有待处理的全局好友申请');
      }

      await tx.insert(friendRequests).values({
        id: requestId,
        circleId: null,
        sourceType: 'global',
        senderId: userId,
        receiverId: targetUserId,
        message: message || null,
        cardSnapshot: cardSnapshot as unknown as Record<string, unknown>,
        status: 'pending',
        expiresAt: addDaysIso(now, REQUEST_EXPIRES_AFTER_DAYS),
        createdAt,
        updatedAt: createdAt,
      });

      await tx.insert(auditLogs).values({
        operatorId: userId,
        action: 'global_friend_request_sent',
        target: targetUserId,
        detail: JSON.stringify({
          requestId,
          sourceType: 'global',
          senderId: userId,
          receiverId: targetUserId,
          hasMessage: Boolean(message?.trim()),
        }),
        createdAt,
      });

      await createUserNotification({
        recipientId: targetUserId,
        actorId: userId,
        type: 'friend_request_received',
        title: '新的好友申请',
        content: '有人想与你成为全局好友',
        meta: {
          sourceType: 'global',
          requestId,
          senderId: userId,
          actionUrl: `/settings?tab=friends`,
        },
      }, tx);
    });
  } catch (error) {
    if (isFriendRequestPendingUniqueViolation(error)) {
      throw new AppError(409, 'REQUEST_EXISTS', '已有待处理的全局好友申请');
    }
    throw error;
  }

  return { requestId, message: '申请已发送' };
}

export async function getFriendRequests(userId: string) {
  await expirePendingFriendRequestsForUser(userId);

  const [pendingRows, acceptedRows] = await Promise.all([
    db.select({
      requestId: friendRequests.id,
      senderId: friendRequests.senderId,
      circleId: friendRequests.circleId,
      sourceType: friendRequests.sourceType,
      cardSnapshot: friendRequests.cardSnapshot,
      message: friendRequests.message,
      status: friendRequests.status,
      expiresAt: friendRequests.expiresAt,
      createdAt: friendRequests.createdAt,
      circleName: circles.name,
    }).from(friendRequests)
      .leftJoin(circles, eq(friendRequests.circleId, circles.id))
      .where(and(eq(friendRequests.receiverId, userId), eq(friendRequests.status, 'pending')))
      .orderBy(desc(friendRequests.createdAt)),
    db.select({
      requestId: friendRequests.id,
      receiverId: friendRequests.receiverId,
      circleId: friendRequests.circleId,
      sourceType: friendRequests.sourceType,
      cardSnapshot: friendRequests.cardSnapshot,
      status: friendRequests.status,
      expiresAt: friendRequests.expiresAt,
      createdAt: friendRequests.createdAt,
      updatedAt: friendRequests.updatedAt,
      circleName: circles.name,
    }).from(friendRequests)
      .leftJoin(circles, eq(friendRequests.circleId, circles.id))
      .where(and(eq(friendRequests.senderId, userId), inArray(friendRequests.status, ['accepted', 'rejected', 'withdrawn', 'expired'])))
      .orderBy(desc(friendRequests.updatedAt)),
  ]);

  const senderIds = Array.from(new Set(pendingRows.map((row) => row.senderId)));
  const receiverIds = Array.from(new Set(acceptedRows.map((row) => row.receiverId)));
  const userRows = [...senderIds, ...receiverIds].length > 0
    ? await db.select({
        id: users.id,
        nickname: users.nickname,
        avatarUrl: users.avatarUrl,
      }).from(users).where(inArray(users.id, Array.from(new Set([...senderIds, ...receiverIds]))))
    : [];
  const usersById = new Map(userRows.map((row) => [row.id, row]));

  const requests = await Promise.all(pendingRows.map(async (row) => {
    const sender = usersById.get(row.senderId);
    const sourceType = row.sourceType === 'global' ? 'global' : 'circle';
    const cardPreview = parseStoredCardSnapshot(row.cardSnapshot, {
      previewMode: 'public',
      nickname: sender?.nickname ?? null,
      avatarUrl: sender?.avatarUrl ?? null,
      circleId: row.circleId,
      circleName: row.circleName,
    }) ?? (
      sourceType === 'global' || !row.circleId
        ? await getGlobalFriendRequestCardSnapshot(row.senderId)
        : await getPublicCardSnapshot(row.senderId, row.circleId)
    );

    return {
      requestId: row.requestId,
      sourceType,
      sender: {
        userId: row.senderId,
        nickname: sender?.nickname ?? null,
        avatarUrl: sender?.avatarUrl ?? null,
      },
      circleId: row.circleId ?? null,
      circleName: row.circleName ?? null,
      cardPreview,
      message: row.message,
      status: row.status,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
    };
  }));

  const acceptedRequests = await Promise.all(acceptedRows.map(async (row) => {
    const receiver = usersById.get(row.receiverId);
    const sourceType = row.sourceType === 'global' ? 'global' : 'circle';
    const cardPreview = parseStoredCardSnapshot(row.cardSnapshot, {
      previewMode: 'public',
      nickname: receiver?.nickname ?? null,
      avatarUrl: receiver?.avatarUrl ?? null,
      circleId: row.circleId,
      circleName: row.circleName,
    }) ?? (
      sourceType === 'global' || !row.circleId
        ? await getGlobalFriendRequestCardSnapshot(row.receiverId)
        : await getPublicCardSnapshot(row.receiverId, row.circleId)
    );

    return {
      requestId: row.requestId,
      sourceType,
      responder: {
        userId: row.receiverId,
        nickname: receiver?.nickname ?? null,
        avatarUrl: receiver?.avatarUrl ?? null,
      },
      circleId: row.circleId ?? null,
      circleName: row.circleName ?? null,
      cardPreview,
      status: row.status,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      acceptedAt: row.status === 'accepted' ? row.updatedAt : null,
      respondedAt: row.updatedAt,
    };
  }));

  return {
    requests,
    acceptedRequests,
  };
}

export async function handleFriendRequest(
  userId: string,
  requestId: string,
  action: FriendRequestAction,
) {
  let expired = false;
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM friend_requests WHERE id = ${requestId} FOR UPDATE`);

    const rows = await tx.select().from(friendRequests).where(eq(friendRequests.id, requestId)).limit(1);
    const request = rows[0];

    if (!request) {
      throw new AppError(404, 'REQUEST_NOT_FOUND', '申请不存在');
    }
    if (request.receiverId !== userId) {
      throw new AppError(403, 'NOT_RECEIVER', '非接收方无权操作');
    }
    if (request.status !== 'pending') {
      throw new AppError(409, 'ALREADY_PROCESSED', '已处理过');
    }
    if (await expireLockedFriendRequestIfNeeded(tx, request)) {
      expired = true;
      return null;
    }

    if (action === 'accept' && await areUsersBlocked(request.senderId, request.receiverId, tx)) {
      throw new AppError(403, 'USER_BLOCKED', '当前无法处理好友申请');
    }

    const now = new Date().toISOString();
    const sourceType = getFriendRequestSourceType(request);
    const circleName = sourceType === 'circle' && request.circleId
      ? await getCircleName(request.circleId, tx)
      : null;
    if (action === 'accept') {
      const { userAId, userBId } = normalizeFriendPair(request.senderId, request.receiverId);
      if (sourceType === 'global') {
        await ensureGlobalFriendship(userAId, userBId, tx, 'global');
      } else {
        if (!request.circleId) {
          throw new AppError(409, 'INVALID_REQUEST_SCOPE', '圈内好友申请缺少圈子信息');
        }
        await ensureUsersShareCircle(request.circleId, request.senderId, request.receiverId, tx);
        const alreadyFriends = await areUsersCircleFriends(userAId, userBId, request.circleId, tx);
        if (!alreadyFriends) {
          await tx.insert(friendships).values({
            id: uuid(),
            circleId: request.circleId,
            userAId,
            userBId,
            createdAt: now,
          });
        }
        await ensureGlobalFriendship(userAId, userBId, tx, 'circle');
      }
    }

    const processedRows = await tx.update(friendRequests)
      .set({ status: action === 'accept' ? 'accepted' : 'rejected', updatedAt: now })
      .where(and(eq(friendRequests.id, requestId), eq(friendRequests.status, 'pending')))
      .returning({ id: friendRequests.id });

    if (processedRows.length === 0) {
      throw new AppError(409, 'ALREADY_PROCESSED', '已处理过');
    }

    await tx.insert(auditLogs).values({
      operatorId: userId,
      action: action === 'accept' ? 'friend_request_accepted' : 'friend_request_rejected',
      target: request.circleId ?? request.receiverId,
      detail: JSON.stringify({
        requestId,
        sourceType,
        circleId: request.circleId,
        senderId: request.senderId,
        receiverId: request.receiverId,
      }),
      createdAt: now,
    });

    await createUserNotification({
      recipientId: request.senderId,
      actorId: userId,
      type: action === 'accept' ? 'friend_request_accepted' : 'friend_request_rejected',
      title: action === 'accept' ? '好友申请已通过' : '好友申请被拒绝',
      content: sourceType === 'global'
        ? (action === 'accept' ? '你的全局好友申请已通过' : '你的全局好友申请被拒绝')
        : (action === 'accept'
            ? `你在「${circleName}」的好友申请已通过`
            : `你在「${circleName}」的好友申请被拒绝`),
      meta: {
        sourceType,
        circleId: request.circleId ?? null,
        requestId,
        targetUserId: request.receiverId,
        actionUrl: '/settings?tab=friends',
      },
    }, tx);

    if (action === 'accept') {
      return {
        action,
        sourceType,
        message: sourceType === 'global' ? '已成为全局好友' : '已在该圈成为好友',
        circleId: request.circleId ?? null,
      };
    }

    return { action, sourceType, message: '已拒绝好友申请', circleId: request.circleId ?? null };
  });

  if (expired) throwFriendRequestExpired();
  return result!;
}

export async function closeFriendRequest(
  userId: string,
  requestId: string,
  action: FriendRequestTerminalAction,
) {
  let expired = false;
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM friend_requests WHERE id = ${requestId} FOR UPDATE`);

    const rows = await tx.select().from(friendRequests).where(eq(friendRequests.id, requestId)).limit(1);
    const request = rows[0];

    if (!request) {
      throw new AppError(404, 'REQUEST_NOT_FOUND', '申请不存在');
    }
    if (request.status !== 'pending') {
      throw new AppError(409, 'ALREADY_PROCESSED', '已处理过');
    }
    if (await expireLockedFriendRequestIfNeeded(tx, request)) {
      expired = true;
      return null;
    }

    if (action === 'withdraw' && request.senderId !== userId) {
      throw new AppError(403, 'NOT_SENDER', '只有发送方可以撤回好友申请');
    }
    if (action === 'silent-reject' && request.receiverId !== userId) {
      throw new AppError(403, 'NOT_RECEIVER', '只有接收方可以忽略好友申请');
    }

    const now = new Date().toISOString();
    const sourceType = getFriendRequestSourceType(request);
    const circleName = sourceType === 'circle' && request.circleId
      ? await getCircleName(request.circleId, tx)
      : null;
    await tx.update(friendRequests)
      .set({
        status: action === 'withdraw' ? 'withdrawn' : 'rejected',
        updatedAt: now,
      })
      .where(eq(friendRequests.id, requestId));

    await tx.insert(auditLogs).values({
      operatorId: userId,
      action: action === 'withdraw' ? 'friend_request_withdrawn' : 'friend_request_silent_rejected',
      target: request.circleId ?? request.receiverId,
      detail: JSON.stringify({
        requestId,
        sourceType,
        circleId: request.circleId,
        senderId: request.senderId,
        receiverId: request.receiverId,
      }),
      createdAt: now,
    });

    if (action === 'withdraw') {
      await createUserNotification({
        recipientId: request.receiverId,
        actorId: userId,
        type: 'friend_request_withdrawn',
        title: '好友申请已撤回',
        content: sourceType === 'global'
          ? '对方已撤回全局好友申请'
          : `对方已撤回在「${circleName}」的好友申请`,
        meta: {
          sourceType,
          circleId: request.circleId ?? null,
          requestId,
          senderId: request.senderId,
          actionUrl: '/settings?tab=friends',
        },
      }, tx);
    }

    return {
      action,
      sourceType,
      message: action === 'withdraw' ? '已撤回好友申请' : '已忽略好友申请',
      circleId: request.circleId ?? null,
    };
  });

  if (expired) throwFriendRequestExpired();
  return result!;
}

export async function deleteFriend(userId: string, friendId: string, circleId: string) {
  if (userId === friendId) {
    throw new ValidationError('不能删除自己');
  }

  const result = await db.transaction(async (tx) => {
    const pairCondition = buildCircleFriendPairCondition(userId, friendId);
    const deleted = await tx.delete(friendships)
      .where(and(
        eq(friendships.circleId, circleId),
        pairCondition,
      ))
      .returning({
        id: friendships.id,
        circleId: friendships.circleId,
        userAId: friendships.userAId,
        userBId: friendships.userBId,
      });

    if (deleted.length === 0) {
      throw new NotFoundError('好友关系不存在');
    }

    const cleanup = await revokeOrphanedGlobalFriendshipsForCirclePairs(deleted, tx);
    const remaining = await tx.select({ circleId: friendships.circleId }).from(friendships)
      .where(pairCondition);

    const now = new Date().toISOString();
    await tx.insert(auditLogs).values({
      operatorId: userId,
      action: 'friend_deleted_in_circle',
      target: circleId,
      detail: JSON.stringify({
        friendId,
        circleId,
        removedCircleCount: deleted.length,
        remainingCircleCount: remaining.length,
        revokedGlobalFriendshipCount: cleanup.revokedGlobalFriendshipCount,
        deletedContactUnlockCount: cleanup.deletedContactUnlockCount,
      }),
      createdAt: now,
    });

    return { deleted, remaining, cleanup };
  });

  return {
    message: result.cleanup.revokedGlobalFriendshipCount > 0
      ? '已解除该圈好友关系，并撤销不再有效的全局好友与联系方式授权'
      : '已解除该圈好友关系，全局好友仍保留',
    circleId,
    removedCircleCount: result.deleted.length,
    remainingCircleCount: result.remaining.length,
    revokedGlobalFriendshipCount: result.cleanup.revokedGlobalFriendshipCount,
    deletedContactUnlockCount: result.cleanup.deletedContactUnlockCount,
  };
}

export async function deleteAllFriends(userId: string, friendId: string) {
  if (userId === friendId) {
    throw new ValidationError('不能删除自己');
  }

  const result = await db.transaction(async (tx) => {
    const deletedCircleRows = await tx.delete(friendships)
      .where(buildCircleFriendPairCondition(userId, friendId))
      .returning({ id: friendships.id, circleId: friendships.circleId });
    const deletedGlobalRows = await tx.delete(globalFriendships)
      .where(buildGlobalFriendPairCondition(userId, friendId))
      .returning({ id: globalFriendships.id });

    if (deletedCircleRows.length === 0 && deletedGlobalRows.length === 0) {
      throw new NotFoundError('好友关系不存在');
    }

    const deletedContactUnlockCount = await deleteContactUnlockRecordsBetweenUsers(userId, friendId, tx);
    const now = new Date().toISOString();
    await tx.insert(auditLogs).values({
      operatorId: userId,
      action: 'friend_deleted_global',
      target: friendId,
      detail: JSON.stringify({
        friendId,
        removedCircleCount: deletedCircleRows.length,
        removedCircleIds: deletedCircleRows.map((row) => row.circleId),
        removedGlobalFriendshipCount: deletedGlobalRows.length,
        deletedContactUnlockCount,
      }),
      createdAt: now,
    });

    return { deletedCircleRows, deletedGlobalRows, deletedContactUnlockCount };
  });

  return {
    message: '已从同窗名录中解除全局好友关系',
    removedCircleCount: result.deletedCircleRows.length,
    remainingCircleCount: 0,
    removedCircleIds: result.deletedCircleRows.map((row) => row.circleId),
    removedGlobalFriendshipCount: result.deletedGlobalRows.length,
    deletedContactUnlockCount: result.deletedContactUnlockCount,
  };
}
