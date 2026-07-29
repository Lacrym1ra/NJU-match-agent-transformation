# 三组统一 API 协作总览

> 版本：v1.3 | 日期：2026-04-27

## 1. 文档目的

本文用于解决三类混淆：

1. 哪些接口已经真实存在，哪些还只是设计稿
2. 三组分别该看哪份 API 文档
3. 第二组圈子能力与第三组论坛治理能力的边界在哪里
4. 谁负责“圈子接入论坛”这条跨组链路
5. 谁负责“站内消息中心”，谁只负责提供消息来源

如果想看“产品模块归谁做”，不是看接口归属，请先看 `design_docs/GROUP_RESPONSIBILITIES.md`。

适用对象：

- 第一组：用户主线与互动建立组
- 第二组：圈子与关系链组
- 第三组：论坛与治理组

## 2. 文档使用顺序

所有同学统一按这个顺序看文档：

1. 先看本文，确认自己负责的接口边界
2. 再看本组专属文档
3. 最后对照真实后端路由文件

对应关系：

| 组别 | 先看什么 | 再看什么 | 最终以后端为准 |
|---|---|---|---|
| 第一组 | 本文 | `API_SPEC.md`、`design_docs/MESSAGE_CENTER_DESIGN.md`、`design_docs/REPORT_BLOCK_DESIGN.md` | `backend/src/routes/auth.ts`、`user.ts`、`survey.ts`、`match.ts` |
| 第二组 | 本文 | `design_docs/CIRCLE_API.md`、`design_docs/CIRCLE_MODULE_PLAN.md`、`design_docs/ADMIN_BACKEND_UPDATE_PLAN.md` | `backend/src/routes/circle.ts`、`card.ts`、`friend.ts`、`contacts.ts` |
| 第三组 | 本文 | `design_docs/FORUM_GOVERNANCE_API.md`、`design_docs/REPORT_BLOCK_DESIGN.md`、`design_docs/PLATFORM_GOVERNANCE_DESIGN.md`、`design_docs/ADMIN_PERMISSION_MODEL.md` | `backend/src/routes/admin.ts`、`user.ts` |

## 3. 状态标记

本文档统一使用以下状态：

- `已实现`：后端已注册路由，可联调
- `设计已定`：文档和接口契约已明确，但后端还没注册路由
- `预留`：方向明确，但不作为当前迭代开工依据

## 4. 当前真实已注册路由

以下内容来自 `backend/src/index.ts`，是当前真实可访问的接口前缀：

| 路由前缀 | 当前状态 | 主要归属 |
|---|---|---|
| `/api/v1/auth` | 已实现 | 第一组 |
| `/api/v1/user` | 已实现 | 第一组，举报/拉黑与第三组共用规则 |
| `/api/v1/survey` | 已实现 | 第一组 |
| `/api/v1/match` | 已实现 | 第一组 |
| `/api/v1/circles` | 已实现 | 第二组 |
| `/api/v1/admin` | 已实现 | 第三组主责，部分运维能力由负责人执行 |
| `/api/v1/card` | 已实现 | 第二组 |
| `/api/v1/friends` | 已实现 | 第二组 |
| `/api/v1/contacts` | 已实现 | 第二组 |
| `/api/v1/stats` | 已实现 | 公共接口 |

当前**还没有注册**以下前缀：

- `/api/v1/forum`
- `/api/v1/notifications`

这意味着：

- 第二组里“名片 / 好友 / 联系方式解锁”后端路由已经挂上，联调时仍以后端 `routes` 文件和 `design_docs/CIRCLE_API.md` 的最新契约为准
- 第三组里”论坛帖子 / 评论 / 论坛管理”**已全部实现**（Phase A 完成），详见 `design_docs/FORUM_GOVERNANCE_API.md`
- 第一组里”站内消息中心”目前也是设计已定，但后端路由还没挂上
- 前端不能把“设计中的接口”当成“后端已可调”的接口直接开写 mock 之外的联调代码

特别提醒：

- 当前已存在的 `PATCH /api/v1/user/notifications` 只是邮件提醒开关
- 它不是站内消息中心接口

## 5. 统一 API 规范

### 5.1 基础约定

- Base URL：`/api/v1`
- 用户鉴权：`Authorization: Bearer <token>`
- 管理鉴权：`X-Admin-Key: <admin_key>`
- ID 默认使用 UUID 字符串
- 时间字段统一返回 ISO 8601 字符串

### 5.2 错误响应

新接口统一遵循当前后端错误处理中间件的结构：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数不合法"
  }
}
```

如果有字段级错误，可追加：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数不合法",
    "details": [
      { "field": "email", "message": "邮箱格式错误" }
    ]
  }
}
```

### 5.3 分页响应

分页接口统一使用：

```json
{
  "total": 100,
  "page": 1,
  "limit": 20,
  "items": []
}
```

如果历史原因已经用 `reports`、`matches`、`friends` 等命名，当前可以保留，但新接口优先保证：

- 必有 `total`
- 必有 `page`
- 必有 `limit`
- 列表字段名要和资源名一致，不要随意变

### 5.4 变更规则

- 不允许前端自己发明返回字段
- 不允许第二组修改第三组的接口语义
- 不允许第二组单独发明 `/circles/:circleId/forum` 这类重复论坛接口
- 不允许第三组把论坛接口写进第二组文档，除非只是引用第二组提供的圈子上下文
- 如果接口还没实现，必须在文档里明确标记 `设计已定`

## 6. 三组接口边界

### 6.1 第一组接口范围

第一组主责：

- 认证
- 用户资料
- 问卷
- 主匹配
- 揭晓、历史记录
- 站内消息中心
- 用户侧举报 / 拉黑入口接入

第一组核心接口前缀：

- `/api/v1/auth`
- `/api/v1/user`
- `/api/v1/survey`
- `/api/v1/match`
- `/api/v1/notifications`（设计已定）

与第三组共享但由第一组接入前台的接口：

- `POST /api/v1/user/block/:targetId`
- `DELETE /api/v1/user/block/:targetId`
- `POST /api/v1/user/report/:targetId`

### 6.2 第二组接口范围

第二组主责：

- 圈子
- 圈子问卷
- 圈内匹配
- 名片系统
- 好友系统
- 联系方式解锁

第二组当前应看的主文档：

- `design_docs/CIRCLE_API.md`

特别说明：

- 第二组**不负责论坛接口本体**
- 第二组**不负责举报审核**
- 第二组只负责圈子侧的论坛入口接入，例如：
  - 圈子详情页里的“进入圈子论坛”
  - 圈子详情页里的“发布组队帖”
  - 把 `circleId`、`circleName` 透传给论坛页
- 第二组不要单独定义帖子模型、评论模型、删帖规则或管理接口
- 第二组可以在后续消费拉黑规则，但不能自行定义治理流程

### 6.3 第三组接口范围

第三组主责：

- 举报审核
- 管理后台治理面板
- 论坛帖子 / 评论 / 管理
- 审计与治理扩展

第三组当前应看的主文档：

- `design_docs/FORUM_GOVERNANCE_API.md`
- `design_docs/REPORT_BLOCK_DESIGN.md`

特别说明：

- 第三组不要把名片 / 好友 / 解锁接口写进论坛文档
- 第三组当前已可联调的是举报审核接口，注意举报状态枚举为四种：`pending / reviewed / warn_update / dismissed`
- 第三组负责论坛接口本体，以及 `circleId` 维度的圈子论坛接入
- 凡是 `/api/v1/forum/*` 接口、论坛页面、`circleId` 筛选、圈子成员发帖校验、圈子帖管理，都归第三组
- 帖子/评论举报接口（`POST /api/v1/forum/posts/:postId/report`）为预留设计，论坛路由落地时一并补全
- 第三组负责治理类消息广播（异步入队）和消息内容规则，但不负责消息中心页面本体
- 处罚/申诉/信用/账号状态/RBAC 均为第三组长期目标，完整设计见 `design_docs/PLATFORM_GOVERNANCE_DESIGN.md` 和 `design_docs/ADMIN_PERMISSION_MODEL.md`

### 6.4 站内消息边界

为了避免后续再混淆，统一按下面执行：

- 第一组负责消息中心页面、未读数、已读状态、跳转逻辑
- 第三组负责公告、政策更新、举报处理结果等治理类消息内容规则
- 第二组后续如果有圈子事件提醒，也接入统一消息中心，不单独做第二套消息列表
- 当前详细设计以 `design_docs/MESSAGE_CENTER_DESIGN.md` 为准

## 7. 当前三组接口状态总表

| 组别 | 模块 | 当前状态 | 主要文档 |
|---|---|---|---|
| 第一组 | Auth / User / Survey / Match | 已实现 | `API_SPEC.md` |
| 第一组 | Notifications / Inbox Center | 设计已定，未注册路由 | `design_docs/MESSAGE_CENTER_DESIGN.md` |
| 第一组 | 用户侧举报 / 拉黑入口 | 设计已定，前端待补 | `design_docs/REPORT_BLOCK_DESIGN.md` |
| 第二组 | Circles 基础接口 | 已实现 | `design_docs/CIRCLE_API.md` |
| 第二组 | Circle Channel | 设计已定，未注册路由 | `design_docs/CIRCLE_API.md` |
| 第二组 | Card / Friends / Contacts | 已注册，按实际路由联调 | `design_docs/CIRCLE_API.md` |
| 第二组 | 圈子页论坛入口接入 | 设计已定，依赖第三组论坛页契约 | `design_docs/CIRCLE_API.md` |
| 第三组 | 举报审核接口（4状态） | 已实现，需补 `warn_update` 状态和 zod 校验 | `design_docs/REPORT_BLOCK_DESIGN.md`、`design_docs/FORUM_GOVERNANCE_API.md` |
| 第三组 | 治理类通知广播（异步入队） | 设计已定，依赖消息中心契约 | `design_docs/MESSAGE_CENTER_DESIGN.md` 第 7.5 节 |
| 第三组 | 广播任务进度查询 | 设计已定，未实现 | `design_docs/MESSAGE_CENTER_DESIGN.md` 第 7.5 节 |
| 第三组 | Forum / Comment / Moderation | Phase A 已完成，全部路由已注册 | `design_docs/FORUM_GOVERNANCE_API.md` |
| 第三组 | Circle-scoped Forum Integration | Phase A 已完成，`circleId` 过滤已实现 | `design_docs/FORUM_GOVERNANCE_API.md` |
| 第三组 | 处罚体系 L1–L4（`user_violations` 表） | 设计已定，未实现 | `design_docs/PLATFORM_GOVERNANCE_DESIGN.md` 第 4 节 |
| 第三组 | 申诉工单（`user_appeals` 表） | 设计已定，未实现 | `design_docs/PLATFORM_GOVERNANCE_DESIGN.md` 第 6 节 |
| 第三组 | 账号状态字段（`account_status`） | 设计已定，未实现 | `design_docs/PLATFORM_GOVERNANCE_DESIGN.md` 第 7 节 |
| 第三组 | 多部门 RBAC（`admin_accounts` + `admin_sessions`） | 设计已定，未实现 | `design_docs/ADMIN_PERMISSION_MODEL.md` |
| 第三组 | 临时权限覆盖接口（`admin_permission_overrides`） | 设计已定，未实现 | `design_docs/ADMIN_PERMISSION_MODEL.md` 第 7.3 节 |

## 8. 开工建议

### 第一组

- 直接对接现有 `/api/v1/auth`、`/api/v1/user`、`/api/v1/survey`、`/api/v1/match`
- 用户侧举报 / 拉黑入口按 `design_docs/REPORT_BLOCK_DESIGN.md` 补前端

### 第二组

- 先以当前已实现的 `/api/v1/circles` 路由为联调基线
- `card / friends / contacts` 已挂载后端路由，联调前对照 `backend/src/routes/card.ts`、`friend.ts`、`contacts.ts`
- 圈子详情页可以先接“进入圈子论坛 / 发布组队帖”入口，但不要自己实现 `/api/v1/forum/*`

### 第三组

- 先用已实现的 `/api/v1/admin/reports` 与 `/api/v1/user/report` 做治理闭环
- 论坛模块 **Phase A 已完成**：全部路由已注册，两级评论、互动、匿名、公告、留言板、热榜、通知均已实现
- `circleId` 过滤、圈子组队帖入口、圈子成员发帖校验均已纳入论坛接口实现
