# CIRCLE Social 后端设计（第二组当前状态）

本文记录第二组当前后端实现：圈子、圈内关系、联系方式、组队和 livechat。圈内匹配不在本文维护范围内。

## 路由入口

| 路由文件 | 挂载路径 | 说明 |
| --- | --- | --- |
| `backend/src/routes/circle.ts` | `/api/v1/circles` | 圈子基础、管理、位置、频道 |
| `backend/src/routes/friend.ts` | `/api/v1/friends` | 好友列表、申请、删除 |
| `backend/src/routes/contacts.ts` | `/api/v1/contacts` | 圈内联系方式和联系方式授权 |
| `backend/src/routes/team.ts` | `/api/v1` | 圈内组队 |
| `backend/src/routes/chat.ts` | `/api/v1/circles` | 圈子/组队聊天 HTTP API |
| `backend/src/realtime/chatServer.ts` | `/api/v1/realtime` | livechat WebSocket |

## 核心表

| 表 | 当前用途 |
| --- | --- |
| `circles` | 圈子主体 |
| `circle_members` | 用户圈内成员关系 |
| `circle_join_requests` | 审核制加入申请 |
| `circle_questions` | B 卡组件定义，也可标记频道标签 |
| `user_circle_cards` | 用户在圈内的 B 卡组件值 |
| `circle_member_locations` | 圈内位置 |
| `friend_requests` | 好友申请 |
| `friendships` | 好友关系 |
| `user_circle_contacts` | 用户在某圈设置的联系方式 |
| `g2_contact_secrets` | 联系方式明文的受控存储 |
| `contact_unlock_requests` | 联系方式解锁申请 |
| `contact_unlock_grants` | 已授权联系方式 |
| `teamups` | 组队主体 |
| `teamup_members` | 组队成员 |
| `teamup_member_contacts` | 成员加入组队时提交的联系方式 |
| `teamup_applications` | 加入/候补申请 |
| `circle_chat_messages` | 圈子聊天消息 |
| `teamup_chat_messages` | 组队聊天消息 |

## 圈子权限

所有圈子接口默认要求登录。普通用户只能查看 active 圈子；圈主可以查看自己创建但未激活的圈子。

当前管理权限只对圈主开放：

| 权限字段 | 当前含义 |
| --- | --- |
| `canManage` | 能进入管理视图 |
| `canEdit` | 能编辑圈子 |
| `canReviewJoinRequests` | 能审核加入申请 |
| `canManageMembers` | 能移除成员 |
| `canManageBlacklist` | 能维护黑名单 |
| `canTransferOwner` | 能转让圈主 |
| `canDissolve` | 能归档圈子 |

普通 active 成员拥有圈内发言、频道、位置和组队相关能力。

## 加入与退出

加入流程由 `joinPolicy` 控制：

| 策略 | 后端行为 |
| --- | --- |
| `public` | 直接插入 active membership |
| `review` | 写入 `circle_join_requests.pending_review` |
| `invite` | 校验邀请码哈希后插入 membership |

退出圈子会执行范围清理：

| 清理项 | 行为 |
| --- | --- |
| 成员关系 | 删除或停用该圈 active membership |
| 位置 | 删除 `circle_member_locations` |
| 组队 | 取消用户作为 leader 的 active 组队，普通成员退出相关组队 |
| 好友申请 | 拒绝该圈内 pending 申请 |
| 联系方式申请 | 拒绝该圈内 pending 申请 |
| 圈内好友/授权 | 移除该圈范围内关系和授权 |
| `clearTrace=true` | 额外清理圈内名片、联系方式、旧问卷答案、位置冷却、加入申请等痕迹 |

圈主不能直接退出，需要先转让或归档圈子。

## 圈内资料和频道标签

B 卡组件定义存放在 `circle_questions`，用户值存放在 `user_circle_cards.components`。频道标签生成条件：

1. 组件定义 `isChannelTag=true`。
2. 用户组件状态为 `public`。
3. 字段名和值未命中敏感过滤。

旧问卷接口仍保留兼容返回，但新逻辑不从 `circle_members.answers` 生成频道标签。

## 位置服务

位置接口只允许 active 成员访问。

| 限制 | 值 |
| --- | --- |
| TTL | 24 小时 |
| 更新间隔 | 30 秒 |
| `accuracy` | 最大 1000 米 |
| nearby 半径 | 100 到 50000 米，默认 50000 |

停用圈内状态或退出圈子时会删除位置。

## 好友关系

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/friends` | 好友列表 |
| `GET` | `/friends/grouped` | 按共同圈子聚合 |
| `POST` | `/friends/requests` | 圈内好友申请 |
| `POST` | `/friends/global/requests` | 全局好友申请 |
| `GET` | `/friends/requests` | 收到/发出/已处理申请 |
| `PUT` | `/friends/requests/:requestId` | `accept` / `reject` |
| `PUT` | `/friends/requests/:requestId/withdraw` | 撤回 |
| `PUT` | `/friends/requests/:requestId/silent-reject` | 静默拒绝 |
| `DELETE` | `/friends/:friendId` | 删除某圈好友关系，需 `circleId` |
| `DELETE` | `/friends/:friendId/all` | 删除双方全部好友关系 |

## 联系方式授权

| 能力 | 路径 |
| --- | --- |
| 我的圈内联系方式 | `/contacts/circles/:circleId/settings` |
| 发送解锁申请 | `POST /contacts/unlock-request` |
| 申请收件箱/历史回复 | `GET /contacts/unlock-requests` |
| 处理申请 | `PUT /contacts/unlock-requests/:requestId` |
| 撤回申请 | `PUT /contacts/unlock-requests/:requestId/withdraw` |
| 撤销授权 | `POST /contacts/unlock-requests/:requestId/revoke` |
| 查询状态 | `GET /contacts/status/:userId` |
| 读取已授权联系方式 | `GET /contacts/:userId` |

批准联系方式申请时可以指定 `contactIds`，只授权用户选择的圈内联系方式。

## 组队

组队接口挂在圈子下。创建/加入/申请都要求用户是对应圈子的 active 成员。

当前 `TEAMUP_FORUM_SYNC_ENABLED=false`：

| 影响 | 当前行为 |
| --- | --- |
| `isPublic` | 创建/更新时不会触发论坛公开同步 |
| public summary | 公开摘要路由存在，但不能作为当前公开入口依赖 |
| sync jobs | 不新建论坛同步任务 |

候补不通过独立路由暴露。服务端在加入、申请、审核、退出等流程中维护 `applicationType=waitlist`、`waitlistPosition` 和自动递补。

## Livechat

HTTP 路由：

| 房间 | 方法 |
| --- | --- |
| 圈子 | `GET/POST/DELETE /circles/:circleId/chat/messages` |
| 圈子已读 | `PUT /circles/:circleId/chat/read-state` |
| 组队 | `GET/POST/DELETE /circles/:circleId/teamups/:teamupId/chat/messages` |
| 组队已读 | `PUT /circles/:circleId/teamups/:teamupId/chat/read-state` |

WebSocket 路径为 `/api/v1/realtime?ticket=...`。ticket 由 `/auth/realtime-ticket` 颁发，带 `purpose=realtime`、`audience=realtime`，服务端会消费并记录 ticket id，防止重复使用。
