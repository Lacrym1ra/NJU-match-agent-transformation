import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { db } from '../db/connection.js';
import { users } from '../db/schema.js';
import {
  getCurrentMatch,
  getCurrentWeekOf,
  recordAction,
  getMatchHistory,
} from '../services/matchService.js';
import { matches } from '../db/schema.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';
import { generateDimensionInsights } from '../matching/insights.js';
import { ensureMergedAccountNotAllowed } from '../services/studentIdService.js';

const router = Router();

function getNextRevealAt(weekOf: string): string {
  const nextWed = new Date(`${weekOf}T12:00:00Z`);
  nextWed.setUTCDate(nextWed.getUTCDate() + 7);
  const nextWeekOf = nextWed.toISOString().split('T')[0];
  return `${nextWeekOf}T20:00:00+08:00`;
}

const actionSchema = z.object({
  matchId: z.string().uuid(),
  action: z.enum(['ACCEPT', 'REJECT']),
});

// GET /match/current
router.get('/current', requireAuth, async (req, res, next) => {
  try {
    await ensureMergedAccountNotAllowed(req.auth!.userId);
    const match = await getCurrentMatch(req.auth!.userId);

    if (!match) {
      const weekOf = getCurrentWeekOf();
      const now = new Date();
      const revealTime = new Date(`${weekOf}T20:00:00+08:00`);

      if (now.getTime() < revealTime.getTime()) {
        // 本周匹配尚未揭晓，显示等待倒计时
        res.json({
          status: 'WAITING',
          revealAt: `${weekOf}T20:00:00+08:00`,
        });
      } else {
        // 本周揭晓已过，确实没有匹配到
        res.json({
          status: 'NO_MATCH',
          nextRevealAt: getNextRevealAt(weekOf),
          message: '本周暂未找到与你灵魂共振的人，下周再试',
        });
      }
      return;
    }

    if (match.status === 'LOCKED') {
      const weekOf = getCurrentWeekOf();
      // Reveal time: Wednesday 20:00 Beijing time
      const revealAt = `${weekOf}T20:00:00+08:00`;
      res.json({
        status: 'PENDING',
        revealAt,
        message: '本周锦书尚未送达，请耐心等候',
      });
      return;
    }

    // Match is available to view — build response payload first.
    const isUserA = match.userAId === req.auth!.userId;
    const partnerId = isUserA ? match.userBId : match.userAId;
    const myAction = isUserA ? match.userAAction : match.userBAction;
    const partnerAction = isUserA ? match.userBAction : match.userAAction;

    const partnerRows = await db.select().from(users).where(eq(users.id, partnerId)).limit(1);
    const partner = partnerRows[0];

    const responseStatus = match.status === 'EXPIRED' ? 'EXPIRED' : 'REVEALED';
    const scoreVisible = match.source !== 'heartbox' && match.scoreVisible !== false;
    res.json({
      status: responseStatus,
      ...(match.status === 'EXPIRED'
        ? {
            message: '本期匹配已过期，下周再试',
            nextRevealAt: getNextRevealAt(match.weekOf),
          }
        : {
            message: '锦书已送达',
          }),
      match: {
        matchId: match.id,
        source: match.source ?? 'weekly',
        specialLabel: match.specialLabel ?? null,
        scoreVisible,
        compatibilityScore: scoreVisible ? match.score : null,
        partner: partner
          ? {
              id: partner.id,
              nickname: partner.nickname,
              gender: partner.gender,
              department: partner.department,
              grade: partner.grade,
              campus: partner.campus,
              mbti: partner.mbti,
              bio: partner.bio,
              avatarUrl: partner.avatarUrl,
            }
          : null,
        insights: (() => {
          if (!scoreVisible) {
            return {
              overallPercent: null,
              dimensions: {},
              dimensionInsights: [],
              sharedInterests: [],
              curatorNote: match.curatorNote,
            };
          }
          const raw = match.dimensions ? JSON.parse(match.dimensions) : {};
          const { _sharedInterests, _insights, _intention, ...dimensionScores } = raw;
          const textInsights = generateDimensionInsights({
            dimensions: dimensionScores,
            sharedInterests: _sharedInterests ?? [],
            insights: _insights ?? {},
            intention: _intention ?? 'partner',
          });
          return {
            overallPercent: Math.round(match.score * 100),
            dimensions: dimensionScores,
            dimensionInsights: textInsights,
            sharedInterests: _sharedInterests ?? [],
            curatorNote: match.curatorNote,
          };
        })(),
        myAction,
        partnerActed: !!partnerAction,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /match/action
router.post('/action', requireAuth, validate(actionSchema), async (req, res, next) => {
  try {
    await ensureMergedAccountNotAllowed(req.auth!.userId);
    const { matchId, action } = req.body;
    const match = await getCurrentMatch(req.auth!.userId);

    if (!match || match.id !== matchId) {
      throw new NotFoundError('匹配不存在');
    }

    // Check if already acted
    const isUserA = match.userAId === req.auth!.userId;
    const existingAction = isUserA ? match.userAAction : match.userBAction;
    if (existingAction) {
      throw new ConflictError('你已经做出了选择，不可更改');
    }
    if (match.status !== 'REVEALED') {
      throw new ConflictError(match.status === 'EXPIRED' ? '匹配已过期，无法再做选择' : '当前匹配尚不可操作');
    }

    await recordAction(matchId, req.auth!.userId, action);
    res.json({
      action,
      message: action === 'ACCEPT' ? '你的选择已记录，等待对方回应' : '你选择了止步，本周匹配结束',
    });
  } catch (err) {
    next(err);
  }
});

// GET /match/result/:matchId
router.get('/result/:matchId', requireAuth, async (req, res, next) => {
  try {
    await ensureMergedAccountNotAllowed(req.auth!.userId);
    const matchRows = await db
      .select()
      .from(matches)
      .where(eq(matches.id, req.params.matchId as string))
      .limit(1);
    const match = matchRows[0];

    if (!match) throw new NotFoundError('匹配不存在');

    const isUserA = match.userAId === req.auth!.userId;
    const isUserB = match.userBId === req.auth!.userId;
    if (!isUserA && !isUserB) throw new NotFoundError('匹配不存在');

    const partnerAction = isUserA ? match.userBAction : match.userAAction;

    if (match.status === 'MUTUAL') {
      const partnerId = isUserA ? match.userBId : match.userAId;
      const partnerRows = await db.select().from(users).where(eq(users.id, partnerId)).limit(1);
      const partner = partnerRows[0];

      let contactPlatform = 'wechat';
      let contactId = partner?.wechatId || '';
      if (partner?.wechatId && partner.wechatId.includes(':')) {
        const parts = partner.wechatId.split(':');
        contactPlatform = parts[0] || 'wechat';
        contactId = parts.slice(1).join(':');
      }

      res.json({
        status: 'MUTUAL',
        partnerContact: {
          contactPlatform,
          contactId,
        },
        message: '恭喜！你们双向奔赴了',
      });
      return;
    }

    if (match.status === 'MISSED') {
      res.json({ status: 'MISSED', message: '很遗憾，缘分暂时止步于此' });
      return;
    }
    if (match.status === 'EXPIRED') {
      res.json({ status: 'EXPIRED', message: '本期匹配已过期，无法再做选择' });
      return;
    }

    if (!partnerAction) {
      res.json({ status: 'WAITING', message: '对方尚未做出选择' });
      return;
    }

    res.json({ status: match.status });
  } catch (err) {
    next(err);
  }
});

// GET /match/history
router.get('/history', requireAuth, async (req, res, next) => {
  try {
    await ensureMergedAccountNotAllowed(req.auth!.userId);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const result = await getMatchHistory(req.auth!.userId, page, limit);

    const enriched = await Promise.all(result.entries.map(async (entry) => {
      if (entry.kind === 'no_match') {
        return {
          matchId: `no-match-${entry.weekOf}`,
          weekOf: entry.weekOf,
          compatibilityScore: 0,
          status: 'NO_MATCH' as const,
          partner: null,
        };
      }

      const m = entry.row;
      const isUserA = m.userAId === req.auth!.userId;
      const partnerId = isUserA ? m.userBId : m.userAId;
      const partnerRows = await db.select().from(users).where(eq(users.id, partnerId)).limit(1);
      const partner = partnerRows[0];

      return {
        matchId: m.id,
        weekOf: m.weekOf,
        compatibilityScore: m.score,
        status: m.status,
        partner: partner
          ? {
              id: partner.id,
              nickname: partner.nickname,
              department: partner.department,
              avatarUrl: partner.avatarUrl,
            }
          : null,
      };
    }));

    res.json({ total: result.total, page, matches: enriched });
  } catch (err) {
    next(err);
  }
});

export default router;
