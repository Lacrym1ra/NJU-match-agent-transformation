/**
 * NJU Match — 2026 新版问卷题库 v4.0
 *
 * ID 策略：旧题保留旧 ID（老用户答案自动兼容），新题用带前缀的描述性 ID
 * UI 分区（6 个 tab）≠ 算法维度（4 个）：
 *   - 算法维度: lifestyle / communication / boundary / values
 *   - UI 分区: basics / interests / lifestyle / communication / boundary / values
 */

export interface BaseQuestion {
  id: string;
  section: string;
  text: string;
  hasImportance: boolean;
  required?: boolean;
  /** 仅在找对象模式下显示/必填；找朋友模式跳过 */
  partnerOnly?: boolean;
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

export interface HeightRangeQuestion extends BaseQuestion {
  type: 'height_range';
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
  | YearRangeQuestion
  | HeightRangeQuestion;

// ── Helpers ──────────────────────────────────────────────────────────

const likert = (
  id: string,
  section: string,
  text: string,
  minLabel: string,
  maxLabel: string,
): LikertQuestion => ({
  id,
  type: 'likert',
  section,
  text,
  scale: { min: 1, max: 7, minLabel, maxLabel },
  hasImportance: true,
});

// ── Option lists ─────────────────────────────────────────────────────

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

// 江苏省内城市（13个地级市）
const JIANGSU_CITY_OPTIONS = [
  'nanjing', 'suzhou', 'wuxi', 'changzhou', 'zhenjiang',
  'yangzhou', 'taizhou', 'nantong', 'yancheng',
  'lianyungang', 'huaian', 'suqian', 'xuzhou',
];

// 南京大学四校区
const NJU_CAMPUS_OPTIONS = ['xianlin', 'gulou', 'pukou', 'suzhou_campus'];

const INTEREST_OPTIONS = [
  'gym_fitness', 'running_outdoor', 'ball_sports', 'swimming_dance',
  'movies_series', 'gaming', 'anime_acg', 'boardgame_larp',
  'photo_exhibitions', 'reading_writing', 'fiction_fanfic', 'food_exploring', 'travel_citywalk',
  'music_listening', 'live_show', 'pets', 'programming_geek', 'finance_business', 'other_interest',
];

const QUALITY_OPTIONS = [
  'kindness', 'honesty', 'loyalty', 'integrity', 'self_discipline',
  'ambition', 'independence', 'curiosity', 'creativity', 'family',
  'freedom', 'friendship', 'fairness', 'courage', 'adventure', 'faith',
];

const DATE_CONTENT_OPTIONS = [
  'eat_explore', 'walk_citywalk', 'movie_series', 'sports',
  'gaming', 'exhibition_photo', 'study', 'live_concert',
  'travel_nearby', 'just_chat',
];

const FREE_TIME_OPTIONS = [
  'weekday_day', 'weekday_night', 'sat_day', 'sat_night', 'sun_day', 'sun_night',
];

const RED_FLAG_OPTIONS = [
  'ghost_msg', 'flirt_opposite', 'emotional_unstable', 'phone_control',
  'too_clingy', 'too_cold', 'stand_up', 'spend_gap',
  'hurtful_words', 'disrespect_circle', 'other_flag',
];

const FUTURE_LOCATION_OPTIONS = [
  'jiangsu', 'shanghai', 'zhejiang', 'anhui', 'beijing', 'guangdong',
  'sichuan_chongqing', 'east_china_other', 'north_china', 'central_china',
  'south_china', 'southwest', 'northwest', 'northeast',
  'hk_macao_tw_overseas', 'undecided', 'opportunity_first',
];

// ── Interest branch options ───────────────────────────────────────────
const MOVIE_TYPE_OPTIONS = ['comedy', 'romance', 'suspense_crime', 'sci_fi', 'action', 'horror', 'arthouse', 'animation', 'documentary'];
const MOVIE_MEDIA_OPTIONS = ['cn_drama', 'us_drama', 'uk_drama', 'kr_drama', 'jp_drama', 'movie'];
const BOARDGAME_TYPE_OPTIONS = ['werewolf_avalon', 'party_boardgame', 'german_strategy', 'murder_mystery', 'escape_room'];
const BOARDGAME_PRIORITY_OPTIONS = ['no_bail', 'logic_matters', 'chill_vibe', 'newbie_friendly', 'prefer_friends'];
const ACG_CONTACT_OPTIONS = ['anime', 'manga', 'light_novel', 'fanfic', 'cosplay', 'convention', 'vtuber', 'goods'];
const PHOTO_DIRECTION_OPTIONS = ['portrait', 'street', 'film', 'digital', 'art_museum', 'museum', 'photo_exhibition', 'installation'];
const FOOD_TYPE_OPTIONS = ['cheap_eats', 'cafe_dessert', 'hotpot_bbq', 'jp_kr_food', 'western_brunch', 'milk_tea', 'late_night', 'hidden_gem', 'home_cook'];
const FOOD_PRIORITY_OPTIONS = ['taste', 'value_money', 'good_chat', 'nice_ambiance', 'close_by', 'instagrammable'];
const TRAVEL_TYPE_OPTIONS = ['campus_walk', 'city_walk', 'cafe_hop', 'short_trip', 'speed_trip', 'slow_stroll', 'photo_spot', 'random_explore'];
const ROUND_BALL_SPORTS_OPTIONS = ['badminton', 'basketball', 'table_tennis', 'tennis', 'football', 'volleyball', 'billiards', 'other_specify'];
const BOOK_TYPE_OPTIONS = ['lit_fiction', 'sci_fi_fantasy', 'history_bio', 'philosophy_social', 'science_tech', 'business_econ', 'poetry_essay', 'comics_picture_book', 'other_specify'];
const NOVEL_TYPE_OPTIONS = ['romance_novel', 'suspense_thriller', 'wuxia_xianxia', 'sci_fi_novel', 'fantasy_magic', 'bl_danmei', 'gl_baihe', 'fanfic_novel', 'other_specify'];
// 健身/户外运动专用（球类运动已由 q_ball_sport 单独覆盖，故此处不重复）
const SPORT_TYPE_OPTIONS = ['weight_training', 'running', 'cycling', 'swimming', 'yoga_pilates', 'dancing', 'hiking_climbing', 'other_specify'];
const GAME_PLATFORM_OPTIONS = ['mobile', 'pc', 'switch_console', 'single_player', 'follow_friends'];
const GAME_GENRE_OPTIONS = ['moba', 'fps', 'open_world_rpg', 'gacha', 'party_casual', 'rhythm', 'card_strategy', 'simulation', 'story_puzzle', 'survival_build', 'other_specify'];
const MOBILE_GAME_OPTIONS = ['honor_of_kings', 'tft', 'pubg_mobile', 'eggy_party', 'genshin', 'star_rail', 'wuthering', 'arknights', 'love_nikki', 'identity_v', 'other_specify'];
const PC_GAME_OPTIONS = ['lol', 'valorant', 'cs2', 'apex', 'ow2', 'dbd', 'minecraft', 'gta5', 'stardew', 'r6', 'warframe', 'it_takes_two', 'delta_force', 'marvel_rivals', 'dota2', 'rock_kingdom_world', 'other_specify'];
const SWITCH_GAME_OPTIONS = ['zelda', 'mario_kart', 'animal_crossing', 'pokemon', 'smash_bros', 'splatoon', 'overcooked', 'minecraft_sw', 'xenoblade', 'stardew_sw', 'other_specify'];
const MUSIC_STYLE_OPTIONS = ['c_pop', 'k_pop', 'j_pop', 'western_pop', 'rock', 'hip_hop_rap', 'r_and_b', 'electronic_dance', 'classical', 'jazz_blues', 'folk_country', 'indie', 'acg_vocaloid', 'other_specify'];
// ── QUESTION BANK ────────────────────────────────────────────────────

export const QUESTION_BANK: Question[] = [

  // ═══════════════════════════════════════════════════════════════════
  // SECTION: basics  基础信息与硬筛条件
  // ═══════════════════════════════════════════════════════════════════

  // q1, q2 是旧 ID，老用户答案自动保留
  { id: 'q1', type: 'number_input', section: 'basics', text: '我的出生年份：', min: 1991, max: 2008, hasImportance: false },
  { id: 'q2', type: 'year_range', section: 'basics', text: '我希望匹配对象的出生年份范围：', min: 1991, max: 2008, hasImportance: false },
  { id: 'q_height', type: 'number_input', section: 'basics', text: '我的身高（cm，选填）：', min: 140, max: 210, hasImportance: false, required: false },
  { id: 'q_height_range', type: 'height_range', section: 'basics', text: '我希望对方身高范围（cm，选填）：', min: 140, max: 210, hasImportance: false, required: false },

  // q61 是旧 ID
  {
    id: 'q61', type: 'multi_select', section: 'basics',
    text: '我希望匹配对象的 MBTI 类型是（限选 4 个，选"无所谓"则不限制）：',
    options: ['intj', 'intp', 'entj', 'entp', 'infj', 'infp', 'enfj', 'enfp', 'istj', 'isfj', 'estj', 'esfj', 'istp', 'isfp', 'estp', 'esfp', 'any_mbti'],
    maxSelect: 4, hasImportance: false,
  },
  // q5, q7 是旧 ID
  {
    id: 'q5', type: 'multi_select', section: 'basics',
    text: '我希望匹配对象的年级范围（可多选）：',
    options: ['same_grade', 'lower_grade', 'higher_grade'],
    maxSelect: 3, hasImportance: false,
  },
  {
    id: 'q7', type: 'single_select', section: 'basics',
    text: '我希望匹配对象的学院和我：',
    options: ['strict_same_major', 'prefer_same_major', 'strict_diff_major', 'prefer_diff_major', 'neutral'],
    hasImportance: false,
  },
  // q3 是旧 ID（家乡省份，后续移至 onboarding，暂留此处供算法使用）
  {
    id: 'q3', type: 'single_select', section: 'basics',
    text: '我的家乡省份（地区）：',
    options: [...PROVINCE_OPTIONS, 'unknown'],
    hasImportance: false,
  },
  // 江苏省内城市（仅 q3 = jiangsu 时出现）
  {
    id: 'q_jiangsu_city', type: 'single_select', section: 'basics',
    text: '我来自江苏省哪个城市：',
    options: JIANGSU_CITY_OPTIONS,
    hasImportance: false,
    required: false,
    dependsOn: { questionId: 'q3', value: 'jiangsu' },
  },
  // q4 是旧 ID，选项已更新：新增"偏好同城"
  {
    id: 'q4', type: 'single_select', section: 'basics',
    text: '我更希望匹配对象的家乡与我：',
    options: ['prefer_same_city', 'prefer_same_province', 'prefer_nearby', 'neutral'],
    hasImportance: false,
  },
  // q6 是旧 ID，选项已更新：新增"四校区自选"
  {
    id: 'q6', type: 'single_select', section: 'basics',
    text: '我对跨校区的接受度：',
    options: ['same_campus_only', 'nanjing_campuses', 'select_campuses', 'any_campus'],
    hasImportance: false,
  },
  // 自选接受的校区（仅 q6 = select_campuses 时出现；最多选 3 个，若全部可接受请回选「都可以」）
  {
    id: 'q6_campus_select', type: 'multi_select', section: 'basics',
    text: '我可以接受的校区（最多选 3 个，若四个都行请选「都可以」）：',
    options: NJU_CAMPUS_OPTIONS,
    maxSelect: 3,
    hasImportance: false,
    required: false,
    dependsOn: { questionId: 'q6', value: 'select_campuses' },
  },

  // ═══════════════════════════════════════════════════════════════════
  // SECTION: interests  兴趣爱好与共同活动
  // ═══════════════════════════════════════════════════════════════════

  // q8 是旧 ID，选项已重构（新类目）
  {
    id: 'q8', type: 'multi_select', section: 'interests',
    text: '我的核心兴趣爱好（限选 4 项）：',
    options: INTEREST_OPTIONS, maxSelect: 4, hasImportance: false,
  },

  // ── 兴趣分支（紧跟 q8，依赖条件展示）────────────────────────────

  // A: 电影/剧集
  { id: 'q_mv_type',    type: 'multi_select', section: 'interests', text: '你更偏好的影视类型（可多选）：', options: MOVIE_TYPE_OPTIONS, maxSelect: 9, hasImportance: false, dependsOn: { questionId: 'q8', value: 'movies_series' } },
  { id: 'q_mv_media',   type: 'multi_select', section: 'interests', text: '你更常看的影视媒介：', options: MOVIE_MEDIA_OPTIONS, maxSelect: 6, hasImportance: false, dependsOn: { questionId: 'q8', value: 'movies_series' } },
  { id: 'q_mv_together',type: 'single_select', section: 'interests', text: '你更希望怎么一起看：', options: ['watch_offline', 'watch_online', 'discuss_plot', 'all_fine'], hasImportance: false, dependsOn: { questionId: 'q8', value: 'movies_series' } },

  // B: 桌游/剧本杀/密室
  { id: 'q_bg_type', type: 'multi_select', section: 'interests', text: '你更喜欢哪类线下游戏：', options: BOARDGAME_TYPE_OPTIONS, maxSelect: 5, hasImportance: false, dependsOn: { questionId: 'q8', value: 'boardgame_larp' } },
  { id: 'q_bg_prio',  type: 'multi_select', section: 'interests', text: '你最在意什么（最多选 2 项）：', options: BOARDGAME_PRIORITY_OPTIONS, maxSelect: 2, hasImportance: false, dependsOn: { questionId: 'q8', value: 'boardgame_larp' } },

  // C: 动漫/二次元
  { id: 'q_acg_contact', type: 'multi_select', section: 'interests', text: '你更常接触：', options: ACG_CONTACT_OPTIONS, maxSelect: 8, hasImportance: false, dependsOn: { questionId: 'q8', value: 'anime_acg' } },
  { id: 'q_acg_together',type: 'single_select', section: 'interests', text: '你更希望怎么一起玩：', options: ['watch_anime', 'go_convention', 'discuss_chars', 'buy_goods', 'all_fine'], hasImportance: false, dependsOn: { questionId: 'q8', value: 'anime_acg' } },

  // D: 摄影/看展
  { id: 'q_ph_direction', type: 'multi_select', section: 'interests', text: '你更偏好的方向：', options: PHOTO_DIRECTION_OPTIONS, maxSelect: 8, hasImportance: false, dependsOn: { questionId: 'q8', value: 'photo_exhibitions' } },
  { id: 'q_ph_self',      type: 'single_select', section: 'interests', text: '你的摄影/看展经验更接近：', options: ['ph_newbie', 'ph_casual', 'ph_experienced', 'ph_pro'], hasImportance: false, dependsOn: { questionId: 'q8', value: 'photo_exhibitions' } },
  { id: 'q_ph_prio',      type: 'single_select', section: 'interests', text: '你更看重：', options: ['focus_photo', 'focus_art', 'focus_company'], hasImportance: false, dependsOn: { questionId: 'q8', value: 'photo_exhibitions' } },

  // E: 探店/美食
  { id: 'q_fd_type', type: 'multi_select', section: 'interests', text: '你更偏好：', options: FOOD_TYPE_OPTIONS, maxSelect: 9, hasImportance: false, dependsOn: { questionId: 'q8', value: 'food_exploring' } },
  { id: 'q_fd_prio',  type: 'multi_select', section: 'interests', text: '约饭时你更看重（最多选 2 项）：', options: FOOD_PRIORITY_OPTIONS, maxSelect: 2, hasImportance: false, dependsOn: { questionId: 'q8', value: 'food_exploring' } },

  // F: 旅行/CityWalk
  { id: 'q_tr_type',  type: 'multi_select',  section: 'interests', text: '你更喜欢哪种出行：', options: TRAVEL_TYPE_OPTIONS, maxSelect: 8, hasImportance: false, dependsOn: { questionId: 'q8', value: 'travel_citywalk' } },
  { id: 'q_tr_style', type: 'single_select', section: 'interests', text: '你出门风格更接近：', options: ['detailed_plan', 'rough_plan', 'totally_random'], hasImportance: false, dependsOn: { questionId: 'q8', value: 'travel_citywalk' } },

  // G: 运动
  { id: 'q_sp_type',    type: 'multi_select', section: 'interests', text: '你平时主要的健身 / 户外运动项目（最多选 3 项）：', options: SPORT_TYPE_OPTIONS, maxSelect: 3, hasImportance: false, dependsOn: { questionId: 'q8', value: ['gym_fitness', 'running_outdoor'] } },
  { id: 'q_ball_sport', type: 'multi_select', section: 'interests', text: '经常参与或喜欢的球类运动（选填，最多选 4 项）：', options: ROUND_BALL_SPORTS_OPTIONS, maxSelect: 4, hasImportance: false, required: false, dependsOn: { questionId: 'q8', value: 'ball_sports' } },
  { id: 'q_sp_self',    type: 'single_select', section: 'interests', text: '你自身的运动频率/水平是：', options: ['sp_newbie', 'sp_casual', 'sp_regular', 'sp_pro'], hasImportance: false, dependsOn: { questionId: 'q8', value: ['gym_fitness', 'running_outdoor', 'ball_sports', 'swimming_dance'] } },
  { id: 'q_sp_partner', type: 'single_select', section: 'interests', text: '你更想找哪种运动搭子：', options: ['long_term', 'similar_level', 'pure_company', 'need_coach'], hasImportance: false, dependsOn: { questionId: 'q8', value: ['gym_fitness', 'running_outdoor', 'ball_sports', 'swimming_dance'] } },

  // H: 游戏
  { id: 'q_gm_platform', type: 'multi_select',  section: 'interests', text: '我常玩的游戏平台：', options: GAME_PLATFORM_OPTIONS, maxSelect: 5, hasImportance: false, dependsOn: { questionId: 'q8', value: 'gaming' } },
  { id: 'q_gm_genre',    type: 'multi_select',  section: 'interests', text: '我更偏好的游戏类型：', options: GAME_GENRE_OPTIONS, maxSelect: 11, hasImportance: false, dependsOn: { questionId: 'q8', value: 'gaming' } },
  { id: 'q_gm_mobile',   type: 'multi_select',  section: 'interests', text: '我最近常玩的手游：', options: MOBILE_GAME_OPTIONS, maxSelect: 11, hasImportance: false, required: false, dependsOn: { questionId: 'q_gm_platform', value: 'mobile' } },
  { id: 'q_gm_pc',       type: 'multi_select',  section: 'interests', text: '我最近常玩的 PC / 端游：', options: PC_GAME_OPTIONS, maxSelect: 17, hasImportance: false, required: false, dependsOn: { questionId: 'q_gm_platform', value: 'pc' } },
  { id: 'q_gm_switch',   type: 'multi_select',  section: 'interests', text: '我最近常玩的 Switch / 主机游戏：', options: SWITCH_GAME_OPTIONS, maxSelect: 11, hasImportance: false, required: false, dependsOn: { questionId: 'q_gm_platform', value: 'switch_console' } },
  { id: 'q_gm_self',     type: 'single_select', section: 'interests', text: '一起打游戏时，我自己的状态更接近：', options: ['newbie', 'casual', 'experienced', 'tryhard', 'depends_game'], hasImportance: false, dependsOn: { questionId: 'q8', value: 'gaming' } },
  { id: 'q_gm_partner',  type: 'single_select', section: 'interests', text: '我更希望对方和我的游戏水平：', options: ['some_gap_ok', 'must_close', 'carry_or_carried', 'dont_care'], hasImportance: false, dependsOn: { questionId: 'q8', value: 'gaming' } },
  
  // I: 音乐/Live演出
  { id: 'q_music_style', type: 'multi_select', section: 'interests', text: '钟爱的音乐风格（选填）：', options: MUSIC_STYLE_OPTIONS, maxSelect: 4, hasImportance: false, required: false, dependsOn: { questionId: 'q8', value: ['music_listening', 'live_show'] } },

  // J: 阅读写作与小说
  { id: 'q_read_type', type: 'multi_select', section: 'interests', text: '最近喜欢看的书籍品类（选填）：', options: BOOK_TYPE_OPTIONS, maxSelect: 4, hasImportance: false, required: false, dependsOn: { questionId: 'q8', value: 'reading_writing' } },
  { id: 'q_novel_type', type: 'multi_select', section: 'interests', text: '偏好的小说类型（选填）：', options: NOVEL_TYPE_OPTIONS, maxSelect: 4, hasImportance: false, required: false, dependsOn: { questionId: 'q8', value: 'fiction_fanfic' } },

  // ── 兴趣通用题（紧跟分支之后）──────────────────────────────────
  {
    id: 'q_top_interest', type: 'single_select', section: 'interests',
    text: '如果只能选一个最希望和对象共享的兴趣方向：',
    options: INTEREST_OPTIONS, hasImportance: false,
  },
  {
    id: 'q_date_content', type: 'multi_select', section: 'interests',
    text: '我理想中的约会内容更接近（最多选 3 项）：',
    options: DATE_CONTENT_OPTIONS, maxSelect: 3, hasImportance: false,
  },
  {
    id: 'q_weekend_date', type: 'single_select', section: 'interests',
    text: '周末约会我更倾向：',
    options: ['campus_fine', 'both_ok', 'prefer_outside'],
    hasImportance: false,
  },

  // ═══════════════════════════════════════════════════════════════════
  // SECTION: lifestyle  生活习惯与现实兼容
  // ═══════════════════════════════════════════════════════════════════

  // q9 是旧 ID
  { id: 'q9', type: 'single_select', section: 'lifestyle', text: '我有吸烟或抽电子烟的习惯：', options: ['yes', 'no'], hasImportance: false },
  // q10 保持旧语义，避免与历史答案方向冲突
  likert('q10', 'lifestyle', '我完全无法接受伴侣有吸烟或抽电子烟的习惯。', '完全不同意', '完全同意'),

  { id: 'q_drink_freq', type: 'single_select', section: 'lifestyle', text: '我饮酒的频率更接近：', options: ['rarely', 'occasionally', 'sometimes', 'frequently'], hasImportance: false },
  likert('q_drink_pref', 'lifestyle', '我对匹配对象饮酒习惯的接受度：', '只能接受基本不喝', '完全无所谓'),

  likert('q_pet_like',    'lifestyle', '我对小动物的喜欢程度：', '完全不喜欢', '非常喜欢'),
  likert('q_pet_partner', 'lifestyle', '我希望对方喜欢小动物的程度：', '完全不喜欢', '非常喜欢'),

  // q15 是旧 ID
  { id: 'q15', type: 'single_select', section: 'lifestyle', text: '我的作息习惯：', options: ['early_sleep_early_rise', 'early_sleep_late_rise', 'late_sleep_late_rise', 'late_sleep_early_rise'], hasImportance: false },
  likert('q_schedule_imp', 'lifestyle', '我对对方作息与我一致的重视程度：', '完全不重要', '非常重要'),

  { id: 'q_free_time', type: 'multi_select', section: 'lifestyle', text: '我更常有空的时间（可多选）：', options: FREE_TIME_OPTIONS, maxSelect: 6, hasImportance: false },

  { id: 'q_spend_style', type: 'single_select', section: 'lifestyle', text: '消费时，我更愿意把钱花在：', options: ['experience', 'material', 'balanced'], hasImportance: false },
  likert('q_spend_imp', 'lifestyle', '我认为两个人的消费观相近，在关系中：', '完全不重要', '非常重要'),
  // q32 改为具体开销模式
  { id: 'q32', type: 'single_select', section: 'lifestyle', text: '恋爱中的日常开销，我更舒服的方式是：', options: ['share_equally', 'i_pay_more', 'partner_pays_more', 'go_with_flow'], hasImportance: false, partnerOnly: true },
  { ...likert('q_spend_mode_imp', 'lifestyle', '我对双方开销方式契合的重视程度：', '完全不重要', '非常重要'), partnerOnly: true},

  // q37, q38 是旧 ID
  likert('q37', 'lifestyle', '我对生活环境的整洁度要求极高（有轻微或严重洁癖）：', '完全不符合', '非常符合'),
  likert('q38', 'lifestyle', '我习惯做详尽的计划，非常不喜欢"说走就走"的突然改变：', '完全不符合', '非常符合'),

  // ═══════════════════════════════════════════════════════════════════
  // SECTION: communication  相处沟通（含恋爱节奏，前三题）
  // ═══════════════════════════════════════════════════════════════════

  // ── 恋爱节奏子集（合并于本部分）───────────────────────────────
  { id: 'q_rel_mode',    type: 'single_select', section: 'communication', text: '在感情的推进与互动中，我更倾向的模式是：', options: ['proactive', 'prefer_partner_active', 'mutual_active', 'casual_flow'], hasImportance: false, partnerOnly: true },
  { id: 'q_my_pace',     type: 'single_select', section: 'communication', text: '我进入一段关系的节奏更接近：', options: ['slow_careful', 'fast_if_chemistry', 'depends'], hasImportance: false, partnerOnly: true },

  // ── 沟通风格 ──────────────────────────────────────────────────
  { id: 'q_atmosphere',      type: 'single_select', section: 'communication', text: '我更喜欢的相处氛围：', options: ['lively_talkative', 'mix_talk_quiet', 'quiet_comfy', 'depends_mood'], hasImportance: false },
  { id: 'q_conflict_self',   type: 'single_select', section: 'communication', text: '当发生矛盾时，我更接近：', options: ['talk_now', 'cool_then_talk', 'avoid_delay', 'depends'], hasImportance: false },
  { id: 'q_conflict_partner',type: 'single_select', section: 'communication', text: '我更希望对方在发生矛盾时：', options: ['talk_now', 'cool_first', 'no_pressure', 'dont_care'], hasImportance: false },
  { id: 'q_support_pref',    type: 'single_select', section: 'communication', text: '我遇到挫折时，更希望对方：', options: ['emotional_support', 'analyze_problem', 'both', 'depends'], hasImportance: false },
  { id: 'q_reply_speed',     type: 'single_select', section: 'communication', text: '我的消息回复速度通常：', options: ['very_fast', 'normal', 'slow', 'depends_mood'], hasImportance: false },
  likert('q_reply_pref', 'communication', '我对匹配对象消息回复速度的期待：', '有空再回就行', '希望非常及时'),

  // q41 是旧 ID（原 emotional 独处时间）
  likert('q41', 'communication', '我每天需要独处时间的程度：', '完全不需要', '非常需要'),
  // q36 是旧 ID（原 values 高频陪伴）
  { ...likert('q36', 'communication', '恋爱中我对高频陪伴与黏性的需要程度：', '完全不需要', '非常需要'), partnerOnly: true },
  { ...likert('q_affection_need', 'communication', '我对伴侣高频表达爱意的需要程度：', '完全不需要', '非常需要'), partnerOnly: true },
  { ...likert('q_physical_pace', 'communication', '在关系初期，我对身体接触（如牵手、拥抱）的接受速度：', '非常慢热', '顺其自然'), partnerOnly: true },


  // ═══════════════════════════════════════════════════════════════════
  // SECTION: boundary  边界与安全感
  // ═══════════════════════════════════════════════════════════════════

  { ...likert('q_rel_history', 'boundary', '我过去进入过几段较正式的恋爱关系：', '0段', '6段或以上'), partnerOnly: true},
  { ...likert('q_history_imp', 'boundary', '我希望对方过往有过几段恋爱经历：', '0段', '6段或以上'), partnerOnly: true},

  // q44 是旧 ID（查看手机倾向）
  { ...likert('q44', 'boundary', '当我缺乏安全感时，我查看伴侣手机的倾向：', '完全不会', '非常可能'), partnerOnly: true},
  // q47 是旧 ID（占有欲/吃醋自身）
  { ...likert('q47', 'boundary', '我自己的占有欲 / 吃醋倾向：', '非常低', '非常高'), partnerOnly: true},
  // q48 是旧 ID（不接受伴侣占有欲）
  { ...likert('q48', 'boundary', '我对伴侣占有欲 / 吃醋程度的接受度：', '完全不能接受', '完全可以接受'), partnerOnly: true},
  {
    id: 'q_space_integration', type: 'single_select', section: 'boundary',
    text: '恋爱后，我更理想的相处状态是：',
    options: ['high_integration', 'balanced_space', 'high_independence', 'space_depends'],
    hasImportance: false, partnerOnly: true
  },
  { id: 'q_red_flags', type: 'multi_select', section: 'boundary', text: '我最不能接受的恋爱中的问题（最多选 3 项）：', options: RED_FLAG_OPTIONS, maxSelect: 3, hasImportance: false, partnerOnly: true },
  // q57 是旧 ID（开放式关系）
  { ...likert('q57', 'boundary', '我能够接受开放式关系（如双方知情同意下的非排他性关系）：', '完全不能接受', '完全可以接受'), partnerOnly: true},

  // ═══════════════════════════════════════════════════════════════════
  // SECTION: values  个人风格与价值观
  // ═══════════════════════════════════════════════════════════════════

  // q21 是旧 ID（希望伴侣上进）
  likert('q21', 'values', '我希望匹配对象是一个非常上进、目标导向的人：', '完全不重要', '非常重要'),
  likert('q_work_style', 'values', '我的做事风格更接近：', '非常佛系', '非常上进'),
  // q27 是旧 ID（关系>事业）
  likert('q27', 'values', '相比事业优先，我更看重关系与生活幸福感：', '完全不符合', '非常符合'),
  // q24 是旧 ID（组建家庭）
  { ...likert('q24', 'values', '我未来希望组建家庭并拥有孩子：', '完全不符合', '非常符合'), partnerOnly: true},

  // q25, q33, q26, q28, q30 是旧 ID（价值观Likert）
  likert('q25', 'values', '在关键利益面前，善良比聪明更重要：', '完全不符合', '非常符合'),
  likert('q33', 'values', '智商（聪明、有深度）比情商（会照顾人、提供情绪价值）更吸引我：', '完全不符合', '非常符合'),
  likert('q26', 'values', '我愿意为了理想与热爱，放弃一部分物质舒适：', '完全不符合', '非常符合'),
  likert('q28', 'values', '我认为世界上 99% 的烦恼都可以用钱来解决：', '完全不符合', '非常符合'),
  likert('q30', 'values', '物质财富的积累比精神上的共鸣更重要：', '完全不符合', '非常符合'),

  // q_future_base 改为多选（选项为大区，非省份）
  {
    id: 'q_future_base', type: 'multi_select', section: 'values',
    text: '我未来倾向发展的地区（可多选，最多 3 项）：',
    options: FUTURE_LOCATION_OPTIONS, maxSelect: 3, hasImportance: false,
  },
  likert('q_future_base_imp', 'values', '我对对象未来发展地区与我一致的重视程度：', '完全不重要', '非常重要'),

  { id: 'q_growth_env',  type: 'single_select', section: 'values', text: '我的成长环境更接近：', options: ['tier1_core', 'tier2', 'tier3_4', 'county', 'rural'], hasImportance: false },
  { id: 'q_family_econ', type: 'single_select', section: 'values', text: '我对自己家庭经济条件的感受更接近：', options: ['tight', 'normal', 'comfortable', 'very_comfortable', 'prefer_not_say'], hasImportance: false },
  // q31 是旧 ID（家庭背景重要性）
  likert('q31', 'values', '我认为两个人的家庭背景和成长环境相近，在关系中：', '完全不重要', '非常重要'),

  // q29 是旧 ID（我的品质）
  { id: 'q29', type: 'multi_select', section: 'values', text: '我自己更接近哪些品质（限选 4 项）：', options: QUALITY_OPTIONS, maxSelect: 4, hasImportance: false },
  { id: 'q_partner_qualities', type: 'multi_select', section: 'values', text: '我最看重对方具备哪些品质（限选 4 项）：', options: QUALITY_OPTIONS, maxSelect: 4, hasImportance: false },

  // q60 是旧 ID，选项已更新（新维度名）
  {
    id: 'q60', type: 'single_select', section: 'values',
    text: '在以上所有维度里，你认为匹配中最重要的是：',
    options: ['interests', 'lifestyle', 'communication', 'boundary', 'values'],
    hasImportance: false,
  },
  // 新增：偏好匹配方向（选填）
  {
    id: 'q_must_align', type: 'single_select', section: 'values',
    text: '如果只能有一个方面和对方高度一致，你最希望是（选填）：',
    options: ['life_habit', 'schedule_vibe', 'interests_shared', 'comm_style', 'values_money', 'values_future', 'family_bg'],
    hasImportance: false, required: false,
  },
];

// ── Sections ─────────────────────────────────────────────────────────

export const SECTIONS = [
  { id: 'basics',        title: '基础信息', description: '硬性条件与基础偏好' },
  { id: 'interests',     title: '兴趣爱好', description: '核心爱好与理想约会' },
  { id: 'lifestyle',     title: '生活习惯', description: '日常节奏与现实兼容' },
  { id: 'communication', title: '相处沟通', description: '恋爱节奏、交流方式与陪伴需求' },
  { id: 'boundary',      title: '边界安全感', description: '信任、空间与底线' },
  { id: 'values',        title: '价值观', description: '人生观、金钱观与未来规划' },
];

// ── Exports ──────────────────────────────────────────────────────────

export const LIKERT_QUESTION_IDS = QUESTION_BANK
  .filter((q) => q.type === 'likert')
  .map((q) => q.id);

export function getQuestionsBySection() {
  return SECTIONS.map((section) => ({
    ...section,
    questions: QUESTION_BANK.filter((q) => q.section === section.id),
  }));
}

