import test from 'node:test';
import assert from 'node:assert/strict';
import { displayCategory, getSafeRedirect } from './CircleDetail';

test('CircleDetail helper displays categories without moving page logic', () => {
  assert.equal(displayCategory(undefined), '圈子频道');
  assert.equal(displayCategory('study'), '学习');
  assert.equal(displayCategory('custom'), 'custom');
});

test('CircleDetail helper accepts only safe in-app redirects', () => {
  assert.equal(getSafeRedirect('/circles/circle-1/teamups'), '/circles/circle-1/teamups');
  assert.equal(getSafeRedirect('https://example.com'), null);
  assert.equal(getSafeRedirect('//example.com'), null);
  assert.equal(getSafeRedirect(null), null);
});
