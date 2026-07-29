import test from 'node:test';
import assert from 'node:assert/strict';
import { teamupApplicationSnapshotToPreview } from './snapshots';

test('teamup snapshot policy converts grouped card snapshots to preview', () => {
  const preview = teamupApplicationSnapshotToPreview({
    view: 'friend',
    nickname: '小南',
    card: {
      base: {
        public: [{ key: 'campus', label: '校区', value: 'xianlin', topLeft: [1, 1] }],
        hidden: [{ key: 'grade', label: '年级', status: 'hidden', topLeft: [0, 0] }],
      },
      circle: {
        public: [{ key: 'role', label: '角色', value: '队长', topLeft: [0, 1] }],
      },
      custom: {
        public: [{ key: 'note', label: '备注', value: ['摄影', '散步'], topLeft: [0, 0] }],
      },
    },
  } as any);

  assert.equal(preview?.previewMode, 'friend');
  assert.deepEqual(preview?.baseModules, [
    { key: 'grade', label: '年级', value: '已隐藏' },
    { key: 'campus', label: '校区', value: '仙林' },
  ]);
  assert.deepEqual(preview?.circleCards[0].modules, [
    { key: 'note', label: '备注', value: '摄影、散步' },
    { key: 'role', label: '角色', value: '队长' },
  ]);
});

test('teamup snapshot policy converts flat legacy snapshots to preview', () => {
  const preview = teamupApplicationSnapshotToPreview({
    view: 'public',
    baseModules: [{ key: 'nickname', label: '昵称', value: '小南', topLeft: [0, 1] }],
    circleCards: [{
      circleId: 'circle-1',
      circleName: '算法圈',
      modules: [{ key: 'tag', label: '标签', value: '刷题', topLeft: [0, 0] }],
    }],
  } as any);

  assert.equal(preview?.previewMode, 'public');
  assert.equal(preview?.circleCards[0].circleName, '算法圈');
});
