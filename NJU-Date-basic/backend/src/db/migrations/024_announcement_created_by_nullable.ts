import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    -- Announcements are created by admins via API key, not necessarily linked to a user account
    ALTER TABLE forum_announcements ALTER COLUMN created_by DROP NOT NULL;
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`
    -- Restore NOT NULL (set placeholder for any nulls first)
    UPDATE forum_announcements SET created_by = '00000000-0000-0000-0000-000000000000' WHERE created_by IS NULL;
    ALTER TABLE forum_announcements ALTER COLUMN created_by SET NOT NULL;
  `);
}
