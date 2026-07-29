import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { v4 as uuid } from 'uuid';
import { and, eq } from 'drizzle-orm';
import { config } from '../config.js';
import { g2ContactSecrets } from '../db/schema.js';

export type G2ContactSecretScopeType = 'profile_seed' | 'circle_contact' | 'teamup_application' | 'teamup_member';

export interface G2PlainContactInput {
  ownerUserId: string;
  scopeType: G2ContactSecretScopeType;
  scopeId: string;
  fieldKey: string;
  contactType: string;
  label: string;
  value: string;
  now?: string;
  id?: string;
}

export interface G2StoredContactRef {
  contactSecretId: string;
  type: string;
  label?: string;
  maskedValue: string;
}

export type G2ContactSecretRow = typeof g2ContactSecrets.$inferSelect;

const G2_CONTACT_SECRET_KEY_VERSION = 'v1';
const G2_CONTACT_AAD_PREFIX = 'nju-date:g2-contact-secret';

function deriveKey(material: string, purpose: string) {
  const trimmed = material.trim();
  const hex = /^[0-9a-f]{64}$/i.test(trimmed) ? Buffer.from(trimmed, 'hex') : null;
  if (hex?.length === 32) return hex;

  try {
    const base64 = Buffer.from(trimmed, 'base64');
    if (base64.length === 32) return base64;
  } catch {
    // Fall through to deterministic derivation for text secrets.
  }

  return createHash('sha256')
    .update(`${purpose}:${trimmed}`, 'utf8')
    .digest();
}

function encryptionKey() {
  return deriveKey(config.g2Contacts.encryptionKey, 'encryption');
}

function blindIndexKey() {
  return deriveKey(config.g2Contacts.blindIndexKey, 'blind-index');
}

function normalizeType(value: string) {
  const raw = value.trim().toLowerCase();
  if (!raw) return 'contact';
  if (raw.includes('wechat') || raw.includes('weixin') || raw.includes('微信') || raw === 'wx' || raw === 'vx') return 'wechat';
  if (raw.includes('qq')) return 'qq';
  if (raw.includes('email') || raw.includes('mail') || raw.includes('邮箱')) return 'email';
  if (raw.includes('phone') || raw.includes('mobile') || raw.includes('tel') || raw.includes('电话') || raw.includes('手机')) return 'phone';
  if (raw.includes('xiaohongshu') || raw.includes('小红书') || raw === 'rednote') return 'xiaohongshu';
  return raw.slice(0, 40);
}

export function inferG2ContactTypeFromFieldKey(fieldKey: string, label?: string) {
  const source = `${fieldKey} ${label ?? ''}`;
  return normalizeType(source);
}

export function normalizeG2ContactType(type: string, label?: string) {
  return normalizeType(`${type} ${label ?? ''}`);
}

export function parseG2StoredProfileContact(value: string | null | undefined) {
  if (!value) return null;

  if (!value.includes(':')) {
    return {
      contactType: 'wechat',
      value,
    };
  }

  const [platform, ...rest] = value.split(':');
  const contactValue = rest.join(':');
  if (!contactValue) return null;

  return {
    contactType: normalizeType(platform || 'wechat'),
    value: contactValue,
  };
}

function normalizeValueForHash(contactType: string, value: string) {
  const trimmed = value.trim();
  if (contactType === 'email') return trimmed.toLowerCase();
  if (contactType === 'phone') return trimmed.replace(/[^\d+]/g, '');
  return trimmed;
}

function buildValueHash(contactType: string, value: string) {
  const normalized = normalizeValueForHash(contactType, value);
  return createHmac('sha256', blindIndexKey())
    .update(`${contactType}:${normalized}`, 'utf8')
    .digest('base64');
}

function buildAad(row: {
  id: string;
  ownerUserId: string;
  scopeType: G2ContactSecretScopeType | string;
  scopeId: string;
  fieldKey: string;
  contactType: string;
}) {
  return Buffer.from([
    G2_CONTACT_AAD_PREFIX,
    row.id,
    row.ownerUserId,
    row.scopeType,
    row.scopeId,
    row.fieldKey,
    row.contactType,
  ].join('|'), 'utf8');
}

export function maskG2ContactValue(contactType: string, value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (contactType === 'email') {
    const [local, domain] = trimmed.split('@');
    if (!local || !domain) return maskG2ContactValue('contact', trimmed);
    const localMask = local.length <= 1 ? '*' : `${local[0]}***`;
    const [domainHead, ...domainRest] = domain.split('.');
    const maskedDomainHead = domainHead.length <= 1 ? '*' : `${domainHead[0]}***`;
    return `${localMask}@${[maskedDomainHead, ...domainRest].join('.')}`;
  }

  if (contactType === 'phone') {
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length >= 7) {
      return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
    }
  }

  const chars = Array.from(trimmed);
  if (chars.length <= 2) return '*'.repeat(chars.length);
  if (chars.length <= 5) return `${chars[0]}***`;
  return `${chars.slice(0, 2).join('')}***${chars.slice(-2).join('')}`;
}

export function buildG2ContactSecretRecord(input: G2PlainContactInput) {
  const id = input.id ?? uuid();
  const now = input.now ?? new Date().toISOString();
  const contactType = normalizeType(input.contactType);
  const rowForAad = {
    id,
    ownerUserId: input.ownerUserId,
    scopeType: input.scopeType,
    scopeId: input.scopeId,
    fieldKey: input.fieldKey,
    contactType,
  };
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), nonce);
  cipher.setAAD(buildAad(rowForAad));

  const ciphertext = Buffer.concat([
    cipher.update(input.value, 'utf8'),
    cipher.final(),
  ]);

  return {
    id,
    ownerUserId: input.ownerUserId,
    scopeType: input.scopeType,
    scopeId: input.scopeId,
    fieldKey: input.fieldKey,
    contactType,
    label: input.label,
    ciphertext: ciphertext.toString('base64'),
    nonce: nonce.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    keyVersion: G2_CONTACT_SECRET_KEY_VERSION,
    valueHash: buildValueHash(contactType, input.value),
    maskedValue: maskG2ContactValue(contactType, input.value),
    createdAt: now,
    updatedAt: now,
  };
}

export function decryptG2ContactSecret(row: G2ContactSecretRow) {
  if (row.keyVersion !== G2_CONTACT_SECRET_KEY_VERSION) {
    throw new Error(`Unsupported G2 contact secret key version: ${row.keyVersion}`);
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(row.nonce, 'base64'),
  );
  decipher.setAAD(buildAad({
    id: row.id,
    ownerUserId: row.ownerUserId,
    scopeType: row.scopeType as G2ContactSecretScopeType,
    scopeId: row.scopeId,
    fieldKey: row.fieldKey,
    contactType: row.contactType,
  }));
  decipher.setAuthTag(Buffer.from(row.authTag, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(row.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

export async function createG2ContactSecret(client: any, input: G2PlainContactInput) {
  const record = buildG2ContactSecretRecord(input);
  const rows = await client.insert(g2ContactSecrets).values(record).returning();
  return rows[0] as G2ContactSecretRow;
}

export async function upsertG2ContactSecret(client: any, input: G2PlainContactInput) {
  const existingRows: Array<{ id: string }> = await client.select({ id: g2ContactSecrets.id })
    .from(g2ContactSecrets)
    .where(and(
      eq(g2ContactSecrets.ownerUserId, input.ownerUserId),
      eq(g2ContactSecrets.scopeType, input.scopeType),
      eq(g2ContactSecrets.scopeId, input.scopeId),
      eq(g2ContactSecrets.fieldKey, input.fieldKey),
      eq(g2ContactSecrets.contactType, normalizeType(input.contactType)),
    ))
    .limit(1);

  const record = buildG2ContactSecretRecord({
    ...input,
    id: existingRows[0]?.id,
  });

  if (existingRows[0]) {
    const rows = await client.update(g2ContactSecrets)
      .set({
        label: record.label,
        ciphertext: record.ciphertext,
        nonce: record.nonce,
        authTag: record.authTag,
        keyVersion: record.keyVersion,
        valueHash: record.valueHash,
        maskedValue: record.maskedValue,
        updatedAt: record.updatedAt,
      })
      .where(eq(g2ContactSecrets.id, existingRows[0].id))
      .returning();
    return rows[0] as G2ContactSecretRow;
  }

  const rows = await client.insert(g2ContactSecrets).values(record).returning();
  return rows[0] as G2ContactSecretRow;
}

export async function getG2ContactSecret(client: any, contactSecretId: string | null | undefined) {
  if (!contactSecretId) return null;
  const rows = await client.select().from(g2ContactSecrets)
    .where(eq(g2ContactSecrets.id, contactSecretId))
    .limit(1);
  return (rows[0] ?? null) as G2ContactSecretRow | null;
}

export async function getG2ContactSecretForScope(
  client: any,
  contactSecretId: string | null | undefined,
  ownerUserId: string,
  scopeType: G2ContactSecretScopeType,
  scopeId: string,
) {
  if (!contactSecretId) return null;
  const rows = await client.select().from(g2ContactSecrets)
    .where(and(
      eq(g2ContactSecrets.id, contactSecretId),
      eq(g2ContactSecrets.ownerUserId, ownerUserId),
      eq(g2ContactSecrets.scopeType, scopeType),
      eq(g2ContactSecrets.scopeId, scopeId),
    ))
    .limit(1);
  return (rows[0] ?? null) as G2ContactSecretRow | null;
}

export async function deleteG2ContactSecretById(client: any, contactSecretId: string | null | undefined) {
  if (!contactSecretId) return;
  await client.delete(g2ContactSecrets).where(eq(g2ContactSecrets.id, contactSecretId));
}

export async function deleteG2ContactSecretsForScope(
  client: any,
  ownerUserId: string,
  scopeType: G2ContactSecretScopeType,
  scopeId: string,
) {
  await client.delete(g2ContactSecrets)
    .where(and(
      eq(g2ContactSecrets.ownerUserId, ownerUserId),
      eq(g2ContactSecrets.scopeType, scopeType),
      eq(g2ContactSecrets.scopeId, scopeId),
    ));
}

export function toG2StoredContactRef(
  row: G2ContactSecretRow,
  options?: { type?: string; label?: string },
): G2StoredContactRef {
  return {
    contactSecretId: row.id,
    type: options?.type ?? row.contactType,
    label: options?.label ?? row.label,
    maskedValue: row.maskedValue,
  };
}
