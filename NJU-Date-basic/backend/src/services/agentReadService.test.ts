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
        category: undefined,
        tags: ['sports'],
        sort: 'recommended',
        page: 1,
        limit: 5,
      },
    ]]);
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
      circleId: 'circle-001',
      type: 'activity',
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
});
