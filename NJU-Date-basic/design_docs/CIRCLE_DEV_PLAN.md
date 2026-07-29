# CIRCLE 开发状态记录（第二组）

本文用于记录第二组 CIRCLE 相关功能的当前实现状态。旧的里程碑清单已经移除，后续如果代码变化，应直接更新当前状态而不是追加历史说明。

## 当前已落地

| 能力 | 当前状态 |
| --- | --- |
| 圈子列表/详情 | 已接入 `/api/v1/circles`，列表只返回当前用户可加入的 active 圈子 |
| 自定义圈子 | 已支持创建，默认待审核且不可见 |
| 加入策略 | 已支持 `public`、`review`、`invite` |
| 加入申请 | 已支持用户发起、撤回，圈主审核 |
| 圈主管理 | 已支持概览、成员、黑名单、加入策略、转让、归档 |
| 圈内位置 | 已支持上传、关闭、附近频道 |
| 圈内名片 | 已接入统一 A/B/C 卡体系，B 卡组件承担频道标签 |
| 好友关系 | 已支持圈内好友、全局好友、申请撤回、静默拒绝、删除 |
| 联系方式授权 | 已支持圈内联系方式设置、解锁申请、批准、拒绝、撤回、撤销 |
| 组队 | 已支持创建、更新、加入、申请、审核、退出、取消、联系人查看 |
| 组队候补 | 由加入/申请流程自动产生候补状态，没有独立候补路由 |
| Livechat | 已支持圈子和组队房间，HTTP 历史 + WebSocket 实时推送 |

## 关键约束

| 约束 | 当前行为 |
| --- | --- |
| 自定义圈子上限 | 每个用户最多 5 个 |
| 新圈子默认状态 | `pending_review`、`isActive=false` |
| 加入申请有效期 | 7 天 |
| 位置 TTL | 24 小时 |
| 位置更新间隔 | 至少 30 秒 |
| 位置精度上限 | `accuracy <= 1000` |
| 频道附近半径 | 100 到 50000 米 |
| livechat ticket | 通过 `/auth/realtime-ticket` 获取，默认短期有效 |
| 组队论坛同步 | `TEAMUP_FORUM_SYNC_ENABLED=false`，当前关闭 |

## 后端事实源

| 文件 | 说明 |
| --- | --- |
| `backend/src/routes/circle.ts` | 圈子主路由 |
| `backend/src/modules/circles/circleService.ts` | 圈子核心业务 |
| `backend/src/routes/friend.ts` | 好友路由 |
| `backend/src/routes/contacts.ts` | 联系方式路由 |
| `backend/src/routes/team.ts` | 组队路由 |
| `backend/src/modules/teamups/teamService.ts` | 组队业务 |
| `backend/src/routes/chat.ts` | 聊天 HTTP 路由 |
| `backend/src/realtime/chatServer.ts` | WebSocket 实时聊天 |

## 前端事实源

| 文件 | 说明 |
| --- | --- |
| `frontend/src/App.tsx` | 第二组相关页面路由 |
| `frontend/src/api/circles.ts` | 圈子 API 封装 |
| `frontend/src/api/friends.ts` | 好友 API 封装 |
| `frontend/src/api/contacts.ts` | 联系方式 API 封装 |
| `frontend/src/api/teamups.ts` | 组队 API 封装 |
| `frontend/src/api/chat.ts` | 聊天 HTTP API 封装 |
| `frontend/src/api/realtimeChat.ts` | WebSocket API 封装 |
| `frontend/src/components/chat/CircleChatPanel.tsx` | 圈子/组队聊天 UI |

## 文档维护原则

1. 以当前代码为准，不保留旧方案状态。
2. 匹配文档不在第二组范围内，不在本文同步。
3. 其他组文档不作为本文件的引用目标，避免交叉误改。
