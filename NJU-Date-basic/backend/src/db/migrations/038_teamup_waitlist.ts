import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    ALTER TABLE teamup_applications
      ADD COLUMN IF NOT EXISTS application_type TEXT NOT NULL DEFAULT 'join',
      ADD COLUMN IF NOT EXISTS waitlist_joined_at TIMESTAMPTZ;

    ALTER TABLE teamup_applications
      DROP CONSTRAINT IF EXISTS teamup_applications_application_type_check;
    ALTER TABLE teamup_applications
      ADD CONSTRAINT teamup_applications_application_type_check
      CHECK (application_type IN ('join', 'waitlist'));

    CREATE UNIQUE INDEX IF NOT EXISTS idx_teamup_applications_active_waitlist
      ON teamup_applications(teamup_id, applicant_id)
      WHERE application_type = 'waitlist'
        AND status IN ('pending', 'approved')
        AND waitlist_joined_at IS NULL;

    CREATE INDEX IF NOT EXISTS idx_teamup_applications_waitlist_queue
      ON teamup_applications(teamup_id, application_type, status, created_at);
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`
    DROP INDEX IF EXISTS idx_teamup_applications_waitlist_queue;
    DROP INDEX IF EXISTS idx_teamup_applications_active_waitlist;

    ALTER TABLE teamup_applications
      DROP CONSTRAINT IF EXISTS teamup_applications_application_type_check;
    ALTER TABLE teamup_applications
      DROP COLUMN IF EXISTS waitlist_joined_at,
      DROP COLUMN IF EXISTS application_type;
  `);
}
