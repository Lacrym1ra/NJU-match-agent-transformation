import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import {
  chatWithAgent, createAgentAction, createAgentDraft, createAgentLiveChatDraft,
  executeAgentAction, joinAgentCircle, publishAgentDraft, requestAgentConfirmation,
  sendAgentLiveChatDraft, type AgentActionKind, type AgentChatReply,
  type AgentConversationTurn, type AgentDraft, type AgentLiveChatDraft,
  type AgentProposedAction,
} from '../api/agent';
import { useAuth } from './AuthContext';
import { deriveAgentPageContext } from '../components/global-agent/pageContext';

const STORAGE_KEY = 'nju-match:global-agent:v1';
const MAX_STORED_MESSAGES = 20;

export interface GlobalAgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'status';
  content: string;
  response?: AgentChatReply;
}

type PendingAction =
  | { kind: 'join'; circleId: string; circleName: string }
  | { kind: 'livechat'; draft: AgentLiveChatDraft; circleName: string }
  | { kind: 'publish'; draft: AgentDraft }
  | { kind: 'generic'; actionId: string; actionKind: AgentActionKind; label: string }
  | {
    kind: 'teamup_form'; action: Extract<AgentProposedAction, { kind: 'join_teamup' | 'apply_teamup' }>;
    contactType: string; contactValue: string; applicationNote: string;
  };

interface AgentOverlayContextValue {
  open: boolean;
  busy: boolean;
  messages: GlobalAgentMessage[];
  pendingAction: PendingAction | null;
  currentContext: ReturnType<typeof deriveAgentPageContext>;
  setOpen(open: boolean): void;
  toggle(): void;
  clear(): void;
  send(message: string): Promise<void>;
  prepareAction(action: AgentProposedAction): Promise<void>;
  updateTeamupSensitiveInput(input: { contactType?: string; contactValue?: string; applicationNote?: string }): void;
  cancelPendingAction(): void;
  confirmPendingAction(): Promise<void>;
}

const AgentOverlayContext = createContext<AgentOverlayContextValue | null>(null);

function nextId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readStoredMessages(owner: string): GlobalAgentMessage[] {
  try {
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}') as {
      owner?: string; messages?: GlobalAgentMessage[];
    };
    if (stored.owner !== owner || !Array.isArray(stored.messages)) return [];
    return stored.messages.filter((message) => (
      message && typeof message.id === 'string' && typeof message.content === 'string'
      && ['user', 'assistant', 'status'].includes(message.role)
    )).slice(-MAX_STORED_MESSAGES);
  } catch { return []; }
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : 'Agent 暂时无法完成操作，请稍后重试。';
}

export function AgentOverlayProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<GlobalAgentMessage[]>([]);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [hydratedOwner, setHydratedOwner] = useState<string | null>(null);
  const currentContext = useMemo(
    () => deriveAgentPageContext(location.pathname, document.title),
    [location.pathname],
  );

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setMessages([]); setOpen(false); setPendingAction(null); setHydratedOwner(null);
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    setMessages(readStoredMessages(user.id));
    setHydratedOwner(user.id);
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (!user || hydratedOwner !== user.id) return;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      owner: user.id, messages: messages.slice(-MAX_STORED_MESSAGES),
    }));
  }, [messages, hydratedOwner, user?.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.key.toLowerCase() === 'a') {
        event.preventDefault(); setOpen((value) => !value);
      } else if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const append = useCallback((message: GlobalAgentMessage) => {
    setMessages((items) => [...items, message].slice(-MAX_STORED_MESSAGES));
  }, []);

  const send = useCallback(async (rawMessage: string) => {
    const content = rawMessage.trim();
    if (!content || busy) return;
    const history: AgentConversationTurn[] = messages
      .filter((message): message is GlobalAgentMessage & { role: 'user' | 'assistant' } => message.role !== 'status')
      .slice(-6)
      .map((message) => ({ role: message.role, content: message.content.slice(0, 1_000) }));
    append({ id: nextId(), role: 'user', content });
    setBusy(true);
    try {
      const response = await chatWithAgent(content, currentContext, history);
      append({ id: nextId(), role: 'assistant', content: response.reply, response });
    } catch (error) {
      append({ id: nextId(), role: 'status', content: errorMessage(error) });
    } finally { setBusy(false); }
  }, [append, busy, currentContext, messages]);

  const prepareAction = useCallback(async (action: AgentProposedAction) => {
    if (busy) return;
    if (action.kind === 'join_circle') {
      setPendingAction({ kind: 'join', circleId: action.circleId, circleName: action.circleName });
      return;
    }
    if (action.kind === 'create_post_draft') {
      setBusy(true);
      try {
        const result = await createAgentDraft({
          title: action.title, content: action.content, type: action.postType,
        });
        setPendingAction({ kind: 'publish', draft: result.draft });
      } catch (error) {
        append({ id: nextId(), role: 'status', content: errorMessage(error) });
      } finally { setBusy(false); }
      return;
    }
    if (action.kind === 'join_teamup' || action.kind === 'apply_teamup') {
      setPendingAction({
        kind: 'teamup_form', action, contactType: 'wechat', contactValue: '',
        applicationNote: action.applicationNote ?? '希望加入并参与本次组队',
      });
      return;
    }
    setBusy(true);
    try {
      if (action.kind === 'send_circle_chat') {
        const result = await createAgentLiveChatDraft({ circleId: action.circleId, content: action.content });
        setPendingAction({ kind: 'livechat', draft: result.draft, circleName: action.circleName });
        return;
      }
      const prepared = action.kind === 'comment_post'
        ? await createAgentAction({ kind: action.kind, payload: { postId: action.postId, content: action.content } })
        : action.kind === 'like_post' || action.kind === 'favorite_post'
          ? await createAgentAction({ kind: action.kind, payload: { postId: action.postId } })
          : action.kind === 'send_teamup_chat'
            ? await createAgentAction({ kind: action.kind, payload: {
              circleId: action.circleId, teamupId: action.teamupId, content: action.content,
            } })
            : action.kind === 'match_action'
              ? await createAgentAction({ kind: action.kind, payload: { matchId: action.matchId, action: action.action } })
              : action.kind === 'mark_notification_read'
                ? await createAgentAction({ kind: action.kind, payload: { notificationId: action.notificationId } })
                : action.kind === 'create_resonance_capsule'
                  ? await createAgentAction({ kind: action.kind, payload: {
                    title: action.title, prompt: action.prompt, expiresInDays: action.expiresInDays,
                  } })
                  : action.kind === 'create_meetup_safety_plan'
                    ? await createAgentAction({ kind: action.kind, payload: {
                      title: action.title, meetingPlace: action.meetingPlace,
                      meetingAt: action.meetingAt, expectedEndAt: action.expectedEndAt,
                      ...(action.note ? { note: action.note } : {}),
                    } })
                    : await createAgentAction({ kind: 'mark_all_notifications_read', payload: {} });
      const label = action.kind === 'comment_post' ? `评论“${action.postTitle}”`
        : action.kind === 'like_post' ? `点赞“${action.postTitle}”`
          : action.kind === 'favorite_post' ? `收藏“${action.postTitle}”`
            : action.kind === 'send_teamup_chat' ? `向“${action.teamupTitle}”群聊发送消息`
              : action.kind === 'match_action' ? `${action.action === 'ACCEPT' ? '接受' : '拒绝'}当前匹配`
                : action.kind === 'mark_notification_read' ? `将“${action.notificationTitle}”标为已读`
                  : action.kind === 'create_resonance_capsule' ? `创建共鸣胶囊“${action.title}”`
                    : action.kind === 'create_meetup_safety_plan' ? `创建安心赴约计划“${action.title}”`
                      : '将全部通知标为已读';
      setPendingAction({ kind: 'generic', actionId: prepared.actionId, actionKind: prepared.kind, label });
    } catch (error) {
      append({ id: nextId(), role: 'status', content: errorMessage(error) });
    } finally { setBusy(false); }
  }, [append, busy]);

  const confirmPendingAction = useCallback(async () => {
    if (!pendingAction || busy) return;
    setBusy(true);
    try {
      if (pendingAction.kind === 'join') {
        const confirmation = await requestAgentConfirmation('join_circle', pendingAction.circleId);
        await joinAgentCircle(pendingAction.circleId, confirmation.confirmationToken);
        append({ id: nextId(), role: 'status', content: `已提交加入“${pendingAction.circleName}”的请求。` });
        setMessages((items) => items.map((message) => message.response ? {
          ...message,
          response: {
            ...message.response,
            proposedActions: message.response.proposedActions.filter((action) => !(
              action.kind === 'join_circle' && action.circleId === pendingAction.circleId
            )),
          },
        } : message));
      } else if (pendingAction.kind === 'livechat') {
        const confirmation = await requestAgentConfirmation('send_circle_chat', pendingAction.draft.draftId);
        await sendAgentLiveChatDraft(pendingAction.draft.draftId, confirmation.confirmationToken);
        append({ id: nextId(), role: 'status', content: `消息已发送到“${pendingAction.circleName}”的圈内茶话。` });
      } else if (pendingAction.kind === 'publish') {
        const confirmation = await requestAgentConfirmation('publish_post', pendingAction.draft.draftId);
        const result = await publishAgentDraft(pendingAction.draft.draftId, confirmation.confirmationToken);
        append({ id: nextId(), role: 'status', content: `帖子已发布：${result.postId}` });
      } else if (pendingAction.kind === 'teamup_form') {
        if (!pendingAction.contactValue.trim()) throw new Error('加入组队需要由你填写至少一种联系方式。');
        const contacts = [{
          type: pendingAction.contactType.trim() || 'wechat',
          value: pendingAction.contactValue.trim(), label: pendingAction.contactType.trim() || '联系方式',
        }];
        const prepared = pendingAction.action.kind === 'join_teamup'
          ? await createAgentAction({ kind: 'join_teamup', payload: {
            circleId: pendingAction.action.circleId, teamupId: pendingAction.action.teamupId, contacts,
          } })
          : await createAgentAction({ kind: 'apply_teamup', payload: {
            circleId: pendingAction.action.circleId, teamupId: pendingAction.action.teamupId,
            applicationNote: pendingAction.applicationNote, contacts,
          } });
        const confirmation = await requestAgentConfirmation(prepared.kind, prepared.actionId);
        await executeAgentAction(prepared.actionId, prepared.kind, confirmation.confirmationToken);
        append({ id: nextId(), role: 'status', content: `已处理加入“${pendingAction.action.teamupTitle}”的请求。` });
      } else {
        const confirmation = await requestAgentConfirmation(pendingAction.actionKind, pendingAction.actionId);
        const execution = await executeAgentAction(
          pendingAction.actionId, pendingAction.actionKind, confirmation.confirmationToken,
        );
        const result = execution.result as { inviteCode?: unknown } | null;
        const completion = pendingAction.actionKind === 'create_resonance_capsule'
          && typeof result?.inviteCode === 'string'
          ? `已完成：${pendingAction.label}。一次性邀请码：${result.inviteCode}（请现在复制并私下转交）。`
          : pendingAction.actionKind === 'create_meetup_safety_plan'
            ? `已完成：${pendingAction.label}。请前往“安心赴约”页面，由你本人签到。`
            : `已完成：${pendingAction.label}。`;
        append({ id: nextId(), role: 'status', content: completion });
      }
      setPendingAction(null);
    } catch (error) {
      append({ id: nextId(), role: 'status', content: errorMessage(error) });
    } finally { setBusy(false); }
  }, [append, busy, pendingAction]);

  const value = useMemo<AgentOverlayContextValue>(() => ({
    open, busy, messages, pendingAction, currentContext,
    setOpen,
    toggle: () => setOpen((value) => !value),
    clear: () => { setMessages([]); setPendingAction(null); },
    send,
    prepareAction,
    updateTeamupSensitiveInput: (input) => setPendingAction((current) => current?.kind === 'teamup_form' ? {
      ...current,
      contactType: input.contactType ?? current.contactType,
      contactValue: input.contactValue ?? current.contactValue,
      applicationNote: input.applicationNote ?? current.applicationNote,
    } : current),
    cancelPendingAction: () => setPendingAction(null),
    confirmPendingAction,
  }), [open, busy, messages, pendingAction, currentContext, send, prepareAction, confirmPendingAction]);

  return <AgentOverlayContext.Provider value={value}>{children}</AgentOverlayContext.Provider>;
}

export function useAgentOverlay() {
  const context = useContext(AgentOverlayContext);
  if (!context) throw new Error('useAgentOverlay must be used within AgentOverlayProvider');
  return context;
}
