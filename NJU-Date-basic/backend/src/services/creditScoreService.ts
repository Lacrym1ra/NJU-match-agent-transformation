import { and, eq, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection.js';
import { creditScoreLogs, users } from '../db/schema.js';

const CREDIT_MAX = 100;
const RECOVERY_INTERVAL_DAYS = 2;

function levelFromReason(reason: string): 1 | 2 | 3 {
  if (reason.endsWith('_l3')) return 3;
  if (reason.endsWith('_l2')) return 2;
  return 1;
}

function cooldownDaysByLevel(level: 1 | 2 | 3): number {
  if (level === 3) return 14;
  return 7;
}

function toCreditLevel(score: number): 'normal' | 'limited' | 'banned' {
  if (score <= 85) return 'banned';
  if (score <= 90) return 'limited';
  return 'normal';
}

export async function recoverCreditScoresAfterObservation(): Promise<number> {
  const candidates = await db.execute(sql`
    WITH latest_penalty AS (
      SELECT
        csl.user_id AS user_id,
        csl.created_at AS penalty_at,
        csl.reason AS reason,
        (csl.source_type || ':' || COALESCE(csl.source_id, '')) AS source_key
      FROM credit_score_logs csl
      WHERE csl.delta < 0
        AND csl.source_type IN ('user_report', 'forum_report')
      ORDER BY csl.user_id, csl.created_at DESC
    )
    SELECT
      DISTINCT ON (lp.user_id)
      lp.user_id,
      lp.penalty_at,
      lp.reason,
      lp.source_key
    FROM latest_penalty lp
    ORDER BY lp.user_id, lp.penalty_at DESC
  `);

  let recoveredCount = 0;
  const candidateRows = candidates as unknown as Array<{
    user_id: string;
    penalty_at: string;
    reason: string;
    source_key: string;
  }>;
  for (const row of candidateRows) {
    await db.transaction(async (tx) => {
      const level = levelFromReason(row.reason || '');
      const cooldownDays = cooldownDaysByLevel(level);
      const penaltyAt = new Date(row.penalty_at);
      const cooldownEnd = new Date(penaltyAt.getTime() + cooldownDays * 24 * 60 * 60 * 1000);
      const now = new Date();
      const elapsedMs = now.getTime() - cooldownEnd.getTime();
      if (elapsedMs < RECOVERY_INTERVAL_DAYS * 24 * 60 * 60 * 1000) {
        return;
      }
      const eligibleRecoveries = Math.floor(elapsedMs / (RECOVERY_INTERVAL_DAYS * 24 * 60 * 60 * 1000));

      const [recoveredRow] = await tx.execute(sql`
        SELECT count(*)::int AS count
        FROM credit_score_logs csl
        WHERE csl.source_type = 'credit_recovery'
          AND csl.source_id LIKE ${`${row.source_key}:step:%`}
      `) as unknown as Array<{ count: number }>;
      const recoveredTimes = recoveredRow?.count ?? 0;
      const shouldRecoverTimes = eligibleRecoveries - recoveredTimes;
      if (shouldRecoverTimes <= 0) return;

      const [userRow] = await tx
        .select({ id: users.id, creditScore: users.creditScore })
        .from(users)
        .where(eq(users.id, row.user_id))
        .limit(1);
      if (!userRow) return;

      const currentScore = userRow.creditScore ?? CREDIT_MAX;
      const recoverAppliedTimes = Math.min(shouldRecoverTimes, Math.max(0, CREDIT_MAX - currentScore));
      if (recoverAppliedTimes <= 0) return;
      const nextScore = currentScore + recoverAppliedTimes;
      const delta = nextScore - currentScore;
      const nextLevel = toCreditLevel(nextScore);

      if (delta > 0) {
        await tx
          .update(users)
          .set({
            creditScore: nextScore,
            creditLevel: nextLevel,
            pauseUntilWeek: nextScore > 90 ? null : undefined,
            updatedAt: sql`NOW()`,
          })
          .where(eq(users.id, row.user_id));
      }

      for (let i = 0; i < recoverAppliedTimes; i += 1) {
        await tx.insert(creditScoreLogs).values({
          id: uuidv4(),
          userId: row.user_id,
          delta: 1,
          reason: 'credit_observation_recovered',
          sourceType: 'credit_recovery',
          sourceId: `${row.source_key}:step:${recoveredTimes + i + 1}`,
        });
      }

      recoveredCount += 1;
    });
  }

  return recoveredCount;
}

export async function getCreditRecoveryStatus(userId: string): Promise<{
  creditScore: number;
  status: 'cooldown' | 'recovering' | 'full';
  daysToRecoveryStart: number;
}> {
  const [userRow] = await db
    .select({ id: users.id, creditScore: users.creditScore })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!userRow) {
    return { creditScore: CREDIT_MAX, status: 'full', daysToRecoveryStart: 0 };
  }

  const [latestPenalty] = await db.execute(sql`
    SELECT
      csl.created_at AS penalty_at,
      csl.reason AS reason
    FROM credit_score_logs csl
    WHERE csl.user_id = ${userId}
      AND csl.delta < 0
      AND csl.source_type IN ('user_report', 'forum_report')
    ORDER BY csl.created_at DESC
    LIMIT 1
  `) as unknown as Array<{ penalty_at: string; reason: string }>;

  const creditScore = userRow.creditScore ?? CREDIT_MAX;
  if (!latestPenalty) {
    return { creditScore, status: creditScore >= CREDIT_MAX ? 'full' : 'recovering', daysToRecoveryStart: 0 };
  }

  const level = levelFromReason(latestPenalty.reason || '');
  const cooldownDays = cooldownDaysByLevel(level);
  const penaltyAt = new Date(latestPenalty.penalty_at);
  const cooldownEnd = new Date(penaltyAt.getTime() + cooldownDays * 24 * 60 * 60 * 1000);
  const now = new Date();

  if (now < cooldownEnd) {
    const msLeft = cooldownEnd.getTime() - now.getTime();
    const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
    return { creditScore, status: 'cooldown', daysToRecoveryStart: Math.max(0, daysLeft) };
  }

  if (creditScore >= CREDIT_MAX) {
    return { creditScore, status: 'full', daysToRecoveryStart: 0 };
  }
  return { creditScore, status: 'recovering', daysToRecoveryStart: 0 };
}
