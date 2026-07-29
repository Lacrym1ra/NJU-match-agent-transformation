import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  // Add summary and cover_image_url columns to forum_posts
  await db.execute(`ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS summary text`);
  await db.execute(`ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS cover_image_url text`);

  // Backfill summary and cover_image_url for existing posts that have NULL values
  // cover_image_url: grab the first image (lowest display_order) from forum_post_images
  await db.execute(`
    UPDATE forum_posts fp
    SET cover_image_url = (
      SELECT fpi.image_url
      FROM forum_post_images fpi
      WHERE fpi.post_id = fp.id
      ORDER BY fpi.display_order ASC
      LIMIT 1
    )
    WHERE fp.cover_image_url IS NULL
      AND EXISTS (
        SELECT 1 FROM forum_post_images fpi2 WHERE fpi2.post_id = fp.id
      )
  `);

  // summary: strip common HTML tags and truncate to ~100 chars from content
  // Uses regexp_replace to remove HTML tags, then collapses whitespace and truncates
  await db.execute(`
    UPDATE forum_posts
    SET summary = LEFT(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(content, '<[^>]+>', '', 'g'),
          '\\s+', ' ', 'g'
        ),
        '^\\s+|\\s+$', '', 'g'
      ),
      100
    )
    WHERE summary IS NULL AND content IS NOT NULL
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`ALTER TABLE forum_posts DROP COLUMN IF EXISTS summary`);
  await db.execute(`ALTER TABLE forum_posts DROP COLUMN IF EXISTS cover_image_url`);
}
