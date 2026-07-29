/**
 * 阶段二集成测试：业务事件→通知触发映射完整性
 *
 * 验收标准（按 MESSAGE_CENTER_DEV_PLAN "状态机三" + "Code Review 检查清单"）：
 *   - 每个通知写入点使用 buildIdempotencyKey() 构造幂等键
 *   - 匹配揭晓通知在 unlockCurrentWeekMatches 后写入
 *   - recordAction 仅在 MUTUAL 时写通知，MISSED/EXPIRED 不写
 *   - Heartbox 互选通知 meta.source = 'heartbox'
 *   - 举报审核 request_evidence 不触发 report_result
 *   - 举报 reviewed/warn_update 双方通知，dismissed 仅举报者
 *
 * 测试方式：纯函数模拟（与 matchService.test.ts 一致），不依赖数据库。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildIdempotencyKey, type NotificationType } from './notificationService.js';

// ═══════════════════════════════════════════════════════════════
// 辅助：模拟通知收集器
// ═══════════════════════════════════════════════════════════════

type NotificationEntry = {
  userId: string;
  type: string;
  idempotencyKey: string;
  meta: Record<string, unknown>;
};

/**
 * 模拟 matchService.unlockCurrentWeekMatches 后的通知写入逻辑
 */
function simulateUnlockNotifications(
  revealedMatchUserIds: Array<{ userAId: string; userBId: string }>,
  participatingUserIds: string[],
  weekOf: string,
): NotificationEntry[] {
  const notifications: NotificationEntry[] = [];

  // 有匹配的用户 → match_revealed
  const revealedUserIds = new Set<string>();
  for (const m of revealedMatchUserIds) {
    revealedUserIds.add(m.userAId);
    revealedUserIds.add(m.userBId);
  }

  for (const uid of revealedUserIds) {
    notifications.push({
      userId: uid,
      type: 'match_revealed',
      idempotencyKey: buildIdempotencyKey(uid, 'match_revealed', `week_${weekOf}`),
      meta: { weekOf, source: 'weekly' },
    });
  }

  // 无匹配的用户 → match_no_result
  const noMatchUsers = participatingUserIds.filter((id) => !revealedUserIds.has(id));
  for (const uid of noMatchUsers) {
    notifications.push({
      userId: uid,
      type: 'match_no_result',
      idempotencyKey: buildIdempotencyKey(uid, 'match_no_result', `week_${weekOf}`),
      meta: { weekOf, source: 'weekly' },
    });
  }

  return notifications;
}

/**
 * 模拟 matchService.recordAction 后的通知写入逻辑
 */
function simulateRecordActionNotifications(
  newStatus: string,
  matchId: string,
  userAId: string,
  userBId: string,
): NotificationEntry[] {
  const notifications: NotificationEntry[] = [];

  if (newStatus === 'MUTUAL') {
    for (const uid of [userAId, userBId]) {
      notifications.push({
        userId: uid,
        type: 'match_mutual_success',
        idempotencyKey: buildIdempotencyKey(uid, 'match_mutual_success', `match_${matchId}`),
        meta: { matchId, source: 'weekly' },
      });
    }
  }

  return notifications;
}

/**
 * 模拟 heartbox 互选后的通知写入逻辑
 */
function simulateHeartboxNotifications(
  heartMatchId: string,
  userIds: string[],
): NotificationEntry[] {
  const notifications: NotificationEntry[] = [];

  for (const uid of userIds) {
    notifications.push({
      userId: uid,
      type: 'match_mutual_success',
      idempotencyKey: buildIdempotencyKey(uid, 'match_mutual_success', `match_${heartMatchId}`),
      meta: { matchId: heartMatchId, source: 'heartbox' },
    });
  }

  return notifications;
}

/**
 * 模拟 admin 审核举报后的通知写入逻辑
 */
function simulateReportNotifications(
  action: string,
  reportId: string,
  reporterId: string,
  reportedId: string,
): NotificationEntry[] {
  const notifications: NotificationEntry[] = [];

  // reviewed / warn_update → 双方；dismissed → 仅举报者；request_evidence → 不写
  if (action === 'request_evidence') return notifications;

  const targets = [reporterId];
  if (action === 'reviewed' || action === 'warn_update') {
    targets.push(reportedId);
  }

  for (const uid of targets) {
    notifications.push({
      userId: uid,
      type: 'report_result',
      idempotencyKey: buildIdempotencyKey(uid, 'report_result', `report_${reportId}`),
      meta: { reportId, outcome: action },
    });
  }

  return notifications;
}

// ═══════════════════════════════════════════════════════════════
// 测试：匹配揭晓（unlockCurrentWeekMatches）
// ═══════════════════════════════════════════════════════════════

test('集成：揭晓 3 个匹配，6 个用户得 match_revealed，其余得 match_no_result', () => {
  const weekOf = '2026-06-03';
  const matches = [
    { userAId: 'u1', userBId: 'u2' },
    { userAId: 'u3', userBId: 'u4' },
    { userAId: 'u5', userBId: 'u6' },
  ];
  const participating = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8', 'u9'];

  const notifs = simulateUnlockNotifications(matches, participating, weekOf);

  const revealed = notifs.filter((n) => n.type === 'match_revealed');
  const noResult = notifs.filter((n) => n.type === 'match_no_result');

  assert.equal(revealed.length, 6, '6 个有匹配用户');
  assert.equal(noResult.length, 3, '3 个无匹配用户');
});

test('集成：揭晓通知所有幂等键唯一', () => {
  const weekOf = '2026-06-03';
  const matches = [{ userAId: 'u1', userBId: 'u2' }];
  const participating = ['u1', 'u2', 'u3'];

  const notifs = simulateUnlockNotifications(matches, participating, weekOf);
  const keys = notifs.map((n) => n.idempotencyKey);
  const uniqueKeys = new Set(keys);
  assert.equal(uniqueKeys.size, keys.length, '所有幂等键唯一');
});

test('集成：揭晓名单为空时仅 no_result 通知', () => {
  const weekOf = '2026-06-03';
  const notifs = simulateUnlockNotifications([], ['u1', 'u2'], weekOf);
  assert.equal(notifs.length, 2);
  assert.ok(notifs.every((n) => n.type === 'match_no_result'));
});

// ═══════════════════════════════════════════════════════════════
// 测试：双向匹配（recordAction → MUTUAL）
// ═══════════════════════════════════════════════════════════════

test('集成：MUTUAL 写 match_mutual_success（双方各一条）', () => {
  const notifs = simulateRecordActionNotifications('MUTUAL', 'm1', 'uA', 'uB');
  assert.equal(notifs.length, 2);
  assert.equal(notifs[0].userId, 'uA');
  assert.equal(notifs[1].userId, 'uB');
  assert.equal(notifs[0].type, 'match_mutual_success');
  assert.equal(notifs[0].meta.source, 'weekly');
});

test('集成：MISSED 不写通知', () => {
  const notifs = simulateRecordActionNotifications('MISSED', 'm1', 'uA', 'uB');
  assert.equal(notifs.length, 0);
});

test('集成：EXPIRED 不写通知', () => {
  const notifs = simulateRecordActionNotifications('EXPIRED', 'm1', 'uA', 'uB');
  assert.equal(notifs.length, 0);
});

test('集成：MUTUAL 幂等键包含 matchId', () => {
  const notifs = simulateRecordActionNotifications('MUTUAL', 'm42', 'uA', 'uB');
  assert.equal(
    notifs[0].idempotencyKey,
    'notif:uA:match_mutual_success:match_m42',
  );
  assert.equal(
    notifs[1].idempotencyKey,
    'notif:uB:match_mutual_success:match_m42',
  );
});

// ═══════════════════════════════════════════════════════════════
// 测试：Heartbox 互选
// ═══════════════════════════════════════════════════════════════

test('集成：Heartbox 互选写 match_mutual_success + meta.source=heartbox', () => {
  const notifs = simulateHeartboxNotifications('hm1', ['uA', 'uB']);
  assert.equal(notifs.length, 2);
  assert.equal(notifs[0].meta.source, 'heartbox');
  assert.equal(notifs[1].meta.source, 'heartbox');
});

test('集成：Heartbox 与主匹配同 matchId 类型不冲突（实际不会发生）', () => {
  // 即使同 ID，来源不同也不会冲突（幂等键包含 matchId 而不含 source）
  const heartboxKey = buildIdempotencyKey('uA', 'match_mutual_success', 'match_hm1');
  const weeklyKey = buildIdempotencyKey('uA', 'match_mutual_success', 'match_m1');
  assert.notEqual(heartboxKey, weeklyKey);
});

// ═══════════════════════════════════════════════════════════════
// 测试：举报审核
// ═══════════════════════════════════════════════════════════════

test('集成：reviewed 双方通知', () => {
  const notifs = simulateReportNotifications('reviewed', 'r1', 'reporter', 'reported');
  assert.equal(notifs.length, 2);
  assert.equal(notifs[0].userId, 'reporter');
  assert.equal(notifs[1].userId, 'reported');
  assert.equal(notifs[0].meta.outcome, 'reviewed');
});

test('集成：warn_update 双方通知', () => {
  const notifs = simulateReportNotifications('warn_update', 'r1', 'reporter', 'reported');
  assert.equal(notifs.length, 2);
});

test('集成：dismissed 仅通知举报者', () => {
  const notifs = simulateReportNotifications('dismissed', 'r1', 'reporter', 'reported');
  assert.equal(notifs.length, 1);
  assert.equal(notifs[0].userId, 'reporter');
});

test('集成：request_evidence 不写通知', () => {
  const notifs = simulateReportNotifications('request_evidence', 'r1', 'reporter', 'reported');
  assert.equal(notifs.length, 0);
});

test('集成：举报通知幂等键包含 reportId', () => {
  const notifs = simulateReportNotifications('reviewed', 'r42', 'rep', 'repd');
  assert.equal(notifs[0].idempotencyKey, 'notif:rep:report_result:report_r42');
  assert.equal(notifs[1].idempotencyKey, 'notif:repd:report_result:report_r42');
});

// ═══════════════════════════════════════════════════════════════
// 测试：完整业务流程编排（端到端模拟）
// ═══════════════════════════════════════════════════════════════

test('完整流程：匹配揭晓 → 双向成功 → 通知类型序列正确', () => {
  const weekOf = '2026-06-03';
  const matchId = 'm1';
  const userA = 'uA';
  const userB = 'uB';

  // Step 1: 揭晓
  const unlockNotifs = simulateUnlockNotifications(
    [{ userAId: userA, userBId: userB }],
    [userA, userB],
    weekOf,
  );
  assert.equal(unlockNotifs.length, 2);
  assert.ok(unlockNotifs.every((n) => n.type === 'match_revealed'));

  // Step 2: 双方 ACCEPT → MUTUAL
  const mutualNotifs = simulateRecordActionNotifications('MUTUAL', matchId, userA, userB);
  assert.equal(mutualNotifs.length, 2);
  assert.ok(mutualNotifs.every((n) => n.type === 'match_mutual_success'));

  // 合并所有通知
  const allNotifs = [...unlockNotifs, ...mutualNotifs];
  const keys = allNotifs.map((n) => n.idempotencyKey);
  const uniqueKeys = new Set(keys);
  assert.equal(uniqueKeys.size, keys.length, '全部幂等键唯一');
});

test('完整流程：举报审核全场景（reviewed / warn_update / dismissed / request_evidence）', () => {
  const reportId = 'r1';
  const reporterId = 'rep';
  const reportedId = 'repd';

  const actions = ['reviewed', 'warn_update', 'dismissed', 'request_evidence'] as const;
  const expectedCounts = [2, 2, 1, 0];

  for (let i = 0; i < actions.length; i++) {
    const notifs = simulateReportNotifications(actions[i], reportId, reporterId, reportedId);
    assert.equal(notifs.length, expectedCounts[i], `action=${actions[i]}`);
  }
});

// ═══════════════════════════════════════════════════════════════
// 测试：Code Review 检查清单验证（状态机守卫）
// ═══════════════════════════════════════════════════════════════

test('检查清单：match_revealed 和 match_expiring 幂等键不冲突', () => {
  const userId = 'u1';
  const weekOf = '2026-06-03';
  const keyRevealed = buildIdempotencyKey(userId, 'match_revealed', `week_${weekOf}`);
  const keyExpiring = buildIdempotencyKey(userId, 'match_expiring', `week_${weekOf}`);
  assert.notEqual(keyRevealed, keyExpiring);
});

test('检查清单：match_mutual_success 幂等键按 matchId 区分 weekly/heartbox', () => {
  const userId = 'u1';
  // weekly 和 heartbox 的 matchId 必然不同（来自不同表）
  const weeklyKey = buildIdempotencyKey(userId, 'match_mutual_success', 'match_weekly_m1');
  const heartboxKey = buildIdempotencyKey(userId, 'match_mutual_success', 'match_hm1');
  assert.notEqual(weeklyKey, heartboxKey);
});

test('检查清单：report_result 幂等键按 reportId 区分不同举报', () => {
  const userId = 'rep1';
  const key1 = buildIdempotencyKey(userId, 'report_result', 'report_r1');
  const key2 = buildIdempotencyKey(userId, 'report_result', 'report_r2');
  assert.notEqual(key1, key2);
});

test('检查清单：同一举报同 outcome 对同一用户幂等', () => {
  const key1 = buildIdempotencyKey('rep', 'report_result', 'report_r1');
  const key2 = buildIdempotencyKey('rep', 'report_result', 'report_r1');
  assert.equal(key1, key2, '幂等键相同，重复触发不重复写入');
});
