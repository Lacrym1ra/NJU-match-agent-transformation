export type ResonanceState = 'awaiting_participant' | 'collecting' | 'revealed';

export interface ResonancePolicyRecord {
  id: string;
  creatorId: string;
  participantId: string | null;
  creatorResponse: string | null;
  participantResponse: string | null;
  status: string;
  title: string;
  prompt: string;
}

export function normalizeInviteCode(value: string) {
  const normalized = value.trim().toUpperCase().replaceAll('-', '');
  if (!/^[A-Z2-9]{8}$/.test(normalized)) {
    throw new Error('邀请码应为 8 位字母或数字');
  }
  return normalized;
}

export function validateResonanceResponse(value: string) {
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > 2_000) {
    throw new Error('回应应为 1–2000 个字符');
  }
  return normalized;
}

export function deriveResonanceState(
  creatorResponse: string | null,
  participantResponse: string | null,
  hasParticipant: boolean,
): ResonanceState {
  if (!hasParticipant) return 'awaiting_participant';
  if (creatorResponse && participantResponse) return 'revealed';
  return 'collecting';
}

export function redactResonanceCapsule(record: ResonancePolicyRecord, viewerId: string) {
  const isCreator = record.creatorId === viewerId;
  const isParticipant = record.participantId === viewerId;
  if (!isCreator && !isParticipant) throw new Error('无权查看该共鸣胶囊');
  const isRevealed = record.status === 'revealed'
    && Boolean(record.creatorResponse && record.participantResponse);
  return {
    isRevealed,
    myResponse: isRevealed
      ? (isCreator ? record.creatorResponse : record.participantResponse)
      : null,
    otherResponse: isRevealed
      ? (isCreator ? record.participantResponse : record.creatorResponse)
      : null,
    hasResponded: Boolean(isCreator ? record.creatorResponse : record.participantResponse),
    otherHasResponded: Boolean(isCreator ? record.participantResponse : record.creatorResponse),
  };
}
