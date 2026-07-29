import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS user_circle_custom_cards (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      circle_id TEXT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      value TEXT NOT NULL,
      visibility_level TEXT NOT NULL DEFAULT 'public' CHECK(visibility_level IN ('public','friends','hidden')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
      review_note TEXT,
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_user_circle_custom_cards_user_circle
      ON user_circle_custom_cards(user_id, circle_id);
    CREATE INDEX IF NOT EXISTS idx_user_circle_custom_cards_status_circle
      ON user_circle_custom_cards(status, circle_id);
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`
    DROP TABLE IF EXISTS user_circle_custom_cards CASCADE;
  `);
}
