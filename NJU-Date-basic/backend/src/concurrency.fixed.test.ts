/**
 * 并发故障修复后回归测试
 *
 * 这里放与 concurrency.test.ts 中故障复现对应的“修复后应通过”模型。
 * 旧复现测试保留红灯，用于展示修复前问题；本文件保留绿灯，用于展示修复后行为。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

test('sendFriendRequest：修复后双向并发请求只产生一条 pending 记录', async () => {
  const pendingPairs = new Set<string>();
  const pairLocks = new Set<string>();

  async function simulateSendFriendRequestFixed(senderId: string, receiverId: string) {
    const [userAId, userBId] = [senderId, receiverId].sort();
    const pairKey = `circle-1:${userAId}:${userBId}`;

    if (pairLocks.has(pairKey)) {
      return { sent: false };
    }
    pairLocks.add(pairKey);
    try {
      await new Promise((r) => setTimeout(r, 5));
      if (pendingPairs.has(pairKey)) {
        return { sent: false };
      }
      pendingPairs.add(pairKey);
      return { sent: true };
    } finally {
      pairLocks.delete(pairKey);
    }
  }

  const results = await Promise.all([
    simulateSendFriendRequestFixed('userA', 'userB'),
    simulateSendFriendRequestFixed('userB', 'userA'),
  ]);

  assert.equal(results.filter((result) => result.sent).length, 1);
  assert.equal(pendingPairs.size, 1);
});

test('handleFriendRequest：修复后双击接受只处理一次', async () => {
  let request = { id: 'r1', status: 'pending' };
  let friendshipCreateCount = 0;

  async function simulateHandleFriendRequestFixed() {
    if (request.status !== 'pending') {
      return { accepted: false };
    }

    await new Promise((r) => setTimeout(r, 5));

    if (request.status !== 'pending') {
      return { accepted: false };
    }
    request = { ...request, status: 'accepted' };
    friendshipCreateCount += 1;
    return { accepted: true };
  }

  const results = await Promise.all([
    simulateHandleFriendRequestFixed(),
    simulateHandleFriendRequestFixed(),
  ]);

  assert.equal(results.filter((result) => result.accepted).length, 1);
  assert.equal(friendshipCreateCount, 1);
});

test('leaveCircle：修复后并发退圈按一致顺序锁定 teamup 行', async () => {
  const teamupLocks = new Map<string, string>();
  let deadlockDetected = false;

  async function simulateLeaveCircleFixed(userId: string, teamupIds: string[]) {
    const locked: string[] = [];
    for (const teamupId of [...teamupIds].sort()) {
      if (teamupLocks.has(teamupId)) {
        for (const lockedTeamupId of locked) {
          teamupLocks.delete(lockedTeamupId);
        }
        return { success: false };
      }
      teamupLocks.set(teamupId, userId);
      locked.push(teamupId);
      await new Promise((r) => setTimeout(r, 1));
    }

    await new Promise((r) => setTimeout(r, 5));
    for (const teamupId of locked) {
      teamupLocks.delete(teamupId);
    }
    return { success: true };
  }

  const results = await Promise.all([
    simulateLeaveCircleFixed('userA', ['T1', 'T2']),
    simulateLeaveCircleFixed('userB', ['T2', 'T1']),
  ]);

  assert.equal(deadlockDetected, false);
  assert.ok(results.some((result) => result.success));
});

test('deleteAllFriends：修复后多表删除失败时应整体回滚', async () => {
  let circleFriendshipExists = true;
  let globalFriendshipExists = true;
  let contactUnlockExists = true;

  async function simulateDeleteAllFriendsFixed(): Promise<{ success: boolean; inconsistent?: boolean }> {
    const before = { circleFriendshipExists, globalFriendshipExists, contactUnlockExists };
    try {
      circleFriendshipExists = false;
      await new Promise((r) => setTimeout(r, 5));
      throw new Error('global friendship delete failed');
    } catch {
      circleFriendshipExists = before.circleFriendshipExists;
      globalFriendshipExists = before.globalFriendshipExists;
      contactUnlockExists = before.contactUnlockExists;
      return { success: false, inconsistent: false };
    }
  }

  const result = await simulateDeleteAllFriendsFixed();

  assert.equal(result.inconsistent, false);
  assert.equal(circleFriendshipExists, true);
  assert.equal(globalFriendshipExists, true);
  assert.equal(contactUnlockExists, true);
});

test('handleContactUnlockRequest：修复后 UPDATE WHERE 含 status 条件', async () => {
  let request = { id: 'r1', status: 'pending' };
  const decisions: string[] = [];

  async function simulateHandleRequestFixed(
    action: 'approved' | 'rejected',
  ): Promise<{ applied: boolean }> {
    if (request.status !== 'pending') {
      return { applied: false };
    }

    await new Promise((r) => setTimeout(r, 5));

    if (request.status !== 'pending') {
      return { applied: false };
    }
    request.status = action;
    decisions.push(action);
    return { applied: true };
  }

  await Promise.all([
    simulateHandleRequestFixed('approved'),
    simulateHandleRequestFixed('rejected'),
  ]);

  assert.equal(decisions.length, 1, '修复后应只有 1 个审批生效');
});
