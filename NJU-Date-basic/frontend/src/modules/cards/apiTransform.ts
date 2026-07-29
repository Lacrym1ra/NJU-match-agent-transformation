import { formatCardDisplayValue } from './display';

export type VisibilityLevel = 'public' | 'circle' | 'friends' | 'hidden' | 'deleted';
export type RawCardStatus = VisibilityLevel;
export type PendingRequestState = 'sent' | 'received' | 'withdrawn' | 'expired' | null;

export interface RawCardComponent {
  key: string;
  name: string;
  value: unknown;
  topLeft?: [number, number];
  width?: number;
  height?: number;
  status?: RawCardStatus;
}

export interface RawLockedCardComponent {
  key: string;
  name: string;
  topLeft?: [number, number];
  width?: number;
  height?: number;
  status?: RawCardStatus;
}

export interface RawCardGroups {
  public?: RawCardComponent[];
  circle?: RawCardComponent[];
  friends?: RawCardComponent[];
  hidden?: RawCardComponent[];
  deleted?: RawCardComponent[];
  locked?: RawLockedCardComponent[];
}

export interface RawCardPayload {
  base: RawCardGroups;
  circle: RawCardGroups;
  custom: RawCardGroups;
}

export interface RawEditableCardResponse {
  view: 'edit';
  userId: string;
  circleId: string | null;
  initialized: boolean;
  nickname: string;
  avatarUrl?: string | null;
  card: RawCardPayload;
}

export interface RawViewerCardResponse {
  view: 'public' | 'friend';
  userId: string;
  circleId: string | null;
  nickname: string;
  avatarUrl?: string | null;
  isFriend: boolean;
  isCircleFriend?: boolean;
  pendingRequest: PendingRequestState;
  card: RawCardPayload;
}

export interface RawBaseCardDefinition {
  key: string;
  name: string;
  sourceType: 'user_profile' | 'survey_answer' | 'manual';
  sourceKey: string | null;
}

export interface CardModule {
  moduleKey: string;
  name?: string;
  value: any;
  visibilityLevel: VisibilityLevel;
  displayOrder: number;
}

export interface UserCard {
  modules: CardModule[];
  updatedAt: string;
}

export interface PredefinedModule {
  key: string;
  name: string;
  category: 'basic' | 'contact' | 'interests' | 'game';
  isSystem: boolean;
  description?: string;
}

export interface PublicCard {
  userId: string;
  nickname: string;
  avatarUrl?: string;
  modules: { moduleKey: string; label: string; value: any }[];
  circleHighlights: { key: string; label: string; value: string }[];
  isFriend: boolean;
  isCircleFriend?: boolean;
  pendingRequest: PendingRequestState;
}

const CONTACT_KEYWORDS = ['wechat', 'wx', 'qq', 'email', 'mail', 'phone', 'contact', 'xiaohongshu'];
const GAME_KEYWORDS = ['game', 'gaming', 'hero', 'rank', 'role', 'server'];

export function toVisibilityLevel(status: RawCardStatus | undefined): VisibilityLevel {
  if (status === 'public') return 'public';
  if (status === 'circle') return 'circle';
  if (status === 'friends') return 'friends';
  if (status === 'deleted') return 'deleted';
  return 'hidden';
}

function toRawCardStatus(visibilityLevel: VisibilityLevel): RawCardStatus {
  return visibilityLevel;
}

function sortByLayout(a: RawCardComponent, b: RawCardComponent) {
  const [ax, ay] = a.topLeft ?? [0, 0];
  const [bx, by] = b.topLeft ?? [0, 0];
  return ay - by || ax - bx || a.key.localeCompare(b.key);
}

function normalizeEditableModule(component: RawCardComponent, index: number): CardModule {
  return {
    moduleKey: component.key,
    name: component.name,
    value: component.value ?? '',
    visibilityLevel: toVisibilityLevel(component.status),
    displayOrder: index,
  };
}

export function flattenEditableGroups(groups: RawCardGroups, includeDeleted = false): CardModule[] {
  const components = [
    ...(groups.public ?? []),
    ...(groups.circle ?? []),
    ...(groups.friends ?? []),
    ...(groups.hidden ?? []),
    ...(includeDeleted ? (groups.deleted ?? []).map((component) => ({
      ...component,
      status: component.status ?? 'public',
    })) : []),
  ].sort(sortByLayout);

  return components.map(normalizeEditableModule);
}

export function formatRawCardValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join(' / ');
  }
  if (value === null || value === undefined || value === '') {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

export function filterDeletedModulesWithValue(modules: RawCardComponent[] = []) {
  return modules.filter((component) => formatRawCardValue(component.value) !== '');
}

function formatDisplayValue(component: Pick<RawCardComponent, 'key' | 'value'>): string {
  return formatCardDisplayValue(component, '');
}

export function toDisplayModules(components: RawCardComponent[]) {
  return components
    .filter((component) => component.value !== null && component.value !== undefined && formatDisplayValue(component) !== '')
    .sort(sortByLayout)
    .map((component) => ({
      moduleKey: component.key,
      label: component.name,
      value: formatDisplayValue(component),
    }));
}

export function toViewerCard(raw: RawViewerCardResponse, includeHidden: boolean): PublicCard {
  const baseModules = [
    ...(raw.card.base.public ?? []),
    ...(includeHidden ? (raw.card.base.hidden ?? []) : []),
  ];
  const circleModules = [
    ...(raw.card.circle.public ?? []),
    ...(includeHidden ? (raw.card.circle.hidden ?? []) : []),
  ];

  return {
    userId: raw.userId,
    nickname: raw.nickname,
    avatarUrl: raw.avatarUrl ?? undefined,
    modules: toDisplayModules(baseModules),
    circleHighlights: circleModules.map((component) => ({
      key: component.key,
      label: component.name,
      value: formatCardDisplayValue(component, ''),
    })),
    isFriend: raw.isFriend,
    isCircleFriend: raw.isCircleFriend,
    pendingRequest: raw.pendingRequest,
  };
}

export function buildGroupedPayload(modules: CardModule[]) {
  const components = {
    public: [] as Array<RawCardComponent & { topLeft: [number, number]; width: number; height: number; status: RawCardStatus }>,
    circle: [] as Array<RawCardComponent & { topLeft: [number, number]; width: number; height: number; status: RawCardStatus }>,
    friends: [] as Array<RawCardComponent & { topLeft: [number, number]; width: number; height: number; status: RawCardStatus }>,
    hidden: [] as Array<RawCardComponent & { topLeft: [number, number]; width: number; height: number; status: RawCardStatus }>,
    deleted: [] as Array<RawCardComponent & { topLeft: [number, number]; width: number; height: number; status: RawCardStatus }>,
  };

  modules.forEach((module, index) => {
    const status = toRawCardStatus(module.visibilityLevel);
    components[status].push({
      key: module.moduleKey,
      name: module.moduleKey,
      value: module.value,
      topLeft: [0, index],
      width: 1,
      height: 1,
      status,
    });
  });

  return { components };
}

export function inferModuleCategory(definition: RawBaseCardDefinition): PredefinedModule['category'] {
  const probe = `${definition.key} ${definition.name} ${definition.sourceKey ?? ''}`.toLowerCase();
  if (CONTACT_KEYWORDS.some((keyword) => probe.includes(keyword))) {
    return 'contact';
  }
  if (GAME_KEYWORDS.some((keyword) => probe.includes(keyword))) {
    return 'game';
  }
  if (definition.sourceType !== 'manual') {
    return 'basic';
  }
  return 'interests';
}

export function inferModuleDescription(definition: RawBaseCardDefinition): string | undefined {
  if (definition.sourceType === 'user_profile') {
    return '同步自基础档案';
  }
  if (definition.sourceType === 'survey_answer') {
    return '同步自主站问卷';
  }
  return undefined;
}

export function mapBaseCardDefinitions(definitions: RawBaseCardDefinition[]): PredefinedModule[] {
  return definitions.map((definition) => ({
    key: definition.key,
    name: definition.name,
    category: inferModuleCategory(definition),
    isSystem: definition.sourceType !== 'manual',
    description: inferModuleDescription(definition),
  }));
}
