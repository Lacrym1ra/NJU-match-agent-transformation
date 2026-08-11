import assert from 'node:assert/strict';
import test from 'node:test';
import {
  detectAgentForumCollectionScope, proposeAgentActions, validateAndAttachReferences, type AgentReference,
} from './agentChatService.js';

const references: AgentReference[] = [
  { id: 'C1', kind: 'circle', resourceId: 'circle-1', label: 'AI 学习圈', href: '/circles/circle-1' },
  { id: 'P1', kind: 'post', resourceId: 'post-1', label: 'Agent 共读招募', href: '/forum/post-1' },
];

test('agent reference validation removes unknown ids and appends authoritative evidence', () => {
  const reply = validateAndAttachReferences('推荐 [C1]，不要相信不存在的 [C9]。', references);
  assert.match(reply, /推荐 \[C1\]/);
  assert.doesNotMatch(reply, /\[C9\]/);
  assert.match(reply, /可验证结果：\[C1\] AI 学习圈；\[P1\] Agent 共读招募/);
});

test('agent reference validation leaves an empty retrieval reply without a fake appendix', () => {
  assert.equal(validateAndAttachReferences('本次没有匹配结果。', []), '本次没有匹配结果。');
});

test('agent proposes a confirmed join only for an explicit command and an unjoined circle', () => {
  const actions = proposeAgentActions('帮我加入AI 与 Agent 学习圈', [
    { id: 'circle-1', name: 'AI 与 Agent 学习圈', isJoined: false },
  ]);
  assert.deepEqual(actions, [{
    kind: 'join_circle', circleId: 'circle-1', circleName: 'AI 与 Agent 学习圈',
    requiresConfirmation: true,
  }]);
});

test('agent proposes a LiveChat send only for an explicit payload in a joined circle', () => {
  const actions = proposeAgentActions(
    '在AI 与 Agent 学习圈的圈内茶话发送：今晚一起讨论工具调用吗？',
    [{ id: 'circle-1', name: 'AI 与 Agent 学习圈', isJoined: true }],
  );
  assert.deepEqual(actions, [{
    kind: 'send_circle_chat', circleId: 'circle-1', circleName: 'AI 与 Agent 学习圈',
    content: '今晚一起讨论工具调用吗？', requiresConfirmation: true,
  }]);
  assert.deepEqual(proposeAgentActions(
    '在AI 与 Agent 学习圈的圈内茶话发送：今晚一起讨论工具调用吗？',
    [{ id: 'circle-1', name: 'AI 与 Agent 学习圈', isJoined: false }],
  ), []);
});

test('agent refuses an ambiguous unnamed LiveChat target when multiple circles are joined', () => {
  assert.deepEqual(proposeAgentActions('LiveChat发送: hello', [
    { id: 'circle-1', name: 'Circle One', isJoined: true },
    { id: 'circle-2', name: 'Circle Two', isJoined: true },
  ]), []);
});

test('agent proposes page-bound forum actions without accepting a user supplied post id', () => {
  const pageContext = { pathname: '/forum/post-1', pageType: 'forum_post' as const, resourceId: 'post-1' };
  const pageContextData = { data: { post: { title: 'Agent 共读招募' } } };
  assert.deepEqual(proposeAgentActions('评论：今晚可以一起读第一章', [], {
    pageContext, pageContextData,
  }), [{
    kind: 'comment_post', postId: 'post-1', postTitle: 'Agent 共读招募',
    content: '今晚可以一起读第一章', requiresConfirmation: true,
  }]);
  assert.deepEqual(proposeAgentActions('给这篇帖子点赞', [], {
    pageContext, pageContextData,
  }), [{
    kind: 'like_post', postId: 'post-1', postTitle: 'Agent 共读招募', requiresConfirmation: true,
  }]);
});

test('agent prepares a post draft but does not claim it was published', () => {
  assert.deepEqual(proposeAgentActions('发帖：周末 Agent 共读｜周六晚一起读工具调用论文', []), [{
    kind: 'create_post_draft', title: '周末 Agent 共读', content: '周六晚一起读工具调用论文',
    postType: 'general', requiresConfirmation: false,
  }]);
});

test('agent teamup proposal requires sensitive contact input at confirmation time', () => {
  const teamup = {
    id: 'teamup-1', circleId: 'circle-1', title: 'Agent 共读搭子', description: '',
    currentMemberCount: 1, maxMembers: 4, joinMode: 'approval' as const,
    joinable: true, isTeamupMember: false, pendingApplicationId: null,
  };
  assert.deepEqual(proposeAgentActions('申请加入这个组队', [], { teamups: [teamup] }), [{
    kind: 'apply_teamup', circleId: 'circle-1', teamupId: 'teamup-1',
    teamupTitle: 'Agent 共读搭子', applicationNote: '希望加入并参与本次组队',
    requiresSensitiveInput: true, requiresConfirmation: true,
  }]);
});

test('agent binds match decisions to the current authorized match context', () => {
  assert.deepEqual(proposeAgentActions('接受当前匹配', [], {
    pageContext: { pathname: '/reveal', pageType: 'match' },
    pageContextData: { data: { id: 'match-1', status: 'REVEALED' } },
  }), [{ kind: 'match_action', matchId: 'match-1', action: 'ACCEPT', requiresConfirmation: true }]);
  assert.deepEqual(proposeAgentActions('接受当前匹配', [], {
    pageContext: { pathname: '/reveal', pageType: 'match' },
    pageContextData: { data: { id: 'match-1', status: 'EXPIRED' } },
  }), []);
});

test('agent requires confirmation before changing all notification state', () => {
  assert.deepEqual(proposeAgentActions('将全部通知标为已读', []), [{
    kind: 'mark_all_notifications_read', requiresConfirmation: true,
  }]);
});

test('agent proposes both Project B creations behind confirmation', () => {
  assert.deepEqual(proposeAgentActions('创建共鸣胶囊：慢慢认识｜哪一个瞬间让你感到被理解？', []), [{
    kind: 'create_resonance_capsule', title: '慢慢认识', prompt: '哪一个瞬间让你感到被理解？',
    expiresInDays: 7, requiresConfirmation: true,
  }]);
  assert.deepEqual(proposeAgentActions(
    '创建安心赴约：先锋书店见面｜广州路先锋书店｜2026-08-12 18:00｜2026-08-12 20:00｜到店后由我手动签到',
    [],
  ), [{
    kind: 'create_meetup_safety_plan', title: '先锋书店见面', meetingPlace: '广州路先锋书店',
    meetingAt: '2026-08-12T10:00:00.000Z', expectedEndAt: '2026-08-12T12:00:00.000Z',
    note: '到店后由我手动签到', requiresConfirmation: true,
  }]);
});

test('agent recognizes natural personal forum collection wording', () => {
  assert.equal(detectAgentForumCollectionScope('列出我发布过的帖子'), 'mine');
  assert.equal(detectAgentForumCollectionScope('列出我点赞过的帖子'), 'liked');
  assert.equal(detectAgentForumCollectionScope('列出我收藏过的帖子'), 'favorited');
  assert.equal(detectAgentForumCollectionScope('推荐一些热门帖子'), null);
});
