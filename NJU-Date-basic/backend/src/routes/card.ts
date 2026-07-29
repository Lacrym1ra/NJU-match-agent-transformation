import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ValidationError } from '../utils/errors.js';
import {
  getBaseCardComponents,
  getMyBaseCard,
  getMyCardPublicPreference,
  updateMyBaseCard,
  getMyCircleCard,
  updateMyCircleCard,
  getMyCircleCustomCards,
  createMyCircleCustomCard,
  updateMyCircleCustomCard,
  deleteMyCircleCustomCard,
  getPublicCard,
  getFriendCard,
  updateMyCardPublicPreference,
} from '../modules/cards/index.js';

const router = Router();

const cardStatusSchema = z.enum(['public', 'circle', 'friends', 'hidden', 'deleted']);
type CardStatus = z.infer<typeof cardStatusSchema>;
const topLeftSchema = z.tuple([z.number(), z.number()]);

const cardComponentSchema = z.object({
  key: z.string().trim().min(1).optional(),
  moduleKey: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).optional(),
  label: z.string().trim().min(1).optional(),
  value: z.unknown(),
  topLeft: topLeftSchema.optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  status: cardStatusSchema.optional(),
}).superRefine((data, ctx) => {
  if (!data.key && !data.moduleKey) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['key'],
      message: 'key 或 moduleKey 不能为空',
    });
  }
  if (!data.name && !data.label) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['name'],
      message: 'name 或 label 不能为空',
    });
  }
}).transform((data) => ({
  key: data.key ?? data.moduleKey!,
  name: data.name ?? data.label!,
  value: data.value,
  topLeft: data.topLeft,
  width: data.width,
  height: data.height,
  status: data.status,
}));

const groupedComponentsSchema = z.object({
  public: z.array(cardComponentSchema).optional(),
  circle: z.array(cardComponentSchema).optional(),
  friends: z.array(cardComponentSchema).optional(),
  hidden: z.array(cardComponentSchema).optional(),
  deleted: z.array(cardComponentSchema).optional(),
});

const structuredUpdateCardSchema = z.object({
  components: groupedComponentsSchema,
});

const legacyCardModuleSchema = z.object({
  key: z.string().trim().min(1).optional(),
  moduleKey: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).optional(),
  label: z.string().trim().min(1).optional(),
  value: z.unknown(),
  topLeft: topLeftSchema.optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  status: cardStatusSchema.optional(),
  visibilityLevel: cardStatusSchema.optional(),
  displayOrder: z.number().int().optional(),
}).superRefine((data, ctx) => {
  if (!data.key && !data.moduleKey) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['moduleKey'],
      message: 'key 或 moduleKey 不能为空',
    });
  }
}).transform((data) => {
  const key = data.key ?? data.moduleKey!;
  const status = data.status
    ?? data.visibilityLevel
    ?? 'deleted';

  return {
    key,
    name: data.name ?? data.label ?? key,
    value: data.value,
    topLeft: data.topLeft,
    width: data.width,
    height: data.height,
    status,
  };
});

const legacyUpdateCardSchema = z.object({
  modules: z.array(legacyCardModuleSchema),
}).transform(({ modules }) => {
  type LegacyComponent = {
    key: string;
    name: string;
    value: unknown;
    topLeft?: [number, number];
    width?: number;
    height?: number;
    status: CardStatus;
  };
  const components: Record<CardStatus, LegacyComponent[]> = {
    public: [],
    circle: [],
    friends: [],
    hidden: [],
    deleted: [],
  };

  for (const module of modules) {
    components[module.status].push(module);
  }

  return { components };
});

const updateCardSchema = z.union([structuredUpdateCardSchema, legacyUpdateCardSchema]);

const customCardVisibilitySchema = z.enum(['public', 'friends', 'hidden']);
const hiddenPreviewModeSchema = z.enum(['titles_only', 'fully_hidden']);

const createCustomCardItemSchema = z.object({
  label: z.string().trim().min(1).max(100),
  value: z.string().trim().min(1).max(500),
  topLeft: topLeftSchema.optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  visibilityLevel: customCardVisibilitySchema.default('public'),
});

const updateCustomCardItemSchema = z.object({
  label: z.string().trim().min(1).max(100).optional(),
  value: z.string().trim().min(1).max(500).optional(),
  topLeft: topLeftSchema.optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  visibilityLevel: customCardVisibilitySchema.optional(),
}).refine(
  (data) => Object.values(data).some((value) => value !== undefined),
  { message: '至少提供一个可更新字段' },
);

const updatePublicPreferenceSchema = z.object({
  hiddenPreviewMode: hiddenPreviewModeSchema,
});

function parseUuidParam(value: string, field: string): string {
  const result = z.string().uuid().safeParse(value);
  if (!result.success) {
    throw new ValidationError(`${field} 必须是合法的 UUID`);
  }
  return result.data;
}

// GET /card/base/me — get my base card in edit view
router.get('/base/me', requireAuth, async (req, res, next) => {
  try {
    const result = await getMyBaseCard(req.auth!.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /card/modules — list available A-card component definitions for the user editor
router.get('/modules', requireAuth, async (_req, res, next) => {
  try {
    const result = await getBaseCardComponents();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PUT /card/base/me — replace my base card
router.put('/base/me', requireAuth, validate(updateCardSchema), async (req, res, next) => {
  try {
    const result = await updateMyBaseCard(req.auth!.userId, req.body.components);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /card/preferences/public-hidden-preview — get my public hidden-preview preference
router.get('/preferences/public-hidden-preview', requireAuth, async (req, res, next) => {
  try {
    const result = await getMyCardPublicPreference(req.auth!.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PUT /card/preferences/public-hidden-preview — update my public hidden-preview preference
router.put('/preferences/public-hidden-preview', requireAuth, validate(updatePublicPreferenceSchema), async (req, res, next) => {
  try {
    const result = await updateMyCardPublicPreference(req.auth!.userId, req.body.hiddenPreviewMode);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /card/circle/:circleId/me — get my circle card in edit view
router.get('/circle/:circleId/me', requireAuth, async (req, res, next) => {
  try {
    const circleId = parseUuidParam(req.params.circleId as string, 'circleId');
    const result = await getMyCircleCard(req.auth!.userId, circleId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PUT /card/circle/:circleId/me — replace my circle card
router.put('/circle/:circleId/me', requireAuth, validate(updateCardSchema), async (req, res, next) => {
  try {
    const circleId = parseUuidParam(req.params.circleId as string, 'circleId');
    const result = await updateMyCircleCard(req.auth!.userId, circleId, req.body.components);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /card/circle/:circleId/me/custom-items — get my C-card items in a circle
router.get('/circle/:circleId/me/custom-items', requireAuth, async (req, res, next) => {
  try {
    const circleId = parseUuidParam(req.params.circleId as string, 'circleId');
    const result = await getMyCircleCustomCards(req.auth!.userId, circleId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /card/circle/:circleId/me/custom-items — create my C-card item in a circle
router.post('/circle/:circleId/me/custom-items', requireAuth, validate(createCustomCardItemSchema), async (req, res, next) => {
  try {
    const circleId = parseUuidParam(req.params.circleId as string, 'circleId');
    const result = await createMyCircleCustomCard(req.auth!.userId, circleId, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// PATCH /card/circle/:circleId/me/custom-items/:itemId — update my C-card item
router.patch('/circle/:circleId/me/custom-items/:itemId', requireAuth, validate(updateCustomCardItemSchema), async (req, res, next) => {
  try {
    const circleId = parseUuidParam(req.params.circleId as string, 'circleId');
    const itemId = parseUuidParam(req.params.itemId as string, 'itemId');
    const result = await updateMyCircleCustomCard(req.auth!.userId, circleId, itemId, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /card/circle/:circleId/me/custom-items/:itemId — delete my C-card item
router.delete('/circle/:circleId/me/custom-items/:itemId', requireAuth, async (req, res, next) => {
  try {
    const circleId = parseUuidParam(req.params.circleId as string, 'circleId');
    const itemId = parseUuidParam(req.params.itemId as string, 'itemId');
    const result = await deleteMyCircleCustomCard(req.auth!.userId, circleId, itemId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /card/:userId/public — get target user's public card
router.get('/:userId/public', requireAuth, async (req, res, next) => {
  try {
    const targetUserId = parseUuidParam(req.params.userId as string, 'userId');
    const rawCircleId = req.query.circleId as string | undefined;
    const circleId = rawCircleId ? parseUuidParam(rawCircleId, 'circleId') : undefined;
    const result = await getPublicCard(req.auth!.userId, targetUserId, circleId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /card/:userId/friend — get target user's friend-only card.
// The backend always verifies the requester and target are already friends;
// otherwise it returns 403 NOT_FRIEND.
router.get('/:userId/friend', requireAuth, async (req, res, next) => {
  try {
    const targetUserId = parseUuidParam(req.params.userId as string, 'userId');
    const rawCircleId = req.query.circleId as string | undefined;
    const circleId = rawCircleId ? parseUuidParam(rawCircleId, 'circleId') : undefined;
    const result = await getFriendCard(req.auth!.userId, targetUserId, circleId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
