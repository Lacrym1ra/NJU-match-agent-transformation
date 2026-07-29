import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    DROP INDEX IF EXISTS idx_contact_unlock_requests_users_field_pending;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_unlock_requests_circle_pending
      ON contact_unlock_requests(requester_id, target_id, circle_id)
      WHERE status = 'pending' AND source_type = 'circle';

    CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_unlock_requests_address_book_pending
      ON contact_unlock_requests(requester_id, target_id)
      WHERE status = 'pending' AND source_type = 'address_book';
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`
    DROP INDEX IF EXISTS idx_contact_unlock_requests_address_book_pending;
    DROP INDEX IF EXISTS idx_contact_unlock_requests_circle_pending;

    DELETE FROM contact_unlock_requests cur
    WHERE cur.status = 'pending'
      AND cur.id NOT IN (
        SELECT DISTINCT ON (requester_id, target_id, field_key) id
        FROM contact_unlock_requests
        WHERE status = 'pending'
        ORDER BY requester_id, target_id, field_key, updated_at DESC, created_at DESC, id DESC
      );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_unlock_requests_users_field_pending
      ON contact_unlock_requests(requester_id, target_id, field_key)
      WHERE status = 'pending';
  `);
}
