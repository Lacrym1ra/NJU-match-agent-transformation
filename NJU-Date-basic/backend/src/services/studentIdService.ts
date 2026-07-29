import { and, eq, isNull, ne } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { otpCodes, users } from '../db/schema.js';
import { sendOtp } from './authService.js';
import { ConflictError, NotFoundError, UnauthorizedError, ValidationError } from '../utils/errors.js';
import { hashStudentId, isValidStudentId, normalizeStudentId } from '../utils/studentId.js';
import { canonicalStudentEmailFromId, canonicalStudentIdFromEmail, shouldAutoBindByEmail } from '../utils/studentIdPolicy.js';

export async function getStudentIdBindStatus(userId: string) {
  await ensureCanonicalStudentIdAutoBound(userId);
  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = userRows[0];
  if (!user) throw new NotFoundError('用户不存在');
  return {
    verified: !!user.studentIdVerifiedAt && !!user.studentIdHash,
    last4: user.studentIdLast4 ?? null,
    source: user.studentIdBindSource ?? null,
    mergedIntoUserId: user.mergedIntoUserId ?? null,
  };
}

export async function ensureCanonicalStudentIdAutoBound(userId: string): Promise<void> {
  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = userRows[0];
  if (!user) throw new NotFoundError('用户不存在');
  if (user.mergedIntoUserId) throw new UnauthorizedError('该账号已合并，不可继续此操作');
  if (user.studentIdHash && user.studentIdVerifiedAt) return;

  const studentId = canonicalStudentIdFromEmail(user.email);
  if (!studentId) return;

  await bindWithConflictHandling(
    user.id,
    studentId,
    hashStudentId(studentId),
    'canonical_email_auto',
  );
}

export async function sendStudentIdBindCode(userId: string, studentIdRaw: string) {
  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = userRows[0];
  if (!user) throw new NotFoundError('用户不存在');
  if (user.mergedIntoUserId) {
    throw new UnauthorizedError('该账号已合并，不可继续绑定');
  }

  const studentId = normalizeStudentId(studentIdRaw);
  if (!isValidStudentId(studentId)) {
    const err: any = new ValidationError('请输入正确的学号');
    err.code = 'INVALID_STUDENT_ID_FORMAT';
    throw err;
  }

  await sendOtp(canonicalStudentEmailFromId(studentId), 'student_id_bind');
  return { success: true, expiresIn: 300 };
}

export async function verifyAndBindStudentId(userId: string, studentIdRaw: string, code: string) {
  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = userRows[0];
  if (!user) throw new NotFoundError('用户不存在');
  if (user.mergedIntoUserId) {
    throw new UnauthorizedError('该账号已合并，不可继续绑定');
  }

  const studentId = normalizeStudentId(studentIdRaw);
  if (!isValidStudentId(studentId)) {
    const err: any = new ValidationError('请输入正确的学号');
    err.code = 'INVALID_STUDENT_ID_FORMAT';
    throw err;
  }

  if (shouldAutoBindByEmail(user.email, studentId)) {
    const studentIdHash = hashStudentId(studentId);
    await bindWithConflictHandling(user.id, studentId, studentIdHash, 'canonical_email_auto');
    return { success: true, autoBound: true };
  }

  const otpEmail = canonicalStudentEmailFromId(studentId);
  const otpRows = await db.select().from(otpCodes).where(and(
    eq(otpCodes.email, otpEmail),
    eq(otpCodes.purpose, 'student_id_bind'),
    eq(otpCodes.code, code),
  )).limit(1);
  const otp = otpRows[0];
  if (!otp || new Date(otp.expiresAt).getTime() <= Date.now()) {
    throw new UnauthorizedError('验证码错误或已过期');
  }

  await db.delete(otpCodes).where(and(eq(otpCodes.email, otpEmail), eq(otpCodes.purpose, 'student_id_bind')));

  const studentIdHash = hashStudentId(studentId);
  await bindWithConflictHandling(user.id, studentId, studentIdHash, 'canonical_email_otp');

  return { success: true, autoBound: false };
}

async function bindWithConflictHandling(
  userId: string,
  studentId: string,
  studentIdHash: string,
  bindSource: 'canonical_email_auto' | 'canonical_email_otp',
) {
  return db.transaction(async (tx) => {
    const holderRows = await tx.select().from(users).where(and(
      eq(users.studentIdHash, studentIdHash),
      ne(users.id, userId),
      isNull(users.mergedIntoUserId),
    )).limit(1);
    const existingHolder = holderRows[0];

    if (existingHolder) {
      // Minimal claim/merge: keep existing holder active, mark current as merged.
      await tx.update(users).set({
        mergedIntoUserId: existingHolder.id,
        mergedAt: new Date().toISOString(),
        isParticipating: false,
        updatedAt: new Date().toISOString(),
      }).where(eq(users.id, userId));
      const err: any = new ConflictError('学号已绑定到另一个账号，当前账号已标记为合并态');
      err.code = 'STUDENT_ID_ALREADY_BOUND';
      throw err;
    }

    await tx.update(users).set({
      studentIdHash,
      studentIdLast4: studentId.slice(-4),
      studentIdBindSource: bindSource,
      studentIdVerifiedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).where(eq(users.id, userId));
  });
}

export async function ensureMergedAccountNotAllowed(userId: string): Promise<void> {
  const rows = await db.select({ mergedIntoUserId: users.mergedIntoUserId }).from(users).where(eq(users.id, userId)).limit(1);
  const row = rows[0];
  if (!row) throw new NotFoundError('用户不存在');
  if (row.mergedIntoUserId) {
    throw new UnauthorizedError('该账号已合并，不可继续此操作');
  }
}
