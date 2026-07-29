# 论坛草稿箱、评论置顶、帖内投票架构文档

> 目标：基于当前仓库真实代码状态，为全站论坛新增 3 个功能：发帖草稿箱、一级评论置顶、帖内投票。本文用于指导开发落地，重点说明需要修改的接口、数据表、DTO、前端交互与验收标准。
>
> 范围限制：本次开发不得涉及任何 circle/圈子相关内容，不新增、不修改、不预留任何圈子论坛逻辑。

## 1. 当前代码状态

### 1.1 后端现状

论坛后端集中在以下文件：

- 路由：`backend/src/routes/forum.ts`
- 服务：`backend/src/services/forumService.ts`
- 治理服务：`backend/src/services/forumGovernanceService.ts`
- 表结构：`backend/src/db/schema.ts`
- 迁移：`backend/src/db/migrations/*`
- 迁移入口：`backend/src/db/migrate.ts`

当前已实现：

- `forum_posts`：帖子表，已有 `title/content/type/is_anonymous/visibility/is_pinned/is_locked/like_count/favorite_count/comment_count/view_count/hot_score/has_images/deleted_at` 等字段。
- `forum_comments`：评论表，已支持两级评论：
  - 一级评论：`parent_comment_id IS NULL`
  - 二级回复：`root_comment_id` 指向一级评论
  - 已有 `deleted_at` 软删除、`like_count`、语音评论字段。
- `forum_post_images`：帖子图片。
- `forum_comment_likes`：评论点赞，当前点赞逻辑会拒绝已删除评论。
- `forum_reports`：论坛举报，审核通过评论后会把评论 `deleted_at` 置为当前时间，并将内容改为 `该评论已因违规被删除`。

当前主要接口：

- `POST /api/v1/forum/posts`：发帖，支持标题、正文、类型、匿名、可见性、图片。
- `GET /api/v1/forum/posts/:postId`：帖子详情，返回帖子、图片和一级评论列表。
- `POST /api/v1/forum/posts/:postId/comments`：发表评论。
- `DELETE /api/v1/forum/comments/:commentId`：软删除评论。
- `POST /api/v1/forum/comments/:commentId/like` / `DELETE .../like`：评论点赞/取消点赞。

当前一级评论排序在 `getPostDetail` 中通过原生 SQL 实现，按“时间线 + 高赞轻微前移”的混合逻辑排序。新增评论置顶必须在这个排序之前插入置顶优先级，其余评论继续保持原逻辑。

### 1.2 前端现状

论坛前端集中在以下文件：

- API 类型与请求：`frontend/src/api/forum.ts`
- 发帖弹窗：`frontend/src/components/forum/PostForm.tsx`
- 评论组件：`frontend/src/components/forum/CommentItem.tsx`
- 帖子详情页：`frontend/src/pages/ForumPost.tsx`

当前 `PostForm.tsx` 每次打开时都会重置：

```ts
setType(defaultType || 'general');
setTitle('');
setContent('');
setIsAnonymous(false);
setVisibility('public');
setImages([]);
```

因此草稿功能应从这里接入。

当前 `ForumPost.tsx` 的内容展示顺序是：

1. 正文 `post.content`
2. 图片 `post.images`
3. 帖子点赞/收藏/评论/浏览操作栏
4. 评论区

帖内投票要求展示在正文之后、图片之前，因此应插入在正文和图片 gallery 中间。

当前 `CommentItem.tsx` 已有回复、点赞、删除、举报按钮。一级评论的举报按钮在操作行最右侧，置顶按钮应放在一级评论举报按钮左侧，图标风格与 `MaterialIcon` 保持一致。

## 2. 功能一：发帖草稿箱

### 2.1 产品规则

触发草稿提示的唯一条件：

- 用户关闭发帖弹窗时，`title.trim()` 或 `content.trim()` 至少一个非空。

不触发草稿提示：

- 只选择了分类、匿名、私密、投票等配置，但标题和正文都为空。
- 正常发布成功。
- 用户手动清空标题和正文后退出。
- 正在提交中。

关闭弹窗时，如果满足触发条件，提示用户是否保存此次编辑：

- 选择保存：把当前编辑状态保存为草稿，关闭弹窗。
- 选择不保存：清除已有草稿，关闭弹窗。
- 取消关闭：留在发帖弹窗。

下次再次发帖时，如果存在草稿，弹窗直接恢复上次保存状态，不再二次询问。

### 2.2 数据存储方案

草稿不进后端数据库，使用前端 `localStorage`。理由：

- 草稿是未发布内容，属于本机编辑状态，不需要治理、搜索、审核。
- 当前需求只要求“下一次用户再次想要发帖时”恢复，不要求跨设备同步。
- 不新增后端表可以避免未发布敏感内容落库。

建议 key：

```text
forum:draft:global
```

本次开发只支持全站论坛草稿，不按其他业务域拆分草稿 key。

草稿结构：

```ts
interface ForumPostDraft {
  version: 1;
  savedAt: string;
  title: string;
  content: string;
  type: ForumPostType;
  isAnonymous: boolean;
  visibility: ForumVisibility;
  images: string[];
  pollEnabled: boolean;
  pollOptions: string[];
}
```

说明：

- `images` 只保存已上传成功后的 URL，不保存 `File` 或 `blob:` 预览地址。
- 如果图片仍在上传中，关闭时应提示“图片上传中，暂不能保存草稿”或禁用关闭，避免保存不可恢复状态。
- `pollEnabled/pollOptions` 是为本次投票功能预留，同一个草稿逻辑统一保存。

### 2.3 前端改动

修改 `frontend/src/components/forum/PostForm.tsx`：

- 新增草稿读写工具函数：
  - `getDraftKey()`
  - `loadDraft(key)`
  - `saveDraft(key, draft)`
  - `clearDraft(key)`
- `isOpen` 从 `false -> true` 时：
  - 若存在草稿，恢复草稿状态。
  - 若无草稿，使用当前默认初始化逻辑。
- `handleClose` 改为异步确认流程：
  - 如果 `title/content` 都为空：清空草稿并关闭。
  - 如果有标题或正文：弹出确认框。
- 发布成功后：
  - 清空表单。
  - 清除全站论坛草稿。

建议复用现有 `frontend/src/components/ConfirmDialog.tsx`。如果 `PostForm` 当前不方便使用 hook，可在 `PostForm` 内做一个轻量确认 modal，但视觉需与现有确认弹窗一致。

### 2.4 后端接口改动

草稿箱不新增后端接口。

但投票功能会扩展 `POST /api/v1/forum/posts` 的 payload，草稿保存结构应同步保存投票字段，见第 4 节。

### 2.5 验收标准

- 只选择分类后关闭，不弹保存草稿提示。
- 输入标题后关闭，会询问是否保存。
- 输入正文后关闭，会询问是否保存。
- 选择保存后，再次点击发帖，恢复标题、正文、类型、匿名、私密、图片 URL、投票选项。
- 选择不保存后，再次发帖是空表单。
- 发布成功后，再次发帖是空表单。
- 清空标题和正文后退出，不提示保存，并清除已有草稿。

## 3. 功能二：一级评论置顶

### 3.1 产品规则

- 只有帖子作者可以置顶评论。
- 只能置顶自己帖子下的一级评论。
- 二级回复不能置顶。
- 同一个帖子最多只能置顶一条评论。
- 点击置顶另一条评论后，新评论成为置顶，原置顶自动取消。
- 已删除评论不能置顶。
- 已违规评论不能置顶。当前代码中违规评论审核通过后会软删除，因此 `deleted_at IS NULL` 是主判断；同时建议额外排除 `forum_reports.status='approved'` 的评论，增强兼容性。
- 其他评论排序逻辑保持现状。

### 3.2 数据表改动

推荐在 `forum_posts` 上新增单字段，而不是在 `forum_comments` 上加 `is_pinned`：

```sql
ALTER TABLE forum_posts
  ADD COLUMN IF NOT EXISTS pinned_comment_id TEXT
  REFERENCES forum_comments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_forum_posts_pinned_comment
  ON forum_posts(pinned_comment_id)
  WHERE pinned_comment_id IS NOT NULL;
```

理由：

- “一个帖子只能置顶一个评论”天然适合由帖子持有 `pinned_comment_id`。
- 切换置顶只更新一行 `forum_posts`，不需要先清旧评论再设新评论。
- 后续获取帖子详情时已经会查 `forum_posts`，可以顺手拿到置顶评论 ID。

需要新增迁移：

- `backend/src/db/migrations/029_forum_pinned_comment_and_poll.ts`，或拆成 `029_forum_pinned_comment.ts` 与 `030_forum_poll.ts`。
- 在 `backend/src/db/migrate.ts` 中导入并执行。
- 在 `backend/src/db/schema.ts` 的 `forumPosts` 中加入：

```ts
pinnedCommentId: text('pinned_comment_id').references((): AnyPgColumn => forumComments.id, { onDelete: 'set null' }),
```

注意 `forumPosts` 定义早于 `forumComments` 时要使用 `AnyPgColumn` 延迟引用，避免循环引用类型问题。

### 3.3 后端接口

新增：

```http
PUT /api/v1/forum/posts/:postId/pinned-comment
```

请求体：

```json
{
  "commentId": "uuid"
}
```

响应：

```json
{
  "message": "评论已置顶",
  "pinnedCommentId": "uuid"
}
```

新增：

```http
DELETE /api/v1/forum/posts/:postId/pinned-comment
```

响应：

```json
{
  "message": "已取消置顶",
  "pinnedCommentId": null
}
```

虽然需求没有明确“取消置顶”，但建议提供接口，方便帖主撤销误操作，也便于测试和管理。

### 3.4 后端 service 规则

在 `backend/src/services/forumService.ts` 新增：

```ts
export async function pinComment(userId: string, postId: string, commentId: string)
export async function unpinComment(userId: string, postId: string)
```

`pinComment` 校验顺序：

1. 查 `forum_posts`：
   - 帖子存在。
   - `deleted_at IS NULL`。
   - `post.user_id === userId`，否则 `ForbiddenError('只有帖主可以置顶评论')`。
2. 查 `forum_comments`：
   - 评论存在。
   - `post_id === postId`。
   - `parent_comment_id IS NULL`。
   - `root_comment_id IS NULL`。
   - `deleted_at IS NULL`。
3. 查 `forum_reports`：
   - 不存在 `target_type='comment' AND comment_id=:commentId AND status='approved'`。
4. 更新 `forum_posts.pinned_comment_id = commentId`。

`unpinComment`：

- 只允许帖主操作。
- 更新 `forum_posts.pinned_comment_id = NULL`。

删除评论时同步清理：

- 修改 `deleteComment`：如果删除的 `commentId` 当前是某帖的 `pinned_comment_id`，置空。
- 修改 `reviewForumReport`：审核通过评论举报、软删除评论时，同步置空对应帖子的 `pinned_comment_id`。

### 3.5 帖子详情 DTO 改动

`PostDetail` 新增：

```ts
interface PostDetail {
  pinnedCommentId: string | null;
  canPinComments: boolean;
}
```

`CommentItem` 新增：

```ts
interface CommentItem {
  isPinned: boolean;
  canPinByMe: boolean;
}
```

返回规则：

- `post.canPinComments = post.authorUserId === viewerUserId`
- 一级评论：
  - `isPinned = commentId === post.pinnedCommentId`
  - `canPinByMe = post.canPinComments && !isDeleted && parentCommentId === null`
- 二级回复不返回 `canPinByMe` 或固定为 `false`。

### 3.6 一级评论排序改动

当前 `getPostDetail` 的一级评论 SQL 最后是混合排序表达式。需要改为：

```sql
ORDER BY
  CASE WHEN fc.id = ${post.pinnedCommentId} THEN 0 ELSE 1 END ASC,
  (
    EXTRACT(EPOCH FROM fc.created_at) -
    -- 保留现有高赞前移表达式
  ) ASC
```

注意：

- 不要把置顶评论从原列表中复制一份出来，避免重复展示。
- 除置顶评论外，其他评论排序表达式必须保持现状。
- 如果 `pinned_comment_id` 指向的评论已删除或违规，应在返回详情前自动忽略；更推荐在删除/审核通过时已经置空。

### 3.7 前端改动

修改 `frontend/src/api/forum.ts`：

- `PostDetail` 增加 `pinnedCommentId/canPinComments`。
- `CommentItem` 增加 `isPinned/canPinByMe`。
- 新增 API：

```ts
export function pinComment(postId: string, commentId: string) {
  return api.put<{ message: string; pinnedCommentId: string }>(
    `/forum/posts/${encodeURIComponent(postId)}/pinned-comment`,
    { commentId },
  );
}

export function unpinComment(postId: string) {
  return api.delete<{ message: string; pinnedCommentId: null }>(
    `/forum/posts/${encodeURIComponent(postId)}/pinned-comment`,
  );
}
```

修改 `frontend/src/pages/ForumPost.tsx`：

- 引入 `pinComment/unpinComment`。
- 新增 `handlePinComment(commentId)`：
  - 乐观更新：把该一级评论移动到列表最前，设为 `isPinned=true`，其他评论 `isPinned=false`。
  - 调用接口失败后回滚或重新 `fetchDetail()`。
- 如果点击已置顶评论，可调用 `unpinComment` 取消置顶；如果不做取消，则点击已置顶评论提示“该评论已置顶”。

修改 `frontend/src/components/forum/CommentItem.tsx`：

- 仅一级评论展示置顶交互，不给 `ReplyItemComponent` 加。
- 图标建议：
  - 未置顶：`push_pin`
  - 已置顶：`push_pin`
  - 已置顶状态使用 `text-[#420047]`，未置顶使用 `text-[#8B7355]/60 hover:text-[#420047]`
- 位置：操作行中放在举报按钮左侧，与举报按钮同一行、同尺寸。
- 已置顶评论显示小标签，例如昵称行后加：

```text
置顶
```

样式可复用当前帖子标签的浅紫色风格。

### 3.8 验收标准

- 非帖主看不到置顶按钮。
- 帖主能在每条未删除、未违规的一级评论上看到置顶按钮。
- 二级回复没有置顶按钮。
- 置顶 A 后，A 排在评论列表第一位。
- 再置顶 B 后，B 排第一，A 回到普通排序队列。
- 删除已置顶评论后，帖子不再有置顶评论。
- 举报审核通过已置顶评论后，帖子不再有置顶评论。
- 已删除评论、违规评论不能被置顶，后端也必须拒绝。

## 4. 功能三：帖内投票

### 4.1 产品规则

发帖时新增选项：发起投票。

勾选后：

- 可以添加投票选项。
- 每个选项不超过 15 字。
- 最多 4 个选项。
- 建议最少 2 个有效选项，否则不能发布投票帖。

帖子详情展示：

- 有投票功能的帖子，在文字内容之后、图片内容之前展示投票互动区。
- 选项从上到下排列，每个选项是一整行。
- 点击选项立即投票，不二次确认。
- 每个用户只能投一次。
- 投票后不能更改选项。
- 每个选项标签最右侧显示当前票数。

### 4.2 数据表改动

在 `forum_posts` 增加：

```sql
ALTER TABLE forum_posts
  ADD COLUMN IF NOT EXISTS has_poll BOOLEAN NOT NULL DEFAULT FALSE;
```

新增投票选项表：

```sql
CREATE TABLE IF NOT EXISTS forum_poll_options (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  vote_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forum_poll_options_post_order
  ON forum_poll_options(post_id, display_order);
```

新增投票记录表：

```sql
CREATE TABLE IF NOT EXISTS forum_poll_votes (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  option_id TEXT NOT NULL REFERENCES forum_poll_options(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_forum_poll_votes_option
  ON forum_poll_votes(option_id);

CREATE INDEX IF NOT EXISTS idx_forum_poll_votes_user_created
  ON forum_poll_votes(user_id, created_at DESC);
```

约束说明：

- `UNIQUE(post_id, user_id)` 保证每个用户每个帖子只能投一次。
- `forum_poll_votes.post_id` 冗余存储是为了直接建唯一约束，避免通过 `option_id -> post_id` 做复杂约束。
- 投票时必须校验 `option_id` 属于该 `post_id`。

`backend/src/db/schema.ts` 需要新增：

```ts
export const forumPollOptions = pgTable('forum_poll_options', { ... });
export const forumPollVotes = pgTable('forum_poll_votes', { ... });
```

并在 `forumPosts` 中加入：

```ts
hasPoll: boolean('has_poll').notNull().default(false),
```

### 4.3 发帖接口改动

扩展现有接口：

```http
POST /api/v1/forum/posts
```

请求体新增：

```json
{
  "title": "今晚吃什么",
  "content": "大家投一下",
  "type": "general",
  "pollOptions": ["食堂", "校外", "外卖"]
}
```

`pollOptions` 规则：

- 可选字段。
- 未传或空数组：普通帖子。
- 传入时：
  - trim 后每项不能为空。
  - 去除前后空格。
  - 每项长度 `1-15`。
  - 数量 `2-4`。
  - 不建议允许完全重复选项；如果重复，后端返回 `ValidationError('投票选项不能重复')`。

修改位置：

- `backend/src/routes/forum.ts`
  - `createPostSchema` 新增：

```ts
pollOptions: z.array(z.string().trim().min(1).max(15)).max(4).optional()
```

- `backend/src/services/forumService.ts`
  - `CreatePostInput` 新增 `pollOptions?: string[]`
  - `createPost` 插入 `forum_posts.has_poll`
  - 如果有投票选项，在同一个事务中插入 `forum_poll_options`

建议把 `createPost` 改为事务：

1. 插入帖子。
2. 插入图片。
3. 插入投票选项。
4. 返回 `postId`。

避免帖子创建成功但投票选项创建失败的半成品。

### 4.4 投票接口

新增：

```http
POST /api/v1/forum/posts/:postId/poll/vote
```

请求体：

```json
{
  "optionId": "uuid"
}
```

成功响应：

```json
{
  "message": "投票成功",
  "myVoteOptionId": "uuid",
  "totalVotes": 12,
  "options": [
    { "optionId": "uuid-a", "text": "食堂", "voteCount": 5, "displayOrder": 0 },
    { "optionId": "uuid-b", "text": "校外", "voteCount": 7, "displayOrder": 1 }
  ]
}
```

错误规则：

- 帖子不存在或已删除：`NotFoundError('帖子不存在')`
- 用户无权访问私密帖：沿用 `requirePostAccess`
- 帖子没有投票：`ValidationError('该帖子没有投票')`
- 选项不属于该帖子：`ValidationError('投票选项不存在')`
- 用户已经投过票：`ValidationError('你已经投过票，不能更改选项')`

service 实现建议：

```ts
export async function votePostPoll(userId: string, postId: string, optionId: string)
```

必须使用事务：

1. `requirePostAccess(postId, userId, tx)`。
2. 查询帖子 `has_poll`。
3. 查询 option 是否属于该 post。
4. 插入 `forum_poll_votes`。
5. 更新 `forum_poll_options.vote_count = vote_count + 1`。
6. 查询最新 options 和 totalVotes 返回。

并发注意：

- 依赖数据库唯一约束 `UNIQUE(post_id, user_id)` 防止重复投票。
- 捕获唯一约束冲突，转换为 `ValidationError('你已经投过票，不能更改选项')`。

### 4.5 帖子详情接口改动

`GET /api/v1/forum/posts/:postId` 返回 `post.poll`：

```ts
interface ForumPollOptionDTO {
  optionId: string;
  text: string;
  voteCount: number;
  displayOrder: number;
}

interface ForumPollDTO {
  totalVotes: number;
  myVoteOptionId: string | null;
  votedByMe: boolean;
  options: ForumPollOptionDTO[];
}

interface PostDetail {
  hasPoll: boolean;
  poll: ForumPollDTO | null;
}
```

查询逻辑：

- 如果 `post.has_poll=false`，返回 `poll:null`。
- 如果 `post.has_poll=true`：
  - 查询 `forum_poll_options`，按 `display_order ASC`。
  - 查询当前用户在 `forum_poll_votes` 的记录。
  - `totalVotes = SUM(option.vote_count)`。

帖子列表接口可选增强：

```ts
interface PostListItem {
  hasPoll: boolean;
}
```

用于列表卡片显示“投票”标签，但不是本需求的核心阻塞项。

### 4.6 前端改动

修改 `frontend/src/api/forum.ts`：

- `CreatePostPayload` 新增：

```ts
pollOptions?: string[];
```

- `PostDetail` 新增：

```ts
hasPoll: boolean;
poll: ForumPoll | null;
```

- 新增：

```ts
export function votePostPoll(postId: string, optionId: string) {
  return api.post<ForumPoll>(
    `/forum/posts/${encodeURIComponent(postId)}/poll/vote`,
    { optionId },
  );
}
```

修改 `frontend/src/components/forum/PostForm.tsx`：

- 新增状态：

```ts
const [pollEnabled, setPollEnabled] = useState(false);
const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
```

- UI 放在正文之后、图片上传之前或匿名/私密开关之前均可；推荐正文之后，便于用户理解投票属于帖子内容的一部分。
- 勾选“发起投票”后展示选项输入：
  - 默认 2 个选项。
  - 最多 4 个。
  - 每个 `maxLength={15}`。
  - 每项右侧显示 `x/15`。
  - 提供新增/删除选项按钮。
- 提交前校验：
  - 未开启投票：不传 `pollOptions`。
  - 开启投票：trim 后至少 2 项、最多 4 项、不能重复。
- 草稿功能必须保存 `pollEnabled/pollOptions`。

修改 `frontend/src/pages/ForumPost.tsx`：

- 在正文之后、图片之前插入 `PollBlock`。
- `PollBlock` 可作为新组件放在：

```text
frontend/src/components/forum/PollBlock.tsx
```

`PollBlock` 交互：

- 每个选项是一行横向按钮：
  - 左侧：选项文案
  - 右侧：票数
- 未投票：点击选项立即调用 `votePostPoll`。
- 投票中：禁用所有选项，避免连点。
- 已投票：
  - 禁用所有选项。
  - 用户选择的选项高亮。
  - 票数继续展示。
- 接口返回后更新 `post.poll`。
- 如果重复投票报错，toast 提示并 `fetchDetail()` 同步真实状态。

### 4.7 验收标准

- 发帖时可勾选“发起投票”。
- 投票选项少于 2 个不能发布投票帖。
- 单个选项超过 15 字不能发布。
- 超过 4 个选项不能添加。
- 发布成功后，帖子详情正文下方、图片上方显示投票区。
- 点击一个选项后立即投票，不弹确认。
- 投票后该用户不能再点击其他选项改票。
- 刷新页面后仍能看到自己的已投票状态。
- 票数在每个选项最右侧展示，并在投票后即时更新。
- 私密帖投票仍遵守帖子访问权限。

## 5. 汇总：需要修改的文件

后端：

- `backend/src/db/schema.ts`
  - `forumPosts.pinnedCommentId`
  - `forumPosts.hasPoll`
  - 新增 `forumPollOptions`
  - 新增 `forumPollVotes`
- `backend/src/db/migrations/029_forum_pinned_comment_and_poll.ts`
  - 新增置顶评论字段和投票表。
- `backend/src/db/migrate.ts`
  - 导入并执行新迁移。
- `backend/src/routes/forum.ts`
  - 扩展 `createPostSchema.pollOptions`
  - 新增置顶评论接口。
  - 新增投票接口。
- `backend/src/services/forumService.ts`
  - 扩展 `CreatePostInput`
  - `createPost` 支持投票事务。
  - `getPostDetail` 返回 `pinnedCommentId/canPinComments/comments.isPinned/canPinByMe/hasPoll/poll`
  - 新增 `pinComment/unpinComment/votePostPoll`
  - `deleteComment` 清理置顶评论。
- `backend/src/services/forumGovernanceService.ts`
  - 评论举报审核通过软删除时清理 `pinned_comment_id`。

前端：

- `frontend/src/api/forum.ts`
  - 扩展 DTO 和 payload。
  - 新增 `pinComment/unpinComment/votePostPoll`。
- `frontend/src/components/forum/PostForm.tsx`
  - 草稿箱。
  - 发起投票表单。
  - 提交 payload 扩展。
- `frontend/src/components/forum/CommentItem.tsx`
  - 一级评论置顶按钮和置顶标签。
- `frontend/src/pages/ForumPost.tsx`
  - 置顶交互处理。
  - 投票区插入在正文和图片之间。
- `frontend/src/components/forum/PollBlock.tsx`
  - 建议新增，承载投票展示和点击交互。

## 6. 接口清单

### 6.1 已有接口扩展

```http
POST /api/v1/forum/posts
```

新增请求字段：

```json
{
  "pollOptions": ["选项一", "选项二"]
}
```

```http
GET /api/v1/forum/posts/:postId
```

新增响应字段：

```json
{
  "post": {
    "pinnedCommentId": "comment-id-or-null",
    "canPinComments": true,
    "hasPoll": true,
    "poll": {
      "totalVotes": 3,
      "myVoteOptionId": "option-id-or-null",
      "votedByMe": true,
      "options": [
        {
          "optionId": "option-id",
          "text": "选项一",
          "voteCount": 2,
          "displayOrder": 0
        }
      ]
    }
  },
  "comments": [
    {
      "commentId": "comment-id",
      "isPinned": true,
      "canPinByMe": true
    }
  ]
}
```

### 6.2 新增接口

```http
PUT /api/v1/forum/posts/:postId/pinned-comment
Content-Type: application/json

{ "commentId": "comment-id" }
```

```http
DELETE /api/v1/forum/posts/:postId/pinned-comment
```

```http
POST /api/v1/forum/posts/:postId/poll/vote
Content-Type: application/json

{ "optionId": "option-id" }
```

## 7. 开发顺序建议

1. 后端迁移和 schema：先加字段、表和索引。
2. 后端发帖投票：让 `POST /forum/posts` 能写入投票选项。
3. 后端详情投票：让 `GET /forum/posts/:postId` 返回投票 DTO。
4. 后端投票接口：完成唯一投票和票数更新。
5. 后端评论置顶：完成 pin/unpin 接口和详情排序。
6. 前端 API 类型：先同步 DTO，保证 TS 编译提示准确。
7. 前端发帖弹窗：投票表单和草稿箱一起做，因为草稿需要保存投票字段。
8. 前端帖子详情：先展示投票，再接投票点击。
9. 前端评论组件：接置顶按钮和乐观更新。
10. 回归测试：发帖、图片、匿名、私密、评论、举报审核、删除评论、点赞都要走一遍，确认没有破坏既有主链路。

## 8. 风险点

- 草稿图片只能可靠保存已上传 URL，不能保存本地待上传文件。
- 评论置顶必须后端强校验帖主身份，不能只依赖前端隐藏按钮。
- 违规评论当前通过 `deleted_at` 表达，后续如果新增独立违规状态，需要同步纳入置顶禁用判断。
- 投票不能只靠前端禁用按钮，必须依赖数据库唯一约束防重复。
- 投票插入和票数递增必须在事务中完成，避免并发下票数不一致。
- `getPostDetail` 已经较长，新增查询时要注意不要引入 N+1 查询；投票选项和我的投票都可以按当前 `postId/userId` 一次查完。
