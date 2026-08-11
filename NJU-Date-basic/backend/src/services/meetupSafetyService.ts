import { randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { meetupSafetyPlans } from '../db/schema.js';
import {
  assertMeetupTransition, deriveMeetupStatus, validateMeetupWindow,
  type MeetupTransition, type StoredMeetupStatus,
} from '../modules/meetupSafety/meetupSafetyPolicy.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';

function normalizeText(value: string, field: string, max: number) {
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new ValidationError(`${field}应为 1–${max} 个字符`);
  return normalized;
}

function toMeetupDto(row: typeof meetupSafetyPlans.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    meetingPlace: row.meetingPlace,
    meetingAt: row.meetingAt,
    expectedEndAt: row.expectedEndAt,
    note: row.note,
    status: deriveMeetupStatus(row.status as StoredMeetupStatus, row.expectedEndAt),
    checkedInAt: row.checkedInAt,
    completedAt: row.completedAt,
    cancelledAt: row.cancelledAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function createMeetupSafetyPlan(userId: string, input: {
  title: string;
  meetingPlace: string;
  meetingAt: string;
  expectedEndAt: string;
  note?: string;
}) {
  let window;
  try { window = validateMeetupWindow(input.meetingAt, input.expectedEndAt); } catch (error) {
    throw new ValidationError((error as Error).message);
  }
  const now = new Date().toISOString();
  const [row] = await db.insert(meetupSafetyPlans).values({
    id: randomUUID(), userId,
    title: normalizeText(input.title, '计划标题', 100),
    meetingPlace: normalizeText(input.meetingPlace, '公共地点', 200),
    ...window,
    note: input.note?.trim().slice(0, 500) || null,
    status: 'scheduled', createdAt: now, updatedAt: now,
  }).returning();
  return { plan: toMeetupDto(row!) };
}

export async function listMeetupSafetyPlans(userId: string) {
  const rows = await db.select().from(meetupSafetyPlans)
    .where(eq(meetupSafetyPlans.userId, userId))
    .orderBy(desc(meetupSafetyPlans.meetingAt)).limit(50);
  return { plans: rows.map(toMeetupDto) };
}

export async function getMeetupSafetyPlan(userId: string, planId: string) {
  const [row] = await db.select().from(meetupSafetyPlans).where(and(
    eq(meetupSafetyPlans.id, planId), eq(meetupSafetyPlans.userId, userId),
  )).limit(1);
  if (!row) throw new NotFoundError('安心赴约计划不存在');
  return { plan: toMeetupDto(row) };
}

export async function transitionMeetupSafetyPlan(
  userId: string,
  planId: string,
  transition: MeetupTransition,
) {
  const { plan } = await getMeetupSafetyPlan(userId, planId);
  // `overdue` is a derived view of a persisted `scheduled` plan. State
  // transitions must compare against the stored value, not the view-only one.
  const storedStatus: StoredMeetupStatus = plan.status === 'overdue' ? 'scheduled' : plan.status;
  try { assertMeetupTransition(storedStatus, transition); } catch (error) {
    throw new ConflictError((error as Error).message);
  }
  const now = new Date().toISOString();
  const nextStatus: StoredMeetupStatus = transition === 'check_in'
    ? 'checked_in' : transition === 'complete' ? 'completed' : 'cancelled';
  const [updated] = await db.update(meetupSafetyPlans).set({
    status: nextStatus,
    ...(transition === 'check_in' ? { checkedInAt: now } : {}),
    ...(transition === 'complete' ? { completedAt: now } : {}),
    ...(transition === 'cancel' ? { cancelledAt: now } : {}),
    updatedAt: now,
  }).where(and(
    eq(meetupSafetyPlans.id, planId),
    eq(meetupSafetyPlans.userId, userId),
    eq(meetupSafetyPlans.status, storedStatus),
  )).returning();
  if (!updated) throw new ConflictError('计划状态已变化，请刷新后重试');
  return { plan: toMeetupDto(updated) };
}
