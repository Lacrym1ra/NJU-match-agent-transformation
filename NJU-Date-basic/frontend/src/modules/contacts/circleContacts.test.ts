import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCircleContactInput,
  createCustomCircleContactFieldKey,
  createEmptyCircleContact,
  getCircleContactDisplayKey,
  uniqueCircleContacts,
  validateCircleContactDrafts,
} from './circleContacts';

test('circle contact policy normalizes display keys and removes duplicates', () => {
  const contacts = [
    { fieldKey: 'wechat', label: ' 微信 ', value: ' NjuDate ' },
    { fieldKey: 'wechat', label: '微信', value: 'njudate' },
    { fieldKey: 'qq', label: 'QQ', value: '10001' },
  ];

  assert.equal(getCircleContactDisplayKey(contacts[0]), '微信:njudate');
  assert.deepEqual(uniqueCircleContacts(contacts), [contacts[0], contacts[2]]);
});

test('circle contact policy validates drafts and builds save payloads', () => {
  assert.deepEqual(
    validateCircleContactDrafts([{ fieldKey: 'wechat', label: '微信', value: '' }]),
    { valid: false, message: '方式和具体信息都不能为空' },
  );
  assert.deepEqual(
    validateCircleContactDrafts([
      { fieldKey: 'wechat', label: '微信', value: 'abc' },
      { fieldKey: 'wechat_alt', label: ' 微信 ', value: 'ABC' },
    ]),
    { valid: false, message: '同一种圈内联系方式只需要保留一条' },
  );

  const draft = createEmptyCircleContact(2, 'seed-001');
  assert.equal(draft.localId, 'local_seed-001');
  assert.equal(draft.fieldKey, 'contact_custom_seed-001');
  assert.equal(createCustomCircleContactFieldKey('a'.repeat(50)), `contact_custom_${'a'.repeat(40)}`);
  assert.deepEqual(
    buildCircleContactInput({ ...draft, label: ' 微信 ', value: ' abc ' }, 3),
    {
      fieldKey: 'contact_custom_seed-001',
      label: '微信',
      value: 'abc',
      isEnabled: true,
      displayOrder: 3,
    },
  );
});
