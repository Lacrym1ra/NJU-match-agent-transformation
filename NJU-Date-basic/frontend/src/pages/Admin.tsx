// frontend/src/pages/Admin.tsx

import React, { useCallback, useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { AlertTriangle, CheckCircle2, Eye, RefreshCw, Save, Trash2, Plus, XCircle } from 'lucide-react';
import NotFound from './NotFound';
import { REPORT_REASON_LABEL, type ReportReasonValue } from '../lib/reportReasons';

// ---------------------------------------------------------------------------
// API Helper
// ---------------------------------------------------------------------------

import { mockRequest } from '../api/mock';

function getUpcomingWeekOf(): string {
  const now = new Date();
  const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const day = shifted.getUTCDay();
  const hour = shifted.getUTCHours();
  let diff = day <= 3 ? 3 - day : 10 - day;
  if (day === 3 && hour >= 20) {
    diff = 7;
  }
  const wed = new Date(shifted.getTime());
  wed.setUTCDate(shifted.getUTCDate() + diff);
  const yyyy = wed.getUTCFullYear();
  const mm = String(wed.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(wed.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function adminFetch(path: string, options: RequestInit = {}) {
  const key = sessionStorage.getItem('admin_key');

  const headers = {
    'Content-Type': 'application/json',
    'x-admin-key': key || '',
    ...options.headers,
  };

  const USE_MOCK = (import.meta as any).env.VITE_USE_MOCK === 'true';
  if (USE_MOCK) {
    console.log(`[Mock Admin API] ${options.method || 'GET'} /admin${path}`);
    return mockRequest(`/admin${path}`, { ...options, headers });
  }

  const res = await fetch(`/api/v1/admin${path}`, {
    ...options,
    headers,
  });
  if (res.status === 403) {
    sessionStorage.removeItem('admin_key');
    throw new Error('AUTH_FAILED');
  }
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Stats {
  totalUsers: number;
  deletedUsers?: number;
  activeUsers: number;
  newUsersThisWeek: number;
  profileComplete: number;
  surveyComplete: number;
  surveyOutdated?: number;
  weekOf: string;
  weekMatches: number;
  weekCuratorNotesDone?: number;
  weekMutual: number;
  totalMutual: number;
  weekMaxScore?: number | null;
  weekMinScore?: number | null;
  genderBreakdown: Record<string, number>;
  campusBreakdown: Record<string, number>;
  gradeBreakdown: Record<string, number>;
  departmentBreakdown: Record<string, number>;
  activeGenderBreakdown?: Record<string, number>;
  intentionBreakdown?: Record<string, number>;
  activeCampusBreakdown?: Record<string, number>;
  activeGradeBreakdown?: Record<string, number>;
  activeDepartmentBreakdown?: Record<string, number>;
  matchingUsers?: number;
  weekTopSharedInterests?: Array<{ key: string; count: number }>;
  totalTopSharedInterests?: Array<{ key: string; count: number }>;
  weekTopSharedInterestCategories?: Array<{ key: string; count: number }>;
  weekTopSharedInterestDetails?: Array<{ key: string; count: number }>;
  totalTopSharedInterestCategories?: Array<{ key: string; count: number }>;
  totalTopSharedInterestDetails?: Array<{ key: string; count: number }>;
  heartbox?: HeartboxStats;
  isLocked: boolean;
}

interface HeartboxStats {
  boundUsers: number;
  cooldownUsers: number;
  signalsTotal: number;
  signalsThisWeek: number;
  uniqueSenders: number;
  uniqueSendersThisWeek: number;
  activeSignals: number;
  resolvedActiveSignals: number;
  unresolvedActiveSignals: number;
  signalStatusBreakdown: Record<string, number>;
  matchesTotal: number;
  matchesThisWeek: number;
  matchesActive: number;
  matchesQueued: number;
  matchesDismissed: number;
  matchesBlocked: number;
  matchStatusBreakdown: Record<string, number>;
  mainMatchesTotal: number;
  mainMatchesThisWeek: number;
  mainMutualTotal: number;
  mutualEmailsSent: number;
}

interface UserRow {
  id: string;
  email: string;
  nickname: string;
  gender: string;
  grade: string;
  campus: string;
  mbti: string;
  isParticipating: boolean;
  pauseUntilWeek?: string | null;
  surveyComplete: boolean;
  createdAt: string;
}

interface UserDetail {
  user: Record<string, unknown>;
  survey: { answers: string; version: string } | null;
  matches: Array<Record<string, unknown>>;
}

interface MatchRow {
  id: string;
  weekOf: string;
  userAId: string;
  userBId: string;
  score: number;
  status: string;
  userAAction: string;
  userBAction: string;
  createdAt: string;
  dimensions?: string; 
  curatorNote?: string;
}

interface HeartboxSignalRow {
  id: string;
  sender: {
    id: string;
    email: string | null;
    nickname: string | null;
    studentIdLast4: string | null;
  };
  targetStudentIdMasked: string;
  resolvedTarget: null | {
    id: string;
    email: string | null;
    nickname: string | null;
    studentIdLast4: string | null;
  };
  status: 'active' | 'cancelled' | 'matched' | string;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  matchedAt: string | null;
  heartMatch: null | {
    id: string;
    status: 'active' | 'queued' | string;
    mainMatchId: string | null;
    updatedAt: string | null;
  };
}

interface WeeklyStat {
  weekOf: string;
  total: number;
  mutual: number;
  missed: number;
  avgScore: number;
}

interface SystemInfo {
  uptime: number;
  nodeVersion: string;
  dbSize: string;
  memoryUsage: { rss: number; heapUsed: number; heapTotal: number };
  tables: Array<{ table: string; rows: number }>;
  isLocked: boolean;
}

interface ReminderPreview {
  total: number;
  withEmailEnabled: number;
  users: Array<{ id: string; email: string; createdAt?: string }>;
}

interface ReportUserSummary {
  id: string;
  email: string;
  nickname: string | null;
  gender: string | null;
  genderPref: string | null;
  intention: string | null;
  grade: string | null;
  campus: string | null;
  department: string | null;
  mbti: string | null;
  bio: string | null;
  contactPlatform: string | null;
  contactId: string | null;
  isParticipating: boolean | null;
  pauseUntilWeek: string | null;
  emailNotifications: boolean;
  profileComplete: boolean | null;
  surveyComplete: boolean | null;
  createdAt: string;
}

interface ReportRow {
  id: string;
  reporterId: string;
  reportedId: string;
  reason: string;
  reasonText?: string;
  detail: string | null;
  status: 'pending' | 'reviewed' | 'warn_update' | 'dismissed';
  adminNote?: string | null;
  createdAt: string;
  reporter?: ReportUserSummary | null;
  reported?: ReportUserSummary | null;
}

interface ForumReportRow {
  id: string;
  reporterId: string;
  reporterNickname: string | null;
  reportedNickname?: string | null;
  targetType: 'post' | 'comment' | 'user';
  postId: string | null;
  commentId: string | null;
  reportedUserId: string;
  reason: string;
  detail: string | null;
  status: 'pending' | 'approved' | 'rejected';
  adminNote: string | null;
  targetContent?: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

interface ForumCreditUserRow {
  userId: string;
  nickname: string | null;
  email: string;
  creditScore: number;
  creditLevel: 'normal' | 'limited' | 'banned';
  latestApprovedAt: string | null;
  approvedReportCount: number;
  totalReportCount: number;
}

interface AdminTeamupRow {
  id: string;
  circleId: string;
  circleName: string | null;
  leaderId: string;
  leaderNickname: string | null;
  title: string;
  descriptionPreview: string | null;
  maxMembers: number;
  currentMemberCount: number;
  activeMemberCount: number;
  applicationCount: number;
  pendingApplicationCount: number;
  deadlineAt: string;
  endAt: string;
  teamupType: 'short_term' | 'long_term';
  joinMode: 'direct' | 'approval';
  isPublic: boolean;
  status: 'recruiting' | 'full' | 'cancelled';
  cancelSource: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
}

// 增量组件扩展类型
interface BaseCardComponent {
  id?: string;
  key: string;
  name: string;
  sourceType: 'user_profile' | 'survey_answer' | 'manual';
  sourceKey: string | null;
  _isNew?: boolean;       // 前端状态：是否为新添加的行
  _originalKey?: string;  // 前端状态：原始的Key，用于PATCH/DELETE请求定位
}

interface CircleCardComponent {
  id?: string;
  circleId?: string;
  key: string;
  type: string; 
  prompt: string; 
  options: string[]; 
  weight: number;
  displayOrder: number;
  isChannelTag: boolean;
  _isNew?: boolean;
  _originalKey?: string;
}

interface CircleFormState {
  name: string;
  slug: string;
  description: string;
  category: string;
  tag: string;
  iconUrl: string;
}

type CircleStatus = 'active' | 'inactive' | 'pending_review' | 'rejected' | 'banned' | 'archived';

interface Circle {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  tag: string;
  tags?: string[];
  iconUrl: string | null;
  creatorId?: string | null;
  memberCount: number;
  isActive: boolean;
  status?: CircleStatus;
  reviewNote?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FORUM_FEATURE_ENABLED: boolean = true;

const TABS = [
  { key: 'overview', label: '总览' },
  { key: 'users', label: '用户' },
  { key: 'matches', label: '匹配' },
  { key: 'heartbox', label: '信笺巡查' },
  { key: 'reports', label: '匹配举报' },
  { key: 'forumReports', label: '论坛举报' },
  { key: 'forumCredit', label: '信用分' },
  { key: 'teamups', label: '组队' },
  ...(FORUM_FEATURE_ENABLED ? [{ key: 'forum', label: '论坛管理' }] : []),
  { key: 'audit', label: '审计日志' },
  { key: 'database', label: '数据库' },
  { key: 'system', label: '系统' },
  { key: 'components', label: '名片组件库' },
] as const;

const ADMIN_INTEREST_LABELS: Record<string, string> = {
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
  werewolf_avalon: '狼人杀', party_boardgame: '聚会桌游',
  german_strategy: '策略桌游', murder_mystery: '剧本杀', escape_room: '密室',
  // ── 动漫/二次元 (q_acg_contact) ─────────────────────────
  anime: '番剧', manga: '漫画', light_novel: '轻小说', fanfic: '同人',
  cosplay: 'Cosplay', convention: '漫展', vtuber: 'VTuber', goods: '周边手办',
  // ── 摄影/看展 (q_ph_direction) ──────────────────────────
  portrait: '人像摄影', street: '街拍', film: '胶片', digital: '数码',
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
  lit_fiction: '文学小说', sci_fi_fantasy: '科幻/奇幻', history_bio: '历史传记',
  philosophy_social: '哲学社科', science_tech: '科普/技术', business_econ: '商业/经济',
  poetry_essay: '诗歌/散文', comics_picture_book: '漫画/绘本',
  // ── 小说类型 (q_novel_type) ─────────────────────────────
  romance_novel: '言情', suspense_thriller: '悬疑推理', wuxia_xianxia: '武侠/仙侠',
  sci_fi_novel: '科幻', fantasy_magic: '玄幻/魔幻', bl_danmei: '耽美BL',
  gl_baihe: '百合GL', fanfic_novel: '同人文',
  // ── 手游 (q_gm_mobile) ──────────────────────────────────
  honor_of_kings: '王者荣耀', tft: '云顶之弈', pubg_mobile: '和平精英',
  eggy_party: '蛋仔派对', genshin: '原神', star_rail: '崩坏：星穹铁道',
  wuthering: '鸣潮', arknights: '明日方舟', love_nikki: '恋与深空',
  identity_v: '第五人格',
  // ── PC/端游 (q_gm_pc) ───────────────────────────────────
  lol: '英雄联盟', valorant: '无畏契约', cs2: 'CS2', apex: 'Apex英雄',
  ow2: '守望先锋2', dbd: '黎明杀机', minecraft: 'Minecraft', gta5: 'GTA5',
  stardew: '星露谷物语', r6: '彩虹六号', warframe: 'Warframe',
  it_takes_two: '双人成行', delta_force: '三角洲', marvel_rivals: '漫威争锋', dota2: 'Dota 2',
  rock_kingdom_world: '洛克王国：世界',
  // ── Switch/主机 (q_gm_switch) ───────────────────────────
  zelda: '塞尔达传说', mario_kart: '马里奥赛车', animal_crossing: '动物森友会',
  pokemon: '宝可梦', smash_bros: '任天堂明星大乱斗', splatoon: '斯普拉遁',
  overcooked: '胡闹厨房', minecraft_sw: 'Minecraft(Switch)', xenoblade: '异度神剑',
  stardew_sw: '星露谷物语(Switch)',
  // ── 兼容旧版兴趣 key ─────────────────────────────────────
  esports_games: '游戏',
  running_hiking: '跑步户外',
  cycling_fitness: '跑步户外',
  pets_cooking: '宠物',
  novel_fanfiction: '小说同人',
  literature_fiction: '文学小说',
  history_biography: '历史传记',
  comics_graphic: '漫画/绘本',
  danmei_bl: '耽美BL',
  baihe_gl: '百合GL',
  fanfiction: '同人文',
  // ── 游戏类型 (q_gm_genre) ────────────────────────────────
  moba: 'MOBA', fps: 'FPS', open_world_rpg: '开放世界/RPG',
  gacha: '抽卡手游', party_casual: '休闲派对', rhythm: '音游',
  card_strategy: '卡牌策略', simulation: '模拟经营',
  story_puzzle: '剧情解谜', survival_build: '生存建造',
  // ── 通用兜底 ─────────────────────────────────────────────
  other_specify: '其他',
};

const DEFAULT_CIRCLE_CATEGORY_OPTIONS = ['sports', 'academic', 'arts', 'professional', 'lifestyle'] as const;
const CIRCLE_CATEGORY_LABELS: Record<string, string> = {
  sports: '运动',
  academic: '学业',
  arts: '文艺',
  professional: '职场',
  lifestyle: '生活',
};
const CIRCLE_STATUS_OPTIONS: Array<{ value: CircleStatus; label: string }> = [
  { value: 'pending_review', label: '待审批' },
  { value: 'active', label: '已上线' },
  { value: 'inactive', label: '已下线' },
  { value: 'rejected', label: '未通过' },
  { value: 'banned', label: '已封禁' },
  { value: 'archived', label: '已归档' },
];
const CIRCLE_STATUS_STYLES: Record<CircleStatus, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-200 text-gray-600',
  pending_review: 'bg-amber-100 text-amber-700',
  rejected: 'bg-red-100 text-red-700',
  banned: 'bg-red-100 text-red-700',
  archived: 'bg-slate-200 text-slate-600',
};

const EMPTY_CIRCLE_FORM: CircleFormState = {
  name: '',
  slug: '',
  description: '',
  category: 'lifestyle',
  tag: '',
  iconUrl: '',
};

function normalizeCategoryValue(value: string): string {
  return value.trim();
}

function compareCircleCategory(a: string, b: string): number {
  const aIndex = DEFAULT_CIRCLE_CATEGORY_OPTIONS.findIndex((item) => item === a.toLowerCase());
  const bIndex = DEFAULT_CIRCLE_CATEGORY_OPTIONS.findIndex((item) => item === b.toLowerCase());

  if (aIndex !== -1 || bIndex !== -1) {
    const safeA = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
    const safeB = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
    if (safeA !== safeB) return safeA - safeB;
  }

  return a.localeCompare(b, 'zh-CN');
}

function getCircleCategoryLabel(category: string): string {
  const normalized = normalizeCategoryValue(category);
  if (!normalized) return '未分类';
  return CIRCLE_CATEGORY_LABELS[normalized.toLowerCase()] || normalized;
}

function getCircleStatus(circle: Pick<Circle, 'status' | 'isActive'>): CircleStatus {
  return circle.status || (circle.isActive ? 'active' : 'inactive');
}

function getCircleStatusLabel(status: CircleStatus): string {
  return CIRCLE_STATUS_OPTIONS.find((option) => option.value === status)?.label || status;
}

function getCircleStatusClass(status: CircleStatus): string {
  return CIRCLE_STATUS_STYLES[status] || CIRCLE_STATUS_STYLES.inactive;
}

function buildCircleCategoryOptions(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const options: string[] = [];

  values.forEach((value) => {
    const normalized = normalizeCategoryValue(value || '');
    if (!normalized) return;

    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    options.push(normalized);
  });

  return options.sort(compareCircleCategory);
}

function buildCircleCategoryGroups(circles: Circle[]) {
  const grouped = new Map<string, Circle[]>();

  circles.forEach((circle) => {
    const category = normalizeCategoryValue(circle.category) || '未分类';
    const current = grouped.get(category) || [];
    current.push(circle);
    grouped.set(category, current);
  });

  return Array.from(grouped.entries())
    .sort(([a], [b]) => compareCircleCategory(a, b))
    .map(([category, groupedCircles]) => ({
      category,
      circles: [...groupedCircles].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')),
    }));
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

function formatBytes(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

function shortDate(iso: string): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatScorePercent(score?: number | null, digits = 1): string {
  return typeof score === 'number' ? `${(score * 100).toFixed(digits)}%` : '-';
}

function normalizeCircleForm(form: CircleFormState): CircleFormState {
  return {
    name: form.name.trim(),
    slug: form.slug.trim().toLowerCase(),
    description: form.description.trim(),
    category: normalizeCategoryValue(form.category),
    tag: form.tag.trim(),
    iconUrl: form.iconUrl.trim(),
  };
}

function validateCircleForm(form: CircleFormState): string | null {
  const normalized = normalizeCircleForm(form);
  if (!normalized.name) return '圈子名称不能为空';
  if (!normalized.slug) return '圈子标识不能为空';
  if (!/^[a-z0-9-]+$/.test(normalized.slug)) return '圈子标识只能包含小写字母、数字和连字符';
  if (!normalized.category) return '圈子分类不能为空';
  return null;
}

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#420047] border-t-transparent" />
    </div>
  );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  if (!message) return null;
  return (
    <div className="mb-4 flex items-start justify-between rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
      <span>{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="ml-4 text-red-500 hover:text-red-800">x</button>
      )}
    </div>
  );
}

function SuccessBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="mb-4 rounded border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
      {message}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wider text-[#8B7355]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[#2C2825]">{value}</p>
    </div>
  );
}

function ReminderPreviewCard({ title, preview }: { title: string; preview: ReminderPreview }) {
  const hasCreatedAt = preview.users.some((u) => !!u.createdAt);
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
      <p className="text-xs text-gray-500">
        {title}共 <span className="font-medium text-[#2C2825]">{preview.total}</span> 人，
        其中开启邮件通知 <span className="font-medium text-[#2C2825]">{preview.withEmailEnabled}</span> 人
      </p>
      {preview.users.length === 0 ? (
        <p className="text-xs text-gray-400">暂无符合条件用户。</p>
      ) : (
        <div className="max-h-48 overflow-y-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 text-left text-[#8B7355]">
                <th className="px-2 py-1">邮箱</th>
                {hasCreatedAt && <th className="px-2 py-1">注册时间</th>}
              </tr>
            </thead>
            <tbody>
              {preview.users.map((u, i) => (
                <tr key={u.id} className={`border-t border-gray-100 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                  <td className="px-2 py-1 font-mono">{u.email}</td>
                  {hasCreatedAt && <td className="px-2 py-1 text-gray-500">{shortDate(u.createdAt || '')}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AdminKeyGate({ onKeySet }: { onKeySet: () => void }) {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const key = input.trim();
    if (!key) return;
    sessionStorage.setItem('admin_key', key);
    onKeySet();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FCFBF8] px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-5 rounded-xl border border-gray-200 bg-white p-8 shadow-sm"
      >
        <h1 className="font-serif text-2xl tracking-wide text-[#2C2825]">管理员访问</h1>
        <p className="text-sm text-[#8B7355]">请输入管理员密钥以继续。</p>
        <input
          type="password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="管理员密钥"
          autoFocus
          className="w-full rounded-lg border border-gray-200 bg-[#F3F1ED] px-4 py-2.5 text-sm outline-none focus:border-[#420047] focus:ring-1 focus:ring-[#420047]"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="w-full rounded-lg bg-[#420047] py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >进入</button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Components (完全重构为单项增删改)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Tab: Components (名片组件库 - 包含 A区、B区)
// ---------------------------------------------------------------------------

function ComponentsTab({ onAuthFail }: { onAuthFail: () => void }) {
  const [activeZone, setActiveZone] = useState<'A' | 'B'>('A');
  const [actionMsg, setActionMsg] = useState('');
  const [actionErr, setActionErr] = useState('');

  // A/B 区状态
  const [baseComponents, setBaseComponents] = useState<BaseCardComponent[]>([]);
  const [loadingA, setLoadingA] = useState(false);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [loadingCircles, setLoadingCircles] = useState(false);
  const [savingCircleId, setSavingCircleId] = useState<string | null>(null);
  const [togglingCircleId, setTogglingCircleId] = useState<string | null>(null);
  const [reviewingCircleId, setReviewingCircleId] = useState<string | null>(null);
  const [creatingCircle, setCreatingCircle] = useState(false);
  const [newCircle, setNewCircle] = useState<CircleFormState>(EMPTY_CIRCLE_FORM);
  const [newCircleCustomCategory, setNewCircleCustomCategory] = useState('');
  const [editingCircleCustomCategories, setEditingCircleCustomCategories] = useState<Record<string, string>>({});
  const [selectedCircleId, setSelectedCircleId] = useState('');
  const [circleComponents, setCircleComponents] = useState<CircleCardComponent[]>([]);
  const [loadingB, setLoadingB] = useState(false);
  const circleCategoryOptions = buildCircleCategoryOptions([
    ...DEFAULT_CIRCLE_CATEGORY_OPTIONS,
    ...circles.map((circle) => circle.category),
  ]);
  const pendingReviewCircles = circles.filter((circle) => getCircleStatus(circle) === 'pending_review');
  const circleGroups = buildCircleCategoryGroups(circles);

  const clearMessages = () => { setActionMsg(''); setActionErr(''); };

  // ================= 数据获取 =================
  const fetchBaseComponents = useCallback(() => {
    setLoadingA(true);
    adminFetch('/base-card-components')
      .then(res => setBaseComponents((res.components || []).map((c: any) => ({ ...c, _originalKey: c.key }))))
      .catch(err => { if (err.message === 'AUTH_FAILED') onAuthFail(); else setActionErr(err.message); })
      .finally(() => setLoadingA(false));
  }, [onAuthFail]);

  const fetchAllCircles = useCallback(() => {
    setLoadingCircles(true);
    adminFetch('/circles')
      .then(res => setCircles(res.circles || []))
      .catch(err => {
        if (err.message === 'AUTH_FAILED') onAuthFail();
        else setActionErr(err.message);
      })
      .finally(() => setLoadingCircles(false));
  }, [onAuthFail]);

  const fetchCircleComponents = useCallback((circleId: string) => {
    setLoadingB(true);
    adminFetch(`/circles/${circleId}/card-components`)
      .then(res => {
        const mapped = (res.components || []).map((c: any) => ({ ...c, _originalKey: c.key }));
        mapped.sort((a: any, b: any) => a.displayOrder - b.displayOrder);
        setCircleComponents(mapped);
      })
      .catch(err => { if (err.message === 'AUTH_FAILED') onAuthFail(); else setActionErr(err.message); })
      .finally(() => setLoadingB(false));
  }, [onAuthFail]);

  useEffect(() => { fetchBaseComponents(); fetchAllCircles(); }, [fetchBaseComponents, fetchAllCircles]);
  useEffect(() => {
    if (selectedCircleId && !circles.some((circle) => circle.id === selectedCircleId)) {
      setSelectedCircleId('');
    }
  }, [circles, selectedCircleId]);
  useEffect(() => { if (selectedCircleId) fetchCircleComponents(selectedCircleId); else setCircleComponents([]); }, [selectedCircleId, fetchCircleComponents]);

  // ================= A区 操作 =================
  const handleSaveRowA = async (comp: BaseCardComponent, index: number) => {
    clearMessages();
    try {
      const { _isNew, _originalKey, ...payload } = comp;
      if (_isNew) {
        await adminFetch('/base-card-components', { method: 'POST', body: JSON.stringify(payload) });
        setActionMsg(`组件 ${payload.key} 创建成功`);
      } else {
        await adminFetch(`/base-card-components/${_originalKey}`, { method: 'PATCH', body: JSON.stringify(payload) });
        setActionMsg(`组件 ${payload.key} 更新成功`);
      }
      fetchBaseComponents();
    } catch (err: any) { setActionErr(`保存失败: ${err.message}`); }
  };

  const handleDeleteRowA = async (comp: BaseCardComponent, index: number) => {
    clearMessages();
    if (comp._isNew) return setBaseComponents(prev => prev.filter((_, i) => i !== index));
    if (!window.confirm(`确定要永久删除 A 区组件 [${comp.key}] 吗？`)) return;
    try {
      await adminFetch(`/base-card-components/${comp._originalKey}`, { method: 'DELETE' });
      setActionMsg(`组件 ${comp.key} 已删除`);
      fetchBaseComponents();
    } catch (err: any) { setActionErr(`删除失败: ${err.message}`); }
  };
  const handleAddRowA = () => setBaseComponents([...baseComponents, { key: '', name: '', sourceType: 'manual', sourceKey: '', _isNew: true }]);

  // ================= B区 操作 =================
  const handleSaveRowB = async (comp: CircleCardComponent, index: number) => {
    clearMessages();
    try {
      const { _isNew, _originalKey, ...payload } = comp;
      payload.displayOrder = Number(payload.displayOrder) || 0;
      payload.weight = Number(payload.weight) || 1;
      if (_isNew) {
        await adminFetch(`/circles/${selectedCircleId}/card-components`, { method: 'POST', body: JSON.stringify(payload) });
        setActionMsg(`组件 ${payload.key} 创建成功`);
      } else {
        await adminFetch(`/circles/${selectedCircleId}/card-components/${_originalKey}`, { method: 'PATCH', body: JSON.stringify(payload) });
        setActionMsg(`组件 ${payload.key} 更新成功`);
      }
      fetchCircleComponents(selectedCircleId);
    } catch (err: any) { setActionErr(`保存失败: ${err.message}`); }
  };

  const handleDeleteRowB = async (comp: CircleCardComponent, index: number) => {
    clearMessages();
    if (comp._isNew) return setCircleComponents(prev => prev.filter((_, i) => i !== index));
    if (!window.confirm(`确定要永久删除 B 区组件 [${comp.key}] 吗？`)) return;
    try {
      await adminFetch(`/circles/${selectedCircleId}/card-components/${comp._originalKey}`, { method: 'DELETE' });
      setActionMsg(`组件 ${comp.key} 已删除`);
      fetchCircleComponents(selectedCircleId);
    } catch (err: any) { setActionErr(`删除失败: ${err.message}`); }
  };
  const handleAddRowB = () => {
    const nextOrder = circleComponents.length > 0 ? Math.max(...circleComponents.map(c => c.displayOrder)) + 1 : 0;
    setCircleComponents([...circleComponents, { key: '', type: 'scale', prompt: '', options: [], weight: 1, displayOrder: nextOrder, isChannelTag: false, _isNew: true }]);
  };

  const handleCreateCircle = async () => {
    clearMessages();
    const form: CircleFormState = {
      ...newCircle,
      category: normalizeCategoryValue(newCircleCustomCategory) || newCircle.category,
    };
    const validationError = validateCircleForm(form);
    if (validationError) return setActionErr(validationError);
    try {
      setCreatingCircle(true);
      const payload = normalizeCircleForm(form);
      const res = await adminFetch('/circles', { method: 'POST', body: JSON.stringify(payload) });
      setActionMsg(`圈子 ${res.circle?.name || payload.name} 创建成功`);
      setNewCircle(EMPTY_CIRCLE_FORM);
      setNewCircleCustomCategory('');
      await fetchAllCircles();
      if (res.circle?.id) setSelectedCircleId(res.circle.id);
    } catch (err: any) {
      setActionErr(`创建失败: ${err.message}`);
    } finally {
      setCreatingCircle(false);
    }
  };

  const handleSaveCircle = async (circle: Circle) => {
    clearMessages();
    const status = getCircleStatus(circle);
    const reviewNote = (circle.reviewNote || '').trim();
    if (status === 'rejected' && !reviewNote) return setActionErr('拒绝圈子时需要填写拒绝原因');
    const form: CircleFormState = {
      name: circle.name,
      slug: circle.slug,
      description: circle.description || '',
      category: normalizeCategoryValue(editingCircleCustomCategories[circle.id] || '') || circle.category,
      tag: circle.tag || '',
      iconUrl: circle.iconUrl || '',
    };
    const validationError = validateCircleForm(form);
    if (validationError) return setActionErr(validationError);
    try {
      setSavingCircleId(circle.id);
      const payload = {
        ...normalizeCircleForm(form),
        status,
        reviewNote: status === 'rejected' || status === 'pending_review' ? reviewNote || null : null,
      };
      const res = await adminFetch(`/circles/${circle.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      setActionMsg(`圈子 ${res.circle?.name || payload.name} 更新成功`);
      setEditingCircleCustomCategories((prev) => {
        const next = { ...prev };
        delete next[circle.id];
        return next;
      });
      await fetchAllCircles();
    } catch (err: any) {
      setActionErr(`保存失败: ${err.message}`);
    } finally {
      setSavingCircleId(null);
    }
  };

  const handleReviewCircle = async (circle: Circle, action: 'approve' | 'reject') => {
    clearMessages();
    const isReject = action === 'reject';
    const reviewNote = (circle.reviewNote || '').trim();
    if (isReject && !reviewNote) return setActionErr('请先填写拒绝原因');
    const confirmText = isReject
      ? `确认拒绝「${circle.name}」的建圈申请吗？`
      : `确认通过「${circle.name}」的建圈申请并上线吗？`;
    if (!window.confirm(confirmText)) return;

    try {
      setReviewingCircleId(circle.id);
      const res = await adminFetch(`/circles/${circle.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: isReject ? 'rejected' : 'active',
          reviewNote: isReject ? reviewNote : null,
        }),
      });
      setActionMsg(res.message || (isReject ? '圈子申请已拒绝' : '圈子申请已通过'));
      await fetchAllCircles();
    } catch (err: any) {
      setActionErr(`审核失败: ${err.message}`);
    } finally {
      setReviewingCircleId(null);
    }
  };

  const handleToggleCircleActive = async (circle: Circle) => {
    clearMessages();
    try {
      setTogglingCircleId(circle.id);
      const nextActive = !circle.isActive;
      const res = await adminFetch(`/circles/${circle.id}/active`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: nextActive }),
      });
      setActionMsg(res.message || (nextActive ? '圈子已上架' : '圈子已下架'));
      await fetchAllCircles();
    } catch (err: any) {
      setActionErr(`状态更新失败: ${err.message}`);
    } finally {
      setTogglingCircleId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* 顶部 Tab 切换区 */}
      <div className="flex gap-2 border-b border-gray-200 pb-2">
        <button onClick={() => { setActiveZone('A'); clearMessages(); }} className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${activeZone === 'A' ? 'bg-[#420047] text-white' : 'bg-transparent text-[#8B7355] hover:bg-gray-100'}`}>A区：全局基础定义</button>
        <button onClick={() => { setActiveZone('B'); clearMessages(); }} className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${activeZone === 'B' ? 'bg-[#420047] text-white' : 'bg-transparent text-[#8B7355] hover:bg-gray-100'}`}>B区：圈子专属定义</button>
      </div>

      {actionMsg && <SuccessBanner message={actionMsg} />}
      {actionErr && <ErrorBanner message={actionErr} onDismiss={clearMessages} />}
    
      {/* ============ A 区界面 ============ */}
      {activeZone === 'A' && (
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
          <div className="pb-4 border-b border-gray-100"><h2 className="text-lg font-serif text-[#2C2825]">A区全局组件单项配置</h2></div>
          {loadingA ? <Spinner /> : (
            <div className="space-y-3">
              {baseComponents.map((comp, index) => (
                <div key={index} className={`flex flex-wrap gap-3 items-center p-3 rounded border transition-colors ${comp._isNew ? 'bg-amber-50/50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
                  <input placeholder="标识Key" className="flex-1 p-2 text-sm border border-gray-200 rounded outline-none" value={comp.key} onChange={(e) => { const n = [...baseComponents]; n[index].key = e.target.value; setBaseComponents(n); }} />
                  <input placeholder="展示名称" className="flex-1 p-2 text-sm border border-gray-200 rounded outline-none" value={comp.name} onChange={(e) => { const n = [...baseComponents]; n[index].name = e.target.value; setBaseComponents(n); }} />
                  <select className="flex-1 p-2 text-sm border border-gray-200 rounded outline-none" value={comp.sourceType} onChange={(e) => { const n = [...baseComponents]; n[index].sourceType = e.target.value as any; setBaseComponents(n); }}>
                    <option value="manual">手工填空</option>
                    <option value="user_profile">用户资料</option>
                    <option value="survey_answer">主站问卷</option>
                  </select>
                  <input placeholder="来源定位" className="flex-1 p-2 text-sm border border-gray-200 rounded outline-none" value={comp.sourceKey || ''} onChange={(e) => { const n = [...baseComponents]; n[index].sourceKey = e.target.value; setBaseComponents(n); }} />
                  <div className="flex gap-2">
                    <button onClick={() => handleSaveRowA(comp, index)} className="flex items-center gap-1 text-[#420047] text-sm bg-white border border-[#420047]/30 px-3 py-1.5 rounded hover:bg-[#420047]/5 transition-colors"><Save className="w-4 h-4" /> {comp._isNew ? '创建' : '保存'}</button>
                    <button onClick={() => handleDeleteRowA(comp, index)} className="text-red-500 bg-white border border-red-200 w-8 h-8 flex items-center justify-center rounded hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
              <button onClick={handleAddRowA} className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-gray-300 text-gray-500 rounded hover:bg-gray-50 text-sm"><Plus className="w-4 h-4" /> 添加 A 区新组件</button>
            </div>
          )}
        </div>
      )}
    
      {/* ============ B 区界面 ============ */}
      {activeZone === 'B' && (
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
          <div className="pb-4 border-b border-gray-100 flex flex-wrap gap-4 items-center justify-between">
            <h2 className="text-lg font-serif text-[#2C2825]">B区专属组件单项配置</h2>
            <select className="p-2 min-w-[200px] border border-gray-200 rounded text-sm bg-gray-50 outline-none" value={selectedCircleId} onChange={(e) => setSelectedCircleId(e.target.value)}>
              <option value="">-- 点击选择目标圈子 --</option>
              {circleGroups.map((group) => (
                <optgroup key={group.category} label={getCircleCategoryLabel(group.category)}>
                  {group.circles.map((circle) => <option key={circle.id} value={circle.id}>{circle.name}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="rounded-lg border border-gray-200 bg-[#FCFBF8] p-4 space-y-4">
	            <div className="flex flex-wrap items-center justify-between gap-3">
	              <div>
	                <h3 className="text-base font-serif text-[#2C2825]">圈子运营管理</h3>
	                <p className="mt-1 text-xs text-[#8B7355]">在这里新建圈子、维护基础资料，并控制是否对用户开放。</p>
	              </div>
	              <button onClick={fetchAllCircles} className="text-sm text-[#420047] flex items-center gap-1 hover:underline">
	                <RefreshCw className="w-3.5 h-3.5" /> 刷新圈子列表
	              </button>
	            </div>

	            <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4 space-y-3">
	              <div className="flex flex-wrap items-center justify-between gap-3">
	                <div>
	                  <h4 className="text-sm font-medium text-[#2C2825]">待审批圈子</h4>
	                  <p className="mt-1 text-xs text-[#8B7355]">用户提交的新圈子会先停留在这里，通过后才对外开放。</p>
	                </div>
	                <span className="rounded-full bg-white px-2.5 py-1 text-xs text-[#8B7355]">待处理 {pendingReviewCircles.length}</span>
	              </div>
	              {pendingReviewCircles.length === 0 ? (
	                <div className="rounded border border-dashed border-amber-200 bg-white/60 px-4 py-6 text-center text-xs text-[#8B7355]">暂无待审批圈子</div>
	              ) : (
	                <div className="space-y-3">
	                  {pendingReviewCircles.map((circle) => (
	                    <div key={`pending-${circle.id}`} className="rounded border border-amber-200 bg-white p-4">
	                      <div className="flex flex-wrap items-start justify-between gap-3">
	                        <div className="min-w-0">
	                          <div className="flex flex-wrap items-center gap-2">
	                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getCircleStatusClass('pending_review')}`}>待审批</span>
	                            <h5 className="text-sm font-medium text-[#2C2825]">{circle.name}</h5>
	                            <span className="text-xs text-gray-400">{circle.slug}</span>
	                          </div>
	                          <p className="mt-2 text-xs leading-5 text-[#8B7355]">{circle.description || '暂无简介'}</p>
	                          <p className="mt-1 text-xs text-gray-400">分类 {getCircleCategoryLabel(circle.category)} · 标签 {(circle.tags?.length ? circle.tags.join(' / ') : circle.tag) || '-'}</p>
	                        </div>
	                        <div className="flex shrink-0 gap-2">
	                          <button
	                            onClick={() => handleReviewCircle(circle, 'reject')}
	                            disabled={reviewingCircleId === circle.id}
	                            className="flex items-center gap-1.5 rounded border border-red-200 bg-white px-3 py-1.5 text-xs text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
	                          >
	                            <XCircle className="h-3.5 w-3.5" /> 拒绝
	                          </button>
	                          <button
	                            onClick={() => handleReviewCircle(circle, 'approve')}
	                            disabled={reviewingCircleId === circle.id}
	                            className="flex items-center gap-1.5 rounded bg-[#420047] px-3 py-1.5 text-xs text-white transition-colors hover:bg-[#611066] disabled:opacity-50"
	                          >
	                            <CheckCircle2 className="h-3.5 w-3.5" /> 通过并上线
	                          </button>
	                        </div>
	                      </div>
	                      <textarea
	                        className="mt-3 min-h-[64px] w-full resize-y rounded border border-amber-200 bg-[#FCFBF8] p-2 text-sm outline-none focus:border-[#420047]"
	                        placeholder="拒绝时填写原因，会保存到圈子审核记录"
	                        value={circle.reviewNote || ''}
	                        onChange={(e) => setCircles((prev) => prev.map((item) => item.id === circle.id ? { ...item, reviewNote: e.target.value } : item))}
	                      />
	                    </div>
	                  ))}
	                </div>
	              )}
	            </div>

	            <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-medium text-[#2C2825]">新建圈子</h4>
                <button
                  onClick={() => {
                    setNewCircle(EMPTY_CIRCLE_FORM);
                    setNewCircleCustomCategory('');
                  }}
                  className="text-xs text-[#8B7355] hover:text-[#420047]"
                >
                  清空
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-gray-500 uppercase">圈子名称</label>
                  <input className="p-2 text-sm border border-gray-200 rounded bg-white" value={newCircle.name} onChange={(e) => setNewCircle({ ...newCircle, name: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-gray-500 uppercase">标识 (Slug)</label>
                  <input className="p-2 text-sm border border-gray-200 rounded bg-white" value={newCircle.slug} onChange={(e) => setNewCircle({ ...newCircle, slug: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-gray-500 uppercase">分类</label>
                  <select className="p-2 text-sm border border-gray-200 rounded bg-white" value={newCircle.category} onChange={(e) => setNewCircle({ ...newCircle, category: e.target.value })}>
                    {circleCategoryOptions.map((option) => <option key={option} value={option}>{getCircleCategoryLabel(option)}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-gray-500 uppercase">自定义分类</label>
                  <input
                    className="p-2 text-sm border border-gray-200 rounded bg-white"
                    placeholder="留空则使用左侧选项"
                    value={newCircleCustomCategory}
                    onChange={(e) => setNewCircleCustomCategory(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-gray-500 uppercase">标签</label>
                  <input className="p-2 text-sm border border-gray-200 rounded bg-white" value={newCircle.tag} onChange={(e) => setNewCircle({ ...newCircle, tag: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1 xl:col-span-2">
                  <label className="text-[11px] text-gray-500 uppercase">图标链接</label>
                  <input className="p-2 text-sm border border-gray-200 rounded bg-white" value={newCircle.iconUrl} onChange={(e) => setNewCircle({ ...newCircle, iconUrl: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1 md:col-span-2 xl:col-span-3">
                  <label className="text-[11px] text-gray-500 uppercase">简介</label>
                  <textarea className="min-h-[84px] p-2 text-sm border border-gray-200 rounded bg-white resize-y" value={newCircle.description} onChange={(e) => setNewCircle({ ...newCircle, description: e.target.value })} />
                </div>
              </div>
              <p className="text-xs text-[#8B7355]">
                分类选项会自动汇总当前所有圈子的分类。若填写自定义分类，圈子创建成功后它会自动进入分类选项。
              </p>
              <div className="flex justify-end">
                <button onClick={handleCreateCircle} disabled={creatingCircle} className="flex items-center gap-1.5 text-white text-sm bg-[#420047] hover:bg-[#611066] px-4 py-2 rounded transition-colors disabled:opacity-50">
                  <Plus className="w-4 h-4" /> {creatingCircle ? '创建中...' : '创建圈子'}
                </button>
              </div>
            </div>

            {loadingCircles ? <Spinner /> : circles.length === 0 ? (
              <div className="text-center text-gray-400 py-12 text-sm border-2 border-dashed border-gray-100 rounded-lg">暂无圈子，请先创建圈子后再配置 B 区组件</div>
            ) : (
              <div className="space-y-5">
                {circleGroups.map((group) => (
                  <div key={group.category} className="space-y-3">
                    <div className="flex items-center justify-between border-b border-dashed border-gray-200 pb-2">
                      <div>
                        <h4 className="text-sm font-medium text-[#2C2825]">{getCircleCategoryLabel(group.category)}</h4>
                        <p className="text-xs text-[#8B7355]">共 {group.circles.length} 个圈子</p>
                      </div>
                    </div>

	                    {group.circles.map((circle) => {
	                      const status = getCircleStatus(circle);
	                      const isReviewing = reviewingCircleId === circle.id;
	                      return (
	                      <div key={circle.id} className={`rounded-lg border bg-white p-4 space-y-4 ${status === 'pending_review' ? 'border-amber-200' : 'border-gray-200'}`}>
	                        <div className="flex flex-wrap items-center justify-between gap-3">
	                          <div className="flex items-center gap-2">
	                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getCircleStatusClass(status)}`}>
	                              {getCircleStatusLabel(status)}
	                            </span>
	                            <span className="text-xs text-[#8B7355]">成员 {circle.memberCount ?? 0}</span>
	                            <span className="text-xs text-gray-400">创建于 {shortDate(circle.createdAt || '')}</span>
	                            {circle.reviewedAt && <span className="text-xs text-gray-400">审核于 {shortDate(circle.reviewedAt)}</span>}
	                          </div>
	                          <div className="flex flex-wrap gap-2">
	                            <button onClick={() => setSelectedCircleId(circle.id)} className="px-3 py-1.5 text-xs border border-gray-200 rounded bg-white hover:bg-gray-50">
	                              {selectedCircleId === circle.id ? '当前管理中' : '进入 B 区配置'}
	                            </button>
	                            <button onClick={() => handleSaveCircle(circle)} disabled={savingCircleId === circle.id} className="flex items-center gap-1.5 text-white text-xs bg-[#2C2825] hover:bg-black px-3 py-1.5 rounded transition-colors disabled:opacity-50">
	                              <Save className="w-3.5 h-3.5" /> {savingCircleId === circle.id ? '保存中...' : '保存资料'}
	                            </button>
	                            {status === 'pending_review' || status === 'rejected' ? (
	                              <>
	                                <button onClick={() => handleReviewCircle(circle, 'reject')} disabled={isReviewing || status === 'rejected'} className="flex items-center gap-1.5 rounded border border-red-200 bg-white px-3 py-1.5 text-xs text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50">
	                                  <XCircle className="h-3.5 w-3.5" /> 拒绝
	                                </button>
	                                <button onClick={() => handleReviewCircle(circle, 'approve')} disabled={isReviewing} className="flex items-center gap-1.5 rounded border border-green-200 bg-white px-3 py-1.5 text-xs text-green-700 transition-colors hover:bg-green-50 disabled:opacity-50">
	                                  <CheckCircle2 className="h-3.5 w-3.5" /> 通过
	                                </button>
	                              </>
	                            ) : (
	                              <button onClick={() => handleToggleCircleActive(circle)} disabled={togglingCircleId === circle.id} className={`px-3 py-1.5 text-xs rounded border transition-colors disabled:opacity-50 ${status === 'active' ? 'border-red-200 text-red-600 bg-white hover:bg-red-50' : 'border-green-200 text-green-700 bg-white hover:bg-green-50'}`}>
	                                {togglingCircleId === circle.id ? '处理中...' : status === 'active' ? '下线圈子' : '上线圈子'}
	                              </button>
	                            )}
	                          </div>
	                        </div>
	                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                          <div className="flex flex-col gap-1">
                            <label className="text-[11px] text-gray-500 uppercase">圈子名称</label>
                            <input className="p-2 text-sm border border-gray-200 rounded bg-white" value={circle.name} onChange={(e) => setCircles((prev) => prev.map((item) => item.id === circle.id ? { ...item, name: e.target.value } : item))} />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[11px] text-gray-500 uppercase">标识 (Slug)</label>
                            <input className="p-2 text-sm border border-gray-200 rounded bg-white" value={circle.slug} onChange={(e) => setCircles((prev) => prev.map((item) => item.id === circle.id ? { ...item, slug: e.target.value } : item))} />
                          </div>
	                          <div className="flex flex-col gap-1">
	                            <label className="text-[11px] text-gray-500 uppercase">分类</label>
	                            <select className="p-2 text-sm border border-gray-200 rounded bg-white" value={circle.category} onChange={(e) => setCircles((prev) => prev.map((item) => item.id === circle.id ? { ...item, category: e.target.value } : item))}>
	                              {circleCategoryOptions.map((option) => <option key={option} value={option}>{getCircleCategoryLabel(option)}</option>)}
	                            </select>
	                          </div>
	                          <div className="flex flex-col gap-1">
	                            <label className="text-[11px] text-gray-500 uppercase">运营状态</label>
	                            <select
	                              className="p-2 text-sm border border-gray-200 rounded bg-white"
	                              value={status}
	                              onChange={(e) => {
	                                const nextStatus = e.target.value as CircleStatus;
	                                setCircles((prev) => prev.map((item) => item.id === circle.id ? { ...item, status: nextStatus, isActive: nextStatus === 'active' } : item));
	                              }}
	                            >
	                              {CIRCLE_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
	                            </select>
	                          </div>
	                          <div className="flex flex-col gap-1">
	                            <label className="text-[11px] text-gray-500 uppercase">自定义分类</label>
                            <input
                              className="p-2 text-sm border border-gray-200 rounded bg-white"
                              placeholder="保存后加入分类选项"
                              value={editingCircleCustomCategories[circle.id] || ''}
                              onChange={(e) => setEditingCircleCustomCategories((prev) => ({ ...prev, [circle.id]: e.target.value }))}
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[11px] text-gray-500 uppercase">标签</label>
                            <input className="p-2 text-sm border border-gray-200 rounded bg-white" value={circle.tag || ''} onChange={(e) => setCircles((prev) => prev.map((item) => item.id === circle.id ? { ...item, tag: e.target.value } : item))} />
                          </div>
                          <div className="flex flex-col gap-1 xl:col-span-2">
                            <label className="text-[11px] text-gray-500 uppercase">图标链接</label>
                            <input className="p-2 text-sm border border-gray-200 rounded bg-white" value={circle.iconUrl || ''} onChange={(e) => setCircles((prev) => prev.map((item) => item.id === circle.id ? { ...item, iconUrl: e.target.value } : item))} />
                          </div>
	                          <div className="flex flex-col gap-1 md:col-span-2 xl:col-span-4">
	                            <label className="text-[11px] text-gray-500 uppercase">简介</label>
	                            <textarea className="min-h-[84px] p-2 text-sm border border-gray-200 rounded bg-white resize-y" value={circle.description || ''} onChange={(e) => setCircles((prev) => prev.map((item) => item.id === circle.id ? { ...item, description: e.target.value } : item))} />
	                          </div>
	                          {(status === 'pending_review' || status === 'rejected') && (
	                            <div className="flex flex-col gap-1 md:col-span-2 xl:col-span-4">
	                              <label className="text-[11px] text-gray-500 uppercase">审核备注 / 拒绝原因</label>
	                              <textarea
	                                className="min-h-[64px] p-2 text-sm border border-amber-200 rounded bg-[#FCFBF8] resize-y"
	                                placeholder="拒绝时必填；通过时会清空"
	                                value={circle.reviewNote || ''}
	                                onChange={(e) => setCircles((prev) => prev.map((item) => item.id === circle.id ? { ...item, reviewNote: e.target.value } : item))}
	                              />
	                            </div>
	                          )}
	                        </div>
	                      </div>
	                      );
	                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {!selectedCircleId ? <div className="text-center text-gray-400 py-12 text-sm border-2 border-dashed border-gray-100 rounded-lg">请先在上方圈子管理区选择或创建目标圈子</div> : loadingB ? <Spinner /> : (
            <div className="space-y-4 mt-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 px-4 py-3 text-xs leading-5 text-[#8B7355]">
                问卷延续配置目前已从管理面板暂时下架。
                现阶段仅支持维护 B 区组件的排序、Key 与展示名称；已有的题型、候选项和频道标签配置会按原值保留，并继续随保存请求一起提交给后端。
              </div>
              {circleComponents.map((comp, index) => (
                <div key={index} className={`flex flex-col md:flex-row gap-4 items-start p-4 rounded-lg border transition-colors ${comp._isNew ? 'bg-amber-50/50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 w-full">
                    <div className="flex flex-col gap-1"><label className="text-[11px] text-gray-500 uppercase">排序</label><input type="number" className="p-2 text-sm border border-gray-200 rounded bg-white" value={comp.displayOrder} onChange={(e) => { const n = [...circleComponents]; n[index].displayOrder = parseInt(e.target.value)||0; setCircleComponents(n); }} /></div>
                    <div className="flex flex-col gap-1 lg:col-span-2"><label className="text-[11px] text-gray-500 uppercase">标识 (Key)</label><input className="p-2 text-sm border border-gray-200 rounded bg-white" value={comp.key} onChange={(e) => { const n = [...circleComponents]; n[index].key = e.target.value; setCircleComponents(n); }} /></div>
                    <div className="flex flex-col gap-1 lg:col-span-1"><label className="text-[11px] text-gray-500 uppercase">展示名称</label><input className="p-2 text-sm border border-gray-200 rounded bg-white" value={comp.prompt} onChange={(e) => { const n = [...circleComponents]; n[index].prompt = e.target.value; setCircleComponents(n); }} /></div>
                  </div>
                  <div className="flex flex-row md:flex-col gap-2 shrink-0 md:w-24 border-t md:border-t-0 md:border-l border-gray-200 md:pl-4 justify-center">
                    <button onClick={() => handleSaveRowB(comp, index)} className="flex-1 flex items-center justify-center gap-1.5 text-white text-xs bg-[#2C2825] hover:bg-black py-2 rounded transition-colors"><Save className="w-3.5 h-3.5" /> {comp._isNew ? '创建' : '更新'}</button>
                    <button onClick={() => handleDeleteRowB(comp, index)} className="flex-1 flex items-center justify-center gap-1.5 text-red-600 text-xs bg-white border border-red-200 hover:bg-red-50 py-2 rounded transition-colors"><Trash2 className="w-3.5 h-3.5" /> 删除</button>
                  </div>
                </div>
              ))}
              <button onClick={handleAddRowB} className="w-full flex items-center justify-center gap-2 py-4 border border-dashed border-gray-300 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors text-sm"><Plus className="w-4 h-4" /> 添置 B 区新组件</button>
            </div>
          )}
        </div>
      )}
    
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Overview
// ---------------------------------------------------------------------------

function OverviewTab({ onAuthFail }: { onAuthFail: () => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [weeklyStats, setWeeklyStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeBoard, setActiveBoard] = useState<'promo' | 'ops'>('promo');
  const [showActiveOnly, setShowActiveOnly] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      adminFetch('/stats'),
      adminFetch('/matches/weekly-stats'),
    ])
      .then(([statsData, weeklyData]) => {
        setStats(statsData);
        setWeeklyStats(weeklyData.weeks ? weeklyData.weeks.reverse() : []);
      })
      .catch((err) => {
        if (err.message === 'AUTH_FAILED') return onAuthFail();
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [onAuthFail]);

  if (loading) return <Spinner />;
  if (error) return <ErrorBanner message={error} />;
  if (!stats) return null;

  const COLORS = ['#0088FE', '#FF8042', '#FFBB28', '#00C49F', '#FF6666'];

  const campusMap: Record<string, string> = {
    xianlin: '仙林', gulou: '鼓楼', pukou: '浦口', suzhou: '苏州',
  };

  // ── 派生指标 ──────────────────────────────────────────────────────────────
  const weekMatchCoverageRate = stats.matchingUsers && stats.matchingUsers > 0
    ? ((stats.weekMatches * 2) / stats.matchingUsers) * 100 : 0;
  const weekMutualRate = stats.weekMatches > 0
    ? (stats.weekMutual / stats.weekMatches) * 100 : 0;
  const curatorNoteRate = stats.weekMatches > 0 && stats.weekCuratorNotesDone != null
    ? (stats.weekCuratorNotesDone / stats.weekMatches) * 100 : 0;
  const currentWeekStat = weeklyStats.find((w: any) => w.weekOf === stats.weekOf);
  const latestWeeklyAvgScore = (currentWeekStat?.avgScore ?? weeklyStats.slice().reverse().find((w: any) => typeof w.avgScore === 'number' && w.avgScore > 0)?.avgScore) as number | undefined;
  const avgScoreWeekOf = currentWeekStat ? stats.weekOf : weeklyStats.slice().reverse().find((w: any) => typeof w.avgScore === 'number' && w.avgScore > 0)?.weekOf as string | undefined;
  const heartbox = stats.heartbox;
  const heartboxActivationRate = heartbox && heartbox.signalsTotal > 0
    ? (heartbox.matchesTotal / heartbox.signalsTotal) * 100
    : 0;
  const heartboxLegacyMainlineRate = heartbox && heartbox.matchesTotal > 0
    ? (heartbox.mainMatchesTotal / heartbox.matchesTotal) * 100
    : 0;

  // ── 分布数据 ──────────────────────────────────────────────────────────────
  const currentGenderBreakdown = showActiveOnly ? (stats.activeGenderBreakdown || {}) : (stats.genderBreakdown || {});
  const genderData = [
    { name: '男', value: currentGenderBreakdown.male || 0 },
    { name: '女', value: currentGenderBreakdown.female || 0 },
    { name: '未知', value: currentGenderBreakdown.unknown || 0 },
  ].filter(d => d.value > 0);

  const currentCampusBreakdown = showActiveOnly ? (stats.activeCampusBreakdown || {}) : (stats.campusBreakdown || {});
  const campusData = Object.entries(currentCampusBreakdown)
    .filter(([_, v]) => (v as number) > 0)
    .map(([k, v]) => ({ name: campusMap[k.toLowerCase()] || k, value: v as number }))
    .sort((a, b) => b.value - a.value);

  const currentGradeBreakdown = showActiveOnly ? (stats.activeGradeBreakdown || {}) : (stats.gradeBreakdown || {});
  const gradeData = Object.entries(currentGradeBreakdown)
    .filter(([_, v]) => (v as number) > 0)
    .map(([k, v]) => ({ name: k, value: v as number }))
    .sort((a, b) => b.value - a.value);

  const currentDepartmentBreakdown = showActiveOnly ? (stats.activeDepartmentBreakdown || {}) : (stats.departmentBreakdown || {});
  const departmentData = Object.entries(currentDepartmentBreakdown)
    .filter(([_, v]) => (v as number) > 0)
    .map(([k, v]) => ({ name: k, value: v as number }))
    .sort((a, b) => b.value - a.value);

  const intentionData = [
    { name: '找伴侣', value: stats.intentionBreakdown?.partner || 0 },
    { name: '找朋友', value: stats.intentionBreakdown?.friend || 0 },
    { name: '未填', value: stats.intentionBreakdown?.unknown || 0 },
  ].filter(d => d.value > 0);

  // ── 兴趣数据 ──────────────────────────────────────────────────────────────
  const promoWeekCategoryData = (stats.weekTopSharedInterestCategories || []).map(item => ({
    name: ADMIN_INTEREST_LABELS[item.key] || item.key, value: item.count,
  }));
  const promoWeekDetailData = (stats.weekTopSharedInterestDetails || stats.weekTopSharedInterests || []).map(item => ({
    name: ADMIN_INTEREST_LABELS[item.key] || item.key, value: item.count,
  }));
  const promoTotalCategoryData = (stats.totalTopSharedInterestCategories || []).map(item => ({
    name: ADMIN_INTEREST_LABELS[item.key] || item.key, value: item.count,
  }));
  const promoTotalDetailData = (stats.totalTopSharedInterestDetails || stats.totalTopSharedInterests || []).map(item => ({
    name: ADMIN_INTEREST_LABELS[item.key] || item.key, value: item.count,
  }));

  // ── 渲染工具函数 ──────────────────────────────────────────────────────────
  function renderPieChart(data: any[], title: string) {
    const totalCount = showActiveOnly ? (stats?.matchingUsers || 1) : (stats?.totalUsers || 1);
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-[#2C2825]">{title}</h3>
        {data.length > 0 ? (
          <div className="flex flex-col items-center gap-3">
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data} cx="50%" cy="50%" innerRadius={52} outerRadius={70} paddingAngle={4} dataKey="value" label={false}>
                    {data.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex w-full flex-wrap justify-center gap-x-3 gap-y-1.5 text-xs text-gray-600">
              {data.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span>{entry.name} {entry.value}人 ({((entry.value / totalCount) * 100).toFixed(0)}%)</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex h-44 items-center justify-center text-sm text-gray-400">暂无数据</div>
        )}
      </div>
    );
  }

  function renderInterestBar(data: Array<{ name: string; value: number }>, title: string, subtitle: string, emptyText: string) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-[#2C2825]">{title}</h3>
        <p className="mb-4 mt-0.5 text-xs text-gray-400">{subtitle}</p>
        {data.length > 0 ? (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ top: 4, right: 20, left: 30, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                <Tooltip wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="value" name="出现次数" fill="#A85151" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-80 items-center justify-center text-sm text-gray-400">{emptyText}</div>
        )}
      </div>
    );
  }

  const DistributionToggle = () => (
    <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
      <button
        onClick={() => setShowActiveOnly(false)}
        className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${!showActiveOnly ? 'bg-[#420047] text-white' : 'text-[#8B7355] hover:text-[#420047]'}`}
      >
        全部用户 ({stats.totalUsers})
      </button>
      <button
        onClick={() => setShowActiveOnly(true)}
        className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${showActiveOnly ? 'bg-[#420047] text-white' : 'text-[#8B7355] hover:text-[#420047]'}`}
      >
        本周参与 ({stats.matchingUsers ?? 0})
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ── 页头 + 看板切换 ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#2C2825]">数据总览</h2>
          <p className="mt-0.5 text-xs text-gray-400">当前匹配周 {stats.weekOf}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${stats.isLocked ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
            {stats.isLocked ? '匹配锁定中' : '匹配可操作'}
          </span>
          <span className="rounded-full bg-[#420047]/5 px-3 py-1 text-xs text-[#420047]">
            覆盖 {weekMatchCoverageRate.toFixed(0)}%
          </span>
          <span className="rounded-full bg-[#A85151]/5 px-3 py-1 text-xs text-[#A85151]">
            双向率 {weekMutualRate.toFixed(0)}%
          </span>
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
            <button
              onClick={() => setActiveBoard('promo')}
              className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${activeBoard === 'promo' ? 'bg-[#420047] text-white' : 'text-[#8B7355] hover:text-[#420047]'}`}
            >
              宣传看板
            </button>
            <button
              onClick={() => setActiveBoard('ops')}
              className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${activeBoard === 'ops' ? 'bg-[#420047] text-white' : 'text-[#8B7355] hover:text-[#420047]'}`}
            >
              运营看板
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          宣传看板：对外汇报 / 推文 / 海报引用
      ══════════════════════════════════════════════════════════════════════ */}
      {activeBoard === 'promo' && (
        <div className="space-y-8">
          {/* 核心宣传数字 */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
            <StatCard label="累计注册用户" value={stats.totalUsers} />
            <StatCard label="完成最新问卷" value={stats.surveyComplete} />
            <StatCard label="本周参与匹配" value={stats.matchingUsers ?? '-'} />
            <StatCard label="本周配对数" value={stats.weekMatches} />
            <StatCard label="本周双向心动" value={stats.weekMutual} />
            <StatCard label="累计双向心动" value={stats.totalMutual} />
            <StatCard label="信笺累计投递" value={heartbox?.signalsTotal ?? 0} />
            <StatCard label="信笺双向成功" value={heartbox?.matchesTotal ?? 0} />
            <StatCard label="本周最高分" value={formatScorePercent(stats.weekMaxScore, 0)} />
            <StatCard label="本周最低分" value={formatScorePercent(stats.weekMinScore, 0)} />
          </div>

          {/* 宣传口径速记 */}
          <div className="rounded-xl border border-[#420047]/15 bg-[#420047]/[0.03] p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#420047]">宣传口径速记</p>
            <div className="space-y-2.5 text-sm leading-6 text-gray-700">
              <p className="rounded-lg bg-white px-4 py-3 shadow-sm">
                截至目前，已有 <strong className="text-[#2C2825]">{stats.surveyComplete}</strong> 位用户完成最新问卷，本周共有 <strong className="text-[#2C2825]">{stats.matchingUsers ?? 0}</strong> 位用户参与匹配。
              </p>
              <p className="rounded-lg bg-white px-4 py-3 shadow-sm">
                本周促成 <strong className="text-[#2C2825]">{stats.weekMatches}</strong> 对匹配，其中 <strong className="text-[#2C2825]">{stats.weekMutual}</strong> 对双向心动（双向率 <strong className="text-[#2C2825]">{weekMutualRate.toFixed(0)}%</strong>），匹配得分区间 <strong className="text-[#2C2825]">{formatScorePercent(stats.weekMinScore, 0)}</strong> – <strong className="text-[#2C2825]">{formatScorePercent(stats.weekMaxScore, 0)}</strong>。
              </p>
              <p className="rounded-lg bg-white px-4 py-3 shadow-sm">
                累计双向心动已达 <strong className="text-[#2C2825]">{stats.totalMutual}</strong> 对。
                {promoWeekCategoryData[0] && <> 本周最常见共同兴趣大类：<strong className="text-[#2C2825]">{promoWeekCategoryData[0].name}</strong>。</>}
                {promoWeekDetailData[0] && <> 最热细分兴趣：<strong className="text-[#2C2825]">{promoWeekDetailData[0].name}</strong>。</>}
                {promoTotalCategoryData[0] && <> 累计最稳定大类：<strong className="text-[#2C2825]">{promoTotalCategoryData[0].name}</strong>。</>}
              </p>
              {heartbox && (
                <p className="rounded-lg bg-white px-4 py-3 shadow-sm">
                  心动信笺累计投递 <strong className="text-[#2C2825]">{heartbox.signalsTotal}</strong> 次，已有 <strong className="text-[#2C2825]">{heartbox.matchesTotal}</strong> 对双向成功。新版信笺独立启封，双向后会自动暂停主线。
                </p>
              )}
            </div>
          </div>

          {/* 用户画像分布 */}
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#8B7355]">用户画像分布</p>
              <DistributionToggle />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {renderPieChart(genderData, '性别分布')}
              {renderPieChart(intentionData, '匹配意向')}
              {renderPieChart(campusData, '校区分布')}
              {renderPieChart(gradeData, '年级 / 学位')}
              {renderPieChart(departmentData.slice(0, 5), '院系分布 Top 5')}
            </div>
          </div>

          {/* 共同兴趣 */}
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#8B7355]">共同兴趣分析</p>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {renderInterestBar(promoWeekCategoryData, '本周共同兴趣大类 Top 10', '按本周匹配出现的大类兴趣统计', '本周暂无共同兴趣大类统计')}
              {renderInterestBar(promoWeekDetailData, '本周共同兴趣具体项 Top 10', '按本周匹配出现的具体兴趣统计', '本周暂无共同兴趣具体项统计')}
              {renderInterestBar(promoTotalCategoryData, '累计共同兴趣大类 Top 10', '按历史全部匹配统计，反映长期稳定的兴趣版图', '暂无累计共同兴趣大类统计')}
              {renderInterestBar(promoTotalDetailData, '累计共同兴趣具体项 Top 10', '按历史全部匹配统计，反映长期最热门的细分兴趣', '暂无累计共同兴趣具体项统计')}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          运营看板：内部健康度 / 过程数据 / 排查指标
      ══════════════════════════════════════════════════════════════════════ */}
      {activeBoard === 'ops' && (
        <div className="space-y-8">
          {/* 本周健康度 */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#8B7355]">本周健康度</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard label="本周参与匹配" value={stats.matchingUsers ?? '-'} />
              <StatCard label="本周配对" value={stats.weekMatches} />
              <StatCard label="覆盖率" value={`${weekMatchCoverageRate.toFixed(0)}%`} />
              <StatCard label="双向率" value={`${weekMutualRate.toFixed(0)}%`} />
              <StatCard label="寄语完成率" value={`${curatorNoteRate.toFixed(0)}%`} />
              <StatCard
                label="晚风私语"
                value={
                  stats.weekCuratorNotesDone != null && stats.weekMatches > 0
                    ? <span className={stats.weekCuratorNotesDone >= stats.weekMatches ? 'text-green-600' : 'text-amber-600'}>{stats.weekCuratorNotesDone} / {stats.weekMatches}</span>
                    : '-'
                }
              />
            </div>
          </div>

          {/* 用户漏斗 */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#8B7355]">用户漏斗</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              <StatCard label="总注册用户" value={stats.totalUsers} />
              <StatCard label="已注销" value={stats.deletedUsers ?? 0} />
              <StatCard label="活跃用户" value={stats.activeUsers} />
              <StatCard label="本周新增" value={stats.newUsersThisWeek} />
              <StatCard label="资料完成" value={stats.profileComplete} />
              <StatCard label="问卷完成(最新)" value={stats.surveyComplete} />
              <StatCard label="问卷版本过旧" value={stats.surveyOutdated ?? '-'} />
            </div>
          </div>

          {/* 心动信笺 */}
          <div>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#8B7355]">心动信笺使用情况</p>
                <p className="mt-1 text-xs text-gray-400">仅展示聚合指标，不暴露学号、hash 或投递双方身份。</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
              <StatCard label="已绑定学号" value={heartbox?.boundUsers ?? 0} />
              <StatCard label="累计投递" value={heartbox?.signalsTotal ?? 0} />
              <StatCard label="本周投递" value={heartbox?.signalsThisWeek ?? 0} />
              <StatCard label="投递用户" value={heartbox?.uniqueSenders ?? 0} />
              <StatCard label="活跃投递" value={heartbox?.activeSignals ?? 0} />
              <StatCard label="目标已解析" value={heartbox?.resolvedActiveSignals ?? 0} />
              <StatCard label="双向成功" value={heartbox?.matchesTotal ?? 0} />
              <StatCard label="旧版主线记录" value={heartbox?.mainMatchesTotal ?? 0} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
              <StatCard label="本周双向成功" value={heartbox?.matchesThisWeek ?? 0} />
              <StatCard label="待独立启封" value={heartbox?.matchesQueued ?? 0} />
              <StatCard label="已独立启封" value={heartbox?.matchesActive ?? 0} />
              <StatCard label="撤回冷却中" value={heartbox?.cooldownUsers ?? 0} />
              <StatCard label="双向成功率" value={`${heartboxActivationRate.toFixed(0)}%`} />
              <StatCard label="旧版接入率" value={`${heartboxLegacyMainlineRate.toFixed(0)}%`} />
              <StatCard label="互选邮件" value={heartbox?.mutualEmailsSent ?? 0} />
              <StatCard label="未解析活跃" value={heartbox?.unresolvedActiveSignals ?? 0} />
            </div>
            {heartbox && (
              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <h3 className="mb-3 text-sm font-semibold text-[#2C2825]">投递状态分布</h3>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 sm:grid-cols-4">
                    {Object.entries({
                      active: '活跃',
                      matched: '双向成功',
                      cancelled: '已撤回',
                    }).map(([key, label]) => (
                      <div key={key} className="rounded border border-gray-100 bg-gray-50 px-3 py-2">
                        <p className="text-gray-400">{label}</p>
                        <p className="mt-1 text-lg font-semibold text-[#2C2825]">{heartbox.signalStatusBreakdown?.[key] ?? 0}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <h3 className="mb-3 text-sm font-semibold text-[#2C2825]">双向记录状态分布</h3>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 sm:grid-cols-4">
                    {Object.entries({
                      active: '已独立启封',
                      queued: '待独立启封',
                    }).map(([key, label]) => (
                      <div key={key} className="rounded border border-gray-100 bg-gray-50 px-3 py-2">
                        <p className="text-gray-400">{label}</p>
                        <p className="mt-1 text-lg font-semibold text-[#2C2825]">{heartbox.matchStatusBreakdown?.[key] ?? 0}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 匹配数据 */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#8B7355]">匹配数据</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard label={`本周 (${stats.weekOf})`} value={stats.weekMatches} />
              <StatCard label="本周双向" value={stats.weekMutual} />
              <StatCard label="累计双向" value={stats.totalMutual} />
              <StatCard label="本周最高分" value={formatScorePercent(stats.weekMaxScore, 0)} />
              <StatCard label="本周最低分" value={formatScorePercent(stats.weekMinScore, 0)} />
              <StatCard
                label={avgScoreWeekOf && avgScoreWeekOf !== stats.weekOf ? `均分 (${avgScoreWeekOf.slice(5)})` : '周均分'}
                value={formatScorePercent(typeof latestWeeklyAvgScore === 'number' ? latestWeeklyAvgScore : null, 0)}
              />
            </div>
          </div>

          {/* 历史趋势图 */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-[#2C2825]">历史匹配趋势</h3>
              {weeklyStats.length > 0 ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyStats} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="weekOf" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip wrapperStyle={{ fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="total" name="总匹配数" fill="#8884d8" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="mutual" name="双向心动" fill="#82ca9d" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <div className="flex h-64 items-center justify-center text-sm text-gray-400">暂无数据</div>}
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-[#2C2825]">平均匹配得分趋势</h3>
              {weeklyStats.length > 0 ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weeklyStats} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="weekOf" tick={{ fontSize: 11 }} />
                      <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} />
                      <Tooltip wrapperStyle={{ fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="avgScore" name="平均得分" stroke="#ff7300" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : <div className="flex h-64 items-center justify-center text-sm text-gray-400">暂无数据</div>}
            </div>

            {/* 转化漏斗 */}
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-[#2C2825]">匹配转化漏斗</h3>
              {weeklyStats.length > 0 ? (() => {
                const thisWeekStat = weeklyStats.find(w => w.weekOf === stats.weekOf);
                const funnelData = [
                  { name: '配对总数', 本周: thisWeekStat?.total ?? stats.weekMatches ?? 0, 全部: weeklyStats.reduce((s, w) => s + w.total, 0) },
                  { name: '已揭晓', 本周: thisWeekStat?.revealed ?? 0, 全部: weeklyStats.reduce((s, w) => s + (w.revealed || 0), 0) },
                  { name: '双向心动', 本周: thisWeekStat?.mutual ?? stats.weekMutual ?? 0, 全部: weeklyStats.reduce((s, w) => s + w.mutual, 0) },
                  { name: '错过', 本周: thisWeekStat?.missed ?? 0, 全部: weeklyStats.reduce((s, w) => s + w.missed, 0) },
                ];
                return (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={funnelData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip wrapperStyle={{ fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="本周" fill="#A85151" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="全部" fill="#8884d8" radius={[3, 3, 0, 0]} opacity={0.7} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                );
              })() : <div className="flex h-64 items-center justify-center text-sm text-gray-400">暂无数据</div>}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Users
// ---------------------------------------------------------------------------

function UsersTab({ onAuthFail }: { onAuthFail: () => void }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const limit = 20;

  const fetchUsers = useCallback(() => {
    setLoading(true);
    setError('');
    adminFetch(`/users?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`)
      .then((data) => {
        setUsers(data.users || data.data || []);
        setTotal(data.total ?? 0);
      })
      .catch((err) => {
        if (err.message === 'AUTH_FAILED') return onAuthFail();
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [page, search, onAuthFail]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const handleRowClick = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(id);
    setDetail(null);
    setDetailLoading(true);
    adminFetch(`/users/${id}`)
      .then((data) => setDetail(data))
      .catch((err) => {
        if (err.message === 'AUTH_FAILED') return onAuthFail();
        setDetail(null);
      })
      .finally(() => setDetailLoading(false));
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const renderSurveyAnswers = (survey: UserDetail['survey']) => {
    if (!survey) return <span className="text-gray-400">无 survey answers</span>;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(survey.answers);
    } catch {
      return <pre className="whitespace-pre-wrap text-xs">{survey.answers}</pre>;
    }
    return (
      <div className="space-y-2">
        <p className="text-xs text-gray-500">版本： {survey.version}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
          {Object.entries(parsed).map(([k, v]) => (
            <React.Fragment key={k}>
              <dt className="font-medium text-[#8B7355]">{k}</dt>
              <dd className="text-[#2C2825]">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd>
            </React.Fragment>
          ))}
        </dl>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="按邮箱、昵称、ID搜索..."
          className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#420047]"
        />
        <button
          type="submit"
          className="rounded-lg border border-[#420047] px-4 py-2 text-sm text-[#420047] hover:bg-[#420047] hover:text-white transition-colors"
        >
          Search
        </button>
      </form>

      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
    
      {loading ? (
        <Spinner />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100 text-left text-xs uppercase tracking-wider text-[#8B7355]">
                  <th className="px-3 py-2">邮箱</th>
                  <th className="px-3 py-2">昵称</th>
                  <th className="px-3 py-2">性别</th>
                  <th className="px-3 py-2">年级</th>
                  <th className="px-3 py-2">校区</th>
                  <th className="px-3 py-2">MBTI</th>
                  <th className="px-3 py-2">参与匹配</th>
                  <th className="px-3 py-2">问卷</th>
                  <th className="px-3 py-2">注册时间</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-gray-400">
                      No users found
                    </td>
                  </tr>
                )}
                {users.map((u, i) => (
                  <React.Fragment key={u.id}>
                    <tr
                      onClick={() => handleRowClick(u.id)}
                      className={`cursor-pointer border-t border-gray-100 transition-colors hover:bg-gray-50 ${
                        i % 2 === 1 ? 'bg-gray-50/50' : ''
                      }`}
                    >
                      <td className="px-3 py-2 font-mono text-xs">{u.email}</td>
                      <td className="px-3 py-2">{u.nickname || '-'}</td>
                      <td className="px-3 py-2">{u.gender || '-'}</td>
                      <td className="px-3 py-2">{u.grade || '-'}</td>
                      <td className="px-3 py-2">{u.campus || '-'}</td>
                      <td className="px-3 py-2">{u.mbti || '-'}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 text-xs ${
                            !u.isParticipating
                              ? 'bg-gray-100 text-gray-500'
                              : u.pauseUntilWeek === getUpcomingWeekOf()
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {!u.isParticipating
                            ? 'No'
                            : u.pauseUntilWeek === getUpcomingWeekOf()
                            ? 'Paused'
                            : 'Yes'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 text-xs ${
                            u.surveyComplete
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {u.surveyComplete ? 'Done' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">{shortDate(u.createdAt)}</td>
                    </tr>
                    {expandedId === u.id && (
                      <tr>
                        <td colSpan={9} className="border-t border-gray-100 bg-gray-50 px-4 py-4">
                          {detailLoading ? (
                            <Spinner />
                          ) : detail ? (
                            <div className="space-y-4">
                              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8B7355]">
                                Full Profile
                              </h3>
                              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                                {Object.entries(detail.user).map(([k, v]) => (
                                    <React.Fragment key={k}>
                                      <dt className="font-medium text-[#8B7355]">{k}</dt>
                                      <dd className="text-[#2C2825]">
                                        {v === null || v === undefined
                                          ? '-'
                                          : typeof v === 'boolean'
                                          ? v
                                            ? 'true'
                                            : 'false'
                                          : typeof v === 'object'
                                          ? JSON.stringify(v)
                                          : String(v)}
                                      </dd>
                                    </React.Fragment>
                                  ))}
                              </dl>
    
                              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8B7355]">
                                Survey Answers
                              </h3>
                              {renderSurveyAnswers(detail.survey)}
    
                              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8B7355]">
                                Match History
                              </h3>
                              {detail.matches && detail.matches.length > 0 ? (
                                <div className="overflow-x-auto rounded border border-gray-200">
                                  <table className="w-full border-collapse text-xs">
                                    <thead>
                                      <tr className="bg-gray-100 text-left uppercase tracking-wider text-[#8B7355]">
                                        {Object.keys(detail.matches[0]).map((k) => (
                                          <th key={k} className="px-2 py-1">
                                            {k}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {detail.matches.map((m, idx) => (
                                        <tr
                                          key={idx}
                                          className={idx % 2 === 1 ? 'bg-gray-50/50' : ''}
                                        >
                                          {Object.values(m).map((v, vi) => (
                                            <td key={vi} className="px-2 py-1">
                                              {v === null || v === undefined
                                                ? '-'
                                                : String(v)}
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-xs text-gray-400">无 match history</p>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400">加载详情失败</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
    
          {/* Pagination */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              第 {page} 页 / 共 {totalPages} 页 (共 {total} 条)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded border border-gray-200 px-3 py-1 text-xs hover:bg-gray-100 disabled:opacity-40"
              >上一页</button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded border border-gray-200 px-3 py-1 text-xs hover:bg-gray-100 disabled:opacity-40"
              >下一页</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Matches
// ---------------------------------------------------------------------------

function MatchesTab({ onAuthFail }: { onAuthFail: () => void }) {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [weekOf, setWeekOf] = useState('');
  const [status, setStatus] = useState('all');
  const [sortBy, setSortBy] = useState<'score' | 'createdAt' | 'weekOf' | 'status'>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detailMatch, setDetailMatch] = useState<MatchRow | null>(null);

  const [weeklyStats, setWeeklyStats] = useState<WeeklyStat[]>([]);
  const [wsLoading, setWsLoading] = useState(false);
  const [scoreDist, setScoreDist] = useState<{ range: string; count: number }[]>([]);
  const [sdLoading, setSdLoading] = useState(false);

  const limit = 20;

  const fetchMatches = useCallback(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (weekOf) params.set('weekOf', weekOf);
    if (status !== 'all') params.set('status', status);
    params.set('sortBy', sortBy);
    params.set('sortOrder', sortOrder);
    adminFetch(`/matches?${params}`)
      .then((data) => {
        setMatches(data.matches || data.data || []);
        setTotal(data.total ?? 0);
      })
      .catch((err) => {
        if (err.message === 'AUTH_FAILED') return onAuthFail();
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [page, weekOf, status, sortBy, sortOrder, onAuthFail]);

  const fetchWeeklyStats = useCallback(() => {
    setWsLoading(true);
    adminFetch('/matches/weekly-stats')
      .then((data) => setWeeklyStats(Array.isArray(data) ? data : data.weeks || []))
      .catch((err) => {
        if (err.message === 'AUTH_FAILED') return onAuthFail();
      })
      .finally(() => setWsLoading(false));
  }, [onAuthFail]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  useEffect(() => {
    fetchWeeklyStats();
  }, [fetchWeeklyStats]);

  const fetchScoreDist = useCallback(() => {
    setSdLoading(true);
    const params = weekOf ? `?weekOf=${encodeURIComponent(weekOf)}` : '';
    adminFetch(`/matches/score-distribution${params}`)
      .then((data) => setScoreDist(data.buckets || []))
      .catch((err) => {
        if (err.message === 'AUTH_FAILED') return onAuthFail();
      })
      .finally(() => setSdLoading(false));
  }, [weekOf, onAuthFail]);

  useEffect(() => {
    fetchScoreDist();
  }, [fetchScoreDist]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const activeWeekLabel = weekOf || '全部周次';
  const topScoreInPage = matches.length > 0
    ? matches.reduce((max, item) => Math.max(max, item.score ?? 0), 0)
    : null;
  const sortValue = `${sortBy}:${sortOrder}`;

  const handleSortChange = (value: string) => {
    const [nextSortBy, nextSortOrder] = value.split(':') as [typeof sortBy, typeof sortOrder];
    setSortBy(nextSortBy);
    setSortOrder(nextSortOrder);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8B7355]">匹配巡查</h2>
            <p className="mt-1 text-xs text-gray-500">
              当前查看 {activeWeekLabel}，{sortBy === 'score' && sortOrder === 'desc' ? '按匹配度从高到低排序' : '可切换排序方式'}。
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-gray-600">
            <span className="rounded-full bg-[#420047]/5 px-3 py-1">共 {total} 对</span>
            <span className="rounded-full bg-[#A85151]/5 px-3 py-1">本页最高 {formatScorePercent(topScoreInPage)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-[#8B7355]">匹配周</label>
          <select
            value={weekOf}
            onChange={(e) => {
              setWeekOf(e.target.value);
              setPage(1);
            }}
            className="min-w-[180px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#420047]"
          >
            <option value="">全部周次</option>
            {weeklyStats.map((ws) => (
              <option key={ws.weekOf} value={ws.weekOf}>
                {ws.weekOf} · {ws.total} 对
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-[#8B7355]">状态</label>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#420047]"
          >
            <option value="all">全部</option>
            <option value="LOCKED">已锁定</option>
            <option value="REVEALED">REVEALED</option>
            <option value="MUTUAL">MUTUAL</option>
            <option value="MISSED">MISSED</option>
            <option value="EXPIRED">EXPIRED</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-[#8B7355]">排序</label>
          <select
            value={sortValue}
            onChange={(e) => handleSortChange(e.target.value)}
            className="min-w-[180px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#420047]"
          >
            <option value="score:desc">匹配度最高</option>
            <option value="score:asc">匹配度最低</option>
            <option value="createdAt:desc">最新生成</option>
            <option value="createdAt:asc">最早生成</option>
            <option value="weekOf:desc">周次从新到旧</option>
            <option value="weekOf:asc">周次从旧到新</option>
            <option value="status:asc">状态 A-Z</option>
          </select>
        </div>
        <button
          onClick={() => {
            setPage(1);
            fetchMatches();
          }}
          className="rounded-lg border border-[#420047] px-4 py-2 text-sm text-[#420047] hover:bg-[#420047] hover:text-white transition-colors"
        >
          Apply
        </button>
        </div>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
    
      {loading ? (
        <Spinner />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100 text-left text-xs uppercase tracking-wider text-[#8B7355]">
                  <th className="px-3 py-2">周数</th>
                  <th className="px-3 py-2">用户 A</th>
                  <th className="px-3 py-2">用户 B</th>
                  <th className="px-3 py-2">匹配分</th>
                  <th className="px-3 py-2">状态</th>
                  <th className="px-3 py-2">A 操作</th>
                  <th className="px-3 py-2">B 操作</th>
                  <th className="px-3 py-2">注册时间</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {matches.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-gray-400">
                      No matches found
                    </td>
                  </tr>
                )}
                {matches.map((m, i) => (
                  <tr
                    key={m.id || i}
                    className={`border-t border-gray-100 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}
                  >
                    <td className="px-3 py-2 text-xs">{m.weekOf}</td>
                    <td className="px-3 py-2 font-mono text-xs">{m.userAId}</td>
                    <td className="px-3 py-2 font-mono text-xs">{m.userBId}</td>
                    <td className="px-3 py-2">
                      <div className="min-w-[96px]">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="font-medium text-[#420047]">{formatScorePercent(m.score)}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-[#EAE7E1]">
                          <div
                            className="h-full rounded-full bg-[#420047]"
                            style={{ width: `${Math.max(0, Math.min(100, m.score * 100))}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                          m.status === 'MUTUAL'
                            ? 'bg-green-100 text-green-700'
                            : m.status === 'LOCKED'
                            ? 'bg-yellow-100 text-yellow-700'
                            : m.status === 'REVEALED'
                            ? 'bg-blue-100 text-blue-700'
                            : m.status === 'MISSED'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {m.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">{m.userAAction || '-'}</td>
                    <td className="px-3 py-2 text-xs">{m.userBAction || '-'}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{shortDate(m.createdAt)}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => setDetailMatch(m)}
                        className="rounded px-2 py-0.5 text-xs border border-[#420047]/30 text-[#420047] hover:bg-[#420047]/10 transition-colors"
                      >
                        详情
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
    
          {/* Pagination */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              第 {page} 页 / 共 {totalPages} 页 (共 {total} 条)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded border border-gray-200 px-3 py-1 text-xs hover:bg-gray-100 disabled:opacity-40"
              >上一页</button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded border border-gray-200 px-3 py-1 text-xs hover:bg-gray-100 disabled:opacity-40"
              >下一页</button>
            </div>
          </div>
        </>
      )}
    
      {/* Weekly Stats */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8B7355]">
          Weekly Stats
        </h2>
        {wsLoading ? (
          <Spinner />
        ) : weeklyStats.length === 0 ? (
          <p className="text-sm text-gray-400">无 weekly stats available</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100 text-left text-xs uppercase tracking-wider text-[#8B7355]">
                  <th className="px-3 py-2">周数</th>
                  <th className="px-3 py-2">总数</th>
                  <th className="px-3 py-2">双向奔赴</th>
                  <th className="px-3 py-2">错过</th>
                  <th className="px-3 py-2">平均分</th>
                </tr>
              </thead>
              <tbody>
                {weeklyStats.map((ws, i) => (
                  <tr
                    key={ws.weekOf}
                    className={`border-t border-gray-100 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}
                  >
                    <td className="px-3 py-2">{ws.weekOf}</td>
                    <td className="px-3 py-2">{ws.total}</td>
                    <td className="px-3 py-2">{ws.mutual}</td>
                    <td className="px-3 py-2">{ws.missed}</td>
                    <td className="px-3 py-2">{typeof ws.avgScore === 'number' ? ws.avgScore.toFixed(2) : ws.avgScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    
      {/* 分数分布图 */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8B7355]">
          匹配度分布
        </h2>
        {sdLoading ? (
          <Spinner />
        ) : scoreDist.length === 0 ? (
          <p className="text-sm text-gray-400">暂无分布数据</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={scoreDist} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe3" />
              <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#8B7355' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#8B7355' }} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" name="配对数" fill="#420047" radius={[4, 4, 0, 0]} opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    
      {/* 匹配详情弹窗 */}
      {detailMatch && (() => {
        let dims: Record<string, number> = {};
        let sharedInterests: string[] = [];
        let intention = '';
        try {
          const parsed = JSON.parse(detailMatch.dimensions || '{}');
          sharedInterests = parsed._sharedInterests || [];
          intention = parsed._intention || '';
          dims = Object.fromEntries(
            Object.entries(parsed).filter(([k]) => !k.startsWith('_')) as [string, number][]
          );
        } catch { /* ignore */ }
    
        const DIM_LABELS: Record<string, string> = {
          lifestyle: '生活习惯',
          communication: '相处沟通',
          boundary: '边界安全感',
          values: '价值观',
        };

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={() => setDetailMatch(null)}
          >
            <div
              className="relative mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setDetailMatch(null)}
                className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 text-lg leading-none"
              >✕</button>
    
              <h2 className="mb-1 text-base font-semibold text-[#420047]">匹配详情</h2>
              <p className="mb-4 text-xs text-gray-400">{detailMatch.weekOf} · {detailMatch.id}</p>
    
              {/* 基本信息 */}
              <div className="mb-4 rounded-lg bg-gray-50 p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">用户 A</span>
                  <span className="font-mono text-gray-700">{detailMatch.userAId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">用户 B</span>
                  <span className="font-mono text-gray-700">{detailMatch.userBId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">综合得分</span>
                  <span className="font-semibold text-[#420047]">{(detailMatch.score * 100).toFixed(1)}%</span>
                </div>
                {intention && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">匹配意向</span>
                    <span>{intention === 'partner' ? '找伴侣' : intention === 'friend' ? '找朋友' : intention}</span>
                  </div>
                )}
              </div>
    
              {/* 维度得分 */}
              {Object.keys(dims).length > 0 && (
                <div className="mb-4">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#8B7355]">维度得分</h3>
                  <div className="space-y-1.5">
                    {Object.entries(dims).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-2">
                        <span className="w-16 shrink-0 text-xs text-gray-500">{DIM_LABELS[k] || k}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-gray-100">
                          <div
                            className="h-1.5 rounded-full bg-[#420047]/60"
                            style={{ width: `${(v as number) * 100}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-xs text-gray-500">{((v as number) * 100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
    
              {/* 共同兴趣 */}
              {sharedInterests.length > 0 && (
                <div className="mb-4">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#8B7355]">共同兴趣</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {sharedInterests.map((item) => (
                      <span
                        key={item}
                        className="rounded-full bg-[#420047]/10 px-2.5 py-0.5 text-xs text-[#420047]"
                      >
                        {ADMIN_INTEREST_LABELS[item] || item}
                      </span>
                    ))}
                  </div>
                </div>
              )}
    
              {/* 晚风私语 */}
              {detailMatch.curatorNote ? (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#8B7355]">晚风私语</h3>
                  <p className="rounded-lg bg-amber-50 p-3 text-sm leading-relaxed text-gray-700">
                    {detailMatch.curatorNote}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">暂无晚风私语</p>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Heartbox Signals
// ---------------------------------------------------------------------------

function HeartboxSignalsTab({ onAuthFail }: { onAuthFail: () => void }) {
  const [signals, setSignals] = useState<HeartboxSignalRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('all');
  const [resolved, setResolved] = useState('all');
  const [sortBy, setSortBy] = useState<'createdAt' | 'updatedAt' | 'status'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detailSignal, setDetailSignal] = useState<HeartboxSignalRow | null>(null);
  const limit = 20;

  const fetchSignals = useCallback(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      status,
      resolved,
      sortBy,
      sortOrder,
    });
    adminFetch(`/heartbox/signals?${params}`)
      .then((data) => {
        setSignals(data.signals || []);
        setTotal(data.total ?? 0);
      })
      .catch((err) => {
        if (err.message === 'AUTH_FAILED') return onAuthFail();
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [page, status, resolved, sortBy, sortOrder, onAuthFail]);

  useEffect(() => {
    fetchSignals();
  }, [fetchSignals]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const sortValue = `${sortBy}:${sortOrder}`;

  const handleSortChange = (value: string) => {
    const [nextSortBy, nextSortOrder] = value.split(':') as [typeof sortBy, typeof sortOrder];
    setSortBy(nextSortBy);
    setSortOrder(nextSortOrder);
    setPage(1);
  };

  const signalStatusLabel = (value: string) => {
    if (value === 'active') return '等待对方也选择';
    if (value === 'matched') return '双向成功';
    if (value === 'cancelled') return '已撤回';
    return value || '-';
  };

  const signalStatusClass = (value: string) => {
    if (value === 'active') return 'bg-blue-100 text-blue-700';
    if (value === 'matched') return 'bg-green-100 text-green-700';
    if (value === 'cancelled') return 'bg-gray-100 text-gray-600';
    return 'bg-amber-100 text-amber-700';
  };

  const heartMatchStatusLabel = (value?: string | null) => {
    if (!value) return '-';
    if (value === 'active') return '已独立启封';
    if (value === 'queued') return '待独立启封';
    return value;
  };

  const renderUserSummary = (user: HeartboxSignalRow['sender'] | NonNullable<HeartboxSignalRow['resolvedTarget']> | null) => {
    if (!user) return <span className="text-gray-400">未解析账号</span>;
    return (
      <div className="space-y-0.5">
        <p className="text-sm text-[#2C2825]">{user.nickname || '未命名用户'}</p>
        <p className="font-mono text-[11px] text-gray-400">{user.email || user.id}</p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8B7355]">心动信笺巡查</h2>
            <p className="mt-1 text-xs text-gray-500">
              查看投递记录、目标解析状态和双向成功后的独立启封情况。这里不展示明文学号或 hash。
            </p>
          </div>
          <span className="rounded-full bg-[#420047]/5 px-3 py-1 text-xs text-[#420047]">共 {total} 条投递</span>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-[#8B7355]">投递状态</label>
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="min-w-[180px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#420047]"
            >
              <option value="all">全部</option>
              <option value="active">等待对方也选择</option>
              <option value="matched">双向成功</option>
              <option value="cancelled">已撤回</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#8B7355]">目标账号</label>
            <select
              value={resolved}
              onChange={(e) => { setResolved(e.target.value); setPage(1); }}
              className="min-w-[160px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#420047]"
            >
              <option value="all">全部</option>
              <option value="resolved">已解析账号</option>
              <option value="unresolved">未解析账号</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#8B7355]">排序</label>
            <select
              value={sortValue}
              onChange={(e) => handleSortChange(e.target.value)}
              className="min-w-[180px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#420047]"
            >
              <option value="createdAt:desc">最新投递</option>
              <option value="createdAt:asc">最早投递</option>
              <option value="updatedAt:desc">最近更新</option>
              <option value="updatedAt:asc">最早更新</option>
              <option value="status:asc">状态 A-Z</option>
            </select>
          </div>
          <button
            onClick={() => { setPage(1); fetchSignals(); }}
            className="rounded-lg border border-[#420047] px-4 py-2 text-sm text-[#420047] hover:bg-[#420047] hover:text-white transition-colors"
          >
            Apply
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

      {loading ? (
        <Spinner />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100 text-left text-xs uppercase tracking-wider text-[#8B7355]">
                  <th className="px-3 py-2">投递人</th>
                  <th className="px-3 py-2">目标学号</th>
                  <th className="px-3 py-2">目标账号</th>
                  <th className="px-3 py-2">投递状态</th>
                  <th className="px-3 py-2">双向结果</th>
                  <th className="px-3 py-2">旧版主线记录</th>
                  <th className="px-3 py-2">投递时间</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {signals.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-gray-400">
                      暂无心动信笺记录
                    </td>
                  </tr>
                )}
                {signals.map((signal, i) => (
                  <tr key={signal.id} className={`border-t border-gray-100 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                    <td className="px-3 py-2">{renderUserSummary(signal.sender)}</td>
                    <td className="px-3 py-2 font-mono text-xs text-[#2C2825]">{signal.targetStudentIdMasked}</td>
                    <td className="px-3 py-2">{renderUserSummary(signal.resolvedTarget)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${signalStatusClass(signal.status)}`}>
                        {signalStatusLabel(signal.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">{heartMatchStatusLabel(signal.heartMatch?.status)}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-500">{signal.heartMatch?.mainMatchId || '-'}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{shortDate(signal.createdAt)}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => setDetailSignal(signal)}
                        className="rounded px-2 py-0.5 text-xs border border-[#420047]/30 text-[#420047] hover:bg-[#420047]/10 transition-colors"
                      >
                        详情
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              第 {page} 页 / 共 {totalPages} 页 (共 {total} 条)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded border border-gray-200 px-3 py-1 text-xs hover:bg-gray-100 disabled:opacity-40"
              >上一页</button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded border border-gray-200 px-3 py-1 text-xs hover:bg-gray-100 disabled:opacity-40"
              >下一页</button>
            </div>
          </div>
        </>
      )}

      {detailSignal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setDetailSignal(null)}
        >
          <div
            className="relative mx-4 w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setDetailSignal(null)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 text-lg leading-none"
            >x</button>
            <h2 className="mb-1 text-base font-semibold text-[#420047]">信笺详情</h2>
            <p className="mb-4 text-xs text-gray-400">{detailSignal.id}</p>

            <dl className="grid grid-cols-[110px_1fr] gap-x-4 gap-y-2 text-xs">
              <dt className="text-[#8B7355]">投递人</dt>
              <dd>{renderUserSummary(detailSignal.sender)}</dd>
              <dt className="text-[#8B7355]">目标学号</dt>
              <dd className="font-mono">{detailSignal.targetStudentIdMasked}</dd>
              <dt className="text-[#8B7355]">目标账号</dt>
              <dd>{renderUserSummary(detailSignal.resolvedTarget)}</dd>
              <dt className="text-[#8B7355]">投递状态</dt>
              <dd>{signalStatusLabel(detailSignal.status)}</dd>
              <dt className="text-[#8B7355]">双向结果</dt>
              <dd>{heartMatchStatusLabel(detailSignal.heartMatch?.status)}</dd>
              <dt className="text-[#8B7355]">旧版主线记录 ID</dt>
              <dd className="font-mono break-all">{detailSignal.heartMatch?.mainMatchId || '-'}</dd>
              <dt className="text-[#8B7355]">投递时间</dt>
              <dd>{shortDate(detailSignal.createdAt)}</dd>
              <dt className="text-[#8B7355]">更新时间</dt>
              <dd>{shortDate(detailSignal.updatedAt)}</dd>
              <dt className="text-[#8B7355]">撤回时间</dt>
              <dd>{detailSignal.cancelledAt ? shortDate(detailSignal.cancelledAt) : '-'}</dd>
              <dt className="text-[#8B7355]">双向成功时间</dt>
              <dd>{detailSignal.matchedAt ? shortDate(detailSignal.matchedAt) : '-'}</dd>
            </dl>

            <div className="mt-5 rounded-lg bg-amber-50 px-4 py-3 text-xs leading-5 text-[#8B7355]">
              当前巡查页只展示必要运营信息；明文学号和学号 hash 不会返回到前端。
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 邮件预览渲染组件 ──────────────────────────────────────────────────────────
type ReportActionType = 'reviewed' | 'warn_update' | 'dismissed' | 'request_evidence';

const SUPPORT_EMAIL = 'njumatch@163.com';

function getReporterMailContent(action: ReportActionType, reportId: string, adminNote?: string) {
  const noteSection = adminNote ? `\n\n管理员备注：${adminNote}` : '';
  const map: Record<ReportActionType, { title: string; lead: string; body: string; footer: string; buttonText?: string }> = {
    reviewed: {
      title: '举报已被受理',
      lead: '感谢你帮助维护社区安全。',
      body: `你提交的举报（编号：${reportId}）经管理员审核后已标记为属实。\n\n我们已向相关用户发送提醒，并会结合后续记录继续关注。出于隐私与安全原因，具体处置细节不在邮件中展开。`,
      footer: '本邮件为平台安全处理通知。如需补充材料，请发送邮件至平台支持邮箱并注明举报编号。',
    },
    warn_update: {
      title: '反馈已处理',
      lead: '感谢你帮助维护社区安全。',
      body: `你提交的举报（编号：${reportId}）已处理完毕。\n\n我们已向相关用户发送资料更新提醒，请对方及时核对并更新联系方式等信息。感谢你帮助维护社区信息的准确性。`,
      footer: '本邮件为平台安全处理通知。如需补充材料，请发送邮件至平台支持邮箱并注明举报编号。',
    },
    dismissed: {
      title: '举报已关闭',
      lead: '感谢你帮助维护社区安全。',
      body: `你提交的举报（编号：${reportId}）已处理完毕。\n\n目前该举报暂未被采纳，可能是证据不足、无法确认违规，或相关内容暂不构成平台规则处置条件。${adminNote ? `\n\n平台说明：${adminNote}` : ''}\n\n感谢你的反馈。`,
      footer: '本邮件为平台安全处理通知。如需补充材料，请发送邮件至平台支持邮箱并注明举报编号。',
    },
    request_evidence: {
      title: '举报跟进 — 请补充材料',
      lead: '你提交的举报正在审核中，我们需要更多信息来做出判断。',
      body: `举报编号：${reportId}${noteSection}\n\n为帮助我们准确审核，请将相关证明材料（截图、聊天记录等）发送至 ${SUPPORT_EMAIL}，邮件主题请注明：举报 ${reportId} 补充材料。\n\n请在收到此邮件后 72 小时内提交，否则我们将依据现有信息继续处理。`,
      footer: `提交材料时请务必注明举报编号 ${reportId}，以便快速关联。`,
      buttonText: '发送证明材料',
    },
  };
  return map[action];
}

function getReportedMailContent(action: ReportActionType, reportId: string, reasonText: string, adminNote: string) {
  const noteSection = adminNote ? `\n\n管理员备注：${adminNote}` : '';
  if (action === 'reviewed') {
    return {
      title: '社区行为提醒',
      lead: '我们收到了与你账号相关的举报，并已完成初步审核。',
      body: `举报编号：${reportId}\n涉及类型：${reasonText || '社区安全相关'}${noteSection}\n\n经管理员审核，该举报已被标记为属实。请你检查并调整资料、发言或互动方式，避免骚扰、虚假资料、不当内容或其他影响社区安全的行为。\n\n如果你认为本次判断存在误会，可以通过 ${SUPPORT_EMAIL} 提交申诉。申诉时请附上举报编号和你的说明，我们会进一步复核。`,
      footer: '本提醒不会公开展示给其他用户。严重或重复违规可能导致账号功能受限。',
      buttonText: undefined,
    };
  }
  if (action === 'warn_update') {
    return {
      title: '资料更新提醒',
      lead: '我们收到了关于你资料信息的反馈，请检查并更新。',
      body: `根据用户反馈，你账号中填写的联系方式（如QQ号、微信号等）或其他资料信息可能存在错误或过期。${noteSection}\n\n请尽快登录 NJU Match，在「个人设置」中核对并更新相关信息，确保配对成功后对方能顺利联系到你。`,
      footer: `本提醒不影响你的匹配资格。如有疑问，可通过 ${SUPPORT_EMAIL} 联系我们。`,
      buttonText: '立即更新资料',
    };
  }
  return null;
}

function EmailPreviewCard({ title, lead, body, footer, buttonText }: {
  title: string; lead: string; body: string; footer?: string; buttonText?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#ece6dc] text-sm font-sans shadow-sm">
      <div className="bg-gradient-to-b from-[#fcfbf8] to-[#f7f2ea] px-5 pb-3 pt-4">
        <p className="text-[11px] uppercase tracking-widest text-[#8B7355]">NJU Match</p>
        <h3 className="mt-1.5 text-base font-semibold text-[#2C2825]">{title}</h3>
      </div>
      <div className="bg-white px-5 pb-5 pt-4 leading-relaxed">
        <p className="text-[#5B4D3F]">{lead}</p>
        <p className="mt-2 whitespace-pre-line text-[12px] text-[#2C2825]">{body}</p>
        {buttonText && (
          <div className="mt-4">
            <span className="inline-block rounded-lg bg-[#420047] px-4 py-2 text-xs font-semibold text-white">{buttonText}</span>
          </div>
        )}
        {footer && (
          <div className="mt-4 text-[11px] leading-relaxed text-[#8B7355]">
            <p>{footer}</p>
            <p className="mt-1">如果不希望再收到此类通知，可以在系统设置内关闭邮件提醒。</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function ReportsTab({ onAuthFail }: { onAuthFail: () => void }) {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<'pending' | 'reviewed' | 'warn_update' | 'dismissed' | 'all'>('pending');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);
  const [detailReport, setDetailReport] = useState<ReportRow | null>(null);
  const [reportedDetail, setReportedDetail] = useState<UserDetail | null>(null);
  const [reportedDetailLoading, setReportedDetailLoading] = useState(false);
  const [actionModal, setActionModal] = useState<{
    reportId: string;
    reportReason: string;
    selectedAction: ReportActionType;
    penaltyScore: 1 | 3 | 5;
    adminNote: string;
    emailPreviewTab: 'reporter' | 'reported';
  } | null>(null);
  const [showEmailTemplates, setShowEmailTemplates] = useState(false);
  const limit = 20;

  const STATUS_LABELS: Record<ReportRow['status'], string> = {
    pending: '待处理',
    reviewed: '已标记属实',
    warn_update: '已发提醒',
    dismissed: '已关闭',
  };

  const formatReportReason = (reason: string) => {
    const REASON_LABELS: Record<string, string> = {
      harassment: '骚扰辱骂',
      spam: '垃圾信息',
      fake_profile: '虚假资料',
      inappropriate_content: '不当内容',
      other: '其他原因',
    };
    return reason
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => REASON_LABELS[item] || item)
      .join('、');
  };

  const fetchReports = useCallback(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      status,
    });
    adminFetch(`/reports?${params.toString()}`)
      .then((data) => {
        setReports(data.reports || []);
        setTotal(data.total ?? 0);
      })
      .catch((err) => {
        if (err.message === 'AUTH_FAILED') return onAuthFail();
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [onAuthFail, page, status]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const openActionModal = (report: ReportRow) => {
    setActionModal({
      reportId: report.id,
      reportReason: formatReportReason(report.reason),
      selectedAction: 'reviewed',
      penaltyScore: 1,
      adminNote: '',
      emailPreviewTab: 'reporter',
    });
  };

  const submitReview = async () => {
    if (!actionModal || actingId) return;
    const { reportId, selectedAction, adminNote, penaltyScore } = actionModal;
    setActingId(reportId);
    setActionMsg('');
    try {
      const result = await adminFetch(`/reports/${reportId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: selectedAction,
          adminNote: adminNote || undefined,
          penaltyScore: selectedAction === 'reviewed' ? penaltyScore : undefined,
        }),
      });
      const notifications = result.notifications || {};
      const reporterNotice = notifications.reporter ? `举报人通知：${notifications.reporter}` : '举报人通知：未知';
      const reportedNotice = notifications.reported ? `被举报人通知：${notifications.reported}` : '被举报人通知：未触发';
      setActionMsg(`${result.message || '举报状态已更新'}（${reporterNotice}，${reportedNotice}）`);
      setActionModal(null);
      setDetailReport(null);
      setReportedDetail(null);
      await fetchReports();
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === 'AUTH_FAILED') return onAuthFail();
        setError(err.message);
      }
    } finally {
      setActingId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentDetailReason = detailReport ? formatReportReason(detailReport.reason) : '';

  const openReportDetail = (report: ReportRow) => {
    setDetailReport(report);
    setReportedDetail(null);
  };

  const loadReportedDetail = async (userId: string) => {
    setReportedDetailLoading(true);
    setError('');
    try {
      const data = await adminFetch(`/users/${userId}`);
      setReportedDetail(data);
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === 'AUTH_FAILED') return onAuthFail();
        setError(err.message);
      }
    } finally {
      setReportedDetailLoading(false);
    }
  };

  const renderValue = (value: unknown) => {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof value === 'boolean') return value ? '是' : '否';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const renderUserSummary = (user?: ReportUserSummary | null) => {
    if (!user) return <p className="text-xs text-gray-400">用户不存在或已注销</p>;
    const fields: Array<[string, unknown]> = [
      ['邮箱', user.email],
      ['昵称', user.nickname],
      ['性别', user.gender],
      ['择偶偏好', user.genderPref],
      ['意向', user.intention],
      ['年级', user.grade],
      ['校区', user.campus],
      ['院系', user.department],
      ['MBTI', user.mbti],
      ['联系方式', user.contactId ? `${user.contactPlatform || 'contact'}:${user.contactId}` : '-'],
      ['参与匹配', user.isParticipating],
      ['资料完成', user.profileComplete],
      ['问卷完成', user.surveyComplete],
    ];

    return (
      <div className="space-y-3">
        <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-1 text-xs">
          {fields.map(([label, value]) => (
            <React.Fragment key={label}>
              <dt className="text-[#8B7355]">{label}</dt>
              <dd className="break-words text-[#2C2825]">{renderValue(value)}</dd>
            </React.Fragment>
          ))}
        </dl>
        {user.bio && (
          <div>
            <div className="mb-1 text-xs text-[#8B7355]">个人简介</div>
            <div className="max-h-24 overflow-y-auto whitespace-pre-wrap rounded bg-gray-50 p-2 text-xs leading-relaxed">
              {user.bio}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderFullUserDetail = (detail: UserDetail) => {
    let surveyAnswers: Record<string, unknown> | null = null;
    if (detail.survey?.answers) {
      try {
        surveyAnswers = JSON.parse(detail.survey.answers);
      } catch {
        surveyAnswers = null;
      }
    }

    return (
      <div className="space-y-4 rounded border border-gray-200 bg-gray-50 p-3">
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#8B7355]">完整用户资料</h4>
          <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-xs">
            {Object.entries(detail.user).map(([key, value]) => (
              <React.Fragment key={key}>
                <dt className="text-[#8B7355]">{key}</dt>
                <dd className="break-words text-[#2C2825]">{renderValue(value)}</dd>
              </React.Fragment>
            ))}
          </dl>
        </div>

        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#8B7355]">
            问卷答案 {detail.survey?.version ? `(v${detail.survey.version})` : ''}
          </h4>
          {surveyAnswers ? (
            <dl className="grid max-h-72 grid-cols-[110px_1fr] gap-x-3 gap-y-1 overflow-y-auto text-xs">
              {Object.entries(surveyAnswers).map(([key, value]) => (
                <React.Fragment key={key}>
                  <dt className="text-[#8B7355]">{key}</dt>
                  <dd className="break-words text-[#2C2825]">{renderValue(value)}</dd>
                </React.Fragment>
              ))}
            </dl>
          ) : (
            <p className="text-xs text-gray-400">暂无问卷答案或解析失败</p>
          )}
        </div>

        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#8B7355]">近期匹配记录</h4>
          {detail.matches.length > 0 ? (
            <div className="max-h-52 overflow-y-auto rounded border border-gray-200 bg-white">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-100 text-left text-[#8B7355]">
                    <th className="px-2 py-1">week</th>
                    <th className="px-2 py-1">status</th>
                    <th className="px-2 py-1">score</th>
                    <th className="px-2 py-1">A</th>
                    <th className="px-2 py-1">B</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.matches.map((match, index) => (
                    <tr key={String(match.id || index)} className="border-t border-gray-100">
                      <td className="px-2 py-1">{renderValue(match.weekOf)}</td>
                      <td className="px-2 py-1">{renderValue(match.status)}</td>
                      <td className="px-2 py-1">{renderValue(match.score)}</td>
                      <td className="px-2 py-1 font-mono">{renderValue(match.userAId)}</td>
                      <td className="px-2 py-1 font-mono">{renderValue(match.userBId)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-gray-400">暂无匹配记录</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
        <div className="mb-1 flex items-center gap-2 font-medium">
          <AlertTriangle className="h-4 w-4" />
          <span>处理规则说明</span>
        </div>
        <ul className="list-inside list-disc space-y-0.5 text-xs">
          <li>「标记属实」：向举报人发送受理通知，向被举报人发送行为提醒+申诉邮箱</li>
          <li>「提醒更新资料」：向被举报人发送资料更新提醒（含更新按钮），向举报人发送处理通知</li>
          <li>「关闭举报」：向举报人发送结果通知，不通知被举报人</li>
        </ul>
        <p className="mt-1 text-xs opacity-80">当前均不会自动封禁或拉黑账号。可在「备注」中补充说明，发送在邮件中。</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-[#8B7355]">状态筛选</label>
          <select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as 'pending' | 'reviewed' | 'warn_update' | 'dismissed' | 'all');
            }}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#420047]"
          >
            <option value="pending">待处理</option>
            <option value="reviewed">已标记属实</option>
            <option value="warn_update">已发提醒</option>
            <option value="dismissed">已关闭</option>
            <option value="all">全部</option>
          </select>
        </div>
        <button
          onClick={() => {
            setPage(1);
            fetchReports();
          }}
          className="rounded-lg border border-[#420047] px-4 py-2 text-sm text-[#420047] hover:bg-[#420047] hover:text-white transition-colors"
        >
          刷新
        </button>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
      {actionMsg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {actionMsg}
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100 text-left text-xs uppercase tracking-wider text-[#8B7355]">
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">举报人</th>
                  <th className="px-3 py-2">被举报人</th>
                  <th className="px-3 py-2">原因</th>
                  <th className="px-3 py-2">说明摘要</th>
                  <th className="px-3 py-2">状态</th>
                  <th className="px-3 py-2">时间</th>
                  <th className="px-3 py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {reports.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-gray-400">
                      暂无举报记录
                    </td>
                  </tr>
                )}
                {reports.map((report, i) => (
                  <tr key={report.id} className={`border-t border-gray-100 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                    <td className="px-3 py-2 font-mono text-xs">{report.id}</td>
                    <td className="px-3 py-2 font-mono text-xs">{report.reporterId}</td>
                    <td className="px-3 py-2 font-mono text-xs">{report.reportedId}</td>
                    <td className="px-3 py-2 text-xs">{formatReportReason(report.reason)}</td>
                    <td className="px-3 py-2 text-xs text-[#2C2825]">
                      <div className="flex max-w-[320px] items-center gap-2">
                        <span className="min-w-0 flex-1 truncate" title={report.detail || '无补充说明'}>
                          {report.detail || '无补充说明'}
                        </span>
                        <button
                          type="button"
                          onClick={() => openReportDetail(report)}
                          className="inline-flex shrink-0 items-center gap-1 rounded border border-[#420047]/20 px-2 py-1 text-[11px] text-[#420047] hover:bg-[#420047]/10"
                          title="查看完整举报详情"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          详情
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span className={`inline-block rounded px-1.5 py-0.5 ${
                        report.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-700'
                          : report.status === 'reviewed'
                            ? 'bg-green-100 text-green-700'
                            : report.status === 'warn_update'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-600'
                      }`}>
                        {STATUS_LABELS[report.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{shortDate(report.createdAt)}</td>
                    <td className="px-3 py-2">
                      <button
                        disabled={report.status !== 'pending' || actingId === report.id}
                        onClick={() => openActionModal(report)}
                        className="inline-flex items-center gap-1 rounded border border-[#420047]/20 px-2 py-1 text-xs text-[#420047] hover:bg-[#420047]/10 disabled:opacity-40"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        处理
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              第 {page} 页 / 共 {totalPages} 页 (共 {total} 条)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded border border-gray-200 px-3 py-1 text-xs hover:bg-gray-100 disabled:opacity-40"
              >
                上一页
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded border border-gray-200 px-3 py-1 text-xs hover:bg-gray-100 disabled:opacity-40"
              >
                下一页
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── 处理操作 Modal ──────────────────────────────────────────────────────── */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex w-full max-w-2xl flex-col max-h-[92vh] overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="shrink-0 flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h3 className="text-base font-semibold text-[#2C2825]">处理举报</h3>
              <button
                onClick={() => setActionModal(null)}
                className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
              >
                取消
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
              {/* 举报编号 */}
              <div className="rounded bg-gray-50 px-3 py-2 text-xs text-gray-500">
                举报编号：<span className="font-mono">{actionModal.reportId}</span>
                {actionModal.reportReason && <span className="ml-3">原因：{actionModal.reportReason}</span>}
              </div>

              {/* 选择处理方式 */}
              <div>
                <div className="mb-2 text-sm font-medium text-[#2C2825]">处理方式</div>
                <div className="space-y-2">
                  {([
                    { value: 'reviewed' as const, label: '标记属实', desc: '向举报人发送受理通知，向被举报人发送行为提醒和申诉邮箱', final: true },
                    { value: 'warn_update' as const, label: '提醒更新资料', desc: '仅向被举报人发送资料更新提醒（含"立即更新"按钮），向举报人发送处理通知', final: true },
                    { value: 'request_evidence' as const, label: '要求补充材料', desc: '向举报人发送邮件，要求提交截图/记录至支持邮箱 — 举报状态保持待处理', final: false },
                    { value: 'dismissed' as const, label: '关闭举报', desc: '向举报人发送结果通知，不通知被举报人，不记入违规', final: true },
                  ]).map(({ value, label, desc, final }) => (
                    <label key={value} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                      actionModal.selectedAction === value
                        ? 'border-[#420047] bg-[#420047]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <input
                        type="radio"
                        name="action"
                        value={value}
                        checked={actionModal.selectedAction === value}
                        onChange={() => setActionModal((m) => m ? { ...m, selectedAction: value } : m)}
                        className="mt-0.5 accent-[#420047]"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[#2C2825]">{label}</span>
                          {!final && <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700">状态不变</span>}
                        </div>
                        <div className="text-xs text-gray-500">{desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {actionModal.selectedAction === 'reviewed' && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#2C2825]">
                    扣分档位（管理员选择）
                  </label>
                  <select
                    value={actionModal.penaltyScore}
                    onChange={(e) => setActionModal((m) => (m ? { ...m, penaltyScore: Number(e.target.value) as 1 | 3 | 5 } : m))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#420047]"
                  >
                    <option value={1}>L1（扣 1 分）</option>
                    <option value={3}>L2（扣 3 分）</option>
                    <option value={5}>L3（扣 5 分）</option>
                  </select>
                </div>
              )}

              {/* 管理员备注 */}
              <div>
                <label className="mb-1 block text-sm font-medium text-[#2C2825]">
                  管理员备注
                  <span className="ml-1 text-xs font-normal text-gray-400">（可选，会包含在发给被举报人的邮件中）</span>
                </label>
                <textarea
                  value={actionModal.adminNote}
                  onChange={(e) => setActionModal((m) => m ? { ...m, adminNote: e.target.value } : m)}
                  maxLength={500}
                  rows={3}
                  placeholder="例如：你填写的QQ号与实际不符，请核对后更新。"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#420047] resize-none"
                />
                <div className="mt-1 text-right text-xs text-gray-400">{actionModal.adminNote.length}/500</div>
              </div>

              {/* 邮件预览 */}
              <div>
                <div className="mb-2 flex items-center gap-3">
                  <div className="text-sm font-medium text-[#2C2825]">邮件预览</div>
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                    <button
                      onClick={() => setActionModal((m) => m ? { ...m, emailPreviewTab: 'reporter' } : m)}
                      className={`px-3 py-1 ${actionModal.emailPreviewTab === 'reporter' ? 'bg-[#420047] text-white' : 'hover:bg-gray-50'}`}
                    >
                      举报人
                    </button>
                    <button
                      onClick={() => setActionModal((m) => m ? { ...m, emailPreviewTab: 'reported' } : m)}
                      className={`px-3 py-1 border-l border-gray-200 ${actionModal.emailPreviewTab === 'reported' ? 'bg-[#420047] text-white' : 'hover:bg-gray-50'}`}
                    >
                      被举报人
                    </button>
                  </div>
                </div>
                {actionModal.emailPreviewTab === 'reporter' ? (() => {
                  const c = getReporterMailContent(actionModal.selectedAction, actionModal.reportId, actionModal.adminNote);
                  return <EmailPreviewCard {...c} />;
                })() : (() => {
                  if (actionModal.selectedAction === 'dismissed' || actionModal.selectedAction === 'request_evidence') {
                    const hint = actionModal.selectedAction === 'dismissed' ? '关闭举报不会向被举报人发送邮件' : '要求补充材料只发邮件给举报人，不通知被举报人';
                    return <div className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">{hint}</div>;
                  }
                  const c = getReportedMailContent(actionModal.selectedAction, actionModal.reportId, actionModal.reportReason, actionModal.adminNote);
                  if (!c) return null;
                  return <EmailPreviewCard {...c} />;
                })()}
              </div>
            </div>

            <div className="shrink-0 flex justify-end gap-3 border-t border-gray-100 px-5 py-4">
              <button
                onClick={() => setActionModal(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50"
              >
                取消
              </button>
              <button
                disabled={!!actingId}
                onClick={() => void submitReview()}
                className="rounded-lg bg-[#420047] px-5 py-2 text-sm font-medium text-white hover:bg-[#2d0031] disabled:opacity-50"
              >
                {actingId ? '发送中…' : actionModal?.selectedAction === 'request_evidence' ? '发送请求邮件' : '确认处理'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 邮件模板预览（可折叠）────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-gray-200">
        <button
          onClick={() => setShowEmailTemplates((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-[#2C2825] hover:bg-gray-50"
        >
          <span>邮件模板预览</span>
          <span className="text-xs text-gray-400">{showEmailTemplates ? '收起' : '展开'}</span>
        </button>
        {showEmailTemplates && (
          <div className="border-t border-gray-100 px-4 py-4 space-y-6">
            {([
              { action: 'reviewed' as const, label: '标记属实' },
              { action: 'warn_update' as const, label: '提醒更新资料' },
              { action: 'request_evidence' as const, label: '要求补充材料（状态不变）' },
              { action: 'dismissed' as const, label: '关闭举报' },
            ]).map(({ action, label }) => {
              const reporterContent = getReporterMailContent(action, 'REPORT-XXXX', '（此处显示管理员备注）');
              const reportedContent = action !== 'dismissed' && action !== 'request_evidence'
                ? getReportedMailContent(action, 'REPORT-XXXX', '虚假资料 / 骚扰辱骂', '（此处显示管理员备注）')
                : null;
              const noReportedHint = action === 'dismissed' ? '不通知被举报人' : '只发邮件给举报人，不通知被举报人';
              return (
                <div key={action}>
                  <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#8B7355]">{label}</div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="mb-1.5 text-xs text-gray-400">→ 举报人</div>
                      <EmailPreviewCard {...reporterContent} />
                    </div>
                    {reportedContent ? (
                      <div>
                        <div className="mb-1.5 text-xs text-gray-400">→ 被举报人</div>
                        <EmailPreviewCard {...reportedContent} />
                      </div>
                    ) : (
                      <div className="flex items-center justify-center rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center text-sm text-gray-400">
                        {noReportedHint}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {detailReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-2xl flex-col max-h-[90vh] overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="shrink-0 flex items-start justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-[#2C2825]">举报详情</h3>
                <p className="mt-1 text-xs text-gray-500">
                  处理后将向举报人发送结果反馈；标记属实时，也会向被举报人发送提醒与申诉通道。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailReport(null)}
                className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
              >
                关闭
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <div className="mb-1 text-xs font-medium text-[#8B7355]">举报 ID</div>
                  <div className="break-all rounded bg-gray-50 p-2 font-mono text-xs">{detailReport.id}</div>
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-[#8B7355]">提交时间</div>
                  <div className="rounded bg-gray-50 p-2 text-xs">{shortDate(detailReport.createdAt)}</div>
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-[#8B7355]">举报人 ID</div>
                  <div className="break-all rounded bg-gray-50 p-2 font-mono text-xs">{detailReport.reporterId}</div>
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-[#8B7355]">被举报人 ID</div>
                  <div className="break-all rounded bg-gray-50 p-2 font-mono text-xs">{detailReport.reportedId}</div>
                </div>
              </div>

              <div>
                <div className="mb-1 text-xs font-medium text-[#8B7355]">举报原因</div>
                <div className="rounded bg-amber-50 p-3 text-[#2C2825]">{currentDetailReason || '-'}</div>
              </div>

              <div>
                <div className="mb-1 text-xs font-medium text-[#8B7355]">完整说明</div>
                <div className="min-h-[96px] whitespace-pre-wrap break-words rounded bg-gray-50 p-3 leading-relaxed text-[#2C2825]">
                  {detailReport.detail || '用户未填写补充说明。'}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="mb-2 text-xs font-medium text-[#8B7355]">举报人资料摘要</div>
                  <div className="rounded border border-gray-200 bg-white p-3">
                    {renderUserSummary(detailReport.reporter)}
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-[#8B7355]">被举报人资料摘要</span>
                    <button
                      type="button"
                      disabled={reportedDetailLoading || !detailReport.reportedId}
                      onClick={() => void loadReportedDetail(detailReport.reportedId)}
                      className="rounded border border-[#420047]/20 px-2 py-1 text-[11px] text-[#420047] hover:bg-[#420047]/10 disabled:opacity-40"
                    >
                      {reportedDetailLoading ? '加载中...' : '加载完整资料'}
                    </button>
                  </div>
                  <div className="rounded border border-gray-200 bg-white p-3">
                    {renderUserSummary(detailReport.reported)}
                  </div>
                </div>
              </div>

              {reportedDetail && renderFullUserDetail(reportedDetail)}

              {detailReport.adminNote && (
                <div>
                  <div className="mb-1 text-xs font-medium text-[#8B7355]">管理员备注</div>
                  <div className="whitespace-pre-wrap break-words rounded border border-blue-100 bg-blue-50 p-3 text-xs leading-relaxed text-blue-900">
                    {detailReport.adminNote}
                  </div>
                </div>
              )}

              {detailReport.status === 'pending' && (
                <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-3">
                  <button
                    disabled={actingId === detailReport.id}
                    onClick={() => { setDetailReport(null); openActionModal(detailReport); }}
                    className="inline-flex items-center gap-1 rounded border border-[#420047]/20 px-3 py-2 text-sm text-[#420047] hover:bg-[#420047]/10 disabled:opacity-40"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    处理此举报
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Teamup Inspection
// ---------------------------------------------------------------------------

const TEAMUP_STATUS_LABELS: Record<AdminTeamupRow['status'] | 'expired' | 'ended', string> = {
  recruiting: '招募中',
  full: '已满员',
  expired: '已截止',
  ended: '已结束',
  cancelled: '已取消',
};

const TEAMUP_TYPE_LABELS: Record<AdminTeamupRow['teamupType'], string> = {
  short_term: '临期组队',
  long_term: '长期组队',
};

const TEAMUP_JOIN_MODE_LABELS: Record<AdminTeamupRow['joinMode'], string> = {
  direct: '直接加入',
  approval: '申请审核',
};

function getAdminTeamupEffectiveStatus(teamup: AdminTeamupRow): AdminTeamupRow['status'] | 'expired' | 'ended' {
  if (teamup.status === 'cancelled') return 'cancelled';
  const now = Date.now();
  const endAt = Date.parse(teamup.endAt);
  const deadlineAt = Date.parse(teamup.deadlineAt);
  if (Number.isFinite(endAt) && endAt <= now) return 'ended';
  if (Number.isFinite(deadlineAt) && deadlineAt <= now) return 'expired';
  return teamup.status;
}

function TeamupsTab({ onAuthFail }: { onAuthFail: () => void }) {
  const [teamupsData, setTeamupsData] = useState<AdminTeamupRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<'all' | AdminTeamupRow['status']>('all');
  const [teamupType, setTeamupType] = useState<'all' | AdminTeamupRow['teamupType']>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const limit = 20;

  const fetchTeamups = useCallback(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      status,
      teamupType,
    });

    adminFetch(`/teamups?${params.toString()}`)
      .then((data) => {
        setTeamupsData(data.teamups || []);
        setTotal(data.total ?? 0);
      })
      .catch((err) => {
        if (err.message === 'AUTH_FAILED') return onAuthFail();
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [onAuthFail, page, status, teamupType]);

  useEffect(() => { fetchTeamups(); }, [fetchTeamups]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-[#8B7355]">状态</label>
          <select
            value={status}
            onChange={(e) => { setPage(1); setStatus(e.target.value as typeof status); }}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#420047]"
          >
            <option value="all">全部</option>
            <option value="recruiting">招募中</option>
            <option value="full">已满员</option>
            <option value="cancelled">已取消</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-[#8B7355]">类型</label>
          <select
            value={teamupType}
            onChange={(e) => { setPage(1); setTeamupType(e.target.value as typeof teamupType); }}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#420047]"
          >
            <option value="all">全部</option>
            <option value="short_term">临期组队</option>
            <option value="long_term">长期组队</option>
          </select>
        </div>
        <button
          onClick={() => { setPage(1); fetchTeamups(); }}
          className="rounded bg-[#420047] px-4 py-2 text-sm text-white hover:bg-[#2d0031]"
        >
          刷新列表
        </button>
        <p className="text-xs text-[#8B7355]">
          巡查列表不展示成员联系方式或申请时填写的联系方式。
        </p>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wider text-[#8B7355]">
              <tr>
                <th className="px-4 py-3 text-left">组队</th>
                <th className="px-4 py-3 text-left">圈子 / 组长</th>
                <th className="px-4 py-3 text-left">状态</th>
                <th className="px-4 py-3 text-left">人数 / 申请</th>
                <th className="px-4 py-3 text-left">时间</th>
                <th className="px-4 py-3 text-left">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">加载中...</td></tr>
              ) : teamupsData.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">暂无组队记录</td></tr>
              ) : teamupsData.map((teamup) => {
                const effectiveStatus = getAdminTeamupEffectiveStatus(teamup);
                return (
                  <tr key={teamup.id} className="hover:bg-gray-50/70">
                    <td className="px-4 py-3 align-top">
                      <div className="max-w-xs">
                        <div className="font-medium text-[#2C2825]">{teamup.title}</div>
                        <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-500">{teamup.descriptionPreview || '-'}</div>
                        <div className="mt-1 font-mono text-[10px] text-gray-400">{teamup.id}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-xs">
                      <div className="font-medium text-[#2C2825]">{teamup.circleName || teamup.circleId}</div>
                      <div className="mt-1 text-gray-500">组长：{teamup.leaderNickname || teamup.leaderId}</div>
                    </td>
                    <td className="px-4 py-3 align-top text-xs">
                      <div className="inline-flex rounded-full bg-[#420047]/10 px-2 py-1 text-[#420047]">
                        {TEAMUP_STATUS_LABELS[effectiveStatus]}
                      </div>
                      <div className="mt-2 text-gray-500">{TEAMUP_TYPE_LABELS[teamup.teamupType]} · {TEAMUP_JOIN_MODE_LABELS[teamup.joinMode]}</div>
                      {teamup.cancelReason && <div className="mt-1 max-w-[180px] text-red-700">取消原因：{teamup.cancelReason}</div>}
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-gray-600">
                      <div>{teamup.activeMemberCount} / {teamup.maxMembers} 人</div>
                      <div className="mt-1">申请 {teamup.applicationCount}，待审 {teamup.pendingApplicationCount}</div>
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-gray-600">
                      <div>截止：{shortDate(teamup.deadlineAt)}</div>
                      <div className="mt-1">结束：{shortDate(teamup.endAt)}</div>
                      <div className="mt-1 text-gray-400">创建：{shortDate(teamup.createdAt)}</div>
                    </td>
                    <td className="px-4 py-3 align-top text-xs">
                      <a
                        href={`/circles/${teamup.circleId}/teamups/${teamup.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#420047] hover:underline"
                      >
                        查看前台页
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">第 {page} 页 / 共 {totalPages} 页 (共 {total} 条)</span>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded border border-gray-200 px-3 py-1 disabled:opacity-40"
          >
            上一页
          </button>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages}
            className="rounded border border-gray-200 px-3 py-1 disabled:opacity-40"
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Forum Reports
// ---------------------------------------------------------------------------

function ForumReportsTab({ onAuthFail }: { onAuthFail: () => void }) {
  const [reports, setReports] = useState<ForumReportRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState<Record<string, string>>({});
  const [penaltyScore, setPenaltyScore] = useState<Record<string, 1 | 3 | 5>>({});
  const [detailReport, setDetailReport] = useState<ForumReportRow | null>(null);
  const limit = 20;

  const fetchReports = useCallback(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ page: String(page), limit: String(limit), status });
    adminFetch(`/forum/reports?${params.toString()}`)
      .then((data) => {
        setReports(data.reports || []);
        setTotal(data.total ?? 0);
      })
      .catch((err) => {
        if (err.message === 'AUTH_FAILED') return onAuthFail();
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [onAuthFail, page, status]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleReview = async (reportId: string, action: 'approve' | 'reject') => {
    if (actingId) return;
    setActingId(reportId);
    setError('');
    setActionMsg('');
    try {
      const result = await adminFetch(`/forum/reports/${reportId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          action,
          adminNote: adminNote[reportId]?.trim() || undefined,
          penaltyScore: penaltyScore[reportId] ?? 1,
        }),
      });
      const creditText = result.creditChanged
        ? `信用分已变更，当前分数：${result.creditScoreAfter ?? '-'}`
        : '信用分未变更';
      setActionMsg(`${result.message || '举报状态已更新'}（${creditText}）`);
      fetchReports();
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === 'AUTH_FAILED') return onAuthFail();
        setError(err.message);
      }
    } finally {
      setActingId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const toReasonText = (reason: string) =>
    reason
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => REPORT_REASON_LABEL[item as ReportReasonValue] || item)
      .join('、');

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
        规则：论坛举报只有管理员可审理；审核通过时由管理员选择 L1/L2/L3（扣 1/3/5 分），并写入信用分日志。
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-[#8B7355]">状态筛选</label>
          <select
            value={status}
            onChange={(e) => { setPage(1); setStatus(e.target.value as 'pending' | 'approved' | 'rejected' | 'all'); }}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#420047]"
          >
            <option value="pending">待处理</option>
            <option value="approved">已通过</option>
            <option value="rejected">已驳回</option>
            <option value="all">全部</option>
          </select>
        </div>
        <button
          onClick={() => { setPage(1); fetchReports(); }}
          className="rounded-lg border border-[#420047] px-4 py-2 text-sm text-[#420047] hover:bg-[#420047] hover:text-white transition-colors"
        >
          刷新
        </button>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
      {actionMsg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {actionMsg}
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100 text-left text-xs uppercase tracking-wider text-[#8B7355]">
                  <th className="px-3 py-2">举报ID</th>
                  <th className="px-3 py-2">举报人</th>
                  <th className="px-3 py-2">目标</th>
                  <th className="px-3 py-2">原因</th>
                  <th className="px-3 py-2">说明摘要</th>
                  <th className="px-3 py-2">状态</th>
                  <th className="px-3 py-2">扣分档位</th>
                  <th className="px-3 py-2">备注</th>
                  <th className="px-3 py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {reports.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-gray-400">暂无论坛举报</td>
                  </tr>
                )}
                {reports.map((report, i) => (
                  <tr key={report.id} className={`border-t border-gray-100 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                    <td className="px-3 py-2 font-mono text-xs">{report.id}</td>
                    <td className="px-3 py-2 text-xs">{report.reporterNickname || report.reporterId}</td>
                    <td className="px-3 py-2 text-xs">
                      {report.targetType === 'post' ? '帖子' : report.targetType === 'comment' ? '评论' : '用户'}:
                      <span className="ml-1 font-mono">{(report.postId || report.commentId || report.reportedUserId || '').slice(0, 8)}...</span>
                    </td>
                    <td className="px-3 py-2 text-xs">{toReasonText(report.reason)}</td>
                    <td className="px-3 py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 max-w-[220px] truncate" title={report.detail || '无说明'}>
                          {report.detail || '无说明'}
                        </span>
                        <button
                          onClick={() => setDetailReport(report)}
                          className="shrink-0 rounded border border-[#E0D7CC] px-2 py-0.5 text-[11px] text-[#8B7355] hover:border-[#420047]/30 hover:text-[#420047]"
                        >
                          详情
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {report.status === 'pending' ? '待处理' : report.status === 'approved' ? '已通过' : '已驳回'}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={penaltyScore[report.id] ?? 1}
                        onChange={(e) => setPenaltyScore((prev) => ({ ...prev, [report.id]: Number(e.target.value) as 1 | 3 | 5 }))}
                        disabled={report.status !== 'pending'}
                        className="rounded border border-gray-200 px-2 py-1 text-xs disabled:bg-gray-100"
                      >
                        <option value={1}>L1 / -1</option>
                        <option value={3}>L2 / -3</option>
                        <option value={5}>L3 / -5</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={adminNote[report.id] ?? report.adminNote ?? ''}
                        onChange={(e) => setAdminNote((prev) => ({ ...prev, [report.id]: e.target.value }))}
                        disabled={report.status !== 'pending'}
                        placeholder="可选备注"
                        className="w-44 rounded border border-gray-200 px-2 py-1 text-xs disabled:bg-gray-100"
                      />
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <div className="flex gap-2">
                        <button
                          disabled={report.status !== 'pending' || actingId === report.id}
                          onClick={() => handleReview(report.id, 'approve')}
                          className="rounded border border-green-300 px-2 py-1 text-green-700 disabled:opacity-40"
                        >
                          通过
                        </button>
                        <button
                          disabled={report.status !== 'pending' || actingId === report.id}
                          onClick={() => handleReview(report.id, 'reject')}
                          className="rounded border border-gray-300 px-2 py-1 text-gray-700 disabled:opacity-40"
                        >
                          驳回
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">第 {page} 页 / 共 {totalPages} 页 (共 {total} 条)</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded border border-gray-200 px-3 py-1 disabled:opacity-40"
              >
                上一页
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                className="rounded border border-gray-200 px-3 py-1 disabled:opacity-40"
              >
                下一页
              </button>
            </div>
          </div>
        </>
      )}

      {detailReport && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/35 px-4" onClick={() => setDetailReport(null)}>
          <div
            className="w-full max-w-2xl rounded-2xl border border-[#EAE7E1] bg-[#FCFBF8] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#2C2825]">举报详情</h3>
              <button
                onClick={() => setDetailReport(null)}
                className="rounded border border-[#EAE7E1] px-2 py-1 text-xs text-[#8B7355] hover:text-[#2C2825]"
              >
                关闭
              </button>
            </div>
            <p className="mb-4 text-xs text-[#8B7355]">
              处理后将向举报人发送结果反馈；标记属实时，也会向被举报人发送提醒与申诉通道。
            </p>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="mb-1 text-xs font-medium text-[#8B7355]">举报 ID</div>
                <div className="break-all rounded bg-gray-50 p-2 font-mono text-xs text-[#2C2825]">{detailReport.id}</div>
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-[#8B7355]">提交时间</div>
                <div className="rounded bg-gray-50 p-2 text-xs text-[#2C2825]">{new Date(detailReport.createdAt).toLocaleString('zh-CN')}</div>
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-[#8B7355]">举报人 ID</div>
                <div className="break-all rounded bg-gray-50 p-2 font-mono text-xs text-[#2C2825]">{detailReport.reporterId}</div>
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-[#8B7355]">被举报人 ID</div>
                <div className="break-all rounded bg-gray-50 p-2 font-mono text-xs text-[#2C2825]">{detailReport.reportedUserId}</div>
              </div>
            </div>

            <div className="mt-3">
              <div className="mb-1 text-xs font-medium text-[#8B7355]">举报原因</div>
              <div className="rounded bg-amber-50 p-3 text-[#2C2825]">{toReasonText(detailReport.reason) || '-'}</div>
            </div>

            <div className="mt-3">
              <div className="mb-1 text-xs font-medium text-[#8B7355]">完整说明</div>
              <div className="min-h-[96px] whitespace-pre-wrap break-words rounded bg-gray-50 p-3 text-sm text-[#2C2825]">
                {detailReport.detail || '用户未填写补充说明。'}
              </div>
            </div>

            <div className="mt-3">
              <div className="mb-1 text-xs font-medium text-[#8B7355]">被举报内容</div>
              <div className="min-h-[72px] whitespace-pre-wrap break-words rounded bg-gray-50 p-3 text-sm text-[#2C2825]">
                {detailReport.targetContent || '目标内容不可用（可能已删除或不可访问）'}
              </div>
            </div>

            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div>
                <div className="mb-2 text-xs font-medium text-[#8B7355]">举报人资料摘要</div>
                <div className="rounded border border-gray-200 bg-white p-3 text-sm text-[#2C2825]">
                  <div className="grid grid-cols-[72px_1fr] gap-y-1">
                    <span className="text-[#8B7355]">昵称</span>
                    <span>{detailReport.reporterNickname || '未公开'}</span>
                    <span className="text-[#8B7355]">用户ID</span>
                    <span className="break-all font-mono text-xs">{detailReport.reporterId}</span>
                  </div>
                </div>
              </div>
              <div>
                <div className="mb-2 text-xs font-medium text-[#8B7355]">被举报人资料摘要</div>
                <div className="rounded border border-gray-200 bg-white p-3 text-sm text-[#2C2825]">
                  <div className="grid grid-cols-[72px_1fr] gap-y-1">
                    <span className="text-[#8B7355]">昵称</span>
                    <span>{detailReport.reportedNickname || '未公开'}</span>
                    <span className="text-[#8B7355]">用户ID</span>
                    <span className="break-all font-mono text-xs">{detailReport.reportedUserId}</span>
                  </div>
                </div>
              </div>
            </div>

            {detailReport.adminNote && (
              <div className="mt-3">
                <div className="mb-1 text-xs font-medium text-[#8B7355]">管理员备注</div>
                <div className="whitespace-pre-wrap break-words rounded border border-blue-100 bg-blue-50 p-3 text-xs leading-relaxed text-blue-900">
                  {detailReport.adminNote}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ForumCreditTab({ onAuthFail }: { onAuthFail: () => void }) {
  const [rows, setRows] = useState<ForumCreditUserRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedUser, setSelectedUser] = useState<ForumCreditUserRow | null>(null);
  const [history, setHistory] = useState<ForumReportRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const limit = 20;

  const fetchRows = useCallback(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    adminFetch(`/forum/credit-users?${params.toString()}`)
      .then((data) => {
        setRows(data.users || []);
        setTotal(data.total ?? 0);
      })
      .catch((err) => {
        if (err.message === 'AUTH_FAILED') return onAuthFail();
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [onAuthFail, page]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const fetchHistory = async (user: ForumCreditUserRow) => {
    setSelectedUser(user);
    setHistoryLoading(true);
    setHistory([]);
    try {
      const data = await adminFetch(`/forum/credit-users/${encodeURIComponent(user.userId)}/reports`);
      setHistory(data.reports || []);
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === 'AUTH_FAILED') return onAuthFail();
        setError(err.message);
      }
    } finally {
      setHistoryLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const toReasonText = (reason: string) =>
    reason
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => REPORT_REASON_LABEL[item as ReportReasonValue] || item)
      .join('、');

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
        排序规则：按“最近一次举报审核通过时间”从近到旧；点某用户可查看该用户被举报历史（未通过在前，通过在后；各分组内按时间从新到旧）。
      </div>
      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

      {loading ? (
        <Spinner />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100 text-left text-xs uppercase tracking-wider text-[#8B7355]">
                <th className="px-3 py-2">用户</th>
                <th className="px-3 py-2">信用分</th>
                <th className="px-3 py-2">等级</th>
                <th className="px-3 py-2">通过次数</th>
                <th className="px-3 py-2">总被举报数</th>
                <th className="px-3 py-2">最近通过时间</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-gray-400">暂无用户数据</td>
                </tr>
              )}
              {rows.map((row, i) => (
                <tr
                  key={row.userId}
                  className={`cursor-pointer border-t border-gray-100 ${i % 2 === 1 ? 'bg-gray-50/50' : ''} ${selectedUser?.userId === row.userId ? 'bg-[#420047]/[0.04]' : ''}`}
                  onClick={() => void fetchHistory(row)}
                >
                  <td className="px-3 py-2 text-xs">
                    <div className="font-medium text-[#2C2825]">{row.nickname || '(未设置昵称)'}</div>
                    <div className="text-gray-500">{row.userId}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">{row.creditScore}</td>
                  <td className="px-3 py-2 text-xs">{row.creditLevel}</td>
                  <td className="px-3 py-2 text-xs">{row.approvedReportCount}</td>
                  <td className="px-3 py-2 text-xs">{row.totalReportCount}</td>
                  <td className="px-3 py-2 text-xs">{row.latestApprovedAt ? new Date(row.latestApprovedAt).toLocaleString('zh-CN') : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">第 {page} 页 / 共 {totalPages} 页 (共 {total} 条)</span>
        <div className="flex gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded border border-gray-200 px-3 py-1 disabled:opacity-40">上一页</button>
          <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages} className="rounded border border-gray-200 px-3 py-1 disabled:opacity-40">下一页</button>
        </div>
      </div>

      {selectedUser && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3 text-sm font-medium text-[#2C2825]">
            {selectedUser.nickname || selectedUser.userId} 的被举报历史
          </div>
          {historyLoading ? (
            <Spinner />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs text-[#8B7355]">
                    <th className="px-3 py-2">举报ID</th>
                    <th className="px-3 py-2">举报人</th>
                    <th className="px-3 py-2">目标</th>
                    <th className="px-3 py-2">原因</th>
                    <th className="px-3 py-2">状态</th>
                    <th className="px-3 py-2">时间</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-5 text-center text-gray-400">暂无历史举报</td></tr>
                  )}
                  {history.map((item) => (
                    <tr key={item.id} className="border-t border-gray-100">
                      <td className="px-3 py-2 text-xs font-mono">{item.id}</td>
                      <td className="px-3 py-2 text-xs">{item.reporterNickname || item.reporterId}</td>
                      <td className="px-3 py-2 text-xs">{item.targetType === 'post' ? '帖子' : item.targetType === 'comment' ? '评论' : '用户'}</td>
                      <td className="px-3 py-2 text-xs">{toReasonText(item.reason)}</td>
                      <td className="px-3 py-2 text-xs">{item.status === 'approved' ? '已通过' : item.status === 'rejected' ? '未通过' : '待处理'}</td>
                      <td className="px-3 py-2 text-xs">{item.createdAt ? new Date(item.createdAt).toLocaleString('zh-CN') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Forum Moderation
// ---------------------------------------------------------------------------

interface ForumPostRow {
  postId: string;
  title: string;
  type: string;
  circleId: string | null;
  visibility: 'public' | 'private';
  author: { userId: string; nickname: string | null };
  isPinned: boolean;
  viewCount: number;
  deletedAt: string | null;
  createdAt: string;
}

const FORUM_TYPE_LABELS: Record<string, string> = {
  general: '交流',
  squad: '组队',
  help: '互助',
  trade: '二手',
  activity: '活动',
};

function ForumModerationTab({ onAuthFail }: { onAuthFail: () => void }) {
  const [posts, setPosts] = useState<ForumPostRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<'active' | 'deleted' | 'all'>('active');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);
  const limit = 20;

  // Announcements state
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [annPage, setAnnPage] = useState(1);
  const [annTotal, setAnnTotal] = useState(0);
  const [annLoading, setAnnLoading] = useState(false);
  const [annErr, setAnnErr] = useState('');
  const [showAnnForm, setShowAnnForm] = useState(false);
  const [annForm, setAnnForm] = useState({ title: '', content: '', isActive: true, priority: 0 });
  const [editingAnnId, setEditingAnnId] = useState<string | null>(null);
  const annLimit = 10;

  // Guestbook messages state
  const [guestbookMessages, setGuestbookMessages] = useState<any[]>([]);
  const [gbPage, setGbPage] = useState(1);
  const [gbTotal, setGbTotal] = useState(0);
  const [gbLoading, setGbLoading] = useState(false);
  const [gbErr, setGbErr] = useState('');
  const [gbStatus, setGbStatus] = useState<'visible' | 'hidden' | 'all'>('visible');
  const gbLimit = 10;

  const fetchAnnouncements = useCallback(() => {
    setAnnLoading(true);
    setAnnErr('');
    adminFetch(`/forum/announcements?page=${annPage}&limit=${annLimit}`)
      .then((data) => {
        setAnnouncements(data.announcements || []);
        setAnnTotal(data.total ?? 0);
      })
      .catch((err) => {
        if (err.message === 'AUTH_FAILED') return onAuthFail();
        setAnnErr(err.message);
      })
      .finally(() => setAnnLoading(false));
  }, [onAuthFail, annPage]);

  useEffect(() => { fetchAnnouncements(); }, [fetchAnnouncements]);

  const handleAnnSubmit = async () => {
    if (!annForm.title.trim() || !annForm.content.trim()) return;
    try {
      if (editingAnnId) {
        await adminFetch(`/forum/announcements/${editingAnnId}`, {
          method: 'PATCH',
          body: JSON.stringify(annForm),
        });
        window.alert('公告已更新');
      } else {
        await adminFetch('/forum/announcements', {
          method: 'POST',
          body: JSON.stringify(annForm),
        });
        window.alert('公告已发布');
      }
      setShowAnnForm(false);
      setEditingAnnId(null);
      setAnnForm({ title: '', content: '', isActive: true, priority: 0 });
      fetchAnnouncements();
    } catch (err: any) {
      if (err.message === 'AUTH_FAILED') onAuthFail();
      else alert(err.message || '操作失败');
    }
  };

  const handleAnnDelete = async (id: string) => {
    if (!window.confirm('确认删除该公告？')) return;
    try {
      await adminFetch(`/forum/announcements/${id}`, { method: 'DELETE' });
      window.alert('公告已删除');
      fetchAnnouncements();
    } catch (err: any) {
      if (err.message === 'AUTH_FAILED') onAuthFail();
      else alert(err.message || '删除失败');
    }
  };

  const handleAnnEdit = (a: any) => {
    setEditingAnnId(a.id);
    setAnnForm({ title: a.title, content: a.content, isActive: a.isActive, priority: a.priority ?? 0 });
    setShowAnnForm(true);
  };

  // Guestbook messages
  const fetchGuestbookMessages = useCallback(() => {
    setGbLoading(true);
    setGbErr('');
    const params = new URLSearchParams({ page: String(gbPage), limit: String(gbLimit) });
    if (gbStatus !== 'all') params.set('status', gbStatus);
    adminFetch(`/forum/guestbook/messages?${params.toString()}`)
      .then((data) => {
        setGuestbookMessages(data.messages || []);
        setGbTotal(data.total ?? 0);
      })
      .catch((err) => {
        if (err.message === 'AUTH_FAILED') return onAuthFail();
        setGbErr(err.message);
      })
      .finally(() => setGbLoading(false));
  }, [onAuthFail, gbPage, gbStatus]);

  useEffect(() => { fetchGuestbookMessages(); }, [fetchGuestbookMessages]);

  const handleHideGbMessage = async (messageId: string) => {
    if (!window.confirm('确认隐藏该留言？')) return;
    try {
      await adminFetch(`/forum/guestbook/messages/${messageId}`, { method: 'DELETE' });
      fetchGuestbookMessages();
    } catch (err: any) {
      if (err.message === 'AUTH_FAILED') onAuthFail();
      else alert(err.message || '操作失败');
    }
  };

  const fetchPosts = useCallback(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ page: String(page), limit: String(limit), status });
    if (typeFilter) params.set('type', typeFilter);
    adminFetch(`/forum/posts?${params.toString()}`)
      .then((data) => {
        setPosts(data.posts || []);
        setTotal(data.total ?? 0);
      })
      .catch((err) => {
        if (err.message === 'AUTH_FAILED') return onAuthFail();
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [onAuthFail, page, status, typeFilter]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const handleDelete = async (postId: string) => {
    if (actingId || !window.confirm('确认强制下线该帖子？')) return;
    setActingId(postId);
    try {
      await adminFetch(`/forum/posts/${postId}`, { method: 'DELETE' });
      fetchPosts();
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === 'AUTH_FAILED') return onAuthFail();
        setError(err.message);
      }
    } finally {
      setActingId(null);
    }
  };

  const handleTogglePin = async (postId: string, isPinned: boolean) => {
    if (actingId) return;
    setActingId(postId);
    try {
      await adminFetch(`/forum/posts/${postId}/pin`, {
        method: 'PUT',
        body: JSON.stringify({ isPinned }),
      });
      fetchPosts();
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === 'AUTH_FAILED') return onAuthFail();
        setError(err.message);
      }
    } finally {
      setActingId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-[#8B7355]">状态筛选</label>
          <select
            value={status}
            onChange={(e) => { setPage(1); setStatus(e.target.value as 'active' | 'deleted' | 'all'); }}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#420047]"
          >
            <option value="active">正常</option>
            <option value="deleted">已删除</option>
            <option value="all">全部</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-[#8B7355]">帖子类型</label>
          <select
            value={typeFilter}
            onChange={(e) => { setPage(1); setTypeFilter(e.target.value); }}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#420047]"
          >
            <option value="">全部</option>
            {Object.entries(FORUM_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => { setPage(1); fetchPosts(); }}
          className="rounded-lg border border-[#420047] px-4 py-2 text-sm text-[#420047] hover:bg-[#420047] hover:text-white transition-colors"
        >
          刷新
        </button>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

      {loading ? (
        <Spinner />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100 text-left text-xs uppercase tracking-wider text-[#8B7355]">
                  <th className="px-3 py-2">帖子ID</th>
                  <th className="px-3 py-2">标题</th>
                  <th className="px-3 py-2">类型</th>
                  <th className="px-3 py-2">作者</th>
                  <th className="px-3 py-2">圈子</th>
                  <th className="px-3 py-2">状态</th>
                  <th className="px-3 py-2">置顶</th>
                  <th className="px-3 py-2">浏览</th>
                  <th className="px-3 py-2">时间</th>
                  <th className="px-3 py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {posts.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-3 py-6 text-center text-gray-400">
                      暂无帖子
                    </td>
                  </tr>
                )}
                {posts.map((post, i) => (
                  <tr key={post.postId} className={`border-t border-gray-100 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                    <td className="px-3 py-2 font-mono text-xs max-w-[120px] truncate" title={post.postId}>
                      {post.postId.slice(0, 8)}...
                    </td>
                    <td className="px-3 py-2 text-xs text-[#2C2825] max-w-[160px] truncate" title={post.title}>
                      {post.title}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span className="inline-block rounded px-1.5 py-0.5 bg-[#EAE7E1] text-[#5E5855]">
                        {FORUM_TYPE_LABELS[post.type] || post.type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">{post.author.nickname || '-'}</td>
                    <td className="px-3 py-2 text-xs text-[#8B7355]">
                      {post.circleId ? '圈子帖' : '全站'}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span className={`inline-block rounded px-1.5 py-0.5 ${
                        post.deletedAt
                          ? 'bg-red-50 text-red-600'
                          : 'bg-green-50 text-green-600'
                      }`}>
                        {post.deletedAt ? '已删除' : '正常'}
                      </span>
                      {post.visibility === 'private' && (
                        <span className="ml-1 inline-block rounded px-1.5 py-0.5 bg-slate-100 text-slate-600">
                          私密
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {post.isPinned ? (
                        <span className="inline-block rounded px-1.5 py-0.5 bg-[#420047]/10 text-[#420047]">是</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{post.viewCount}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{shortDate(post.createdAt)}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1.5">
                        {(() => {
                          const lockAction = !!post.deletedAt || post.visibility === 'private';
                          return (
                            <>
                        <button
                          disabled={actingId === post.postId || lockAction}
                          onClick={() => void handleTogglePin(post.postId, !post.isPinned)}
                          className="rounded border border-[#420047]/30 px-2 py-0.5 text-xs text-[#420047] hover:bg-[#420047]/10 disabled:opacity-40"
                        >
                          {post.isPinned ? '取消置顶' : '置顶'}
                        </button>
                        <button
                          disabled={actingId === post.postId || lockAction}
                          onClick={() => void handleDelete(post.postId)}
                          className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
                        >
                          下线
                        </button>
                            </>
                          );
                        })()}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              第 {page} 页 / 共 {totalPages} 页 (共 {total} 条)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded border border-gray-200 px-3 py-1 text-xs hover:bg-gray-100 disabled:opacity-40"
              >
                上一页
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded border border-gray-200 px-3 py-1 text-xs hover:bg-gray-100 disabled:opacity-40"
              >
                下一页
              </button>
            </div>
          </div>
        </>
      )}

      {/* ─── Announcements Management ────────────────────────── */}
      <div className="mt-10 border-t border-gray-200 pt-8">
        {annErr && <ErrorBanner message={annErr} onDismiss={() => setAnnErr('')} />}

        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-serif text-[#2C2825]">公告管理</h3>
          <button
            onClick={() => {
              setShowAnnForm(true);
              setEditingAnnId(null);
              setAnnForm({ title: '', content: '', isActive: true, priority: 0 });
            }}
            className="rounded-lg bg-[#420047] px-4 py-2 text-sm text-[#FCFBF8] hover:bg-[#2A002D] transition-colors"
          >
            + 新建公告
          </button>
        </div>

        {/* Announcement form drawer */}
        {showAnnForm && (
          <div className="mb-6 rounded-xl border border-[#420047]/20 bg-[#FCFBF8] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-serif text-[#2C2825]">
                {editingAnnId ? '编辑公告' : '新建公告'}
              </h4>
              <button
                onClick={() => { setShowAnnForm(false); setEditingAnnId(null); }}
                className="text-[#8B7355] hover:text-[#2C2825] text-sm"
              >
                ✕
              </button>
            </div>
            <div>
              <label className="block text-xs text-[#8B7355] mb-1">标题</label>
              <input
                value={annForm.title}
                onChange={(e) => setAnnForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="公告标题"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#420047]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#8B7355] mb-1">内容</label>
              <textarea
                value={annForm.content}
                onChange={(e) => setAnnForm((f) => ({ ...f, content: e.target.value }))}
                placeholder="公告内容"
                rows={3}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#420047] resize-none"
              />
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={annForm.isActive}
                  onChange={(e) => setAnnForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
                启用
              </label>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-xs text-[#8B7355]">优先级</span>
                <input
                  type="number"
                  value={annForm.priority}
                  onChange={(e) => setAnnForm((f) => ({ ...f, priority: Number(e.target.value) }))}
                  className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-sm outline-none focus:border-[#420047]"
                />
              </label>
            </div>
            <button
              onClick={handleAnnSubmit}
              disabled={!annForm.title.trim() || !annForm.content.trim()}
              className="rounded-lg bg-[#420047] px-5 py-2 text-sm text-[#FCFBF8] hover:bg-[#2A002D] disabled:opacity-40 transition-colors"
            >
              {editingAnnId ? '保存修改' : '发布公告'}
            </button>
          </div>
        )}

        {/* Announcements table */}
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="min-w-full text-left">
            <thead>
              <tr className="bg-[#EAE7E1]/50">
                <th className="px-3 py-2 text-xs text-[#5E5855]">标题</th>
                <th className="px-3 py-2 text-xs text-[#5E5855]">状态</th>
                <th className="px-3 py-2 text-xs text-[#5E5855]">优先级</th>
                <th className="px-3 py-2 text-xs text-[#5E5855]">创建时间</th>
                <th className="px-3 py-2 text-xs text-[#5E5855]">操作</th>
              </tr>
            </thead>
            <tbody>
              {annLoading ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-xs text-[#8B7355]">加载中...</td></tr>
              ) : announcements.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-xs text-[#8B7355]">暂无公告</td></tr>
              ) : (
                announcements.map((a, i) => (
                  <tr key={a.id} className={`border-t border-gray-100 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                    <td className="px-3 py-2 text-xs max-w-[200px] truncate" title={a.title}>{a.title}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded px-1.5 py-0.5 text-xs ${
                        a.isActive ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {a.isActive ? '启用' : '停用'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">{a.priority ?? 0}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{new Date(a.createdAt).toLocaleDateString('zh-CN')}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleAnnEdit(a)}
                          className="rounded border border-[#420047]/30 px-2 py-0.5 text-xs text-[#420047] hover:bg-[#420047]/10"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => handleAnnDelete(a.id)}
                          className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Ann pagination */}
        {annTotal > annLimit && (
          <div className="flex items-center justify-between mt-3 text-sm">
            <span className="text-gray-500 text-xs">
              共 {annTotal} 条
            </span>
            <div className="flex gap-2">
              <button
                disabled={annPage <= 1}
                onClick={() => setAnnPage((p) => p - 1)}
                className="rounded border border-gray-200 px-3 py-1 text-xs hover:bg-gray-100 disabled:opacity-40"
              >
                上一页
              </button>
              <button
                disabled={annPage >= Math.ceil(annTotal / annLimit)}
                onClick={() => setAnnPage((p) => p + 1)}
                className="rounded border border-gray-200 px-3 py-1 text-xs hover:bg-gray-100 disabled:opacity-40"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Guestbook Messages Management ────────────────────────── */}
      <div className="mt-10 border-t border-gray-200 pt-8">
        {gbErr && <ErrorBanner message={gbErr} onDismiss={() => setGbErr('')} />}

        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-serif text-[#2C2825]">留言管理</h3>
          <select
            value={gbStatus}
            onChange={(e) => { setGbPage(1); setGbStatus(e.target.value as 'visible' | 'hidden' | 'all'); }}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-[#420047]"
          >
            <option value="visible">可见</option>
            <option value="hidden">已隐藏</option>
            <option value="all">全部</option>
          </select>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="min-w-full text-left">
            <thead>
              <tr className="bg-[#EAE7E1]/50">
                <th className="px-3 py-2 text-xs text-[#5E5855]">内容</th>
                <th className="px-3 py-2 text-xs text-[#5E5855]">留言者</th>
                <th className="px-3 py-2 text-xs text-[#5E5855]">状态</th>
                <th className="px-3 py-2 text-xs text-[#5E5855]">时间</th>
                <th className="px-3 py-2 text-xs text-[#5E5855]">操作</th>
              </tr>
            </thead>
            <tbody>
              {gbLoading ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-xs text-[#8B7355]">加载中...</td></tr>
              ) : guestbookMessages.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-xs text-[#8B7355]">暂无留言</td></tr>
              ) : (
                guestbookMessages.map((msg, i) => (
                  <tr key={msg.id} className={`border-t border-gray-100 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                    <td className="px-3 py-2 text-xs max-w-[280px] truncate" title={msg.content}>{msg.content}</td>
                    <td className="px-3 py-2 text-xs">{msg.author?.nickname ?? msg.authorUserId?.slice(0, 8) ?? '-'}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded px-1.5 py-0.5 text-xs ${
                        msg.status === 'hidden'
                          ? 'bg-red-50 text-red-600'
                          : 'bg-green-50 text-green-600'
                      }`}>
                        {msg.status === 'hidden' ? '已隐藏' : '可见'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{new Date(msg.createdAt).toLocaleDateString('zh-CN')}</td>
                    <td className="px-3 py-2">
                      {msg.status !== 'hidden' && (
                        <button
                          onClick={() => handleHideGbMessage(msg.id)}
                          className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
                        >
                          隐藏
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {gbTotal > gbLimit && (
          <div className="flex items-center justify-between mt-3 text-sm">
            <span className="text-gray-500 text-xs">共 {gbTotal} 条</span>
            <div className="flex gap-2">
              <button
                disabled={gbPage <= 1}
                onClick={() => setGbPage((p) => p - 1)}
                className="rounded border border-gray-200 px-3 py-1 text-xs hover:bg-gray-100 disabled:opacity-40"
              >
                上一页
              </button>
              <button
                disabled={gbPage >= Math.ceil(gbTotal / gbLimit)}
                onClick={() => setGbPage((p) => p + 1)}
                className="rounded border border-gray-200 px-3 py-1 text-xs hover:bg-gray-100 disabled:opacity-40"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Audit Logs
// ---------------------------------------------------------------------------

interface AuditLogRow {
  id: number;
  operatorId: string | null;
  action: string;
  target: string | null;
  detail: string | null;
  ip: string | null;
  result: string;
  createdAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  trigger_matching: '触发匹配',
  unlock_reveal: '解锁揭晓',
  bulk_survey_reminder: '批量问卷提醒',
  bulk_match_revealed_notify: '批量揭晓通知',
  review_report: '审核举报',
  admin_delete_forum_post: '管理员删帖',
  admin_toggle_forum_pin: '置顶切换',
};

function formatActionLabel(action: string): string {
  return ACTION_LABELS[action] || action;
}

function AuditLogsTab({ onAuthFail }: { onAuthFail: () => void }) {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const limit = 20;

  const fetchLogs = useCallback(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (actionFilter) params.set('action', actionFilter);
    adminFetch(`/audit-logs?${params.toString()}`)
      .then((data) => {
        setLogs(data.logs || []);
        setTotal(data.total ?? 0);
        setActions(data.actions || []);
      })
      .catch((err) => {
        if (err.message === 'AUTH_FAILED') return onAuthFail();
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [onAuthFail, page, actionFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  let detailParsed: Record<string, unknown> | null = null;
  const parseDetail = (raw: string | null): Record<string, unknown> | null => {
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-[#8B7355]">操作类型</label>
          <select
            value={actionFilter}
            onChange={(e) => { setPage(1); setActionFilter(e.target.value); }}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#420047]"
          >
            <option value="">全部</option>
            {actions.map((a) => (
              <option key={a} value={a}>{formatActionLabel(a)}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => { setPage(1); fetchLogs(); }}
          className="rounded-lg border border-[#420047] px-4 py-2 text-sm text-[#420047] hover:bg-[#420047] hover:text-white transition-colors"
        >
          刷新
        </button>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

      {loading ? (
        <Spinner />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100 text-left text-xs uppercase tracking-wider text-[#8B7355]">
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">操作</th>
                  <th className="px-3 py-2">结果</th>
                  <th className="px-3 py-2">详情</th>
                  <th className="px-3 py-2">时间</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                      暂无审计记录
                    </td>
                  </tr>
                )}
                {logs.map((log, i) => {
                  detailParsed = parseDetail(log.detail);
                  return (
                    <tr key={log.id} className={`border-t border-gray-100 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                      <td className="px-3 py-2 font-mono text-xs text-gray-500">{log.id}</td>
                      <td className="px-3 py-2 text-xs font-medium">{formatActionLabel(log.action)}</td>
                      <td className="px-3 py-2 text-xs">
                        <span className={`inline-block rounded px-1.5 py-0.5 ${
                          log.result === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                        }`}>
                          {log.result === 'success' ? '成功' : '失败'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-[#2C2825] max-w-[300px]">
                        {detailParsed ? (
                          <button
                            onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                            className="text-left hover:text-[#420047] transition-colors"
                          >
                            {expandedId === log.id ? (
                              <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(detailParsed, null, 2)}</pre>
                            ) : (
                              <span className="text-[#8B7355]">
                                {Object.keys(detailParsed).join(', ')}
                              </span>
                            )}
                          </button>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">{shortDate(log.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              第 {page} 页 / 共 {totalPages} 页 (共 {total} 条)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded border border-gray-200 px-3 py-1 text-xs hover:bg-gray-100 disabled:opacity-40"
              >
                上一页
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded border border-gray-200 px-3 py-1 text-xs hover:bg-gray-100 disabled:opacity-40"
              >
                下一页
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Database
// ---------------------------------------------------------------------------

const PRESET_QUERIES = [
  {
    label: 'All users',
    sql: 'SELECT id, email, nickname, gender, grade, campus, mbti, is_participating, survey_complete, created_at FROM users ORDER BY created_at DESC',
  },
  {
    label: 'This week matches',
    sql: "SELECT m.*, ua.email as email_a, ub.email as email_b FROM matches m JOIN users ua ON m.user_a_id = ua.id JOIN users ub ON m.user_b_id = ub.id ORDER BY m.created_at DESC",
  },
  {
    label: 'Survey versions',
    sql: 'SELECT version, count(*) as count FROM survey_answers GROUP BY version ORDER BY version',
  },
];

function DatabaseTab({ onAuthFail }: { onAuthFail: () => void }) {
  const [sql, setSql] = useState('');
  const [results, setResults] = useState<Record<string, unknown>[] | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rowCount, setRowCount] = useState(0);

  const execute = () => {
    if (!sql.trim()) return;
    setLoading(true);
    setError('');
    setResults(null);
    adminFetch('/db/query', {
      method: 'POST',
      body: JSON.stringify({ sql: sql.trim() }),
    })
      .then((data) => {
        const rows: Record<string, unknown>[] = Array.isArray(data) ? data : data.rows || data.data || [];
        setResults(rows);
        setRowCount(rows.length);
        if (rows.length > 0) {
          setColumns(Object.keys(rows[0]));
        } else {
          setColumns([]);
        }
      })
      .catch((err) => {
        if (err.message === 'AUTH_FAILED') return onAuthFail();
        setError(err.message);
      })
      .finally(() => setLoading(false));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      execute();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {PRESET_QUERIES.map((pq) => (
          <button
            key={pq.label}
            onClick={() => setSql(pq.sql)}
            className="rounded border border-gray-200 px-3 py-1 text-xs text-[#8B7355] hover:border-[#420047] hover:text-[#420047] transition-colors"
          >
            {pq.label}
          </button>
        ))}
      </div>

      <textarea
        value={sql}
        onChange={(e) => setSql(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={6}
        placeholder="输入 SQL 查询... (Ctrl+Enter 执行)"
        className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 font-mono text-sm outline-none focus:border-[#420047] resize-y"
      />
    
      <div className="flex items-center gap-3">
        <button
          onClick={execute}
          disabled={loading || !sql.trim()}
          className="rounded-lg bg-[#420047] px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {loading ? 'Executing...' : 'Execute'}
        </button>
        {results !== null && (
          <span className="text-xs text-gray-500">返回了 {rowCount} 行</span>
        )}
      </div>
    
      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
    
      {results !== null && (
        <div className="max-h-[500px] overflow-auto rounded-lg border border-gray-200">
          {columns.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-400">
              Query executed successfully, no rows returned
            </p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0">
                <tr className="bg-gray-100 text-left text-xs uppercase tracking-wider text-[#8B7355]">
                  {columns.map((col) => (
                    <th key={col} className="px-3 py-2 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((row, i) => (
                  <tr
                    key={i}
                    className={`border-t border-gray-100 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}
                  >
                    {columns.map((col) => (
                      <td key={col} className="px-3 py-1.5 whitespace-nowrap font-mono text-xs">
                        {row[col] === null || row[col] === undefined
                          ? 'NULL'
                          : typeof row[col] === 'object'
                          ? JSON.stringify(row[col])
                          : String(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: System
// ---------------------------------------------------------------------------

const EMAIL_TYPES = [
  { value: 'survey-reminder', label: '问卷填写提醒' },
  { value: 'survey-outdated-reminder', label: '旧版问卷催更提醒' },
  { value: 'survey-update', label: '问卷更新公告' },
  { value: 'match-revealed', label: '匹配结果揭晓' },
  { value: 'match-mutual', label: '双向愿见达成' },
  { value: 'promo', label: '宣传推广活动' },
] as const;

function TestEmailForm({ onAuthFail, onResult, onError }: {
  onAuthFail: () => void;
  onResult: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [to, setTo] = useState('');
  const [type, setType] = useState<string>('survey-reminder');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!to.trim()) return;
    setSending(true);
    try {
      const result = await adminFetch('/email-test', {
        method: 'POST',
        body: JSON.stringify({ to: to.trim(), type }),
      });
      onResult(result.message);
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === 'AUTH_FAILED') return onAuthFail();
        onError(err.message);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500">收件邮箱</label>
        <input
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="your@email.com"
          className="rounded border border-gray-200 px-3 py-1.5 text-sm focus:border-[#420047] focus:outline-none w-56"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500">邮件类型</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded border border-gray-200 px-3 py-1.5 text-sm focus:border-[#420047] focus:outline-none"
        >
          {EMAIL_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>
      <button
        onClick={handleSend}
        disabled={sending || !to.trim()}
        className="rounded-lg border border-[#420047] px-4 py-1.5 text-sm text-[#420047] transition-colors hover:bg-[#420047] hover:text-white disabled:opacity-40"
      >
        {sending ? '发送中...' : '发送测试'}
      </button>
    </div>
  );
}

function SystemTab({ onAuthFail }: { onAuthFail: () => void }) {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [mailLogStats, setMailLogStats] = useState<{ weekOf: string, mailType: string, count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [actionErr, setActionErr] = useState('');
  const [triggering, setTriggering] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [surveyUpdatePreview, setSurveyUpdatePreview] = useState<ReminderPreview | null>(null);
  const [surveyReminderPreview, setSurveyReminderPreview] = useState<ReminderPreview | null>(null);
  const [surveyUpdatePreviewLoading, setSurveyUpdatePreviewLoading] = useState(false);
  const [surveyReminderPreviewLoading, setSurveyReminderPreviewLoading] = useState(false);
  const [surveyUpdateSending, setSurveyUpdateSending] = useState(false);
  const [surveyReminderSending, setSurveyReminderSending] = useState(false);

  const fetchSystem = useCallback(() => {
    setLoading(true);
    setError('');
    Promise.all([
      adminFetch('/system'),
      adminFetch('/mail-logs-stats').catch(() => ({ stats: [] }))
    ])
      .then(([data, mailData]) => {
        setInfo(data);
        setMailLogStats(mailData.stats || []);
      })
      .catch((err) => {
        if (err.message === 'AUTH_FAILED') return onAuthFail();
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [onAuthFail]);

  useEffect(() => {
    fetchSystem();
  }, [fetchSystem]);

  const handleTriggerMatching = async () => {
    if (!window.confirm('确定要触发匹配吗？ This will run the matching algorithm for this week.')) {
      return;
    }
    setTriggering(true);
    setActionMsg('');
    setActionErr('');
    try {
      const result = await adminFetch('/trigger-matching', { method: 'POST' });
      setActionMsg(
        result.message ||
          `Matching complete. Pairs: ${result.stats?.matchedPairs ?? '?'}, Unmatched: ${result.stats?.unmatched ?? '?'}`
      );
      fetchSystem();
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === 'AUTH_FAILED') return onAuthFail();
        setActionErr(err.message);
      }
    } finally {
      setTriggering(false);
    }
  };

  const handleUnlockReveal = async () => {
    if (!window.confirm('确定要解锁匹配结果显示吗？ This will change all LOCKED matches this week to REVEALED.')) {
      return;
    }
    setUnlocking(true);
    setActionMsg('');
    setActionErr('');
    try {
      const result = await adminFetch('/unlock-reveal', { method: 'POST' });
      setActionMsg(
        result.message || `Reveal unlocked. Count: ${result.unlockedCount ?? '?'}`
      );
      fetchSystem();
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === 'AUTH_FAILED') return onAuthFail();
        setActionErr(err.message);
      }
    } finally {
      setUnlocking(false);
    }
  };

  const [seeding, setSeeding] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [testUserIds, setTestUserIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('admin_test_user_ids') || '[]'); } catch { return []; }
  });
  const persistTestIds = (ids: string[]) => {
    setTestUserIds(ids);
    localStorage.setItem('admin_test_user_ids', JSON.stringify(ids));
  };

  const handleSeedTestUsers = async () => {
    if (!window.confirm('创建两个测试用户（test_a@test.local / test_b@test.local）？')) return;
    setSeeding(true);
    setActionMsg('');
    setActionErr('');
    try {
      const result = await adminFetch('/seed-test-users', { method: 'POST' });
      const ids = (result.users as { id: string }[]).map((u) => u.id);
      persistTestIds(ids);
      setActionMsg(`${result.message} — IDs: ${ids.join(', ')}`);
      fetchSystem();
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === 'AUTH_FAILED') return onAuthFail();
        setActionErr(err.message);
      }
    } finally {
      setSeeding(false);
    }
  };

  const handleTriggerTestMatching = async () => {
    if (testUserIds.length === 0) {
      setActionErr('请先创建测试用户');
      return;
    }
    if (!window.confirm(`只对测试用户跑匹配（${testUserIds.length} 人）？不影响真实用户。`)) return;
    setTriggering(true);
    setActionMsg('');
    setActionErr('');
    try {
      const result = await adminFetch('/trigger-matching', {
        method: 'POST',
        body: JSON.stringify({ userIds: testUserIds }),
      });
      setActionMsg(result.message || `测试匹配完成`);
      fetchSystem();
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === 'AUTH_FAILED') return onAuthFail();
        setActionErr(err.message);
      }
    } finally {
      setTriggering(false);
    }
  };

  const handleCleanupTestUsers = async () => {
    if (!window.confirm('删除所有测试用户及其匹配数据？')) return;
    setCleaning(true);
    setActionMsg('');
    setActionErr('');
    try {
      const result = await adminFetch('/cleanup-test-users', { method: 'DELETE' });
      persistTestIds([]);
      setActionMsg(result.message);
      fetchSystem();
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === 'AUTH_FAILED') return onAuthFail();
        setActionErr(err.message);
      }
    } finally {
      setCleaning(false);
    }
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorBanner message={error} />;
  if (!info) return null;

  return (
    <div className="space-y-6">
      {/* System info cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Uptime" value={formatUptime(info.uptime)} />
        <StatCard label="Node Version" value={info.nodeVersion} />
        <StatCard label="DB Size" value={info.dbSize} />
        <StatCard
          label="Memory (RSS)"
          value={formatBytes(info.memoryUsage.rss)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Heap Used" value={formatBytes(info.memoryUsage.heapUsed)} />
        <StatCard label="Heap Total" value={formatBytes(info.memoryUsage.heapTotal)} />
        <StatCard
          label="Matching Locked"
          value={
            <span
              className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                info.isLocked
                  ? 'bg-red-100 text-red-700'
                  : 'bg-green-100 text-green-700'
              }`}
            >
              {info.isLocked ? 'LOCKED' : 'UNLOCKED'}
            </span>
          }
        />
      </div>
    
      {/* Table row counts */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8B7355]">
          Table Row Counts
        </h2>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100 text-left text-xs uppercase tracking-wider text-[#8B7355]">
                <th className="px-3 py-2">数据表</th>
                <th className="px-3 py-2">行数</th>
              </tr>
            </thead>
            <tbody>
              {info.tables.map((t, i) => (
                <tr
                  key={t.table}
                  className={`border-t border-gray-100 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}
                >
                  <td className="px-3 py-2 font-mono text-xs">{t.table}</td>
                  <td className="px-3 py-2">{t.rows}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    
      {/* Actions */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8B7355]">
          匹配操作
        </h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleTriggerMatching}
            disabled={triggering}
            className="rounded-lg border border-[#420047] px-4 py-2 text-sm text-[#420047] transition-colors hover:bg-[#420047] hover:text-white disabled:opacity-40"
          >
            {triggering ? 'Running...' : 'Trigger Matching'}
          </button>
          <button
            onClick={handleUnlockReveal}
            disabled={unlocking}
            className="rounded-lg border border-[#420047] px-4 py-2 text-sm text-[#420047] transition-colors hover:bg-[#420047] hover:text-white disabled:opacity-40"
          >
            {unlocking ? 'Running...' : 'Unlock Reveal'}
          </button>
          <button
            onClick={async () => {
              if (!window.confirm('重新生成本周所有晚风私语？会覆盖现有文案，约需数分钟。')) return;
              setActionMsg('');
              setActionErr('');
              try {
                const result = await adminFetch('/regen-curator-notes', { method: 'POST' });
                setActionMsg(`${result.message}（成功 ${result.updated}，失败 ${result.failed}）`);
              } catch (err: unknown) {
                if (err instanceof Error) {
                  if (err.message === 'AUTH_FAILED') return onAuthFail();
                  setActionErr(err.message);
                }
              }
            }}
            className="rounded-lg border border-amber-400 px-4 py-2 text-sm text-amber-600 transition-colors hover:bg-amber-50 disabled:opacity-40"
          >
            重新生成晚风私语
          </button>
          <button
            onClick={fetchSystem}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            刷新
          </button>
        </div>
        {actionMsg && (
          <div className="rounded border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
            {actionMsg}
          </div>
        )}
        {actionErr && <ErrorBanner message={actionErr} onDismiss={() => setActionErr('')} />}
      </div>
    
      {/* Test Users */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8B7355]">测试匹配（不影响真实用户）</h2>
        <p className="text-xs text-gray-500">流程：创建测试用户 → 跑测试匹配 → Unlock Reveal → 查看结果 → 清理</p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleSeedTestUsers}
            disabled={seeding}
            className="rounded-lg border border-blue-400 px-4 py-2 text-sm text-blue-600 transition-colors hover:bg-blue-50 disabled:opacity-40"
          >
            {seeding ? '创建中...' : '① 创建测试用户'}
          </button>
          <button
            onClick={handleTriggerTestMatching}
            disabled={triggering || testUserIds.length === 0}
            className="rounded-lg border border-blue-400 px-4 py-2 text-sm text-blue-600 transition-colors hover:bg-blue-50 disabled:opacity-40"
          >
            {triggering ? 'Running...' : `② 跑测试匹配${testUserIds.length > 0 ? `（${testUserIds.length}人）` : ''}`}
          </button>
          <button
            onClick={handleCleanupTestUsers}
            disabled={cleaning}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-500 transition-colors hover:bg-red-50 disabled:opacity-40"
          >
            {cleaning ? '清理中...' : '③ 清理测试用户'}
          </button>
        </div>
        {testUserIds.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-gray-400">当前测试用户 ID：{testUserIds.join(', ')}</p>
            <div className="flex flex-wrap gap-2">
              {testUserIds.map((id, i) => (
                <button
                  key={id}
                  onClick={async () => {
                    try {
                      const result = await adminFetch(`/impersonate/${id}`, { method: 'POST' });
                      localStorage.setItem('nju_date_token', result.token);
                      window.location.href = '/dashboard';
                    } catch (err: unknown) {
                      if (err instanceof Error) setActionErr(err.message);
                    }
                  }}
                  className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  以测试用户{i === 0 ? 'A' : 'B'}身份登录
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    
      {/* Test Email */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8B7355]">发送测试邮件</h2>
        <TestEmailForm onAuthFail={onAuthFail} onResult={(msg) => setActionMsg(msg)} onError={(e) => setActionErr(e)} />
      </div>
    
      {/* Email Previews */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8B7355]">送达统计 / Mail Logs</h2>
        {mailLogStats.length === 0 ? (
          <p className="text-xs text-gray-500">暂无发送记录</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full text-left text-sm text-gray-600">
              <thead className="bg-[#FAF8F5] text-xs font-semibold uppercase text-[#8B7355]">
                <tr>
                  <th className="px-4 py-3">Week / Event</th>
                  <th className="px-4 py-3">Mail Type</th>
                  <th className="px-4 py-3">Sent Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {mailLogStats.map((s, idx) => (
                  <tr key={`${s.weekOf}-${s.mailType}-${idx}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">{s.weekOf}</td>
                    <td className="px-4 py-3 font-medium text-[#420047]">{s.mailType}</td>
                    <td className="px-4 py-3">{s.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    
      {/* Email Previews */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8B7355]">邮件模板预览</h2>
        <div className="flex flex-wrap gap-2">
          {['survey-reminder', 'survey-outdated-reminder', 'survey-update', 'match-revealed', 'match-mutual', 'match-expiration', 'auto-pause', 'permanent-sleep', 'otp', 'promo'].map((type) => (
            <button
              key={type}
              onClick={() => {
                const key = sessionStorage.getItem('admin_key') || '';
                const win = window.open('', '_blank');
                if (!win) return;
                win.document.write('<p>Loading...</p>');
                const USE_MOCK = (import.meta as any).env.VITE_USE_MOCK === 'true';
                if (USE_MOCK) {
                  win.document.open();
                  win.document.write(`<h1>Mock Email Preview: ${type}</h1><p>Vite Environment (Mock Enabled): Start the backend server on 3000 and turn off Vite mock to preview the HTML templates.</p>`);
                  win.document.close();
                  return;
                }
                fetch(`/api/v1/admin/email-preview/${type}`, {
                  headers: { 'x-admin-key': key },
                })
                  .then((r) => r.text())
                  .then((html) => {
                    win.document.open();
                    win.document.write(html);
                    win.document.close();
                  });
              }}
              className="rounded border border-gray-200 px-3 py-1.5 text-xs text-[#8B7355] hover:border-[#420047] hover:text-[#420047] transition-colors"
            >
              {type}
            </button>
          ))}
        </div>
      </div>
    
      {/* Survey Update Reminder */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8B7355]">旧版问卷提醒</h2>
        <p className="text-xs text-gray-500">向已完成旧版问卷但未更新到新版问卷（v4.0）参与匹配的用户发送手动提醒邮件。</p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              setSurveyUpdatePreviewLoading(true);
              setSurveyUpdatePreview(null);
              setSurveyReminderPreview(null);
              adminFetch('/survey-update/preview')
                .then(setSurveyUpdatePreview)
                .catch((err) => { if (err.message === 'AUTH_FAILED') return onAuthFail(); setActionErr(err.message); })
                .finally(() => setSurveyUpdatePreviewLoading(false));
            }}
            disabled={surveyUpdatePreviewLoading}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:border-gray-500 hover:text-gray-800 transition-colors disabled:opacity-40"
          >
            {surveyUpdatePreviewLoading ? '查询中...' : '预览受影响用户'}
          </button>
          
          {surveyUpdatePreview && (
            <button
              onClick={async () => {
                if (!window.confirm(`将向 ${surveyUpdatePreview.withEmailEnabled} 位用户（共 ${surveyUpdatePreview.total} 人）发送旧版问卷提醒邮件，确认发送？`)) return;
                setSurveyUpdateSending(true);
                try {
                  const result = await adminFetch('/survey-update/send', { method: 'POST' });
                  setActionMsg(result.message + ` (发送 ${result.stats?.sent ?? '?'}，跳过 ${result.stats?.skipped ?? '?'}，失败 ${result.stats?.failed ?? '?'})`);
                  setSurveyUpdatePreview(null);
                } catch (err: unknown) {
                  if (err instanceof Error) {
                    if (err.message === 'AUTH_FAILED') return onAuthFail();
                    setActionErr(err.message);
                  }
                } finally {
                  setSurveyUpdateSending(false);
                }
              }}
              disabled={surveyUpdateSending}
              className="rounded-lg bg-[#420047] px-4 py-2 text-sm text-white hover:bg-[#5C0064] transition-colors disabled:opacity-40"
            >
              {surveyUpdateSending ? '发送中...' : `发送提醒 (${surveyUpdatePreview.withEmailEnabled} 人)`}
            </button>
          )}
        </div>
        {surveyUpdatePreview && (
          <ReminderPreviewCard title="旧版问卷用户" preview={surveyUpdatePreview} />
        )}
      </div>
    
      {/* Survey Reminder */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8B7355]">新注册问卷提醒</h2>
        <p className="text-xs text-gray-500">向已注册但未完成问卷的用户发送提醒邮件。</p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              setSurveyReminderPreviewLoading(true);
              setSurveyReminderPreview(null);
              setSurveyUpdatePreview(null);
              adminFetch('/survey-reminder/preview')
                .then(setSurveyReminderPreview)
                .catch((err) => { if (err.message === 'AUTH_FAILED') onAuthFail(); setActionErr(err.message); })
                .finally(() => setSurveyReminderPreviewLoading(false));
            }}
            disabled={surveyReminderPreviewLoading}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:border-gray-500 hover:text-gray-800 transition-colors disabled:opacity-40"
          >
            {surveyReminderPreviewLoading ? '查询中...' : '预览受影响用户'}
          </button>
          {surveyReminderPreview && (
            <button
              onClick={async () => {
                if (!window.confirm(`将向 ${surveyReminderPreview.withEmailEnabled} 位用户发送提醒邮件，确认？`)) return;
                setSurveyReminderSending(true);
                try {
                  const result = await adminFetch('/survey-reminder/send', { method: 'POST' });
                  setActionMsg(result.message + ` (发送 ${result.stats?.sent ?? '?'}，跳过 ${result.stats?.skipped ?? '?'}，失败 ${result.stats?.failed ?? '?'})`);
                  setSurveyReminderPreview(null);
                } catch (err: unknown) {
                  if (err instanceof Error) {
                    if (err.message === 'AUTH_FAILED') return onAuthFail();
                    setActionErr(err.message);
                  }
                } finally {
                  setSurveyReminderSending(false);
                }
              }}
              disabled={surveyReminderSending}
              className="rounded-lg border border-[#420047] px-4 py-2 text-sm text-[#420047] transition-colors hover:bg-[#420047] hover:text-white disabled:opacity-40"
            >
              {surveyReminderSending ? '发送中...' : `发送提醒 (${surveyReminderPreview.withEmailEnabled} 人)`}
            </button>
          )}
        </div>
        {surveyReminderPreview && (
          <ReminderPreviewCard title="未填问卷用户" preview={surveyReminderPreview} />
        )}
      </div>
    
      {/* Promote Email Resend */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8B7355]">Promo 活动邮件重发（配对成功专属）</h2>
        <p className="text-xs text-gray-500">向所有曾发生过匹配的人（不管双向愿意见面还是止步）重新发送优化后的 Promo 邮件。</p>
        <button
          onClick={async () => {
            if (!window.confirm('确认向所有匹配过的用户重新补发 Promo 活动邮件吗？')) return;
            setActionMsg('');
            setActionErr('');
            try {
              const result = await adminFetch('/notify/promo-resend', { method: 'POST' });
              setActionMsg(
                result.message + 
                ` (发送 ${result.stats?.sent ?? '?'}，跳过(关闭通知) ${result.stats?.skipped ?? '?'}，失败 ${result.stats?.failed ?? '?'})`
              );
            } catch (err: unknown) {
              if (err instanceof Error) {
                if (err.message === 'AUTH_FAILED') return onAuthFail();
                setActionErr(err.message);
              }
            }
          }}
          className="rounded-lg border border-[#420047] bg-[#420047] px-4 py-2 text-sm text-white transition-colors hover:bg-white hover:text-[#420047]"
        >
          重新发送 Promo 邮件
        </button>
      </div>
    
      {/* Match Reveal Reminder */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8B7355]">匹配结果通知</h2>
        <p className="text-xs text-gray-500">向本周已 REVEALED 但未收到邮件的用户补发匹配结果通知。</p>
        <button
          onClick={async () => {
            if (!window.confirm('将为本周所有 REVEALED 状态的匹配补发通知邮件（已发送过的会自动跳过），确认？')) return;
            setActionMsg('');
            setActionErr('');
            try {
              const result = await adminFetch('/notify/match-revealed', { method: 'POST' });
              setActionMsg(result.message);
            } catch (err: unknown) {
              if (err instanceof Error) {
                if (err.message === 'AUTH_FAILED') return onAuthFail();
                setActionErr(err.message);
              }
            }
          }}
          className="rounded-lg border border-[#420047] px-4 py-2 text-sm text-[#420047] transition-colors hover:bg-[#420047] hover:text-white"
        >
          补发本周匹配结果通知
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Admin Component
// ---------------------------------------------------------------------------

const Admin: React.FC = () => {
  const [networkAllowed, setNetworkAllowed] = useState<boolean | null>(null);
  const [hasKey, setHasKey] = useState(() => !!sessionStorage.getItem('admin_key'));
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const USE_MOCK = (import.meta as any).env.VITE_USE_MOCK === 'true';
    if (USE_MOCK) {
      setNetworkAllowed(true);
      return;
    }
    fetch('/api/v1/admin/ping')
      .then((res) => {
        // If Nginx explicitly blocks (403 HTML/404 via error_page) or intercepts
        if (res.status === 404 || !res.ok && res.headers.get('content-type')?.includes('text/html')) {
          setNetworkAllowed(false);
        } else {
          setNetworkAllowed(true);
        }
      })
      .catch(() => {
        setNetworkAllowed(false);
      });
  }, []);

  const handleAuthFail = useCallback(() => {
    sessionStorage.removeItem('admin_key');
    setHasKey(false);
  }, []);

  const handleKeySet = useCallback(() => {
    setHasKey(true);
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem('admin_key');
    setHasKey(false);
  };

  if (networkAllowed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FCFBF8]">
        <Spinner />
      </div>
    );
  }

  if (networkAllowed === false) {
    return <NotFound />;
  }

  if (!hasKey) {
    return <AdminKeyGate onKeySet={handleKeySet} />;
  }

  return (
    <div className="min-h-screen bg-[#FCFBF8] text-[#2C2825]">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <h1 className="font-serif text-xl tracking-wide text-[#420047]">NJU Match 管理后台</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setRefreshKey(k => k + 1)}
              className="inline-flex items-center gap-1.5 rounded bg-[#EAE7E1] px-3 py-1 text-xs text-[#2C2825] hover:bg-[#D5C2C4] transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              刷新数据
            </button>
            <button
              onClick={handleLogout}
              className="rounded border border-gray-200 px-3 py-1 text-xs text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
            >退出登录</button>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="border-b border-gray-200 bg-white px-6">
        <div className="mx-auto flex max-w-7xl gap-0 overflow-x-auto whitespace-nowrap scrollbar-hide">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-b-2 border-[#420047] text-[#420047]'
                  : 'text-[#8B7355] hover:text-[#2C2825]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>
    
      {/* Content */}
      <main key={refreshKey} className="mx-auto max-w-7xl px-6 py-6">
        {activeTab === 'overview' && <OverviewTab onAuthFail={handleAuthFail} />}
        {activeTab === 'users' && <UsersTab onAuthFail={handleAuthFail} />}
        {activeTab === 'matches' && <MatchesTab onAuthFail={handleAuthFail} />}
        {activeTab === 'heartbox' && <HeartboxSignalsTab onAuthFail={handleAuthFail} />}
        {activeTab === 'reports' && <ReportsTab onAuthFail={handleAuthFail} />}
        {activeTab === 'forumReports' && <ForumReportsTab onAuthFail={handleAuthFail} />}
        {activeTab === 'forumCredit' && <ForumCreditTab onAuthFail={handleAuthFail} />}
        {activeTab === 'teamups' && <TeamupsTab onAuthFail={handleAuthFail} />}
        {FORUM_FEATURE_ENABLED && activeTab === 'forum' && <ForumModerationTab onAuthFail={handleAuthFail} />}
        {activeTab === 'audit' && <AuditLogsTab onAuthFail={handleAuthFail} />}
        {activeTab === 'database' && <DatabaseTab onAuthFail={handleAuthFail} />}
        {activeTab === 'system' && <SystemTab onAuthFail={handleAuthFail} />}
        {activeTab === 'components' && <ComponentsTab onAuthFail={handleAuthFail} />}
      </main>
    </div>
  );
};

export default Admin;
