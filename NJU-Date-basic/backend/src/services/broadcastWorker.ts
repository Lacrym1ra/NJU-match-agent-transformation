/**
 * broadcastWorker.ts — 异步广播任务消费者
 *
 * 设计约定（见 MESSAGE_CENTER_DEV_PLAN "状态机二：广播任务生命周期"）：
 *   - 简单轮询式 worker，扫描 broadcast_tasks 表中 status = 'pending' 的任务
 *   - 乐观锁抢锁：UPDATE ... SET status = 'running' WHERE status = 'pending'
 *   - 分批写入（每批 200 条），每条按 idempotency_key 幂等
 *   - 单实例部署安全；多实例部署通过乐观锁防竞态
 *   - 失败时 status → 'failed'，可人工重试（UPDATE SET status = 'pending'）
 */

import { eq, and, sql, isNull } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { broadcastTasks, notifications, users } from '../db/schema.js';
import { createNotification } from './notificationService.js';

const BATCH_SIZE = 200;
const POLL_INTERVAL_MS = 30_000; // 30 秒轮询一次

let pollTimer: ReturnType<typeof setInterval> | null = null;

/**
 * 启动广播 Worker（后台轮询）
 */
export function startBroadcastWorker(): void {
  if (pollTimer) return; // 防止重复启动

  pollTimer = setInterval(async () => {
    try {
      await processNextTask();
    } catch (err) {
      console.error('[BroadcastWorker] Error:', err);
    }
  }, POLL_INTERVAL_MS);

  // 启动后立即执行一次
  processNextTask().catch((err) => {
    console.error('[BroadcastWorker] Initial run error:', err);
  });

  console.log('[BroadcastWorker] Started (poll interval: 30s)');
}

/**
 * 停止广播 Worker
 */
export function stopBroadcastWorker(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    console.log('[BroadcastWorker] Stopped');
  }
}

/**
 * 处理下一个 pending 任务
 */
export async function processNextTask(): Promise<void> {
  // 1. 查找 pending 任务
  const [task] = await db.select()
    .from(broadcastTasks)
    .where(eq(broadcastTasks.status, 'pending'))
    .limit(1);

  if (!task) return;

  // 2. 乐观锁抢锁
  const locked = await db.update(broadcastTasks)
    .set({ status: 'running', startedAt: new Date().toISOString() })
    .where(and(
      eq(broadcastTasks.id, task.id),
      eq(broadcastTasks.status, 'pending'),
    ))
    .returning({ id: broadcastTasks.id });

  if (locked.length === 0) {
    // 被其他实例抢走
    return;
  }

  console.log(`[BroadcastWorker] Processing task ${task.id} (${task.type})`);

  try {
    // 3. 获取目标用户列表
    let targetUserIds: string[];

    if (task.targetUserIds && Array.isArray(task.targetUserIds) && task.targetUserIds.length > 0) {
      targetUserIds = task.targetUserIds;
    } else {
      // 全量广播：查询所有用户
      const allUsers = await db.select({ id: users.id }).from(users);
      targetUserIds = allUsers.map((u) => u.id);
    }

    // 4. 更新总预估数
    await db.update(broadcastTasks)
      .set({ totalEstimate: targetUserIds.length })
      .where(eq(broadcastTasks.id, task.id));

    // 5. 分批写入
    let createdCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < targetUserIds.length; i += BATCH_SIZE) {
      const batch = targetUserIds.slice(i, i + BATCH_SIZE);

      for (const uid of batch) {
        const result = await createNotification({
          userId: uid,
          type: task.type,
          title: task.title,
          body: task.body,
          level: task.level as 'info' | 'success' | 'warning' | 'critical',
          actionUrl: task.actionUrl ?? undefined,
          meta: { broadcastTaskId: task.id },
          idempotencyKey: `notif:${uid}:${task.type}:bcast_${task.id}`,
          expiresAt: task.expiresAt ?? undefined,
        });

        if (result.created) {
          createdCount++;
        } else {
          skippedCount++;
        }
      }

      // 每批更新进度
      await db.update(broadcastTasks)
        .set({ createdCount, skippedCount })
        .where(eq(broadcastTasks.id, task.id));
    }

    // 6. 标记完成
    await db.update(broadcastTasks)
      .set({
        status: 'completed',
        createdCount,
        skippedCount,
        finishedAt: new Date().toISOString(),
      })
      .where(eq(broadcastTasks.id, task.id));

    console.log(`[BroadcastWorker] Task ${task.id} completed: created=${createdCount}, skipped=${skippedCount}`);
  } catch (err) {
    // 7. 标记失败
    await db.update(broadcastTasks)
      .set({
        status: 'failed',
        finishedAt: new Date().toISOString(),
      })
      .where(eq(broadcastTasks.id, task.id));

    console.error(`[BroadcastWorker] Task ${task.id} failed:`, err);
  }
}
