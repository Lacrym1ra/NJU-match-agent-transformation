import test from 'node:test';
import assert from 'node:assert/strict';
import {
  displayCircleCategory,
  getAvailableCircleCategories,
  getCircleStatusLabel,
  matchesCircleFilters,
  normalizeCircleSearchQuery,
  normalizeCreateCirclePayload,
  splitJoinedCircles,
} from './discovery';

const baseCircle = {
  id: 'circle-1',
  name: '算法自习室',
  slug: 'algo-study',
  description: '一起刷题',
  category: 'study',
  tag: 'leetcode',
  tags: ['算法', '自习'],
  memberCount: 12,
  isJoined: false,
};

test('circle discovery policy formats categories and creation payloads', () => {
  assert.equal(displayCircleCategory('study'), '学习');
  assert.equal(displayCircleCategory(undefined), '圈子频道');
  assert.equal(getCircleStatusLabel({ status: 'pending_review', isActive: true } as any), '待审核');
  assert.equal(getCircleStatusLabel({ status: 'active', isActive: true } as any), '已上线');

  assert.deepEqual(
    normalizeCreateCirclePayload({
      name: '  南大桌游  ',
      description: '  周末开局  ',
      category: '  game  ',
      tags: '桌游，跑团 coop strategy long extra',
      joinPolicy: 'review',
      joinQuestion: '  常玩的游戏？ ',
    }),
    {
      name: '南大桌游',
      description: '周末开局',
      category: 'game',
      tags: ['桌游', '跑团', 'coop', 'strategy', 'long'],
      joinPolicy: 'review',
      joinQuestions: [{ question: '常玩的游戏？', required: true }],
    },
  );
});

test('circle discovery policy filters and splits circle lists', () => {
  const joinedCircle = { ...baseCircle, id: 'joined', isJoined: true };
  const unjoinedCircle = { ...baseCircle, id: 'unjoined', category: 'sports', isJoined: false };

  assert.equal(normalizeCircleSearchQuery('  算法  '), '算法');
  assert.equal(matchesCircleFilters(baseCircle as any, null, '学习'), true);
  assert.equal(matchesCircleFilters(baseCircle as any, 'sports', '算法'), false);
  assert.deepEqual(getAvailableCircleCategories([joinedCircle, unjoinedCircle] as any), ['study', 'sports']);
  assert.deepEqual(splitJoinedCircles([joinedCircle, unjoinedCircle] as any), {
    joinedCircles: [joinedCircle],
    unjoinedCircles: [unjoinedCircle],
  });
});
