import { and, eq, isNull, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection.js';
import { forumComments, forumPosts, forumReports, creditScoreLogs, users } from '../db/schema.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors.js';
import { requirePostAccess } from './forumService.js';

export type ForumReportTargetType = 'post' | 'comment' | 'user';
export type ForumReportStatus = 'pending' | 'approved' | 'rejected';
export type ForumReportReason =
  | 'pornographic'
  | 'violent'
  | 'personal_attack'
  | 'provocation'
  | 'ad_spam'
  | 'junk_info'
  | 'privacy_violation'
  | 'other';

const FORUM_REPORT_REASON_SET = new Set<ForumReportReason>([
  'pornographic',
  'violent',
  'personal_attack',
  'provocation',
  'ad_spam',
  'junk_info',
  'privacy_violation',
  'other',
]);

const REPORT_REASON_MAX_LEN = 200;
const REPORT_DETAIL_MAX_LEN = 2000;
const CREDIT_MAX = 100;
const CREDIT_LIMITED_THRESHOLD = 90;
const CREDIT_BANNED_THRESHOLD = 85;
const VIOLATION_DELETED_COMMENT_TEXT = '该评论已因违规被删除';

function getUpcomingWeekOf(date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const daysUntilNextWed = ((3 - day + 7) % 7) || 7;
  d.setDate(d.getDate() + daysUntilNextWed);
  return d.toISOString().slice(0, 10);
}

function toCreditLevel(score: number): 'normal' | 'limited' | 'banned' {
  if (score <= CREDIT_BANNED_THRESHOLD) return 'banned';
  if (score <= CREDIT_LIMITED_THRESHOLD) return 'limited';
  return 'normal';
}

function resolveForumPenalty(manualPenaltyScore?: number): 1 | 3 | 5 {
  if (manualPenaltyScore !== 1 && manualPenaltyScore !== 3 && manualPenaltyScore !== 5) {
    throw new ValidationError('审核通过时，管理员必须手动选择扣分（1/3/5）');
  }
  return manualPenaltyScore;
}

export async function submitForumReport(input: {
  reporterId: string;
  targetType: ForumReportTargetType;
  postId?: string;
  commentId?: string;
  reportedUserId?: string;
  reasons: ForumReportReason[];
  detail?: string;
}) {
  const reasons = [...new Set(input.reasons)];
  const reason = reasons.join(',');
  const detail = input.detail?.trim() || null;
  if (reasons.length === 0 || reasons.length > 8 || reason.length > REPORT_REASON_MAX_LEN) {
    throw new ValidationError('举报原因标签数量需在 1-8 个以内');
  }
  if (reasons.some((tag) => !FORUM_REPORT_REASON_SET.has(tag))) {
    throw new ValidationError('举报原因标签不合法');
  }
  if (detail && detail.length > REPORT_DETAIL_MAX_LEN) {
    throw new ValidationError('补充说明长度不能超过 2000 字符');
  }

  if (input.targetType === 'post' && !input.postId) throw new ValidationError('缺少帖子 ID');
  if (input.targetType === 'comment' && !input.commentId) throw new ValidationError('缺少评论 ID');
  if (input.targetType === 'user' && !input.reportedUserId) throw new ValidationError('缺少被举报用户 ID');

  let reportedUserId: string | null = null;
  if (input.targetType === 'post') {
    if (!input.postId) throw new ValidationError('缺少帖子 ID');
    const [post] = await db
      .select({ id: forumPosts.id, userId: forumPosts.userId, deletedAt: forumPosts.deletedAt })
      .from(forumPosts)
      .where(eq(forumPosts.id, input.postId))
      .limit(1);

    if (!post || post.deletedAt) throw new NotFoundError('举报目标帖子不存在');
    if (post.userId === input.reporterId) throw new ForbiddenError('不能举报自己的内容');

    // Verify reporter has access to the post (e.g. not a private post they can't see)
    await requirePostAccess(input.postId, input.reporterId, db);

    reportedUserId = post.userId;
  } else if (input.targetType === 'comment') {
    if (!input.commentId) throw new ValidationError('缺少评论 ID');
    const [comment] = await db
      .select({
        id: forumComments.id,
        userId: forumComments.userId,
        postId: forumComments.postId,
        deletedAt: forumComments.deletedAt,
        postDeletedAt: forumPosts.deletedAt,
      })
      .from(forumComments)
      .innerJoin(forumPosts, eq(forumComments.postId, forumPosts.id))
      .where(eq(forumComments.id, input.commentId))
      .limit(1);

    if (!comment || comment.deletedAt || comment.postDeletedAt) {
      throw new NotFoundError('举报目标评论不存在');
    }
    if (comment.userId === input.reporterId) throw new ForbiddenError('不能举报自己的内容');

    // Verify reporter has access to the post the comment belongs to
    await requirePostAccess(comment.postId, input.reporterId, db);

    reportedUserId = comment.userId;
  } else {
    if (!input.reportedUserId) throw new ValidationError('缺少被举报用户 ID');
    if (input.reportedUserId === input.reporterId) throw new ForbiddenError('不能举报自己');
    const [reportedUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, input.reportedUserId))
      .limit(1);

    if (!reportedUser) throw new NotFoundError('举报目标用户不存在');
    reportedUserId = reportedUser.id;
  }

  const targetConditions = input.targetType === 'post'
    ? and(eq(forumReports.postId, input.postId as string), isNull(forumReports.commentId))
    : input.targetType === 'comment'
      ? and(eq(forumReports.commentId, input.commentId as string))
      : and(eq(forumReports.reportedUserId, reportedUserId), isNull(forumReports.postId), isNull(forumReports.commentId));

  // Priority 1: same reporter + same target -> always treat as duplicate report.
  const [duplicateByReporter] = await db
    .select({ id: forumReports.id })
    .from(forumReports)
    .where(and(
      eq(forumReports.reporterId, input.reporterId),
      eq(forumReports.targetType, input.targetType),
      targetConditions,
    ))
    .limit(1);

  if (duplicateByReporter) {
    throw new ValidationError('重复举报，请求失败！');
  }

  // Priority 2: if content already approved and this is not a duplicate by reporter,
  // return success to reporter but do not create/retain admin pending tickets.
  const approvedTargetWhere = input.targetType === 'post'
    ? and(eq(forumReports.targetType, 'post'), eq(forumReports.postId, input.postId as string), eq(forumReports.status, 'approved'))
    : input.targetType === 'comment'
      ? and(eq(forumReports.targetType, 'comment'), eq(forumReports.commentId, input.commentId as string), eq(forumReports.status, 'approved'))
      : and(eq(forumReports.targetType, 'user'), eq(forumReports.reportedUserId, reportedUserId), isNull(forumReports.postId), isNull(forumReports.commentId), eq(forumReports.status, 'approved'));
  const [approvedReport] = await db
    .select({ id: forumReports.id })
    .from(forumReports)
    .where(approvedTargetWhere)
    .limit(1);
  if (approvedReport) {
    const pendingTargetWhere = input.targetType === 'post'
      ? and(eq(forumReports.targetType, 'post'), eq(forumReports.postId, input.postId as string), eq(forumReports.status, 'pending'))
      : input.targetType === 'comment'
        ? and(eq(forumReports.targetType, 'comment'), eq(forumReports.commentId, input.commentId as string), eq(forumReports.status, 'pending'))
        : and(eq(forumReports.targetType, 'user'), eq(forumReports.reportedUserId, reportedUserId), isNull(forumReports.postId), isNull(forumReports.commentId), eq(forumReports.status, 'pending'));
    await db.delete(forumReports).where(pendingTargetWhere);
    return { reportId: approvedReport.id, status: 'pending' as ForumReportStatus, message: '举报已提交，等待管理员审核' };
  }

  const id = uuidv4();
  await db.insert(forumReports).values({
    id,
    reporterId: input.reporterId,
    reportedUserId: reportedUserId as string,
    targetType: input.targetType,
    postId: input.targetType === 'post' ? (input.postId as string) : null,
    commentId: input.targetType === 'comment' ? (input.commentId as string) : null,
    reason,
    detail,
    status: 'pending',
  });

  return { reportId: id, status: 'pending' as ForumReportStatus, message: '举报已提交，等待管理员审核' };
}

export async function reviewForumReport(input: {
  reportId: string;
  action: 'approve' | 'reject';
  adminNote?: string;
  operatorId?: string | null;
  penaltyScore?: number;
}) {
  const adminNote = input.adminNote?.trim() || null;
  if (adminNote && adminNote.length > 500) {
    throw new ValidationError('管理员备注不能超过 500 字符');
  }

  return db.transaction(async (tx) => {
    const [report] = await tx
      .select()
      .from(forumReports)
      .where(eq(forumReports.id, input.reportId))
      .limit(1);

    if (!report) throw new NotFoundError('举报单不存在');
    if (report.status !== 'pending') {
      throw new ValidationError('该举报单已处理，不能重复审核');
    }

    if (input.action === 'approve') {
      const duplicateWhere = report.targetType === 'post'
        ? and(eq(forumReports.targetType, 'post'), eq(forumReports.postId, report.postId!))
        : report.targetType === 'comment'
          ? and(eq(forumReports.targetType, 'comment'), eq(forumReports.commentId, report.commentId!))
          : and(eq(forumReports.targetType, 'user'), eq(forumReports.reportedUserId, report.reportedUserId), isNull(forumReports.postId), isNull(forumReports.commentId));
      const [alreadyApproved] = await tx
        .select({ id: forumReports.id })
        .from(forumReports)
        .where(and(eq(forumReports.status, 'approved'), duplicateWhere))
        .limit(1);
      if (alreadyApproved) {
        throw new ValidationError('该内容已有举报通过记录，不能重复通过');
      }
    }

    const [updated] = await tx
      .update(forumReports)
      .set({
        status: input.action === 'approve' ? 'approved' : 'rejected',
        adminNote,
        reviewedBy: input.operatorId ?? null,
        reviewedAt: sql`NOW()`,
        updatedAt: sql`NOW()`,
      })
      .where(and(eq(forumReports.id, input.reportId), eq(forumReports.status, 'pending')))
      .returning();

    if (!updated) {
      throw new ValidationError('该举报单已处理，不能重复审核');
    }

    let creditChanged = false;
    let creditScoreAfter: number | null = null;
    let penaltyScore: 1 | 3 | 5 | null = null;
    if (input.action === 'approve') {
      penaltyScore = resolveForumPenalty(input.penaltyScore);

      if (updated.postId) {
        await tx
          .update(forumPosts)
          .set({ deletedAt: sql`NOW()` })
          .where(and(eq(forumPosts.id, updated.postId), isNull(forumPosts.deletedAt)));
      } else if (updated.commentId) {
        const [deletedComment] = await tx
          .update(forumComments)
          .set({
            deletedAt: sql`NOW()`,
            content: VIOLATION_DELETED_COMMENT_TEXT,
          })
          .where(and(eq(forumComments.id, updated.commentId), isNull(forumComments.deletedAt)))
          .returning({ postId: forumComments.postId });

        if (deletedComment) {
          await tx
            .update(forumPosts)
            .set({
              commentCount: sql`GREATEST(${forumPosts.commentCount} - 1, 0)`,
              pinnedCommentId: sql`CASE WHEN ${forumPosts.pinnedCommentId} = ${updated.commentId} THEN NULL ELSE ${forumPosts.pinnedCommentId} END`,
            } as any)
            .where(eq(forumPosts.id, deletedComment.postId));
        }
      }

      const sameTargetWhere = updated.targetType === 'post'
        ? and(eq(forumReports.targetType, 'post'), eq(forumReports.postId, updated.postId!))
        : and(eq(forumReports.targetType, 'comment'), eq(forumReports.commentId, updated.commentId!));
      await tx.delete(forumReports).where(and(sameTargetWhere, sql`${forumReports.id} <> ${updated.id}`));

      const offenderUserId = updated.reportedUserId;
      if (!offenderUserId) throw new NotFoundError('无法定位被举报用户');

      const [userRow] = await tx.select({ id: users.id, creditScore: users.creditScore }).from(users).where(eq(users.id, offenderUserId)).limit(1);
      if (!userRow) throw new NotFoundError('被举报用户不存在');

      const nextScore = Math.max(0, (userRow.creditScore ?? CREDIT_MAX) - penaltyScore);
      const nextLevel = toCreditLevel(nextScore);
      const shouldPauseWeek = nextScore <= CREDIT_LIMITED_THRESHOLD;

      await tx.update(users).set({
        creditScore: nextScore,
        creditLevel: nextLevel,
        pauseUntilWeek: shouldPauseWeek ? getUpcomingWeekOf() : undefined,
        isParticipating: shouldPauseWeek ? false : undefined,
        updatedAt: sql`NOW()`,
      }).where(eq(users.id, offenderUserId));

      await tx.insert(creditScoreLogs).values({
        id: uuidv4(),
        userId: offenderUserId,
        delta: -penaltyScore,
        reason: `forum_report_approved_l${penaltyScore === 1 ? 1 : penaltyScore === 3 ? 2 : 3}`,
        sourceType: 'forum_report',
        sourceId: updated.id,
      });

      creditChanged = true;
      creditScoreAfter = nextScore;

      // Future extension point:
      // 1) push forum governance message into personal forum home message center
      // 2) notify accused user via in-site channel when available
    }

    return {
      report: updated,
      creditChanged,
      creditScoreAfter,
      penaltyScore,
    };
  });
}

export async function listForumReports(options: {
  status: 'pending' | 'approved' | 'rejected' | 'all';
  page: number;
  limit: number;
}) {
  const offset = (options.page - 1) * options.limit;
  const where = options.status === 'all' ? undefined : eq(forumReports.status, options.status);

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(forumReports)
    .where(where);

  const rows = await db
    .select({
      id: forumReports.id,
      reporterId: forumReports.reporterId,
      targetType: forumReports.targetType,
      postId: forumReports.postId,
      commentId: forumReports.commentId,
      reportedUserId: forumReports.reportedUserId,
      reason: forumReports.reason,
      detail: forumReports.detail,
      status: forumReports.status,
      adminNote: forumReports.adminNote,
      reviewedBy: forumReports.reviewedBy,
      reviewedAt: forumReports.reviewedAt,
      createdAt: forumReports.createdAt,
      updatedAt: forumReports.updatedAt,
      reporterNickname: users.nickname,
      reportedNickname: sql<string | null>`reported_user.nickname`,
      targetContent: sql<string | null>`COALESCE(target_post.content, target_comment.content)`,
    })
    .from(forumReports)
    .innerJoin(users, eq(forumReports.reporterId, users.id))
    .leftJoin(sql`users reported_user`, eq(forumReports.reportedUserId, sql`reported_user.id`))
    .leftJoin(sql`forum_posts target_post`, eq(forumReports.postId, sql`target_post.id`))
    .leftJoin(sql`forum_comments target_comment`, eq(forumReports.commentId, sql`target_comment.id`))
    .where(where)
    .orderBy(sql`${forumReports.createdAt} DESC`)
    .limit(options.limit)
    .offset(offset);

  return {
    total: totalRow?.count ?? 0,
    page: options.page,
    limit: options.limit,
    reports: rows,
  };
}

export async function listForumCreditUsers(options: { page: number; limit: number }) {
  const offset = (options.page - 1) * options.limit;

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users);

  const latestApproved = sql<string | null>`
    (
      SELECT MAX(fr.reviewed_at)
      FROM forum_reports fr
      WHERE fr.reported_user_id = ${users.id}
        AND fr.status = 'approved'
    )
  `;

  const approvedCount = sql<number>`
    (
      SELECT COUNT(*)::int
      FROM forum_reports fr
      WHERE fr.reported_user_id = ${users.id}
        AND fr.status = 'approved'
    )
  `;

  const totalReportCount = sql<number>`
    (
      SELECT COUNT(*)::int
      FROM forum_reports fr
      WHERE fr.reported_user_id = ${users.id}
    )
  `;

  const rows = await db
    .select({
      userId: users.id,
      nickname: users.nickname,
      email: users.email,
      creditScore: users.creditScore,
      creditLevel: users.creditLevel,
      latestApprovedAt: latestApproved,
      approvedReportCount: approvedCount,
      totalReportCount,
    })
    .from(users)
    .orderBy(sql`${latestApproved} DESC NULLS LAST, ${users.createdAt} DESC`)
    .limit(options.limit)
    .offset(offset);

  return {
    total: totalRow?.count ?? 0,
    page: options.page,
    limit: options.limit,
    users: rows,
  };
}

export async function listForumReportsByReportedUser(userId: string) {
  const rows = await db
    .select({
      id: forumReports.id,
      reporterId: forumReports.reporterId,
      reporterNickname: users.nickname,
      targetType: forumReports.targetType,
      postId: forumReports.postId,
      commentId: forumReports.commentId,
      reason: forumReports.reason,
      detail: forumReports.detail,
      status: forumReports.status,
      adminNote: forumReports.adminNote,
      reviewedAt: forumReports.reviewedAt,
      createdAt: forumReports.createdAt,
    })
    .from(forumReports)
    .innerJoin(users, eq(forumReports.reporterId, users.id))
    .where(eq(forumReports.reportedUserId, userId))
    .orderBy(
      sql`CASE WHEN ${forumReports.status} = 'approved' THEN 1 ELSE 0 END ASC`,
      sql`${forumReports.createdAt} DESC`,
    );

  return { reports: rows };
}
