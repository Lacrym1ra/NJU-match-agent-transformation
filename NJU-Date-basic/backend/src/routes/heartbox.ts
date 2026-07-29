import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { cancelActiveHeartSignal, createOrReplaceHeartSignal, getCurrentHeartboxReveal, getHeartboxMe } from '../services/heartboxService.js';
import { heartboxSignalMinuteLimiter } from '../middleware/rateLimit.js';

const router = Router();

// GET /heartbox/me
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const data = await getHeartboxMe(req.auth!.userId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /heartbox/match/current
router.get('/match/current', requireAuth, async (req, res, next) => {
  try {
    const data = await getCurrentHeartboxReveal(req.auth!.userId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

const signalSchema = z.object({
  targetStudentId: z.string().min(1).max(32),
});

// POST /heartbox/signal
router.post('/signal', requireAuth, heartboxSignalMinuteLimiter, validate(signalSchema), async (req, res, next) => {
  try {
    const result = await createOrReplaceHeartSignal(req.auth!.userId, req.body.targetStudentId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /heartbox/signal
router.delete('/signal', requireAuth, async (req, res, next) => {
  try {
    await cancelActiveHeartSignal(req.auth!.userId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
