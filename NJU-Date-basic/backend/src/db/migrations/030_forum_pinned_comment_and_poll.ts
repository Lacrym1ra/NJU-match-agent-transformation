import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    ALTER TABLE forum_posts
      ADD COLUMN IF NOT EXISTS pinned_comment_id TEXT REFERENCES forum_comments(id) ON DELETE SET NULL
  `);

  await db.execute(`
    ALTER TABLE forum_posts
      ADD COLUMN IF NOT EXISTS has_poll BOOLEAN NOT NULL DEFAULT FALSE
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_forum_posts_pinned_comment
      ON forum_posts(pinned_comment_id)
      WHERE pinned_comment_id IS NOT NULL
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS forum_poll_options (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
      option_text TEXT NOT NULL,
      display_order INT NOT NULL DEFAULT 0,
      vote_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_forum_poll_options_post_order
      ON forum_poll_options(post_id, display_order)
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS forum_poll_votes (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
      option_id TEXT NOT NULL REFERENCES forum_poll_options(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(post_id, user_id)
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_forum_poll_votes_option
      ON forum_poll_votes(option_id)
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_forum_poll_votes_user_created
      ON forum_poll_votes(user_id, created_at DESC)
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`DROP TABLE IF EXISTS forum_poll_votes`);
  await db.execute(`DROP TABLE IF EXISTS forum_poll_options`);
  await db.execute(`DROP INDEX IF EXISTS idx_forum_posts_pinned_comment`);
  await db.execute(`ALTER TABLE forum_posts DROP COLUMN IF EXISTS has_poll`);
  await db.execute(`ALTER TABLE forum_posts DROP COLUMN IF EXISTS pinned_comment_id`);
}
