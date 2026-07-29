import { sql } from 'drizzle-orm';
import { db, queryClient } from '../../src/db/connection.js';
import {
  auditLogs,
  circleChatMessages,
  circleChatReadStates,
  circleMembers,
  circles,
  contactUnlockGrants,
  contactUnlockRequests,
  friendships,
  g2ContactSecrets,
  globalFriendships,
  friendRequests,
  teamupApplications,
  teamupChatMessages,
  teamupChatReadStates,
  teamupForumSyncJobs,
  teamupMemberContacts,
  teamupMembers,
  teamups,
  userCardPreferences,
  userCircleContacts,
  userNotifications,
  users,
} from '../../src/db/schema.js';

export const TEST_PREFIX = 'p4-db-';

export function testId(suffix: string) {
  return `${TEST_PREFIX}${suffix}`;
}

export function futureIso(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function pastIso(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export async function closeDb() {
  await queryClient.end({ timeout: 5 });
}

export async function cleanupTestData() {
  const pattern = `${TEST_PREFIX}%`;

  await db.delete(teamupForumSyncJobs)
    .where(sql`${teamupForumSyncJobs.teamupId} LIKE ${pattern}`);
  await db.delete(teamupChatReadStates)
    .where(sql`${teamupChatReadStates.userId} LIKE ${pattern}`);
  await db.delete(teamupChatMessages)
    .where(sql`${teamupChatMessages.circleId} LIKE ${pattern}`);
  await db.delete(teamupMemberContacts)
    .where(sql`${teamupMemberContacts.userId} LIKE ${pattern}`);
  await db.delete(teamupApplications)
    .where(sql`${teamupApplications.applicantId} LIKE ${pattern}`);
  await db.delete(teamupMembers)
    .where(sql`${teamupMembers.userId} LIKE ${pattern}`);
  await db.delete(teamups)
    .where(sql`${teamups.id} LIKE ${pattern} OR ${teamups.circleId} LIKE ${pattern} OR ${teamups.leaderId} LIKE ${pattern}`);

  await db.delete(contactUnlockGrants)
    .where(sql`${contactUnlockGrants.requesterId} LIKE ${pattern} OR ${contactUnlockGrants.targetId} LIKE ${pattern}`);
  await db.delete(contactUnlockRequests)
    .where(sql`${contactUnlockRequests.requesterId} LIKE ${pattern} OR ${contactUnlockRequests.targetId} LIKE ${pattern}`);
  await db.delete(userCircleContacts)
    .where(sql`${userCircleContacts.userId} LIKE ${pattern}`);
  await db.delete(g2ContactSecrets)
    .where(sql`${g2ContactSecrets.ownerUserId} LIKE ${pattern}`);

  await db.delete(friendRequests)
    .where(sql`${friendRequests.senderId} LIKE ${pattern} OR ${friendRequests.receiverId} LIKE ${pattern}`);
  await db.delete(friendships)
    .where(sql`${friendships.userAId} LIKE ${pattern} OR ${friendships.userBId} LIKE ${pattern}`);
  await db.delete(globalFriendships)
    .where(sql`${globalFriendships.userAId} LIKE ${pattern} OR ${globalFriendships.userBId} LIKE ${pattern}`);

  await db.delete(circleChatReadStates)
    .where(sql`${circleChatReadStates.userId} LIKE ${pattern}`);
  await db.delete(circleChatMessages)
    .where(sql`${circleChatMessages.senderId} LIKE ${pattern} OR ${circleChatMessages.circleId} LIKE ${pattern}`);
  await db.delete(userNotifications)
    .where(sql`${userNotifications.userId} LIKE ${pattern}`);
  await db.delete(auditLogs)
    .where(sql`${auditLogs.operatorId} LIKE ${pattern} OR ${auditLogs.target} LIKE ${pattern}`);

  await db.delete(circleMembers)
    .where(sql`${circleMembers.userId} LIKE ${pattern} OR ${circleMembers.circleId} LIKE ${pattern}`);
  await db.delete(userCardPreferences)
    .where(sql`${userCardPreferences.userId} LIKE ${pattern}`);
  await db.delete(circles)
    .where(sql`${circles.id} LIKE ${pattern}`);
  await db.delete(users)
    .where(sql`${users.id} LIKE ${pattern}`);
}

export async function seedUsers(suffix: string, userKeys: string[]) {
  const now = new Date().toISOString();
  const rows = userKeys.map((key) => ({
    id: testId(`${suffix}-${key}`),
    email: `${testId(`${suffix}-${key}`)}@example.test`,
    passwordHash: 'test-password-hash',
    nickname: key.toUpperCase(),
    avatarUrl: `${key}.png`,
    wechatId: `wechat:${testId(`${suffix}-${key}-wx`)}`,
    profileComplete: true,
    surveyComplete: true,
    createdAt: now,
    updatedAt: now,
  }));
  await db.insert(users).values(rows);
  return Object.fromEntries(rows.map((row) => [row.id.split(`${suffix}-`)[1], row.id])) as Record<string, string>;
}

export async function seedCircle(suffix: string, memberIds: string[]) {
  const circleId = testId(`${suffix}-circle`);
  const now = new Date().toISOString();
  await db.insert(circles).values({
    id: circleId,
    name: `${suffix} 圈子`,
    slug: circleId,
    description: 'DB integration test circle',
    category: 'academic',
    tag: 'test',
    memberCount: memberIds.length,
    isActive: true,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(circleMembers).values(memberIds.map((userId, index) => ({
    id: testId(`${suffix}-member-${index}`),
    circleId,
    userId,
    membershipStatus: 'active',
    isActive: true,
    joinedAt: now,
    updatedAt: now,
  })));
  return circleId;
}
