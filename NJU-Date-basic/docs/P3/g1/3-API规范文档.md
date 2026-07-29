# API 规范文档（用户主线与匹配子系统）

> 阶段：P3 详细设计  
> 小组：g1  
> Base URL：`/api/v1`

---

## 1. 通用约定

### 1.1 鉴权

除特别标注为公开接口外，接口均需要：

```http
Authorization: Bearer <jwt>
```

### 1.2 通用错误格式

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数不合法",
    "details": []
  }
}
```

### 1.3 通用错误码

| HTTP | code | 说明 |
|---:|---|---|
| 400 | `VALIDATION_ERROR` | 参数不合法或当前业务状态不允许 |
| 401 | `UNAUTHORIZED` | 未登录、Token 失效、验证码错误 |
| 404 | `NOT_FOUND` | 资源不存在或不可见 |
| 409 | `CONFLICT` | 重复操作或状态冲突 |
| 429 | `RATE_LIMITED` | 请求过于频繁 |
| 500 | `INTERNAL_ERROR` | 服务端异常 |

---

## 2. 认证接口

### 2.1 发送注册验证码

`POST /auth/send-code` `已实现`

请求体：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| email | string | 是 | 必须为 `@smail.nju.edu.cn` 邮箱 |

成功响应：

```json
{
  "message": "验证码已发送",
  "expiresIn": 300
}
```

失败场景：
- 400：邮箱格式不合法。
- 429：60 秒内重复发送。

### 2.2 注册

`POST /auth/register` `已实现`

请求体：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| email | string | 是 | 南大邮箱 |
| code | string | 是 | 6 位验证码 |
| password | string | 是 | 6-72 位 |

成功响应：

```json
{
  "token": "jwt",
  "isNewUser": true,
  "user": {
    "id": "uuid",
    "email": "student@smail.nju.edu.cn",
    "profileComplete": false,
    "surveyComplete": false
  }
}
```

失败场景：
- 401：验证码错误或过期。
- 409：账号已存在。

### 2.3 登录

`POST /auth/login` `已实现`

请求体：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| email | string | 是 | 南大邮箱 |
| password | string | 是 | 密码 |

成功响应：

```json
{
  "token": "jwt",
  "isNewUser": false,
  "user": {
    "id": "uuid",
    "email": "student@smail.nju.edu.cn"
  }
}
```

失败场景：
- 401：未注册、密码错误。

### 2.4 找回密码

`POST /auth/forgot-password/send-code` `已实现`

成功响应始终为：

```json
{
  "message": "若邮箱存在，验证码已发送",
  "expiresIn": 300
}
```

`POST /auth/forgot-password/reset` `已实现`

请求体：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| email | string | 是 | 南大邮箱 |
| code | string | 是 | 6 位验证码 |
| newPassword | string | 是 | 新密码，6-72 位 |

成功响应：

```json
{
  "message": "密码已重置，请使用新密码登录"
}
```

---

## 3. 用户资料与状态接口

### 3.1 获取当前用户资料

`GET /user/profile` `已实现`

成功响应：

```json
{
  "id": "uuid",
  "email": "student@smail.nju.edu.cn",
  "nickname": "南雍同学",
  "gender": "female",
  "genderPref": "male",
  "intention": "partner",
  "grade": "2023级",
  "campus": "xianlin",
  "department": "软件学院",
  "mbti": "INFJ",
  "bio": "喜欢散步和电影",
  "isParticipating": true,
  "profileComplete": true,
  "surveyComplete": true,
  "contactPlatform": "wechat",
  "contactId": "wxid"
}
```

### 3.2 更新完整资料

`PUT /user/profile` `已实现`

请求体：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| nickname | string | 是 | 1-20 字，不允许 HTML |
| gender | enum | 是 | `male/female` |
| genderPref | enum | 是 | `male/female/any` |
| intention | enum | 是 | `friend/partner` |
| grade | string | 是 | 年级 |
| campus | enum | 是 | `xianlin/gulou/suzhou/pukou` |
| department | string | 是 | 院系 |
| mbti | string | 否 | MBTI |
| bio | string | 否 | 最多 200 字 |
| contactPlatform | enum | 否 | `wechat/qq/xiaohongshu` |
| contactId | string | 否 | 联系方式 |
| emailNotifications | boolean | 否 | 邮件提醒开关 |

成功后 `profileComplete=true`。

### 3.3 保存资料草稿

`PATCH /user/profile/draft` `已实现`

说明：静默保存 Onboarding 草稿，不改变 `profileComplete`。请求体至少包含一个可更新字段。

### 3.4 切换长期参与状态

`PATCH /user/status` `已实现`

请求体：

```json
{
  "isParticipating": true
}
```

成功响应：

```json
{
  "isParticipating": true,
  "message": "已开启匹配"
}
```

限制：匹配锁定窗口内不可修改。

### 3.5 暂停/恢复本周匹配

`PATCH /user/pause-week` `已实现`

请求体：

```json
{
  "pause": true
}
```

成功响应：

```json
{
  "pauseUntilWeek": "2026-05-20",
  "message": "已暂停本周匹配，下周将自动恢复"
}
```

### 3.6 邮件提醒开关

`PATCH /user/notifications` `已实现`

说明：这是邮件提醒偏好，不是站内消息中心。

请求体：

```json
{
  "emailNotifications": false
}
```

### 3.7 注销账户

`DELETE /user/account` `已实现`

说明：清除个人身份信息，保留匿名化用户行以维持匹配外键完整性。

成功响应：

```json
{
  "message": "账户已注销，个人信息已清除"
}
```

---

## 4. 问卷接口

### 4.1 获取问卷题目

`GET /survey/questions` `已实现，公开`

成功响应：返回问卷版本、题目列表、题型、选项、权重等结构。

### 4.2 提交问卷

`POST /survey/submit` `已实现`

请求体：

```json
{
  "answers": {
    "q_love_view": {
      "value": 6,
      "importance": 5
    },
    "q_interests": {
      "value": ["movie", "walk"]
    }
  }
}
```

字段说明：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| answers | object | 是 | key 为题目 ID |
| answers.*.value | unknown | 是 | 按题型可为数字、字符串、字符串数组 |
| answers.*.importance | number | 否 | 1-5 |

限制：匹配锁定窗口内不可提交。

### 4.3 获取我的问卷答案

`GET /survey/answers` `已实现`

成功响应：

```json
{
  "answers": {},
  "version": "4.0",
  "submittedAt": "2026-05-16T10:00:00.000Z"
}
```

---

## 5. 匹配与揭晓接口

### 5.1 当前匹配状态

`GET /match/current` `已实现`

可能响应：

```json
{
  "status": "PENDING",
  "revealAt": "2026-05-20T20:00:00+08:00",
  "message": "本周锦书尚未送达，请耐心等候"
}
```

```json
{
  "status": "REVEALED",
  "message": "锦书已送达",
  "match": {
    "matchId": "uuid",
    "compatibilityScore": 0.86,
    "partner": {
      "id": "uuid",
      "nickname": "南雍同学",
      "department": "软件学院",
      "grade": "2023级",
      "campus": "xianlin",
      "mbti": "INFJ",
      "bio": "喜欢散步和电影"
    },
    "insights": {
      "overallPercent": 86,
      "dimensions": {},
      "dimensionInsights": [],
      "sharedInterests": ["movie"],
      "curatorNote": "你们有相近的节奏。"
    },
    "myAction": null,
    "partnerActed": false
  }
}
```

状态枚举：

| 状态 | 说明 |
|---|---|
| `WAITING` | 尚未到揭晓时间且没有结果 |
| `NO_MATCH` | 本周未匹配到 |
| `PENDING` | 已生成但未揭晓 |
| `REVEALED` | 可查看并选择 |
| `EXPIRED` | 已过 48 小时选择窗口 |

### 5.2 记录匹配选择

`POST /match/action` `已实现`

请求体：

```json
{
  "matchId": "uuid",
  "action": "ACCEPT"
}
```

成功响应：

```json
{
  "action": "ACCEPT",
  "message": "你的选择已记录，等待对方回应"
}
```

失败场景：
- 404：匹配不存在或不属于当前用户。
- 409：已操作、未揭晓、已过期。

### 5.3 查询双选结果

`GET /match/result/:matchId` `已实现`

成功响应：

```json
{
  "status": "MUTUAL",
  "partnerContact": {
    "contactPlatform": "wechat",
    "contactId": "wxid"
  },
  "message": "恭喜！你们双向奔赴了"
}
```

其他状态：`WAITING`、`MISSED`、`EXPIRED`。

### 5.4 匹配历史

`GET /match/history?page=1&limit=10` `已实现`

成功响应：

```json
{
  "total": 3,
  "page": 1,
  "matches": [
    {
      "matchId": "uuid",
      "weekOf": "2026-05-13",
      "compatibilityScore": 0.82,
      "status": "MUTUAL",
      "partner": {
        "id": "uuid",
        "nickname": "南雍同学",
        "department": "软件学院",
        "avatarUrl": null
      }
    }
  ]
}
```

---

## 6. 站内消息中心接口

当前状态：`设计已定，未注册路由`。

### 6.1 消息列表

`GET /notifications?page=1&limit=20&status=all`

`status` 可选：`all/read/unread`。

成功响应：

```json
{
  "total": 18,
  "page": 1,
  "limit": 20,
  "items": [
    {
      "id": "notif_001",
      "type": "match_revealed",
      "title": "本周锦书已送达",
      "body": "你本周的匹配结果已经揭晓，点击查看。",
      "level": "info",
      "isRead": false,
      "actionUrl": "/reveal",
      "createdAt": "2026-05-16T12:00:00.000Z",
      "readAt": null,
      "meta": {
        "weekOf": "2026-05-13"
      }
    }
  ]
}
```

### 6.2 未读数

`GET /notifications/unread-count`

```json
{
  "unreadCount": 3
}
```

### 6.3 单条已读

`POST /notifications/:id/read`

```json
{
  "message": "消息已标记为已读"
}
```

### 6.4 全部已读

`POST /notifications/read-all`

```json
{
  "message": "已全部标记为已读",
  "updated": 6
}
```

---

## 7. AI 辅助审查记录

| 审查项 | AI 初稿问题 | 人工修正 |
|---|---|---|
| 接口命名 | 把站内消息写成 `/user/notifications` | 明确 `/user/notifications` 是邮件偏好，站内消息为 `/notifications` |
| 错误处理 | 缺少 409 状态冲突 | 为匹配操作补充已操作、已过期、未揭晓等冲突场景 |
| 参数校验 | 问卷答案类型写死为字符串 | 改为按题型支持 number/string/string[] |
| 安全问题 | 忘记南大邮箱限制和验证码限流 | 补充 `@smail.nju.edu.cn`、60 秒发送限制、验证码错误锁定 |
| 实现状态 | 把 `/notifications` 当作已实现 | 标注为设计已定、未注册路由 |

