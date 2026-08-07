import { v4 as uuid } from 'uuid';
import { randomBytes } from 'crypto';
import { desc, eq, and, or, sql, inArray } from 'drizzle-orm';
import { db } from '../../db/connection.js';
import {
  auditLogs,
  circleBlacklist,
  circleCardOverrides,
  circleJoinRequests,
  circles,
  circleQuestions,
  circleMembers,
  circleMemberLocationCooldowns,
  circleMemberLocations,
  circleMemberRoles,
  circleMatches,
  contactUnlockRequests,
  friendRequests,
  friendships,
  g2ContactSecrets,
  teamupApplications,
  teamupForumSyncJobs,
  teamupMembers,
  teamups,
  userNotifications,
  userCircleCards,
  userCircleContacts,
  userCircleCustomCards,
  users,
} from '../../db/schema.js';
import { AppError, NotFoundError, ConflictError, ForbiddenError, ValidationError } from '../../utils/errors.js';
import { computeCircleScore } from '../../matching/circleCompatibility.js';
import { greedyMaxWeightMatching } from '../../matching/galeShapley.js';
import { initializeCardsOnCircleJoin } from '../../services/cardJoinInitializationService.js';
import { deletePost } from '../../services/forumService.js';
import { CIRCLE_MEMBERSHIP_STATUS } from '../../utils/circleMembership.js';
import { CIRCLE_MEMBER_ROLE } from '../../utils/circleRoles.js';
import { CIRCLE_STATUS, type CircleStatus } from '../../utils/circleStatus.js';
import { containsSensitiveContactValue, isSensitiveFieldText } from '../../utils/privacy.js';
import { revokeOrphanedGlobalFriendshipsForCirclePairs } from '../socialGraph/relationships.js';
import {
  CIRCLE_JOIN_REQUEST_STATUS,
  JOIN_POLICY,
  assertCircleCapacityAvailable,
  assertNoKeywordRuleHits,
  hashInviteCode,
  inviteCodeMatches,
  normalizeCapacityLimit,
  normalizeJoinApplication,
  normalizeJoinQuestions,
  normalizeKeywordRules,
  normalizeNullableText,
  throwJoinCircleConflict,
  type JoinCirclePayload,
  type CircleJoinRequestStatus,
  type JoinPolicy,
  type JoinQuestionDefinition,
  type KeywordRule,
} from './joinPolicy.js';

// ─── Helpers ────────────────────────────────────────────────────

const TEAMUP_FORUM_SYNC_ENABLED: boolean = false;
const CUSTOM_CIRCLE_LIMIT = 5;
const JOIN_REQUEST_TTL_DAYS = 7;
const LOCATION_TTL_MS = 24 * 60 * 60 * 1000;
const LOCATION_MIN_UPDATE_INTERVAL_MS = 30 * 1000;
const LOCATION_MAX_ACCURACY_METERS = 1000;
const EARTH_RADIUS_METERS = 6371000;
const NEARBY_MIN_RADIUS_METERS = 100;
const NEARBY_MAX_RADIUS_METERS = 50000;
const NEARBY_DEFAULT_RADIUS_METERS = NEARBY_MAX_RADIUS_METERS;
const NEARBY_CANDIDATE_LIMIT = 500;
const NEARBY_SQL_FETCH_LIMIT = NEARBY_CANDIDATE_LIMIT * 3;
const DISTANCE_BUCKETS = [
  { key: 'under_200m', text: '200m 内', upperBoundMeters: 200 },
  { key: '200m_500m', text: '200-500m', upperBoundMeters: 500 },
  { key: '500m_1km', text: '500m-1km', upperBoundMeters: 1000 },
  { key: '1km_2km', text: '1-2km', upperBoundMeters: 2000 },
  { key: '2km_5km', text: '2-5km', upperBoundMeters: 5000 },
  { key: '5km_10km', text: '5-10km', upperBoundMeters: 10000 },
  { key: '10km_20km', text: '10-20km', upperBoundMeters: 20000 },
  { key: '20km_50km', text: '20-50km', upperBoundMeters: 50000 },
] as const;

type ListCirclesOptions = {
  category?: string;
  keyword?: string;
  keywords?: string[];
  includeJoined?: boolean;
  tags?: string[];
  department?: string;
  grade?: string;
  sort?: 'recommended' | 'active' | 'members' | 'latest';
  page?: number;
  limit?: number;
};

function escapeLikeWildcards(value: string) {
  return value.replace(/[%_\\]/g, '\\$&');
}

type CreateCustomCirclePayload = {
  name: string;
  slug?: string;
  description: string;
  category?: string;
  tags: string[];
  iconUrl?: string;
  joinPolicy?: JoinPolicy;
  joinQuestion?: string | null;
  joinQuestions?: Array<{
    id?: string;
    question: string;
    required?: boolean;
  }>;
  capacityLimit?: number | null;
  keywordRules?: KeywordRule[];
};

type UpdateManagedCirclePayload = {
  name?: string;
  description?: string;
  category?: string;
  tags?: string[];
  iconUrl?: string | null;
  joinQuestion?: string | null;
  joinQuestions?: Array<{
    id?: string;
    question: string;
    required?: boolean;
  }>;
  capacityLimit?: number | null;
  keywordRules?: KeywordRule[];
};

type UpdateCircleLocationPayload = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  capturedAt?: string;
};

type ChannelMembersOptions = {
  nearby?: boolean;
  radiusMeters?: number;
  includeUnknownDistance?: boolean;
};

type ChannelMemberBase = {
  userId: string;
  nickname: string | null;
  avatarUrl: string | null;
  joinedAt: string | null;
  distanceMeters?: number;
  distanceBucket?: string;
  distanceText?: string;
  locationUpdatedAt?: string | null;
};

type CircleCardComponentDefinition = {
  key: string;
  type: 'scale' | 'single_choice' | 'multi_choice' | 'ranking';
  prompt: string;
  options?: unknown[];
  weight?: number;
  displayOrder?: number;
  isChannelTag?: boolean;
};

type CircleCardComponentPatch = {
  key?: string;
  type?: CircleCardComponentDefinition['type'];
  prompt?: string;
  options?: unknown[];
  weight?: number;
  displayOrder?: number;
  isChannelTag?: boolean;
};

type TeamupForumDeleteTarget = {
  id: string;
  leaderId: string;
  forumPostId: string | null;
};

async function markTeamupForumDeleteSucceeded(teamupId: string) {
  await db.update(teamups)
    .set({
      forumSyncStatus: 'synced',
      forumSyncError: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(teamups.id, teamupId));
}

async function markTeamupForumDeleteFailed(teamupId: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  await db.update(teamups)
    .set({
      forumSyncStatus: 'failed',
      forumSyncError: message.slice(0, 1000),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(teamups.id, teamupId));
}

async function deleteCancelledTeamupForumPost(target: TeamupForumDeleteTarget) {
  if (!TEAMUP_FORUM_SYNC_ENABLED) {
    await markTeamupForumDeleteSucceeded(target.id);
    return;
  }

  if (!target.forumPostId) {
    await markTeamupForumDeleteSucceeded(target.id);
    return;
  }

  try {
    await deletePost(target.leaderId, target.forumPostId);
    await markTeamupForumDeleteSucceeded(target.id);
  } catch (err) {
    if (err instanceof NotFoundError) {
      await markTeamupForumDeleteSucceeded(target.id);
      return;
    }
    await markTeamupForumDeleteFailed(target.id, err);
  }
}

function getCurrentWeekOf(): string {
  const now = new Date();
  const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const day = shifted.getUTCDay();
  const diff = day >= 3 ? day - 3 : day + 4;
  const wednesday = new Date(shifted.getTime());
  wednesday.setUTCDate(shifted.getUTCDate() - diff);
  const yyyy = wednesday.getUTCFullYear();
  const mm = String(wednesday.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(wednesday.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function ensureUserExists(userId: string) {
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!rows[0]) {
    throw new ValidationError('创建者不存在');
  }
}

function normalizeCircleTags(input?: string[] | null, fallbackTag?: string | null, maxTags = 5) {
  const source = input ?? (fallbackTag ? [fallbackTag] : []);
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const raw of source) {
    const value = String(raw ?? '').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
    if (normalized.length >= maxTags) break;
  }

  return normalized;
}

function toLegacyTag(tags: string[], fallbackTag?: string | null) {
  if (tags[0]) return tags[0];
  return (fallbackTag ?? '').trim();
}

function normalizeCircleStatus(input?: string | null, fallbackIsActive?: boolean) {
  const value = (input ?? '').trim();
  if (value) return value as CircleStatus;
  return fallbackIsActive === false ? CIRCLE_STATUS.INACTIVE : CIRCLE_STATUS.ACTIVE;
}

function statusToIsActive(status: string) {
  return status === CIRCLE_STATUS.ACTIVE;
}

function generateInviteCode() {
  return randomBytes(6).toString('base64url');
}

function buildCircleSlug(input: string) {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return slug || `circle-${uuid().slice(0, 8)}`;
}

function assertNoSensitiveContent(fields: Array<{ label: string; value: string | null | undefined }>) {
  assertNoKeywordRuleHits(fields);
}

function serializeCircle(circle: typeof circles.$inferSelect) {
  const tags = normalizeCircleTags(circle.tags, circle.tag);
  const status = normalizeCircleStatus(circle.status, circle.isActive);
  const {
    inviteCode: _inviteCode,
    inviteCodeHash: _inviteCodeHash,
    keywordRules: _keywordRules,
    ...safeCircle
  } = circle;

  return {
    ...safeCircle,
    tag: toLegacyTag(tags, circle.tag),
    tags,
    status,
    isActive: statusToIsActive(status),
    joinQuestions: normalizeJoinQuestions(circle.joinQuestions, circle.joinQuestion),
    hasInviteCode: Boolean(circle.inviteCodeHash || circle.inviteCode),
  };
}

function serializeCircleForManagement(circle: typeof circles.$inferSelect, plainInviteCode?: string | null) {
  return {
    ...serializeCircle(circle),
    keywordRules: normalizeKeywordRules(circle.keywordRules),
    ...(plainInviteCode ? { inviteCode: plainInviteCode } : {}),
  };
}

async function ensureCircleExists(circleId: string) {
  const rows = await db.select({ id: circles.id }).from(circles).where(eq(circles.id, circleId)).limit(1);
  if (!rows[0]) throw new NotFoundError('圈子不存在');
}

async function ensureActiveCircleMember(circleId: string, userId: string) {
  const rows = await db.select({
    circleId: circles.id,
    circleIsActive: circles.isActive,
    circleStatus: circles.status,
    memberId: circleMembers.id,
    membershipStatus: circleMembers.membershipStatus,
    memberIsActive: circleMembers.isActive,
  }).from(circles)
    .leftJoin(circleMembers, and(
      eq(circleMembers.circleId, circles.id),
      eq(circleMembers.userId, userId),
    ))
    .where(eq(circles.id, circleId))
    .limit(1);

  const row = rows[0];
  if (!row) throw new NotFoundError('圈子不存在');
  if (!row.circleIsActive || row.circleStatus !== CIRCLE_STATUS.ACTIVE) {
    throw new ForbiddenError('圈子已下架或不可用');
  }
  if (!row.memberId || row.membershipStatus !== CIRCLE_MEMBERSHIP_STATUS.ACTIVE || !row.memberIsActive) {
    throw new ForbiddenError('仅圈子活跃成员可使用该功能');
  }
}

function pickViewerRole(roles: string[]) {
  if (roles.includes(CIRCLE_MEMBER_ROLE.OWNER)) return CIRCLE_MEMBER_ROLE.OWNER;
  if (roles.includes(CIRCLE_MEMBER_ROLE.ADMIN)) return CIRCLE_MEMBER_ROLE.ADMIN;
  if (roles.includes(CIRCLE_MEMBER_ROLE.MODERATOR)) return CIRCLE_MEMBER_ROLE.MODERATOR;
  return null;
}

function getViewerPermissions(role: string | null, membershipStatus?: string | null) {
  const isOwner = role === CIRCLE_MEMBER_ROLE.OWNER;
  const canReview = isOwner;

  return {
    canManage: isOwner,
    canEdit: isOwner,
    canReviewJoinRequests: canReview,
    canManageMembers: isOwner,
    canManageBlacklist: isOwner,
    canTransferOwner: isOwner,
    canDissolve: isOwner,
    canViewManage: isOwner,
    canPostAsMember: membershipStatus === CIRCLE_MEMBERSHIP_STATUS.ACTIVE,
  };
}

async function getViewerRole(circleId: string, userId: string) {
  const rows = await db.select({ role: circleMemberRoles.role }).from(circleMemberRoles)
    .where(and(eq(circleMemberRoles.circleId, circleId), eq(circleMemberRoles.userId, userId)));

  return pickViewerRole(rows.map((row) => row.role));
}

async function ensureCircleOwner(circleId: string, userId: string) {
  await ensureCircleExists(circleId);
  const role = await getViewerRole(circleId, userId);
  if (role !== CIRCLE_MEMBER_ROLE.OWNER) {
    throw new ForbiddenError('只有圈主可以管理该圈子');
  }
}

async function ensureNotCircleBlacklisted(circleId: string, userId: string) {
  const rows = await db.select({ id: circleBlacklist.id }).from(circleBlacklist)
    .where(and(eq(circleBlacklist.circleId, circleId), eq(circleBlacklist.userId, userId)))
    .limit(1);

  if (rows[0]) {
    throw new ValidationError('暂时无法申请加入该圈子');
  }
}

function assertCircleDetailVisible(
  circle: typeof circles.$inferSelect,
  userId: string,
  viewerRole: string | null,
) {
  if (circle.status === CIRCLE_STATUS.ACTIVE && circle.isActive) return;
  if (circle.creatorId === userId || viewerRole === CIRCLE_MEMBER_ROLE.OWNER) return;
  throw new NotFoundError('圈子不存在');
}

async function getCircleOwnerIds(client: any, circleId: string, creatorId?: string | null) {
  const rows = await client.select({ userId: circleMemberRoles.userId }).from(circleMemberRoles)
    .where(and(
      eq(circleMemberRoles.circleId, circleId),
      eq(circleMemberRoles.role, CIRCLE_MEMBER_ROLE.OWNER),
    ));
  return Array.from(new Set([
    ...rows.map((row: { userId: string }) => row.userId),
    ...(creatorId ? [creatorId] : []),
  ]));
}

async function lockCircleForUpdate(client: any, circleId: string) {
  await client.execute(sql`
    SELECT id
    FROM circles
    WHERE id = ${circleId}
    FOR UPDATE
  `);

  const rows = await client.select().from(circles)
    .where(eq(circles.id, circleId))
    .limit(1);
  const circle = rows[0] as typeof circles.$inferSelect | undefined;
  if (!circle) throw new NotFoundError('圈子不存在');
  return circle;
}

async function removeCircleMembershipAndCleanup(
  client: any,
  circleId: string,
  userId: string,
  now: string,
  leaderCancelReason: string,
) {
  const deletedMemberships = await client.delete(circleMembers)
    .where(and(
      eq(circleMembers.circleId, circleId),
      eq(circleMembers.userId, userId),
      eq(circleMembers.membershipStatus, CIRCLE_MEMBERSHIP_STATUS.ACTIVE),
    ))
    .returning({ id: circleMembers.id });

  if (deletedMemberships.length === 0) {
    throw new NotFoundError('你未加入该圈子');
  }

  await client.delete(circleMemberLocations)
    .where(and(
      eq(circleMemberLocations.circleId, circleId),
      eq(circleMemberLocations.userId, userId),
    ));

  await client.execute(sql`
    SELECT id
    FROM teamups
    WHERE circle_id = ${circleId}
      AND status IN ('recruiting', 'full')
      AND end_at > ${now}
      AND (
        leader_id = ${userId}
        OR id IN (
          SELECT teamup_id
          FROM teamup_members
          WHERE user_id = ${userId}
            AND membership_status = 'active'
        )
      )
    FOR UPDATE
  `);

  const ledTeamups = await client.update(teamups)
    .set({
      status: 'cancelled',
      cancelSource: 'leader',
      cancelReason: leaderCancelReason,
      cancelledBy: userId,
      cancelledAt: now,
      forumSyncStatus: TEAMUP_FORUM_SYNC_ENABLED ? sql`CASE WHEN ${teamups.isPublic} THEN 'pending' ELSE ${teamups.forumSyncStatus} END` : sql`${teamups.forumSyncStatus}`,
      updatedAt: now,
    })
    .where(and(
      eq(teamups.circleId, circleId),
      eq(teamups.leaderId, userId),
      inArray(teamups.status, ['recruiting', 'full']),
      sql`${teamups.endAt} > ${now}`,
    ))
    .returning();

  const ledTeamupIds = ledTeamups.map((teamup: typeof teamups.$inferSelect) => teamup.id);
  if (ledTeamupIds.length > 0) {
    await client.update(teamupMembers)
      .set({ membershipStatus: 'cancelled', updatedAt: now })
      .where(and(
        inArray(teamupMembers.teamupId, ledTeamupIds),
        eq(teamupMembers.membershipStatus, 'active'),
      ));
  }

  const leftTeamupMembers = await client.update(teamupMembers)
    .set({ membershipStatus: 'left', leftAt: now, updatedAt: now })
    .where(and(
      eq(teamupMembers.userId, userId),
      eq(teamupMembers.membershipStatus, 'active'),
      sql`${teamupMembers.memberRole} <> 'leader'`,
      sql`${teamupMembers.teamupId} IN (
        SELECT id
        FROM teamups
        WHERE circle_id = ${circleId}
          AND status IN ('recruiting', 'full')
          AND end_at > ${now}
      )`,
    ))
    .returning({ teamupId: teamupMembers.teamupId });

  const leftCountByTeamup = new Map<string, number>();
  for (const member of leftTeamupMembers) {
    leftCountByTeamup.set(member.teamupId, (leftCountByTeamup.get(member.teamupId) ?? 0) + 1);
  }

  const touchedTeamups = [...ledTeamups];
  for (const [teamupId, leftCount] of leftCountByTeamup.entries()) {
    const updatedTeamups = await client.update(teamups)
      .set({
        currentMemberCount: sql`GREATEST(${teamups.currentMemberCount} - ${leftCount}, 0)`,
        status: sql`CASE WHEN ${teamups.status} = 'full' AND ${teamups.deadlineAt} > ${now} AND ${teamups.endAt} > ${now} THEN 'recruiting' ELSE ${teamups.status} END`,
        forumSyncStatus: TEAMUP_FORUM_SYNC_ENABLED ? sql`CASE WHEN ${teamups.isPublic} THEN 'pending' ELSE ${teamups.forumSyncStatus} END` : sql`${teamups.forumSyncStatus}`,
        updatedAt: now,
      })
      .where(eq(teamups.id, teamupId))
      .returning();
    if (updatedTeamups[0]) touchedTeamups.push(updatedTeamups[0]);
  }

  const cancelledForumTeamups = TEAMUP_FORUM_SYNC_ENABLED
    ? ledTeamups.filter((teamup: typeof teamups.$inferSelect) => teamup.isPublic).map((teamup: typeof teamups.$inferSelect) => ({
      id: teamup.id,
      leaderId: teamup.leaderId,
      forumPostId: teamup.forumPostId,
    }))
    : [];

  const publicTouchedTeamups = TEAMUP_FORUM_SYNC_ENABLED
    ? touchedTeamups.filter((teamup: typeof teamups.$inferSelect) => teamup.isPublic && teamup.status !== 'cancelled')
    : [];
  if (publicTouchedTeamups.length > 0) {
    await client.insert(teamupForumSyncJobs).values(publicTouchedTeamups.map((teamup: typeof teamups.$inferSelect) => ({
      id: uuid(),
      teamupId: teamup.id,
      action: teamup.status === 'cancelled' ? 'archive' : 'update',
      payload: {
        id: teamup.id,
        circleId: teamup.circleId,
        leaderId: teamup.leaderId,
        title: teamup.title,
        descriptionPreview: teamup.descriptionPreview,
        maxMembers: teamup.maxMembers,
        currentMemberCount: teamup.currentMemberCount,
        deadlineAt: teamup.deadlineAt,
        endAt: teamup.endAt,
        joinMode: teamup.joinMode,
        isPublic: teamup.isPublic,
        status: teamup.status,
        effectiveStatus: teamup.status === 'cancelled' ? 'cancelled' : teamup.status,
        joinable: false,
        leader: null,
        updatedAt: teamup.updatedAt,
      },
      status: 'pending',
      attemptCount: 0,
      nextRetryAt: now,
      createdAt: now,
      updatedAt: now,
    })));
  }

  await client.update(teamupApplications)
    .set({ status: 'withdrawn', updatedAt: now })
    .where(and(
      eq(teamupApplications.applicantId, userId),
      eq(teamupApplications.status, 'pending'),
      sql`${teamupApplications.teamupId} IN (
        SELECT id
        FROM teamups
        WHERE circle_id = ${circleId}
      )`,
    ));

  const rejectedFriendRequests = await client.update(friendRequests)
    .set({ status: 'rejected', updatedAt: now })
    .where(and(
      eq(friendRequests.circleId, circleId),
      eq(friendRequests.status, 'pending'),
      or(eq(friendRequests.senderId, userId), eq(friendRequests.receiverId, userId)),
    ))
    .returning({ id: friendRequests.id });

  const rejectedContactRequests = await client.update(contactUnlockRequests)
    .set({ status: 'rejected', updatedAt: now })
    .where(and(
      eq(contactUnlockRequests.circleId, circleId),
      eq(contactUnlockRequests.status, 'pending'),
      or(eq(contactUnlockRequests.requesterId, userId), eq(contactUnlockRequests.targetId, userId)),
    ))
    .returning({ id: contactUnlockRequests.id });

  const removedRoles = await client.delete(circleMemberRoles)
    .where(and(eq(circleMemberRoles.circleId, circleId), eq(circleMemberRoles.userId, userId)))
    .returning({ id: circleMemberRoles.id });

  const removedFriendships = await client.delete(friendships)
    .where(and(
      eq(friendships.circleId, circleId),
      or(
        eq(friendships.userAId, userId),
        eq(friendships.userBId, userId),
      ),
    ))
    .returning({
      id: friendships.id,
      userAId: friendships.userAId,
      userBId: friendships.userBId,
    });

  const authorizationCleanup = await revokeOrphanedGlobalFriendshipsForCirclePairs(removedFriendships, client);

  await client.update(circles)
    .set({ memberCount: sql`GREATEST(${circles.memberCount} - 1, 0)`, updatedAt: now })
    .where(eq(circles.id, circleId));

  return {
    removedFriendshipCount: removedFriendships.length,
    revokedGlobalFriendshipCount: authorizationCleanup.revokedGlobalFriendshipCount,
    deletedContactUnlockCount: authorizationCleanup.deletedContactUnlockCount,
    rejectedFriendRequestCount: rejectedFriendRequests.length,
    rejectedContactRequestCount: rejectedContactRequests.length,
    removedRoleCount: removedRoles.length,
    cancelledTeamupCount: ledTeamupIds.length,
    leftTeamupCount: leftCountByTeamup.size,
    cancelledForumTeamups,
  };
}

async function expirePendingJoinRequests(circleId?: string, userId?: string) {
  const conditions = [
    eq(circleJoinRequests.status, CIRCLE_JOIN_REQUEST_STATUS.PENDING_REVIEW),
    sql`${circleJoinRequests.expiresAt} IS NOT NULL`,
    sql`${circleJoinRequests.expiresAt} < NOW()`,
  ];

  if (circleId) conditions.push(eq(circleJoinRequests.circleId, circleId));
  if (userId) conditions.push(eq(circleJoinRequests.userId, userId));

  await db.update(circleJoinRequests)
    .set({
      status: CIRCLE_JOIN_REQUEST_STATUS.EXPIRED,
      updatedAt: new Date().toISOString(),
    })
    .where(and(...conditions));
}

async function ensureCreatorMembershipAndRole(client: any, circleId: string, creatorId: string, now: string) {
  const memberRows = await client.select().from(circleMembers)
    .where(and(eq(circleMembers.circleId, circleId), eq(circleMembers.userId, creatorId)))
    .limit(1);
  const existingMember = memberRows[0] as typeof circleMembers.$inferSelect | undefined;
  const shouldIncrement = !existingMember
    || existingMember.membershipStatus !== CIRCLE_MEMBERSHIP_STATUS.ACTIVE
    || !existingMember.isActive;

  if (existingMember) {
    await client.update(circleMembers)
      .set({
        membershipStatus: CIRCLE_MEMBERSHIP_STATUS.ACTIVE,
        isActive: true,
        updatedAt: now,
      })
      .where(eq(circleMembers.id, existingMember.id));
  } else {
    await client.insert(circleMembers).values({
      id: uuid(),
      circleId,
      userId: creatorId,
      membershipStatus: CIRCLE_MEMBERSHIP_STATUS.ACTIVE,
      isActive: true,
      joinedAt: now,
      updatedAt: now,
    });
  }

  if (shouldIncrement) {
    await client.update(circles)
      .set({ memberCount: sql`${circles.memberCount} + 1`, updatedAt: now })
      .where(eq(circles.id, circleId));
  }

  await client.insert(circleMemberRoles).values({
    id: uuid(),
    circleId,
    userId: creatorId,
    role: CIRCLE_MEMBER_ROLE.OWNER,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing();

  await initializeCardsOnCircleJoin(creatorId, circleId, client);
}

function normalizeCircleCardComponentDefinition(
  component: CircleCardComponentDefinition,
  fallbackDisplayOrder: number,
): CircleCardComponentDefinition {
  if (component.isChannelTag && (
    isSensitiveFieldText(component.key)
    || isSensitiveFieldText(component.prompt)
  )) {
    throw new ValidationError('联系方式、学号或私密字段不能设为频道展示字段');
  }

  return {
    key: component.key,
    type: component.type,
    prompt: component.prompt,
    options: component.options ?? undefined,
    weight: component.weight ?? 1.0,
    displayOrder: component.displayOrder ?? fallbackDisplayOrder,
    isChannelTag: component.isChannelTag ?? false,
  };
}

function sortAndReindexCircleCardComponents(components: CircleCardComponentDefinition[]) {
  return components
    .map((component, index) => normalizeCircleCardComponentDefinition(component, index))
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
    .map((component, index) => ({
      ...component,
      displayOrder: index,
    }));
}

async function listCircleCardComponentDefinitions(circleId: string): Promise<CircleCardComponentDefinition[]> {
  await ensureCircleExists(circleId);

  const components = await db.select().from(circleQuestions)
    .where(eq(circleQuestions.circleId, circleId))
    .orderBy(circleQuestions.displayOrder);

  return components.map((component) => ({
    key: component.key,
    type: component.type as CircleCardComponentDefinition['type'],
    prompt: component.prompt,
    options: component.options ? JSON.parse(component.options) : undefined,
    weight: component.weight ?? 1.0,
    displayOrder: component.displayOrder ?? 0,
    isChannelTag: component.isChannelTag ?? false,
  }));
}

async function persistCircleCardComponentDefinitions(
  circleId: string,
  components: CircleCardComponentDefinition[],
) {
  await ensureCircleExists(circleId);

  const seen = new Set<string>();
  const normalized = sortAndReindexCircleCardComponents(components).map((component) => {
    if (seen.has(component.key)) {
      throw new ConflictError('B区组件 key 不能重复');
    }
    seen.add(component.key);
    return component;
  });

  await db.delete(circleQuestions).where(eq(circleQuestions.circleId, circleId));

  if (normalized.length > 0) {
    await db.insert(circleQuestions).values(
      normalized.map((component) => ({
        id: uuid(),
        circleId,
        key: component.key,
        type: component.type,
        prompt: component.prompt,
        options: component.options ? JSON.stringify(component.options) : null,
        weight: component.weight ?? 1.0,
        displayOrder: component.displayOrder ?? 0,
        isChannelTag: component.isChannelTag ?? false,
      })),
    );
  }

  return normalized;
}

// ─── Circle Discovery (public) ─────────────────────────────────

function buildRecommendationReasons(
  circle: typeof circles.$inferSelect,
  creator: { department: string | null; grade: string | null } | null,
  viewer: { department: string | null; grade: string | null } | null,
  requestedTags: string[],
) {
  const reasons: string[] = [];
  const tags = normalizeCircleTags(circle.tags, circle.tag);

  if (requestedTags.some((tag) => tags.includes(tag))) {
    reasons.push('匹配兴趣标签');
  }
  if (viewer?.department && creator?.department && viewer.department === creator.department) {
    reasons.push('同院系');
  }
  if (viewer?.grade && creator?.grade && viewer.grade === creator.grade) {
    reasons.push('同年级');
  }
  if (circle.memberCount > 0) {
    reasons.push('热门圈子');
  }

  return reasons.length > 0 ? reasons : ['推荐探索'];
}

export async function listCircles(userId: string, options: ListCirclesOptions = {}) {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(50, Math.max(1, options.limit ?? 20));
  const offset = (page - 1) * limit;
  const sort = options.sort ?? 'recommended';

  const memberships = await db.select({ circleId: circleMembers.circleId }).from(circleMembers)
    .where(eq(circleMembers.userId, userId));

  const viewerRows = await db.select({
    department: users.department,
    grade: users.grade,
  }).from(users).where(eq(users.id, userId)).limit(1);
  const viewer = viewerRows[0] ?? null;

  const filters = [
    eq(circles.isActive, true),
    eq(circles.status, CIRCLE_STATUS.ACTIVE),
  ];
  if (options.category) {
    filters.push(eq(circles.category, options.category));
  }
  if (options.keywords?.length) {
    const termFilters = options.keywords.slice(0, 8).map((term) => {
      const pattern = `%${escapeLikeWildcards(term.trim())}%`;
      return sql`(${circles.name} ILIKE ${pattern} OR ${circles.description} ILIKE ${pattern} OR ${circles.tag} ILIKE ${pattern} OR ${circles.tags}::text ILIKE ${pattern})`;
    });
    filters.push(or(...termFilters)!);
  } else if (options.keyword) {
    const keyword = `%${escapeLikeWildcards(options.keyword.trim())}%`;
    filters.push(sql`(${circles.name} ILIKE ${keyword} OR ${circles.description} ILIKE ${keyword} OR ${circles.tag} ILIKE ${keyword})`);
  }
  const requestedTags = normalizeCircleTags(options.tags, null);
  for (const tag of requestedTags) {
    const tagFilter = or(
      eq(circles.tag, tag),
      sql`${circles.tags} @> ${JSON.stringify([tag])}::jsonb`,
    );
    if (tagFilter) filters.push(tagFilter);
  }
  if (options.department) {
    filters.push(eq(users.department, options.department));
  }
  if (options.grade) {
    filters.push(eq(users.grade, options.grade));
  }

  if (!options.includeJoined && memberships.length > 0) {
    const joinedCircleIds = memberships.map((membership) => membership.circleId);
    filters.push(sql`${circles.id} NOT IN (${sql.join(joinedCircleIds.map((id) => sql`${id}`), sql`, `)})`);
  }

  const where = and(...filters);
  const [totalRow] = await db.select({ total: sql<number>`count(*)::int` }).from(circles)
    .leftJoin(users, eq(circles.creatorId, users.id))
    .where(where);

  const orderBy = sort === 'latest'
    ? [desc(circles.createdAt)]
    : sort === 'members' || sort === 'active'
      ? [desc(circles.memberCount), desc(circles.createdAt)]
      : [desc(circles.memberCount), desc(circles.createdAt)];

  const rows = await db.select().from(circles)
    .leftJoin(users, eq(circles.creatorId, users.id))
    .where(where)
    .orderBy(...orderBy)
    .limit(limit)
    .offset(offset);

  const joinedCircleIds = new Set(memberships.map((membership) => membership.circleId));
  return {
    total: Number(totalRow?.total ?? 0),
    page,
    limit,
    circles: rows.map((row) => ({
      ...serializeCircle(row.circles),
      isJoined: joinedCircleIds.has(row.circles.id),
      recommendation: {
        reasons: buildRecommendationReasons(row.circles, row.users, viewer, requestedTags),
      },
    })),
  };
}

export async function getCircleDetail(circleId: string, userId: string) {
  const rows = await db.select().from(circles).where(eq(circles.id, circleId)).limit(1);
  const circle = rows[0];
  if (!circle) throw new NotFoundError('圈子不存在');

  const memberships = await db.select({
    id: circleMembers.id,
    membershipStatus: circleMembers.membershipStatus,
  }).from(circleMembers)
    .where(and(eq(circleMembers.circleId, circleId), eq(circleMembers.userId, userId)))
    .limit(1);
  const membership = memberships[0];
  const viewerRole = await getViewerRole(circleId, userId);
  assertCircleDetailVisible(circle, userId, viewerRole);

  const components = await db.select().from(circleQuestions)
    .where(eq(circleQuestions.circleId, circleId))
    .orderBy(circleQuestions.displayOrder);

  return {
    ...serializeCircle(circle),
    isJoined: membership?.membershipStatus === CIRCLE_MEMBERSHIP_STATUS.ACTIVE,
    membershipStatus: membership?.membershipStatus ?? null,
    joinPolicy: circle.joinPolicy,
    viewerRole,
    viewerPermissions: getViewerPermissions(viewerRole, membership?.membershipStatus ?? null),
    components: components.map((q) => ({
      ...q,
      options: q.options ? JSON.parse(q.options) : null,
    })),
  };
}

function formatChannelTagValue(raw: unknown): string {
  if (Array.isArray(raw)) return raw.map((item) => String(item)).join(' / ');
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
    return String(raw);
  }
  return JSON.stringify(raw);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function assertValidLocationInput(payload: UpdateCircleLocationPayload) {
  if (!isFiniteNumber(payload.latitude) || payload.latitude < -90 || payload.latitude > 90) {
    throw new AppError(400, 'INVALID_LOCATION', '纬度字段非法');
  }
  if (!isFiniteNumber(payload.longitude) || payload.longitude < -180 || payload.longitude > 180) {
    throw new AppError(400, 'INVALID_LOCATION', '经度字段非法');
  }
  if (!isFiniteNumber(payload.accuracyMeters) || payload.accuracyMeters <= 0) {
    throw new AppError(400, 'INVALID_LOCATION', '定位精度字段非法');
  }
  if (payload.accuracyMeters > LOCATION_MAX_ACCURACY_METERS) {
    throw new AppError(400, 'LOCATION_ACCURACY_TOO_LOW', '定位精度过低，请在信号较好的位置重试');
  }
  if (payload.capturedAt && Number.isNaN(Date.parse(payload.capturedAt))) {
    throw new AppError(400, 'INVALID_LOCATION', 'capturedAt 必须是合法时间');
  }
}

function locationAccuracyBucket(accuracyMeters?: number | null) {
  if (!isFiniteNumber(accuracyMeters)) return 'unknown';
  if (accuracyMeters <= 50) return 'under_50m';
  if (accuracyMeters <= 100) return '50m_100m';
  if (accuracyMeters <= 500) return '100m_500m';
  return '500m_plus';
}

function serializeCircleLocationStatus(row?: typeof circleMemberLocations.$inferSelect | null) {
  const now = Date.now();
  const hasValidLocation = Boolean(
    row
    && row.isEnabled
    && row.expiresAt
    && Date.parse(row.expiresAt) > now,
  );

  return {
    enabled: Boolean(row?.isEnabled),
    hasValidLocation,
    ...(row?.accuracyMeters !== undefined && row?.accuracyMeters !== null ? { accuracyMeters: row.accuracyMeters } : {}),
    ...(row?.updatedAt ? { lastUpdatedAt: row.updatedAt } : {}),
    ...(row?.expiresAt ? { expiresAt: row.expiresAt } : {}),
  };
}

async function getValidCircleLocation(circleId: string, userId: string) {
  const rows = await db.select().from(circleMemberLocations)
    .where(and(
      eq(circleMemberLocations.circleId, circleId),
      eq(circleMemberLocations.userId, userId),
      eq(circleMemberLocations.isEnabled, true),
      sql`${circleMemberLocations.expiresAt} > NOW()`,
    ))
    .limit(1);

  return rows[0] ?? null;
}

function toRadians(value: number) {
  return value * Math.PI / 180;
}

function calculateDistanceMeters(
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number,
) {
  const deltaLatitude = toRadians(toLatitude - fromLatitude);
  const deltaLongitude = toRadians(toLongitude - fromLongitude);
  const fromLatRad = toRadians(fromLatitude);
  const toLatRad = toRadians(toLatitude);

  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(fromLatRad) * Math.cos(toLatRad) * Math.sin(deltaLongitude / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getDistanceBucket(distanceMeters: number) {
  return DISTANCE_BUCKETS.find((bucket) => distanceMeters <= bucket.upperBoundMeters)
    ?? DISTANCE_BUCKETS[DISTANCE_BUCKETS.length - 1]!;
}

function getNearbyBoundingBox(latitude: number, longitude: number, radiusMeters: number) {
  const latitudeDelta = radiusMeters / 111320;
  const longitudeDelta = radiusMeters / (111320 * Math.max(Math.abs(Math.cos(toRadians(latitude))), 0.01));

  return {
    minLatitude: Math.max(-90, latitude - latitudeDelta),
    maxLatitude: Math.min(90, latitude + latitudeDelta),
    minLongitude: Math.max(-180, longitude - longitudeDelta),
    maxLongitude: Math.min(180, longitude + longitudeDelta),
  };
}

function buildNoBlockSql(viewerId: string, peerUserIdSql: unknown) {
  return sql`NOT EXISTS (
    SELECT 1
    FROM user_blocks ub
    WHERE (
      ub.blocker_id = ${viewerId}
      AND ub.blocked_id = ${peerUserIdSql}
    ) OR (
      ub.blocked_id = ${viewerId}
      AND ub.blocker_id = ${peerUserIdSql}
    )
  )`;
}

async function buildChannelMemberCards(circleId: string, memberRows: ChannelMemberBase[]) {
  if (memberRows.length === 0) return [];

  const channelQuestionsRows = await db.select({
    key: circleQuestions.key,
    label: circleQuestions.prompt,
    displayOrder: circleQuestions.displayOrder,
  }).from(circleQuestions).where(and(
    eq(circleQuestions.circleId, circleId),
    eq(circleQuestions.isChannelTag, true),
  )).orderBy(circleQuestions.displayOrder);

  const safeChannelQuestions = channelQuestionsRows.filter((question) => (
    !isSensitiveFieldText(question.key)
    && !isSensitiveFieldText(question.label)
  ));

  const memberIds = memberRows.map((member) => member.userId);
  const circleCardRows = await db.select({
    userId: userCircleCards.userId,
    components: userCircleCards.components,
  }).from(userCircleCards)
    .where(and(
      eq(userCircleCards.circleId, circleId),
      inArray(userCircleCards.userId, memberIds),
    ));

  const circleCardMap = new Map(
    circleCardRows.map((row) => [
      row.userId,
      ((row.components ?? []) as Array<{ key: string; value: unknown; status?: string }>),
    ]),
  );

  return memberRows.map((member) => {
    const components = circleCardMap.get(member.userId) ?? [];
    const channelTags = safeChannelQuestions.flatMap((question) => {
      const component = components.find((item) => item.key === question.key);
      if (
        !component
        || component.status !== 'public'
        || component.value === undefined
        || component.value === null
        || component.value === ''
        || containsSensitiveContactValue(component.value)
      ) {
        return [];
      }

      return [{
        key: question.key,
        label: question.label,
        value: formatChannelTagValue(component.value),
      }];
    });

    return {
      userId: member.userId,
      nickname: member.nickname ?? '未命名用户',
      avatarUrl: member.avatarUrl ?? undefined,
      channelTags,
      distanceMeters: member.distanceMeters,
      distanceBucket: member.distanceBucket,
      distanceText: member.distanceText,
      locationUpdatedAt: member.locationUpdatedAt ?? undefined,
      infoScore: channelTags.length,
      joinedAt: member.joinedAt,
    };
  });
}

export async function getCircleLocationStatus(circleId: string, userId: string) {
  await ensureActiveCircleMember(circleId, userId);

  const rows = await db.select().from(circleMemberLocations)
    .where(and(
      eq(circleMemberLocations.circleId, circleId),
      eq(circleMemberLocations.userId, userId),
    ))
    .limit(1);

  return serializeCircleLocationStatus(rows[0]);
}

export async function updateCircleLocation(
  circleId: string,
  userId: string,
  payload: UpdateCircleLocationPayload,
) {
  await ensureActiveCircleMember(circleId, userId);
  assertValidLocationInput(payload);

  const now = new Date();
  const capturedAt = payload.capturedAt ? new Date(payload.capturedAt) : now;
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + LOCATION_TTL_MS).toISOString();

  const rows = await db.transaction(async (tx) => {
    const previousRows = await tx.select({
      id: circleMemberLocations.id,
      isEnabled: circleMemberLocations.isEnabled,
      accuracyMeters: circleMemberLocations.accuracyMeters,
      expiresAt: circleMemberLocations.expiresAt,
    }).from(circleMemberLocations)
      .where(and(
        eq(circleMemberLocations.circleId, circleId),
        eq(circleMemberLocations.userId, userId),
      ))
      .limit(1);

    const cooldownRows = await tx.select({
      lastUpdatedAt: circleMemberLocationCooldowns.lastUpdatedAt,
    }).from(circleMemberLocationCooldowns)
      .where(and(
        eq(circleMemberLocationCooldowns.circleId, circleId),
        eq(circleMemberLocationCooldowns.userId, userId),
      ))
      .limit(1);

    const lastUpdatedAt = cooldownRows[0]?.lastUpdatedAt ? Date.parse(cooldownRows[0].lastUpdatedAt) : NaN;
    if (Number.isFinite(lastUpdatedAt) && now.getTime() - lastUpdatedAt < LOCATION_MIN_UPDATE_INTERVAL_MS) {
      throw new AppError(429, 'LOCATION_UPDATE_TOO_FREQUENT', '位置刷新太频繁，请稍后再试');
    }

    await tx.insert(circleMemberLocationCooldowns).values({
      id: uuid(),
      circleId,
      userId,
      lastUpdatedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    }).onConflictDoUpdate({
      target: [circleMemberLocationCooldowns.circleId, circleMemberLocationCooldowns.userId],
      set: {
        lastUpdatedAt: nowIso,
        updatedAt: nowIso,
      },
    });

    const updatedRows = await tx.insert(circleMemberLocations).values({
      id: uuid(),
      circleId,
      userId,
      latitude: payload.latitude,
      longitude: payload.longitude,
      accuracyMeters: Math.round(payload.accuracyMeters),
      isEnabled: true,
      capturedAt: capturedAt.toISOString(),
      expiresAt,
      createdAt: nowIso,
      updatedAt: nowIso,
    }).onConflictDoUpdate({
      target: [circleMemberLocations.circleId, circleMemberLocations.userId],
      set: {
        latitude: payload.latitude,
        longitude: payload.longitude,
        accuracyMeters: Math.round(payload.accuracyMeters),
        isEnabled: true,
        capturedAt: capturedAt.toISOString(),
        expiresAt,
        updatedAt: nowIso,
      },
    }).returning();

    const previous = previousRows[0];
    await tx.insert(auditLogs).values({
      operatorId: userId,
      action: 'circle_location_updated',
      target: circleId,
      detail: JSON.stringify({
        circleId,
        hadPreviousLocation: Boolean(previous),
        isEnabled: { from: previous?.isEnabled ?? false, to: true },
        accuracyBucket: {
          from: locationAccuracyBucket(previous?.accuracyMeters),
          to: locationAccuracyBucket(Math.round(payload.accuracyMeters)),
        },
        previousHadValidLocation: Boolean(
          previous?.isEnabled
          && previous?.expiresAt
          && Date.parse(previous?.expiresAt ?? '') > now.getTime(),
        ),
        expiresAt,
        capturedAt: capturedAt.toISOString(),
      }),
      createdAt: nowIso,
    });

    return updatedRows;
  });

  return {
    ...serializeCircleLocationStatus(rows[0]),
    message: '已更新附近位置',
  };
}

export async function disableCircleLocation(circleId: string, userId: string) {
  await ensureActiveCircleMember(circleId, userId);

  await db.transaction(async (tx) => {
    const now = new Date().toISOString();
    const deletedRows = await tx.delete(circleMemberLocations)
      .where(and(
        eq(circleMemberLocations.circleId, circleId),
        eq(circleMemberLocations.userId, userId),
      ))
      .returning({
        id: circleMemberLocations.id,
        isEnabled: circleMemberLocations.isEnabled,
        accuracyMeters: circleMemberLocations.accuracyMeters,
        expiresAt: circleMemberLocations.expiresAt,
      });

    const deleted = deletedRows[0];
    await tx.insert(auditLogs).values({
      operatorId: userId,
      action: 'circle_location_disabled',
      target: circleId,
      detail: JSON.stringify({
        circleId,
        deletedLocationCount: deletedRows.length,
        wasEnabled: deleted?.isEnabled ?? false,
        previousAccuracyBucket: locationAccuracyBucket(deleted?.accuracyMeters),
        previousHadValidLocation: Boolean(
          deleted?.isEnabled
          && deleted?.expiresAt
          && Date.parse(deleted?.expiresAt ?? '') > Date.now(),
        ),
      }),
      createdAt: now,
    });
  });

  return {
    enabled: false,
    hasValidLocation: false,
    message: '已关闭附近位置展示',
  };
}

async function getNearbyChannelMembers(
  viewerId: string,
  circleId: string,
  page: number,
  limit: number,
  options: ChannelMembersOptions,
) {
  await ensureActiveCircleMember(circleId, viewerId);

  const origin = await getValidCircleLocation(circleId, viewerId);
  if (!origin) {
    throw new AppError(400, 'LOCATION_REQUIRED', '请先开启并刷新附近位置');
  }

  const requestedRadiusMeters = options.radiusMeters;
  if (
    requestedRadiusMeters !== undefined
    && (
      !Number.isFinite(requestedRadiusMeters)
      || requestedRadiusMeters < NEARBY_MIN_RADIUS_METERS
      || requestedRadiusMeters > NEARBY_MAX_RADIUS_METERS
    )
  ) {
    throw new AppError(400, 'INVALID_RADIUS', '附近半径需在 100 到 50000 米之间');
  }

  const effectiveRadiusMeters = requestedRadiusMeters ?? NEARBY_DEFAULT_RADIUS_METERS;
  const boundingBox = getNearbyBoundingBox(origin.latitude, origin.longitude, effectiveRadiusMeters);

  const locatedCandidateRows = await db.select({
    userId: circleMembers.userId,
    nickname: users.nickname,
    avatarUrl: users.avatarUrl,
    joinedAt: circleMembers.joinedAt,
    latitude: circleMemberLocations.latitude,
    longitude: circleMemberLocations.longitude,
    locationUpdatedAt: circleMemberLocations.updatedAt,
  }).from(circleMemberLocations)
    .innerJoin(circleMembers, and(
      eq(circleMembers.circleId, circleMemberLocations.circleId),
      eq(circleMembers.userId, circleMemberLocations.userId),
    ))
    .innerJoin(users, eq(circleMembers.userId, users.id))
    .where(and(
      eq(circleMemberLocations.circleId, circleId),
      eq(circleMemberLocations.isEnabled, true),
      sql`${circleMemberLocations.expiresAt} > NOW()`,
      sql`${circleMemberLocations.userId} <> ${viewerId}`,
      eq(circleMembers.membershipStatus, CIRCLE_MEMBERSHIP_STATUS.ACTIVE),
      eq(circleMembers.isActive, true),
      buildNoBlockSql(viewerId, circleMemberLocations.userId),
      sql`${circleMemberLocations.latitude} >= ${boundingBox.minLatitude}`,
      sql`${circleMemberLocations.latitude} <= ${boundingBox.maxLatitude}`,
      sql`${circleMemberLocations.longitude} >= ${boundingBox.minLongitude}`,
      sql`${circleMemberLocations.longitude} <= ${boundingBox.maxLongitude}`,
    ))
    .orderBy(sql`abs(${circleMemberLocations.latitude} - ${origin.latitude}) + abs(${circleMemberLocations.longitude} - ${origin.longitude})`)
    .limit(NEARBY_SQL_FETCH_LIMIT);

  const membersWithDistance: ChannelMemberBase[] = [];

  for (const member of locatedCandidateRows) {
    const rawDistanceMeters = calculateDistanceMeters(
      origin.latitude,
      origin.longitude,
      member.latitude,
      member.longitude,
    );
    if (rawDistanceMeters > effectiveRadiusMeters) {
      continue;
    }

    const distanceBucket = getDistanceBucket(rawDistanceMeters);
    membersWithDistance.push({
      userId: member.userId,
      nickname: member.nickname,
      avatarUrl: member.avatarUrl,
      joinedAt: member.joinedAt,
      distanceMeters: distanceBucket.upperBoundMeters,
      distanceBucket: distanceBucket.key,
      distanceText: distanceBucket.text,
      locationUpdatedAt: member.locationUpdatedAt,
    });
  }

  membersWithDistance.sort((left, right) => {
    const leftDistance = left.distanceMeters ?? Number.POSITIVE_INFINITY;
    const rightDistance = right.distanceMeters ?? Number.POSITIVE_INFINITY;
    if (leftDistance !== rightDistance) return leftDistance - rightDistance;

    const leftJoinedAt = left.joinedAt ? new Date(left.joinedAt).getTime() : Number.MAX_SAFE_INTEGER;
    const rightJoinedAt = right.joinedAt ? new Date(right.joinedAt).getTime() : Number.MAX_SAFE_INTEGER;
    if (leftJoinedAt !== rightJoinedAt) return leftJoinedAt - rightJoinedAt;
    return left.userId.localeCompare(right.userId);
  });

  const remainingUnknownLimit = options.includeUnknownDistance
    ? Math.max(0, NEARBY_CANDIDATE_LIMIT - membersWithDistance.length)
    : 0;
  const membersWithoutDistance = remainingUnknownLimit > 0 ? (await db.select({
    userId: circleMembers.userId,
    nickname: users.nickname,
    avatarUrl: users.avatarUrl,
    joinedAt: circleMembers.joinedAt,
  }).from(circleMembers)
    .innerJoin(users, eq(circleMembers.userId, users.id))
    .where(and(
      eq(circleMembers.circleId, circleId),
      eq(circleMembers.membershipStatus, CIRCLE_MEMBERSHIP_STATUS.ACTIVE),
      eq(circleMembers.isActive, true),
      sql`${circleMembers.userId} <> ${viewerId}`,
      buildNoBlockSql(viewerId, circleMembers.userId),
      sql`NOT EXISTS (
        SELECT 1
        FROM circle_member_locations cml
        WHERE cml.circle_id = ${circleId}
          AND cml.user_id = ${circleMembers.userId}
          AND cml.is_enabled = TRUE
          AND cml.expires_at > NOW()
      )`,
    ))
    .orderBy(circleMembers.joinedAt)
    .limit(remainingUnknownLimit)) : [];

  const candidateMembers = [
    ...membersWithDistance,
    ...membersWithoutDistance,
  ].slice(0, NEARBY_CANDIDATE_LIMIT);

  const enrichedMembers = await buildChannelMemberCards(circleId, candidateMembers);

  enrichedMembers.sort((left, right) => {
    const leftDistance = left.distanceMeters ?? Number.POSITIVE_INFINITY;
    const rightDistance = right.distanceMeters ?? Number.POSITIVE_INFINITY;
    if (leftDistance !== rightDistance) return leftDistance - rightDistance;
    if (right.infoScore !== left.infoScore) return right.infoScore - left.infoScore;

    const leftJoinedAt = left.joinedAt ? new Date(left.joinedAt).getTime() : Number.MAX_SAFE_INTEGER;
    const rightJoinedAt = right.joinedAt ? new Date(right.joinedAt).getTime() : Number.MAX_SAFE_INTEGER;
    if (leftJoinedAt !== rightJoinedAt) return leftJoinedAt - rightJoinedAt;
    return left.userId.localeCompare(right.userId);
  });

  const offset = (page - 1) * limit;
  const members = enrichedMembers.slice(offset, offset + limit)
    .map(({
      infoScore: _infoScore,
      joinedAt: _joinedAt,
      distanceMeters: _distanceMeters,
      ...member
    }) => member);

  return {
    total: enrichedMembers.length,
    members,
    nearby: {
      enabled: true,
      originUpdatedAt: origin.updatedAt,
      radiusMeters: effectiveRadiusMeters,
    },
  };
}

export async function getChannelMembers(
  viewerId: string,
  circleId: string,
  page: number,
  limit: number,
  options: ChannelMembersOptions = {},
) {
  if (options.nearby) {
    return getNearbyChannelMembers(viewerId, circleId, page, limit, options);
  }

  const membership = await db.select({ id: circleMembers.id }).from(circleMembers)
    .where(and(
      eq(circleMembers.circleId, circleId),
      eq(circleMembers.userId, viewerId),
      eq(circleMembers.membershipStatus, CIRCLE_MEMBERSHIP_STATUS.ACTIVE),
    ))
    .limit(1);

  if (!membership[0]) {
    throw new ForbiddenError('仅圈子成员可查看频道');
  }

  const [{ total }] = await db.select({
    total: sql<number>`count(*)::int`,
  }).from(circleMembers).where(and(
    eq(circleMembers.circleId, circleId),
    eq(circleMembers.membershipStatus, CIRCLE_MEMBERSHIP_STATUS.ACTIVE),
    eq(circleMembers.isActive, true),
  ));

  const offset = (page - 1) * limit;
  const memberRows = await db.select({
    userId: circleMembers.userId,
    nickname: users.nickname,
    avatarUrl: users.avatarUrl,
    joinedAt: circleMembers.joinedAt,
  }).from(circleMembers)
    .innerJoin(users, eq(circleMembers.userId, users.id))
    .where(and(
      eq(circleMembers.circleId, circleId),
      eq(circleMembers.membershipStatus, CIRCLE_MEMBERSHIP_STATUS.ACTIVE),
      eq(circleMembers.isActive, true),
    ))
    .orderBy(circleMembers.joinedAt, circleMembers.userId)
    .limit(limit)
    .offset(offset);

  const sortedMembers = await buildChannelMemberCards(circleId, memberRows);

  sortedMembers.sort((left, right) => {
    if (right.infoScore !== left.infoScore) {
      return right.infoScore - left.infoScore;
    }

    const leftJoinedAt = left.joinedAt ? new Date(left.joinedAt).getTime() : Number.MAX_SAFE_INTEGER;
    const rightJoinedAt = right.joinedAt ? new Date(right.joinedAt).getTime() : Number.MAX_SAFE_INTEGER;

    if (leftJoinedAt !== rightJoinedAt) {
      return leftJoinedAt - rightJoinedAt;
    }

    return left.userId.localeCompare(right.userId);
  });

  const members = sortedMembers.map(({ infoScore: _infoScore, joinedAt: _joinedAt, ...member }) => member);

  return { total, members };
}

// ─── My Circles (auth required) ────────────────────────────────

export async function getMyCircles(userId: string) {
  const memberships = await db.select().from(circleMembers)
    .where(and(
      eq(circleMembers.userId, userId),
      eq(circleMembers.membershipStatus, CIRCLE_MEMBERSHIP_STATUS.ACTIVE),
    ));

  if (memberships.length === 0) return [];

  const circleIds = memberships.map((m) => m.circleId);
  const circleRows = await db.select().from(circles)
    .where(sql`${circles.id} IN (${sql.join(circleIds.map((id) => sql`${id}`), sql`, `)})`);

  return circleRows.map((c) => {
    const membership = memberships.find((m) => m.circleId === c.id)!;
    return {
      ...serializeCircle(c),
      membership: {
        answersComplete: membership.answersComplete,
        isActive: membership.isActive,
        membershipStatus: membership.membershipStatus,
        joinedAt: membership.joinedAt,
      },
    };
  });
}

export async function listMyCreatedCircles(userId: string) {
  const rows = await db.select().from(circles)
    .where(eq(circles.creatorId, userId))
    .orderBy(desc(circles.createdAt));

  return rows.map(serializeCircle);
}

export async function createCustomCircle(userId: string, payload: CreateCustomCirclePayload) {
  const name = payload.name.trim();
  const description = payload.description.trim();
  const tags = normalizeCircleTags(payload.tags, null);
  const slug = payload.slug?.trim() || buildCircleSlug(name);
  const category = payload.category?.trim() || 'custom';
  const joinQuestions = normalizeJoinQuestions(payload.joinQuestions, payload.joinQuestion);
  const joinQuestion = joinQuestions[0]?.question ?? normalizeNullableText(payload.joinQuestion);
  const joinPolicy = payload.joinPolicy ?? JOIN_POLICY.REVIEW;
  const capacityLimit = normalizeCapacityLimit(payload.capacityLimit);
  const keywordRules = normalizeKeywordRules(payload.keywordRules);

  if (name.length < 1 || name.length > 30) throw new ValidationError('圈子名称需为 1-30 字');
  if (description.length < 1 || description.length > 200) throw new ValidationError('圈子简介需为 1-200 字');
  if (tags.length < 1 || payload.tags.length > 5) throw new ValidationError('标签需为 1-5 个');
  assertNoSensitiveContent([
    { label: '圈子名称', value: name },
    { label: '圈子简介', value: description },
    ...joinQuestions.map((question) => ({ label: '入圈问题', value: question.question })),
    ...keywordRules.map((rule) => ({ label: '关键词规则', value: rule.keyword })),
    ...tags.map((tag) => ({ label: '圈子标签', value: tag })),
  ]);

  const [createdCount] = await db.select({ total: sql<number>`count(*)::int` }).from(circles)
    .where(eq(circles.creatorId, userId));
  if (Number(createdCount?.total ?? 0) >= CUSTOM_CIRCLE_LIMIT) {
    throw new ConflictError('单个用户最多创建 5 个圈子');
  }

  const duplicateRows = await db.select({ id: circles.id }).from(circles)
    .where(or(eq(circles.name, name), eq(circles.slug, slug)))
    .limit(1);
  if (duplicateRows[0]) {
    throw new ConflictError('圈子名称或 slug 已存在');
  }

  const id = uuid();
  const now = new Date().toISOString();
  const inserted = await db.transaction(async (tx) => {
    const rows = await tx.insert(circles).values({
      id,
      name,
      slug,
      description,
      category,
      tag: toLegacyTag(tags),
      tags,
      joinPolicy,
      joinQuestion,
      joinQuestions,
      capacityLimit,
      keywordRules,
      iconUrl: payload.iconUrl,
      creatorId: userId,
      memberCount: 0,
      isActive: false,
      status: CIRCLE_STATUS.PENDING_REVIEW,
      createdAt: now,
      updatedAt: now,
    }).returning();

    await tx.insert(auditLogs).values({
      operatorId: userId,
      action: 'circle_create_requested',
      target: id,
      detail: JSON.stringify({
        circleId: id,
        creatorId: userId,
        status: CIRCLE_STATUS.PENDING_REVIEW,
        joinPolicy,
        tagCount: tags.length,
        joinQuestionCount: joinQuestions.length,
        keywordRuleCount: keywordRules.length,
        hasCapacityLimit: capacityLimit !== null,
      }),
      createdAt: now,
    });

    return rows;
  });

  return serializeCircle(inserted[0]!);
}

export async function joinCircle(
  circleId: string,
  userId: string,
  payload: JoinCirclePayload = {},
) {
  await expirePendingJoinRequests(circleId, userId);

  return db.transaction(async (tx) => {
    const circle = await lockCircleForUpdate(tx, circleId);
    if (!circle.isActive || circle.status !== CIRCLE_STATUS.ACTIVE) throw new ValidationError('该圈子暂不可加入');
    assertCircleCapacityAvailable(circle);

    const blacklistRows = await tx.select({ id: circleBlacklist.id }).from(circleBlacklist)
      .where(and(eq(circleBlacklist.circleId, circleId), eq(circleBlacklist.userId, userId)))
      .limit(1);
    if (blacklistRows[0]) {
      throw new ValidationError('暂时无法申请加入该圈子');
    }

    const existing = await tx.select().from(circleMembers)
      .where(and(eq(circleMembers.circleId, circleId), eq(circleMembers.userId, userId)))
      .limit(1);

    if (existing[0]) throwJoinCircleConflict(existing[0].membershipStatus);

    const joinPolicy = (circle.joinPolicy || JOIN_POLICY.PUBLIC) as JoinPolicy;
    if (joinPolicy === JOIN_POLICY.REVIEW) {
      const requestId = uuid();
      const expiresAt = new Date(Date.now() + JOIN_REQUEST_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const application = normalizeJoinApplication(circle, payload);
      const now = new Date().toISOString();
      const rows = await tx.insert(circleJoinRequests).values({
        id: requestId,
        circleId,
        userId,
        applicationAnswer: application.applicationAnswer,
        applicationAnswers: application.answers,
        applicationReason: application.applicationReason,
        status: CIRCLE_JOIN_REQUEST_STATUS.PENDING_REVIEW,
        expiresAt,
        createdAt: now,
        updatedAt: now,
      }).onConflictDoNothing().returning({ id: circleJoinRequests.id });

      if (!rows[0]) {
        throw new ConflictError('入圈申请正在审核中');
      }

      const ownerIds = await getCircleOwnerIds(tx, circleId, circle.creatorId);
      const recipients = ownerIds.filter((ownerId) => ownerId !== userId);
      if (recipients.length > 0) {
        await tx.insert(userNotifications).values(recipients.map((ownerId) => ({
          id: uuid(),
          userId: ownerId,
          type: 'circle_join_requested',
          title: '新的入圈申请',
          content: `有人申请加入「${circle.name}」`,
          meta: { circleId, requestId, applicantId: userId },
        })));
      }

      await tx.insert(auditLogs).values({
        operatorId: userId,
        action: 'circle_join_requested',
        target: circleId,
        detail: JSON.stringify({ requestId }),
      });

      return {
        message: '入圈申请已提交，等待圈主审核',
        circleId,
        requestId,
        membershipStatus: CIRCLE_MEMBERSHIP_STATUS.PENDING,
        requestStatus: CIRCLE_JOIN_REQUEST_STATUS.PENDING_REVIEW,
        expiresAt,
      };
    }

    if (joinPolicy === JOIN_POLICY.INVITE) {
      if (!inviteCodeMatches(payload.inviteCode, circle)) {
        throw new ValidationError('邀请码无效');
      }
    }

    const memberId = uuid();
    const inserted = await tx.insert(circleMembers).values({
      id: memberId,
      circleId,
      userId,
      membershipStatus: CIRCLE_MEMBERSHIP_STATUS.ACTIVE,
    }).onConflictDoNothing({
      target: [circleMembers.circleId, circleMembers.userId],
    }).returning({ id: circleMembers.id });

    if (!inserted[0]) {
      const membershipRows = await tx.select({ membershipStatus: circleMembers.membershipStatus }).from(circleMembers)
        .where(and(eq(circleMembers.circleId, circleId), eq(circleMembers.userId, userId)))
        .limit(1);
      throwJoinCircleConflict(membershipRows[0]?.membershipStatus);
    }

    await tx.update(circles)
      .set({ memberCount: sql`${circles.memberCount} + 1` })
      .where(eq(circles.id, circleId));

    await initializeCardsOnCircleJoin(userId, circleId, tx);

    return {
      message: '已加入圈子',
      circleId,
      memberId,
      membershipStatus: CIRCLE_MEMBERSHIP_STATUS.ACTIVE,
    };
  });
}

export async function leaveCircle(
  circleId: string,
  userId: string,
  options: { clearTrace?: boolean; silent?: boolean } = {},
) {
  const role = await getViewerRole(circleId, userId);
  if (role === CIRCLE_MEMBER_ROLE.OWNER) {
    throw new ValidationError('圈主不能直接退圈，请先转让或解散圈子');
  }

  const result = await db.transaction(async (tx) => {
    const deletedMemberships = await tx.delete(circleMembers)
      .where(and(
        eq(circleMembers.circleId, circleId),
        eq(circleMembers.userId, userId),
        eq(circleMembers.membershipStatus, CIRCLE_MEMBERSHIP_STATUS.ACTIVE),
      ))
      .returning({ id: circleMembers.id });

    if (deletedMemberships.length === 0) {
      throw new NotFoundError('你未加入该圈子');
    }

    const now = new Date().toISOString();

    await tx.delete(circleMemberLocations)
      .where(and(
        eq(circleMemberLocations.circleId, circleId),
        eq(circleMemberLocations.userId, userId),
      ));

    await tx.execute(sql`
      SELECT id
      FROM teamups
      WHERE circle_id = ${circleId}
        AND status IN ('recruiting', 'full')
        AND end_at > ${now}
        AND (
          leader_id = ${userId}
          OR id IN (
            SELECT teamup_id
            FROM teamup_members
            WHERE user_id = ${userId}
              AND membership_status = 'active'
          )
        )
      ORDER BY id
      FOR UPDATE
    `);

    const ledTeamups = await tx.update(teamups)
      .set({
        status: 'cancelled',
        cancelSource: 'leader',
        cancelReason: '组长退出圈子，组队自动取消',
        cancelledBy: userId,
        cancelledAt: now,
        forumSyncStatus: TEAMUP_FORUM_SYNC_ENABLED ? sql`CASE WHEN ${teamups.isPublic} THEN 'pending' ELSE ${teamups.forumSyncStatus} END` : sql`${teamups.forumSyncStatus}`,
        updatedAt: now,
      })
      .where(and(
        eq(teamups.circleId, circleId),
        eq(teamups.leaderId, userId),
        inArray(teamups.status, ['recruiting', 'full']),
        sql`${teamups.endAt} > ${now}`,
      ))
      .returning();

    const ledTeamupIds = ledTeamups.map((teamup) => teamup.id);
    if (ledTeamupIds.length > 0) {
      await tx.update(teamupMembers)
        .set({ membershipStatus: 'cancelled', updatedAt: now })
        .where(and(
          inArray(teamupMembers.teamupId, ledTeamupIds),
          eq(teamupMembers.membershipStatus, 'active'),
        ));
    }

    const leftTeamupMembers = await tx.update(teamupMembers)
      .set({ membershipStatus: 'left', leftAt: now, updatedAt: now })
      .where(and(
        eq(teamupMembers.userId, userId),
        eq(teamupMembers.membershipStatus, 'active'),
        sql`${teamupMembers.memberRole} <> 'leader'`,
        sql`${teamupMembers.teamupId} IN (
          SELECT id
          FROM teamups
          WHERE circle_id = ${circleId}
            AND status IN ('recruiting', 'full')
            AND end_at > ${now}
        )`,
      ))
      .returning({ teamupId: teamupMembers.teamupId });

    const leftCountByTeamup = new Map<string, number>();
    for (const member of leftTeamupMembers) {
      leftCountByTeamup.set(member.teamupId, (leftCountByTeamup.get(member.teamupId) ?? 0) + 1);
    }

    const touchedTeamups = [...ledTeamups];
    for (const [teamupId, leftCount] of [...leftCountByTeamup.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const updatedTeamups = await tx.update(teamups)
        .set({
          currentMemberCount: sql`GREATEST(${teamups.currentMemberCount} - ${leftCount}, 0)`,
          status: sql`CASE WHEN ${teamups.status} = 'full' AND ${teamups.deadlineAt} > ${now} AND ${teamups.endAt} > ${now} THEN 'recruiting' ELSE ${teamups.status} END`,
          forumSyncStatus: TEAMUP_FORUM_SYNC_ENABLED ? sql`CASE WHEN ${teamups.isPublic} THEN 'pending' ELSE ${teamups.forumSyncStatus} END` : sql`${teamups.forumSyncStatus}`,
          updatedAt: now,
        })
        .where(eq(teamups.id, teamupId))
        .returning();
      if (updatedTeamups[0]) touchedTeamups.push(updatedTeamups[0]);
    }

    const cancelledForumTeamups = TEAMUP_FORUM_SYNC_ENABLED
      ? ledTeamups.filter((teamup) => teamup.isPublic).map((teamup) => ({
        id: teamup.id,
        leaderId: teamup.leaderId,
        forumPostId: teamup.forumPostId,
      }))
      : [];

    const publicTouchedTeamups = TEAMUP_FORUM_SYNC_ENABLED
      ? touchedTeamups.filter((teamup) => teamup.isPublic && teamup.status !== 'cancelled')
      : [];
    if (publicTouchedTeamups.length > 0) {
      await tx.insert(teamupForumSyncJobs).values(publicTouchedTeamups.map((teamup) => ({
        id: uuid(),
        teamupId: teamup.id,
        action: teamup.status === 'cancelled' ? 'archive' : 'update',
        payload: {
          id: teamup.id,
          circleId: teamup.circleId,
          leaderId: teamup.leaderId,
          title: teamup.title,
          descriptionPreview: teamup.descriptionPreview,
          maxMembers: teamup.maxMembers,
          currentMemberCount: teamup.currentMemberCount,
          deadlineAt: teamup.deadlineAt,
          endAt: teamup.endAt,
          joinMode: teamup.joinMode,
          isPublic: teamup.isPublic,
          status: teamup.status,
          effectiveStatus: teamup.status === 'cancelled' ? 'cancelled' : teamup.status,
          joinable: false,
          leader: null,
          updatedAt: teamup.updatedAt,
        },
        status: 'pending',
        attemptCount: 0,
        nextRetryAt: now,
        createdAt: now,
        updatedAt: now,
      })));
    }

    await tx.update(teamupApplications)
      .set({ status: 'withdrawn', updatedAt: now })
      .where(and(
        eq(teamupApplications.applicantId, userId),
        eq(teamupApplications.status, 'pending'),
        sql`${teamupApplications.teamupId} IN (
          SELECT id
          FROM teamups
          WHERE circle_id = ${circleId}
        )`,
      ));

    const rejectedFriendRequests = await tx.update(friendRequests)
      .set({ status: 'rejected', updatedAt: now })
      .where(and(
        eq(friendRequests.circleId, circleId),
        eq(friendRequests.status, 'pending'),
        or(eq(friendRequests.senderId, userId), eq(friendRequests.receiverId, userId)),
      ))
      .returning({ id: friendRequests.id });

    const rejectedContactRequests = await tx.update(contactUnlockRequests)
      .set({ status: 'rejected', updatedAt: now })
      .where(and(
        eq(contactUnlockRequests.circleId, circleId),
        eq(contactUnlockRequests.status, 'pending'),
        or(eq(contactUnlockRequests.requesterId, userId), eq(contactUnlockRequests.targetId, userId)),
      ))
      .returning({ id: contactUnlockRequests.id });

    const removedRoles = await tx.delete(circleMemberRoles)
      .where(and(eq(circleMemberRoles.circleId, circleId), eq(circleMemberRoles.userId, userId)))
      .returning({ id: circleMemberRoles.id });

    const traceCleanup = {
      circleCards: [] as Array<{ id: string }>,
      customCards: [] as Array<{ id: string }>,
      legacyCardOverrides: [] as Array<{ id: string }>,
      locationCooldowns: [] as Array<{ id: string }>,
      joinRequests: [] as Array<{ id: string }>,
      circleContacts: [] as Array<{ id: string }>,
      contactSecrets: [] as Array<{ id: string }>,
    };
    if (options.clearTrace) {
      const circleContactRows = await tx.select({
        id: userCircleContacts.id,
        contactSecretId: userCircleContacts.contactSecretId,
      }).from(userCircleContacts)
        .where(and(eq(userCircleContacts.circleId, circleId), eq(userCircleContacts.userId, userId)));
      const contactSecretIds = Array.from(new Set(circleContactRows
        .map((row) => row.contactSecretId)
        .filter((id): id is string => Boolean(id))));

      traceCleanup.circleCards = await tx.delete(userCircleCards)
        .where(and(eq(userCircleCards.circleId, circleId), eq(userCircleCards.userId, userId)))
        .returning({ id: userCircleCards.id });
      traceCleanup.customCards = await tx.delete(userCircleCustomCards)
        .where(and(eq(userCircleCustomCards.circleId, circleId), eq(userCircleCustomCards.userId, userId)))
        .returning({ id: userCircleCustomCards.id });
      traceCleanup.legacyCardOverrides = await tx.delete(circleCardOverrides)
        .where(and(eq(circleCardOverrides.circleId, circleId), eq(circleCardOverrides.userId, userId)))
        .returning({ id: circleCardOverrides.id });
      traceCleanup.locationCooldowns = await tx.delete(circleMemberLocationCooldowns)
        .where(and(eq(circleMemberLocationCooldowns.circleId, circleId), eq(circleMemberLocationCooldowns.userId, userId)))
        .returning({ id: circleMemberLocationCooldowns.id });
      traceCleanup.joinRequests = await tx.delete(circleJoinRequests)
        .where(and(eq(circleJoinRequests.circleId, circleId), eq(circleJoinRequests.userId, userId)))
        .returning({ id: circleJoinRequests.id });
      traceCleanup.circleContacts = await tx.delete(userCircleContacts)
        .where(and(eq(userCircleContacts.circleId, circleId), eq(userCircleContacts.userId, userId)))
        .returning({ id: userCircleContacts.id });
      if (contactSecretIds.length > 0) {
        traceCleanup.contactSecrets = await tx.delete(g2ContactSecrets)
          .where(and(
            eq(g2ContactSecrets.ownerUserId, userId),
            eq(g2ContactSecrets.scopeType, 'circle_contact'),
            inArray(g2ContactSecrets.id, contactSecretIds),
          ))
          .returning({ id: g2ContactSecrets.id });
      }
    }

    const removedFriendships = await tx.delete(friendships)
      .where(and(
        eq(friendships.circleId, circleId),
        or(
          eq(friendships.userAId, userId),
          eq(friendships.userBId, userId),
        ),
      ))
      .returning({
        id: friendships.id,
        userAId: friendships.userAId,
        userBId: friendships.userBId,
      });

    const authorizationCleanup = await revokeOrphanedGlobalFriendshipsForCirclePairs(removedFriendships, tx);

    await tx.update(circles)
      .set({ memberCount: sql`GREATEST(${circles.memberCount} - 1, 0)` })
      .where(eq(circles.id, circleId));

    await tx.insert(auditLogs).values({
      operatorId: userId,
      action: 'circle_member_left',
      target: circleId,
      detail: JSON.stringify({
        removedFriendshipCount: removedFriendships.length,
        revokedGlobalFriendshipCount: authorizationCleanup.revokedGlobalFriendshipCount,
        deletedContactUnlockCount: authorizationCleanup.deletedContactUnlockCount,
        rejectedFriendRequestCount: rejectedFriendRequests.length,
        rejectedContactRequestCount: rejectedContactRequests.length,
        removedRoleCount: removedRoles.length,
        clearTrace: Boolean(options.clearTrace),
        silent: Boolean(options.silent),
        clearedCircleCardCount: traceCleanup.circleCards.length,
        clearedCustomCardCount: traceCleanup.customCards.length,
        clearedLegacyCardOverrideCount: traceCleanup.legacyCardOverrides.length,
        clearedLocationCooldownCount: traceCleanup.locationCooldowns.length,
        clearedJoinRequestCount: traceCleanup.joinRequests.length,
        clearedCircleContactCount: traceCleanup.circleContacts.length,
        clearedContactSecretCount: traceCleanup.contactSecrets.length,
        cancelledTeamupCount: ledTeamupIds.length,
        leftTeamupCount: leftCountByTeamup.size,
      }),
      createdAt: now,
    });

    return {
      removedFriendshipCount: removedFriendships.length,
      revokedGlobalFriendshipCount: authorizationCleanup.revokedGlobalFriendshipCount,
      deletedContactUnlockCount: authorizationCleanup.deletedContactUnlockCount,
      rejectedFriendRequestCount: rejectedFriendRequests.length,
      rejectedContactRequestCount: rejectedContactRequests.length,
      removedRoleCount: removedRoles.length,
      clearTrace: Boolean(options.clearTrace),
      silent: Boolean(options.silent),
      clearedCircleCardCount: traceCleanup.circleCards.length,
      clearedCustomCardCount: traceCleanup.customCards.length,
      clearedLegacyCardOverrideCount: traceCleanup.legacyCardOverrides.length,
      clearedLocationCooldownCount: traceCleanup.locationCooldowns.length,
      clearedJoinRequestCount: traceCleanup.joinRequests.length,
      clearedCircleContactCount: traceCleanup.circleContacts.length,
      clearedContactSecretCount: traceCleanup.contactSecrets.length,
      cancelledTeamupCount: ledTeamupIds.length,
      leftTeamupCount: leftCountByTeamup.size,
      cancelledForumTeamups,
    };
  });

  await Promise.all(result.cancelledForumTeamups.map(deleteCancelledTeamupForumPost));

  return {
    message: '已退出圈子，并同步处理圈内组队与好友关系',
    circleId,
    removedFriendshipCount: result.removedFriendshipCount,
    revokedGlobalFriendshipCount: result.revokedGlobalFriendshipCount,
    deletedContactUnlockCount: result.deletedContactUnlockCount,
    rejectedFriendRequestCount: result.rejectedFriendRequestCount,
    rejectedContactRequestCount: result.rejectedContactRequestCount,
    removedRoleCount: result.removedRoleCount,
    clearTrace: result.clearTrace,
    silent: result.silent,
    clearedTraceCount: result.clearedCircleCardCount
      + result.clearedCustomCardCount
      + result.clearedLegacyCardOverrideCount
      + result.clearedLocationCooldownCount
      + result.clearedJoinRequestCount
      + result.clearedCircleContactCount
      + result.clearedContactSecretCount,
    clearedCircleCardCount: result.clearedCircleCardCount,
    clearedCustomCardCount: result.clearedCustomCardCount,
    clearedLegacyCardOverrideCount: result.clearedLegacyCardOverrideCount,
    clearedLocationCooldownCount: result.clearedLocationCooldownCount,
    clearedJoinRequestCount: result.clearedJoinRequestCount,
    clearedCircleContactCount: result.clearedCircleContactCount,
    clearedContactSecretCount: result.clearedContactSecretCount,
    cancelledTeamupCount: result.cancelledTeamupCount,
    leftTeamupCount: result.leftTeamupCount,
  };
}

export async function toggleCircleActive(circleId: string, userId: string, isActive: boolean) {
  const updated = await db.transaction(async (tx) => {
    const rows = await tx.update(circleMembers)
      .set({ isActive, updatedAt: new Date().toISOString() })
      .where(and(
        eq(circleMembers.circleId, circleId),
        eq(circleMembers.userId, userId),
        eq(circleMembers.membershipStatus, CIRCLE_MEMBERSHIP_STATUS.ACTIVE),
      ))
      .returning({
        id: circleMembers.id,
        membershipStatus: circleMembers.membershipStatus,
      });

    if (rows.length === 0) throw new NotFoundError('你未加入该圈子');

    if (!isActive) {
      await tx.delete(circleMemberLocations)
        .where(and(
          eq(circleMemberLocations.circleId, circleId),
          eq(circleMemberLocations.userId, userId),
        ));
    }

    return rows;
  });

  return {
    circleId,
    isActive,
    membershipStatus: updated[0]!.membershipStatus,
    message: isActive ? '已恢复圈子活跃状态' : '已暂停圈子活跃状态',
  };
}

// ─── Circle Owner Management ────────────────────────────────────

export async function listSentJoinRequests(userId: string, page = 1, limit = 20) {
  await expirePendingJoinRequests(undefined, userId);
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(50, Math.max(1, limit));
  const offset = (safePage - 1) * safeLimit;

  const [totalRow] = await db.select({ total: sql<number>`count(*)::int` }).from(circleJoinRequests)
    .where(eq(circleJoinRequests.userId, userId));

  const rows = await db.select({
    id: circleJoinRequests.id,
    circleId: circleJoinRequests.circleId,
    applicationAnswer: circleJoinRequests.applicationAnswer,
    applicationAnswers: circleJoinRequests.applicationAnswers,
    applicationReason: circleJoinRequests.applicationReason,
    status: circleJoinRequests.status,
    rejectReason: circleJoinRequests.rejectReason,
    reviewedAt: circleJoinRequests.reviewedAt,
    expiresAt: circleJoinRequests.expiresAt,
    createdAt: circleJoinRequests.createdAt,
    updatedAt: circleJoinRequests.updatedAt,
    circleName: circles.name,
    circleSlug: circles.slug,
  }).from(circleJoinRequests)
    .innerJoin(circles, eq(circleJoinRequests.circleId, circles.id))
    .where(eq(circleJoinRequests.userId, userId))
    .orderBy(desc(circleJoinRequests.createdAt))
    .limit(safeLimit)
    .offset(offset);

  return { total: Number(totalRow?.total ?? 0), page: safePage, limit: safeLimit, requests: rows };
}

export async function listCircleJoinRequests(
  circleId: string,
  viewerId: string,
  status?: CircleJoinRequestStatus | 'all',
  page = 1,
  limit = 20,
) {
  await ensureCircleOwner(circleId, viewerId);
  await expirePendingJoinRequests(circleId);

  const safePage = Math.max(1, page);
  const safeLimit = Math.min(50, Math.max(1, limit));
  const offset = (safePage - 1) * safeLimit;
  const filters = [eq(circleJoinRequests.circleId, circleId)];
  if (status && status !== 'all') filters.push(eq(circleJoinRequests.status, status));
  const where = and(...filters);

  const [totalRow] = await db.select({ total: sql<number>`count(*)::int` }).from(circleJoinRequests)
    .where(where);

  const rows = await db.select({
    id: circleJoinRequests.id,
    circleId: circleJoinRequests.circleId,
    userId: circleJoinRequests.userId,
    applicationAnswer: circleJoinRequests.applicationAnswer,
    applicationAnswers: circleJoinRequests.applicationAnswers,
    applicationReason: circleJoinRequests.applicationReason,
    status: circleJoinRequests.status,
    rejectReason: circleJoinRequests.rejectReason,
    reviewedBy: circleJoinRequests.reviewedBy,
    reviewedAt: circleJoinRequests.reviewedAt,
    expiresAt: circleJoinRequests.expiresAt,
    createdAt: circleJoinRequests.createdAt,
    updatedAt: circleJoinRequests.updatedAt,
    nickname: users.nickname,
    avatarUrl: users.avatarUrl,
    department: users.department,
    grade: users.grade,
  }).from(circleJoinRequests)
    .innerJoin(users, eq(circleJoinRequests.userId, users.id))
    .where(where)
    .orderBy(desc(circleJoinRequests.createdAt))
    .limit(safeLimit)
    .offset(offset);

  return {
    total: Number(totalRow?.total ?? 0),
    page: safePage,
    limit: safeLimit,
    requests: rows.map((row) => ({
      id: row.id,
      circleId: row.circleId,
      applicationAnswer: row.applicationAnswer,
      applicationAnswers: row.applicationAnswers,
      applicationReason: row.applicationReason,
      status: row.status,
      rejectReason: row.rejectReason,
      reviewedBy: row.reviewedBy,
      reviewedAt: row.reviewedAt,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      applicant: {
        userId: row.userId,
        nickname: row.nickname,
        avatarUrl: row.avatarUrl,
        department: row.department,
        grade: row.grade,
      },
    })),
  };
}

export async function withdrawCircleJoinRequest(userId: string, requestId: string) {
  await expirePendingJoinRequests(undefined, userId);

  const now = new Date().toISOString();
  return db.transaction(async (tx) => {
    await tx.execute(sql`
      SELECT id
      FROM circle_join_requests
      WHERE id = ${requestId}
      FOR UPDATE
    `);

    const rows = await tx.select({
      id: circleJoinRequests.id,
      circleId: circleJoinRequests.circleId,
      userId: circleJoinRequests.userId,
      status: circleJoinRequests.status,
      circleName: circles.name,
      creatorId: circles.creatorId,
    }).from(circleJoinRequests)
      .innerJoin(circles, eq(circleJoinRequests.circleId, circles.id))
      .where(eq(circleJoinRequests.id, requestId))
      .limit(1);
    const request = rows[0];

    if (!request) throw new NotFoundError('入圈申请不存在');
    if (request.userId !== userId) throw new ForbiddenError('只能撤回自己发出的入圈申请');
    if (request.status === CIRCLE_JOIN_REQUEST_STATUS.EXPIRED) {
      throw new ConflictError('入圈申请已过期');
    }
    if (request.status !== CIRCLE_JOIN_REQUEST_STATUS.PENDING_REVIEW) {
      throw new ConflictError('该入圈申请已处理，无法撤回');
    }

    const updated = await tx.update(circleJoinRequests)
      .set({
        status: CIRCLE_JOIN_REQUEST_STATUS.WITHDRAWN,
        updatedAt: now,
      })
      .where(eq(circleJoinRequests.id, requestId))
      .returning();

    await tx.insert(auditLogs).values({
      operatorId: userId,
      action: 'circle_join_withdrawn',
      target: request.circleId,
      detail: JSON.stringify({ requestId, userId }),
      createdAt: now,
    });

    const ownerIds = await getCircleOwnerIds(tx, request.circleId, request.creatorId);
    const recipients = ownerIds.filter((ownerId) => ownerId !== userId);
    if (recipients.length > 0) {
      await tx.insert(userNotifications).values(recipients.map((ownerId) => ({
        id: uuid(),
        userId: ownerId,
        type: 'circle_join_withdrawn',
        title: '入圈申请已撤回',
        content: `有人撤回了加入「${request.circleName}」的申请`,
        meta: { circleId: request.circleId, requestId, applicantId: userId },
      })));
    }

    return {
      message: '入圈申请已撤回',
      requestId,
      circleId: request.circleId,
      status: CIRCLE_JOIN_REQUEST_STATUS.WITHDRAWN,
      request: updated[0],
    };
  });
}

export async function reviewCircleJoinRequest(
  circleId: string,
  requestId: string,
  reviewerId: string,
  payload: { status: 'approved' | 'rejected'; reason?: string | null; silent?: boolean },
  devOverride?: { expectedApplicantId: string },
) {
  if (!devOverride) {
    await ensureCircleOwner(circleId, reviewerId);
  }
  await expirePendingJoinRequests(circleId);

  const now = new Date().toISOString();
  return db.transaction(async (tx) => {
    const circle = await lockCircleForUpdate(tx, circleId);

    await tx.execute(sql`
      SELECT id
      FROM circle_join_requests
      WHERE id = ${requestId}
        AND circle_id = ${circleId}
      FOR UPDATE
    `);

    const requestRows = await tx.select().from(circleJoinRequests)
      .where(and(eq(circleJoinRequests.id, requestId), eq(circleJoinRequests.circleId, circleId)))
      .limit(1);
    const request = requestRows[0];
    if (!request) throw new NotFoundError('入圈申请不存在');
    if (devOverride && request.userId !== devOverride.expectedApplicantId) {
      throw new ForbiddenError('只能处理当前测试账号自己的入圈申请');
    }
    if (request.status !== CIRCLE_JOIN_REQUEST_STATUS.PENDING_REVIEW) {
      throw new ConflictError('该入圈申请已处理');
    }

    const circleName = circle.name;

    if (payload.status === CIRCLE_JOIN_REQUEST_STATUS.APPROVED) {
      const memberRows = await tx.select().from(circleMembers)
        .where(and(eq(circleMembers.circleId, circleId), eq(circleMembers.userId, request.userId)))
        .limit(1);
      const existingMember = memberRows[0];
      const shouldIncrement = !existingMember
        || existingMember.membershipStatus !== CIRCLE_MEMBERSHIP_STATUS.ACTIVE
        || !existingMember.isActive;
      if (shouldIncrement) assertCircleCapacityAvailable(circle);

      if (existingMember) {
        await tx.update(circleMembers)
          .set({
            membershipStatus: CIRCLE_MEMBERSHIP_STATUS.ACTIVE,
            isActive: true,
            updatedAt: now,
          })
          .where(eq(circleMembers.id, existingMember.id));
      } else {
        await tx.insert(circleMembers).values({
          id: uuid(),
          circleId,
          userId: request.userId,
          membershipStatus: CIRCLE_MEMBERSHIP_STATUS.ACTIVE,
          isActive: true,
          joinedAt: now,
          updatedAt: now,
        });
      }

      if (shouldIncrement) {
        await tx.update(circles)
          .set({ memberCount: sql`${circles.memberCount} + 1`, updatedAt: now })
          .where(eq(circles.id, circleId));
      }

      await initializeCardsOnCircleJoin(request.userId, circleId, tx);

      const updated = await tx.update(circleJoinRequests)
        .set({
          status: CIRCLE_JOIN_REQUEST_STATUS.APPROVED,
          reviewedBy: reviewerId,
          reviewedAt: now,
          updatedAt: now,
        })
        .where(eq(circleJoinRequests.id, requestId))
        .returning();

      await tx.insert(auditLogs).values({
        operatorId: reviewerId,
        action: 'circle_join_approved',
        target: circleId,
        detail: JSON.stringify({ requestId, userId: request.userId }),
      });

      await tx.insert(userNotifications).values({
        id: uuid(),
        userId: request.userId,
        type: 'circle_join_approved',
        title: '入圈申请已通过',
        content: `你加入「${circleName}」的申请已通过`,
        meta: { circleId, requestId },
      });

      return { message: '已通过入圈申请', request: updated[0] };
    }

    const rejectReason = normalizeNullableText(payload.reason);
    const updated = await tx.update(circleJoinRequests)
      .set({
        status: CIRCLE_JOIN_REQUEST_STATUS.REJECTED,
        rejectReason,
        reviewedBy: reviewerId,
        reviewedAt: now,
        updatedAt: now,
      })
      .where(eq(circleJoinRequests.id, requestId))
      .returning();

    await tx.insert(auditLogs).values({
      operatorId: reviewerId,
      action: 'circle_join_rejected',
      target: circleId,
      detail: JSON.stringify({ requestId, userId: request.userId, rejectReason }),
    });

    if (!payload.silent) {
      await tx.insert(userNotifications).values({
        id: uuid(),
        userId: request.userId,
        type: 'circle_join_rejected',
        title: '入圈申请未通过',
        content: rejectReason ? `你加入「${circleName}」的申请未通过：${rejectReason}` : `你加入「${circleName}」的申请未通过`,
        meta: { circleId, requestId },
      });
    }

    return { message: '已拒绝入圈申请', request: updated[0] };
  });
}

export async function getCircleManageOverview(circleId: string, viewerId: string) {
  await ensureCircleOwner(circleId, viewerId);

  const [circleRows, pendingRows, blacklistRows] = await Promise.all([
    db.select().from(circles).where(eq(circles.id, circleId)).limit(1),
    db.select({ total: sql<number>`count(*)::int` }).from(circleJoinRequests)
      .where(and(
        eq(circleJoinRequests.circleId, circleId),
        eq(circleJoinRequests.status, CIRCLE_JOIN_REQUEST_STATUS.PENDING_REVIEW),
      )),
    db.select({ total: sql<number>`count(*)::int` }).from(circleBlacklist)
      .where(eq(circleBlacklist.circleId, circleId)),
  ]);
  const circle = circleRows[0];
  if (!circle) throw new NotFoundError('圈子不存在');

  return {
    circle: serializeCircleForManagement(circle),
    counts: {
      members: circle.memberCount,
      pendingJoinRequests: Number(pendingRows[0]?.total ?? 0),
      blacklist: Number(blacklistRows[0]?.total ?? 0),
    },
  };
}

export async function updateManagedCircle(circleId: string, viewerId: string, payload: UpdateManagedCirclePayload) {
  await ensureCircleOwner(circleId, viewerId);

  const currentRows = await db.select().from(circles).where(eq(circles.id, circleId)).limit(1);
  const current = currentRows[0];
  if (!current) throw new NotFoundError('圈子不存在');

  const updatePayload: Partial<typeof circles.$inferInsert> = {};
  const sensitiveFields: Array<{ label: string; value: string | null | undefined }> = [];

  if (payload.name !== undefined) {
    const name = payload.name.trim();
    if (name.length < 1 || name.length > 30) throw new ValidationError('圈子名称需为 1-30 字');
    const duplicate = await db.select({ id: circles.id }).from(circles)
      .where(and(eq(circles.name, name), sql`${circles.id} <> ${circleId}`))
      .limit(1);
    if (duplicate[0]) throw new ConflictError('圈子名称已存在');
    updatePayload.name = name;
    sensitiveFields.push({ label: '圈子名称', value: name });
  }
  if (payload.description !== undefined) {
    const description = payload.description.trim();
    if (description.length < 1 || description.length > 200) throw new ValidationError('圈子简介需为 1-200 字');
    updatePayload.description = description;
    sensitiveFields.push({ label: '圈子简介', value: description });
  }
  if (payload.category !== undefined) {
    updatePayload.category = payload.category.trim() || current.category;
  }
  if (payload.tags !== undefined) {
    const tags = normalizeCircleTags(payload.tags, null);
    if (tags.length < 1 || payload.tags.length > 5) throw new ValidationError('标签需为 1-5 个');
    updatePayload.tags = tags;
    updatePayload.tag = toLegacyTag(tags);
    sensitiveFields.push(...tags.map((tag) => ({ label: '圈子标签', value: tag })));
  }
  if (payload.iconUrl !== undefined) {
    updatePayload.iconUrl = normalizeNullableText(payload.iconUrl);
  }
  if (payload.joinQuestion !== undefined) {
    const joinQuestions = normalizeJoinQuestions(undefined, payload.joinQuestion);
    const joinQuestion = joinQuestions[0]?.question ?? null;
    updatePayload.joinQuestion = joinQuestion;
    updatePayload.joinQuestions = joinQuestions;
    sensitiveFields.push({ label: '入圈问题', value: joinQuestion });
  }
  if (payload.joinQuestions !== undefined) {
    const joinQuestions = normalizeJoinQuestions(payload.joinQuestions, null);
    updatePayload.joinQuestions = joinQuestions;
    updatePayload.joinQuestion = joinQuestions[0]?.question ?? null;
    sensitiveFields.push(...joinQuestions.map((question) => ({ label: '入圈问题', value: question.question })));
  }
  if (payload.capacityLimit !== undefined) {
    updatePayload.capacityLimit = normalizeCapacityLimit(payload.capacityLimit);
  }
  if (payload.keywordRules !== undefined) {
    const keywordRules = normalizeKeywordRules(payload.keywordRules);
    updatePayload.keywordRules = keywordRules;
    sensitiveFields.push(...keywordRules.map((rule) => ({ label: '关键词规则', value: rule.keyword })));
  }

  assertNoSensitiveContent(sensitiveFields);
  const now = new Date().toISOString();
  updatePayload.updatedAt = now;

  const updated = await db.transaction(async (tx) => {
    const rows = await tx.update(circles)
      .set(updatePayload)
      .where(eq(circles.id, circleId))
      .returning();

    await tx.insert(auditLogs).values({
      operatorId: viewerId,
      action: 'circle_info_updated',
      target: circleId,
      detail: JSON.stringify({ fields: Object.keys(updatePayload).filter((key) => key !== 'updatedAt') }),
      createdAt: now,
    });

    return rows;
  });

  return serializeCircle(updated[0]!);
}

export async function updateCircleJoinPolicy(
  circleId: string,
  viewerId: string,
  payload: {
    joinPolicy: JoinPolicy;
    inviteCode?: string | null;
    joinQuestion?: string | null;
    joinQuestions?: Array<{ id?: string; question: string; required?: boolean }>;
    capacityLimit?: number | null;
    keywordRules?: KeywordRule[];
  },
) {
  await ensureCircleOwner(circleId, viewerId);

  const currentRows = await db.select().from(circles).where(eq(circles.id, circleId)).limit(1);
  const current = currentRows[0];
  if (!current) throw new NotFoundError('圈子不存在');

  const joinQuestions = payload.joinQuestions !== undefined
    ? normalizeJoinQuestions(payload.joinQuestions, null)
    : payload.joinQuestion !== undefined
      ? normalizeJoinQuestions(undefined, payload.joinQuestion)
      : normalizeJoinQuestions(current.joinQuestions, current.joinQuestion);
  const joinQuestion = joinQuestions[0]?.question ?? null;
  const keywordRules = payload.keywordRules !== undefined
    ? normalizeKeywordRules(payload.keywordRules)
    : normalizeKeywordRules(current.keywordRules);
  const capacityLimit = payload.capacityLimit !== undefined
    ? normalizeCapacityLimit(payload.capacityLimit)
    : current.capacityLimit;

  assertNoKeywordRuleHits([
    ...joinQuestions.map((question) => ({ label: '入圈问题', value: question.question })),
    ...keywordRules.map((rule) => ({ label: '关键词规则', value: rule.keyword })),
  ]);

  let plainInviteCode: string | null = null;
  let inviteCodeHash: string | null = current.inviteCodeHash;
  if (payload.joinPolicy === JOIN_POLICY.INVITE) {
    plainInviteCode = normalizeNullableText(payload.inviteCode) ?? (current.inviteCodeHash || current.inviteCode ? null : generateInviteCode());
    if (plainInviteCode) inviteCodeHash = hashInviteCode(plainInviteCode);
  } else {
    inviteCodeHash = null;
  }

  const now = new Date().toISOString();
  const updated = await db.transaction(async (tx) => {
    const rows = await tx.update(circles)
      .set({
        joinPolicy: payload.joinPolicy,
        joinQuestion,
        joinQuestions,
        inviteCode: null,
        inviteCodeHash,
        capacityLimit,
        keywordRules,
        updatedAt: now,
      })
      .where(eq(circles.id, circleId))
      .returning();

    await tx.insert(auditLogs).values({
      operatorId: viewerId,
      action: 'circle_join_policy_updated',
      target: circleId,
      detail: JSON.stringify({
        joinPolicy: payload.joinPolicy,
        capacityLimit,
        keywordRuleCount: keywordRules.length,
        joinQuestionCount: joinQuestions.length,
        inviteCodeRotated: Boolean(plainInviteCode),
      }),
      createdAt: now,
    });

    return rows;
  });

  return serializeCircleForManagement(updated[0]!, plainInviteCode);
}

export async function listCircleManageMembers(circleId: string, viewerId: string, page = 1, limit = 20) {
  await ensureCircleOwner(circleId, viewerId);

  const safePage = Math.max(1, page);
  const safeLimit = Math.min(50, Math.max(1, limit));
  const offset = (safePage - 1) * safeLimit;
  const where = and(
    eq(circleMembers.circleId, circleId),
    eq(circleMembers.membershipStatus, CIRCLE_MEMBERSHIP_STATUS.ACTIVE),
  );

  const [totalRow] = await db.select({ total: sql<number>`count(*)::int` }).from(circleMembers).where(where);
  const rows = await db.select({
    userId: circleMembers.userId,
    membershipStatus: circleMembers.membershipStatus,
    isActive: circleMembers.isActive,
    joinedAt: circleMembers.joinedAt,
    nickname: users.nickname,
    avatarUrl: users.avatarUrl,
    department: users.department,
    grade: users.grade,
  }).from(circleMembers)
    .innerJoin(users, eq(circleMembers.userId, users.id))
    .where(where)
    .orderBy(circleMembers.joinedAt)
    .limit(safeLimit)
    .offset(offset);

  const memberIds = rows.map((row) => row.userId);
  const roleRows = memberIds.length > 0
    ? await db.select({
        userId: circleMemberRoles.userId,
        role: circleMemberRoles.role,
      }).from(circleMemberRoles)
        .where(and(eq(circleMemberRoles.circleId, circleId), inArray(circleMemberRoles.userId, memberIds)))
    : [];
  const rolesByUser = new Map<string, string[]>();
  for (const roleRow of roleRows) {
    const roles = rolesByUser.get(roleRow.userId) ?? [];
    roles.push(roleRow.role);
    rolesByUser.set(roleRow.userId, roles);
  }

  return {
    total: Number(totalRow?.total ?? 0),
    page: safePage,
    limit: safeLimit,
    members: rows.map((row) => ({
      userId: row.userId,
      role: pickViewerRole(rolesByUser.get(row.userId) ?? []) ?? 'member',
      membershipStatus: row.membershipStatus,
      isActive: row.isActive,
      joinedAt: row.joinedAt,
      profile: {
        nickname: row.nickname,
        avatarUrl: row.avatarUrl,
        department: row.department,
        grade: row.grade,
      },
    })),
  };
}

export async function removeCircleMember(
  circleId: string,
  viewerId: string,
  targetUserId: string,
  payload: { addToBlacklist?: boolean; reason?: string | null } = {},
) {
  await ensureCircleOwner(circleId, viewerId);
  if (targetUserId === viewerId) throw new ValidationError('圈主不能移除自己');

  const targetRole = await getViewerRole(circleId, targetUserId);
  if (targetRole === CIRCLE_MEMBER_ROLE.OWNER) throw new ValidationError('不能移除圈主');

  const now = new Date().toISOString();

  const result = await db.transaction(async (tx) => {
    const leaveResult = await removeCircleMembershipAndCleanup(
      tx,
      circleId,
      targetUserId,
      now,
      '成员被圈主移除，组队自动取消',
    );

    const rejectedJoinRequests = await tx.update(circleJoinRequests)
      .set({
        status: CIRCLE_JOIN_REQUEST_STATUS.REJECTED,
        rejectReason: payload.reason ?? '已被圈主移除',
        reviewedBy: viewerId,
        reviewedAt: now,
        updatedAt: now,
      })
      .where(and(
        eq(circleJoinRequests.circleId, circleId),
        eq(circleJoinRequests.userId, targetUserId),
        eq(circleJoinRequests.status, CIRCLE_JOIN_REQUEST_STATUS.PENDING_REVIEW),
      ))
      .returning({ id: circleJoinRequests.id });

    let blacklistEntry: typeof circleBlacklist.$inferSelect | null = null;
    if (payload.addToBlacklist) {
      const blacklistRows = await tx.insert(circleBlacklist).values({
        id: uuid(),
        circleId,
        userId: targetUserId,
        reason: normalizeNullableText(payload.reason),
        createdBy: viewerId,
        createdAt: now,
      }).onConflictDoNothing().returning();
      blacklistEntry = blacklistRows[0] ?? null;
    }

    await tx.insert(auditLogs).values({
      operatorId: viewerId,
      action: payload.addToBlacklist ? 'circle_member_removed_blacklisted' : 'circle_member_removed',
      target: circleId,
      detail: JSON.stringify({
        userId: targetUserId,
        reason: payload.reason ?? null,
        rejectedJoinRequestCount: rejectedJoinRequests.length,
        removedFriendshipCount: leaveResult.removedFriendshipCount,
        revokedGlobalFriendshipCount: leaveResult.revokedGlobalFriendshipCount,
        deletedContactUnlockCount: leaveResult.deletedContactUnlockCount,
        rejectedFriendRequestCount: leaveResult.rejectedFriendRequestCount,
        rejectedContactRequestCount: leaveResult.rejectedContactRequestCount,
        cancelledTeamupCount: leaveResult.cancelledTeamupCount,
        leftTeamupCount: leaveResult.leftTeamupCount,
      }),
      createdAt: now,
    });

    return {
      ...leaveResult,
      blacklistEntry,
      rejectedJoinRequestCount: rejectedJoinRequests.length,
    };
  });

  await Promise.all(result.cancelledForumTeamups.map(deleteCancelledTeamupForumPost));

  return {
    message: payload.addToBlacklist ? '已移除成员并加入黑名单' : '已移除成员',
    circleId,
    removedFriendshipCount: result.removedFriendshipCount,
    revokedGlobalFriendshipCount: result.revokedGlobalFriendshipCount,
    deletedContactUnlockCount: result.deletedContactUnlockCount,
    rejectedFriendRequestCount: result.rejectedFriendRequestCount,
    rejectedContactRequestCount: result.rejectedContactRequestCount,
    removedRoleCount: result.removedRoleCount,
    cancelledTeamupCount: result.cancelledTeamupCount,
    leftTeamupCount: result.leftTeamupCount,
    blacklistEntry: result.blacklistEntry,
    rejectedJoinRequestCount: result.rejectedJoinRequestCount,
  };
}

export async function listCircleBlacklist(circleId: string, viewerId: string, page = 1, limit = 20) {
  await ensureCircleOwner(circleId, viewerId);
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(50, Math.max(1, limit));
  const offset = (safePage - 1) * safeLimit;

  const [totalRow] = await db.select({ total: sql<number>`count(*)::int` }).from(circleBlacklist)
    .where(eq(circleBlacklist.circleId, circleId));
  const rows = await db.select({
    id: circleBlacklist.id,
    circleId: circleBlacklist.circleId,
    userId: circleBlacklist.userId,
    reason: circleBlacklist.reason,
    createdBy: circleBlacklist.createdBy,
    createdAt: circleBlacklist.createdAt,
    nickname: users.nickname,
    avatarUrl: users.avatarUrl,
  }).from(circleBlacklist)
    .innerJoin(users, eq(circleBlacklist.userId, users.id))
    .where(eq(circleBlacklist.circleId, circleId))
    .orderBy(desc(circleBlacklist.createdAt))
    .limit(safeLimit)
    .offset(offset);

  return {
    total: Number(totalRow?.total ?? 0),
    page: safePage,
    limit: safeLimit,
    users: rows.map((row) => ({
      id: row.id,
      circleId: row.circleId,
      userId: row.userId,
      reason: row.reason,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      profile: {
        nickname: row.nickname,
        avatarUrl: row.avatarUrl,
      },
    })),
  };
}

export async function addCircleBlacklistUser(
  circleId: string,
  viewerId: string,
  targetUserId: string,
  reason?: string | null,
) {
  await ensureCircleOwner(circleId, viewerId);
  if (targetUserId === viewerId) throw new ValidationError('不能将自己加入黑名单');
  const targetRole = await getViewerRole(circleId, targetUserId);
  if (targetRole === CIRCLE_MEMBER_ROLE.OWNER) throw new ValidationError('不能将圈主加入黑名单');
  const now = new Date().toISOString();

  const result = await db.transaction(async (tx) => {
    const rejectedJoinRequests = await tx.update(circleJoinRequests)
      .set({
        status: CIRCLE_JOIN_REQUEST_STATUS.REJECTED,
        rejectReason: '已被圈子限制加入',
        reviewedBy: viewerId,
        reviewedAt: now,
        updatedAt: now,
      })
      .where(and(
        eq(circleJoinRequests.circleId, circleId),
        eq(circleJoinRequests.userId, targetUserId),
        eq(circleJoinRequests.status, CIRCLE_JOIN_REQUEST_STATUS.PENDING_REVIEW),
      ))
      .returning({ id: circleJoinRequests.id });

    const activeMemberRows = await tx.select({ id: circleMembers.id }).from(circleMembers)
      .where(and(
        eq(circleMembers.circleId, circleId),
        eq(circleMembers.userId, targetUserId),
        eq(circleMembers.membershipStatus, CIRCLE_MEMBERSHIP_STATUS.ACTIVE),
        eq(circleMembers.isActive, true),
      ))
      .limit(1);

    const cleanup = activeMemberRows[0]
      ? await removeCircleMembershipAndCleanup(
          tx,
          circleId,
          targetUserId,
          now,
          '成员被加入黑名单，组队自动取消',
        )
      : {
          removedFriendshipCount: 0,
          revokedGlobalFriendshipCount: 0,
          deletedContactUnlockCount: 0,
          removedRoleCount: 0,
          cancelledTeamupCount: 0,
          leftTeamupCount: 0,
          rejectedFriendRequestCount: 0,
          rejectedContactRequestCount: 0,
          cancelledForumTeamups: [],
        };

    const rows = await tx.insert(circleBlacklist).values({
      id: uuid(),
      circleId,
      userId: targetUserId,
      reason: normalizeNullableText(reason),
      createdBy: viewerId,
      createdAt: now,
    }).onConflictDoNothing().returning();

    await tx.insert(auditLogs).values({
      operatorId: viewerId,
      action: 'circle_blacklist_added',
      target: circleId,
      detail: JSON.stringify({
        userId: targetUserId,
        reason: reason ?? null,
        rejectedJoinRequestCount: rejectedJoinRequests.length,
        removedFriendshipCount: cleanup.removedFriendshipCount,
        revokedGlobalFriendshipCount: cleanup.revokedGlobalFriendshipCount,
        deletedContactUnlockCount: cleanup.deletedContactUnlockCount,
        rejectedFriendRequestCount: cleanup.rejectedFriendRequestCount,
        rejectedContactRequestCount: cleanup.rejectedContactRequestCount,
        cancelledTeamupCount: cleanup.cancelledTeamupCount,
        leftTeamupCount: cleanup.leftTeamupCount,
      }),
    });

    return {
      entry: rows[0] ?? null,
      cleanup,
      rejectedJoinRequestCount: rejectedJoinRequests.length,
    };
  });

  await Promise.all(result.cleanup.cancelledForumTeamups.map(deleteCancelledTeamupForumPost));

  return {
    message: '已加入黑名单，并同步撤销该成员的圈内权限',
    entry: result.entry,
    rejectedJoinRequestCount: result.rejectedJoinRequestCount,
    removedFriendshipCount: result.cleanup.removedFriendshipCount,
    revokedGlobalFriendshipCount: result.cleanup.revokedGlobalFriendshipCount,
    deletedContactUnlockCount: result.cleanup.deletedContactUnlockCount,
    rejectedFriendRequestCount: result.cleanup.rejectedFriendRequestCount,
    rejectedContactRequestCount: result.cleanup.rejectedContactRequestCount,
    cancelledTeamupCount: result.cleanup.cancelledTeamupCount,
    leftTeamupCount: result.cleanup.leftTeamupCount,
  };
}

export async function removeCircleBlacklistUser(circleId: string, viewerId: string, targetUserId: string) {
  await ensureCircleOwner(circleId, viewerId);

  const deleted = await db.delete(circleBlacklist)
    .where(and(eq(circleBlacklist.circleId, circleId), eq(circleBlacklist.userId, targetUserId)))
    .returning();

  if (!deleted[0]) throw new NotFoundError('黑名单记录不存在');

  await db.insert(auditLogs).values({
    operatorId: viewerId,
    action: 'circle_blacklist_removed',
    target: circleId,
    detail: JSON.stringify({ userId: targetUserId }),
  });

  return { message: '已移出黑名单', entry: deleted[0] };
}

export async function transferCircleOwner(circleId: string, viewerId: string, targetUserId: string) {
  await ensureCircleOwner(circleId, viewerId);
  if (targetUserId === viewerId) throw new ValidationError('目标用户已是圈主');

  const now = new Date().toISOString();
  const result = await db.transaction(async (tx) => {
    const memberRows = await tx.select({ id: circleMembers.id }).from(circleMembers)
      .where(and(
        eq(circleMembers.circleId, circleId),
        eq(circleMembers.userId, targetUserId),
        eq(circleMembers.membershipStatus, CIRCLE_MEMBERSHIP_STATUS.ACTIVE),
        eq(circleMembers.isActive, true),
      ))
      .limit(1);
    if (!memberRows[0]) throw new ValidationError('只能转让给当前活跃成员');

    await tx.update(circles)
      .set({ creatorId: targetUserId, updatedAt: now })
      .where(eq(circles.id, circleId));
    await tx.delete(circleMemberRoles)
      .where(and(
        eq(circleMemberRoles.circleId, circleId),
        eq(circleMemberRoles.userId, viewerId),
        eq(circleMemberRoles.role, CIRCLE_MEMBER_ROLE.OWNER),
      ));
    await tx.insert(circleMemberRoles).values({
      id: uuid(),
      circleId,
      userId: targetUserId,
      role: CIRCLE_MEMBER_ROLE.OWNER,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();

    await tx.insert(auditLogs).values({
      operatorId: viewerId,
      action: 'circle_owner_transferred',
      target: circleId,
      detail: JSON.stringify({ fromUserId: viewerId, toUserId: targetUserId }),
    });

    const rows = await tx.select().from(circles).where(eq(circles.id, circleId)).limit(1);
    return rows[0]!;
  });

  return { message: '圈主已转让', circle: serializeCircle(result) };
}

export async function archiveManagedCircle(circleId: string, viewerId: string) {
  await ensureCircleOwner(circleId, viewerId);
  const now = new Date().toISOString();

  const updated = await db.transaction(async (tx) => {
    const rows = await tx.update(circles)
      .set({
        status: CIRCLE_STATUS.ARCHIVED,
        isActive: false,
        updatedAt: now,
      })
      .where(eq(circles.id, circleId))
      .returning();

    await tx.insert(auditLogs).values({
      operatorId: viewerId,
      action: 'circle_archived',
      target: circleId,
      detail: JSON.stringify({ circleId }),
    });

    return rows[0];
  });

  if (!updated) throw new NotFoundError('圈子不存在');
  return { message: '圈子已解散', circle: serializeCircle(updated) };
}

export async function listCircleAuditLogs(circleId: string, viewerId: string, page = 1, limit = 20) {
  await ensureCircleOwner(circleId, viewerId);
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(50, Math.max(1, limit));
  const offset = (safePage - 1) * safeLimit;

  const [totalRow] = await db.select({ total: sql<number>`count(*)::int` }).from(auditLogs)
    .where(eq(auditLogs.target, circleId));
  const rows = await db.select().from(auditLogs)
    .where(eq(auditLogs.target, circleId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(safeLimit)
    .offset(offset);

  return { total: Number(totalRow?.total ?? 0), page: safePage, limit: safeLimit, logs: rows };
}

// ─── Questionnaire ──────────────────────────────────────────────

export async function getQuestionnaire(circleId: string, userId: string) {
  const circleRows = await db.select().from(circles).where(eq(circles.id, circleId)).limit(1);
  if (!circleRows[0]) throw new NotFoundError('圈子不存在');

  const components = await db.select().from(circleQuestions)
    .where(eq(circleQuestions.circleId, circleId))
    .orderBy(circleQuestions.displayOrder);

  const memberRows = await db.select().from(circleMembers)
    .where(and(
      eq(circleMembers.circleId, circleId),
      eq(circleMembers.userId, userId),
      eq(circleMembers.membershipStatus, CIRCLE_MEMBERSHIP_STATUS.ACTIVE),
    ))
    .limit(1);

  const member = memberRows[0];
  const myAnswers = member?.answers ? JSON.parse(member.answers) : null;

  return {
    deprecated: true,
    components: components.map((q) => ({
      ...q,
      options: q.options ? JSON.parse(q.options) : null,
    })),
    answers: myAnswers,
    answersComplete: member?.answersComplete ?? false,
  };
}

export async function submitQuestionnaire(
  circleId: string,
  userId: string,
  answers: Record<string, unknown>,
) {
  const memberRows = await db.select().from(circleMembers)
    .where(and(
      eq(circleMembers.circleId, circleId),
      eq(circleMembers.userId, userId),
      eq(circleMembers.membershipStatus, CIRCLE_MEMBERSHIP_STATUS.ACTIVE),
    ))
    .limit(1);

  if (!memberRows[0]) throw new NotFoundError('请先加入圈子');

  await db.update(circleMembers)
    .set({
      answers: JSON.stringify(answers),
      answersComplete: true,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(circleMembers.id, memberRows[0].id));

  return { message: '兼容问卷接口提交成功', circleId, answersComplete: true, deprecated: true };
}

// ─── Circle Matching ────────────────────────────────────────────

export async function getCurrentCircleMatch(circleId: string, userId: string) {
  const weekOf = getCurrentWeekOf();

  const rows = await db.select().from(circleMatches)
    .where(and(
      eq(circleMatches.circleId, circleId),
      eq(circleMatches.weekOf, weekOf),
      or(eq(circleMatches.userAId, userId), eq(circleMatches.userBId, userId)),
    ))
    .limit(1);

  return rows[0] ?? null;
}

export async function recordCircleAction(matchId: string, userId: string, action: 'ACCEPT' | 'REJECT') {
  const matchRows = await db.select().from(circleMatches).where(eq(circleMatches.id, matchId)).limit(1);
  const match = matchRows[0];
  if (!match) throw new NotFoundError('匹配不存在');

  const isUserA = match.userAId === userId;
  const isUserB = match.userBId === userId;
  if (!isUserA && !isUserB) throw new NotFoundError('匹配不存在');

  const existingAction = isUserA ? match.userAAction : match.userBAction;
  if (existingAction) throw new ConflictError('你已经做出了选择');

  if (isUserA) {
    await db.update(circleMatches).set({ userAAction: action }).where(eq(circleMatches.id, matchId));
  } else {
    await db.update(circleMatches).set({ userBAction: action }).where(eq(circleMatches.id, matchId));
  }

  // Check if both have acted → update status
  const updatedRows = await db.select().from(circleMatches).where(eq(circleMatches.id, matchId)).limit(1);
  const updated = updatedRows[0]!;
  if (updated.userAAction && updated.userBAction) {
    const newStatus =
      updated.userAAction === 'ACCEPT' && updated.userBAction === 'ACCEPT' ? 'MUTUAL' : 'MISSED';
    await db.update(circleMatches).set({ status: newStatus }).where(eq(circleMatches.id, matchId));
  }

  return { matchId, action, message: '圈内匹配选择已记录' };
}

export async function getCircleMatchHistory(circleId: string, userId: string, page: number, limit: number) {
  const allMatches = await db.select().from(circleMatches)
    .where(and(
      eq(circleMatches.circleId, circleId),
      or(eq(circleMatches.userAId, userId), eq(circleMatches.userBId, userId)),
    ));

  const total = allMatches.length;
  const offset = (page - 1) * limit;
  const paginated = allMatches
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    .slice(offset, offset + limit);

  // Enrich with partner info (batch query to avoid N+1)
  const partnerIds = paginated.map(m => m.userAId === userId ? m.userBId : m.userAId);
  const partnerRows = partnerIds.length > 0
    ? await db.select({
        id: users.id,
        nickname: users.nickname,
        department: users.department,
        avatarUrl: users.avatarUrl,
      }).from(users).where(inArray(users.id, partnerIds))
    : [];
  const partnerMap = new Map(partnerRows.map(p => [p.id, { nickname: p.nickname, department: p.department, avatarUrl: p.avatarUrl }]));

  const enriched = paginated.map(m => {
    const partnerId = m.userAId === userId ? m.userBId : m.userAId;
    return {
      matchId: m.id,
      weekOf: m.weekOf,
      score: m.score,
      status: m.status,
      partner: partnerMap.get(partnerId) ?? null,
    };
  });

  return { total, page, matches: enriched };
}

// ─── Admin: Circle CRUD ─────────────────────────────────────────

export async function createCircle(data: {
  name: string;
  slug: string;
  description?: string;
  category: string;
  tag?: string;
  tags?: string[];
  joinPolicy?: JoinPolicy;
  joinQuestion?: string | null;
  joinQuestions?: Array<{ id?: string; question: string; required?: boolean }>;
  inviteCode?: string | null;
  capacityLimit?: number | null;
  keywordRules?: KeywordRule[];
  iconUrl?: string;
  creatorId?: string | null;
  status?: CircleStatus;
  reviewNote?: string | null;
}, operatorId?: string | null) {
  const id = uuid();
  const creatorId = data.creatorId ?? null;
  const tags = normalizeCircleTags(data.tags, data.tag);
  const status = normalizeCircleStatus(data.status, true);
  const joinQuestions = normalizeJoinQuestions(data.joinQuestions, data.joinQuestion);
  const plainInviteCode = normalizeNullableText(data.inviteCode);
  const reviewNote = normalizeNullableText(data.reviewNote);
  const now = new Date().toISOString();
  const circleValues = {
    ...data,
    tag: toLegacyTag(tags, data.tag),
    tags,
    joinPolicy: data.joinPolicy ?? JOIN_POLICY.PUBLIC,
    joinQuestion: joinQuestions[0]?.question ?? normalizeNullableText(data.joinQuestion),
    joinQuestions,
    inviteCode: null,
    inviteCodeHash: plainInviteCode ? hashInviteCode(plainInviteCode) : null,
    capacityLimit: normalizeCapacityLimit(data.capacityLimit),
    keywordRules: normalizeKeywordRules(data.keywordRules),
    creatorId,
    status,
    isActive: statusToIsActive(status),
    reviewNote: status === CIRCLE_STATUS.REJECTED ? reviewNote : null,
    reviewedBy: status === CIRCLE_STATUS.REJECTED ? operatorId ?? null : null,
    reviewedAt: status === CIRCLE_STATUS.REJECTED ? now : null,
    updatedAt: now,
  };

  if (creatorId) {
    await ensureUserExists(creatorId);
  }

  return db.transaction(async (tx) => {
    await tx.insert(circles).values({ id, ...circleValues });

    if (creatorId && status === CIRCLE_STATUS.ACTIVE) {
      await ensureCreatorMembershipAndRole(tx, id, creatorId, now);
    }

    await tx.insert(auditLogs).values({
      operatorId: operatorId ?? null,
      action: 'admin_circle_created',
      target: id,
      detail: JSON.stringify({
        circleId: id,
        creatorId,
        status,
        isActive: statusToIsActive(status),
        hasReviewNote: Boolean(status === CIRCLE_STATUS.REJECTED && reviewNote),
        joinPolicy: circleValues.joinPolicy,
        tagCount: tags.length,
        joinQuestionCount: joinQuestions.length,
        keywordRuleCount: circleValues.keywordRules.length,
        hasInviteCode: Boolean(plainInviteCode),
        hasCapacityLimit: circleValues.capacityLimit !== null,
      }),
      createdAt: now,
    });

    const rows = await tx.select().from(circles).where(eq(circles.id, id)).limit(1);
    return serializeCircle(rows[0]!);
  });
}

export async function updateCircle(circleId: string, data: {
  name?: string;
  slug?: string;
  description?: string;
  category?: string;
  tag?: string;
  tags?: string[];
  joinPolicy?: JoinPolicy;
  joinQuestion?: string | null;
  joinQuestions?: Array<{ id?: string; question: string; required?: boolean }>;
  inviteCode?: string | null;
  capacityLimit?: number | null;
  keywordRules?: KeywordRule[];
  iconUrl?: string;
  creatorId?: string | null;
  status?: CircleStatus;
  reviewNote?: string | null;
}, operatorId?: string | null) {
  const creatorId = data.creatorId;
  if (creatorId !== undefined && creatorId !== null) {
    await ensureUserExists(creatorId);
  }

  return db.transaction(async (tx) => {
    const existingRows = await tx.select().from(circles).where(eq(circles.id, circleId)).limit(1);
    const existing = existingRows[0];

    if (!existing) throw new NotFoundError('圈子不存在');
    const now = new Date().toISOString();

    const nextTags = data.tags !== undefined || data.tag !== undefined
      ? normalizeCircleTags(data.tags, data.tag ?? existing.tag)
      : normalizeCircleTags(existing.tags, existing.tag);
    const nextStatus = data.status !== undefined
      ? normalizeCircleStatus(data.status, existing.isActive)
      : normalizeCircleStatus(existing.status, existing.isActive);
    const previousStatus = normalizeCircleStatus(existing.status, existing.isActive);
    const statusChanged = data.status !== undefined && nextStatus !== previousStatus;
    const reviewNote = data.reviewNote !== undefined ? normalizeNullableText(data.reviewNote) : undefined;
    const shouldUpdateJoinQuestions = data.joinQuestions !== undefined || data.joinQuestion !== undefined;
    const nextJoinQuestions = shouldUpdateJoinQuestions
      ? normalizeJoinQuestions(data.joinQuestions, data.joinQuestion ?? existing.joinQuestion)
      : undefined;
    const plainInviteCode = data.inviteCode !== undefined ? normalizeNullableText(data.inviteCode) : undefined;
    const {
      joinQuestions: _joinQuestions,
      joinQuestion: _joinQuestion,
      inviteCode: _inviteCode,
      capacityLimit: _capacityLimit,
      keywordRules: _keywordRules,
      reviewNote: _reviewNote,
      ...circleUpdateData
    } = data;
    const updatePayload: Partial<typeof circles.$inferInsert> = {
      ...circleUpdateData,
      tag: data.tags !== undefined || data.tag !== undefined ? toLegacyTag(nextTags, data.tag ?? existing.tag) : data.tag,
      tags: data.tags !== undefined || data.tag !== undefined ? nextTags : data.tags,
      joinQuestion: shouldUpdateJoinQuestions ? nextJoinQuestions?.[0]?.question ?? null : undefined,
      joinQuestions: shouldUpdateJoinQuestions ? nextJoinQuestions : undefined,
      inviteCode: data.inviteCode !== undefined ? null : undefined,
      inviteCodeHash: data.inviteCode !== undefined ? (plainInviteCode ? hashInviteCode(plainInviteCode) : null) : undefined,
      capacityLimit: data.capacityLimit !== undefined ? normalizeCapacityLimit(data.capacityLimit) : data.capacityLimit,
      keywordRules: data.keywordRules !== undefined ? normalizeKeywordRules(data.keywordRules) : data.keywordRules,
      status: data.status !== undefined ? nextStatus : data.status,
      isActive: data.status !== undefined ? statusToIsActive(nextStatus) : undefined,
      reviewNote: data.reviewNote !== undefined
        ? reviewNote
        : statusChanged && nextStatus === CIRCLE_STATUS.ACTIVE
          ? null
          : undefined,
      reviewedBy: statusChanged && (nextStatus === CIRCLE_STATUS.ACTIVE || nextStatus === CIRCLE_STATUS.REJECTED)
        ? operatorId ?? null
        : undefined,
      reviewedAt: statusChanged && (nextStatus === CIRCLE_STATUS.ACTIVE || nextStatus === CIRCLE_STATUS.REJECTED)
        ? now
        : undefined,
      updatedAt: now,
    };

    const updated = await tx.update(circles)
      .set(updatePayload)
      .where(eq(circles.id, circleId))
      .returning();

    const nextCircle = updated[0];
    if (!nextCircle) throw new NotFoundError('圈子不存在');

    if (creatorId !== undefined && existing.creatorId && existing.creatorId !== creatorId) {
      await tx.delete(circleMemberRoles)
        .where(and(
          eq(circleMemberRoles.circleId, circleId),
          eq(circleMemberRoles.userId, existing.creatorId),
          eq(circleMemberRoles.role, CIRCLE_MEMBER_ROLE.OWNER),
        ));
    }

    const effectiveCreatorId = creatorId !== undefined ? creatorId : nextCircle.creatorId;
    if (effectiveCreatorId && nextStatus === CIRCLE_STATUS.ACTIVE) {
      await ensureCreatorMembershipAndRole(tx, circleId, effectiveCreatorId, now);
    }

    const changedFields = Object.entries(data)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key);
    await tx.insert(auditLogs).values({
      operatorId: operatorId ?? null,
      action: 'admin_circle_updated',
      target: circleId,
      detail: JSON.stringify({
        circleId,
        changedFields,
        status: data.status !== undefined
          ? { from: normalizeCircleStatus(existing.status, existing.isActive), to: nextStatus }
          : undefined,
        isActive: data.status !== undefined
          ? { from: existing.isActive, to: statusToIsActive(nextStatus) }
          : undefined,
        creatorId: data.creatorId !== undefined
          ? { from: existing.creatorId, to: data.creatorId }
          : undefined,
        reviewNote: data.reviewNote !== undefined ? { changed: true } : undefined,
        hasInviteCodeChange: data.inviteCode !== undefined,
      }),
      createdAt: now,
    });

    const refreshedRows = await tx.select().from(circles).where(eq(circles.id, circleId)).limit(1);
    return refreshedRows[0] ? serializeCircle(refreshedRows[0]) : serializeCircle(nextCircle);
  });
}

export async function setCircleActive(circleId: string, isActive: boolean, operatorId?: string | null) {
  const now = new Date().toISOString();
  const updated = await db.transaction(async (tx) => {
    const existingRows = await tx.select().from(circles).where(eq(circles.id, circleId)).limit(1);
    const existing = existingRows[0];
    if (!existing) throw new NotFoundError('圈子不存在');
    const previousStatus = normalizeCircleStatus(existing.status, existing.isActive);
    const nextStatus = isActive ? CIRCLE_STATUS.ACTIVE : CIRCLE_STATUS.INACTIVE;
    const statusChanged = previousStatus !== nextStatus;

    const rows = await tx.update(circles)
      .set({
        isActive,
        status: nextStatus,
        reviewNote: isActive && statusChanged ? null : undefined,
        reviewedBy: isActive && statusChanged ? operatorId ?? null : undefined,
        reviewedAt: isActive && statusChanged ? now : undefined,
        updatedAt: now,
      })
      .where(eq(circles.id, circleId))
      .returning();

    const circle = rows[0];
    await tx.insert(auditLogs).values({
      operatorId: operatorId ?? null,
      action: 'admin_circle_active_set',
      target: circleId,
      detail: JSON.stringify({
        circleId,
        isActive: { from: existing.isActive, to: isActive },
        status: {
          from: normalizeCircleStatus(existing.status, existing.isActive),
          to: isActive ? CIRCLE_STATUS.ACTIVE : CIRCLE_STATUS.INACTIVE,
        },
      }),
      createdAt: now,
    });

    if (circle?.creatorId && isActive) {
      await ensureCreatorMembershipAndRole(tx, circleId, circle.creatorId, now);
      const refreshedRows = await tx.select().from(circles).where(eq(circles.id, circleId)).limit(1);
      return refreshedRows;
    }

    return rows;
  });

  return serializeCircle(updated[0]);
}

export async function deleteCircle(circleId: string) {
  return db.transaction(async (tx) => {
    const existing = await tx.select().from(circles).where(eq(circles.id, circleId)).limit(1);
    const circle = existing[0];

    if (!circle) {
      throw new NotFoundError('圈子不存在');
    }

    // These core circle tables do not rely on ON DELETE CASCADE, so clean them up first.
    await tx.delete(circleMatches).where(eq(circleMatches.circleId, circleId));
    await tx.delete(circleMembers).where(eq(circleMembers.circleId, circleId));
    await tx.delete(circleQuestions).where(eq(circleQuestions.circleId, circleId));

    const deleted = await tx.delete(circles)
      .where(eq(circles.id, circleId))
      .returning();

    return deleted[0] ?? circle;
  });
}

export async function getCircleCardComponents(circleId: string) {
  return {
    circleId,
    components: await listCircleCardComponentDefinitions(circleId),
  };
}

export async function replaceCircleCardComponents(circleId: string, components: CircleCardComponentDefinition[]) {
  const normalized = await persistCircleCardComponentDefinitions(circleId, components);
  return { message: `已更新 ${normalized.length} 个B区组件`, circleId };
}

export async function createCircleCardComponent(circleId: string, component: CircleCardComponentDefinition) {
  const current = await listCircleCardComponentDefinitions(circleId);
  if (current.some((item) => item.key === component.key)) {
    throw new ConflictError('B区组件 key 已存在');
  }

  const insertAt = Math.max(0, Math.min(component.displayOrder ?? current.length, current.length));
  const next = [...current];
  next.splice(insertAt, 0, {
    ...component,
    displayOrder: insertAt,
  });

  const normalized = await persistCircleCardComponentDefinitions(circleId, next);
  const created = normalized.find((item) => item.key === component.key)!;

  return {
    message: '已新增B区组件',
    circleId,
    component: created,
  };
}

export async function updateCircleCardComponent(
  circleId: string,
  componentKey: string,
  patch: CircleCardComponentPatch,
) {
  const current = await listCircleCardComponentDefinitions(circleId);
  const currentIndex = current.findIndex((item) => item.key === componentKey);
  if (currentIndex === -1) {
    throw new NotFoundError('B区组件不存在');
  }

  const existing = current[currentIndex]!;
  const nextKey = patch.key ?? existing.key;
  if (nextKey !== componentKey && current.some((item) => item.key === nextKey)) {
    throw new ConflictError('B区组件 key 已存在');
  }

  const targetIndex = Math.max(0, Math.min(
    patch.displayOrder ?? (existing.displayOrder ?? currentIndex),
    current.length - 1,
  ));
  const merged: CircleCardComponentDefinition = {
    key: nextKey,
    type: patch.type ?? existing.type,
    prompt: patch.prompt ?? existing.prompt,
    options: patch.options !== undefined ? patch.options : existing.options,
    weight: patch.weight ?? existing.weight,
    displayOrder: targetIndex,
    isChannelTag: patch.isChannelTag ?? existing.isChannelTag,
  };

  const next = current.filter((item) => item.key !== componentKey);
  next.splice(targetIndex, 0, merged);

  const normalized = await persistCircleCardComponentDefinitions(circleId, next);
  const updated = normalized.find((item) => item.key === nextKey)!;

  return {
    message: '已更新B区组件',
    circleId,
    component: updated,
  };
}

export async function deleteCircleCardComponent(circleId: string, componentKey: string) {
  const current = await listCircleCardComponentDefinitions(circleId);
  if (!current.some((item) => item.key === componentKey)) {
    throw new NotFoundError('B区组件不存在');
  }

  const next = current.filter((item) => item.key !== componentKey);
  await persistCircleCardComponentDefinitions(circleId, next);

  return {
    message: '已删除B区组件',
    circleId,
    deletedKey: componentKey,
  };
}

export async function replaceCircleQuestions(circleId: string, questions: CircleCardComponentDefinition[]) {
  const result = await replaceCircleCardComponents(circleId, questions);
  return {
    ...result,
    deprecated: true,
  };
}

// ─── Admin: Circle Matching Pipeline ────────────────────────────

export async function runCircleMatchingPipeline(circleId?: string) {
  const weekOf = getCurrentWeekOf();
  const targetCircles = circleId
    ? await db.select().from(circles).where(eq(circles.id, circleId)).limit(1)
    : await db.select().from(circles).where(eq(circles.isActive, true));

  let totalPairs = 0;

  for (const circle of targetCircles) {
    // Check if matches already exist
    const existing = await db.select().from(circleMatches)
      .where(and(eq(circleMatches.circleId, circle.id), eq(circleMatches.weekOf, weekOf)))
      .limit(1);
    if (existing[0]) continue;

    // Get eligible members (answered + active)
    const members = await db.select().from(circleMembers)
      .where(and(
        eq(circleMembers.circleId, circle.id),
        eq(circleMembers.membershipStatus, CIRCLE_MEMBERSHIP_STATUS.ACTIVE),
        eq(circleMembers.answersComplete, true),
        eq(circleMembers.isActive, true),
      ));

    if (members.length < 2) continue;

    // Load circle questions for scoring
    const questions = await db.select().from(circleQuestions)
      .where(eq(circleQuestions.circleId, circle.id));

    const circleQs = questions.map((q) => ({
      key: q.key,
      type: q.type as 'scale' | 'single_choice' | 'multi_choice' | 'ranking',
      weight: q.weight,
    }));

    // Compute pairwise scores
    const scores = new Map<string, number>();
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const a = members[i];
        const b = members[j];
        const aAnswers = a.answers ? JSON.parse(a.answers) : {};
        const bAnswers = b.answers ? JSON.parse(b.answers) : {};
        const score = computeCircleScore(aAnswers, bAnswers, circleQs);

        if (score >= 0.2) { // Minimum threshold
          scores.set(`${a.userId}:${b.userId}`, score);
          scores.set(`${b.userId}:${a.userId}`, score);
        }
      }
    }

    // Run matching (all in one pool, no gender split)
    const allIds = members.map((m) => m.userId);
    const half = Math.ceil(allIds.length / 2);
    const groupA = allIds.slice(0, half);
    const groupB = allIds.slice(half);

    const { pairs } = greedyMaxWeightMatching(groupA, groupB, scores);

    for (const pair of pairs) {
      if (pair.score <= 0) continue;

      await db.insert(circleMatches).values({
        id: uuid(),
        circleId: circle.id,
        weekOf,
        userAId: pair.proposerId,
        userBId: pair.receiverId,
        score: pair.score,
        status: 'LOCKED',
      });
      totalPairs++;
    }
  }

  return { message: `圈子匹配完成`, matchedPairs: totalPairs, weekOf };
}

export async function unlockCircleMatches() {
  const weekOf = getCurrentWeekOf();
  const now = new Date().toISOString();

  const unlocked = await db.update(circleMatches)
    .set({ status: 'REVEALED', revealedAt: now })
    .where(and(eq(circleMatches.weekOf, weekOf), eq(circleMatches.status, 'LOCKED')))
    .returning({ id: circleMatches.id });

  return { message: `已解锁 ${unlocked.length} 对圈子匹配`, unlockedCount: unlocked.length };
}
