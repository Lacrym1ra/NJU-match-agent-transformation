import { db, queryClient } from './connection.js';
import { up as upCards } from './migrations/003_cards.js';
import { up as upSocial } from './migrations/004_social.js';
import { up as upForum } from './migrations/005_forum.js';
import { up as upCircleCustomProposals } from './migrations/006_circle_custom_proposals.js';
import { up as upUserCircleCustomCards } from './migrations/007_user_circle_custom_cards.js';
import { up as upUserCircleCustomCardsDisplayOrder } from './migrations/008_user_circle_custom_cards_display_order.js';
import { up as upUserCircleCustomCardsLayout } from './migrations/009_user_circle_custom_cards_layout.js';
import { up as upUserCardPreferences } from './migrations/010_user_card_preferences.js';
import { up as upCircleScopedFriendships } from './migrations/011_circle_scoped_friendships.js';
import { up as upContactUnlockCircleScope } from './migrations/012_contact_unlock_circle_scope.js';
import { up as upGlobalFriendshipsAndContactSnapshots } from './migrations/013_global_friendships_and_contact_snapshots.js';
import { up as upCircleMemberStatus } from './migrations/014_circle_member_status.js';
import { up as upCircleOwnership } from './migrations/015_circle_ownership.js';
import { up as upCircleTagsAndStatus } from './migrations/016_circle_tags_and_status.js';
import { up as upForumTypeUpgrade } from './migrations/017_forum_type_upgrade.js';
import { up as upTeamups } from './migrations/018_teamups.js';
import { up as upTeamupType } from './migrations/019_teamup_type.js';
import { up as upReportAdminNote } from './migrations/020_report_admin_note_and_warn_update.js';
import { up as upForumGovernanceCredit } from './migrations/021_forum_governance_credit.js';
import { up as upForumEnhancement } from './migrations/021_forum_enhancement.js';
import { up as upForumTwoLevel } from './migrations/022_forum_comments_two_level.js';
import { up as upCommentInteractions } from './migrations/023_comment_interactions.js';
import { up as upAnnouncementCreatedByNullable } from './migrations/024_announcement_created_by_nullable.js';
import { up as upForumReportsReportedUser } from './migrations/025_forum_reports_reported_user.js';
import { up as upUserReportsReviewedAt } from './migrations/026_user_reports_reviewed_at.js';
import { up as upForumPostViewsDedup } from './migrations/027_forum_post_views_dedup.js';
import { up as upProfileEnhancement } from './migrations/028_profile_enhancement.js';
import { up as upForumRecommendationIndexes } from './migrations/029_forum_recommendation_indexes.js';
import { up as upForumPinnedCommentAndPoll } from './migrations/030_forum_pinned_comment_and_poll.js';
import { up as upForumPostSummaryCover } from './migrations/031_forum_post_summary_cover.js';
import { up as upFollowAndDirectMessages } from './migrations/030_follow_and_direct_messages.js';
import { up as upNotifications } from './migrations/029_notifications.js';
import { up as upCircleServiceManagement } from './migrations/030_circle_service_management.js';
import { up as upContactUnlockFieldKey } from './migrations/031_contact_unlock_field_key.js';
import { up as upCircleContactsAndUnlockGrants } from './migrations/032_circle_contacts_and_unlock_grants.js';
import { up as upContactUnlockPendingScope } from './migrations/033_contact_unlock_pending_scope.js';
import { up as upCircleMemberLocations } from './migrations/034_circle_member_locations.js';
import { up as upMediaDirectMessages } from './migrations/035_media_direct_messages.js';
import { up as upForumCommentImages } from './migrations/036_forum_comment_images.js';
import { up as upRequestWithdrawStatus } from './migrations/035_request_withdraw_status.js';
import { up as upG2RequestExpiryAndNotifications } from './migrations/036_g2_request_expiry_and_notifications.js';
import { up as upG2ContactSecretStorage } from './migrations/037_g2_contact_secret_storage.js';
import { up as upTeamupWaitlist } from './migrations/038_teamup_waitlist.js';
import { up as upTeamupMemberJoinedNotification } from './migrations/039_teamup_member_joined_notification.js';
import { up as upGlobalFriendRequests } from './migrations/040_global_friend_requests.js';
import { up as upCircleChat } from './migrations/041_circle_chat.js';
import { up as upTeamupChat } from './migrations/042_teamup_chat.js';
import { up as upRequestWithdrawNotifications } from './migrations/043_request_withdraw_notifications.js';
import { up as upCircleReviewMetadata } from './migrations/044_circle_review_metadata.js';
import { up as upDirectMessageRecall } from './migrations/045_direct_message_recall.js';
import { up as upForumUserReports } from './migrations/046_forum_user_reports.js';
import { up as upAgentActionRecords } from './migrations/047_agent_action_records.js';

/**
 * Create tables if they don't exist.
 * Using raw SQL for explicit control over constraints.
 */
export async function runMigrations() {
  await queryClient.unsafe(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      nickname TEXT,
      gender TEXT CHECK(gender IN ('male','female')),
      gender_pref TEXT CHECK(gender_pref IN ('male','female','any')),
      intention TEXT CHECK(intention IN ('friend','partner')),
      grade TEXT,
      campus TEXT CHECK(campus IN ('xianlin','gulou','suzhou','pukou')),
      department TEXT,
      mbti TEXT,
      bio TEXT,
      avatar_url TEXT,
      wechat_id TEXT,
      is_participating BOOLEAN DEFAULT TRUE,
      profile_complete BOOLEAN DEFAULT FALSE,
      survey_complete BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_users_matching_eligibility
      ON users(is_participating, profile_complete, survey_complete);

    CREATE TABLE IF NOT EXISTS survey_answers (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
      answers TEXT NOT NULL,
      version TEXT NOT NULL DEFAULT '1.0',
      submitted_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      week_of TEXT NOT NULL,
      user_a_id TEXT NOT NULL REFERENCES users(id),
      user_b_id TEXT NOT NULL REFERENCES users(id),
      score DOUBLE PRECISION NOT NULL,
      dimensions TEXT,
      curator_note TEXT,
      user_a_action TEXT CHECK(user_a_action IN ('ACCEPT','REJECT')),
      user_b_action TEXT CHECK(user_b_action IN ('ACCEPT','REJECT')),
      status TEXT NOT NULL DEFAULT 'LOCKED' CHECK(status IN ('LOCKED','REVEALED','MUTUAL','MISSED','EXPIRED')),
      revealed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_week_user_a ON matches(week_of, user_a_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_week_user_b ON matches(week_of, user_b_id);
    CREATE INDEX IF NOT EXISTS idx_matches_week_status ON matches(week_of, status);
    CREATE INDEX IF NOT EXISTS idx_matches_user_a_created ON matches(user_a_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_matches_user_b_created ON matches(user_b_id, created_at);

    -- Hard guard: a user can have at most one active mainline match per match week.
    CREATE OR REPLACE FUNCTION enforce_single_active_mainline_match()
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.status IN ('LOCKED', 'REVEALED', 'MUTUAL') THEN
        IF EXISTS (
          SELECT 1
          FROM matches m
          WHERE m.id <> NEW.id
            AND m.week_of = NEW.week_of
            AND m.status IN ('LOCKED', 'REVEALED', 'MUTUAL')
            AND (
              m.user_a_id IN (NEW.user_a_id, NEW.user_b_id)
              OR m.user_b_id IN (NEW.user_a_id, NEW.user_b_id)
            )
        ) THEN
          RAISE EXCEPTION 'active mainline match conflict for user % or %', NEW.user_a_id, NEW.user_b_id
            USING ERRCODE = '23505';
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_enforce_single_active_mainline_match ON matches;
    CREATE TRIGGER trg_enforce_single_active_mainline_match
      BEFORE INSERT OR UPDATE OF week_of, user_a_id, user_b_id, status ON matches
      FOR EACH ROW
      EXECUTE FUNCTION enforce_single_active_mainline_match();

    CREATE TABLE IF NOT EXISTS mail_logs (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      week_of TEXT NOT NULL,
      mail_type TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_mail_logs_user_week_type
      ON mail_logs(user_id, week_of, mail_type);
    CREATE INDEX IF NOT EXISTS idx_mail_logs_week_type
      ON mail_logs(week_of, mail_type);

    CREATE TABLE IF NOT EXISTS otp_codes (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      purpose TEXT NOT NULL DEFAULT 'register',
      code TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS pause_until_week TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS auto_paused_at TEXT;
    -- Heartbox prerequisites: student id binding (do NOT store plaintext student id)
    ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id_hash TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id_verified_at TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id_bind_source TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id_last4 TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS heartbox_cooldown_until TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS merged_into_user_id TEXT REFERENCES users(id);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS merged_at TIMESTAMPTZ;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_student_id_hash_unique
      ON users(student_id_hash) WHERE student_id_hash IS NOT NULL;

    -- Heartbox: match source & score visibility
    ALTER TABLE matches ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'weekly';
    ALTER TABLE matches ADD COLUMN IF NOT EXISTS score_visible BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE matches ADD COLUMN IF NOT EXISTS special_label TEXT;
    ALTER TABLE matches ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;
    ALTER TABLE matches ADD COLUMN IF NOT EXISTS consumed_week_of TEXT;
    ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'register';
    UPDATE otp_codes SET purpose = 'register' WHERE purpose IS NULL;

    CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_codes(email);
    CREATE INDEX IF NOT EXISTS idx_otp_email_purpose ON otp_codes(email, purpose);
    CREATE INDEX IF NOT EXISTS idx_otp_email_created ON otp_codes(email, created_at);

    -- Circle Social tables
    CREATE TABLE IF NOT EXISTS circles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      tag TEXT NOT NULL DEFAULT '',
      tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      join_policy TEXT NOT NULL DEFAULT 'public',
      join_question TEXT,
      join_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
      invite_code TEXT,
      invite_code_hash TEXT,
      capacity_limit INT,
      keyword_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
      icon_url TEXT,
      creator_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      member_count INT NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE circles ADD COLUMN IF NOT EXISTS tag TEXT NOT NULL DEFAULT '';
    ALTER TABLE circles ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE circles ADD COLUMN IF NOT EXISTS join_policy TEXT NOT NULL DEFAULT 'public';
    ALTER TABLE circles ADD COLUMN IF NOT EXISTS join_question TEXT;
    ALTER TABLE circles ADD COLUMN IF NOT EXISTS join_questions JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE circles ADD COLUMN IF NOT EXISTS invite_code TEXT;
    ALTER TABLE circles ADD COLUMN IF NOT EXISTS invite_code_hash TEXT;
    ALTER TABLE circles ADD COLUMN IF NOT EXISTS capacity_limit INT;
    ALTER TABLE circles ADD COLUMN IF NOT EXISTS keyword_rules JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE circles ADD COLUMN IF NOT EXISTS creator_id TEXT REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE circles ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
    ALTER TABLE circles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

    UPDATE circles
    SET tags = CASE
      WHEN tag IS NULL OR btrim(tag) = '' THEN '[]'::jsonb
      ELSE jsonb_build_array(tag)
    END
    WHERE tags IS NULL OR tags = '[]'::jsonb;

    UPDATE circles
    SET status = CASE
      WHEN is_active THEN 'active'
      ELSE 'inactive'
    END
    WHERE status IS NULL OR btrim(status) = '';

    CREATE TABLE IF NOT EXISTS circle_questions (
      id TEXT PRIMARY KEY,
      circle_id TEXT NOT NULL REFERENCES circles(id),
      key TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('scale','single_choice','multi_choice','ranking')),
      prompt TEXT NOT NULL,
      options TEXT,
      weight REAL NOT NULL DEFAULT 1.0,
      display_order INT NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS circle_members (
      id TEXT PRIMARY KEY,
      circle_id TEXT NOT NULL REFERENCES circles(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      membership_status TEXT NOT NULL DEFAULT 'active',
      answers TEXT,
      answers_complete BOOLEAN NOT NULL DEFAULT FALSE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      joined_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE circle_members
      ADD COLUMN IF NOT EXISTS membership_status TEXT NOT NULL DEFAULT 'active';

    UPDATE circle_members
    SET membership_status = 'active'
    WHERE membership_status IS NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_circle_members_circle_user
      ON circle_members(circle_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_circle_members_circle_status_active
      ON circle_members(circle_id, membership_status, is_active);
    CREATE INDEX IF NOT EXISTS idx_circle_members_user_status
      ON circle_members(user_id, membership_status);

    CREATE TABLE IF NOT EXISTS circle_member_roles (
      id TEXT PRIMARY KEY,
      circle_id TEXT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_circle_member_roles_circle_user_role
      ON circle_member_roles(circle_id, user_id, role);
    CREATE INDEX IF NOT EXISTS idx_circle_member_roles_circle_role
      ON circle_member_roles(circle_id, role);
    CREATE INDEX IF NOT EXISTS idx_circle_member_roles_user
      ON circle_member_roles(user_id);

    CREATE TABLE IF NOT EXISTS circle_matches (
      id TEXT PRIMARY KEY,
      circle_id TEXT NOT NULL REFERENCES circles(id),
      week_of TEXT NOT NULL,
      user_a_id TEXT NOT NULL REFERENCES users(id),
      user_b_id TEXT NOT NULL REFERENCES users(id),
      score DOUBLE PRECISION NOT NULL,
      user_a_action TEXT CHECK(user_a_action IN ('ACCEPT','REJECT')),
      user_b_action TEXT CHECK(user_b_action IN ('ACCEPT','REJECT')),
      status TEXT NOT NULL DEFAULT 'LOCKED' CHECK(status IN ('LOCKED','REVEALED','MUTUAL','MISSED')),
      revealed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_circle_matches_circle_week_a
      ON circle_matches(circle_id, week_of, user_a_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_circle_matches_circle_week_b
      ON circle_matches(circle_id, week_of, user_b_id);

    -- Safety & Audit tables
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      operator_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      target TEXT,
      detail TEXT,
      ip TEXT,
      result TEXT NOT NULL DEFAULT 'success' CHECK(result IN ('success','failure')),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_audit_logs_operator ON audit_logs(operator_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action   ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created  ON audit_logs(created_at);

    CREATE TABLE IF NOT EXISTS user_blocks (
      id TEXT PRIMARY KEY,
      blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(blocker_id, blocked_id)
    );

    CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks(blocker_id);
    CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks(blocked_id);

    CREATE TABLE IF NOT EXISTS user_reports (
      id TEXT PRIMARY KEY,
      reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reported_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason TEXT NOT NULL,
      detail TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','reviewed','dismissed')),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_user_reports_reporter ON user_reports(reporter_id);
    CREATE INDEX IF NOT EXISTS idx_user_reports_reported ON user_reports(reported_id);
    CREATE INDEX IF NOT EXISTS idx_user_reports_status   ON user_reports(status);

    -- Heartbox tables
    CREATE TABLE IF NOT EXISTS heart_signals (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

      target_student_id_hash TEXT NOT NULL,
      target_student_id_masked TEXT NOT NULL,
      resolved_target_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,

      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','cancelled','matched','expired','suppressed')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      cancelled_at TIMESTAMPTZ,
      matched_at TIMESTAMPTZ
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_heart_signals_active_sender_unique
      ON heart_signals(sender_id) WHERE status = 'active';
    CREATE INDEX IF NOT EXISTS idx_heart_signals_active_target_hash
      ON heart_signals(target_student_id_hash) WHERE status = 'active';
    CREATE INDEX IF NOT EXISTS idx_heart_signals_sender_target_hash
      ON heart_signals(sender_id, target_student_id_hash);

    CREATE TABLE IF NOT EXISTS heart_matches (
      id TEXT PRIMARY KEY,
      user_a_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_b_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

      signal_a_id TEXT REFERENCES heart_signals(id) ON DELETE SET NULL,
      signal_b_id TEXT REFERENCES heart_signals(id) ON DELETE SET NULL,
      main_match_id TEXT REFERENCES matches(id) ON DELETE SET NULL,

      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','queued','dismissed','blocked')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),

      CHECK (user_a_id < user_b_id),
      CHECK (user_a_id <> user_b_id),
      UNIQUE(user_a_id, user_b_id)
    );

    CREATE INDEX IF NOT EXISTS idx_heart_matches_user_a ON heart_matches(user_a_id);
    CREATE INDEX IF NOT EXISTS idx_heart_matches_user_b ON heart_matches(user_b_id);
    CREATE INDEX IF NOT EXISTS idx_heart_matches_status ON heart_matches(status);
  `);

  await upCards(db);
  await upSocial(db);
  await upForum(db);
  await upCircleCustomProposals(db);
  await upUserCircleCustomCards(db);
  await upUserCircleCustomCardsDisplayOrder(db);
  await upUserCircleCustomCardsLayout(db);
  await upUserCardPreferences(db);
  await upCircleScopedFriendships(db);
  await upContactUnlockCircleScope(db);
  await upGlobalFriendshipsAndContactSnapshots(db);
  await upCircleMemberStatus(db);
  await upCircleOwnership(db);
  await upCircleTagsAndStatus(db);
  await upForumTypeUpgrade(db);
  await upTeamups(db);
  await upTeamupType(db);
  await upReportAdminNote(db);
  await upForumGovernanceCredit(db);       // 021: creates forum_reports table (must run before 025)
  await upForumEnhancement(db);
  await upForumTwoLevel(db);
  await upCommentInteractions(db);
  await upAnnouncementCreatedByNullable(db);
  await upForumReportsReportedUser(db);    // 025: depends on forum_reports from 021
  await upUserReportsReviewedAt(db);
  await upForumPostViewsDedup(db);
  await upProfileEnhancement(db);
  await upForumRecommendationIndexes(db);  // 029: pg_trgm + FTS indexes for recommendation
  await upForumPinnedCommentAndPoll(db);   // 030: pinned comments + in-post polls
  await upForumPostSummaryCover(db);       // 031: summary + cover_image_url columns
  await upFollowAndDirectMessages(db);
  await upMediaDirectMessages(db);
  await upForumCommentImages(db);
  await upNotifications(db);
  await upCircleServiceManagement(db);
  await upContactUnlockFieldKey(db);
  await upCircleContactsAndUnlockGrants(db);
  await upContactUnlockPendingScope(db);
  await upCircleMemberLocations(db);
  await upRequestWithdrawStatus(db);
  await upG2RequestExpiryAndNotifications(db);
  await upG2ContactSecretStorage(db);
  await upTeamupWaitlist(db);
  await upTeamupMemberJoinedNotification(db);
  await upGlobalFriendRequests(db);
  await upCircleChat(db);
  await upTeamupChat(db);
  await upRequestWithdrawNotifications(db);
  await upCircleReviewMetadata(db);
  await upDirectMessageRecall(db);
  await upForumUserReports(db);
  await upAgentActionRecords(db);

  console.log('Database migrations completed.');
}
