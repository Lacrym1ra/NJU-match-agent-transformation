import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomInt } from 'crypto';
import { v4 as uuid } from 'uuid';
import { eq, and, gt } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { users, otpCodes } from '../db/schema.js';
import { config } from '../config.js';
import { sendOtpEmail } from '../utils/email.js';
import { ConflictError, RateLimitError, UnauthorizedError } from '../utils/errors.js';
import { hashStudentId, isValidStudentId } from '../utils/studentId.js';

// In-memory rate limit tracker for OTP sending
const otpCooldowns = new Map<string, number>();
const otpVerifyFailures = new Map<string, { count: number; firstFailedAt: number; blockedUntil?: number }>();

const VERIFY_WINDOW_MS = 10 * 60 * 1000;
const VERIFY_MAX_FAILURES = 8;
const VERIFY_BLOCK_MS = 15 * 60 * 1000;
const OTP_COOLDOWN_MS = 60_000;
const OTP_EXPIRES_MS = 5 * 60 * 1000;
const PASSWORD_ROUNDS = 12;
const INVALID_LOGIN_MESSAGE = 'Invalid email or password';

export type OtpPurpose = 'register' | 'reset_password' | 'student_id_bind';

type AuthResult = {
  token: string;
  isNewUser: boolean;
  user: typeof users.$inferSelect;
};

function otpKey(email: string, purpose: OtpPurpose): string {
  return `${purpose}:${email}`;
}

function ensureNotBlocked(email: string, purpose: OtpPurpose): void {
  const key = otpKey(email, purpose);
  const failure = otpVerifyFailures.get(key);
  if (!failure?.blockedUntil) return;

  if (Date.now() < failure.blockedUntil) {
    throw new RateLimitError('验证码错误次数过多，请稍后再试');
  }

  otpVerifyFailures.delete(key);
}

function recordVerifyFailure(email: string, purpose: OtpPurpose): void {
  const key = otpKey(email, purpose);
  const now = Date.now();
  const existing = otpVerifyFailures.get(key);

  if (!existing || now - existing.firstFailedAt > VERIFY_WINDOW_MS) {
    otpVerifyFailures.set(key, { count: 1, firstFailedAt: now });
    return;
  }

  const next = { ...existing, count: existing.count + 1 };
  if (next.count >= VERIFY_MAX_FAILURES) {
    next.blockedUntil = now + VERIFY_BLOCK_MS;
  }
  otpVerifyFailures.set(key, next);
}

function signToken(user: Pick<typeof users.$inferSelect, 'id' | 'email'>): string {
  return jwt.sign(
    { userId: user.id, email: user.email } satisfies { userId: string; email: string },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn as any },
  );
}

async function consumeOtp(email: string, code: string, purpose: OtpPurpose): Promise<void> {
  const now = new Date().toISOString();
  ensureNotBlocked(email, purpose);

  const otpRows = await db
    .select()
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.email, email),
        eq(otpCodes.purpose, purpose),
        eq(otpCodes.code, code),
        gt(otpCodes.expiresAt, now),
      ),
    )
    .limit(1);

  if (!otpRows[0]) {
    recordVerifyFailure(email, purpose);
    throw new UnauthorizedError('验证码错误或已过期');
  }

  otpVerifyFailures.delete(otpKey(email, purpose));

  // Consume all active OTPs for this purpose.
  await db.delete(otpCodes)
    .where(and(eq(otpCodes.email, email), eq(otpCodes.purpose, purpose)));
}

export async function sendOtp(email: string, purpose: OtpPurpose = 'register'): Promise<void> {
  // Rate limit: 60s cooldown per purpose.
  const key = otpKey(email, purpose);
  const lastSent = otpCooldowns.get(key);
  if (lastSent && Date.now() - lastSent < OTP_COOLDOWN_MS) {
    throw new RateLimitError('请 60 秒后再试');
  }

  // Generate 6-digit OTP.
  const code = String(randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + OTP_EXPIRES_MS).toISOString();

  // Delete old OTPs for this email/purpose.
  await db.delete(otpCodes)
    .where(and(eq(otpCodes.email, email), eq(otpCodes.purpose, purpose)));

  // Store new OTP.
  await db.insert(otpCodes).values({ email, purpose, code, expiresAt });

  // Send email. If delivery fails, clean up the stored OTP so the user can retry.
  try {
    await sendOtpEmail(email, code);
  } catch (err) {
    await db.delete(otpCodes)
      .where(and(eq(otpCodes.email, email), eq(otpCodes.purpose, purpose)));
    throw err;
  }

  otpCooldowns.set(key, Date.now());
}

export async function registerWithOtp(email: string, code: string, password: string): Promise<AuthResult> {
  await consumeOtp(email, code, 'register');
  const passwordHash = await bcrypt.hash(password, PASSWORD_ROUNDS);

  const userRows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const existing = userRows[0];
  let user: typeof users.$inferSelect;
  let isNewUser = false;

  if (!existing) {
    isNewUser = true;
    const id = uuid();
    const localPart = email.split('@')[0] ?? '';
    const isCanonicalStudentEmail = isValidStudentId(localPart);
    await db.insert(users).values({
      id,
      email,
      passwordHash,
      ...(isCanonicalStudentEmail ? {
        studentIdHash: createStudentIdHash(localPart),
        studentIdLast4: localPart.slice(-4),
        studentIdBindSource: 'canonical_email_auto',
        studentIdVerifiedAt: new Date().toISOString(),
      } : {}),
    });
    const createdRows = await db.select().from(users).where(eq(users.id, id)).limit(1);
    user = createdRows[0]!;
  } else {
    if (existing.passwordHash) {
      throw new ConflictError('账号已存在，请直接登录');
    }

    await db.update(users)
      .set({ passwordHash, updatedAt: new Date().toISOString() })
      .where(eq(users.id, existing.id));

    const updatedRows = await db.select().from(users).where(eq(users.id, existing.id)).limit(1);
    user = updatedRows[0]!;
  }

  return {
    token: signToken(user),
    isNewUser,
    user,
  };
}

export async function loginWithPassword(email: string, password: string): Promise<AuthResult> {
  const userRows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = userRows[0];
  const passwordHash = user?.passwordHash;

  if (!passwordHash) {
    throw new UnauthorizedError(INVALID_LOGIN_MESSAGE);
  }

  const matched = await bcrypt.compare(password, passwordHash);
  if (!matched) {
    throw new UnauthorizedError(INVALID_LOGIN_MESSAGE);
  }

  const authenticatedUser = user!;

  return {
    token: signToken(authenticatedUser),
    isNewUser: false,
    user: authenticatedUser,
  };
}

export async function sendResetPasswordCode(email: string): Promise<void> {
  const userRows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!userRows[0]) {
    return;
  }

  await sendOtp(email, 'reset_password');
}

export async function resetPasswordWithOtp(email: string, code: string, newPassword: string): Promise<void> {
  await consumeOtp(email, code, 'reset_password');
  const userRows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = userRows[0];

  if (!user) {
    throw new UnauthorizedError('验证码错误或已过期');
  }

  const passwordHash = await bcrypt.hash(newPassword, PASSWORD_ROUNDS);
  await db.update(users)
    .set({ passwordHash, updatedAt: new Date().toISOString() })
    .where(eq(users.id, user.id));
}

// Legacy compatibility endpoint: OTP sign-in for users without passwords.
export async function verifyOtp(email: string, code: string): Promise<AuthResult> {
  await consumeOtp(email, code, 'register');

  const userRows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  let user = userRows[0];
  let isNewUser = false;

  if (!user) {
    isNewUser = true;
    const id = uuid();
    const localPart = email.split('@')[0] ?? '';
    const isCanonicalStudentEmail = isValidStudentId(localPart);
    await db.insert(users).values({
      id,
      email,
      ...(isCanonicalStudentEmail ? {
        studentIdHash: createStudentIdHash(localPart),
        studentIdLast4: localPart.slice(-4),
        studentIdBindSource: 'canonical_email_auto',
        studentIdVerifiedAt: new Date().toISOString(),
      } : {}),
    });
    const createdRows = await db.select().from(users).where(eq(users.id, id)).limit(1);
    user = createdRows[0]!;
  } else if (user.passwordHash) {
    throw new UnauthorizedError('请使用账号密码登录');
  }

  return { token: signToken(user), isNewUser, user };
}

function createStudentIdHash(studentId: string): string {
  return hashStudentId(studentId);
}
