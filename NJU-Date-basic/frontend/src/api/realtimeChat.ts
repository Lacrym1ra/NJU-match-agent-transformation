import { api } from './client';
import type { ChatMessage } from './chat';

export type ClientRealtimeEvent =
  | { type: 'chat.join'; roomType: 'circle'; circleId: string }
  | { type: 'chat.join'; roomType: 'teamup'; circleId: string; teamupId: string }
  | {
      type: 'chat.send';
      clientMessageId: string;
      roomType: 'circle';
      circleId: string;
      content: string;
      mentions?: string[];
    }
  | {
      type: 'chat.send';
      clientMessageId: string;
      roomType: 'teamup';
      circleId: string;
      teamupId: string;
      content: string;
      mentions?: string[];
    }
  | { type: 'chat.typing'; roomType: 'circle'; circleId: string; isTyping: boolean }
  | { type: 'chat.typing'; roomType: 'teamup'; circleId: string; teamupId: string; isTyping: boolean }
  | { type: 'ping'; ts: number };

export type ServerRealtimeEvent =
  | { type: 'chat.ready'; roomType: 'circle'; circleId: string }
  | { type: 'chat.ready'; roomType: 'teamup'; circleId: string; teamupId: string }
  | { type: 'chat.ack'; clientMessageId: string; message: ChatMessage }
  | { type: 'chat.message'; message: ChatMessage }
  | { type: 'chat.deleted'; messageId: string; roomType: 'circle'; circleId: string }
  | { type: 'chat.deleted'; messageId: string; roomType: 'teamup'; circleId: string; teamupId: string }
  | { type: 'chat.typing'; userId: string; nickname: string | null; isTyping: boolean; circleId: string; teamupId?: string }
  | { type: 'chat.error'; code: string; message: string; clientMessageId?: string }
  | { type: 'pong'; ts: number };

export function buildRealtimeUrlFromBase(apiBase: string, ticket: string) {
  const wsBase = apiBase.replace(/^http/, 'ws').replace(/\/api\/v1\/?$/, '/api/v1/realtime');
  return `${wsBase}?ticket=${encodeURIComponent(ticket)}`;
}

export async function buildRealtimeUrl() {
  const { ticket } = await api.post<{ ticket: string; expiresIn: number }>('/auth/realtime-ticket', {});
  const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:3000/api/v1';
  return buildRealtimeUrlFromBase(apiBase, ticket);
}

export async function createRealtimeSocket() {
  return new WebSocket(await buildRealtimeUrl());
}

export function sendRealtimeEvent(ws: WebSocket, event: ClientRealtimeEvent) {
  ws.send(JSON.stringify(event));
}
