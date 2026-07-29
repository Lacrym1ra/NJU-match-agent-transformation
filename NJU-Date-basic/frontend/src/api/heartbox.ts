import { api } from './client';

export type HeartboxState =
  | 'empty'
  | 'active_waiting'
  | 'matched'
  | 'queued'
  | 'error';

export interface HeartboxMeResponse {
  hasActiveSignal: boolean;
  cooldownUntil: string | null;
  signal: null | {
    targetStudentIdMasked: string;
    status: string;
    createdAt: string;
  };
  incomingHint: { hasIncoming: boolean; copy: string };
  latestHeartboxMatch: null | {
    id: string;
    status: string;
    mainMatchId: string | null;
    updatedAt: string;
  };
}

export type HeartboxSignalResponse =
  | { success: true; status: 'saved' }
  | { success: true; status: 'matched'; heartMatchId: string; source: 'heartbox'; matchStatus: 'MUTUAL'; scoreVisible: false; specialLabel: string };

export interface HeartboxRevealResponse {
  heartMatchId: string;
  status: string;
  specialLabel: string;
  createdAt: string | null;
  updatedAt: string | null;
  legacyMainMatchId: string | null;
  partner: {
    id: string;
    nickname: string | null;
    gender: string | null;
    department: string | null;
    grade: string | null;
    campus: string | null;
    mbti: string | null;
    bio: string | null;
    avatarUrl: string | null;
  };
  partnerContact: {
    contactPlatform: string;
    contactId: string;
  };
  note: string;
}

export const getHeartboxMe = () => api.get<HeartboxMeResponse>('/heartbox/me');

export const getCurrentHeartboxReveal = () =>
  api.get<HeartboxRevealResponse>('/heartbox/match/current');

export const submitHeartboxSignal = (targetStudentId: string) =>
  api.post<HeartboxSignalResponse>('/heartbox/signal', { targetStudentId });

export const cancelHeartboxSignal = () =>
  api.delete<{ success: true }>('/heartbox/signal');
