import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS teamups (
      id TEXT PRIMARY KEY,
      circle_id TEXT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
      leader_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      description_preview TEXT NOT NULL,
      max_members INT NOT NULL CHECK (max_members > 1),
      current_member_count INT NOT NULL DEFAULT 1 CHECK (current_member_count >= 0),
      deadline_at TIMESTAMPTZ NOT NULL,
      end_at TIMESTAMPTZ NOT NULL,
      teamup_type TEXT NOT NULL DEFAULT 'short_term' CHECK (teamup_type IN ('short_term', 'long_term')),
      join_mode TEXT NOT NULL CHECK (join_mode IN ('direct', 'approval')),
      is_public BOOLEAN NOT NULL DEFAULT FALSE,
      status TEXT NOT NULL DEFAULT 'recruiting' CHECK (status IN ('recruiting', 'full', 'cancelled')),
      cancel_source TEXT CHECK (cancel_source IS NULL OR cancel_source IN ('leader', 'admin')),
      cancel_reason TEXT,
      cancelled_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      cancelled_at TIMESTAMPTZ,
      forum_post_id TEXT,
      forum_post_author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      forum_sync_status TEXT NOT NULL DEFAULT 'none' CHECK (forum_sync_status IN ('none', 'pending', 'synced', 'failed')),
      forum_sync_error TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CHECK (end_at > deadline_at)
    );

    CREATE INDEX IF NOT EXISTS idx_teamups_circle_status_end
      ON teamups(circle_id, status, end_at);
    CREATE INDEX IF NOT EXISTS idx_teamups_circle_public
      ON teamups(circle_id, is_public, forum_sync_status);
    CREATE INDEX IF NOT EXISTS idx_teamups_leader
      ON teamups(leader_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_teamups_forum_post
      ON teamups(forum_post_id);

    CREATE TABLE IF NOT EXISTS teamup_members (
      id TEXT PRIMARY KEY,
      teamup_id TEXT NOT NULL REFERENCES teamups(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      member_role TEXT NOT NULL CHECK (member_role IN ('leader', 'member')),
      membership_status TEXT NOT NULL DEFAULT 'active' CHECK (membership_status IN ('active', 'left', 'cancelled')),
      joined_at TIMESTAMPTZ DEFAULT NOW(),
      left_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_teamup_members_teamup_user
      ON teamup_members(teamup_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_teamup_members_teamup_status
      ON teamup_members(teamup_id, membership_status);
    CREATE INDEX IF NOT EXISTS idx_teamup_members_user_status
      ON teamup_members(user_id, membership_status);

    CREATE TABLE IF NOT EXISTS teamup_member_contacts (
      id TEXT PRIMARY KEY,
      teamup_id TEXT NOT NULL REFERENCES teamups(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      contacts JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_teamup_member_contacts_teamup_user
      ON teamup_member_contacts(teamup_id, user_id);

    CREATE TABLE IF NOT EXISTS teamup_applications (
      id TEXT PRIMARY KEY,
      teamup_id TEXT NOT NULL REFERENCES teamups(id) ON DELETE CASCADE,
      applicant_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      application_note TEXT NOT NULL,
      card_snapshot JSONB NOT NULL,
      card_snapshot_view TEXT NOT NULL CHECK (card_snapshot_view IN ('public', 'friend')),
      card_snapshot_relationship TEXT NOT NULL CHECK (card_snapshot_relationship IN ('not_friend', 'friend')),
      contact_payload JSONB NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
      reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      review_note TEXT,
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_teamup_applications_pending
      ON teamup_applications(teamup_id, applicant_id)
      WHERE status = 'pending';
    CREATE INDEX IF NOT EXISTS idx_teamup_applications_teamup_status
      ON teamup_applications(teamup_id, status);
    CREATE INDEX IF NOT EXISTS idx_teamup_applications_applicant_status
      ON teamup_applications(applicant_id, status);

    CREATE TABLE IF NOT EXISTS teamup_forum_sync_jobs (
      id TEXT PRIMARY KEY,
      teamup_id TEXT NOT NULL REFERENCES teamups(id) ON DELETE CASCADE,
      action TEXT NOT NULL CHECK (action IN ('create', 'update', 'archive')),
      payload JSONB NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'succeeded', 'failed')),
      attempt_count INT NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
      next_retry_at TIMESTAMPTZ,
      last_error TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_teamup_forum_sync_jobs_status_retry
      ON teamup_forum_sync_jobs(status, next_retry_at);
    CREATE INDEX IF NOT EXISTS idx_teamup_forum_sync_jobs_teamup
      ON teamup_forum_sync_jobs(teamup_id, created_at);
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`
    DROP INDEX IF EXISTS idx_teamup_forum_sync_jobs_teamup;
    DROP INDEX IF EXISTS idx_teamup_forum_sync_jobs_status_retry;
    DROP TABLE IF EXISTS teamup_forum_sync_jobs CASCADE;

    DROP INDEX IF EXISTS idx_teamup_applications_applicant_status;
    DROP INDEX IF EXISTS idx_teamup_applications_teamup_status;
    DROP INDEX IF EXISTS idx_teamup_applications_pending;
    DROP TABLE IF EXISTS teamup_applications CASCADE;

    DROP INDEX IF EXISTS idx_teamup_member_contacts_teamup_user;
    DROP TABLE IF EXISTS teamup_member_contacts CASCADE;

    DROP INDEX IF EXISTS idx_teamup_members_user_status;
    DROP INDEX IF EXISTS idx_teamup_members_teamup_status;
    DROP INDEX IF EXISTS idx_teamup_members_teamup_user;
    DROP TABLE IF EXISTS teamup_members CASCADE;

    DROP INDEX IF EXISTS idx_teamups_forum_post;
    DROP INDEX IF EXISTS idx_teamups_leader;
    DROP INDEX IF EXISTS idx_teamups_circle_public;
    DROP INDEX IF EXISTS idx_teamups_circle_status_end;
    DROP TABLE IF EXISTS teamups CASCADE;
  `);
}
