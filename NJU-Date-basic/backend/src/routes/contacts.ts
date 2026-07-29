import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ValidationError } from '../utils/errors.js';
import {
  sendContactUnlockRequest,
  getContactUnlockRequests,
  handleContactUnlockRequest,
  withdrawContactUnlockRequest,
  revokeContactUnlockRequest,
  getContactUnlockStatus,
  getUnlockedContacts,
} from '../modules/contacts/unlocks.js';
import {
  listMyCircleContacts,
  upsertMyCircleContact,
  updateMyCircleContact,
  deleteMyCircleContact,
} from '../modules/contacts/circleContacts.js';

const router = Router();

const unlockRequestSchema = z.object({
  targetUserId: z.string().uuid(),
  circleId: z.string().uuid().optional(),
  sourceType: z.enum(['circle', 'address_book']).default('circle'),
  fieldKey: z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9_.:-]+$/).optional(),
  message: z.string().max(500).optional(),
}).superRefine((data, ctx) => {
  if (data.sourceType === 'circle' && !data.circleId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['circleId'],
      message: 'circleId 必填',
    });
  }
});

const handleUnlockRequestSchema = z.object({
  action: z.enum(['approve', 'reject']),
  contactIds: z.array(z.string().uuid()).max(10).optional(),
});

const circleContactSchema = z.object({
  fieldKey: z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9_.:-]+$/),
  label: z.string().trim().min(1).max(30).optional(),
  value: z.string().trim().min(1).max(120),
  isEnabled: z.boolean().optional(),
  displayOrder: z.number().int().min(0).max(1000).optional(),
});

const patchCircleContactSchema = circleContactSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: '至少提供一个要更新的字段' },
);

function parseUuidParam(value: string, field: string): string {
  const result = z.string().uuid().safeParse(value);
  if (!result.success) {
    throw new ValidationError(`${field} 必须是合法的 UUID`);
  }
  return result.data;
}

// GET /contacts/circles/:circleId/settings — list my circle contact settings
router.get('/circles/:circleId/settings', requireAuth, async (req, res, next) => {
  try {
    const circleId = parseUuidParam(req.params.circleId as string, 'circleId');
    const result = await listMyCircleContacts(req.auth!.userId, circleId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /contacts/circles/:circleId/settings — create or update one circle contact by fieldKey
router.post('/circles/:circleId/settings', requireAuth, validate(circleContactSchema), async (req, res, next) => {
  try {
    const circleId = parseUuidParam(req.params.circleId as string, 'circleId');
    const result = await upsertMyCircleContact(req.auth!.userId, circleId, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// PATCH /contacts/circles/:circleId/settings/:contactId — update one circle contact
router.patch('/circles/:circleId/settings/:contactId', requireAuth, validate(patchCircleContactSchema), async (req, res, next) => {
  try {
    const circleId = parseUuidParam(req.params.circleId as string, 'circleId');
    const contactId = parseUuidParam(req.params.contactId as string, 'contactId');
    const result = await updateMyCircleContact(req.auth!.userId, circleId, contactId, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /contacts/circles/:circleId/settings/:contactId — delete one circle contact
router.delete('/circles/:circleId/settings/:contactId', requireAuth, async (req, res, next) => {
  try {
    const circleId = parseUuidParam(req.params.circleId as string, 'circleId');
    const contactId = parseUuidParam(req.params.contactId as string, 'contactId');
    const result = await deleteMyCircleContact(req.auth!.userId, circleId, contactId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /contacts/unlock-request — send a contact unlock request
router.post('/unlock-request', requireAuth, validate(unlockRequestSchema), async (req, res, next) => {
  try {
    const result = await sendContactUnlockRequest(
      req.auth!.userId,
      req.body.targetUserId,
      {
        circleId: req.body.circleId,
        sourceType: req.body.sourceType,
        fieldKey: req.body.fieldKey,
        message: req.body.message,
      },
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /contacts/unlock-requests — get pending contact unlock requests received by me
router.get('/unlock-requests', requireAuth, async (req, res, next) => {
  try {
    const result = await getContactUnlockRequests(req.auth!.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PUT /contacts/unlock-requests/:requestId/withdraw — withdraw my sent contact request
router.put('/unlock-requests/:requestId/withdraw', requireAuth, async (req, res, next) => {
  try {
    const requestId = parseUuidParam(req.params.requestId as string, 'requestId');
    const result = await withdrawContactUnlockRequest(req.auth!.userId, requestId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /contacts/unlock-requests/:requestId/revoke — revoke an approved contact authorization
router.post('/unlock-requests/:requestId/revoke', requireAuth, async (req, res, next) => {
  try {
    const requestId = parseUuidParam(req.params.requestId as string, 'requestId');
    const result = await revokeContactUnlockRequest(req.auth!.userId, requestId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PUT /contacts/unlock-requests/:requestId — handle a contact unlock request
router.put('/unlock-requests/:requestId', requireAuth, validate(handleUnlockRequestSchema), async (req, res, next) => {
  try {
    const requestId = parseUuidParam(req.params.requestId as string, 'requestId');
    const result = await handleContactUnlockRequest(req.auth!.userId, requestId, req.body.action, {
      contactIds: req.body.contactIds,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /contacts/status/:userId — get my current unlock-request status for a target user
router.get('/status/:userId', requireAuth, async (req, res, next) => {
  try {
    const targetUserId = parseUuidParam(req.params.userId as string, 'userId');
    const rawCircleId = typeof req.query.circleId === 'string' ? req.query.circleId : undefined;
    const result = await getContactUnlockStatus(req.auth!.userId, targetUserId, {
      circleId: rawCircleId ? parseUuidParam(rawCircleId, 'circleId') : undefined,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /contacts/:userId — get unlocked contact modules from a friend
router.get('/:userId', requireAuth, async (req, res, next) => {
  try {
    const targetUserId = parseUuidParam(req.params.userId as string, 'userId');
    const rawCircleId = typeof req.query.circleId === 'string' ? req.query.circleId : undefined;
    const result = await getUnlockedContacts(req.auth!.userId, targetUserId, {
      circleId: rawCircleId ? parseUuidParam(rawCircleId, 'circleId') : undefined,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
