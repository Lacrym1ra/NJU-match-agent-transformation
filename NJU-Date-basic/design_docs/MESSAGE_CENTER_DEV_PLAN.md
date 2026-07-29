# 站内消息中心（Message Center）— 开发计划文档

> 版本：v1.0 | 日期：2026-06-01
>
> 状态：设计已定，进入开发实施阶段
> 协作基准：以 `docs/MESSAGE_CENTER_DESIGN.md` 为需求来源，本文只规划实现范围与接口边界。

---

## 里程碑总览

```
数据库 / Service 层 / 基础路由（消息本体）
业务模块接入（匹配 / 问卷 / 举报结果）
管理后台广播 + 定时任务收口 + 调优
```

---

## 阶段一：数据库、Service 层、基础路由

**目标**：建立 `notifications` 表，完成消息中心核心服务层，暴露对内服务接口和面向前端的基础路由。

### 后端任务

- [ ] 数据库迁移 `006_notifications.ts`：新增 `notifications` 表与 `broadcast_tasks` 表（见下方“数据模型设计”）
- [ ] `backend/src/db/schema.ts`：注册上述两表定义
- [ ] `notificationService.ts`：实现核心服务层（对外服务接口）
  - [ ] `createNotification(payload)` — 单条写入（幂等）
  - [ ] `getNotifications(userId, { page, limit, status })` — 分页查询
  - [ ] `getUnreadCount(userId)` — 未读数（为后续缓存预留接口）
  - [ ] `markAsRead(userId, notificationId)` — 单条已读
  - [ ] `markAllAsRead(userId)` — 全部已读
  - [ ] `broadcastNotifications(payload, targetUserIds?)` — 同步广播写入（小批量用）
  - [ ] `enqueueBroadcastTask(payload)` — 异步广播入队（大批量返回 taskId）
  - [ ] `getBroadcastTaskStatus(taskId)` — 查询广播任务进度
  - [ ] `cleanupExpiredNotifications()` — 清理过期消息（软删除或物理删除）
- [ ] `notificationRoutes.ts`：注册面向前端/管理后台的 REST 路由
  - [ ] `GET    /api/v1/notifications`（需 JWT，分页，status=all|unread|read）
  - [ ] `GET    /api/v1/notifications/unread-count`（需 JWT）
  - [ ] `POST   /api/v1/notifications/:id/read`（需 JWT）
  - [ ] `POST   /api/v1/notifications/read-all`（需 JWT）
  - [ ] `POST   /api/v1/admin/notifications/broadcast`（受限角色）
  - [ ] `GET    /api/v1/admin/notifications/broadcast/:taskId`（受限角色）
- [ ] `backend/src/index.ts`：注册 `/api/v1/notifications` 与 `/api/v1/admin/notifications` 路由
- [ ] `apiLimiter` / `errorHandler`：确保通知接口纳入现有中间件链路

### 验收标准

- `notifications` 表与 `broadcast_tasks` 表迁移可独立上/下迁。
- `createNotification` 使用 `INSERT ... ON CONFLICT (idempotency_key) DO NOTHING`，重复调用不报错、不重复写入。
- 基础路由可通过 curl / 测试脚本正常返回分页列表、未读数、标记已读。
- 广播接口在大用户量（> 1k 人）下返回 `taskId` 且不自愈超时。

---

## 阶段二：业务事件接入

**目标**：在现有业务模块的关键事件点调用 `notificationService.createNotification()`，使消息自动流入消息中心。

### 后端任务

- [ ] **匹配揭晓**（`matchService.ts`）：
  - [ ] `unlockCurrentWeekMatches()` 揭晓后，对每个有匹配结果的用户写入 `match_revealed`；对未匹配上的用户写入 `match_no_result`
  - [ ] 双方均 ACCEPT 后，`recordAction()` 内写入 `match_mutual_success`
  - [ ] `warnExpiringMatches()` 写入 `match_expiring`
- [ ] **问卷状态**（`matchService.ts` / `surveyService.ts`）：
  - [ ] 周二 18:00 Cron 写入 `survey_incomplete`（cron 端点内调用批量写入）
  - [ ] 问卷版本升级时写入 `survey_update_required`（如有版本升级入口）
- [ ] **举报处理结果**（`admin.ts` 路由处理 / 相关 service）：
  - [ ] 管理员审核举报后（`status` 更新为 `reviewed` / `warn_update` / `dismissed`）写入 `report_result`
- [ ] **Heartbox 互选**（`heartboxService.ts`，如有）：
  - [ ] Heartbox 双向匹配建立时写入 `match_mutual_success`（类型共用，meta 加 `source: 'heartbox'`）
- [ ] 所有写入点携带正确的 `idempotency_key`，与设计文档第 7.6 节一致。

### 验收标准

- 揭晓后用户首次加载消息列表可见 `match_revealed` 或 `match_no_result`。
- 双向接受后双方均收到 `match_mutual_success`。
- `notifications` 表中 `created_at` 与业务事件发生时间一致（不延迟超过事务提交时间）。
- 同一事件重复触发（如 cron 重跑）不重复写入（幂等键生效）。

---

## 阶段三：管理后台广播 + 定时任务收口 + 调优

**目标**：完成治理类消息的广播能力，把通知相关的定时任务全部纳入，收敛剩余边界。

### 后端任务

- [ ] `broadcastWorker.ts`：异步消费广播任务（简单 worker，非重量级队列）
  - [ ] 按 `broadcast_tasks` 表中 `status = pending` 的任务，分批（每批 200 条）写入 `notifications`
  - [ ] 更新 `status → running → completed / failed`，记录 `createdCount` / `skippedCount`
  - [ ] 失败时可重试（MVP 可人工触发重播，自动重试非必须）
- [ ] 定时任务（与现有 cron 同文件或新建 `notificationCron.ts`）
  - [ ] 周二 18:00：批量写入 `survey_incomplete`
  - [ ] 周三 20:00：揭晓后批量写入 `match_revealed` / `match_no_result`
  - [ ] 周五 18:00：批量写入 `match_expiring`
  - [ ] 每日 03:00：调用 `cleanupExpiredNotifications()` 清理 `expires_at < now()` 的消息
- [ ] 速率限制中间件：
  - [ ] `unread-count` 单用户 1 分钟最多 5 次
  - [ ] `broadcast` 同一管理员账号 10 分钟最多 3 次
- [ ] 日志与监控：广播任务失败/大跳过时记录 `auditLogs`（如管理员角色未落地，可先用 console 预警）

### 验收标准

- 管理员可通过广播接口向全部/指定用户发送 `system_announcement`。
- `GET /api/v1/admin/notifications/broadcast/:taskId` 能返`回completed / running / pending / failed` 及计数。
- 定时任务覆盖设计文档第 10 节全部触发时机。
- 清理任务不物理删除未到期的消息；`expires_at` 仅用于自动过期消息（如维护公告）。

---

## 数据模型设计

### `notifications` 表

```ts
export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  // enum: 'match_revealed' | 'match_no_result' | 'match_mutual_success' | 'match_expiring'
  //        | 'survey_update_required' | 'survey_incomplete'
  //        | 'policy_update' | 'system_announcement' | 'report_result'
  title: text('title').notNull(),
  body: text('body').notNull(),
  level: text('level').notNull().default('info'), // 'info' | 'success' | 'warning' | 'critical'
  actionUrl: text('action_url'),
  meta: jsonb('meta').$type<Record<string, unknown>>().default(sql`'{}'::jsonb`),
  isRead: boolean('is_read').notNull().default(false),
  readAt: timestamp('read_at', { withTimezone: true, mode: 'string' }),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }), // 软删除
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  idempotencyKey: text('idempotency_key').notNull().unique(), // 幂等键
}, (t) => [
  index('idx_notifications_user_read').on(t.userId, t.isRead, t.createdAt),
  index('idx_notifications_user_type').on(t.userId, t.type, t.createdAt),
  index('idx_notifications_created_at').on(t.createdAt),
]);
```

### `broadcast_tasks` 表（MVP 轻量任务追踪）

```ts
export const broadcastTasks = pgTable('broadcast_tasks', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  level: text('level').notNull().default('info'),
  actionUrl: text('action_url'),
  targetUserIds: jsonb('target_user_ids').$type<string[] | null>(), // null = 全部广播；数组 = 精确投递
  idempotencyScope: text('idempotency_scope').notNull(), // 'all' 或 'userIds_hash'
  status: text('status').notNull().default('pending'), // 'pending' | 'running' | 'completed' | 'failed'
  createdCount: integer('created_count').default(0),
  skippedCount: integer('skipped_count').default(0),
  totalEstimate: integer('total_estimate').default(0),
  startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' }),
  finishedAt: timestamp('finished_at', { withTimezone: true, mode: 'string' }),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
});
```

### `meta` JSON Schema 规范（设计已定，供写入方参考）

| `type` | `meta` 结构 |
|---|---|
| `match_revealed` / `match_no_result` / `match_expiring` | `{ "weekOf": "YYYY-MM-DD", "source": "weekly" \| "heartbox" }` |
| `match_mutual_success` | `{ "matchId": "uuid", "source": "weekly" \| "heartbox" }` |
| `survey_update_required` | `{ "surveyVersion": "v4" }` |
| `survey_incomplete` | `{ "weekOf": "YYYY-MM-DD" }` |
| `report_result` | `{ "reportId": "uuid", "outcome": "reviewed" \| "dismissed" \| "warn_update" }` |
| `policy_update` / `system_announcement` | `{ "broadcastTaskId": "broadcast_task_xxx" }` |

---

## 对外接口设计

本模块对外暴露两层接口：

1. **服务层接口（`notificationService.ts`）**—— 供其他后端服务/业务 module 直接调用
2. **路由层接口（`notificationRoutes.ts`）**—— 供前端 / 管理后台通过 HTTP 访问

### 第一层：对其他后端服务的接口（`notificationService.ts`）

位于 `backend/src/services/notificationService.ts`，被 `matchService`、`heartboxService`、`surveyService`、`admin report 处理逻辑` 等直接导入调用。

```ts
// 单条写入（事件触发时调用，幂等）
export async function createNotification(payload: {
  userId: string;
  type: string;
  title: string;
  body: string;
  level?: 'info' | 'success' | 'warning' | 'critical';
  actionUrl?: string;
  meta?: Record<string, unknown>;
  idempotencyKey: string; // 调用方按规范构造
  expiresAt?: string;
}): Promise<{ id: string; created: boolean }>

// 批量写入（用于小范围精确投递，如 match_mutual_success 给两个人）
export async function createNotifications(
  payloads: Array<Omit<Parameters<typeof createNotification>[0], 'idempotencyKey'> & { idempotencyKey: string }>
): Promise<Array<{ id: string; created: boolean }>>

// 未读数（为未来 Redis 缓存预留统一入口）
export async function getUnreadCount(userId: string): Promise<number>

// 标记单条已读
export async function markAsRead(userId: string, notificationId: string): Promise<{ updated: boolean }>

// 标记全部已读
export async function markAllAsRead(userId: string): Promise<{ updated: number }>

// 同步广播（用户量 < 500 时直接调用，不走异步队列）
export async function broadcastNotifications(payload: {
  type: string;
  title: string;
  body: string;
  level?: 'info' | 'success' | 'warning' | 'critical';
  actionUrl?: string;
  meta?: Record<string, unknown>;
  expiresAt?: string;
}, targetUserIds?: string[]): Promise<{ created: number }>

// 异步广播入队（返回 taskId，供管理后台查询）
export async function enqueueBroadcastTask(payload: {
  type: string;
  title: string;
  body: string;
  level?: 'info' | 'success' | 'warning' | 'critical';
  actionUrl?: string;
  meta?: Record<string, unknown>;
  expiresAt?: string;
  targetUserIds?: string[] | null;
}, createdBy?: string): Promise<{ taskId: string; estimatedCount: number }>

// 查询广播任务状态
export async function getBroadcastTaskStatus(taskId: string): Promise<{
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  created: number;
  skipped: number;
  finishedAt?: string | null;
}>

// 清理过期消息（定时任务调用）
export async function cleanupExpiredNotifications(): Promise<{ removed: number }>
```

**调用约定**：

- 所有写入使用 `INSERT ... ON CONFLICT (idempotency_key) DO NOTHING`；调用方不需要先查询是否存在。
- 同一事务内发生业务状态变更 + 写通知时，通知写入跟随业务事务提交，保证一致性。
- `idempotencyKey` 构造见设计文档第 7.6 节：`notif:{user_id}:{type}:{scope}`。

---

### 第二层：对路由层暴露的接口（`notificationRoutes.ts`）

注册于 `backend/src/routes/notification.ts`，在 `index.ts` 中分别挂载到：

```ts
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/admin/notifications', adminNotificationRoutes);
```

#### 用户侧路由

```
GET    /api/v1/notifications
GET    /api/v1/notifications/unread-count
POST   /api/v1/notifications/:id/read
POST   /api/v1/notifications/read-all
```

对应 Service 调用：
- `getNotifications(userId, { page, limit, status })`
- `getUnreadCount(userId)`
- `markAsRead(userId, id)`
- `markAllAsRead(userId)`

- `unread-count` 接口需配置 per-user rateLimit：单用户 1 分钟最多 5 次（防前端 bug 轮询过频）。

#### 管理员侧路由

```
POST   /api/v1/admin/notifications/broadcast
GET    /api/v1/admin/notifications/broadcast/:taskId
```

- `broadcast` 需受限角色鉴权；MVP 阶段若后台角色系统未落地，可先用项目负责人内部鉴权过渡（与设计文档一致）。
- `broadcast` 接口：如果 `targetUserIds` 为数组且长度 < 200，直接调用 `broadcastNotifications` 同步完成；否则调用 `enqueueBroadcastTask` 返回 taskId。
- 同一管理员账号 10 分钟内最多 3 次广播；超出返回 429。

---

## 定时任务规划

新建 `backend/src/cron/notifications.ts`，在 `weeklyMatch.ts` 同等的 `startCronJobs()` 中追加启动。

| 时间 | 任务 | 写入的消息类型 | 触发入口 |
|---|---|---|---|
| 周二 18:00 | 问卷未完成提醒 | `survey_incomplete` | Cron |
| 周三 20:00 | 匹配揭晓后 | `match_revealed` / `match_no_result` | Cron（揭晓后立即执行） |
| 周五 18:00 | 匹配即将过期 | `match_expiring` | Cron |
| 每日 03:00 | 清理 `expires_at < now()` 的消息 | — | Cron（调用 `cleanupExpiredNotifications`） |
| 事件驱动 | 双方均 ACCEPT | `match_mutual_success` | `matchService.recordAction()` 内调用 |
| 事件驱动 | 问卷版本升级 | `survey_update_required` | 升级入口调用 |
| 事件驱动 | 举报审核完成 | `report_result` | Admin 审核接口内调用 |

说明：
- `match_revealed` / `match_no_result` 在 `unlockCurrentWeekMatches()` 结束后调用一次批量写入，不逐条发。
- `survey_incomplete` 的 cron 需查询 `users.surveyComplete = false` 的用户并批量写入。
- `match_expiring` 的 cron 需查询本周 `status = 'REVEALED'` 且尚未 action 的用户并写入。

---

## 数据库迁移文件规划

```
backend/src/db/migrations/
├── 003_cards.ts          # 圈子阶段一（已存在）
├── 004_social.ts         # 圈子阶段二（已存在）
├── 005_forum.ts          # 论坛相关（已存在或第三组负责）
└── 006_notifications.ts  # 消息中心：notifications + broadcast_tasks
```

迁移文件 `006_notifications.ts` 职责：
1. 创建 `notifications` 表（含 `idempotency_key` 唯一约束、索引）。
2. 创建 `broadcast_tasks` 表。
3. `down` 时按反向顺序删表（先 `notifications`，再 `broadcast_tasks`）。

---

## 已知技术债务

### 1. 无 Redis 缓存未读数

**位置**：`notificationService.getUnreadCount()`

**问题描述**：

当前 `getUnreadCount` 直接对 `notifications` 表做 `COUNT(*) WHERE user_id = ? AND is_read = false`。用户量增长后，高频轮询会成为数据库热点查询。

**优先级**：中（MVP 可接受，用户量到千级后需引入 Redis）

**正确方向**：
- 写入通知时 `INCR` Redis 计数器（按 `userId` 为 key）。
- 标记已读时 `DECR`。
- Redis 做缓存层， miss 时回源数据库并回填。

### 2. 广播 Worker 为进程内轻量实现

**位置**：`broadcastWorker.ts`

**问题描述**：

MVP 不使用外部队列（如 Bull / RabbitMQ / SQS），广播 worker 只是后台一个简单轮询（`setInterval` 或 cron），扫描 `broadcast_tasks` 表中 `status = pending` 的任务。单实例部署下没问题；多实例部署可能出现竞态执行，MVP 阶段暂用数据库 `UPDATE ... WHERE status = 'pending'` 的乐观锁防止重复执行。

**优先级**：低（当前为单体部署）

**正确方向**：
- 若后续引入 Redis，可升级为 `BullMQ` 队列。
- 或把广播拆成独立 worker 容器，只跑一份。

---

## 风险与依赖

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 业务模块遗漏调用 `createNotification` | 消息漏发 | 在 `matchService` / `heartboxService` / admin report 处理处集中审查写入点，补充单元测试断言数据库存在对应通知行 |
| `idempotency_key` 构造不一致导致重复 | 同一事件重复消息 | 在 `notificationService` 内提供辅助函数 `buildIdempotencyKey(userId, type, scope)`，强制调用方使用 |
| 广播写入大批量超时 | 请求阻塞或内存溢出 | 同步广播限制 200 人以下；大批量必须走 `enqueueBroadcastTask` 异步化 |
| 未读数接口被刷 | 数据库热点 | `unread-count` 单用户 1 分钟限 5 次；后续叠加 Redis |
| 审计日志缺失 | 广播操作无法追溯 | MVP 若 `auditLogs` 表未接入后台角色系统，先把广播创建记录到 `broadcast_tasks.created_by`，保留操作人 |

---

## 附录：现有业务模块接入点速查表

| 消息类型 | 业务触发点（函数/路由） | 需调用的 Service 接口 |
|---|---|---|
| `match_revealed` | `matchService.unlockCurrentWeekMatches()` | `createNotification`（批量） |
| `match_no_result` | `matchService.unlockCurrentWeekMatches()` | `createNotification`（批量） |
| `match_mutual_success` | `matchService.recordAction()` | `createNotification`（双方各一条） |
| `match_expiring` | `matchService.warnExpiringMatches()` | `createNotification`（批量） |
| `survey_incomplete` | 周二 18:00 Cron + `matchService.sendPendingSurveyReminderBatch()` | `createNotification`（批量） |
| `survey_update_required` | 问卷版本升级入口（如有） | `createNotification` |
| `report_result` | Admin 审核举报接口（PATCH /api/v1/admin/reports/:id） | `createNotification` |
| `system_announcement` | Admin 广播接口（POST /api/v1/admin/notifications/broadcast） | `enqueueBroadcastTask` |
| `policy_update` | Admin 广播接口 | `enqueueBroadcastTask` |

---

## 后端状态机设计

本节定义消息中心涉及的三类状态机：**通知实体生命周期**、**广播任务生命周期**、**业务事件→通知触发映射**。
所有状态机均基于现有业务代码的实际状态枚举与转换函数设计，保证与 `matchService`、`heartboxService`、`reportService` 等模块的语义一致。

---

### 状态机一：通知实体生命周期（Notification Lifecycle）

单条通知的存活状态由三个**正交维度**组成，彼此独立、互不阻塞：

```
维度 A — 阅读状态（is_read / read_at）

  ┌─────────┐   markAsRead()    ┌─────────┐
  │  UNREAD  │ ───────────────> │   READ   │
  │is_read=F│   (用户操作)       │is_read=T│
  └─────────┘                    └─────────┘
       ↑                              │
       └──── createNotification()     └── read_at = NOW()
            (新消息入站)

  守卫：markAsRead 仅当 is_read = false 时执行 UPDATE；已读再调为幂等空操作。
  批量操作：markAllAsRead = UPDATE ... SET is_read = true WHERE user_id = ? AND is_read = false
```

```
维度 B — 时效状态（expires_at / deleted_at）

  ┌──────────┐  cleanupExpired()  ┌───────────┐  用户/API 删除  ┌───────────┐
  │  ACTIVE   │ ────────────────> │  EXPIRED   │ ──────────────> │  DELETED  │
  │expires_at │  (定时任务 03:00)  │deleted_at  │  (MVP 不实现)   │deleted_at │
  │> NOW()    │                   │= NOW()     │                 │= NOW()    │
  │OR NULL    │                   │(软删除)    │                 │(软删除)   │
  └──────────┘                    └───────────┘                  └───────────┘

  说明：
  - expires_at = NULL 的通知永不过期（如 match_mutual_success）。
  - expires_at 有值但尚未到期的通知，查询时可见、不触发清理。
  - MVP 阶段不实现用户主动删除；EXPIRED 状态即为最终态。
  - 清理任务：UPDATE ... SET deleted_at = NOW() WHERE expires_at < NOW() AND deleted_at IS NULL
```

```
维度 C — 查询可见性（WHERE 条件组合）

  前端查询条件：
    status=all      → WHERE deleted_at IS NULL
    status=unread   → WHERE deleted_at IS NULL AND is_read = false
    status=read     → WHERE deleted_at IS NULL AND is_read = true

  未读计数：
    WHERE user_id = ? AND is_read = false AND deleted_at IS NULL
```

**状态组合矩阵**：

| 组合 | is_read | deleted_at | 前端可见 | 含义 |
|------|---------|------------|----------|------|
| A | false | NULL | ✅ 未读列表 | 正常新消息 |
| B | true | NULL | ✅ 已读列表 | 用户已阅 |
| C | false | 非 NULL | ❌ 不可见 | 过期未读（清理任务处理） |
| D | true | 非 NULL | ❌ 不可见 | 过期已读（清理任务处理） |

---

### 状态机二：广播任务生命周期（Broadcast Task Lifecycle）

广播任务（`broadcast_tasks` 表）的生命周期为线性状态机，用于管理大用户量的异步广播写入。

```
                    enqueueBroadcastTask()
  ┌──────────┐  ──────────────────────>  ┌──────────┐
  │ (不存在)  │                           │  PENDING  │
  └──────────┘                           │ status =  │
                                         │ 'pending' │
                                         └─────┬─────┘
                                               │
                                    broadcastWorker()
                                    乐观锁抢锁：
                                    UPDATE ... SET status = 'running'
                                    WHERE id = ? AND status = 'pending'
                                    RETURNING id
                                               │
                              ┌────────────────┼────────────────┐
                              │ 抢锁成功        │                │ 抢锁失败
                              ▼                │                ▼
                        ┌──────────┐           │          (跳过，被其他实例抢走)
                        │  RUNNING  │           │
                        │ status =  │           │
                        │ 'running' │           │
                        └─────┬─────┘          │
                              │                 │
                    ┌─────────┴──────┐          │
                    │ 分批写入成功    │ 写入异常  │
                    │ (200 条/批)    │          │
                    ▼                ▼          │
              ┌───────────┐  ┌───────────┐     │
              │ COMPLETED │  │   FAILED   │     │
              │ status =  │  │ status =   │     │
              │'completed'│  │ 'failed'   │     │
              │finishedAt │  │finishedAt  │     │
              │= NOW()    │  │= NOW()     │     │
              └───────────┘  └─────┬─────┘     │
                                   │            │
                            人工重试 │            │
                            UPDATE SET          │
                            status='pending'    │
                            WHERE id = ?        │
                                   │            │
                                   ▼            │
                              ┌──────────┐      │
                              │ PENDING  │<─────┘
                              │ (重试)    │
                              └──────────┘
```

**状态枚举与守卫**：

| 当前状态 | 允许的转换 | 触发者 | 守卫条件 |
|----------|-----------|--------|----------|
| `pending` | → `running` | `broadcastWorker` 轮询 | 乐观锁：`UPDATE WHERE status = 'pending'` 原子抢锁 |
| `running` | → `completed` | worker 分批写入结束 | `createdCount + skippedCount >= totalEstimate` |
| `running` | → `failed` | worker 捕获异常 | 写入过程中数据库错误 / 连接断开 |
| `failed` | → `pending` | 管理员手动触发重试 | `GET /admin/notifications/broadcast/:taskId` 检查后，人工确认重试 |
| `completed` | — (终态) | — | 不再转换 |
| `pending` | — (被其他实例抢走) | 另一进程的 worker | 抢锁失败，skip |

**worker 分批写入逻辑**：

```
broadcastWorker() 伪代码：
  while (true):
    task = SELECT * FROM broadcast_tasks WHERE status = 'pending' LIMIT 1
    if (!task) sleep(30s); continue

    // 乐观锁抢锁
    locked = UPDATE broadcast_tasks SET status = 'running', startedAt = NOW()
             WHERE id = task.id AND status = 'pending' RETURNING id
    if (!locked) continue  // 被其他实例抢走

    targetUsers = task.targetUserIds ?? (SELECT id FROM users WHERE ...)
    batchSize = 200

    for each batch of targetUsers:
      rows = INSERT INTO notifications (id, user_id, type, ..., idempotency_key)
             VALUES (batch)
             ON CONFLICT (idempotency_key) DO NOTHING
             RETURNING id

      createdCount += rows.length
      skippedCount += (batchSize - rows.length)
      UPDATE broadcast_tasks SET createdCount, skippedCount WHERE id = task.id

    UPDATE broadcast_tasks SET status = 'completed', finishedAt = NOW() WHERE id = task.id
    // 异常时：SET status = 'failed', finishedAt = NOW()
```

---

### 状态机三：业务事件 → 通知触发映射（Event → Notification Trigger Map）

此状态机定义**各业务模块的状态转换如何触发通知写入**，是消息中心与业务系统集成的核心映射表。

#### 3.1 匹配系统（Match Lifecycle → Notification）

```
匹配状态机（matches.status）：

  runMatchingPipeline()       unlockCurrentWeekMatches()         recordAction()
  ────────────────> LOCKED ─────────────────────> REVEALED ───────────────┐
                                                       │                  │
                                                       │ expireUnacted    │ 双方均 ACCEPT
                                                       │ Matches()        │
                                                       │ (周五 20:00)     │
                                                       ▼                  ▼
                                                    EXPIRED            MUTUAL
                                                                          │
                                                     recordAction()        │
                                                     (非双向 ACCEPT)       │
                                                          ▼               │
                                                        MISSED            │
```

**通知触发点（仅标记 ★ 的转换触发通知写入）**：

| 业务状态转换 | 触发函数 | 通知类型 | 通知对象 | 幂等键格式 |
|---|---|---|---|---|
| `LOCKED → REVEALED`（有匹配）★ | `unlockCurrentWeekMatches()` | `match_revealed` | 被揭晓用户 | `notif:{uid}:match_revealed:week_{weekOf}` |
| `LOCKED → REVEALED`（无匹配）★ | `unlockCurrentWeekMatches()` | `match_no_result` | 本周无匹配的用户 | `notif:{uid}:match_no_result:week_{weekOf}` |
| `REVEALED → MUTUAL` ★ | `recordAction()` | `match_mutual_success` | 双方各一条 | `notif:{uid}:match_mutual_success:match_{matchId}` |
| `REVEALED → MISSED` | `recordAction()` | **不写通知** | — | — |
| `REVEALED → EXPIRED` | `expireUnactedMatches()` | **不写通知** | — | — |
| `REVEALED` 状态 + 未操作 ★ | `warnExpiringMatches()` | `match_expiring` | 本周 REVEALED 且未操作的用户 | `notif:{uid}:match_expiring:week_{weekOf}` |

**触发逻辑详解**：

**★ `unlockCurrentWeekMatches()` → `match_revealed` / `match_no_result`**

```ts
// 在 unlockCurrentWeekMatches() 内，状态转换完成后追加：
const revealedUsers = new Set(unlockedRows.map(r => /* 提取 userA/userB */));

// 1. 有匹配的用户 → match_revealed
for (const uid of revealedUsers) {
  await notificationService.createNotification({
    userId: uid,
    type: 'match_revealed',
    title: '本周锦书已送达',
    body: '你本周的匹配结果已经揭晓，点击查看。',
    level: 'info',
    actionUrl: '/reveal',
    meta: { weekOf, source: 'weekly' },
    idempotencyKey: `notif:${uid}:match_revealed:week_${weekOf}`,
  });
}

// 2. 无匹配的用户 → match_no_result
const allParticipatingUsers = await db.select({ id: users.id }).from(users)
  .where(and(eq(users.isParticipating, true), ...));
const noMatchUsers = allParticipatingUsers.filter(u => !revealedUsers.has(u.id));

for (const u of noMatchUsers) {
  await notificationService.createNotification({
    userId: u.id,
    type: 'match_no_result',
    title: '本周暂未匹配成功',
    body: '本周暂未匹配到合适对象，下周再来！',
    level: 'info',
    actionUrl: '/dashboard',
    meta: { weekOf, source: 'weekly' },
    idempotencyKey: `notif:${u.id}:match_no_result:week_${weekOf}`,
  });
}
```

**★ `recordAction()` → `match_mutual_success`**

```ts
// 在 recordAction() 内，状态变为 MUTUAL 后追加：
if (newStatus === 'MUTUAL') {
  const pair = [updated.userAId, updated.userBId];
  for (const uid of pair) {
    await notificationService.createNotification({
      userId: uid,
      type: 'match_mutual_success',
      title: '恭喜！双向奔赴成功',
      body: '你们双方都选择了对方，快去看看吧！',
      level: 'success',
      actionUrl: '/reveal',
      meta: { matchId: updated.id, source: 'weekly' },
      idempotencyKey: `notif:${uid}:match_mutual_success:match_${updated.id}`,
    });
  }
}
```

**★ `warnExpiringMatches()` → `match_expiring`**

```ts
// 在 warnExpiringMatches() 发邮件后追加站内通知：
// 遍历本周 REVEALED 且双方均未操作的匹配
for (const match of unactedMatches) {
  const unactedUsers = []; // 从 match 中提取未操作的用户
  if (!match.userAAction) unactedUsers.push(match.userAId);
  if (!match.userBAction) unactedUsers.push(match.userBId);

  for (const uid of unactedUsers) {
    await notificationService.createNotification({
      userId: uid,
      type: 'match_expiring',
      title: '匹配即将过期',
      body: '你的本周匹配还有不到 48 小时就要过期了，请尽快做出选择！',
      level: 'warning',
      actionUrl: '/reveal',
      meta: { weekOf: match.weekOf, source: 'weekly' },
      idempotencyKey: `notif:${uid}:match_expiring:week_${match.weekOf}`,
    });
  }
}
```

#### 3.2 问卷系统（Survey → Notification）

```
问卷状态（无显式状态机，由 users.surveyComplete + surveyAnswers.version 组合判断）：

  用户注册 ──> surveyComplete = false ──> 提交问卷 ──> surveyComplete = true
                    │                                      │
                    │ 周二 18:00 Cron                       │ surveyAnswers.version ≠ LATEST
                    │ (发送 survey_incomplete)              │ (发送 survey_update_required)
                    ▼                                      ▼
              survey_incomplete                      survey_update_required
```

| 业务条件 | 触发时机 | 通知类型 | 通知对象 | 幂等键格式 |
|---|---|---|---|---|
| `surveyComplete = false` 且 `isParticipating = true` | 周二 18:00 Cron ★ | `survey_incomplete` | 问卷未完成的活跃用户 | `notif:{uid}:survey_incomplete:week_{weekOf}` |
| `surveyAnswers.version ≠ LATEST_SURVEY_VERSION` 且 `isParticipating = true` | 版本升级时 ★ | `survey_update_required` | 版本过期的活跃用户 | `notif:{uid}:survey_update_required:v{version}` |

**触发逻辑**：

```ts
// 周二 18:00 Cron 追加站内通知：
async function sendSurveyIncompleteNotifications() {
  const weekOf = getCurrentWeekOf();
  const incompleteUsers = await db.select({ id: users.id }).from(users)
    .where(and(
      eq(users.isParticipating, true),
      eq(users.surveyComplete, false),
    ));

  for (const u of incompleteUsers) {
    await notificationService.createNotification({
      userId: u.id,
      type: 'survey_incomplete',
      title: '问卷尚未完成',
      body: '完成问卷才能参与本周匹配，请尽快填写。',
      level: 'warning',
      actionUrl: '/survey',
      meta: { weekOf },
      idempotencyKey: `notif:${u.id}:survey_incomplete:week_${weekOf}`,
    });
  }
}

// 问卷版本升级入口（由管理员触发或代码部署触发）：
async function sendSurveyUpdateRequiredNotifications(newVersion: string) {
  const outdatedUsers = await db.select({ id: users.id }).from(users)
    .innerJoin(surveyAnswers, eq(users.id, surveyAnswers.userId))
    .where(and(
      eq(users.isParticipating, true),
      ne(surveyAnswers.version, newVersion),
    ));

  for (const u of outdatedUsers) {
    await notificationService.createNotification({
      userId: u.id,
      type: 'survey_update_required',
      title: '问卷版本已更新',
      body: '问卷进行了升级，请重新填写以参与匹配。',
      level: 'info',
      actionUrl: '/survey',
      meta: { surveyVersion: newVersion },
      idempotencyKey: `notif:${u.id}:survey_update_required:v${newVersion}`,
    });
  }
}
```

#### 3.3 举报系统（Report → Notification）

```
举报状态机（userReports.status）：

  用户提交举报
  ────────────> PENDING ──┬── dismissed ──────> DISMISSED  (终态，无惩罚)
                          │
                          ├── request_evidence ─> PENDING (不变，仅发邮件)
                          │
                          ├── warn_update ─────> WARN_UPDATE (终态，无惩罚，双方通知)
                          │
                          └── reviewed ────────> REVIEWED   (终态，信用惩罚，双方通知)

  ★ 标记的转换为通知触发点
```

| 业务状态转换 | 通知类型 | 通知对象 | 幂等键格式 |
|---|---|---|---|
| `PENDING → reviewed` ★ | `report_result` | 举报者 + 被举报者 | `notif:{uid}:report_result:report_{reportId}` |
| `PENDING → warn_update` ★ | `report_result` | 举报者 + 被举报者 | `notif:{uid}:report_result:report_{reportId}` |
| `PENDING → dismissed` | `report_result` | 仅举报者 | `notif:{uid}:report_result:report_{reportId}` |
| `PENDING → request_evidence` | **不写通知** | — | — |

**触发逻辑（在 `PATCH /admin/reports/:id` 路由内）**：

```ts
// 在审核逻辑内，status 更新并 COMMIT 前追加：

// 辅助函数：向单个用户发送举报结果通知
async function sendReportResultNotification(
  userId: string,
  reportId: string,
  outcome: 'reviewed' | 'dismissed' | 'warn_update',
) {
  await notificationService.createNotification({
    userId,
    type: 'report_result',
    title: outcome === 'reviewed' ? '举报已受理' :
           outcome === 'warn_update' ? '举报处理结果' : '举报已驳回',
    body: outcome === 'reviewed'
      ? '经核实，你提交的举报已受理，相关处理已执行。'
      : outcome === 'warn_update'
      ? '经核实，被举报用户已被要求修改资料。'
      : '经核实，你提交的举报已被驳回。',
    level: outcome === 'reviewed' ? 'success' :
           outcome === 'warn_update' ? 'warning' : 'info',
    actionUrl: '/notifications',
    meta: { reportId, outcome },
    idempotencyKey: `notif:${userId}:report_result:report_${reportId}`,
  });
}

// 审核后调用：
const notifyTargets = [report.reporterId];
if (newStatus === 'reviewed' || newStatus === 'warn_update') {
  notifyTargets.push(report.reportedUserId);
}
for (const uid of notifyTargets) {
  await sendReportResultNotification(uid, report.id, newStatus);
}
```

#### 3.4 Heartbox 互选系统（Heartbox → Notification）

```
Heart Signal 状态机（heartSignals.status）：

  createOrReplaceHeartSignal()
  ──────────────────────────> ACTIVE ──┬── cancelActiveHeartSignal() ──> CANCELLED (7 天冷却)
                                        │
                                        │ 检测到双向信号
                                        │ (reverse signal = ACTIVE)
                                        ▼
                                      MATCHED ──> 创建 heartMatch ──> heartMatches.status = ACTIVE

  ★ 双向匹配成功触发通知
```

| 业务状态转换 | 通知类型 | 通知对象 | 幂等键格式 |
|---|---|---|---|
| 双向信号匹配成功（`ACTIVE → MATCHED`）★ | `match_mutual_success` | 双方各一条 | `notif:{uid}:match_mutual_success:match_{heartMatchId}` |

**触发逻辑（在 `createOrReplaceHeartSignal()` 内）**：

```ts
// 在 heartSignals 更新为 matched 且 heartMatch 创建后追加：
if (matched && heartMatch) {
  const pair = [heartMatch.userAId, heartMatch.userBId];
  for (const uid of pair) {
    await notificationService.createNotification({
      userId: uid,
      type: 'match_mutual_success',
      title: '双向奔赴成功！',
      body: '你们互相选择了对方，快去看看吧！',
      level: 'success',
      actionUrl: '/reveal',
      meta: { matchId: heartMatch.id, source: 'heartbox' },
      idempotencyKey: `notif:${uid}:match_mutual_success:match_${heartMatch.id}`,
    });
  }
}
```

**与主匹配通知的区别**：Heartbox 的 `match_mutual_success` 与主匹配共用同一通知类型，通过 `meta.source = 'heartbox'` 区分来源。前端可据此展示不同的跳转逻辑或标签。

---

### 状态机四：定时任务触发编排（Cron → Notification Orchestration）

定时任务是消息中心的重要通知来源。以下是完整的 Cron 触发编排图：

```
时间轴（北京时间 UTC+8）：

  周二 18:00 ─── sendSurveyIncompleteNotifications() ──> survey_incomplete
                  │
                  │ 查询: isParticipating=true AND surveyComplete=false
                  │ 写入: 批量 createNotification + 幂等键
                  │

  周三 20:00 ─── unlockCurrentWeekMatches() ──> match_revealed | match_no_result
                  │
                  │ 1. 更新 matches.status: LOCKED → REVEALED
                  │ 2. 写入站内通知（在同一个事务/紧随其后）
                  │    - 有匹配用户 → match_revealed
                  │    - 无匹配用户 → match_no_result
                  │

  周五 18:00 ─── warnExpiringMatches() ──> match_expiring
                  │
                  │ 查询: matches.status=REVEALED AND userAAction IS NULL/...
                  │ 写入: 给未操作用户发 match_expiring
                  │

  每日 03:00 ─── cleanupExpiredNotifications()
                  │
                  │ UPDATE notifications SET deleted_at = NOW()
                  │ WHERE expires_at < NOW() AND deleted_at IS NULL
                  │ RETURN COUNT(*) → 记录日志
                  │
```

**事件驱动触发（非 Cron）**：

```
  用户操作 ─── recordAction() ─── 双方 ACCEPT ──> match_mutual_success
  用户操作 ─── createOrReplaceHeartSignal() ─── 双向信号 ──> match_mutual_success (source: heartbox)
  管理员 ─── PATCH /admin/reports/:id ─── reviewed/warn_update ──> report_result
  管理员 ─── POST /admin/notifications/broadcast ──> enqueueBroadcastTask ──> system_announcement / policy_update
  管理员 ─── 问卷版本升级 ──> survey_update_required
```

---

### 状态机约束与一致性保证

#### 事务一致性

| 场景 | 事务策略 | 说明 |
|------|----------|------|
| `unlockCurrentWeekMatches()` 写通知 | **同事务** | 匹配状态更新 + 通知写入在同一事务内，保证一致性 |
| `recordAction()` 写通知 | **同事务** | 匹配状态变为 MUTUAL + 通知写入在同一事务内 |
| `createOrReplaceHeartSignal()` 写通知 | **同事务** | 信号状态 + heartMatch + 通知在同一事务内 |
| Cron 批量写入 `survey_incomplete` | **批量事务** | 按用户分批写入，每批 50 条，单条失败不影响其他用户 |
| `warnExpiringMatches()` 写通知 | **批量事务** | 同上 |
| Admin 审核举报写通知 | **同事务** | 举报状态更新 + 通知写入在同一事务内 |
| 广播 Worker 分批写入 | **独立事务/批** | 每批 200 条独立提交，单批失败仅影响该批 |

#### 幂等性保证

所有通知写入均通过 `idempotency_key` 唯一约束保证幂等：

```sql
INSERT INTO notifications (id, user_id, type, ..., idempotency_key)
VALUES (...)
ON CONFLICT (idempotency_key) DO NOTHING;
```

**幂等键构造统一规范**：

```ts
// 建议在 notificationService.ts 内提供辅助函数
export function buildIdempotencyKey(
  userId: string,
  type: NotificationType,
  scope: string,
): string {
  return `notif:${userId}:${type}:${scope}`;
}

// scope 由调用方按业务语义构造：
// 匹配揭晓:  `week_2026-06-03`
// 双向成功:  `match_abc123`
// 问卷未完成: `week_2026-06-03`
// 举报结果:   `report_xyz789`
// 广播投递:   `bcast_task001`
```

#### 状态机守卫总结

| 守卫 | 位置 | 目的 |
|------|------|------|
| `ON CONFLICT DO NOTHING` | `notificationService.createNotification()` | 防止同一事件重复写入 |
| `UPDATE WHERE status = 'pending'` | `broadcastWorker` | 乐观锁防多实例竞态 |
| `match.status !== 'REVEALED'` → reject | `matchService.recordAction()` | 非揭晓状态不可操作 |
| `report.status !== 'pending'` → reject | Admin 审核接口 | 已处理的举报不可重复审核 |
| `expires_at < NOW() AND deleted_at IS NULL` | `cleanupExpiredNotifications()` | 仅清理已过期且未清理的消息 |
| `is_read = false` | `markAsRead()` | 已读消息不再重复更新 |

---

### 状态机实现检查清单（供 Code Review）

- [ ] 每个通知写入点使用 `buildIdempotencyKey()` 构造幂等键，不硬编码字符串
- [ ] 匹配揭晓通知在 `unlockCurrentWeekMatches()` 同事务内写入
- [ ] `recordAction()` 仅在 `newStatus === 'MUTUAL'` 时写通知，MISSED/EXPIRED 不写
- [ ] `warnExpiringMatches()` 仅向未操作用户（`userAction IS NULL`）发 `match_expiring`
- [ ] Heartbox 互选通知 `meta.source = 'heartbox'`，与主匹配 `source: 'weekly'` 区分
- [ ] 举报审核 `request_evidence` 不触发 `report_result` 通知
- [ ] `survey_incomplete` 仅对 `isParticipating = true` 且 `surveyComplete = false` 的用户写入
- [ ] 广播 Worker 抢锁使用 `UPDATE ... WHERE status = 'pending' RETURNING` 而非先查后更
- [ ] 清理任务不物理删除，仅标记 `deleted_at`
- [ ] 所有通知写入点所在函数添加单元测试，断言 `notifications` 表存在对应行
