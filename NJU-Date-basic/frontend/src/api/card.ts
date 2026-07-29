import { api } from './client';
import {
  buildGroupedPayload,
  filterDeletedModulesWithValue,
  flattenEditableGroups,
  mapBaseCardDefinitions,
  toViewerCard,
} from '../modules/cards/apiTransform';
import type {
  CardModule,
  PredefinedModule,
  PublicCard,
  RawBaseCardDefinition,
  RawEditableCardResponse,
  RawViewerCardResponse,
  UserCard,
} from '../modules/cards/apiTransform';

export type {
  CardModule,
  PendingRequestState,
  PredefinedModule,
  PublicCard,
  RawCardStatus,
  RawEditableCardResponse,
  UserCard,
  VisibilityLevel,
} from '../modules/cards/apiTransform';

export {
  buildGroupedPayload,
  flattenEditableGroups,
} from '../modules/cards/apiTransform';

export type FullCard = PublicCard;

export async function getCard(): Promise<UserCard> {
  const raw = await api.get<RawEditableCardResponse>('/card/base/me');
  return {
    modules: flattenEditableGroups({
      ...raw.card.base,
      deleted: filterDeletedModulesWithValue(raw.card.base.deleted),
    }, true),
    updatedAt: new Date().toISOString(),
  };
}

export const updateCard = (modules: CardModule[]) =>
  api.put<{ message: string }>('/card/base/me', buildGroupedPayload(
    modules.map((module, index) => ({ ...module, displayOrder: index })),
  ));

export async function getCardModules() {
  const raw = await api.get<{ components: RawBaseCardDefinition[] }>('/card/modules');
  return {
    modules: mapBaseCardDefinitions(raw.components ?? []),
  };
}

export async function getPublicCard(userId: string, circleId?: string): Promise<PublicCard> {
  const suffix = circleId ? `?circleId=${encodeURIComponent(circleId)}` : '';
  const raw = await api.get<RawViewerCardResponse>(`/card/${userId}/public${suffix}`);
  return toViewerCard(raw, false);
}

/**
 * Fetch a friend-only card view.
 * The backend is the source of truth here and will return 403 NOT_FRIEND
 * if the requester is not actually a friend of the target user.
 */
 export async function getFriendCard(userId: string, circleId?: string): Promise<FullCard> {
    const suffix = circleId ? `?circleId=${encodeURIComponent(circleId)}` : '';
    const raw = await api.get<RawViewerCardResponse>(`/card/${userId}/friend${suffix}`);
    return toViewerCard(raw, true);
 }
