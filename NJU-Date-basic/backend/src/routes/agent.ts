import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { agentActionService } from '../services/agentActionService.js';
import { agentReadService } from '../services/agentReadService.js';
import { createAgentChatReply } from '../services/agentChatService.js';
import { planAgentQuery } from '../services/agentQueryPlanner.js';
import { listActiveCircleChatMemberIds } from '../modules/chat/circleChat.js';
import { listActiveTeamupChatMemberIds } from '../modules/chat/teamupChat.js';
import { circleChatHub, teamupChatHub } from '../realtime/roomHub.js';
import { AGENT_ACTION_KINDS } from '../services/agentActionStore.js';

const router = Router();
const postType = z.enum(['general', 'squad', 'help', 'trade', 'activity']);
const agentActionKind = z.enum(AGENT_ACTION_KINDS);
const safeResourceId = z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9_-]+$/);
const agentContact = z.object({
  type: z.string().trim().min(1).max(30),
  value: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(30).optional(),
});
const agentPageContextSchema = z.object({
  pathname: z.string().trim().startsWith('/').max(300),
  pageType: z.enum([
    'dashboard', 'circle', 'circle_livechat', 'forum', 'forum_post', 'match',
    'teamup', 'teamup_chat', 'survey', 'messages', 'profile', 'settings', 'notifications', 'other',
    'resonance', 'meetup_safety',
  ]),
  resourceId: z.string().trim().min(1).max(120).optional(),
  parentResourceId: z.string().trim().min(1).max(120).optional(),
  title: z.string().trim().min(1).max(160).optional(),
}).strict();

router.post('/chat', requireAuth, validate(z.object({
  message: z.string().trim().min(1).max(2_000),
  pageContext: agentPageContextSchema.optional(),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().min(1).max(1_000),
  }).strict()).max(6).optional(),
  sessionId: z.string().uuid().optional(),
})), async (req, res, next) => {
  try {
    res.json(await createAgentChatReply(
      req.auth!.userId, req.body.message, req.body.pageContext, req.body.history,
      req.body.sessionId,
    ));
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
    const query = String(req.query.q ?? '').slice(0, 2_000);
    const profile = await agentReadService.getMyProfileStatus(req.auth!.userId);
    const plan = planAgentQuery(query, profile);
    const result = await agentReadService.searchCircles(req.auth!.userId, {
      query: '', keywords: plan.keywords, sort: 'recommended', limit: plan.circleLimit,
      includeJoined: plan.includeJoinedCircles,
    });
    res.json(result);
  } catch (error) { next(error); }
});

router.get('/posts', requireAuth, async (req, res, next) => {
  try {
    const userId = req.auth!.userId;
    const query = String(req.query.q ?? '').slice(0, 2_000);
    const profile = await agentReadService.getMyProfileStatus(userId);
    const plan = planAgentQuery(query, profile);
    const circles = await agentReadService.searchCircles(userId, {
      query: '', keywords: plan.keywords, sort: 'recommended', limit: plan.circleLimit,
      includeJoined: plan.includeJoinedCircles,
    });
    const result = await agentReadService.searchForumPostsAcrossCircles(userId, {
      query: '', keywords: plan.keywords, types: plan.forumTypes, sort: 'latest',
      limit: plan.postLimit, circleIds: circles.circles.map((circle) => circle.id),
    });
    res.json(result);
  } catch (error) { next(error); }
});

router.post('/drafts', requireAuth, validate(z.object({
  circleId: safeResourceId.optional(), title: z.string().trim().min(1).max(100),
  content: z.string().trim().min(1).max(10_000), type: postType,
  isAnonymous: z.boolean().optional(),
})), async (req, res, next) => {
  try {
    res.status(201).json({ draft: await agentActionService.createDraft(req.auth!.userId, req.body) });
  } catch (error) { next(error); }
});

router.post('/confirmations', requireAuth, validate(z.object({
  action: agentActionKind,
  resourceId: z.string().min(1).max(120),
})), async (req, res, next) => {
  try {
    res.json(await agentActionService.requestConfirmation(req.auth!.userId, req.body.action, req.body.resourceId));
  } catch (error) { next(error); }
});

router.post('/livechat-drafts', requireAuth, validate(z.object({
  circleId: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(1_000),
  mentions: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
})), async (req, res, next) => {
  try {
    res.status(201).json({
      draft: await agentActionService.createLiveChatDraft(req.auth!.userId, req.body),
    });
  } catch (error) { next(error); }
});

const createActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('comment_post'), payload: z.object({
    postId: safeResourceId, content: z.string().trim().min(1).max(5_000),
    parentCommentId: safeResourceId.optional(),
  }) }),
  z.object({ kind: z.literal('like_post'), payload: z.object({ postId: safeResourceId }) }),
  z.object({ kind: z.literal('favorite_post'), payload: z.object({ postId: safeResourceId }) }),
  z.object({ kind: z.literal('join_teamup'), payload: z.object({
    circleId: safeResourceId, teamupId: safeResourceId,
    contacts: z.array(agentContact).min(1).max(3),
  }) }),
  z.object({ kind: z.literal('apply_teamup'), payload: z.object({
    circleId: safeResourceId, teamupId: safeResourceId,
    applicationNote: z.string().trim().min(1).max(300),
    contacts: z.array(agentContact).min(1).max(3),
  }) }),
  z.object({ kind: z.literal('send_teamup_chat'), payload: z.object({
    circleId: safeResourceId, teamupId: safeResourceId,
    content: z.string().trim().min(1).max(1_000),
  }) }),
  z.object({ kind: z.literal('match_action'), payload: z.object({
    matchId: safeResourceId, action: z.enum(['ACCEPT', 'REJECT']),
  }) }),
  z.object({ kind: z.literal('mark_notification_read'), payload: z.object({ notificationId: safeResourceId }) }),
  z.object({ kind: z.literal('mark_all_notifications_read'), payload: z.object({}) }),
  z.object({ kind: z.literal('create_resonance_capsule'), payload: z.object({
    title: z.string().trim().min(1).max(80), prompt: z.string().trim().min(1).max(500),
    expiresInDays: z.number().int().min(1).max(30).default(7),
  }) }),
  z.object({ kind: z.literal('create_meetup_safety_plan'), payload: z.object({
    title: z.string().trim().min(1).max(100), meetingPlace: z.string().trim().min(1).max(200),
    meetingAt: z.string().datetime(), expectedEndAt: z.string().datetime(),
    note: z.string().trim().max(500).optional(),
  }) }),
]);

router.post('/actions', requireAuth, validate(createActionSchema), async (req, res, next) => {
  try {
    res.status(201).json(await agentActionService.createAction(req.auth!.userId, req.body.kind, req.body.payload));
  } catch (error) { next(error); }
});

router.post('/actions/:actionId/execute', requireAuth, validate(z.object({
  kind: agentActionKind,
  confirmationToken: z.string().min(1).max(120),
})), async (req, res, next) => {
  try {
    const result = await agentActionService.executeAction(
      req.auth!.userId, req.params.actionId as string, req.body.kind, req.body.confirmationToken,
    );
    if (req.body.kind === 'send_teamup_chat' && result && typeof result === 'object') {
      const message = result as { circleId: string; teamupId: string };
      await teamupChatHub.broadcast(message.teamupId, {
        type: 'chat.message', message: { ...(result as any), isOwn: false } as any,
      }, {
        canReceiveMany: (userIds) => listActiveTeamupChatMemberIds(message.circleId, message.teamupId, userIds),
      });
    }
    res.json({ result });
  } catch (error) { next(error); }
});

router.post('/livechat-drafts/:draftId/send', requireAuth, validate(z.object({
  confirmationToken: z.string().min(1).max(120),
})), async (req, res, next) => {
  try {
    const message = await agentActionService.sendLiveChatDraft(
      req.auth!.userId, req.params.draftId as string, req.body.confirmationToken,
    );
    await circleChatHub.broadcast(message.circleId, {
      type: 'chat.message', message: { ...message, isOwn: false },
    }, {
      canReceiveMany: (userIds) => listActiveCircleChatMemberIds(message.circleId, userIds),
    });
    res.status(201).json({ message });
  } catch (error) { next(error); }
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
