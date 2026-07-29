import { containsSensitiveContactValue, isSensitiveFieldText } from '../../utils/privacy.js';

export interface CardSnapshotModule {
  key: string;
  label: string;
  value: string;
}

export interface CardSnapshotCircleSection {
  circleId: string | null;
  circleName: string | null;
  modules: CardSnapshotModule[];
}

export interface CardSnapshotPreview {
  previewMode: 'public' | 'friend';
  nickname: string | null;
  avatarUrl: string | null;
  baseModules: CardSnapshotModule[];
  circleCards: CardSnapshotCircleSection[];
}

export function formatSnapshotValue(value: unknown): string {
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

function normalizeSnapshotModule(value: unknown): CardSnapshotModule | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const key = typeof record.key === 'string' ? record.key : null;
  const label = typeof record.label === 'string' ? record.label : null;
  const normalizedValue = formatSnapshotValue(record.value);
  if (!key || !label || normalizedValue === '') {
    return null;
  }

  if (
    isSensitiveFieldText(key)
    || isSensitiveFieldText(label)
    || containsSensitiveContactValue(normalizedValue)
  ) {
    return null;
  }

  return {
    key,
    label,
    value: normalizedValue,
  };
}

export function parseStoredCardSnapshot(
  rawSnapshot: Record<string, unknown> | Array<Record<string, unknown>> | null | undefined,
  fallback?: Partial<CardSnapshotPreview> & { circleId?: string | null; circleName?: string | null },
): CardSnapshotPreview | null {
  if (!rawSnapshot) {
    return null;
  }

  if (!Array.isArray(rawSnapshot)) {
    const baseModules = Array.isArray(rawSnapshot.baseModules)
      ? rawSnapshot.baseModules.map(normalizeSnapshotModule).filter(Boolean) as CardSnapshotModule[]
      : [];
    const circleCards = Array.isArray(rawSnapshot.circleCards)
      ? rawSnapshot.circleCards.flatMap((circleCard) => {
        if (!circleCard || typeof circleCard !== 'object' || Array.isArray(circleCard)) {
          return [];
        }

        const modules = Array.isArray(circleCard.modules)
          ? circleCard.modules.map(normalizeSnapshotModule).filter(Boolean) as CardSnapshotModule[]
          : [];

        return [{
          circleId: typeof circleCard.circleId === 'string' ? circleCard.circleId : null,
          circleName: typeof circleCard.circleName === 'string' ? circleCard.circleName : null,
          modules,
        }];
      })
      : [];

    return {
      previewMode: rawSnapshot.previewMode === 'friend' ? 'friend' : (fallback?.previewMode ?? 'public'),
      nickname: typeof rawSnapshot.nickname === 'string' ? rawSnapshot.nickname : (fallback?.nickname ?? null),
      avatarUrl: typeof rawSnapshot.avatarUrl === 'string' ? rawSnapshot.avatarUrl : (fallback?.avatarUrl ?? null),
      baseModules,
      circleCards,
    };
  }

  const baseModules = rawSnapshot
    .filter((item) => item?.area === 'base')
    .map((item, index) => ({
      key: typeof item.key === 'string' ? item.key : `base_${index}`,
      label: typeof item.label === 'string' ? item.label : '未命名字段',
      value: formatSnapshotValue(item.value),
    }))
    .map(normalizeSnapshotModule)
    .filter(Boolean) as CardSnapshotModule[];
  const circleModules = rawSnapshot
    .filter((item) => item?.area !== 'base')
    .map((item, index) => ({
      key: typeof item.key === 'string' ? item.key : `circle_${index}`,
      label: typeof item.label === 'string' ? item.label : '未命名字段',
      value: formatSnapshotValue(item.value),
    }))
    .map(normalizeSnapshotModule)
    .filter(Boolean) as CardSnapshotModule[];

  return {
    previewMode: fallback?.previewMode ?? 'public',
    nickname: fallback?.nickname ?? null,
    avatarUrl: fallback?.avatarUrl ?? null,
    baseModules,
    circleCards: circleModules.length > 0
      ? [{
          circleId: fallback?.circleId ?? null,
          circleName: fallback?.circleName ?? null,
          modules: circleModules,
        }]
      : [],
  };
}
