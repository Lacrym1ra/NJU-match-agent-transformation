import { MOCK_QUESTION_SECTIONS } from './mockQuestions';

let mockIsParticipating = true;
let mockPauseUntilWeek: string | null = null;

let mockHeartboxActiveMasked: string | null = null;
let mockHeartboxActiveCreatedAt: string | null = null;
let mockHeartboxHasIncoming = true;
let mockCurrentMatchIsHeartbox = false;
let mockLatestHeartboxMatch: { id: string; status: string; mainMatchId: string | null; updatedAt: string } | null = null;
let mockHeartboxCooldownUntil: string | null = null;
const MOCK_STUDENT_ID_BOUND_KEY = 'mock_student_id_bound';
const MOCK_STUDENT_ID_LAST4_KEY = 'mock_student_id_last4';

function getMockStudentIdBound(): boolean {
  try { return localStorage.getItem(MOCK_STUDENT_ID_BOUND_KEY) === '1'; } catch { return false; }
}

function setMockStudentIdBound(bound: boolean): void {
  try { localStorage.setItem(MOCK_STUDENT_ID_BOUND_KEY, bound ? '1' : '0'); } catch {}
}

function getMockStudentIdLast4(): string | null {
  try { return localStorage.getItem(MOCK_STUDENT_ID_LAST4_KEY); } catch { return null; }
}

function setMockStudentIdLast4(last4: string | null): void {
  try {
    if (last4 == null) localStorage.removeItem(MOCK_STUDENT_ID_LAST4_KEY);
    else localStorage.setItem(MOCK_STUDENT_ID_LAST4_KEY, last4);
  } catch {}
}

let mockAdminCircles = [
  { id: 'c-review-1', name: '校园摄影散步圈', slug: 'campus-photo-walk', description: '约傍晚散步和拍照，分享校园取景点。', category: 'arts', tag: 'photography', tags: ['photography'], iconUrl: '', creatorId: 'mock-user-1', memberCount: 0, isActive: false, status: 'pending_review', reviewNote: '', reviewedBy: null, reviewedAt: null, createdAt: '2026-05-26T12:00:00.000Z' },
  { id: 'c1', name: '王者荣耀圈', slug: 'honor-of-kings', description: '群雄逐鹿，开黑上分的集散地。', category: 'sports', tag: 'moba', tags: ['moba'], iconUrl: '', creatorId: null, memberCount: 128, isActive: true, status: 'active', reviewNote: null, reviewedBy: null, reviewedAt: null, createdAt: '2026-03-18T12:00:00.000Z' },
  { id: 'c4', name: '洛克王国：世界圈', slug: 'rock-kingdom-world', description: '精灵养成、开放世界探索与版本攻略交流地。', category: 'game', tag: 'pet_battle', tags: ['pet_battle', 'open_world'], iconUrl: '', creatorId: null, memberCount: 72, isActive: true, status: 'active', reviewNote: null, reviewedBy: null, reviewedAt: null, createdAt: '2026-04-12T12:00:00.000Z' },
  { id: 'c5', name: '守望先锋圈', slug: 'overwatch', description: '组车、练配合、聊版本与英雄池的据点。', category: 'game', tag: 'hero_shooter', tags: ['hero_shooter', 'teamplay'], iconUrl: '', creatorId: null, memberCount: 96, isActive: true, status: 'active', createdAt: '2026-04-18T12:00:00.000Z' },
  { id: 'c6', name: 'JPOP（日音）圈', slug: 'jpop', description: 'JPOP、乐队、Anisong 和日剧 OST 爱好者交流地。', category: 'music', tag: 'jpop', tags: ['jpop', 'anisong'], iconUrl: '', creatorId: null, memberCount: 61, isActive: true, status: 'active', createdAt: '2026-04-20T12:00:00.000Z' },
  { id: 'c7', name: '欧美流行圈', slug: 'western-pop', description: '欧美流行、榜单热单和经典老歌爱好者交流地。', category: 'music', tag: 'western_pop', tags: ['western_pop', 'pop'], iconUrl: '', creatorId: null, memberCount: 84, isActive: true, status: 'active', createdAt: '2026-04-21T12:00:00.000Z' },
  { id: 'c2', name: '夜跑与健身', slug: 'night-run', description: '燃烧卡路里，记录仙林校园的夜跑轨迹。', category: 'lifestyle', tag: 'run', tags: ['run'], iconUrl: '', creatorId: null, memberCount: 56, isActive: true, status: 'active', createdAt: '2026-03-25T12:00:00.000Z' },
];
let mockCircles = [
  { id: 'c1', name: '王者荣耀圈', slug: 'honor-of-kings', description: '群雄逐鹿，开黑上分的集散地。', category: 'sports', tag: 'moba', tags: ['moba'], image: 'sports_esports', iconUrl: '', creatorId: 'mock-user-1', memberCount: 128, isActive: true, status: 'active', isJoined: true, membershipStatus: 'active', joinPolicy: 'review', viewerRole: 'owner', viewerPermissions: { canViewManage: true, canManage: true, canReviewJoinRequests: true, canPostAsMember: true } },
  { id: 'c4', name: '洛克王国：世界圈', slug: 'rock-kingdom-world', description: '精灵养成、开放世界探索与版本攻略交流地。', category: 'game', tag: 'pet_battle', tags: ['pet_battle', 'open_world'], image: 'pets', iconUrl: '', creatorId: null, memberCount: 72, isActive: true, status: 'active', isJoined: false, membershipStatus: null },
  { id: 'c5', name: '守望先锋圈', slug: 'overwatch', description: '组车、练配合、聊版本与英雄池的据点。', category: 'game', tag: 'hero_shooter', tags: ['hero_shooter', 'teamplay'], image: 'sports_esports', iconUrl: '', creatorId: null, memberCount: 96, isActive: true, status: 'active', isJoined: false, membershipStatus: null },
  { id: 'c6', name: 'JPOP（日音）圈', slug: 'jpop', description: 'JPOP、乐队、Anisong 和日剧 OST 爱好者交流地。', category: 'music', tag: 'jpop', tags: ['jpop', 'anisong'], image: 'music_note', iconUrl: '', creatorId: null, memberCount: 61, isActive: true, status: 'active', isJoined: false, membershipStatus: null },
  { id: 'c7', name: '欧美流行圈', slug: 'western-pop', description: '欧美流行、榜单热单和经典老歌爱好者交流地。', category: 'music', tag: 'western_pop', tags: ['western_pop', 'pop'], image: 'headphones', iconUrl: '', creatorId: null, memberCount: 84, isActive: true, status: 'active', isJoined: false, membershipStatus: null },
  { id: 'c2', name: '夜跑与健身', slug: 'night-run', description: '燃烧卡路里，记录仙林校园的夜跑轨迹。', category: 'lifestyle', tag: 'run', tags: ['run'], image: 'directions_run', iconUrl: '', creatorId: null, memberCount: 56, isActive: true, status: 'active', isJoined: false, membershipStatus: null },
  { id: 'c3', name: '考研自习室', slug: 'library-study', description: '交流资料，图书馆占座打卡。', category: 'academic', tag: 'study', tags: ['study'], image: 'local_library', iconUrl: '', creatorId: null, memberCount: 231, isActive: true, status: 'active', isJoined: true, membershipStatus: 'active' },
];

let mockCircleJoinRequests = [
  {
    id: 'join-req-1',
    circleId: 'c1',
    applicationReason: '主玩打野，想找固定五排队友。',
    applicationAnswer: '星耀 I，晚上和周末在线',
    applicationAnswers: { 常用位置: '打野 / 辅助', 在线时段: '工作日傍晚 / 周末全天' },
    status: 'pending_review',
    rejectReason: null,
    reviewedBy: null,
    reviewedAt: null,
    expiresAt: new Date(Date.now() + 6 * 24 * 3600000).toISOString(),
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    applicant: {
      userId: 'u11',
      nickname: '峡谷晚风',
      avatarUrl: null,
      department: '软件学院',
      grade: '大二',
    },
  },
  {
    id: 'join-req-2',
    circleId: 'c1',
    applicationReason: '想进圈看组队大厅，平时补位比较多。',
    applicationAnswer: '可以打辅助，也能中单',
    applicationAnswers: null,
    status: 'pending_review',
    rejectReason: null,
    reviewedBy: null,
    reviewedAt: null,
    expiresAt: new Date(Date.now() + 5 * 24 * 3600000).toISOString(),
    createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 3600000).toISOString(),
    applicant: {
      userId: 'u12',
      nickname: '补位同学',
      avatarUrl: null,
      department: '电子学院',
      grade: '研一',
    },
  },
];

let mockForumPosts = [
  {
    postId: 'p-global-1',
    circleId: null,
    title: '周末有人一起夜跑吗',
    content: '仙林操场慢跑，配速随缘。',
    type: 'activity',
    author: { userId: 'mock-user-1', nickname: 'Mock User', avatarUrl: null, isOwn: true },
    isAnonymous: false,
    visibility: 'public',
    likeCount: 8,
    favoriteCount: 2,
    commentCount: 3,
    viewCount: 42,
    hotScore: 12,
    hasImages: false,
    likedByMe: false,
    favoritedByMe: false,
    isPinned: false,
    createdAt: new Date(Date.now() - 12 * 3600000).toISOString(),
  },
  {
    postId: 'p-circle-1',
    circleId: 'c1',
    title: '今晚五排差一位辅助',
    content: '21:30 开，语音可选，优先心态稳定。',
    type: 'squad',
    author: { userId: 'u1', nickname: '野区小王子', avatarUrl: null, isOwn: false },
    isAnonymous: false,
    visibility: 'public',
    likeCount: 5,
    favoriteCount: 1,
    commentCount: 1,
    viewCount: 24,
    hotScore: 9,
    hasImages: false,
    likedByMe: true,
    favoritedByMe: false,
    isPinned: false,
    createdAt: new Date(Date.now() - 3 * 3600000).toISOString(),
  },
];

let mockNotifications = [
  {
    id: 'notice-teamup-1',
    type: 'teamup_waitlist_promoted',
    title: '候补已自动补位',
    content: '你在「今晚五排」的候补已补位成功。',
    meta: { circleId: 'c1', teamupId: 't1' },
    isRead: false,
    createdAt: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: 'notice-circle-1',
    type: 'circle_join_requested',
    title: '新的入圈申请',
    content: '「峡谷晚风」申请加入王者荣耀圈。',
    meta: { circleId: 'c1' },
    isRead: false,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
];

type MockCircleComponent = {
  key: string;
  type: 'single_choice' | 'multi_choice' | 'ranking' | 'scale';
  prompt: string;
  options: string[];
  weight: number;
  displayOrder: number;
  isChannelTag?: boolean;
};

const mockCircleComponentsById: Record<string, MockCircleComponent[]> = {
  c1: [
    { key: 'rank', type: 'single_choice', prompt: '我的段位', options: ['青铜/白银', '黄金', '铂金', '钻石', '星耀', '王者', '荣耀/传奇'], weight: 1, displayOrder: 0, isChannelTag: true },
    { key: 'role', type: 'multi_choice', prompt: '常用位置', options: ['上单', '打野', '中单', '射手', '辅助', '不固定'], weight: 1, displayOrder: 1, isChannelTag: true },
    { key: 'play_time', type: 'multi_choice', prompt: '常在线时段', options: ['工作日白天', '工作日傍晚', '工作日深夜', '周末全天'], weight: 1, displayOrder: 2 },
  ],
  c2: [
    { key: 'pace', type: 'single_choice', prompt: '跑步节奏', options: ['轻松慢跑', '均速夜跑', '间歇训练', '随缘散步流'], weight: 1, displayOrder: 0, isChannelTag: true },
    { key: 'route', type: 'multi_choice', prompt: '常跑路线', options: ['操场刷圈', '校园道路', '河边/公园', '健身房跑步机'], weight: 1, displayOrder: 1 },
  ],
  c3: [
    { key: 'study_slot', type: 'single_choice', prompt: '常驻自习时段', options: ['清晨开馆党', '下午沉浸党', '图书馆晚场', '熬夜冲刺党'], weight: 1, displayOrder: 0, isChannelTag: true },
    { key: 'goal_track', type: 'multi_choice', prompt: '当前目标', options: ['考研备考', '期中期末冲刺', '论文/项目推进', '语言考试'], weight: 1, displayOrder: 1 },
  ],
  c4: [
    { key: 'status', type: 'single_choice', prompt: '当前状态', options: ['刚入坑探索', '稳定在玩', '回流补进度', '持续关注版本更新'], weight: 1, displayOrder: 0, isChannelTag: true },
    { key: 'focus', type: 'multi_choice', prompt: '主要关注点', options: ['精灵收集/养成', '开放世界探索', '阵容搭配/战斗', '剧情设定', '攻略与版本资讯'], weight: 1, displayOrder: 1, isChannelTag: true },
    { key: 'game_freq', type: 'single_choice', prompt: '游戏频率', options: ['偶尔玩玩', '每周1-2次', '几乎每天'], weight: 1, displayOrder: 2 },
  ],
  c5: [
    { key: 'rank', type: 'single_choice', prompt: '竞技段位', options: ['主要玩快速/街机', '青铜/白银/黄金', '白金/钻石', '大师及以上'], weight: 1, displayOrder: 0, isChannelTag: true },
    { key: 'role', type: 'multi_choice', prompt: '常玩职责', options: ['重装', '输出', '支援', '补位/都玩'], weight: 1, displayOrder: 1, isChannelTag: true },
    { key: 'play_time', type: 'multi_choice', prompt: '常在线时段', options: ['工作日白天', '工作日傍晚', '工作日深夜', '周末全天'], weight: 1, displayOrder: 2 },
  ],
  c6: [
    { key: 'focus', type: 'multi_choice', prompt: '主要在听什么', options: ['JPOP歌手', '日本乐队', '动画歌曲/Anisong', '日剧/电影OST', 'Vocaloid/术力口', '都听'], weight: 1, displayOrder: 0, isChannelTag: true },
    { key: 'activity', type: 'multi_choice', prompt: '日常方式', options: ['单曲循环/挖歌单', '看现场/Live影像', '追新专/榜单', '收藏翻唱/翻弹', '做歌单分享'], weight: 1, displayOrder: 1 },
  ],
  c7: [
    { key: 'focus', type: 'multi_choice', prompt: '主要在听什么', options: ['欧美流行歌手', '流行乐队/组合', 'R&B/灵魂乐', '舞曲/电子流行', '影视原声/OST', '都听'], weight: 1, displayOrder: 0, isChannelTag: true },
    { key: 'activity', type: 'multi_choice', prompt: '日常方式', options: ['单曲循环/刷榜单', '看现场/Live影像', '收藏MV/舞台', '挖老歌/经典回顾', '做歌单分享'], weight: 1, displayOrder: 1 },
  ],
};

const mockCircleCardSeedValues: Record<string, Record<string, string>> = {
  c1: { rank: '星耀', role: '打野 / 辅助', play_time: '工作日傍晚 / 周末全天' },
  c2: { pace: '均速夜跑', route: '校园道路 / 操场刷圈' },
  c3: { study_slot: '图书馆晚场', goal_track: '考研备考 / 论文推进' },
  c4: { status: '稳定在玩', focus: '精灵收集/养成 / 开放世界探索' },
  c5: { rank: '白金/钻石', role: '支援 / 补位/都玩', play_time: '工作日深夜 / 周末全天' },
  c6: { focus: '日本乐队 / 动画歌曲/Anisong', activity: '单曲循环/挖歌单 / 做歌单分享' },
  c7: { focus: '欧美流行歌手 / 影视原声/OST', activity: '单曲循环/刷榜单 / 挖老歌/经典回顾' },
};

function buildMockCircleEditGroups(circleId: string) {
  const components = mockCircleComponentsById[circleId] || [];
  const seedValues = mockCircleCardSeedValues[circleId] || {};

  return {
    public: components.slice(0, 1).map((component, index) => ({
      key: component.key,
      name: component.prompt,
      value: seedValues[component.key] || '',
      status: 'public',
      topLeft: [0, index] as [number, number],
      width: 1,
      height: 1,
    })),
    hidden: [],
    deleted: components.slice(1).map((component, index) => ({
      key: component.key,
      name: component.prompt,
      value: seedValues[component.key] || '',
      status: 'deleted',
      topLeft: [0, index + 1] as [number, number],
      width: 1,
      height: 1,
    })),
    locked: [],
  };
}
let mockFriendRequests = [
  {
    requestId: 'friend-request-1',
    circleId: 'c1',
    circleName: '王者荣耀圈',
    sender: {
      userId: 'u1',
      nickname: '野区小王子',
      avatarUrl: '',
    },
    cardPreview: {
      previewMode: 'public',
      nickname: '野区小王子',
      avatarUrl: '',
      baseModules: [
        { key: 'grade', label: '年级', value: '大二' },
      ],
      circleCards: [
        {
          circleId: 'c1',
          circleName: '王者荣耀圈',
          modules: [
            { key: 'gaming_rank', label: '段位', value: '星耀I' },
          ],
        },
      ],
    },
    message: '有空一起开黑吗？',
    status: 'pending',
    expiresAt: new Date(Date.now() + 6 * 24 * 3600000).toISOString(),
    createdAt: '2026-04-18T12:00:00.000Z',
  },
];
let mockSentFriendRequests = [
  {
    requestId: 'friend-request-sent-1',
    circleId: 'c2',
    circleName: '摄影漫游',
    target: {
      userId: 'u3',
      nickname: '胶片收藏家',
      avatarUrl: '',
    },
    message: '看到你也喜欢扫街摄影，想认识一下。',
    status: 'pending',
    expiresAt: new Date(Date.now() + 5 * 24 * 3600000).toISOString(),
    createdAt: new Date(Date.now() - 8 * 3600000).toISOString(),
  },
];
let mockAcceptedFriendRequests: Array<{
  requestId: string;
  circleId: string;
  circleName: string;
  responder: {
    userId: string;
    nickname: string;
    avatarUrl: string;
  };
  cardPreview: {
    previewMode: 'public';
    nickname: string;
    avatarUrl: string;
    baseModules: Array<{ key: string; label: string; value: string }>;
    circleCards: Array<{ circleId: string; circleName: string; modules: Array<{ key: string; label: string; value: string }> }>;
  };
  createdAt: string;
  acceptedAt: string;
}> = [];
let mockContactUnlockRequests = [
  {
    requestId: 'contact-request-1',
    circleId: 'c1',
    circleName: '王者荣耀圈',
    sourceType: 'circle',
    sourceLabel: '王者荣耀圈',
    requester: {
      userId: 'u2',
      nickname: '辅助混分巨兽',
      avatarUrl: '',
    },
    cardPreview: {
      previewMode: 'friend',
      nickname: '辅助混分巨兽',
      avatarUrl: '',
      baseModules: [
        { key: 'grade', label: '年级', value: '大二' },
        { key: 'campus', label: '校区', value: '仙林' },
      ],
      circleCards: [
        {
          circleId: 'c1',
          circleName: '王者荣耀圈',
          modules: [
            { key: 'gaming_rank', label: '段位', value: '最强王者' },
            { key: 'gaming_role', label: '位置', value: '辅助' },
          ],
        },
      ],
    },
    message: '如果你愿意的话，想把你的联络方式妥帖收进我的小册页里。',
    createdAt: '2026-04-19T12:00:00.000Z',
  },
];
type MockCircleContact = {
  id: string;
  circleId: string;
  fieldKey: string;
  label: string;
  value: string;
  isEnabled: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
};
let mockCircleContactsByCircleId: Record<string, MockCircleContact[]> = {
  c1: [
    {
      id: 'circle-contact-c1-wechat-1',
      circleId: 'c1',
      fieldKey: 'contact_wechat',
      label: '微信',
      value: 'circle_seed_01',
      isEnabled: true,
      displayOrder: 0,
      createdAt: '2026-04-10T12:00:00.000Z',
      updatedAt: '2026-04-10T12:00:00.000Z',
    },
    {
      id: 'circle-contact-c1-wechat-duplicate',
      circleId: 'c1',
      fieldKey: 'contact_custom_mock_duplicate',
      label: '微信',
      value: 'circle_seed_01',
      isEnabled: true,
      displayOrder: 1,
      createdAt: '2026-04-10T12:01:00.000Z',
      updatedAt: '2026-04-10T12:01:00.000Z',
    },
    {
      id: 'circle-contact-c1-qq-1',
      circleId: 'c1',
      fieldKey: 'contact_qq',
      label: 'QQ',
      value: '10001',
      isEnabled: true,
      displayOrder: 2,
      createdAt: '2026-04-10T12:02:00.000Z',
      updatedAt: '2026-04-10T12:02:00.000Z',
    },
  ],
  c3: [
    {
      id: 'circle-contact-c3-wechat-1',
      circleId: 'c3',
      fieldKey: 'contact_wechat',
      label: '微信',
      value: 'study_seed_01',
      isEnabled: true,
      displayOrder: 0,
      createdAt: '2026-04-10T12:00:00.000Z',
      updatedAt: '2026-04-10T12:00:00.000Z',
    },
  ],
};
let mockGroupedFriends = [
  {
    userId: 'u1',
    nickname: '野区小王子',
    avatarUrl: '',
    friendSince: '2026-04-10T12:00:00.000Z',
    circleCount: 2,
    contactStatus: 'granted',
    contactCircleId: 'c1',
    hasUnlockedContacts: true,
    circles: [
      { circleId: 'c1', circleName: '王者荣耀圈', friendSince: '2026-04-10T12:00:00.000Z' },
      { circleId: 'c3', circleName: '考研自习室', friendSince: '2026-04-12T12:00:00.000Z' },
    ],
  },
  {
    userId: 'u2',
    nickname: '辅助混分巨兽',
    avatarUrl: '',
    friendSince: '2026-04-15T12:00:00.000Z',
    circleCount: 1,
    contactStatus: 'sent',
    contactCircleId: 'c1',
    hasUnlockedContacts: false,
    circles: [
      { circleId: 'c1', circleName: '王者荣耀圈', friendSince: '2026-04-15T12:00:00.000Z' },
    ],
  },
];
let mockContactStatusByUser: Record<string, 'idle' | 'sent' | 'granted'> = {
  u1: 'granted',
  u2: 'sent',
};
let mockBlockedUserIds: string[] = [];
let mockReports: Array<{
  id: string;
  reporterId: string;
  reportedId: string;
  reason: string;
  detail: string | null;
  status: 'pending' | 'reviewed' | 'warn_update' | 'dismissed';
  adminNote?: string | null;
  createdAt: string;
}> = [];
const mockUnlockedContactsByUser: Record<string, Array<{ moduleKey: string; label: string; value: string }>> = {
  u1: [
    { moduleKey: 'contact_wechat', label: '微信', value: 'wild-prince-77' },
  ],
  u2: [],
};

const MOCK_CURRENT_USER_ID = 'mock-user-1';

type MockTeamupContact = {
  type: string;
  value: string;
  label: string;
};

type MockTeamupMember = {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  memberRole: 'leader' | 'member';
  membershipStatus: 'active' | 'left' | 'cancelled';
  joinedAt: string;
  leftAt?: string | null;
  contacts: MockTeamupContact[];
};

type MockTeamupApplication = {
  id: string;
  applicantId: string;
  applicationNote: string;
  contactPayload: MockTeamupContact[];
  applicationType?: 'join' | 'waitlist';
  waitlistPosition?: number | null;
  waitlistJoinedAt?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  createdAt: string;
  reviewedAt?: string | null;
};

type MockTeamup = {
  id: string;
  circleId: string;
  leaderId: string;
  title: string;
  description: string;
  descriptionPreview: string;
  maxMembers: number;
  currentMemberCount: number;
  deadlineAt: string;
  endAt: string;
  teamupType: 'short_term' | 'long_term';
  joinMode: 'direct' | 'approval';
  isPublic: boolean;
  status: 'recruiting' | 'full' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  members: MockTeamupMember[];
  applications: MockTeamupApplication[];
};

type MockChatMessage = {
  id: string;
  circleId: string;
  teamupId?: string;
  senderId: string;
  clientMessageId: string;
  content: string;
  mentions: string[];
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
};

function mockIsoAfter(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function mockId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function mockUserSummary(userId: string) {
  if (userId === MOCK_CURRENT_USER_ID) {
    return { userId, nickname: 'Mock User', avatarUrl: null };
  }
  if (userId === 'u1') {
    return { userId, nickname: '野区小王子', avatarUrl: null };
  }
  if (userId === 'u2') {
    return { userId, nickname: '辅助混分巨兽', avatarUrl: null };
  }
  return { userId, nickname: '未命名用户', avatarUrl: null };
}

function mockPreview(description: string) {
  return description.replace(/\s+/g, ' ').trim().slice(0, 120);
}

let mockTeamups: MockTeamup[] = [
  {
    id: 'tu-direct-1',
    circleId: 'c1',
    leaderId: 'u1',
    title: '周末五排上分小队',
    description: '周六晚王者五排，主打轻松上分，缺一个补位同学。',
    descriptionPreview: '周六晚王者五排，主打轻松上分，缺一个补位同学。',
    maxMembers: 5,
    currentMemberCount: 1,
    deadlineAt: mockIsoAfter(24),
    endAt: mockIsoAfter(30),
    teamupType: 'short_term',
    joinMode: 'direct',
    isPublic: false,
    status: 'recruiting',
    createdAt: mockIsoAfter(-8),
    updatedAt: mockIsoAfter(-2),
    members: [
      {
        ...mockUserSummary('u1'),
        memberRole: 'leader',
        membershipStatus: 'active',
        joinedAt: mockIsoAfter(-8),
        contacts: [{ type: 'wechat', value: 'wild-prince-77', label: '微信' }],
      },
    ],
    applications: [],
  },
  {
    id: 'tu-owned-1',
    circleId: 'c1',
    leaderId: MOCK_CURRENT_USER_ID,
    title: '仙林食堂隐藏菜单探索',
    description: '找两三位同学一起试试各食堂窗口，AA 即可。',
    descriptionPreview: '找两三位同学一起试试各食堂窗口，AA 即可。',
    maxMembers: 4,
    currentMemberCount: 1,
    deadlineAt: mockIsoAfter(12),
    endAt: mockIsoAfter(18),
    teamupType: 'short_term',
    joinMode: 'approval',
    isPublic: false,
    status: 'recruiting',
    createdAt: mockIsoAfter(-6),
    updatedAt: mockIsoAfter(-1),
    members: [
      {
        ...mockUserSummary(MOCK_CURRENT_USER_ID),
        memberRole: 'leader',
        membershipStatus: 'active',
        joinedAt: mockIsoAfter(-6),
        contacts: [{ type: 'wechat', value: 'mock-user-wechat', label: '微信' }],
      },
    ],
    applications: [
      {
        id: 'ta-1',
        applicantId: 'u2',
        applicationNote: '我也想一起探店，时间合适。',
        contactPayload: [{ type: 'wechat', value: 'support-main-22', label: '微信' }],
        status: 'pending',
        createdAt: mockIsoAfter(-1),
      },
    ],
  },
  {
    id: 'tu-contact-window-1',
    circleId: 'c1',
    leaderId: 'u2',
    title: '截止后联络名录测试局',
    description: '这个 mock 队伍已经截止但尚未结束，可用于测试联系方式展开。',
    descriptionPreview: '这个 mock 队伍已经截止但尚未结束，可用于测试联系方式展开。',
    maxMembers: 3,
    currentMemberCount: 2,
    deadlineAt: mockIsoAfter(-1),
    endAt: mockIsoAfter(3),
    teamupType: 'long_term',
    joinMode: 'direct',
    isPublic: false,
    status: 'recruiting',
    createdAt: mockIsoAfter(-12),
    updatedAt: mockIsoAfter(-1),
    members: [
      {
        ...mockUserSummary('u2'),
        memberRole: 'leader',
        membershipStatus: 'active',
        joinedAt: mockIsoAfter(-12),
        contacts: [{ type: 'wechat', value: 'support-main-22', label: '微信' }],
      },
      {
        ...mockUserSummary(MOCK_CURRENT_USER_ID),
        memberRole: 'member',
        membershipStatus: 'active',
        joinedAt: mockIsoAfter(-10),
        contacts: [{ type: 'wechat', value: 'mock-user-wechat', label: '微信' }],
      },
    ],
    applications: [],
  },
];

let mockTeamupChatMessages: Record<string, MockChatMessage[]> = {
  'tu-owned-1': [
    {
      id: 'mock-chat-tu-owned-1',
      circleId: 'c1',
      teamupId: 'tu-owned-1',
      senderId: MOCK_CURRENT_USER_ID,
      clientMessageId: 'seed-tu-owned-1',
      content: '我先把时间定在周六下午，大家有忌口可以直接说。',
      mentions: [],
      createdAt: mockIsoAfter(-0.5),
      updatedAt: null,
      deletedAt: null,
    },
  ],
  'tu-contact-window-1': [
    {
      id: 'mock-chat-tu-contact-window-1',
      circleId: 'c1',
      teamupId: 'tu-contact-window-1',
      senderId: 'u2',
      clientMessageId: 'seed-tu-contact-window-1',
      content: '截止了但活动还没结束，茶话间继续开着。',
      mentions: [],
      createdAt: mockIsoAfter(-0.8),
      updatedAt: null,
      deletedAt: null,
    },
  ],
};

let mockCircleChatMessages: Record<string, MockChatMessage[]> = {
  c1: [
    {
      id: 'mock-chat-c1-1',
      circleId: 'c1',
      senderId: 'u1',
      clientMessageId: 'seed-c1-1',
      content: '今晚有人想开一把娱乐五排吗？',
      mentions: [],
      createdAt: mockIsoAfter(-1.2),
      updatedAt: null,
      deletedAt: null,
    },
    {
      id: 'mock-chat-c1-2',
      circleId: 'c1',
      senderId: MOCK_CURRENT_USER_ID,
      clientMessageId: 'seed-c1-2',
      content: '我可以，先占一个补位。',
      mentions: [],
      createdAt: mockIsoAfter(-1),
      updatedAt: null,
      deletedAt: null,
    },
  ],
  c3: [
    {
      id: 'mock-chat-c3-1',
      circleId: 'c3',
      senderId: 'u2',
      clientMessageId: 'seed-c3-1',
      content: '明天图书馆有人一起早八打卡吗？',
      mentions: [],
      createdAt: mockIsoAfter(-2),
      updatedAt: null,
      deletedAt: null,
    },
  ],
};

function getMockTeamupEffectiveStatus(teamup: MockTeamup) {
  if (teamup.status === 'cancelled') return 'cancelled';
  const now = Date.now();
  if (Date.parse(teamup.endAt) <= now) return 'ended';
  if (Date.parse(teamup.deadlineAt) <= now) return 'expired';
  return teamup.status;
}

function isMockTeamupJoinable(teamup: MockTeamup) {
  return teamup.status === 'recruiting'
    && Date.parse(teamup.deadlineAt) > Date.now()
    && Date.parse(teamup.endAt) > Date.now()
    && teamup.currentMemberCount < teamup.maxMembers;
}

function getActiveMockTeamupMembers(teamup: MockTeamup) {
  return teamup.members.filter((member) => member.membershipStatus === 'active');
}

function ensureMockCircleChatOpen(circleId: string) {
  const circle = mockCircles.find((item) => item.id === circleId);
  if (!circle) throw new Error('圈子不存在');
  if (!circle.isActive || circle.status !== 'active') throw new Error('该圈子当前不可聊天');
  if (!circle.isJoined || circle.membershipStatus !== 'active') throw new Error('加入圈子后可参与聊天');
  return circle;
}

function serializeMockCircleChatMessage(message: MockChatMessage) {
  const sender = mockUserSummary(message.senderId);
  const isDeleted = Boolean(message.deletedAt);
  return {
    id: message.id,
    roomType: 'circle',
    circleId: message.circleId,
    sender,
    content: isDeleted ? '' : message.content,
    mentions: message.mentions,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
    deletedAt: message.deletedAt,
    isOwn: message.senderId === MOCK_CURRENT_USER_ID,
  };
}

function ensureMockTeamupChatOpen(teamup: MockTeamup) {
  if (!getActiveMockTeamupMembers(teamup).some((member) => member.userId === MOCK_CURRENT_USER_ID)) {
    throw new Error('加入组队后可参与聊天');
  }
  const status = getMockTeamupEffectiveStatus(teamup);
  if (status === 'ended' || status === 'cancelled') {
    throw new Error('组队已结束，聊天已关闭');
  }
}

function serializeMockTeamupChatMessage(message: MockChatMessage) {
  const sender = mockUserSummary(message.senderId);
  const isDeleted = Boolean(message.deletedAt);
  return {
    id: message.id,
    roomType: 'teamup',
    circleId: message.circleId,
    teamupId: message.teamupId,
    sender,
    content: isDeleted ? '' : message.content,
    mentions: message.mentions,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
    deletedAt: message.deletedAt,
    isOwn: message.senderId === MOCK_CURRENT_USER_ID,
  };
}

function serializeMockTeamupListItem(teamup: MockTeamup) {
  const leader = mockUserSummary(teamup.leaderId);
  return {
    id: teamup.id,
    circleId: teamup.circleId,
    leaderId: teamup.leaderId,
    title: teamup.title,
    descriptionPreview: teamup.descriptionPreview,
    maxMembers: teamup.maxMembers,
    currentMemberCount: teamup.currentMemberCount,
    deadlineAt: teamup.deadlineAt,
    endAt: teamup.endAt,
    teamupType: teamup.teamupType,
    joinMode: teamup.joinMode,
    isPublic: teamup.isPublic,
    status: teamup.status,
    effectiveStatus: getMockTeamupEffectiveStatus(teamup),
    joinable: isMockTeamupJoinable(teamup),
    leader,
    updatedAt: teamup.updatedAt,
  };
}

function serializeMockTeamup(teamup: MockTeamup) {
  const activeMembers = getActiveMockTeamupMembers(teamup);
  const viewerMember = activeMembers.find((member) => member.userId === MOCK_CURRENT_USER_ID);
  const activeApplication = teamup.applications.find(
    (application) => application.applicantId === MOCK_CURRENT_USER_ID
      && (application.status === 'pending'
        || (application.applicationType === 'waitlist' && application.status === 'approved' && !application.waitlistJoinedAt)),
  );
  const effectiveStatus = getMockTeamupEffectiveStatus(teamup);
  const canViewContacts = Boolean(viewerMember) && effectiveStatus === 'expired' && teamup.status !== 'cancelled';

  return {
    ...serializeMockTeamupListItem(teamup),
    description: teamup.description,
    members: activeMembers.map(({ contacts: _contacts, membershipStatus: _status, leftAt: _leftAt, ...member }) => member),
    viewer: {
      isCircleMember: true,
      isTeamupMember: Boolean(viewerMember),
      isLeader: viewerMember?.memberRole === 'leader',
      canManage: viewerMember?.memberRole === 'leader',
      canViewContacts,
      contactsVisibleUntil: canViewContacts ? teamup.endAt : null,
      pendingApplicationId: activeApplication?.status === 'pending' ? activeApplication.id : null,
      activeApplicationId: activeApplication?.id ?? null,
      applicationStatus: activeApplication?.status ?? null,
      applicationType: activeApplication?.applicationType ?? null,
      waitlistPosition: activeApplication?.waitlistPosition ?? null,
    },
    createdAt: teamup.createdAt,
  };
}

function getMockFriendEntry(userId: string) {
  return mockGroupedFriends.find((friend) => friend.userId === userId);
}

function normalizeMockCircleContactPart(value: string | null | undefined) {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function getMockCircleContactKey(contact: Pick<MockCircleContact, 'label' | 'value' | 'fieldKey'>) {
  return `${normalizeMockCircleContactPart(contact.label || contact.fieldKey)}:${normalizeMockCircleContactPart(contact.value)}`;
}

function uniqueMockCircleContacts(contacts: MockCircleContact[]) {
  const seen = new Set<string>();
  return contacts.filter((contact) => {
    const key = getMockCircleContactKey(contact);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function removeCircleFromMockFriendships(circleId: string) {
  let removedFriendshipCount = 0;

  mockGroupedFriends = mockGroupedFriends
    .map((friend) => {
      const remainingCircles = friend.circles.filter((circle) => circle.circleId !== circleId);
      removedFriendshipCount += friend.circles.length - remainingCircles.length;
      return remainingCircles.length > 0 ? rebuildMockGroupedFriend(friend, remainingCircles) : friend;
    })
    .filter((friend) => friend.circles.length > 0);

  mockContactUnlockRequests = mockContactUnlockRequests.filter((request) => request.circleId !== circleId);
  mockFriendRequests = mockFriendRequests.filter((request) => request.circleId !== circleId);

  return removedFriendshipCount;
}

function rebuildMockGroupedFriend(
  friend: typeof mockGroupedFriends[number],
  circles: typeof mockGroupedFriends[number]['circles'],
) {
  const friendSince = circles.reduce(
    (earliest, circle) => (circle.friendSince < earliest ? circle.friendSince : earliest),
    circles[0].friendSince,
  );

  return {
    ...friend,
    friendSince,
    circleCount: circles.length,
    circles,
  };
}

const MOCK_SURVEY_VERSION = '4.0';

const MOCK_SURVEY_ANSWERS = {
  q1: { value: 2002 },
  q2: { value: { min: 2000, max: 2005 } },
  q61: { value: ['enfp', 'enfj', 'infj'] },
  q5: { value: ['same_grade', 'higher_grade'] },
  q7: { value: 'prefer_same_major' },
  q3: { value: 'jiangsu' },
  q_jiangsu_city: { value: 'nanjing' },
  q4: { value: 'prefer_same_city' },
  q6: { value: 'same_campus_only' },

  q8: { value: ['movies_series', 'food_exploring', 'travel_citywalk', 'music_listening'] },
  q_mv_type: { value: ['romance', 'sci_fi', 'documentary'] },
  q_mv_media: { value: ['movie', 'kr_drama', 'us_drama'] },
  q_mv_together: { value: 'discuss_plot' },
  q_fd_type: { value: ['cafe_dessert', 'western_brunch', 'hidden_gem'] },
  q_fd_prio: { value: ['good_chat', 'nice_ambiance'] },
  q_tr_type: { value: ['city_walk', 'cafe_hop', 'random_explore'] },
  q_tr_style: { value: 'rough_plan' },
  q_music_style: { value: ['indie', 'c_pop', 'classical'] },
  q_top_interest: { value: 'travel_citywalk' },
  q_date_content: { value: ['walk_citywalk', 'eat_explore', 'just_chat'] },
  q_weekend_date: { value: 'both_ok' },

  q9: { value: 'no' },
  q10: { value: 6, importance: 4 },
  q_drink_freq: { value: 'rarely' },
  q_drink_pref: { value: 5, importance: 3 },
  q_pet_like: { value: 6, importance: 2 },
  q_pet_partner: { value: 5, importance: 2 },
  q15: { value: 'late_sleep_late_rise' },
  q_schedule_imp: { value: 5, importance: 3 },
  q_free_time: { value: ['weekday_night', 'sat_night', 'sun_day'] },
  q_spend_style: { value: 'balanced' },
  q_spend_imp: { value: 5, importance: 3 },
  q32: { value: 'share_equally' },
  q_spend_mode_imp: { value: 4, importance: 2 },
  q37: { value: 4, importance: 2 },
  q38: { value: 4, importance: 2 },

  q_rel_mode: { value: 'mutual_active' },
  q_my_pace: { value: 'slow_careful' },
  q_atmosphere: { value: 'mix_talk_quiet' },
  q_conflict_self: { value: 'cool_then_talk' },
  q_conflict_partner: { value: 'cool_first' },
  q_support_pref: { value: 'both' },
  q_reply_speed: { value: 'normal' },
  q_reply_pref: { value: 5, importance: 3 },
  q41: { value: 4, importance: 2 },
  q36: { value: 5, importance: 3 },
  q_affection_need: { value: 5, importance: 3 },
  q_physical_pace: { value: 4, importance: 2 },

  q_rel_history: { value: 2, importance: 1 },
  q_history_imp: { value: 3, importance: 2 },
  q44: { value: 2, importance: 2 },
  q47: { value: 3, importance: 2 },
  q48: { value: 5, importance: 2 },
  q_space_integration: { value: 'balanced_space' },
  q_red_flags: { value: ['ghost_msg', 'hurtful_words', 'disrespect_circle'] },
  q57: { value: 1, importance: 4 },

  q21: { value: 6, importance: 3 },
  q_work_style: { value: 6, importance: 2 },
  q27: { value: 5, importance: 2 },
  q24: { value: 6, importance: 2 },
  q25: { value: 6, importance: 2 },
  q33: { value: 2, importance: 1 },
  q26: { value: 5, importance: 2 },
  q28: { value: 2, importance: 1 },
  q30: { value: 2, importance: 1 },
  q_future_base: { value: ['jiangsu', 'shanghai', 'zhejiang'] },
  q_future_base_imp: { value: 5, importance: 3 },
  q_growth_env: { value: 'tier2' },
  q_family_econ: { value: 'comfortable' },
  q31: { value: 4, importance: 2 },
  q29: { value: ['kindness', 'honesty', 'curiosity', 'loyalty'] },
  q_partner_qualities: { value: ['kindness', 'honesty', 'curiosity', 'loyalty'] },
  q60: { value: 'communication' },
  q_must_align: { value: 'comm_style' },
};

function getPageMockMatchState(): 'revealed' | 'expired' | null {
  if (typeof window === 'undefined') return null;
  const state = new URL(window.location.href).searchParams.get('mockMatchState');
  return state === 'revealed' || state === 'expired' ? state : null;
}

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

export async function mockRequest(path: string, options: RequestInit): Promise<any> {
  const method = options.method || 'GET';
  const url = new URL(path, 'http://localhost'); // just for parsing pathname

  // Helper to extract JSON body
  const getBody = () => options.body ? JSON.parse(options.body as string) : {};

  // Add random delay to simulate network latency
  await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));

  if (url.pathname === '/auth/send-code' && method === 'POST') {
    return { message: 'Code sent (mock)', expiresIn: 300 };
  }

  if (url.pathname === '/auth/login' && method === 'POST') {
    return {
      token: 'mock-jwt-token-12345',
      isNewUser: false,
      user: {
        id: 'mock-user-1',
        email: getBody().email || 'test@example.com',
        profileComplete: true,
        surveyComplete: true,
      },
    };
  }

  if (url.pathname === '/auth/register' && method === 'POST') {
    document.cookie = "mock_register=temp; path=/; max-age=3600";
    return {
      token: 'mock-jwt-token-12345',
      isNewUser: true,
      user: {
        id: 'mock-user-1',
        email: getBody().email || 'test@example.com',
        profileComplete: false,
        surveyComplete: false,
      },
    };
  }

  if (url.pathname === '/auth/verify-code' && method === 'POST') {
    return {
      token: 'mock-jwt-token-12345',
      isNewUser: false,
      user: {
        id: 'mock-user-1',
        email: getBody().email || 'test@example.com',
        profileComplete: true,
        surveyComplete: true,
      },
    };
  }

  if (url.pathname === '/auth/realtime-ticket' && method === 'POST') {
    return { ticket: `mock-realtime-ticket-${Date.now()}`, expiresIn: 120 };
  }

  if (url.pathname === '/auth/forgot-password/send-code' && method === 'POST') {
    return { message: 'Reset code sent (mock)', expiresIn: 300 };
  }

  if (url.pathname === '/auth/forgot-password/reset' && method === 'POST') {
    return { message: 'Password reset success (mock)' };
  }

  if (url.pathname === '/user/profile' && method === 'GET') {
    // Determine profile completeness from some local state if possible,
    // but here we can just safely simulate what a full API mock would return.
    const isRegisterFlow = document.cookie.includes('mock_register=temp');
    return {
      id: 'mock-user-1',
      email: 'test@example.com',
      nickname: isRegisterFlow ? '' : 'Mock User',
      gender: isRegisterFlow ? '' : 'male',
      genderPreference: isRegisterFlow ? '' : 'female',
      intention: isRegisterFlow ? '' : 'partner',
      grade: isRegisterFlow ? '' : '大三',
      campus: isRegisterFlow ? '' : 'xianlin',
      department: isRegisterFlow ? '' : 'Computer Science',
      mbti: isRegisterFlow ? '' : 'INTJ',
      bio: isRegisterFlow ? '' : 'This is a mock user for frontend development.',
      avatarUrl: null,
      contactPlatform: isRegisterFlow ? '' : 'wechat',
      contactId: isRegisterFlow ? '' : 'mock_wechat_123',
      wechatId: isRegisterFlow ? '' : 'mock_wechat_123',
      isParticipating: mockIsParticipating,
      pauseUntilWeek: mockPauseUntilWeek,
      profileComplete: !isRegisterFlow,
      surveyComplete: !isRegisterFlow,
      createdAt: new Date().toISOString()
    };
  }

  if (url.pathname === '/user/pause-week' && method === 'PATCH') {
    const body = getBody();
    mockPauseUntilWeek = body.pause ? getUpcomingWeekOf() : null;
    return {
      pauseUntilWeek: mockPauseUntilWeek,
      message: 'Pause state updated (mock)'
    };
  }

  if (url.pathname === '/user/status' && method === 'PATCH') {
    const body = getBody();
    mockIsParticipating = body.isParticipating;
    if (body.isParticipating) {
      mockPauseUntilWeek = null;
    }
    return {
      isParticipating: body.isParticipating,
      message: 'Status updated (mock)'
    };
  }

  if (url.pathname === '/user/profile' && method === 'PUT') {
    // Clear the mock_register cookie since profile is now updated
    document.cookie = "mock_register=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    const body = getBody();
    const genderPref = body.genderPref || body.genderPreference || 'any';
    return {
      id: 'mock-user-1',
      email: 'test@example.com',
      nickname: body.nickname || 'Mock User',
      gender: body.gender || 'male',
      genderPref,
      intention: body.intention || 'partner',
      grade: body.grade || '大三',
      campus: body.campus || 'xianlin',
      department: body.department || 'Computer Science',
      mbti: body.mbti || 'INTJ',
      bio: body.bio || 'This is a mock user for frontend development.',
      avatarUrl: null,
      contactPlatform: body.contactPlatform || 'wechat',
      contactId: body.contactId || 'mock_wechat_123',
      isParticipating: true,
      profileComplete: true,
      surveyComplete: false,
      createdAt: new Date().toISOString(),
    };
  }

  if (url.pathname === '/user/profile/draft' && method === 'PATCH') {
    const body = getBody();
    const genderPref = body.genderPref || body.genderPreference || '';
    return {
      id: 'mock-user-1',
      email: 'test@example.com',
      nickname: body.nickname || '',
      gender: body.gender || '',
      genderPref,
      intention: body.intention || '',
      grade: body.grade || '',
      campus: body.campus || '',
      department: body.department || '',
      mbti: body.mbti || '',
      bio: '',
      avatarUrl: null,
      contactPlatform: 'wechat',
      contactId: '',
      isParticipating: true,
      profileComplete: false,
      surveyComplete: false,
      createdAt: new Date().toISOString(),
    };
  }

  if (url.pathname === '/user/status' && method === 'PATCH') {
    return { isParticipating: getBody().isParticipating, message: 'Status updated (mock)' };
  }

  if (url.pathname === '/user/account' && method === 'DELETE') {
    return { message: 'Account deleted (mock)' };
  }

  if (url.pathname === '/user/notifications/unread-count' && method === 'GET') {
    return { unreadCount: mockNotifications.filter((item) => !item.isRead).length };
  }

  if (url.pathname === '/user/notifications' && method === 'GET') {
    const page = Number(url.searchParams.get('page') || 1);
    const limit = Number(url.searchParams.get('limit') || 20);
    const isRead = url.searchParams.get('isRead');
    let list = [...mockNotifications];
    if (isRead === 'true') list = list.filter((item) => item.isRead);
    if (isRead === 'false') list = list.filter((item) => !item.isRead);
    const start = (page - 1) * limit;
    return {
      total: list.length,
      page,
      limit,
      notifications: list.slice(start, start + limit),
    };
  }

  if (url.pathname === '/user/notifications/read-all' && method === 'PATCH') {
    mockNotifications = mockNotifications.map((item) => ({ ...item, isRead: true }));
    return { message: '已全部标为已读' };
  }

  const notificationReadMatch = url.pathname.match(/^\/user\/notifications\/([^/]+)\/read$/);
  if (notificationReadMatch && method === 'PATCH') {
    const [, notificationId] = notificationReadMatch;
    mockNotifications = mockNotifications.map((item) => (
      item.id === notificationId ? { ...item, isRead: true } : item
    ));
    return { message: '已标为已读' };
  }

  // --- FORUM MOCKS ---
  if (url.pathname === '/forum/posts' && method === 'GET') {
    const circleId = url.searchParams.get('circleId');
    const type = url.searchParams.get('type');
    const keyword = (url.searchParams.get('keyword') || '').trim().toLowerCase();
    const page = Number(url.searchParams.get('page') || 1);
    const limit = Number(url.searchParams.get('limit') || 20);
    let posts = mockForumPosts.filter((post) => (
      circleId ? post.circleId === circleId : post.circleId === null
    ));
    if (type) posts = posts.filter((post) => post.type === type);
    if (keyword) {
      posts = posts.filter((post) => `${post.title} ${post.content}`.toLowerCase().includes(keyword));
    }
    const start = (page - 1) * limit;
    return {
      total: posts.length,
      page,
      limit,
      posts: posts.slice(start, start + limit),
    };
  }

  if (url.pathname === '/forum/posts' && method === 'POST') {
    const body = getBody();
    const postId = `p-${Date.now()}`;
    const circleId = body.circleId ?? null;
    const post = {
      postId,
      circleId,
      title: body.title,
      content: body.content,
      type: body.type || 'general',
      author: { userId: 'mock-user-1', nickname: 'Mock User', avatarUrl: null, isOwn: true },
      isAnonymous: Boolean(body.isAnonymous),
      visibility: body.visibility || 'public',
      likeCount: 0,
      favoriteCount: 0,
      commentCount: 0,
      viewCount: 0,
      hotScore: 0,
      hasImages: Array.isArray(body.images) && body.images.length > 0,
      likedByMe: false,
      favoritedByMe: false,
      isPinned: false,
      createdAt: new Date().toISOString(),
    };
    mockForumPosts = [post, ...mockForumPosts];

    let syncedPostId: string | undefined;
    if (circleId && body.syncToGlobal && post.visibility === 'public') {
      syncedPostId = `p-global-${Date.now()}`;
      mockForumPosts = [{ ...post, postId: syncedPostId, circleId: null }, ...mockForumPosts];
    }

    return {
      postId,
      ...(syncedPostId ? { syncedPostId } : {}),
      message: syncedPostId ? '发布成功，已同步至总论坛' : '发布成功',
    };
  }

  // --- CARD MOCKS ---
  if (url.pathname === '/card/modules' && method === 'GET') {
    return {
      components: [
        { key: 'mbti', name: 'MBTI 性格', sourceType: 'user_profile', sourceKey: 'users.mbti' },
        { key: 'grade', name: '年级', sourceType: 'user_profile', sourceKey: 'users.grade' },
        { key: 'campus', name: '校区', sourceType: 'user_profile', sourceKey: 'users.campus' },
        { key: 'bio', name: '个人简介', sourceType: 'user_profile', sourceKey: 'users.bio' },
        { key: 'hobby', name: '兴趣爱好', sourceType: 'manual', sourceKey: null },
      ],
      modules: [
        { key: 'mbti', name: 'MBTI 性格', category: 'basic', isSystem: true },
        { key: 'hobby', name: '兴趣爱好', category: 'interests', isSystem: false, description: '分享你的业余爱好' },
        { key: 'music', name: '常听的歌', category: 'interests', isSystem: false, description: '最近循环的一首歌' },
        { key: 'game', name: '近期在玩', category: 'game', isSystem: false, description: '比如动森、原神、吃鸡等' },
        { key: 'wechat', name: '微信号', category: 'contact', isSystem: true, description: '默认仅好友可见' },
      ]
    };
  }

  if (url.pathname === '/card/base/me' && method === 'GET') {
    return {
      view: 'edit',
      userId: 'mock-user-1',
      circleId: null,
      initialized: true,
      nickname: 'Mock User',
      avatarUrl: '',
      card: {
        base: {
          public: [
            { key: 'mbti', name: 'MBTI 性格', value: 'INFP', status: 'public', topLeft: [0, 0], width: 1, height: 1 },
          ],
          hidden: [],
          deleted: [
            { key: 'grade', name: '年级', value: '大二', status: 'deleted', topLeft: [0, 1], width: 1, height: 1 },
            { key: 'campus', name: '校区', value: '仙林', status: 'deleted', topLeft: [0, 2], width: 1, height: 1 },
            { key: 'bio', name: '个人简介', value: '这是一位用于前端联调的 mock 用户。', status: 'deleted', topLeft: [0, 3], width: 1, height: 1 },
            { key: 'hobby', name: '兴趣爱好', value: '', status: 'deleted', topLeft: [0, 4], width: 1, height: 1 },
          ],
          locked: [],
        },
        circle: { public: [], hidden: [], deleted: [], locked: [] },
        custom: { public: [], hidden: [], deleted: [], locked: [] },
      },
    };
  }

  if (url.pathname === '/card/base/me' && method === 'PUT') {
    return { message: 'A区名片已更新 (mock)' };
  }

  if (url.pathname === '/card' && method === 'GET') {
    return {
      modules: [
        { moduleKey: 'mbti', value: 'INFP', visibilityLevel: 'public', displayOrder: 0 },
        { moduleKey: 'hobby', value: '看书、听音乐', visibilityLevel: 'public', displayOrder: 1 },
      ],
      updatedAt: new Date().toISOString()
    };
  }

  if (url.pathname === '/card' && method === 'PUT') {
    return { message: '保存成功 (Mock)' };
  }

  if (url.pathname.match(/^\/card\/circle\/c\w+\/me$/) && method === 'GET') {
    const match = url.pathname.match(/^\/card\/circle\/(c\w+)\/me$/);
    const circleId = match ? match[1] : 'c1';
    return {
      view: 'edit',
      userId: 'mock-user-1',
      circleId,
      initialized: true,
      nickname: 'Mock User',
      avatarUrl: '',
      card: {
        base: { public: [], hidden: [], deleted: [], locked: [] },
        circle: buildMockCircleEditGroups(circleId),
        custom: { public: [], hidden: [], deleted: [], locked: [] },
      },
      customItems: [],
    };
  }

  if (url.pathname.match(/^\/card\/circle\/c\w+\/me$/) && method === 'PUT') {
    return { message: 'B区名片已更新 (mock)' };
  }

  if (url.pathname.match(/^\/card\/u\d+\/public/) && method === 'GET') {
    const match = url.pathname.match(/^\/card\/(u\d+)\/public/);
    const uid = match ? match[1] : 'u1';
    return {
      view: 'public',
      userId: uid,
      circleId: url.searchParams.get('circleId'),
      nickname: uid === 'u1' ? '野区小王子' : '辅助混分巨兽',
      avatarUrl: '',
      isFriend: false,
      pendingRequest: null,
      card: {
        base: {
          public: [
            { key: 'grade', name: '年级', value: '大二', status: 'public', topLeft: [0, 0], width: 1, height: 1 },
            { key: 'hobbies', name: '爱好', value: '发呆、刷视频', status: 'public', topLeft: [0, 1], width: 1, height: 1 },
          ],
          hidden: [],
          deleted: [],
          locked: [],
        },
        circle: {
          public: [
            { key: 'gaming_rank', name: '段位', value: uid === 'u1' ? '星耀I' : '最强王者', status: 'public', topLeft: [0, 0], width: 1, height: 1 },
            { key: 'gaming_role', name: '位置', value: uid === 'u1' ? '打野' : '辅助', status: 'public', topLeft: [0, 1], width: 1, height: 1 },
          ],
          hidden: [],
          deleted: [],
          locked: [],
        },
        custom: { public: [], hidden: [], deleted: [], locked: [] },
      },
    };
  }

  if (url.pathname.match(/^\/card\/u\d+\/friend/) && method === 'GET') {
    const match = url.pathname.match(/^\/card\/(u\d+)\/friend/);
    const uid = match ? match[1] : 'u1';
    const circleId = url.searchParams.get('circleId');
    return {
      view: 'friend',
      userId: uid,
      circleId,
      nickname: uid === 'u1' ? '野区小王子' : '辅助混分巨兽',
      avatarUrl: '',
      isFriend: true,
      pendingRequest: null,
      card: {
        base: {
          public: [
            { key: 'grade', name: '年级', value: '大二', status: 'public', topLeft: [0, 0], width: 1, height: 1 },
          ],
          hidden: [],
          deleted: [],
          locked: [],
        },
        circle: {
          public: [
            {
              key: circleId === 'c3' ? 'study_slot' : 'gaming_rank',
              name: circleId === 'c3' ? '常驻自习时段' : '段位',
              value: circleId === 'c3'
                ? (uid === 'u1' ? '图书馆晚场' : '清晨自习')
                : (uid === 'u1' ? '星耀I' : '最强王者'),
              status: 'public',
              topLeft: [0, 0],
              width: 1,
              height: 1,
            },
          ],
          hidden: [
            {
              key: circleId === 'c3' ? 'goal_track' : 'gaming_role',
              name: circleId === 'c3' ? '目标计划' : '位置',
              value: circleId === 'c3'
                ? (uid === 'u1' ? '考研数学强化' : '英语作文冲刺')
                : (uid === 'u1' ? '打野' : '辅助'),
              status: 'hidden',
              topLeft: [0, 1],
              width: 1,
              height: 1,
            },
          ],
          deleted: [],
          locked: [],
        },
        custom: { public: [], hidden: [], deleted: [], locked: [] },
      },
    };
  }

  if (url.pathname === '/friends/request' && method === 'POST') {
    return { requestId: 'friend-request-1', message: '申请已发送' };
  }

  if (url.pathname === '/friends/requests' && method === 'GET') {
    return {
      requests: mockFriendRequests,
      acceptedRequests: mockAcceptedFriendRequests,
      sentRequests: mockSentFriendRequests,
    };
  }

  if (url.pathname === '/friends/grouped' && method === 'GET') {
    return { friends: mockGroupedFriends };
  }

  if (url.pathname === '/forum/reports' && method === 'POST') {
    const body = getBody();
    const reasons = Array.isArray(body.reasons) ? body.reasons : [];
    if (reasons.length === 0) throw new Error('请至少选择一个举报原因');
    return {
      reportId: `forum-report-${Date.now()}`,
      status: 'pending',
      message: '举报已提交，等待管理员审核',
    };
  }

  const reportMatch = url.pathname.match(/^\/user\/report\/([^/]+)$/);
  if (reportMatch && method === 'POST') {
    const [, targetId] = reportMatch;
    if (targetId === 'mock-user-1') throw new Error('不能举报自己');
    const body = getBody();
    const reasons = Array.isArray(body.reasons) ? body.reasons : (typeof body.reason === 'string' ? [body.reason] : []);
    const normalizedReasons = Array.from(new Set(reasons.filter((item: unknown) => typeof item === 'string' && item.trim())));
    const reasonValue = normalizedReasons.length > 0 ? normalizedReasons.join(',') : 'other';
    const nowIso = new Date().toISOString();
    const pendingIndex = mockReports.findIndex(
      (item) => item.reporterId === 'mock-user-1' && item.reportedId === targetId && item.status === 'pending',
    );
    if (pendingIndex >= 0) {
      const updated = {
        ...mockReports[pendingIndex],
        reason: reasonValue,
        detail: body.detail || null,
        createdAt: nowIso,
      };
      mockReports = [updated, ...mockReports.filter((_, index) => index !== pendingIndex)];
    } else {
      mockReports = [
        {
          id: `report-${Date.now()}`,
          reporterId: 'mock-user-1',
          reportedId: targetId,
          reason: reasonValue,
          detail: body.detail || null,
          status: 'pending',
          createdAt: nowIso,
        },
        ...mockReports,
      ];
    }
    return { message: '举报已提交，我们将尽快处理' };
  }

  const blockMatch = url.pathname.match(/^\/user\/block\/([^/]+)$/);
  if (blockMatch && method === 'GET') {
    const [, targetId] = blockMatch;
    return { blocked: mockBlockedUserIds.includes(targetId) };
  }

  if (blockMatch && method === 'POST') {
    const [, targetId] = blockMatch;
    if (targetId === 'mock-user-1') throw new Error('不能拉黑自己');
    if (!mockBlockedUserIds.includes(targetId)) {
      mockBlockedUserIds.push(targetId);
    }
    return { message: '已拉黑该用户' };
  }

  if (blockMatch && method === 'DELETE') {
    const [, targetId] = blockMatch;
    mockBlockedUserIds = mockBlockedUserIds.filter((id) => id !== targetId);
    return { message: '已解除拉黑' };
  }

  const deleteAllFriendsMatch = url.pathname.match(/^\/friends\/([^/]+)\/all$/);
  if (deleteAllFriendsMatch && method === 'DELETE') {
    const [, friendId] = deleteAllFriendsMatch;
    const friend = getMockFriendEntry(friendId);
    if (!friend) {
      throw new Error('好友关系不存在');
    }

    mockGroupedFriends = mockGroupedFriends.filter((entry) => entry.userId !== friendId);
    delete mockContactStatusByUser[friendId];
    mockUnlockedContactsByUser[friendId] = [];

    return {
      message: '已从同窗名录中解除全局好友关系',
      removedCircleCount: friend.circles.length,
      remainingCircleCount: 0,
      removedCircleIds: friend.circles.map((circle) => circle.circleId),
    };
  }

  const deleteFriendInCircleMatch = url.pathname.match(/^\/friends\/([^/]+)$/);
  if (deleteFriendInCircleMatch && method === 'DELETE') {
    const [, friendId] = deleteFriendInCircleMatch;
    const circleId = url.searchParams.get('circleId');
    if (!circleId) {
      throw new Error('circleId 必填');
    }

    const friend = getMockFriendEntry(friendId);
    if (!friend) {
      throw new Error('好友关系不存在');
    }

    const remainingCircles = friend.circles.filter((circle) => circle.circleId !== circleId);
    if (remainingCircles.length === friend.circles.length) {
      throw new Error('好友关系不存在');
    }

    mockGroupedFriends = mockGroupedFriends.map((entry) => (
      entry.userId === friendId
        ? rebuildMockGroupedFriend(entry, remainingCircles)
        : entry
    ));

    return {
      message: '已解除该圈好友关系，全局好友仍保留',
      circleId,
      removedCircleCount: 1,
      remainingCircleCount: remainingCircles.length,
    };
  }

  const friendRequestWithdrawMatch = url.pathname.match(/^\/friends\/requests\/([^/]+)\/withdraw$/);
  if (friendRequestWithdrawMatch && method === 'PUT') {
    const [, requestId] = friendRequestWithdrawMatch;
    const exists = mockSentFriendRequests.some((request) => request.requestId === requestId);
    if (!exists) throw new Error('好友申请不存在或不可撤回');
    mockSentFriendRequests = mockSentFriendRequests.filter((request) => request.requestId !== requestId);
    return { message: '已撤回好友申请' };
  }

  const friendRequestSilentRejectMatch = url.pathname.match(/^\/friends\/requests\/([^/]+)\/silent-reject$/);
  if (friendRequestSilentRejectMatch && method === 'PUT') {
    const [, requestId] = friendRequestSilentRejectMatch;
    const exists = mockFriendRequests.some((request) => request.requestId === requestId);
    if (!exists) throw new Error('好友申请不存在或已处理');
    mockFriendRequests = mockFriendRequests.filter((request) => request.requestId !== requestId);
    return { message: '已忽略好友申请' };
  }

  const friendRequestMatch = url.pathname.match(/^\/friends\/requests\/([^/]+)$/);
  if (friendRequestMatch && method === 'PUT') {
    const [, requestId] = friendRequestMatch;
    const body = getBody();
    const request = mockFriendRequests.find((item) => item.requestId === requestId);
    if (request && body.action === 'accept') {
      const existing = getMockFriendEntry(request.sender.userId);
      if (existing) {
        const nextCircles = existing.circles.some((circle) => circle.circleId === request.circleId)
          ? existing.circles
          : [
              ...existing.circles,
              {
                circleId: request.circleId,
                circleName: request.circleName,
                friendSince: new Date().toISOString(),
              },
            ];
        mockGroupedFriends = mockGroupedFriends.map((entry) => (
          entry.userId === request.sender.userId ? rebuildMockGroupedFriend(entry, nextCircles) : entry
        ));
      } else {
        mockGroupedFriends = [
          {
            userId: request.sender.userId,
            nickname: request.sender.nickname,
            avatarUrl: request.sender.avatarUrl,
            friendSince: new Date().toISOString(),
            circleCount: 1,
            contactStatus: 'idle',
            contactCircleId: '',
            hasUnlockedContacts: false,
            circles: [
              {
                circleId: request.circleId,
                circleName: request.circleName,
                friendSince: new Date().toISOString(),
              },
            ],
          },
          ...mockGroupedFriends,
        ];
      }
    }
    mockFriendRequests = mockFriendRequests.filter((request) => request.requestId !== requestId);
    return { action: body.action, message: body.action === 'accept' ? '已成为好友' : '已拒绝好友申请' };
  }

  const circleContactsSettingsMatch = url.pathname.match(/^\/contacts\/circles\/([^/]+)\/settings(?:\/([^/]+))?$/);
  if (circleContactsSettingsMatch) {
    const [, circleId, contactId] = circleContactsSettingsMatch;
    const now = new Date().toISOString();
    mockCircleContactsByCircleId[circleId] ||= [];

    if (!contactId && method === 'GET') {
      return { contacts: mockCircleContactsByCircleId[circleId] };
    }

    if (!contactId && method === 'POST') {
      const body = getBody();
      const existingByFieldKey = mockCircleContactsByCircleId[circleId].find((contact) => contact.fieldKey === body.fieldKey);
      const existingByValue = mockCircleContactsByCircleId[circleId].find((contact) => (
        getMockCircleContactKey(contact) === getMockCircleContactKey({
          fieldKey: body.fieldKey || 'contact_custom_mock',
          label: body.label || body.fieldKey || '联系方式',
          value: body.value || '',
        })
      ));
      const existing = existingByFieldKey || existingByValue;
      if (existing) {
        Object.assign(existing, {
          label: body.label || existing.label,
          value: body.value || existing.value,
          isEnabled: body.isEnabled ?? existing.isEnabled,
          displayOrder: Number.isInteger(body.displayOrder) ? body.displayOrder : existing.displayOrder,
          updatedAt: now,
        });
        return { contact: existing };
      }

      const contact: MockCircleContact = {
        id: `circle-contact-${circleId}-${Date.now()}`,
        circleId,
        fieldKey: body.fieldKey || `contact_custom_${Date.now()}`,
        label: body.label || '联系方式',
        value: body.value || '',
        isEnabled: body.isEnabled ?? true,
        displayOrder: Number.isInteger(body.displayOrder) ? body.displayOrder : mockCircleContactsByCircleId[circleId].length,
        createdAt: now,
        updatedAt: now,
      };
      mockCircleContactsByCircleId[circleId] = [...mockCircleContactsByCircleId[circleId], contact];
      return { contact };
    }

    if (contactId && method === 'PATCH') {
      const body = getBody();
      const contact = mockCircleContactsByCircleId[circleId].find((item) => item.id === contactId);
      if (!contact) throw new Error('联系方式不存在');
      Object.assign(contact, {
        fieldKey: body.fieldKey ?? contact.fieldKey,
        label: body.label ?? contact.label,
        value: body.value ?? contact.value,
        isEnabled: body.isEnabled ?? contact.isEnabled,
        displayOrder: Number.isInteger(body.displayOrder) ? body.displayOrder : contact.displayOrder,
        updatedAt: now,
      });
      return { contact };
    }

    if (contactId && method === 'DELETE') {
      mockCircleContactsByCircleId[circleId] = mockCircleContactsByCircleId[circleId].filter((item) => item.id !== contactId);
      return { message: '已删除圈内联系方式', contactId };
    }
  }

  if (url.pathname === '/contacts/unlock-request' && method === 'POST') {
    const body = getBody();
    mockContactStatusByUser[body.targetUserId] = 'sent';
    mockGroupedFriends = mockGroupedFriends.map((friend) => (
      friend.userId === body.targetUserId
        ? {
          ...friend,
          contactStatus: 'sent',
          contactCircleId: body.circleId || undefined,
          hasUnlockedContacts: false,
        }
        : friend
    ));
    const targetFriend = getMockFriendEntry(body.targetUserId);
    if (targetFriend) {
      mockContactUnlockRequests = [
        {
          requestId: 'contact-request-new',
          circleId: body.circleId || '',
          circleName: body.circleId === 'c1' ? '王者荣耀圈' : body.circleId === 'c3' ? '考研自习室' : '',
          sourceType: body.sourceType || 'circle',
          sourceLabel: body.sourceType === 'address_book' ? '同窗名录' : (body.circleId === 'c1' ? '王者荣耀圈' : body.circleId === 'c3' ? '考研自习室' : '该圈子'),
          requester: {
            userId: 'mock-user-1',
            nickname: 'Mock User',
            avatarUrl: '',
          },
          cardPreview: {
            previewMode: body.sourceType === 'address_book' ? 'friend' : 'friend',
            nickname: 'Mock User',
            avatarUrl: '',
            baseModules: [
              { key: 'grade', label: '年级', value: '大三' },
              { key: 'mbti', label: 'MBTI', value: 'INTJ' },
            ],
            circleCards: body.sourceType === 'address_book'
              ? targetFriend.circles.map((circle) => ({
                  circleId: circle.circleId,
                  circleName: circle.circleName,
                  modules: [
                    { key: `${circle.circleId}_highlight`, label: '圈内印象', value: circle.circleName.includes('王者') ? '打野主指挥' : '晚间图书馆常驻' },
                  ],
                }))
              : [
                  {
                    circleId: body.circleId,
                    circleName: body.circleId === 'c1' ? '王者荣耀圈' : body.circleId === 'c3' ? '考研自习室' : '该圈子',
                    modules: [
                      { key: 'snapshot_highlight', label: '圈内印象', value: body.circleId === 'c1' ? '打野主指挥' : '晚间图书馆常驻' },
                    ],
                  },
                ],
          },
          message: body.message || null,
          createdAt: new Date().toISOString(),
        },
        ...mockContactUnlockRequests,
      ];
    }
    return { requestId: 'contact-request-new', message: '联系方式交换申请已发送' };
  }

  if (url.pathname === '/contacts/unlock-requests' && method === 'GET') {
    return {
      requests: mockContactUnlockRequests.filter((request) => Boolean(getMockFriendEntry(request.requester.userId))),
      replies: [],
    };
  }

  const contactUnlockRequestMatch = url.pathname.match(/^\/contacts\/unlock-requests\/([^/]+)$/);
  if (contactUnlockRequestMatch && method === 'PUT') {
    const [, requestId] = contactUnlockRequestMatch;
    const body = getBody();
    const request = mockContactUnlockRequests.find((item) => item.requestId === requestId);
    if (request && body.action === 'approve') {
      const circleContacts = mockCircleContactsByCircleId[request.circleId || ''] || [];
      const selectedCircleContacts = Array.isArray(body.contactIds) && body.contactIds.length > 0
        ? circleContacts.filter((contact) => body.contactIds.includes(contact.id))
        : circleContacts.filter((contact) => contact.isEnabled);
      const unlockedCircleContacts = uniqueMockCircleContacts(selectedCircleContacts.filter((contact) => contact.isEnabled));
      mockContactStatusByUser[request.requester.userId] = 'granted';
      mockUnlockedContactsByUser[request.requester.userId] = unlockedCircleContacts.length > 0
        ? unlockedCircleContacts.map((contact) => ({
          moduleKey: contact.fieldKey,
          label: contact.label,
          value: contact.value,
        }))
        : [
          { moduleKey: 'contact_wechat', label: '微信', value: request.requester.userId === 'u2' ? 'assist-beast-02' : 'wild-prince-77' },
        ];
      mockGroupedFriends = mockGroupedFriends.map((friend) => (
        friend.userId === request.requester.userId
          ? {
            ...friend,
            contactStatus: 'granted',
            contactCircleId: request.circleId,
            hasUnlockedContacts: true,
          }
          : friend
      ));
    }
    mockContactUnlockRequests = mockContactUnlockRequests.filter((item) => item.requestId !== requestId);
    return { action: body.action, message: body.action === 'approve' ? '已同意交换联系方式' : '已拒绝交换联系方式' };
  }

  const contactStatusMatch = url.pathname.match(/^\/contacts\/status\/([^/]+)$/);
  if (contactStatusMatch && method === 'GET') {
    const [, userId] = contactStatusMatch;
    const friend = getMockFriendEntry(userId);
    return {
      status: friend?.contactStatus || 'idle',
      circleId: friend?.contactCircleId,
    };
  }

  const unlockedContactsMatch = url.pathname.match(/^\/contacts\/([^/]+)$/);
  if (unlockedContactsMatch && method === 'GET') {
    const [, userId] = unlockedContactsMatch;
    const friend = getMockFriendEntry(userId);
    if (!friend || friend.contactStatus !== 'granted') {
      return { contacts: [] };
    }
    return { contacts: mockUnlockedContactsByUser[userId] || [] };
  }

  // --- CIRCLES MOCKS ---
  if (url.pathname === '/circles' && method === 'GET') {
    return {
      circles: mockCircles.filter((circle) => !circle.isJoined),
    };
  }

  if (url.pathname === '/circles' && method === 'POST') {
    const body = getBody();
    const now = new Date().toISOString();
    const tags = Array.isArray(body.tags) && body.tags.length > 0
      ? body.tags.map(String)
      : [String(body.category || '自定义')];
    const circle: any = {
      id: `custom-circle-${Date.now()}`,
      name: String(body.name || '未命名圈子'),
      slug: body.slug || `custom-${Date.now()}`,
      description: String(body.description || ''),
      category: String(body.category || 'custom'),
      tag: tags[0],
      tags,
      image: 'groups',
      iconUrl: body.iconUrl || '',
      creatorId: MOCK_CURRENT_USER_ID,
      memberCount: 0,
      isActive: false,
      status: 'pending_review',
      isJoined: false,
      membershipStatus: null,
      joinPolicy: typeof body.joinPolicy === 'string' ? body.joinPolicy : (body.joinPolicy?.mode || 'review'),
      joinQuestions: Array.isArray(body.joinQuestions)
        ? body.joinQuestions.map((question: any, index: number) => ({
          id: question.id || `q-${index + 1}`,
          question: String(question.question || ''),
          required: Boolean(question.required),
        }))
        : [],
      viewerRole: 'owner',
      viewerPermissions: { canViewManage: true, canManage: true, canReviewJoinRequests: true, canPostAsMember: true },
    };
    mockCircles = [circle, ...mockCircles];
    return { message: '圈子已提交审核', circleId: circle.id, circle };
  }

  if (url.pathname === '/circles/my' && method === 'GET') {
    return {
      circles: mockCircles.filter((circle) => circle.isJoined),
    };
  }

  if (url.pathname === '/circles/my-created' && method === 'GET') {
    return {
      circles: mockCircles.filter((circle) => circle.creatorId === MOCK_CURRENT_USER_ID),
    };
  }

  if (url.pathname === '/circles/join-requests/sent' && method === 'GET') {
    const requests = mockCircleJoinRequests
      .filter((request) => request.applicant.userId === MOCK_CURRENT_USER_ID)
      .map((request) => ({
        id: request.id,
        circleId: request.circleId,
        circleName: mockCircles.find((circle) => circle.id === request.circleId)?.name || '未知圈子',
        applicationAnswer: request.applicationAnswer,
        applicationAnswers: request.applicationAnswers,
        applicationReason: request.applicationReason,
        status: request.status,
        rejectReason: request.rejectReason,
        expiresAt: request.expiresAt,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
      }));
    return {
      total: requests.length,
      page: Number(url.searchParams.get('page') || 1),
      limit: Number(url.searchParams.get('limit') || 20),
      requests,
    };
  }

  const circleWithdrawJoinRequestMatch = url.pathname.match(/^\/circles\/join-requests\/([^/]+)\/withdraw$/);
  if (circleWithdrawJoinRequestMatch && method === 'PUT') {
    const [, requestId] = circleWithdrawJoinRequestMatch;
    const request = mockCircleJoinRequests.find((item) => item.id === requestId);
    if (!request) throw new Error('入圈申请不存在');
    if (request.applicant.userId !== MOCK_CURRENT_USER_ID) throw new Error('只能撤回自己发出的入圈申请');
    if (request.status !== 'pending_review') throw new Error('该入圈申请已处理，无法撤回');

    request.status = 'withdrawn';
    request.updatedAt = new Date().toISOString();
    mockCircles = mockCircles.map((circle) => (
      circle.id === request.circleId && circle.membershipStatus === 'pending'
        ? { ...circle, membershipStatus: null }
        : circle
    ));
    return { message: '入圈申请已撤回', requestId, circleId: request.circleId, status: 'withdrawn' };
  }

  const circleManageOverviewMatch = url.pathname.match(/^\/circles\/([^/]+)\/manage\/overview$/);
  if (circleManageOverviewMatch && method === 'GET') {
    const [, circleId] = circleManageOverviewMatch;
    const circle = mockCircles.find((item) => item.id === circleId);
    if (!circle) throw new Error('圈子不存在');
    return {
      circle: {
        ...circle,
        joinPolicy: (circle as any).joinPolicy || 'public',
        joinQuestions: [{ id: 'q1', question: '请简单说明你想加入本圈的原因', required: false }],
        keywordRules: [],
        hasInviteCode: false,
      },
      counts: {
        members: circle.memberCount,
        pendingJoinRequests: mockCircleJoinRequests.filter((item) => item.circleId === circleId && item.status === 'pending_review').length,
        blacklist: 0,
      },
    };
  }

  const circleManageMembersMatch = url.pathname.match(/^\/circles\/([^/]+)\/manage\/members$/);
  if (circleManageMembersMatch && method === 'GET') {
    const [, circleId] = circleManageMembersMatch;
    const circle = mockCircles.find((item) => item.id === circleId);
    if (!circle) throw new Error('圈子不存在');
    const now = new Date().toISOString();
    const members = [
      {
        userId: MOCK_CURRENT_USER_ID,
        role: circle.creatorId === MOCK_CURRENT_USER_ID ? 'owner' : 'member',
        membershipStatus: 'active',
        isActive: true,
        joinedAt: now,
        profile: {
          nickname: 'Mock User',
          avatarUrl: null,
          department: '软件学院',
          grade: '大二',
        },
      },
      {
        userId: 'u1',
        role: circle.creatorId === 'u1' ? 'owner' : 'member',
        membershipStatus: 'active',
        isActive: true,
        joinedAt: now,
        profile: {
          nickname: '野区小王子',
          avatarUrl: null,
          department: '软件学院',
          grade: '大三',
        },
      },
      {
        userId: 'u2',
        role: circle.creatorId === 'u2' ? 'owner' : 'member',
        membershipStatus: 'active',
        isActive: true,
        joinedAt: now,
        profile: {
          nickname: '辅助混分巨兽',
          avatarUrl: null,
          department: '电子学院',
          grade: '研一',
        },
      },
    ];
    return {
      total: members.length,
      page: Number(url.searchParams.get('page') || 1),
      limit: Number(url.searchParams.get('limit') || 20),
      members,
    };
  }

  const circleJoinRequestsMatch = url.pathname.match(/^\/circles\/([^/]+)\/join-requests$/);
  if (circleJoinRequestsMatch && method === 'GET') {
    const [, circleId] = circleJoinRequestsMatch;
    const status = url.searchParams.get('status') || 'pending_review';
    let requests = mockCircleJoinRequests.filter((item) => item.circleId === circleId);
    if (status !== 'all') requests = requests.filter((item) => item.status === status);
    return {
      total: requests.length,
      page: Number(url.searchParams.get('page') || 1),
      limit: Number(url.searchParams.get('limit') || 20),
      requests,
    };
  }

  const circleJoinPolicyMatch = url.pathname.match(/^\/circles\/([^/]+)\/join-policy$/);
  if (circleJoinPolicyMatch && method === 'PUT') {
    const [, circleId] = circleJoinPolicyMatch;
    const body = getBody();
    let updatedCircle: any = null;
    mockCircles = mockCircles.map((circle) => {
      if (circle.id !== circleId) return circle;
      updatedCircle = { ...circle, joinPolicy: body.mode || body.joinPolicy || 'public' };
      return updatedCircle;
    });
    if (!updatedCircle) throw new Error('圈子不存在');
    return { message: '入圈策略已更新', circle: updatedCircle };
  }

  const circleTransferOwnerMatch = url.pathname.match(/^\/circles\/([^/]+)\/transfer-owner$/);
  if (circleTransferOwnerMatch && method === 'POST') {
    const [, circleId] = circleTransferOwnerMatch;
    const body = getBody();
    let updatedCircle: any = null;
    mockCircles = mockCircles.map((circle) => {
      if (circle.id !== circleId) return circle;
      updatedCircle = {
        ...circle,
        creatorId: body.targetUserId,
        viewerRole: 'member',
        viewerPermissions: { canPostAsMember: true },
      };
      return updatedCircle;
    });
    if (!updatedCircle) throw new Error('圈子不存在');
    return { message: '圈主已转让', circle: updatedCircle };
  }

  const circleReviewRequestMatch = url.pathname.match(/^\/circles\/([^/]+)\/requests\/([^/]+)$/);
  if (circleReviewRequestMatch && method === 'PUT') {
    const [, circleId, requestId] = circleReviewRequestMatch;
    const body = getBody();
    const approved = body.action === 'approve';
    let handled: any = null;
    mockCircleJoinRequests = mockCircleJoinRequests.map((request) => {
      if (request.circleId !== circleId || request.id !== requestId) return request;
      handled = {
        ...request,
        status: approved ? 'approved' : 'rejected',
        rejectReason: approved ? null : (body.reason || null),
        reviewedBy: 'mock-user-1',
        reviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return handled;
    });
    if (!handled) throw new Error('入圈申请不存在');
    return { message: approved ? '已通过入圈申请' : '已拒绝入圈申请', request: handled };
  }

  const circleJoinMatch = url.pathname.match(/^\/circles\/([^/]+)\/join$/);
  if (circleJoinMatch && method === 'POST') {
    const [, circleId] = circleJoinMatch;
    const circle = mockCircles.find((item) => item.id === circleId);
    const body = getBody();
    if (!circle) {
      throw new Error('圈子不存在');
    }

    const joinPolicy = typeof (circle as any).joinPolicy === 'string'
      ? (circle as any).joinPolicy
      : ((circle as any).joinPolicy?.mode || 'public');
    if (joinPolicy === 'review') {
      const existing = mockCircleJoinRequests.find((request) => (
        request.circleId === circleId
        && request.applicant.userId === MOCK_CURRENT_USER_ID
        && request.status === 'pending_review'
      ));
      if (existing) {
        circle.membershipStatus = 'pending';
        return {
          message: '入圈申请已提交，等待圈主审核',
          circleId,
          requestId: existing.id,
          membershipStatus: 'pending',
          requestStatus: 'pending_review',
          expiresAt: existing.expiresAt,
        };
      }

      const now = new Date().toISOString();
      const request = {
        id: `join-req-${Date.now()}`,
        circleId,
        applicationReason: String(body.applicationReason || ''),
        applicationAnswer: typeof body.answer === 'string' ? body.answer : null,
        applicationAnswers: body.answers && !Array.isArray(body.answers) ? body.answers : null,
        status: 'pending_review',
        rejectReason: null,
        reviewedBy: null,
        reviewedAt: null,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600000).toISOString(),
        createdAt: now,
        updatedAt: now,
        applicant: {
          userId: MOCK_CURRENT_USER_ID,
          nickname: 'Mock User',
          avatarUrl: null,
          department: '软件学院',
          grade: '大二',
        },
      };
      mockCircleJoinRequests = [request, ...mockCircleJoinRequests];
      circle.membershipStatus = 'pending';
      return {
        message: '入圈申请已提交，等待圈主审核',
        circleId,
        requestId: request.id,
        membershipStatus: 'pending',
        requestStatus: 'pending_review',
        expiresAt: request.expiresAt,
      };
    }

    if (!circle.isJoined) {
      circle.isJoined = true;
      circle.memberCount += 1;
      circle.membershipStatus = 'active';
    }

    return { message: '加入圈子成功', circleId, memberId: 'mock-member-id', membershipStatus: 'active' };
  }

  const circleLeaveMatch = url.pathname.match(/^\/circles\/([^/]+)\/leave$/);
  if (circleLeaveMatch && method === 'DELETE') {
    const [, circleId] = circleLeaveMatch;
    const clearTrace = url.searchParams.get('clearTrace') === 'true' || url.searchParams.get('clearTrace') === '1';
    const silent = url.searchParams.get('silent') === 'true' || url.searchParams.get('silent') === '1';
    const circle = mockCircles.find((item) => item.id === circleId);
    if (!circle) {
      throw new Error('圈子不存在');
    }

    if (!circle.isJoined) {
      throw new Error('你尚未加入该圈子');
    }

    circle.isJoined = false;
    circle.membershipStatus = null;
    circle.memberCount = Math.max(0, circle.memberCount - 1);
    const removedFriendshipCount = removeCircleFromMockFriendships(circleId);

    return {
      message: '已退出圈子，并解除该圈内相关好友关系',
      circleId,
      clearTrace,
      silent,
      removedFriendshipCount,
      clearedTraceCount: clearTrace ? 4 : 0,
      clearedCircleCardCount: clearTrace ? 1 : 0,
      clearedCustomCardCount: clearTrace ? 1 : 0,
      clearedLegacyCardOverrideCount: 0,
      clearedLocationCooldownCount: clearTrace ? 1 : 0,
      clearedJoinRequestCount: clearTrace ? 1 : 0,
      clearedCircleContactCount: 0,
      clearedContactSecretCount: 0,
      cancelledTeamupCount: 0,
      leftTeamupCount: 0,
    };
  }

  const circleDissolveMatch = url.pathname.match(/^\/circles\/([^/]+)$/);
  if (circleDissolveMatch && method === 'DELETE') {
    const [, circleId] = circleDissolveMatch;
    let archivedCircle: any = null;
    mockCircles = mockCircles.map((circle) => {
      if (circle.id !== circleId) return circle;
      archivedCircle = {
        ...circle,
        status: 'archived',
        isActive: false,
        isJoined: false,
        membershipStatus: null,
      };
      return archivedCircle;
    });
    if (!archivedCircle) throw new Error('圈子不存在');
    return { message: '圈子已解散', circle: archivedCircle };
  }

  const circleDetailMatch = url.pathname.match(/^\/circles\/([^/]+)$/);
  if (circleDetailMatch && method === 'GET') {
    const [, circleId] = circleDetailMatch;
    const circle = mockCircles.find((item) => item.id === circleId);
    if (!circle) {
      throw new Error('圈子不存在');
    }

    return { circle, components: mockCircleComponentsById[circleId] || [] };
  }

  if (url.pathname.match(/^\/circles\/c\w+\/channel/) && method === 'GET') {
    const circleId = url.pathname.split('/')[2];
    return {
      total: mockCircles.find((circle) => circle.id === circleId)?.memberCount || 0,
      members: [
        {
          userId: 'u1',
          nickname: '野区小王子',
          avatarUrl: '',
          channelTags: [
            { key: 'gaming_rank', label: '段位', value: '星耀I' },
            { key: 'gaming_role', label: '位置', value: '打野' }
          ]
        },
        {
          userId: 'u2',
          nickname: '辅助混分巨兽',
          avatarUrl: '',
          channelTags: [
            { key: 'gaming_rank', label: '段位', value: '最强王者' },
            { key: 'gaming_role', label: '位置', value: '辅助' }
          ]
        }
      ]
    };
  }
  // -------------------

  if (url.pathname === '/teamups/applications/replies' && method === 'GET') {
    const replies = mockTeamups.flatMap((teamup) => {
      const circle = mockCircles.find((item) => item.id === teamup.circleId);
      return teamup.applications
        .filter((application) => application.applicantId === MOCK_CURRENT_USER_ID)
        .filter((application) => application.status === 'approved' || application.status === 'rejected')
        .map((application) => ({
          id: application.id,
          teamupId: teamup.id,
          circleId: teamup.circleId,
          circleName: circle?.name ?? null,
          teamupTitle: teamup.title,
          leader: mockUserSummary(teamup.leaderId),
          status: application.status,
          reviewNote: null,
          createdAt: application.createdAt,
          respondedAt: application.reviewedAt || application.createdAt,
        }));
    }).sort((a, b) => Date.parse(b.respondedAt) - Date.parse(a.respondedAt));

    return { total: replies.length, page: 1, limit: 20, replies };
  }

  const teamupsCollectionMatch = url.pathname.match(/^\/circles\/([^/]+)\/teamups$/);
  if (teamupsCollectionMatch) {
    const [, circleId] = teamupsCollectionMatch;
    const circle = mockCircles.find((item) => item.id === circleId);
    if (!circle) throw new Error('圈子不存在');
    if (!circle.isJoined) throw new Error('需要先加入圈子');

    if (method === 'GET') {
      const status = url.searchParams.get('status') || 'all';
      const mine = url.searchParams.get('mine') || '';
      const teamupType = url.searchParams.get('teamupType') || 'all';
      const keyword = (url.searchParams.get('keyword') || '').trim().toLowerCase();
      const teamups = mockTeamups
        .filter((teamup) => teamup.circleId === circleId)
        .filter((teamup) => Date.parse(teamup.endAt) > Date.now())
        .filter((teamup) => status === 'all' || status === getMockTeamupEffectiveStatus(teamup) || status === teamup.status)
        .filter((teamup) => teamupType === 'all' || teamup.teamupType === teamupType)
        .filter((teamup) => !keyword || teamup.description.toLowerCase().includes(keyword))
        .filter((teamup) => {
          if (mine === 'created') return teamup.leaderId === MOCK_CURRENT_USER_ID;
          if (mine === 'joined') return teamup.members.some((member) => member.userId === MOCK_CURRENT_USER_ID && member.membershipStatus === 'active');
          if (mine === 'applied') {
            return teamup.applications.some((application) => (
              application.applicantId === MOCK_CURRENT_USER_ID
              && (application.status === 'pending'
                || (application.applicationType === 'waitlist' && application.status === 'approved' && !application.waitlistJoinedAt))
            ));
          }
          return true;
        })
        .map(serializeMockTeamupListItem);
      return { total: teamups.length, page: 1, limit: 20, teamups };
    }

    if (method === 'POST') {
      const body = getBody();
      const now = new Date().toISOString();
      const teamup: MockTeamup = {
        id: `tu-${Date.now()}`,
        circleId,
        leaderId: MOCK_CURRENT_USER_ID,
        title: String(body.title || '未命名邀约'),
        description: String(body.description || ''),
        descriptionPreview: mockPreview(String(body.description || '')),
        maxMembers: Number(body.maxMembers || 2),
        currentMemberCount: 1,
        deadlineAt: body.deadlineAt || mockIsoAfter(12),
        endAt: body.endAt || mockIsoAfter(18),
        teamupType: body.teamupType === 'long_term' ? 'long_term' : 'short_term',
        joinMode: body.joinMode === 'approval' ? 'approval' : 'direct',
        isPublic: Boolean(body.isPublic),
        status: 'recruiting',
        createdAt: now,
        updatedAt: now,
        members: [
          {
            ...mockUserSummary(MOCK_CURRENT_USER_ID),
            memberRole: 'leader',
            membershipStatus: 'active',
            joinedAt: now,
            contacts: Array.isArray(body.contacts) ? body.contacts : [],
          },
        ],
        applications: [],
      };
      mockTeamups = [teamup, ...mockTeamups];
      return { message: '组队已发布', teamup: serializeMockTeamup(teamup) };
    }
  }

  const teamupsHistoryMatch = url.pathname.match(/^\/circles\/([^/]+)\/teamups\/my\/history$/);
  if (teamupsHistoryMatch && method === 'GET') {
    const [, circleId] = teamupsHistoryMatch;
    const teamups = mockTeamups
      .filter((teamup) => teamup.circleId === circleId)
      .filter((teamup) => Date.parse(teamup.endAt) <= Date.now())
      .filter((teamup) => teamup.members.some((member) => member.userId === MOCK_CURRENT_USER_ID))
      .map(serializeMockTeamupListItem);
    return { total: teamups.length, page: 1, limit: 20, teamups };
  }

  const teamupReviewApplicationMatch = url.pathname.match(/^\/circles\/([^/]+)\/teamups\/([^/]+)\/applications\/([^/]+)$/);
  if (teamupReviewApplicationMatch && method === 'PATCH') {
    const [, circleId, teamupId, applicationId] = teamupReviewApplicationMatch;
    const teamup = mockTeamups.find((item) => item.circleId === circleId && item.id === teamupId);
    if (!teamup) throw new Error('组队不存在');
    if (teamup.leaderId !== MOCK_CURRENT_USER_ID) throw new Error('只有组长可以审核申请');
    const application = teamup.applications.find((item) => item.id === applicationId);
    if (!application || application.status !== 'pending') throw new Error('申请不是待审核状态');

    const body = getBody();
    const now = new Date().toISOString();
    if (body.action === 'reject') {
      application.status = 'rejected';
      application.reviewedAt = now;
      return { message: '申请已拒绝', applicationId, teamupId, status: 'rejected', currentMemberCount: teamup.currentMemberCount, teamupStatus: teamup.status };
    }

    if (!isMockTeamupJoinable(teamup)) throw new Error('组队当前不可加入');
    application.status = 'approved';
    application.reviewedAt = now;
    const existing = teamup.members.find((member) => member.userId === application.applicantId);
    if (existing) {
      existing.membershipStatus = 'active';
      existing.leftAt = null;
      existing.contacts = application.contactPayload;
    } else {
      teamup.members.push({
        ...mockUserSummary(application.applicantId),
        memberRole: 'member',
        membershipStatus: 'active',
        joinedAt: now,
        contacts: application.contactPayload,
      });
    }
    teamup.currentMemberCount = getActiveMockTeamupMembers(teamup).length;
    teamup.status = teamup.currentMemberCount >= teamup.maxMembers ? 'full' : 'recruiting';
    teamup.updatedAt = now;
    return { message: '申请已通过', applicationId, teamupId, status: 'approved', currentMemberCount: teamup.currentMemberCount, teamupStatus: teamup.status };
  }

  const teamupWithdrawApplicationMatch = url.pathname.match(/^\/circles\/([^/]+)\/teamups\/([^/]+)\/applications\/([^/]+)\/withdraw$/);
  if (teamupWithdrawApplicationMatch && method === 'PUT') {
    const [, circleId, teamupId, applicationId] = teamupWithdrawApplicationMatch;
    const teamup = mockTeamups.find((item) => item.circleId === circleId && item.id === teamupId);
    if (!teamup) throw new Error('组队不存在');
    const application = teamup.applications.find((item) => item.id === applicationId);
    if (!application) throw new Error('组队申请不存在');
    if (application.applicantId !== MOCK_CURRENT_USER_ID) throw new Error('只能撤回自己发出的组队申请');
    const canWithdraw = application.status === 'pending'
      || (application.applicationType === 'waitlist' && application.status === 'approved' && !application.waitlistJoinedAt);
    if (!canWithdraw) throw new Error('该组队申请当前无法撤回');

    application.status = 'withdrawn';
    application.contactPayload = [];
    application.reviewedAt = new Date().toISOString();
    teamup.updatedAt = application.reviewedAt;
    return {
      message: application.applicationType === 'waitlist' ? '候补申请已撤回' : '组队申请已撤回',
      applicationId,
      teamupId,
      status: 'withdrawn',
      applicationType: application.applicationType || 'join',
    };
  }

  const teamupApplicationsMatch = url.pathname.match(/^\/circles\/([^/]+)\/teamups\/([^/]+)\/applications$/);
  if (teamupApplicationsMatch) {
    const [, circleId, teamupId] = teamupApplicationsMatch;
    const teamup = mockTeamups.find((item) => item.circleId === circleId && item.id === teamupId);
    if (!teamup) throw new Error('组队不存在');

    if (method === 'GET') {
      if (teamup.leaderId !== MOCK_CURRENT_USER_ID) throw new Error('只有组长可以查看申请');
      const status = url.searchParams.get('status') || 'pending';
      const applications = teamup.applications
        .filter((application) => status === 'all' || application.status === status)
        .map((application) => ({
          id: application.id,
          teamupId,
          applicant: {
            ...mockUserSummary(application.applicantId),
            memberRole: 'member',
            joinedAt: application.createdAt,
          },
          applicationNote: application.applicationNote,
          applicationType: application.applicationType || 'join',
          waitlistPosition: application.waitlistPosition ?? null,
          waitlistJoinedAt: application.waitlistJoinedAt ?? null,
          status: application.status,
          createdAt: application.createdAt,
        }));
      return { total: applications.length, page: 1, limit: 20, applications };
    }

    if (method === 'POST') {
      if (teamup.joinMode !== 'approval') throw new Error('当前组队不是审核加入模式');
      if (!isMockTeamupJoinable(teamup)) throw new Error('组队当前不可申请');
      if (teamup.members.some((member) => member.userId === MOCK_CURRENT_USER_ID && member.membershipStatus === 'active')) {
        throw new Error('你已加入该组队');
      }
      if (teamup.applications.some((application) => application.applicantId === MOCK_CURRENT_USER_ID && application.status === 'pending')) {
        throw new Error('已存在待审核申请');
      }
      const body = getBody();
      const now = new Date().toISOString();
      const application: MockTeamupApplication = {
        id: `ta-${Date.now()}`,
        applicantId: MOCK_CURRENT_USER_ID,
        applicationNote: String(body.applicationNote || ''),
        contactPayload: Array.isArray(body.contacts) ? body.contacts : [],
        applicationType: 'join',
        status: 'pending',
        createdAt: now,
      };
      teamup.applications.push(application);
      return {
        message: '加入申请已提交',
        application: {
          id: application.id,
          teamupId,
          applicantId: MOCK_CURRENT_USER_ID,
          status: 'pending',
          cardSnapshotView: 'public',
          createdAt: now,
        },
      };
    }
  }

  const teamupJoinMatch = url.pathname.match(/^\/circles\/([^/]+)\/teamups\/([^/]+)\/join$/);
  if (teamupJoinMatch && method === 'POST') {
    const [, circleId, teamupId] = teamupJoinMatch;
    const teamup = mockTeamups.find((item) => item.circleId === circleId && item.id === teamupId);
    if (!teamup) throw new Error('组队不存在');
    if (teamup.joinMode !== 'direct') throw new Error('当前组队不是直接加入模式');
    if (!isMockTeamupJoinable(teamup)) throw new Error('组队当前不可加入');
    if (teamup.members.some((member) => member.userId === MOCK_CURRENT_USER_ID && member.membershipStatus === 'active')) {
      throw new Error('你已加入该组队');
    }

    const body = getBody();
    const now = new Date().toISOString();
    const existing = teamup.members.find((member) => member.userId === MOCK_CURRENT_USER_ID);
    if (existing) {
      existing.membershipStatus = 'active';
      existing.memberRole = 'member';
      existing.leftAt = null;
      existing.contacts = Array.isArray(body.contacts) ? body.contacts : [];
    } else {
      teamup.members.push({
        ...mockUserSummary(MOCK_CURRENT_USER_ID),
        memberRole: 'member',
        membershipStatus: 'active',
        joinedAt: now,
        contacts: Array.isArray(body.contacts) ? body.contacts : [],
      });
    }
    teamup.currentMemberCount = getActiveMockTeamupMembers(teamup).length;
    teamup.status = teamup.currentMemberCount >= teamup.maxMembers ? 'full' : 'recruiting';
    teamup.updatedAt = now;
    return { message: '已加入组队', teamupId, member: { userId: MOCK_CURRENT_USER_ID, memberRole: 'member', joinedAt: now }, currentMemberCount: teamup.currentMemberCount, status: teamup.status };
  }

  const teamupLeaveMatch = url.pathname.match(/^\/circles\/([^/]+)\/teamups\/([^/]+)\/members\/me$/);
  if (teamupLeaveMatch && method === 'DELETE') {
    const [, circleId, teamupId] = teamupLeaveMatch;
    const teamup = mockTeamups.find((item) => item.circleId === circleId && item.id === teamupId);
    if (!teamup) throw new Error('组队不存在');
    const member = teamup.members.find((item) => item.userId === MOCK_CURRENT_USER_ID && item.membershipStatus === 'active');
    if (!member) throw new Error('你不是该组队成员');
    if (member.memberRole === 'leader') throw new Error('组长退出需要取消组队');
    const now = new Date().toISOString();
    member.membershipStatus = 'left';
    member.leftAt = now;
    teamup.currentMemberCount = getActiveMockTeamupMembers(teamup).length;
    if (teamup.status === 'full' && isMockTeamupJoinable({ ...teamup, status: 'recruiting' })) {
      teamup.status = 'recruiting';
    }
    teamup.updatedAt = now;
    return { message: '已退出组队', teamupId, currentMemberCount: teamup.currentMemberCount, status: teamup.status };
  }

  const teamupCancelMatch = url.pathname.match(/^\/circles\/([^/]+)\/teamups\/([^/]+)\/cancel$/);
  if (teamupCancelMatch && method === 'POST') {
    const [, circleId, teamupId] = teamupCancelMatch;
    const teamup = mockTeamups.find((item) => item.circleId === circleId && item.id === teamupId);
    if (!teamup) throw new Error('组队不存在');
    if (teamup.leaderId !== MOCK_CURRENT_USER_ID) throw new Error('只有组长可以取消组队');
    teamup.status = 'cancelled';
    teamup.updatedAt = new Date().toISOString();
    teamup.members.forEach((member) => {
      if (member.membershipStatus === 'active') member.membershipStatus = 'cancelled';
    });
    return { message: '组队已取消', teamupId, status: 'cancelled', cancelledBy: MOCK_CURRENT_USER_ID, cancelSource: 'leader' };
  }

  const teamupContactsMatch = url.pathname.match(/^\/circles\/([^/]+)\/teamups\/([^/]+)\/contacts$/);
  if (teamupContactsMatch && method === 'GET') {
    const [, circleId, teamupId] = teamupContactsMatch;
    const teamup = mockTeamups.find((item) => item.circleId === circleId && item.id === teamupId);
    if (!teamup) throw new Error('组队不存在');
    if (!serializeMockTeamup(teamup).viewer.canViewContacts) throw new Error('联系方式尚不可查看');
    return {
      teamupId,
      availableSince: teamup.deadlineAt,
      availableUntil: teamup.endAt,
      members: getActiveMockTeamupMembers(teamup).map(({ membershipStatus: _status, leftAt: _leftAt, ...member }) => member),
    };
  }

  const circleChatMessagesMatch = url.pathname.match(/^\/circles\/([^/]+)\/chat\/messages$/);
  if (circleChatMessagesMatch) {
    const [, circleId] = circleChatMessagesMatch;
    ensureMockCircleChatOpen(circleId);

    if (method === 'GET') {
      const before = url.searchParams.get('before');
      let messages = (mockCircleChatMessages[circleId] || [])
        .slice()
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
      if (before) {
        const beforeMessage = messages.find((item) => item.id === before);
        if (!beforeMessage) return { messages: [], hasMore: false, nextBefore: null };
        messages = messages.filter((item) => Date.parse(item.createdAt) < Date.parse(beforeMessage.createdAt));
      }
      const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') || 30)));
      const page = messages.slice(-limit);
      return {
        messages: page.map(serializeMockCircleChatMessage),
        hasMore: messages.length > limit,
        nextBefore: messages.length > limit ? page[0]?.id ?? null : null,
      };
    }

    if (method === 'POST') {
      const body = getBody();
      const clientMessageId = String(body.clientMessageId || mockId('mock-client-message'));
      const existing = (mockCircleChatMessages[circleId] || []).find(
        (item) => item.senderId === MOCK_CURRENT_USER_ID && item.clientMessageId === clientMessageId,
      );
      if (existing) return { message: serializeMockCircleChatMessage(existing) };

      const now = new Date().toISOString();
      const message: MockChatMessage = {
        id: mockId('mock-circle-chat'),
        circleId,
        senderId: MOCK_CURRENT_USER_ID,
        clientMessageId,
        content: String(body.content || '').trim(),
        mentions: Array.isArray(body.mentions) ? body.mentions : [],
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      mockCircleChatMessages[circleId] = [...(mockCircleChatMessages[circleId] || []), message];
      return { message: serializeMockCircleChatMessage(message) };
    }
  }

  const circleChatDeleteMatch = url.pathname.match(/^\/circles\/([^/]+)\/chat\/messages\/([^/]+)$/);
  if (circleChatDeleteMatch && method === 'DELETE') {
    const [, circleId, messageId] = circleChatDeleteMatch;
    ensureMockCircleChatOpen(circleId);
    const message = (mockCircleChatMessages[circleId] || []).find((item) => item.id === messageId);
    if (!message) throw new Error('消息不存在');
    if (message.senderId !== MOCK_CURRENT_USER_ID) throw new Error('只能删除自己发送的消息');
    message.deletedAt = new Date().toISOString();
    message.updatedAt = message.deletedAt;
    return { message: '消息已删除', messageId, circleId };
  }

  const circleChatReadStateMatch = url.pathname.match(/^\/circles\/([^/]+)\/chat\/read-state$/);
  if (circleChatReadStateMatch && method === 'PUT') {
    const [, circleId] = circleChatReadStateMatch;
    ensureMockCircleChatOpen(circleId);
    const body = getBody();
    return {
      lastReadMessageId: body.lastReadMessageId || null,
      lastReadAt: body.lastReadAt || new Date().toISOString(),
      unreadCount: 0,
    };
  }

  const teamupChatMessagesMatch = url.pathname.match(/^\/circles\/([^/]+)\/teamups\/([^/]+)\/chat\/messages$/);
  if (teamupChatMessagesMatch) {
    const [, circleId, teamupId] = teamupChatMessagesMatch;
    const teamup = mockTeamups.find((item) => item.circleId === circleId && item.id === teamupId);
    if (!teamup) throw new Error('组队不存在');
    ensureMockTeamupChatOpen(teamup);

    if (method === 'GET') {
      const messages = (mockTeamupChatMessages[teamupId] || [])
        .slice()
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
        .map(serializeMockTeamupChatMessage);
      return { messages, hasMore: false, nextBefore: null };
    }

    if (method === 'POST') {
      const body = getBody();
      const now = new Date().toISOString();
      const message: MockChatMessage = {
        id: mockId('mock-teamup-chat'),
        circleId,
        teamupId,
        senderId: MOCK_CURRENT_USER_ID,
        clientMessageId: String(body.clientMessageId || mockId('mock-client-message')),
        content: String(body.content || '').trim(),
        mentions: Array.isArray(body.mentions) ? body.mentions : [],
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      mockTeamupChatMessages[teamupId] = [...(mockTeamupChatMessages[teamupId] || []), message];
      return { message: serializeMockTeamupChatMessage(message) };
    }
  }

  const teamupChatDeleteMatch = url.pathname.match(/^\/circles\/([^/]+)\/teamups\/([^/]+)\/chat\/messages\/([^/]+)$/);
  if (teamupChatDeleteMatch && method === 'DELETE') {
    const [, circleId, teamupId, messageId] = teamupChatDeleteMatch;
    const teamup = mockTeamups.find((item) => item.circleId === circleId && item.id === teamupId);
    if (!teamup) throw new Error('组队不存在');
    ensureMockTeamupChatOpen(teamup);
    const message = (mockTeamupChatMessages[teamupId] || []).find((item) => item.id === messageId);
    if (!message) throw new Error('消息不存在');
    if (message.senderId !== MOCK_CURRENT_USER_ID) throw new Error('只能删除自己发送的消息');
    message.deletedAt = new Date().toISOString();
    message.updatedAt = message.deletedAt;
    return { message: '消息已删除', messageId, circleId, teamupId };
  }

  const teamupChatReadStateMatch = url.pathname.match(/^\/circles\/([^/]+)\/teamups\/([^/]+)\/chat\/read-state$/);
  if (teamupChatReadStateMatch && method === 'PUT') {
    const [, circleId, teamupId] = teamupChatReadStateMatch;
    const teamup = mockTeamups.find((item) => item.circleId === circleId && item.id === teamupId);
    if (!teamup) throw new Error('组队不存在');
    ensureMockTeamupChatOpen(teamup);
    const body = getBody();
    return {
      lastReadMessageId: body.lastReadMessageId || null,
      lastReadAt: body.lastReadAt || new Date().toISOString(),
      unreadCount: 0,
    };
  }

  const teamupDetailMatch = url.pathname.match(/^\/circles\/([^/]+)\/teamups\/([^/]+)$/);
  if (teamupDetailMatch && method === 'GET') {
    const [, circleId, teamupId] = teamupDetailMatch;
    const teamup = mockTeamups.find((item) => item.circleId === circleId && item.id === teamupId);
    if (!teamup) throw new Error('组队不存在');
    return { teamup: serializeMockTeamup(teamup) };
  }

  if (url.pathname === '/survey/questions' && method === 'GET') {
    return {
      version: '4.0',
      changedQuestionIds: [
        'q_must_align', 'q_my_pace', 'q_physical_pace', 'q32', 'q_spend_mode_imp', 'q_rel_mode',
        'q_height', 'q_height_range', 'q_ball_sport', 'q_read_type', 'q_novel_type', 'q61', 'q4', 'q6', 'q8',
        'q_top_interest', 'q_date_content', 'q_weekend_date', 'q_sp_self', 'q_ph_self', 'q_ph_prio', 'q_work_style',
        'q_mv_type', 'q_mv_media', 'q_mv_together',
        'q_bg_type', 'q_bg_prio',
        'q_acg_contact', 'q_acg_together',
        'q_ph_direction', 'q_ph_prio',
        'q_fd_type', 'q_fd_prio',
        'q_tr_type', 'q_tr_style',
        'q_sp_type', 'q_sp_partner',
        'q_gm_platform', 'q_gm_genre', 'q_gm_mobile', 'q_gm_pc', 'q_gm_switch', 'q_gm_self', 'q_gm_partner',
        'q_music_style',
        'q10', 'q_drink_freq', 'q_drink_pref', 'q_pet_like', 'q_pet_partner',
        'q_schedule_imp', 'q_free_time', 'q_spend_style', 'q_spend_imp', 'q32', 'q_spend_mode_imp',
        'q37', 'q38',
        'q_rel_mode', 'q_my_pace', 'q_partner_pace',
        'q_atmosphere', 'q_conflict_self', 'q_conflict_partner', 'q_support_pref',
        'q_reply_speed', 'q_reply_pref', 'q41', 'q36', 'q_affection_need', 'q_physical_pace',
        'q_rel_history', 'q_history_imp', 'q50', 'q44', 'q47', 'q48', 'q49', 'q_keep_space', 'q_red_flags',
        'q57', 'q58',
        'q21', 'q27', 'q24', 'q25', 'q33', 'q26', 'q28', 'q30', 'q_work_style',
        'q_future_base', 'q_future_base_imp', 'q_growth_env', 'q_family_econ',
        'q31', 'q29', 'q_partner_qualities', 'q60', 'q_must_align',
      ],
      sections: [
        { id: 'basics', title: '基础信息', description: '硬性条件与基础偏好', questions: MOCK_QUESTION_SECTIONS.filter(q => q.section === 'basics') },
        { id: 'interests', title: '兴趣爱好', description: '核心爱好与理想约会', questions: MOCK_QUESTION_SECTIONS.filter(q => q.section === 'interests') },
        { id: 'lifestyle', title: '生活习惯', description: '日常节奏与现实兼容', questions: MOCK_QUESTION_SECTIONS.filter(q => q.section === 'lifestyle') },
        { id: 'communication', title: '相处沟通', description: '恋爱节奏、交流方式与陪伴需求', questions: MOCK_QUESTION_SECTIONS.filter(q => q.section === 'communication') },
        { id: 'boundary', title: '边界安全感', description: '信任、空间与底线', questions: MOCK_QUESTION_SECTIONS.filter(q => q.section === 'boundary') },
        { id: 'values', title: '价值观', description: '人生观、金钱观与未来规划', questions: MOCK_QUESTION_SECTIONS.filter(q => q.section === 'values') }
      ],
    };
  }

  if (url.pathname === '/survey/submit' && method === 'POST') {
    return { message: 'Survey submitted successfully (mock)', surveyComplete: true };
  }

  if (url.pathname === '/survey/answers' && method === 'GET') {
    return {
      version: MOCK_SURVEY_VERSION,
      answers: MOCK_SURVEY_ANSWERS
    };
  }

  if (url.pathname === '/match/current' && method === 'GET') {
    if (mockCurrentMatchIsHeartbox) {
      return {
        status: 'REVEALED',
        message: '双向奔赴',
        match: {
          matchId: 'mock-heartbox-match',
          source: 'heartbox',
          specialLabel: '双向奔赴',
          scoreVisible: false,
          compatibilityScore: 0.75,
          partner: {
            nickname: '小南',
            gender: 'female',
            department: '人工智能学院',
            grade: '2022',
            campus: '仙林',
            mbti: 'INFJ',
            bio: '一起散步、一起喝咖啡。',
            avatarUrl: null,
          },
          insights: {
            overallPercent: 75,
            dimensions: { values: 0.74, lifestyle: 0.76, emotional: 0.75 },
            dimensionInsights: [],
            sharedInterests: ['散步', '咖啡'],
            curatorNote: '这是一次彼此主动选择的连接。',
          },
          myAction: 'ACCEPT',
          partnerActed: true,
        },
      };
    }
    const matchState = url.searchParams.get('state') === 'expired' ? 'expired' : getPageMockMatchState();

    if (matchState === 'expired') {
      return {
        status: 'EXPIRED',
        message: '本期匹配已过期，下周再试',
        nextRevealAt: '2026-03-25T20:00:00+08:00',
        match: {
          matchId: 'mock-expired-match',
          compatibilityScore: 0.78,
          partner: {
            id: 'u1',
            nickname: 'outsider',
            gender: 'male',
            department: '数字经济与管理学院',
            grade: '大二',
            campus: '苏州',
            mbti: 'INFP',
            bio: '喜欢游戏和电影，希望能找到志同道合的另一半。看重互相提供的情绪价值。',
            avatarUrl: null,
          },
          insights: {
            overallPercent: 78,
            dimensions: { values: 0.77, lifestyle: 0.79, emotional: 0.78 },
            dimensionInsights: [
              {
                dimension: 'values',
                label: '价值共鸣',
                score: 0.77,
                text: '底层逻辑相近的两个人，很多话不需要说完，对方就已经明白了。',
              },
              {
                dimension: 'lifestyle',
                label: '生活方式',
                score: 0.79,
                text: '同校区的距离，让日常的交集少了很多门槛，见面这件事变得格外轻松。',
              },
              {
                dimension: 'emotional',
                label: '情感风格',
                score: 0.78,
                text: '感受爱的方式高度相似，不需要太多翻译，就能被对方好好接住。',
              },
            ],
            sharedInterests: ['esports_games', 'movies_series', 'travel_citywalk'],
            curatorNote: '你们都在苏州，又都喜欢游戏——不如找个周末去附近网吧打打游戏，再沿着太湖走走，说不定有意外的收获。',
          },
          myAction: null,
          partnerActed: false,
        }
      };
    }

    return {
      status: 'REVEALED',
      message: '锦书已送达',
      match: {
        matchId: 'mock-curr-match',
        source: 'weekly',
        specialLabel: null,
        scoreVisible: true,
        compatibilityScore: 0.78,
        partner: {
          id: 'u1',
          nickname: 'outsider',
          gender: 'male',
          department: '数字经济与管理学院',
          grade: '大二',
          campus: '苏州',
          mbti: 'INFP',
          bio: '喜欢游戏和电影，希望能找到志同道合的另一半。看重互相提供的情绪价值。',
          avatarUrl: null,
        },
        insights: {
          overallPercent: 78,
          dimensions: { values: 0.77, lifestyle: 0.79, emotional: 0.78 },
          dimensionInsights: [
            {
              dimension: 'values',
              label: '价值共鸣',
              score: 0.77,
              text: '底层逻辑相近的两个人，很多话不需要说完，对方就已经明白了。',
            },
            {
              dimension: 'lifestyle',
              label: '生活方式',
              score: 0.79,
              text: '同校区的距离，让日常的交集少了很多门槛，见面这件事变得格外轻松。',
            },
            {
              dimension: 'emotional',
              label: '情感风格',
              score: 0.78,
              text: '感受爱的方式高度相似，不需要太多翻译，就能被对方好好接住。',
            },
          ],
          sharedInterests: ['esports_games', 'movies_series', 'travel_citywalk'],
          curatorNote: '你们都在苏州，又都喜欢游戏——不如找个周末去附近网吧打打游戏，再沿着太湖走走，说不定有意外的收获。',
        },
        myAction: null,
        partnerActed: true,
      }
    };
  }

  if (url.pathname === '/heartbox/me' && method === 'GET') {
    return {
      hasActiveSignal: !!mockHeartboxActiveMasked,
      cooldownUntil: mockHeartboxCooldownUntil,
      signal: mockHeartboxActiveMasked ? {
        targetStudentIdMasked: mockHeartboxActiveMasked,
        status: 'active',
        createdAt: mockHeartboxActiveCreatedAt || new Date().toISOString(),
      } : null,
      incomingHint: {
        hasIncoming: mockHeartboxHasIncoming,
        copy: mockHeartboxHasIncoming ? '有人悄悄心动了你' : '',
      },
      latestHeartboxMatch: mockLatestHeartboxMatch,
    };
  }

  if (url.pathname === '/heartbox/match/current' && method === 'GET') {
    if (!mockLatestHeartboxMatch || mockLatestHeartboxMatch.status !== 'active') {
      throw new Error('暂无可启封的心动信笺');
    }
    return {
      heartMatchId: mockLatestHeartboxMatch.id,
      status: 'active',
      specialLabel: '双向奔赴',
      createdAt: new Date().toISOString(),
      updatedAt: mockLatestHeartboxMatch.updatedAt,
      legacyMainMatchId: mockLatestHeartboxMatch.mainMatchId,
      partner: {
        id: 'mock-heartbox-partner',
        nickname: 'fly',
        gender: 'female',
        department: '软件学院',
        grade: '大二',
        campus: 'xianlin',
        mbti: 'INFP',
        bio: '喜欢散步、音乐和慢慢认识一个人。',
        avatarUrl: null,
      },
      partnerContact: {
        contactPlatform: 'wechat',
        contactId: 'heartbox-main-22',
      },
      note: '这是一次彼此主动选择的连接。双向成立后，系统已自动暂停双方主线匹配，给这段心意留出更安静的开始。',
    };
  }

  if (url.pathname === '/heartbox/signal' && method === 'POST') {
    if (mockHeartboxCooldownUntil && new Date(mockHeartboxCooldownUntil).getTime() > Date.now()) {
      const err: any = new Error('撤回后需等待 7 天才能再次投递');
      err.code = 'HEARTBOX_COOLDOWN';
      throw err;
    }
    if (!getMockStudentIdBound()) {
      const err: any = new Error('绑定学号后才能投递心动');
      err.code = 'STUDENT_ID_BIND_REQUIRED';
      throw err;
    }
    const targetStudentId = String(getBody().targetStudentId || '').trim();
    if (!/^(?:\d{9}|\d{12})$/.test(targetStudentId)) {
      throw new Error('请输入正确的学号');
    }
    mockHeartboxActiveMasked = `${targetStudentId.slice(0, 3)}****${targetStudentId.slice(-2)}`;
    mockHeartboxActiveCreatedAt = new Date().toISOString();

    if (targetStudentId === '221250001') {
      mockCurrentMatchIsHeartbox = false;
      mockHeartboxActiveMasked = null;
      mockIsParticipating = false;
      mockLatestHeartboxMatch = {
        id: 'mock-heartbox-match',
        status: 'active',
        mainMatchId: null,
        updatedAt: new Date().toISOString(),
      };
      return {
        success: true,
        status: 'matched',
        heartMatchId: 'mock-heartbox-match',
        source: 'heartbox',
        matchStatus: 'MUTUAL',
        scoreVisible: false,
        specialLabel: '双向奔赴',
      };
    }

    return { success: true, status: 'saved' };
  }

  if (url.pathname === '/heartbox/signal' && method === 'DELETE') {
    if (!mockHeartboxActiveMasked && mockLatestHeartboxMatch && ['queued', 'active'].includes(mockLatestHeartboxMatch.status)) {
      const err: any = new Error('双向心动已成立，无法撤回');
      err.code = 'HEARTBOX_MATCH_LOCKED';
      throw err;
    }
    if (!mockHeartboxActiveMasked) {
      return { success: true };
    }
    mockHeartboxActiveMasked = null;
    mockHeartboxActiveCreatedAt = null;
    mockHeartboxCooldownUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    return { success: true };
  }

  if (url.pathname === '/student-id/bind/status' && method === 'GET') {
    const bound = getMockStudentIdBound();
    const last4 = getMockStudentIdLast4();
    return {
      verified: bound,
      last4,
      source: bound ? 'canonical_email_otp' : null,
      mergedIntoUserId: null,
    };
  }

  if (url.pathname === '/student-id/bind/send-code' && method === 'POST') {
    const studentId = String(getBody().studentId || '').trim();
    if (!/^(?:\d{9}|\d{12})$/.test(studentId)) {
      throw new Error('请输入正确的学号');
    }
    return { success: true, expiresIn: 300 };
  }

  if (url.pathname === '/student-id/bind/verify' && method === 'POST') {
    const studentId = String(getBody().studentId || '').trim();
    const code = String(getBody().code || '').trim();
    if (!/^(?:\d{9}|\d{12})$/.test(studentId)) {
      throw new Error('请输入正确的学号');
    }
    if (!/^\d{6}$/.test(code)) {
      throw new Error('验证码错误或已过期');
    }
    setMockStudentIdBound(true);
    setMockStudentIdLast4(studentId.slice(-4));
    return { success: true, autoBound: false };
  }

  if (url.pathname === '/match/action' && method === 'POST') {
    return { action: getBody().action, message: 'Action recorded (mock)' };
  }

  if (url.pathname.startsWith('/match/result/') && method === 'GET') {
    if (url.pathname.endsWith('/mock-expired-match') || getPageMockMatchState() === 'expired') {
      return {
        status: 'EXPIRED',
        message: '本期匹配已过期，无法再做选择'
      };
    }

    return {
      status: 'MUTUAL',
      partnerContact: { wechatId: 'partner_wechat_456' },
      message: 'It\'s a match!'
    };
  }

  if (url.pathname.startsWith('/match/history') && method === 'GET') {
    return {
      total: 2,
      page: 1,
      matches: [
        {
          matchId: 'mock-match-41',
          weekOf: '2026-03-20',
          compatibilityScore: 0.88,
          status: 'MUTUAL',
          partner: {
            id: 'u41',
            nickname: '曾相识',
            department: '外语学院',
            avatarUrl: null
          }
        },
        {
          matchId: 'no-match-2026-03-13',
          weekOf: '2026-03-13',
          compatibilityScore: 0,
          status: 'NO_MATCH',
          partner: null
        }
      ]
    };
  }

  if (url.pathname === '/admin/trigger-matching' && method === 'POST') {
    return {
      message: '匹配完成 (mock)',
      stats: {
        totalParticipants: 128,
        matchedPairs: 60,
        unmatched: 8,
        matchRate: 0.94,
        avgCompatibilityScore: 0.83,
        weightLoss: 0.04,
      },
    };
  }

  if (url.pathname === '/admin/unlock-reveal' && method === 'POST') {
    return {
      message: '已解锁 60 对匹配 (mock)',
      unlockedCount: 60,
    };
  }

  if (url.pathname === '/admin/system' && method === 'GET') {
    return {
      nodeEnv: 'development',
      version: 'Mock Version',
      timezone: 'Asia/Shanghai',
      serverTime: new Date().toISOString(),
      uptime: 3600,
      nodeVersion: 'v20.x (Mock)',
      dbSize: '1.20 MB',
      memoryUsage: { rss: 102400000, heapUsed: 51200000, heapTotal: 102400000 },
      isLocked: false,
      tables: [
        { table: 'users', rows: 100 },
        { table: 'survey_answers', rows: 90 },
        { table: 'matches', rows: 45 },
        { table: 'circles', rows: 5 },
      ],
      cronJobs: [
        { name: 'survey_reminders_tue', schedule: '0 18 * * 2', timezone: 'Asia/Shanghai', nextRun: new Date().toISOString() },
        { name: 'matching_pipeline', schedule: '0 18 * * 3', timezone: 'Asia/Shanghai', nextRun: new Date().toISOString() }
      ],
      features: { email: true, matching: true }
    };
  }

  if (url.pathname === '/admin/ping' && method === 'GET') { return { ok: true }; } if (url.pathname === '/admin/mail-logs-stats' && method === 'GET') { return { stats: [ { weekOf: 'EVENT_36H', mailType: 'PROMO_EVENT_1', count: 1200 }, { weekOf: '2026-03-30', mailType: 'SURVEY_REMINDER', count: 50 } ] }; }
  if (url.pathname === '/admin/heartbox/signals' && method === 'GET') {
    const now = new Date();
    const rows = Array.from({ length: 12 }, (_, index) => {
      const status = index % 5 === 0 ? 'matched' : index % 4 === 0 ? 'cancelled' : 'active';
      const resolvedTarget = index % 3 === 0 ? null : {
        id: `mock-target-${index + 1}`,
        email: `target${index + 1}@smail.nju.edu.cn`,
        nickname: `目标用户${index + 1}`,
        studentIdLast4: String(1200 + index).slice(-4),
      };
      return {
        id: `mock-heart-signal-${index + 1}`,
        sender: {
          id: `mock-sender-${index + 1}`,
          email: `sender${index + 1}@smail.nju.edu.cn`,
          nickname: `投递用户${index + 1}`,
          studentIdLast4: String(2300 + index).slice(-4),
        },
        targetStudentIdMasked: `221****${String(index + 10).slice(-2)}`,
        resolvedTarget,
        status,
        createdAt: new Date(now.getTime() - index * 3600_000).toISOString(),
        updatedAt: new Date(now.getTime() - index * 1800_000).toISOString(),
        cancelledAt: status === 'cancelled' ? new Date(now.getTime() - index * 1800_000).toISOString() : null,
        matchedAt: status === 'matched' ? new Date(now.getTime() - index * 1800_000).toISOString() : null,
        heartMatch: status === 'matched' ? {
          id: `mock-heart-match-${index + 1}`,
          status: index % 2 === 0 ? 'active' : 'queued',
          mainMatchId: index % 2 === 0 ? `mock-main-heartbox-${index + 1}` : null,
          updatedAt: new Date(now.getTime() - index * 1800_000).toISOString(),
        } : null,
      };
    });
    return { total: rows.length, page: 1, limit: 20, signals: rows };
  }
  if (url.pathname === '/admin/stats' && method === 'GET') {
    return {
      totalUsers: 1024,
      deletedUsers: 36,
      activeUsers: 856,
      newUsersThisWeek: 42,
      profileComplete: 980,
      surveyComplete: 890,
      surveyOutdated: 90,
      matchingUsers: 800,
      weekOf: '2026-03-30',
      weekMatches: 420,
      weekCuratorNotesDone: 420,
      weekMutual: 156,
      totalMutual: 2304,
      weekMaxScore: 0.96,
      weekMinScore: 0.61,
      weekTopSharedInterests: [
        { key: 'city_walk', count: 96 },
        { key: 'cafe_hop', count: 82 },
        { key: 'movies_series', count: 78 },
        { key: 'comedy', count: 66 },
        { key: 'food_exploring', count: 61 },
        { key: 'travel_citywalk', count: 58 },
        { key: 'music_listening', count: 55 },
        { key: 'romance', count: 47 },
        { key: 'random_explore', count: 43 },
        { key: 'documentary', count: 39 },
      ],
      weekTopSharedInterestCategories: [
        { key: 'travel_citywalk', count: 168 },
        { key: 'movies_series', count: 143 },
        { key: 'food_exploring', count: 107 },
        { key: 'music_listening', count: 98 },
        { key: 'gaming', count: 84 },
        { key: 'ball_sports', count: 73 },
        { key: 'reading_writing', count: 59 },
        { key: 'anime_acg', count: 48 },
        { key: 'photo_exhibitions', count: 42 },
        { key: 'boardgame_larp', count: 37 },
      ],
      weekTopSharedInterestDetails: [
        { key: 'city_walk', count: 96 },
        { key: 'cafe_hop', count: 82 },
        { key: 'movies_series', count: 78 },
        { key: 'comedy', count: 66 },
        { key: 'food_exploring', count: 61 },
        { key: 'travel_citywalk', count: 58 },
        { key: 'music_listening', count: 55 },
        { key: 'romance', count: 47 },
        { key: 'random_explore', count: 43 },
        { key: 'documentary', count: 39 },
      ],
      totalTopSharedInterests: [
        { key: 'movies_series', count: 428 },
        { key: 'city_walk', count: 403 },
        { key: 'music_listening', count: 392 },
        { key: 'food_exploring', count: 361 },
        { key: 'travel_citywalk', count: 338 },
        { key: 'comedy', count: 321 },
        { key: 'cafe_hop', count: 305 },
        { key: 'romance', count: 288 },
        { key: 'documentary', count: 241 },
        { key: 'random_explore', count: 226 },
      ],
      totalTopSharedInterestCategories: [
        { key: 'movies_series', count: 861 },
        { key: 'travel_citywalk', count: 824 },
        { key: 'gaming', count: 690 },
        { key: 'music_listening', count: 655 },
        { key: 'food_exploring', count: 612 },
        { key: 'ball_sports', count: 431 },
        { key: 'reading_writing', count: 398 },
        { key: 'anime_acg', count: 324 },
        { key: 'photo_exhibitions', count: 302 },
        { key: 'boardgame_larp', count: 281 },
      ],
      totalTopSharedInterestDetails: [
        { key: 'movies_series', count: 428 },
        { key: 'city_walk', count: 403 },
        { key: 'music_listening', count: 392 },
        { key: 'food_exploring', count: 361 },
        { key: 'travel_citywalk', count: 338 },
        { key: 'comedy', count: 321 },
        { key: 'cafe_hop', count: 305 },
        { key: 'romance', count: 288 },
        { key: 'documentary', count: 241 },
        { key: 'random_explore', count: 226 },
      ],
      heartbox: {
        boundUsers: 612,
        cooldownUsers: 18,
        signalsTotal: 386,
        signalsThisWeek: 74,
        uniqueSenders: 241,
        uniqueSendersThisWeek: 58,
        activeSignals: 169,
        resolvedActiveSignals: 112,
        unresolvedActiveSignals: 57,
        signalStatusBreakdown: { active: 169, matched: 86, cancelled: 121, expired: 10, suppressed: 0 },
        matchesTotal: 43,
        matchesThisWeek: 11,
        matchesActive: 28,
        matchesQueued: 9,
        matchesDismissed: 4,
        matchesBlocked: 2,
        matchStatusBreakdown: { active: 28, queued: 9, dismissed: 4, blocked: 2 },
        mainMatchesTotal: 34,
        mainMatchesThisWeek: 8,
        mainMutualTotal: 34,
        mutualEmailsSent: 68,
      },
      genderBreakdown: { male: 480, female: 520, unknown: 24 },
      campusBreakdown: { xianlin: 650, gulou: 350, other: 24 },
      gradeBreakdown: { '本科生': 500, '硕士生': 450, '博士生': 50, '其他': 24 },
      departmentBreakdown: { '计算机科学与技术系': 200, '软件学院': 150, '商学院': 120, '文学院': 80, '人工智能学院': 100, '其他': 374 },
      intentionBreakdown: { partner: 560, friend: 220, unknown: 20 },
      activeGenderBreakdown: { male: 380, female: 410, unknown: 10 },
      activeCampusBreakdown: { xianlin: 510, gulou: 280, other: 10 },
      activeGradeBreakdown: { '本科生': 400, '硕士生': 360, '博士生': 35, '其他': 5 },
      activeDepartmentBreakdown: { '计算机科学与技术系': 160, '软件学院': 120, '商学院': 90, '文学院': 70, '人工智能学院': 80, '其他': 280 },
      isLocked: false
    };
  }

  if (url.pathname === '/admin/email-test' && method === 'POST') {
    const body = getBody();
    return {
      message: `测试邮件 (${body.type || 'unknown'}) 已发送至 ${body.to || 'test@example.com'}`,
    };
  }

  if (url.pathname === '/admin/survey-reminder/preview' && method === 'GET') {
    return {
      total: 18,
      withEmailEnabled: 15,
      users: [
        { id: '1', email: 'pending1@example.com', createdAt: new Date().toISOString() },
        { id: '2', email: 'pending2@example.com', createdAt: new Date(Date.now() - 86400000).toISOString() }
      ]
    };
  }

  if (url.pathname === '/admin/survey-reminder/send' && method === 'POST') {
    return {
      message: '提醒发送完成',
      stats: { sent: 15, skipped: 3, failed: 0 }
    };
  }

  if (url.pathname === '/admin/matches/weekly-stats' && method === 'GET') {
    return {
      weeks: [
        { weekOf: '2026-03-30', total: 420, mutual: 156, missed: 60, revealed: 300, locked: 120, avgScore: 0.88 },
        { weekOf: '2026-03-23', total: 410, mutual: 148, missed: 55, revealed: 290, locked: 120, avgScore: 0.86 },
        { weekOf: '2026-03-16', total: 395, mutual: 142, missed: 50, revealed: 280, locked: 105, avgScore: 0.85 },
        { weekOf: '2026-03-09', total: 380, mutual: 135, missed: 48, revealed: 275, locked: 100, avgScore: 0.84 },
        { weekOf: '2026-03-02', total: 360, mutual: 120, missed: 40, revealed: 250, locked: 85, avgScore: 0.83 },
      ]
    };
  }

  if (url.pathname === '/admin/matches' && method === 'GET') {
    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') || 20)));
    const weekOf = url.searchParams.get('weekOf') || '';
    const status = url.searchParams.get('status') || 'all';
    const sortBy = url.searchParams.get('sortBy') || 'score';
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';
    const rows = Array.from({ length: 36 }, (_, index) => {
      const weeks = ['2026-03-30', '2026-03-23', '2026-03-16'];
      const statuses = ['MUTUAL', 'REVEALED', 'MISSED', 'EXPIRED', 'LOCKED'];
      return {
        id: `mock-admin-match-${index + 1}`,
        weekOf: weeks[index % weeks.length],
        userAId: `mock-user-a-${index + 1}`,
        userBId: `mock-user-b-${index + 1}`,
        score: Math.round((0.62 + (index % 16) * 0.021) * 1000) / 1000,
        status: statuses[index % statuses.length],
        userAAction: index % 3 === 0 ? 'ACCEPT' : index % 3 === 1 ? 'REJECT' : null,
        userBAction: index % 4 === 0 ? 'ACCEPT' : index % 4 === 1 ? 'REJECT' : null,
        createdAt: new Date(Date.now() - index * 3600000).toISOString(),
        dimensions: JSON.stringify({ lifestyle: 0.8, communication: 0.78, boundary: 0.72, values: 0.81 }),
        curatorNote: 'Mock curator note',
      };
    })
      .filter((item) => !weekOf || item.weekOf === weekOf)
      .filter((item) => status === 'all' || item.status === status)
      .sort((a, b) => {
        const direction = sortOrder === 'asc' ? 1 : -1;
        const aValue = sortBy === 'score' ? a.score : sortBy === 'weekOf' ? a.weekOf : sortBy === 'status' ? a.status : a.createdAt;
        const bValue = sortBy === 'score' ? b.score : sortBy === 'weekOf' ? b.weekOf : sortBy === 'status' ? b.status : b.createdAt;
        return aValue > bValue ? direction : aValue < bValue ? -direction : 0;
      });
    const start = (page - 1) * limit;
    return {
      total: rows.length,
      page,
      limit,
      sortBy,
      sortOrder,
      matches: rows.slice(start, start + limit),
    };
  }

  if (url.pathname === '/admin/reports' && method === 'GET') {
    const status = url.searchParams.get('status') || 'pending';
    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') || 20)));
    const filtered = status === 'all' ? mockReports : mockReports.filter((item) => item.status === status);
    const start = (page - 1) * limit;
    return {
      total: filtered.length,
      page,
      limit,
      reports: filtered.slice(start, start + limit),
    };
  }

  const adminReportMatch = url.pathname.match(/^\/admin\/reports\/([^/]+)$/);
  if (adminReportMatch && method === 'PATCH') {
    const [, reportId] = adminReportMatch;
    const body = getBody();
    const idx = mockReports.findIndex((item) => item.id === reportId);
    if (idx < 0) throw new Error('Report not found');
    // request_evidence 不改状态，只发邮件给举报人
    if (body.status === 'request_evidence') {
      const notifications = { reporter: '已发送补充材料请求邮件', reported: '未触发' };
      return { message: '已向举报人发送补充材料请求邮件', report: mockReports[idx], notifications };
    }
    const next = {
      ...mockReports[idx],
      status: body.status,
      adminNote: body.adminNote ?? mockReports[idx].adminNote ?? null,
    };
    mockReports[idx] = next;
    const actionLabels: Record<string, string> = { reviewed: '已发送处理结果邮件', warn_update: '已发送资料更新提醒', dismissed: '已发送关闭通知' };
    const notifications: Record<string, string> = { reporter: actionLabels[body.status] || '已处理' };
    if (body.status === 'reviewed' || body.status === 'warn_update') notifications.reported = body.status === 'reviewed' ? '已发送行为提醒邮件' : '已发送资料更新提醒邮件';
    return {
      message: '举报已处理',
      report: next,
      creditChanged: body.status === 'reviewed',
      creditScoreAfter: body.status === 'reviewed' ? 97 : null,
      penaltyScore: body.status === 'reviewed' ? (body.penaltyScore ?? 1) : null,
      notifications,
    };
  }

  if (url.pathname === '/admin/forum/reports' && method === 'GET') {
    const status = url.searchParams.get('status') || 'pending';
    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') || 20)));
    const filtered = status === 'all' ? mockReports : mockReports.filter((item) => (
      status === 'approved' ? item.status === 'reviewed' : status === 'rejected' ? item.status === 'dismissed' : item.status === 'pending'
    ));
    const reports = filtered.map((item) => ({
      id: item.id,
      reporterId: item.reporterId,
      reporterNickname: null,
      reportedUserId: item.reportedId,
      targetType: 'post',
      postId: `mock-post-${item.reportedId}`,
      commentId: null,
      reason: item.reason,
      detail: item.detail,
      status: item.status === 'reviewed' ? 'approved' : item.status === 'dismissed' ? 'rejected' : 'pending',
      adminNote: item.adminNote ?? null,
      reviewedAt: null,
      createdAt: item.createdAt,
    }));
    const start = (page - 1) * limit;
    return { total: reports.length, page, limit, reports: reports.slice(start, start + limit) };
  }

  const adminForumReportMatch = url.pathname.match(/^\/admin\/forum\/reports\/([^/]+)$/);
  if (adminForumReportMatch && method === 'PATCH') {
    const body = getBody();
    return {
      message: body.action === 'approve' ? '举报已通过并完成信用分处理' : '举报已驳回',
      creditChanged: body.action === 'approve',
      creditScoreAfter: body.action === 'approve' ? 99 : null,
      penaltyScore: body.action === 'approve' ? (body.penaltyScore ?? 1) : null,
    };
  }

  if (url.pathname === '/admin/forum/credit-users' && method === 'GET') {
    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') || 20)));
    const users = Array.from({ length: 32 }, (_, i) => ({
      userId: `mock-user-${i + 1}`,
      nickname: `用户${i + 1}`,
      email: `u${i + 1}@example.com`,
      creditScore: Math.max(0, 100 - i * 2),
      creditLevel: i > 25 ? 'banned' : i > 15 ? 'limited' : 'normal',
      latestApprovedAt: i < 20 ? new Date(Date.now() - i * 86400000).toISOString() : null,
      approvedReportCount: i < 20 ? Math.max(1, Math.floor((20 - i) / 4)) : 0,
      totalReportCount: i < 20 ? Math.max(1, Math.floor((20 - i) / 3)) : 0,
    }));
    const start = (page - 1) * limit;
    return { total: users.length, page, limit, users: users.slice(start, start + limit) };
  }

  const adminForumCreditReportsMatch = url.pathname.match(/^\/admin\/forum\/credit-users\/([^/]+)\/reports$/);
  if (adminForumCreditReportsMatch && method === 'GET') {
    const [, userId] = adminForumCreditReportsMatch;
    const now = Date.now();
    const reports = [
      {
        id: `fr-pending-${userId}-1`,
        reporterId: 'mock-user-a',
        reporterNickname: '举报人A',
        targetType: 'comment',
        postId: null,
        commentId: `c-${userId}-1`,
        reportedUserId: userId,
        reason: 'spam',
        detail: null,
        status: 'pending',
        adminNote: null,
        reviewedAt: null,
        createdAt: new Date(now - 2 * 3600000).toISOString(),
      },
      {
        id: `fr-rejected-${userId}-1`,
        reporterId: 'mock-user-b',
        reporterNickname: '举报人B',
        targetType: 'post',
        postId: `p-${userId}-1`,
        commentId: null,
        reportedUserId: userId,
        reason: 'other',
        detail: null,
        status: 'rejected',
        adminNote: '证据不足',
        reviewedAt: new Date(now - 12 * 3600000).toISOString(),
        createdAt: new Date(now - 24 * 3600000).toISOString(),
      },
      {
        id: `fr-approved-${userId}-1`,
        reporterId: 'mock-user-c',
        reporterNickname: '举报人C',
        targetType: 'post',
        postId: `p-${userId}-2`,
        commentId: null,
        reportedUserId: userId,
        reason: 'harassment,spam',
        detail: null,
        status: 'approved',
        adminNote: null,
        reviewedAt: new Date(now - 48 * 3600000).toISOString(),
        createdAt: new Date(now - 50 * 3600000).toISOString(),
      },
    ];
    return { reports };
  }

  if (url.pathname === '/admin/survey-update/preview' && method === 'GET') {
    return {
      total: 12,
      withEmailEnabled: 10,
      users: [
        { id: '1', email: 'legacy1@example.com' },
        { id: '2', email: 'legacy2@example.com' }
      ]
    };
  }

  if (url.pathname === '/admin/survey-update/send' && method === 'POST') {
    return {
      message: '问卷更新提醒邮件分发结束',
      stats: { sent: 10, skipped: 2, failed: 0 }
    };
  }

  if (url.pathname === '/admin/circles' && method === 'GET') {
    return { circles: mockAdminCircles };
  }

  if (url.pathname === '/admin/circles' && method === 'POST') {
    const body = getBody();
    const tags = Array.isArray(body.tags)
      ? body.tags.filter((item: unknown): item is string => typeof item === 'string').map((item: string) => item.trim()).filter(Boolean).slice(0, 3)
      : (body.tag ? [String(body.tag).trim()].filter(Boolean) : []);
    const status = typeof body.status === 'string' && body.status.trim() ? body.status.trim() : 'active';
    const circle = {
      id: `c${Date.now()}`,
      name: body.name,
      slug: body.slug,
      description: body.description || '',
      category: body.category,
      tag: tags[0] || body.tag || '',
      tags,
      iconUrl: body.iconUrl || '',
      creatorId: body.creatorId ?? null,
	      memberCount: 0,
	      isActive: status === 'active',
	      status,
	      reviewNote: status === 'rejected' ? body.reviewNote || '' : null,
	      reviewedBy: null,
	      reviewedAt: status === 'rejected' ? new Date().toISOString() : null,
	      createdAt: new Date().toISOString(),
	    };
    mockAdminCircles = [circle, ...mockAdminCircles];
    return { message: '圈子已创建', circle };
  }

  const circleUpdateMatch = url.pathname.match(/^\/admin\/circles\/([^/]+)$/);
  if (circleUpdateMatch && method === 'PUT') {
    const [, circleId] = circleUpdateMatch;
    const body = getBody();
    const tags = Array.isArray(body.tags)
      ? body.tags.filter((item: unknown): item is string => typeof item === 'string').map((item: string) => item.trim()).filter(Boolean).slice(0, 3)
      : undefined;
    let updatedCircle: any = null;
    mockAdminCircles = mockAdminCircles.map((circle) => {
      if (circle.id !== circleId) return circle;
      const nextTags = tags ?? (body.tag !== undefined ? [String(body.tag).trim()].filter(Boolean) : (circle.tags ?? (circle.tag ? [circle.tag] : [])));
	      const nextStatus = typeof body.status === 'string' && body.status.trim()
	        ? body.status.trim()
	        : (circle.status ?? (circle.isActive ? 'active' : 'inactive'));
	      const previousStatus = circle.status ?? (circle.isActive ? 'active' : 'inactive');
	      const statusChanged = nextStatus !== previousStatus;
	      updatedCircle = {
	        ...circle,
	        name: body.name ?? circle.name,
	        slug: body.slug ?? circle.slug,
	        description: body.description ?? circle.description ?? '',
	        category: body.category ?? circle.category,
	        tag: nextTags[0] || body.tag || '',
	        tags: nextTags,
	        iconUrl: body.iconUrl ?? circle.iconUrl ?? '',
	        creatorId: body.creatorId ?? circle.creatorId ?? null,
	        status: nextStatus,
	        isActive: nextStatus === 'active',
	        reviewNote: body.reviewNote !== undefined
	          ? body.reviewNote
	          : statusChanged && nextStatus === 'active'
	            ? null
	            : circle.reviewNote ?? null,
	        reviewedBy: statusChanged && (nextStatus === 'active' || nextStatus === 'rejected') ? null : circle.reviewedBy ?? null,
	        reviewedAt: statusChanged && (nextStatus === 'active' || nextStatus === 'rejected') ? new Date().toISOString() : circle.reviewedAt ?? null,
	      };
      return updatedCircle;
    });
    if (!updatedCircle) throw new Error('圈子不存在');
    return { message: '圈子已更新', circle: updatedCircle };
  }

  const circleActiveMatch = url.pathname.match(/^\/admin\/circles\/([^/]+)\/active$/);
  if (circleActiveMatch && method === 'PATCH') {
    const [, circleId] = circleActiveMatch;
    const body = getBody();
    let updatedCircle: any = null;
    mockAdminCircles = mockAdminCircles.map((circle) => {
      if (circle.id !== circleId) return circle;
	      updatedCircle = {
	        ...circle,
	        isActive: Boolean(body.isActive),
	        status: Boolean(body.isActive) ? 'active' : 'inactive',
	        reviewNote: Boolean(body.isActive) ? null : circle.reviewNote ?? null,
	        reviewedBy: Boolean(body.isActive) ? null : circle.reviewedBy ?? null,
	        reviewedAt: Boolean(body.isActive) ? new Date().toISOString() : circle.reviewedAt ?? null,
	      };
      return updatedCircle;
    });
    if (!updatedCircle) throw new Error('圈子不存在');
    return { message: updatedCircle.isActive ? '已上架' : '已下架', circle: updatedCircle };
  }

  console.warn(`[Mock] Unhandled request: ${method} ${path}`);
  throw new Error(`[Mock] unhandled route ${method} ${path}`);
}
