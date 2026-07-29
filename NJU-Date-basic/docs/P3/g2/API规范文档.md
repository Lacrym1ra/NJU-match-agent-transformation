# 阶段 3：API 规范
## Circle 与关系链模块（第 2 组）

**版本：** 1.1（与当前代码实现对齐）
**日期：** 2026-05-15
**范围：** circles、friendships、contacts、teamups、circle/teamup chat 和 G2 相关消息通知入口

---

## 1. API 概览

本文档规定了 NJU-Date 后端中由第 2 组负责实现的 REST API 端点：
- **Circles：** 社区发现、成员关系、问卷、匹配
- **Friends：** 关系管理、请求处理
- **Contacts：** 圈内联系方式设置、基于权限的字段解锁请求
- **Teamups：** 活动小组创建与参与
- **Chat：** 圈子实时群聊与组队实时群聊

**团队协作边界说明：** 注册、登录、验证码、密码重置等认证能力由第 1 组主责，G2 API 文档仅说明所有受保护端点依赖 `Authorization: Bearer <token>`。上传的 P3 要求中“注册/登录接口”的验收项在本项目中由跨组交付满足，本文件不重复展开认证模块的完整 request/response。

所有端点都需要通过 `Authorization: Bearer <token>` header 进行认证（公开端点除外）。

---

## 2. Circle API

### 2.1 列出所有 Circles

**端点：** `GET /circles`

**认证：** 必需

**查询参数：**
| 参数 | 类型 | 是否必需 | 描述 |
|-----------|------|----------|-------------|
| category | String | 否 | 按 circle category 过滤（sports、academic、arts、professional、lifestyle） |
| keyword | String | 否 | 按名称/简介搜索 |
| tags / tag | String | 否 | 逗号分隔标签过滤 |
| department | String | 否 | 按院系过滤 |
| grade | String | 否 | 按年级过滤 |
| sort | String | 否 | `recommended|active|members|latest` |
| page | Integer | 否 | 页码，默认 1 |
| limit | Integer | 否 | 每页条目数，默认 20，最大 50 |

**响应（200 OK）：**
```json
{
  "circles": [
    {
      "id": "uuid",
      "name": "String",
      "slug": "String",
      "category": "String",
      "tag": "String",
      "memberCount": 42,
      "isActive": true,
      "description": "String（可选）"
    }
  ]
}
```

**错误：**
- 401 Unauthorized：缺少 authentication token（认证令牌）或 token 无效

---

### 2.2 获取我的 Circles

**端点：** `GET /circles/my`

**认证：** 必需

**响应（200 OK）：**
```json
{
  "circles": [
    {
      "id": "uuid",
      "name": "String",
      "slug": "String",
      "category": "String",
      "tag": "String",
      "memberCount": 42,
      "isActive": true,
      "membershipStatus": "active|pending",
      "joinedAt": "ISO8601 Timestamp"
    }
  ]
}
```

---

### 2.3 获取 Circle 详情

**端点：** `GET /circles/:circleId`

**认证：** 必需

**路径参数：**
| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| circleId | UUID | Circle 标识符 |

**响应（200 OK）：**
```json
{
  "circle": {
    "id": "uuid",
    "name": "String",
    "slug": "String",
    "description": "Text",
    "category": "String",
    "tags": ["tag1", "tag2"],
    "iconUrl": "URL",
    "creatorId": "uuid",
    "memberCount": 42,
    "isActive": true,
    "status": "active|inactive|archived",
    "membership": {
      "membershipStatus": "active|pending",
      "joinedAt": "ISO8601",
      "answersComplete": true
    }
  },
  "components": [
    {
      "moduleKey": "String",
      "displayOrder": 0,
      "name": "String",
      "label": "String",
      "topLeft": [x, y],
      "width": number,
      "height": number,
      "status": "public|hidden|deleted"
    }
  ]
}
```

**错误：**
- 404 Not Found：Circle 不存在，或用户缺少权限
- 403 Forbidden：用户不是该 circle 的成员

---

### 2.4 获取 Circle 成员

**端点：** `GET /circles/:circleId/channel`

**认证：** 必需

**路径参数：**
| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| circleId | UUID | Circle 标识符 |

**查询参数：**
| 参数 | 类型 | 默认值 | 描述 |
|-----------|------|---------|-------------|
| page | Integer | 1 | 页码（从 1 开始） |
| limit | Integer | 20 | 每页条目数（1-50） |
| nearby | Boolean | false | 是否按附近成员过滤/排序 |
| radiusMeters | Integer | 无 | 附近过滤半径 |
| includeUnknownDistance | Boolean | false | 是否包含未共享位置的成员 |

**响应（200 OK）：**
```json
{
  "data": [
    {
      "userId": "uuid",
      "nickname": "String",
      "avatarUrl": "URL",
      "gender": "male|female",
      "department": "String",
      "membershipStatus": "active|pending"
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 42
}
```

---

### 2.5 加入 Circle

**端点：** `POST /circles/:circleId/join`

**认证：** 必需

**路径参数：**
| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| circleId | UUID | Circle 标识符 |

**请求体：**
```json
{
  "inviteCode": "可选邀请码",
  "answer": "兼容旧版单题答案",
  "answers": {
    "questionId": "答案"
  },
  "applicationReason": "可选申请理由"
}
```

**响应（200 OK）：**
```json
{
  "message": "已加入圈子|申请已提交",
  "membershipStatus": "active|pending",
  "requestId": "uuid（需要审核时返回）",
  "circleId": "uuid"
}
```

**错误：**
- 403 Forbidden：用户不满足隐私/凭证要求（信用分不足、不满足 circle 门槛，或被 PrivacyEngine 阻止）
- 404 Not Found：Circle 不存在
- 409 Conflict：用户已经是成员
- 400 Bad Request：Circle 成员数量已达上限，或用户不满足条件

---

### 2.6 退出 Circle

**端点：** `DELETE /circles/:circleId/leave`

**认证：** 必需

**路径参数：**
| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| circleId | UUID | Circle 标识符 |

**响应（200 OK）：**
```json
{
  "success": true
}
```

**错误：**
- 404 Not Found：成员关系不存在
- 400 Bad Request：无法退出（例如，创建者不能退出自己的 circle）

---

### 2.7 获取 Circle 问卷

**端点：** `GET /circles/:circleId/questionnaire`

**认证：** 必需

**路径参数：**
| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| circleId | UUID | Circle 标识符 |

**响应（200 OK）：**
```json
{
  "circleId": "uuid",
  "questions": [
    {
      "id": "uuid",
      "key": "String",
      "type": "scale|single_choice|multi_choice|ranking",
      "prompt": "String",
      "options": ["option1", "option2"],
      "weight": 1.0,
      "displayOrder": 0,
      "isChannelTag": false
    }
  ]
}
```

---

### 2.8 提交 Circle 问卷

**端点：** `POST /circles/:circleId/questionnaire`

**认证：** 必需

**路径参数：**
| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| circleId | UUID | Circle 标识符 |

**请求体：**
```json
{
  "answers": {
    "questionKey": {
      "value": "answer_value",
      "importance": 3
    }
  }
}
```

**响应（200 OK）：**
```json
{
  "success": true,
  "answersComplete": true
}
```

**错误：**
- 400 Bad Request：答案格式无效或缺少必填字段
- 404 Not Found：Question 不存在

---

### 2.9 获取当前 Circle Match

**端点：** `GET /circles/:circleId/match/current`

**认证：** 必需

**路径参数：**
| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| circleId | UUID | Circle 标识符 |

**响应（200 OK）：**
```json
{
  "status": "LOCKED|REVEALED|MUTUAL|MISSED|NO_MATCH|WAITING",
  "match": {
    "id": "uuid",
    "circleId": "uuid",
    "weekOf": "YYYY-MM-DD",
    "partner": {
      "id": "uuid",
      "nickname": "String",
      "gender": "male|female",
      "department": "String",
      "avatarUrl": "URL"
    },
    "score": 0.85,
    "userAAction": "ACCEPT|REJECT|null",
    "userBAction": "ACCEPT|REJECT|null",
    "revealedAt": "ISO8601（可选）"
  },
  "message": "String（WAITING/NO_MATCH 的状态消息）"
}
```

---

### 2.10 记录 Circle Match 操作

**端点：** `POST /circles/:circleId/match/action`

**认证：** 必需

**路径参数：**
| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| circleId | UUID | Circle 标识符 |

**请求体：**
```json
{
  "matchId": "uuid",
  "action": "ACCEPT|REJECT"
}
```

**响应（200 OK）：**
```json
{
  "success": true,
  "matchId": "uuid",
  "action": "ACCEPT|REJECT",
  "recordedAt": "ISO8601 Timestamp"
}
```

---

### 2.11 获取 Circle Match 历史

**端点：** `GET /circles/:circleId/match/history`

**认证：** 必需

**路径参数：**
| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| circleId | UUID | Circle 标识符 |

**查询参数：**
| 参数 | 类型 | 默认值 | 描述 |
|-----------|------|---------|-------------|
| page | Integer | 1 | 页码 |
| limit | Integer | 10 | 每页条目数（最大 50） |

**响应（200 OK）：**
```json
{
  "data": [
    {
      "id": "uuid",
      "weekOf": "YYYY-MM-DD",
      "partner": { "id": "uuid", "nickname": "String", ... },
      "score": 0.85,
      "userAAction": "ACCEPT|REJECT|null",
      "status": "REVEALED|MUTUAL|MISSED|EXPIRED",
      "revealedAt": "ISO8601"
    }
  ],
  "page": 1,
  "limit": 10,
  "total": 25
}
```

---

### 2.12 Circle 管理、入圈审核、黑名单与位置扩展

以下接口已经在当前代码中实现，用于支撑圈子创建审核、圈主管理、入圈申请、黑名单和附近成员能力：

| 功能 | 方法 | 路径 |
|---|---|---|
| 创建自定义 circle | POST | `/circles` |
| 获取我创建的 circles | GET | `/circles/my-created` |
| 获取我发出的入圈申请 | GET | `/circles/join-requests/sent` |
| 撤回入圈申请 | PUT | `/circles/join-requests/:requestId/withdraw` |
| 管理概览 | GET | `/circles/:circleId/manage/overview` |
| 更新 circle 信息 | PATCH | `/circles/:circleId` |
| 更新入圈策略 | PUT | `/circles/:circleId/join-policy` |
| 管理成员列表 | GET | `/circles/:circleId/manage/members` |
| 移除成员 | DELETE | `/circles/:circleId/members/:userId` |
| 查看黑名单 | GET | `/circles/:circleId/blacklist` |
| 加入黑名单 | POST | `/circles/:circleId/blacklist` |
| 移出黑名单 | DELETE | `/circles/:circleId/blacklist/:userId` |
| 转让圈主 | POST | `/circles/:circleId/transfer-owner` |
| 归档 circle | DELETE | `/circles/:circleId` |
| 查看审计日志 | GET | `/circles/:circleId/audit-logs` |
| 查看入圈申请 | GET | `/circles/:circleId/join-requests` |
| 审核入圈申请 | PUT | `/circles/:circleId/join-requests/:requestId` |
| 前端兼容审核别名 | PUT | `/circles/:circleId/requests/:requestId` |
| 查看我的位置共享状态 | GET | `/circles/:circleId/location/me` |
| 更新位置共享 | PUT | `/circles/:circleId/location` |
| 关闭位置共享 | DELETE | `/circles/:circleId/location` |

**说明：** 入圈策略支持 `public|review|invite`，并可配置最多 5 个入圈问题、容量上限和关键词拒绝规则。位置共享以 `circle_member_locations` 和 cooldown 表记录，不把实时地理坐标混入成员关系表。

---

## 3. Friend API

### 3.1 获取好友（Friend）列表

**端点：** `GET /friends`

**认证：** 必需

**响应（200 OK）：**
```json
{
  "friends": [
    {
      "friendId": "uuid",
      "nickname": "String",
      "avatarUrl": "URL",
      "gender": "male|female",
      "department": "String",
      "sharedCircles": [
        { "id": "uuid", "name": "String" }
      ]
    }
  ]
}
```

---

### 3.2 获取分组好友（Friends）

**端点：** `GET /friends/grouped`

**认证：** 必需

**响应（200 OK）：**
```json
{
  "globalFriends": [
    { "friendId": "uuid", "nickname": "String", ... }
  ],
  "circleFriends": {
    "circleId": [
      { "friendId": "uuid", "nickname": "String", ... }
    ]
  }
}
```

---

### 3.3 发送好友请求（Friend Request）

**端点：** `POST /friends/request` 或兼容别名 `POST /friends/requests`

**认证：** 必需

**请求体：**
```json
{
  "targetUserId": "uuid",
  "circleId": "uuid",
  "message": "可选消息（最多 500 个字符）"
}
```

**响应（201 Created）：**
```json
{
  "requestId": "uuid",
  "message": "申请已发送"
}
```

**全局好友申请：** `POST /friends/global/requests`

```json
{
  "targetUserId": "uuid",
  "message": "可选消息（最多 500 个字符）"
}
```

**错误：**
- 409 Conflict：请求已发送，或用户已经是好友
- 400 Bad Request：不能向自己发送请求

---

### 3.4 获取待处理好友请求（Friend Requests）

**端点：** `GET /friends/requests`

**认证：** 必需

**响应（200 OK）：**
```json
{
  "requests": [
    {
      "requestId": "uuid",
      "sourceType": "circle|global",
      "sender": {
        "userId": "uuid",
        "nickname": "String",
        "avatarUrl": "URL"
      },
      "circleId": "uuid|null",
      "circleName": "String|null",
      "cardPreview": {},
      "message": "String（可选）",
      "status": "pending",
      "expiresAt": "ISO8601 Timestamp",
      "createdAt": "ISO8601 Timestamp"
    }
  ],
  "acceptedRequests": [
    {
      "requestId": "uuid",
      "sourceType": "circle|global",
      "responder": {
        "userId": "uuid",
        "nickname": "String",
        "avatarUrl": "URL"
      },
      "circleId": "uuid|null",
      "circleName": "String|null",
      "status": "accepted|rejected|withdrawn|expired",
      "createdAt": "ISO8601 Timestamp",
      "respondedAt": "ISO8601 Timestamp"
    }
  ]
}
```

---

### 3.5 处理好友请求（Friend Request）

**端点：** `PUT /friends/requests/:requestId`

**认证：** 必需

**路径参数：**
| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| requestId | UUID | 好友请求（Friend request）标识符 |

**请求体：**
```json
{
  "action": "accept|reject"
}
```

**响应（200 OK）：**
```json
{
  "action": "accept|reject",
  "sourceType": "circle|global",
  "message": "已在该圈成为好友|已成为全局好友|已拒绝好友申请",
  "circleId": "uuid|null"
}
```

**错误：**
- 404 Not Found：Request 不存在或已处理
- 403 Forbidden：用户不是接收者

---

### 3.6 撤回或忽略好友请求

**端点：** `PUT /friends/requests/:requestId/withdraw`

发送方撤回 pending 请求。

**端点：** `PUT /friends/requests/:requestId/silent-reject`

接收方忽略 pending 请求，不向发送方展示普通拒绝语义。

**响应（200 OK）：**
```json
{
  "action": "withdraw|silent-reject",
  "sourceType": "circle|global",
  "message": "已撤回好友申请|已忽略好友申请",
  "circleId": "uuid|null"
}
```

---

### 3.7 删除好友（Friend）

**端点：** `DELETE /friends/:friendId`

**认证：** 必需

**路径参数：**
| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| friendId | UUID | Friend 用户标识符 |

**查询参数：**
| 参数 | 类型 | 是否必需 | 描述 |
|-----------|------|----------|-------------|
| circleId | UUID | 是 | Circle 标识符（circle 作用域删除） |

**响应（200 OK）：**
```json
{
  "message": "已解除该圈好友关系，全局好友仍保留",
  "circleId": "uuid",
  "removedCircleCount": 1,
  "remainingCircleCount": 0,
  "revokedGlobalFriendshipCount": 1,
  "deletedContactUnlockCount": 0
}
```

---

### 3.8 删除所有好友关系（Friendships）

**端点：** `DELETE /friends/:friendId/all`

**认证：** 必需

**路径参数：**
| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| friendId | UUID | Friend 用户标识符 |

**响应（200 OK）：**
```json
{
  "message": "已从同窗名录中解除全局好友关系",
  "removedCircleCount": 2,
  "remainingCircleCount": 0,
  "removedCircleIds": ["uuid"],
  "removedGlobalFriendshipCount": 1,
  "deletedContactUnlockCount": 1
}
```

---

## 4. 联系方式解锁 API（Contact Unlock API）

### 4.1 圈内联系方式设置（Circle Contact Settings）

**端点：** `GET /contacts/circles/:circleId/settings`

**认证：** 必需

**响应（200 OK）：**
```json
{
  "contacts": [
    {
      "id": "uuid",
      "fieldKey": "contact_primary|wechat|qq|phone|...",
      "label": "联系方式标签",
      "value": "明文值，仅本人可见",
      "maskedValue": "脱敏值",
      "isEnabled": true,
      "displayOrder": 0
    }
  ]
}
```

**端点：** `POST /contacts/circles/:circleId/settings`

**请求体：**
```json
{
  "fieldKey": "contact_primary",
  "label": "微信",
  "value": "wechat_id_or_other_contact",
  "isEnabled": true,
  "displayOrder": 0
}
```

**响应（201 Created）：**
```json
{
  "contact": {
    "id": "uuid",
    "fieldKey": "contact_primary",
    "label": "微信",
    "value": "明文值，仅本人可见",
    "maskedValue": "脱敏值",
    "isEnabled": true,
    "displayOrder": 0
  }
}
```

**端点：** `PATCH /contacts/circles/:circleId/settings/:contactId`

用于更新 `fieldKey`、`label`、`value`、`isEnabled` 或 `displayOrder` 中至少一个字段。返回格式同创建接口。

**端点：** `DELETE /contacts/circles/:circleId/settings/:contactId`

**响应（200 OK）：**
```json
{
  "message": "联系方式已删除",
  "contactId": "uuid"
}
```

**隐私说明：** 当前代码不会把圈内联系方式明文直接存入 `user_circle_contacts.value`；实际敏感值由 `g2_contact_secrets` 加密保存，业务表只保存 `contactSecretId` 和展示所需的脱敏信息。

---

### 4.2 发送联系方式解锁请求（Contact Unlock Request）

**端点：** `POST /contacts/unlock-request`

**认证：** 必需

**请求体：**
```json
{
  "targetUserId": "uuid",
  "circleId": "uuid（当 sourceType=circle 时必需）",
  "sourceType": "circle|address_book",
  "fieldKey": "可选；当前 circle 请求会规范化为 contact_primary",
  "message": "可选请求消息（最多 500 个字符）"
}
```

**响应（201 Created）：**
```json
{
  "requestId": "uuid",
  "fieldKey": "contact_primary",
  "message": "联系方式交换申请已发送"
}
```

**错误：**
- 403 Forbidden：非好友、被拉黑，或没有共同 circle
- 409 Conflict：请求已处于 pending，或可开放联系方式均已解锁
- 400 Bad Request：sourceType=circle 但缺少 circleId

---

### 4.3 获取联系方式解锁请求与回复（Contact Unlock Requests）

**端点：** `GET /contacts/unlock-requests`

**认证：** 必需

**响应（200 OK）：**
```json
{
  "requests": [
    {
      "requestId": "uuid",
      "requester": {
        "userId": "uuid",
        "nickname": "String",
        "avatarUrl": "URL"
      },
      "circleId": "uuid|null",
      "circleName": "String|null",
      "sourceType": "circle|address_book",
      "fieldKey": "contact_primary",
      "sourceLabel": "该圈子|同窗名录",
      "cardPreview": {},
      "message": "String|null",
      "status": "pending",
      "expiresAt": "ISO8601 Timestamp",
      "createdAt": "ISO8601 Timestamp"
    }
  ],
  "replies": [
    {
      "requestId": "uuid",
      "target": {
        "userId": "uuid",
        "nickname": "String",
        "avatarUrl": "URL"
      },
      "circleId": "uuid|null",
      "circleName": "String|null",
      "sourceType": "circle|address_book",
      "fieldKey": "String",
      "sourceLabel": "String",
      "status": "approved|rejected|withdrawn|expired|revoked",
      "message": "String|null",
      "createdAt": "ISO8601 Timestamp",
      "expiresAt": "ISO8601 Timestamp",
      "revokedAt": "ISO8601 Timestamp|null",
      "respondedAt": "ISO8601 Timestamp"
    }
  ]
}
```

---

### 4.4 处理联系方式解锁请求（Contact Unlock Request）

**端点：** `PUT /contacts/unlock-requests/:requestId`

**认证：** 必需

**路径参数：**
| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| requestId | UUID | 解锁请求（Unlock request）标识符 |

**请求体：**
```json
{
  "action": "approve|reject",
  "contactIds": ["uuid"]
}
```

`contactIds` 仅在同意 `sourceType=circle` 的请求时必需，用于指定授权开放哪些圈内联系方式。

**响应（200 OK）：**
```json
{
  "action": "approve|reject",
  "message": "已同意交换联系方式|已拒绝交换联系方式"
}
```

---

### 4.5 撤回或撤销联系方式授权

**端点：** `PUT /contacts/unlock-requests/:requestId/withdraw`

发送方撤回未处理的 pending 请求。

**响应（200 OK）：**
```json
{
  "action": "withdraw",
  "message": "已撤回联系方式交换申请"
}
```

**端点：** `POST /contacts/unlock-requests/:requestId/revoke`

授权方撤销已通过的联系方式授权。

**响应（200 OK）：**
```json
{
  "requestId": "uuid",
  "status": "revoked",
  "message": "已撤销联系方式授权"
}
```

---

### 4.6 获取联系方式解锁状态（Contact Unlock）

**端点：** `GET /contacts/status/:userId`

**认证：** 必需

**路径参数：**
| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| userId | UUID | 目标用户标识符 |

**查询参数：**
| 参数 | 类型 | 是否必需 | 描述 |
|-----------|------|----------|-------------|
| circleId | UUID | 否 | 指定 circle 作用域时返回圈内授权状态 |

**响应（200 OK）：**
```json
{
  "status": "idle|sent|granted|denied",
  "requestId": "uuid（当 status=sent 时）",
  "circleId": "uuid|null",
  "sourceType": "circle|address_book",
  "fieldKey": "contact_primary",
  "fieldKeys": ["contact_primary"]
}
```

---

### 4.7 获取已解锁联系方式（Contacts）

**端点：** `GET /contacts/:userId`

**认证：** 必需

**路径参数：**
| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| userId | UUID | 目标用户标识符 |

**查询参数：**
| 参数 | 类型 | 是否必需 | 描述 |
|-----------|------|----------|-------------|
| circleId | UUID | 否 | 指定 circle 时仅返回该圈已授权的联系方式 |

**响应（200 OK）：**
```json
{
  "contacts": [
    {
      "moduleKey": "contact_primary|contact_wechat|...",
      "fieldKey": "contact_primary",
      "label": "微信",
      "value": "授权后返回的明文联系方式"
    }
  ]
}
```

**错误：**
- 403 Forbidden：非好友、被拉黑，或对方尚未同意交换联系方式

---

## 5. Teamup API

### 5.1 创建 Teamup

**端点：** `POST /circles/:circleId/teamups`

**认证：** 必需

**路径参数：**
| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| circleId | UUID | 目标 circle |

**请求体：**
```json
{
  "title": "String（1-60 个字符）",
  "description": "Text（1-2000 个字符，不含联系方式）",
  "maxMembers": 5,
  "deadlineAt": "ISO8601 Timestamp",
  "endAt": "ISO8601 Timestamp",
  "teamupType": "short_term|long_term",
  "joinMode": "direct|approval",
  "isPublic": true,
  "contacts": [
    {
      "type": "wechat|phone|qq|email",
      "value": "String",
      "label": "可选标签"
    }
  ]
}
```

**响应（201 Created）：**
```json
{
  "message": "组队已发布",
  "teamup": {
    "id": "uuid",
    "circleId": "uuid",
    "leaderId": "uuid",
    "title": "String",
    "description": "Text",
    "descriptionPreview": "Text",
    "maxMembers": 5,
    "currentMemberCount": 1,
    "deadlineAt": "ISO8601",
    "endAt": "ISO8601",
    "teamupType": "short_term|long_term",
    "joinMode": "direct|approval",
    "status": "recruiting",
    "effectiveStatus": "recruiting|full|ended|expired|cancelled",
    "isPublic": false,
    "viewer": {
      "isCircleMember": true,
      "isTeamupMember": true,
      "isLeader": true,
      "canManage": true,
      "canViewContacts": false
    },
    "createdAt": "ISO8601 Timestamp"
  }
}
```

**说明：** 当前代码中 `TEAMUP_FORUM_SYNC_ENABLED=false`，因此 `isPublic` 会被服务端强制落为 `false`，forum 同步字段保留为未来扩展。

---

### 5.2 列出 Circle 中的 Teamups

**端点：** `GET /circles/:circleId/teamups`

**认证：** 必需

**路径参数：**
| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| circleId | UUID | Circle 标识符 |

**查询参数：**
| 参数 | 类型 | 默认值 | 描述 |
|-----------|------|---------|-------------|
| page | Integer | 1 | 页码 |
| limit | Integer | 20 | 每页条目数（最大 50） |
| status | String | all | `recruiting|full|ended|expired|cancelled|all` |
| visibility | String | all | `public|circle|all` |
| joinMode | String | all | `direct|approval|all` |
| teamupType | String | all | `short_term|long_term|all` |
| mine | String | all | `created|joined|applied|all` |
| keyword | String | 无 | 标题/描述关键词 |

**响应（200 OK）：**
```json
{
  "total": 42,
  "page": 1,
  "limit": 20,
  "teamups": [
    {
      "id": "uuid",
      "circleId": "uuid",
      "title": "String",
      "description": "Text（联系方式被过滤后的预览）",
      "descriptionPreview": "Text",
      "maxMembers": 5,
      "currentMemberCount": 3,
      "deadlineAt": "ISO8601",
      "endAt": "ISO8601",
      "teamupType": "short_term|long_term",
      "joinMode": "direct|approval",
      "status": "recruiting|full|cancelled",
      "effectiveStatus": "recruiting|full|ended|expired|cancelled",
      "joinable": true,
      "waitlistable": false,
      "waitlistCount": 0,
      "leaderId": "uuid",
      "leader": {
        "userId": "uuid",
        "nickname": "String",
        "avatarUrl": "URL"
      },
      "viewer": {
        "isTeamupMember": false,
        "isLeader": false,
        "canViewContacts": false,
        "pendingApplicationId": null
      },
      "createdAt": "ISO8601"
    }
  ]
}
```

---

### 5.3 获取 Teamup 详情

**端点：** `GET /circles/:circleId/teamups/:teamupId`

**认证：** 必需

**路径参数：**
| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| circleId | UUID | Circle 标识符 |
| teamupId | UUID | Teamup 标识符 |

**响应（200 OK）：**
```json
{
  "teamup": {
    "id": "uuid",
    "circleId": "uuid",
    "leaderId": "uuid",
    "leaderNickname": "String",
    "title": "String",
    "description": "Text",
    "maxMembers": 5,
    "currentMemberCount": 3,
    "deadlineAt": "ISO8601",
    "endAt": "ISO8601",
    "teamupType": "short_term|long_term",
    "joinMode": "direct|approval",
    "status": "recruiting|full|cancelled",
    "effectiveStatus": "recruiting|full|ended|expired|cancelled",
    "isPublic": true,
    "viewer": {
      "isTeamupMember": true,
      "isLeader": false,
      "canViewContacts": false,
      "contactsVisibleUntil": null,
      "activeApplicationId": null,
      "applicationStatus": null
    },
    "members": [
      {
        "userId": "uuid",
        "nickname": "String",
        "avatarUrl": "URL",
        "memberRole": "leader|member",
        "joinedAt": "ISO8601"
      }
    ],
    "createdAt": "ISO8601"
  }
}
```

**说明：** Teamup 详情不直接返回成员联系方式。联系方式需要在报名截止后、活动结束前，通过 `GET /circles/:circleId/teamups/:teamupId/contacts` 单独获取。

---

### 5.4 更新 Teamup

**端点：** `PATCH /circles/:circleId/teamups/:teamupId`

**认证：** 必需，仅 leader 可操作。

**请求体：** 与创建接口相同字段均可选；报名截止后不可修改 `deadlineAt`、`endAt`、`teamupType`、`joinMode`、`maxMembers`、`isPublic`、`contacts` 等关键字段。

**响应（200 OK）：**
```json
{
  "message": "组队已更新",
  "teamupId": "uuid",
  "forumSyncStatus": "none|pending|synced|failed"
}
```

---

### 5.5 申请加入 Teamup

**端点：** `POST /circles/:circleId/teamups/:teamupId/applications`

**认证：** 必需

**路径参数：**
| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| circleId | UUID | Circle 标识符 |
| teamupId | UUID | Teamup 标识符 |

**请求体：**
```json
{
  "applicationNote": "String（1-300 个字符）",
  "contacts": [
    {
      "type": "wechat|phone",
      "value": "String",
      "label": "可选"
    }
  ]
}
```

**响应（201 Created）：**
```json
{
  "message": "加入申请已提交|候补申请已提交",
  "application": {
    "id": "uuid",
    "teamupId": "uuid",
    "applicantId": "uuid",
    "status": "pending",
    "applicationType": "join|waitlist",
    "waitlistPosition": null,
    "cardSnapshotView": "public|friend",
    "createdAt": "ISO8601 Timestamp"
  }
}
```

**错误：**
- 409 Conflict：已经申请、已经是成员、Teamup 不可加入，或 joinMode 不匹配
- 403 Forbidden：用户被 leader 或其他 active 成员拉黑

---

### 5.6 直接加入 Teamup

**端点：** `POST /circles/:circleId/teamups/:teamupId/join`

**认证：** 必需

**路径参数：**
| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| circleId | UUID | Circle 标识符 |
| teamupId | UUID | Teamup 标识符 |

**请求体：**
```json
{
  "contacts": [
    {
      "type": "wechat|phone",
      "value": "String",
      "label": "可选"
    }
  ]
}
```

**响应（200 OK）：**
```json
{
  "message": "已加入组队",
  "teamupId": "uuid",
  "member": {
    "userId": "uuid",
    "memberRole": "member",
    "joinedAt": "ISO8601 Timestamp"
  },
  "currentMemberCount": 3,
  "status": "recruiting|full"
}
```

如果直接加入模式已满但仍允许候补，响应为：

```json
{
  "message": "候补已登记",
  "teamupId": "uuid",
  "application": {
    "id": "uuid",
    "teamupId": "uuid",
    "applicantId": "uuid",
    "status": "approved",
    "applicationType": "waitlist",
    "waitlistPosition": 1,
    "createdAt": "ISO8601 Timestamp"
  },
  "currentMemberCount": 5,
  "status": "full"
}
```

**错误：**
- 409 Conflict：Teamup 已满，或用户已经是成员
- 400 Bad Request：joinMode != 'direct'

---

### 5.7 列出 Teamup 的申请（Applications）

**端点：** `GET /circles/:circleId/teamups/:teamupId/applications`

**认证：** 必需

**路径参数：**
| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| circleId | UUID | Circle 标识符 |
| teamupId | UUID | Teamup 标识符 |

**查询参数：**
| 参数 | 类型 | 默认值 | 描述 |
|-----------|------|---------|-------------|
| status | String | all | `pending|approved|rejected|withdrawn|all` |
| page | Integer | 1 | 页码 |
| limit | Integer | 20 | 每页条目数 |

**响应（200 OK）：**
```json
{
  "total": 10,
  "page": 1,
  "limit": 20,
  "applications": [
    {
      "id": "uuid",
      "teamupId": "uuid",
      "applicant": {
        "userId": "uuid",
        "nickname": "String",
        "avatarUrl": "URL"
      },
      "applicationNote": "String",
      "applicationType": "join|waitlist",
      "waitlistPosition": null,
      "cardSnapshot": {},
      "status": "pending|approved|rejected|withdrawn",
      "waitlistJoinedAt": null,
      "createdAt": "ISO8601"
    }
  ]
}
```

**错误：**
- 403 Forbidden：用户不是 teamup leader（负责人）

---

### 5.8 审核 Teamup 申请（Application）

**端点：** `PATCH /circles/:circleId/teamups/:teamupId/applications/:applicationId`

**认证：** 必需

**路径参数：**
| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| circleId | UUID | Circle 标识符 |
| teamupId | UUID | Teamup 标识符 |
| applicationId | UUID | 申请记录标识符 |

**请求体：**
```json
{
  "action": "approve|reject",
  "reviewNote": "可选审核消息（最多 300 个字符）"
}
```

**响应（200 OK）：**
```json
{
  "message": "申请已通过|申请已拒绝|候补申请已通过",
  "applicationId": "uuid",
  "teamupId": "uuid",
  "status": "approved|rejected",
  "applicationType": "join|waitlist",
  "promoted": true,
  "currentMemberCount": 4,
  "teamupStatus": "recruiting|full"
}
```

**错误：**
- 403 Forbidden：用户不是 teamup leader（负责人）
- 404 Not Found：申请（Application）不存在

---

### 5.9 撤回 Teamup 申请

**端点：** `PUT /circles/:circleId/teamups/:teamupId/applications/:applicationId/withdraw`

**认证：** 必需，仅申请人可操作。

**响应（200 OK）：**
```json
{
  "message": "组队申请已撤回|候补申请已撤回",
  "applicationId": "uuid",
  "teamupId": "uuid",
  "status": "withdrawn",
  "applicationType": "join|waitlist"
}
```

---

### 5.10 离开 Teamup

**端点：** `DELETE /circles/:circleId/teamups/:teamupId/members/me`

**认证：** 必需

**路径参数：**
| 参数 | 类型 | 描述 |
|-----------|------|-------------|
| circleId | UUID | Circle 标识符 |
| teamupId | UUID | Teamup 标识符 |

**响应（200 OK）：**
```json
{
  "message": "已退出组队",
  "teamupId": "uuid",
  "currentMemberCount": 3,
  "status": "recruiting|full|cancelled"
}
```

**错误：**
- 409 Conflict：leader 不能直接退出，需取消组队
- 404 Not Found：当前用户不是 active 成员

---

### 5.11 取消 Teamup

**端点：** `POST /circles/:circleId/teamups/:teamupId/cancel`

**请求体：**
```json
{
  "reason": "可选取消原因",
  "cancelSource": "leader|admin",
  "confirmCancel": true
}
```

**响应（200 OK）：**
```json
{
  "message": "组队已取消",
  "teamupId": "uuid",
  "status": "cancelled",
  "cancelledBy": "uuid",
  "cancelSource": "leader|admin"
}
```

---

### 5.12 查看 Teamup 成员联系方式

**端点：** `GET /circles/:circleId/teamups/:teamupId/contacts`

**认证：** 必需，仅 active 成员可查看。

**可见窗口：** 报名截止后、活动结束前；已取消组队不公开联系方式。

**响应（200 OK）：**
```json
{
  "teamupId": "uuid",
  "availableSince": "ISO8601",
  "availableUntil": "ISO8601",
  "members": [
    {
      "userId": "uuid",
      "nickname": "String",
      "avatarUrl": "URL",
      "memberRole": "leader|member",
      "contacts": [
        {
          "type": "wechat|phone|qq|email",
          "label": "队长",
          "maskedValue": "脱敏值",
          "value": "授权窗口内解密后的明文"
        }
      ]
    }
  ]
}
```

---

### 5.13 我的 Teamup 历史与申请回复

**端点：** `GET /circles/:circleId/teamups/my/history`

返回当前用户参与过且已结束的 Teamup 历史，支持 `role=created|joined`、`visibility=public|circle`、`page`、`limit`。

**端点：** `GET /teamups/applications/replies`

返回当前用户发出的审核加入申请的结果回复。

**响应（200 OK）：**
```json
{
  "total": 2,
  "page": 1,
  "limit": 20,
  "replies": [
    {
      "id": "uuid",
      "teamupId": "uuid",
      "circleId": "uuid",
      "circleName": "String",
      "teamupTitle": "String",
      "leader": {
        "userId": "uuid",
        "nickname": "String",
        "avatarUrl": "URL"
      },
      "status": "approved|rejected",
      "applicationType": "join|waitlist",
      "reviewNote": "String|null",
      "createdAt": "ISO8601",
      "respondedAt": "ISO8601"
    }
  ]
}
```

### 5.14 公开 Teamup 摘要

**端点：** `GET /teamups/public/:teamupId`

该端点为 forum 联动预留。当前代码中 `TEAMUP_FORUM_SYNC_ENABLED=false` 时会返回 404，表示公开组队同步未启用。

---

## 6. Chat API（实时聊天）

当前代码提供两类实时聊天：circle 群聊和 teamup 群聊。REST API 负责历史消息、发送消息、删除消息和已读状态；实时推送由 `circleChatHub` / `teamupChatHub` 广播 `chat.message` 与 `chat.deleted` 事件。

### 6.1 获取 Circle 聊天消息

**端点：** `GET /circles/:circleId/chat/messages`

**认证：** 必需，仅 active circle 成员可访问。

**查询参数：**
| 参数 | 类型 | 默认值 | 描述 |
|-----------|------|---------|-------------|
| before | UUID | 无 | 游标，获取该消息之前的历史 |
| limit | Integer | 30 | 每页 1-50 条 |

**响应（200 OK）：**
```json
{
  "messages": [
    {
      "id": "uuid",
      "circleId": "uuid",
      "sender": {
        "userId": "uuid",
        "nickname": "String",
        "avatarUrl": "URL"
      },
      "clientMessageId": "client-generated-id",
      "content": "消息内容",
      "mentions": ["userId"],
      "status": "visible|deleted",
      "isOwn": false,
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ],
  "hasMore": true
}
```

---

### 6.2 发送 Circle 聊天消息

**端点：** `POST /circles/:circleId/chat/messages`

**请求体：**
```json
{
  "clientMessageId": "client-generated-id",
  "content": "1-1000 字符",
  "mentions": ["uuid"]
}
```

**响应（201 Created）：**
```json
{
  "message": {
    "id": "uuid",
    "circleId": "uuid",
    "clientMessageId": "client-generated-id",
    "content": "消息内容",
    "mentions": ["uuid"],
    "status": "visible",
    "isOwn": true,
    "createdAt": "ISO8601"
  }
}
```

---

### 6.3 删除 Circle 聊天消息

**端点：** `DELETE /circles/:circleId/chat/messages/:messageId`

**响应（200 OK）：**
```json
{
  "message": "消息已删除",
  "messageId": "uuid",
  "status": "deleted"
}
```

---

### 6.4 更新 Circle 聊天已读状态

**端点：** `PUT /circles/:circleId/chat/read-state`

**请求体：**
```json
{
  "lastReadMessageId": "uuid",
  "lastReadAt": "ISO8601 Timestamp"
}
```

**响应（200 OK）：**
```json
{
  "lastReadMessageId": "uuid|null",
  "lastReadAt": "ISO8601 Timestamp",
  "unreadCount": 0
}
```

---

### 6.5 Teamup 聊天 API

Teamup 聊天接口与 Circle 聊天接口字段一致，但作用域改为 teamup：

| 功能 | 方法 | 路径 |
|---|---|---|
| 获取 Teamup 聊天消息 | GET | `/circles/:circleId/teamups/:teamupId/chat/messages` |
| 发送 Teamup 聊天消息 | POST | `/circles/:circleId/teamups/:teamupId/chat/messages` |
| 删除 Teamup 聊天消息 | DELETE | `/circles/:circleId/teamups/:teamupId/chat/messages/:messageId` |
| 更新 Teamup 已读状态 | PUT | `/circles/:circleId/teamups/:teamupId/chat/read-state` |

**权限说明：** 只有 active teamup 成员可以访问对应 teamup 房间。发送/删除操作成功后，服务端会向可接收的 active 成员广播实时事件。

---

## 7. Global Match API

### 7.1 获取当前平台匹配（Match）

**端点：** `GET /match/current`

**认证：** 必需

**响应（200 OK）：**
```json
{
  "status": "WAITING|LOCKED|PENDING|REVEALED|EXPIRED|NO_MATCH",
  "match": {
    "matchId": "uuid",
    "compatibilityScore": 0.85,
    "partner": {
      "id": "uuid",
      "nickname": "String",
      "gender": "male|female",
      "department": "String",
      "grade": "String",
      "avatarUrl": "URL",
      "intentions": ["friend", "partner"],
      "mbti": "XXXX",
      "bio": "Text（可选）"
    },
    "matchReason": "Text",
    "revealedAt": "ISO8601（当 status=REVEALED 时）"
  },
  "message": "状态消息",
  "revealAt": "ISO8601（当 status=LOCKED 时）",
  "nextRevealAt": "ISO8601（当 status=NO_MATCH 时）"
}
```

---

### 7.2 记录平台匹配（Match）操作

**端点：** `POST /match/action`

**认证：** 必需

**请求体：**
```json
{
  "matchId": "uuid",
  "action": "ACCEPT|REJECT"
}
```

**响应（200 OK）：**
```json
{
  "success": true,
  "matchId": "uuid",
  "action": "ACCEPT|REJECT",
  "status": "pending",
  "recordedAt": "ISO8601 Timestamp"
}
```

---

### 7.3 获取平台匹配（Match）历史

**端点：** `GET /match/history`

**认证：** 必需

**查询参数：**
| 参数 | 类型 | 默认值 | 描述 |
|-----------|------|---------|-------------|
| page | Integer | 1 | 页码 |
| limit | Integer | 10 | 每页条目数（最大 50） |

**响应（200 OK）：**
```json
{
  "data": [
    {
      "matchId": "uuid",
      "partner": {
        "id": "uuid",
        "nickname": "String",
        "gender": "male|female"
      },
      "score": 0.85,
      "myAction": "ACCEPT|REJECT|null",
      "partnerAction": "ACCEPT|REJECT|null",
      "status": "REVEALED|MUTUAL|MISSED|EXPIRED",
      "weekOf": "YYYY-MM-DD",
      "revealedAt": "ISO8601"
    }
  ],
  "page": 1,
  "limit": 10,
  "total": 30
}
```

---

## 8. 错误响应

所有错误响应都遵循标准格式：

```json
{
  "error": "ErrorType",
  "message": "人类可读的错误消息",
  "details": {}
}
```

**常见 HTTP 状态码：**

| 状态码 | 错误类型 | 描述 |
|------|-----------|-------------|
| 400 | ValidationError | 请求参数或 body（请求体）无效 |
| 401 | Unauthorized | 缺少 authentication token（认证令牌）或 token 无效 |
| 403 | ForbiddenError | 用户缺少资源权限 |
| 404 | NotFoundError | 资源不存在 |
| 409 | ConflictError | 资源状态冲突（例如重复请求） |
| 500 | ServerError | 内部服务器错误 |

---

## 9. 认证（Authentication）

**Header 格式：**
```
Authorization: Bearer <JWT_TOKEN>
```

**Token 获取：**
- 发送注册验证码：`POST /auth/send-code`
- 注册（Register）：`POST /auth/register`
- 登录（Login）：`POST /auth/login`
- 忘记密码验证码：`POST /auth/forgot-password/send-code`
- 重置密码：`POST /auth/forgot-password/reset`
- 旧版验证码登录兼容：`POST /auth/verify-code`
- 实时连接票据：`POST /auth/realtime-ticket`

认证与账户模块由第 1 组维护，本节仅列出 G2 端点依赖的现有 token 获取入口。所有需要认证的端点都要求在 Authorization header 中提供有效且未过期的 JWT；实时聊天连接使用 `/auth/realtime-ticket` 获取短期票据。

---

## 10. 限流与分页（Rate Limiting 与 Pagination）

**分页（Pagination）：**
- 默认 limit：每页 20 条
- 最大 limit：每页 50 条
- 默认 page：1（从 1 开始）

**响应格式：**
```json
{
  "data": [...],
  "page": 1,
  "limit": 20,
  "total": 100
}
```

---

## 11. API 版本控制（Versioning）

当前 API 版本：`v1`（路径前缀：`/api/v1`）

本规范中的所有端点都使用 v1 API，并且必须带 `/api/v1/` 前缀调用。
