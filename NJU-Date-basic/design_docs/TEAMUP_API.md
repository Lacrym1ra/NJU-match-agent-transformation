# TeamUp API（第二组当前状态）

TeamUp 是挂在圈子下的组队功能。除公开摘要路由外，所有接口均需要登录态，并要求用户具备对应圈子的 active 成员身份或组队权限。

路径均省略 `/api/v1` 前缀。

## 当前开关

后端常量 `TEAMUP_FORUM_SYNC_ENABLED=false`。因此：

| 能力 | 当前行为 |
| --- | --- |
| 组队论坛同步 | 关闭，不会创建或更新论坛贴 |
| `isPublic` | 请求体可传，但服务端不会把它作为论坛公开能力启用 |
| 公开摘要 | `GET /teamups/public/:teamupId` 路由存在，但当前不能作为可用公开入口依赖 |

## 数据模型

### TeamUp

| 字段 | 说明 |
| --- | --- |
| `id` | 组队 UUID |
| `circleId` | 所属圈子 |
| `leaderId` | 组长 |
| `title` | 标题，最多 60 字符 |
| `description` | 描述，最多 2000 字符，不能包含手机号、微信、邮箱等联系方式 |
| `descriptionPreview` | 安全摘要 |
| `maxMembers` | 最大人数，至少 2 |
| `currentMemberCount` | 当前 active 成员数 |
| `deadlineAt` | 报名截止时间 |
| `endAt` | 组队结束时间 |
| `teamupType` | `short_term` / `long_term` |
| `joinMode` | `direct` / `approval` |
| `isPublic` | 公开标记；当前论坛同步关闭 |
| `status` | `recruiting` / `full` / `cancelled` |
| `effectiveStatus` | `recruiting` / `full` / `expired` / `ended` / `cancelled` |
| `joinable` | 当前用户是否可加入 |
| `waitlistable` | 是否可进入候补 |
| `waitlistCount` / `waitlistPosition` | 候补人数/排位 |
| `viewer` | 当前用户视角 |
| `members` / `leader` | 成员和组长摘要 |

### Contact

组队创建、加入、申请都需要提交 1 到 3 个联系方式：

```json
{
  "type": "wechat",
  "value": "nju-date",
  "label": "微信"
}
```

联系方式不允许写在组队描述里。

## 列表与详情

### `GET /circles/:circleId/teamups`

获取圈内可见组队列表。

Query：

| 参数 | 说明 |
| --- | --- |
| `page` / `limit` | 分页，`limit` 最大 50 |
| `mine` | `created` / `joined` / `applied` |
| `teamupType` | `short_term` / `long_term` / `all` |
| `keyword` | 标题或描述关键词 |
| `status` | 可按实际状态或有效状态筛选 |

返回 `{ "teamups": [], "total": 0 }`。

### `GET /circles/:circleId/teamups/my/history`

获取当前用户在该圈内的组队历史。

### `GET /circles/:circleId/teamups/:teamupId`

获取组队详情，返回 `{ "teamup": TeamUp }`。

### `GET /teamups/public/:teamupId`

公开安全摘要路由。当前论坛同步关闭时，不应把它作为主要访问入口。

## 创建与更新

### `POST /circles/:circleId/teamups`

创建组队。创建者会成为 leader，并写入自己的联系方式。

Body：

```json
{
  "title": "周末羽毛球",
  "description": "周六下午一起打球",
  "maxMembers": 4,
  "deadlineAt": "2026-06-13T08:00:00.000+08:00",
  "endAt": "2026-06-13T18:00:00.000+08:00",
  "teamupType": "short_term",
  "joinMode": "direct",
  "isPublic": false,
  "contacts": [
    { "type": "wechat", "value": "nju-date", "label": "微信" }
  ]
}
```

### `PATCH /circles/:circleId/teamups/:teamupId`

更新组队。可更新字段与创建字段一致，但均为可选。只有 leader 或具备管理权限的用户可操作。

## 加入、申请与候补

### `POST /circles/:circleId/teamups/:teamupId/join`

直接加入组队。用于 `joinMode=direct` 的组队。

Body：

```json
{
  "contacts": [
    { "type": "wechat", "value": "nju-date", "label": "微信" }
  ]
}
```

当组队已满但仍允许候补时，服务端会创建 `applicationType=waitlist` 的申请并返回候补相关字段。

### `POST /circles/:circleId/teamups/:teamupId/applications`

提交加入申请。用于 `joinMode=approval` 的组队，也可能在服务端判定时转为候补申请。

Body：

```json
{
  "applicationNote": "我可以带球拍",
  "contacts": [
    { "type": "wechat", "value": "nju-date", "label": "微信" }
  ]
}
```

当前没有独立候补路由；候补状态通过 `applicationType=waitlist`、`waitlistPosition`、`waitlistCount` 等字段体现。

## 申请管理

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/circles/:circleId/teamups/:teamupId/applications` | 组长查看申请列表 |
| `PATCH` | `/circles/:circleId/teamups/:teamupId/applications/:applicationId` | 组长审核申请 |
| `PUT` | `/circles/:circleId/teamups/:teamupId/applications/:applicationId/withdraw` | 申请人撤回自己的待处理申请 |
| `GET` | `/teamups/applications/replies` | 获取我发出的组队申请回复 |

审核 Body：

```json
{
  "action": "approve",
  "reviewNote": "欢迎加入"
}
```

`action` 为 `approve` 或 `reject`。

## 成员与取消

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `DELETE` | `/circles/:circleId/teamups/:teamupId/members/me` | 普通成员退出组队 |
| `POST` | `/circles/:circleId/teamups/:teamupId/cancel` | leader 取消组队 |

取消 Body：

```json
{
  "reason": "时间冲突",
  "cancelSource": "leader",
  "confirmCancel": true
}
```

退出后，服务端会根据候补队列自动递补。

## 联系方式

### `GET /circles/:circleId/teamups/:teamupId/contacts`

在服务端判定可见时返回组队成员联系方式。

返回：

```json
{
  "availableUntil": "2026-06-13T18:00:00.000+08:00",
  "members": []
}
```

前端应以 `teamup.viewer.canViewContacts` 和接口结果共同控制展示。

## 组队聊天

组队聊天复用 livechat：

| 方法 | 路径 |
| --- | --- |
| `GET` | `/circles/:circleId/teamups/:teamupId/chat/messages` |
| `POST` | `/circles/:circleId/teamups/:teamupId/chat/messages` |
| `DELETE` | `/circles/:circleId/teamups/:teamupId/chat/messages/:messageId` |
| `PUT` | `/circles/:circleId/teamups/:teamupId/chat/read-state` |

WebSocket 加入 room 时使用：

```json
{
  "type": "chat.join",
  "roomType": "teamup",
  "circleId": "circle uuid",
  "teamupId": "teamup uuid"
}
```

## 前端封装

前端封装位于 `frontend/src/api/teamups.ts`。

| 方法 | 路径 |
| --- | --- |
| `getTeamUps` | `GET /circles/:circleId/teamups` |
| `getTeamUpDetail` | `GET /circles/:circleId/teamups/:teamupId` |
| `createTeamUp` | `POST /circles/:circleId/teamups` |
| `updateTeamUp` | `PATCH /circles/:circleId/teamups/:teamupId` |
| `joinTeamUp` | `POST /circles/:circleId/teamups/:teamupId/join` |
| `applyTeamUp` | `POST /circles/:circleId/teamups/:teamupId/applications` |
| `getApplications` | `GET /circles/:circleId/teamups/:teamupId/applications` |
| `reviewApplication` | `PATCH /circles/:circleId/teamups/:teamupId/applications/:applicationId` |
| `withdrawTeamUpApplication` | `PUT /circles/:circleId/teamups/:teamupId/applications/:applicationId/withdraw` |
| `leaveTeamUp` | `DELETE /circles/:circleId/teamups/:teamupId/members/me` |
| `cancelTeamUp` | `POST /circles/:circleId/teamups/:teamupId/cancel` |
| `getTeamUpContacts` | `GET /circles/:circleId/teamups/:teamupId/contacts` |
