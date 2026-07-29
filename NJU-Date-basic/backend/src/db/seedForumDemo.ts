import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { sql } from 'drizzle-orm';
import { db, queryClient } from './connection.js';
import { runMigrations } from './migrate.js';
import {
  auditLogs,
  broadcastTasks,
  circleChatMessages,
  circleChatReadStates,
  circleJoinRequests,
  circleMemberLocationCooldowns,
  circleMemberLocations,
  circleMemberRoles,
  circleMembers,
  circles,
  contactUnlockGrants,
  contactUnlockRequests,
  creditScoreLogs,
  directMessageConversations,
  directMessages,
  forumAnnouncements,
  forumCommentHides,
  forumCommentLikes,
  forumComments,
  forumGuestbookMessages,
  forumPollOptions,
  forumPollVotes,
  forumPostFavorites,
  forumPostImages,
  forumPostLikes,
  forumPostViews,
  forumPosts,
  forumReports,
  friendRequests,
  friendships,
  globalFriendships,
  heartMatches,
  heartSignals,
  mailLogs,
  matches,
  notifications,
  otpCodes,
  surveyAnswers,
  teamupApplications,
  teamupChatMessages,
  teamupChatReadStates,
  teamupMemberContacts,
  teamupMembers,
  teamups,
  userBaseCards,
  userBlocks,
  userCardPreferences,
  userCards,
  userCircleCards,
  userCircleContacts,
  userCircleCustomCards,
  userFollows,
  userMessageSettings,
  userNotifications,
  userReports,
  users,
} from './schema.js';

const DEMO_PASSWORD = 'NJUdate2026!';
const now = new Date();
const iso = (daysAgo: number, hoursAgo = 0) =>
  new Date(now.getTime() - (daysAgo * 24 + hoursAgo) * 60 * 60 * 1000).toISOString();
const future = (days: number, hours = 0) =>
  new Date(now.getTime() + (days * 24 + hours) * 60 * 60 * 1000).toISOString();

type ForumType = 'general' | 'squad' | 'help' | 'trade' | 'activity';

type DemoPerson = {
  key: string;
  email: string;
  nickname: string;
  gender: 'male' | 'female';
  genderPref: 'male' | 'female' | 'any';
  intention: 'friend' | 'partner';
  grade: string;
  campus: string;
  department: string;
  mbti: string;
  bio: string;
  signature: string;
  tags: string[];
};

type PostSeed = {
  key: string;
  author: string;
  title: string;
  content: string;
  summary: string;
  type: ForumType;
  isPinned: boolean;
  isAnonymous: boolean;
  createdAt: string;
  hotScore: number;
  imageCount: number;
  poll?: string[];
};

const PEOPLE: DemoPerson[] = [
  {
    key: 'linxi',
    email: 'linxi@smail.nju.edu.cn',
    nickname: '林溪',
    gender: 'female',
    genderPref: 'any',
    intention: 'friend',
    grade: '2022',
    campus: 'xianlin',
    department: '新闻传播学院',
    mbti: 'ENFP',
    bio: '喜欢在傍晚从仙林湖走回宿舍，最近在练胶片和手冲。',
    signature: '周末想找人一起 citywalk。',
    tags: ['摄影', '咖啡', 'citywalk'],
  },
  {
    key: 'muyang',
    email: 'muyang@smail.nju.edu.cn',
    nickname: '沐阳',
    gender: 'male',
    genderPref: 'female',
    intention: 'partner',
    grade: '2021',
    campus: 'gulou',
    department: '计算机科学与技术系',
    mbti: 'INTJ',
    bio: '白天写代码，晚上跑步。对好吃的食堂窗口有执念。',
    signature: '今天也要把 TODO 变短一点。',
    tags: ['跑步', '编程', '粤语歌'],
  },
  {
    key: 'xiaoyu',
    email: 'xiaoyu@smail.nju.edu.cn',
    nickname: '小雨',
    gender: 'female',
    genderPref: 'male',
    intention: 'partner',
    grade: '2023',
    campus: 'xianlin',
    department: '生命科学学院',
    mbti: 'INFJ',
    bio: '实验结束后会去操场散步，正在补宫崎骏和阿加莎。',
    signature: '慢慢来，比较快。',
    tags: ['电影', '阅读', '散步'],
  },
  {
    key: 'chenyi',
    email: 'chenyi@smail.nju.edu.cn',
    nickname: '陈一',
    gender: 'male',
    genderPref: 'any',
    intention: 'friend',
    grade: '2020',
    campus: 'suzhou',
    department: '人工智能学院',
    mbti: 'ENTP',
    bio: '桌游、羽毛球、深夜食堂爱好者，常年缺一个搭子。',
    signature: '少一点尴尬，多一点开局。',
    tags: ['桌游', '羽毛球', '夜宵'],
  },
  {
    key: 'suhe',
    email: 'suhe@smail.nju.edu.cn',
    nickname: '苏荷',
    gender: 'female',
    genderPref: 'any',
    intention: 'friend',
    grade: '2024',
    campus: 'pukou',
    department: '外国语学院',
    mbti: 'ISFP',
    bio: '喜欢音乐现场和小剧场，偶尔写点不押韵的诗。',
    signature: '把日常过得像一首 B 面歌。',
    tags: ['live', '诗', '展览'],
  },
  {
    key: 'qingzhou',
    email: 'qingzhou@smail.nju.edu.cn',
    nickname: '青舟',
    gender: 'male',
    genderPref: 'female',
    intention: 'partner',
    grade: '2022',
    campus: 'xianlin',
    department: '商学院',
    mbti: 'ISTJ',
    bio: '会认真做攻略，也会认真迷路。周末常去爬紫金山。',
    signature: '稳定输出，偶尔浪漫。',
    tags: ['徒步', '理财', '做饭'],
  },
  {
    key: 'yueban',
    email: 'yueban@smail.nju.edu.cn',
    nickname: '月半',
    gender: 'female',
    genderPref: 'any',
    intention: 'friend',
    grade: '2021',
    campus: 'gulou',
    department: '历史学院',
    mbti: 'INFP',
    bio: '博物馆常驻人口，热爱给朋友拍头像。',
    signature: '有空一起去看展。',
    tags: ['博物馆', '猫咖', '头像摄影'],
  },
  {
    key: 'haoran',
    email: 'haoran@smail.nju.edu.cn',
    nickname: '皓然',
    gender: 'male',
    genderPref: 'any',
    intention: 'friend',
    grade: '2023',
    campus: 'xianlin',
    department: '物理学院',
    mbti: 'INTP',
    bio: '喜欢天文、冷知识和把复杂问题讲清楚。',
    signature: '今晚也许适合看星星。',
    tags: ['天文', '科普', '自习'],
  },
  {
    key: 'ningan',
    email: 'ningan@smail.nju.edu.cn',
    nickname: '宁安',
    gender: 'female',
    genderPref: 'male',
    intention: 'partner',
    grade: '2022',
    campus: 'gulou',
    department: '法学院',
    mbti: 'ESTJ',
    bio: '效率型选手，喜欢辩论、咖啡和周计划。',
    signature: '可以松弛，但先把ddl交了。',
    tags: ['辩论', '咖啡', '计划'],
  },
  {
    key: 'zimo',
    email: 'zimo@smail.nju.edu.cn',
    nickname: '子墨',
    gender: 'male',
    genderPref: 'female',
    intention: 'partner',
    grade: '2024',
    campus: 'xianlin',
    department: '软件学院',
    mbti: 'ISFJ',
    bio: '会修电脑，也会认真听人讲话。',
    signature: '把小事做好，日子会亮一点。',
    tags: ['修电脑', '动漫', '甜品'],
  },
  {
    key: 'wanqing',
    email: 'wanqing@smail.nju.edu.cn',
    nickname: '晚晴',
    gender: 'female',
    genderPref: 'any',
    intention: 'friend',
    grade: '2020',
    campus: 'xianlin',
    department: '地理与海洋科学学院',
    mbti: 'ENFJ',
    bio: '地图控，喜欢把校园边角都走一遍。',
    signature: '散步半径持续扩大中。',
    tags: ['地图', '徒步', '摄影'],
  },
  {
    key: 'kaichen',
    email: 'kaichen@smail.nju.edu.cn',
    nickname: '开辰',
    gender: 'male',
    genderPref: 'any',
    intention: 'friend',
    grade: '2021',
    campus: 'gulou',
    department: '数学系',
    mbti: 'ISTP',
    bio: '打球、刷题、偶尔做饭，话少但靠谱。',
    signature: '可约球，可约饭，可安静自习。',
    tags: ['篮球', '自习', '做饭'],
  },
  {
    key: 'ruoxi',
    email: 'ruoxi@smail.nju.edu.cn',
    nickname: '若曦',
    gender: 'female',
    genderPref: 'male',
    intention: 'partner',
    grade: '2023',
    campus: 'pukou',
    department: '医学院',
    mbti: 'INFJ',
    bio: '值班后喜欢吃热汤面，正在学拍植物。',
    signature: '希望生活可以温柔一点。',
    tags: ['医学', '植物', '热汤面'],
  },
  {
    key: 'jianing',
    email: 'jianing@smail.nju.edu.cn',
    nickname: '嘉宁',
    gender: 'male',
    genderPref: 'female',
    intention: 'partner',
    grade: '2022',
    campus: 'xianlin',
    department: '电子科学与工程学院',
    mbti: 'ENTJ',
    bio: '喜欢硬件、骑行和把计划排进日历。',
    signature: '周末想骑到江边。',
    tags: ['骑行', '硬件', '江边'],
  },
  {
    key: 'momo',
    email: 'momo@smail.nju.edu.cn',
    nickname: '末末',
    gender: 'female',
    genderPref: 'any',
    intention: 'friend',
    grade: '2024',
    campus: 'xianlin',
    department: '艺术学院',
    mbti: 'ESFP',
    bio: '画画、拍照、收集校园颜色。',
    signature: '今天也想把普通瞬间变好看。',
    tags: ['画画', '拍照', '配色'],
  },
  {
    key: 'shuyi',
    email: 'shuyi@smail.nju.edu.cn',
    nickname: '书亦',
    gender: 'male',
    genderPref: 'any',
    intention: 'friend',
    grade: '2021',
    campus: 'gulou',
    department: '文学院',
    mbti: 'INFP',
    bio: '读书、写字、逛旧书店，容易被好标题吸引。',
    signature: '可以沉默，也可以聊很久。',
    tags: ['旧书店', '写作', '电影'],
  },
  {
    key: 'admin',
    email: 'admin@smail.nju.edu.cn',
    nickname: '论坛管理员',
    gender: 'male',
    genderPref: 'any',
    intention: 'friend',
    grade: '2020',
    campus: 'xianlin',
    department: '平台运营组',
    mbti: 'ESTJ',
    bio: '负责维护论坛秩序和公告，演示时可用来查看治理链路。',
    signature: '愿社区有烟火气，也有边界感。',
    tags: ['治理', '公告', '反馈'],
  },
];

const IMAGE_POOL = [
  '/images/step1.jpg',
  '/images/step2.jpg',
  '/images/step3.jpg',
  '/images/login.jpg',
  '/images/hero-bg.jpg',
  '/images/hero-bg.webp',
  '/images/xhs-promo.png',
  '/images/297.png',
  '/images/297.webp',
  '/images/ti/quiz-crush.jpg',
  '/images/ti/campus-fox.jpg',
  '/images/ti/book-charm.jpg',
  '/images/ti/art-kid.jpg',
  '/images/ti/lab-cutie.jpg',
  '/images/ti/office-hour-angel.jpg',
  '/images/ti/hot-nerd.jpg',
  '/images/ti/brain-bae.jpg',
  '/images/ti/soft-spirit.jpg',
];

const POST_TEMPLATES: Record<ForumType, Array<{ title: string; summary: string; topic: string; poll?: string[] }>> = {
  general: [
    { title: '论坛演示指南：热榜、投票、留言板和举报都可以点一点', summary: '置顶说明本次只演示全站论坛，不含任何圈子入口数据。', topic: '这是一条置顶演示帖。所有内容都属于全站论坛，帖子不会挂到任何圈子下。' },
    { title: '今天的晚霞像打翻的橘子汽水', summary: '随手记录校园晚霞和路过的片刻。', topic: '从教学楼出来时天色刚好变亮，很多人都停下来拍照。' },
    { title: '大家会怎么处理突然空出来的一个晚上？', summary: '讨论意外空档的理想安排。', topic: '原本的组会取消了，突然多出一个晚上，想听听大家的松弛方案。', poll: ['去散步', '补觉', '看电影', '写作业'] },
    { title: '鼓楼和仙林的通勤时间到底怎么安排更舒服', summary: '跨校区上课通勤经验交流。', topic: '最近要跨校区跑几次课，想收集一些少折腾的时间安排。' },
    { title: '你最近听到最循环的一首歌是什么？', summary: '音乐分享帖，适合评论区互相安利。', topic: '耳机里重复播放的歌总能暴露最近的心情。', poll: ['华语', '欧美', '日语', '纯音乐'] },
    { title: '期末周前的精神状态打卡楼', summary: '期末前互相报平安的小楼。', topic: '欢迎把今天完成的一件小事写下来，给自己一点进度感。' },
    { title: '匿名问一句：第一次见网友搭子怎么开场不尴尬？', summary: '第一次线下见面开场求建议。', topic: '约了同校同学喝咖啡，但平时比较慢热，想听听自然一点的开场方式。', poll: ['聊课程', '聊兴趣', '先点单', '直接承认紧张'] },
    { title: '图书馆闭馆音乐响起时，大家通常在想什么', summary: '图书馆夜晚碎碎念。', topic: '每次听到闭馆提醒，都会突然意识到一天真的结束了。' },
    { title: '南大有哪些你想私藏但又想推荐的角落', summary: '校园角落推荐合集。', topic: '可以是长椅、窗边、树荫、走廊，也可以只是某个黄昏特别好看的拐角。' },
  ],
  squad: [
    { title: '今晚 8 点体育馆羽毛球缺一，水平随缘', summary: '娱乐局羽毛球临时缺一。', topic: '双打娱乐局，不嫌弃新手，也欢迎高手轻虐。打完可以顺路夜宵。' },
    { title: '周六下午想拼一个慢速 citywalk 小队', summary: '书店、街巷、咖啡的慢速散步。', topic: '路线很松，主要是拍照和聊天，不赶景点。' },
    { title: '有没有人一起去江边骑车，速度不卷', summary: '周末江边骑行搭子征集。', topic: '想从校园附近一路骑到江边，速度以能聊天为准。', poll: ['上午', '下午', '傍晚', '下次'] },
    { title: '找两个人拼桌游，今晚只玩轻策略', summary: '桌游轻松局招人。', topic: '想玩一点规则不太重的桌游，适合没玩过的人加入。' },
    { title: '明早操场慢跑 3 公里，有人互相监督吗', summary: '晨跑低强度约伴。', topic: '目标不是配速，是起床成功和跑完不放弃。' },
    { title: '想组一个周末自习搭子，两小时起步', summary: '安静自习互相监督。', topic: '可以只打招呼不聊天，结束后一起吃饭也行。', poll: ['图书馆', '院楼', '咖啡馆', '线上打卡'] },
    { title: '南门夜宵局缺一个能吃辣的人', summary: '夜宵拼桌轻松约。', topic: '想吃热乎的，地点可以商量，最好别太晚。' },
    { title: '有人想一起看电影再散步吗', summary: '电影搭子招募。', topic: '看完可以聊，也可以安静散步，不需要社交压力。' },
    { title: '周日想去博物馆，有没有同路人', summary: '展览搭子邀请。', topic: '节奏慢一点，能认真看展签，也能中途找地方坐。' },
  ],
  help: [
    { title: '求推荐适合赶 ddl 的安静自习角落', summary: '寻找仙林安静有插座的位置。', topic: '图书馆人有点多，想找晚上也比较安静、插座不紧张的地方。' },
    { title: '电脑突然连不上校园网，有没有排查思路', summary: '校园网故障求助。', topic: '手机可以连，电脑一直认证失败，已经重启过但没解决。' },
    { title: '请问跨校区上课中午怎么吃最省时间', summary: '跨校区午饭路线求建议。', topic: '中间只有一小时，想知道有没有靠谱的路线和窗口推荐。', poll: ['食堂打包', '便利店', '提前带饭', '直接跳过'] },
    { title: '实验报告排版有没有好用模板', summary: '报告模板和排版经验征集。', topic: '老师没给固定模板，但希望看起来规整一点。' },
    { title: '求救：雨天鞋湿了怎么快速处理', summary: '梅雨天生活小问题。', topic: '下午还有课，不想穿着湿鞋坐一晚上。' },
    { title: '第一次做小组展示，怎么分工比较稳', summary: '小组展示分工建议。', topic: '担心最后所有内容都堆到一个人身上，想提前定个清晰流程。', poll: ['按章节', '按能力', '轮流讲', '先定负责人'] },
    { title: '有没有适合新手的健身房入门计划', summary: '健身新手求低压力计划。', topic: '不追求立刻见效，主要想养成习惯，避免动作太危险。' },
    { title: '想问问学生证补办一般要多久', summary: '学生证补办经验求助。', topic: '近期可能要用，不知道流程和时间是否来得及。' },
    { title: '如何礼貌拒绝不合适的约饭邀请', summary: '社交边界表达求建议。', topic: '对方没有恶意，但我确实不想继续约，想表达得清楚一点。' },
  ],
  trade: [
    { title: '出九成新 23.8 寸显示器，宿舍外接屏友好', summary: '二手显示器自提，附 HDMI 线。', topic: '去年双十一买的，箱子还在，因为换了更大的屏幕所以出掉。' },
    { title: '转一张周五晚小剧场票，原价出', summary: '临时有事转演出票。', topic: '座位视野还不错，电子票可当面确认。' },
    { title: '求购一本二手概率论教材，版本不限', summary: '教材求购，能写字也没关系。', topic: '只要页码完整就行，笔记多一点反而欢迎。', poll: ['可出书', '只有电子版', '推荐借阅', '蹲同求'] },
    { title: '出宿舍小冰箱，毕业搬家低价转', summary: '小冰箱搬家转让。', topic: '正常制冷，有一点使用痕迹，需要自提。' },
    { title: '转让一把入门吉他，适合零基础练手', summary: '入门吉他和调音器一起出。', topic: '弦刚换过，音准够日常练习，送一个旧包。' },
    { title: '出几本闲置小说和社科书，可打包', summary: '旧书打包出。', topic: '书况整体不错，部分有划线，想给它们找新书架。', poll: ['小说', '社科', '传记', '都看看'] },
    { title: '求一个闲置折叠椅，社团活动临时用', summary: '折叠椅短期求购或借用。', topic: '用完会擦干净还回去，也可以按二手价买。' },
    { title: '转咖啡券两张，鼓楼附近门店可用', summary: '咖啡券低价转。', topic: '最近去不了，过期前想转给需要的人。' },
    { title: '出一盏护眼台灯，亮度可调', summary: '宿舍台灯转让。', topic: '灯光还挺柔和，适合桌面比较小的位置。' },
  ],
  activity: [
    { title: '周六下午先锋书店到颐和路，慢速拍照路线', summary: '书店、街巷、咖啡和胶片头像。', topic: '会带一台胶片机，天气太热就改成室内书店咖啡版。' },
    { title: '本周五晚想去听 live，有人一起吗', summary: '音乐现场活动邀约。', topic: '风格偏轻松，结束后可以一起坐地铁回来。' },
    { title: '周日紫金山轻徒步，早上出发中午回', summary: '低强度徒步活动。', topic: '不冲顶，主要想呼吸一下山里的空气。', poll: ['参加', '想晚点', '蹲下次', '求路线'] },
    { title: '电影放映后想组织十分钟散场讨论', summary: '观影后短讨论活动。', topic: '不需要准备发言，想说一句也可以。' },
    { title: '校园植物观察小路线，有人感兴趣吗', summary: '植物拍照和识别活动。', topic: '会带识别 app，主打轻松认识路边的花草。' },
    { title: '期末前互换一小时学习歌单', summary: '学习歌单交换活动。', topic: '每人带三首，现场或者评论区都可以交换。', poll: ['纯音乐', '白噪音', '轻音乐', '都可以'] },
    { title: '周末想试试无手机散步一小时', summary: '低干扰散步活动。', topic: '可以带相机或纸笔，但尽量不看手机。' },
    { title: '鼓楼旧书店路线征集，想做一张地图', summary: '旧书店地图共创活动。', topic: '欢迎推荐店名、路线、营业时间和适合停留的角落。' },
    { title: '想办一次小型桌面摄影互拍', summary: '桌面摄影练习活动。', topic: '带一个小物件，互相布光和构图，拍完可以分享原图。' },
  ],
};

const TYPE_AUTHORS: Record<ForumType, string[]> = {
  general: ['admin', 'linxi', 'haoran', 'ningan', 'suhe', 'momo', 'qingzhou', 'shuyi', 'wanqing'],
  squad: ['chenyi', 'linxi', 'jianing', 'chenyi', 'muyang', 'kaichen', 'suhe', 'xiaoyu', 'yueban'],
  help: ['xiaoyu', 'zimo', 'ningan', 'ruoxi', 'suhe', 'muyang', 'kaichen', 'haoran', 'wanqing'],
  trade: ['suhe', 'yueban', 'shuyi', 'wanqing', 'zimo', 'momo', 'jianing', 'ningan', 'kaichen'],
  activity: ['linxi', 'suhe', 'qingzhou', 'yueban', 'ruoxi', 'haoran', 'momo', 'shuyi', 'muyang'],
};

function demoId(prefix: string) {
  void prefix;
  return uuid();
}

function answersFor(interests: string[], mbti: string, campus: string) {
  return JSON.stringify({
    q1: { value: 2002 },
    q2: { value: [1999, 2005] },
    q61: { value: [mbti.toLowerCase(), 'any_mbti'] },
    q5: { value: ['same_grade', 'higher_grade'] },
    q6: { value: campus === 'xianlin' ? 'nanjing_campuses' : 'any_campus' },
    q_interests: { value: interests },
    q_date_content: { value: ['eat_explore', 'walk_citywalk', 'movie_series'] },
    q_free_time: { value: ['weekday_night', 'sat_day', 'sun_day'] },
    q_reply_pref: { value: 5, importance: 3 },
    q29: { value: ['kindness', 'honesty', 'curiosity', 'freedom'] },
    q_future_base: { value: ['jiangsu', 'shanghai', 'zhejiang'] },
  });
}

function buildPosts(): PostSeed[] {
  const imagePattern = [1, 3, 6, 9, 1, 3, 0, 0, 0];
  const types: ForumType[] = ['general', 'squad', 'help', 'trade', 'activity'];

  return types.flatMap((type, typeIndex) =>
    POST_TEMPLATES[type].map((template, index) => ({
      key: `${type}-${index + 1}`,
      author: TYPE_AUTHORS[type][index],
      title: template.title,
      content: `${template.topic}\n\n本帖是全站论坛演示数据，不属于任何圈子；可以用于测试列表筛选、详情页图片宫格、投票、评论、收藏、点赞和举报流程。`,
      summary: template.summary,
      type,
      isPinned: type === 'general' && index === 0,
      isAnonymous: type === 'general' && index === 6,
      createdAt: iso(typeIndex * 2 + Math.floor(index / 2), (index * 3) % 18),
      hotScore: 96 - typeIndex * 9 - index * 3,
      imageCount: imagePattern[index],
      poll: template.poll,
    })),
  );
}

function imageUrlsFor(postIndex: number, count: number) {
  return Array.from({ length: count }, (_, index) => IMAGE_POOL[(postIndex * 5 + index) % IMAGE_POOL.length]);
}

async function clearDemoData() {
  await db.delete(auditLogs);
  await db.delete(broadcastTasks);
  await db.delete(notifications);
  await db.delete(userNotifications);
  await db.delete(creditScoreLogs);
  await db.delete(forumReports);
  await db.delete(userReports);
  await db.delete(userBlocks);
  await db.delete(forumPollVotes);
  await db.delete(forumPollOptions);
  await db.delete(forumCommentHides);
  await db.delete(forumCommentLikes);
  await db.delete(forumComments);
  await db.update(forumPosts).set({ pinnedCommentId: null });
  await db.delete(forumPostImages);
  await db.delete(forumPostLikes);
  await db.delete(forumPostFavorites);
  await db.delete(forumPostViews);
  await db.delete(forumPosts);
  await db.delete(forumAnnouncements);
  await db.delete(forumGuestbookMessages);
  await db.delete(teamupChatReadStates);
  await db.delete(teamupChatMessages);
  await db.delete(teamupApplications);
  await db.delete(teamupMemberContacts);
  await db.delete(teamupMembers);
  await db.delete(teamups);
  await db.delete(circleChatReadStates);
  await db.delete(circleChatMessages);
  await db.delete(contactUnlockGrants);
  await db.delete(contactUnlockRequests);
  await db.delete(userCircleContacts);
  await db.delete(friendRequests);
  await db.delete(friendships);
  await db.delete(globalFriendships);
  await db.delete(userFollows);
  await db.delete(directMessages);
  await db.delete(directMessageConversations);
  await db.delete(userMessageSettings);
  await db.delete(circleMemberLocationCooldowns);
  await db.delete(circleMemberLocations);
  await db.delete(circleMemberRoles);
  await db.delete(circleJoinRequests);
  await db.delete(circleMembers);
  await db.delete(userCircleCustomCards);
  await db.delete(userCircleCards);
  await db.delete(userBaseCards);
  await db.delete(userCardPreferences);
  await db.delete(userCards);
  await db.delete(heartMatches);
  await db.delete(heartSignals);
  await db.delete(matches);
  await db.delete(mailLogs);
  await db.delete(surveyAnswers);
  await db.delete(otpCodes);
  await db.delete(circles);
  await db.delete(users);
}

async function main() {
  await runMigrations();
  await clearDemoData();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const ids: Record<string, string> = Object.fromEntries(PEOPLE.map((person) => [person.key, demoId(`user-${person.key}`)]));

  await db.insert(users).values(PEOPLE.map((person, index) => ({
    id: ids[person.key],
    email: person.email,
    passwordHash,
    nickname: person.nickname,
    gender: person.gender,
    genderPref: person.genderPref,
    intention: person.intention,
    grade: person.grade,
    campus: person.campus,
    department: person.department,
    mbti: person.mbti,
    bio: person.bio,
    signature: person.signature,
    tags: [...person.tags],
    avatarUrl: null,
    wechatId: `forum_demo_${person.key}_wx`,
    isParticipating: true,
    profileComplete: true,
    surveyComplete: true,
    studentIdHash: `forum-demo-student-hash-${person.key}`,
    studentIdLast4: String(2300 + index).padStart(4, '0'),
    studentIdBindSource: 'forum_demo_seed',
    studentIdVerifiedAt: iso(14),
    createdAt: iso(18),
    updatedAt: iso(1),
  })));

  await db.insert(userMessageSettings).values(PEOPLE.map((person) => ({
    userId: ids[person.key],
    allowDirectMessagesFrom: 'all',
    createdAt: iso(8),
    updatedAt: iso(1),
  })));

  await db.insert(surveyAnswers).values(PEOPLE.map((person) => ({
    id: demoId(`survey-${person.key}`),
    userId: ids[person.key],
    answers: answersFor([...person.tags], person.mbti, person.campus),
    version: 'forum-demo-2026',
    submittedAt: iso(12),
    updatedAt: iso(2),
  })));

  await db.insert(userBaseCards).values(PEOPLE.map((person, index) => ({
    userId: ids[person.key],
    isActive: true,
    components: [
      { key: 'nickname', name: '昵称', value: person.nickname, topLeft: [0, 0] as [number, number], width: 2, height: 1, status: 'public' as const },
      { key: 'signature', name: '签名', value: person.signature, topLeft: [0, 1] as [number, number], width: 4, height: 1, status: 'public' as const },
      { key: 'tags', name: '兴趣', value: [...person.tags], topLeft: [0, 2] as [number, number], width: 4, height: 1, status: 'public' as const },
      { key: 'wechat', name: '微信', value: `forum_demo_${person.key}_wx`, topLeft: [0, 3] as [number, number], width: 2, height: 1, status: index % 2 === 0 ? 'friends' as const : 'hidden' as const },
    ],
    updatedAt: iso(1),
  })));

  await db.insert(userCardPreferences).values(PEOPLE.map((person) => ({
    userId: ids[person.key],
    hiddenPreviewMode: 'titles_only',
    createdAt: iso(8),
    updatedAt: iso(1),
  })));

  const posts = buildPosts();
  const postIds: Record<string, string> = Object.fromEntries(posts.map((post) => [post.key, demoId(`post-${post.key}`)]));
  await db.insert(forumPosts).values(posts.map((post, index) => {
    const urls = imageUrlsFor(index, post.imageCount);
    return {
      id: postIds[post.key],
      userId: ids[post.author],
      circleId: null,
      title: post.title,
      content: post.content,
      type: post.type,
      isAnonymous: post.isAnonymous,
      visibility: 'public',
      isPinned: post.isPinned,
      likeCount: 0,
      favoriteCount: 0,
      commentCount: 0,
      viewCount: 0,
      hotScore: post.hotScore,
      lastInteractionAt: iso(0, 1),
      hasImages: urls.length > 0,
      summary: post.summary,
      coverImageUrl: urls[0] ?? null,
      hasPoll: Boolean(post.poll),
      createdAt: post.createdAt,
      updatedAt: post.createdAt,
    };
  }));

  const imageRows = posts.flatMap((post, postIndex) =>
    imageUrlsFor(postIndex, post.imageCount).map((imageUrl, imageIndex) => ({
      id: demoId(`image-${post.key}-${imageIndex}`),
      postId: postIds[post.key],
      imageUrl,
      imageWidth: imageIndex % 2 === 0 ? 1200 : 900,
      imageHeight: imageIndex % 2 === 0 ? 800 : 1200,
      displayOrder: imageIndex,
      createdAt: post.createdAt,
    })),
  );
  await db.insert(forumPostImages).values(imageRows);

  const pollRows = posts.flatMap((post) =>
    (post.poll ?? []).map((option, index) => ({
      id: demoId(`poll-${post.key}-${index}`),
      postId: postIds[post.key],
      optionText: option,
      displayOrder: index,
      voteCount: 0,
      createdAt: post.createdAt,
    })),
  );
  await db.insert(forumPollOptions).values(pollRows);

  const optionByPost = new Map<string, string[]>();
  for (const row of pollRows) {
    const list = optionByPost.get(row.postId) ?? [];
    list.push(row.id);
    optionByPost.set(row.postId, list);
  }
  const votes = Object.entries(ids)
    .filter(([key]) => key !== 'admin')
    .flatMap(([, userId], userIndex) =>
      Array.from(optionByPost.entries()).map(([postId, optionIds]) => ({
        id: demoId(`vote-${postId}-${userId}`),
        postId,
        optionId: optionIds[userIndex % optionIds.length],
        userId,
        createdAt: iso(userIndex % 5),
      })),
    );
  await db.insert(forumPollVotes).values(votes);
  for (const option of pollRows) {
    const count = votes.filter((vote) => vote.optionId === option.id).length;
    await db.update(forumPollOptions).set({ voteCount: count }).where(sql`${forumPollOptions.id} = ${option.id}`);
  }

  const nonAdminPeople = PEOPLE.filter((person) => person.key !== 'admin');
  const comments = posts.flatMap((post, postIndex) => {
    const first = nonAdminPeople[(postIndex + 2) % nonAdminPeople.length];
    const second = nonAdminPeople[(postIndex + 7) % nonAdminPeople.length];
    return [
      {
        key: `${post.key}-c1`,
        post: post.key,
        author: first.key === post.author ? nonAdminPeople[(postIndex + 3) % nonAdminPeople.length].key : first.key,
        content: `这个话题很适合演示评论区，我先留一个真实一点的反馈：${post.summary}`,
        days: postIndex % 6,
        hours: (postIndex * 2) % 12,
      },
      {
        key: `${post.key}-c2`,
        post: post.key,
        author: second.key === post.author ? nonAdminPeople[(postIndex + 8) % nonAdminPeople.length].key : second.key,
        content: '我也来补充一个角度，图片、收藏和回复一起看会更接近真实论坛流量。',
        days: postIndex % 5,
        hours: (postIndex * 3) % 16,
      },
    ];
  });
  const commentIds: Record<string, string> = Object.fromEntries(comments.map((comment) => [comment.key, demoId(`comment-${comment.key}`)]));
  await db.insert(forumComments).values(comments.map((comment) => ({
    id: commentIds[comment.key],
    postId: postIds[comment.post],
    userId: ids[comment.author],
    content: comment.content,
    commentType: 'text',
    likeCount: 0,
    createdAt: iso(comment.days, comment.hours),
    updatedAt: iso(comment.days, comment.hours),
  })));

  const replies = comments.slice(0, 18).map((comment, index) => ({
    parent: comment.key,
    post: comment.post,
    author: nonAdminPeople[(index + 5) % nonAdminPeople.length].key,
    content: index % 2 === 0 ? '这个回复用于演示二级评论，点开详情页会更直观。' : '赞同，尤其是图片多的时候详情页浏览体验很重要。',
    hours: (index % 9) + 1,
  }));
  await db.insert(forumComments).values(replies.map((reply, index) => ({
    id: demoId(`reply-${reply.parent}-${index}`),
    postId: postIds[reply.post],
    userId: ids[reply.author],
    content: reply.content,
    commentType: 'text',
    parentCommentId: commentIds[reply.parent],
    rootCommentId: commentIds[reply.parent],
    likeCount: 0,
    createdAt: iso(0, reply.hours),
    updatedAt: iso(0, reply.hours),
  })));

  const likeRows = posts.flatMap((post, postIndex) =>
    nonAdminPeople
      .filter((person, userIndex) => person.key !== post.author && (postIndex + userIndex) % 2 === 0)
      .map((person) => ({
        id: demoId(`like-${post.key}-${person.key}`),
        postId: postIds[post.key],
        userId: ids[person.key],
        createdAt: iso(postIndex % 4),
      })),
  );
  await db.insert(forumPostLikes).values(likeRows);

  const favoriteRows = posts.flatMap((post, postIndex) =>
    nonAdminPeople
      .filter((person, userIndex) => person.key !== post.author && (postIndex + userIndex) % 3 === 0)
      .map((person) => ({
        id: demoId(`favorite-${post.key}-${person.key}`),
        postId: postIds[post.key],
        userId: ids[person.key],
        createdAt: iso(postIndex % 5),
      })),
  );
  await db.insert(forumPostFavorites).values(favoriteRows);

  const viewRows = posts.flatMap((post, postIndex) =>
    PEOPLE.map((person, userIndex) => ({
      id: demoId(`view-${post.key}-${person.key}`),
      postId: postIds[post.key],
      userId: ids[person.key],
      viewedAt: iso((postIndex + userIndex) % 7),
    })),
  );
  await db.insert(forumPostViews).values(viewRows);

  const commentLikeRows = comments
    .filter((_, index) => index % 2 === 0)
    .flatMap((comment, index) =>
      nonAdminPeople
        .filter((person) => person.key !== comment.author)
        .slice(index % 4, (index % 4) + 3)
        .map((person) => ({
          id: demoId(`comment-like-${comment.key}-${person.key}`),
          commentId: commentIds[comment.key],
          userId: ids[person.key],
          createdAt: iso(0, 2),
        })),
    );
  await db.insert(forumCommentLikes).values(commentLikeRows);

  for (const post of posts) {
    const postId = postIds[post.key];
    const likeCount = likeRows.filter((row) => row.postId === postId).length;
    const favoriteCount = favoriteRows.filter((row) => row.postId === postId).length;
    const viewCount = viewRows.filter((row) => row.postId === postId).length + Math.floor(post.hotScore / 2);
    const commentCount = comments.filter((comment) => comment.post === post.key).length
      + replies.filter((reply) => reply.post === post.key).length;
    await db.update(forumPosts)
      .set({ likeCount, favoriteCount, viewCount, commentCount })
      .where(sql`${forumPosts.id} = ${postId}`);
  }
  for (const comment of comments) {
    const likeCount = commentLikeRows.filter((row) => row.commentId === commentIds[comment.key]).length;
    await db.update(forumComments).set({ likeCount }).where(sql`${forumComments.id} = ${commentIds[comment.key]}`);
  }

  await db.insert(forumAnnouncements).values([
    {
      id: demoId('announcement-1'),
      title: '本周演示主题：全站论坛互动与社区治理',
      content: '本次演示只包含全站论坛数据。所有用户都没有加入圈子，也没有发布圈子帖。',
      createdBy: ids.admin,
      isActive: true,
      priority: 10,
      startsAt: iso(2),
      endsAt: future(30),
      createdAt: iso(2),
    },
    {
      id: demoId('announcement-2'),
      title: '欢迎测试帖子筛选、图片宫格、投票和留言板',
      content: '每个帖子类型都准备了多条内容，含 1、3、6、9 张图片的详情页样例。',
      createdBy: ids.admin,
      isActive: true,
      priority: 5,
      startsAt: iso(1),
      endsAt: future(14),
      createdAt: iso(1),
    },
  ]);

  await db.insert(forumGuestbookMessages).values([
    { id: demoId('guest-1'), userId: ids.linxi, content: '今天的云像被揉皱的草稿纸，适合发呆。', status: 'visible', createdAt: iso(0, 1) },
    { id: demoId('guest-2'), userId: ids.chenyi, content: '如果有人看到一个蓝色水杯在体育馆，请救救它。', status: 'visible', createdAt: iso(0, 4) },
    { id: demoId('guest-3'), userId: ids.yueban, content: '南大最浪漫的瞬间：晚风、路灯、和刚好不用排队的奶茶。', status: 'visible', createdAt: iso(1) },
    { id: demoId('guest-4'), userId: ids.suhe, content: '给所有 ddl 中的人留一盏精神小夜灯。', status: 'visible', createdAt: iso(2) },
    { id: demoId('guest-5'), userId: ids.muyang, content: '跑完步回来看见首页有新留言，莫名很有人气。', status: 'visible', createdAt: iso(3) },
    { id: demoId('guest-6'), userId: ids.momo, content: '论坛图片墙看起来终于有生活感了。', status: 'visible', createdAt: iso(0, 7) },
    { id: demoId('guest-7'), userId: ids.haoran, content: '建议热榜旁边永远留一个安静入口。', status: 'visible', createdAt: iso(4) },
  ]);

  await db.insert(forumReports).values([
    {
      id: demoId('forum-report-1'),
      reporterId: ids.xiaoyu,
      reportedUserId: ids.suhe,
      targetType: 'post',
      postId: postIds['trade-1'],
      reason: 'junk_info',
      detail: '演示用待审核举报：怀疑二手信息描述不完整。',
      status: 'pending',
      createdAt: iso(0, 6),
      updatedAt: iso(0, 6),
    },
    {
      id: demoId('forum-report-2'),
      reporterId: ids.qingzhou,
      reportedUserId: ids.admin,
      targetType: 'post',
      postId: postIds['general-1'],
      reason: 'other',
      detail: '演示用已驳回举报：置顶说明属于正常公告。',
      status: 'rejected',
      adminNote: '内容为演示说明，无违规。',
      reviewedBy: ids.admin,
      reviewedAt: iso(0, 2),
      createdAt: iso(1, 3),
      updatedAt: iso(0, 2),
    },
  ]);

  const followEdges = [
    ['linxi', 'muyang'],
    ['muyang', 'linxi'],

    // Linxi follows several people who do not follow her back.
    ['linxi', 'xiaoyu'],
    ['linxi', 'chenyi'],
    ['linxi', 'suhe'],
    ['linxi', 'qingzhou'],

    // Linxi has several one-way followers.
    ['momo', 'linxi'],
    ['haoran', 'linxi'],
    ['shuyi', 'linxi'],
    ['wanqing', 'linxi'],

    // Muyang follows several people who do not follow him back.
    ['muyang', 'jianing'],
    ['muyang', 'kaichen'],
    ['muyang', 'ningan'],
    ['muyang', 'ruoxi'],

    // Muyang has several one-way followers.
    ['yueban', 'muyang'],
    ['zimo', 'muyang'],
    ['admin', 'muyang'],
    ['xiaoyu', 'muyang'],

    // Extra one-way edges keep the demo follow list populated beyond the two primary users.
    ['xiaoyu', 'yueban'],
    ['chenyi', 'qingzhou'],
    ['haoran', 'shuyi'],
    ['ningan', 'ruoxi'],
    ['jianing', 'kaichen'],
  ] as const;

  await db.insert(userFollows).values(followEdges.map(([follower, followee]) => ({
    id: demoId(`follow-${follower}-${followee}`),
    followerId: ids[follower],
    followeeId: ids[followee],
    createdAt: iso(3),
  })));

  const conversationSeeds = [
    {
      pair: ['linxi', 'muyang'],
      messages: ['周六那个全站帖你看到了吗？', '看到了，图片很多，详情页很好测。', '我准备从论坛入口点到私信。', '可以，我这边会回复几条。'],
    },
    {
      pair: ['xiaoyu', 'yueban'],
      messages: ['你推荐的电影帖我收藏了。', '看完可以在评论区写一句短评。', '好，我顺便试试图片评论。', '我也想看看通知会不会到。'],
    },
    {
      pair: ['chenyi', 'qingzhou'],
      messages: ['羽毛球缺一那个帖热度还挺高。', '因为标题很像真实校园生活。', '今晚如果演示，就从筛选搭子类型开始。', '再跳到私信，很顺。'],
    },
    {
      pair: ['suhe', 'ningan'],
      messages: ['二手帖我加了多图，你帮我看看描述够不够清楚。', '够了，价格和自提地点都在。', '那举报流程也可以用它演示。', '可以，管理员账号正好能处理。'],
    },
    {
      pair: ['momo', 'haoran'],
      messages: ['我想测九宫格图片那条。', '可以点 activity 或 trade，里面有 9 张图的样例。', '好，缩略图如果加载慢也能看出来。', '现有图片都是 public 里的静态资源。'],
    },
    {
      pair: ['ruoxi', 'zimo'],
      messages: ['校园网求助帖你能回一下吗？', '能，我写几个排查步骤。', '谢谢，这样 help 标签看起来更真实。', '顺便测试一下关注后的私信入口。'],
    },
    {
      pair: ['shuyi', 'wanqing'],
      messages: ['旧书店路线那个活动不错。', '我想做成地图，但先用论坛征集。', '评论区应该会很适合沉淀信息。', '演示时可以从活动筛选进去。'],
    },
    {
      pair: ['jianing', 'kaichen'],
      messages: ['骑行帖有人问时间。', '傍晚比较舒服，热度也高。', '我在评论里补一下装备建议。', '行，私信里就保留这段对话。'],
    },
  ];

  const conversationRows = conversationSeeds.map((seed, index) => {
    const [a, b] = seed.pair;
    const userAId = ids[a] < ids[b] ? ids[a] : ids[b];
    const userBId = ids[a] < ids[b] ? ids[b] : ids[a];
    return {
      id: demoId(`dm-conversation-${a}-${b}`),
      userAId,
      userBId,
      createdAt: iso(4 + index),
      updatedAt: iso(0, index),
      lastMessageAt: iso(0, index),
    };
  });
  await db.insert(directMessageConversations).values(conversationRows);

  const messageRows = conversationSeeds.flatMap((seed, conversationIndex) => {
    const conversationId = conversationRows[conversationIndex].id;
    const [a, b] = seed.pair;
    return seed.messages.map((content, messageIndex) => {
      const sender = messageIndex % 2 === 0 ? a : b;
      const receiver = messageIndex % 2 === 0 ? b : a;
      return {
        id: demoId(`dm-${a}-${b}-${messageIndex}`),
        conversationId,
        senderId: ids[sender],
        receiverId: ids[receiver],
        messageType: 'text',
        content,
        createdAt: iso(0, conversationIndex * 2 + messageIndex),
        readAt: messageIndex < seed.messages.length - 1 ? iso(0, conversationIndex * 2 + messageIndex) : null,
      };
    });
  });
  await db.insert(directMessages).values(messageRows);

  await db.insert(notifications).values([
    {
      id: demoId('notification-1'),
      userId: ids.linxi,
      type: 'system_announcement',
      title: '论坛演示数据已准备好',
      body: '全站帖子、图片、评论、投票、留言板、举报和私信都有可点击内容。',
      level: 'info',
      actionUrl: '/forum',
      meta: { demo: true, scope: 'forum' },
      isRead: false,
      createdAt: iso(0, 1),
      idempotencyKey: demoId('idem-1'),
    },
    {
      id: demoId('notification-2'),
      userId: ids.admin,
      type: 'system_announcement',
      title: '有待处理的论坛举报',
      body: '管理员账号可用于演示举报审核流程。',
      level: 'warning',
      actionUrl: '/admin',
      meta: { demo: true, report: true },
      isRead: false,
      createdAt: iso(0, 2),
      idempotencyKey: demoId('idem-2'),
    },
  ]);

  console.log('\nForum demo database seeded.\n');
  console.log('Login accounts:');
  for (const person of PEOPLE) {
    console.log(`  ${person.email} / ${DEMO_PASSWORD}`);
  }
  console.log('\nRecommended forum demo users: linxi@smail.nju.edu.cn, muyang@smail.nju.edu.cn, admin@smail.nju.edu.cn');
  console.log(`Seeded ${PEOPLE.length} users, ${posts.length} global forum posts, ${imageRows.length} post images, ${messageRows.length} direct messages.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await queryClient.end({ timeout: 5 });
  });
