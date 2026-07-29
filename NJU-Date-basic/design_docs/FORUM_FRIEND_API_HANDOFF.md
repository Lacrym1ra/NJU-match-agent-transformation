# 论坛好友能力协作说明

> 面向：论坛组  
> 日期：2026-06-02  
> 范围：论坛中的全局好友入口、联系方式申请入口、好友互动筛选、未来圈内论坛协作边界

## 1. 需求结论

论坛可以加入“加全局好友”的入口。产品上可以把它理解成一个“空兴趣圈”的好友场景，但实现上不要直接假设已有圈子上下文：总论坛没有 `circleId`，只应形成全局好友关系。

当前好友关系是分层的：

| 层级 | 当前含义 | 当前实现状态 |
| --- | --- | --- |
| 圈内好友 | 两人在某个兴趣圈下成为好友 | 已实现，写入 `friendships` |
| 全局好友 | 两人在全站层面成为好友，可作为联系方式申请前置关系 | 已实现，写入 `global_friendships` |
| 论坛全局好友申请 | 从总论坛作者名片/主页发起全局好友申请 | 未实现，需要 Group2 新增 |
| 论坛好友互动筛选 | 查看某好友发过、赞过、回过的帖子 | 未实现，由论坛组实现 |
| 圈内论坛 | 在圈内发帖，可选择是否同步到总论坛 | 路由/类型有痕迹，业务未实现，由论坛组实现 |

边界结论：

- 好友关系、好友申请、全局好友数据一致性：Group2 负责。
- 论坛里的帖子、点赞、回复、筛选、圈内论坛发帖/同步：论坛组负责。
- 联系方式申请链路已经有现成 API；论坛只需要在“已经是全局好友”之后调用。
- 圈内好友现在一旦通过，会同时写入圈内好友和全局好友；联系方式申请要求先存在全局好友。

## 2. 当前代码状态提醒

本说明按当前合并后的代码状态整理。

重要注意：

- `POST /api/v1/friends/requests` 当前必须传 `circleId`，只能申请圈内好友，不是论坛全局好友申请。
- 接受圈内好友申请时，当前会同时写入：
  - `friendships`：圈内好友关系。
  - `global_friendships`：全局好友关系。
- 联系方式申请 `POST /api/v1/contacts/unlock-request` 已支持 `sourceType: "address_book"`，不需要 `circleId`，但会校验双方已经是全局好友。
- `GET /api/v1/forum/posts` 和 `POST /api/v1/forum/posts` 的路由/前端类型里已有 `circleId`、`syncToGlobal` 字段，但当前 `forumService` 实际仍按总论坛处理：列表强制查 `circle_id is null`，发帖强制写 `circleId: null`。
- `GET /api/v1/card/:userId/public` 不是“任意论坛用户公开名片”接口。当前无 `circleId` 时要求同圈或全局好友，否则会返回不可见。

## 3. 数据模型边界

当前相关表：

| 表 | 用途 | 现状 |
| --- | --- | --- |
| `friendships` | 圈内好友关系 | `circle_id` 非空 |
| `global_friendships` | 全局好友关系 | 不记录来源 |
| `friend_requests` | 好友申请 | `circle_id` 非空，当前只支持圈内申请 |
| `contact_unlock_requests` | 联系方式申请 | 可支持 `source_type = address_book` 且 `circle_id = null` |
| `forum_posts` | 论坛帖子 | 有 `circle_id` 字段，但当前 service 未启用圈内论坛逻辑 |

新增论坛全局好友后，需要特别处理一个数据一致性点：

当前删除圈内好友时，代码会在“双方没有任何剩余圈内好友关系”时撤销 `global_friendships`。这是因为现阶段全局好友主要由圈内好友派生而来。若未来论坛也能单独建立全局好友，则 Group2 需要在实现全局好友申请时补一层来源判断，否则删除最后一个圈内好友可能误删论坛建立的全局好友。

可选实现方向：

- 给全局好友增加来源/保留原因，例如 `forum`、`circle:<circleId>`。
- 或增加独立的全局好友申请/来源表，用它判断是否还应保留 `global_friendships`。
- 或采用隐藏系统圈方案，但仍需要保证它不会被普通圈子删除逻辑误处理。

对论坛组来说，只需要依赖最终“是否全局好友”的判断，不需要关心内部存储方案。

## 4. 已实现 API

下面接口都带 `/api/v1` 前缀。

### 4.1 好友关系 API

#### `GET /api/v1/friends/grouped`

状态：已实现，Group2。

用途：

- 获取当前用户所有全局好友。
- 每个好友下会带双方仍然有效的圈内好友关系列表。
- 论坛可用它判断某个作者是否已经是全局好友。

主要返回字段：

```ts
{
  friends: Array<{
    userId: string;
    nickname: string | null;
    avatarUrl?: string;
    friendSince: string;
    circleCount: number;
    circles: Array<{
      circleId: string;
      circleName: string;
      friendSince: string;
    }>;
    contactStatus: "idle" | "sent" | "granted";
    contactCircleId?: string;
    hasUnlockedContacts: boolean;
  }>;
}
```

#### `POST /api/v1/friends/requests`

状态：已实现，但仅支持圈内好友申请。

请求：

```ts
{
  targetUserId: string;
  circleId: string;
  message?: string;
}
```

注意：

- `circleId` 必填。
- 会校验双方都在该兴趣圈。
- 当前不能用于总论坛“加全局好友”。

#### `GET /api/v1/friends/requests`

状态：已实现，当前返回圈内好友申请。

用途：

- 获取收到的待处理好友申请。
- 获取自己发出的已处理申请回执。

#### `PUT /api/v1/friends/requests/:requestId`

状态：已实现，当前处理圈内好友申请。

请求：

```ts
{
  action: "accept" | "reject";
}
```

当前接受逻辑：

- 写入该 `circleId` 下的 `friendships`。
- 同时确保存在 `global_friendships`。

#### `PUT /api/v1/friends/requests/:requestId/withdraw`

状态：已实现。

用途：发送方撤回好友申请。

#### `PUT /api/v1/friends/requests/:requestId/silent-reject`

状态：已实现。

用途：接收方静默拒绝好友申请。

#### `DELETE /api/v1/friends/:friendId?circleId=:circleId`

状态：已实现。

用途：删除某个圈内好友关系。

注意：如上文所述，未来有论坛全局好友后，需要避免误撤销仍由论坛关系保留的全局好友。

#### `DELETE /api/v1/friends/:friendId/all`

状态：已实现。

用途：删除和该用户的全部圈内好友关系及全局好友关系。

### 4.2 联系方式 API

#### `POST /api/v1/contacts/unlock-request`

状态：已实现，Group2。

论坛推荐用法：

```ts
{
  targetUserId: string;
  sourceType: "address_book";
  message?: string;
}
```

规则：

- 申请方和目标用户必须已经是全局好友。
- `sourceType: "address_book"` 时不需要 `circleId`。
- 若未成为全局好友，会返回 `NOT_FRIEND`。

圈内联系方式用法：

```ts
{
  targetUserId: string;
  sourceType: "circle";
  circleId: string;
  message?: string;
}
```

#### `GET /api/v1/contacts/status/:userId`

状态：已实现。

用途：查询当前用户对目标用户的联系方式申请状态。

无 `circleId` 时用于全局/同窗名录联系方式状态。

#### `GET /api/v1/contacts/:userId`

状态：已实现。

用途：查看已经解锁的联系方式。

规则：

- 必须是全局好友。
- 必须已有通过的联系方式申请或圈内联系方式授权。

#### `GET /api/v1/contacts/unlock-requests`

状态：已实现。

用途：获取收到的联系方式申请和自己发出的申请回执。

#### `PUT /api/v1/contacts/unlock-requests/:requestId`

状态：已实现。

请求：

```ts
{
  action: "approve" | "reject";
  contactIds?: string[];
}
```

全局/同窗名录联系方式申请不需要 `contactIds`；圈内联系方式申请同意时需要选择开放的圈内联系方式。

### 4.3 名片与论坛主页 API

#### `GET /api/v1/forum/users/:targetUserId/profile`

状态：已实现，论坛组。

用途：论坛作者主页公开信息。

当前返回：

```ts
{
  nickname: string;
  avatarUrl: string | null;
  signature: string | null;
  tags: string[];
  postCount: number;
  likeCount: number;
}
```

建议：论坛作者弹层/主页优先使用这个接口，而不是直接调用名片接口。

#### `GET /api/v1/forum/users/:targetUserId/posts`

状态：已实现，论坛组。

用途：查看某用户公开帖子。

注意：这不是“好友才能看的互动筛选”，只是当前论坛公开主页帖子列表。

#### `GET /api/v1/card/:userId/public`

状态：已实现，但不建议直接作为论坛陌生人公开名片使用。

当前规则：

- 带 `circleId`：要求双方同在该圈。
- 不带 `circleId`：要求双方同圈或已经是全局好友。
- 返回公开名片视图，不返回联系方式。

#### `GET /api/v1/card/:userId/friend`

状态：已实现。

当前规则：

- 不带 `circleId`：要求双方是全局好友。
- 带 `circleId`：要求双方是全局好友且是该圈圈内好友。

用途：好友视角名片。论坛里只有在确认已是全局好友后再使用。

### 4.4 当前论坛 API

#### `GET /api/v1/forum/posts`

状态：总论坛已实现；圈内论坛查询未实现。

当前可用参数：

```ts
{
  type?: "general" | "squad" | "help" | "trade" | "activity";
  page?: number;
  limit?: number;
  sort?: "latest" | "hot";
  authorScope?: "all" | "mine" | "liked" | "favorited";
  keyword?: string;
  circleId?: string;
}
```

注意：`circleId` 当前会传到 service，但 service 实际强制查询 `circle_id is null`。圈内论坛列表未启用。

#### `POST /api/v1/forum/posts`

状态：总论坛发帖已实现；圈内论坛发帖/同步未实现。

当前请求类型里存在：

```ts
{
  circleId?: string | null;
  title: string;
  content: string;
  type: "general" | "squad" | "help" | "trade" | "activity";
  isAnonymous?: boolean;
  visibility?: "public" | "private";
  images?: string[];
  syncToGlobal?: boolean;
}
```

注意：当前 service 实际写入 `circleId: null`，`syncToGlobal` 没有业务效果。

## 5. 未实现 API 与建议契约

### 5.1 申请论坛全局好友

建议接口：

```http
POST /api/v1/friends/global/requests
```

状态：未实现，Group2 负责。

用途：从总论坛作者主页、作者弹层、帖子详情等位置发起全局好友申请。

请求：

```ts
{
  targetUserId: string;
  message?: string;
}
```

响应：

```ts
{
  requestId: string;
  message: "申请已发送";
}
```

建议规则：

- 登录态必需。
- 不能申请自己。
- 目标用户必须存在。
- 被拉黑/互相拉黑时不可申请。
- 已经是全局好友时返回 `ALREADY_FRIENDS`。
- 双方已有待处理全局好友申请时返回 `REQUEST_EXISTS`。
- 不要求 `circleId`。
- 不要求双方同圈。
- 申请卡片快照只使用基础公开信息，不使用任何圈内名片信息。
- 过期、撤回、拒绝冷却规则可沿用现有好友申请策略。

配套改造，不一定新增 URL：

- `GET /api/v1/friends/requests` 需要能返回全局好友申请，建议增加：

```ts
{
  requestId: string;
  sourceType: "global" | "circle";
  circleId: string | null;
  circleName?: string | null;
}
```

- `PUT /api/v1/friends/requests/:requestId` 需要能处理 `sourceType: "global"` 的申请。
- 接受全局申请时只写入或确保 `global_friendships`，不要写入 `friendships`。
- 删除圈内好友时不能误删由论坛全局申请保留的 `global_friendships`。

### 5.2 论坛好友互动筛选

建议接口：

```http
GET /api/v1/forum/users/:targetUserId/activity
```

状态：未实现，论坛组负责。

建议参数：

```ts
{
  activity: "posted" | "liked" | "replied";
  circleId?: string;
  page?: number;
  limit?: number;
}
```

建议响应：

```ts
{
  total: number;
  page: number;
  limit: number;
  posts: Array<ForumPostDTO & {
    activityMeta?: {
      activity: "posted" | "liked" | "replied";
      interactedAt?: string;
      commentPreview?: string;
    };
  }>;
}
```

权限规则：

- 不传 `circleId`：总论坛维度，要求当前用户和 `targetUserId` 是全局好友。
- 传 `circleId`：圈内论坛维度，要求双方是该圈 active 成员，且是该圈圈内好友。
- 不能只靠前端判断好友关系，后端必须校验。
- 当前仓库内可复用 `areUsersGlobalFriends`、`areUsersCircleFriends` 作为服务层判断。

内容可见性规则：

- 只返回当前浏览者本来就有权限看的帖子。
- 删除帖、私密且无权访问的帖子不能返回。
- 不能通过该筛选反向识别匿名用户：目标用户匿名发的帖、匿名回复、以及会暴露匿名身份的互动应排除或脱敏。
- 点赞/回复筛选建议返回“被互动的帖子”，不要暴露不该公开的原始互动记录。

### 5.3 圈内论坛与同步总论坛

已有但未生效的契约：

```http
GET /api/v1/forum/posts?circleId=:circleId
POST /api/v1/forum/posts
```

请求中已有：

```ts
{
  circleId?: string | null;
  syncToGlobal?: boolean;
}
```

状态：路由/类型存在，业务未实现，论坛组负责。

建议规则：

- `circleId` 为空：发到总论坛。
- `circleId` 非空：发到圈内论坛，必须校验发帖人是该圈 active 成员。
- `syncToGlobal: true`：圈内帖同步到总论坛。可以选择一帖多可见范围或双帖子映射，但需要保证删除、举报、计数、详情跳转规则一致。
- 圈内论坛里的好友互动筛选必须按圈内好友校验，而不是只看全局好友。
- Group2 只提供好友关系判断；圈内论坛存储、同步、查询、展示都由论坛组实现。

## 6. 推荐前端流程

### 6.1 总论坛作者弹层/主页

1. 帖子非匿名时使用作者 `userId` 进入作者弹层/主页；匿名帖不要暴露作者入口。
2. 调用 `GET /api/v1/forum/users/:targetUserId/profile` 展示论坛公开主页信息。
3. 调用 `GET /api/v1/friends/grouped` 判断是否已经是全局好友。
4. 若不是全局好友，展示“加好友”，调用待实现的 `POST /api/v1/friends/global/requests`。
5. 若已经是全局好友，展示“申请联系方式”或联系方式状态。
6. 申请联系方式时调用 `POST /api/v1/contacts/unlock-request`，传 `sourceType: "address_book"`。

### 6.2 总论坛好友互动筛选

1. 用户在好友主页选择“发过 / 赞过 / 回过”。
2. 调用论坛组实现的 `GET /api/v1/forum/users/:targetUserId/activity?activity=...`。
3. 后端校验双方是全局好友。
4. 返回帖子列表，并按匿名、私密、删除等规则过滤。

### 6.3 圈内论坛好友互动筛选

1. 用户在某个圈内论坛选择圈内好友。
2. 调用论坛组实现的同一 activity 接口，并传 `circleId`。
3. 后端校验双方都是该圈 active 成员，且是该圈圈内好友。
4. 只返回该圈内当前用户有权查看的内容。

## 7. 分工清单

| 工作项 | 负责人 | 状态 |
| --- | --- | --- |
| 圈内好友申请与接受 | Group2 | 已实现 |
| 圈内好友通过后成为全局好友 | Group2 | 已实现 |
| 全局好友列表 `GET /friends/grouped` | Group2 | 已实现 |
| 联系方式申请与审批 | Group2 | 已实现 |
| 总论坛发帖、列表、详情、点赞、收藏、评论 | 论坛组 | 已实现 |
| 论坛作者公开主页 | 论坛组 | 已实现 |
| 总论坛发起全局好友申请 | Group2 | 未实现 |
| 让现有好友申请收件箱/处理接口兼容全局申请 | Group2 | 未实现 |
| 全局好友来源保留，避免删圈内好友时误删论坛全局好友 | Group2 | 未实现 |
| 总论坛好友互动筛选 | 论坛组 | 未实现 |
| 圈内论坛发帖、列表、同步总论坛 | 论坛组 | 未实现 |
| 圈内论坛按圈内好友筛选互动 | 论坛组 | 未实现 |

## 8. 论坛组联调时的最小依赖

在 Group2 新增全局好友申请前，论坛组可以先完成：

- 非匿名作者入口。
- `GET /api/v1/forum/users/:targetUserId/profile` 作者主页。
- 使用 `GET /api/v1/friends/grouped` 判断是否已经是全局好友。
- 已是全局好友后的 `POST /api/v1/contacts/unlock-request` 联系方式申请入口。
- 好友互动筛选接口的前后端结构，但后端先按全局好友判断留好调用点。

等待 Group2 补齐后再接：

- `POST /api/v1/friends/global/requests`。
- 全局好友申请在好友申请收件箱里的展示与处理。
- 全局好友来源保留逻辑。
