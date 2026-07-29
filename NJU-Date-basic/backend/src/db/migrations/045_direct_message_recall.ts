import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    ALTER TABLE direct_messages
      ADD COLUMN IF NOT EXISTS recalled_at TIMESTAMPTZ;
    ALTER TABLE direct_messages
      ADD COLUMN IF NOT EXISTS recalled_by_id TEXT REFERENCES users(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_direct_messages_recalled_at
      ON direct_messages(recalled_at);
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`
    DROP INDEX IF EXISTS idx_direct_messages_recalled_at;
    ALTER TABLE direct_messages
      DROP COLUMN IF EXISTS recalled_by_id;
    ALTER TABLE direct_messages
      DROP COLUMN IF EXISTS recalled_at;
  `);
}
