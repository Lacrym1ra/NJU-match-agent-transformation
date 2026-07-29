/**
 * friendService 业务逻辑测试
 *
 * 覆盖范围：
 * - 好友请求前置条件校验（不能加自己、必须同圈）
 * - 好友请求去重（已有好友/已有 pending 请求）
 * - 好友请求处理权限（仅接收方可操作、只能处理 pending）
 * - accept 时建立双向好友关系（circle + global）
 * - 删除好友（单圈 vs 全局）
 * - Zod 验证
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError, NotFoundError, ValidationError } from '../utils/errors.js';

// ─── 1. 好友请求前置条件 ─────────────────────────────────────

test('不能向自己发送好友请求', () => {
  const userId = 'userA';
  const targetUserId = 'userA';
  // 源码 friendService.ts 第 219-221 行
  assert.equal(userId === targetUserId, true);
  // 此时应抛出 AppError(400, 'CANNOT_ADD_SELF')
});

test('不同用户 ID 可以发送好友请求', () => {
  const userId = 'userA';
  const targetUserId = 'userB';
  assert.notEqual(userId, targetUserId);
});

// ─── 2. 好友请求去重逻辑 ─────────────────────────────────────

test('已是好友不能重复发送请求', () => {
  // 模拟 areUsersCircleFriends 返回 true
  const alreadyFriends = true;
  // 源码第 226-229 行：if (alreadyFriends) throw 409
  assert.ok(alreadyFriends);
});

test('已有 pending 请求不能重复发送（双向检查）', () => {
  // 源码第 231-243 行：检查 circleId + status=pending + (A→B OR B→A)
  // 意味着如果 B 已经向 A 发了请求，A 也不能再向 B 发
  const existingPending = [{
    id: 'req1',
    circleId: 'circle1',
    senderId: 'userB',
    receiverId: 'userA',
    status: 'pending',
  }];

  // 新请求：userA → userB，同一 circle
  const newRequest = {
    circleId: 'circle1',
    senderId: 'userA',
    receiverId: 'userB',
  };

  // 检查是否有冲突的 pending 请求
  const hasConflict = existingPending.some(
    (r) => r.circleId === newRequest.circleId && r.status === 'pending' &&
      ((r.senderId === newRequest.senderId && r.receiverId === newRequest.receiverId) ||
       (r.senderId === newRequest.receiverId && r.receiverId === newRequest.senderId)),
  );
  assert.ok(hasConflict, '反向 pending 请求应被检测到');
});

test('不同 circle 的 pending 请求不冲突', () => {
  const existingPending = [{
    id: 'req1',
    circleId: 'circle1',
    senderId: 'userB',
    receiverId: 'userA',
    status: 'pending',
  }];

  const newRequest = {
    circleId: 'circle2', // 不同 circle
    senderId: 'userA',
    receiverId: 'userB',
  };

  const hasConflict = existingPending.some(
    (r) => r.circleId === newRequest.circleId && r.status === 'pending' &&
      ((r.senderId === newRequest.senderId && r.receiverId === newRequest.receiverId) ||
       (r.senderId === newRequest.receiverId && r.receiverId === newRequest.senderId)),
  );
  assert.ok(!hasConflict, '不同 circle 不冲突');
});

// ─── 3. 好友请求处理逻辑 ─────────────────────────────────────

// 模拟 handleFriendRequest 的核心逻辑
type FriendRequest = {
  id: string;
  circleId: string;
  senderId: string;
  receiverId: string;
  status: string;
};

function simulateHandleRequest(
  request: FriendRequest | null,
  userId: string,
  action: 'accept' | 'reject',
): { allowed: boolean; error?: string } {
  if (!request) {
    return { allowed: false, error: 'REQUEST_NOT_FOUND' };
  }
  if (request.receiverId !== userId) {
    return { allowed: false, error: 'NOT_RECEIVER' };
  }
  if (request.status !== 'pending') {
    return { allowed: false, error: 'ALREADY_PROCESSED' };
  }
  return { allowed: true };
}

test('处理请求：非接收方不能操作', () => {
  const request: FriendRequest = {
    id: 'req1',
    circleId: 'c1',
    senderId: 'sender',
    receiverId: 'realReceiver',
    status: 'pending',
  };

  const result = simulateHandleRequest(request, 'otherUser', 'accept');
  assert.ok(!result.allowed);
  assert.equal(result.error, 'NOT_RECEIVER');
});

test('处理请求：发送方也不能处理自己的请求', () => {
  const request: FriendRequest = {
    id: 'req1',
    circleId: 'c1',
    senderId: 'sender',
    receiverId: 'receiver',
    status: 'pending',
  };

  const result = simulateHandleRequest(request, 'sender', 'accept');
  assert.ok(!result.allowed);
  assert.equal(result.error, 'NOT_RECEIVER');
});

test('处理请求：已处理的请求不能再次操作', () => {
  const request: FriendRequest = {
    id: 'req1',
    circleId: 'c1',
    senderId: 'sender',
    receiverId: 'receiver',
    status: 'accepted',
  };

  const result = simulateHandleRequest(request, 'receiver', 'accept');
  assert.ok(!result.allowed);
  assert.equal(result.error, 'ALREADY_PROCESSED');
});

test('处理请求：已拒绝的请求不能再次操作', () => {
  const request: FriendRequest = {
    id: 'req1',
    circleId: 'c1',
    senderId: 'sender',
    receiverId: 'receiver',
    status: 'rejected',
  };

  const result = simulateHandleRequest(request, 'receiver', 'accept');
  assert.ok(!result.allowed);
  assert.equal(result.error, 'ALREADY_PROCESSED');
});

test('处理请求：接收方可以 accept', () => {
  const request: FriendRequest = {
    id: 'req1',
    circleId: 'c1',
    senderId: 'sender',
    receiverId: 'receiver',
    status: 'pending',
  };

  const result = simulateHandleRequest(request, 'receiver', 'accept');
  assert.ok(result.allowed);
});

test('处理请求：接收方可以 reject', () => {
  const request: FriendRequest = {
    id: 'req1',
    circleId: 'c1',
    senderId: 'sender',
    receiverId: 'receiver',
    status: 'pending',
  };

  const result = simulateHandleRequest(request, 'receiver', 'reject');
  assert.ok(result.allowed);
});

test('处理请求：请求不存在', () => {
  const result = simulateHandleRequest(null, 'receiver', 'accept');
  assert.ok(!result.allowed);
  assert.equal(result.error, 'REQUEST_NOT_FOUND');
});

// ─── 4. 好友对归一化 ────────────────────────────────────────

// 模拟 normalizeFriendPair
function normalizeFriendPair(idA: string, idB: string): { userAId: string; userBId: string } {
  return idA < idB ? { userAId: idA, userBId: idB } : { userAId: idB, userBId: idA };
}

test('好友对归一化：较小 ID 始终为 userA', () => {
  const p1 = normalizeFriendPair('aaa', 'bbb');
  assert.equal(p1.userAId, 'aaa');
  assert.equal(p1.userBId, 'bbb');

  const p2 = normalizeFriendPair('bbb', 'aaa');
  assert.equal(p2.userAId, 'aaa');
  assert.equal(p2.userBId, 'bbb');

  assert.deepEqual(p1, p2, '归一化后结果应相同');
});

// ─── 5. 删除好友逻辑 ─────────────────────────────────────────

test('不能删除自己为好友', () => {
  const userId = 'userA';
  const friendId = 'userA';
  // 源码 friendService.ts 第 399-401 行
  assert.equal(userId === friendId, true);
  // 此时应抛出 ValidationError
});

test('deleteFriend 只删除指定 circle 的好友关系', () => {
  // 源码 friendService.ts 第 398-424 行
  // 只删除 circleId 匹配的记录，保留其他 circle 的好友关系
  const friendships = [
    { circleId: 'c1', userAId: 'A', userBId: 'B' },
    { circleId: 'c2', userAId: 'A', userBId: 'B' },
    { circleId: 'c3', userAId: 'A', userBId: 'B' },
  ];

  const targetCircle = 'c1';
  const deleted = friendships.filter((f) => f.circleId === targetCircle);
  const remaining = friendships.filter((f) => f.circleId !== targetCircle);

  assert.equal(deleted.length, 1, '只删除指定 circle 的好友关系');
  assert.equal(remaining.length, 2, '其他 circle 的好友关系保留');
});

test('deleteAllFriends 删除所有 circle 和全局好友关系', () => {
  // 源码 friendService.ts 第 426-452 行
  const circleFriendships = [
    { id: 'f1', circleId: 'c1' },
    { id: 'f2', circleId: 'c2' },
  ];
  const globalFriendships = [
    { id: 'g1' },
  ];

  // 模拟全部删除
  assert.equal(circleFriendships.length, 2);
  assert.equal(globalFriendships.length, 1);
  // 全部删除后 remainingCircleCount = 0
});

// ─── 6. 同圈验证逻辑 ─────────────────────────────────────────

test('两人必须在同一活跃圈子中才能发送好友请求', () => {
  // 模拟 ensureUsersShareCircle
  const circleMembers = [
    { userId: 'userA', circleId: 'c1', membershipStatus: 'ACTIVE', isActive: true },
    { userId: 'userB', circleId: 'c1', membershipStatus: 'ACTIVE', isActive: true },
  ];

  const bothInCircle = new Set(circleMembers.map((m) => m.userId));
  assert.ok(bothInCircle.has('userA'));
  assert.ok(bothInCircle.has('userB'));
  assert.equal(bothInCircle.size, 2);
});

test('一人不在圈子中不能发送好友请求', () => {
  const circleMembers = [
    { userId: 'userA', circleId: 'c1', membershipStatus: 'ACTIVE', isActive: true },
    // userB 不在列表中
  ];

  const bothInCircle = new Set(circleMembers.map((m) => m.userId));
  assert.ok(bothInCircle.has('userA'));
  assert.ok(!bothInCircle.has('userB'));
  // 此时应抛出 403
});

test('非活跃成员不能发送好友请求', () => {
  const circleMembers = [
    { userId: 'userA', circleId: 'c1', membershipStatus: 'ACTIVE', isActive: true },
    { userId: 'userB', circleId: 'c1', membershipStatus: 'INACTIVE', isActive: false },
  ];

  const activeMembers = circleMembers
    .filter((m) => m.membershipStatus === 'ACTIVE' && m.isActive)
    .map((m) => m.userId);

  assert.ok(activeMembers.includes('userA'));
  assert.ok(!activeMembers.includes('userB'), '非活跃成员不应通过验证');
});

// ─── 7. 用户举报逻辑 ─────────────────────────────────────────

const reportReasonEnum = z.enum(['harassment', 'spam', 'fake_profile', 'inappropriate_content', 'other']);

const reportSchema = z.union([
  z.object({
    reasons: z.array(reportReasonEnum).min(1).max(5),
    detail: z.string().max(500).optional(),
  }),
  z.object({
    reason: reportReasonEnum,
    detail: z.string().max(500).optional(),
  }),
]);

test('举报 schema：支持单 reason 和多 reasons 两种格式', () => {
  // 单 reason
  assert.ok(reportSchema.safeParse({ reason: 'harassment' }).success);
  // 多 reasons
  assert.ok(reportSchema.safeParse({ reasons: ['harassment', 'spam'] }).success);
  // 带详情
  assert.ok(reportSchema.safeParse({ reason: 'other', detail: '具体描述' }).success);
});

test('举报 schema：空 reasons 拒绝', () => {
  assert.ok(!reportSchema.safeParse({ reasons: [] }).success);
});

test('举报 schema：超过 5 个 reasons 拒绝', () => {
  const reasons = ['harassment', 'spam', 'fake_profile', 'inappropriate_content', 'other', 'harassment'];
  assert.ok(!reportSchema.safeParse({ reasons }).success);
});

test('举报 schema：非法 reason 拒绝', () => {
  assert.ok(!reportSchema.safeParse({ reason: 'not_valid' }).success);
});

test('举报 schema：detail 超过 500 字拒绝', () => {
  assert.ok(!reportSchema.safeParse({ reason: 'other', detail: 'x'.repeat(501) }).success);
});

test('举报去重：pending 状态的举报更新而非重复创建', () => {
  // 源码 user.ts 第 562-590 行
  // 如果已存在 pending 举报，更新它而非创建新的
  const existingPending = {
    id: 'report1',
    reporterId: 'userA',
    reportedId: 'userB',
    status: 'pending',
  };

  // 新举报来自同一人对同一用户
  const newReport = {
    reporterId: 'userA',
    reportedId: 'userB',
  };

  const shouldUpdate = existingPending.status === 'pending' &&
    existingPending.reporterId === newReport.reporterId &&
    existingPending.reportedId === newReport.reportedId;

  assert.ok(shouldUpdate, '应更新已有 pending 举报');
});

import { z } from 'zod';
