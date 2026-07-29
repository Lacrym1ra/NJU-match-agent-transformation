import type { CardSnapshotPreview } from '../../api/cardSnapshots';
import type { ApplicationCardSnapshot, CardSnapshotGroups, CardSnapshotModule } from '../../api/teamups';
import { formatCardDisplayValue } from '../cards/display';

function sortByLayout(a: CardSnapshotModule, b: CardSnapshotModule) {
  const [ax, ay] = a.topLeft ?? [0, 0];
  const [bx, by] = b.topLeft ?? [0, 0];
  return ay - by || ax - bx || a.key.localeCompare(b.key);
}

function labelForModule(module: CardSnapshotModule) {
  return module.label || module.name || module.key;
}

function toPreviewModule(module: CardSnapshotModule) {
  const isLocked = module.value === undefined && module.status === 'hidden';
  return {
    key: module.key,
    label: labelForModule(module),
    value: formatCardDisplayValue(module, isLocked ? '已隐藏' : ''),
  };
}

function collectGroupModules(groups?: CardSnapshotGroups) {
  return [
    ...(groups?.public || []),
    ...(groups?.hidden || []),
    ...(groups?.locked || []),
  ].sort(sortByLayout);
}

export function teamupApplicationSnapshotToPreview(
  snapshot?: ApplicationCardSnapshot,
): CardSnapshotPreview | undefined {
  if (!snapshot) return undefined;

  if (snapshot.card) {
    const circleModules = [
      ...collectGroupModules(snapshot.card.circle),
      ...collectGroupModules(snapshot.card.custom),
    ].sort(sortByLayout);

    return {
      previewMode: snapshot.view === 'friend' ? 'friend' : 'public',
      nickname: snapshot.nickname ?? null,
      avatarUrl: snapshot.avatarUrl ?? null,
      baseModules: collectGroupModules(snapshot.card.base).map(toPreviewModule),
      circleCards: circleModules.length > 0
        ? [{
            circleId: null,
            circleName: '圈内名片',
            modules: circleModules.map(toPreviewModule),
          }]
        : [],
    };
  }

  return {
    previewMode: snapshot.view === 'friend' ? 'friend' : 'public',
    nickname: snapshot.nickname ?? null,
    avatarUrl: snapshot.avatarUrl ?? null,
    baseModules: [...(snapshot.baseModules || [])].sort(sortByLayout).map(toPreviewModule),
    circleCards: (snapshot.circleCards || []).map((card) => ({
      circleId: card.circleId ?? null,
      circleName: card.circleName ?? null,
      modules: [...(card.modules || [])].sort(sortByLayout).map(toPreviewModule),
    })),
  };
}
