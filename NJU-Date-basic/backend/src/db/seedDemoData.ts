/**
 * 演示数据一键导入脚本
 * 创建测试账号、个人资料、帖子、评论、互动、私信等全套演示数据
 *
 * 运行方式：npx tsx src/db/seedDemoData.ts
 * 幂等：基于邮箱唯一性，已存在的账号、帖子等会跳过
 */

import 'dotenv/config';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { queryClient } from './connection.js';

const SALT_ROUNDS = 10;

// ─── 测试账号定义 ──────────────────────────────────────────────────

interface DemoUser {
  email: string;
  password: string;
  nickname: string;
  gender: 'male' | 'female';
  mbti: string;
  bio: string;
  department: string;
  grade: string;
  campus: string;
}

const DEMO_USERS: DemoUser[] = [
  {
    email: 'alice@smail.nju.edu.cn',
    password: 'test123',
    nickname: '阿球',
    gender: 'female',
    mbti: 'ENFJ',
    bio: '喜欢羽毛球和摄影，周末常去仙林球场',
    department: '计算机科学与技术系',
    grade: '2023级硕士',
    campus: 'xianlin',
  },
  {
    email: 'bob@smail.nju.edu.cn',
    password: 'test123',
    nickname: '北苑杀球王',
    gender: 'male',
    mbti: 'ISTP',
    bio: '羽毛球重度爱好者，每周至少打三场',
    department: '软件学院',
    grade: '2022级本科',
    campus: 'gulou',
  },
  {
    email: 'admin@nju.date',
    password: 'admin123',
    nickname: '管理员',
    gender: 'male',
    mbti: 'INTJ',
    bio: '论坛管理员',
    department: '信息管理系',
    grade: '2022级硕士',
    campus: 'xianlin',
  },
];

// ═══════════════════════════════════════════════════════════════════
//  帖子数据
//  索引 0 = 综合展示帖（图片 + 投票 + 全类型评论）
//  索引 1-5 = 其它常规帖子
// ═══════════════════════════════════════════════════════════════════

interface DemoPost {
  title: string;
  content: string;
  type: string;
  visibility: 'public' | 'private';
  isAnonymous: boolean;
  pollOptions?: string[];
  summary?: string;
  hasImages?: boolean;
  coverImageUrl?: string;
}

const DEMO_POSTS: DemoPost[] = [
  // ═══ 帖子 0：综合展示帖（图片 + 投票） ═══
  {
    title: '📸 周末羽毛球友谊赛精彩回顾（多图 + 投票）',
    content: '上周末在仙林体育馆组织了一场羽毛球友谊赛，来了十多位球友，打了一下午超尽兴！\n\n发几张现场照片给大家感受一下氛围～大家觉得下次应该什么时间再组织？\n\n另外也欢迎这次没来的朋友下次报名，我们基本每周都有局！',
    summary: '周末羽毛球友谊赛精彩回顾，多图预警！附投票：下次活动时间调查',
    type: 'squad',
    visibility: 'public',
    isAnonymous: false,
    hasImages: true,
    coverImageUrl: 'https://picsum.photos/seed/badminton/800/600',
    pollOptions: ['下周六下午', '下周日晚上', '工作日晚间', '都行，看人数'],
  },
  // ═══ 帖子 1：经验分享 ═══
  {
    title: 'CS/SE 方向实习经验分享（字节、阿里、腾讯）',
    content: '最近刚结束了暑期实习的投递和面试过程，拿到了几家大厂的offer。想和大家分享一下我的准备经验和面试心得。\n\n1. 简历准备：项目经历要突出，最好有量化指标\n2. 刷题：LeetCode 高频前200题必刷\n3. 面经：牛客网上的面经很有参考价值\n4. 时间线：3月开始投递，4月集中面试\n\n大家如果有问题可以评论区交流～',
    summary: '分享暑期实习投递和面试经验，包括简历准备、刷题、面经和时间线',
    type: 'help',
    visibility: 'public',
    isAnonymous: false,
  },
  // ═══ 帖子 2：二手交易（含投票） ═══
  {
    title: '出闲置羽毛球拍 Yonex 天斧 99 Pro',
    content: '去年双十一买的，打了一个学期，正常使用痕迹，无磕碰无内伤。4UG5规格，拉了26磅BG80线。原价1800，现在900出。仙林校区可以当面交易。',
    summary: '天斧99 Pro，4UG5，26磅BG80线，900元出售',
    type: 'trade',
    visibility: 'public',
    isAnonymous: false,
    pollOptions: ['有兴趣，想要', '价格有点高', '帮顶'],
  },
  // ═══ 帖子 3：匿名讨论 ═══
  {
    title: '大家对未来的投资方向怎么看',
    content: '最近行情波动比较大，想听听大家是怎么看的。我个人感觉新能源和半导体还有机会，但消费板块可能要谨慎一些。欢迎大家一起理性讨论。',
    summary: '讨论投资方向，新能源半导体还有机会，消费板块需谨慎',
    type: 'general',
    visibility: 'public',
    isAnonymous: true,
  },
  // ═══ 帖子 4：活动招募 ═══
  {
    title: '【活动】周末紫金山徒步看日出',
    content: '打算这周六凌晨4点出发登紫金山看日出！集合地点：白马公园门口。预计全程6公里，耗时3小时左右。需要带手电筒、保暖衣物和饮用水。目前已经有5个人了，再找3个同伴。',
    summary: '周六凌晨登紫金山看日出，6公里3小时，已有5人，再找3人',
    type: 'activity',
    visibility: 'public',
    isAnonymous: false,
  },
  // ═══ 帖子 5：私密笔记 ═══
  {
    title: '（私密）个人学习笔记 - 系统设计面试要点',
    content: 'CAP定理的理解、分布式一致性协议、微服务拆分的几个原则、负载均衡策略对比...供自己复习使用。',
    summary: '系统设计面试笔记',
    type: 'general',
    visibility: 'private',
    isAnonymous: false,
  },
];

// ═══════════════════════════════════════════════════════════════════
//  评论数据
//  帖子 0 的评论：展示文字 / 图片 / 语音 / 二级回复
// ═══════════════════════════════════════════════════════════════════

interface DemoComment {
  postIndex: number;
  content: string;
  fromAlice: boolean;
  /** 评论类型 */
  commentType?: 'text' | 'voice';
  /** 图片评论的 URL */
  imageUrl?: string;
  /** 语音评论的 URL 和时长 */
  voiceUrl?: string;
  voiceDurationSec?: number;
  /** 二级回复：此评论是第几条 root 评论的回复（0-based，相对于同一帖子的 root 评论） */
  replyToRootIndex?: number;
}

const DEMO_COMMENTS: DemoComment[] = [
  // ── 帖子 0：综合展示帖的评论 ──
  // Root comment 0: 普通文字
  { postIndex: 0, content: '照片拍得真好！下次一定来！', fromAlice: false },
  // L2 reply to root 0
  { postIndex: 0, content: '欢迎欢迎，下次定了时间我提前通知你', fromAlice: true, replyToRootIndex: 0 },
  // L2 reply to root 0
  { postIndex: 0, content: '好的！我拉上我们院的两个同学一起', fromAlice: false, replyToRootIndex: 0 },

  // Root comment 1: 图片回复
  {
    postIndex: 0,
    content: '我也发一张上周打球拍的夕阳，仙林体育馆视角',
    fromAlice: false,
    imageUrl: 'https://picsum.photos/seed/court-sunset/400/300',
  },
  // L2 reply to root 1
  { postIndex: 0, content: '哇这个夕阳绝了！可以发原图吗？', fromAlice: true, replyToRootIndex: 1 },

  // Root comment 2: 语音回复
  {
    postIndex: 0,
    content: null as any,
    fromAlice: true,
    commentType: 'voice',
  },

  // Root comment 3: 关于投票的文字讨论
  { postIndex: 0, content: '投了"下周六下午"，工作日太累了', fromAlice: false },

  // ── 帖子 1：实习经验帖的评论 ──
  { postIndex: 1, content: '非常有用！想问一下八股文是怎么准备的？', fromAlice: false },
  { postIndex: 1, content: '八股文我主要看小林coding和JavaGuide，面试前一周集中看', fromAlice: true },
  { postIndex: 1, content: '字节的面试难度怎么样？听说问得很深', fromAlice: false },
  { postIndex: 1, content: '字节确实问得深一些，特别是项目经历会深挖', fromAlice: true },

  // ── 帖子 2：二手交易帖的评论 ──
  { postIndex: 2, content: '好价帮顶！可惜我已经有主力拍了', fromAlice: false },
  { postIndex: 2, content: '这个拍子杀球很爽的，有意者别错过', fromAlice: false },

  // ── 帖子 3：匿名讨论帖的评论 ──
  { postIndex: 3, content: '新能源这块我觉得锂电已经饱和了，要看光伏和储能', fromAlice: false },
  { postIndex: 3, content: '半导体国产替代是长期逻辑，但短期估值确实偏高', fromAlice: true },

  // ── 帖子 4：活动招募帖的评论 ──
  { postIndex: 4, content: '6公里对新手友好吗？没怎么爬过山但想试试', fromAlice: false },
  { postIndex: 4, content: '紫金山难度不大，走走停停3小时足够了，来吧', fromAlice: true },
];

// ─── 私信数据 ──────────────────────────────────────────────────────

const DM_MESSAGES: { fromAlice: boolean; content: string }[] = [
  { fromAlice: true, content: '你好！看到你也喜欢打羽毛球，有空约球吗？' },
  { fromAlice: false, content: '好啊！我一般周六下午有空，你在哪个校区？' },
  { fromAlice: true, content: '我在仙林校区，你呢？' },
  { fromAlice: false, content: '我在鼓楼，不过周末可以去仙林。你们那边球场好订吗？' },
  { fromAlice: true, content: '要提前一周订，不过我这周六已经订好了，下午2-4点，你要来吗？' },
  { fromAlice: false, content: '可以！那周六见。我到时候到了联系你' },
  { fromAlice: true, content: '好的，到了直接进体育馆左手边第三个场地就行' },
  { fromAlice: false, content: '好的，周六见！' },
];

// ═══════════════════════════════════════════════════════════════════
//  主函数
// ═══════════════════════════════════════════════════════════════════

const DEMO_EMAILS = DEMO_USERS.map((u) => u.email);

async function resetDemoData() {
  console.log('🗑  正在清除旧演示数据...\n');

  // 1. 删除演示用户的帖子相关数据
  const userIds = await queryClient`
    SELECT id FROM users WHERE email = ANY(${DEMO_EMAILS})
  `;
  const uidList: string[] = userIds.map((r: any) => r.id);

  if (uidList.length === 0) {
    console.log('  没有发现旧演示用户\n');
    return;
  }

  // 按依赖顺序逐表清除
  const tables = [
    'forum_poll_votes',
    'forum_poll_options',
    'forum_post_images',
    'forum_comment_likes',
    'forum_comment_hides',
    'forum_comments',
    'forum_post_likes',
    'forum_post_favorites',
    'forum_post_views',
    'forum_posts',
    'direct_messages',
    'direct_message_conversations',
    'user_follows',
  ];

  for (const table of tables) {
    try {
      if (table === 'forum_poll_options' || table === 'forum_post_images') {
        // 这些表没有 user_id，通过 post_id 关联（forum_posts 已在上一步清空）
        await queryClient.unsafe(
          `DELETE FROM ${table} WHERE post_id IN (SELECT id FROM forum_posts WHERE user_id = ANY($1))`,
          [uidList],
        );
      } else if (table === 'direct_messages') {
        await queryClient.unsafe(`DELETE FROM ${table} WHERE sender_id = ANY($1) OR receiver_id = ANY($1)`, [uidList, uidList]);
      } else if (table === 'direct_message_conversations') {
        await queryClient.unsafe(`DELETE FROM ${table} WHERE user_a_id = ANY($1) OR user_b_id = ANY($1)`, [uidList, uidList]);
      } else if (table === 'user_follows') {
        await queryClient.unsafe(`DELETE FROM ${table} WHERE follower_id = ANY($1) OR followee_id = ANY($1)`, [uidList, uidList]);
      } else {
        await queryClient.unsafe(`DELETE FROM ${table} WHERE user_id = ANY($1)`, [uidList]);
      }
      console.log(`  ✓ 已清空 ${table}`);
    } catch (err: any) {
      if (err.code !== '42P01') {
        console.log(`  ⚠ 跳过 ${table}: ${err.message?.split('\n')[0]}`);
      }
    }
  }

  // 删除演示用户本身
  await queryClient`DELETE FROM users WHERE email = ANY(${DEMO_EMAILS})`;
  console.log(`  ✓ 已删除 ${uidList.length} 个演示用户\n`);
  console.log('✅ 旧演示数据已清除\n');
}

async function main() {
  const args = process.argv.slice(2);
  const shouldReset = args.includes('--reset') || args.includes('-r');

  console.log('═══════════════════════════════════════════');
  console.log('  G3 论坛 / 私信 / 消息中心 演示数据导入');
  if (shouldReset) console.log('  （重置模式：先清旧数据再导入）');
  console.log('═══════════════════════════════════════════\n');

  if (shouldReset) {
    await resetDemoData();
  }

  // ═══ 1. 创建用户 ═══════════════════════════════════════════════
  console.log('📝 步骤 1/6：创建演示账号...\n');

  const userIdByEmail = new Map<string, string>();

  for (const user of DEMO_USERS) {
    const existing = await queryClient`
      SELECT id FROM users WHERE email = ${user.email} LIMIT 1
    `;
    if (existing.length > 0) {
      console.log(`  ⏭  ${user.email} — 已存在，跳过`);
      userIdByEmail.set(user.email, existing[0].id as string);
      continue;
    }

    const userId = randomUUID();
    const passwordHash = await bcrypt.hash(user.password, SALT_ROUNDS);

    await queryClient`
      INSERT INTO users (
        id, email, password_hash, nickname, gender, mbti, bio,
        department, grade, campus,
        profile_complete, survey_complete, is_participating,
        created_at, updated_at
      ) VALUES (
        ${userId}, ${user.email}, ${passwordHash},
        ${user.nickname}, ${user.gender}, ${user.mbti}, ${user.bio},
        ${user.department}, ${user.grade}, ${user.campus},
        true, true, true,
        NOW(), NOW()
      )
    `;
    userIdByEmail.set(user.email, userId);
    console.log(`  ✓  ${user.email} — 创建成功 (${userId.slice(0, 8)}...), 昵称: ${user.nickname}`);
  }

  const aliceId = userIdByEmail.get('alice@smail.nju.edu.cn')!;
  const bobId = userIdByEmail.get('bob@smail.nju.edu.cn')!;
  const adminId = userIdByEmail.get('admin@nju.date')!;

  // ═══ 2. 设置管理员 ══════════════════════════════════════════════
  console.log('\n📝 步骤 2/6：设置管理员权限...\n');

  const hasAdminRoles = await queryClient`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_name = 'admin_roles'
    ) as exists
  `;

  if ((hasAdminRoles[0] as any).exists) {
    await queryClient`
      INSERT INTO admin_roles (admin_id, role, created_at)
      VALUES (${adminId}, 'super_admin', NOW())
      ON CONFLICT DO NOTHING
    `;
    console.log('  ✓ 已通过 admin_roles 表设置管理员权限');
  } else {
    console.log('  ⚠  admin_roles 表不存在，请手动设置管理员权限');
  }

  // ═══ 3. 创建帖子 ═══════════════════════════════════════════════
  console.log('\n📝 步骤 3/6：创建论坛帖子...\n');

  const postIds: string[] = [];

  for (let i = 0; i < DEMO_POSTS.length; i++) {
    const p = DEMO_POSTS[i];
    const postId = randomUUID();
    const now = new Date();
    now.setDate(now.getDate() - (DEMO_POSTS.length - 1 - i));

    const existing = await queryClient`
      SELECT id FROM forum_posts WHERE title = ${p.title} AND user_id = ${aliceId} LIMIT 1
    `;
    if (existing.length > 0) {
      console.log(`  ⏭  "${p.title}" — 已存在，跳过`);
      postIds.push(existing[0].id as string);
      continue;
    }

    await queryClient`
      INSERT INTO forum_posts (
        id, user_id, title, content, summary, type, visibility,
        is_anonymous, has_poll, has_images, cover_image_url,
        hot_score, like_count, favorite_count, view_count, comment_count,
        last_interaction_at, created_at, updated_at
      ) VALUES (
        ${postId}, ${aliceId},
        ${p.title}, ${p.content}, ${p.summary || null}, ${p.type}, ${p.visibility},
        ${p.isAnonymous}, ${p.pollOptions ? true : false},
        ${p.hasImages ? true : false}, ${p.coverImageUrl || null},
        ${5 + i * 2}, ${2 + i}, ${1 + (i % 2)}, ${50 + i * 30}, 0,
        ${now.toISOString()}, ${now.toISOString()}, ${now.toISOString()}
      )
    `;
    postIds.push(postId);

    // 帖子图片
    if (p.hasImages) {
      for (let pi = 0; pi < 4; pi++) {
        await queryClient`
          INSERT INTO forum_post_images (id, post_id, image_url, display_order, created_at)
          VALUES (${randomUUID()}, ${postId},
            ${`https://picsum.photos/seed/badminton${pi + 1}/800/600`}, ${pi}, NOW())
        `;
      }
    }

    // 投票选项
    if (p.pollOptions && p.pollOptions.length > 0) {
      for (let oi = 0; oi < p.pollOptions.length; oi++) {
        await queryClient`
          INSERT INTO forum_poll_options (id, post_id, option_text, display_order, vote_count)
          VALUES (${randomUUID()}, ${postId}, ${p.pollOptions[oi]}, ${oi},
            ${oi === 0 ? 5 : oi === 1 ? 3 : oi === 2 ? 2 : 1})
        `;
      }
    }

    const typeLabel: Record<string, string> = {
      squad: '组队', help: '互助', trade: '二手', general: '交流', activity: '活动',
    };
    const flags: string[] = [];
    if (p.hasImages) flags.push('图片');
    if (p.pollOptions) flags.push('投票');
    if (p.isAnonymous) flags.push('匿名');
    if (p.visibility === 'private') flags.push('私密');
    console.log(`  ✓  "${p.title}" — 创建成功 ${flags.length ? `[${flags.join(', ')}]` : ''}`);
  }

  // ═══ 4. 创建评论与互动 ═════════════════════════════════════════
  console.log('\n📝 步骤 4/6：创建评论...\n');

  let commentCount = 0;
  let imageCommentCount = 0;
  let voiceCommentCount = 0;
  let replyCount = 0;

  // 记录每个帖子的 root 评论 ID（用于构建二级回复链）
  const postRootComments = new Map<number, string[]>();

  for (const c of DEMO_COMMENTS) {
    const postId = postIds[c.postIndex];
    if (!postId) continue;

    const userId = c.fromAlice ? aliceId : bobId;
    const commentId = randomUUID();

    const existing = await queryClient`
      SELECT id FROM forum_comments
      WHERE post_id = ${postId} AND user_id = ${userId} AND content IS NOT DISTINCT FROM ${c.content || null}
      LIMIT 1
    `;
    if (existing.length > 0 && c.content) continue;

    const now = new Date();
    now.setMinutes(now.getMinutes() - (DEMO_COMMENTS.length - commentCount) * 5);

    // 处理二级回复
    let parentCommentId: string | null = null;
    let rootCommentId: string | null = null;
    const isReply = c.replyToRootIndex !== undefined && c.replyToRootIndex >= 0;

    if (isReply) {
      const roots = postRootComments.get(c.postIndex) || [];
      if (c.replyToRootIndex! < roots.length) {
        rootCommentId = roots[c.replyToRootIndex!];
        parentCommentId = rootCommentId;
      }
    }

    const commType = c.commentType || 'text';

    await queryClient`
      INSERT INTO forum_comments (
        id, post_id, user_id, content, comment_type,
        image_url, voice_url, voice_duration_sec,
        parent_comment_id, root_comment_id,
        like_count, created_at, updated_at
      ) VALUES (
        ${commentId}, ${postId}, ${userId},
        ${commType === 'text' ? c.content : null},
        ${commType},
        ${c.imageUrl || null},
        ${c.voiceUrl || null}, ${c.voiceDurationSec || null},
        ${parentCommentId}, ${rootCommentId},
        ${isReply ? 2 : 3},
        ${now.toISOString()}, ${now.toISOString()}
      )
    `;

    // 记录 root 评论
    if (!isReply) {
      const roots = postRootComments.get(c.postIndex) || [];
      roots.push(commentId);
      postRootComments.set(c.postIndex, roots);
    }

    if (isReply) replyCount++;
    else if (commType === 'voice') voiceCommentCount++;
    else if (c.imageUrl) imageCommentCount++;
    else commentCount++;

    // 更新帖子评论数
    await queryClient`
      UPDATE forum_posts SET comment_count = COALESCE(comment_count, 0) + 1,
        last_interaction_at = ${now.toISOString()}
      WHERE id = ${postId}
    `;
  }

  console.log(`  ✓ 文字评论: ${commentCount} 条`);
  console.log(`  ✓ 图片评论: ${imageCommentCount} 条`);
  console.log(`  ✓ 语音评论: ${voiceCommentCount} 条`);
  console.log(`  ✓ 二级回复: ${replyCount} 条`);

  // ═══ 5. 互动数据 ═══════════════════════════════════════════════
  console.log('\n📝 步骤 5/6：创建互动数据...\n');

  // Bob 点赞帖子 0, 1, 2, 4
  const bobLikePosts = [0, 1, 2, 4];
  for (const idx of bobLikePosts) {
    const postId = postIds[idx];
    if (!postId) continue;

    await queryClient`
      INSERT INTO forum_post_likes (id, post_id, user_id, created_at)
      VALUES (${randomUUID()}, ${postId}, ${bobId}, NOW())
      ON CONFLICT DO NOTHING
    `.catch(() => {});
  }
  console.log(`  ✓ Bob 点赞了 ${bobLikePosts.length} 篇帖子`);

  // Bob 收藏帖子 0, 1
  for (const idx of [0, 1]) {
    const postId = postIds[idx];
    if (!postId) continue;

    await queryClient`
      INSERT INTO forum_post_favorites (id, post_id, user_id, created_at)
      VALUES (${randomUUID()}, ${postId}, ${bobId}, NOW())
      ON CONFLICT DO NOTHING
    `.catch(() => {});
  }
  console.log('  ✓ Bob 收藏了 2 篇帖子');

  // 更新点赞/收藏计数
  for (const idx of [0, 1, 2, 4]) {
    await queryClient`
      UPDATE forum_posts SET like_count = COALESCE(like_count, 0) + 1 WHERE id = ${postIds[idx]}
    `.catch(() => {});
  }
  for (const idx of [0, 1]) {
    await queryClient`
      UPDATE forum_posts SET favorite_count = COALESCE(favorite_count, 0) + 1 WHERE id = ${postIds[idx]}
    `.catch(() => {});
  }

  // Bob 投票：帖子 0 的第 0 个选项，帖子 2 的第 1 个选项
  const pollVotes: { postIdx: number; optionIdx: number; fromAlice: boolean }[] = [
    { postIdx: 0, optionIdx: 0, fromAlice: false },
    { postIdx: 2, optionIdx: 2, fromAlice: false },
    { postIdx: 0, optionIdx: 1, fromAlice: true },
  ];
  for (const pv of pollVotes) {
    const postId = postIds[pv.postIdx];
    const userId = pv.fromAlice ? aliceId : bobId;
    // 查询选项 ID
    const options = await queryClient`
      SELECT id FROM forum_poll_options WHERE post_id = ${postId} ORDER BY display_order
    `;
    if (options.length > pv.optionIdx) {
      await queryClient`
        INSERT INTO forum_poll_votes (id, post_id, option_id, user_id, created_at)
        VALUES (${randomUUID()}, ${postId}, ${options[pv.optionIdx].id}, ${userId}, NOW())
        ON CONFLICT DO NOTHING
      `.catch(() => {});
      await queryClient`
        UPDATE forum_poll_options SET vote_count = vote_count + 1
        WHERE id = ${options[pv.optionIdx].id}
      `.catch(() => {});
    }
  }
  console.log('  ✓ Bob 和 Alice 各投了一票');

  // ═══ 6. 创建私信 ═══════════════════════════════════════════════
  console.log('\n📝 步骤 6/6：创建私信会话...\n');

  await queryClient`
    INSERT INTO user_follows (follower_id, followee_id, created_at)
    VALUES (${aliceId}, ${bobId}, NOW())
    ON CONFLICT DO NOTHING
  `.catch(() => {});
  await queryClient`
    INSERT INTO user_follows (follower_id, followee_id, created_at)
    VALUES (${bobId}, ${aliceId}, NOW())
    ON CONFLICT DO NOTHING
  `.catch(() => {});

  const conversationId = randomUUID();
  await queryClient`
    INSERT INTO direct_message_conversations (id, user_a_id, user_b_id, created_at, updated_at, last_message_at)
    VALUES (${conversationId}, ${aliceId}, ${bobId}, NOW(), NOW(), NOW())
    ON CONFLICT DO NOTHING
  `.catch(() => {});

  let dmCount = 0;
  for (let i = 0; i < DM_MESSAGES.length; i++) {
    const msg = DM_MESSAGES[i];
    const senderId = msg.fromAlice ? aliceId : bobId;
    const receiverId = msg.fromAlice ? bobId : aliceId;
    const msgId = randomUUID();
    const now = new Date();
    now.setMinutes(now.getMinutes() + i * 2);

    await queryClient`
      INSERT INTO direct_messages (id, conversation_id, sender_id, receiver_id, content, message_type, created_at)
      VALUES (${msgId}, ${conversationId}, ${senderId}, ${receiverId}, ${msg.content}, 'text', ${now.toISOString()})
    `.catch(() => {});
    dmCount++;
  }

  await queryClient`
    UPDATE direct_message_conversations
    SET last_message_at = NOW(), updated_at = NOW()
    WHERE id = ${conversationId}
  `;

  console.log(`  ✓ ${dmCount} 条私信（Alice ↔ Bob）`);
  console.log('  ✓ 互相关注关系已建立');

  // ═══ 完成 ═════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════');
  console.log('  ✅ 演示数据导入完成！');
  console.log('═══════════════════════════════════════════\n');
  console.log('📋 演示账号：');
  console.log('┌────────────┬──────────────────────────────┬──────────┐');
  console.log('│ 角色       │ 邮箱                         │ 密码     │');
  console.log('├────────────┼──────────────────────────────┼──────────┤');
  console.log('│ Alice (主) │ alice@smail.nju.edu.cn        │ test123  │');
  console.log('│ Bob  (辅)  │ bob@smail.nju.edu.cn          │ test123  │');
  console.log('│ Admin      │ admin@nju.date               │ admin123 │');
  console.log('└────────────┴──────────────────────────────┴──────────┘\n');
  console.log('📊 数据统计：');
  console.log(`  - 测试账号: ${DEMO_USERS.length} 个（含完整个人资料）`);
  console.log(`  - 论坛帖子: ${DEMO_POSTS.length} 篇（含图片帖、投票帖、匿名帖、私密帖）`);
  console.log(`  - 评论: 文字${commentCount} + 图片${imageCommentCount} + 语音${voiceCommentCount} + 二级回复${replyCount}`);
  console.log(`  - 互动: 点赞 ${bobLikePosts.length} + 收藏 2 + 投票 3`);
  console.log(`  - 私信: ${dmCount} 条（Alice ↔ Bob，互关）\n`);
  console.log('💡 演示重点：帖子 0「周末羽毛球友谊赛」是综合展示帖，包含：');
  console.log('   - 4 张帖子图片');
  console.log('   - 4 选项投票（已有人投票）');
  console.log('   - 文字评论 + 二级回复');
  console.log('   - 图片评论');
  console.log('   - 语音评论');
  console.log('   可在该帖一次性展示所有论坛功能。\n');

  await queryClient.end();
}

main().catch((err) => {
  console.error('演示数据导入失败:', err);
  process.exit(1);
});
