import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS credit_score INT NOT NULL DEFAULT 100;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS credit_level TEXT NOT NULL DEFAULT 'normal';

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'users_credit_level_check'
      ) THEN
        ALTER TABLE users
          ADD CONSTRAINT users_credit_level_check
          CHECK (credit_level IN ('normal', 'limited', 'banned'));
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS credit_score_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      delta INT NOT NULL,
      reason TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_credit_score_logs_user_created
      ON credit_score_logs(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_credit_score_logs_source
      ON credit_score_logs(source_type, source_id);

    CREATE TABLE IF NOT EXISTS forum_reports (
      id TEXT PRIMARY KEY,
      reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_type TEXT NOT NULL,
      post_id TEXT REFERENCES forum_posts(id) ON DELETE CASCADE,
      comment_id TEXT REFERENCES forum_comments(id) ON DELETE CASCADE,
      reason TEXT NOT NULL,
      detail TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      admin_note TEXT,
      reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE forum_reports DROP CONSTRAINT IF EXISTS forum_reports_target_type_check;
    ALTER TABLE forum_reports
      ADD CONSTRAINT forum_reports_target_type_check
      CHECK (target_type IN ('post', 'comment'));

    ALTER TABLE forum_reports DROP CONSTRAINT IF EXISTS forum_reports_status_check;
    ALTER TABLE forum_reports
      ADD CONSTRAINT forum_reports_status_check
      CHECK (status IN ('pending', 'approved', 'rejected'));

    ALTER TABLE forum_reports DROP CONSTRAINT IF EXISTS forum_reports_target_consistency_check;
    ALTER TABLE forum_reports
      ADD CONSTRAINT forum_reports_target_consistency_check
      CHECK (
        (target_type = 'post' AND post_id IS NOT NULL AND comment_id IS NULL)
        OR
        (target_type = 'comment' AND comment_id IS NOT NULL)
      );

    CREATE INDEX IF NOT EXISTS idx_forum_reports_status_created
      ON forum_reports(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_forum_reports_reporter
      ON forum_reports(reporter_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_forum_reports_post
      ON forum_reports(post_id);
    CREATE INDEX IF NOT EXISTS idx_forum_reports_comment
      ON forum_reports(comment_id);

    CREATE UNIQUE INDEX IF NOT EXISTS uniq_forum_report_pending
      ON forum_reports(reporter_id, target_type, COALESCE(post_id, ''), COALESCE(comment_id, ''))
      WHERE status = 'pending';
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`
    DROP INDEX IF EXISTS uniq_forum_report_pending;
    DROP TABLE IF EXISTS forum_reports CASCADE;
    DROP TABLE IF EXISTS credit_score_logs CASCADE;

    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_credit_level_check;
    ALTER TABLE users DROP COLUMN IF EXISTS credit_level;
    ALTER TABLE users DROP COLUMN IF EXISTS credit_score;
  `);
}
