import { api } from './client';

export interface ChatSender {
  userId: string;
  nickname: string | null;
  avatarUrl: string | null;
}

export interface ChatMessage {
  id: string;
  roomType: 'circle' | 'teamup';
  circleId: string;
  teamupId?: string;
  sender: ChatSender;
  content: string;
  mentions: string[];
  createdAt: string;
  updatedAt?: string | null;
  deletedAt?: string | null;
  isOwn: boolean;
}

export interface ChatHistoryResponse {
  messages: ChatMessage[];
  hasMore: boolean;
  nextBefore: string | null;
}

export interface SendChatMessagePayload {
  clientMessageId: string;
  content: string;
  mentions?: string[];
}

export interface SendChatMessageResponse {
  message: ChatMessage;
}

export interface UpdateReadStatePayload {
  lastReadMessageId?: string;
  lastReadAt?: string;
}

export const getCircleChatMessages = async (
  circleId: string,
  params: { before?: string | null; limit?: number } = {},
) => {
  const sp = new URLSearchParams();
  if (params.before) sp.set('before', params.before);
  if (params.limit) sp.set('limit', String(params.limit));
  const qs = sp.toString();
  return api.get<ChatHistoryResponse>(`/circles/${circleId}/chat/messages${qs ? `?${qs}` : ''}`);
};

export const sendCircleChatMessage = async (circleId: string, payload: SendChatMessagePayload) => {
  return api.post<SendChatMessageResponse>(`/circles/${circleId}/chat/messages`, payload);
};

export const deleteCircleChatMessage = async (circleId: string, messageId: string) => {
  return api.delete<{ message: string; messageId: string; circleId: string }>(
    `/circles/${circleId}/chat/messages/${messageId}`,
  );
};

export const updateCircleChatReadState = async (circleId: string, payload: UpdateReadStatePayload) => {
  return api.put<{ lastReadMessageId: string | null; lastReadAt: string; unreadCount: number }>(
    `/circles/${circleId}/chat/read-state`,
    payload,
  );
};

export const getTeamupChatMessages = async (
  circleId: string,
  teamupId: string,
  params: { before?: string | null; limit?: number } = {},
) => {
  const sp = new URLSearchParams();
  if (params.before) sp.set('before', params.before);
  if (params.limit) sp.set('limit', String(params.limit));
  const qs = sp.toString();
  return api.get<ChatHistoryResponse>(`/circles/${circleId}/teamups/${teamupId}/chat/messages${qs ? `?${qs}` : ''}`);
};

export const sendTeamupChatMessage = async (circleId: string, teamupId: string, payload: SendChatMessagePayload) => {
  return api.post<SendChatMessageResponse>(`/circles/${circleId}/teamups/${teamupId}/chat/messages`, payload);
};

export const deleteTeamupChatMessage = async (circleId: string, teamupId: string, messageId: string) => {
  return api.delete<{ message: string; messageId: string; circleId: string; teamupId: string }>(
    `/circles/${circleId}/teamups/${teamupId}/chat/messages/${messageId}`,
  );
};

export const updateTeamupChatReadState = async (circleId: string, teamupId: string, payload: UpdateReadStatePayload) => {
  return api.put<{ lastReadMessageId: string | null; lastReadAt: string; unreadCount: number }>(
    `/circles/${circleId}/teamups/${teamupId}/chat/read-state`,
    payload,
  );
};
