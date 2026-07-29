/**
 * 预设圈子种子数据（含 B卡组件）
 * 运行方式：npm run seed:circles
 * 幂等：基于 slug 唯一约束，已存在的圈子会跳过（含组件）
 */

import 'dotenv/config';
import { queryClient } from './connection.js';

interface ComponentSeed {
  key: string;
  type: 'scale' | 'single_choice' | 'multi_choice' | 'ranking';
  prompt: string;
  options?: string[];
  isChannelTag?: boolean;
  displayOrder?: number;
}

interface CircleSeed {
  name: string;
  slug: string;
  description: string;
  category: string;
  tags: string[];
  components: ComponentSeed[];
}

// ─── 复用的组件片段 ─────────────────────────────────────────────

const PLAY_TIME: ComponentSeed = {
  key: 'play_time',
  type: 'multi_choice',
  prompt: '常在线时段',
  options: ['工作日白天', '工作日傍晚', '工作日深夜', '周末全天'],
  isChannelTag: false,
};

const GAME_FREQ: ComponentSeed = {
  key: 'game_freq',
  type: 'single_choice',
  prompt: '游戏频率',
  options: ['偶尔玩玩', '每周1-2次', '几乎每天'],
  isChannelTag: false,
};

// ═══════════════════════════════════════════════════════════════
// 游戏类
// ═══════════════════════════════════════════════════════════════

const GAME_CIRCLES: CircleSeed[] = [
  // ── 手游 ─────────────────────────────────────────────────────
  {
    name: '王者荣耀圈',
    slug: 'honor-of-kings',
    description: '王者荣耀玩家聚集地，找搭子、组排位、交流攻略。',
    category: 'game',
    tags: ['手游', 'MOBA', '王者'],
    components: [
      {
        key: 'rank',
        type: 'single_choice',
        prompt: '我的段位',
        options: ['青铜/白银', '黄金', '铂金', '钻石', '星耀', '王者', '荣耀', '巅峰'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'role',
        type: 'multi_choice',
        prompt: '常用位置',
        options: ['上单', '打野', '中单', '射手', '辅助', '不固定'],
        isChannelTag: true,
        displayOrder: 1,
      },
      { ...PLAY_TIME, displayOrder: 2 },
    ],
  },
  {
    name: '蛋仔派对圈',
    slug: 'eggy-party',
    description: '蛋仔派对休闲玩家，一起跑图、联机开黑。',
    category: 'game',
    tags: ['手游', '休闲', '派对'],
    components: [
      {
        key: 'style',
        type: 'multi_choice',
        prompt: '主要玩法',
        options: ['跑图地图', '自制地图', '派对对战', '活动限时', '都玩'],
        isChannelTag: true,
        displayOrder: 0,
      },
      { ...GAME_FREQ, displayOrder: 1 },
      { ...PLAY_TIME, displayOrder: 2 },
    ],
  },
  {
    name: '原神圈',
    slug: 'genshin-impact',
    description: '原神旅行者集合！聊剧情、讨论攻略、分享角色。',
    category: 'game',
    tags: ['手游', '开放世界', '原神'],
    components: [
      {
        key: 'ar',
        type: 'single_choice',
        prompt: '冒险等级',
        options: ['AR1-45（新手）', 'AR45-55（进阶）', 'AR55+（深度玩家）'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'goal',
        type: 'multi_choice',
        prompt: '主要玩法',
        options: ['追剧情', '角色收集/满命', '刷深境螺旋', '成就党', '家园建设'],
        isChannelTag: false,
        displayOrder: 1,
      },
      {
        key: 'faction',
        type: 'single_choice',
        prompt: '最喜欢的国度',
        options: ['蒙德', '璃月', '稻妻', '须弥', '枫丹', '纳塔', '都喜欢'],
        isChannelTag: false,
        displayOrder: 2,
      },
    ],
  },
  {
    name: '崩坏星穹铁道圈',
    slug: 'honkai-star-rail',
    description: '星穹列车开拔，和同行者们一起聊角色、刷混沌回忆。',
    category: 'game',
    tags: ['手游', '回合制', '崩铁'],
    components: [
      {
        key: 'level',
        type: 'single_choice',
        prompt: '开拓等级',
        options: ['60级以下（新手）', '60-70级', '70级+（深度玩家）'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'goal',
        type: 'multi_choice',
        prompt: '主要玩法',
        options: ['追剧情', '角色收集/满命', '混沌回忆', '虚构叙事', '成就党'],
        isChannelTag: false,
        displayOrder: 1,
      },
      {
        key: 'style',
        type: 'single_choice',
        prompt: '搭队风格',
        options: ['追求强度', '角色爱好者优先', '随心所欲'],
        isChannelTag: false,
        displayOrder: 2,
      },
    ],
  },
  {
    name: '鸣潮圈',
    slug: 'wuthering-waves',
    description: '共鸣者召集令，探索鸣潮世界，交流声骸和攻略。',
    category: 'game',
    tags: ['手游', '开放世界', '鸣潮'],
    components: [
      {
        key: 'level',
        type: 'single_choice',
        prompt: '共鸣等级',
        options: ['50级以下（新手）', '50-70级', '70级+（深度玩家）'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'goal',
        type: 'multi_choice',
        prompt: '主要玩法',
        options: ['追剧情', '角色收集', '深塔挑战', '全地图探索', '成就党'],
        isChannelTag: false,
        displayOrder: 1,
      },
    ],
  },
  {
    name: '明日方舟圈',
    slug: 'arknights',
    description: '罗德岛医疗，博士们一起讨论剧情、分享干员。',
    category: 'game',
    tags: ['手游', '策略', '明日方舟'],
    components: [
      {
        key: 'level',
        type: 'single_choice',
        prompt: '博士水平',
        options: ['新手入坑', '三星/四星清图', '六星刷满', '数值硬核党'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'focus',
        type: 'multi_choice',
        prompt: '主要方向',
        options: ['追剧情/活动', '干员收集', '理智刷材料', '打危机合约'],
        isChannelTag: false,
        displayOrder: 1,
      },
    ],
  },
  {
    name: '第五人格圈',
    slug: 'identity-v',
    description: '第五人格玩家圈，监管者/求生者都欢迎，组队开黑。',
    category: 'game',
    tags: ['手游', '非对称对抗', '第五人格'],
    components: [
      {
        key: 'role',
        type: 'single_choice',
        prompt: '主玩角色',
        options: ['监管者', '求生者', '两者都玩'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'rank',
        type: 'single_choice',
        prompt: '段位',
        options: ['白板/普通段位', 'S段', 'S+/顶尖段位'],
        isChannelTag: true,
        displayOrder: 1,
      },
      { ...PLAY_TIME, displayOrder: 2 },
    ],
  },
  {
    name: '金铲铲之战圈',
    slug: 'tft',
    description: '云顶之弈/金铲铲玩家，交流阵容羁绊，一起上分。',
    category: 'game',
    tags: ['手游', '自走棋', 'TFT'],
    components: [
      {
        key: 'rank',
        type: 'single_choice',
        prompt: '段位区间',
        options: ['黄金及以下', '铂金/钻石', '大师/宗师/王者'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'style',
        type: 'single_choice',
        prompt: '游戏风格',
        options: ['稳健型（等好牌）', '激进型（快节奏）', '随机应变'],
        isChannelTag: false,
        displayOrder: 1,
      },
      { ...GAME_FREQ, displayOrder: 2 },
    ],
  },

  // ── PC端 ──────────────────────────────────────────────────────
  {
    name: '英雄联盟圈',
    slug: 'league-of-legends',
    description: 'LOL玩家的家，找人双排、讨论版本、看LPL。',
    category: 'game',
    tags: ['PC', 'MOBA', 'LOL'],
    components: [
      {
        key: 'rank',
        type: 'single_choice',
        prompt: '我的段位',
        options: ['铁/铜/银', '黄金', '铂金', '翠玉', '钻石', '大师/宗师', '挑战者'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'role',
        type: 'multi_choice',
        prompt: '常用位置',
        options: ['上路', '打野', '中路', 'ADC', '辅助', '不固定'],
        isChannelTag: true,
        displayOrder: 1,
      },
      { ...PLAY_TIME, displayOrder: 2 },
    ],
  },
  {
    name: 'Valorant圈',
    slug: 'valorant',
    description: 'Valorant玩家聚集，一起打排位、分享Agent技巧。',
    category: 'game',
    tags: ['PC', 'FPS', 'Valorant'],
    components: [
      {
        key: 'rank',
        type: 'single_choice',
        prompt: '段位区间',
        options: ['未定级', '铁/铜/银', '金牌/铂金', '钻石/上尉', '不朽/辐射'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'agent_type',
        type: 'multi_choice',
        prompt: '常用特工类型',
        options: ['决斗者', '哨兵', '启动者', '控制者', '不固定'],
        isChannelTag: true,
        displayOrder: 1,
      },
      { ...PLAY_TIME, displayOrder: 2 },
    ],
  },
  {
    name: '守望先锋圈',
    slug: 'overwatch',
    description: '守望先锋玩家集结，找车队、练配合、聊版本和英雄池。',
    category: 'game',
    tags: ['PC', '英雄射击', '守望先锋'],
    components: [
      {
        key: 'rank',
        type: 'single_choice',
        prompt: '竞技段位',
        options: ['主要玩快速/街机', '青铜/白银/黄金', '白金/钻石', '大师及以上'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'role',
        type: 'multi_choice',
        prompt: '常玩职责',
        options: ['重装', '输出', '支援', '补位/都玩'],
        isChannelTag: true,
        displayOrder: 1,
      },
      { ...PLAY_TIME, displayOrder: 2 },
    ],
  },
  {
    name: '三角洲行动圈',
    slug: 'delta-force',
    description: '三角洲行动玩家，找队友、讨论战术和装备搭配。',
    category: 'game',
    tags: ['PC', 'FPS', '三角洲'],
    components: [
      {
        key: 'level',
        type: 'single_choice',
        prompt: '游戏水平',
        options: ['新手入坑', '普通玩家', '进阶玩家', '硬核老兵'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'mode',
        type: 'multi_choice',
        prompt: '偏好玩法',
        options: ['要素提取', '大逃杀', '合作任务', '排位竞技'],
        isChannelTag: true,
        displayOrder: 1,
      },
      { ...PLAY_TIME, displayOrder: 2 },
    ],
  },
  {
    name: '漫威争锋圈',
    slug: 'marvel-rivals',
    description: '漫威争锋英雄玩家，组队竞技、交流英雄玩法。',
    category: 'game',
    tags: ['PC', '射击', '漫威'],
    components: [
      {
        key: 'rank',
        type: 'single_choice',
        prompt: '段位区间',
        options: ['青铜/白银', '黄金/铂金', '钻石/大师', '竞技者/宇宙'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'role',
        type: 'multi_choice',
        prompt: '常用英雄类型',
        options: ['先锋（坦克）', '决斗者（输出）', '战略家（辅助）', '不固定'],
        isChannelTag: true,
        displayOrder: 1,
      },
      { ...PLAY_TIME, displayOrder: 2 },
    ],
  },
  {
    name: 'CS2圈',
    slug: 'cs2',
    description: 'CS2玩家集结，组队打排位、分享枪法和战术。',
    category: 'game',
    tags: ['PC', 'FPS', 'CS'],
    components: [
      {
        key: 'rank',
        type: 'single_choice',
        prompt: '段位区间',
        options: ['白银/金星', '老鹰/大师老鹰', 'GE/全球精英', 'Premier模式'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'style',
        type: 'single_choice',
        prompt: '游戏风格',
        options: ['进攻型', '防守型', '均衡型', '随机应变'],
        isChannelTag: false,
        displayOrder: 1,
      },
      { ...PLAY_TIME, displayOrder: 2 },
    ],
  },
  {
    name: 'Apex英雄圈',
    slug: 'apex-legends',
    description: 'Apex英雄玩家，找搭子、聊英雄技能、分享操作。',
    category: 'game',
    tags: ['PC', 'FPS', 'Apex'],
    components: [
      {
        key: 'rank',
        type: 'single_choice',
        prompt: '段位区间',
        options: ['新手/青铜', '白银/黄金', '铂金/钻石', '大师/猎杀者'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'legend_type',
        type: 'multi_choice',
        prompt: '常用传奇类型',
        options: ['进攻型', '防卫型', '侦察型', '辅助型', '不固定'],
        isChannelTag: false,
        displayOrder: 1,
      },
      { ...PLAY_TIME, displayOrder: 2 },
    ],
  },
  {
    name: 'Minecraft圈',
    slug: 'minecraft',
    description: '我的世界创造者，建筑、生存、红石，欢迎所有MC人。',
    category: 'game',
    tags: ['PC', '沙盒', 'MC'],
    components: [
      {
        key: 'mode',
        type: 'multi_choice',
        prompt: '常玩模式',
        options: ['原版生存', '创造建筑', '模组整合包', '联机服务器', '地图/小游戏'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'build_style',
        type: 'single_choice',
        prompt: '建筑风格偏好',
        options: ['像素/平铺', '中世纪', '现代简约', '幻想/科幻', '不太建筑'],
        isChannelTag: false,
        displayOrder: 1,
      },
    ],
  },
  {
    name: 'Dota2圈',
    slug: 'dota2',
    description: 'Dota2玩家，老DotA人和新玩家都欢迎，一起开黑。',
    category: 'game',
    tags: ['PC', 'MOBA', 'Dota'],
    components: [
      {
        key: 'rank',
        type: 'single_choice',
        prompt: '段位区间',
        options: ['先锋/卫士', '中锋/古典', '传说/神话', '不朽及以上'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'role',
        type: 'single_choice',
        prompt: '常用位置',
        options: ['一号位（核心）', '二号位（半核）', '三号位（大哥）', '四号位', '五号位', '不固定'],
        isChannelTag: true,
        displayOrder: 1,
      },
      { ...PLAY_TIME, displayOrder: 2 },
    ],
  },
  {
    name: '洛克王国：世界圈',
    slug: 'rock-kingdom-world',
    description: '关注洛克王国：世界的玩家集合，一起聊精灵养成、开放世界探索和版本攻略。',
    category: 'game',
    tags: ['开放世界', '精灵养成', '洛克王国：世界'],
    components: [
      {
        key: 'status',
        type: 'single_choice',
        prompt: '当前状态',
        options: ['刚入坑探索', '稳定在玩', '回流补进度', '持续关注版本更新'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'focus',
        type: 'multi_choice',
        prompt: '主要关注点',
        options: ['精灵收集/养成', '开放世界探索', '阵容搭配/战斗', '剧情设定', '攻略与版本资讯'],
        isChannelTag: true,
        displayOrder: 1,
      },
      { ...GAME_FREQ, displayOrder: 2 },
    ],
  },

  // ── 主机/Switch ───────────────────────────────────────────────
  {
    name: '塞尔达传说圈',
    slug: 'zelda',
    description: '塞尔达系列粉丝，讨论剧情、地图探索和解谜心得。',
    category: 'game',
    tags: ['主机', 'Switch', '塞尔达'],
    components: [
      {
        key: 'titles',
        type: 'multi_choice',
        prompt: '玩过的作品',
        options: ['旷野之息', '王国之泪', '织梦岛', '时之笛', '梅祖拉的假面', '风之杖', '其他系列'],
        isChannelTag: false,
        displayOrder: 0,
      },
      {
        key: 'style',
        type: 'single_choice',
        prompt: '游戏风格',
        options: ['主线优先', '支线/神庙全收集', '全成就党', '随心所欲'],
        isChannelTag: true,
        displayOrder: 1,
      },
    ],
  },
  {
    name: '动物森友会圈',
    slug: 'animal-crossing',
    description: '动森小屋开放中，交流岛屿设计、分享家具和花艺。',
    category: 'game',
    tags: ['主机', 'Switch', '动森'],
    components: [
      {
        key: 'status',
        type: 'single_choice',
        prompt: '玩了多久',
        options: ['刚开始', '半年以内', '一年以上', '老玩家'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'focus',
        type: 'multi_choice',
        prompt: '主要玩法',
        options: ['岛屿设计/装饰', '化石/博物馆', '收集家具/时装', '摆摊/串岛', '和朋友一起玩'],
        isChannelTag: false,
        displayOrder: 1,
      },
    ],
  },
  {
    name: '宝可梦圈',
    slug: 'pokemon',
    description: '精灵训练师聚集地，对战、交换、集邮、二创都欢迎。',
    category: 'game',
    tags: ['主机', 'Switch', '宝可梦'],
    components: [
      {
        key: 'series',
        type: 'multi_choice',
        prompt: '玩过的系列',
        options: ['朱/紫', '剑/盾', '钻石/珍珠复刻', 'Pokemon GO', 'LEGENDS', '其他经典系列'],
        isChannelTag: false,
        displayOrder: 0,
      },
      {
        key: 'style',
        type: 'single_choice',
        prompt: '主要玩法',
        options: ['收集图鉴/全国图鉴', '对战竞技', '剧情通关', '图鉴+对战都做'],
        isChannelTag: true,
        displayOrder: 1,
      },
    ],
  },

  // ── 线下游戏 ──────────────────────────────────────────────────
  {
    name: '桌游圈',
    slug: 'board-game',
    description: '桌游爱好者，狼人杀、德式策略、派对游戏都欢迎。',
    category: 'game',
    tags: ['线下', '桌游', '休闲'],
    components: [
      {
        key: 'type',
        type: 'multi_choice',
        prompt: '偏好游戏类型',
        options: ['狼人杀/阿瓦隆', '派对桌游', '德式策略', '推理侦探', '卡牌游戏'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'freq',
        type: 'single_choice',
        prompt: '游戏频率',
        options: ['偶尔玩', '每周一次左右', '每周多次'],
        isChannelTag: false,
        displayOrder: 1,
      },
    ],
  },
  {
    name: '剧本杀圈',
    slug: 'murder-mystery',
    description: '剧本杀玩家，寻找搭子、推荐好本、沉浸体验。',
    category: 'game',
    tags: ['线下', '剧本杀', '推理'],
    components: [
      {
        key: 'style',
        type: 'multi_choice',
        prompt: '偏好本类型',
        options: ['恐怖惊悚', '情感向', '推理硬核', '阵营对抗', '历史还原', '欢乐搞笑'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'freq',
        type: 'single_choice',
        prompt: '游戏频率',
        options: ['偶尔玩', '每月1-2次', '每周都玩'],
        isChannelTag: true,
        displayOrder: 1,
      },
    ],
  },
  {
    name: '密室逃脱圈',
    slug: 'escape-room',
    description: '密室爱好者，一起挑战各种主题密室，分享通关心得。',
    category: 'game',
    tags: ['线下', '密室', '解谜'],
    components: [
      {
        key: 'difficulty',
        type: 'single_choice',
        prompt: '挑战难度偏好',
        options: ['萌新向/剧情体验', '普通难度', '硬核解谜'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'theme',
        type: 'multi_choice',
        prompt: '偏好主题',
        options: ['科幻', '恐怖', '推理/侦探', '古风', '奇幻'],
        isChannelTag: false,
        displayOrder: 1,
      },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// 运动类
// ═══════════════════════════════════════════════════════════════

const SPORTS_CIRCLES: CircleSeed[] = [
  {
    name: '跑步圈',
    slug: 'running',
    description: '跑步爱好者，约跑、分享路线、讨论装备和训练计划。',
    category: 'sports',
    tags: ['跑步', '户外', '健康'],
    components: [
      {
        key: 'freq',
        type: 'single_choice',
        prompt: '跑步频率',
        options: ['偶尔跑', '每周1-2次', '每周3次以上', '几乎每天'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'distance',
        type: 'single_choice',
        prompt: '常规跑步距离',
        options: ['3km以内', '3-5km', '5-10km', '10km以上'],
        isChannelTag: true,
        displayOrder: 1,
      },
      {
        key: 'time',
        type: 'multi_choice',
        prompt: '常跑时段',
        options: ['早晨', '午间', '傍晚', '夜跑'],
        isChannelTag: false,
        displayOrder: 2,
      },
    ],
  },
  {
    name: '健身圈',
    slug: 'fitness',
    description: '健身爱好者，力量训练、体型管理、互相督促打卡。',
    category: 'sports',
    tags: ['健身', '力量训练', '塑形'],
    components: [
      {
        key: 'freq',
        type: 'single_choice',
        prompt: '健身频率',
        options: ['偶尔', '每周1-2次', '每周3-4次', '几乎每天'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'goal',
        type: 'multi_choice',
        prompt: '健身目标',
        options: ['增肌', '减脂', '塑形', '提升体能', '保持健康'],
        isChannelTag: true,
        displayOrder: 1,
      },
      {
        key: 'type',
        type: 'multi_choice',
        prompt: '训练类型',
        options: ['力量/器械', '有氧运动', '功能性训练', '综合交叉训练'],
        isChannelTag: false,
        displayOrder: 2,
      },
    ],
  },
  {
    name: '羽毛球圈',
    slug: 'badminton',
    description: '羽毛球爱好者，约球、找搭子、分享技巧和装备。',
    category: 'sports',
    tags: ['羽毛球', '球类', '约球'],
    components: [
      {
        key: 'level',
        type: 'single_choice',
        prompt: '技术水平',
        options: ['零基础/初学', '会打但一般', '进阶选手', '较专业'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'freq',
        type: 'single_choice',
        prompt: '约球频率',
        options: ['偶尔', '每周1-2次', '每周3次以上'],
        isChannelTag: false,
        displayOrder: 1,
      },
      {
        key: 'time',
        type: 'multi_choice',
        prompt: '常约球时段',
        options: ['上午', '下午', '傍晚', '夜间'],
        isChannelTag: false,
        displayOrder: 2,
      },
    ],
  },
  {
    name: '篮球圈',
    slug: 'basketball',
    description: '篮球爱好者，约场次、聊NBA/CBA、切磋球技。',
    category: 'sports',
    tags: ['篮球', '球类', '约球'],
    components: [
      {
        key: 'level',
        type: 'single_choice',
        prompt: '技术水平',
        options: ['新手', '普通', '进阶', '高手'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'position',
        type: 'single_choice',
        prompt: '常打位置',
        options: ['控球后卫', '得分后卫', '小前锋', '大前锋', '中锋', '不固定'],
        isChannelTag: true,
        displayOrder: 1,
      },
      {
        key: 'time',
        type: 'multi_choice',
        prompt: '常约球时段',
        options: ['上午', '下午', '傍晚', '夜间'],
        isChannelTag: false,
        displayOrder: 2,
      },
    ],
  },
  {
    name: '乒乓球圈',
    slug: 'table-tennis',
    description: '乒乓球爱好者，约打、讨论技术、国球文化交流。',
    category: 'sports',
    tags: ['乒乓球', '球类', '约球'],
    components: [
      {
        key: 'level',
        type: 'single_choice',
        prompt: '技术水平',
        options: ['新手', '普通', '进阶', '较专业'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'style',
        type: 'single_choice',
        prompt: '技术风格',
        options: ['弧旋为主', '快攻为主', '均衡型', '还在练基本功'],
        isChannelTag: false,
        displayOrder: 1,
      },
    ],
  },
  {
    name: '足球圈',
    slug: 'football',
    description: '足球爱好者，踢野球、约场次、聊联赛赛事。',
    category: 'sports',
    tags: ['足球', '球类', '约球'],
    components: [
      {
        key: 'position',
        type: 'single_choice',
        prompt: '常打位置',
        options: ['前锋', '中场', '后卫', '门将', '不固定'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'level',
        type: 'single_choice',
        prompt: '技术水平',
        options: ['新手', '普通', '进阶', '高手'],
        isChannelTag: false,
        displayOrder: 1,
      },
    ],
  },
  {
    name: '骑行圈',
    slug: 'cycling',
    description: '骑行爱好者，约骑、分享路线、讨论车和装备。',
    category: 'sports',
    tags: ['骑行', '户外', '单车'],
    components: [
      {
        key: 'bike_type',
        type: 'single_choice',
        prompt: '骑行类型',
        options: ['公路车', '山地车', '通勤/折叠车', '不固定'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'distance',
        type: 'single_choice',
        prompt: '常规骑行距离',
        options: ['10km以内', '10-30km', '30-50km', '50km以上'],
        isChannelTag: true,
        displayOrder: 1,
      },
      {
        key: 'freq',
        type: 'single_choice',
        prompt: '骑行频率',
        options: ['偶尔', '每周1-2次', '每周3次以上'],
        isChannelTag: false,
        displayOrder: 2,
      },
    ],
  },
  {
    name: '瑜伽/普拉提圈',
    slug: 'yoga-pilates',
    description: '瑜伽和普拉提爱好者，分享体式、打卡健康生活。',
    category: 'sports',
    tags: ['瑜伽', '普拉提', '健康'],
    components: [
      {
        key: 'level',
        type: 'single_choice',
        prompt: '练习水平',
        options: ['初学者', '有一定基础', '进阶', '长期练习者'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'type',
        type: 'multi_choice',
        prompt: '偏好类型',
        options: ['哈他瑜伽', '流瑜伽', '阴瑜伽', '普拉提', '冥想'],
        isChannelTag: false,
        displayOrder: 1,
      },
    ],
  },
  {
    name: '徒步露营圈',
    slug: 'hiking-camping',
    description: '户外爱好者，约徒步、露营、探山，分享大自然。',
    category: 'sports',
    tags: ['徒步', '露营', '户外'],
    components: [
      {
        key: 'style',
        type: 'multi_choice',
        prompt: '偏好方式',
        options: ['日间徒步', '多日穿越', '露营', '登山', '都喜欢'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'level',
        type: 'single_choice',
        prompt: '体能水平',
        options: ['轻量级路线', '中等难度', '高难度挑战'],
        isChannelTag: false,
        displayOrder: 1,
      },
    ],
  },
  {
    name: '游泳圈',
    slug: 'swimming',
    description: '游泳爱好者，约泳、分享技巧、互相监督训练。',
    category: 'sports',
    tags: ['游泳', '水上', '健康'],
    components: [
      {
        key: 'level',
        type: 'single_choice',
        prompt: '游泳水平',
        options: ['初学/会游但一般', '进阶', '较专业'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'stroke',
        type: 'multi_choice',
        prompt: '常用泳姿',
        options: ['自由泳', '蛙泳', '仰泳', '蝶泳', '不固定'],
        isChannelTag: false,
        displayOrder: 1,
      },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// 动漫/二次元类
// 说明：动漫圈为综合圈，国漫圈面向专注国产动漫的用户，两者定位不同
// ═══════════════════════════════════════════════════════════════

const ANIME_CIRCLES: CircleSeed[] = [
  {
    name: '动漫圈',
    slug: 'anime',
    description: '动漫爱好者综合圈，日漫国漫都欢迎，聊番、追番、推番。',
    category: 'anime',
    tags: ['动漫', '日漫', '二次元'],
    components: [
      {
        key: 'genre',
        type: 'multi_choice',
        prompt: '偏好题材',
        options: ['热血/少年漫', '恋爱/治愈', '科幻/奇幻', '悬疑/推理', '日常/萌系', '都看'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'watching_style',
        type: 'single_choice',
        prompt: '追番习惯',
        options: ['新番必追', '选择性追', '攒番一起看', '补旧番为主'],
        isChannelTag: false,
        displayOrder: 1,
      },
    ],
  },
  {
    name: '国漫圈',
    slug: 'chinese-anime',
    description: '专注国产动漫，追国漫、聊剧情、安利好作品。',
    category: 'anime',
    tags: ['国漫', '国创', '动画'],
    components: [
      {
        key: 'genre',
        type: 'multi_choice',
        prompt: '偏好题材',
        options: ['玄幻/仙侠', '都市/悬疑', '武侠', '校园/恋爱', '历史', '都看'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'medium',
        type: 'multi_choice',
        prompt: '主要媒介',
        options: ['网络动画', '剧场版', '漫画原著', '有声小说', '都有'],
        isChannelTag: false,
        displayOrder: 1,
      },
    ],
  },
  {
    name: 'Cosplay圈',
    slug: 'cosplay',
    description: 'Cos爱好者，分享造型、约拍、讨论制作技巧。',
    category: 'anime',
    tags: ['Cos', '角色扮演', '二次元'],
    components: [
      {
        key: 'source',
        type: 'multi_choice',
        prompt: '偏好角色来源',
        options: ['动漫角色', '游戏角色', '影视角色', '原创设计', '都有'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'level',
        type: 'single_choice',
        prompt: '制作水平',
        options: ['新手入坑', '购买成品服装', '自制部分道具/妆容', '全自制'],
        isChannelTag: true,
        displayOrder: 1,
      },
    ],
  },
  {
    name: 'Vtuber圈',
    slug: 'vtuber',
    description: '虚拟主播爱好者，国内外Vtuber都欢迎，一起冲。',
    category: 'anime',
    tags: ['Vtuber', '虚拟主播', '二次元'],
    components: [
      {
        key: 'region',
        type: 'multi_choice',
        prompt: '主要关注地区',
        options: ['日本（Holo/Niji等）', '国内（嘉然/乃琳等）', '独立Vtuber', '都关注'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'content',
        type: 'multi_choice',
        prompt: '偏好内容类型',
        options: ['游戏直播', '歌回/3D演唱会', '综艺/企划', '聊天闲聊'],
        isChannelTag: false,
        displayOrder: 1,
      },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// 音乐类
// ═══════════════════════════════════════════════════════════════

const MUSIC_CIRCLES: CircleSeed[] = [
  {
    name: 'KPOP圈',
    slug: 'kpop',
    description: 'KPOP粉丝聚集，追爱豆、看打歌舞台、交流周边。',
    category: 'music',
    tags: ['KPOP', '韩流', '追星'],
    components: [
      {
        key: 'group_type',
        type: 'multi_choice',
        prompt: '偏好偶像类型',
        options: ['男团', '女团', '男歌手', '女歌手', '都关注'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'activity',
        type: 'multi_choice',
        prompt: '常做的事',
        options: ['追打歌/舞台', '买专辑/周边', '看综艺', '追直播', '做二创'],
        isChannelTag: false,
        displayOrder: 1,
      },
    ],
  },
  {
    name: 'JPOP（日音）圈',
    slug: 'jpop',
    description: '日音爱好者集合，聊 JPOP、乐队、歌手、动画和日剧里的好歌。',
    category: 'music',
    tags: ['JPOP', '日音', '日本音乐'],
    components: [
      {
        key: 'focus',
        type: 'multi_choice',
        prompt: '主要在听什么',
        options: ['JPOP歌手', '日本乐队', '动画歌曲/Anisong', '日剧/电影OST', 'Vocaloid/术力口', '都听'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'activity',
        type: 'multi_choice',
        prompt: '日常方式',
        options: ['单曲循环/挖歌单', '看现场/Live影像', '追新专/榜单', '收藏翻唱/翻弹', '做歌单分享'],
        isChannelTag: false,
        displayOrder: 1,
      },
    ],
  },
  {
    name: '欧美流行圈',
    slug: 'western-pop',
    description: '欧美流行乐爱好者集合，聊歌手、乐队、榜单热单和经典老歌。',
    category: 'music',
    tags: ['欧美流行', 'Pop', '英语歌'],
    components: [
      {
        key: 'focus',
        type: 'multi_choice',
        prompt: '主要在听什么',
        options: ['欧美流行歌手', '流行乐队/组合', 'R&B/灵魂乐', '舞曲/电子流行', '影视原声/OST', '都听'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'activity',
        type: 'multi_choice',
        prompt: '日常方式',
        options: ['单曲循环/刷榜单', '看现场/Live影像', '收藏MV/舞台', '挖老歌/经典回顾', '做歌单分享'],
        isChannelTag: false,
        displayOrder: 1,
      },
    ],
  },
  {
    name: '摇滚圈',
    slug: 'rock',
    description: '摇滚爱好者，聊乐队、看演出、分享好歌。',
    category: 'music',
    tags: ['摇滚', '乐队', '音乐'],
    components: [
      {
        key: 'style',
        type: 'multi_choice',
        prompt: '偏好摇滚类型',
        options: ['流行摇滚', '朋克', '金属', 'Indie/独立', '后摇', '华语摇滚', '都听'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'activity',
        type: 'multi_choice',
        prompt: '日常方式',
        options: ['听歌/发现新乐队', '看现场演出', '自己演奏乐器', '做乐评/分享'],
        isChannelTag: false,
        displayOrder: 1,
      },
    ],
  },
  {
    name: '嘻哈/说唱圈',
    slug: 'hiphop',
    description: '嘻哈爱好者，说唱、beatbox、街头文化都欢迎。',
    category: 'music',
    tags: ['嘻哈', '说唱', 'HipHop'],
    components: [
      {
        key: 'style',
        type: 'multi_choice',
        prompt: '偏好风格',
        options: ['华语说唱', '美国说唱', '地下/独立', 'Old School', '新生代', '都听'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'activity',
        type: 'multi_choice',
        prompt: '参与方式',
        options: ['听歌为主', '看比赛/节目', '自己创作/表演', '跳Breaking/街舞'],
        isChannelTag: false,
        displayOrder: 1,
      },
    ],
  },
  {
    name: '电子音乐圈',
    slug: 'electronic-music',
    description: '电子音乐爱好者，EDM、House、Techno、制作人都欢迎。',
    category: 'music',
    tags: ['电子', 'EDM', '音乐'],
    components: [
      {
        key: 'style',
        type: 'multi_choice',
        prompt: '偏好风格',
        options: ['EDM/House', 'Techno', 'Lo-fi/Chillhop', '合成器流行', '实验电子', '都听'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'activity',
        type: 'multi_choice',
        prompt: '参与方式',
        options: ['听歌为主', '看演出/音乐节', '自己制作', '玩合成器/硬件'],
        isChannelTag: false,
        displayOrder: 1,
      },
    ],
  },
  {
    name: '民谣圈',
    slug: 'folk-music',
    description: '民谣爱好者，聊歌手、弹吉他、分享有温度的音乐。',
    category: 'music',
    tags: ['民谣', '吉他', '音乐'],
    components: [
      {
        key: 'style',
        type: 'multi_choice',
        prompt: '偏好风格',
        options: ['内地民谣', '台湾民谣', '民谣摇滚', '原生态/少数民族', '都听'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'instrument',
        type: 'single_choice',
        prompt: '自己会演奏吗',
        options: ['会弹吉他/尤克里里', '会其他乐器', '在学习中', '只听不奏'],
        isChannelTag: true,
        displayOrder: 1,
      },
    ],
  },
  {
    name: 'Live演出圈',
    slug: 'live-show',
    description: '演出爱好者，约看演唱会、livehouse、音乐节。',
    category: 'music',
    tags: ['演出', 'Livehouse', '音乐节'],
    components: [
      {
        key: 'type',
        type: 'multi_choice',
        prompt: '偏好演出类型',
        options: ['演唱会', 'Livehouse/小型演出', '音乐节', '脱口秀', '话剧/戏剧', '都去'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'freq',
        type: 'single_choice',
        prompt: '看演出频率',
        options: ['偶尔（几个月一次）', '每月1-2次', '每月多次'],
        isChannelTag: false,
        displayOrder: 1,
      },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// 生活方式类
// ═══════════════════════════════════════════════════════════════

const LIFESTYLE_CIRCLES: CircleSeed[] = [
  {
    name: '摄影圈',
    slug: 'photography',
    description: '摄影爱好者，约拍、分享作品、讨论器材和后期。',
    category: 'life',
    tags: ['摄影', '创作', '艺术'],
    components: [
      {
        key: 'direction',
        type: 'multi_choice',
        prompt: '偏好摄影方向',
        options: ['人像', '街拍/纪实', '风光', '胶片', '展览/博物馆', '美食', '建筑'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'gear',
        type: 'single_choice',
        prompt: '主要器材',
        options: ['手机', '入门微单/反光', '全幅相机', '胶片相机', '多种都用'],
        isChannelTag: true,
        displayOrder: 1,
      },
    ],
  },
  {
    name: '美食探店圈',
    slug: 'food-exploring',
    description: '美食爱好者，约饭、探店、分享南京好吃的地方。',
    category: 'life',
    tags: ['美食', '探店', '约饭'],
    components: [
      {
        key: 'type',
        type: 'multi_choice',
        prompt: '偏好美食类型',
        options: ['平价小吃', '咖啡/甜品', '火锅/烧烤', '日韩料理', '精致餐厅', '都探'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'priority',
        type: 'multi_choice',
        prompt: '约饭最在意',
        options: ['味道', '性价比', '氛围', '聊天体验', '拍照出片'],
        isChannelTag: false,
        displayOrder: 1,
      },
    ],
  },
  {
    name: '旅行/CityWalk圈',
    slug: 'travel-citywalk',
    description: '旅行和城市漫步爱好者，约出行、分享路线和见闻。',
    category: 'life',
    tags: ['旅行', 'CityWalk', '出行'],
    components: [
      {
        key: 'style',
        type: 'single_choice',
        prompt: '旅行风格',
        options: ['深度慢游', '多城速览', '纯CityWalk', '完全随机探索'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'plan',
        type: 'single_choice',
        prompt: '出行计划风格',
        options: ['详细规划每一步', '大致方向随机应变', '几乎完全随机'],
        isChannelTag: false,
        displayOrder: 1,
      },
    ],
  },
  {
    name: '宠物圈',
    slug: 'pets',
    description: '铲屎官聚集地，猫狗小动物都欢迎，分享萌宠日常。',
    category: 'life',
    tags: ['宠物', '猫狗', '萌宠'],
    components: [
      {
        key: 'pet_type',
        type: 'multi_choice',
        prompt: '我有/喜欢的宠物',
        options: ['猫', '狗', '小宠物（仓鼠/兔等）', '爬宠', '鸟类', '暂无但喜欢'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'experience',
        type: 'single_choice',
        prompt: '铲屎官资历',
        options: ['新手（不到1年）', '1-3年', '3年以上老铲屎官'],
        isChannelTag: false,
        displayOrder: 1,
      },
    ],
  },
  {
    name: '汉服圈',
    slug: 'hanfu',
    description: '汉服爱好者，日常穿搭、出行约拍、聊形制历史。',
    category: 'life',
    tags: ['汉服', '传统文化', '穿搭'],
    components: [
      {
        key: 'type',
        type: 'multi_choice',
        prompt: '偏好汉服类型',
        options: ['唐制', '宋制', '明制', '古风改良', '汉元素日常', '都喜欢'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'freq',
        type: 'single_choice',
        prompt: '穿着频率',
        options: ['偶尔穿（节日/约拍）', '经常穿', '几乎每天'],
        isChannelTag: false,
        displayOrder: 1,
      },
    ],
  },
  {
    name: '程序员/极客圈',
    slug: 'programmer-geek',
    description: '技术爱好者，编程、开源项目、极客文化都欢迎。',
    category: 'tech',
    tags: ['编程', '技术', '极客'],
    components: [
      {
        key: 'field',
        type: 'multi_choice',
        prompt: '主要方向',
        options: ['前端', '后端', '算法/数学', '网络安全', 'AI/ML', '嵌入式/硬件', '其他'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'level',
        type: 'single_choice',
        prompt: '经验水平',
        options: ['在学中/入门', '有项目经验', '有实习/工作经验'],
        isChannelTag: true,
        displayOrder: 1,
      },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// 阅读/影视类
// ═══════════════════════════════════════════════════════════════

const READING_CIRCLES: CircleSeed[] = [
  {
    name: '读书圈',
    slug: 'reading',
    description: '读书爱好者，分享书单、聊读后感、互相安利好书。',
    category: 'reading',
    tags: ['读书', '文学', '书单'],
    components: [
      {
        key: 'genre',
        type: 'multi_choice',
        prompt: '偏好书籍类型',
        options: ['文学/小说', '科幻/奇幻', '历史/传记', '哲学/社科', '科普', '商业/经济', '都看'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'freq',
        type: 'single_choice',
        prompt: '阅读频率',
        options: ['偶尔（兴趣来了读）', '每月几本', '几乎每周都读'],
        isChannelTag: false,
        displayOrder: 1,
      },
    ],
  },
  {
    name: '小说/网文圈',
    slug: 'fiction',
    description: '网文和小说爱好者，追文、安利好文、聊剧情。',
    category: 'reading',
    tags: ['网文', '小说', '追文'],
    components: [
      {
        key: 'genre',
        type: 'multi_choice',
        prompt: '偏好类型',
        options: ['言情/BG', '玄幻/修仙', '武侠', '科幻', '悬疑/推理', '耽美/BL', '百合/GL', '都看'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'status',
        type: 'single_choice',
        prompt: '追文状态',
        options: ['追连载（日更党）', '只看完本', '都行'],
        isChannelTag: false,
        displayOrder: 1,
      },
    ],
  },
  {
    name: '影视圈',
    slug: 'movies-series',
    description: '影视爱好者，推荐好片、聊剧情、一起观影打卡。',
    category: 'life',
    tags: ['电影', '剧集', '影视'],
    components: [
      {
        key: 'source',
        type: 'multi_choice',
        prompt: '偏好来源',
        options: ['国产剧', '美剧/英剧', '韩剧', '日剧', '电影（各地）', '都看'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'genre',
        type: 'multi_choice',
        prompt: '偏好题材',
        options: ['爱情', '悬疑/推理', '科幻', '喜剧', '历史/古装', '动作/冒险'],
        isChannelTag: false,
        displayOrder: 1,
      },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// 艺术类
// ═══════════════════════════════════════════════════════════════

const ARTS_CIRCLES: CircleSeed[] = [
  {
    name: '绘画/插画圈',
    slug: 'illustration',
    description: '绘画爱好者，分享作品、交流技法、约共创。',
    category: 'art',
    tags: ['绘画', '插画', '创作'],
    components: [
      {
        key: 'medium',
        type: 'multi_choice',
        prompt: '主要媒介',
        options: ['数字插画（板绘）', '水彩', '素描/速写', '国画', '丙烯/油画', '其他'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'level',
        type: 'single_choice',
        prompt: '绘画水平',
        options: ['初学/入坑不久', '有一定基础', '进阶', '较专业'],
        isChannelTag: true,
        displayOrder: 1,
      },
    ],
  },
  {
    name: '手工/DIY圈',
    slug: 'handcraft',
    description: '手工爱好者，粘土、手账、编织、各种DIY都欢迎。',
    category: 'art',
    tags: ['手工', 'DIY', '创作'],
    components: [
      {
        key: 'type',
        type: 'multi_choice',
        prompt: '偏好类型',
        options: ['粘土/树脂', '手账/拼贴', '编织/刺绣', '珠宝/配饰', '皮革', '其他'],
        isChannelTag: true,
        displayOrder: 0,
      },
      {
        key: 'freq',
        type: 'single_choice',
        prompt: '创作频率',
        options: ['偶尔', '经常', '几乎每天'],
        isChannelTag: false,
        displayOrder: 1,
      },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// 合并所有圈子
// ═══════════════════════════════════════════════════════════════

const ALL_CIRCLES: CircleSeed[] = [
  ...GAME_CIRCLES,
  ...SPORTS_CIRCLES,
  ...ANIME_CIRCLES,
  ...MUSIC_CIRCLES,
  ...LIFESTYLE_CIRCLES,
  ...READING_CIRCLES,
  ...ARTS_CIRCLES,
];

// ─── 主函数 ─────────────────────────────────────────────────────

async function main() {
  console.log(`开始插入预设圈子，共 ${ALL_CIRCLES.length} 个...\n`);

  let inserted = 0;
  let skipped = 0;

  for (const c of ALL_CIRCLES) {
    const tagsJson = JSON.stringify(c.tags);
    const legacyTag = c.tags[0] ?? '';

    // 插入圈子（已存在则跳过）
    const circleResult = await queryClient`
      INSERT INTO circles (id, name, slug, description, category, tag, tags, member_count, is_active, status)
      VALUES (
        gen_random_uuid()::text,
        ${c.name},
        ${c.slug},
        ${c.description},
        ${c.category},
        ${legacyTag},
        ${tagsJson}::jsonb,
        0,
        true,
        'active'
      )
      ON CONFLICT (slug) DO NOTHING
      RETURNING id, name
    `;

    if (circleResult.length === 0) {
      console.log(`  - 已存在，跳过: ${c.name}`);
      skipped++;
      continue;
    }

    const circleId = circleResult[0].id as string;
    console.log(`  ✓ 已创建: ${c.name} (${circleId.slice(0, 8)}...)`);
    inserted++;

    // 插入 B卡组件
    if (c.components.length > 0) {
      for (let i = 0; i < c.components.length; i++) {
        const comp = c.components[i];
        const optionsJson = comp.options ? JSON.stringify(comp.options) : null;
        const displayOrder = comp.displayOrder ?? i;

        await queryClient`
          INSERT INTO circle_questions (id, circle_id, key, type, prompt, options, weight, display_order, is_channel_tag)
          VALUES (
            gen_random_uuid()::text,
            ${circleId},
            ${comp.key},
            ${comp.type},
            ${comp.prompt},
            ${optionsJson},
            1.0,
            ${displayOrder},
            ${comp.isChannelTag ?? false}
          )
        `;
      }
      console.log(`    → 已添加 ${c.components.length} 个 B卡组件`);
    }
  }

  console.log(`\n完成！新增 ${inserted} 个圈子（含B卡组件），跳过 ${skipped} 个已存在的圈子。`);
  await queryClient.end();
}

main().catch((err) => {
  console.error('种子数据插入失败:', err);
  process.exit(1);
});
