import type { Server } from 'http';
import type { Duplex } from 'stream';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { WebSocket, WebSocketServer } from 'ws';
import { config } from '../config.js';
import { AppError } from '../utils/errors.js';
import type { AuthPayload } from '../middleware/auth.js';
import {
  ensureActiveCircleChatMember,
  listActiveCircleChatMemberIds,
  sendCircleChatMessage,
} from '../modules/chat/circleChat.js';
import {
  ensureActiveTeamupChatMember,
  listActiveTeamupChatMemberIds,
  sendTeamupChatMessage,
} from '../modules/chat/teamupChat.js';
import { circleChatHub, teamupChatHub } from './roomHub.js';
import type { ClientRealtimeEvent, ServerRealtimeEvent } from './types.js';

const MAX_REALTIME_PAYLOAD_BYTES = 8 * 1024;
const REALTIME_RATE_WINDOW_MS = 10_000;
const REALTIME_RATE_MAX_EVENTS = 40;
const REALTIME_TYPING_RATE_MAX_EVENTS = 12;
const MAX_PROTOCOL_ERRORS = 3;
const usedRealtimeTicketIds = new Map<string, number>();
const realtimeIdSchema = z.string().trim().min(1).max(120);
const realtimeMentionsSchema = z.array(realtimeIdSchema).max(20).optional();
const clientRealtimeEventSchema = z.union([
  z.object({
    type: z.literal('ping'),
    ts: z.number().finite(),
  }).strict(),
  z.object({
    type: z.literal('chat.join'),
    roomType: z.literal('circle'),
    circleId: realtimeIdSchema,
  }).strict(),
  z.object({
    type: z.literal('chat.join'),
    roomType: z.literal('teamup'),
    circleId: realtimeIdSchema,
    teamupId: realtimeIdSchema,
  }).strict(),
  z.object({
    type: z.literal('chat.send'),
    clientMessageId: realtimeIdSchema,
    roomType: z.literal('circle'),
    circleId: realtimeIdSchema,
    content: z.string().trim().min(1).max(1000),
    mentions: realtimeMentionsSchema,
  }).strict(),
  z.object({
    type: z.literal('chat.send'),
    clientMessageId: realtimeIdSchema,
    roomType: z.literal('teamup'),
    circleId: realtimeIdSchema,
    teamupId: realtimeIdSchema,
    content: z.string().trim().min(1).max(1000),
    mentions: realtimeMentionsSchema,
  }).strict(),
  z.object({
    type: z.literal('chat.typing'),
    roomType: z.literal('circle'),
    circleId: realtimeIdSchema,
    isTyping: z.boolean(),
  }).strict(),
  z.object({
    type: z.literal('chat.typing'),
    roomType: z.literal('teamup'),
    circleId: realtimeIdSchema,
    teamupId: realtimeIdSchema,
    isTyping: z.boolean(),
  }).strict(),
]);

function sendEvent(ws: WebSocket, event: ServerRealtimeEvent) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(event));
  }
}

function sendError(ws: WebSocket, err: unknown, clientMessageId?: string) {
  const isSafe = err instanceof AppError;
  const code = isSafe ? err.code : 'REALTIME_ERROR';
  const message = isSafe ? err.message : '实时连接处理失败';
  sendEvent(ws, { type: 'chat.error', code, message, clientMessageId });
}

function pruneUsedRealtimeTickets() {
  const now = Date.now();
  for (const [ticketId, expiresAt] of usedRealtimeTicketIds.entries()) {
    if (expiresAt <= now) {
      usedRealtimeTicketIds.delete(ticketId);
    }
  }
}

function consumeRealtimeTicketId(ticketId: string, expiresAtMs: number) {
  pruneUsedRealtimeTickets();
  if (usedRealtimeTicketIds.has(ticketId)) {
    return false;
  }
  usedRealtimeTicketIds.set(ticketId, expiresAtMs);
  return true;
}

function parseRealtimeTicket(ticket: string | null): AuthPayload | null {
  if (!ticket) return null;
  try {
    const payload = jwt.verify(ticket, config.jwt.secret, {
      algorithms: ['HS256'],
      audience: 'realtime',
    }) as Partial<AuthPayload> & { exp?: number; jti?: string; purpose?: string };
    if (!payload.userId || !payload.email || payload.purpose !== 'realtime' || !payload.jti || !payload.exp) {
      return null;
    }
    if (!consumeRealtimeTicketId(payload.jti, payload.exp * 1000)) {
      return null;
    }
    return { userId: payload.userId, email: payload.email };
  } catch {
    return null;
  }
}

function rejectUpgrade(socket: Duplex, status = 401) {
  const statusText = status === 403 ? 'Forbidden' : 'Unauthorized';
  socket.write(`HTTP/1.1 ${status} ${statusText}\r\n\r\n`);
  socket.destroy();
}

function isAllowedOrigin(origin: string | undefined) {
  if (!origin) return true;
  return config.frontend.allowedOrigins.includes(origin);
}

function getRawByteLength(raw: WebSocket.RawData) {
  if (typeof raw === 'string') return Buffer.byteLength(raw, 'utf8');
  if (Buffer.isBuffer(raw)) return raw.length;
  if (Array.isArray(raw)) return raw.reduce((total, item) => total + item.length, 0);
  return raw.byteLength;
}

function rawToString(raw: WebSocket.RawData) {
  if (typeof raw === 'string') return raw;
  if (Buffer.isBuffer(raw)) return raw.toString('utf8');
  if (Array.isArray(raw)) return Buffer.concat(raw).toString('utf8');
  return Buffer.from(raw).toString('utf8');
}

function parseEvent(raw: WebSocket.RawData): ClientRealtimeEvent {
  if (getRawByteLength(raw) > MAX_REALTIME_PAYLOAD_BYTES) {
    throw new AppError(413, 'REALTIME_PAYLOAD_TOO_LARGE', '实时消息过大');
  }

  let data: unknown;
  try {
    data = JSON.parse(rawToString(raw));
  } catch {
    throw new AppError(400, 'INVALID_PAYLOAD', '实时消息格式错误');
  }
  const result = clientRealtimeEventSchema.safeParse(data);
  if (!result.success) {
    throw new AppError(400, 'INVALID_REALTIME_EVENT', '实时消息字段不合法');
  }
  return result.data as ClientRealtimeEvent;
}

function checkRealtimeRateLimit(
  bucket: number[],
  maxEvents = REALTIME_RATE_MAX_EVENTS,
  code = 'REALTIME_RATE_LIMITED',
  message = '实时事件过于频繁，请稍后再试',
) {
  const now = Date.now();
  while (bucket.length > 0 && now - bucket[0] >= REALTIME_RATE_WINDOW_MS) {
    bucket.shift();
  }
  if (bucket.length >= maxEvents) {
    throw new AppError(429, code, message);
  }
  bucket.push(now);
}

function ensureJoined(isJoined: boolean) {
  if (!isJoined) {
    throw new AppError(403, 'CHAT_NOT_JOINED', '请先进入实时聊天室');
  }
}

function toBroadcastEvent(message: ServerRealtimeEvent & { type: 'chat.message' }) {
  return {
    ...message,
    message: {
      ...message.message,
      isOwn: false,
    },
  };
}

async function getCircleAllowedUserIds(circleId: string, userIds: string[]) {
  return listActiveCircleChatMemberIds(circleId, userIds);
}

async function getTeamupAllowedUserIds(circleId: string, teamupId: string, userIds: string[]) {
  return listActiveTeamupChatMemberIds(circleId, teamupId, userIds);
}

function withUserId(userIds: string[], userId: string) {
  return userIds.includes(userId) ? userIds : [...userIds, userId];
}

async function handleClientEvent(ws: WebSocket, auth: AuthPayload, event: ClientRealtimeEvent) {
  if (event.type === 'ping') {
    sendEvent(ws, { type: 'pong', ts: event.ts });
    return;
  }

  if (event.type === 'chat.join' && event.roomType === 'circle') {
    await ensureActiveCircleChatMember(event.circleId, auth.userId);
    circleChatHub.join(event.circleId, ws, auth.userId);
    sendEvent(ws, { type: 'chat.ready', roomType: 'circle', circleId: event.circleId });
    return;
  }

  if (event.type === 'chat.join' && event.roomType === 'teamup') {
    await ensureActiveTeamupChatMember(event.circleId, event.teamupId, auth.userId);
    teamupChatHub.join(event.teamupId, ws, auth.userId);
    sendEvent(ws, { type: 'chat.ready', roomType: 'teamup', circleId: event.circleId, teamupId: event.teamupId });
    return;
  }

  if (event.type === 'chat.send' && event.roomType === 'circle') {
    try {
      ensureJoined(circleChatHub.has(event.circleId, ws));
      const message = await sendCircleChatMessage(auth.userId, event.circleId, {
        clientMessageId: event.clientMessageId,
        content: event.content,
        mentions: event.mentions,
      });
      sendEvent(ws, { type: 'chat.ack', clientMessageId: event.clientMessageId, message });
      await circleChatHub.broadcast(event.circleId, toBroadcastEvent({ type: 'chat.message', message }), {
        except: ws,
        canReceiveMany: (userIds) => getCircleAllowedUserIds(event.circleId, userIds),
      });
    } catch (err) {
      sendError(ws, err, event.clientMessageId);
    }
    return;
  }

  if (event.type === 'chat.send' && event.roomType === 'teamup') {
    try {
      ensureJoined(teamupChatHub.has(event.teamupId, ws));
      const message = await sendTeamupChatMessage(auth.userId, event.circleId, event.teamupId, {
        clientMessageId: event.clientMessageId,
        content: event.content,
        mentions: event.mentions,
      });
      sendEvent(ws, { type: 'chat.ack', clientMessageId: event.clientMessageId, message });
      await teamupChatHub.broadcast(event.teamupId, toBroadcastEvent({ type: 'chat.message', message }), {
        except: ws,
        canReceiveMany: (userIds) => getTeamupAllowedUserIds(event.circleId, event.teamupId, userIds),
      });
    } catch (err) {
      sendError(ws, err, event.clientMessageId);
    }
    return;
  }

  if (event.type === 'chat.typing' && event.roomType === 'circle') {
    ensureJoined(circleChatHub.has(event.circleId, ws));
    const allowedUserIds = await getCircleAllowedUserIds(
      event.circleId,
      withUserId(circleChatHub.getUserIds(event.circleId), auth.userId),
    );
    if (!allowedUserIds.has(auth.userId)) {
      circleChatHub.leave(event.circleId, ws);
      throw new AppError(403, 'FORBIDDEN', '加入圈子后可参与聊天');
    }
    await circleChatHub.broadcast(event.circleId, {
      type: 'chat.typing',
      userId: auth.userId,
      nickname: null,
      isTyping: event.isTyping,
      circleId: event.circleId,
    }, {
      except: ws,
      canReceiveMany: () => allowedUserIds,
    });
    return;
  }

  if (event.type === 'chat.typing' && event.roomType === 'teamup') {
    ensureJoined(teamupChatHub.has(event.teamupId, ws));
    const allowedUserIds = await getTeamupAllowedUserIds(
      event.circleId,
      event.teamupId,
      withUserId(teamupChatHub.getUserIds(event.teamupId), auth.userId),
    );
    if (!allowedUserIds.has(auth.userId)) {
      teamupChatHub.leave(event.teamupId, ws);
      throw new AppError(403, 'NOT_TEAMUP_MEMBER', '加入组队后可参与聊天');
    }
    await teamupChatHub.broadcast(event.teamupId, {
      type: 'chat.typing',
      userId: auth.userId,
      nickname: null,
      isTyping: event.isTyping,
      circleId: event.circleId,
      teamupId: event.teamupId,
    }, {
      except: ws,
      canReceiveMany: () => allowedUserIds,
    });
    return;
  }

  sendEvent(ws, { type: 'chat.error', code: 'UNKNOWN_EVENT', message: '未知实时事件' });
}

export function initRealtimeServer(server: Server) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_REALTIME_PAYLOAD_BYTES });

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== '/api/v1/realtime') {
      return;
    }

    if (!isAllowedOrigin(req.headers.origin)) {
      rejectUpgrade(socket, 403);
      return;
    }

    const auth = parseRealtimeTicket(url.searchParams.get('ticket'));
    if (!auth) {
      rejectUpgrade(socket);
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      const rateBucket: number[] = [];
      const typingRateBucket: number[] = [];
      let protocolErrors = 0;

      ws.on('message', (raw) => {
        let event: ClientRealtimeEvent;
        try {
          checkRealtimeRateLimit(rateBucket);
          event = parseEvent(raw);
          if (event.type === 'chat.typing') {
            checkRealtimeRateLimit(
              typingRateBucket,
              REALTIME_TYPING_RATE_MAX_EVENTS,
              'REALTIME_TYPING_RATE_LIMITED',
              '输入状态发送过于频繁',
            );
          }
        } catch (err) {
          protocolErrors += 1;
          sendError(ws, err);
          if (
            protocolErrors >= MAX_PROTOCOL_ERRORS
            || (err instanceof AppError && err.code === 'REALTIME_PAYLOAD_TOO_LARGE')
          ) {
            ws.close(1008, 'policy violation');
          }
          return;
        }

        void handleClientEvent(ws, auth, event).catch((err) => sendError(ws, err));
      });

      ws.on('close', () => {
        circleChatHub.leaveAll(ws);
        teamupChatHub.leaveAll(ws);
      });

      ws.on('error', () => {
        circleChatHub.leaveAll(ws);
        teamupChatHub.leaveAll(ws);
      });
    });
  });

  return wss;
}
