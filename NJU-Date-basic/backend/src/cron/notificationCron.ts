/**
 * notificationCron.ts — 消息中心定时任务
 *
 * 设计约定（见 MESSAGE_CENTER_DEV_PLAN "状态机四：定时任务触发编排"）：
 *
 * | 时间          | 任务                            | 写入的消息类型                      |
 * |--------------|--------------------------------|------------------------------------|
 * | 周二 18:00    | 问卷未完成提醒                  | survey_incomplete                  |
 * | 周五 18:00    | 匹配即将过期预警                | match_expiring                     |
 * | 每日 03:00    | 清理过期消息                    | —                                  |
 * | 广播 Worker   | 消费 pending 广播任务           | system_announcement / policy_update |
 *
 * 注：match_revealed / match_no_result 在 weeklyMatch.ts 的 unlockCron
 *     结束后触发，由阶段二（业务事件接入）直接在 matchService 内调用。
 *     此处仅包含可由独立 Cron 管理的通知任务。
 */

import cron from 'node-cron';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { users, surveyAnswers, matches } from '../db/schema.js';
import {
  createNotification,
  cleanupExpiredNotifications,
  buildIdempotencyKey,
} from '../services/notificationService.js';
import { startBroadcastWorker } from '../services/broadcastWorker.js';

/**
 * 获取当前匹配周的 Wednesday 日期字符串（YYYY-MM-DD）
 * 约定：weekOf 为每周三的日期
 */
function getCurrentWeekOf(): string {
  const now = new Date();
  // 转换为 Asia/Shanghai 时间
  const shanghai = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const day = shanghai.getUTCDay(); // 0=Sun, 3=Wed

  // 计算本周三
  const diff = day <= 3 ? (3 - day) : (3 - day + 7);
  const wed = new Date(shanghai);
  wed.setUTCDate(shanghai.getUTCDate() + diff);
  return wed.toISOString().slice(0, 10);
}

/**
 * 周二 18:00：批量写入 survey_incomplete 通知
 * 目标用户：isParticipating = true AND surveyComplete = false
 */
async function sendSurveyIncompleteNotifications(): Promise<void> {
  const weekOf = getCurrentWeekOf();
  console.log(`[NotificationCron] Sending survey_incomplete notifications for week ${weekOf}...`);

  const incompleteUsers = await db.select({ id: users.id })
    .from(users)
    .where(and(
      eq(users.isParticipating, true),
      eq(users.surveyComplete, false),
    ));

  let created = 0;
  for (const u of incompleteUsers) {
    const result = await createNotification({
      userId: u.id,
      type: 'survey_incomplete',
      title: '问卷尚未完成',
      body: '完成问卷才能参与本周匹配，请尽快填写。',
      level: 'warning',
      actionUrl: '/survey',
      meta: { weekOf },
      idempotencyKey: buildIdempotencyKey(u.id, 'survey_incomplete', `week_${weekOf}`),
    });
    if (result.created) created++;
  }

  console.log(`[NotificationCron] survey_incomplete: ${created}/${incompleteUsers.length} notifications created`);
}

/**
 * 周五 18:00：批量写入 match_expiring 通知
 * 目标用户：本周 REVEALED 且尚未操作的匹配中的未操作用户
 */
async function sendMatchExpiringNotifications(): Promise<void> {
  const weekOf = getCurrentWeekOf();
  console.log(`[NotificationCron] Sending match_expiring notifications for week ${weekOf}...`);

  // 查找本周 REVEALED 的匹配
  const revealedMatches = await db.select({
    id: matches.id,
    weekOf: matches.weekOf,
    userAId: matches.userAId,
    userBId: matches.userBId,
    userAAction: matches.userAAction,
    userBAction: matches.userBAction,
  })
    .from(matches)
    .where(and(
      eq(matches.weekOf, weekOf),
      eq(matches.status, 'REVEALED'),
    ));

  let created = 0;
  for (const match of revealedMatches) {
    // 仅向未操作的用户发通知
    if (!match.userAAction) {
      const result = await createNotification({
        userId: match.userAId,
        type: 'match_expiring',
        title: '匹配即将过期',
        body: '你的本周匹配还有不到 48 小时就要过期了，请尽快做出选择！',
        level: 'warning',
        actionUrl: '/reveal',
        meta: { weekOf: match.weekOf, source: 'weekly' },
        idempotencyKey: buildIdempotencyKey(match.userAId, 'match_expiring', `week_${match.weekOf}`),
      });
      if (result.created) created++;
    }
    if (!match.userBAction) {
      const result = await createNotification({
        userId: match.userBId,
        type: 'match_expiring',
        title: '匹配即将过期',
        body: '你的本周匹配还有不到 48 小时就要过期了，请尽快做出选择！',
        level: 'warning',
        actionUrl: '/reveal',
        meta: { weekOf: match.weekOf, source: 'weekly' },
        idempotencyKey: buildIdempotencyKey(match.userBId, 'match_expiring', `week_${match.weekOf}`),
      });
      if (result.created) created++;
    }
  }

  console.log(`[NotificationCron] match_expiring: ${created} notifications created`);
}

/**
 * 每日 03:00：清理过期消息（仅标记 deleted_at，不物理删除）
 */
async function runCleanupExpiredNotifications(): Promise<void> {
  console.log('[NotificationCron] Cleaning up expired notifications...');
  try {
    const { removed } = await cleanupExpiredNotifications();
    console.log(`[NotificationCron] Cleaned up ${removed} expired notifications`);
  } catch (err) {
    console.error('[NotificationCron] Cleanup failed:', err);
  }
}

/**
 * 启动所有通知相关定时任务
 */
export function startNotificationCronJobs(): void {
  // 周二 18:00：问卷未完成提醒
  cron.schedule('0 18 * * 2', async () => {
    console.log('[NotificationCron] Tuesday 18:00 — survey_incomplete...');
    try {
      await sendSurveyIncompleteNotifications();
    } catch (err) {
      console.error('[NotificationCron] survey_incomplete failed:', err);
    }
  }, { timezone: 'Asia/Shanghai' });

  // 周五 18:00：匹配即将过期预警
  cron.schedule('0 18 * * 5', async () => {
    console.log('[NotificationCron] Friday 18:00 — match_expiring...');
    try {
      await sendMatchExpiringNotifications();
    } catch (err) {
      console.error('[NotificationCron] match_expiring failed:', err);
    }
  }, { timezone: 'Asia/Shanghai' });

  // 每日 03:00：清理过期消息
  cron.schedule('0 3 * * *', async () => {
    try {
      await runCleanupExpiredNotifications();
    } catch (err) {
      console.error('[NotificationCron] Cleanup cron failed:', err);
    }
  }, { timezone: 'Asia/Shanghai' });

  // 启动广播 Worker
  startBroadcastWorker();

  console.log('[NotificationCron] Scheduled: Tue 18:00 survey_incomplete, Fri 18:00 match_expiring, Daily 03:00 cleanup, BroadcastWorker');
}
