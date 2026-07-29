import { api } from './client';

export type ReportReason =
  | 'harassment'
  | 'spam'
  | 'fake_profile'
  | 'inappropriate_content'
  | 'other';

export function reportUser(targetId: string, payload: { reasons: ReportReason[]; detail?: string }) {
  return api.post<{ message: string }>(`/user/report/${encodeURIComponent(targetId)}`, payload);
}

export function blockUser(targetId: string) {
  return api.post<{ message: string }>(`/user/block/${encodeURIComponent(targetId)}`, {});
}

export function unblockUser(targetId: string) {
  return api.delete<{ message: string }>(`/user/block/${encodeURIComponent(targetId)}`);
}

export function getBlockStatus(targetId: string) {
  return api.get<{ blocked: boolean }>(`/user/block/${encodeURIComponent(targetId)}`);
}
