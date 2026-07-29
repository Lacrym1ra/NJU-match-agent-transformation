import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    ALTER TABLE circle_members
      ADD COLUMN IF NOT EXISTS membership_status TEXT NOT NULL DEFAULT 'active';

    UPDATE circle_members
    SET membership_status = 'active'
    WHERE membership_status IS NULL;

    CREATE INDEX IF NOT EXISTS idx_circle_members_circle_status_active
      ON circle_members(circle_id, membership_status, is_active);
    CREATE INDEX IF NOT EXISTS idx_circle_members_user_status
      ON circle_members(user_id, membership_status);
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`
    DROP INDEX IF EXISTS idx_circle_members_user_status;
    DROP INDEX IF EXISTS idx_circle_members_circle_status_active;
    ALTER TABLE circle_members
      DROP COLUMN IF EXISTS membership_status;
  `);
}
