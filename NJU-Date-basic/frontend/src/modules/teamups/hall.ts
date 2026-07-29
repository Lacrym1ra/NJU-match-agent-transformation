import type { TeamUpApplicationType, TeamUpType } from '../../api/teamups';

export interface TeamupHallItem {
  teamupType: TeamUpType;
  joinMode: 'direct' | 'approval';
  joinable: boolean;
  waitlistable?: boolean;
  effectiveStatus: 'recruiting' | 'full' | 'expired' | 'ended' | 'cancelled';
  viewer?: {
    isTeamupMember: boolean;
    isLeader: boolean;
    pendingApplicationId: string | null;
    activeApplicationId?: string | null;
    applicationStatus?: 'pending' | 'approved' | 'rejected' | 'withdrawn' | null;
    applicationType?: TeamUpApplicationType | null;
    waitlistPosition?: number | null;
  };
}

export const TEAMUP_TYPE_LABELS: Record<TeamUpType, string> = {
  short_term: '临期组队',
  long_term: '长期组队',
};

export const TEAMUP_TYPE_FILTERS: Array<{ value: 'all' | TeamUpType; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'short_term', label: '临期组队' },
  { value: 'long_term', label: '长期组队' },
];

export function isJoinedTeamup(teamup: TeamupHallItem) {
  return teamup.viewer?.isTeamupMember === true;
}

export function getTeamupTypeText(teamup: TeamupHallItem) {
  return TEAMUP_TYPE_LABELS[teamup.teamupType] ?? '临期组队';
}

export function getTeamupBadgeText(teamup: TeamupHallItem) {
  if (teamup.viewer?.isLeader) return '我发起';
  if (teamup.viewer?.isTeamupMember) return '已加入';
  if (teamup.viewer?.applicationType === 'waitlist' && teamup.viewer?.applicationStatus === 'approved') {
    return teamup.viewer.waitlistPosition ? `候补第 ${teamup.viewer.waitlistPosition} 位` : '候补中';
  }
  if (teamup.viewer?.applicationType === 'waitlist' && teamup.viewer?.applicationStatus === 'pending') return '候补审核中';
  if (teamup.viewer?.pendingApplicationId) return '审核中';
  if (teamup.effectiveStatus === 'recruiting') return teamup.joinMode === 'approval' ? '需审核' : '招募中';
  if (teamup.waitlistable) return '可候补';
  if (teamup.effectiveStatus === 'full') return '已满员';
  if (teamup.effectiveStatus === 'expired') return '已截止';
  if (teamup.effectiveStatus === 'ended') return '已结束';
  return '已取消';
}

export function getTeamupBadgeClass(teamup: TeamupHallItem) {
  if (teamup.viewer?.isTeamupMember) {
    return 'text-[#420047] border-[#420047]/25 bg-[#420047]/5';
  }
  if (teamup.viewer?.pendingApplicationId) {
    return 'text-[#8B7355] border-[#8B7355]/30 bg-[#8B7355]/5';
  }
  if (teamup.waitlistable || teamup.viewer?.applicationType === 'waitlist') {
    return 'text-[#420047] border-[#420047]/25 bg-[#420047]/5';
  }
  if (teamup.effectiveStatus === 'recruiting') {
    return 'text-[#8B7355] border-[#8B7355]/30 bg-[#8B7355]/5';
  }
  return 'text-gray-400 border-gray-200 bg-white/50';
}
