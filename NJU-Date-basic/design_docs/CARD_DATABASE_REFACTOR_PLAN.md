# 兴趣圈名片数据库当前状态

本文只记录第二组 CIRCLE 名片链路当前数据库状态。旧迁移讨论和方案评审内容不再保留。

## 当前主链路

兴趣圈名片分为三层：

| 区域 | 含义 | 当前主表 |
| --- | --- | --- |
| A 区 | 用户全局基础名片 | `user_base_cards` |
| B 区 | 用户在某个圈子的专属名片 | `user_circle_cards` |
| C 区 | 用户在某个圈子自定义提交的展示项 | `user_circle_custom_cards` |

组件定义分两类：

| 定义 | 当前主表 | 说明 |
| --- | --- | --- |
| A 区组件定义 | `base_card_components` | 全局基础名片组件 |
| B 区组件定义 | `circle_questions` | 当前作为圈子 B 卡组件定义使用 |

用户偏好：

| 表 | 说明 |
| --- | --- |
| `user_card_preferences` | 当前保存公开名片中 hidden 标题的展示偏好 |

## A 区

`base_card_components` 保存全局组件定义：

| 字段 | 说明 |
| --- | --- |
| `key` | 稳定组件标识 |
| `name` | 展示名 |
| `sourceType` | `user_profile` / `survey_answer` / `manual` |
| `sourceKey` | 可选来源字段 |

`user_base_cards` 保存用户自己的 A 区实例：

| 字段 | 说明 |
| --- | --- |
| `userId` | 用户 ID，主键 |
| `isActive` | 是否启用 |
| `components` | 组件数组 |
| `updatedAt` | 更新时间 |

用户首次读取或加入圈子触发初始化时，如果没有 A 区实例，后端会根据当前 A 区组件定义生成默认组件骨架。

## B 区

`circle_questions` 当前承担 B 区组件定义：

| 字段 | 说明 |
| --- | --- |
| `circleId` | 所属圈子 |
| `key` | 圈内稳定组件标识 |
| `type` | 兼容字段：`scale` / `single_choice` / `multi_choice` / `ranking` |
| `prompt` | 当前作为组件展示名/提示语 |
| `options` | 兼容字段，JSON 字符串 |
| `weight` | 兼容旧评分字段 |
| `displayOrder` | 展示顺序 |
| `isChannelTag` | 是否可作为频道标签 |

`user_circle_cards` 保存用户在某个圈子的 B 区实例：

| 字段 | 说明 |
| --- | --- |
| `userId` | 用户 ID |
| `circleId` | 圈子 ID |
| `isActive` | 是否启用 |
| `components` | 组件数组 |
| `updatedAt` | 更新时间 |

唯一约束：同一个用户在同一个圈子只有一份 B 区名片。

## C 区

`user_circle_custom_cards` 保存用户自定义圈内展示项：

| 字段 | 说明 |
| --- | --- |
| `userId` | 提交用户 |
| `circleId` | 所属圈子 |
| `label` / `value` | 展示名和值 |
| `topLeftX` / `topLeftY` | 布局位置 |
| `width` / `height` | 布局尺寸 |
| `visibilityLevel` | `public` / `friends` / `hidden` |
| `status` | `pending` / `approved` / `rejected` |
| `reviewNote` | 审核备注 |
| `reviewedAt` | 审核时间 |

C 区由用户提交，管理员审核通过后才能进入对外展示。管理员也可以把 C 区项升级为该圈的 B 区官方组件。

## 组件数组格式

A/B 区实例中的 `components` 当前使用 JSON 数组：

```json
{
  "key": "gaming_rank",
  "name": "段位",
  "value": "星耀",
  "topLeft": [0, 0],
  "width": 1,
  "height": 1,
  "status": "public"
}
```

`status` 当前支持：

| 状态 | 说明 |
| --- | --- |
| `public` | 公开可见 |
| `circle` | 同圈可见 |
| `friends` | 好友可见 |
| `hidden` | 隐藏；公开视图可按偏好只露标题或完全隐藏 |
| `deleted` | 编辑态保留，展示态不显示 |

## 当前 API 对应关系

用户端：

| 方法 | 路径 | 数据 |
| --- | --- | --- |
| `GET` | `/api/v1/card/base/me` | A 区编辑态 |
| `PUT` | `/api/v1/card/base/me` | 更新 A 区 |
| `GET` | `/api/v1/card/modules` | A 区组件定义 |
| `GET` | `/api/v1/card/circle/:circleId/me` | B 区编辑态 |
| `PUT` | `/api/v1/card/circle/:circleId/me` | 更新 B 区 |
| `GET` | `/api/v1/card/circle/:circleId/me/custom-items` | 我的 C 区项 |
| `POST` | `/api/v1/card/circle/:circleId/me/custom-items` | 创建 C 区项 |
| `PATCH` | `/api/v1/card/circle/:circleId/me/custom-items/:itemId` | 更新 C 区项 |
| `DELETE` | `/api/v1/card/circle/:circleId/me/custom-items/:itemId` | 删除 C 区项 |
| `GET` | `/api/v1/card/:userId/public` | 公开名片视图 |
| `GET` | `/api/v1/card/:userId/friend` | 好友名片视图 |
| `GET` | `/api/v1/card/preferences/public-hidden-preview` | hidden 标题展示偏好 |
| `PUT` | `/api/v1/card/preferences/public-hidden-preview` | 更新偏好 |

管理端：

| 方法 | 路径 | 数据 |
| --- | --- | --- |
| `GET/POST/PUT` | `/api/v1/admin/base-card-components` | A 区组件定义 |
| `PATCH/DELETE` | `/api/v1/admin/base-card-components/:key` | A 区单组件 |
| `GET/POST/PUT` | `/api/v1/admin/circles/:circleId/card-components` | B 区组件定义 |
| `PATCH/DELETE` | `/api/v1/admin/circles/:circleId/card-components/:key` | B 区单组件 |
| `GET` | `/api/v1/admin/circle-custom-items` | C 区审核列表 |
| `POST` | `/api/v1/admin/circle-custom-items/:itemId/approve` | 通过 C 区项 |
| `POST` | `/api/v1/admin/circle-custom-items/:itemId/reject` | 驳回 C 区项 |
| `POST` | `/api/v1/admin/circle-custom-items/:itemId/promote` | 升级为 B 区组件 |

## 频道标签

频道标签只来自 B 区：

1. 管理端在 B 区组件定义中设置 `isChannelTag=true`。
2. 用户 B 区实例中对应组件状态为 `public`。
3. 服务端过滤敏感字段名和值。
4. `GET /api/v1/circles/:circleId/channel` 返回标签。

旧问卷答案不再作为频道标签来源。

## 退出圈子的清理

`DELETE /api/v1/circles/:circleId/leave` 支持 `clearTrace`。开启后会清理该圈内名片、联系方式、位置、加入申请、旧兼容覆盖记录等痕迹。

普通退出也会删除当前位置，并处理圈内关系、联系方式授权和组队关系。
