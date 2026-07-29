import { createHash } from 'crypto';
import { v4 as uuid } from 'uuid';
import { ConflictError, ValidationError } from '../../utils/errors.js';
import { CIRCLE_MEMBERSHIP_STATUS } from '../../utils/circleMembership.js';

export const JOIN_POLICY = {
  PUBLIC: 'public',
  REVIEW: 'review',
  INVITE: 'invite',
} as const;

export const CIRCLE_JOIN_REQUEST_STATUS = {
  PENDING_REVIEW: 'pending_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
  WITHDRAWN: 'withdrawn',
} as const;

export const SENSITIVE_WORDS = ['赌博', '诈骗', '色情', '暴力', '违法'];

export type JoinPolicy = typeof JOIN_POLICY[keyof typeof JOIN_POLICY];
export type CircleJoinRequestStatus = typeof CIRCLE_JOIN_REQUEST_STATUS[keyof typeof CIRCLE_JOIN_REQUEST_STATUS];

export type JoinQuestionDefinition = {
  id: string;
  question: string;
  required: boolean;
};

export type KeywordRule = {
  keyword: string;
  action: 'reject';
};

export type JoinAnswerInput = Record<string, string> | Array<{
  questionId: string;
  value: string;
}>;

export type JoinCirclePayload = {
  inviteCode?: string;
  answer?: string;
  answers?: JoinAnswerInput;
  applicationReason?: string;
};

export type CircleJoinPolicySource = {
  joinQuestions?: Array<{ id?: string; question: string; required?: boolean }> | null;
  joinQuestion?: string | null;
  keywordRules?: KeywordRule[] | null;
};

export function throwJoinCircleConflict(membershipStatus?: string): never {
  if (membershipStatus === CIRCLE_MEMBERSHIP_STATUS.PENDING) {
    throw new ConflictError('入圈申请正在审核中');
  }
  throw new ConflictError('你已加入该圈子');
}

export function normalizeNullableText(value?: string | null) {
  if (value === undefined) return undefined;
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

export function normalizeCapacityLimit(value?: number | null) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!Number.isInteger(value) || value < 1 || value > 100000) {
    throw new ValidationError('圈子容量上限需为 1-100000 的整数');
  }
  return value;
}

export function normalizeJoinQuestionId(input?: string | null) {
  const value = String(input ?? '').trim();
  if (!value) return `q_${uuid().slice(0, 8)}`;
  return value
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 60) || `q_${uuid().slice(0, 8)}`;
}

export function normalizeJoinQuestions(
  input?: Array<{ id?: string; question: string; required?: boolean }> | null,
  fallbackQuestion?: string | null,
): JoinQuestionDefinition[] {
  const source = input && input.length > 0
    ? input
    : fallbackQuestion
      ? [{ id: 'default', question: fallbackQuestion, required: true }]
      : [];
  const seen = new Set<string>();

  return source.slice(0, 5).map((item, index) => {
    const question = item.question.trim();
    if (!question || question.length > 120) {
      throw new ValidationError('入圈问题需为 1-120 字');
    }
    let id = normalizeJoinQuestionId(item.id ?? `q_${index + 1}`);
    while (seen.has(id)) {
      id = `${id}_${index + 1}`;
    }
    seen.add(id);
    return {
      id,
      question,
      required: item.required ?? true,
    };
  });
}

export function normalizeKeywordRules(input?: KeywordRule[] | null): KeywordRule[] {
  const source = input ?? [];
  const seen = new Set<string>();
  const rules: KeywordRule[] = [];

  for (const item of source) {
    const keyword = item.keyword.trim();
    if (!keyword) continue;
    if (keyword.length > 40) throw new ValidationError('关键词过滤规则不能超过 40 字');
    const normalized = keyword.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    rules.push({ keyword, action: 'reject' });
    if (rules.length >= 20) break;
  }

  return rules;
}

export function hashInviteCode(inviteCode: string) {
  return createHash('sha256').update(inviteCode).digest('hex');
}

export function inviteCodeMatches(
  input: string | undefined,
  circle: { inviteCodeHash?: string | null; inviteCode?: string | null },
) {
  const normalized = normalizeNullableText(input);
  if (!normalized) return false;
  if (circle.inviteCodeHash && hashInviteCode(normalized) === circle.inviteCodeHash) return true;
  return false;
}

export function assertNoKeywordRuleHits(
  fields: Array<{ label: string; value: string | null | undefined }>,
  rules: KeywordRule[] = [],
) {
  const allRules = [
    ...SENSITIVE_WORDS.map((word) => ({ keyword: word, action: 'reject' as const })),
    ...rules,
  ];
  const hit = fields.find((field) => {
    const value = String(field.value ?? '').toLowerCase();
    return allRules.some((rule) => value.includes(rule.keyword.toLowerCase()));
  });

  if (hit) {
    throw new ValidationError(`${hit.label}包含敏感或禁止关键词`);
  }
}

export function assertCircleCapacityAvailable(circle: { capacityLimit?: number | null; memberCount: number }) {
  if (circle.capacityLimit !== null && circle.capacityLimit !== undefined && circle.memberCount >= circle.capacityLimit) {
    throw new ConflictError('圈子人数已满');
  }
}

export function normalizeJoinAnswerMap(payload: JoinCirclePayload, questions: JoinQuestionDefinition[]) {
  const answers: Record<string, string> = {};

  if (Array.isArray(payload.answers)) {
    for (const item of payload.answers) {
      const key = normalizeJoinQuestionId(item.questionId);
      const value = String(item.value ?? '').trim();
      if (value) answers[key] = value.slice(0, 300);
    }
  } else if (payload.answers && typeof payload.answers === 'object') {
    for (const [rawKey, rawValue] of Object.entries(payload.answers)) {
      const key = normalizeJoinQuestionId(rawKey);
      const value = String(rawValue ?? '').trim();
      if (value) answers[key] = value.slice(0, 300);
    }
  }

  const legacyAnswer = normalizeNullableText(payload.answer);
  if (legacyAnswer && questions.length > 0 && Object.keys(answers).length === 0) {
    answers[questions[0]!.id] = legacyAnswer.slice(0, 300);
  } else if (legacyAnswer && questions.length === 0) {
    answers.default = legacyAnswer.slice(0, 300);
  }

  for (const question of questions) {
    if (question.required && !answers[question.id]) {
      throw new ValidationError(`请填写入圈问题：${question.question}`);
    }
  }

  return answers;
}

export function normalizeJoinApplication(
  circle: CircleJoinPolicySource,
  payload: JoinCirclePayload,
) {
  const questions = normalizeJoinQuestions(circle.joinQuestions, circle.joinQuestion);
  const answers = normalizeJoinAnswerMap(payload, questions);
  const applicationReason = normalizeNullableText(payload.applicationReason);
  const keywordRules = normalizeKeywordRules(circle.keywordRules);

  assertNoKeywordRuleHits([
    { label: '申请理由', value: applicationReason },
    ...Object.entries(answers).map(([key, value]) => ({ label: `入圈答案 ${key}`, value })),
  ], keywordRules);

  return {
    answers,
    applicationAnswer: normalizeNullableText(payload.answer) ?? Object.values(answers)[0] ?? null,
    applicationReason,
  };
}
