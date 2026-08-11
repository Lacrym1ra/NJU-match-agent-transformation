import { randomUUID } from 'node:crypto';
import {
  createComment, createPost, favoritePost, likePost, type CreatePostInput,
} from './forumService.js';
import { joinCircle } from './circleService.js';
import { sendCircleChatMessage, type ChatMessageDto } from '../modules/chat/circleChat.js';
import { ForbiddenError, NotFoundError } from '../utils/errors.js';
import { applyToTeamup, joinTeamupDirect } from '../modules/teamups/teamService.js';
import { sendTeamupChatMessage } from '../modules/chat/chatService.js';
import { recordAction } from './matchService.js';
import { markAllAsRead, markAsRead } from './notificationService.js';
import { createResonanceCapsule } from './resonanceService.js';
import { createMeetupSafetyPlan } from './meetupSafetyService.js';
import {
  completeStoredAgentAction, consumeStoredAgentAction, createStoredAgentAction,
  failStoredAgentAction, issueStoredAgentConfirmation, type AgentActionKind,
} from './agentActionStore.js';

export interface AgentPostDraft extends CreatePostInput {
  draftId: string;
  userId: string;
  createdAt: string;
}

export interface AgentLiveChatDraft {
  draftId: string;
  userId: string;
  circleId: string;
  content: string;
  mentions: string[];
  createdAt: string;
}

type ActionKind = 'publish_post' | 'join_circle' | 'send_circle_chat';
interface Confirmation {
  userId: string;
  kind: ActionKind;
  resourceId: string;
  expiresAt: number;
}

const DRAFT_TTL_MS = 30 * 60_000;
const MAX_DRAFTS_PER_USER = 10;
const MAX_DRAFTS_GLOBAL = 1_000;
const MAX_CONFIRMATIONS_GLOBAL = 2_000;

export interface AgentActionDependencies {
  publishPost(userId: string, input: CreatePostInput): Promise<{ postId: string; message: string }>;
  join(userId: string, circleId: string, applicationReason?: string): Promise<unknown>;
  sendCircleChat(userId: string, circleId: string, input: {
    clientMessageId: string; content: string; mentions?: string[];
  }): Promise<ChatMessageDto>;
  now(): number;
  id(): string;
}

export function createAgentActionService(deps: AgentActionDependencies) {
  const drafts = new Map<string, AgentPostDraft>();
  const confirmations = new Map<string, Confirmation>();
  const liveChatDrafts = new Map<string, AgentLiveChatDraft>();

  function prune() {
    const now = deps.now();
    for (const [id, draft] of drafts) {
      if (Date.parse(draft.createdAt) + DRAFT_TTL_MS < now) drafts.delete(id);
    }
    for (const [token, confirmation] of confirmations) {
      if (confirmation.expiresAt < now) confirmations.delete(token);
    }
    for (const [id, draft] of liveChatDrafts) {
      if (Date.parse(draft.createdAt) + DRAFT_TTL_MS < now) liveChatDrafts.delete(id);
    }
  }

  function removeOldestDraft(predicate: (draft: AgentPostDraft) => boolean) {
    const oldest = [...drafts.values()]
      .filter(predicate)
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))[0];
    if (oldest) drafts.delete(oldest.draftId);
  }

  function createDraft(userId: string, input: CreatePostInput): AgentPostDraft {
    prune();
    while ([...drafts.values()].filter((draft) => draft.userId === userId).length >= MAX_DRAFTS_PER_USER) {
      removeOldestDraft((draft) => draft.userId === userId);
    }
    while (drafts.size >= MAX_DRAFTS_GLOBAL) removeOldestDraft(() => true);
    const draft: AgentPostDraft = {
      ...input, draftId: deps.id(), userId, createdAt: new Date(deps.now()).toISOString(),
    };
    drafts.set(draft.draftId, draft);
    return draft;
  }

  function createLiveChatDraft(
    userId: string,
    input: { circleId: string; content: string; mentions?: string[] },
  ): AgentLiveChatDraft {
    prune();
    const owned = [...liveChatDrafts.values()]
      .filter((draft) => draft.userId === userId)
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    while (owned.length >= MAX_DRAFTS_PER_USER) {
      const oldest = owned.shift();
      if (oldest) liveChatDrafts.delete(oldest.draftId);
    }
    while (liveChatDrafts.size >= MAX_DRAFTS_GLOBAL) {
      const oldest = [...liveChatDrafts.values()]
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))[0];
      if (!oldest) break;
      liveChatDrafts.delete(oldest.draftId);
    }
    const draft: AgentLiveChatDraft = {
      draftId: deps.id(), userId, circleId: input.circleId,
      content: input.content, mentions: input.mentions ?? [],
      createdAt: new Date(deps.now()).toISOString(),
    };
    liveChatDrafts.set(draft.draftId, draft);
    return draft;
  }

  function requestConfirmation(userId: string, kind: ActionKind, resourceId: string) {
    prune();
    if (kind === 'publish_post') {
      const draft = drafts.get(resourceId);
      if (!draft || draft.userId !== userId) throw new NotFoundError('Draft not found');
    }
    while (confirmations.size >= MAX_CONFIRMATIONS_GLOBAL) {
      const oldestToken = confirmations.keys().next().value as string | undefined;
      if (!oldestToken) break;
      confirmations.delete(oldestToken);
    }
    if (kind === 'send_circle_chat') {
      const draft = liveChatDrafts.get(resourceId);
      if (!draft || draft.userId !== userId) throw new NotFoundError('LiveChat draft not found');
    }
    const confirmationToken = deps.id();
    confirmations.set(confirmationToken, {
      userId, kind, resourceId, expiresAt: deps.now() + 5 * 60_000,
    });
    return { confirmationToken, expiresAt: new Date(deps.now() + 5 * 60_000).toISOString() };
  }

  function consume(token: string, userId: string, kind: ActionKind, resourceId: string) {
    const record = confirmations.get(token);
    confirmations.delete(token);
    if (!record || record.expiresAt < deps.now() || record.userId !== userId ||
      record.kind !== kind || record.resourceId !== resourceId) {
      throw new ForbiddenError('Explicit confirmation is required');
    }
  }

  async function publishDraft(userId: string, draftId: string, token: string) {
    consume(token, userId, 'publish_post', draftId);
    const draft = drafts.get(draftId);
    if (!draft || draft.userId !== userId) throw new NotFoundError('Draft not found');
    const { draftId: _draftId, userId: _userId, createdAt: _createdAt, ...input } = draft;
    const result = await deps.publishPost(userId, input);
    drafts.delete(draftId);
    return result;
  }

  async function confirmJoin(userId: string, circleId: string, token: string, applicationReason?: string) {
    consume(token, userId, 'join_circle', circleId);
    return deps.join(userId, circleId, applicationReason);
  }

  async function sendLiveChatDraft(userId: string, draftId: string, token: string) {
    consume(token, userId, 'send_circle_chat', draftId);
    const draft = liveChatDrafts.get(draftId);
    if (!draft || draft.userId !== userId) throw new NotFoundError('LiveChat draft not found');
    const message = await deps.sendCircleChat(userId, draft.circleId, {
      clientMessageId: `agent:${draft.draftId}`,
      content: draft.content,
      mentions: draft.mentions,
    });
    liveChatDrafts.delete(draftId);
    return message;
  }

  return {
    createDraft, createLiveChatDraft, requestConfirmation,
    publishDraft, confirmJoin, sendLiveChatDraft,
  };
}

type ContactInput = { type: string; value: string; label?: string };

async function runStored<T>(
  record: Awaited<ReturnType<typeof consumeStoredAgentAction>>,
  operation: () => Promise<T>,
  sanitizeStoredResult: (result: T) => unknown = (result) => result,
) {
  try {
    const result = await operation();
    await completeStoredAgentAction(record.id, sanitizeStoredResult(result));
    return result;
  } catch (error) {
    await failStoredAgentAction(record.id, error);
    throw error;
  }
}

/** Production service: drafts and confirmations survive restarts and support multiple instances. */
export const agentActionService = {
  async createDraft(userId: string, input: CreatePostInput): Promise<AgentPostDraft> {
    const draftId = randomUUID();
    const createdAt = new Date().toISOString();
    await createStoredAgentAction(userId, 'publish_post', draftId, { ...input, createdAt }, draftId);
    return { ...input, draftId, userId, createdAt };
  },

  async createLiveChatDraft(
    userId: string,
    input: { circleId: string; content: string; mentions?: string[] },
  ): Promise<AgentLiveChatDraft> {
    const draftId = randomUUID();
    const createdAt = new Date().toISOString();
    const draft = { draftId, userId, circleId: input.circleId, content: input.content, mentions: input.mentions ?? [], createdAt };
    await createStoredAgentAction(userId, 'send_circle_chat', draftId, draft, draftId);
    return draft;
  },

  requestConfirmation(userId: string, kind: AgentActionKind, resourceId: string) {
    return issueStoredAgentConfirmation(userId, kind, resourceId);
  },

  async publishDraft(userId: string, draftId: string, token: string) {
    const record = await consumeStoredAgentAction(userId, 'publish_post', draftId, token);
    const { createdAt: _createdAt, ...input } = record.payload as unknown as CreatePostInput & { createdAt?: string };
    return runStored(record, () => createPost(userId, input));
  },

  async confirmJoin(userId: string, circleId: string, token: string, applicationReason?: string) {
    const record = await consumeStoredAgentAction(userId, 'join_circle', circleId, token);
    return runStored(record, () => joinCircle(
      circleId, userId, applicationReason ? { applicationReason } : {},
    ));
  },

  async sendLiveChatDraft(userId: string, draftId: string, token: string) {
    const record = await consumeStoredAgentAction(userId, 'send_circle_chat', draftId, token);
    const payload = record.payload as unknown as AgentLiveChatDraft;
    return runStored(record, () => sendCircleChatMessage(userId, payload.circleId, {
      clientMessageId: `agent:${record.id}`, content: payload.content, mentions: payload.mentions,
    }));
  },

  async createAction(userId: string, kind: Exclude<AgentActionKind, 'publish_post' | 'join_circle' | 'send_circle_chat'>, payload: Record<string, unknown>) {
    const actionId = randomUUID();
    const record = await createStoredAgentAction(userId, kind, actionId, payload, actionId);
    return { actionId: record.id, kind, expiresAt: record.expiresAt };
  },

  async executeAction(userId: string, actionId: string, kind: AgentActionKind, token: string) {
    const record = await consumeStoredAgentAction(userId, kind, actionId, token);
    const payload = record.payload as Record<string, any>;
    return runStored(record, async () => {
      switch (kind) {
        case 'comment_post':
          return createComment(userId, String(payload.postId), {
            content: String(payload.content),
            ...(payload.parentCommentId ? { parentCommentId: String(payload.parentCommentId) } : {}),
          });
        case 'like_post': return likePost(userId, String(payload.postId));
        case 'favorite_post': return favoritePost(userId, String(payload.postId));
        case 'join_teamup': return joinTeamupDirect(
          userId, String(payload.circleId), String(payload.teamupId), payload.contacts as ContactInput[],
        );
        case 'apply_teamup': return applyToTeamup(
          userId, String(payload.circleId), String(payload.teamupId),
          String(payload.applicationNote), payload.contacts as ContactInput[],
        );
        case 'send_teamup_chat': return sendTeamupChatMessage(
          userId, String(payload.circleId), String(payload.teamupId), {
            clientMessageId: `agent:${record.id}`, content: String(payload.content), mentions: [],
          },
        );
        case 'match_action': return recordAction(
          String(payload.matchId), userId, payload.action === 'REJECT' ? 'REJECT' : 'ACCEPT',
        );
        case 'mark_notification_read': return markAsRead(userId, String(payload.notificationId));
        case 'mark_all_notifications_read': return markAllAsRead(userId);
        case 'create_resonance_capsule': return createResonanceCapsule(userId, {
          title: String(payload.title), prompt: String(payload.prompt),
          expiresInDays: Number(payload.expiresInDays ?? 7),
        });
        case 'create_meetup_safety_plan': return createMeetupSafetyPlan(userId, {
          title: String(payload.title), meetingPlace: String(payload.meetingPlace),
          meetingAt: String(payload.meetingAt), expectedEndAt: String(payload.expectedEndAt),
          ...(payload.note ? { note: String(payload.note) } : {}),
        });
        default: throw new NotFoundError('Unsupported Agent action');
      }
    }, kind === 'create_resonance_capsule'
      ? (result) => {
        const value = result as { capsule?: unknown };
        return { capsule: value?.capsule, inviteCodeDeliveredToUser: true };
      }
      : (result) => result);
  },
};
