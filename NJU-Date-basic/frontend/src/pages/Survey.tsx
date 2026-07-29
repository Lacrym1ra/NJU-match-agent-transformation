import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  getQuestions,
  getAnswers,
  submitAnswers,
  Question,
  AnswerValue,
} from '../api/survey';
import MaterialIcon from '../components/MaterialIcon';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { computePersonality, unwrapAnswers } from '../lib/personalityEngine';
import { TYPE_INFO, STORAGE_KEY_RESULT, PersonalityResult } from '../lib/personalityConfig';

// 判断当前是否处于匹配锁定期间（北京时间周三 18:00 - 20:00）
function getIsMatchingLocked(): boolean {
  const now = new Date();
  const bj = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 8 * 3600000);
  const day = bj.getDay();
  const hour = bj.getHours();
  return day === 3 && hour >= 18 && hour < 20;
}

// ===== 选项中文标签 =====
const OPTION_LABELS: Record<string, string> = {
  // 模块名称
  basics: '基础信息', pacing: '恋爱节奏', interests: '兴趣爱好',
  lifestyle: '生活习惯', communication: '相处沟通', boundary: '边界安全感',
  values: '价值观', emotional: '情感风格', summary: '总结',

  // 空间融入
  high_integration: '希望两个人尽量融入彼此的朋友圈和生活',
  balanced_space: '希望彼此熟悉对方生活圈，但也保留各自空间',
  high_independence: '更希望各自保持相对独立，不过度绑定彼此生活圈',
  space_depends: '看人和相处感觉，不固定',

  // MBTI
  intj: 'INTJ', intp: 'INTP', entj: 'ENTJ', entp: 'ENTP',
  infj: 'INFJ', infp: 'INFP', enfj: 'ENFJ', enfp: 'ENFP',
  istj: 'ISTJ', isfj: 'ISFJ', estj: 'ESTJ', esfj: 'ESFJ',
  istp: 'ISTP', isfp: 'ISFP', estp: 'ESTP', esfp: 'ESFP',
  any_mbti: '无所谓',

  // 通用
  yes: '是', no: '不是', neutral: '无所谓',

  // 核心匹配偏好 (q_must_align)
  life_habit: '生活习惯', schedule_vibe: '个人节奏与氛围', interests_shared: '共同爱好',
  comm_style: '沟通方式', values_money: '金钱观与消费观', values_future: '未来规划', family_bg: '家庭背景',

  // 基础偏好
  prefer_same_city: '偏好同城市',
  prefer_same_province: '偏好同省', prefer_nearby: '偏好邻近地区',
  same_grade: '与我同级', lower_grade: '低年级', higher_grade: '高年级',
  strict_same_major: '一定同学院', prefer_same_major: '偏好同学院',
  strict_diff_major: '一定不同学院', prefer_diff_major: '偏好不同学院',
  same_campus_only: '只接受同校区', nanjing_campuses: '南京校区都行',
  select_campuses: '自选接受的校区', any_campus: '都可以',
  // 南大四校区
  xianlin: '仙林校区', gulou: '鼓楼校区', pukou: '浦口校区', suzhou_campus: '苏州校区',
  // 江苏省内城市
  nanjing: '南京', suzhou: '苏州', wuxi: '无锡', changzhou: '常州',
  zhenjiang: '镇江', yangzhou: '扬州', taizhou: '泰州', nantong: '南通',
  yancheng: '盐城', lianyungang: '连云港', huaian: '淮安', suqian: '宿迁', xuzhou: '徐州',

  // 恋爱节奏 (pacing)
  serious_stable: '认真稳定型', feel_it_out: '慢慢了解再说',
  casual_no_pressure: '随缘无压力', depends_on_person: '看人来',
  slow_careful: '慢热谨慎', fast_if_chemistry: '来电就快',
  depends: '看情况', unsure: '不确定',
  prefer_slow: '希望慢一些', prefer_fast: '希望快一些',
  match_mine: '跟我一样就好', no_preference: '没有特别偏好',

  // 兴趣
  gym_fitness: '健身', running_outdoor: '徒步户外', ball_sports: '球类运动',
  swimming_dance: '游泳舞蹈', movies_series: '电影剧集', gaming: '游戏',
  anime_acg: '动漫二次元', boardgame_larp: '桌游剧本杀',
  photo_exhibitions: '摄影看展', reading_writing: '阅读写作', fiction_fanfic: '小说同人',
  food_exploring: '探店/美食', travel_citywalk: '旅行CityWalk',
  pets: '宠物', live_show: 'Live/演出', programming_geek: '编程极客',
  finance_business: '金融商业', other_interest: '其他',
  music_listening: '听歌/音乐',

  // 兴趣 - 音乐
  c_pop: '华语流行', k_pop: '韩流', j_pop: '日音', western_pop: '欧美流行', rock: '摇滚',
  hip_hop_rap: '说唱', r_and_b: 'R&B / 灵魂乐', electronic_dance: '电音 / 舞曲',
  classical: '古典', jazz_blues: '爵士 / 布鲁斯', folk_country: '民谣 / 乡村',
  indie: '独立音乐', acg_vocaloid: 'ACG / Vocaloid',

  // 约会内容 (q19)
  eat_explore: '吃饭探店', walk_citywalk: '散步CityWalk', movie_series: '看电影/追剧',
  sports: '运动', exhibition_photo: '看展拍照', study: '一起学习',
  live_concert: 'Live/演唱会', travel_nearby: '周边游', just_chat: '纯聊天',
  // 周末约会 (q20)
  campus_fine: '校内就好', both_ok: '都可以', prefer_outside: '更喜欢校外',

  // 生活习惯
  rarely: '几乎不喝', occasionally: '偶尔小酌', sometimes: '社交场合会喝', frequently: '经常喝',
  early_sleep_early_rise: '早睡早起', early_sleep_late_rise: '早睡晚起',
  late_sleep_late_rise: '晚睡晚起', late_sleep_early_rise: '晚睡早起',
  experience: '体验（旅游演唱会等）', material: '实物', balanced: '平衡',
  share_equally: 'AA', i_pay_more: '我多出', partner_pays_more: '对方多出', go_with_flow: '不分那么清',
  // 有空时间 (q29)
  weekday_day: '工作日白天', weekday_night: '工作日晚上',
  sat_day: '周六白天', sat_night: '周六晚上', sun_day: '周日白天', sun_night: '周日晚上',

  // 沟通 (communication)
  lively_talkative: '热闹话多', mix_talk_quiet: '有说有笑也有安静',
  quiet_comfy: '安静舒适', depends_mood: '看心情',
  talk_now: '立刻说清楚', cool_then_talk: '冷静一会再说',
  avoid_delay: '回避/拖延', cool_first: '先冷静再说',
  no_pressure: '不给压力就好', dont_care: '无所谓',
  emotional_support: '情绪安抚', analyze_problem: '分析问题', both: '两者都要',
  very_fast: '秒回/很快', normal: '正常', slow: '比较慢',
  proactive: '我是主动的一方', prefer_partner_active: '我更希望对方主动', mutual_active: '双向奔赴互相主动', casual_flow: '顺其自然发展',

  // 边界 (boundary)
  zero: '0段', one: '1段', two: '2段', three_plus: '3段以上', prefer_not_say: '不想说',
  // 雷点 (q49)
  ghost_msg: '人间蒸发不回消息', flirt_opposite: '暧昧不清', emotional_unstable: '情绪不稳定',
  phone_control: '控制手机/监控', too_clingy: '太粘人', too_cold: '太冷淡/忽冷忽热',
  stand_up: '放鸽子/不守时', spend_gap: '消费观差距大',
  hurtful_words: '说伤人的话', disrespect_circle: '不尊重我的社交圈', other_flag: '其他',

  // 价值观 (values)
  tier1_core: '一线核心城区', tier2: '二线城市', tier3_4: '三四线城市',
  county: '县城', rural: '农村',
  tight: '紧张', comfortable: '舒适', very_comfortable: '非常宽裕',
  prefer_not_to_say: '不愿透露',
  // 未来发展地区 (q_future_base)
  sichuan_chongqing: '川渝', east_china_other: '华东其他', north_china: '华北',
  central_china: '华中', south_china: '华南', southwest: '西南', northwest: '西北',
  northeast: '东北', hk_macao_tw_overseas: '港澳台/海外',
  undecided: '还没想好', opportunity_first: '机会优先',

  // 品质
  kindness: '善良', honesty: '诚实', loyalty: '忠诚', integrity: '正直',
  self_discipline: '自律', ambition: '野心', independence: '独立',
  curiosity: '好奇心', creativity: '创造力', family: '家庭',
  freedom: '自由', friendship: '友谊', fairness: '公平',
  courage: '勇气', adventure: '冒险', faith: '信仰',

  // 爱的语言排序
  praise: '夸奖', quality_time: '陪伴', gift: '送礼物',
  acts_of_service: '服务意识', physical_touch: '牵手、拥抱等',

  // 省份
  beijing: '北京', tianjin: '天津', hebei: '河北', shanxi: '山西',
  inner_mongolia: '内蒙古', liaoning: '辽宁', jilin: '吉林', heilongjiang: '黑龙江',
  shanghai: '上海', jiangsu: '江苏', zhejiang: '浙江', anhui: '安徽',
  fujian: '福建', jiangxi: '江西', shandong: '山东',
  henan: '河南', hubei: '湖北', hunan: '湖南',
  guangdong: '广东', guangxi: '广西', hainan: '海南',
  chongqing: '重庆', sichuan: '四川', guizhou: '贵州', yunnan: '云南', tibet: '西藏',
  shanxi_sx: '陕西', gansu: '甘肃', qinghai: '青海', ningxia: '宁夏', xinjiang: '新疆',
  hongkong: '香港', macao: '澳门', taiwan: '台湾', overseas: '海外', unknown: '不透露',

  // ── 兴趣分支 ──────────────────────────────────
  // A: 电影/剧集
  comedy: '喜剧', romance: '爱情', suspense_crime: '悬疑/犯罪', sci_fi: '科幻',
  action: '动作', horror: '恐怖', arthouse: '文艺片', animation: '动画', documentary: '纪录片',
  cn_drama: '国产剧', us_drama: '美剧', uk_drama: '英剧', kr_drama: '韩剧',
  jp_drama: '日剧', movie: '电影',
  watch_offline: '线下一起看', watch_online: '线上一起看', discuss_plot: '讨论剧情', all_fine: '都可以',
  // B: 桌游/剧本杀
  werewolf_avalon: '狼人杀/阿瓦隆', party_boardgame: '聚会桌游',
  german_strategy: '德策/策略桌游', murder_mystery: '剧本杀', escape_room: '密室逃脱',
  no_bail: '不放鸽子', logic_matters: '逻辑很重要', chill_vibe: '氛围轻松',
  newbie_friendly: '新手友好', prefer_friends: '偏好和朋友一起',
  // C: 动漫/ACG
  anime: '番剧', manga: '漫画', light_novel: '轻小说', fanfic: '同人',
  cosplay: 'Cosplay', convention: '漫展', vtuber: 'VTuber', goods: '周边/手办',
  watch_anime: '一起看番', go_convention: '一起逛漫展',
  discuss_chars: '讨论角色/剧情', buy_goods: '一起买周边',
  // D: 摄影/看展
  portrait: '人像摄影', street: '街拍', film: '胶片', digital: '风光',
  art_museum: '美术馆', museum: '博物馆', photo_exhibition: '摄影展', installation: '装置艺术',
  ph_newbie: '纯小白', ph_casual: '偶尔看看', ph_experienced: '经验丰富', ph_pro: '专业大佬/老法师',
  focus_photo: '对方很会拍照/出片', focus_art: '探讨艺术与审美', focus_company: '纯陪伴/不看重这些',
  // E: 美食
  cheap_eats: '平价美食', cafe_dessert: '咖啡甜点', hotpot_bbq: '火锅烧烤',
  jp_kr_food: '日韩料理', western_brunch: '西餐Brunch', milk_tea: '奶茶饮品',
  late_night: '夜宵', hidden_gem: '隐藏好店', home_cook: '自己做饭',
  taste: '味道好', value_money: '性价比高', good_chat: '聊得来',
  nice_ambiance: '环境好', close_by: '距离近', instagrammable: '适合拍照',
  // F: 旅行
  campus_walk: '校园漫步', city_walk: '城市漫步', cafe_hop: '咖啡店巡礼',
  short_trip: '周末短途', speed_trip: '快节奏旅行', slow_stroll: '慢慢逛',
  photo_spot: '打卡拍照', random_explore: '随机探索',
  detailed_plan: '详细计划', rough_plan: '大致规划', totally_random: '完全随机',
  // G: 运动
  weight_training: '力量训练', running: '跑步', cycling: '骑行',
  badminton: '羽毛球', table_tennis: '乒乓球', tennis: '网球',
  basketball: '篮球', football: '足球', swimming: '游泳', volleyball: '排球', billiards: '台球/桌球', other_specify: '其他（请补充）',
  yoga_pilates: '瑜伽/普拉提', dancing: '舞蹈', hiking_climbing: '徒步/攀岩',
  sp_newbie: '新手/偶尔动动', sp_casual: '休闲娱乐', sp_regular: '规律运动', sp_pro: '运动达人',
  long_term: '长期运动搭子', similar_level: '水平相近', pure_company: '纯陪伴', need_coach: '教我的',
  // J: 阅读与写作
  lit_fiction: '文学/小说', sci_fi_fantasy: '科幻/奇幻', history_bio: '历史/传记',
  philosophy_social: '哲学/社科', science_tech: '科学/技术', business_econ: '商业/经济',
  poetry_essay: '诗歌/散文', comics_picture_book: '漫画/绘本',
  romance_novel: '言情', suspense_thriller: '悬疑/惊悚', wuxia_xianxia: '武侠/仙侠',
  sci_fi_novel: '科幻', fantasy_magic: '奇幻/魔法', bl_danmei: '耽美/BL',
  gl_baihe: '百合/GL', fanfic_novel: '同人衍生',
  // H: 游戏
  mobile: '手游', pc: 'PC/端游', switch_console: 'Switch/主机',
  single_player: '单机', follow_friends: '朋友玩啥我玩啥',
  moba: 'MOBA', fps: 'FPS/射击', open_world_rpg: '开放世界/RPG',
  gacha: '抽卡手游', party_casual: '聚会/休闲', rhythm: '音游',
  card_strategy: '卡牌/策略', simulation: '模拟经营',
  story_puzzle: '剧情/解谜', survival_build: '生存/建造',
  honor_of_kings: '王者荣耀', tft: '金铲铲/云顶', pubg_mobile: '和平精英',
  eggy_party: '蛋仔派对', genshin: '原神', star_rail: '崩铁', wuthering: '鸣潮',
  arknights: '明日方舟', love_nikki: '恋与/闪暖', identity_v: '第五人格',
  lol: '英雄联盟', valorant: '无畏契约', cs2: 'CS2', apex: 'Apex',
  ow2: '守望先锋', dbd: '黎明杀机', minecraft: 'Minecraft', gta5: 'GTA5',
  stardew: '星露谷', r6: '彩六', warframe: 'Warframe', it_takes_two: '双人成行',
  delta_force: '三角洲行动', marvel_rivals: '漫威争锋', dota2: 'Dota2', rock_kingdom_world: '洛克王国：世界',
  zelda: '塞尔达传说', mario_kart: '马里奥赛车', animal_crossing: '动物森友会',
  pokemon: '宝可梦', smash_bros: '大乱斗', splatoon: '斯普拉遁',
  overcooked: '胡闹厨房', minecraft_sw: 'Minecraft(NS)', xenoblade: '异度神剑', stardew_sw: '星露谷(NS)',
  newbie: '新手', casual: '休闲玩家', experienced: '有经验', tryhard: '认真型', depends_game: '看游戏',
  some_gap_ok: '对面带我', must_close: '水平相近',
  carry_or_carried: '我带对面',
  serious_win: '认真打/想赢', chill: '躺着玩', close_friends: '只和亲近的人玩', anything_works: '什么都行',
  friends_only: '只和朋友玩',
};
const label = (opt: string) => OPTION_LABELS[opt] ?? opt;

const numericKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
  if (!allowed.includes(e.key) && !/^\d$/.test(e.key)) e.preventDefault();
};

const MULTI_SELECT_PREFIX_BASES = new Set(['other_interest', 'other_specify']);

function sanitizeOptionArray(rawValue: unknown, options: string[] = [], allowPrefixed: boolean): string[] {
  const optionSet = new Set(options);
  const source = Array.isArray(rawValue) ? rawValue : (typeof rawValue === 'string' ? [rawValue] : []);
  const sanitized: string[] = [];
  const seen = new Set<string>();

  for (const item of source) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed) continue;

    let normalized: string | undefined;
    if (optionSet.has(trimmed)) {
      normalized = trimmed;
    } else if (allowPrefixed && trimmed.includes(':')) {
      const idx = trimmed.indexOf(':');
      const base = trimmed.slice(0, idx);
      if (optionSet.has(base) && MULTI_SELECT_PREFIX_BASES.has(base)) {
        normalized = trimmed;
      }
    }

    if (!normalized) continue;
    const dedupeKey = normalized.includes(':') ? normalized.split(':')[0] : normalized;
    if (seen.has(dedupeKey)) continue;

    seen.add(dedupeKey);
    sanitized.push(normalized);
  }

  return sanitized;
}

function sanitizeAnswerByQuestion(question: Question, answerRaw: unknown): AnswerValue | undefined {
  if (!answerRaw || typeof answerRaw !== 'object') return undefined;
  const answer = answerRaw as { value?: unknown; importance?: unknown };
  const value = answer.value;

  switch (question.type) {
    case 'single_select': {
      if (typeof value !== 'string') return undefined;
      if (!question.options?.includes(value)) return undefined;
      return { value };
    }
    case 'multi_select': {
      const options = question.options || [];
      const sanitized = sanitizeOptionArray(value, options, true);
      if (sanitized.length === 0) return undefined;
      const max = question.maxSelect || options.length;
      return { value: sanitized.slice(0, max) };
    }
    case 'ranking': {
      const options = question.options || [];
      const sanitized = sanitizeOptionArray(value, options, false);
      if (sanitized.length !== options.length) return undefined;
      const set = new Set(sanitized);
      if (set.size !== options.length) return undefined;
      for (const opt of options) {
        if (!set.has(opt)) return undefined;
      }
      return { value: sanitized };
    }
    case 'likert': {
      if (typeof value !== 'number' || Number.isNaN(value)) return undefined;
      const min = question.scale?.min ?? 1;
      const max = question.scale?.max ?? 7;
      if (value < min || value > max) return undefined;
      const importance = typeof answer.importance === 'number' ? answer.importance : undefined;
      return importance ? { value, importance } : { value };
    }
    case 'open_text': {
      if (typeof value !== 'string' || !value.trim()) return undefined;
      return { value };
    }
    case 'number_input': {
      if (typeof value !== 'number' || Number.isNaN(value)) return undefined;
      return { value };
    }
    case 'year_range':
    case 'height_range': {
      if (!value || typeof value !== 'object') return undefined;
      const range = value as { min?: unknown; max?: unknown };
      const minVal = typeof range.min === 'number' && !Number.isNaN(range.min) ? range.min : undefined;
      const maxVal = typeof range.max === 'number' && !Number.isNaN(range.max) ? range.max : undefined;
      if (minVal === undefined && maxVal === undefined) return undefined;
      if (minVal !== undefined && maxVal !== undefined && maxVal <= minVal) return undefined;
      return { value: { ...(minVal !== undefined ? { min: minVal } : {}), ...(maxVal !== undefined ? { max: maxVal } : {}) } } as AnswerValue;
    }
    default:
      return undefined;
  }
}

function sanitizeAnswerRecord(
  answers: Record<string, unknown>,
  questionMap: Map<string, Question>,
): Record<string, AnswerValue> {
  const sanitized: Record<string, AnswerValue> = {};
  for (const [qId, raw] of Object.entries(answers || {})) {
    const question = questionMap.get(qId);
    if (!question) continue;
    const cleaned = sanitizeAnswerByQuestion(question, raw);
    if (cleaned) sanitized[qId] = cleaned;
  }
  return sanitized;
}

// ===== 各题型渲染组件 =====

const SingleSelect = ({
  question,
  value,
  onSelect,
}: {
  question: Question;
  value: string | undefined;
  onSelect: (v: string) => void;
}) => {
  const options = question.options || [];
  const isLargeList = options.length > 8;
  const isScrollableList = options.length > 20;
  const [search, setSearch] = useState('');

  if (isScrollableList) {
    const filtered = search
      ? options.filter((opt) => label(opt).includes(search))
      : options;
    return (
      <div className="flex flex-col gap-3">
        <div className="relative">
          <MaterialIcon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8B7355]/50 text-[20px]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            placeholder="搜索..."
            className="w-full bg-[#F3F1ED]/60 text-[#2C2825] pl-11 pr-4 py-3 rounded-xl outline-none focus:bg-[#EAE7E1]/60 transition-colors placeholder:text-[#B5AFA6] font-serif text-sm"
          />
        </div>
        <div className="max-h-[45vh] overflow-y-auto rounded-xl scrollbar-hide">
          <div className="grid grid-cols-3 md:grid-cols-4 gap-1.5">
            {filtered.map((opt) => {
              const isSelected = value === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onSelect(opt)}
                  className={`px-3 py-3 rounded-lg transition-all duration-300 text-center
                    ${isSelected
                      ? 'bg-[#C8BFB5] text-[#2C2825] shadow-inner font-medium'
                      : 'bg-[#F3F1ED]/40 text-[#8B7355] hover:bg-[#F3F1ED] hover:text-[#2C2825]'
                    }`}
                >
                  <span className="font-serif text-sm tracking-wide">{label(opt)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`grid gap-2 md:gap-3 ${isLargeList ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-1'}`}>
      {options.map((opt) => {
        const isSelected = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onSelect(opt)}
            className={`w-full text-left px-5 py-4 md:px-8 md:py-6 rounded-xl md:rounded-2xl transition-all duration-500 ease-out flex items-center justify-between group
              ${isSelected
                ? 'bg-[#C8BFB5] text-[#2C2825] shadow-inner font-medium'
                : 'bg-transparent text-[#8B7355] hover:bg-[#F3F1ED]/50 hover:text-[#2C2825] font-light'
              } ${isLargeList ? 'px-4 py-3 md:px-6 md:py-4 justify-center text-center' : ''}`}
          >
            <span className="font-serif text-[15px] md:text-xl tracking-wide">{label(opt)}</span>
            {!isLargeList && (
              <span className={`h-[1px] transition-all duration-500 ${isSelected ? 'bg-[#2C2825] w-8' : 'bg-transparent group-hover:bg-[#8B7355]/30 w-4'}`} />
            )}
          </button>
        );
      })}
    </div>
  );
};

const LikertScale = ({
  question,
  value,
  importance,
  onChange,
}: {
  question: Question;
  value: number | undefined;
  importance: number | undefined;
  onChange: (v: number, imp: number) => void;
}) => {
  const [localVal, setLocalVal] = useState<number | undefined>(value);
  const [localImp, setLocalImp] = useState<number | undefined>(importance);

  useEffect(() => { setLocalVal(value); setLocalImp(importance); }, [value, importance]);

  // 选分值时自动把重要性默认设为 1
  const selectVal = (v: number) => {
    setLocalVal(v);
    const imp = localImp ?? 1;
    setLocalImp(imp);
    onChange(v, imp);
  };

  // 点击第 n 颗星：当前已选 >=n+1 星则退回 n 星，否则升到 n+1 星（最小 1）
  const toggleStar = (starImp: number) => {
    const newImp = (localImp ?? 1) >= starImp ? starImp - 1 || 1 : starImp;
    setLocalImp(newImp);
    if (localVal !== undefined) onChange(localVal, newImp);
  };

  const starred = (localImp ?? 1) > 1;

  return (
    <div className="flex flex-col gap-10">
      {/* 1-7 量表 */}
      <div className="flex flex-col gap-6 items-center w-full">
        <div className="flex w-full max-w-2xl justify-between items-end px-2 text-sm text-[#8B7355] tracking-widest font-medium">
          <span className="text-[#a89076]">{question.scale?.minLabel ?? '完全不同意'}</span>
          <span className="text-[#8B7355]">{question.scale?.maxLabel ?? '完全同意'}</span>
        </div>
<div className="flex gap-1 md:gap-5 lg:gap-6 justify-between items-center w-full max-w-2xl px-0 sm:px-4">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => {
              // 越靠近两端尺寸越大
              const getSizeClass = (num: number) => {
                if (num === 4) return 'w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-xs sm:text-base md:text-lg';
                if (num === 3 || num === 5) return 'w-[36px] h-[36px] sm:w-12 sm:h-12 md:w-14 md:h-14 text-[13px] sm:text-lg md:text-xl';
                if (num === 2 || num === 6) return 'w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16 text-sm sm:text-xl md:text-2xl';
                return 'w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 text-base sm:text-2xl md:text-3xl border-2';
            };
            
            const isSelected = localVal === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => selectVal(n)}
                className={`rounded-full font-serif flex items-center justify-center transition-all duration-300 active:scale-90 shrink-0
                  ${getSizeClass(n)}
                  ${isSelected
                    ? 'bg-[#C8BFB5] text-[#2C2825] shadow-md border-transparent scale-110 ring-4 ring-[#C8BFB5]/30'
                    : 'bg-[#F3F1ED]/60 text-[#8B7355] hover:bg-[#EAE7E1] hover:scale-110 border-transparent'
                  }
                  ${(n === 1 || n === 7) && !isSelected ? 'border-[#EAE7E1]' : ''}
                `}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>

      {/* 重要性：单星 */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => toggleStar(2)}
          className="transition-all duration-200 hover:scale-110"
        >
          <MaterialIcon name="star" className={`text-2xl transition-colors duration-200
            ${starred
              ? "text-[#8B7355]"
              : "text-[#D5CFC7]"}`}
            style={{ fontVariationSettings: `'FILL' ${starred ? 1 : 0}, 'GRAD' 0, 'opsz' 24` }}
          />
        </button>
        <span className="text-xs text-[#8B7355] tracking-wide">
          重要{starred ? '（此题权重已提升）' : '（标星可提升此题匹配权重）'}
        </span>
      </div>
    </div>
  );
};

const MultiSelect = ({
  question,
  value = [], // Default to array to prevent undefined issues
  onChange,
}: {
  question: Question;
  value: string[];
  onChange: (v: string[]) => void;
}) => {
  const options = question.options || [];
  const safeValue = sanitizeOptionArray(value, options, true);
  const max = question.maxSelect || (question.options?.length ?? 999);

  const getBaseOpt = (val: string) => {
    if (typeof val !== 'string') return val;
    if (val.startsWith('other_interest:')) return 'other_interest';
    if (val.startsWith('other_specify:')) return 'other_specify';
    return val;
  };

  const getSpecifyText = (opt: string) => {
    const found = safeValue.find(v => getBaseOpt(v) === opt);
    if (!found || typeof found !== 'string') return '';
    const parts = found.split(':');
    return parts.length > 1 ? parts.slice(1).join(':') : '';
  };

  const toggle = (opt: string) => {
    const isSpecial = opt === 'other_interest' || opt === 'other_specify';
    const isSelected = safeValue.some(v => getBaseOpt(v) === opt);

    if (isSelected) {
      onChange(safeValue.filter((v) => getBaseOpt(v) !== opt));
    } else if (opt === 'any_mbti') {
      onChange([opt]);
    } else {
      const filtered = safeValue.filter((v) => v !== 'any_mbti');
      if (filtered.length < max) {
        onChange([...filtered, isSpecial ? `${opt}:` : opt]);
      }
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs tracking-widest text-[#8B7355] mb-2">最多选 {max} 项（已选 {safeValue.length}）</div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
      {options.map((opt) => {
        const isSpecial = opt === 'other_interest' || opt === 'other_specify';
        const isSelected = safeValue.some(v => getBaseOpt(v) === opt);
        const hasExclusive = safeValue.includes('any_mbti');
        const isDisabled = !isSelected && (
          (hasExclusive && opt !== 'any_mbti') ||
          (!hasExclusive && safeValue.length >= max)
        );
        return (
          <div key={opt} className={`w-full ${isSpecial && isSelected ? 'col-span-2 md:col-span-3' : ''}`}>
            <button
              type="button"
              onClick={() => toggle(opt)}
              disabled={isDisabled}
              className={`w-full text-left px-3 py-3 md:px-6 md:py-4 rounded-xl md:rounded-2xl transition-all duration-300 flex items-center gap-2 md:gap-4
                ${isSelected
                  ? 'bg-[#C8BFB5] text-[#2C2825] font-medium'
                  : isDisabled
                    ? 'bg-transparent text-[#B5AFA6] cursor-not-allowed'
                    : 'bg-transparent text-[#8B7355] hover:bg-[#F3F1ED]/50 hover:text-[#2C2825]'
                }`}
            >
              <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all
                ${isSelected ? 'bg-[#8B7355] border-[#8B7355]' : 'border-[#8B7355]/40'}`}>
                {isSelected && <div className="w-2 h-2 bg-white rounded-sm" />}
              </div>
              <span className="font-serif text-[15px] md:text-lg tracking-wide leading-tight">{label(opt)}</span>
            </button>
            {isSpecial && isSelected && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-2">
                <input
                  type="text"
                  placeholder="请在此补充具体喜好..."
                  value={getSpecifyText(opt)}
                  onChange={(e) => {
                    const newText = e.target.value;
                    onChange(safeValue.map(v => getBaseOpt(v) === opt ? `${opt}:${newText}` : v));
                  }}
                  className="w-full bg-[#F3F1ED] text-[#2C2825] px-5 py-3 rounded-xl outline-none focus:bg-[#EAE7E1] transition-colors placeholder:text-[#B5AFA6] font-serif text-base"
                />
              </motion.div>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
};

const RankingInput = ({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: string[];
  onChange: (v: string[]) => void;
}) => {
  const options = question.options || [];
  
  // 保证排序项有完整的初值（默认按原数组排序）
  const currentOrder = value && value.length === options.length ? value : options;
  const isAnswered = value && value.length > 0;

  const handleReorder = (newOrder: string[]) => {
    onChange(newOrder);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs tracking-widest text-[#8B7355] mb-2">
        长按选项拖动进行排序，越靠上越偏好（拖拽即可完成作答）
      </div>

      <Reorder.Group axis="y" values={currentOrder} onReorder={handleReorder} className="flex flex-col gap-3">
        {currentOrder.map((opt, i) => (
          <Reorder.Item
            key={opt}
            value={opt}
            className={`flex items-center gap-4 px-6 py-4 rounded-xl text-left transition-colors duration-200 cursor-grab active:cursor-grabbing backdrop-blur-sm select-none
              ${isAnswered ? 'bg-[#EAE7E1] text-[#2C2825]' : 'bg-[#F3F1ED] text-[#8B7355]'} 
              hover:bg-[#D5CFC7] shadow-sm relative z-0`}
          >
            <span className="font-serif text-[#8B7355] text-sm w-5 text-center shrink-0">{i + 1}</span>
            <span className="flex-1 font-serif text-lg pointer-events-none">{label(opt)}</span>
            <MaterialIcon name="drag_indicator" className="text-[20px] text-[#8B7355]/50 pointer-events-none" />
          </Reorder.Item>
        ))}
      </Reorder.Group>

      {!isAnswered && (
        <button 
          type="button" 
          onClick={() => onChange(currentOrder)}
          className="mt-2 text-xs tracking-widest text-[#8B7355] underline decoration-[#8B7355]/30 hover:text-[#2C2825] transition-colors"
        >
          点击直接确认当前默认排序
        </button>
      )}
    </div>
  );
};

const OpenText = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) => (
  <textarea
    value={value}
    onChange={(e) => onChange(e.target.value)}
    onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })}
    placeholder="请在此留下你的思考……"
    rows={5}
    className="w-full bg-[#F3F1ED]/60 text-[#2C2825] px-6 py-5 rounded-2xl outline-none focus:bg-[#EAE7E1]/60 transition-colors placeholder:text-[#B5AFA6] font-serif text-lg leading-relaxed resize-none"
  />
);

const NumberInput = ({
  value,
  onChange,
  min,
  max,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  min?: number;
  max?: number;
}) => {
  const outOfRange = value !== undefined && ((min !== undefined && value < min) || (max !== undefined && value > max));
  return (
    <div className="flex flex-col gap-4">
      <input
        type="number"
        inputMode="numeric"
        value={value === undefined ? '' : value}
        min={min}
        max={max}
        onChange={(e) => {
          if (e.target.value === '') {
            onChange(undefined);
            return;
          }
          onChange(Number(e.target.value));
        }}
        onKeyDown={numericKeyDown}
        placeholder={min && max ? `${min} - ${max}` : '请输入数字'}
        onFocus={(e) => e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })}
        className={`w-full bg-[#F3F1ED]/60 text-[#2C2825] text-center px-6 py-5 rounded-2xl outline-none focus:bg-[#EAE7E1]/60 transition-colors placeholder:text-[#B5AFA6] font-serif text-3xl ${outOfRange ? 'ring-2 ring-red-300/60' : ''}`}
      />
      {outOfRange && (
        <p className="text-center text-sm text-red-400 font-serif tracking-wide">请输入 {min} 至 {max} 之间的数字</p>
      )}
    </div>
  );
};

const YearRangeInput = ({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: { min?: number; max?: number } | undefined;
  onChange: (v: { min?: number; max?: number } | undefined) => void;
}) => {
  const bound = { min: question.min ?? 1991, max: question.max ?? 2008 };
  const minVal = value?.min;
  const maxVal = value?.max;
  const orderError = minVal !== undefined && maxVal !== undefined && maxVal <= minVal;
  const minOutOfRange = minVal !== undefined && (minVal < bound.min || minVal > bound.max);
  const maxOutOfRange = maxVal !== undefined && (maxVal < bound.min || maxVal > bound.max);

  const handleMin = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value === '' ? undefined : Number(e.target.value);
    if (v === undefined && maxVal === undefined) onChange(undefined);
    else onChange({ min: v, max: maxVal });
  };
  const handleMax = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value === '' ? undefined : Number(e.target.value);
    if (minVal === undefined && v === undefined) onChange(undefined);
    else onChange({ min: minVal, max: v });
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-6">
        <div className="flex flex-col items-center gap-2 flex-1">
          <span className="text-xs tracking-widest text-[#8B7355]">最早（下限）</span>
          <input
            type="number"
            value={minVal === undefined ? '' : minVal}
            min={bound.min}
            max={bound.max}
            onChange={handleMin}
            onKeyDown={numericKeyDown}
            inputMode="numeric"
            title="出生年份下限"
            placeholder={String(bound.min)}
            className={`w-full bg-[#F3F1ED]/60 text-[#2C2825] text-center px-4 py-5 rounded-2xl outline-none focus:bg-[#EAE7E1]/60 transition-colors font-serif text-3xl placeholder:text-[#B5AFA6] ${minOutOfRange ? 'ring-2 ring-red-300/60' : ''}`}
          />
        </div>
        <span className="font-serif text-2xl text-[#8B7355] mt-6">—</span>
        <div className="flex flex-col items-center gap-2 flex-1">
          <span className="text-xs tracking-widest text-[#8B7355]">最晚（上限）</span>
          <input
            type="number"
            value={maxVal === undefined ? '' : maxVal}
            min={bound.min}
            max={bound.max}
            onChange={handleMax}
            onKeyDown={numericKeyDown}
            inputMode="numeric"
            title="出生年份上限"
            placeholder={String(bound.max)}
            className={`w-full bg-[#F3F1ED]/60 text-[#2C2825] text-center px-4 py-5 rounded-2xl outline-none focus:bg-[#EAE7E1]/60 transition-colors font-serif text-3xl placeholder:text-[#B5AFA6] ${maxOutOfRange ? 'ring-2 ring-red-300/60' : ''}`}
          />
        </div>
      </div>
      {orderError && (
        <p className="text-center text-sm text-red-400 font-serif tracking-wide">上限须大于下限</p>
      )}
      {(minOutOfRange || maxOutOfRange) && (
        <p className="text-center text-sm text-red-400 font-serif tracking-wide">年份范围应在 {bound.min} 至 {bound.max} 之间</p>
      )}
      {!orderError && !minOutOfRange && !maxOutOfRange && minVal !== undefined && maxVal !== undefined && (
        <p className="text-center text-sm text-[#8B7355] font-serif tracking-wide">
          接受 {minVal} 年至 {maxVal} 年出生
        </p>
      )}
    </div>
  );
};

const HeightRangeInput = ({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: { min?: number; max?: number } | undefined;
  onChange: (v: { min?: number; max?: number } | undefined) => void;
}) => {
  const bound = { min: question.min ?? 140, max: question.max ?? 210 };
  const minVal = value?.min;
  const maxVal = value?.max;
  const orderError = minVal !== undefined && maxVal !== undefined && maxVal <= minVal;
  const minOOR = minVal !== undefined && (minVal < bound.min || minVal > bound.max);
  const maxOOR = maxVal !== undefined && (maxVal < bound.min || maxVal > bound.max);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-6">
        <div className="flex flex-col items-center gap-2 flex-1">
          <span className="text-xs tracking-widest text-[#8B7355]">最矮（cm）</span>
          <input type="number" inputMode="numeric" value={minVal === undefined ? '' : minVal}
            min={bound.min} max={bound.max}
            onChange={(e) => { const v = e.target.value === '' ? undefined : Number(e.target.value); onChange(v === undefined && maxVal === undefined ? undefined : { min: v, max: maxVal }); }}
            onKeyDown={numericKeyDown} placeholder={String(bound.min)}
            className={`w-full bg-[#F3F1ED]/60 text-[#2C2825] text-center px-4 py-5 rounded-2xl outline-none focus:bg-[#EAE7E1]/60 transition-colors font-serif text-3xl placeholder:text-[#B5AFA6] ${minOOR ? 'ring-2 ring-red-300/60' : ''}`}
          />
        </div>
        <span className="font-serif text-2xl text-[#8B7355] mt-6">—</span>
        <div className="flex flex-col items-center gap-2 flex-1">
          <span className="text-xs tracking-widest text-[#8B7355]">最高（cm）</span>
          <input type="number" inputMode="numeric" value={maxVal === undefined ? '' : maxVal}
            min={bound.min} max={bound.max}
            onChange={(e) => { const v = e.target.value === '' ? undefined : Number(e.target.value); onChange(minVal === undefined && v === undefined ? undefined : { min: minVal, max: v }); }}
            onKeyDown={numericKeyDown} placeholder={String(bound.max)}
            className={`w-full bg-[#F3F1ED]/60 text-[#2C2825] text-center px-4 py-5 rounded-2xl outline-none focus:bg-[#EAE7E1]/60 transition-colors font-serif text-3xl placeholder:text-[#B5AFA6] ${maxOOR ? 'ring-2 ring-red-300/60' : ''}`}
          />
        </div>
      </div>
      {orderError && <p className="text-center text-sm text-red-400 font-serif tracking-wide">上限须大于下限</p>}
      {(minOOR || maxOOR) && <p className="text-center text-sm text-red-400 font-serif tracking-wide">身高范围应在 {bound.min} 至 {bound.max} cm 之间</p>}
      {!orderError && !minOOR && !maxOOR && minVal !== undefined && maxVal !== undefined && (
        <p className="text-center text-sm text-[#8B7355] font-serif tracking-wide">接受 {minVal}cm 至 {maxVal}cm</p>
      )}
    </div>
  );
};

// ===== 主组件 =====

const Survey = () => {
  const [sections, setSections] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [currentSectionIdx, setCurrentSectionIdx] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showSaveHint, setShowSaveHint] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [personalityReveal, setPersonalityReveal] = useState<PersonalityResult | null>(null);
  const [highlightedQIds, setHighlightedQIds] = useState<Set<string>>(new Set());
  const [showScrollHint, setShowScrollHint] = useState(true);
  const [surveyUpdated, setSurveyUpdated] = useState(false);
  const [changedQIds, setChangedQIds] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const goToDashboard = () => navigate('/dashboard', { replace: true });
  const { user, refreshUser } = useAuth();

  const navScrollRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);

  const DRAFT_KEY = 'survey_draft';
  const UNRESOLVED_QIDS_KEY = 'survey_unresolved_qids';
  const DRAFT_VERSION_KEY = 'survey_draft_version';
  const DRAFT_TIME_KEY = 'survey_draft_time';

  // 监听当前模块切换，自动滚动导航栏使其居中
  useEffect(() => {
    if (navScrollRef.current && activeTabRef.current) {
      const container = navScrollRef.current;
      const tab = activeTabRef.current;
      const scrollLeft = tab.offsetLeft - container.offsetWidth / 2 + tab.offsetWidth / 2;
      container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
    }
  }, [currentSectionIdx]);

  // 切换模块时重置滚动提示
  useEffect(() => {
    setShowScrollHint(true);
  }, [currentSectionIdx]);

  // 监听滚动，接近底部时隐藏提示
  useEffect(() => {
    const onScroll = () => {
      const scrolled = window.scrollY + window.innerHeight;
      const total = document.documentElement.scrollHeight;
      setShowScrollHint(scrolled < total - 120);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [currentSectionIdx]);

  // 答案变化时实时保存草稿
  useEffect(() => {
    if (Object.keys(answers).length > 0) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(answers));
      localStorage.setItem(DRAFT_TIME_KEY, Date.now().toString());
    }
  }, [answers]);

  useEffect(() => {
    if (surveyUpdated) {
      localStorage.setItem(UNRESOLVED_QIDS_KEY, JSON.stringify(Array.from(changedQIds)));
    }
  }, [changedQIds, surveyUpdated]);

  // q4 联动清除：如果 q3 从江苏切换到其他省份，且 q4 已选"偏好同城市"，自动清除
  useEffect(() => {
    const q3Val = (answers['q3'] as any)?.value;
    const q4Val = (answers['q4'] as any)?.value;
    if (q3Val !== 'jiangsu' && q4Val === 'prefer_same_city') {
      setAnswer('q4', undefined);
    }
  }, [(answers['q3'] as any)?.value]); // eslint-disable-line react-hooks/exhaustive-deps

  // 加载题目和已有答案（草稿优先）
  useEffect(() => {
    const load = async () => {
      try {
        const [qRes, aRes] = await Promise.allSettled([getQuestions(), getAnswers()]);
        let currentVersion = '';
        let changedIds: string[] = [];
        let questionMap = new Map<string, Question>();
        if (qRes.status === 'fulfilled') {
          setSections(qRes.value.sections);
          currentVersion = qRes.value.version;
          changedIds = qRes.value.changedQuestionIds || [];
          questionMap = new Map(
            qRes.value.sections
              .flatMap((sec) => sec.questions)
              .map((q) => [q.id, q]),
          );
        }

        const serverResponse = aRes.status === 'fulfilled' ? aRes.value : null;
        const serverAnswers =
          serverResponse && serverResponse.answers
            ? sanitizeAnswerRecord(serverResponse.answers as Record<string, unknown>, questionMap)
            : {};
        const submittedAt = serverResponse?.submittedAt;

        const draft = localStorage.getItem(DRAFT_KEY);
        const draftTimeStr = localStorage.getItem(DRAFT_TIME_KEY);
        const savedVersion = localStorage.getItem(DRAFT_VERSION_KEY);
        const serverVersion = serverResponse?.version;

        let draftAnswers: Record<string, AnswerValue> = {};
        let isValidDraft = false;

        if (draft) {
          const draftTime = draftTimeStr ? parseInt(draftTimeStr, 10) : 0;
          const serverTime = submittedAt ? new Date(submittedAt).getTime() : 0;
          
          // 版本校验优先：如果本地草稿是当前最新版，且服务端还停留在旧版，这说明用户正在本设备更新问卷，草稿绝对胜利
          const isDraftNewerByVersion = savedVersion === currentVersion && serverVersion !== currentVersion;
          
          if (!isDraftNewerByVersion && serverTime > 0 && serverTime > draftTime) {
            // 如果服务端最新提交时间晚于当前设备上的草稿保存时间（且同版本），废弃滞后草稿
            localStorage.removeItem(DRAFT_KEY);
            localStorage.removeItem(DRAFT_VERSION_KEY);
            localStorage.removeItem(DRAFT_TIME_KEY);
            localStorage.removeItem(UNRESOLVED_QIDS_KEY);
          } else {
            try {
              draftAnswers = sanitizeAnswerRecord(JSON.parse(draft), questionMap);
              isValidDraft = true;
            } catch {
              draftAnswers = {};
            }
          }
        }

        const mergedAnswers: Record<string, AnswerValue> = { ...serverAnswers };
        const changedSet = new Set(changedIds);

        if (isValidDraft && Object.keys(draftAnswers).length > 0) {
          if (savedVersion && currentVersion && savedVersion === currentVersion) {
            // Same-version draft can safely override server answers.
            Object.assign(mergedAnswers, draftAnswers);
          } else {
            // Legacy draft: only fill blanks for unchanged questions.
            for (const [qId, val] of Object.entries(draftAnswers)) {
              if (changedSet.has(qId)) continue;
              if (mergedAnswers[qId] === undefined) {
                mergedAnswers[qId] = val;
              }
            }
          }
        }

        setAnswers(mergedAnswers);
        if (currentVersion) localStorage.setItem(DRAFT_VERSION_KEY, currentVersion);

        // 检测问卷版本更新
        const isOutdated = aRes.status === 'fulfilled' && aRes.value.version && currentVersion && aRes.value.version !== currentVersion;
        if (isOutdated) {
          setSurveyUpdated(true);

          if (savedVersion === currentVersion) {
            // 继续之前的草稿修改，读取剩下还没消掉的红点
            const unresolvedStr = localStorage.getItem(UNRESOLVED_QIDS_KEY);
            if (unresolvedStr) {
              try {
                setChangedQIds(new Set(JSON.parse(unresolvedStr)));
              } catch {
                setChangedQIds(new Set(changedIds));
              }
            } else {
              setChangedQIds(new Set()); // 如果存了版本但没存没解决的，说明都解决了
            }
          } else {
            // 第一次发现这个新版本，重置所有红点并记录版本
            setChangedQIds(new Set(changedIds));
            localStorage.setItem(DRAFT_VERSION_KEY, currentVersion);
            localStorage.setItem(UNRESOLVED_QIDS_KEY, JSON.stringify(changedIds));
          }
        }
      } catch {
        setErrorMsg('题目加载失败，请刷新重试');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const isQuestionVisible = (q: any) => {
    if (!q.dependsOn) return true;
    const depAnsRaw = answers[q.dependsOn.questionId]?.value;
    const requiredVals = Array.isArray(q.dependsOn.value) ? q.dependsOn.value : [q.dependsOn.value];
    const depAnsArr = Array.isArray(depAnsRaw) ? depAnsRaw : (typeof depAnsRaw === 'string' ? [depAnsRaw] : []);

    return requiredVals.some((req: string) => depAnsArr.some((ans: string) => typeof ans === 'string' && (ans === req || ans.startsWith(req + ':'))));
  };

  const visibleSections = sections.map(sec => ({
    ...sec,
    questions: sec.questions.filter(isQuestionVisible)
  }));

  const checkIsAnswered = (val: AnswerValue | undefined): { answered: boolean, reason?: 'missing_other' | 'empty' } => {
    if (!val) return { answered: false, reason: 'empty' };
    const v = (val as any).value;
    if (v === undefined || v === null) return { answered: false, reason: 'empty' };

    const isUnansweredString = (str: string): { isUnanswered: boolean, reason?: 'missing_other' | 'empty' } => {
      const t = str.trim();
      if (!t) return { isUnanswered: true, reason: 'empty' };
      if (t === 'specify:' || (t.startsWith('specify:') && t.slice(8).replace(/,/g, '').trim() === '')) return { isUnanswered: true, reason: 'missing_other' };
      if (t === 'other_specify:' || (t.startsWith('other_specify:') && t.slice(14).trim() === '')) return { isUnanswered: true, reason: 'missing_other' };
      if (t === 'other_interest:' || (t.startsWith('other_interest:') && t.slice(15).trim() === '')) return { isUnanswered: true, reason: 'missing_other' };
      return { isUnanswered: false };
    };

    if (typeof v === 'string') {
      const res = isUnansweredString(v);
      if (res.isUnanswered) return { answered: false, reason: res.reason };
    }
    if (Array.isArray(v)) {
      if (v.length === 0) return { answered: false, reason: 'empty' };
      for (const i of v) {
        if (typeof i === 'string') {
          const res = isUnansweredString(i);
          if (res.isUnanswered) return { answered: false, reason: res.reason };
        }
      }
    }
    return { answered: true };
  };

  const isFriendMode = user?.intention === 'friend';
  const requiredQuestions = (sec: any) => sec.questions.filter((q: any) => q.required !== false && !(q.partnerOnly && isFriendMode));
  const totalCount = visibleSections.reduce((acc, sec) => acc + requiredQuestions(sec).length, 0);
  const answeredCount = visibleSections.reduce((acc, sec) => acc + requiredQuestions(sec).filter((q: any) => checkIsAnswered(answers[q.id]).answered).length, 0);

  const handleNextSection = () => {
    if (currentSectionIdx < visibleSections.length - 1) {
      setCurrentSectionIdx(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevSection = () => {
    if (currentSectionIdx > 0) {
      setCurrentSectionIdx(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async () => {
    // 找出所有未做答题目
    if (answeredCount < totalCount) {
      const unansweredQIds = new Set<string>();
      let firstUnansweredIdx = -1;
      let firstUnansweredQId: string | null = null;
      
      for (let si = 0; si < visibleSections.length; si++) {
        for (const q of visibleSections[si].questions) {
          if (q.required === false) continue;
          if (q.partnerOnly && isFriendMode) continue;
          if (!checkIsAnswered(answers[q.id]).answered) {
            unansweredQIds.add(q.id);
            if (firstUnansweredIdx === -1) {
              firstUnansweredIdx = si;
              firstUnansweredQId = q.id;
            }
          }
        }
      }

      if (firstUnansweredIdx !== -1 && firstUnansweredQId) {
        setCurrentSectionIdx(firstUnansweredIdx);
        setHighlightedQIds(unansweredQIds);
        setErrorMsg(`还有 ${unansweredQIds.size} 道题目未完成，已为你定位到未完成部分`);
        setTimeout(() => {
          const el = document.getElementById(`question-${firstUnansweredQId}`);
          if (el) {
            const top = el.getBoundingClientRect().top + window.scrollY - window.innerHeight / 3;
            window.scrollTo({ top, behavior: 'smooth' });
          }
        }, 400);
        return;
      }
    }
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await submitAnswers(answers);
      await refreshUser();

      localStorage.removeItem(DRAFT_KEY);
      localStorage.removeItem(UNRESOLVED_QIDS_KEY);
      localStorage.removeItem(DRAFT_VERSION_KEY);
      localStorage.removeItem(DRAFT_TIME_KEY);

      // 周三 18:00-20:00 匹配锁定期间，提交成功但提示本次不影响本周
      const now = new Date();
      const beijingMs = now.getTime() + 8 * 60 * 60 * 1000;
      const beijing = new Date(beijingMs);
      const isLocked = beijing.getUTCDay() === 3 && beijing.getUTCHours() >= 18 && beijing.getUTCHours() < 20;
      if (isLocked) {
        setErrorMsg('问卷已保存！本周匹配正在进行中，本次修改将从下周匹配生效。');
      }

      // Compute and show personality type reveal
      try {
        const result = computePersonality(unwrapAnswers(answers as Record<string, any>));
        result.source = 'survey';
        result.completedAt = new Date().toISOString();
        localStorage.setItem(STORAGE_KEY_RESULT, JSON.stringify(result));
        setPersonalityReveal(result);
      } catch { /* non-critical */ }

      setIsFinishing(true);
      setTimeout(goToDashboard, isLocked ? 3000 : 2000);
    } catch (err: any) {
      setErrorMsg(err.message || '提交失败，请重试');
      setIsSubmitting(false);
    }
  };

  const setAnswer = (qId: string, val: any, autoAdvance: boolean = false) => {
    setAnswers(prev => {
      const next = { ...prev };
      if (val === undefined) {
        delete next[qId];
      } else {
        next[qId] = val;
      }
      return next;
    });
    setErrorMsg('');
    if (highlightedQIds.has(qId)) {
      setHighlightedQIds(prev => {
        const next = new Set(prev);
        next.delete(qId);
        return next;
      });
    }

    if (changedQIds.has(qId)) {
      setChangedQIds(prev => {
        const next = new Set(prev);
        next.delete(qId);
        if (next.size === 0) setSurveyUpdated(false);
        return next;
      });
    }

    // 单选题、量表题作答后自动平滑滚动到下一题
    if (autoAdvance && answers[qId] === undefined) {
      const currentSection = visibleSections[currentSectionIdx];
      const qIndex = currentSection.questions.findIndex((q: any) => q.id === qId);
      if (qIndex >= 0 && qIndex < currentSection.questions.length - 1) {
        const nextQ = currentSection.questions[qIndex + 1];
        // 延迟一段时间配合圆圈的点击放大动画
        setTimeout(() => {
          const el = document.getElementById(`question-${nextQ.id}`);
          if (el) {
            const viewportHeight = window.innerHeight;
            const elRect = el.getBoundingClientRect();
            // 滚动使下一题处于视野中央
            const targetY = window.scrollY + elRect.top - (viewportHeight / 2 - elRect.height / 2);
            window.scrollTo({ top: targetY, behavior: 'smooth' });
          }
        }, 250);
      }
    }
  };

  const renderWidget = (q: Question) => {
    const val = answers[q.id];
    switch (q.type) {
      case 'likert': return <LikertScale question={q} value={(val as any)?.value} importance={(val as any)?.importance} onChange={(v, imp) => setAnswer(q.id, { value: v, importance: imp }, true)} />;
      case 'single_select': {
        const rawVal = (val as any)?.value as string | undefined;
        // q4（家乡偏好）：仅在 q3 选了江苏时才显示"偏好同城市"选项
        // 清除逻辑在 useEffect 中处理，这里只做选项过滤
        let qEffective = q;
        if (q.id === 'q4' && (answers['q3'] as any)?.value !== 'jiangsu') {
          qEffective = { ...q, options: (q.options ?? []).filter((o: string) => o !== 'prefer_same_city') };
        }
        return <SingleSelect question={qEffective} value={rawVal} onSelect={(v) => setAnswer(q.id, { value: v }, true)} />;
      }
      case 'multi_select': {
        const rawVal = (val as any)?.value;
        const arrayVal = sanitizeOptionArray(rawVal, q.options || [], true);
        return <MultiSelect question={q} value={arrayVal} onChange={(v) => (!v || (Array.isArray(v) && v.length === 0)) ? setAnswer(q.id, undefined) : setAnswer(q.id, { value: v })} />;
      }
      case 'ranking': {
        const rawVal = (val as any)?.value;
        const arrayVal = sanitizeOptionArray(rawVal, q.options || [], false);
        return <RankingInput question={q} value={arrayVal} onChange={(v) => (!v || (Array.isArray(v) && v.length === 0)) ? setAnswer(q.id, undefined) : setAnswer(q.id, { value: v })} />;
      }
      case 'open_text': return <OpenText value={(val as any)?.value || ''} onChange={(v) => (!v || v.trim() === '') ? setAnswer(q.id, undefined) : setAnswer(q.id, { value: v })} />;
      case 'number_input': return <NumberInput value={(val as any)?.value} onChange={(v) => (v === undefined || v === null || Number.isNaN(v)) ? setAnswer(q.id, undefined) : setAnswer(q.id, { value: v })} min={q.min} max={q.max} />;
      case 'year_range': return <YearRangeInput question={q} value={(val as any)?.value} onChange={(v) => (!v || (v.min === undefined && v.max === undefined)) ? setAnswer(q.id, undefined) : setAnswer(q.id, { value: v })} />;
      case 'height_range': return <HeightRangeInput question={q} value={(val as any)?.value} onChange={(v) => (!v || (v.min === undefined && v.max === undefined)) ? setAnswer(q.id, undefined) : setAnswer(q.id, { value: v })} />;
      default: return null;
    }
  };

  if (isLoading || sections.length === 0) {
    return (
      <div className="min-h-screen font-sans text-[#2C2825] bg-[#FCFBF8] flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
           <MaterialIcon name="hourglass_empty" className="text-4xl text-[#8B7355] animate-[spin_3s_linear_infinite]" />
           <div className="font-serif tracking-widest text-[#8B7355] text-sm">正在翻阅案卷...</div>
        </div>
      </div>
    );
  }

  if (isFinishing) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-[#420047] flex items-center justify-center px-6">
        <div className="text-center flex flex-col items-center">
          <MaterialIcon name="check_circle" className="text-[#FCFBF8] text-6xl mb-8 font-light" />
          <h2 className="font-serif text-3xl text-[#FCFBF8] tracking-widest mb-6">契合度问卷已密封</h2>
          <p className="font-serif text-[#FCFBF8]/70 tracking-widest">期待星空下的回音。</p>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FCFBF8] font-sans text-[#2C2825] selection:bg-[#420047] selection:text-[#FCFBF8]">
      {/* 左上角全局返回按钮 */}
      <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none p-4 md:p-6 flex justify-between items-start">
        <button 
          className="pointer-events-auto relative flex items-center justify-center w-10 md:w-12 h-10 md:h-12 rounded-full bg-white/80 backdrop-blur-md border border-[#EAE7E1] text-[#8B7355] shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:text-[#2C2825] hover:scale-105 hover:bg-white transition-all duration-300 group"
          onClick={() => goToDashboard()}
        >
          <span className="sr-only">返回主页并暂存进度</span>
          <MaterialIcon name="close" className="text-xl md:text-2xl transition-transform duration-300 group-hover:rotate-90" />
          
          {/* 自定义 Tooltip */}
          <div className="absolute top-full left-0 mt-3 w-max bg-gray-800 text-white text-[10px] md:text-xs text-center px-3 py-2 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-lg origin-top-left">
            暂存进度并返回主页
            <div className="absolute bottom-full left-4 border-[5px] border-transparent border-b-gray-800"></div>
          </div>
        </button>
      </div>

      {showSaveHint && (
        <div className="fixed top-0 inset-x-0 h-1 bg-[#420047]/20 z-50">
          <div className="h-full bg-[#420047] transition-all duration-[3000ms] ease-linear w-full origin-left animate-shrink-x" />
        </div>
      )}

      {/* Main content container with bottom padding for the fixed footer */}
      <div className="max-w-3xl mx-auto px-6 pt-16 md:pt-24 xl:pt-32 pb-32 relative">
        <header className="mb-12 text-center">
          <h1 className="font-serif text-3xl md:text-4xl text-[#2C2825] tracking-widest mb-4">契合度问卷</h1>
          <p className="font-serif text-[#8B7355] tracking-wide text-sm">卸下伪装，听从直觉。它将指引这本册子去向何方。</p>
        </header>

        {surveyUpdated && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#420047]/10 border border-[#420047]/20 text-[#420047] text-sm px-5 py-3 rounded-xl mb-6 flex items-center gap-3"
          >
            <MaterialIcon name="update" className="text-[18px]" />
            <span className="font-serif tracking-wide">问卷已更新，部分题目可能需要重新作答，请检查后重新提交。</span>
            <button type="button" onClick={() => setSurveyUpdated(false)} className="ml-auto shrink-0 text-[18px] opacity-60 hover:opacity-100" aria-label="关闭问卷更新提示">
              <MaterialIcon name="close" />
            </button>
          </motion.div>
        )}
      </div>

      {/* 模块导航栏 */}
      <div className="sticky top-4 z-40 px-6 mb-16">
        <div className="max-w-3xl mx-auto">
        <div className="bg-[#FCFBF8]/80 backdrop-blur-md border border-[#EAE7E1] rounded-full py-2.5 px-6 shadow-sm overflow-hidden w-fit max-w-full mx-auto">
          <div 
            ref={navScrollRef}
            className="flex items-center gap-6 overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth pt-1 relative"
          >
            {visibleSections.map((sec, idx) => {
              const isActive = currentSectionIdx === idx;
              const sectionHasChanged = sec.questions.some((q: any) => changedQIds.has(q.id));
              const isEntireSectionSkippable = isFriendMode && sec.questions.length > 0 && sec.questions.every((q: any) => q.partnerOnly);

              return (
                <button
                  key={sec.id}
                  ref={isActive ? activeTabRef : null}
                  onClick={() => {
                    setCurrentSectionIdx(idx);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`flex flex-col items-center gap-1.5 text-sm font-serif whitespace-nowrap transition-colors duration-300 relative ${
                    isEntireSectionSkippable ? 'opacity-40 grayscale' : ''
                  } ${
                    isActive ? 'text-[#2C2825] font-medium' : 'text-[#8B7355] hover:text-[#2C2825]'
                  }`}
                >
                  <span>{label(sec.id)}</span>
                  {sectionHasChanged && <span className="absolute -top-0.5 right-0 w-1.5 h-1.5 rounded-full bg-red-500" />}
                  {isActive ? (
                    <motion.div 
                      layoutId="nav-indicator"
                      className="w-1 h-1 rounded-full bg-[#8B7355]"
                    />
                  ) : (
                    <div className="w-1 h-1" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6" style={{ paddingBottom: 'calc(10rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="flex flex-col gap-24">
          <AnimatePresence mode="wait">
            <motion.section
              key={currentSectionIdx}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              onAnimationStart={() => window.scrollTo({ top: 0 })}
              className="flex flex-col gap-12"
            >
              {/* 模块标题 */}
              <div className="text-center mb-4">
                <h2 className="font-serif text-2xl text-[#2C2825] tracking-widest mb-2">「 {label(visibleSections[currentSectionIdx].id)} 」</h2>
                {visibleSections[currentSectionIdx].description && <p className="text-[#8B7355]/70 text-sm font-serif">{visibleSections[currentSectionIdx].description}</p>}
                <div className="w-12 h-[1px] bg-[#8B7355]/30 mx-auto mt-6" />
              </div>

              {/* 模块题目瀑布流 */}
              <div className="flex flex-col gap-16 md:gap-24 min-h-[50vh]">
                {(() => {
                  const baseIndex = visibleSections.slice(0, currentSectionIdx).reduce((acc, sec) => acc + sec.questions.length, 0);
                  return visibleSections[currentSectionIdx].questions.map((q: any, idx: number) => {
                    const isHighlighted = highlightedQIds.has(q.id);
                    const isChanged = changedQIds.has(q.id);
                    const isSkippable = q.partnerOnly && isFriendMode;
                    const qNum = baseIndex + idx + 1;
                    const ansCheck = checkIsAnswered(answers[q.id]);
                    const highlightMsg = ansCheck.reason === 'missing_other' ? '↑ 请补充填写"其他"选项' : '↑ 此题尚未作答';

                    return (
                      <motion.div
                        key={q.id}
                        id={`question-${q.id}`}
                        initial={{ opacity: 0.25 }}
                        whileInView={{ opacity: isSkippable ? 0.4 : 1 }}
                        viewport={{ margin: "-15% 0px -15% 0px", amount: "some" }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className={`flex flex-col gap-8 rounded-xl transition-all duration-500 ${isHighlighted ? 'ring-2 ring-red-300/60 bg-red-50/40 px-4 py-6 -mx-4' : ''} ${isSkippable ? 'grayscale' : ''}`}
                      >
                        <h3 className={`font-serif text-xl md:text-2xl leading-relaxed text-center px-4 transition-colors ${isHighlighted ? 'text-red-700/80' : 'text-[#2C2825]'} relative`}>
                          {isChanged && <span className="inline-block w-2 h-2 rounded-full bg-red-500 absolute -left-0 top-2" />}
                          <span className="text-[#8B7355]/70 pr-1">{qNum}.</span> {q.text}
                          {isSkippable && <span className="block text-xs font-sans text-[#8B7355]/60 mt-1 tracking-wide">找朋友/搭子可跳过此题</span>}
                          {isChanged && <span className="block text-xs font-sans text-red-400 mt-1 tracking-wide">此题已更新，请重新确认</span>}
                          {isHighlighted && <span className="block text-xs font-sans text-red-500/80 mt-2 tracking-wide">{highlightMsg}</span>}
                        </h3>
                        <div className={q.type === 'likert' ? "max-w-2xl mx-auto w-full" : "max-w-xl mx-auto w-full"}>
                          {renderWidget(q)}
                        </div>
                      </motion.div>
                    );
                  });
                })()}
              </div>
            </motion.section>
          </AnimatePresence>
        </div>
      </div>

      {/* 滚动到底部提示 */}
      {showScrollHint && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed bottom-28 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1 pointer-events-none"
        >
          <motion.span
            animate={{ y: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
            className="text-[#8B7355]/50 text-2xl font-light"
          >
            <MaterialIcon name="keyboard_arrow_down" />
          </motion.span>
        </motion.div>
      )}

      {/* 底部悬浮提交栏 */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[#FCFBF8] via-[#FCFBF8] to-transparent pt-20 px-6 z-20 pointer-events-none" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-4 pointer-events-auto">
          {errorMsg && (
            <div className="bg-red-50 border border-red-100 text-red-800 text-xs px-4 py-2 rounded-lg shadow-sm">
              {errorMsg}
            </div>
          )}

          {getIsMatchingLocked() && currentSectionIdx === visibleSections.length - 1 && (
            <div className="bg-red-50/90 backdrop-blur-md border border-red-200 text-red-500 font-serif text-[11px] md:text-xs px-4 md:px-6 py-2 rounded-full shadow-sm text-center max-w-[90%] md:max-w-md mx-auto whitespace-normal">
              匹配执行中，修改暂不支持提交。您可先暂存(仅本机)，20:00 之后再来交卷。
            </div>
          )}
          
          <div className="flex items-center justify-between w-full max-w-2xl lg:max-w-3xl bg-white/70 backdrop-blur-md border border-[#EAE7E1] rounded-[2rem] p-2 md:px-4 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
            <div 
              className="relative shrink-0"
              onMouseEnter={() => setShowSaveHint(true)}
              onMouseLeave={() => setShowSaveHint(false)}
              onTouchStart={() => setShowSaveHint(true)}
              onTouchEnd={() => {
                setTimeout(() => setShowSaveHint(false), 2000);
                goToDashboard();
              }}
            >
              <button
                type="button"
                onClick={(e) => {
                  // Prevent double-fire if onTouchEnd already navigated
                  e.preventDefault();
                  goToDashboard();
                }}
                className="px-3 md:px-6 py-3 rounded-full text-xs font-serif tracking-widest text-[#8B7355] hover:bg-[#F3F1ED] transition-colors whitespace-nowrap flex items-center gap-1.5"
              >
                <MaterialIcon name="save" className="text-[16px]" />
                <span>本机暂存</span>
              </button>
              {/* 显式调用状态控制 */}
              <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] bg-gray-800 text-white text-[10px] md:text-xs text-center p-2 rounded transition-opacity duration-200 pointer-events-none z-30 ${showSaveHint ? 'opacity-100' : 'opacity-0'}`}>
                记录已自动保存在本机浏览器<br/>点此安全退出并带回进度
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
              </div>
            </div>
            
            <div className="font-serif text-xs tracking-widest text-[#8B7355] mx-auto hidden md:block whitespace-nowrap">
              进度 <span className="text-[#2C2825] font-medium ml-1">{answeredCount} / {totalCount}</span>
            </div>
            
            <div className="flex gap-1 md:gap-2 shrink-0 items-center">
              {currentSectionIdx > 0 && (
                <button
                  type="button"
                  onClick={handlePrevSection}
                  className="bg-transparent text-[#8B7355] px-2 md:px-4 py-3 rounded-full text-xs md:text-sm font-medium tracking-widest transition-all duration-300 hover:bg-[#F3F1ED] whitespace-nowrap"
                >
                  上一环
                </button>
              )}
              
              {currentSectionIdx < visibleSections.length - 1 ? (
                <div className="flex gap-1.5 md:gap-3 items-center">
                  <button
                    type="button"
                    onClick={handleNextSection}
                    className="bg-transparent border border-[#EAE7E1] text-[#8B7355] px-3 md:px-5 py-2.5 md:py-3 rounded-full text-xs md:text-sm font-medium tracking-widest transition-all duration-300 hover:bg-[#F3F1ED] hover:text-[#2C2825] whitespace-nowrap flex items-center gap-1"
                  >
                    <span>下一环</span>
                    <MaterialIcon name="chevron_right" className="text-[16px]" />
                  </button>
                  {user?.surveyComplete && (
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={isSubmitting || getIsMatchingLocked()}
                      title={getIsMatchingLocked() ? '匹配计算锁定中，请于周三 20:00 后再提交' : ''}
                      className="bg-[#420047] text-[#FCFBF8] px-4 md:px-6 py-2.5 md:py-3 rounded-full text-xs md:text-sm font-medium tracking-widest transition-all duration-300 hover:bg-[#2A002D] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center gap-1.5"
                    >
                      {isSubmitting && <MaterialIcon name="refresh" className="text-[16px] animate-spin" />}
                      {isSubmitting ? '封缄中...' : '提交修改'}
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || getIsMatchingLocked()}
                  title={getIsMatchingLocked() ? '匹配计算锁定中，请于周三 20:00 后再提交' : ''}
                  className="bg-[#420047] text-[#FCFBF8] px-4 md:px-6 py-3 rounded-full text-xs md:text-sm font-medium tracking-widest transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#2A002D] hover:shadow-lg disabled:hover:shadow-none flex items-center gap-1 md:gap-2 whitespace-nowrap"
                >
                  {isSubmitting && <MaterialIcon name="refresh" className="text-[16px] animate-spin" />}
                  {isSubmitting ? '封缄中...' : '呈递信笺'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Personality Reveal Sheet ────────────────────────── */}
      <AnimatePresence>
        {personalityReveal && (() => {
          const info = TYPE_INFO[personalityReveal.finalType];
          if (!info) return null;
          return (
            <motion.div
              key="personality-reveal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
              onClick={() => { setPersonalityReveal(null); navigate('/dashboard'); }}
            >
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="w-full max-w-lg bg-white rounded-t-3xl p-6 pb-10 shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                {/* Drag handle */}
                <div className="w-10 h-1 bg-[#E9E1E0] rounded-full mx-auto mb-6" />

                <div className="flex items-start gap-4 mb-5">
                  {/* Color swatch */}
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
                    style={{ background: info.bgColor }}
                  >
                    {info.emoji}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-[#82737e] tracking-wider uppercase mb-1">你的 NJU 人格类型</p>
                    <h2 className="text-xl font-bold text-[#1e1b1a] font-headline">{info.nameCn}</h2>
                    <p className="text-sm italic text-[#82737e] font-serif mt-0.5">{info.tagline}</p>
                  </div>
                </div>

                <p className="text-sm text-[#50434e] leading-relaxed mb-6">{info.description}</p>

                <div className="flex flex-wrap gap-1.5 mb-6">
                  {info.traits.map(t => (
                    <span
                      key={t}
                      className="px-3 py-1 rounded-full text-xs font-medium"
                      style={{ background: `${info.color}15`, color: info.color }}
                    >
                      {t}
                    </span>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => navigate('/personality-result')}
                    className="flex-1 py-3.5 rounded-2xl text-white font-semibold text-sm"
                    style={{ background: info.color }}
                  >
                    查看完整人格卡片
                  </button>
                  <button
                    onClick={() => { setPersonalityReveal(null); navigate('/dashboard'); }}
                    className="flex-1 py-3.5 rounded-2xl border-2 border-[#D4C1CF] text-[#50434e] font-semibold text-sm"
                  >
                    去仪表盘
                  </button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

    </div>
  );
};

export default Survey;
