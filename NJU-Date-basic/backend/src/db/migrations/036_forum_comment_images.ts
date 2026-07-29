import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    ALTER TABLE forum_comments
      ADD COLUMN IF NOT EXISTS image_url TEXT;
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_forum_comments_image_url
      ON forum_comments(image_url);
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`
    DROP INDEX IF EXISTS idx_forum_comments_image_url;
  `);

  await db.execute(`
    ALTER TABLE forum_comments
      DROP COLUMN IF EXISTS image_url;
  `);
}
