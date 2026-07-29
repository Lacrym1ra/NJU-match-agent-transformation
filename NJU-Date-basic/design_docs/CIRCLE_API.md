# CIRCLE API（第二组当前状态）

本文只记录第二组负责的圈子、圈内关系、位置、组队入口和 livechat 相关接口。圈内匹配属于第一组，本文不维护其接口说明。

当前后端统一挂载在 `/api/v1`，圈子接口前缀为 `/api/v1/circles`。除公开说明的组队分享页外，本文接口均需要登录态。

## 数据模型

### Circle

| 字段 | 说明 |
| --- | --- |
| `id` | 圈子 UUID |
| `name` / `description` | 名称与简介 |
| `category` / `tags` | 分类与标签 |
| `creatorId` | 创建者；当前也作为圈主判定来源 |
| `joinPolicy` | `public` / `review` / `invite` |
| `status` | `pending_review` / `active` / `archived` 等 |
| `isActive` | 是否对普通用户可见、可加入 |
| `memberCount` / `maxMembers` | 当前人数与容量 |
| `department` / `grade` | 可选筛选字段 |

自定义圈子创建后默认进入 `pending_review`、`isActive=false`，需要审核激活后才进入普通列表。

### Membership

`circle_members` 记录用户和圈子的关系。普通成员能力依赖 `membershipStatus=active` 与 `isActive=true`。圈主不能直接退出圈子，需要先转让或归档圈子。

### Join Request

审核制圈子使用 `circle_join_requests`，待审核请求有效期为 7 天。

| 状态 | 说明 |
| --- | --- |
| `pending_review` | 等待圈主审核 |
| `approved` | 已批准 |
| `rejected` | 已拒绝 |
| `expired` | 已过期 |
| `withdrawn` | 用户已撤回 |

### Circle Cards

| 类型 | 来源 | 说明 |
| --- | --- | --- |
| A 卡 | 用户基础资料 | 加入圈子时初始化 |
| B 卡 | `circle_questions` 组件定义 + `user_circle_cards.components` | 圈内展示字段、频道标签来源 |
| C 卡 | 用户自定义扩展 | 由名片模块维护 |

频道标签来自 `circle_questions.isChannelTag=true` 且用户对应组件为公开状态的数据。旧问卷答案不再作为频道标签来源。

## 圈子列表与详情

### `GET /api/v1/circles`

获取当前用户可加入的活跃圈子列表。接口会排除用户已经存在成员关系的圈子。

Query：

| 参数 | 说明 |
| --- | --- |
| `category` | 按分类筛选 |
| `keyword` | 名称/简介关键词 |
| `tags` / `tag` | 标签筛选 |
| `department` | 院系筛选 |
| `grade` | 年级筛选 |
| `sort` | `recommended` / `active` / `members` / `latest` |
| `page` / `limit` | 分页 |

### `GET /api/v1/circles/:circleId`

获取圈子详情。普通用户只能查看已激活圈子；圈主可以查看自己创建但未激活的圈子。

返回包含 `circle`、`components`、`membership`、`viewerPermissions`。当前管理权限只对圈主开放。

## 创建与加入

### `POST /api/v1/circles`

创建自定义圈子。当前每个用户最多可创建 5 个自定义圈子。

常用 Body：

| 字段 | 说明 |
| --- | --- |
| `name` / `description` | 名称与简介 |
| `category` / `tags` | 分类与标签 |
| `joinPolicy` | 默认 `review` |
| `maxMembers` | 最大人数 |
| `questions` / `components` | B 卡组件配置 |

### `POST /api/v1/circles/:circleId/join`

申请或加入圈子。

| `joinPolicy` | 行为 |
| --- | --- |
| `public` | 直接创建 active 成员关系 |
| `review` | 创建 `pending_review` 加入申请 |
| `invite` | 校验邀请码后加入 |

审核制返回会包含 `membershipStatus=pending`、`requestStatus=pending_review`、`requestId` 和 `expiresAt`。

### `DELETE /api/v1/circles/:circleId/leave`

退出圈子。可传：

| 字段 | 说明 |
| --- | --- |
| `clearTrace` | 是否清理该圈内名片、位置、联系人授权、待处理申请等痕迹 |
| `silent` | 是否静默处理部分通知 |

退出会同步清理当前位置、圈内关系、圈内联系人授权，并处理该圈内仍关联的组队关系。圈主不能通过该接口退出。

### `PATCH /api/v1/circles/:circleId/status`

启用或停用当前用户在圈内的活跃状态。停用时会删除当前位置。

```json
{
  "isActive": false
}
```

## 我的圈子与申请

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/v1/circles/my` | 当前用户已经加入的圈子 |
| `GET` | `/api/v1/circles/my-created` | 当前用户创建的圈子 |
| `GET` | `/api/v1/circles/join-requests/sent` | 当前用户发出的加入申请 |
| `PUT` | `/api/v1/circles/join-requests/:requestId/withdraw` | 撤回自己的待审核加入申请 |

## 圈主管理

以下接口当前只允许圈主访问。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/v1/circles/:circleId/manage/overview` | 管理概览 |
| `PATCH` | `/api/v1/circles/:circleId` | 更新基础信息 |
| `PUT` | `/api/v1/circles/:circleId/join-policy` | 更新加入策略 |
| `GET` | `/api/v1/circles/:circleId/manage/members` | 管理成员列表 |
| `DELETE` | `/api/v1/circles/:circleId/members/:userId` | 移除成员 |
| `GET` | `/api/v1/circles/:circleId/join-requests` | 查看加入申请 |
| `PUT` | `/api/v1/circles/:circleId/join-requests/:requestId` | 审核加入申请 |
| `PUT` | `/api/v1/circles/:circleId/requests/:requestId` | 审核加入申请兼容路径 |
| `POST` | `/api/v1/circles/:circleId/transfer-owner` | 转让圈主 |
| `DELETE` | `/api/v1/circles/:circleId` | 归档圈子 |
| `GET` | `/api/v1/circles/:circleId/audit-logs` | 审计日志 |

黑名单：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/v1/circles/:circleId/blacklist` | 查看黑名单 |
| `POST` | `/api/v1/circles/:circleId/blacklist` | 加入黑名单 |
| `DELETE` | `/api/v1/circles/:circleId/blacklist/:userId` | 移出黑名单 |

加入黑名单会拒绝待审核申请并移除现有成员。

## 圈内位置

位置功能只对 active 成员开放。位置记录有 24 小时 TTL，更新间隔至少 30 秒，`accuracy` 最大 1000 米。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/v1/circles/:circleId/location/me` | 查看自己的圈内位置状态 |
| `PUT` | `/api/v1/circles/:circleId/location` | 更新圈内位置 |
| `DELETE` | `/api/v1/circles/:circleId/location` | 关闭并删除当前位置 |

## 圈内频道

### `GET /api/v1/circles/:circleId/channel`

获取圈内频道成员列表。

Query：

| 参数 | 说明 |
| --- | --- |
| `nearby` | 是否按附近成员模式返回 |
| `radius` | 距离半径，100 到 50000 米，默认 50000 |
| `includeUnknownDistance` | 是否包含无法计算距离的成员 |

附近模式要求当前用户已有有效位置。返回的标签来自公开 B 卡组件。

## 旧问卷兼容接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/v1/circles/:circleId/questionnaire` | 返回 `deprecated=true`、组件定义和旧答案 |
| `POST` | `/api/v1/circles/:circleId/questionnaire` | 写入旧答案并返回 `deprecated=true` |

新前端应优先使用名片模块维护 A/B/C 卡。

## Livechat 入口

圈子详情页可进入 `/circles/:id/livechat`。聊天 HTTP API 不在频道接口下，而是在：

| 场景 | HTTP 路径 |
| --- | --- |
| 圈子聊天室 | `/api/v1/circles/:circleId/chat/messages` |
| 组队聊天室 | `/api/v1/circles/:circleId/teamups/:teamupId/chat/messages` |

实时事件通过 WebSocket 加入 `circle` 或 `teamup` room。详见 `design_docs/G2_REALTIME_CHAT_IMPLEMENTATION.md`。

## 前端已接入路径

| 路由 | 说明 |
| --- | --- |
| `/circles` | 圈子列表 |
| `/circles/:id` | 圈子详情 |
| `/circles/:id/manage` | 圈主管理 |
| `/circles/:id/forum` | 圈内论坛入口 |
| `/circles/:id/teamups` | 圈内组队列表 |
| `/circles/:id/create-teamup` | 创建组队 |
| `/circles/:id/teamups/:teamupId` | 组队详情 |
| `/circles/:id/livechat` | 圈子 livechat |

前端封装位于 `frontend/src/api/circles.ts`、`frontend/src/api/teamups.ts` 和 `frontend/src/api/chat.ts`。
