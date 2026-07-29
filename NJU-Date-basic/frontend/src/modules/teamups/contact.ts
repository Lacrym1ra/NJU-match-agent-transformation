import type { CircleContact } from '../../api/contacts';
import type { Contact } from '../../api/teamups';
import { uniqueCircleContacts } from '../contacts/circleContacts';

export type TeamupContactKind = 'wechat' | 'qq' | 'xiaohongshu' | 'email' | 'phone' | 'other';
export type TeamupContactSource = 'manual' | 'circle';

export interface TeamupContactDraft {
  kind: TeamupContactKind;
  customLabel: string;
  value: string;
  source?: TeamupContactSource;
  circleContactId?: string;
}

export const MAX_TEAMUP_CONTACTS = 3;

export const TEAMUP_CONTACT_OPTIONS: Array<{
  kind: TeamupContactKind;
  label: string;
  placeholder: string;
}> = [
  { kind: 'wechat', label: '微信', placeholder: '微信号' },
  { kind: 'qq', label: 'QQ', placeholder: 'QQ 号' },
  { kind: 'xiaohongshu', label: '小红书', placeholder: '小红书号' },
  { kind: 'email', label: '邮箱', placeholder: '邮箱地址' },
  { kind: 'phone', label: '手机号', placeholder: '手机号' },
  { kind: 'other', label: '其他', placeholder: '请填写联系方式内容' },
];

export function createEmptyTeamupContactDraft(): TeamupContactDraft {
  return {
    kind: 'wechat',
    customLabel: '',
    value: '',
    source: 'manual',
  };
}

export function getTeamupContactOption(kind: TeamupContactKind) {
  return TEAMUP_CONTACT_OPTIONS.find((option) => option.kind === kind) || TEAMUP_CONTACT_OPTIONS[0];
}

export function normalizeTeamupContactKind(value: string | null | undefined): TeamupContactKind {
  const platform = value?.trim().toLowerCase();
  if (!platform) return 'wechat';
  if (platform.includes('wechat') || platform.includes('weixin') || platform.includes('微信') || platform === 'wx' || platform === 'vx') return 'wechat';
  if (platform.includes('qq')) return 'qq';
  if (platform.includes('xiaohongshu') || platform.includes('小红书') || platform === 'rednote') return 'xiaohongshu';
  if (platform.includes('email') || platform.includes('mail') || platform.includes('邮箱')) return 'email';
  if (
    platform.includes('phone')
    || platform.includes('mobile')
    || platform === 'tel'
    || platform.includes('telephone')
    || platform.includes('电话')
    || platform.includes('手机')
  ) return 'phone';
  return 'other';
}

export interface TeamupCircleContactOption {
  key: string;
  kind: TeamupContactKind;
  label: string;
  value: string;
}

export function getCircleContactOptions(contacts: CircleContact[]): TeamupCircleContactOption[] {
  return uniqueCircleContacts(contacts)
    .filter((contact) => contact.value?.trim())
    .map((contact) => {
      const kind = normalizeTeamupContactKind(`${contact.fieldKey} ${contact.label}`);
      const option = getTeamupContactOption(kind);
      return {
        key: contact.id,
        kind,
        label: contact.label?.trim() || option.label,
        value: contact.value.trim(),
      };
    });
}

export function draftFromCircleContact(option: TeamupCircleContactOption): TeamupContactDraft {
  return {
    kind: option.kind,
    customLabel: option.kind === 'other' ? option.label : '',
    value: option.value,
    source: 'circle',
    circleContactId: option.key,
  };
}

export function buildTeamupContact(draft: TeamupContactDraft): Contact | null {
  const value = draft.value.trim();
  if (!value) return null;

  const option = getTeamupContactOption(draft.kind);
  const label = draft.kind === 'other'
    ? (draft.customLabel.trim() || '其他')
    : option.label;

  return {
    type: draft.kind === 'other' ? 'other' : option.kind,
    label,
    value,
  };
}

export function buildTeamupContacts(drafts: TeamupContactDraft[]): Contact[] {
  return drafts
    .map(buildTeamupContact)
    .filter((contact): contact is Contact => Boolean(contact))
    .slice(0, MAX_TEAMUP_CONTACTS);
}

export function hasIncompleteTeamupContactDraft(drafts: TeamupContactDraft[]) {
  return drafts.some((draft) => {
    if (draft.value.trim()) return false;
    if (draft.source === 'circle') return true;
    return Boolean(draft.customLabel.trim());
  });
}
