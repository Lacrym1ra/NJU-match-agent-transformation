# API 设计

> 诚园闪击苏教
---


## 1. 责任边界

### 1.1 本组负责
- 论坛帖子与评论：列表、发布、详情、评论、软删除
- 论坛互动：点赞、收藏、热榜、匿名/私密、图片、语音评论、公告、留言板、个人论坛聚合
- 论坛互动补充：推荐排序、评论置顶、帖内投票
- 前端体验：发帖本地草稿保存与恢复（不新增后端草稿接口）
- 社交沟通：关注关系、私信资格判断、私信会话、私信发送和私信隐私设置
- 治理能力：用户举报、拉黑/取消拉黑、论坛内容举报
- 管理治理：用户举报审核、论坛举报审核、论坛删帖/置顶、公告与留言板管理
- 信用治理：论坛举报审核通过后的 1/3/5 扣分、信用分日志、低信用分发帖/评论限制
- 审计：管理端治理动作落审计日志

### 1.2 本文档不覆盖
- 圈子主业务接口
- 组队业务主流程接口
- 好友/名片/联系方式解锁
- 圈子匹配和联系方式交换流程；本文只覆盖私信本身的 REST API

---

## 2. 实现状态校准
- 已可联调：
  - `/api/v1/forum` 已在 `backend/src/index.ts` 挂载。
  - `/api/v1/social` 已挂载关注与私信接口。
  - 用户治理接口已覆盖用户举报与拉黑。
- 当前重要实现约束：
  - 论坛举报审核通过时必须选择扣分 `1/3/5`，并写入 `credit_score_logs`。
  - 发帖草稿为前端本地能力，不通过 API 持久化。
  - 推荐排序、评论置顶、帖内投票与私信均已按独立接口暴露。

---

## 3. 通用规范

### 3.1 Base URL
- `/api/v1`

### 3.2 鉴权
- 用户侧：`Authorization: Bearer <token>`
- 管理侧：`x-admin-key: <admin-key>`

### 3.3 响应格式
- 成功：按业务返回 JSON
- 失败（统一错误结构）：
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "参数不合法",
    "details": []
  }
}
```

### 3.4 通用错误码
- `VALIDATION_ERROR` (400)
- `UNAUTHORIZED` (401)
- `FORBIDDEN` (403)
- `NOT_FOUND` (404)
- `CONFLICT` (400/409)
- `PAYLOAD_TOO_LARGE` (413)
- `RATE_LIMITED` (429)
- `INTERNAL_ERROR` (500)

---

## 4. 用户侧治理接口

### 4.1 举报用户
- 方法与路径：`POST /user/report/:targetId`
- 鉴权：是
- 请求体：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| reasons | string[] | 是 | 1-5个，枚举：`harassment`/`spam`/`fake_profile`/`inappropriate_content`/`other` |
| detail | string | 否 | 最长500 |

- 业务规则：
- 不可举报自己
- 若同一举报人对同一目标已有 `pending` 举报，则更新该工单而非新增

- 成功响应（200）：
```json
{
  "message": "举报已提交，我们将尽快处理"
}
```

### 4.2 拉黑用户
- 方法与路径：`POST /user/block/:targetId`
- 鉴权：是
- 业务规则：
- 不可拉黑自己
- 幂等（重复拉黑不会报错）

- 成功响应（200）：
```json
{ "message": "已拉黑该用户" }
```

### 4.3 查询拉黑状态
- 方法与路径：`GET /user/block/:targetId`
- 鉴权：是
- 成功响应（200）：
```json
{ "blocked": true }
```

### 4.4 取消拉黑
- 方法与路径：`DELETE /user/block/:targetId`
- 鉴权：是
- 成功响应（200）：
```json
{ "message": "已解除拉黑" }
```

---

## 5. 管理端治理接口

### 5.1 举报列表
- 方法与路径：`GET /admin/reports`
- 鉴权：`x-admin-key`
- 查询参数：

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| status | string | 否 | 默认 `pending`；`all` 表示不按状态过滤 |
| page | number | 否 | 默认1 |
| limit | number | 否 | 默认20，最大100 |

- 成功响应（200）：
```json
{
  "total": 12,
  "page": 1,
  "limit": 20,
  "reports": [
    {
      "id": "uuid",
      "reporterId": "u1",
      "reportedId": "u2",
      "reason": "harassment,spam",
      "reasonText": "骚扰, 垃圾信息",
      "detail": "补充说明",
      "status": "pending",
      "createdAt": "2026-05-15T10:00:00Z"
    }
  ]
}
```

### 5.2 审核举报
- 方法与路径：`PATCH /admin/reports/:id`
- 鉴权：`x-admin-key`
- 请求体：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| status | enum | 是 | `reviewed`/`dismissed`/`warn_update`/`request_evidence` |
| adminNote | string | 否 | 最长500 |
| penaltyScore | number | 条件必填 | `status=reviewed` 时管理员选择 `1/3/5` 扣分 |

- 业务规则：
- `request_evidence`：不改状态，只通知举报人补充材料
- 其他状态：仅允许处理 `pending` 举报
- 审核通过按管理员选择扣分，并写入 `credit_score_logs`
- 处理动作写入 `audit_logs`

- 成功响应（200）：
```json
{
  "message": "举报状态已更新，通知邮件已按规则发送",
  "report": {
    "id": "uuid",
    "status": "reviewed"
  },
  "notifications": {
    "reporter": "sent",
    "reported": "sent"
  }
}
```

---

## 6. 论坛用户接口

> 说明：以下契约对应 `routes/forum.ts`，访问前缀为 `/api/v1/forum`。

### 6.1 帖子列表
- 方法与路径：`GET /forum/posts`
- 鉴权：是
- 查询参数：

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| circleId | uuid | 否 | 兼容字段；当前论坛主流程不依赖圈子分区 |
| type | enum | 否 | `general`/`squad`/`help`/`trade`/`activity` |
| sort | enum | 否 | `latest`/`hot` |
| keyword | string | 否 | 搜索标题和正文 |
| authorScope | enum | 否 | `all`/`mine`/`liked`/`favorited` |
| page | number | 否 | 默认1 |
| limit | number | 否 | 默认20，最大50 |

- 成功响应（200）：
```json
{
  "total": 50,
  "page": 1,
  "limit": 20,
  "posts": [
    {
      "postId": "uuid",
      "title": "求互助",
      "type": "help",
      "author": { "userId": "u1", "nickname": "小南", "avatarUrl": null },
      "isAnonymous": false,
      "visibility": "public",
      "images": [],
      "likeCount": 3,
      "favoriteCount": 1,
      "commentCount": 2,
      "viewCount": 35,
      "hotScore": 8.5,
      "hasPoll": true,
      "isLiked": false,
      "isFavorited": false,
      "isPinned": false,
      "createdAt": "2026-05-15T10:00:00Z"
    }
  ]
}
```

补充说明：`sort` 当前扩展支持 `recommended`，用于推荐流排序；旧客户端仍可按 `latest` 或 `hot` 使用。

### 6.2 发布帖子
- 方法与路径：`POST /forum/posts`
- 鉴权：是
- 请求体：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| title | string | 是 | 1-30 |
| content | string | 是 | 1-10000 |
| type | enum | 是 | `general`/`squad`/`help`/`trade`/`activity` |
| isAnonymous | boolean | 否 | 是否匿名 |
| visibility | enum | 否 | `public`/`private` |
| images | string[] | 否 | 最多9张图片 |
| pollOptions | string[] | 否 | 2-4 个投票选项，每项 1-15 字；不传则不创建投票 |
| circleId | uuid/null | 否 | 兼容字段 |

- 业务规则：
- 信用分 `<=85` 时禁止发帖
- 非 `squad` 帖需满足资料完整条件
- 当前实现中发帖统一写入全站论坛，`squad` 仅为普通标签
- 发帖可携带 `pollOptions` 创建帖内投票；投票选项随帖子事务写入
- 草稿保存由前端 `localStorage` 完成，不调用后端接口；发布成功后前端清理本地草稿

- 成功响应（201）：
```json
{ "postId": "uuid", "message": "发布成功" }
```

### 6.3 帖子详情
- 方法与路径：`GET /forum/posts/:postId`
- 鉴权：是
- 成功响应（200）：
```json
{
  "post": {
    "postId": "uuid",
    "title": "求互助",
    "content": "内容",
    "type": "help",
    "author": { "userId": "u1", "nickname": "小南" },
    "isAnonymous": false,
    "visibility": "public",
    "images": [],
    "likeCount": 3,
    "favoriteCount": 1,
    "commentCount": 2,
    "viewCount": 36,
    "hotScore": 9.1,
    "hasPoll": true,
    "isPinned": false,
    "createdAt": "2026-05-15T10:00:00Z"
  },
  "poll": {
    "options": [
      { "optionId": "uuid", "text": "A 方案", "voteCount": 3, "votedByMe": true },
      { "optionId": "uuid", "text": "B 方案", "voteCount": 1, "votedByMe": false }
    ],
    "myVoteOptionId": "uuid"
  },
  "pinnedCommentId": "comment-uuid",
  "comments": []
}
```

### 6.4 发布评论
- 方法与路径：`POST /forum/posts/:postId/comments`
- 鉴权：是
- 请求体：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| content | string | 条件必填 | 文字评论 1-2000 |
| parentCommentId | uuid/null | 否 | 二级回复时传入 |
| commentType | enum | 否 | `text`/`voice`，默认 `text` |
| voiceUrl | string | 条件必填 | 语音评论音频地址 |
| voiceDurationSec | number | 否 | 1-300 |

- 业务规则：
- 信用分 `<=85` 时禁止评论
- 文字评论不能带语音，语音评论不能带正文

- 成功响应（201）：
```json
{ "commentId": "uuid", "message": "评论成功" }
```

### 6.5 删除帖子（软删除）
- 方法与路径：`DELETE /forum/posts/:postId`
- 鉴权：是
- 成功响应（200）：
```json
{ "message": "帖子已删除" }
```

### 6.6 删除评论（软删除）
- 方法与路径：`DELETE /forum/comments/:commentId`
- 鉴权：是
- 成功响应（200）：
```json
{ "message": "评论已删除" }
```

### 6.7 帖子互动与可见性
- `PATCH /forum/posts/:postId/anonymity`：作者切换匿名状态
- `PATCH /forum/posts/:postId/cancel-anonymous`：取消匿名的兼容接口
- `PATCH /forum/posts/:postId/privacy`：作者切换 `public/private`
- `POST /forum/posts/:postId/like` / `DELETE /forum/posts/:postId/like`：点赞/取消点赞
- `POST /forum/posts/:postId/favorite` / `DELETE /forum/posts/:postId/favorite`：收藏/取消收藏
- `PUT /forum/posts/:postId/pinned-comment`：帖主置顶一级评论，请求体 `{ "commentId": "uuid" }`
- `DELETE /forum/posts/:postId/pinned-comment`：帖主取消当前置顶评论
- `POST /forum/posts/:postId/poll/vote`：帖内投票，请求体 `{ "optionId": "uuid" }`

补充业务规则：
- 评论置顶仅允许帖子作者操作，目标评论必须属于该帖子、未删除且为一级评论。
- 投票目标选项必须属于该帖子；同一用户对同一帖子只能保留一票。
- 点赞、收藏、投票和评论置顶均会影响帖子详情展示；点赞、收藏、评论和浏览会参与热度分更新。

### 6.8 评论互动
- `GET /forum/comments/:rootCommentId/replies`：分页拉取二级回复
- `POST /forum/comments/:commentId/like` / `DELETE /forum/comments/:commentId/like`：评论点赞/取消点赞
- `POST /forum/comments/:commentId/transcript`：语音评论转写

### 6.9 论坛辅助能力
- `GET /forum/ranking/hot`：热榜，查询参数 `range=day|week|month`、`limit`
- `GET /forum/posts?sort=recommended`：推荐流，基于用户画像、问卷兴趣、互动亲和、相似用户、新鲜度和质量分排序
- `GET /forum/announcements`：公告列表
- `GET /forum/announcements/:id`：公告详情
- `GET /forum/guestbook/messages`：留言板列表
- `POST /forum/guestbook/messages`：发布留言，最长200
- `DELETE /forum/guestbook/messages/:id`：删除自己的留言
- `GET /forum/me/posts`：我的帖子
- `GET /forum/me/liked-posts`：我点赞的帖子
- `GET /forum/me/favorited-posts`：我收藏的帖子
- `GET /forum/me/messages`：论坛消息
- `DELETE /forum/me/messages/:messageId`：移除论坛消息
- `GET /forum/users/:targetUserId/profile`：用户公开资料
- `GET /forum/users/:targetUserId/posts`：用户公开帖子

关注与私信接口：
- 访问前缀：`/api/v1/social`
- 鉴权：是

| 能力 | 方法与路径 | 说明 |
|---|---|---|
| 查询关注关系 | `GET /social/follows/:userId` | 返回我是否关注对方、对方是否关注我 |
| 关注列表 | `GET /social/follows?tab=mutual|following|followers` | 返回互相关注、我关注、关注我的用户 |
| 关注用户 | `POST /social/follows/:userId` | 不能关注自己，重复关注按幂等处理 |
| 取消关注 | `DELETE /social/follows/:userId` | 关系不存在时返回成功语义 |
| 查询私信隐私 | `GET /social/messages/privacy` | 返回 `allowDirectMessagesFrom` |
| 更新私信隐私 | `PUT /social/messages/privacy` | 可选 `all/following/mutual/none` |
| 私信会话列表 | `GET /social/messages?page=&limit=` | 按 `lastMessageAt` 倒序返回 |
| 私信资格 | `GET /social/messages/eligibility/:userId` | 返回是否可给目标用户发私信及原因 |
| 私信会话详情 | `GET /social/messages/:userId?before=&limit=` | 按用户对读取会话消息 |
| 发送私信 | `POST /social/messages/:userId` | 请求体 `{ "content": "..." }`，内容最长 800 |

私信业务规则：
- 不能给自己发私信。
- 被任一方拉黑时不可发送。
- 发送前必须满足接收方私信隐私设置：`all`、`following`、`mutual`、`none`。
- 会话按用户对唯一化，发送消息时自动创建或复用会话。
- 读取会话后可更新接收方消息已读状态。

### 6.10 论坛内容举报
- 方法与路径：`POST /forum/reports`
- 鉴权：是
- 请求体：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| targetType | enum | 是 | `post`/`comment` |
| postId | uuid | 条件必填 | 举报帖子时必填 |
| commentId | uuid | 条件必填 | 举报评论时必填 |
| reasons | string[] | 是 | 1-8个，枚举见实现 |
| detail | string | 否 | 最长2000 |

- 业务规则：
- 不可举报自己的帖子或评论
- 不可重复举报同一内容
- 若内容已有通过记录，用户侧仍提示提交成功，但不新增管理工单

- 成功响应（201）：
```json
{
  "reportId": "uuid",
  "status": "pending",
  "message": "举报已提交，等待管理员审核"
}
```

---

## 7. 管理端论坛接口

> 对应 `admin.ts` 中 `/admin/forum/*`。

### 7.1 管理员查帖
- 方法与路径：`GET /admin/forum/posts`
- 鉴权：`x-admin-key`
- 查询参数：

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| status | string | 否 | `active`/`deleted`/`all`，默认 `active` |
| circleId | uuid | 否 | 兼容筛选 |
| type | string | 否 | 类型筛选 |
| page | number | 否 | 默认1 |
| limit | number | 否 | 默认20，最大50 |

### 7.2 管理员删帖（软删除）
- 方法与路径：`DELETE /admin/forum/posts/:postId`
- 鉴权：`x-admin-key`
- 业务规则：已删除帖子和私密帖子不支持下线操作
- 成功响应（200）：
```json
{ "message": "帖子已下线" }
```

### 7.3 管理员置顶切换
- 方法与路径：`PUT /admin/forum/posts/:postId/pin`
- 鉴权：`x-admin-key`
- 请求体：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| isPinned | boolean | 是 | true 置顶 / false 取消置顶 |

- 业务规则：已删除帖子和私密帖子不支持置顶操作
- 成功响应（200）：
```json
{ "message": "帖子置顶状态已更新", "postId": "uuid", "isPinned": true }
```

### 7.4 论坛举报管理
- `GET /admin/forum/reports`：查询论坛举报，`status=pending|approved|rejected|all`
- `PATCH /admin/forum/reports/:id`：审核论坛举报

审核请求体：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| action | enum | 是 | `approve`/`reject` |
| adminNote | string | 否 | 最长500 |
| penaltyScore | number | 条件必填 | 通过时选择 `1`/`3`/`5` |

审核通过规则：
- 帖子举报通过：软删除帖子
- 评论举报通过：软删除评论，并将内容替换为违规删除提示
- 删除同一目标下其他待处理举报，避免重复处理
- 扣除被举报人信用分并写 `credit_score_logs`
- 写入 `audit_logs`

### 7.5 信用用户列表
- `GET /admin/forum/credit-users`：按最近一次通过举报时间排序返回用户信用分、信用等级、被举报统计
- `GET /admin/forum/credit-users/:userId/reports`：查看某用户被举报历史

### 7.6 公告与留言板管理
- `GET /admin/forum/announcements`
- `POST /admin/forum/announcements`
- `PATCH /admin/forum/announcements/:id`
- `DELETE /admin/forum/announcements/:id`
- `GET /admin/forum/guestbook/messages`
- `DELETE /admin/forum/guestbook/messages/:id`

---

## 8. 非功能与安全要求
- 全部写操作接口走参数校验（Zod）
- 举报、审核、管理删帖/置顶、公告和留言板管理必须记录审计日志
- 论坛私密内容只允许作者和管理侧按规则处理
- 推荐流和热榜只返回公开、未删除、符合可见性边界的帖子
- 私信接口必须执行拉黑、隐私设置和发送频率校验
- 低信用分限制必须由后端执行，前端提示不可替代后端校验
- 敏感操作应返回明确错误码与可读提示

---


## 9. AI 生成文档审查记录

### 9.1 发现问题
- 命名不一致：`report`/`reports`、`forum`/`forums` 混用
- 范围越界：把圈子主流程、组队全流程混入文档
- 错误处理缺失：未统一错误码和错误结构
- 安全项缺失：漏写鉴权头和权限要求
- 状态滞后：旧文档保留“论坛未挂载、管理端论坛关闭”的结论，已与当前代码不一致

### 9.2 修正结果
- 收敛责任边界，仅保留论坛与治理能力
- 按当前可联调能力重新标注接口状态
- 补齐论坛互动、公告、留言板、论坛举报与信用治理接口
- 补齐评论置顶、帖内投票、推荐排序、关注与私信接口
- 补齐请求参数、响应结构、错误码、权限约束
- 对齐当前代码行为，避免“文档可用但接口实际不可用”的偏差

---

## 10. API 概览

本文档覆盖 g3 负责的论坛与治理 REST API。接口分组如下：

| 分组 | 前缀 | 认证方式 | 主要职责 |
|---|---|---|---|
| 用户治理 | `/api/v1/user` | Bearer Token | 用户举报、拉黑、取消拉黑、查询拉黑状态 |
| 管理治理 | `/api/v1/admin` | `x-admin-key` | 用户举报列表、用户举报审核、审计 |
| 论坛用户端 | `/api/v1/forum` | Bearer Token | 发帖、看帖、评论、互动、公告、留言板、论坛举报 |
| 社交沟通端 | `/api/v1/social` | Bearer Token | 关注关系、私信隐私、私信资格、会话与消息 |
| 管理论坛端 | `/api/v1/admin/forum` | `x-admin-key` | 论坛举报审核、帖子治理、信用用户、公告与留言板管理 |

### 10.1 端点总览

| 能力 | 方法 | 路径 | 说明 |
|---|---|---|---|
| 帖子列表 | GET | `/forum/posts` | 支持类型、排序、关键词、作者范围筛选 |
| 发布帖子 | POST | `/forum/posts` | 支持匿名、私密、图片 |
| 帖子详情 | GET | `/forum/posts/:postId` | 返回帖子详情与评论 |
| 删除帖子 | DELETE | `/forum/posts/:postId` | 作者软删除 |
| 匿名切换 | PATCH | `/forum/posts/:postId/anonymity` | 作者切换匿名状态 |
| 可见性切换 | PATCH | `/forum/posts/:postId/privacy` | 作者切换公开/私密 |
| 点赞帖子 | POST/DELETE | `/forum/posts/:postId/like` | 点赞/取消点赞 |
| 收藏帖子 | POST/DELETE | `/forum/posts/:postId/favorite` | 收藏/取消收藏 |
| 置顶评论 | PUT/DELETE | `/forum/posts/:postId/pinned-comment` | 帖主置顶/取消置顶一级评论 |
| 帖内投票 | POST | `/forum/posts/:postId/poll/vote` | 对帖子投票选项投票 |
| 发布评论 | POST | `/forum/posts/:postId/comments` | 支持文字和语音评论 |
| 删除评论 | DELETE | `/forum/comments/:commentId` | 评论软删除 |
| 评论回复 | GET | `/forum/comments/:rootCommentId/replies` | 分页拉取二级回复 |
| 评论点赞 | POST/DELETE | `/forum/comments/:commentId/like` | 评论点赞/取消点赞 |
| 语音转写 | POST | `/forum/comments/:commentId/transcript` | 请求语音评论转写 |
| 热榜 | GET | `/forum/ranking/hot` | 支持 day/week/month |
| 公告 | GET | `/forum/announcements` | 获取公告列表 |
| 公告详情 | GET | `/forum/announcements/:id` | 获取公告正文 |
| 留言板列表 | GET | `/forum/guestbook/messages` | 分页读取留言 |
| 发布留言 | POST | `/forum/guestbook/messages` | 创建留言 |
| 删除留言 | DELETE | `/forum/guestbook/messages/:id` | 删除自己的留言 |
| 我的帖子 | GET | `/forum/me/posts` | 个人论坛聚合 |
| 我的点赞 | GET | `/forum/me/liked-posts` | 个人论坛聚合 |
| 我的收藏 | GET | `/forum/me/favorited-posts` | 个人论坛聚合 |
| 我的消息 | GET | `/forum/me/messages` | 论坛通知聚合 |
| 关注关系 | GET/POST/DELETE | `/social/follows*` | 查询、关注、取消关注 |
| 私信隐私 | GET/PUT | `/social/messages/privacy` | 查询和更新私信接收范围 |
| 私信资格 | GET | `/social/messages/eligibility/:userId` | 检查是否可发送私信 |
| 私信会话 | GET/POST | `/social/messages*` | 会话列表、会话详情、发送消息 |
| 论坛举报 | POST | `/forum/reports` | 举报帖子或评论 |
| 管理查帖 | GET | `/admin/forum/posts` | 管理端帖子列表 |
| 管理删帖 | DELETE | `/admin/forum/posts/:postId` | 管理端软删除公开帖 |
| 管理置顶 | PUT | `/admin/forum/posts/:postId/pin` | 管理端置顶/取消置顶 |
| 论坛举报列表 | GET | `/admin/forum/reports` | 管理端分页查询 |
| 论坛举报审核 | PATCH | `/admin/forum/reports/:id` | 通过/驳回并处理信用分 |
| 信用用户 | GET | `/admin/forum/credit-users` | 查看用户信用分与被举报统计 |
| 用户举报历史 | GET | `/admin/forum/credit-users/:userId/reports` | 查看某用户被举报历史 |
| 公告管理 | GET/POST/PATCH/DELETE | `/admin/forum/announcements*` | 管理论坛公告 |
| 留言板管理 | GET/DELETE | `/admin/forum/guestbook/messages*` | 查看和隐藏留言 |

---

## 11. 请求与响应约定

### 11.1 分页约定

分页接口统一使用：

| 参数 | 类型 | 默认值 | 上限 | 说明 |
|---|---|---|---|---|
| page | number | 1 | 无固定上限 | 从 1 开始 |
| limit | number | 20 | 50 或 100 | 用户侧通常最大 50，管理侧部分接口最大 100 |

分页响应通常包含：
```json
{
  "total": 42,
  "page": 1,
  "limit": 20,
  "items": []
}
```

实际字段名会按业务命名为 `posts`、`reports`、`messages`、`announcements` 等。

### 11.2 幂等约定

| 场景 | 幂等策略 |
|---|---|
| 重复拉黑 | 不重复创建关系，返回成功语义 |
| 重复点赞/收藏 | 通过唯一约束避免重复关系 |
| 重复投票 | 通过 `postId + userId` 唯一约束避免一人多票 |
| 重复关注 | 通过 `followerId + followeeId` 唯一约束避免重复关系 |
| 私信会话创建 | 通过规范化用户对保证双方只有一个会话 |
| 取消点赞/收藏 | 目标关系不存在时不应影响主资源 |
| 重复论坛举报 | 同一用户举报同一内容返回重复举报错误 |
| 重复审核举报 | 非 `pending` 工单不可重复审核 |
| 同一内容已有举报通过 | 清理同目标待处理举报，避免重复扣分 |

### 11.3 权限约定

| 资源 | 读取权限 | 写入/修改权限 |
|---|---|---|
| 公开帖子 | 登录用户 | 作者可编辑可见性/删除；管理员可治理 |
| 私密帖子 | 作者本人 | 作者本人 |
| 评论 | 可见帖子下的登录用户 | 评论作者可删；帖主可按规则删除一级评论 |
| 评论置顶 | 可见帖子下的登录用户可读 | 帖主可置顶或取消置顶一级评论 |
| 帖内投票 | 可见帖子下的登录用户可读 | 登录用户按一人一票规则投票 |
| 留言板消息 | 登录用户 | 作者可删；管理员可隐藏 |
| 私信会话 | 会话参与者 | 发送方需通过拉黑、关注关系和接收方隐私校验 |
| 论坛举报 | 登录用户可提交 | 管理员审核 |
| 信用分 | 用户侧展示自身状态；管理侧查看列表 | 仅治理审核流程写入 |

---

## 12. 错误响应

### 12.1 常见错误场景

| 错误码 | HTTP 状态 | 典型场景 |
|---|---|---|
| `VALIDATION_ERROR` | 400 | 参数缺失、枚举非法、内容长度超限 |
| `UNAUTHORIZED` | 401 | 未登录或 token 无效 |
| `FORBIDDEN` | 403 | 访问私密帖、信用分过低、非作者操作 |
| `NOT_FOUND` | 404 | 帖子、评论、举报单、公告或留言不存在 |
| `CONFLICT` | 400/409 | 重复举报、重复审核、已删除资源再次操作 |
| `CONFLICT` | 400/409 | 重复投票、重复关注、私信会话状态冲突 |
| `PAYLOAD_TOO_LARGE` | 413 | 请求体超过服务端限制 |
| `RATE_LIMITED` | 429 | 超过限流策略 |
| `INTERNAL_ERROR` | 500 | 未预期服务端错误 |

### 12.2 错误示例

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "当前信用分过低，已禁止发帖与评论"
  }
}
```

---

## 13. 关键业务流程接口串联

### 13.1 发帖与互动流程

1. 用户调用 `POST /forum/posts` 发布帖子。
2. 列表页调用 `GET /forum/posts` 展示帖子。
3. 详情页调用 `GET /forum/posts/:postId` 展示正文与评论。
4. 用户调用点赞、收藏、评论接口形成互动。
5. 热榜通过 `GET /forum/ranking/hot` 读取互动排序结果。

补充流程：
6. 用户在前端编辑器中可保存本地草稿，草稿不调用后端接口。
7. 发布帖子时可同时提交图片和 `pollOptions`。
8. 列表页可选择 `sort=recommended` 获取推荐排序。
9. 详情页可展示投票、置顶评论与评论树。
10. 用户可调用评论置顶或投票接口形成新增互动。

私信流程：
1. 用户进入他人主页或关注列表后，调用 `GET /social/messages/eligibility/:userId` 判断能否私信。
2. 若允许，调用 `GET /social/messages/:userId` 拉取会话历史。
3. 用户调用 `POST /social/messages/:userId` 发送消息。
4. 会话列表通过 `GET /social/messages` 按最近消息时间展示。

### 13.2 论坛举报审核流程

1. 用户调用 `POST /forum/reports` 举报帖子或评论。
2. 管理员调用 `GET /admin/forum/reports` 查看待处理举报。
3. 管理员调用 `PATCH /admin/forum/reports/:id` 选择 `approve` 或 `reject`。
4. 通过时系统软删除违规内容，扣除被举报人信用分，并写入 `credit_score_logs` 和 `audit_logs`。
5. 管理端信用用户页通过 `/admin/forum/credit-users` 查看治理结果。

### 13.3 用户举报与拉黑流程

1. 用户调用 `/user/report/:targetId` 提交用户维度举报。
2. 管理员通过 `/admin/reports` 查看并处理。
3. 用户可调用 `/user/block/:targetId` 拉黑对方。
4. 拉黑状态可通过 `GET /user/block/:targetId` 查询，必要时调用 `DELETE` 解除。

---

## 14. 版本与兼容说明

- API 基础路径为 `/api/v1`。
- `circleId` 在论坛帖子接口中保留为兼容字段，但论坛主流程不依赖圈子分区。
- `squad` 当前作为普通帖子类型标签，不承载组队主流程。
- `PATCH /forum/posts/:postId/cancel-anonymous` 为兼容接口，推荐使用 `/anonymity`。
- `sort=recommended` 为推荐排序扩展值；不影响旧客户端默认最新排序。
- 发帖草稿为前端本地兼容能力，不改变后端 API 版本。
- `/social/messages/*` 为私信接口，不替代论坛通知 `/forum/me/messages`。
