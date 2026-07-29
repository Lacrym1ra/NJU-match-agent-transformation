/**
 * Compatibility scoring — Phase 2 of matching pipeline.
 * v4.1: 全面升级
 *   - MBTI 无偏好 0.5→0.75，未命中 0.2→0.45
 *   - Categorical 不匹配底线 0→0.30，q_rel_mode 互补配对
 *   - Multi-select 改用 Jaccard + OverlapCoefficient 混合
 *   - LIKERT_CROSS_PAIRS：我的经历↔对方期望、我的风格↔对方偏好
 *   - 饮酒交叉匹配（频率 × 接受度）
 *   - 身高软分（从 dealbreakers 移入，按偏差线性衰减）
 *   - q_must_align 双方一致时对应维度 ×1.3
 *   - 最终分数底线 60%（dealbreaker 通过后最低展示值）
 */

import {
  CATEGORICAL_QUESTIONS,
  CATEGORICAL_CROSS_PAIRS,
  COMPONENT_WEIGHTS,
  CROSS_MULTI_SELECT_PAIRS,
  DIMENSIONS,
  DIMENSION_WEIGHTS,
  FRIEND_DIMENSION_WEIGHTS,
  INTEREST_SUB_KEY,
  LIKERT_CROSS_PAIRS,
  MULTI_SELECT_QUESTIONS,
  MUST_ALIGN_TO_DIMENSION,
  Q,
  RANKING_QUESTIONS,
} from './surveySchema.js';

export { DIMENSIONS } from './surveySchema.js';

interface Answer {
  value: number | string | string[];
  importance?: number;
}

type Answers = Record<string, Answer>;

interface CompatibilityContext {
  aDepartment?: string | null;
  bDepartment?: string | null;
  aCampus?: string | null;
  bCampus?: string | null;
  aMbti?: string | null;
  bMbti?: string | null;
  intention?: 'friend' | 'partner';
}

// ── 最低展示分数（dealbreaker 通过后的分数底线）────────────────────────────
const MIN_SCORE = 0.60;

// ── Likert 双向维度计算 ────────────────────────────────────────────────────
// 使用调用方的 importance 权重，双向取均值以平衡双方偏好强度。
function oneWayLikertCompat(aAnswers: Answers, bAnswers: Answers, questionIds: string[]): number {
  let totalPenalty = 0;
  let maxPenalty = 0;

  for (const qId of questionIds) {
    const a = aAnswers[qId];
    const b = bAnswers[qId];
    if (!a || !b) continue;
    if (typeof a.value !== 'number' || typeof b.value !== 'number') continue;

    const weight = a.importance ?? 1;
    const diff = Math.abs(a.value - b.value);

    totalPenalty += weight * diff;
    maxPenalty += weight * 6;
  }

  if (maxPenalty === 0) return 1;
  return 1 - totalPenalty / maxPenalty;
}

// ── Categorical 相似度（含底线 + 互补逻辑）───────────────────────────────
function categoricalSimilarity(a: string, b: string, qId?: string): number {
  if (qId === 'q32') {
    if (a === 'go_with_flow' || b === 'go_with_flow') return a === b ? 1.0 : 0.85;
    if (a === 'share_equally' || b === 'share_equally') return a === b ? 1.0 : 0.35;
    if (
      (a === 'i_pay_more' && b === 'partner_pays_more') ||
      (a === 'partner_pays_more' && b === 'i_pay_more')
    ) return 1.0;
    if (a === 'i_pay_more' && b === 'i_pay_more') return 0.75;
    if (a === 'partner_pays_more' && b === 'partner_pays_more') return 0.20;
  }

  // 通用中性/灵活选项 → 高兼容
  if (a === 'flexible' || b === 'flexible') return 1.0;
  if (a === 'go_with_flow' || b === 'go_with_flow') return 0.85;
  if (a === 'all_fine' || b === 'all_fine') return 0.85;
  if (a === 'both_ok' || b === 'both_ok') return 0.80;
  if (a === 'dont_care' || b === 'dont_care') return 0.78;
  if (a === 'depends' || b === 'depends' || a === 'depends_mood' || b === 'depends_mood') return 0.75;
  if (a === 'depends_on_person' || b === 'depends_on_person') return 0.75;
  if (a === 'no_preference' || b === 'no_preference') return 0.72;

  if (a === b) return 1.0;

  // ── 题目专属互补逻辑 ──────────────────────────────────────────────
  if (qId === 'q_rel_mode') {
    // 主动 ↔ 希望对方主动 = 完美互补
    if (
      (a === 'proactive' && b === 'prefer_partner_active') ||
      (a === 'prefer_partner_active' && b === 'proactive')
    ) return 1.0;
    if (a === 'mutual_active' || b === 'mutual_active') return 0.72;
    if (a === 'casual_flow' || b === 'casual_flow') return 0.60;
  }

  if (qId === 'q_sp_partner') {
    // 一方想带另一方 ↔ 另一方想被带
    if (
      (a === 'need_coach' && b === 'long_term') ||
      (b === 'need_coach' && a === 'long_term')
    ) return 0.75;
    if (a === 'pure_company' || b === 'pure_company') return 0.68;
  }

  if (qId === 'q_gm_partner') {
    // carry_or_carried 视作无所谓，避免旧答案保留“我带对面”的硬语义
    if (a === 'carry_or_carried' || b === 'carry_or_carried') return 0.78;
    if (a === 'some_gap_ok' || b === 'some_gap_ok') return 0.68;
  }

  if (qId === 'q_family_econ') {
    // 家庭经济相差一级视为接近
    const ECON_ORDER: Record<string, number> = {
      tight: 1, normal: 2, comfortable: 3, very_comfortable: 4, prefer_not_say: 2.5,
    };
    const da = ECON_ORDER[a], db = ECON_ORDER[b];
    if (da !== undefined && db !== undefined) {
      const gap = Math.abs(da - db);
      if (gap === 0) return 1.0;
      if (gap === 1) return 0.75;
      if (gap === 2) return 0.45;
      return 0.25;
    }
  }

  if (qId === 'q_growth_env') {
    // 成长环境相差一级视为接近
    const ENV_ORDER: Record<string, number> = {
      tier1_core: 4, tier2: 3, tier3_4: 2, county: 1, rural: 0,
    };
    const da = ENV_ORDER[a], db = ENV_ORDER[b];
    if (da !== undefined && db !== undefined) {
      const gap = Math.abs(da - db);
      if (gap === 0) return 1.0;
      if (gap === 1) return 0.75;
      if (gap === 2) return 0.50;
      return 0.30;
    }
  }

  // 默认底线：不同但不致命
  return 0.30;
}

// ── Jaccard 相似度 ────────────────────────────────────────────────────────
// ── 混合兴趣相似度（Jaccard + Overlap 各占50%）──────────────────────────
// Overlap Coefficient 在一方选项少时更公平；两者混合减少极端值。
// setA/setB 共享，避免重复构建。
function blendedMultiSelectSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersectionCount = [...setA].filter((x) => setB.has(x)).length;
  if (intersectionCount === 0 && setA.size === 0 && setB.size === 0) return 1;
  const jaccard = setA.size + setB.size - intersectionCount === 0
    ? 1
    : intersectionCount / (setA.size + setB.size - intersectionCount);
  const minLen = Math.min(a.length, b.length);
  const overlap = minLen === 0 ? 1 : intersectionCount / minLen;
  return (jaccard + overlap) / 2;
}

// ── Spearman 排序相关 ─────────────────────────────────────────────────────
function spearmanCorrelation(a: string[], b: string[]): number {
  const n = a.length;
  if (n <= 1) return 1;

  const rankA = new Map(a.map((item, idx) => [item, idx + 1]));
  const rankB = new Map(b.map((item, idx) => [item, idx + 1]));

  let sumDSquared = 0;
  for (const item of a) {
    const rA = rankA.get(item) ?? 0;
    const rB = rankB.get(item) ?? 0;
    sumDSquared += (rA - rB) ** 2;
  }

  const rho = 1 - (6 * sumDSquared) / (n * (n * n - 1));
  return (rho + 1) / 2;
}

function majorPreferenceScore(pref: unknown, sameMajor: boolean): number {
  if (pref === 'strict_same_major') return sameMajor ? 1 : 0;
  if (pref === 'prefer_same_major') return sameMajor ? 1 : 0.4;
  if (pref === 'strict_diff_major') return sameMajor ? 0 : 1;
  if (pref === 'prefer_diff_major') return sameMajor ? 0.35 : 1;
  return 0.7; // neutral
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

function includesCampus(campuses: string[] | undefined, campus?: string | null): boolean {
  const normalizedCampus = normalizeCampus(campus);
  if (!campuses || !normalizedCampus) return false;
  return campuses.map((c) => normalizeCampus(c)).includes(normalizedCampus);
}

// targetCampus: 对方实际所在校区；selectedCampuses: 当 pref='select_campuses' 时自选列表
function campusPreferenceScore(
  pref: unknown,
  sameCampus: boolean,
  targetCampus: string,
  selectedCampuses?: string[],
): number {
  if (pref === 'same_campus_only') return sameCampus ? 1.0 : 0.0;
  if (pref === 'nanjing_campuses') return isNanjingCampus(targetCampus) ? (sameCampus ? 1.0 : 0.85) : 0.0;
  if (pref === 'select_campuses') {
    if (!selectedCampuses || selectedCampuses.length === 0) return 0.8; // 未填 = 任意
    return includesCampus(selectedCampuses, targetCampus) ? 1.0 : 0.15;
  }
  return 0.8; // any_campus
}

// ── 省份 → 大区映射（用于 prefer_nearby 判断）────────────────────────────
// 大区划分：华北 / 东北 / 华东 / 华中 / 华南 / 西南 / 西北 / 港澳台海外
const PROVINCE_REGION: Record<string, string> = {
  beijing: '华北', tianjin: '华北', hebei: '华北', shanxi: '华北', inner_mongolia: '华北',
  liaoning: '东北', jilin: '东北', heilongjiang: '东北',
  shanghai: '华东', jiangsu: '华东', zhejiang: '华东', anhui: '华东',
  fujian: '华东', jiangxi: '华东', shandong: '华东',
  henan: '华中', hubei: '华中', hunan: '华中',
  guangdong: '华南', guangxi: '华南', hainan: '华南',
  hongkong: '港澳台', macao: '港澳台', taiwan: '港澳台',
  chongqing: '西南', sichuan: '西南', guizhou: '西南', yunnan: '西南', tibet: '西南',
  shanxi_sx: '西北', gansu: '西北', qinghai: '西北', ningxia: '西北', xinjiang: '西北',
  overseas: '海外',
};

function getRegion(province: string): string | null {
  return PROVINCE_REGION[province] ?? null;
}

// theirHome: 对方省份 key；myHome: 我的省份 key
// theirCity / myCity: 仅江苏用户填写，用于 prefer_same_city 市级匹配
function hometownPreferenceScore(
  pref: unknown,
  theirHome: string,
  myHome: string,
  theirCity?: string,
  myCity?: string,
): number {
  const sameProvince = myHome === theirHome;
  const regionMy = getRegion(myHome);
  const regionTheir = getRegion(theirHome);
  const sameRegion = regionMy !== null && regionMy === regionTheir;
  const sameCity = sameProvince && theirCity !== undefined && myCity !== undefined && theirCity === myCity;

  if (pref === 'prefer_same_city') {
    if (sameCity)                              return 1.00; // 同省同城
    if (sameProvince && theirCity && myCity)   return 0.55; // 同省不同城
    if (sameProvince)                          return 0.72; // 同省但无市级数据
    if (sameRegion)                            return 0.48;
    return 0.28;
  }
  if (pref === 'prefer_same_province') {
    if (sameProvince) return 1.00;
    if (sameRegion)   return 0.65;
    return 0.35;
  }
  if (pref === 'prefer_nearby') {
    if (sameProvince) return 1.00;
    if (sameRegion)   return 0.88;
    return 0.45;
  }
  return 0.75; // neutral
}

// ── 身高软分（每超出范围 1cm 扣 1/15 分，最低 0.10）────────────────────
function heightSoftScore(
  personHeight: number,
  prefRange: { min: number; max: number },
): number {
  const { min, max } = prefRange;
  if (personHeight >= min && personHeight <= max) return 1.0;
  const gap = personHeight < min ? min - personHeight : personHeight - max;
  return Math.max(0.10, 1 - gap / 15);
}

// ── 饮酒交叉分（频率 × 接受度 Likert）──────────────────────────────────
// freqValue: rarely(1) / occasionally(2) / sometimes(3) / frequently(4)
// prefValue: Likert 1-7（1=只能接受基本不喝, 7=完全无所谓）
const DRINK_FREQ_LEVEL: Record<string, number> = {
  rarely: 1, occasionally: 2, sometimes: 3, frequently: 4,
};

function drinkCrossScore(freqValue: string, prefValue: number): number {
  const level = DRINK_FREQ_LEVEL[freqValue] ?? 2;
  // pref 映射到可接受最高频率等级 [1,7] → [1,4]
  const maxAccepted = 1 + (prefValue - 1) * (3 / 6);
  const excess = Math.max(0, level - maxAccepted);
  return Math.max(0.20, 1 - excess * 0.35);
}

export interface CompatibilityResult {
  score: number;
  dimensions: Record<string, number>;
  sharedInterests: string[];
  insights: {
    sameCampus?: boolean;
    sameDepartment?: boolean;
    sameHometown?: boolean;
    mbtiMatch?: boolean;
    scheduleMatch?: boolean;
  };
}

const crossPairSelfSet = new Set(CATEGORICAL_CROSS_PAIRS.map(([self]) => self));

function spendModeImportanceWeight(aAnswers: Answers, bAnswers: Answers): number {
  const values = [aAnswers.q_spend_mode_imp?.value, bAnswers.q_spend_mode_imp?.value]
    .filter((value): value is number => typeof value === 'number');
  if (values.length === 0) return 1;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return 0.6 + ((Math.max(1, Math.min(7, avg)) - 1) / 6) * 0.8;
}

export function calculateCompatibility(
  aAnswers: Answers,
  bAnswers: Answers,
  context?: CompatibilityContext,
): CompatibilityResult {
  const dimensionScores: Record<string, number> = {};
  const intention = context?.intention ?? 'partner';
  const dimWeights = intention === 'friend' ? FRIEND_DIMENSION_WEIGHTS : DIMENSION_WEIGHTS;
  const cw = COMPONENT_WEIGHTS[intention];

  let weightedSum = 0;
  let totalWeight = 0;

  // ── 预计算加权 boost 因子 ────────────────────────────────────────────
  const aCore = aAnswers[Q.CORE_DIMENSION]?.value as string | undefined;
  const bCore = bAnswers[Q.CORE_DIMENSION]?.value as string | undefined;
  const aMustAlign = aAnswers[Q.MUST_MATCH]?.value as string | undefined;
  const bMustAlign = bAnswers[Q.MUST_MATCH]?.value as string | undefined;

  // 双方 must_align 一致时 → 对应维度额外 ×1.3
  const mustAlignDim =
    aMustAlign && bMustAlign && aMustAlign === bMustAlign
      ? (MUST_ALIGN_TO_DIMENSION[aMustAlign] ?? null)
      : null;

  function getDimWeight(dim: string): number {
    let w = dimWeights[dim] ?? 1;
    if (aCore === dim || bCore === dim) w *= 1.5;
    if (mustAlignDim === dim) w *= 1.3;
    return w;
  }

  // ── Likert 维度（双向加权均值）───────────────────────────────────────
  for (const [dim, qIds] of Object.entries(DIMENSIONS)) {
    const aToBScore = oneWayLikertCompat(aAnswers, bAnswers, qIds);
    const bToAScore = oneWayLikertCompat(bAnswers, aAnswers, qIds);
    const biScore = (aToBScore + bToAScore) / 2;
    dimensionScores[dim] = Math.round(biScore * 100) / 100;

    const w = getDimWeight(dim);
    weightedSum += biScore * w;
    totalWeight += w;
  }

  // ── Likert 交叉对：我的自描述 ↔ 对方期望（双向）─────────────────────
  // e.g. A 的恋爱经历段数 vs B 期望的对象经历段数
  for (const [selfQ, prefQ] of LIKERT_CROSS_PAIRS) {
    const aSelf = aAnswers[selfQ];
    const bPref = bAnswers[prefQ];
    const bSelf = bAnswers[selfQ];
    const aPref = aAnswers[prefQ];
    if (
      aSelf && bPref && typeof aSelf.value === 'number' && typeof bPref.value === 'number' &&
      bSelf && aPref && typeof bSelf.value === 'number' && typeof aPref.value === 'number'
    ) {
      const aToBScore = 1 - Math.abs(aSelf.value - bPref.value) / 6;
      const bToAScore = 1 - Math.abs(bSelf.value - aPref.value) / 6;
      const crossScore = (aToBScore + bToAScore) / 2;
      // 权重以双方 importance 均值为基础，上限 1.2
      const impWeight = Math.min(1.2, ((bPref.importance ?? 1) + (aPref.importance ?? 1)) / 2);
      const pairWeight = impWeight * 0.65;
      weightedSum += crossScore * pairWeight;
      totalWeight += pairWeight;
    }
  }

  // ── Multi-select（Jaccard + Overlap 混合）────────────────────────────
  let multiSelectScore = 0;
  let multiSelectCount = 0;
  for (const qId of MULTI_SELECT_QUESTIONS) {
    const a = aAnswers[qId];
    const b = bAnswers[qId];
    if (a && b && Array.isArray(a.value) && Array.isArray(b.value)) {
      multiSelectScore += blendedMultiSelectSimilarity(a.value as string[], b.value as string[]);
      multiSelectCount++;
    }
  }
  if (multiSelectCount > 0) {
    multiSelectScore /= multiSelectCount;
    // must_align = interests_shared 时额外提升兴趣权重
    const multiW = mustAlignDim === '__interests' ? cw.multiSelect * 1.3 : cw.multiSelect;
    weightedSum += multiSelectScore * multiW;
    totalWeight += multiW;
  }

  // ── Ranking（Spearman 相关）──────────────────────────────────────────
  let rankingScore = 0;
  let rankingCount = 0;
  for (const qId of RANKING_QUESTIONS) {
    const a = aAnswers[qId];
    const b = bAnswers[qId];
    if (a && b && Array.isArray(a.value) && Array.isArray(b.value)) {
      rankingScore += spearmanCorrelation(a.value as string[], b.value as string[]);
      rankingCount++;
    }
  }
  if (rankingCount > 0) {
    rankingScore /= rankingCount;
    weightedSum += rankingScore * cw.ranking;
    totalWeight += cw.ranking;
  }

  // ── Cross-Multi-Select（我的品质 ↔ 对方期望）────────────────────────
  for (const [selfQ, prefQ] of CROSS_MULTI_SELECT_PAIRS) {
    const aSelf = aAnswers[selfQ];
    const bPref = bAnswers[prefQ];
    const bSelf = bAnswers[selfQ];
    const aPref = aAnswers[prefQ];
    if (
      aSelf && bPref && Array.isArray(aSelf.value) && Array.isArray(bPref.value) &&
      bSelf && aPref && Array.isArray(bSelf.value) && Array.isArray(aPref.value)
    ) {
      const aToBScore = blendedMultiSelectSimilarity(aSelf.value as string[], bPref.value as string[]);
      const bToAScore = blendedMultiSelectSimilarity(bSelf.value as string[], aPref.value as string[]);
      const crossScore = (aToBScore + bToAScore) / 2;
      const crossWeight = cw.multiSelect * 0.8;
      weightedSum += crossScore * crossWeight;
      totalWeight += crossWeight;
    }
  }

  // ── Categorical matching ──────────────────────────────────────────────
  let categoricalWeightedSum = 0;
  let categoricalWeightTotal = 0;

  for (const qId of CATEGORICAL_QUESTIONS) {
    if (crossPairSelfSet.has(qId)) continue; // cross-pairs 单独处理

    const a = aAnswers[qId];
    const b = bAnswers[qId];
    if (!a || !b) continue;
    if (typeof a.value !== 'string' || typeof b.value !== 'string') continue;
    const itemWeight = qId === 'q32' ? spendModeImportanceWeight(aAnswers, bAnswers) : 1;
    categoricalWeightedSum += categoricalSimilarity(a.value, b.value, qId) * itemWeight;
    categoricalWeightTotal += itemWeight;
  }

  // Cross-pairs：A 的自我描述 vs B 的期望，双向
  for (const [selfQ, prefQ] of CATEGORICAL_CROSS_PAIRS) {
    const aExpect = aAnswers[prefQ];
    const bActual = bAnswers[selfQ];
    const bExpect = bAnswers[prefQ];
    const aActual = aAnswers[selfQ];

    if (
      aExpect && bActual && typeof aExpect.value === 'string' && typeof bActual.value === 'string' &&
      bExpect && aActual && typeof bExpect.value === 'string' && typeof aActual.value === 'string'
    ) {
      const aToBScore = categoricalSimilarity(aExpect.value, bActual.value, prefQ);
      const bToAScore = categoricalSimilarity(bExpect.value, aActual.value, prefQ);
      categoricalWeightedSum += (aToBScore + bToAScore) / 2;
      categoricalWeightTotal += 1;
    }
  }

  if (categoricalWeightTotal > 0) {
    const categoricalScore = categoricalWeightedSum / categoricalWeightTotal;
    weightedSum += categoricalScore * cw.categorical;
    totalWeight += cw.categorical;
  }

  // ── MBTI 偏好 ─────────────────────────────────────────────────────────
  {
    const mbtiA = context?.aMbti;
    const mbtiB = context?.bMbti;
    const aPrefs = aAnswers[Q.MBTI_PREF]?.value as string[] | undefined;
    const bPrefs = bAnswers[Q.MBTI_PREF]?.value as string[] | undefined;
    const aAny = !aPrefs || aPrefs.length === 0 || aPrefs.includes('any_mbti');
    const bAny = !bPrefs || bPrefs.length === 0 || bPrefs.includes('any_mbti');

    // any_mbti → 0.75（包容 = 正向信号），未命中 → 0.45（不完美但不灾难）
    const aToBScore = aAny
      ? 0.75
      : mbtiB && aPrefs!.some((p) => p.toUpperCase() === mbtiB.toUpperCase()) ? 1.0 : 0.45;
    const bToAScore = bAny
      ? 0.75
      : mbtiA && bPrefs!.some((p) => p.toUpperCase() === mbtiA.toUpperCase()) ? 1.0 : 0.45;

    const mbtiScore = (aToBScore + bToAScore) / 2;
    const mbtiWeight = aAny && bAny ? cw.mbti.passive : cw.mbti.active;
    weightedSum += mbtiScore * mbtiWeight;
    totalWeight += mbtiWeight;
  }

  // ── 学院偏好 ──────────────────────────────────────────────────────────
  const aDept = context?.aDepartment;
  const bDept = context?.bDepartment;
  if (aDept && bDept) {
    const sameMajor = aDept === bDept;
    const aMajorScore = majorPreferenceScore(aAnswers[Q.MAJOR_PREF]?.value, sameMajor);
    const bMajorScore = majorPreferenceScore(bAnswers[Q.MAJOR_PREF]?.value, sameMajor);
    weightedSum += ((aMajorScore + bMajorScore) / 2) * cw.major;
    totalWeight += cw.major;
  }

  // ── 校区偏好 ──────────────────────────────────────────────────────────
  const aCampus = normalizeCampus(context?.aCampus);
  const bCampus = normalizeCampus(context?.bCampus);
  if (typeof aCampus === 'string' && typeof bCampus === 'string') {
    const sameCampus = aCampus === bCampus;
    const aSelectedCampuses = aAnswers[Q.CAMPUS_SELECT]?.value as string[] | undefined;
    const bSelectedCampuses = bAnswers[Q.CAMPUS_SELECT]?.value as string[] | undefined;
    // A 的偏好 vs B 的实际校区；B 的偏好 vs A 的实际校区
    const aCampusScore = campusPreferenceScore(aAnswers[Q.CROSS_CAMPUS]?.value, sameCampus, bCampus, aSelectedCampuses);
    const bCampusScore = campusPreferenceScore(bAnswers[Q.CROSS_CAMPUS]?.value, sameCampus, aCampus, bSelectedCampuses);
    weightedSum += ((aCampusScore + bCampusScore) / 2) * cw.campus;
    totalWeight += cw.campus;
  }

  // ── 家乡偏好 ──────────────────────────────────────────────────────────
  const aHome = aAnswers[Q.HOMETOWN]?.value;
  const bHome = bAnswers[Q.HOMETOWN]?.value;
  if (typeof aHome === 'string' && typeof bHome === 'string') {
    // 江苏省内城市（prefer_same_city 时精确到市级）
    const aJSCity = aAnswers[Q.JIANGSU_CITY]?.value as string | undefined;
    const bJSCity = bAnswers[Q.JIANGSU_CITY]?.value as string | undefined;
    // A 的偏好 vs B 的家乡/城市，B 的偏好 vs A 的家乡/城市
    const aHomeScore = hometownPreferenceScore(aAnswers[Q.HOMETOWN_PREF]?.value, bHome, aHome, bJSCity, aJSCity);
    const bHomeScore = hometownPreferenceScore(bAnswers[Q.HOMETOWN_PREF]?.value, aHome, bHome, aJSCity, bJSCity);
    weightedSum += ((aHomeScore + bHomeScore) / 2) * cw.hometown;
    totalWeight += cw.hometown;
  }

  // ── 身高软分（可选；仅在有身高+偏好数据时参与）────────────────────────
  {
    const aHeight = aAnswers[Q.HEIGHT]?.value;
    const bHeight = bAnswers[Q.HEIGHT]?.value;
    const aHeightRange = aAnswers[Q.HEIGHT_RANGE]?.value as unknown as { min: number; max: number } | undefined;
    const bHeightRange = bAnswers[Q.HEIGHT_RANGE]?.value as unknown as { min: number; max: number } | undefined;

    const heightScores: number[] = [];
    if (typeof aHeight === 'number' && bHeightRange) {
      heightScores.push(heightSoftScore(aHeight, bHeightRange));
    }
    if (typeof bHeight === 'number' && aHeightRange) {
      heightScores.push(heightSoftScore(bHeight, aHeightRange));
    }
    if (heightScores.length > 0) {
      const avgH = heightScores.reduce((s, v) => s + v, 0) / heightScores.length;
      weightedSum += avgH * 0.55;
      totalWeight += 0.55;
    }
  }

  // ── 饮酒交叉匹配（频率 × 接受度）────────────────────────────────────
  {
    const aFreq = aAnswers[Q.DRINK_FREQ]?.value as string | undefined;
    const bFreq = bAnswers[Q.DRINK_FREQ]?.value as string | undefined;
    const aDrinkPref = aAnswers[Q.DRINK_PREF]?.value;
    const bDrinkPref = bAnswers[Q.DRINK_PREF]?.value;
    if (
      aFreq && bFreq &&
      typeof aDrinkPref === 'number' && typeof bDrinkPref === 'number'
    ) {
      // A 的频率 vs B 的接受度，B 的频率 vs A 的接受度
      const aToBCross = drinkCrossScore(aFreq, bDrinkPref);
      const bToACross = drinkCrossScore(bFreq, aDrinkPref);
      weightedSum += ((aToBCross + bToACross) / 2) * 0.55;
      totalWeight += 0.55;
    }
  }

  // ── 共同兴趣（含子兴趣细化）─────────────────────────────────────────
  const aInterests = aAnswers[Q.INTERESTS]?.value;
  const bInterests = bAnswers[Q.INTERESTS]?.value;
  const sharedInterests: string[] = [];
  if (Array.isArray(aInterests) && Array.isArray(bInterests)) {
    const bSet = new Set(bInterests as string[]);
    for (const item of aInterests as string[]) {
      if (!bSet.has(item)) continue;
      const subKeys = INTEREST_SUB_KEY[item];
      if (subKeys && subKeys.length > 0) {
        const allSubShared: string[] = [];
        for (const subKey of subKeys) {
          const aSub = aAnswers[subKey]?.value;
          const bSub = bAnswers[subKey]?.value;
          if (Array.isArray(aSub) && Array.isArray(bSub) && aSub.length > 0 && bSub.length > 0) {
            const bSubSet = new Set(bSub as string[]);
            const subShared = (aSub as string[]).filter((s) => bSubSet.has(s));
            allSubShared.push(...subShared);
          }
        }
        if (allSubShared.length > 0) {
          sharedInterests.push(...allSubShared);
          continue;
        }
      }
      sharedInterests.push(item);
    }
  }

  // ── 作息匹配 insight ──────────────────────────────────────────────────
  const aSchedule = aAnswers[Q.SCHEDULE]?.value;
  const bSchedule = bAnswers[Q.SCHEDULE]?.value;
  const scheduleMatch =
    typeof aSchedule === 'string' && typeof bSchedule === 'string'
      ? aSchedule === bSchedule
      : undefined;

  // ── 最终得分（加权均值 + 60% 底线）─────────────────────────────────
  const rawScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
  const finalScore = Math.max(MIN_SCORE, Math.round(rawScore * 100) / 100);

  return {
    score: finalScore,
    dimensions: dimensionScores,
    sharedInterests,
    insights: {
      sameCampus: aCampus && bCampus ? aCampus === bCampus : undefined,
      sameDepartment: aDept && bDept ? aDept === bDept : undefined,
      sameHometown: typeof aHome === 'string' && typeof bHome === 'string' ? aHome === bHome : undefined,
      mbtiMatch: context?.aMbti && context?.bMbti ? context.aMbti === context.bMbti : undefined,
      scheduleMatch,
    },
  };
}
