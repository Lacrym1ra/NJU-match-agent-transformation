import { listCircles } from '../modules/circles/index.js';
import { listPosts, type ForumPostType, type ForumSort } from './forumService.js';
import { getAgentQuestionnaireStatus } from './surveyService.js';
import { getAgentProfileStatus } from './userService.js';

export interface AgentCircleSearchInput {
  query: string;
  category?: string;
  tags?: readonly string[];
  sort: 'recommended' | 'active' | 'members' | 'latest';
  limit: number;
}

export interface AgentForumSearchInput {
  query: string;
  circleId?: string;
  type?: ForumPostType;
  sort: ForumSort;
  limit: number;
}

interface AgentReadServiceDependencies {
  getProfileStatus(userId: string): Promise<unknown>;
  getQuestionnaireStatus(userId: string): Promise<unknown>;
  listCircles(userId: string, options: {
    keyword: string;
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
      recommendation: { reasons: string[] };
    }>;
  }>;
  listPosts(userId: string, options: {
    keyword: string;
    circleId?: string;
    type?: ForumPostType;
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
}

export function createAgentReadService(dependencies: AgentReadServiceDependencies) {
  return {
    getMyProfileStatus: dependencies.getProfileStatus,
    getQuestionnaireStatus: dependencies.getQuestionnaireStatus,

    async searchCircles(userId: string, input: AgentCircleSearchInput) {
      const result = await dependencies.listCircles(userId, {
        keyword: input.query,
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
          recommendationReasons: circle.recommendation.reasons.slice(0, 5),
        })),
      };
    },

    async searchForumPosts(userId: string, input: AgentForumSearchInput) {
      const result = await dependencies.listPosts(userId, {
        keyword: input.query,
        circleId: input.circleId,
        type: input.type,
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
  };
}

export const agentReadService = createAgentReadService({
  getProfileStatus: getAgentProfileStatus,
  getQuestionnaireStatus: getAgentQuestionnaireStatus,
  listCircles,
  listPosts,
});
