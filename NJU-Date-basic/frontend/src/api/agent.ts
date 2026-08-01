import { api } from './client';

export interface AgentCircleCard {
  id: string; name: string; description: string; category: string;
  tags: string[]; memberCount: number; isJoined: boolean;
}
export interface AgentPostCard {
  id: string; circleId?: string; title: string; summary: string;
  type: string; authorName: string; createdAt: string;
}
export interface AgentDraft {
  draftId: string; title: string; content: string; type: string;
  circleId?: string; isAnonymous?: boolean; createdAt: string;
}

export const getAgentStatus = () => api.get<{
  profile: { profileComplete: boolean; missingFields: string[] };
  questionnaire: { complete: boolean; needsUpdate: boolean };
}>('/agent/status');

export const searchAgentCircles = (query: string) =>
  api.get<{ circles: AgentCircleCard[] }>(`/agent/circles?q=${encodeURIComponent(query)}`);
export const searchAgentPosts = (query: string) =>
  api.get<{ posts: AgentPostCard[] }>(`/agent/posts?q=${encodeURIComponent(query)}`);
export const createAgentDraft = (input: Omit<AgentDraft, 'draftId' | 'createdAt'>) =>
  api.post<{ draft: AgentDraft }>('/agent/drafts', input);
export const requestAgentConfirmation = (action: 'publish_post' | 'join_circle', resourceId: string) =>
  api.post<{ confirmationToken: string; expiresAt: string }>('/agent/confirmations', { action, resourceId });
export const publishAgentDraft = (draftId: string, confirmationToken: string) =>
  api.post<{ postId: string }>(`/agent/drafts/${draftId}/publish`, { confirmationToken });
export const joinAgentCircle = (circleId: string, confirmationToken: string) =>
  api.post(`/agent/circles/${circleId}/join`, { confirmationToken });
