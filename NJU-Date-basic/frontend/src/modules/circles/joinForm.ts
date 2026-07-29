import type { Circle, JoinCirclePayload, JoinPolicyMode } from '../../api/circles';

export type CircleJoinQuestion = NonNullable<Circle['joinQuestions']>[number];

export function getJoinPolicyMode(policy: Circle['joinPolicy']): JoinPolicyMode {
  if (!policy) return 'public';
  return typeof policy === 'string' ? policy : policy.mode;
}

export function normalizeJoinAnswers(answers: Record<string, string>) {
  const trimmedAnswers: Record<string, string> = {};
  Object.entries(answers).forEach(([key, value]) => {
    const trimmedValue = value.trim();
    if (trimmedValue) {
      trimmedAnswers[key] = trimmedValue;
    }
  });
  return trimmedAnswers;
}

export function getJoinFormError(input: {
  joinPolicy: JoinPolicyMode;
  inviteCode: string;
  questions: CircleJoinQuestion[];
  answers: Record<string, string>;
}) {
  if (input.joinPolicy === 'invite' && !input.inviteCode.trim()) {
    return '请输入邀请码';
  }

  const trimmedAnswers = normalizeJoinAnswers(input.answers);
  const missingQuestion = input.questions.find((question) => (
    question.required && !trimmedAnswers[question.id]
  ));

  return missingQuestion ? `请填写：${missingQuestion.question}` : '';
}

export function buildJoinCirclePayload(input: {
  inviteCode: string;
  applicationReason: string;
  answers: Record<string, string>;
}): JoinCirclePayload {
  const trimmedAnswers = normalizeJoinAnswers(input.answers);
  const answerValues = Object.values(trimmedAnswers);

  return {
    ...(input.inviteCode.trim() ? { inviteCode: input.inviteCode.trim() } : {}),
    ...(input.applicationReason.trim() ? { applicationReason: input.applicationReason.trim() } : {}),
    ...(Object.keys(trimmedAnswers).length > 0 ? {
      answers: trimmedAnswers,
      answer: answerValues[0],
    } : {}),
  };
}
