import cron from 'node-cron';
import { expireStaleG2Requests } from '../services/requestExpiryService.js';

async function runG2RequestExpiryOnce(label: string) {
  try {
    const result = await expireStaleG2Requests();
    if (result.friendRequestCount > 0 || result.contactUnlockRequestCount > 0) {
      console.log(`[CRON] ${label} expired G2 requests:`, result);
    }
  } catch (err) {
    console.error(`[CRON] ${label} G2 request expiry failed:`, err);
  }
}

export function startG2RequestExpiryCron() {
  void runG2RequestExpiryOnce('startup');

  cron.schedule('*/10 * * * *', async () => {
    await runG2RequestExpiryOnce('scheduled');
  });

  console.log('G2 request expiry cron scheduled: every 10 minutes');
}
