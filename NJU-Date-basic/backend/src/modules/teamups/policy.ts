import { AppError, ValidationError } from '../../utils/errors.js';
import {
  containsContactLikeText as hasContactLikeText,
  replaceContactLikeText,
} from '../../utils/contactLikeText.js';

export type TeamupJoinMode = 'direct' | 'approval';
export type TeamupType = 'short_term' | 'long_term';
export type TeamupStatus = 'recruiting' | 'full' | 'cancelled';
export type TeamupEffectiveStatus = TeamupStatus | 'expired' | 'ended';
export type TeamupMemberRole = 'leader' | 'member';
export type TeamupApplicationType = 'join' | 'waitlist';
export type TeamupApplicationAction = 'approve' | 'reject';
export type TeamupCancelSource = 'leader' | 'admin';

export interface TeamupContactInput {
  type: string;
  value: string;
  label?: string;
}

export interface CreateTeamupInput {
  title: string;
  description: string;
  maxMembers: number;
  deadlineAt: string;
  endAt: string;
  teamupType: TeamupType;
  joinMode: TeamupJoinMode;
  isPublic: boolean;
  contacts: TeamupContactInput[];
}

export interface UpdateTeamupInput {
  title?: string;
  description?: string;
  maxMembers?: number;
  deadlineAt?: string;
  endAt?: string;
  teamupType?: TeamupType;
  joinMode?: TeamupJoinMode;
  isPublic?: boolean;
  contacts?: TeamupContactInput[];
}

export type TeamupLifecycle = {
  status: string;
  deadlineAt?: string | null;
  endAt?: string | null;
  currentMemberCount: number;
  maxMembers: number;
};

export function toTime(value: string | null | undefined) {
  const time = Date.parse(value ?? '');
  return Number.isFinite(time) ? time : NaN;
}

export function normalizeText(value: string, field: string, max: number) {
  const trimmed = value.trim();
  if (!trimmed) throw new ValidationError(`${field}不能为空`);
  if (trimmed.length > max) throw new ValidationError(`${field}不能超过${max}个字符`);
  return trimmed;
}

export function containsContactLikeText(value: string) {
  return hasContactLikeText(value);
}

export function normalizeDescription(value: string) {
  const description = normalizeText(value, '描述', 2000);
  if (containsContactLikeText(description)) {
    throw new AppError(400, 'DESCRIPTION_CONTACT_NOT_ALLOWED', '描述中不要填写手机号、微信、邮箱等联系方式，请填写在联系方式字段中');
  }
  return description;
}

export function normalizeTeamupType(value: string): TeamupType {
  if (value === 'short_term' || value === 'long_term') return value;
  throw new ValidationError('组队类型必须是临期组队或长期组队');
}

export function normalizeContacts(contacts: TeamupContactInput[]) {
  if (!Array.isArray(contacts) || contacts.length === 0) {
    throw new AppError(400, 'INVALID_CONTACT_PAYLOAD', '联系方式至少需要填写一项');
  }
  if (contacts.length > 3) {
    throw new AppError(400, 'INVALID_CONTACT_PAYLOAD', '联系方式最多填写三项');
  }

  return contacts.map((contact) => {
    const type = normalizeText(contact.type, '联系方式类型', 30);
    const value = normalizeText(contact.value, '联系方式内容', 120);
    const label = contact.label ? normalizeText(contact.label, '联系方式标签', 30) : type;
    return { type, value, label };
  });
}

export function stripContactLikeText(value: string) {
  return replaceContactLikeText(value, '[联系方式已隐藏]');
}

export function buildDescriptionPreview(description: string) {
  const plain = stripContactLikeText(description).replace(/\s+/g, ' ').trim();
  return plain.length > 120 ? `${plain.slice(0, 120)}...` : plain;
}

export function validateTimeWindow(deadlineAt: string, endAt: string) {
  const deadline = toTime(deadlineAt);
  const end = toTime(endAt);
  const now = Date.now();
  if (!Number.isFinite(deadline)) throw new ValidationError('deadlineAt 必须是合法时间');
  if (!Number.isFinite(end)) throw new ValidationError('endAt 必须是合法时间');
  if (deadline <= now) throw new AppError(400, 'DEADLINE_PASSED', '截止时间必须晚于当前时间');
  if (end <= deadline) throw new AppError(400, 'INVALID_TEAMUP_TIME_WINDOW', '结束时间必须晚于截止时间');
}

export function getEffectiveStatus(teamup: Pick<TeamupLifecycle, 'status' | 'deadlineAt' | 'endAt'>): TeamupEffectiveStatus {
  if (teamup.status === 'cancelled') return 'cancelled';
  const now = Date.now();
  if (toTime(teamup.endAt) <= now) return 'ended';
  if (toTime(teamup.deadlineAt) <= now) return 'expired';
  return teamup.status as TeamupStatus;
}

export function isJoinable(teamup: TeamupLifecycle) {
  return teamup.status === 'recruiting'
    && toTime(teamup.deadlineAt) > Date.now()
    && toTime(teamup.endAt) > Date.now()
    && teamup.currentMemberCount < teamup.maxMembers;
}

export function isOngoingTeamup(teamup: Pick<TeamupLifecycle, 'status' | 'endAt'>) {
  return teamup.status !== 'cancelled' && toTime(teamup.endAt) > Date.now();
}

export function isWaitlistable(teamup: TeamupLifecycle) {
  return isOngoingTeamup(teamup) && teamup.currentMemberCount >= teamup.maxMembers;
}

export function canPromoteFromWaitlist(teamup: TeamupLifecycle) {
  return isOngoingTeamup(teamup) && teamup.currentMemberCount < teamup.maxMembers;
}

export function isActiveWaitlistApplication(
  application: Pick<{ applicationType: string; status: string; waitlistJoinedAt: string | null }, 'applicationType' | 'status' | 'waitlistJoinedAt'>,
) {
  return application.applicationType === 'waitlist'
    && (application.status === 'pending' || application.status === 'approved')
    && !application.waitlistJoinedAt;
}
