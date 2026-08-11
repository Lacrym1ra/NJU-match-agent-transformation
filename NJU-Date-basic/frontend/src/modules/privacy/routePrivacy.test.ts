import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { getRoutePrivacy, ROUTE_PRIVACY_RULES } from './routePrivacy';

test('every App route has an explicit privacy classification', () => {
  const appSource = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
  const appRoutes = [...appSource.matchAll(/<Route\s+path="([^"]+)"/g)].map((match) => match[1]);
  const classifiedRoutes = ROUTE_PRIVACY_RULES.map((rule) => rule.pattern);

  assert.deepEqual([...new Set(appRoutes)].sort(), [...new Set(classifiedRoutes)].sort());
});

test('dynamic community routes resolve without exposing a public classification', () => {
  assert.equal(getRoutePrivacy('/circles/agent-circle-ai/livechat').kind, 'community');
  assert.equal(getRoutePrivacy('/forum/agent-post-12').kind, 'community');
  assert.equal(getRoutePrivacy('/messages/test-user').kind, 'personal');
});

test('development bypass is explicitly disabled for production', () => {
  const rule = getRoutePrivacy('/agent-local');
  assert.equal(rule.kind, 'development');
  assert.equal(rule.productionEnabled, false);
});
