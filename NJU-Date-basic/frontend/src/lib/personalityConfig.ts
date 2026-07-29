// ============================================================
// NJU Match SBTI Personality Config
// Based on: nju_match_sbti_algorithm_spec_v2
// ============================================================

export type PersonalityType =
  | 'deadline-dancer'
  | 'office-hour-angel'
  | 'hot-nerd'
  | 'brain-bae'
  | 'lab-cutie'
  | 'quiz-crush'
  | 'campus-fox'
  | 'book-charm'
  | 'art-kid'
  | 'soft-spirit'
  | 'hidden-boss'
  | 'sloth-mode'
  | 'you-know-who';

export const EASTER_EGG_TYPES: PersonalityType[] = ['sloth-mode'];
export const MAIN_TYPES: PersonalityType[] = [
  'hot-nerd', 'brain-bae', 'lab-cutie', 'quiz-crush', 'campus-fox',
  'book-charm', 'art-kid', 'soft-spirit', 'hidden-boss',
  'deadline-dancer', 'office-hour-angel',
];

export interface FeatureVector {
  drive: number;
  structure: number;
  social_energy: number;
  warmth: number;
  analytical: number;
  reserved: number;
  freeflow: number;
  campus_play: number;
  attachment: number;
  aesthetic: number;
  // Derived
  focus_aura: number;
  conversational_pull: number;
  clutch_reliability: number;
}

export interface PersonalityScore {
  type: PersonalityType;
  score: number;
}

export interface PersonalityResult {
  finalType: PersonalityType;
  isEasterEgg: boolean;
  confidence: number;
  top3: PersonalityScore[];
  features: FeatureVector;
  completedAt?: string;
  source?: 'test' | 'survey'; // where the result came from
}

// ── Type display info ──────────────────────────────────────

export interface TypeInfo {
  nameEn: string;
  nameCn: string;
  tagline: string;
  description: string;
  color: string;       // primary accent color
  bgColor: string;     // light background tint
  imagePath: string;   // placeholder — user will upload
  traits: string[];
  emoji: string;
}

export const TYPE_INFO: Record<PersonalityType, TypeInfo> = {
  'deadline-dancer': {
    nameEn: 'deadline-dancer',
    nameCn: 'DDL 踩点艺术家',
    tagline: '你很会活，也很会让别人提心吊胆。',
    description:
      '你很会在最后一刻把事情拉回来。你的人生节奏大概属于，不到最后一刻绝不进入真状态，但一到最后一刻，又真的能把事情救回来。你不一定是传统意义上的规划型选手，很多时候更像靠状态、直觉和一点命硬，把自己从翻车边缘捞出来。你这种“极限过关”的能力确实很强。问题是，和你一起做事的人通常会被吓得不轻，因为没人知道你到底是真有谱，还是只是每次都刚好运气不错。',
    color: '#D4622E',
    bgColor: '#FFF3EE',
    imagePath: '/images/ti/deadline-dancer.jpg',
    traits: ['临场发挥', '松弛感', '活在当下', '反规划'],
    emoji: '🎲',
  },
  'office-hour-angel': {
    nameEn: 'office-hour-angel',
    nameCn: '续命天使',
    tagline: '你很适合求助，但不该被当成免费售后。',
    description:
      '你很能接住人。你像那种别人一卡住就会自动想起的人，不是因为你最爱表现，而是因为你真的能把混乱先接住，再一点点讲明白。别人乱的时候你不乱，别人崩的时候你还能理出头绪，这种“能续命”的能力其实很少见。你给人的吸引力不是短暂上头，而是一种“好像真的可以信你”的安心感。问题是，你太像公共补给站了，久了大家都默认你会接住，反而容易把你的付出用成理所当然。',
    color: '#1A9E5C',
    bgColor: '#EDFAF3',
    imagePath: '/images/ti/office-hour-angel.jpg',
    traits: ['靠谱', '实用主义', '低调温暖', '理性'],
    emoji: '☕',
  },
  'hot-nerd': {
    nameEn: 'hot-nerd',
    nameCn: '性感书呆子',
    tagline: '你很迷人，但得先抢到你的注意力。',
    description:
      '你专注起来特别有魅力。你不是那种刻意撩人的类型，但一进入状态，就会自然生出一种很有杀伤力的吸引力。平时你的脑子里装着目标、计划和一堆正事，旁边再热闹，也很难把你从自己的节奏里拉出去。你这种“我现在有更重要的事”的气场，偏偏特别让人上头。问题是，你也很容易显得不好靠近，甚至会让人怀疑，自己到底能不能排进你的优先级。',
    color: '#6D28D9',
    bgColor: '#F3EFFF',
    imagePath: '/images/ti/hot-nerd.jpg',
    traits: ['自律', '高专注', '分析型', '低社交成本'],
    emoji: '📐',
  },
  'brain-bae': {
    nameEn: 'brain-bae',
    nameCn: '智性天菜',
    tagline: '你很会勾人，而且经常不是故意的。',
    description:
      '你很会聊天，也很会让人越聊越上头。你最容易让人心动的地方，不是外表管理，也不是神秘感，而是和你说话这件事本身。你会接梗，会表达，也会把复杂的东西讲得清楚又好听，所以别人很容易从“随便聊聊”一路滑到“怎么越聊越不对劲”。你的魅力不是摆在那里等人发现的，而是在交流里一点点放大的。问题是，你太容易制造暧昧错觉了，你未必在撩，但别人真的很容易误会。',
    color: '#0369A1',
    bgColor: '#EEF7FF',
    imagePath: '/images/ti/brain-bae.jpg',
    traits: ['高智识', '对话吸引力', '有观点', '温暖有趣'],
    emoji: '💡',
  },
  'lab-cutie': {
    nameEn: 'lab-cutie',
    nameCn: '工位白月光',
    tagline: '你很好记住，但不太容易靠近。',
    description:
      '你安静，却特别耐看。你不是那种会主动刷存在感的人，但别人总会莫名其妙记住你。你像固定刷新在某个角落里的人，低调、干净、稳定，看起来毫不刻意，却会在时间里慢慢积累出存在感。你不是第一眼就很炸的类型，但特别容易后劲很大。问题是，你太习惯活在自己的节奏里了，别人一边觉得你很特别，一边又会怀疑，自己到底能不能真的走近你。',
    color: '#0F766E',
    bgColor: '#EDFAF8',
    imagePath: '/images/ti/lab-cutie.jpg',
    traits: ['固定节奏', '高专注', '低社交', '稳定感'],
    emoji: '🌙',
  },
  'quiz-crush': {
    nameEn: 'quiz-crush',
    nameCn: '考前限定临门一脚型',
    tagline: '你平时低调，关键时刻特别值钱。',
    description:
      '你属于关键时刻特别顶的人。你平时不一定最显眼，甚至有点懒得证明自己，但一到考试周、DDL 周、汇报周这种节点，整个人就会突然变得格外有吸引力。别人乱成一团的时候，你反而会显得稳、清醒、能救场。你像那种平时容易被低估，关键时刻会自动升值的人。问题是，你太像“限定款”了，很多人平时不珍惜，出事了才突然意识到你到底有多香。',
    color: '#B91C1C',
    bgColor: '#FFF0EF',
    imagePath: '/images/ti/quiz-crush.jpg',
    traits: ['关键时刻', '高可靠度', '结构感强', '低调实力'],
    emoji: '📚',
  },
  'campus-fox': {
    nameEn: 'campus-fox',
    nameCn: '校园活人',
    tagline: '你很会让人舒服，也很会让人多想。',
    description:
      '你身上有一种很自然的活人感。你不一定是最外向的，也不一定是最会整活的，但你大概率不是那种把场子聊死、把气氛冻住的人。你会接话，会来事，懂气氛，也知道什么时候该热闹一点，什么时候该收一点。和你相处通常不太费劲，因为你自然、不僵，也不装。问题是，你太会自然了，自然到别人有时候会分不清，你到底只是人好，还是对自己也有一点特别。',
    color: '#B45309',
    bgColor: '#FFFCE8',
    imagePath: '/images/ti/campus-fox.jpg',
    traits: ['高社交', '有活人感', '随性', '聊天高手'],
    emoji: '🦊',
  },
  'book-charm': {
    nameEn: 'book-charm',
    nameCn: '图书馆留白派',
    tagline: '你很有味道，但不太好读。',
    description:
      '你身上有一种很舒服的氛围感。你安静、克制、有留白，不吵、不炸、不抢镜，却很容易让人慢慢记住。你可能更偏爱舒服、自然、有空间感的相处方式，也更容易在书、电影、音乐、散步这些场景里找到自己的情绪坐标。你不是那种第一眼就很强烈的人，但会让人越品越上头。问题是，你这种人也很容易显得太淡、太慢、太不主动，别人一边想靠近，一边又总觉得自己像在猜。',
    color: '#475569',
    bgColor: '#EEF3F5',
    imagePath: '/images/ti/book-charm.jpg',
    traits: ['氛围感', '高保留度', '文艺', '安静磁场'],
    emoji: '📖',
  },
  'art-kid': {
    nameEn: 'art-kid',
    nameCn: '文艺青年',
    tagline: '你不是难懂，你只是活得太像限量版。',
    description:
      '你很有自己的世界。你不是单纯安静，而是脑子里一直有一套自己的审美、节奏和趣味系统。你会在意光线、天气、歌单、构图、句子，或者别的那些别人未必懂、但你觉得很重要的东西。你很容易让人觉得有风格、有味道，也有一点特别。问题是，你这种人有时候会显得太有自己那一套，外面的人想靠近你，得先学会读懂你的留白，也读懂你的怪点。',
    color: '#7C3AED',
    bgColor: '#F5F0FF',
    imagePath: '/images/ti/art-kid.jpg',
    traits: ['高审美', '有风格', '独特感', '创意世界'],
    emoji: '🎨',
  },
  'soft-spirit': {
    nameEn: 'soft-spirit',
    nameCn: '人间缓冲区',
    tagline: '你很适合依赖，也很容易被依赖过头。',
    description:
      '你很会让人放松。你给人的感觉很像一块低压缓冲垫，别人靠近你的时候，通常不会更紧绷，反而会慢慢松下来。你不一定话最多，也不一定表现欲最强，但你身上那种“不逼人、不拉扯、相处起来很舒服”的稳定感很少见。你很擅长接住别人的情绪，也很擅长把气氛放回一个让人安心的位置。问题是，你太会接住别人了，久了大家都在你这里软着陆，反而容易忘记你自己其实也会累。',
    color: '#92400E',
    bgColor: '#FAF5F3',
    imagePath: '/images/ti/soft-spirit.jpg',
    traits: ['高温暖', '舒服感', '情绪稳定', '安静包容'],
    emoji: '🌿',
  },
  'hidden-boss': {
    nameEn: 'hidden-boss',
    nameCn: '静音大佬',
    tagline: '不是没锋芒，是你懒得展示。',
    description:
      '你给人的感觉就是稳。你不抢镜，不抢话，也不太爱高调证明自己，但真正要做事的时候，别人往往会发现你比表面看起来更能打，也更有东西。你的存在感不是靠声量撑起来的，而是靠结果慢慢坐实的。你像那种一直压着没翻开的底牌，平时安静，关键时刻一亮相，就知道不是普通人。问题是，你太能藏了，导致很多人要到最后才意识到，你原来一直都在上面。',
    color: '#334155',
    bgColor: '#EEF2F4',
    imagePath: '/images/ti/hidden-boss.jpg',
    traits: ['静音输出', '高可靠', '稳定', '结果导向'],
    emoji: '🎯',
  },
  'sloth-mode': {
    nameEn: 'sloth-mode',
    nameCn: '树懒',
    tagline: '你不负责猛药治病，你负责陪人慢慢缓过来。',
    description:
      '你很会陪人把情绪放下来。你不是那种会催别人赶紧振作的人，你更像一个低功耗运行的树懒，情绪来了可以先接住，想说的话可以慢慢说，状态不好也不用急着装作没事。你不擅长制造很强的存在感，但很擅长给人一种“没关系，可以先歇一会儿”的安心。和你待在一起，很多人会慢慢从紧绷里松下来。问题是，你这种安慰方式太轻，也太慢了，急性子靠近你，可能会一边被你安抚到，一边又忍不住替你着急。',
    color: '#65A30D',
    bgColor: '#F1F8E9',
    imagePath: '/images/ti/sloth-mode.jpg',
    traits: ['低压陪伴', '柔软', '慢节奏', '安心感'],
    emoji: '🦥',
  },
  'you-know-who': {
    nameEn: 'you-know-who',
    nameCn: '你知道的那种',
    tagline: '不够典型，但很难代餐。',
    description:
      '你很自然，也很难替代。你不太像那种能被一句话精准概括的人，你可能不是最卷的，不是最吵的，不是最抓马的，也不是最极端的，但这不代表你没特点，反而说明你有一种很难被模板化的存在感。你身上很多东西都刚刚好，不会过头，也不容易被塞进某个特别明确的标签里。问题是，你不会一眼取胜，所以前期很容易被轻看，往往得相处久一点，别人才会慢慢发现你的后劲。',
    color: '#525252',
    bgColor: '#F5F5F5',
    imagePath: '/images/ti/you-know-who.jpg',
    traits: ['多元平衡', '弹性强', '难以定义', '中庸智慧'],
    emoji: '🌀',
  },
};

// ── Prototype vectors (spec §八) ─────────────────────────

type CoreAxes = Omit<FeatureVector, 'focus_aura' | 'conversational_pull' | 'clutch_reliability'>;

export const PROTOTYPES: Record<string, CoreAxes> = {
  'deadline-dancer': { drive: 56, structure: 24, social_energy: 68, warmth: 52, analytical: 34, reserved: 18, freeflow: 88, campus_play: 82, attachment: 38, aesthetic: 50 },
  'office-hour-angel': { drive: 64, structure: 62, social_energy: 58, warmth: 88, analytical: 80, reserved: 46, freeflow: 24, campus_play: 36, attachment: 64, aesthetic: 42 },
  'hot-nerd':     { drive: 88, structure: 76, social_energy: 42, warmth: 42, analytical: 88, reserved: 58, freeflow: 18, campus_play: 28, attachment: 32, aesthetic: 30 },
  'brain-bae':    { drive: 64, structure: 54, social_energy: 56, warmth: 58, analytical: 90, reserved: 42, freeflow: 28, campus_play: 32, attachment: 34, aesthetic: 42 },
  'lab-cutie':    { drive: 68, structure: 64, social_energy: 24, warmth: 54, analytical: 66, reserved: 86, freeflow: 24, campus_play: 14, attachment: 30, aesthetic: 44 },
  'quiz-crush':   { drive: 86, structure: 86, social_energy: 38, warmth: 46, analytical: 76, reserved: 60, freeflow: 12, campus_play: 18, attachment: 30, aesthetic: 24 },
  'campus-fox':   { drive: 54, structure: 34, social_energy: 86, warmth: 60, analytical: 40, reserved: 16, freeflow: 68, campus_play: 94, attachment: 42, aesthetic: 48 },
  'book-charm':   { drive: 42, structure: 50, social_energy: 18, warmth: 66, analytical: 46, reserved: 90, freeflow: 34, campus_play: 14, attachment: 36, aesthetic: 90 },
  'art-kid':      { drive: 46, structure: 38, social_energy: 30, warmth: 52, analytical: 44, reserved: 74, freeflow: 54, campus_play: 22, attachment: 36, aesthetic: 94 },
  'soft-spirit':  { drive: 36, structure: 42, social_energy: 30, warmth: 92, analytical: 34, reserved: 62, freeflow: 46, campus_play: 20, attachment: 58, aesthetic: 56 },
  'hidden-boss':  { drive: 76, structure: 72, social_energy: 26, warmth: 54, analytical: 66, reserved: 82, freeflow: 18, campus_play: 14, attachment: 26, aesthetic: 30 },
  'sloth-mode':   { drive: 22, structure: 26, social_energy: 28, warmth: 82, analytical: 30, reserved: 56, freeflow: 72, campus_play: 20, attachment: 52, aesthetic: 50 },
};

// ── Axis weights per personality (spec §九) ───────────────

type AxisKey = keyof CoreAxes;

export const PERSONALITY_WEIGHTS: Record<string, Partial<Record<AxisKey, number>>> = {
  'deadline-dancer': { freeflow: 0.22, campus_play: 0.18, social_energy: 0.14, structure: 0.12, drive: 0.10, aesthetic: 0.08, reserved: 0.06, warmth: 0.04, analytical: 0.03, attachment: 0.03 },
  'office-hour-angel': { warmth: 0.20, analytical: 0.18, structure: 0.12, social_energy: 0.10, attachment: 0.10, reserved: 0.08, drive: 0.08, freeflow: 0.06, campus_play: 0.04, aesthetic: 0.04 },
  'hot-nerd':    { drive: 0.20, analytical: 0.18, structure: 0.14, reserved: 0.08, social_energy: 0.06, campus_play: 0.05, warmth: 0.05, freeflow: 0.06, attachment: 0.05, aesthetic: 0.05 },
  'brain-bae':   { analytical: 0.18, social_energy: 0.10, warmth: 0.10, reserved: 0.06, aesthetic: 0.06, drive: 0.08, structure: 0.06, freeflow: 0.06, campus_play: 0.06, attachment: 0.06 },
  'lab-cutie':   { reserved: 0.20, structure: 0.12, drive: 0.10, analytical: 0.08, social_energy: 0.06, warmth: 0.06, freeflow: 0.06, campus_play: 0.06, attachment: 0.06, aesthetic: 0.06 },
  'quiz-crush':  { drive: 0.18, structure: 0.18, analytical: 0.08, reserved: 0.08, social_energy: 0.06, warmth: 0.06, freeflow: 0.06, campus_play: 0.06, attachment: 0.06, aesthetic: 0.06 },
  'campus-fox':  { campus_play: 0.24, social_energy: 0.20, freeflow: 0.14, warmth: 0.08, aesthetic: 0.06, drive: 0.04, structure: 0.04, analytical: 0.04, reserved: 0.04, attachment: 0.04 },
  'book-charm':  { aesthetic: 0.22, reserved: 0.20, warmth: 0.14, social_energy: 0.06, drive: 0.06, structure: 0.06, analytical: 0.06, freeflow: 0.06, campus_play: 0.06, attachment: 0.06 },
  'art-kid':     { aesthetic: 0.28, reserved: 0.16, freeflow: 0.10, warmth: 0.08, attachment: 0.08, drive: 0.06, structure: 0.06, analytical: 0.06, social_energy: 0.06, campus_play: 0.06 },
  'soft-spirit': { warmth: 0.24, reserved: 0.12, attachment: 0.10, social_energy: 0.08, aesthetic: 0.06, drive: 0.06, structure: 0.06, analytical: 0.06, freeflow: 0.06, campus_play: 0.06 },
  'hidden-boss': { drive: 0.16, reserved: 0.16, structure: 0.14, analytical: 0.08, social_energy: 0.06, warmth: 0.06, freeflow: 0.06, campus_play: 0.06, attachment: 0.06, aesthetic: 0.06 },
  'sloth-mode':  { warmth: 0.22, freeflow: 0.18, drive: 0.14, reserved: 0.10, attachment: 0.10, structure: 0.06, social_energy: 0.06, analytical: 0.06, campus_play: 0.06, aesthetic: 0.02 },
};

// ── Compatibility matrix ─────────────────────────────────
// 2-3 types that pair well with each type on the platform

export const COMPATIBLE_TYPES: Record<PersonalityType, PersonalityType[]> = {
  'hot-nerd':         ['brain-bae', 'lab-cutie', 'quiz-crush'],
  'brain-bae':        ['hot-nerd', 'soft-spirit', 'art-kid'],
  'lab-cutie':        ['hidden-boss', 'quiz-crush', 'book-charm'],
  'quiz-crush':       ['hot-nerd', 'office-hour-angel', 'lab-cutie'],
  'campus-fox':       ['soft-spirit', 'brain-bae', 'deadline-dancer'],
  'book-charm':       ['soft-spirit', 'art-kid', 'lab-cutie'],
  'art-kid':          ['book-charm', 'brain-bae', 'soft-spirit'],
  'soft-spirit':      ['campus-fox', 'brain-bae', 'sloth-mode'],
  'hidden-boss':      ['lab-cutie', 'office-hour-angel', 'quiz-crush'],
  'sloth-mode':       ['soft-spirit', 'you-know-who', 'campus-fox'],
  'deadline-dancer':  ['office-hour-angel', 'campus-fox', 'soft-spirit'],
  'office-hour-angel':['quiz-crush', 'hidden-boss', 'hot-nerd'],
  'you-know-who':     ['brain-bae', 'soft-spirit', 'campus-fox'],
};

// ── Test questions (curated, ~27 fixed + up to 5 conditional) ──

export type QuestionType = 'likert' | 'single_select' | 'multi_select';

export interface TestQuestion {
  id: string;
  type: QuestionType;
  text: string;
  scale?: { min: number; max: number; minLabel: string; maxLabel: string };
  options?: string[];
  optionLabels?: Record<string, string>;
  maxSelect?: number;
  section: string;
  sectionLabel: string;
  /** Show this question only if the given question has the given value in answers */
  dependsOn?: { questionId: string; value: string | string[] };
}

export const TEST_QUESTIONS: TestQuestion[] = [
  // ── Section 1: 行动风格 ─────────────────────────────────
  {
    id: 'q_work_style',
    type: 'likert',
    text: '我的做事风格更接近：',
    scale: { min: 1, max: 7, minLabel: '非常佛系', maxLabel: '非常上进' },
    section: 'action',
    sectionLabel: '行动风格',
  },
  {
    id: 'q38',
    type: 'likert',
    text: '我习惯做详尽的计划，非常不喜欢"说走就走"的突然改变：',
    scale: { min: 1, max: 7, minLabel: '完全不符合', maxLabel: '非常符合' },
    section: 'action',
    sectionLabel: '行动风格',
  },
  {
    id: 'q_schedule_imp',
    type: 'likert',
    text: '我对作息、日程规律性的重视程度：',
    scale: { min: 1, max: 7, minLabel: '完全不重视', maxLabel: '非常重视' },
    section: 'action',
    sectionLabel: '行动风格',
  },
  {
    id: 'q15',
    type: 'single_select',
    text: '我的作息习惯：',
    options: ['early_sleep_early_rise', 'early_sleep_late_rise', 'late_sleep_late_rise', 'late_sleep_early_rise'],
    optionLabels: {
      early_sleep_early_rise: '早睡早起',
      early_sleep_late_rise:  '早睡晚起',
      late_sleep_late_rise:   '晚睡晚起',
      late_sleep_early_rise:  '晚睡早起',
    },
    section: 'action',
    sectionLabel: '行动风格',
  },
  {
    id: 'q21',
    type: 'likert',
    text: '我是一个非常上进、目标导向的人：',
    scale: { min: 1, max: 7, minLabel: '完全不符合', maxLabel: '非常符合' },
    section: 'action',
    sectionLabel: '行动风格',
  },
  {
    id: 'q26',
    type: 'likert',
    text: '我愿意为了理想与热爱，放弃一部分物质舒适：',
    scale: { min: 1, max: 7, minLabel: '完全不符合', maxLabel: '非常符合' },
    section: 'action',
    sectionLabel: '行动风格',
  },
  {
    id: 'q37',
    type: 'likert',
    text: '我对生活/居住环境的整洁度要求：',
    scale: { min: 1, max: 7, minLabel: '完全不在意', maxLabel: '极高（有洁癖）' },
    section: 'action',
    sectionLabel: '行动风格',
  },

  // ── Section 2: 社交氛围 ─────────────────────────────────
  {
    id: 'q_atmosphere',
    type: 'single_select',
    text: '我更喜欢的相处氛围：',
    options: ['lively_talkative', 'mix_talk_quiet', 'quiet_comfy', 'depends_mood'],
    optionLabels: {
      lively_talkative: '活跃热闹，话多',
      mix_talk_quiet:   '有时聊、有时安静都行',
      quiet_comfy:      '安静舒适，不需要时刻说话',
      depends_mood:     '看心情，不固定',
    },
    section: 'social',
    sectionLabel: '社交氛围',
  },
  {
    id: 'q41',
    type: 'likert',
    text: '我每天需要独处时间的程度：',
    scale: { min: 1, max: 7, minLabel: '完全不需要', maxLabel: '非常需要' },
    section: 'social',
    sectionLabel: '社交氛围',
  },
  {
    id: 'q_reply_speed',
    type: 'single_select',
    text: '我的消息回复速度通常：',
    options: ['very_fast', 'normal', 'slow', 'depends_mood'],
    optionLabels: {
      very_fast:    '秒回，基本不拖',
      normal:       '正常速度，不超过几小时',
      slow:         '比较慢，可能半天才回',
      depends_mood: '看心情，不固定',
    },
    section: 'social',
    sectionLabel: '社交氛围',
  },
  {
    id: 'q_reply_pref',
    type: 'likert',
    text: '我对别人消息回复速度的期待：',
    scale: { min: 1, max: 7, minLabel: '有空再回就行', maxLabel: '希望非常及时' },
    section: 'social',
    sectionLabel: '社交氛围',
  },
  {
    id: 'q_free_time',
    type: 'multi_select',
    text: '我更常有空的时间（可多选）：',
    options: ['weekday_day', 'weekday_night', 'sat_day', 'sat_night', 'sun_day', 'sun_night'],
    optionLabels: {
      weekday_day:   '工作日白天',
      weekday_night: '工作日晚上',
      sat_day:       '周六白天',
      sat_night:     '周六晚上',
      sun_day:       '周日白天',
      sun_night:     '周日晚上',
    },
    section: 'social',
    sectionLabel: '社交氛围',
  },

  // ── Section 3: 思维方式 ─────────────────────────────────
  {
    id: 'q33',
    type: 'likert',
    text: '智商（聪明、有深度）比情商（会照顾人、提供情绪价值）更吸引我：',
    scale: { min: 1, max: 7, minLabel: '完全不符合', maxLabel: '非常符合' },
    section: 'mind',
    sectionLabel: '思维方式',
  },
  {
    id: 'q_support_pref',
    type: 'single_select',
    text: '我遇到挫折时，更希望对方：',
    options: ['emotional_support', 'analyze_problem', 'both', 'depends'],
    optionLabels: {
      emotional_support: '给我情绪支持，陪伴就好',
      analyze_problem:   '帮我分析问题，给具体建议',
      both:              '两者都需要',
      depends:           '看情况，不一定',
    },
    section: 'mind',
    sectionLabel: '思维方式',
  },
  {
    id: 'q25',
    type: 'likert',
    text: '在关键利益面前，善良比聪明更重要：',
    scale: { min: 1, max: 7, minLabel: '完全不符合', maxLabel: '非常符合' },
    section: 'mind',
    sectionLabel: '思维方式',
  },
  {
    id: 'q_conflict_self',
    type: 'single_select',
    text: '当发生矛盾时，我更接近：',
    options: ['talk_now', 'cool_then_talk', 'avoid_delay', 'depends'],
    optionLabels: {
      talk_now:       '当场说清楚，不拖',
      cool_then_talk: '先冷静，再沟通',
      avoid_delay:    '有点不想面对，往后拖',
      depends:        '看情况',
    },
    section: 'mind',
    sectionLabel: '思维方式',
  },

  // ── Section 4: 兴趣爱好 ─────────────────────────────────
  {
    id: 'q8',
    type: 'multi_select',
    text: '我的核心兴趣爱好（限选 4 项）：',
    options: [
      'gym_fitness', 'running_outdoor', 'ball_sports', 'swimming_dance',
      'movies_series', 'gaming', 'anime_acg', 'boardgame_larp',
      'photo_exhibitions', 'reading_writing', 'fiction_fanfic',
      'food_exploring', 'travel_citywalk', 'music_listening', 'live_show',
      'pets', 'programming_geek', 'finance_business', 'other_interest',
    ],
    optionLabels: {
      gym_fitness: '健身', running_outdoor: '徒步户外', ball_sports: '球类运动',
      swimming_dance: '游泳舞蹈', movies_series: '电影剧集', gaming: '游戏',
      anime_acg: '动漫二次元', boardgame_larp: '桌游剧本杀',
      photo_exhibitions: '摄影看展', reading_writing: '阅读写作', fiction_fanfic: '小说同人',
      food_exploring: '探店/美食', travel_citywalk: '旅行 CityWalk',
      music_listening: '听歌/音乐', live_show: 'Live/演出',
      pets: '宠物', programming_geek: '编程极客',
      finance_business: '金融商业', other_interest: '其他',
    },
    maxSelect: 4,
    section: 'interests',
    sectionLabel: '兴趣爱好',
  },
  // Conditional: travel style
  {
    id: 'q_tr_style',
    type: 'single_select',
    text: '出去玩的时候，我更倾向：',
    options: ['detailed_plan', 'rough_plan', 'totally_random'],
    optionLabels: {
      detailed_plan:  '提前做好详细攻略',
      rough_plan:     '大概定个方向就行',
      totally_random: '完全随机，走到哪算哪',
    },
    section: 'interests',
    sectionLabel: '兴趣爱好',
    dependsOn: { questionId: 'q8', value: 'travel_citywalk' },
  },
  // Conditional: reading type
  {
    id: 'q_read_type',
    type: 'multi_select',
    text: '最近喜欢看的书籍品类（最多选 3 项）：',
    options: ['lit_fiction', 'sci_fi_fantasy', 'history_bio', 'philosophy_social', 'science_tech', 'business_econ', 'poetry_essay', 'comics_picture_book'],
    optionLabels: {
      lit_fiction: '文学/小说', sci_fi_fantasy: '科幻/奇幻', history_bio: '历史/传记',
      philosophy_social: '哲学/社科', science_tech: '科技/学术', business_econ: '商业/经济',
      poetry_essay: '诗歌/散文', comics_picture_book: '漫画/绘本',
    },
    maxSelect: 3,
    section: 'interests',
    sectionLabel: '兴趣爱好',
    dependsOn: { questionId: 'q8', value: 'reading_writing' },
  },
  {
    id: 'q_date_content',
    type: 'multi_select',
    text: '我理想中的约会内容（最多选 3 项）：',
    options: ['eat_explore', 'walk_citywalk', 'movie_series', 'sports', 'gaming', 'exhibition_photo', 'study', 'live_concert', 'travel_nearby', 'just_chat'],
    optionLabels: {
      eat_explore: '吃饭探店', walk_citywalk: '散步 CityWalk', movie_series: '看电影/追剧',
      sports: '运动', gaming: '打游戏', exhibition_photo: '看展拍照',
      study: '一起学习/自习', live_concert: 'Live/演唱会', travel_nearby: '周边游', just_chat: '纯聊天',
    },
    maxSelect: 3,
    section: 'interests',
    sectionLabel: '兴趣爱好',
  },
  {
    id: 'q_weekend_date',
    type: 'single_select',
    text: '周末出行时，我更倾向：',
    options: ['campus_fine', 'both_ok', 'prefer_outside'],
    optionLabels: {
      campus_fine:    '就在校园附近活动，不爱出门',
      both_ok:        '校内校外都行',
      prefer_outside: '更喜欢出去逛/探索',
    },
    section: 'interests',
    sectionLabel: '兴趣爱好',
  },

  // ── Section 5: 价值观 ──────────────────────────────────
  {
    id: 'q27',
    type: 'likert',
    text: '相比事业优先，我更看重关系与生活幸福感：',
    scale: { min: 1, max: 7, minLabel: '完全不符合', maxLabel: '非常符合' },
    section: 'values',
    sectionLabel: '价值观',
  },
  {
    id: 'q29',
    type: 'multi_select',
    text: '我自己更接近哪些品质（限选 4 项）：',
    options: ['kindness', 'honesty', 'loyalty', 'integrity', 'self_discipline', 'ambition', 'independence', 'curiosity', 'creativity', 'family', 'freedom', 'friendship', 'fairness', 'courage', 'adventure', 'faith'],
    optionLabels: {
      kindness: '善良', honesty: '诚实', loyalty: '忠诚', integrity: '正直',
      self_discipline: '自律', ambition: '上进心', independence: '独立',
      curiosity: '好奇心', creativity: '创造力', family: '家庭感', freedom: '自由',
      friendship: '朋友情', fairness: '公平', courage: '勇气', adventure: '冒险', faith: '信念',
    },
    maxSelect: 4,
    section: 'values',
    sectionLabel: '价值观',
  },
  {
    id: 'q_partner_qualities',
    type: 'multi_select',
    text: '我最看重对方具备哪些品质（限选 4 项）：',
    options: ['kindness', 'honesty', 'loyalty', 'integrity', 'self_discipline', 'ambition', 'independence', 'curiosity', 'creativity', 'family', 'freedom', 'friendship', 'fairness', 'courage', 'adventure', 'faith'],
    optionLabels: {
      kindness: '善良', honesty: '诚实', loyalty: '忠诚', integrity: '正直',
      self_discipline: '自律', ambition: '上进心', independence: '独立',
      curiosity: '好奇心', creativity: '创造力', family: '家庭感', freedom: '自由',
      friendship: '朋友情', fairness: '公平', courage: '勇气', adventure: '冒险', faith: '信念',
    },
    maxSelect: 4,
    section: 'values',
    sectionLabel: '价值观',
  },
  {
    id: 'q_spend_style',
    type: 'single_select',
    text: '消费时，我更愿意把钱花在：',
    options: ['experience', 'material', 'balanced'],
    optionLabels: {
      experience: '体验和经历（旅行、演出、美食等）',
      material:   '实物和物品',
      balanced:   '都有，比较均衡',
    },
    section: 'values',
    sectionLabel: '价值观',
  },
  {
    id: 'q30',
    type: 'likert',
    text: '物质财富的积累比精神上的共鸣更重要：',
    scale: { min: 1, max: 7, minLabel: '完全不符合', maxLabel: '非常符合' },
    section: 'values',
    sectionLabel: '价值观',
  },
];

// ── Axis labels for display ────────────────────────────────

export const AXIS_LABELS: Record<keyof CoreAxes, string> = {
  drive:        '驱动力',
  structure:    '计划感',
  social_energy:'社交力',
  warmth:       '温暖度',
  analytical:   '理性感',
  reserved:     '独处需求',
  freeflow:     '随性感',
  campus_play:  '活人感',
  attachment:   '亲密需求',
  aesthetic:    '氛围感',
};

// ── localStorage keys ─────────────────────────────────────

export const STORAGE_KEY_RESULT  = 'njuSbtiResult';
export const STORAGE_KEY_ANSWERS = 'njuSbtiAnswers';
/** Same draft key used by main Survey page so answers can be pre-filled */
export const STORAGE_KEY_SURVEY_DRAFT = 'surveyDraft';
