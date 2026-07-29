import { randomUUID } from 'crypto';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { db } from '../db/connection.js';
import {
  directMessageConversations,
  directMessages,
  userBlocks,
  userFollows,
  userMessageSettings,
  users,
} from '../db/schema.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors.js';

export const MESSAGE_PRIVACY_OPTIONS = ['all', 'following', 'mutual', 'none'] as const;
export type MessagePrivacySetting = typeof MESSAGE_PRIVACY_OPTIONS[number];

const DEFAULT_MESSAGE_PRIVACY_SETTING: MessagePrivacySetting = 'all';
const MAX_DIRECT_MESSAGE_LENGTH = 800;
const MAX_DIRECT_MESSAGE_IMAGES = 9;
const MAX_PENDING_MESSAGES_WITHOUT_REPLY = 3;
const DIRECT_MESSAGE_RECALL_WINDOW_MS = 2 * 60 * 1000;
const DEFAULT_CONVERSATION_LIST_LIMIT = 50;
const MAX_CONVERSATION_LIST_LIMIT = 100;
const DEFAULT_MESSAGE_PAGE_LIMIT = 50;
const MAX_MESSAGE_PAGE_LIMIT = 100;
const PRIVACY_BLOCK_MESSAGE = '由于对方的隐私设置，您暂时无法发送私信';
const LIMIT_BLOCK_MESSAGE = '非互相关注状态下，在对方回复前最多发送3条私信';
const MEDIA_BEFORE_REPLY_BLOCK_MESSAGE = '非互相关注状态下，首次联系在对方回复前只能发送文字私信';
const RECALL_EXPIRED_MESSAGE = '消息发送超过2分钟，无法撤回';
const BLOCK_RELATION_MESSAGE = '你已拉黑对方，将不再接收私信';
const TARGET_SHIELD_MESSAGE = '由于对方屏蔽设置，无法发送私信';

type MessageType = 'text' | 'image' | 'voice';

type FollowRelationStatus = 'none' | 'following' | 'followed_by' | 'mutual';

type BasicUserProfile = {
  id: string;
  nickname: string | null;
  avatarUrl: string | null;
};

type ConversationRecord = typeof directMessageConversations.$inferSelect;

type LockedConversationRow = {
  id: string;
  userAId: string;
  userBId: string;
  createdAt: string | null;
  updatedAt: string | null;
  lastMessageAt: string | null;
};

type ConversationListOptions = {
  page?: number;
  limit?: number;
};

type ConversationDetailOptions = {
  before?: string | null;
  limit?: number;
};

type DirectMessageReason = 'privacy' | 'limit' | 'blocked' | null;

function normalizeConversationPair(userId: string, targetUserId: string) {
  return userId < targetUserId
    ? { userAId: userId, userBId: targetUserId }
    : { userAId: targetUserId, userBId: userId };
}

async function ensureUserExists(userId: string): Promise<BasicUserProfile> {
  const [user] = await db
    .select({
      id: users.id,
      nickname: users.nickname,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new NotFoundError('用户不存在');
  }

  return user;
}

async function ensureTargetUser(viewerUserId: string, targetUserId: string) {
  if (viewerUserId === targetUserId) {
    throw new ValidationError('不能对自己执行该操作');
  }

  return ensureUserExists(targetUserId);
}

function getFollowRelationStatus(isFollowing: boolean, isFollowedBy: boolean): FollowRelationStatus {
  if (isFollowing && isFollowedBy) {
    return 'mutual';
  }
  if (isFollowing) {
    return 'following';
  }
  if (isFollowedBy) {
    return 'followed_by';
  }
  return 'none';
}

async function loadFollowFlags(userId: string, targetUserId: string) {
  const rows = await db
    .select({
      followerId: userFollows.followerId,
      followeeId: userFollows.followeeId,
    })
    .from(userFollows)
    .where(
      or(
        and(eq(userFollows.followerId, userId), eq(userFollows.followeeId, targetUserId)),
        and(eq(userFollows.followerId, targetUserId), eq(userFollows.followeeId, userId)),
      ),
    );

  const isFollowing = rows.some((row) => row.followerId === userId && row.followeeId === targetUserId);
  const isFollowedBy = rows.some((row) => row.followerId === targetUserId && row.followeeId === userId);

  return {
    isFollowing,
    isFollowedBy,
    isMutual: isFollowing && isFollowedBy,
    status: getFollowRelationStatus(isFollowing, isFollowedBy),
  };
}

async function getMessagePrivacySettingValue(userId: string): Promise<MessagePrivacySetting> {
  const [row] = await db
    .select({
      allowDirectMessagesFrom: userMessageSettings.allowDirectMessagesFrom,
    })
    .from(userMessageSettings)
    .where(eq(userMessageSettings.userId, userId))
    .limit(1);

  const value = row?.allowDirectMessagesFrom;
  return MESSAGE_PRIVACY_OPTIONS.includes(value as MessagePrivacySetting)
    ? (value as MessagePrivacySetting)
    : DEFAULT_MESSAGE_PRIVACY_SETTING;
}

async function getExistingConversation(userId: string, targetUserId: string): Promise<ConversationRecord | null> {
  const { userAId, userBId } = normalizeConversationPair(userId, targetUserId);
  const [conversation] = await db
    .select()
    .from(directMessageConversations)
    .where(and(
      eq(directMessageConversations.userAId, userAId),
      eq(directMessageConversations.userBId, userBId),
    ))
    .limit(1);

  return conversation ?? null;
}

function normalizePositiveInteger(value: number | undefined, fallback: number, max: number) {
  if (!Number.isFinite(value) || !value || value < 1) {
    return fallback;
  }
  return Math.min(Math.floor(value), max);
}

/** Coerce postgres JSON/JSONB into a string array safely */
function formatImageUrls(raw: any): string[] | null {
  if (Array.isArray(raw)) return raw.filter((v) => typeof v === 'string');
  if (typeof raw === 'string') {
    try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : null; } catch { return null; }
  }
  return null;
}

async function countRecentPendingMessages(
  conversationId: string,
  senderId: string,
) {
  const recentMessages = await db
    .select({
      senderId: directMessages.senderId,
    })
    .from(directMessages)
    .where(eq(directMessages.conversationId, conversationId))
    .orderBy(desc(directMessages.createdAt))
    .limit(MAX_PENDING_MESSAGES_WITHOUT_REPLY);

  let consecutiveCount = 0;
  for (const message of recentMessages) {
    if (message.senderId !== senderId) {
      break;
    }
    consecutiveCount += 1;
  }

  return consecutiveCount;
}

async function hasConversationMessagesFromBoth(
  conversationId: string,
  userId: string,
  targetUserId: string,
) {
  const rows = await db.execute(sql<{
    user_has_messages: boolean | null;
    target_has_messages: boolean | null;
  }>`
    select
      bool_or(sender_id = ${userId}) as user_has_messages,
      bool_or(sender_id = ${targetUserId}) as target_has_messages
    from direct_messages
    where conversation_id = ${conversationId}
  `);

  const stats = rows[0];
  return Boolean(stats?.user_has_messages) && Boolean(stats?.target_has_messages);
}

async function getBlockState(userId: string, targetUserId: string) {
  const rows = await db
    .select({
      blockerId: userBlocks.blockerId,
      blockedId: userBlocks.blockedId,
    })
    .from(userBlocks)
    .where(
      or(
        and(eq(userBlocks.blockerId, userId), eq(userBlocks.blockedId, targetUserId)),
        and(eq(userBlocks.blockerId, targetUserId), eq(userBlocks.blockedId, userId)),
      ),
    );

  return {
    hasBlock: rows.length > 0,
    blockedByMe: rows.some((row) => row.blockerId === userId && row.blockedId === targetUserId),
    blockedByTarget: rows.some((row) => row.blockerId === targetUserId && row.blockedId === userId),
  };
}

function checkPrivacyAllowed(setting: MessagePrivacySetting, relation: Awaited<ReturnType<typeof loadFollowFlags>>) {
  switch (setting) {
    case 'all':
      return true;
    case 'following':
      return relation.isFollowedBy;
    case 'mutual':
      return relation.isMutual;
    case 'none':
      return false;
    default:
      return false;
  }
}

function buildEligibilityResponse(input: {
  receiver: BasicUserProfile;
  relation: Awaited<ReturnType<typeof loadFollowFlags>>;
  privacySetting: MessagePrivacySetting;
  blockState: Awaited<ReturnType<typeof getBlockState>>;
  conversation: ConversationRecord | null;
  consecutiveMessageCount: number;
  canMessage: boolean;
  reason: DirectMessageReason;
  message: string | null;
}) {
  return {
    targetUser: input.receiver,
    canMessage: input.canMessage,
    reason: input.reason,
    message: input.message,
    privacySetting: input.privacySetting,
    relation: input.relation,
    conversationId: input.conversation?.id ?? null,
    consecutiveMessageCount: input.consecutiveMessageCount,
    remainingMessagesBeforeReply: input.relation.isMutual
      ? null
      : Math.max(0, MAX_PENDING_MESSAGES_WITHOUT_REPLY - input.consecutiveMessageCount),
    blockState: input.blockState,
  };
}

function relationFromFlags(isFollowing: boolean, isFollowedBy: boolean) {
  return {
    isFollowing,
    isFollowedBy,
    isMutual: isFollowing && isFollowedBy,
    status: getFollowRelationStatus(isFollowing, isFollowedBy),
  };
}

export async function getFollowRelation(viewerUserId: string, targetUserId: string) {
  const targetUser = await ensureTargetUser(viewerUserId, targetUserId);
  const relation = await loadFollowFlags(viewerUserId, targetUserId);

  return {
    targetUser,
    ...relation,
  };
}

export async function getFollowOverview(userId: string) {
  const [followingRow, followerRow, mutualRow] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(userFollows)
      .where(eq(userFollows.followerId, userId))
      .then((rows) => rows[0]?.count ?? 0),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(userFollows)
      .where(eq(userFollows.followeeId, userId))
      .then((rows) => rows[0]?.count ?? 0),
    db.execute(sql<{ count: number }>`
      select count(*)::int as count
      from user_follows uf
      inner join user_follows reverse_uf
        on reverse_uf.follower_id = uf.followee_id
       and reverse_uf.followee_id = uf.follower_id
      where uf.follower_id = ${userId}
    `).then((result) => result[0]?.count ?? 0),
  ]);

  return {
    followingCount: followingRow,
    followerCount: followerRow,
    mutualCount: mutualRow,
  };
}

export async function listFollowUsers(
  viewerUserId: string,
  tab: 'mutual' | 'following' | 'followers',
) {
  const rows = await db.execute(sql<{
    user_id: string;
    nickname: string | null;
    avatar_url: string | null;
    signature: string | null;
    created_at: string | null;
  }>`
    ${tab === 'following'
      ? sql`
        select
          u.id as user_id,
          u.nickname,
          u.avatar_url,
          u.signature,
          uf.created_at
        from user_follows uf
        inner join users u on u.id = uf.followee_id
        where uf.follower_id = ${viewerUserId}
        order by uf.created_at desc nulls last
      `
      : tab === 'followers'
        ? sql`
          select
            u.id as user_id,
            u.nickname,
            u.avatar_url,
            u.signature,
            uf.created_at
          from user_follows uf
          inner join users u on u.id = uf.follower_id
          where uf.followee_id = ${viewerUserId}
          order by uf.created_at desc nulls last
        `
        : sql`
          select
            u.id as user_id,
            u.nickname,
            u.avatar_url,
            u.signature,
            uf.created_at
          from user_follows uf
          inner join user_follows reverse_uf
            on reverse_uf.follower_id = uf.followee_id
           and reverse_uf.followee_id = uf.follower_id
          inner join users u on u.id = uf.followee_id
          where uf.follower_id = ${viewerUserId}
          order by uf.created_at desc nulls last
        `}
  `);

  const targetIds = rows.map((row) => String(row.user_id));
  const relations = targetIds.length > 0
    ? await Promise.all(targetIds.map(async (targetUserId) => {
        const relation = await loadFollowFlags(viewerUserId, targetUserId);
        return [targetUserId, relation] as const;
      }))
    : [];

  const relationByUserId = new Map(relations);

  return {
    tab,
    users: rows.map((row) => ({
      userId: String(row.user_id),
      nickname: row.nickname,
      avatarUrl: row.avatar_url,
      signature: row.signature,
      followedAt: row.created_at,
      relation: relationByUserId.get(String(row.user_id)) ?? {
        isFollowing: false,
        isFollowedBy: false,
        isMutual: false,
        status: 'none' as const,
      },
    })),
  };
}

export async function followUser(viewerUserId: string, targetUserId: string) {
  await ensureTargetUser(viewerUserId, targetUserId);

  await db
    .insert(userFollows)
    .values({
      id: randomUUID(),
      followerId: viewerUserId,
      followeeId: targetUserId,
      createdAt: new Date().toISOString(),
    })
    .onConflictDoNothing();

  const relation = await loadFollowFlags(viewerUserId, targetUserId);
  return {
    message: relation.isMutual ? '已互相关注' : '关注成功',
    ...relation,
  };
}

export async function unfollowUser(viewerUserId: string, targetUserId: string) {
  await ensureTargetUser(viewerUserId, targetUserId);

  await db
    .delete(userFollows)
    .where(
      and(
        eq(userFollows.followerId, viewerUserId),
        eq(userFollows.followeeId, targetUserId),
      ),
    );

  const relation = await loadFollowFlags(viewerUserId, targetUserId);
  return {
    message: '已取消关注',
    ...relation,
  };
}

export async function blockUser(viewerUserId: string, targetUserId: string) {
  const targetUser = await ensureTargetUser(viewerUserId, targetUserId);
  const now = new Date().toISOString();

  await db
    .insert(userBlocks)
    .values({
      id: randomUUID(),
      blockerId: viewerUserId,
      blockedId: targetUserId,
      createdAt: now,
    })
    .onConflictDoNothing();

  return {
    message: '已拉黑该用户',
    targetUser,
  };
}

export async function unblockUser(viewerUserId: string, targetUserId: string) {
  const targetUser = await ensureTargetUser(viewerUserId, targetUserId);

  await db
    .delete(userBlocks)
    .where(and(
      eq(userBlocks.blockerId, viewerUserId),
      eq(userBlocks.blockedId, targetUserId),
    ));

  return {
    message: '已解除拉黑',
    targetUser,
  };
}

export async function getMessagePrivacySetting(userId: string) {
  return {
    allowDirectMessagesFrom: await getMessagePrivacySettingValue(userId),
  };
}

export async function updateMessagePrivacySetting(userId: string, setting: MessagePrivacySetting) {
  const now = new Date().toISOString();

  await db
    .insert(userMessageSettings)
    .values({
      userId,
      allowDirectMessagesFrom: setting,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userMessageSettings.userId,
      set: {
        allowDirectMessagesFrom: setting,
        updatedAt: now,
      },
    });

  return {
    message: '私信权限已更新',
    allowDirectMessagesFrom: setting,
  };
}

export async function getDirectMessageEligibility(senderId: string, receiverId: string) {
  const receiver = await ensureTargetUser(senderId, receiverId);
  const [relation, privacySetting, blockState, conversation] = await Promise.all([
    loadFollowFlags(senderId, receiverId),
    getMessagePrivacySettingValue(receiverId),
    getBlockState(senderId, receiverId),
    getExistingConversation(senderId, receiverId),
  ]);

  let canMessage = true;
  let reason: DirectMessageReason = null;
  let message: string | null = null;

  if (blockState.blockedByMe) {
    canMessage = false;
    reason = 'blocked';
    message = BLOCK_RELATION_MESSAGE;
  } else if (blockState.blockedByTarget) {
    canMessage = false;
    reason = 'blocked';
    message = TARGET_SHIELD_MESSAGE;
  } else if (!blockState.blockedByTarget && !checkPrivacyAllowed(privacySetting, relation)) {
    canMessage = false;
    reason = 'privacy';
    message = TARGET_SHIELD_MESSAGE;
  }

  let consecutiveMessageCount = 0;
  if (canMessage && !blockState.blockedByTarget && !relation.isMutual && conversation) {
    const hasTwoWayMessages = await hasConversationMessagesFromBoth(conversation.id, senderId, receiverId);
    if (!hasTwoWayMessages) {
      consecutiveMessageCount = await countRecentPendingMessages(conversation.id, senderId);
      if (consecutiveMessageCount >= MAX_PENDING_MESSAGES_WITHOUT_REPLY) {
        canMessage = false;
        reason = 'limit';
        message = LIMIT_BLOCK_MESSAGE;
      }
    }
  }

  return buildEligibilityResponse({
    receiver,
    canMessage,
    reason,
    message,
    privacySetting,
    relation,
    conversation,
    consecutiveMessageCount,
    blockState,
  });
}

export async function listDirectMessageConversations(userId: string, options: ConversationListOptions = {}) {
  const limit = normalizePositiveInteger(options.limit, DEFAULT_CONVERSATION_LIST_LIMIT, MAX_CONVERSATION_LIST_LIMIT);
  const page = normalizePositiveInteger(options.page, 1, Number.MAX_SAFE_INTEGER);
  const offset = (page - 1) * limit;

  const rows = await db.execute(sql<{
    conversation_id: string;
    user_a_id: string;
    user_b_id: string;
    conversation_created_at: string;
    conversation_updated_at: string;
    conversation_last_message_at: string;
    user_a_nickname: string | null;
    user_a_avatar_url: string | null;
    user_b_nickname: string | null;
    user_b_avatar_url: string | null;
    partner_id: string;
    partner_nickname: string | null;
    partner_avatar_url: string | null;
    is_following: boolean;
    is_followed_by: boolean;
    unread_count: number;
    last_message_id: string | null;
    last_message_type: string | null;
    last_message_sender_id: string | null;
    last_message_receiver_id: string | null;
    last_message_content: string | null;
    last_message_image_urls: any | null;
    last_message_voice_url: string | null;
    last_message_voice_duration_sec: number | null;
    last_message_created_at: string | null;
    last_message_read_at: string | null;
    last_message_recalled_at: string | null;
    last_message_recalled_by_id: string | null;
  }>`
    with conversation_page as (
      select
        c.id,
        c.user_a_id,
        c.user_b_id,
        c.created_at,
        c.updated_at,
        c.last_message_at
      from direct_message_conversations c
      where c.user_a_id = ${userId} or c.user_b_id = ${userId}
      order by c.last_message_at desc nulls last, c.updated_at desc nulls last
      limit ${limit}
      offset ${offset}
    )
    select
      c.id as conversation_id,
      c.user_a_id,
      c.user_b_id,
      c.created_at as conversation_created_at,
      c.updated_at as conversation_updated_at,
      c.last_message_at as conversation_last_message_at,
      user_a.nickname as user_a_nickname,
      user_a.avatar_url as user_a_avatar_url,
      user_b.nickname as user_b_nickname,
      user_b.avatar_url as user_b_avatar_url,
      partner.id as partner_id,
      partner.nickname as partner_nickname,
      partner.avatar_url as partner_avatar_url,
      exists (
        select 1
        from user_follows uf
        where uf.follower_id = ${userId}
          and uf.followee_id = partner.id
      ) as is_following,
      exists (
        select 1
        from user_follows uf
        where uf.follower_id = partner.id
          and uf.followee_id = ${userId}
      ) as is_followed_by,
      coalesce(unread.unread_count, 0)::int as unread_count,
      last_message.id as last_message_id,
      last_message.message_type as last_message_type,
      last_message.sender_id as last_message_sender_id,
      last_message.receiver_id as last_message_receiver_id,
      last_message.content as last_message_content,
      last_message.image_urls as last_message_image_urls,
      last_message.voice_url as last_message_voice_url,
      last_message.voice_duration_sec as last_message_voice_duration_sec,
      last_message.created_at as last_message_created_at,
      last_message.read_at as last_message_read_at,
      last_message.recalled_at as last_message_recalled_at,
      last_message.recalled_by_id as last_message_recalled_by_id
    from conversation_page c
    inner join users user_a on user_a.id = c.user_a_id
    inner join users user_b on user_b.id = c.user_b_id
    inner join users partner
      on partner.id = case when c.user_a_id = ${userId} then c.user_b_id else c.user_a_id end
    left join lateral (
      select
        dm.id,
        dm.message_type,
        dm.sender_id,
        dm.receiver_id,
        dm.content,
        dm.image_urls,
        dm.voice_url,
        dm.voice_duration_sec,
        dm.created_at,
        dm.read_at,
        dm.recalled_at,
        dm.recalled_by_id
      from direct_messages dm
      where dm.conversation_id = c.id
      order by dm.created_at desc
      limit 1
    ) last_message on true
    left join lateral (
      select count(*)::int as unread_count
      from direct_messages dm
      where dm.conversation_id = c.id
        and dm.receiver_id = ${userId}
        and dm.read_at is null
    ) unread on true
    order by c.last_message_at desc nulls last, c.updated_at desc nulls last
  `);

  return {
    conversations: rows.map((row) => {
      const relation = relationFromFlags(Boolean(row.is_following), Boolean(row.is_followed_by));

      return {
        conversationId: row.conversation_id,
        userA: {
          userId: row.user_a_id,
          nickname: row.user_a_nickname,
          avatarUrl: row.user_a_avatar_url,
        },
        userB: {
          userId: row.user_b_id,
          nickname: row.user_b_nickname,
          avatarUrl: row.user_b_avatar_url,
        },
        partner: {
          userId: row.partner_id,
          nickname: row.partner_nickname,
          avatarUrl: row.partner_avatar_url,
        },
        relation,
        unreadCount: Number(row.unread_count ?? 0),
        lastMessage: row.last_message_id
          ? {
              id: row.last_message_id,
              messageType: (row.last_message_type ?? 'text') as MessageType,
              senderId: row.last_message_sender_id!,
              receiverId: row.last_message_receiver_id!,
              content: row.last_message_content ?? null,
              imageUrls: formatImageUrls(row.last_message_image_urls),
              voiceUrl: row.last_message_voice_url ?? null,
              voiceDurationSec: row.last_message_voice_duration_sec ?? null,
              createdAt: row.last_message_created_at!,
              readAt: row.last_message_read_at,
              recalledAt: row.last_message_recalled_at,
              recalledById: row.last_message_recalled_by_id,
            }
          : null,
        createdAt: row.conversation_created_at,
        updatedAt: row.conversation_updated_at,
        lastMessageAt: row.conversation_last_message_at,
      };
    }),
  };
}

export async function getDirectMessageConversation(
  userId: string,
  targetUserId: string,
  options: ConversationDetailOptions = {},
) {
  const targetUser = await ensureTargetUser(userId, targetUserId);
  const [relation, eligibility, conversation] = await Promise.all([
    loadFollowFlags(userId, targetUserId),
    getDirectMessageEligibility(userId, targetUserId),
    getExistingConversation(userId, targetUserId),
  ]);

  if (!conversation) {
    return {
      conversation: null,
      partner: {
        userId: targetUser.id,
        nickname: targetUser.nickname,
        avatarUrl: targetUser.avatarUrl,
      },
      relation,
      eligibility,
      messages: [],
      hasMore: false,
    };
  }

  const now = new Date().toISOString();
  await db
    .update(directMessages)
    .set({ readAt: now })
    .where(
      and(
        eq(directMessages.conversationId, conversation.id),
        eq(directMessages.receiverId, userId),
        isNull(directMessages.readAt),
      ),
    );

  const limit = normalizePositiveInteger(options.limit, DEFAULT_MESSAGE_PAGE_LIMIT, MAX_MESSAGE_PAGE_LIMIT);
  const before = options.before && Number.isFinite(Date.parse(options.before)) ? options.before : null;
  const messageWhere = before
    ? and(eq(directMessages.conversationId, conversation.id), sql`${directMessages.createdAt} < ${before}`)
    : eq(directMessages.conversationId, conversation.id);

  const messagesDesc = await db
    .select({
      id: directMessages.id,
      messageType: directMessages.messageType,
      senderId: directMessages.senderId,
      receiverId: directMessages.receiverId,
      content: directMessages.content,
      imageUrls: directMessages.imageUrls,
      voiceUrl: directMessages.voiceUrl,
      voiceDurationSec: directMessages.voiceDurationSec,
      createdAt: directMessages.createdAt,
      readAt: directMessages.readAt,
      recalledAt: directMessages.recalledAt,
      recalledById: directMessages.recalledById,
    })
    .from(directMessages)
    .where(messageWhere)
    .orderBy(desc(directMessages.createdAt))
    .limit(limit + 1);

  const hasMore = messagesDesc.length > limit;
  const messages = messagesDesc.slice(0, limit).reverse();

  return {
    conversation: {
      id: conversation.id,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      lastMessageAt: conversation.lastMessageAt,
    },
    partner: {
      userId: targetUser.id,
      nickname: targetUser.nickname,
      avatarUrl: targetUser.avatarUrl,
    },
    relation,
    eligibility,
    messages,
    hasMore,
  };
}

export type SendDirectMessageInput = {
  content?: string;
  imageUrls?: string[];
  voiceUrl?: string;
  voiceDurationSec?: number;
};

export async function sendDirectMessage(senderId: string, targetUserId: string, input: SendDirectMessageInput) {
  const targetUser = await ensureTargetUser(senderId, targetUserId);

  // ── Determine message type and validate ──────────────────────────
  const hasContent = typeof input.content === 'string' && input.content.trim().length > 0;
  const hasImages = Array.isArray(input.imageUrls) && input.imageUrls.length > 0;
  const hasVoice = typeof input.voiceUrl === 'string' && input.voiceUrl.trim().length > 0;

  // Exactly one type must be present
  const flags = [hasContent, hasImages, hasVoice].filter(Boolean).length;
  if (flags === 0) {
    throw new ValidationError('私信内容不能为空');
  }
  if (flags > 1) {
    throw new ValidationError('单条私信只能包含一种类型（文字/图片/语音）');
  }

  let messageType: MessageType;
  let content: string | null = null;
  let imageUrls: string[] | null = null;
  let voiceUrl: string | null = null;
  let voiceDurationSec: number | null = null;

  if (hasContent) {
    messageType = 'text';
    content = input.content!.trim();
    if (content.length > MAX_DIRECT_MESSAGE_LENGTH) {
      throw new ValidationError('单条私信内容不得超过 800 字');
    }
  } else if (hasImages) {
    messageType = 'image';
    if (input.imageUrls!.length > MAX_DIRECT_MESSAGE_IMAGES) {
      throw new ValidationError(`单条私信最多发送 ${MAX_DIRECT_MESSAGE_IMAGES} 张图片`);
    }
    imageUrls = input.imageUrls!;
  } else {
    messageType = 'voice';
    voiceUrl = input.voiceUrl!;
    voiceDurationSec = input.voiceDurationSec ?? null;
    if (voiceDurationSec && (voiceDurationSec < 0 || voiceDurationSec > 300)) {
      throw new ValidationError('语音时长无效');
    }
  }

  // ── Eligibility check ────────────────────────────────────────────
  const eligibility = await getDirectMessageEligibility(senderId, targetUserId);
  if (!eligibility.canMessage && eligibility.reason !== 'limit') {
    if (eligibility.blockState.blockedByTarget || eligibility.reason === 'privacy') {
      throw new ForbiddenError(TARGET_SHIELD_MESSAGE);
    }
    if (eligibility.reason === 'blocked') {
      throw new ForbiddenError(BLOCK_RELATION_MESSAGE);
    }
    throw new ForbiddenError(PRIVACY_BLOCK_MESSAGE);
  }

  const { userAId, userBId } = normalizeConversationPair(senderId, targetUserId);
  const now = new Date().toISOString();
  const messageId = randomUUID();

  const conversation = await db.transaction(async (tx) => {
    await tx
      .insert(directMessageConversations)
      .values({
        id: randomUUID(),
        userAId,
        userBId,
        createdAt: now,
        updatedAt: now,
        lastMessageAt: now,
      })
      .onConflictDoNothing();

    const lockedRows = await tx.execute(sql`
      select
        id,
        user_a_id as "userAId",
        user_b_id as "userBId",
        created_at as "createdAt",
        updated_at as "updatedAt",
        last_message_at as "lastMessageAt"
      from direct_message_conversations
      where user_a_id = ${userAId}
        and user_b_id = ${userBId}
      for update
    `) as LockedConversationRow[];
    const lockedConversation = lockedRows[0];

    if (!lockedConversation) {
      throw new NotFoundError('私信会话不存在');
    }

    if (!eligibility.relation.isMutual) {
      const messageStats = await tx.execute(sql`
        select
          bool_or(sender_id = ${senderId}) as sender_has_messages,
          bool_or(sender_id = ${targetUserId}) as target_has_messages
        from direct_messages
        where conversation_id = ${lockedConversation.id}
      `) as Array<{ sender_has_messages: boolean | null; target_has_messages: boolean | null }>;
      const senderHasMessages = Boolean(messageStats[0]?.sender_has_messages);
      const targetHasMessages = Boolean(messageStats[0]?.target_has_messages);
      const hasTwoWayMessages = senderHasMessages && targetHasMessages;
      const senderIsOpeningConversation = !hasTwoWayMessages && !targetHasMessages;

      if (senderIsOpeningConversation && messageType !== 'text') {
        throw new ValidationError(MEDIA_BEFORE_REPLY_BLOCK_MESSAGE);
      }

      if (!hasTwoWayMessages) {
        const recentMessages = await tx.execute(sql`
          select sender_id
          from direct_messages
          where conversation_id = ${lockedConversation.id}
          order by created_at desc
          limit ${MAX_PENDING_MESSAGES_WITHOUT_REPLY}
        `) as Array<{ sender_id: string }>;

        let consecutiveCount = 0;
        for (const message of recentMessages) {
          if (message.sender_id !== senderId) {
            break;
          }
          consecutiveCount += 1;
        }

        if (consecutiveCount >= MAX_PENDING_MESSAGES_WITHOUT_REPLY) {
          throw new ForbiddenError(LIMIT_BLOCK_MESSAGE);
        }
      }
    }

    await tx
      .insert(directMessages)
      .values({
        id: messageId,
        conversationId: lockedConversation.id,
        senderId,
        receiverId: targetUserId,
        messageType,
        content,
        imageUrls: imageUrls as any,
        voiceUrl,
        voiceDurationSec,
        createdAt: now,
        readAt: null,
        recalledAt: null,
        recalledById: null,
      });

    await tx
      .update(directMessageConversations)
      .set({
        updatedAt: now,
        lastMessageAt: now,
      })
      .where(eq(directMessageConversations.id, lockedConversation.id));

    return lockedConversation;
  });

  return {
    message: '发送成功',
    conversationId: conversation.id,
    targetUser: {
      userId: targetUser.id,
      nickname: targetUser.nickname,
      avatarUrl: targetUser.avatarUrl,
    },
    directMessage: {
      id: messageId,
      messageType,
      senderId,
      receiverId: targetUserId,
      content,
      imageUrls,
      voiceUrl,
      voiceDurationSec,
      createdAt: now,
      readAt: null,
      recalledAt: null,
      recalledById: null,
    },
  };
}

export async function recallDirectMessage(userId: string, messageId: string) {
  const [message] = await db
    .select({
      id: directMessages.id,
      conversationId: directMessages.conversationId,
      senderId: directMessages.senderId,
      receiverId: directMessages.receiverId,
      messageType: directMessages.messageType,
      content: directMessages.content,
      imageUrls: directMessages.imageUrls,
      voiceUrl: directMessages.voiceUrl,
      voiceDurationSec: directMessages.voiceDurationSec,
      createdAt: directMessages.createdAt,
      readAt: directMessages.readAt,
      recalledAt: directMessages.recalledAt,
      recalledById: directMessages.recalledById,
    })
    .from(directMessages)
    .where(eq(directMessages.id, messageId))
    .limit(1);

  if (!message) {
    throw new NotFoundError('私信消息不存在');
  }
  if (message.senderId !== userId) {
    throw new ForbiddenError('只能撤回自己发送的私信');
  }
  if (message.recalledAt) {
    return {
      message: '消息已撤回',
      directMessage: message,
    };
  }

  const createdAtMs = Date.parse(message.createdAt ?? '');
  if (!Number.isFinite(createdAtMs) || Date.now() - createdAtMs > DIRECT_MESSAGE_RECALL_WINDOW_MS) {
    throw new ForbiddenError(RECALL_EXPIRED_MESSAGE);
  }

  const now = new Date().toISOString();
  await db
    .update(directMessages)
    .set({
      recalledAt: now,
      recalledById: userId,
      readAt: message.readAt,
    })
    .where(eq(directMessages.id, messageId));

  return {
    message: '消息已撤回',
    directMessage: {
      ...message,
      recalledAt: now,
      recalledById: userId,
    },
  };
}
