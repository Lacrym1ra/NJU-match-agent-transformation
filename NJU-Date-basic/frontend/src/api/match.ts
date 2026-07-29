import { api } from './client';

export interface MatchPartner {
  id?: string;
  nickname: string;
  gender: string | null;
  department: string;
  grade: string;
  campus: string;
  mbti: string;
  bio: string;
  avatarUrl: string | null;
}

export interface DimensionInsight {
  dimension: string;
  label: string;
  score: number;
  text: string;
}

export interface MatchInsights {
  overallPercent: number | null;
  dimensions: {
    values?: number;
    lifestyle?: number;
    emotional?: number;
    [key: string]: number | undefined;
  };
  dimensionInsights: DimensionInsight[];
  sharedInterests: string[];
  curatorNote: string;
}

export interface CurrentMatch {
  matchId: string;
  source?: 'weekly' | 'heartbox';
  specialLabel?: string | null;
  scoreVisible?: boolean;
  compatibilityScore: number | null;
  partner: MatchPartner;
  insights: MatchInsights;
  myAction: 'ACCEPT' | 'REJECT' | null;
  partnerActed: boolean;
}

export interface CurrentMatchResponse {
  status: 'WAITING' | 'PENDING' | 'NO_MATCH' | 'REVEALED' | 'EXPIRED';
  revealAt?: string;
  nextRevealAt?: string;
  message?: string;
  match?: CurrentMatch;
}

export interface MatchHistoryItem {
  matchId: string;
  weekOf: string;
  compatibilityScore: number | null;
  status: 'LOCKED' | 'REVEALED' | 'MUTUAL' | 'MISSED' | 'EXPIRED' | 'NO_MATCH';
  partner: Pick<MatchPartner, 'id' | 'nickname' | 'department' | 'avatarUrl'> | null;
}

export interface MatchHistoryResponse {
  total: number;
  page: number;
  matches: MatchHistoryItem[];
}

export interface MatchResultResponse {
  status: 'WAITING' | 'MUTUAL' | 'MISSED' | 'EXPIRED';
  partnerContact?: {
    contactPlatform?: string;
    contactId?: string;
    wechatId?: string;
  };
  message: string;
}

export const getCurrentMatch = () => api.get<CurrentMatchResponse>('/match/current');

export const submitAction = (matchId: string, action: 'ACCEPT' | 'REJECT') =>
  api.post<{ action: string; message: string }>('/match/action', { matchId, action });

export const getMatchResult = (matchId: string) =>
  api.get<MatchResultResponse>(`/match/result/${matchId}`);

export const getMatchHistory = (page = 1, limit = 10) =>
  api.get<MatchHistoryResponse>(`/match/history?page=${page}&limit=${limit}`);
