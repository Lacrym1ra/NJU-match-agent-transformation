# CIRCLE 前端 API 接入说明（第二组当前状态）

本文只覆盖第二组当前维护的圈子、圈内关系、位置、组队和 livechat 前端接入。圈内匹配、论坛治理、管理员后台不在本文维护范围内。

前端 API 基础地址由 `frontend/src/api/client.ts` 统一处理，本文路径均省略 `/api/v1` 前缀。

## 当前页面路由

| 前端路由 | 说明 |
| --- | --- |
| `/circles` | 圈子列表 |
| `/circles/:id` | 圈子详情 |
| `/circles/:id/manage` | 圈主管理 |
| `/circles/:id/forum` | 圈内论坛入口 |
| `/circles/:id/teamups` | 圈内组队 |
| `/circles/:id/create-teamup` | 创建组队 |
| `/circles/:id/teamups/:teamupId` | 组队详情 |
| `/circles/:id/livechat` | 圈子 livechat |

当前没有单独的“我的圈子”或“好友列表”页面路由；我的圈子和关系数据由现有页面内入口消费。

## API 模块

| 文件 | 负责范围 |
| --- | --- |
| `frontend/src/api/circles.ts` | 圈子列表、详情、加入、管理、位置、频道、圈内名片覆盖 |
| `frontend/src/api/teamups.ts` | 圈内组队列表、详情、创建、加入、申请、审核、联系人 |
| `frontend/src/api/chat.ts` | 圈子/组队聊天 HTTP 历史、发送、删除、已读 |
| `frontend/src/api/realtimeChat.ts` | livechat WebSocket 连接与事件类型 |
| `frontend/src/api/friends.ts` | 好友申请、好友列表、删除好友 |
| `frontend/src/api/contacts.ts` | 圈内联系方式设置、联系方式解锁申请与授权 |
| `frontend/src/api/card.ts` | 公开/好友名片读取 |

## 圈子接口封装

| 方法 | HTTP | 说明 |
| --- | --- | --- |
| `getCircles(params)` | `GET /circles` | 列表；wrapper 暴露 `page`、`limit`、`category`、`tag`、`keyword` |
| `createCircle(payload)` | `POST /circles` | 创建自定义圈子 |
| `getCircleDetail(circleId)` | `GET /circles/:circleId` | 详情、成员态、组件和权限 |
| `getMyCircles()` | `GET /circles/my` | 我加入的圈子 |
| `getMyCreatedCircles()` | `GET /circles/my-created` | 我创建的圈子 |
| `joinCircle(circleId, payload)` | `POST /circles/:circleId/join` | 公开/审核/邀请制加入 |
| `leaveCircle(circleId, options)` | `DELETE /circles/:circleId/leave` | 退出圈子，可传 `clearTrace` |
| `updateCircleStatus(circleId, payload)` | `PATCH /circles/:circleId/status` | 启用/停用本人圈内状态 |
| `getSentCircleJoinRequests()` | `GET /circles/join-requests/sent` | 我发出的加入申请 |
| `withdrawCircleJoinRequest(requestId)` | `PUT /circles/join-requests/:requestId/withdraw` | 撤回加入申请 |

后端列表接口还支持 `tags`、`department`、`grade`、`sort` 等参数；前端 wrapper 当前只暴露列表页实际使用的参数。

## 圈主管理封装

| 方法 | HTTP |
| --- | --- |
| `getCircleManageOverview` | `GET /circles/:circleId/manage/overview` |
| `getCircleManageMembers` | `GET /circles/:circleId/manage/members` |
| `getCircleJoinRequests` | `GET /circles/:circleId/join-requests` |
| `reviewCircleJoinRequest` | `PUT /circles/:circleId/requests/:requestId` |
| `updateJoinPolicy` | `PUT /circles/:circleId/join-policy` |
| `transferCircleOwner` | `POST /circles/:circleId/transfer-owner` |
| `dissolveCircle` | `DELETE /circles/:circleId` |

`reviewCircleJoinRequest` 当前使用后端兼容路径。管理权限由后端 `viewerPermissions` 下发，当前所有管理能力只对圈主开放。

## 位置与频道

| 方法 | HTTP | 说明 |
| --- | --- | --- |
| `getCircleLocationStatus` | `GET /circles/:circleId/location/me` | 我的定位状态 |
| `updateCircleLocation` | `PUT /circles/:circleId/location` | 更新位置 |
| `disableCircleLocation` | `DELETE /circles/:circleId/location` | 关闭位置 |
| `getChannelMembers` | `GET /circles/:circleId/channel` | 圈内频道 |

附近频道需要当前用户先打开位置。频道标签来自公开 B 卡组件，不再读取旧问卷答案。

## 圈内名片与联系方式

| 文件 | 方法 | HTTP |
| --- | --- | --- |
| `circles.ts` | `getCircleCardOverride` | `GET /card/circle/:circleId/me` |
| `circles.ts` | `updateCircleCardOverride` | `PUT /card/circle/:circleId/me` |
| `contacts.ts` | `getCircleContacts` | `GET /contacts/circles/:circleId/settings` |
| `contacts.ts` | `upsertCircleContact` | `POST /contacts/circles/:circleId/settings` |
| `contacts.ts` | `updateCircleContact` | `PATCH /contacts/circles/:circleId/settings/:contactId` |
| `contacts.ts` | `deleteCircleContact` | `DELETE /contacts/circles/:circleId/settings/:contactId` |

好友视图名片读取使用 `GET /card/:userId/friend`，后端会校验双方好友关系。

## 好友与联系方式授权

好友：

| 方法 | HTTP |
| --- | --- |
| `sendFriendRequest` | `POST /friends/requests` |
| `getPendingRequests` | `GET /friends/requests` |
| `acceptFriendRequest` | `PUT /friends/requests/:requestId` |
| `rejectFriendRequest` | `PUT /friends/requests/:requestId` |
| `withdrawFriendRequest` | `PUT /friends/requests/:requestId/withdraw` |
| `silentRejectFriendRequest` | `PUT /friends/requests/:requestId/silent-reject` |
| `getGroupedFriends` | `GET /friends/grouped` |
| `deleteFriendInCircle` | `DELETE /friends/:friendId?circleId=...` |
| `deleteFriendEverywhere` | `DELETE /friends/:friendId/all` |

联系方式：

| 方法 | HTTP |
| --- | --- |
| `sendContactUnlockRequest` | `POST /contacts/unlock-request` |
| `getContactUnlockRequests` | `GET /contacts/unlock-requests` |
| `approveContactUnlockRequest` | `PUT /contacts/unlock-requests/:requestId` |
| `rejectContactUnlockRequest` | `PUT /contacts/unlock-requests/:requestId` |
| `withdrawContactUnlockRequest` | `PUT /contacts/unlock-requests/:requestId/withdraw` |
| `revokeContactUnlockRequest` | `POST /contacts/unlock-requests/:requestId/revoke` |
| `getContactUnlockStatus` | `GET /contacts/status/:userId` |
| `getUnlockedContacts` | `GET /contacts/:userId` |

## 组队接口封装

详见 `design_docs/TEAMUP_API.md`。前端当前封装：

| 方法 | HTTP |
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

没有独立的候补操作前端封装；候补由加入或申请流程中的服务端状态返回体现。

## Livechat 接入

HTTP 历史、发送 fallback、删除、已读在 `frontend/src/api/chat.ts`：

| 场景 | 方法 | HTTP |
| --- | --- | --- |
| 圈子聊天 | `getCircleChatMessages` | `GET /circles/:circleId/chat/messages` |
| 圈子聊天 | `sendCircleChatMessage` | `POST /circles/:circleId/chat/messages` |
| 圈子聊天 | `deleteCircleChatMessage` | `DELETE /circles/:circleId/chat/messages/:messageId` |
| 圈子聊天 | `updateCircleChatReadState` | `PUT /circles/:circleId/chat/read-state` |
| 组队聊天 | `getTeamupChatMessages` | `GET /circles/:circleId/teamups/:teamupId/chat/messages` |
| 组队聊天 | `sendTeamupChatMessage` | `POST /circles/:circleId/teamups/:teamupId/chat/messages` |
| 组队聊天 | `deleteTeamupChatMessage` | `DELETE /circles/:circleId/teamups/:teamupId/chat/messages/:messageId` |
| 组队聊天 | `updateTeamupChatReadState` | `PUT /circles/:circleId/teamups/:teamupId/chat/read-state` |

WebSocket 在 `frontend/src/api/realtimeChat.ts`：

1. `POST /auth/realtime-ticket` 获取短期 ticket。
2. 连接 `/api/v1/realtime?ticket=...`。
3. 发送 `chat.join` 加入 `circle` 或 `teamup` room。
4. 接收 `chat.ready` 后进入 connected 状态。
5. 发送消息时优先走 `chat.send` WebSocket；离线或未连接时 fallback 到 HTTP。
6. 接收 `chat.ack`、`chat.message`、`chat.deleted`、`chat.typing` 更新 UI。

当前 livechat 路径不是频道接口下的消息路径。
