import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  InMemorySessionMemory,
  MockLLM,
  type AgentContext,
  type CircleSearchInput,
  type ForumSearchInput,
  type NjuMatchReadPort,
} from '@nju-match/agent-harness';
import { runAgentHarnessWithDependencies } from './agentHarnessRuntime.js';

function fixture() {
  const calls: string[] = [];
  const readPort: NjuMatchReadPort = {
    async getMyProfileStatus() {
      return {
        profileComplete: true, missingFields: [],
        profile: {
          nickname: '测试用户', gender: null, genderPreference: null, intention: 'friend',
          grade: '研一', campus: 'xianlin', department: '软件学院', mbti: null,
          bio: null, signature: null, tags: ['Agent'],
        },
      };
    },
    async getQuestionnaireStatus() {
      return {
        complete: true, currentVersion: 'v1', submittedVersion: 'v1',
        needsUpdate: false, submittedAt: '2026-08-07T00:00:00.000Z',
      };
    },
    async searchCircles(_userId: string, input: CircleSearchInput) {
      calls.push(`circle:${input.query}`);
      return {
        total: 1,
        circles: [{
          id: 'circle-1', name: 'AI 学习圈', description: '学习 Agent', category: '学习',
          tags: ['AI'], memberCount: 12, recommendationReasons: ['兴趣匹配'],
        }],
      };
    },
    async searchForumPosts(_userId: string, input: ForumSearchInput) {
      calls.push(`post:${input.query}`);
      return { total: 0, posts: [] };
    },
  };
  return { calls, readPort };
}

test('the production adapter path runs the self-implemented loop and feeds back a failed tool result', async () => {
  const { calls, readPort } = fixture();
  const result = await runAgentHarnessWithDependencies({
    userId: 'user-1', sessionId: 'session-1', goal: '找 Agent 学习内容',
  }, {
    llm: new MockLLM([
      { type: 'call_tool', tool: 'search_forum_posts', arguments: { query: 'Agent', sort: 'latest', limit: 3 } },
      (context: AgentContext) => context.observations.at(-1)?.category === 'NO_RESULTS'
        ? { type: 'call_tool', tool: 'search_circles', arguments: { query: 'Agent', sort: 'recommended', limit: 3 } }
        : { type: 'finish', summary: '没有获得预期反馈' },
      { type: 'finish', summary: '找到 AI 学习圈。' },
    ]),
    readPort,
    memory: new InMemorySessionMemory(),
  });

  assert.equal(result.status, 'SUCCEEDED');
  assert.equal(result.summary, '找到 AI 学习圈。');
  assert.deepEqual(result.tools, ['search_forum_posts', 'search_circles']);
  assert.deepEqual(calls, ['post:Agent', 'circle:Agent']);
});
