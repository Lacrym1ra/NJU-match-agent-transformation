import { api } from './client';

export type FollowRelationStatus = 'none' | 'following' | 'followed_by' | 'mutual';
export type MessagePrivacySetting = 'all' | 'following' | 'mutual' | 'none';
export type DirectMessageBlockReason = 'privacy' | 'limit' | 'blocked' | null;
export type FollowListTab = 'mutual' | 'following' | 'followers';

export interface SocialUserSummary {
  userId: string;
  nickname: string | null;
  avatarUrl: string | null;
}

interface RawUserSummary {
  id?: string;
  userId?: string;
  nickname: string | null;
  avatarUrl: string | null;
}

interface RawFollowStatus {
  targetUser?: RawUserSummary;
  isFollowing: boolean;
  isFollowedBy: boolean;
  isMutual: boolean;
  status: FollowRelationStatus;
  message?: string;
}

export interface FollowStatus {
  targetUser?: SocialUserSummary;
  isFollowing: boolean;
  isFollowedBy: boolean;
  isMutual: boolean;
  status: FollowRelationStatus;
  message?: string;
}

interface RawDirectMessageEligibility {
  targetUser: RawUserSummary;
  canMessage: boolean;
  reason: DirectMessageBlockReason;
  message: string | null;
  privacySetting: MessagePrivacySetting;
  relation: RawFollowStatus;
  conversationId: string | null;
  consecutiveMessageCount: number;
  remainingMessagesBeforeReply: number | null;
  blockState: {
    hasBlock: boolean;
    blockedByMe: boolean;
    blockedByTarget: boolean;
  };
}

export interface DirectMessageEligibility {
  targetUser: SocialUserSummary;
  canMessage: boolean;
  reason: DirectMessageBlockReason;
  message: string | null;
  privacySetting: MessagePrivacySetting;
  relation: FollowStatus;
  conversationId: string | null;
  consecutiveMessageCount: number;
  remainingMessagesBeforeReply: number | null;
  blockState: {
    hasBlock: boolean;
    blockedByMe: boolean;
    blockedByTarget: boolean;
  };
}

interface RawConversationMessage {
  id: string;
  messageType: string;
  senderId: string;
  receiverId: string;
  content: string | null;
  imageUrls: string[] | null;
  voiceUrl: string | null;
  voiceDurationSec: number | null;
  createdAt: string;
  readAt: string | null;
  recalledAt: string | null;
  recalledById: string | null;
}

interface RawConversationSummary {
  conversationId: string;
  userA?: RawUserSummary;
  userB?: RawUserSummary;
  partner: RawUserSummary;
  relation: RawFollowStatus;
  unreadCount: number;
  lastMessage: RawConversationMessage | null;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
}

interface RawConversationListResponse {
  conversations: RawConversationSummary[];
}

interface RawConversationDetailResponse {
  conversation: {
    id: string;
    createdAt: string;
    updatedAt: string;
    lastMessageAt: string;
  } | null;
  partner: RawUserSummary;
  relation: RawFollowStatus;
  eligibility: RawDirectMessageEligibility;
  messages: RawConversationMessage[];
}

interface RawSendDirectMessageResponse {
  message: string;
  conversationId: string;
  targetUser: RawUserSummary;
  directMessage: RawConversationMessage;
}

interface RawBlockUserResponse {
  message: string;
  targetUser: RawUserSummary;
}

interface RawRecallDirectMessageResponse {
  message: string;
  directMessage: RawConversationMessage;
}

interface RawFollowListUser {
  userId: string;
  nickname: string | null;
  avatarUrl: string | null;
  signature: string | null;
  followedAt: string | null;
  relation: RawFollowStatus;
}

interface RawFollowListResponse {
  tab: FollowListTab;
  followingCount: number;
  followerCount: number;
  mutualCount: number;
  users: RawFollowListUser[];
}

export interface DirectMessage {
  id: string;
  messageType: 'text' | 'image' | 'voice';
  senderId: string;
  receiverId: string;
  content: string | null;
  imageUrls: string[] | null;
  voiceUrl: string | null;
  voiceDurationSec: number | null;
  createdAt: string;
  readAt: string | null;
  recalledAt: string | null;
  recalledById: string | null;
}

export interface DirectMessageConversationSummary {
  conversationId: string;
  userA?: SocialUserSummary;
  userB?: SocialUserSummary;
  partner: SocialUserSummary;
  relation: FollowStatus;
  unreadCount: number;
  lastMessage: DirectMessage | null;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
}

export interface DirectMessageConversationListResponse {
  conversations: DirectMessageConversationSummary[];
}

export interface DirectMessageConversationDetailResponse {
  conversation: {
    id: string;
    createdAt: string;
    updatedAt: string;
    lastMessageAt: string;
  } | null;
  partner: SocialUserSummary;
  relation: FollowStatus;
  eligibility: DirectMessageEligibility;
  messages: DirectMessage[];
}

export interface FollowListUser {
  userId: string;
  nickname: string | null;
  avatarUrl: string | null;
  signature: string | null;
  followedAt: string | null;
  relation: FollowStatus;
}

export interface FollowListResponse {
  tab: FollowListTab;
  followingCount: number;
  followerCount: number;
  mutualCount: number;
  users: FollowListUser[];
}

function normalizeUserSummary(raw?: RawUserSummary): SocialUserSummary | undefined {
  if (!raw) return undefined;

  return {
    userId: raw.userId ?? raw.id ?? '',
    nickname: raw.nickname,
    avatarUrl: raw.avatarUrl,
  };
}

function normalizeFollowStatus(raw: RawFollowStatus): FollowStatus {
  return {
    targetUser: normalizeUserSummary(raw.targetUser),
    isFollowing: raw.isFollowing,
    isFollowedBy: raw.isFollowedBy,
    isMutual: raw.isMutual,
    status: raw.status,
    message: raw.message,
  };
}

function normalizeDirectMessage(raw: RawConversationMessage): DirectMessage {
  return {
    id: raw.id,
    messageType: (raw.messageType ?? 'text') as DirectMessage['messageType'],
    senderId: raw.senderId,
    receiverId: raw.receiverId,
    content: raw.content ?? null,
    imageUrls: Array.isArray(raw.imageUrls) ? raw.imageUrls : null,
    voiceUrl: raw.voiceUrl ?? null,
    voiceDurationSec: raw.voiceDurationSec ?? null,
    createdAt: raw.createdAt,
    readAt: raw.readAt,
    recalledAt: raw.recalledAt ?? null,
    recalledById: raw.recalledById ?? null,
  };
}

function normalizeDirectMessageEligibility(raw: RawDirectMessageEligibility): DirectMessageEligibility {
  return {
    targetUser: {
      userId: raw.targetUser.userId ?? raw.targetUser.id ?? '',
      nickname: raw.targetUser.nickname,
      avatarUrl: raw.targetUser.avatarUrl,
    },
    canMessage: raw.canMessage,
    reason: raw.reason,
    message: raw.message,
    privacySetting: raw.privacySetting,
    relation: normalizeFollowStatus(raw.relation),
    conversationId: raw.conversationId,
    consecutiveMessageCount: raw.consecutiveMessageCount,
    remainingMessagesBeforeReply: raw.remainingMessagesBeforeReply,
    blockState: raw.blockState,
  };
}

export async function getFollowStatus(userId: string): Promise<FollowStatus> {
  const raw = await api.get<RawFollowStatus>(`/social/follows/${encodeURIComponent(userId)}`);
  return normalizeFollowStatus(raw);
}

export async function followUser(userId: string): Promise<FollowStatus> {
  const raw = await api.post<RawFollowStatus>(`/social/follows/${encodeURIComponent(userId)}`, {});
  return normalizeFollowStatus(raw);
}

export async function unfollowUser(userId: string): Promise<FollowStatus> {
  const raw = await api.delete<RawFollowStatus>(`/social/follows/${encodeURIComponent(userId)}`);
  return normalizeFollowStatus(raw);
}

export async function blockUser(userId: string): Promise<{ message: string; targetUser: SocialUserSummary }> {
  const raw = await api.post<RawBlockUserResponse>(`/social/blocks/${encodeURIComponent(userId)}`, {});
  return {
    message: raw.message,
    targetUser: {
      userId: raw.targetUser.userId ?? raw.targetUser.id ?? '',
      nickname: raw.targetUser.nickname,
      avatarUrl: raw.targetUser.avatarUrl,
    },
  };
}

export async function unblockUser(userId: string): Promise<{ message: string; targetUser: SocialUserSummary }> {
  const raw = await api.delete<RawBlockUserResponse>(`/social/blocks/${encodeURIComponent(userId)}`);
  return {
    message: raw.message,
    targetUser: {
      userId: raw.targetUser.userId ?? raw.targetUser.id ?? '',
      nickname: raw.targetUser.nickname,
      avatarUrl: raw.targetUser.avatarUrl,
    },
  };
}

export async function getFollowList(tab: FollowListTab): Promise<FollowListResponse> {
  const raw = await api.get<RawFollowListResponse>(`/social/follows?tab=${encodeURIComponent(tab)}`);
  return {
    tab: raw.tab,
    followingCount: raw.followingCount,
    followerCount: raw.followerCount,
    mutualCount: raw.mutualCount,
    users: raw.users.map((user) => ({
      userId: user.userId,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      signature: user.signature,
      followedAt: user.followedAt,
      relation: normalizeFollowStatus(user.relation),
    })),
  };
}

export async function getDirectMessageEligibility(userId: string): Promise<DirectMessageEligibility> {
  const raw = await api.get<RawDirectMessageEligibility>(`/social/messages/eligibility/${encodeURIComponent(userId)}`);
  return normalizeDirectMessageEligibility(raw);
}

export async function listDirectMessageConversations(): Promise<DirectMessageConversationListResponse> {
  const raw = await api.get<RawConversationListResponse>('/social/messages');
  return {
    conversations: raw.conversations.map((conversation) => ({
      conversationId: conversation.conversationId,
      userA: conversation.userA ? {
        userId: conversation.userA.userId ?? conversation.userA.id ?? '',
        nickname: conversation.userA.nickname,
        avatarUrl: conversation.userA.avatarUrl,
      } : undefined,
      userB: conversation.userB ? {
        userId: conversation.userB.userId ?? conversation.userB.id ?? '',
        nickname: conversation.userB.nickname,
        avatarUrl: conversation.userB.avatarUrl,
      } : undefined,
      partner: {
        userId: conversation.partner.userId ?? conversation.partner.id ?? '',
        nickname: conversation.partner.nickname,
        avatarUrl: conversation.partner.avatarUrl,
      },
      relation: normalizeFollowStatus(conversation.relation),
      unreadCount: conversation.unreadCount,
      lastMessage: conversation.lastMessage ? normalizeDirectMessage(conversation.lastMessage) : null,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      lastMessageAt: conversation.lastMessageAt,
    })),
  };
}

export async function getDirectMessageConversation(userId: string): Promise<DirectMessageConversationDetailResponse> {
  const raw = await api.get<RawConversationDetailResponse>(`/social/messages/${encodeURIComponent(userId)}`);
  return {
    conversation: raw.conversation,
    partner: {
      userId: raw.partner.userId ?? raw.partner.id ?? '',
      nickname: raw.partner.nickname,
      avatarUrl: raw.partner.avatarUrl,
    },
    relation: normalizeFollowStatus(raw.relation),
    eligibility: normalizeDirectMessageEligibility(raw.eligibility),
    messages: raw.messages.map(normalizeDirectMessage),
  };
}

export interface SendDirectMessagePayload {
  content?: string;
  imageUrls?: string[];
  voiceUrl?: string;
  voiceDurationSec?: number;
}

export async function sendDirectMessage(
  userId: string,
  payload: SendDirectMessagePayload,
): Promise<{
  message: string;
  conversationId: string;
  targetUser: SocialUserSummary;
  directMessage: DirectMessage;
}> {
  const raw = await api.post<RawSendDirectMessageResponse>(
    `/social/messages/${encodeURIComponent(userId)}`,
    payload,
  );
  return {
    message: raw.message,
    conversationId: raw.conversationId,
    targetUser: {
      userId: raw.targetUser.userId ?? raw.targetUser.id ?? '',
      nickname: raw.targetUser.nickname,
      avatarUrl: raw.targetUser.avatarUrl,
    },
    directMessage: normalizeDirectMessage(raw.directMessage),
  };
}

export async function recallDirectMessage(messageId: string): Promise<{
  message: string;
  directMessage: DirectMessage;
}> {
  const raw = await api.post<RawRecallDirectMessageResponse>(
    `/social/messages/${encodeURIComponent(messageId)}/recall`,
    {},
  );
  return {
    message: raw.message,
    directMessage: normalizeDirectMessage(raw.directMessage),
  };
}
