import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    ALTER TABLE circles
      ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE circles
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

    UPDATE circles
    SET tags = CASE
      WHEN tag IS NULL OR btrim(tag) = '' THEN '[]'::jsonb
      ELSE jsonb_build_array(tag)
    END
    WHERE tags IS NULL OR tags = '[]'::jsonb;

    UPDATE circles
    SET status = CASE
      WHEN is_active THEN 'active'
      ELSE 'inactive'
    END
    WHERE status IS NULL OR btrim(status) = '';

    CREATE INDEX IF NOT EXISTS idx_circles_status ON circles(status);
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`
    DROP INDEX IF EXISTS idx_circles_status;
    ALTER TABLE circles
      DROP COLUMN IF EXISTS status;
    ALTER TABLE circles
      DROP COLUMN IF EXISTS tags;
  `);
}
