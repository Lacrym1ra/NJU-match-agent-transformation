# G2 前端 API 规格（第二组当前状态）

本文记录第二组前端当前实际使用的 API surface。旧的目标接口、未接入路径和历史计划已移除。圈内匹配属于第一组，不在本文维护。

路径均省略 `/api/v1` 前缀。

## 页面路由

| 路由 | 说明 |
| --- | --- |
| `/circles` | 圈子列表 |
| `/circles/:id` | 圈子详情 |
| `/circles/:id/manage` | 圈主管理 |
| `/circles/:id/teamups` | 圈内组队 |
| `/circles/:id/create-teamup` | 创建组队 |
| `/circles/:id/teamups/:teamupId` | 组队详情 |
| `/circles/:id/livechat` | 圈子 livechat |

## `circles.ts`

| 方法 | HTTP |
| --- | --- |
| `getCircles` | `GET /circles` |
| `createCircle` | `POST /circles` |
| `getCircleDetail` | `GET /circles/:circleId` |
| `getMyCircles` | `GET /circles/my` |
| `getMyCreatedCircles` | `GET /circles/my-created` |
| `joinCircle` | `POST /circles/:circleId/join` |
| `leaveCircle` | `DELETE /circles/:circleId/leave` |
| `updateCircleStatus` | `PATCH /circles/:circleId/status` |
| `getSentCircleJoinRequests` | `GET /circles/join-requests/sent` |
| `withdrawCircleJoinRequest` | `PUT /circles/join-requests/:requestId/withdraw` |
| `getChannelMembers` | `GET /circles/:circleId/channel` |
| `getCircleLocationStatus` | `GET /circles/:circleId/location/me` |
| `updateCircleLocation` | `PUT /circles/:circleId/location` |
| `disableCircleLocation` | `DELETE /circles/:circleId/location` |

管理方法：

| 方法 | HTTP |
| --- | --- |
| `getCircleManageOverview` | `GET /circles/:circleId/manage/overview` |
| `getCircleManageMembers` | `GET /circles/:circleId/manage/members` |
| `getCircleJoinRequests` | `GET /circles/:circleId/join-requests` |
| `reviewCircleJoinRequest` | `PUT /circles/:circleId/requests/:requestId` |
| `updateJoinPolicy` | `PUT /circles/:circleId/join-policy` |
| `transferCircleOwner` | `POST /circles/:circleId/transfer-owner` |
| `dissolveCircle` | `DELETE /circles/:circleId` |

`reviewCircleJoinRequest` 当前使用后端兼容路径 `/circles/:circleId/requests/:requestId`。

## 圈内名片与联系方式

| 文件 | 方法 | HTTP |
| --- | --- | --- |
| `circles.ts` | `getCircleCardOverride` | `GET /card/circle/:circleId/me` |
| `circles.ts` | `updateCircleCardOverride` | `PUT /card/circle/:circleId/me` |
| `card.ts` | `getFriendCard` | `GET /card/:userId/friend` |
| `contacts.ts` | `getCircleContacts` | `GET /contacts/circles/:circleId/settings` |
| `contacts.ts` | `upsertCircleContact` | `POST /contacts/circles/:circleId/settings` |
| `contacts.ts` | `updateCircleContact` | `PATCH /contacts/circles/:circleId/settings/:contactId` |
| `contacts.ts` | `deleteCircleContact` | `DELETE /contacts/circles/:circleId/settings/:contactId` |

## 好友关系

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
| `blockUser` | `POST /users/:targetUserId/block` |

## 联系方式授权

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

`sourceType` 当前为 `circle` 或 `address_book`。`sourceType=circle` 时必须传 `circleId`。

## 组队

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

候补没有单独前端方法；根据 `applicationType`、`waitlistPosition`、`waitlistCount` 等返回字段展示。

## Livechat HTTP

| 方法 | HTTP |
| --- | --- |
| `getCircleChatMessages` | `GET /circles/:circleId/chat/messages` |
| `sendCircleChatMessage` | `POST /circles/:circleId/chat/messages` |
| `deleteCircleChatMessage` | `DELETE /circles/:circleId/chat/messages/:messageId` |
| `updateCircleChatReadState` | `PUT /circles/:circleId/chat/read-state` |
| `getTeamupChatMessages` | `GET /circles/:circleId/teamups/:teamupId/chat/messages` |
| `sendTeamupChatMessage` | `POST /circles/:circleId/teamups/:teamupId/chat/messages` |
| `deleteTeamupChatMessage` | `DELETE /circles/:circleId/teamups/:teamupId/chat/messages/:messageId` |
| `updateTeamupChatReadState` | `PUT /circles/:circleId/teamups/:teamupId/chat/read-state` |

消息类型：

```ts
interface ChatMessage {
  id: string;
  roomType: 'circle' | 'teamup';
  circleId: string;
  teamupId?: string;
  sender: { userId: string; nickname: string | null; avatarUrl: string | null };
  content: string;
  mentions: string[];
  createdAt: string;
  updatedAt?: string | null;
  deletedAt?: string | null;
  isOwn: boolean;
}
```

## Livechat WebSocket

| 方法 | 说明 |
| --- | --- |
| `buildRealtimeUrl` | 调用 `/auth/realtime-ticket`，生成 `/api/v1/realtime?ticket=...` |
| `createRealtimeSocket` | 创建 WebSocket |
| `sendRealtimeEvent` | 发送 JSON 事件 |

客户端事件：`chat.join`、`chat.send`、`chat.typing`、`ping`。

服务端事件：`chat.ready`、`chat.ack`、`chat.message`、`chat.deleted`、`chat.typing`、`chat.error`、`pong`。

livechat 当前不挂在频道接口下。前端应使用本文件列出的 `/chat/messages` 和 `/chat/read-state` 路径。
