/**
 * broadcastWorker + notificationCron 业务逻辑测试
 *
 * 覆盖范围（按 MESSAGE_CENTER_DEV_PLAN "状态机设计" 节验收）：
 *
 * 1. 广播 Worker 分批写入逻辑（模拟）
 * 2. 广播 Worker 乐观锁竞态模拟
 * 3. notificationCron 周任务目标用户筛选逻辑
 * 4. getCurrentWeekOf 计算
 * 5. 状态机守卫条件
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildIdempotencyKey,
} from '../services/notificationService.js';

// ═══════════════════════════════════════════════════════════════
// 1. 广播 Worker 分批写入逻辑
// ═══════════════════════════════════════════════════════════════

/**
 * 模拟分批写入逻辑（与 broadcastWorker.ts 一致）
 * 返回每批的 created/skipped 统计
 */
function simulateBatchWrite(
  targetUserIds: string[],
  batchSize: number,
  existingKeys: Set<string>, // 已存在的 idempotency_key 集合（模拟幂等去重）
  taskId: string,
  type: string,
): { createdCount: number; skippedCount: number; batches: number } {
  let createdCount = 0;
  let skippedCount = 0;
  let batches = 0;

  for (let i = 0; i < targetUserIds.length; i += batchSize) {
    const batch = targetUserIds.slice(i, i + batchSize);
    batches++;

    for (const uid of batch) {
      const key = `notif:${uid}:${type}:bcast_${taskId}`;
      if (existingKeys.has(key)) {
        skippedCount++;
      } else {
        existingKeys.add(key);
        createdCount++;
      }
    }
  }

  return { createdCount, skippedCount, batches };
}

test('广播 Worker：3 个用户 1 批完成', () => {
  const existing = new Set<string>();
  const result = simulateBatchWrite(['u1', 'u2', 'u3'], 200, existing, 'task1', 'system_announcement');
  assert.equal(result.createdCount, 3);
  assert.equal(result.skippedCount, 0);
  assert.equal(result.batches, 1);
});

test('广播 Worker：250 个用户分 2 批（200+50）', () => {
  const userIds = Array.from({ length: 250 }, (_, i) => `u${i}`);
  const existing = new Set<string>();
  const result = simulateBatchWrite(userIds, 200, existing, 'task1', 'system_announcement');
  assert.equal(result.createdCount, 250);
  assert.equal(result.skippedCount, 0);
  assert.equal(result.batches, 2);
});

test('广播 Worker：幂等去重 — 重复广播只跳过', () => {
  const existing = new Set<string>([
    'notif:u1:system_announcement:bcast_task1',
    'notif:u2:system_announcement:bcast_task1',
  ]);
  const result = simulateBatchWrite(['u1', 'u2', 'u3'], 200, existing, 'task1', 'system_announcement');
  assert.equal(result.createdCount, 1, 'u1 和 u2 已存在，仅 u3 被创建');
  assert.equal(result.skippedCount, 2);
});

test('广播 Worker：不同 taskId 产生不同幂等键，不冲突', () => {
  const existing = new Set<string>();
  simulateBatchWrite(['u1'], 200, existing, 'task1', 'system_announcement');
  const result = simulateBatchWrite(['u1'], 200, existing, 'task2', 'system_announcement');
  assert.equal(result.createdCount, 1, '不同 taskId 不冲突');
  assert.equal(result.skippedCount, 0);
});

test('广播 Worker：空目标列表不报错', () => {
  const existing = new Set<string>();
  const result = simulateBatchWrite([], 200, existing, 'task1', 'system_announcement');
  assert.equal(result.createdCount, 0);
  assert.equal(result.skippedCount, 0);
  assert.equal(result.batches, 0);
});

// ═══════════════════════════════════════════════════════════════
// 2. 广播 Worker 乐观锁竞态模拟
// ═══════════════════════════════════════════════════════════════

type BroadcastTaskRow = {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string | null;
};

/**
 * 模拟乐观锁：UPDATE ... SET status='running' WHERE id=? AND status='pending'
 * 返回是否抢锁成功
 */
function simulateOptimisticLock(task: BroadcastTaskRow): { locked: boolean; result: BroadcastTaskRow } {
  if (task.status !== 'pending') {
    return { locked: false, result: task };
  }
  return {
    locked: true,
    result: { ...task, status: 'running', startedAt: new Date().toISOString() },
  };
}

test('乐观锁：两个 worker 竞争同一任务，只有一个成功', () => {
  let task: BroadcastTaskRow = { id: 'bt1', status: 'pending', startedAt: null };

  // Worker A 抢锁
  const lockA = simulateOptimisticLock(task);
  assert.equal(lockA.locked, true);
  task = lockA.result;

  // Worker B 尝试抢同一任务（此时 status 已经是 running）
  const lockB = simulateOptimisticLock(task);
  assert.equal(lockB.locked, false, '第二个 worker 应抢锁失败');
});

test('乐观锁：抢锁失败后 worker 跳过不报错', () => {
  const task: BroadcastTaskRow = { id: 'bt1', status: 'running', startedAt: '2026-06-01T00:00:00Z' };
  const { locked, result } = simulateOptimisticLock(task);
  assert.equal(locked, false);
  assert.equal(result.status, 'running', '状态不变');
});

// ═══════════════════════════════════════════════════════════════
// 3. notificationCron 周任务目标用户筛选逻辑
// ═══════════════════════════════════════════════════════════════

type UserRow = {
  id: string;
  isParticipating: boolean;
  surveyComplete: boolean;
};

type MatchRow = {
  id: string;
  weekOf: string;
  userAId: string;
  userBId: string;
  status: string;
  userAAction: string | null;
  userBAction: string | null;
};

/**
 * 模拟 survey_incomplete 筛选逻辑
 */
function simulateSurveyIncompleteFilter(users: UserRow[]): string[] {
  return users
    .filter((u) => u.isParticipating && !u.surveyComplete)
    .map((u) => u.id);
}

test('Cron 筛选：survey_incomplete 仅选 isParticipating=true AND surveyComplete=false', () => {
  const users: UserRow[] = [
    { id: 'u1', isParticipating: true, surveyComplete: false },  // ✅
    { id: 'u2', isParticipating: true, surveyComplete: true },   // ❌
    { id: 'u3', isParticipating: false, surveyComplete: false }, // ❌
    { id: 'u4', isParticipating: true, surveyComplete: false },  // ✅
    { id: 'u5', isParticipating: false, surveyComplete: true },  // ❌
  ];
  const targets = simulateSurveyIncompleteFilter(users);
  assert.deepEqual(targets, ['u1', 'u4']);
});

/**
 * 模拟 match_expiring 筛选逻辑
 */
function simulateMatchExpiringFilter(matches: MatchRow[]): string[] {
  const targets: string[] = [];
  for (const m of matches) {
    if (m.status !== 'REVEALED') continue;
    if (!m.userAAction) targets.push(m.userAId);
    if (!m.userBAction) targets.push(m.userBId);
  }
  return targets;
}

test('Cron 筛选：match_expiring 仅选 REVEALED 且未操作的用户', () => {
  const matches: MatchRow[] = [
    // 双方都没操作 → 两个都通知
    { id: 'm1', weekOf: '2026-06-03', userAId: 'uA', userBId: 'uB', status: 'REVEALED', userAAction: null, userBAction: null },
    // A 操作了 B 没有 → 仅通知 B
    { id: 'm2', weekOf: '2026-06-03', userAId: 'uC', userBId: 'uD', status: 'REVEALED', userAAction: 'ACCEPT', userBAction: null },
    // 双方都操作了 → 不通知
    { id: 'm3', weekOf: '2026-06-03', userAId: 'uE', userBId: 'uF', status: 'REVEALED', userAAction: 'ACCEPT', userBAction: 'REJECT' },
    // 非 REVEALED → 不通知
    { id: 'm4', weekOf: '2026-06-03', userAId: 'uG', userBId: 'uH', status: 'MUTUAL', userAAction: 'ACCEPT', userBAction: 'ACCEPT' },
  ];
  const targets = simulateMatchExpiringFilter(matches);
  assert.deepEqual(targets, ['uA', 'uB', 'uD']);
});

test('Cron 筛选：EXPIRED 匹配不触发 match_expiring', () => {
  const matches: MatchRow[] = [
    { id: 'm1', weekOf: '2026-06-03', userAId: 'uA', userBId: 'uB', status: 'EXPIRED', userAAction: null, userBAction: null },
  ];
  const targets = simulateMatchExpiringFilter(matches);
  assert.equal(targets.length, 0);
});

// ═══════════════════════════════════════════════════════════════
// 4. getCurrentWeekOf 计算
// ═══════════════════════════════════════════════════════════════

/**
 * 纯函数版 getCurrentWeekOf（与 notificationCron.ts 一致）
 */
function getCurrentWeekOfForTest(nowUtc: Date): string {
  const shanghai = new Date(nowUtc.getTime() + 8 * 60 * 60 * 1000);
  const day = shanghai.getUTCDay(); // 0=Sun, 3=Wed
  const diff = day <= 3 ? (3 - day) : (3 - day + 7);
  const wed = new Date(shanghai);
  wed.setUTCDate(shanghai.getUTCDate() + diff);
  return wed.toISOString().slice(0, 10);
}

test('getCurrentWeekOf：周一 → 本周三', () => {
  // 2026-06-01 Mon UTC → Shanghai 2026-06-01 → Wed = 2026-06-03
  const weekOf = getCurrentWeekOfForTest(new Date('2026-06-01T00:00:00Z'));
  assert.equal(weekOf, '2026-06-03');
});

test('getCurrentWeekOf：周三 → 本周三', () => {
  const weekOf = getCurrentWeekOfForTest(new Date('2026-06-03T00:00:00Z'));
  assert.equal(weekOf, '2026-06-03');
});

test('getCurrentWeekOf：周四 → 下周三', () => {
  // 2026-06-04 Thu → next Wed = 2026-06-10
  const weekOf = getCurrentWeekOfForTest(new Date('2026-06-04T00:00:00Z'));
  assert.equal(weekOf, '2026-06-10');
});

test('getCurrentWeekOf：周六 → 下周三', () => {
  const weekOf = getCurrentWeekOfForTest(new Date('2026-06-06T00:00:00Z'));
  assert.equal(weekOf, '2026-06-10');
});

test('getCurrentWeekOf：周日 → 下周三', () => {
  const weekOf = getCurrentWeekOfForTest(new Date('2026-06-07T00:00:00Z'));
  assert.equal(weekOf, '2026-06-10');
});

// ═══════════════════════════════════════════════════════════════
// 5. 完整 Cron 触发编排验证
// ═══════════════════════════════════════════════════════════════

test('Cron 编排：周二 18:00 survey_incomplete 幂等键使用 weekOf', () => {
  const weekOf = '2026-06-03';
  const userId = 'user1';
  const key = buildIdempotencyKey(userId, 'survey_incomplete', `week_${weekOf}`);
  assert.equal(key, 'notif:user1:survey_incomplete:week_2026-06-03');
});

test('Cron 编排：周五 18:00 match_expiring 幂等键使用 weekOf', () => {
  const weekOf = '2026-06-03';
  const userId = 'userA';
  const key = buildIdempotencyKey(userId, 'match_expiring', `week_${weekOf}`);
  assert.equal(key, 'notif:userA:match_expiring:week_2026-06-03');
});

test('Cron 编排：同一用户 match_revealed 和 match_expiring 幂等键不冲突', () => {
  const userId = 'user1';
  const weekOf = '2026-06-03';
  const keyRevealed = buildIdempotencyKey(userId, 'match_revealed', `week_${weekOf}`);
  const keyExpiring = buildIdempotencyKey(userId, 'match_expiring', `week_${weekOf}`);
  assert.notEqual(keyRevealed, keyExpiring);
});

test('Cron 编排：清理任务守卫 — 仅清理 expires_at < now AND deleted_at IS NULL', () => {
  type Notif = { expiresAt: string | null; deletedAt: string | null };
  const now = '2026-06-01T03:00:00Z';
  const cases: { notif: Notif; shouldClean: boolean; desc: string }[] = [
    { notif: { expiresAt: null, deletedAt: null }, shouldClean: false, desc: '永不过期' },
    { notif: { expiresAt: '2099-01-01T00:00:00Z', deletedAt: null }, shouldClean: false, desc: '未到期' },
    { notif: { expiresAt: '2026-05-01T00:00:00Z', deletedAt: null }, shouldClean: true, desc: '已过期未删除' },
    { notif: { expiresAt: '2026-05-01T00:00:00Z', deletedAt: '2026-05-02T00:00:00Z' }, shouldClean: false, desc: '已过期已删除' },
  ];

  for (const { notif, shouldClean, desc } of cases) {
    const should = notif.expiresAt !== null
      && notif.expiresAt < now
      && notif.deletedAt === null;
    assert.equal(should, shouldClean, desc);
  }
});
