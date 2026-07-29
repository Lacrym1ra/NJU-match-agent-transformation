import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    -- ============================================================
    -- 1. forum_comments — root_comment_id for two-level comment system
    -- ============================================================
    ALTER TABLE forum_comments ADD COLUMN IF NOT EXISTS root_comment_id TEXT
      REFERENCES forum_comments(id) ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS idx_forum_comments_root_comment_id
      ON forum_comments(root_comment_id, created_at);

    -- Backfill: set root_comment_id for existing sub-replies using recursive CTE
    WITH RECURSIVE comment_chain AS (
      SELECT id, id AS root_id, parent_comment_id, 1 AS depth
      FROM forum_comments
      WHERE parent_comment_id IS NULL

      UNION ALL

      SELECT c.id, cc.root_id, c.parent_comment_id, cc.depth + 1
      FROM forum_comments c
      INNER JOIN comment_chain cc ON c.parent_comment_id = cc.id
    )
    UPDATE forum_comments c
    SET root_comment_id = cc.root_id
    FROM comment_chain cc
    WHERE c.id = cc.id AND cc.depth > 1;

    -- ============================================================
    -- 2. user_notifications — expand type CHECK constraint
    -- ============================================================
    ALTER TABLE user_notifications DROP CONSTRAINT IF EXISTS user_notifications_type_check;
    ALTER TABLE user_notifications
      ADD CONSTRAINT user_notifications_type_check
      CHECK (type IN (
        'post_liked', 'post_favorited', 'post_replied', 'comment_replied',
        'forum_report_result', 'announcement'
      )) NOT VALID;
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`
    ALTER TABLE forum_comments DROP COLUMN IF EXISTS root_comment_id;

    ALTER TABLE user_notifications DROP CONSTRAINT IF EXISTS user_notifications_type_check;
    ALTER TABLE user_notifications
      ADD CONSTRAINT user_notifications_type_check
      CHECK (type IN (
        'post_liked', 'post_favorited', 'post_replied',
        'forum_report_result', 'announcement'
      ));
  `);
}
