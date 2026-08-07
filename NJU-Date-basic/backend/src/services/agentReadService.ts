import { listCircles } from '../modules/circles/index.js';
import {
  listFavoritedPosts, listLikedPosts, listMyPosts, listPosts,
  type ForumPostType, type ForumSort,
} from './forumService.js';
import { getAgentQuestionnaireStatus } from './surveyService.js';
import { getAgentProfileStatus } from './userService.js';
import { getCircleDetail } from '../modules/circles/circleService.js';
import { getPostDetail } from './forumService.js';
import { listCircleChatMessages, listTeamupChatMessages } from '../modules/chat/chatService.js';
import { getTeamupDetail, listTeamups } from '../modules/teamups/teamService.js';
import { getAgentCurrentMatchContext } from './matchService.js';
import { getNotifications } from './notificationService.js';

export interface AgentReadPageContext {
  pageType: string;
  resourceId?: string;
  parentResourceId?: string;
}

export interface AgentCircleSearchInput {
  query: string;
  keywords?: readonly string[];
  category?: string;
  tags?: readonly string[];
  sort: 'recommended' | 'active' | 'members' | 'latest';
  limit: number;
  includeJoined?: boolean;
}

export interface AgentForumSearchInput {
  query: string;
  keywords?: readonly string[];
  circleId?: string;
  type?: ForumPostType;
  types?: readonly ForumPostType[];
  sort: ForumSort;
  limit: number;
}

interface AgentReadServiceDependencies {
  getProfileStatus(userId: string): Promise<unknown>;
  getQuestionnaireStatus(userId: string): Promise<unknown>;
  listCircles(userId: string, options: {
    keyword: string;
    keywords?: string[];
    includeJoined?: boolean;
    category?: string;
    tags?: string[];
    sort: AgentCircleSearchInput['sort'];
    page: number;
    limit: number;
  }): Promise<{
    total: number;
    circles: Array<{
      id: string;
      name: string;
      description: string | null;
      category: string;
      tags: string[];
      memberCount: number;
      isJoined?: boolean;
      recommendation: { reasons: string[] };
    }>;
  }>;
  listPosts(userId: string, options: {
    keyword: string;
    keywords?: string[];
    circleId?: string;
    type?: ForumPostType;
    types?: ForumPostType[];
    sort: ForumSort;
    authorScope: 'all';
    page: number;
    limit: number;
  }): Promise<{
    total: number;
    posts: Array<{
      postId: string;
      circleId: string | null;
      title: string;
      type: string;
      summary: string | null;
      likeCount: number;
      commentCount: number;
      createdAt: string | null;
    }>;
  }>;
  getCircleDetail?(circleId: string, userId: string): Promise<unknown>;
  getPostDetail?(userId: string, postId: string): Promise<unknown>;
  listCircleChat?(userId: string, circleId: string, options: { limit: number }): Promise<unknown>;
  getTeamupDetail?(userId: string, circleId: string, teamupId: string): Promise<unknown>;
  listTeamupChat?(userId: string, circleId: string, teamupId: string, options: { limit: number }): Promise<unknown>;
  getCurrentMatch?(userId: string): Promise<unknown>;
  getNotifications?(userId: string, options: { page: number; limit: number; status: 'all' | 'unread' | 'read' }): Promise<unknown>;
  listTeamups?(userId: string, circleId: string, options: {
    keyword?: string; page: number; limit: number;
  }): Promise<unknown>;
  listMyPosts?(userId: string, options: { page: number; limit: number }): Promise<unknown>;
  listLikedPosts?(userId: string, options: { page: number; limit: number }): Promise<unknown>;
  listFavoritedPosts?(userId: string, options: { page: number; limit: number }): Promise<unknown>;
}

function compactPostDetail(value: unknown) {
  const detail = value as { post?: Record<string, unknown>; comments?: Array<Record<string, unknown>> };
  if (!detail?.post) return null;
  const post = detail.post;
  return {
    post: {
      postId: post.postId, circleId: post.circleId, title: post.title,
      content: typeof post.content === 'string' ? post.content.slice(0, 4_000) : post.content,
      type: post.type, author: post.author, likeCount: post.likeCount,
      favoriteCount: post.favoriteCount, commentCount: post.commentCount,
      likedByMe: post.likedByMe, favoritedByMe: post.favoritedByMe,
    },
    comments: (detail.comments ?? []).slice(0, 12).map((comment) => ({
      commentId: comment.commentId, author: comment.author,
      content: typeof comment.content === 'string' ? comment.content.slice(0, 800) : comment.content,
      likeCount: comment.likeCount, replyCount: comment.replyCount,
      createdAt: comment.createdAt, isDeleted: comment.isDeleted,
    })),
  };
}

function compactChat(value: unknown) {
  const rows = (value as { messages?: Array<Record<string, unknown>> })?.messages ?? [];
  return rows.filter((row) => !row.deletedAt && row.status !== 'deleted').slice(-20).map((row) => ({
    messageId: row.id, sender: row.sender, senderNickname: row.senderNickname,
    content: typeof row.content === 'string' ? row.content.slice(0, 1_000) : row.content,
    createdAt: row.createdAt, isOwn: row.isOwn,
  }));
}

export function createAgentReadService(dependencies: AgentReadServiceDependencies) {
  return {
    getMyProfileStatus: dependencies.getProfileStatus,
    getQuestionnaireStatus: dependencies.getQuestionnaireStatus,

    async readPageContext(userId: string, context?: AgentReadPageContext) {
      if (!context) return null;
      // The reveal/match page represents the caller's current match and therefore
      // has no resource id in the URL. Resolve it from the authenticated user
      // before applying the resource-id guard used by the other page types.
      if (context.pageType === 'match' && dependencies.getCurrentMatch) {
        return { kind: 'match', data: await dependencies.getCurrentMatch(userId) };
      }
      if (!context.resourceId) return null;
      if (context.pageType === 'forum_post' && dependencies.getPostDetail) {
        return { kind: 'forum_post', data: compactPostDetail(await dependencies.getPostDetail(userId, context.resourceId)) };
      }
      if ((context.pageType === 'circle' || context.pageType === 'circle_livechat') && dependencies.getCircleDetail) {
        const detail = await dependencies.getCircleDetail(context.resourceId, userId) as Record<string, unknown>;
        const circle = {
          id: detail.id, name: detail.name, description: detail.description,
          category: detail.category, tags: detail.tags, memberCount: detail.memberCount,
          isJoined: detail.isJoined, membershipStatus: detail.membershipStatus,
        };
        const chat = context.pageType === 'circle_livechat' && dependencies.listCircleChat
          ? compactChat(await dependencies.listCircleChat(userId, context.resourceId, { limit: 20 })) : undefined;
        return { kind: context.pageType, data: { circle, chat } };
      }
      if ((context.pageType === 'teamup' || context.pageType === 'teamup_chat')
        && context.parentResourceId && dependencies.getTeamupDetail) {
        const detail = await dependencies.getTeamupDetail(userId, context.parentResourceId, context.resourceId);
        let chat: ReturnType<typeof compactChat> | undefined;
        if (dependencies.listTeamupChat) {
          try {
            chat = compactChat(await dependencies.listTeamupChat(
              userId, context.parentResourceId, context.resourceId, { limit: 20 },
            ));
          } catch {
            // Detail can be visible before membership; chat remains member-only.
          }
        }
        return { kind: context.pageType, data: { detail, chat } };
      }
      return null;
    },

    async getAgentNotifications(userId: string, status: 'all' | 'unread' | 'read' = 'unread') {
      if (!dependencies.getNotifications) return { total: 0, items: [] };
      return dependencies.getNotifications(userId, { page: 1, limit: 10, status });
    },

    async searchTeamups(userId: string, circleIds: readonly string[], keyword?: string) {
      if (!dependencies.listTeamups) return { total: 0, teamups: [] as unknown[] };
      const results = await Promise.allSettled(circleIds.slice(0, 6).map((circleId) =>
        dependencies.listTeamups!(userId, circleId, { keyword, page: 1, limit: 6 })));
      const unique = new Map<string, Record<string, unknown>>();
      for (const result of results) {
        if (result.status !== 'fulfilled') continue;
        const teamups = (result.value as { teamups?: Array<Record<string, unknown>> }).teamups ?? [];
        for (const teamup of teamups) if (typeof teamup.id === 'string') unique.set(teamup.id, teamup);
      }
      return { total: unique.size, teamups: [...unique.values()].slice(0, 6) };
    },

    async getMyForumCollection(userId: string, scope: 'mine' | 'liked' | 'favorited') {
      const loader = scope === 'mine' ? dependencies.listMyPosts
        : scope === 'liked' ? dependencies.listLikedPosts : dependencies.listFavoritedPosts;
      if (!loader) return { total: 0, posts: [] as unknown[] };
      return loader(userId, { page: 1, limit: 10 });
    },

    async searchCircles(userId: string, input: AgentCircleSearchInput) {
      const result = await dependencies.listCircles(userId, {
        keyword: input.query,
        keywords: input.keywords ? [...input.keywords] : undefined,
        includeJoined: input.includeJoined,
        category: input.category,
        tags: input.tags ? [...input.tags] : undefined,
        sort: input.sort,
        page: 1,
        limit: input.limit,
      });

      return {
        total: result.total,
        circles: result.circles.slice(0, input.limit).map((circle) => ({
          id: circle.id,
          name: circle.name,
          description: circle.description ?? '',
          category: circle.category,
          tags: circle.tags.slice(0, 5),
          memberCount: circle.memberCount,
          isJoined: Boolean(circle.isJoined),
          recommendationReasons: circle.recommendation.reasons.slice(0, 5),
        })),
      };
    },

    async searchForumPosts(userId: string, input: AgentForumSearchInput) {
      const result = await dependencies.listPosts(userId, {
        keyword: input.query,
        keywords: input.keywords ? [...input.keywords] : undefined,
        circleId: input.circleId,
        type: input.type,
        types: input.types ? [...input.types] : undefined,
        sort: input.sort,
        authorScope: 'all',
        page: 1,
        limit: input.limit,
      });

      return {
        total: result.total,
        posts: result.posts.slice(0, input.limit).map((post) => ({
          postId: post.postId,
          circleId: post.circleId,
          title: post.title,
          type: post.type,
          summary: post.summary,
          likeCount: post.likeCount,
          commentCount: post.commentCount,
          createdAt: post.createdAt,
        })),
      };
    },

    async searchForumPostsAcrossCircles(
      userId: string,
      input: AgentForumSearchInput & { circleIds: readonly string[] },
    ) {
      const scopes: Array<string | undefined> = [undefined, ...input.circleIds.slice(0, 6)];
      const results = await Promise.all(scopes.map((circleId) => dependencies.listPosts(userId, {
        keyword: input.query,
        keywords: input.keywords ? [...input.keywords] : undefined,
        circleId,
        type: input.type,
        types: input.types ? [...input.types] : undefined,
        sort: input.sort,
        authorScope: 'all',
        page: 1,
        limit: input.limit,
      })));

      const unique = new Map<string, (typeof results)[number]['posts'][number]>();
      for (const result of results) {
        for (const post of result.posts) unique.set(post.postId, post);
      }
      const posts = [...unique.values()]
        .sort((a, b) => Date.parse(b.createdAt ?? '') - Date.parse(a.createdAt ?? ''))
        .slice(0, input.limit)
        .map((post) => ({
          postId: post.postId,
          circleId: post.circleId,
          title: post.title,
          type: post.type,
          summary: post.summary,
          likeCount: post.likeCount,
          commentCount: post.commentCount,
          createdAt: post.createdAt,
        }));

      return { total: unique.size, posts };
    },
  };
}

export const agentReadService = createAgentReadService({
  getProfileStatus: getAgentProfileStatus,
  getQuestionnaireStatus: getAgentQuestionnaireStatus,
  listCircles,
  listPosts,
  getCircleDetail,
  getPostDetail,
  listCircleChat: listCircleChatMessages,
  getTeamupDetail,
  listTeamupChat: listTeamupChatMessages,
  getCurrentMatch: getAgentCurrentMatchContext,
  getNotifications,
  listTeamups,
  listMyPosts,
  listLikedPosts,
  listFavoritedPosts,
});
