import { api } from './client';
import { Circle } from './circles';

// ==========================================
// 1. 原有的核心 Admin 系统运维逻辑 (严格保留)
// ==========================================
interface AdminHeaders {
  'X-Admin-Key': string;
}

function getAdminHeaders(adminKey: string): Record<string, string> {
  return {
    'X-Admin-Key': adminKey,
  };
}

export interface TriggerMatchingResponse {
  message: string;
  stats: {
    totalParticipants: number;
    matchedPairs: number;
    unmatched: number;
    matchRate: number;
    avgCompatibilityScore: number;
    weightLoss: number;
  };
}

export interface UnlockRevealResponse {
  message: string;
  unlockedCount: number;
}

export function triggerMatching(adminKey: string) {
  return api.postWithHeaders<TriggerMatchingResponse>(
    '/admin/trigger-matching',
    {},
    getAdminHeaders(adminKey),
  );
}

export function unlockReveal(adminKey: string) {
  return api.postWithHeaders<UnlockRevealResponse>(
    '/admin/unlock-reveal',
    {},
    getAdminHeaders(adminKey),
  );
}

// ==========================================
// 2. 新增的 A/B 区名片组件库管理类型
// ==========================================

export interface BaseCardComponent {
  id?: string;
  key: string;
  name: string;
  sourceType: 'user_profile' | 'survey_answer' | 'manual';
  sourceKey: string | null;
  _isNew?: boolean;       
  _originalKey?: string;  
}

// ⚠️ 保证 CircleCardComponent 在接口方法之前定义，解决报错！
export interface CircleCardComponent {
  id?: string;
  circleId?: string;
  key: string;
  type: string; 
  prompt: string; 
  options: string[]; 
  weight: number;
  displayOrder: number;
  isChannelTag: boolean;
  _isNew?: boolean;
  _originalKey?: string;
}

export interface CustomProposal {
  id: string;
  circleId: string;
  circleName: string;
  label: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

// ==========================================
// 3. A 区：全局组件库 API
// ==========================================

export const getBaseCardComponents = async () => {
  return await api.get<{ components: BaseCardComponent[] }>('/admin/base-card-components');
};

export const updateBaseCardComponents = async (components: BaseCardComponent[]) => {
  return await api.put<{ message: string }>('/admin/base-card-components', { components });
};

// ==========================================
// 4. B 区：圈子专属组件库 API
// ==========================================

export const getCircleCardComponents = async (circleId: string) => {
  return await api.get<{ circleId: string; components: CircleCardComponent[] }>(`/admin/circles/${circleId}/card-components`);
};

export const updateCircleCardComponents = async (circleId: string, components: CircleCardComponent[]) => {
  return await api.put<{ message: string; circleId: string }>(`/admin/circles/${circleId}/card-components`, { components });
};

export const getAllCirclesForAdmin = async () => {
  return await api.get<{ circles: Circle[] }>('/admin/circles');
};

// ==========================================
// 5. C 区：UGC 自定义名片维度审核逻辑
// ==========================================

export const getCustomProposals = async () => {
  return await api.get<{ proposals: CustomProposal[] }>('/admin/custom-proposals/pending');
};

// ⚠️ 这里的 CircleCardComponent 不会再报错了
export const approveCustomProposal = async (proposalId: string, componentData: Partial<CircleCardComponent>) => {
  return await api.post<{ message: string }>(`/admin/custom-proposals/${proposalId}/approve`, componentData);
};

export const rejectCustomProposal = async (proposalId: string) => {
  return await api.post<{ message: string }>(`/admin/custom-proposals/${proposalId}/reject`, {});
};

// ==========================================
// 6. 论坛公告管理 API
// ==========================================

export interface AdminAnnouncement {
  id: string;
  title: string;
  content: string;
  createdBy: string;
  isActive: boolean;
  priority: number;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}

export interface AnnouncementListResponse {
  total: number;
  page: number;
  limit: number;
  announcements: AdminAnnouncement[];
}

export const getAdminAnnouncements = async (params: {
  page?: number;
  limit?: number;
  isActive?: string;
}) => {
  const sp = new URLSearchParams();
  if (params.page) sp.set('page', String(params.page));
  if (params.limit) sp.set('limit', String(params.limit));
  if (params.isActive) sp.set('isActive', params.isActive);
  const qs = sp.toString();
  return await api.get<AnnouncementListResponse>(`/admin/forum/announcements${qs ? `?${qs}` : ''}`);
};

export const createAdminAnnouncement = async (data: {
  title: string;
  content: string;
  isActive?: boolean;
  priority?: number;
  startsAt?: string | null;
  endsAt?: string | null;
}) => {
  return await api.post<{ announcementId: string; message: string }>(
    '/admin/forum/announcements',
    data,
  );
};

export const updateAdminAnnouncement = async (
  id: string,
  data: Partial<{
    title: string;
    content: string;
    isActive: boolean;
    priority: number;
    startsAt: string | null;
    endsAt: string | null;
  }>,
) => {
  return await api.patch<{ message: string; announcementId: string }>(
    `/admin/forum/announcements/${encodeURIComponent(id)}`,
    data,
  );
};

export const deleteAdminAnnouncement = async (id: string) => {
  return await api.delete<{ message: string }>(
    `/admin/forum/announcements/${encodeURIComponent(id)}`,
  );
};
