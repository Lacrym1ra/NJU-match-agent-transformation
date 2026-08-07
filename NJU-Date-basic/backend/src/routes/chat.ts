import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ValidationError } from '../utils/errors.js';
import {
  type ChatMessageDto,
  deleteCircleChatMessage,
  listActiveCircleChatMemberIds,
  listCircleChatMessages,
  sendCircleChatMessage,
  updateCircleChatReadState,
} from '../modules/chat/circleChat.js';
import {
  deleteTeamupChatMessage,
  listActiveTeamupChatMemberIds,
  listTeamupChatMessages,
  sendTeamupChatMessage,
  updateTeamupChatReadState,
} from '../modules/chat/teamupChat.js';
import { circleChatHub, teamupChatHub } from '../realtime/roomHub.js';

const router = Router();

const sendMessageSchema = z.object({
  clientMessageId: z.string().trim().min(1).max(120),
  content: z.string().min(1).max(1000),
  mentions: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
});

const readStateSchema = z.object({
  lastReadMessageId: z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9_-]+$/).optional(),
  lastReadAt: z.string().datetime({ offset: true }).optional(),
}).default({});

function parseId(value: unknown, field: string) {
  const raw = Array.isArray(value) ? value[0] : value;
  const result = z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9_-]+$/).safeParse(raw);
  if (!result.success) {
    throw new ValidationError(`${field} 必须是合法的资源 ID`);
  }
  return result.data;
}

function parseLimit(value: unknown) {
  const raw = typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(raw)) return 30;
  return Math.min(50, Math.max(1, Math.floor(raw)));
}

function toBroadcastMessage(message: ChatMessageDto): ChatMessageDto {
  return { ...message, isOwn: false };
}

router.get('/:circleId/chat/messages', requireAuth, async (req, res, next) => {
  try {
    const circleId = parseId(req.params.circleId, 'circleId');
    const before = typeof req.query.before === 'string' && req.query.before.trim()
      ? parseId(req.query.before, 'before')
      : undefined;
    const result = await listCircleChatMessages(req.auth!.userId, circleId, {
      before,
      limit: parseLimit(req.query.limit),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/:circleId/chat/messages', requireAuth, validate(sendMessageSchema), async (req, res, next) => {
  try {
    const circleId = parseId(req.params.circleId, 'circleId');
    const message = await sendCircleChatMessage(req.auth!.userId, circleId, req.body);
    await circleChatHub.broadcast(circleId, { type: 'chat.message', message: toBroadcastMessage(message) }, {
      canReceiveMany: (userIds) => listActiveCircleChatMemberIds(circleId, userIds),
    });
    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
});

router.delete('/:circleId/chat/messages/:messageId', requireAuth, async (req, res, next) => {
  try {
    const circleId = parseId(req.params.circleId, 'circleId');
    const messageId = parseId(req.params.messageId, 'messageId');
    const result = await deleteCircleChatMessage(req.auth!.userId, circleId, messageId);
    await circleChatHub.broadcast(circleId, { type: 'chat.deleted', roomType: 'circle', circleId, messageId }, {
      canReceiveMany: (userIds) => listActiveCircleChatMemberIds(circleId, userIds),
    });
    res.json({ message: '消息已删除', ...result });
  } catch (err) {
    next(err);
  }
});

router.put('/:circleId/chat/read-state', requireAuth, validate(readStateSchema), async (req, res, next) => {
  try {
    const circleId = parseId(req.params.circleId, 'circleId');
    const result = await updateCircleChatReadState(req.auth!.userId, circleId, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/:circleId/teamups/:teamupId/chat/messages', requireAuth, async (req, res, next) => {
  try {
    const circleId = parseId(req.params.circleId, 'circleId');
    const teamupId = parseId(req.params.teamupId, 'teamupId');
    const before = typeof req.query.before === 'string' && req.query.before.trim()
      ? parseId(req.query.before, 'before')
      : undefined;
    const result = await listTeamupChatMessages(req.auth!.userId, circleId, teamupId, {
      before,
      limit: parseLimit(req.query.limit),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/:circleId/teamups/:teamupId/chat/messages', requireAuth, validate(sendMessageSchema), async (req, res, next) => {
  try {
    const circleId = parseId(req.params.circleId, 'circleId');
    const teamupId = parseId(req.params.teamupId, 'teamupId');
    const message = await sendTeamupChatMessage(req.auth!.userId, circleId, teamupId, req.body);
    await teamupChatHub.broadcast(teamupId, { type: 'chat.message', message: toBroadcastMessage(message) }, {
      canReceiveMany: (userIds) => listActiveTeamupChatMemberIds(circleId, teamupId, userIds),
    });
    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
});

router.delete('/:circleId/teamups/:teamupId/chat/messages/:messageId', requireAuth, async (req, res, next) => {
  try {
    const circleId = parseId(req.params.circleId, 'circleId');
    const teamupId = parseId(req.params.teamupId, 'teamupId');
    const messageId = parseId(req.params.messageId, 'messageId');
    const result = await deleteTeamupChatMessage(req.auth!.userId, circleId, teamupId, messageId);
    await teamupChatHub.broadcast(teamupId, { type: 'chat.deleted', roomType: 'teamup', circleId, teamupId, messageId }, {
      canReceiveMany: (userIds) => listActiveTeamupChatMemberIds(circleId, teamupId, userIds),
    });
    res.json({ message: '消息已删除', ...result });
  } catch (err) {
    next(err);
  }
});

router.put('/:circleId/teamups/:teamupId/chat/read-state', requireAuth, validate(readStateSchema), async (req, res, next) => {
  try {
    const circleId = parseId(req.params.circleId, 'circleId');
    const teamupId = parseId(req.params.teamupId, 'teamupId');
    const result = await updateTeamupChatReadState(req.auth!.userId, circleId, teamupId, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
