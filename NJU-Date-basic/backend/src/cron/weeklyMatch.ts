import cron from 'node-cron';
import {
  runMatchingPipeline,
  unlockCurrentWeekMatches,
  expireUnactedMatches,
  sendPendingSurveyReminderBatch,
  sendOutdatedSurveyReminderBatch,
  warnExpiringMatches,
  processPermanentSleep
} from '../services/matchService.js';
import { activateQueuedHeartboxMatches } from '../services/heartboxService.js';
import { recoverCreditScoresAfterObservation } from '../services/creditScoreService.js';

export function startCronJobs() {
  // One-off campaign: 2026-04-11 09:00 (Asia/Shanghai) survey update reminder.
  // Uses the same recipient logic as admin manual trigger.
  cron.schedule('0 9 11 4 *', async () => {
    const now = new Date();
    const shanghai = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const year = shanghai.getUTCFullYear();
    if (year !== 2026) return;

    console.log('[CRON] Running one-off survey update reminder campaign (2026-04-11 09:00)...');
    try {
      const stats = await sendOutdatedSurveyReminderBatch();
      console.log('[CRON] One-off survey update reminder stats:', stats);
    } catch (err) {
      console.error('[CRON] One-off survey update reminder failed:', err);
    }
  }, { timezone: 'Asia/Shanghai' });

  // Tuesday 18:00 reminder for users who still can't participate this week
  // because they either haven't submitted a survey yet or are still on an old survey version.
  cron.schedule('0 18 * * 2', async () => {
    console.log('[CRON] Sending Tuesday 18:00 survey reminders...');
    try {
      const pendingStats = await sendPendingSurveyReminderBatch('main');
      const outdatedStats = await sendOutdatedSurveyReminderBatch();
      console.log('[CRON] Tuesday 18:00 reminder stats:', { pending: pendingStats, outdated: outdatedStats });
    } catch (err) {
      console.error('[CRON] Tuesday 18:00 reminders failed:', err);
    }
  }, { timezone: 'Asia/Shanghai' });

  // Wednesday 12:00 catch-up reminder for users who registered on Tuesday
  // and still haven't finished the survey yet.
  cron.schedule('0 12 * * 3', async () => {
    console.log('[CRON] Sending Wednesday noon survey reminders...');
    try {
      const stats = await sendPendingSurveyReminderBatch('late');
      console.log('[CRON] Wednesday noon reminder stats:', stats);
    } catch (err) {
      console.error('[CRON] Wednesday noon reminders failed:', err);
    }
  }, { timezone: 'Asia/Shanghai' });

  // Run matching algorithm every Wednesday at 18:00 (Beijing Time = UTC+8, so 10:00 UTC)
  cron.schedule('0 18 * * 3', async () => {
    console.log('[CRON] Running weekly matching pipeline...');
    try {
      const stats = await runMatchingPipeline();
      console.log('[CRON] Matching stats:', stats);
    } catch (err) {
      console.error('[CRON] Matching pipeline failed:', err);
    }
  }, { timezone: 'Asia/Shanghai' });

  // Unlock matches every Wednesday at 20:00 (Beijing Time)
  cron.schedule('0 20 * * 3', async () => {
    console.log('[CRON] Unlocking weekly matches...');
    try {
      const count = await unlockCurrentWeekMatches();
      console.log(`[CRON] Unlocked ${count} matches`);
    } catch (err) {
      console.error('[CRON] Unlock failed:', err);
    }
  }, { timezone: 'Asia/Shanghai' });

  // Warn about expiring matches every Friday at 12:00 (Beijing Time)
  cron.schedule('0 12 * * 5', async () => {
    console.log('[CRON] Warning users about expiring matches...');
    try {
      const count = await warnExpiringMatches();
      console.log(`[CRON] Warned ${count} users`);
    } catch (err) {
      console.error('[CRON] Warning failed:', err);
    }
  }, { timezone: 'Asia/Shanghai' });

  // Expire unacted matches every Friday at 20:00 (Beijing Time) — 48h after reveal
  cron.schedule('0 20 * * 5', async () => {
    console.log('[CRON] Expiring unacted matches...');
    try {
      const count = await expireUnactedMatches();
      console.log(`[CRON] Expired ${count} matches`);
    } catch (err) {
      console.error('[CRON] Expire failed:', err);
    }
  }, { timezone: 'Asia/Shanghai' });

  // Permanent sleep processing for inactive users - run every day at 12:00 
  cron.schedule('0 12 * * *', async () => {
    console.log('[CRON] Processing permanent sleep for inactive users...');
    try {
      const count = await processPermanentSleep();
      console.log(`[CRON] Processed sleep for ${count} users`);
    } catch (err) {
      console.error('[CRON] Permanent sleep processing failed:', err);
    }
  }, { timezone: 'Asia/Shanghai' });

  // Legacy Heartbox queued records are now activated independently of mainline.
  cron.schedule('*/30 * * * *', async () => {
    try {
      const activated = await activateQueuedHeartboxMatches(30);
      if (activated > 0) {
        console.log(`[CRON] Activated ${activated} legacy queued heartbox records`);
      }
    } catch (err) {
      console.error('[CRON] Legacy heartbox activation failed:', err);
    }
  }, { timezone: 'Asia/Shanghai' });

  // Credit recovery observation check — run daily at 03:10 (Asia/Shanghai).
  cron.schedule('10 3 * * *', async () => {
    try {
      const recovered = await recoverCreditScoresAfterObservation();
      if (recovered > 0) {
        console.log(`[CRON] Credit observation recovered users: ${recovered}`);
      }
    } catch (err) {
      console.error('[CRON] Credit observation recovery failed:', err);
    }
  }, { timezone: 'Asia/Shanghai' });

  console.log('Cron jobs scheduled: one-off 2026-04-11 09:00, Tue 18:00, Wed 12:00 & 18:00 & 20:00, Fri 12:00 & 20:00, Daily 12:00 sleep clear, Daily 03:10 credit recovery, Every 30m legacy heartbox activation');
}
