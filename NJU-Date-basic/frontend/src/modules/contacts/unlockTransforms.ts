import type {
  ContactUnlockInboxItem,
  ContactUnlockReply,
  ContactUnlockReplyItem,
  ContactUnlockRequest,
  SendContactUnlockRequestPayload,
} from '../../api/contacts';

export function mapContactUnlockRequest(raw: ContactUnlockRequest): ContactUnlockInboxItem {
  return {
    request_id: raw.requestId,
    user_id: raw.requester.userId,
    nickname: raw.requester.nickname || '神秘同窗',
    avatar_url: raw.requester.avatarUrl || undefined,
    message: raw.message || undefined,
    circle_id: raw.circleId || undefined,
    circle_name: raw.circleName || undefined,
    source_type: raw.sourceType,
    field_key: raw.fieldKey,
    source_label: raw.sourceLabel || (raw.sourceType === 'address_book' ? '同窗名录' : raw.circleName || undefined),
    card_preview: raw.cardPreview,
    status: raw.status,
    expires_at: raw.expiresAt || undefined,
    revoked_at: raw.revokedAt || undefined,
    created_at: raw.createdAt,
  };
}

export function mapContactUnlockReply(raw: ContactUnlockReply): ContactUnlockReplyItem {
  return {
    request_id: raw.requestId,
    user_id: raw.target.userId,
    nickname: raw.target.nickname || '神秘同窗',
    avatar_url: raw.target.avatarUrl || undefined,
    circle_id: raw.circleId || undefined,
    circle_name: raw.circleName || undefined,
    source_type: raw.sourceType,
    field_key: raw.fieldKey,
    source_label: raw.sourceLabel || (raw.sourceType === 'address_book' ? '同窗名录' : raw.circleName || undefined),
    status: raw.status,
    message: raw.message || undefined,
    created_at: raw.createdAt,
    expires_at: raw.expiresAt || undefined,
    revoked_at: raw.revokedAt || undefined,
    responded_at: raw.respondedAt,
  };
}

export function buildContactUnlockRequestPayload(payload: SendContactUnlockRequestPayload): SendContactUnlockRequestPayload {
  return payload.sourceType === 'circle' && !payload.fieldKey
    ? { ...payload, fieldKey: 'contact_primary' }
    : payload;
}
