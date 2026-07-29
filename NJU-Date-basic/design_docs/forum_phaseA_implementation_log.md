# Phase A 论坛增强 — 实现日志

> 日期：2026-05-26 ~ 2026-05-27 | 分支：feature/g3-forum-A

## 一、初始 Phase A 核心任务（T1 ~ T14 + F1 ~ F4）

全部完成，详见原始日志。

---

## 二、Phase A 补充完善（2026-05-27）

### 补1：通知中心 API（4 端点）

| 端点 | 说明 |
|------|------|
| `GET /api/v1/user/notifications` | 分页获取通知列表，支持 `isRead`/`type` 过滤 |
| `GET /api/v1/user/notifications/unread-count` | 获取未读通知数 |
| `PATCH /api/v1/user/notifications/read-all` | 全部标为已读 |
| `PATCH /api/v1/user/notifications/:id/read` | 单条标为已读（含所有权校验） |

- 前端新增 `frontend/src/api/user.ts` 对应 4 个函数 + `NotificationItem` / `NotificationListResponse` 类型

### 补2：热榜性能与一致性修复

- **移除 `listPosts?sort=hot` 全表 UPDATE**：每次请求不再更新所有帖子的 hot_score，改由互动触发更新
- **`getHotRanking()` 去掉时间范围过滤**：改为全时段公开帖，与决策"热榜无时间限制"一致
- **`ForumRanking.tsx` 标题 "24h 热榜" → "热榜"**

### 补3：Admin 公告/留言列表端点

| 端点 | 说明 |
|------|------|
| `GET /admin/forum/announcements` | 分页列出所有公告（含停用），支持 `isActive` 过滤 |
| `GET /admin/forum/guestbook/messages` | 分页列出所有留言（含已隐藏），支持 `status` 过滤 |

### 补4：语音转写端点

- `POST /forum/comments/:commentId/transcript` — 异步转写，状态机 `none → pending → success/failed`
- `backend/src/services/transcriptionService.ts` — DashScope Paraformer-v2 API 调用
- **注意**：需要真实 `DASHSCOPE_API_KEY` 才能工作；前端后续移除此功能后仅保留后端

### 补5：图片/语音 URL 校验修复

- `createPostSchema` 的 `images` 字段：`z.string().url()` → `z.string().min(1).max(500)`（上传返回相对路径，不需要完整 URL）
- `createCommentSchema` 的 `voiceUrl` 字段同理

### 补6：评论回复无限嵌套修复

- `CommentItem.tsx` 回复按钮从 `depth === 0` 改为无条件显示，允许任意层级回复

---

## 三、双层评论系统（小红书模式）

### 数据库（Migration 022）
- `forum_comments` 新增 `root_comment_id TEXT REFERENCES forum_comments(id)` + 索引
- 递归 CTE 回填已有数据的根祖先
- `user_notifications` 类型约束扩展 `'comment_replied'`

### 后端
- **删除** `buildCommentTree()` 递归函数
- **新增类型** `CommentItemWithReplies`（含 `replyCount` + `previewReplies`）+ `ReplyItem`（含 `replyToNickname`）
- **重写 `getPostDetail()`**：一级评论 → 批量 replyCount + 每条 2 条预览回复 → 扁平结构
- **重写 `createComment()`**：从父评论推导 `rootCommentId`；回复评论时通知被回复者
- **重写 `deleteComment()`**：一级评论级联软删所有二级回复
- **新增 `getCommentReplies(rootCommentId, page, limit)`**：分页查询二级回复
- 新增 `GET /forum/comments/:rootCommentId/replies` 路由

### 前端
- `CommentItem` 类型改为 `replyCount` + `previewReplies: ReplyItem[]`（非递归）
- `CommentItem.tsx`：预览 2 条子回复 + "展开更多 N 条" 按钮 + `ReplyItemComponent` 子组件
- `ForumPost.tsx`：`expandedReplies`/`loadingReplies` 状态 + `handleLoadMoreReplies`
- 评论计数改用 `post.commentCount`（含全部回复）
- "展开更多"修复：添加 `isExpanded` prop 避免预览与展开重复
- `fetchDetail` 时清空 `expandedReplies` 确保新回复可见

---

## 四、评论互动系统（点赞 + 隐藏 + 混合排序 + 乐观更新）

### 数据库（Migration 023）
- 新建 `forum_comment_likes` 表（唯一索引 `comment_id + user_id`）
- 新建 `forum_comment_hides` 表（唯一索引 `comment_id + user_id`）
- `forum_comments` 新增 `like_count INTEGER NOT NULL DEFAULT 0`

### 后端
- 新增 `likeComment` / `unlikeComment` / `hideComment` 服务函数
- `getPostDetail` 一级评论使用**混合排序**：
  - 窗口函数计算该帖平均点赞数 AVG
  - `sort_score = time - boost`，超出均值的点赞量折算为时间负偏移（最多 1 小时）
  - 热门评论"插队但不破坏时间线"
- `getPostDetail` + `getCommentReplies` 增加：
  - LEFT JOIN `forum_comment_likes` → `likeCount` + `likedByMe`
  - LEFT JOIN `forum_comment_hides` → 过滤已隐藏评论
- `createComment` 返回值新增 `rootCommentId`
- 新增路由：
  - `POST /forum/comments/:commentId/like`
  - `DELETE /forum/comments/:commentId/like`
  - `POST /forum/comments/:commentId/hide`

### 前端

**乐观提交（无刷新）**：
- `handleCommentSubmit` 不再调 `fetchDetail()`，直接 push 到本地 state
- 一级评论追加到 `comments` 数组末尾
- 二级回复插入到父评论 `previewReplies` + 更新 `expandedReplies`（若已展开）

**点赞**：
- 心形图标（`favorite`/`favorite_border`）+ 计数，操作栏可见
- 乐观切换 `likedByMe` + `likeCount`，后台异步调 API

**隐藏（不想看）**：
- 心碎图标（`heart_broken`）在操作栏可见
- 从本地 state 立即移除，后台异步调 API 落库

**删除**：
- `confirm()` 确认 → 乐观移除 → 调 API → 失败回滚
- 一级评论级联移除所有二级回复
- `AnimatePresence` + `motion.div` 淡出动画

---

## 五、语音评论 UI

- 自定义语音气泡替代原生 `<audio>` 元素
- 圆角胶囊形 + 浅紫色背景 + 播放/暂停图标 + 波形动画条 + 时长
- 播放时波形条随机跳动，暂停恢复静态高度
- 点击切换播放状态，隐藏的 `<audio>` 承载实际播放
- "转文字"功能前端已移除，仅保留语音气泡

---

## 六、文件变更清单

### 后端新增文件
```
backend/src/db/migrations/022_forum_comments_two_level.ts
backend/src/db/migrations/023_comment_interactions.ts
backend/src/services/transcriptionService.ts
```

### 后端修改文件
```
backend/src/db/migrate.ts                              (+2 migrations)
backend/src/db/schema.ts                               (+rootCommentId, +likeCount, +2 tables)
backend/src/routes/forum.ts                            (+like/unlike/hide/replies/transcript routes, URL validation fix)
backend/src/routes/user.ts                             (+4 notification endpoints)
backend/src/routes/admin.ts                            (+2 GET endpoints)
backend/src/services/forumService.ts                   (major rewrite: 2-level, likes, hides, hybrid sort)
```

### 前端修改文件
```
frontend/src/api/forum.ts                              (types + 6 new functions)
frontend/src/api/user.ts                               (notification types + functions)
frontend/src/components/forum/CommentItem.tsx           (major rewrite: 2-level, likes, hides, voice bubble, no recursion)
frontend/src/pages/ForumPost.tsx                       (optimistic submit/delete/like/hide, expanded replies, animations)
frontend/src/pages/ForumRanking.tsx                    (title fix)
```

---

## 七、动态匿名功能（2026-05-28）

### 设计原则
- **查询时派生**：评论匿名性由帖子的 `isAnonymous` + `userId` 实时计算，不在 comment 表冗余存储
- **零写扩散**：toggle 只改 `forum_posts` 一行，所有 OP 历史评论瞬间生效
- **DTO 隔离**：AuthorDTO 绝不包含 `userId`，用 `isOwn: boolean` 替代所有权判断

### 后端改动
- `maskAuthor()` 升级为无参函数，返回 `{ nickname: '匿名楼主', avatarUrl: null, isOwn: false }`
- 新增 `toAuthorDTO(author, viewerUserId)` 构建真实 AuthorDTO
- 新增 `togglePostAnonymity()` 服务函数 — 幂等 toggle，替代单向 `cancelAnonymous`
- `getPostDetail()` / `getCommentReplies()` 的评论 DTO 映射层加入 OP 匿名化逻辑
- 新增 `PATCH /forum/posts/:postId/anonymity` 路由，旧 `cancel-anonymous` 标记 @deprecated
- `getHotRanking()` 采用新的 `maskAuthor()` / `toAuthorDTO()`

### 前端改动
- `PostAuthor` 重命名为 `AuthorDTO`：`{ nickname, avatarUrl, isOwn }`（无 userId）
- `CommentItem` / `ReplyItem` 新增 `isAnonymousOP: boolean` 字段
- `CommentItem.tsx` / `ForumPost.tsx` 所有权判断从 `author.userId === currentUserId` 改为 `author.isOwn`
- 移除所有 `currentUserId` prop 传递链路
- 新增 `togglePostAnonymity()` API 函数
- 乐观更新时正确计算 `isAnonymousOP`

### 防护清单
| 出口 | 匿名化 |
|------|--------|
| post.author（列表/详情/热榜）| 匿名时 mask |
| L1 评论 author | OP 匿名时 mask |
| L2 回复 author | OP 匿名时 mask |
| replyToNickname | L2 回复目标为匿名 OP 时替换为 "匿名楼主" |
| userId 永不落 DTO | AuthorDTO 无 userId 字段 |

---

## 八、关键设计决策

1. **混合排序**：`sort_score = time - LEAST((like - avg) / avg * 1800, 3600)`，上限 1h 偏移
2. **二级回复扁平化**：rootCommentId 追踪根祖先，parentCommentId 记录直接回复对象
3. **乐观更新**：提交/删除/点赞/隐藏均先更新本地 state，后台异步落库，失败回滚
4. **隐藏并非删除**：仅插入 `forum_comment_hides` 记录，查询时 LEFT JOIN 过滤
5. **级联软删**：一级评论删除时一并软删所有二级回复，commentCount 同步扣减
6. **通知分流**：回复帖子通知帖主，回复评论通知被回复者

---

## 九、2026-05-28 补充完善

### 补7：评论数即时更新
- 删除评论时乐观扣减 `post.commentCount`，失败回滚恢复
- 发送评论时乐观递增 `post.commentCount`
- L1 级联删除时扣减 `1 + replyCount`，与后端 `allIds.length` 一致

### 补8：管理后台论坛 Tab 开关
- `FORUM_FEATURE_ENABLED` 从 `false` 改为 `true`，论坛管理 tab 可见
- Tab 包含：帖子管理（列表/删帖/置顶）+ 公告管理（CRUD）

### 补9：公告管理 UI
- Admin.tsx → 论坛管理 tab 底部新增公告管理区域
- 新建/编辑/删除公告，表单含标题、内容、启用开关、优先级
- 使用 `adminFetch` 基础函数，`window.alert` 反馈

### 补10：公告 created_by 可空修复
- Migration 024：`ALTER TABLE forum_announcements ALTER COLUMN created_by DROP NOT NULL`
- Admin 通过 API Key 验证，无 userId，`createdBy` 置 null

### 补11：公告栏 UI 重构
- 列表改为横向布局：标题（截断省略号）+ 日期（右对齐灰色）
- 点击标题弹出 `AnnouncementModal` 浮窗（遮罩层 + 动画）
- 按需加载：列表只返 title + date，点击请求详情获取 content
- 新增 `GET /forum/announcements/:id` 详情端点
- 移除公告栏 ✕ 关闭按钮，公告栏始终可见
- `CommentItem.tsx` 修复 `<audio>` src 类型 `string|null` → `string|undefined`

### 补12：接口文档全面更新
- `backend/docs/API_REFERENCE.md` §5 论坛章节重写：全部 30+ 端点含完整 Request/Response
- `design_docs/FORUM_GOVERNANCE_API.md` 重写为 v2.0：实现状态总览 + 关键设计决策 + 组件/数据库清单
- `design_docs/GROUP_API_GUIDE.md` 论坛状态从"设计已定"更新为"Phase A 已完成"

### 新增/修改文件
```
backend/src/db/migrations/024_announcement_created_by_nullable.ts  (+新 migration)
backend/src/db/migrate.ts                                           (+1 migration)
backend/src/db/schema.ts                                            (createdBy 可空)
backend/src/routes/forum.ts                                         (+announcement detail route)
backend/src/routes/admin.ts                                         (createdBy ?? null)
backend/src/services/forumService.ts                                (+getAnnouncement)
frontend/src/api/forum.ts                                           (AnnouncementDetail, getAnnouncementDetail)
frontend/src/api/admin.ts                                           (+6 announcement admin functions)
frontend/src/pages/Forum.tsx                                        (sidebar layout, modal integration)
frontend/src/pages/ForumPost.tsx                                    (commentCount optimistic update)
frontend/src/pages/Admin.tsx                                        (FORUM_FEATURE_ENABLED=true, announcement CRUD)
frontend/src/components/forum/AnnouncementModal.tsx                  (+新组件)
frontend/src/components/forum/CommentItem.tsx                       (audio src fix)
```
