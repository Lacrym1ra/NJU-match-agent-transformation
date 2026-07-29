# Bug 修复日志

> **周期：** 2026-05-01 ~ 2026-06-06  
> **范围：** 论坛模块（论坛帖子、评论、举报、信用分）

---

## Bug #1：私密帖越权漏洞

### 问题现象

- 非作者用户通过 `GET /api/v1/forum/posts/:postId` 可直接访问 `visibility='private'` 的帖子内容
- 预期行为：返回 403 "该帖为私密内容"

### 根因分析

`getPostDetail` 函数在 `forumService.ts` 中仅检查了帖子是否存在和是否被软删除，未检查 `visibility` 字段的权限：

```
// 修复前 (pseudo)
if (!post || post.deletedAt) throw NotFoundError('帖子不存在');
// 缺少: if (post.visibility === 'private' && post.authorUserId !== userId) throw ForbiddenError
```

同时，`likePost`、`unlikePost`、`favoritePost`、`unfavoritePost`、`createComment` 等函数中均使用独立实现的权限检查，逻辑不一致且容易遗漏。

### 修复方案

1. 提取公共权限检查函数 `requirePostAccess(postId, userId)`，在函数内统一处理：
   - 帖子存在性检查（`NotFoundError`）
   - 软删除检查（`NotFoundError`）
   - 私密帖权限检查（`ForbiddenError`）
2. 在所有需要鉴别帖子权限的函数中（`likePost`、`unlikePost`、`favoritePost`、`unfavoritePost`、`createComment`、`transcribeComment`、`getCommentReplies`）统一调用 `requirePostAccess`
3. `getPostDetail` 的列表级私密帖过滤也已同步修复（仅 `authorScope === 'mine'` 时返回本人私密帖）

### 验证结果

- ✅ 非作者访问私密帖返回 403
- ✅ 作者访问自己的私密帖正常返回
- ✅ 管理员可通过管理端接口访问
- ✅ 私密帖不出现在任何用户的公开列表和热榜中
- ✅ 私密帖不可被点赞、收藏、评论
- ✅ 新编写的集成测试 5 个用例全部通过

---

## Bug #2：评论点赞通知类型约束错误


### 问题现象

- 用户点赞评论后，评论作者收到的通知标题显示"有人赞了你的帖子"而非"有人赞了你的评论"
- 消息中心的 `actionType` 和 `targetType` 映射错误

### 根因分析

`likeComment` 函数中 `notify()` 调用的 `type` 参数被错误地硬编码为 `'post_liked'`（疑似从 `likePost` 函数复制粘贴后未修改）：

```typescript
// 修复前（forumService.ts:1787）
await notify(
  comment.userId, userId,
  'post_liked',           // 应为 'comment_liked'
  '有人赞了你的帖子',      // 应为 '有人赞了你的评论'
  '你的帖子获得了一个赞',  // 应为 '你的评论获得了一个赞'
  { commentId, postId: comment.postId },
);
```

### 修复方案

将 `type` 改为 `'comment_liked'`，同步修正 `title` 和 `content` 文案，并确保 `mapNotificationType` 能正确解析 `'comment_liked'` 类型（确认后已支持）。

### 验证结果

- ✅ 评论被点赞后通知类型正确
- ✅ 消息中心正确区分帖子点赞和评论点赞
- ✅ `mapNotificationType` 对 `'comment_liked'` 返回 `{actionType: 'like', targetType: 'comment'}`

---

## Bug #3：论坛语音上传兼容问题


### 问题现象

- Windows 开发环境下语音评论上传和播放正常
- 部署到 Linux 服务器后，`voiceUrl` 中包含了 Windows 风格的反斜杠 `\` 路径分隔符
- 前端访问 `voiceUrl` 返回 404

### 根因分析

上传服务从环境变量 `UPLOAD_DIR` 读取上传目录路径，该值在配置时可能包含平台特定的路径分隔符。后续 `path.join()` 拼接路径时，混入了 `\` 字符。在 URL 生成阶段，这些反斜杠未被统一替换为 `/`，导致生成的 URL 在 Linux 服务器上无效。

### 修复方案

在配置初始化阶段统一标准化路径：
```typescript
const UPLOAD_DIR = path.normalize(process.env.UPLOAD_DIR || './uploads').replace(/\\/g, '/');
```
同时在 URL 生成处增加防御性替换作为兜底。

### 验证结果

- ✅ Windows 开发环境正常工作
- ✅ Linux 生产环境正常上传和播放
- ✅ 历史数据中已存储的错误路径通过数据库迁移脚本修正

---

## Bug #4：浏览热度不刷新


### 问题现象

- 用户多次访问同一帖子详情页后，浏览数（`viewCount`）不增加
- 热度分数（`hotScore`）也未因浏览而更新

### 根因分析

浏览计数使用了 `forum_post_views` 表的 `ON CONFLICT (post_id, user_id) DO NOTHING` 策略实现去重，但 `UPDATE forum_posts` 语句依赖 `RETURNING 1` 的结果来判断是否需要更新计数和热度。在并发场景下，`ON CONFLICT DO NOTHING` 不返回行时 `EXISTS (SELECT 1 FROM touched)` 为 false，导致计数不增加。

### 修复方案

重构浏览计数逻辑：使用 CTE 先尝试插入浏览记录，通过 `RETURNING` 结果驱动后续的计数和热度更新。确保单次请求无论去重与否都能正确评估是否需要刷新。

### 验证结果

- ✅ 同一用户首次浏览计数 +1
- ✅ 同一用户重复浏览计数不变（去重正确）
- ✅ 不同用户依次浏览各自 +1
- ✅ 热度分数随浏览实时更新

---

## Bug #5：migration 重复执行导致 500 错误


### 问题现象

- 后端启动时报 500 错误，日志显示 `relation "forum_reports" already exists`
- 信用分治理迁移被注册了两次，导致尝试创建已存在的表

### 根因分析

`021_forum_governance_credit.ts` 迁移文件在 `migrate.ts` 中被重复注册——一次在主迁移列表中，一次在治理模块的初始化代码中。加之 `merge` 操作后代码重复被保留。

### 修复方案

1. 删除 `migrate.ts` 中重复的迁移注册
2. 清理 `forumGovernanceService.ts` 中的自动建表逻辑（迁移应统一由 `migrate.ts` 管理）
3. 增加迁移幂等检查（`IF NOT EXISTS`）作为兜底

### 验证结果

- ✅ 后端启动迁移成功
- ✅ 重复启动不会报错
- ✅ 所有表结构正确创建

---

## Bug #6：前端类型检查失败


### 问题现象

- GitHub Actions 的 Frontend Type Check job 失败
- `Forum.tsx` 中导入了 `ForumPostType` 但使用的变量类型推断不正确
- 搜索框 placeholder 文案使用了旧的功能描述，与新功能不匹配

### 根因分析

1. 类型导入路径不统一：部分组件从 `'../api/forum'` 导入类型，部分使用了内联类型定义
2. API 返回类型新增字段后，前端未同步更新 interface 定义
3. 搜索框文案在功能迭代后未更新

### 修复方案

1. 统一所有论坛相关类型从 `'../api/forum'` 导入
2. 更新 `frontend/src/api/forum.ts` 中的 interface 定义与后端 DTO 对齐
3. 更新搜索框 placeholder 文案为"搜索帖子标题/内容"
4. 修复所有 `npx tsc --noEmit` 报告的类型错误

### 验证结果

- ✅ CI Frontend Type Check 通过
- ✅ CI Frontend Build 通过
- ✅ 搜索框显示正确文案

---
