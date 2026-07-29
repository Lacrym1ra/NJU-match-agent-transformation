import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    ALTER TABLE friend_requests
      DROP CONSTRAINT IF EXISTS friend_requests_status_check;
    ALTER TABLE friend_requests
      ADD CONSTRAINT friend_requests_status_check
      CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn'));

    ALTER TABLE contact_unlock_requests
      DROP CONSTRAINT IF EXISTS contact_unlock_requests_status_check;
    ALTER TABLE contact_unlock_requests
      ADD CONSTRAINT contact_unlock_requests_status_check
      CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn'));
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`
    UPDATE friend_requests
    SET status = 'rejected'
    WHERE status = 'withdrawn';

    ALTER TABLE friend_requests
      DROP CONSTRAINT IF EXISTS friend_requests_status_check;
    ALTER TABLE friend_requests
      ADD CONSTRAINT friend_requests_status_check
      CHECK (status IN ('pending', 'accepted', 'rejected'));

    UPDATE contact_unlock_requests
    SET status = 'rejected'
    WHERE status = 'withdrawn';

    ALTER TABLE contact_unlock_requests
      DROP CONSTRAINT IF EXISTS contact_unlock_requests_status_check;
    ALTER TABLE contact_unlock_requests
      ADD CONSTRAINT contact_unlock_requests_status_check
      CHECK (status IN ('pending', 'approved', 'rejected'));
  `);
}
