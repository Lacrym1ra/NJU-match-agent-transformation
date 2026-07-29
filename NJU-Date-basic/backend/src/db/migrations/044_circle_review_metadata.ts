import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    ALTER TABLE circles
      ADD COLUMN IF NOT EXISTS review_note TEXT;
    ALTER TABLE circles
      ADD COLUMN IF NOT EXISTS reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE circles
      ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

    CREATE INDEX IF NOT EXISTS idx_circles_status_created_at
      ON circles(status, created_at);
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`
    DROP INDEX IF EXISTS idx_circles_status_created_at;
    ALTER TABLE circles
      DROP COLUMN IF EXISTS reviewed_at;
    ALTER TABLE circles
      DROP COLUMN IF EXISTS reviewed_by;
    ALTER TABLE circles
      DROP COLUMN IF EXISTS review_note;
  `);
}
