import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    ALTER TABLE forum_reports DROP CONSTRAINT IF EXISTS forum_reports_target_type_check;
    ALTER TABLE forum_reports
      ADD CONSTRAINT forum_reports_target_type_check
      CHECK (target_type IN ('post', 'comment', 'user'));

    ALTER TABLE forum_reports DROP CONSTRAINT IF EXISTS forum_reports_target_consistency_check;
    ALTER TABLE forum_reports
      ADD CONSTRAINT forum_reports_target_consistency_check
      CHECK (
        (target_type = 'post' AND post_id IS NOT NULL AND comment_id IS NULL)
        OR
        (target_type = 'comment' AND comment_id IS NOT NULL)
        OR
        (target_type = 'user' AND reported_user_id IS NOT NULL AND post_id IS NULL AND comment_id IS NULL)
      );

    DROP INDEX IF EXISTS uniq_forum_report_pending;
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_forum_report_pending
      ON forum_reports(
        reporter_id,
        target_type,
        COALESCE(post_id, ''),
        COALESCE(comment_id, ''),
        COALESCE(reported_user_id, '')
      )
      WHERE status = 'pending';
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`
    DELETE FROM forum_reports WHERE target_type = 'user';

    ALTER TABLE forum_reports DROP CONSTRAINT IF EXISTS forum_reports_target_type_check;
    ALTER TABLE forum_reports
      ADD CONSTRAINT forum_reports_target_type_check
      CHECK (target_type IN ('post', 'comment'));

    ALTER TABLE forum_reports DROP CONSTRAINT IF EXISTS forum_reports_target_consistency_check;
    ALTER TABLE forum_reports
      ADD CONSTRAINT forum_reports_target_consistency_check
      CHECK (
        (target_type = 'post' AND post_id IS NOT NULL AND comment_id IS NULL)
        OR
        (target_type = 'comment' AND comment_id IS NOT NULL)
      );

    DROP INDEX IF EXISTS uniq_forum_report_pending;
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_forum_report_pending
      ON forum_reports(reporter_id, target_type, COALESCE(post_id, ''), COALESCE(comment_id, ''))
      WHERE status = 'pending';
  `);
}
