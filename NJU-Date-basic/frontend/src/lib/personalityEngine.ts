// ============================================================
// NJU Match SBTI Personality Engine
// Implements spec: nju_match_sbti_algorithm_spec_v2
// ============================================================

import {
  FeatureVector,
  PersonalityResult,
  PersonalityType,
  PROTOTYPES,
  PERSONALITY_WEIGHTS,
  MAIN_TYPES,
} from './personalityConfig';

export type RawAnswers = Record<string, number | string | string[]>;
type MainPersonalityType = typeof MAIN_TYPES[number];

export interface PersonalityCalibration {
  typeBias: Partial<Record<MainPersonalityType, number>>;
  slothThreshold: number;
  fallbackTop1: number;
  fallbackMargin: number;
  fallbackMarginTop1: number;
  fallbackFeatureStd: number;
}

export const DEFAULT_CALIBRATION: PersonalityCalibration = {
  typeBias: {
    'hot-nerd': 14.5,
    'brain-bae': 4.2,
    'lab-cutie': 6.6,
    'quiz-crush': 10.9,
    'campus-fox': 0.3,
    'book-charm': 16,
    'art-kid': 12.1,
    'soft-spirit': 3,
    'hidden-boss': 14.5,
    'deadline-dancer': 1.1,
    'office-hour-angel': 7,
  },
  slothThreshold: 58,
  fallbackTop1: 54.6,
  fallbackMargin: 3.03,
  fallbackMarginTop1: 70.6,
  fallbackFeatureStd: 11.1,
};

/**
 * Survey API returns answers wrapped as { value: X, importance?: N }.
 * The engine expects flat values { qId: X }.
 * This function unwraps both formats transparently.
 */
export function unwrapAnswers(raw: Record<string, any>): RawAnswers {
  const out: RawAnswers = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v !== null && typeof v === 'object' && !Array.isArray(v) && 'value' in v) {
      out[k] = v.value;
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ── Utility ───────────────────────────────────────────────

/** Normalize a Likert 1-7 value to [0, 100] */
function norm(val: number | undefined): number {
  if (val === undefined || val === null) return 50;
  return ((val - 1) / 6) * 100;
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}

function avg(arr: number[]): number {
  if (!arr.length) return 50;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr: number[]): number {
  if (arr.length <= 1) return 0;
  const mean = avg(arr);
  const variance = avg(arr.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function has(arr: string[] | undefined, val: string): boolean {
  return (arr ?? []).includes(val);
}

function hasAny(arr: string[] | undefined, vals: string[]): boolean {
  return (arr ?? []).some(v => vals.includes(v));
}

// ── Feature extraction (spec §六) ────────────────────────

export function extractFeatures(a: RawAnswers): FeatureVector {
  // Raw answers
  const workStyle   = norm(a.q_work_style as number);
  const q38Score    = norm(a.q38          as number);
  const scheduleImp = norm(a.q_schedule_imp as number);
  const q21Score    = norm(a.q21          as number);
  const q26Score    = norm(a.q26          as number);
  const q27Score    = norm(a.q27          as number);
  const q25Score    = norm(a.q25          as number);
  const q33Score    = norm(a.q33          as number);
  const q41Score    = norm(a.q41          as number);
  const q37Score    = norm(a.q37           as number);
  const q30Score    = norm(a.q30           as number);
  const replyPref   = norm(a.q_reply_pref  as number);

  const atmosphere  = (a.q_atmosphere   as string) ?? '';
  const supportPref = (a.q_support_pref as string) ?? '';
  const replySpeed  = (a.q_reply_speed  as string) ?? '';
  const conflictSelf = (a.q_conflict_self as string) ?? '';
  const trStyle     = (a.q_tr_style     as string) ?? '';
  const sleep       = (a.q15            as string) ?? '';
  const spendStyle  = (a.q_spend_style  as string) ?? '';
  const weekendDate = (a.q_weekend_date as string) ?? '';

  const interests    = (a.q8               as string[]) ?? [];
  const selfQ        = (a.q29              as string[]) ?? [];
  const partnerQ     = (a.q_partner_qualities as string[]) ?? [];
  const dateContent  = (a.q_date_content   as string[]) ?? [];
  const readType     = (a.q_read_type      as string[]) ?? [];
  const freeTime     = (a.q_free_time      as string[]) ?? [];

  // ── Axis A: drive ────────────────────────────────────────
  const ambitionSelf     = has(selfQ, 'ambition')       ? 100 : 0;
  const selfDiscipline   = has(selfQ, 'self_discipline') ? 100 : 0;
  const partnerAmbition  = has(partnerQ, 'ambition')    ? 100 : 0;
  // q30: 物质 > 精神 → pragmatic/materialistic → drive up; low = aesthetic/warmth
  const materialDrive = 100 - q30Score; // high material pref → high pragmatic drive

  const drive = clamp(
    0.28 * workStyle
    + 0.18 * q21Score
    + 0.15 * ambitionSelf
    + 0.13 * selfDiscipline
    + 0.12 * materialDrive
    + 0.08 * q26Score
    + 0.06 * partnerAmbition,
  );

  // ── Axis B: structure ─────────────────────────────────────
  const trStyleScore = trStyle === 'detailed_plan' ? 100 : trStyle === 'rough_plan' ? 60 : trStyle === 'totally_random' ? 0 : 50;
  const sleepScore   = sleep === 'early_sleep_early_rise' ? 100 : sleep === 'early_sleep_late_rise' ? 60 : sleep === 'late_sleep_early_rise' ? 50 : 25;

  const structure = clamp(
    0.35 * q38Score
    + 0.22 * trStyleScore
    + 0.18 * scheduleImp
    + 0.13 * sleepScore
    + 0.12 * q37Score,  // q37: 洁癖/整洁度 → order preference → structure
  );

  // ── Axis C: social_energy ─────────────────────────────────
  const atmosphereSocial: Record<string, number> = { lively_talkative: 100, mix_talk_quiet: 60, quiet_comfy: 20, depends_mood: 50 };
  const replySpeedSocial: Record<string, number> = { very_fast: 80, normal: 55, slow: 25, depends_mood: 50 };
  const socialDateItems = ['eat_explore', 'walk_citywalk', 'gaming', 'just_chat', 'live_concert', 'sports'];
  const dateSocialScore = dateContent.length
    ? dateContent.filter(d => socialDateItems.includes(d)).length / dateContent.length * 100
    : 50;
  // q_free_time: evening/weekend availability → social engagement signal
  const freeTimeEvenings = ['weekday_night', 'sat_day', 'sat_night', 'sun_day', 'sun_night'];
  const freeTimeSocial = freeTime.length
    ? Math.min(100, freeTime.filter(t => freeTimeEvenings.includes(t)).length * 25)
    : 50;

  const social_energy = clamp(
    0.39 * (atmosphereSocial[atmosphere] ?? 50)
    + 0.27 * (replySpeedSocial[replySpeed] ?? 50)
    + 0.20 * freeTimeSocial
    + 0.14 * dateSocialScore,
  );

  // ── Axis D: warmth ────────────────────────────────────────
  const supportWarmth: Record<string, number> = { emotional_support: 90, both: 70, depends: 50, analyze_problem: 20 };
  const kindnessSelf   = has(selfQ, 'kindness')    ? 80 : has(selfQ, 'honesty') ? 55 : 25;
  const friendshipSelf = has(selfQ, 'friendship')  ? 80 : has(partnerQ, 'kindness') ? 60 : 30;

  const warmth = clamp(
    0.30 * (supportWarmth[supportPref] ?? 50)
    + 0.25 * q25Score
    + 0.20 * q27Score
    + 0.15 * kindnessSelf
    + 0.10 * friendshipSelf,
  );

  // ── Axis E: analytical ────────────────────────────────────
  const supportAnalysis: Record<string, number> = { analyze_problem: 100, both: 60, depends: 50, emotional_support: 10 };
  const geekInterests = ['programming_geek', 'finance_business', 'reading_writing'];
  const geekScore = interests.length ? interests.filter(i => geekInterests.includes(i)).length / interests.length * 100 : 20;
  const sciReadScore = has(interests, 'programming_geek') ? 100 : has(interests, 'reading_writing') ? 70 : has(interests, 'finance_business') ? 60 : 20;

  const curiosityScore = (has(selfQ, 'curiosity') ? 60 : 0) + (has(selfQ, 'independence') ? 20 : 0) + (has(selfQ, 'creativity') ? 20 : 0);

  // Boost from analytical reading types
  const readTypeBoost = readType.length
    ? readType.filter(r => ['science_tech', 'philosophy_social', 'history_bio', 'business_econ'].includes(r)).length * 15
    : 0;

  const analytical = clamp(
    0.35 * q33Score
    + 0.20 * (supportAnalysis[supportPref] ?? 50)
    + 0.20 * Math.min(100, curiosityScore)
    + 0.15 * geekScore
    + 0.10 * sciReadScore
    + readTypeBoost * 0.1,
  );

  // ── Axis F: reserved ──────────────────────────────────────
  const atmosphereReserved: Record<string, number> = { quiet_comfy: 80, mix_talk_quiet: 40, depends_mood: 40, lively_talkative: 0 };
  const slowReply = replySpeed === 'slow' ? 100 : replySpeed === 'depends_mood' ? 60 : replySpeed === 'normal' ? 30 : 0;
  const indepSpaceScore = (has(selfQ, 'independence') ? 60 : 0) + (has(selfQ, 'freedom') ? 40 : 0);

  const reserved = clamp(
    0.40 * q41Score
    + 0.27 * (atmosphereReserved[atmosphere] ?? 40)
    + 0.20 * slowReply
    + 0.13 * Math.min(100, indepSpaceScore),
  );

  // ── Axis G: freeflow ──────────────────────────────────────
  const trStyleFree: Record<string, number> = { totally_random: 100, rough_plan: 50, detailed_plan: 0 };
  const moodScore = atmosphere === 'depends_mood' ? 80 : replySpeed === 'depends_mood' ? 50 : 30;
  // q_spend_style: experience → freeflow; material → pragmatic/structured
  const spendFree: Record<string, number> = { experience: 80, balanced: 50, material: 20 };

  const freeflow = clamp(
    0.34 * (100 - q38Score)
    + 0.29 * (trStyleFree[trStyle] ?? 50)
    + 0.20 * (spendFree[spendStyle] ?? 50)
    + 0.17 * moodScore,
  );

  // ── Axis H: campus_play ───────────────────────────────────
  const campusInterests = ['boardgame_larp', 'food_exploring', 'travel_citywalk', 'gaming', 'live_show', 'ball_sports', 'anime_acg'];
  const socialInterestScore = interests.length ? interests.filter(i => campusInterests.includes(i)).length / interests.length * 100 : 30;
  const livelyAtmo = atmosphere === 'lively_talkative' ? 100 : atmosphere === 'mix_talk_quiet' ? 60 : atmosphere === 'depends_mood' ? 50 : 20;
  const fastReplyScore = replySpeed === 'very_fast' ? 100 : replySpeed === 'normal' ? 60 : 20;
  const outingDate = ['eat_explore', 'walk_citywalk', 'sports', 'gaming', 'exhibition_photo', 'live_concert', 'travel_nearby'];
  const outingScore = dateContent.length ? dateContent.filter(d => outingDate.includes(d)).length / dateContent.length * 100 : 40;

  // q_weekend_date: prefer_outside → campus active/explorative
  const weekendDateScore: Record<string, number> = { prefer_outside: 90, both_ok: 60, campus_fine: 30 };

  const campus_play = clamp(
    0.30 * socialInterestScore
    + 0.24 * livelyAtmo
    + 0.19 * (weekendDateScore[weekendDate] ?? 55)
    + 0.17 * fastReplyScore
    + 0.10 * outingScore,
  );

  // ── Axis I: attachment ────────────────────────────────────
  const jealousy = has(selfQ, 'loyalty') ? 65 : 50; // proxy

  const attachment = clamp(
    0.63 * replyPref
    + 0.37 * jealousy,
  );

  // ── Axis J: aesthetic ─────────────────────────────────────
  const aestheticInterests = ['movies_series', 'photo_exhibitions', 'reading_writing', 'fiction_fanfic', 'travel_citywalk', 'music_listening', 'live_show', 'anime_acg'];
  const aestheticInterestScore = interests.length ? interests.filter(i => aestheticInterests.includes(i)).length / interests.length * 100 : 30;
  const moviesMusicBooks = has(interests, 'photo_exhibitions') ? 100 : has(interests, 'movies_series') ? 75 : has(interests, 'music_listening') ? 70 : has(interests, 'reading_writing') ? 65 : 20;
  const exhibitionScore = has(interests, 'photo_exhibitions') ? 100 : 15;
  const citywalkScore = (has(interests, 'travel_citywalk') ? 50 : 0) + (has(dateContent, 'walk_citywalk') ? 30 : 0) + (has(dateContent, 'exhibition_photo') ? 30 : 0);
  const aestheticDate = (has(dateContent, 'exhibition_photo') ? 100 : 0) + (has(dateContent, 'walk_citywalk') ? 50 : 0) + (has(dateContent, 'movie_series') ? 30 : 0);

  // Boost from aesthetic reading types
  const litReadBoost = readType.length ? readType.filter(r => ['lit_fiction', 'poetry_essay', 'sci_fi_fantasy'].includes(r)).length * 20 : 0;

  const aesthetic = clamp(
    0.32 * aestheticInterestScore
    + 0.20 * moviesMusicBooks
    + 0.18 * exhibitionScore
    + 0.15 * Math.min(100, citywalkScore)
    + 0.10 * Math.min(100, aestheticDate)
    + litReadBoost * 0.05,
  );

  // ── Derived: focus_aura ─────────────────────────────────
  const focus_aura = clamp(
    0.35 * drive
    + 0.35 * analytical
    + 0.20 * structure
    + (atmosphere === 'quiet_comfy' || atmosphere === 'mix_talk_quiet' ? 8 : 0)
    - (replySpeed === 'depends_mood' ? 8 : 0),
  );

  // ── Derived: conversational_pull ─────────────────────────
  const conversational_pull = clamp(
    0.28 * analytical
    + 0.22 * social_energy
    + 0.15 * warmth
    + (atmosphere === 'lively_talkative' ? 15 : atmosphere === 'mix_talk_quiet' ? 8 : 0)
    + (supportPref === 'analyze_problem' || supportPref === 'both' ? 12 : 0)
    + (replySpeed === 'very_fast' ? 8 : 0)
    + (conflictSelf === 'talk_now' ? 8 : 0)
    + (has(selfQ, 'curiosity') ? 7 : 0)
    + (has(selfQ, 'creativity') ? 7 : 0),
  );

  // ── Derived: clutch_reliability ─────────────────────────
  const clutch_reliability = clamp(
    0.30 * drive
    + 0.28 * structure
    + 0.15 * analytical
    + (replySpeed === 'very_fast' ? 12 : replySpeed === 'normal' ? 6 : 0)
    + (supportPref === 'analyze_problem' || supportPref === 'both' ? 10 : 0)
    + (has(dateContent, 'study') ? 18 : 0),
  );

  return {
    drive, structure, social_energy, warmth, analytical,
    reserved, freeflow, campus_play, attachment, aesthetic,
    focus_aura, conversational_pull, clutch_reliability,
  };
}

// ── Base score: prototype distance formula (spec §八) ────

function baseScore(type: string, f: FeatureVector): number {
  const proto   = PROTOTYPES[type];
  const weights = PERSONALITY_WEIGHTS[type];
  if (!proto || !weights) return 0;

  const axes = ['drive', 'structure', 'social_energy', 'warmth', 'analytical', 'reserved', 'freeflow', 'campus_play', 'attachment', 'aesthetic'] as const;

  let distance = 0;
  for (const ax of axes) {
    const w = weights[ax] ?? 0.05;
    distance += w * Math.abs(f[ax] - proto[ax]);
  }
  return clamp(100 - distance * 1.22);
}

function toDisplayScore(rawScore: number, topRawScore: number): number {
  return Math.round(
    clamp(45 + (rawScore - 50) * 0.9 - (topRawScore - rawScore) * 0.85),
  );
}

function toDisplayConfidence(topRawScore: number, secondRawScore: number): number {
  const topDisplay = toDisplayScore(topRawScore, topRawScore);
  const margin = topRawScore - secondRawScore;
  const marginPenalty = Math.max(0, 8 - margin) * 1.5;
  const marginBoost = Math.min(6, Math.max(0, margin - 10) * 0.3);

  return clamp(topDisplay - marginPenalty + marginBoost) / 100;
}

// ── Bonus scores per personality ─────────────────────────

function bonus(type: string, f: FeatureVector, a: RawAnswers): number {
  const selfQ = (a.q29 as string[]) ?? [];
  const { drive, structure, social_energy, warmth, analytical, reserved, freeflow, campus_play, attachment, aesthetic, focus_aura, conversational_pull, clutch_reliability } = f;
  const excessive = (val: number, threshold: number) => Math.max(0, val - threshold);
  const inverse = (val: number) => 100 - val;
  const creativityProxy = 0.55 * (has(selfQ, 'creativity') ? 100 : 0) + 0.45 * aesthetic;

  switch (type) {
    case 'hot-nerd':
      return clamp(
        0.55 * focus_aura + 0.15 * analytical + 0.10 * structure
        - excessive(freeflow, 60) * 0.10 - excessive(campus_play, 50) * 0.10,
      ) * 0.30;

    case 'brain-bae':
      return clamp(
        0.26 * conversational_pull
        + 0.20 * analytical
        + 0.16 * warmth
        + 0.14 * social_energy
        + 0.08 * aesthetic
        + 0.06 * campus_play
        + 0.05 * inverse(reserved)
        + 0.05 * attachment
        + (analytical > 70 && social_energy > 62 ? 5 : 0)
        - (analytical < 62 ? 7 : 0)
        - (conversational_pull < 60 ? 6 : 0)
        - (warmth < 38 ? 6 : 0),
      ) * 0.24;

    case 'lab-cutie':
      return clamp(
        0.24 * reserved
        + 0.18 * inverse(social_energy)
        + 0.16 * structure
        + 0.12 * aesthetic
        + 0.10 * focus_aura
        + 0.08 * warmth
        + 0.06 * inverse(campus_play)
        + 0.06 * inverse(freeflow)
        + (reserved > 72 && social_energy < 42 ? 6 : 0)
        - (campus_play > 72 ? 5 : 0),
      ) * 0.24;

    case 'quiz-crush':
      return clamp(
        0.50 * clutch_reliability + 0.15 * structure + 0.10 * drive
        - excessive(campus_play, 50) * 0.10 - excessive(freeflow, 50) * 0.10,
      ) * 0.28;

    case 'campus-fox':
      return clamp(
        0.24 * campus_play
        + 0.20 * social_energy
        + 0.14 * freeflow
        + 0.12 * warmth
        + 0.10 * conversational_pull
        + 0.08 * inverse(reserved)
        + 0.06 * aesthetic
        + 0.06 * attachment
        + (campus_play > 75 && social_energy > 65 ? 6 : 0)
        - (campus_play < 68 ? 8 : 0)
        - (freeflow < 50 ? 5 : 0)
        - (reserved > 72 ? 6 : 0),
      ) * 0.24;

    case 'book-charm':
      return clamp(
        0.24 * aesthetic
        + 0.18 * reserved
        + 0.14 * inverse(social_energy)
        + 0.14 * warmth
        + 0.10 * inverse(campus_play)
        + 0.10 * freeflow
        + 0.10 * inverse(attachment)
        + (aesthetic > 72 && reserved > 62 ? 5 : 0)
        - (social_energy > 78 ? 5 : 0),
      ) * 0.24;

    case 'art-kid':
      return clamp(
        0.26 * aesthetic
        + 0.18 * freeflow
        + 0.14 * creativityProxy
        + 0.12 * reserved
        + 0.10 * warmth
        + 0.08 * inverse(structure)
        + 0.06 * campus_play
        + 0.06 * analytical
        + (aesthetic > 75 && freeflow > 62 ? 7 : 0)
        - (structure > 80 && drive > 80 ? 5 : 0),
      ) * 0.24;

    case 'soft-spirit':
      return clamp(
        0.28 * warmth
        + 0.18 * attachment
        + 0.14 * social_energy
        + 0.12 * inverse(structure)
        + 0.10 * freeflow
        + 0.10 * inverse(analytical)
        + 0.08 * aesthetic
        + (warmth > 78 ? 7 : 0)
        - (warmth < 72 ? 8 : 0)
        - (campus_play > 65 ? 5 : 0)
        - (analytical > 82 && structure > 75 ? 5 : 0),
      ) * 0.24;

    case 'hidden-boss':
      return clamp(
        0.30 * focus_aura + 0.20 * clutch_reliability + 0.15 * reserved
        - excessive(social_energy, 50) * 0.15 - excessive(campus_play, 40) * 0.10,
      ) * 0.25;

    case 'deadline-dancer':
      return clamp(
        0.28 * freeflow
        + 0.18 * campus_play
        + 0.14 * social_energy
        + 0.12 * inverse(structure)
        + 0.10 * drive
        + 0.08 * aesthetic
        + 0.06 * inverse(reserved)
        + 0.04 * clutch_reliability
        + (freeflow > 76 && structure < 42 ? 8 : 0)
        - (drive < 25 && structure < 25 ? 5 : 0),
      ) * 0.24;

    case 'office-hour-angel':
      return clamp(
        0.24 * warmth
        + 0.22 * analytical
        + 0.16 * conversational_pull
        + 0.12 * structure
        + 0.10 * social_energy
        + 0.10 * attachment
        + 0.06 * inverse(freeflow)
        + (warmth > 68 && analytical > 68 ? 8 : 0)
        - (social_energy < 28 ? 4 : 0),
      ) * 0.24;

    default:
      return 0;
  }
}


// ── Easter egg detection (spec §七) ──────────────────────
// sloth-mode is the only super-hidden easter egg type.
// Triggers when the user has extremely low drive + high freeflow + high warmth.

function checkEasterEggs(
  f: FeatureVector,
  a: RawAnswers,
  calibration: PersonalityCalibration,
): { type: PersonalityType; score: number } | null {
  const supportPref = (a.q_support_pref as string) ?? '';
  const replySpeed = (a.q_reply_speed as string) ?? '';
  const atmosphere = (a.q_atmosphere as string) ?? '';

  const hardGate =
    f.warmth >= 60 &&
    f.reserved >= 42 &&
    f.social_energy <= 66 &&
    f.attachment <= 76 &&
    ['emotional_support', 'both', 'depends'].includes(supportPref) &&
    replySpeed !== 'very_fast' &&
    ['quiet_comfy', 'mix_talk_quiet', 'depends_mood'].includes(atmosphere);

  if (hardGate) {
    const slothScore = clamp(
      0.30 * f.warmth
      + 0.18 * f.reserved
      + 0.16 * (100 - f.social_energy)
      + 0.12 * f.freeflow
      + 0.10 * (100 - f.attachment)
      + 0.08 * f.aesthetic
      + 0.06 * (100 - f.structure),
    );
    if (slothScore >= calibration.slothThreshold) {
      return { type: 'sloth-mode', score: slothScore };
    }
  }
  return null;
}

// ── Main entry point ──────────────────────────────────────

export function computePersonality(
  answers: RawAnswers,
  calibration: PersonalityCalibration = DEFAULT_CALIBRATION,
): PersonalityResult {
  const features = extractFeatures(answers);

  // Score all 11 main personalities (you-know-who is fallback, sloth-mode is easter egg)
  const mainScores = MAIN_TYPES.map(type => ({
    type,
    score: clamp(
      baseScore(type, features)
      + bonus(type, features, answers)
      + (calibration.typeBias[type] ?? 0),
    ),
  })).sort((a, b) => b.score - a.score);

  // Check easter egg (sloth-mode only)
  const egg = checkEasterEggs(features, answers, calibration);

  let finalType: PersonalityType;
  let isEasterEgg = false;
  const top1 = mainScores[0]?.score ?? 0;
  const top2 = mainScores[1]?.score ?? 0;
  const margin = top1 - top2;
  const featureStd = std([
    features.drive,
    features.structure,
    features.social_energy,
    features.warmth,
    features.analytical,
    features.reserved,
    features.freeflow,
    features.campus_play,
    features.attachment,
    features.aesthetic,
  ]);

  if (egg) {
    finalType = egg.type as PersonalityType;
    isEasterEgg = true;
  } else {
    if (
      top1 < calibration.fallbackTop1 ||
      (margin < calibration.fallbackMargin && top1 < calibration.fallbackMarginTop1) ||
      featureStd < calibration.fallbackFeatureStd
    ) {
      finalType = 'you-know-who';
    } else {
      finalType = mainScores[0].type as PersonalityType;
    }
  }

  const confidence = toDisplayConfidence(top1, top2);
  const displayTop3 = mainScores
    .slice(0, 3)
    .map((item) => ({ type: item.type as PersonalityType, score: toDisplayScore(item.score, top1) }));

  return {
    finalType,
    isEasterEgg,
    confidence,
    top3: displayTop3,
    features,
    completedAt: new Date().toISOString(),
  };
}
