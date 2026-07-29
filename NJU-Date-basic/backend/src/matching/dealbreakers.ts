/**
 * Dealbreaker filtering — Phase 1 of matching pipeline.
 * v4.0: updated for new question IDs and height range filter.
 */

import { Q, STRICT_LIKERT_QUESTIONS, FRIEND_SKIP_DEALBREAKER_QUESTIONS } from './surveySchema.js';

interface UserWithAnswers {
  id: string;
  gender: string;
  genderPref: string;
  department?: string | null;
  campus?: string | null;
  grade?: string | null;
  answers: Record<string, { value: number | string | string[] | { min: number; max: number }; importance?: number }>;
}

const NANJING_CAMPUSES = new Set(['xianlin', 'gulou', 'pukou']);

function normalizeCampus(campus?: string | null): string | null {
  if (!campus) return null;
  return campus === 'suzhou_campus' ? 'suzhou' : campus;
}

function isNanjingCampus(campus?: string | null): boolean {
  const normalized = normalizeCampus(campus);
  return normalized !== null && NANJING_CAMPUSES.has(normalized);
}

function includesCampus(campuses: string[], campus?: string | null): boolean {
  const normalizedCampus = normalizeCampus(campus);
  if (!normalizedCampus) return false;
  return campuses.map((c) => normalizeCampus(c)).includes(normalizedCampus);
}

// Keep higher numeric values aligned with "lower grade / less senior" so
// historical cohort-year values like 2023/2024 still follow the existing
// comparison direction in passesGradeCheck.
const GRADE_ORDER: Record<string, number> = {
  '博士后': 0,
  '博三及以上': 1,
  '博士三年级及以上': 1,
  '博二': 2,
  '博士二年级': 2,
  '博一': 3,
  '博士一年级': 3,
  '研三': 4,
  '硕士三年级': 4,
  '研二': 5,
  '硕士二年级': 5,
  '研一': 6,
  '硕士一年级': 6,
  '大五': 7,
  '本科五年级': 7,
  '大四': 8,
  '本科四年级': 8,
  '大三': 9,
  '本科三年级': 9,
  '大二': 10,
  '本科二年级': 10,
  '大一': 11,
  '本科一年级': 11,
};

function parseGradeValue(grade?: string | null): number | null {
  if (!grade) return null;
  const normalized = String(grade).trim();
  if (!normalized) return null;

  const mappedGrade = GRADE_ORDER[normalized];
  if (mappedGrade !== undefined) return mappedGrade;

  const digitsOnly = normalized.replace(/[^\d]/g, '');
  if (!digitsOnly) return null;

  const n = Number(digitsOnly);
  return Number.isFinite(n) ? n : null;
}

function passesGradeCheck(pref: string, mine: number, other: number): boolean {
  if (pref === 'same_grade') return mine === other;
  if (pref === 'lower_grade') return other > mine;
  if (pref === 'higher_grade') return other < mine;
  return true;
}

function passesGradePref(pref: string | string[] | undefined, mine: number, other: number): boolean {
  if (!pref) return true;
  if (Array.isArray(pref)) {
    if (pref.length === 0) return true;
    return pref.some(p => passesGradeCheck(p, mine, other));
  }
  return passesGradeCheck(pref, mine, other);
}

export function passesDealbreakerFilter(
  a: UserWithAnswers,
  b: UserWithAnswers,
  intention: 'friend' | 'partner' = 'partner',
): boolean {
  if (!genderMatch(a, b)) return false;
  if (!passesBasicsConstraints(a, b)) return false;

  for (const qId of STRICT_LIKERT_QUESTIONS) {
    if (intention === 'friend' && FRIEND_SKIP_DEALBREAKER_QUESTIONS.has(qId)) continue;

    const ansA = a.answers[qId];
    const ansB = b.answers[qId];
    if (!ansA || !ansB) continue;
    if (typeof ansA.value !== 'number' || typeof ansB.value !== 'number') continue;

    const diff = Math.abs(ansA.value - ansB.value);
    const importanceA = ansA.importance ?? 1;
    const importanceB = ansB.importance ?? 1;

    if ((importanceA >= 2 || importanceB >= 2) && diff >= 5) {
      return false;
    }
  }

  return true;
}

function passesBasicsConstraints(a: UserWithAnswers, b: UserWithAnswers): boolean {
  const ansA = a.answers;
  const ansB = b.answers;

  // ── Birth year range ──────────────────────────────────────────────
  const aBirth = ansA[Q.BIRTH_YEAR]?.value;
  const bBirth = ansB[Q.BIRTH_YEAR]?.value;
  const aRange = ansA[Q.BIRTH_YEAR_RANGE]?.value as { min: number; max: number } | undefined;
  const bRange = ansB[Q.BIRTH_YEAR_RANGE]?.value as { min: number; max: number } | undefined;

  if (typeof aBirth === 'number' && typeof bBirth === 'number') {
    if (aRange) {
      if (typeof aRange.min === 'number' && bBirth < aRange.min) return false;
      if (typeof aRange.max === 'number' && bBirth > aRange.max) return false;
    }
    if (bRange) {
      if (typeof bRange.min === 'number' && aBirth < bRange.min) return false;
      if (typeof bRange.max === 'number' && aBirth > bRange.max) return false;
    }
  }

  // ── Height（身高为选填字段，不做硬过滤）─────────────────────────────
  // 身高偏好通过 compatibility.ts 中的 heightSoftScore 软性影响匹配分数：
  //   - 在范围内: 1.0；超出 1-5cm: ~0.67；超出 10cm: ~0.33；超出 15cm+: 0.10
  // 硬过滤身高会在用户未填写时错误地淘汰大量可能的匹配，故移除。

  // ── Hometown preference ───────────────────────────────────────────
  const aHome = ansA[Q.HOMETOWN]?.value;
  const bHome = ansB[Q.HOMETOWN]?.value;
  const aHomePref = ansA[Q.HOMETOWN_PREF]?.value;
  const bHomePref = ansB[Q.HOMETOWN_PREF]?.value;

  if (typeof aHome === 'string' && typeof bHome === 'string') {
    if (aHomePref === 'prefer_same_province' && aHome !== bHome) {
      // Soft preference, not a hard filter — skip
    }
    if (bHomePref === 'prefer_same_province' && bHome !== aHome) {
      // Soft preference — skip
    }
  }

  // ── Cross-campus ──────────────────────────────────────────────────
  const aCampus = normalizeCampus(a.campus);
  const bCampus = normalizeCampus(b.campus);
  const crossCampus = aCampus && bCampus && aCampus !== bCampus;
  if (crossCampus) {
    const aCampusPref = ansA[Q.CROSS_CAMPUS]?.value;
    const bCampusPref = ansB[Q.CROSS_CAMPUS]?.value;

    if (aCampusPref === 'same_campus_only' || bCampusPref === 'same_campus_only') return false;
    if (aCampusPref === 'nanjing_campuses' && !isNanjingCampus(bCampus)) return false;
    if (bCampusPref === 'nanjing_campuses' && !isNanjingCampus(aCampus)) return false;

    // select_campuses：如果选了具体校区列表，且对方校区不在列表内 → 淘汰
    if (aCampusPref === 'select_campuses') {
      const aSelected = ansA[Q.CAMPUS_SELECT]?.value;
      if (Array.isArray(aSelected) && aSelected.length > 0 && !includesCampus(aSelected, bCampus)) {
        return false;
      }
    }
    if (bCampusPref === 'select_campuses') {
      const bSelected = ansB[Q.CAMPUS_SELECT]?.value;
      if (Array.isArray(bSelected) && bSelected.length > 0 && !includesCampus(bSelected, aCampus)) {
        return false;
      }
    }
  }

  // ── Major preference ──────────────────────────────────────────────
  if (a.department && b.department) {
    const sameMajor = a.department === b.department;
    const aPref = ansA[Q.MAJOR_PREF]?.value;
    const bPref = ansB[Q.MAJOR_PREF]?.value;

    if (aPref === 'strict_same_major' && !sameMajor) return false;
    if (bPref === 'strict_same_major' && !sameMajor) return false;
    if (aPref === 'strict_diff_major' && sameMajor) return false;
    if (bPref === 'strict_diff_major' && sameMajor) return false;
  }

  // ── Grade preference ──────────────────────────────────────────────
  const aGrade = parseGradeValue(a.grade);
  const bGrade = parseGradeValue(b.grade);
  if (aGrade !== null && bGrade !== null) {
    const aPref = ansA[Q.GRADE_PREF]?.value as string | string[] | undefined;
    const bPref = ansB[Q.GRADE_PREF]?.value as string | string[] | undefined;
    if (!passesGradePref(aPref, aGrade, bGrade)) return false;
    if (!passesGradePref(bPref, bGrade, aGrade)) return false;
  }

  // ── Smoking hard filter ───────────────────────────────────────────
  const aSmoke = ansA[Q.SMOKE]?.value;
  const bSmoke = ansB[Q.SMOKE]?.value;
  const aSmokePref = ansA[Q.SMOKE_PREF]?.value;
  const bSmokePref = ansB[Q.SMOKE_PREF]?.value;

  // q10 semantics: higher score means stronger disagreement with smoker partner.
  // If someone smokes and the other strongly agrees (>= 6), hard filter.
  if (aSmoke === 'yes' && typeof bSmokePref === 'number' && bSmokePref >= 6) return false;
  if (bSmoke === 'yes' && typeof aSmokePref === 'number' && aSmokePref >= 6) return false;

  return true;
}

function genderMatch(a: UserWithAnswers, b: UserWithAnswers): boolean {
  const aPrefersB = a.genderPref === 'any' || a.genderPref === b.gender;
  const bPrefersA = b.genderPref === 'any' || b.genderPref === a.gender;
  return aPrefersB && bPrefersA;
}
