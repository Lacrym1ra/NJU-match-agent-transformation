import { v4 as uuid } from 'uuid';
import { and, desc, eq, gte, inArray, lte, or, sql } from 'drizzle-orm';
import { db } from '../../db/connection.js';
import {
  auditLogs,
  circleMembers,
  circles,
  contactUnlockGrants,
  contactUnlockRequests,
  globalFriendships,
  userCircleContacts,
  users,
} from '../../db/schema.js';
import { AppError, NotFoundError, ValidationError } from '../../utils/errors.js';
import {
  getAddressBookContactRequestCardSnapshot,
  getCircleContactRequestCardSnapshot,
  parseStoredCardSnapshot,
} from '../cards/index.js';
import { areUsersBlocked, areUsersGlobalFriends } from '../socialGraph/relationships.js';
import { CIRCLE_MEMBERSHIP_STATUS } from '../../utils/circleMembership.js';
import {
  G2_CIRCLE_REQUEST_COOLDOWN_POLICY,
  assertG2CircleRequestCooldown,
  getG2CircleRequestRejectWindowStart,
} from '../../services/g2CircleRequestCooldown.js';
import { createUserNotification } from '../../services/notificationService.js';
import {
  decryptG2ContactSecret,
  deleteG2ContactSecretById,
  inferG2ContactTypeFromFieldKey,
  maskG2ContactValue,
  parseG2StoredProfileContact,
  upsertG2ContactSecret,
  getG2ContactSecret,
} from '../../services/g2ContactSecretService.js';
import {
  CIRCLE_CONTACT_ALLOWED_FIELD_KEYS,
  CONTACT_PLATFORM_META,
  CONTACT_UNLOCK_CIRCLE_REQUEST_FIELD_KEY,
  CONTACT_UNLOCK_DEFAULT_FIELD_KEY,
  normalizeCircleContactFieldKey,
  normalizeCircleContactInput,
  normalizeCircleContactLabel,
  normalizeCircleContactValue,
  type CircleContactInput,
  type ContactUnlockAction,
  type ContactUnlockSourceType,
  type ContactUnlockState,
} from './contactFields.js';
export type { ContactUnlockState } from './contactFields.js';
const REQUEST_EXPIRES_AFTER_DAYS = 7;

export interface FriendContactAvailability {
  status: ContactUnlockState;
  circleId?: string;
  sourceType?: ContactUnlockSourceType;
  fieldKey?: string;
  hasUnlockedContacts: boolean;
}

function addDaysIso(value: Date, days: number) {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function isExpired(expiresAt?: string | null, now = Date.now()) {
  const time = Date.parse(expiresAt ?? '');
  return Number.isFinite(time) && time <= now;
}

type CircleContactDedupInput = {
  fieldKey: string;
  label: string;
  value?: string | null;
  contactSecretId?: string | null;
};

function normalizeCircleContactDedupPart(value: string | null | undefined) {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function getContactModuleDedupKey(contact: { fieldKey?: string; label: string; value: string }) {
  const label = normalizeCircleContactDedupPart(contact.label || contact.fieldKey);
  const value = normalizeCircleContactDedupPart(contact.value);
  return `${label}:${value}`;
}

function dedupeContactModules<T extends { fieldKey?: string; label: string; value: string }>(contacts: T[]) {
  const seen = new Set<string>();
  return contacts.filter((contact) => {
    const key = getContactModuleDedupKey(contact);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function getCircleContactDedupKey(contact: CircleContactDedupInput, client: any = db) {
  const value = await resolveCircleContactValue(contact, client);
  return getContactModuleDedupKey({
    fieldKey: contact.fieldKey,
    label: contact.label,
    value,
  });
}

async function dedupeCircleContactRowsByValue<T extends CircleContactDedupInput>(contacts: T[], client: any = db) {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const contact of contacts) {
    const key = await getCircleContactDedupKey(contact, client);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(contact);
  }
  return result;
}

function parseStoredContact(value: string | null | undefined) {
  if (!value) return null;

  if (!value.includes(':')) {
    return {
      platform: 'wechat',
      contactId: value,
    };
  }

  const [platform, ...rest] = value.split(':');
  const contactId = rest.join(':');
  if (!contactId) return null;

  return {
    platform: platform || 'wechat',
    contactId,
  };
}

async function ensureUserExists(userId: string) {
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!rows[0]) throw new NotFoundError('用户不存在');
}

async function ensureUsersShareCircle(circleId: string, userId: string, targetUserId: string, client: any = db) {
  const rows: Array<{ userId: string }> = await client.select({ userId: circleMembers.userId }).from(circleMembers)
    .where(and(
      eq(circleMembers.circleId, circleId),
      inArray(circleMembers.userId, [userId, targetUserId]),
      eq(circleMembers.membershipStatus, CIRCLE_MEMBERSHIP_STATUS.ACTIVE),
      eq(circleMembers.isActive, true),
    ))
    .limit(2);

  const userIds = new Set(rows.map((row) => row.userId));
  if (!userIds.has(userId) || !userIds.has(targetUserId)) {
    throw new AppError(403, 'NOT_IN_TARGET_CIRCLE', '不在同一圈子中，无法从该圈发起联系方式申请');
  }
}

async function getCircleName(circleId: string | null | undefined, client: any = db) {
  if (!circleId) return null;
  const rows = await client.select({ name: circles.name }).from(circles)
    .where(eq(circles.id, circleId))
    .limit(1);
  return rows[0]?.name ?? null;
}

async function expirePendingContactUnlocksForUser(userId: string) {
  const now = new Date().toISOString();
  await db.update(contactUnlockRequests)
    .set({ status: 'expired', updatedAt: now })
    .where(and(
      eq(contactUnlockRequests.status, 'pending'),
      lte(contactUnlockRequests.expiresAt, now),
      or(eq(contactUnlockRequests.requesterId, userId), eq(contactUnlockRequests.targetId, userId)),
    ));
}

async function expirePendingContactUnlocksForTargets(requesterId: string, targetUserIds: string[]) {
  if (targetUserIds.length === 0) return;
  const now = new Date().toISOString();
  await db.update(contactUnlockRequests)
    .set({ status: 'expired', updatedAt: now })
    .where(and(
      eq(contactUnlockRequests.requesterId, requesterId),
      inArray(contactUnlockRequests.targetId, targetUserIds),
      eq(contactUnlockRequests.status, 'pending'),
      lte(contactUnlockRequests.expiresAt, now),
    ));
}

async function expirePendingContactUnlockForScope(
  requesterId: string,
  targetUserId: string,
  sourceType: ContactUnlockSourceType,
  circleId?: string | null,
  client: any = db,
) {
  const now = new Date().toISOString();
  const scope = sourceType === 'circle'
    ? and(
        eq(contactUnlockRequests.sourceType, 'circle'),
        eq(contactUnlockRequests.circleId, circleId ?? ''),
      )
    : eq(contactUnlockRequests.sourceType, 'address_book');

  await client.update(contactUnlockRequests)
    .set({ status: 'expired', updatedAt: now })
    .where(and(
      eq(contactUnlockRequests.requesterId, requesterId),
      eq(contactUnlockRequests.targetId, targetUserId),
      eq(contactUnlockRequests.status, 'pending'),
      lte(contactUnlockRequests.expiresAt, now),
      scope,
    ));
}

async function expireLockedContactUnlockIfNeeded(client: any, request: typeof contactUnlockRequests.$inferSelect) {
  if (!isExpired(request.expiresAt)) return false;

  const now = new Date().toISOString();
  await client.update(contactUnlockRequests)
    .set({ status: 'expired', updatedAt: now })
    .where(eq(contactUnlockRequests.id, request.id));
  return true;
}

function throwContactUnlockExpired(): never {
  throw new AppError(409, 'REQUEST_EXPIRED', '联系方式交换申请已过期，请重新发送');
}

async function lockContactUnlockScope(
  client: any,
  requesterId: string,
  targetUserId: string,
  sourceType: ContactUnlockSourceType,
  circleId?: string | null,
) {
  const scope = sourceType === 'circle'
    ? `circle:${requesterId}:${targetUserId}:${circleId ?? ''}`
    : `address_book:${requesterId}:${targetUserId}`;
  await client.execute(sql`
    SELECT pg_advisory_xact_lock(
      hashtext('g2_contact_unlock_pending'),
      hashtext(${scope})
    )
  `);
}

async function getCircleContactSecret(row: typeof userCircleContacts.$inferSelect, client: any = db) {
  return getG2ContactSecret(client, row.contactSecretId);
}

async function getCircleContactPlainValue(row: typeof userCircleContacts.$inferSelect, client: any = db) {
  const secret = await getCircleContactSecret(row, client);
  if (secret) return decryptG2ContactSecret(secret);
  return row.value ?? '';
}

async function getCircleContactMaskedValue(row: typeof userCircleContacts.$inferSelect, client: any = db) {
  const secret = await getCircleContactSecret(row, client);
  if (secret) return secret.maskedValue;
  if (!row.value) return '';
  return maskG2ContactValue(inferG2ContactTypeFromFieldKey(row.fieldKey, row.label), row.value);
}

async function resolveCircleContactValue(
  contact: { contactSecretId?: string | null; value?: string | null; fieldKey: string; label: string },
  client: any = db,
) {
  const secret = await getG2ContactSecret(client, contact.contactSecretId);
  if (secret) return decryptG2ContactSecret(secret);
  return contact.value ?? '';
}

async function serializeCircleContact(row: typeof userCircleContacts.$inferSelect, client: any = db) {
  const [value, maskedValue] = await Promise.all([
    getCircleContactPlainValue(row, client),
    getCircleContactMaskedValue(row, client),
  ]);
  return {
    id: row.id,
    circleId: row.circleId,
    fieldKey: row.fieldKey,
    label: row.label,
    value,
    maskedValue,
    hasValue: Boolean(value),
    isEnabled: row.isEnabled,
    displayOrder: row.displayOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function ensureCircleMember(userId: string, circleId: string, client: any = db) {
  const rows: Array<{ userId: string }> = await client.select({ userId: circleMembers.userId }).from(circleMembers)
    .where(and(
      eq(circleMembers.circleId, circleId),
      eq(circleMembers.userId, userId),
      eq(circleMembers.membershipStatus, CIRCLE_MEMBERSHIP_STATUS.ACTIVE),
      eq(circleMembers.isActive, true),
    ))
    .limit(1);

  if (!rows[0]) {
    throw new AppError(403, 'NOT_CIRCLE_MEMBER', '需要先加入该兴趣圈');
  }
}

async function ensureDefaultCircleContactFromProfile(userId: string, circleId: string, client: any = db) {
  const userRows: Array<{ wechatId: string | null }> = await client.select({ wechatId: users.wechatId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const parsedContact = parseG2StoredProfileContact(userRows[0]?.wechatId);
  if (!parsedContact) return;

  const meta = CONTACT_PLATFORM_META[parsedContact.contactType] ?? {
    moduleKey: `contact_${parsedContact.contactType}`,
    label: parsedContact.contactType,
  };
  if (!CIRCLE_CONTACT_ALLOWED_FIELD_KEYS.has(meta.moduleKey)) return;

  await upsertG2ContactSecret(client, {
    ownerUserId: userId,
    scopeType: 'profile_seed',
    scopeId: userId,
    fieldKey: meta.moduleKey,
    contactType: parsedContact.contactType,
    label: meta.label,
    value: parsedContact.value,
  });

  const existingRows: Array<{ id: string; contactSecretId: string | null }> = await client.select({
    id: userCircleContacts.id,
    contactSecretId: userCircleContacts.contactSecretId,
  })
    .from(userCircleContacts)
    .where(and(
      eq(userCircleContacts.userId, userId),
      eq(userCircleContacts.circleId, circleId),
      eq(userCircleContacts.fieldKey, meta.moduleKey),
    ))
    .limit(1);
  if (existingRows[0]) {
    if (!existingRows[0].contactSecretId) {
      const now = new Date().toISOString();
      const secret = await upsertG2ContactSecret(client, {
        ownerUserId: userId,
        scopeType: 'circle_contact',
        scopeId: existingRows[0].id,
        fieldKey: meta.moduleKey,
        contactType: parsedContact.contactType,
        label: meta.label,
        value: parsedContact.value,
        now,
      });
      await client.update(userCircleContacts)
        .set({ value: null, contactSecretId: secret.id, updatedAt: now })
        .where(eq(userCircleContacts.id, existingRows[0].id));
    }
    return;
  }

  const now = new Date().toISOString();
  const contactId = uuid();
  const secret = await upsertG2ContactSecret(client, {
    ownerUserId: userId,
    scopeType: 'circle_contact',
    scopeId: contactId,
    fieldKey: meta.moduleKey,
    contactType: parsedContact.contactType,
    label: meta.label,
    value: parsedContact.value,
    now,
  });

  await client.insert(userCircleContacts).values({
    id: contactId,
    userId,
    circleId,
    fieldKey: meta.moduleKey,
    label: meta.label,
    value: null,
    contactSecretId: secret.id,
    isEnabled: true,
    displayOrder: 0,
    createdAt: now,
    updatedAt: now,
  });
}

async function hasApprovedContactUnlock(requesterId: string, targetUserId: string, fieldKey?: string | null) {
  const rows = await db.select({
    id: contactUnlockRequests.id,
    circleId: contactUnlockRequests.circleId,
    sourceType: contactUnlockRequests.sourceType,
    fieldKey: contactUnlockRequests.fieldKey,
  }).from(contactUnlockRequests)
    .where(fieldKey
      ? and(
          eq(contactUnlockRequests.requesterId, requesterId),
          eq(contactUnlockRequests.targetId, targetUserId),
          eq(contactUnlockRequests.sourceType, 'address_book'),
          eq(contactUnlockRequests.fieldKey, fieldKey),
          eq(contactUnlockRequests.status, 'approved'),
        )
      : and(
          eq(contactUnlockRequests.requesterId, requesterId),
          eq(contactUnlockRequests.targetId, targetUserId),
          eq(contactUnlockRequests.sourceType, 'address_book'),
          eq(contactUnlockRequests.status, 'approved'),
        ))
    .orderBy(desc(contactUnlockRequests.updatedAt), desc(contactUnlockRequests.createdAt));

  return rows;
}

async function getActiveCircleContactGrants(requesterId: string, targetUserId: string, circleId: string) {
  return db.select({
    contactId: contactUnlockGrants.contactId,
    fieldKey: userCircleContacts.fieldKey,
    label: userCircleContacts.label,
    value: userCircleContacts.value,
    contactSecretId: userCircleContacts.contactSecretId,
  }).from(contactUnlockGrants)
    .innerJoin(userCircleContacts, eq(contactUnlockGrants.contactId, userCircleContacts.id))
    .where(and(
      eq(contactUnlockGrants.requesterId, requesterId),
      eq(contactUnlockGrants.targetId, targetUserId),
      eq(contactUnlockGrants.circleId, circleId),
      eq(contactUnlockGrants.status, 'active'),
      eq(userCircleContacts.isEnabled, true),
    ))
    .orderBy(userCircleContacts.displayOrder, userCircleContacts.createdAt);
}

async function getActiveCircleContactGrantsForTarget(requesterId: string, targetUserId: string) {
  return db.select({
    contactId: contactUnlockGrants.contactId,
    circleId: contactUnlockGrants.circleId,
    fieldKey: userCircleContacts.fieldKey,
    label: userCircleContacts.label,
    value: userCircleContacts.value,
    contactSecretId: userCircleContacts.contactSecretId,
    displayOrder: userCircleContacts.displayOrder,
    createdAt: userCircleContacts.createdAt,
  }).from(contactUnlockGrants)
    .innerJoin(userCircleContacts, eq(contactUnlockGrants.contactId, userCircleContacts.id))
    .where(and(
      eq(contactUnlockGrants.requesterId, requesterId),
      eq(contactUnlockGrants.targetId, targetUserId),
      eq(contactUnlockGrants.status, 'active'),
      eq(userCircleContacts.isEnabled, true),
    ))
    .orderBy(contactUnlockGrants.circleId, userCircleContacts.displayOrder, userCircleContacts.createdAt);
}

async function getEnabledCircleContactsForUser(userId: string, circleId: string, client: any = db) {
  return client.select().from(userCircleContacts)
    .where(and(
      eq(userCircleContacts.userId, userId),
      eq(userCircleContacts.circleId, circleId),
      eq(userCircleContacts.isEnabled, true),
    ))
    .orderBy(userCircleContacts.displayOrder, userCircleContacts.createdAt);
}

async function getPendingContactUnlock(requesterId: string, targetUserId: string, fieldKey?: string | null) {
  const rows = await db.select({
    id: contactUnlockRequests.id,
    circleId: contactUnlockRequests.circleId,
    sourceType: contactUnlockRequests.sourceType,
    fieldKey: contactUnlockRequests.fieldKey,
  }).from(contactUnlockRequests)
    .where(fieldKey
      ? and(
          eq(contactUnlockRequests.requesterId, requesterId),
          eq(contactUnlockRequests.targetId, targetUserId),
          eq(contactUnlockRequests.fieldKey, fieldKey),
          eq(contactUnlockRequests.status, 'pending'),
        )
      : and(
          eq(contactUnlockRequests.requesterId, requesterId),
          eq(contactUnlockRequests.targetId, targetUserId),
          eq(contactUnlockRequests.status, 'pending'),
        ))
    .orderBy(desc(contactUnlockRequests.updatedAt), desc(contactUnlockRequests.createdAt))
    .limit(1);

  return rows[0] ?? null;
}

async function getPendingAddressBookContactUnlock(requesterId: string, targetUserId: string, client: any = db) {
  const rows = await client.select({
    id: contactUnlockRequests.id,
    circleId: contactUnlockRequests.circleId,
    sourceType: contactUnlockRequests.sourceType,
    fieldKey: contactUnlockRequests.fieldKey,
  }).from(contactUnlockRequests)
    .where(and(
      eq(contactUnlockRequests.requesterId, requesterId),
      eq(contactUnlockRequests.targetId, targetUserId),
      eq(contactUnlockRequests.sourceType, 'address_book'),
      eq(contactUnlockRequests.status, 'pending'),
    ))
    .orderBy(desc(contactUnlockRequests.updatedAt), desc(contactUnlockRequests.createdAt))
    .limit(1);

  return rows[0] ?? null;
}

async function getPendingCircleContactUnlock(requesterId: string, targetUserId: string, circleId: string, client: any = db) {
  const rows = await client.select({
    id: contactUnlockRequests.id,
    circleId: contactUnlockRequests.circleId,
    sourceType: contactUnlockRequests.sourceType,
    fieldKey: contactUnlockRequests.fieldKey,
  }).from(contactUnlockRequests)
    .where(and(
      eq(contactUnlockRequests.requesterId, requesterId),
      eq(contactUnlockRequests.targetId, targetUserId),
      eq(contactUnlockRequests.circleId, circleId),
      eq(contactUnlockRequests.sourceType, 'circle'),
      eq(contactUnlockRequests.status, 'pending'),
    ))
    .orderBy(desc(contactUnlockRequests.updatedAt), desc(contactUnlockRequests.createdAt))
    .limit(1);

  return rows[0] ?? null;
}

async function assertCircleContactUnlockRejectCooldown(
  requesterId: string,
  targetUserId: string,
  fieldKey: string,
) {
  const windowStart = getG2CircleRequestRejectWindowStart();
  const rejectedRows = await db.select({
    createdAt: contactUnlockRequests.createdAt,
    updatedAt: contactUnlockRequests.updatedAt,
  }).from(contactUnlockRequests)
    .where(and(
      eq(contactUnlockRequests.requesterId, requesterId),
      eq(contactUnlockRequests.targetId, targetUserId),
      eq(contactUnlockRequests.sourceType, 'circle'),
      eq(contactUnlockRequests.fieldKey, fieldKey),
      eq(contactUnlockRequests.status, 'rejected'),
      gte(contactUnlockRequests.updatedAt, windowStart),
    ))
    .orderBy(desc(contactUnlockRequests.updatedAt))
    .limit(G2_CIRCLE_REQUEST_COOLDOWN_POLICY.rejectLimit);

  assertG2CircleRequestCooldown(
    rejectedRows,
    '该联系方式字段被拒绝次数较多，请稍后再试',
  );
}

async function buildContactRequestFallbackPreview(
  requesterId: string,
  targetUserId: string,
  sourceType: ContactUnlockSourceType,
  circleId?: string | null,
) {
  if (sourceType === 'circle' && circleId) {
    try {
      return await getCircleContactRequestCardSnapshot(requesterId, targetUserId, circleId);
    } catch {
      // Old requests may lack stored snapshots after the source circle context changed.
    }
  }
  return getAddressBookContactRequestCardSnapshot(requesterId, targetUserId);
}

export async function deleteContactUnlockRecordsBetweenUsers(userId: string, targetUserId: string, client: any = db) {
  const deletedRows = await client.delete(contactUnlockRequests)
    .where(or(
      and(eq(contactUnlockRequests.requesterId, userId), eq(contactUnlockRequests.targetId, targetUserId)),
      and(eq(contactUnlockRequests.requesterId, targetUserId), eq(contactUnlockRequests.targetId, userId)),
    ))
    .returning({ id: contactUnlockRequests.id });

  return deletedRows.length;
}

export async function listMyCircleContacts(userId: string, circleId: string) {
  await ensureCircleMember(userId, circleId);
  await ensureDefaultCircleContactFromProfile(userId, circleId);

  const rows = await db.select().from(userCircleContacts)
    .where(and(
      eq(userCircleContacts.userId, userId),
      eq(userCircleContacts.circleId, circleId),
    ))
    .orderBy(userCircleContacts.displayOrder, userCircleContacts.createdAt);

  return { contacts: await Promise.all(rows.map((row) => serializeCircleContact(row))) };
}

export async function upsertMyCircleContact(userId: string, circleId: string, input: CircleContactInput) {
  await ensureCircleMember(userId, circleId);
  const contact = normalizeCircleContactInput(input);
  const now = new Date().toISOString();

  return db.transaction(async (tx) => {
    const existingRows = await tx.select({
      id: userCircleContacts.id,
      contactSecretId: userCircleContacts.contactSecretId,
      fieldKey: userCircleContacts.fieldKey,
      isEnabled: userCircleContacts.isEnabled,
      displayOrder: userCircleContacts.displayOrder,
    }).from(userCircleContacts)
      .where(and(
        eq(userCircleContacts.userId, userId),
        eq(userCircleContacts.circleId, circleId),
        eq(userCircleContacts.fieldKey, contact.fieldKey),
      ))
      .limit(1);

    const contactId = existingRows[0]?.id ?? uuid();
    const secret = await upsertG2ContactSecret(tx, {
      ownerUserId: userId,
      scopeType: 'circle_contact',
      scopeId: contactId,
      fieldKey: contact.fieldKey,
      contactType: inferG2ContactTypeFromFieldKey(contact.fieldKey, contact.label),
      label: contact.label,
      value: contact.value,
      now,
    });

    if (existingRows[0]) {
      const rows = await tx.update(userCircleContacts)
        .set({
          label: contact.label,
          value: null,
          contactSecretId: secret.id,
          isEnabled: contact.isEnabled,
          displayOrder: contact.displayOrder,
          updatedAt: now,
        })
        .where(eq(userCircleContacts.id, existingRows[0].id))
        .returning();
      if (existingRows[0].contactSecretId && existingRows[0].contactSecretId !== secret.id) {
        await deleteG2ContactSecretById(tx, existingRows[0].contactSecretId);
      }
      await tx.insert(auditLogs).values({
        operatorId: userId,
        action: 'circle_contact_updated',
        target: circleId,
        detail: JSON.stringify({
          contactId,
          circleId,
          fieldKey: existingRows[0].fieldKey === contact.fieldKey
            ? contact.fieldKey
            : { from: existingRows[0].fieldKey, to: contact.fieldKey },
          isEnabled: existingRows[0].isEnabled === contact.isEnabled
            ? contact.isEnabled
            : { from: existingRows[0].isEnabled, to: contact.isEnabled },
          displayOrder: existingRows[0].displayOrder === contact.displayOrder
            ? contact.displayOrder
            : { from: existingRows[0].displayOrder, to: contact.displayOrder },
        }),
        createdAt: now,
      });
      return { contact: await serializeCircleContact(rows[0]!, tx) };
    }

    const rows = await tx.insert(userCircleContacts).values({
      id: contactId,
      userId,
      circleId,
      fieldKey: contact.fieldKey,
      label: contact.label,
      value: null,
      contactSecretId: secret.id,
      isEnabled: contact.isEnabled,
      displayOrder: contact.displayOrder,
      createdAt: now,
      updatedAt: now,
    }).returning();

    await tx.insert(auditLogs).values({
      operatorId: userId,
      action: 'circle_contact_created',
      target: circleId,
      detail: JSON.stringify({
        contactId,
        circleId,
        fieldKey: contact.fieldKey,
        isEnabled: contact.isEnabled,
        displayOrder: contact.displayOrder,
      }),
      createdAt: now,
    });

    return { contact: await serializeCircleContact(rows[0]!, tx) };
  });
}

export async function updateMyCircleContact(
  userId: string,
  circleId: string,
  contactId: string,
  input: Partial<CircleContactInput>,
) {
  await ensureCircleMember(userId, circleId);

  const existingRows = await db.select().from(userCircleContacts)
    .where(and(
      eq(userCircleContacts.id, contactId),
      eq(userCircleContacts.userId, userId),
      eq(userCircleContacts.circleId, circleId),
    ))
    .limit(1);
  const existing = existingRows[0];
  if (!existing) throw new NotFoundError('联系方式不存在');

  const nextFieldKey = input.fieldKey !== undefined
    ? normalizeCircleContactFieldKey(input.fieldKey)
    : existing.fieldKey;
  const patch = {
    fieldKey: nextFieldKey,
    label: input.label !== undefined ? normalizeCircleContactLabel(input.label, nextFieldKey) : existing.label,
    value: input.value !== undefined ? normalizeCircleContactValue(input.value) : await getCircleContactPlainValue(existing),
    isEnabled: input.isEnabled ?? existing.isEnabled,
    displayOrder: Number.isInteger(input.displayOrder) ? input.displayOrder! : existing.displayOrder,
    updatedAt: new Date().toISOString(),
  };

  return db.transaction(async (tx) => {
    const secret = await upsertG2ContactSecret(tx, {
      ownerUserId: userId,
      scopeType: 'circle_contact',
      scopeId: contactId,
      fieldKey: patch.fieldKey,
      contactType: inferG2ContactTypeFromFieldKey(patch.fieldKey, patch.label),
      label: patch.label,
      value: patch.value,
      now: patch.updatedAt,
    });

    const rows = await tx.update(userCircleContacts)
      .set({
        fieldKey: patch.fieldKey,
        label: patch.label,
        value: null,
        contactSecretId: secret.id,
        isEnabled: patch.isEnabled,
        displayOrder: patch.displayOrder,
        updatedAt: patch.updatedAt,
      })
      .where(eq(userCircleContacts.id, contactId))
      .returning();

    if (existing.contactSecretId && existing.contactSecretId !== secret.id) {
      await deleteG2ContactSecretById(tx, existing.contactSecretId);
    }

    await tx.insert(auditLogs).values({
      operatorId: userId,
      action: 'circle_contact_updated',
      target: circleId,
      detail: JSON.stringify({
        contactId,
        circleId,
        fieldKey: existing.fieldKey === patch.fieldKey
          ? patch.fieldKey
          : { from: existing.fieldKey, to: patch.fieldKey },
        isEnabled: existing.isEnabled === patch.isEnabled
          ? patch.isEnabled
          : { from: existing.isEnabled, to: patch.isEnabled },
        displayOrder: existing.displayOrder === patch.displayOrder
          ? patch.displayOrder
          : { from: existing.displayOrder, to: patch.displayOrder },
      }),
      createdAt: patch.updatedAt,
    });

    return { contact: await serializeCircleContact(rows[0]!, tx) };
  });
}

export async function deleteMyCircleContact(userId: string, circleId: string, contactId: string) {
  await ensureCircleMember(userId, circleId);

  const rows = await db.transaction(async (tx) => {
    const deletedRows = await tx.delete(userCircleContacts)
      .where(and(
        eq(userCircleContacts.id, contactId),
        eq(userCircleContacts.userId, userId),
        eq(userCircleContacts.circleId, circleId),
      ))
      .returning({
        id: userCircleContacts.id,
        contactSecretId: userCircleContacts.contactSecretId,
        fieldKey: userCircleContacts.fieldKey,
        isEnabled: userCircleContacts.isEnabled,
        displayOrder: userCircleContacts.displayOrder,
      });
    if (deletedRows[0]) {
      await deleteG2ContactSecretById(tx, deletedRows[0].contactSecretId);
      await tx.insert(auditLogs).values({
        operatorId: userId,
        action: 'circle_contact_deleted',
        target: circleId,
        detail: JSON.stringify({
          contactId,
          circleId,
          fieldKey: deletedRows[0].fieldKey,
          isEnabled: deletedRows[0].isEnabled,
          displayOrder: deletedRows[0].displayOrder,
        }),
        createdAt: new Date().toISOString(),
      });
    }
    return deletedRows;
  });

  if (!rows[0]) throw new NotFoundError('联系方式不存在');
  return { message: '联系方式已删除', contactId };
}

export async function getFriendContactAvailabilityMap(
  userId: string,
  targetUserIds: string[],
): Promise<Map<string, FriendContactAvailability>> {
  const uniqueTargetUserIds = Array.from(new Set(
    targetUserIds.filter((targetUserId) => targetUserId && targetUserId !== userId),
  ));

  const availability = new Map<string, FriendContactAvailability>();
  for (const targetUserId of uniqueTargetUserIds) {
    availability.set(targetUserId, {
      status: 'idle',
      hasUnlockedContacts: false,
    });
  }

  if (uniqueTargetUserIds.length === 0) {
    return availability;
  }

  await expirePendingContactUnlocksForTargets(userId, uniqueTargetUserIds);

  const [approvedRows, pendingRows, targetRows, globalFriendRows, activeCircleGrantRows] = await Promise.all([
    db.select({
      targetId: contactUnlockRequests.targetId,
      circleId: contactUnlockRequests.circleId,
      sourceType: contactUnlockRequests.sourceType,
      fieldKey: contactUnlockRequests.fieldKey,
      updatedAt: contactUnlockRequests.updatedAt,
      createdAt: contactUnlockRequests.createdAt,
    }).from(contactUnlockRequests)
      .where(and(
        eq(contactUnlockRequests.requesterId, userId),
        inArray(contactUnlockRequests.targetId, uniqueTargetUserIds),
        eq(contactUnlockRequests.sourceType, 'address_book'),
        eq(contactUnlockRequests.status, 'approved'),
      ))
      .orderBy(desc(contactUnlockRequests.updatedAt), desc(contactUnlockRequests.createdAt)),
    db.select({
      targetId: contactUnlockRequests.targetId,
      circleId: contactUnlockRequests.circleId,
      sourceType: contactUnlockRequests.sourceType,
      fieldKey: contactUnlockRequests.fieldKey,
      requestId: contactUnlockRequests.id,
      updatedAt: contactUnlockRequests.updatedAt,
      createdAt: contactUnlockRequests.createdAt,
    }).from(contactUnlockRequests)
      .where(and(
        eq(contactUnlockRequests.requesterId, userId),
        inArray(contactUnlockRequests.targetId, uniqueTargetUserIds),
        eq(contactUnlockRequests.sourceType, 'address_book'),
        eq(contactUnlockRequests.status, 'pending'),
      ))
      .orderBy(desc(contactUnlockRequests.updatedAt), desc(contactUnlockRequests.createdAt)),
    db.select({
      id: users.id,
      wechatId: users.wechatId,
    }).from(users)
      .where(inArray(users.id, uniqueTargetUserIds)),
    db.select({
      userAId: globalFriendships.userAId,
      userBId: globalFriendships.userBId,
    }).from(globalFriendships)
      .where(or(
        and(eq(globalFriendships.userAId, userId), inArray(globalFriendships.userBId, uniqueTargetUserIds)),
        and(eq(globalFriendships.userBId, userId), inArray(globalFriendships.userAId, uniqueTargetUserIds)),
      )),
    db.select({
      targetId: contactUnlockGrants.targetId,
      circleId: contactUnlockGrants.circleId,
    }).from(contactUnlockGrants)
      .innerJoin(userCircleContacts, eq(contactUnlockGrants.contactId, userCircleContacts.id))
      .where(and(
        eq(contactUnlockGrants.requesterId, userId),
        inArray(contactUnlockGrants.targetId, uniqueTargetUserIds),
        eq(contactUnlockGrants.status, 'active'),
        eq(userCircleContacts.isEnabled, true),
      )),
  ]);

  const contactPresenceByUserId = new Map(
    targetRows.map((row) => [row.id, Boolean(parseStoredContact(row.wechatId))]),
  );
  const activeFriendTargetIds = new Set(
    globalFriendRows.map((row) => (row.userAId === userId ? row.userBId : row.userAId)),
  );

  for (const row of approvedRows) {
    if (!activeFriendTargetIds.has(row.targetId)) {
      continue;
    }

    availability.set(row.targetId, {
      status: 'granted',
      circleId: row.circleId ?? undefined,
      sourceType: row.sourceType === 'address_book' ? 'address_book' : 'circle',
      fieldKey: row.fieldKey,
      hasUnlockedContacts: contactPresenceByUserId.get(row.targetId) ?? false,
    });
  }

  for (const row of activeCircleGrantRows) {
    if (!activeFriendTargetIds.has(row.targetId)) {
      continue;
    }

    availability.set(row.targetId, {
      status: 'granted',
      circleId: row.circleId ?? undefined,
      sourceType: 'circle',
      fieldKey: CONTACT_UNLOCK_CIRCLE_REQUEST_FIELD_KEY,
      hasUnlockedContacts: true,
    });
  }

  for (const row of pendingRows) {
    if (!activeFriendTargetIds.has(row.targetId)) {
      continue;
    }

    const existing = availability.get(row.targetId);
    if (!existing || existing.status === 'granted') {
      continue;
    }

    availability.set(row.targetId, {
      status: 'sent',
      circleId: row.circleId ?? undefined,
      sourceType: row.sourceType === 'address_book' ? 'address_book' : 'circle',
      fieldKey: row.fieldKey,
      hasUnlockedContacts: false,
    });
  }

  return availability;
}

export async function sendContactUnlockRequest(
  userId: string,
  targetUserId: string,
  source: {
    circleId?: string;
    sourceType: ContactUnlockSourceType;
    fieldKey?: string;
    message?: string;
  },
) {
  if (userId === targetUserId) {
    throw new AppError(400, 'CANNOT_UNLOCK_SELF', '不能向自己申请联系方式');
  }

  await ensureUserExists(targetUserId);

  const [isFriend, blocked] = await Promise.all([
    areUsersGlobalFriends(userId, targetUserId),
    areUsersBlocked(userId, targetUserId),
  ]);
  if (!isFriend) {
    throw new AppError(403, 'NOT_FRIEND', '非好友');
  }
  if (blocked) {
    throw new AppError(403, 'USER_BLOCKED', '当前无法申请联系方式');
  }

  const sourceType = source.sourceType === 'address_book' ? 'address_book' : 'circle';
  const fieldKey = sourceType === 'circle'
    ? CONTACT_UNLOCK_CIRCLE_REQUEST_FIELD_KEY
    : CONTACT_UNLOCK_DEFAULT_FIELD_KEY;
  if (sourceType === 'circle') {
    if (!source.circleId) {
      throw new ValidationError('circleId 必填');
    }
    await ensureUsersShareCircle(source.circleId, userId, targetUserId);
    await ensureDefaultCircleContactFromProfile(targetUserId, source.circleId);
    await assertCircleContactUnlockRejectCooldown(userId, targetUserId, fieldKey);
  }

  await expirePendingContactUnlockForScope(userId, targetUserId, sourceType, source.circleId);

  let cardSnapshot: Awaited<ReturnType<typeof getCircleContactRequestCardSnapshot | typeof getAddressBookContactRequestCardSnapshot>>;
  if (sourceType === 'circle' && source.circleId) {
    const [activeCircleGrants, enabledCircleContacts, pendingRequest, snapshot] = await Promise.all([
      getActiveCircleContactGrants(userId, targetUserId, source.circleId),
      getEnabledCircleContactsForUser(targetUserId, source.circleId),
      getPendingCircleContactUnlock(userId, targetUserId, source.circleId),
      getCircleContactRequestCardSnapshot(userId, targetUserId, source.circleId),
    ]);

    const grantedContactKeys = new Set<string>();
    for (const grant of activeCircleGrants) {
      grantedContactKeys.add(await getCircleContactDedupKey(grant));
    }
    const uniqueEnabledContacts = await dedupeCircleContactRowsByValue(enabledCircleContacts);
    let hasUngrantedEnabledContact = false;
    for (const contact of uniqueEnabledContacts) {
      const key = await getCircleContactDedupKey(contact);
      if (!grantedContactKeys.has(key)) {
        hasUngrantedEnabledContact = true;
        break;
      }
    }
    if (enabledCircleContacts.length > 0 && !hasUngrantedEnabledContact) {
      throw new AppError(409, 'CONTACT_ALREADY_UNLOCKED', '对方当前可开放的联系方式均已解锁');
    }
    if (pendingRequest) {
      throw new AppError(409, 'CONTACT_REQUEST_EXISTS', '你已发送过联系方式交换申请');
    }

    cardSnapshot = snapshot;
  } else {
    const [alreadyUnlocked, pendingRequest, snapshot] = await Promise.all([
      hasApprovedContactUnlock(userId, targetUserId, fieldKey),
      getPendingAddressBookContactUnlock(userId, targetUserId),
      getAddressBookContactRequestCardSnapshot(userId, targetUserId),
    ]);

    if (alreadyUnlocked.length > 0) {
      throw new AppError(409, 'CONTACT_ALREADY_UNLOCKED', '对方已同意交换联系方式');
    }
    if (pendingRequest) {
      throw new AppError(409, 'CONTACT_REQUEST_EXISTS', '你已发送过联系方式交换申请');
    }

    cardSnapshot = snapshot;
  }

  const requestId = uuid();
  const nowDate = new Date();
  const now = nowDate.toISOString();
  const circleName = await getCircleName(sourceType === 'circle' ? source.circleId : null);

  await db.transaction(async (tx) => {
    await lockContactUnlockScope(tx, userId, targetUserId, sourceType, source.circleId);
    await expirePendingContactUnlockForScope(userId, targetUserId, sourceType, source.circleId, tx);

    const pendingRequest = sourceType === 'circle' && source.circleId
      ? await getPendingCircleContactUnlock(userId, targetUserId, source.circleId, tx)
      : await getPendingAddressBookContactUnlock(userId, targetUserId, tx);
    if (pendingRequest) {
      throw new AppError(409, 'CONTACT_REQUEST_EXISTS', '你已发送过联系方式交换申请');
    }

    await tx.insert(contactUnlockRequests).values({
      id: requestId,
      circleId: sourceType === 'circle' ? source.circleId ?? null : null,
      requesterId: userId,
      targetId: targetUserId,
      sourceType,
      fieldKey,
      cardSnapshot: cardSnapshot as unknown as Record<string, unknown>,
      message: source.message || null,
      status: 'pending',
      expiresAt: addDaysIso(nowDate, REQUEST_EXPIRES_AFTER_DAYS),
      createdAt: now,
      updatedAt: now,
    });

    await tx.insert(auditLogs).values({
      operatorId: userId,
      action: 'contact_unlock_requested',
      target: targetUserId,
      detail: JSON.stringify({
        requestId,
        requesterId: userId,
        targetId: targetUserId,
        sourceType,
        fieldKey,
        circleId: sourceType === 'circle' ? source.circleId ?? null : null,
        hasMessage: Boolean(source.message?.trim()),
      }),
      createdAt: now,
    });

    await createUserNotification({
      recipientId: targetUserId,
      actorId: userId,
      type: 'contact_unlock_received',
      title: '新的联系方式申请',
      content: sourceType === 'circle'
        ? `有人申请查看你在「${circleName ?? '该圈子'}」开放的联系方式`
        : '有人申请查看你的联系方式',
      meta: {
        requestId,
        requesterId: userId,
        circleId: sourceType === 'circle' ? source.circleId ?? null : null,
        sourceType,
        fieldKey,
        actionUrl: '/settings?tab=privacy',
      },
    }, tx);
  });

  return { requestId, fieldKey, message: '联系方式交换申请已发送' };
}

export async function getContactUnlockStatus(userId: string, targetUserId: string, options?: { circleId?: string }) {
  if (userId === targetUserId) {
    return { status: 'idle' as const };
  }

  await ensureUserExists(targetUserId);
  await expirePendingContactUnlocksForTargets(userId, [targetUserId]);

  if (options?.circleId) {
    await ensureUsersShareCircle(options.circleId, userId, targetUserId);

    const [activeGrants, pendingRequest] = await Promise.all([
      getActiveCircleContactGrants(userId, targetUserId, options.circleId),
      getPendingCircleContactUnlock(userId, targetUserId, options.circleId),
    ]);
    if (activeGrants.length > 0) {
      const uniqueActiveGrants = await dedupeCircleContactRowsByValue(activeGrants);
      return {
        status: 'granted' as const,
        circleId: options.circleId,
        sourceType: 'circle' as const,
        fieldKeys: uniqueActiveGrants.map((grant) => grant.fieldKey),
        pendingRequestId: pendingRequest?.id,
        hasPendingRequest: Boolean(pendingRequest),
      };
    }

    if (pendingRequest) {
      return {
        status: 'sent' as const,
        requestId: pendingRequest.id,
        circleId: options.circleId,
        sourceType: 'circle' as const,
      };
    }

    return { status: 'idle' as const };
  }

  const availability = (await getFriendContactAvailabilityMap(userId, [targetUserId])).get(targetUserId);
  if (!availability) {
    return { status: 'idle' as const };
  }

  if (availability.status === 'granted') {
    return {
      status: 'granted' as const,
      circleId: availability.circleId,
      sourceType: availability.sourceType,
      fieldKey: availability.fieldKey,
    };
  }

  if (availability.status === 'sent') {
    const pendingRequest = await getPendingContactUnlock(userId, targetUserId);
    return {
      status: 'sent' as const,
      requestId: pendingRequest?.id,
      circleId: availability.circleId,
      sourceType: pendingRequest?.sourceType === 'address_book' ? 'address_book' : 'circle',
      fieldKey: pendingRequest?.fieldKey ?? availability.fieldKey,
    };
  }

  return { status: 'idle' as const };
}

export async function getContactUnlockRequests(userId: string) {
  await expirePendingContactUnlocksForUser(userId);

  const [rows, replyRows] = await Promise.all([
    db.select({
      requestId: contactUnlockRequests.id,
      requesterId: contactUnlockRequests.requesterId,
      circleId: contactUnlockRequests.circleId,
      sourceType: contactUnlockRequests.sourceType,
      fieldKey: contactUnlockRequests.fieldKey,
      cardSnapshot: contactUnlockRequests.cardSnapshot,
      message: contactUnlockRequests.message,
      status: contactUnlockRequests.status,
      expiresAt: contactUnlockRequests.expiresAt,
      createdAt: contactUnlockRequests.createdAt,
      circleName: circles.name,
    }).from(contactUnlockRequests)
      .leftJoin(circles, eq(contactUnlockRequests.circleId, circles.id))
      .where(and(
        eq(contactUnlockRequests.targetId, userId),
        eq(contactUnlockRequests.status, 'pending'),
      ))
      .orderBy(desc(contactUnlockRequests.createdAt)),
    db.select({
      requestId: contactUnlockRequests.id,
      targetId: contactUnlockRequests.targetId,
      circleId: contactUnlockRequests.circleId,
      sourceType: contactUnlockRequests.sourceType,
      fieldKey: contactUnlockRequests.fieldKey,
      status: contactUnlockRequests.status,
      message: contactUnlockRequests.message,
      expiresAt: contactUnlockRequests.expiresAt,
      revokedAt: contactUnlockRequests.revokedAt,
      createdAt: contactUnlockRequests.createdAt,
      updatedAt: contactUnlockRequests.updatedAt,
      circleName: circles.name,
    }).from(contactUnlockRequests)
      .leftJoin(circles, eq(contactUnlockRequests.circleId, circles.id))
      .where(and(
        eq(contactUnlockRequests.requesterId, userId),
        inArray(contactUnlockRequests.status, ['approved', 'rejected', 'withdrawn', 'expired', 'revoked']),
      ))
      .orderBy(desc(contactUnlockRequests.updatedAt)),
  ]);

  const requesterIds = Array.from(new Set(rows.map((row) => row.requesterId)));
  const targetIds = Array.from(new Set(replyRows.map((row) => row.targetId)));
  const [requesterRows, targetRows, globalFriendRows] = await Promise.all([
    requesterIds.length > 0
      ? db.select({
          id: users.id,
          nickname: users.nickname,
          avatarUrl: users.avatarUrl,
        }).from(users).where(inArray(users.id, requesterIds))
      : Promise.resolve([]),
    targetIds.length > 0
      ? db.select({
          id: users.id,
          nickname: users.nickname,
          avatarUrl: users.avatarUrl,
        }).from(users).where(inArray(users.id, targetIds))
      : Promise.resolve([]),
    requesterIds.length > 0
      ? db.select({
          userAId: globalFriendships.userAId,
          userBId: globalFriendships.userBId,
        }).from(globalFriendships)
          .where(or(
            and(eq(globalFriendships.userAId, userId), inArray(globalFriendships.userBId, requesterIds)),
            and(eq(globalFriendships.userBId, userId), inArray(globalFriendships.userAId, requesterIds)),
          ))
      : Promise.resolve([]),
  ]);

  const requestersById = new Map(requesterRows.map((row) => [row.id, row]));
  const targetsById = new Map(targetRows.map((row) => [row.id, row]));
  const activeFriendIds = new Set(
    globalFriendRows.map((row) => (row.userAId === userId ? row.userBId : row.userAId)),
  );

  const requests = await Promise.all(rows.flatMap((row) => (
    activeFriendIds.has(row.requesterId) ? [row] : []
  )).map(async (row) => {
    const requester = requestersById.get(row.requesterId);
    const sourceType = row.sourceType === 'address_book' ? 'address_book' : 'circle';
    const cardPreview = parseStoredCardSnapshot(row.cardSnapshot, {
      previewMode: 'friend',
      nickname: requester?.nickname ?? null,
      avatarUrl: requester?.avatarUrl ?? null,
      circleId: row.circleId,
      circleName: row.circleName,
    }) ?? await buildContactRequestFallbackPreview(row.requesterId, userId, sourceType, row.circleId);

    return {
      requestId: row.requestId,
      requester: {
        userId: row.requesterId,
        nickname: requester?.nickname ?? null,
        avatarUrl: requester?.avatarUrl ?? null,
      },
      circleId: row.circleId,
      circleName: row.circleName,
      sourceType,
      fieldKey: row.fieldKey,
      sourceLabel: sourceType === 'address_book' ? '同窗名录' : row.circleName ?? '该圈子',
      cardPreview,
      message: row.message,
      status: row.status,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
    };
  }));

  const replies = replyRows.map((row) => {
    const target = targetsById.get(row.targetId);
    const sourceType = row.sourceType === 'address_book' ? 'address_book' : 'circle';
    return {
      requestId: row.requestId,
      target: {
        userId: row.targetId,
        nickname: target?.nickname ?? null,
        avatarUrl: target?.avatarUrl ?? null,
      },
      circleId: row.circleId,
      circleName: row.circleName,
      sourceType,
      fieldKey: row.fieldKey,
      sourceLabel: sourceType === 'address_book' ? '同窗名录' : row.circleName ?? '该圈子',
      status: row.status,
      message: row.message,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
      respondedAt: row.updatedAt,
    };
  });

  return { requests, replies };
}

export async function handleContactUnlockRequest(
  userId: string,
  requestId: string,
  action: ContactUnlockAction,
  options: { contactIds?: string[] } = {},
) {
  let expired = false;
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM contact_unlock_requests WHERE id = ${requestId} FOR UPDATE`);

    const rows = await tx.select().from(contactUnlockRequests)
      .where(eq(contactUnlockRequests.id, requestId))
      .limit(1);
    const request = rows[0];

    if (!request) {
      throw new AppError(404, 'CONTACT_REQUEST_NOT_FOUND', '联系方式交换申请不存在');
    }
    if (request.targetId !== userId) {
      throw new AppError(403, 'NOT_CONTACT_TARGET', '非接收方无权操作');
    }
    if (request.status !== 'pending') {
      throw new AppError(409, 'CONTACT_REQUEST_PROCESSED', '该联系方式交换申请已处理');
    }
    if (await expireLockedContactUnlockIfNeeded(tx, request)) {
      expired = true;
      return null;
    }

    let selectedCircleContacts: Array<typeof userCircleContacts.$inferSelect> = [];
    if (action === 'approve') {
      const [isFriend, blocked] = await Promise.all([
        areUsersGlobalFriends(request.requesterId, request.targetId, tx),
        areUsersBlocked(request.requesterId, request.targetId, tx),
      ]);
      if (!isFriend) {
        throw new AppError(403, 'NOT_FRIEND', '已不是好友关系，无法交换联系方式');
      }
      if (blocked) {
        throw new AppError(403, 'USER_BLOCKED', '当前无法交换联系方式');
      }

      if (request.sourceType === 'circle') {
        if (!request.circleId) {
          throw new AppError(409, 'CONTACT_REQUEST_INVALID', '该申请缺少兴趣圈上下文');
        }
        await ensureUsersShareCircle(request.circleId, request.requesterId, request.targetId, tx);
        await ensureDefaultCircleContactFromProfile(userId, request.circleId, tx);

        const contactIds = Array.from(new Set((options.contactIds ?? []).filter(Boolean)));
        if (contactIds.length === 0) {
          throw new ValidationError('同意联系方式申请时，请至少选择一个要开放的圈内联系方式');
        }

        selectedCircleContacts = await tx.select().from(userCircleContacts)
          .where(and(
            inArray(userCircleContacts.id, contactIds),
            eq(userCircleContacts.userId, userId),
            eq(userCircleContacts.circleId, request.circleId),
            eq(userCircleContacts.isEnabled, true),
          ));

        if (selectedCircleContacts.length !== contactIds.length) {
          throw new ValidationError('请选择有效的圈内联系方式');
        }
        selectedCircleContacts = await dedupeCircleContactRowsByValue(selectedCircleContacts, tx);
      }
    }

    const now = new Date().toISOString();
    const sourceType = request.sourceType === 'address_book' ? 'address_book' : 'circle';
    const circleName = await getCircleName(request.circleId, tx);
    const updatedRequests = await tx.update(contactUnlockRequests)
      .set({
        status: action === 'approve' ? 'approved' : 'rejected',
        updatedAt: now,
      })
      .where(and(
        eq(contactUnlockRequests.id, requestId),
        eq(contactUnlockRequests.status, 'pending'),
      ))
      .returning({ id: contactUnlockRequests.id });

    if (updatedRequests.length === 0) {
      throw new AppError(409, 'CONTACT_REQUEST_PROCESSED', '该联系方式交换申请已处理');
    }

    if (action === 'approve' && request.sourceType === 'circle' && request.circleId) {
      for (const contact of selectedCircleContacts) {
        const existingGrantRows = await tx.select({ id: contactUnlockGrants.id })
          .from(contactUnlockGrants)
          .where(and(
            eq(contactUnlockGrants.requesterId, request.requesterId),
            eq(contactUnlockGrants.targetId, request.targetId),
            eq(contactUnlockGrants.circleId, request.circleId),
            eq(contactUnlockGrants.contactId, contact.id),
          ))
          .limit(1);

        if (existingGrantRows[0]) {
          await tx.update(contactUnlockGrants)
            .set({
              requestId,
              fieldKey: contact.fieldKey,
              status: 'active',
              updatedAt: now,
              revokedAt: null,
            })
            .where(eq(contactUnlockGrants.id, existingGrantRows[0].id));
        } else {
          await tx.insert(contactUnlockGrants).values({
            id: uuid(),
            requestId,
            requesterId: request.requesterId,
            targetId: request.targetId,
            circleId: request.circleId,
            contactId: contact.id,
            fieldKey: contact.fieldKey,
            status: 'active',
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    }

    await tx.insert(auditLogs).values({
      operatorId: userId,
      action: action === 'approve' ? 'contact_unlock_approved' : 'contact_unlock_rejected',
      target: request.targetId,
      detail: JSON.stringify({
        requestId,
        requesterId: request.requesterId,
        sourceType: request.sourceType,
        fieldKey: request.fieldKey,
        circleId: request.circleId,
      }),
      createdAt: now,
    });

    await createUserNotification({
      recipientId: request.requesterId,
      actorId: userId,
      type: action === 'approve' ? 'contact_unlock_approved' : 'contact_unlock_rejected',
      title: action === 'approve' ? '联系方式申请已通过' : '联系方式申请被拒绝',
      content: action === 'approve'
        ? (sourceType === 'circle' ? `你在「${circleName ?? '该圈子'}」的联系方式申请已通过` : '你的联系方式申请已通过')
        : (sourceType === 'circle' ? `你在「${circleName ?? '该圈子'}」的联系方式申请被拒绝` : '你的联系方式申请被拒绝'),
      meta: {
        requestId,
        sourceType,
        fieldKey: request.fieldKey,
        circleId: request.circleId,
        actionUrl: '/settings?tab=privacy',
      },
    }, tx);

    return {
      action,
      message: action === 'approve' ? '已同意交换联系方式' : '已拒绝交换联系方式',
    };
  });

  if (expired) throwContactUnlockExpired();
  return result!;
}

export async function withdrawContactUnlockRequest(userId: string, requestId: string) {
  let expired = false;
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM contact_unlock_requests WHERE id = ${requestId} FOR UPDATE`);

    const rows = await tx.select().from(contactUnlockRequests)
      .where(eq(contactUnlockRequests.id, requestId))
      .limit(1);
    const request = rows[0];

    if (!request) {
      throw new AppError(404, 'CONTACT_REQUEST_NOT_FOUND', '联系方式交换申请不存在');
    }
    if (request.requesterId !== userId) {
      throw new AppError(403, 'NOT_CONTACT_REQUESTER', '只有发送方可以撤回联系方式交换申请');
    }
    if (request.status !== 'pending') {
      throw new AppError(409, 'CONTACT_REQUEST_PROCESSED', '该联系方式交换申请已处理');
    }
    if (await expireLockedContactUnlockIfNeeded(tx, request)) {
      expired = true;
      return null;
    }

    const now = new Date().toISOString();
    const sourceType = request.sourceType === 'address_book' ? 'address_book' : 'circle';
    const circleName = await getCircleName(request.circleId, tx);
    await tx.update(contactUnlockRequests)
      .set({
        status: 'withdrawn',
        updatedAt: now,
      })
      .where(eq(contactUnlockRequests.id, requestId));

    await tx.insert(auditLogs).values({
      operatorId: userId,
      action: 'contact_unlock_withdrawn',
      target: request.targetId,
      detail: JSON.stringify({
        requestId,
        targetId: request.targetId,
        sourceType: request.sourceType,
        fieldKey: request.fieldKey,
        circleId: request.circleId,
      }),
      createdAt: now,
    });

    await createUserNotification({
      recipientId: request.targetId,
      actorId: userId,
      type: 'contact_unlock_withdrawn',
      title: '联系方式申请已撤回',
      content: sourceType === 'circle'
        ? `对方已撤回在「${circleName ?? '该圈子'}」的联系方式申请`
        : '对方已撤回联系方式申请',
      meta: {
        requestId,
        requesterId: request.requesterId,
        sourceType,
        fieldKey: request.fieldKey,
        circleId: request.circleId,
        actionUrl: '/settings?tab=privacy',
      },
    }, tx);

    return {
      action: 'withdraw' as const,
      message: '已撤回联系方式交换申请',
    };
  });

  if (expired) throwContactUnlockExpired();
  return result!;
}

export async function revokeContactUnlockRequest(userId: string, requestId: string) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM contact_unlock_requests WHERE id = ${requestId} FOR UPDATE`);

    const rows = await tx.select().from(contactUnlockRequests)
      .where(eq(contactUnlockRequests.id, requestId))
      .limit(1);
    const request = rows[0];

    if (!request) {
      throw new AppError(404, 'CONTACT_REQUEST_NOT_FOUND', '联系方式交换申请不存在');
    }
    if (request.targetId !== userId) {
      throw new AppError(403, 'NOT_CONTACT_TARGET', '只有授权方可以撤销联系方式授权');
    }
    if (request.status !== 'approved') {
      throw new AppError(409, 'CONTACT_REQUEST_NOT_APPROVED', '只能撤销已通过的联系方式授权');
    }

    const now = new Date().toISOString();
    const sourceType = request.sourceType === 'address_book' ? 'address_book' : 'circle';
    await tx.update(contactUnlockRequests)
      .set({
        status: 'revoked',
        revokedAt: now,
        updatedAt: now,
      })
      .where(eq(contactUnlockRequests.id, requestId));

    if (request.sourceType === 'circle') {
      await tx.update(contactUnlockGrants)
        .set({
          status: 'revoked',
          revokedAt: now,
          updatedAt: now,
        })
        .where(eq(contactUnlockGrants.requestId, requestId));
    }

    await tx.insert(auditLogs).values({
      operatorId: userId,
      action: 'contact_unlock_revoked',
      target: request.requesterId,
      detail: JSON.stringify({
        requestId,
        requesterId: request.requesterId,
        targetId: request.targetId,
        sourceType,
        fieldKey: request.fieldKey,
        circleId: request.circleId,
      }),
      createdAt: now,
    });

    return {
      requestId,
      status: 'revoked' as const,
      message: '已撤销联系方式授权',
    };
  });
}

export async function getUnlockedContacts(userId: string, targetUserId: string, options?: { circleId?: string }) {
  const [targetRows, isFriend, blocked] = await Promise.all([
    db.select({
      email: users.email,
      wechatId: users.wechatId,
    }).from(users).where(eq(users.id, targetUserId)).limit(1),
    areUsersGlobalFriends(userId, targetUserId),
    areUsersBlocked(userId, targetUserId),
  ]);

  if (!isFriend) {
    throw new AppError(403, 'NOT_FRIEND', '已不再是好友，暂不可查看联系方式');
  }
  if (blocked) {
    throw new AppError(403, 'USER_BLOCKED', '当前不可查看联系方式');
  }

  const target = targetRows[0];
  if (!target) {
    throw new NotFoundError('用户不存在');
  }

  const contacts: Array<{ moduleKey: string; fieldKey?: string; label: string; value: string }> = [];

  if (options?.circleId) {
    await ensureUsersShareCircle(options.circleId, userId, targetUserId);

    const grantedContacts = await getActiveCircleContactGrants(userId, targetUserId, options.circleId);
    if (grantedContacts.length > 0) {
      const contacts = await Promise.all(grantedContacts.map(async (contact) => ({
        moduleKey: contact.fieldKey,
        fieldKey: contact.fieldKey,
        label: contact.label,
        value: await resolveCircleContactValue(contact),
      })));
      return {
        contacts: dedupeContactModules(contacts),
      };
    }

    throw new AppError(403, 'CONTACT_NOT_UNLOCKED', '对方尚未同意交换联系方式');
  } else {
    const [approvedAddressBookRequests, grantedCircleContacts] = await Promise.all([
      hasApprovedContactUnlock(userId, targetUserId),
      getActiveCircleContactGrantsForTarget(userId, targetUserId),
    ]);

    contacts.push(...(await Promise.all(grantedCircleContacts.map(async (contact) => ({
      moduleKey: contact.fieldKey,
      fieldKey: contact.fieldKey,
      label: contact.label,
      value: await resolveCircleContactValue(contact),
    })))));

    if (approvedAddressBookRequests.length === 0 && grantedCircleContacts.length === 0) {
      throw new AppError(403, 'CONTACT_NOT_UNLOCKED', '对方尚未同意交换联系方式');
    }

    if (approvedAddressBookRequests.length > 0) {
      const parsedContact = parseStoredContact(target.wechatId);
      if (parsedContact) {
        const meta = CONTACT_PLATFORM_META[parsedContact.platform] ?? {
          moduleKey: `contact_${parsedContact.platform}`,
          label: parsedContact.platform,
        };
        contacts.push({
          moduleKey: meta.moduleKey,
          label: meta.label,
          value: parsedContact.contactId,
        });
      }
    }
  }

  return { contacts: dedupeContactModules(contacts) };
}
