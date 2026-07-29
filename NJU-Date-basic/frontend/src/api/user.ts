import { api } from './client';

type GenderPref = 'male' | 'female' | 'any' | '';

interface RawUserProfile {
  id: string;
  email: string;
  nickname?: string | null;
  gender?: 'male' | 'female' | '' | null;
  genderPref?: GenderPref;
  genderPreference?: GenderPref;
  intention?: 'friend' | 'partner' | '' | null;
  grade?: string | null;
  campus?: 'xianlin' | 'gulou' | 'suzhou' | 'pukou' | '' | null;
  department?: string | null;
  mbti?: string | null;
  bio?: string | null;
  signature?: string | null;
  tags?: string[] | null;
  avatarUrl?: string | null;
  contactPlatform?: string;
  contactId?: string;
  isParticipating: boolean;
  pauseUntilWeek?: string | null;
  emailNotifications?: boolean;
  creditScore?: number | null;
  profileComplete: boolean;
  surveyComplete: boolean;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  email: string;
  nickname: string;
  gender: 'male' | 'female' | '';
  genderPref: GenderPref;
  genderPreference: GenderPref;
  intention: 'friend' | 'partner' | '';
  grade: string;
  campus: 'xianlin' | 'gulou' | 'suzhou' | 'pukou' | '';
  department: string;
  mbti: string;
  bio: string;
  signature: string;
  tags: string[];
  avatarUrl: string | null;
  contactPlatform?: string;
  contactId?: string;
  isParticipating: boolean;
  pauseUntilWeek?: string | null;
  emailNotifications: boolean;
  creditScore: number;
  profileComplete: boolean;
  surveyComplete: boolean;
  createdAt: string;
}

function normalizeProfile(raw: RawUserProfile): UserProfile {
  const pref = (raw.genderPref ?? raw.genderPreference ?? '') as GenderPref;
  return {
    ...raw,
    nickname: raw.nickname ?? '',
    gender: (raw.gender ?? '') as UserProfile['gender'],
    intention: (raw.intention ?? '') as UserProfile['intention'],
    grade: raw.grade ?? '',
    campus: (raw.campus ?? '') as UserProfile['campus'],
    department: raw.department ?? '',
    mbti: raw.mbti ?? '',
    bio: raw.bio ?? '',
    signature: raw.signature ?? '',
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    avatarUrl: raw.avatarUrl ?? null,
    genderPref: pref,
    genderPreference: pref,
    emailNotifications: raw.emailNotifications ?? true,
    creditScore: raw.creditScore ?? 100,
  };
}

export interface UserStats {
  creditScore: number;
  receivedLikes: number;
  receivedFavorites: number;
}

export interface CreditStatus {
  creditScore: number;
  status: 'cooldown' | 'recovering' | 'full';
  daysToRecoveryStart: number;
}

export type DirectMessagePrivacySetting = 'all' | 'following' | 'mutual' | 'none';

export interface ProfileUpdatePayload {
  nickname?: string;
  gender?: 'male' | 'female';
  genderPref?: 'male' | 'female' | 'any';
  intention?: 'friend' | 'partner';
  grade?: string;
  campus?: 'xianlin' | 'gulou' | 'suzhou' | 'pukou';
  department?: string;
  mbti?: string;
  bio?: string;
  signature?: string;
  tags?: string[];
  contactPlatform?: string;
  contactId?: string;
  emailNotifications?: boolean;
}

export type ProfileDraftPayload = Pick<
  ProfileUpdatePayload,
  'nickname' | 'gender' | 'genderPref' | 'intention' | 'grade' | 'campus' | 'department' | 'mbti' | 'signature' | 'tags'
>;

export const getProfile = async () => {
  const raw = await api.get<RawUserProfile>('/user/profile');
  return normalizeProfile(raw);
};

export const getUserStats = () => api.get<UserStats>('/user/stats');
export const getCreditStatus = () => api.get<CreditStatus>('/user/credit-status');

export const updateProfile = async (data: ProfileUpdatePayload) => {
  const raw = await api.put<RawUserProfile>('/user/profile', data);
  return normalizeProfile(raw);
};

export const updateProfileDraft = async (data: ProfileDraftPayload) => {
  const raw = await api.patch<RawUserProfile>('/user/profile/draft', data);
  return normalizeProfile(raw);
};

export const updateStatus = (isParticipating: boolean) =>
  api.patch<{ isParticipating: boolean; message: string }>('/user/status', { isParticipating });

export const pauseWeek = (pause: boolean) =>
  api.patch<{ pauseUntilWeek: string | null; message: string }>('/user/pause-week', { pause });

export const updateNotifications = (emailNotifications: boolean) =>
  api.patch<{ emailNotifications: boolean; message: string }>('/user/notifications', { emailNotifications });

export const updateSignature = (signature: string) =>
  api.patch<{ signature: string | null }>('/user/profile/signature', { signature });

export const updateTags = (tags: string[]) =>
  api.patch<{ tags: string[] }>('/user/profile/tags', { tags });

export const deleteAccount = () => api.delete<{ message: string }>('/user/account');

export const getMessagePrivacySetting = () =>
  api.get<{ allowDirectMessagesFrom: DirectMessagePrivacySetting }>('/social/messages/privacy');

export const updateMessagePrivacySetting = (allowDirectMessagesFrom: DirectMessagePrivacySetting) =>
  api.put<{ message: string; allowDirectMessagesFrom: DirectMessagePrivacySetting }>(
    '/social/messages/privacy',
    { allowDirectMessagesFrom },
  );

// ─── Notifications ────────────────────────────────────────────

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  content: string;
  meta: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationListResponse {
  total: number;
  page: number;
  limit: number;
  notifications: NotificationItem[];
}

export function getNotifications(params?: {
  page?: number;
  limit?: number;
  isRead?: boolean;
  type?: string;
}) {
  const sp = new URLSearchParams();
  if (params?.page) sp.set('page', String(params.page));
  if (params?.limit) sp.set('limit', String(params.limit));
  if (params?.isRead !== undefined) sp.set('isRead', String(params.isRead));
  if (params?.type) sp.set('type', params.type);
  const qs = sp.toString();
  return api.get<NotificationListResponse>(`/user/notifications${qs ? `?${qs}` : ''}`);
}

export function getUnreadNotificationCount() {
  return api.get<{ unreadCount: number }>('/user/notifications/unread-count');
}

export function markNotificationRead(notificationId: string) {
  return api.patch<{ message: string }>(
    `/user/notifications/${encodeURIComponent(notificationId)}/read`,
    {},
  );
}

export function markAllNotificationsRead() {
  return api.patch<{ message: string }>('/user/notifications/read-all', {});
}
