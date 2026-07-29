import { AppError, ValidationError } from '../../utils/errors.js';
import { containsContactLikeText } from '../../utils/contactLikeText.js';

const MAX_CHAT_CONTENT_LENGTH = 500;
const MAX_MENTION_COUNT = 20;

export type CircleKeywordRule = {
  keyword: string;
  action?: 'reject';
};

export function normalizeChatContent(content: string) {
  const normalized = content.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    throw new ValidationError('消息不能为空');
  }
  if (normalized.length > MAX_CHAT_CONTENT_LENGTH) {
    throw new AppError(400, 'CHAT_MESSAGE_TOO_LONG', `消息不能超过 ${MAX_CHAT_CONTENT_LENGTH} 个字符`);
  }
  return normalized;
}

export function normalizeMentions(mentions?: string[]) {
  if (!mentions) return [];
  const unique = Array.from(new Set(
    mentions
      .filter((value) => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean),
  ));
  if (unique.length > MAX_MENTION_COUNT) {
    throw new ValidationError(`一次最多提及 ${MAX_MENTION_COUNT} 人`);
  }
  return unique;
}

export function assertChatContentAllowed(content: string, keywordRules: CircleKeywordRule[] = []) {
  if (containsContactLikeText(content)) {
    throw new AppError(
      400,
      'CONTACT_TEXT_NOT_ALLOWED',
      '群聊中不要直接填写手机号、微信、邮箱等联系方式，请使用圈内联系方式或后续授权流程',
    );
  }

  const matchedRule = keywordRules.find((rule) => {
    const keyword = rule.keyword?.trim();
    return keyword && content.includes(keyword);
  });
  if (matchedRule) {
    throw new AppError(400, 'KEYWORD_BLOCKED', '消息包含圈子规则限制的内容');
  }
}
