import test from 'node:test';
import assert from 'node:assert/strict';
import { ValidationError } from '../../utils/errors.js';
import {
  normalizeCircleContactFieldKey,
  normalizeCircleContactInput,
  normalizeContactFieldKey,
} from './contactFields.js';

test('contact field policy normalizes supported unlock field keys', () => {
  assert.equal(normalizeContactFieldKey(undefined), 'contact_primary');
  assert.equal(normalizeContactFieldKey('contact_wechat'), 'contact_wechat');
  assert.throws(() => normalizeContactFieldKey('student_id'), ValidationError);
});

test('contact field policy restricts circle contact keys and normalizes input', () => {
  assert.equal(normalizeCircleContactFieldKey('contact_custom_lab'), 'contact_custom_lab');
  assert.throws(() => normalizeCircleContactFieldKey('contact_primary'), ValidationError);

  assert.deepEqual(normalizeCircleContactInput({
    fieldKey: 'contact_wechat',
    value: ' nju-date ',
  }), {
    fieldKey: 'contact_wechat',
    label: '微信',
    value: 'nju-date',
    isEnabled: true,
    displayOrder: 0,
  });
});
