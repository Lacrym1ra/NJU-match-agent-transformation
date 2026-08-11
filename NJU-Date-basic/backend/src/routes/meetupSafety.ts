import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createMeetupSafetyPlan,
  getMeetupSafetyPlan,
  listMeetupSafetyPlans,
  transitionMeetupSafetyPlan,
} from '../services/meetupSafetyService.js';
import { ValidationError } from '../utils/errors.js';

const router = Router();
const resourceId = z.string().uuid();
function parseResourceId(value: string | string[] | undefined) {
  const parsed = resourceId.safeParse(value);
  if (!parsed.success) throw new ValidationError('资源 ID 无效');
  return parsed.data;
}

router.get('/', requireAuth, async (req, res, next) => {
  try { res.json(await listMeetupSafetyPlans(req.auth!.userId)); } catch (error) { next(error); }
});

router.post('/', requireAuth, validate(z.object({
  title: z.string().trim().min(1).max(100),
  meetingPlace: z.string().trim().min(1).max(200),
  meetingAt: z.string().datetime(),
  expectedEndAt: z.string().datetime(),
  note: z.string().trim().max(500).optional(),
}).strict()), async (req, res, next) => {
  try { res.status(201).json(await createMeetupSafetyPlan(req.auth!.userId, req.body)); } catch (error) { next(error); }
});

router.get('/:planId', requireAuth, async (req, res, next) => {
  try {
    const planId = parseResourceId(req.params.planId);
    res.json(await getMeetupSafetyPlan(req.auth!.userId, planId));
  } catch (error) { next(error); }
});

router.post('/:planId/transitions', requireAuth, validate(z.object({
  transition: z.enum(['check_in', 'complete', 'cancel']),
}).strict()), async (req, res, next) => {
  try {
    const planId = parseResourceId(req.params.planId);
    res.json(await transitionMeetupSafetyPlan(req.auth!.userId, planId, req.body.transition));
  } catch (error) { next(error); }
});

export default router;
