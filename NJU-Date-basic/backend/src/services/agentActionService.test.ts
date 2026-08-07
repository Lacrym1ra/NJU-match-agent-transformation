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
    async sendCircleChat(userId, circleId, input) {
      calls.push(`chat:${userId}:${circleId}:${input.content}`);
      return { id: 'message-1' } as any;
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

test('expired drafts cannot receive a publish confirmation', () => {
  let now = 1_000;
  let id = 0;
  const service = createAgentActionService({
    async publishPost() { return { postId: 'post-1', message: 'ok' }; },
    async join() { return {}; },
    async sendCircleChat() { return { id: 'message-1' } as any; },
    now: () => now,
    id: () => `id-${++id}`,
  });
  const draft = service.createDraft('u1', { title: 'Hello', content: 'World', type: 'general' });
  now += 31 * 60_000;
  assert.throws(() => service.requestConfirmation('u1', 'publish_post', draft.draftId), /Draft not found/);
});

test('draft storage evicts the oldest item after the per-user cap', () => {
  let now = 1_000;
  let id = 0;
  const service = createAgentActionService({
    async publishPost() { return { postId: 'post-1', message: 'ok' }; },
    async join() { return {}; },
    async sendCircleChat() { return { id: 'message-1' } as any; },
    now: () => now,
    id: () => `id-${++id}`,
  });
  const oldest = service.createDraft('u1', { title: '0', content: 'World', type: 'general' });
  for (let index = 1; index <= 10; index += 1) {
    now += 1;
    service.createDraft('u1', { title: String(index), content: 'World', type: 'general' });
  }
  assert.throws(() => service.requestConfirmation('u1', 'publish_post', oldest.draftId), /Draft not found/);
});

test('circle LiveChat requires a matching single-use confirmation before sending', async () => {
  const { service, calls } = fixture();
  const draft = service.createLiveChatDraft('u1', {
    circleId: 'circle-1', content: '今晚一起讨论 Agent 吗？',
  });
  assert.deepEqual(calls, []);
  const confirmation = service.requestConfirmation('u1', 'send_circle_chat', draft.draftId);
  await assert.rejects(() => service.sendLiveChatDraft('u2', draft.draftId, confirmation.confirmationToken));
  assert.deepEqual(calls, []);

  const retry = service.requestConfirmation('u1', 'send_circle_chat', draft.draftId);
  await service.sendLiveChatDraft('u1', draft.draftId, retry.confirmationToken);
  assert.deepEqual(calls, ['chat:u1:circle-1:今晚一起讨论 Agent 吗？']);
  await assert.rejects(() => service.sendLiveChatDraft('u1', draft.draftId, retry.confirmationToken));
});
