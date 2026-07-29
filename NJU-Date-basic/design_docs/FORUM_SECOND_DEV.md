# Group3 论坛与主页增强开发计划书（执行版）

> 版本：v3.0（按当前代码现状重排） | 日期：2026-05-26

---

## 1. 当前状态（以现有代码为准）

按仓库真实代码核对（`backend/src`、`frontend/src`、`backend/src/db`）。

### 1.1 已落地能力

后端论坛基础链路已存在：
- `/api/v1/forum` 已在 `backend/src/index.ts` 注册。
- 已有接口：
  - `GET /api/v1/forum/posts`
  - `POST /api/v1/forum/posts`
  - `GET /api/v1/forum/posts/:postId`
  - `POST /api/v1/forum/posts/:postId/comments`
  - `DELETE /api/v1/forum/posts/:postId`
  - `DELETE /api/v1/forum/comments/:commentId`
- 已实现圈子权限校验（圈子帖发帖/看帖/评论需 active 成员）。
- 已实现软删除（`deleted_at`）。

前端论坛已可用：
- `frontend/src/pages/Forum.tsx`、`ForumPost.tsx` 已接真实 API。
- `frontend/src/api/forum.ts` 已封装论坛基础接口。
- `frontend/src/components/forum/*` 已有发帖、列表、评论组件。

治理能力（用户举报/拉黑）已落地：
- 用户侧：`/api/v1/user/report/:targetId`、`/api/v1/user/block/:targetId`、`DELETE /api/v1/user/block/:targetId`。
- 管理侧：`GET /api/v1/admin/reports`、`PATCH /api/v1/admin/reports/:id`。
- 前端 `Reveal.tsx`、`Dashboard.tsx` 已接举报/拉黑。

论坛管理端已落地：
- `GET /api/v1/admin/forum/posts`
- `DELETE /api/v1/admin/forum/posts/:postId`
- `PUT /api/v1/admin/forum/posts/:postId/pin`

数据库现状：
- `forum_posts`、`forum_comments` 已有基础字段。
- `017_forum_type_upgrade.ts` 已将类型升级到 `general|squad|help|trade|activity`。
- 尚无论坛点赞/收藏/信用分/论坛举报/公告/留言板相关表。

### 1.2 本次目标对应的真实缺口

论坛主功能缺口：
- 点赞/收藏、热榜、公告栏、留言板。
- 帖子图片、评论语音与转写。
- 匿名、私密可见性、互动计数。

个人主页缺口：
- “我的帖子/点赞/收藏/论坛消息”聚合区未落地。
- 个性签名、主页标签、最近图片九宫格（论坛维度）未落地。

信用分机制缺口：
- 用户 `credit_score`/`credit_level` 字段未落地。
- `credit_score_logs` 未落地。
- 论坛内容举报审核 -> 扣分闭环未落地。

---

## 2. 开发原则

1. 只做可执行方案：所有“已完成”必须能在代码中定位。
2. 先定义接口和共享类型，再并行开发页面与服务。
3. 论坛主链路、个人主页、信用分拆开推进，减少互锁。
4. 开发与测试分离：开发文档只给测试提示，不混写测试实现。

---

## 3. 三人/三阶段分工（主线拆分）

> 三条主线：A 论坛主功能、B 个人主页论坛区、C 信用分与治理闭环。

### Phase A（开发者A）：论坛主功能增强

目标：在现有论坛基础上补齐“可用性核心”能力。

A 负责范围：
- 数据层：论坛增强字段与互动表。
- 后端：帖子增强、评论增强、点赞收藏、热榜、公告、留言板接口。
- 前端：论坛页功能增强（不含个人主页聚合）。

A 必做接口（新增）：
- `POST /api/v1/forum/posts`（支持 `isAnonymous`、`visibility`、`images`）
- `PATCH /api/v1/forum/posts/:postId/cancel-anonymous`
- `PATCH /api/v1/forum/posts/:postId/privacy`
- `POST /api/v1/forum/posts/:postId/like`
- `DELETE /api/v1/forum/posts/:postId/like`
- `POST /api/v1/forum/posts/:postId/favorite`
- `DELETE /api/v1/forum/posts/:postId/favorite`
- `GET /api/v1/forum/ranking/hot`
- `GET /api/v1/forum/announcements`
- `GET /api/v1/forum/guestbook/messages`
- `POST /api/v1/forum/guestbook/messages`

A 关键实现文件：
- `backend/src/db/migrations/*`（新增）
- `backend/src/db/schema.ts`
- `backend/src/services/forumService.ts`
- `backend/src/routes/forum.ts`
- `frontend/src/api/forum.ts`
- `frontend/src/pages/Forum.tsx`
- `frontend/src/pages/ForumPost.tsx`
- `frontend/src/components/forum/*`

### Phase B（开发者B）：个人主页论坛区

目标：在“现有 Profile/Settings/Dashboard”体系中落地论坛聚合区。

B 负责范围：
- 后端：`/forum/me/*` 聚合查询接口。
- 前端：个人主页论坛 Tab（我的帖子/点赞/收藏/消息/最近图片）。
- 资料增强：签名、主页标签字段及编辑接口。

B 必做接口（新增）：
- `GET /api/v1/forum/me/posts`
- `GET /api/v1/forum/me/liked-posts`
- `GET /api/v1/forum/me/favorited-posts`
- `GET /api/v1/forum/me/recent-images?limit=9`
- `GET /api/v1/forum/me/messages`
- `PATCH /api/v1/user/profile/signature`
- `PATCH /api/v1/user/profile/tags`

B 关键实现文件：
- `backend/src/db/migrations/*`（users 增字段）
- `backend/src/db/schema.ts`
- `backend/src/routes/forum.ts`（me 聚合接口）
- `backend/src/routes/user.ts`（signature/tags）
- `frontend/src/api/forum.ts`、`frontend/src/api/user.ts`
- `frontend/src/pages/Dashboard.tsx`（或新增独立主页页）

### Phase C（开发者C）：信用分与治理闭环

目标：建设论坛内容治理闭环，并与信用分联动。

C 负责范围：
- 数据层：`forum_reports`、`credit_score_logs`、users 信用分字段。
- 后端：论坛举报、管理员审核、扣分事务、审计日志。
- 前端：管理端论坛举报处理面板（可在现有 Admin 扩展）。

C 必做接口（新增）：
- `POST /api/v1/forum/reports`
- `GET /api/v1/admin/forum/reports`
- `PATCH /api/v1/admin/forum/reports/:id`（`approve|reject`）

C 关键实现文件：
- `backend/src/db/migrations/*`
- `backend/src/db/schema.ts`
- `backend/src/routes/forum.ts`
- `backend/src/routes/admin.ts`
- `backend/src/services/forumGovernanceService.ts`（建议新增）
- `frontend/src/api/admin.ts`
- `frontend/src/pages/Admin.tsx`

---

## 4. 接口与交叉类定义（并行开发前先定稿）

### 4.1 共享枚举（必须统一）

- `ForumVisibility = 'public' | 'private'`
- `ForumCommentType = 'text' | 'voice'`
- `ForumReportTargetType = 'post' | 'comment'`
- `ForumReportStatus = 'pending' | 'approved' | 'rejected'`
- `CreditLevel = 'normal' | 'limited' | 'banned'`

### 4.2 共享 DTO（后端返回/前端消费）

- `ForumPostDTO`
  - `postId, circleId, title, content, type, isAnonymous, visibility, images[], likeCount, favoriteCount, commentCount, viewCount, hotScore, createdAt`
- `ForumCommentDTO`
  - `commentId, postId, parentCommentId, commentType, content, voiceUrl, voiceDurationSec, transcript, transcriptStatus, createdAt`
- `ForumMeListDTO`
  - `total, page, limit, posts: ForumPostDTO[]`
- `CreditScoreChangeDTO`
  - `userId, delta, reason, sourceType, sourceId, createdAt`

### 4.3 交叉服务边界（避免互改）

- A 对外提供：
  - `ForumReadService`（列表/详情/热榜）
  - `ForumInteractService`（点赞/收藏/评论）
- B 只读依赖 A：
  - B 不直接改 A 的核心查询 SQL，通过 `GET /forum/me/*` 取数据。
- C 依赖 A 的帖子/评论存在性校验：
  - C 在治理服务里只调用“内容存在性接口/查询函数”，不复制帖子业务规则。
- C 对外提供：
  - `CreditService.adjustScore(...)`
  - `ForumGovernanceService.reviewReport(...)`
- A/B 不直接写信用分，只通过 C 的服务能力。

### 4.4 交叉规则（必须一致）

1. 软删除帖子/评论不能参与热榜与点赞收藏计数。
2. 私密帖仅作者与管理员可见；个人主页“我的内容”可见本人私密帖。
3. 举报审核通过才扣分，且同一举报单幂等扣分一次。
4. 匿名撤销不可逆，非匿名帖不可后改匿名。

---

## 5. 执行顺序（按依赖排）

1. A/C 先合并数据库迁移基线（论坛增强 + 信用分字段）。
2. A 完成论坛增强接口最小可用版并提供联调环境。
3. C 接入论坛举报审核与信用分事务逻辑。
4. B 基于稳定接口完成个人主页论坛区。
5. A/B/C 分别自测后交测试同学统一回归。

---

## 6. 分工验收清单

### A 验收
- [ ] 论坛点赞/收藏/热榜/公告/留言板接口可用。
- [ ] 发帖支持匿名/私密/图片，评论支持文字+语音。
- [ ] 论坛页完成前端接入并可真实联调。

### B 验收
- [ ] 个人主页论坛区可查看我的帖子/点赞/收藏/消息。
- [ ] 最近图片九宫格与签名/标签编辑可用。
- [ ] 仅通过约定接口取数，无绕过服务层直连逻辑。

### C 验收
- [ ] 论坛举报提交、管理审核、结果回写闭环可用。
- [ ] 审核通过触发信用分扣减并写 `credit_score_logs`。
- [ ] 管理动作有审计日志，重复审核不重复扣分。

---

## 7. 测试方法提示（开发与测试分开）

> 以下仅为测试提示，供测试同学编写用例。

### 7.1 论坛主线测试（对应 A）

- 功能流：发帖（匿名/非匿名、私密/公开、带图/不带图）-> 评论（文字/语音）-> 点赞收藏 -> 热榜排序验证。
- 权限流：圈子外用户访问圈子帖、私密帖他人访问、删除后访问。
- 边界流：重复点赞/收藏幂等、匿名撤销不可逆、语音评论与文字互斥。

### 7.2 个人主页测试（对应 B）

- 数据一致性：主页“我的帖子/点赞/收藏”与论坛实际数据一致。
- 最近图片：只取最近帖子图片，数量上限 9。
- 资料编辑：签名/标签更新后前后端显示一致，空值/超长值校验正确。

### 7.3 信用分治理测试（对应 C）

- 举报闭环：提交举报 -> 后台审核通过/拒绝 -> 状态与通知一致。
- 扣分幂等：同一举报单重复审核通过不得重复扣分。
- 审计一致性：管理员每次处理均有 audit 记录。
- 回归重点：信用分变更不影响原用户举报/拉黑链路。

---

## 8. 风险与落地约束

1. 本次新增表多，migration 必须支持回滚并先在测试库演练。
2. 涉及媒体上传（图/音）需先约定存储与鉴权策略，再开放前端入口。
3. 个人主页入口放在 `Dashboard` 还是独立页需在实现前固定，避免 B 返工。
4. 若排期紧，优先级顺序：`C(治理闭环) > A(互动与媒体) > B(主页增强)`。

