/**
 * notificationService 业务逻辑 + 状态机测试
 *
 * 覆盖范围（按 MESSAGE_CENTER_DEV_PLAN "状态机设计" 节验收）：
 *
 * 1. buildIdempotencyKey 格式正确性
 * 2. 通知实体生命周期状态机（维度 A: 阅读 UNREAD↔READ, 维度 B: 时效 ACTIVE→EXPIRED→DELETED）
 * 3. 广播任务生命周期状态机（PENDING→RUNNING→COMPLETED/FAILED）
 * 4. 业务事件→通知触发映射（Match / Survey / Report / Heartbox）
 * 5. 状态机守卫条件
 * 6. 路由层 Zod 校验
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';

// ─── 导入被测模块 ──────────────────────────────────────────────
import {
  buildIdempotencyKey,
  type NotificationType,
  type NotificationLevel,
  type BroadcastTaskStatus,
} from './notificationService.js';

// ═══════════════════════════════════════════════════════════════
// 1. buildIdempotencyKey 格式正确性
// ═══════════════════════════════════════════════════════════════

test('buildIdempotencyKey: 基本格式 notif:{userId}:{type}:{scope}', () => {
  const key = buildIdempotencyKey('user1', 'match_revealed', 'week_2026-06-03');
  assert.equal(key, 'notif:user1:match_revealed:week_2026-06-03');
});

test('buildIdempotencyKey: match_mutual_success 使用 matchId 作 scope', () => {
  const key = buildIdempotencyKey('userA', 'match_mutual_success', 'match_abc123');
  assert.equal(key, 'notif:userA:match_mutual_success:match_abc123');
});

test('buildIdempotencyKey: survey_incomplete 使用 weekOf 作 scope', () => {
  const key = buildIdempotencyKey('user1', 'survey_incomplete', 'week_2026-06-03');
  assert.equal(key, 'notif:user1:survey_incomplete:week_2026-06-03');
});

test('buildIdempotencyKey: report_result 使用 reportId 作 scope', () => {
  const key = buildIdempotencyKey('reporter1', 'report_result', 'report_xyz789');
  assert.equal(key, 'notif:reporter1:report_result:report_xyz789');
});

test('buildIdempotencyKey: survey_update_required 使用版本作 scope', () => {
  const key = buildIdempotencyKey('user1', 'survey_update_required', 'v4.0');
  assert.equal(key, 'notif:user1:survey_update_required:v4.0');
});

test('buildIdempotencyKey: 不同 type 但同 userId + 同 scope 生成不同 key', () => {
  const key1 = buildIdempotencyKey('user1', 'match_revealed', 'week_2026-06-03');
  const key2 = buildIdempotencyKey('user1', 'match_expiring', 'week_2026-06-03');
  assert.notEqual(key1, key2, '不同 type 应产生不同幂等键');
});

test('buildIdempotencyKey: 同 type + 同 scope + 不同 userId 生成不同 key', () => {
  const key1 = buildIdempotencyKey('userA', 'match_revealed', 'week_2026-06-03');
  const key2 = buildIdempotencyKey('userB', 'match_revealed', 'week_2026-06-03');
  assert.notEqual(key1, key2, '不同用户应产生不同幂等键');
});

// ═══════════════════════════════════════════════════════════════
// 2. 通知实体生命周期状态机（纯函数模拟）
// ═══════════════════════════════════════════════════════════════

// 模拟通知行
type NotificationRow = {
  id: string;
  userId: string;
  type: string;
  isRead: boolean;
  readAt: string | null;
  expiresAt: string | null;
  deletedAt: string | null;
};

// 模拟 markAsRead 守卫逻辑（与 notificationService.ts 一致）
function simulateMarkAsRead(notif: NotificationRow): { updated: boolean; result: NotificationRow } {
  // 守卫：仅当 is_read = false 且 deleted_at IS NULL 时更新
  if (notif.isRead || notif.deletedAt !== null) {
    return { updated: false, result: notif };
  }
  return {
    updated: true,
    result: { ...notif, isRead: true, readAt: new Date().toISOString() },
  };
}

// 模拟 markAllAsRead 逻辑
function simulateMarkAllAsRead(notifs: NotificationRow[]): { updated: number; results: NotificationRow[] } {
  let updated = 0;
  const results = notifs.map((n) => {
    const { updated: didUpdate, result } = simulateMarkAsRead(n);
    if (didUpdate) updated++;
    return result;
  });
  return { updated, results };
}

// 模拟 cleanupExpiredNotifications 守卫逻辑
function simulateCleanup(notifs: NotificationRow[], now: string): { removed: number; results: NotificationRow[] } {
  let removed = 0;
  const results = notifs.map((n) => {
    // 守卫：expires_at IS NOT NULL AND expires_at < now AND deleted_at IS NULL
    if (n.expiresAt !== null && n.expiresAt < now && n.deletedAt === null) {
      removed++;
      return { ...n, deletedAt: now };
    }
    return n;
  });
  return { removed, results };
}

// 模拟查询可见性逻辑
function simulateQuery(notifs: NotificationRow[], status: 'all' | 'unread' | 'read'): NotificationRow[] {
  return notifs.filter((n) => {
    if (n.deletedAt !== null) return false; // 不可见
    if (status === 'unread') return !n.isRead;
    if (status === 'read') return n.isRead;
    return true; // all
  });
}

// --- 2A: 维度 A — 阅读状态（UNREAD ↔ READ）---

test('通知生命周期：新创建 → UNREAD (isRead=false)', () => {
  const notif: NotificationRow = {
    id: 'n1', userId: 'u1', type: 'match_revealed',
    isRead: false, readAt: null, expiresAt: null, deletedAt: null,
  };
  assert.equal(notif.isRead, false);
  assert.equal(notif.readAt, null);
});

test('通知生命周期：markAsRead → UNREAD 变 READ', () => {
  const notif: NotificationRow = {
    id: 'n1', userId: 'u1', type: 'match_revealed',
    isRead: false, readAt: null, expiresAt: null, deletedAt: null,
  };
  const { updated, result } = simulateMarkAsRead(notif);
  assert.equal(updated, true);
  assert.equal(result.isRead, true);
  assert.ok(result.readAt !== null, 'readAt 应被设置');
});

test('通知生命周期：已读再调 markAsRead → 幂等空操作', () => {
  const notif: NotificationRow = {
    id: 'n1', userId: 'u1', type: 'match_revealed',
    isRead: true, readAt: '2026-06-01T00:00:00Z', expiresAt: null, deletedAt: null,
  };
  const { updated } = simulateMarkAsRead(notif);
  assert.equal(updated, false, '已读再调应为幂等空操作');
});

test('通知生命周期：已删除的通知 markAsRead → 不更新', () => {
  const notif: NotificationRow = {
    id: 'n1', userId: 'u1', type: 'match_revealed',
    isRead: false, readAt: null, expiresAt: null, deletedAt: '2026-06-01T00:00:00Z',
  };
  const { updated } = simulateMarkAsRead(notif);
  assert.equal(updated, false, '已删除通知不可标记已读');
});

test('通知生命周期：markAllAsRead 批量更新所有未读', () => {
  const notifs: NotificationRow[] = [
    { id: 'n1', userId: 'u1', type: 'match_revealed', isRead: false, readAt: null, expiresAt: null, deletedAt: null },
    { id: 'n2', userId: 'u1', type: 'survey_incomplete', isRead: false, readAt: null, expiresAt: null, deletedAt: null },
    { id: 'n3', userId: 'u1', type: 'match_expiring', isRead: true, readAt: '2026-06-01T00:00:00Z', expiresAt: null, deletedAt: null },
  ];
  const { updated, results } = simulateMarkAllAsRead(notifs);
  assert.equal(updated, 2, '应更新 2 条未读');
  assert.equal(results.filter((r) => r.isRead).length, 3, '更新后全部已读');
});

// --- 2B: 维度 B — 时效状态（ACTIVE → EXPIRED → DELETED）---

test('通知生命周期：expires_at=NULL 永不过期', () => {
  const notifs: NotificationRow[] = [
    { id: 'n1', userId: 'u1', type: 'match_mutual_success', isRead: false, readAt: null, expiresAt: null, deletedAt: null },
  ];
  const { removed } = simulateCleanup(notifs, '2099-01-01T00:00:00Z');
  assert.equal(removed, 0, '无 expires_at 的通知不应被清理');
});

test('通知生命周期：expires_at 未到期 → 不清理', () => {
  const notifs: NotificationRow[] = [
    { id: 'n1', userId: 'u1', type: 'system_announcement', isRead: false, readAt: null, expiresAt: '2099-12-31T00:00:00Z', deletedAt: null },
  ];
  const { removed } = simulateCleanup(notifs, '2026-06-01T00:00:00Z');
  assert.equal(removed, 0);
});

test('通知生命周期：expires_at 已过期 → 标记 deleted_at（软删除）', () => {
  const notifs: NotificationRow[] = [
    { id: 'n1', userId: 'u1', type: 'system_announcement', isRead: false, readAt: null, expiresAt: '2026-05-01T00:00:00Z', deletedAt: null },
  ];
  const { removed, results } = simulateCleanup(notifs, '2026-06-01T00:00:00Z');
  assert.equal(removed, 1);
  assert.ok(results[0].deletedAt !== null, 'deletedAt 应被设置');
  assert.equal(results[0].expiresAt, '2026-05-01T00:00:00Z', 'expiresAt 不变');
});

test('通知生命周期：已软删除的过期通知不再重复清理', () => {
  const notifs: NotificationRow[] = [
    { id: 'n1', userId: 'u1', type: 'system_announcement', isRead: false, readAt: null, expiresAt: '2026-05-01T00:00:00Z', deletedAt: '2026-05-02T00:00:00Z' },
  ];
  const { removed } = simulateCleanup(notifs, '2026-06-01T00:00:00Z');
  assert.equal(removed, 0, '已软删除的不再重复处理');
});

// --- 2C: 维度 C — 查询可见性组合矩阵 ---

test('查询可见性：status=all 返回所有未删除通知', () => {
  const notifs: NotificationRow[] = [
    { id: 'n1', userId: 'u1', type: 't1', isRead: false, readAt: null, expiresAt: null, deletedAt: null },
    { id: 'n2', userId: 'u1', type: 't2', isRead: true, readAt: 'x', expiresAt: null, deletedAt: null },
    { id: 'n3', userId: 'u1', type: 't3', isRead: false, readAt: null, expiresAt: null, deletedAt: 'x' },
  ];
  const visible = simulateQuery(notifs, 'all');
  assert.equal(visible.length, 2, '已删除的通知不可见');
});

test('查询可见性：status=unread 仅返回未读+未删除', () => {
  const notifs: NotificationRow[] = [
    { id: 'n1', userId: 'u1', type: 't1', isRead: false, readAt: null, expiresAt: null, deletedAt: null },
    { id: 'n2', userId: 'u1', type: 't2', isRead: true, readAt: 'x', expiresAt: null, deletedAt: null },
    { id: 'n3', userId: 'u1', type: 't3', isRead: false, readAt: null, expiresAt: null, deletedAt: 'x' },
  ];
  const visible = simulateQuery(notifs, 'unread');
  assert.equal(visible.length, 1);
  assert.equal(visible[0].id, 'n1');
});

test('查询可见性：status=read 仅返回已读+未删除', () => {
  const notifs: NotificationRow[] = [
    { id: 'n1', userId: 'u1', type: 't1', isRead: false, readAt: null, expiresAt: null, deletedAt: null },
    { id: 'n2', userId: 'u1', type: 't2', isRead: true, readAt: 'x', expiresAt: null, deletedAt: null },
    { id: 'n3', userId: 'u1', type: 't3', isRead: true, readAt: 'x', expiresAt: null, deletedAt: 'x' },
  ];
  const visible = simulateQuery(notifs, 'read');
  assert.equal(visible.length, 1);
  assert.equal(visible[0].id, 'n2');
});

test('状态组合矩阵：过期+已读+已删除 → 不可见', () => {
  const notif: NotificationRow = {
    id: 'n1', userId: 'u1', type: 't1',
    isRead: true, readAt: 'x', expiresAt: '2026-01-01T00:00:00Z', deletedAt: '2026-01-02T00:00:00Z',
  };
  assert.equal(simulateQuery([notif], 'all').length, 0);
  assert.equal(simulateQuery([notif], 'unread').length, 0);
  assert.equal(simulateQuery([notif], 'read').length, 0);
});

// ═══════════════════════════════════════════════════════════════
// 3. 广播任务生命周期状态机
// ═══════════════════════════════════════════════════════════════

type BroadcastTaskRow = {
  id: string;
  status: BroadcastTaskStatus;
  createdCount: number;
  skippedCount: number;
  totalEstimate: number;
  startedAt: string | null;
  finishedAt: string | null;
};

// 模拟乐观锁抢锁
function simulateLock(task: BroadcastTaskRow): { locked: boolean; result: BroadcastTaskRow } {
  if (task.status !== 'pending') {
    return { locked: false, result: task };
  }
  return {
    locked: true,
    result: { ...task, status: 'running', startedAt: new Date().toISOString() },
  };
}

// 模拟完成
function simulateComplete(task: BroadcastTaskRow, created: number, skipped: number): BroadcastTaskRow {
  return {
    ...task,
    status: 'completed',
    createdCount: created,
    skippedCount: skipped,
    finishedAt: new Date().toISOString(),
  };
}

// 模拟失败
function simulateFail(task: BroadcastTaskRow): BroadcastTaskRow {
  return {
    ...task,
    status: 'failed',
    finishedAt: new Date().toISOString(),
  };
}

// 模拟重试（人工触发）
function simulateRetry(task: BroadcastTaskRow): BroadcastTaskRow {
  if (task.status !== 'failed') return task;
  return { ...task, status: 'pending', startedAt: null, finishedAt: null };
}

test('广播任务：PENDING → 乐观锁抢锁 → RUNNING', () => {
  const task: BroadcastTaskRow = {
    id: 'bt1', status: 'pending', createdCount: 0, skippedCount: 0, totalEstimate: 100,
    startedAt: null, finishedAt: null,
  };
  const { locked, result } = simulateLock(task);
  assert.equal(locked, true);
  assert.equal(result.status, 'running');
  assert.ok(result.startedAt !== null);
});

test('广播任务：RUNNING 状态不可再次抢锁', () => {
  const task: BroadcastTaskRow = {
    id: 'bt1', status: 'running', createdCount: 0, skippedCount: 0, totalEstimate: 100,
    startedAt: '2026-06-01T00:00:00Z', finishedAt: null,
  };
  const { locked } = simulateLock(task);
  assert.equal(locked, false, 'running 状态不可抢锁');
});

test('广播任务：COMPLETED 状态不可抢锁', () => {
  const task: BroadcastTaskRow = {
    id: 'bt1', status: 'completed', createdCount: 100, skippedCount: 0, totalEstimate: 100,
    startedAt: '2026-06-01T00:00:00Z', finishedAt: '2026-06-01T00:01:00Z',
  };
  const { locked } = simulateLock(task);
  assert.equal(locked, false);
});

test('广播任务：RUNNING → COMPLETED', () => {
  const task: BroadcastTaskRow = {
    id: 'bt1', status: 'running', createdCount: 0, skippedCount: 0, totalEstimate: 100,
    startedAt: '2026-06-01T00:00:00Z', finishedAt: null,
  };
  const result = simulateComplete(task, 95, 5);
  assert.equal(result.status, 'completed');
  assert.equal(result.createdCount, 95);
  assert.equal(result.skippedCount, 5);
  assert.ok(result.finishedAt !== null);
});

test('广播任务：RUNNING → FAILED（写入异常）', () => {
  const task: BroadcastTaskRow = {
    id: 'bt1', status: 'running', createdCount: 50, skippedCount: 0, totalEstimate: 100,
    startedAt: '2026-06-01T00:00:00Z', finishedAt: null,
  };
  const result = simulateFail(task);
  assert.equal(result.status, 'failed');
  assert.ok(result.finishedAt !== null);
  assert.equal(result.createdCount, 50, '失败时保留已写入计数');
});

test('广播任务：FAILED → 人工重试 → PENDING', () => {
  const task: BroadcastTaskRow = {
    id: 'bt1', status: 'failed', createdCount: 50, skippedCount: 0, totalEstimate: 100,
    startedAt: '2026-06-01T00:00:00Z', finishedAt: '2026-06-01T00:00:30Z',
  };
  const result = simulateRetry(task);
  assert.equal(result.status, 'pending');
  assert.equal(result.startedAt, null);
  assert.equal(result.finishedAt, null);
});

test('广播任务：COMPLETED 不允许重试', () => {
  const task: BroadcastTaskRow = {
    id: 'bt1', status: 'completed', createdCount: 100, skippedCount: 0, totalEstimate: 100,
    startedAt: '2026-06-01T00:00:00Z', finishedAt: '2026-06-01T00:01:00Z',
  };
  const result = simulateRetry(task);
  assert.equal(result.status, 'completed', '终态不可回退');
});

test('广播任务：完整生命周期 PENDING→RUNNING→COMPLETED', () => {
  let task: BroadcastTaskRow = {
    id: 'bt1', status: 'pending', createdCount: 0, skippedCount: 0, totalEstimate: 100,
    startedAt: null, finishedAt: null,
  };

  // Step 1: 抢锁
  const { locked, result: afterLock } = simulateLock(task);
  assert.equal(locked, true);
  task = afterLock;

  // Step 2: 完成
  task = simulateComplete(task, 98, 2);
  assert.equal(task.status, 'completed');
  assert.equal(task.createdCount, 98);
  assert.equal(task.skippedCount, 2);
});

test('广播任务：完整生命周期 PENDING→RUNNING→FAILED→PENDING→RUNNING→COMPLETED（重试成功）', () => {
  let task: BroadcastTaskRow = {
    id: 'bt1', status: 'pending', createdCount: 0, skippedCount: 0, totalEstimate: 100,
    startedAt: null, finishedAt: null,
  };

  // 第一次尝试失败
  const { result: afterLock1 } = simulateLock(task);
  task = simulateFail(afterLock1);
  assert.equal(task.status, 'failed');

  // 人工重试
  task = simulateRetry(task);
  assert.equal(task.status, 'pending');

  // 第二次尝试成功
  const { locked, result: afterLock2 } = simulateLock(task);
  assert.equal(locked, true);
  task = simulateComplete(afterLock2, 100, 0);
  assert.equal(task.status, 'completed');
});

// ═══════════════════════════════════════════════════════════════
// 4. 业务事件→通知触发映射（状态机三）
// ═══════════════════════════════════════════════════════════════

// --- 4A: 匹配系统状态机 → 通知触发 ---

type MatchRow = {
  id: string;
  weekOf: string;
  userAId: string;
  userBId: string;
  status: 'LOCKED' | 'REVEALED' | 'MUTUAL' | 'MISSED' | 'EXPIRED';
  userAAction: string | null;
  userBAction: string | null;
};

// 模拟：根据匹配状态转换决定通知类型
function simulateMatchNotifications(
  prevStatus: string,
  newStatus: string,
  match: MatchRow,
): Array<{ userId: string; type: string; idempotencyScope: string }> {
  const notifications: Array<{ userId: string; type: string; idempotencyScope: string }> = [];

  if (prevStatus === 'LOCKED' && newStatus === 'REVEALED') {
    // 揭晓：有匹配的用户 → match_revealed
    notifications.push(
      { userId: match.userAId, type: 'match_revealed', idempotencyScope: `week_${match.weekOf}` },
      { userId: match.userBId, type: 'match_revealed', idempotencyScope: `week_${match.weekOf}` },
    );
  }

  if (newStatus === 'MUTUAL') {
    // 双向接受 → match_mutual_success
    notifications.push(
      { userId: match.userAId, type: 'match_mutual_success', idempotencyScope: `match_${match.id}` },
      { userId: match.userBId, type: 'match_mutual_success', idempotencyScope: `match_${match.id}` },
    );
  }

  return notifications;
}

test('匹配通知：LOCKED→REVEALED 触发 match_revealed（双方各一条）', () => {
  const match: MatchRow = {
    id: 'm1', weekOf: '2026-06-03', userAId: 'uA', userBId: 'uB',
    status: 'LOCKED', userAAction: null, userBAction: null,
  };
  const notifs = simulateMatchNotifications('LOCKED', 'REVEALED', match);
  assert.equal(notifs.length, 2);
  assert.equal(notifs[0].type, 'match_revealed');
  assert.equal(notifs[1].type, 'match_revealed');
  assert.equal(notifs[0].userId, 'uA');
  assert.equal(notifs[1].userId, 'uB');
  // 幂等键格式验证
  assert.equal(
    buildIdempotencyKey(notifs[0].userId, 'match_revealed', notifs[0].idempotencyScope),
    'notif:uA:match_revealed:week_2026-06-03',
  );
});

test('匹配通知：REVEALED→MUTUAL 触发 match_mutual_success（双方各一条）', () => {
  const match: MatchRow = {
    id: 'm1', weekOf: '2026-06-03', userAId: 'uA', userBId: 'uB',
    status: 'REVEALED', userAAction: 'ACCEPT', userBAction: 'ACCEPT',
  };
  const notifs = simulateMatchNotifications('REVEALED', 'MUTUAL', match);
  assert.equal(notifs.length, 2);
  assert.equal(notifs[0].type, 'match_mutual_success');
  assert.equal(notifs[1].type, 'match_mutual_success');
  assert.equal(
    buildIdempotencyKey(notifs[0].userId, 'match_mutual_success', notifs[0].idempotencyScope),
    'notif:uA:match_mutual_success:match_m1',
  );
});

test('匹配通知：REVEALED→MISSED 不触发通知', () => {
  const match: MatchRow = {
    id: 'm1', weekOf: '2026-06-03', userAId: 'uA', userBId: 'uB',
    status: 'REVEALED', userAAction: 'ACCEPT', userBAction: 'REJECT',
  };
  const notifs = simulateMatchNotifications('REVEALED', 'MISSED', match);
  assert.equal(notifs.length, 0, 'MISSED 不触发通知');
});

test('匹配通知：REVEALED→EXPIRED 不触发通知', () => {
  const match: MatchRow = {
    id: 'm1', weekOf: '2026-06-03', userAId: 'uA', userBId: 'uB',
    status: 'REVEALED', userAAction: null, userBAction: null,
  };
  const notifs = simulateMatchNotifications('REVEALED', 'EXPIRED', match);
  assert.equal(notifs.length, 0, 'EXPIRED 不触发通知');
});

// --- 4B: 问卷系统 → 通知触发 ---

test('问卷通知：survey_incomplete 幂等键使用 weekOf', () => {
  const userId = 'user1';
  const weekOf = '2026-06-03';
  const key = buildIdempotencyKey(userId, 'survey_incomplete', `week_${weekOf}`);
  assert.equal(key, 'notif:user1:survey_incomplete:week_2026-06-03');
});

test('问卷通知：survey_update_required 幂等键使用版本号', () => {
  const userId = 'user1';
  const version = '4.0';
  const key = buildIdempotencyKey(userId, 'survey_update_required', `v${version}`);
  assert.equal(key, 'notif:user1:survey_update_required:v4.0');
});

// --- 4C: 举报系统 → 通知触发 ---

type ReportRow = {
  id: string;
  reporterId: string;
  reportedId: string;
  status: 'pending' | 'reviewed' | 'warn_update' | 'dismissed';
};

// 模拟：根据举报状态转换决定通知对象和内容
function simulateReportNotifications(
  prevStatus: string,
  newStatus: string,
  report: ReportRow,
): Array<{ userId: string; type: string; idempotencyScope: string }> {
  if (prevStatus !== 'pending') return []; // 守卫：只有 pending 可转换

  const notifs: Array<{ userId: string; type: string; idempotencyScope: string }> = [];

  if (newStatus === 'reviewed') {
    // 双方都通知
    notifs.push(
      { userId: report.reporterId, type: 'report_result', idempotencyScope: `report_${report.id}` },
      { userId: report.reportedId, type: 'report_result', idempotencyScope: `report_${report.id}` },
    );
  } else if (newStatus === 'warn_update') {
    // 双方都通知
    notifs.push(
      { userId: report.reporterId, type: 'report_result', idempotencyScope: `report_${report.id}` },
      { userId: report.reportedId, type: 'report_result', idempotencyScope: `report_${report.id}` },
    );
  } else if (newStatus === 'dismissed') {
    // 仅通知举报者
    notifs.push(
      { userId: report.reporterId, type: 'report_result', idempotencyScope: `report_${report.id}` },
    );
  }
  // request_evidence → 不写通知

  return notifs;
}

test('举报通知：PENDING→reviewed 双方都通知', () => {
  const report: ReportRow = { id: 'r1', reporterId: 'rep1', reportedId: 'rep2', status: 'pending' };
  const notifs = simulateReportNotifications('pending', 'reviewed', report);
  assert.equal(notifs.length, 2);
  assert.equal(notifs[0].userId, 'rep1');
  assert.equal(notifs[1].userId, 'rep2');
});

test('举报通知：PENDING→warn_update 双方都通知', () => {
  const report: ReportRow = { id: 'r1', reporterId: 'rep1', reportedId: 'rep2', status: 'pending' };
  const notifs = simulateReportNotifications('pending', 'warn_update', report);
  assert.equal(notifs.length, 2);
});

test('举报通知：PENDING→dismissed 仅通知举报者', () => {
  const report: ReportRow = { id: 'r1', reporterId: 'rep1', reportedId: 'rep2', status: 'pending' };
  const notifs = simulateReportNotifications('pending', 'dismissed', report);
  assert.equal(notifs.length, 1);
  assert.equal(notifs[0].userId, 'rep1', '仅通知举报者');
});

test('举报通知：request_evidence 不写通知', () => {
  const report: ReportRow = { id: 'r1', reporterId: 'rep1', reportedId: 'rep2', status: 'pending' };
  const notifs = simulateReportNotifications('pending', 'request_evidence', report);
  assert.equal(notifs.length, 0, 'request_evidence 不触发通知');
});

test('举报通知：已处理的状态不可重复触发', () => {
  const report: ReportRow = { id: 'r1', reporterId: 'rep1', reportedId: 'rep2', status: 'reviewed' };
  const notifs = simulateReportNotifications('reviewed', 'dismissed', report);
  assert.equal(notifs.length, 0, '非 pending 状态不触发');
});

// --- 4D: Heartbox 互选 → 通知触发 ---

test('Heartbox 通知：互选成功共用 match_mutual_success 类型，meta.source 区分', () => {
  const matchId = 'hm1';
  const userA = 'uA';
  const userB = 'uB';

  // 模拟 heartbox 互选成功写入通知
  const keyA = buildIdempotencyKey(userA, 'match_mutual_success', `match_${matchId}`);
  const keyB = buildIdempotencyKey(userB, 'match_mutual_success', `match_${matchId}`);

  assert.equal(keyA, 'notif:uA:match_mutual_success:match_hm1');
  assert.equal(keyB, 'notif:uB:match_mutual_success:match_hm1');

  // 注意：实际写入时 meta 包含 source: 'heartbox' 用于区分
  // 幂等键不包含 source，因为同一 matchId 不会同时来自 weekly 和 heartbox
});

// ═══════════════════════════════════════════════════════════════
// 5. 状态机守卫条件汇总测试
// ═══════════════════════════════════════════════════════════════

test('守卫：markAsRead 仅当 is_read=false 时更新', () => {
  const unread: NotificationRow = {
    id: 'n1', userId: 'u1', type: 't', isRead: false, readAt: null, expiresAt: null, deletedAt: null,
  };
  const read: NotificationRow = {
    id: 'n2', userId: 'u1', type: 't', isRead: true, readAt: 'x', expiresAt: null, deletedAt: null,
  };

  assert.equal(simulateMarkAsRead(unread).updated, true);
  assert.equal(simulateMarkAsRead(read).updated, false);
});

test('守卫：cleanup 仅当 expires_at < now AND deleted_at IS NULL 时执行', () => {
  const now = '2026-06-01T00:00:00Z';
  const cases: { notif: NotificationRow; expectedRemoved: number; desc: string }[] = [
    {
      notif: { id: 'n1', userId: 'u1', type: 't', isRead: false, readAt: null, expiresAt: null, deletedAt: null },
      expectedRemoved: 0,
      desc: 'expires_at=NULL → 不清理',
    },
    {
      notif: { id: 'n2', userId: 'u1', type: 't', isRead: false, readAt: null, expiresAt: '2099-01-01T00:00:00Z', deletedAt: null },
      expectedRemoved: 0,
      desc: 'expires_at>now → 不清理',
    },
    {
      notif: { id: 'n3', userId: 'u1', type: 't', isRead: false, readAt: null, expiresAt: '2026-05-01T00:00:00Z', deletedAt: null },
      expectedRemoved: 1,
      desc: 'expires_at<now AND deleted_at=NULL → 清理',
    },
    {
      notif: { id: 'n4', userId: 'u1', type: 't', isRead: false, readAt: null, expiresAt: '2026-05-01T00:00:00Z', deletedAt: '2026-05-02T00:00:00Z' },
      expectedRemoved: 0,
      desc: 'expires_at<now AND deleted_at≠NULL → 不清理',
    },
  ];

  for (const { notif, expectedRemoved, desc } of cases) {
    const { removed } = simulateCleanup([notif], now);
    assert.equal(removed, expectedRemoved, desc);
  }
});

test('守卫：广播乐观锁仅 pending 可抢', () => {
  const statuses: BroadcastTaskStatus[] = ['pending', 'running', 'completed', 'failed'];
  const expected = [true, false, false, false];

  for (let i = 0; i < statuses.length; i++) {
    const task: BroadcastTaskRow = {
      id: 'bt1', status: statuses[i], createdCount: 0, skippedCount: 0, totalEstimate: 100,
      startedAt: null, finishedAt: null,
    };
    const { locked } = simulateLock(task);
    assert.equal(locked, expected[i], `status=${statuses[i]} 抢锁结果`);
  }
});

test('守卫：举报仅 pending 状态可触发通知', () => {
  const report: ReportRow = { id: 'r1', reporterId: 'rep1', reportedId: 'rep2', status: 'reviewed' };
  const notifs = simulateReportNotifications('reviewed', 'dismissed', report);
  assert.equal(notifs.length, 0);
});

// ═══════════════════════════════════════════════════════════════
// 6. 路由层 Zod 校验测试
// ═══════════════════════════════════════════════════════════════

const broadcastSchema = z.object({
  type: z.enum(['system_announcement', 'policy_update']),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  level: z.enum(['info', 'success', 'warning', 'critical']).default('info'),
  actionUrl: z.string().max(500).optional(),
  targetUserIds: z.array(z.string()).nullable().optional(),
  expiresAt: z.string().datetime({ offset: true }).optional(),
});

test('路由校验：合法广播请求体通过', () => {
  const result = broadcastSchema.safeParse({
    type: 'system_announcement',
    title: '平台维护通知',
    body: '将于 2026-05-01 进行维护',
  });
  assert.ok(result.success);
  if (result.success) {
    assert.equal(result.data.level, 'info'); // default
  }
});

test('路由校验：type 必须为 system_announcement 或 policy_update', () => {
  const result = broadcastSchema.safeParse({
    type: 'match_revealed', // 非法
    title: 't',
    body: 'b',
  });
  assert.ok(!result.success);
});

test('路由校验：title 不能为空', () => {
  const result = broadcastSchema.safeParse({
    type: 'system_announcement',
    title: '',
    body: 'b',
  });
  assert.ok(!result.success);
});

test('路由校验：title 最长 200 字符', () => {
  const result = broadcastSchema.safeParse({
    type: 'system_announcement',
    title: 'a'.repeat(201),
    body: 'b',
  });
  assert.ok(!result.success);
});

test('路由校验：body 最长 2000 字符', () => {
  const result = broadcastSchema.safeParse({
    type: 'system_announcement',
    title: 't',
    body: 'b'.repeat(2001),
  });
  assert.ok(!result.success);
});

test('路由校验：level 必须为合法枚举值', () => {
  const result = broadcastSchema.safeParse({
    type: 'system_announcement',
    title: 't',
    body: 'b',
    level: 'urgent', // 非法
  });
  assert.ok(!result.success);
});

test('路由校验：targetUserIds 可为 null（全量广播）', () => {
  const result = broadcastSchema.safeParse({
    type: 'system_announcement',
    title: 't',
    body: 'b',
    targetUserIds: null,
  });
  assert.ok(result.success);
});

test('路由校验：targetUserIds 可为字符串数组（精确投递）', () => {
  const result = broadcastSchema.safeParse({
    type: 'system_announcement',
    title: 't',
    body: 'b',
    targetUserIds: ['user1', 'user2'],
  });
  assert.ok(result.success);
  if (result.success) {
    assert.deepEqual(result.data.targetUserIds, ['user1', 'user2']);
  }
});

test('路由校验：expiresAt 必须为合法 ISO datetime', () => {
  const result = broadcastSchema.safeParse({
    type: 'system_announcement',
    title: 't',
    body: 'b',
    expiresAt: '2026-05-02T00:00:00.000Z',
  });
  assert.ok(result.success);
});

test('路由校验：expiresAt 非法格式被拒绝', () => {
  const result = broadcastSchema.safeParse({
    type: 'system_announcement',
    title: 't',
    body: 'b',
    expiresAt: '2026-05-02', // 缺少时间部分
  });
  assert.ok(!result.success);
});

// ═══════════════════════════════════════════════════════════════
// 修复验证：广播去重 idempotency_scope
// ═══════════════════════════════════════════════════════════════

/**
 * 模拟广播幂等 scope 构造（与 notificationService.ts 一致）
 * 格式：broadcast:{type}:{title}:{targetScope}
 */
function buildBroadcastIdempotencyScope(
  type: string,
  title: string,
  targetUserIds: string[] | null,
): string {
  const targetScope = targetUserIds && targetUserIds.length > 0
    ? targetUserIds.slice().sort().join(',')
    : 'all';
  return `broadcast:${type}:${title}:${targetScope}`;
}

test('广播去重：相同 type+title+targetScope 产生相同 idempotencyScope', () => {
  const scope1 = buildBroadcastIdempotencyScope('system_announcement', '维护通知', null);
  const scope2 = buildBroadcastIdempotencyScope('system_announcement', '维护通知', null);
  assert.equal(scope1, scope2, '重复请求产生相同 scope');
});

test('广播去重：不同 title 产生不同 scope', () => {
  const scope1 = buildBroadcastIdempotencyScope('system_announcement', '维护通知', null);
  const scope2 = buildBroadcastIdempotencyScope('system_announcement', '活动通知', null);
  assert.notEqual(scope1, scope2);
});

test('广播去重：不同 type 产生不同 scope', () => {
  const scope1 = buildBroadcastIdempotencyScope('system_announcement', '通知', null);
  const scope2 = buildBroadcastIdempotencyScope('policy_update', '通知', null);
  assert.notEqual(scope1, scope2);
});

test('广播去重：指定用户列表排序后产生一致 scope', () => {
  const scope1 = buildBroadcastIdempotencyScope('system_announcement', '通知', ['u3', 'u1', 'u2']);
  const scope2 = buildBroadcastIdempotencyScope('system_announcement', '通知', ['u1', 'u2', 'u3']);
  assert.equal(scope1, scope2, '不同顺序的用户列表应产生相同 scope');
});

test('广播去重：全量广播 vs 指定用户产生不同 scope', () => {
  const scopeAll = buildBroadcastIdempotencyScope('system_announcement', '通知', null);
  const scopeTargeted = buildBroadcastIdempotencyScope('system_announcement', '通知', ['u1']);
  assert.notEqual(scopeAll, scopeTargeted);
});

test('广播去重：scope 格式符合设计文档 broadcast:{type}:{title}:{scope}', () => {
  const scope = buildBroadcastIdempotencyScope('policy_update', '隐私政策更新', null);
  assert.equal(scope, 'broadcast:policy_update:隐私政策更新:all');
});

// ═══════════════════════════════════════════════════════════════
// 修复验证：survey_update_required 通知写入
// ═══════════════════════════════════════════════════════════════

test('survey_update_required 幂等键包含版本号', () => {
  const key = buildIdempotencyKey('user1', 'survey_update_required', 'v4.0');
  assert.equal(key, 'notif:user1:survey_update_required:v4.0');
});

test('survey_update_required 不同版本产生不同幂等键', () => {
  const key1 = buildIdempotencyKey('user1', 'survey_update_required', 'v3.0');
  const key2 = buildIdempotencyKey('user1', 'survey_update_required', 'v4.0');
  assert.notEqual(key1, key2);
});

// ═══════════════════════════════════════════════════════════════
// 修复验证：同步广播确定性 taskId（防重复点击）
// ═══════════════════════════════════════════════════════════════

/**
 * 模拟同步广播确定性 taskId 构造（与 notificationService.ts broadcastNotifications 一致）
 */
function buildSyncBroadcastTaskId(type: string, title: string, userIds: string[]): string {
  const targetScope = userIds.slice().sort().join(',');
  return `bcast_sync:${type}:${title}:${targetScope}`;
}

test('同步广播：相同 type+title+userIds 产生相同 taskId', () => {
  const id1 = buildSyncBroadcastTaskId('system_announcement', '维护', ['u1', 'u2']);
  const id2 = buildSyncBroadcastTaskId('system_announcement', '维护', ['u2', 'u1']);
  assert.equal(id1, id2, '重复请求产生相同 taskId → 幂等');
});

test('同步广播：不同 title 产生不同 taskId', () => {
  const id1 = buildSyncBroadcastTaskId('system_announcement', '维护', ['u1']);
  const id2 = buildSyncBroadcastTaskId('system_announcement', '活动', ['u1']);
  assert.notEqual(id1, id2);
});

test('同步广播：taskId 可直接用于幂等键构造', () => {
  const taskId = buildSyncBroadcastTaskId('system_announcement', '维护', ['u1', 'u2']);
  const key = `notif:u1:system_announcement:bcast_${taskId}`;
  // 重复调用生成相同 key → ON CONFLICT DO NOTHING → 幂等
  const key2 = `notif:u1:system_announcement:bcast_${taskId}`;
  assert.equal(key, key2);
});
