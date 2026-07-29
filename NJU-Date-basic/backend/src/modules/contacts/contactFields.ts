import { ValidationError } from '../../utils/errors.js';

export type ContactUnlockSourceType = 'circle' | 'address_book';
export type ContactUnlockAction = 'approve' | 'reject';
export type ContactUnlockState = 'idle' | 'sent' | 'granted';

export interface CircleContactInput {
  fieldKey: string;
  label?: string;
  value: string;
  isEnabled?: boolean;
  displayOrder?: number;
}

export const CONTACT_PLATFORM_META: Record<string, { moduleKey: string; label: string }> = {
  wechat: { moduleKey: 'contact_wechat', label: '微信' },
  qq: { moduleKey: 'contact_qq', label: 'QQ' },
  xiaohongshu: { moduleKey: 'contact_xiaohongshu', label: '小红书' },
};

export const CONTACT_UNLOCK_DEFAULT_FIELD_KEY = 'contact_primary';
export const CONTACT_UNLOCK_CIRCLE_REQUEST_FIELD_KEY = 'contact_circle';

export const CONTACT_UNLOCK_ALLOWED_FIELD_KEYS = new Set([
  CONTACT_UNLOCK_DEFAULT_FIELD_KEY,
  CONTACT_UNLOCK_CIRCLE_REQUEST_FIELD_KEY,
  'contact_wechat',
  'contact_qq',
  'contact_email',
  'contact_phone',
  'contact_mobile',
  'contact_xiaohongshu',
]);

export const CIRCLE_CONTACT_ALLOWED_FIELD_KEYS = new Set(
  Array.from(CONTACT_UNLOCK_ALLOWED_FIELD_KEYS).filter((key) => (
    key !== CONTACT_UNLOCK_DEFAULT_FIELD_KEY && key !== CONTACT_UNLOCK_CIRCLE_REQUEST_FIELD_KEY
  )),
);

const CIRCLE_CONTACT_CUSTOM_FIELD_KEY_PREFIX = 'contact_custom_';

export function normalizeContactFieldKey(fieldKey?: string | null) {
  const value = fieldKey?.trim() || CONTACT_UNLOCK_DEFAULT_FIELD_KEY;
  if (!/^[A-Za-z0-9_.:-]{1,80}$/.test(value)) {
    throw new ValidationError('fieldKey 格式不合法');
  }
  if (!CONTACT_UNLOCK_ALLOWED_FIELD_KEYS.has(value)) {
    throw new ValidationError('fieldKey 暂不支持');
  }
  return value;
}

export function normalizeCircleContactFieldKey(fieldKey: string) {
  const value = fieldKey?.trim();
  if (!/^[A-Za-z0-9_.:-]{1,80}$/.test(value)) {
    throw new ValidationError('fieldKey 格式不合法');
  }
  if (
    !CIRCLE_CONTACT_ALLOWED_FIELD_KEYS.has(value) &&
    !(value.startsWith(CIRCLE_CONTACT_CUSTOM_FIELD_KEY_PREFIX) && value.length > CIRCLE_CONTACT_CUSTOM_FIELD_KEY_PREFIX.length)
  ) {
    throw new ValidationError('该联系方式字段不能用于兴趣圈 contacts 设置');
  }
  return value;
}

export function normalizeCircleContactLabel(label: string | undefined, fieldKey: string) {
  const fallback = Object.values(CONTACT_PLATFORM_META).find((meta) => meta.moduleKey === fieldKey)?.label ?? fieldKey;
  const value = (label ?? fallback).trim();
  if (!value) throw new ValidationError('联系方式名称不能为空');
  if (value.length > 30) throw new ValidationError('联系方式名称不能超过30个字符');
  return value;
}

export function normalizeCircleContactValue(value: string) {
  const normalized = value.trim();
  if (!normalized) throw new ValidationError('联系方式内容不能为空');
  if (normalized.length > 120) throw new ValidationError('联系方式内容不能超过120个字符');
  return normalized;
}

export function normalizeCircleContactInput(input: CircleContactInput) {
  const fieldKey = normalizeCircleContactFieldKey(input.fieldKey);
  return {
    fieldKey,
    label: normalizeCircleContactLabel(input.label, fieldKey),
    value: normalizeCircleContactValue(input.value),
    isEnabled: input.isEnabled ?? true,
    displayOrder: input.displayOrder ?? 0,
  };
}
