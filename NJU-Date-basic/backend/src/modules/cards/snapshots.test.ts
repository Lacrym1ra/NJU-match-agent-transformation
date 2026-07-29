import test from 'node:test';
import assert from 'node:assert/strict';
import { formatSnapshotValue, parseStoredCardSnapshot } from './snapshots.js';

test('card snapshot policy formats stored values', () => {
  assert.equal(formatSnapshotValue(['算法', '羽毛球']), '算法 / 羽毛球');
  assert.equal(formatSnapshotValue({ level: 5 }), '{"level":5}');
  assert.equal(formatSnapshotValue(null), '');
});

test('card snapshot policy parses structured snapshots and filters sensitive fields', () => {
  const snapshot = parseStoredCardSnapshot({
    previewMode: 'friend',
    nickname: '小南',
    avatarUrl: null,
    baseModules: [
      { key: 'major', label: '专业', value: '软件工程' },
      { key: 'contact_wechat', label: '微信', value: 'secret' },
    ],
    circleCards: [
      {
        circleId: 'circle-1',
        circleName: '复习搭子',
        modules: [{ key: 'style', label: '风格', value: ['安静', '准时'] }],
      },
    ],
  });

  assert.equal(snapshot?.previewMode, 'friend');
  assert.deepEqual(snapshot?.baseModules, [{ key: 'major', label: '专业', value: '软件工程' }]);
  assert.deepEqual(snapshot?.circleCards[0]?.modules, [{ key: 'style', label: '风格', value: '安静 / 准时' }]);
});

test('card snapshot policy parses legacy flat snapshots', () => {
  const snapshot = parseStoredCardSnapshot([
    { area: 'base', key: 'grade', label: '年级', value: '大二' },
    { area: 'circle', key: 'goal', label: '目标', value: '结课复习' },
  ], {
    nickname: '小北',
    circleId: 'circle-2',
    circleName: '软件工程',
  });

  assert.equal(snapshot?.nickname, '小北');
  assert.deepEqual(snapshot?.circleCards[0], {
    circleId: 'circle-2',
    circleName: '软件工程',
    modules: [{ key: 'goal', label: '目标', value: '结课复习' }],
  });
});
