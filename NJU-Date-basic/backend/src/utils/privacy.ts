const SENSITIVE_FIELD_HINTS_EN = [
  'wechat',
  'weixin',
  'phone',
  'mobile',
  'email',
  'contact',
  'qq',
  'student_id',
  'studentid',
  'student-no',
  'student_no',
  'private',
  'secret',
];

const SENSITIVE_FIELD_HINTS_ZH = [
  '微信',
  '联系方式',
  '联系我',
  '邮箱',
  '电话',
  '手机号',
  '手机',
  '小红书',
  'QQ号',
  'qq号',
  '学号',
  '证件',
  '私密',
  '隐私',
];

const CONTACT_VALUE_PATTERNS = [
  /(?:\+?86[-\s]?)?1[3-9]\d[-\s]?\d{4}[-\s]?\d{4}/,
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
  /(?:微信|wechat|weixin|wx|vx|QQ|qq|电话|手机号|手机|邮箱|email|mail|联系方式|联系我|加我)[:：\s-]*[A-Za-z0-9_\-.@]{3,}/i,
];

export function isSensitiveFieldText(value: string | null | undefined): boolean {
  const raw = `${value ?? ''}`.trim();
  if (!raw) return false;

  const lower = raw.toLowerCase();
  return lower.startsWith('contact_')
    || SENSITIVE_FIELD_HINTS_EN.some((hint) => lower.includes(hint))
    || SENSITIVE_FIELD_HINTS_ZH.some((hint) => raw.includes(hint));
}

export function containsSensitiveContactValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.some((item) => containsSensitiveContactValue(item));
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((item) => containsSensitiveContactValue(item));
  }

  const text = String(value).trim();
  if (!text) return false;
  return CONTACT_VALUE_PATTERNS.some((pattern) => pattern.test(text));
}
