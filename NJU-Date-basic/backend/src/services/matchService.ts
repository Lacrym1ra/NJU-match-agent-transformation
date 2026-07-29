import { v4 as uuid } from 'uuid';
import { eq, and, or, inArray, gte, gt, lt, isNull, count, ne } from 'drizzle-orm';
import { db, queryClient } from '../db/connection.js';
import { users, surveyAnswers, matches, mailLogs } from '../db/schema.js';
import { partitionIntoPools } from '../matching/pools.js';
import { passesDealbreakerFilter } from '../matching/dealbreakers.js';
import { calculateCompatibility } from '../matching/compatibility.js';
import { greedyMaxWeightMatching } from '../matching/galeShapley.js';
import { generateCuratorNote } from './aiService.js';
import { ConflictError } from '../utils/errors.js';
import { createNotification, buildIdempotencyKey } from './notificationService.js';

/** Pairs scoring below this are not matched — quality over quantity. */
const MIN_MATCH_SCORE = 0.55;
import { sendMatchRevealedEmail, sendMutualMatchEmail, sendSurveyReminderEmail, sendPromoEmail, sendAutoPauseNotification, sendMatchExpirationWarning, sendPermanentSleepNotification, sendOutdatedSurveyReminderEmail, isDeletedAccountEmail } from '../utils/email.js';

interface MatchStats {
  totalParticipants: number;
  matchedPairs: number;
  unmatched: number;
  matchRate: number;
  avgCompatibilityScore: number;
  weightLoss: number;
}

type MailType = 'SURVEY_REMINDER' | 'SURVEY_OUTDATED_REMINDER' | 'MATCH_REVEALED' | 'MATCH_MUTUAL' | 'PROMO_EVENT_1' | 'PROMO_EVENT_RESEND_MATCHED';

const LATEST_SURVEY_VERSION = '4.0';

type EmailCandidate = {
  email?: string | null;
  emailNotifications?: boolean | null;
};

type EligibleParticipant = {
  id: string;
  gender: string;
  genderPref: string;
  intention?: string | null;
  department?: string | null;
  campus?: string | null;
  grade?: string | null;
  mbti?: string | null;
  createdAt?: string | null;
};

type HistoricalMatchRow = {
  weekOf: string;
  userAId: string;
  userBId: string;
  status: string;
  userAAction: string | null;
  userBAction: string | null;
};

type MatchPriorityProfile = {
  noMatchStreak: number;
  disengagementStreak: number;
};

const NO_MATCH_BOOST_PER_WEEK = 0.02;
const MAX_NO_MATCH_BOOST_WEEKS = 4;
const DISENGAGEMENT_PENALTY_PER_EVENT = 0.05;
const FREE_DISENGAGEMENT_EVENTS = 1;
const MAX_PENALIZED_DISENGAGEMENT_EVENTS = 3;

function canEmailUser(user?: EmailCandidate | null): user is EmailCandidate & { email: string; emailNotifications: true } {
  return !!user?.emailNotifications && typeof user.email === 'string' && !isDeletedAccountEmail(user.email);
}

function datePart(value?: string | null): string | null {
  return typeof value === 'string' && value.length >= 10 ? value.slice(0, 10) : null;
}

function latestDatePart(...values: Array<string | null | undefined>): string | null {
  const dates = values
    .map(datePart)
    .filter((value): value is string => typeof value === 'string');
  if (dates.length === 0) return null;
  dates.sort();
  return dates[dates.length - 1]!;
}

function ownAction(match: HistoricalMatchRow, userId: string): string | null {
  if (match.userAId === userId) return match.userAAction;
  if (match.userBId === userId) return match.userBAction;
  return null;
}

function isDisengagementOutcome(match: HistoricalMatchRow, userId: string): boolean {
  const action = ownAction(match, userId);
  return action === 'REJECT' || (match.status === 'EXPIRED' && !action);
}

function buildPriorityProfiles(
  eligible: EligibleParticipant[],
  historicalMatches: HistoricalMatchRow[],
  pastWeeks: string[],
  surveySubmittedAtByUser: Map<string, string>,
): Map<string, MatchPriorityProfile> {
  const matchesByUser = new Map<string, HistoricalMatchRow[]>();
  for (const match of historicalMatches) {
    for (const userId of [match.userAId, match.userBId]) {
      if (!matchesByUser.has(userId)) matchesByUser.set(userId, []);
      matchesByUser.get(userId)!.push(match);
    }
  }

  for (const rows of matchesByUser.values()) {
    rows.sort((a, b) => b.weekOf.localeCompare(a.weekOf));
  }

  const profiles = new Map<string, MatchPriorityProfile>();
  for (const user of eligible) {
    const userMatches = matchesByUser.get(user.id) ?? [];
    const matchedWeeks = new Set(userMatches.map((match) => match.weekOf));
    const eligibleSince = latestDatePart(user.createdAt, surveySubmittedAtByUser.get(user.id));

    let noMatchStreak = 0;
    for (const week of pastWeeks) {
      if (eligibleSince && week < eligibleSince) break;
      if (matchedWeeks.has(week)) break;
      noMatchStreak++;
    }

    let disengagementStreak = 0;
    for (const match of userMatches) {
      if (isDisengagementOutcome(match, user.id)) {
        disengagementStreak++;
        continue;
      }
      break;
    }

    profiles.set(user.id, { noMatchStreak, disengagementStreak });
  }

  return profiles;
}

function selectionScoreWithPriority(
  rawScore: number,
  aProfile?: MatchPriorityProfile,
  bProfile?: MatchPriorityProfile,
): number {
  // Keep hard quality gates outside this function; this only reorders viable pairs.
  const noMatchBoost =
    Math.min(aProfile?.noMatchStreak ?? 0, MAX_NO_MATCH_BOOST_WEEKS) * NO_MATCH_BOOST_PER_WEEK +
    Math.min(bProfile?.noMatchStreak ?? 0, MAX_NO_MATCH_BOOST_WEEKS) * NO_MATCH_BOOST_PER_WEEK;
  // One decline can be a normal preference signal. Repeated declines/no-replies reduce priority.
  const disengagementPenalty =
    Math.min(
      Math.max((aProfile?.disengagementStreak ?? 0) - FREE_DISENGAGEMENT_EVENTS, 0),
      MAX_PENALIZED_DISENGAGEMENT_EVENTS,
    ) * DISENGAGEMENT_PENALTY_PER_EVENT +
    Math.min(
      Math.max((bProfile?.disengagementStreak ?? 0) - FREE_DISENGAGEMENT_EVENTS, 0),
      MAX_PENALIZED_DISENGAGEMENT_EVENTS,
    ) * DISENGAGEMENT_PENALTY_PER_EVENT;

  return Math.max(0.01, Math.min(1, rawScore + noMatchBoost - disengagementPenalty));
}

export async function resendPromoToMatchedBatch(): Promise<{ targeted: number; sent: number; skipped: number; failed: number }> {
  // Query users who have at least one match record
  const matchedUserRows = await queryClient.unsafe(`
    SELECT DISTINCT u.id, u.email, u.email_notifications as "emailNotifications"
    FROM users u
    JOIN matches m ON (m.user_a_id = u.id OR m.user_b_id = u.id)
    WHERE u.survey_complete = true
  `) as Array<{ id: string; email: string; emailNotifications: boolean }>;
  const matchedUsers = matchedUserRows.filter((u) => !isDeletedAccountEmail(u.email));

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const eventWeek = 'EVENT_36H_RESEND';

  for (const user of matchedUsers) {
    if (!canEmailUser(user)) {
      skipped += 1;
      continue;
    }
    const result = await sendMailOnce(user.id, eventWeek, 'PROMO_EVENT_RESEND_MATCHED', () =>
      sendPromoEmail(user.email)
    );
    if (result === 'sent') sent += 1;
    if (result === 'skipped') skipped += 1;
    if (result === 'failed') failed += 1;
  }

  return { targeted: matchedUsers.length, sent, skipped, failed };
}

interface ReminderStats {
  weekOf: string;
  targeted: number;
  sent: number;
  skipped: number;
  failed: number;
}

export interface SurveyUpdateCandidate {
  id: string;
  email: string;
  emailNotifications: boolean;
}

export interface SurveyUpdateStats {
  total: number;
  withEmailEnabled: number;
  sent: number;
  skipped: number;
  failed: number;
}

export async function listSurveyUpdateCandidates(): Promise<SurveyUpdateCandidate[]> {
  const candidates = await db
    .select({ id: users.id, email: users.email, emailNotifications: users.emailNotifications })
    .from(users)
    .innerJoin(surveyAnswers, eq(users.id, surveyAnswers.userId))
    .where(and(
      ne(surveyAnswers.version, LATEST_SURVEY_VERSION),
      eq(users.surveyComplete, true),
      eq(users.isParticipating, true)
    ));

  return candidates.filter((u) => !isDeletedAccountEmail(u.email));
}

export async function sendOutdatedSurveyReminderBatch(): Promise<SurveyUpdateStats> {
  const weekOf = getUpcomingWeekOf();
  const candidates = await listSurveyUpdateCandidates();

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  const targets = candidates.filter(canEmailUser);
  skipped += candidates.length - targets.length;

  const targetIds = targets.map((u) => u.id);
  const reminderCounts = targetIds.length > 0
    ? await db
      .select({ userId: mailLogs.userId, total: count() })
      .from(mailLogs)
      .where(and(inArray(mailLogs.userId, targetIds), eq(mailLogs.mailType, 'SURVEY_OUTDATED_REMINDER')))
      .groupBy(mailLogs.userId)
    : [];
  const reminderCountMap = new Map(reminderCounts.map((r) => [r.userId, r.total]));
  const eligibleTargets = targets.filter((u) => (reminderCountMap.get(u.id) ?? 0) < 2);
  skipped += targets.length - eligibleTargets.length;

  const BATCH_SIZE = 10;
  for (let i = 0; i < eligibleTargets.length; i += BATCH_SIZE) {
    const batch = eligibleTargets.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map((u) =>
      sendMailOnce(u.id, weekOf, 'SURVEY_OUTDATED_REMINDER', () =>
        sendOutdatedSurveyReminderEmail(u.email, weekOf),
      ),
    ));

    for (const result of results) {
      if (result === 'sent') sent += 1;
      if (result === 'skipped') skipped += 1;
      if (result === 'failed') failed += 1;
    }

    if (i + BATCH_SIZE < eligibleTargets.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return {
    total: candidates.length,
    withEmailEnabled: targets.length,
    sent,
    skipped,
    failed,
  };
}

export function getUpcomingWeekOf(): string {
  const now = new Date();
  const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const day = shifted.getUTCDay(); // 0=Sun, 3=Wed
  const hour = shifted.getUTCHours();
  let diff = day <= 3 ? 3 - day : 10 - day;
  if (day === 3 && hour >= 20) {
    diff = 7;
  }
  const wednesday = new Date(shifted.getTime());
  wednesday.setUTCDate(shifted.getUTCDate() + diff);
  const yyyy = wednesday.getUTCFullYear();
  const mm = String(wednesday.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(wednesday.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getBeijingDateParts(now = new Date()): { year: number; month: number; day: number } {
  const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function toUtcIsoFromBeijing(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
  second = 0,
): string {
  return new Date(Date.UTC(year, month - 1, day, hour - 8, minute, second)).toISOString();
}

async function sendMailOnce(
  userId: string,
  weekOf: string,
  mailType: MailType,
  sender: () => Promise<void>,
): Promise<'sent' | 'skipped' | 'failed'> {
  const inserted = await db
    .insert(mailLogs)
    .values({ userId, weekOf, mailType })
    .onConflictDoNothing()
    .returning({ id: mailLogs.id });

  if (inserted.length === 0) {
    return 'skipped';
  }

  try {
    await sender();
    return 'sent';
  } catch (err) {
    await db.delete(mailLogs).where(and(
      eq(mailLogs.userId, userId),
      eq(mailLogs.weekOf, weekOf),
      eq(mailLogs.mailType, mailType),
    ));
    console.error(`[MAIL] ${mailType} failed for ${userId}:`, err);
    return 'failed';
  }
}

/**
 * Get the current Wednesday date string (YYYY-MM-DD).
 * If today is before Wednesday, use last Wednesday.
 * If today is Wednesday or after, use this Wednesday.
 */
export function getCurrentWeekOf(): string {
  const now = new Date();
  const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const day = shifted.getUTCDay(); // 0=Sun, 3=Wed
  const diff = day >= 3 ? day - 3 : day + 4; // days since last Wednesday
  const wednesday = new Date(shifted.getTime());
  wednesday.setUTCDate(shifted.getUTCDate() - diff);
  const yyyy = wednesday.getUTCFullYear();
  const mm = String(wednesday.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(wednesday.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Run the full matching pipeline.
 * @param testUserIds If provided, only run matching between these user IDs (test mode).
 *                    Skips the "already matched this week" guard so it can run alongside real users.
 */
export async function runMatchingPipeline(testUserIds?: string[]): Promise<MatchStats> {
  const weekOf = getCurrentWeekOf();
  const isTestRun = Array.isArray(testUserIds) && testUserIds.length > 0;
  console.log(`Running matching pipeline for week of ${weekOf}${isTestRun ? ` [TEST: ${testUserIds!.length} users]` : ''}...`);

  // 1. Fetch eligible participants
  const eligibleRows = await db
    .select({
      id: users.id,
      gender: users.gender,
      genderPref: users.genderPref,
      intention: users.intention,
      department: users.department,
      campus: users.campus,
      grade: users.grade,
      mbti: users.mbti,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(
      and(
        eq(users.isParticipating, true),
        eq(users.profileComplete, true),
        eq(users.surveyComplete, true),
        gt(users.creditScore, 90),
        // 未设置暂停 或 暂停周已过期
        or(isNull(users.pauseUntilWeek), lt(users.pauseUntilWeek, weekOf)),
      ),
    );

  let eligible = eligibleRows.filter((u) => u.gender && u.genderPref) as EligibleParticipant[];

  // In test mode: restrict to the specified user IDs only
  if (isTestRun) {
    const idSet = new Set(testUserIds);
    eligible = eligible.filter((u) => idSet.has(u.id));
    console.log(`[TEST] Filtered to ${eligible.length} eligible test participants`);
  }

  console.log(`Found ${eligible.length} eligible participants`);

  // Check if weekly mainline matches already exist for this week.
  // Heartbox can create current-week matches before the Wednesday 18:00 pipeline;
  // those must not make the weekly matching job skip the normal batch.
  if (!isTestRun) {
    const existingRows = await db
      .select()
      .from(matches)
      .where(and(
        eq(matches.weekOf, weekOf),
        eq(matches.source, 'weekly'),
      ))
      .limit(1);
    if (existingRows[0]) {
      console.log(`Weekly matches for week ${weekOf} already exist, skipping.`);
      return { totalParticipants: eligible.length, matchedPairs: 0, unmatched: eligible.length, matchRate: 0, avgCompatibilityScore: 0, weightLoss: 0 };
    }
  }

  // 2. Load all survey answers (only v4.0 eligible for matching)
  const REQUIRED_SURVEY_VERSION = '4.0';
  const allAnswers = new Map<string, Record<string, { value: unknown; importance?: number }>>();
  const v4UserIds = new Set<string>();
  const surveySubmittedAtByUser = new Map<string, string>();
  const answerRows = await db.select().from(surveyAnswers);
  for (const row of answerRows) {
    if (row.version === REQUIRED_SURVEY_VERSION) {
      allAnswers.set(row.userId, JSON.parse(row.answers));
      v4UserIds.add(row.userId);
      if (row.submittedAt) surveySubmittedAtByUser.set(row.userId, row.submittedAt);
    }
  }

  // Filter eligible users to only those who completed v4.0 survey
  eligible = eligible.filter((u) => v4UserIds.has(u.id));
  console.log(`After v4.0 filter: ${eligible.length} eligible participants`);

  // 2b. Build set of previously-matched pairs so they won't be matched again
  const eligibleIds = eligible.map((u) => u.id);
  const historicalMatches = eligibleIds.length > 0
    ? await db
      .select({
        weekOf: matches.weekOf,
        userAId: matches.userAId,
        userBId: matches.userBId,
        status: matches.status,
        userAAction: matches.userAAction,
        userBAction: matches.userBAction,
      })
      .from(matches)
      .where(and(
        or(inArray(matches.userAId, eligibleIds), inArray(matches.userBId, eligibleIds)),
        ne(matches.weekOf, weekOf),
      ))
    : [];
  const pastWeekRows = await db
    .selectDistinct({ weekOf: matches.weekOf })
    .from(matches)
    .where(ne(matches.weekOf, weekOf));
  const pastWeeks = pastWeekRows.map((row) => row.weekOf).sort((a, b) => b.localeCompare(a));
  const priorityProfiles = buildPriorityProfiles(eligible, historicalMatches, pastWeeks, surveySubmittedAtByUser);
  const previouslyMatchedPairs = new Set<string>(
    historicalMatches.map(({ userAId, userBId }) =>
      [userAId, userBId].sort().join(':'),
    ),
  );

  // 3. Split by intention, then partition into gender pools
  const intentionGroups = new Map<'friend' | 'partner', typeof eligible>();
  for (const user of eligible) {
    const intention = (user.intention === 'friend' ? 'friend' : 'partner') as 'friend' | 'partner';
    if (!intentionGroups.has(intention)) intentionGroups.set(intention, []);
    intentionGroups.get(intention)!.push(user);
  }

  let totalMatchedPairs = 0;
  let totalScore = 0;
  let totalWeightLoss = 0;
  const matchedUserIds = new Set<string>();

  for (const [intention, intentionEligible] of intentionGroups) {
    const pools = partitionIntoPools(intentionEligible);
    // Process larger pools first for better global outcome with 'any' pref users
    pools.sort((a, b) => (b.groupA.length + b.groupB.length) - (a.groupA.length + a.groupB.length));
    console.log(`[${intention}] Created ${pools.length} pools from ${intentionEligible.length} users`);

    for (const pool of pools) {
      const { groupA, groupB } = pool;

      // 4. Filter by dealbreakers and compute compatibility scores
      const rawScores = new Map<string, number>();
      const selectionScores = new Map<string, number>();
      const dimensionData = new Map<string, Record<string, number>>();
      const insightsData = new Map<string, { sharedInterests: string[]; insights: Record<string, unknown> }>();

      for (const a of groupA) {
        const aAnswers = allAnswers.get(a.id);
        if (!aAnswers) continue;

        for (const b of groupB) {
          if (a.id === b.id) continue;
          if (matchedUserIds.has(a.id) || matchedUserIds.has(b.id)) continue;
          if (previouslyMatchedPairs.has([a.id, b.id].sort().join(':'))) continue;

          const bAnswers = allAnswers.get(b.id);
          if (!bAnswers) continue;

          // Dealbreaker check (relaxed for friend matching)
          const aWithAnswers = { ...a, answers: aAnswers as Record<string, { value: number | string | string[]; importance?: number }> };
          const bWithAnswers = { ...b, answers: bAnswers as Record<string, { value: number | string | string[]; importance?: number }> };

          if (!passesDealbreakerFilter(aWithAnswers, bWithAnswers, intention)) continue;

          // Compatibility scoring (weights differ by intention)
          const result = calculateCompatibility(
            aAnswers as Record<string, { value: number | string | string[]; importance?: number }>,
            bAnswers as Record<string, { value: number | string | string[]; importance?: number }>,
            {
              aDepartment: a.department,
              bDepartment: b.department,
              aCampus: a.campus,
              bCampus: b.campus,
              aMbti: a.mbti,
              bMbti: b.mbti,
              intention,
            },
          );

          const key = `${a.id}:${b.id}`;
          rawScores.set(key, result.score);
          if (result.score >= MIN_MATCH_SCORE) {
            selectionScores.set(
              key,
              selectionScoreWithPriority(result.score, priorityProfiles.get(a.id), priorityProfiles.get(b.id)),
            );
          }
          dimensionData.set(key, result.dimensions);
          insightsData.set(key, { sharedInterests: result.sharedInterests, insights: result.insights });
        }
      }

      // 5. Run matching with minimum score threshold
      const proposerIds = groupA.map((p) => p.id).filter((id) => !matchedUserIds.has(id));
      const receiverIds = groupB.map((p) => p.id).filter((id) => !matchedUserIds.has(id));

      const { pairs, stats: poolStats } = greedyMaxWeightMatching(proposerIds, receiverIds, selectionScores, 0);
      totalWeightLoss += poolStats.weightLoss;

      // 6. Generate curator notes concurrently (batch of 10) then store matches
      const validPairs = pairs
        .map((pair) => {
          const key = `${pair.proposerId}:${pair.receiverId}`;
          return { ...pair, selectionScore: pair.score, score: rawScores.get(key) ?? pair.score };
        })
        .filter((p) => p.score > 0);
      for (const pair of validPairs) {
        matchedUserIds.add(pair.proposerId);
        matchedUserIds.add(pair.receiverId);
        totalScore += pair.score;
      }

      // Concurrently generate all curator notes for this pool (max 10 in parallel)
      const CONCURRENCY = 10;
      const curatorNotes: string[] = new Array(validPairs.length);
      for (let i = 0; i < validPairs.length; i += CONCURRENCY) {
        const batch = validPairs.slice(i, i + CONCURRENCY);
        const results = await Promise.allSettled(
          batch.map((pair) => {
            const aAnswers = allAnswers.get(pair.proposerId) ?? {};
            const bAnswers = allAnswers.get(pair.receiverId) ?? {};
            const extra = insightsData.get(`${pair.proposerId}:${pair.receiverId}`);
            const aUser = eligible.find((u) => u.id === pair.proposerId);
            const bUser = eligible.find((u) => u.id === pair.receiverId);
            return generateCuratorNote(
              aAnswers as Record<string, { value: unknown }>,
              bAnswers as Record<string, { value: unknown }>,
              pair.score,
              {
                sharedInterests: extra?.sharedInterests ?? [],
                aCampus: aUser?.campus,
                bCampus: bUser?.campus,
                intention,
              },
            );
          }),
        );
        results.forEach((result, j) => {
          curatorNotes[i + j] = result.status === 'fulfilled'
            ? result.value
            : (intention === 'friend' ? '志趣相投的朋友，值得一起探索。' : '你们的故事即将开始，让我们拭目以待。');
        });
      }

      // Insert all matches for this pool
      for (let i = 0; i < validPairs.length; i++) {
        const pair = validPairs[i];
        const key = `${pair.proposerId}:${pair.receiverId}`;
        const dims = dimensionData.get(key) ?? {};
        const extra = insightsData.get(key);

        await db.insert(matches)
          .values({
            id: uuid(),
            weekOf,
            userAId: pair.proposerId,
            userBId: pair.receiverId,
            score: pair.score,
            dimensions: JSON.stringify({
              ...dims,
              _sharedInterests: extra?.sharedInterests ?? [],
              _insights: extra?.insights ?? {},
              _intention: intention,
            }),
            curatorNote: curatorNotes[i],
            status: 'LOCKED',
          });

        totalMatchedPairs++;
      }
    }
  }

  console.log(`Matching complete: ${totalMatchedPairs} pairs from ${eligible.length} participants`);

  return {
    totalParticipants: eligible.length,
    matchedPairs: totalMatchedPairs,
    unmatched: eligible.length - totalMatchedPairs * 2,
    matchRate: eligible.length > 0 ? (totalMatchedPairs * 2) / eligible.length : 0,
    avgCompatibilityScore: totalMatchedPairs > 0
      ? Math.round((totalScore / totalMatchedPairs) * 100) / 100
      : 0,
    weightLoss: Math.round(totalWeightLoss * 100) / 100,
  };
}

export async function sendMatchRevealedNotificationsForWeek(weekOf: string) {
  const revealedMatches = await db
    .select({
      userAId: matches.userAId,
      userBId: matches.userBId,
      weekOf: matches.weekOf,
    })
    .from(matches)
    .where(and(eq(matches.weekOf, weekOf), eq(matches.status, 'REVEALED')));

  if (revealedMatches.length === 0) return;

  const userIds = Array.from(new Set(revealedMatches.flatMap((m) => [m.userAId, m.userBId])));
  const userRows = await db
    .select({ id: users.id, email: users.email, emailNotifications: users.emailNotifications })
    .from(users)
    .where(inArray(users.id, userIds));

  const userMap = new Map(userRows.map((row) => [row.id, row]));

  for (const match of revealedMatches) {
    for (const userId of [match.userAId, match.userBId]) {
      const user = userMap.get(userId);
      if (!canEmailUser(user)) continue;
      await sendMailOnce(user.id, match.weekOf, 'MATCH_REVEALED', () =>
        sendMatchRevealedEmail(user.email, match.weekOf),
      );
    }
  }
}

async function sendMutualNotificationsForMatch(matchId: string) {
  const rows = await db
    .select({
      id: matches.id,
      weekOf: matches.weekOf,
      status: matches.status,
      userAId: matches.userAId,
      userBId: matches.userBId,
    })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  const match = rows[0];
  if (!match || match.status !== 'MUTUAL') return;

  const userRows = await db
    .select({ id: users.id, email: users.email, emailNotifications: users.emailNotifications })
    .from(users)
    .where(inArray(users.id, [match.userAId, match.userBId]));

  for (const user of userRows) {
    if (!canEmailUser(user)) continue;
    await sendMailOnce(user.id, match.weekOf, 'MATCH_MUTUAL', () =>
      sendMutualMatchEmail(user.email, match.weekOf),
    );
  }
}

export async function sendPendingSurveyReminderBatch(batch: 'main' | 'late'): Promise<ReminderStats> {
  const weekOf = getUpcomingWeekOf();
  const beijing = getBeijingDateParts();
  const dayStart = toUtcIsoFromBeijing(beijing.year, beijing.month, beijing.day, 0, 0, 0);
  // late 批次（周三 12:00 运行）目标是周二注册的用户：昨天 00:00 ~ 今天 00:00
  const yesterdayStart = toUtcIsoFromBeijing(beijing.year, beijing.month, beijing.day - 1, 0, 0, 0);

  const whereClause = batch === 'main'
    ? and(eq(users.surveyComplete, false), lt(users.createdAt, dayStart))
    : and(eq(users.surveyComplete, false), gte(users.createdAt, yesterdayStart), lt(users.createdAt, dayStart));

  const candidateRows = await db
    .select({ id: users.id, email: users.email, emailNotifications: users.emailNotifications })
    .from(users)
    .where(whereClause);
  const candidates = candidateRows.filter((u) => !isDeletedAccountEmail(u.email));

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  // 统计每个候选人已收到的问卷提醒次数，超过 2 次不再发送
  const candidateIds = candidates.map((u) => u.id);
  const reminderCounts = candidateIds.length > 0
    ? await db
      .select({ userId: mailLogs.userId, total: count() })
      .from(mailLogs)
      .where(and(inArray(mailLogs.userId, candidateIds), eq(mailLogs.mailType, 'SURVEY_REMINDER')))
      .groupBy(mailLogs.userId)
    : [];
  const reminderCountMap = new Map(reminderCounts.map((r) => [r.userId, r.total]));

  for (const user of candidates) {
    if (!canEmailUser(user)) { skipped += 1; continue; }
    if ((reminderCountMap.get(user.id) ?? 0) >= 2) { skipped += 1; continue; }
    const result = await sendMailOnce(user.id, weekOf, 'SURVEY_REMINDER', () =>
      sendSurveyReminderEmail(user.email, weekOf),
    );
    if (result === 'sent') sent += 1;
    if (result === 'skipped') skipped += 1;
    if (result === 'failed') failed += 1;
  }

  return {
    weekOf,
    targeted: candidates.length,
    sent,
    skipped,
    failed,
  };
}

/**
 * Unlock all LOCKED matches for the current week → REVEALED.
 */
export async function unlockCurrentWeekMatches(): Promise<number> {
  const weekOf = getCurrentWeekOf();
  const now = new Date().toISOString();

  const unlockedRows = await db
    .update(matches)
    .set({ status: 'REVEALED', revealedAt: now })
    .where(and(eq(matches.weekOf, weekOf), eq(matches.status, 'LOCKED')))
    .returning({ id: matches.id, weekOf: matches.weekOf });

  if (unlockedRows.length > 0) {
    try {
      await sendMatchRevealedNotificationsForWeek(weekOf);
    } catch (err) {
      console.error('[MAIL] match revealed notifications failed:', err);
    }

    // ── 站内通知：match_revealed / match_no_result ──
    try {
      // 获取刚揭晓的匹配的双方用户 ID
      const revealedMatches = await db.select({
        userAId: matches.userAId,
        userBId: matches.userBId,
      }).from(matches)
        .where(and(eq(matches.weekOf, weekOf), eq(matches.status, 'REVEALED')));

      const revealedUserIds = new Set<string>();
      for (const m of revealedMatches) {
        revealedUserIds.add(m.userAId);
        revealedUserIds.add(m.userBId);
      }

      // 有匹配的用户 → match_revealed
      for (const uid of revealedUserIds) {
        await createNotification({
          userId: uid,
          type: 'match_revealed',
          title: '本周锦书已送达',
          body: '你本周的匹配结果已经揭晓，点击查看。',
          level: 'info',
          actionUrl: '/reveal',
          meta: { weekOf, source: 'weekly' },
          idempotencyKey: buildIdempotencyKey(uid, 'match_revealed', `week_${weekOf}`),
        });
      }

      // 无匹配的用户 → match_no_result（本周参与匹配但未获得匹配的用户）
      const participatingUsers = await db.select({ id: users.id })
        .from(users)
        .where(eq(users.isParticipating, true));
      const noMatchUsers = participatingUsers.filter((u) => !revealedUserIds.has(u.id));

      for (const u of noMatchUsers) {
        await createNotification({
          userId: u.id,
          type: 'match_no_result',
          title: '本周暂未匹配成功',
          body: '本周暂未匹配到合适对象，下周再来！',
          level: 'info',
          actionUrl: '/dashboard',
          meta: { weekOf, source: 'weekly' },
          idempotencyKey: buildIdempotencyKey(u.id, 'match_no_result', `week_${weekOf}`),
        });
      }
    } catch (err) {
      console.error('[NOTIFICATION] match_revealed/no_result write failed:', err);
    }
  }

  console.log(`Unlocked ${unlockedRows.length} matches for week ${weekOf}`);
  return unlockedRows.length;
}

/**
 * Expire REVEALED matches where at least one user hasn't acted.
 * Called Friday 20:00 — 48h after reveal.
 */
export async function expireUnactedMatches(): Promise<number> {
  const weekOf = getCurrentWeekOf();

  const expiredRows = await db
    .update(matches)
    .set({ status: 'EXPIRED' })
    .where(and(
      eq(matches.weekOf, weekOf),
      eq(matches.status, 'REVEALED'),
    ))
    .returning({ id: matches.id, userAId: matches.userAId, userBId: matches.userBId, userAAction: matches.userAAction, userBAction: matches.userBAction });

  // For users who missed their 48h window, auto-pause them.
  // ONLY if they haven't acted. If they accepted but the other ignored, only the ignorer gets paused.
  for (const match of expiredRows) {
    const unactedUsers = [];
    if (!match.userAAction) unactedUsers.push(match.userAId);
    if (!match.userBAction) unactedUsers.push(match.userBId);

    for (const uId of unactedUsers) {
      const uArr = await db.select().from(users).where(eq(users.id, uId));
      if (!uArr.length) continue;
      const u = uArr[0];
      
      // Auto-pause the user.
      await db.update(users).set({ 
        isParticipating: false, 
        autoPausedAt: new Date().toISOString() 
      }).where(eq(users.id, u.id));
      
      // Send auto-pause notification.
      if (canEmailUser(u)) {
        await sendAutoPauseNotification(u.email, weekOf).catch(e => console.error("Mail error", e));
      }
    }
  }

  console.log(`Expired ${expiredRows.length} unacted matches for week ${weekOf}`);
  return expiredRows.length;
}

/**
 * Get the current match for a user.
 */
export async function getCurrentMatch(userId: string) {
  const weekOf = getCurrentWeekOf();

  const rows = await db
    .select()
    .from(matches)
    .where(
      and(
        eq(matches.weekOf, weekOf),
        or(eq(matches.userAId, userId), eq(matches.userBId, userId)),
      ),
    )
    .limit(1);

  return rows[0];
}

/**
 * Record a user's action on a match.
 */
export async function recordAction(matchId: string, userId: string, action: 'ACCEPT' | 'REJECT') {
  const matchRows = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  const match = matchRows[0];
  if (!match) return null;

  const isUserA = match.userAId === userId;
  const isUserB = match.userBId === userId;
  if (!isUserA && !isUserB) return null;
  if (match.status !== 'REVEALED') {
    throw new ConflictError(match.status === 'EXPIRED' ? '匹配已过期，无法再做选择' : '当前匹配尚不可操作');
  }

  if (isUserA) {
    await db.update(matches).set({ userAAction: action }).where(eq(matches.id, matchId));
  } else {
    await db.update(matches).set({ userBAction: action }).where(eq(matches.id, matchId));
  }

  // Check if both have acted
  const updatedRows = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  const updated = updatedRows[0]!;
  if (updated.userAAction && updated.userBAction) {
    const newStatus =
      updated.userAAction === 'ACCEPT' && updated.userBAction === 'ACCEPT' ? 'MUTUAL' : 'MISSED';
    await db.update(matches).set({ status: newStatus }).where(eq(matches.id, matchId));

    if (newStatus === 'MUTUAL') {
      try {
        await sendMutualNotificationsForMatch(matchId);
      } catch (err) {
        console.error('[MAIL] mutual notifications failed:', err);
      }
      // ── 站内通知：match_mutual_success（双方各一条）──
      try {
        for (const uid of [match.userAId, match.userBId]) {
          await createNotification({
            userId: uid,
            type: 'match_mutual_success',
            title: '恭喜！双向奔赴成功',
            body: '你们双方都选择了对方，快去看看吧！',
            level: 'success',
            actionUrl: '/reveal',
            meta: { matchId, source: 'weekly' },
            idempotencyKey: buildIdempotencyKey(uid, 'match_mutual_success', `match_${matchId}`),
          });
        }
      } catch (err) {
        console.error('[NOTIFICATION] match_mutual_success write failed:', err);
      }
    }
  }

  const finalRows = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  return finalRows[0];
}

/**
 * Get match history for a user.
 */
export async function getMatchHistory(userId: string, page: number, limit: number) {
  const offset = (page - 1) * limit;

  const userMatches = await db
    .select()
    .from(matches)
    .where(and(
      or(eq(matches.userAId, userId), eq(matches.userBId, userId)),
      ne(matches.status, 'LOCKED'),
    ));

  // Find weeks where the pipeline ran but this user had no match at all
  const [allWeekRows, userAllMatchRows] = await Promise.all([
    db.selectDistinct({ weekOf: matches.weekOf }).from(matches),
    db.select({ weekOf: matches.weekOf }).from(matches).where(
      or(eq(matches.userAId, userId), eq(matches.userBId, userId))
    ),
  ]);
  const userMatchedWeeks = new Set(userAllMatchRows.map((m) => m.weekOf));
  const noMatchWeeks = allWeekRows
    .map((r) => r.weekOf)
    .filter((w) => !userMatchedWeeks.has(w));

  // Combine matched records + no-match weeks, sort by weekOf desc
  type HistoryEntry =
    | { kind: 'match'; row: typeof userMatches[number] }
    | { kind: 'no_match'; weekOf: string };

  const allEntries: HistoryEntry[] = [
    ...userMatches.map((row) => ({ kind: 'match' as const, row })),
    ...noMatchWeeks.map((weekOf) => ({ kind: 'no_match' as const, weekOf })),
  ].sort((a, b) => {
    const aKey = a.kind === 'match' ? (a.row.createdAt ?? a.row.weekOf) : a.weekOf;
    const bKey = b.kind === 'match' ? (b.row.createdAt ?? b.row.weekOf) : b.weekOf;
    return bKey.localeCompare(aKey);
  });

  const total = allEntries.length;
  const paginated = allEntries.slice(offset, offset + limit);

  return { total, page, entries: paginated };
}

export async function warnExpiringMatches(): Promise<number> {
  const weekOf = getCurrentWeekOf();

  // Find users whose match is still 'REVEALED' and not acted upon
  const expiringRows = await db
    .select({ id: matches.id, userAId: matches.userAId, userBId: matches.userBId, userAAction: matches.userAAction, userBAction: matches.userBAction })
    .from(matches)
    .where(and(
      eq(matches.weekOf, weekOf),
      eq(matches.status, 'REVEALED')
    ));

  let notifiedCount = 0;
  for (const match of expiringRows) {
    // Only warn the user who hasn't acted
    const unactedUsers = [];
    if (!match.userAAction) unactedUsers.push(match.userAId);
    if (!match.userBAction) unactedUsers.push(match.userBId);

    for (const uId of unactedUsers) {
      const uArr = await db.select().from(users).where(eq(users.id, uId));
      if (!uArr.length) continue;
      
      const u = uArr[0];
      if (canEmailUser(u)) {
        await sendMatchExpirationWarning(u.email, weekOf).catch(e => console.error("Warning mail error", e));
        notifiedCount++;
      }
    }
  }

  console.log(`Warned ${notifiedCount} users about expiring matches for week ${weekOf}`);
  return notifiedCount;
}

export async function processPermanentSleep(): Promise<number> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Find users who were auto-paused at least 7 days ago and are still NOT participating
  const sleepRows = await db
    .select()
    .from(users)
    .where(and(
      eq(users.isParticipating, false),
      lt(users.autoPausedAt, sevenDaysAgo.toISOString())
    ));

  let sleepCount = 0;
  for (const u of sleepRows) {
    // Send permanent sleep notification
    if (canEmailUser(u)) {
      await sendPermanentSleepNotification(u.email).catch(e => console.error("Sleep mail error", e));
    }
    
    // Clear autoPausedAt so we don't spam them again. They stay isParticipating = false.
    await db.update(users).set({ autoPausedAt: null }).where(eq(users.id, u.id));
    sleepCount++;
  }

  console.log(`Processed permanent sleep for ${sleepCount} users`);
  return sleepCount;
}
