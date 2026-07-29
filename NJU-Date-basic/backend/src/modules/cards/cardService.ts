import { v4 as uuid } from 'uuid';
import { and, asc, desc, eq, inArray, or } from 'drizzle-orm';
import { db } from '../../db/connection.js';
import {
  auditLogs,
  baseCardComponents,
  userBaseCards,
  userCardPreferences,
  userCircleCards,
  userCircleCustomCards,
  circleQuestions,
  circles,
  users,
  surveyAnswers,
  circleMembers,
  friendships,
  friendRequests,
} from '../../db/schema.js';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../../utils/errors.js';
import { CIRCLE_MEMBERSHIP_STATUS } from '../../utils/circleMembership.js';
import { createCircleCardComponent, getCircleCardComponents } from '../circles/index.js';
import {
  areUsersCircleFriends,
  areUsersGlobalFriends,
  listVisibleFriendCircles,
} from '../socialGraph/relationships.js';
import { containsSensitiveContactValue, isSensitiveFieldText } from '../../utils/privacy.js';
import {
  formatSnapshotValue,
  parseStoredCardSnapshot,
  type CardSnapshotModule,
  type CardSnapshotPreview,
} from './snapshots.js';
export type {
  CardSnapshotCircleSection,
  CardSnapshotModule,
  CardSnapshotPreview,
} from './snapshots.js';
export { parseStoredCardSnapshot } from './snapshots.js';

type CardStatus = 'public' | 'circle' | 'friends' | 'hidden' | 'deleted';
type CardView = 'edit' | 'public' | 'friend';
type CustomCardVisibilityLevel = 'public' | 'friends' | 'hidden';
type CustomCardReviewStatus = 'pending' | 'approved' | 'rejected';
type CardTopLeft = [number, number];
export type HiddenPreviewMode = 'titles_only' | 'fully_hidden';

const DEFAULT_HIDDEN_PREVIEW_MODE: HiddenPreviewMode = 'titles_only';

interface CardVisibilityChange {
  key: string;
  from: CardStatus | null;
  to: CardStatus;
}

interface CardComponent {
  key: string;
  name: string;
  value: unknown;
  topLeft: CardTopLeft;
  width: number;
  height: number;
  status: CardStatus;
}

type IncomingCardComponent = Omit<CardComponent, 'status'> & { status?: CardStatus };

interface GroupedComponentsInput {
  public?: IncomingCardComponent[];
  circle?: IncomingCardComponent[];
  friends?: IncomingCardComponent[];
  hidden?: IncomingCardComponent[];
  deleted?: IncomingCardComponent[];
}

interface GroupedComponents {
  public: CardComponent[];
  circle: CardComponent[];
  friends: CardComponent[];
  hidden: CardComponent[];
  deleted: CardComponent[];
  locked: Array<Pick<CardComponent, 'key' | 'name' | 'topLeft' | 'width' | 'height' | 'status'>>;
}

interface CardPayload {
  base: GroupedComponents;
  circle: GroupedComponents;
  custom: GroupedComponents;
}

function getComponentVisibilityChanges(previous: CardComponent[], next: CardComponent[]): CardVisibilityChange[] {
  const previousByKey = new Map(previous.map((component) => [component.key, component.status]));

  return next.flatMap((component) => {
    const previousStatus = previousByKey.get(component.key) ?? null;
    if (previousStatus === component.status) return [];
    return [{ key: component.key, from: previousStatus, to: component.status }];
  });
}

interface BaseDefinition {
  key: string;
  name: string;
  sourceType: string;
  sourceKey: string | null;
}

interface CircleDefinition {
  key: string;
  name: string;
}

interface BaseCardComponentDefinition {
  key: string;
  name: string;
  sourceType: 'user_profile' | 'survey_answer' | 'manual';
  sourceKey: string | null;
}

interface BaseCardComponentPatch {
  key?: string;
  name?: string;
  sourceType?: BaseCardComponentDefinition['sourceType'];
  sourceKey?: string | null;
}

interface StoredCircleCustomCardItem {
  id: string;
  userId: string;
  circleId: string;
  label: string;
  value: string;
  displayOrder: number;
  topLeft: CardTopLeft;
  width: number;
  height: number;
  visibilityLevel: CustomCardVisibilityLevel;
  status: CustomCardReviewStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

type CircleCustomCardItem = Omit<StoredCircleCustomCardItem, 'displayOrder'>;

interface CircleCustomCardInput {
  label: string;
  value: string;
  visibilityLevel: CustomCardVisibilityLevel;
  topLeft?: CardTopLeft;
  width?: number;
  height?: number;
}

interface CircleCustomCardPatch {
  label?: string;
  value?: string;
  visibilityLevel?: CustomCardVisibilityLevel;
  reviewNote?: string | null;
  topLeft?: CardTopLeft;
  width?: number;
  height?: number;
}

interface PromoteCircleCustomCardInput {
  key?: string;
  type: 'scale' | 'single_choice' | 'multi_choice' | 'ranking';
  prompt?: string;
  options?: unknown[];
  weight?: number;
  displayOrder?: number;
  isChannelTag?: boolean;
}

function emptyGroups(): GroupedComponents {
  return {
    public: [],
    circle: [],
    friends: [],
    hidden: [],
    deleted: [],
    locked: [],
  };
}

function isContactLikeText(value: string | null | undefined): boolean {
  return isSensitiveFieldText(value);
}

function isContactLikeBaseDefinition(definition: Pick<BaseDefinition, 'key' | 'name' | 'sourceKey'>): boolean {
  return definition.sourceKey === 'users.wechatId'
    || definition.sourceKey === 'users.email'
    || definition.sourceKey === 'users.studentIdHash'
    || definition.sourceKey === 'users.studentIdLast4'
    || isContactLikeText(definition.key)
    || isContactLikeText(definition.name);
}

function isContactLikeCardComponent(component: Pick<CardComponent, 'key' | 'name' | 'value'>): boolean {
  return isContactLikeText(component.key)
    || isContactLikeText(component.name)
    || containsSensitiveContactValue(component.value);
}

function stripContactLikeComponents(components: CardComponent[]): CardComponent[] {
  return components.filter((component) => !isContactLikeCardComponent(component));
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function deletedCardLayout(): Pick<CardComponent, 'topLeft' | 'width' | 'height'> {
  return {
    topLeft: [-1, -1],
    width: -1,
    height: -1,
  };
}

function defaultCardLayout(index: number): Pick<CardComponent, 'topLeft' | 'width' | 'height'> {
  return {
    topLeft: [0, Math.max(0, index)],
    width: 1,
    height: 1,
  };
}

function normalizeCardTopLeft(topLeft: unknown, fallbackIndex: number): CardTopLeft {
  if (
    Array.isArray(topLeft)
    && topLeft.length === 2
    && typeof topLeft[0] === 'number'
    && Number.isFinite(topLeft[0])
    && typeof topLeft[1] === 'number'
    && Number.isFinite(topLeft[1])
    && topLeft[0] >= 0
    && topLeft[1] >= 0
  ) {
    return [topLeft[0], topLeft[1]];
  }

  return defaultCardLayout(fallbackIndex).topLeft;
}

function normalizeCardSize(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value;
  }
  return fallback;
}

function normalizeComponent(
  component: Omit<CardComponent, 'status'> & { status?: CardStatus },
  fallbackStatus: CardStatus,
  fallbackLayoutIndex = 0,
): CardComponent {
  const status = isEmptyValue(component.value) ? 'deleted' : (component.status ?? fallbackStatus);
  const layout = status === 'deleted'
    ? deletedCardLayout()
    : {
      topLeft: normalizeCardTopLeft(component.topLeft, fallbackLayoutIndex),
      width: normalizeCardSize(component.width, 1),
      height: normalizeCardSize(component.height, 1),
    };
  return {
    key: component.key,
    name: component.name,
    value: status === 'deleted' && isEmptyValue(component.value) ? '' : component.value,
    ...layout,
    status,
  };
}

function groupComponents(
  components: CardComponent[],
  view: CardView,
  options?: { includeLockedInPublic?: boolean; includeCircleInPublic?: boolean },
): GroupedComponents {
  const groups = emptyGroups();
  const includeLockedInPublic = options?.includeLockedInPublic ?? true;
  const includeCircleInPublic = options?.includeCircleInPublic ?? false;

  for (const component of components) {
    if (view === 'public') {
      if (component.status === 'public' || (component.status === 'circle' && includeCircleInPublic)) {
        groups.public.push({ ...component, status: 'public' });
      } else if ((component.status === 'circle' || component.status === 'friends' || component.status === 'hidden') && includeLockedInPublic) {
        groups.locked.push({
          key: component.key,
          name: component.name,
          topLeft: component.topLeft,
          width: component.width,
          height: component.height,
          status: component.status,
        });
      }
      continue;
    }
    if (view === 'friend' && component.status === 'deleted') continue;
    if (view === 'friend' && (component.status === 'circle' || component.status === 'friends')) {
      groups.hidden.push({ ...component, status: 'hidden' });
      continue;
    }
    groups[component.status].push(component);
  }

  return groups;
}

function flattenInput(components: GroupedComponentsInput): CardComponent[] {
  return [
    ...(components.public ?? []).map((item, index) => normalizeComponent(item, 'public', index)),
    ...(components.circle ?? []).map((item, index) => normalizeComponent(item, 'circle', index)),
    ...(components.friends ?? []).map((item, index) => normalizeComponent(item, 'friends', index)),
    ...(components.hidden ?? []).map((item, index) => normalizeComponent(item, 'hidden', index)),
    ...(components.deleted ?? []).map((item, index) => normalizeComponent(item, 'deleted', index)),
  ];
}

function normalizeCustomCardText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function toCircleCustomCardItem(row: {
  id: string;
  userId: string;
  circleId: string;
  label: string;
  value: string;
  displayOrder: number;
  topLeftX: number;
  topLeftY: number;
  width: number;
  height: number;
  visibilityLevel: string;
  status: string;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}): StoredCircleCustomCardItem {
  return {
    id: row.id,
    userId: row.userId,
    circleId: row.circleId,
    label: row.label,
    value: row.value,
    displayOrder: row.displayOrder,
    topLeft: [row.topLeftX, row.topLeftY],
    width: row.width,
    height: row.height,
    visibilityLevel: row.visibilityLevel as CustomCardVisibilityLevel,
    status: row.status as CustomCardReviewStatus,
    reviewNote: row.reviewNote,
    reviewedAt: row.reviewedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toCircleCustomCardResponse(item: StoredCircleCustomCardItem): CircleCustomCardItem {
  const { displayOrder: _displayOrder, ...response } = item;
  return response;
}

function toCardStatusFromVisibility(visibilityLevel: CustomCardVisibilityLevel): CardStatus {
  if (visibilityLevel === 'public') return 'public';
  if (visibilityLevel === 'friends') return 'friends';
  return 'hidden';
}

function toCustomCardComponent(item: StoredCircleCustomCardItem): CardComponent {
  return normalizeComponent({
    key: `custom_${item.id}`,
    name: item.label,
    value: item.value,
    topLeft: item.topLeft,
    width: item.width,
    height: item.height,
    status: toCardStatusFromVisibility(item.visibilityLevel),
  }, toCardStatusFromVisibility(item.visibilityLevel), item.displayOrder);
}

function buildCustomCardLayout(
  visibilityLevel: CustomCardVisibilityLevel,
  layout: Partial<Pick<CardComponent, 'topLeft' | 'width' | 'height'>>,
  fallbackIndex: number,
): Pick<CardComponent, 'topLeft' | 'width' | 'height'> {
  const status = toCardStatusFromVisibility(visibilityLevel);
  if (status === 'deleted') {
    return deletedCardLayout();
  }

  return {
    topLeft: normalizeCardTopLeft(layout.topLeft, fallbackIndex),
    width: normalizeCardSize(layout.width, 1),
    height: normalizeCardSize(layout.height, 1),
  };
}

function buildPromotedCircleComponentKey(
  label: string,
  fallbackSeed: string,
  existingKeys: Set<string>,
): string {
  const normalized = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  const base = normalized || `custom_${fallbackSeed.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 8)}`;

  let candidate = base;
  let suffix = 2;

  while (existingKeys.has(candidate)) {
    const trailer = `_${suffix}`;
    candidate = `${base.slice(0, Math.max(1, 50 - trailer.length))}${trailer}`;
    suffix += 1;
  }

  return candidate;
}

async function listUserCircleCustomCardRows(userId: string, circleId: string): Promise<StoredCircleCustomCardItem[]> {
  const rows = await db.select({
    id: userCircleCustomCards.id,
    userId: userCircleCustomCards.userId,
    circleId: userCircleCustomCards.circleId,
    label: userCircleCustomCards.label,
    value: userCircleCustomCards.value,
    displayOrder: userCircleCustomCards.displayOrder,
    topLeftX: userCircleCustomCards.topLeftX,
    topLeftY: userCircleCustomCards.topLeftY,
    width: userCircleCustomCards.width,
    height: userCircleCustomCards.height,
    visibilityLevel: userCircleCustomCards.visibilityLevel,
    status: userCircleCustomCards.status,
    reviewNote: userCircleCustomCards.reviewNote,
    reviewedAt: userCircleCustomCards.reviewedAt,
    createdAt: userCircleCustomCards.createdAt,
    updatedAt: userCircleCustomCards.updatedAt,
  }).from(userCircleCustomCards)
    .where(and(
      eq(userCircleCustomCards.userId, userId),
      eq(userCircleCustomCards.circleId, circleId),
    ))
    .orderBy(asc(userCircleCustomCards.displayOrder), asc(userCircleCustomCards.createdAt));

  return rows.map(toCircleCustomCardItem);
}

async function getApprovedCustomCardComponents(userId: string, circleId: string): Promise<CardComponent[]> {
  const rows = await db.select({
    id: userCircleCustomCards.id,
    userId: userCircleCustomCards.userId,
    circleId: userCircleCustomCards.circleId,
    label: userCircleCustomCards.label,
    value: userCircleCustomCards.value,
    displayOrder: userCircleCustomCards.displayOrder,
    topLeftX: userCircleCustomCards.topLeftX,
    topLeftY: userCircleCustomCards.topLeftY,
    width: userCircleCustomCards.width,
    height: userCircleCustomCards.height,
    visibilityLevel: userCircleCustomCards.visibilityLevel,
    status: userCircleCustomCards.status,
    reviewNote: userCircleCustomCards.reviewNote,
    reviewedAt: userCircleCustomCards.reviewedAt,
    createdAt: userCircleCustomCards.createdAt,
    updatedAt: userCircleCustomCards.updatedAt,
  }).from(userCircleCustomCards)
    .where(and(
      eq(userCircleCustomCards.userId, userId),
      eq(userCircleCustomCards.circleId, circleId),
      eq(userCircleCustomCards.status, 'approved'),
    ))
    .orderBy(asc(userCircleCustomCards.displayOrder), asc(userCircleCustomCards.createdAt));

  return rows.map((row) => toCustomCardComponent(toCircleCustomCardItem(row)));
}

async function getOwnedCircleCustomCardItem(userId: string, circleId: string, itemId: string): Promise<StoredCircleCustomCardItem> {
  const rows = await db.select({
    id: userCircleCustomCards.id,
    userId: userCircleCustomCards.userId,
    circleId: userCircleCustomCards.circleId,
    label: userCircleCustomCards.label,
    value: userCircleCustomCards.value,
    displayOrder: userCircleCustomCards.displayOrder,
    topLeftX: userCircleCustomCards.topLeftX,
    topLeftY: userCircleCustomCards.topLeftY,
    width: userCircleCustomCards.width,
    height: userCircleCustomCards.height,
    visibilityLevel: userCircleCustomCards.visibilityLevel,
    status: userCircleCustomCards.status,
    reviewNote: userCircleCustomCards.reviewNote,
    reviewedAt: userCircleCustomCards.reviewedAt,
    createdAt: userCircleCustomCards.createdAt,
    updatedAt: userCircleCustomCards.updatedAt,
  }).from(userCircleCustomCards)
    .where(and(
      eq(userCircleCustomCards.id, itemId),
      eq(userCircleCustomCards.userId, userId),
      eq(userCircleCustomCards.circleId, circleId),
    ))
    .limit(1);

  const item = rows[0];
  if (!item) {
    throw new NotFoundError('C区自定义名片项不存在');
  }

  return toCircleCustomCardItem(item);
}

async function getCustomCardReviewItem(itemId: string): Promise<StoredCircleCustomCardItem> {
  const rows = await db.select({
    id: userCircleCustomCards.id,
    userId: userCircleCustomCards.userId,
    circleId: userCircleCustomCards.circleId,
    label: userCircleCustomCards.label,
    value: userCircleCustomCards.value,
    displayOrder: userCircleCustomCards.displayOrder,
    topLeftX: userCircleCustomCards.topLeftX,
    topLeftY: userCircleCustomCards.topLeftY,
    width: userCircleCustomCards.width,
    height: userCircleCustomCards.height,
    visibilityLevel: userCircleCustomCards.visibilityLevel,
    status: userCircleCustomCards.status,
    reviewNote: userCircleCustomCards.reviewNote,
    reviewedAt: userCircleCustomCards.reviewedAt,
    createdAt: userCircleCustomCards.createdAt,
    updatedAt: userCircleCustomCards.updatedAt,
  }).from(userCircleCustomCards)
    .where(eq(userCircleCustomCards.id, itemId))
    .limit(1);

  const item = rows[0];
  if (!item) {
    throw new NotFoundError('待审核C区名片项不存在');
  }

  return toCircleCustomCardItem(item);
}

async function getNextCircleCustomDisplayOrder(userId: string, circleId: string): Promise<number> {
  const rows = await db.select({
    displayOrder: userCircleCustomCards.displayOrder,
  }).from(userCircleCustomCards)
    .where(and(
      eq(userCircleCustomCards.userId, userId),
      eq(userCircleCustomCards.circleId, circleId),
    ))
    .orderBy(desc(userCircleCustomCards.displayOrder), desc(userCircleCustomCards.createdAt))
    .limit(1);

  return rows[0] ? rows[0].displayOrder + 1 : 0;
}

async function normalizeCircleCustomDisplayOrders(userId: string, circleId: string) {
  const items = await listUserCircleCustomCardRows(userId, circleId);
  const now = new Date().toISOString();

  await Promise.all(items.map((item, index) => (
    item.displayOrder === index
      ? Promise.resolve()
      : db.update(userCircleCustomCards)
        .set({
          displayOrder: index,
          updatedAt: now,
        })
        .where(eq(userCircleCustomCards.id, item.id))
  )));
}

async function ensureCircleExists(circleId: string) {
  const rows = await db.select({ id: circles.id }).from(circles).where(eq(circles.id, circleId)).limit(1);
  if (!rows[0]) throw new NotFoundError('圈子不存在');
}

async function ensureUserJoinedCircle(userId: string, circleId: string) {
  const rows = await db.select({ id: circleMembers.id }).from(circleMembers)
    .where(and(
      eq(circleMembers.userId, userId),
      eq(circleMembers.circleId, circleId),
      eq(circleMembers.membershipStatus, CIRCLE_MEMBERSHIP_STATUS.ACTIVE),
    ))
    .limit(1);

  if (!rows[0]) {
    throw new AppError(403, 'NOT_IN_TARGET_CIRCLE', '请先加入该圈子');
  }
}

async function getTargetUserBasic(userId: string) {
  const rows = await db.select({
    id: users.id,
    nickname: users.nickname,
    avatarUrl: users.avatarUrl,
  }).from(users).where(eq(users.id, userId)).limit(1);
  const user = rows[0];
  if (!user) throw new NotFoundError('用户不存在');
  return user;
}

async function getBaseDefinitions(): Promise<BaseDefinition[]> {
  const rows = await db.select({
    key: baseCardComponents.key,
    name: baseCardComponents.name,
    sourceType: baseCardComponents.sourceType,
    sourceKey: baseCardComponents.sourceKey,
  }).from(baseCardComponents).orderBy(asc(baseCardComponents.key));
  return rows.filter((row) => !isContactLikeBaseDefinition(row));
}

async function getHiddenPreviewMode(userId: string): Promise<HiddenPreviewMode> {
  const rows = await db.select({
    hiddenPreviewMode: userCardPreferences.hiddenPreviewMode,
  }).from(userCardPreferences)
    .where(eq(userCardPreferences.userId, userId))
    .limit(1);

  const mode = rows[0]?.hiddenPreviewMode;
  return mode === 'fully_hidden' ? 'fully_hidden' : DEFAULT_HIDDEN_PREVIEW_MODE;
}

function validateBaseCardComponentDefinition(component: BaseCardComponentDefinition) {
  if (isContactLikeBaseDefinition(component)) {
    throw new ValidationError('联系方式字段已从名片中剥离，请改用 contacts 服务交换');
  }

  if (component.sourceType === 'user_profile' && (!component.sourceKey || !component.sourceKey.startsWith('users.'))) {
    throw new ValidationError('user_profile 类型的 sourceKey 必须以 users. 开头');
  }

  if (component.sourceType === 'survey_answer' && (!component.sourceKey || !component.sourceKey.startsWith('survey.'))) {
    throw new ValidationError('survey_answer 类型的 sourceKey 必须以 survey. 开头');
  }
}

function normalizeBaseCardComponentDefinition(component: BaseCardComponentDefinition): BaseCardComponentDefinition {
  return {
    key: component.key,
    name: component.name,
    sourceType: component.sourceType,
    sourceKey: component.sourceKey ?? null,
  };
}

export async function getBaseCardComponents() {
  const components = await db.select({
    id: baseCardComponents.id,
    key: baseCardComponents.key,
    name: baseCardComponents.name,
    sourceType: baseCardComponents.sourceType,
    sourceKey: baseCardComponents.sourceKey,
  }).from(baseCardComponents).orderBy(asc(baseCardComponents.key));

  return {
    components: components.filter((component) => !isContactLikeBaseDefinition(component)),
  };
}

export async function replaceBaseCardComponents(components: BaseCardComponentDefinition[]) {
  const seen = new Set<string>();
  const normalized = components.map((component) => {
    const next = normalizeBaseCardComponentDefinition(component);
    validateBaseCardComponentDefinition(next);
    if (seen.has(next.key)) {
      throw new ConflictError('A区组件 key 不能重复');
    }
    seen.add(next.key);
    return next;
  });

  await db.delete(baseCardComponents);

  if (normalized.length > 0) {
    await db.insert(baseCardComponents).values(
      normalized.map((component) => ({
        id: uuid(),
        key: component.key,
        name: component.name,
        sourceType: component.sourceType,
        sourceKey: component.sourceKey ?? null,
      })),
    );
  }

  return { message: `已更新 ${normalized.length} 个A区组件` };
}

export async function createBaseCardComponent(component: BaseCardComponentDefinition) {
  const next = normalizeBaseCardComponentDefinition(component);
  validateBaseCardComponentDefinition(next);

  const existing = await db.select({ id: baseCardComponents.id }).from(baseCardComponents)
    .where(eq(baseCardComponents.key, next.key))
    .limit(1);
  if (existing[0]) {
    throw new ConflictError('A区组件 key 已存在');
  }

  await db.insert(baseCardComponents).values({
    id: uuid(),
    key: next.key,
    name: next.name,
    sourceType: next.sourceType,
    sourceKey: next.sourceKey,
  });

  return {
    message: '已新增A区组件',
    component: next,
  };
}

export async function updateBaseCardComponent(componentKey: string, patch: BaseCardComponentPatch) {
  const rows = await db.select({
    key: baseCardComponents.key,
    name: baseCardComponents.name,
    sourceType: baseCardComponents.sourceType,
    sourceKey: baseCardComponents.sourceKey,
  }).from(baseCardComponents)
    .where(eq(baseCardComponents.key, componentKey))
    .limit(1);
  const current = rows[0];
  if (!current) {
    throw new NotFoundError('A区组件不存在');
  }

  const next = normalizeBaseCardComponentDefinition({
    key: patch.key ?? current.key,
    name: patch.name ?? current.name,
    sourceType: (patch.sourceType ?? current.sourceType) as BaseCardComponentDefinition['sourceType'],
    sourceKey: patch.sourceKey !== undefined ? patch.sourceKey : current.sourceKey,
  });
  validateBaseCardComponentDefinition(next);

  if (next.key !== componentKey) {
    const duplicate = await db.select({ id: baseCardComponents.id }).from(baseCardComponents)
      .where(eq(baseCardComponents.key, next.key))
      .limit(1);
    if (duplicate[0]) {
      throw new ConflictError('A区组件 key 已存在');
    }
  }

  await db.update(baseCardComponents)
    .set({
      key: next.key,
      name: next.name,
      sourceType: next.sourceType,
      sourceKey: next.sourceKey,
    })
    .where(eq(baseCardComponents.key, componentKey));

  return {
    message: '已更新A区组件',
    component: next,
  };
}

export async function deleteBaseCardComponent(componentKey: string) {
  const deleted = await db.delete(baseCardComponents)
    .where(eq(baseCardComponents.key, componentKey))
    .returning({
      key: baseCardComponents.key,
      name: baseCardComponents.name,
    });
  const component = deleted[0];
  if (!component) {
    throw new NotFoundError('A区组件不存在');
  }

  return {
    message: '已删除A区组件',
    deletedKey: component.key,
  };
}

async function getCircleDefinitions(circleId: string): Promise<CircleDefinition[]> {
  const rows = await db.select({
    key: circleQuestions.key,
    name: circleQuestions.prompt,
    displayOrder: circleQuestions.displayOrder,
  }).from(circleQuestions)
    .where(eq(circleQuestions.circleId, circleId))
    .orderBy(circleQuestions.displayOrder);

  return rows.map((row) => ({
    key: row.key,
    name: row.name,
  }));
}

async function getSurveyAnswerMap(userId: string): Promise<Record<string, { value?: unknown }>> {
  const rows = await db.select({ answers: surveyAnswers.answers }).from(surveyAnswers)
    .where(eq(surveyAnswers.userId, userId))
    .limit(1);
  if (!rows[0]) return {};

  try {
    return JSON.parse(rows[0].answers) as Record<string, { value?: unknown }>;
  } catch {
    return {};
  }
}

async function buildInitialBaseComponents(userId: string, definitions: BaseDefinition[]): Promise<CardComponent[]> {
  const [userRows, surveyMap] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)).limit(1),
    getSurveyAnswerMap(userId),
  ]);

  const user = userRows[0];
  if (!user) throw new NotFoundError('用户不存在');

  return definitions.map((definition, index) => {
    let value: unknown = '';

    if (definition.sourceType === 'user_profile' && definition.sourceKey?.startsWith('users.')) {
      const field = definition.sourceKey.slice('users.'.length) as keyof typeof user;
      value = user[field] ?? '';
    } else if (definition.sourceType === 'survey_answer' && definition.sourceKey?.startsWith('survey.')) {
      const field = definition.sourceKey.slice('survey.'.length);
      value = surveyMap[field]?.value ?? '';
    }

    return normalizeComponent({
      key: definition.key,
      name: definition.name,
      value,
      topLeft: defaultCardLayout(index).topLeft,
      width: 1,
      height: 1,
      status: 'deleted',
    }, 'deleted', index);
  });
}

function mergeWithDefinitions(
  stored: CardComponent[],
  definitions: Array<{ key: string; name: string }>,
): CardComponent[] {
  const storedMap = new Map(stored.map((item, index) => [item.key, normalizeComponent(item, item.status, index)]));

  return definitions.map((definition, index) => {
    const existing = storedMap.get(definition.key);
    if (existing) {
      return normalizeComponent({
        key: definition.key,
        name: definition.name,
        value: existing.value,
        topLeft: existing.topLeft,
        width: existing.width,
        height: existing.height,
        status: existing.status,
      }, existing.status, index);
    }

    return normalizeComponent({
      key: definition.key,
      name: definition.name,
      value: '',
      topLeft: defaultCardLayout(index).topLeft,
      width: 1,
      height: 1,
      status: 'deleted',
    }, 'deleted', index);
  });
}

async function getOrInitBaseCard(userId: string): Promise<{ components: CardComponent[]; initialized: boolean }> {
  const definitions = await getBaseDefinitions();
  const rows = await db.select().from(userBaseCards).where(eq(userBaseCards.userId, userId)).limit(1);
  const row = rows[0];

  if (!row) {
    const components = await buildInitialBaseComponents(userId, definitions);
    await db.insert(userBaseCards).values({
      userId,
      isActive: true,
      components,
      updatedAt: new Date().toISOString(),
    });
    return { components, initialized: true };
  }

  const merged = mergeWithDefinitions((row.components ?? []) as CardComponent[], definitions);
  return { components: merged, initialized: false };
}

async function getExistingBaseCard(userId: string): Promise<CardComponent[]> {
  const definitions = await getBaseDefinitions();
  const rows = await db.select().from(userBaseCards).where(eq(userBaseCards.userId, userId)).limit(1);
  const row = rows[0];

  if (!row) {
    return [];
  }

  return mergeWithDefinitions((row.components ?? []) as CardComponent[], definitions);
}

async function getOrInitCircleCard(userId: string, circleId: string): Promise<{ components: CardComponent[]; initialized: boolean }> {
  await ensureCircleExists(circleId);
  const definitions = await getCircleDefinitions(circleId);

  const rows = await db.select().from(userCircleCards)
    .where(and(eq(userCircleCards.userId, userId), eq(userCircleCards.circleId, circleId)))
    .limit(1);
  const row = rows[0];

  if (!row) {
    const components = definitions.map((definition, index) => normalizeComponent({
      key: definition.key,
      name: definition.name,
      value: '',
      topLeft: defaultCardLayout(index).topLeft,
      width: 1,
      height: 1,
      status: 'deleted' as const,
    }, 'deleted', index));

    await db.insert(userCircleCards).values({
      id: uuid(),
      userId,
      circleId,
      isActive: true,
      components,
      updatedAt: new Date().toISOString(),
    });

    return { components, initialized: true };
  }

  const merged = mergeWithDefinitions((row.components ?? []) as CardComponent[], definitions);
  return { components: merged, initialized: false };
}

async function getExistingCircleCard(userId: string, circleId: string): Promise<CardComponent[]> {
  await ensureCircleExists(circleId);
  const definitions = await getCircleDefinitions(circleId);

  const rows = await db.select().from(userCircleCards)
    .where(and(eq(userCircleCards.userId, userId), eq(userCircleCards.circleId, circleId)))
    .limit(1);
  const row = rows[0];

  if (!row) {
    return [];
  }

  return mergeWithDefinitions((row.components ?? []) as CardComponent[], definitions);
}

async function areUsersInSameCircle(userId: string, targetUserId: string) {
  const myRows = await db.select({ circleId: circleMembers.circleId }).from(circleMembers)
    .where(and(
      eq(circleMembers.userId, userId),
      eq(circleMembers.membershipStatus, CIRCLE_MEMBERSHIP_STATUS.ACTIVE),
      eq(circleMembers.isActive, true),
    ));
  const circleIds = myRows.map((row) => row.circleId);
  if (circleIds.length === 0) return false;

  const sharedRows = await db.select({ id: circleMembers.id }).from(circleMembers)
    .where(and(
      eq(circleMembers.userId, targetUserId),
      inArray(circleMembers.circleId, circleIds),
      eq(circleMembers.membershipStatus, CIRCLE_MEMBERSHIP_STATUS.ACTIVE),
      eq(circleMembers.isActive, true),
    ))
    .limit(1);

  return !!sharedRows[0];
}

async function ensureUsersShareCircle(circleId: string, viewerId: string, targetUserId: string) {
  const rows = await db.select({ userId: circleMembers.userId }).from(circleMembers)
    .where(and(
      eq(circleMembers.circleId, circleId),
      inArray(circleMembers.userId, [viewerId, targetUserId]),
      eq(circleMembers.membershipStatus, CIRCLE_MEMBERSHIP_STATUS.ACTIVE),
      eq(circleMembers.isActive, true),
    ));

  const userIds = new Set(rows.map((row) => row.userId));
  if (!userIds.has(viewerId) || !userIds.has(targetUserId)) {
    throw new AppError(403, 'NOT_IN_TARGET_CIRCLE', '不在该圈子内，无法查看圈内信息');
  }
}

async function getPendingRequestState(
  userId: string,
  targetUserId: string,
  circleId?: string,
): Promise<'sent' | 'received' | null> {
  const rows = await db.select({
    senderId: friendRequests.senderId,
    receiverId: friendRequests.receiverId,
  }).from(friendRequests)
    .where(and(
      circleId ? eq(friendRequests.circleId, circleId) : eq(friendRequests.sourceType, 'global'),
      circleId ? eq(friendRequests.sourceType, 'circle') : undefined,
      eq(friendRequests.status, 'pending'),
      or(
        and(eq(friendRequests.senderId, userId), eq(friendRequests.receiverId, targetUserId)),
        and(eq(friendRequests.senderId, targetUserId), eq(friendRequests.receiverId, userId)),
      ),
    ))
    .limit(1);

  const request = rows[0];
  if (!request) return null;
  return request.senderId === userId ? 'sent' : 'received';
}

function buildCardPayload(
  baseComponents: CardComponent[],
  circleComponents: CardComponent[],
  view: CardView,
  customComponents: CardComponent[] = [],
  options?: { includeLockedInPublic?: boolean; includeCircleInPublic?: boolean },
): CardPayload {
  const safeBaseComponents = stripContactLikeComponents(baseComponents);
  const safeCircleComponents = stripContactLikeComponents(circleComponents);
  const safeCustomComponents = stripContactLikeComponents(customComponents);

  return {
    base: groupComponents(safeBaseComponents, view, options),
    circle: groupComponents(safeCircleComponents, view, options),
    custom: groupComponents(safeCustomComponents, view, options),
  };
}

function buildCircleFriendCardPayload(
  baseComponents: CardComponent[],
  circleComponents: CardComponent[],
  customComponents: CardComponent[] = [],
): CardPayload {
  const safeBaseComponents = stripContactLikeComponents(baseComponents);
  const safeCircleComponents = stripContactLikeComponents(circleComponents);
  const safeCustomComponents = stripContactLikeComponents(customComponents);

  return {
    // Global-friend access unlocks A-zone, while circle-friend access unlocks this circle's B/C content.
    base: groupComponents(safeBaseComponents, 'friend'),
    circle: groupComponents(safeCircleComponents, 'friend'),
    custom: groupComponents(safeCustomComponents, 'friend'),
  };
}

function toSnapshotModules(
  components: CardComponent[],
  previewMode: CardSnapshotPreview['previewMode'],
): CardSnapshotModule[] {
  return stripContactLikeComponents(components)
    .filter((component) => (
      previewMode === 'friend'
        ? component.status !== 'deleted'
        : component.status === 'public' || component.status === 'circle'
    ))
    .map((component) => ({
      key: component.key,
      label: component.name,
      value: formatSnapshotValue(component.value),
    }))
    .filter((component) => component.value !== '');
}

function buildCardSnapshotPreview(input: {
  previewMode: CardSnapshotPreview['previewMode'];
  nickname: string | null;
  avatarUrl: string | null;
  baseComponents: CardComponent[];
  circleCards?: Array<{
    circleId: string | null;
    circleName: string | null;
    components: CardComponent[];
  }>;
}): CardSnapshotPreview {
  return {
    previewMode: input.previewMode,
    nickname: input.nickname,
    avatarUrl: input.avatarUrl,
    baseModules: toSnapshotModules(input.baseComponents, input.previewMode),
    circleCards: (input.circleCards ?? []).map((circleCard) => ({
      circleId: circleCard.circleId,
      circleName: circleCard.circleName,
      modules: toSnapshotModules(circleCard.components, input.previewMode),
    })),
  };
}

function validateAndNormalizeForDefinitions(
  incoming: GroupedComponentsInput,
  definitions: Array<{ key: string; name: string }>,
): CardComponent[] {
  const definitionMap = new Map(definitions.map((item) => [item.key, item]));
  const definitionOrder = new Map(definitions.map((item, index) => [item.key, index]));
  const provided = flattenInput(incoming);
  const providedMap = new Map<string, CardComponent>();

  for (const component of provided) {
    const definition = definitionMap.get(component.key);
    if (!definition) {
      throw new AppError(400, 'INVALID_COMPONENT_KEY', `组件 ${component.key} 不存在`);
    }
    providedMap.set(component.key, normalizeComponent({
      key: definition.key,
      name: definition.name,
      value: component.value,
      topLeft: component.topLeft,
      width: component.width,
      height: component.height,
      status: component.status,
    }, component.status, definitionOrder.get(component.key) ?? 0));
  }

  return definitions.map((definition, index) => {
    const existing = providedMap.get(definition.key);
    if (existing) return existing;
    return normalizeComponent({
      key: definition.key,
      name: definition.name,
      value: '',
      topLeft: defaultCardLayout(index).topLeft,
      width: 1,
      height: 1,
      status: 'deleted',
    }, 'deleted', index);
  });
}

export async function getMyBaseCard(userId: string) {
  const [{ components, initialized }, targetUser] = await Promise.all([
    getOrInitBaseCard(userId),
    getTargetUserBasic(userId),
  ]);

  return {
    view: 'edit' as const,
    userId: targetUser.id,
    circleId: null,
    initialized,
    nickname: targetUser.nickname,
    avatarUrl: targetUser.avatarUrl,
    card: buildCardPayload(components, [], 'edit'),
  };
}

export async function getMyCardPublicPreference(userId: string) {
  return {
    hiddenPreviewMode: await getHiddenPreviewMode(userId),
  };
}

export async function updateMyCardPublicPreference(userId: string, hiddenPreviewMode: HiddenPreviewMode) {
  const previousMode = await getHiddenPreviewMode(userId);
  const now = new Date().toISOString();

  await db.transaction(async (tx) => {
    await tx.insert(userCardPreferences).values({
      userId,
      hiddenPreviewMode,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: userCardPreferences.userId,
      set: {
        hiddenPreviewMode,
        updatedAt: now,
      },
    });

    if (previousMode !== hiddenPreviewMode) {
      await tx.insert(auditLogs).values({
        operatorId: userId,
        action: 'card_hidden_preview_preference_updated',
        target: userId,
        detail: JSON.stringify({
          from: previousMode,
          to: hiddenPreviewMode,
        }),
        createdAt: now,
      });
    }
  });

  return {
    message: '已更新公开名片隐藏字段展示方式',
    hiddenPreviewMode,
  };
}

export async function updateMyBaseCard(userId: string, componentsInput: GroupedComponentsInput) {
  const definitions = await getBaseDefinitions();
  const components = validateAndNormalizeForDefinitions(componentsInput, definitions);
  const previous = (await getOrInitBaseCard(userId)).components;
  const visibilityChanges = getComponentVisibilityChanges(previous, components);
  const now = new Date().toISOString();

  await db.transaction(async (tx) => {
    await tx.insert(userBaseCards).values({
      userId,
      isActive: true,
      components,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: userBaseCards.userId,
      set: {
        components,
        updatedAt: now,
      },
    });

    if (visibilityChanges.length > 0) {
      await tx.insert(auditLogs).values({
        operatorId: userId,
        action: 'card_privacy_updated',
        target: userId,
        detail: JSON.stringify({
          area: 'base',
          changedFields: visibilityChanges,
        }),
        createdAt: now,
      });
    }
  });

  return { message: 'A区名片已更新' };
}

export async function getMyCircleCustomCards(userId: string, circleId: string) {
  await ensureUserJoinedCircle(userId, circleId);
  const items = await listUserCircleCustomCardRows(userId, circleId);

  return {
    circleId,
    items: items.map(toCircleCustomCardResponse),
  };
}

export async function createMyCircleCustomCard(userId: string, circleId: string, input: CircleCustomCardInput) {
  await ensureUserJoinedCircle(userId, circleId);
  const now = new Date().toISOString();
  const displayOrder = await getNextCircleCustomDisplayOrder(userId, circleId);
  const layout = buildCustomCardLayout(input.visibilityLevel, input, displayOrder);

  const item = {
    id: uuid(),
    userId,
    circleId,
    label: normalizeCustomCardText(input.label),
    value: normalizeCustomCardText(input.value),
    displayOrder,
    topLeftX: layout.topLeft[0],
    topLeftY: layout.topLeft[1],
    width: layout.width,
    height: layout.height,
    visibilityLevel: input.visibilityLevel,
    status: 'pending' as const,
    reviewNote: null,
    reviewedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.transaction(async (tx) => {
    await tx.insert(userCircleCustomCards).values(item);
    await tx.insert(auditLogs).values({
      operatorId: userId,
      action: 'card_custom_item_created',
      target: circleId,
      detail: JSON.stringify({
        itemId: item.id,
        circleId,
        visibilityLevel: item.visibilityLevel,
        status: item.status,
      }),
      createdAt: now,
    });
  });

  return {
    message: 'C区自定义名片项已提交审核',
    item: toCircleCustomCardResponse(toCircleCustomCardItem(item)),
  };
}

export async function updateMyCircleCustomCard(
  userId: string,
  circleId: string,
  itemId: string,
  patch: CircleCustomCardPatch,
) {
  await ensureUserJoinedCircle(userId, circleId);
  const current = await getOwnedCircleCustomCardItem(userId, circleId, itemId);
  const nextLabel = patch.label !== undefined ? normalizeCustomCardText(patch.label) : current.label;
  const nextValue = patch.value !== undefined ? normalizeCustomCardText(patch.value) : current.value;
  const nextVisibilityLevel = patch.visibilityLevel ?? current.visibilityLevel;
  const nextLayout = buildCustomCardLayout(nextVisibilityLevel, {
    topLeft: patch.topLeft ?? current.topLeft,
    width: patch.width ?? current.width,
    height: patch.height ?? current.height,
  }, current.displayOrder);
  const resetToPending = current.status !== 'pending';
  const nextStatus = resetToPending ? 'pending' : current.status;
  const now = new Date().toISOString();

  await db.transaction(async (tx) => {
    await tx.update(userCircleCustomCards)
      .set({
        label: nextLabel,
        value: nextValue,
        topLeftX: nextLayout.topLeft[0],
        topLeftY: nextLayout.topLeft[1],
        width: nextLayout.width,
        height: nextLayout.height,
        visibilityLevel: nextVisibilityLevel,
        status: nextStatus,
        reviewNote: resetToPending ? null : current.reviewNote,
        reviewedAt: resetToPending ? null : current.reviewedAt,
        updatedAt: now,
      })
      .where(eq(userCircleCustomCards.id, itemId));

    if (current.visibilityLevel !== nextVisibilityLevel || current.status !== nextStatus) {
      await tx.insert(auditLogs).values({
        operatorId: userId,
        action: 'card_custom_item_updated',
        target: circleId,
        detail: JSON.stringify({
          itemId,
          circleId,
          visibilityLevel: current.visibilityLevel === nextVisibilityLevel
            ? undefined
            : { from: current.visibilityLevel, to: nextVisibilityLevel },
          status: current.status === nextStatus
            ? undefined
            : { from: current.status, to: nextStatus },
        }),
        createdAt: now,
      });
    }
  });

  return {
    message: resetToPending ? 'C区自定义名片项已更新，并重新进入审核队列' : 'C区自定义名片项已更新',
    itemId,
  };
}

export async function deleteMyCircleCustomCard(userId: string, circleId: string, itemId: string) {
  await ensureUserJoinedCircle(userId, circleId);
  const current = await getOwnedCircleCustomCardItem(userId, circleId, itemId);
  const now = new Date().toISOString();

  await db.transaction(async (tx) => {
    await tx.delete(userCircleCustomCards)
      .where(eq(userCircleCustomCards.id, itemId));
    await tx.insert(auditLogs).values({
      operatorId: userId,
      action: 'card_custom_item_deleted',
      target: circleId,
      detail: JSON.stringify({
        itemId,
        circleId,
        visibilityLevel: current.visibilityLevel,
        status: current.status,
      }),
      createdAt: now,
    });
  });
  await normalizeCircleCustomDisplayOrders(userId, circleId);

  return {
    message: 'C区自定义名片项已删除',
    deletedId: itemId,
  };
}

export async function listCircleCustomCardsForReview(
  status: CustomCardReviewStatus = 'pending',
  circleId?: string,
) {
  const conditions = [eq(userCircleCustomCards.status, status)];
  if (circleId) {
    conditions.push(eq(userCircleCustomCards.circleId, circleId));
  }

  const rows = await db.select({
    id: userCircleCustomCards.id,
    userId: userCircleCustomCards.userId,
    circleId: userCircleCustomCards.circleId,
    label: userCircleCustomCards.label,
    value: userCircleCustomCards.value,
    displayOrder: userCircleCustomCards.displayOrder,
    topLeftX: userCircleCustomCards.topLeftX,
    topLeftY: userCircleCustomCards.topLeftY,
    width: userCircleCustomCards.width,
    height: userCircleCustomCards.height,
    visibilityLevel: userCircleCustomCards.visibilityLevel,
    status: userCircleCustomCards.status,
    reviewNote: userCircleCustomCards.reviewNote,
    reviewedAt: userCircleCustomCards.reviewedAt,
    createdAt: userCircleCustomCards.createdAt,
    updatedAt: userCircleCustomCards.updatedAt,
    circleName: circles.name,
    nickname: users.nickname,
    avatarUrl: users.avatarUrl,
  }).from(userCircleCustomCards)
    .innerJoin(circles, eq(userCircleCustomCards.circleId, circles.id))
    .innerJoin(users, eq(userCircleCustomCards.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(userCircleCustomCards.createdAt), asc(userCircleCustomCards.displayOrder));

  return {
    items: rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      circleId: row.circleId,
      label: row.label,
      value: row.value,
      topLeft: [row.topLeftX, row.topLeftY] as CardTopLeft,
      width: row.width,
      height: row.height,
      visibilityLevel: row.visibilityLevel as CustomCardVisibilityLevel,
      status: row.status as CustomCardReviewStatus,
      reviewNote: row.reviewNote,
      reviewedAt: row.reviewedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      circleName: row.circleName,
      user: {
        userId: row.userId,
        nickname: row.nickname,
        avatarUrl: row.avatarUrl,
      },
    })),
  };
}

export async function approveCircleCustomCard(itemId: string, operatorId?: string | null) {
  const current = await getCustomCardReviewItem(itemId);
  if (current.status !== 'pending') {
    throw new AppError(409, 'CUSTOM_CARD_ALREADY_REVIEWED', '该C区名片项已审核');
  }
  const now = new Date().toISOString();

  await db.transaction(async (tx) => {
    await tx.update(userCircleCustomCards)
      .set({
        status: 'approved',
        reviewNote: null,
        reviewedAt: now,
        updatedAt: now,
      })
      .where(eq(userCircleCustomCards.id, itemId));

    await tx.insert(auditLogs).values({
      operatorId: operatorId ?? null,
      action: 'card_custom_item_approved',
      target: current.circleId,
      detail: JSON.stringify({
        itemId,
        circleId: current.circleId,
        userId: current.userId,
        status: { from: current.status, to: 'approved' },
        visibilityLevel: current.visibilityLevel,
      }),
      createdAt: now,
    });
  });

  return {
    message: 'C区自定义名片项已通过审核',
    itemId,
    circleId: current.circleId,
    userId: current.userId,
  };
}

export async function rejectCircleCustomCard(itemId: string, reviewNote?: string, operatorId?: string | null) {
  const current = await getCustomCardReviewItem(itemId);
  if (current.status !== 'pending') {
    throw new AppError(409, 'CUSTOM_CARD_ALREADY_REVIEWED', '该C区名片项已审核');
  }
  const now = new Date().toISOString();

  await db.transaction(async (tx) => {
    await tx.update(userCircleCustomCards)
      .set({
        status: 'rejected',
        reviewNote: reviewNote ? normalizeCustomCardText(reviewNote) : null,
        reviewedAt: now,
        updatedAt: now,
      })
      .where(eq(userCircleCustomCards.id, itemId));

    await tx.insert(auditLogs).values({
      operatorId: operatorId ?? null,
      action: 'card_custom_item_rejected',
      target: current.circleId,
      detail: JSON.stringify({
        itemId,
        circleId: current.circleId,
        userId: current.userId,
        status: { from: current.status, to: 'rejected' },
        visibilityLevel: current.visibilityLevel,
        hasReviewNote: Boolean(reviewNote?.trim()),
      }),
      createdAt: now,
    });
  });

  return {
    message: 'C区自定义名片项已驳回',
    itemId,
    circleId: current.circleId,
    userId: current.userId,
  };
}

export async function promoteCircleCustomCardToCircleComponent(
  itemId: string,
  input: PromoteCircleCustomCardInput,
  operatorId?: string | null,
) {
  const current = await getCustomCardReviewItem(itemId);
  if (current.status === 'rejected') {
    throw new AppError(409, 'CUSTOM_CARD_REJECTED', '已驳回的C区名片项不能直接升级为B区组件');
  }

  const existing = await getCircleCardComponents(current.circleId);
  const existingKeys = new Set(existing.components.map((component) => component.key));
  const componentKey = input.key ?? buildPromotedCircleComponentKey(current.label, current.id, existingKeys);
  const componentPrompt = input.prompt ?? current.label;

  const created = await createCircleCardComponent(current.circleId, {
    key: componentKey,
    type: input.type,
    prompt: componentPrompt,
    options: input.options,
    weight: input.weight,
    displayOrder: input.displayOrder,
    isChannelTag: input.isChannelTag,
  });

  const { components } = await getOrInitCircleCard(current.userId, current.circleId);
  const nextComponents = components.map((component) => (
    component.key === created.component.key
      ? {
        ...component,
        value: current.value,
        topLeft: current.topLeft,
        width: current.width,
        height: current.height,
        status: toCardStatusFromVisibility(current.visibilityLevel),
      }
      : component
  ));

  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    await tx.insert(userCircleCards).values({
      id: uuid(),
      userId: current.userId,
      circleId: current.circleId,
      isActive: true,
      components: nextComponents,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: [userCircleCards.userId, userCircleCards.circleId],
      set: {
        components: nextComponents,
        updatedAt: now,
      },
    });

    await tx.delete(userCircleCustomCards)
      .where(eq(userCircleCustomCards.id, itemId));

    await tx.insert(auditLogs).values({
      operatorId: operatorId ?? null,
      action: 'card_custom_item_promoted',
      target: current.circleId,
      detail: JSON.stringify({
        itemId,
        circleId: current.circleId,
        userId: current.userId,
        componentKey: created.component.key,
        componentType: input.type,
        visibilityLevel: current.visibilityLevel,
        previousStatus: current.status,
        isChannelTag: input.isChannelTag ?? false,
      }),
      createdAt: now,
    });
  });
  await normalizeCircleCustomDisplayOrders(current.userId, current.circleId);

  return {
    message: '已将C区名片项升级为B区组件',
    itemId,
    circleId: current.circleId,
    userId: current.userId,
    component: created.component,
  };
}

export async function getMyCircleCard(userId: string, circleId: string) {
  await ensureUserJoinedCircle(userId, circleId);

  const [{ components, initialized }, targetUser, customItems, approvedCustomComponents] = await Promise.all([
    getOrInitCircleCard(userId, circleId),
    getTargetUserBasic(userId),
    listUserCircleCustomCardRows(userId, circleId),
    getApprovedCustomCardComponents(userId, circleId),
  ]);

  return {
    view: 'edit' as const,
    userId: targetUser.id,
    circleId,
    initialized,
    nickname: targetUser.nickname,
    avatarUrl: targetUser.avatarUrl,
    card: buildCardPayload([], components, 'edit', approvedCustomComponents),
    customItems: customItems.map(toCircleCustomCardResponse),
  };
}

export async function updateMyCircleCard(userId: string, circleId: string, componentsInput: GroupedComponentsInput) {
  await ensureUserJoinedCircle(userId, circleId);
  const definitions = await getCircleDefinitions(circleId);
  const components = validateAndNormalizeForDefinitions(componentsInput, definitions);
  const previous = (await getOrInitCircleCard(userId, circleId)).components;
  const visibilityChanges = getComponentVisibilityChanges(previous, components);
  const now = new Date().toISOString();

  await db.transaction(async (tx) => {
    await tx.insert(userCircleCards).values({
      id: uuid(),
      userId,
      circleId,
      isActive: true,
      components,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: [userCircleCards.userId, userCircleCards.circleId],
      set: {
        components,
        updatedAt: now,
      },
    });

    if (visibilityChanges.length > 0) {
      await tx.insert(auditLogs).values({
        operatorId: userId,
        action: 'card_privacy_updated',
        target: circleId,
        detail: JSON.stringify({
          area: 'circle',
          circleId,
          changedFields: visibilityChanges,
        }),
        createdAt: now,
      });
    }
  });

  return { message: 'B区名片已更新', circleId };
}

export async function getPublicCard(viewerId: string, targetUserId: string, circleId?: string) {
  if (circleId) {
    await ensureUsersShareCircle(circleId, viewerId, targetUserId);

    const [isFriend, isCircleFriend, pendingRequest, targetUser, baseCard, hiddenPreviewMode, circleComponents, customComponents] = await Promise.all([
      areUsersGlobalFriends(viewerId, targetUserId),
      areUsersCircleFriends(viewerId, targetUserId, circleId),
      getPendingRequestState(viewerId, targetUserId, circleId),
      getTargetUserBasic(targetUserId),
      getExistingBaseCard(targetUserId),
      getHiddenPreviewMode(targetUserId),
      getExistingCircleCard(targetUserId, circleId),
      getApprovedCustomCardComponents(targetUserId, circleId),
    ]);

    return {
      view: 'public' as const,
      userId: targetUser.id,
      circleId,
      nickname: targetUser.nickname,
      avatarUrl: targetUser.avatarUrl,
      isFriend,
      isCircleFriend,
      pendingRequest,
      card: buildCardPayload(baseCard, circleComponents, 'public', customComponents, {
        includeLockedInPublic: hiddenPreviewMode === 'titles_only',
        includeCircleInPublic: true,
      }),
    };
  }

  const [sameCircle, isFriend, pendingRequest, targetUser, baseCard, hiddenPreviewMode] = await Promise.all([
    areUsersInSameCircle(viewerId, targetUserId),
    areUsersGlobalFriends(viewerId, targetUserId),
    getPendingRequestState(viewerId, targetUserId),
    getTargetUserBasic(targetUserId),
    getExistingBaseCard(targetUserId),
    getHiddenPreviewMode(targetUserId),
  ]);

  if (!sameCircle && !isFriend) {
    throw new AppError(403, 'CARD_NOT_VISIBLE', '当前不可查看该用户名片');
  }

  return {
    view: 'public' as const,
    userId: targetUser.id,
    circleId: null,
    nickname: targetUser.nickname,
    avatarUrl: targetUser.avatarUrl,
    isFriend,
    isCircleFriend: false,
    pendingRequest,
    card: buildCardPayload(baseCard, [], 'public', [], {
      includeLockedInPublic: hiddenPreviewMode === 'titles_only',
      includeCircleInPublic: sameCircle,
    }),
  };
}

export async function getFriendCard(viewerId: string, targetUserId: string, circleId?: string) {
  const isGlobalFriend = await areUsersGlobalFriends(viewerId, targetUserId);
  if (!isGlobalFriend) {
    throw new AppError(403, 'NOT_FRIEND', '非好友关系');
  }

  if (!circleId) {
    const [targetUser, baseCard] = await Promise.all([
      getTargetUserBasic(targetUserId),
      getExistingBaseCard(targetUserId),
    ]);

    return {
      view: 'friend' as const,
      userId: targetUser.id,
      circleId: null,
      nickname: targetUser.nickname,
      avatarUrl: targetUser.avatarUrl,
      isFriend: true,
      isCircleFriend: false,
      pendingRequest: null,
      card: buildCardPayload(baseCard, [], 'friend'),
    };
  }

  // Friend cards may expose hidden/friends-only fields, so this access check
  // must stay on the server side and cannot rely on frontend state alone.
  await ensureUsersShareCircle(circleId, viewerId, targetUserId);

  const isCircleFriend = await areUsersCircleFriends(viewerId, targetUserId, circleId);
  if (!isCircleFriend) {
    throw new AppError(403, 'NOT_CIRCLE_FRIEND', '当前圈子下暂无好友关系');
  }

  const [targetUser, baseCard, circleComponents, customComponents] = await Promise.all([
    getTargetUserBasic(targetUserId),
    getExistingBaseCard(targetUserId),
    getExistingCircleCard(targetUserId, circleId),
    getApprovedCustomCardComponents(targetUserId, circleId),
  ]);

  return {
    view: 'friend' as const,
    userId: targetUser.id,
    circleId,
    nickname: targetUser.nickname,
    avatarUrl: targetUser.avatarUrl,
    isFriend: true,
    isCircleFriend: true,
    pendingRequest: null,
    card: buildCircleFriendCardPayload(baseCard, circleComponents, customComponents),
  };
}

export async function getPublicCardSnapshot(userId: string, circleId: string): Promise<CardSnapshotPreview> {
  await ensureCircleExists(circleId);
  const [targetUser, baseCard, circleCard, customCard, circleRows] = await Promise.all([
    getTargetUserBasic(userId),
    getExistingBaseCard(userId),
    getExistingCircleCard(userId, circleId),
    getApprovedCustomCardComponents(userId, circleId),
    db.select({ name: circles.name }).from(circles).where(eq(circles.id, circleId)).limit(1),
  ]);

  return buildCardSnapshotPreview({
    previewMode: 'public',
    nickname: targetUser.nickname,
    avatarUrl: targetUser.avatarUrl,
    baseComponents: baseCard,
    circleCards: [{
      circleId,
      circleName: circleRows[0]?.name ?? null,
      components: [...circleCard, ...customCard],
    }],
  });
}

export async function getFriendRequestCardSnapshot(userId: string, circleId: string): Promise<CardSnapshotPreview> {
  return getPublicCardSnapshot(userId, circleId);
}

export async function getGlobalFriendRequestCardSnapshot(userId: string): Promise<CardSnapshotPreview> {
  const [targetUser, baseCard] = await Promise.all([
    getTargetUserBasic(userId),
    getExistingBaseCard(userId),
  ]);

  return buildCardSnapshotPreview({
    previewMode: 'public',
    nickname: targetUser.nickname,
    avatarUrl: targetUser.avatarUrl,
    baseComponents: baseCard,
    circleCards: [],
  });
}

export async function getCircleContactRequestCardSnapshot(
  requesterId: string,
  targetUserId: string,
  circleId: string,
): Promise<CardSnapshotPreview> {
  await ensureUsersShareCircle(circleId, requesterId, targetUserId);

  const [targetUser, baseCard, circleCard, customCard, circleRows, isCircleFriend] = await Promise.all([
    getTargetUserBasic(requesterId),
    getExistingBaseCard(requesterId),
    getExistingCircleCard(requesterId, circleId),
    getApprovedCustomCardComponents(requesterId, circleId),
    db.select({ name: circles.name }).from(circles).where(eq(circles.id, circleId)).limit(1),
    areUsersCircleFriends(requesterId, targetUserId, circleId),
  ]);

  const visibleCircleComponents = isCircleFriend
    ? [...circleCard, ...customCard]
    : [
        ...circleCard.filter((component) => component.status === 'public'),
        ...circleCard.filter((component) => component.status === 'circle'),
        ...customCard.filter((component) => component.status === 'public' || component.status === 'circle'),
      ];

  return buildCardSnapshotPreview({
    previewMode: 'friend',
    nickname: targetUser.nickname,
    avatarUrl: targetUser.avatarUrl,
    baseComponents: baseCard,
    circleCards: [{
      circleId,
      circleName: circleRows[0]?.name ?? null,
      components: visibleCircleComponents,
    }],
  });
}

export async function getAddressBookContactRequestCardSnapshot(
  requesterId: string,
  targetUserId: string,
): Promise<CardSnapshotPreview> {
  const [targetUser, baseCard, visibleCircles] = await Promise.all([
    getTargetUserBasic(requesterId),
    getExistingBaseCard(requesterId),
    listVisibleFriendCircles(requesterId, targetUserId),
  ]);

  const circleCards = await Promise.all(visibleCircles.map(async (circle) => {
    const [circleCard, customCard] = await Promise.all([
      getExistingCircleCard(requesterId, circle.circleId),
      getApprovedCustomCardComponents(requesterId, circle.circleId),
    ]);

    return {
      circleId: circle.circleId,
      circleName: circle.circleName,
      components: [...circleCard, ...customCard],
    };
  }));

  return buildCardSnapshotPreview({
    previewMode: 'friend',
    nickname: targetUser.nickname,
    avatarUrl: targetUser.avatarUrl,
    baseComponents: baseCard,
    circleCards,
  });
}
