export interface CardSnapshotModule {
  key: string;
  label: string;
  value: string;
}

export interface CardSnapshotCircleCard {
  circleId?: string | null;
  circleName?: string | null;
  modules: CardSnapshotModule[];
}

export interface CardSnapshotPreview {
  previewMode: 'public' | 'friend';
  nickname: string | null;
  avatarUrl?: string | null;
  baseModules: CardSnapshotModule[];
  circleCards: CardSnapshotCircleCard[];
}
