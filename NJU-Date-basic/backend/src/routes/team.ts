import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ValidationError } from '../utils/errors.js';
import {
  applyToTeamup,
  cancelTeamup,
  containsContactLikeText,
  createTeamup,
  getPublicTeamupSummary,
  getTeamupContacts,
  getTeamupDetail,
  joinTeamupDirect,
  listMyTeamupApplicationReplies,
  leaveTeamup,
  listMyTeamupHistory,
  listTeamupApplications,
  listTeamups,
  reviewTeamupApplication,
  updateTeamup,
  withdrawTeamupApplication,
} from '../modules/teamups/flow.js';

const router = Router();

const contactSchema = z.object({
  type: z.string().trim().min(1).max(30),
  value: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(30).optional(),
});

const descriptionSchema = z.string().trim().min(1).max(2000).refine(
  (value) => !containsContactLikeText(value),
  { message: '描述中不要填写手机号、微信、邮箱等联系方式，请填写在联系方式字段中' },
);

const createTeamupSchema = z.object({
  title: z.string().trim().min(1).max(60),
  description: descriptionSchema,
  maxMembers: z.number().int().min(2),
  deadlineAt: z.string().datetime({ offset: true }),
  endAt: z.string().datetime({ offset: true }),
  teamupType: z.enum(['short_term', 'long_term']),
  joinMode: z.enum(['direct', 'approval']),
  isPublic: z.boolean(),
  contacts: z.array(contactSchema).min(1).max(3),
});

const updateTeamupSchema = z.object({
  title: z.string().trim().min(1).max(60).optional(),
  description: descriptionSchema.optional(),
  maxMembers: z.number().int().min(2).optional(),
  deadlineAt: z.string().datetime({ offset: true }).optional(),
  endAt: z.string().datetime({ offset: true }).optional(),
  teamupType: z.enum(['short_term', 'long_term']).optional(),
  joinMode: z.enum(['direct', 'approval']).optional(),
  isPublic: z.boolean().optional(),
  contacts: z.array(contactSchema).min(1).max(3).optional(),
});

const directJoinSchema = z.object({
  contacts: z.array(contactSchema).min(1).max(3),
});

const applicationSchema = z.object({
  applicationNote: z.string().trim().min(1).max(300),
  contacts: z.array(contactSchema).min(1).max(3),
});

const reviewApplicationSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reviewNote: z.string().trim().max(300).optional(),
});

const cancelTeamupSchema = z.object({
  reason: z.string().trim().max(500).optional(),
  cancelSource: z.enum(['leader', 'admin']).default('leader'),
  confirmCancel: z.boolean(),
});

function parseUuidParam(value: string, field: string): string {
  const result = z.string().uuid().safeParse(value);
  if (!result.success) {
    throw new ValidationError(`${field} 必须是合法的 UUID`);
  }
  return result.data;
}

function parsePageQuery(req: { query: Record<string, unknown> }) {
  const rawPage = Number(req.query.page ?? 1);
  const rawLimit = Number(req.query.limit ?? 20);
  const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1;
  const limit = Number.isFinite(rawLimit) ? Math.min(50, Math.max(1, Math.floor(rawLimit))) : 20;
  return { page, limit };
}

// GET /teamups/public/:teamupId — public forum-safe summary
router.get('/teamups/public/:teamupId', async (req, res, next) => {
  try {
    const teamupId = parseUuidParam(req.params.teamupId as string, 'teamupId');
    const result = await getPublicTeamupSummary(teamupId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /teamups/applications/replies — review results for applications I sent
router.get('/teamups/applications/replies', requireAuth, async (req, res, next) => {
  try {
    const { page, limit } = parsePageQuery(req);
    const result = await listMyTeamupApplicationReplies(req.auth!.userId, { page, limit });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /circles/:circleId/teamups — list visible teamups
router.get('/circles/:circleId/teamups', requireAuth, async (req, res, next) => {
  try {
    const circleId = parseUuidParam(req.params.circleId as string, 'circleId');
    const { page, limit } = parsePageQuery(req);
    const result = await listTeamups(req.auth!.userId, circleId, {
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      visibility: typeof req.query.visibility === 'string' ? req.query.visibility : undefined,
      joinMode: typeof req.query.joinMode === 'string' ? req.query.joinMode : undefined,
      teamupType: typeof req.query.teamupType === 'string' ? req.query.teamupType : undefined,
      mine: typeof req.query.mine === 'string' ? req.query.mine : undefined,
      keyword: typeof req.query.keyword === 'string' ? req.query.keyword : undefined,
      page,
      limit,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /circles/:circleId/teamups/my/history — must be before /:teamupId
router.get('/circles/:circleId/teamups/my/history', requireAuth, async (req, res, next) => {
  try {
    const circleId = parseUuidParam(req.params.circleId as string, 'circleId');
    const { page, limit } = parsePageQuery(req);
    const result = await listMyTeamupHistory(req.auth!.userId, circleId, {
      role: typeof req.query.role === 'string' ? req.query.role : undefined,
      visibility: typeof req.query.visibility === 'string' ? req.query.visibility : undefined,
      page,
      limit,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /circles/:circleId/teamups
router.post('/circles/:circleId/teamups', requireAuth, validate(createTeamupSchema), async (req, res, next) => {
  try {
    const circleId = parseUuidParam(req.params.circleId as string, 'circleId');
    const result = await createTeamup(req.auth!.userId, circleId, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /circles/:circleId/teamups/:teamupId
router.get('/circles/:circleId/teamups/:teamupId', requireAuth, async (req, res, next) => {
  try {
    const circleId = parseUuidParam(req.params.circleId as string, 'circleId');
    const teamupId = parseUuidParam(req.params.teamupId as string, 'teamupId');
    const result = await getTeamupDetail(req.auth!.userId, circleId, teamupId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PATCH /circles/:circleId/teamups/:teamupId
router.patch('/circles/:circleId/teamups/:teamupId', requireAuth, validate(updateTeamupSchema), async (req, res, next) => {
  try {
    const circleId = parseUuidParam(req.params.circleId as string, 'circleId');
    const teamupId = parseUuidParam(req.params.teamupId as string, 'teamupId');
    const result = await updateTeamup(req.auth!.userId, circleId, teamupId, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /circles/:circleId/teamups/:teamupId/join
router.post('/circles/:circleId/teamups/:teamupId/join', requireAuth, validate(directJoinSchema), async (req, res, next) => {
  try {
    const circleId = parseUuidParam(req.params.circleId as string, 'circleId');
    const teamupId = parseUuidParam(req.params.teamupId as string, 'teamupId');
    const result = await joinTeamupDirect(req.auth!.userId, circleId, teamupId, req.body.contacts);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /circles/:circleId/teamups/:teamupId/applications
router.post('/circles/:circleId/teamups/:teamupId/applications', requireAuth, validate(applicationSchema), async (req, res, next) => {
  try {
    const circleId = parseUuidParam(req.params.circleId as string, 'circleId');
    const teamupId = parseUuidParam(req.params.teamupId as string, 'teamupId');
    const result = await applyToTeamup(
      req.auth!.userId,
      circleId,
      teamupId,
      req.body.applicationNote,
      req.body.contacts,
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /circles/:circleId/teamups/:teamupId/applications
router.get('/circles/:circleId/teamups/:teamupId/applications', requireAuth, async (req, res, next) => {
  try {
    const circleId = parseUuidParam(req.params.circleId as string, 'circleId');
    const teamupId = parseUuidParam(req.params.teamupId as string, 'teamupId');
    const { page, limit } = parsePageQuery(req);
    const result = await listTeamupApplications(req.auth!.userId, circleId, teamupId, {
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      page,
      limit,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PATCH /circles/:circleId/teamups/:teamupId/applications/:applicationId
router.patch('/circles/:circleId/teamups/:teamupId/applications/:applicationId', requireAuth, validate(reviewApplicationSchema), async (req, res, next) => {
  try {
    const circleId = parseUuidParam(req.params.circleId as string, 'circleId');
    const teamupId = parseUuidParam(req.params.teamupId as string, 'teamupId');
    const applicationId = parseUuidParam(req.params.applicationId as string, 'applicationId');
    const result = await reviewTeamupApplication(
      req.auth!.userId,
      circleId,
      teamupId,
      applicationId,
      req.body.action,
      req.body.reviewNote,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PUT /circles/:circleId/teamups/:teamupId/applications/:applicationId/withdraw
router.put('/circles/:circleId/teamups/:teamupId/applications/:applicationId/withdraw', requireAuth, async (req, res, next) => {
  try {
    const circleId = parseUuidParam(req.params.circleId as string, 'circleId');
    const teamupId = parseUuidParam(req.params.teamupId as string, 'teamupId');
    const applicationId = parseUuidParam(req.params.applicationId as string, 'applicationId');
    const result = await withdrawTeamupApplication(req.auth!.userId, circleId, teamupId, applicationId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /circles/:circleId/teamups/:teamupId/members/me
router.delete('/circles/:circleId/teamups/:teamupId/members/me', requireAuth, async (req, res, next) => {
  try {
    const circleId = parseUuidParam(req.params.circleId as string, 'circleId');
    const teamupId = parseUuidParam(req.params.teamupId as string, 'teamupId');
    const result = await leaveTeamup(req.auth!.userId, circleId, teamupId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /circles/:circleId/teamups/:teamupId/cancel
router.post('/circles/:circleId/teamups/:teamupId/cancel', requireAuth, validate(cancelTeamupSchema), async (req, res, next) => {
  try {
    const circleId = parseUuidParam(req.params.circleId as string, 'circleId');
    const teamupId = parseUuidParam(req.params.teamupId as string, 'teamupId');
    const result = await cancelTeamup(req.auth!.userId, circleId, teamupId, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /circles/:circleId/teamups/:teamupId/contacts
router.get('/circles/:circleId/teamups/:teamupId/contacts', requireAuth, async (req, res, next) => {
  try {
    const circleId = parseUuidParam(req.params.circleId as string, 'circleId');
    const teamupId = parseUuidParam(req.params.teamupId as string, 'teamupId');
    const result = await getTeamupContacts(req.auth!.userId, circleId, teamupId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
