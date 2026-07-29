import { sql } from 'drizzle-orm';
import { pgTable, text, boolean, doublePrecision, serial, timestamp, integer, real, uniqueIndex, index, jsonb, type AnyPgColumn } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  nickname: text('nickname'),
  gender: text('gender'), // 'male' | 'female'
  genderPref: text('gender_pref'), // 'male' | 'female' | 'any'
  intention: text('intention'), // 'friend' | 'partner'
  grade: text('grade'),
  campus: text('campus'), // 'xianlin' | 'gulou' | 'other'
  department: text('department'),
  mbti: text('mbti'),
  bio: text('bio'),
  signature: text('signature'),
  tags: jsonb('tags').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  avatarUrl: text('avatar_url'),
  wechatId: text('wechat_id'),
  isParticipating: boolean('is_participating').default(true),
  pauseUntilWeek: text('pause_until_week'), // YYYY-MM-DD of the Wednesday; null = not paused
  autoPausedAt: text('auto_paused_at'), // YYYY-MM-DD or null, set when user misses a match
  emailNotifications: boolean('email_notifications').notNull().default(true),
  profileComplete: boolean('profile_complete').default(false),
  surveyComplete: boolean('survey_complete').default(false),
  // Heartbox prerequisite: verified student id binding (hashed; do not store plaintext)
  studentIdHash: text('student_id_hash').unique(),
  studentIdVerifiedAt: timestamp('student_id_verified_at', { withTimezone: true, mode: 'string' }),
  studentIdBindSource: text('student_id_bind_source'),
  studentIdLast4: text('student_id_last4'),
  heartboxCooldownUntil: timestamp('heartbox_cooldown_until', { withTimezone: true, mode: 'string' }),
  creditScore: integer('credit_score').notNull().default(100),
  creditLevel: text('credit_level').notNull().default('normal'), // 'normal' | 'limited' | 'banned'
  mergedIntoUserId: text('merged_into_user_id').references((): AnyPgColumn => users.id),
  mergedAt: timestamp('merged_at', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const surveyAnswers = pgTable('survey_answers', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id).unique(),
  answers: text('answers').notNull(), // JSON string
  version: text('version').notNull().default('1.0'),
  submittedAt: timestamp('submitted_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const matches = pgTable('matches', {
  id: text('id').primaryKey(),
  weekOf: text('week_of').notNull(), // 'YYYY-MM-DD' of the Wednesday
  userAId: text('user_a_id').notNull().references(() => users.id),
  userBId: text('user_b_id').notNull().references(() => users.id),
  score: doublePrecision('score').notNull(), // 0.0 ~ 1.0
  dimensions: text('dimensions'), // JSON: per-dimension scores
  curatorNote: text('curator_note'),
  userAAction: text('user_a_action'), // 'ACCEPT' | 'REJECT'
  userBAction: text('user_b_action'), // 'ACCEPT' | 'REJECT'
  status: text('status').notNull().default('LOCKED'), // 'LOCKED' | 'REVEALED' | 'MUTUAL' | 'MISSED' | 'EXPIRED'
  revealedAt: text('revealed_at'),
  // Heartbox integration
  source: text('source').notNull().default('weekly'), // 'weekly' | 'heartbox'
  scoreVisible: boolean('score_visible').notNull().default(true),
  specialLabel: text('special_label'),
  activatedAt: timestamp('activated_at', { withTimezone: true, mode: 'string' }),
  consumedWeekOf: text('consumed_week_of'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
});

// ─── Heartbox ───────────────────────────────────────────────────

export const heartSignals = pgTable('heart_signals', {
  id: text('id').primaryKey(),
  senderId: text('sender_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  targetStudentIdHash: text('target_student_id_hash').notNull(),
  targetStudentIdMasked: text('target_student_id_masked').notNull(),
  resolvedTargetUserId: text('resolved_target_user_id').references(() => users.id, { onDelete: 'set null' }),

  status: text('status').notNull().default('active'), // active | cancelled | matched | expired | suppressed
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true, mode: 'string' }),
  matchedAt: timestamp('matched_at', { withTimezone: true, mode: 'string' }),
});

export const heartMatches = pgTable('heart_matches', {
  id: text('id').primaryKey(),
  userAId: text('user_a_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  userBId: text('user_b_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  signalAId: text('signal_a_id').references(() => heartSignals.id, { onDelete: 'set null' }),
  signalBId: text('signal_b_id').references(() => heartSignals.id, { onDelete: 'set null' }),
  mainMatchId: text('main_match_id').references(() => matches.id, { onDelete: 'set null' }),

  status: text('status').notNull().default('active'), // active | queued | dismissed | blocked
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (t) => [
  uniqueIndex('uniq_heart_matches_pair').on(t.userAId, t.userBId),
]);

export const mailLogs = pgTable('mail_logs', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  weekOf: text('week_of').notNull(),
  mailType: text('mail_type').notNull(), // SURVEY_REMINDER | MATCH_REVEALED | MATCH_MUTUAL
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const otpCodes = pgTable('otp_codes', {
  id: serial('id').primaryKey(),
  email: text('email').notNull(),
  purpose: text('purpose').notNull().default('register'),
  code: text('code').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
});

// ─── Circle Social ────────────────────────────────────────────────

export const circles = pgTable('circles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  category: text('category').notNull(), // 'sports' | 'academic' | 'arts' | 'professional' | 'lifestyle'
  tag: text('tag').notNull().default(''),
  tags: jsonb('tags').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  joinPolicy: text('join_policy').notNull().default('public'), // 'public' | 'review' | 'invite'
  joinQuestion: text('join_question'),
  joinQuestions: jsonb('join_questions').$type<Array<{
    id: string;
    question: string;
    required: boolean;
  }>>().notNull().default(sql`'[]'::jsonb`),
  inviteCode: text('invite_code'),
  inviteCodeHash: text('invite_code_hash'),
  capacityLimit: integer('capacity_limit'),
  keywordRules: jsonb('keyword_rules').$type<Array<{
    keyword: string;
    action: 'reject';
  }>>().notNull().default(sql`'[]'::jsonb`),
  iconUrl: text('icon_url'),
  creatorId: text('creator_id').references(() => users.id, { onDelete: 'set null' }),
  memberCount: integer('member_count').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  status: text('status').notNull().default('active'), // 'active' | 'inactive' | 'pending_review' | 'rejected' | 'banned' | 'archived'
  reviewNote: text('review_note'),
  reviewedBy: text('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const circleQuestions = pgTable('circle_questions', {
  id: text('id').primaryKey(),
  circleId: text('circle_id').notNull().references(() => circles.id),
  key: text('key').notNull(), // unique within circle, e.g. 'skill_level'
  // Historical note: this table is now primarily used as B-card component definitions.
  // The enum values below come from the old circle-questionnaire model and remain for compatibility.
  type: text('type').notNull(), // 'scale' | 'single_choice' | 'multi_choice' | 'ranking'
  prompt: text('prompt').notNull(),
  // Historical questionnaire residue. New card-editing flows do not need to treat this as mandatory UI options.
  options: text('options'), // JSON array, for legacy choice-like configs
  weight: real('weight').notNull().default(1.0),
  displayOrder: integer('display_order').notNull().default(0),
  isChannelTag: boolean('is_channel_tag').default(false),
});

export const userCircleCustomCards = pgTable('user_circle_custom_cards', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  circleId: text('circle_id').notNull().references(() => circles.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  value: text('value').notNull(),
  displayOrder: integer('display_order').notNull().default(0),
  topLeftX: integer('top_left_x').notNull().default(0),
  topLeftY: integer('top_left_y').notNull().default(0),
  width: integer('width').notNull().default(1),
  height: integer('height').notNull().default(1),
  visibilityLevel: text('visibility_level').notNull().default('public'), // 'public' | 'friends' | 'hidden'
  status: text('status').notNull().default('pending'), // 'pending' | 'approved' | 'rejected'
  reviewNote: text('review_note'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (t) => [
  index('idx_user_circle_custom_cards_user_circle').on(t.userId, t.circleId),
  index('idx_user_circle_custom_cards_status_circle').on(t.status, t.circleId),
]);

export const circleMembers = pgTable('circle_members', {
  id: text('id').primaryKey(),
  circleId: text('circle_id').notNull().references(() => circles.id),
  userId: text('user_id').notNull().references(() => users.id),
  membershipStatus: text('membership_status').notNull().default('active'), // 'pending' | 'active'
  answers: text('answers'), // JSON: { key: { value, importance? } }
  answersComplete: boolean('answers_complete').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  joinedAt: timestamp('joined_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (t) => [
  uniqueIndex('idx_circle_members_circle_user').on(t.circleId, t.userId),
]);

export const circleMemberLocations = pgTable('circle_member_locations', {
  id: text('id').primaryKey(),
  circleId: text('circle_id').notNull().references(() => circles.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  accuracyMeters: integer('accuracy_meters').notNull(),
  isEnabled: boolean('is_enabled').notNull().default(true),
  capturedAt: timestamp('captured_at', { withTimezone: true, mode: 'string' }),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (t) => [
  uniqueIndex('idx_circle_member_locations_circle_user').on(t.circleId, t.userId),
  index('idx_circle_member_locations_circle_enabled_expires').on(t.circleId, t.isEnabled, t.expiresAt),
  index('idx_circle_member_locations_circle_geo').on(t.circleId, t.isEnabled, t.latitude, t.longitude),
  index('idx_circle_member_locations_user').on(t.userId),
]);

export const circleMemberLocationCooldowns = pgTable('circle_member_location_cooldowns', {
  id: text('id').primaryKey(),
  circleId: text('circle_id').notNull().references(() => circles.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  lastUpdatedAt: timestamp('last_updated_at', { withTimezone: true, mode: 'string' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (t) => [
  uniqueIndex('idx_circle_member_location_cooldowns_circle_user').on(t.circleId, t.userId),
  index('idx_circle_member_location_cooldowns_user').on(t.userId),
]);

export const circleMemberRoles = pgTable('circle_member_roles', {
  id: text('id').primaryKey(),
  circleId: text('circle_id').notNull().references(() => circles.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // 'owner' | 'admin' | 'moderator'
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (t) => [
  uniqueIndex('idx_circle_member_roles_circle_user_role').on(t.circleId, t.userId, t.role),
  index('idx_circle_member_roles_circle_role').on(t.circleId, t.role),
  index('idx_circle_member_roles_user').on(t.userId),
]);

export const circleJoinRequests = pgTable('circle_join_requests', {
  id: text('id').primaryKey(),
  circleId: text('circle_id').notNull().references(() => circles.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  applicationAnswer: text('application_answer'),
  applicationAnswers: jsonb('application_answers').$type<Record<string, string>>(),
  applicationReason: text('application_reason'),
  status: text('status').notNull().default('pending_review'), // 'pending_review' | 'approved' | 'rejected' | 'expired' | 'withdrawn'
  rejectReason: text('reject_reason'),
  reviewedBy: text('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true, mode: 'string' }),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (t) => [
  uniqueIndex('idx_circle_join_requests_pending').on(t.circleId, t.userId).where(sql`${t.status} = 'pending_review'`),
  index('idx_circle_join_requests_circle_status').on(t.circleId, t.status, t.createdAt),
  index('idx_circle_join_requests_user_status').on(t.userId, t.status, t.createdAt),
]);

export const circleBlacklist = pgTable('circle_blacklist', {
  id: text('id').primaryKey(),
  circleId: text('circle_id').notNull().references(() => circles.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  reason: text('reason'),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (t) => [
  uniqueIndex('idx_circle_blacklist_circle_user').on(t.circleId, t.userId),
  index('idx_circle_blacklist_user').on(t.userId),
]);

export const circleMatches = pgTable('circle_matches', {
  id: text('id').primaryKey(),
  circleId: text('circle_id').notNull().references(() => circles.id),
  weekOf: text('week_of').notNull(), // YYYY-MM-DD (Wednesday)
  userAId: text('user_a_id').notNull().references(() => users.id),
  userBId: text('user_b_id').notNull().references(() => users.id),
  score: doublePrecision('score').notNull(),
  userAAction: text('user_a_action'), // 'ACCEPT' | 'REJECT'
  userBAction: text('user_b_action'), // 'ACCEPT' | 'REJECT'
  status: text('status').notNull().default('LOCKED'), // 'LOCKED' | 'REVEALED' | 'MUTUAL' | 'MISSED'
  revealedAt: timestamp('revealed_at', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (t) => [
  uniqueIndex('idx_circle_matches_circle_week_a').on(t.circleId, t.weekOf, t.userAId),
  uniqueIndex('idx_circle_matches_circle_week_b').on(t.circleId, t.weekOf, t.userBId),
]);

// ─── Circle Chat ─────────────────────────────────────────────────

export const circleChatMessages = pgTable('circle_chat_messages', {
  id: text('id').primaryKey(),
  circleId: text('circle_id').notNull().references(() => circles.id, { onDelete: 'cascade' }),
  senderId: text('sender_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  clientMessageId: text('client_message_id').notNull(),
  content: text('content').notNull(),
  mentions: jsonb('mentions').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  status: text('status').notNull().default('visible'), // 'visible' | 'deleted'
  deletedBy: text('deleted_by').references(() => users.id, { onDelete: 'set null' }),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (t) => [
  index('idx_circle_chat_messages_circle_created').on(t.circleId, t.createdAt),
  index('idx_circle_chat_messages_sender_created').on(t.senderId, t.createdAt),
  uniqueIndex('idx_circle_chat_messages_sender_client').on(t.circleId, t.senderId, t.clientMessageId),
]);

export const circleChatReadStates = pgTable('circle_chat_read_states', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  circleId: text('circle_id').notNull().references(() => circles.id, { onDelete: 'cascade' }),
  lastReadMessageId: text('last_read_message_id').references(() => circleChatMessages.id, { onDelete: 'set null' }),
  lastReadAt: timestamp('last_read_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (t) => [
  uniqueIndex('idx_circle_chat_read_states_user_circle').on(t.userId, t.circleId),
  index('idx_circle_chat_read_states_user_updated').on(t.userId, t.updatedAt),
]);

export const teamupChatMessages = pgTable('teamup_chat_messages', {
  id: text('id').primaryKey(),
  teamupId: text('teamup_id').notNull().references(() => teamups.id, { onDelete: 'cascade' }),
  circleId: text('circle_id').notNull().references(() => circles.id, { onDelete: 'cascade' }),
  senderId: text('sender_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  clientMessageId: text('client_message_id').notNull(),
  content: text('content').notNull(),
  mentions: jsonb('mentions').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  status: text('status').notNull().default('visible'), // 'visible' | 'deleted'
  deletedBy: text('deleted_by').references(() => users.id, { onDelete: 'set null' }),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (t) => [
  index('idx_teamup_chat_messages_teamup_created').on(t.teamupId, t.createdAt),
  index('idx_teamup_chat_messages_circle_created').on(t.circleId, t.createdAt),
  index('idx_teamup_chat_messages_sender_created').on(t.senderId, t.createdAt),
  uniqueIndex('idx_teamup_chat_messages_sender_client').on(t.teamupId, t.senderId, t.clientMessageId),
]);

export const teamupChatReadStates = pgTable('teamup_chat_read_states', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  teamupId: text('teamup_id').notNull().references(() => teamups.id, { onDelete: 'cascade' }),
  lastReadMessageId: text('last_read_message_id').references(() => teamupChatMessages.id, { onDelete: 'set null' }),
  lastReadAt: timestamp('last_read_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (t) => [
  uniqueIndex('idx_teamup_chat_read_states_user_teamup').on(t.userId, t.teamupId),
  index('idx_teamup_chat_read_states_user_updated').on(t.userId, t.updatedAt),
]);

// ─── Safety & Audit ────────────────────────────────────────────────

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  operatorId: text('operator_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),   // e.g. 'trigger_matching', 'unlock_reveal', 'bulk_email'
  target: text('target'),             // target user/entity id
  detail: text('detail'),             // JSON blob of extra context
  ip: text('ip'),
  result: text('result').notNull().default('success'), // 'success' | 'failure'
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const userBlocks = pgTable('user_blocks', {
  id: text('id').primaryKey(),
  blockerId: text('blocker_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  blockedId: text('blocked_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (t) => [
  uniqueIndex('idx_user_blocks_blocker_blocked').on(t.blockerId, t.blockedId),
  index('idx_user_blocks_blocked').on(t.blockedId),
]);

export const userReports = pgTable('user_reports', {
  id: text('id').primaryKey(),
  reporterId: text('reporter_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  reportedId: text('reported_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  reason: text('reason').notNull(),
  detail: text('detail'),
  status: text('status').notNull().default('pending'), // 'pending' | 'reviewed' | 'warn_update' | 'dismissed'
  adminNote: text('admin_note'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const creditScoreLogs = pgTable('credit_score_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  delta: integer('delta').notNull(),
  reason: text('reason').notNull(),
  sourceType: text('source_type').notNull(),
  sourceId: text('source_id'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (t) => [
  index('idx_credit_score_logs_user_created').on(t.userId, t.createdAt),
  index('idx_credit_score_logs_source').on(t.sourceType, t.sourceId),
]);

// ─── Cards System (M1) ─────────────────────────────────────────────

export const cardModules = pgTable('card_modules', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category').notNull(), // 'basic' | 'contact' | 'interests' | 'game'
  isSystem: boolean('is_system').default(false),
});

export const userCards = pgTable('user_cards', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  modules: jsonb('modules').$type<Array<{
    moduleKey: string;
    value: unknown;
    visibilityLevel: 'public' | 'friends' | 'hidden';
    displayOrder: number;
  }>>().notNull().default(sql`'[]'::jsonb`),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const baseCardComponents = pgTable('base_card_components', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  sourceType: text('source_type').notNull(),
  sourceKey: text('source_key'),
});

export const userBaseCards = pgTable('user_base_cards', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  isActive: boolean('is_active').notNull().default(true),
  components: jsonb('components').$type<Array<{
    key: string;
    name: string;
    value: unknown;
    topLeft: [number, number];
    width: number;
    height: number;
    status: 'public' | 'circle' | 'friends' | 'hidden' | 'deleted';
  }>>().notNull().default(sql`'[]'::jsonb`),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const userCardPreferences = pgTable('user_card_preferences', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  hiddenPreviewMode: text('hidden_preview_mode').notNull().default('titles_only'), // 'titles_only' | 'fully_hidden'
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const userCircleCards = pgTable('user_circle_cards', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  circleId: text('circle_id').notNull().references(() => circles.id, { onDelete: 'cascade' }),
  isActive: boolean('is_active').notNull().default(true),
  components: jsonb('components').$type<Array<{
    key: string;
    name: string;
    value: unknown;
    topLeft: [number, number];
    width: number;
    height: number;
    status: 'public' | 'circle' | 'friends' | 'hidden' | 'deleted';
  }>>().notNull().default(sql`'[]'::jsonb`),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (t) => [
  uniqueIndex('idx_user_circle_cards_user_circle').on(t.userId, t.circleId),
]);

export const circleCardOverrides = pgTable('circle_card_overrides', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  circleId: text('circle_id').notNull().references(() => circles.id, { onDelete: 'cascade' }),
  overrides: jsonb('overrides').$type<Record<string, {
    value?: unknown;
    visibilityLevel?: 'public' | 'friends' | 'hidden';
  }>>().notNull().default(sql`'{}'::jsonb`),
}, (t) => [
  uniqueIndex('idx_circle_card_overrides_user_circle').on(t.userId, t.circleId),
]);

// ─── Social Relations (M2) ─────────────────────────────────────────

export const friendships = pgTable('friendships', {
  id: text('id').primaryKey(),
  circleId: text('circle_id').notNull().references(() => circles.id, { onDelete: 'cascade' }),
  userAId: text('user_a_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  userBId: text('user_b_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (t) => [
  uniqueIndex('idx_friendships_circle_users').on(t.circleId, t.userAId, t.userBId),
  index('idx_friendships_user_a_circle').on(t.userAId, t.circleId),
  index('idx_friendships_user_b_circle').on(t.userBId, t.circleId),
]);

export const globalFriendships = pgTable('global_friendships', {
  id: text('id').primaryKey(),
  userAId: text('user_a_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  userBId: text('user_b_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sourceType: text('source_type').notNull().default('circle'), // 'circle' | 'global'
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (t) => [
  uniqueIndex('idx_global_friendships_users').on(t.userAId, t.userBId),
  index('idx_global_friendships_user_a').on(t.userAId),
  index('idx_global_friendships_user_b').on(t.userBId),
]);

export const userFollows = pgTable('user_follows', {
  id: text('id').primaryKey(),
  followerId: text('follower_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  followeeId: text('followee_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (t) => [
  // One directed follow edge per pair.
  uniqueIndex('idx_user_follows_unique').on(t.followerId, t.followeeId),
  index('idx_user_follows_follower').on(t.followerId, t.createdAt),
  index('idx_user_follows_followee').on(t.followeeId, t.createdAt),
]);

export const userMessageSettings = pgTable('user_message_settings', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  allowDirectMessagesFrom: text('allow_direct_messages_from').notNull().default('all'), // 'all' | 'following' | 'mutual' | 'none'
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const directMessageConversations = pgTable('direct_message_conversations', {
  id: text('id').primaryKey(),
  userAId: text('user_a_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  userBId: text('user_b_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (t) => [
  // Conversations are unique per normalized user pair.
  uniqueIndex('idx_direct_message_conversations_users').on(t.userAId, t.userBId),
  index('idx_direct_message_conversations_user_a').on(t.userAId, t.lastMessageAt),
  index('idx_direct_message_conversations_user_b').on(t.userBId, t.lastMessageAt),
]);

export const directMessages = pgTable('direct_messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => directMessageConversations.id, { onDelete: 'cascade' }),
  senderId: text('sender_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  receiverId: text('receiver_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  messageType: text('message_type').notNull().default('text'), // 'text' | 'image' | 'voice'
  content: text('content'),                                     // nullable — only for text messages
  imageUrls: jsonb('image_urls').$type<string[]>(),            // image URL array
  voiceUrl: text('voice_url'),                                 // voice file URL
  voiceDurationSec: integer('voice_duration_sec'),             // voice duration in seconds
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  readAt: timestamp('read_at', { withTimezone: true, mode: 'string' }),
  recalledAt: timestamp('recalled_at', { withTimezone: true, mode: 'string' }),
  recalledById: text('recalled_by_id').references(() => users.id, { onDelete: 'set null' }),
}, (t) => [
  index('idx_direct_messages_conversation_created').on(t.conversationId, t.createdAt),
  index('idx_direct_messages_receiver_read').on(t.receiverId, t.readAt, t.createdAt),
  index('idx_direct_messages_type').on(t.messageType),
  index('idx_direct_messages_recalled_at').on(t.recalledAt),
]);

export const friendRequests = pgTable('friend_requests', {
  id: text('id').primaryKey(),
  circleId: text('circle_id').references(() => circles.id, { onDelete: 'cascade' }),
  sourceType: text('source_type').notNull().default('circle'), // 'circle' | 'global'
  senderId: text('sender_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  receiverId: text('receiver_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  cardSnapshot: jsonb('card_snapshot').$type<Record<string, unknown> | Array<Record<string, unknown>>>(),
  message: text('message'),
  status: text('status').notNull().default('pending'), // 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'expired'
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }).default(sql`NOW() + INTERVAL '7 days'`),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (t) => [
  uniqueIndex('idx_friend_requests_circle_sender_receiver').on(t.circleId, t.senderId, t.receiverId).where(sql`${t.status} = 'pending' AND ${t.sourceType} = 'circle'`),
  uniqueIndex('idx_friend_requests_circle_pair_pending').on(
    t.circleId,
    sql`LEAST(${t.senderId}, ${t.receiverId})`,
    sql`GREATEST(${t.senderId}, ${t.receiverId})`,
  ).where(sql`${t.status} = 'pending' AND ${t.sourceType} = 'circle'`),
  uniqueIndex('idx_friend_requests_global_sender_receiver').on(t.senderId, t.receiverId).where(sql`${t.status} = 'pending' AND ${t.sourceType} = 'global'`),
  uniqueIndex('idx_friend_requests_global_pair_pending').on(
    sql`LEAST(${t.senderId}, ${t.receiverId})`,
    sql`GREATEST(${t.senderId}, ${t.receiverId})`,
  ).where(sql`${t.status} = 'pending' AND ${t.sourceType} = 'global'`),
  index('idx_friend_requests_receiver_status_circle').on(t.receiverId, t.status, t.circleId),
  index('idx_friend_requests_receiver_status_source').on(t.receiverId, t.status, t.sourceType, t.circleId),
]);

export const contactUnlockRequests = pgTable('contact_unlock_requests', {
  id: text('id').primaryKey(),
  circleId: text('circle_id').references(() => circles.id, { onDelete: 'cascade' }),
  requesterId: text('requester_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  targetId: text('target_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sourceType: text('source_type').notNull().default('circle'),
  fieldKey: text('field_key').notNull().default('contact_primary'),
  cardSnapshot: jsonb('card_snapshot').$type<Record<string, unknown> | Array<Record<string, unknown>>>(),
  message: text('message'),
  status: text('status').notNull().default('pending'), // 'pending' | 'approved' | 'rejected' | 'withdrawn' | 'expired' | 'revoked'
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }).default(sql`NOW() + INTERVAL '7 days'`),
  revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (t) => [
  uniqueIndex('idx_contact_unlock_requests_circle_pending')
    .on(t.requesterId, t.targetId, t.circleId)
    .where(sql`${t.status} = 'pending' AND ${t.sourceType} = 'circle'`),
  uniqueIndex('idx_contact_unlock_requests_address_book_pending')
    .on(t.requesterId, t.targetId)
    .where(sql`${t.status} = 'pending' AND ${t.sourceType} = 'address_book'`),
  index('idx_contact_unlock_requests_target_status_circle').on(t.targetId, t.status, t.circleId),
  index('idx_contact_unlock_requests_rejected_field')
    .on(t.requesterId, t.targetId, t.fieldKey, t.status, t.updatedAt),
]);

export const g2ContactSecrets = pgTable('g2_contact_secrets', {
  id: text('id').primaryKey(),
  ownerUserId: text('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  scopeType: text('scope_type').notNull(),
  scopeId: text('scope_id').notNull(),
  fieldKey: text('field_key').notNull(),
  contactType: text('contact_type').notNull(),
  label: text('label').notNull(),
  ciphertext: text('ciphertext').notNull(),
  nonce: text('nonce').notNull(),
  authTag: text('auth_tag').notNull(),
  keyVersion: text('key_version').notNull(),
  valueHash: text('value_hash').notNull(),
  maskedValue: text('masked_value').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (t) => [
  uniqueIndex('idx_g2_contact_secrets_unique_scope')
    .on(t.ownerUserId, t.scopeType, t.scopeId, t.fieldKey, t.contactType),
  index('idx_g2_contact_secrets_owner_scope').on(t.ownerUserId, t.scopeType, t.scopeId),
  index('idx_g2_contact_secrets_value_hash').on(t.valueHash),
]);

export const userCircleContacts = pgTable('user_circle_contacts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  circleId: text('circle_id').notNull().references(() => circles.id, { onDelete: 'cascade' }),
  fieldKey: text('field_key').notNull(),
  label: text('label').notNull(),
  value: text('value'),
  contactSecretId: text('contact_secret_id').references(() => g2ContactSecrets.id, { onDelete: 'set null' }),
  isEnabled: boolean('is_enabled').notNull().default(true),
  displayOrder: integer('display_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (t) => [
  uniqueIndex('idx_user_circle_contacts_user_circle_field').on(t.userId, t.circleId, t.fieldKey),
  index('idx_user_circle_contacts_user_circle').on(t.userId, t.circleId, t.displayOrder),
  index('idx_user_circle_contacts_secret').on(t.contactSecretId),
]);

export const contactUnlockGrants = pgTable('contact_unlock_grants', {
  id: text('id').primaryKey(),
  requestId: text('request_id').notNull().references(() => contactUnlockRequests.id, { onDelete: 'cascade' }),
  requesterId: text('requester_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  targetId: text('target_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  circleId: text('circle_id').notNull().references(() => circles.id, { onDelete: 'cascade' }),
  contactId: text('contact_id').notNull().references(() => userCircleContacts.id, { onDelete: 'cascade' }),
  fieldKey: text('field_key').notNull(),
  status: text('status').notNull().default('active'), // 'active' | 'revoked'
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'string' }),
}, (t) => [
  uniqueIndex('idx_contact_unlock_grants_unique_contact').on(t.requesterId, t.targetId, t.circleId, t.contactId),
  index('idx_contact_unlock_grants_request').on(t.requestId),
  index('idx_contact_unlock_grants_lookup').on(t.requesterId, t.targetId, t.circleId, t.status),
]);

// ─── Forum (M3) ───────────────────────────────────────────────────

export const forumPosts = pgTable('forum_posts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  circleId: text('circle_id').references(() => circles.id, { onDelete: 'cascade' }), // null = all site
  title: text('title').notNull(),
  content: text('content').notNull(),
  type: text('type').notNull().default('general'), // 'general' | 'squad' | 'help' | 'trade' | 'activity'
  isAnonymous: boolean('is_anonymous').notNull().default(false),
  anonymousCancelledAt: timestamp('anonymous_cancelled_at', { withTimezone: true, mode: 'string' }),
  visibility: text('visibility').notNull().default('public'), // 'public' | 'private'
  isPinned: boolean('is_pinned').default(false),
  isLocked: boolean('is_locked').default(false),
  pinnedCommentId: text('pinned_comment_id').references((): AnyPgColumn => forumComments.id, { onDelete: 'set null' }),
  likeCount: integer('like_count').notNull().default(0),
  favoriteCount: integer('favorite_count').notNull().default(0),
  commentCount: integer('comment_count').notNull().default(0),
  viewCount: integer('view_count').default(0),
  hotScore: doublePrecision('hot_score').notNull().default(0),
  lastInteractionAt: timestamp('last_interaction_at', { withTimezone: true, mode: 'string' }),
  hasImages: boolean('has_images').notNull().default(false),
  summary: text('summary'),
  coverImageUrl: text('cover_image_url'),
  hasPoll: boolean('has_poll').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
});

export const forumComments = pgTable('forum_comments', {
  id: text('id').primaryKey(),
  postId: text('post_id').notNull().references(() => forumPosts.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content'), // nullable for voice-only or mixed media comments
  commentType: text('comment_type').notNull().default('text'), // 'text' | 'voice'
  voiceUrl: text('voice_url'),
  voiceDurationSec: integer('voice_duration_sec'),
  imageUrl: text('image_url'),
  transcript: text('transcript'),
  transcriptStatus: text('transcript_status').notNull().default('none'), // 'none' | 'pending' | 'success' | 'failed'
  parentCommentId: text('parent_comment_id').references((): AnyPgColumn => forumComments.id, { onDelete: 'cascade' }),
  rootCommentId: text('root_comment_id').references((): AnyPgColumn => forumComments.id, { onDelete: 'cascade' }),
  likeCount: integer('like_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
});

// ─── Comment Interactions ──────────────────────────────────────

export const forumCommentLikes = pgTable('forum_comment_likes', {
  id: text('id').primaryKey(),
  commentId: text('comment_id').notNull().references(() => forumComments.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (t) => [
  uniqueIndex('idx_forum_comment_likes_comment_user').on(t.commentId, t.userId),
]);

export const forumCommentHides = pgTable('forum_comment_hides', {
  id: text('id').primaryKey(),
  commentId: text('comment_id').notNull().references(() => forumComments.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (t) => [
  uniqueIndex('idx_forum_comment_hides_comment_user').on(t.commentId, t.userId),
]);

// ─── Forum Media ─────────────────────────────────────────────────

export const forumPostImages = pgTable('forum_post_images', {
  id: text('id').primaryKey(),
  postId: text('post_id').notNull().references(() => forumPosts.id, { onDelete: 'cascade' }),
  imageUrl: text('image_url').notNull(),
  imageWidth: integer('image_width'),
  imageHeight: integer('image_height'),
  displayOrder: integer('display_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (t) => [
  index('idx_forum_post_images_post').on(t.postId, t.displayOrder),
]);

// ─── Forum Polls ────────────────────────────────────────────────

export const forumPollOptions = pgTable('forum_poll_options', {
  id: text('id').primaryKey(),
  postId: text('post_id').notNull().references(() => forumPosts.id, { onDelete: 'cascade' }),
  optionText: text('option_text').notNull(),
  displayOrder: integer('display_order').notNull().default(0),
  voteCount: integer('vote_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (t) => [
  index('idx_forum_poll_options_post_order').on(t.postId, t.displayOrder),
]);

export const forumPollVotes = pgTable('forum_poll_votes', {
  id: text('id').primaryKey(),
  postId: text('post_id').notNull().references(() => forumPosts.id, { onDelete: 'cascade' }),
  optionId: text('option_id').notNull().references(() => forumPollOptions.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (t) => [
  uniqueIndex('idx_forum_poll_votes_post_user').on(t.postId, t.userId),
  index('idx_forum_poll_votes_option').on(t.optionId),
  index('idx_forum_poll_votes_user_created').on(t.userId, t.createdAt),
]);

// ─── Forum Interactions ──────────────────────────────────────────

export const forumPostLikes = pgTable('forum_post_likes', {
  id: text('id').primaryKey(),
  postId: text('post_id').notNull().references(() => forumPosts.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (t) => [
  uniqueIndex('idx_forum_post_likes_post_user').on(t.postId, t.userId),
]);

export const forumPostFavorites = pgTable('forum_post_favorites', {
  id: text('id').primaryKey(),
  postId: text('post_id').notNull().references(() => forumPosts.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (t) => [
  uniqueIndex('idx_forum_post_favorites_post_user').on(t.postId, t.userId),
]);

export const forumPostViews = pgTable('forum_post_views', {
  id: text('id').primaryKey(),
  postId: text('post_id').notNull().references(() => forumPosts.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  viewedAt: timestamp('viewed_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('idx_forum_post_views_post_user').on(t.postId, t.userId),
  index('idx_forum_post_views_viewed_at').on(t.viewedAt),
]);

// ─── Forum Announcements & Guestbook ─────────────────────────────

export const forumAnnouncements = pgTable('forum_announcements', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  createdBy: text('created_by').references(() => users.id),
  isActive: boolean('is_active').notNull().default(true),
  priority: integer('priority').notNull().default(0),
  startsAt: timestamp('starts_at', { withTimezone: true, mode: 'string' }),
  endsAt: timestamp('ends_at', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const forumGuestbookMessages = pgTable('forum_guestbook_messages', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  status: text('status').notNull().default('visible'), // 'visible' | 'hidden'
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
});

// ─── Notifications (Message Center) ──────────────────────────────

export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  // 'match_revealed' | 'match_no_result' | 'match_mutual_success' | 'match_expiring'
  // | 'survey_update_required' | 'survey_incomplete'
  // | 'policy_update' | 'system_announcement' | 'report_result'
  title: text('title').notNull(),
  body: text('body').notNull(),
  level: text('level').notNull().default('info'), // 'info' | 'success' | 'warning' | 'critical'
  actionUrl: text('action_url'),
  meta: jsonb('meta').$type<Record<string, unknown>>().default(sql`'{}'::jsonb`),
  isRead: boolean('is_read').notNull().default(false),
  readAt: timestamp('read_at', { withTimezone: true, mode: 'string' }),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
}, (t) => [
  index('idx_notifications_user_read').on(t.userId, t.isRead, t.createdAt),
  index('idx_notifications_user_type').on(t.userId, t.type, t.createdAt),
  index('idx_notifications_created_at').on(t.createdAt),
]);

export const broadcastTasks = pgTable('broadcast_tasks', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  level: text('level').notNull().default('info'),
  actionUrl: text('action_url'),
  targetUserIds: jsonb('target_user_ids').$type<string[] | null>(),
  idempotencyScope: text('idempotency_scope').notNull().unique(),
  status: text('status').notNull().default('pending'), // 'pending' | 'running' | 'completed' | 'failed'
  createdCount: integer('created_count').default(0),
  skippedCount: integer('skipped_count').default(0),
  totalEstimate: integer('total_estimate').default(0),
  startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' }),
  finishedAt: timestamp('finished_at', { withTimezone: true, mode: 'string' }),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
});

// ─── Notifications (Forum, legacy) ──────────────────────────────

export const userNotifications = pgTable('user_notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // e.g. 'post_liked' | 'friend_request_received' | 'teamup_member_joined'
  title: text('title').notNull(),
  content: text('content').notNull(),
  meta: jsonb('meta'),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
});
export const forumReports = pgTable('forum_reports', {
  id: text('id').primaryKey(),
  reporterId: text('reporter_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  reportedUserId: text('reported_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  targetType: text('target_type').notNull(), // 'post' | 'comment' | 'user'
  postId: text('post_id').references(() => forumPosts.id, { onDelete: 'cascade' }),
  commentId: text('comment_id').references(() => forumComments.id, { onDelete: 'cascade' }),
  reason: text('reason').notNull(),
  detail: text('detail'),
  status: text('status').notNull().default('pending'), // 'pending' | 'approved' | 'rejected'
  adminNote: text('admin_note'),
  reviewedBy: text('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (t) => [
  index('idx_forum_reports_status_created').on(t.status, t.createdAt),
  index('idx_forum_reports_reporter').on(t.reporterId, t.createdAt),
  index('idx_forum_reports_reported').on(t.reportedUserId, t.createdAt),
  index('idx_forum_reports_post').on(t.postId),
  index('idx_forum_reports_comment').on(t.commentId),
]);
// ─── Teamups ─────────────────────────────────────────────────────

export const teamups = pgTable('teamups', {
  id: text('id').primaryKey(),
  circleId: text('circle_id').notNull().references(() => circles.id, { onDelete: 'cascade' }),
  leaderId: text('leader_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').notNull(),
  descriptionPreview: text('description_preview').notNull(),
  maxMembers: integer('max_members').notNull(),
  currentMemberCount: integer('current_member_count').notNull().default(1),
  deadlineAt: timestamp('deadline_at', { withTimezone: true, mode: 'string' }).notNull(),
  endAt: timestamp('end_at', { withTimezone: true, mode: 'string' }).notNull(),
  teamupType: text('teamup_type').notNull().default('short_term'), // 'short_term' | 'long_term'
  joinMode: text('join_mode').notNull(), // 'direct' | 'approval'
  isPublic: boolean('is_public').notNull().default(false),
  status: text('status').notNull().default('recruiting'), // 'recruiting' | 'full' | 'cancelled'
  cancelSource: text('cancel_source'), // 'leader' | 'admin'
  cancelReason: text('cancel_reason'),
  cancelledBy: text('cancelled_by').references(() => users.id, { onDelete: 'set null' }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true, mode: 'string' }),
  forumPostId: text('forum_post_id'),
  forumPostAuthorId: text('forum_post_author_id').references(() => users.id, { onDelete: 'set null' }),
  forumSyncStatus: text('forum_sync_status').notNull().default('none'), // 'none' | 'pending' | 'synced' | 'failed'
  forumSyncError: text('forum_sync_error'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (t) => [
  index('idx_teamups_circle_status_end').on(t.circleId, t.status, t.endAt),
  index('idx_teamups_circle_type').on(t.circleId, t.teamupType),
  index('idx_teamups_circle_public').on(t.circleId, t.isPublic, t.forumSyncStatus),
  index('idx_teamups_leader').on(t.leaderId, t.createdAt),
  index('idx_teamups_forum_post').on(t.forumPostId),
]);

export const teamupMembers = pgTable('teamup_members', {
  id: text('id').primaryKey(),
  teamupId: text('teamup_id').notNull().references(() => teamups.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  memberRole: text('member_role').notNull(), // 'leader' | 'member'
  membershipStatus: text('membership_status').notNull().default('active'), // 'active' | 'left' | 'cancelled'
  joinedAt: timestamp('joined_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  leftAt: timestamp('left_at', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (t) => [
  uniqueIndex('idx_teamup_members_teamup_user').on(t.teamupId, t.userId),
  index('idx_teamup_members_teamup_status').on(t.teamupId, t.membershipStatus),
  index('idx_teamup_members_user_status').on(t.userId, t.membershipStatus),
]);

export const teamupMemberContacts = pgTable('teamup_member_contacts', {
  id: text('id').primaryKey(),
  teamupId: text('teamup_id').notNull().references(() => teamups.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  contacts: jsonb('contacts').$type<Array<{
    contactSecretId?: string;
    type: string;
    value?: string;
    label?: string;
    maskedValue?: string;
  }>>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (t) => [
  uniqueIndex('idx_teamup_member_contacts_teamup_user').on(t.teamupId, t.userId),
]);

export const teamupApplications = pgTable('teamup_applications', {
  id: text('id').primaryKey(),
  teamupId: text('teamup_id').notNull().references(() => teamups.id, { onDelete: 'cascade' }),
  applicantId: text('applicant_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  applicationType: text('application_type').notNull().default('join'), // 'join' | 'waitlist'
  applicationNote: text('application_note').notNull(),
  cardSnapshot: jsonb('card_snapshot').$type<Record<string, unknown>>().notNull(),
  cardSnapshotView: text('card_snapshot_view').notNull(), // 'public' | 'friend'
  cardSnapshotRelationship: text('card_snapshot_relationship').notNull(), // 'not_friend' | 'friend'
  contactPayload: jsonb('contact_payload').$type<Array<{
    contactSecretId?: string;
    type: string;
    value?: string;
    label?: string;
    maskedValue?: string;
  }>>().notNull(),
  status: text('status').notNull().default('pending'), // 'pending' | 'approved' | 'rejected' | 'withdrawn'
  reviewedBy: text('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  reviewNote: text('review_note'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true, mode: 'string' }),
  waitlistJoinedAt: timestamp('waitlist_joined_at', { withTimezone: true, mode: 'string' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (t) => [
  uniqueIndex('idx_teamup_applications_pending').on(t.teamupId, t.applicantId).where(sql`${t.status} = 'pending'`),
  uniqueIndex('idx_teamup_applications_active_waitlist').on(t.teamupId, t.applicantId)
    .where(sql`${t.applicationType} = 'waitlist' AND ${t.status} IN ('pending', 'approved') AND ${t.waitlistJoinedAt} IS NULL`),
  index('idx_teamup_applications_teamup_status').on(t.teamupId, t.status),
  index('idx_teamup_applications_applicant_status').on(t.applicantId, t.status),
  index('idx_teamup_applications_waitlist_queue').on(t.teamupId, t.applicationType, t.status, t.createdAt),
]);

export const teamupForumSyncJobs = pgTable('teamup_forum_sync_jobs', {
  id: text('id').primaryKey(),
  teamupId: text('teamup_id').notNull().references(() => teamups.id, { onDelete: 'cascade' }),
  action: text('action').notNull(), // 'create' | 'update' | 'archive'
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  status: text('status').notNull().default('pending'), // 'pending' | 'processing' | 'succeeded' | 'failed'
  attemptCount: integer('attempt_count').notNull().default(0),
  nextRetryAt: timestamp('next_retry_at', { withTimezone: true, mode: 'string' }),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
}, (t) => [
  index('idx_teamup_forum_sync_jobs_status_retry').on(t.status, t.nextRetryAt),
  index('idx_teamup_forum_sync_jobs_teamup').on(t.teamupId, t.createdAt),
]);
