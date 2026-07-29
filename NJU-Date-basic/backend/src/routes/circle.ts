import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ValidationError } from '../utils/errors.js';
import {
  listCircles,
  getCircleDetail,
  getChannelMembers,
  getMyCircles,
  createCustomCircle,
  listMyCreatedCircles,
  joinCircle,
  leaveCircle,
  toggleCircleActive,
  listSentJoinRequests,
  withdrawCircleJoinRequest,
  listCircleJoinRequests,
  reviewCircleJoinRequest,
  getCircleManageOverview,
  updateManagedCircle,
  updateCircleJoinPolicy,
  listCircleManageMembers,
  removeCircleMember,
  listCircleBlacklist,
  addCircleBlacklistUser,
  removeCircleBlacklistUser,
  transferCircleOwner,
  archiveManagedCircle,
  listCircleAuditLogs,
  getCircleLocationStatus,
  updateCircleLocation,
  disableCircleLocation,
  getQuestionnaire,
  submitQuestionnaire,
  getCurrentCircleMatch,
  recordCircleAction,
  getCircleMatchHistory,
} from '../modules/circles/index.js';

const router = Router();

// ─── Validation schemas ─────────────────────────────────────────

const statusSchema = z.object({
  isActive: z.boolean(),
});

const joinQuestionItemSchema = z.object({
  id: z.string().trim().min(1).max(60).optional(),
  question: z.string().trim().min(1).max(120),
  required: z.boolean().optional(),
});

const keywordRuleSchema = z.object({
  keyword: z.string().trim().min(1).max(40),
  action: z.enum(['reject']).optional(),
});

const joinPolicyModeSchema = z.enum(['public', 'review', 'invite']);
const joinPolicyInputSchema = z.union([
  joinPolicyModeSchema,
  z.object({ mode: joinPolicyModeSchema }),
]).transform((value) => (typeof value === 'string' ? value : value.mode));

const createCustomCircleSchema = z.object({
  name: z.string().trim().min(1).max(30),
  slug: z.string().trim().min(1).max(60).optional(),
  description: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(40).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).min(1).max(5).optional(),
  iconUrl: z.string().trim().max(500).optional(),
  joinPolicy: joinPolicyInputSchema.optional(),
  joinQuestion: z.string().trim().max(120).nullable().optional(),
  joinQuestions: z.array(joinQuestionItemSchema).max(5).optional(),
  capacityLimit: z.number().int().min(1).max(100000).nullable().optional(),
  keywordRules: z.array(keywordRuleSchema).max(20).optional(),
}).transform((value) => ({
  ...value,
  tags: value.tags && value.tags.length > 0 ? value.tags : [value.category || '自定义'],
}));

const joinCircleSchema = z.object({
  inviteCode: z.string().trim().max(80).optional(),
  answer: z.string().trim().max(300).optional(),
  answers: z.union([
    z.record(z.string(), z.string().trim().max(300)),
    z.array(z.object({
      questionId: z.string().trim().min(1).max(60),
      value: z.string().trim().max(300),
    })).max(5),
  ]).optional(),
  applicationReason: z.string().trim().max(300).optional(),
}).default({});

const updateManagedCircleSchema = z.object({
  name: z.string().trim().min(1).max(30).optional(),
  description: z.string().trim().min(1).max(200).optional(),
  category: z.string().trim().min(1).max(40).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).min(1).max(5).optional(),
  iconUrl: z.string().trim().max(500).nullable().optional(),
  joinQuestion: z.string().trim().max(120).nullable().optional(),
  joinQuestions: z.array(joinQuestionItemSchema).max(5).optional(),
  capacityLimit: z.number().int().min(1).max(100000).nullable().optional(),
  keywordRules: z.array(keywordRuleSchema).max(20).optional(),
});

const joinPolicySchema = z.object({
  joinPolicy: joinPolicyModeSchema.optional(),
  mode: joinPolicyModeSchema.optional(),
  inviteCode: z.string().trim().max(80).nullable().optional(),
  joinQuestion: z.string().trim().max(120).nullable().optional(),
  joinQuestions: z.array(joinQuestionItemSchema).max(5).optional(),
  capacityLimit: z.number().int().min(1).max(100000).nullable().optional(),
  keywordRules: z.array(keywordRuleSchema).max(20).optional(),
}).transform((value, ctx) => {
  const joinPolicy = value.joinPolicy ?? value.mode;
  if (!joinPolicy) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['joinPolicy'],
      message: 'joinPolicy 或 mode 必填',
    });
    return z.NEVER;
  }
  const { mode: _mode, ...rest } = value;
  return { ...rest, joinPolicy };
});

const reviewJoinRequestSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  reason: z.string().trim().max(200).nullable().optional(),
  silent: z.boolean().optional(),
});

function parseUuidParam(value: string, field: string): string {
  const result = z.string().uuid().safeParse(value);
  if (!result.success) {
    throw new ValidationError(`${field} 必须是合法的 UUID`);
  }
  return result.data;
}

const reviewJoinRequestCompatSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().trim().max(200).nullable().optional(),
  silent: z.boolean().optional(),
}).transform((value) => ({
  status: value.action === 'approve' ? 'approved' as const : 'rejected' as const,
  reason: value.reason,
  silent: value.silent,
}));

const removeMemberSchema = z.object({
  addToBlacklist: z.boolean().optional(),
  reason: z.string().trim().max(200).nullable().optional(),
}).default({});

const blacklistSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().trim().max(200).nullable().optional(),
});

const transferOwnerSchema = z.object({
  targetUserId: z.string().uuid(),
});

const submitQuestionnaireSchema = z.object({
  answers: z.record(z.string(), z.object({
    value: z.unknown(),
    importance: z.number().min(1).max(5).optional(),
  })),
});

const actionSchema = z.object({
  matchId: z.string().uuid(),
  action: z.enum(['ACCEPT', 'REJECT']),
});

const updateLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().positive(),
  capturedAt: z.string().datetime({ offset: true }).optional(),
});

function parsePositiveInt(value: unknown, fallback: number, max = 50) {
  const parsed = typeof value === 'string' ? parseInt(value, 10) : NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(1, parsed));
}

function parseOptionalPositiveInt(value: unknown) {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseBooleanFlag(value: unknown) {
  return value === '1' || value === 'true' || value === true;
}

function parseStringList(value: unknown) {
  const raw = Array.isArray(value) ? value.join(',') : String(value ?? '');
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}

// ─── Public routes ──────────────────────────────────────────────

// GET /circles — list all active circles
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const result = await listCircles(req.auth!.userId, {
      category: req.query.category as string | undefined,
      keyword: req.query.keyword as string | undefined,
      tags: uniqueStrings([
        ...parseStringList(req.query.tags),
        ...parseStringList(req.query.tag),
      ]),
      department: req.query.department as string | undefined,
      grade: req.query.grade as string | undefined,
      sort: req.query.sort as 'recommended' | 'active' | 'members' | 'latest' | undefined,
      page: parsePositiveInt(req.query.page, 1),
      limit: parsePositiveInt(req.query.limit, 20),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /circles — create a custom circle for review
router.post('/', requireAuth, validate(createCustomCircleSchema), async (req, res, next) => {
  try {
    const circle = await createCustomCircle(req.auth!.userId, req.body);
    res.json({ message: '圈子已提交审核', circleId: circle.id, circle });
  } catch (err) {
    next(err);
  }
});

// GET /circles/my — must be BEFORE /:circleId to avoid conflict
router.get('/my', requireAuth, async (req, res, next) => {
  try {
    const result = await getMyCircles(req.auth!.userId);
    res.json({
      circles: result.map((circle) => ({
        id: circle.id,
        name: circle.name,
        slug: circle.slug,
        category: circle.category,
        tag: circle.tag,
        memberCount: circle.memberCount,
        isActive: circle.isActive,
        membershipStatus: circle.membership.membershipStatus,
        joinedAt: circle.membership.joinedAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /circles/my-created
router.get('/my-created', requireAuth, async (req, res, next) => {
  try {
    const circles = await listMyCreatedCircles(req.auth!.userId);
    res.json({ circles });
  } catch (err) {
    next(err);
  }
});

// GET /circles/join-requests/sent
router.get('/join-requests/sent', requireAuth, async (req, res, next) => {
  try {
    const result = await listSentJoinRequests(
      req.auth!.userId,
      parsePositiveInt(req.query.page, 1),
      parsePositiveInt(req.query.limit, 20),
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PUT /circles/join-requests/:requestId/withdraw
router.put('/join-requests/:requestId/withdraw', requireAuth, async (req, res, next) => {
  try {
    const requestId = parseUuidParam(req.params.requestId as string, 'requestId');
    const result = await withdrawCircleJoinRequest(req.auth!.userId, requestId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /circles/:circleId/manage/overview
router.get('/:circleId/manage/overview', requireAuth, async (req, res, next) => {
  try {
    const result = await getCircleManageOverview(req.params.circleId as string, req.auth!.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PATCH /circles/:circleId
router.patch('/:circleId', requireAuth, validate(updateManagedCircleSchema), async (req, res, next) => {
  try {
    const circle = await updateManagedCircle(req.params.circleId as string, req.auth!.userId, req.body);
    res.json({ message: '圈子已更新', circle });
  } catch (err) {
    next(err);
  }
});

// PUT /circles/:circleId/join-policy
router.put('/:circleId/join-policy', requireAuth, validate(joinPolicySchema), async (req, res, next) => {
  try {
    const circle = await updateCircleJoinPolicy(req.params.circleId as string, req.auth!.userId, req.body);
    res.json({ message: '入圈策略已更新', circle });
  } catch (err) {
    next(err);
  }
});

// GET /circles/:circleId/manage/members
router.get('/:circleId/manage/members', requireAuth, async (req, res, next) => {
  try {
    const result = await listCircleManageMembers(
      req.params.circleId as string,
      req.auth!.userId,
      parsePositiveInt(req.query.page, 1),
      parsePositiveInt(req.query.limit, 20),
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /circles/:circleId/members/:userId
router.delete('/:circleId/members/:userId', requireAuth, validate(removeMemberSchema), async (req, res, next) => {
  try {
    const result = await removeCircleMember(
      req.params.circleId as string,
      req.auth!.userId,
      req.params.userId as string,
      req.body,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /circles/:circleId/blacklist
router.get('/:circleId/blacklist', requireAuth, async (req, res, next) => {
  try {
    const result = await listCircleBlacklist(
      req.params.circleId as string,
      req.auth!.userId,
      parsePositiveInt(req.query.page, 1),
      parsePositiveInt(req.query.limit, 20),
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /circles/:circleId/blacklist
router.post('/:circleId/blacklist', requireAuth, validate(blacklistSchema), async (req, res, next) => {
  try {
    const result = await addCircleBlacklistUser(
      req.params.circleId as string,
      req.auth!.userId,
      req.body.userId,
      req.body.reason,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /circles/:circleId/blacklist/:userId
router.delete('/:circleId/blacklist/:userId', requireAuth, async (req, res, next) => {
  try {
    const result = await removeCircleBlacklistUser(
      req.params.circleId as string,
      req.auth!.userId,
      req.params.userId as string,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /circles/:circleId/transfer-owner
router.post('/:circleId/transfer-owner', requireAuth, validate(transferOwnerSchema), async (req, res, next) => {
  try {
    const result = await transferCircleOwner(
      req.params.circleId as string,
      req.auth!.userId,
      req.body.targetUserId,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /circles/:circleId
router.delete('/:circleId', requireAuth, async (req, res, next) => {
  try {
    const result = await archiveManagedCircle(req.params.circleId as string, req.auth!.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /circles/:circleId/audit-logs
router.get('/:circleId/audit-logs', requireAuth, async (req, res, next) => {
  try {
    const result = await listCircleAuditLogs(
      req.params.circleId as string,
      req.auth!.userId,
      parsePositiveInt(req.query.page, 1),
      parsePositiveInt(req.query.limit, 20),
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /circles/:circleId/join-requests
router.get('/:circleId/join-requests', requireAuth, async (req, res, next) => {
  try {
    const status = req.query.status as 'pending_review' | 'approved' | 'rejected' | 'expired' | 'withdrawn' | 'all' | undefined;
    const result = await listCircleJoinRequests(
      req.params.circleId as string,
      req.auth!.userId,
      status,
      parsePositiveInt(req.query.page, 1),
      parsePositiveInt(req.query.limit, 20),
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PUT /circles/:circleId/join-requests/:requestId
router.put('/:circleId/join-requests/:requestId', requireAuth, validate(reviewJoinRequestSchema), async (req, res, next) => {
  try {
    const result = await reviewCircleJoinRequest(
      req.params.circleId as string,
      req.params.requestId as string,
      req.auth!.userId,
      req.body,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PUT /circles/:circleId/requests/:requestId — frontend compatibility alias
router.put('/:circleId/requests/:requestId', requireAuth, validate(reviewJoinRequestCompatSchema), async (req, res, next) => {
  try {
    const result = await reviewCircleJoinRequest(
      req.params.circleId as string,
      req.params.requestId as string,
      req.auth!.userId,
      req.body,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /circles/:circleId/location/me
router.get('/:circleId/location/me', requireAuth, async (req, res, next) => {
  try {
    const result = await getCircleLocationStatus(req.params.circleId as string, req.auth!.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PUT /circles/:circleId/location
router.put('/:circleId/location', requireAuth, validate(updateLocationSchema), async (req, res, next) => {
  try {
    const result = await updateCircleLocation(
      req.params.circleId as string,
      req.auth!.userId,
      req.body,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /circles/:circleId/location
router.delete('/:circleId/location', requireAuth, async (req, res, next) => {
  try {
    const result = await disableCircleLocation(req.params.circleId as string, req.auth!.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /circles/:circleId/channel
router.get('/:circleId/channel', requireAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const radiusMeters = parseOptionalPositiveInt(req.query.radiusMeters);
    const result = await getChannelMembers(
      req.auth!.userId,
      req.params.circleId as string,
      page,
      limit,
      {
        nearby: parseBooleanFlag(req.query.nearby),
        radiusMeters,
        includeUnknownDistance: parseBooleanFlag(req.query.includeUnknownDistance),
      },
    );
    res.json({ ...result, page, limit });
  } catch (err) {
    next(err);
  }
});

// GET /circles/:circleId — circle detail + questions
router.get('/:circleId', requireAuth, async (req, res, next) => {
  try {
    const result = await getCircleDetail(req.params.circleId as string, req.auth!.userId);
    const { components, ...circle } = result;
    res.json({ circle, components });
  } catch (err) {
    next(err);
  }
});

// ─── Membership ─────────────────────────────────────────────────

// POST /circles/:circleId/join
router.post('/:circleId/join', requireAuth, validate(joinCircleSchema), async (req, res, next) => {
  try {
    const result = await joinCircle(req.params.circleId as string, req.auth!.userId, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /circles/:circleId/leave
router.delete('/:circleId/leave', requireAuth, async (req, res, next) => {
  try {
    const result = await leaveCircle(
      req.params.circleId as string,
      req.auth!.userId,
      {
        clearTrace: parseBooleanFlag(req.query.clearTrace),
        silent: parseBooleanFlag(req.query.silent),
      },
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PATCH /circles/:circleId/status
router.patch('/:circleId/status', requireAuth, validate(statusSchema), async (req, res, next) => {
  try {
    const result = await toggleCircleActive(
      req.params.circleId as string,
      req.auth!.userId,
      req.body.isActive,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─── Questionnaire ──────────────────────────────────────────────

// GET /circles/:circleId/questionnaire
router.get('/:circleId/questionnaire', requireAuth, async (req, res, next) => {
  try {
    const result = await getQuestionnaire(req.params.circleId as string, req.auth!.userId);
    res.json({ circleId: req.params.circleId as string, ...result });
  } catch (err) {
    next(err);
  }
});

// POST /circles/:circleId/questionnaire
router.post('/:circleId/questionnaire', requireAuth, validate(submitQuestionnaireSchema), async (req, res, next) => {
  try {
    const result = await submitQuestionnaire(
      req.params.circleId as string,
      req.auth!.userId,
      req.body.answers,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─── Match ──────────────────────────────────────────────────────

// GET /circles/:circleId/match/current
router.get('/:circleId/match/current', requireAuth, async (req, res, next) => {
  try {
    const match = await getCurrentCircleMatch(req.params.circleId as string, req.auth!.userId);
    if (!match) {
      res.json({ status: 'NO_MATCH', message: '本周暂无圈子匹配' });
      return;
    }
    res.json({ status: match.status, match });
  } catch (err) {
    next(err);
  }
});

// POST /circles/:circleId/match/action
router.post('/:circleId/match/action', requireAuth, validate(actionSchema), async (req, res, next) => {
  try {
    const result = await recordCircleAction(req.body.matchId, req.auth!.userId, req.body.action);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /circles/:circleId/match/history
router.get('/:circleId/match/history', requireAuth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const result = await getCircleMatchHistory(
      req.params.circleId as string,
      req.auth!.userId,
      page,
      limit,
    );
    res.json({
      ...result,
      limit,
      matches: result.matches.map((match) => ({
        id: match.matchId,
        weekOf: match.weekOf,
        score: match.score,
        status: match.status,
        ...(match.partner ? { partner: match.partner } : {}),
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
