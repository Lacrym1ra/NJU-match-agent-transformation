# Group3 论坛与治理开发计划书（执行版）

> 版本：v2.0（暂只包括基础功能）  | 日期：2026-04-26 by XYH

---

## 1. 当前状态

按仓库真实代码状态整理（`backend/src`、`frontend/src`、`backend/src/db`）。

### 1.1 已经真实可用的能力

后端已实现并可联调：
- `POST /api/v1/user/report/:targetId`（举报用户）
- `POST /api/v1/user/block/:targetId`、`DELETE /api/v1/user/block/:targetId`（拉黑/取消拉黑）
- `GET /api/v1/admin/reports`（举报列表）
- `PATCH /api/v1/admin/reports/:id`（处理举报，状态 reviewed/dismissed）

数据库已存在：
- `user_reports`、`user_blocks`、`audit_logs`
- `forum_posts`、`forum_comments`

### 1.2 还没做完的关键缺口

- 后端 **还没有注册** `/api/v1/forum` 路由（`backend/src/index.ts`）
- 前端 **没有** `/forum` 页面和论坛 API 封装
- 前端 `Reveal.tsx`/`Dashboard.tsx` 还没接举报/拉黑入口
- 前端 `Admin.tsx` 还没接举报处理面板
- `forum_posts.type` 仍是旧值 `post|squad`，与目标类型体系不一致

---

## 2. 开发原则

1. **先把已实现接口用起来**：先接举报治理，能最快出可见成果。  
2. **先打通主链路，再做增强**：先能发帖/看帖/评论/删帖，再做管理端置顶等扩展。  
3. **文档与代码一致**：任何“已完成”必须能在真实仓库文件中找到证据。  
4. **不跳步**：数据库约束不统一时，不进入论坛正式联调阶段。  

---

## 3. 该做什么

### Phase A：基线统一（先统一数据与契约）

**目标**：把论坛帖子类型从旧体系统一到新体系，避免前后端反复改。  
**为什么先做**：如果枚举不统一，后续接口联调会不断报错。

#### 改哪些文件
- `backend/src/db/migrations/` 新增迁移（例如 `006_forum_type_upgrade.ts`）
- `backend/src/db/migrate.ts` 注册该迁移
- （必要时）`backend/src/db/schema.ts` 注释/类型说明与实际约束保持一致

#### 完成标准 
- 后端启动迁移成功
- 历史 `post` 数据映射为 `general`（若有历史数据（有吗。？））
- 最终允许类型与论坛 API 约定一致


---

### Phase B：论坛用户端 API 落地（后端优先）

**目标**：用户可以“看列表、发帖、看详情、评论、软删除”。  
**为什么先做后端**：前端页面可先 mock，但真实联调必须有后端路由。

#### 后端任务
- 新建 `backend/src/routes/forum.ts`
- 新建 `backend/src/services/forumService.ts`（或等价组织）
- 在 `backend/src/index.ts` 注册：`app.use('/api/v1/forum', forumRoutes)`

#### 首批最小接口
- `GET /api/v1/forum/posts`
- `POST /api/v1/forum/posts`
- `GET /api/v1/forum/posts/:postId`
- `POST /api/v1/forum/posts/:postId/comments`
- `DELETE /api/v1/forum/posts/:postId`
- `DELETE /api/v1/forum/comments/:commentId`

#### 关键规则（必须实现）
- 列表过滤：`deleted_at is null`
- 排序：`is_pinned DESC, created_at DESC`
- 软删除：写 `deleted_at`，不物理删除
- 圈子帖子：`circleId` 不为空时做成员校验

---

### Phase C：论坛前端页面接入

**目标**：用户真正能在界面使用论坛功能。  
**为什么独立一阶段**：前端页面状态复杂，和后端接口分开推进更稳。

#### 建议文件
- `frontend/src/api/forum.ts`
- `frontend/src/pages/Forum.tsx`
- `frontend/src/pages/ForumPost.tsx`
- `frontend/src/components/forum/*`
- `frontend/src/App.tsx` 增加 `/forum` 与 `/forum/:postId`

#### 页面最低可用标准
- 能看帖子列表（支持分页/类型筛选）
- 能发帖
- 能进入详情页看评论树
- 能评论与二级回复
- 能删除自己的帖子/评论（软删除效果）

---

### Phase D：治理能力前端化（立刻可出成果）

**目标**：把已有治理后端接口变成可操作页面。  
**为什么现在做**：后端接口已存在，接前端性价比最高。

#### D1 管理端举报处理面板（Admin）
- 在 `frontend/src/pages/Admin.tsx` 增加“举报处理”区域
- 调用：
  - `GET /api/v1/admin/reports`
  - `PATCH /api/v1/admin/reports/:id`
- 支持状态筛选与分页

#### D2 用户端举报/拉黑入口（Reveal + Dashboard）
- 新建 `frontend/src/api/safety.ts`
- 在 `Reveal.tsx`、`Dashboard.tsx` 增加“举报/拉黑”入口
- 调用：
  - `POST /api/v1/user/report/:targetId`
  - `POST /api/v1/user/block/:targetId`
  - `DELETE /api/v1/user/block/:targetId`

---

### Phase E：论坛管理端能力

**目标**：管理员可管理帖子（删帖/置顶/查询）。  
**为什么放后面**：属于增强能力，依赖论坛主链路稳定。

#### 需要补的后端接口
- `GET /api/v1/admin/forum/posts`
- `DELETE /api/v1/admin/forum/posts/:postId`
- `PUT /api/v1/admin/forum/posts/:postId/pin`

#### 需要补的前端
- `Admin.tsx` 新增“论坛管理”区块或 Tab
- 表格支持筛选、删帖、置顶切换

#### 审计要求
- 管理动作必须写 `audit_logs`

---

## 4. 跨组协作边界（防止重复开发）

### Group3（本组）负责
- `/forum/*` 的后端与前端
- 治理接口前端接入（举报/拉黑、Admin 举报处理）
- `circleId` 维度的论坛过滤与权限校验

### Group2 协作点
- 圈子页提供跳转入口到论坛（带 `circleId` 参数）

---

## 5. 任务验收清单（做完就打勾）

### A. 基线统一
- [ ] 新迁移文件已创建并注册
- [ ] 迁移可执行且无报错
- [ ] forum 类型约束与接口契约一致

### B. 论坛后端
- [ ] `/api/v1/forum` 已在 `index.ts` 注册
- [ ] 帖子列表/发帖/详情/评论/删除接口可用
- [ ] 圈子成员校验可拦截越权发帖

### C. 论坛前端
- [ ] `/forum`、`/forum/:postId` 可访问
- [ ] 真实调用后端接口（非 mock）
- [ ] 评论树与软删除展示正确

### D. 治理前端
- [ ] Admin 举报列表可查可审
- [ ] Reveal/Dashboard 可发起举报和拉黑
- [ ] 成功/失败反馈明确，不影响原有匹配流程

### E. 管理端论坛治理
- [ ] 管理员可筛选帖子、删帖、置顶
- [ ] 管理动作写入审计日志

---

## 6. 组员开发理解顺序

1. 先读：`backend/src/index.ts`、`backend/src/routes/user.ts`、`backend/src/routes/admin.ts`  
2. 再读：`backend/src/db/schema.ts`、`backend/src/db/migrations/005_forum.ts`  
3. 再看前端：`frontend/src/App.tsx`、`frontend/src/pages/Admin.tsx`、`Reveal.tsx`、`Dashboard.tsx`  
 


**先让已有能力“可见可用”，再做新增能力。**



