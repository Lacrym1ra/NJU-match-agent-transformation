import { api } from './client'; 
import { CardSnapshotPreview } from './cardSnapshots';
import {
    RawAcceptedFriendRequest,
    RawFriendRequest,
    RawSentFriendRequest,
    mapAcceptedFriendRequest,
    mapFriendRequest,
    mapSentFriendRequest,
} from '../modules/friends/requestTransforms';

// ================= 类型定义 =================
export type FriendRequestStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'expired';
export type FriendRequestReplyStatus = Exclude<FriendRequestStatus, 'pending'>;

export interface SendFriendRequestPayload {
    targetUserId: string;
    circleId: string;
    message?: string;
}

export interface FriendRequest {
    request_id: string; 
    user_id: string; 
    nickname: string;
    avatar_url?: string;
    gender?: string;
    message?: string; 
    circle_id?: string; 
    circle_name?: string;
    card_preview?: CardSnapshotPreview;
    status: FriendRequestStatus;
    expires_at?: string;
    created_at: string;
}

export interface SentFriendRequest {
    request_id: string;
    user_id: string;
    nickname: string;
    avatar_url?: string;
    message?: string;
    circle_id?: string;
    circle_name?: string;
    card_preview?: CardSnapshotPreview;
    status: FriendRequestStatus;
    expires_at?: string;
    created_at: string;
}

export interface AcceptedFriendRequest {
    request_id: string;
    user_id: string;
    nickname: string;
    avatar_url?: string;
    circle_id?: string;
    circle_name?: string;
    card_preview?: CardSnapshotPreview;
    status: FriendRequestReplyStatus;
    created_at: string;
    expires_at?: string;
    accepted_at?: string;
    responded_at: string;
}

export interface GroupedFriendCircle {
    circleId: string;
    circleName: string;
    friendSince: string;
}

export interface GroupedFriend {
    userId: string;
    nickname: string;
    avatarUrl?: string;
    friendSince: string;
    circleCount: number;
    circles: GroupedFriendCircle[];
    contactStatus: 'idle' | 'sent' | 'granted';
    contactCircleId?: string;
    contactSourceType?: 'circle' | 'address_book';
    contactFieldKey?: string;
    revocableContactRequestId?: string;
    hasUnlockedContacts: boolean;
}

export interface DeleteFriendResult {
    message: string;
    circleId?: string;
    removedCircleCount: number;
    remainingCircleCount: number;
    revokedGlobalFriendshipCount?: number;
    deletedContactUnlockCount?: number;
    removedCircleIds?: string[];
    // Legacy mock/compat fields kept optional while the backend returns counts.
    isDeletedEverywhere?: boolean;
    remainingCircles?: string[];
}

// ================= API 方法 =================

/**
 * 1. 发送好友申请 (POST /friends/requests)
 */
 export function sendFriendRequest(payload: SendFriendRequestPayload) {
      return api.post<{ requestId: string; message: string }>('/friends/requests', payload);
 }

/**
 * 2. 获取当前登录用户收到的所有待处理好友申请 (GET /friends/requests)
 */
 export function getPendingRequests() {
      return api
        .get<{
            requests: RawFriendRequest[];
            acceptedRequests?: RawAcceptedFriendRequest[];
            sentRequests?: RawSentFriendRequest[];
            sent_requests?: RawSentFriendRequest[];
        }>('/friends/requests')
        .then((res) => ({
            requests: (res.requests || []).map(mapFriendRequest),
            acceptedRequests: (res.acceptedRequests || []).map(mapAcceptedFriendRequest),
            sentRequests: (res.sentRequests || res.sent_requests || []).map(mapSentFriendRequest),
        }));
 }

export function getGroupedFriends() {
    return api.get<{ friends: GroupedFriend[] }>('/friends/grouped');
}

export function deleteFriendInCircle(friendId: string, circleId: string) {
    return api.delete<DeleteFriendResult>(`/friends/${encodeURIComponent(friendId)}?circleId=${encodeURIComponent(circleId)}`);
}

export function deleteFriendEverywhere(friendId: string) {
    return api.delete<DeleteFriendResult>(`/friends/${encodeURIComponent(friendId)}/all`);
}

/**
 * 3. 接受好友申请 (PUT /friends/requests/:requestId)
 */
 export function acceptFriendRequest(requestId: string) {
      return api.put<{ message: string }>(`/friends/requests/${requestId}`, {
        action: 'accept'
      });
 }

/**
 * 4. 拒绝好友申请 (PUT /friends/requests/:requestId)
 */
 export function rejectFriendRequest(requestId: string) {
      return api.put<{ message: string }>(`/friends/requests/${requestId}`, {
        action: 'reject'
      });
 }

// ================= [NEW]: 状态补齐与安全增强接口 =================

// [NEW]: Withdraw an accidental friend request
export function withdrawFriendRequest(requestId: string) {
    return api.put<{ message: string }>(`/friends/requests/${requestId}/withdraw`, {});
}

// [NEW]: Silent rejection (declines without notifying the sender)
export function silentRejectFriendRequest(requestId: string) {
    return api.put<{ message: string }>(`/friends/requests/${requestId}/silent-reject`, {});
}

// [NEW]: Block a user
export function blockUser(targetUserId: string) {
    return api.post<{ message: string }>(`/users/${targetUserId}/block`, {});
}
