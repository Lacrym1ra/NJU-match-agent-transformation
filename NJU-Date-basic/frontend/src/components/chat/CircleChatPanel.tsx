import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MaterialIcon from '../MaterialIcon';
import { toast } from '../Toast';
import { useAuth } from '../../context/AuthContext';
import {
  ChatMessage,
  deleteCircleChatMessage,
  deleteTeamupChatMessage,
  getCircleChatMessages,
  getTeamupChatMessages,
  sendCircleChatMessage,
  sendTeamupChatMessage,
  updateCircleChatReadState,
  updateTeamupChatReadState,
} from '../../api/chat';
import {
  createRealtimeSocket,
  sendRealtimeEvent,
  type ServerRealtimeEvent,
} from '../../api/realtimeChat';

type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'offline';
export type LocalMessage = ChatMessage & {
  clientMessageId?: string;
  deliveryStatus?: 'sending' | 'failed';
  errorMessage?: string;
};

interface CircleChatPanelProps {
  roomType?: 'circle' | 'teamup';
  circleId: string;
  circleName: string;
  teamupId?: string;
  title?: string;
  subtitle?: string;
  variant?: 'embedded' | 'page';
}

export function createClientMessageId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

export function mergeMessage(prev: LocalMessage[], message: ChatMessage): LocalMessage[] {
  const existingIndex = prev.findIndex((item) => item.id === message.id);
  if (existingIndex >= 0) {
    const next = [...prev];
    next[existingIndex] = { ...message };
    return next;
  }
  return [...prev, message].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

export default function CircleChatPanel({
  roomType = 'circle',
  circleId,
  circleName,
  teamupId,
  title,
  subtitle,
  variant = 'embedded',
}: CircleChatPanelProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const socketRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isTeamupRoom = roomType === 'teamup';
  const roomKey = isTeamupRoom ? `teamup:${teamupId ?? ''}` : `circle:${circleId}`;
  const panelTitle = title ?? (isTeamupRoom ? '同游茶话' : '圈内茶话');
  const panelSubtitle = subtitle ?? (isTeamupRoom ? `${circleName} 组队成员的实时交流区` : `${circleName} 成员的实时交流区`);

  const connectionLabel = useMemo(() => {
    if (connectionState === 'connected') return '实时在线';
    if (connectionState === 'reconnecting') return '重连中';
    if (connectionState === 'connecting') return '连接中';
    return '离线模式';
  }, [connectionState]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const node = scrollRef.current;
      if (!node) return;
      node.scrollTop = node.scrollHeight;
    });
  }, []);

  const normalizeForCurrentUser = useCallback((message: ChatMessage): ChatMessage => ({
    ...message,
    isOwn: message.sender.userId === user?.id,
  }), [user?.id]);

  const markLatestRead = useCallback((items: LocalMessage[]) => {
    const latest = [...items].reverse().find((item) => !item.deletedAt);
    if (!latest) return;
    const payload = {
      lastReadMessageId: latest.id,
      lastReadAt: new Date().toISOString(),
    };
    const request = isTeamupRoom && teamupId
      ? updateTeamupChatReadState(circleId, teamupId, payload)
      : updateCircleChatReadState(circleId, payload);
    void request.catch(() => undefined);
  }, [circleId, isTeamupRoom, teamupId]);

  const loadHistory = useCallback(async (
    mode: 'initial' | 'more' = 'initial',
    before?: string | null,
  ) => {
    if (mode === 'more') setLoadingMore(true);
    else setLoading(true);

    try {
      if (isTeamupRoom && !teamupId) {
        throw new Error('组队聊天房间缺少 teamupId');
      }
      const res = isTeamupRoom && teamupId
        ? await getTeamupChatMessages(circleId, teamupId, {
          before: mode === 'more' ? before ?? undefined : undefined,
          limit: 30,
        })
        : await getCircleChatMessages(circleId, {
        before: mode === 'more' ? before ?? undefined : undefined,
        limit: 30,
      });
      const normalizedMessages = res.messages.map(normalizeForCurrentUser);
      setHasMore(res.hasMore);
      setNextBefore(res.nextBefore);
      setMessages((prev) => {
        const next = mode === 'more'
          ? [...normalizedMessages, ...prev]
          : normalizedMessages;
        return next;
      });
      if (mode === 'initial') {
        markLatestRead(normalizedMessages);
        scrollToBottom();
      }
    } catch (err: any) {
      toast.error(err.message || '加载圈聊失败');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [circleId, isTeamupRoom, markLatestRead, scrollToBottom, teamupId]);

  useEffect(() => {
    setMessages([]);
    setHasMore(false);
    setNextBefore(null);
    void loadHistory('initial');
  }, [loadHistory, roomKey]);

  useEffect(() => {
    let disposed = false;
    let retryTimer: number | undefined;
    let retryCount = 0;
    let allowReconnect = true;

    function scheduleReconnect() {
      if (disposed || !allowReconnect) return;
      setConnectionState('reconnecting');
      retryCount += 1;
      retryTimer = window.setTimeout(connect, Math.min(10000, 1000 + retryCount * 1000));
    }

    const isReadyForCurrentRoom = (data: ServerRealtimeEvent) => (
      data.type === 'chat.ready'
      && data.circleId === circleId
      && (
        isTeamupRoom
          ? data.roomType === 'teamup' && data.teamupId === teamupId
          : data.roomType === 'circle'
      )
    );

    function connect() {
      if (disposed) return;
      setConnectionState(retryCount === 0 ? 'connecting' : 'reconnecting');

      void (async () => {
        let ws: WebSocket;
        try {
          ws = await createRealtimeSocket();
        } catch {
          scheduleReconnect();
          return;
        }

        if (disposed) {
          ws.close();
          return;
        }

        let ready = false;
        socketRef.current = ws;

        ws.onopen = () => {
          if (isTeamupRoom && teamupId) {
            sendRealtimeEvent(ws, { type: 'chat.join', roomType: 'teamup', circleId, teamupId });
          } else {
            sendRealtimeEvent(ws, { type: 'chat.join', roomType: 'circle', circleId });
          }
        };

        ws.onmessage = (event) => {
          let data: ServerRealtimeEvent;
          try {
            data = JSON.parse(event.data);
          } catch {
            return;
          }

          if (isReadyForCurrentRoom(data)) {
            ready = true;
            retryCount = 0;
            setConnectionState('connected');
            return;
          }

          if (data.type === 'chat.ack') {
            if (
              data.message.circleId !== circleId
              || data.message.roomType !== roomType
              || (isTeamupRoom && data.message.teamupId !== teamupId)
            ) {
              return;
            }
            setMessages((prev) => prev.map((item) => (
              item.clientMessageId === data.clientMessageId
                ? { ...normalizeForCurrentUser(data.message), deliveryStatus: undefined, clientMessageId: data.clientMessageId }
                : item
            )));
            markLatestRead([normalizeForCurrentUser(data.message)]);
            scrollToBottom();
            return;
          }

          if (
            data.type === 'chat.message'
            && data.message.circleId === circleId
            && data.message.roomType === roomType
            && (!isTeamupRoom || data.message.teamupId === teamupId)
          ) {
            const message = normalizeForCurrentUser(data.message);
            setMessages((prev) => mergeMessage(prev, message));
            markLatestRead([message]);
            scrollToBottom();
            return;
          }

          if (
            data.type === 'chat.deleted'
            && data.circleId === circleId
            && (
              isTeamupRoom
                ? data.roomType === 'teamup' && data.teamupId === teamupId
                : data.roomType === 'circle'
            )
          ) {
            setMessages((prev) => prev.map((item) => (
              item.id === data.messageId
                ? { ...item, content: '', deletedAt: item.deletedAt ?? new Date().toISOString() }
                : item
            )));
            return;
          }

          if (data.type === 'chat.error') {
            if (data.clientMessageId) {
              setMessages((prev) => prev.map((item) => (
                item.clientMessageId === data.clientMessageId
                  ? { ...item, deliveryStatus: 'failed', errorMessage: data.message }
                  : item
              )));
            } else if (!ready) {
              allowReconnect = false;
              setConnectionState('offline');
              ws.close();
            }
            toast.error(data.message || '消息发送失败');
          }
        };

        ws.onclose = () => {
          if (disposed) return;
          if (!allowReconnect) {
            setConnectionState('offline');
            return;
          }
          scheduleReconnect();
        };

        ws.onerror = () => {
          ws.close();
        };
      })().catch(() => {
        scheduleReconnect();
      });
    }

    connect();

    return () => {
      disposed = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      socketRef.current?.close();
      socketRef.current = null;
      setConnectionState('offline');
    };
  }, [circleId, isTeamupRoom, markLatestRead, normalizeForCurrentUser, roomKey, roomType, scrollToBottom, teamupId]);

  const handleSend = async () => {
    const content = draft.trim();
    if (!content) return;
    if (content.length > 500) {
      toast.warning('消息不能超过 500 个字符');
      return;
    }
    if (isTeamupRoom && !teamupId) {
      toast.error('组队聊天房间缺少 teamupId');
      return;
    }

    const clientMessageId = createClientMessageId();
    const optimistic: LocalMessage = {
      id: `pending-${clientMessageId}`,
      roomType,
      circleId,
      ...(isTeamupRoom && teamupId ? { teamupId } : {}),
      sender: {
        userId: user?.id ?? 'me',
        nickname: user?.nickname || '我',
        avatarUrl: user?.avatarUrl ?? null,
      },
      content,
      mentions: [],
      createdAt: new Date().toISOString(),
      updatedAt: null,
      deletedAt: null,
      isOwn: true,
      clientMessageId,
      deliveryStatus: 'sending',
    };

    setMessages((prev) => [...prev, optimistic]);
    setDraft('');
    scrollToBottom();

    const ws = socketRef.current;
    if (ws?.readyState === WebSocket.OPEN && connectionState === 'connected') {
      if (isTeamupRoom && teamupId) {
        sendRealtimeEvent(ws, {
          type: 'chat.send',
          roomType: 'teamup',
          circleId,
          teamupId,
          clientMessageId,
          content,
        });
      } else {
        sendRealtimeEvent(ws, {
          type: 'chat.send',
          roomType: 'circle',
          circleId,
          clientMessageId,
          content,
        });
      }
      return;
    }

    try {
      const res = isTeamupRoom && teamupId
        ? await sendTeamupChatMessage(circleId, teamupId, { clientMessageId, content })
        : await sendCircleChatMessage(circleId, { clientMessageId, content });
      const message = normalizeForCurrentUser(res.message);
      setMessages((prev) => prev.map((item) => (
        item.clientMessageId === clientMessageId
          ? { ...message, clientMessageId }
          : item
      )));
      markLatestRead([message]);
      scrollToBottom();
    } catch (err: any) {
      setMessages((prev) => prev.map((item) => (
        item.clientMessageId === clientMessageId
          ? { ...item, deliveryStatus: 'failed', errorMessage: err.message || '发送失败' }
          : item
      )));
      toast.error(err.message || '发送失败');
    }
  };

  const handleDelete = async (messageId: string) => {
    try {
      if (isTeamupRoom && teamupId) {
        await deleteTeamupChatMessage(circleId, teamupId, messageId);
      } else {
        await deleteCircleChatMessage(circleId, messageId);
      }
      setMessages((prev) => prev.map((item) => (
        item.id === messageId ? { ...item, content: '', deletedAt: new Date().toISOString() } : item
      )));
    } catch (err: any) {
      toast.error(err.message || '删除失败');
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  const panelClassName = variant === 'page'
    ? 'mb-0 overflow-hidden rounded-2xl border border-[#EAE7E1]/70 bg-white/65 shadow-[0_8px_30px_rgba(139,115,85,0.05)]'
    : 'mb-10 overflow-hidden rounded-2xl border border-[#EAE7E1]/70 bg-white/65 shadow-[0_8px_30px_rgba(139,115,85,0.05)]';
  const messagesClassName = variant === 'page'
    ? 'max-h-[calc(100vh-360px)] min-h-[420px] overflow-y-auto px-4 py-4'
    : 'max-h-[360px] min-h-[260px] overflow-y-auto px-4 py-4';

  return (
    <section className={panelClassName}>
      <div className="flex flex-col gap-3 border-b border-[#EAE7E1]/70 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#420047]/8 text-[#420047]">
            <MaterialIcon name="forum" className="text-[22px]" />
          </div>
          <div>
            <h2 className="font-serif text-lg tracking-widest text-[#2C2825]">{panelTitle}</h2>
            <p className="mt-0.5 text-xs text-[#8B7355]/75">
              {panelSubtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#8B7355]">
          <span
            className={`h-2 w-2 rounded-full ${
              connectionState === 'connected' ? 'bg-[#3E8F62]' : 'bg-[#C28B42]'
            }`}
          />
          <span>{connectionLabel}</span>
        </div>
      </div>

      <div ref={scrollRef} className={messagesClassName}>
        {hasMore && (
          <button
            type="button"
            onClick={() => void loadHistory('more', nextBefore)}
            disabled={loadingMore}
            className="mx-auto mb-4 flex items-center gap-2 rounded-full border border-[#8B7355]/20 px-4 py-1.5 text-xs text-[#8B7355] transition hover:border-[#420047]/30 hover:text-[#420047] disabled:opacity-60"
          >
            <MaterialIcon name={loadingMore ? 'progress_activity' : 'expand_less'} className={`text-[15px] ${loadingMore ? 'animate-spin' : ''}`} />
            {loadingMore ? '翻阅中...' : '查看更早消息'}
          </button>
        )}

        {loading ? (
          <div className="flex h-[220px] items-center justify-center text-[#8B7355]">
            <MaterialIcon name="progress_activity" className="animate-spin text-2xl" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-[220px] flex-col items-center justify-center gap-3 text-center text-[#8B7355]">
            <MaterialIcon name="mode_comment" className="text-3xl text-[#8B7355]/50" />
            <p className="font-serif text-sm tracking-wide">茶盏刚温，还没有人落笔。</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`group max-w-[82%] ${message.isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                  <div className={`flex items-center gap-2 text-[11px] text-[#8B7355]/65 ${message.isOwn ? 'flex-row-reverse' : ''}`}>
                    <span>{message.isOwn ? '我' : message.sender.nickname || '同圈成员'}</span>
                    <span>{formatMessageTime(message.createdAt)}</span>
                  </div>

                  <div
                    className={`relative rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                      message.isOwn
                        ? 'bg-[#420047] text-[#FCFBF8]'
                        : 'border border-[#EAE7E1] bg-[#FCFBF8] text-[#2C2825]'
                    }`}
                  >
                    {message.deletedAt ? (
                      <span className={message.isOwn ? 'text-[#FCFBF8]/60' : 'text-[#8B7355]/60'}>该消息已删除</span>
                    ) : (
                      <span className="whitespace-pre-wrap break-words">{message.content}</span>
                    )}
                  </div>

                  <div className={`flex min-h-5 items-center gap-2 text-[11px] ${
                    message.isOwn ? 'flex-row-reverse text-[#8B7355]/70' : 'text-[#8B7355]/60'
                  }`}>
                    {message.deliveryStatus === 'sending' && <span>发送中</span>}
                    {message.deliveryStatus === 'failed' && <span className="text-[#B94A48]">{message.errorMessage || '发送失败'}</span>}
                    {message.isOwn && !message.deletedAt && !message.id.startsWith('pending-') && (
                      <button
                        type="button"
                        title="删除消息"
                        onClick={() => void handleDelete(message.id)}
                        className="opacity-0 transition group-hover:opacity-100 hover:text-[#B94A48]"
                      >
                        <MaterialIcon name="delete" className="text-[14px]" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-[#EAE7E1]/70 bg-[#FCFBF8]/85 px-4 py-3">
        <div className="flex items-end gap-3">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={500}
            rows={1}
            placeholder="写下圈内消息，Enter 发送，Shift+Enter 换行"
            className="min-h-11 flex-1 resize-none rounded-xl border border-[#EAE7E1] bg-white px-4 py-3 text-sm text-[#2C2825] outline-none transition placeholder:text-[#8B7355]/45 focus:border-[#420047]/35 focus:ring-2 focus:ring-[#420047]/8"
          />
          <button
            type="button"
            title="发送"
            onClick={() => void handleSend()}
            disabled={!draft.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#420047] text-[#FCFBF8] transition hover:bg-[#2A002D] disabled:cursor-not-allowed disabled:bg-[#8B7355]/30"
          >
            <MaterialIcon name="send" className="text-[20px]" />
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-[#8B7355]/65">
          <span>请勿在群聊中直接发送手机号、微信、邮箱等联系方式。</span>
          <span>{draft.length}/500</span>
        </div>
      </div>
    </section>
  );
}
