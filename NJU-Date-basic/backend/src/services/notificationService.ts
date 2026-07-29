/**
 * notificationService.ts — 站内消息中心核心服务层
 *
 * 对外暴露的所有通知读写接口。被 matchService、heartboxService、surveyService、
 * admin report 处理逻辑、notificationRoutes、broadcastWorker 等模块直接调用。
 *
 * 设计约定（见 MESSAGE_CENTER_DEV_PLAN.md "状态机设计" 节）：
 *   - 所有写入使用 idempotency_key 幂等去重
 *   - 同一事务内发生的业务状态变更 + 写通知时，调用方负责事务一致性
 *   - 清理任务仅标记 deleted_at，不物理删除
 */

import { eq, and, isNull, desc, count, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection.js';
import { notifications, broadcastTasks, users, userNotifications } from '../db/schema.js';
import { NotFoundError } from '../utils/errors.js';

// ─── 类型定义 ──────────────────────────────────────────────────

export type NotificationType =
  | 'match_revealed'
  | 'match_no_result'
  | 'match_mutual_success'
  | 'match_expiring'
  | 'survey_update_required'
  | 'survey_incomplete'
  | 'policy_update'
  | 'system_announcement'
  | 'report_result';

export type NotificationLevel = 'info' | 'success' | 'warning' | 'critical';

export type BroadcastTaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface CreateNotificationPayload {
  userId: string;
  type: string;
  title: string;
  body: string;
  level?: NotificationLevel;
  actionUrl?: string;
  meta?: Record<string, unknown>;
  idempotencyKey: string;
  expiresAt?: string;
}

export interface GetNotificationsOptions {
  page: number;
  limit: number;
  status: 'all' | 'unread' | 'read';
}

type LegacyNotificationClient = Pick<typeof db, 'insert'>;

export interface CreateUserNotificationInput {
  recipientId: string;
  actorId?: string | null;
  type: string;
  title: string;
  content: string;
  meta?: Record<string, unknown> | null;
}

// ─── 辅助函数 ──────────────────────────────────────────────────

/**
 * 构造统一幂等键。
 * 格式：notif:{userId}:{type}:{scope}
 * 调用方应使用此函数而非硬编码字符串。
 */
export function buildIdempotencyKey(
  userId: string,
  type: NotificationType,
  scope: string,
): string {
  return `notif:${userId}:${type}:${scope}`;
}

// ─── 核心接口 ──────────────────────────────────────────────────

/**
 * 单条写入（事件触发时调用，幂等）
 * 使用 INSERT ... ON CONFLICT (idempotency_key) DO NOTHING
 */
export async function createNotification(
  payload: CreateNotificationPayload,
): Promise<{ id: string; created: boolean }> {
  const id = uuidv4();

  const rows = await db.insert(notifications).values({
    id,
    userId: payload.userId,
    type: payload.type,
    title: payload.title,
    body: payload.body,
    level: payload.level ?? 'info',
    actionUrl: payload.actionUrl ?? null,
    meta: payload.meta ?? {},
    isRead: false,
    idempotencyKey: payload.idempotencyKey,
    expiresAt: payload.expiresAt ?? null,
  }).onConflictDoNothing({ target: notifications.idempotencyKey })
    .returning({ id: notifications.id });

  if (rows.length > 0) {
    return { id: rows[0].id, created: true };
  }

  // 幂等：已存在，查出已有 ID 返回
  const [existing] = await db.select({ id: notifications.id })
    .from(notifications)
    .where(eq(notifications.idempotencyKey, payload.idempotencyKey))
    .limit(1);

  return { id: existing!.id, created: false };
}

/**
 * 批量写入（用于小范围精确投递，如 match_mutual_success 给两个人）
 * 每条独立幂等。
 */
export async function createNotifications(
  payloads: Array<CreateNotificationPayload>,
): Promise<Array<{ id: string; created: boolean }>> {
  const results: Array<{ id: string; created: boolean }> = [];

  for (const p of payloads) {
    results.push(await createNotification(p));
  }

  return results;
}

/**
 * Legacy G2 notification helper.
 *
 * G2 circle/friend/teamup modules and the existing frontend notification bell
 * still use `/user/notifications`, backed by `user_notifications`.
 */
export async function createUserNotification(
  input: CreateUserNotificationInput,
  client: LegacyNotificationClient = db,
) {
  if (input.actorId && input.actorId === input.recipientId) {
    return null;
  }

  const id = uuidv4();
  await client.insert(userNotifications).values({
    id,
    userId: input.recipientId,
    type: input.type,
    title: input.title,
    content: input.content,
    meta: input.meta ?? null,
  });
  return id;
}

export async function createUserNotifications(
  inputs: CreateUserNotificationInput[],
  client: LegacyNotificationClient = db,
) {
  const rows = inputs
    .filter((input) => !input.actorId || input.actorId !== input.recipientId)
    .map((input) => ({
      id: uuidv4(),
      userId: input.recipientId,
      type: input.type,
      title: input.title,
      content: input.content,
      meta: input.meta ?? null,
    }));

  if (rows.length === 0) {
    return [];
  }

  await client.insert(userNotifications).values(rows);
  return rows.map((row) => row.id);
}

/**
 * 分页查询用户通知
 * 仅返回 deleted_at IS NULL 的记录（未软删除）
 */
export async function getNotifications(
  userId: string,
  options: GetNotificationsOptions,
) {
  const { page, limit, status } = options;

  const conditions = [eq(notifications.userId, userId), isNull(notifications.deletedAt)];

  if (status === 'unread') {
    conditions.push(eq(notifications.isRead, false));
  } else if (status === 'read') {
    conditions.push(eq(notifications.isRead, true));
  }
  // status === 'all' → 无额外过滤

  const where = and(...conditions);

  const [countRow] = await db.select({ total: count() })
    .from(notifications)
    .where(where);

  const items = await db.select()
    .from(notifications)
    .where(where)
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  return {
    total: countRow?.total ?? 0,
    page,
    limit,
    items,
  };
}

/**
 * 未读数（为后续 Redis 缓存预留统一入口）
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const [row] = await db.select({ count: count() })
    .from(notifications)
    .where(and(
      eq(notifications.userId, userId),
      eq(notifications.isRead, false),
      isNull(notifications.deletedAt),
    ));

  return row?.count ?? 0;
}

/**
 * 标记单条已读
 * 守卫：仅当 is_read = false 时更新；已读再调为幂等空操作
 */
export async function markAsRead(
  userId: string,
  notificationId: string,
): Promise<{ updated: boolean }> {
  const now = new Date().toISOString();

  const rows = await db.update(notifications)
    .set({ isRead: true, readAt: now })
    .where(and(
      eq(notifications.id, notificationId),
      eq(notifications.userId, userId),
      eq(notifications.isRead, false),
      isNull(notifications.deletedAt),
    ))
    .returning({ id: notifications.id });

  return { updated: rows.length > 0 };
}

/**
 * 标记全部已读
 */
export async function markAllAsRead(userId: string): Promise<{ updated: number }> {
  const now = new Date().toISOString();

  const rows = await db.update(notifications)
    .set({ isRead: true, readAt: now })
    .where(and(
      eq(notifications.userId, userId),
      eq(notifications.isRead, false),
      isNull(notifications.deletedAt),
    ))
    .returning({ id: notifications.id });

  return { updated: rows.length };
}

/**
 * 同步广播（用户量 < 500 时直接调用，不走异步队列）
 * 每条按 idempotency_key 去重
 */
export async function broadcastNotifications(
  payload: {
    type: string;
    title: string;
    body: string;
    level?: NotificationLevel;
    actionUrl?: string;
    meta?: Record<string, unknown>;
    expiresAt?: string;
  },
  targetUserIds?: string[],
): Promise<{ created: number }> {
  let userIds = targetUserIds;

  if (!userIds) {
    // 广播给所有用户
    const allUsers = await db.select({ id: users.id }).from(users);
    userIds = allUsers.map((u) => u.id);
  }

  // 确定性 taskId：基于 type + title + sorted targetUserIds，防止重复点击
  const targetScope = userIds.slice().sort().join(',');
  const taskId = `bcast_sync:${payload.type}:${payload.title}:${targetScope}`;
  let created = 0;

  for (const uid of userIds) {
    const result = await createNotification({
      userId: uid,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      level: payload.level,
      actionUrl: payload.actionUrl,
      meta: { ...payload.meta, broadcastTaskId: taskId },
      idempotencyKey: `notif:${uid}:${payload.type}:bcast_${taskId}`,
      expiresAt: payload.expiresAt,
    });
    if (result.created) created++;
  }

  return { created };
}

/**
 * 异步广播入队（返回 taskId，供管理后台查询）
 * 使用 idempotency_scope 去重：相同 type+title+targetScope 的重复请求不创建新任务
 */
export async function enqueueBroadcastTask(
  payload: {
    type: string;
    title: string;
    body: string;
    level?: NotificationLevel;
    actionUrl?: string;
    meta?: Record<string, unknown>;
    expiresAt?: string;
    targetUserIds?: string[] | null;
  },
  createdBy?: string,
): Promise<{ taskId: string; estimatedCount: number }> {
  // 构造幂等 scope：broadcast:{type}:{title}:{targetScope}
  // 与设计文档 7.5 节一致，防止管理员重复点击触发重复广播
  const targetScope = payload.targetUserIds && payload.targetUserIds.length > 0
    ? payload.targetUserIds.slice().sort().join(',')
    : 'all';
  const idempotencyScope = `broadcast:${payload.type}:${payload.title}:${targetScope}`;

  // 先检查是否已有相同 scope 的任务（pending/running/completed 均视为已提交）
  const [existing] = await db.select()
    .from(broadcastTasks)
    .where(eq(broadcastTasks.idempotencyScope, idempotencyScope))
    .limit(1);

  if (existing) {
    // 重复请求：返回已有任务信息，不创建新任务
    return { taskId: existing.id, estimatedCount: existing.totalEstimate ?? 0 };
  }

  const taskId = `broadcast_task_${uuidv4()}`;

  // 计算预估用户数
  let estimatedCount = 0;
  if (payload.targetUserIds && payload.targetUserIds.length > 0) {
    estimatedCount = payload.targetUserIds.length;
  } else {
    const [row] = await db.select({ count: count() }).from(users);
    estimatedCount = row?.count ?? 0;
  }

  await db.insert(broadcastTasks).values({
    id: taskId,
    type: payload.type,
    title: payload.title,
    body: payload.body,
    level: payload.level ?? 'info',
    actionUrl: payload.actionUrl ?? null,
    targetUserIds: payload.targetUserIds ?? null,
    idempotencyScope,
    status: 'pending',
    totalEstimate: estimatedCount,
    expiresAt: payload.expiresAt ?? null,
    createdBy: createdBy ?? null,
  });

  return { taskId, estimatedCount };
}

/**
 * 查询广播任务状态
 */
export async function getBroadcastTaskStatus(taskId: string): Promise<{
  taskId: string;
  status: BroadcastTaskStatus;
  created: number;
  skipped: number;
  finishedAt?: string | null;
}> {
  const [task] = await db.select()
    .from(broadcastTasks)
    .where(eq(broadcastTasks.id, taskId))
    .limit(1);

  if (!task) {
    throw new NotFoundError('广播任务不存在');
  }

  return {
    taskId: task.id,
    status: task.status as BroadcastTaskStatus,
    created: task.createdCount ?? 0,
    skipped: task.skippedCount ?? 0,
    finishedAt: task.finishedAt,
  };
}

/**
 * 清理过期消息（定时任务调用）
 * 仅标记 deleted_at，不物理删除
 */
export async function cleanupExpiredNotifications(): Promise<{ removed: number }> {
  const now = new Date().toISOString();

  const rows = await db.update(notifications)
    .set({ deletedAt: now })
    .where(and(
      sql`${notifications.expiresAt} IS NOT NULL`,
      sql`${notifications.expiresAt} < ${now}`,
      isNull(notifications.deletedAt),
    ))
    .returning({ id: notifications.id });

  return { removed: rows.length };
}
