import { randomUUID } from 'node:crypto';
import { createPost, type CreatePostInput } from './forumService.js';
import { joinCircle } from './circleService.js';
import { ForbiddenError, NotFoundError } from '../utils/errors.js';

export interface AgentPostDraft extends CreatePostInput {
  draftId: string;
  userId: string;
  createdAt: string;
}

type ActionKind = 'publish_post' | 'join_circle';
interface Confirmation {
  userId: string;
  kind: ActionKind;
  resourceId: string;
  expiresAt: number;
}

export interface AgentActionDependencies {
  publishPost(userId: string, input: CreatePostInput): Promise<{ postId: string; message: string }>;
  join(userId: string, circleId: string, applicationReason?: string): Promise<unknown>;
  now(): number;
  id(): string;
}

export function createAgentActionService(deps: AgentActionDependencies) {
  const drafts = new Map<string, AgentPostDraft>();
  const confirmations = new Map<string, Confirmation>();

  function createDraft(userId: string, input: CreatePostInput): AgentPostDraft {
    const draft: AgentPostDraft = {
      ...input, draftId: deps.id(), userId, createdAt: new Date(deps.now()).toISOString(),
    };
    drafts.set(draft.draftId, draft);
    return draft;
  }

  function requestConfirmation(userId: string, kind: ActionKind, resourceId: string) {
    if (kind === 'publish_post') {
      const draft = drafts.get(resourceId);
      if (!draft || draft.userId !== userId) throw new NotFoundError('Draft not found');
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

  return { createDraft, requestConfirmation, publishDraft, confirmJoin };
}

export const agentActionService = createAgentActionService({
  publishPost: createPost,
  join: (userId, circleId, applicationReason) =>
    joinCircle(circleId, userId, applicationReason ? { applicationReason } : {}),
  now: Date.now,
  id: randomUUID,
});
