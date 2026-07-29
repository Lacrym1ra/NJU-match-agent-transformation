/**
 * NJU Match — 问卷 v3.0 题库存档
 *
 * 存档时间：2026-04-10
 * 对应 surveyService.ts SURVEY_VERSION = '3.0'
 * 最后一次活跃提交：9fea40c~1（v4.0 上线前）
 *
 * 说明：此文件仅供历史参考，不参与任何运行时逻辑。
 * 若需对比 v3 与 v4 的题目变更，参见 backend/src/services/surveyService.ts
 * 中的 CHANGED_QUESTION_IDS 列表（v4.0 版本）。
 */

// ─────────────────────────────────────────────────────────────────────────────
// 以下为 v3.0 原始 seed.ts 完整内容（只读存档）
// ─────────────────────────────────────────────────────────────────────────────

export interface BaseQuestion {
  id: string;
  section: string;
  text: string;
  hasImportance: boolean;
  dependsOn?: {
    questionId: string;
    value: string | string[];
  };
}

export interface LikertQuestion extends BaseQuestion {
  type: 'likert';
  scale: { min: 1; max: 7; minLabel: string; maxLabel: string };
  hasImportance: true;
}

export interface MultiSelectQuestion extends BaseQuestion {
  type: 'multi_select';
  options: string[];
  maxSelect: number;
  hasImportance: false;
}

export interface RankingQuestion extends BaseQuestion {
  type: 'ranking';
  options: string[];
  hasImportance: false;
}

export interface SingleSelectQuestion extends BaseQuestion {
  type: 'single_select';
  options: string[];
  hasImportance: false;
}

export interface OpenTextQuestion extends BaseQuestion {
  type: 'open_text';
  maxLength: number;
  hasImportance: false;
}

export interface NumberInputQuestion extends BaseQuestion {
  type: 'number_input';
  min: number;
  max: number;
  hasImportance: false;
}

export interface YearRangeQuestion extends BaseQuestion {
  type: 'year_range';
  min: number;
  max: number;
  hasImportance: false;
}

export type Question =
  | LikertQuestion
  | MultiSelectQuestion
  | RankingQuestion
  | SingleSelectQuestion
  | OpenTextQuestion
  | NumberInputQuestion
  | YearRangeQuestion;

const likert = (id: string, section: string, text: string): LikertQuestion => ({
  id,
  type: 'likert',
  section,
  text,
  scale: { min: 1, max: 7, minLabel: '完全不同意', maxLabel: '完全同意' },
  hasImportance: true,
});

const PROVINCE_OPTIONS = [
  'beijing', 'tianjin', 'hebei', 'shanxi', 'inner_mongolia',
  'liaoning', 'jilin', 'heilongjiang',
  'shanghai', 'jiangsu', 'zhejiang', 'anhui', 'fujian', 'jiangxi', 'shandong',
  'henan', 'hubei', 'hunan',
  'guangdong', 'guangxi', 'hainan',
  'chongqing', 'sichuan', 'guizhou', 'yunnan', 'tibet',
  'shanxi_sx', 'gansu', 'qinghai', 'ningxia', 'xinjiang',
  'hongkong', 'macao', 'taiwan', 'overseas',
];

const INTEREST_OPTIONS = [
  'cycling_fitness', 'ball_sports', 'running_hiking', 'swimming_dance',
  'movies_series', 'boardgame_larp', 'anime_acg', 'esports_games',
  'photo_exhibitions', 'reading_writing', 'food_exploring', 'travel_citywalk',
  'pets_cooking', 'live_show', 'music_listening', 'programming_geek', 'finance_business', 'novel_fanfiction', 'other_interest',
];

const QUALITY_OPTIONS = [
  'adventure', 'ambition', 'courage', 'creativity', 'curiosity', 'self_discipline',
  'fairness', 'faith', 'family', 'freedom', 'friendship', 'honesty', 'independence',
  'integrity', 'kindness', 'loyalty',
];

const BOOKS_OPTIONS = ['literature_fiction', 'sci_fi_fantasy', 'history_biography', 'philosophy_social', 'science_tech', 'business_econ', 'poetry_essay', 'comics_graphic', 'other_specify'];
const NOVEL_OPTIONS = ['romance', 'suspense_thriller', 'wuxia_xianxia', 'sci_fi', 'fantasy_magic', 'danmei_bl', 'baihe_gl', 'fanfiction', 'other_specify'];
const MUSIC_OPTIONS = ['c_pop', 'k_pop', 'j_pop', 'rock', 'hip_hop_rap', 'r_and_b', 'electronic_dance', 'classical', 'jazz_blues', 'folk_country', 'indie', 'acg_vocaloid', 'other_specify'];
const BALL_SPORTS_OPTIONS = ['badminton', 'basketball', 'table_tennis', 'tennis', 'football', 'volleyball', 'billiards', 'other_specify'];

export const QUESTION_BANK: Question[] = [
  // 第一部分：基础信息与硬筛条件 q1-q7
  { id: 'q1', type: 'number_input', section: 'basics', text: '我的出生年份：', min: 1991, max: 2008, hasImportance: false },
  { id: 'q2', type: 'year_range', section: 'basics', text: '我希望匹配对象的出生年份范围是：', min: 1991, max: 2008, hasImportance: false },
  { id: 'q3', type: 'single_select', section: 'basics', text: '我的家乡省份（地区）：', options: PROVINCE_OPTIONS, hasImportance: false },
  { id: 'q4', type: 'single_select', section: 'basics', text: '我希望我的匹配对象来自：', options: ['strict_same_hometown', 'prefer_same_hometown', 'specify_province', 'neutral'], hasImportance: false },
  { id: 'q_future_base', type: 'multi_select', section: 'basics', text: '我未来倾向发展的省份或地区：', options: PROVINCE_OPTIONS, maxSelect: 3, hasImportance: false },
  { id: 'q5', type: 'multi_select', section: 'basics', text: '我希望匹配对象的年级是（可多选）：', options: ['same_grade', 'lower_grade', 'higher_grade'], maxSelect: 3, hasImportance: false },
  { id: 'q6', type: 'single_select', section: 'basics', text: '我对跨校区恋爱的态度：', options: ['accept', 'reject', 'neutral'], hasImportance: false },
  { id: 'q7', type: 'single_select', section: 'basics', text: '我希望匹配对象的学院和我：', options: ['strict_same_major', 'prefer_same_major', 'strict_diff_major', 'prefer_diff_major', 'neutral'], hasImportance: false },
  { id: 'q61', type: 'multi_select', section: 'basics', text: '我希望匹配对象的 MBTI 类型是（限选 4 个，选"无所谓"则按官配优先）：', options: ['intj','intp','entj','entp','infj','infp','enfj','enfp','istj','isfj','estj','esfj','istp','isfp','estp','esfp','any_mbti'], maxSelect: 4, hasImportance: false },

  // 第二部分：生活习惯和兴趣爱好 q8-q19
  { id: 'q8', type: 'multi_select', section: 'lifestyle', text: '我的核心兴趣爱好（限选 4 项）：', options: INTEREST_OPTIONS, maxSelect: 4, hasImportance: false },
  { id: 'q8_1', type: 'multi_select', section: 'lifestyle', text: '最近喜欢看的书籍品类（选填）', options: BOOKS_OPTIONS, maxSelect: 4, hasImportance: false, dependsOn: { questionId: 'q8', value: 'reading_writing' } },
  { id: 'q8_2', type: 'multi_select', section: 'lifestyle', text: '偏好的小说类型（选填）', options: NOVEL_OPTIONS, maxSelect: 4, hasImportance: false, dependsOn: { questionId: 'q8', value: 'novel_fanfiction' } },
  { id: 'q8_3', type: 'multi_select', section: 'lifestyle', text: '钟爱的音乐风格（选填）', options: MUSIC_OPTIONS, maxSelect: 4, hasImportance: false, dependsOn: { questionId: 'q8', value: ['music_listening', 'live_show'] } },
  { id: 'q8_4', type: 'multi_select', section: 'lifestyle', text: '经常参与或喜欢的球类运动（选填）', options: BALL_SPORTS_OPTIONS, maxSelect: 4, hasImportance: false, dependsOn: { questionId: 'q8', value: 'ball_sports' } },
  { id: 'q9', type: 'single_select', section: 'lifestyle', text: '我有吸烟或抽电子烟的习惯。', options: ['yes', 'no'], hasImportance: false },
  likert('q10', 'lifestyle', '我完全无法接受伴侣有吸烟或抽电子烟的习惯。'),
  { id: 'q11', type: 'single_select', section: 'lifestyle', text: '我是个滴酒不沾的人。', options: ['yes', 'no'], hasImportance: false },
  { id: 'q12', type: 'single_select', section: 'lifestyle', text: '我希望我的伴侣滴酒不沾。', options: ['yes', 'no'], hasImportance: false },
  { id: 'q13', type: 'single_select', section: 'lifestyle', text: '我未来一定要养宠物（或已经有宠物）。', options: ['yes', 'no'], hasImportance: false },
  { id: 'q14', type: 'single_select', section: 'lifestyle', text: '我接受伴侣养宠物。', options: ['yes', 'no'], hasImportance: false },
  { id: 'q15', type: 'single_select', section: 'lifestyle', text: '我的作息习惯：', options: ['early_sleep_early_rise', 'early_sleep_late_rise', 'late_sleep_late_rise', 'late_sleep_early_rise', 'flexible'], hasImportance: false },
  { id: 'q16', type: 'single_select', section: 'lifestyle', text: '我希望对方的作息习惯：', options: ['early_sleep_early_rise', 'early_sleep_late_rise', 'late_sleep_late_rise', 'late_sleep_early_rise', 'flexible'], hasImportance: false },
  { id: 'q17', type: 'single_select', section: 'lifestyle', text: '我的家庭年收入情况（元）：', options: ['lt_100k', '100k_300k', '300k_500k', '500k_800k', '800k_1m', 'gt_1m', 'prefer_not_to_say'], hasImportance: false },
  likert('q18', 'lifestyle', '消费时，我更愿意把钱花在"体验"（旅游、演唱会）上，而不是购买"实体物品"。'),
  likert('q19', 'lifestyle', '我属于"无辣不欢"。'),

  // 第三部分：底层价值观 q20-q40
  likert('q20', 'values', '我的做事风格更接近"躺平"而不是"持续内卷"。'),
  likert('q21', 'values', '我希望伴侣是一个非常上进、目标导向的人。'),
  likert('q22', 'values', '我无法接受伴侣曾经有过多段感情经历。'),
  likert('q23', 'values', '我倾向于进入长期稳定且有承诺感的亲密关系。'),
  likert('q24', 'values', '我未来希望组建家庭并拥有孩子。'),
  likert('q25', 'values', '在关键利益面前，善良比聪明更重要。'),
  likert('q26', 'values', '我愿意为了理想与热爱，放弃一部分物质舒适。'),
  likert('q27', 'values', '相比事业优先，我更看重关系与生活幸福感。'),
  likert('q28', 'values', '我认为世界上 99% 的烦恼都可以用钱来解决。'),
  { id: 'q29', type: 'multi_select', section: 'values', text: '从以下选出你最看重的 4 个品质：', options: QUALITY_OPTIONS, maxSelect: 4, hasImportance: false },
  likert('q30', 'values', '物质财富的积累比精神上的共鸣更重要。'),
  likert('q31', 'values', '我认为两个人的家庭背景和阶层相近，在关系中非常重要。'),
  { id: 'q32', type: 'single_select', section: 'values', text: '我倾向的恋爱日常开销模式更接近：', options: ['aa', 'income_based', 'flexible'], hasImportance: false },
  likert('q33', 'values', '智商（聪明、有深度）比情商（会照顾人、提供情绪价值）更吸引我。'),
  likert('q34', 'values', '遇到困难时，我更倾向于自己扛着解决，而不是向伴侣求助。'),
  likert('q35', 'values', '周末约会我更倾向去校外或市中心，而不是待在校园。'),
  likert('q36', 'values', '恋爱中我希望保持较高频率的陪伴与黏性。'),
  likert('q37', 'values', '我对生活环境的整洁度要求极高（有轻微或严重洁癖）。'),
  likert('q38', 'values', '我习惯做详尽的计划，非常不喜欢"说走就走"的突然改变。'),
  likert('q39', 'values', '我有记账的习惯，对财务状况敏感且会存下很大一部分收入。'),
  likert('q40_self', 'values', '我有经常锻炼身体的习惯（每周至少 3 次）。'),
  likert('q40_partner', 'values', '我希望（或要求）我的伴侣也有经常锻炼身体的习惯。'),

  // 第四部分：情感风格与边界 q41-q60
  likert('q41', 'emotional', '即使在热恋期，我也每天需要一段绝对独处的时间来恢复能量。'),
  likert('q42', 'emotional', '吵架时，我倾向于立刻把话说清楚，绝对不能"冷战"或留到第二天。'),
  likert('q43', 'emotional', '我认为亲密伴侣之间不应该有任何秘密。'),
  likert('q44', 'emotional', '如果我觉得伴侣行为异常，我会要求查看对方的手机。'),
  likert('q45', 'emotional', '我需要伴侣每天都对我表达爱意（如说"我爱你"或夸奖我）。'),
  likert('q46', 'emotional', '我遇到挫折时，更希望伴侣帮我分析问题并提出解决方案，而不是仅仅提供情绪安抚。'),
  likert('q47', 'emotional', '我是一个占有欲很强、容易吃醋的人。'),
  likert('q48', 'emotional', '我不能接受伴侣对我占有欲很强。'),
  likert('q49', 'emotional', '我希望我的伴侣能完全融入我现有的朋友圈，经常一起活动。'),
  likert('q50', 'emotional', '我完全可以接受伴侣有非常亲密的异性"好哥们/好闺蜜"。'),
  likert('q51', 'emotional', '我希望伴侣接受我有非常亲密的异性"好哥们/好闺蜜"。'),
  likert('q52', 'emotional', '我认为在一段长期关系中，有一方处于稍微"主导"的地位是正常的。'),
  likert('q53', 'emotional', '当我生气时，我有时会选择沉默让对方去猜，而不是直接表达我不高兴的原因。'),
  likert('q54', 'emotional', '伴侣几小时不回消息会让我明显焦虑。'),
  likert('q55', 'emotional', '为了维持表面的和平与体面，对伴侣说一些善意的谎言是完全应该的。'),
  likert('q56', 'emotional', '我是一个极度好胜的人，哪怕是和伴侣玩桌游打游戏，我也必须赢。'),
  likert('q57', 'emotional', '我能够接受开放式关系（如双方知情同意下的非排他性关系）。'),
  likert('q58', 'emotional', '我和大部分前任都保持着友好的联系。'),
  { id: 'q59', type: 'ranking', section: 'emotional', text: '请将以下五种"爱的语言"按你感受爱的程度从高到低排序：', options: ['praise', 'quality_time', 'gift', 'acts_of_service', 'physical_touch'], hasImportance: false },
  { id: 'q60', type: 'single_select', section: 'emotional', text: '在以上所有维度中，你认为哪一项在匹配中最重要？', options: ['values', 'lifestyle', 'emotional'], hasImportance: false },
];

export const SECTIONS = [
  { id: 'basics',    title: '基础信息',   description: '硬性条件与基础偏好' },
  { id: 'lifestyle', title: '生活颗粒度', description: '日常节奏与习惯摩擦' },
  { id: 'values',    title: '核心价值观', description: '关系目标、资源观与长期选择' },
  { id: 'emotional', title: '情感风格',   description: '沟通、信任、边界与依恋模式' },
];

export const LIKERT_QUESTION_IDS = QUESTION_BANK
  .filter((q) => q.type === 'likert')
  .map((q) => q.id);

export const DEALBREAKER_QUESTION_IDS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q9', 'q10', 'q11', 'q12', 'q13', 'q14'];

export function getQuestionsBySection() {
  return SECTIONS.map((section) => ({
    ...section,
    questions: QUESTION_BANK.filter((q) => q.section === section.id),
  }));
}
