import test from 'node:test';
import assert from 'node:assert/strict';
import { containsSensitiveContactValue, isSensitiveFieldText } from './privacy.js';

test('isSensitiveFieldText detects contact-like field names', () => {
  assert.equal(isSensitiveFieldText('contact_wechat'), true);
  assert.equal(isSensitiveFieldText('微信号'), true);
  assert.equal(isSensitiveFieldText('student_id'), true);
  assert.equal(isSensitiveFieldText('gaming_role'), false);
  assert.equal(isSensitiveFieldText('常在线时段'), false);
});

test('containsSensitiveContactValue detects nested contact values', () => {
  assert.equal(containsSensitiveContactValue('微信: wx12345'), true);
  assert.equal(containsSensitiveContactValue('138 1234 5678'), true);
  assert.equal(containsSensitiveContactValue({ note: ['一起开黑', '邮箱 test@example.com'] }), true);
  assert.equal(containsSensitiveContactValue({ rank: '星耀', role: ['打野', '辅助'] }), false);
});
