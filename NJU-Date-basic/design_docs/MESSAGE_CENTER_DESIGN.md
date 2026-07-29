# 站内消息中心设计说明

> 状态：设计已定
> 主责组：第一组
> 协作组：第三组提供治理类消息源，第二组后续可接圈子事件

## 1. 文档目的

本文用于明确“站内消息 / 消息中心”这个模块到底归谁做、最小版本做什么，以及三组在这个模块里的边界。

一句话定义：

- 第一组负责用户侧消息中心本体
- 第三组负责公告、政策更新、举报处理结果等治理类消息源
- 第二组后续如果有圈子事件提醒，只接入统一消息中心，不单独再做一套“圈子信箱”

## 2. 模块目标

站内消息中心用于集中承载平台内所有对用户重要、可回看的提醒，包括：

1. 匹配结果相关提醒
2. 问卷状态与版本更新提醒
3. 平台公告与政策更新提醒
4. 举报 / 治理处理结果提醒

目标不是替代邮件，而是形成一个**站内可回看、可追踪、可标记已读**的统一消息入口。邮件仍然可以作为补充触达渠道。

## 3. 三组边界

| 组别 | 在站内消息模块中的职责 |
|---|---|
| 第一组 | 负责消息中心页面、未读数、已读状态、消息跳转、与主匹配链路相关的消息入站 |
| 第二组 | 后续如有圈子匹配、好友申请、联系方式解锁等事件，只向统一消息中心提供事件，不另做独立信箱 |
| 第三组 | 负责平台公告、政策更新、举报处理结果等治理类消息的内容规则与入站来源 |

明确边界：

- 第一组做“消息中心本体”
- 第三组做“治理类消息内容规则和来源”
- 第二组不做第二套消息列表页

## 4. MVP 范围

最小版本建议只做这些能力：

1. 消息列表页
2. 未读数与红点 / 角标
3. 单条已读
4. 全部已读
5. 点击消息后跳转到对应页面

MVP 不做：

1. 用户之间互发私信
2. 多级文件夹 / 会话分类
3. 复杂搜索
4. 已删除消息回收站

## 5. 第一阶段消息类型

| 类型 | 含义 | 主消息源 | 建议跳转 |
|---|---|---|---|
| `match_revealed` | 本周匹配已揭晓 | 第一组 | `/reveal` |
| `match_no_result` | 本周暂未匹配成功 | 第一组 | `/dashboard` 或 `/reveal` |
| `match_mutual_success` | 双向愿意，已建立连接 | 第一组 | `/reveal` 或历史页 |
| `match_expiring` | 本期匹配即将过期，请尽快选择 | 第一组 | `/reveal` |
| `survey_update_required` | 问卷版本更新，需要重新填写 | 第一组 | `/survey` |
| `survey_incomplete` | 问卷尚未完成，暂无法参与匹配 | 第一组 | `/survey` |
| `policy_update` | 用户协议 / 隐私政策 / 平台规则更新 | 第三组 | 对应政策页 |
| `system_announcement` | 系统公告、活动通知、维护通知 | 第三组 | 公告详情页或首页 |
| `report_result` | 举报处理结果通知 | 第三组 | 消息详情或安全中心 |

说明：

- 第一组主责“匹配主线相关消息”
- 第三组主责“治理类 / 制度类消息”
- 第二组后续如果接圈子事件，建议扩展类型如 `circle_match_revealed`、`friend_request_received`，但仍复用同一消息中心

## 6. 页面与交互约定

建议入口：

1. Dashboard / 顶部导航放消息入口
2. 未读时显示红点或数字角标
3. 列表页支持按 `全部 / 未读` 查看

建议列表项字段：

1. 标题
2. 摘要
3. 时间
4. 类型标签
5. 是否已读
6. 点击后的跳转地址

## 7. API 契约（设计已定）

> 所有 `/api/v1/notifications` 接口均需携带有效 JWT（`Authorization: Bearer <token>`），否则返回 401。

### 7.1 GET `/api/v1/notifications`

功能：分页获取当前用户的站内消息。

查询参数：

- `page`
- `limit`
- `status=all|unread|read`

响应示例：

```json
{
  "total": 18,
  "page": 1,
  "limit": 20,
  "items": [
    {
      "id": "notif_001",
      "type": "match_revealed",
      "title": "本周锦书已送达",
      "body": "你本周的匹配结果已经揭晓，点击查看。",
      "level": "info",
      "isRead": false,
      "actionUrl": "/reveal",
      "createdAt": "2026-04-21T12:00:00.000Z",
      "readAt": null,
      "meta": {
        "weekOf": "2026-04-16"
      }
    }
  ]
}
```

### 7.2 GET `/api/v1/notifications/unread-count`

功能：获取当前用户未读消息数。

响应示例：

```json
{
  "unreadCount": 3
}
```

### 7.3 POST `/api/v1/notifications/:id/read`

功能：将单条消息标记为已读。

响应示例：

```json
{
  "message": "消息已标记为已读"
}
```

### 7.4 POST `/api/v1/notifications/read-all`

功能：将当前用户全部未读消息标记为已读。

响应示例：

```json
{
  "message": "已全部标记为已读",
  "updated": 6
}
```

### 7.5 Admin 广播接口（仅限内部受限角色）

#### POST `/api/v1/admin/notifications/broadcast`

功能：向全部或指定用户批量写入治理类消息（`policy_update` / `system_announcement`）。第三组通过此接口发布公告，不直接操作 `notifications` 表。

**重要：广播为异步入队，不同步写入。** 接口立即返回任务 ID，实际写入由后台 worker 完成，防止大用户量时同步写入导致请求超时或锁表。

权限说明：

- 长期目标：由后台受限角色（如 `marketing_operator`、`super_admin`）调用
- 当前过渡阶段：如果后台角色系统尚未落地，可暂由项目负责人通过内部管理员鉴权代执行
- 不向宣传、客服、运营等跨部门同学直接发放 `admin_key`

完整权限设计见：`design_docs/ADMIN_PERMISSION_MODEL.md`

请求体：

```json
{
  "type": "system_announcement",
  "title": "平台维护通知",
  "body": "将于 2026-05-01 00:00–06:00 进行维护，期间服务不可用。",
  "level": "warning",
  "actionUrl": "/announcements/001",
  "targetUserIds": null,
  "expiresAt": "2026-05-02T00:00:00.000Z"
}
```

说明：

- `targetUserIds` 为 `null` 表示广播给全部用户；传数组则精确投递。
- `level` 可选值：`info / success / warning / critical`。
- 幂等键构造：`broadcast:{type}:{title}:{targetScope}`（`targetScope` 为 `all` 或 `userIds` 的排序拼接哈希），防止管理员重复点击触发重复广播。
- **速率限制**：同一管理员账号 10 分钟内最多触发 3 次广播，超出返回 429。
- 广播任务由后台 worker 按批次写入（如每批 200 条），写入时对每条按 `idempotency_key` 做 `INSERT OR IGNORE`。

响应示例（立即返回，任务异步执行）：

```json
{
  "message": "广播任务已提交",
  "taskId": "broadcast_task_abc123",
  "estimatedCount": 1024
}
```

#### GET `/api/v1/admin/notifications/broadcast/:taskId`

功能：查询广播任务进度。

响应示例：

```json
{
  "taskId": "broadcast_task_abc123",
  "status": "completed",
  "created": 1024,
  "skipped": 3,
  "finishedAt": "2026-05-01T10:05:30.000Z"
}
```

`status` 枚举：`pending / running / completed / failed`

## 7.6 消息写入约定（内部服务调用）

以下消息类型不经由 Admin 接口，而是由后端定时任务或业务事件在服务内部直接写入 `notifications` 表。

**幂等键统一规范**：`idempotency_key` 字段存储一个字符串，由各消息类型按固定格式拼接而成，数据库设置唯一约束（`UNIQUE`）。插入前不需要先查询，直接 `INSERT ... ON CONFLICT (idempotency_key) DO NOTHING`。

| 触发时机 | 写入的消息类型 | `idempotency_key` 构造方式 |
|---|---|---|
| 周三 20:00 Cron（揭晓后） | `match_revealed` 或 `match_no_result` | `notif:{user_id}:{type}:week_{week_of}` |
| 双方均 ACCEPT 时（事件） | `match_mutual_success` | `notif:{user_id}:match_mutual_success:match_{match_id}` |
| 周五 18:00 Cron（提前预警） | `match_expiring` | `notif:{user_id}:match_expiring:week_{week_of}` |
| 周二 18:00 Cron | `survey_incomplete` | `notif:{user_id}:survey_incomplete:week_{week_of}` |
| 问卷版本升级时（事件） | `survey_update_required` | `notif:{user_id}:survey_update_required:v{survey_version}` |
| 管理员审核举报后（事件） | `report_result` | `notif:{user_id}:report_result:report_{report_id}` |
| 广播（Admin 接口） | `policy_update` / `system_announcement` | `notif:{user_id}:{type}:bcast_{taskId}` |

说明：

- 所有写入使用 `INSERT ... ON CONFLICT (idempotency_key) DO NOTHING`，已存在则静默跳过。
- `match_expiring` 与 `match_revealed` 使用同一 `week_of` 但类型不同，key 不重叠，互不冲突。
- `report_result` 由 `PATCH /api/v1/admin/reports/:id` 审核动作（`status` 更新为 `reviewed` 或 `warn_update`）自动触发，无需 Admin 手动发送。广播的幂等键以 `taskId` 区分不同广播批次，防止同一广播重跑重复写入。

## 8. 数据模型建议

建议新增 `notifications` 表：

| 字段 | 说明 |
|---|---|
| `id` | 消息主键 |
| `user_id` | 接收消息的用户 |
| `type` | 消息类型（见第5节枚举） |
| `title` | 标题 |
| `body` | 摘要正文 |
| `level` | `info / success / warning / critical` |
| `action_url` | 点击后跳转路径 |
| `meta` | 附加 JSON 信息（schema 见下方） |
| `is_read` | 是否已读 |
| `read_at` | 已读时间 |
| `expires_at` | 可选，到期后软删除（`deleted_at` 标记，不物理删除，保留审计） |
| `deleted_at` | 软删除时间，NULL 表示未删除 |
| `created_at` | 创建时间 |
| `idempotency_key` | 幂等键（UNIQUE 约束），构造规范见第 7.6 节 |

> **`source` 字段已移除**：来源模块可直接从 `type` 推导（如 `match_*` → match 模块），维护两个字段容易出现不一致，前端按 `type` 分组即可。

### 8.1 `meta` 字段 Schema 规范

`meta` 是 JSON 字段，各消息类型的结构约束如下：

| `type` | `meta` 结构 |
|---|---|
| `match_revealed` / `match_no_result` / `match_expiring` | `{ "weekOf": "YYYY-MM-DD" }` |
| `match_mutual_success` | `{ "matchId": "uuid" }` |
| `survey_update_required` | `{ "surveyVersion": "v4" }` |
| `survey_incomplete` | `{ "weekOf": "YYYY-MM-DD" }` |
| `report_result` | `{ "reportId": "uuid", "outcome": "reviewed" \| "dismissed" \| "warn_update" }` |
| `policy_update` / `system_announcement` | `{ "broadcastTaskId": "broadcast_task_xxx" }` |

不在上述列表中的类型，`meta` 可为 `null` 或空对象 `{}`。

## 9. 未读数刷新策略（MVP 选择）

MVP 阶段采用**客户端轮询**方式更新未读数角标：

- 前端每 60 秒调用一次 `GET /api/v1/notifications/unread-count`
- 用户打开消息中心页面时立即调用一次
- **速率限制**：`unread-count` 接口对单用户限制每分钟最多 5 次，防止前端 bug 导致频繁轮询（60 秒一次的正常频率不会触发此限制）
- 后续优化路径：用户量增长后可接入 Redis 缓存未读数（写入时 `INCR`，已读时 `DECR`），彻底避免数据库热点查询；再之后可升级为 SSE 推送，移除轮询

不在 MVP 内实现 WebSocket / SSE 实时推送，待用户量增长后按需升级。

## 10. 定时任务（与 API_SPEC.md Cron 表对应）

| 时间 | 与通知模块相关的任务 |
|---|---|
| 周二 18:00 | 写入 `survey_incomplete` 消息（问卷未完成的用户） |
| 周三 20:00 | 揭晓后写入 `match_revealed` 或 `match_no_result` |
| 周五 18:00 | 写入 `match_expiring` 消息（48 小时窗口剩余约 26 小时时预警） |
| 每日 03:00 | 清理 `expires_at < now()` 的消息（软删除或物理删除，视存储需求决定） |

## 11. 与现有”邮件通知”能力的关系

当前仓库里的 `PATCH /api/v1/user/notifications` 仅用于切换**邮件提醒开关**，不是站内消息接口。

因此要明确区分：

- `/user/notifications`：邮件偏好设置
- `/notifications/*`：站内消息中心

两者可以并存：

1. 站内消息用于平台内可回看记录
2. 邮件用于异步触达和补充提醒

注意：部分消息类型（如 `match_revealed`、`survey_incomplete`）会同时触发邮件和站内消息，两者使用各自的幂等键独立去重，互不干扰。

## 12. 一句话结论

如果要用最短的话说清楚：

- 第一组做“消息中心本体”
- 第三组做“治理类消息源”
- 第二组后续接入圈子事件，但不单独做第二套信箱
