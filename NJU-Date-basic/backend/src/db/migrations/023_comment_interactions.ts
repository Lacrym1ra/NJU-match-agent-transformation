import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    -- ============================================================
    -- 1. forum_comments — like_count counter cache
    -- ============================================================
    ALTER TABLE forum_comments ADD COLUMN IF NOT EXISTS like_count INT NOT NULL DEFAULT 0;

    -- ============================================================
    -- 2. forum_comment_likes — comment likes
    -- ============================================================
    CREATE TABLE IF NOT EXISTS forum_comment_likes (
      id TEXT PRIMARY KEY,
      comment_id TEXT NOT NULL REFERENCES forum_comments(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(comment_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_forum_comment_likes_comment
      ON forum_comment_likes(comment_id);
    CREATE INDEX IF NOT EXISTS idx_forum_comment_likes_user
      ON forum_comment_likes(user_id, created_at DESC);

    -- ============================================================
    -- 3. forum_comment_hides — user-hides-comment
    -- ============================================================
    CREATE TABLE IF NOT EXISTS forum_comment_hides (
      id TEXT PRIMARY KEY,
      comment_id TEXT NOT NULL REFERENCES forum_comments(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(comment_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_forum_comment_hides_user
      ON forum_comment_hides(user_id);

    -- ============================================================
    -- 4. user_notifications — allow comment like notifications
    -- ============================================================
    ALTER TABLE user_notifications DROP CONSTRAINT IF EXISTS user_notifications_type_check;
    ALTER TABLE user_notifications
      ADD CONSTRAINT user_notifications_type_check
      CHECK (type IN (
        'post_liked', 'post_favorited', 'post_replied', 'comment_replied',
        'comment_liked', 'forum_report_result', 'announcement'
      )) NOT VALID;
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`
    ALTER TABLE user_notifications DROP CONSTRAINT IF EXISTS user_notifications_type_check;
    ALTER TABLE user_notifications
      ADD CONSTRAINT user_notifications_type_check
      CHECK (type IN (
        'post_liked', 'post_favorited', 'post_replied', 'comment_replied',
        'forum_report_result', 'announcement'
      ));

    DROP TABLE IF EXISTS forum_comment_hides CASCADE;
    DROP TABLE IF EXISTS forum_comment_likes CASCADE;
    ALTER TABLE forum_comments DROP COLUMN IF EXISTS like_count;
  `);
}
