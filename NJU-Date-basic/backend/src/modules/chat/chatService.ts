import { v4 as uuid } from 'uuid';
import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import { db } from '../../db/connection.js';
import {
  auditLogs,
  circleChatMessages,
  circleChatReadStates,
  circleMembers,
  circles,
  teamupChatMessages,
  teamupChatReadStates,
  teamupMembers,
  teamups,
  users,
} from '../../db/schema.js';
import { AppError, ForbiddenError, NotFoundError, ValidationError } from '../../utils/errors.js';
import { CIRCLE_MEMBERSHIP_STATUS } from '../../utils/circleMembership.js';
import { CIRCLE_STATUS } from '../../utils/circleStatus.js';
import {
  assertChatContentAllowed,
  normalizeChatContent,
  normalizeMentions,
  type CircleKeywordRule,
} from './moderation.js';

const CHAT_RATE_WINDOW_MS = 5000;
const CHAT_RATE_MAX_MESSAGES = 5;
const chatRateBuckets = new Map<string, number[]>();

export interface ChatSender {
  userId: string;
  nickname: string | null;
  avatarUrl: string | null;
}

export interface ChatMessageDto {
  id: string;
  roomType: 'circle' | 'teamup';
  circleId: string;
  teamupId?: string;
  sender: ChatSender;
  content: string;
  mentions: string[];
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
  isOwn: boolean;
}

export interface SendCircleChatMessageInput {
  clientMessageId: string;
  content: string;
  mentions?: string[];
}

export type SendTeamupChatMessageInput = SendCircleChatMessageInput;

type CircleChatRow = {
  id: string;
  circleId: string;
  senderId: string;
  clientMessageId: string;
  content: string;
  mentions: string[];
  status: string;
  deletedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  senderNickname: string | null;
  senderAvatarUrl: string | null;
};

type TeamupChatRow = {
  id: string;
  teamupId: string;
  circleId: string;
  senderId: string;
  clientMessageId: string;
  content: string;
  mentions: string[];
  status: string;
  deletedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  senderNickname: string | null;
  senderAvatarUrl: string | null;
};

function nowIso() {
  return new Date().toISOString();
}

function serializeMessage(row: CircleChatRow, viewerId: string): ChatMessageDto {
  const deletedAt = row.deletedAt;
  return {
    id: row.id,
    roomType: 'circle',
    circleId: row.circleId,
    sender: {
      userId: row.senderId,
      nickname: row.senderNickname,
      avatarUrl: row.senderAvatarUrl,
    },
    content: deletedAt || row.status === 'deleted' ? '' : row.content,
    mentions: Array.isArray(row.mentions) ? row.mentions : [],
    createdAt: row.createdAt ?? nowIso(),
    updatedAt: row.updatedAt,
    deletedAt,
    isOwn: row.senderId === viewerId,
  };
}

function serializeTeamupMessage(row: TeamupChatRow, viewerId: string): ChatMessageDto {
  const deletedAt = row.deletedAt;
  return {
    id: row.id,
    roomType: 'teamup',
    circleId: row.circleId,
    teamupId: row.teamupId,
    sender: {
      userId: row.senderId,
      nickname: row.senderNickname,
      avatarUrl: row.senderAvatarUrl,
    },
    content: deletedAt || row.status === 'deleted' ? '' : row.content,
    mentions: Array.isArray(row.mentions) ? row.mentions : [],
    createdAt: row.createdAt ?? nowIso(),
    updatedAt: row.updatedAt,
    deletedAt,
    isOwn: row.senderId === viewerId,
  };
}

function checkChatRateLimit(userId: string, roomKey: string) {
  const key = `${userId}:${roomKey}`;
  const now = Date.now();
  const bucket = (chatRateBuckets.get(key) ?? []).filter((ts) => now - ts < CHAT_RATE_WINDOW_MS);
  if (bucket.length >= CHAT_RATE_MAX_MESSAGES) {
    chatRateBuckets.set(key, bucket);
    throw new AppError(429, 'CHAT_RATE_LIMITED', '发言太快了，稍等几秒再试');
  }
  bucket.push(now);
  chatRateBuckets.set(key, bucket);
}

async function getCircleKeywordRules(circleId: string) {
  const [row] = await db.select({ keywordRules: circles.keywordRules })
    .from(circles)
    .where(eq(circles.id, circleId))
    .limit(1);
  return (row?.keywordRules ?? []) as CircleKeywordRule[];
}

export async function ensureActiveCircleChatMember(circleId: string, userId: string) {
  const [row] = await db.select({
    circleId: circles.id,
    circleStatus: circles.status,
    circleIsActive: circles.isActive,
    memberId: circleMembers.id,
    memberIsActive: circleMembers.isActive,
    membershipStatus: circleMembers.membershipStatus,
  })
    .from(circles)
    .leftJoin(circleMembers, and(
      eq(circleMembers.circleId, circles.id),
      eq(circleMembers.userId, userId),
      eq(circleMembers.membershipStatus, CIRCLE_MEMBERSHIP_STATUS.ACTIVE),
      eq(circleMembers.isActive, true),
    ))
    .where(eq(circles.id, circleId))
    .limit(1);

  if (!row) throw new NotFoundError('圈子不存在');
  if (!row.circleIsActive || row.circleStatus !== CIRCLE_STATUS.ACTIVE) {
    throw new ForbiddenError('该圈子当前不可聊天');
  }
  if (!row.memberId || !row.memberIsActive || row.membershipStatus !== CIRCLE_MEMBERSHIP_STATUS.ACTIVE) {
    throw new ForbiddenError('加入圈子后可参与聊天');
  }
}

export async function listActiveCircleChatMemberIds(circleId: string, userIds: string[]) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueUserIds.length === 0) return new Set<string>();

  const rows = await db.select({ userId: circleMembers.userId })
    .from(circles)
    .innerJoin(circleMembers, and(
      eq(circleMembers.circleId, circles.id),
      inArray(circleMembers.userId, uniqueUserIds),
      eq(circleMembers.membershipStatus, CIRCLE_MEMBERSHIP_STATUS.ACTIVE),
      eq(circleMembers.isActive, true),
    ))
    .where(and(
      eq(circles.id, circleId),
      eq(circles.status, CIRCLE_STATUS.ACTIVE),
      eq(circles.isActive, true),
    ));

  return new Set(rows.map((row) => row.userId));
}

function toTime(value: string | null | undefined) {
  const time = Date.parse(value ?? '');
  return Number.isFinite(time) ? time : NaN;
}

export async function ensureActiveTeamupChatMember(circleId: string, teamupId: string, userId: string) {
  const [row] = await db.select({
    teamupId: teamups.id,
    teamupStatus: teamups.status,
    teamupEndAt: teamups.endAt,
    circleId: circles.id,
    circleStatus: circles.status,
    circleIsActive: circles.isActive,
    memberId: teamupMembers.id,
    membershipStatus: teamupMembers.membershipStatus,
  })
    .from(teamups)
    .innerJoin(circles, eq(circles.id, teamups.circleId))
    .leftJoin(teamupMembers, and(
      eq(teamupMembers.teamupId, teamups.id),
      eq(teamupMembers.userId, userId),
      eq(teamupMembers.membershipStatus, 'active'),
    ))
    .where(and(
      eq(teamups.id, teamupId),
      eq(teamups.circleId, circleId),
    ))
    .limit(1);

  if (!row) throw new NotFoundError('组队不存在');
  if (!row.circleIsActive || row.circleStatus !== CIRCLE_STATUS.ACTIVE) {
    throw new AppError(403, 'CIRCLE_NOT_ACTIVE', '来源圈子当前不可聊天');
  }
  if (!row.memberId || row.membershipStatus !== 'active') {
    throw new AppError(403, 'NOT_TEAMUP_MEMBER', '加入组队后可参与聊天');
  }
  if (row.teamupStatus === 'cancelled') {
    throw new AppError(403, 'TEAMUP_CHAT_CLOSED', '组队已取消，聊天已关闭');
  }
  if (toTime(row.teamupEndAt) <= Date.now()) {
    throw new AppError(403, 'TEAMUP_CHAT_CLOSED', '组队已结束，聊天已关闭');
  }
}

export async function listActiveTeamupChatMemberIds(circleId: string, teamupId: string, userIds: string[]) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueUserIds.length === 0) return new Set<string>();

  const rows = await db.select({ userId: teamupMembers.userId })
    .from(teamups)
    .innerJoin(circles, eq(circles.id, teamups.circleId))
    .innerJoin(teamupMembers, and(
      eq(teamupMembers.teamupId, teamups.id),
      inArray(teamupMembers.userId, uniqueUserIds),
      eq(teamupMembers.membershipStatus, 'active'),
    ))
    .where(and(
      eq(teamups.id, teamupId),
      eq(teamups.circleId, circleId),
      sql`${teamups.status} <> 'cancelled'`,
      sql`${teamups.endAt} > NOW()`,
      eq(circles.status, CIRCLE_STATUS.ACTIVE),
      eq(circles.isActive, true),
    ));

  return new Set(rows.map((row) => row.userId));
}

async function getMessageById(messageId: string, viewerId: string) {
  const [row] = await db.select({
    id: circleChatMessages.id,
    circleId: circleChatMessages.circleId,
    senderId: circleChatMessages.senderId,
    clientMessageId: circleChatMessages.clientMessageId,
    content: circleChatMessages.content,
    mentions: circleChatMessages.mentions,
    status: circleChatMessages.status,
    deletedAt: circleChatMessages.deletedAt,
    createdAt: circleChatMessages.createdAt,
    updatedAt: circleChatMessages.updatedAt,
    senderNickname: users.nickname,
    senderAvatarUrl: users.avatarUrl,
  })
    .from(circleChatMessages)
    .innerJoin(users, eq(users.id, circleChatMessages.senderId))
    .where(eq(circleChatMessages.id, messageId))
    .limit(1);

  return row ? serializeMessage(row, viewerId) : null;
}

async function getTeamupMessageById(messageId: string, viewerId: string) {
  const [row] = await db.select({
    id: teamupChatMessages.id,
    teamupId: teamupChatMessages.teamupId,
    circleId: teamupChatMessages.circleId,
    senderId: teamupChatMessages.senderId,
    clientMessageId: teamupChatMessages.clientMessageId,
    content: teamupChatMessages.content,
    mentions: teamupChatMessages.mentions,
    status: teamupChatMessages.status,
    deletedAt: teamupChatMessages.deletedAt,
    createdAt: teamupChatMessages.createdAt,
    updatedAt: teamupChatMessages.updatedAt,
    senderNickname: users.nickname,
    senderAvatarUrl: users.avatarUrl,
  })
    .from(teamupChatMessages)
    .innerJoin(users, eq(users.id, teamupChatMessages.senderId))
    .where(eq(teamupChatMessages.id, messageId))
    .limit(1);

  return row ? serializeTeamupMessage(row, viewerId) : null;
}

export async function listCircleChatMessages(
  userId: string,
  circleId: string,
  options: { before?: string; limit?: number } = {},
) {
  await ensureActiveCircleChatMember(circleId, userId);

  const limit = Math.min(50, Math.max(1, options.limit ?? 30));
  const conditions = [eq(circleChatMessages.circleId, circleId)];

  if (options.before) {
    const [beforeRow] = await db.select({ createdAt: circleChatMessages.createdAt })
      .from(circleChatMessages)
      .where(and(
        eq(circleChatMessages.id, options.before),
        eq(circleChatMessages.circleId, circleId),
      ))
      .limit(1);
    if (!beforeRow?.createdAt) {
      return { messages: [], hasMore: false, nextBefore: null };
    }
    conditions.push(lt(circleChatMessages.createdAt, beforeRow.createdAt));
  }

  const rows = await db.select({
    id: circleChatMessages.id,
    circleId: circleChatMessages.circleId,
    senderId: circleChatMessages.senderId,
    clientMessageId: circleChatMessages.clientMessageId,
    content: circleChatMessages.content,
    mentions: circleChatMessages.mentions,
    status: circleChatMessages.status,
    deletedAt: circleChatMessages.deletedAt,
    createdAt: circleChatMessages.createdAt,
    updatedAt: circleChatMessages.updatedAt,
    senderNickname: users.nickname,
    senderAvatarUrl: users.avatarUrl,
  })
    .from(circleChatMessages)
    .innerJoin(users, eq(users.id, circleChatMessages.senderId))
    .where(and(...conditions))
    .orderBy(desc(circleChatMessages.createdAt))
    .limit(limit + 1);

  const visibleRows = rows.slice(0, limit).reverse();
  const messages = visibleRows.map((row) => serializeMessage(row, userId));

  return {
    messages,
    hasMore: rows.length > limit,
    nextBefore: rows.length > limit ? messages[0]?.id ?? null : null,
  };
}

export async function sendCircleChatMessage(
  userId: string,
  circleId: string,
  input: SendCircleChatMessageInput,
) {
  await ensureActiveCircleChatMember(circleId, userId);

  const clientMessageId = input.clientMessageId.trim();
  if (!clientMessageId) throw new ValidationError('clientMessageId 不能为空');

  const [existing] = await db.select({ id: circleChatMessages.id })
    .from(circleChatMessages)
    .where(and(
      eq(circleChatMessages.circleId, circleId),
      eq(circleChatMessages.senderId, userId),
      eq(circleChatMessages.clientMessageId, clientMessageId),
    ))
    .limit(1);
  if (existing) {
    const message = await getMessageById(existing.id, userId);
    if (!message) throw new NotFoundError('消息不存在');
    return message;
  }

  const content = normalizeChatContent(input.content);
  const mentions = normalizeMentions(input.mentions);
  const keywordRules = await getCircleKeywordRules(circleId);
  assertChatContentAllowed(content, keywordRules);
  checkChatRateLimit(userId, `circle:${circleId}`);

  const id = uuid();
  const now = nowIso();
  const inserted = await db.insert(circleChatMessages).values({
    id,
    circleId,
    senderId: userId,
    clientMessageId,
    content,
    mentions,
    status: 'visible',
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing({
    target: [circleChatMessages.circleId, circleChatMessages.senderId, circleChatMessages.clientMessageId],
  }).returning({ id: circleChatMessages.id });

  if (!inserted[0]) {
    const [duplicate] = await db.select({ id: circleChatMessages.id })
      .from(circleChatMessages)
      .where(and(
        eq(circleChatMessages.circleId, circleId),
        eq(circleChatMessages.senderId, userId),
        eq(circleChatMessages.clientMessageId, clientMessageId),
      ))
      .limit(1);
    if (duplicate) {
      const message = await getMessageById(duplicate.id, userId);
      if (!message) throw new NotFoundError('消息不存在');
      return message;
    }
  }

  const message = await getMessageById(inserted[0]?.id ?? id, userId);
  if (!message) throw new NotFoundError('消息不存在');
  return message;
}

export async function listTeamupChatMessages(
  userId: string,
  circleId: string,
  teamupId: string,
  options: { before?: string; limit?: number } = {},
) {
  await ensureActiveTeamupChatMember(circleId, teamupId, userId);

  const limit = Math.min(50, Math.max(1, options.limit ?? 30));
  const conditions = [
    eq(teamupChatMessages.circleId, circleId),
    eq(teamupChatMessages.teamupId, teamupId),
  ];

  if (options.before) {
    const [beforeRow] = await db.select({ createdAt: teamupChatMessages.createdAt })
      .from(teamupChatMessages)
      .where(and(
        eq(teamupChatMessages.id, options.before),
        eq(teamupChatMessages.circleId, circleId),
        eq(teamupChatMessages.teamupId, teamupId),
      ))
      .limit(1);
    if (!beforeRow?.createdAt) {
      return { messages: [], hasMore: false, nextBefore: null };
    }
    conditions.push(lt(teamupChatMessages.createdAt, beforeRow.createdAt));
  }

  const rows = await db.select({
    id: teamupChatMessages.id,
    teamupId: teamupChatMessages.teamupId,
    circleId: teamupChatMessages.circleId,
    senderId: teamupChatMessages.senderId,
    clientMessageId: teamupChatMessages.clientMessageId,
    content: teamupChatMessages.content,
    mentions: teamupChatMessages.mentions,
    status: teamupChatMessages.status,
    deletedAt: teamupChatMessages.deletedAt,
    createdAt: teamupChatMessages.createdAt,
    updatedAt: teamupChatMessages.updatedAt,
    senderNickname: users.nickname,
    senderAvatarUrl: users.avatarUrl,
  })
    .from(teamupChatMessages)
    .innerJoin(users, eq(users.id, teamupChatMessages.senderId))
    .where(and(...conditions))
    .orderBy(desc(teamupChatMessages.createdAt))
    .limit(limit + 1);

  const visibleRows = rows.slice(0, limit).reverse();
  const messages = visibleRows.map((row) => serializeTeamupMessage(row, userId));

  return {
    messages,
    hasMore: rows.length > limit,
    nextBefore: rows.length > limit ? messages[0]?.id ?? null : null,
  };
}

export async function sendTeamupChatMessage(
  userId: string,
  circleId: string,
  teamupId: string,
  input: SendTeamupChatMessageInput,
) {
  await ensureActiveTeamupChatMember(circleId, teamupId, userId);

  const clientMessageId = input.clientMessageId.trim();
  if (!clientMessageId) throw new ValidationError('clientMessageId 不能为空');

  const [existing] = await db.select({ id: teamupChatMessages.id })
    .from(teamupChatMessages)
    .where(and(
      eq(teamupChatMessages.circleId, circleId),
      eq(teamupChatMessages.teamupId, teamupId),
      eq(teamupChatMessages.senderId, userId),
      eq(teamupChatMessages.clientMessageId, clientMessageId),
    ))
    .limit(1);
  if (existing) {
    const message = await getTeamupMessageById(existing.id, userId);
    if (!message) throw new NotFoundError('消息不存在');
    return message;
  }

  const content = normalizeChatContent(input.content);
  const mentions = normalizeMentions(input.mentions);
  const keywordRules = await getCircleKeywordRules(circleId);
  assertChatContentAllowed(content, keywordRules);
  checkChatRateLimit(userId, `teamup:${teamupId}`);

  const id = uuid();
  const now = nowIso();
  const inserted = await db.insert(teamupChatMessages).values({
    id,
    teamupId,
    circleId,
    senderId: userId,
    clientMessageId,
    content,
    mentions,
    status: 'visible',
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing({
    target: [teamupChatMessages.teamupId, teamupChatMessages.senderId, teamupChatMessages.clientMessageId],
  }).returning({ id: teamupChatMessages.id });

  if (!inserted[0]) {
    const [duplicate] = await db.select({ id: teamupChatMessages.id })
      .from(teamupChatMessages)
      .where(and(
        eq(teamupChatMessages.circleId, circleId),
        eq(teamupChatMessages.teamupId, teamupId),
        eq(teamupChatMessages.senderId, userId),
        eq(teamupChatMessages.clientMessageId, clientMessageId),
      ))
      .limit(1);
    if (duplicate) {
      const message = await getTeamupMessageById(duplicate.id, userId);
      if (!message) throw new NotFoundError('消息不存在');
      return message;
    }
  }

  const message = await getTeamupMessageById(inserted[0]?.id ?? id, userId);
  if (!message) throw new NotFoundError('消息不存在');
  return message;
}

export async function deleteCircleChatMessage(userId: string, circleId: string, messageId: string) {
  await ensureActiveCircleChatMember(circleId, userId);

  const [message] = await db.select({
    id: circleChatMessages.id,
    senderId: circleChatMessages.senderId,
    status: circleChatMessages.status,
  })
    .from(circleChatMessages)
    .where(and(
      eq(circleChatMessages.id, messageId),
      eq(circleChatMessages.circleId, circleId),
    ))
    .limit(1);

  if (!message) throw new NotFoundError('消息不存在');
  if (message.senderId !== userId) throw new ForbiddenError('只能删除自己发送的消息');
  if (message.status !== 'deleted') {
    const now = nowIso();
    await db.update(circleChatMessages)
      .set({
        status: 'deleted',
        deletedBy: userId,
        deletedAt: now,
        updatedAt: now,
      })
      .where(eq(circleChatMessages.id, messageId));

    await db.insert(auditLogs).values({
      operatorId: userId,
      action: 'circle_chat_message_delete',
      target: messageId,
      detail: JSON.stringify({ circleId }),
      result: 'success',
    });
  }

  return { messageId, circleId };
}

export async function deleteTeamupChatMessage(userId: string, circleId: string, teamupId: string, messageId: string) {
  await ensureActiveTeamupChatMember(circleId, teamupId, userId);

  const [message] = await db.select({
    id: teamupChatMessages.id,
    senderId: teamupChatMessages.senderId,
    status: teamupChatMessages.status,
  })
    .from(teamupChatMessages)
    .where(and(
      eq(teamupChatMessages.id, messageId),
      eq(teamupChatMessages.circleId, circleId),
      eq(teamupChatMessages.teamupId, teamupId),
    ))
    .limit(1);

  if (!message) throw new NotFoundError('消息不存在');
  if (message.senderId !== userId) throw new ForbiddenError('只能删除自己发送的消息');
  if (message.status !== 'deleted') {
    const now = nowIso();
    await db.update(teamupChatMessages)
      .set({
        status: 'deleted',
        deletedBy: userId,
        deletedAt: now,
        updatedAt: now,
      })
      .where(eq(teamupChatMessages.id, messageId));

    await db.insert(auditLogs).values({
      operatorId: userId,
      action: 'teamup_chat_message_delete',
      target: messageId,
      detail: JSON.stringify({ circleId, teamupId }),
      result: 'success',
    });
  }

  return { messageId, circleId, teamupId };
}

export async function updateCircleChatReadState(
  userId: string,
  circleId: string,
  input: { lastReadMessageId?: string; lastReadAt?: string },
) {
  await ensureActiveCircleChatMember(circleId, userId);

  const now = nowIso();
  const lastReadAt = input.lastReadAt ?? now;
  const lastReadMessageId = input.lastReadMessageId ?? null;

  if (lastReadMessageId) {
    const [message] = await db.select({ id: circleChatMessages.id })
      .from(circleChatMessages)
      .where(and(
        eq(circleChatMessages.id, lastReadMessageId),
        eq(circleChatMessages.circleId, circleId),
      ))
      .limit(1);
    if (!message) throw new NotFoundError('消息不存在');
  }

  await db.insert(circleChatReadStates).values({
    id: uuid(),
    userId,
    circleId,
    lastReadMessageId,
    lastReadAt,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: [circleChatReadStates.userId, circleChatReadStates.circleId],
    set: {
      lastReadMessageId,
      lastReadAt,
      updatedAt: now,
    },
  });

  const [unreadRow] = await db.select({ unreadCount: sql<number>`count(*)::int` })
    .from(circleChatMessages)
    .where(and(
      eq(circleChatMessages.circleId, circleId),
      sql`${circleChatMessages.createdAt} > ${lastReadAt}`,
      sql`${circleChatMessages.senderId} <> ${userId}`,
      sql`${circleChatMessages.status} = 'visible'`,
    ));

  return { lastReadMessageId, lastReadAt, unreadCount: unreadRow?.unreadCount ?? 0 };
}

export async function updateTeamupChatReadState(
  userId: string,
  circleId: string,
  teamupId: string,
  input: { lastReadMessageId?: string; lastReadAt?: string },
) {
  await ensureActiveTeamupChatMember(circleId, teamupId, userId);

  const now = nowIso();
  const lastReadAt = input.lastReadAt ?? now;
  const lastReadMessageId = input.lastReadMessageId ?? null;

  if (lastReadMessageId) {
    const [message] = await db.select({ id: teamupChatMessages.id })
      .from(teamupChatMessages)
      .where(and(
        eq(teamupChatMessages.id, lastReadMessageId),
        eq(teamupChatMessages.circleId, circleId),
        eq(teamupChatMessages.teamupId, teamupId),
      ))
      .limit(1);
    if (!message) throw new NotFoundError('消息不存在');
  }

  await db.insert(teamupChatReadStates).values({
    id: uuid(),
    userId,
    teamupId,
    lastReadMessageId,
    lastReadAt,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: [teamupChatReadStates.userId, teamupChatReadStates.teamupId],
    set: {
      lastReadMessageId,
      lastReadAt,
      updatedAt: now,
    },
  });

  const [unreadRow] = await db.select({ unreadCount: sql<number>`count(*)::int` })
    .from(teamupChatMessages)
    .where(and(
      eq(teamupChatMessages.circleId, circleId),
      eq(teamupChatMessages.teamupId, teamupId),
      sql`${teamupChatMessages.createdAt} > ${lastReadAt}`,
      sql`${teamupChatMessages.senderId} <> ${userId}`,
      sql`${teamupChatMessages.status} = 'visible'`,
    ));

  return { lastReadMessageId, lastReadAt, unreadCount: unreadRow?.unreadCount ?? 0 };
}
