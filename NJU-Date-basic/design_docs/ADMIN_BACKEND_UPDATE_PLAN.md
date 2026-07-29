# 管理端 CIRCLE/名片后端当前状态

本文只记录第二组 CIRCLE 名片与圈子管理相关的管理端后端接口当前状态。论坛治理、全局管理员后台和圈内匹配不在本文维护范围内。

所有路径均省略 `/api/v1` 前缀，管理端接口均走 `adminLimiter` 和 `requireAdmin`。

## 当前管理范围

| 范围 | 当前能力 |
| --- | --- |
| 圈子基础信息 | 列表、创建、更新、上下架 |
| A 区组件库 | 查看、新增、整体替换、单项更新、删除 |
| B 区组件库 | 查看、新增、整体替换、单项更新、删除 |
| C 区自定义项 | 审核列表、通过、驳回、升级为 B 区组件 |
| 兼容入口 | `POST /admin/circles/:circleId/questions` 仍映射到 B 区组件整体替换 |

## 圈子管理

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/admin/circles` | 查看圈子列表 |
| `POST` | `/admin/circles` | 创建圈子 |
| `PUT` | `/admin/circles/:circleId` | 更新圈子 |
| `PATCH` | `/admin/circles/:circleId/active` | 上架/下架 |

删除圈子的管理端物理删除路由当前未开放。普通圈主解散走用户端归档逻辑：`DELETE /circles/:circleId`。

## A 区组件库

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/admin/base-card-components` | 获取 A 区组件定义 |
| `POST` | `/admin/base-card-components` | 新增 A 区组件 |
| `PUT` | `/admin/base-card-components` | 整体替换 A 区组件 |
| `PATCH` | `/admin/base-card-components/:key` | 更新单个 A 区组件 |
| `DELETE` | `/admin/base-card-components/:key` | 删除单个 A 区组件 |

组件 schema：

```json
{
  "key": "department",
  "name": "院系",
  "sourceType": "user_profile",
  "sourceKey": "department"
}
```

`sourceType` 当前支持：

| 值 | 说明 |
| --- | --- |
| `user_profile` | 来自用户资料 |
| `survey_answer` | 来自主问卷答案 |
| `manual` | 用户手动填写 |

整体替换请求：

```json
{
  "components": []
}
```

后端会校验 `key` 不重复。

## B 区组件库

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/admin/circles/:circleId/card-components` | 获取某圈 B 区组件 |
| `POST` | `/admin/circles/:circleId/card-components` | 新增 B 区组件 |
| `PUT` | `/admin/circles/:circleId/card-components` | 整体替换 B 区组件 |
| `PATCH` | `/admin/circles/:circleId/card-components/:key` | 更新单个 B 区组件 |
| `DELETE` | `/admin/circles/:circleId/card-components/:key` | 删除单个 B 区组件 |

B 区组件 schema 仍沿用历史问卷形状，但当前语义是“圈内名片组件定义”：

```json
{
  "key": "gaming_rank",
  "type": "single_choice",
  "prompt": "段位",
  "options": ["黄金", "铂金", "钻石", "星耀", "王者"],
  "weight": 1,
  "displayOrder": 0,
  "isChannelTag": true
}
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `key` | 圈内稳定组件标识 |
| `type` | 兼容字段：`scale` / `single_choice` / `multi_choice` / `ranking` |
| `prompt` | 组件展示名或提示语 |
| `options` | 可选配置 |
| `weight` | 兼容旧评分字段 |
| `displayOrder` | 展示顺序 |
| `isChannelTag` | 是否进入频道标签候选 |

频道标签只在用户对应 B 区组件状态为 `public` 时展示。

## C 区审核

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/admin/circle-custom-items` | 查看 C 区自定义项 |
| `POST` | `/admin/circle-custom-items/:itemId/approve` | 审核通过 |
| `POST` | `/admin/circle-custom-items/:itemId/reject` | 审核驳回 |
| `POST` | `/admin/circle-custom-items/:itemId/promote` | 升级为 B 区组件 |

列表 Query：

| 参数 | 默认 | 说明 |
| --- | --- | --- |
| `status` | `pending` | `pending` / `approved` / `rejected` |
| `circleId` | 无 | 只看指定圈子 |

驳回 Body：

```json
{
  "reviewNote": "内容不适合展示"
}
```

升级 Body：

```json
{
  "key": "gaming_rank",
  "type": "single_choice",
  "prompt": "段位",
  "options": ["黄金", "铂金", "钻石", "星耀", "王者"],
  "weight": 1,
  "displayOrder": 0,
  "isChannelTag": true
}
```

升级成功后，该 C 区项会被迁入用户自己的 B 区名片，并作为该圈官方 B 区组件定义存在。

## 兼容路径

| 方法 | 路径 | 当前行为 |
| --- | --- | --- |
| `POST` | `/admin/circles/:circleId/questions` | 兼容入口，调用 B 区组件整体替换逻辑 |

新管理端应优先使用 `/admin/circles/:circleId/card-components`。

## 用户端联动

| 用户动作 | 后端联动 |
| --- | --- |
| 首次读取 `/card/base/me` | 如无 A 区实例则初始化 |
| 成功加入圈子 | 初始化该圈 B 区名片 |
| 读取 `/card/circle/:circleId/me` | 如缺少组件骨架则补齐 |
| 提交 C 区项 | 写入 `pending`，等待管理端审核 |
| C 区项通过 | 可进入对外展示 |
| C 区项升级 | 进入 B 区组件库和用户 B 区实例 |

## 当前事实源

| 文件 | 说明 |
| --- | --- |
| `backend/src/routes/admin.ts` | 管理端路由 |
| `backend/src/routes/card.ts` | 用户端名片路由 |
| `backend/src/modules/cards/index.ts` | 名片服务导出 |
| `backend/src/db/schema.ts` | 名片与圈子组件表定义 |
