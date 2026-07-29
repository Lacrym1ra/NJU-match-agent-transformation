# G2 Livechat 实现说明（当前状态）

本文补充 livechat 的代码实现细节。当前实现同时覆盖圈子聊天室和组队聊天室。

## 后端挂载

| 能力 | 文件 | 路径 |
| --- | --- | --- |
| HTTP 路由 | `backend/src/routes/chat.ts` | `/api/v1/circles/...` |
| WebSocket | `backend/src/realtime/chatServer.ts` | `/api/v1/realtime` |
| ticket | `backend/src/routes/auth.ts` | `/api/v1/auth/realtime-ticket` |
| 圈子服务 | `backend/src/modules/chat/circleChat.ts` | 圈子消息 |
| 组队服务 | `backend/src/modules/chat/teamupChat.ts` | 组队消息 |
| 广播 hub | `backend/src/realtime/roomHub.ts` | room 管理 |

## HTTP 路由明细

| 方法 | 路径 | 服务函数 |
| --- | --- | --- |
| `GET` | `/:circleId/chat/messages` | `listCircleChatMessages` |
| `POST` | `/:circleId/chat/messages` | `sendCircleChatMessage` |
| `DELETE` | `/:circleId/chat/messages/:messageId` | `deleteCircleChatMessage` |
| `PUT` | `/:circleId/chat/read-state` | `updateCircleChatReadState` |
| `GET` | `/:circleId/teamups/:teamupId/chat/messages` | `listTeamupChatMessages` |
| `POST` | `/:circleId/teamups/:teamupId/chat/messages` | `sendTeamupChatMessage` |
| `DELETE` | `/:circleId/teamups/:teamupId/chat/messages/:messageId` | `deleteTeamupChatMessage` |
| `PUT` | `/:circleId/teamups/:teamupId/chat/read-state` | `updateTeamupChatReadState` |

所有 HTTP 路由均要求 `requireAuth`。

## 校验

### 发送消息

```ts
{
  clientMessageId: string; // 1 到 120
  content: string;         // 1 到 1000
  mentions?: string[];     // 最多 20
}
```

### 已读

```ts
{
  lastReadMessageId?: string; // UUID
  lastReadAt?: string;        // 带 offset 的 datetime
}
```

### 历史分页

| 参数 | 行为 |
| --- | --- |
| `before` | 必须是 UUID；为空则从最新开始 |
| `limit` | 默认 30，最小 1，最大 50 |

## 权限校验

| 房间 | 服务端要求 |
| --- | --- |
| 圈子 | 用户是 active 圈内成员 |
| 组队 | 用户是 active 组队成员，且组队属于指定圈子 |

广播时使用 `listActiveCircleChatMemberIds` 或 `listActiveTeamupChatMemberIds` 对接收者再次过滤。

## WebSocket 生命周期

1. 客户端调用 `POST /api/v1/auth/realtime-ticket`。
2. 服务端签发短期 JWT，payload 包含 `userId`、`email`、`purpose=realtime`、`audience=realtime` 和 `jti`。
3. 客户端连接 `/api/v1/realtime?ticket=...`。
4. 服务端校验 ticket 并消费 `jti`，重复使用会被拒绝。
5. 客户端发送 `chat.join`。
6. 服务端校验成员身份并回复 `chat.ready`。
7. 客户端可发送 `chat.send`、`chat.typing`、`ping`。

## 事件行为

| 事件 | 当前行为 |
| --- | --- |
| `chat.join` | 加入圈子或组队 room，成功后返回 `chat.ready` |
| `chat.send` | 服务端落库，给发送者 `chat.ack`，给房间广播 `chat.message` |
| `chat.typing` | 广播给同房间其他可见成员 |
| `ping` | 返回 `pong` |
| HTTP delete | 删除后广播 `chat.deleted` |

## 前端实现

| 文件 | 说明 |
| --- | --- |
| `frontend/src/api/chat.ts` | HTTP wrapper |
| `frontend/src/api/realtimeChat.ts` | WebSocket URL 和事件类型 |
| `frontend/src/components/chat/CircleChatPanel.tsx` | 通用聊天组件 |

`CircleChatPanel` 的核心行为：

1. 根据 `roomType` 选择圈子或组队历史接口。
2. 拉取历史后创建 WebSocket。
3. 入房成功后设置 connected。
4. 发送消息时先创建 optimistic message。
5. socket connected 时发送 `chat.send`；否则调用 HTTP 发送接口。
6. 收到 `chat.ack` 后替换本地 pending 消息。
7. 收到 `chat.message` 后追加其他成员消息。
8. 删除消息调用 HTTP，随后本地标记删除；服务端同时广播删除事件。
9. 可见最新消息变化后更新 read-state。

## ChatMessage shape

```ts
interface ChatMessage {
  id: string;
  roomType: 'circle' | 'teamup';
  circleId: string;
  teamupId?: string;
  sender: {
    userId: string;
    nickname: string | null;
    avatarUrl: string | null;
  };
  content: string;
  mentions: string[];
  createdAt: string;
  updatedAt?: string | null;
  deletedAt?: string | null;
  isOwn: boolean;
}
```

## 当前注意点

| 点位 | 当前状态 |
| --- | --- |
| 前端输入限制 | 500 字符 |
| 后端消息限制 | 1000 字符 |
| 发送幂等 | `clientMessageId` 参与去重 |
| 删除 | 使用软删除字段，广播删除事件 |
| 已读 | 独立 read-state 接口维护 |
| 组队聊天 | 已接入 |
