import OpenAI from 'openai';
import { config } from '../config.js';

let client: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (client) return client;
  if (!config.qwen.apiKey) return null;
  client = new OpenAI({
    apiKey: config.qwen.apiKey,
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  });
  return client;
}

interface CuratorContext {
  sharedInterests?: string[];
  aCampus?: string | null;
  bCampus?: string | null;
  intention?: 'friend' | 'partner';
}

interface CuratorGuardrails {
  allowedGameTitles: string[];
  allowGeekRetailScene: boolean;
}

const INTEREST_CATEGORY_LABELS: Record<string, string> = {
  gym_fitness: '健身',
  running_outdoor: '徒步户外',
  ball_sports: '球类运动',
  swimming_dance: '游泳舞蹈',
  movies_series: '电影剧集',
  gaming: '游戏',
  anime_acg: '动漫二次元',
  boardgame_larp: '桌游剧本杀',
  photo_exhibitions: '摄影看展',
  reading_writing: '阅读写作',
  fiction_fanfic: '小说同人',
  food_exploring: '探店美食',
  travel_citywalk: '旅行 CityWalk',
  music_listening: '音乐',
  live_show: 'Live/演出',
  pets: '宠物',
  programming_geek: '编程极客',
  finance_business: '金融商业',
  other_interest: '其他',
};

const MOVIE_TYPE_LABELS: Record<string, string> = {
  comedy: '喜剧',
  romance: '爱情',
  suspense_crime: '悬疑/犯罪',
  sci_fi: '科幻',
  action: '动作',
  horror: '恐怖',
  arthouse: '文艺片',
  animation: '动画',
  documentary: '纪录片',
};

const MOVIE_MEDIA_LABELS: Record<string, string> = {
  cn_drama: '国产剧',
  us_drama: '美剧',
  uk_drama: '英剧',
  kr_drama: '韩剧',
  jp_drama: '日剧',
  movie: '电影',
};

const BOARDGAME_LABELS: Record<string, string> = {
  werewolf_avalon: '狼人杀/阿瓦隆',
  party_boardgame: '聚会桌游',
  german_strategy: '策略桌游',
  murder_mystery: '剧本杀',
  escape_room: '密室逃脱',
};

const ACG_LABELS: Record<string, string> = {
  anime: '番剧',
  manga: '漫画',
  light_novel: '轻小说',
  fanfic: '同人',
  cosplay: 'Cosplay',
  convention: '漫展',
  vtuber: 'VTuber',
  goods: '周边手办',
};

const PHOTO_LABELS: Record<string, string> = {
  portrait: '人像摄影',
  street: '街拍',
  film: '胶片',
  digital: '数码摄影',
  art_museum: '美术馆',
  museum: '博物馆',
  photo_exhibition: '摄影展',
  installation: '装置艺术',
};

const FOOD_LABELS: Record<string, string> = {
  cheap_eats: '平价美食',
  cafe_dessert: '咖啡甜点',
  hotpot_bbq: '火锅烧烤',
  jp_kr_food: '日韩料理',
  western_brunch: '西餐 Brunch',
  milk_tea: '奶茶饮品',
  late_night: '夜宵',
  hidden_gem: '隐藏好店',
  home_cook: '自己做饭',
};

const TRAVEL_LABELS: Record<string, string> = {
  campus_walk: '校园漫步',
  city_walk: '城市漫步',
  cafe_hop: '咖啡巡礼',
  short_trip: '周末短途',
  speed_trip: '快节奏旅行',
  slow_stroll: '慢慢逛',
  photo_spot: '打卡拍照',
  random_explore: '随机探索',
};

const SPORT_LABELS: Record<string, string> = {
  weight_training: '力量训练',
  running: '跑步',
  cycling: '骑行',
  swimming: '游泳',
  yoga_pilates: '瑜伽/普拉提',
  dancing: '舞蹈',
  hiking_climbing: '徒步/攀岩',
};

const BALL_SPORT_LABELS: Record<string, string> = {
  badminton: '羽毛球',
  basketball: '篮球',
  table_tennis: '乒乓球',
  tennis: '网球',
  football: '足球',
  volleyball: '排球',
  billiards: '台球/桌球',
};

const READ_LABELS: Record<string, string> = {
  lit_fiction: '文学/小说',
  sci_fi_fantasy: '科幻/奇幻',
  history_bio: '历史/传记',
  philosophy_social: '哲学/社科',
  science_tech: '科学/技术',
  business_econ: '商业/经济',
  poetry_essay: '诗歌/散文',
  comics_picture_book: '漫画/绘本',
};

const NOVEL_LABELS: Record<string, string> = {
  romance_novel: '言情',
  suspense_thriller: '悬疑/惊悚',
  wuxia_xianxia: '武侠/仙侠',
  sci_fi_novel: '科幻',
  fantasy_magic: '奇幻/魔法',
  bl_danmei: '耽美/BL',
  gl_baihe: '百合/GL',
  fanfic_novel: '同人衍生',
};

const MUSIC_LABELS: Record<string, string> = {
  c_pop: '华语流行',
  k_pop: 'K-Pop',
  j_pop: 'J-Pop',
  western_pop: '欧美流行',
  rock: '摇滚',
  hip_hop_rap: '嘻哈/说唱',
  r_and_b: 'R&B/灵魂乐',
  electronic_dance: '电子/舞曲',
  classical: '古典',
  jazz_blues: '爵士/布鲁斯',
  folk_country: '民谣/乡村',
  indie: '独立音乐',
  acg_vocaloid: 'ACG/Vocaloid',
};

const GAME_GENRE_LABELS: Record<string, string> = {
  moba: 'MOBA',
  fps: 'FPS',
  open_world_rpg: '开放世界/RPG',
  gacha: '抽卡手游',
  party_casual: '聚会/休闲',
  rhythm: '音游',
  card_strategy: '卡牌/策略',
  simulation: '模拟经营',
  story_puzzle: '剧情/解谜',
  survival_build: '生存/建造',
};

const GAME_TITLE_LABELS: Record<string, string> = {
  honor_of_kings: '王者荣耀',
  tft: '金铲铲之战',
  pubg_mobile: '和平精英',
  eggy_party: '蛋仔派对',
  genshin: '原神',
  star_rail: '崩坏：星穹铁道',
  wuthering: '鸣潮',
  arknights: '明日方舟',
  love_nikki: '恋与深空',
  identity_v: '第五人格',
  lol: '英雄联盟',
  valorant: '无畏契约',
  cs2: 'CS2',
  apex: 'Apex 英雄',
  ow2: '守望先锋 2',
  dbd: '黎明杀机',
  minecraft: 'Minecraft',
  gta5: 'GTA5',
  stardew: '星露谷物语',
  r6: '彩虹六号',
  warframe: 'Warframe',
  it_takes_two: '双人成行',
  delta_force: '三角洲行动',
  marvel_rivals: '漫威争锋',
  dota2: 'Dota 2',
  rock_kingdom_world: '洛克王国：世界',
  zelda: '塞尔达传说',
  mario_kart: '马里奥赛车',
  animal_crossing: '动物森友会',
  pokemon: '宝可梦',
  smash_bros: '任天堂明星大乱斗',
  splatoon: '斯普拉遁',
  overcooked: '胡闹厨房',
  minecraft_sw: 'Minecraft（Switch）',
  xenoblade: '异度神剑',
  stardew_sw: '星露谷物语（Switch）',
};

const INTEREST_CN: Record<string, string> = {
  ...INTEREST_CATEGORY_LABELS,
  ...MOVIE_TYPE_LABELS,
  ...MOVIE_MEDIA_LABELS,
  ...BOARDGAME_LABELS,
  ...ACG_LABELS,
  ...PHOTO_LABELS,
  ...FOOD_LABELS,
  ...TRAVEL_LABELS,
  ...SPORT_LABELS,
  ...BALL_SPORT_LABELS,
  ...READ_LABELS,
  ...NOVEL_LABELS,
  ...MUSIC_LABELS,
  ...GAME_GENRE_LABELS,
  ...GAME_TITLE_LABELS,
  other_specify: '其他',
};

const GEEK_RETAIL_KEYS = new Set(['goods', 'convention', 'cosplay']);
const SHARED_GAME_TITLE_KEYS = ['q_gm_mobile', 'q_gm_pc', 'q_gm_switch'] as const;

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function intersectByKey(
  aAnswers: Record<string, { value: unknown }>,
  bAnswers: Record<string, { value: unknown }>,
  key: string,
): string[] {
  const a = new Set(asStringArray(aAnswers[key]?.value));
  const b = new Set(asStringArray(bAnswers[key]?.value));
  return [...a].filter((item) => b.has(item));
}

function mapLabels(values: string[], dict: Record<string, string>): string[] {
  return values.map((value) => dict[value] || value);
}

function intersectLabelsByKey(
  aAnswers: Record<string, { value: unknown }>,
  bAnswers: Record<string, { value: unknown }>,
  key: string,
  dict: Record<string, string>,
): string[] {
  return uniqueStrings(mapLabels(intersectByKey(aAnswers, bAnswers, key), dict));
}

function buildSpecificInterestLines(
  aAnswers: Record<string, { value: unknown }>,
  bAnswers: Record<string, { value: unknown }>,
): string[] {
  const lines: string[] = [];

  const movieTypes = intersectLabelsByKey(aAnswers, bAnswers, 'q_mv_type', MOVIE_TYPE_LABELS);
  if (movieTypes.length > 0) {
    lines.push(`- 影视口味：如果要写具体内容，优先用双方都喜欢的类型，比如${movieTypes.slice(0, 3).join('、')}；不要编造具体片名。`);
  }

  const movieMedia = intersectLabelsByKey(aAnswers, bAnswers, 'q_mv_media', MOVIE_MEDIA_LABELS);
  if (movieMedia.length > 0) {
    lines.push(`- 影视媒介：如果要写场景，可以轻轻带到${movieMedia.slice(0, 3).join('、')}，但不要写成“必须去看某一部作品”。`);
  }

  const boardgames = intersectLabelsByKey(aAnswers, bAnswers, 'q_bg_type', BOARDGAME_LABELS);
  if (boardgames.length > 0) {
    lines.push(`- 桌游/剧本杀：优先写成双方都容易接上的具体方向，比如${boardgames.slice(0, 3).join('、')}。`);
  }

  const acg = intersectLabelsByKey(aAnswers, bAnswers, 'q_acg_contact', ACG_LABELS);
  if (acg.length > 0) {
    lines.push(`- ACG 线索：如果要写得具体，可以参考${acg.slice(0, 3).join('、')}；只有真的有这些交集时，才考虑漫展或周边相关场景。`);
  }

  const photography = intersectLabelsByKey(aAnswers, bAnswers, 'q_ph_direction', PHOTO_LABELS);
  if (photography.length > 0) {
    lines.push(`- 摄影/看展：优先写成${photography.slice(0, 3).join('、')}这类具体方向，不要只写“都喜欢看展”。`);
  }

  const food = intersectLabelsByKey(aAnswers, bAnswers, 'q_fd_type', FOOD_LABELS);
  if (food.length > 0) {
    lines.push(`- 美食偏好：优先用双方都喜欢的类型来落地，比如${food.slice(0, 3).join('、')}。`);
  }

  const travel = intersectLabelsByKey(aAnswers, bAnswers, 'q_tr_type', TRAVEL_LABELS);
  if (travel.length > 0) {
    lines.push(`- 出行偏好：更自然的写法可以参考${travel.slice(0, 3).join('、')}，场景要轻松、低门槛。`);
  }

  const sports = intersectLabelsByKey(aAnswers, bAnswers, 'q_sp_type', SPORT_LABELS);
  if (sports.length > 0) {
    lines.push(`- 运动偏好：如果要落到活动，可以优先写${sports.slice(0, 3).join('、')}。`);
  }

  const ballSports = intersectLabelsByKey(aAnswers, bAnswers, 'q_ball_sport', BALL_SPORT_LABELS);
  if (ballSports.length > 0) {
    lines.push(`- 球类偏好：可以直接写成${ballSports.slice(0, 3).join('、')}这种具体项目。`);
  }

  const reading = intersectLabelsByKey(aAnswers, bAnswers, 'q_read_type', READ_LABELS);
  if (reading.length > 0) {
    lines.push(`- 阅读偏好：如果要写具体共鸣，可以参考${reading.slice(0, 3).join('、')}，不要只写“都爱看书”。`);
  }

  const novels = intersectLabelsByKey(aAnswers, bAnswers, 'q_novel_type', NOVEL_LABELS);
  if (novels.length > 0) {
    lines.push(`- 小说偏好：优先写成${novels.slice(0, 3).join('、')}这种具体类型，不要凭空编造作品名。`);
  }

  const music = intersectLabelsByKey(aAnswers, bAnswers, 'q_music_style', MUSIC_LABELS);
  if (music.length > 0) {
    lines.push(`- 音乐偏好：如果要写具体内容，优先用${music.slice(0, 4).join('、')}这类真实交集。`);
  }

  const gameGenres = intersectLabelsByKey(aAnswers, bAnswers, 'q_gm_genre', GAME_GENRE_LABELS);
  const gameTitles = uniqueStrings(
    SHARED_GAME_TITLE_KEYS.flatMap((key) => intersectLabelsByKey(aAnswers, bAnswers, key, GAME_TITLE_LABELS)),
  );
  const gamingShared = intersectByKey(aAnswers, bAnswers, 'q8').some((key) => key === 'gaming');
  if (gameTitles.length > 0) {
    lines.push(`- 游戏偏好：双方明确都选中的游戏只有${gameTitles.slice(0, 3).join('、')}；如果真的需要点名，只能从这里最多选一个。更推荐写成一起联机、开一局、边喝东西边聊最近玩的内容。`);
  } else if (gameGenres.length > 0 || gamingShared) {
    const genreHint = gameGenres.length > 0 ? gameGenres.slice(0, 3).join('、') : '共同的游戏兴趣';
    lines.push(`- 游戏偏好：更自然的写法是“一起联机一会儿”“顺手开一局”“聊聊最近在玩的内容”，可轻轻结合${genreHint}；不要编造具体游戏名，不要写电玩城、商场游戏城、周边店。`);
  }

  const general = intersectByKey(aAnswers, bAnswers, 'q8')
    .filter((key) => INTEREST_CATEGORY_LABELS[key])
    .map((key) => INTEREST_CATEGORY_LABELS[key])
    .slice(0, 4);
  if (general.length > 0) {
    lines.push(`- 其他共同兴趣：如果只剩大类线索，就把场景写得轻一点，比如${general.join('、')}；不要逐字复述标签。`);
  }

  return lines;
}

function buildCuratorGuardrails(
  aAnswers: Record<string, { value: unknown }>,
  bAnswers: Record<string, { value: unknown }>,
): CuratorGuardrails {
  const allowedGameTitles = uniqueStrings(
    SHARED_GAME_TITLE_KEYS.flatMap((key) => intersectLabelsByKey(aAnswers, bAnswers, key, GAME_TITLE_LABELS)),
  );
  const sharedAcgKeys = intersectByKey(aAnswers, bAnswers, 'q_acg_contact');

  return {
    allowedGameTitles,
    allowGeekRetailScene: sharedAcgKeys.some((key) => GEEK_RETAIL_KEYS.has(key)),
  };
}

function validateCuratorNote(note: string, guardrails: CuratorGuardrails): string | null {
  const trimmed = note.trim();
  if (!trimmed) return '文案为空';
  if (/《[^》]{1,30}》/.test(trimmed)) return '不要编造具体作品名或游戏名';
  if (/电玩城|商场游戏城/.test(trimmed)) return '不要写电玩城或商场游戏城';
  if ((/周边店|游戏周边/.test(trimmed)) || ((!guardrails.allowGeekRetailScene) && /手办|周边/.test(trimmed))) {
    return '不要在没有明确交集时写周边或手办场景';
  }

  const unexpectedGameTitles = Object.values(GAME_TITLE_LABELS).filter(
    (label) => trimmed.includes(label) && !guardrails.allowedGameTitles.includes(label),
  );
  if (unexpectedGameTitles.length > 0) {
    return `不要编造双方未明确共享的具体游戏名：${unexpectedGameTitles.slice(0, 2).join('、')}`;
  }

  return null;
}

function buildPrompt(
  intention: 'friend' | 'partner',
  interestLabels: string,
  specificInterestLines: string[],
  locationHint: string,
  retryReason?: string | null,
): string {
  const roleLine = intention === 'friend'
    ? '为两位有共同兴趣的用户写一句搭子活动建议，不超过 2 句话。'
    : '为两位匹配用户写一句约会建议，不超过 2 句话。';

  const toneLine = intention === 'friend'
    ? '- 语气轻松自然，像朋友间随口一说'
    : '- 语气温暖自然，略带期待感';

  const retryLine = retryReason
    ? `- 上一次输出的问题是：${retryReason}。这次必须彻底避开这个问题`
    : '';

  return `${roleLine}
共同兴趣：${interestLabels || (intention === 'friend' ? '聊天交流' : '相处交流')}
${specificInterestLines.length > 0 ? `具体交集线索：\n${specificInterestLines.join('\n')}\n` : ''}
${locationHint}
写作要求：
- 直接从活动或场景切入，不要用“听说”“不如”“何不”等邀请套语
- 场景要真实、自然、低门槛，不要故意凹年轻化语气，也不要写成网络热梗
- 只能引用双方答案里明确出现的具体信息，不要编造游戏名、片名、商场名、店名、品牌名
- 如果有具体交集，就优先写具体交集；如果没有，就用更稳妥的大类场景来写
- 游戏相关默认写成玩法或相处场景，比如“一起联机一会儿”“顺手开一局”“边喝东西边聊最近玩的内容”
- 只有当具体交集线索里明确列出双方都选中的同一款游戏时，才可以点名，而且最多点一个
- 除非具体交集线索里明确出现漫展 / Cosplay / 周边相关线索，否则不要写手办、周边店、电玩城、商场游戏城
- 不用 emoji，不超过 2 句话
${toneLine}
${retryLine}`.trim();
}

/**
 * Generate a personalised activity suggestion for a matched pair.
 * Uses Qwen via DashScope. Falls back to a safer template note if unavailable.
 */
export async function generateCuratorNote(
  userAAnswers: Record<string, { value: unknown }>,
  userBAnswers: Record<string, { value: unknown }>,
  compatScore: number,
  context: CuratorContext = {},
): Promise<string> {
  const ai = getClient();

  if (!ai) {
    return getTemplateNote(compatScore, context);
  }

  const { sharedInterests = [], aCampus, bCampus, intention = 'partner' } = context;
  const interestLabels = uniqueStrings(sharedInterests.map((key) => INTEREST_CN[key] || key)).slice(0, 4).join('、');
  const specificInterestLines = buildSpecificInterestLines(userAAnswers, userBAnswers);
  const guardrails = buildCuratorGuardrails(userAAnswers, userBAnswers);
  const sameCampus = aCampus && bCampus && aCampus === bCampus;
  const campusNote = sameCampus
    ? `两人都在${aCampus}校区`
    : aCampus && bCampus
      ? `一人在${aCampus}、一人在${bCampus}校区`
      : '';

  const CAMPUS_SPOTS: Record<string, string> = {
    gulou: '玄武湖、老门东、先锋书店、颐和路、鸡鸣寺、总统府、夫子庙一带',
    xianlin: '羊山公园、仙林湖、东方福地、金鹰湖滨天地、九霄梦天地、栖霞山、万达茂、欢乐谷一带',
    suzhou: '热雪奇迹、苏州乐园、苏州太湖国家湿地公园、金鸡湖、苏州中心商场、西京湾花海、苏州博物馆西馆、大阳山国家森林公园一带',
    pukou: '浦口火车站旧址、不老村、兰溪公园、珍珠泉风景区、老山国家森林公园、四方艺术湖区、水墨大埝一带',
  };
  const locationHint = sameCampus && aCampus && CAMPUS_SPOTS[aCampus]
    ? `两人都在同一校区，附近有${CAMPUS_SPOTS[aCampus]}可以参考，但只有在活动本身自然贴合时才轻轻带到，不要落到商场或具体店名。`
    : campusNote
      ? `${campusNote}，两人不在同一校区时不要推荐具体地点，专注于活动本身。`
      : '';

  let retryReason: string | null = null;

  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await ai.chat.completions.create({
        model: config.qwen.model,
        messages: [
          {
            role: 'system',
            content: '你是 NJU Match 的“馆长”，用中文写简短、温柔、自然的活动建议。不要用 emoji，不要写刻意装年轻的互联网口吻，不要编造用户没提供的具体信息。',
          },
          {
            role: 'user',
            content: buildPrompt(intention, interestLabels, specificInterestLines, locationHint, retryReason),
          },
        ],
        max_tokens: 150,
        temperature: 0.6,
      });

      const note = response.choices[0]?.message?.content?.trim() || '';
      const invalidReason = validateCuratorNote(note, guardrails);
      if (!invalidReason) return note;
      retryReason = invalidReason;
    }
  } catch (err) {
    console.error('[AI] Qwen API error, using template:', err);
  }

  return getTemplateNote(compatScore, context);
}

function getTemplateNote(score: number, context: CuratorContext = {}): string {
  const { sharedInterests = [], intention = 'partner' } = context;
  const labels = uniqueStrings(sharedInterests.map((key) => INTEREST_CN[key] || key)).slice(0, 2);

  if (labels.length > 0) {
    return intention === 'friend'
      ? `从${labels.join('、')}聊起，通常比刻意安排更容易找到自然接得上的节奏。`
      : `从${labels.join('、')}聊起，往往比刻意安排更容易让两个人慢慢熟起来。`;
  }

  if (score >= 0.9) {
    return '你们在核心价值观和生活方式上展现出了罕见的高度共鸣，这样的默契，值得慢慢展开。';
  }
  if (score >= 0.8) {
    return '你们的世界观有着温暖的交集，而那些细微的差异，或许正好让彼此更有意思。';
  }
  return intention === 'friend'
    ? '有些轻松的来回，本来就不需要太多铺垫，顺着感觉聊下去就很好。'
    : '有时候，真正让人放松的靠近，并不靠设计得很满的安排，而是靠自然接得上的话题。';
}
