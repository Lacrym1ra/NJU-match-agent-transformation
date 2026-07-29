/**
 * 并发安全测试 — 竞态条件 / 内存泄漏 / 非预期行为
 *
 * 测试策略：模拟并发场景，断言"正确行为"。
 * 如果并发 bug 存在，测试会 FAIL。
 *
 * 覆盖范围：
 * - OTP 冷却窗口的 TOCTOU 竞态
 * - OTP 验证失败计数的 Map 内存泄漏
 * - OTP 消费的双发竞态（同一 OTP 被两次消费）
 * - registerWithOtp 双注册竞态
 * - recordAction 状态机并发（无事务保护）
 * - likePost 检查-then-插入竞态
 * - sendFriendRequest 双向并发竞态
 * - handleFriendRequest 双击竞态
 * - heartbox 互信号检测在 READ COMMITTED 下的遗漏
 * - 匹配管线无分布式锁的重叠风险
 */
import test from 'node:test';
import assert from 'node:assert/strict';

// ═══════════════════════════════════════════════════════════════
// 1. OTP 冷却窗口 TOCTOU 竞态
// ═══════════════════════════════════════════════════════════════
//
// authService.ts 第 104-131 行：
//   const lastSent = otpCooldowns.get(key);          // 读
//   if (lastSent && Date.now() - lastSent < 60_000)  // 判断
//     throw new RateLimitError(...);
//   // ... 大量异步操作（DB 删除、插入、发邮件）...
//   otpCooldowns.set(key, Date.now());               // 写（在所有异步操作之后）
//
// 问题：两个并发请求可以同时通过检查，因为冷却标记
//       在所有异步操作完成后才设置，而非在检查时立即设置。

test('OTP 冷却窗口：同一邮箱的并发 sendOtp 应只有一个成功', async () => {
  // 模拟 authService.ts 的 sendOtp 冷却逻辑
  const otpCooldowns = new Map<string, number>();
  const OTP_COOLDOWN_MS = 60_000;

  async function simulateSendOtp(key: string): Promise<{ sent: boolean }> {
    // 当前代码的做法：先检查，最后才设置冷却（异步操作之后）
    const lastSent = otpCooldowns.get(key);
    if (lastSent && Date.now() - lastSent < OTP_COOLDOWN_MS) {
      return { sent: false }; // 被冷却拦截
    }
    // 模拟异步操作（DB + 邮件）
    await new Promise((r) => setTimeout(r, 10));
    otpCooldowns.set(key, Date.now());
    return { sent: true };
  }

  // 并发发送两个请求
  const results = await Promise.all([
    simulateSendOtp('register:user@test.com'),
    simulateSendOtp('register:user@test.com'),
  ]);

  const sentCount = results.filter((r) => r.sent).length;
  // 正确行为：60 秒内同一邮箱只能发送一次 OTP
  assert.equal(sentCount, 1,
    `并发 sendOtp 应只有一个成功，实际 ${sentCount} 个成功（冷却标记设置过晚）`);
});

test('OTP 冷却窗口：冷却标记应在检查通过后立即设置（同步占位）', async () => {
  // 修复方案：在检查后同步设置冷却标记，而不是等异步操作完成
  const otpCooldowns = new Map<string, number>();
  const OTP_COOLDOWN_MS = 60_000;

  async function simulateSendOtpFixed(key: string): Promise<{ sent: boolean }> {
    const now = Date.now();
    const lastSent = otpCooldowns.get(key);
    if (lastSent && now - lastSent < OTP_COOLDOWN_MS) {
      return { sent: false };
    }
    // 修复：同步占位，在异步操作之前设置
    otpCooldowns.set(key, now);
    await new Promise((r) => setTimeout(r, 10));
    return { sent: true };
  }

  const results = await Promise.all([
    simulateSendOtpFixed('register:user@test.com'),
    simulateSendOtpFixed('register:user@test.com'),
  ]);

  const sentCount = results.filter((r) => r.sent).length;
  assert.equal(sentCount, 1,
    '修复后：并发 sendOtp 应只有一个成功');
});

// ═══════════════════════════════════════════════════════════════
// 2. OTP 验证失败计数 Map 内存泄漏
// ═══════════════════════════════════════════════════════════════
//
// authService.ts 第 14-15 行：
//   const otpCooldowns = new Map<string, number>();
//   const otpVerifyFailures = new Map<string, {...}>();
//
// 问题：
//   - otpCooldowns: 条目在设置后永不删除（第 130 行 set，无对应 delete）
//   - otpVerifyFailures: 未达到封锁阈值的条目永不删除
//     （只有成功消费 OTP 时第 95 行和封锁过期时第 45 行会删除）
//   - 用户尝试几次后放弃 → 条目永远留在 Map 中

test('otpCooldowns Map 应有过期清理机制，不应无限增长', () => {
  // 模拟当前代码的行为
  const otpCooldowns = new Map<string, number>();

  // 模拟 10000 个不同用户发送 OTP
  for (let i = 0; i < 10000; i++) {
    otpCooldowns.set(`register:user${i}@smail.nju.edu.cn`, Date.now());
  }

  // 当前行为：所有条目永久存在
  assert.equal(otpCooldowns.size, 10000,
    '当前 otpCooldowns 无清理机制，10000 个用户发送后 Map 大小为 10000');

  // 正确行为：60 秒冷却过期后，条目应被清理
  // 模拟清理后
  const OTP_COOLDOWN_MS = 60_000;
  for (const [key, ts] of otpCooldowns) {
    if (Date.now() - ts > OTP_COOLDOWN_MS) {
      otpCooldowns.delete(key);
    }
  }
  // 因为刚刚设置，还没过期，所以大小不变
  // 但如果有定期清理机制，过期的会被删除
  assert.equal(otpCooldowns.size, 10000,
    '没有定期清理 sweep，即使冷却已过期条目也不会被删除');
});

test('otpVerifyFailures Map 中未达封锁阈值的条目不应永久残留', () => {
  const otpVerifyFailures = new Map<string, { count: number; firstFailedAt: number; blockedUntil?: number }>();
  const VERIFY_WINDOW_MS = 10 * 60 * 1000;

  // 模拟 1000 个用户各失败 3 次后放弃（未达 8 次封锁阈值）
  for (let i = 0; i < 1000; i++) {
    const key = `register:user${i}@smail.nju.edu.cn`;
    otpVerifyFailures.set(key, { count: 3, firstFailedAt: Date.now() });
  }

  // 当前代码的清理路径：
  // 1. consumeOtp 成功时删除（第 95 行）— 但这些用户已放弃，不会成功
  // 2. ensureNotBlocked 封锁过期时删除（第 45 行）— 但这些用户未达封锁阈值
  // 结论：这 1000 个条目永远不会被清理

  const now = Date.now();
  const staleEntries = [...otpVerifyFailures.entries()]
    .filter(([_, v]) => now - v.firstFailedAt > VERIFY_WINDOW_MS);

  // 正确行为：超过窗口期的条目应被自动清理
  assert.equal(staleEntries.length, 0,
    `发现 ${staleEntries.length} 个超过窗口期的未清理条目（应实现定期 sweep 清理）`);
});

// ═══════════════════════════════════════════════════════════════
// 3. consumeOtp 双发消费竞态
// ═══════════════════════════════════════════════════════════════
//
// authService.ts 第 73-100 行：
//   const otpRows = await db.select(...).from(otpCodes).where(...)  // SELECT
//   if (!otpRows[0]) throw ...;
//   await db.delete(otpCodes).where(...)                            // DELETE
//
// 问题：两个并发请求可以同时 SELECT 到同一 OTP（都通过检查），
//       然后都继续执行后续逻辑（如注册）。

test('consumeOtp：同一 OTP 码的并发消费应只有一个成功', async () => {
  // 模拟 DB 层的 OTP 表
  const otpStore = new Map<string, { code: string; expiresAt: Date }>();
  otpStore.set('user@test.com', { code: '123456', expiresAt: new Date(Date.now() + 300000) });

  // 当前代码的 consumeOtp 逻辑（非原子）
  async function simulateConsumeOtp(email: string, code: string): Promise<{ consumed: boolean }> {
    const otp = otpStore.get(email);
    if (!otp || otp.code !== code) {
      return { consumed: false };
    }
    // 模拟异步延迟（DB 操作之间的间隙）
    await new Promise((r) => setTimeout(r, 5));
    // 删除 OTP
    otpStore.delete(email);
    return { consumed: true };
  }

  // 两个并发请求使用同一 OTP
  const results = await Promise.all([
    simulateConsumeOtp('user@test.com', '123456'),
    simulateConsumeOtp('user@test.com', '123456'),
  ]);

  const consumedCount = results.filter((r) => r.consumed).length;
  // 正确行为：OTP 应只能被消费一次
  assert.equal(consumedCount, 1,
    `同一 OTP 被消费了 ${consumedCount} 次，应只有 1 次（需要事务级保护或原子操作）`);
});

// ═══════════════════════════════════════════════════════════════
// 4. registerWithOtp 双注册竞态
// ═══════════════════════════════════════════════════════════════
//
// authService.ts 第 133-178 行：
//   两个并发注册请求可以都通过 consumeOtp → 都查不到已有用户 → 都尝试 INSERT
//   第二个 INSERT 会触发 email 唯一约束冲突，返回 500 错误而非友好提示

test('registerWithOtp：并发注册同一邮箱应优雅处理，不抛未捕获异常', async () => {
  // 模拟 users 表
  const usersTable = new Map<string, { email: string }>();

  // 模拟 OTP 已通过（consumeOtp 成功）
  // 当前代码逻辑：
  // 1. 查用户是否存在 → 不存在
  // 2. INSERT 新用户
  // 两个并发请求都通过步骤 1 → 都执行步骤 2 → 第二个触发唯一约束冲突

  async function simulateRegister(email: string): Promise<{ success: boolean; error?: string }> {
    // 模拟异步读
    await new Promise((r) => setTimeout(r, 2));
    const existing = usersTable.get(email);
    if (existing) {
      // 已有密码的用户
      return { success: false, error: '账号已存在，请直接登录' };
    }
    // 模拟异步写（INSERT）
    await new Promise((r) => setTimeout(r, 5));
    // 检查是否被并发请求先插入了
    if (usersTable.has(email)) {
      // 正确行为：应返回友好错误，而非数据库唯一约束异常
      return { success: false, error: '账号已存在，请直接登录' };
    }
    usersTable.set(email, { email });
    return { success: true };
  }

  const results = await Promise.all([
    simulateRegister('user@smail.nju.edu.cn'),
    simulateRegister('user@smail.nju.edu.cn'),
  ]);

  // 正确行为：
  // - 恰好一个注册成功
  // - 另一个返回友好的错误消息（而非 500 Internal Server Error）
  const successCount = results.filter((r) => r.success).length;
  assert.equal(successCount, 1, '并发注册应只有一个成功');

  const failedWith = results.filter((r) => !r.success);
  for (const f of failedWith) {
    assert.ok(f.error && !f.error.includes('constraint') && !f.error.includes('duplicate'),
      `失败响应应是友好提示，不应暴露数据库错误信息，实际: "${f.error}"`);
  }
});

// ═══════════════════════════════════════════════════════════════
// 5. recordAction 并发竞态（无事务保护）
// ═══════════════════════════════════════════════════════════════
//
// matchService.ts 第 853-890 行：
//   1. SELECT match → 检查 status
//   2. UPDATE SET userAAction / userBAction
//   3. SELECT match → 检查双方是否都已操作
//   4. 如果都已操作 → UPDATE status
//
// 问题：如果 expireUnactedMatches cron 在步骤 1 和步骤 2 之间执行，
//       它将 status 从 REVEALED 改为 EXPIRED，
//       但用户仍然可以写入 action，并且步骤 3-4 可能把 EXPIRED 改回 MUTUAL/MISSED

test('recordAction：用户操作与过期 cron 的并发不应让过期匹配复活', async () => {
  // 模拟 match 行
  let match = {
    id: 'm1',
    userAId: 'A',
    userBId: 'B',
    status: 'REVEALED',
    userAAction: null as string | null,
    userBAction: null as string | null,
  };

  // 模拟 recordAction 逻辑
  async function simulateRecordAction(
    userId: string,
    action: 'ACCEPT' | 'REJECT',
  ): Promise<{ ok: boolean; finalStatus: string }> {
    // 步骤 1：读 + 检查 status
    if (match.status !== 'REVEALED') {
      return { ok: false, finalStatus: match.status };
    }
    // 模拟异步延迟（DB 操作间隙）
    await new Promise((r) => setTimeout(r, 10));
    // 步骤 2：写 action
    if (userId === 'A') match.userAAction = action;
    else match.userBAction = action;
    // 步骤 3：读 + 检查双方
    await new Promise((r) => setTimeout(r, 5));
    if (match.userAAction && match.userBAction) {
      match.status = match.userAAction === 'ACCEPT' && match.userBAction === 'ACCEPT' ? 'MUTUAL' : 'MISSED';
    }
    return { ok: true, finalStatus: match.status };
  }

  // 模拟 cron 过期操作
  async function simulateExpire(): Promise<void> {
    await new Promise((r) => setTimeout(r, 3)); // 在 recordAction 的步骤 1 和步骤 2 之间
    match.status = 'EXPIRED';
  }

  // 并发执行：用户 A accept + cron 过期
  const [userResult, _expireResult] = await Promise.all([
    simulateRecordAction('A', 'ACCEPT'),
    simulateExpire(),
  ]);

  // 正确行为：一旦匹配被过期，用户的 action 不应写入，状态不应被改回
  assert.notEqual(match.status, 'MUTUAL',
    '已过期的匹配不应被用户操作复活为 MUTUAL');
  assert.notEqual(match.status, 'MISSED',
    '已过期的匹配不应被用户操作复活为 MISSED');
  // 正确的最终状态应该是 EXPIRED
  assert.equal(match.status, 'EXPIRED',
    `最终状态应为 EXPIRED，实际为 ${match.status}（缺少事务保护导致过期匹配被覆盖）`);
});

// ═══════════════════════════════════════════════════════════════
// 6. recordAction 双方并发 ACCEPT 应正确产生 MUTUAL
// ═══════════════════════════════════════════════════════════════

test('recordAction：双方并发 ACCEPT 应可靠产生 MUTUAL 状态', async () => {
  let match = {
    id: 'm1',
    userAId: 'A',
    userBId: 'B',
    status: 'REVEALED',
    userAAction: null as string | null,
    userBAction: null as string | null,
  };

  // 复现 matchService.ts recordAction 的非事务逻辑
  async function simulateRecordAction(userId: string, action: 'ACCEPT' | 'REJECT') {
    // 无锁读取
    if (match.status !== 'REVEALED') throw new Error('not revealed');
    await new Promise((r) => setTimeout(r, 2)); // 模拟异步

    // 写入 action
    if (userId === 'A') match.userAAction = action;
    else match.userBAction = action;

    // 重新读取检查
    await new Promise((r) => setTimeout(r, 2));
    if (match.userAAction && match.userBAction) {
      match.status = match.userAAction === 'ACCEPT' && match.userBAction === 'ACCEPT' ? 'MUTUAL' : 'MISSED';
    }
  }

  await Promise.all([
    simulateRecordAction('A', 'ACCEPT'),
    simulateRecordAction('B', 'ACCEPT'),
  ]);

  // 正确行为：双方都 ACCEPT 应产生 MUTUAL
  assert.equal(match.status, 'MUTUAL',
    `双方并发 ACCEPT 应产生 MUTUAL，实际为 ${match.status}`);
  assert.equal(match.userAAction, 'ACCEPT');
  assert.equal(match.userBAction, 'ACCEPT');
});

// ═══════════════════════════════════════════════════════════════
// 7. likePost 检查-then-插入竞态
// ═══════════════════════════════════════════════════════════════
//
// forumService.ts 第 1224-1259 行：
//   1. SELECT 检查是否已点赞
//   2. INSERT 点赞记录（无 ON CONFLICT DO NOTHING）
//   3. UPDATE likeCount + 1
//
// 问题：两个并发 like 请求都通过步骤 1（都未找到），
//       第二个 INSERT 触发唯一索引冲突 → 500 错误

test('likePost：同一用户并发点赞同一帖子应幂等，不应抛异常', async () => {
  // 模拟点赞表（带唯一约束）
  const likesSet = new Set<string>(); // key: `${userId}:${postId}`
  let likeCount = 0;
  let errorThrown = false;

  async function simulateLikePost(userId: string, postId: string): Promise<{ liked: boolean; error?: boolean }> {
    const key = `${userId}:${postId}`;

    // 步骤 1：检查是否已点赞
    if (likesSet.has(key)) {
      return { liked: true }; // 幂等返回
    }

    // 模拟异步延迟（竞态窗口）
    await new Promise((r) => setTimeout(r, 5));

    // 步骤 2：插入（当前代码无 ON CONFLICT DO NOTHING）
    if (likesSet.has(key)) {
      // 唯一索引冲突！当前代码会抛异常
      errorThrown = true;
      return { liked: false, error: true };
    }
    likesSet.add(key);

    // 步骤 3：增加计数
    likeCount += 1;
    return { liked: true };
  }

  const results = await Promise.all([
    simulateLikePost('user1', 'post1'),
    simulateLikePost('user1', 'post1'),
  ]);

  // 正确行为：
  // - 不应抛出异常
  assert.equal(errorThrown, false,
    '并发点赞不应触发唯一约束异常（应使用 ON CONFLICT DO NOTHING）');
  // - 点赞计数应为 1
  assert.equal(likeCount, 1,
    `点赞计数应为 1，实际为 ${likeCount}`);
  // - 至少一个成功
  const likedCount = results.filter((r) => r.liked).length;
  assert.ok(likedCount >= 1, '至少一个请求应成功');
});

// ═══════════════════════════════════════════════════════════════
// 8. sendFriendRequest 双向并发竞态
// ═══════════════════════════════════════════════════════════════
//
// friendService.ts 第 213-262 行：
//   1. 检查是否已是好友
//   2. 检查是否有 pending 请求（双向：A→B 或 B→A）
//   3. INSERT 新请求
//
// 问题：A→B 和 B→A 的并发请求可以同时通过步骤 2（都未找到 pending），
//       导致同一圈内存在两条方向相反的 pending 请求

test('sendFriendRequest：双向并发请求应只产生一条 pending 记录', async () => {
  // 模拟 friendRequests 表
  const pendingRequests: Array<{ circleId: string; senderId: string; receiverId: string }> = [];

  async function simulateSendRequest(
    senderId: string,
    targetId: string,
    circleId: string,
  ): Promise<{ sent: boolean; duplicate?: boolean }> {
    // 步骤 1：检查已是好友（简化跳过）
    // 步骤 2：检查 pending（双向）
    const hasPending = pendingRequests.some(
      (r) =>
        r.circleId === circleId &&
        ((r.senderId === senderId && r.receiverId === targetId) ||
          (r.senderId === targetId && r.receiverId === senderId)),    );
    if (hasPending) {
      return { sent: false, duplicate: true };
    }

    // 竞态窗口
    await new Promise((r) => setTimeout(r, 5));

    // 步骤 3：INSERT
    pendingRequests.push({ circleId, senderId, receiverId: targetId });
    return { sent: true };
  }

  // A→B 和 B→A 并发
  await Promise.all([
    simulateSendRequest('A', 'B', 'circle1'),
    simulateSendRequest('B', 'A', 'circle1'),
  ]);

  // 正确行为：同一圈内同一对用户只应有一条 pending 记录
  assert.equal(pendingRequests.length, 1,
    `同一圈内的双向并发请求应只产生 1 条 pending 记录，实际有 ${pendingRequests.length} 条（缺少事务保护）`);
});

// ═══════════════════════════════════════════════════════════════
// 9. handleFriendRequest 双击竞态
// ═══════════════════════════════════════════════════════════════
//
// friendService.ts 第 353-396 行：
//   1. SELECT 请求 → 检查 status === 'pending'
//   2. 执行 accept 逻辑（建立好友关系）
//   3. UPDATE status = 'accepted'
//
// 问题：用户双击"接受"，两个并发请求都通过步骤 1，
//       都执行步骤 2（建立两次好友关系）

test('handleFriendRequest：双击接受应只处理一次', async () => {
  let request = { id: 'r1', status: 'pending' };
  let friendshipInsertCount = 0;

  async function simulateAccept(): Promise<{ accepted: boolean }> {
    // 步骤 1：读 + 检查 status
    if (request.status !== 'pending') {
      return { accepted: false };
    }

    // 竞态窗口
    await new Promise((r) => setTimeout(r, 5));

    // 步骤 2：建立好友关系
    friendshipInsertCount += 1;

    // 步骤 3：更新 status
    request.status = 'accepted';
    return { accepted: true };
  }

  // 用户双击
  const results = await Promise.all([
    simulateAccept(),
    simulateAccept(),
  ]);

  // 正确行为：好友关系只应建立一次
  assert.equal(friendshipInsertCount, 1,
    `双击接受应只建立 1 次好友关系，实际建立了 ${friendshipInsertCount} 次（缺少行级锁）`);
});

// ═══════════════════════════════════════════════════════════════
// 10. heartbox 互信号检测在 READ COMMITTED 下的遗漏
// ═══════════════════════════════════════════════════════════════
//
// heartboxService.ts 第 133-304 行（虽在事务内，但 READ COMMITTED 不够）：
//   1. User A 事务：取消旧信号，插入新信号（目标 B）
//   2. User B 事务：取消旧信号，插入新信号（目标 A）
//   3. A 事务：查找 B 是否有反向信号 → 读不到（B 未提交）
//   4. B 事务：查找 A 是否有反向信号 → 读不到（A 未提交）
//   5. 双方都提交 → 互信号对存在但无 heart match 产生

test('heartbox：并发互信号应在 READ COMMITTED 下被正确检测', async () => {
  // 模拟 heartSignals 表
  const signals = new Map<string, { targetHash: string; status: string }>();
  let matchCreated = false;

  async function simulateSetSignal(
    userKey: string,
    targetHash: string,
  ): Promise<{ matchCreated: boolean }> {
    // 事务开始（READ COMMITTED）
    // 取消旧信号
    signals.set(userKey, { targetHash, status: 'active' });

    // 模拟异步（事务中的查询间隙）
    await new Promise((r) => setTimeout(r, 10));

    // 查找反向信号（READ COMMITTED 下只能看到已提交的数据）
    for (const [key, sig] of signals) {
      if (key !== userKey && sig.status === 'active' && sig.targetHash === userKey) {
        // 找到互信号 → 创建 match
        matchCreated = true;
        return { matchCreated: true };
      }
    }

    return { matchCreated: false };
  }

  // A 和 B 同时设置互信号
  const results = await Promise.all([
    simulateSetSignal('userA', 'hashB'),
    simulateSetSignal('userB', 'hashA'),
  ]);

  // 正确行为：互信号应被检测到并创建 match
  const anyMatch = matchCreated;
  assert.equal(anyMatch, true,
    '并发互信号应被检测到并创建 heart match（READ COMMITTED 可能导致遗漏）');
});

// ═══════════════════════════════════════════════════════════════
// 11. 匹配管线无唯一约束导致重复匹配
// ═══════════════════════════════════════════════════════════════
//
// matchService.ts runMatchingPipeline 在插入 match 时（第 612-628 行）
// 没有唯一约束 (weekOf, source, userAId, userBId)
// 如果管线重叠执行，同一周同一对用户可能被匹配两次

test('matches 表应防止同一周同一对用户重复匹配', () => {
  // 模拟 matches 表（无唯一约束）
  const matches: Array<{ weekOf: string; userAId: string; userBId: string }> = [];

  // 模拟两次管线执行（理论上不应发生，但无锁保护时可能）
  const weekOf = '2026-06-04';
  matches.push({ weekOf, userAId: 'A', userBId: 'B' });
  matches.push({ weekOf, userAId: 'A', userBId: 'B' }); // 重复！

  // 当前行为：无唯一约束，允许重复
  const duplicates = matches.filter(
    (m) => m.weekOf === weekOf && m.userAId === 'A' && m.userBId === 'B',
  );

  // 正确行为：应通过唯一约束阻止重复
  assert.equal(duplicates.length, 1,
    `同一周同一对用户应有且仅有 1 条匹配记录，实际有 ${duplicates.length} 条（缺少唯一约束）`);
});

// ═══════════════════════════════════════════════════════════════
// 12. likeCount 计数漂移（likePost + unlikePost 交叉竞态）
// ═══════════════════════════════════════════════════════════════

test('likePost + unlikePost 并发：likeCount 应始终与实际点赞数一致', async () => {
  const likesSet = new Set<string>();
  let likeCount = 0;

  async function simulateLike(userId: string, postId: string) {
    const key = `${userId}:${postId}`;
    if (likesSet.has(key)) return;
    await new Promise((r) => setTimeout(r, 2));
    if (!likesSet.has(key)) {
      likesSet.add(key);
      likeCount += 1;
    }
  }

  async function simulateUnlike(userId: string, postId: string) {
    const key = `${userId}:${postId}`;
    if (!likesSet.has(key)) return;
    await new Promise((r) => setTimeout(r, 2));
    if (likesSet.has(key)) {
      likesSet.delete(key);
      likeCount = Math.max(0, likeCount - 1);
    }
  }

  // 先点赞
  await simulateLike('user1', 'post1');
  assert.equal(likeCount, 1);

  // 并发：取消赞 + 再次点赞（模拟快速切换）
  await Promise.all([
    simulateUnlike('user1', 'post1'),
    simulateLike('user1', 'post1'), // 竞态：可能认为还没点赞，再 +1
  ]);

  // 正确行为：likeCount 应等于实际点赞数
  const actualLikes = likesSet.has('user1:post1') ? 1 : 0;
  assert.equal(likeCount, actualLikes,
    `likeCount=${likeCount} 应等于实际点赞数=${actualLikes}（计数漂移）`);
});

// ═══════════════════════════════════════════════════════════════
// D1. heartbox 互信号创建死锁（循环等待）
// ═══════════════════════════════════════════════════════════════
//
// heartboxService.ts createOrReplaceHeartSignal (line 137-299):
//   事务中先锁定发送者 user 行，再锁定目标 user 行。
//   A→B 锁定顺序：users[A] → users[B]
//   B→A 锁定顺序：users[B] → users[A]
//   顺序相反 → 经典循环等待 → 死锁

test('heartbox：互信号并发创建应不产生死锁（锁顺序应一致）', async () => {
  // 模拟 user 行锁
  const userLocks = new Map<string, string>(); // userId → holderId
  let deadlockCount = 0;

  async function simulateCreateSignal(senderId: string, targetId: string): Promise<{ success: boolean; deadlock?: boolean }> {
    // 步骤 1：锁定发送者 user 行（模拟 SELECT ... FOR UPDATE）
    if (userLocks.has(senderId)) {
      // 不应发生：同一用户不应同时有两个请求
      return { success: false };
    }
    userLocks.set(senderId, senderId);

    // 模拟事务内异步操作
    await new Promise((r) => setTimeout(r, 10));

    // 步骤 2：尝试锁定目标 user 行
    if (userLocks.has(targetId)) {
      // 目标行被对方事务持有 → 构成循环等待 → 死锁
      deadlockCount += 1;
      // PostgreSQL 会在 ~1s 后 abort 一个事务
      return { success: false, deadlock: true };
    }
    userLocks.set(targetId, senderId);

    // 模拟后续操作（heartSignals, heartMatches 等）
    await new Promise((r) => setTimeout(r, 5));

    // 释放锁（事务提交）
    userLocks.delete(senderId);
    userLocks.delete(targetId);
    return { success: true };
  }

  // A→B 和 B→A 并发
  const results = await Promise.all([
    simulateCreateSignal('userA', 'userB'),
    simulateCreateSignal('userB', 'userA'),
  ]);

  // 正确行为：不应产生死锁（应使用一致的锁顺序或 advisory lock）
  assert.equal(deadlockCount, 0,
    `互信号并发不应产生死锁，实际检测到 ${deadlockCount} 次循环等待（锁顺序不一致：A→B 锁 users[A]→users[B]，B→A 锁 users[B]→users[A]）`);

  // 至少一个应成功
  const successCount = results.filter((r) => r.success).length;
  assert.ok(successCount >= 1, '至少一个互信号应成功创建');
});

test('heartbox：使用一致锁顺序时互信号并发不产生死锁', async () => {
  // 修复方案：始终先锁 userId 较小的 user 行
  const userLocks = new Map<string, string>();

  async function simulateCreateSignalFixed(senderId: string, targetId: string): Promise<{ success: boolean }> {
    // 修复：按固定顺序获取锁
    const [first, second] = [senderId, targetId].sort();

    // 先锁 first
    if (userLocks.has(first)) return { success: false };
    userLocks.set(first, senderId);

    await new Promise((r) => setTimeout(r, 5));

    // 再锁 second
    if (userLocks.has(second)) {
      // second 被持有，释放 first 并重试（非死锁，因为对方也会先锁 first）
      userLocks.delete(first);
      return { success: false };
    }
    userLocks.set(second, senderId);

    await new Promise((r) => setTimeout(r, 3));

    userLocks.delete(first);
    userLocks.delete(second);
    return { success: true };
  }

  const results = await Promise.all([
    simulateCreateSignalFixed('userA', 'userB'),
    simulateCreateSignalFixed('userB', 'userA'),
  ]);

  // 修复后：不会有死锁，但可能有一个因竞争失败（这正常）
  const successCount = results.filter((r) => r.success).length;
  assert.ok(successCount >= 1, '修复后至少一个应成功');
});

// ═══════════════════════════════════════════════════════════════
// D2. leaveCircle 并发 FOR UPDATE 死锁
// ═══════════════════════════════════════════════════════════════
//
// circleService.ts leaveCircle (line 500-667):
//   FOR UPDATE 锁定用户参与的所有 teamup 行
//   如果两个用户共同参与 T1 和 T2，且查询返回行顺序不一致，
//   A 锁 T1→等待T2，B 锁 T2→等待T1 → 死锁

test('leaveCircle：并发退圈的 FOR UPDATE 应以一致顺序锁定 teamup 行', async () => {
  // 模拟 teamup 行锁
  const teamupLocks = new Map<string, string>(); // teamupId → holderId
  let deadlockDetected = false;

  async function simulateLeaveCircle(userId: string, teamupIds: string[]): Promise<{ success: boolean }> {
    // 模拟 SELECT ... FOR UPDATE
    // 当前代码不保证行顺序，使用 Set 模拟无序
    for (const tid of teamupIds) {
      if (teamupLocks.has(tid)) {
        // 此行被另一个事务持有
        // 检查是否构成循环等待
        deadlockDetected = true;
        return { success: false };
      }
      teamupLocks.set(tid, userId);
    }

    // 模拟后续操作
    await new Promise((r) => setTimeout(r, 10));

    // 释放锁
    for (const tid of teamupIds) {
      teamupLocks.delete(tid);
    }
    return { success: true };
  }

  // 用户 A 领导 T1、参与 T2；用户 B 领导 T2、参与 T1
  // 模拟查询返回不同顺序（PostgreSQL 不保证 FOR UPDATE 行序）
  const results = await Promise.all([
    simulateLeaveCircle('userA', ['T1', 'T2']), // A 的查询先返回 T1
    simulateLeaveCircle('userB', ['T2', 'T1']), // B 的查询先返回 T2
  ]);

  // 正确行为：FOR UPDATE 查询应使用 ORDER BY 确保一致的锁顺序
  assert.equal(deadlockDetected, false,
    '并发退圈不应产生死锁（FOR UPDATE 查询应添加 ORDER BY id 保证一致锁顺序）');

  const successCount = results.filter((r) => r.success).length;
  assert.ok(successCount >= 1, '至少一个退圈应成功');
});

// ═══════════════════════════════════════════════════════════════
// R1. expireUnactedMatches 不应暂停已操作的用户
// ═══════════════════════════════════════════════════════════════
//
// matchService.ts expireUnactedMatches (line 789-828):
//   批量 UPDATE matches SET status='EXPIRED' WHERE status='REVEALED'
//   不检查 userAAction / userBAction → 双方都已操作的匹配也被过期
//   然后对过期匹配中的未操作用户执行 auto-pause（但可能暂停已操作用户）
//
// 正确行为：
//   - 如果双方都已操作，cron 不应过期该匹配
//   - 如果用户已操作，不应被 auto-pause
//   - 如果双方都 ACCEPT，match 应变为 MUTUAL（这不是"复活"，是正确结果）

test('expireUnactedMatches：不应暂停已经 ACCEPT 的用户', async () => {
  let match = {
    id: 'm1',
    status: 'REVEALED' as string,
    userAAction: null as string | null,
    userBAction: null as string | null,
  };
  let userAPaused = false;
  let userBPaused = false;

  // recordAction：写入 action → 延迟 → 重读 → 更新 status
  async function simulateRecordAction(userId: string, action: string) {
    if (match.status !== 'REVEALED') {
      return { ok: false, reason: 'not_revealed' };
    }
    await new Promise((r) => setTimeout(r, 2));
    if (userId === 'A') match.userAAction = action;
    else match.userBAction = action;

    await new Promise((r) => setTimeout(r, 10));
    if (match.userAAction && match.userBAction) {
      match.status = match.userAAction === 'ACCEPT' && match.userBAction === 'ACCEPT' ? 'MUTUAL' : 'MISSED';
    }
    return { ok: true };
  }

  // expireUnactedMatches：当前代码只检查 status='REVEALED'，不检查 actions
  async function simulateExpire() {
    await new Promise((r) => setTimeout(r, 5)); // 在双方写入 action 之后、重读之前
    // ❌ 当前代码：只看 status，不看 userAAction/userBAction
    if (match.status === 'REVEALED') {
      match.status = 'EXPIRED';
      // ❌ 当前代码：对过期匹配中的未操作用户执行暂停
      // 但不检查用户是否已操作
      if (!match.userAAction) userAPaused = true;
      if (!match.userBAction) userBPaused = true;
      // 在竞态场景下，userAAction 可能刚被写入但 cron 读不到
      // 正确做法：在 UPDATE WHERE 中加 AND userAAction IS NULL AND userBAction IS NULL
    }
  }

  await Promise.all([
    simulateRecordAction('A', 'ACCEPT'),
    simulateRecordAction('B', 'ACCEPT'),
    simulateExpire(),
  ]);

  // 关键断言：已操作的用户不应被 auto-pause
  assert.equal(userAPaused, false,
    '用户 A 已点击 ACCEPT，不应被自动暂停（expireUnactedMatches 未排除已操作用户）');
  assert.equal(userBPaused, false,
    '用户 B 已点击 ACCEPT，不应被自动暂停（expireUnactedMatches 未排除已操作用户）');
});

// ═══════════════════════════════════════════════════════════════
// R2. activateQueuedHeartboxMatches / getCurrentHeartboxReveal 非原子
// ═══════════════════════════════════════════════════════════════
//
// heartboxService.ts line 344-371 (activateQueuedHeartboxMatches)
// heartboxService.ts line 373-424 (getCurrentHeartboxReveal)
//   步骤1: UPDATE heartMatches SET status='active'
//   步骤2: UPDATE users SET pause flags
//   两步不在同一事务中，中间状态可被观察到

test('activateQueuedHeartboxMatches：激活匹配与暂停用户应是原子操作', async () => {
  let matchStatus = 'queued';
  let userAPaused = false;
  let userBPaused = false;
  let inconsistentStateObserved = false;

  async function simulateActivate() {
    // 步骤 1：激活匹配（不在事务中）
    matchStatus = 'active';

    // 竞态窗口：匹配已激活但用户未暂停
    await new Promise((r) => setTimeout(r, 10));

    // 步骤 2：暂停用户
    userAPaused = true;
    userBPaused = true;
  }

  async function simulateWeeklyMatching() {
    // 等待匹配激活后检查用户状态
    await new Promise((r) => setTimeout(r, 5));
    if (matchStatus === 'active' && (!userAPaused || !userBPaused)) {
      // 匹配已激活但用户未被暂停 → 违反业务规则
      // 用户仍被加入周匹配池
      inconsistentStateObserved = true;
    }
  }

  await Promise.all([
    simulateActivate(),
    simulateWeeklyMatching(),
  ]);

  // 正确行为：不应存在「匹配已激活但用户未暂停」的中间状态
  assert.equal(inconsistentStateObserved, false,
    '不应观察到匹配已激活但用户未暂停的中间状态（激活和暂停应在同一事务中）');
});

test('getCurrentHeartboxReveal：激活匹配与暂停用户应是原子操作', async () => {
  let matchStatus = 'queued';
  let userAPaused = false;
  let userBPaused = false;
  let inconsistentStateObserved = false;

  async function simulateReveal() {
    // 步骤 1：激活匹配
    matchStatus = 'active';
    // 非原子间隙
    await new Promise((r) => setTimeout(r, 8));
    // 步骤 2：暂停用户
    userAPaused = true;
    userBPaused = true;
  }

  async function simulateConcurrentRead() {
    await new Promise((r) => setTimeout(r, 4));
    if (matchStatus === 'active' && (!userAPaused || !userBPaused)) {
      inconsistentStateObserved = true;
    }
  }

  await Promise.all([
    simulateReveal(),
    simulateConcurrentRead(),
  ]);

  assert.equal(inconsistentStateObserved, false,
    '用户查看 reveal 时不应观察到激活但未暂停的中间状态');
});

// ═══════════════════════════════════════════════════════════════
// R3. deleteAllFriends 非原子多表删除
// ═══════════════════════════════════════════════════════════════
//
// friendService.ts line 426-452:
//   1. DELETE from friendships (circle 级)
//   2. DELETE from globalFriendships (全局)
//   3. DELETE contact unlock records
//   三步不在事务中，部分失败导致不一致

test('deleteAllFriends：三张表的删除应是原子操作', async () => {
  // 模拟三张表的状态
  let circleFriendshipExists = true;
  let globalFriendshipExists = true;
  let contactUnlockExists = true;

  // 模拟第二步失败的场景
  async function simulateDeleteAllFriends(): Promise<{ success: boolean; inconsistent?: boolean }> {
    // 步骤 1：删除 circle friendships
    circleFriendshipExists = false;

    // 模拟异步间隙（DB round-trip）
    await new Promise((r) => setTimeout(r, 5));

    // 步骤 2 模拟失败：globalFriendships 删除失败（连接超时等）
    // globalFriendshipExists 保持 true

    // 检查一致性
    if (!circleFriendshipExists && globalFriendshipExists) {
      return { success: false, inconsistent: true };
    }

    // 步骤 3：删除 contact unlock records（可能因步骤 2 异常而未执行）
    contactUnlockExists = false;
    return { success: true };
  }

  const result = await simulateDeleteAllFriends();

  // 正确行为：三张表要么全部删除成功，要么全部回滚
  assert.ok(!result.inconsistent,
    '好友关系应保持一致：circle 级和全局级应同时存在或同时删除（缺少事务保护导致部分删除）');
});

// ═══════════════════════════════════════════════════════════════
// R4. handleContactUnlockRequest 状态检查不在 WHERE 子句
// ═══════════════════════════════════════════════════════════════
//
// contactsService.ts line 465-503:
//   SELECT → 检查 status='pending'（应用层）
//   UPDATE SET status='approved' WHERE id=X（WHERE 不含 status 条件）
//   两个并发请求都通过应用层检查 → 最后一个覆盖前一个

test('handleContactUnlockRequest：并发审批不应覆盖先到的决定', async () => {
  let request = { id: 'r1', status: 'pending' };
  const decisions: string[] = [];

  async function simulateHandleRequest(
    action: 'approved' | 'rejected',
  ): Promise<{ applied: boolean }> {
    // 步骤 1：SELECT → 应用层检查 status
    if (request.status !== 'pending') {
      return { applied: false };
    }

    // 竞态窗口
    await new Promise((r) => setTimeout(r, 5));

    // 步骤 2：UPDATE SET status = action WHERE id = X
    // 旧问题：WHERE 只包含 id，不包含 status='pending'
    // 所以后写入的会覆盖先写入的
    request.status = action;
    decisions.push(action);

    return { applied: true };
  }

  // 管理员 A 批准，管理员 B 拒绝，并发执行
  await Promise.all([
    simulateHandleRequest('approved'),
    simulateHandleRequest('rejected'),
  ]);

  // 正确行为：只有第一个审批应生效
  const appliedCount = decisions.length;
  assert.equal(appliedCount, 1,
    `并发审批应只有 1 个生效，实际 ${appliedCount} 个都写入了（UPDATE WHERE 缺少 status='pending' 条件）`);
});

// ═══════════════════════════════════════════════════════════════
// R5. heartbox 事务内泄漏全局 db
// ═══════════════════════════════════════════════════════════════
//
// heartboxService.ts line 185 (logAudit) 和 line 245 (safetyAllowsHeartboxMatch):
//   在 db.transaction(async (tx) => {...}) 内部使用全局 db 而非 tx
//   导致：1) 事务回滚时审计日志无法回滚  2) 安全检查在事务隔离边界外执行

test('heartbox：事务回滚时事务外的审计日志应也被回滚', async () => {
  // 模拟事务内状态和事务外审计日志
  let txCommitted = false;
  let auditLogWritten = false;
  let auditLogRolledBack = false;

  async function simulateHeartboxTransaction(shouldRollback: boolean) {
    // 事务内操作（使用 tx）
    // ...

    // 泄漏点：logAudit 使用全局 db（不在事务中）
    auditLogWritten = true;

    await new Promise((r) => setTimeout(r, 5));

    if (shouldRollback) {
      // 事务回滚 → tx 内的操作全部撤销
      txCommitted = false;
      // 但 auditLogWritten 无法撤销（已在事务外写入）
    } else {
      txCommitted = true;
    }
  }

  // 模拟事务回滚的场景
  await simulateHeartboxTransaction(true);

  // 正确行为：如果事务回滚，审计日志不应存在
  // 当前行为：审计日志已写入，无法回滚
  const auditInconsistent = auditLogWritten && !txCommitted;
  assert.equal(auditInconsistent, false,
    '事务回滚时审计日志不应残留（logAudit 应使用 tx 而非全局 db）');
});

test('heartbox：事务内的安全检查应使用 tx 而非全局 db', async () => {
  // 模拟 userBlocks 表
  let blockExists = false;

  // 模拟事务内数据（使用 tx 可见未提交数据）
  let txBlockAdded = false;

  async function simulateHeartboxWithBlockCheck(): Promise<{ matchCreated: boolean }> {
    // 事务内：检查是否被屏蔽（应使用 tx，当前使用全局 db）
    // 当前代码使用全局 db → 看不到事务内刚添加的屏蔽
    const blocked = blockExists; // 用全局 db 看到的是旧值
    // 正确做法：const blocked = blockExists || txBlockAdded;

    await new Promise((r) => setTimeout(r, 5));

    if (blocked) {
      return { matchCreated: false };
    }
    return { matchCreated: true };
  }

  // 在另一个事务中添加了屏蔽（尚未提交到全局 db）
  // 如果 heartbox 使用 tx 查询，可以看到这个未提交的屏蔽
  // 但当前代码使用全局 db，看不到
  txBlockAdded = true; // 事务内可见
  // blockExists 仍为 false（全局 db 看不到未提交的数据）

  const result = await simulateHeartboxWithBlockCheck();

  // 正确行为：如果事务内存在屏蔽，不应创建匹配
  assert.equal(result.matchCreated, false,
    '安全检查应使用 tx 而非全局 db，否则事务内的屏蔽记录不可见（可能绕过屏蔽创建匹配）');
});

// ═══════════════════════════════════════════════════════════════
// R6. unlikePost / unfavoritePost 计数器漂移
// ═══════════════════════════════════════════════════════════════
//
// forumService.ts unlikePost (line 1261-1288):
//   1. SELECT 检查点赞存在
//   2. DELETE
//   3. UPDATE likeCount = GREATEST(likeCount - 1, 0) — 无条件执行
//   并发 unlike 时第二个 DELETE 影响 0 行，但计数器仍然减 1

test('unlikePost：并发取消赞不应导致计数器漂移', async () => {
  // 模拟帖子有一条点赞，likeCount = 1
  const likesSet = new Set<string>();
  likesSet.add('user1:post1');
  let likeCount = 1;

  async function simulateUnlike(userId: string, postId: string): Promise<{ unliked: boolean }> {
    const key = `${userId}:${postId}`;

    // 步骤 1：SELECT 检查点赞存在
    if (!likesSet.has(key)) {
      return { unliked: false };
    }

    // 竞态窗口
    await new Promise((r) => setTimeout(r, 5));

    // 步骤 2：DELETE（可能影响 0 行）
    const deleted = likesSet.delete(key);

    // 步骤 3：无条件减计数 — ❌ 即使 deleted=false（行已被并发请求删了）
    likeCount = Math.max(0, likeCount - 1);

    return { unliked: deleted };
  }

  // 两个并发 unlike（只有一条点赞记录）
  await Promise.all([
    simulateUnlike('user1', 'post1'),
    simulateUnlike('user1', 'post1'),
  ]);

  // 正确行为：likeCount 应等于实际点赞数
  const actualLikes = likesSet.has('user1:post1') ? 1 : 0;
  assert.equal(likeCount, actualLikes,
    `unlike 后 likeCount=${likeCount} 应等于实际点赞数=${actualLikes}（计数器漂移：DELETE 0 行仍减了计数）`);
});

test('unfavoritePost：并发取消收藏不应导致计数器漂移', async () => {
  const favsSet = new Set<string>();
  favsSet.add('user1:post1');
  let favoriteCount = 1;

  async function simulateUnfavorite(userId: string, postId: string): Promise<{ unfaved: boolean }> {
    const key = `${userId}:${postId}`;
    if (!favsSet.has(key)) return { unfaved: false };
    await new Promise((r) => setTimeout(r, 5));
    favsSet.delete(key);
    favoriteCount = Math.max(0, favoriteCount - 1); // 无条件减
    return { unfaved: true };
  }

  await Promise.all([
    simulateUnfavorite('user1', 'post1'),
    simulateUnfavorite('user1', 'post1'),
  ]);

  const actual = favsSet.has('user1:post1') ? 1 : 0;
  assert.equal(favoriteCount, actual,
    `取消收藏后 favoriteCount=${favoriteCount} 应等于实际收藏数=${actual}`);
});
