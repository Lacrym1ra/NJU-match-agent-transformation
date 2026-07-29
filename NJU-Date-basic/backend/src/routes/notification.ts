/**
 * notificationRoutes.ts — 站内消息中心 REST 路由
 *
 * 用户侧：
 *   GET    /api/v1/notifications           — 分页查询（status=all|unread|read）
 *   GET    /api/v1/notifications/unread-count
 *   POST   /api/v1/notifications/:id/read
 *   POST   /api/v1/notifications/read-all
 *
 * 管理员侧：
 *   POST   /api/v1/admin/notifications/broadcast
 *   GET    /api/v1/admin/notifications/broadcast/:taskId
 *
 * 设计约定见 MESSAGE_CENTER_DEV_PLAN.md "对外接口设计" 节。
 */

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { notificationUnreadCountLimiter, notificationBroadcastLimiter } from '../middleware/rateLimit.js';
import { requireAdmin } from './admin.js';
import * as svc from '../services/notificationService.js';

// ─── 用户侧路由 ──────────────────────────────────────────────

const userRouter = Router();

// GET /api/v1/notifications — 分页查询
userRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const rawStatus = (req.query.status as string) || 'all';
    const status = rawStatus === 'unread' || rawStatus === 'read' ? rawStatus : 'all';

    const result = await svc.getNotifications(req.auth!.userId, { page, limit, status });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/notifications/unread-count（单用户 1 分钟最多 5 次）
userRouter.get('/unread-count', requireAuth, notificationUnreadCountLimiter, async (req, res, next) => {
  try {
    const unreadCount = await svc.getUnreadCount(req.auth!.userId);
    res.json({ unreadCount });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/notifications/:id/read — 单条已读
userRouter.post('/:id/read', requireAuth, async (req, res, next) => {
  try {
    const { updated } = await svc.markAsRead(req.auth!.userId, String(req.params.id));
    if (!updated) {
      res.json({ message: '消息已标记为已读' });
      return;
    }
    res.json({ message: '消息已标记为已读' });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/notifications/read-all — 全部已读
userRouter.post('/read-all', requireAuth, async (req, res, next) => {
  try {
    const { updated } = await svc.markAllAsRead(req.auth!.userId);
    res.json({ message: '已全部标记为已读', updated });
  } catch (err) {
    next(err);
  }
});

// ─── 管理员侧路由 ────────────────────────────────────────────

const adminRouter = Router();

const broadcastSchema = z.object({
  type: z.enum(['system_announcement', 'policy_update']),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  level: z.enum(['info', 'success', 'warning', 'critical']).default('info'),
  actionUrl: z.string().max(500).optional(),
  targetUserIds: z.array(z.string()).nullable().optional(),
  expiresAt: z.string().datetime({ offset: true }).optional(),
});

// POST /api/v1/admin/notifications/broadcast（需要 x-admin-key + JWT 双重鉴权）
adminRouter.post('/broadcast', requireAdmin, requireAuth, notificationBroadcastLimiter, validate(broadcastSchema), async (req, res, next) => {
  try {
    const { type, title, body, level, actionUrl, targetUserIds, expiresAt } = req.body;

    const payload = {
      type,
      title,
      body,
      level: level as svc.NotificationLevel,
      actionUrl,
      meta: {},
      targetUserIds,
      expiresAt,
    };

    // 同步广播（< 200 人）vs 异步入队
    if (targetUserIds && targetUserIds.length > 0 && targetUserIds.length < 200) {
      const { created } = await svc.broadcastNotifications(payload, targetUserIds);
      res.json({
        message: '广播已完成',
        created,
      });
      return;
    }

    const { taskId, estimatedCount } = await svc.enqueueBroadcastTask(payload, req.auth!.userId);
    res.json({
      message: '广播任务已提交',
      taskId,
      estimatedCount,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/admin/notifications/broadcast/:taskId（需要 x-admin-key + JWT 双重鉴权）
adminRouter.get('/broadcast/:taskId', requireAdmin, requireAuth, async (req, res, next) => {
  try {
    const result = await svc.getBroadcastTaskStatus(String(req.params.taskId));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export const notificationRoutes = userRouter;
export const adminNotificationRoutes = adminRouter;
