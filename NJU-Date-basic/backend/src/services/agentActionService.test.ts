import assert from 'node:assert/strict';
import test from 'node:test';
import { createAgentActionService } from './agentActionService.js';

function fixture() {
  let id = 0;
  const calls: string[] = [];
  const service = createAgentActionService({
    async publishPost(userId, input) {
      calls.push(`publish:${userId}:${input.title}`);
      return { postId: 'post-1', message: 'ok' };
    },
    async join(userId, circleId) {
      calls.push(`join:${userId}:${circleId}`);
      return { membershipStatus: 'active' };
    },
    now: () => 1_000,
    id: () => `id-${++id}`,
  });
  return { service, calls };
}

test('post draft does not publish until a matching confirmation is consumed', async () => {
  const { service, calls } = fixture();
  const draft = service.createDraft('u1', { title: 'Hello', content: 'World', type: 'general' });
  assert.deepEqual(calls, []);
  const confirmation = service.requestConfirmation('u1', 'publish_post', draft.draftId);
  const result = await service.publishDraft('u1', draft.draftId, confirmation.confirmationToken);
  assert.equal(result.postId, 'post-1');
  assert.deepEqual(calls, ['publish:u1:Hello']);
  await assert.rejects(() => service.publishDraft('u1', draft.draftId, confirmation.confirmationToken));
});

test('circle join confirmation is bound to its user and circle', async () => {
  const { service, calls } = fixture();
  const confirmation = service.requestConfirmation('u1', 'join_circle', 'circle-1');
  await assert.rejects(() => service.confirmJoin('u2', 'circle-1', confirmation.confirmationToken));
  assert.deepEqual(calls, []);
});
