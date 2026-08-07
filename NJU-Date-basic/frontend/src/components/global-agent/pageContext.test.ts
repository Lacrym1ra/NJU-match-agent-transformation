import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveAgentPageContext } from './pageContext';

test('derives bounded circle and forum resource context without reading page data', () => {
  assert.deepEqual(deriveAgentPageContext('/circles/circle-1/livechat', 'AI 圈子'), {
    pathname: '/circles/circle-1/livechat', pageType: 'circle_livechat', resourceId: 'circle-1', title: 'AI 圈子',
  });
  assert.equal(deriveAgentPageContext('/forum/post-1').pageType, 'forum_post');
  assert.equal(deriveAgentPageContext('/forum/ranking').pageType, 'forum');
});

test('does not expose arbitrary DOM or query data in page context', () => {
  const context = deriveAgentPageContext('/messages/user-1?draft=private');
  assert.equal(context.pathname, '/messages/user-1');
  assert.deepEqual(Object.keys(context).sort(), ['pageType', 'pathname', 'resourceId', 'title']);
  assert.equal(context.title, undefined);
});
