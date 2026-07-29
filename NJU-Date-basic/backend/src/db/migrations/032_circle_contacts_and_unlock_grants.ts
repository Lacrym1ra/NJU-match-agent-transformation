import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS user_circle_contacts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      circle_id TEXT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
      field_key TEXT NOT NULL,
      label TEXT NOT NULL,
      value TEXT NOT NULL,
      is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      display_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_circle_contacts_user_circle_field
      ON user_circle_contacts(user_id, circle_id, field_key);
    CREATE INDEX IF NOT EXISTS idx_user_circle_contacts_user_circle
      ON user_circle_contacts(user_id, circle_id, display_order);

    CREATE TABLE IF NOT EXISTS contact_unlock_grants (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL REFERENCES contact_unlock_requests(id) ON DELETE CASCADE,
      requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      circle_id TEXT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
      contact_id TEXT NOT NULL REFERENCES user_circle_contacts(id) ON DELETE CASCADE,
      field_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      revoked_at TIMESTAMPTZ
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_unlock_grants_unique_contact
      ON contact_unlock_grants(requester_id, target_id, circle_id, contact_id);
    CREATE INDEX IF NOT EXISTS idx_contact_unlock_grants_request
      ON contact_unlock_grants(request_id);
    CREATE INDEX IF NOT EXISTS idx_contact_unlock_grants_lookup
      ON contact_unlock_grants(requester_id, target_id, circle_id, status);
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`
    DROP INDEX IF EXISTS idx_contact_unlock_grants_lookup;
    DROP INDEX IF EXISTS idx_contact_unlock_grants_request;
    DROP INDEX IF EXISTS idx_contact_unlock_grants_unique_contact;
    DROP TABLE IF EXISTS contact_unlock_grants CASCADE;

    DROP INDEX IF EXISTS idx_user_circle_contacts_user_circle;
    DROP INDEX IF EXISTS idx_user_circle_contacts_user_circle_field;
    DROP TABLE IF EXISTS user_circle_contacts CASCADE;
  `);
}
