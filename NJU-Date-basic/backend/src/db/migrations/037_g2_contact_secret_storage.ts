import { eq, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
  teamupApplications,
  teamupMemberContacts,
  userCircleContacts,
  users,
} from '../schema.js';
import {
  inferG2ContactTypeFromFieldKey,
  normalizeG2ContactType,
  parseG2StoredProfileContact,
  toG2StoredContactRef,
  upsertG2ContactSecret,
  type G2ContactSecretScopeType,
  type G2StoredContactRef,
} from '../../services/g2ContactSecretService.js';

type LegacyStoredContact = {
  contactSecretId?: string;
  type?: string;
  value?: string;
  label?: string;
  maskedValue?: string;
};

function sanitizedRef(contact: LegacyStoredContact): G2StoredContactRef | null {
  if (!contact.contactSecretId || !contact.type) return null;
  return {
    contactSecretId: contact.contactSecretId,
    type: contact.type,
    label: contact.label,
    maskedValue: contact.maskedValue ?? '',
  };
}

async function migrateTeamupContactPayload(
  db: PostgresJsDatabase<any>,
  ownerUserId: string,
  scopeType: G2ContactSecretScopeType,
  scopeId: string,
  payload: unknown,
) {
  if (!Array.isArray(payload)) return { contacts: [], changed: false };

  let changed = false;
  const contacts: G2StoredContactRef[] = [];
  for (const [index, rawContact] of payload.entries()) {
    const contact = (rawContact ?? {}) as LegacyStoredContact;
    const type = typeof contact.type === 'string' && contact.type.trim() ? contact.type.trim() : 'contact';
    const label = typeof contact.label === 'string' && contact.label.trim() ? contact.label.trim() : type;
    const value = typeof contact.value === 'string' ? contact.value.trim() : '';

    if (value) {
      const secret = await upsertG2ContactSecret(db, {
        ownerUserId,
        scopeType,
        scopeId,
        fieldKey: `teamup_contact_${index}`,
        contactType: normalizeG2ContactType(type, label),
        label,
        value,
      });
      contacts.push(toG2StoredContactRef(secret, { type, label }));
      changed = true;
      continue;
    }

    const ref = sanitizedRef(contact);
    if (ref) {
      contacts.push(ref);
      changed ||= Boolean(contact.value);
    }
  }

  return { contacts, changed };
}

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS g2_contact_secrets (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      scope_type TEXT NOT NULL,
      scope_id TEXT NOT NULL,
      field_key TEXT NOT NULL,
      contact_type TEXT NOT NULL,
      label TEXT NOT NULL,
      ciphertext TEXT NOT NULL,
      nonce TEXT NOT NULL,
      auth_tag TEXT NOT NULL,
      key_version TEXT NOT NULL,
      value_hash TEXT NOT NULL,
      masked_value TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_g2_contact_secrets_unique_scope
      ON g2_contact_secrets(owner_user_id, scope_type, scope_id, field_key, contact_type);
    CREATE INDEX IF NOT EXISTS idx_g2_contact_secrets_owner_scope
      ON g2_contact_secrets(owner_user_id, scope_type, scope_id);
    CREATE INDEX IF NOT EXISTS idx_g2_contact_secrets_value_hash
      ON g2_contact_secrets(value_hash);

    ALTER TABLE user_circle_contacts
      ADD COLUMN IF NOT EXISTS contact_secret_id TEXT;
    ALTER TABLE user_circle_contacts
      ALTER COLUMN value DROP NOT NULL;

    DO $$
    BEGIN
      ALTER TABLE user_circle_contacts
        ADD CONSTRAINT fk_user_circle_contacts_contact_secret
        FOREIGN KEY (contact_secret_id) REFERENCES g2_contact_secrets(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END $$;

    CREATE INDEX IF NOT EXISTS idx_user_circle_contacts_secret
      ON user_circle_contacts(contact_secret_id);
  `);

  const profileRows = await db.select({
    id: users.id,
    wechatId: users.wechatId,
  }).from(users).where(sql`
    ${users.wechatId} IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM circle_members cm WHERE cm.user_id = ${users.id})
      OR EXISTS (SELECT 1 FROM user_circle_contacts ucc WHERE ucc.user_id = ${users.id})
      OR EXISTS (SELECT 1 FROM teamup_member_contacts tmc WHERE tmc.user_id = ${users.id})
      OR EXISTS (SELECT 1 FROM teamup_applications ta WHERE ta.applicant_id = ${users.id})
    )
  `);

  for (const row of profileRows) {
    const parsedContact = parseG2StoredProfileContact(row.wechatId);
    if (!parsedContact) continue;

    await upsertG2ContactSecret(db, {
      ownerUserId: row.id,
      scopeType: 'profile_seed',
      scopeId: row.id,
      fieldKey: `contact_${parsedContact.contactType}`,
      contactType: parsedContact.contactType,
      label: parsedContact.contactType === 'wechat' ? '微信' : parsedContact.contactType,
      value: parsedContact.value,
    });
  }

  const circleRows = await db.select({
    id: userCircleContacts.id,
    userId: userCircleContacts.userId,
    fieldKey: userCircleContacts.fieldKey,
    label: userCircleContacts.label,
    value: userCircleContacts.value,
    contactSecretId: userCircleContacts.contactSecretId,
    updatedAt: userCircleContacts.updatedAt,
  }).from(userCircleContacts)
    .where(sql`${userCircleContacts.value} IS NOT NULL AND ${userCircleContacts.contactSecretId} IS NULL`);

  for (const row of circleRows) {
    if (!row.value) continue;

    const secret = await upsertG2ContactSecret(db, {
      ownerUserId: row.userId,
      scopeType: 'circle_contact',
      scopeId: row.id,
      fieldKey: row.fieldKey,
      contactType: inferG2ContactTypeFromFieldKey(row.fieldKey, row.label),
      label: row.label,
      value: row.value,
      now: row.updatedAt ?? undefined,
    });

    await db.update(userCircleContacts)
      .set({ contactSecretId: secret.id, value: null, updatedAt: row.updatedAt ?? new Date().toISOString() })
      .where(eq(userCircleContacts.id, row.id));
  }

  const memberContactRows = await db.select({
    id: teamupMemberContacts.id,
    userId: teamupMemberContacts.userId,
    contacts: teamupMemberContacts.contacts,
    updatedAt: teamupMemberContacts.updatedAt,
  }).from(teamupMemberContacts);

  for (const row of memberContactRows) {
    const migrated = await migrateTeamupContactPayload(db, row.userId, 'teamup_member', row.id, row.contacts);
    if (!migrated.changed) continue;

    await db.update(teamupMemberContacts)
      .set({ contacts: migrated.contacts, updatedAt: row.updatedAt ?? new Date().toISOString() })
      .where(eq(teamupMemberContacts.id, row.id));
  }

  const applicationRows = await db.select({
    id: teamupApplications.id,
    applicantId: teamupApplications.applicantId,
    contactPayload: teamupApplications.contactPayload,
    updatedAt: teamupApplications.updatedAt,
  }).from(teamupApplications);

  for (const row of applicationRows) {
    const migrated = await migrateTeamupContactPayload(db, row.applicantId, 'teamup_application', row.id, row.contactPayload);
    if (!migrated.changed) continue;

    await db.update(teamupApplications)
      .set({ contactPayload: migrated.contacts, updatedAt: row.updatedAt ?? new Date().toISOString() })
      .where(eq(teamupApplications.id, row.id));
  }
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`
    DROP INDEX IF EXISTS idx_user_circle_contacts_secret;
    ALTER TABLE user_circle_contacts
      DROP CONSTRAINT IF EXISTS fk_user_circle_contacts_contact_secret;
    ALTER TABLE user_circle_contacts
      DROP COLUMN IF EXISTS contact_secret_id;

    DROP INDEX IF EXISTS idx_g2_contact_secrets_value_hash;
    DROP INDEX IF EXISTS idx_g2_contact_secrets_owner_scope;
    DROP INDEX IF EXISTS idx_g2_contact_secrets_unique_scope;
    DROP TABLE IF EXISTS g2_contact_secrets;
  `);
}
