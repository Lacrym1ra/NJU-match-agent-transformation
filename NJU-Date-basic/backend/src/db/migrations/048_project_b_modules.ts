import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS resonance_capsules (
      id TEXT PRIMARY KEY,
      creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      participant_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      invite_code_hash TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      prompt TEXT NOT NULL,
      creator_response TEXT,
      participant_response TEXT,
      status TEXT NOT NULL DEFAULT 'awaiting_participant'
        CHECK (status IN ('awaiting_participant', 'collecting', 'revealed', 'cancelled')),
      expires_at TIMESTAMPTZ NOT NULL,
      revealed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CHECK (participant_id IS NULL OR participant_id <> creator_id)
    );
    CREATE INDEX IF NOT EXISTS idx_resonance_capsules_creator
      ON resonance_capsules(creator_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_resonance_capsules_participant
      ON resonance_capsules(participant_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS meetup_safety_plans (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      meeting_place TEXT NOT NULL,
      meeting_at TIMESTAMPTZ NOT NULL,
      expected_end_at TIMESTAMPTZ NOT NULL,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'checked_in', 'completed', 'cancelled')),
      checked_in_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      cancelled_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CHECK (expected_end_at > meeting_at)
    );
    CREATE INDEX IF NOT EXISTS idx_meetup_safety_plans_user_status
      ON meetup_safety_plans(user_id, status, meeting_at DESC);
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute('DROP TABLE IF EXISTS meetup_safety_plans; DROP TABLE IF EXISTS resonance_capsules;');
}
