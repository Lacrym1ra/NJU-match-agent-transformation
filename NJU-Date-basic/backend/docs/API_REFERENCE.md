# NJU Match Backend - API Reference (接口文档)

Base URL: `/api/v1`

鉴权规则:
- 需要登录的接口使用 `Authorization: Bearer <JWT>`。
- 管理接口使用请求头 `X-Admin-Key: <admin_secret>`。

---

## 1. 认证模块 Auth

### POST /auth/login
账号密码登录。

**Request Body:**
```json
{
  "email": "student@smail.nju.edu.cn",
  "password": "your_password"
}
```

**Validation:**
- `email` 必须为 `@smail.nju.edu.cn`
- `password` 长度 6-72

**Response 200:**
```json
{
  "token": "<JWT_TOKEN>",
  "isNewUser": false,
  "user": {
    "id": "uuid",
    "email": "student@smail.nju.edu.cn",
    "profileComplete": true,
    "surveyComplete": false
  }
}
```

**Error 401:** 邮箱或密码错误

---

### POST /auth/send-code
发送注册验证码。

**Request Body:**
```json
{ "email": "student@smail.nju.edu.cn" }
```

**Response 200:**
```json
{ "message": "验证码已发送", "expiresIn": 300 }
```

---

### POST /auth/register
使用验证码注册并设置密码。

**Request Body:**
```json
{
  "email": "student@smail.nju.edu.cn",
  "code": "123456",
  "password": "your_password"
}
```

**Validation:**
- `code`: 6 位
- `password`: 6-72

**Response 200:**
```json
{
  "token": "<JWT_TOKEN>",
  "isNewUser": true,
  "user": {
    "id": "uuid",
    "email": "student@smail.nju.edu.cn",
    "profileComplete": false,
    "surveyComplete": false
  }
}
```

**Error 409:** 账号已存在

---

### POST /auth/forgot-password/send-code
忘记密码: 发送重置验证码。

**Request Body:**
```json
{ "email": "student@smail.nju.edu.cn" }
```

**Response 200:**
```json
{ "message": "若邮箱存在，验证码已发送", "expiresIn": 300 }
```

说明:
- 为避免账号枚举，该接口对邮箱是否存在返回统一提示。

---

### POST /auth/forgot-password/reset
忘记密码: 使用验证码重置密码。

**Request Body:**
```json
{
  "email": "student@smail.nju.edu.cn",
  "code": "123456",
  "newPassword": "new_password"
}
```

**Response 200:**
```json
{ "message": "密码已重置，请使用新密码登录" }
```

---

### POST /auth/verify-code (兼容接口)
历史兼容 OTP 登录接口，仅用于旧账号迁移。新流程请使用密码登录。

**Request Body:**
```json
{ "email": "student@smail.nju.edu.cn", "code": "123456" }
```

---

## 2. 用户档案模块 Profile

### GET /user/profile (需登录)
获取当前用户档案。

**Response 200:**
```json
{
  "id": "uuid",
  "email": "student@smail.nju.edu.cn",
  "nickname": "小明",
  "gender": "male",
  "genderPref": "female",
  "intention": "partner",
  "grade": "大三",
  "campus": "xianlin",
  "department": "计算机科学与技术系",
  "mbti": "INTJ",
  "bio": "喜欢阅读和跑步",
  "avatarUrl": null,
  "contactPlatform": "wechat",
  "contactId": "wxid_xxx",
  "isParticipating": true,
  "emailNotifications": true,
  "profileComplete": true,
  "surveyComplete": true,
  "createdAt": "2026-03-01T00:00:00Z"
}
```

---

### PUT /user/profile (需登录)
创建或更新用户档案。

**Request Body:**
```json
{
  "nickname": "小明",
  "gender": "male",
  "genderPref": "female",
  "intention": "partner",
  "grade": "大三",
  "campus": "xianlin",
  "department": "计算机科学与技术系",
  "mbti": "INTJ",
  "bio": "喜欢阅读和跑步",
  "contactPlatform": "wechat",
  "contactId": "wxid_xxx"
}
```

**Validation:**
- `gender`: `male | female`
- `genderPref`: `male | female | any`
- `intention`: `friend | partner`
- `campus`: `xianlin | gulou | suzhou | pukou`
- `grade`: 1-10 位字符
- `nickname`: 2-20 字符
- `bio`: 最多 200 字符
- `contactPlatform`: 选填 `wechat | qq | xiaohongshu`
- `contactId`: 选填，最多 50 字符

**Response 200:** 返回更新后的完整 profile

---

### PATCH /user/profile/draft (需登录)
静默保存 Onboarding 草稿字段，不会将 `profileComplete` 置为 `true`。

**Request Body (任意组合，至少 1 个字段):**
```json
{
  "nickname": "小明",
  "gender": "male",
  "genderPref": "female",
  "intention": "partner",
  "grade": "大三",
  "campus": "xianlin",
  "department": "计算机科学与技术系",
  "mbti": "INTJ"
}
```

**Validation:**
- 与正式档案字段规则一致。
- 至少包含一个可更新字段。

**Response 200:** 返回更新后的完整 profile

说明:
- 用于每步答题后的自动保存。
- 只有调用 `PUT /user/profile` 提交完整档案后，`profileComplete` 才会变为 `true`。

---

### PATCH /user/notifications (需登录)
切换邮件通知开关。

**Request Body:**
```json
{ "emailNotifications": false }
```

**Response 200:**
```json
{ "emailNotifications": false, "message": "匹配通知已关闭" }
```

说明:
- 关闭后不再收到匹配结果通知、提醒邮件。
- 默认值为 `true`。

---

### PATCH /user/status (需登录)
切换参与匹配状态。

**Request Body:**
```json
{ "isParticipating": false }
```

**Response 200:**
```json
{ "isParticipating": false, "message": "已暂停本期匹配" }
```

说明:
- 周三 18:00 – 周日 23:59 北京时间期间禁止修改，返回 400 错误。

---

### DELETE /user/account (需登录)
注销当前账户。

**Response 200:**
```json
{ "message": "账户已注销" }
```

---

## 3. 问卷模块 Survey

### GET /survey/questions
获取完整问卷题库。无需登录。

**Response 200:**
```json
{
  "version": "1.0",
  "sections": []
}
```

---

### POST /survey/submit (需登录)
提交问卷答案。可覆盖之前提交。

**Request Body:**
```json
{
  "answers": {
    "q1": { "value": "female" },
    "q21": { "value": 6, "importance": 3 }
  }
}
```

**Response 200:**
```json
{ "message": "问卷已提交", "surveyComplete": true }
```

说明:
- 周三 18:00 – 周日 23:59 北京时间期间禁止提交，返回 400 错误。

---

### GET /survey/answers (需登录)
获取当前用户问卷答案（用于回显/修改）。

**Response 200:**
```json
{
  "answers": {
    "q1": { "value": "female" }
  },
  "version": "1.0",
  "submittedAt": "2026-03-01T00:00:00Z"
}
```

**Response 404:** 尚未提交问卷

---

## 4. 匹配模块 Match

### GET /match/current (需登录)
获取本周匹配状态。

**Response 200 - 等待揭晓:**
```json
{
  "status": "PENDING",
  "revealAt": "2026-03-25T20:00:00+08:00",
  "message": "本周锦书尚未送达，请耐心等候"
}
```

**Response 200 - 本周未匹配:**
```json
{
  "status": "NO_MATCH",
  "message": "本周暂未找到与你灵魂共振的人，下周再试"
}
```

**Response 200 - 已揭晓:**
```json
{
  "status": "REVEALED",
  "match": {
    "matchId": "uuid",
    "compatibilityScore": 0.96,
    "partner": {
      "nickname": "陈同学",
      "department": "物理学院",
      "grade": "2021",
      "campus": "xianlin",
      "mbti": "ENFP",
      "bio": "热爱天体物理和户外探险",
      "avatarUrl": null
    },
    "insights": {
      "overallPercent": 96,
      "dimensions": {
        "values": 0.97,
        "lifestyle": 0.94,
        "dealbreakers": 1.0
      },
      "curatorNote": "你们都在『周六晚的理想放松方式』中选择了..."
    },
    "myAction": null,
    "partnerActed": false
  }
}
```

**Response 200 - 已过期:**
```json
{
  "status": "EXPIRED",
  "message": "本期匹配已过期，下周再试",
  "nextRevealAt": "2026-04-22T20:00:00+08:00",
  "match": {
    "matchId": "uuid",
    "compatibilityScore": 0.96,
    "partner": {
      "nickname": "陈同学",
      "department": "物理学院",
      "grade": "2021",
      "campus": "xianlin",
      "mbti": "ENFP",
      "bio": "热爱天体物理和户外探险",
      "avatarUrl": null
    },
    "insights": {
      "overallPercent": 96,
      "dimensions": {
        "values": 0.97,
        "lifestyle": 0.94,
        "dealbreakers": 1.0
      },
      "curatorNote": "你们都在『周六晚的理想放松方式』中选择了..."
    },
    "myAction": null,
    "partnerActed": false
  }
}
```

---

### POST /match/action (需登录)
对本周匹配做出选择。

**Request Body:**
```json
{ "matchId": "uuid", "action": "ACCEPT" }
```

**Response 200:**
```json
{
  "action": "ACCEPT",
  "message": "你的选择已记录，等待对方回应"
}
```

---

### GET /match/result/:matchId (需登录)
查询双选结果。

**Response 200 - 等待对方:**
```json
{ "status": "WAITING", "message": "对方尚未做出选择" }
```

**Response 200 - 双向奔赴:**
```json
{
  "status": "MUTUAL",
  "partnerContact": {
    "contactPlatform": "wechat",
    "contactId": "wxid_xxx",
    "wechatId": "wechat:wxid_xxx"
  },
  "message": "恭喜！你们双向奔赴了"
}
```

说明:
- 推荐读取 `partnerContact.contactPlatform + partnerContact.contactId`。
- `wechatId` 为兼容字段。

**Response 200 - 遗憾错过:**
```json
{ "status": "MISSED", "message": "很遗憾，缘分暂时止步于此" }
```

**Response 200 - 已过期:**
```json
{ "status": "EXPIRED", "message": "本期匹配已过期，无法再做选择" }
```

---

### GET /match/history (需登录)
获取历史匹配记录，分页。

**Query Params:** `page=1&limit=10`

**Response 200:**
```json
{
  "total": 5,
  "page": 1,
  "matches": [
    {
      "matchId": "uuid",
      "weekOf": "2026-03-18",
      "compatibilityScore": 0.92,
      "status": "MUTUAL",
      "partner": {
        "nickname": "李同学",
        "department": "文学院",
        "avatarUrl": null
      }
    }
  ]
}
```

---

## 5. 论坛模块 Forum (需登录)

所有接口需要 `Authorization: Bearer <JWT>`。基路径 `/api/v1`。

### 5.0 通用类型

**AuthorDTO**（所有外发接口统一，绝不包含 `userId`）：

```json
{ "nickname": "小明", "avatarUrl": null, "isOwn": false }
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `nickname` | string | 显示昵称；匿名楼主为 `"匿名楼主"` |
| `avatarUrl` | string\|null | 头像 URL；匿名时为 null |
| `isOwn` | boolean | 当前查看者是否就是该作者（替代 userId 判断所有权） |

---

### 5.1 帖子列表与发布

#### GET /forum/posts
获取帖子列表。圈子帖子仅圈子成员可见。

**Query Params:**

| 参数 | 类型 | 说明 |
|------|------|------|
| `circleId` | string? | 圈子筛选；空=全站 |
| `type` | `general\|squad\|help\|trade\|activity` | 类型筛选 |
| `sort` | `latest\|hot` | 排序方式，默认 `latest` |
| `authorScope` | `all\|mine\|liked\|favorited` | 作者范围筛选，默认 `all` |
| `page` | number | 默认 1 |
| `limit` | number | 默认 20，最大 50 |

**Response 200:**
```json
{
  "total": 50, "page": 1, "limit": 20,
  "posts": [
    {
      "postId": "uuid",
      "circleId": null,
      "title": "求三排搭子",
      "type": "squad",
      "author": { "nickname": "小明", "avatarUrl": null, "isOwn": false },
      "isAnonymous": false,
      "visibility": "public",
      "likeCount": 3,
      "favoriteCount": 1,
      "commentCount": 5,
      "viewCount": 120,
      "hotScore": 12.5,
      "hasImages": false,
      "isPinned": false,
      "createdAt": "2026-04-14T10:00:00Z"
    }
  ]
}
```

---

#### POST /forum/posts
发布帖子。`type=squad` 无资格限制，其他类型需 `profileComplete=true`。带 `circleId` 时需是圈子 active 成员。

**Request Body:**
```json
{
  "circleId": null,
  "title": "求三排搭子",
  "content": "仙林区域，晚上有空",
  "type": "squad",
  "isAnonymous": false,
  "visibility": "public",
  "images": ["/uploads/abc.jpg"]
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `circleId` | string\|null | 否 | 圈子 ID |
| `title` | string | 是 | 1-200 字符 |
| `content` | string | 是 | 1-10000 字符 |
| `type` | enum | 是 | 帖子类型 |
| `isAnonymous` | boolean | 否 | 是否匿名（仅楼主特权） |
| `visibility` | `public\|private` | 否 | 可见性，默认 `public` |
| `images` | string[] | 否 | 图片 URL 列表，最多 9 张 |

**Response 201:**
```json
{ "postId": "uuid", "message": "发布成功" }
```

---

### 5.2 帖子详情与操作

#### GET /forum/posts/:postId
获取帖子详情与两级评论（一级评论 + 每条 2 条预览回复）。

**Response 200:**
```json
{
  "post": {
    "postId": "uuid",
    "circleId": null,
    "title": "求三排搭子",
    "content": "仙林区域，晚上有空",
    "type": "squad",
    "author": { "nickname": "小明", "avatarUrl": null, "isOwn": true },
    "isAnonymous": false,
    "visibility": "public",
    "viewCount": 121,
    "likeCount": 3,
    "favoriteCount": 1,
    "commentCount": 8,
    "hotScore": 15.2,
    "hasImages": false,
    "isPinned": false,
    "likedByMe": true,
    "favoritedByMe": false,
    "images": [],
    "createdAt": "2026-04-14T10:00:00Z"
  },
  "comments": [
    {
      "commentId": "uuid",
      "author": { "nickname": "小红", "avatarUrl": null, "isOwn": false },
      "content": "我可以！",
      "commentType": "text",
      "voiceUrl": null,
      "voiceDurationSec": null,
      "transcript": null,
      "transcriptStatus": "none",
      "parentCommentId": null,
      "createdAt": "2026-04-14T10:20:00Z",
      "likeCount": 5,
      "likedByMe": false,
      "isAnonymousOP": false,
      "replyCount": 3,
      "previewReplies": [
        {
          "commentId": "uuid",
          "author": { "nickname": "小李", "avatarUrl": null, "isOwn": false },
          "content": "@小红 一起",
          "commentType": "text",
          "parentCommentId": "uuid",
          "replyToNickname": "小红",
          "likeCount": 1,
          "likedByMe": false,
          "isAnonymousOP": false,
          "createdAt": "2026-04-14T10:30:00Z"
        }
      ]
    }
  ]
}
```

**匿名处理规则：**
- 若帖子 `isAnonymous=true` 且查看者不是帖主，则帖主的所有评论显示 `author.nickname="匿名楼主"`、`avatarUrl=null`、`isOwn=false`
- `isAnonymousOP` 标记该评论是否来自匿名帖的帖主（前端可用于样式标识）
- 帖主自己查看时始终显示真实信息

---

#### PATCH /forum/posts/:postId/anonymity
切换匿名状态（帖主特权，可随时开关）。

**Request Body:**
```json
{ "isAnonymous": true }
```

**Response 200:**
```json
{ "isAnonymous": true, "message": "已开启匿名" }
```

- 幂等操作：状态未变化时返回 `"状态未变化"`
- 切换后所有历史评论即时生效（无写扩散，查询时派生）

---

#### PATCH /forum/posts/:postId/privacy
修改帖子可见性。

**Request Body:**
```json
{ "visibility": "private" }
```

**Response 200:**
```json
{ "message": "可见性已更新", "visibility": "private" }
```

---

#### PATCH /forum/posts/:postId/cancel-anonymous
> **@deprecated** 请使用 `PATCH /forum/posts/:postId/anonymity` 替代。内部等价于 `togglePostAnonymity(userId, postId, false)`。

---

#### POST /forum/posts/:postId/like
点赞帖子（幂等）。

**Response 200:**
```json
{ "message": "点赞成功", "liked": true }
```

---

#### DELETE /forum/posts/:postId/like
取消点赞（幂等）。

**Response 200:**
```json
{ "message": "已取消点赞", "liked": false }
```

---

#### POST /forum/posts/:postId/favorite
收藏帖子（幂等）。

**Response 200:**
```json
{ "message": "收藏成功", "favorited": true }
```

---

#### DELETE /forum/posts/:postId/favorite
取消收藏（幂等）。

**Response 200:**
```json
{ "message": "已取消收藏", "favorited": false }
```

---

#### DELETE /forum/posts/:postId
删除自己的帖子（软删除，设置 `deleted_at`）。

**Response 200:**
```json
{ "message": "帖子已删除" }
```

---

### 5.3 评论

#### POST /forum/posts/:postId/comments
发表评论或回复评论。支持文字或语音（互斥）。

**Request Body（文字评论）:**
```json
{
  "content": "我可以！",
  "parentCommentId": null,
  "commentType": "text"
}
```

**Request Body（语音评论）:**
```json
{
  "commentType": "voice",
  "voiceUrl": "/uploads/voice.mp3",
  "voiceDurationSec": 15,
  "parentCommentId": null
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `content` | string | text 时必填 | 1-2000 字符 |
| `commentType` | `text\|voice` | 否 | 默认 `text` |
| `voiceUrl` | string | voice 时必填 | 音频文件路径 |
| `voiceDurationSec` | number | 否 | 音频时长（秒），1-300 |
| `parentCommentId` | string\|null | 否 | 回复目标评论 ID |

**评论层级**：支持最多 2 级（一级评论 + 二级回复），不支持三级及更深嵌套。

**Response 201:**
```json
{ "commentId": "uuid", "rootCommentId": null, "message": "评论成功" }
```

- `rootCommentId`：二级回复时返回其根一级评论 ID，供前端定位

---

#### DELETE /forum/comments/:commentId
删除自己的评论（软删除）。一级评论级联软删所有二级回复，commentCount 同步扣减。

**Response 200:**
```json
{ "message": "评论已删除" }
```

---

#### GET /forum/comments/:rootCommentId/replies
分页获取某条一级评论的全部二级回复。

**Query Params:**

| 参数 | 类型 | 说明 |
|------|------|------|
| `page` | number | 默认 1 |
| `limit` | number | 默认 20，最大 50 |

**Response 200:**
```json
{
  "total": 15, "page": 1, "limit": 20,
  "replies": [
    {
      "commentId": "uuid",
      "author": { "nickname": "小李", "avatarUrl": null, "isOwn": false },
      "content": "@小红 一起",
      "commentType": "text",
      "parentCommentId": "uuid",
      "replyToNickname": "小红",
      "likeCount": 1,
      "likedByMe": false,
      "isAnonymousOP": false,
      "createdAt": "2026-04-14T10:30:00Z"
    }
  ]
}
```

---

#### POST /forum/comments/:commentId/like
点赞评论（幂等）。

**Response 200:**
```json
{ "liked": true, "likeCount": 6, "message": "点赞成功" }
```

---

#### DELETE /forum/comments/:commentId/like
取消点赞评论（幂等）。

**Response 200:**
```json
{ "liked": false, "likeCount": 5, "message": "已取消点赞" }
```

---

#### POST /forum/comments/:commentId/hide
隐藏评论（"不想看"，仅对当前用户生效）。

**Response 200:**
```json
{ "message": "已隐藏" }
```

---

#### POST /forum/comments/:commentId/transcript
提交语音评论异步转写任务。

**Response 200:**
```json
{ "message": "转写任务已提交", "transcriptStatus": "pending" }
```

状态机：`none → pending → success/failed`。转写文本写入 `forum_comments.transcript` 字段。

---

### 5.4 公告

#### GET /forum/announcements
获取启用的公告列表（仅标题，不含正文内容）。

**Response 200:**
```json
[
  {
    "id": "uuid",
    "title": "系统维护通知",
    "priority": 10,
    "createdAt": "2026-05-28T08:00:00Z"
  }
]
```

---

#### GET /forum/announcements/:id
获取公告详情（含正文内容）。

**Response 200:**
```json
{
  "id": "uuid",
  "title": "系统维护通知",
  "content": "将于 6 月 1 日凌晨进行系统维护，届时服务暂停约 2 小时。",
  "priority": 10,
  "createdAt": "2026-05-28T08:00:00Z"
}
```

---

### 5.5 留言板

#### GET /forum/guestbook/messages
分页获取留言板消息（仅可见）。

**Query Params:**

| 参数 | 类型 | 说明 |
|------|------|------|
| `page` | number | 默认 1 |
| `limit` | number | 默认 20，最大 50 |

**Response 200:**
```json
{
  "total": 100, "page": 1, "limit": 20,
  "messages": [
    {
      "id": "uuid",
      "content": "祝大家考试顺利！",
      "createdAt": "2026-05-27T12:00:00Z",
      "author": { "userId": "uuid", "nickname": "小明", "avatarUrl": null }
    }
  ]
}
```

---

#### POST /forum/guestbook/messages
发表留言。

**Request Body:**
```json
{ "content": "祝大家考试顺利！" }
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `content` | string | 1-200 字符 |

**Response 201:**
```json
{ "messageId": "uuid", "message": "留言成功" }
```

---

### 5.6 热榜

#### GET /forum/ranking/hot
获取热榜帖子列表（全时段公开帖，按 hotScore 降序）。

**Query Params:**

| 参数 | 类型 | 说明 |
|------|------|------|
| `limit` | number | 默认 20，最大 50 |

**Response 200:**
```json
[
  {
    "rank": 1,
    "postId": "uuid",
    "circleId": null,
    "title": "本周热门话题",
    "type": "general",
    "author": { "nickname": "小明", "avatarUrl": null, "isOwn": false },
    "isAnonymous": false,
    "hotScore": 98.5,
    "likeCount": 42,
    "favoriteCount": 15,
    "commentCount": 28,
    "viewCount": 520,
    "hasImages": true,
    "createdAt": "2026-05-25T10:00:00Z"
  }
]
```

---

### 5.7 用户通知

#### GET /user/notifications
分页获取通知列表。

**Query Params:**

| 参数 | 类型 | 说明 |
|------|------|------|
| `page` | number | 默认 1 |
| `limit` | number | 默认 20 |
| `isRead` | boolean | 过滤已读/未读 |
| `type` | string | 通知类型筛选 |

**Response 200:**
```json
{
  "total": 25, "page": 1, "limit": 20,
  "notifications": [
    {
      "id": "uuid",
      "type": "post_replied",
      "title": "有人回复了你的帖子",
      "content": "小红 回复了你的帖子「求三排搭子」",
      "meta": { "postId": "uuid", "commentId": "uuid" },
      "isRead": false,
      "createdAt": "2026-05-28T14:00:00Z"
    }
  ]
}
```

---

#### GET /user/notifications/unread-count
获取未读通知数量。

**Response 200:**
```json
{ "count": 5 }
```

---

#### PATCH /user/notifications/read-all
将所有通知标记为已读。

**Response 200:**
```json
{ "message": "已全部标记为已读" }
```

---

#### PATCH /user/notifications/:id/read
将单条通知标记为已读（含所有权校验）。

**Response 200:**
```json
{ "message": "已标记为已读" }
```

---

## 6. 管理模块 Admin (内部接口)

### POST /admin/trigger-matching
手动触发匹配算法。

**Headers:** `X-Admin-Key: <admin_secret>`

**Response 200:**
```json
{
  "message": "匹配完成",
  "stats": {
    "totalParticipants": 200,
    "matchedPairs": 95,
    "unmatched": 10,
    "matchRate": 0.95,
    "avgCompatibilityScore": 0.83,
    "weightLoss": 0.04
  }
}
```

---

### POST /admin/unlock-reveal
手动解锁本周揭晓。

**Headers:** `X-Admin-Key: <admin_secret>`

**Response 200:**
```json
{
  "message": "已解锁 95 对匹配",
  "unlockedCount": 95
}
```

### GET /admin/forum/posts
获取论坛帖子列表（含已删除）。支持按状态、类型、圈子筛选。

**Headers:** `X-Admin-Key: <admin_secret>`

**Query Params:**
| 参数 | 类型 | 说明 |
|------|------|------|
| `status` | `active \| deleted \| all` | 默认 `active` |
| `type` | `general \| squad \| help \| trade \| activity` | 帖子类型筛选 |
| `circleId` | string | 圈子筛选 |
| `page` | number | 默认 1 |
| `limit` | number | 默认 20，最大 50 |

**Response 200:**
```json
{
  "total": 30,
  "page": 1,
  "limit": 20,
  "posts": [
    {
      "postId": "uuid",
      "title": "求三排搭子",
      "type": "squad",
      "circleId": null,
      "author": { "userId": "uuid", "nickname": "小明" },
      "isPinned": false,
      "viewCount": 120,
      "deletedAt": null,
      "createdAt": "2026-04-14T10:00:00Z"
    }
  ]
}
```

---

### DELETE /admin/forum/posts/:postId
管理员强制下线帖子（软删除，写入审计日志）。

**Headers:** `X-Admin-Key: <admin_secret>`

**Response 200:**
```json
{ "message": "帖子已下线" }
```

---

### PUT /admin/forum/posts/:postId/pin
置顶或取消置顶帖子（写入审计日志）。

**Headers:** `X-Admin-Key: <admin_secret>`

**Request Body:**
```json
{ "isPinned": true }
```

**Response 200:**
```json
{ "message": "帖子置顶状态已更新", "postId": "uuid", "isPinned": true }
```

---

### GET /admin/forum/announcements
管理端分页列出所有公告（含已停用）。

**Headers:** `X-Admin-Key: <admin_secret>`

**Query Params:**

| 参数 | 类型 | 说明 |
|------|------|------|
| `page` | number | 默认 1 |
| `limit` | number | 默认 20，最大 50 |
| `isActive` | `true\|false` | 过滤启用/停用 |

**Response 200:**
```json
{
  "total": 5, "page": 1, "limit": 20,
  "announcements": [
    {
      "id": "uuid",
      "title": "系统维护通知",
      "content": "将于 6 月 1 日凌晨维护...",
      "createdBy": null,
      "isActive": true,
      "priority": 10,
      "startsAt": null,
      "endsAt": null,
      "createdAt": "2026-05-28T08:00:00Z"
    }
  ]
}
```

---

### POST /admin/forum/announcements
发布公告。

**Headers:** `X-Admin-Key: <admin_secret>`

**Request Body:**
```json
{
  "title": "系统维护通知",
  "content": "将于 6 月 1 日凌晨进行系统维护。",
  "isActive": true,
  "priority": 10
}
```

**Response 201:**
```json
{ "announcementId": "uuid", "message": "公告已发布" }
```

---

### PATCH /admin/forum/announcements/:id
更新公告。

**Headers:** `X-Admin-Key: <admin_secret>`

**Request Body (部分字段均可选):**
```json
{ "title": "更新后标题", "isActive": false }
```

**Response 200:**
```json
{ "message": "公告已更新", "announcementId": "uuid" }
```

---

### DELETE /admin/forum/announcements/:id
删除公告（物理删除）。

**Headers:** `X-Admin-Key: <admin_secret>`

**Response 200:**
```json
{ "message": "公告已删除" }
```

---

### GET /admin/forum/guestbook/messages
管理端分页列出所有留言（含已隐藏）。

**Headers:** `X-Admin-Key: <admin_secret>`

**Query Params:**

| 参数 | 类型 | 说明 |
|------|------|------|
| `page` | number | 默认 1 |
| `limit` | number | 默认 20，最大 50 |
| `status` | `visible\|hidden` | 过滤状态 |

---

### GET /admin/audit-logs
查询管理操作审计日志。

**Headers:** `X-Admin-Key: <admin_secret>`

**Query Params:**
| 参数 | 类型 | 说明 |
|------|------|------|
| `action` | string | 操作类型筛选，如 `admin_delete_forum_post` |
| `page` | number | 默认 1 |
| `limit` | number | 默认 20，最大 50 |

**Response 200:**
```json
{
  "total": 100,
  "page": 1,
  "limit": 20,
  "logs": [
    {
      "id": 5,
      "operatorId": null,
      "action": "admin_delete_forum_post",
      "target": null,
      "detail": "{\"postId\":\"uuid\"}",
      "ip": "::1",
      "result": "success",
      "createdAt": "2026-05-03T15:22:30Z"
    }
  ],
  "actions": ["admin_delete_forum_post", "admin_toggle_forum_pin", "trigger_matching"]
}
```

---

## 7. 公共统计

### GET /stats
获取首页公共统计数据。无需登录。

**Response 200:**
```json
{
  "totalUsers": 1000,
  "surveyCompletionRate": 87,
  "successfulMatches": 312
}
```

---

## 错误响应格式

所有错误统一返回:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "邮箱格式不正确",
    "details": [{ "field": "email", "message": "必须为 @smail.nju.edu.cn 邮箱" }]
  }
}
```

| HTTP Status | Code | 说明 |
|-------------|------|------|
| 400 | VALIDATION_ERROR | 请求参数校验失败 |
| 401 | UNAUTHORIZED | 未登录或 token 过期 |
| 403 | FORBIDDEN | 无权访问 |
| 404 | NOT_FOUND | 资源不存在 |
| 409 | CONFLICT | 重复操作 |
| 429 | RATE_LIMITED | 请求过于频繁 |
| 500 | INTERNAL_ERROR | 服务器内部错误 |
