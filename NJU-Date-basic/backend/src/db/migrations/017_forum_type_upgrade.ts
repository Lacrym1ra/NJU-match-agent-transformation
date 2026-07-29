import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    -- Map legacy 'post' to 'general' before dropping the old constraint
    UPDATE forum_posts SET type = 'general' WHERE type = 'post';

    -- Drop the old CHECK constraint (inline constraint gets an auto-generated name)
    DO $$
    DECLARE
      constraint_name text;
    BEGIN
      SELECT con.conname INTO constraint_name
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE rel.relname = 'forum_posts'
        AND con.contype = 'c'
        AND pg_get_constraintdef(con.oid) ILIKE '%post%'
        AND pg_get_constraintdef(con.oid) ILIKE '%squad%';

      IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE forum_posts DROP CONSTRAINT %I', constraint_name);
      END IF;
    END $$;

    -- Drop new constraint if exists (idempotent re-run safety)
    ALTER TABLE forum_posts DROP CONSTRAINT IF EXISTS forum_posts_type_check;

    -- Add the new CHECK constraint
    ALTER TABLE forum_posts
      ADD CONSTRAINT forum_posts_type_check
      CHECK (type IN ('general', 'squad', 'help', 'trade', 'activity'));

    -- Update the default to 'general'
    ALTER TABLE forum_posts ALTER COLUMN type SET DEFAULT 'general';
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`
    -- Map new types back to legacy values before restoring the old constraint
    UPDATE forum_posts SET type = 'post' WHERE type IN ('general', 'help', 'trade', 'activity');

    ALTER TABLE forum_posts DROP CONSTRAINT IF EXISTS forum_posts_type_check;

    ALTER TABLE forum_posts ALTER COLUMN type SET DEFAULT 'post';

    ALTER TABLE forum_posts
      ADD CONSTRAINT forum_posts_type_check
      CHECK (type IN ('post', 'squad'));
  `);
}
