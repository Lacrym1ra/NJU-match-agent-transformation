import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { sql } from 'drizzle-orm';
import { config } from './config.js';
import { runMigrations } from './db/migrate.js';
import { db } from './db/connection.js';
import { users, matches } from './db/schema.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimit.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import surveyRoutes from './routes/survey.js';
import matchRoutes from './routes/match.js';
import heartboxRoutes from './routes/heartbox.js';
import studentIdRoutes from './routes/studentId.js';
import adminRoutes from './routes/admin.js';
import circleRoutes from './routes/circle.js';
import cardRoutes from './routes/card.js';
import friendRoutes from './routes/friend.js';
import contactsRoutes from './routes/contacts.js';
import teamRoutes from './routes/team.js';
import chatRoutes from './routes/chat.js';
import forumRoutes from './routes/forum.js';
import socialRoutes from './routes/social.js';
import uploadRoutes from './routes/upload.js';
import { notificationRoutes, adminNotificationRoutes } from './routes/notification.js';
import { initRealtimeServer } from './realtime/chatServer.js';
import { startCronJobs } from './cron/weeklyMatch.js';
import { startG2RequestExpiryCron } from './cron/g2RequestExpiry.js';
import { startNotificationCronJobs } from './cron/notificationCron.js';

const app = express();
const server = createServer(app);
initRealtimeServer(server);

// Middleware
app.set('trust proxy', config.security.trustProxy ? 1 : false);
app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (config.frontend.allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(null, false);
  },
  credentials: true,
}));

app.use(express.json({ limit: config.security.jsonBodyLimit }));
app.use(apiLimiter);

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public stats
app.get('/api/v1/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [totalRow] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
    const [surveyRow] = await db.select({ count: sql<number>`count(*)::int` }).from(users)
      .where(sql`survey_complete = true`);
    const [matchRow] = await db.select({ count: sql<number>`count(*)::int` }).from(matches)
      .where(sql`status = 'MUTUAL'`);

    const total = totalRow.count;
    const surveyDone = surveyRow.count;
    const mutualMatches = matchRow.count;

    res.json({
      totalUsers: total,
      surveyCompletionRate: total > 0 ? Math.round((surveyDone / total) * 100) : 0,
      successfulMatches: mutualMatches,
    });
  } catch (err) {
    next(err);
  }
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.post('/api/v1/users/:targetId/block', (req: Request, res: Response, next: NextFunction) => {
  req.url = `/block/${encodeURIComponent(req.params.targetId as string)}`;
  userRoutes(req, res, next);
});
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/survey', surveyRoutes);
app.use('/api/v1/match', matchRoutes);
app.use('/api/v1/heartbox', heartboxRoutes);
app.use('/api/v1/student-id', studentIdRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/circles', chatRoutes);
app.use('/api/v1/circles', circleRoutes);
app.use('/api/v1/card', cardRoutes);
app.use('/api/v1/friends', friendRoutes);
app.use('/api/v1/contacts', contactsRoutes);
app.use('/api/v1/forum', forumRoutes);
app.use('/api/v1/social', socialRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/admin/notifications', adminNotificationRoutes);
app.use('/api/v1', teamRoutes);

// Static file serving for uploads
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use('/api/v1/uploads', express.static(path.resolve(__dirname, '../uploads'), {
  maxAge: '7d',
  immutable: true,
}));

// Upload routes
app.use('/api/v1/upload', uploadRoutes);

// Error handler (must be last)
app.use(errorHandler);

// Start
async function bootstrap() {
  await runMigrations();
  startCronJobs();
  startG2RequestExpiryCron();
  startNotificationCronJobs();

  server.listen(config.port, () => {
    console.log(`NJU Match backend running on http://localhost:${config.port}`);
    console.log(`Environment: ${config.nodeEnv}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start backend:', err);
  process.exit(1);
});

export default app;
