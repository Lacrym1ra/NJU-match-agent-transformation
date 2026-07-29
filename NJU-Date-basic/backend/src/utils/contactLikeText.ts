export const CONTACT_LIKE_PATTERNS = [
  /(?:\+?86[-\s]?)?1[3-9]\d[-\s]?\d{4}[-\s]?\d{4}/g,
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  /(?:微信|wechat|weixin|wx|vx|QQ|qq|电话|手机号|手机|邮箱|email|mail|联系方式|联系我|加我)[:：\s-]*[A-Za-z0-9_\-.@]{3,}/gi,
];

export function containsContactLikeText(value: string) {
  return CONTACT_LIKE_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(value);
  });
}

export function replaceContactLikeText(value: string, replacement: string) {
  return CONTACT_LIKE_PATTERNS.reduce((text, pattern) => {
    pattern.lastIndex = 0;
    return text.replace(pattern, replacement);
  }, value);
}
