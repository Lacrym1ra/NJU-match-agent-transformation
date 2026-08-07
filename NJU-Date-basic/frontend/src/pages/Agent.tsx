import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { motion, MotionConfig } from 'framer-motion';
import AgentConfirmDialog from '../components/agent/AgentConfirmDialog';
import AgentResultCard from '../components/agent/AgentResultCard';
import AgentTeamupContactFields from '../components/agent/AgentTeamupContactFields';
import MaterialIcon from '../components/MaterialIcon';
import {
  createAgentDraft, getAgentStatus, publishAgentDraft, requestAgentConfirmation,
  type AgentDraft, type AgentProposedAction, type AgentQueryTrace,
} from '../api/agent';
import { useAgentOverlay, type GlobalAgentMessage } from '../context/AgentOverlayContext';
import './Agent.css';

const suggestions = [
  '根据我的资料，推荐适合我的圈子和帖子',
  '帮我找本周可以参加的校园活动和组队',
  '找一些适合长期交流的学习搭子',
  '查看我的未读通知',
  '在“AI 与 Agent 学习圈”的圈内茶话发送：今晚有人一起交流工具调用吗？',
];

const intentLabels: Record<AgentQueryTrace['intent'], string> = {
  personalized_recommendation: '个性化推荐',
  circle_search: '圈子检索',
  forum_search: '论坛检索',
  mixed_search: '圈子与论坛联合检索',
};

const forumTypeLabels: Record<string, string> = {
  general: '日常交流', squad: '搭子/组队', help: '求助', trade: '闲置', activity: '活动',
};

function actionText(action: AgentProposedAction) {
  switch (action.kind) {
    case 'join_circle': return `申请加入“${action.circleName}”`;
    case 'send_circle_chat': return `向“${action.circleName}”的圈内茶话发送消息`;
    case 'create_post_draft': return `准备帖子草稿“${action.title}”`;
    case 'comment_post': return `评论“${action.postTitle}”`;
    case 'like_post': return `点赞“${action.postTitle}”`;
    case 'favorite_post': return `收藏“${action.postTitle}”`;
    case 'join_teamup':
    case 'apply_teamup': return `加入“${action.teamupTitle}”`;
    case 'send_teamup_chat': return `向“${action.teamupTitle}”群聊发送消息`;
    case 'match_action': return action.action === 'ACCEPT' ? '接受当前匹配' : '拒绝当前匹配';
    case 'mark_notification_read': return `将“${action.notificationTitle}”标为已读`;
    case 'mark_all_notifications_read': return '将全部通知标为已读';
  }
}

function actionKey(action: AgentProposedAction) {
  if ('circleId' in action) return `${action.kind}:${action.circleId}`;
  if ('postId' in action) return `${action.kind}:${action.postId}`;
  if ('matchId' in action) return `${action.kind}:${action.matchId}`;
  if ('notificationId' in action) return `${action.kind}:${action.notificationId}`;
  return `${action.kind}:${actionText(action)}`;
}

function ConversationResult({ message, onAction }: {
  message: GlobalAgentMessage;
  onAction(action: AgentProposedAction): void;
}) {
  const response = message.response;
  if (!response) return null;
  const actions = response.proposedActions ?? [];

  return <>
    {(response.circles.length > 0 || response.posts.length > 0 || (response.teamups?.length ?? 0) > 0) && <div className="agent-grid agent-conversation-results">
      {response.circles.map((circle) => <AgentResultCard
        key={circle.id}
        eyebrow={circle.isJoined ? '已加入圈子' : '圈子'}
        title={circle.name}
        description={circle.description}
        meta={`${circle.memberCount} 位成员 · ${circle.category}`}
        action={circle.isJoined
          ? <Link to={`/circles/${circle.id}`}>进入圈子</Link>
          : <button type="button" onClick={() => onAction({
            kind: 'join_circle', circleId: circle.id, circleName: circle.name,
            requiresConfirmation: true,
          })}>申请加入</button>}
      />)}
      {response.posts.map((post) => <AgentResultCard
        key={post.postId}
        eyebrow="论坛帖子"
        title={post.title}
        description={post.summary ?? '暂无摘要'}
        meta={`${post.likeCount} 赞 · ${post.commentCount} 条评论`}
        action={<Link to={`/forum/${post.postId}`}>查看帖子</Link>}
      />)}
      {(response.teamups ?? []).map((teamup) => <AgentResultCard
        key={teamup.id}
        eyebrow="搭子/组队"
        title={teamup.title}
        description={teamup.description}
        meta={`${teamup.currentMemberCount}/${teamup.maxMembers} 人 · ${teamup.joinMode === 'direct' ? '直接加入' : '审核加入'}`}
        action={<Link to={`/circles/${teamup.circleId}/teamups/${teamup.id}`}>查看组队</Link>}
      />)}
    </div>}

    {(response.notifications ?? []).length > 0 && <div className="agent-notification-results">
      {response.notifications.map((notice) => <article key={notice.id}>
        <span>{notice.isRead ? '已读' : '未读'}</span><strong>{notice.title}</strong><p>{notice.body}</p>
        {!notice.isRead && <button type="button" onClick={() => onAction({
          kind: 'mark_notification_read', notificationId: notice.id,
          notificationTitle: notice.title, requiresConfirmation: true,
        })}>标为已读</button>}
      </article>)}
    </div>}

    {actions.length > 0 && <div className="agent-actions" aria-label="等待确认的 Agent 操作">
      <span>等待你的确认</span>
      {actions.map((action) => <button
        key={actionKey(action)}
        type="button"
        onClick={() => onAction(action)}
      >
        <MaterialIcon name={action.kind.includes('join') ? 'group_add' : action.kind.includes('post') ? 'edit_note' : 'send'} />
        {actionText(action)}
      </button>)}
    </div>}

    <details className="agent-trace">
      <summary>查看本次检索依据</summary>
      <dl>
        <div><dt>识别意图</dt><dd>{intentLabels[response.trace.intent]}</dd></div>
        <div><dt>关键词</dt><dd>{response.trace.keywords.length > 0 ? response.trace.keywords.join('、') : '个性化推荐排序'}</dd></div>
        <div><dt>帖子类型</dt><dd>{response.trace.forumTypes.length > 0 ? response.trace.forumTypes.map((type) => forumTypeLabels[type] ?? type).join('、') : '全部类型'}</dd></div>
        <div><dt>命中结果</dt><dd>{response.trace.circleCount} 个圈子、{response.trace.postCount} 篇帖子</dd></div>
      </dl>
    </details>
  </>;
}

export default function Agent() {
  const {
    busy, messages, pendingAction, send, prepareAction, clear,
    updateTeamupSensitiveInput, cancelPendingAction, confirmPendingAction,
  } = useAgentOverlay();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('正在读取你的资料与问卷状态…');
  const [draft, setDraft] = useState<AgentDraft | null>(null);
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftNotice, setDraftNotice] = useState('');
  const [publishPending, setPublishPending] = useState(false);
  const conversationRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isBusy = busy || draftBusy;

  useEffect(() => {
    void getAgentStatus().then(({ profile, questionnaire }) => {
      if (!profile.profileComplete) setStatus(`资料还缺少 ${profile.missingFields.length} 项；Agent 可以帮你定位，但不会代填个人信息。`);
      else if (!questionnaire.complete || questionnaire.needsUpdate) setStatus('资料已就绪，问卷仍需由你完成或更新。');
      else setStatus('资料与问卷均已就绪；可以检索、申请加入圈子、准备帖子或确认发送圈内消息。');
    }).catch(() => setStatus('暂时无法读取账户状态，仍可继续使用公开检索能力。'));
  }, []);

  useEffect(() => {
    conversationRef.current?.scrollTo({ top: conversationRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const message = query.trim();
    if (!message || busy) return;
    setQuery('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    await send(message);
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  }

  function resizeInput() {
    if (!inputRef.current) return;
    inputRef.current.style.height = 'auto';
    inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 150)}px`;
  }

  async function makeDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setDraftBusy(true); setDraftNotice('');
    try {
      const result = await createAgentDraft({
        title: String(form.get('title')), content: String(form.get('content')),
        type: String(form.get('type')), isAnonymous: form.get('anonymous') === 'on',
      });
      setDraft(result.draft); setDraftNotice('草稿已保存，尚未发布。请检查内容后再确认。');
    } catch { setDraftNotice('草稿生成失败，请检查标题和正文。'); }
    finally { setDraftBusy(false); }
  }

  async function publishDraft() {
    if (!draft) return;
    setDraftBusy(true);
    try {
      const confirmation = await requestAgentConfirmation('publish_post', draft.draftId);
      const result = await publishAgentDraft(draft.draftId, confirmation.confirmationToken);
      setDraft(null); setPublishPending(false); setDraftNotice(`帖子已发布：${result.postId}`);
    } catch { setDraftNotice('发布未完成，确认凭据可能已过期，请重新确认。'); }
    finally { setDraftBusy(false); }
  }

  const confirmationTitle = pendingAction?.kind === 'join' ? `确认申请加入“${pendingAction.circleName}”？`
    : pendingAction?.kind === 'livechat' ? `确认向“${pendingAction.circleName}”发送这条圈内消息？`
      : pendingAction?.kind === 'publish' ? `确认发布“${pendingAction.draft.title}”？`
        : pendingAction?.kind === 'teamup_form' ? `确认加入“${pendingAction.action.teamupTitle}”？`
          : pendingAction?.kind === 'generic' ? `确认${pendingAction.label}？` : '确认执行该操作？';

  return (
    <MotionConfig reducedMotion="user">
      <main className="agent-page">
        <motion.header className="agent-hero agent-workspace" initial={false} animate={{ opacity: 1, y: 0 }}>
          <div className="agent-toolbar">
            <Link to="/dashboard" className="agent-back"><MaterialIcon name="arrow_back" />返回主页</Link>
            <span><MaterialIcon name="auto_awesome" />NJU Match Agent</span>
          </div>

          <div className="agent-workspace__intro">
            <span className="agent-kicker">页面随行策展助手 · 完整工作台</span>
            <h1>从查找到执行，<br />让 Agent 陪你完成。</h1>
            <p>我会读取你有权查看的当前页面、资料、问卷和真实平台数据。检索与总结可以直接完成；论坛互动、加入圈子或组队、匹配选择和发送消息等写操作，始终由你最终确认。</p>
            <div className="agent-capabilities" aria-label="当前 Agent 能力">
              <span><MaterialIcon name="search" />圈子与论坛检索</span>
              <span><MaterialIcon name="group_add" />确认后申请入圈</span>
              <span><MaterialIcon name="forum" />确认后发送圈内消息</span>
              <span><MaterialIcon name="edit_note" />帖子草稿与发布</span>
              <span><MaterialIcon name="groups" />搭子检索与申请</span>
              <span><MaterialIcon name="favorite" />匹配与通知协助</span>
            </div>
            <div className="agent-status"><MaterialIcon name="verified_user" />{status}</div>
          </div>

          <div className={`agent-conversation ${messages.length === 0 ? 'is-empty' : ''}`} ref={conversationRef} aria-live="polite">
            {messages.length === 0 ? <div className="agent-welcome">
              <span>可以从这些任务开始</span>
              <div>{suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => { setQuery(suggestion); inputRef.current?.focus(); }}>{suggestion}</button>)}</div>
            </div> : messages.map((message) => <motion.article
              key={message.id}
              className={`agent-message is-${message.role}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <span>{message.role === 'user' ? '你' : message.role === 'assistant' ? 'Agent' : '状态'}</span>
              <p>{message.content}</p>
              {message.role === 'assistant' && <ConversationResult message={message} onAction={(action) => void prepareAction(action)} />}
            </motion.article>)}
            {busy && <div className="agent-thinking" role="status"><i /><i /><i /><span>Agent 正在检索并整理</span></div>}
          </div>

          <form className="agent-composer" onSubmit={(event) => void submit(event)}>
            <textarea
              ref={inputRef}
              value={query}
              onChange={(event) => { setQuery(event.target.value); resizeInput(); }}
              onKeyDown={onInputKeyDown}
              rows={1}
              maxLength={2000}
              placeholder="告诉 Agent 你想查找或完成什么…"
              aria-label="给 Agent 发送消息"
            />
            <div className="agent-composer__footer">
              <span><MaterialIcon name="shield" />真实写操作会先向你确认</span>
              <div>
                {messages.length > 0 && <button type="button" className="agent-clear" onClick={clear} title="清空本次会话"><MaterialIcon name="delete_sweep" /></button>}
                <button type="submit" disabled={busy || !query.trim()} aria-label="发送消息"><MaterialIcon name={busy ? 'hourglass_top' : 'arrow_upward'} /></button>
              </div>
            </div>
          </form>
        </motion.header>

        <motion.section className="agent-section agent-compose" initial={false} animate={{ opacity: 1, y: 0 }}>
          <div className="agent-section__heading"><span>完整工作台扩展</span><h2>准备一篇帖子</h2><p>先保存为本地 Agent 草稿，检查后再使用一次性确认凭据发布。</p></div>
          <form onSubmit={(event) => void makeDraft(event)}>
            <input name="title" required maxLength={100} placeholder="帖子标题" />
            <textarea name="content" required maxLength={10000} rows={5} placeholder="告诉大家你想交流什么…" />
            <div className="agent-form-row">
              <select name="type" defaultValue="general"><option value="general">日常交流</option><option value="squad">寻找搭子</option><option value="help">求助</option><option value="activity">活动</option><option value="trade">闲置</option></select>
              <label><input name="anonymous" type="checkbox" /> 匿名发布</label>
              <button className="agent-button" disabled={isBusy}>保存草稿</button>
            </div>
          </form>
          {draftNotice && <div className="agent-notice" role="status">{draftNotice}</div>}
          {draft && <div className="agent-draft"><span>未发布草稿</span><h3>{draft.title}</h3><p>{draft.content}</p><button className="agent-button" type="button" onClick={() => setPublishPending(true)}>检查无误，准备发布</button></div>}
        </motion.section>

        <AgentConfirmDialog
          open={pendingAction !== null}
          busy={busy}
          title={confirmationTitle}
          description="该操作会产生真实账户变更。确认凭据仅用于本次操作；取消不会产生副作用。"
          onCancel={cancelPendingAction}
          onConfirm={() => void confirmPendingAction()}
        >
          {pendingAction?.kind === 'teamup_form' && <AgentTeamupContactFields
            contactType={pendingAction.contactType}
            contactValue={pendingAction.contactValue}
            applicationNote={pendingAction.applicationNote}
            showApplicationNote={pendingAction.action.kind === 'apply_teamup'}
            onChange={updateTeamupSensitiveInput}
          />}
        </AgentConfirmDialog>
        <AgentConfirmDialog
          open={publishPending}
          busy={draftBusy}
          title="确认发布这篇帖子？"
          description="帖子将对相应论坛受众可见。确认凭据仅用于本次发布。"
          onCancel={() => setPublishPending(false)}
          onConfirm={() => void publishDraft()}
        />
      </main>
    </MotionConfig>
  );
}
