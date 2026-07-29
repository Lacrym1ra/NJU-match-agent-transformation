# CIRCLE 架构图（第二组当前状态）

本文只画第二组维护的圈子、关系、组队和 livechat 架构。圈内匹配不在本文范围内。

## 总览

```mermaid
flowchart LR
  FE["Frontend"]
  API["Express /api/v1"]
  DB["PostgreSQL"]
  WS["WebSocket /api/v1/realtime"]

  FE --> CAPI["circles.ts"]
  FE --> FAPI["friends.ts"]
  FE --> CONTACTAPI["contacts.ts"]
  FE --> TEAMAPI["teamups.ts"]
  FE --> CHATAPI["chat.ts"]
  FE --> RTAPI["realtimeChat.ts"]

  CAPI --> API
  FAPI --> API
  CONTACTAPI --> API
  TEAMAPI --> API
  CHATAPI --> API
  RTAPI --> WS

  API --> CircleSvc["circleService"]
  API --> FriendSvc["friend requests"]
  API --> ContactSvc["contact unlocks"]
  API --> TeamSvc["teamService"]
  API --> ChatSvc["chatService"]

  WS --> ChatSvc
  CircleSvc --> DB
  FriendSvc --> DB
  ContactSvc --> DB
  TeamSvc --> DB
  ChatSvc --> DB
```

## 圈子主流程

```mermaid
sequenceDiagram
  participant U as User
  participant FE as Frontend
  participant API as /api/v1/circles
  participant DB as DB

  U->>FE: 创建圈子
  FE->>API: POST /circles
  API->>DB: circles(status=pending_review,is_active=false)
  API-->>FE: circle

  U->>FE: 查看列表
  FE->>API: GET /circles
  API->>DB: 查询 active 且未加入圈子
  API-->>FE: circles

  U->>FE: 申请加入审核制圈子
  FE->>API: POST /circles/:id/join
  API->>DB: circle_join_requests(pending_review)
  API-->>FE: requestId + expiresAt
```

## 圈主管理

```mermaid
flowchart TD
  Owner["圈主"]
  Overview["GET /circles/:id/manage/overview"]
  Requests["GET /circles/:id/join-requests"]
  Review["PUT /circles/:id/join-requests/:requestId"]
  Members["GET /circles/:id/manage/members"]
  Remove["DELETE /circles/:id/members/:userId"]
  Blacklist["/circles/:id/blacklist"]
  Transfer["POST /circles/:id/transfer-owner"]
  Archive["DELETE /circles/:id"]

  Owner --> Overview
  Owner --> Requests --> Review
  Owner --> Members --> Remove
  Owner --> Blacklist
  Owner --> Transfer
  Owner --> Archive
```

当前管理能力由 `viewerPermissions` 控制，后端只给圈主开放。

## 圈内资料与频道

```mermaid
flowchart LR
  CQ["circle_questions"]
  UCC["user_circle_cards.components"]
  Filter["公开状态 + isChannelTag + 敏感字段过滤"]
  Channel["GET /circles/:id/channel"]

  CQ --> Filter
  UCC --> Filter
  Filter --> Channel
```

频道标签来自公开 B 卡组件，不再从旧问卷答案生成。

## 关系与联系方式

```mermaid
flowchart TD
  FriendReq["friend_requests"]
  Friendships["friendships"]
  CircleContacts["user_circle_contacts"]
  Secrets["g2_contact_secrets"]
  UnlockReq["contact_unlock_requests"]
  Grants["contact_unlock_grants"]

  FriendReq -->|accept| Friendships
  CircleContacts --> Secrets
  UnlockReq -->|approve selected contacts| Grants
  Grants --> CircleContacts
```

好友关系和联系方式授权是两个独立层级。删除好友、退出圈子或拉黑用户时，服务端会清理对应范围内的待处理申请和授权。

## 组队

```mermaid
flowchart TD
  List["GET /circles/:circleId/teamups"]
  Create["POST /circles/:circleId/teamups"]
  Detail["GET /circles/:circleId/teamups/:teamupId"]
  Join["POST /join"]
  Apply["POST /applications"]
  Review["PATCH /applications/:applicationId"]
  Contacts["GET /contacts"]
  Chat["/teamups/:teamupId/chat/messages"]

  List --> Detail
  Create --> Detail
  Detail --> Join
  Detail --> Apply --> Review
  Detail --> Contacts
  Detail --> Chat
```

当前论坛同步开关关闭，组队不会自动同步为论坛贴。

## Livechat

```mermaid
sequenceDiagram
  participant FE as CircleChatPanel
  participant Auth as /auth/realtime-ticket
  participant HTTP as chat HTTP routes
  participant WS as /api/v1/realtime
  participant SVC as chatService

  FE->>HTTP: GET messages
  HTTP->>SVC: list messages
  SVC-->>HTTP: history
  HTTP-->>FE: messages

  FE->>Auth: POST realtime-ticket
  Auth-->>FE: ticket
  FE->>WS: connect(ticket)
  FE->>WS: chat.join(roomType,circleId,teamupId?)
  WS-->>FE: chat.ready

  FE->>WS: chat.send
  WS->>SVC: persist message
  WS-->>FE: chat.ack
  WS-->>FE: chat.message broadcast
```

HTTP 路径：

| 房间 | 历史 |
| --- | --- |
| 圈子 | `/circles/:circleId/chat/messages` |
| 组队 | `/circles/:circleId/teamups/:teamupId/chat/messages` |
