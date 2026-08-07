import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS agent_action_records (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'confirmed', 'consumed', 'failed', 'expired')),
      confirmation_token_hash TEXT,
      confirmation_expires_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ NOT NULL,
      consumed_at TIMESTAMPTZ,
      result JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_agent_action_records_user_status
      ON agent_action_records(user_id, status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_agent_action_records_expiry
      ON agent_action_records(expires_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_action_records_confirmation_hash
      ON agent_action_records(confirmation_token_hash)
      WHERE confirmation_token_hash IS NOT NULL;
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute('DROP TABLE IF EXISTS agent_action_records;');
}
