import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  MESSAGE_PRIVACY_OPTIONS,
  blockUser,
  followUser,
  getDirectMessageConversation,
  getDirectMessageEligibility,
  getFollowOverview,
  getFollowRelation,
  getMessagePrivacySetting,
  listFollowUsers,
  listDirectMessageConversations,
  recallDirectMessage,
  sendDirectMessage,
  unfollowUser,
  unblockUser,
  updateMessagePrivacySetting,
} from '../services/socialService.js';
import { ValidationError } from '../utils/errors.js';

const router = Router();

const updatePrivacySchema = z.object({
  allowDirectMessagesFrom: z.enum(MESSAGE_PRIVACY_OPTIONS),
});

const sendDirectMessageSchema = z.object({
  content: z.string().max(800).optional(),
  imageUrls: z.array(z.string().min(1).max(500)).max(9).optional(),
  voiceUrl: z.string().min(1).max(500).optional(),
  voiceDurationSec: z.number().int().min(1).max(300).optional(),
}).superRefine((data, ctx) => {
  const hasContent = typeof data.content === 'string' && data.content.trim().length > 0;
  const hasImages = Array.isArray(data.imageUrls) && data.imageUrls.length > 0;
  const hasVoice = typeof data.voiceUrl === 'string' && data.voiceUrl.trim().length > 0;
  const flags = [hasContent, hasImages, hasVoice].filter(Boolean).length;
  if (flags === 0) {
    ctx.addIssue({ code: 'custom', message: '消息内容不能为空', path: ['content'] });
  }
  if (flags > 1) {
    ctx.addIssue({ code: 'custom', message: '单条私信只能包含一种类型', path: ['content'] });
  }
  if (hasVoice && !data.voiceDurationSec) {
    ctx.addIssue({ code: 'custom', message: '语音消息必须包含时长', path: ['voiceDurationSec'] });
  }
});

const followListTabSchema = z.enum(['mutual', 'following', 'followers']);

function parseUuidParam(value: string, field: string) {
  const result = z.string().uuid().safeParse(value);
  if (!result.success) {
    throw new ValidationError(`${field} 必须是合法的 UUID`);
  }
  return result.data;
}

function parsePositiveIntegerQuery(value: unknown, field: string) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string' || raw.trim() === '') {
    return undefined;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new ValidationError(`${field} 必须是正整数`);
  }
  return parsed;
}

function parseStringQuery(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
}

router.get('/follows/:userId', requireAuth, async (req, res, next) => {
  try {
    const targetUserId = parseUuidParam(req.params.userId as string, 'userId');
    const result = await getFollowRelation(req.auth!.userId, targetUserId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/follows', requireAuth, async (req, res, next) => {
  try {
    const tabResult = followListTabSchema.safeParse(req.query.tab);
    const tab = tabResult.success ? tabResult.data : 'mutual';
    const [overview, list] = await Promise.all([
      getFollowOverview(req.auth!.userId),
      listFollowUsers(req.auth!.userId, tab),
    ]);
    res.json({
      ...overview,
      ...list,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/follows/:userId', requireAuth, async (req, res, next) => {
  try {
    const targetUserId = parseUuidParam(req.params.userId as string, 'userId');
    const result = await followUser(req.auth!.userId, targetUserId);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.delete('/follows/:userId', requireAuth, async (req, res, next) => {
  try {
    const targetUserId = parseUuidParam(req.params.userId as string, 'userId');
    const result = await unfollowUser(req.auth!.userId, targetUserId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/blocks/:userId', requireAuth, async (req, res, next) => {
  try {
    const targetUserId = parseUuidParam(req.params.userId as string, 'userId');
    const result = await blockUser(req.auth!.userId, targetUserId);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.delete('/blocks/:userId', requireAuth, async (req, res, next) => {
  try {
    const targetUserId = parseUuidParam(req.params.userId as string, 'userId');
    const result = await unblockUser(req.auth!.userId, targetUserId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/messages/privacy', requireAuth, async (req, res, next) => {
  try {
    const result = await getMessagePrivacySetting(req.auth!.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.put('/messages/privacy', requireAuth, validate(updatePrivacySchema), async (req, res, next) => {
  try {
    const result = await updateMessagePrivacySetting(
      req.auth!.userId,
      req.body.allowDirectMessagesFrom,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/messages', requireAuth, async (req, res, next) => {
  try {
    const result = await listDirectMessageConversations(req.auth!.userId, {
      page: parsePositiveIntegerQuery(req.query.page, 'page'),
      limit: parsePositiveIntegerQuery(req.query.limit, 'limit'),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/messages/eligibility/:userId', requireAuth, async (req, res, next) => {
  try {
    const targetUserId = parseUuidParam(req.params.userId as string, 'userId');
    const result = await getDirectMessageEligibility(req.auth!.userId, targetUserId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/messages/:userId', requireAuth, async (req, res, next) => {
  try {
    const targetUserId = parseUuidParam(req.params.userId as string, 'userId');
    const result = await getDirectMessageConversation(req.auth!.userId, targetUserId, {
      before: parseStringQuery(req.query.before),
      limit: parsePositiveIntegerQuery(req.query.limit, 'limit'),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/messages/:messageId/recall', requireAuth, async (req, res, next) => {
  try {
    const messageId = parseUuidParam(req.params.messageId as string, 'messageId');
    const result = await recallDirectMessage(req.auth!.userId, messageId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/messages/:userId', requireAuth, validate(sendDirectMessageSchema), async (req, res, next) => {
  try {
    const targetUserId = parseUuidParam(req.params.userId as string, 'userId');
    const result = await sendDirectMessage(req.auth!.userId, targetUserId, {
      content: req.body.content,
      imageUrls: req.body.imageUrls,
      voiceUrl: req.body.voiceUrl,
      voiceDurationSec: req.body.voiceDurationSec,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
