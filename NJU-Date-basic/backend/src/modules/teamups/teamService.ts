import { v4 as uuid } from 'uuid';
import { and, asc, desc, eq, gt, inArray, lte, or, sql } from 'drizzle-orm';
import { db } from '../../db/connection.js';
import { config } from '../../config.js';
import {
  auditLogs,
  circleMemberRoles,
  circleMembers,
  circles,
  teamupApplications,
  teamupForumSyncJobs,
  teamupMemberContacts,
  teamupMembers,
  teamups,
  userBlocks,
  users,
} from '../../db/schema.js';
import { AppError, NotFoundError, ValidationError } from '../../utils/errors.js';
import { CIRCLE_MEMBERSHIP_STATUS } from '../../utils/circleMembership.js';
import { CIRCLE_MEMBER_ROLE } from '../../utils/circleRoles.js';
import { CIRCLE_STATUS } from '../../utils/circleStatus.js';
import { areUsersBlocked, areUsersCircleFriends } from '../socialGraph/relationships.js';
import { getFriendCard, getPublicCard, parseStoredCardSnapshot } from '../cards/index.js';
import { createPost, deletePost } from '../../services/forumService.js';
import { createUserNotification, createUserNotifications } from '../../services/notificationService.js';
import {
  createG2ContactSecret,
  decryptG2ContactSecret,
  deleteG2ContactSecretsForScope,
  getG2ContactSecretForScope,
  normalizeG2ContactType,
  toG2StoredContactRef,
  type G2ContactSecretRow,
  type G2ContactSecretScopeType,
  type G2StoredContactRef,
} from '../../services/g2ContactSecretService.js';
import {
  buildDescriptionPreview,
  canPromoteFromWaitlist,
  getEffectiveStatus,
  isActiveWaitlistApplication,
  isJoinable,
  isOngoingTeamup,
  isWaitlistable,
  normalizeContacts,
  normalizeDescription,
  normalizeTeamupType,
  normalizeText,
  stripContactLikeText,
  toTime,
  validateTimeWindow,
  type CreateTeamupInput,
  type TeamupApplicationAction,
  type TeamupApplicationType,
  type TeamupCancelSource,
  type TeamupContactInput,
  type TeamupEffectiveStatus,
  type TeamupJoinMode,
  type TeamupMemberRole,
  type TeamupStatus,
  type TeamupType,
  type UpdateTeamupInput,
} from './policy.js';
export {
  containsContactLikeText,
  type CreateTeamupInput,
  type TeamupApplicationAction,
  type TeamupApplicationType,
  type TeamupCancelSource,
  type TeamupContactInput,
  type TeamupEffectiveStatus,
  type TeamupJoinMode,
  type TeamupMemberRole,
  type TeamupStatus,
  type TeamupType,
  type UpdateTeamupInput,
} from './policy.js';

type TeamupRow = typeof teamups.$inferSelect;
type TeamupApplicationRow = typeof teamupApplications.$inferSelect;
type ViewerTeamupApplicationState = {
  id: string;
  status: string;
  applicationType: string;
  waitlistPosition: number | null;
};

const TEAMUP_FORUM_SYNC_ENABLED: boolean = false;
const WAITLIST_REJECTION_WINDOW_DAYS = 7;
const WAITLIST_REJECTION_LIMIT = 2;
const DIRECT_WAITLIST_NOTE = '直接加入模式候补登记';

function nowIso() {
  return new Date().toISOString();
}

type StoredTeamupContact = G2StoredContactRef & {
  value?: string;
};

type TeamupContactSecretScope = {
  ownerUserId: string;
  scopeType: Extract<G2ContactSecretScopeType, 'teamup_application' | 'teamup_member'>;
  scopeId: string;
};

function safeDecryptTeamupContactSecret(secret: G2ContactSecretRow, contact: StoredTeamupContact) {
  try {
    return decryptG2ContactSecret(secret);
  } catch (error) {
    console.warn('[G2_CONTACT_SECRET] teamup contact decrypt failed; falling back to masked value', {
      contactSecretId: secret.id,
      scopeType: secret.scopeType,
      scopeId: secret.scopeId,
      error: error instanceof Error ? error.message : String(error),
    });
    return contact.value ?? contact.maskedValue ?? '';
  }
}

function teamupContactFieldKey(index: number) {
  return `teamup_contact_${index}`;
}

async function replaceTeamupStoredContacts(
  client: any,
  ownerUserId: string,
  scopeType: Extract<G2ContactSecretScopeType, 'teamup_application' | 'teamup_member'>,
  scopeId: string,
  contacts: TeamupContactInput[],
  now: string,
) {
  await deleteG2ContactSecretsForScope(client, ownerUserId, scopeType, scopeId);

  const refs: G2StoredContactRef[] = [];
  for (const [index, contact] of contacts.entries()) {
    const label = contact.label ?? contact.type;
    const secret = await createG2ContactSecret(client, {
      ownerUserId,
      scopeType,
      scopeId,
      fieldKey: teamupContactFieldKey(index),
      contactType: normalizeG2ContactType(contact.type, label),
      label,
      value: contact.value,
      now,
    });
    refs.push(toG2StoredContactRef(secret, { type: contact.type, label }));
  }

  return refs;
}

async function resolveStoredTeamupContactValue(
  client: any,
  contact: StoredTeamupContact,
  scope: TeamupContactSecretScope,
) {
  if (contact.contactSecretId) {
    const secret = await getG2ContactSecretForScope(
      client,
      contact.contactSecretId,
      scope.ownerUserId,
      scope.scopeType,
      scope.scopeId,
    );
    if (secret) return safeDecryptTeamupContactSecret(secret, contact);
    return '';
  }
  return contact.value ?? '';
}

async function cloneTeamupStoredContacts(
  client: any,
  ownerUserId: string,
  sourceContacts: StoredTeamupContact[],
  sourceScope: TeamupContactSecretScope,
  scopeType: Extract<G2ContactSecretScopeType, 'teamup_application' | 'teamup_member'>,
  scopeId: string,
  now: string,
) {
  await deleteG2ContactSecretsForScope(client, ownerUserId, scopeType, scopeId);

  const refs: G2StoredContactRef[] = [];
  for (const [index, contact] of sourceContacts.entries()) {
    const type = contact.type || 'contact';
    const label = contact.label || type;
    const value = await resolveStoredTeamupContactValue(client, contact, sourceScope);
    if (!value) continue;

    const secret = await createG2ContactSecret(client, {
      ownerUserId,
      scopeType,
      scopeId,
      fieldKey: teamupContactFieldKey(index),
      contactType: normalizeG2ContactType(type, label),
      label,
      value,
      now,
    });
    refs.push(toG2StoredContactRef(secret, { type, label }));
  }

  return refs;
}

async function revealTeamupStoredContacts(
  client: any,
  contacts: StoredTeamupContact[],
  scope: TeamupContactSecretScope,
) {
  return Promise.all((contacts ?? []).map(async (contact) => ({
    type: contact.type,
    label: contact.label,
    maskedValue: contact.maskedValue,
    value: await resolveStoredTeamupContactValue(client, contact, scope),
  })));
}

function isActiveApplicationForViewer(application: Pick<TeamupApplicationRow, 'applicationType' | 'status' | 'waitlistJoinedAt'>) {
  return application.status === 'pending' || isActiveWaitlistApplication(application);
}

async function ensureCircleActiveMember(userId: string, circleId: string, client: Pick<typeof db, 'select'> = db) {
  const rows = await client.select({
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
    throw new AppError(403, 'CIRCLE_NOT_ACTIVE', '圈子已下架或不可用');
  }
  if (!row.memberId || row.membershipStatus !== CIRCLE_MEMBERSHIP_STATUS.ACTIVE || !row.memberIsActive) {
    throw new AppError(403, 'JOIN_CIRCLE_REQUIRED', '需要先加入圈子');
  }
}

async function ensureCircleExists(circleId: string) {
  const rows = await db.select({ id: circles.id }).from(circles).where(eq(circles.id, circleId)).limit(1);
  if (!rows[0]) throw new NotFoundError('圈子不存在');
}

async function getTeamupOrThrow(circleId: string, teamupId: string) {
  const rows = await db.select().from(teamups)
    .where(and(eq(teamups.id, teamupId), eq(teamups.circleId, circleId)))
    .limit(1);
  const teamup = rows[0];
  if (!teamup) throw new AppError(404, 'TEAMUP_NOT_FOUND', '组队不存在');
  return teamup;
}

async function getLeaderMap(leaderIds: string[]) {
  const uniqueIds = Array.from(new Set(leaderIds.filter(Boolean)));
  if (uniqueIds.length === 0) return new Map<string, { id: string; nickname: string | null; avatarUrl: string | null }>();
  const rows = await db.select({
    id: users.id,
    nickname: users.nickname,
    avatarUrl: users.avatarUrl,
  }).from(users).where(inArray(users.id, uniqueIds));
  return new Map(rows.map((row) => [row.id, row]));
}

async function getViewerTeamupState(viewerId: string, teamupIds: string[]) {
  if (teamupIds.length === 0) {
    return {
      members: new Map<string, typeof teamupMembers.$inferSelect>(),
      applications: new Map<string, ViewerTeamupApplicationState>(),
      waitlistCounts: new Map<string, number>(),
    };
  }

  const [memberRows, applicationRows, waitlistRows] = await Promise.all([
    db.select().from(teamupMembers)
      .where(and(inArray(teamupMembers.teamupId, teamupIds), eq(teamupMembers.userId, viewerId))),
    db.select({
      id: teamupApplications.id,
      teamupId: teamupApplications.teamupId,
      status: teamupApplications.status,
      applicationType: teamupApplications.applicationType,
      waitlistJoinedAt: teamupApplications.waitlistJoinedAt,
    }).from(teamupApplications)
      .where(and(
        inArray(teamupApplications.teamupId, teamupIds),
        eq(teamupApplications.applicantId, viewerId),
        or(
          eq(teamupApplications.status, 'pending'),
          and(
            eq(teamupApplications.applicationType, 'waitlist'),
            eq(teamupApplications.status, 'approved'),
            sql`${teamupApplications.waitlistJoinedAt} IS NULL`,
          ),
        ),
      )),
    db.select({
      id: teamupApplications.id,
      teamupId: teamupApplications.teamupId,
      applicantId: teamupApplications.applicantId,
      status: teamupApplications.status,
      createdAt: teamupApplications.createdAt,
    }).from(teamupApplications)
      .where(and(
        inArray(teamupApplications.teamupId, teamupIds),
        eq(teamupApplications.applicationType, 'waitlist'),
        inArray(teamupApplications.status, ['pending', 'approved']),
        sql`${teamupApplications.waitlistJoinedAt} IS NULL`,
      ))
      .orderBy(asc(teamupApplications.createdAt), asc(teamupApplications.id)),
  ]);

  const waitlistCounts = new Map<string, number>();
  const waitlistPositionsByApplicationId = new Map<string, number>();
  for (const row of waitlistRows) {
    const nextPosition = (waitlistCounts.get(row.teamupId) ?? 0) + 1;
    waitlistCounts.set(row.teamupId, nextPosition);
    waitlistPositionsByApplicationId.set(row.id, nextPosition);
  }

  return {
    members: new Map(memberRows.map((row) => [row.teamupId, row])),
    applications: new Map(applicationRows
      .filter(isActiveApplicationForViewer)
      .map((row) => [row.teamupId, {
        id: row.id,
        status: row.status,
        applicationType: row.applicationType,
        waitlistPosition: row.applicationType === 'waitlist'
          ? waitlistPositionsByApplicationId.get(row.id) ?? null
          : null,
      }])),
    waitlistCounts,
  };
}

async function lockTeamupForUpdate(tx: Pick<typeof db, 'execute' | 'select'>, circleId: string, teamupId: string) {
  await tx.execute(sql`SELECT id FROM teamups WHERE id = ${teamupId} AND circle_id = ${circleId} FOR UPDATE`);
  const rows = await tx.select().from(teamups)
    .where(and(eq(teamups.id, teamupId), eq(teamups.circleId, circleId)))
    .limit(1);
  const teamup = rows[0];
  if (!teamup) throw new AppError(404, 'TEAMUP_NOT_FOUND', '组队不存在');
  return teamup;
}

async function assertNoBlockedActiveTeamupMember(
  candidateUserId: string,
  teamupId: string,
  client: any = db,
) {
  const memberRows: Array<{ userId: string }> = await client.select({
    userId: teamupMembers.userId,
  }).from(teamupMembers)
    .where(and(
      eq(teamupMembers.teamupId, teamupId),
      eq(teamupMembers.membershipStatus, 'active'),
    ));

  const activePeerIds = Array.from(new Set(
    memberRows.map((row) => row.userId).filter((memberUserId) => memberUserId !== candidateUserId),
  ));
  if (activePeerIds.length === 0) return;

  const blockRows = await client.select({ id: userBlocks.id }).from(userBlocks)
    .where(or(
      and(eq(userBlocks.blockerId, candidateUserId), inArray(userBlocks.blockedId, activePeerIds)),
      and(eq(userBlocks.blockedId, candidateUserId), inArray(userBlocks.blockerId, activePeerIds)),
    ))
    .limit(1);

  if (blockRows[0]) {
    throw new AppError(403, 'TEAMUP_MEMBER_BLOCKED', '当前无法加入存在拉黑关系的组队');
  }
}

async function activateTeamupMember(
  tx: Pick<typeof db, 'insert' | 'update'>,
  teamupId: string,
  userId: string,
  now: string,
) {
  const inserted = await tx.insert(teamupMembers).values({
    id: uuid(),
    teamupId,
    userId,
    memberRole: 'member',
    membershipStatus: 'active',
    joinedAt: now,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing({
    target: [teamupMembers.teamupId, teamupMembers.userId],
  }).returning({ id: teamupMembers.id });
  if (inserted[0]) return inserted[0];

  const reactivated = await tx.update(teamupMembers)
    .set({ membershipStatus: 'active', memberRole: 'member', joinedAt: now, leftAt: null, updatedAt: now })
    .where(and(
      eq(teamupMembers.teamupId, teamupId),
      eq(teamupMembers.userId, userId),
      sql`${teamupMembers.membershipStatus} <> 'active'`,
    ))
    .returning({ id: teamupMembers.id });
  if (reactivated[0]) return reactivated[0];

  throw new AppError(409, 'ALREADY_TEAMUP_MEMBER', '你已加入该组队');
}

async function throwApplicationStateError(tx: Pick<typeof db, 'select'>, teamupId: string, applicationId: string): Promise<never> {
  const rows = await tx.select({ id: teamupApplications.id, status: teamupApplications.status })
    .from(teamupApplications)
    .where(and(eq(teamupApplications.id, applicationId), eq(teamupApplications.teamupId, teamupId)))
    .limit(1);
  if (!rows[0]) throw new AppError(404, 'APPLICATION_NOT_FOUND', '申请不存在');
  throw new AppError(409, 'APPLICATION_NOT_PENDING', '申请不是待审核状态');
}

async function getActiveTeamupApplication(client: any, teamupId: string, userId: string) {
  const rows = await client.select({
    id: teamupApplications.id,
    status: teamupApplications.status,
    applicationType: teamupApplications.applicationType,
    waitlistJoinedAt: teamupApplications.waitlistJoinedAt,
  }).from(teamupApplications)
    .where(and(
      eq(teamupApplications.teamupId, teamupId),
      eq(teamupApplications.applicantId, userId),
      or(
        eq(teamupApplications.status, 'pending'),
        and(
          eq(teamupApplications.applicationType, 'waitlist'),
          eq(teamupApplications.status, 'approved'),
          sql`${teamupApplications.waitlistJoinedAt} IS NULL`,
        ),
      ),
    ))
    .limit(1);
  return rows[0] ?? null;
}

async function assertNoActiveTeamupApplication(client: any, teamupId: string, userId: string) {
  const activeApplication = await getActiveTeamupApplication(client, teamupId, userId);
  if (!activeApplication) return;
  if (activeApplication.applicationType === 'waitlist') {
    throw new AppError(409, 'WAITLIST_APPLICATION_EXISTS', '你已在该组队候补队列中');
  }
  throw new AppError(409, 'PENDING_APPLICATION_EXISTS', '已存在待审核申请');
}

async function getActiveWaitlistCount(client: any, teamupId: string) {
  const rows = await client.select({ id: teamupApplications.id })
    .from(teamupApplications)
    .where(and(
      eq(teamupApplications.teamupId, teamupId),
      eq(teamupApplications.applicationType, 'waitlist'),
      inArray(teamupApplications.status, ['pending', 'approved']),
      sql`${teamupApplications.waitlistJoinedAt} IS NULL`,
    ));
  return rows.length;
}

async function assertWaitlistCapacity(client: any, teamupId: string, maxMembers: number) {
  const waitlistCount = await getActiveWaitlistCount(client, teamupId);
  if (waitlistCount >= maxMembers) {
    throw new AppError(409, 'TEAMUP_WAITLIST_FULL', '候补名额已满');
  }
  return waitlistCount;
}

async function assertWaitlistRejectionLimit(client: any, teamupId: string, applicantId: string, now: string) {
  const cooldownStart = new Date(Date.parse(now) - WAITLIST_REJECTION_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const rows = await client.select({ id: teamupApplications.id })
    .from(teamupApplications)
    .where(and(
      eq(teamupApplications.teamupId, teamupId),
      eq(teamupApplications.applicantId, applicantId),
      eq(teamupApplications.applicationType, 'waitlist'),
      eq(teamupApplications.status, 'rejected'),
      sql`${teamupApplications.reviewedAt} >= ${cooldownStart}`,
    ))
    .limit(WAITLIST_REJECTION_LIMIT);

  if (rows.length >= WAITLIST_REJECTION_LIMIT) {
    throw new AppError(429, 'TEAMUP_WAITLIST_REJECTED_TOO_OFTEN', '7天内候补被拒绝 2 次后，暂不能再次候补该组队');
  }
}

async function invalidateWaitlistApplication(client: any, applicationId: string, now: string, reviewNote: string) {
  await client.update(teamupApplications)
    .set({
      status: 'withdrawn',
      reviewNote,
      updatedAt: now,
    })
    .where(eq(teamupApplications.id, applicationId));
}

async function promoteWaitlistCandidates(
  tx: any,
  initialTeamup: TeamupRow,
  circleId: string,
  now: string,
) {
  let currentTeamup = initialTeamup;
  const promotions: Array<{ applicationId: string; applicantId: string }> = [];

  while (canPromoteFromWaitlist(currentTeamup)) {
    const candidates = await tx.select().from(teamupApplications)
      .where(and(
        eq(teamupApplications.teamupId, currentTeamup.id),
        eq(teamupApplications.applicationType, 'waitlist'),
        eq(teamupApplications.status, 'approved'),
        sql`${teamupApplications.waitlistJoinedAt} IS NULL`,
      ))
      .orderBy(asc(teamupApplications.createdAt), asc(teamupApplications.id))
      .limit(1);

    const application = candidates[0];
    if (!application) break;

    const activeMember = await tx.select({ id: teamupMembers.id })
      .from(teamupMembers)
      .where(and(
        eq(teamupMembers.teamupId, currentTeamup.id),
        eq(teamupMembers.userId, application.applicantId),
        eq(teamupMembers.membershipStatus, 'active'),
      ))
      .limit(1);

    if (activeMember[0]) {
      await tx.update(teamupApplications)
        .set({ waitlistJoinedAt: now, updatedAt: now })
        .where(eq(teamupApplications.id, application.id));
      continue;
    }

    try {
      await ensureCircleActiveMember(application.applicantId, circleId, tx);
      if (await areUsersBlocked(application.applicantId, currentTeamup.leaderId, tx)) {
        throw new AppError(403, 'USER_BLOCKED', '当前无法自动补位该候补');
      }
      await assertNoBlockedActiveTeamupMember(application.applicantId, currentTeamup.id, tx);
    } catch {
      await invalidateWaitlistApplication(tx, application.id, now, '候补资格已失效');
      continue;
    }

    await activateTeamupMember(tx, currentTeamup.id, application.applicantId, now);

    const existingContactRows = await tx.select({ id: teamupMemberContacts.id })
      .from(teamupMemberContacts)
      .where(and(
        eq(teamupMemberContacts.teamupId, currentTeamup.id),
        eq(teamupMemberContacts.userId, application.applicantId),
      ))
      .limit(1);
    const memberContactId = existingContactRows[0]?.id ?? uuid();
    const storedContacts = await cloneTeamupStoredContacts(
      tx,
      application.applicantId,
      application.contactPayload as StoredTeamupContact[],
      {
        ownerUserId: application.applicantId,
        scopeType: 'teamup_application',
        scopeId: application.id,
      },
      'teamup_member',
      memberContactId,
      now,
    );

    await tx.insert(teamupMemberContacts).values({
      id: memberContactId,
      teamupId: currentTeamup.id,
      userId: application.applicantId,
      contacts: storedContacts,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: [teamupMemberContacts.teamupId, teamupMemberContacts.userId],
      set: { contacts: storedContacts, updatedAt: now },
    });

    await tx.update(teamupApplications)
      .set({ waitlistJoinedAt: now, updatedAt: now })
      .where(eq(teamupApplications.id, application.id));

    const updatedTeamups = await tx.update(teamups)
      .set({
        currentMemberCount: sql`${teamups.currentMemberCount} + 1`,
        status: sql`CASE WHEN ${teamups.currentMemberCount} + 1 >= ${teamups.maxMembers} THEN 'full' ELSE 'recruiting' END`,
        forumSyncStatus: TEAMUP_FORUM_SYNC_ENABLED && currentTeamup.isPublic ? 'pending' : currentTeamup.forumSyncStatus,
        updatedAt: now,
      })
      .where(eq(teamups.id, currentTeamup.id))
      .returning();

    currentTeamup = updatedTeamups[0]!;
    promotions.push({ applicationId: application.id, applicantId: application.applicantId });

    await tx.insert(auditLogs).values({
      operatorId: currentTeamup.leaderId,
      action: 'teamup_waitlist_promoted',
      target: currentTeamup.id,
      detail: JSON.stringify({
        circleId,
        applicationId: application.id,
        applicantId: application.applicantId,
      }),
      createdAt: now,
    });

    await createUserNotifications([
      {
        recipientId: application.applicantId,
        actorId: currentTeamup.leaderId,
        type: 'teamup_waitlist_promoted',
        title: '候补已自动入队',
        content: `你已从候补自动加入「${currentTeamup.title}」`,
        meta: {
          circleId,
          teamupId: currentTeamup.id,
          applicationId: application.id,
          actionUrl: `/circles/${circleId}/teamups/${currentTeamup.id}`,
        },
      },
      {
        recipientId: currentTeamup.leaderId,
        actorId: application.applicantId,
        type: 'teamup_waitlist_promoted',
        title: '候补成员已补位',
        content: `「${currentTeamup.title}」已有候补成员自动补位加入`,
        meta: {
          circleId,
          teamupId: currentTeamup.id,
          applicationId: application.id,
          applicantId: application.applicantId,
          actionUrl: `/circles/${circleId}/teamups/${currentTeamup.id}`,
        },
      },
    ], tx);

    if (TEAMUP_FORUM_SYNC_ENABLED && currentTeamup.isPublic) await queueForumSyncJob(tx, currentTeamup, 'update');
  }

  return { teamup: currentTeamup, promotions };
}

function serializeTeamup(
  teamup: TeamupRow,
  leader: { id: string; nickname: string | null; avatarUrl: string | null } | undefined,
  viewerMember?: typeof teamupMembers.$inferSelect,
  viewerApplication?: ViewerTeamupApplicationState | null,
  waitlistCount = 0,
) {
  const effectiveStatus = getEffectiveStatus(teamup);
  const viewerIsActiveMember = viewerMember?.membershipStatus === 'active';
  const canViewContacts = viewerIsActiveMember
    && effectiveStatus === 'expired'
    && teamup.status !== 'cancelled';
  const visibleDescription = canViewContacts
    ? teamup.description
    : stripContactLikeText(teamup.description).trim();

  return {
    id: teamup.id,
    circleId: teamup.circleId,
    forumPostId: teamup.forumPostId,
    forumPostAuthorId: teamup.forumPostAuthorId,
    leaderId: teamup.leaderId,
    title: teamup.title,
    description: visibleDescription || teamup.descriptionPreview,
    descriptionPreview: teamup.descriptionPreview,
    maxMembers: teamup.maxMembers,
    currentMemberCount: teamup.currentMemberCount,
    deadlineAt: teamup.deadlineAt,
    endAt: teamup.endAt,
    teamupType: teamup.teamupType,
    joinMode: teamup.joinMode,
    isPublic: teamup.isPublic,
    status: teamup.status,
    effectiveStatus,
    joinable: isJoinable(teamup),
    waitlistable: isWaitlistable(teamup) && waitlistCount < teamup.maxMembers,
    waitlistCount,
    waitlistCapacity: teamup.maxMembers,
    waitlistAvailable: Math.max(teamup.maxMembers - waitlistCount, 0),
    leader: leader ? {
      userId: leader.id,
      nickname: leader.nickname,
      avatarUrl: leader.avatarUrl,
    } : null,
    viewer: {
      isCircleMember: true,
      isTeamupMember: viewerIsActiveMember,
      isLeader: viewerMember?.memberRole === 'leader' && viewerIsActiveMember,
      canManage: viewerMember?.memberRole === 'leader' && viewerIsActiveMember,
      canViewContacts,
      contactsVisibleUntil: canViewContacts ? teamup.endAt : null,
      pendingApplicationId: viewerApplication?.status === 'pending' ? viewerApplication.id : null,
      activeApplicationId: viewerApplication?.id ?? null,
      applicationStatus: viewerApplication?.status ?? null,
      applicationType: viewerApplication?.applicationType ?? null,
      waitlistPosition: viewerApplication?.waitlistPosition ?? null,
    },
    createdAt: teamup.createdAt,
    updatedAt: teamup.updatedAt,
  };
}

function serializeListTeamup(
  teamup: TeamupRow,
  leader: { id: string; nickname: string | null; avatarUrl: string | null } | undefined,
  viewerMember?: typeof teamupMembers.$inferSelect,
  viewerApplication?: ViewerTeamupApplicationState | null,
  waitlistCount = 0,
) {
  const effectiveStatus = getEffectiveStatus(teamup);
  const viewerIsActiveMember = viewerMember?.membershipStatus === 'active';
  const viewerIsLeader = viewerMember?.memberRole === 'leader' && viewerIsActiveMember;
  const canViewContacts = viewerIsActiveMember
    && effectiveStatus === 'expired'
    && teamup.status !== 'cancelled';

  return {
    id: teamup.id,
    circleId: teamup.circleId,
    leaderId: teamup.leaderId,
    title: teamup.title,
    descriptionPreview: teamup.descriptionPreview,
    maxMembers: teamup.maxMembers,
    currentMemberCount: teamup.currentMemberCount,
    deadlineAt: teamup.deadlineAt,
    endAt: teamup.endAt,
    teamupType: teamup.teamupType,
    joinMode: teamup.joinMode,
    isPublic: teamup.isPublic,
    status: teamup.status,
    effectiveStatus,
    joinable: isJoinable(teamup),
    waitlistable: isWaitlistable(teamup) && waitlistCount < teamup.maxMembers,
    waitlistCount,
    waitlistCapacity: teamup.maxMembers,
    waitlistAvailable: Math.max(teamup.maxMembers - waitlistCount, 0),
    leader: leader ? {
      userId: leader.id,
      nickname: leader.nickname,
      avatarUrl: leader.avatarUrl,
    } : null,
    viewer: {
      isCircleMember: true,
      isTeamupMember: viewerIsActiveMember,
      isLeader: viewerIsLeader,
      canManage: viewerIsLeader,
      canViewContacts,
      contactsVisibleUntil: canViewContacts ? teamup.endAt : null,
      pendingApplicationId: viewerApplication?.status === 'pending' ? viewerApplication.id : null,
      activeApplicationId: viewerApplication?.id ?? null,
      applicationStatus: viewerApplication?.status ?? null,
      applicationType: viewerApplication?.applicationType ?? null,
      waitlistPosition: viewerApplication?.waitlistPosition ?? null,
    },
    updatedAt: teamup.updatedAt,
  };
}

function buildForumPayload(teamup: TeamupRow, leader: { id: string; nickname: string | null; avatarUrl: string | null } | undefined) {
  return {
    id: teamup.id,
    circleId: teamup.circleId,
    leaderId: teamup.leaderId,
    title: teamup.title,
    descriptionPreview: teamup.descriptionPreview,
    maxMembers: teamup.maxMembers,
    currentMemberCount: teamup.currentMemberCount,
    deadlineAt: teamup.deadlineAt,
    endAt: teamup.endAt,
    teamupType: teamup.teamupType,
    joinMode: teamup.joinMode,
    isPublic: teamup.isPublic,
    status: teamup.status,
    effectiveStatus: getEffectiveStatus(teamup),
    joinable: isJoinable(teamup),
    leader: leader ? {
      userId: leader.id,
      nickname: leader.nickname,
      avatarUrl: leader.avatarUrl,
    } : null,
    updatedAt: teamup.updatedAt,
  };
}

function getJoinModeLabel(joinMode: string) {
  return joinMode === 'approval' ? '需递拜帖' : '推门即入';
}

function getTeamupTypeLabel(teamupType: TeamupType) {
  return teamupType === 'long_term' ? '长期组队' : '临期组队';
}

function getTeamupStatusLabel(teamup: TeamupRow) {
  const effectiveStatus = getEffectiveStatus(teamup);
  if (effectiveStatus === 'full') return '已满员';
  if (effectiveStatus === 'expired') return '已截止';
  if (effectiveStatus === 'ended') return '已结束';
  if (effectiveStatus === 'cancelled') return '已取消';
  return '招募中';
}

function buildForumPostContent(
  teamup: TeamupRow,
  leader: { id: string; nickname: string | null; avatarUrl: string | null } | undefined,
  sourceCircle: { name: string | null } | undefined,
) {
  const circleName = sourceCircle?.name?.trim() || '该兴趣圈';
  const detailUrl = `${config.frontend.publicUrl.replace(/\/+$/, '')}/circles/${teamup.circleId}/teamups/${teamup.id}`;
  return [
    '【兴趣圈组队同步帖】',
    '',
    `来自「${circleName}」的公开组队：${teamup.title}`,
    leader?.nickname ? `发起人：${leader.nickname}` : null,
    `类型：${getTeamupTypeLabel(normalizeTeamupType(teamup.teamupType))}`,
    `人数：${teamup.currentMemberCount}/${teamup.maxMembers}`,
    `状态：${getTeamupStatusLabel(teamup)}`,
    `加入方式：${getJoinModeLabel(teamup.joinMode)}`,
    `招募截止：${teamup.deadlineAt}`,
    `活动结束：${teamup.endAt}`,
    '',
    '内容简介：',
    teamup.descriptionPreview,
    '',
    '查看和加入请前往组队详情：',
    detailUrl,
  ].filter(Boolean).join('\n');
}

async function createForumPostForTeamup(
  teamup: TeamupRow,
  leader: { id: string; nickname: string | null; avatarUrl: string | null } | undefined,
  sourceCircle: { name: string | null } | undefined,
) {
  if (!TEAMUP_FORUM_SYNC_ENABLED) return teamup;

  const result = await createPost(teamup.leaderId, {
    circleId: null,
    title: teamup.title,
    content: buildForumPostContent(teamup, leader, sourceCircle),
    type: 'squad',
  });

  const now = nowIso();
  const rows = await db.update(teamups)
    .set({
      forumPostId: result.postId,
      forumPostAuthorId: teamup.leaderId,
      forumSyncStatus: 'synced',
      forumSyncError: null,
      updatedAt: now,
    })
    .where(eq(teamups.id, teamup.id))
    .returning();

  return rows[0] ?? teamup;
}

async function markForumPostSyncFailed(teamup: TeamupRow, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const rows = await db.update(teamups)
    .set({
      forumSyncStatus: 'failed',
      forumSyncError: message.slice(0, 1000),
      updatedAt: nowIso(),
    })
    .where(eq(teamups.id, teamup.id))
    .returning();

  return rows[0] ?? teamup;
}

async function markForumPostSyncSucceeded(teamup: TeamupRow) {
  const rows = await db.update(teamups)
    .set({
      forumSyncStatus: 'synced',
      forumSyncError: null,
      updatedAt: nowIso(),
    })
    .where(eq(teamups.id, teamup.id))
    .returning();

  return rows[0] ?? teamup;
}

async function deleteForumPostForTeamup(teamup: TeamupRow) {
  if (!TEAMUP_FORUM_SYNC_ENABLED) return teamup;
  if (!teamup.isPublic) return teamup;
  if (!teamup.forumPostId) return markForumPostSyncSucceeded(teamup);

  try {
    await deletePost(teamup.leaderId, teamup.forumPostId);
    return await markForumPostSyncSucceeded(teamup);
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 404) {
      return await markForumPostSyncSucceeded(teamup);
    }
    return await markForumPostSyncFailed(teamup, err);
  }
}

async function queueForumSyncJob(
  tx: Pick<typeof db, 'insert'>,
  teamup: TeamupRow,
  action: 'create' | 'update' | 'archive',
  leader?: { id: string; nickname: string | null; avatarUrl: string | null },
) {
  if (!TEAMUP_FORUM_SYNC_ENABLED) return;
  if (!teamup.isPublic) return;

  await tx.insert(teamupForumSyncJobs).values({
    id: uuid(),
    teamupId: teamup.id,
    action,
    payload: buildForumPayload(teamup, leader) as Record<string, unknown>,
    status: 'pending',
    attemptCount: 0,
    nextRetryAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

async function getActiveMembers(teamupId: string) {
  const rows = await db.select({
    userId: teamupMembers.userId,
    memberRole: teamupMembers.memberRole,
    membershipStatus: teamupMembers.membershipStatus,
    joinedAt: teamupMembers.joinedAt,
    nickname: users.nickname,
    avatarUrl: users.avatarUrl,
  }).from(teamupMembers)
    .innerJoin(users, eq(teamupMembers.userId, users.id))
    .where(and(
      eq(teamupMembers.teamupId, teamupId),
      inArray(teamupMembers.membershipStatus, ['active', 'cancelled']),
    ));

  return rows.map((row) => ({
    userId: row.userId,
    nickname: row.nickname,
    avatarUrl: row.avatarUrl,
    memberRole: row.memberRole,
    joinedAt: row.joinedAt,
  }));
}

async function ensureCanAdminCancel(userId: string, circleId: string) {
  const rows = await db.select({ role: circleMemberRoles.role }).from(circleMemberRoles)
    .where(and(
      eq(circleMemberRoles.circleId, circleId),
      eq(circleMemberRoles.userId, userId),
      inArray(circleMemberRoles.role, [CIRCLE_MEMBER_ROLE.OWNER, CIRCLE_MEMBER_ROLE.ADMIN]),
    ))
    .limit(1);
  if (!rows[0]) throw new AppError(403, 'NOT_TEAMUP_LEADER', '无权管理该组队');
}

export async function listTeamups(
  viewerId: string,
  circleId: string,
  query: {
    status?: string;
    visibility?: string;
    joinMode?: string;
    teamupType?: string;
    mine?: string;
    keyword?: string;
    page: number;
    limit: number;
  },
) {
  await ensureCircleActiveMember(viewerId, circleId);

  const rows = await db.select().from(teamups)
    .where(and(eq(teamups.circleId, circleId), gt(teamups.endAt, new Date().toISOString())))
    .orderBy(desc(teamups.updatedAt));

  const teamupIds = rows.map((row) => row.id);
  const [leaders, viewerState, appliedRows] = await Promise.all([
    getLeaderMap(rows.map((row) => row.leaderId)),
    getViewerTeamupState(viewerId, teamupIds),
    query.mine === 'applied' && teamupIds.length > 0
      ? db.select({ teamupId: teamupApplications.teamupId }).from(teamupApplications)
        .where(and(
          inArray(teamupApplications.teamupId, teamupIds),
          eq(teamupApplications.applicantId, viewerId),
          or(
            eq(teamupApplications.status, 'pending'),
            and(
              eq(teamupApplications.applicationType, 'waitlist'),
              eq(teamupApplications.status, 'approved'),
              sql`${teamupApplications.waitlistJoinedAt} IS NULL`,
            ),
          ),
        ))
      : Promise.resolve([]),
  ]);

  const appliedSet = new Set(appliedRows.map((row) => row.teamupId));
  const keyword = query.keyword?.trim().toLowerCase();

  const filtered = rows.filter((teamup) => {
    const effectiveStatus = getEffectiveStatus(teamup);
    const member = viewerState.members.get(teamup.id);
    if (query.status && query.status !== 'all' && query.status !== effectiveStatus && query.status !== teamup.status) return false;
    if (query.visibility === 'public' && !teamup.isPublic) return false;
    if (query.visibility === 'circle' && teamup.isPublic) return false;
    if (query.joinMode && query.joinMode !== 'all' && query.joinMode !== teamup.joinMode) return false;
    if (query.teamupType && query.teamupType !== 'all' && query.teamupType !== teamup.teamupType) return false;
    if (query.mine === 'created' && teamup.leaderId !== viewerId) return false;
    if (query.mine === 'joined' && member?.membershipStatus !== 'active') return false;
    if (query.mine === 'applied' && !appliedSet.has(teamup.id)) return false;
    if (keyword) {
      const searchableText = `${teamup.title} ${stripContactLikeText(teamup.description)}`.toLowerCase();
      if (!searchableText.includes(keyword)) return false;
    }
    return true;
  }).sort((a, b) => {
    const aJoinable = isJoinable(a) ? 1 : 0;
    const bJoinable = isJoinable(b) ? 1 : 0;
    if (aJoinable !== bJoinable) return bJoinable - aJoinable;
    return toTime(b.updatedAt) - toTime(a.updatedAt);
  });

  const start = (query.page - 1) * query.limit;
  const pageRows = filtered.slice(start, start + query.limit);

  return {
    total: filtered.length,
    page: query.page,
    limit: query.limit,
    teamups: pageRows.map((teamup) => serializeListTeamup(
      teamup,
      leaders.get(teamup.leaderId),
      viewerState.members.get(teamup.id),
      viewerState.applications.get(teamup.id),
      viewerState.waitlistCounts.get(teamup.id) ?? 0,
    )),
  };
}

export async function listMyTeamupHistory(
  viewerId: string,
  circleId: string,
  query: { role?: string; visibility?: string; page: number; limit: number },
) {
  await ensureCircleActiveMember(viewerId, circleId);

  const memberRows = await db.select({ teamupId: teamupMembers.teamupId, memberRole: teamupMembers.memberRole })
    .from(teamupMembers)
    .where(eq(teamupMembers.userId, viewerId));
  const memberByTeamupId = new Map(memberRows.map((row) => [row.teamupId, row.memberRole]));
  const teamupIds = Array.from(memberByTeamupId.keys());
  if (teamupIds.length === 0) {
    return { total: 0, page: query.page, limit: query.limit, teamups: [] };
  }

  const rows = await db.select().from(teamups)
    .where(and(
      eq(teamups.circleId, circleId),
      inArray(teamups.id, teamupIds),
      lte(teamups.endAt, new Date().toISOString()),
    ))
    .orderBy(desc(teamups.endAt));

  const leaders = await getLeaderMap(rows.map((row) => row.leaderId));
  const filtered = rows.filter((teamup) => {
    if (query.role === 'created' && teamup.leaderId !== viewerId) return false;
    if (query.role === 'joined' && teamup.leaderId === viewerId) return false;
    if (query.visibility === 'public' && !teamup.isPublic) return false;
    if (query.visibility === 'circle' && teamup.isPublic) return false;
    return true;
  });

  const start = (query.page - 1) * query.limit;
  const pageRows = filtered.slice(start, start + query.limit);

  return {
    total: filtered.length,
    page: query.page,
    limit: query.limit,
    teamups: pageRows.map((teamup) => ({
      ...serializeListTeamup(teamup, leaders.get(teamup.leaderId)),
      effectiveStatus: 'ended' as const,
      viewerRole: memberByTeamupId.get(teamup.id),
      endedAt: teamup.endAt,
    })),
  };
}

export async function createTeamup(userId: string, circleId: string, input: CreateTeamupInput) {
  await ensureCircleActiveMember(userId, circleId);
  validateTimeWindow(input.deadlineAt, input.endAt);
  const contacts = normalizeContacts(input.contacts);
  const title = normalizeText(input.title, '标题', 60);
  const description = normalizeDescription(input.description);
  const teamupType = normalizeTeamupType(input.teamupType);
  if (input.maxMembers <= 1) throw new AppError(400, 'MAX_MEMBERS_TOO_SMALL', '人数上限必须大于 1');

  const [leaderRows, circleRows] = await Promise.all([
    db.select({ id: users.id, nickname: users.nickname, avatarUrl: users.avatarUrl }).from(users).where(eq(users.id, userId)).limit(1),
    db.select({ name: circles.name }).from(circles).where(eq(circles.id, circleId)).limit(1),
  ]);
  const leader = leaderRows[0];
  const sourceCircle = circleRows[0];
  if (!leader) throw new NotFoundError('用户不存在');

  const now = nowIso();
  const teamupId = uuid();
  const isPublic = TEAMUP_FORUM_SYNC_ENABLED && input.isPublic;
  const row = await db.transaction(async (tx) => {
    const teamupValues = {
      id: teamupId,
      circleId,
      leaderId: userId,
      title,
      description,
      descriptionPreview: buildDescriptionPreview(description),
      maxMembers: input.maxMembers,
      currentMemberCount: 1,
      deadlineAt: input.deadlineAt,
      endAt: input.endAt,
      teamupType,
      joinMode: input.joinMode,
      isPublic,
      status: 'recruiting',
      forumPostAuthorId: isPublic ? userId : null,
      forumSyncStatus: isPublic ? 'pending' : 'none',
      createdAt: now,
      updatedAt: now,
    };

    const inserted = await tx.insert(teamups).values(teamupValues).returning();
    await tx.insert(teamupMembers).values({
      id: uuid(),
      teamupId,
      userId,
      memberRole: 'leader',
      membershipStatus: 'active',
      joinedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    const memberContactId = uuid();
    const storedContacts = await replaceTeamupStoredContacts(tx, userId, 'teamup_member', memberContactId, contacts, now);
    await tx.insert(teamupMemberContacts).values({
      id: memberContactId,
      teamupId,
      userId,
      contacts: storedContacts,
      createdAt: now,
      updatedAt: now,
    });
    return inserted[0]!;
  });

  let returnedRow = row;
  if (TEAMUP_FORUM_SYNC_ENABLED && row.isPublic) {
    try {
      returnedRow = await createForumPostForTeamup(row, leader, sourceCircle);
    } catch (err) {
      returnedRow = await markForumPostSyncFailed(row, err);
    }
  }

  return {
    message: '组队已发布',
    teamup: serializeTeamup(returnedRow, leader),
  };
}

export async function getTeamupDetail(viewerId: string, circleId: string, teamupId: string) {
  await ensureCircleActiveMember(viewerId, circleId);
  const teamup = await getTeamupOrThrow(circleId, teamupId);
  const [leaders, viewerState, members] = await Promise.all([
    getLeaderMap([teamup.leaderId]),
    getViewerTeamupState(viewerId, [teamup.id]),
    getActiveMembers(teamup.id),
  ]);

  if (getEffectiveStatus(teamup) === 'ended' && !viewerState.members.get(teamup.id)) {
    throw new AppError(403, 'NOT_TEAMUP_MEMBER', '只能查看自己参与过的历史组队');
  }

  return {
    teamup: {
      ...serializeTeamup(
        teamup,
        leaders.get(teamup.leaderId),
        viewerState.members.get(teamup.id),
        viewerState.applications.get(teamup.id),
        viewerState.waitlistCounts.get(teamup.id) ?? 0,
      ),
      members,
    },
  };
}

export async function updateTeamup(userId: string, circleId: string, teamupId: string, input: UpdateTeamupInput) {
  await ensureCircleActiveMember(userId, circleId);
  const current = await getTeamupOrThrow(circleId, teamupId);
  if (current.leaderId !== userId) throw new AppError(403, 'NOT_TEAMUP_LEADER', '只有组长可以修改组队');
  if (current.status === 'cancelled') throw new AppError(409, 'TEAMUP_NOT_JOINABLE', '已取消组队不能修改');
  if (toTime(current.endAt) <= Date.now()) throw new AppError(409, 'TEAMUP_ENDED', '已结束组队不能修改');

  const deadlinePassed = toTime(current.deadlineAt) <= Date.now();
  const restrictedFields: Array<keyof UpdateTeamupInput> = ['deadlineAt', 'endAt', 'teamupType', 'joinMode', 'maxMembers', 'isPublic', 'contacts'];
  if (deadlinePassed && restrictedFields.some((field) => input[field] !== undefined)) {
    throw new AppError(409, 'DEADLINE_PASSED', '已截止组队不能修改招募设置');
  }

  const nextDeadlineAt = input.deadlineAt ?? current.deadlineAt;
  const nextEndAt = input.endAt ?? current.endAt;
  if (input.deadlineAt || input.endAt) validateTimeWindow(nextDeadlineAt, nextEndAt);
  if (input.maxMembers !== undefined && input.maxMembers < current.currentMemberCount) {
    throw new AppError(400, 'MAX_MEMBERS_TOO_SMALL', '人数上限不能小于当前成员数');
  }

  const title = input.title !== undefined ? normalizeText(input.title, '标题', 60) : current.title;
  const description = input.description !== undefined ? normalizeDescription(input.description) : current.description;
  const now = nowIso();
  const nextIsPublic = TEAMUP_FORUM_SYNC_ENABLED && (input.isPublic ?? current.isPublic);
  const nextMaxMembers = input.maxMembers ?? current.maxMembers;
  const nextTeamupType = input.teamupType !== undefined ? normalizeTeamupType(input.teamupType) : current.teamupType;
  const nextStatus = current.currentMemberCount >= nextMaxMembers ? 'full' : 'recruiting';

  const [leaderRows] = await Promise.all([
    db.select({ id: users.id, nickname: users.nickname, avatarUrl: users.avatarUrl }).from(users).where(eq(users.id, current.leaderId)).limit(1),
  ]);
  const leader = leaderRows[0];

  const updated = await db.transaction(async (tx) => {
    const rows = await tx.update(teamups)
      .set({
        title,
        description,
        descriptionPreview: buildDescriptionPreview(description),
        maxMembers: nextMaxMembers,
        deadlineAt: nextDeadlineAt,
        endAt: nextEndAt,
        teamupType: nextTeamupType,
        joinMode: input.joinMode ?? current.joinMode,
        isPublic: nextIsPublic,
        status: nextStatus,
        forumPostAuthorId: nextIsPublic ? current.leaderId : null,
        forumSyncStatus: nextIsPublic ? 'pending' : 'none',
        updatedAt: now,
      })
      .where(eq(teamups.id, teamupId))
      .returning();

    if (input.contacts) {
      const normalizedContacts = normalizeContacts(input.contacts);
      const existingContactRows = await tx.select({ id: teamupMemberContacts.id })
        .from(teamupMemberContacts)
        .where(and(
          eq(teamupMemberContacts.teamupId, teamupId),
          eq(teamupMemberContacts.userId, userId),
        ))
        .limit(1);
      const memberContactId = existingContactRows[0]?.id ?? uuid();
      const storedContacts = await replaceTeamupStoredContacts(tx, userId, 'teamup_member', memberContactId, normalizedContacts, now);

      await tx.insert(teamupMemberContacts).values({
        id: memberContactId,
        teamupId,
        userId,
        contacts: storedContacts,
        createdAt: now,
        updatedAt: now,
      }).onConflictDoUpdate({
        target: [teamupMemberContacts.teamupId, teamupMemberContacts.userId],
        set: {
          contacts: storedContacts,
          updatedAt: now,
        },
      });
    }

    if (TEAMUP_FORUM_SYNC_ENABLED && nextIsPublic) {
      await queueForumSyncJob(tx, rows[0]!, 'update', leader);
    }

    return rows[0]!;
  });

  const returnedUpdated = TEAMUP_FORUM_SYNC_ENABLED && current.isPublic && !nextIsPublic
    ? await deleteForumPostForTeamup(updated)
    : updated;

  return {
    message: '组队已更新',
    teamupId,
    forumSyncStatus: returnedUpdated.forumSyncStatus,
  };
}

export async function joinTeamupDirect(userId: string, circleId: string, teamupId: string, contactsInput: TeamupContactInput[]) {
  await ensureCircleActiveMember(userId, circleId);
  const contacts = normalizeContacts(contactsInput);
  const current = await getTeamupOrThrow(circleId, teamupId);
  if (current.joinMode !== 'direct') throw new AppError(409, 'JOIN_MODE_MISMATCH', '当前组队不是直接加入模式');
  if (await areUsersBlocked(userId, current.leaderId)) {
    throw new AppError(403, 'USER_BLOCKED', '当前无法加入该组队');
  }
  const canWaitlist = !isJoinable(current) && isWaitlistable(current);
  if (!isJoinable(current) && !canWaitlist) {
    throw new AppError(current.currentMemberCount >= current.maxMembers ? 409 : 400, current.currentMemberCount >= current.maxMembers ? 'TEAMUP_FULL' : 'TEAMUP_NOT_JOINABLE', '组队当前不可加入');
  }

  let waitlistCard: { isFriend: boolean; snapshot: unknown } | null = null;
  if (canWaitlist) {
    const isFriend = await areUsersCircleFriends(userId, current.leaderId, circleId);
    waitlistCard = {
      isFriend,
      snapshot: isFriend
        ? await getFriendCard(current.leaderId, userId, circleId)
        : await getPublicCard(current.leaderId, userId, circleId),
    };
  }
  const now = nowIso();
  const result = await db.transaction(async (tx) => {
    const lockedTeamup = await lockTeamupForUpdate(tx, circleId, teamupId);
    if (lockedTeamup.joinMode !== 'direct') throw new AppError(409, 'JOIN_MODE_MISMATCH', '当前组队不是直接加入模式');
    if (await areUsersBlocked(userId, lockedTeamup.leaderId, tx)) {
      throw new AppError(403, 'USER_BLOCKED', '当前无法加入该组队');
    }
    if (!isJoinable(lockedTeamup)) {
      if (!isWaitlistable(lockedTeamup)) {
        throw new AppError(lockedTeamup.currentMemberCount >= lockedTeamup.maxMembers ? 409 : 400, lockedTeamup.currentMemberCount >= lockedTeamup.maxMembers ? 'TEAMUP_FULL' : 'TEAMUP_NOT_JOINABLE', '组队当前不可加入');
      }

      const existingMember = await tx.select({ id: teamupMembers.id }).from(teamupMembers)
        .where(and(
          eq(teamupMembers.teamupId, teamupId),
          eq(teamupMembers.userId, userId),
          eq(teamupMembers.membershipStatus, 'active'),
        ))
        .limit(1);
      if (existingMember[0]) throw new AppError(409, 'ALREADY_TEAMUP_MEMBER', '你已加入该组队');

      await assertNoActiveTeamupApplication(tx, teamupId, userId);
      await assertWaitlistRejectionLimit(tx, teamupId, userId, now);
      const waitlistCount = await assertWaitlistCapacity(tx, teamupId, lockedTeamup.maxMembers);
      await assertNoBlockedActiveTeamupMember(userId, teamupId, tx);

      const applicationId = uuid();
      const snapshotIsFriend = waitlistCard?.isFriend ?? await areUsersCircleFriends(userId, lockedTeamup.leaderId, circleId);
      const cardSnapshot = waitlistCard?.snapshot ?? (
        snapshotIsFriend
          ? await getFriendCard(lockedTeamup.leaderId, userId, circleId)
          : await getPublicCard(lockedTeamup.leaderId, userId, circleId)
      );
      const storedContacts = await replaceTeamupStoredContacts(tx, userId, 'teamup_application', applicationId, contacts, now);
      await tx.insert(teamupApplications).values({
        id: applicationId,
        teamupId,
        applicantId: userId,
        applicationType: 'waitlist',
        applicationNote: DIRECT_WAITLIST_NOTE,
        cardSnapshot: cardSnapshot as unknown as Record<string, unknown>,
        cardSnapshotView: snapshotIsFriend ? 'friend' : 'public',
        cardSnapshotRelationship: snapshotIsFriend ? 'friend' : 'not_friend',
        contactPayload: storedContacts,
        status: 'approved',
        reviewedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      return {
        kind: 'waitlisted' as const,
        teamup: lockedTeamup,
        applicationId,
        waitlistPosition: waitlistCount + 1,
      };
    }

    await assertNoActiveTeamupApplication(tx, teamupId, userId);
    await assertNoBlockedActiveTeamupMember(userId, teamupId, tx);
    await activateTeamupMember(tx, teamupId, userId, now);

    const rows = await tx.update(teamups)
      .set({
        currentMemberCount: sql`${teamups.currentMemberCount} + 1`,
        status: sql`CASE WHEN ${teamups.currentMemberCount} + 1 >= ${teamups.maxMembers} THEN 'full' ELSE 'recruiting' END`,
        forumSyncStatus: TEAMUP_FORUM_SYNC_ENABLED && lockedTeamup.isPublic ? 'pending' : lockedTeamup.forumSyncStatus,
        updatedAt: now,
      })
      .where(eq(teamups.id, teamupId))
      .returning();

    const existingContactRows = await tx.select({ id: teamupMemberContacts.id })
      .from(teamupMemberContacts)
      .where(and(
        eq(teamupMemberContacts.teamupId, teamupId),
        eq(teamupMemberContacts.userId, userId),
      ))
      .limit(1);
    const memberContactId = existingContactRows[0]?.id ?? uuid();
    const storedContacts = await replaceTeamupStoredContacts(tx, userId, 'teamup_member', memberContactId, contacts, now);
    await tx.insert(teamupMemberContacts).values({
      id: memberContactId,
      teamupId,
      userId,
      contacts: storedContacts,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: [teamupMemberContacts.teamupId, teamupMemberContacts.userId],
      set: { contacts: storedContacts, updatedAt: now },
    });

    await createUserNotification({
      recipientId: lockedTeamup.leaderId,
      actorId: userId,
      type: 'teamup_member_joined',
      title: '有新成员加入组队',
      content: `有人已加入你的组队「${lockedTeamup.title}」`,
      meta: {
        circleId,
        teamupId,
        memberId: userId,
        actionUrl: `/circles/${circleId}/teamups/${teamupId}`,
      },
    }, tx);

    if (TEAMUP_FORUM_SYNC_ENABLED && lockedTeamup.isPublic) await queueForumSyncJob(tx, rows[0]!, 'update');
    return {
      kind: 'joined' as const,
      teamup: rows[0]!,
    };
  });

  if (result.kind === 'waitlisted') {
    return {
      message: '候补已登记',
      teamupId,
      application: {
        id: result.applicationId,
        teamupId,
        applicantId: userId,
        status: 'approved',
        applicationType: 'waitlist',
        waitlistPosition: result.waitlistPosition,
        createdAt: now,
      },
      currentMemberCount: result.teamup.currentMemberCount,
      status: result.teamup.status,
    };
  }

  return {
    message: '已加入组队',
    teamupId,
    member: {
      userId,
      memberRole: 'member' as const,
      joinedAt: now,
    },
    currentMemberCount: result.teamup.currentMemberCount,
    status: result.teamup.status,
  };
}

export async function applyToTeamup(
  userId: string,
  circleId: string,
  teamupId: string,
  applicationNote: string,
  contactsInput: TeamupContactInput[],
) {
  await ensureCircleActiveMember(userId, circleId);
  const contacts = normalizeContacts(contactsInput);
  const note = normalizeText(applicationNote, '申请说明', 300);
  const teamup = await getTeamupOrThrow(circleId, teamupId);
  if (teamup.joinMode !== 'approval') throw new AppError(409, 'JOIN_MODE_MISMATCH', '当前组队不是审核加入模式');
  const canWaitlist = !isJoinable(teamup) && isWaitlistable(teamup);
  if (!isJoinable(teamup) && !canWaitlist) throw new AppError(409, 'TEAMUP_NOT_JOINABLE', '组队当前不可申请');
  if (await areUsersBlocked(userId, teamup.leaderId)) {
    throw new AppError(403, 'USER_BLOCKED', '当前无法申请该组队');
  }

  const [existingMember, activeApplication] = await Promise.all([
    db.select({ id: teamupMembers.id }).from(teamupMembers)
      .where(and(eq(teamupMembers.teamupId, teamupId), eq(teamupMembers.userId, userId), eq(teamupMembers.membershipStatus, 'active')))
      .limit(1),
    getActiveTeamupApplication(db, teamupId, userId),
  ]);
  if (existingMember[0]) throw new AppError(409, 'ALREADY_TEAMUP_MEMBER', '你已加入该组队');
  if (activeApplication) {
    if (activeApplication.applicationType === 'waitlist') throw new AppError(409, 'WAITLIST_APPLICATION_EXISTS', '你已在该组队候补队列中');
    throw new AppError(409, 'PENDING_APPLICATION_EXISTS', '已存在待审核申请');
  }
  await assertNoBlockedActiveTeamupMember(userId, teamupId);

  const isFriend = await areUsersCircleFriends(userId, teamup.leaderId, circleId);
  const cardSnapshot = isFriend
    ? await getFriendCard(teamup.leaderId, userId, circleId)
    : await getPublicCard(teamup.leaderId, userId, circleId);

  const now = nowIso();
  const applicationId = uuid();

  const result = await db.transaction(async (tx) => {
    const lockedTeamup = await lockTeamupForUpdate(tx, circleId, teamupId);
    if (lockedTeamup.joinMode !== 'approval') throw new AppError(409, 'JOIN_MODE_MISMATCH', '当前组队不是审核加入模式');
    if (await areUsersBlocked(userId, lockedTeamup.leaderId, tx)) {
      throw new AppError(403, 'USER_BLOCKED', '当前无法申请该组队');
    }

    const shouldWaitlist = !isJoinable(lockedTeamup);
    if (shouldWaitlist && !isWaitlistable(lockedTeamup)) {
      throw new AppError(409, 'TEAMUP_NOT_JOINABLE', '组队当前不可申请');
    }

    const activeMember = await tx.select({ id: teamupMembers.id }).from(teamupMembers)
      .where(and(
        eq(teamupMembers.teamupId, teamupId),
        eq(teamupMembers.userId, userId),
        eq(teamupMembers.membershipStatus, 'active'),
      ))
      .limit(1);
    if (activeMember[0]) throw new AppError(409, 'ALREADY_TEAMUP_MEMBER', '你已加入该组队');
    await assertNoActiveTeamupApplication(tx, teamupId, userId);
    await assertNoBlockedActiveTeamupMember(userId, teamupId, tx);

    let waitlistPosition: number | null = null;
    if (shouldWaitlist) {
      await assertWaitlistRejectionLimit(tx, teamupId, userId, now);
      const waitlistCount = await assertWaitlistCapacity(tx, teamupId, lockedTeamup.maxMembers);
      waitlistPosition = waitlistCount + 1;
    }

    const storedContacts = await replaceTeamupStoredContacts(tx, userId, 'teamup_application', applicationId, contacts, now);
    await tx.insert(teamupApplications).values({
      id: applicationId,
      teamupId,
      applicantId: userId,
      applicationType: shouldWaitlist ? 'waitlist' : 'join',
      applicationNote: note,
      cardSnapshot: cardSnapshot as unknown as Record<string, unknown>,
      cardSnapshotView: isFriend ? 'friend' : 'public',
      cardSnapshotRelationship: isFriend ? 'friend' : 'not_friend',
      contactPayload: storedContacts,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });

    await createUserNotification({
      recipientId: lockedTeamup.leaderId,
      actorId: userId,
      type: 'teamup_application_received',
      title: shouldWaitlist ? '新的候补申请' : '新的组队申请',
      content: shouldWaitlist
        ? `你的组队「${lockedTeamup.title}」收到新的候补申请`
        : `你的组队「${lockedTeamup.title}」收到新的加入申请`,
      meta: {
        circleId,
        teamupId,
        applicationId,
        applicantId: userId,
        applicationType: shouldWaitlist ? 'waitlist' : 'join',
        actionUrl: `/circles/${circleId}/teamups/${teamupId}`,
      },
    }, tx);

    return {
      applicationType: shouldWaitlist ? 'waitlist' as const : 'join' as const,
      waitlistPosition,
    };
  });

  return {
    message: result.applicationType === 'waitlist' ? '候补申请已提交' : '加入申请已提交',
    application: {
      id: applicationId,
      teamupId,
      applicantId: userId,
      status: 'pending',
      applicationType: result.applicationType,
      waitlistPosition: result.waitlistPosition,
      cardSnapshotView: isFriend ? 'friend' : 'public',
      createdAt: now,
    },
  };
}

export async function listTeamupApplications(
  userId: string,
  circleId: string,
  teamupId: string,
  query: { status?: string; page: number; limit: number },
) {
  await ensureCircleActiveMember(userId, circleId);
  const teamup = await getTeamupOrThrow(circleId, teamupId);
  if (teamup.leaderId !== userId) throw new AppError(403, 'NOT_TEAMUP_LEADER', '只有组长可以查看申请');

  const rows = await db.select({
    id: teamupApplications.id,
    teamupId: teamupApplications.teamupId,
    applicantId: teamupApplications.applicantId,
    applicationType: teamupApplications.applicationType,
    applicationNote: teamupApplications.applicationNote,
    cardSnapshot: teamupApplications.cardSnapshot,
    cardSnapshotView: teamupApplications.cardSnapshotView,
    cardSnapshotRelationship: teamupApplications.cardSnapshotRelationship,
    status: teamupApplications.status,
    waitlistJoinedAt: teamupApplications.waitlistJoinedAt,
    createdAt: teamupApplications.createdAt,
    nickname: users.nickname,
    avatarUrl: users.avatarUrl,
  }).from(teamupApplications)
    .innerJoin(users, eq(teamupApplications.applicantId, users.id))
    .where(eq(teamupApplications.teamupId, teamupId))
    .orderBy(asc(teamupApplications.createdAt), asc(teamupApplications.id));

  const filtered = rows.filter((row) => !query.status || query.status === 'all' || row.status === query.status);
  const activeWaitlistRows = rows.filter((row) => (
    row.applicationType === 'waitlist'
    && (row.status === 'pending' || row.status === 'approved')
    && !row.waitlistJoinedAt
  ));
  const waitlistPositions = new Map(activeWaitlistRows.map((row, index) => [row.id, index + 1]));
  const start = (query.page - 1) * query.limit;

  return {
    total: filtered.length,
    page: query.page,
    limit: query.limit,
    applications: filtered.slice(start, start + query.limit).map((row) => {
      const parsedSnapshot = parseStoredCardSnapshot(
        row.cardSnapshot as Record<string, unknown> | Array<Record<string, unknown>> | null,
        {
          previewMode: row.cardSnapshotView === 'friend' ? 'friend' : 'public',
          nickname: row.nickname,
          avatarUrl: row.avatarUrl,
          circleId,
        },
      );

      return {
        id: row.id,
        teamupId: row.teamupId,
        applicant: {
          userId: row.applicantId,
          nickname: row.nickname,
          avatarUrl: row.avatarUrl,
        },
        applicationNote: row.applicationNote,
        applicationType: row.applicationType,
        waitlistPosition: waitlistPositions.get(row.id) ?? null,
        cardSnapshot: {
          ...(parsedSnapshot ?? {
            previewMode: row.cardSnapshotView === 'friend' ? 'friend' : 'public',
            nickname: row.nickname,
            avatarUrl: row.avatarUrl,
            baseModules: [],
            circleCards: [],
          }),
          view: row.cardSnapshotView,
          relationship: row.cardSnapshotRelationship,
        },
        status: row.status,
        waitlistJoinedAt: row.waitlistJoinedAt,
        createdAt: row.createdAt,
      };
    }),
  };
}

export async function listMyTeamupApplicationReplies(
  userId: string,
  query: { page: number; limit: number },
) {
  const rows = await db.select({
    id: teamupApplications.id,
    teamupId: teamupApplications.teamupId,
    status: teamupApplications.status,
    applicationType: teamupApplications.applicationType,
    reviewNote: teamupApplications.reviewNote,
    reviewedAt: teamupApplications.reviewedAt,
    waitlistJoinedAt: teamupApplications.waitlistJoinedAt,
    createdAt: teamupApplications.createdAt,
    updatedAt: teamupApplications.updatedAt,
    circleId: teamups.circleId,
    teamupTitle: teamups.title,
    circleName: circles.name,
    leaderId: teamups.leaderId,
    leaderNickname: users.nickname,
    leaderAvatarUrl: users.avatarUrl,
  }).from(teamupApplications)
    .innerJoin(teamups, eq(teamupApplications.teamupId, teamups.id))
    .innerJoin(circles, eq(teamups.circleId, circles.id))
    .innerJoin(users, eq(teamups.leaderId, users.id))
    .where(and(
      eq(teamupApplications.applicantId, userId),
      eq(teamups.joinMode, 'approval'),
      inArray(teamupApplications.status, ['approved', 'rejected']),
    ))
    .orderBy(desc(teamupApplications.updatedAt));

  const start = (query.page - 1) * query.limit;

  return {
    total: rows.length,
    page: query.page,
    limit: query.limit,
    replies: rows.slice(start, start + query.limit).map((row) => ({
      id: row.id,
      teamupId: row.teamupId,
      circleId: row.circleId,
      circleName: row.circleName,
      teamupTitle: row.teamupTitle,
      leader: {
        userId: row.leaderId,
        nickname: row.leaderNickname,
        avatarUrl: row.leaderAvatarUrl,
      },
      status: row.status,
      applicationType: row.applicationType,
      waitlistJoinedAt: row.waitlistJoinedAt,
      reviewNote: row.reviewNote,
      createdAt: row.createdAt,
      respondedAt: row.reviewedAt ?? row.updatedAt,
    })),
  };
}

export async function reviewTeamupApplication(
  reviewerId: string,
  circleId: string,
  teamupId: string,
  applicationId: string,
  action: TeamupApplicationAction,
  reviewNote?: string,
) {
  await ensureCircleActiveMember(reviewerId, circleId);
  const teamup = await getTeamupOrThrow(circleId, teamupId);
  if (teamup.leaderId !== reviewerId) throw new AppError(403, 'NOT_TEAMUP_LEADER', '只有组长可以审核申请');

  const now = nowIso();
  if (action === 'reject') {
    const rejectedApplication = await db.transaction(async (tx) => {
      const rejected = await tx.update(teamupApplications)
        .set({
          status: 'rejected',
          reviewedBy: reviewerId,
          reviewNote: reviewNote?.trim() || null,
          reviewedAt: now,
          updatedAt: now,
        })
        .where(and(
          eq(teamupApplications.id, applicationId),
          eq(teamupApplications.teamupId, teamupId),
          eq(teamupApplications.status, 'pending'),
        ))
        .returning({
          id: teamupApplications.id,
          applicantId: teamupApplications.applicantId,
          applicationType: teamupApplications.applicationType,
        });
      if (!rejected[0]) await throwApplicationStateError(tx, teamupId, applicationId);

      await tx.insert(auditLogs).values({
        operatorId: reviewerId,
        action: 'teamup_application_rejected',
        target: teamupId,
        detail: JSON.stringify({ circleId, applicationId }),
        createdAt: now,
      });

      await createUserNotification({
        recipientId: rejected[0].applicantId,
        actorId: reviewerId,
        type: 'teamup_application_rejected',
        title: rejected[0].applicationType === 'waitlist' ? '候补申请未通过' : '组队申请未通过',
        content: rejected[0].applicationType === 'waitlist'
          ? `你候补「${teamup.title}」的申请未通过`
          : `你加入「${teamup.title}」的申请未通过`,
        meta: {
          circleId,
          teamupId,
          applicationId,
          applicationType: rejected[0].applicationType,
          actionUrl: `/circles/${circleId}/teamups/${teamupId}`,
        },
      }, tx);

      return rejected[0];
    });

    return {
      message: '申请已拒绝',
      applicationId,
      teamupId,
      status: 'rejected',
      applicationType: rejectedApplication.applicationType,
      currentMemberCount: teamup.currentMemberCount,
      teamupStatus: teamup.status,
    };
  }

  const result = await db.transaction(async (tx) => {
    const lockedTeamup = await lockTeamupForUpdate(tx, circleId, teamupId);
    if (lockedTeamup.leaderId !== reviewerId) throw new AppError(403, 'NOT_TEAMUP_LEADER', '只有组长可以审核申请');

    const approvedApplications = await tx.update(teamupApplications)
      .set({
        status: 'approved',
        reviewedBy: reviewerId,
        reviewNote: reviewNote?.trim() || null,
        reviewedAt: now,
        updatedAt: now,
      })
      .where(and(
        eq(teamupApplications.id, applicationId),
        eq(teamupApplications.teamupId, teamupId),
        eq(teamupApplications.status, 'pending'),
      ))
      .returning();
    let application = approvedApplications[0];
    if (!application) await throwApplicationStateError(tx, teamupId, applicationId);
    if (await areUsersBlocked(reviewerId, application.applicantId, tx)) {
      throw new AppError(403, 'USER_BLOCKED', '当前无法通过该申请');
    }
    await assertNoBlockedActiveTeamupMember(application.applicantId, teamupId, tx);

    await ensureCircleActiveMember(application.applicantId, circleId, tx);
    const shouldQueueAsWaitlist = application.applicationType === 'waitlist'
      || lockedTeamup.currentMemberCount >= lockedTeamup.maxMembers;

    if (shouldQueueAsWaitlist) {
      if (!isOngoingTeamup(lockedTeamup)) {
        throw new AppError(409, 'TEAMUP_NOT_JOINABLE', '组队当前不可加入');
      }

      if (application.applicationType !== 'waitlist') {
        await assertWaitlistCapacity(tx, teamupId, lockedTeamup.maxMembers);
        const waitlistApplications = await tx.update(teamupApplications)
          .set({
            applicationType: 'waitlist',
            updatedAt: now,
          })
          .where(eq(teamupApplications.id, application.id))
          .returning();
        application = waitlistApplications[0]!;
      }

      await tx.insert(auditLogs).values({
        operatorId: reviewerId,
        action: 'teamup_application_approved',
        target: teamupId,
        detail: JSON.stringify({
          circleId,
          applicationId,
          applicantId: application.applicantId,
          applicationType: 'waitlist',
        }),
        createdAt: now,
      });

      const promotionResult = await promoteWaitlistCandidates(tx, lockedTeamup, circleId, now);
      const promotedSelf = promotionResult.promotions.some((promotion) => promotion.applicationId === application.id);

      if (!promotedSelf) {
        await createUserNotification({
          recipientId: application.applicantId,
          actorId: reviewerId,
          type: 'teamup_application_approved',
          title: '候补申请已通过',
          content: `你候补「${lockedTeamup.title}」的申请已通过，正在等待空位`,
          meta: {
            circleId,
            teamupId,
            applicationId,
            applicationType: 'waitlist',
            actionUrl: `/circles/${circleId}/teamups/${teamupId}`,
          },
        }, tx);
      }

      return {
        teamup: promotionResult.teamup,
        applicationType: 'waitlist' as const,
        promotedSelf,
      };
    }

    if (!isJoinable(lockedTeamup)) throw new AppError(409, 'TEAMUP_NOT_JOINABLE', '组队当前不可加入');
    await activateTeamupMember(tx, teamupId, application.applicantId, now);

    const updatedTeamups = await tx.update(teamups)
      .set({
        currentMemberCount: sql`${teamups.currentMemberCount} + 1`,
        status: sql`CASE WHEN ${teamups.currentMemberCount} + 1 >= ${teamups.maxMembers} THEN 'full' ELSE 'recruiting' END`,
        forumSyncStatus: TEAMUP_FORUM_SYNC_ENABLED && lockedTeamup.isPublic ? 'pending' : lockedTeamup.forumSyncStatus,
        updatedAt: now,
      })
      .where(eq(teamups.id, teamupId))
      .returning();

    const existingContactRows = await tx.select({ id: teamupMemberContacts.id })
      .from(teamupMemberContacts)
      .where(and(
        eq(teamupMemberContacts.teamupId, teamupId),
        eq(teamupMemberContacts.userId, application.applicantId),
      ))
      .limit(1);
    const memberContactId = existingContactRows[0]?.id ?? uuid();
    const storedContacts = await cloneTeamupStoredContacts(
      tx,
      application.applicantId,
      application.contactPayload as StoredTeamupContact[],
      {
        ownerUserId: application.applicantId,
        scopeType: 'teamup_application',
        scopeId: application.id,
      },
      'teamup_member',
      memberContactId,
      now,
    );

    await tx.insert(teamupMemberContacts).values({
      id: memberContactId,
      teamupId,
      userId: application.applicantId,
      contacts: storedContacts,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: [teamupMemberContacts.teamupId, teamupMemberContacts.userId],
      set: { contacts: storedContacts, updatedAt: now },
    });

    await tx.insert(auditLogs).values({
      operatorId: reviewerId,
      action: 'teamup_application_approved',
      target: teamupId,
      detail: JSON.stringify({
        circleId,
        applicationId,
        applicantId: application.applicantId,
        applicationType: 'join',
      }),
      createdAt: now,
    });

    await createUserNotification({
      recipientId: application.applicantId,
      actorId: reviewerId,
      type: 'teamup_application_approved',
      title: '组队申请已通过',
      content: `你加入「${lockedTeamup.title}」的申请已通过`,
      meta: {
        circleId,
        teamupId,
        applicationId,
        applicationType: 'join',
        actionUrl: `/circles/${circleId}/teamups/${teamupId}`,
      },
    }, tx);

    if (TEAMUP_FORUM_SYNC_ENABLED && lockedTeamup.isPublic) await queueForumSyncJob(tx, updatedTeamups[0]!, 'update');
    return {
      teamup: updatedTeamups[0]!,
      applicationType: 'join' as const,
      promotedSelf: true,
    };
  });

  return {
    message: result.applicationType === 'waitlist'
      ? (result.promotedSelf ? '候补申请已通过并补位' : '候补申请已通过')
      : '申请已通过',
    applicationId,
    teamupId,
    status: 'approved',
    applicationType: result.applicationType,
    promoted: result.promotedSelf,
    currentMemberCount: result.teamup.currentMemberCount,
    teamupStatus: result.teamup.status,
  };
}

export async function withdrawTeamupApplication(
  userId: string,
  circleId: string,
  teamupId: string,
  applicationId: string,
) {
  await ensureCircleActiveMember(userId, circleId);
  const teamup = await getTeamupOrThrow(circleId, teamupId);

  const now = nowIso();
  return db.transaction(async (tx) => {
    await tx.execute(sql`
      SELECT id
      FROM teamup_applications
      WHERE id = ${applicationId}
        AND teamup_id = ${teamupId}
      FOR UPDATE
    `);

    const rows = await tx.select().from(teamupApplications)
      .where(and(eq(teamupApplications.id, applicationId), eq(teamupApplications.teamupId, teamupId)))
      .limit(1);
    const application = rows[0];
    if (!application) throw new NotFoundError('组队申请不存在');
    if (application.applicantId !== userId) {
      throw new AppError(403, 'NOT_TEAMUP_APPLICANT', '只能撤回自己发出的组队申请');
    }

    const canWithdrawPending = application.status === 'pending';
    const canWithdrawWaitlist = application.applicationType === 'waitlist'
      && application.status === 'approved'
      && !application.waitlistJoinedAt;
    if (!canWithdrawPending && !canWithdrawWaitlist) {
      throw new AppError(409, 'TEAMUP_APPLICATION_NOT_WITHDRAWABLE', '该组队申请当前无法撤回');
    }

    await deleteG2ContactSecretsForScope(tx, userId, 'teamup_application', applicationId);

    const updated = await tx.update(teamupApplications)
      .set({
        status: 'withdrawn',
        reviewNote: '申请人主动撤回',
        contactPayload: [],
        updatedAt: now,
      })
      .where(eq(teamupApplications.id, applicationId))
      .returning({
        id: teamupApplications.id,
        applicationType: teamupApplications.applicationType,
        status: teamupApplications.status,
      });

    await tx.insert(auditLogs).values({
      operatorId: userId,
      action: 'teamup_application_withdrawn',
      target: teamupId,
      detail: JSON.stringify({
        circleId,
        applicationId,
        applicationType: application.applicationType,
      }),
      createdAt: now,
    });

    if (teamup.leaderId !== userId) {
      await createUserNotification({
        recipientId: teamup.leaderId,
        actorId: userId,
        type: 'teamup_application_withdrawn',
        title: application.applicationType === 'waitlist' ? '候补申请已撤回' : '组队申请已撤回',
        content: application.applicationType === 'waitlist'
          ? `有人撤回了候补「${teamup.title}」的申请`
          : `有人撤回了加入「${teamup.title}」的申请`,
        meta: {
          circleId,
          teamupId,
          applicationId,
          applicationType: application.applicationType,
          actionUrl: `/circles/${circleId}/teamups/${teamupId}`,
        },
      }, tx);
    }

    return {
      message: application.applicationType === 'waitlist' ? '候补申请已撤回' : '组队申请已撤回',
      applicationId,
      teamupId,
      status: 'withdrawn' as const,
      applicationType: updated[0]?.applicationType ?? application.applicationType,
    };
  });
}

export async function leaveTeamup(userId: string, circleId: string, teamupId: string) {
  await ensureCircleActiveMember(userId, circleId);

  const now = nowIso();
  const updated = await db.transaction(async (tx) => {
    const lockedTeamup = await lockTeamupForUpdate(tx, circleId, teamupId);

    const leftMembers = await tx.update(teamupMembers)
      .set({ membershipStatus: 'left', leftAt: now, updatedAt: now })
      .where(and(
        eq(teamupMembers.teamupId, teamupId),
        eq(teamupMembers.userId, userId),
        eq(teamupMembers.membershipStatus, 'active'),
        sql`${teamupMembers.memberRole} <> 'leader'`,
      ))
      .returning({ id: teamupMembers.id });
    if (!leftMembers[0]) {
      const members = await tx.select({
        memberRole: teamupMembers.memberRole,
        membershipStatus: teamupMembers.membershipStatus,
      }).from(teamupMembers)
        .where(and(eq(teamupMembers.teamupId, teamupId), eq(teamupMembers.userId, userId)))
        .limit(1);
      if (members[0]?.membershipStatus === 'active' && members[0].memberRole === 'leader') {
        throw new AppError(409, 'LEADER_LEAVE_REQUIRES_CANCEL', '组长退出需要取消组队');
      }
      throw new AppError(404, 'NOT_TEAMUP_MEMBER', '你不是该组队成员');
    }

    const rows = await tx.update(teamups)
      .set({
        currentMemberCount: sql`GREATEST(${teamups.currentMemberCount} - 1, 0)`,
        status: sql`CASE WHEN ${teamups.status} = 'full' AND ${teamups.deadlineAt} > ${now} AND ${teamups.endAt} > ${now} THEN 'recruiting' ELSE ${teamups.status} END`,
        forumSyncStatus: TEAMUP_FORUM_SYNC_ENABLED && lockedTeamup.isPublic ? 'pending' : lockedTeamup.forumSyncStatus,
        updatedAt: now,
      })
      .where(eq(teamups.id, teamupId))
      .returning();

    const promotionResult = await promoteWaitlistCandidates(tx, rows[0]!, circleId, now);
    if (TEAMUP_FORUM_SYNC_ENABLED && lockedTeamup.isPublic && promotionResult.promotions.length === 0) {
      await queueForumSyncJob(tx, promotionResult.teamup, 'update');
    }
    return promotionResult.teamup;
  });

  return {
    message: '已退出组队',
    teamupId,
    currentMemberCount: updated.currentMemberCount,
    status: updated.status,
  };
}

export async function cancelTeamup(
  userId: string,
  circleId: string,
  teamupId: string,
  input: { reason?: string; cancelSource: TeamupCancelSource; confirmCancel: boolean },
) {
  await ensureCircleActiveMember(userId, circleId);
  if (!input.confirmCancel) throw new ValidationError('confirmCancel 必须为 true');
  const teamup = await getTeamupOrThrow(circleId, teamupId);
  if (teamup.status === 'cancelled') throw new AppError(409, 'TEAMUP_NOT_JOINABLE', '组队已取消');
  if (toTime(teamup.endAt) <= Date.now()) throw new AppError(409, 'TEAMUP_ENDED', '已结束组队不能取消');

  const isLeader = teamup.leaderId === userId;
  if (input.cancelSource === 'leader' && !isLeader) {
    throw new AppError(403, 'NOT_TEAMUP_LEADER', '只有组长可以取消组队');
  }
  if (input.cancelSource === 'admin') {
    await ensureCanAdminCancel(userId, circleId);
  }

  const now = nowIso();
  const cancelled = await db.transaction(async (tx) => {
    const activeMemberRows = await tx.select({
      userId: teamupMembers.userId,
    }).from(teamupMembers)
      .where(and(
        eq(teamupMembers.teamupId, teamupId),
        eq(teamupMembers.membershipStatus, 'active'),
      ));

    const rows = await tx.update(teamups)
      .set({
        status: 'cancelled',
        cancelSource: input.cancelSource,
        cancelReason: input.reason?.trim() || null,
        cancelledBy: userId,
        cancelledAt: now,
        forumSyncStatus: TEAMUP_FORUM_SYNC_ENABLED && teamup.isPublic ? 'pending' : teamup.forumSyncStatus,
        updatedAt: now,
      })
      .where(eq(teamups.id, teamupId))
      .returning();

    await tx.update(teamupMembers)
      .set({ membershipStatus: 'cancelled', updatedAt: now })
      .where(and(eq(teamupMembers.teamupId, teamupId), eq(teamupMembers.membershipStatus, 'active')));

    if (input.cancelSource === 'admin') {
      await tx.insert(auditLogs).values({
        operatorId: userId,
        action: 'teamup_cancel_admin',
        target: teamupId,
        detail: JSON.stringify({ circleId, reason: input.reason ?? null }),
        result: 'success',
        createdAt: now,
      });
    }

    await createUserNotifications(activeMemberRows.map((member) => ({
      recipientId: member.userId,
      actorId: userId,
      type: 'teamup_cancelled',
      title: '组队已取消',
      content: `组队「${teamup.title}」已取消`,
      meta: {
        circleId,
        teamupId,
        cancelSource: input.cancelSource,
        actionUrl: `/circles/${circleId}/teamups/${teamupId}`,
      },
    })), tx);

    return rows[0]!;
  });

  const returnedCancelled = TEAMUP_FORUM_SYNC_ENABLED ? await deleteForumPostForTeamup(cancelled) : cancelled;

  return {
    message: '组队已取消',
    teamupId,
    status: returnedCancelled.status,
    cancelledBy: userId,
    cancelSource: input.cancelSource,
  };
}

export async function getTeamupContacts(viewerId: string, circleId: string, teamupId: string) {
  await ensureCircleActiveMember(viewerId, circleId);
  const teamup = await getTeamupOrThrow(circleId, teamupId);
  if (teamup.status === 'cancelled') throw new AppError(409, 'TEAMUP_NOT_JOINABLE', '已取消组队不公开联系方式');
  const now = Date.now();
  if (toTime(teamup.deadlineAt) > now) throw new AppError(409, 'CONTACTS_NOT_AVAILABLE', '联系方式尚不可查看');
  if (toTime(teamup.endAt) <= now) throw new AppError(409, 'TEAMUP_ENDED', '组队已结束，联系方式不再展示');

  const viewerMember = await db.select({ id: teamupMembers.id }).from(teamupMembers)
    .where(and(eq(teamupMembers.teamupId, teamupId), eq(teamupMembers.userId, viewerId), eq(teamupMembers.membershipStatus, 'active')))
    .limit(1);
  if (!viewerMember[0]) throw new AppError(403, 'NOT_TEAMUP_MEMBER', '只有已加入成员可以查看联系方式');

  const rows = await db.select({
    contactRowId: teamupMemberContacts.id,
    userId: teamupMembers.userId,
    memberRole: teamupMembers.memberRole,
    nickname: users.nickname,
    avatarUrl: users.avatarUrl,
    contacts: teamupMemberContacts.contacts,
  }).from(teamupMembers)
    .innerJoin(users, eq(teamupMembers.userId, users.id))
    .innerJoin(teamupMemberContacts, and(
      eq(teamupMemberContacts.teamupId, teamupMembers.teamupId),
      eq(teamupMemberContacts.userId, teamupMembers.userId),
    ))
    .where(and(eq(teamupMembers.teamupId, teamupId), eq(teamupMembers.membershipStatus, 'active')));

  const peerIds = rows.map((row) => row.userId).filter((memberUserId) => memberUserId !== viewerId);
  const blockRows = peerIds.length > 0
    ? await db.select({
        blockerId: userBlocks.blockerId,
        blockedId: userBlocks.blockedId,
      }).from(userBlocks)
        .where(or(
          and(eq(userBlocks.blockerId, viewerId), inArray(userBlocks.blockedId, peerIds)),
          and(eq(userBlocks.blockedId, viewerId), inArray(userBlocks.blockerId, peerIds)),
        ))
    : [];
  const blockedPeerIds = new Set(blockRows.map((row) => (
    row.blockerId === viewerId ? row.blockedId : row.blockerId
  )));

  const visibleRows = rows.filter((row) => row.userId === viewerId || !blockedPeerIds.has(row.userId));
  const members = await Promise.all(visibleRows.map(async (row) => ({
    userId: row.userId,
    nickname: row.nickname,
    avatarUrl: row.avatarUrl,
    memberRole: row.memberRole,
    contacts: await revealTeamupStoredContacts(db, row.contacts as StoredTeamupContact[], {
      ownerUserId: row.userId,
      scopeType: 'teamup_member',
      scopeId: row.contactRowId,
    }),
  })));

  return {
    teamupId,
    availableSince: teamup.deadlineAt,
    availableUntil: teamup.endAt,
    members,
  };
}

export async function getPublicTeamupSummary(teamupId: string) {
  if (!TEAMUP_FORUM_SYNC_ENABLED) throw new AppError(404, 'TEAMUP_NOT_FOUND', '公开组队不存在');

  const rows = await db.select().from(teamups)
    .where(and(eq(teamups.id, teamupId), eq(teamups.isPublic, true), gt(teamups.endAt, new Date().toISOString())))
    .limit(1);
  const teamup = rows[0];
  if (!teamup || teamup.status === 'cancelled') throw new AppError(404, 'TEAMUP_NOT_FOUND', '公开组队不存在');

  const circleRows = await db.select({ isActive: circles.isActive, status: circles.status })
    .from(circles)
    .where(eq(circles.id, teamup.circleId))
    .limit(1);
  if (!circleRows[0]?.isActive || circleRows[0].status !== CIRCLE_STATUS.ACTIVE) {
    throw new AppError(404, 'TEAMUP_NOT_FOUND', '公开组队不存在');
  }

  const leaders = await getLeaderMap([teamup.leaderId]);
  return {
    teamup: serializeListTeamup(teamup, leaders.get(teamup.leaderId)),
  };
}
