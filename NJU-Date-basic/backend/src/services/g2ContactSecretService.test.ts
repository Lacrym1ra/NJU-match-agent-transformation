import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildG2ContactSecretRecord,
  decryptG2ContactSecret,
  inferG2ContactTypeFromFieldKey,
  maskG2ContactValue,
  parseG2StoredProfileContact,
} from './g2ContactSecretService.js';

test('inferG2ContactTypeFromFieldKey recognizes common contact fields', () => {
  assert.equal(inferG2ContactTypeFromFieldKey('contact_wechat', '微信'), 'wechat');
  assert.equal(inferG2ContactTypeFromFieldKey('contact_qq', 'QQ'), 'qq');
  assert.equal(inferG2ContactTypeFromFieldKey('contact_email', '邮箱'), 'email');
  assert.equal(inferG2ContactTypeFromFieldKey('contact_custom_phone', '手机号'), 'phone');
  assert.equal(inferG2ContactTypeFromFieldKey('contact_custom_rednote', '小红书'), 'xiaohongshu');
});

test('parseG2StoredProfileContact keeps legacy plain values compatible', () => {
  assert.deepEqual(parseG2StoredProfileContact('legacy_wechat_id'), {
    contactType: 'wechat',
    value: 'legacy_wechat_id',
  });
  assert.deepEqual(parseG2StoredProfileContact('qq:123456'), {
    contactType: 'qq',
    value: '123456',
  });
  assert.deepEqual(parseG2StoredProfileContact('wechat:value:with:colon'), {
    contactType: 'wechat',
    value: 'value:with:colon',
  });
  assert.equal(parseG2StoredProfileContact('qq:'), null);
});

test('maskG2ContactValue masks contact values without erasing their type cues', () => {
  assert.equal(maskG2ContactValue('email', 'student@example.com'), 's***@e***.com');
  assert.equal(maskG2ContactValue('phone', '138-1234-5678'), '138****5678');
  assert.equal(maskG2ContactValue('wechat', 'wx123456'), 'wx***56');
  assert.equal(maskG2ContactValue('wechat', 'ab'), '**');
});

test('buildG2ContactSecretRecord encrypts and decrypts contact values', () => {
  const record = buildG2ContactSecretRecord({
    id: 'secret-1',
    ownerUserId: 'user-1',
    scopeType: 'circle_contact',
    scopeId: 'contact-1',
    fieldKey: 'contact_wechat',
    contactType: 'wechat',
    label: '微信',
    value: 'wx_secret_123',
    now: '2026-05-30T12:00:00.000Z',
  });

  assert.notEqual(record.ciphertext, 'wx_secret_123');
  assert.equal(record.maskedValue, 'wx***23');
  assert.equal(record.valueHash.length > 0, true);
  assert.equal(decryptG2ContactSecret(record as any), 'wx_secret_123');
});

test('decryptG2ContactSecret rejects records whose authenticated metadata changed', () => {
  const record = buildG2ContactSecretRecord({
    id: 'secret-2',
    ownerUserId: 'user-1',
    scopeType: 'circle_contact',
    scopeId: 'contact-1',
    fieldKey: 'contact_qq',
    contactType: 'qq',
    label: 'QQ',
    value: '12345678',
    now: '2026-05-30T12:00:00.000Z',
  });

  assert.throws(
    () => decryptG2ContactSecret({ ...record, ownerUserId: 'user-2' } as any),
    /Unsupported state|authenticate|bad decrypt|Invalid authentication tag|unable to authenticate/i,
  );
});
