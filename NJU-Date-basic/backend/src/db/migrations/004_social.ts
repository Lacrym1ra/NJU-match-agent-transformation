import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    ALTER TABLE circle_questions ADD COLUMN IF NOT EXISTS is_channel_tag BOOLEAN DEFAULT FALSE;

    CREATE TABLE IF NOT EXISTS friendships (
      id TEXT PRIMARY KEY,
      user_a_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_b_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    -- Remove duplicate friendships before creating unique index; keep newest by created_at
    DELETE FROM friendships
    WHERE id NOT IN (
      SELECT DISTINCT ON (user_a_id, user_b_id) id
      FROM friendships
      ORDER BY user_a_id, user_b_id, created_at DESC, id DESC
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_friendships_users ON friendships(user_a_id, user_b_id);

    CREATE TABLE IF NOT EXISTS friend_requests (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      receiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      card_snapshot JSONB,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected','withdrawn')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE friend_requests
      ALTER COLUMN card_snapshot TYPE JSONB
      USING CASE
        WHEN card_snapshot IS NULL OR btrim(card_snapshot::text, '"') = '' THEN NULL
        ELSE card_snapshot::jsonb
      END;
    -- Remove duplicate pending requests before creating unique index; keep newest by created_at
    DELETE FROM friend_requests
    WHERE status = 'pending'
      AND id NOT IN (
        SELECT DISTINCT ON (sender_id, receiver_id) id
        FROM friend_requests
        WHERE status = 'pending'
        ORDER BY sender_id, receiver_id, created_at DESC, id DESC
      );
    DROP INDEX IF EXISTS idx_friend_requests_sender_receiver;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_friend_requests_sender_receiver
      ON friend_requests(sender_id, receiver_id)
      WHERE status = 'pending';

    CREATE TABLE IF NOT EXISTS contact_unlock_requests (
      id TEXT PRIMARY KEY,
      requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','withdrawn')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    DROP INDEX IF EXISTS idx_contact_unlock_requests_users;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_unlock_requests_users
      ON contact_unlock_requests(requester_id, target_id)
      WHERE status = 'pending';
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`
    DROP TABLE IF EXISTS contact_unlock_requests CASCADE;
    DROP TABLE IF EXISTS friend_requests CASCADE;
    DROP TABLE IF EXISTS friendships CASCADE;
    ALTER TABLE circle_questions DROP COLUMN IF EXISTS is_channel_tag;
  `);
}
