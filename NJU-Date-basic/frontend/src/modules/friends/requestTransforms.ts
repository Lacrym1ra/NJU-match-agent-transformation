import type {
  AcceptedFriendRequest,
  FriendRequest,
  FriendRequestReplyStatus,
  FriendRequestStatus,
  SentFriendRequest,
} from '../../api/friends';

export interface RawFriendRequest {
  requestId: string;
  sender?: any;
  createdAt?: string;
  status?: FriendRequestStatus;
  [key: string]: any;
}

export interface RawAcceptedFriendRequest {
  requestId: string;
  target?: any;
  responder?: any;
  status: FriendRequestReplyStatus;
  createdAt?: string;
  respondedAt?: string;
  [key: string]: any;
}

export interface RawSentFriendRequest {
  requestId: string;
  target?: any;
  receiver?: any;
  user?: any;
  createdAt?: string;
  status?: FriendRequestStatus;
  [key: string]: any;
}

export function mapFriendRequest(raw: RawFriendRequest): FriendRequest {
  return {
    request_id: raw.requestId,
    user_id: raw.sender?.userId || raw.userId,
    nickname: raw.sender?.nickname || raw.nickname,
    avatar_url: raw.sender?.avatarUrl || raw.avatarUrl,
    gender: raw.sender?.gender || raw.gender,
    message: raw.message,
    circle_id: raw.circleId || raw.circle_id,
    circle_name: raw.circleName || raw.circle_name,
    card_preview: raw.cardPreview || raw.card_preview,
    status: raw.status || 'pending',
    expires_at: raw.expiresAt || raw.expires_at,
    created_at: raw.createdAt || raw.created_at,
  };
}

export function mapAcceptedFriendRequest(raw: RawAcceptedFriendRequest): AcceptedFriendRequest {
  const responder = raw.responder || raw.target || {};
  return {
    request_id: raw.requestId,
    user_id: responder.userId || raw.userId,
    nickname: responder.nickname || raw.nickname,
    avatar_url: responder.avatarUrl || raw.avatarUrl,
    circle_id: raw.circleId || raw.circle_id,
    circle_name: raw.circleName || raw.circle_name,
    card_preview: raw.cardPreview || raw.card_preview,
    status: raw.status,
    created_at: raw.createdAt || raw.created_at,
    expires_at: raw.expiresAt || raw.expires_at,
    accepted_at: raw.acceptedAt || raw.accepted_at,
    responded_at: raw.respondedAt || raw.responded_at,
  };
}

export function mapSentFriendRequest(raw: RawSentFriendRequest): SentFriendRequest {
  const target = raw.target || raw.receiver || raw.user || {};
  return {
    request_id: raw.requestId,
    user_id: target.userId || raw.userId || raw.targetUserId || raw.receiverId,
    nickname: target.nickname || raw.nickname || '神秘同窗',
    avatar_url: target.avatarUrl || raw.avatarUrl,
    message: raw.message,
    circle_id: raw.circleId || raw.circle_id,
    circle_name: raw.circleName || raw.circle_name,
    card_preview: raw.cardPreview || raw.card_preview,
    status: raw.status || 'pending',
    expires_at: raw.expiresAt || raw.expires_at,
    created_at: raw.createdAt || raw.created_at,
  };
}
