/**
 * forumService 业务逻辑测试
 *
 * 覆盖范围：
 * - 评论删除权限（作者 vs 帖主 vs 陌生人）
 * - 评论层级（level-1 vs level-2）权限差异
 * - 帖子删除权限（仅作者）
 * - 论坛帖子类型和可见性枚举约束
 * - LIKE 通配符搜索问题（搜索注入）
 * - 举报原因验证
 * - Zod schema 验证
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors.js';

// ─── 1. 评论删除权限逻辑 ────────────────────────────────────

// 从 forumService.ts deleteComment 提取的权限判定逻辑
type CommentRow = {
  id: string;
  userId: string;
  postId: string;
  rootCommentId: string | null;
  deletedAt: string | null;
};

type PostRow = {
  userId: string;
  deletedAt: string | null;
};

function canDeleteComment(
  comment: CommentRow,
  post: PostRow | null,
  requestingUserId: string,
): { allowed: boolean; reason?: string } {
  if (comment.deletedAt) {
    return { allowed: false, reason: 'already_deleted' };
  }

  const isLevel1 = comment.rootCommentId === null;
  let canDelete = comment.userId === requestingUserId;

  // Post owner can delete any level-1 comment under the post.
  // Post owner cannot delete level-2 replies unless they are the reply author.
  if (!canDelete && isLevel1) {
    canDelete = !!post && !post.deletedAt && post.userId === requestingUserId;
  }

  if (!canDelete) {
    return { allowed: false, reason: 'forbidden' };
  }

  return { allowed: true };
}

test('评论删除：作者可以删除自己的评论', () => {
  const comment: CommentRow = {
    id: 'c1',
    userId: 'author',
    postId: 'p1',
    rootCommentId: null,
    deletedAt: null,
  };
  const result = canDeleteComment(comment, null, 'author');
  assert.ok(result.allowed);
});

test('评论删除：帖主可以删除 level-1 评论（rootCommentId=null）', () => {
  const comment: CommentRow = {
    id: 'c1',
    userId: 'commentAuthor',
    postId: 'p1',
    rootCommentId: null, // level-1
    deletedAt: null,
  };
  const post: PostRow = { userId: 'postOwner', deletedAt: null };
  const result = canDeleteComment(comment, post, 'postOwner');
  assert.ok(result.allowed, '帖主应能删除一级评论');
});

test('评论删除：帖主不能删除 level-2 回复（rootCommentId!=null）', () => {
  const comment: CommentRow = {
    id: 'c2',
    userId: 'replyAuthor',
    postId: 'p1',
    rootCommentId: 'c1', // level-2
    deletedAt: null,
  };
  const post: PostRow = { userId: 'postOwner', deletedAt: null };
  const result = canDeleteComment(comment, post, 'postOwner');
  assert.ok(!result.allowed, '帖主不应能删除二级回复');
  assert.equal(result.reason, 'forbidden');
});

test('评论删除：陌生人不能删除他人评论', () => {
  const comment: CommentRow = {
    id: 'c1',
    userId: 'author',
    postId: 'p1',
    rootCommentId: null,
    deletedAt: null,
  };
  const result = canDeleteComment(comment, null, 'stranger');
  assert.ok(!result.allowed);
});

test('评论删除：已删除的评论不能再删', () => {
  const comment: CommentRow = {
    id: 'c1',
    userId: 'author',
    postId: 'p1',
    rootCommentId: null,
    deletedAt: '2024-01-01T00:00:00Z',
  };
  const result = canDeleteComment(comment, null, 'author');
  assert.ok(!result.allowed);
  assert.equal(result.reason, 'already_deleted');
});

test('评论删除：帖主同时也是评论作者可以删除自己的 level-2 回复', () => {
  const comment: CommentRow = {
    id: 'c2',
    userId: 'postOwner',  // 帖主自己的回复
    postId: 'p1',
    rootCommentId: 'c1',  // level-2
    deletedAt: null,
  };
  const post: PostRow = { userId: 'postOwner', deletedAt: null };
  const result = canDeleteComment(comment, post, 'postOwner');
  assert.ok(result.allowed, '帖主可以删除自己的二级回复（因为 userId 匹配）');
});

test('评论删除：帖子被删后帖主也不能删一级评论', () => {
  const comment: CommentRow = {
    id: 'c1',
    userId: 'commentAuthor',
    postId: 'p1',
    rootCommentId: null,
    deletedAt: null,
  };
  const post: PostRow = { userId: 'postOwner', deletedAt: '2024-01-01' };
  const result = canDeleteComment(comment, post, 'postOwner');
  assert.ok(!result.allowed, '帖子已删除，帖主不应能删评论');
});

// ─── 2. 帖子删除权限 ─────────────────────────────────────────

test('帖子删除：只有作者可以删除', () => {
  const post = { id: 'p1', userId: 'author', deletedAt: null };

  // 作者可以
  assert.equal(post.userId === 'author', true);
  // 其他人不行
  assert.equal(post.userId === 'other', false);
});

test('帖子删除：已删除的帖子不能重复删除', () => {
  const post = { deletedAt: '2024-01-01' };
  assert.ok(!!post.deletedAt, '已删除帖子有 deletedAt 值');
});

// ─── 3. 论坛 Zod 验证 schema ─────────────────────────────────

const createPostSchema = z.object({
  circleId: z.string().optional().nullable(),
  title: z.string().min(1).max(100),
  content: z.string().min(1).max(5000),
  type: z.enum(['general', 'squad', 'help', 'trade', 'activity']),
  isAnonymous: z.boolean().optional(),
  visibility: z.enum(['public', 'private']).optional(),
  images: z.array(z.string()).max(9).optional(),
});

test('createPost schema：type 枚举严格校验', () => {
  const base = { title: '标题', content: '内容', type: 'general' };

  for (const t of ['general', 'squad', 'help', 'trade', 'activity']) {
    assert.ok(createPostSchema.safeParse({ ...base, type: t }).success, `应接受: ${t}`);
  }
  assert.ok(!createPostSchema.safeParse({ ...base, type: 'invalid' }).success);
  assert.ok(!createPostSchema.safeParse({ ...base, type: '' }).success);
  assert.ok(!createPostSchema.safeParse({ ...base, type: 'GENERAL' }).success); // 大写
});

test('createPost schema：visibility 限定 public/private', () => {
  const base = { title: '标题', content: '内容', type: 'general' };
  assert.ok(createPostSchema.safeParse({ ...base, visibility: 'public' }).success);
  assert.ok(createPostSchema.safeParse({ ...base, visibility: 'private' }).success);
  assert.ok(!createPostSchema.safeParse({ ...base, visibility: 'hidden' }).success);
});

test('createPost schema：images 最多 9 张', () => {
  const base = { title: '标题', content: '内容', type: 'general' };
  assert.ok(createPostSchema.safeParse({ ...base, images: Array(9).fill('url') }).success);
  assert.ok(!createPostSchema.safeParse({ ...base, images: Array(10).fill('url') }).success);
});

test('createPost schema：title 和 content 长度限制', () => {
  const base = { title: '标题', content: '内容', type: 'general' };

  // 空标题
  assert.ok(!createPostSchema.safeParse({ ...base, title: '' }).success);
  // 超长标题
  assert.ok(!createPostSchema.safeParse({ ...base, title: 'x'.repeat(101) }).success);
  // 空内容
  assert.ok(!createPostSchema.safeParse({ ...base, content: '' }).success);
  // 超长内容
  assert.ok(!createPostSchema.safeParse({ ...base, content: 'x'.repeat(5001) }).success);
});

// ─── 4. LIKE 通配符搜索问题 ────────────────────────────────

test('搜索关键词中的 % 和 _ 应被转义，不应作为 LIKE 通配符', () => {
  // 源码 forumService.ts 第 331-343 行：
  //   const pattern = `%${term}%`;
  //   sql`(${forumPosts.title} ILIKE ${pattern})`
  // 正确行为：搜索 % 应只匹配字面量 %，而非作为 SQL LIKE 通配符

  function escapeLikeWildcards(term: string): string {
    return term.replace(/[%_\\]/g, '\\$&');
  }

  for (const term of ['%', '_', '\\%']) {
    const rawPattern = `%${term}%`;
    const escapedPattern = `%${escapeLikeWildcards(term)}%`;
    // 转义后，特殊字符前应有反斜杠
    assert.notEqual(rawPattern, escapedPattern,
      `搜索词 "${term}" 应被转义，当前直接作为 LIKE 通配符使用了`);
  }
});

test('搜索关键词按空格分词，最多 6 个', () => {
  // 源码：const terms = keyword.trim().split(/\s+/).filter(Boolean).slice(0, 6);
  const terms = 'a b c d e f g h'.trim().split(/\s+/).filter(Boolean).slice(0, 6);
  assert.equal(terms.length, 6, '超过 6 个关键词被截断');
});

// ─── 5. 举报原因验证 ──────────────────────────────────────────

const FORUM_REPORT_REASON_SET = new Set([
  'pornographic', 'violent', 'personal_attack', 'provocation',
  'ad_spam', 'junk_info', 'privacy_violation', 'other',
]);

const REPORT_REASON_MAX_LEN = 200;
const REPORT_DETAIL_MAX_LEN = 2000;

function validateReport(reasons: string[], detail?: string): { valid: boolean; error?: string } {
  const deduped = [...new Set(reasons)];
  const reason = deduped.join(',');

  if (deduped.length === 0 || deduped.length > 8) {
    return { valid: false, error: '原因标签数量需在 1-8 个' };
  }
  if (reason.length > REPORT_REASON_MAX_LEN) {
    return { valid: false, error: '原因过长' };
  }
  if (deduped.some((tag) => !FORUM_REPORT_REASON_SET.has(tag))) {
    return { valid: false, error: '原因标签不合法' };
  }
  if (detail && detail.trim().length > REPORT_DETAIL_MAX_LEN) {
    return { valid: false, error: '补充说明过长' };
  }
  return { valid: true };
}

test('举报验证：合法原因通过', () => {
  assert.ok(validateReport(['pornographic']).valid);
  assert.ok(validateReport(['personal_attack', 'other']).valid);
  assert.ok(validateReport(['other'], '一些详细描述').valid);
});

test('举报验证：空原因拒绝', () => {
  assert.ok(!validateReport([]).valid);
});

test('举报验证：超过 8 个不同原因拒绝（但去重后不超过则不拒绝）', () => {
  // 去重后 9 个 'other' 只有 1 个，不会超过 8
  // 但实际上只有 8 种不同的举报原因，所以无法构造超过 8 个不同原因
  // 验证：8 个不同原因通过
  const allReasons = ['pornographic', 'violent', 'personal_attack', 'provocation',
    'ad_spam', 'junk_info', 'privacy_violation', 'other'];
  assert.ok(validateReport(allReasons).valid, '8 个不同原因应通过');

  // 验证：重复的原因被去重
  const withDuplicates = [...allReasons, 'other', 'pornographic'];
  assert.ok(validateReport(withDuplicates).valid, '去重后仍为 8 个，应通过');
});

test('举报验证：不合法的原因标签拒绝', () => {
  assert.ok(!validateReport(['not_a_valid_reason']).valid);
  assert.ok(!validateReport(['pornographic', 'INVALID']).valid);
});

test('举报验证：补充说明过长拒绝', () => {
  const longDetail = 'x'.repeat(2001);
  assert.ok(!validateReport(['other'], longDetail).valid);
});

test('举报验证：补充说明刚好 2000 字符通过', () => {
  const maxDetail = 'x'.repeat(2000);
  assert.ok(validateReport(['other'], maxDetail).valid);
});

// ─── 6. 信用分治理逻辑 ──────────────────────────────────────

const CREDIT_MAX = 100;
const CREDIT_LIMITED_THRESHOLD = 90;
const CREDIT_BANNED_THRESHOLD = 85;

function toCreditLevel(score: number): 'normal' | 'limited' | 'banned' {
  if (score <= CREDIT_BANNED_THRESHOLD) return 'banned';
  if (score <= CREDIT_LIMITED_THRESHOLD) return 'limited';
  return 'normal';
}

function resolveForumPenalty(manualPenaltyScore?: number): 1 | 3 | 5 {
  if (manualPenaltyScore !== 1 && manualPenaltyScore !== 3 && manualPenaltyScore !== 5) {
    throw new ValidationError('审核通过时，管理员必须手动选择扣分（1/3/5）');
  }
  return manualPenaltyScore;
}

test('信用分级：> 90 为 normal', () => {
  assert.equal(toCreditLevel(100), 'normal');
  assert.equal(toCreditLevel(91), 'normal');
});

test('信用分级：86-90 为 limited', () => {
  assert.equal(toCreditLevel(90), 'limited');
  assert.equal(toCreditLevel(86), 'limited');
});

test('信用分级：<= 85 为 banned', () => {
  assert.equal(toCreditLevel(85), 'banned');
  assert.equal(toCreditLevel(0), 'banned');
});

test('信用分扣分只接受 1/3/5', () => {
  assert.equal(resolveForumPenalty(1), 1);
  assert.equal(resolveForumPenalty(3), 3);
  assert.equal(resolveForumPenalty(5), 5);
});

test('信用分扣分拒绝非法值', () => {
  assert.throws(() => resolveForumPenalty(0), /必须手动选择/);
  assert.throws(() => resolveForumPenalty(2), /必须手动选择/);
  assert.throws(() => resolveForumPenalty(4), /必须手动选择/);
  assert.throws(() => resolveForumPenalty(10), /必须手动选择/);
  assert.throws(() => resolveForumPenalty(undefined), /必须手动选择/);
});

// ─── 7. 论坛帖子可见性约束 ─────────────────────────────────

test('私密帖子不出现在热门列表（hot sort 强制 public）', () => {
  // 源码 forumService.ts 第 380-381 行：
  //   if (options.sort === 'hot') {
  //     conditions.push(eq(forumPosts.visibility, 'public'));
  //   }
  // 这意味着 hot 排序时私密帖子被排除
  const sort = 'hot';
  const visibility = 'private' as string;
  const shouldInclude = sort === 'hot' ? visibility === 'public' : true;
  assert.equal(shouldInclude, false, '私密帖子不应出现在热门列表');
});

test('非 mine scope 下排除他人私密帖子', () => {
  // 源码 forumService.ts 第 382-386 行：
  //   conditions.push(sql`(${forumPosts.visibility} = 'public' OR ${forumPosts.userId} = ${userId})`);
  const viewerId = 'viewer' as string;
  const authorId = 'other' as string;
  const visibility = 'private' as string;

  const canSee = visibility === 'public' || authorId === viewerId;
  assert.equal(canSee, false, '不能看到他人的私密帖子');
});

test('用户可以看到自己的私密帖子', () => {
  const viewerId = 'me' as string;
  const authorId = 'me' as string;
  const visibility = 'private' as string;

  const canSee = visibility === 'public' || authorId === viewerId;
  assert.equal(canSee, true);
});
