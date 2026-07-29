import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ValidationError } from '../utils/errors.js';
import {
  getFriends,
  getGroupedFriends,
  sendFriendRequest,
  sendGlobalFriendRequest,
  getFriendRequests,
  handleFriendRequest,
  closeFriendRequest,
  deleteFriend,
  deleteAllFriends,
} from '../modules/friends/requests.js';

const router = Router();

const friendRequestSchema = z.object({
  targetUserId: z.string().uuid(),
  circleId: z.string().uuid(),
  message: z.string().max(500).optional(),
});

const globalFriendRequestSchema = z.object({
  targetUserId: z.string().uuid(),
  message: z.string().max(500).optional(),
});

const handleFriendRequestSchema = z.object({
  action: z.enum(['accept', 'reject']),
});

function parseUuidParam(value: string, field: string): string {
  const result = z.string().uuid().safeParse(value);
  if (!result.success) {
    throw new ValidationError(`${field} 必须是合法的 UUID`);
  }
  return result.data;
}

// GET /friends — get friend list
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const result = await getFriends(req.auth!.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /friends/grouped — get grouped friend list with all shared circles
router.get('/grouped', requireAuth, async (req, res, next) => {
  try {
    const result = await getGroupedFriends(req.auth!.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /friends/global/requests — send a global friend request from forum/profile context
router.post('/global/requests', requireAuth, validate(globalFriendRequestSchema), async (req, res, next) => {
  try {
    const result = await sendGlobalFriendRequest(
      req.auth!.userId,
      req.body.targetUserId,
      req.body.message,
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

async function sendFriendRequestHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await sendFriendRequest(
      req.auth!.userId,
      req.body.targetUserId,
      req.body.circleId,
      req.body.message,
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

// POST /friends/request — send a friend request
router.post('/request', requireAuth, validate(friendRequestSchema), sendFriendRequestHandler);

// POST /friends/requests — frontend compatibility alias
router.post('/requests', requireAuth, validate(friendRequestSchema), sendFriendRequestHandler);

// GET /friends/requests — get pending requests received by me
router.get('/requests', requireAuth, async (req, res, next) => {
  try {
    const result = await getFriendRequests(req.auth!.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PUT /friends/requests/:requestId — handle a friend request
router.put('/requests/:requestId', requireAuth, validate(handleFriendRequestSchema), async (req, res, next) => {
  try {
    const requestId = parseUuidParam(req.params.requestId as string, 'requestId');
    const result = await handleFriendRequest(req.auth!.userId, requestId, req.body.action);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PUT /friends/requests/:requestId/withdraw — withdraw my sent request
router.put('/requests/:requestId/withdraw', requireAuth, async (req, res, next) => {
  try {
    const requestId = parseUuidParam(req.params.requestId as string, 'requestId');
    const result = await closeFriendRequest(req.auth!.userId, requestId, 'withdraw');
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PUT /friends/requests/:requestId/silent-reject — reject without sender-facing notification
router.put('/requests/:requestId/silent-reject', requireAuth, async (req, res, next) => {
  try {
    const requestId = parseUuidParam(req.params.requestId as string, 'requestId');
    const result = await closeFriendRequest(req.auth!.userId, requestId, 'silent-reject');
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /friends/:friendId/all — delete every friendship with this user
router.delete('/:friendId/all', requireAuth, async (req, res, next) => {
  try {
    const friendId = parseUuidParam(req.params.friendId as string, 'friendId');
    const result = await deleteAllFriends(req.auth!.userId, friendId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /friends/:friendId — delete a friendship in one circle
router.delete('/:friendId', requireAuth, async (req, res, next) => {
  try {
    const friendId = parseUuidParam(req.params.friendId as string, 'friendId');
    const rawCircleId = req.query.circleId as string | undefined;
    if (!rawCircleId) {
      throw new ValidationError('circleId 必填');
    }
    const circleId = parseUuidParam(rawCircleId, 'circleId');
    const result = await deleteFriend(req.auth!.userId, friendId, circleId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
