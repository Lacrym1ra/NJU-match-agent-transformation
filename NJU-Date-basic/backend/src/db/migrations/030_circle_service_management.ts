import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    ALTER TABLE circles ADD COLUMN IF NOT EXISTS join_policy TEXT NOT NULL DEFAULT 'public';
    ALTER TABLE circles ADD COLUMN IF NOT EXISTS join_question TEXT;
    ALTER TABLE circles ADD COLUMN IF NOT EXISTS join_questions JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE circles ADD COLUMN IF NOT EXISTS invite_code TEXT;
    ALTER TABLE circles ADD COLUMN IF NOT EXISTS invite_code_hash TEXT;
    ALTER TABLE circles ADD COLUMN IF NOT EXISTS capacity_limit INT;
    ALTER TABLE circles ADD COLUMN IF NOT EXISTS keyword_rules JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE circles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    UPDATE circles
    SET invite_code_hash = encode(digest(invite_code, 'sha256'), 'hex')
    WHERE invite_code IS NOT NULL
      AND btrim(invite_code) <> ''
      AND invite_code_hash IS NULL;

    UPDATE circles
    SET invite_code = NULL
    WHERE invite_code IS NOT NULL;

    CREATE TABLE IF NOT EXISTS circle_join_requests (
      id TEXT PRIMARY KEY,
      circle_id TEXT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      application_answer TEXT,
      application_answers JSONB,
      application_reason TEXT,
      status TEXT NOT NULL DEFAULT 'pending_review',
      reject_reason TEXT,
      reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_circle_join_requests_pending
      ON circle_join_requests(circle_id, user_id)
      WHERE status = 'pending_review';
    CREATE INDEX IF NOT EXISTS idx_circle_join_requests_circle_status
      ON circle_join_requests(circle_id, status, created_at);
    CREATE INDEX IF NOT EXISTS idx_circle_join_requests_user_status
      ON circle_join_requests(user_id, status, created_at);

    CREATE TABLE IF NOT EXISTS circle_blacklist (
      id TEXT PRIMARY KEY,
      circle_id TEXT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason TEXT,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_circle_blacklist_circle_user
      ON circle_blacklist(circle_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_circle_blacklist_user
      ON circle_blacklist(user_id);

    ALTER TABLE user_notifications DROP CONSTRAINT IF EXISTS user_notifications_type_check;
    ALTER TABLE user_notifications
      ADD CONSTRAINT user_notifications_type_check
      CHECK (type IN (
        'post_liked', 'post_favorited', 'post_replied', 'comment_replied',
        'forum_report_result', 'announcement',
        'circle_join_requested', 'circle_join_approved', 'circle_join_rejected'
      )) NOT VALID;
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`
    ALTER TABLE user_notifications DROP CONSTRAINT IF EXISTS user_notifications_type_check;
    ALTER TABLE user_notifications
      ADD CONSTRAINT user_notifications_type_check
      CHECK (type IN (
        'post_liked', 'post_favorited', 'post_replied', 'comment_replied',
        'forum_report_result', 'announcement'
      ));

    DROP INDEX IF EXISTS idx_circle_blacklist_user;
    DROP INDEX IF EXISTS idx_circle_blacklist_circle_user;
    DROP TABLE IF EXISTS circle_blacklist CASCADE;

    DROP INDEX IF EXISTS idx_circle_join_requests_user_status;
    DROP INDEX IF EXISTS idx_circle_join_requests_circle_status;
    DROP INDEX IF EXISTS idx_circle_join_requests_pending;
    DROP TABLE IF EXISTS circle_join_requests CASCADE;

    ALTER TABLE circles DROP COLUMN IF EXISTS updated_at;
    ALTER TABLE circles DROP COLUMN IF EXISTS keyword_rules;
    ALTER TABLE circles DROP COLUMN IF EXISTS capacity_limit;
    ALTER TABLE circles DROP COLUMN IF EXISTS invite_code_hash;
    ALTER TABLE circles DROP COLUMN IF EXISTS invite_code;
    ALTER TABLE circles DROP COLUMN IF EXISTS join_questions;
    ALTER TABLE circles DROP COLUMN IF EXISTS join_question;
    ALTER TABLE circles DROP COLUMN IF EXISTS join_policy;
  `);
}
