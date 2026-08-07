import { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { and, eq } from 'drizzle-orm';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import {
  sendOtp,
  verifyOtp,
  registerWithOtp,
  loginWithPassword,
  sendResetPasswordCode,
  resetPasswordWithOtp,
} from '../services/authService.js';
import { db } from '../db/connection.js';
import { users, otpCodes } from '../db/schema.js';
import { config } from '../config.js';
import { authSendCodeLimiter, authVerifyCodeLimiter } from '../middleware/rateLimit.js';

const router = Router();

const sendCodeSchema = z.object({
  email: z.string().email().regex(
    /^[a-zA-Z0-9._%+-]+@smail\.nju\.edu\.cn$/,
    '必须为 @smail.nju.edu.cn 邮箱',
  ),
});

const verifyCodeSchema = z.object({
  email: z.string().email().regex(
    /^[a-zA-Z0-9._%+-]+@smail\.nju\.edu\.cn$/,
    '必须为 @smail.nju.edu.cn 邮箱',
  ),
  code: z.string().length(6),
});

const loginSchema = z.object({
  email: z.string().email().regex(
    /^[a-zA-Z0-9._%+-]+@smail\.nju\.edu\.cn$/,
    '必须为 @smail.nju.edu.cn 邮箱',
  ),
  password: z.string().min(6).max(72),
});

const registerSchema = z.object({
  email: z.string().email().regex(
    /^[a-zA-Z0-9._%+-]+@smail\.nju\.edu\.cn$/,
    '必须为 @smail.nju.edu.cn 邮箱',
  ),
  code: z.string().length(6),
  password: z.string().min(6).max(72),
});

const resetPasswordSchema = z.object({
  email: z.string().email().regex(
    /^[a-zA-Z0-9._%+-]+@smail\.nju\.edu\.cn$/,
    '必须为 @smail.nju.edu.cn 邮箱',
  ),
  code: z.string().length(6),
  newPassword: z.string().min(6).max(72),
});

function toAuthResponse(result: { token: string; isNewUser: boolean; user: typeof users.$inferSelect }) {
  return {
    token: result.token,
    isNewUser: result.isNewUser,
    user: {
      id: result.user.id,
      email: result.user.email,
      profileComplete: Boolean(result.user.profileComplete),
      surveyComplete: Boolean(result.user.surveyComplete),
    },
  };
}

router.post('/send-code', authSendCodeLimiter, validate(sendCodeSchema), async (req, res, next) => {
  try {
    await sendOtp(req.body.email, 'register');
    res.json({ message: '验证码已发送', expiresIn: 300 });
  } catch (err) {
    next(err);
  }
});

router.post('/register', authVerifyCodeLimiter, validate(registerSchema), async (req, res, next) => {
  try {
    const result = await registerWithOtp(req.body.email, req.body.code, req.body.password);
    res.json(toAuthResponse(result));
  } catch (err) {
    next(err);
  }
});

router.post('/login', authVerifyCodeLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const result = await loginWithPassword(req.body.email, req.body.password);
    res.json(toAuthResponse(result));
  } catch (err) {
    next(err);
  }
});

router.post('/forgot-password/send-code', authSendCodeLimiter, validate(sendCodeSchema), async (req, res, next) => {
  try {
    await sendResetPasswordCode(req.body.email);
    res.json({ message: '若邮箱存在，验证码已发送', expiresIn: 300 });
  } catch (err) {
    next(err);
  }
});

router.post('/forgot-password/reset', authVerifyCodeLimiter, validate(resetPasswordSchema), async (req, res, next) => {
  try {
    await resetPasswordWithOtp(req.body.email, req.body.code, req.body.newPassword);
    res.json({ message: '密码已重置，请使用新密码登录' });
  } catch (err) {
    next(err);
  }
});

// Legacy compatibility route: OTP sign-in for old users without password.
router.post('/verify-code', authVerifyCodeLimiter, validate(verifyCodeSchema), async (req, res, next) => {
  try {
    const result = await verifyOtp(req.body.email, req.body.code);
    res.json(toAuthResponse(result));
  } catch (err) {
    next(err);
  }
});

router.post('/realtime-ticket', requireAuth, (req, res) => {
  const ticketId = uuid();
  const ticket = jwt.sign(
    { userId: req.auth!.userId, email: req.auth!.email, purpose: 'realtime' },
    config.jwt.secret,
    {
      algorithm: 'HS256',
      audience: 'realtime',
      expiresIn: config.realtime.ticketExpiresInSeconds,
      jwtid: ticketId,
    },
  );
  res.json({ ticket, expiresIn: config.realtime.ticketExpiresInSeconds });
});

// Dev-only routes — only registered when NODE_ENV=development
if (config.isDev) {
  // GET /auth/dev-status — lets the UI expose development-only test helpers.
  router.get('/dev-status', requireAuth, (req, res) => {
    if (!req.auth!.email.toLowerCase().endsWith('@test.local')) {
      res.status(403).json({ error: { code: 'DEV_TEST_ACCOUNT_REQUIRED', message: '开发测试入口仅允许 @test.local 账号' } });
      return;
    }
    res.json({ enabled: true });
  });

  // GET /auth/dev-otp?email=xxx — returns the current OTP from DB
  router.get('/dev-otp', async (req, res, next) => {
    try {
      const email = typeof req.query.email === 'string' ? req.query.email : '';
      const purposeRaw = (req.query.purpose as string | undefined) || 'register';
      const purpose = purposeRaw === 'reset_password' ? 'reset_password' : 'register';
      if (!email) { res.status(400).json({ error: 'email required' }); return; }
      if (!email.toLowerCase().endsWith('@test.local')) {
        res.status(403).json({ error: { code: 'DEV_TEST_ACCOUNT_REQUIRED', message: '开发测试入口仅允许 @test.local 账号' } });
        return;
      }
      const otpRows = await db.select().from(otpCodes)
        .where(and(eq(otpCodes.email, email), eq(otpCodes.purpose, purpose))).limit(1);
      const otp = otpRows[0];
      if (!otp) { res.status(404).json({ error: '未找到验证码，请先发送' }); return; }
      res.json({ code: otp.code, purpose: otp.purpose, expiresAt: otp.expiresAt });
    } catch (err) {
      next(err);
    }
  });

  // POST /auth/dev-token — bypasses OTP for testing
  router.post('/dev-token', async (req, res, next) => {
    try {
      const email = typeof req.body?.email === 'string' ? req.body.email : '';
      if (!email) { res.status(400).json({ error: 'email required' }); return; }
      if (!email.toLowerCase().endsWith('@test.local')) {
        res.status(403).json({ error: { code: 'DEV_TEST_ACCOUNT_REQUIRED', message: '开发测试入口仅允许 @test.local 账号' } });
        return;
      }

      const userRows = await db.select().from(users).where(eq(users.email, email)).limit(1);
      let user = userRows[0];
      let isNewUser = false;
      if (!user) {
        isNewUser = true;
        const id = uuid();
        await db.insert(users).values({ id, email });
        const createdRows = await db.select().from(users).where(eq(users.id, id)).limit(1);
        user = createdRows[0]!;
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn as any },
      );
      res.json({ token, isNewUser, userId: user.id });
    } catch (err) {
      next(err);
    }
  });
}

export default router;
