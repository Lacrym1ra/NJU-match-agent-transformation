# 第三组：论坛与治理 API 文档

> 版本：v2.0 | 日期：2026-05-28 | Phase A 完成

## 1. 文档定位

本文只服务第三组，范围包括：

- 论坛帖子 / 评论 / 两级回复
- 点赞 / 收藏 / 隐藏
- 动态匿名（帖主特权）
- 语音评论 + 异步转写
- 公告 / 留言板
- 热榜
- 通知中心
- 举报审核
- 管理后台（帖子管理 / 公告管理 / 留言管理 / 审计日志）
- 圈子接入论坛（`circleId` 过滤、圈子组队帖、成员校验）

不包含：

- 圈子/名片/好友/联系方式解锁 → 见 `design_docs/CIRCLE_API.md`

---

## 2. 实现状态总览

### 2.1 论坛核心 — 全部已实现

| 模块 | 路由 | 状态 |
|------|------|------|
| 帖子列表 | `GET /api/v1/forum/posts` | 已实现 |
| 发帖 | `POST /api/v1/forum/posts` | 已实现（支持匿名、私密、图片） |
| 帖子详情 | `GET /api/v1/forum/posts/:postId` | 已实现（两级评论扁平结构） |
| 删帖 | `DELETE /api/v1/forum/posts/:postId` | 已实现（软删除） |
| 匿名切换 | `PATCH /api/v1/forum/posts/:postId/anonymity` | 已实现（动态可逆） |
| 取消匿名 | `PATCH /api/v1/forum/posts/:postId/cancel-anonymous` | @deprecated |
| 隐私设置 | `PATCH /api/v1/forum/posts/:postId/privacy` | 已实现 |
| 帖子点赞 | `POST / DELETE /api/v1/forum/posts/:postId/like` | 已实现 |
| 帖子收藏 | `POST / DELETE /api/v1/forum/posts/:postId/favorite` | 已实现 |
| 发表评论 | `POST /api/v1/forum/posts/:postId/comments` | 已实现（文字/语音） |
| 删评论 | `DELETE /api/v1/forum/comments/:commentId` | 已实现（L1 级联软删 L2） |
| 二级回复列表 | `GET /api/v1/forum/comments/:rootCommentId/replies` | 已实现（分页） |
| 评论点赞 | `POST / DELETE /api/v1/forum/comments/:commentId/like` | 已实现 |
| 评论隐藏 | `POST /api/v1/forum/comments/:commentId/hide` | 已实现 |
| 语音转写 | `POST /api/v1/forum/comments/:commentId/transcript` | 已实现（异步） |

### 2.2 论坛内容 — 全部已实现

| 模块 | 路由 | 状态 |
|------|------|------|
| 公告列表 | `GET /api/v1/forum/announcements` | 已实现（仅标题） |
| 公告详情 | `GET /api/v1/forum/announcements/:id` | 已实现（含正文） |
| 留言列表 | `GET /api/v1/forum/guestbook/messages` | 已实现 |
| 发表留言 | `POST /api/v1/forum/guestbook/messages` | 已实现 |
| 热榜 | `GET /api/v1/forum/ranking/hot` | 已实现（全时段） |

### 2.3 通知 — 全部已实现

| 模块 | 路由 | 状态 |
|------|------|------|
| 通知列表 | `GET /api/v1/user/notifications` | 已实现 |
| 未读计数 | `GET /api/v1/user/notifications/unread-count` | 已实现 |
| 全部已读 | `PATCH /api/v1/user/notifications/read-all` | 已实现 |
| 单条已读 | `PATCH /api/v1/user/notifications/:id/read` | 已实现 |

### 2.4 治理 — 已实现

| 模块 | 路由 | 状态 |
|------|------|------|
| 举报用户 | `POST /api/v1/user/report/:targetId` | 已实现 |
| 拉黑/取消拉黑 | `POST/DELETE /api/v1/user/block/:targetId` | 已实现 |
| 举报列表 | `GET /api/v1/admin/reports` | 已实现 |
| 举报审核 | `PATCH /api/v1/admin/reports/:id` | 已实现 |

### 2.5 管理后台 — 全部已实现

| 模块 | 路由 | 状态 |
|------|------|------|
| 帖子管理 | `GET /api/v1/admin/forum/posts` | 已实现 |
| 强制删帖 | `DELETE /api/v1/admin/forum/posts/:postId` | 已实现 |
| 置顶 | `PUT /api/v1/admin/forum/posts/:postId/pin` | 已实现 |
| 公告列表 | `GET /api/v1/admin/forum/announcements` | 已实现 |
| 发布公告 | `POST /api/v1/admin/forum/announcements` | 已实现 |
| 更新公告 | `PATCH /api/v1/admin/forum/announcements/:id` | 已实现 |
| 删除公告 | `DELETE /api/v1/admin/forum/announcements/:id` | 已实现 |
| 留言管理 | `GET /api/v1/admin/forum/guestbook/messages` | 已实现 |
| 审计日志 | `GET /api/v1/admin/audit-logs` | 已实现 |

---

## 3. 关键设计决策

1. **动态匿名**：`isAnonymous` toggle 幂等可逆；评论匿名性查询时派生（零写扩散）；AuthorDTO 绝不暴露 userId
2. **两级评论**：rootCommentId 追踪根祖先，parentCommentId 记录直接父级；L1 删除级联软删所有 L2
3. **混合排序**：热门评论有限插队（最多 1h 偏移），不破坏时间线
4. **乐观更新**：提交/删除/点赞/隐藏均先更新本地 state，后台异步落库，失败回滚
5. **隐藏非删除**：`forum_comment_hides` 仅对当前用户生效，其他用户仍可见
6. **公告按需加载**：列表只返标题+日期，点击浮窗请求详情获取正文

---

## 4. 举报治理（已实现）

### 4.1 `POST /api/v1/user/report/:targetId`

举报指定用户。

**请求体：**
```json
{ "reason": "harassment", "detail": "多次私信骚扰" }
```

`reason` 枚举：`harassment | spam | fake_profile | inappropriate_content | other`

### 4.2 `GET /api/v1/admin/reports`

获取举报列表。

**Query Params:** `status=pending|reviewed|dismissed|all`, `page`, `limit`

### 4.3 `PATCH /api/v1/admin/reports/:id`

处理举报。请求体：`{ "status": "reviewed" }` 或 `{ "status": "dismissed" }`

---

## 5. 论坛前端组件清单

### 用户侧

| 组件 | 文件 |
|------|------|
| 论坛列表页 | `frontend/src/pages/Forum.tsx` |
| 帖子详情页 | `frontend/src/pages/ForumPost.tsx` |
| 热榜页 | `frontend/src/pages/ForumRanking.tsx` |
| 留言板页 | `frontend/src/pages/Guestbook.tsx` |
| 帖子卡片 | `frontend/src/components/forum/PostCard.tsx` |
| 评论组件 | `frontend/src/components/forum/CommentItem.tsx` |
| 评论表单 | `frontend/src/components/forum/CommentForm.tsx` |
| 发帖表单 | `frontend/src/components/forum/PostForm.tsx` |
| 公告浮窗 | `frontend/src/components/forum/AnnouncementModal.tsx` |
| 热榜侧栏 | `frontend/src/components/forum/HotRankingSidebar.tsx` |
| 留言板走马灯 | `frontend/src/components/forum/GuestbookMarquee.tsx` |
| 语音录制 | `frontend/src/components/forum/VoiceRecorder.tsx` |
| 类型筛选 | `frontend/src/components/forum/PostTypeFilter.tsx` |
| 圈子论坛头 | `frontend/src/components/forum/CircleForumHeader.tsx` |

### 管理侧

- `Admin.tsx` → `论坛管理` tab：帖子列表 + 删帖 + 置顶 + 公告 CRUD
- `Admin.tsx` → `举报处理` tab：举报列表 + 审核

---

## 6. 数据库表清单（论坛相关）

| 表 | Migration | 说明 |
|----|-----------|------|
| `forum_posts` | 005, 021 | 帖子（含匿名、可见性、互动计数、hotScore） |
| `forum_comments` | 005, 021, 022, 023 | 评论（含两级结构、语音、点赞计数） |
| `forum_post_images` | 021 | 帖子图片 |
| `forum_post_likes` | 021 | 帖子点赞 |
| `forum_post_favorites` | 021 | 帖子收藏 |
| `forum_comment_likes` | 023 | 评论点赞 |
| `forum_comment_hides` | 023 | 评论隐藏 |
| `forum_announcements` | 021 | 公告（024: created_by 改可空） |
| `forum_guestbook_messages` | 021 | 留言板 |
| `user_notifications` | 021 | 站内通知中心 |

---

## 7. 圈子接入论坛边界

论坛是否属于某个圈子，通过 `circleId` 决定：

- `circleId = null`：全站论坛
- `circleId != null`：圈子专属论坛

责任边界：

- **第三组**：`/api/v1/forum/*` 接口、论坛页面、`circleId` 筛选、圈子成员发帖校验、圈子帖管理
- **第二组**：圈子页提供"进入圈子论坛"入口，透传 `circleId`/`circleName`

不允许第二组单独发明 `/circles/:circleId/forum` 这类重复论坛接口。
