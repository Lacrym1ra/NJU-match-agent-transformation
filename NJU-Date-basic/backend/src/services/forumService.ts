import { eq, and, isNull, desc, asc, count, inArray, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection.js';
import {
  forumPosts,
  forumComments,
  forumPostImages,
  forumPostLikes,
  forumPostFavorites,
  forumAnnouncements,
  forumGuestbookMessages,
  forumCommentLikes,
  forumReports,
  forumPollOptions,
  forumPollVotes,
  userNotifications,
  users,
  surveyAnswers,
} from '../db/schema.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors.js';

// ─── Types ────────────────────────────────────────────────────────

export type ForumPostType = 'general' | 'squad' | 'help' | 'trade' | 'activity';
export type ForumVisibility = 'public' | 'private';
export type ForumCommentType = 'text' | 'voice';
export type ForumSort = 'latest' | 'hot' | 'recommended';
export type AuthorScope = 'all' | 'mine' | 'liked' | 'favorited';
export type HotRankingRange = 'day' | 'week' | 'month';

// ─── Recommendation: Constants ────────────────────────────────────

/** MBTI 各维度 → 帖子类型偏好映射（每个维度独立计算后取平均） */
const MBTI_DIM_WEIGHTS: Record<string, Record<ForumPostType, number>> = {
  E: { general: 0.10, squad: 0.10, help: 0.00, trade: -0.05, activity: 0.15 },
  I: { general: 0.10, squad: -0.05, help: 0.15, trade: 0.00, activity: -0.10 },
  S: { general: -0.05, squad: 0.05, help: 0.10, trade: 0.10, activity: 0.05 },
  N: { general: 0.10, squad: 0.00, help: -0.05, trade: -0.05, activity: 0.05 },
  T: { general: 0.10, squad: -0.05, help: 0.15, trade: 0.05, activity: -0.05 },
  F: { general: 0.00, squad: 0.10, help: -0.05, trade: -0.05, activity: 0.10 },
  J: { general: -0.05, squad: 0.05, help: 0.10, trade: 0.05, activity: -0.05 },
  P: { general: 0.10, squad: 0.00, help: -0.05, trade: -0.05, activity: 0.10 },
};

/** 无 MBTI 数据时的默认类型偏好（8 维度平均） */
const DEFAULT_TYPE_AFFINITY: Record<ForumPostType, number> = {
  general: 0.05, squad: 0.025, help: 0.05, trade: 0.0, activity: 0.025,
};

/** 问卷兴趣标签 → 中文关键词映射 */
const INTEREST_KEYWORD_MAP: Record<string, string[]> = {
  movies_series:     ['影视', '电影', '剧集', '追剧', '观影'],
  gym_fitness:       ['运动', '健身', '跑步', '锻炼'],
  running_outdoor:   ['跑步', '户外', '徒步'],
  ball_sports:       ['打球', '比赛', '球类'],
  gaming:            ['游戏', '电竞', '开黑', '联机', '手游', '端游'],
  reading_writing:   ['读书', '阅读', '书', '文学', '写作'],
  music_listening:   ['音乐', '听歌', '演唱会', '乐队'],
  live_show:         ['演出', 'live', '音乐节'],
  food_exploring:    ['美食', '探店', '约饭', '餐厅', '小吃'],
  travel_citywalk:   ['旅行', '出游', '景点', '打卡', '徒步'],
  boardgame_larp:    ['桌游', '剧本杀', '狼人', '密室'],
  photo_exhibitions: ['摄影', '展览', '画展', '博物馆', '拍照'],
  anime_acg:         ['动漫', '二次元', '番', 'cos'],
};

// ─── Recommendation: Utility Functions ────────────────────────────

/** MBTI 权重动态衰减：total≥50 → 0 */
function mbtiWeight(totalInteractions: number): number {
  return Math.max(0, 1 - totalInteractions / 50);
}

/** 问卷兴趣权重动态衰减：total≥30 → 0.05 底线保留 */
function surveyWeight(totalInteractions: number): number {
  return Math.max(0.05, 1 - totalInteractions / 30);
}

/** 从 MBTI 字符串计算 5 种帖子类型的偏好向量（归一化） */
function mbtiTypeVector(mbti: string | null): Record<ForumPostType, number> {
  if (!mbti || mbti.length < 4) return { ...DEFAULT_TYPE_AFFINITY };
  const dims = mbti.slice(0, 4).toUpperCase().split('');
  const result: Record<ForumPostType, number> = {
    general: 0, squad: 0, help: 0, trade: 0, activity: 0,
  };
  let matched = 0;
  for (const dim of dims) {
    const w = MBTI_DIM_WEIGHTS[dim];
    if (!w) continue;
    matched++;
    for (const t of Object.keys(w) as ForumPostType[]) {
      result[t] += w[t];
    }
  }
  if (matched === 0) return { ...DEFAULT_TYPE_AFFINITY };
  for (const t of Object.keys(result) as ForumPostType[]) {
    result[t] /= matched;
  }
  // Softmax-like normalization: shift values to [0,1] range from raw offsets
  const vals = Object.values(result);
  const min = Math.min(...vals);
  const range = Math.max(...vals) - min || 1;
  for (const t of Object.keys(result) as ForumPostType[]) {
    result[t] = (result[t] - min) / range;
  }
  return result;
}

/** 拉普拉斯平滑：防止论坛互动类型分布过拟合（每个类型 +1 伪计数） */
function smoothTypeDistribution(
  counts: Partial<Record<ForumPostType, number>>,
  total: number,
): Record<ForumPostType, number> {
  const types: ForumPostType[] = ['general', 'squad', 'help', 'trade', 'activity'];
  const smoothedTotal = total + types.length; // +1 per type
  return Object.fromEntries(
    types.map((t) => [t, ((counts[t] ?? 0) + 1) / smoothedTotal]),
  ) as Record<ForumPostType, number>;
}

/** 从问卷兴趣标签提取用户的关键词集合，去重扁平化 */
function extractInterestKeywords(interestTags: string[] | null): string[] {
  if (!interestTags || !Array.isArray(interestTags)) return [];
  const kwSet = new Set<string>();
  for (const tag of interestTags) {
    const kws = INTEREST_KEYWORD_MAP[tag];
    if (kws) kws.forEach((kw) => kwSet.add(kw));
  }
  return Array.from(kwSet);
}

/** 构建 PostgreSQL FTS tsquery 字符串（用 ' | ' 连接关键词） */
function buildInterestTsquery(keywords: string[]): string | null {
  if (keywords.length === 0) return null;
  // Escape single quotes for SQL safety; tsquery uses ' | ' for OR
  return keywords.map((kw) => kw.replace(/'/g, "''")).join(' | ');
}

export interface CreatePostInput {
  circleId?: string | null;
  title: string;
  content: string;
  type: ForumPostType;
  isAnonymous?: boolean;
  visibility?: ForumVisibility;
  images?: string[];
  pollOptions?: string[];
}

export interface ListPostsOptions {
  circleId?: string;
  type?: ForumPostType;
  page: number;
  limit: number;
  sort?: ForumSort;
  authorScope?: AuthorScope;
  keyword?: string;
}

export interface CreateCommentInput {
  content?: string;
  parentCommentId?: string | null;
  commentType?: ForumCommentType;
  voiceUrl?: string;
  voiceDurationSec?: number;
  imageUrl?: string;
}

export interface AuthorDTO {
  userId?: string;
  nickname: string;
  avatarUrl: string | null;
  isOwn: boolean;
}

export interface ReplyItem {
  commentId: string;
  author: AuthorDTO;
  content: string | null;
  commentType: ForumCommentType;
  voiceUrl: string | null;
  voiceDurationSec: number | null;
  imageUrl: string | null;
  transcript: string | null;
  transcriptStatus: string;
  parentCommentId: string | null;
  replyToNickname: string | null;
  likeCount: number;
  likedByMe: boolean;
  isDeleted: boolean;
  isAnonymousOP: boolean;
  createdAt: string | null;
}

export interface CommentItemWithReplies {
  commentId: string;
  author: AuthorDTO;
  content: string | null;
  commentType: ForumCommentType;
  voiceUrl: string | null;
  voiceDurationSec: number | null;
  imageUrl: string | null;
  transcript: string | null;
  transcriptStatus: string;
  parentCommentId: string | null;
  createdAt: string | null;
  likeCount: number;
  likedByMe: boolean;
  isDeleted: boolean;
  isAnonymousOP: boolean;
  isPinned: boolean;
  canPinByMe: boolean;
  replyCount: number;
  previewReplies: ReplyItem[];
}

export interface ForumPollOptionDTO {
  optionId: string;
  text: string;
  voteCount: number;
  displayOrder: number;
}

export interface ForumPollDTO {
  totalVotes: number;
  myVoteOptionId: string | null;
  votedByMe: boolean;
  options: ForumPollOptionDTO[];
}

export interface ListMyForumOptions {
  page: number;
  limit: number;
}

// ─── Helpers ──────────────────────────────────────────────────────

/** Compute hot_score from interaction counts and creation time */
function hotScoreExpr() {
  // hot_score = (like*3 + favorite*4 + comment*5 + view*0.2) / (1 + hours_since_creation / 24)
  return sql`(
    (${forumPosts.likeCount} * 3 + ${forumPosts.favoriteCount} * 4 + ${forumPosts.commentCount} * 5 + ${forumPosts.viewCount} * 0.2)
    / (1 + EXTRACT(EPOCH FROM (NOW() - ${forumPosts.createdAt})) / 86400)
  )`;
}

/** Recalculate and persist hot_score for a given post */
async function refreshHotScore(postId: string) {
  await db
    .update(forumPosts)
    .set({ hotScore: hotScoreExpr() } as any)
    .where(eq(forumPosts.id, postId));
}

// ─── Summary & Cover Image utilities ─────────────────────────────

/** Strip HTML tags and Markdown syntax from content, returning plain text. */
function stripRichText(html: string): string {
  let text = html
    // Remove HTML tags
    .replace(/<\/?[^>]+(>|$)/g, '')
    // Remove Markdown images: ![alt](url)
    .replace(/!\[.*?\]\(.*?\)/g, '')
    // Remove Markdown links: [text](url)
    .replace(/\[([^\]]*)\]\(.*?\)/g, '$1')
    // Remove Markdown headings
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold/italic markers
    .replace(/(\*{1,3}|_{1,3})(.*?)\1/g, '$2')
    // Remove strikethrough
    .replace(/~~(.*?)~~/g, '$1')
    // Remove inline code
    .replace(/`([^`]*)`/g, '$1')
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    // Remove blockquotes
    .replace(/^>\s+/gm, '')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, '')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
  return text;
}

/** Create a plain-text summary from rich content, max ~100 characters. */
function makeSummary(content: string, maxLen = 100): string {
  const plain = stripRichText(content);
  if (plain.length <= maxLen) return plain;

  const truncated = plain.slice(0, maxLen);
  // Try to break at last complete sentence boundary
  const lastSentenceBreak = Math.max(
    truncated.lastIndexOf('。'),
    truncated.lastIndexOf('！'),
    truncated.lastIndexOf('？'),
    truncated.lastIndexOf('\n'),
    truncated.lastIndexOf('. '),
    truncated.lastIndexOf('! '),
    truncated.lastIndexOf('? '),
  );
  if (lastSentenceBreak > maxLen * 0.6) {
    return truncated.slice(0, lastSentenceBreak + 1);
  }
  // Fallback: break at word boundary (space)
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLen * 0.6) {
    return `${truncated.slice(0, lastSpace)}...`;
  }
  return `${truncated}...`;
}

/** Build an anonymous-masked author object — never leaks real userId/nickname/avatar */
function maskAuthor(): AuthorDTO {
  return {
    nickname: '匿名楼主',
    avatarUrl: null,
    isOwn: false,
  };
}

/** Build a real author DTO (no userId in output) */
function toAuthorDTO(
  author: { userId: string; nickname: string | null; avatarUrl?: string | null },
  viewerUserId: string,
): AuthorDTO {
  return {
    userId: author.userId,
    nickname: author.nickname ?? '未知用户',
    avatarUrl: author.avatarUrl ?? null,
    isOwn: author.userId === viewerUserId,
  };
}

/** Insert a notification, skipping self-notification */
async function notify(
  recipientId: string,
  actorId: string,
  type: string,
  title: string,
  content: string,
  meta?: Record<string, unknown>,
) {
  if (recipientId === actorId) return;
  await db.insert(userNotifications).values({
    id: uuidv4(),
    userId: recipientId,
    type,
    title,
    content,
    meta: meta ? { ...meta, actorId } : { actorId },
  });
}

function normalizePollOptions(pollOptions?: string[]): string[] {
  if (!pollOptions || pollOptions.length === 0) return [];
  const options = pollOptions.map((item) => item.trim()).filter(Boolean);
  if (options.length < 2 || options.length > 4) {
    throw new ValidationError('投票选项数量需为 2-4 个');
  }
  if (options.some((item) => item.length > 15)) {
    throw new ValidationError('投票选项不能超过 15 字');
  }
  if (new Set(options).size !== options.length) {
    throw new ValidationError('投票选项不能重复');
  }
  return options;
}

/** Validate post exists, is not deleted, and is visible to the requesting user.
 *  Returns the post row for downstream use (userId for notifications, etc.).
 *  Must be called before any interaction (like/favorite/comment) on a post.
 *  Accepts an optional tx for testing / transaction reuse. */
export async function requirePostAccess(
  postId: string,
  userId: string,
  tx: any = db,
): Promise<{ id: string; userId: string; visibility: string }> {
  const [post] = await tx
    .select({
      id: forumPosts.id,
      userId: forumPosts.userId,
      visibility: forumPosts.visibility,
      deletedAt: forumPosts.deletedAt,
    })
    .from(forumPosts)
    .where(eq(forumPosts.id, postId))
    .limit(1);

  if (!post || post.deletedAt) {
    throw new NotFoundError('帖子不存在');
  }
  if (post.visibility === 'private' && post.userId !== userId) {
    throw new ForbiddenError('该帖为私密内容');
  }
  return post;
}

// ─── Posts ────────────────────────────────────────────────────────

export async function getUserPublicProfile(targetUserId: string) {
  const [user] = await db
    .select({
      nickname: users.nickname,
      avatarUrl: users.avatarUrl,
      signature: users.signature,
      tags: users.tags,
    })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  if (!user) {
    throw new NotFoundError('用户不存在');
  }

  const [postStats] = await db
    .select({
      count: count(),
      likes: sql`COALESCE(SUM(${forumPosts.likeCount}), 0)`.mapWith(Number),
    })
    .from(forumPosts)
    .where(
      and(
        eq(forumPosts.userId, targetUserId),
        isNull(forumPosts.deletedAt),
        eq(forumPosts.isAnonymous, false),
        eq(forumPosts.visibility, 'public')
      )
    );

  return {
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    signature: user.signature,
    tags: user.tags,
    postCount: postStats.count,
    likeCount: postStats.likes,
  };
}

export async function listUserPublicPosts(viewerUserId: string, targetUserId: string, options: ListMyForumOptions) {
  const conditions = [
    eq(forumPosts.userId, targetUserId),
    isNull(forumPosts.deletedAt),
    eq(forumPosts.isAnonymous, false),
    eq(forumPosts.visibility, 'public'),
  ];

  const where = and(...conditions);
  const offset = (options.page - 1) * options.limit;

  const [totalRow] = await db
    .select({ count: count() })
    .from(forumPosts)
    .where(where);

  const rows = await db
    .select({
      id: forumPosts.id,
      circleId: forumPosts.circleId,
      title: forumPosts.title,
      type: forumPosts.type,
      isPinned: forumPosts.isPinned,
      isAnonymous: forumPosts.isAnonymous,
      visibility: forumPosts.visibility,
      likeCount: forumPosts.likeCount,
      favoriteCount: forumPosts.favoriteCount,
      commentCount: forumPosts.commentCount,
      viewCount: forumPosts.viewCount,
      hotScore: forumPosts.hotScore,
      hasImages: forumPosts.hasImages,
      summary: forumPosts.summary,
      coverImageUrl: forumPosts.coverImageUrl,
      hasPoll: forumPosts.hasPoll,
      createdAt: forumPosts.createdAt,
      authorUserId: forumPosts.userId,
      likedByMeUserId: forumPostLikes.userId,
      favoritedByMeUserId: forumPostFavorites.userId,
      author: {
        userId: users.id,
        nickname: users.nickname,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(forumPosts)
    .innerJoin(users, eq(forumPosts.userId, users.id))
    .leftJoin(
      forumPostLikes,
      and(eq(forumPostLikes.postId, forumPosts.id), eq(forumPostLikes.userId, viewerUserId)),
    )
    .leftJoin(
      forumPostFavorites,
      and(eq(forumPostFavorites.postId, forumPosts.id), eq(forumPostFavorites.userId, viewerUserId)),
    )
    .where(where)
    .orderBy(desc(forumPosts.createdAt))
    .limit(options.limit)
    .offset(offset);

  const posts = rows.map((r) => {
    return {
      postId: r.id,
      circleId: r.circleId,
      title: r.title,
      type: r.type,
      author: toAuthorDTO(r.author, viewerUserId),
      isAnonymous: false,
      visibility: r.visibility,
      likeCount: r.likeCount,
      favoriteCount: r.favoriteCount,
      commentCount: r.commentCount,
      viewCount: r.viewCount,
      hotScore: r.hotScore,
      hasImages: r.hasImages,
      summary: r.summary ?? null,
      coverImageUrl: r.coverImageUrl ?? null,
      hasPoll: r.hasPoll,
      likedByMe: !!r.likedByMeUserId,
      favoritedByMe: !!r.favoritedByMeUserId,
      isPinned: false,
      createdAt: r.createdAt,
    };
  });

  return { total: totalRow.count, page: options.page, limit: options.limit, posts };
}

export async function listPosts(userId: string, options: ListPostsOptions) {
  const isPrivateScope = options.authorScope === 'mine'
    || options.authorScope === 'liked'
    || options.authorScope === 'favorited';

  // Recommended sort: delegate to the dedicated recommendation engine
  if (options.sort === 'recommended' && !isPrivateScope) {
    return listRecommendedPosts(userId, options);
  }

  const conditions = [isNull(forumPosts.deletedAt)];

  // Visibility: only public posts (or own private posts) in lists
  // Private posts are excluded from public lists

  conditions.push(isNull(forumPosts.circleId));

  if (options.type) {
    conditions.push(eq(forumPosts.type, options.type));
  }

  // Keyword search: common fuzzy match in title/content (all terms must match)
  if (options.keyword?.trim()) {
    const terms = options.keyword
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 6);
    for (const term of terms) {
      const pattern = `%${term}%`;
      conditions.push(
        sql`(${forumPosts.title} ILIKE ${pattern} OR ${forumPosts.content} ILIKE ${pattern})`,
      );
    }
  }

  // authorScope filtering
  if (options.authorScope === 'mine') {
    conditions.push(eq(forumPosts.userId, userId));
  } else if (options.authorScope === 'liked') {
    const likedPostIds = await db
      .select({ postId: forumPostLikes.postId })
      .from(forumPostLikes)
      .where(eq(forumPostLikes.userId, userId));
    if (likedPostIds.length === 0) {
      return { total: 0, page: options.page, limit: options.limit, posts: [] };
    }
    conditions.push(
      inArray(
        forumPosts.id,
        likedPostIds.map((r) => r.postId),
      ),
    );
  } else if (options.authorScope === 'favorited') {
    const favPostIds = await db
      .select({ postId: forumPostFavorites.postId })
      .from(forumPostFavorites)
      .where(eq(forumPostFavorites.userId, userId));
    if (favPostIds.length === 0) {
      return { total: 0, page: options.page, limit: options.limit, posts: [] };
    }
    conditions.push(
      inArray(
        forumPosts.id,
        favPostIds.map((r) => r.postId),
      ),
    );
  }

  // Hot-sorted lists are globally unified: only public + undeleted posts.
  // This prevents any private post from appearing in hot-related views.
  if (options.sort === 'hot') {
    conditions.push(eq(forumPosts.visibility, 'public'));
  } else if (options.authorScope !== 'mine') {
    // For non-mine scopes, exclude private posts from other users
    conditions.push(
      sql`(${forumPosts.visibility} = 'public' OR ${forumPosts.userId} = ${userId})`,
    );
  }

  const where = and(...conditions);
  const offset = (options.page - 1) * options.limit;

  const [totalRow] = await db
    .select({ count: count() })
    .from(forumPosts)
    .where(where);

  // Public forum lists always surface admin-pinned posts first, then fall back
  // to the selected natural sort. Private scopes ignore pinning entirely.
  const orderBy = isPrivateScope
    ? options.sort === 'hot'
      ? [desc(forumPosts.hotScore), desc(forumPosts.createdAt)]
      : [desc(forumPosts.createdAt)]
    : options.sort === 'hot'
      ? [desc(forumPosts.isPinned), desc(forumPosts.hotScore), desc(forumPosts.createdAt)]
      : [desc(forumPosts.isPinned), desc(forumPosts.createdAt)];

  const rows = await db
    .select({
      id: forumPosts.id,
      circleId: forumPosts.circleId,
      title: forumPosts.title,
      type: forumPosts.type,
      isPinned: forumPosts.isPinned,
      isAnonymous: forumPosts.isAnonymous,
      visibility: forumPosts.visibility,
      likeCount: forumPosts.likeCount,
      favoriteCount: forumPosts.favoriteCount,
      commentCount: forumPosts.commentCount,
      viewCount: forumPosts.viewCount,
      hotScore: forumPosts.hotScore,
      hasImages: forumPosts.hasImages,
      summary: forumPosts.summary,
      coverImageUrl: forumPosts.coverImageUrl,
      hasPoll: forumPosts.hasPoll,
      createdAt: forumPosts.createdAt,
      authorUserId: forumPosts.userId,
      likedByMeUserId: forumPostLikes.userId,
      favoritedByMeUserId: forumPostFavorites.userId,
      author: {
        userId: users.id,
        nickname: users.nickname,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(forumPosts)
    .innerJoin(users, eq(forumPosts.userId, users.id))
    .leftJoin(
      forumPostLikes,
      and(eq(forumPostLikes.postId, forumPosts.id), eq(forumPostLikes.userId, userId)),
    )
    .leftJoin(
      forumPostFavorites,
      and(eq(forumPostFavorites.postId, forumPosts.id), eq(forumPostFavorites.userId, userId)),
    )
    .where(where)
    .orderBy(...orderBy)
    .limit(options.limit)
    .offset(offset);

  const posts = rows.map((r) => {
    const isOwn = r.authorUserId === userId;
    const shouldMask = r.isAnonymous && !isOwn;
    return {
      postId: r.id,
      circleId: r.circleId,
      title: r.title,
      type: r.type,
      author: shouldMask ? maskAuthor() : toAuthorDTO(r.author, userId),
      isAnonymous: shouldMask ? true : r.isAnonymous,
      visibility: r.visibility,
      likeCount: r.likeCount,
      favoriteCount: r.favoriteCount,
      commentCount: r.commentCount,
      viewCount: r.viewCount,
      hotScore: r.hotScore,
      hasImages: r.hasImages,
      summary: r.summary ?? null,
      coverImageUrl: r.coverImageUrl ?? null,
      hasPoll: r.hasPoll,
      likedByMe: !!r.likedByMeUserId,
      favoritedByMe: !!r.favoritedByMeUserId,
      isPinned: isPrivateScope ? false : r.isPinned,
      createdAt: r.createdAt,
    };
  });

  return { total: totalRow.count, page: options.page, limit: options.limit, posts };
}

export async function listMyPosts(userId: string, options: ListMyForumOptions) {
  const offset = (options.page - 1) * options.limit;

  const [totalRow] = await db
    .select({ count: count() })
    .from(forumPosts)
    .where(and(eq(forumPosts.userId, userId), isNull(forumPosts.deletedAt), isNull(forumPosts.circleId)));

  const rows = await db
    .select({
      id: forumPosts.id,
      circleId: forumPosts.circleId,
      title: forumPosts.title,
      type: forumPosts.type,
      isAnonymous: forumPosts.isAnonymous,
      visibility: forumPosts.visibility,
      likeCount: forumPosts.likeCount,
      favoriteCount: forumPosts.favoriteCount,
      commentCount: forumPosts.commentCount,
      viewCount: forumPosts.viewCount,
      hotScore: forumPosts.hotScore,
      hasImages: forumPosts.hasImages,
      hasPoll: forumPosts.hasPoll,
      isPinned: forumPosts.isPinned,
      createdAt: forumPosts.createdAt,
      likedByMeUserId: forumPostLikes.userId,
      favoritedByMeUserId: forumPostFavorites.userId,
      author: {
        userId: users.id,
        nickname: users.nickname,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(forumPosts)
    .innerJoin(users, eq(forumPosts.userId, users.id))
    .leftJoin(
      forumPostLikes,
      and(eq(forumPostLikes.postId, forumPosts.id), eq(forumPostLikes.userId, userId)),
    )
    .leftJoin(
      forumPostFavorites,
      and(eq(forumPostFavorites.postId, forumPosts.id), eq(forumPostFavorites.userId, userId)),
    )
    .where(and(eq(forumPosts.userId, userId), isNull(forumPosts.deletedAt), isNull(forumPosts.circleId)))
    .orderBy(desc(forumPosts.createdAt))
    .limit(options.limit)
    .offset(offset);

  return {
    total: totalRow.count,
    page: options.page,
    limit: options.limit,
    posts: rows.map((row) => ({
      postId: row.id,
      circleId: row.circleId,
      title: row.title,
      type: row.type,
      author: toAuthorDTO(row.author, userId),
      isAnonymous: row.isAnonymous,
      visibility: row.visibility,
      likeCount: row.likeCount,
      favoriteCount: row.favoriteCount,
      commentCount: row.commentCount,
      viewCount: row.viewCount,
      hotScore: row.hotScore,
      hasImages: row.hasImages,
      hasPoll: row.hasPoll,
      likedByMe: !!row.likedByMeUserId,
      favoritedByMe: !!row.favoritedByMeUserId,
      isPinned: false,
      createdAt: row.createdAt,
    })),
  };
}

export async function listLikedPosts(userId: string, options: ListMyForumOptions) {
  return listPosts(userId, { ...options, authorScope: 'liked' });
}

export async function listFavoritedPosts(userId: string, options: ListMyForumOptions) {
 return listPosts(userId, { ...options, authorScope: 'favorited' });
}

function mapNotificationType(type: string): {
  actionType: 'like' | 'favorite' | 'comment' | 'reply';
  targetType: 'post' | 'comment';
} {
  switch (type) {
    case 'post_liked':
      return { actionType: 'like', targetType: 'post' };
    case 'post_favorited':
      return { actionType: 'favorite', targetType: 'post' };
    case 'comment_liked':
      return { actionType: 'like', targetType: 'comment' };
    case 'comment_replied':
      return { actionType: 'reply', targetType: 'comment' };
    case 'post_replied':
    default:
      return { actionType: 'comment', targetType: 'post' };
  }
}

function toContentSnippet(value?: string | null, fallback: string = '相关内容') {
  const text = (value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) {
    return fallback;
  }
  return text.length > 48 ? `${text.slice(0, 48)}...` : text;
}

export async function listMessages(userId: string, options: ListMyForumOptions) {
  const offset = (options.page - 1) * options.limit;

  // Query userNotifications for the current user
  const [totalRow] = await db
    .select({ count: count() })
    .from(userNotifications)
    .where(eq(userNotifications.userId, userId));

  const notificationRows = await db
    .select({
      id: userNotifications.id,
      type: userNotifications.type,
      title: userNotifications.title,
      content: userNotifications.content,
      isRead: userNotifications.isRead,
      createdAt: userNotifications.createdAt,
      meta: userNotifications.meta,
    })
    .from(userNotifications)
    .where(eq(userNotifications.userId, userId))
    .orderBy(asc(userNotifications.isRead), desc(userNotifications.createdAt))
    .limit(options.limit)
    .offset(offset);

  // Extract all actorIds from meta
  const actorIds: string[] = Array.from(
    new Set(
      notificationRows
        .map((n) => (n.meta as any)?.actorId as string | undefined)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const postIds: string[] = Array.from(
    new Set(
      notificationRows
        .map((n) => (n.meta as any)?.postId as string | undefined)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const commentIds: string[] = Array.from(
    new Set(
      notificationRows
        .map((n) => (n.meta as any)?.commentId as string | undefined)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const postMap = new Map<string, { title: string }>();
  if (postIds.length > 0) {
    const posts = await db
      .select({
        id: forumPosts.id,
        title: forumPosts.title,
      })
      .from(forumPosts)
      .where(inArray(forumPosts.id, postIds));

    posts.forEach((post) => {
      postMap.set(post.id, { title: post.title });
    });
  }

  const commentMap = new Map<string, { content: string | null }>();
  if (commentIds.length > 0) {
    const comments = await db
      .select({
        id: forumComments.id,
        content: forumComments.content,
      })
      .from(forumComments)
      .where(inArray(forumComments.id, commentIds));

    comments.forEach((comment) => {
      commentMap.set(comment.id, { content: comment.content });
    });
  }

  // Batch fetch actor info
  const actorMap = new Map<string, { nickname: string; avatarUrl: string | null }>();
  if (actorIds.length > 0) {
    const actors = await db
      .select({
        id: users.id,
        nickname: users.nickname,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(inArray(users.id, actorIds));

    actors.forEach((a) => {
      actorMap.set(a.id, { nickname: a.nickname ?? '匿名用户', avatarUrl: a.avatarUrl ?? null });
    });
  }

  return {
    total: totalRow.count,
    page: options.page,
    limit: options.limit,
    messages: notificationRows.map((row) => {
      const meta = (row.meta ?? {}) as Record<string, any>;
      const actorId = meta.actorId as string;
      const postId = (meta.postId as string | undefined) ?? null;
      const commentId = (meta.commentId as string | undefined) ?? null;
      const postTitle = postId ? postMap.get(postId)?.title : null;
      const commentContent = commentId ? commentMap.get(commentId)?.content : null;
      const { actionType, targetType } = mapNotificationType(row.type);
      const contentSnippet = targetType === 'comment'
        ? toContentSnippet(commentContent, postTitle ? `帖子：${postTitle}` : '相关评论')
        : toContentSnippet(postTitle, '相关帖子');
      const actor = actorMap.get(actorId) || { nickname: '匿名用户', avatarUrl: null };

      return {
        messageId: row.id,
        type: row.type,
        senderNickname: actor.nickname,
        actionType,
        targetType,
        contentSnippet,
        isRead: row.isRead,
        postId,
        title: row.title,
        content: row.content,
        createdAt: row.createdAt,
        meta,
        actor: {
          userId: actorId,
          nickname: actor.nickname,
          avatarUrl: actor.avatarUrl,
        },
      };
    }),
  };
}

export async function dismissMessage(userId: string, messageId: string) {
  const [notification] = await db
    .select({ id: userNotifications.id })
    .from(userNotifications)
    .where(and(eq(userNotifications.id, messageId), eq(userNotifications.userId, userId)))
    .limit(1);

  if (!notification) {
    throw new NotFoundError('消息不存在或无权操作');
  }

  await db
    .delete(userNotifications)
    .where(and(eq(userNotifications.id, messageId), eq(userNotifications.userId, userId)));

  return { message: '消息已移除' };
}

export async function createPost(userId: string, input: CreatePostInput) {
  const [userRow] = await db
    .select({ creditScore: users.creditScore })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!userRow) throw new NotFoundError('用户不存在');
  if ((userRow.creditScore ?? 100) <= 85) {
    throw new ForbiddenError('当前信用分过低，已禁止发帖与评论');
  }

  // Standard qualification check for non-squad posts
  if (input.type !== 'squad') {
    const [u] = await db
      .select({ profileComplete: users.profileComplete })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!u || !u.profileComplete) {
      throw new ForbiddenError('需要完成个人资料后才能发布此类型帖子');
    }
  }

  const id = uuidv4();
  const imageUrls = input.images?.slice(0, 9) ?? []; // max 9 images
  const pollOptions = normalizePollOptions(input.pollOptions);
  const summary = makeSummary(input.content, 100);
  const coverImageUrl = imageUrls.length > 0 ? imageUrls[0] : null;

  await db.transaction(async (tx) => {
    await tx.insert(forumPosts).values({
      id,
      userId,
      circleId: null,
      title: input.title,
      content: input.content,
      type: input.type,
      isAnonymous: input.isAnonymous ?? false,
      visibility: input.visibility ?? 'public',
      hasImages: imageUrls.length > 0,
      hasPoll: pollOptions.length > 0,
      summary,
      coverImageUrl,
    });

    if (imageUrls.length > 0) {
      await tx.insert(forumPostImages).values(
        imageUrls.map((url, i) => ({
          id: uuidv4(),
          postId: id,
          imageUrl: url,
          displayOrder: i,
        })),
      );
    }

    if (pollOptions.length > 0) {
      await tx.insert(forumPollOptions).values(
        pollOptions.map((text, i) => ({
          id: uuidv4(),
          postId: id,
          optionText: text,
          displayOrder: i,
        })),
      );
    }
  });

  return { postId: id, message: '发布成功' };
}

export async function getPostDetail(userId: string, postId: string) {
  const [post] = await db
    .select({
      id: forumPosts.id,
      circleId: forumPosts.circleId,
      title: forumPosts.title,
      content: forumPosts.content,
      type: forumPosts.type,
      isAnonymous: forumPosts.isAnonymous,
      anonymousCancelledAt: forumPosts.anonymousCancelledAt,
      visibility: forumPosts.visibility,
      isPinned: forumPosts.isPinned,
      pinnedCommentId: forumPosts.pinnedCommentId,
      likeCount: forumPosts.likeCount,
      favoriteCount: forumPosts.favoriteCount,
      commentCount: forumPosts.commentCount,
      viewCount: forumPosts.viewCount,
      hotScore: forumPosts.hotScore,
      hasImages: forumPosts.hasImages,
      hasPoll: forumPosts.hasPoll,
      createdAt: forumPosts.createdAt,
      deletedAt: forumPosts.deletedAt,
      authorUserId: forumPosts.userId,
      author: {
        userId: users.id,
        nickname: users.nickname,
      },
    })
    .from(forumPosts)
    .innerJoin(users, eq(forumPosts.userId, users.id))
    .where(eq(forumPosts.id, postId))
    .limit(1);

  if (!post || post.deletedAt) {
    throw new NotFoundError('帖子不存在');
  }

  // Private posts: only author (and admin — checked at route level) can view
  if (post.visibility === 'private' && post.authorUserId !== userId) {
    throw new ForbiddenError('该帖为私密内容');
  }

  let currentViewStats = {
    viewCount: post.viewCount,
    hotScore: post.hotScore,
  };

  // Increment view count with permanent per-user dedup.
  // Same user viewing the same post multiple times only counts once.
  try {
    await db.execute(sql`
      WITH touched AS (
        INSERT INTO forum_post_views (id, post_id, user_id, viewed_at)
        VALUES (${uuidv4()}, ${postId}, ${userId}, NOW())
        ON CONFLICT (post_id, user_id)
        DO NOTHING
        RETURNING 1
      )
      UPDATE forum_posts
      SET
        view_count = COALESCE(view_count, 0) + 1,
        hot_score = (
          (like_count * 3 + favorite_count * 4 + comment_count * 5 + (COALESCE(view_count, 0) + 1) * 0.2)
          / (1 + EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400)
        )
      WHERE id = ${postId}
        AND EXISTS (SELECT 1 FROM touched)
    `);

    const [freshStats] = await db
      .select({
        viewCount: forumPosts.viewCount,
        hotScore: forumPosts.hotScore,
      })
      .from(forumPosts)
      .where(eq(forumPosts.id, postId))
      .limit(1);

    if (freshStats) {
      currentViewStats = freshStats;
    }
  } catch {
    // Keep post detail available even if view tracking fails.
  }

  // Fetch images
  const imageRows = await db
    .select({
      imageUrl: forumPostImages.imageUrl,
      imageWidth: forumPostImages.imageWidth,
      imageHeight: forumPostImages.imageHeight,
    })
    .from(forumPostImages)
    .where(eq(forumPostImages.postId, postId))
    .orderBy(forumPostImages.displayOrder);

  // Check if current user has liked / favorited this post
  const [likeRow] = await db
    .select({ id: forumPostLikes.id })
    .from(forumPostLikes)
    .where(and(eq(forumPostLikes.postId, postId), eq(forumPostLikes.userId, userId)))
    .limit(1);

  const [favRow] = await db
    .select({ id: forumPostFavorites.id })
    .from(forumPostFavorites)
    .where(and(eq(forumPostFavorites.postId, postId), eq(forumPostFavorites.userId, userId)))
    .limit(1);

  // Compute once for anonymous masking decisions
  const isOwn = post.authorUserId === userId;
  const canPinComments = isOwn;

  let poll: ForumPollDTO | null = null;
  if (post.hasPoll) {
    const optionRows = await db
      .select({
        optionId: forumPollOptions.id,
        text: forumPollOptions.optionText,
        voteCount: forumPollOptions.voteCount,
        displayOrder: forumPollOptions.displayOrder,
      })
      .from(forumPollOptions)
      .where(eq(forumPollOptions.postId, postId))
      .orderBy(asc(forumPollOptions.displayOrder));

    const [myVote] = await db
      .select({ optionId: forumPollVotes.optionId })
      .from(forumPollVotes)
      .where(and(eq(forumPollVotes.postId, postId), eq(forumPollVotes.userId, userId)))
      .limit(1);

    const options = optionRows.map((option) => ({
      optionId: option.optionId,
      text: option.text,
      voteCount: Number(option.voteCount) || 0,
      displayOrder: Number(option.displayOrder) || 0,
    }));

    poll = {
      totalVotes: options.reduce((sum, option) => sum + option.voteCount, 0),
      myVoteOptionId: myVote?.optionId ?? null,
      votedByMe: !!myVote,
      options,
    };
  }

  // Fetch level-1 comments with hybrid sort, like status, and hide filtering
  // Raw SQL needed for window function (avg likes) and complex joins
  type Level1Row = {
    commentId: string;
    authorUserId: string;
    authorNickname: string | null;
    content: string | null;
    commentType: string;
    voiceUrl: string | null;
    voiceDurationSec: number | null;
    imageUrl: string | null;
    transcript: string | null;
    transcriptStatus: string;
    parentCommentId: string | null;
    createdAt: string;
    likeCount: number;
    likedByMe: string | null; // non-null = liked
    deletedAt: string | null;
  };

  const level1Raw = await db.execute(sql`
    SELECT
      fc.id AS "commentId",
      u.id AS "authorUserId",
      u.nickname AS "authorNickname",
      fc.content,
      fc.comment_type AS "commentType",
      fc.voice_url AS "voiceUrl",
      fc.voice_duration_sec AS "voiceDurationSec",
      fc.image_url AS "imageUrl",
      fc.transcript,
      fc.transcript_status AS "transcriptStatus",
      fc.parent_comment_id AS "parentCommentId",
      fc.created_at AS "createdAt",
      fc.like_count AS "likeCount",
      fcl.user_id AS "likedByMe",
      fc.deleted_at AS "deletedAt"
    FROM forum_comments fc
    INNER JOIN users u ON fc.user_id = u.id
    LEFT JOIN forum_comment_likes fcl
      ON fc.id = fcl.comment_id AND fcl.user_id = ${userId}
    WHERE fc.post_id = ${postId}
      AND fc.parent_comment_id IS NULL
    ORDER BY
      CASE WHEN fc.id = ${post.pinnedCommentId} AND fc.deleted_at IS NULL THEN 0 ELSE 1 END ASC,
      (
      EXTRACT(EPOCH FROM fc.created_at) -
      CASE
        WHEN fc.like_count > (
          SELECT COALESCE(AVG(like_count), 0)
          FROM forum_comments
          WHERE post_id = ${postId}
            AND parent_comment_id IS NULL
            AND deleted_at IS NULL
        ) AND (
          SELECT COALESCE(AVG(like_count), 0)
          FROM forum_comments
          WHERE post_id = ${postId}
            AND parent_comment_id IS NULL
            AND deleted_at IS NULL
        ) > 0
        THEN LEAST(
          (fc.like_count - (
            SELECT COALESCE(AVG(like_count), 0)
            FROM forum_comments
            WHERE post_id = ${postId}
              AND parent_comment_id IS NULL
              AND deleted_at IS NULL
          ))::float / (
            SELECT COALESCE(AVG(like_count), 0)
            FROM forum_comments
            WHERE post_id = ${postId}
              AND parent_comment_id IS NULL
              AND deleted_at IS NULL
          ) * 1800,
          3600
        )
        ELSE 0
      END
    ) ASC
  `) as any;

  const level1CommentRows = level1Raw as Level1Row[];

  // Fetch reply counts and preview replies for all level-1 comments
  const level1Ids = level1CommentRows.map((c) => c.commentId);

  let replyCountMap = new Map<string, number>();
  let previewRepliesMap = new Map<string, ReplyItem[]>();

  if (level1Ids.length > 0) {
    const replyCountRows = await db
      .select({
        rootCommentId: forumComments.rootCommentId,
        count: count(),
      })
      .from(forumComments)
      .where(
        and(
          inArray(forumComments.rootCommentId, level1Ids),
        ),
      )
      .groupBy(forumComments.rootCommentId);

    replyCountMap = new Map(
      replyCountRows.map((r) => [r.rootCommentId!, Number(r.count)]),
    );

    for (const id of level1Ids) {
      const previewRows = await db
        .select({
          commentId: forumComments.id,
          author: {
            userId: sql`reply_user.id`,
            nickname: sql`reply_user.nickname`,
          },
          content: forumComments.content,
          commentType: forumComments.commentType,
          voiceUrl: forumComments.voiceUrl,
          voiceDurationSec: forumComments.voiceDurationSec,
          imageUrl: forumComments.imageUrl,
          transcript: forumComments.transcript,
          transcriptStatus: forumComments.transcriptStatus,
          parentCommentId: forumComments.parentCommentId,
          replyToNickname: sql`parent_user.nickname`,
          likeCount: forumComments.likeCount,
          likedByMe: sql`reply_likes.user_id`,
          deletedAt: forumComments.deletedAt,
          createdAt: forumComments.createdAt,
        } as any)
        .from(forumComments)
        .innerJoin(sql`users reply_user`, eq(forumComments.userId, sql`reply_user.id`))
        .leftJoin(
          sql`forum_comments parent_c`,
          eq(forumComments.parentCommentId, sql`parent_c.id`),
        )
        .leftJoin(
          sql`users parent_user`,
          eq(sql`parent_c.user_id`, sql`parent_user.id`),
        )
        .leftJoin(
          sql`forum_comment_likes reply_likes`,
          and(
            eq(forumComments.id, sql`reply_likes.comment_id`),
            eq(sql`reply_likes.user_id`, userId),
          ),
        )
        .where(
          and(eq(forumComments.rootCommentId, id)),
        )
        .orderBy(forumComments.createdAt)
        .limit(2);

      previewRepliesMap.set(
        id,
        previewRows.map((r: any) => {
          const replyAuthorId = r.author.userId;
          const replyIsOP = replyAuthorId === post.authorUserId;
          const replyShouldMask = post.isAnonymous && replyIsOP && !isOwn;
          return {
            commentId: r.commentId,
            author: replyShouldMask
              ? maskAuthor()
              : toAuthorDTO({ userId: replyAuthorId, nickname: r.author.nickname }, userId),
            content: r.content,
            commentType: r.commentType,
            voiceUrl: r.voiceUrl,
            voiceDurationSec: r.voiceDurationSec,
            imageUrl: r.imageUrl,
            transcript: r.transcript,
            transcriptStatus: r.transcriptStatus,
            parentCommentId: r.parentCommentId,
            replyToNickname: replyShouldMask ? '匿名楼主' : r.replyToNickname,
            likeCount: Number(r.likeCount) || 0,
            likedByMe: !!r.likedByMe,
            isDeleted: !!r.deletedAt,
            isAnonymousOP: replyIsOP && post.isAnonymous,
            createdAt: r.createdAt,
          };
        }),
      );
    }
  }

  const comments: CommentItemWithReplies[] = level1CommentRows.map((c) => {
    const commentIsOP = c.authorUserId === post.authorUserId;
    const commentShouldMask = post.isAnonymous && commentIsOP && !isOwn;
    return {
      commentId: c.commentId,
      author: commentShouldMask
        ? maskAuthor()
        : toAuthorDTO({ userId: c.authorUserId, nickname: c.authorNickname }, userId),
      content: c.content,
      commentType: c.commentType as ForumCommentType,
      voiceUrl: c.voiceUrl,
      voiceDurationSec: c.voiceDurationSec,
      imageUrl: c.imageUrl,
      transcript: c.transcript,
      transcriptStatus: c.transcriptStatus,
      parentCommentId: c.parentCommentId,
      createdAt: c.createdAt,
      likeCount: Number(c.likeCount) || 0,
      likedByMe: !!c.likedByMe,
      isDeleted: !!c.deletedAt,
      isAnonymousOP: commentIsOP && post.isAnonymous,
      isPinned: c.commentId === post.pinnedCommentId && !c.deletedAt,
      canPinByMe: canPinComments && !c.deletedAt,
      replyCount: replyCountMap.get(c.commentId) ?? 0,
      previewReplies: previewRepliesMap.get(c.commentId) ?? [],
    };
  });

  return {
    post: {
      postId: post.id,
      circleId: post.circleId,
      title: post.title,
      content: post.content,
      type: post.type,
      author:
        post.isAnonymous && !isOwn
          ? maskAuthor()
          : toAuthorDTO(post.author, userId),
      isAnonymous:
        post.isAnonymous && !isOwn ? true : post.isAnonymous,
      visibility: post.visibility,
      viewCount: currentViewStats.viewCount,
      likeCount: post.likeCount,
      favoriteCount: post.favoriteCount,
      commentCount: post.commentCount,
      hotScore: currentViewStats.hotScore,
      hasImages: post.hasImages,
      hasPoll: post.hasPoll,
      poll,
      isPinned: post.isPinned,
      pinnedCommentId: post.pinnedCommentId,
      canPinComments,
      likedByMe: !!likeRow,
      favoritedByMe: !!favRow,
      images: imageRows,
      createdAt: post.createdAt,
    },
    comments,
  };
}

// ─── Anonymous & Privacy ──────────────────────────────────────────

export async function cancelAnonymous(userId: string, postId: string) {
  const [post] = await db
    .select({
      id: forumPosts.id,
      userId: forumPosts.userId,
      isAnonymous: forumPosts.isAnonymous,
      anonymousCancelledAt: forumPosts.anonymousCancelledAt,
      deletedAt: forumPosts.deletedAt,
    })
    .from(forumPosts)
    .where(eq(forumPosts.id, postId))
    .limit(1);

  if (!post || post.deletedAt) {
    throw new NotFoundError('帖子不存在');
  }
  if (post.userId !== userId) {
    throw new ForbiddenError('只能取消自己的匿名');
  }
  if (!post.isAnonymous) {
    throw new ValidationError('该帖不是匿名帖');
  }
  if (post.anonymousCancelledAt) {
    throw new ValidationError('匿名已取消，不可撤销');
  }

  await db
    .update(forumPosts)
    .set({ anonymousCancelledAt: sql`NOW()` } as any)
    .where(eq(forumPosts.id, postId));

  return { message: '已取消匿名，作者信息将对所有人可见' };
}

export async function updatePostPrivacy(
  userId: string,
  postId: string,
  visibility: ForumVisibility,
) {
  const [post] = await db
    .select({
      id: forumPosts.id,
      userId: forumPosts.userId,
      deletedAt: forumPosts.deletedAt,
    })
    .from(forumPosts)
    .where(eq(forumPosts.id, postId))
    .limit(1);

  if (!post || post.deletedAt) {
    throw new NotFoundError('帖子不存在');
  }
  if (post.userId !== userId) {
    throw new ForbiddenError('只能修改自己的帖子可见性');
  }

  await db
    .update(forumPosts)
    .set({ visibility })
    .where(eq(forumPosts.id, postId));

  return { message: '可见性已更新', visibility };
}

// ─── Dynamic Anonymous Toggle ────────────────────────────────────

export async function togglePostAnonymity(
  userId: string,
  postId: string,
  isAnonymous: boolean,
) {
  const [post] = await db
    .select({
      id: forumPosts.id,
      userId: forumPosts.userId,
      isAnonymous: forumPosts.isAnonymous,
      deletedAt: forumPosts.deletedAt,
    })
    .from(forumPosts)
    .where(eq(forumPosts.id, postId))
    .limit(1);

  if (!post || post.deletedAt) {
    throw new NotFoundError('帖子不存在');
  }
  if (post.userId !== userId) {
    throw new ForbiddenError('只有帖子作者可以切换匿名状态');
  }

  if (post.isAnonymous === isAnonymous) {
    return { isAnonymous, message: '状态未变化' };
  }

  await db
    .update(forumPosts)
    .set({ isAnonymous })
    .where(eq(forumPosts.id, postId));

  return {
    isAnonymous,
    message: isAnonymous ? '已开启匿名' : '已关闭匿名，身份已公开',
  };
}

// ─── Pinned Comment ─────────────────────────────────────────────

export async function pinComment(userId: string, postId: string, commentId: string) {
  const [post] = await db
    .select({
      id: forumPosts.id,
      userId: forumPosts.userId,
      deletedAt: forumPosts.deletedAt,
    })
    .from(forumPosts)
    .where(eq(forumPosts.id, postId))
    .limit(1);

  if (!post || post.deletedAt) {
    throw new NotFoundError('帖子不存在');
  }
  if (post.userId !== userId) {
    throw new ForbiddenError('只有帖主可以置顶评论');
  }

  const [comment] = await db
    .select({
      id: forumComments.id,
      postId: forumComments.postId,
      parentCommentId: forumComments.parentCommentId,
      rootCommentId: forumComments.rootCommentId,
      deletedAt: forumComments.deletedAt,
    })
    .from(forumComments)
    .where(eq(forumComments.id, commentId))
    .limit(1);

  if (!comment || comment.deletedAt) {
    throw new NotFoundError('评论不存在');
  }
  if (comment.postId !== postId) {
    throw new ValidationError('评论不属于该帖子');
  }
  if (comment.parentCommentId || comment.rootCommentId) {
    throw new ValidationError('只能置顶一级评论');
  }

  const [approvedReport] = await db
    .select({ id: forumReports.id })
    .from(forumReports)
    .where(
      and(
        eq(forumReports.targetType, 'comment'),
        eq(forumReports.commentId, commentId),
        eq(forumReports.status, 'approved'),
      ),
    )
    .limit(1);

  if (approvedReport) {
    throw new ValidationError('违规评论不能置顶');
  }

  await db
    .update(forumPosts)
    .set({ pinnedCommentId: commentId })
    .where(eq(forumPosts.id, postId));

  return { message: '评论已置顶', pinnedCommentId: commentId };
}

export async function unpinComment(userId: string, postId: string) {
  const [post] = await db
    .select({
      id: forumPosts.id,
      userId: forumPosts.userId,
      deletedAt: forumPosts.deletedAt,
    })
    .from(forumPosts)
    .where(eq(forumPosts.id, postId))
    .limit(1);

  if (!post || post.deletedAt) {
    throw new NotFoundError('帖子不存在');
  }
  if (post.userId !== userId) {
    throw new ForbiddenError('只有帖主可以取消置顶评论');
  }

  await db
    .update(forumPosts)
    .set({ pinnedCommentId: null })
    .where(eq(forumPosts.id, postId));

  return { message: '已取消置顶', pinnedCommentId: null };
}

// ─── Polls ───────────────────────────────────────────────────────

export async function votePostPoll(userId: string, postId: string, optionId: string) {
  return db.transaction(async (tx) => {
    await requirePostAccess(postId, userId, tx);

    const [post] = await tx
      .select({ id: forumPosts.id, hasPoll: forumPosts.hasPoll })
      .from(forumPosts)
      .where(eq(forumPosts.id, postId))
      .limit(1);

    if (!post) {
      throw new NotFoundError('帖子不存在');
    }
    if (!post.hasPoll) {
      throw new ValidationError('该帖子没有投票');
    }

    const [option] = await tx
      .select({ id: forumPollOptions.id })
      .from(forumPollOptions)
      .where(and(eq(forumPollOptions.id, optionId), eq(forumPollOptions.postId, postId)))
      .limit(1);

    if (!option) {
      throw new ValidationError('投票选项不存在');
    }

    try {
      await tx.insert(forumPollVotes).values({
        id: uuidv4(),
        postId,
        optionId,
        userId,
      });
    } catch (err: any) {
      const pgErrorCode = err?.code ?? err?.cause?.code;
      if (pgErrorCode === '23505') {
        throw new ValidationError('你已经投过票，不能更改选项');
      }
      throw err;
    }

    await tx
      .update(forumPollOptions)
      .set({ voteCount: sql`${forumPollOptions.voteCount} + 1` } as any)
      .where(eq(forumPollOptions.id, optionId));

    const options = await tx
      .select({
        optionId: forumPollOptions.id,
        text: forumPollOptions.optionText,
        voteCount: forumPollOptions.voteCount,
        displayOrder: forumPollOptions.displayOrder,
      })
      .from(forumPollOptions)
      .where(eq(forumPollOptions.postId, postId))
      .orderBy(asc(forumPollOptions.displayOrder));

    const mappedOptions = options.map((item) => ({
      optionId: item.optionId,
      text: item.text,
      voteCount: Number(item.voteCount) || 0,
      displayOrder: Number(item.displayOrder) || 0,
    }));

    return {
      message: '投票成功',
      myVoteOptionId: optionId,
      votedByMe: true,
      totalVotes: mappedOptions.reduce((sum, item) => sum + item.voteCount, 0),
      options: mappedOptions,
    };
  });
}

// ─── Likes ────────────────────────────────────────────────────────

export async function likePost(userId: string, postId: string) {
  const post = await requirePostAccess(postId, userId);

  // Idempotent: check existing
  const [existing] = await db
    .select({ id: forumPostLikes.id })
    .from(forumPostLikes)
    .where(and(eq(forumPostLikes.postId, postId), eq(forumPostLikes.userId, userId)))
    .limit(1);

  if (existing) {
    return { message: '已点赞', liked: true };
  }

  await db.insert(forumPostLikes).values({
    id: uuidv4(),
    postId,
    userId,
  });

  await db
    .update(forumPosts)
    .set({
      likeCount: sql`${forumPosts.likeCount} + 1`,
      hotScore: hotScoreExpr(),
      lastInteractionAt: sql`NOW()`,
    } as any)
    .where(eq(forumPosts.id, postId));

  // Notify post author
  await notify(post.userId, userId, 'post_liked', '有人赞了你的帖子', '你的帖子获得了一个赞', {
    postId,
  });

  return { message: '点赞成功', liked: true };
}

export async function unlikePost(userId: string, postId: string) {
  // Verify post access before allowing unlike
  await requirePostAccess(postId, userId);

  const [existing] = await db
    .select({ id: forumPostLikes.id })
    .from(forumPostLikes)
    .where(and(eq(forumPostLikes.postId, postId), eq(forumPostLikes.userId, userId)))
    .limit(1);

  if (!existing) {
    return { message: '未点赞', liked: false };
  }

  await db
    .delete(forumPostLikes)
    .where(and(eq(forumPostLikes.postId, postId), eq(forumPostLikes.userId, userId)));

  await db
    .update(forumPosts)
    .set({
      likeCount: sql`GREATEST(${forumPosts.likeCount} - 1, 0)`,
      hotScore: hotScoreExpr(),
    } as any)
    .where(eq(forumPosts.id, postId));

  return { message: '已取消点赞', liked: false };
}

// ─── Favorites ────────────────────────────────────────────────────

export async function favoritePost(userId: string, postId: string) {
  const post = await requirePostAccess(postId, userId);

  const [existing] = await db
    .select({ id: forumPostFavorites.id })
    .from(forumPostFavorites)
    .where(and(eq(forumPostFavorites.postId, postId), eq(forumPostFavorites.userId, userId)))
    .limit(1);

  if (existing) {
    return { message: '已收藏', favorited: true };
  }

  await db.insert(forumPostFavorites).values({
    id: uuidv4(),
    postId,
    userId,
  });

  await db
    .update(forumPosts)
    .set({
      favoriteCount: sql`${forumPosts.favoriteCount} + 1`,
      hotScore: hotScoreExpr(),
      lastInteractionAt: sql`NOW()`,
    } as any)
    .where(eq(forumPosts.id, postId));

  await notify(post.userId, userId, 'post_favorited', '有人收藏了你的帖子', '你的帖子被收藏了', {
    postId,
  });

  return { message: '收藏成功', favorited: true };
}

export async function unfavoritePost(userId: string, postId: string) {
  // Verify post access before allowing unfavorite
  await requirePostAccess(postId, userId);

  const [existing] = await db
    .select({ id: forumPostFavorites.id })
    .from(forumPostFavorites)
    .where(and(eq(forumPostFavorites.postId, postId), eq(forumPostFavorites.userId, userId)))
    .limit(1);

  if (!existing) {
    return { message: '未收藏', favorited: false };
  }

  await db
    .delete(forumPostFavorites)
    .where(and(eq(forumPostFavorites.postId, postId), eq(forumPostFavorites.userId, userId)));

  await db
    .update(forumPosts)
    .set({
      favoriteCount: sql`GREATEST(${forumPosts.favoriteCount} - 1, 0)`,
      hotScore: hotScoreExpr(),
    } as any)
    .where(eq(forumPosts.id, postId));

  return { message: '已取消收藏', favorited: false };
}

// ─── Recommendation ───────────────────────────────────────────────

async function listRecommendedPosts(
  userId: string,
  options: ListPostsOptions,
): Promise<{ total: number; page: number; limit: number; posts: any[] }> {
  const { page, limit } = options;
  const offset = (page - 1) * limit;

  // ── Gather user profile signals ──────────────────────────────

  const [userRow] = await db
    .select({ mbti: users.mbti })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const [surveyRow] = await db
    .select({ answers: surveyAnswers.answers })
    .from(surveyAnswers)
    .where(eq(surveyAnswers.userId, userId))
    .limit(1);

  const mbti = userRow?.mbti ?? null;
  let interestTags: string[] = [];
  if (surveyRow?.answers) {
    try {
      const parsed = JSON.parse(surveyRow.answers);
      const q8 = parsed.q8?.value;
      const top = parsed.q_top_interest?.value;
      if (Array.isArray(q8)) interestTags.push(...q8);
      if (typeof top === 'string') interestTags.push(top);
      interestTags = [...new Set(interestTags)];
    } catch { /* ignore parse errors */ }
  }

  // ── Pre-compute weights and vectors in TypeScript ────────────

  // We need total interactions to compute decay weights. Query it.
  const [interRow] = await db.execute(sql`
    SELECT COALESCE(SUM(cnt), 0)::int AS total FROM (
      SELECT COUNT(*)::int AS cnt FROM forum_post_likes WHERE user_id = ${userId}
      UNION ALL
      SELECT COUNT(*)::int FROM forum_post_favorites WHERE user_id = ${userId}
    ) sub
  `) as any;
  const totalInter = interRow?.total ?? 0;

  const mbtiW = mbtiWeight(totalInter);
  const survW = surveyWeight(totalInter);
  const mbtiVec = mbtiTypeVector(mbti);

  // Build MBTI affinity CASE expression for SQL
  const mbtiAffinityExpr = sql`CASE s.type
    WHEN 'general'  THEN ${mbtiVec.general}::float
    WHEN 'squad'    THEN ${mbtiVec.squad}::float
    WHEN 'help'     THEN ${mbtiVec.help}::float
    WHEN 'trade'    THEN ${mbtiVec.trade}::float
    WHEN 'activity' THEN ${mbtiVec.activity}::float
    ELSE 0::float END`;

  // ── Build interest FTS tsquery ──────────────────────────────

  const interestKeywords = extractInterestKeywords(interestTags);
  const interestTsquery = buildInterestTsquery(interestKeywords);
  const hasInterestQuery = interestTsquery !== null;

  const interestFtsExpr = hasInterestQuery
    ? sql`ts_rank(
      to_tsvector('simple', coalesce(s.title, '') || ' ' || coalesce(s.content, '')),
      to_tsquery('simple', ${interestTsquery})
    )`
    : sql`0::real`;

  // ── Build filter conditions ────────────────────────────────

  let typeCondition = sql``;
  if (options.type) {
    typeCondition = sql`AND fp.type = ${options.type}`;
  }

  let keywordCondition = sql``;
  if (options.keyword?.trim()) {
    const terms = options.keyword
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 6);
    for (const term of terms) {
      const pattern = `%${term}%`;
      keywordCondition = sql`${keywordCondition} AND (fp.title ILIKE ${pattern} OR fp.content ILIKE ${pattern})`;
    }
  }

  // ── Profile match component ─────────────────────────────────
  // profileMatch = (mbtiTypeMatch × 0.4 + interestFtsMatch × 0.6) × surveyW
  const profileMatchExpr = totalInter === 0
    ? sql`(${mbtiAffinityExpr} * 0.4 + ${interestFtsExpr} * 0.6) * ${survW}::float`
    : sql`(${mbtiAffinityExpr} * 0.4 + ${interestFtsExpr} * 0.6) * ${survW}::float`;

  // ── Type affinity component ─────────────────────────────────
  // typeAffinity = forumAffinity × (1−mbtiW) + mbtiAffinity × mbtiW
  // forumAffinity is computed in SQL from user_affinity CTE

  // ── Build the recommendation CTE query ──────────────────────

  const recQuery = sql`
    WITH
      candidate_pool AS (
        SELECT * FROM forum_posts fp
        WHERE fp.deleted_at IS NULL
          AND fp.visibility = 'public'
          AND fp.circle_id IS NULL
          AND (fp.is_pinned = TRUE OR fp.created_at > NOW() - INTERVAL '30 days')
          ${typeCondition}
          ${keywordCondition}
      ),
      user_affinity AS (
        SELECT fp2.type, COUNT(*)::int AS cnt
        FROM (
          SELECT fpl.post_id FROM forum_post_likes fpl WHERE fpl.user_id = ${userId}
          UNION ALL
          SELECT fpf.post_id FROM forum_post_favorites fpf WHERE fpf.user_id = ${userId}
        ) i
        JOIN forum_posts fp2 ON fp2.id = i.post_id
        WHERE fp2.deleted_at IS NULL
        GROUP BY fp2.type
      ),
      interacted AS (
        SELECT fpl.post_id FROM forum_post_likes fpl WHERE fpl.user_id = ${userId}
        UNION
        SELECT fpf.post_id FROM forum_post_favorites fpf WHERE fpf.user_id = ${userId}
      ),
      similar_users AS (
        SELECT
          fpl2.user_id,
          COUNT(*) AS shared_likes
        FROM forum_post_likes fpl2
        WHERE fpl2.post_id IN (
          SELECT fpl3.post_id FROM forum_post_likes fpl3 WHERE fpl3.user_id = ${userId}
        )
          AND fpl2.user_id != ${userId}
        GROUP BY fpl2.user_id
        HAVING COUNT(*) >= 2
      ),
      collab_posts AS (
        SELECT fpl4.post_id, COUNT(DISTINCT fpl4.user_id)::int AS similar_cnt
        FROM forum_post_likes fpl4
        JOIN similar_users su ON su.user_id = fpl4.user_id
        WHERE fpl4.post_id NOT IN (SELECT ip.post_id FROM interacted ip)
        GROUP BY fpl4.post_id
      ),
      scored AS (
        SELECT
          cp.*,
          COALESCE(ua.cnt::float / NULLIF(
            (SELECT COALESCE(SUM(cnt), 0)::int FROM user_affinity), 0
          ), 0) AS forum_affinity,
          LEAST(COALESCE(cbp.similar_cnt, 0)::float / 5.0, 1.0) AS collab_boost,
          EXP(
            -EXTRACT(EPOCH FROM (NOW() - cp.created_at)) / 259200.0
          ) AS fresh_score,
          LEAST(
            ((cp.like_count * 3 + cp.comment_count * 5 + cp.favorite_count * 4)::float
              / (EXTRACT(EPOCH FROM (NOW() - cp.created_at)) / 3600.0 + 2)) * 8,
            1.0
          ) AS quality_score
        FROM candidate_pool cp
        LEFT JOIN user_affinity ua ON ua.type = cp.type
        LEFT JOIN collab_posts cbp ON cbp.post_id = cp.id
        WHERE cp.is_pinned = TRUE OR cp.id NOT IN (SELECT ip2.post_id FROM interacted ip2)
      )
    SELECT
      s.id,
      s.circle_id AS "circleId",
      s.title,
      s.type,
      s.is_anonymous AS "isAnonymous",
      s.visibility,
      s.like_count AS "likeCount",
      s.favorite_count AS "favoriteCount",
      s.comment_count AS "commentCount",
      s.view_count AS "viewCount",
      s.hot_score AS "hotScore",
      s.has_images AS "hasImages",
      s.summary AS "summary",
      s.cover_image_url AS "coverImageUrl",
      s.has_poll AS "hasPoll",
      s.is_pinned AS "isPinned",
      s.created_at AS "createdAt",
      s.user_id AS "authorUserId",
      u.nickname AS "authorNickname",
      u.avatar_url AS "authorAvatarUrl",
      fpl5.user_id AS "likedByMeUserId",
      fpf2.user_id AS "favoritedByMeUserId",
      (
        -- Type affinity
        (s.forum_affinity * ${1 - mbtiW}::float + ${mbtiAffinityExpr} * ${mbtiW}::float) * 0.20
        -- Collaborative boost
        + s.collab_boost * 0.15
        -- Profile match (MBTI + survey)
        + ${profileMatchExpr} * 0.15
        -- Freshness
        + s.fresh_score * 0.25
        -- Quality
        + s.quality_score * 0.25
      ) AS rec_score
    FROM scored s
    INNER JOIN users u ON s.user_id = u.id
    LEFT JOIN forum_post_likes fpl5
      ON fpl5.post_id = s.id AND fpl5.user_id = ${userId}
    LEFT JOIN forum_post_favorites fpf2
      ON fpf2.post_id = s.id AND fpf2.user_id = ${userId}
    ORDER BY s.is_pinned DESC, rec_score DESC, s.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  // ── Count query ─────────────────────────────────────────────

  const countQuery = sql`
    SELECT COUNT(*)::int AS total
    FROM forum_posts fp
    WHERE fp.deleted_at IS NULL
      AND fp.visibility = 'public'
      AND fp.circle_id IS NULL
      AND (fp.is_pinned = TRUE OR fp.created_at > NOW() - INTERVAL '30 days')
      ${typeCondition}
      ${keywordCondition}
      AND (fp.is_pinned = TRUE OR fp.id NOT IN (
        SELECT fpl.post_id FROM forum_post_likes fpl WHERE fpl.user_id = ${userId}
        UNION
        SELECT fpf.post_id FROM forum_post_favorites fpf WHERE fpf.user_id = ${userId}
      ))
  `;

  // ── Execute ─────────────────────────────────────────────────

  const [countResult] = await db.execute(countQuery) as any;
  const total = countResult?.total ?? 0;

  const rawRows = await db.execute(recQuery) as any;

  // ── Map to PostListItem shape ───────────────────────────────

  const posts = (rawRows as any[]).map((r: any) => {
    const isOwn = r.authorUserId === userId;
    const shouldMask = r.isAnonymous && !isOwn;
    return {
      postId: r.id,
      circleId: r.circleId,
      title: r.title,
      type: r.type as ForumPostType,
      author: shouldMask
        ? maskAuthor()
        : toAuthorDTO(
            { userId: r.authorUserId, nickname: r.authorNickname, avatarUrl: r.authorAvatarUrl },
            userId,
          ),
      isAnonymous: shouldMask ? true : r.isAnonymous,
      visibility: r.visibility as ForumVisibility,
      likeCount: Number(r.likeCount) ?? 0,
      favoriteCount: Number(r.favoriteCount) ?? 0,
      commentCount: Number(r.commentCount) ?? 0,
      viewCount: Number(r.viewCount) ?? 0,
      hotScore: Number(r.hotScore) ?? 0,
      hasImages: r.hasImages ?? false,
      summary: r.summary ?? null,
      coverImageUrl: r.coverImageUrl ?? null,
      hasPoll: r.hasPoll ?? false,
      likedByMe: !!r.likedByMeUserId,
      favoritedByMe: !!r.favoritedByMeUserId,
      isPinned: r.isPinned ?? false,
      createdAt: r.createdAt,
    };
  });

  return { total, page, limit, posts };
}

// ─── Hot Ranking ──────────────────────────────────────────────────

export async function getHotRanking(
  options: { range: HotRankingRange; limit: number },
) {
  // Hot scores are kept current by individual interaction functions (like/favorite/comment).
  // The frontend sidebar refreshes every 60 minutes, which naturally triggers re-query
  // with updated scores.

  const rows = await db
    .select({
      id: forumPosts.id,
      circleId: forumPosts.circleId,
      title: forumPosts.title,
      type: forumPosts.type,
      hotScore: forumPosts.hotScore,
      likeCount: forumPosts.likeCount,
      favoriteCount: forumPosts.favoriteCount,
      commentCount: forumPosts.commentCount,
      viewCount: forumPosts.viewCount,
      hasImages: forumPosts.hasImages,
      summary: forumPosts.summary,
      coverImageUrl: forumPosts.coverImageUrl,
      isAnonymous: forumPosts.isAnonymous,
      createdAt: forumPosts.createdAt,
      authorUserId: forumPosts.userId,
      author: {
        userId: users.id,
        nickname: users.nickname,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(forumPosts)
    .innerJoin(users, eq(forumPosts.userId, users.id))
    .where(
      and(
        isNull(forumPosts.deletedAt),
        eq(forumPosts.visibility, 'public'),
        isNull(forumPosts.circleId),
      ),
    )
    .orderBy(desc(forumPosts.hotScore), desc(forumPosts.createdAt))
    .limit(Math.min(options.limit, 50));

  return rows.map((r, i) => {
    const shouldMask = r.isAnonymous;
    return {
      rank: i + 1,
      postId: r.id,
      circleId: r.circleId,
      title: r.title,
      type: r.type,
      author: shouldMask ? maskAuthor() : toAuthorDTO(r.author, '' /* viewer unknown in ranking */),
      isAnonymous: shouldMask,
      hotScore: r.hotScore,
      likeCount: r.likeCount,
      favoriteCount: r.favoriteCount,
      commentCount: r.commentCount,
      viewCount: r.viewCount,
      hasImages: r.hasImages,
      summary: r.summary ?? null,
      coverImageUrl: r.coverImageUrl ?? null,
      createdAt: r.createdAt,
    };
  });
}

// ─── Announcements ────────────────────────────────────────────────

export async function listAnnouncements() {
  const now = sql`NOW()`;

  const rows = await db
    .select({
      id: forumAnnouncements.id,
      title: forumAnnouncements.title,
      priority: forumAnnouncements.priority,
      createdAt: forumAnnouncements.createdAt,
    })
    .from(forumAnnouncements)
    .where(
      and(
        eq(forumAnnouncements.isActive, true),
        sql`(${forumAnnouncements.startsAt} IS NULL OR ${forumAnnouncements.startsAt} <= ${now})`,
        sql`(${forumAnnouncements.endsAt} IS NULL OR ${forumAnnouncements.endsAt} >= ${now})`,
      ),
    )
    .orderBy(desc(forumAnnouncements.priority), desc(forumAnnouncements.createdAt));

  return rows;
}

export async function getAnnouncement(id: string) {
  const [row] = await db
    .select({
      id: forumAnnouncements.id,
      title: forumAnnouncements.title,
      content: forumAnnouncements.content,
      priority: forumAnnouncements.priority,
      createdAt: forumAnnouncements.createdAt,
    })
    .from(forumAnnouncements)
    .where(eq(forumAnnouncements.id, id))
    .limit(1);

  if (!row) {
    throw new NotFoundError('公告不存在');
  }

  return row;
}

// ─── Guestbook ────────────────────────────────────────────────────

export async function listGuestbookMessages(page: number, limit: number) {
  const offset = (page - 1) * limit;

  const [totalRow] = await db
    .select({ count: count() })
    .from(forumGuestbookMessages)
    .where(eq(forumGuestbookMessages.status, 'visible'));

  const rows = await db
    .select({
      id: forumGuestbookMessages.id,
      content: forumGuestbookMessages.content,
      createdAt: forumGuestbookMessages.createdAt,
      author: {
        userId: users.id,
        nickname: users.nickname,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(forumGuestbookMessages)
    .innerJoin(users, eq(forumGuestbookMessages.userId, users.id))
    .where(eq(forumGuestbookMessages.status, 'visible'))
    .orderBy(desc(forumGuestbookMessages.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    total: totalRow.count,
    page,
    limit,
    messages: rows,
  };
}

export async function createGuestbookMessage(userId: string, content: string) {
  if (!content.trim() || content.length > 200) {
    throw new ValidationError('留言内容需在 1-200 字之间');
  }

  const id = uuidv4();
  await db.insert(forumGuestbookMessages).values({
    id,
    userId,
    content: content.trim(),
  });

  return { messageId: id, message: '留言成功' };
}

export async function deleteGuestbookMessage(userId: string, messageId: string) {
  const [existing] = await db
    .select({ id: forumGuestbookMessages.id, userId: forumGuestbookMessages.userId, status: forumGuestbookMessages.status })
    .from(forumGuestbookMessages)
    .where(eq(forumGuestbookMessages.id, messageId))
    .limit(1);

  if (!existing) throw new NotFoundError('留言不存在');
  if (existing.status === 'hidden') throw new ValidationError('留言已被删除');
  if (existing.userId !== userId) throw new ForbiddenError('只能删除自己的留言');

  await db
    .update(forumGuestbookMessages)
    .set({ status: 'hidden' })
    .where(eq(forumGuestbookMessages.id, messageId));

  return { message: '留言已删除' };
}

// ─── Comments ─────────────────────────────────────────────────────

export async function createComment(
  userId: string,
  postId: string,
  data: CreateCommentInput,
) {
  const [userRow] = await db
    .select({ creditScore: users.creditScore })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!userRow) throw new NotFoundError('用户不存在');
  if ((userRow.creditScore ?? 100) <= 85) {
    throw new ForbiddenError('当前信用分过低，已禁止发帖与评论');
  }

  const hasContent = !!data.content?.trim();
  const hasVoice = !!data.voiceUrl;
  const hasImage = !!data.imageUrl;
  if (!hasContent && !hasVoice && !hasImage) {
    throw new ValidationError('评论内容不能为空');
  }
  if (data.voiceDurationSec !== undefined && !hasVoice) {
    throw new ValidationError('只有语音评论才能带语音时长');
  }
  if (
    data.imageUrl &&
    !/^https?:\/\//i.test(data.imageUrl) &&
    !data.imageUrl.startsWith('/')
  ) {
    throw new ValidationError('图片地址格式不正确');
  }

  // Verify post exists, not deleted, and visible to user
  const post = await requirePostAccess(postId, userId);

  // If replying to a comment, verify parent exists and derive rootCommentId
  let rootCommentId: string | null = null;
  let notifyUserId = post.userId;
  let notifyType = 'post_replied';
  let notifyTitle = '有人回复了你的帖子';
  let notifyContent = '你的帖子收到了新回复';

  if (data.parentCommentId) {
    const [parent] = await db
      .select({
        id: forumComments.id,
        userId: forumComments.userId,
        rootCommentId: forumComments.rootCommentId,
        postId: forumComments.postId,
        deletedAt: forumComments.deletedAt,
      })
      .from(forumComments)
      .where(eq(forumComments.id, data.parentCommentId))
      .limit(1);

    if (!parent || parent.deletedAt) {
      throw new NotFoundError('父评论不存在');
    }
    if (parent.postId !== postId) {
      throw new ValidationError('父评论不属于该帖子');
    }

    // Derive root: if parent is level-1 (rootCommentId is null), root = parent.id;
    // if parent is level-2, root = parent's root
    rootCommentId = parent.rootCommentId ?? parent.id;

    // If replying to someone else's comment, notify the parent comment author instead
    if (parent.userId !== userId) {
      notifyUserId = parent.userId;
      notifyType = 'comment_replied';
      notifyTitle = '有人回复了你的评论';
      notifyContent = '你的评论收到了新回复';
    }
  }

  const id = uuidv4();
  const normalizedContent = data.content?.trim() || null;
  await db.insert(forumComments).values({
    id,
    postId,
    userId,
    content: normalizedContent,
    commentType: hasVoice ? 'voice' : 'text',
    voiceUrl: hasVoice ? data.voiceUrl : null,
    voiceDurationSec: hasVoice ? (data.voiceDurationSec ?? null) : null,
    imageUrl: hasImage ? data.imageUrl : null,
    parentCommentId: data.parentCommentId ?? null,
    rootCommentId,
  } as any);

  // Update post counters
  await db
    .update(forumPosts)
    .set({
      commentCount: sql`${forumPosts.commentCount} + 1`,
      hotScore: hotScoreExpr(),
      lastInteractionAt: sql`NOW()`,
    } as any)
    .where(eq(forumPosts.id, postId));

  // Notify the appropriate user (post author or parent comment author).
  // Private posts: do NOT notify non-author commenters — they can't see the post.
  if (post.visibility !== 'private' || notifyUserId === post.userId) {
    await notify(notifyUserId, userId, notifyType, notifyTitle, notifyContent, {
      postId,
      commentId: id,
    });
  }

  return { commentId: id, rootCommentId, message: '评论成功' };
}

// ─── Delete ───────────────────────────────────────────────────────

export async function deletePost(userId: string, postId: string) {
  const [post] = await db
    .select({
      id: forumPosts.id,
      userId: forumPosts.userId,
      deletedAt: forumPosts.deletedAt,
    })
    .from(forumPosts)
    .where(eq(forumPosts.id, postId))
    .limit(1);

  if (!post) {
    throw new NotFoundError('帖子不存在');
  }
  if (post.deletedAt) {
    throw new NotFoundError('帖子已被删除');
  }
  if (post.userId !== userId) {
    throw new ForbiddenError('只能删除自己的帖子');
  }

  await db
    .update(forumPosts)
    .set({ deletedAt: sql`NOW()` })
    .where(eq(forumPosts.id, postId));

  return { message: '帖子已删除' };
}

export async function deleteComment(userId: string, commentId: string) {
  const [comment] = await db
    .select({
      id: forumComments.id,
      userId: forumComments.userId,
      postId: forumComments.postId,
      rootCommentId: forumComments.rootCommentId,
      deletedAt: forumComments.deletedAt,
    })
    .from(forumComments)
    .where(eq(forumComments.id, commentId))
    .limit(1);

  if (!comment) {
    throw new NotFoundError('评论不存在');
  }
  if (comment.deletedAt) {
    throw new NotFoundError('评论已被删除');
  }

  const isLevel1 = comment.rootCommentId === null;
  let canDelete = comment.userId === userId;

  // Post owner can delete any level-1 comment under the post.
  // Post owner cannot delete level-2 replies unless they are the reply author.
  if (!canDelete && isLevel1) {
    const [post] = await db
      .select({ userId: forumPosts.userId, deletedAt: forumPosts.deletedAt })
      .from(forumPosts)
      .where(eq(forumPosts.id, comment.postId))
      .limit(1);
    canDelete = !!post && !post.deletedAt && post.userId === userId;
  }

  if (!canDelete) {
    throw new ForbiddenError('仅评论作者可删除评论；帖主仅可删除第一级评论');
  }

  await db
    .update(forumComments)
    .set({
      deletedAt: sql`NOW()`,
      content: '该评论已被删除',
    })
    .where(eq(forumComments.id, commentId));

  await db
    .update(forumPosts)
    .set({
      commentCount: sql`GREATEST(${forumPosts.commentCount} - 1, 0)`,
      pinnedCommentId: sql`CASE WHEN ${forumPosts.pinnedCommentId} = ${commentId} THEN NULL ELSE ${forumPosts.pinnedCommentId} END`,
    } as any)
    .where(eq(forumPosts.id, comment.postId));

  return { message: '评论已删除' };
}

// ─── Comment Likes ─────────────────────────────────────────────

export async function likeComment(userId: string, commentId: string) {
  const [comment] = await db
    .select({
      id: forumComments.id,
      deletedAt: forumComments.deletedAt,
      userId: forumComments.userId,
      postId: forumComments.postId,
    })
    .from(forumComments)
    .where(eq(forumComments.id, commentId))
    .limit(1);

  if (!comment || comment.deletedAt) {
    throw new NotFoundError('评论不存在');
  }

  // Verify post is accessible
  const post = await requirePostAccess(comment.postId, userId);

  const [existing] = await db
    .select({ id: forumCommentLikes.id })
    .from(forumCommentLikes)
    .where(
      and(
        eq(forumCommentLikes.commentId, commentId),
        eq(forumCommentLikes.userId, userId),
      ),
    )
    .limit(1);

  if (existing) {
    return { liked: true, likeCount: 0, message: '已点赞' };
  }

  await db.insert(forumCommentLikes).values({
    id: uuidv4(),
    commentId,
    userId,
  });

  await db
    .update(forumComments)
    .set({
      likeCount: sql`${forumComments.likeCount} + 1`,
    } as any)
    .where(eq(forumComments.id, commentId));

  const [updated] = await db
    .select({ likeCount: forumComments.likeCount })
    .from(forumComments)
    .where(eq(forumComments.id, commentId))
    .limit(1);

  // Notify comment author — skip for private posts unless comment author is the post owner
  if (post.visibility !== 'private' || comment.userId === post.userId) {
    await notify(
      comment.userId,
      userId,
      'comment_liked',
      '有人赞了你的评论',
      '你的评论获得了一个赞',
      { commentId, postId: comment.postId },
    );
  }

  return { liked: true, likeCount: updated?.likeCount ?? 0, message: '点赞成功' };
}

export async function unlikeComment(userId: string, commentId: string) {
  // Look up comment to get postId, then verify access
  const [comment] = await db
    .select({ postId: forumComments.postId, deletedAt: forumComments.deletedAt })
    .from(forumComments)
    .where(eq(forumComments.id, commentId))
    .limit(1);

  if (!comment || comment.deletedAt) {
    throw new NotFoundError('评论不存在');
  }

  // Verify post is accessible
  await requirePostAccess(comment.postId, userId);

  const [existing] = await db
    .select({ id: forumCommentLikes.id })
    .from(forumCommentLikes)
    .where(
      and(
        eq(forumCommentLikes.commentId, commentId),
        eq(forumCommentLikes.userId, userId),
      ),
    )
    .limit(1);

  if (!existing) {
    return { liked: false, likeCount: 0, message: '未点赞' };
  }

  await db
    .delete(forumCommentLikes)
    .where(
      and(
        eq(forumCommentLikes.commentId, commentId),
        eq(forumCommentLikes.userId, userId),
      ),
    );

  await db
    .update(forumComments)
    .set({
      likeCount: sql`GREATEST(${forumComments.likeCount} - 1, 0)`,
    } as any)
    .where(eq(forumComments.id, commentId));

  const [updated] = await db
    .select({ likeCount: forumComments.likeCount })
    .from(forumComments)
    .where(eq(forumComments.id, commentId))
    .limit(1);

  return { liked: false, likeCount: updated?.likeCount ?? 0, message: '已取消点赞' };
}

// ─── Transcription ────────────────────────────────────────────────

export async function transcribeComment(userId: string, commentId: string) {
  const [comment] = await db
    .select({
      id: forumComments.id,
      postId: forumComments.postId,
      commentType: forumComments.commentType,
      voiceUrl: forumComments.voiceUrl,
      transcriptStatus: forumComments.transcriptStatus,
      deletedAt: forumComments.deletedAt,
    })
    .from(forumComments)
    .where(eq(forumComments.id, commentId))
    .limit(1);

  if (!comment || comment.deletedAt) {
    throw new NotFoundError('评论不存在');
  }

  // Verify user has access to the post
  await requirePostAccess(comment.postId, userId);

  if (comment.commentType !== 'voice') {
    throw new ValidationError('仅语音评论支持转写');
  }
  if (!comment.voiceUrl) {
    throw new ValidationError('该语音评论没有音频文件');
  }
  if (comment.transcriptStatus === 'pending') {
    throw new ValidationError('转写正在进行中');
  }
  if (comment.transcriptStatus === 'success') {
    return { message: '该评论已完成转写', transcriptStatus: 'success' as const };
  }

  // Mark as pending before async work
  await db
    .update(forumComments)
    .set({ transcriptStatus: 'pending' })
    .where(eq(forumComments.id, commentId));

  // Fire async transcription
  import('./transcriptionService.js')
    .then(({ transcribeVoiceFile }) =>
      transcribeVoiceFile(comment.voiceUrl!),
    )
    .then(async (text) => {
      await db
        .update(forumComments)
        .set({ transcript: text, transcriptStatus: 'success' })
        .where(eq(forumComments.id, commentId));
    })
    .catch(async (err) => {
      console.error('[transcription] failed:', err?.message ?? err);
      await db
        .update(forumComments)
        .set({ transcriptStatus: 'failed' })
        .where(eq(forumComments.id, commentId));
    });

  return { message: '转写任务已提交', transcriptStatus: 'pending' as const };
}

// ─── Comment Replies (two-level) ──────────────────────────────────

export async function getCommentReplies(
  userId: string,
  rootCommentId: string,
  page: number,
  limit: number,
) {
  // Look up post info for anonymous OP masking
  const [rootComment] = await db
    .select({ postId: forumComments.postId })
    .from(forumComments)
    .where(eq(forumComments.id, rootCommentId))
    .limit(1);

  let postAuthorUserId: string | null = null;
  let postIsAnonymous = false;

  if (rootComment) {
    const [post] = await db
      .select({
        userId: forumPosts.userId,
        isAnonymous: forumPosts.isAnonymous,
        visibility: forumPosts.visibility,
        deletedAt: forumPosts.deletedAt,
      })
      .from(forumPosts)
      .where(eq(forumPosts.id, rootComment.postId))
      .limit(1);
    if (!post || post.deletedAt) {
      throw new NotFoundError('帖子不存在');
    }
    if (post.visibility === 'private' && post.userId !== userId) {
      throw new ForbiddenError('该帖为私密内容');
    }
    postAuthorUserId = post.userId;
    postIsAnonymous = post.isAnonymous;
  }

  const offset = (page - 1) * limit;

  const [totalRow] = await db
    .select({ count: count() })
    .from(forumComments)
    .where(
      and(
        eq(forumComments.rootCommentId, rootCommentId),
      ),
    );

  const rows = await db
    .select({
      commentId: forumComments.id,
      author: {
        userId: sql`reply_user.id`,
        nickname: sql`reply_user.nickname`,
      },
      content: forumComments.content,
      commentType: forumComments.commentType,
      voiceUrl: forumComments.voiceUrl,
      voiceDurationSec: forumComments.voiceDurationSec,
      imageUrl: forumComments.imageUrl,
      transcript: forumComments.transcript,
      transcriptStatus: forumComments.transcriptStatus,
      parentCommentId: forumComments.parentCommentId,
      replyToNickname: sql`parent_user.nickname`,
      likeCount: forumComments.likeCount,
      likedByMe: sql`reply_likes.user_id`,
      deletedAt: forumComments.deletedAt,
      createdAt: forumComments.createdAt,
    } as any)
    .from(forumComments)
    .innerJoin(sql`users reply_user`, eq(forumComments.userId, sql`reply_user.id`))
    .leftJoin(
      sql`forum_comments parent_c`,
      eq(forumComments.parentCommentId, sql`parent_c.id`),
    )
    .leftJoin(
      sql`users parent_user`,
      eq(sql`parent_c.user_id`, sql`parent_user.id`),
    )
    .leftJoin(
      sql`forum_comment_likes reply_likes`,
      and(
        eq(forumComments.id, sql`reply_likes.comment_id`),
        eq(sql`reply_likes.user_id`, userId),
      ),
    )
    .where(
      and(eq(forumComments.rootCommentId, rootCommentId)),
    )
    .orderBy(forumComments.createdAt)
    .limit(limit)
    .offset(offset);

  const isOwn = postAuthorUserId === userId;

  const replies: ReplyItem[] = rows.map((r: any) => {
    const replyAuthorId = r.author.userId;
    const replyIsOP = postAuthorUserId !== null && replyAuthorId === postAuthorUserId;
    const replyShouldMask = postIsAnonymous && replyIsOP && !isOwn;
    return {
      commentId: r.commentId,
      author: replyShouldMask
        ? maskAuthor()
        : toAuthorDTO({ userId: replyAuthorId, nickname: r.author.nickname }, userId),
      content: r.content,
      commentType: r.commentType,
      voiceUrl: r.voiceUrl,
      voiceDurationSec: r.voiceDurationSec,
      imageUrl: r.imageUrl,
      transcript: r.transcript,
      transcriptStatus: r.transcriptStatus,
      parentCommentId: r.parentCommentId,
      replyToNickname: replyShouldMask ? '匿名楼主' : r.replyToNickname,
      likeCount: Number(r.likeCount) || 0,
      likedByMe: !!r.likedByMe,
      isDeleted: !!r.deletedAt,
      isAnonymousOP: replyIsOP && postIsAnonymous,
      createdAt: r.createdAt,
    };
  });

  return {
    total: Number(totalRow.count),
    page,
    limit,
    replies,
  };
}
