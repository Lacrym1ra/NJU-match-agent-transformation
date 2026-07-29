import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { isMatchingLocked } from '../utils/lockdown.js';
import { ValidationError } from '../utils/errors.js';
import * as surveyService from '../services/surveyService.js';

const router = Router();

const submitSurveySchema = z.object({
  answers: z.record(
    z.string(),
    z.object({
      value: z.unknown(),
      importance: z.number().int().min(1).max(5).optional(),
    }),
  ),
});

// GET /survey/questions (public)
router.get('/questions', (_req, res) => {
  res.json(surveyService.getQuestions());
});

// POST /survey/submit (auth required)
router.post('/submit', requireAuth, validate(submitSurveySchema), async (req, res, next) => {
  try {
    if (isMatchingLocked()) {
      throw new ValidationError('本周匹配正在计算中，问卷提交通道将于周三 20:00 重新开放');
    }
    const result = await surveyService.submitAnswers(req.auth!.userId, req.body.answers);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /survey/answers (auth required)
router.get('/answers', requireAuth, async (req, res, next) => {
  try {
    const result = await surveyService.getAnswers(req.auth!.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
