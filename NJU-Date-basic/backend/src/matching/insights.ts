/**
 * Generate human-readable dimension insights for a matched pair.
 * Tone: literary, warm, understated — matching the website's "锦书" aesthetic.
 *
 * v4.0: 4 dimensions — lifestyle / communication / boundary / values
 */

const INTEREST_LABELS: Record<string, string> = {
  // ── 大类 ────────────────────────────────────────────────────────────
  gym_fitness: '健身', running_outdoor: '跑步户外', ball_sports: '球类运动',
  swimming_dance: '游泳舞蹈', movies_series: '电影剧集', gaming: '游戏',
  anime_acg: '动漫二次元', boardgame_larp: '桌游剧本杀',
  photo_exhibitions: '摄影看展', reading_writing: '阅读写作',
  fiction_fanfic: '小说同人', food_exploring: '探店美食', travel_citywalk: '旅行CityWalk',
  music_listening: '音乐', live_show: 'Live/演出',
  pets: '宠物', programming_geek: '编程极客', finance_business: '金融商业', other_interest: '其他',
  // ── 电影/剧集类型 (q_mv_type) ───────────────────────────────────────
  comedy: '喜剧', romance: '爱情', suspense_crime: '悬疑犯罪', sci_fi: '科幻',
  action: '动作', horror: '恐怖', arthouse: '文艺片', animation: '动画', documentary: '纪录片',
  // ── 影视媒介 (q_mv_media) ───────────────────────────────────────────
  cn_drama: '国产剧', us_drama: '美剧', uk_drama: '英剧', kr_drama: '韩剧', jp_drama: '日剧', movie: '电影',
  // ── 桌游/剧本杀 (q_bg_type) ─────────────────────────────────────────
  werewolf_avalon: '狼人杀', party_boardgame: '聚会桌游', german_strategy: '策略桌游',
  murder_mystery: '剧本杀', escape_room: '密室',
  // ── 动漫/二次元 (q_acg_contact) ─────────────────────────────────────
  anime: '番剧', manga: '漫画', light_novel: '轻小说', fanfic: '同人',
  cosplay: 'Cosplay', convention: '漫展', vtuber: 'VTuber', goods: '周边手办',
  // ── 摄影/看展 (q_ph_direction) ──────────────────────────────────────
  portrait: '人像摄影', street: '街拍', film: '胶片', digital: '数码',
  art_museum: '美术馆', museum: '博物馆', photo_exhibition: '摄影展', installation: '装置艺术',
  // ── 探店/美食 (q_fd_type) ────────────────────────────────────────────
  cheap_eats: '平价美食', cafe_dessert: '咖啡甜点', hotpot_bbq: '火锅烧烤',
  jp_kr_food: '日韩料理', western_brunch: '西餐Brunch', milk_tea: '奶茶',
  late_night: '夜宵', hidden_gem: '隐藏好店', home_cook: '自己做饭',
  // ── 旅行/CityWalk (q_tr_type) ───────────────────────────────────────
  campus_walk: '校园漫步', city_walk: '城市漫步', cafe_hop: '咖啡巡礼',
  short_trip: '周末短途', speed_trip: '快节奏旅行', slow_stroll: '慢慢逛',
  photo_spot: '打卡拍照', random_explore: '随机探索',
  // ── 健身/户外运动 (q_sp_type) ───────────────────────────────────────
  weight_training: '力量训练', running: '跑步', cycling: '骑行',
  swimming: '游泳', yoga_pilates: '瑜伽', dancing: '舞蹈', hiking_climbing: '徒步攀岩',
  // ── 球类运动 (q_ball_sport) ─────────────────────────────────────────
  badminton: '羽毛球', basketball: '篮球', table_tennis: '乒乓球',
  tennis: '网球', football: '足球', volleyball: '排球', billiards: '台球',
  // ── 音乐风格 (q_music_style) ────────────────────────────────────────
  c_pop: '华语流行', k_pop: 'K-pop', j_pop: 'J-pop', western_pop: '欧美流行', rock: '摇滚',
  hip_hop_rap: 'Hip-Hop/说唱', r_and_b: 'R&B', electronic_dance: '电子舞曲',
  classical: '古典', jazz_blues: '爵士/蓝调', folk_country: '民谣',
  indie: '独立音乐', acg_vocaloid: 'ACG/Vocaloid',
  // ── 书籍类型 (q_read_type) ──────────────────────────────────────────
  lit_fiction: '文学小说', sci_fi_fantasy: '科幻/奇幻', history_bio: '历史传记',
  philosophy_social: '哲学社科', science_tech: '科普/技术', business_econ: '商业/经济',
  poetry_essay: '诗歌/散文', comics_picture_book: '漫画/绘本',
  // ── 小说类型 (q_novel_type) ─────────────────────────────────────────
  romance_novel: '言情', suspense_thriller: '悬疑推理', wuxia_xianxia: '武侠/仙侠',
  sci_fi_novel: '科幻', fantasy_magic: '玄幻/魔幻', bl_danmei: '耽美BL',
  gl_baihe: '百合GL', fanfic_novel: '同人文',
  // ── 手游 (q_gm_mobile) ──────────────────────────────────────────────
  honor_of_kings: '王者荣耀', tft: '云顶之弈', pubg_mobile: '和平精英',
  eggy_party: '蛋仔派对', genshin: '原神', star_rail: '崩坏：星穹铁道',
  wuthering: '鸣潮', arknights: '明日方舟', love_nikki: '恋与深空',
  identity_v: '第五人格',
  // ── PC/端游 (q_gm_pc) ───────────────────────────────────────────────
  lol: '英雄联盟', valorant: '无畏契约', cs2: 'CS2', apex: 'Apex英雄',
  ow2: '守望先锋2', dbd: '黎明杀机', minecraft: 'Minecraft', gta5: 'GTA5',
  stardew: '星露谷物语', r6: '彩虹六号', warframe: 'Warframe',
  it_takes_two: '双人成行', delta_force: '三角洲', marvel_rivals: '漫威争锋', dota2: 'Dota 2',
  rock_kingdom_world: '洛克王国：世界',
  // ── Switch/主机 (q_gm_switch) ───────────────────────────────────────
  zelda: '塞尔达传说', mario_kart: '马里奥赛车', animal_crossing: '动物森友会',
  pokemon: '宝可梦', smash_bros: '任天堂明星大乱斗', splatoon: '斯普拉遁',
  overcooked: '胡闹厨房', minecraft_sw: 'Minecraft(Switch)', xenoblade: '异度神剑',
  stardew_sw: '星露谷物语(Switch)',
  // ── 游戏类型 (q_gm_genre) ────────────────────────────────────────────
  moba: 'MOBA', fps: 'FPS', open_world_rpg: '开放世界/RPG',
  gacha: '抽卡手游', party_casual: '休闲派对', rhythm: '音游',
  card_strategy: '卡牌策略', simulation: '模拟经营',
  story_puzzle: '剧情解谜', survival_build: '生存建造',
  // ── 通用兜底 ─────────────────────────────────────────────────────────
  other_specify: '其他',
};

interface DimensionInsightsInput {
  dimensions: Record<string, number>;
  sharedInterests: string[];
  insights: {
    sameCampus?: boolean;
    sameDepartment?: boolean;
    sameHometown?: boolean;
    mbtiMatch?: boolean;
    scheduleMatch?: boolean;
  };
  intention: 'friend' | 'partner';
}

export interface DimensionInsight {
  dimension: string;
  label: string;
  score: number;
  text: string;
}

function scoreLevel(score: number): 'high' | 'mid' | 'low' {
  if (score >= 0.8) return 'high';
  if (score >= 0.6) return 'mid';
  return 'low';
}

export function generateDimensionInsights(input: DimensionInsightsInput): DimensionInsight[] {
  const { dimensions, sharedInterests, insights, intention } = input;
  const result: DimensionInsight[] = [];

  // ── 生活习惯 ────────────────────────────────────────────
  const lifestyleScore = dimensions.lifestyle ?? 0;
  const lifestyleLevel = scoreLevel(lifestyleScore);
  let lifestyleText: string;
  if (lifestyleLevel === 'high') {
    if (insights.sameCampus && insights.scheduleMatch) {
      lifestyleText = '同一片校园，相近的作息——连碰巧相遇都不需要太多安排。';
    } else if (insights.sameCampus) {
      lifestyleText = '同校区的距离，让日常的交集少了很多门槛，见面这件事变得格外轻松。';
    } else if (insights.scheduleMatch) {
      lifestyleText = '作息节奏相近的人，连沉默的时间都能对得上，少了很多将就。';
    } else {
      lifestyleText = '生活节奏本来就合拍的两个人，不需要刻意迁就，就已经挺舒服了。';
    }
  } else if (lifestyleLevel === 'mid') {
    lifestyleText = '日子的纹理各有不同，偶尔的交叠，反而是最好看的部分。';
  } else {
    lifestyleText = '习惯各有风格，也许正因为不同，才有了相互了解的空间。';
  }
  result.push({ dimension: 'lifestyle', label: '生活习惯', score: lifestyleScore, text: lifestyleText });

  // ── 相处沟通 ────────────────────────────────────────────
  const commScore = dimensions.communication ?? 0;
  const commLevel = scoreLevel(commScore);
  const commText = {
    high: '感受爱的方式高度相似，不需要太多翻译，就能被对方好好接住。',
    mid: '沟通各有特色——磨合的过程，往往才是一段关系里最真实的部分。',
    low: '表达方式稍有差距，但愿意去理解对方的节奏，本身就是一种温柔。',
  }[commLevel];
  if (intention === 'friend') {
    result.push({
      dimension: 'communication', label: '相处风格', score: commScore,
      text: {
        high: '相处起来不费力，这种轻松的默契，正是友情里最难得的底色。',
        mid: '性格的差异往往是聊天最好的燃料，互补的组合反而更有意思。',
        low: '不一样的人走在一起，反而能看见平时看不见的世界。',
      }[commLevel],
    });
  } else {
    result.push({ dimension: 'communication', label: '相处沟通', score: commScore, text: commText });
  }

  // ── 边界安全感（仅 partner 模式）──────────────────────────
  if (intention !== 'friend') {
    const boundaryScore = dimensions.boundary ?? 0;
    const boundaryLevel = scoreLevel(boundaryScore);
    const boundaryText = {
      high: '你们对空间和亲密的分寸拿捏得很一致，不需要反复猜测对方的底线。',
      mid: '每个人的安全距离不完全一样，但愿意倾听和靠近的态度，已经是最好的开始。',
      low: '对信任的理解各有节奏，或许正好可以在相处中重新认识自己的边界。',
    }[boundaryLevel];
    result.push({ dimension: 'boundary', label: '边界安全感', score: boundaryScore, text: boundaryText });
  }

  // ── 价值共鸣 ────────────────────────────────────────────
  const valuesScore = dimensions.values ?? 0;
  const valuesLevel = scoreLevel(valuesScore);
  const valuesText = {
    high: '底层逻辑相近的两个人，很多话不需要说完，对方就已经明白了。',
    mid: '不必事事相同，但在最关键的岔路口，你们往往会走向同一侧。',
    low: '观点的碰撞未必是摩擦——那个让你忍不住重新想想的人，往往更值得认识。',
  }[valuesLevel];
  result.push({ dimension: 'values', label: '价值共鸣', score: valuesScore, text: valuesText });

  // ── 共同兴趣标注 ──────────────────────────────────────
  if (sharedInterests.length > 0) {
    const labels = sharedInterests.map((k) => INTEREST_LABELS[k] || k).slice(0, 4);
    const joined = labels.join('、');
    result.push({
      dimension: 'interests',
      label: '共同兴趣',
      score: Math.min(1, sharedInterests.length / 4),
      text: intention === 'friend'
        ? `你们都喜欢${joined}，一起做这些事再自然不过了。`
        : `都喜欢${joined}，话题这件事，从来不需要担心冷场。`,
    });
  }

  // ── 上下文加成 ──────────────────────────────────────────
  if (insights.sameCampus && lifestyleLevel !== 'high') {
    result.push({
      dimension: 'context', label: '同校区', score: 1,
      text: '同在一个校区，打个招呼只需要走几步路，这种距离感本身就是一种缘分。',
    });
  }
  if (insights.sameHometown) {
    result.push({
      dimension: 'context', label: '同乡', score: 1,
      text: '来自同一个地方，很多东西不用开口解释，已经懂了大半。',
    });
  }

  return result;
}
