import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { sql, eq, desc, asc, like, or, and, isNull, lt, gt, inArray, ne, count } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';
import { ForbiddenError, ValidationError } from '../utils/errors.js';
import { validate } from '../middleware/validate.js';
import { runMatchingPipeline, unlockCurrentWeekMatches, sendPendingSurveyReminderBatch, sendMatchRevealedNotificationsForWeek, getCurrentWeekOf, getUpcomingWeekOf, resendPromoToMatchedBatch, listSurveyUpdateCandidates, sendOutdatedSurveyReminderBatch } from '../services/matchService.js';
import { generateCuratorNote } from '../services/aiService.js';
import { submitAnswers } from '../services/surveyService.js';
import { createNotification, buildIdempotencyKey } from '../services/notificationService.js';
import { renderCardMail, sendSurveyReminderEmail, sendMatchRevealedEmail, sendMutualMatchEmail, sendPromoEmail, sendSurveyUpdateNotification, sendOutdatedSurveyReminderEmail, sendMatchExpirationWarning, sendAutoPauseNotification, sendPermanentSleepNotification, isDeletedAccountEmail, sendReportResultEmail, sendReportWarningEmail, sendReportWarnUpdateEmail, sendReportEvidenceRequestEmail } from '../utils/email.js';
import {
  createCircle,
  createCircleCardComponent,
  deleteCircleCardComponent,
  updateCircle,
  updateCircleCardComponent,
  setCircleActive,
  getCircleCardComponents,
  replaceCircleCardComponents,
  replaceCircleQuestions,
  runCircleMatchingPipeline,
  unlockCircleMatches,
} from '../modules/circles/index.js';
import {
  createBaseCardComponent,
  deleteBaseCardComponent,
  getBaseCardComponents,
  listCircleCustomCardsForReview,
  approveCircleCustomCard,
  promoteCircleCustomCardToCircleComponent,
  rejectCircleCustomCard,
  replaceBaseCardComponents,
  updateBaseCardComponent,
} from '../modules/cards/index.js';
import { adminLimiter } from '../middleware/rateLimit.js';
import { db, queryClient } from '../db/connection.js';
import { users, surveyAnswers, matches, mailLogs, circleMembers, circleMatches, userReports, circles, forumPosts, forumAnnouncements, forumGuestbookMessages, auditLogs, teamups, teamupMembers, teamupApplications, heartSignals, heartMatches, creditScoreLogs } from '../db/schema.js';
import { isMatchingLocked } from '../utils/lockdown.js';
import { logAudit, getRequestIp } from '../utils/audit.js';
import {
  listForumReports,
  reviewForumReport,
  listForumCreditUsers,
  listForumReportsByReportedUser,
} from '../services/forumGovernanceService.js';

const router = Router();
const LATEST_SURVEY_VERSION = '4.0';
const INTEREST_CATEGORY_KEYS = new Set([
  'gym_fitness', 'running_outdoor', 'ball_sports', 'swimming_dance',
  'movies_series', 'gaming', 'anime_acg', 'boardgame_larp',
  'photo_exhibitions', 'reading_writing', 'fiction_fanfic', 'food_exploring',
  'travel_citywalk', 'music_listening', 'live_show', 'pets',
  'programming_geek', 'finance_business', 'other_interest',
]);
const LEGACY_SHARED_INTEREST_ALIASES: Record<string, string> = {
  esports_games: 'gaming',
  running_hiking: 'running_outdoor',
  cycling_fitness: 'running_outdoor',
  pets_cooking: 'pets',
  novel_fanfiction: 'fiction_fanfic',
  literature_fiction: 'lit_fiction',
  history_biography: 'history_bio',
  comics_graphic: 'comics_picture_book',
  danmei_bl: 'bl_danmei',
  baihe_gl: 'gl_baihe',
  fanfiction: 'fanfic_novel',
};
const INTEREST_DETAIL_TO_CATEGORY: Record<string, string> = {
  comedy: 'movies_series', romance: 'movies_series', suspense_crime: 'movies_series', sci_fi: 'movies_series',
  action: 'movies_series', horror: 'movies_series', arthouse: 'movies_series', animation: 'movies_series',
  documentary: 'movies_series', cn_drama: 'movies_series', us_drama: 'movies_series', uk_drama: 'movies_series',
  kr_drama: 'movies_series', jp_drama: 'movies_series', movie: 'movies_series',
  werewolf_avalon: 'boardgame_larp', party_boardgame: 'boardgame_larp', german_strategy: 'boardgame_larp',
  murder_mystery: 'boardgame_larp', escape_room: 'boardgame_larp',
  anime: 'anime_acg', manga: 'anime_acg', light_novel: 'anime_acg', fanfic: 'anime_acg',
  cosplay: 'anime_acg', convention: 'anime_acg', vtuber: 'anime_acg', goods: 'anime_acg',
  portrait: 'photo_exhibitions', street: 'photo_exhibitions', film: 'photo_exhibitions', digital: 'photo_exhibitions',
  art_museum: 'photo_exhibitions', museum: 'photo_exhibitions', photo_exhibition: 'photo_exhibitions', installation: 'photo_exhibitions',
  cheap_eats: 'food_exploring', cafe_dessert: 'food_exploring', hotpot_bbq: 'food_exploring',
  jp_kr_food: 'food_exploring', western_brunch: 'food_exploring', milk_tea: 'food_exploring',
  late_night: 'food_exploring', hidden_gem: 'food_exploring', home_cook: 'food_exploring',
  campus_walk: 'travel_citywalk', city_walk: 'travel_citywalk', cafe_hop: 'travel_citywalk',
  short_trip: 'travel_citywalk', speed_trip: 'travel_citywalk', slow_stroll: 'travel_citywalk',
  photo_spot: 'travel_citywalk', random_explore: 'travel_citywalk',
  weight_training: 'gym_fitness', yoga_pilates: 'gym_fitness',
  running: 'running_outdoor', cycling: 'running_outdoor', hiking_climbing: 'running_outdoor',
  swimming: 'swimming_dance', dancing: 'swimming_dance',
  badminton: 'ball_sports', basketball: 'ball_sports', table_tennis: 'ball_sports', tennis: 'ball_sports',
  football: 'ball_sports', volleyball: 'ball_sports', billiards: 'ball_sports',
  c_pop: 'music_listening', k_pop: 'music_listening', j_pop: 'music_listening', western_pop: 'music_listening', rock: 'music_listening',
  hip_hop_rap: 'music_listening', r_and_b: 'music_listening', electronic_dance: 'music_listening',
  classical: 'music_listening', jazz_blues: 'music_listening', folk_country: 'music_listening',
  indie: 'music_listening', acg_vocaloid: 'music_listening',
  lit_fiction: 'reading_writing', sci_fi_fantasy: 'reading_writing', history_bio: 'reading_writing',
  philosophy_social: 'reading_writing', science_tech: 'reading_writing', business_econ: 'reading_writing',
  poetry_essay: 'reading_writing', comics_picture_book: 'reading_writing',
  romance_novel: 'fiction_fanfic', suspense_thriller: 'fiction_fanfic', wuxia_xianxia: 'fiction_fanfic',
  sci_fi_novel: 'fiction_fanfic', fantasy_magic: 'fiction_fanfic', bl_danmei: 'fiction_fanfic',
  gl_baihe: 'fiction_fanfic', fanfic_novel: 'fiction_fanfic',
  moba: 'gaming', fps: 'gaming', open_world_rpg: 'gaming', gacha: 'gaming', party_casual: 'gaming',
  rhythm: 'gaming', card_strategy: 'gaming', simulation: 'gaming', story_puzzle: 'gaming', survival_build: 'gaming',
  honor_of_kings: 'gaming', tft: 'gaming', pubg_mobile: 'gaming', eggy_party: 'gaming', genshin: 'gaming',
  star_rail: 'gaming', wuthering: 'gaming', arknights: 'gaming', love_nikki: 'gaming', identity_v: 'gaming',
  lol: 'gaming', valorant: 'gaming', cs2: 'gaming', apex: 'gaming', ow2: 'gaming', dbd: 'gaming',
  minecraft: 'gaming', gta5: 'gaming', stardew: 'gaming', r6: 'gaming', warframe: 'gaming',
  it_takes_two: 'gaming', delta_force: 'gaming', marvel_rivals: 'gaming', dota2: 'gaming',
  rock_kingdom_world: 'gaming',
  zelda: 'gaming', mario_kart: 'gaming', animal_crossing: 'gaming', pokemon: 'gaming',
  smash_bros: 'gaming', splatoon: 'gaming', overcooked: 'gaming', minecraft_sw: 'gaming',
  xenoblade: 'gaming', stardew_sw: 'gaming',
};

type SharedInterestCount = { key: string; count: number };

function sortSharedInterestCounts(counts: Map<string, number>): SharedInterestCount[] {
  return Array.from(counts.entries())
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([key, count]) => ({ key, count }));
}

function buildSharedInterestAnalytics(rows: Array<{ dimensions: string | null }>): {
  categoryTop: SharedInterestCount[];
  detailTop: SharedInterestCount[];
} {
  const categoryCounts = new Map<string, number>();
  const detailCounts = new Map<string, number>();

  for (const row of rows) {
    if (!row.dimensions) continue;

    const categoriesForMatch = new Set<string>();
    const detailsForMatch = new Set<string>();

    try {
      const parsed = JSON.parse(row.dimensions);
      const sharedInterests = Array.isArray(parsed?._sharedInterests) ? parsed._sharedInterests : [];

      for (const item of sharedInterests) {
        if (typeof item !== 'string' || !item) continue;
        const normalizedItem = LEGACY_SHARED_INTEREST_ALIASES[item] ?? item;
        if (!normalizedItem || normalizedItem === 'other_specify') continue;

        if (INTEREST_CATEGORY_KEYS.has(normalizedItem)) {
          categoriesForMatch.add(normalizedItem);
          continue;
        }

        detailsForMatch.add(normalizedItem);

        const category = INTEREST_DETAIL_TO_CATEGORY[normalizedItem];
        if (category) {
          categoriesForMatch.add(category);
        }
      }
    } catch {
      continue;
    }

    for (const category of categoriesForMatch) {
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    }
    for (const detail of detailsForMatch) {
      detailCounts.set(detail, (detailCounts.get(detail) ?? 0) + 1);
    }
  }

  return {
    categoryTop: sortSharedInterestCounts(categoryCounts),
    detailTop: sortSharedInterestCounts(detailCounts),
  };
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  const adminKeyRaw = req.headers['x-admin-key'];
  const adminKey = typeof adminKeyRaw === 'string' ? adminKeyRaw : '';
  const expected = config.admin.key;

  const sameLength = Buffer.byteLength(adminKey) === Buffer.byteLength(expected);
  const isValid = sameLength
    ? crypto.timingSafeEqual(Buffer.from(adminKey), Buffer.from(expected))
    : false;

  if (!isValid) {
    throw new ForbiddenError('无效的管理员密钥');
  }
  next();
}

function parseComponentKeyParam(value: string, field = 'key') {
  const result = z.string().trim().min(1).max(50).safeParse(value);
  if (!result.success) {
    throw new ValidationError(`${field} 必须是 1-50 个字符`);
  }
  return result.data;
}

function parseUuidParam(value: string, field: string) {
  const result = z.string().uuid().safeParse(value);
  if (!result.success) {
    throw new ValidationError(`${field} 必须是合法的 UUID`);
  }
  return result.data;
}

// ─── Dashboard & Data ──────────────────────────────────────────

// GET /admin/ping — check network access
router.get('/ping', requireAdmin, (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// GET /admin/mail-logs-stats
router.get('/mail-logs-stats', requireAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await db.select({
      weekOf: mailLogs.weekOf,
      mailType: mailLogs.mailType,
      count: sql<number>`count(*)::int`,
    }).from(mailLogs).groupBy(mailLogs.weekOf, mailLogs.mailType).orderBy(desc(mailLogs.weekOf), mailLogs.mailType);
    res.json({ stats });
  } catch (err) {
    next(err);
  }
});

// GET /admin/stats
router.get('/stats', requireAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const DELETED_EMAIL_PATTERN = 'deleted_%@njumatch.invalid';
    const notDeletedCondition = sql`${users.email} NOT LIKE ${DELETED_EMAIL_PATTERN}`;
    const deletedCondition = sql`${users.email} LIKE ${DELETED_EMAIL_PATTERN}`;

    const [[totalUsers], [deletedUsers], [activeUsers], [profileDone], [surveyDone], [surveyUpToDate]] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(users).where(notDeletedCondition),
      db.select({ count: sql<number>`count(*)::int` }).from(users).where(deletedCondition),
      db.select({ count: sql<number>`count(*)::int` }).from(users).where(and(notDeletedCondition, eq(users.isParticipating, true))),
      db.select({ count: sql<number>`count(*)::int` }).from(users).where(and(notDeletedCondition, eq(users.profileComplete, true))),
      db.select({ count: sql<number>`count(*)::int` }).from(users).where(and(notDeletedCondition, eq(users.surveyComplete, true))),
      db.select({ count: sql<number>`count(*)::int` })
        .from(users)
        .innerJoin(surveyAnswers, eq(users.id, surveyAnswers.userId))
        .where(and(notDeletedCondition, eq(users.surveyComplete, true), eq(surveyAnswers.version, LATEST_SURVEY_VERSION))),
    ]);
    const surveyOutdated = surveyDone.count - surveyUpToDate.count;

    const now = new Date();
    const day = now.getDay();
    const diff = (day + 4) % 7;
    const wed = new Date(now);
    wed.setDate(now.getDate() - diff);
    const weekOf = wed.toISOString().slice(0, 10);

    const participantUserCondition = and(
      notDeletedCondition,
      eq(users.isParticipating, true),
      eq(users.profileComplete, true),
      eq(users.surveyComplete, true),
      gt(users.creditScore, 90),
      or(isNull(users.pauseUntilWeek), lt(users.pauseUntilWeek, weekOf))
    );

    const matchingParticipantCondition = and(
      participantUserCondition,
      eq(surveyAnswers.version, LATEST_SURVEY_VERSION),
    );

    const [matchingUsers] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .innerJoin(surveyAnswers, eq(users.id, surveyAnswers.userId))
      .where(matchingParticipantCondition);

    const weeklyMatchCondition = and(
      eq(matches.weekOf, weekOf),
      eq(matches.source, 'weekly'),
    );
    const weeklySourceCondition = eq(matches.source, 'weekly');

    const [weekMatches] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(matches)
      .where(weeklyMatchCondition);
    const [mutualMatches] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(matches)
      .where(and(weeklyMatchCondition, eq(matches.status, 'MUTUAL')));
    const [totalMutual] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(matches)
      .where(and(weeklySourceCondition, eq(matches.status, 'MUTUAL')));
    const [curatorNotesDone] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(matches)
      .where(and(weeklyMatchCondition, sql`${matches.curatorNote} IS NOT NULL`, sql`${matches.curatorNote} != ''`));
    const [scoreStats] = await db
      .select({ maxScore: sql<number>`max(score)::float`, minScore: sql<number>`min(score)::float` })
      .from(matches)
      .where(weeklyMatchCondition);
    const weekMatchRows = await db
      .select({ dimensions: matches.dimensions })
      .from(matches)
      .where(weeklyMatchCondition);
    const totalMatchRows = await db
      .select({ dimensions: matches.dimensions })
      .from(matches)
      .where(weeklySourceCondition);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [newUsers] = await db.select({ count: sql<number>`count(*)::int` }).from(users).where(and(notDeletedCondition, sql`created_at >= ${weekAgo}`));

    const weekSharedInterestAnalytics = buildSharedInterestAnalytics(weekMatchRows);
    const totalSharedInterestAnalytics = buildSharedInterestAnalytics(totalMatchRows);
    const weekStart = `${weekOf}T00:00:00+08:00`;

    const [
      [heartboxBoundUsers],
      [heartboxCooldownUsers],
      heartboxSignalStatusRows,
      [heartboxSignalsTotal],
      [heartboxSignalsThisWeek],
      [heartboxUniqueSenders],
      [heartboxUniqueSendersThisWeek],
      [heartboxActiveSignals],
      [heartboxResolvedActiveSignals],
      [heartboxUnresolvedActiveSignals],
      heartboxMatchStatusRows,
      [heartboxMatchesTotal],
      [heartboxMatchesThisWeek],
      [heartboxMainMatchesTotal],
      [heartboxMainMatchesThisWeek],
      [heartboxMainMutualTotal],
      [heartboxMutualEmailsSent],
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(users).where(and(notDeletedCondition, sql`${users.studentIdHash} IS NOT NULL`, sql`${users.studentIdVerifiedAt} IS NOT NULL`)),
      db.select({ count: sql<number>`count(*)::int` }).from(users).where(and(notDeletedCondition, sql`${users.heartboxCooldownUntil} > NOW()`)),
      db.select({ status: heartSignals.status, count: sql<number>`count(*)::int` }).from(heartSignals).groupBy(heartSignals.status),
      db.select({ count: sql<number>`count(*)::int` }).from(heartSignals),
      db.select({ count: sql<number>`count(*)::int` }).from(heartSignals).where(sql`${heartSignals.createdAt} >= ${weekStart}`),
      db.select({ count: sql<number>`count(DISTINCT ${heartSignals.senderId})::int` }).from(heartSignals),
      db.select({ count: sql<number>`count(DISTINCT ${heartSignals.senderId})::int` }).from(heartSignals).where(sql`${heartSignals.createdAt} >= ${weekStart}`),
      db.select({ count: sql<number>`count(*)::int` }).from(heartSignals).where(eq(heartSignals.status, 'active')),
      db.select({ count: sql<number>`count(*)::int` }).from(heartSignals).where(and(eq(heartSignals.status, 'active'), sql`${heartSignals.resolvedTargetUserId} IS NOT NULL`)),
      db.select({ count: sql<number>`count(*)::int` }).from(heartSignals).where(and(eq(heartSignals.status, 'active'), sql`${heartSignals.resolvedTargetUserId} IS NULL`)),
      db.select({ status: heartMatches.status, count: sql<number>`count(*)::int` }).from(heartMatches).groupBy(heartMatches.status),
      db.select({ count: sql<number>`count(*)::int` }).from(heartMatches),
      db.select({ count: sql<number>`count(*)::int` }).from(heartMatches).where(sql`${heartMatches.createdAt} >= ${weekStart}`),
      db.select({ count: sql<number>`count(*)::int` }).from(matches).where(eq(matches.source, 'heartbox')),
      db.select({ count: sql<number>`count(*)::int` }).from(matches).where(and(eq(matches.source, 'heartbox'), sql`${matches.createdAt} >= ${weekStart}`)),
      db.select({ count: sql<number>`count(*)::int` }).from(matches).where(and(eq(matches.source, 'heartbox'), eq(matches.status, 'MUTUAL'))),
      db.select({ count: sql<number>`count(*)::int` }).from(mailLogs).where(eq(mailLogs.mailType, 'HEARTBOX_MUTUAL')),
    ]);

    const heartboxSignalsByStatus = Object.fromEntries(heartboxSignalStatusRows.map(row => [row.status || 'unknown', row.count]));
    const heartboxMatchesByStatus = Object.fromEntries(heartboxMatchStatusRows.map(row => [row.status || 'unknown', row.count]));

    const [
      genderStats, campusStats, gradeStats, departmentStats,
      activeGenderStats, activeCampusStats, activeGradeStats, activeDepartmentStats,
      intentionStats,
    ] = await Promise.all([
      db.select({
        gender: users.gender,
        count: sql<number>`count(*)::int`,
      }).from(users).where(notDeletedCondition).groupBy(users.gender),
      
      db.select({
        campus: users.campus,
        count: sql<number>`count(*)::int`,
      }).from(users).where(notDeletedCondition).groupBy(users.campus),

      db.select({
        grade: users.grade,
        count: sql<number>`count(*)::int`,
      }).from(users).where(notDeletedCondition).groupBy(users.grade),

      db.select({
        department: users.department,
        count: sql<number>`count(*)::int`,
      }).from(users).where(notDeletedCondition).groupBy(users.department),

      db.select({
        gender: users.gender,
        count: sql<number>`count(*)::int`,
      }).from(users).innerJoin(surveyAnswers, eq(users.id, surveyAnswers.userId)).where(matchingParticipantCondition).groupBy(users.gender),
      
      db.select({
        campus: users.campus,
        count: sql<number>`count(*)::int`,
      }).from(users).innerJoin(surveyAnswers, eq(users.id, surveyAnswers.userId)).where(matchingParticipantCondition).groupBy(users.campus),

      db.select({
        grade: users.grade,
        count: sql<number>`count(*)::int`,
      }).from(users).innerJoin(surveyAnswers, eq(users.id, surveyAnswers.userId)).where(matchingParticipantCondition).groupBy(users.grade),

      db.select({
        department: users.department,
        count: sql<number>`count(*)::int`,
      }).from(users).innerJoin(surveyAnswers, eq(users.id, surveyAnswers.userId)).where(matchingParticipantCondition).groupBy(users.department),

      db.select({
        intention: users.intention,
        count: sql<number>`count(*)::int`,
      }).from(users).innerJoin(surveyAnswers, eq(users.id, surveyAnswers.userId)).where(matchingParticipantCondition).groupBy(users.intention),
    ]);

    res.json({
      totalUsers: totalUsers.count,
      deletedUsers: deletedUsers.count,
      activeUsers: activeUsers.count,
      profileComplete: profileDone.count,
      surveyComplete: surveyUpToDate.count,
      surveyOutdated,
      matchingUsers: matchingUsers.count,
      newUsersThisWeek: newUsers.count,
      weekOf,
      weekMatches: weekMatches.count,
      weekCuratorNotesDone: curatorNotesDone.count,
      weekMutual: mutualMatches.count,
      totalMutual: totalMutual.count,
      weekMaxScore: scoreStats?.maxScore ?? null,
      weekMinScore: scoreStats?.minScore ?? null,
      weekTopSharedInterests: weekSharedInterestAnalytics.detailTop,
      totalTopSharedInterests: totalSharedInterestAnalytics.detailTop,
      weekTopSharedInterestCategories: weekSharedInterestAnalytics.categoryTop,
      weekTopSharedInterestDetails: weekSharedInterestAnalytics.detailTop,
      totalTopSharedInterestCategories: totalSharedInterestAnalytics.categoryTop,
      totalTopSharedInterestDetails: totalSharedInterestAnalytics.detailTop,
      heartbox: {
        boundUsers: heartboxBoundUsers.count,
        cooldownUsers: heartboxCooldownUsers.count,
        signalsTotal: heartboxSignalsTotal.count,
        signalsThisWeek: heartboxSignalsThisWeek.count,
        uniqueSenders: heartboxUniqueSenders.count,
        uniqueSendersThisWeek: heartboxUniqueSendersThisWeek.count,
        activeSignals: heartboxActiveSignals.count,
        resolvedActiveSignals: heartboxResolvedActiveSignals.count,
        unresolvedActiveSignals: heartboxUnresolvedActiveSignals.count,
        signalStatusBreakdown: heartboxSignalsByStatus,
        matchesTotal: heartboxMatchesTotal.count,
        matchesThisWeek: heartboxMatchesThisWeek.count,
        matchesActive: heartboxMatchesByStatus.active ?? 0,
        matchesQueued: heartboxMatchesByStatus.queued ?? 0,
        matchesDismissed: heartboxMatchesByStatus.dismissed ?? 0,
        matchesBlocked: heartboxMatchesByStatus.blocked ?? 0,
        matchStatusBreakdown: heartboxMatchesByStatus,
        mainMatchesTotal: heartboxMainMatchesTotal.count,
        mainMatchesThisWeek: heartboxMainMatchesThisWeek.count,
        mainMutualTotal: heartboxMainMutualTotal.count,
        mutualEmailsSent: heartboxMutualEmailsSent.count,
      },
      genderBreakdown: Object.fromEntries(genderStats.map(g => [g.gender || 'unknown', g.count])),
      campusBreakdown: Object.fromEntries(campusStats.map(c => [c.campus || 'unknown', c.count])),
      gradeBreakdown: Object.fromEntries(gradeStats.map(g => [g.grade || 'unknown', g.count])),
      departmentBreakdown: Object.fromEntries(departmentStats.map(d => [d.department || 'unknown', d.count])),
      activeGenderBreakdown: Object.fromEntries(activeGenderStats.map(g => [g.gender || 'unknown', g.count])),
      activeCampusBreakdown: Object.fromEntries(activeCampusStats.map(c => [c.campus || 'unknown', c.count])),
      activeGradeBreakdown: Object.fromEntries(activeGradeStats.map(g => [g.grade || 'unknown', g.count])),
      activeDepartmentBreakdown: Object.fromEntries(activeDepartmentStats.map(d => [d.department || 'unknown', d.count])),
      intentionBreakdown: Object.fromEntries(intentionStats.map(i => [i.intention || 'unknown', i.count])),
      isLocked: isMatchingLocked(),
    });
  } catch (err) {
    next(err);
  }
});

// GET /admin/users
router.get('/users', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const search = (req.query.search as string || '').trim();
    const offset = (page - 1) * limit;

    const where = search
      ? or(
          like(users.email, `%${search}%`),
          like(users.nickname, `%${search}%`),
          like(users.id, `%${search}%`)
        )
      : undefined;

    const [totalRow] = await db.select({ count: sql<number>`count(*)::int` }).from(users).where(where);

    const rows = await db.select({
      id: users.id,
      email: users.email,
      nickname: users.nickname,
      gender: users.gender,
      genderPref: users.genderPref,
      intention: users.intention,
      grade: users.grade,
      campus: users.campus,
      department: users.department,
      mbti: users.mbti,
      wechatId: users.wechatId,
      isParticipating: users.isParticipating,
      pauseUntilWeek: users.pauseUntilWeek,
      profileComplete: users.profileComplete,
      surveyComplete: users.surveyComplete,
      createdAt: users.createdAt,
    }).from(users).where(where).orderBy(desc(users.createdAt)).limit(limit).offset(offset);

    res.json({ total: totalRow.count, page, limit, users: rows });
  } catch (err) {
    next(err);
  }
});

function toAdminUserDetail(user: typeof users.$inferSelect) {
  const {
    passwordHash: _passwordHash,
    studentIdHash: _studentIdHash,
    ...safeUser
  } = user as any;
  return safeUser;
}

// GET /admin/users/:id
router.get('/users/:id', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.id as string;
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const [survey] = await db.select().from(surveyAnswers).where(eq(surveyAnswers.userId, userId));

    const userMatches = await db.select().from(matches)
      .where(or(eq(matches.userAId, userId), eq(matches.userBId, userId)))
      .orderBy(desc(matches.createdAt))
      .limit(20);

    res.json({ user: toAdminUserDetail(user), survey: survey || null, matches: userMatches });
  } catch (err) {
    next(err);
  }
});

// GET /admin/survey-update/preview — 预览未更新到最新版本问卷的用户数
router.get('/survey-update/preview', requireAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const affected = await listSurveyUpdateCandidates();

    const total = affected.length;
    const withEmailEnabled = affected.filter(u => u.emailNotifications).length;

    res.json({
      total,
      withEmailEnabled,
      users: affected.slice(0, 50).map(u => ({ id: u.id, email: u.email })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /admin/survey-update/send — 给未更新到最新版本问卷的用户发送邮件 + 站内通知
router.post('/survey-update/send', requireAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await sendOutdatedSurveyReminderBatch();

    // ── 站内通知：survey_update_required ──
    try {
      const candidates = await listSurveyUpdateCandidates();
      const LATEST_SURVEY_VERSION = '4.0';
      for (const u of candidates) {
        await createNotification({
          userId: u.id,
          type: 'survey_update_required',
          title: '问卷版本已更新',
          body: '问卷进行了升级，请重新填写以参与匹配。',
          level: 'info',
          actionUrl: '/survey',
          meta: { surveyVersion: LATEST_SURVEY_VERSION },
          idempotencyKey: buildIdempotencyKey(u.id, 'survey_update_required', `v${LATEST_SURVEY_VERSION}`),
        });
      }
    } catch (notifErr) {
      console.error('[NOTIFICATION] survey_update_required write failed:', notifErr);
    }

    await logAudit({ action: 'bulk_survey_update_notice', detail: { stats }, ip: getRequestIp(_req), result: 'success' });
    res.json({ message: '旧版问卷提醒邮件分发结束', stats });
  } catch (err) {
    await logAudit({ action: 'bulk_survey_update_notice', detail: { error: String(err) }, ip: getRequestIp(_req), result: 'failure' });
    next(err);
  }
});

// GET /admin/matches
router.get('/matches', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const weekOf = (req.query.weekOf as string || '').trim();
    const status = (req.query.status as string || '').trim();
    const sortBy = (req.query.sortBy as string || 'createdAt').trim();
    const sortOrder = (req.query.sortOrder as string || 'desc').trim() === 'asc' ? 'asc' : 'desc';
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [eq(matches.source, 'weekly')];
    if (weekOf) conditions.push(eq(matches.weekOf, weekOf));
    if (status && status !== 'all') conditions.push(eq(matches.status, status));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const orderBy = (() => {
      if (sortBy === 'score') return sortOrder === 'asc' ? asc(matches.score) : desc(matches.score);
      if (sortBy === 'weekOf') return sortOrder === 'asc' ? asc(matches.weekOf) : desc(matches.weekOf);
      if (sortBy === 'status') return sortOrder === 'asc' ? asc(matches.status) : desc(matches.status);
      return sortOrder === 'asc' ? asc(matches.createdAt) : desc(matches.createdAt);
    })();

    const [totalRow] = await db.select({ count: sql<number>`count(*)::int` }).from(matches).where(where);
    const rows = await db.select().from(matches).where(where).orderBy(orderBy, desc(matches.createdAt)).limit(limit).offset(offset);

    res.json({ total: totalRow.count, page, limit, sortBy, sortOrder, matches: rows });
  } catch (err) {
    next(err);
  }
});

// GET /admin/matches/weekly-stats
router.get('/matches/weekly-stats', requireAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await db.select({
      weekOf: matches.weekOf,
      total: sql<number>`count(*)::int`,
      mutual: sql<number>`count(*) filter (where status = 'MUTUAL')::int`,
      missed: sql<number>`count(*) filter (where status = 'MISSED')::int`,
      revealed: sql<number>`count(*) filter (where status = 'REVEALED')::int`,
      locked: sql<number>`count(*) filter (where status = 'LOCKED')::int`,
      avgScore: sql<number>`round(avg(score)::numeric, 3)`,
    }).from(matches)
      .where(eq(matches.source, 'weekly'))
      .groupBy(matches.weekOf)
      .orderBy(desc(matches.weekOf))
      .limit(20);

    res.json({ weeks: stats });
  } catch (err) {
    next(err);
  }
});

// GET /admin/heartbox/signals — inspect Heartbox usage without exposing raw student ids or hashes
router.get('/heartbox/signals', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const status = (req.query.status as string || '').trim();
    const resolved = (req.query.resolved as string || '').trim();
    const sortBy = (req.query.sortBy as string || 'createdAt').trim();
    const sortOrder = (req.query.sortOrder as string || 'desc').trim() === 'asc' ? 'asc' : 'desc';
    const offset = (page - 1) * limit;

    const conditions = [];
    if (status && status !== 'all') conditions.push(eq(heartSignals.status, status));
    if (resolved === 'resolved') conditions.push(sql`${heartSignals.resolvedTargetUserId} IS NOT NULL`);
    if (resolved === 'unresolved') conditions.push(sql`${heartSignals.resolvedTargetUserId} IS NULL`);
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const orderBy = (() => {
      if (sortBy === 'status') return sortOrder === 'asc' ? asc(heartSignals.status) : desc(heartSignals.status);
      if (sortBy === 'updatedAt') return sortOrder === 'asc' ? asc(heartSignals.updatedAt) : desc(heartSignals.updatedAt);
      return sortOrder === 'asc' ? asc(heartSignals.createdAt) : desc(heartSignals.createdAt);
    })();

    const [totalRow] = await db.select({ count: sql<number>`count(*)::int` }).from(heartSignals).where(where);
    const rows = await db
      .select()
      .from(heartSignals)
      .where(where)
      .orderBy(orderBy, desc(heartSignals.createdAt))
      .limit(limit)
      .offset(offset);

    const signalIds = rows.map((row) => row.id);
    const userIds = Array.from(new Set(rows.flatMap((row) => [
      row.senderId,
      row.resolvedTargetUserId,
    ]).filter(Boolean) as string[]));

    const [relatedUsers, relatedHeartMatches] = await Promise.all([
      userIds.length > 0
        ? db.select({
            id: users.id,
            email: users.email,
            nickname: users.nickname,
            studentIdLast4: users.studentIdLast4,
          }).from(users).where(inArray(users.id, userIds))
        : [],
      signalIds.length > 0
        ? db.select({
            id: heartMatches.id,
            status: heartMatches.status,
            signalAId: heartMatches.signalAId,
            signalBId: heartMatches.signalBId,
            mainMatchId: heartMatches.mainMatchId,
            updatedAt: heartMatches.updatedAt,
          }).from(heartMatches).where(or(
            inArray(heartMatches.signalAId, signalIds),
            inArray(heartMatches.signalBId, signalIds),
          ))
        : [],
    ]);

    const userById = new Map(relatedUsers.map((user) => [user.id, user]));
    const heartMatchBySignalId = new Map<string, typeof relatedHeartMatches[number]>();
    relatedHeartMatches.forEach((match) => {
      if (match.signalAId) heartMatchBySignalId.set(match.signalAId, match);
      if (match.signalBId) heartMatchBySignalId.set(match.signalBId, match);
    });

    res.json({
      total: totalRow?.count ?? 0,
      page,
      limit,
      sortBy,
      sortOrder,
      signals: rows.map((row) => {
        const sender = userById.get(row.senderId);
        const resolvedTarget = row.resolvedTargetUserId ? userById.get(row.resolvedTargetUserId) : undefined;
        const heartMatch = heartMatchBySignalId.get(row.id);

        return {
          id: row.id,
          sender: sender ? {
            id: sender.id,
            email: sender.email,
            nickname: sender.nickname,
            studentIdLast4: sender.studentIdLast4,
          } : { id: row.senderId, email: null, nickname: null, studentIdLast4: null },
          targetStudentIdMasked: row.targetStudentIdMasked,
          resolvedTarget: resolvedTarget ? {
            id: resolvedTarget.id,
            email: resolvedTarget.email,
            nickname: resolvedTarget.nickname,
            studentIdLast4: resolvedTarget.studentIdLast4,
          } : null,
          status: row.status,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          cancelledAt: row.cancelledAt,
          matchedAt: row.matchedAt,
          heartMatch: heartMatch ? {
            id: heartMatch.id,
            status: heartMatch.status,
            mainMatchId: heartMatch.mainMatchId,
            updatedAt: heartMatch.updatedAt,
          } : null,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
});

// GET /admin/matches/score-distribution — 本周匹配分数分布（按 5% 分桶）
router.get('/matches/score-distribution', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const day = now.getUTCDay();
    const wed = new Date(now);
    wed.setUTCDate(now.getUTCDate() - ((day + 4) % 7));
    const weekOf = (req.query.weekOf as string || '').trim() || wed.toISOString().slice(0, 10);

    const rows = await db
      .select({ score: matches.score })
      .from(matches)
      .where(and(
        eq(matches.weekOf, weekOf),
        eq(matches.source, 'weekly'),
      ));

    // 按 5% 分桶: 55-60, 60-65, ..., 95-100
    const buckets: { range: string; count: number }[] = [];
    for (let low = 55; low < 100; low += 5) {
      buckets.push({ range: `${low}-${low + 5}%`, count: 0 });
    }
    for (const row of rows) {
      const pct = row.score * 100;
      const idx = Math.min(Math.floor((pct - 55) / 5), buckets.length - 1);
      if (idx >= 0) buckets[idx].count += 1;
    }

    res.json({ weekOf, total: rows.length, buckets });
  } catch (err) {
    next(err);
  }
});

// POST /admin/db/query — read-only SQL
const querySchema = z.object({ sql: z.string().min(1).max(5000) });

router.post('/db/query', requireAdmin, validate(querySchema), async (req: Request, res: Response, _next: NextFunction) => {
  try {
    const rawSql = req.body.sql.trim();
    const normalized = rawSql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '').trim().toUpperCase();

    if (!normalized.startsWith('SELECT') && !normalized.startsWith('WITH')) {
      res.status(400).json({ error: 'Only SELECT queries are allowed' }); return;
    }
    const forbidden = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE', 'GRANT', 'REVOKE', 'COPY', 'EXECUTE', 'VACUUM'];
    for (const kw of forbidden) {
      if (normalized.includes(kw)) { res.status(400).json({ error: `Forbidden keyword: ${kw}` }); return; }
    }
    const sensitiveTerms = ['PASSWORDHASH', 'PASSWORD_HASH', 'STUDENTIDHASH', 'STUDENT_ID_HASH', 'OTP_CODES'];
    for (const term of sensitiveTerms) {
      if (normalized.includes(term)) { res.status(400).json({ error: `Forbidden sensitive term: ${term}` }); return; }
    }

    const result = await queryClient.unsafe(rawSql);
    const limited = result.slice(0, 500);
    res.json({ rows: limited, count: limited.length, totalCount: result.length });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Query failed' });
  }
});

// GET /admin/system
router.get('/system', requireAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [dbSize] = await queryClient.unsafe(`SELECT pg_size_pretty(pg_database_size(current_database())) as size`);
    const tableStats = await queryClient.unsafe(`SELECT relname as table, n_live_tup as rows FROM pg_stat_user_tables ORDER BY n_live_tup DESC`);

    res.json({
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      nodeVersion: process.version,
      dbSize: dbSize.size,
      tables: tableStats,
      isLocked: isMatchingLocked(),
    });
  } catch (err) {
    next(err);
  }
});

// ─── Matching Operations ───────────────────────────────────────

// GET /admin/trigger-matching/precheck — 触发匹配前预检：显示本周可参与人数及锁定状态
router.get('/trigger-matching/precheck', requireAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const weekOf = getCurrentWeekOf();

    const participantCondition = and(
      eq(users.isParticipating, true),
      eq(users.profileComplete, true),
      eq(users.surveyComplete, true),
      eq(surveyAnswers.version, LATEST_SURVEY_VERSION),
      gt(users.creditScore, 90),
      or(isNull(users.pauseUntilWeek), lt(users.pauseUntilWeek, weekOf))
    );

    const [eligible] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .innerJoin(surveyAnswers, eq(users.id, surveyAnswers.userId))
      .where(participantCondition);
    const [existingMatches] = await db.select({ count: sql<number>`count(*)::int` }).from(matches).where(and(
      eq(matches.weekOf, weekOf),
      eq(matches.source, 'weekly'),
    ));

    res.json({
      weekOf,
      eligibleUsers: eligible.count,
      alreadyMatchedThisWeek: existingMatches.count > 0,
      existingMatchCount: existingMatches.count,
      isLocked: isMatchingLocked(),
      safe: eligible.count >= 2 && existingMatches.count === 0 && !isMatchingLocked(),
    });
  } catch (err) {
    next(err);
  }
});

// POST /admin/email-test — 发送测试邮件给指定地址
const emailTestSchema = z.object({
  to: z.string().email(),
  type: z.enum([
    'survey-reminder',
    'survey-outdated-reminder',
    'survey-update',
    'match-revealed',
    'match-mutual',
    'match-expiration',
    'auto-pause',
    'permanent-sleep',
    'promo',
  ]),
});

router.post('/email-test', adminLimiter, requireAdmin, validate(emailTestSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { to, type } = req.body as { to: string; type: string };
    if (isDeletedAccountEmail(to)) {
      throw new ValidationError('不能向已注销账号占位邮箱发送测试邮件');
    }

    // 问卷提醒用即将到来的周三，匹配通知用当前/最近的周三
    const weekOf = type === 'survey-reminder' || type === 'survey-outdated-reminder'
      ? getUpcomingWeekOf()
      : getCurrentWeekOf();

    if (type === 'survey-reminder') await sendSurveyReminderEmail(to, weekOf);
    else if (type === 'survey-outdated-reminder') await sendOutdatedSurveyReminderEmail(to, weekOf);
    else if (type === 'survey-update') await sendSurveyUpdateNotification(to);
    else if (type === 'match-revealed') await sendMatchRevealedEmail(to, weekOf);
    else if (type === 'match-mutual') await sendMutualMatchEmail(to, weekOf);
    else if (type === 'match-expiration') await sendMatchExpirationWarning(to, weekOf);
    else if (type === 'auto-pause') await sendAutoPauseNotification(to, weekOf);
    else if (type === 'permanent-sleep') await sendPermanentSleepNotification(to);
    else if (type === 'promo') await sendPromoEmail(to);

    res.json({ message: `测试邮件 (${type}) 已发送至 ${to}` });
  } catch (err) {
    next(err);
  }
});

// GET /admin/email-preview/:type — 在浏览器直接渲染邮件 HTML
router.get('/email-preview/:type', requireAdmin, (req: Request, res: Response) => {
  const currentWeekOf = getCurrentWeekOf();
  const upcomingWeekOf = getUpcomingWeekOf();
  const type = req.params.type as string;

  const templates: Record<string, { subject: string; html: string }> = {
    'survey-reminder': {
      subject: 'NJU Match 提醒：问卷尚未完成',
      html: renderCardMail({
        title: '问卷还差最后几步',
        lead: `本周匹配周（${upcomingWeekOf}）即将到来。`,
        body: '你已完成注册，但问卷仍未提交。\n只有完成问卷，系统才能为你安排本周匹配。',
        buttonText: '去完成问卷',
        buttonUrl: 'https://njumatch.com/survey',
        footer: '如果你已经提交问卷，可忽略本邮件。',
      }),
    },
    'survey-outdated-reminder': {
      subject: 'NJU Match 提醒：问卷版本需要更新',
      html: renderCardMail({
        title: '你的问卷需要重新确认',
        lead: `本周匹配周（${upcomingWeekOf}）即将到来。`,
        body: '你曾完成过问卷，但当前保存的仍是旧版本。\n只有重新提交最新版问卷，系统才能为你安排本周匹配。',
        buttonText: '去更新问卷',
        buttonUrl: 'https://njumatch.com/survey',
        footer: '如果你已经重新提交最新问卷，可忽略本邮件。',
      }),
    },
    'survey-update': {
      subject: 'NJU Match：新的匹配引擎与问卷已上线，需要您重新确认',
      html: renderCardMail({
        title: '算法升级与问卷迁移',
        lead: '为了提供更深度的匹配，我们更新了问卷维度。',
        body: '系统检测到你曾经完成了旧版问卷，但为了继续参与本周及未来的匹配，需要你花几分钟在最新版本中补充并重新确认你的匹配偏好。',
        buttonText: '去更新问卷',
        buttonUrl: 'https://njumatch.com/survey',
        footer: '如果你暂时想休息，也可以在仪表盘选择「本周暂停」。',
      }),
    },
    'match-expiration': {
      subject: 'NJU Match：本期匹配即将于今晚失效，请做出决定',
      html: renderCardMail({
        title: '选择即将截止',
        lead: `匹配周：${currentWeekOf}，选择期限还剩 8 小时。`,
        body: '你还有一份已揭晓的配对档案未做出“愿见”或“止步”的回应。\n\n本期匹配将于今晚 (周五) 20:00 彻底过期。如果你不做出回应，对方将无法知道你的决定。',
        buttonText: '立刻前往选择',
        buttonUrl: 'https://njumatch.com/dashboard',
        footer: '注：若到期仍未反馈，系统将自动挂起你近期的匹配以避免资源浪费。',
      }),
    },
    'auto-pause': {
      subject: 'NJU Match：由于未能按时回应，已暂停你的匹配',
      html: renderCardMail({
        title: '你错失了上一次回应',
        lead: `我们在 ${currentWeekOf} 为你送出的配对已失效。`,
        body: '因为你在 48 小时内没有点选“愿见”或“止步”，这份际遇已经流入时间之海。\n\n为了避免僵尸席位占用池子资源，我们已暂且把你的账户挂起（暂停匹配）。如果你希望继续参与未来的配对，请随时前往设置将其重新打开。',
        buttonText: '前往设置开启匹配',
        buttonUrl: 'https://njumatch.com/settings',
        footer: '如果你觉得暂且休息也不错，可以直接忽略这封邮件。若持续一周未唤醒，席位将被永久休眠。',
      }),
    },
    'permanent-sleep': {
      subject: 'NJU Match：你的席位已永久休眠',
      html: renderCardMail({
        title: '缘分的休止符',
        lead: '你已经连续一周处于系统自动暂停状态并无唤醒动作。',
        body: '为了维护更活跃的匹配环境，我们已经为你切断了匹配池的通路（彻底停止参与）。\n\n但这并非终点，当你再次准备好拥抱随机碰撞的时候，大门随时为你敞开。',
        buttonText: '重回配对池',
        buttonUrl: 'https://njumatch.com/settings',
        footer: '在自己的节奏里，走自己的路就好。',
      }),
    },
    'match-revealed': {
      subject: 'NJU Match：本周匹配结果已揭晓',
      html: renderCardMail({
        title: '你的本周匹配已揭晓',
        lead: `匹配周：${currentWeekOf}`,
        body: '你已收到本周匹配结果。\n现在可以查看对方画像，并决定是否愿意见面。',
        buttonText: '查看匹配结果',
        buttonUrl: 'https://njumatch.com/profile',
        footer: '祝你遇见同频的人。',
      }),
    },
    'match-mutual': {
      subject: 'NJU Match：你们双方都选择了愿见',
      html: renderCardMail({
        title: '双向愿见已达成',
        lead: `匹配周：${currentWeekOf}`,
        body: '对方也选择了愿意见面。\n你现在可以查看联系方式，开启第一次对话。',
        buttonText: '查看联系方式',
        buttonUrl: 'https://njumatch.com/reveal',
        footer: '请保持礼貌与边界感，祝你们交流顺利。',
      }),
    },
    'promo': {
      subject: '【致最初的同路人】抽奖活动邀请与挑战赛奖品等你来拿',
      html: renderCardMail({
        title: '致最初的同路人',
        lead: '抽奖活动邀请与挑战赛奖品等你来拿',
        body: `见字如面\n截至完稿，NJU Match的同行者正式突破了 <strong>1200</strong> 人大关！\n作为第一批填写问卷的南大人，是你们投递的那份真诚与信任，让这个新生的慢社交平台迎来了第一个里程碑。你们是达成这 1200 人成就的最核心贡献者。团队在此向每一位最初的同行者，致以最深的感谢！\n\n<strong>专属感恩回馈：36小时限时抽奖！</strong>\n为了答谢大家的热情支持，我们专门为大家加码了一场限时抽奖活动：\n<strong>开启时间</strong>：<strong>今天下午（4月3日） 16:00</strong> 正式发布，活动仅持续 36 小时！\n<strong>参与人员</strong>：<strong>仅限收到邮件的前1200余名注册用户</strong>\n<strong>参与阵地</strong>：<strong>「校园集市」与「南小宝」的推文评论区</strong>。<strong>今天下午四点</strong>，我们将会在这两个平台同步发布推文，感谢让我们相遇的缘分。为防止恶意阻击混淆，我们将在小红书官方账号“NJU Match”上同步发送与两平台推文一致的内容，<strong>请注意甄别</strong>。\n<strong>参与方式</strong>：在任意一篇推文中点赞并评论（评论中必须包括“NJUMATCH”中任意连续的三个大写字母符号，比如 “TCH期待” “在NJ期待U” 等。欢迎大家发挥自己的想象力呀~），即可成功参与抽奖。\n<strong>奖品设置</strong>：三个一等奖，奖品是<strong>52.13元的现金红包或等价值的花卉</strong>；十个感谢参与奖，奖品是<strong>9.99元的现金红包或等价值的花卉</strong>。如果在评论区联系不到您，我们将在小红书官方平台展示抽中的用户昵称，诚邀您关注我们的小红书官方账号“NJU Match”。\n<strong>开奖方式</strong>：活动结束后，我们将采用<strong>全程录屏</strong>的方式，从评论区随机滚动抽取，送出我们的谢礼。\n<strong>注意事项</strong>：每个账户仅有一条符合规则要求的评论可以参与抽奖，若检测到恶意刷评将取消抽奖资格。不过一如既往地，欢迎大家讨论、交流和批评建议~\n\n定好闹钟，快去集市和南小宝的评论区等待你的专属好运吧！\n\n另外，我们的<strong>「一周一遇」正式开启</strong>！\n为了记录属于南大人的奇妙相逢，我们的分享挑战赛现已上线。无论你是想分享初次匹配的心动、跨年级接触的奇遇，还是对我们的真实吐槽与期许，现在只需前往小红书等平台带话题 <strong>#NJUMATCH</strong> 发帖，即有机会解锁现金红包及价值 99 元的玫瑰礼盒！ 此活动完整规则详情请见小红书官方账号“NJU Match”的推文~`,
        footer: '感谢你的支持，祝你遇见同频的人。',
      }),
    },
    'otp': {
      subject: 'NJU Match - 验证码',
      html: `
        <div style="font-family:'PingFang SC','Microsoft YaHei',sans-serif; max-width: 420px; margin: 0 auto; padding: 24px; color:#2C2825;">
          <h2 style="color: #420047; margin-top:0;">NJU Match</h2>
          <p>你的验证码是：</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #420047; padding: 16px; background: #f5f0f5; border-radius: 8px; text-align: center;">
            123456
          </div>
          <p style="color: #8B7355; font-size: 13px; margin-top: 16px;">验证码 5 分钟内有效，请勿告诉他人。</p>
        </div>
      `,
    },
  };

  const tpl = templates[type];
  if (!tpl) {
    res.status(404).send(`Unknown template. Available: ${Object.keys(templates).join(', ')}`);
    return;
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${tpl.subject}</title></head><body style="margin:0;background:#e8e4de;">${tpl.html}</body></html>`);
});

// GET /admin/survey-reminder/preview — 预览未填问卷用户数
router.get('/survey-reminder/preview', requireAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const pendingRows = await db
      .select({ id: users.id, email: users.email, createdAt: users.createdAt, emailNotifications: users.emailNotifications })
      .from(users)
      .where(eq(users.surveyComplete, false))
      .orderBy(desc(users.createdAt));
    const pending = pendingRows.filter((u) => !isDeletedAccountEmail(u.email));

    res.json({
      total: pending.length,
      withEmailEnabled: pending.filter(u => u.emailNotifications).length,
      users: pending,
    });
  } catch (err) {
    next(err);
  }
});

// POST /admin/survey-reminder/send — 手动触发问卷提醒批次
router.post('/survey-reminder/send', adminLimiter, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await sendPendingSurveyReminderBatch('main');
    await logAudit({ action: 'bulk_survey_reminder', detail: { stats }, ip: getRequestIp(req), result: 'success' });
    res.json({ message: `提醒发送完成`, stats });
  } catch (err) {
    await logAudit({ action: 'bulk_survey_reminder', detail: { error: String(err) }, ip: getRequestIp(req), result: 'failure' });
    next(err);
  }
});

// POST /admin/notify/promo-resend — 给配对成功的用户补发 promotion 邮件
router.post('/notify/promo-resend', adminLimiter, requireAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await resendPromoToMatchedBatch();
    res.json({ message: `Promo resend completed`, stats });
  } catch (err) {
    next(err);
  }
});

// POST /admin/notify/match-revealed — 补发本周匹配结果通知
router.post('/notify/match-revealed', adminLimiter, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const weekOf = getCurrentWeekOf();
    await sendMatchRevealedNotificationsForWeek(weekOf);
    await logAudit({ action: 'bulk_match_revealed_notify', detail: { weekOf }, ip: getRequestIp(req), result: 'success' });
    res.json({ message: `已为 ${weekOf} 补发匹配结果通知` });
  } catch (err) {
    await logAudit({ action: 'bulk_match_revealed_notify', detail: { error: String(err) }, ip: getRequestIp(req), result: 'failure' });
    next(err);
  }
});

// POST /admin/trigger-matching
// Body (optional): { "userIds": ["id1", "id2"] }  — test mode, only matches these users
router.post('/trigger-matching', adminLimiter, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userIds: string[] | undefined = Array.isArray(req.body?.userIds) ? req.body.userIds : undefined;
    const stats = await runMatchingPipeline(userIds);
    await logAudit({
      action: userIds ? 'trigger_matching_test' : 'trigger_matching',
      detail: { userIds: userIds ?? null, stats },
      ip: getRequestIp(req),
      result: 'success',
    });
    res.json({ message: userIds ? `测试匹配完成（${userIds.length} 位用户）` : '匹配完成', stats });
  } catch (err) {
    await logAudit({ action: 'trigger_matching', detail: { error: String(err) }, ip: getRequestIp(req), result: 'failure' });
    next(err);
  }
});

// POST /admin/regen-curator-notes — regenerate AI curator notes for current week
router.post('/regen-curator-notes', adminLimiter, requireAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const weekOf = getCurrentWeekOf();
    const rows = await db
      .select({
        id: matches.id,
        score: matches.score,
        dimensions: matches.dimensions,
        userAId: matches.userAId,
        userBId: matches.userBId,
      })
      .from(matches)
      .where(and(
        eq(matches.weekOf, weekOf),
        eq(matches.source, 'weekly'),
      ));

    if (rows.length === 0) {
      res.json({ message: '本周暂无匹配记录', updated: 0 });
      return;
    }

    // Fetch user campus info
    const allUserIds = [...new Set(rows.flatMap((r) => [r.userAId, r.userBId]))];
    const userRows = await db
      .select({ id: users.id, campus: users.campus })
      .from(users)
      .where(inArray(users.id, allUserIds));
    const campusMap = new Map(userRows.map((u) => [u.id, u.campus]));

    // Fetch survey answers
    const answerRows = await db.select().from(surveyAnswers).where(inArray(surveyAnswers.userId, allUserIds));
    const answersMap = new Map(answerRows.map((r) => [r.userId, JSON.parse(r.answers)]));

    let updated = 0;
    let failed = 0;
    const CONCURRENCY = 10;
    for (let i = 0; i < rows.length; i += CONCURRENCY) {
      const batch = rows.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map((row) => {
          const raw = row.dimensions ? JSON.parse(row.dimensions) : {};
          const { _sharedInterests, _intention } = raw;
          return generateCuratorNote(
            answersMap.get(row.userAId) ?? {},
            answersMap.get(row.userBId) ?? {},
            row.score,
            {
              sharedInterests: _sharedInterests ?? [],
              aCampus: campusMap.get(row.userAId),
              bCampus: campusMap.get(row.userBId),
              intention: _intention ?? 'partner',
            },
          );
        }),
      );
      for (let j = 0; j < batch.length; j++) {
        const result = results[j];
        const note = result.status === 'fulfilled' ? result.value : null;
        if (note) {
          await db.update(matches).set({ curatorNote: note }).where(eq(matches.id, batch[j].id));
          updated++;
        } else {
          failed++;
        }
      }
    }

    res.json({ message: `晚风私语重新生成完成`, updated, failed, total: rows.length });
  } catch (err) {
    next(err);
  }
});

// POST /admin/unlock-reveal
router.post('/unlock-reveal', adminLimiter, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await unlockCurrentWeekMatches();
    await logAudit({ action: 'unlock_reveal', detail: { unlockedCount: count }, ip: getRequestIp(req), result: 'success' });
    res.json({ message: `已解锁 ${count} 对匹配`, unlockedCount: count });
  } catch (err) {
    await logAudit({ action: 'unlock_reveal', detail: { error: String(err) }, ip: getRequestIp(req), result: 'failure' });
    next(err);
  }
});

// ─── Circle Admin ───────────────────────────────────────────────

const createCircleSchema = z.object({
  name: z.string().trim().min(1).max(50),
  slug: z.string().trim().min(1).max(50).regex(/^[a-z0-9-]+$/),
  description: z.string().trim().max(500).optional(),
  category: z.string().trim().min(1).max(50),
  tag: z.string().trim().max(50).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(3).optional(),
  iconUrl: z.string().trim().max(500).optional(),
  creatorId: z.string().uuid().nullable().optional(),
  status: z.enum(['active', 'inactive', 'pending_review', 'rejected', 'banned', 'archived']).optional(),
  reviewNote: z.string().trim().max(500).nullable().optional(),
});

const updateCircleSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  slug: z.string().trim().min(1).max(50).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().trim().max(500).optional(),
  category: z.string().trim().min(1).max(50).optional(),
  tag: z.string().trim().max(50).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(3).optional(),
  iconUrl: z.string().trim().max(500).optional(),
  creatorId: z.string().uuid().nullable().optional(),
  status: z.enum(['active', 'inactive', 'pending_review', 'rejected', 'banned', 'archived']).optional(),
  reviewNote: z.string().trim().max(500).nullable().optional(),
});

const activeSchema = z.object({
  isActive: z.boolean(),
});

const baseCardComponentSchema = z.object({
  key: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(100),
  sourceType: z.enum(['user_profile', 'survey_answer', 'manual']),
  sourceKey: z.string().trim().max(100).nullable().optional(),
}).superRefine((component, ctx) => {
  if (component.sourceType === 'user_profile' && (!component.sourceKey || !component.sourceKey.startsWith('users.'))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sourceKey'],
      message: 'user_profile 类型的 sourceKey 必须以 users. 开头',
    });
  }

  if (component.sourceType === 'survey_answer' && (!component.sourceKey || !component.sourceKey.startsWith('survey.'))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sourceKey'],
      message: 'survey_answer 类型的 sourceKey 必须以 survey. 开头',
    });
  }
});

const baseCardComponentPatchSchema = z.object({
  key: z.string().trim().min(1).max(50).optional(),
  name: z.string().trim().min(1).max(100).optional(),
  sourceType: z.enum(['user_profile', 'survey_answer', 'manual']).optional(),
  sourceKey: z.string().trim().max(100).nullable().optional(),
}).refine(
  (data) => Object.values(data).some((value) => value !== undefined),
  { message: '至少提供一个可更新字段' },
);

const baseCardComponentsSchema = z.object({
  components: z.array(baseCardComponentSchema),
}).superRefine((data, ctx) => {
  const seen = new Set<string>();

  for (const [index, component] of data.components.entries()) {
    if (seen.has(component.key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['components', index, 'key'],
        message: '组件 key 不能重复',
      });
      continue;
    }

    seen.add(component.key);
  }
});

const questionsSchema = z.object({
  questions: z.array(z.object({
    key: z.string().min(1).max(50),
    type: z.enum(['scale', 'single_choice', 'multi_choice', 'ranking']),
    prompt: z.string().min(1).max(500),
    options: z.array(z.unknown()).optional(),
    weight: z.number().min(0).max(10).optional(),
    displayOrder: z.number().int().min(0).optional(),
    isChannelTag: z.boolean().optional(),
  })),
});

// Note: B-card component schemas still reuse the historical questionnaire-shaped fields
// (`type`, `options`, `weight`) for compatibility. In the current product flow they should
// be read as component metadata rather than a strict requirement that the frontend render
// questionnaire-style controls.
const cardComponentSchema = z.object({
  key: z.string().min(1).max(50),
  type: z.enum(['scale', 'single_choice', 'multi_choice', 'ranking']),
  prompt: z.string().min(1).max(500),
  options: z.array(z.unknown()).optional(),
  weight: z.number().min(0).max(10).optional(),
  displayOrder: z.number().int().min(0).optional(),
  isChannelTag: z.boolean().optional(),
});

const cardComponentPatchSchema = z.object({
  key: z.string().min(1).max(50).optional(),
  type: z.enum(['scale', 'single_choice', 'multi_choice', 'ranking']).optional(),
  prompt: z.string().min(1).max(500).optional(),
  options: z.array(z.unknown()).optional(),
  weight: z.number().min(0).max(10).optional(),
  displayOrder: z.number().int().min(0).optional(),
  isChannelTag: z.boolean().optional(),
}).refine(
  (data) => Object.values(data).some((value) => value !== undefined),
  { message: '至少提供一个可更新字段' },
);

const cardComponentsSchema = z.object({
  components: z.array(cardComponentSchema),
});

const customCardReviewStatusSchema = z.enum(['pending', 'approved', 'rejected']);

const rejectCustomCardSchema = z.object({
  reviewNote: z.string().trim().max(500).optional(),
});

const promoteCustomCardSchema = z.object({
  key: z.string().trim().min(1).max(50).optional(),
  type: z.enum(['scale', 'single_choice', 'multi_choice', 'ranking']),
  prompt: z.string().trim().min(1).max(500).optional(),
  options: z.array(z.unknown()).optional(),
  weight: z.number().min(0).max(10).optional(),
  displayOrder: z.number().int().min(0).optional(),
  isChannelTag: z.boolean().optional(),
});

// GET /admin/base-card-components — get A-card components
router.get('/base-card-components', adminLimiter, requireAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await getBaseCardComponents();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /admin/base-card-components — create A-card component
router.post('/base-card-components', adminLimiter, requireAdmin, validate(baseCardComponentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await createBaseCardComponent(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PUT /admin/base-card-components — replace A-card components
router.put('/base-card-components', adminLimiter, requireAdmin, validate(baseCardComponentsSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await replaceBaseCardComponents(req.body.components);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PATCH /admin/base-card-components/:key — update A-card component
router.patch('/base-card-components/:key', adminLimiter, requireAdmin, validate(baseCardComponentPatchSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const componentKey = parseComponentKeyParam(req.params.key as string);
    const result = await updateBaseCardComponent(componentKey, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /admin/base-card-components/:key — delete A-card component
router.delete('/base-card-components/:key', adminLimiter, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const componentKey = parseComponentKeyParam(req.params.key as string);
    const result = await deleteBaseCardComponent(componentKey);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /admin/circles — create circle
router.get('/circles', adminLimiter, requireAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await db.select().from(circles).orderBy(desc(circles.createdAt), circles.name);
    res.json({ circles: rows });
  } catch (err) {
    next(err);
  }
});

// POST /admin/circles — create circle
router.post('/circles', adminLimiter, requireAdmin, validate(createCircleSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const circle = await createCircle(req.body, req.auth?.userId ?? null);
    res.json({ message: '圈子已创建', circle });
  } catch (err) {
    next(err);
  }
});

// PUT /admin/circles/:circleId — update circle
router.put('/circles/:circleId', adminLimiter, requireAdmin, validate(updateCircleSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const circle = await updateCircle(req.params.circleId as string, req.body, req.auth?.userId ?? null);
    res.json({ message: '圈子已更新', circle });
  } catch (err) {
    next(err);
  }
});

// DELETE /admin/circles/:circleId — delete circle
// 危险操作，暂时下线。服务层 deleteCircle 先保留，待后续补充更安全的流程后再恢复。
// router.delete('/circles/:circleId', adminLimiter, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
//   try {
//     const circle = await deleteCircle(req.params.circleId as string);
//     res.json({ message: '圈子已删除', circle });
//   } catch (err) {
//     next(err);
//   }
// });

// PATCH /admin/circles/:circleId/active — toggle active
router.patch('/circles/:circleId/active', adminLimiter, requireAdmin, validate(activeSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const circle = await setCircleActive(req.params.circleId as string, req.body.isActive, req.auth?.userId ?? null);
    res.json({ message: req.body.isActive ? '已上架' : '已下架', circle });
  } catch (err) {
    next(err);
  }
});

// GET /admin/circles/:circleId/card-components — get B-card components
router.get('/circles/:circleId/card-components', adminLimiter, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await getCircleCardComponents(req.params.circleId as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /admin/circles/:circleId/card-components — create B-card component
router.post('/circles/:circleId/card-components', adminLimiter, requireAdmin, validate(cardComponentSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await createCircleCardComponent(req.params.circleId as string, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PUT /admin/circles/:circleId/card-components — replace B-card components
router.put('/circles/:circleId/card-components', adminLimiter, requireAdmin, validate(cardComponentsSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await replaceCircleCardComponents(req.params.circleId as string, req.body.components);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PATCH /admin/circles/:circleId/card-components/:key — update B-card component
router.patch('/circles/:circleId/card-components/:key', adminLimiter, requireAdmin, validate(cardComponentPatchSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const componentKey = parseComponentKeyParam(req.params.key as string);
    const result = await updateCircleCardComponent(req.params.circleId as string, componentKey, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /admin/circles/:circleId/card-components/:key — delete B-card component
router.delete('/circles/:circleId/card-components/:key', adminLimiter, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const componentKey = parseComponentKeyParam(req.params.key as string);
    const result = await deleteCircleCardComponent(req.params.circleId as string, componentKey);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /admin/circle-custom-items — list C-card items for moderation
router.get('/circle-custom-items', adminLimiter, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawStatus = (req.query.status as string | undefined) ?? 'pending';
    const parsedStatus = customCardReviewStatusSchema.safeParse(rawStatus);
    if (!parsedStatus.success) {
      throw new ValidationError('status 必须是 pending / approved / rejected');
    }

    const rawCircleId = req.query.circleId as string | undefined;
    const circleId = rawCircleId ? parseUuidParam(rawCircleId, 'circleId') : undefined;
    const result = await listCircleCustomCardsForReview(parsedStatus.data, circleId);
    res.json({
      status: parsedStatus.data,
      circleId: circleId ?? null,
      ...result,
    });
  } catch (err) {
    next(err);
  }
});

// POST /admin/circle-custom-items/:itemId/approve — approve a C-card item
router.post('/circle-custom-items/:itemId/approve', adminLimiter, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const itemId = parseUuidParam(req.params.itemId as string, 'itemId');
    const result = await approveCircleCustomCard(itemId, req.auth?.userId ?? null);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /admin/circle-custom-items/:itemId/reject — reject a C-card item
router.post('/circle-custom-items/:itemId/reject', adminLimiter, requireAdmin, validate(rejectCustomCardSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const itemId = parseUuidParam(req.params.itemId as string, 'itemId');
    const result = await rejectCircleCustomCard(itemId, req.body.reviewNote, req.auth?.userId ?? null);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /admin/circle-custom-items/:itemId/promote — promote a C-card item to a B-card component
router.post('/circle-custom-items/:itemId/promote', adminLimiter, requireAdmin, validate(promoteCustomCardSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const itemId = parseUuidParam(req.params.itemId as string, 'itemId');
    const result = await promoteCircleCustomCardToCircleComponent(itemId, req.body, req.auth?.userId ?? null);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /admin/circles/:circleId/questions — deprecated compatibility alias
router.post('/circles/:circleId/questions', adminLimiter, requireAdmin, validate(questionsSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await replaceCircleQuestions(req.params.circleId as string, req.body.questions);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /admin/trigger-circle-matching — trigger all circles
router.post('/trigger-circle-matching', adminLimiter, requireAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await runCircleMatchingPipeline();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /admin/trigger-circle-matching/:id — trigger single circle
router.post('/trigger-circle-matching/:id', adminLimiter, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await runCircleMatchingPipeline(req.params.id as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /admin/unlock-circle-reveal — unlock circle matches
router.post('/unlock-circle-reveal', adminLimiter, requireAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await unlockCircleMatches();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─── Reports Admin ─────────────────────────────────────────────

const REPORT_REASON_LABELS: Record<string, string> = {
  harassment: '骚扰辱骂',
  spam: '垃圾信息',
  fake_profile: '虚假资料',
  inappropriate_content: '不当内容',
  other: '其他原因',
};

function toCreditLevelByPolicy(score: number): 'normal' | 'limited' | 'banned' {
  if (score <= 85) return 'banned';
  if (score <= 90) return 'limited';
  return 'normal';
}

function resolveUserReportPenalty(manualPenaltyScore?: number): 1 | 3 | 5 {
  if (manualPenaltyScore !== 1 && manualPenaltyScore !== 3 && manualPenaltyScore !== 5) {
    throw new ValidationError('审核通过时，管理员必须手动选择扣分（1/3/5）');
  }
  return manualPenaltyScore;
}

function formatReportReasonText(reason: string): string {
  return reason
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => REPORT_REASON_LABELS[item] || item)
    .join('、');
}

function toAdminUserSummary(user: typeof users.$inferSelect | undefined) {
  if (!user) return null;
  let contactPlatform: string | null = null;
  let contactId: string | null = null;
  if (user.wechatId?.includes(':')) {
    const [platform, ...rest] = user.wechatId.split(':');
    contactPlatform = platform || null;
    contactId = rest.join(':') || null;
  } else {
    contactPlatform = user.wechatId ? 'wechat' : null;
    contactId = user.wechatId || null;
  }

  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    gender: user.gender,
    genderPref: user.genderPref,
    intention: user.intention,
    grade: user.grade,
    campus: user.campus,
    department: user.department,
    mbti: user.mbti,
    bio: user.bio,
    contactPlatform,
    contactId,
    isParticipating: user.isParticipating,
    pauseUntilWeek: user.pauseUntilWeek,
    emailNotifications: user.emailNotifications,
    profileComplete: user.profileComplete,
    surveyComplete: user.surveyComplete,
    createdAt: user.createdAt,
  };
}

// GET /admin/reports — list user reports (default: pending)
router.get('/reports', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = (req.query.status as string) || 'pending';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;

    const where = status === 'all' ? undefined : eq(userReports.status, status);
    const [totalRow] = await db.select({ count: sql<number>`count(*)::int` }).from(userReports).where(where);
    const rows = await db.select().from(userReports).where(where)
      .orderBy(desc(userReports.createdAt)).limit(limit).offset(offset);

    const userIds = Array.from(new Set(rows.flatMap((row) => [row.reporterId, row.reportedId])));
    const relatedUsers = userIds.length > 0
      ? await db.select().from(users).where(inArray(users.id, userIds))
      : [];
    const userMap = new Map(relatedUsers.map((user) => [user.id, user]));

    const reports = rows.map((row) => ({
      ...row,
      reasonText: formatReportReasonText(row.reason),
      reporter: toAdminUserSummary(userMap.get(row.reporterId)),
      reported: toAdminUserSummary(userMap.get(row.reportedId)),
    }));

    res.json({ total: totalRow.count, page, limit, reports });
  } catch (err) {
    next(err);
  }
});

const reviewReportSchema = z.object({
  status: z.enum(['reviewed', 'dismissed', 'warn_update', 'request_evidence']),
  adminNote: z.string().max(500).optional(),
  penaltyScore: z.union([z.literal(1), z.literal(3), z.literal(5)]).optional(),
});

// PATCH /admin/reports/:id — mark a report as reviewed / warn_update / dismissed, or request evidence
router.patch('/reports/:id', requireAdmin, validate(reviewReportSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reportId = req.params.id as string;
    const action = req.body.status as 'reviewed' | 'dismissed' | 'warn_update' | 'request_evidence';
    const adminNote: string | undefined = req.body.adminNote || undefined;
    const penaltyScoreInput = req.body.penaltyScore as 1 | 3 | 5 | undefined;

    const [existing] = await db.select().from(userReports).where(eq(userReports.id, reportId)).limit(1);
    if (!existing) { res.status(404).json({ error: 'Report not found' }); return; }

    // request_evidence 不改变状态，只发邮件给举报人
    if (action === 'request_evidence') {
      const [reporter] = await db.select().from(users).where(eq(users.id, existing.reporterId)).limit(1);
      const notifications: Record<string, 'sent' | 'skipped' | 'failed'> = { reporter: 'skipped', reported: 'skipped' };
      if (reporter?.email) {
        try {
          await sendReportEvidenceRequestEmail(reporter.email, { reportId, adminNote, supportEmail: config.support.email });
          notifications.reporter = 'sent';
        } catch (mailErr) {
          notifications.reporter = 'failed';
          console.error('[MAIL] report evidence request failed:', mailErr);
        }
      }
      await logAudit({ action: 'request_evidence', target: reportId, detail: { adminNote }, ip: getRequestIp(req) });
      res.json({ message: '已向举报人发送补充材料请求邮件', report: existing, notifications });
      return;
    }

    const { updated, creditChanged, creditScoreAfter, penaltyScore } = await db.transaction(async (tx) => {
      const [current] = await tx.select().from(userReports).where(eq(userReports.id, reportId)).limit(1);
      if (!current) throw new ValidationError('举报不存在');
      if (current.status !== 'pending') {
        throw new ValidationError('只能处理待处理状态的举报，避免重复通知用户');
      }

      const [next] = await tx.update(userReports)
        .set({
          status: action,
          adminNote: adminNote ?? null,
          reviewedAt: sql`NOW()`,
        })
        .where(eq(userReports.id, reportId))
        .returning();
      if (!next) throw new ValidationError('举报更新失败');

      if (action !== 'reviewed') {
        return { updated: next, creditChanged: false, creditScoreAfter: null as number | null, penaltyScore: null as 1 | 3 | 5 | null };
      }
      const penaltyScore = resolveUserReportPenalty(penaltyScoreInput);

      const [reportedUser] = await tx
        .select({ id: users.id, creditScore: users.creditScore })
        .from(users)
        .where(eq(users.id, next.reportedId))
        .limit(1);
      if (!reportedUser) throw new ValidationError('被举报用户不存在');

      const nextScore = Math.max(0, (reportedUser.creditScore ?? 100) - penaltyScore);
      const nextLevel = toCreditLevelByPolicy(nextScore);
      const shouldPauseWeek = nextScore <= 90;

      await tx.update(users).set({
        creditScore: nextScore,
        creditLevel: nextLevel,
        pauseUntilWeek: shouldPauseWeek ? getUpcomingWeekOf() : undefined,
        isParticipating: shouldPauseWeek ? false : undefined,
        updatedAt: sql`NOW()`,
      }).where(eq(users.id, next.reportedId));

      await tx.insert(creditScoreLogs).values({
        id: uuidv4(),
        userId: next.reportedId,
        delta: -penaltyScore,
        reason: `user_report_reviewed_l${penaltyScore === 1 ? 1 : penaltyScore === 3 ? 2 : 3}`,
        sourceType: 'user_report',
        sourceId: next.id,
      });

      return { updated: next, creditChanged: true, creditScoreAfter: nextScore, penaltyScore };
    });

    const relatedUsers = await db.select().from(users).where(inArray(users.id, [updated.reporterId, updated.reportedId]));
    const reporter = relatedUsers.find((user) => user.id === updated.reporterId);
    const reported = relatedUsers.find((user) => user.id === updated.reportedId);

    const notifications: Record<string, 'sent' | 'skipped' | 'failed'> = {
      reporter: 'skipped',
      reported: 'skipped',
    };

    // 始终通知举报人（dismissed 时附上管理员备注作为平台说明）
    if (reporter?.email) {
      try {
        await sendReportResultEmail(reporter.email, { reportId: updated.id, status: action, adminNote: action === 'dismissed' ? adminNote : undefined });
        notifications.reporter = 'sent';
      } catch (mailErr) {
        notifications.reporter = 'failed';
        console.error('[MAIL] report result notification failed:', mailErr);
      }
    }

    // 根据处理方式决定是否通知被举报人
    if (action === 'reviewed' && reported?.email) {
      try {
        await sendReportWarningEmail(reported.email, {
          reportId: updated.id,
          reasonText: formatReportReasonText(updated.reason),
          appealEmail: config.support.email,
          adminNote,
        });
        notifications.reported = 'sent';
      } catch (mailErr) {
        notifications.reported = 'failed';
        console.error('[MAIL] report warning notification failed:', mailErr);
      }
    } else if (action === 'warn_update' && reported?.email) {
      try {
        await sendReportWarnUpdateEmail(reported.email, {
          reportId: updated.id,
          adminNote,
          supportEmail: config.support.email,
        });
        notifications.reported = 'sent';
      } catch (mailErr) {
        notifications.reported = 'failed';
        console.error('[MAIL] report warn-update notification failed:', mailErr);
      }
    }

    // ── 站内通知：report_result ──
    try {
      // reviewed / warn_update → 双方通知；dismissed → 仅举报者
      const reportNotifyTargets = [updated.reporterId];
      if (action === 'reviewed' || action === 'warn_update') {
        reportNotifyTargets.push(updated.reportedId);
      }
      for (const uid of reportNotifyTargets) {
        await createNotification({
          userId: uid,
          type: 'report_result',
          title: action === 'reviewed' ? '举报已受理'
            : action === 'warn_update' ? '举报处理结果'
            : '举报已驳回',
          body: action === 'reviewed'
            ? '经核实，你提交的举报已受理，相关处理已执行。'
            : action === 'warn_update'
            ? '经核实，被举报用户已被要求修改资料。'
            : '经核实，你提交的举报已被驳回。',
          level: action === 'reviewed' ? 'success'
            : action === 'warn_update' ? 'warning'
            : 'info',
          actionUrl: '/notifications',
          meta: { reportId, outcome: action },
          idempotencyKey: buildIdempotencyKey(uid, 'report_result', `report_${reportId}`),
        });
      }
    } catch (err) {
      console.error('[NOTIFICATION] report_result write failed:', err);
    }

    await logAudit({
      action: 'review_report',
      target: reportId,
      detail: { status: action, adminNote, creditChanged, creditScoreAfter, penaltyScore },
      ip: getRequestIp(req),
    });
    res.json({
      message: '举报状态已更新，通知邮件已按规则发送',
      report: updated,
      creditChanged,
      creditScoreAfter,
      penaltyScore,
      notifications,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Test Helpers ──────────────────────────────────────────────

function buildHighCompatibilityTestAnswers(
  preferredMbti: string[],
  overrides: Record<string, { value: unknown; importance?: number }> = {},
): Record<string, { value: unknown; importance?: number }> {
  const baseAnswers: Record<string, { value: unknown; importance?: number }> = {
    q1: { value: 2002 },
    q2: { value: { min: 2000, max: 2005 } },
    q61: { value: preferredMbti },
    q5: { value: ['same_grade', 'higher_grade'] },
    q7: { value: 'prefer_same_major' },
    q3: { value: 'jiangsu' },
    q_jiangsu_city: { value: 'nanjing' },
    q4: { value: 'prefer_same_city' },
    q6: { value: 'same_campus_only' },

    q8: { value: ['movies_series', 'food_exploring', 'travel_citywalk', 'music_listening'] },
    q_mv_type: { value: ['romance', 'sci_fi', 'documentary'] },
    q_mv_media: { value: ['movie', 'kr_drama', 'us_drama'] },
    q_mv_together: { value: 'discuss_plot' },
    q_fd_type: { value: ['cafe_dessert', 'western_brunch', 'hidden_gem'] },
    q_fd_prio: { value: ['good_chat', 'nice_ambiance'] },
    q_tr_type: { value: ['city_walk', 'cafe_hop', 'random_explore'] },
    q_tr_style: { value: 'rough_plan' },
    q_music_style: { value: ['indie', 'c_pop', 'classical'] },
    q_top_interest: { value: 'travel_citywalk' },
    q_date_content: { value: ['walk_citywalk', 'eat_explore', 'just_chat'] },
    q_weekend_date: { value: 'both_ok' },

    q9: { value: 'no' },
    q10: { value: 6, importance: 4 },
    q_drink_freq: { value: 'rarely' },
    q_drink_pref: { value: 5, importance: 3 },
    q_pet_like: { value: 6, importance: 2 },
    q_pet_partner: { value: 5, importance: 2 },
    q15: { value: 'late_sleep_late_rise' },
    q_schedule_imp: { value: 5, importance: 3 },
    q_free_time: { value: ['weekday_night', 'sat_night', 'sun_day'] },
    q_spend_style: { value: 'balanced' },
    q_spend_imp: { value: 5, importance: 3 },
    q32: { value: 'share_equally' },
    q_spend_mode_imp: { value: 4, importance: 2 },
    q37: { value: 4, importance: 2 },
    q38: { value: 4, importance: 2 },

    q_rel_mode: { value: 'mutual_active' },
    q_my_pace: { value: 'slow_careful' },
    q_atmosphere: { value: 'mix_talk_quiet' },
    q_conflict_self: { value: 'cool_then_talk' },
    q_conflict_partner: { value: 'cool_first' },
    q_support_pref: { value: 'both' },
    q_reply_speed: { value: 'normal' },
    q_reply_pref: { value: 5, importance: 3 },
    q41: { value: 4, importance: 2 },
    q36: { value: 5, importance: 3 },
    q_affection_need: { value: 5, importance: 3 },
    q_physical_pace: { value: 4, importance: 2 },

    q_rel_history: { value: 2, importance: 1 },
    q_history_imp: { value: 3, importance: 2 },
    q44: { value: 2, importance: 2 },
    q47: { value: 3, importance: 2 },
    q48: { value: 5, importance: 2 },
    q_space_integration: { value: 'balanced_space' },
    q_red_flags: { value: ['ghost_msg', 'hurtful_words', 'disrespect_circle'] },
    q57: { value: 1, importance: 4 },

    q21: { value: 6, importance: 3 },
    q_work_style: { value: 6, importance: 2 },
    q27: { value: 5, importance: 2 },
    q24: { value: 6, importance: 2 },
    q25: { value: 6, importance: 2 },
    q33: { value: 2, importance: 1 },
    q26: { value: 5, importance: 2 },
    q28: { value: 2, importance: 1 },
    q30: { value: 2, importance: 1 },
    q_future_base: { value: ['jiangsu', 'shanghai', 'zhejiang'] },
    q_future_base_imp: { value: 5, importance: 3 },
    q_growth_env: { value: 'tier2' },
    q_family_econ: { value: 'comfortable' },
    q31: { value: 4, importance: 2 },
    q29: { value: ['kindness', 'honesty', 'curiosity', 'loyalty'] },
    q_partner_qualities: { value: ['kindness', 'honesty', 'curiosity', 'loyalty'] },
    q60: { value: 'communication' },
    q_must_align: { value: 'comm_style' },
  };

  return { ...baseAnswers, ...overrides };
}

async function cleanupTestUsersByEmails(testEmails: string[]): Promise<number> {
  const testRows = await db.select({ id: users.id }).from(users).where(
    or(...testEmails.map((e) => eq(users.email, e)))
  );
  const testIds = testRows.map((r) => r.id);

  if (testIds.length === 0) return 0;

  await db.delete(circleMatches).where(
    or(...testIds.flatMap((id) => [eq(circleMatches.userAId, id), eq(circleMatches.userBId, id)]))
  );
  await db.delete(circleMembers).where(inArray(circleMembers.userId, testIds));
  await db.delete(matches).where(
    or(...testIds.flatMap((id) => [eq(matches.userAId, id), eq(matches.userBId, id)]))
  );
  await db.delete(mailLogs).where(inArray(mailLogs.userId, testIds));
  await db.delete(surveyAnswers).where(inArray(surveyAnswers.userId, testIds));
  await db.delete(users).where(inArray(users.id, testIds));

  return testIds.length;
}

// POST /admin/seed-test-users — create a pair of high-compatibility test users
router.post('/seed-test-users', adminLimiter, requireAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const testEmails = ['test_a@test.local', 'test_b@test.local'];
    const cleaned = await cleanupTestUsersByEmails(testEmails);
    const idA = uuidv4();
    const idB = uuidv4();
    const now = new Date().toISOString();
    const answersA = buildHighCompatibilityTestAnswers(
      ['enfp', 'enfj', 'infj'],
      {
        q_rel_mode: { value: 'proactive' },
        q_reply_pref: { value: 5, importance: 3 },
        q37: { value: 4, importance: 2 },
        q38: { value: 4, importance: 2 },
      },
    );
    const answersB = buildHighCompatibilityTestAnswers(
      ['infj', 'intj', 'enfj'],
      {
        q_rel_mode: { value: 'prefer_partner_active' },
        q_reply_pref: { value: 4, importance: 3 },
        q37: { value: 3, importance: 2 },
        q27: { value: 6, importance: 2 },
        q_music_style: { value: ['indie', 'c_pop', 'j_pop'] },
      },
    );

    // Insert users
    await db.insert(users).values([
      {
        id: idA, email: 'test_a@test.local', nickname: '测试用户A', gender: 'male', genderPref: 'female',
        intention: 'partner', grade: '2023', campus: 'xianlin', department: '计算机科学与技术系',
        mbti: 'INFJ', bio: '这是测试用户A', wechatId: 'wechat:test_a_wx',
        isParticipating: true, profileComplete: true, surveyComplete: false, createdAt: now, updatedAt: now,
      },
      {
        id: idB, email: 'test_b@test.local', nickname: '测试用户B', gender: 'female', genderPref: 'male',
        intention: 'partner', grade: '2023', campus: 'xianlin', department: '计算机科学与技术系',
        mbti: 'ENFP', bio: '这是测试用户B', wechatId: 'wechat:test_b_wx',
        isParticipating: true, profileComplete: true, surveyComplete: false, createdAt: now, updatedAt: now,
      },
    ]);

    await submitAnswers(idA, answersA);
    await submitAnswers(idB, answersB);

    res.json({
      message: cleaned > 0 ? `已清理 ${cleaned} 个旧测试用户，并创建新版问卷测试用户` : '新版问卷测试用户创建成功',
      users: [
        { id: idA, email: 'test_a@test.local', nickname: '测试用户A' },
        { id: idB, email: 'test_b@test.local', nickname: '测试用户B' },
      ],
      nextSteps: [
        `POST /admin/trigger-matching  body: {"userIds": ["${idA}", "${idB}"]}`,
        'POST /admin/unlock-reveal',
      ],
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /admin/cleanup-test-users — remove test users and their data
router.delete('/cleanup-test-users', adminLimiter, requireAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const testEmails = ['test_a@test.local', 'test_b@test.local'];
    const deleted = await cleanupTestUsersByEmails(testEmails);

    if (deleted === 0) {
      res.json({ message: '没有找到测试用户' });
      return;
    }

    res.json({ message: `已清理 ${deleted} 个测试用户及关联数据` });
  } catch (err) {
    next(err);
  }
});

// POST /admin/impersonate/:userId — generate a JWT for any user (test only)
router.post('/impersonate/:userId', adminLimiter, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.userId as string;
    const rows = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
    if (!rows[0]) {
      res.status(404).json({ error: '用户不存在' });
      return;
    }
    // Only allow impersonating test accounts
    if (!rows[0].email.endsWith('@test.local')) {
      res.status(403).json({ error: '只能模拟测试账号（@test.local）' });
      return;
    }
    const token = jwt.sign(
      { userId: rows[0].id, email: rows[0].email },
      config.jwt.secret,
      { expiresIn: '2h' },
    );
    res.json({ token, userId: rows[0].id, email: rows[0].email });
  } catch (err) {
    next(err);
  }
});

// ─── Teamup Admin ────────────────────────────────────────────────

// GET /admin/teamups — list all teamups across circles
router.get('/teamups', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = (req.query.status as string | undefined)?.trim();
    const teamupType = (req.query.teamupType as string | undefined)?.trim();
    const circleId = (req.query.circleId as string | undefined)?.trim();
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;

    const conditions = [];
    if (status && status !== 'all') conditions.push(eq(teamups.status, status));
    if (teamupType && teamupType !== 'all') conditions.push(eq(teamups.teamupType, teamupType));
    if (circleId) conditions.push(eq(teamups.circleId, circleId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(teamups)
      .where(where);

    const rows = await db
      .select({
        id: teamups.id,
        circleId: teamups.circleId,
        circleName: circles.name,
        leaderId: teamups.leaderId,
        leaderNickname: users.nickname,
        title: teamups.title,
        descriptionPreview: teamups.descriptionPreview,
        maxMembers: teamups.maxMembers,
        currentMemberCount: teamups.currentMemberCount,
        deadlineAt: teamups.deadlineAt,
        endAt: teamups.endAt,
        teamupType: teamups.teamupType,
        joinMode: teamups.joinMode,
        isPublic: teamups.isPublic,
        status: teamups.status,
        cancelSource: teamups.cancelSource,
        cancelReason: teamups.cancelReason,
        createdAt: teamups.createdAt,
        updatedAt: teamups.updatedAt,
      })
      .from(teamups)
      .leftJoin(circles, eq(teamups.circleId, circles.id))
      .leftJoin(users, eq(teamups.leaderId, users.id))
      .where(where)
      .orderBy(desc(teamups.createdAt))
      .limit(limit)
      .offset(offset);

    const teamupIds = rows.map((row) => row.id);
    const [memberCountRows, applicationCountRows] = teamupIds.length > 0
      ? await Promise.all([
        db
          .select({
            teamupId: teamupMembers.teamupId,
            activeMemberCount: sql<number>`count(*)::int`,
          })
          .from(teamupMembers)
          .where(and(inArray(teamupMembers.teamupId, teamupIds), eq(teamupMembers.membershipStatus, 'active')))
          .groupBy(teamupMembers.teamupId),
        db
          .select({
            teamupId: teamupApplications.teamupId,
            applicationCount: sql<number>`count(*)::int`,
            pendingApplicationCount: sql<number>`count(*) FILTER (WHERE ${teamupApplications.status} = 'pending')::int`,
          })
          .from(teamupApplications)
          .where(inArray(teamupApplications.teamupId, teamupIds))
          .groupBy(teamupApplications.teamupId),
      ])
      : [[], []];

    const memberCountById = new Map(memberCountRows.map((row) => [row.teamupId, row.activeMemberCount]));
    const applicationCountById = new Map(applicationCountRows.map((row) => [row.teamupId, {
      total: row.applicationCount,
      pending: row.pendingApplicationCount,
    }]));

    res.json({
      total: totalRow?.count ?? 0,
      page,
      limit,
      teamups: rows.map((row) => ({
        ...row,
        activeMemberCount: memberCountById.get(row.id) ?? 0,
        applicationCount: applicationCountById.get(row.id)?.total ?? 0,
        pendingApplicationCount: applicationCountById.get(row.id)?.pending ?? 0,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ─── Forum Admin ─────────────────────────────────────────────────

const reviewForumReportSchema = z.object({
  action: z.enum(['approve', 'reject']),
  adminNote: z.string().max(500).optional(),
  penaltyScore: z.union([z.literal(1), z.literal(3), z.literal(5)]).optional(),
});

// GET /admin/forum/reports
router.get('/forum/reports', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const statusRaw = (req.query.status as string | undefined)?.trim();
    const status = (statusRaw && ['pending', 'approved', 'rejected', 'all'].includes(statusRaw) ? statusRaw : 'pending') as 'pending' | 'approved' | 'rejected' | 'all';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const data = await listForumReports({ status, page, limit });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// PATCH /admin/forum/reports/:id
router.patch('/forum/reports/:id', requireAdmin, validate(reviewForumReportSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reportId = req.params.id as string;
    const action = req.body.action as 'approve' | 'reject';
    const adminNote = req.body.adminNote as string | undefined;
    const penaltyScore = req.body.penaltyScore as 1 | 3 | 5 | undefined;
    const result = await reviewForumReport({ reportId, action, adminNote, penaltyScore, operatorId: null });

    await logAudit({
      action: 'review_forum_report',
      target: reportId,
      detail: {
        action,
        adminNote: adminNote || null,
        penaltyScore: result.penaltyScore ?? penaltyScore ?? null,
        creditChanged: result.creditChanged,
        creditScoreAfter: result.creditScoreAfter,
      },
      ip: getRequestIp(req),
      result: 'success',
    });

    res.json({
      message: action === 'approve' ? '举报已通过并完成信用分处理' : '举报已驳回',
      ...result,
    });
  } catch (err) {
    next(err);
  }
});
// GET /admin/forum/credit-users
router.get('/forum/credit-users', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const data = await listForumCreditUsers({ page, limit });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /admin/forum/credit-users/:userId/reports
router.get('/forum/credit-users/:userId/reports', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.userId as string;
    const data = await listForumReportsByReportedUser(userId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});
// GET /admin/forum/posts — list all posts including soft-deleted
router.get('/forum/posts', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = (req.query.status as string) || 'active';
    const circleId = (req.query.circleId as string | undefined)?.trim() || undefined;
    const type = (req.query.type as string | undefined)?.trim();
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;

    const conditions = [];
    if (status === 'active') conditions.push(isNull(forumPosts.deletedAt));
    else if (status === 'deleted') conditions.push(sql`${forumPosts.deletedAt} IS NOT NULL`);
    // status === 'all' → no filter

    if (circleId) conditions.push(eq(forumPosts.circleId, circleId));
    if (type) conditions.push(eq(forumPosts.type, type));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(forumPosts)
      .where(where);

    const rows = await db
      .select({
        id: forumPosts.id,
        title: forumPosts.title,
        type: forumPosts.type,
        circleId: forumPosts.circleId,
        visibility: forumPosts.visibility,
        isPinned: forumPosts.isPinned,
        viewCount: forumPosts.viewCount,
        deletedAt: forumPosts.deletedAt,
        createdAt: forumPosts.createdAt,
        author: {
          userId: users.id,
          nickname: users.nickname,
        },
      })
      .from(forumPosts)
      .innerJoin(users, eq(forumPosts.userId, users.id))
      .where(where)
      .orderBy(desc(forumPosts.createdAt))
      .limit(limit)
      .offset(offset);

    const posts = rows.map((r) => ({
      postId: r.id,
      title: r.title,
      type: r.type,
      circleId: r.circleId,
      visibility: r.visibility,
      author: r.author,
      isPinned: r.isPinned,
      viewCount: r.viewCount,
      deletedAt: r.deletedAt,
      createdAt: r.createdAt,
    }));

    res.json({ total: totalRow?.count ?? 0, page, limit, posts });
  } catch (err) {
    next(err);
  }
});

// DELETE /admin/forum/posts/:postId — admin force delete (soft)
router.delete('/forum/posts/:postId', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const postId = req.params.postId as string;
    const [post] = await db
      .select({ id: forumPosts.id, deletedAt: forumPosts.deletedAt, visibility: forumPosts.visibility })
      .from(forumPosts)
      .where(eq(forumPosts.id, postId))
      .limit(1);

    if (!post) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: '帖子不存在' } });
      return;
    }
    if (post.deletedAt) {
      res.status(400).json({ error: { code: 'CONFLICT', message: '帖子已被删除' } });
      return;
    }
    if (post.visibility === 'private') {
      res.status(400).json({ error: { code: 'CONFLICT', message: '私密帖子不支持下线操作' } });
      return;
    }

    await db
      .update(forumPosts)
      .set({ deletedAt: sql`NOW()` })
      .where(eq(forumPosts.id, postId));

    await logAudit({
      action: 'admin_delete_forum_post',
      detail: { postId },
      ip: getRequestIp(req),
      result: 'success',
    });

    res.json({ message: '帖子已下线' });
  } catch (err) {
    next(err);
  }
});

// PUT /admin/forum/posts/:postId/pin — toggle pin
router.put('/forum/posts/:postId/pin', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const postId = req.params.postId as string;
    const isPinned = Boolean(req.body.isPinned);

    const [post] = await db
      .select({ id: forumPosts.id, deletedAt: forumPosts.deletedAt, visibility: forumPosts.visibility })
      .from(forumPosts)
      .where(eq(forumPosts.id, postId))
      .limit(1);

    if (!post) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: '帖子不存在' } });
      return;
    }
    if (post.deletedAt) {
      res.status(400).json({ error: { code: 'CONFLICT', message: '已删除帖子不支持置顶操作' } });
      return;
    }
    if (post.visibility === 'private') {
      res.status(400).json({ error: { code: 'CONFLICT', message: '私密帖子不支持置顶操作' } });
      return;
    }

    await db
      .update(forumPosts)
      .set({ isPinned })
      .where(eq(forumPosts.id, postId));

    await logAudit({
      action: 'admin_toggle_forum_pin',
      detail: { postId, isPinned },
      ip: getRequestIp(req),
      result: 'success',
    });

    res.json({ message: '帖子置顶状态已更新', postId, isPinned });
  } catch (err) {
    next(err);
  }
});

// ─── Forum Announcements Admin ───────────────────────────────────

// GET /admin/forum/announcements — list all announcements (including inactive)
router.get('/forum/announcements', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;
    const isActive = req.query.isActive as string | undefined;

    const conditions = [];
    if (isActive === 'true') conditions.push(eq(forumAnnouncements.isActive, true));
    else if (isActive === 'false') conditions.push(eq(forumAnnouncements.isActive, false));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRow] = await db
      .select({ count: count() })
      .from(forumAnnouncements)
      .where(where);

    const rows = await db
      .select()
      .from(forumAnnouncements)
      .where(where)
      .orderBy(desc(forumAnnouncements.priority), desc(forumAnnouncements.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({ total: totalRow.count, page, limit, announcements: rows });
  } catch (err) {
    next(err);
  }
});

// POST /admin/forum/announcements — create announcement
router.post('/forum/announcements', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, content, isActive, priority, startsAt, endsAt } = req.body;

    if (!title?.trim() || !content?.trim()) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '标题和内容不能为空' } });
      return;
    }

    const id = uuidv4();
    await db.insert(forumAnnouncements).values({
      id,
      title: title.trim(),
      content: content.trim(),
      createdBy: (req as any).adminUserId ?? null,
      isActive: isActive ?? true,
      priority: priority ?? 0,
      startsAt: startsAt ?? null,
      endsAt: endsAt ?? null,
    });

    await logAudit({
      action: 'admin_create_announcement',
      detail: { announcementId: id, title: title.trim() },
      ip: getRequestIp(req),
      result: 'success',
    });

    res.status(201).json({ announcementId: id, message: '公告已发布' });
  } catch (err) {
    next(err);
  }
});

// PATCH /admin/forum/announcements/:id — update announcement
router.patch('/forum/announcements/:id', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const announcementId = req.params.id as string;
    const [existing] = await db
      .select({ id: forumAnnouncements.id })
      .from(forumAnnouncements)
      .where(eq(forumAnnouncements.id, announcementId))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: '公告不存在' } });
      return;
    }

    const updates: Record<string, unknown> = {};
    const { title, content, isActive, priority, startsAt, endsAt } = req.body;
    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;
    if (isActive !== undefined) updates.isActive = isActive;
    if (priority !== undefined) updates.priority = priority;
    if (startsAt !== undefined) updates.startsAt = startsAt;
    if (endsAt !== undefined) updates.endsAt = endsAt;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '没有要更新的字段' } });
      return;
    }

    await db
      .update(forumAnnouncements)
      .set(updates as any)
      .where(eq(forumAnnouncements.id, announcementId));

    await logAudit({
      action: 'admin_update_announcement',
      detail: { announcementId, ...updates },
      ip: getRequestIp(req),
      result: 'success',
    });

    res.json({ message: '公告已更新', announcementId });
  } catch (err) {
    next(err);
  }
});

// DELETE /admin/forum/announcements/:id — delete announcement
router.delete('/forum/announcements/:id', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const announcementId = req.params.id as string;
    const [existing] = await db
      .select({ id: forumAnnouncements.id })
      .from(forumAnnouncements)
      .where(eq(forumAnnouncements.id, announcementId))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: '公告不存在' } });
      return;
    }

    await db
      .delete(forumAnnouncements)
      .where(eq(forumAnnouncements.id, announcementId));

    await logAudit({
      action: 'admin_delete_announcement',
      detail: { announcementId },
      ip: getRequestIp(req),
      result: 'success',
    });

    res.json({ message: '公告已删除' });
  } catch (err) {
    next(err);
  }
});

// ─── Forum Guestbook Admin ───────────────────────────────────────

// GET /admin/forum/guestbook/messages — list all guestbook messages (including hidden)
router.get('/forum/guestbook/messages', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;
    const status = req.query.status as string | undefined;

    const conditions = [];
    if (status === 'visible') conditions.push(eq(forumGuestbookMessages.status, 'visible'));
    else if (status === 'hidden') conditions.push(eq(forumGuestbookMessages.status, 'hidden'));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRow] = await db
      .select({ count: count() })
      .from(forumGuestbookMessages)
      .where(where);

    const rows = await db
      .select({
        id: forumGuestbookMessages.id,
        content: forumGuestbookMessages.content,
        status: forumGuestbookMessages.status,
        createdAt: forumGuestbookMessages.createdAt,
        authorUserId: forumGuestbookMessages.userId,
        author: {
          userId: users.id,
          nickname: users.nickname,
        },
      })
      .from(forumGuestbookMessages)
      .innerJoin(users, eq(forumGuestbookMessages.userId, users.id))
      .where(where)
      .orderBy(desc(forumGuestbookMessages.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({ total: totalRow.count, page, limit, messages: rows });
  } catch (err) {
    next(err);
  }
});

// DELETE /admin/forum/guestbook/messages/:id — hide guestbook message
router.delete('/forum/guestbook/messages/:id', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const messageId = req.params.id as string;
    const [existing] = await db
      .select({ id: forumGuestbookMessages.id, status: forumGuestbookMessages.status })
      .from(forumGuestbookMessages)
      .where(eq(forumGuestbookMessages.id, messageId))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: '留言不存在' } });
      return;
    }
    if (existing.status === 'hidden') {
      res.status(400).json({ error: { code: 'CONFLICT', message: '留言已被隐藏' } });
      return;
    }

    await db
      .update(forumGuestbookMessages)
      .set({ status: 'hidden' })
      .where(eq(forumGuestbookMessages.id, messageId));

    await logAudit({
      action: 'admin_hide_guestbook_message',
      detail: { messageId },
      ip: getRequestIp(req),
      result: 'success',
    });

    res.json({ message: '留言已隐藏' });
  } catch (err) {
    next(err);
  }
});

// ─── Audit Logs ──────────────────────────────────────────────────

// GET /admin/audit-logs — query audit trail
router.get('/audit-logs', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const action = (req.query.action as string | undefined)?.trim();
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;

    const conditions = [];
    if (action) conditions.push(eq(auditLogs.action, action));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(where);

    const rows = await db
      .select()
      .from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const logs = rows.map((r) => ({
      id: r.id,
      operatorId: r.operatorId,
      action: r.action,
      target: r.target,
      detail: r.detail,
      ip: r.ip,
      result: r.result,
      createdAt: r.createdAt,
    }));

    // Distinct actions for filter dropdown
    const actionRows = await db
      .selectDistinct({ action: auditLogs.action })
      .from(auditLogs)
      .orderBy(auditLogs.action);

    res.json({
      total: totalRow?.count ?? 0,
      page,
      limit,
      logs,
      actions: actionRows.map((r) => r.action),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
