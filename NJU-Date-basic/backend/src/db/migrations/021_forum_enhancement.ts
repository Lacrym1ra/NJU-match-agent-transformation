import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    -- ============================================================
    -- 1. forum_posts — enhanced fields
    -- ============================================================
    ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS anonymous_cancelled_at TIMESTAMPTZ;
    ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public';
    ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS like_count INT NOT NULL DEFAULT 0;
    ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS favorite_count INT NOT NULL DEFAULT 0;
    ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS comment_count INT NOT NULL DEFAULT 0;
    ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS hot_score DOUBLE PRECISION NOT NULL DEFAULT 0;
    ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS last_interaction_at TIMESTAMPTZ;
    ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS has_images BOOLEAN NOT NULL DEFAULT FALSE;

    -- visibility CHECK constraint
    ALTER TABLE forum_posts DROP CONSTRAINT IF EXISTS forum_posts_visibility_check;
    ALTER TABLE forum_posts
      ADD CONSTRAINT forum_posts_visibility_check
      CHECK (visibility IN ('public', 'private'));

    -- Backfill: set comment_count from existing undeleted comments
    UPDATE forum_posts fp
    SET comment_count = (
      SELECT COUNT(*) FROM forum_comments fc
      WHERE fc.post_id = fp.id AND fc.deleted_at IS NULL
    );

    -- Backfill: set last_interaction_at to created_at for existing posts
    UPDATE forum_posts SET last_interaction_at = created_at WHERE last_interaction_at IS NULL;

    -- ============================================================
    -- 2. forum_posts — indexes
    -- ============================================================
    CREATE INDEX IF NOT EXISTS idx_forum_posts_hot
      ON forum_posts(deleted_at, visibility, hot_score DESC, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_forum_posts_author_created
      ON forum_posts(user_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_forum_posts_images
      ON forum_posts(has_images, created_at DESC);

    -- ============================================================
    -- 3. forum_comments — enhanced fields (voice + transcript)
    -- ============================================================
    ALTER TABLE forum_comments ADD COLUMN IF NOT EXISTS comment_type TEXT NOT NULL DEFAULT 'text';
    ALTER TABLE forum_comments ADD COLUMN IF NOT EXISTS voice_url TEXT;
    ALTER TABLE forum_comments ADD COLUMN IF NOT EXISTS voice_duration_sec INT;
    ALTER TABLE forum_comments ADD COLUMN IF NOT EXISTS transcript TEXT;
    ALTER TABLE forum_comments ADD COLUMN IF NOT EXISTS transcript_status TEXT NOT NULL DEFAULT 'none';

    -- content becomes nullable (voice comments have no text content)
    ALTER TABLE forum_comments ALTER COLUMN content DROP NOT NULL;

    -- comment_type CHECK constraint
    ALTER TABLE forum_comments DROP CONSTRAINT IF EXISTS forum_comments_comment_type_check;
    ALTER TABLE forum_comments
      ADD CONSTRAINT forum_comments_comment_type_check
      CHECK (comment_type IN ('text', 'voice'));

    -- transcript_status CHECK constraint
    ALTER TABLE forum_comments DROP CONSTRAINT IF EXISTS forum_comments_transcript_status_check;
    ALTER TABLE forum_comments
      ADD CONSTRAINT forum_comments_transcript_status_check
      CHECK (transcript_status IN ('none', 'pending', 'success', 'failed'));

    -- ============================================================
    -- 4. forum_post_images — post media
    -- ============================================================
    CREATE TABLE IF NOT EXISTS forum_post_images (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
      image_url TEXT NOT NULL,
      image_width INT,
      image_height INT,
      display_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_forum_post_images_post
      ON forum_post_images(post_id, display_order);

    -- ============================================================
    -- 5. forum_post_likes — post likes
    -- ============================================================
    CREATE TABLE IF NOT EXISTS forum_post_likes (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(post_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_forum_post_likes_post ON forum_post_likes(post_id);
    CREATE INDEX IF NOT EXISTS idx_forum_post_likes_user ON forum_post_likes(user_id, created_at DESC);

    -- ============================================================
    -- 6. forum_post_favorites — post favorites / bookmarks
    -- ============================================================
    CREATE TABLE IF NOT EXISTS forum_post_favorites (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(post_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_forum_post_favorites_post ON forum_post_favorites(post_id);
    CREATE INDEX IF NOT EXISTS idx_forum_post_favorites_user ON forum_post_favorites(user_id, created_at DESC);

    -- ============================================================
    -- 7. forum_announcements — admin announcements
    -- ============================================================
    CREATE TABLE IF NOT EXISTS forum_announcements (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_by TEXT NOT NULL REFERENCES users(id),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      priority INT NOT NULL DEFAULT 0,
      starts_at TIMESTAMPTZ,
      ends_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_forum_announcements_active_priority
      ON forum_announcements(is_active, priority DESC, created_at DESC);

    -- ============================================================
    -- 8. forum_guestbook_messages — light guestbook / message wall
    -- ============================================================
    CREATE TABLE IF NOT EXISTS forum_guestbook_messages (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'visible',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- status CHECK constraint
    ALTER TABLE forum_guestbook_messages DROP CONSTRAINT IF EXISTS forum_guestbook_messages_status_check;
    ALTER TABLE forum_guestbook_messages
      ADD CONSTRAINT forum_guestbook_messages_status_check
      CHECK (status IN ('visible', 'hidden'));

    CREATE INDEX IF NOT EXISTS idx_forum_guestbook_messages_visible
      ON forum_guestbook_messages(status, created_at DESC);

    -- ============================================================
    -- 9. user_notifications — in-app notification center
    -- ============================================================
    CREATE TABLE IF NOT EXISTS user_notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      meta JSONB,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- type CHECK constraint
    ALTER TABLE user_notifications DROP CONSTRAINT IF EXISTS user_notifications_type_check;
    ALTER TABLE user_notifications
      ADD CONSTRAINT user_notifications_type_check
      CHECK (type IN (
        'post_liked', 'post_favorited', 'post_replied',
        'forum_report_result', 'announcement'
      )) NOT VALID;

    CREATE INDEX IF NOT EXISTS idx_user_notifications_user_unread
      ON user_notifications(user_id, is_read, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_user_notifications_user_created
      ON user_notifications(user_id, created_at DESC);
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`
    -- ============================================================
    -- Drop tables (reverse order — children first)
    -- ============================================================
    DROP TABLE IF EXISTS user_notifications CASCADE;
    DROP TABLE IF EXISTS forum_guestbook_messages CASCADE;
    DROP TABLE IF EXISTS forum_announcements CASCADE;
    DROP TABLE IF EXISTS forum_post_favorites CASCADE;
    DROP TABLE IF EXISTS forum_post_likes CASCADE;
    DROP TABLE IF EXISTS forum_post_images CASCADE;

    -- ============================================================
    -- Revert forum_comments changes
    -- ============================================================
    ALTER TABLE forum_comments DROP CONSTRAINT IF EXISTS forum_comments_transcript_status_check;
    ALTER TABLE forum_comments DROP CONSTRAINT IF EXISTS forum_comments_comment_type_check;

    ALTER TABLE forum_comments DROP COLUMN IF EXISTS transcript_status;
    ALTER TABLE forum_comments DROP COLUMN IF EXISTS transcript;
    ALTER TABLE forum_comments DROP COLUMN IF EXISTS voice_duration_sec;
    ALTER TABLE forum_comments DROP COLUMN IF EXISTS voice_url;
    ALTER TABLE forum_comments DROP COLUMN IF EXISTS comment_type;

    -- Restore content NOT NULL (set empty string for any nulls first)
    UPDATE forum_comments SET content = '' WHERE content IS NULL;
    ALTER TABLE forum_comments ALTER COLUMN content SET NOT NULL;

    -- ============================================================
    -- Revert forum_posts changes
    -- ============================================================
    DROP INDEX IF EXISTS idx_forum_posts_images;
    DROP INDEX IF EXISTS idx_forum_posts_author_created;
    DROP INDEX IF EXISTS idx_forum_posts_hot;

    ALTER TABLE forum_posts DROP CONSTRAINT IF EXISTS forum_posts_visibility_check;

    ALTER TABLE forum_posts DROP COLUMN IF EXISTS has_images;
    ALTER TABLE forum_posts DROP COLUMN IF EXISTS last_interaction_at;
    ALTER TABLE forum_posts DROP COLUMN IF EXISTS hot_score;
    ALTER TABLE forum_posts DROP COLUMN IF EXISTS comment_count;
    ALTER TABLE forum_posts DROP COLUMN IF EXISTS favorite_count;
    ALTER TABLE forum_posts DROP COLUMN IF EXISTS like_count;
    ALTER TABLE forum_posts DROP COLUMN IF EXISTS visibility;
    ALTER TABLE forum_posts DROP COLUMN IF EXISTS anonymous_cancelled_at;
    ALTER TABLE forum_posts DROP COLUMN IF EXISTS is_anonymous;
  `);
}
