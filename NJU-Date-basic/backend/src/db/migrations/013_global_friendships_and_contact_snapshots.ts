import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS global_friendships (
      id TEXT PRIMARY KEY,
      user_a_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_b_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_global_friendships_users
      ON global_friendships(user_a_id, user_b_id);
    CREATE INDEX IF NOT EXISTS idx_global_friendships_user_a
      ON global_friendships(user_a_id);
    CREATE INDEX IF NOT EXISTS idx_global_friendships_user_b
      ON global_friendships(user_b_id);

    INSERT INTO global_friendships (id, user_a_id, user_b_id, created_at)
    SELECT
      gen_random_uuid()::text,
      f.user_a_id,
      f.user_b_id,
      MIN(f.created_at)
    FROM friendships f
    GROUP BY f.user_a_id, f.user_b_id
    ON CONFLICT (user_a_id, user_b_id) DO NOTHING;

    ALTER TABLE contact_unlock_requests
      ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'circle';
    ALTER TABLE contact_unlock_requests
      ADD COLUMN IF NOT EXISTS card_snapshot JSONB;
    ALTER TABLE contact_unlock_requests
      ALTER COLUMN circle_id DROP NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_contact_unlock_requests_target_status_source
      ON contact_unlock_requests(target_id, status, source_type);
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`
    DROP INDEX IF EXISTS idx_contact_unlock_requests_target_status_source;
    ALTER TABLE contact_unlock_requests
      DROP COLUMN IF EXISTS card_snapshot;
    ALTER TABLE contact_unlock_requests
      DROP COLUMN IF EXISTS source_type;
    DROP TABLE IF EXISTS global_friendships CASCADE;
  `);
}
