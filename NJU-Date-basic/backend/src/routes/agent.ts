import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { agentActionService } from '../services/agentActionService.js';
import { agentReadService } from '../services/agentReadService.js';
import { createAgentChatReply } from '../services/agentChatService.js';

const router = Router();
const postType = z.enum(['general', 'squad', 'help', 'trade', 'activity']);

router.post('/chat', requireAuth, validate(z.object({
  message: z.string().trim().min(1).max(2_000),
})), async (req, res, next) => {
  try {
    res.json(await createAgentChatReply(req.auth!.userId, req.body.message));
  } catch (error) { next(error); }
});

router.get('/status', requireAuth, async (req, res, next) => {
  try {
    const userId = req.auth!.userId;
    const [profile, questionnaire] = await Promise.all([
      agentReadService.getMyProfileStatus(userId),
      agentReadService.getQuestionnaireStatus(userId),
    ]);
    res.json({ profile, questionnaire });
  } catch (error) { next(error); }
});

router.get('/circles', requireAuth, async (req, res, next) => {
  try {
    const result = await agentReadService.searchCircles(req.auth!.userId, {
      query: String(req.query.q ?? ''), sort: 'recommended', limit: 6,
    });
    res.json(result);
  } catch (error) { next(error); }
});

router.get('/posts', requireAuth, async (req, res, next) => {
  try {
    const result = await agentReadService.searchForumPosts(req.auth!.userId, {
      query: String(req.query.q ?? ''), sort: 'latest', limit: 6,
    });
    res.json(result);
  } catch (error) { next(error); }
});

router.post('/drafts', requireAuth, validate(z.object({
  circleId: z.string().uuid().optional(), title: z.string().trim().min(1).max(100),
  content: z.string().trim().min(1).max(10_000), type: postType,
  isAnonymous: z.boolean().optional(),
})), (req, res) => {
  res.status(201).json({ draft: agentActionService.createDraft(req.auth!.userId, req.body) });
});

router.post('/confirmations', requireAuth, validate(z.object({
  action: z.enum(['publish_post', 'join_circle']), resourceId: z.string().min(1).max(100),
})), (req, res) => {
  res.json(agentActionService.requestConfirmation(req.auth!.userId, req.body.action, req.body.resourceId));
});

router.post('/drafts/:draftId/publish', requireAuth, validate(z.object({
  confirmationToken: z.string().min(1).max(100),
})), async (req, res, next) => {
  try {
    res.status(201).json(await agentActionService.publishDraft(
      req.auth!.userId, req.params.draftId as string, req.body.confirmationToken,
    ));
  } catch (error) { next(error); }
});

router.post('/circles/:circleId/join', requireAuth, validate(z.object({
  confirmationToken: z.string().min(1).max(100),
  applicationReason: z.string().trim().max(300).optional(),
})), async (req, res, next) => {
  try {
    res.json(await agentActionService.confirmJoin(
      req.auth!.userId, req.params.circleId as string,
      req.body.confirmationToken, req.body.applicationReason,
    ));
  } catch (error) { next(error); }
});

export default router;
