import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    ALTER TABLE friend_requests
      ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
    UPDATE friend_requests
    SET expires_at = COALESCE(expires_at, created_at + INTERVAL '7 days')
    WHERE expires_at IS NULL;
    ALTER TABLE friend_requests
      ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '7 days');

    ALTER TABLE contact_unlock_requests
      ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
    UPDATE contact_unlock_requests
    SET expires_at = COALESCE(expires_at, created_at + INTERVAL '7 days')
    WHERE expires_at IS NULL;
    ALTER TABLE contact_unlock_requests
      ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '7 days');

    ALTER TABLE friend_requests
      DROP CONSTRAINT IF EXISTS friend_requests_status_check;
    ALTER TABLE friend_requests
      ADD CONSTRAINT friend_requests_status_check
      CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn', 'expired'));

    ALTER TABLE contact_unlock_requests
      DROP CONSTRAINT IF EXISTS contact_unlock_requests_status_check;
    ALTER TABLE contact_unlock_requests
      ADD CONSTRAINT contact_unlock_requests_status_check
      CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn', 'expired', 'revoked'));

    ALTER TABLE user_notifications DROP CONSTRAINT IF EXISTS user_notifications_type_check;
    ALTER TABLE user_notifications
      ADD CONSTRAINT user_notifications_type_check
      CHECK (type IN (
        'post_liked', 'post_favorited', 'post_replied', 'comment_replied',
        'forum_report_result', 'announcement',
        'circle_join_requested', 'circle_join_approved', 'circle_join_rejected',
        'friend_request_received', 'friend_request_accepted', 'friend_request_rejected', 'friend_request_withdrawn',
        'contact_unlock_received', 'contact_unlock_approved', 'contact_unlock_rejected', 'contact_unlock_withdrawn', 'contact_unlock_revoked',
        'teamup_application_received', 'teamup_application_approved', 'teamup_application_rejected',
        'teamup_waitlist_joined', 'teamup_waitlist_promoted', 'teamup_cancelled',
        'circle_recommendation_refreshed'
      )) NOT VALID;
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`
    UPDATE friend_requests
    SET status = 'rejected'
    WHERE status = 'expired';

    ALTER TABLE friend_requests
      DROP CONSTRAINT IF EXISTS friend_requests_status_check;
    ALTER TABLE friend_requests
      ADD CONSTRAINT friend_requests_status_check
      CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn'));

    UPDATE contact_unlock_requests
    SET status = 'rejected'
    WHERE status IN ('expired', 'revoked');

    ALTER TABLE contact_unlock_requests
      DROP CONSTRAINT IF EXISTS contact_unlock_requests_status_check;
    ALTER TABLE contact_unlock_requests
      ADD CONSTRAINT contact_unlock_requests_status_check
      CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn'));

    ALTER TABLE contact_unlock_requests
      DROP COLUMN IF EXISTS revoked_at,
      DROP COLUMN IF EXISTS expires_at;
    ALTER TABLE friend_requests
      DROP COLUMN IF EXISTS expires_at;

    ALTER TABLE user_notifications DROP CONSTRAINT IF EXISTS user_notifications_type_check;
    ALTER TABLE user_notifications
      ADD CONSTRAINT user_notifications_type_check
      CHECK (type IN (
        'post_liked', 'post_favorited', 'post_replied', 'comment_replied',
        'forum_report_result', 'announcement',
        'circle_join_requested', 'circle_join_approved', 'circle_join_rejected'
      ));
  `);
}
