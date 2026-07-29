import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    ALTER TABLE user_reports
      ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

    UPDATE user_reports
    SET reviewed_at = created_at
    WHERE status = 'reviewed' AND reviewed_at IS NULL;

    CREATE INDEX IF NOT EXISTS idx_user_reports_status_reviewed_at
      ON user_reports(status, reviewed_at DESC);
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`
    DROP INDEX IF EXISTS idx_user_reports_status_reviewed_at;
    ALTER TABLE user_reports DROP COLUMN IF EXISTS reviewed_at;
  `);
}
