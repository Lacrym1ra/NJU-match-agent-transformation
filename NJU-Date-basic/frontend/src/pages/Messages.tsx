import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import MaterialIcon from '../components/MaterialIcon';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import ImageLightbox from '../components/forum/ImageLightbox';
import {
  getDirectMessageConversation,
  listDirectMessageConversations,
  recallDirectMessage,
  sendDirectMessage,
  type DirectMessage,
  type DirectMessageConversationDetailResponse,
  type DirectMessageConversationSummary,
  type SendDirectMessagePayload,
} from '../api/social';
import { ApiError } from '../api/client';
import { useMediaUpload } from '../shared/hooks/useMediaUpload';
import { getUploadedUrls, hasUploading, nextPreviewId } from '../components/common/ImageUploader';
import type { ImagePreview } from '../components/common/ImageUploader';
import VoiceRecorder from '../components/forum/VoiceRecorder';

const MESSAGE_LIMIT = 800;
const MESSAGE_TIME_GAP_MS = 5 * 60 * 1000;
const DIRECT_MESSAGE_POLL_INTERVAL_MS = 3000;
const DIRECT_MESSAGE_RECALL_WINDOW_MS = 2 * 60 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NON_MUTUAL_LIMIT_MESSAGE = '非互相关注状态下，在对方回复前最多发送3条私信';

function formatTime(value: string) {
  const date = new Date(value);
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatMessageTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return time;
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${time}`;
}

function shouldShowMessageTime(messages: DirectMessage[], index: number) {
  if (index === 0) return true;

  const currentTime = Date.parse(messages[index].createdAt);
  const previousTime = Date.parse(messages[index - 1].createdAt);
  if (!Number.isFinite(currentTime) || !Number.isFinite(previousTime)) return false;

  return currentTime - previousTime >= MESSAGE_TIME_GAP_MS;
}

function computePendingCount(messages: DirectMessage[], viewerUserId: string) {
  let count = 0;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].senderId !== viewerUserId) {
      break;
    }
    count += 1;
  }
  return count;
}

function getParticipantMessageState(messages: DirectMessage[], viewerUserId: string) {
  return messages.reduce(
    (state, message) => ({
      hasMine: state.hasMine || message.senderId === viewerUserId,
      hasTheirs: state.hasTheirs || message.senderId !== viewerUserId,
    }),
    { hasMine: false, hasTheirs: false },
  );
}

function canRecallMessage(message: DirectMessage, viewerUserId?: string | null) {
  if (!viewerUserId || message.senderId !== viewerUserId || message.recalledAt) return false;
  const createdAtMs = Date.parse(message.createdAt);
  return Number.isFinite(createdAtMs) && Date.now() - createdAtMs <= DIRECT_MESSAGE_RECALL_WINDOW_MS;
}

function isValidUuid(value: string) {
  return UUID_PATTERN.test(value);
}

function getPreviewText(message: DirectMessage): string {
  if (message.recalledAt) return '[已撤回]';
  if (message.messageType === 'image') return '[图片]';
  if (message.messageType === 'voice') return `[语音 ${message.voiceDurationSec ?? '?'}s]`;
  return message.content ?? '';
}

function mergeConversationDetail(
  previous: DirectMessageConversationDetailResponse | null,
  next: DirectMessageConversationDetailResponse,
) {
  if (!previous) return next;

  const messagesById = new Map<string, DirectMessage>();
  for (const message of previous.messages) {
    messagesById.set(message.id, message);
  }
  for (const message of next.messages) {
    messagesById.set(message.id, message);
  }

  return {
    ...next,
    messages: Array.from(messagesById.values()).sort((a, b) => {
      const aTime = Date.parse(a.createdAt);
      const bTime = Date.parse(b.createdAt);
      if (!Number.isFinite(aTime) || !Number.isFinite(bTime)) return 0;
      return aTime - bTime;
    }),
  };
}

function conversationTimeValue(conversation: DirectMessageConversationSummary) {
  const time = Date.parse(
    conversation.lastMessageAt
    || conversation.lastMessage?.createdAt
    || conversation.updatedAt
    || conversation.createdAt
    || '',
  );
  return Number.isFinite(time) ? time : 0;
}

function sortConversationsByRecent(conversations: DirectMessageConversationSummary[]) {
  return [...conversations].sort((a, b) => conversationTimeValue(b) - conversationTimeValue(a));
}

function resolveConversationTargetUserId(
  conversation: DirectMessageConversationSummary,
  viewerUserId?: string | null,
) {
  const participant = viewerUserId
    ? [conversation.userA, conversation.userB].find((item) => item?.userId && item.userId !== viewerUserId && isValidUuid(item.userId))
    : null;
  if (participant?.userId) {
    return participant.userId;
  }

  if (isValidUuid(conversation.partner.userId) && conversation.partner.userId !== viewerUserId) {
    return conversation.partner.userId;
  }

  const lastMessage = conversation.lastMessage;
  if (!lastMessage || !viewerUserId) {
    return null;
  }

  if (lastMessage.senderId === viewerUserId && isValidUuid(lastMessage.receiverId)) {
    return lastMessage.receiverId;
  }

  if (lastMessage.receiverId === viewerUserId && isValidUuid(lastMessage.senderId)) {
    return lastMessage.senderId;
  }

  return null;
}

interface MessagesProps {
  embedded?: boolean;
  embeddedUserId?: string | null;
  onClose?: () => void;
  onSelectConversation?: (userId: string) => void;
}

export default function Messages({
  embedded = false,
  embeddedUserId = null,
  onClose,
  onSelectConversation,
}: MessagesProps) {
  const navigate = useNavigate();
  const { userId: routeUserId } = useParams<{ userId?: string }>();
  const { user } = useAuth();
  const { error: toastError, success: toastSuccess } = useToast();
  const selectedUserId = useMemo(() => {
    const candidate = (embedded ? embeddedUserId : routeUserId)?.trim();
    if (!candidate || !isValidUuid(candidate)) {
      return null;
    }
    return candidate;
  }, [embedded, embeddedUserId, routeUserId]);

  const [conversations, setConversations] = useState<DirectMessageConversationSummary[]>([]);
  const [conversationDetail, setConversationDetail] = useState<DirectMessageConversationDetailResponse | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [images, setImages] = useState<ImagePreview[]>([]);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const { uploadImage: uploadImageFile, uploadVoice: uploadVoiceFile } = useMediaUpload('message');

  const messageListRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [recallMenu, setRecallMenu] = useState<{
    messageId: string;
    x: number;
    y: number;
  } | null>(null);

  // ── Derived: what kind of message is pending ────────────────────
  const hasImageContent = images.length > 0;
  const hasVoiceContent = voiceBlob !== null;
  const hasTextContent = draft.trim().length > 0;
  const hasImageUploadError = images.some((p) => !!p.error);
  const mixedMedia = (hasTextContent ? 1 : 0) + (hasImageContent ? 1 : 0) + (hasVoiceContent ? 1 : 0) > 1;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoadingList(true);
      try {
        const result = await listDirectMessageConversations();
        if (cancelled) return;

        setConversations(sortConversationsByRecent(result.conversations));
      } catch (err) {
        if (!cancelled) {
          toastError(err instanceof ApiError ? err.message : '加载会话列表失败');
        }
      } finally {
        if (!cancelled) {
          setLoadingList(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [toastError]);

  useEffect(() => {
    if (!recallMenu) return;
    const closeMenu = () => setRecallMenu(null);
    window.addEventListener('click', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, [recallMenu]);

  useEffect(() => {
    if (!selectedUserId) {
      setConversationDetail(null);
      setLoadingDetail(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoadingDetail(true);
      try {
        const result = await getDirectMessageConversation(selectedUserId);
        if (cancelled) return;

        setConversationDetail(result);
        setConversations((prev) => sortConversationsByRecent(prev.map((item) => (
          resolveConversationTargetUserId(item, user?.id) === selectedUserId
            ? { ...item, unreadCount: 0 }
            : item
        ))));
      } catch (err) {
        if (!cancelled) {
          toastError(err instanceof ApiError ? err.message : '加载会话失败');
        }
      } finally {
        if (!cancelled) {
          setLoadingDetail(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedUserId, toastError, user?.id]);

  useEffect(() => {
    if (!selectedUserId) return;

    let cancelled = false;
    let polling = false;

    const refreshConversation = async () => {
      if (polling) return;
      polling = true;
      try {
        const result = await getDirectMessageConversation(selectedUserId);
        if (cancelled) return;

        setConversationDetail((prev) => mergeConversationDetail(prev, result));
        setConversations((prev) => sortConversationsByRecent(prev.map((item) => {
          if (resolveConversationTargetUserId(item, user?.id) !== selectedUserId) {
            return item;
          }

          const lastMessage = result.messages[result.messages.length - 1] ?? item.lastMessage;
          return {
            ...item,
            relation: result.relation,
            unreadCount: 0,
            lastMessage,
            updatedAt: result.conversation?.updatedAt ?? item.updatedAt,
            lastMessageAt: result.conversation?.lastMessageAt ?? lastMessage?.createdAt ?? item.lastMessageAt,
          };
        })));
      } catch (err) {
        if (!cancelled) {
          console.warn('轮询私信会话失败', err);
        }
      } finally {
        polling = false;
      }
    };

    const timer = window.setInterval(() => {
      void refreshConversation();
    }, DIRECT_MESSAGE_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [selectedUserId, user?.id]);

  useEffect(() => {
    if (!messageListRef.current) return;
    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [conversationDetail?.messages.length, selectedUserId]);

  const selectedConversationSummary = useMemo(
    () => conversations.find((item) => resolveConversationTargetUserId(item, user?.id) === selectedUserId) ?? null,
    [conversations, selectedUserId, user?.id],
  );

  const currentLength = draft.length;
  const overLimit = currentLength > MESSAGE_LIMIT;

  const pendingCount = useMemo(() => {
    if (!conversationDetail || !user?.id) return 0;
    if (conversationDetail.relation.isMutual) return 0;
    return computePendingCount(conversationDetail.messages, user.id);
  }, [conversationDetail, user?.id]);

  const participantMessageState = useMemo(() => {
    if (!conversationDetail || !user?.id) return { hasMine: false, hasTheirs: false };
    return getParticipantMessageState(conversationDetail.messages, user.id);
  }, [conversationDetail, user?.id]);

  const hasTwoWayMessages = participantMessageState.hasMine && participantMessageState.hasTheirs;
  const isNonMutualOpeningPhase = !!conversationDetail
    && !conversationDetail.relation.isMutual
    && !hasTwoWayMessages;
  const isWaitingForTheirReply = isNonMutualOpeningPhase && !participantMessageState.hasTheirs;
  const isWaitingForMyReply = isNonMutualOpeningPhase
    && participantMessageState.hasTheirs
    && !participantMessageState.hasMine;
  const mediaBlockedBeforeReply = isWaitingForTheirReply;
  const mediaBlockedReason = mediaBlockedBeforeReply
    ? '非互相关注状态下，首次联系在对方回复前只能发送文字私信。'
    : null;

  const reachedNonMutualLimit = !!conversationDetail
    && isWaitingForTheirReply
    && pendingCount >= 3;
  const targetShieldReason = conversationDetail?.eligibility.blockState.blockedByMe
    ? '你已拉黑对方，将不再接收私信'
    : conversationDetail
      && (conversationDetail.eligibility.blockState.blockedByTarget || conversationDetail.eligibility.reason === 'privacy')
      ? '由于对方屏蔽设置，无法发送私信'
      : null;

  const blockedReason = reachedNonMutualLimit
    ? NON_MUTUAL_LIMIT_MESSAGE
    : conversationDetail?.eligibility.reason === 'limit'
      || conversationDetail?.eligibility.reason === 'privacy'
      || conversationDetail?.eligibility.blockState.blockedByTarget
      || conversationDetail?.eligibility.blockState.blockedByMe
      ? null
      : conversationDetail?.eligibility.message ?? null;

  const sendDisabled = !selectedUserId
    || sending
    || (!hasTextContent && !hasVoiceContent && !hasImageContent)
    || overLimit
    || (hasImageContent && hasUploading(images))
    || hasImageUploadError
    || mixedMedia
    || (mediaBlockedBeforeReply && (hasImageContent || hasVoiceContent))
    || !!targetShieldReason
    || !!blockedReason;

  const handleVoiceComplete = useCallback((blob: Blob, durationSec: number) => {
    setVoiceBlob(blob);
    setVoiceDuration(durationSec);
    if (hasTextContent) setDraft('');
    setImages([]);
  }, [hasTextContent]);

  const handleImageSelect = useCallback((fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    if (mediaBlockedBeforeReply) {
      toastError(mediaBlockedReason ?? '对方回复前仅支持文字私信');
      return;
    }
    if (voiceBlob) {
      toastError('单条私信只能包含一种内容类型，请先清除语音后再添加图片');
      return;
    }

    const remaining = Math.max(0, 9 - images.length);
    const files = Array.from(fileList).slice(0, remaining);
    if (files.length === 0) {
      toastError('单条私信最多发送 9 张图片');
      return;
    }

    files.forEach((file) => {
      if (!file.type.startsWith('image/')) {
        toastError('请选择图片文件');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toastError('图片不能超过 5MB');
        return;
      }

      const id = nextPreviewId();
      const previewUrl = URL.createObjectURL(file);
      setImages((prev) => [...prev, { id, file, previewUrl, uploading: true }]);

      void uploadImageFile(file)
        .then((result) => {
          setImages((prev) => prev.map((image) => (
            image.id === id
              ? { ...image, uploading: false, uploadedUrl: result.url }
              : image
          )));
        })
        .catch(() => {
          setImages((prev) => prev.map((image) => (
            image.id === id
              ? { ...image, uploading: false, error: '上传失败' }
              : image
          )));
        });
    });
  }, [images.length, mediaBlockedBeforeReply, mediaBlockedReason, toastError, uploadImageFile, voiceBlob]);

  const clearMediaInputs = useCallback(() => {
    setVoiceBlob(null);
    setVoiceDuration(0);
    setImages([]);
  }, []);

  const handleRemoveImage = useCallback((imageId: string) => {
    setImages((prev) => {
      const target = prev.find((image) => image.id === imageId);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((image) => image.id !== imageId);
    });
  }, []);

  const handleSelectConversation = (userId: string | null) => {
    if (!userId || !isValidUuid(userId)) {
      toastError('会话数据异常，请刷新后重试');
      return;
    }
    if (embedded && onSelectConversation) {
      onSelectConversation(userId);
      return;
    }
    navigate(`/messages/${userId}`);
  };

  const handleBack = () => {
    if (onClose) {
      onClose();
      return;
    }
    navigate(-1);
  };

  const handleMessageContextMenu = (event: React.MouseEvent, message: DirectMessage) => {
    if (!canRecallMessage(message, user?.id)) return;
    event.preventDefault();
    setRecallMenu({
      messageId: message.id,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const handleRecallMessage = async (messageId: string) => {
    setRecallMenu(null);
    try {
      const result = await recallDirectMessage(messageId);
      setConversationDetail((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: prev.messages.map((message) => (
            message.id === messageId ? result.directMessage : message
          )),
        };
      });
      setConversations((prev) => sortConversationsByRecent(prev.map((conversation) => (
        conversation.lastMessage?.id === messageId
          ? { ...conversation, lastMessage: result.directMessage }
          : conversation
      ))));
      toastSuccess('消息已撤回');
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : '撤回失败');
    }
  };

  const handleSend = async () => {
    if (!selectedUserId || !conversationDetail) return;
    if (overLimit) {
      toastError('单条私信内容不得超过 800 字');
      return;
    }
    if (mixedMedia) {
      toastError('单条私信只能包含一种内容类型');
      return;
    }
    if (mediaBlockedReason && (hasImageContent || hasVoiceContent)) {
      toastError(mediaBlockedReason);
      return;
    }
    if (targetShieldReason) {
      return;
    }
    if (blockedReason) {
      toastError(blockedReason);
      return;
    }

	    setSending(true);
	    try {
	      const sendResults: Array<Awaited<ReturnType<typeof sendDirectMessage>>> = [];
	
	      if (hasVoiceContent && voiceBlob) {
	        const voiceResult = await uploadVoiceFile(voiceBlob);
	        const payload: SendDirectMessagePayload = {
	          voiceUrl: voiceResult.url,
	          voiceDurationSec: voiceDuration,
	        };
	        sendResults.push(await sendDirectMessage(selectedUserId, payload));
	      } else if (hasImageContent) {
	        const imageUrls = getUploadedUrls(images);
	        for (const imageUrl of imageUrls) {
	          sendResults.push(await sendDirectMessage(selectedUserId, { imageUrls: [imageUrl] }));
	        }
	      } else {
	        const payload: SendDirectMessagePayload = { content: draft };
	        sendResults.push(await sendDirectMessage(selectedUserId, payload));
	      }
	
	      const result = sendResults[sendResults.length - 1];
	      if (!result) {
	        toastError('没有可发送的内容');
	        return;
	      }
	      setDraft('');
	      clearMediaInputs();
	      setConversationDetail((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          conversation: prev.conversation ?? {
            id: result.conversationId,
            createdAt: result.directMessage.createdAt,
            updatedAt: result.directMessage.createdAt,
            lastMessageAt: result.directMessage.createdAt,
          },
          eligibility: {
            ...prev.eligibility,
            canMessage: true,
            reason: null,
            message: null,
            conversationId: result.conversationId,
            consecutiveMessageCount: prev.relation.isMutual ? 0 : prev.eligibility.consecutiveMessageCount + 1,
            remainingMessagesBeforeReply: prev.relation.isMutual
              ? null
              : Math.max(0, (prev.eligibility.remainingMessagesBeforeReply ?? 3) - 1),
          },
	          messages: [...prev.messages, ...sendResults.map((item) => item.directMessage)],
	        };
	      });
      setConversations((prev) => {
        const next = [...prev];
        const idx = next.findIndex((item) => resolveConversationTargetUserId(item, user?.id) === selectedUserId);
        const updated: DirectMessageConversationSummary = {
          conversationId: result.conversationId,
          partner: result.targetUser,
          relation: conversationDetail.relation,
          unreadCount: 0,
          lastMessage: result.directMessage,
          createdAt: selectedConversationSummary?.createdAt ?? result.directMessage.createdAt,
          updatedAt: result.directMessage.createdAt,
          lastMessageAt: result.directMessage.createdAt,
        };
        if (idx >= 0) {
          next.splice(idx, 1);
        }
        next.unshift(updated);
        return next;
      });
      toastSuccess(result.message || '发送成功');
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : '发送失败，请稍后重试');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={embedded ? 'h-full min-h-0 p-2 text-[#2C2825] sm:p-4' : 'h-screen overflow-hidden bg-[#F7F3EE] p-4 text-[#2C2825] md:p-6'}>
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className={embedded ? 'mx-auto flex h-full min-h-0 max-w-7xl flex-col overflow-hidden rounded-[28px] border border-[#EAE7E1] bg-[#FCFBF8] shadow-[0_12px_36px_rgba(44,40,37,0.06)] lg:flex-row' : 'mx-auto flex h-[calc(100vh-2rem)] min-h-0 max-w-7xl flex-col overflow-hidden rounded-[28px] border border-[#EAE7E1] bg-[#FCFBF8] shadow-[0_12px_36px_rgba(44,40,37,0.06)] md:h-[calc(100vh-3rem)] lg:flex-row'}
      >
        <motion.aside
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, delay: 0.04, ease: 'easeOut' }}
          className="flex min-h-0 w-full shrink-0 flex-col overflow-hidden border-r border-[#E8DED8] bg-[#FCFBF8] lg:w-[340px]"
        >
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08, ease: 'easeOut' }}
            className="flex items-center border-b border-[#EFE6DF] px-6 py-5"
          >
            <button
              type="button"
              onClick={handleBack}
              className="flex shrink-0 items-center gap-1 text-sm text-[#8B7355] transition-colors hover:text-[#2C2825]"
            >
              <span className="text-lg leading-none">←</span>
              <span>返回上一页</span>
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.12, ease: 'easeOut' }}
            className="min-h-0 flex-1 overflow-y-auto"
          >
            {loadingList ? (
              <div className="flex h-full items-center justify-center text-sm text-[#8B7355]">
                <MaterialIcon name="sync" className="mr-2 animate-spin text-[16px]" />
                加载会话中...
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center text-[#8B7355]">
                <MaterialIcon name="chat_bubble_outline" className="mb-3 text-4xl opacity-50" />
                <p className="font-serif text-base">还没有私信会话</p>
                <p className="mt-2 text-sm text-[#8B7355]/70">去他人主页点击"发私信"，就会在这里出现。</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {conversations.map((conversation) => {
                  const targetUserId = resolveConversationTargetUserId(conversation, user?.id);
                  const active = selectedUserId === targetUserId;
                  return (
                    <button
                      key={conversation.conversationId}
                      type="button"
                      onClick={() => handleSelectConversation(targetUserId)}
                      className={`w-full border-l-2 px-4 py-4 text-left transition-colors ${
                        active
                          ? 'border-l-[#420047] bg-[#420047]/5'
                          : 'border-l-transparent hover:bg-[#F8F3EE]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#EDE5DD] font-serif text-lg text-[#420047]">
                          {conversation.partner.avatarUrl ? (
                            <img src={conversation.partner.avatarUrl} alt="avatar" className="h-full w-full rounded-full object-cover" />
                          ) : (
                            conversation.partner.nickname?.[0] ?? '?'
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3">
                            <div className="shrink-0 font-serif text-xl">
                              {conversation.partner.nickname || '未命名用户'}
                            </div>
                            <div className="min-w-0 flex-1 truncate text-base text-[#5C544E]">
                              {getPreviewText(conversation.lastMessage!) || '还没有消息'}
                            </div>
                            {conversation.unreadCount > 0 && (
                              <span className="shrink-0 inline-flex min-w-[22px] items-center justify-center rounded-full bg-[#420047] px-1.5 py-0.5 text-[11px] text-white">
                                {conversation.unreadCount}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-[11px] text-[#9A8E84]">
                            {conversation.lastMessageAt ? formatTime(conversation.lastMessageAt) : ''}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        </motion.aside>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08, ease: 'easeOut' }}
          className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#FCFBF8]"
        >
          {!selectedUserId ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center text-[#8B7355]">
              <MaterialIcon name="forum" className="mb-4 text-5xl opacity-50" />
              <p className="font-serif text-xl text-[#2C2825]">选择一个会话开始聊天</p>
              <p className="mt-2 text-sm text-[#8B7355]/70">你的私信会话列表会显示在左侧。</p>
            </div>
          ) : loadingDetail || !conversationDetail ? (
            <div className="flex flex-1 items-center justify-center text-sm text-[#8B7355]">
              <MaterialIcon name="sync" className="mr-2 animate-spin text-[16px]" />
              加载聊天中...
            </div>
          ) : (
            <>
              <div className="border-b border-[#EFE6DF] px-6 py-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EDE5DD] font-serif text-xl text-[#420047]">
                      {conversationDetail.partner.avatarUrl ? (
                        <img src={conversationDetail.partner.avatarUrl} alt="avatar" className="h-full w-full rounded-full object-cover" />
                      ) : (
                        conversationDetail.partner.nickname?.[0] ?? '?'
                      )}
                    </div>
                    <div>
                      <h2 className="font-serif text-2xl">{conversationDetail.partner.nickname || '未命名用户'}</h2>
                      <p className="mt-1 text-xs tracking-[0.18em] text-[#8B7355]">
                        {conversationDetail.relation.isMutual ? '互相关注' : conversationDetail.relation.isFollowing ? '已关注' : '未互关'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/user/${conversationDetail.partner.userId}`)}
                    className="rounded-full border border-[#E8DED8] px-4 py-2 text-sm text-[#8B7355] transition-colors hover:border-[#D9CBBE] hover:bg-[#F8F3EE] hover:text-[#2C2825]"
                  >
                    查看主页
                  </button>
                </div>

                {isWaitingForTheirReply && pendingCount > 0 && (
                  <p className="mt-4 text-sm text-[#8B7355]">
                    在对方回复前，你当前还可以连续发送 {Math.max(0, 3 - pendingCount)} 条文字私信。
                  </p>
                )}
                {isWaitingForMyReply && (
                  <p className="mt-4 text-sm text-[#8B7355]">
                    在你回复前，对方最多只能连续发送 3 条私信。
                  </p>
                )}
              </div>

              <div ref={messageListRef} className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-5 md:px-6">
                {conversationDetail.messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center text-[#8B7355]">
                    <MaterialIcon name="mark_chat_unread" className="mb-4 text-5xl opacity-40" />
                    <p className="font-serif text-lg text-[#2C2825]">这里还没有消息</p>
                    <p className="mt-2 max-w-md text-sm text-[#8B7355]/70">发送第一条私信，开启你们的对话吧。</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
	                    {conversationDetail.messages.map((message, index) => {
	                      const mine = message.senderId === user?.id;
	                      const isRecalled = !!message.recalledAt;
	                      const isImageMessage = !isRecalled && message.messageType === 'image' && message.imageUrls;
	                      return (
                        <React.Fragment key={message.id}>
                          {shouldShowMessageTime(conversationDetail.messages, index) && (
                            <div className="flex justify-center py-1">
                              <span className="rounded-full bg-[#EAE7E1]/70 px-3 py-1 text-[11px] text-[#8B7355]">
                                {formatMessageTime(message.createdAt)}
                              </span>
                            </div>
                          )}
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
	                            animate={{ opacity: 1, y: 0 }}
	                            className={`flex ${isRecalled ? 'justify-center' : mine ? 'justify-end' : 'justify-start'}`}
	                            onContextMenu={(event) => handleMessageContextMenu(event, message)}
	                          >
		                            <div
		                              className={
		                                isRecalled
		                                  ? 'max-w-[84%] overflow-hidden rounded-full bg-[#EAE7E1]/70 px-3 py-1 text-[#8B7355]'
		                                  : isImageMessage
		                                  ? 'max-w-[84%] overflow-hidden rounded-[18px] bg-transparent p-0'
		                                  : `max-w-[84%] overflow-hidden rounded-[18px] ${isImageMessage ? 'p-0' : 'px-4 py-3'} ${
		                                      mine
		                                        ? 'rounded-tr-sm bg-[#420047] text-[#FCFBF8]'
	                                        : 'rounded-tl-sm bg-[#F1F1F1] text-[#2C2825]'
	                                    }`
	                              }
	                            >
	                              {isRecalled ? (
	                                <div className="text-xs">
	                                  {mine ? '你撤回了一条消息' : '对方撤回了一条消息'}
	                                </div>
	                              ) : isImageMessage ? (
	                                <div className="flex flex-wrap gap-0">
	                                  {message.imageUrls.map((url, i) => (
	                                    <img
	                                      key={i}
		                                      src={url}
		                                      alt=""
		                                      className="block max-h-[260px] max-w-[280px] cursor-pointer object-cover transition-opacity hover:opacity-90"
		                                      onClick={() => setLightboxImageUrl(url)}
		                                    />
	                                  ))}
                                </div>
                              ) : message.messageType === 'voice' && message.voiceUrl ? (
                                <div className="flex items-center gap-2 min-w-[100px]">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const audio = new Audio(message.voiceUrl!);
                                      audio.play().catch(() => {});
                                    }}
                                    className="inline-flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                                  >
                                    <MaterialIcon name="play_circle" className="text-[22px]" />
                                    <span className="text-base tabular-nums">
                                      {message.voiceDurationSec ?? '?'}s
                                    </span>
                                  </button>
                                </div>
                              ) : (
	                                <div className="whitespace-pre-wrap break-words text-lg leading-relaxed">
	                                  {message.content}
	                                </div>
	                              )}
                            </div>
                          </motion.div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="shrink-0 border-t border-[#EAE7E1]/80 bg-[#FCFBF8] px-2 pb-2 pt-2 md:px-3 md:pb-3">
                <div className="mx-auto w-full rounded-[22px] border border-[#DCD6CF] bg-[#FCFBF8] px-4 py-4 shadow-[0_3px_12px_rgba(44,40,37,0.05)] md:px-5">
                {blockedReason && (
                  <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    {blockedReason}
                  </div>
                )}

                <ImageLightbox
                  open={!!lightboxImageUrl}
                  imageUrl={lightboxImageUrl}
                  onClose={() => setLightboxImageUrl(null)}
                />

                {mixedMedia && (
                  <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    单条私信只能包含一种内容类型，请清空后再发送
                  </div>
                )}

                {targetShieldReason ? (
                  <div className="flex min-h-[104px] items-center rounded-2xl bg-[#F3F1ED]/60 px-4 py-3 text-lg leading-relaxed text-[#8B7355]">
                    {targetShieldReason}
                  </div>
                ) : !hasVoiceContent && !hasImageContent && (
	                  <textarea
	                    value={draft}
	                    onChange={(event) => setDraft(event.target.value)}
	                    maxLength={MESSAGE_LIMIT + 50}
	                    rows={4}
	                    placeholder="输入你想说的话..."
	                    className="w-full resize-none bg-transparent text-lg leading-relaxed text-[#2C2825] outline-none placeholder:text-[#B7ADA4]"
		                    onKeyDown={(e) => {
		                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !(e.nativeEvent as KeyboardEvent).isComposing) {
		                        e.preventDefault();
		                        if (!sendDisabled) {
		                          void handleSend();
		                        }
		                      }
		                    }}
                  />
                )}

                {/* Voice state */}
                {hasVoiceContent && (
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex items-center gap-2 rounded-full bg-[#EAE7E1]/70 px-3 py-1.5 text-sm text-[#5E5855]">
                      <MaterialIcon name="mic" className="text-[16px] text-[#420047]" />
                      <span>语音已录制 ({voiceDuration}s)</span>
                    </div>
                    <button type="button" onClick={clearMediaInputs} className="text-xs text-[#8B7355] hover:text-red-500 transition-colors">
                      清除
                    </button>
                  </div>
                )}

		                {hasImageContent && (
		                  <div className="mb-3 flex flex-wrap items-center gap-3">
			                    {images.map((image) => (
			                      <div key={image.id} className="relative h-16 w-16 overflow-visible">
			                        <button
			                          type="button"
			                          onClick={() => {
			                            if (image.previewUrl) {
			                              setLightboxImageUrl(image.previewUrl);
			                            }
			                          }}
			                          disabled={!image.previewUrl}
			                          className={`h-full w-full overflow-hidden rounded-full border bg-[#F3F1ED] transition-opacity hover:opacity-90 disabled:cursor-default ${image.error ? 'border-red-300' : 'border-[#EAE7E1]'}`}
			                          aria-label="预览图片"
			                        >
			                          {image.previewUrl && (
			                            <img src={image.previewUrl} alt="" className="h-full w-full object-cover" />
			                          )}
			                          {image.uploading && (
			                            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-white/60">
			                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#420047] border-t-transparent" />
			                            </div>
			                          )}
			                        </button>
			                        <button
		                          type="button"
		                          onClick={() => handleRemoveImage(image.id)}
		                          className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#FCFBF8] text-[#8B7355] shadow-[0_2px_8px_rgba(44,40,37,0.16)] transition-colors hover:text-red-500"
		                          aria-label="删除图片"
		                        >
		                          <MaterialIcon name="close" className="text-[14px]" />
		                        </button>
		                      </div>
		                    ))}
		                    <button
		                      type="button"
		                      onClick={() => imageInputRef.current?.click()}
		                      disabled={sending || mediaBlockedBeforeReply || images.length >= 9}
		                      className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-[#D8CFC6] text-[#8B7355] transition-colors hover:border-[#420047]/40 hover:text-[#420047] disabled:cursor-not-allowed disabled:opacity-40"
		                      aria-label="继续添加图片"
		                    >
		                      <MaterialIcon name="add_photo_alternate" className="text-[24px]" />
		                    </button>
		                  </div>
		                )}

	                <input
	                  ref={imageInputRef}
	                  type="file"
	                  accept="image/jpeg,image/png,image/webp"
	                  multiple
	                  className="hidden"
	                  disabled={sending || mediaBlockedBeforeReply || !!targetShieldReason}
	                  onChange={(event) => {
	                    handleImageSelect(event.target.files);
	                    event.target.value = '';
	                  }}
	                />

	                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
	                  <div className="flex items-center gap-3">
		                    {!targetShieldReason && !hasTextContent && !hasVoiceContent && (
		                      <>
		                        <button
		                          type="button"
		                          onClick={() => imageInputRef.current?.click()}
		                          disabled={sending || mediaBlockedBeforeReply || images.length >= 9 || !!targetShieldReason}
		                          className="inline-flex items-center gap-1.5 text-sm text-[#8B7355] transition-colors hover:text-[#420047] disabled:cursor-not-allowed disabled:opacity-40"
		                        >
		                          <MaterialIcon name="image" className="text-[20px]" />
		                          <span>图片</span>
		                        </button>
		                        {!hasImageContent && (
		                          <VoiceRecorder
		                            onRecordingComplete={handleVoiceComplete}
		                            disabled={sending || mediaBlockedBeforeReply || !!targetShieldReason}
		                            label="语音"
		                            className="inline-flex items-center gap-1.5 text-sm text-[#8B7355] transition-colors hover:text-[#420047] disabled:cursor-not-allowed disabled:opacity-40"
		                            iconClassName="text-[20px] leading-none"
		                          />
		                        )}
		                      </>
		                    )}
                    {hasTextContent && (
                      <div className={`text-sm ${overLimit ? 'text-red-600' : 'text-[#8B7355]'}`}>
                        {currentLength}/{MESSAGE_LIMIT}
                      </div>
                    )}
		                    {targetShieldReason ? (
		                      <div className="text-[11px] text-[#8B7355]/50">当前无法发送私信</div>
		                    ) : mediaBlockedBeforeReply ? (
		                      <div className="text-[11px] text-[#8B7355]/50">对方回复前仅支持文字私信；Ctrl + Enter 快速发送</div>
		                    ) : hasTextContent || hasVoiceContent || hasImageContent ? (
		                      <div className="text-[11px] text-[#8B7355]/50">Ctrl + Enter 快速发送</div>
		                    ) : (
		                      <div className="text-[11px] text-[#8B7355]/50">文字、图片或语音，任选其一；Ctrl + Enter 快速发送</div>
		                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={sendDisabled}
                    className="shrink-0 rounded-xl bg-[#420047] px-5 py-2.5 text-sm tracking-widest text-[#FCFBF8] shadow-md transition-colors hover:bg-[#2A002D] disabled:cursor-not-allowed disabled:bg-[#EAE7E1] disabled:text-[#8B7355]/50"
                  >
                    {targetShieldReason ? '无法发送' : mixedMedia ? '多类型混合' : overLimit ? '超过 800 字' : reachedNonMutualLimit ? '已达上限' : sending ? '发送中...' : '发送'}
                  </button>
                </div>
                </div>
              </div>
            </>
          )}
        </motion.section>
        {recallMenu && (
          <div
            className="fixed z-[80] rounded-2xl border border-[#EAE7E1] bg-[#FCFBF8] p-1.5 shadow-[0_12px_30px_rgba(44,40,37,0.14)]"
            style={{
              left: Math.min(recallMenu.x, window.innerWidth - 96),
              top: Math.min(recallMenu.y, window.innerHeight - 56),
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => void handleRecallMessage(recallMenu.messageId)}
              className="rounded-xl px-4 py-2 text-sm font-medium text-[#420047] transition-colors hover:bg-[#420047]/10"
            >
              撤回
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
