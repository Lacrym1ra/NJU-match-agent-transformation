import { api } from './client';
import { buildTeamupListQuery } from '../modules/teamups/queries';

// 基础数据结构
export type TeamUpType = 'short_term' | 'long_term';
export type TeamUpApplicationType = 'join' | 'waitlist';
export interface Contact { type: string; value: string; label: string; }
export interface TeamUpViewer {
  isCircleMember: boolean;
  isTeamupMember: boolean;
  isLeader: boolean;
  canManage: boolean;
  canViewContacts: boolean;
  contactsVisibleUntil: string | null;
  pendingApplicationId: string | null;
  activeApplicationId?: string | null;
  applicationStatus?: 'pending' | 'approved' | 'rejected' | 'withdrawn' | null;
  applicationType?: TeamUpApplicationType | null;
  waitlistPosition?: number | null;
}
export interface TeamUpMember { userId: string; nickname: string | null; avatarUrl: string | null; memberRole: string; joinedAt: string; }
export interface TeamUpApplicant { userId: string; nickname: string | null; avatarUrl: string | null; }
export interface TeamUp { id: string; circleId: string; leaderId: string; title: string; description: string; descriptionPreview?: string; maxMembers: number; currentMemberCount: number; deadlineAt: string; endAt: string; teamupType: TeamUpType; joinMode: 'direct' | 'approval'; isPublic: boolean; status: 'recruiting' | 'full' | 'cancelled'; effectiveStatus: 'recruiting' | 'full' | 'expired' | 'ended' | 'cancelled'; joinable: boolean; waitlistable?: boolean; waitlistCount?: number; waitlistCapacity?: number; waitlistAvailable?: number; viewer: TeamUpViewer; members: TeamUpMember[]; leader?: TeamUpMember | null; createdAt: string; }
export interface CardSnapshotModule { key: string; label?: string; name?: string; value?: unknown; topLeft?: [number, number]; status?: string; }
export interface CardSnapshotGroups { public?: CardSnapshotModule[]; hidden?: CardSnapshotModule[]; deleted?: CardSnapshotModule[]; locked?: CardSnapshotModule[]; }
export interface ApplicationCardSnapshot {
  view?: 'public' | 'friend';
  relationship?: 'not_friend' | 'friend';
  capturedAt?: string;
  nickname?: string | null;
  avatarUrl?: string | null;
  baseModules?: CardSnapshotModule[];
  circleCards?: Array<{ circleId?: string; circleName?: string; modules?: CardSnapshotModule[] }>;
  card?: {
    base?: CardSnapshotGroups;
    circle?: CardSnapshotGroups;
    custom?: CardSnapshotGroups;
  };
}
export interface Application { id: string; teamupId: string; applicant: TeamUpApplicant; applicationNote: string; applicationType?: TeamUpApplicationType; waitlistPosition?: number | null; cardSnapshot?: ApplicationCardSnapshot; status: 'pending' | 'approved' | 'rejected' | 'withdrawn'; waitlistJoinedAt?: string | null; createdAt: string; }
export interface TeamUpApplicationReply {
  id: string;
  teamupId: string;
  circleId: string;
  circleName: string | null;
  teamupTitle: string;
  leader: TeamUpApplicant;
  status: 'approved' | 'rejected';
  applicationType?: TeamUpApplicationType;
  waitlistJoinedAt?: string | null;
  reviewNote: string | null;
  createdAt: string;
  respondedAt: string;
}
export interface TeamUpListFilters {
  mine?: 'created' | 'joined' | 'applied';
  teamupType?: TeamUpType | 'all';
  keyword?: string;
}
export interface UpdateTeamUpPayload {
  title?: string;
  description?: string;
  maxMembers?: number;
  deadlineAt?: string;
  endAt?: string;
  teamupType?: TeamUpType;
  joinMode?: 'direct' | 'approval';
  isPublic?: boolean;
  contacts?: Contact[];
}

// 1. 获取组队完整详情
export const getTeamUpDetail = (circleId: string, teamupId: string) => api.get<{ teamup: TeamUp }>(`/circles/${circleId}/teamups/${teamupId}`);
// 1.1 获取组队列表
export const getTeamUps = (circleId: string, mineOrFilters?: 'created' | 'joined' | 'applied' | TeamUpListFilters) => {
  return api.get<{ teamups: TeamUp[]; total: number }>(`/circles/${circleId}/teamups${buildTeamupListQuery(mineOrFilters)}`);
};
// 2. 直接加入组队 (需传联系方式)
export const joinTeamUp = (circleId: string, teamupId: string, contacts: Contact[]) => api.post(`/circles/${circleId}/teamups/${teamupId}/join`, { contacts });
// 3. 提交加入申请 (需传申请说明与联系方式)
export const applyTeamUp = (circleId: string, teamupId: string, applicationNote: string, contacts: Contact[]) => api.post(`/circles/${circleId}/teamups/${teamupId}/applications`, { applicationNote, contacts });
// 4. 普通成员退出组队
export const leaveTeamUp = (circleId: string, teamupId: string) => api.delete(`/circles/${circleId}/teamups/${teamupId}/members/me`);
// 5. 组长取消组队
export const cancelTeamUp = (circleId: string, teamupId: string, reason: string) => api.post(`/circles/${circleId}/teamups/${teamupId}/cancel`, { reason, cancelSource: 'leader', confirmCancel: true });
// 6. 截止后/结束前获取联系方式
export const getTeamUpContacts = (circleId: string, teamupId: string) => api.get<{ availableUntil: string, members: Array<TeamUpMember & { contacts: Contact[] }> }>(`/circles/${circleId}/teamups/${teamupId}/contacts`);
// 7. 组长获取申请列表
export const getApplications = (circleId: string, teamupId: string, status = 'pending') => api.get<{ applications: Application[] }>(`/circles/${circleId}/teamups/${teamupId}/applications?status=${status}`);
// 7.1 获取我发出的组队申请回复
export const getMyTeamUpApplicationReplies = () => api.get<{ replies: TeamUpApplicationReply[]; total: number }>('/teamups/applications/replies');
// 8. 组长审核申请
export const reviewApplication = (
  circleId: string,
  teamupId: string,
  applicationId: string,
  action: 'approve' | 'reject',
  reviewNote?: string,
) => api.patch(`/circles/${circleId}/teamups/${teamupId}/applications/${applicationId}`, {
  action,
  ...(reviewNote?.trim() ? { reviewNote: reviewNote.trim() } : {}),
});
// 8.1 申请人撤回自己的组队/候补申请
export const withdrawTeamUpApplication = (circleId: string, teamupId: string, applicationId: string) => {
  return api.put<{
    message: string;
    applicationId: string;
    teamupId: string;
    status: 'withdrawn';
    applicationType?: TeamUpApplicationType;
  }>(`/circles/${circleId}/teamups/${teamupId}/applications/${applicationId}/withdraw`, {});
};
// 9. 发布新的组队
export const createTeamUp = (circleId: string, payload: any) => api.post<{ teamup: TeamUp }>(`/circles/${circleId}/teamups`, payload);
// 10. 组长修改组队
export const updateTeamUp = (circleId: string, teamupId: string, payload: UpdateTeamUpPayload) => {
  return api.patch<{ teamup: TeamUp }>(`/circles/${circleId}/teamups/${teamupId}`, payload);
};
