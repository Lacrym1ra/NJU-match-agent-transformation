# G2 后端状态记录（第二组当前状态）

本文记录第二组后端当前已经落地的 CIRCLE、关系、组队和 livechat 状态。旧的“变更计划”式内容不再保留。圈内匹配属于第一组，不在本文维护。

## 当前路由

| 模块 | 路由文件 | 挂载 |
| --- | --- | --- |
| 圈子 | `backend/src/routes/circle.ts` | `/api/v1/circles` |
| 好友 | `backend/src/routes/friend.ts` | `/api/v1/friends` |
| 联系方式 | `backend/src/routes/contacts.ts` | `/api/v1/contacts` |
| 组队 | `backend/src/routes/team.ts` | `/api/v1` |
| 聊天 HTTP | `backend/src/routes/chat.ts` | `/api/v1/circles` |
| 实时聊天 | `backend/src/realtime/chatServer.ts` | `/api/v1/realtime` |

## 圈子能力

| 能力 | 当前实现 |
| --- | --- |
| 列表 | `GET /circles`，仅 active 且用户未加入 |
| 详情 | `GET /circles/:circleId`，返回组件、成员态、权限 |
| 创建 | `POST /circles`，默认 `pending_review`、`isActive=false` |
| 加入 | `POST /circles/:circleId/join`，支持 `public`、`review`、`invite` |
| 退出 | `DELETE /circles/:circleId/leave`，支持 `clearTrace` |
| 我的圈子 | `GET /circles/my`、`GET /circles/my-created` |
| 加入申请 | `GET /circles/join-requests/sent`、`PUT /circles/join-requests/:requestId/withdraw` |
| 管理 | overview、members、join requests、blacklist、join policy、transfer、archive |
| 位置 | `GET/PUT/DELETE /circles/:circleId/location` |
| 频道 | `GET /circles/:circleId/channel` |

关键常量：

| 常量 | 值 |
| --- | --- |
| 自定义圈子上限 | 5 |
| 加入申请 TTL | 7 天 |
| 位置 TTL | 24 小时 |
| 位置更新最小间隔 | 30 秒 |
| 最大定位精度值 | 1000 米 |
| nearby 半径 | 100 到 50000 米 |

## 名片和频道标签

当前后端使用统一名片体系：

| 数据 | 来源 |
| --- | --- |
| B 卡组件定义 | `circle_questions` |
| 用户 B 卡值 | `user_circle_cards.components` |
| 频道标签 | `isChannelTag=true` 且组件状态 `public` |

旧问卷接口仍保留兼容，但新逻辑不再依赖旧答案。

## 好友关系

| 方法 | 路径 |
| --- | --- |
| `GET` | `/friends` |
| `GET` | `/friends/grouped` |
| `POST` | `/friends/requests` |
| `POST` | `/friends/global/requests` |
| `GET` | `/friends/requests` |
| `PUT` | `/friends/requests/:requestId` |
| `PUT` | `/friends/requests/:requestId/withdraw` |
| `PUT` | `/friends/requests/:requestId/silent-reject` |
| `DELETE` | `/friends/:friendId?circleId=...` |
| `DELETE` | `/friends/:friendId/all` |

## 联系方式授权

| 方法 | 路径 |
| --- | --- |
| `GET` | `/contacts/circles/:circleId/settings` |
| `POST` | `/contacts/circles/:circleId/settings` |
| `PATCH` | `/contacts/circles/:circleId/settings/:contactId` |
| `DELETE` | `/contacts/circles/:circleId/settings/:contactId` |
| `POST` | `/contacts/unlock-request` |
| `GET` | `/contacts/unlock-requests` |
| `PUT` | `/contacts/unlock-requests/:requestId` |
| `PUT` | `/contacts/unlock-requests/:requestId/withdraw` |
| `POST` | `/contacts/unlock-requests/:requestId/revoke` |
| `GET` | `/contacts/status/:userId` |
| `GET` | `/contacts/:userId` |

申请批准时可传 `contactIds`，只授权选中的圈内联系方式。

## 组队能力

当前组队接口见 `design_docs/TEAMUP_API.md`。后端已经实现列表、详情、创建、更新、直接加入、审核申请、候补、退出、取消、联系人查看。组队描述会过滤联系方式，联系方式必须提交到 `contacts` 字段。

当前论坛同步开关关闭，不创建同步任务。

## Livechat

HTTP 路由：

| 房间 | 路径 |
| --- | --- |
| 圈子历史/发送 | `GET/POST /circles/:circleId/chat/messages` |
| 圈子删除 | `DELETE /circles/:circleId/chat/messages/:messageId` |
| 圈子已读 | `PUT /circles/:circleId/chat/read-state` |
| 组队历史/发送 | `GET/POST /circles/:circleId/teamups/:teamupId/chat/messages` |
| 组队删除 | `DELETE /circles/:circleId/teamups/:teamupId/chat/messages/:messageId` |
| 组队已读 | `PUT /circles/:circleId/teamups/:teamupId/chat/read-state` |

WebSocket：

| 项 | 当前实现 |
| --- | --- |
| ticket | `POST /auth/realtime-ticket` |
| socket path | `/api/v1/realtime?ticket=...` |
| room | `circle` 或 `teamup` |
| client events | `chat.join`、`chat.send`、`chat.typing`、`ping` |
| server events | `chat.ready`、`chat.ack`、`chat.message`、`chat.deleted`、`chat.typing`、`chat.error`、`pong` |

## 退出圈子的联动清理

用户退出圈子时，后端会在该圈范围内清理位置、组队、好友申请、联系方式申请、圈内关系和授权。`clearTrace=true` 会额外删除圈内名片、联系方式、旧兼容数据、加入申请等。

## 不在本文维护

| 范围 | 归属 |
| --- | --- |
| 圈内匹配接口和算法 | 第一组 |
| 论坛内容治理 | 论坛组 |
| 管理员后台 | 后台组 |
