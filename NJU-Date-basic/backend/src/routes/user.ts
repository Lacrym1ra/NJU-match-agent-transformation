import { Router } from 'express';
import { z } from 'zod';
import { eq, or, and, desc, count, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db } from '../db/connection.js';
import {
  auditLogs,
  circleMatches,
  circleMemberLocationCooldowns,
  circleMemberLocations,
  circleMembers,
  contactUnlockRequests,
  friendRequests,
  friendships,
  globalFriendships,
  mailLogs,
  matches,
  teamupApplications,
  userBlocks,
  userNotifications,
  userReports,
  users,
} from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { isMatchingLocked } from '../utils/lockdown.js';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors.js';
import { getUpcomingWeekOf } from '../services/matchService.js';
import { buildCircleFriendPairCondition, buildGlobalFriendPairCondition } from '../modules/socialGraph/relationships.js';
import { getUserStats } from '../services/userService.js';
import { getCreditRecoveryStatus } from '../services/creditScoreService.js';

const router = Router();

const noHtml = /^[^<>]*$/;

const updateProfileSchema = z.object({
  nickname: z.string().min(1).max(20).regex(noHtml),
  gender: z.enum(['male', 'female']),
  genderPref: z.enum(['male', 'female', 'any']),
  intention: z.enum(['friend', 'partner']),
  grade: z.string().min(1).max(10),
  campus: z.enum(['xianlin', 'gulou', 'suzhou', 'pukou']),
  department: z.string().min(1).max(50).regex(noHtml),
  mbti: z.string().max(10).optional(),
  bio: z.string().max(200).regex(noHtml).optional(),
  signature: z.string().max(200).regex(noHtml).optional(),
  tags: z.array(z.string().trim().min(1).max(20)).max(10).optional(),
  contactPlatform: z.enum(['wechat', 'qq', 'xiaohongshu']).optional(), 
  contactId: z.string().max(50).regex(noHtml).optional(),
  emailNotifications: z.boolean().optional(),
});

const updateProfileDraftSchema = z.object({
  nickname: z.string().min(1).max(20).regex(noHtml).optional(),
  gender: z.enum(['male', 'female']).optional(),
  genderPref: z.enum(['male', 'female', 'any']).optional(),
  intention: z.enum(['friend', 'partner']).optional(),
  grade: z.string().min(1).max(10).optional(),
  campus: z.enum(['xianlin', 'gulou', 'suzhou', 'pukou']).optional(),
  department: z.string().min(1).max(50).regex(noHtml).optional(),
  mbti: z.string().max(10).optional(),
  signature: z.string().max(200).regex(noHtml).optional(),
  tags: z.array(z.string().trim().min(1).max(20)).max(10).optional(),
  emailNotifications: z.boolean().optional(),
}).refine(
  (data) => Object.values(data).some((value) => value !== undefined),
  { message: '至少提供一个可更新字段' },
);

const updateStatusSchema = z.object({
  isParticipating: z.boolean(),
});

const updateNotificationsSchema = z.object({
  emailNotifications: z.boolean(),
});

const updateSignatureSchema = z.object({
  signature: z.string().max(200).regex(noHtml).optional(),
});

const updateTagsSchema = z.object({
  tags: z.array(z.string().trim().min(1).max(20)).max(10),
});

const pauseWeekSchema = z.object({
  pause: z.boolean(),
});

function toPublicProfileUser(user: typeof users.$inferSelect) {
  const {
    passwordHash: _passwordHash,
    studentIdHash: _studentIdHash,
    studentIdLast4: _studentIdLast4,
    studentIdVerifiedAt: _studentIdVerifiedAt,
    studentIdBindSource: _studentIdBindSource,
    heartboxCooldownUntil: _heartboxCooldownUntil,
    wechatId: _wechatId,
    contactId: _contactId,
    contactPlatform: _contactPlatform,
    ...safeUser
  } = user as any;
  return safeUser;
}


// GET /user/profile
router.get('/profile', requireAuth, async (req, res, next) => {
  try {
    const rows = await db.select().from(users).where(eq(users.id, req.auth!.userId)).limit(1);
    const user = rows[0];
    if (!user) throw new NotFoundError('用户不存在');
    // Never expose contact info in profile GET (it's only shared via match result)
    
    // Simulate mapping back for the frontend until DB schema is updated
    let plt = 'wechat';
    let id = user.wechatId;
    if (user.wechatId && user.wechatId.includes(':')) {
      const parts = user.wechatId.split(':');
      plt = parts[0];
      id = parts.slice(1).join(':');
    }
    
    const safeUser = toPublicProfileUser(user);
    res.json({ ...safeUser, contactPlatform: plt, contactId: id });
  } catch (err) {
    next(err);
  }
});

// GET /user/stats
router.get('/stats', requireAuth, async (req, res, next) => {
  try {
    const stats = await getUserStats(req.auth!.userId);
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// GET /user/credit-status
router.get('/credit-status', requireAuth, async (req, res, next) => {
  try {
    const data = await getCreditRecoveryStatus(req.auth!.userId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// PUT /user/profile
router.put('/profile', requireAuth, validate(updateProfileSchema), async (req, res, next) => {
  try {
    const { nickname, gender, genderPref, intention, grade, campus, department, mbti, bio, signature, tags, contactPlatform, contactId, emailNotifications } = req.body;

    await db.update(users)
      .set({
        nickname,
        gender,
        genderPref,
        intention,
        grade,
        campus,
        department,
        mbti: mbti || null,
        bio: bio || null,
        signature: signature ?? null,
        tags: Array.isArray(tags) ? tags.map((tag) => tag.trim()).filter(Boolean).slice(0, 10) : [],
        wechatId: contactPlatform && contactId ? `${contactPlatform}:${contactId}` : null,
        emailNotifications: emailNotifications !== undefined ? emailNotifications : undefined,
        profileComplete: true,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, req.auth!.userId));

    const updatedRows = await db.select().from(users).where(eq(users.id, req.auth!.userId)).limit(1);
    const updated = updatedRows[0]!;
    
    // Simulate mapping back for the frontend until DB schema is updated
    let plt = 'wechat';
    let id = updated.wechatId;
    if (updated.wechatId && updated.wechatId.includes(':')) {
      const parts = updated.wechatId.split(':');
      plt = parts[0];
      id = parts.slice(1).join(':');
    }

    const safeUser = toPublicProfileUser(updated);
    res.json({ ...safeUser, contactPlatform: plt, contactId: id });
  } catch (err) {
    next(err);
  }
});

// PATCH /user/profile/draft
router.patch('/profile/draft', requireAuth, validate(updateProfileDraftSchema), async (req, res, next) => {
  try {
    const patch: Partial<typeof users.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    };

    if (req.body.nickname !== undefined) patch.nickname = req.body.nickname;
    if (req.body.gender !== undefined) patch.gender = req.body.gender;
    if (req.body.genderPref !== undefined) patch.genderPref = req.body.genderPref;
    if (req.body.intention !== undefined) patch.intention = req.body.intention;
    if (req.body.grade !== undefined) patch.grade = req.body.grade;
    if (req.body.campus !== undefined) patch.campus = req.body.campus;
    if (req.body.department !== undefined) patch.department = req.body.department;
    if (req.body.mbti !== undefined) patch.mbti = req.body.mbti;
    if (req.body.signature !== undefined) patch.signature = req.body.signature?.trim() ? req.body.signature.trim() : null;
    if (req.body.tags !== undefined) patch.tags = req.body.tags.map((tag: string) => tag.trim()).filter(Boolean).slice(0, 10);
    if (req.body.emailNotifications !== undefined) patch.emailNotifications = req.body.emailNotifications;

    await db.update(users)
      .set(patch)
      .where(eq(users.id, req.auth!.userId));

    const updatedRows = await db.select().from(users).where(eq(users.id, req.auth!.userId)).limit(1);
    const updated = updatedRows[0]!;

    let plt = 'wechat';
    let id = updated.wechatId;
    if (updated.wechatId && updated.wechatId.includes(':')) {
      const parts = updated.wechatId.split(':');
      plt = parts[0];
      id = parts.slice(1).join(':');
    }

    const safeUser = toPublicProfileUser(updated);
    res.json({ ...safeUser, contactPlatform: plt, contactId: id });
  } catch (err) {
    next(err);
  }
});

// PATCH /user/profile/signature
router.patch('/profile/signature', requireAuth, validate(updateSignatureSchema), async (req, res, next) => {
  try {
    const signature = req.body.signature?.trim() ? req.body.signature.trim() : null;

    await db.update(users)
      .set({ signature, updatedAt: new Date().toISOString() })
      .where(eq(users.id, req.auth!.userId));

    res.json({ signature });
  } catch (err) {
    next(err);
  }
});

// PATCH /user/profile/tags
router.patch('/profile/tags', requireAuth, validate(updateTagsSchema), async (req, res, next) => {
  try {
    const tags = req.body.tags.map((tag: string) => tag.trim()).filter(Boolean).slice(0, 10);

    await db.update(users)
      .set({ tags, updatedAt: new Date().toISOString() })
      .where(eq(users.id, req.auth!.userId));

    res.json({ tags });
  } catch (err) {
    next(err);
  }
});

// PATCH /user/status
router.patch('/status', requireAuth, validate(updateStatusSchema), async (req, res, next) => {
  try {
    if (isMatchingLocked()) {
      throw new ValidationError('本周匹配已锁定，参与状态将于下周一重新开放修改');
    }
    if (req.body.isParticipating) {
      const [userRow] = await db
        .select({ creditScore: users.creditScore })
        .from(users)
        .where(eq(users.id, req.auth!.userId))
        .limit(1);
      const creditScore = userRow?.creditScore ?? 100;
      if (creditScore <= 90) {
        throw new ValidationError('当前信用分未达标（需高于 90 分） ，暂不可恢复匹配');
      }
    }

    await db.update(users)
      .set({
        isParticipating: req.body.isParticipating,
        // 重新开启时一并清除本周暂停和自动暂停记录
        ...(req.body.isParticipating ? { pauseUntilWeek: null, autoPausedAt: null } : {}),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, req.auth!.userId));

    res.json({
      isParticipating: req.body.isParticipating,
      message: req.body.isParticipating ? '已开启匹配' : '已长期停止匹配',
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /user/pause-week — 暂停本周匹配（下周自动恢复）
router.patch('/pause-week', requireAuth, validate(pauseWeekSchema), async (req, res, next) => {
  try {
    if (isMatchingLocked()) {
      throw new ValidationError('本周匹配已锁定，无法修改参与状态');
    }
    const { pause } = req.body as { pause: boolean };
    if (!pause) {
      const [userRow] = await db
        .select({ creditScore: users.creditScore })
        .from(users)
        .where(eq(users.id, req.auth!.userId))
        .limit(1);
      const creditScore = userRow?.creditScore ?? 100;
      if (creditScore <= 90) {
        throw new ValidationError('当前信用分未达标（需高于 90 分） ，暂不可恢复匹配');
      }
    }
    const pauseUntilWeek = pause ? getUpcomingWeekOf() : null;
    await db.update(users)
      .set({ pauseUntilWeek, updatedAt: new Date().toISOString() })
      .where(eq(users.id, req.auth!.userId));
    res.json({
      pauseUntilWeek,
      message: pause ? '已暂停本周匹配，下周将自动恢复' : '已恢复本周参与',
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /user/notifications
router.patch('/notifications', requireAuth, validate(updateNotificationsSchema), async (req, res, next) => {
  try {
    await db.update(users)
      .set({
        emailNotifications: req.body.emailNotifications,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, req.auth!.userId));

    res.json({
      emailNotifications: req.body.emailNotifications,
      message: req.body.emailNotifications ? '已开启邮件提醒' : '已关闭邮件提醒',
    });
  } catch (err) {
    next(err);
  }
});

// ─── Notifications ──────────────────────────────────────────────

// GET /user/notifications/unread-count — must be before /:id routes
router.get('/notifications/unread-count', requireAuth, async (req, res, next) => {
  try {
    const [row] = await db
      .select({ count: count() })
      .from(userNotifications)
      .where(
        and(
          eq(userNotifications.userId, req.auth!.userId),
          eq(userNotifications.isRead, false),
        ),
      );
    res.json({ unreadCount: row?.count ?? 0 });
  } catch (err) {
    next(err);
  }
});

// GET /user/notifications — list notifications
router.get('/notifications', requireAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;
    const isRead = req.query.isRead as string | undefined;
    const type = req.query.type as string | undefined;

    const conditions = [eq(userNotifications.userId, req.auth!.userId)];
    if (isRead === 'true') conditions.push(eq(userNotifications.isRead, true));
    else if (isRead === 'false') conditions.push(eq(userNotifications.isRead, false));
    if (type) conditions.push(eq(userNotifications.type, type));

    const where = and(...conditions);

    const [totalRow] = await db
      .select({ count: count() })
      .from(userNotifications)
      .where(where);

    const rows = await db
      .select({
        id: userNotifications.id,
        type: userNotifications.type,
        title: userNotifications.title,
        content: userNotifications.content,
        meta: userNotifications.meta,
        isRead: userNotifications.isRead,
        createdAt: userNotifications.createdAt,
      })
      .from(userNotifications)
      .where(where)
      .orderBy(desc(userNotifications.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({ total: totalRow.count, page, limit, notifications: rows });
  } catch (err) {
    next(err);
  }
});

// PATCH /user/notifications/read-all — mark all as read
router.patch('/notifications/read-all', requireAuth, async (req, res, next) => {
  try {
    const result = await db
      .update(userNotifications)
      .set({ isRead: true })
      .where(
        and(
          eq(userNotifications.userId, req.auth!.userId),
          eq(userNotifications.isRead, false),
        ),
      );
    res.json({ message: '已全部标为已读' });
  } catch (err) {
    next(err);
  }
});

// PATCH /user/notifications/:id/read — mark one notification as read
router.patch('/notifications/:id/read', requireAuth, async (req, res, next) => {
  try {
    const [row] = await db
      .select({ id: userNotifications.id, userId: userNotifications.userId })
      .from(userNotifications)
      .where(eq(userNotifications.id, req.params.id as string))
      .limit(1);

    if (!row) throw new NotFoundError('通知不存在');
    if (row.userId !== req.auth!.userId) throw new NotFoundError('通知不存在');

    await db
      .update(userNotifications)
      .set({ isRead: true })
      .where(eq(userNotifications.id, row.id));

    res.json({ message: '已标为已读' });
  } catch (err) {
    next(err);
  }
});

// DELETE /user/account — anonymize PII and deactivate; match records are retained for integrity
router.delete('/account', requireAuth, async (req, res, next) => {
  try {
    const userId = req.auth!.userId;

    // Scrub all PII from the user row; keep the row so FK references in matches survive
    await db.update(users).set({
      email: `deleted_${userId}@njumatch.invalid`,
      passwordHash: null,
      nickname: null,
      gender: null,
      genderPref: null,
      intention: null,
      grade: null,
      campus: null,
      department: null,
      mbti: null,
      bio: null,
      signature: null,
      tags: [],
      avatarUrl: null,
      wechatId: null,
      isParticipating: false,
      pauseUntilWeek: null,
      autoPausedAt: null,
      emailNotifications: false,
      profileComplete: false,
      surveyComplete: false,
      updatedAt: new Date().toISOString(),
    }).where(eq(users.id, userId));

    // Keep survey answers for aggregate analysis; the anonymized user row removes direct identity linkage.
    await db.delete(mailLogs).where(eq(mailLogs.userId, userId));
    await db.delete(userBlocks).where(or(eq(userBlocks.blockerId, userId), eq(userBlocks.blockedId, userId)));
    await db.delete(circleMemberLocations).where(eq(circleMemberLocations.userId, userId));
    await db.delete(circleMemberLocationCooldowns).where(eq(circleMemberLocationCooldowns.userId, userId));
    // Leave match records intact (anonymized user row already de-identifies them)
    // Circle memberships are deactivated rather than deleted to preserve group integrity
    await db.update(circleMembers).set({ isActive: false, answers: null }).where(eq(circleMembers.userId, userId));

    res.json({ message: '账户已注销，个人信息已清除' });
  } catch (err) {
    next(err);
  }
});

// ─── Block & Report ────────────────────────────────────────────

const reportReasonEnum = z.enum(['harassment', 'spam', 'fake_profile', 'inappropriate_content', 'other']);

const reportSchema = z.union([
  z.object({
    reasons: z.array(reportReasonEnum).min(1).max(5),
    detail: z.string().max(500).optional(),
  }),
  z.object({
    reason: reportReasonEnum,
    detail: z.string().max(500).optional(),
  }),
]);

// POST /user/block/:targetId — block a user
router.post('/block/:targetId', requireAuth, async (req, res, next) => {
  try {
    const blockerId = req.auth!.userId;
    const blockedId = req.params.targetId as string;

    if (blockerId === blockedId) throw new ValidationError('不能拉黑自己');

    const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, blockedId)).limit(1);
    if (!target) throw new NotFoundError('用户不存在');

    const now = new Date().toISOString();
    const result = await db.transaction(async (tx) => {
      await tx.insert(userBlocks)
        .values({ id: randomUUID(), blockerId, blockedId, createdAt: now })
        .onConflictDoNothing();

      const rejectedFriendRequests = await tx.update(friendRequests)
        .set({ status: 'rejected', updatedAt: now })
        .where(and(
          eq(friendRequests.status, 'pending'),
          or(
            and(eq(friendRequests.senderId, blockerId), eq(friendRequests.receiverId, blockedId)),
            and(eq(friendRequests.senderId, blockedId), eq(friendRequests.receiverId, blockerId)),
          ),
        ))
        .returning({ id: friendRequests.id });

      const rejectedContactRequests = await tx.update(contactUnlockRequests)
        .set({ status: 'rejected', updatedAt: now })
        .where(and(
          eq(contactUnlockRequests.status, 'pending'),
          or(
            and(eq(contactUnlockRequests.requesterId, blockerId), eq(contactUnlockRequests.targetId, blockedId)),
            and(eq(contactUnlockRequests.requesterId, blockedId), eq(contactUnlockRequests.targetId, blockerId)),
          ),
        ))
        .returning({ id: contactUnlockRequests.id });

      const deletedContactUnlocks = await tx.delete(contactUnlockRequests)
        .where(and(
          eq(contactUnlockRequests.status, 'approved'),
          or(
            and(eq(contactUnlockRequests.requesterId, blockerId), eq(contactUnlockRequests.targetId, blockedId)),
            and(eq(contactUnlockRequests.requesterId, blockedId), eq(contactUnlockRequests.targetId, blockerId)),
          ),
        ))
        .returning({ id: contactUnlockRequests.id });

      const deletedCircleFriendships = await tx.delete(friendships)
        .where(buildCircleFriendPairCondition(blockerId, blockedId))
        .returning({ id: friendships.id });

      const deletedGlobalFriendships = await tx.delete(globalFriendships)
        .where(buildGlobalFriendPairCondition(blockerId, blockedId))
        .returning({ id: globalFriendships.id });

      const withdrawnMyApplications = await tx.update(teamupApplications)
        .set({ status: 'withdrawn', updatedAt: now })
        .where(and(
          eq(teamupApplications.applicantId, blockerId),
          eq(teamupApplications.status, 'pending'),
          sql`${teamupApplications.teamupId} IN (
            SELECT id
            FROM teamups
            WHERE leader_id = ${blockedId}
          )`,
        ))
        .returning({ id: teamupApplications.id });

      const rejectedTheirApplications = await tx.update(teamupApplications)
        .set({
          status: 'rejected',
          reviewedBy: blockerId,
          reviewNote: null,
          reviewedAt: now,
          updatedAt: now,
        })
        .where(and(
          eq(teamupApplications.applicantId, blockedId),
          eq(teamupApplications.status, 'pending'),
          sql`${teamupApplications.teamupId} IN (
            SELECT id
            FROM teamups
            WHERE leader_id = ${blockerId}
          )`,
        ))
        .returning({ id: teamupApplications.id });

      await tx.insert(auditLogs).values({
        operatorId: blockerId,
        action: 'user_blocked',
        target: blockedId,
        detail: JSON.stringify({
          rejectedFriendRequestCount: rejectedFriendRequests.length,
          rejectedContactRequestCount: rejectedContactRequests.length,
          deletedContactUnlockCount: deletedContactUnlocks.length,
          deletedCircleFriendshipCount: deletedCircleFriendships.length,
          deletedGlobalFriendshipCount: deletedGlobalFriendships.length,
          withdrawnTeamupApplicationCount: withdrawnMyApplications.length,
          rejectedTeamupApplicationCount: rejectedTheirApplications.length,
        }),
        createdAt: now,
      });

      return {
        rejectedFriendRequestCount: rejectedFriendRequests.length,
        rejectedContactRequestCount: rejectedContactRequests.length,
        deletedContactUnlockCount: deletedContactUnlocks.length,
        deletedCircleFriendshipCount: deletedCircleFriendships.length,
        deletedGlobalFriendshipCount: deletedGlobalFriendships.length,
        withdrawnTeamupApplicationCount: withdrawnMyApplications.length,
        rejectedTeamupApplicationCount: rejectedTheirApplications.length,
      };
    });

    res.json({ message: '已拉黑该用户，并撤销相关好友、联系方式和待处理申请', ...result });
  } catch (err) {
    next(err);
  }
});

// GET /user/block/:targetId — check if current user has blocked target user
router.get('/block/:targetId', requireAuth, async (req, res, next) => {
  try {
    const blockerId = req.auth!.userId;
    const blockedId = req.params.targetId as string;

    if (blockerId === blockedId) {
      res.json({ blocked: false });
      return;
    }

    const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, blockedId)).limit(1);
    if (!target) throw new NotFoundError('用户不存在');

    const rows = await db.select({ id: userBlocks.id }).from(userBlocks).where(and(
      eq(userBlocks.blockerId, blockerId),
      eq(userBlocks.blockedId, blockedId),
    )).limit(1);

    res.json({ blocked: rows.length > 0 });
  } catch (err) {
    next(err);
  }
});

// DELETE /user/block/:targetId — unblock a user
router.delete('/block/:targetId', requireAuth, async (req, res, next) => {
  try {
    const blockerId = req.auth!.userId;
    const blockedId = req.params.targetId as string;

    await db.delete(userBlocks)
      .where(and(
        eq(userBlocks.blockerId, blockerId),
        eq(userBlocks.blockedId, blockedId)
      ));

    res.json({ message: '已解除拉黑' });
  } catch (err) {
    next(err);
  }
});

// POST /user/report/:targetId — report a user
router.post('/report/:targetId', requireAuth, validate(reportSchema), async (req, res, next) => {
  try {
    const reporterId = req.auth!.userId;
    const reportedId = req.params.targetId as string;

    if (reporterId === reportedId) throw new ValidationError('不能举报自己');

    const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, reportedId)).limit(1);
    if (!target) throw new NotFoundError('用户不存在');

    const providedReasons = 'reasons' in req.body ? req.body.reasons : [req.body.reason];
    const normalizedReasons = Array.from(new Set(providedReasons));
    const reasonValue = normalizedReasons.join(',');

    const [existingPending] = await db
      .select({ id: userReports.id })
      .from(userReports)
      .where(and(
        eq(userReports.reporterId, reporterId),
        eq(userReports.reportedId, reportedId),
        eq(userReports.status, 'pending'),
      ))
      .orderBy(desc(userReports.createdAt))
      .limit(1);

    if (existingPending) {
      await db.update(userReports)
        .set({
          reason: reasonValue,
          detail: req.body.detail ?? null,
          createdAt: new Date().toISOString(),
        })
        .where(eq(userReports.id, existingPending.id));
    } else {
      await db.insert(userReports).values({
        id: randomUUID(),
        reporterId,
        reportedId,
        reason: reasonValue,
        detail: req.body.detail ?? null,
        status: 'pending',
      });
    }

    res.json({ message: '举报已提交，我们将尽快处理' });
  } catch (err) {
    next(err);
  }
});

export default router;
