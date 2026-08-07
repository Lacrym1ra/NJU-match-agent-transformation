import { createHash, randomUUID } from 'node:crypto';
import { and, desc, eq, gt, inArray, lt } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { agentActionRecords } from '../db/schema.js';
import { ForbiddenError, NotFoundError } from '../utils/errors.js';

export const AGENT_ACTION_KINDS = [
  'publish_post', 'join_circle', 'send_circle_chat', 'comment_post',
  'like_post', 'favorite_post', 'join_teamup', 'apply_teamup',
  'send_teamup_chat', 'match_action', 'mark_notification_read', 'mark_all_notifications_read',
] as const;

export type AgentActionKind = typeof AGENT_ACTION_KINDS[number];

const DRAFT_TTL_MS = 30 * 60_000;
const CONFIRMATION_TTL_MS = 5 * 60_000;

function hashToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function iso(ms: number) {
  return new Date(ms).toISOString();
}

export interface AgentStoredAction {
  id: string;
  userId: string;
  kind: AgentActionKind;
  resourceId: string;
  payload: Record<string, unknown>;
  expiresAt: string;
}

export async function createStoredAgentAction(
  userId: string,
  kind: AgentActionKind,
  resourceId: string,
  payload: Record<string, unknown>,
  requestedId = randomUUID(),
): Promise<AgentStoredAction> {
  const now = Date.now();
  await db.delete(agentActionRecords).where(and(
    eq(agentActionRecords.userId, userId),
    inArray(agentActionRecords.status, ['draft', 'confirmed']),
    lt(agentActionRecords.expiresAt, iso(now)),
  ));

  const [row] = await db.insert(agentActionRecords).values({
    id: requestedId,
    userId,
    kind,
    resourceId,
    payload,
    status: 'draft',
    expiresAt: iso(now + DRAFT_TTL_MS),
    createdAt: iso(now),
    updatedAt: iso(now),
  }).returning();
  return {
    id: row!.id, userId: row!.userId, kind: row!.kind as AgentActionKind,
    resourceId: row!.resourceId, payload: row!.payload as Record<string, unknown>,
    expiresAt: row!.expiresAt,
  };
}

async function findConfirmable(userId: string, kind: AgentActionKind, resourceId: string) {
  const rows = await db.select().from(agentActionRecords).where(and(
    eq(agentActionRecords.userId, userId),
    eq(agentActionRecords.kind, kind),
    eq(agentActionRecords.resourceId, resourceId),
    inArray(agentActionRecords.status, ['draft', 'confirmed']),
    gt(agentActionRecords.expiresAt, new Date().toISOString()),
  )).orderBy(desc(agentActionRecords.createdAt)).limit(1);
  return rows[0];
}

export async function issueStoredAgentConfirmation(
  userId: string,
  kind: AgentActionKind,
  resourceId: string,
) {
  let record = await findConfirmable(userId, kind, resourceId);
  if (!record && kind === 'join_circle') {
    await createStoredAgentAction(userId, kind, resourceId, {});
    record = await findConfirmable(userId, kind, resourceId);
  }
  if (!record) throw new NotFoundError('Agent action draft not found');

  const confirmationToken = randomUUID();
  const expiresAt = iso(Date.now() + CONFIRMATION_TTL_MS);
  await db.update(agentActionRecords).set({
    status: 'confirmed',
    confirmationTokenHash: hashToken(confirmationToken),
    confirmationExpiresAt: expiresAt,
    updatedAt: new Date().toISOString(),
  }).where(eq(agentActionRecords.id, record.id));
  return { confirmationToken, expiresAt };
}

export async function consumeStoredAgentAction(
  userId: string,
  kind: AgentActionKind,
  resourceId: string,
  confirmationToken: string,
): Promise<AgentStoredAction> {
  const now = new Date().toISOString();
  const rows = await db.update(agentActionRecords).set({
    status: 'consumed', consumedAt: now, updatedAt: now,
    confirmationTokenHash: null,
  }).where(and(
    eq(agentActionRecords.userId, userId),
    eq(agentActionRecords.kind, kind),
    eq(agentActionRecords.resourceId, resourceId),
    eq(agentActionRecords.status, 'confirmed'),
    eq(agentActionRecords.confirmationTokenHash, hashToken(confirmationToken)),
    gt(agentActionRecords.confirmationExpiresAt, now),
    gt(agentActionRecords.expiresAt, now),
  )).returning();
  const row = rows[0];
  if (!row) throw new ForbiddenError('Explicit confirmation is required');
  return {
    id: row.id, userId: row.userId, kind: row.kind as AgentActionKind,
    resourceId: row.resourceId, payload: row.payload as Record<string, unknown>,
    expiresAt: row.expiresAt,
  };
}

export async function completeStoredAgentAction(id: string, result: unknown) {
  await db.update(agentActionRecords).set({
    result: (result && typeof result === 'object' ? result : { value: result }) as Record<string, unknown>,
    updatedAt: new Date().toISOString(),
  }).where(eq(agentActionRecords.id, id));
}

export async function failStoredAgentAction(id: string, error: unknown) {
  const message = error instanceof Error ? error.message.slice(0, 500) : 'Action failed';
  await db.update(agentActionRecords).set({
    status: 'failed', result: { error: message }, updatedAt: new Date().toISOString(),
  }).where(eq(agentActionRecords.id, id));
}
