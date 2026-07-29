import { and, eq, or, inArray, gte, desc, sql } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { db } from '../db/connection.js';
import { heartMatches, heartSignals, mailLogs, userBlocks, users } from '../db/schema.js';
import { AppError, ConflictError, RateLimitError, ValidationError } from '../utils/errors.js';
import { hashStudentId, isValidStudentId, maskStudentId, normalizeStudentId } from '../utils/studentId.js';
import { ensureCanonicalStudentIdAutoBound, ensureMergedAccountNotAllowed } from './studentIdService.js';
import { canSetSignalIn24h } from './heartboxPolicy.js';
import { sendHeartboxMutualEmail } from '../utils/email.js';
import { logAudit } from '../utils/audit.js';
import { createNotification, buildIdempotencyKey } from './notificationService.js';
import { canonicalStudentEmailFromId } from '../utils/studentIdPolicy.js';

type HeartboxMeResponse = {
  hasActiveSignal: boolean;
  cooldownUntil: string | null;
  signal: null | {
    targetStudentIdMasked: string;
    status: string;
    createdAt: string;
  };
  incomingHint: { hasIncoming: boolean; copy: string };
  latestHeartboxMatch: null | {
    id: string;
    status: string;
    mainMatchId: string | null;
    updatedAt: string;
  };
};

export type HeartboxRevealResponse = {
  heartMatchId: string;
  status: string;
  specialLabel: '双向奔赴';
  createdAt: string | null;
  updatedAt: string | null;
  legacyMainMatchId: string | null;
  partner: {
    id: string;
    nickname: string | null;
    gender: string | null;
    department: string | null;
    grade: string | null;
    campus: string | null;
    mbti: string | null;
    bio: string | null;
    avatarUrl: string | null;
  };
  partnerContact: {
    contactPlatform: string;
    contactId: string;
  };
  note: string;
};

function sortUserPair(a: string, b: string): { userAId: string; userBId: string } {
  return a < b ? { userAId: a, userBId: b } : { userAId: b, userBId: a };
}

function heartboxMainlinePausePatch(nowIso: string) {
  return {
    isParticipating: false,
    autoPausedAt: null,
    updatedAt: nowIso,
  };
}

async function safetyAllowsHeartboxMatch(userIdA: string, userIdB: string): Promise<boolean> {
  // MVP: only block if either user has blocked the other.
  const rows = await db.select({ id: userBlocks.id }).from(userBlocks).where(or(
    and(eq(userBlocks.blockerId, userIdA), eq(userBlocks.blockedId, userIdB)),
    and(eq(userBlocks.blockerId, userIdB), eq(userBlocks.blockedId, userIdA)),
  )).limit(1);
  return rows.length === 0;
}

async function hasIncomingHint(userId: string, myStudentIdHash: string): Promise<boolean> {
  // Incoming exists if there is any active signal pointing to my student hash.
  // Note: if myStudentIdHash is missing, caller is ineligible; keep false.
  if (!myStudentIdHash) return false;
  const rows = await db.select({ id: heartSignals.id }).from(heartSignals).where(and(
    eq(heartSignals.targetStudentIdHash, myStudentIdHash),
    eq(heartSignals.status, 'active'),
  )).limit(1);
  return rows.length > 0;
}

export async function getHeartboxMe(userId: string): Promise<HeartboxMeResponse> {
  await ensureMergedAccountNotAllowed(userId);
  await ensureCanonicalStudentIdAutoBound(userId);
  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const me = userRows[0];
  if (!me) throw new ValidationError('用户不存在');

  const activeRows = await db.select().from(heartSignals).where(and(
    eq(heartSignals.senderId, userId),
    eq(heartSignals.status, 'active'),
  )).limit(1);
  const active = activeRows[0] ?? null;

  const incoming = await hasIncomingHint(userId, me.studentIdHash ?? '');

  const latestRows = await db.select().from(heartMatches).where(or(
    eq(heartMatches.userAId, userId),
    eq(heartMatches.userBId, userId),
  )).orderBy(desc(heartMatches.updatedAt), desc(heartMatches.createdAt)).limit(1);
  const latest = latestRows[0] ?? null;

  return {
    hasActiveSignal: !!active,
    cooldownUntil: me.heartboxCooldownUntil ?? null,
    signal: active ? {
      targetStudentIdMasked: active.targetStudentIdMasked,
      status: active.status,
      createdAt: active.createdAt ?? new Date().toISOString(),
    } : null,
    incomingHint: {
      hasIncoming: incoming,
      copy: incoming ? '有人悄悄心动了你' : '',
    },
    latestHeartboxMatch: latest ? {
      id: latest.id,
      status: latest.status === 'queued' ? 'active' : latest.status,
      mainMatchId: latest.mainMatchId ?? null,
      updatedAt: latest.updatedAt ?? new Date().toISOString(),
    } : null,
  };
}

type CreateSignalResult =
  | { success: true; status: 'saved' }
  | { success: true; status: 'matched'; heartMatchId: string; source: 'heartbox'; matchStatus: 'MUTUAL'; scoreVisible: false; specialLabel: '双向奔赴' };

export async function createOrReplaceHeartSignal(userId: string, targetStudentIdRaw: string): Promise<CreateSignalResult> {
  await ensureMergedAccountNotAllowed(userId);
  await ensureCanonicalStudentIdAutoBound(userId);
  const notifyRef: { payload: { heartMatchId: string; userIds: string[] } | null } = { payload: null };
  const result: CreateSignalResult = await db.transaction(async (tx): Promise<CreateSignalResult> => {
    const userRows = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
    const me = userRows[0];
    if (!me) throw new ValidationError('用户不存在');
    if (me.heartboxCooldownUntil) {
      const cooldownUntil = new Date(me.heartboxCooldownUntil);
      if (!Number.isNaN(cooldownUntil.getTime()) && cooldownUntil.getTime() > Date.now()) {
        throw new AppError(429, 'HEARTBOX_COOLDOWN', '撤回后需等待 7 天才能再次投递');
      }
    }

    // Eligibility: must have completed profile & survey (self state; OK to be explicit)
    if (!me.profileComplete) throw new ValidationError('请先完成基础档案');
    if (!me.surveyComplete) throw new ValidationError('请先完成主线问卷');

    // Canonical student-email accounts are auto-bound above. Alias accounts must bind once.
    if (!me.studentIdHash || !me.studentIdVerifiedAt) {
      const err: any = new ValidationError('绑定学号后才能投递心动');
      err.code = 'STUDENT_ID_BIND_REQUIRED';
      throw err;
    }

    const normalized = normalizeStudentId(targetStudentIdRaw);
    if (!isValidStudentId(normalized)) {
      const err: any = new ValidationError('请输入正确的学号');
      err.code = 'INVALID_STUDENT_ID_FORMAT';
      throw err;
    }

    const targetHash = hashStudentId(normalized);
    if (targetHash === me.studentIdHash) {
      const err: any = new ConflictError('不能投递给自己');
      err.code = 'SELF_TARGET_NOT_ALLOWED';
      throw err;
    }

    // 24h rolling limit: at most one set/change per day.
    const dayAgoIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recentSignals = await tx.select({ id: heartSignals.id }).from(heartSignals).where(and(
      eq(heartSignals.senderId, userId),
      or(
        eq(heartSignals.status, 'active'),
        eq(heartSignals.status, 'cancelled'),
        eq(heartSignals.status, 'matched'),
      ),
      gte(heartSignals.createdAt, dayAgoIso),
    )).limit(1);
    if (!canSetSignalIn24h(recentSignals.length)) {
      await logAudit({
        operatorId: userId,
        action: 'heartbox_signal_rate_24h_blocked',
        target: userId,
        detail: { recentSignals: recentSignals.length },
        result: 'failure',
      });
      throw new RateLimitError('24小时内仅可设置或更换一次心动对象');
    }

    // Cancel existing active signal (keep audit trail)
    await tx.update(heartSignals).set({
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).where(and(
      eq(heartSignals.senderId, userId),
      eq(heartSignals.status, 'active'),
    ));

    const nowIso = new Date().toISOString();
    const signalId = uuid();
    const signalRows = await tx.insert(heartSignals).values({
      id: signalId,
      senderId: userId,
      targetStudentIdHash: targetHash,
      targetStudentIdMasked: maskStudentId(normalized),
      status: 'active',
      createdAt: nowIso,
      updatedAt: nowIso,
    }).returning();
    const signal = signalRows[0]!;

    // Internal lookup only. Never expose to caller.
    const targetEmail = canonicalStudentEmailFromId(normalized);
    const targetUserRows = await tx.select().from(users).where(or(
      eq(users.studentIdHash, targetHash),
      sql`lower(${users.email}) = ${targetEmail}`,
    )).limit(1);
    const targetUser = targetUserRows[0];
    if (!targetUser) {
      return { success: true, status: 'saved' };
    }

    // Resolve cache (internal only)
    await tx.update(heartSignals).set({
      resolvedTargetUserId: targetUser.id,
      updatedAt: new Date().toISOString(),
    }).where(eq(heartSignals.id, signal.id));

    const reverseRows = await tx.select().from(heartSignals).where(and(
      eq(heartSignals.senderId, targetUser.id),
      eq(heartSignals.targetStudentIdHash, me.studentIdHash),
      eq(heartSignals.status, 'active'),
    )).limit(1);
    const reverseSignal = reverseRows[0];
    if (!reverseSignal) {
      return { success: true, status: 'saved' };
    }

    const allowed = await safetyAllowsHeartboxMatch(me.id, targetUser.id);
    if (!allowed) {
      // Do not reveal block/safety.
      return { success: true, status: 'saved' };
    }

    const { userAId, userBId } = sortUserPair(me.id, targetUser.id);
    const heartMatchId = uuid();

    // Upsert by unique pair
    const existingHeartMatchRows = await tx.select().from(heartMatches).where(and(
      eq(heartMatches.userAId, userAId),
      eq(heartMatches.userBId, userBId),
    )).limit(1);
    const existingHeartMatch = existingHeartMatchRows[0];

    const heartMatch = existingHeartMatch
      ? (await tx.update(heartMatches).set({ status: 'active', updatedAt: new Date().toISOString() })
          .where(eq(heartMatches.id, existingHeartMatch.id))
          .returning())[0]!
      : (await tx.insert(heartMatches).values({
          id: heartMatchId,
          userAId,
          userBId,
          signalAId: signal.id,
          signalBId: reverseSignal.id,
          status: 'active',
          createdAt: nowIso,
          updatedAt: nowIso,
        }).returning())[0]!;

    // Mark both signals matched
    await tx.update(heartSignals).set({
      status: 'matched',
      matchedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).where(inArray(heartSignals.id, [signal.id, reverseSignal.id]));

    await tx.update(heartMatches).set({
      status: 'active',
      updatedAt: new Date().toISOString(),
    }).where(eq(heartMatches.id, heartMatch.id));
    await tx.update(users).set(heartboxMainlinePausePatch(nowIso)).where(inArray(users.id, [userAId, userBId]));
    notifyRef.payload = { heartMatchId: heartMatch.id, userIds: [userAId, userBId] };

    return {
      success: true,
      status: 'matched',
      heartMatchId: heartMatch.id,
      source: 'heartbox',
      matchStatus: 'MUTUAL',
      scoreVisible: false,
      specialLabel: '双向奔赴',
    };
  });
  if (notifyRef.payload) {
    await sendHeartboxMutualNotifications(notifyRef.payload.heartMatchId, notifyRef.payload.userIds);

    // ── 站内通知：match_mutual_success（Heartbox 互选）──
    try {
      const { heartMatchId, userIds } = notifyRef.payload;
      for (const uid of userIds) {
        await createNotification({
          userId: uid,
          type: 'match_mutual_success',
          title: '双向奔赴成功！',
          body: '你们互相选择了对方，快去看看吧！',
          level: 'success',
          actionUrl: '/reveal',
          meta: { matchId: heartMatchId, source: 'heartbox' },
          idempotencyKey: buildIdempotencyKey(uid, 'match_mutual_success', `match_${heartMatchId}`),
        });
      }
    } catch (err) {
      console.error('[NOTIFICATION] heartbox match_mutual_success write failed:', err);
    }
  }
  return result;
}

export async function cancelActiveHeartSignal(userId: string): Promise<void> {
  await ensureMergedAccountNotAllowed(userId);
  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    const activeRows = await tx.select({ id: heartSignals.id }).from(heartSignals).where(and(
      eq(heartSignals.senderId, userId),
      eq(heartSignals.status, 'active'),
    )).limit(1);
    if (!activeRows[0]) {
      const lockedRows = await tx.select({ id: heartMatches.id }).from(heartMatches).where(and(
        or(eq(heartMatches.userAId, userId), eq(heartMatches.userBId, userId)),
        inArray(heartMatches.status, ['queued', 'active']),
      )).limit(1);
      if (lockedRows[0]) {
        const err: any = new ConflictError('双向心动已成立，无法撤回');
        err.code = 'HEARTBOX_MATCH_LOCKED';
        throw err;
      }
      return;
    }

    const cooldownUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await tx.update(users).set({
      heartboxCooldownUntil: cooldownUntil,
      updatedAt: now,
    }).where(eq(users.id, userId));

    await tx.update(heartSignals).set({
      status: 'cancelled',
      cancelledAt: now,
      updatedAt: now,
    }).where(and(
      eq(heartSignals.senderId, userId),
      eq(heartSignals.status, 'active'),
    ));
  });
}

export async function activateQueuedHeartboxMatches(limit = 20): Promise<number> {
  const nowIso = new Date().toISOString();
  const queuedRows = await db.select({
    id: heartMatches.id,
    userAId: heartMatches.userAId,
    userBId: heartMatches.userBId,
  }).from(heartMatches)
    .where(eq(heartMatches.status, 'queued'))
    .orderBy(heartMatches.createdAt)
    .limit(limit);

  if (queuedRows.length === 0) return 0;

  const activatedRows = await db.update(heartMatches)
    .set({ status: 'active', updatedAt: nowIso })
    .where(inArray(heartMatches.id, queuedRows.map((row) => row.id)))
    .returning({ id: heartMatches.id, userAId: heartMatches.userAId, userBId: heartMatches.userBId });

  const pausedUserIds = Array.from(new Set(activatedRows.flatMap((row) => [row.userAId, row.userBId])));
  if (pausedUserIds.length > 0) {
    await db.update(users).set(heartboxMainlinePausePatch(nowIso)).where(inArray(users.id, pausedUserIds));
  }

  await Promise.all(activatedRows.map((row) =>
    sendHeartboxMutualNotifications(row.id, [row.userAId, row.userBId]),
  ));
  return activatedRows.length;
}

export async function getCurrentHeartboxReveal(userId: string): Promise<HeartboxRevealResponse> {
  await ensureMergedAccountNotAllowed(userId);
  const matchRows = await db.select().from(heartMatches).where(and(
    or(eq(heartMatches.userAId, userId), eq(heartMatches.userBId, userId)),
    inArray(heartMatches.status, ['active', 'queued']),
  )).orderBy(desc(heartMatches.updatedAt), desc(heartMatches.createdAt)).limit(1);
  const heartMatch = matchRows[0];
  if (!heartMatch) throw new ValidationError('暂无可启封的心动信笺');

  if (heartMatch.status === 'queued') {
    const nowIso = new Date().toISOString();
    await db.update(heartMatches).set({ status: 'active', updatedAt: nowIso })
      .where(eq(heartMatches.id, heartMatch.id));
    await db.update(users).set(heartboxMainlinePausePatch(nowIso))
      .where(inArray(users.id, [heartMatch.userAId, heartMatch.userBId]));
  }

  const partnerId = heartMatch.userAId === userId ? heartMatch.userBId : heartMatch.userAId;
  const partnerRows = await db.select().from(users).where(eq(users.id, partnerId)).limit(1);
  const partner = partnerRows[0];
  if (!partner) throw new ValidationError('对方账号不存在');

  let contactPlatform = 'wechat';
  let contactId = partner.wechatId || '';
  if (contactId.includes(':')) {
    const parts = contactId.split(':');
    contactPlatform = parts[0] || 'wechat';
    contactId = parts.slice(1).join(':');
  }

  return {
    heartMatchId: heartMatch.id,
    status: 'active',
    specialLabel: '双向奔赴',
    createdAt: heartMatch.createdAt ?? null,
    updatedAt: heartMatch.updatedAt ?? null,
    legacyMainMatchId: heartMatch.mainMatchId ?? null,
    partner: {
      id: partner.id,
      nickname: partner.nickname,
      gender: partner.gender,
      department: partner.department,
      grade: partner.grade,
      campus: partner.campus,
      mbti: partner.mbti,
      bio: partner.bio,
      avatarUrl: partner.avatarUrl,
    },
    partnerContact: { contactPlatform, contactId },
    note: '这是一次彼此主动选择的连接。双向成立后，系统已自动暂停双方主线匹配，给这段心意留出更安静的开始。',
  };
}

async function sendHeartboxMutualNotifications(heartMatchId: string, userIds: string[]): Promise<void> {
  const eventKey = `heartbox:${heartMatchId}`;
  const usersRows = await db.select({
    id: users.id,
    email: users.email,
    emailNotifications: users.emailNotifications,
  }).from(users).where(inArray(users.id, userIds));

  const dedupeKey = eventKey;
  await Promise.all(usersRows.map(async (user) => {
    if (!user.emailNotifications) return;
    const inserted = await db.insert(mailLogs).values({
      userId: user.id,
      weekOf: dedupeKey,
      mailType: 'HEARTBOX_MUTUAL',
    }).onConflictDoNothing().returning({ id: mailLogs.id });
    if (inserted.length === 0) return;
    try {
      await sendHeartboxMutualEmail(user.email, {
        heartMatchId,
        reason: 'heartbox',
        specialLabel: '双向奔赴',
      });
    } catch (err) {
      await db.delete(mailLogs).where(and(
        eq(mailLogs.userId, user.id),
        eq(mailLogs.weekOf, dedupeKey),
        eq(mailLogs.mailType, 'HEARTBOX_MUTUAL'),
      ));
      console.error('[MAIL] heartbox mutual notifications failed:', err);
    }
  }));
}
