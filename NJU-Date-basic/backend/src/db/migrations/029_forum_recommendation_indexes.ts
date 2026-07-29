import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  // pg_trgm extension for accelerated ILIKE queries (%% pattern matching)
  await db.execute(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

  // GIN trigram indexes on title and content for keyword search acceleration
  await db.execute(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_title_trgm
      ON forum_posts USING GIN (title gin_trgm_ops)
  `);

  await db.execute(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_content_trgm
      ON forum_posts USING GIN (content gin_trgm_ops)
  `);

  // GIN index for full-text search on posts (used by recommendation interest matching)
  await db.execute(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_fts
      ON forum_posts USING GIN (
        to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content, ''))
      )
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`DROP INDEX CONCURRENTLY IF EXISTS idx_posts_fts`);
  await db.execute(`DROP INDEX CONCURRENTLY IF EXISTS idx_posts_content_trgm`);
  await db.execute(`DROP INDEX CONCURRENTLY IF EXISTS idx_posts_title_trgm`);
  // Note: pg_trgm extension is intentionally not dropped — other features may depend on it
}
