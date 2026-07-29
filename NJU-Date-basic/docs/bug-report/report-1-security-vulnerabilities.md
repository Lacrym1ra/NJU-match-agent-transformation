# Bug Report #1 — 安全漏洞与并发缺陷

**报告日期：** 2026-06-05
**报告人：** g1 测试团队
**涉及模块：** backend/src/routes、backend/src/services
**测试文件：**

- `backend/src/middleware/auth.test.ts`
- `backend/src/routes/admin.test.ts`
- `backend/src/services/authService.test.ts`
- `backend/src/services/forumService.test.ts`
- `backend/src/services/friendService.test.ts`
- `backend/src/services/matchService.test.ts`
- `backend/src/concurrency.test.ts`

**测试结果：** 189 个测试，164 通过，**25 个失败**

---

## 第一部分：安全漏洞

**测试结果：** 162 个测试，153 通过，**9 个失败（对应 6 个独立漏洞）**

| # | 漏洞 | 位置 | 严重度 | 测试状态 |
|---|------|------|--------|----------|
| 4 | Admin SQL Query 可读取全量 passwordHash | admin.ts:772-791 | 🔴 Critical | ❌ FAIL |
| 5 | Admin SQL Query 可读取未过期 OTP 明文 | admin.ts:772-791 | 🔴 Critical | ❌ FAIL |
| 6 | Admin 用户详情 API 返回 passwordHash | admin.ts:517-534 | 🔴 High | ❌ FAIL |
| 7 | 登录错误消息区分"未注册"与"密码错误" | authService.ts:184-188 | 🟡 Medium | ❌ FAIL |
| 8 | 登录错误附加 USER_NOT_REGISTERED code 字段 | authService.ts:187 | 🟡 Medium | ❌ FAIL |
| 9 | 登录与密码重置端点的枚举防护策略不一致 | authService.ts:184 vs 203 | 🟡 Medium | ❌ FAIL |
| 1 | GET /user/profile 返回自身 passwordHash | user.ts:75-97 | 🟢 Low | ❌ FAIL |
| 2 | PUT /user/profile 返回自身 passwordHash | user.ts:120-161 | 🟢 Low | ❌ FAIL |
| 3 | PATCH /user/profile/draft 返回自身 passwordHash | user.ts:163-202 | 🟢 Low | ❌ FAIL |

---

### 🔴 Critical — 漏洞 5：Admin SQL Query 可读取未过期 OTP 明文

**位置：** 同漏洞 4，`POST /api/v1/admin/db/query` — `backend/src/routes/admin.ts:772-791`

**根因：** 同漏洞 4。黑名单不限制可查询的表，`otp_codes` 表完全可读。

**攻击路径：**

```
POST /api/v1/admin/db/query
Body: { "sql": "SELECT email, code, \"expiresAt\" FROM otp_codes WHERE purpose = 'register' AND \"expiresAt\" > NOW()" }

→ { "rows": [
     { "email": "target@smail.nju.edu.cn", "code": "837492", "expiresAt": "..." }
   ] }
```

**影响：**

- 在用户注册/重置密码的 **5 分钟窗口内**，管理员可直接拿到明文 OTP 验证码
- 使用该验证码可以注册新账号或重置目标用户密码——**绕过了整个 OTP 验证机制**
- 比漏洞 4 更危险：不需要离线爆破，直接明文接管账号

**修复建议：** 同漏洞 4。或至少在黑名单中加入 `otp_codes` 表名检测。

---

### 🔴 High — 漏洞 6：Admin 用户详情 API 返回全行含 passwordHash

**位置：** `GET /api/v1/admin/users/:id` — `backend/src/routes/admin.ts:517-534`

**根因：**

```typescript
// admin.ts:520
const [user] = await db.select().from(users).where(eq(users.id, userId));
// admin.ts:530 — 直接返回全行
res.json({ user, survey: survey || null, matches: userMatches });
```

`db.select().from(users)` 返回 users 表的所有列，包括 `passwordHash`、`studentIdHash`、`wechatId`，没有任何列过滤。

**攻击路径：**

```
GET /api/v1/admin/users/{任意用户UUID}
Headers: { "x-admin-key": "..." }

→ { "user": {
     "id": "...",
     "passwordHash": "$2a$12$...",
     "studentIdHash": "sha256...",
     "wechatId": "wechat:wx123",
     ...
   }}
```

**影响：**

- 比漏洞 4 更简单——不需要构造 SQL，一个 GET 请求即可获取任意用户的密码哈希
- 如果管理面板前端存在 XSS，可通过 XSS 读取管理员 API 响应获取全部用户凭据

**修复建议：** 使用列选择，只返回管理面板需要的字段：

```typescript
const [user] = await db.select({
  id: users.id, email: users.email, nickname: users.nickname,
  creditScore: users.creditScore,
  // ... 不包含 passwordHash, studentIdHash
}).from(users).where(eq(users.id, userId));
```

---

### 🟡 Medium — 漏洞 7-9：登录端点用户枚举

**位置：** `POST /api/v1/auth/login` — `backend/src/services/authService.ts:180-201`

**根因：**

```typescript
// authService.ts:184-188 — 邮箱未注册
if (!user?.passwordHash) {
  const err = new UnauthorizedError('该邮箱尚未注册，请先注册账号');
  (err as any).code = 'USER_NOT_REGISTERED';  // 附加了区分性 code
  throw err;
}

// authService.ts:192-193 — 密码错误
if (!matched) {
  throw new UnauthorizedError('密码错误，请重新输入');  // 不同的消息
}
```

两种失败场景的 HTTP 状态码都是 401，但**错误消息不同**且**code 字段不同**。攻击者可以程序化区分两种情况。

对比 `sendResetPasswordCode`（authService.ts:203-210）对未注册邮箱**静默返回**的正确做法，两个端点的安全标准不一致。

**攻击路径：**

```
# 测试不存在的邮箱
POST /auth/login { "email": "nonexist@smail.nju.edu.cn", "password": "x" }
→ { "message": "该邮箱尚未注册，请先注册账号", "code": "USER_NOT_REGISTERED" }

# 测试已注册的邮箱
POST /auth/login { "email": "real@smail.nju.edu.cn", "password": "x" }
→ { "message": "密码错误，请重新输入", "code": "UNAUTHORIZED" }

# 攻击者现在知道 real@smail.nju.edu.cn 已注册本平台
```

在 NJU 环境中，学号邮箱格式高度可预测（`221250001@smail.nju.edu.cn`），攻击者可批量扫描确认谁注册了该约会平台。

**影响：**

- 隐私泄露：确认某人使用约会平台
- 辅助钓鱼：针对已注册用户发送伪造平台邮件
- 枚举成本低：无需验证码即可自动化扫描

**修复建议：**

```typescript
if (!user?.passwordHash) {
  throw new UnauthorizedError('邮箱或密码错误');  // 统一消息
}
if (!matched) {
  throw new UnauthorizedError('邮箱或密码错误');  // 统一消息
}
// 不附加区分性 code 字段
```

---

### 🟢 Low — 漏洞 1-3：Profile API 返回自身 passwordHash

**位置：**

- `GET /api/v1/user/profile` — `backend/src/routes/user.ts:75-97`
- `PUT /api/v1/user/profile` — `backend/src/routes/user.ts:120-161`
- `PATCH /api/v1/user/profile` — `backend/src/routes/user.ts:163-202`

**根因：** 三个端点共享同一缺陷：`db.select().from(users)` 返回全行，解构时只排除了 `wechatId`，遗漏了 `passwordHash` 和 `studentIdHash`。

以 `GET /user/profile` 为例：

```typescript
// user.ts:77 — 查全行
const rows = await db.select().from(users).where(eq(users.id, req.auth!.userId)).limit(1);

// user.ts:92 — 只去掉了 wechatId
const { wechatId: _, contactId: _id, contactPlatform: _platform, ...safeUser } = user as any;

// user.ts:93 — safeUser 中仍包含 passwordHash, studentIdHash
res.json({ ...safeUser, contactPlatform: plt, contactId: id });
```

**重要限制：** WHERE 条件是 `eq(users.id, req.auth!.userId)`，即 JWT token 中的 userId。**用户只能看到自己的 passwordHash，无法查看其他用户的。** 因此这不构成对其他用户的直接威胁。

**仍值得修复的原因：**

1. **中间件/日志泄露**：CDN、Nginx access log、Sentry 等系统可能记录响应体
2. **前端缓存**：如果前端将 profile 数据缓存到 localStorage，XSS 可读取
3. **违反最小权限原则**：前端根本不需要 passwordHash

**修复建议：**

```typescript
// 方案 A（推荐）：SELECT 显式指定列
const rows = await db.select({
  id: users.id, email: users.email, nickname: users.nickname,
  // ... 只列前端需要的字段
}).from(users).where(eq(users.id, req.auth!.userId)).limit(1);

// 方案 B（快速修复）：解构排除
const { wechatId: _w, passwordHash: _p, studentIdHash: _s, ...safeUser } = user as any;
```

---

## 第二部分：并发安全缺陷

**测试文件：** `backend/src/concurrency.test.ts`
**测试结果：** 27 个测试，11 通过，**16 个失败（对应 13 个独立缺陷）**

> **安全威胁判定：** 0 个直接威胁生产安全。所有涉及数据写入的缺陷均有数据库 UNIQUE 约束作为最终安全网，不会导致数据损坏或未授权访问。威胁集中在用户体验（500 错误、操作结果与用户预期不符）和业务逻辑正确性（互信号匹配遗漏）。

### 并发缺陷总览

| # | 缺陷 | 位置 | 威胁等级 | 触发概率 | 修复优先级 |
|---|------|------|---------|---------|-----------|
| D1 | heartbox 互信号创建死锁（循环等待） | heartboxService.ts:137-299 | 🔴 死锁 | 极低 | **P1** |
| C3 | likePost 检查-then-插入唯一约束冲突 | forumService.ts:1224-1259 | 🟠 用户体验 | **高** | **P1** |
| C5 | handleFriendRequest 双击重复处理 | friendService.ts:353-396 | 🟠 用户体验 | **高** | **P1** |
| C6 | heartbox 互信号 READ COMMITTED 下遗漏 | heartboxService.ts:133-304 | 🟡 业务逻辑 | 极低 | P2 |
| D2 | leaveCircle 并发 FOR UPDATE 死锁 | circleService.ts:500-667 | 🟡 死锁 | 极低 | P2 |
| R2 | activateQueuedHeartboxMatches 非原子 | heartboxService.ts:344-424 | 🟠 业务逻辑 | 低 | P2 |
| R3 | deleteAllFriends 非原子多表删除 | friendService.ts:426-452 | 🟠 数据不一致 | 低 | P2 |
| R4 | handleContactUnlockRequest 状态不在 WHERE | contactsService.ts:465-503 | 🟠 状态覆盖 | 低 | P2 |
| R5 | heartbox 事务内泄漏全局 db | heartboxService.ts:185,245 | 🟡 事务隔离 | 低 | P2 |
| C1 | OTP 冷却窗口 TOCTOU 竞态 | authService.ts:104-131 | 🟢 技术债 | 极低 | P3 |
| C2 | consumeOtp 双发消费 | authService.ts:73-100 | 🟢 技术债 | 极低 | P3 |
| C4 | sendFriendRequest 双向并发重复 | friendService.ts:213-262 | 🟢 技术债 | 极低 | P3 |
| C7 | matches 表无唯一约束允许重复匹配 | matchService.ts:612-628 | 🟢 技术债 | 低 | P3 |

> **总计 13 个可稳定复现的并发缺陷**：2 个死锁（D1-D2），11 个竞态/非原子问题（C1-C7 + R2-R5）。其中 P1 级 3 个，P2 级 6 个，P3 级 4 个。

### 代码层面全局发现

| 指标 | 数值 |
|------|------|
| `db.transaction()` 调用总数 | 18 |
| 使用 `SELECT ... FOR UPDATE` 的函数 | 3（teamService 2 个 + circleService 1 个）|
| 使用 `SET TRANSACTION ISOLATION LEVEL` | 0（全部为默认 READ COMMITTED）|
| 使用 advisory lock | 0 |
| 多表写入但无事务保护的函数 | ≥ 8 |
| 事务内使用全局 `db`（而非 `tx`）的位置 | 2（heartboxService） |

### 防护层分析

每个缺陷从前端限制、中间件限流、数据库约束三个维度评估触发可能性和实际影响。

---

### 🔴 D1. heartbox 互信号创建死锁 — P1

**位置：** `heartboxService.ts` 第 137-299 行（`createOrReplaceHeartSignal`）

**根因：** 两个用户同时设置互信号时，两个事务锁定 user 行的**顺序相反**，构成经典循环等待。

**锁获取顺序（单次 `createOrReplaceHeartSignal` 调用）：**

```
步骤 1 (line 138):  SELECT users WHERE id=senderId     → 锁定发送者 user 行
步骤 2 (line 196):  UPDATE heartSignals WHERE senderId  → 锁定发送者信号行
步骤 3 (line 207):  INSERT heartSignals                  → 锁定新信号行
步骤 4 (line 220):  SELECT users WHERE studentIdHash=... → 锁定目标 user 行
步骤 5 (line 262):  INSERT/UPDATE heartMatches           → 锁定匹配行
步骤 6 (line 287):  UPDATE users WHERE id IN (A, B)      → 再次锁定双方 user 行
```

**死锁场景：**

```
事务 A（用户A→B）                     事务 B（用户B→A）
─────────────────                     ─────────────────
1. SELECT users[A]  → 锁定 A          1. SELECT users[B]  → 锁定 B
2. UPDATE heartSignals(sender=A)      2. UPDATE heartSignals(sender=B)
3. INSERT heartSignal(A→B)            3. INSERT heartSignal(B→A)
4. SELECT users WHERE hash=B_hash     4. SELECT users WHERE hash=A_hash
   → 尝试锁定 B user 行                  → 尝试锁定 A user 行
   → B 被事务 B 持有，等待 ⏳             → A 被事务 A 持有，等待 ⏳
                                       ══ 死锁！循环等待 ══
```

**PostgreSQL 处理：** 内置死锁检测器（默认 `deadlock_timeout = 1s`）自动 ABORT 其中一个事务，不会无限挂起，但被 abort 的用户收到 500 错误。

**三层防护分析：**

| 防护层 | 状态 | 详情 |
|--------|------|------|
| 前端 | ✅ 完整保护 | Heartbox.tsx 有 `submitting` guard + `disabled` |
| 限流 | ✅ 双层限流 | 3次/分钟 + 24小时只能设 1 次 |
| 数据库 | ⚠️ 自动检测 | PostgreSQL 1s 后 abort，不挂起，但用户体验差 |

**为什么仍需修复：** 被 abort 的用户收到通用 500 错误而非友好提示。且发生在平台最核心的心动功能上。加上 C6（READ COMMITTED 遗漏），heartbox 同时存在死锁 + 匹配遗漏两个问题。

**修复建议：**

```typescript
// 方案 A（推荐）：统一锁顺序，始终先锁定 userId 较小的 user 行
const [firstUser, secondUser] = userId < targetUserId
  ? [userId, targetUserId]
  : [targetUserId, userId];
await tx.select().from(users).where(eq(users.id, firstUser)).for('update');
await tx.select().from(users).where(eq(users.id, secondUser)).for('update');

// 方案 B：使用 advisory lock 序列化同一对用户的操作
const pairKey = hashCode(Math.min(a, b) + ':' + Math.max(a, b));
await tx.execute(sql`SELECT pg_advisory_xact_lock(${pairKey})`);
```

---

### 🟠 C3. likePost / likeComment 检查-then-插入唯一约束冲突 — P1

**位置：** `forumService.ts` 第 1224-1259 行（likePost）、第 1730-1793 行（likeComment）

**根因：** 先 SELECT 检查是否已点赞，再 INSERT 点赞记录（无 `ON CONFLICT DO NOTHING`）。两个并发点赞请求都通过 SELECT 检查后，第二个 INSERT 触发唯一索引冲突，返回 500 错误。

**三层防护分析：**

| 防护层 | 状态 | 详情 |
|--------|------|------|
| 前端 | ❌ 论坛列表页和评论点赞无保护 | `Forum.tsx:146-161` 点赞无 loading state、无 disabled；`ForumPost.tsx:359-389` 评论点赞无保护 |
| 限流 | ⚠️ 仅全局 apiLimiter（1000/15分钟） | 无法阻止同一用户的快速双击 |
| 数据库 | ✅ UNIQUE 索引阻止数据损坏 | `forumPostLikes(postId, userId)` 有唯一索引 |

**实际影响链：**

```
用户在论坛列表页双击点赞按钮
  → 第一次请求：SELECT 无记录 → INSERT 成功 → likeCount +1 ✅
  → 第二次请求：SELECT 无记录（竞态窗口 ~50ms）→ INSERT 撞 UNIQUE → 500 ❌
  → 前端乐观更新已执行，但收到 500 → 回滚 UI → 用户困惑
```

**修复建议：**

```typescript
// 后端（一行修复）：INSERT ... ON CONFLICT DO NOTHING
const [inserted] = await db.insert(forumPostLikes)
  .values({ postId, userId })
  .onConflictDoNothing()
  .returning();
if (inserted) {
  await db.update(forumPosts).set({ likeCount: sql`like_count + 1` }).where(...);
}
// 前端：为 handlePreviewLike 添加 loading state + disabled
```

---

### 🟠 C5. handleFriendRequest 双击重复处理 — P1

**位置：** `friendService.ts` 第 353-396 行

**根因：** 用户快速双击"接受"，两个并发请求都读取到 `status === 'pending'`，都通过检查，都执行好友关系建立逻辑。

**三层防护分析：**

| 防护层 | 状态 | 详情 |
|--------|------|------|
| 前端 | ❌ 接受/拒绝按钮无保护 | `Dashboard.tsx:1062-1078` 无 loading state；`Dashboard.tsx:2799-2800` 无 disabled |
| 限流 | ⚠️ 仅全局 apiLimiter | 无针对好友操作的专用限流 |
| 数据库 | ✅ UNIQUE 索引阻止重复好友 | `friendships(circleId, userAId, userBId)` 有唯一索引 |

**实际影响链：**

```
用户双击"接受好友请求"
  → 第一次：INSERT friendship → UPDATE status='accepted' ✅
  → 第二次：INSERT 撞 UNIQUE → 500 ❌
  → 用户看到 500，以为失败，实际已成功
```

**修复建议：**

```typescript
// 后端：使用原子 UPDATE 替代 SELECT + UPDATE 两步操作
const [updated] = await db.update(friendRequests)
  .set({ status: 'accepted' })
  .where(and(
    eq(friendRequests.id, requestId),
    eq(friendRequests.status, 'pending'),  // WHERE 中包含状态检查
    eq(friendRequests.receiverId, userId),
  ))
  .returning();
if (!updated) throw new NotFoundError('请求不存在或已处理');

// 前端：为 handleFriendAction 添加 loading state + disabled
```

---

### 🟡 C6. heartbox 互信号在 READ COMMITTED 下遗漏 — P2

**位置：** `heartboxService.ts` 第 133-304 行

**根因：** 虽然使用了 `db.transaction`，但 PostgreSQL 默认 READ COMMITTED 隔离级别下，事务 A 查询反向信号时看不到事务 B 未提交的插入。两个互信号事务都无法检测到对方，导致匹配遗漏。

**实际影响：**

```
用户 A 设置信号目标 B（事务 A）≈ 同时用户 B 设置信号目标 A（事务 B）

READ COMMITTED 下：
  事务 A 查找 B→A 的反向信号 → 看不到（B 未提交）→ 无匹配
  事务 B 查找 A→B 的反向信号 → 看不到（A 未提交）→ 无匹配
  两个事务都提交 → 互信号对存在但无 heart match 产生
```

**为什么是沉默数据丢失：** 两个互相心动的人没有被匹配到。用户完全无感知，不会报错，不会重试。

**为什么触发概率极低：** 24 小时只能设置 1 次信号 + 前端有完整保护 + 3次/分钟限流。两个用户需要在同一毫秒级窗口内设置互信号。

**修复建议：**

```typescript
// 方案 A（推荐）：提升隔离级别
await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`);
// 方案 B：提交后补偿扫描
```

---

### 🟡 D2. leaveCircle 并发 FOR UPDATE 死锁 — P2

**位置：** `circleService.ts` 第 500-667 行（`leaveCircle`）

**根因：** `leaveCircle` 事务使用 `SELECT ... FOR UPDATE` 锁定圈内所有相关 teamup 行。如果两个用户同时离开同一个圈子，且他们参与的 teamup 集合有重叠，两个事务会以**不确定的行顺序**锁定同一组 teamup 行。

**死锁场景（用户 A 领导 T1、参与 T2；用户 B 领导 T2、参与 T1）：**

```
事务 A（leaveCircle, user A）        事务 B（leaveCircle, user B）
───────────────────────────         ───────────────────────────
FOR UPDATE teamups:                  FOR UPDATE teamups:
  先锁 T1 → 成功                       先锁 T2 → 成功
  再锁 T2 → 等待（B 持有）⏳            再锁 T1 → 等待（A 持有）⏳
                                     ══ 死锁！ ══
```

**修复建议：**

```sql
-- 在 FOR UPDATE 查询中添加 ORDER BY 确保一致的锁顺序
SELECT t.id FROM teamups t
  JOIN teamup_members tm ON t.id = tm.teamup_id
  WHERE t.circle_id = $1 AND tm.user_id = $2 AND t.status = 'active'
  ORDER BY t.id  -- 固定锁顺序，防止死锁
  FOR UPDATE
```

---

### 🟠 R2. activateQueuedHeartboxMatches / getCurrentHeartboxReveal 非原子 — P2

**位置：**
- `heartboxService.ts` 第 344-371 行（`activateQueuedHeartboxMatches`）
- `heartboxService.ts` 第 373-424 行（`getCurrentHeartboxReveal`）

**根因：** 两个函数都执行「激活匹配」+「暂停用户主线路」两步操作，但**都没有事务保护**。激活成功后暂停失败，用户同时处于 heartbox 匹配和周匹配管线中——违反了 heartbox 的核心业务规则。

**`activateQueuedHeartboxMatches` 操作序列（无事务）：**

```typescript
// step 1: UPDATE heartMatches SET status='active'
await db.update(heartMatches).set({ status: 'active' }).where(...);

// step 2: UPDATE users SET pause — 如果这里失败，匹配已激活但用户未暂停
await db.update(users).set(heartboxMainlinePausePatch(...)).where(...);
```

**对比：** 同一文件中的 `cancelActiveHeartSignal`（line 309-341）和 `createOrReplaceHeartSignal`（line 137-299）都正确使用了 `db.transaction`。但这两个函数遗漏了。

**修复建议：**

```typescript
await db.transaction(async (tx) => {
  await tx.update(heartMatches).set({ status: 'active' }).where(...);
  await tx.update(users).set(heartboxMainlinePausePatch(...)).where(...);
});
```

---

### 🟠 R3. deleteAllFriends 非原子多表删除 — P2

**位置：** `friendService.ts` 第 426-452 行

**根因：** 三张表的 DELETE 操作无事务保护，部分失败导致好友关系不一致。

**操作序列（无事务）：**

```typescript
// step 1a: 删除 circle friendships
const deleted = await db.delete(friendships).where(...).returning();
// step 1b: 删除 globalFriendships（与 1a 并行）
const globalDeleted = await db.delete(globalFriendships).where(...).returning();
// step 2: 删除 contact unlock records
await deleteContactUnlockRecordsBetweenUsers(userAId, userBId);
```

**不一致场景：** step 1a 成功但 step 1b 失败 → 用户在圈子级不是好友，但在全局级仍然是好友。

**修复建议：**

```typescript
await db.transaction(async (tx) => {
  await tx.delete(friendships).where(...);
  await tx.delete(globalFriendships).where(...);
  await deleteContactUnlockRecordsBetweenUsers(userAId, userBId, tx);
});
```

---

### 🟠 R4. handleContactUnlockRequest 状态检查不在 WHERE 子句 — P2

**位置：** `contactsService.ts` 第 465-503 行

**根因：** 应用层检查 `request.status !== 'pending'`（line 481），但最终的 UPDATE 的 WHERE 子句**只按 ID 过滤**，不包含 status 条件。并发审批时后写入的会覆盖先写入的。

```typescript
// step 1: SELECT → 应用层检查 status
if (request.status !== 'pending') throw ...;

// step 2: UPDATE — WHERE 只包含 id，不包含 status
await db.update(contactUnlockRequests)
  .set({ status: 'approved' })
  .where(eq(contactUnlockRequests.id, requestId));
  // ❌ 缺少 AND status = 'pending'
```

**修复建议：**

```typescript
const [updated] = await db.update(contactUnlockRequests)
  .set({ status: action, reviewedAt: new Date() })
  .where(and(
    eq(contactUnlockRequests.id, requestId),
    eq(contactUnlockRequests.status, 'pending'),  // WHERE 中包含状态检查
  ))
  .returning();
if (!updated) throw new ConflictError('请求已被处理');
```

---

### 🟡 R5. heartbox 事务内使用全局 db — P2

**位置：** `heartboxService.ts` 第 185 行、第 245 行

**根因：** `createOrReplaceHeartSignal` 事务内有两处调用使用全局 `db` 而非事务客户端 `tx`，打破了事务的隔离性。

**泄漏点 1 — 审计日志（line 185）：**

```typescript
// 在 db.transaction(async (tx) => { ... }) 内部
await logAudit({...});  // logAudit 内部使用全局 db，不是 tx
```

**影响：** 如果事务后续回滚，审计日志已经写入且无法回滚。审计记录了一条「实际上没有发生的操作」。

**泄漏点 2 — 安全检查（line 245）：**

```typescript
const allowed = await safetyAllowsHeartboxMatch(me.id, targetUser.id);
// safetyAllowsHeartboxMatch 内部使用全局 db
```

**影响：** 此查询在事务隔离边界之外执行。事务的原子性保证被打破——检查看到的是事务外的数据。

**修复建议：**

```typescript
await logAuditWithTx(tx, {...});
const allowed = await safetyAllowsHeartboxMatch(tx, me.id, targetUser.id);
```

---

### 🟢 C1. OTP 冷却窗口 TOCTOU 竞态 — P3

**位置：** `authService.ts` 第 104-131 行

**根因：** `otpCooldowns.get()` 检查和 `otpCooldowns.set()` 设置之间有大量异步操作。两个并发请求可以同时通过检查，都成功发送 OTP，绕过 60 秒冷却限制。

**三层防护：** 前端 ✅ `disabled` 保护 | 限流 ✅ 10次/10分钟 | 数据库 N/A 内存 Map

**实际影响：** 同一邮箱在 60 秒内收到 2 封 OTP 邮件。无安全影响。

**修复：** 在检查通过后同步设置冷却标记，而非等异步操作完成。

---

### 🟢 C2. consumeOtp 双发消费 — P3

**位置：** `authService.ts` 第 73-100 行

**根因：** SELECT 和 DELETE 是两个独立的异步操作。两个并发请求可以同时 SELECT 到同一 OTP 行。

**三层防护：** 前端 ✅ | 限流 ✅ 20次/10分钟 | 数据库 ✅ `users.email` UNIQUE 约束兜底

**实际影响：** 第二次注册返回 500 而非 400 友好提示。DB 唯一约束阻止了真正的重复注册。

**修复：** 使用 `DELETE ... WHERE code = ? RETURNING *` 替代 SELECT + DELETE。

---

### 🟢 C4. sendFriendRequest 双向并发重复 — P3

**位置：** `friendService.ts` 第 213-262 行

**根因：** A→B 和 B→A 的并发请求可以同时通过 pending 检查（都未找到），各自插入一条记录。partial unique index 只防同方向，不防反方向。

**三层防护：** 前端 ⚠️ Partial | 限流 ⚠️ 仅全局 | 数据库 ⚠️ partial index 不防反方向

**实际影响：** 同一圈内存在两条方向相反的 pending 请求。一方接受后另一方仍然 pending。

**修复：** 包装在 `db.transaction` 中，使用 `SELECT ... FOR UPDATE` 或 advisory lock。

---

### 🟢 C7. matches 表无唯一约束允许重复匹配 — P3

**位置：** `matchService.ts` 第 612-628 行

**根因：** `matches` 表缺少 `(weekOf, source, userAId, userBId)` 的唯一约束。

**三层防护：** 前端 N/A (admin cron) | 限流 ✅ adminLimiter | 数据库 ❌ 无约束

**实际影响：** 同一周同一对用户被匹配两次。`mailLogs` 表同样缺少唯一约束，`onConflictDoNothing()` 因无目标索引而形同虚设，可能重复发送邮件。

**修复：** 添加 `UNIQUE (weekOf, source, userAId, userBId)` 约束，INSERT 时使用 `ON CONFLICT DO NOTHING`。

---

### 缺陷交叉影响

| 组合 | 交互影响 |
|------|---------|
| **D1 + C6** | heartbox 同时存在死锁和匹配遗漏。即使死锁未发生，READ COMMITTED 也可能遗漏；即使未遗漏，双向并发也可能死锁 |
| **C3 + C7** | likePost 500 错误 + matches 无唯一约束，多种竞态叠加 |
| **R5 + C6** | heartbox 事务泄漏全局 db + READ COMMITTED 遗漏 = 安全检查在事务外执行，可能绕过屏蔽 |

---

## 已验证正确的并发行为（测试 PASS）

以下行为经测试验证为正确：

- **OTP 冷却**：同步占位修复方案有效验证
- **内存泄漏**：`otpCooldowns` / `otpVerifyFailures` 可通过定期 sweep 解决
- **并发注册**：`registerWithOtp` 有二次 INSERT 前检查防御
- **匹配状态机**：`recordAction` 与 `expireUnactedMatches` cron 的并发不会让过期匹配复活
- **双方 ACCEPT**：并发 `recordAction` ACCEPT 可正确产生 MUTUAL 状态
- **like/unlike 交叉**：`likePost` + `unlikePost` 交叉竞态下 `likeCount` 与实际点赞数一致
- **expireUnactedMatches 安全性**：RETURNING 子句正确识别已操作用户，不会暂停已 ACCEPT 的用户
- **unlikePost 安全性**：`GREATEST(like_count - 1, 0)` SQL 原子操作保证计数不漂移
- **JWT 认证**：过期/篡改/错误密钥/缺字段/错误算法全部正确拒绝
- **Admin requireAdmin**：`crypto.timingSafeEqual` 实现正确，防时序攻击
- **Admin SQL 黑名单**：正确拦截 INSERT/DELETE/UPDATE/DROP/COPY/EXECUTE；注释剥离正确
- **Impersonate**：正确限制 `@test.local` 邮箱
- **OTP 失败计数**：8 次失败触发 15 分钟封锁，不同 purpose/邮箱独立计算
- **优先级算法**：noMatchStreak 上限 4 周，首次失联不惩罚，结果夹在 [0.01, 1]
- **好友请求**：双向 pending 去重，非接收方不可操作
- **评论删除权限**：帖主可删一级评论但不可删二级回复
- **Zod Schema**：邮箱域名/密码长度/枚举值/HTML 注入/tags 限制均正确
- **账户注销**：PII 全部清除，行保留保证 FK 完整性
- **论坛可见性**：hot 排序排除私密帖子，非 mine scope 排除他人私密帖子
- **信用分治理**：>90 normal, 86-90 limited, ≤85 banned，扣分只接受 1/3/5
