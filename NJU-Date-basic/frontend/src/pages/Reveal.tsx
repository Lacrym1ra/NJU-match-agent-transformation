import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import {
  getCurrentMatch,
  submitAction,
  getMatchResult,
  CurrentMatch,
} from '../api/match';
import MaterialIcon from '../components/MaterialIcon';
import { copyText } from '../lib/copyText';
import { blockUser, getBlockStatus, reportUser, ReportReason, unblockUser } from '../api/safety';
import { useConfirmDialog } from '../components/ConfirmDialog';

type PartnerContactInfo = {
  contactPlatform?: string;
  contactId?: string;
  wechatId?: string;
};

function getPlatformLabel(platform?: string): string {
  if (platform === 'qq') return 'QQ';
  if (platform === 'xiaohongshu') return '小红书';
  return '微信';
}

const GRADE_LABEL_MAP: Record<string, string> = {
  '大一': '本科一年级',
  '大二': '本科二年级',
  '大三': '本科三年级',
  '大四': '本科四年级',
  '大五': '本科五年级',
  '研一': '硕士一年级',
  '研二': '硕士二年级',
  '研三': '硕士三年级',
  '博一': '博士一年级',
  '博二': '博士二年级',
  '博三及以上': '博士三年级及以上',
  '博士后': '博士后'
};

const CAMPUS_LABEL_MAP: Record<string, string> = {
  xianlin: '仙林',
  gulou: '鼓楼',
  pukou: '浦口',
  suzhou: '苏州',
  Xianlin: '仙林',
  Gulou: '鼓楼',
  Pukou: '浦口',
  Suzhou: '苏州'
};

const REPORT_REASON_OPTIONS: Array<{ value: ReportReason; label: string }> = [
  { value: 'harassment', label: '骚扰辱骂' },
  { value: 'spam', label: '垃圾信息' },
  { value: 'fake_profile', label: '虚假资料' },
  { value: 'inappropriate_content', label: '不当内容' },
  { value: 'other', label: '其他原因' },
];

const Reveal = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const goToDashboard = useCallback(() => {
    navigate('/dashboard', { replace: true });
  }, [navigate]);
  const { user } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();
  const { confirm, confirmDialog: safetyConfirmDialog } = useConfirmDialog();
  const myContactMissing = !user?.contactId;

  // 核心数据
  const [match, setMatch] = useState<CurrentMatch | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // 拆信状态机
  const [revealStep, setRevealStep] = useState<'sealed' | 'opening' | 'reading'>('sealed');
  const [showHeartboxIntro, setShowHeartboxIntro] = useState(false);
  const [heartboxIntroStorageKey, setHeartboxIntroStorageKey] = useState<string | null>(null);

  // 双选状态
  const [decision, setDecision] = useState<'pending' | 'accepting' | 'rejecting' | 'matched' | 'missed' | 'waiting' | 'expired'>('pending');
  const [partnerContact, setPartnerContact] = useState<PartnerContactInfo | null>(null);
  const [isActing, setIsActing] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{isOpen: boolean, action: 'ACCEPT' | 'REJECT' | null}>({ isOpen: false, action: null });
  const [isBlocked, setIsBlocked] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportReasons, setReportReasons] = useState<ReportReason[]>([]);
  const [reportDetail, setReportDetail] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // 加载本周匹配数据
  useEffect(() => {
    const load = async () => {
      try {
        const res = await getCurrentMatch();
        if ((res.status !== 'REVEALED' && res.status !== 'EXPIRED') || !res.match) {
          // 不是揭晓状态，回到 dashboard
          navigate('/dashboard', { replace: true });
          return;
        }
        setMatch(res.match);

        if (res.status === 'EXPIRED') {
          setDecision('expired');
          setRevealStep('reading');
          return;
        }

        // Heartbox 来源：匹配成功当次可展示一次“启封信封”动效，其余情况直接阅读。
        if (res.match.source === 'heartbox') {
          const state = (location.state as { heartboxIntro?: boolean; heartboxMatchId?: string } | null) ?? null;
          const introMatchId = state?.heartboxMatchId || res.match.matchId;
          const storageKey = `heartbox_intro_seen_${introMatchId}`;
          const hasSeenIntro = localStorage.getItem(storageKey) === '1';
          const shouldShowIntro = !!state?.heartboxIntro && !hasSeenIntro;
          setShowHeartboxIntro(shouldShowIntro);
          setHeartboxIntroStorageKey(storageKey);
          setRevealStep(shouldShowIntro ? 'sealed' : 'reading');
          setDecision('waiting');
          await checkResult(res.match.matchId);
          return;
        }

        // 如果用户已操作过，直接拉取结果
        if (res.match.myAction !== null) {
          setRevealStep('reading');
          await checkResult(res.match.matchId);
        }
      } catch {
        setLoadError('加载失败，请刷新重试');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [navigate]);

  // 拆信动画 → 进入阅读
  useEffect(() => {
    if (revealStep === 'opening') {
      const t = setTimeout(() => {
        if (showHeartboxIntro && heartboxIntroStorageKey) {
          localStorage.setItem(heartboxIntroStorageKey, '1');
        }
        setRevealStep('reading');
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [revealStep, showHeartboxIntro, heartboxIntroStorageKey]);

  const openEnvelope = () => {
    if (revealStep !== 'sealed') return;
    setRevealStep('opening');
  };

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.y > 40) openEnvelope();
  };

  // 查询双选结果
  const checkResult = useCallback(async (matchId: string) => {
    try {
      const res = await getMatchResult(matchId);
      if (res.status === 'MUTUAL') {
        setPartnerContact(res.partnerContact || null);
        setDecision('matched');
      } else if (res.status === 'MISSED') {
        setDecision('missed');
      } else if (res.status === 'EXPIRED') {
        setDecision('expired');
      } else {
        setDecision('waiting');
      }
    } catch {
      setDecision('waiting');
    }
  }, []);

  // 提交双选操作
  const triggerAction = (action: 'ACCEPT' | 'REJECT') => {
    if (!match || isActing) return;
    setConfirmDialog({ isOpen: true, action });
  };

  const confirmAction = async () => {
    if (!match || isActing || !confirmDialog.action) return;
    const action = confirmDialog.action;
    setConfirmDialog({ isOpen: false, action: null });

    setIsActing(true);
    setDecision(action === 'ACCEPT' ? 'accepting' : 'rejecting');

    try {
      await submitAction(match.matchId, action);

      if (action === 'REJECT') {
        setTimeout(goToDashboard, 1500);
        return;
      }

      // ACCEPT：查结果
      await checkResult(match.matchId);
    } catch (err) {
      if (err instanceof Error && (err.message.includes('过期') || err.message.includes('不可操作'))) {
        setDecision('expired');
      } else {
        // 失败回退到 pending
        setDecision('pending');
      }
    } finally {
      setIsActing(false);
    }
  };

  // 轮询等待结果（对方尚未决定时）
  useEffect(() => {
    if (decision !== 'waiting' || !match) return;
    const interval = setInterval(async () => {
      const res = await getMatchResult(match.matchId);
      if (res.status === 'MUTUAL') {
        setPartnerContact(res.partnerContact || null);
        setDecision('matched');
        clearInterval(interval);
      } else if (res.status === 'MISSED') {
        setDecision('missed');
        clearInterval(interval);
      } else if (res.status === 'EXPIRED') {
        setDecision('expired');
        clearInterval(interval);
      }
    }, 30000); // 每 30 秒轮询一次
    return () => clearInterval(interval);
  }, [decision, match]);

  const contactValue = partnerContact?.contactId || partnerContact?.wechatId || '';
  const contactPlatformLabel = getPlatformLabel(partnerContact?.contactPlatform);

  const handleCopyPartnerContact = useCallback(async () => {
    if (!contactValue) return;

    const copied = await copyText(contactValue);
    if (copied) {
      toastSuccess(`${contactPlatformLabel}已复制`);
      return;
    }

    toastError('复制失败，请手动选中复制');
  }, [contactPlatformLabel, contactValue, toastError, toastSuccess]);

  const partnerId = match?.partner?.id || null;
  const canSafetyAct = Boolean(partnerId && partnerId !== user?.id);

  const handleToggleBlock = useCallback(async () => {
    if (!partnerId || !canSafetyAct || isBlocking) return;
    const confirmed = await confirm({
      title: isBlocked ? '解除拉黑' : '拉黑同窗',
      message: isBlocked ? '确认解除拉黑这位同窗？' : '确认拉黑这位同窗？拉黑后将屏蔽与对方的后续互动。',
      confirmText: isBlocked ? '解除拉黑' : '拉黑',
      tone: isBlocked ? 'default' : 'danger',
      icon: isBlocked ? 'lock_open' : 'block',
    });
    if (!confirmed) return;
    setIsBlocking(true);
    try {
      if (isBlocked) {
        const res = await unblockUser(partnerId);
        toastSuccess(res.message || '已解除拉黑');
        setIsBlocked(false);
      } else {
        const res = await blockUser(partnerId);
        toastSuccess(res.message || '已拉黑该用户');
        setIsBlocked(true);
      }
    } catch (err: any) {
      toastError(err.message || '操作失败，请稍后重试');
    } finally {
      setIsBlocking(false);
    }
  }, [canSafetyAct, confirm, isBlocked, isBlocking, partnerId, toastError, toastSuccess]);

  const handleSubmitReport = useCallback(async () => {
    if (!partnerId || !canSafetyAct || isSubmittingReport) return;
    setIsSubmittingReport(true);
    try {
      const res = await reportUser(partnerId, { reasons: reportReasons, detail: reportDetail.trim() || undefined });
      toastSuccess(res.message || '举报已提交，我们将尽快处理');
      setReportDialogOpen(false);
      setReportReasons([]);
      setReportDetail('');
    } catch (err: any) {
      toastError(err.message || '举报失败，请稍后重试');
    } finally {
      setIsSubmittingReport(false);
    }
  }, [canSafetyAct, isSubmittingReport, partnerId, reportDetail, reportReasons, toastError, toastSuccess]);

  useEffect(() => {
    if (!partnerId || !canSafetyAct) {
      setIsBlocked(false);
      return;
    }

    let cancelled = false;
    getBlockStatus(partnerId)
      .then((res) => {
        if (!cancelled) {
          setIsBlocked(Boolean(res.blocked));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsBlocked(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canSafetyAct, partnerId]);

  // 加载中
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FCFBF8] flex items-center justify-center">
        <MaterialIcon name="refresh" className="animate-spin text-4xl text-[#8B7355]" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#FCFBF8] flex items-center justify-center text-[#8B7355] font-serif tracking-widest">
        {loadError}
      </div>
    );
  }

  if (!match) return null;

  const partner = match.partner;
  const scoreVisible = match.scoreVisible !== false && match.compatibilityScore != null;
  const scorePercent = scoreVisible && match.compatibilityScore != null ? Math.round(match.compatibilityScore * 100) : null;
  const scoreLabel = scoreVisible
    ? (scorePercent! >= 85 ? '天作之合' : scorePercent! >= 75 ? '心有灵犀' : scorePercent! >= 65 ? '颇为投缘' : '初见微澜')
    : (match.specialLabel || '双向奔赴');
  const avatarLetter = partner.nickname?.[0] || '?';

  const GENDER_LABEL: Record<string, string> = { male: '男', female: '女', non_binary: '非二元', other: '其他' };
  const INTEREST_LABEL: Record<string, string> = {
    // ── 大类 (q8) ────────────────────────────────────────────
    gym_fitness: '健身', running_outdoor: '跑步户外', ball_sports: '球类运动',
    swimming_dance: '游泳舞蹈', movies_series: '电影剧集', gaming: '游戏',
    anime_acg: '动漫二次元', boardgame_larp: '桌游剧本杀',
    photo_exhibitions: '摄影看展', reading_writing: '阅读写作',
    fiction_fanfic: '小说同人', food_exploring: '探店美食', travel_citywalk: '旅行CityWalk',
    music_listening: '音乐', live_show: 'Live/演出',
    pets: '宠物', programming_geek: '编程极客', finance_business: '金融商业', other_interest: '其他',
    // ── 电影/剧集类型 (q_mv_type) ────────────────────────────
    comedy: '喜剧片', romance: '爱情片', suspense_crime: '悬疑犯罪片', sci_fi: '科幻片',
    action: '动作片', horror: '恐怖片', arthouse: '文艺片', animation: '动画片', documentary: '纪录片',
    // ── 影视媒介 (q_mv_media) ────────────────────────────────
    cn_drama: '国产剧', us_drama: '美剧', uk_drama: '英剧', kr_drama: '韩剧', jp_drama: '日剧', movie: '电影',
    // ── 桌游/剧本杀 (q_bg_type) ─────────────────────────────
    werewolf_avalon: '狼人杀/阿瓦隆', party_boardgame: '聚会桌游',
    german_strategy: '策略桌游', murder_mystery: '剧本杀', escape_room: '密室',
    // ── 动漫/二次元 (q_acg_contact) ─────────────────────────
    anime: '番剧', manga: '漫画', light_novel: '轻小说', fanfic: '同人',
    cosplay: 'Cosplay', convention: '漫展', vtuber: 'VTuber', goods: '周边手办',
    // ── 摄影/看展 (q_ph_direction) ──────────────────────────
    portrait: '人像摄影', street: '街拍摄影', film: '胶片摄影', digital: '数码摄影',
    art_museum: '美术馆', museum: '博物馆', photo_exhibition: '摄影展', installation: '装置艺术',
    // ── 探店/美食 (q_fd_type) ────────────────────────────────
    cheap_eats: '平价美食', cafe_dessert: '咖啡甜点', hotpot_bbq: '火锅烧烤',
    jp_kr_food: '日韩料理', western_brunch: '西餐Brunch', milk_tea: '奶茶',
    late_night: '夜宵', hidden_gem: '隐藏好店', home_cook: '自己做饭',
    // ── 旅行/CityWalk (q_tr_type) ───────────────────────────
    campus_walk: '校园漫步', city_walk: '城市漫步', cafe_hop: '咖啡巡礼',
    short_trip: '周末短途', speed_trip: '快节奏旅行', slow_stroll: '慢慢逛',
    photo_spot: '打卡拍照', random_explore: '随机探索式出行',
    // ── 健身/户外运动 (q_sp_type) ────────────────────────────
    weight_training: '力量训练', running: '跑步', cycling: '骑行',
    swimming: '游泳', yoga_pilates: '瑜伽', dancing: '舞蹈', hiking_climbing: '徒步攀岩',
    // ── 球类运动 (q_ball_sport) ──────────────────────────────
    badminton: '羽毛球', basketball: '篮球', table_tennis: '乒乓球',
    tennis: '网球', football: '足球', volleyball: '排球', billiards: '台球',
    // ── 音乐风格 (q_music_style) ────────────────────────────
    c_pop: '华语流行', k_pop: 'K-pop', j_pop: 'J-pop', western_pop: '欧美流行', rock: '摇滚',
    hip_hop_rap: 'Hip-Hop/说唱', r_and_b: 'R&B', electronic_dance: '电子舞曲',
    classical: '古典', jazz_blues: '爵士/蓝调', folk_country: '民谣',
    indie: '独立音乐', acg_vocaloid: 'ACG/Vocaloid',
    // ── 书籍类型 (q_read_type) ──────────────────────────────
    lit_fiction: '文学小说', sci_fi_fantasy: '科幻/奇幻书籍', history_bio: '历史传记',
    philosophy_social: '哲学社科书籍', science_tech: '科普/技术书籍', business_econ: '商业/经济书籍',
    poetry_essay: '诗歌/散文', comics_picture_book: '漫画/绘本',
    // ── 小说类型 (q_novel_type) ─────────────────────────────
    romance_novel: '言情文', suspense_thriller: '悬疑推理文', wuxia_xianxia: '武侠/仙侠文',
    sci_fi_novel: '科幻文', fantasy_magic: '玄幻/魔幻文', bl_danmei: '耽美BL文',
    gl_baihe: '百合GL文', fanfic_novel: '同人文',
    // ── 手游 (q_gm_mobile) ──────────────────────────────────
    honor_of_kings: '王者荣耀', tft: '金铲铲之战', pubg_mobile: '和平精英',
    eggy_party: '蛋仔派对', genshin: '原神', star_rail: '崩坏：星穹铁道',
    wuthering: '鸣潮', arknights: '明日方舟', love_nikki: '恋与深空',
    identity_v: '第五人格',
    // ── PC/端游 (q_gm_pc) ───────────────────────────────────
    lol: '英雄联盟', valorant: '无畏契约', cs2: 'CS2', apex: 'Apex英雄',
    ow2: '守望先锋', dbd: '黎明杀机', minecraft: 'Minecraft', gta5: 'GTA5',
    stardew: '星露谷物语', r6: '彩虹六号', warframe: 'Warframe',
    it_takes_two: '双人成行', delta_force: '三角洲', marvel_rivals: '漫威争锋', dota2: 'Dota 2',
    rock_kingdom_world: '洛克王国：世界',
    // ── Switch/主机 (q_gm_switch) ───────────────────────────
    zelda: '塞尔达传说', mario_kart: '马里奥赛车', animal_crossing: '动物森友会',
    pokemon: '宝可梦', smash_bros: '任天堂明星大乱斗', splatoon: '斯普拉遁',
    overcooked: '胡闹厨房', minecraft_sw: 'Minecraft(Switch)', xenoblade: '异度神剑',
    stardew_sw: '星露谷物语(Switch)',
    // ── 游戏类型 (q_gm_genre) ────────────────────────────────
    moba: 'MOBA', fps: 'FPS', open_world_rpg: '开放世界/RPG游戏',
    gacha: '抽卡手游', party_casual: '休闲派对游戏', rhythm: '音游',
    card_strategy: '卡牌策略游戏', simulation: '模拟经营游戏',
    story_puzzle: '剧情解谜游戏', survival_build: '生存建造游戏',
    // ── 通用兜底 ─────────────────────────────────────────────
    other_specify: '其他',
  };

  // 维度洞察（使用新 API 的 dimensionInsights 数组）
  const dimOrder = ['lifestyle', 'communication', 'boundary', 'values'];
  const dimensionInsights = scoreVisible ? (match.insights?.dimensionInsights ?? [])
    .filter((d) => dimOrder.includes(d.dimension))
    .sort((a, b) => dimOrder.indexOf(a.dimension) - dimOrder.indexOf(b.dimension)) : [];

  const sharedInterests = match.insights?.sharedInterests ?? [];
  const curatorNote = match.insights?.curatorNote;

  return (
    <div className="w-full text-[#2C2825] font-sans selection:bg-[#7C3636]/30">
      <AnimatePresence mode="wait">

        {/* ======= 状态 1 & 2: 信封桌面 ======= */}
        {(revealStep === 'sealed' || revealStep === 'opening') && (
          <motion.div
            key="desktop"
            exit={{ opacity: 0, transition: { duration: 0.8 } }}
            className="fixed inset-0 flex items-center justify-center bg-[#F3F1ED] overflow-hidden"
            style={{ backgroundImage: 'radial-gradient(circle at 50% 30%, rgba(255,255,255,0.7) 0%, transparent 60%)' }}
          >
            <div
              className="relative w-[340px] md:w-[400px] h-[220px] md:h-[260px] flex justify-center perspective-[1500px]"
              style={{ filter: 'drop-shadow(0 25px 40px rgba(139,115,85,0.2))' }}
            >
              {/* 信封背板 */}
              <motion.div
                animate={revealStep === 'opening' ? { y: 250, scale: 1.1, opacity: 0 } : {}}
                transition={{ duration: 1.2, delay: 0.5, ease: 'easeInOut' }}
                className="absolute inset-0 bg-gradient-to-br from-[#E8E2D6] via-[#DFD9CE] to-[#CFC8B9] rounded shadow-[inset_0_2px_15px_rgba(139,115,85,0.1)] border border-[#FCFBF8]/60"
              >
                {/* 增加一点纸张杂色纹理 */}
                <div className="absolute inset-0 opacity-[0.03] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDEiLz4KPHBhdGggZD0iTTAgMGgxdjFIMHptMiAyaDF2MUgyeiIgZmlsbD0iIzAwMCIgZmlsbC1vcGFjaXR5PSIwLjAyIi8+Cjwvc3ZnPg==')] mix-blend-multiply rounded" />
              </motion.div>

              {/* 信纸（向上抽出） */}
              <motion.div
                initial={{ y: 0, scale: 1 }}
                animate={revealStep === 'opening' ? { y: -250, scale: 1.15, opacity: 0 } : {}}
                transition={{ duration: 1.2, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-[15px] bg-[#FCFBF8] shadow-[0_0_20px_rgba(139,115,85,0.15)] rounded-sm border border-[#EAE7E1] z-10 flex flex-col items-center pt-8 origin-bottom"
              >
                <div className="w-12 h-12 border-[2px] border-[#8B7355]/20 rounded-full flex items-center justify-center text-xl mb-4 font-serif text-[#7C3636] shadow-sm">
                  {avatarLetter}
                </div>
                <div className="w-2/3 h-[1px] bg-[#8B7355]/10 mb-3" />
                <div className="w-1/2 h-[1px] bg-[#8B7355]/10 mb-3" />
                <div className="w-1/3 h-[1px] bg-[#8B7355]/10" />
              </motion.div>

              {/* 信封折叠遮挡层 - 增加纸张阴影质感 */}
              <motion.div
                animate={revealStep === 'opening' ? { y: 250, scale: 1.1, opacity: 0 } : {}}
                transition={{ duration: 1.2, delay: 0.5, ease: 'easeInOut' }}
                className="absolute inset-0 z-20 pointer-events-none"
              >
                {/* 左侧向内折叠，增加渐变模拟光照 */}
                <div className="absolute top-0 bottom-0 left-0 w-[53%] bg-gradient-to-br from-[#FAF8F5] via-[#F3F1ED] to-[#DFD9CE]" style={{ clipPath: 'polygon(0 0, 100% 50%, 0 100%)', filter: 'drop-shadow(4px 0px 8px rgba(139,115,85,0.15))' }}>
                  {/* 纸张边缘高光 */}
                  <div className="absolute top-0 bottom-0 right-0 w-[2px] bg-gradient-to-b from-white/60 to-transparent" style={{ clipPath: 'polygon(0 0, 100% 50%, 0 100%)' }} />
                </div>
                
                {/* 右侧向内折叠 */}
                <div className="absolute top-0 bottom-0 right-0 w-[53%] bg-gradient-to-bl from-[#FAF8F5] via-[#F3F1ED] to-[#DFD9CE]" style={{ clipPath: 'polygon(100% 0, 0 50%, 100% 100%)', filter: 'drop-shadow(-4px 0px 8px rgba(139,115,85,0.15))' }} />
                
                {/* 底部向上折叠，增加渐变和厚度感 */}
                <div className="absolute bottom-0 left-0 right-0 h-[62%] bg-gradient-to-t from-[#EFEBE3] via-[#F8F6F1] to-[#FAF9F6]" style={{ clipPath: 'polygon(0 100%, 50% 0, 100% 100%)', filter: 'drop-shadow(0px -5px 10px rgba(139,115,85,0.2))' }}>
                   {/* 底部折痕加深 */}
                   <div className="absolute bottom-0 left-0 right-0 h-[30%] bg-gradient-to-t from-[#8B7355]/5 to-transparent" />
                </div>
              </motion.div>

              {/* 上翻盖 - 增加厚度光泽与阴影深化 */}
              <motion.div
                initial={{ rotateX: 0, y: 0, scale: 1, opacity: 1, zIndex: 30 }}
                animate={revealStep === 'opening' ? { rotateX: 180, zIndex: -1, y: 250, scale: 1.1, opacity: 0 } : {}}
                transition={{
                  rotateX: { duration: 0.8, ease: [0.4, 0, 0.2, 1] },
                  default: { duration: 1.2, delay: 0.5, ease: 'easeInOut' }
                }}
                className="absolute top-0 left-0 right-0 h-[60%] bg-gradient-to-b from-[#FAF9F6] via-[#F2EFE8] to-[#DCD6CA] origin-top"
                style={{ clipPath: 'polygon(0 0, 100% 0, 50% 100%)', filter: 'drop-shadow(0px 6px 12px rgba(139,115,85,0.25))' }}
              >
                  {/* 沿V字形的纸张切割边缘微光 */}
                  <div className="absolute inset-0 bg-gradient-to-t from-white/40 to-transparent" style={{ clipPath: 'polygon(1px 0, calc(100% - 1px) 0, 50% calc(100% - 1px))' }} />
              </motion.div>

              {/* 火漆印章（可拖拽） */}
              <AnimatePresence>
                {revealStep === 'sealed' && (
                  <motion.div
                    drag="y"
                    dragConstraints={{ top: 0, bottom: 0 }}
                    dragElastic={0.2}
                    onDragEnd={handleDragEnd}
                    onClick={openEnvelope}
                    exit={{ scale: 0, opacity: 0, transition: { duration: 0.3 } }}
                    className="absolute top-[58%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[72px] h-[72px] z-40 flex items-center justify-center cursor-grab active:cursor-grabbing group hover:scale-105 transition-transform"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {/* 火漆外侧溢出边缘1（模拟蜡滴不规则溢出的大块外衬） */}
                    <div className="absolute inset-[-4px_2px_-2px_-5px] bg-gradient-to-br from-[#8E1C1C] to-[#5A0C0C] rounded-[38%_62%_41%_59%_/_52%_38%_62%_48%] shadow-[0_6px_10px_rgba(50,5,5,0.6)] transform rotate-12 transition-all duration-700" />
                    
                    {/* 火漆外侧溢出边缘2（增加另一个方向的不规则鼓包） */}
                    <div className="absolute inset-[2px_-5px_1px_3px] bg-gradient-to-bl from-[#A32222] to-[#4A0808] rounded-[58%_42%_55%_45%_/_48%_55%_45%_52%] shadow-[0_5px_8px_rgba(50,5,5,0.5)] transform -rotate-12 transition-all duration-700" />

                    {/* 火漆极窄的边缘高光环（削弱厚度感，只留下极窄的外框） */}
                    <div className="absolute inset-0 bg-gradient-to-br from-[#C93232] via-[#942020] to-[#540D0D] rounded-[48%_52%_49%_51%_/_51%_49%_52%_48%] shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),inset_0_-2px_4px_rgba(30,0,0,0.6)] transform -rotate-3 transition-all duration-700 group-hover:rotate-[15deg] group-hover:rounded-[50%_50%_49%_51%_/_49%_51%_50%_50%]" />

                    {/* 印章巨大凹陷内部（显著扩大面积，使得外部环只剩 3.5px 宽） */}
                    <div className="absolute inset-[3.5px] bg-gradient-to-br from-[#5A0C0C] to-[#B32424] rounded-full shadow-[inset_0_4px_6px_rgba(0,0,0,0.8),0_1px_1.5px_rgba(255,255,255,0.4)] flex items-center justify-center">
                      {/* 印模边缘细线 */}
                      <div className="absolute inset-[3px] rounded-full border-[1px] border-[#EB5757]/30 shadow-[0_1px_1px_rgba(0,0,0,0.5)] group-hover:rotate-[45deg] transition-transform duration-1000" />
                    </div>

                    {/* 印章刻字 */}
                    <span className="relative z-10 font-serif text-[#E0C0A0] text-[22px] tracking-widest ml-1 font-bold" style={{ textShadow: '0 2px 2px rgba(0,0,0,0.7), 0 -1px 0 rgba(255,255,255,0.1)' }}>启</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {revealStep === 'sealed' && (
                showHeartboxIntro ? (
                  <div className="absolute -bottom-24 w-[440px] max-w-[90vw] text-center">
                    <div className="text-2xl md:text-[30px] font-serif tracking-[0.2em] text-[#7C3636]">双向奔赴</div>
                    <div className="mt-2 text-sm md:text-base font-serif text-[#8B7355] tracking-wider">
                      你们不是被算法随机分到的，是彼此都主动选择了对方。
                    </div>
                  </div>
                ) : (
                  <div className="absolute -bottom-16 text-sm font-serif text-[#8B7355] tracking-widest animate-pulse opacity-80">
                    向下拨动火漆 以启锦书
                  </div>
                )
              )}
            </div>
          </motion.div>
        )}

        {/* ======= 状态 3: 展卷阅读 ======= */}
        {revealStep === 'reading' && (
          <motion.div
            key="reading"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="min-h-screen relative flex flex-col items-center py-20 px-6 md:px-12 bg-[#FCFBF8]"
            style={{
              backgroundImage: 'linear-gradient(transparent 47px, rgba(234,231,225,0.7) 48px)',
              backgroundSize: '100% 48px',
            }}
          >
            {/* 复古红线 */}
            <div className="absolute top-0 bottom-0 left-6 md:left-[10%] w-[1px] bg-[#8B2323]/20" />

            <div className="w-full max-w-3xl relative z-10 pl-4 md:pl-12">

	              <div className="mb-12 flex flex-wrap gap-4">
	                <button
	                  type="button"
	                  onClick={goToDashboard}
	                  className="inline-flex items-center gap-2 h-10 px-4 border border-[#EAE7E1] bg-[#FCFBF8] text-[#8B7355] hover:text-[#2C2825] hover:border-[#8B7355]/35 rounded-full shadow-[0_2px_8px_rgba(44,40,37,0.06)] transition-all group"
	                >
	                  <MaterialIcon name="west" className="text-[18px] group-hover:-translate-x-1 transition-transform" />
	                  <span className="font-serif tracking-widest text-sm">合上信笺</span>
	                </button>
	                {match.source === 'heartbox' && (
	                  <button
	                    type="button"
	                    onClick={() => navigate('/heartbox', { state: { skipAutoRevealRedirect: true } })}
	                    className="inline-flex items-center gap-2 h-10 px-4 border border-[#EAE7E1] bg-[#FCFBF8] text-[#8B7355] hover:text-[#2C2825] hover:border-[#8B7355]/35 rounded-full shadow-[0_2px_8px_rgba(44,40,37,0.06)] transition-all"
	                  >
	                    <MaterialIcon name="redeem" className="text-[18px]" />
	                    <span className="font-serif tracking-widest text-sm">返回心动信笺</span>
	                  </button>
	                )}
	              </div>

              {/* 头部：对方信息 + 契合度 */}
              <header className="flex flex-col gap-6 mb-12 md:mb-16 relative">
                <div className="flex items-center gap-6">
                    <div className="shrink-0 w-20 h-20 border-[3px] border-[#8B2323] rounded-full flex flex-col items-center justify-center bg-[#FCFBF8] rotate-[-5deg] relative shadow-lg">
                    <div className="absolute inset-[3px] rounded-full border border-dashed border-[#8B2323]/40" />
                    <span className="font-serif text-3xl text-[#8B2323] relative z-10 font-bold tracking-widest">{avatarLetter}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <h2 className="text-[#8B7355] font-serif tracking-[0.3em] text-[11px] mb-1 opacity-70 italic">来自</h2>
                    <div className="font-serif text-3xl text-[#2C2825] tracking-widest">{partner.nickname}</div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {partner.gender && GENDER_LABEL[partner.gender] && (
                        <span className="font-serif text-[13px] text-[#8B2323] tracking-widest bg-[#8B2323]/5 px-3 py-1 border border-[#8B2323]/20 rounded-sm shadow-sm">{GENDER_LABEL[partner.gender]}</span>
                      )}
                      <span className="font-serif text-[13px] text-[#2C2825] tracking-widest bg-[#F3F1ED] px-3 py-1 border border-[#8B7355]/20 rounded-sm shadow-sm">{partner.department}</span>
                      <span className="font-serif text-[13px] text-[#2C2825] tracking-widest bg-[#F3F1ED] px-3 py-1 border border-[#8B7355]/20 rounded-sm shadow-sm">{GRADE_LABEL_MAP[partner.grade] || partner.grade}</span>
                      {partner.campus && (
                        <span className="font-serif text-[13px] text-[#2C2825] tracking-widest bg-[#F3F1ED] px-3 py-1 border border-[#8B7355]/20 rounded-sm shadow-sm">{CAMPUS_LABEL_MAP[partner.campus] || partner.campus}</span>
                      )}
                      {partner.mbti && partner.mbti !== 'UNKNOWN' && (
                        <span className="font-serif text-[13px] text-[#2C2825] tracking-widest bg-[#F3F1ED] px-3 py-1 border border-[#8B7355]/20 rounded-sm shadow-sm">{partner.mbti}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 契合度（通栏进度条与数值） */}
                {scoreVisible && scorePercent !== null && (
                  <div className="flex flex-col w-full mt-6 md:mt-8 relative">
                    <div className="flex justify-end items-baseline gap-2 mb-3">
                      <span className="font-serif text-xs md:text-sm text-[#8B7355] tracking-[0.4em] uppercase opacity-80 font-medium">综合契合度</span>
                      <span className="font-serif text-[#8B7355]/60 text-xs md:text-sm tracking-widest mr-1">{scoreLabel}</span>
                      <span className="font-serif text-[#8B2323] text-3xl md:text-4xl tracking-wider font-bold drop-shadow-sm flex items-baseline">
                        {scorePercent}
                        <span className="text-xl md:text-2xl ml-1 font-light opacity-90">%</span>
                      </span>
                    </div>

                    {/* 分割线进度条 */}
                    <div className="w-full h-[2px] md:h-[3px] bg-[#8B7355]/15 rounded-full overflow-hidden relative shadow-inner">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${scorePercent}%` }}
                        transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#DAB185] via-[#A85151] to-[#7C3636] opacity-90"
                      />
                    </div>
                  </div>
                )}
              </header>

              {/* 对方自我介绍 */}
              {partner.bio && (
                <motion.section
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.8 }}
                  className="mb-12 relative"
                >
                  <h3 className="font-serif text-xl text-[#8B2323] mb-4 flex items-center gap-3">
                    <span className="text-sm opacity-50 rotate-45 select-none">✦</span>
                    「 TA说 」
                  </h3>
                  <p className="font-serif text-[17px] text-[#2C2825]/90 leading-[2.2] tracking-wide text-justify pl-8 md:pl-10 italic">
                    {partner.bio}
                  </p>
                </motion.section>
              )}

              {/* 共同兴趣标签 */}
              {sharedInterests.length > 0 && (
                <motion.section
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, duration: 0.8 }}
                  className="mb-12 relative"
                >
                  <h3 className="font-serif text-xl text-[#8B2323] mb-4 flex items-center gap-3">
                    <span className="text-sm opacity-50 rotate-45 select-none">✦</span>
                    「 共同兴趣 」
                  </h3>
                  <div className="flex flex-wrap gap-2 pl-8 md:pl-10">
                    {sharedInterests.map((k) => (
                      <span
                        key={k}
                        className="font-serif text-[13px] text-[#8B2323] tracking-widest bg-[#8B2323]/5 px-3 py-1 border border-[#8B2323]/20 rounded-sm"
                      >
                        {INTEREST_LABEL[k] || k}
                      </span>
                    ))}
                  </div>
                </motion.section>
              )}

              {/* 契合维度报告 */}
              <article className="flex flex-col gap-12 mb-24">
                {dimensionInsights.map((dim, idx) => (
                  <motion.section
                    key={dim.dimension}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + idx * 0.15, duration: 0.8, ease: 'easeOut' }}
                    className="relative"
                  >
                    <h3 className="font-serif text-xl text-[#8B2323] mb-4 flex items-center gap-3">
                      <span className="text-sm opacity-50 rotate-45 select-none">✦</span>
                      「 {dim.label} 」
                      <span className="text-sm text-[#8B7355] font-sans font-normal">{Math.round(dim.score * 100)}%</span>
                    </h3>
                    <div className="w-full h-[2px] bg-[#8B7355]/10 rounded-full overflow-hidden mb-4">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.round(dim.score * 100)}%` }}
                        transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 + idx * 0.15 }}
                        className="h-full bg-gradient-to-r from-[#DAB185] to-[#8B7355] opacity-70"
                      />
                    </div>
                    <p className="font-serif text-[15px] text-[#2C2825]/70 leading-[2] tracking-wide pl-8 md:pl-10 italic">
                      {dim.text}
                    </p>
                  </motion.section>
                ))}

                {/* AI 活动建议 */}
                {curatorNote && (
                  <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + dimensionInsights.length * 0.15, duration: 0.8 }}
                    className="relative"
                  >
                    <h3 className="font-serif text-xl text-[#8B2323] mb-4 flex items-center gap-3">
                      <span className="text-sm opacity-50 rotate-45 select-none">✦</span>
                      「 晚风私语 」
                    </h3>
                    <p className="font-serif text-[17px] text-[#2C2825]/90 leading-[2.2] tracking-wide text-justify pl-8 md:pl-10">
                      {curatorNote}
                    </p>
                  </motion.section>
                )}
              </article>

              {/* 命运抉择区 */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1, duration: 1 }}
                className="flex flex-col items-center border-t border-dashed border-[#8B7355]/30 pt-16 pb-20 relative"
              >

                {/* 等待对方回应 */}
                {decision === 'waiting' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center gap-4 text-center"
                  >
                    <MaterialIcon name="hourglass_empty" className="text-4xl text-[#8B7355] animate-pulse" />
                    <p className="font-serif text-[#8B7355] tracking-widest italic">你的选择已落笔，静候对方的回应…</p>
                    <p className="text-xs text-[#8B7355]/50 tracking-widest">系统将自动更新结果</p>
                  </motion.div>
                )}

                {/* 选择按钮 */}
                {(decision === 'pending' || decision === 'accepting' || decision === 'rejecting') && (
                  <div className="flex gap-8 md:gap-16 relative z-10">
                    {/* 愿见 */}
                    <button
                      type="button"
                      onClick={() => triggerAction('ACCEPT')}
                      disabled={decision !== 'pending' || isActing}
                      className={`group relative w-32 h-14 border flex items-center justify-center transition-all duration-500
                        ${decision === 'accepting' ? 'border-[#8B2323] bg-[#8B2323]/5' : decision === 'rejecting' ? 'opacity-30 border-[#EAE7E1] pointer-events-none' : 'border-[#8B2323] hover:shadow-sm'}`}
                    >
                      <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        <div className={`absolute inset-0 bg-[#8B2323]/5 transition-transform duration-300 ease-out ${decision === 'accepting' ? 'translate-y-0' : 'translate-y-full group-hover:translate-y-0'}`} />
                      </div>
                      <span className={`font-serif text-xl tracking-[0.2em] transform transition-transform z-10 pl-2 ${decision === 'accepting' ? 'text-[#8B2323]' : 'text-[#8B2323] group-hover:scale-105'}`}>
                        愿见
                      </span>
                      <AnimatePresence>
                        {decision === 'accepting' && (
                          <motion.div
                            initial={{ scale: 2.5, opacity: 0, rotate: -20 }}
                            animate={{ scale: 1, opacity: 0.9, rotate: -10 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                            className="absolute -inset-4 flex items-center justify-center z-20 pointer-events-none"
                          >
                            <div className="w-16 h-16 border-[3px] border-[#8B2323] rounded-sm flex items-center justify-center -translate-y-3 translate-x-3 bg-transparent mix-blend-multiply shadow-sm">
                              <span className="font-serif text-2xl text-[#8B2323] transform rotate-12 font-bold opacity-80 border-t border-[#8B2323]/50 mt-1 pt-1 tracking-widest pl-1">己阅</span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </button>

                    {/* 止步 */}
                    <button
                      type="button"
                      onClick={() => triggerAction('REJECT')}
                      disabled={decision !== 'pending' || isActing}
                      className={`group relative w-32 h-14 flex items-center justify-center transition-all duration-500 border
                        ${decision === 'accepting' ? 'opacity-30 border-[#EAE7E1] pointer-events-none' : decision === 'rejecting' ? 'bg-[#F3F1ED] border-[#EAE7E1]/50 shadow-inner' : 'border-[#EAE7E1] hover:border-[#8B7355]/40'}`}
                    >
                      <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        <div className={`absolute inset-0 bg-[#F3F1ED] transition-transform duration-300 ease-out ${decision === 'rejecting' ? 'translate-y-0' : 'translate-y-full group-hover:translate-y-0'}`} />
                      </div>
                      <span className={`font-serif text-xl tracking-[0.2em] z-10 pl-2 transition-colors ${decision === 'rejecting' ? 'text-[#8B7355]/50' : 'text-[#8B7355] group-hover:text-[#2C2825]'}`}>
                        {decision === 'rejecting' ? '已收折' : '止步'}
                      </span>
                    </button>
                  </div>
                )}

                {/* 按钮说明 */}
                {decision === 'pending' && (
                  <p className="mt-4 text-[11px] text-[#8B7355]/70 font-serif tracking-widest text-center leading-relaxed">
                    双方均选择愿见，才会互相揭晓联系方式
                  </p>
                )}

                {/* 双向奔赴：展示微信号 */}
                <AnimatePresence>
                  {decision === 'matched' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, y: -20 }}
                      animate={{ opacity: 1, height: 'auto', y: 0 }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className="w-full flex justify-center overflow-hidden"
                    >
                      <div className="w-full max-w-sm mt-4 p-8 border border-[#8B2323]/20 bg-[#FCFBF8] relative shadow-sm">
                        <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#8B2323]/40" />
                        <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#8B2323]/40" />
                        <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#8B2323]/40" />
                        <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#8B2323]/40" />

                        <div className="flex flex-col items-center">
                          <MaterialIcon name="volunteer_activism" className="text-4xl text-[#8B2323] mb-4" />
                          <h3 className="font-serif text-2xl text-[#2C2825] mb-2 tracking-[0.2em]">锦书相逢</h3>
                          <p className="text-[#8B7355] text-sm tracking-widest mb-8 text-center italic">对方亦已落笔，缘分在此刻交汇。</p>

                          {contactValue ? (
                            <button
                              type="button"
                              onClick={handleCopyPartnerContact}
                              className="group w-full bg-[#F3F1ED] p-4 flex flex-col items-center gap-2 mb-6 transition-colors duration-200 hover:bg-[#EEE8DE]"
                            >
                              <span className="text-[11px] text-[#8B7355] uppercase tracking-[0.3em] font-serif">对方留下的暗号</span>
                              <div className="font-sans text-xl text-[#2C2825] font-medium tracking-wider select-all">
                                {contactValue}
                              </div>
                              <span className="inline-flex items-center gap-1 text-xs text-[#8B7355]/70">
                                <span>（{contactPlatformLabel}）</span>
                                <span>点击复制</span>
                                <MaterialIcon name="content_copy" className="text-[15px] transition-transform duration-200 group-hover:scale-110" />
                              </span>
                            </button>
                          ) : (
                            <p className="text-[#8B7355] font-serif tracking-widest italic text-sm mb-4">
                              对方暂未填写联系方式
                            </p>
                          )}

                          {myContactMissing && (
                            <div className="w-full bg-[#420047]/5 border border-[#420047]/15 p-4 flex flex-col items-center gap-2 mt-2">
                              <p className="text-[#420047] font-serif text-sm tracking-widest text-center">
                                你尚未填写联系方式，对方目前看不到你的暗号
                              </p>
                              <Link
                                to="/settings"
                                state={{ backTo: '/reveal' }}
                                className="text-sm font-serif text-[#420047] hover:text-[#2A002D] transition-colors tracking-widest underline underline-offset-4"
                              >
                                前往补填 →
                              </Link>
                            </div>
                          )}

                          <div className="mt-3 w-full border-t border-[#EAE7E1] pt-3">
                            <div className="flex items-center justify-center gap-3">
                              <button
                                type="button"
                                onClick={() => {
                                  setReportReasons([]);
                                  setReportDialogOpen(true);
                                }}
                                disabled={!canSafetyAct}
                                className="rounded-full bg-[#F3F1ED] px-5 py-2 text-[13px] font-serif tracking-widest text-[#8B7355] transition-colors hover:bg-[#EEE8DE] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                举报
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleToggleBlock()}
                                disabled={!canSafetyAct || isBlocking}
                                className="rounded-full bg-[#F3F1ED] px-5 py-2 text-[13px] font-serif tracking-widest text-[#8B7355] transition-colors hover:bg-[#EEE8DE] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {isBlocking ? '处理中' : isBlocked ? '取消拉黑' : '拉黑'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 遗憾错过 */}
                {decision === 'missed' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center gap-4 text-center"
                  >
                    <MaterialIcon name="sentiment_dissatisfied" className="text-4xl text-[#8B7355]/40 font-light" />
                    <p className="font-serif text-[#8B7355] tracking-widest italic">很遗憾，缘分暂时止步于此</p>
                    {canSafetyAct && (
                      <div className="flex items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setReportReasons([]);
                            setReportDialogOpen(true);
                          }}
                          className="rounded-full bg-[#F3F1ED] px-5 py-2 text-[13px] font-serif tracking-widest text-[#8B7355] transition-colors hover:bg-[#EEE8DE]"
                        >
                          举报
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleToggleBlock()}
                          disabled={isBlocking}
                          className="rounded-full bg-[#F3F1ED] px-5 py-2 text-[13px] font-serif tracking-widest text-[#8B7355] transition-colors hover:bg-[#EEE8DE] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isBlocking ? '处理中' : isBlocked ? '取消拉黑' : '拉黑'}
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={goToDashboard}
                      className="mt-4 text-sm font-serif text-[#8B7355] hover:text-[#2C2825] transition-colors tracking-widest underline underline-offset-4"
                    >
                      回到案榻
                    </button>
                  </motion.div>
                )}

                {/* 已过期 */}
                {decision === 'expired' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center gap-4 text-center max-w-xl"
                  >
                    <MaterialIcon name="hourglass_disabled" className="text-4xl text-[#8B7355]/60 font-light" />
                    <p className="font-serif text-[#8B7355] tracking-widest italic">
                      {match.myAction
                        ? '你已按时落笔，但这封锦书最终未能等到对方的回应。'
                        : '这封锦书已经错过落笔期限，无法再做“愿见”或“止步”的选择。'}
                    </p>
                    <p className="text-xs text-[#8B7355]/60 tracking-widest leading-relaxed">
                      本期记录已归档为错过，你可以回到案榻等待下一次匹配。
                    </p>
                    {canSafetyAct && (
                      <div className="flex items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setReportReasons([]);
                            setReportDialogOpen(true);
                          }}
                          className="rounded-full bg-[#F3F1ED] px-5 py-2 text-[13px] font-serif tracking-widest text-[#8B7355] transition-colors hover:bg-[#EEE8DE]"
                        >
                          举报
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleToggleBlock()}
                          disabled={isBlocking}
                          className="rounded-full bg-[#F3F1ED] px-5 py-2 text-[13px] font-serif tracking-widest text-[#8B7355] transition-colors hover:bg-[#EEE8DE] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isBlocking ? '处理中' : isBlocked ? '取消拉黑' : '拉黑'}
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => navigate('/dashboard')}
                      className="mt-4 text-sm font-serif text-[#8B7355] hover:text-[#2C2825] transition-colors tracking-widest underline underline-offset-4"
                    >
                      回到案榻
                    </button>
                  </motion.div>
                )}

              </motion.div>

                <div className="text-center mt-10 opacity-40">
                  <MaterialIcon name="park" className="text-[20px] text-[#8B7355]" />
                </div>

            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {safetyConfirmDialog}

      {/* 优雅的确认谈窗 */}
      <AnimatePresence>
        {confirmDialog.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#2C2825]/40 backdrop-blur-sm px-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-[#FCFBF8] border border-[#EAE7E1] rounded-lg shadow-xl p-8 max-w-sm w-full text-center relative"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#8B2323]/20 to-transparent" />
              <MaterialIcon name={confirmDialog.action === 'ACCEPT' ? 'favorite' : 'waving_hand'} className="text-4xl mb-4 opacity-80" style={{ color: confirmDialog.action === 'ACCEPT' ? '#8B2323' : '#8B7355' }} />
              <h3 className="font-serif text-xl tracking-widest text-[#2C2825] mb-2">
                {confirmDialog.action === 'ACCEPT' ? '确认愿见' : '确认止步'}
              </h3>
              <p className="text-sm font-serif italic text-[#8B7355] mb-8 leading-relaxed">
                {confirmDialog.action === 'ACCEPT' 
                  ? '落笔无悔，向对方传达「愿见」的心意吗？' 
                  : '此操作不可逆，确定将错过这段刚刚开始的缘分吗？'}
              </p>
              <div className="flex justify-center gap-4">
                <button
                  type="button"
                  onClick={() => setConfirmDialog({ isOpen: false, action: null })}
                  className="px-6 py-2 rounded-sm border border-[#EAE7E1] text-[#8B7355] hover:bg-[#F3F1ED] transition-colors text-sm tracking-widest"
                >
                  再想想
                </button>
                <button
                  type="button"
                  onClick={confirmAction}
                  className={`px-6 py-2 rounded-sm text-white transition-colors text-sm tracking-widest border ${
                    confirmDialog.action === 'ACCEPT' 
                      ? 'bg-[#8B2323] border-[#8B2323] hover:bg-[#681919]' 
                      : 'bg-[#8B7355] border-[#8B7355] hover:bg-[#6A573F]'
                  }`}
                >
                  确认{confirmDialog.action === 'ACCEPT' ? '愿见' : '止步'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reportDialogOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-[#2C2825]/40 backdrop-blur-sm px-4"
            onClick={() => setReportDialogOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 8 }}
              className="w-full max-w-xl rounded-xl border border-[#EAE7E1] bg-[#FCFBF8] p-8 shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 className="font-serif text-2xl tracking-widest text-[#2C2825]">举报这位同窗</h3>
              <p className="mt-2 text-[15px] font-serif text-[#8B7355]">你的反馈会由管理员审阅处理。</p>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-2 block text-[14px] font-serif tracking-widest text-[#8B7355]">举报原因</label>
                  <div className="space-y-2 rounded-md border border-[#EAE7E1] bg-white px-4 py-3">
                    {REPORT_REASON_OPTIONS.map((item) => (
                      <label key={item.value} className="flex cursor-pointer items-center gap-2 text-[14px] text-[#2C2825]">
                        <input
                          type="checkbox"
                          checked={reportReasons.includes(item.value)}
                          onChange={(e) => {
                            setReportReasons((prev) =>
                              e.target.checked
                                ? prev.includes(item.value) ? prev : [...prev, item.value]
                                : prev.filter((reason) => reason !== item.value)
                            );
                          }}
                          className="h-4 w-4 accent-[#420047]"
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-[14px] font-serif tracking-widest text-[#8B7355]">补充说明（可选）</label>
                  <textarea
                    value={reportDetail}
                    onChange={(e) => setReportDetail(e.target.value)}
                    maxLength={500}
                    rows={5}
                    className="w-full rounded-none border border-[#EAE7E1] bg-white px-4 py-3 text-base text-[#2C2825] outline-none focus:border-[#420047]"
                    placeholder="可填写更多细节，便于管理员核实"
                  />
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setReportDialogOpen(false)}
                  className="rounded-full border border-[#EAE7E1] px-5 py-2 text-[13px] font-serif tracking-widest text-[#8B7355] transition-colors hover:bg-[#F3F1ED]"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => void handleSubmitReport()}
                  disabled={isSubmittingReport || reportReasons.length === 0}
                  className="rounded-full border border-[#420047] bg-[#420047] px-5 py-2 text-[13px] font-serif tracking-widest text-[#FCFBF8] transition-colors hover:bg-[#2A002D] disabled:opacity-50"
                >
                  {isSubmittingReport ? '提交中' : '提交举报'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Reveal;
