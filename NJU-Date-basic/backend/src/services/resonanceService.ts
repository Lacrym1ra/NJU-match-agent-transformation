import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { and, desc, eq, gt, isNull, ne, or } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { resonanceCapsules } from '../db/schema.js';
import {
  deriveResonanceState, normalizeInviteCode, redactResonanceCapsule,
  validateResonanceResponse,
} from '../modules/resonance/resonancePolicy.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors.js';

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function hashInviteCode(code: string) {
  return createHash('sha256').update(code, 'utf8').digest('hex');
}

function createInviteCode() {
  const bytes = randomBytes(8);
  return [...bytes].map((byte) => INVITE_ALPHABET[byte % INVITE_ALPHABET.length]).join('');
}

function normalizeText(value: string, field: string, max: number) {
  const normalized = value.trim();
  if (!normalized || normalized.length > max) {
    throw new ValidationError(`${field}应为 1–${max} 个字符`);
  }
  return normalized;
}

function toCapsuleDto(row: typeof resonanceCapsules.$inferSelect, userId: string) {
  let privacy;
  try {
    privacy = redactResonanceCapsule(row, userId);
  } catch {
    throw new ForbiddenError('无权查看该共鸣胶囊');
  }
  return {
    id: row.id,
    title: row.title,
    prompt: row.prompt,
    status: row.status,
    role: row.creatorId === userId ? 'creator' as const : 'participant' as const,
    hasParticipant: Boolean(row.participantId),
    expiresAt: row.expiresAt,
    revealedAt: row.revealedAt,
    createdAt: row.createdAt,
    ...privacy,
  };
}

async function getOwnedRow(userId: string, capsuleId: string) {
  const [row] = await db.select().from(resonanceCapsules).where(and(
    eq(resonanceCapsules.id, capsuleId),
    or(eq(resonanceCapsules.creatorId, userId), eq(resonanceCapsules.participantId, userId)),
  )).limit(1);
  if (!row) throw new NotFoundError('共鸣胶囊不存在');
  return row;
}

export async function createResonanceCapsule(
  userId: string,
  input: { title: string; prompt: string; expiresInDays?: number },
) {
  const inviteCode = createInviteCode();
  const now = new Date();
  const expiresInDays = Math.min(30, Math.max(1, input.expiresInDays ?? 7));
  const [row] = await db.insert(resonanceCapsules).values({
    id: randomUUID(),
    creatorId: userId,
    inviteCodeHash: hashInviteCode(inviteCode),
    title: normalizeText(input.title, '标题', 80),
    prompt: normalizeText(input.prompt, '问题', 500),
    status: 'awaiting_participant',
    expiresAt: new Date(now.getTime() + expiresInDays * 86_400_000).toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }).returning();
  return { capsule: toCapsuleDto(row!, userId), inviteCode };
}

export async function listResonanceCapsules(userId: string) {
  const rows = await db.select().from(resonanceCapsules).where(or(
    eq(resonanceCapsules.creatorId, userId),
    eq(resonanceCapsules.participantId, userId),
  )).orderBy(desc(resonanceCapsules.createdAt)).limit(50);
  return { capsules: rows.map((row) => toCapsuleDto(row, userId)) };
}

export async function getResonanceCapsule(userId: string, capsuleId: string) {
  return { capsule: toCapsuleDto(await getOwnedRow(userId, capsuleId), userId) };
}

export async function joinResonanceCapsule(userId: string, rawCode: string) {
  let code: string;
  try { code = normalizeInviteCode(rawCode); } catch (error) {
    throw new ValidationError((error as Error).message);
  }
  const now = new Date().toISOString();
  const rows = await db.update(resonanceCapsules).set({
    participantId: userId,
    status: 'collecting',
    updatedAt: now,
  }).where(and(
    eq(resonanceCapsules.inviteCodeHash, hashInviteCode(code)),
    isNull(resonanceCapsules.participantId),
    ne(resonanceCapsules.creatorId, userId),
    eq(resonanceCapsules.status, 'awaiting_participant'),
    gt(resonanceCapsules.expiresAt, now),
  )).returning();
  if (!rows[0]) throw new ConflictError('邀请码无效、已被使用或属于你自己');
  return { capsule: toCapsuleDto(rows[0], userId) };
}

export async function respondToResonanceCapsule(userId: string, capsuleId: string, rawResponse: string) {
  const row = await getOwnedRow(userId, capsuleId);
  if (!row.participantId) throw new ConflictError('请等待另一位参与者加入');
  if (row.status === 'cancelled' || row.status === 'revealed') {
    throw new ConflictError('该胶囊已结束，无法再次回应');
  }
  let response: string;
  try { response = validateResonanceResponse(rawResponse); } catch (error) {
    throw new ValidationError((error as Error).message);
  }
  const isCreator = row.creatorId === userId;
  const creatorResponse = isCreator ? response : row.creatorResponse;
  const participantResponse = isCreator ? row.participantResponse : response;
  const status = deriveResonanceState(creatorResponse, participantResponse, true);
  const now = new Date().toISOString();
  let [updated] = await db.update(resonanceCapsules).set({
    ...(isCreator ? { creatorResponse: response } : { participantResponse: response }),
    status,
    ...(status === 'revealed' ? { revealedAt: now } : {}),
    updatedAt: now,
  }).where(and(
    eq(resonanceCapsules.id, capsuleId),
    eq(resonanceCapsules.status, 'collecting'),
  )).returning();
  if (!updated) throw new ConflictError('胶囊状态已变化，请刷新后重试');
  // Returning includes the other participant's latest column value. A second
  // guarded update closes the simultaneous-submit race without exposing either
  // answer while only one side has responded.
  if (updated.creatorResponse && updated.participantResponse && updated.status === 'collecting') {
    const [revealed] = await db.update(resonanceCapsules).set({
      status: 'revealed', revealedAt: now, updatedAt: now,
    }).where(and(
      eq(resonanceCapsules.id, capsuleId), eq(resonanceCapsules.status, 'collecting'),
    )).returning();
    // A concurrent response may have completed the reveal first. Read that
    // winning state instead of reporting a false conflict to the second user.
    updated = revealed ?? await getOwnedRow(userId, capsuleId);
  }
  if (!updated) throw new ConflictError('胶囊状态已变化，请刷新后重试');
  return { capsule: toCapsuleDto(updated, userId) };
}

export async function cancelResonanceCapsule(userId: string, capsuleId: string) {
  const [updated] = await db.update(resonanceCapsules).set({
    status: 'cancelled', updatedAt: new Date().toISOString(),
  }).where(and(
    eq(resonanceCapsules.id, capsuleId),
    eq(resonanceCapsules.creatorId, userId),
    or(eq(resonanceCapsules.status, 'awaiting_participant'), eq(resonanceCapsules.status, 'collecting')),
  )).returning();
  if (!updated) throw new ConflictError('只有发起者可以取消进行中的胶囊');
  return { capsule: toCapsuleDto(updated, userId) };
}
