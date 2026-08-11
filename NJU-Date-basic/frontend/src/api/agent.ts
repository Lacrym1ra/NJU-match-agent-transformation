import { api } from './client';

export interface AgentCircleCard {
  id: string; name: string; description: string; category: string;
  tags: string[]; memberCount: number; recommendationReasons: string[];
  isJoined: boolean;
}
export interface AgentPostCard {
  postId: string; circleId: string | null; title: string; summary: string | null;
  type: string; likeCount: number; commentCount: number; createdAt: string | null;
}
export interface AgentDraft {
  draftId: string; title: string; content: string; type: string;
  circleId?: string; isAnonymous?: boolean; createdAt: string;
}

export interface AgentLiveChatDraft {
  draftId: string; circleId: string; content: string; mentions: string[]; createdAt: string;
}

export interface AgentTeamupCard {
  id: string; circleId: string; title: string; description: string;
  currentMemberCount: number; maxMembers: number; joinMode: 'direct' | 'approval';
  joinable: boolean; isTeamupMember: boolean; pendingApplicationId: string | null;
}

export interface AgentNotificationCard {
  id: string; title: string; body: string; type: string; isRead: boolean;
  actionUrl?: string | null; createdAt?: string | null;
}

export interface AgentContactInput { type: string; value: string; label?: string }

export type AgentActionKind =
  | 'publish_post' | 'join_circle' | 'send_circle_chat' | 'comment_post'
  | 'like_post' | 'favorite_post' | 'join_teamup' | 'apply_teamup'
  | 'send_teamup_chat' | 'match_action' | 'mark_notification_read'
  | 'mark_all_notifications_read'
  | 'create_resonance_capsule' | 'create_meetup_safety_plan';

export type AgentProposedAction =
  | { kind: 'join_circle'; circleId: string; circleName: string; requiresConfirmation: true }
  | {
    kind: 'send_circle_chat'; circleId: string; circleName: string;
    content: string; requiresConfirmation: true;
  }
  | { kind: 'create_post_draft'; title: string; content: string; postType: string; requiresConfirmation: false }
  | { kind: 'comment_post'; postId: string; postTitle: string; content: string; requiresConfirmation: true }
  | { kind: 'like_post' | 'favorite_post'; postId: string; postTitle: string; requiresConfirmation: true }
  | {
    kind: 'join_teamup' | 'apply_teamup'; circleId: string; teamupId: string;
    teamupTitle: string; applicationNote?: string; requiresSensitiveInput: true;
    requiresConfirmation: true;
  }
  | {
    kind: 'send_teamup_chat'; circleId: string; teamupId: string; teamupTitle: string;
    content: string; requiresConfirmation: true;
  }
  | { kind: 'match_action'; matchId: string; action: 'ACCEPT' | 'REJECT'; requiresConfirmation: true }
  | { kind: 'mark_notification_read'; notificationId: string; notificationTitle: string; requiresConfirmation: true }
  | { kind: 'mark_all_notifications_read'; requiresConfirmation: true }
  | { kind: 'create_resonance_capsule'; title: string; prompt: string; expiresInDays: number; requiresConfirmation: true }
  | {
    kind: 'create_meetup_safety_plan'; title: string; meetingPlace: string;
    meetingAt: string; expectedEndAt: string; note?: string; requiresConfirmation: true;
  };

export interface AgentChatReply {
  reply: string; provider: 'openai-compatible'; model: string;
  circles: AgentCircleCard[]; posts: AgentPostCard[];
  references: Array<{
    id: string; kind: 'circle' | 'post' | 'teamup' | 'resonance' | 'meetup_safety'; resourceId: string; label: string; href: string;
  }>;
  trace: AgentQueryTrace;
  proposedActions: AgentProposedAction[];
  pageContextData: unknown;
  teamups: AgentTeamupCard[];
  notifications: AgentNotificationCard[];
  resonanceCapsules: Array<{ id: string; title: string; status: string; hasResponded: boolean; otherHasResponded: boolean }>;
  meetupSafetyPlans: Array<{ id: string; title: string; status: string; meetingAt: string; expectedEndAt: string }>;
}

export interface AgentQueryTrace {
  intent: 'personalized_recommendation' | 'circle_search' | 'forum_search' | 'mixed_search';
  keywords: string[];
  forumTypes: string[];
  searchScopes: string[];
  usedProfileFallback: boolean;
  usedCircleFallback: boolean;
  usedPostFallback: boolean;
  circleCount: number;
  postCount: number;
  harnessStatus: string;
  harnessSteps: number;
  harnessTools: string[];
}

export interface AgentPageContext {
  pathname: string;
  pageType: 'dashboard' | 'circle' | 'circle_livechat' | 'forum' | 'forum_post'
    | 'teamup' | 'teamup_chat' | 'match' | 'survey' | 'messages' | 'profile'
    | 'settings' | 'notifications' | 'resonance' | 'meetup_safety' | 'other';
  resourceId?: string;
  parentResourceId?: string;
  title?: string;
}

export interface AgentConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

const AGENT_SESSION_STORAGE_KEY = 'nju-match-agent-session-id';

function getAgentSessionId() {
  const existing = globalThis.sessionStorage?.getItem(AGENT_SESSION_STORAGE_KEY);
  if (existing) return existing;
  const created = globalThis.crypto.randomUUID();
  globalThis.sessionStorage?.setItem(AGENT_SESSION_STORAGE_KEY, created);
  return created;
}

export const chatWithAgent = (
  message: string,
  pageContext?: AgentPageContext,
  history?: AgentConversationTurn[],
) => api.post<AgentChatReply>('/agent/chat', {
  message, pageContext, history, sessionId: getAgentSessionId(),
});

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
export const requestAgentConfirmation = (
  action: AgentActionKind, resourceId: string,
) =>
  api.post<{ confirmationToken: string; expiresAt: string }>('/agent/confirmations', { action, resourceId });
export const publishAgentDraft = (draftId: string, confirmationToken: string) =>
  api.post<{ postId: string }>(`/agent/drafts/${draftId}/publish`, { confirmationToken });
export const joinAgentCircle = (circleId: string, confirmationToken: string) =>
  api.post(`/agent/circles/${circleId}/join`, { confirmationToken });
export const createAgentLiveChatDraft = (input: {
  circleId: string; content: string; mentions?: string[];
}) => api.post<{ draft: AgentLiveChatDraft }>('/agent/livechat-drafts', input);
export const sendAgentLiveChatDraft = (draftId: string, confirmationToken: string) =>
  api.post<{ message: { id: string; circleId: string; content: string } }>(
    `/agent/livechat-drafts/${draftId}/send`, { confirmationToken },
  );

export const createAgentAction = (input:
  | { kind: 'comment_post'; payload: { postId: string; content: string; parentCommentId?: string } }
  | { kind: 'like_post' | 'favorite_post'; payload: { postId: string } }
  | { kind: 'join_teamup'; payload: { circleId: string; teamupId: string; contacts: AgentContactInput[] } }
  | { kind: 'apply_teamup'; payload: { circleId: string; teamupId: string; applicationNote: string; contacts: AgentContactInput[] } }
  | { kind: 'send_teamup_chat'; payload: { circleId: string; teamupId: string; content: string } }
  | { kind: 'match_action'; payload: { matchId: string; action: 'ACCEPT' | 'REJECT' } }
  | { kind: 'mark_notification_read'; payload: { notificationId: string } }
  | { kind: 'mark_all_notifications_read'; payload: Record<string, never> }
  | { kind: 'create_resonance_capsule'; payload: { title: string; prompt: string; expiresInDays: number } }
  | { kind: 'create_meetup_safety_plan'; payload: { title: string; meetingPlace: string; meetingAt: string; expectedEndAt: string; note?: string } }
) => api.post<{ actionId: string; kind: AgentActionKind; expiresAt: string }>('/agent/actions', input);

export const executeAgentAction = (
  actionId: string, kind: AgentActionKind, confirmationToken: string,
) => api.post<{ result: unknown }>(`/agent/actions/${actionId}/execute`, { kind, confirmationToken });
