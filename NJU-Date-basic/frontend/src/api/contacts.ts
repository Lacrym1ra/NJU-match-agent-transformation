import { api } from './client';
import { CardSnapshotPreview } from './cardSnapshots';
import {
  buildContactUnlockRequestPayload,
  mapContactUnlockReply,
  mapContactUnlockRequest,
} from '../modules/contacts/unlockTransforms';

export interface SendContactUnlockRequestPayload {
  targetUserId: string;
  circleId?: string;
  sourceType: 'circle' | 'address_book';
  fieldKey?: string; // Ensure this is explicitly passed from the UI
  message?: string;
}

export type ContactUnlockRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'withdrawn'
  | 'expired'
  | 'revoked';

// [NEW]: Helper to handle 429 REQUEST_RATE_LIMITED errors with retryAt
export interface RateLimitedError extends Error {
  code: 'REQUEST_RATE_LIMITED';
  retryAt: string; // ISO timestamp
}

export interface ContactUnlockRequest {
  requestId: string;
  circleId?: string | null;
  circleName?: string | null;
  sourceType: 'circle' | 'address_book';
  fieldKey?: string;
  sourceLabel?: string;
  requester: {
    userId: string;
    nickname: string | null;
    avatarUrl: string | null;
  };
  cardPreview?: CardSnapshotPreview;
  message?: string | null;
  status: ContactUnlockRequestStatus;
  expiresAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
}

export interface ContactUnlockReply {
  requestId: string;
  circleId?: string | null;
  circleName?: string | null;
  sourceType: 'circle' | 'address_book';
  fieldKey?: string;
  sourceLabel?: string;
  target: {
    userId: string;
    nickname: string | null;
    avatarUrl: string | null;
  };
  status: Exclude<ContactUnlockRequestStatus, 'pending'>;
  message?: string | null;
  createdAt: string;
  expiresAt?: string | null;
  revokedAt?: string | null;
  respondedAt: string;
}

export interface ContactUnlockInboxItem {
  request_id: string;
  user_id: string;
  nickname: string;
  avatar_url?: string;
  message?: string;
  circle_id?: string;
  circle_name?: string;
  source_type: 'circle' | 'address_book';
  field_key?: string;
  source_label?: string;
  card_preview?: CardSnapshotPreview;
  status: ContactUnlockRequestStatus;
  expires_at?: string;
  revoked_at?: string;
  created_at: string;
}

export interface ContactUnlockReplyItem {
  request_id: string;
  user_id: string;
  nickname: string;
  avatar_url?: string;
  circle_id?: string;
  circle_name?: string;
  source_type: 'circle' | 'address_book';
  field_key?: string;
  source_label?: string;
  status: Exclude<ContactUnlockRequestStatus, 'pending'>;
  message?: string;
  created_at: string;
  expires_at?: string;
  revoked_at?: string;
  responded_at: string;
}

export interface ContactUnlockStatus {
  status: 'idle' | 'sent' | 'granted' | 'denied' | 'expired' | 'revoked' | 'blocked';
  requestId?: string;
  circleId?: string;
  sourceType?: 'circle' | 'address_book';
  fieldKey?: string;
  fieldKeys?: string[];
  pendingRequestId?: string;
  hasPendingRequest?: boolean;
}

export interface ContactModule {
  moduleKey: string;
  requestId?: string;
  sourceType?: 'circle' | 'address_book';
  fieldKey?: string;
  label: string;
  value: string;
}

export interface CircleContact {
  id: string;
  circleId: string;
  fieldKey: string;
  label: string;
  value: string;
  isEnabled: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CircleContactInput {
  fieldKey: string;
  label?: string;
  value: string;
  isEnabled?: boolean;
  displayOrder?: number;
}

export function sendContactUnlockRequest(payload: SendContactUnlockRequestPayload) {
  return api.post<{ requestId: string; fieldKey?: string; message: string }>(
    '/contacts/unlock-request',
    buildContactUnlockRequestPayload(payload),
  );
}

// [NEW]: Support withdrawal of requests
export function withdrawContactUnlockRequest(requestId: string) {
  return api.put<{ action: 'withdraw'; message: string }>(`/contacts/unlock-requests/${requestId}/withdraw`,{});
}

export function revokeContactUnlockRequest(requestId: string) {
  return api.post<{ requestId: string; status: 'revoked'; message: string }>(
    `/contacts/unlock-requests/${requestId}/revoke`,
    {},
  );
}

export function getContactUnlockRequests() {
  return api
    .get<{ requests: ContactUnlockRequest[]; replies?: ContactUnlockReply[] }>('/contacts/unlock-requests')
    .then((res) => ({
      requests: (res.requests || []).map(mapContactUnlockRequest),
      replies: (res.replies || []).map(mapContactUnlockReply),
    }));
}

export function approveContactUnlockRequest(requestId: string, contactIds?: string[]) {
  return api.put<{ action: 'approve'; message: string }>(`/contacts/unlock-requests/${requestId}`, {
    action: 'approve',
    ...(contactIds ? { contactIds } : {}),
  });
}

export function rejectContactUnlockRequest(requestId: string) {
  return api.put<{ action: 'reject'; message: string }>(`/contacts/unlock-requests/${requestId}`, {
    action: 'reject',
  });
}

export function getContactUnlockStatus(userId: string, circleId?: string) {
  const suffix = circleId ? `?circleId=${encodeURIComponent(circleId)}` : '';
  return api.get<ContactUnlockStatus>(`/contacts/status/${userId}${suffix}`);
}

export function getUnlockedContacts(userId: string, circleId?: string) {
  const suffix = circleId ? `?circleId=${encodeURIComponent(circleId)}` : '';
  return api.get<{ contacts: ContactModule[] }>(`/contacts/${userId}${suffix}`);
}

export function getCircleContacts(circleId: string) {
  return api.get<{ contacts: CircleContact[] }>(`/contacts/circles/${circleId}/settings`);
}

export function upsertCircleContact(circleId: string, payload: CircleContactInput) {
  return api.post<{ contact: CircleContact }>(`/contacts/circles/${circleId}/settings`, payload);
}

export function updateCircleContact(circleId: string, contactId: string, payload: Partial<CircleContactInput>) {
  return api.patch<{ contact: CircleContact }>(`/contacts/circles/${circleId}/settings/${contactId}`, payload);
}

export function deleteCircleContact(circleId: string, contactId: string) {
  return api.delete<{ message: string; contactId: string }>(`/contacts/circles/${circleId}/settings/${contactId}`);
}
