import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getStudentIdBindStatus, sendStudentIdBindCode, verifyAndBindStudentId } from '../services/studentIdService.js';

const router = Router();

router.get('/bind/status', requireAuth, async (req, res, next) => {
  try {
    const data = await getStudentIdBindStatus(req.auth!.userId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

const sendCodeSchema = z.object({
  studentId: z.string().min(1).max(32),
});

router.post('/bind/send-code', requireAuth, validate(sendCodeSchema), async (req, res, next) => {
  try {
    const result = await sendStudentIdBindCode(req.auth!.userId, req.body.studentId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

const verifySchema = z.object({
  studentId: z.string().min(1).max(32),
  code: z.string().length(6),
});

router.post('/bind/verify', requireAuth, validate(verifySchema), async (req, res, next) => {
  try {
    const result = await verifyAndBindStudentId(req.auth!.userId, req.body.studentId, req.body.code);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;

