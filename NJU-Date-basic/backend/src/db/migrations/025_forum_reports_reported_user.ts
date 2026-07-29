import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    ALTER TABLE forum_reports
      ADD COLUMN IF NOT EXISTS reported_user_id TEXT;

    UPDATE forum_reports fr
    SET reported_user_id = fp.user_id
    FROM forum_posts fp
    WHERE fr.target_type = 'post'
      AND fr.post_id = fp.id
      AND fr.reported_user_id IS NULL;

    UPDATE forum_reports fr
    SET reported_user_id = fc.user_id
    FROM forum_comments fc
    WHERE fr.target_type = 'comment'
      AND fr.comment_id = fc.id
      AND fr.reported_user_id IS NULL;

    DELETE FROM forum_reports WHERE reported_user_id IS NULL;

    ALTER TABLE forum_reports
      ALTER COLUMN reported_user_id SET NOT NULL;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'forum_reports_reported_user_id_fkey'
      ) THEN
        ALTER TABLE forum_reports
          ADD CONSTRAINT forum_reports_reported_user_id_fkey
          FOREIGN KEY (reported_user_id) REFERENCES users(id) ON DELETE CASCADE;
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS idx_forum_reports_reported
      ON forum_reports(reported_user_id, created_at DESC);
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`
    DROP INDEX IF EXISTS idx_forum_reports_reported;
    ALTER TABLE forum_reports DROP CONSTRAINT IF EXISTS forum_reports_reported_user_id_fkey;
    ALTER TABLE forum_reports DROP COLUMN IF EXISTS reported_user_id;
  `);
}
