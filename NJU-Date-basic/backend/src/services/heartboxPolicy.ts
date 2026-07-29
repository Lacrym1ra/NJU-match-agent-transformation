export const ACTIVE_MATCH_STATUSES = ['LOCKED', 'REVEALED', 'MUTUAL'] as const;
export type ActiveMatchStatus = (typeof ACTIVE_MATCH_STATUSES)[number];

export function isActiveMainlineStatus(status: string): status is ActiveMatchStatus {
  return (ACTIVE_MATCH_STATUSES as readonly string[]).includes(status);
}

export function canSetSignalIn24h(recentSignalCount: number): boolean {
  return recentSignalCount === 0;
}

