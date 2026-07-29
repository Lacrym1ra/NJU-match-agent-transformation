import type { TeamUpListFilters } from '../../api/teamups';

export function buildTeamupListQuery(mineOrFilters?: 'created' | 'joined' | 'applied' | TeamUpListFilters) {
  const params = new URLSearchParams();
  if (typeof mineOrFilters === 'string') {
    params.set('mine', mineOrFilters);
  } else if (mineOrFilters) {
    if (mineOrFilters.mine) params.set('mine', mineOrFilters.mine);
    if (mineOrFilters.teamupType && mineOrFilters.teamupType !== 'all') params.set('teamupType', mineOrFilters.teamupType);
    if (mineOrFilters.keyword?.trim()) params.set('keyword', mineOrFilters.keyword.trim());
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}
