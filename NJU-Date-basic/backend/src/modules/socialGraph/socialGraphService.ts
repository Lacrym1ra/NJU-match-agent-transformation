import { v4 as uuid } from 'uuid';
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { db } from '../../db/connection.js';
import {
  circleMembers,
  circles,
  contactUnlockRequests,
  friendships,
  globalFriendships,
  userBlocks,
} from '../../db/schema.js';
import { CIRCLE_MEMBERSHIP_STATUS } from '../../utils/circleMembership.js';
import { normalizeFriendPair } from './relationshipPolicy.js';
export { normalizeFriendPair } from './relationshipPolicy.js';

export interface VisibleFriendCircle {
  circleId: string;
  circleName: string;
  friendSince: string;
}

type GlobalFriendshipSourceType = 'circle' | 'global';

export function buildCircleFriendPairCondition(userId: string, targetUserId: string) {
  return or(
    and(eq(friendships.userAId, userId), eq(friendships.userBId, targetUserId)),
    and(eq(friendships.userAId, targetUserId), eq(friendships.userBId, userId)),
  );
}

export function buildGlobalFriendPairCondition(userId: string, targetUserId: string) {
  return or(
    and(eq(globalFriendships.userAId, userId), eq(globalFriendships.userBId, targetUserId)),
    and(eq(globalFriendships.userAId, targetUserId), eq(globalFriendships.userBId, userId)),
  );
}

export async function areUsersGlobalFriends(userId: string, targetUserId: string, client: any = db) {
  const rows = await client.select({ id: globalFriendships.id }).from(globalFriendships)
    .where(buildGlobalFriendPairCondition(userId, targetUserId))
    .limit(1);
  return !!rows[0];
}

export async function areUsersCircleFriends(userId: string, targetUserId: string, circleId: string, client: any = db) {
  const rows = await client.select({ id: friendships.id }).from(friendships)
    .where(and(
      eq(friendships.circleId, circleId),
      buildCircleFriendPairCondition(userId, targetUserId),
    ))
    .limit(1);
  return !!rows[0];
}

export async function areUsersActiveCircleMembers(userId: string, targetUserId: string, circleId: string, client: any = db) {
  const rows: Array<{ userId: string }> = await client.select({ userId: circleMembers.userId }).from(circleMembers)
    .where(and(
      eq(circleMembers.circleId, circleId),
      inArray(circleMembers.userId, [userId, targetUserId]),
      eq(circleMembers.membershipStatus, CIRCLE_MEMBERSHIP_STATUS.ACTIVE),
      eq(circleMembers.isActive, true),
    ))
    .limit(2);

  const userIds = new Set(rows.map((row) => row.userId));
  return userIds.has(userId) && userIds.has(targetUserId);
}

export async function canUseCircleFriendForumContext(userId: string, targetUserId: string, circleId: string, client: any = db) {
  const activeMembers = await areUsersActiveCircleMembers(userId, targetUserId, circleId, client);
  if (!activeMembers) return false;
  const circleFriends = await areUsersCircleFriends(userId, targetUserId, circleId, client);
  return activeMembers && circleFriends;
}

export async function areUsersBlocked(userId: string, targetUserId: string, client: any = db) {
  const rows = await client.select({ id: userBlocks.id }).from(userBlocks)
    .where(or(
      and(eq(userBlocks.blockerId, userId), eq(userBlocks.blockedId, targetUserId)),
      and(eq(userBlocks.blockerId, targetUserId), eq(userBlocks.blockedId, userId)),
    ))
    .limit(1);
  return !!rows[0];
}

export async function ensureGlobalFriendship(
  userId: string,
  targetUserId: string,
  client: any = db,
  sourceType: GlobalFriendshipSourceType = 'circle',
) {
  const { userAId, userBId } = normalizeFriendPair(userId, targetUserId);

  await client.execute(sql`
    INSERT INTO global_friendships (id, user_a_id, user_b_id, source_type, created_at)
    VALUES (${uuid()}, ${userAId}, ${userBId}, ${sourceType}, ${new Date().toISOString()})
    ON CONFLICT (user_a_id, user_b_id) DO UPDATE
    SET source_type = CASE
      WHEN global_friendships.source_type = 'global' OR EXCLUDED.source_type = 'global'
        THEN 'global'
      ELSE global_friendships.source_type
    END
  `);
}

export async function revokeOrphanedGlobalFriendshipsForCirclePairs(
  pairs: Array<{ userAId: string; userBId: string }>,
  client: any = db,
) {
  const uniquePairs = new Map<string, { userAId: string; userBId: string }>();
  for (const pair of pairs) {
    const normalized = normalizeFriendPair(pair.userAId, pair.userBId);
    uniquePairs.set(`${normalized.userAId}:${normalized.userBId}`, normalized);
  }

  let revokedGlobalFriendshipCount = 0;
  let deletedContactUnlockCount = 0;
  const revokedPairs: Array<{ userAId: string; userBId: string }> = [];

  for (const pair of uniquePairs.values()) {
    const remaining = await client.select({ id: friendships.id }).from(friendships)
      .where(buildCircleFriendPairCondition(pair.userAId, pair.userBId))
      .limit(1);

    if (remaining[0]) {
      continue;
    }

    const protectedGlobalRows = await client.select({ id: globalFriendships.id }).from(globalFriendships)
      .where(and(
        buildGlobalFriendPairCondition(pair.userAId, pair.userBId),
        eq(globalFriendships.sourceType, 'global'),
      ))
      .limit(1);

    if (protectedGlobalRows[0]) {
      continue;
    }

    const deletedGlobalRows = await client.delete(globalFriendships)
      .where(and(
        buildGlobalFriendPairCondition(pair.userAId, pair.userBId),
        eq(globalFriendships.sourceType, 'circle'),
      ))
      .returning({ id: globalFriendships.id });

    const deletedContactRows = await client.delete(contactUnlockRequests)
      .where(or(
        and(eq(contactUnlockRequests.requesterId, pair.userAId), eq(contactUnlockRequests.targetId, pair.userBId)),
        and(eq(contactUnlockRequests.requesterId, pair.userBId), eq(contactUnlockRequests.targetId, pair.userAId)),
      ))
      .returning({ id: contactUnlockRequests.id });

    if (deletedGlobalRows.length > 0 || deletedContactRows.length > 0) {
      revokedPairs.push(pair);
    }
    revokedGlobalFriendshipCount += deletedGlobalRows.length;
    deletedContactUnlockCount += deletedContactRows.length;
  }

  return {
    revokedGlobalFriendshipCount,
    deletedContactUnlockCount,
    revokedPairs,
  };
}

export async function listVisibleFriendCircles(userId: string, targetUserId: string): Promise<VisibleFriendCircle[]> {
  const rows = await db.select({
    circleId: friendships.circleId,
    circleName: circles.name,
    friendSince: friendships.createdAt,
  }).from(friendships)
    .innerJoin(circles, eq(friendships.circleId, circles.id))
    .where(buildCircleFriendPairCondition(userId, targetUserId))
    .orderBy(desc(friendships.createdAt));

  const circleIds = Array.from(new Set(rows.map((row) => row.circleId)));
  if (circleIds.length === 0) {
    return [];
  }

  const membershipRows = await db.select({
    circleId: circleMembers.circleId,
    memberUserId: circleMembers.userId,
  }).from(circleMembers)
    .where(and(
      inArray(circleMembers.circleId, circleIds),
      inArray(circleMembers.userId, [userId, targetUserId]),
      eq(circleMembers.membershipStatus, CIRCLE_MEMBERSHIP_STATUS.ACTIVE),
      eq(circleMembers.isActive, true),
    ));

  const activeMembersByCircleId = new Map<string, Set<string>>();
  for (const row of membershipRows) {
    const memberSet = activeMembersByCircleId.get(row.circleId) ?? new Set<string>();
    memberSet.add(row.memberUserId);
    activeMembersByCircleId.set(row.circleId, memberSet);
  }

  return rows.flatMap((row) => {
    const memberSet = activeMembersByCircleId.get(row.circleId);
    if (!memberSet?.has(userId) || !memberSet.has(targetUserId)) {
      return [];
    }

    return [{
      circleId: row.circleId,
      circleName: row.circleName ?? '未知圈子',
      friendSince: row.friendSince ?? new Date(0).toISOString(),
    }];
  });
}

export async function listCircleFriendshipsForTargets(userId: string, targetUserIds: string[]) {
  const uniqueTargetUserIds = Array.from(new Set(targetUserIds.filter(Boolean)));
  if (uniqueTargetUserIds.length === 0) {
    return [];
  }

  return db.select({
    circleId: friendships.circleId,
    userAId: friendships.userAId,
    userBId: friendships.userBId,
    createdAt: friendships.createdAt,
    circleName: circles.name,
  }).from(friendships)
    .innerJoin(circles, eq(friendships.circleId, circles.id))
    .where(or(
      and(eq(friendships.userAId, userId), inArray(friendships.userBId, uniqueTargetUserIds)),
      and(eq(friendships.userBId, userId), inArray(friendships.userAId, uniqueTargetUserIds)),
    ))
    .orderBy(desc(friendships.createdAt));
}
