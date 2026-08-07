import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createAgentReadService } from './agentReadService.js';

function createDependencies() {
  return {
    getProfileStatus: async (userId: string) => ({ userId }),
    getQuestionnaireStatus: async (userId: string) => ({ userId }),
    listCircles: async () => ({
      total: 1,
      circles: [{
        id: 'circle-001',
        name: 'Badminton',
        description: 'Sports circle',
        category: 'sports',
        tags: ['badminton', 'sports'],
        memberCount: 12,
        isJoined: false,
        recommendation: { reasons: ['兴趣匹配'] },
      }],
    }),
    listPosts: async () => ({
      total: 1,
      posts: [{
        postId: 'post-001',
        circleId: 'circle-001',
        title: 'Weekend badminton',
        type: 'activity',
        summary: 'Looking for players',
        likeCount: 2,
        commentCount: 3,
        createdAt: '2026-08-01T00:00:00.000Z',
      }],
    }),
  };
}

describe('agentReadService', () => {
  it('passes the authenticated identity and bounded circle filters', async () => {
    const calls: unknown[][] = [];
    const dependencies = createDependencies();
    const service = createAgentReadService({
      ...dependencies,
      async listCircles(userId, options) {
        calls.push([userId, options]);
        return dependencies.listCircles();
      },
    });

    const result = await service.searchCircles('authenticated-user', {
      query: 'badminton',
      tags: ['sports'],
      sort: 'recommended',
      limit: 5,
    });

    assert.deepEqual(calls, [[
      'authenticated-user',
      {
        keyword: 'badminton',
        keywords: undefined,
        includeJoined: undefined,
        category: undefined,
        tags: ['sports'],
        sort: 'recommended',
        page: 1,
        limit: 5,
      },
    ]]);
    assert.equal(result.circles[0]?.isJoined, false);
    assert.deepEqual(result.circles[0]?.recommendationReasons, ['兴趣匹配']);
  });

  it('passes circleId to forum search and returns only safe fields', async () => {
    const calls: unknown[][] = [];
    const dependencies = createDependencies();
    const service = createAgentReadService({
      ...dependencies,
      async listPosts(userId, options) {
        calls.push([userId, options]);
        return dependencies.listPosts();
      },
    });

    const result = await service.searchForumPosts('authenticated-user', {
      query: 'weekend',
      circleId: 'circle-001',
      type: 'activity',
      sort: 'latest',
      limit: 3,
    });

    assert.equal(calls[0]?.[0], 'authenticated-user');
    assert.deepEqual(calls[0]?.[1], {
      keyword: 'weekend',
      keywords: undefined,
      circleId: 'circle-001',
      type: 'activity',
      types: undefined,
      sort: 'latest',
      authorScope: 'all',
      page: 1,
      limit: 3,
    });
    assert.deepEqual(Object.keys(result.posts[0] ?? {}).sort(), [
      'circleId',
      'commentCount',
      'createdAt',
      'likeCount',
      'postId',
      'summary',
      'title',
      'type',
    ]);
  });

  it('searches global and bounded circle scopes then deduplicates posts', async () => {
    const scopes: Array<string | undefined> = [];
    const dependencies = createDependencies();
    const service = createAgentReadService({
      ...dependencies,
      async listPosts(_userId, options) {
        scopes.push(options.circleId);
        return dependencies.listPosts();
      },
    });

    const result = await service.searchForumPostsAcrossCircles('authenticated-user', {
      query: '', keywords: ['Agent', 'LLM'], types: ['squad', 'activity'], circleIds: ['c1', 'c2'],
      sort: 'latest', limit: 3,
    });

    assert.deepEqual(scopes, [undefined, 'c1', 'c2']);
    assert.equal(result.posts.length, 1);
  });

  it('reads only authorized recent circle chat for a livechat page context', async () => {
    const dependencies = createDependencies();
    const service = createAgentReadService({
      ...dependencies,
      async getCircleDetail(circleId, userId) {
        return { id: circleId, name: 'AI 圈', isJoined: true, membershipStatus: 'active', userId };
      },
      async listCircleChat(userId, circleId) {
        assert.equal(userId, 'u1'); assert.equal(circleId, 'c1');
        return { messages: [
          { id: 'm1', content: '保留', senderNickname: '甲', status: 'visible' },
          { id: 'm2', content: '删除', senderNickname: '乙', status: 'deleted', deletedAt: 'now' },
        ] };
      },
    });
    const context = await service.readPageContext('u1', {
      pageType: 'circle_livechat', resourceId: 'c1',
    }) as any;
    assert.equal(context.data.circle.name, 'AI 圈');
    assert.deepEqual(context.data.chat.map((item: any) => item.content), ['保留']);
  });

  it('resolves the current match from the authenticated user without a URL resource id', async () => {
    const dependencies = createDependencies();
    const service = createAgentReadService({
      ...dependencies,
      async getCurrentMatch(userId) {
        assert.equal(userId, 'authenticated-user');
        return { id: 'match-001', status: 'REVEALED', myAction: null };
      },
    });

    const context = await service.readPageContext('authenticated-user', {
      pageType: 'match',
    });

    assert.deepEqual(context, {
      kind: 'match',
      data: { id: 'match-001', status: 'REVEALED', myAction: null },
    });
  });
});
