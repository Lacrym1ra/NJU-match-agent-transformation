import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGroupedPayload,
  filterDeletedModulesWithValue,
  flattenEditableGroups,
  mapBaseCardDefinitions,
  toViewerCard,
  toVisibilityLevel,
} from './apiTransform';

test('card api transform maps visibility and editable groups', () => {
  assert.equal(toVisibilityLevel('circle'), 'circle');
  assert.equal(toVisibilityLevel(undefined), 'hidden');

  const modules = flattenEditableGroups({
    public: [{ key: 'nickname', name: '昵称', value: '小南', topLeft: [1, 1], status: 'public' }],
    hidden: [{ key: 'campus', name: '校区', value: 'xianlin', topLeft: [0, 0], status: 'hidden' }],
    deleted: [{ key: 'old', name: '旧字段', value: 'legacy', topLeft: [2, 2] }],
  }, true);

  assert.deepEqual(modules.map((module) => [module.moduleKey, module.visibilityLevel]), [
    ['campus', 'hidden'],
    ['nickname', 'public'],
    ['old', 'public'],
  ]);
});

test('card api transform builds grouped payloads and filters empty deleted fields', () => {
  assert.deepEqual(filterDeletedModulesWithValue([
    { key: 'empty', name: '空', value: '' },
    { key: 'arr', name: '数组', value: ['a'] },
    { key: 'obj', name: '对象', value: { a: 1 } },
  ]).map((component) => component.key), ['arr', 'obj']);

  const payload = buildGroupedPayload([
    { moduleKey: 'nickname', value: '小南', visibilityLevel: 'public', displayOrder: 0 },
    { moduleKey: 'wechat', value: 'wx', visibilityLevel: 'friends', displayOrder: 1 },
  ]);

  assert.equal(payload.components.public[0].key, 'nickname');
  assert.equal(payload.components.friends[0].status, 'friends');
});

test('card api transform maps module definitions and viewer cards', () => {
  assert.deepEqual(mapBaseCardDefinitions([
    { key: 'wechat', name: '微信', sourceType: 'manual', sourceKey: null },
    { key: 'game_rank', name: '段位', sourceType: 'manual', sourceKey: null },
    { key: 'grade', name: '年级', sourceType: 'user_profile', sourceKey: 'grade' },
  ]), [
    { key: 'wechat', name: '微信', category: 'contact', isSystem: false, description: undefined },
    { key: 'game_rank', name: '段位', category: 'game', isSystem: false, description: undefined },
    { key: 'grade', name: '年级', category: 'basic', isSystem: true, description: '同步自基础档案' },
  ]);

  const card = toViewerCard({
    view: 'friend',
    userId: 'user-1',
    circleId: 'circle-1',
    nickname: '小南',
    avatarUrl: null,
    isFriend: true,
    isCircleFriend: true,
    pendingRequest: null,
    card: {
      base: {
        public: [{ key: 'campus', name: '校区', value: 'xianlin', topLeft: [0, 0] }],
        hidden: [{ key: 'wechat', name: '微信', value: 'wx', topLeft: [0, 1] }],
      },
      circle: {
        public: [{ key: 'tag', name: '标签', value: ['算法', '自习'], topLeft: [0, 0] }],
      },
      custom: {},
    },
  }, true);

  assert.deepEqual(card.modules, [
    { moduleKey: 'campus', label: '校区', value: '仙林' },
    { moduleKey: 'wechat', label: '微信', value: 'wx' },
  ]);
  assert.equal(card.circleHighlights[0].value, '算法、自习');
});
