/**
 * 2026 survey schema mapping — v4.0
 * Single source of truth for question roles in the matching pipeline.
 *
 * Dimensions: lifestyle / communication / boundary / values
 * (6 UI sections in the questionnaire; basics/interests are scored
 *  via separate components, not Likert dimensions)
 */

export const Q = {
  // ── basics ──────────────────────────────────────
  BIRTH_YEAR: 'q1',
  HEIGHT: 'q_height',
  BIRTH_YEAR_RANGE: 'q2',
  HEIGHT_RANGE: 'q_height_range',
  MBTI_PREF: 'q61',
  GRADE_PREF: 'q5',
  MAJOR_PREF: 'q7',
  HOMETOWN: 'q3',
  HOMETOWN_PREF: 'q4',
  CROSS_CAMPUS: 'q6',

  // ── interests ───────────────────────────────────
  INTERESTS: 'q8',
  TOP_INTEREST: 'q_top_interest',
  DATE_CONTENT: 'q_date_content',
  WEEKEND_DATE: 'q_weekend_date',

  // ── lifestyle ───────────────────────────────────
  SMOKE: 'q9',
  SMOKE_PREF: 'q10',
  DRINK_FREQ: 'q_drink_freq',
  DRINK_PREF: 'q_drink_pref',
  PET_LIKE: 'q_pet_like',
  PET_PARTNER: 'q_pet_partner',
  SCHEDULE: 'q15',
  SCHEDULE_IMP: 'q_schedule_imp',
  FREE_TIME: 'q_free_time',
  SPEND_STYLE: 'q_spend_style',
  COST_MODE: 'q32',
  SPEND_IMP: 'q_spend_imp',
  CLEANLINESS: 'q37',
  PLAN_VS_SPONTANEOUS: 'q38',

  // ── communication (includes pacing) ───────────
  RELATIONSHIP_MODE: 'q_rel_mode',
  MY_PACE: 'q_my_pace',
  PARTNER_PACE: 'q_partner_pace',
  ATMOSPHERE: 'q_atmosphere',
  CONFLICT_SELF: 'q_conflict_self',
  CONFLICT_PARTNER: 'q_conflict_partner',
  SUPPORT_PREF: 'q_support_pref',
  REPLY_SPEED: 'q_reply_speed',
  REPLY_SPEED_PREF: 'q_reply_pref',
  ALONE_TIME: 'q41',
  TOGETHER_NEED: 'q36',
  AFFECTION_NEED: 'q_affection_need',
  PHYSICAL_TOUCH_PACE: 'q_physical_pace',
  LOVE_LANGUAGE: 'q59',

  // ── basics extras ───────────────────────────────
  JIANGSU_CITY: 'q_jiangsu_city',
  CAMPUS_SELECT: 'q6_campus_select',

  // ── boundary ────────────────────────────────────
  RELATIONSHIP_HISTORY: 'q_rel_history',
  HISTORY_IMP: 'q_history_imp',
  OPPOSITE_FRIEND: 'q50',
  CHECK_PHONE: 'q44',
  JEALOUSY_SELF: 'q47',
  JEALOUSY_ACCEPT: 'q48',
  FRIEND_CIRCLE: 'q49',
  KEEP_SPACE: 'q_keep_space',
  SPACE_INTEGRATION: 'q_space_integration',
  RED_FLAGS: 'q_red_flags',
  OPEN_RELATIONSHIP: 'q57',
  EX_CONTACT: 'q58',

  // ── values ──────────────────────────────────────
  PARTNER_DRIVEN: 'q21',
  WORK_STYLE: 'q_work_style',
  LIFE_OVER_CAREER: 'q27',
  FAMILY_DESTINY: 'q24',
  KINDNESS_VS_SMART: 'q25',
  IQ_VS_EQ: 'q33',
  IDEAL_VS_MATERIAL: 'q26',
  MONEY_SOLVES: 'q28',
  MATERIAL_VS_SPIRITUAL: 'q30',
  FUTURE_BASE: 'q_future_base',
  FUTURE_BASE_IMP: 'q_future_base_imp',
  GROWTH_ENV: 'q_growth_env',
  FAMILY_ECON: 'q_family_econ',
  FAMILY_BG_IMP: 'q31',
  MY_QUALITIES: 'q29',
  PARTNER_QUALITIES: 'q_partner_qualities',

  // ── summary ─────────────────────────────────────
  CORE_DIMENSION: 'q60',
  MUST_MATCH: 'q_must_align',
} as const;

// ── Dimension weights (partner intention) ─────────────────────────────

export const DIMENSION_WEIGHTS: Record<string, number> = {
  lifestyle: 1.5,
  communication: 1.8,
  boundary: 1.5,
  values: 1.0,
};

// ── Likert question mapping by dimension ──────────────────────────────

export const DIMENSIONS: Record<string, string[]> = {
  lifestyle: [
    'q10',                 // 吸烟接受度
    'q_drink_pref',        // 饮酒接受度
    'q_pet_like',          // 小动物喜欢程度
    'q_pet_partner',       // 希望对方喜欢小动物
    'q_schedule_imp',      // 作息一致重视程度
    'q_spend_imp',         // 消费观相近重要性
    'q37',                 // 洁癖程度
    'q38',                 // 计划vs随性
  ],
  communication: [
    'q_reply_pref',        // 消息回复速度期待
    'q41',                 // 独处时间需要
    'q36',                 // 高频陪伴需要
    'q_affection_need',    // 高频表达爱意需要
    'q_physical_pace',     // 身体接触节奏（Likert，从categorical移入）
  ],
  boundary: [
    'q_history_imp',       // 对方恋爱经历介意度（同时参与 LIKERT_CROSS_PAIRS 交叉匹配）
    'q50',                 // 异性好友接受度
    'q44',                 // 查看手机倾向
    'q47',                 // 占有欲/吃醋倾向
    'q48',                 // 对方占有欲接受度
    'q49',                 // 融入朋友圈程度
    'q_keep_space',        // 保留各自空间重视度
    'q57',                 // 开放式关系接受度
    'q58',                 // 前任联系程度
  ],
  values: [
    'q21',                 // 希望对方上进（同时参与 LIKERT_CROSS_PAIRS 与 q_work_style 交叉）
    'q_work_style',        // 我的做事风格（Likert，从categorical移入；与q21形成交叉对）
    'q27',                 // 关系>事业
    'q24',                 // 组建家庭意愿
    'q_future_base_imp',   // 发展地区一致重要性
    'q31',                 // 家庭背景相近重要性
    'q25',                 // 善良vs聪明
    'q33',                 // 智商vs情商
    'q26',                 // 理想vs物质
    'q28',                 // 金钱万能
    'q30',                 // 物质>精神
  ],
};

// ── Non-Likert question lists ─────────────────────────────────────────

export const MULTI_SELECT_QUESTIONS: string[] = [
  'q8',                  // 核心兴趣
  'q_date_content',      // 约会内容
  'q_free_time',         // 有空时间
  'q_partner_qualities', // 期望对方品质（self-to-self：双方对理想伴侣的期望是否相近）
  'q_future_base',       // 未来发展地区
  // ── 兴趣分支多选（仅在双方都有该兴趣时才有答案）─────────────────
  'q_gm_platform',       // 常玩游戏平台
  'q_bg_prio',           // 桌游/剧本杀优先考量
  'q_fd_prio',           // 约饭优先考量
];

/**
 * Cross-multi-select pairs: [selfQ, partnerPrefQ]
 * A 的自我描述 (selfQ) vs B 对伴侣的期望 (partnerPrefQ)，双向评分
 * q29: 我的品质 ↔ q_partner_qualities: 期望对方具备的品质
 */
export const CROSS_MULTI_SELECT_PAIRS: Array<[string, string]> = [
  ['q29', 'q_partner_qualities'],
];

export const RANKING_QUESTIONS: string[] = ['q59'];

/** Single-select questions scored via exact/fuzzy categorical matching */
export const CATEGORICAL_QUESTIONS: string[] = [
  // ── 相处沟通 ────────────────────────────────────────────────────
  'q_rel_mode',          // 恋爱模式（含互补逻辑：主动 ↔ 希望对方主动）
  'q_my_pace',           // 自己进入关系节奏（与 q_partner_pace cross-match）
  'q_partner_pace',      // 希望对方节奏
  'q_atmosphere',        // 相处氛围
  'q_conflict_self',     // 自己冲突方式（与 q_conflict_partner cross-match）
  'q_conflict_partner',  // 希望对方冲突方式
  'q_support_pref',      // 受挫支持偏好
  'q_reply_speed',       // 消息回复速度
  // ── 生活习惯 ────────────────────────────────────────────────────
  'q15',                 // 作息
  'q_spend_style',       // 消费风格
  'q32',                 // 开销模式
  'q_drink_freq',        // 饮酒频率（自我描述；配合 drink cross-match 使用）
  // ── 边界安全感 ──────────────────────────────────────────────────
  'q_space_integration', // 相处空间融合模式（partnerOnly）
  // ── 价值观 ──────────────────────────────────────────────────────
  'q_growth_env',        // 成长环境（城市级别）
  'q_family_econ',       // 家庭经济状况感受
  // ── 兴趣约会 ────────────────────────────────────────────────────
  'q_top_interest',      // 最希望和对象共享的一个兴趣方向
  'q_weekend_date',      // 周末约会地点偏好
  // ── 兴趣分支单选（仅双方都有对应兴趣才参与评分）───────────────
  'q_mv_together',       // 一起看片/剧的方式
  'q_ph_self',           // 摄影/看展自身经验水平
  'q_ph_prio',           // 摄影/看展最看重的方向
  'q_tr_style',          // 出行/旅行风格
  'q_sp_self',           // 运动自身水平
  'q_sp_partner',        // 期望的运动搭子类型
  'q_gm_self',           // 游戏自身状态
  'q_gm_partner',        // 期望的游戏伙伴水平
  // ── NOTE: q_physical_pace 和 q_work_style 已移入 DIMENSIONS（Likert 量表题）─
];

/** Cross-match pairs: [selfQ, partnerPrefQ] — skip selfQ in simple loop, cross at prefQ */
export const CATEGORICAL_CROSS_PAIRS: Array<[string, string]> = [
  ['q_my_pace', 'q_partner_pace'],          // 自己节奏 ↔ 希望对方节奏
  ['q_conflict_self', 'q_conflict_partner'], // 自己冲突方式 ↔ 希望对方冲突方式
];

/**
 * Sub-key mapping: interest category → multi_select branch question ID(s).
 * All sub-keys are checked; any shared values are pushed to sharedInterests.
 * If no sub-match is found, the category key itself is used.
 *
 * Omitted: swimming_dance (no multi_select sub-branch), pets, live_show* (music
 * style is shared with music_listening), programming_geek, finance_business,
 * other_interest — fall back to category label directly.
 * * live_show uses q_music_style if the user also selected music_listening; omitted
 *   here to avoid double-counting. Users who ONLY selected live_show still see the
 *   base category label.
 */
export const INTEREST_SUB_KEY: Record<string, string[]> = {
  movies_series:     ['q_mv_type', 'q_mv_media'],  // genre (comedy…) + medium (kr_drama…)
  boardgame_larp:    ['q_bg_type'],
  anime_acg:         ['q_acg_contact'],
  photo_exhibitions: ['q_ph_direction'],
  food_exploring:    ['q_fd_type'],
  travel_citywalk:   ['q_tr_type'],
  gym_fitness:       ['q_sp_type'],
  running_outdoor:   ['q_sp_type'],
  ball_sports:       ['q_ball_sport'],
  music_listening:   ['q_music_style'],
  reading_writing:   ['q_read_type'],
  fiction_fanfic:    ['q_novel_type'],
  gaming:            ['q_gm_mobile', 'q_gm_pc', 'q_gm_switch', 'q_gm_genre'],
};

// ── Component weights by intention ────────────────────────────────────

export const COMPONENT_WEIGHTS = {
  partner: {
    multiSelect: 0.9,
    ranking: 0.8,
    categorical: 0.7,
    mbti: { active: 0.9, passive: 0.3 },
    major: 1.0,
    campus: 0.8,
    hometown: 0.8,
  },
  friend: {
    multiSelect: 3.0,   // 共同兴趣是友谊首要基础
    ranking: 0.5,       // q59（爱的语言）为 partnerOnly，friend 模式实际不会计算
    categorical: 1.0,   // 相处氛围、冲突风格等仍相关
    mbti: { active: 0.3, passive: 0.1 },
    major: 0.3,
    campus: 1.5,        // 能否方便见面对友谊更重要
    hometown: 0.3,
  },
} as const;

// ── Friend-mode overrides ─────────────────────────────────────────────

export const FRIEND_DIMENSION_WEIGHTS: Record<string, number> = {
  lifestyle: 1.5,
  communication: 1.2,  // 相处风格、冲突方式仍收集
  boundary: 0,         // boundary 题全部为 partnerOnly，不计入
  values: 0.8,         // 价值观对长期友谊有意义
};

/** Likert questions to skip in friend dealbreaker checks (romance-specific). */
export const FRIEND_SKIP_DEALBREAKER_QUESTIONS = new Set([
  'q_history_imp',       // 恋爱经历介意度
  'q44',                 // 查看手机
  'q47',                 // 占有欲
  'q48',                 // 对方占有欲接受度
  'q57',                 // 开放式关系
  'q58',                 // 前任联系
]);

// ── Strict Likert questions (extreme gap ≥ 5 with high importance → dealbreaker) ──

export const STRICT_LIKERT_QUESTIONS: string[] = [
  'q10',                 // 吸烟接受度
  'q_history_imp',       // 恋爱经历介意度
  'q44',                 // 查看手机
  'q47',                 // 占有欲
  'q_keep_space',        // 保留空间
  'q57',                 // 开放式关系
  'q37',                 // 洁癖
  'q31',                 // 家庭背景
];

// ── Likert cross-pairs: A 的自我描述 ↔ B 对伴侣的期望（双向）─────────────────
// 与 CATEGORICAL_CROSS_PAIRS 同理，但用于 Likert 量表的跨题比较。
// diff 越小 → 双方越契合（A 的实际 vs B 的期望）。
export const LIKERT_CROSS_PAIRS: Array<[string, string]> = [
  ['q_rel_history', 'q_history_imp'], // 我的恋爱经历段数 ↔ 对方希望的段数
  ['q_work_style',  'q21'],           // 我的佛系/上进程度 ↔ 对方希望伴侣上进的程度
];

// ── q_must_align 选项 → 维度映射 ─────────────────────────────────────────────
// 当双方选了相同的 must_align 值时，对应维度权重额外 ×1.3。
// 'interests_shared' 映射到特殊键 '__interests'，在 compatibility 中单独处理。
export const MUST_ALIGN_TO_DIMENSION: Record<string, string> = {
  life_habit:       'lifestyle',
  schedule_vibe:    'communication',
  interests_shared: '__interests',  // boost multiSelect weight
  comm_style:       'communication',
  values_money:     'values',
  values_future:    'values',
  family_bg:        'values',
};
