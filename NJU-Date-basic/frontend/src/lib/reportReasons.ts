export const REPORT_REASON_OPTIONS = [
  { value: 'pornographic', label: '色情低俗' },
  { value: 'violent', label: '暴力血腥' },
  { value: 'personal_attack', label: '人身攻击' },
  { value: 'provocation', label: '引战挑衅' },
  { value: 'ad_spam', label: '广告刷屏' },
  { value: 'junk_info', label: '垃圾信息' },
  { value: 'privacy_violation', label: '侵犯隐私' },
  { value: 'other', label: '其他' },
] as const;

export type ReportReasonValue = (typeof REPORT_REASON_OPTIONS)[number]['value'];

export const REPORT_REASON_LABEL: Record<ReportReasonValue, string> = {
  pornographic: '色情低俗',
  violent: '暴力血腥',
  personal_attack: '人身攻击',
  provocation: '引战挑衅',
  ad_spam: '广告刷屏',
  junk_info: '垃圾信息',
  privacy_violation: '侵犯隐私',
  other: '其他',
};
