// frontend/src/api/circles.ts

import { api } from './client';

export type JoinPolicyMode = 'public' | 'review' | 'invite';
export type CircleJoinRequestStatus = 'pending_review' | 'approved' | 'rejected' | 'expired' | 'withdrawn';
export type CircleViewerRole = 'owner' | 'admin' | 'moderator' | null;

export interface CircleViewerPermissions {
  canManage?: boolean;
  canEdit?: boolean;
  canReviewJoinRequests?: boolean;
  canManageMembers?: boolean;
  canManageBlacklist?: boolean;
  canTransferOwner?: boolean;
  canDissolve?: boolean;
  canViewManage?: boolean;
  canPostAsMember?: boolean;
}

export interface Circle {
  id: string;
  name: string;
  slug?: string;
  description: string;
  category?: string; // 核心分类大类字段
  tag?: string;      // 后端保留的tag字段(暂不用于前端核心分类)
  tags?: string[];
  image?: string;
  iconUrl?: string | null;
  creatorId?: string | null;
  memberCount: number;
  isActive?: boolean;
  status?: 'active' | 'inactive' | 'pending_review' | 'rejected' | 'banned' | 'archived';
  reviewNote?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  isJoined: boolean;
  membershipStatus?: 'pending' | 'active' | null;
  joinPolicy?: JoinPolicyMode | { mode: JoinPolicyMode }; // [NEW]: Added join policy for custom circles
  joinQuestions?: Array<{ id: string; question: string; required: boolean }>;
  capacityLimit?: number | null;
  hasInviteCode?: boolean;
  viewerRole?: CircleViewerRole;
  viewerPermissions?: CircleViewerPermissions;
}

// [NEW]: Payload for Custom Circle Creation
export interface CreateCirclePayload {
  name: string;
  slug?: string;
  description: string;
  category: string;
  tags?: string[];
  iconUrl?: string;
  joinPolicy?: JoinPolicyMode | { mode: JoinPolicyMode };
  joinQuestion?: string | null;
  joinQuestions?: Array<{ id?: string; question: string; required?: boolean }>;
  capacityLimit?: number | null;
  keywordRules?: Array<{ keyword: string; action?: 'reject' }>;
}

export interface Question {
  id?: string;
  key: string;
  type: string;
  prompt: string;
  options: string[];
  weight: number;
  displayOrder: number;
  isChannelTag?: boolean;
}

export interface ChannelMember {
  userId: string;
  nickname: string | null;
  avatarUrl?: string | null;
  channelTags: Array<{ key: string; label: string; value: string }>;
  distanceBucket?: string;
  distanceText?: string;
  locationUpdatedAt?: string | null;
  username?: string;
  avatar?: string;
  bio?: string;
  [key: string]: any;
}

export interface ManagedCircle extends Omit<Circle, 'joinPolicy'> {
  joinPolicy: JoinPolicyMode;
  joinQuestion?: string | null;
  keywordRules?: Array<{ keyword: string; action: 'reject' }>;
  inviteCode?: string;
}

export interface CircleJoinRequest {
  id: string;
  circleId: string;
  applicationAnswer?: string | null;
  applicationAnswers?: Record<string, string> | null;
  applicationReason?: string | null;
  status: CircleJoinRequestStatus;
  rejectReason?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  applicant: {
    userId: string;
    nickname: string | null;
    avatarUrl: string | null;
    department: string | null;
    grade: string | null;
  };
}

export interface CircleManageOverview {
  circle: ManagedCircle;
  counts: {
    members: number;
    pendingJoinRequests: number;
    blacklist: number;
  };
}

export interface CircleManageMember {
  userId: string;
  role: CircleViewerRole | 'member';
  membershipStatus: 'pending' | 'active' | null;
  isActive: boolean;
  joinedAt?: string | null;
  profile: {
    nickname: string | null;
    avatarUrl: string | null;
    department: string | null;
    grade: string | null;
  };
}

export interface CircleManageMembersResponse {
  total: number;
  page: number;
  limit: number;
  members: CircleManageMember[];
}

export interface CircleJoinRequestsResponse {
  total: number;
  page: number;
  limit: number;
  requests: CircleJoinRequest[];
}

export interface SentCircleJoinRequest {
  id: string;
  circleId: string;
  circleName: string;
  applicationAnswer?: string | null;
  applicationAnswers?: Record<string, string> | null;
  applicationReason?: string | null;
  status: CircleJoinRequestStatus;
  rejectReason?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface CircleLocationStatus {
  enabled: boolean;
  hasValidLocation: boolean;
  accuracyMeters?: number;
  lastUpdatedAt?: string;
  expiresAt?: string;
  message?: string;
}

export interface UpdateCircleLocationPayload {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  capturedAt?: string;
}

export interface ChannelMembersOptions {
  nearby?: boolean;
  radiusMeters?: number;
  includeUnknownDistance?: boolean;
}

export interface ChannelMembersResponse {
  members: ChannelMember[];
  total: number;
  page?: number;
  limit?: number;
  nearby?: {
    enabled: boolean;
    originUpdatedAt?: string;
    radiusMeters?: number;
  };
}

export interface JoinCirclePayload {
  inviteCode?: string;
  answer?: string;
  answers?: Record<string, string> | Array<{ questionId: string; value: string }>;
  applicationReason?: string;
}

export interface JoinCircleResponse {
  message: string;
  circleId: string;
  memberId?: string;
  requestId?: string;
  membershipStatus?: 'pending' | 'active';
  requestStatus?: CircleJoinRequestStatus;
  expiresAt?: string;
}

export interface CircleCardModule {
  moduleKey: string;
  value: string | string[];
  // 【修复 1】：将此处的类型对齐为后端真实的 'public' | 'hidden' | 'deleted'
  visibilityLevel: 'public' | 'hidden' | 'deleted';
  displayOrder?: number;
  label?: string;
}

type RawCardStatus = 'public' | 'hidden' | 'deleted';

interface RawCircleCardComponent {
  key: string;
  name: string;
  value: unknown;
  topLeft?: [number, number];
  width?: number;
  height?: number;
  status?: RawCardStatus;
}

interface RawCircleCardGroups {
  public?: RawCircleCardComponent[];
  hidden?: RawCircleCardComponent[];
  deleted?: RawCircleCardComponent[];
}

interface RawCircleCardResponse {
  view: 'edit';
  userId: string;
  circleId: string;
  initialized: boolean;
  nickname: string;
  avatarUrl?: string | null;
  card: {
    base: RawCircleCardGroups;
    circle: RawCircleCardGroups;
    custom: RawCircleCardGroups;
  };
  customItems?: unknown[];
}

function sortByLayout(a: RawCircleCardComponent, b: RawCircleCardComponent) {
  const [ax, ay] = a.topLeft ?? [0, 0];
  const [bx, by] = b.topLeft ?? [0, 0];
  return ay - by || ax - bx || a.key.localeCompare(b.key);
}

function flattenCircleModules(groups: RawCircleCardGroups): CircleCardModule[] {
  const publicModules = (groups.public ?? []).map((component) => ({
    moduleKey: component.key,
    label: component.name,
    value: Array.isArray(component.value) ? component.value.map(String) : String(component.value ?? ''),
    visibilityLevel: 'public' as const,
  }));
  // 【修复 2】：正确映射 hidden
  const hiddenModules = (groups.hidden ?? []).map((component) => ({
    moduleKey: component.key,
    label: component.name,
    value: Array.isArray(component.value) ? component.value.map(String) : String(component.value ?? ''),
    visibilityLevel: 'hidden' as const,
  }));
  // 【修复 3】：正确映射 deleted，不再错误地归类为 'public'
  const deletedModules = (groups.deleted ?? []).map((component) => ({
    moduleKey: component.key,
    label: component.name,
    value: Array.isArray(component.value) ? component.value.map(String) : String(component.value ?? ''),
    visibilityLevel: 'deleted' as const,
  }));

  return [...publicModules, ...hiddenModules, ...deletedModules]
    .sort((a, b) => {
      const rawA = [...(groups.public ?? []), ...(groups.hidden ?? []), ...(groups.deleted ?? [])]
        .find((component) => component.key === a.moduleKey);
      const rawB = [...(groups.public ?? []), ...(groups.hidden ?? []), ...(groups.deleted ?? [])]
        .find((component) => component.key === b.moduleKey);
      if (!rawA || !rawB) return a.moduleKey.localeCompare(b.moduleKey);
      return sortByLayout(rawA, rawB);
    })
    .map((module, index) => ({ ...module, displayOrder: index }));
}

function toRawStatus(visibilityLevel: CircleCardModule['visibilityLevel']): RawCardStatus {
  return visibilityLevel;
}

function buildCirclePayload(modules: CircleCardModule[]) {
  const components = {
    public: [] as Array<{
      key: string;
      name: string;
      value: unknown;
      topLeft: [number, number];
      width: number;
      height: number;
      status: RawCardStatus;
    }>,
    hidden: [] as Array<{
      key: string;
      name: string;
      value: unknown;
      topLeft: [number, number];
      width: number;
      height: number;
      status: RawCardStatus;
    }>,
    deleted: [] as Array<{
      key: string;
      name: string;
      value: unknown;
      topLeft: [number, number];
      width: number;
      height: number;
      status: RawCardStatus;
    }>,
  };

  modules.forEach((module, index) => {
    const status = toRawStatus(module.visibilityLevel);
    components[status].push({
      key: module.moduleKey,
      name: module.label || module.moduleKey,
      value: module.value,
      topLeft: [0, index],
      width: 1,
      height: 1,
      status,
    });
  });

  return { components };
}

export interface GetCirclesParams {
  page?: number;
  limit?: number;
  category?: string;
  tag?: string;
  keyword?: string;
}

// [RESTORED & ENHANCED]: 获取推荐圈子/发现圈子 (支持 G2 规范中的 discovery filters)
export const getCircles = async (params: GetCirclesParams = {}) => {
  const sp = new URLSearchParams();
  if (params.page) sp.set('page', String(params.page));
  if (params.limit) sp.set('limit', String(params.limit));
  if (params.category) sp.set('category', params.category);
  if (params.tag) sp.set('tag', params.tag);
  if (params.keyword) sp.set('keyword', params.keyword);

  const qs = sp.toString();
  return await api.get<{ circles: Circle[]; total: number }>(`/circles${qs ? `?${qs}` : ''}`);
};

// [NEW]: Custom Circle Creation (POST /circles)
export const createCircle = async (payload: CreateCirclePayload) => {
  return await api.post<{ circleId: string; message: string }>('/circles', payload);
};

// [NEW]: Circle Owner - Management Overview
export const getCircleManageOverview = async (circleId: string) => {
  return await api.get<CircleManageOverview>(`/circles/${circleId}/manage/overview`);
};

export const getCircleManageMembers = async (
  circleId: string,
  params: { page?: number; limit?: number } = {},
) => {
  const sp = new URLSearchParams();
  if (params.page) sp.set('page', String(params.page));
  if (params.limit) sp.set('limit', String(params.limit));
  const qs = sp.toString();
  return await api.get<CircleManageMembersResponse>(
    `/circles/${circleId}/manage/members${qs ? `?${qs}` : ''}`,
  );
};

// [NEW]: Circle Owner - Join Requests
export const getCircleJoinRequests = async (
  circleId: string,
  params: { status?: CircleJoinRequestStatus | 'all'; page?: number; limit?: number } = {},
) => {
  const sp = new URLSearchParams();
  if (params.status) sp.set('status', params.status);
  if (params.page) sp.set('page', String(params.page));
  if (params.limit) sp.set('limit', String(params.limit));
  const qs = sp.toString();
  return await api.get<CircleJoinRequestsResponse>(
    `/circles/${circleId}/join-requests${qs ? `?${qs}` : ''}`,
  );
};

// [NEW]: Circle Owner - Update Join Policy (PUT /circles/:id/join-policy)
export const updateJoinPolicy = async (
  circleId: string,
  mode: JoinPolicyMode,
  options: {
    inviteCode?: string | null;
    joinQuestions?: Array<{ id?: string; question: string; required?: boolean }>;
    capacityLimit?: number | null;
    keywordRules?: Array<{ keyword: string; action?: 'reject' }>;
  } = {},
) => {
  return await api.put<{ message: string; circle: ManagedCircle }>(`/circles/${circleId}/join-policy`, {
    mode,
    ...options,
  });
};

// [NEW]: Circle Owner - Review Join Request (PUT /circles/:id/requests/:requestId)
export const reviewCircleJoinRequest = async (
  circleId: string,
  requestId: string,
  action: 'approve' | 'reject',
  options: { reason?: string | null; silent?: boolean } = {},
) => {
  return await api.put<{ message: string; request: unknown }>(`/circles/${circleId}/requests/${requestId}`, {
    action,
    ...options,
  });
};

export const transferCircleOwner = async (circleId: string, targetUserId: string) => {
  return await api.post<{ message: string; circle: Circle }>(`/circles/${circleId}/transfer-owner`, {
    targetUserId,
  });
};

export const dissolveCircle = async (circleId: string) => {
  return await api.delete<{ message: string; circle: Circle }>(`/circles/${circleId}`);
};

export const getMyCircles = async () => {
  return await api.get<{ circles: Circle[] }>('/circles/my');
};

export const getMyCreatedCircles = async () => {
  return await api.get<{ circles: Circle[] }>('/circles/my-created');
};

export const getSentCircleJoinRequests = async (params: { page?: number; limit?: number } = {}) => {
  const sp = new URLSearchParams();
  if (params.page) sp.set('page', String(params.page));
  if (params.limit) sp.set('limit', String(params.limit));
  const qs = sp.toString();
  return await api.get<{ total: number; page: number; limit: number; requests: SentCircleJoinRequest[] }>(
    `/circles/join-requests/sent${qs ? `?${qs}` : ''}`,
  );
};

export const withdrawCircleJoinRequest = async (requestId: string) => {
  return await api.put<{ message: string; requestId: string; circleId: string; status: CircleJoinRequestStatus }>(
    `/circles/join-requests/${requestId}/withdraw`,
    {},
  );
};

// 3. 获取圈子详情
export const getCircleDetail = async (circleId: string) => {
  return await api.get<{ circle: Circle; components: Question[] }>(`/circles/${circleId}`);
};

// 4. 获取圈子大厅成员
export const getChannelMembers = async (
  circleId: string,
  page: number = 1,
  limit: number = 20,
  options: ChannelMembersOptions = {},
) => {
  const sp = new URLSearchParams();
  sp.set('page', String(page));
  sp.set('limit', String(limit));
  if (options.nearby) sp.set('nearby', 'true');
  if (options.radiusMeters) sp.set('radiusMeters', String(options.radiusMeters));
  if (options.includeUnknownDistance) sp.set('includeUnknownDistance', 'true');
  return await api.get<ChannelMembersResponse>(`/circles/${circleId}/channel?${sp.toString()}`);
};

// 5. 加入圈子
export const joinCircle = async (circleId: string, payload: JoinCirclePayload = {}) => {
  return await api.post<JoinCircleResponse>(`/circles/${circleId}/join`, payload);
};

export const getCircleLocationStatus = async (circleId: string) => {
  return await api.get<CircleLocationStatus>(`/circles/${circleId}/location/me`);
};

export const updateCircleLocation = async (circleId: string, payload: UpdateCircleLocationPayload) => {
  return await api.put<CircleLocationStatus>(`/circles/${circleId}/location`, payload);
};

export const disableCircleLocation = async (circleId: string) => {
  return await api.delete<CircleLocationStatus>(`/circles/${circleId}/location`);
};

export interface LeaveCircleOptions {
  clearTrace?: boolean;
  silent?: boolean;
}

export interface LeaveCircleResponse {
  message: string;
  circleId: string;
  clearTrace?: boolean;
  silent?: boolean;
  removedFriendshipCount?: number;
  revokedGlobalFriendshipCount?: number;
  deletedContactUnlockCount?: number;
  rejectedFriendRequestCount?: number;
  rejectedContactRequestCount?: number;
  removedRoleCount?: number;
  clearedTraceCount?: number;
  clearedCircleCardCount?: number;
  clearedCustomCardCount?: number;
  clearedLegacyCardOverrideCount?: number;
  clearedLocationCooldownCount?: number;
  clearedJoinRequestCount?: number;
  clearedCircleContactCount?: number;
  clearedContactSecretCount?: number;
  cancelledTeamupCount?: number;
  leftTeamupCount?: number;
}

// 5.1 退出圈子：clearTrace/silent 都通过 query 传递，兼容旧的 boolean 调用方式。
export const leaveCircle = async (circleId: string, options: LeaveCircleOptions | boolean = {}) => {
  const resolvedOptions = typeof options === 'boolean'
    ? { clearTrace: options, silent: false }
    : options;
  const params = new URLSearchParams({
    clearTrace: String(Boolean(resolvedOptions.clearTrace)),
    silent: String(Boolean(resolvedOptions.silent)),
  });

  return await api.delete<LeaveCircleResponse>(
    `/circles/${circleId}/leave?${params.toString()}`
  );
};

// 6. 获取专属名片配置
export const getCircleCardOverride = async (circleId: string) => {
  const raw = await api.get<RawCircleCardResponse>(`/card/circle/${circleId}/me`);
  return { modules: flattenCircleModules(raw.card.circle) };
};

// 7. 更新专属名片配置
export const updateCircleCardOverride = async (circleId: string, modules: CircleCardModule[]) => {
  const officialModules = modules.filter((module) => !module.moduleKey.startsWith('custom_'));
  return await api.put<{ message: string }>(`/card/circle/${circleId}/me`, buildCirclePayload(officialModules));
};
