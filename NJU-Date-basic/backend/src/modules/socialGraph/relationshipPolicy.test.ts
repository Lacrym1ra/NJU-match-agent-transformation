import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFriendPair } from './relationshipPolicy.js';

test('relationship policy normalizes friend pair ordering', () => {
  assert.deepEqual(normalizeFriendPair('b-user', 'a-user'), {
    userAId: 'a-user',
    userBId: 'b-user',
  });
  assert.deepEqual(normalizeFriendPair('a-user', 'b-user'), {
    userAId: 'a-user',
    userBId: 'b-user',
  });
});
