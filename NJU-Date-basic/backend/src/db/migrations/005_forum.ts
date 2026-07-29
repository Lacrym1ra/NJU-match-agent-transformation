import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS forum_posts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      circle_id TEXT REFERENCES circles(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'post' CHECK(type IN ('post','squad')),
      is_pinned BOOLEAN DEFAULT FALSE,
      is_locked BOOLEAN DEFAULT FALSE,
      view_count INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    );

    ALTER TABLE forum_posts
      ALTER COLUMN circle_id DROP NOT NULL;

    CREATE TABLE IF NOT EXISTS forum_comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      parent_comment_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    );

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'forum_comments_parent_comment_id_fkey'
      ) THEN
        ALTER TABLE forum_comments
          ADD CONSTRAINT forum_comments_parent_comment_id_fkey
          FOREIGN KEY (parent_comment_id) REFERENCES forum_comments(id) ON DELETE CASCADE;
      END IF;
    END $$;
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`
    DROP TABLE IF EXISTS forum_comments CASCADE;
    DROP TABLE IF EXISTS forum_posts CASCADE;
  `);
}
