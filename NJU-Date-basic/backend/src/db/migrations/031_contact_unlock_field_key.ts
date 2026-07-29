import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    ALTER TABLE contact_unlock_requests
      ADD COLUMN IF NOT EXISTS field_key TEXT NOT NULL DEFAULT 'contact_primary';

    DROP INDEX IF EXISTS idx_contact_unlock_requests_users;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_unlock_requests_users_field_pending
      ON contact_unlock_requests(requester_id, target_id, field_key)
      WHERE status = 'pending';

    CREATE INDEX IF NOT EXISTS idx_contact_unlock_requests_rejected_field
      ON contact_unlock_requests(requester_id, target_id, field_key, status, updated_at);
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`
    DROP INDEX IF EXISTS idx_contact_unlock_requests_rejected_field;
    DROP INDEX IF EXISTS idx_contact_unlock_requests_users_field_pending;

    DELETE FROM contact_unlock_requests cur
    WHERE cur.status = 'pending'
      AND cur.id NOT IN (
        SELECT DISTINCT ON (requester_id, target_id) id
        FROM contact_unlock_requests
        WHERE status = 'pending'
        ORDER BY requester_id, target_id, updated_at DESC, created_at DESC, id DESC
      );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_unlock_requests_users
      ON contact_unlock_requests(requester_id, target_id)
      WHERE status = 'pending';

    ALTER TABLE contact_unlock_requests
      DROP COLUMN IF EXISTS field_key;
  `);
}
