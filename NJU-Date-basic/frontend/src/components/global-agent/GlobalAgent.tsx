import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAgentOverlay, type GlobalAgentMessage } from '../../context/AgentOverlayContext';
import type { AgentProposedAction } from '../../api/agent';
import AgentConfirmDialog from '../agent/AgentConfirmDialog';
import AgentTeamupContactFields from '../agent/AgentTeamupContactFields';
import MaterialIcon from '../MaterialIcon';
import { pageContextLabels } from './pageContext';
import './GlobalAgent.css';

const suggestions = [
  '根据我的资料，推荐适合我的圈子和帖子',
  '帮我找本周可以参加的校园活动',
  '找一些适合长期交流的学习搭子',
  '查看我的未读通知',
  '查看我的共鸣胶囊',
  '查看我的安心赴约计划',
];

function actionText(action: AgentProposedAction) {
  switch (action.kind) {
    case 'join_circle': return `申请加入“${action.circleName}”`;
    case 'send_circle_chat': return `向“${action.circleName}”发送圈内消息`;
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
    case 'create_resonance_capsule': return `创建共鸣胶囊“${action.title}”`;
    case 'create_meetup_safety_plan': return `创建安心赴约计划“${action.title}”`;
  }
}

function actionKey(action: AgentProposedAction) {
  if ('circleId' in action) return `${action.kind}:${action.circleId}`;
  if ('postId' in action) return `${action.kind}:${action.postId}`;
  if ('matchId' in action) return `${action.kind}:${action.matchId}`;
  if ('notificationId' in action) return `${action.kind}:${action.notificationId}`;
  if (action.kind === 'create_resonance_capsule' || action.kind === 'create_meetup_safety_plan') return `${action.kind}:${action.title}`;
  return `${action.kind}:${actionText(action)}`;
}

function ResultPreview({ message, onAction }: {
  message: GlobalAgentMessage;
  onAction(action: AgentProposedAction): void;
}) {
  const response = message.response;
  if (!response) return null;
  return <>
    {(response.circles.length > 0 || response.posts.length > 0 || (response.teamups?.length ?? 0) > 0 || (response.resonanceCapsules?.length ?? 0) > 0 || (response.meetupSafetyPlans?.length ?? 0) > 0) && (
      <div className="global-agent-results" aria-label="Agent 检索结果">
        {response.circles.map((circle, index) => (
          <article className="global-agent-result" key={circle.id}>
            <span>[C{index + 1}] {circle.isJoined ? '已加入圈子' : '圈子'}</span>
            <strong>{circle.name}</strong>
            <small>{circle.memberCount} 位成员 · {circle.category}</small>
            <div>
              <Link to={`/circles/${circle.id}`}>查看</Link>
              {!circle.isJoined && <button type="button" onClick={() => onAction({
                kind: 'join_circle', circleId: circle.id, circleName: circle.name, requiresConfirmation: true,
              })}>申请加入</button>}
            </div>
          </article>
        ))}
        {response.posts.map((post, index) => (
          <article className="global-agent-result" key={post.postId}>
            <span>[P{index + 1}] 论坛帖子</span>
            <strong>{post.title}</strong>
            <small>{post.likeCount} 赞 · {post.commentCount} 条评论</small>
            <div><Link to={`/forum/${post.postId}`}>查看帖子</Link></div>
          </article>
        ))}
        {(response.teamups ?? []).map((teamup, index) => (
          <article className="global-agent-result" key={teamup.id}>
            <span>[T{index + 1}] 搭子/组队</span>
            <strong>{teamup.title}</strong>
            <small>{teamup.currentMemberCount}/{teamup.maxMembers} 人 · {teamup.joinMode === 'direct' ? '直接加入' : '审核加入'}</small>
            <div><Link to={`/circles/${teamup.circleId}/teamups/${teamup.id}`}>查看组队</Link></div>
          </article>
        ))}
        {(response.resonanceCapsules ?? []).map((capsule, index) => (
          <article className="global-agent-result" key={capsule.id}>
            <span>[R{index + 1}] 共鸣胶囊</span><strong>{capsule.title}</strong>
            <small>{capsule.status === 'revealed' ? '已经揭晓' : capsule.hasResponded ? '我的回答已封存' : '等待我回应'}</small>
            <div><Link to={`/resonance/${capsule.id}`}>打开胶囊</Link></div>
          </article>
        ))}
        {(response.meetupSafetyPlans ?? []).map((plan, index) => (
          <article className="global-agent-result" key={plan.id}>
            <span>[S{index + 1}] 安心赴约</span><strong>{plan.title}</strong>
            <small>{plan.status} · {new Date(plan.meetingAt).toLocaleString('zh-CN')}</small>
            <div><Link to="/meetup-safety">查看计划</Link></div>
          </article>
        ))}
      </div>
    )}
    {(response.notifications ?? []).length > 0 && <div className="global-agent-notifications">
      {response.notifications.map((notice) => <article key={notice.id}>
        <strong>{notice.title}</strong><span>{notice.body}</span>
        {!notice.isRead && <button type="button" onClick={() => onAction({
          kind: 'mark_notification_read', notificationId: notice.id,
          notificationTitle: notice.title, requiresConfirmation: true,
        })}>标为已读</button>}
      </article>)}
    </div>}
    {(response.proposedActions ?? []).length > 0 && (
      <div className="global-agent-actions" aria-label="等待确认的 Agent 操作">
        {response.proposedActions.map((action) => (
          <button key={actionKey(action)} type="button" onClick={() => onAction(action)}>
            <MaterialIcon name={action.kind.includes('join') ? 'group_add' : action.kind.includes('post') ? 'edit_note' : 'send'} />
            {actionText(action)}
          </button>
        ))}
      </div>
    )}
    <details className="global-agent-trace">
      <summary>检索依据</summary>
      <p>{response.trace.keywords.length > 0 ? response.trace.keywords.join('、') : '个性化推荐排序'} · {response.trace.circleCount} 个圈子 · {response.trace.postCount} 篇帖子</p>
    </details>
  </>;
}

export default function GlobalAgent() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const {
    open, busy, messages, pendingAction, currentContext, setOpen, toggle, clear,
    send, prepareAction, updateTeamupSensitiveInput, cancelPendingAction, confirmPendingAction,
  } = useAgentOverlay();
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const conversationRef = useRef<HTMLDivElement>(null);
  const shouldRender = isAuthenticated && !isLoading && location.pathname !== '/agent';

  useEffect(() => {
    if (open) window.setTimeout(() => textareaRef.current?.focus(), 80);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    conversationRef.current?.scrollTo({ top: conversationRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy, open]);

  if (!shouldRender) return null;

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const value = input.trim();
    if (!value || busy) return;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    await send(value);
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault(); void submit();
    }
  };

  const resizeInput = () => {
    const inputElement = textareaRef.current;
    if (!inputElement) return;
    inputElement.style.height = 'auto';
    inputElement.style.height = `${Math.min(inputElement.scrollHeight, 132)}px`;
  };

  const confirmationTitle = pendingAction?.kind === 'join' ? `确认申请加入“${pendingAction.circleName}”？`
    : pendingAction?.kind === 'livechat' ? `确认向“${pendingAction.circleName}”发送这条圈内消息？`
      : pendingAction?.kind === 'publish' ? `确认发布“${pendingAction.draft.title}”？`
        : pendingAction?.kind === 'teamup_form' ? `确认加入“${pendingAction.action.teamupTitle}”？`
          : pendingAction?.kind === 'generic' ? `确认${pendingAction.label}？` : '确认执行该操作？';

  return (
    <MotionConfig reducedMotion="user">
      <div className="global-agent-root">
        <AnimatePresence>
          {!open && <motion.button
            type="button"
            className="global-agent-launcher"
            onClick={toggle}
            aria-label="打开全局 Agent"
            title="打开 Agent（Alt+A）"
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.88 }}
            transition={{ type: 'spring', stiffness: 330, damping: 26 }}
          >
            <MaterialIcon name="auto_awesome" />
            <span>Agent</span>
          </motion.button>}
        </AnimatePresence>

        <AnimatePresence>
          {open && <motion.aside
            className="global-agent-shell"
            role="complementary"
            aria-label="NJU Match 全局 Agent"
            initial={{ opacity: 0, y: 22, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.985 }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
          >
            <div className="global-agent-toolbar">
              <div>
                <MaterialIcon name="auto_awesome" />
                <span>NJU Match Agent</span>
                <small>{pageContextLabels[currentContext.pageType]}</small>
              </div>
              <div>
                {messages.length > 0 && <button type="button" onClick={clear} title="清空本次会话"><MaterialIcon name="delete_sweep" /></button>}
                <Link to="/agent" title="打开完整 Agent 页面"><MaterialIcon name="open_in_full" /></Link>
                <button type="button" onClick={() => setOpen(false)} title="收起 Agent"><MaterialIcon name="keyboard_arrow_down" /></button>
              </div>
            </div>

            <div className={`global-agent-conversation ${messages.length === 0 ? 'is-empty' : ''}`} ref={conversationRef} aria-live="polite">
              {messages.length === 0 ? <div className="global-agent-welcome">
                <span>页面随行策展助手</span>
                <h2>现在想在这里完成什么？</h2>
                <p>我会读取你有权查看的当前页面，检索圈子、帖子与组队；论坛互动、消息发送和匹配选择等写操作仍由你确认。</p>
                <div>{suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => { setInput(suggestion); textareaRef.current?.focus(); }}>{suggestion}</button>)}</div>
              </div> : messages.map((message) => (
                <motion.article
                  key={message.id}
                  className={`global-agent-message is-${message.role}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.32 }}
                >
                  <span>{message.role === 'user' ? '你' : message.role === 'assistant' ? 'Agent' : '状态'}</span>
                  <p>{message.content}</p>
                  {message.role === 'assistant' && <ResultPreview message={message} onAction={(action) => void prepareAction(action)} />}
                </motion.article>
              ))}
              {busy && <div className="global-agent-thinking" role="status"><i /><i /><i /><span>Agent 正在整理</span></div>}
            </div>

            <form className="global-agent-composer" onSubmit={(event) => void submit(event)}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(event) => { setInput(event.target.value); resizeInput(); }}
                onKeyDown={onInputKeyDown}
                rows={1}
                maxLength={2000}
                placeholder={`询问 Agent · 当前：${pageContextLabels[currentContext.pageType]}`}
                aria-label="给 Agent 发送消息"
              />
              <div className="global-agent-composer__footer">
                <span><MaterialIcon name="location_on" />读取你有权限查看的当前页面内容</span>
                <button type="submit" disabled={busy || !input.trim()} aria-label="发送消息">
                  <MaterialIcon name={busy ? 'hourglass_top' : 'arrow_upward'} />
                </button>
              </div>
            </form>
          </motion.aside>}
        </AnimatePresence>

        <AgentConfirmDialog
          open={pendingAction !== null}
          busy={busy}
          title={confirmationTitle}
          description="该操作会产生真实账户变更。确认凭据仅用于本次操作，取消不会产生副作用。"
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
      </div>
    </MotionConfig>
  );
}
