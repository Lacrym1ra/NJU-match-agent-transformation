import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  listPosts,
  createPost,
  getPostDetail,
  createComment,
  deletePost,
  deleteComment,
  listMyPosts,
  listLikedPosts,
  listFavoritedPosts,
  listMessages,
  updatePostPrivacy,
  togglePostAnonymity,
  likePost,
  unlikePost,
  favoritePost,
  unfavoritePost,
  getHotRanking,
  listAnnouncements,
  getAnnouncement,
  listGuestbookMessages,
  createGuestbookMessage,
  deleteGuestbookMessage,
  transcribeComment,
  getCommentReplies,
  likeComment,
  unlikeComment,
  dismissMessage,
  getUserPublicProfile,
  listUserPublicPosts,
  pinComment,
  unpinComment,
  votePostPoll,
} from '../services/forumService.js';
import { submitForumReport } from '../services/forumGovernanceService.js';

const router = Router();

// ─── Validation schemas ─────────────────────────────────────────

const forumPostType = z.enum(['general', 'squad', 'help', 'trade', 'activity']);
const forumVisibility = z.enum(['public', 'private']);
const forumCommentType = z.enum(['text', 'voice']);
const forumSort = z.enum(['latest', 'hot', 'recommended']);
const authorScope = z.enum(['all', 'mine', 'liked', 'favorited']);
const hotRankingRange = z.enum(['day', 'week', 'month']);

const createPostSchema = z.object({
  circleId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(30),
  content: z.string().trim().min(1).max(10000),
  type: forumPostType,
  isAnonymous: z.boolean().optional(),
  visibility: forumVisibility.optional(),
  images: z.array(z.string().min(1).max(500)).max(9).optional(),
  pollOptions: z.array(z.string().trim().min(1).max(15)).max(4).optional(),
});

const createCommentSchema = z
  .object({
    content: z.string().trim().max(2000).optional(),
    parentCommentId: z.string().min(1).max(100).nullable().optional(),
    commentType: forumCommentType.optional(),
    voiceUrl: z.string().min(1).max(500).optional(),
    voiceDurationSec: z.number().int().min(1).max(300).optional(),
    imageUrl: z.string().min(1).max(500).optional(),
  })
  .superRefine((data, ctx) => {
    const hasContent = !!data.content?.trim();
    const hasVoice = !!data.voiceUrl;
    const hasImage = !!data.imageUrl;
    const hasAnyMedia = hasContent || hasVoice || hasImage;

    if (!hasAnyMedia) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '评论内容不能为空',
        path: ['content'],
      });
    }

    if (data.voiceDurationSec !== undefined && !data.voiceUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '只有语音评论才能带语音时长',
        path: ['voiceDurationSec'],
      });
    }

    if (
      data.imageUrl &&
      !/^https?:\/\//i.test(data.imageUrl) &&
      !data.imageUrl.startsWith('/')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '图片地址格式不正确',
        path: ['imageUrl'],
      });
    }
  });

const updatePrivacySchema = z.object({
  visibility: forumVisibility,
});

const toggleAnonymitySchema = z.object({
  isAnonymous: z.boolean(),
});

const pinCommentSchema = z.object({
  commentId: z.string().trim().min(1),
});

const votePollSchema = z.object({
  optionId: z.string().trim().min(1),
});

const guestbookMessageSchema = z.object({
  content: z.string().trim().min(1).max(200),
});

// ─── Announcements & Guestbook (before /posts to avoid route conflicts) ──

// GET /forum/announcements — list active announcements (titles only, no content)
router.get('/announcements', requireAuth, async (_req, res, next) => {
  try {
    const result = await listAnnouncements();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /forum/announcements/:id — announcement detail with full content
router.get('/announcements/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await getAnnouncement(req.params.id as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /forum/guestbook/messages — list guestbook messages
router.get('/guestbook/messages', requireAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const result = await listGuestbookMessages(page, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /forum/guestbook/messages — create guestbook message
router.post(
  '/guestbook/messages',
  requireAuth,
  validate(guestbookMessageSchema),
  async (req, res, next) => {
    try {
      const result = await createGuestbookMessage(req.auth!.userId, req.body.content);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /forum/guestbook/messages/:id — delete own guestbook message
router.delete('/guestbook/messages/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await deleteGuestbookMessage(req.auth!.userId, req.params.id as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─── Hot Ranking ─────────────────────────────────────────────────

// GET /forum/ranking/hot — hot ranking
router.get('/ranking/hot', requireAuth, async (req, res, next) => {
  try {
    const range = hotRankingRange.parse((req.query.range as string) || 'week');
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const result = await getHotRanking({ range, limit });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

const createReportSchema = z.object({
  targetType: z.enum(['post', 'comment', 'user']),
  postId: z.string().uuid().optional(),
  commentId: z.string().uuid().optional(),
  reportedUserId: z.string().uuid().optional(),
  reasons: z.array(
    z.enum(['pornographic', 'violent', 'personal_attack', 'provocation', 'ad_spam', 'junk_info', 'privacy_violation', 'other']),
  ).min(1).max(8),
  detail: z.string().trim().max(2000).optional(),
}).superRefine((value, ctx) => {
  if (value.targetType === 'post' && !value.postId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['postId'], message: '举报帖子时必须传 postId' });
  }
  if (value.targetType === 'comment' && !value.commentId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['commentId'], message: '举报评论时必须传 commentId' });
  }
  if (value.targetType === 'user' && !value.reportedUserId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['reportedUserId'], message: '举报用户时必须传 reportedUserId' });
  }
});

// ─── Me Aggregation ─────────────────────────────────────────────

router.get('/me/posts', requireAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const result = await listMyPosts(req.auth!.userId, { page, limit });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/me/liked-posts', requireAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const result = await listLikedPosts(req.auth!.userId, { page, limit });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/me/favorited-posts', requireAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const result = await listFavoritedPosts(req.auth!.userId, { page, limit });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/me/messages', requireAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const result = await listMessages(req.auth!.userId, { page, limit });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.delete('/me/messages/:messageId', requireAuth, async (req, res, next) => {
  try {
    const result = await dismissMessage(req.auth!.userId, req.params.messageId as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─── Users ──────────────────────────────────────────────────────

router.get('/users/:targetUserId/profile', requireAuth, async (req, res, next) => {
  try {
    const result = await getUserPublicProfile(req.params.targetUserId as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/users/:targetUserId/posts', requireAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const result = await listUserPublicPosts(req.auth!.userId, req.params.targetUserId as string, { page, limit });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─── Posts ──────────────────────────────────────────────────────

// GET /forum/posts — list posts
router.get('/posts', requireAuth, async (req, res, next) => {
  try {
    const circleId = (req.query.circleId as string | undefined)?.trim() || undefined;
    const typeRaw = (req.query.type as string | undefined)?.trim();
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));

    let type: z.infer<typeof forumPostType> | undefined;
    if (typeRaw) {
      const parsed = forumPostType.safeParse(typeRaw);
      if (!parsed.success) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '无效的帖子类型' } });
        return;
      }
      type = parsed.data;
    }

    const sortRaw = (req.query.sort as string | undefined)?.trim();
    const sort = forumSort.safeParse(sortRaw).success
      ? (sortRaw as z.infer<typeof forumSort>)
      : undefined;

    const keyword = (req.query.keyword as string | undefined)?.trim() || undefined;

    const scopeRaw = (req.query.authorScope as string | undefined)?.trim();
    const scope = authorScope.safeParse(scopeRaw).success
      ? (scopeRaw as z.infer<typeof authorScope>)
      : undefined;

    const result = await listPosts(req.auth!.userId, {
      circleId,
      type,
      page,
      limit,
      sort,
      authorScope: scope,
      keyword,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /forum/posts — create post
router.post('/posts', requireAuth, validate(createPostSchema), async (req, res, next) => {
  try {
    const result = await createPost(req.auth!.userId, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /forum/posts/:postId — post detail + comments
router.get('/posts/:postId', requireAuth, async (req, res, next) => {
  try {
    const result = await getPostDetail(req.auth!.userId, req.params.postId as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PUT /forum/posts/:postId/pinned-comment — pin a level-1 comment
router.put(
  '/posts/:postId/pinned-comment',
  requireAuth,
  validate(pinCommentSchema),
  async (req, res, next) => {
    try {
      const result = await pinComment(
        req.auth!.userId,
        req.params.postId as string,
        req.body.commentId,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /forum/posts/:postId/pinned-comment — unpin current comment
router.delete('/posts/:postId/pinned-comment', requireAuth, async (req, res, next) => {
  try {
    const result = await unpinComment(req.auth!.userId, req.params.postId as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /forum/posts/:postId/poll/vote — vote in a post poll
router.post(
  '/posts/:postId/poll/vote',
  requireAuth,
  validate(votePollSchema),
  async (req, res, next) => {
    try {
      const result = await votePostPoll(
        req.auth!.userId,
        req.params.postId as string,
        req.body.optionId,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /forum/posts/:postId — soft delete own post
router.delete('/posts/:postId', requireAuth, async (req, res, next) => {
  try {
    const result = await deletePost(req.auth!.userId, req.params.postId as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PATCH /forum/posts/:postId/anonymity — toggle anonymous state
router.patch(
  '/posts/:postId/anonymity',
  requireAuth,
  validate(toggleAnonymitySchema),
  async (req, res, next) => {
    try {
      const result = await togglePostAnonymity(
        req.auth!.userId,
        req.params.postId as string,
        req.body.isAnonymous,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /forum/posts/:postId/cancel-anonymous — @deprecated use toggle instead
router.patch('/posts/:postId/cancel-anonymous', requireAuth, async (req, res, next) => {
  try {
    const result = await togglePostAnonymity(req.auth!.userId, req.params.postId as string, false);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PATCH /forum/posts/:postId/privacy — toggle visibility
router.patch(
  '/posts/:postId/privacy',
  requireAuth,
  validate(updatePrivacySchema),
  async (req, res, next) => {
    try {
      const result = await updatePostPrivacy(
        req.auth!.userId,
        req.params.postId as string,
        req.body.visibility,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ─── Likes ───────────────────────────────────────────────────────

// POST /forum/posts/:postId/like — like a post
router.post('/posts/:postId/like', requireAuth, async (req, res, next) => {
  try {
    const result = await likePost(req.auth!.userId, req.params.postId as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /forum/posts/:postId/like — unlike a post
router.delete('/posts/:postId/like', requireAuth, async (req, res, next) => {
  try {
    const result = await unlikePost(req.auth!.userId, req.params.postId as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─── Favorites ───────────────────────────────────────────────────

// POST /forum/posts/:postId/favorite — bookmark a post
router.post('/posts/:postId/favorite', requireAuth, async (req, res, next) => {
  try {
    const result = await favoritePost(req.auth!.userId, req.params.postId as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /forum/posts/:postId/favorite — unbookmark a post
router.delete('/posts/:postId/favorite', requireAuth, async (req, res, next) => {
  try {
    const result = await unfavoritePost(req.auth!.userId, req.params.postId as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─── Comments ───────────────────────────────────────────────────

// POST /forum/posts/:postId/comments — create comment
router.post(
  '/posts/:postId/comments',
  requireAuth,
  validate(createCommentSchema),
  async (req, res, next) => {
    try {
      const result = await createComment(
        req.auth!.userId,
        req.params.postId as string,
        req.body,
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /forum/comments/:commentId/transcript — request voice transcription
router.post('/comments/:commentId/transcript', requireAuth, async (req, res, next) => {
  try {
    const result = await transcribeComment(req.auth!.userId, req.params.commentId as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /forum/comments/:rootCommentId/replies — paginated level-2 replies
router.get('/comments/:rootCommentId/replies', requireAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const result = await getCommentReplies(req.auth!.userId, req.params.rootCommentId as string, page, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /forum/comments/:commentId/like — like a comment
router.post('/comments/:commentId/like', requireAuth, async (req, res, next) => {
  try {
    const result = await likeComment(req.auth!.userId, req.params.commentId as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /forum/comments/:commentId/like — unlike a comment
router.delete('/comments/:commentId/like', requireAuth, async (req, res, next) => {
  try {
    const result = await unlikeComment(req.auth!.userId, req.params.commentId as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /forum/comments/:commentId — soft delete own comment
router.delete('/comments/:commentId', requireAuth, async (req, res, next) => {
  try {
    const result = await deleteComment(req.auth!.userId, req.params.commentId as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /forum/reports — submit a report for post/comment
router.post('/reports', requireAuth, validate(createReportSchema), async (req, res, next) => {
  try {
    const result = await submitForumReport({
      reporterId: req.auth!.userId,
      targetType: req.body.targetType,
      postId: req.body.postId,
      commentId: req.body.commentId,
      reportedUserId: req.body.reportedUserId,
      reasons: req.body.reasons,
      detail: req.body.detail,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
