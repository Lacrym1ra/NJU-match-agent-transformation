import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    -- Message Center: notifications table
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      level TEXT NOT NULL DEFAULT 'info',
      action_url TEXT,
      meta JSONB DEFAULT '{}'::jsonb,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      read_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      deleted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      idempotency_key TEXT NOT NULL UNIQUE
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_user_read
      ON notifications(user_id, is_read, created_at);
    CREATE INDEX IF NOT EXISTS idx_notifications_user_type
      ON notifications(user_id, type, created_at);
    CREATE INDEX IF NOT EXISTS idx_notifications_created_at
      ON notifications(created_at);

    -- Message Center: broadcast_tasks table
    CREATE TABLE IF NOT EXISTS broadcast_tasks (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      level TEXT NOT NULL DEFAULT 'info',
      action_url TEXT,
      target_user_ids JSONB,
      idempotency_scope TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending',
      created_count INTEGER DEFAULT 0,
      skipped_count INTEGER DEFAULT 0,
      total_estimate INTEGER DEFAULT 0,
      started_at TIMESTAMPTZ,
      finished_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`
    DROP TABLE IF EXISTS notifications;
    DROP TABLE IF EXISTS broadcast_tasks;
  `);
}
