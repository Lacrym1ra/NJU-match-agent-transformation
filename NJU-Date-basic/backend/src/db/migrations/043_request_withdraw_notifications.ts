import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    ALTER TABLE user_notifications DROP CONSTRAINT IF EXISTS user_notifications_type_check;
    ALTER TABLE user_notifications
      ADD CONSTRAINT user_notifications_type_check
      CHECK (type IN (
        'post_liked', 'post_favorited', 'post_replied', 'comment_replied',
        'forum_report_result', 'announcement',
        'circle_join_requested', 'circle_join_approved', 'circle_join_rejected', 'circle_join_withdrawn',
        'friend_request_received', 'friend_request_accepted', 'friend_request_rejected', 'friend_request_withdrawn',
        'contact_unlock_received', 'contact_unlock_approved', 'contact_unlock_rejected', 'contact_unlock_withdrawn', 'contact_unlock_revoked',
        'teamup_member_joined',
        'teamup_application_received', 'teamup_application_approved', 'teamup_application_rejected', 'teamup_application_withdrawn',
        'teamup_waitlist_joined', 'teamup_waitlist_promoted', 'teamup_cancelled',
        'circle_recommendation_refreshed'
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
        'forum_report_result', 'announcement',
        'circle_join_requested', 'circle_join_approved', 'circle_join_rejected',
        'friend_request_received', 'friend_request_accepted', 'friend_request_rejected', 'friend_request_withdrawn',
        'contact_unlock_received', 'contact_unlock_approved', 'contact_unlock_rejected', 'contact_unlock_withdrawn', 'contact_unlock_revoked',
        'teamup_member_joined',
        'teamup_application_received', 'teamup_application_approved', 'teamup_application_rejected',
        'teamup_waitlist_joined', 'teamup_waitlist_promoted', 'teamup_cancelled',
        'circle_recommendation_refreshed'
      )) NOT VALID;
  `);
}
