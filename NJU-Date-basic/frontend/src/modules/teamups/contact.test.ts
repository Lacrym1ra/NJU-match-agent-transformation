import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTeamupContact,
  buildTeamupContacts,
  draftFromCircleContact,
  getCircleContactOptions,
  hasIncompleteTeamupContactDraft,
  normalizeTeamupContactKind,
} from './contact';

test('teamup contact policy normalizes contact kinds and circle options', () => {
  assert.equal(normalizeTeamupContactKind('weixin'), 'wechat');
  assert.equal(normalizeTeamupContactKind('邮箱'), 'email');
  assert.equal(normalizeTeamupContactKind('Telegram'), 'other');

  const options = getCircleContactOptions([
    { id: '1', fieldKey: 'wechat', label: '微信', value: 'abc' },
    { id: '2', fieldKey: 'wechat_alt', label: ' 微信 ', value: 'ABC' },
    { id: '3', fieldKey: 'telegram', label: 'Telegram', value: 'nju' },
  ] as any);

  assert.deepEqual(options, [
    { key: '1', kind: 'wechat', label: '微信', value: 'abc' },
    { key: '3', kind: 'other', label: 'Telegram', value: 'nju' },
  ]);
  assert.deepEqual(draftFromCircleContact(options[1]), {
    kind: 'other',
    customLabel: 'Telegram',
    value: 'nju',
    source: 'circle',
    circleContactId: '3',
  });
});

test('teamup contact policy builds payloads and detects incomplete drafts', () => {
  assert.deepEqual(buildTeamupContact({ kind: 'other', customLabel: 'Discord', value: ' nju ', source: 'manual' }), {
    type: 'other',
    label: 'Discord',
    value: 'nju',
  });
  assert.deepEqual(buildTeamupContacts([
    { kind: 'wechat', customLabel: '', value: 'wx1' },
    { kind: 'qq', customLabel: '', value: '10001' },
    { kind: 'email', customLabel: '', value: 'a@b.test' },
    { kind: 'phone', customLabel: '', value: '13800000000' },
  ]), [
    { type: 'wechat', label: '微信', value: 'wx1' },
    { type: 'qq', label: 'QQ', value: '10001' },
    { type: 'email', label: '邮箱', value: 'a@b.test' },
  ]);
  assert.equal(hasIncompleteTeamupContactDraft([{ kind: 'other', customLabel: 'Discord', value: '' }]), true);
  assert.equal(hasIncompleteTeamupContactDraft([{ kind: 'wechat', customLabel: '', value: 'wx' }]), false);
});
