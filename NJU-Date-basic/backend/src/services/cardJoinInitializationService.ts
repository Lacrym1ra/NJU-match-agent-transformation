import { v4 as uuid } from 'uuid';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import {
  baseCardComponents,
  circleQuestions,
  surveyAnswers,
  userBaseCards,
  userCircleCards,
  users,
} from '../db/schema.js';
import { NotFoundError } from '../utils/errors.js';

type CardStatus = 'public' | 'hidden' | 'deleted';
type CardTopLeft = [number, number];
type CardInitClient = Pick<typeof db, 'select' | 'insert'>;

interface CardComponent {
  key: string;
  name: string;
  value: unknown;
  topLeft: CardTopLeft;
  width: number;
  height: number;
  status: CardStatus;
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

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function defaultCardLayout(index: number): Pick<CardComponent, 'topLeft' | 'width' | 'height'> {
  return {
    topLeft: [0, Math.max(0, index)],
    width: 1,
    height: 1,
  };
}

function deletedCardLayout(): Pick<CardComponent, 'topLeft' | 'width' | 'height'> {
  return {
    topLeft: [-1, -1],
    width: -1,
    height: -1,
  };
}

function buildInitialComponent(
  definition: { key: string; name: string },
  value: unknown,
  defaultStatus: CardStatus,
  index: number,
): CardComponent {
  const status = isEmptyValue(value) ? 'deleted' : defaultStatus;
  const layout = status === 'deleted' ? deletedCardLayout() : defaultCardLayout(index);

  return {
    key: definition.key,
    name: definition.name,
    value: status === 'deleted' && isEmptyValue(value) ? '' : value,
    topLeft: layout.topLeft,
    width: layout.width,
    height: layout.height,
    status,
  };
}

async function getBaseDefinitions(client: CardInitClient = db): Promise<BaseDefinition[]> {
  return client.select({
    key: baseCardComponents.key,
    name: baseCardComponents.name,
    sourceType: baseCardComponents.sourceType,
    sourceKey: baseCardComponents.sourceKey,
  }).from(baseCardComponents).orderBy(asc(baseCardComponents.key));
}

async function getCircleDefinitions(circleId: string, client: CardInitClient = db): Promise<CircleDefinition[]> {
  const rows = await client.select({
    key: circleQuestions.key,
    name: circleQuestions.prompt,
  }).from(circleQuestions)
    .where(eq(circleQuestions.circleId, circleId))
    .orderBy(circleQuestions.displayOrder);

  return rows.map((row) => ({
    key: row.key,
    name: row.name,
  }));
}

async function getSurveyAnswerMap(userId: string, client: CardInitClient = db): Promise<Record<string, { value?: unknown }>> {
  const rows = await client.select({ answers: surveyAnswers.answers }).from(surveyAnswers)
    .where(eq(surveyAnswers.userId, userId))
    .limit(1);
  if (!rows[0]) return {};

  try {
    return JSON.parse(rows[0].answers) as Record<string, { value?: unknown }>;
  } catch {
    return {};
  }
}

async function buildInitialBaseComponentsForJoin(
  userId: string,
  definitions: BaseDefinition[],
  client: CardInitClient = db,
): Promise<CardComponent[]> {
  const [userRows, surveyMap] = await Promise.all([
    client.select().from(users).where(eq(users.id, userId)).limit(1),
    getSurveyAnswerMap(userId, client),
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

    return buildInitialComponent(definition, value, 'hidden', index);
  });
}

function buildInitialCircleComponentsForJoin(definitions: CircleDefinition[]): CardComponent[] {
  return definitions.map((definition, index) => buildInitialComponent(definition, '', 'deleted', index));
}

async function ensureBaseCardInitializedOnJoin(userId: string, client: CardInitClient = db): Promise<boolean> {
  const existing = await client.select({ userId: userBaseCards.userId }).from(userBaseCards)
    .where(eq(userBaseCards.userId, userId))
    .limit(1);
  if (existing[0]) return false;

  const definitions = await getBaseDefinitions(client);
  const components = await buildInitialBaseComponentsForJoin(userId, definitions, client);

  const inserted = await client.insert(userBaseCards).values({
    userId,
    isActive: true,
    components,
    updatedAt: new Date().toISOString(),
  }).onConflictDoNothing({
    target: userBaseCards.userId,
  }).returning({ userId: userBaseCards.userId });

  return Boolean(inserted[0]);
}

async function ensureCircleCardInitializedOnJoin(
  userId: string,
  circleId: string,
  client: CardInitClient = db,
): Promise<boolean> {
  const existing = await client.select({ id: userCircleCards.id }).from(userCircleCards)
    .where(and(eq(userCircleCards.userId, userId), eq(userCircleCards.circleId, circleId)))
    .limit(1);
  if (existing[0]) return false;

  const definitions = await getCircleDefinitions(circleId, client);
  const components = buildInitialCircleComponentsForJoin(definitions);

  const inserted = await client.insert(userCircleCards).values({
    id: uuid(),
    userId,
    circleId,
    isActive: true,
    components,
    updatedAt: new Date().toISOString(),
  }).onConflictDoNothing({
    target: [userCircleCards.userId, userCircleCards.circleId],
  }).returning({ id: userCircleCards.id });

  return Boolean(inserted[0]);
}

export async function initializeCardsOnCircleJoin(userId: string, circleId: string, client: CardInitClient = db) {
  const baseCardInitialized = await ensureBaseCardInitializedOnJoin(userId, client);
  const circleCardInitialized = await ensureCircleCardInitializedOnJoin(userId, circleId, client);

  return {
    baseCardInitialized,
    circleCardInitialized,
  };
}
