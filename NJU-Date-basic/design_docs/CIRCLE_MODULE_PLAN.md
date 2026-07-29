# CIRCLE 模块说明（第二组当前状态）

本文从模块边界角度描述当前实现，不再保留旧开发计划。第二组维护范围包括：圈子基础能力、圈内关系、圈内联系方式、位置、频道、组队入口与 livechat。圈内匹配属于第一组，论坛治理和管理员后台由对应组维护。

## 模块边界

| 模块 | 后端入口 | 前端入口 | 当前职责 |
| --- | --- | --- | --- |
| 圈子基础 | `backend/src/routes/circle.ts` | `frontend/src/api/circles.ts` | 列表、详情、创建、加入、退出、我的圈子 |
| 圈主管理 | `backend/src/routes/circle.ts` | `frontend/src/api/circles.ts` | 入圈审核、成员、黑名单、加入策略、转让、解散 |
| 圈内位置 | `backend/src/routes/circle.ts` | `frontend/src/api/circles.ts` | 位置更新、关闭、附近频道 |
| 圈内名片 | `backend/src/routes/card.ts` | `frontend/src/api/card.ts`、`circles.ts` | A/B/C 卡读取与圈内覆盖 |
| 好友关系 | `backend/src/routes/friend.ts` | `frontend/src/api/friends.ts` | 圈内好友申请、全局好友申请、删除好友 |
| 联系方式 | `backend/src/routes/contacts.ts` | `frontend/src/api/contacts.ts` | 圈内联系方式设置、解锁申请、授权和撤销 |
| 组队 | `backend/src/routes/team.ts` | `frontend/src/api/teamups.ts` | 圈内组队创建、加入、申请、审核、联系人 |
| Livechat | `backend/src/routes/chat.ts`、`backend/src/realtime` | `frontend/src/api/chat.ts`、`realtimeChat.ts` | 圈子/组队聊天历史、发送、删除、已读、实时推送 |

## 圈子生命周期

1. 用户创建自定义圈子。
2. 后端写入 `status=pending_review`、`isActive=false`。
3. 审核激活后，圈子进入普通列表。
4. 用户按 `joinPolicy` 公开加入、提交审核申请或使用邀请码加入。
5. 圈主通过管理页维护成员、加入策略、黑名单和圈主转让。
6. 解散圈子时后端归档，设置 `status=archived`、`isActive=false`。

自定义圈子创建上限当前为每人 5 个。

## 成员与权限

普通成员要求 `membershipStatus=active` 且 `isActive=true`。圈主能力由 `viewerPermissions` 下发，当前管理能力只对圈主开放。

圈主不能直接退出圈子。如果要退出，需要先转让圈主或解散圈子。

## 圈内资料

当前圈内资料使用统一名片体系：

| 卡片 | 当前来源 |
| --- | --- |
| A 卡 | 用户基础资料 |
| B 卡 | `circle_questions` 组件定义和 `user_circle_cards.components` |
| C 卡 | 用户自定义扩展卡 |

频道标签来自公开 B 卡组件，条件是组件定义 `isChannelTag=true` 且用户组件状态为 `public`。旧问卷接口仍存在，但只作为兼容层。

## 位置与频道

位置只对 active 成员开放。当前位置有 24 小时 TTL，更新间隔至少 30 秒，`accuracy` 最大 1000 米。

频道列表可普通返回，也可按附近模式返回。附近模式要求当前用户已经上传有效位置。

## 关系与联系方式

好友关系分为圈内关系和全局关系。联系方式不直接暴露在普通资料里。用户先在圈内设置自己的联系方式，再通过联系方式解锁申请决定是否授权给对方。

退出圈子时，后端会清理该圈内待处理好友申请、联系方式申请、授权和可选的圈内联系方式痕迹。

## 组队

组队挂在圈子下。创建者自动成为 leader，加入方式支持：

| `joinMode` | 行为 |
| --- | --- |
| `direct` | 可直接加入；满员时服务端可转入候补申请 |
| `approval` | 提交申请，由 leader 审核 |

当前没有独立候补路由；候补由加入或申请流程中的服务端状态返回。论坛同步开关当前关闭，公开组队不会自动同步为论坛贴。

## Livechat

| 房间 | HTTP 历史路径 | WebSocket `roomType` |
| --- | --- | --- |
| 圈子 | `/circles/:circleId/chat/messages` | `circle` |
| 组队 | `/circles/:circleId/teamups/:teamupId/chat/messages` | `teamup` |

WebSocket 连接路径为 `/api/v1/realtime?ticket=...`，ticket 通过 `/auth/realtime-ticket` 获取。

## 非本文维护范围

| 范围 | 说明 |
| --- | --- |
| 圈内匹配 | 第一组维护，本文不记录匹配算法或匹配接口细节 |
| 圈内论坛治理 | 论坛组维护，本文只保留前端路由入口事实 |
| 管理员后台 | 后台组维护，本文不描述 admin 接口 |
