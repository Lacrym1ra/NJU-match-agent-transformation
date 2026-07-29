-- NJU-Date interest-circle bootstrap data for PostgreSQL
-- Sample login accounts:
--   1) circle.seed@smail.nju.edu.cn / NJUdate123
--   2) circle.peer@smail.nju.edu.cn / NJUdate123
--   3) circle.waitlist@smail.nju.edu.cn / NJUdate123
-- Admin console:
--   /admin, admin key: nju-date-admin-test
--
-- What this script does:
--   - creates the tables that the current circle flow depends on
--   - seeds three test users and one fixed admin key via docker-compose
--   - seeds one fully joined circle and one discoverable circle with the new
--     creator / tags / status / member-role structure
--   - seeds base cards, circle cards, questionnaire answers, teamups, a current
--     circle match, nearby locations, join-review data, forum posts/comments,
--     and admin-review samples
--
-- Safe to rerun: it only resets the sample records declared in this file.

BEGIN;

SET TIME ZONE 'Asia/Shanghai';

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Core users / auth / matching tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  nickname TEXT,
  gender TEXT CHECK (gender IN ('male', 'female')),
  gender_pref TEXT CHECK (gender_pref IN ('male', 'female', 'any')),
  intention TEXT CHECK (intention IN ('friend', 'partner')),
  grade TEXT,
  campus TEXT CHECK (campus IN ('xianlin', 'gulou', 'suzhou', 'pukou')),
  department TEXT,
  mbti TEXT,
  bio TEXT,
  signature TEXT,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  avatar_url TEXT,
  wechat_id TEXT,
  is_participating BOOLEAN DEFAULT TRUE,
  pause_until_week TEXT,
  auto_paused_at TEXT,
  email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  profile_complete BOOLEAN DEFAULT FALSE,
  survey_complete BOOLEAN DEFAULT FALSE,
  student_id_hash TEXT UNIQUE,
  student_id_verified_at TIMESTAMPTZ,
  student_id_bind_source TEXT,
  student_id_last4 TEXT,
  heartbox_cooldown_until TIMESTAMPTZ,
  credit_score INT NOT NULL DEFAULT 100,
  credit_level TEXT NOT NULL DEFAULT 'normal',
  merged_into_user_id TEXT REFERENCES users(id),
  merged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS signature TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pause_until_week TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auto_paused_at TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id_hash TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id_bind_source TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id_last4 TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS heartbox_cooldown_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS credit_score INT NOT NULL DEFAULT 100;
ALTER TABLE users ADD COLUMN IF NOT EXISTS credit_level TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE users ADD COLUMN IF NOT EXISTS merged_into_user_id TEXT REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS merged_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_matching_eligibility
  ON users (is_participating, profile_complete, survey_complete);

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
  user_a_action TEXT CHECK (user_a_action IN ('ACCEPT', 'REJECT')),
  user_b_action TEXT CHECK (user_b_action IN ('ACCEPT', 'REJECT')),
  status TEXT NOT NULL DEFAULT 'LOCKED' CHECK (status IN ('LOCKED', 'REVEALED', 'MUTUAL', 'MISSED', 'EXPIRED')),
  revealed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_week_user_a ON matches (week_of, user_a_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_week_user_b ON matches (week_of, user_b_id);
CREATE INDEX IF NOT EXISTS idx_matches_week_status ON matches (week_of, status);
CREATE INDEX IF NOT EXISTS idx_matches_user_a_created ON matches (user_a_id, created_at);
CREATE INDEX IF NOT EXISTS idx_matches_user_b_created ON matches (user_b_id, created_at);

CREATE TABLE IF NOT EXISTS mail_logs (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  week_of TEXT NOT NULL,
  mail_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mail_logs_user_week_type
  ON mail_logs (user_id, week_of, mail_type);
CREATE INDEX IF NOT EXISTS idx_mail_logs_week_type
  ON mail_logs (week_of, mail_type);

CREATE TABLE IF NOT EXISTS otp_codes (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'register',
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'register';

CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_codes (email);
CREATE INDEX IF NOT EXISTS idx_otp_email_purpose ON otp_codes (email, purpose);
CREATE INDEX IF NOT EXISTS idx_otp_email_created ON otp_codes (email, created_at);

-- ---------------------------------------------------------------------------
-- Circle tables
-- ---------------------------------------------------------------------------

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
  review_note TEXT,
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
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
ALTER TABLE circles ADD COLUMN IF NOT EXISTS review_note TEXT;
ALTER TABLE circles ADD COLUMN IF NOT EXISTS reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE circles ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE circles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS circle_questions (
  id TEXT PRIMARY KEY,
  circle_id TEXT NOT NULL REFERENCES circles(id),
  key TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('scale', 'single_choice', 'multi_choice', 'ranking')),
  prompt TEXT NOT NULL,
  options TEXT,
  weight REAL NOT NULL DEFAULT 1.0,
  display_order INT NOT NULL DEFAULT 0,
  is_channel_tag BOOLEAN DEFAULT FALSE
);

ALTER TABLE circle_questions ADD COLUMN IF NOT EXISTS is_channel_tag BOOLEAN DEFAULT FALSE;

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

CREATE UNIQUE INDEX IF NOT EXISTS idx_circle_members_circle_user
  ON circle_members (circle_id, user_id);

CREATE TABLE IF NOT EXISTS circle_member_roles (
  id TEXT PRIMARY KEY,
  circle_id TEXT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_circle_member_roles_circle_user_role
  ON circle_member_roles (circle_id, user_id, role);

CREATE TABLE IF NOT EXISTS circle_join_requests (
  id TEXT PRIMARY KEY,
  circle_id TEXT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_answer TEXT,
  application_answers JSONB,
  application_reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected', 'expired', 'withdrawn')),
  reject_reason TEXT,
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_circle_join_requests_pending
  ON circle_join_requests (circle_id, user_id)
  WHERE status = 'pending_review';
CREATE INDEX IF NOT EXISTS idx_circle_join_requests_circle_status
  ON circle_join_requests (circle_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_circle_join_requests_user_status
  ON circle_join_requests (user_id, status, created_at);

CREATE TABLE IF NOT EXISTS circle_member_locations (
  id TEXT PRIMARY KEY,
  circle_id TEXT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy_meters INT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  captured_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_circle_member_locations_circle_user
  ON circle_member_locations (circle_id, user_id);
CREATE INDEX IF NOT EXISTS idx_circle_member_locations_circle_enabled_expires
  ON circle_member_locations (circle_id, is_enabled, expires_at);
CREATE INDEX IF NOT EXISTS idx_circle_member_locations_circle_geo
  ON circle_member_locations (circle_id, is_enabled, latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_circle_member_locations_user
  ON circle_member_locations (user_id);

CREATE TABLE IF NOT EXISTS circle_member_location_cooldowns (
  id TEXT PRIMARY KEY,
  circle_id TEXT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_updated_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_circle_member_location_cooldowns_circle_user
  ON circle_member_location_cooldowns (circle_id, user_id);
CREATE INDEX IF NOT EXISTS idx_circle_member_location_cooldowns_user
  ON circle_member_location_cooldowns (user_id);

CREATE TABLE IF NOT EXISTS circle_matches (
  id TEXT PRIMARY KEY,
  circle_id TEXT NOT NULL REFERENCES circles(id),
  week_of TEXT NOT NULL,
  user_a_id TEXT NOT NULL REFERENCES users(id),
  user_b_id TEXT NOT NULL REFERENCES users(id),
  score DOUBLE PRECISION NOT NULL,
  user_a_action TEXT CHECK (user_a_action IN ('ACCEPT', 'REJECT')),
  user_b_action TEXT CHECK (user_b_action IN ('ACCEPT', 'REJECT')),
  status TEXT NOT NULL DEFAULT 'LOCKED' CHECK (status IN ('LOCKED', 'REVEALED', 'MUTUAL', 'MISSED')),
  revealed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_circle_matches_circle_week_a
  ON circle_matches (circle_id, week_of, user_a_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_circle_matches_circle_week_b
  ON circle_matches (circle_id, week_of, user_b_id);

-- ---------------------------------------------------------------------------
-- Safety / audit tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  operator_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target TEXT,
  detail TEXT,
  ip TEXT,
  result TEXT NOT NULL DEFAULT 'success' CHECK (result IN ('success', 'failure')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_operator ON audit_logs (operator_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at);

CREATE TABLE IF NOT EXISTS user_blocks (
  id TEXT PRIMARY KEY,
  blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks (blocker_id);

CREATE TABLE IF NOT EXISTS user_reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  detail TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_reports_reporter ON user_reports (reporter_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_reported ON user_reports (reported_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_status ON user_reports (status);

-- ---------------------------------------------------------------------------
-- Card tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS card_modules (
  id TEXT PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('basic', 'contact', 'interests', 'game')),
  is_system BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS user_cards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  modules JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_cards
  ALTER COLUMN modules TYPE JSONB
  USING CASE
    WHEN modules IS NULL OR btrim(modules::text, '"') = '' THEN '[]'::jsonb
    ELSE modules::jsonb
  END;
ALTER TABLE user_cards
  ALTER COLUMN modules SET DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS user_card_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  hidden_preview_mode TEXT NOT NULL DEFAULT 'titles_only'
    CHECK (hidden_preview_mode IN ('titles_only', 'fully_hidden')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS circle_card_overrides (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  circle_id TEXT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  overrides JSONB NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE circle_card_overrides
  ALTER COLUMN overrides TYPE JSONB
  USING CASE
    WHEN overrides IS NULL OR btrim(overrides::text, '"') = '' THEN '{}'::jsonb
    ELSE overrides::jsonb
  END;
ALTER TABLE circle_card_overrides
  ALTER COLUMN overrides SET DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_circle_card_overrides_user_circle
  ON circle_card_overrides (user_id, circle_id);

CREATE TABLE IF NOT EXISTS base_card_components (
  id TEXT PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_key TEXT
);

CREATE TABLE IF NOT EXISTS user_base_cards (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  components JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_base_cards
  ALTER COLUMN components TYPE JSONB
  USING CASE
    WHEN components IS NULL OR btrim(components::text, '"') = '' THEN '[]'::jsonb
    ELSE components::jsonb
  END;
ALTER TABLE user_base_cards
  ALTER COLUMN components SET DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS user_circle_cards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  circle_id TEXT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  components JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_circle_cards
  ALTER COLUMN components TYPE JSONB
  USING CASE
    WHEN components IS NULL OR btrim(components::text, '"') = '' THEN '[]'::jsonb
    ELSE components::jsonb
  END;
ALTER TABLE user_circle_cards
  ALTER COLUMN components SET DEFAULT '[]'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_circle_cards_user_circle
  ON user_circle_cards (user_id, circle_id);

CREATE TABLE IF NOT EXISTS user_circle_custom_cards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  circle_id TEXT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  value TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  top_left_x INT NOT NULL DEFAULT 0,
  top_left_y INT NOT NULL DEFAULT 0,
  width INT NOT NULL DEFAULT 1,
  height INT NOT NULL DEFAULT 1,
  visibility_level TEXT NOT NULL DEFAULT 'public' CHECK (visibility_level IN ('public', 'friends', 'hidden')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_note TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_circle_custom_cards ADD COLUMN IF NOT EXISTS display_order INT NOT NULL DEFAULT 0;
ALTER TABLE user_circle_custom_cards ADD COLUMN IF NOT EXISTS top_left_x INT NOT NULL DEFAULT 0;
ALTER TABLE user_circle_custom_cards ADD COLUMN IF NOT EXISTS top_left_y INT NOT NULL DEFAULT 0;
ALTER TABLE user_circle_custom_cards ADD COLUMN IF NOT EXISTS width INT NOT NULL DEFAULT 1;
ALTER TABLE user_circle_custom_cards ADD COLUMN IF NOT EXISTS height INT NOT NULL DEFAULT 1;
ALTER TABLE user_circle_custom_cards ADD COLUMN IF NOT EXISTS visibility_level TEXT NOT NULL DEFAULT 'public';
ALTER TABLE user_circle_custom_cards ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE user_circle_custom_cards ADD COLUMN IF NOT EXISTS review_note TEXT;
ALTER TABLE user_circle_custom_cards ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_circle_custom_cards_user_circle
  ON user_circle_custom_cards (user_id, circle_id);
CREATE INDEX IF NOT EXISTS idx_user_circle_custom_cards_status_circle
  ON user_circle_custom_cards (status, circle_id);

-- ---------------------------------------------------------------------------
-- Social / forum tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS friendships (
  id TEXT PRIMARY KEY,
  circle_id TEXT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  user_a_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE friendships
  ADD COLUMN IF NOT EXISTS circle_id TEXT REFERENCES circles(id) ON DELETE CASCADE;

DROP INDEX IF EXISTS idx_friendships_users;
DROP INDEX IF EXISTS idx_friendships_circle_users;
DROP INDEX IF EXISTS idx_friendships_user_a_circle;
DROP INDEX IF EXISTS idx_friendships_user_b_circle;
CREATE UNIQUE INDEX IF NOT EXISTS idx_friendships_circle_users
  ON friendships (circle_id, user_a_id, user_b_id);

CREATE INDEX IF NOT EXISTS idx_friendships_user_a_circle
  ON friendships (user_a_id, circle_id);

CREATE INDEX IF NOT EXISTS idx_friendships_user_b_circle
  ON friendships (user_b_id, circle_id);

CREATE TABLE IF NOT EXISTS global_friendships (
  id TEXT PRIMARY KEY,
  user_a_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL DEFAULT 'circle',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE global_friendships
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'circle';
ALTER TABLE global_friendships
  DROP CONSTRAINT IF EXISTS global_friendships_source_type_check;
ALTER TABLE global_friendships
  ADD CONSTRAINT global_friendships_source_type_check
  CHECK (source_type IN ('circle', 'global')) NOT VALID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_global_friendships_users
  ON global_friendships (user_a_id, user_b_id);

CREATE INDEX IF NOT EXISTS idx_global_friendships_user_a
  ON global_friendships (user_a_id);

CREATE INDEX IF NOT EXISTS idx_global_friendships_user_b
  ON global_friendships (user_b_id);

CREATE TABLE IF NOT EXISTS friend_requests (
  id TEXT PRIMARY KEY,
  circle_id TEXT REFERENCES circles(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL DEFAULT 'circle',
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_snapshot JSONB,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn', 'expired')),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE friend_requests
  ADD COLUMN IF NOT EXISTS circle_id TEXT REFERENCES circles(id) ON DELETE CASCADE;
ALTER TABLE friend_requests
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'circle';
ALTER TABLE friend_requests
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days');
ALTER TABLE friend_requests
  ALTER COLUMN circle_id DROP NOT NULL;
ALTER TABLE friend_requests
  DROP CONSTRAINT IF EXISTS friend_requests_status_check;
ALTER TABLE friend_requests
  ADD CONSTRAINT friend_requests_status_check
  CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn', 'expired')) NOT VALID;
ALTER TABLE friend_requests
  DROP CONSTRAINT IF EXISTS friend_requests_source_type_check;
ALTER TABLE friend_requests
  ADD CONSTRAINT friend_requests_source_type_check
  CHECK (source_type IN ('circle', 'global')) NOT VALID;

ALTER TABLE friend_requests
  ALTER COLUMN card_snapshot TYPE JSONB
  USING CASE
    WHEN card_snapshot IS NULL OR btrim(card_snapshot::text, '"') = '' THEN NULL
    ELSE card_snapshot::jsonb
  END;

DROP INDEX IF EXISTS idx_friend_requests_sender_receiver;
DROP INDEX IF EXISTS idx_friend_requests_circle_sender_receiver;
CREATE UNIQUE INDEX IF NOT EXISTS idx_friend_requests_circle_sender_receiver
  ON friend_requests (circle_id, sender_id, receiver_id)
  WHERE status = 'pending' AND source_type = 'circle';

CREATE UNIQUE INDEX IF NOT EXISTS idx_friend_requests_circle_pair_pending
  ON friend_requests (circle_id, LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id))
  WHERE status = 'pending' AND source_type = 'circle';

CREATE UNIQUE INDEX IF NOT EXISTS idx_friend_requests_global_sender_receiver
  ON friend_requests (sender_id, receiver_id)
  WHERE status = 'pending' AND source_type = 'global';

CREATE UNIQUE INDEX IF NOT EXISTS idx_friend_requests_global_pair_pending
  ON friend_requests (LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id))
  WHERE status = 'pending' AND source_type = 'global';

CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver_status_circle
  ON friend_requests (receiver_id, status, circle_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver_status_source
  ON friend_requests (receiver_id, status, source_type, circle_id);

CREATE TABLE IF NOT EXISTS contact_unlock_requests (
  id TEXT PRIMARY KEY,
  circle_id TEXT REFERENCES circles(id) ON DELETE CASCADE,
  requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL DEFAULT 'circle',
  field_key TEXT NOT NULL DEFAULT 'contact_primary',
  card_snapshot JSONB,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn', 'expired', 'revoked')),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE contact_unlock_requests
  ADD COLUMN IF NOT EXISTS circle_id TEXT REFERENCES circles(id) ON DELETE CASCADE;
ALTER TABLE contact_unlock_requests
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'circle';
ALTER TABLE contact_unlock_requests
  ADD COLUMN IF NOT EXISTS field_key TEXT NOT NULL DEFAULT 'contact_primary';
ALTER TABLE contact_unlock_requests
  ADD COLUMN IF NOT EXISTS card_snapshot JSONB;
ALTER TABLE contact_unlock_requests
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days');
ALTER TABLE contact_unlock_requests
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE contact_unlock_requests
  DROP CONSTRAINT IF EXISTS contact_unlock_requests_status_check;
ALTER TABLE contact_unlock_requests
  ADD CONSTRAINT contact_unlock_requests_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn', 'expired', 'revoked')) NOT VALID;

DROP INDEX IF EXISTS idx_contact_unlock_requests_users;
DROP INDEX IF EXISTS idx_contact_unlock_requests_users_field_pending;
DROP INDEX IF EXISTS idx_contact_unlock_requests_circle_pending;
DROP INDEX IF EXISTS idx_contact_unlock_requests_address_book_pending;
CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_unlock_requests_circle_pending
  ON contact_unlock_requests (requester_id, target_id, circle_id)
  WHERE status = 'pending' AND source_type = 'circle';
CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_unlock_requests_address_book_pending
  ON contact_unlock_requests (requester_id, target_id)
  WHERE status = 'pending' AND source_type = 'address_book';

CREATE INDEX IF NOT EXISTS idx_contact_unlock_requests_target_status_circle
  ON contact_unlock_requests (target_id, status, circle_id);
CREATE INDEX IF NOT EXISTS idx_contact_unlock_requests_rejected_field
  ON contact_unlock_requests (requester_id, target_id, field_key, status, updated_at);

CREATE TABLE IF NOT EXISTS user_circle_contacts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  circle_id TEXT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  value TEXT,
  contact_secret_id TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_circle_contacts ADD COLUMN IF NOT EXISTS contact_secret_id TEXT;
ALTER TABLE user_circle_contacts ALTER COLUMN value DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_circle_contacts_user_circle_field
  ON user_circle_contacts (user_id, circle_id, field_key);
CREATE INDEX IF NOT EXISTS idx_user_circle_contacts_user_circle
  ON user_circle_contacts (user_id, circle_id, display_order);
CREATE INDEX IF NOT EXISTS idx_user_circle_contacts_secret
  ON user_circle_contacts (contact_secret_id);

CREATE TABLE IF NOT EXISTS contact_unlock_grants (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES contact_unlock_requests(id) ON DELETE CASCADE,
  requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  circle_id TEXT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL REFERENCES user_circle_contacts(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_unlock_grants_unique_contact
  ON contact_unlock_grants (requester_id, target_id, circle_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_unlock_grants_request
  ON contact_unlock_grants (request_id);
CREATE INDEX IF NOT EXISTS idx_contact_unlock_grants_lookup
  ON contact_unlock_grants (requester_id, target_id, circle_id, status);

CREATE TABLE IF NOT EXISTS forum_posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  circle_id TEXT REFERENCES circles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'general' CHECK (type IN ('general', 'squad', 'help', 'trade', 'activity')),
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  anonymous_cancelled_at TIMESTAMPTZ,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  is_pinned BOOLEAN DEFAULT FALSE,
  is_locked BOOLEAN DEFAULT FALSE,
  like_count INT NOT NULL DEFAULT 0,
  favorite_count INT NOT NULL DEFAULT 0,
  comment_count INT NOT NULL DEFAULT 0,
  view_count INT DEFAULT 0,
  hot_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  last_interaction_at TIMESTAMPTZ,
  has_images BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE forum_posts
  ALTER COLUMN circle_id DROP NOT NULL;
ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS anonymous_cancelled_at TIMESTAMPTZ;
ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public';
ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS like_count INT NOT NULL DEFAULT 0;
ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS favorite_count INT NOT NULL DEFAULT 0;
ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS comment_count INT NOT NULL DEFAULT 0;
ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS hot_score DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS last_interaction_at TIMESTAMPTZ;
ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS has_images BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE forum_posts DROP CONSTRAINT IF EXISTS forum_posts_type_check;
ALTER TABLE forum_posts
  ADD CONSTRAINT forum_posts_type_check
  CHECK (type IN ('general', 'squad', 'help', 'trade', 'activity')) NOT VALID;
ALTER TABLE forum_posts ALTER COLUMN type SET DEFAULT 'general';
ALTER TABLE forum_posts DROP CONSTRAINT IF EXISTS forum_posts_visibility_check;
ALTER TABLE forum_posts
  ADD CONSTRAINT forum_posts_visibility_check
  CHECK (visibility IN ('public', 'private')) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_forum_posts_hot
  ON forum_posts (deleted_at, visibility, hot_score DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_posts_author_created
  ON forum_posts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_posts_images
  ON forum_posts (has_images, created_at DESC);

CREATE TABLE IF NOT EXISTS forum_comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT,
  comment_type TEXT NOT NULL DEFAULT 'text' CHECK (comment_type IN ('text', 'voice')),
  voice_url TEXT,
  voice_duration_sec INT,
  transcript TEXT,
  transcript_status TEXT NOT NULL DEFAULT 'none' CHECK (transcript_status IN ('none', 'pending', 'success', 'failed')),
  parent_comment_id TEXT,
  root_comment_id TEXT,
  like_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE forum_comments ADD COLUMN IF NOT EXISTS comment_type TEXT NOT NULL DEFAULT 'text';
ALTER TABLE forum_comments ADD COLUMN IF NOT EXISTS voice_url TEXT;
ALTER TABLE forum_comments ADD COLUMN IF NOT EXISTS voice_duration_sec INT;
ALTER TABLE forum_comments ADD COLUMN IF NOT EXISTS transcript TEXT;
ALTER TABLE forum_comments ADD COLUMN IF NOT EXISTS transcript_status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE forum_comments ADD COLUMN IF NOT EXISTS root_comment_id TEXT;
ALTER TABLE forum_comments ADD COLUMN IF NOT EXISTS like_count INT NOT NULL DEFAULT 0;
ALTER TABLE forum_comments ALTER COLUMN content DROP NOT NULL;
ALTER TABLE forum_comments DROP CONSTRAINT IF EXISTS forum_comments_comment_type_check;
ALTER TABLE forum_comments
  ADD CONSTRAINT forum_comments_comment_type_check
  CHECK (comment_type IN ('text', 'voice')) NOT VALID;
ALTER TABLE forum_comments DROP CONSTRAINT IF EXISTS forum_comments_transcript_status_check;
ALTER TABLE forum_comments
  ADD CONSTRAINT forum_comments_transcript_status_check
  CHECK (transcript_status IN ('none', 'pending', 'success', 'failed')) NOT VALID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'forum_comments_parent_comment_id_fkey'
  ) THEN
    ALTER TABLE forum_comments
      ADD CONSTRAINT forum_comments_parent_comment_id_fkey
      FOREIGN KEY (parent_comment_id) REFERENCES forum_comments(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'forum_comments_root_comment_id_fkey'
  ) THEN
    ALTER TABLE forum_comments
      ADD CONSTRAINT forum_comments_root_comment_id_fkey
      FOREIGN KEY (root_comment_id) REFERENCES forum_comments(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_forum_comments_root_comment_id
  ON forum_comments (root_comment_id, created_at);

CREATE TABLE IF NOT EXISTS forum_post_images (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  image_width INT,
  image_height INT,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forum_post_images_post
  ON forum_post_images (post_id, display_order);

CREATE TABLE IF NOT EXISTS forum_post_likes (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_forum_post_likes_post ON forum_post_likes (post_id);
CREATE INDEX IF NOT EXISTS idx_forum_post_likes_user ON forum_post_likes (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS forum_post_favorites (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_forum_post_favorites_post ON forum_post_favorites (post_id);
CREATE INDEX IF NOT EXISTS idx_forum_post_favorites_user ON forum_post_favorites (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS forum_post_views (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_forum_post_views_viewed_at
  ON forum_post_views (viewed_at);

CREATE TABLE IF NOT EXISTS forum_comment_likes (
  id TEXT PRIMARY KEY,
  comment_id TEXT NOT NULL REFERENCES forum_comments(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (comment_id, user_id)
);

CREATE TABLE IF NOT EXISTS forum_comment_hides (
  id TEXT PRIMARY KEY,
  comment_id TEXT NOT NULL REFERENCES forum_comments(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (comment_id, user_id)
);

CREATE TABLE IF NOT EXISTS forum_announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  priority INT NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forum_announcements_active_priority
  ON forum_announcements (is_active, priority DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS forum_guestbook_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'hidden')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forum_guestbook_messages_visible
  ON forum_guestbook_messages (status, created_at DESC);

CREATE TABLE IF NOT EXISTS user_notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  meta JSONB,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_unread
  ON user_notifications (user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_created
  ON user_notifications (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS forum_reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment', 'user')),
  post_id TEXT REFERENCES forum_posts(id) ON DELETE CASCADE,
  comment_id TEXT REFERENCES forum_comments(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  detail TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT,
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE forum_reports ADD COLUMN IF NOT EXISTS reported_user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_forum_reports_status_created
  ON forum_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_reports_reporter
  ON forum_reports (reporter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_reports_reported
  ON forum_reports (reported_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_reports_post
  ON forum_reports (post_id);
CREATE INDEX IF NOT EXISTS idx_forum_reports_comment
  ON forum_reports (comment_id);

-- ---------------------------------------------------------------------------
-- Teamup tables
-- ---------------------------------------------------------------------------

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
  ON teamups (circle_id, status, end_at);
CREATE INDEX IF NOT EXISTS idx_teamups_circle_type
  ON teamups (circle_id, teamup_type);
CREATE INDEX IF NOT EXISTS idx_teamups_circle_public
  ON teamups (circle_id, is_public, forum_sync_status);
CREATE INDEX IF NOT EXISTS idx_teamups_leader
  ON teamups (leader_id, created_at);
CREATE INDEX IF NOT EXISTS idx_teamups_forum_post
  ON teamups (forum_post_id);

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
  ON teamup_members (teamup_id, user_id);
CREATE INDEX IF NOT EXISTS idx_teamup_members_teamup_status
  ON teamup_members (teamup_id, membership_status);
CREATE INDEX IF NOT EXISTS idx_teamup_members_user_status
  ON teamup_members (user_id, membership_status);

CREATE TABLE IF NOT EXISTS teamup_member_contacts (
  id TEXT PRIMARY KEY,
  teamup_id TEXT NOT NULL REFERENCES teamups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contacts JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_teamup_member_contacts_teamup_user
  ON teamup_member_contacts (teamup_id, user_id);

CREATE TABLE IF NOT EXISTS teamup_applications (
  id TEXT PRIMARY KEY,
  teamup_id TEXT NOT NULL REFERENCES teamups(id) ON DELETE CASCADE,
  applicant_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_type TEXT NOT NULL DEFAULT 'join' CHECK (application_type IN ('join', 'waitlist')),
  application_note TEXT NOT NULL,
  card_snapshot JSONB NOT NULL,
  card_snapshot_view TEXT NOT NULL CHECK (card_snapshot_view IN ('public', 'friend')),
  card_snapshot_relationship TEXT NOT NULL CHECK (card_snapshot_relationship IN ('not_friend', 'friend')),
  contact_payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  review_note TEXT,
  reviewed_at TIMESTAMPTZ,
  waitlist_joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_teamup_applications_pending
  ON teamup_applications (teamup_id, applicant_id)
  WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS idx_teamup_applications_active_waitlist
  ON teamup_applications (teamup_id, applicant_id)
  WHERE application_type = 'waitlist'
    AND status IN ('pending', 'approved')
    AND waitlist_joined_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_teamup_applications_teamup_status
  ON teamup_applications (teamup_id, status);
CREATE INDEX IF NOT EXISTS idx_teamup_applications_applicant_status
  ON teamup_applications (applicant_id, status);
CREATE INDEX IF NOT EXISTS idx_teamup_applications_waitlist_queue
  ON teamup_applications (teamup_id, application_type, status, created_at);

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
  ON teamup_forum_sync_jobs (status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_teamup_forum_sync_jobs_teamup
  ON teamup_forum_sync_jobs (teamup_id, created_at);

-- ---------------------------------------------------------------------------
-- G2 contact secret storage
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS g2_contact_secrets (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  field_key TEXT NOT NULL,
  contact_type TEXT NOT NULL,
  label TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  nonce TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  key_version TEXT NOT NULL,
  value_hash TEXT NOT NULL,
  masked_value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_g2_contact_secrets_unique_scope
  ON g2_contact_secrets (owner_user_id, scope_type, scope_id, field_key, contact_type);
CREATE INDEX IF NOT EXISTS idx_g2_contact_secrets_owner_scope
  ON g2_contact_secrets (owner_user_id, scope_type, scope_id);
CREATE INDEX IF NOT EXISTS idx_g2_contact_secrets_value_hash
  ON g2_contact_secrets (value_hash);

ALTER TABLE user_circle_contacts
  ADD COLUMN IF NOT EXISTS contact_secret_id TEXT;
ALTER TABLE user_circle_contacts
  ALTER COLUMN value DROP NOT NULL;

DO $$
BEGIN
  ALTER TABLE user_circle_contacts
    ADD CONSTRAINT fk_user_circle_contacts_contact_secret
    FOREIGN KEY (contact_secret_id) REFERENCES g2_contact_secrets(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_circle_contacts_secret
  ON user_circle_contacts (contact_secret_id);

-- ---------------------------------------------------------------------------
-- Circle and teamup chat
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS circle_chat_messages (
  id TEXT PRIMARY KEY,
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

CREATE INDEX IF NOT EXISTS idx_circle_chat_messages_circle_created
  ON circle_chat_messages (circle_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_circle_chat_messages_sender_created
  ON circle_chat_messages (sender_id, created_at DESC);
DROP INDEX IF EXISTS idx_circle_chat_messages_sender_client;
CREATE UNIQUE INDEX IF NOT EXISTS idx_circle_chat_messages_sender_client
  ON circle_chat_messages (circle_id, sender_id, client_message_id);

CREATE TABLE IF NOT EXISTS circle_chat_read_states (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  circle_id TEXT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  last_read_message_id TEXT REFERENCES circle_chat_messages(id) ON DELETE SET NULL,
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_circle_chat_read_states_user_circle
  ON circle_chat_read_states (user_id, circle_id);
CREATE INDEX IF NOT EXISTS idx_circle_chat_read_states_user_updated
  ON circle_chat_read_states (user_id, updated_at DESC);

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
  ON teamup_chat_messages (teamup_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_teamup_chat_messages_circle_created
  ON teamup_chat_messages (circle_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_teamup_chat_messages_sender_created
  ON teamup_chat_messages (sender_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_teamup_chat_messages_sender_client
  ON teamup_chat_messages (teamup_id, sender_id, client_message_id);

CREATE TABLE IF NOT EXISTS teamup_chat_read_states (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  teamup_id TEXT NOT NULL REFERENCES teamups(id) ON DELETE CASCADE,
  last_read_message_id TEXT REFERENCES teamup_chat_messages(id) ON DELETE SET NULL,
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_teamup_chat_read_states_user_teamup
  ON teamup_chat_read_states (user_id, teamup_id);
CREATE INDEX IF NOT EXISTS idx_teamup_chat_read_states_user_updated
  ON teamup_chat_read_states (user_id, updated_at DESC);

-- ---------------------------------------------------------------------------
-- Static component definitions
-- ---------------------------------------------------------------------------

INSERT INTO card_modules (id, key, name, description, category, is_system)
VALUES
  ('60000000-0000-4000-8000-000000000001', 'display_name', '昵称', '你的显示名称', 'basic', TRUE),
  ('60000000-0000-4000-8000-000000000002', 'grade', '年级', '你所在的年级', 'basic', TRUE),
  ('60000000-0000-4000-8000-000000000003', 'campus', '校区', '你所在的校区', 'basic', TRUE),
  ('60000000-0000-4000-8000-000000000004', 'department', '院系', '你所在的院系', 'basic', TRUE),
  ('60000000-0000-4000-8000-000000000005', 'bio', '个人简介', '一句话介绍自己', 'basic', TRUE),
  ('60000000-0000-4000-8000-000000000006', 'contact_wechat', '微信', '微信号', 'contact', FALSE),
  ('60000000-0000-4000-8000-000000000007', 'hobbies', '兴趣爱好', '平时喜欢做什么', 'interests', FALSE),
  ('60000000-0000-4000-8000-000000000008', 'music', '喜欢的音乐', '常听的音乐风格', 'interests', FALSE)
ON CONFLICT (key) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_system = EXCLUDED.is_system;

INSERT INTO base_card_components (id, key, name, source_type, source_key)
VALUES
  ('50000000-0000-4000-8000-000000000001', 'grade', '年级', 'user_profile', 'users.grade'),
  ('50000000-0000-4000-8000-000000000002', 'campus', '校区', 'user_profile', 'users.campus'),
  ('50000000-0000-4000-8000-000000000003', 'department', '院系', 'user_profile', 'users.department'),
  ('50000000-0000-4000-8000-000000000004', 'mbti', 'MBTI', 'user_profile', 'users.mbti'),
  ('50000000-0000-4000-8000-000000000005', 'bio', '个人简介', 'user_profile', 'users.bio')
ON CONFLICT (key) DO UPDATE
SET
  name = EXCLUDED.name,
  source_type = EXCLUDED.source_type,
  source_key = EXCLUDED.source_key;

-- ---------------------------------------------------------------------------
-- Seed sample users and circles
-- ---------------------------------------------------------------------------

INSERT INTO users (
  id,
  email,
  password_hash,
  nickname,
  gender,
  gender_pref,
  intention,
  grade,
  campus,
  department,
  mbti,
  bio,
  avatar_url,
  wechat_id,
  is_participating,
  email_notifications,
  profile_complete,
  survey_complete,
  created_at,
  updated_at
)
VALUES
  (
    '10000000-0000-4000-8000-000000000001',
    'circle.seed@smail.nju.edu.cn',
    '$2b$12$tImIbXspf.aeaJo/5xHkYeRgZX0AYiN3TVsSnzCKufsTLk0LaIDwu',
    '阿球',
    'male',
    'any',
    'friend',
    '2023',
    'xianlin',
    '软件学院',
    'ENTP',
    '常驻仙林，喜欢临时约球和赛后夜宵。',
    NULL,
    'wechat:circle_seed_profile',
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    NOW(),
    NOW()
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'circle.peer@smail.nju.edu.cn',
    '$2b$12$tImIbXspf.aeaJo/5xHkYeRgZX0AYiN3TVsSnzCKufsTLk0LaIDwu',
    '北苑杀球王',
    'female',
    'any',
    'friend',
    '2022',
    'gulou',
    '新闻传播学院',
    'ISFJ',
    '打球认真，聊天也认真，偶尔会带饮料来球场。',
    NULL,
    'wechat:circle_peer_profile',
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    NOW(),
    NOW()
  ),
  (
    '50000000-0000-4000-8000-000000000005',
    'circle.waitlist@smail.nju.edu.cn',
    '$2b$12$tImIbXspf.aeaJo/5xHkYeRgZX0AYiN3TVsSnzCKufsTLk0LaIDwu',
    '候补小拍',
    'female',
    'any',
    'friend',
    '2024',
    'xianlin',
    '外国语学院',
    'ENFP',
    '刚开始打双打，适合用来演示满员组队中的候补功能。',
    NULL,
    'wechat:circle_waitlist_profile',
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash,
  nickname = EXCLUDED.nickname,
  gender = EXCLUDED.gender,
  gender_pref = EXCLUDED.gender_pref,
  intention = EXCLUDED.intention,
  grade = EXCLUDED.grade,
  campus = EXCLUDED.campus,
  department = EXCLUDED.department,
  mbti = EXCLUDED.mbti,
  bio = EXCLUDED.bio,
  avatar_url = EXCLUDED.avatar_url,
  wechat_id = EXCLUDED.wechat_id,
  is_participating = EXCLUDED.is_participating,
  email_notifications = EXCLUDED.email_notifications,
  profile_complete = EXCLUDED.profile_complete,
  survey_complete = EXCLUDED.survey_complete,
  updated_at = NOW();

INSERT INTO circles (
  id,
  name,
  slug,
  description,
  category,
  tag,
  tags,
  join_policy,
  join_question,
  join_questions,
  invite_code,
  invite_code_hash,
  capacity_limit,
  keyword_rules,
  icon_url,
  creator_id,
  member_count,
  is_active,
  status,
  created_at,
  updated_at
)
VALUES
  (
    '30000000-0000-4000-8000-000000000003',
    '羽毛球夜场研究所',
    'badminton-night-lab',
    '给想在工作日晚场和周末约球的同学留一块固定搭子区，适合临时约双打、找训练搭档和球后加餐。',
    'sports',
    '球馆集合',
    '["球馆集合","双打搭子","夜场"]'::jsonb,
    'public',
    NULL,
    '[]'::jsonb,
    NULL,
    NULL,
    NULL,
    '[]'::jsonb,
    NULL,
    '10000000-0000-4000-8000-000000000001',
    3,
    TRUE,
    'active',
    NOW(),
    NOW()
  ),
  (
    '40000000-0000-4000-8000-000000000004',
    '午夜观影会',
    'midnight-movie-club',
    '偏向轻社交的看片圈，适合想约校园放映、补老片和交换片单的同学直接加入测试。',
    'arts',
    '片单交换',
    '["片单交换","校园放映","轻社交"]'::jsonb,
    'review',
    '想加入观影会的话，请写一句你最近想看的片子。',
    '[{"id":"movie-reason","question":"想加入观影会的话，请写一句你最近想看的片子。","required":true}]'::jsonb,
    NULL,
    NULL,
    30,
    '[]'::jsonb,
    NULL,
    '20000000-0000-4000-8000-000000000002',
    1,
    TRUE,
    'active',
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  tag = EXCLUDED.tag,
  tags = EXCLUDED.tags,
  join_policy = EXCLUDED.join_policy,
  join_question = EXCLUDED.join_question,
  join_questions = EXCLUDED.join_questions,
  invite_code = EXCLUDED.invite_code,
  invite_code_hash = EXCLUDED.invite_code_hash,
  capacity_limit = EXCLUDED.capacity_limit,
  keyword_rules = EXCLUDED.keyword_rules,
  icon_url = EXCLUDED.icon_url,
  creator_id = EXCLUDED.creator_id,
  member_count = EXCLUDED.member_count,
  is_active = EXCLUDED.is_active,
  status = EXCLUDED.status,
  updated_at = NOW();

-- ---------------------------------------------------------------------------
-- Reset sample-only child data so rerunning returns to the same baseline
-- ---------------------------------------------------------------------------

DELETE FROM teamups
WHERE id IN (
  '90000000-0000-4000-8000-000000000001',
  '90000000-0000-4000-8000-000000000002',
  '90000000-0000-4000-8000-000000000003',
  '90000000-0000-4000-8000-000000000004',
  '90000000-0000-4000-8000-000000000005'
);

DELETE FROM forum_reports
WHERE id IN (
  '86500000-0000-4000-8000-000000000001'
);

DELETE FROM forum_post_likes
WHERE id IN (
  '86600000-0000-4000-8000-000000000001'
)
   OR (post_id IN ('86000000-0000-4000-8000-000000000001') AND user_id IN ('20000000-0000-4000-8000-000000000002'));

DELETE FROM forum_post_favorites
WHERE id IN (
  '86700000-0000-4000-8000-000000000001'
)
   OR (post_id IN ('86000000-0000-4000-8000-000000000001') AND user_id IN ('20000000-0000-4000-8000-000000000002'));

DELETE FROM forum_guestbook_messages
WHERE id IN (
  '86800000-0000-4000-8000-000000000001'
);

DELETE FROM forum_announcements
WHERE id IN (
  '86900000-0000-4000-8000-000000000001'
);

DELETE FROM forum_comments
WHERE id IN (
  '87000000-0000-4000-8000-000000000001',
  '87000000-0000-4000-8000-000000000002'
);

DELETE FROM forum_posts
WHERE id IN (
  '86000000-0000-4000-8000-000000000001',
  '86000000-0000-4000-8000-000000000002'
);

DELETE FROM user_notifications
WHERE id IN (
  '89000000-0000-4000-8000-000000000001',
  '89000000-0000-4000-8000-000000000002',
  '89000000-0000-4000-8000-000000000003',
  '89000000-0000-4000-8000-000000000004',
  '89000000-0000-4000-8000-000000000005',
  '89000000-0000-4000-8000-000000000006'
);

DELETE FROM circle_matches
WHERE circle_id = '30000000-0000-4000-8000-000000000003'
  AND week_of = (
    (
      (
        CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Shanghai'
      )::date
      - (
        (
          (EXTRACT(DOW FROM (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Shanghai'))::INT + 4) % 7
        ) * INTERVAL '1 day'
      )
    )::date::text
  )
  AND (
    user_a_id IN ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002')
    OR user_b_id IN ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002')
  );

DELETE FROM user_circle_custom_cards
WHERE circle_id = '30000000-0000-4000-8000-000000000003'
  AND user_id IN ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002');

DELETE FROM circle_join_requests
WHERE id IN (
  '85000000-0000-4000-8000-000000000001'
);

DELETE FROM circle_member_location_cooldowns
WHERE circle_id IN (
  '30000000-0000-4000-8000-000000000003',
  '40000000-0000-4000-8000-000000000004'
)
  AND user_id IN ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002');

DELETE FROM circle_member_locations
WHERE circle_id IN (
  '30000000-0000-4000-8000-000000000003',
  '40000000-0000-4000-8000-000000000004'
)
  AND user_id IN ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002');

DELETE FROM user_circle_cards
WHERE circle_id IN (
  '30000000-0000-4000-8000-000000000003',
  '40000000-0000-4000-8000-000000000004'
)
  AND user_id IN ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002');

DELETE FROM circle_members
WHERE circle_id IN (
  '30000000-0000-4000-8000-000000000003',
  '40000000-0000-4000-8000-000000000004'
)
  AND user_id IN ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002');

DELETE FROM circle_member_roles
WHERE circle_id IN (
  '30000000-0000-4000-8000-000000000003',
  '40000000-0000-4000-8000-000000000004'
)
  AND user_id IN ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002');

DELETE FROM friend_requests
WHERE sender_id IN ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002')
  AND receiver_id IN ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002');

DELETE FROM contact_unlock_requests
WHERE requester_id IN ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002')
  AND target_id IN ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002');

DELETE FROM contact_unlock_grants
WHERE requester_id IN ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002')
  AND target_id IN ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002');

DELETE FROM user_circle_contacts
WHERE circle_id IN (
  '30000000-0000-4000-8000-000000000003',
  '40000000-0000-4000-8000-000000000004'
)
  AND user_id IN ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002');

DELETE FROM friendships
WHERE user_a_id IN ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002')
  AND user_b_id IN ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002');

DELETE FROM global_friendships
WHERE user_a_id IN ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002')
  AND user_b_id IN ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002');

DELETE FROM circle_questions
WHERE circle_id IN (
  '30000000-0000-4000-8000-000000000003',
  '40000000-0000-4000-8000-000000000004'
);

-- ---------------------------------------------------------------------------
-- Questionnaire answers / legacy cards / circle definitions
-- ---------------------------------------------------------------------------

INSERT INTO survey_answers (id, user_id, answers, version, submitted_at, updated_at)
VALUES
  (
    '11000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '{"q1":{"value":2003},"q2":{"value":{"min":2001,"max":2005}},"q61":{"value":["entp","enfp","intj"]},"q5":{"value":["same_grade","lower_grade"]},"q7":{"value":"neutral"},"q_top_interest":{"value":["ball_sports","food_exploring","music_listening"]},"q_music_style":{"value":["indie","c_pop","rock"]},"q_reply_pref":{"value":5,"importance":4},"q_red_flags":{"value":["ghost_msg","hurtful_words","disrespect_circle"]},"q_partner_qualities":{"value":["kindness","honesty","curiosity"]}}',
    '4.0',
    NOW(),
    NOW()
  ),
  (
    '11000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    '{"q1":{"value":2002},"q2":{"value":{"min":2000,"max":2004}},"q61":{"value":["isfj","infj","enfj"]},"q5":{"value":["same_grade","higher_grade"]},"q7":{"value":"neutral"},"q_top_interest":{"value":["ball_sports","movies_series","reading_writing"]},"q_music_style":{"value":["c_pop","r_and_b","indie"]},"q_reply_pref":{"value":4,"importance":5},"q_red_flags":{"value":["ghost_msg","hurtful_words"]},"q_partner_qualities":{"value":["kindness","loyalty","curiosity"]}}',
    '4.0',
    NOW(),
    NOW()
  ),
  (
    '11000000-0000-4000-8000-000000000005',
    '50000000-0000-4000-8000-000000000005',
    '{"q1":{"value":2024},"q2":{"value":{"min":2022,"max":2025}},"q61":{"value":["enfp","infp","entp"]},"q5":{"value":["same_grade","higher_grade"]},"q7":{"value":"neutral"},"q_top_interest":{"value":["ball_sports","food_exploring","reading_writing"]},"q_music_style":{"value":["c_pop","indie"]},"q_reply_pref":{"value":4,"importance":4},"q_red_flags":{"value":["ghost_msg","disrespect_circle"]},"q_partner_qualities":{"value":["kindness","patience","curiosity"]}}',
    '4.0',
    NOW(),
    NOW()
  )
ON CONFLICT (user_id) DO UPDATE
SET
  answers = EXCLUDED.answers,
  version = EXCLUDED.version,
  updated_at = NOW();

INSERT INTO user_cards (id, user_id, modules, updated_at)
VALUES
  (
    '12000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '[]'::jsonb,
    NOW()
  ),
  (
    '12000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    '[]'::jsonb,
    NOW()
  ),
  (
    '12000000-0000-4000-8000-000000000005',
    '50000000-0000-4000-8000-000000000005',
    '[]'::jsonb,
    NOW()
  )
ON CONFLICT (user_id) DO UPDATE
SET
  modules = EXCLUDED.modules,
  updated_at = NOW();

INSERT INTO circle_questions (
  id,
  circle_id,
  key,
  type,
  prompt,
  options,
  weight,
  display_order,
  is_channel_tag
)
VALUES
  (
    '70000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000003',
    'skill_level',
    'single_choice',
    '羽球熟练度',
    '["刚入门","能连续回合","双打常驻","竞技党"]',
    1.0,
    0,
    TRUE
  ),
  (
    '70000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000003',
    'active_slot',
    'multi_choice',
    '常出没时间',
    '["工作日晚场","周末下午","周末晚场"]',
    1.0,
    1,
    TRUE
  ),
  (
    '70000000-0000-4000-8000-000000000003',
    '30000000-0000-4000-8000-000000000003',
    'play_style',
    'single_choice',
    '偏好打法',
    '["养生拉吊","攻守均衡","网前快节奏"]',
    1.0,
    2,
    FALSE
  ),
  (
    '70000000-0000-4000-8000-000000000004',
    '30000000-0000-4000-8000-000000000003',
    'equipment_note',
    'scale',
    '装备补充',
    NULL,
    1.0,
    3,
    FALSE
  ),
  (
    '71000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000004',
    'movie_genre',
    'single_choice',
    '最常看的类型',
    '["剧情","悬疑","科幻","爱情","纪录片"]',
    1.0,
    0,
    TRUE
  ),
  (
    '71000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000004',
    'watch_time',
    'multi_choice',
    '常约片时间',
    '["周五晚上","周六下午","周六深夜","周日下午"]',
    1.0,
    1,
    TRUE
  ),
  (
    '71000000-0000-4000-8000-000000000003',
    '40000000-0000-4000-8000-000000000004',
    'snack_style',
    'scale',
    '看片零食偏好',
    NULL,
    1.0,
    2,
    FALSE
  );

INSERT INTO user_base_cards (user_id, is_active, components, updated_at)
VALUES
  (
    '10000000-0000-4000-8000-000000000001',
    TRUE,
    '[
      {"key":"grade","name":"年级","value":"2023","topLeft":[0,0],"width":1,"height":1,"status":"public"},
      {"key":"campus","name":"校区","value":"xianlin","topLeft":[0,1],"width":1,"height":1,"status":"public"},
      {"key":"department","name":"院系","value":"软件学院","topLeft":[0,2],"width":1,"height":1,"status":"public"},
      {"key":"mbti","name":"MBTI","value":"ENTP","topLeft":[0,3],"width":1,"height":1,"status":"public"},
      {"key":"bio","name":"个人简介","value":"常驻仙林，喜欢临时约球和赛后夜宵。","topLeft":[0,4],"width":1,"height":1,"status":"hidden"}
    ]'::jsonb,
    NOW()
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    TRUE,
    '[
      {"key":"grade","name":"年级","value":"2022","topLeft":[0,0],"width":1,"height":1,"status":"public"},
      {"key":"campus","name":"校区","value":"gulou","topLeft":[0,1],"width":1,"height":1,"status":"public"},
      {"key":"department","name":"院系","value":"新闻传播学院","topLeft":[0,2],"width":1,"height":1,"status":"public"},
      {"key":"mbti","name":"MBTI","value":"ISFJ","topLeft":[0,3],"width":1,"height":1,"status":"public"},
      {"key":"bio","name":"个人简介","value":"打球认真，聊天也认真，偶尔会带饮料来球场。","topLeft":[0,4],"width":1,"height":1,"status":"hidden"}
    ]'::jsonb,
    NOW()
  ),
  (
    '50000000-0000-4000-8000-000000000005',
    TRUE,
    '[
      {"key":"grade","name":"年级","value":"2024","topLeft":[0,0],"width":1,"height":1,"status":"public"},
      {"key":"campus","name":"校区","value":"xianlin","topLeft":[0,1],"width":1,"height":1,"status":"public"},
      {"key":"department","name":"院系","value":"外国语学院","topLeft":[0,2],"width":1,"height":1,"status":"public"},
      {"key":"mbti","name":"MBTI","value":"ENFP","topLeft":[0,3],"width":1,"height":1,"status":"public"},
      {"key":"bio","name":"个人简介","value":"刚开始打双打，适合用来演示满员组队中的候补功能。","topLeft":[0,4],"width":1,"height":1,"status":"hidden"}
    ]'::jsonb,
    NOW()
  )
ON CONFLICT (user_id) DO UPDATE
SET
  is_active = EXCLUDED.is_active,
  components = EXCLUDED.components,
  updated_at = NOW();

-- ---------------------------------------------------------------------------
-- Joined circle state
-- ---------------------------------------------------------------------------

INSERT INTO circle_members (
  id,
  circle_id,
  user_id,
  membership_status,
  answers,
  answers_complete,
  is_active,
  joined_at,
  updated_at
)
VALUES
  (
    '81000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    'active',
    '{"skill_level":{"value":"双打常驻","importance":5},"active_slot":{"value":["工作日晚场","周末下午"]},"play_style":{"value":"攻守均衡"},"equipment_note":{"value":"自带两只拍，也愿意借新手拍。"}}',
    TRUE,
    TRUE,
    NOW(),
    NOW()
  ),
  (
    '82000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000002',
    'active',
    '{"skill_level":{"value":"能连续回合","importance":4},"active_slot":{"value":["工作日晚场","周末晚场"]},"play_style":{"value":"网前快节奏"},"equipment_note":{"value":"一般会提前十分钟到场热身。"}}',
    TRUE,
    TRUE,
    NOW(),
    NOW()
  ),
  (
    '82000000-0000-4000-8000-000000000005',
    '30000000-0000-4000-8000-000000000003',
    '50000000-0000-4000-8000-000000000005',
    'active',
    '{"skill_level":{"value":"刚入门","importance":3},"active_slot":{"value":["周末下午","周末晚场"]},"play_style":{"value":"养生拉吊"},"equipment_note":{"value":"希望先从候补位参与，熟悉一下节奏。"}}',
    TRUE,
    TRUE,
    NOW(),
    NOW()
  ),
  (
    '82000000-0000-4000-8000-000000000003',
    '40000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000002',
    'active',
    '{"movie_genre":{"value":"悬疑","importance":4},"watch_time":{"value":["周五晚上","周六深夜"]},"snack_style":{"value":4}}',
    TRUE,
    TRUE,
    NOW(),
    NOW()
  )
ON CONFLICT (circle_id, user_id) DO UPDATE
SET
  membership_status = EXCLUDED.membership_status,
  answers = EXCLUDED.answers,
  answers_complete = EXCLUDED.answers_complete,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

INSERT INTO circle_member_roles (
  id,
  circle_id,
  user_id,
  role,
  created_at,
  updated_at
)
VALUES
  (
    '82500000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    'owner',
    NOW(),
    NOW()
  ),
  (
    '82500000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000002',
    'admin',
    NOW(),
    NOW()
  ),
  (
    '82500000-0000-4000-8000-000000000003',
    '40000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000002',
    'owner',
    NOW(),
    NOW()
  )
ON CONFLICT (circle_id, user_id, role) DO UPDATE
SET
  updated_at = NOW();

INSERT INTO circle_join_requests (
  id,
  circle_id,
  user_id,
  application_answer,
  application_answers,
  application_reason,
  status,
  reject_reason,
  reviewed_by,
  reviewed_at,
  expires_at,
  created_at,
  updated_at
)
VALUES
  (
    '85000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000001',
    '想补一部《宇宙探索编辑部》，也想看看大家的片单。',
    '{"movie-reason":"想补一部《宇宙探索编辑部》，也想看看大家的片单。"}'::jsonb,
    '测试审核加入：阿球申请加入午夜观影会。',
    'pending_review',
    NULL,
    NULL,
    NULL,
    NOW() + INTERVAL '7 days',
    NOW() - INTERVAL '20 minutes',
    NOW() - INTERVAL '20 minutes'
  )
ON CONFLICT (id) DO UPDATE
SET
  application_answer = EXCLUDED.application_answer,
  application_answers = EXCLUDED.application_answers,
  application_reason = EXCLUDED.application_reason,
  status = EXCLUDED.status,
  reject_reason = EXCLUDED.reject_reason,
  reviewed_by = EXCLUDED.reviewed_by,
  reviewed_at = EXCLUDED.reviewed_at,
  expires_at = EXCLUDED.expires_at,
  updated_at = NOW();

INSERT INTO circle_member_locations (
  id,
  circle_id,
  user_id,
  latitude,
  longitude,
  accuracy_meters,
  is_enabled,
  captured_at,
  expires_at,
  created_at,
  updated_at
)
VALUES
  (
    '85100000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    32.1196,
    118.9580,
    80,
    TRUE,
    NOW() - INTERVAL '10 minutes',
    NOW() + INTERVAL '2 hours',
    NOW() - INTERVAL '10 minutes',
    NOW() - INTERVAL '10 minutes'
  ),
  (
    '85100000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000002',
    32.1201,
    118.9587,
    120,
    TRUE,
    NOW() - INTERVAL '8 minutes',
    NOW() + INTERVAL '2 hours',
    NOW() - INTERVAL '8 minutes',
    NOW() - INTERVAL '8 minutes'
  )
ON CONFLICT (circle_id, user_id) DO UPDATE
SET
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  accuracy_meters = EXCLUDED.accuracy_meters,
  is_enabled = EXCLUDED.is_enabled,
  captured_at = EXCLUDED.captured_at,
  expires_at = EXCLUDED.expires_at,
  updated_at = NOW();

INSERT INTO circle_member_location_cooldowns (
  id,
  circle_id,
  user_id,
  last_updated_at,
  created_at,
  updated_at
)
VALUES
  (
    '85200000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    NOW() - INTERVAL '10 minutes',
    NOW() - INTERVAL '10 minutes',
    NOW() - INTERVAL '10 minutes'
  ),
  (
    '85200000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000002',
    NOW() - INTERVAL '8 minutes',
    NOW() - INTERVAL '8 minutes',
    NOW() - INTERVAL '8 minutes'
  )
ON CONFLICT (circle_id, user_id) DO UPDATE
SET
  last_updated_at = EXCLUDED.last_updated_at,
  updated_at = NOW();

INSERT INTO user_circle_cards (id, user_id, circle_id, is_active, components, updated_at)
VALUES
  (
    '83000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000003',
    TRUE,
    '[
      {"key":"skill_level","name":"羽球熟练度","value":"双打常驻","topLeft":[0,0],"width":1,"height":1,"status":"public"},
      {"key":"active_slot","name":"常出没时间","value":["工作日晚场","周末下午"],"topLeft":[0,1],"width":1,"height":1,"status":"public"},
      {"key":"play_style","name":"偏好打法","value":"攻守均衡","topLeft":[0,2],"width":1,"height":1,"status":"public"},
      {"key":"equipment_note","name":"装备补充","value":"自带两只拍，也愿意借新手拍。","topLeft":[0,3],"width":1,"height":1,"status":"hidden"}
    ]'::jsonb,
    NOW()
  ),
  (
    '83000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000003',
    TRUE,
    '[
      {"key":"skill_level","name":"羽球熟练度","value":"能连续回合","topLeft":[0,0],"width":1,"height":1,"status":"public"},
      {"key":"active_slot","name":"常出没时间","value":["工作日晚场","周末晚场"],"topLeft":[0,1],"width":1,"height":1,"status":"public"},
      {"key":"play_style","name":"偏好打法","value":"网前快节奏","topLeft":[0,2],"width":1,"height":1,"status":"public"},
      {"key":"equipment_note","name":"装备补充","value":"一般会提前十分钟到场热身。","topLeft":[0,3],"width":1,"height":1,"status":"hidden"}
    ]'::jsonb,
    NOW()
  ),
  (
    '83000000-0000-4000-8000-000000000005',
    '50000000-0000-4000-8000-000000000005',
    '30000000-0000-4000-8000-000000000003',
    TRUE,
    '[
      {"key":"skill_level","name":"羽球熟练度","value":"刚入门","topLeft":[0,0],"width":1,"height":1,"status":"public"},
      {"key":"active_slot","name":"常出没时间","value":["周末下午","周末晚场"],"topLeft":[0,1],"width":1,"height":1,"status":"public"},
      {"key":"play_style","name":"偏好打法","value":"养生拉吊","topLeft":[0,2],"width":1,"height":1,"status":"public"},
      {"key":"equipment_note","name":"装备补充","value":"希望先从候补位参与，熟悉一下节奏。","topLeft":[0,3],"width":1,"height":1,"status":"hidden"}
    ]'::jsonb,
    NOW()
  ),
  (
    '83000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000004',
    TRUE,
    '[
      {"key":"movie_genre","name":"最常看的类型","value":"悬疑","topLeft":[0,0],"width":1,"height":1,"status":"public"},
      {"key":"watch_time","name":"常约片时间","value":["周五晚上","周六深夜"],"topLeft":[0,1],"width":1,"height":1,"status":"public"},
      {"key":"snack_style","name":"看片零食偏好","value":4,"topLeft":[0,2],"width":1,"height":1,"status":"hidden"}
    ]'::jsonb,
    NOW()
  )
ON CONFLICT (user_id, circle_id) DO UPDATE
SET
  is_active = EXCLUDED.is_active,
  components = EXCLUDED.components,
  updated_at = NOW();

INSERT INTO user_circle_custom_cards (
  id,
  user_id,
  circle_id,
  label,
  value,
  display_order,
  top_left_x,
  top_left_y,
  width,
  height,
  visibility_level,
  status,
  review_note,
  reviewed_at,
  created_at,
  updated_at
)
VALUES
  (
    '84000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000003',
    '最近想练',
    '反手高远球 + 网前扑球',
    0,
    0,
    4,
    2,
    1,
    'public',
    'approved',
    NULL,
    NOW(),
    NOW(),
    NOW()
  ),
  (
    '84000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000003',
    '组队偏好',
    '最好能提前在群里确认到场时间。',
    0,
    0,
    4,
    2,
    1,
    'public',
    'pending',
    NULL,
    NULL,
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO UPDATE
SET
  label = EXCLUDED.label,
  value = EXCLUDED.value,
  display_order = EXCLUDED.display_order,
  top_left_x = EXCLUDED.top_left_x,
  top_left_y = EXCLUDED.top_left_y,
  width = EXCLUDED.width,
  height = EXCLUDED.height,
  visibility_level = EXCLUDED.visibility_level,
  status = EXCLUDED.status,
  review_note = EXCLUDED.review_note,
  reviewed_at = EXCLUDED.reviewed_at,
  updated_at = NOW();

-- ---------------------------------------------------------------------------
-- Friend/contact samples
-- ---------------------------------------------------------------------------

INSERT INTO friendships (id, circle_id, user_a_id, user_b_id, created_at)
VALUES
  (
    '85300000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    NOW() - INTERVAL '1 day'
  )
ON CONFLICT (circle_id, user_a_id, user_b_id) DO UPDATE
SET
  created_at = EXCLUDED.created_at;

INSERT INTO global_friendships (id, user_a_id, user_b_id, source_type, created_at)
VALUES
  (
    '85400000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    'circle',
    NOW() - INTERVAL '1 day'
  )
ON CONFLICT (user_a_id, user_b_id) DO UPDATE
SET
  source_type = EXCLUDED.source_type,
  created_at = EXCLUDED.created_at;

INSERT INTO user_circle_contacts (
  id,
  user_id,
  circle_id,
  field_key,
  label,
  value,
  contact_secret_id,
  is_enabled,
  display_order,
  created_at,
  updated_at
)
VALUES
  (
    '85500000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000003',
    'contact_primary',
    '微信',
    'circle_seed_card',
    NULL,
    TRUE,
    0,
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
  ),
  (
    '85500000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000003',
    'contact_primary',
    '微信',
    'circle_peer_card',
    NULL,
    TRUE,
    0,
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
  )
ON CONFLICT (user_id, circle_id, field_key) DO UPDATE
SET
  label = EXCLUDED.label,
  value = EXCLUDED.value,
  contact_secret_id = EXCLUDED.contact_secret_id,
  is_enabled = EXCLUDED.is_enabled,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

INSERT INTO contact_unlock_requests (
  id,
  circle_id,
  requester_id,
  target_id,
  source_type,
  field_key,
  card_snapshot,
  message,
  status,
  expires_at,
  revoked_at,
  created_at,
  updated_at
)
VALUES
  (
    '85600000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    'circle',
    'contact_primary',
    '{
      "previewMode":"friend",
      "nickname":"阿球",
      "avatarUrl":null,
      "baseModules":[
        {"key":"grade","label":"年级","value":"2023"},
        {"key":"campus","label":"校区","value":"xianlin"},
        {"key":"department","label":"院系","value":"软件学院"}
      ],
      "circleCards":[
        {
          "circleId":"30000000-0000-4000-8000-000000000003",
          "circleName":"羽毛球夜场研究所",
          "modules":[
            {"key":"skill_level","label":"羽球熟练度","value":"双打常驻"},
            {"key":"active_slot","label":"常出没时间","value":["工作日晚场","周末下午"]}
          ]
        }
      ]
    }'::jsonb,
    '周五开局前方便加一下微信确认场地吗？',
    'pending',
    NOW() + INTERVAL '7 days',
    NULL,
    NOW() - INTERVAL '30 minutes',
    NOW() - INTERVAL '30 minutes'
  )
ON CONFLICT (id) DO UPDATE
SET
  card_snapshot = EXCLUDED.card_snapshot,
  message = EXCLUDED.message,
  status = EXCLUDED.status,
  expires_at = EXCLUDED.expires_at,
  revoked_at = EXCLUDED.revoked_at,
  updated_at = NOW();

-- ---------------------------------------------------------------------------
-- Teamup samples
-- ---------------------------------------------------------------------------

INSERT INTO teamups (
  id,
  circle_id,
  leader_id,
  title,
  description,
  description_preview,
  max_members,
  current_member_count,
  deadline_at,
  end_at,
  teamup_type,
  join_mode,
  is_public,
  status,
  forum_post_id,
  forum_post_author_id,
  forum_sync_status,
  created_at,
  updated_at
)
VALUES
  (
    '90000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000002',
    '本周五仙林双打补位',
    '周五晚上想在仙林体育馆打一场双打，水平不限，场地费 AA。这个样例用于账号 A 测试直接加入流程，联系方式会在截止后到活动结束前展示给队员。',
    '周五晚上想在仙林体育馆打一场双打，水平不限，场地费 AA。',
    4,
    1,
    NOW() + INTERVAL '2 days',
    NOW() + INTERVAL '2 days 3 hours',
    'short_term',
    'direct',
    TRUE,
    'recruiting',
    '86000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    'synced',
    NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '2 hours'
  ),
  (
    '90000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    '周末新手友好练球',
    '周末下午想组一个新手友好局，人数到 4 人就开。这个样例用于账号 A 的队长视角审核：北苑杀球王已经提交了一条待审核申请。',
    '周末下午想组一个新手友好局，人数到 4 人就开。',
    4,
    1,
    NOW() + INTERVAL '1 day',
    NOW() + INTERVAL '1 day 4 hours',
    'long_term',
    'approval',
    FALSE,
    'recruiting',
    NULL,
    NULL,
    'none',
    NOW() - INTERVAL '3 hours',
    NOW() - INTERVAL '1 hour'
  ),
  (
    '90000000-0000-4000-8000-000000000003',
    '30000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    '联系方式窗口测试局',
    '这个样例已经过了招募截止但尚未结束，账号 A 与账号 B 都是 active 成员，可用于测试截止后、结束前展示联系方式。',
    '这个样例已经过了招募截止但尚未结束，可测试联系方式展示。',
    2,
    2,
    NOW() - INTERVAL '1 hour',
    NOW() + INTERVAL '2 hours',
    'short_term',
    'direct',
    FALSE,
    'full',
    NULL,
    NULL,
    'none',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 hour'
  ),
  (
    '90000000-0000-4000-8000-000000000004',
    '30000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000002',
    '候补补位触发：周六晨练双打',
    '这个样例用于账号 A 单账号演示候补补位：账号 A 已在队伍中，候补小拍已进入候补队列；账号 A 退出后会触发候补自动补位。',
    '账号 A 退出后可触发候补小拍自动补位。',
    2,
    2,
    NOW() + INTERVAL '12 hours',
    NOW() + INTERVAL '15 hours',
    'short_term',
    'direct',
    FALSE,
    'full',
    NULL,
    NULL,
    'none',
    NOW() - INTERVAL '50 minutes',
    NOW() - INTERVAL '30 minutes'
  ),
  (
    '90000000-0000-4000-8000-000000000005',
    '30000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000002',
    '候补演示：周日晚场双打',
    '这个样例由北苑杀球王发起，当前 2/2 已满。阿球不在队伍中，登录后可以点击申请候补，用于演示满员后的 waitlist 流程。',
    '当前 2/2 已满，阿球可申请候补。',
    2,
    2,
    NOW() + INTERVAL '3 days',
    NOW() + INTERVAL '3 days 3 hours',
    'short_term',
    'direct',
    TRUE,
    'full',
    NULL,
    NULL,
    'none',
    NOW() - INTERVAL '40 minutes',
    NOW() - INTERVAL '20 minutes'
  );

INSERT INTO teamup_members (
  id,
  teamup_id,
  user_id,
  member_role,
  membership_status,
  joined_at,
  left_at,
  created_at,
  updated_at
)
VALUES
  (
    '91000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    'leader',
    'active',
    NOW() - INTERVAL '2 hours',
    NULL,
    NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '2 hours'
  ),
  (
    '91000000-0000-4000-8000-000000000002',
    '90000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    'leader',
    'active',
    NOW() - INTERVAL '3 hours',
    NULL,
    NOW() - INTERVAL '3 hours',
    NOW() - INTERVAL '1 hour'
  ),
  (
    '91000000-0000-4000-8000-000000000003',
    '90000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    'leader',
    'active',
    NOW() - INTERVAL '1 day',
    NULL,
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 hour'
  ),
  (
    '91000000-0000-4000-8000-000000000004',
    '90000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000002',
    'member',
    'active',
    NOW() - INTERVAL '23 hours',
    NULL,
    NOW() - INTERVAL '23 hours',
    NOW() - INTERVAL '1 hour'
  ),
  (
    '91000000-0000-4000-8000-000000000005',
    '90000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000002',
    'leader',
    'active',
    NOW() - INTERVAL '50 minutes',
    NULL,
    NOW() - INTERVAL '50 minutes',
    NOW() - INTERVAL '30 minutes'
  ),
  (
    '91000000-0000-4000-8000-000000000006',
    '90000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000001',
    'member',
    'active',
    NOW() - INTERVAL '45 minutes',
    NULL,
    NOW() - INTERVAL '45 minutes',
    NOW() - INTERVAL '30 minutes'
  ),
  (
    '91000000-0000-4000-8000-000000000007',
    '90000000-0000-4000-8000-000000000005',
    '20000000-0000-4000-8000-000000000002',
    'leader',
    'active',
    NOW() - INTERVAL '40 minutes',
    NULL,
    NOW() - INTERVAL '40 minutes',
    NOW() - INTERVAL '20 minutes'
  ),
  (
    '91000000-0000-4000-8000-000000000008',
    '90000000-0000-4000-8000-000000000005',
    '50000000-0000-4000-8000-000000000005',
    'member',
    'active',
    NOW() - INTERVAL '35 minutes',
    NULL,
    NOW() - INTERVAL '35 minutes',
    NOW() - INTERVAL '20 minutes'
  );

INSERT INTO teamup_member_contacts (
  id,
  teamup_id,
  user_id,
  contacts,
  created_at,
  updated_at
)
VALUES
  (
    '92000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    '[{"type":"wechat","label":"微信","value":"circle_peer_teamup_direct"}]'::jsonb,
    NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '2 hours'
  ),
  (
    '92000000-0000-4000-8000-000000000002',
    '90000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '[{"type":"wechat","label":"微信","value":"circle_seed_teamup_approval_owner"}]'::jsonb,
    NOW() - INTERVAL '3 hours',
    NOW() - INTERVAL '1 hour'
  ),
  (
    '92000000-0000-4000-8000-000000000003',
    '90000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    '[{"type":"wechat","label":"微信","value":"circle_seed_teamup_window"}]'::jsonb,
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 hour'
  ),
  (
    '92000000-0000-4000-8000-000000000004',
    '90000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000002',
    '[{"type":"wechat","label":"微信","value":"circle_peer_teamup_window"}]'::jsonb,
    NOW() - INTERVAL '23 hours',
    NOW() - INTERVAL '1 hour'
  ),
  (
    '92000000-0000-4000-8000-000000000005',
    '90000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000002',
    '[{"type":"wechat","label":"微信","value":"circle_peer_teamup_promote_leader"}]'::jsonb,
    NOW() - INTERVAL '50 minutes',
    NOW() - INTERVAL '30 minutes'
  ),
  (
    '92000000-0000-4000-8000-000000000006',
    '90000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000001',
    '[{"type":"wechat","label":"微信","value":"circle_seed_teamup_promote_member"}]'::jsonb,
    NOW() - INTERVAL '45 minutes',
    NOW() - INTERVAL '30 minutes'
  ),
  (
    '92000000-0000-4000-8000-000000000007',
    '90000000-0000-4000-8000-000000000005',
    '20000000-0000-4000-8000-000000000002',
    '[{"type":"wechat","label":"微信","value":"circle_peer_teamup_waitlist_demo"}]'::jsonb,
    NOW() - INTERVAL '40 minutes',
    NOW() - INTERVAL '20 minutes'
  ),
  (
    '92000000-0000-4000-8000-000000000008',
    '90000000-0000-4000-8000-000000000005',
    '50000000-0000-4000-8000-000000000005',
    '[{"type":"wechat","label":"微信","value":"circle_waitlist_teammate"}]'::jsonb,
    NOW() - INTERVAL '35 minutes',
    NOW() - INTERVAL '20 minutes'
  );

INSERT INTO teamup_applications (
  id,
  teamup_id,
  applicant_id,
  application_type,
  application_note,
  card_snapshot,
  card_snapshot_view,
  card_snapshot_relationship,
  contact_payload,
  status,
  reviewed_by,
  review_note,
  reviewed_at,
  waitlist_joined_at,
  created_at,
  updated_at
)
VALUES
  (
    '93000000-0000-4000-8000-000000000001',
    '90000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    'join',
    '我周末下午有空，想跟新手局一起练一练网前轮转。',
    '{
      "previewMode":"public",
      "nickname":"北苑杀球王",
      "avatarUrl":null,
      "baseModules":[
        {"key":"grade","label":"年级","value":"2022"},
        {"key":"campus","label":"校区","value":"gulou"},
        {"key":"department","label":"院系","value":"新闻传播学院"}
      ],
      "circleCards":[
        {
          "circleId":"30000000-0000-4000-8000-000000000003",
          "circleName":"羽毛球夜场研究所",
          "modules":[
            {"key":"skill_level","label":"羽球熟练度","value":"能连续回合"},
            {"key":"active_slot","label":"常出没时间","value":["工作日晚场","周末晚场"]}
          ]
        }
      ]
    }'::jsonb,
    'public',
    'not_friend',
    '[{"type":"wechat","label":"微信","value":"circle_peer_teamup_application"}]'::jsonb,
    'pending',
    NULL,
    NULL,
    NULL,
    NULL,
    NOW() - INTERVAL '1 hour',
    NOW() - INTERVAL '1 hour'
  ),
  (
    '93000000-0000-4000-8000-000000000002',
    '90000000-0000-4000-8000-000000000004',
    '50000000-0000-4000-8000-000000000005',
    'waitlist',
    '如果有人临时退出，我可以马上补位参加晨练。',
    '{
      "previewMode":"public",
      "nickname":"候补小拍",
      "avatarUrl":null,
      "baseModules":[
        {"key":"grade","label":"年级","value":"2024"},
        {"key":"campus","label":"校区","value":"xianlin"},
        {"key":"department","label":"院系","value":"外国语学院"}
      ],
      "circleCards":[
        {
          "circleId":"30000000-0000-4000-8000-000000000003",
          "circleName":"羽毛球夜场研究所",
          "modules":[
            {"key":"skill_level","label":"羽球熟练度","value":"刚入门"},
            {"key":"active_slot","label":"常出没时间","value":["周末下午","周末晚场"]}
          ]
        }
      ]
    }'::jsonb,
    'public',
    'not_friend',
    '[{"type":"wechat","label":"微信","value":"circle_waitlist_teamup_application"}]'::jsonb,
    'approved',
    '20000000-0000-4000-8000-000000000002',
    '候补资格已确认，等待空位自动补位。',
    NOW() - INTERVAL '35 minutes',
    NULL,
    NOW() - INTERVAL '40 minutes',
    NOW() - INTERVAL '35 minutes'
  );

-- ---------------------------------------------------------------------------
-- Circle match + forum sample
-- ---------------------------------------------------------------------------

WITH current_circle_week AS (
  SELECT (
    (
      (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Shanghai')::date
      - (
        ((EXTRACT(DOW FROM (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Shanghai'))::INT + 4) % 7)
        * INTERVAL '1 day'
      )
    )::date
  )::text AS week_of
)
INSERT INTO circle_matches (
  id,
  circle_id,
  week_of,
  user_a_id,
  user_b_id,
  score,
  user_a_action,
  user_b_action,
  status,
  revealed_at,
  created_at
)
SELECT
  '88000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000003',
  week_of,
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  0.93,
  NULL,
  NULL,
  'REVEALED',
  NOW(),
  NOW()
FROM current_circle_week
ON CONFLICT (id) DO UPDATE
SET
  week_of = EXCLUDED.week_of,
  score = EXCLUDED.score,
  user_a_action = EXCLUDED.user_a_action,
  user_b_action = EXCLUDED.user_b_action,
  status = EXCLUDED.status,
  revealed_at = EXCLUDED.revealed_at,
  created_at = EXCLUDED.created_at;

INSERT INTO forum_posts (
  id,
  user_id,
  circle_id,
  title,
  content,
  type,
  is_anonymous,
  visibility,
  is_pinned,
  is_locked,
  like_count,
  favorite_count,
  comment_count,
  view_count,
  hot_score,
  last_interaction_at,
  has_images,
  created_at,
  updated_at,
  deleted_at
)
VALUES
  (
    '86000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000003',
    '本周五仙林双打补位',
    '【兴趣圈组队同步帖】

来自「羽毛球夜场研究所」的公开组队：

本周五仙林双打补位

周五晚上想在仙林体育馆打一场双打，水平不限，场地费 AA。

人数：1 / 4
准入：推门即入
状态：招募中
截止：创建后约 2 天
结束：截止后约 3 小时

查看和加入请前往组队详情：
/circles/30000000-0000-4000-8000-000000000003/teamups/90000000-0000-4000-8000-000000000001

注：这是当前论坛普通帖子形态下的同步效果；论坛前端暂未对组队帖做专门卡片渲染。',
    'squad',
    FALSE,
    'public',
    FALSE,
    FALSE,
    1,
    1,
    1,
    12,
    8.8,
    NOW() - INTERVAL '40 minutes',
    FALSE,
    NOW() - INTERVAL '2 hours',
    NOW(),
    NULL
  ),
  (
    '86000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    NULL,
    '全站测试帖：周末有人想交换片单吗',
    '这是一条给测试同学准备的全站论坛样例帖。可以用它测试总论坛列表、详情、评论、点赞、收藏、举报和管理员置顶/删帖。',
    'general',
    FALSE,
    'public',
    TRUE,
    FALSE,
    0,
    0,
    1,
    6,
    6.2,
    NOW() - INTERVAL '25 minutes',
    FALSE,
    NOW() - INTERVAL '1 hour',
    NOW() - INTERVAL '20 minutes',
    NULL
  )
ON CONFLICT (id) DO UPDATE
SET
  circle_id = EXCLUDED.circle_id,
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  type = EXCLUDED.type,
  is_anonymous = EXCLUDED.is_anonymous,
  visibility = EXCLUDED.visibility,
  is_pinned = EXCLUDED.is_pinned,
  is_locked = EXCLUDED.is_locked,
  like_count = EXCLUDED.like_count,
  favorite_count = EXCLUDED.favorite_count,
  comment_count = EXCLUDED.comment_count,
  view_count = EXCLUDED.view_count,
  hot_score = EXCLUDED.hot_score,
  last_interaction_at = EXCLUDED.last_interaction_at,
  has_images = EXCLUDED.has_images,
  updated_at = NOW(),
  deleted_at = NULL;

INSERT INTO forum_comments (
  id,
  post_id,
  user_id,
  content,
  comment_type,
  voice_url,
  voice_duration_sec,
  transcript,
  transcript_status,
  parent_comment_id,
  root_comment_id,
  like_count,
  created_at,
  updated_at,
  deleted_at
)
VALUES
  (
    '87000000-0000-4000-8000-000000000001',
    '86000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    '我可以，本周三和周五都行，提前在圈里戳我就好。',
    'text',
    NULL,
    NULL,
    NULL,
    'none',
    NULL,
    NULL,
    0,
    NOW() - INTERVAL '50 minutes',
    NOW() - INTERVAL '50 minutes',
    NULL
  ),
  (
    '87000000-0000-4000-8000-000000000002',
    '86000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '可以，从悬疑片开始互换十部？',
    'text',
    NULL,
    NULL,
    NULL,
    'none',
    NULL,
    NULL,
    0,
    NOW() - INTERVAL '35 minutes',
    NOW() - INTERVAL '35 minutes',
    NULL
  )
ON CONFLICT (id) DO UPDATE
SET
  content = EXCLUDED.content,
  comment_type = EXCLUDED.comment_type,
  voice_url = EXCLUDED.voice_url,
  voice_duration_sec = EXCLUDED.voice_duration_sec,
  transcript = EXCLUDED.transcript,
  transcript_status = EXCLUDED.transcript_status,
  parent_comment_id = EXCLUDED.parent_comment_id,
  root_comment_id = EXCLUDED.root_comment_id,
  like_count = EXCLUDED.like_count,
  updated_at = NOW(),
  deleted_at = NULL;

INSERT INTO forum_post_likes (id, post_id, user_id, created_at)
VALUES
  (
    '86600000-0000-4000-8000-000000000001',
    '86000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    NOW() - INTERVAL '45 minutes'
  )
ON CONFLICT (post_id, user_id) DO NOTHING;

INSERT INTO forum_post_favorites (id, post_id, user_id, created_at)
VALUES
  (
    '86700000-0000-4000-8000-000000000001',
    '86000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    NOW() - INTERVAL '44 minutes'
  )
ON CONFLICT (post_id, user_id) DO NOTHING;

INSERT INTO forum_announcements (
  id,
  title,
  content,
  created_by,
  is_active,
  priority,
  starts_at,
  ends_at,
  created_at
)
VALUES
  (
    '86900000-0000-4000-8000-000000000001',
    'Docker 测试公告',
    '这条公告由 init.sql 预置，用于验证总论坛公告弹窗、管理员公告列表和启停状态。',
    NULL,
    TRUE,
    10,
    NOW() - INTERVAL '1 day',
    NOW() + INTERVAL '7 days',
    NOW() - INTERVAL '1 hour'
  )
ON CONFLICT (id) DO UPDATE
SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  created_by = EXCLUDED.created_by,
  is_active = EXCLUDED.is_active,
  priority = EXCLUDED.priority,
  starts_at = EXCLUDED.starts_at,
  ends_at = EXCLUDED.ends_at;

INSERT INTO forum_guestbook_messages (id, user_id, content, status, created_at)
VALUES
  (
    '86800000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'Docker 真机链路测试：留言墙可见。',
    'visible',
    NOW() - INTERVAL '30 minutes'
  )
ON CONFLICT (id) DO UPDATE
SET
  content = EXCLUDED.content,
  status = EXCLUDED.status;

INSERT INTO forum_reports (
  id,
  reporter_id,
  reported_user_id,
  target_type,
  post_id,
  comment_id,
  reason,
  detail,
  status,
  admin_note,
  reviewed_by,
  reviewed_at,
  created_at,
  updated_at
)
VALUES
  (
    '86500000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    'post',
    '86000000-0000-4000-8000-000000000002',
    NULL,
    'other',
    'Docker 测试用待处理举报，可在管理员后台论坛举报中处理。',
    'pending',
    NULL,
    NULL,
    NULL,
    NOW() - INTERVAL '10 minutes',
    NOW() - INTERVAL '10 minutes'
  )
ON CONFLICT (id) DO UPDATE
SET
  reported_user_id = EXCLUDED.reported_user_id,
  reason = EXCLUDED.reason,
  detail = EXCLUDED.detail,
  status = EXCLUDED.status,
  admin_note = EXCLUDED.admin_note,
  reviewed_by = EXCLUDED.reviewed_by,
  reviewed_at = EXCLUDED.reviewed_at,
  updated_at = NOW();

INSERT INTO user_notifications (
  id,
  user_id,
  type,
  title,
  content,
  meta,
  is_read,
  created_at
)
VALUES
  (
    '89000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    'circle_join_received',
    '新的入圈申请',
    '阿球申请加入「午夜观影会」',
    '{"circleId":"40000000-0000-4000-8000-000000000004","requestId":"85000000-0000-4000-8000-000000000001"}'::jsonb,
    FALSE,
    NOW() - INTERVAL '20 minutes'
  ),
  (
    '89000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    'contact_unlock_received',
    '新的联系方式申请',
    '阿球申请查看你在「羽毛球夜场研究所」开放的联系方式',
    '{"circleId":"30000000-0000-4000-8000-000000000003","requestId":"85600000-0000-4000-8000-000000000001"}'::jsonb,
    FALSE,
    NOW() - INTERVAL '30 minutes'
  ),
  (
    '89000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000002',
    'post_replied',
    '有人评论了你的帖子',
    '阿球评论了你的全站测试帖',
    '{"postId":"86000000-0000-4000-8000-000000000002","commentId":"87000000-0000-4000-8000-000000000002"}'::jsonb,
    FALSE,
    NOW() - INTERVAL '35 minutes'
  ),
  (
    '89000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000001',
    'teamup_application_received',
    '新的组队申请',
    '北苑杀球王申请加入你的组队「周末新手友好练球」',
    '{"circleId":"30000000-0000-4000-8000-000000000003","teamupId":"90000000-0000-4000-8000-000000000002","applicationId":"93000000-0000-4000-8000-000000000001","applicantId":"20000000-0000-4000-8000-000000000002","applicationType":"join","actionUrl":"/circles/30000000-0000-4000-8000-000000000003/teamups/90000000-0000-4000-8000-000000000002"}'::jsonb,
    FALSE,
    NOW() - INTERVAL '12 minutes'
  ),
  (
    '89000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000001',
    'teamup_member_joined',
    '有新成员加入组队',
    '北苑杀球王已加入你的组队「联系方式窗口测试局」',
    '{"circleId":"30000000-0000-4000-8000-000000000003","teamupId":"90000000-0000-4000-8000-000000000003","memberId":"20000000-0000-4000-8000-000000000002","actionUrl":"/circles/30000000-0000-4000-8000-000000000003/teamups/90000000-0000-4000-8000-000000000003"}'::jsonb,
    FALSE,
    NOW() - INTERVAL '10 minutes'
  ),
  (
    '89000000-0000-4000-8000-000000000006',
    '10000000-0000-4000-8000-000000000001',
    'announcement',
    '全站通知链路已接通',
    '第二组的组队事件已经进入统一站内通知，点击可从全站通知直达组队详情。',
    '{"actionUrl":"/dashboard"}'::jsonb,
    FALSE,
    NOW() - INTERVAL '8 minutes'
  )
ON CONFLICT (id) DO UPDATE
SET
  user_id = EXCLUDED.user_id,
  type = EXCLUDED.type,
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  meta = EXCLUDED.meta,
  is_read = EXCLUDED.is_read,
  created_at = EXCLUDED.created_at;

-- ---------------------------------------------------------------------------
-- Final member count sync
-- ---------------------------------------------------------------------------

UPDATE circles
SET member_count = (
  SELECT COUNT(*)::INT
  FROM circle_members
  WHERE circle_id = circles.id
)
WHERE id IN (
  '30000000-0000-4000-8000-000000000003',
  '40000000-0000-4000-8000-000000000004'
);

COMMIT;
