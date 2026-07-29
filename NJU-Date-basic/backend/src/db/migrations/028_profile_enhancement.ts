import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS signature TEXT,
      ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`
    ALTER TABLE users
      DROP COLUMN IF EXISTS tags,
      DROP COLUMN IF EXISTS signature;
  `);
}