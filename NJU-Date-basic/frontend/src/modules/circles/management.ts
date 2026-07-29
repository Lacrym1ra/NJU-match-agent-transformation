import type {
  CircleJoinRequest,
  CircleJoinRequestStatus,
  CircleManageOverview,
  JoinPolicyMode,
} from '../../api/circles';

export const JOIN_POLICY_OPTIONS: Array<{ value: JoinPolicyMode; label: string; desc: string; icon: string }> = [
  { value: 'public', label: '公开加入', desc: '同学点击后直接入圈', icon: 'public' },
  { value: 'review', label: '申请审核', desc: '圈主逐条审批入圈申请', icon: 'fact_check' },
  { value: 'invite', label: '邀请制', desc: '需要邀请码或圈主定向邀请', icon: 'vpn_key' },
];

export const REQUEST_FILTERS: Array<{ value: CircleJoinRequestStatus | 'all'; label: string }> = [
  { value: 'pending_review', label: '待审批' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已拒绝' },
  { value: 'expired', label: '已过期' },
  { value: 'withdrawn', label: '已撤回' },
  { value: 'all', label: '全部' },
];

export function getCirclePolicyMode(policy: CircleManageOverview['circle']['joinPolicy']): JoinPolicyMode {
  return typeof policy === 'string' ? policy : 'public';
}

export function formatCircleManageDate(value?: string | null) {
  if (!value) return '未记录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未记录';
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getCircleApplicantName(request: CircleJoinRequest) {
  return request.applicant.nickname?.trim() || '未命名同学';
}

export function getCircleJoinRequestText(request: CircleJoinRequest) {
  const parts = [
    request.applicationReason,
    request.applicationAnswer,
    request.applicationAnswers
      ? Object.entries(request.applicationAnswers)
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n')
      : '',
  ].filter(Boolean);
  return parts.length > 0 ? parts.join('\n\n') : '对方没有留下额外说明';
}
