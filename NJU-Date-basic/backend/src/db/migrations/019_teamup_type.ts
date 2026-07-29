import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    ALTER TABLE teamups
      ADD COLUMN IF NOT EXISTS teamup_type TEXT;

    UPDATE teamups
      SET teamup_type = 'short_term'
      WHERE teamup_type IS NULL;

    ALTER TABLE teamups
      ALTER COLUMN teamup_type SET DEFAULT 'short_term';

    ALTER TABLE teamups
      ALTER COLUMN teamup_type SET NOT NULL;

    DO $$
    BEGIN
      ALTER TABLE teamups
        ADD CONSTRAINT chk_teamups_teamup_type
        CHECK (teamup_type IN ('short_term', 'long_term'));
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;

    CREATE INDEX IF NOT EXISTS idx_teamups_circle_type
      ON teamups(circle_id, teamup_type);
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`
    DROP INDEX IF EXISTS idx_teamups_circle_type;
    ALTER TABLE teamups DROP CONSTRAINT IF EXISTS chk_teamups_teamup_type;
    ALTER TABLE teamups DROP COLUMN IF EXISTS teamup_type;
  `);
}
