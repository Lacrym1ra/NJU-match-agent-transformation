import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCardDisplayValue } from './display';

test('formatCardDisplayValue maps campus values and joins arrays', () => {
  assert.equal(formatCardDisplayValue({ key: 'campus', value: 'xianlin' }), '仙林');
  assert.equal(formatCardDisplayValue({ label: '校区', value: ['gulou', 'unknown'] }), '鼓楼、unknown');
});

test('formatCardDisplayValue handles empty and object values', () => {
  assert.equal(formatCardDisplayValue({ key: 'bio', value: '' }), '—');
  assert.equal(formatCardDisplayValue({ key: 'bio', value: '' }, '未填写'), '未填写');
  assert.equal(formatCardDisplayValue({ key: 'profile', value: { city: '南京', school: 'NJU' } }), '南京、NJU');
  assert.equal(formatCardDisplayValue({ key: 'campus', value: { main: 'xianlin', secondary: '' } }), '仙林');
  assert.equal(formatCardDisplayValue({ key: 'profile', value: {} }), '—');
});
