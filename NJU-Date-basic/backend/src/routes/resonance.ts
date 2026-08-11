import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  cancelResonanceCapsule,
  createResonanceCapsule,
  getResonanceCapsule,
  joinResonanceCapsule,
  listResonanceCapsules,
  respondToResonanceCapsule,
} from '../services/resonanceService.js';
import { ValidationError } from '../utils/errors.js';

const router = Router();
const resourceId = z.string().uuid();
function parseResourceId(value: string | string[] | undefined) {
  const parsed = resourceId.safeParse(value);
  if (!parsed.success) throw new ValidationError('资源 ID 无效');
  return parsed.data;
}

router.get('/', requireAuth, async (req, res, next) => {
  try { res.json(await listResonanceCapsules(req.auth!.userId)); } catch (error) { next(error); }
});

router.post('/', requireAuth, validate(z.object({
  title: z.string().trim().min(1).max(80),
  prompt: z.string().trim().min(1).max(500),
  expiresInDays: z.number().int().min(1).max(30).optional(),
}).strict()), async (req, res, next) => {
  try { res.status(201).json(await createResonanceCapsule(req.auth!.userId, req.body)); } catch (error) { next(error); }
});

router.post('/join', requireAuth, validate(z.object({
  inviteCode: z.string().trim().min(8).max(9),
}).strict()), async (req, res, next) => {
  try { res.json(await joinResonanceCapsule(req.auth!.userId, req.body.inviteCode)); } catch (error) { next(error); }
});

router.get('/:capsuleId', requireAuth, async (req, res, next) => {
  try {
    const capsuleId = parseResourceId(req.params.capsuleId);
    res.json(await getResonanceCapsule(req.auth!.userId, capsuleId));
  } catch (error) { next(error); }
});

router.post('/:capsuleId/responses', requireAuth, validate(z.object({
  response: z.string().trim().min(1).max(2_000),
}).strict()), async (req, res, next) => {
  try {
    const capsuleId = parseResourceId(req.params.capsuleId);
    res.json(await respondToResonanceCapsule(req.auth!.userId, capsuleId, req.body.response));
  } catch (error) { next(error); }
});

router.post('/:capsuleId/cancel', requireAuth, async (req, res, next) => {
  try {
    const capsuleId = parseResourceId(req.params.capsuleId);
    res.json(await cancelResonanceCapsule(req.auth!.userId, capsuleId));
  } catch (error) { next(error); }
});

export default router;
