import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS user_follows (
      id TEXT PRIMARY KEY,
      follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      followee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      CHECK (follower_id <> followee_id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_follows_unique
      ON user_follows(follower_id, followee_id);
    CREATE INDEX IF NOT EXISTS idx_user_follows_follower
      ON user_follows(follower_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_user_follows_followee
      ON user_follows(followee_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS user_message_settings (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      allow_direct_messages_from TEXT NOT NULL DEFAULT 'all',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE user_message_settings DROP CONSTRAINT IF EXISTS user_message_settings_allow_direct_messages_from_check;
    ALTER TABLE user_message_settings
      ADD CONSTRAINT user_message_settings_allow_direct_messages_from_check
      CHECK (allow_direct_messages_from IN ('all', 'following', 'mutual', 'none'));

    CREATE TABLE IF NOT EXISTS direct_message_conversations (
      id TEXT PRIMARY KEY,
      user_a_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_b_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      last_message_at TIMESTAMPTZ DEFAULT NOW(),
      CHECK (user_a_id < user_b_id),
      CHECK (user_a_id <> user_b_id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_direct_message_conversations_users
      ON direct_message_conversations(user_a_id, user_b_id);
    CREATE INDEX IF NOT EXISTS idx_direct_message_conversations_user_a
      ON direct_message_conversations(user_a_id, last_message_at DESC);
    CREATE INDEX IF NOT EXISTS idx_direct_message_conversations_user_b
      ON direct_message_conversations(user_b_id, last_message_at DESC);

    CREATE TABLE IF NOT EXISTS direct_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES direct_message_conversations(id) ON DELETE CASCADE,
      sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      receiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      read_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation_created
      ON direct_messages(conversation_id, created_at ASC);
    CREATE INDEX IF NOT EXISTS idx_direct_messages_receiver_read
      ON direct_messages(receiver_id, read_at, created_at DESC);
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`
    DROP TABLE IF EXISTS direct_messages CASCADE;
    DROP TABLE IF EXISTS direct_message_conversations CASCADE;
    DROP TABLE IF EXISTS user_message_settings CASCADE;
    DROP TABLE IF EXISTS user_follows CASCADE;
  `);
}
