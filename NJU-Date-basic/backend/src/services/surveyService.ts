import { v4 as uuid } from 'uuid';
import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { surveyAnswers, users } from '../db/schema.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { QUESTION_BANK, getQuestionsBySection, type Question } from '../db/seed.js';

const SURVEY_VERSION = '4.0';

export async function getAgentQuestionnaireStatus(userId: string) {
  const [user] = await db
    .select({ surveyComplete: users.surveyComplete })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new NotFoundError('用户不存在');
  }

  const [submission] = await db
    .select({
      version: surveyAnswers.version,
      submittedAt: surveyAnswers.submittedAt,
      updatedAt: surveyAnswers.updatedAt,
    })
    .from(surveyAnswers)
    .where(eq(surveyAnswers.userId, userId))
    .limit(1);

  const complete = Boolean(user.surveyComplete) && submission !== undefined;
  const submittedVersion = submission?.version ?? null;

  return {
    complete,
    currentVersion: SURVEY_VERSION,
    submittedVersion,
    needsUpdate: submittedVersion !== null && submittedVersion !== SURVEY_VERSION,
    submittedAt: submission?.updatedAt ?? submission?.submittedAt ?? null,
  };
}

// v4.0 全面改版：问题已全面重构，老用户须重新填写
const CHANGED_QUESTION_IDS = [
  // basics — 选项更新或 ID 含义变更
  'q_height', 'q_height_range', 'q61', 'q3', 'q4', 'q6', 'q8',
  'q_jiangsu_city', 'q6_campus_select',
  // interests — 兴趣分支全新
  'q_top_interest', 'q_date_content', 'q_weekend_date',
  'q_mv_type', 'q_mv_media', 'q_mv_together',
  'q_bg_type', 'q_bg_prio',
  'q_acg_contact', 'q_acg_together',
  'q_ph_direction', 'q_ph_prio',
  'q_fd_type', 'q_fd_prio',
  'q_tr_type', 'q_tr_style',
  'q_sp_type', 'q_sp_partner',
  'q_gm_platform', 'q_gm_genre', 'q_gm_mobile', 'q_gm_pc', 'q_gm_switch', 'q_gm_self', 'q_gm_partner',
  'q_music_style',
  // lifestyle — 新题或选项/语义更改
  'q_drink_freq', 'q_drink_pref', 'q_pet_like', 'q_pet_partner',
  'q_schedule_imp', 'q_free_time', 'q_spend_style', 'q_spend_imp',
  'q37', 'q38',
  // communication — 含恋爱节奏，全部新增
  'q_rel_mode', 'q_my_pace', 'q_partner_pace',
  'q_atmosphere', 'q_conflict_self', 'q_conflict_partner', 'q_support_pref',
  'q_reply_speed', 'q_reply_pref', 'q41', 'q36', 'q_affection_need', 'q_physical_pace',
  // boundary — ID 重映射
  'q_rel_history', 'q_history_imp', 'q50', 'q44', 'q47', 'q48', 'q49', 'q_keep_space', 'q_red_flags',
  'q57', 'q58',
  // values — 含大量旧 ID 语义变更（如 q29 从"有空时间"变为"我的品质"）
  'q21', 'q27', 'q24', 'q25', 'q33', 'q26', 'q28', 'q30', 'q_work_style',
  'q_future_base', 'q_future_base_imp', 'q_growth_env', 'q_family_econ',
  'q31', 'q29', 'q_partner_qualities', 'q60', 'q_must_align',
];

export function getQuestions() {
  return { version: SURVEY_VERSION, changedQuestionIds: CHANGED_QUESTION_IDS, sections: getQuestionsBySection() };
}

const MULTI_VALUE_PREFIX_BASES = new Set(['other_interest', 'other_specify']);

function sanitizeOptionArray(rawValue: unknown, options: string[], allowPrefixed: boolean): string[] {
  const optionSet = new Set(options);
  const source = Array.isArray(rawValue) ? rawValue : (typeof rawValue === 'string' ? [rawValue] : []);
  const sanitized: string[] = [];
  const seen = new Set<string>();

  for (const item of source) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed) continue;

    let normalized: string | undefined;
    if (optionSet.has(trimmed)) {
      normalized = trimmed;
    } else if (allowPrefixed && trimmed.includes(':')) {
      const idx = trimmed.indexOf(':');
      const base = trimmed.slice(0, idx);
      if (optionSet.has(base) && MULTI_VALUE_PREFIX_BASES.has(base)) {
        normalized = trimmed;
      }
    }

    if (!normalized) continue;
    const dedupeKey = normalized.includes(':') ? normalized.split(':')[0] : normalized;
    if (seen.has(dedupeKey)) continue;

    seen.add(dedupeKey);
    sanitized.push(normalized);
  }

  return sanitized;
}

function sanitizeAnswerForQuestion(q: Question, answerRaw: unknown): { value: unknown; importance?: number } | undefined {
  if (!answerRaw || typeof answerRaw !== 'object') return undefined;
  const answer = answerRaw as { value?: unknown; importance?: unknown };
  const value = answer.value;

  switch (q.type) {
    case 'likert': {
      if (typeof value !== 'number' || Number.isNaN(value)) return undefined;
      const min = q.scale?.min ?? 1;
      const max = q.scale?.max ?? 7;
      if (value < min || value > max) return undefined;
      const imp = (typeof answer.importance === 'number' && Number.isInteger(answer.importance) && answer.importance >= 1 && answer.importance <= 5)
        ? answer.importance
        : undefined;
      return imp ? { value, importance: imp } : { value };
    }
    case 'single_select': {
      if (typeof value !== 'string') return undefined;
      if (!q.options?.includes(value)) return undefined;
      return { value };
    }
    case 'multi_select': {
      const options = q.options ?? [];
      const sanitized = sanitizeOptionArray(value, options, true);
      if (sanitized.length === 0) return undefined;
      const max = q.maxSelect ?? options.length;
      return { value: sanitized.slice(0, max) };
    }
    case 'ranking': {
      const options = q.options ?? [];
      const sanitized = sanitizeOptionArray(value, options, false);
      if (sanitized.length !== options.length) return undefined;
      const asSet = new Set(sanitized);
      if (asSet.size !== options.length) return undefined;
      for (const opt of options) {
        if (!asSet.has(opt)) return undefined;
      }
      return { value: sanitized };
    }
    case 'open_text': {
      if (typeof value !== 'string') return undefined;
      if (!value.trim()) return undefined;
      return { value };
    }
    case 'number_input': {
      if (typeof value !== 'number' || Number.isNaN(value)) return undefined;
      if ((q.min !== undefined && value < q.min) || (q.max !== undefined && value > q.max)) return undefined;
      return { value };
    }
    case 'year_range':
    case 'height_range': {
      if (!value || typeof value !== 'object') return undefined;
      const range = value as { min?: unknown; max?: unknown };
      const minVal = typeof range.min === 'number' && !Number.isNaN(range.min) ? range.min : undefined;
      const maxVal = typeof range.max === 'number' && !Number.isNaN(range.max) ? range.max : undefined;

      if (minVal === undefined && maxVal === undefined) return undefined;
      if (q.min !== undefined && minVal !== undefined && minVal < q.min) return undefined;
      if (q.max !== undefined && minVal !== undefined && minVal > q.max) return undefined;
      if (q.min !== undefined && maxVal !== undefined && maxVal < q.min) return undefined;
      if (q.max !== undefined && maxVal !== undefined && maxVal > q.max) return undefined;
      if (minVal !== undefined && maxVal !== undefined && maxVal <= minVal) return undefined;

      return { value: { ...(minVal !== undefined ? { min: minVal } : {}), ...(maxVal !== undefined ? { max: maxVal } : {}) } };
    }
    default:
      return undefined;
  }
}

function sanitizeAnswers(rawAnswers: Record<string, unknown>): Record<string, unknown> {
  const questionMap = new Map(QUESTION_BANK.map((q) => [q.id, q]));
  const sanitized: Record<string, unknown> = {};

  for (const [qId, answerRaw] of Object.entries(rawAnswers)) {
    const question = questionMap.get(qId);
    if (!question) continue;
    const cleaned = sanitizeAnswerForQuestion(question, answerRaw);
    if (!cleaned) continue;
    sanitized[qId] = cleaned;
  }

  return sanitized;
}

function validateAnswers(answers: Record<string, unknown>, intention: 'friend' | 'partner' = 'partner') {
  if (!answers || typeof answers !== 'object') {
    throw new ValidationError('answers 字段缺失');
  }

  const isQuestionVisible = (q: any) => {
    if (q.partnerOnly && intention === 'friend') return false;
    if (!q.dependsOn) return true;
    const depAns = answers[q.dependsOn.questionId] as any;
    if (!depAns || typeof depAns !== 'object' || depAns.value === undefined) return false;

    const depAnsRaw = depAns.value;
    const requiredVals = Array.isArray(q.dependsOn.value) ? q.dependsOn.value : [q.dependsOn.value];
    const depAnsArr = Array.isArray(depAnsRaw) ? depAnsRaw : (typeof depAnsRaw === 'string' ? [depAnsRaw] : []);

    return requiredVals.some((req: string) => depAnsArr.some((ans: string) => typeof ans === 'string' && (ans === req || ans.startsWith(req + ':'))));
  };

  const missing = QUESTION_BANK.filter((q) => {
    if (q.required === false) return false;
    if (!isQuestionVisible(q)) return false;
    const a = answers[q.id] as Record<string, unknown> | undefined;
    return !a || a.value === undefined || a.value === null;
  });

  if (missing.length > 0) {
    throw new ValidationError('部分题目未作答', missing.map((q) => ({ field: q.id, message: `${q.id} 未作答` })));
  }
}

export async function submitAnswers(userId: string, answers: Record<string, unknown>) {
  const userRows = await db.select({ intention: users.intention }).from(users).where(eq(users.id, userId)).limit(1);
  const intention = (userRows[0]?.intention as 'friend' | 'partner' | null) ?? 'partner';
  const sanitizedAnswers = sanitizeAnswers(answers);
  validateAnswers(sanitizedAnswers, intention);
  const answersJson = JSON.stringify(sanitizedAnswers);

  // Upsert: delete old then insert
  const existingRows = await db.select().from(surveyAnswers).where(eq(surveyAnswers.userId, userId)).limit(1);
  const existing = existingRows[0];

  if (existing) {
    await db.update(surveyAnswers)
      .set({ answers: answersJson, version: SURVEY_VERSION, updatedAt: new Date().toISOString() })
      .where(eq(surveyAnswers.userId, userId));
  } else {
    await db.insert(surveyAnswers)
      .values({ id: uuid(), userId, answers: answersJson, version: SURVEY_VERSION });
  }

  // Mark survey as complete
  await db.update(users)
    .set({ surveyComplete: true, updatedAt: new Date().toISOString() })
    .where(eq(users.id, userId));

  return { message: '问卷已提交', surveyComplete: true };
}

export async function getAnswers(userId: string) {
  const rows = await db.select().from(surveyAnswers).where(eq(surveyAnswers.userId, userId)).limit(1);
  const row = rows[0];
  if (!row) {
    throw new NotFoundError('尚未提交问卷');
  }
  return { answers: JSON.parse(row.answers), version: row.version, submittedAt: row.updatedAt || row.submittedAt };
}
