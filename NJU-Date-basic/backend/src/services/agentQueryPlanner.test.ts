import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { planAgentQuery } from './agentQueryPlanner.js';

describe('agentQueryPlanner', () => {
  it('extracts domain terms, result limits and forum intent from natural Chinese', () => {
    const plan = planAgentQuery('最多各3个：推荐 Agent、LLM 学习搭子和共读活动帖', {});
    assert.equal(plan.circleLimit, 3);
    assert.equal(plan.postLimit, 3);
    assert.deepEqual(plan.forumTypes, ['squad', 'activity']);
    assert.ok(plan.keywords.includes('Agent'));
    assert.ok(plan.keywords.includes('LLM'));
    assert.ok(plan.keywords.includes('学习'));
  });

  it('uses bounded profile tags for a personalized generic request', () => {
    const plan = planAgentQuery('根据我的资料和问卷推荐适合我的圈子和帖子，最多各3个。', {
      profile: { tags: '["Agent","LLM","人工智能","产品设计"]' },
    });
    assert.deepEqual(plan.keywords, ['Agent', 'LLM', '人工智能', '产品设计']);
    assert.equal(plan.usedProfileFallback, true);
    assert.equal(plan.circleLimit, 3);
  });

  it('caps user-controlled result counts and keyword volume', () => {
    const plan = planAgentQuery('给我9个 Agent LLM RAG AI Docker React 羽毛球 跑步 摄影 阅读 展览', {});
    assert.equal(plan.circleLimit, 6);
    assert.ok(plan.keywords.length <= 8);
  });

  it('removes SQL LIKE wildcard characters from retrieval terms', () => {
    const plan = planAgentQuery('search Agent% and LLM_', {});
    assert.ok(plan.keywords.every((keyword) => !/[%_\\]/.test(keyword)));
  });

  it('keeps multiple forum intents instead of dropping later intents', () => {
    const plan = planAgentQuery('想找学习搭子，也想看看共读活动和二手交换', {});
    assert.deepEqual(plan.forumTypes, ['trade', 'squad', 'activity']);
  });
});
