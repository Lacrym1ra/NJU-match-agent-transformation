import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS forum_post_views (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_forum_post_views_post_user
      ON forum_post_views(post_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_forum_post_views_viewed_at
      ON forum_post_views(viewed_at DESC);
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`
    DROP TABLE IF EXISTS forum_post_views CASCADE;
  `);
}
