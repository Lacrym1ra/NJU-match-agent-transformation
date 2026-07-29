import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS teamup_chat_messages (
      id TEXT PRIMARY KEY,
      teamup_id TEXT NOT NULL REFERENCES teamups(id) ON DELETE CASCADE,
      circle_id TEXT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
      sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      client_message_id TEXT NOT NULL,
      content TEXT NOT NULL,
      mentions JSONB NOT NULL DEFAULT '[]'::jsonb,
      status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'deleted')),
      deleted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      deleted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_teamup_chat_messages_teamup_created
      ON teamup_chat_messages(teamup_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_teamup_chat_messages_circle_created
      ON teamup_chat_messages(circle_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_teamup_chat_messages_sender_created
      ON teamup_chat_messages(sender_id, created_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_teamup_chat_messages_sender_client
      ON teamup_chat_messages(teamup_id, sender_id, client_message_id);

    CREATE TABLE IF NOT EXISTS teamup_chat_read_states (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      teamup_id TEXT NOT NULL REFERENCES teamups(id) ON DELETE CASCADE,
      last_read_message_id TEXT REFERENCES teamup_chat_messages(id) ON DELETE SET NULL,
      last_read_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_teamup_chat_read_states_user_teamup
      ON teamup_chat_read_states(user_id, teamup_id);
    CREATE INDEX IF NOT EXISTS idx_teamup_chat_read_states_user_updated
      ON teamup_chat_read_states(user_id, updated_at DESC);
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`
    DROP INDEX IF EXISTS idx_teamup_chat_read_states_user_updated;
    DROP INDEX IF EXISTS idx_teamup_chat_read_states_user_teamup;
    DROP TABLE IF EXISTS teamup_chat_read_states CASCADE;

    DROP INDEX IF EXISTS idx_teamup_chat_messages_sender_client;
    DROP INDEX IF EXISTS idx_teamup_chat_messages_sender_created;
    DROP INDEX IF EXISTS idx_teamup_chat_messages_circle_created;
    DROP INDEX IF EXISTS idx_teamup_chat_messages_teamup_created;
    DROP TABLE IF EXISTS teamup_chat_messages CASCADE;
  `);
}
