#!/usr/bin/env node
/**
 * NJU Date — 交互式终端体验
 * 你来亲自作答，和预设对照用户匹配，看真实兼容度
 * 用法: node scripts/interactive.js
 */

import readline from 'readline';

const BASE = 'http://localhost:3000/api/v1';
const ADMIN_KEY = 'dev-admin-key';

const c = {
  reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m',
  yellow: '\x1b[33m', cyan: '\x1b[36m', gray: '\x1b[90m',
  bold: '\x1b[1m', magenta: '\x1b[35m', blue: '\x1b[34m',
};

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(resolve => rl.question(q, resolve));

async function req(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (path.includes('/admin/')) headers['X-Admin-Key'] = ADMIN_KEY;
  const res = await fetch(`${BASE}${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(data)}`);
  return data;
}

// ─── 问卷定义（精简为 20 题的互动版） ──────────────────
const QUESTIONS = [
  // 硬性筛选
  { id: 'q1', text: '在信仰或价值底线上，我希望对方和我大体一致', section: '硬性筛选' },
  { id: 'q3', text: '毕业后是否能在同一城市发展，会直接影响我是否开始这段关系', section: '硬性筛选' },
  { id: 'q4', text: '我完全无法接受伴侣吸烟', section: '硬性筛选' },
  { id: 'q7', text: '如果是认真交往，我可以接受一段时间异地', section: '硬性筛选' },
  // 价值观
  { id: 'q10', text: '相比精神共鸣，我更看重现实层面的经济条件', section: '底层价值观' },
  { id: 'q11', text: '对我来说，事业成就感通常高于经营稳定亲密关系的成就感', section: '底层价值观' },
  { id: 'q13', text: '相比"改变世界"，我更在乎过好自己安稳的小日子', section: '底层价值观' },
  { id: 'q15', text: '智商（聪明、有深度）比情商（会照顾人）更吸引我', section: '底层价值观' },
  // 生活方式
  { id: 'q19', text: '我是一个绝对的"早起鸟"', section: '生活方式' },
  { id: 'q20', text: '周末我更想在宿舍/家里休息，而不是频繁社交', section: '生活方式' },
  { id: 'q22', text: '我习惯做详尽的计划，非常不喜欢"说走就走"', section: '生活方式' },
  { id: 'q26', text: '即使在热恋期，我也每天需要一段绝对独处的时间', section: '生活方式' },
  { id: 'q28', text: '我经常锻炼身体（每周至少3次），并希望伴侣也是', section: '生活方式' },
  // 恋爱动态
  { id: 'q30', text: '吵架时，我倾向于立刻把话说清楚，绝对不能"冷战"', section: '恋爱相处' },
  { id: 'q35', text: '我是一个占有欲很强、容易吃醋的人', section: '恋爱相处' },
  { id: 'q38', text: '我完全可以接受伴侣有非常亲密的异性好友', section: '恋爱相处' },
  { id: 'q41', text: '我愿意和伴侣24小时共享实时定位', section: '恋爱相处' },
  // 犀利
  { id: 'q43', text: '坦白说，我认为大多数人的智商都不如我', section: '犀利争议' },
  { id: 'q48', text: '我是一个极度好胜的人，哪怕是和伴侣玩游戏也必须赢', section: '犀利争议' },
  { id: 'q49', text: '我曾在承诺排他的关系中有过出轨行为', section: '犀利争议' },
];

// 全题填充（把没问的题用中性值填上）
function buildFullAnswers(userAnswers) {
  const imp = (v, i = 2) => ({ value: v, importance: i });
  const base = {};

  // 所有 Likert 题填默认值 4（中立）
  for (let i = 1; i <= 53; i++) {
    if (i !== 9) base[`q${i}`] = imp(4, 1);
  }
  // 覆盖用户实际作答（带 importance 权重）
  for (const [qId, val] of Object.entries(userAnswers)) {
    base[qId] = { value: val.value, importance: val.importance };
  }
  // 特殊题（与新版问卷类型保持一致）
  base.q9 = { value: 'xianlin', importance: 0 };
  base.q10 = { value: 'accept', importance: 0 };
  base.q12 = { value: 'east_china', importance: 0 };
  base.q13 = { value: 'prefer_same_hometown', importance: 0 };
  base.q14 = { value: 'INFP', importance: 0 };
  base.q18 = { value: 'flexible', importance: 0 };
  base.q27 = { value: 'mixed', importance: 0 };
  base.q29 = { value: 'none', importance: 0 };
  base.q36 = { value: ['电影剧集', '阅读写作', '旅行CityWalk'], importance: 0 };
  base.q47 = { value: '2_3_per_week', importance: 0 };
  base.q50 = { value: ['诚实正直', '温柔善良', '忠诚', '聪明', '幽默'], importance: 0 };
  base.q52 = { value: 'accept', importance: 0 };
  base.q53 = { value: '长期冷暴力', importance: 0 };
  base.q54 = { value: ['高质量的陪伴', '肯定的话语', '服务的行动', '身体接触', '接受礼物'], importance: 0 };
  base.q55 = { value: 'values', importance: 0 };
  base.q56 = { value: 49, importance: 0 };
  base.q57 = { value: 'within_two_years', importance: 0 };
  base.q58 = { value: 'neutral', importance: 0 };
  base.q59 = { value: 'prefer_same_campus', importance: 0 };
  base.q60 = { value: '仙林食堂排到最后一份饭，和朋友边走边聊回宿舍。', importance: 0 };
  return base;
}

// 对照用户的预设答案（"理想型"偏向，留有差异）
function botAnswers() {
  const imp = (v, i = 2) => ({ value: v, importance: i });
  return {
    q1: { value: 'female', importance: 0 }, q2: { value: 'male', importance: 0 }, q3: { value: 'long_term', importance: 0 }, q4: { value: 2003, importance: 0 },
    q5: { value: 1999, importance: 0 }, q6: { value: 2005, importance: 0 }, q7: { value: 2026, importance: 0 }, q8: { value: 'within_two_years', importance: 0 },
    q9: { value: 'xianlin', importance: 0 },
    q10: { value: 'accept', importance: 0 }, q11: { value: 166, importance: 0 }, q12: { value: 'east_china', importance: 0 }, q13: { value: 'prefer_same_hometown', importance: 0 },
    q14: { value: 'ENFP', importance: 0 }, q15: imp(5, 1), q16: imp(3, 1), q17: imp(5, 1), q18: { value: 'flexible', importance: 0 },
    q19: imp(4, 1), q20: imp(4, 2), q21: imp(4, 1), q22: imp(4, 2),
    q23: imp(5, 1), q24: imp(5, 1), q25: imp(3, 1), q26: imp(5, 2),
    q27: { value: 'mixed', importance: 0 }, q28: imp(5, 1),
    q29: { value: 'none', importance: 0 }, q30: imp(5, 2), q31: imp(4, 1), q32: imp(2, 2),
    q33: imp(4, 2), q34: imp(4, 1), q35: imp(3, 2), q36: { value: ['骑行健身', '电影剧集', '阅读写作'], importance: 0 },
    q37: imp(3, 1), q38: imp(5, 2), q39: imp(3, 1), q40: imp(4, 1),
    q41: imp(3, 1), q42: imp(2, 2),
    q43: imp(3, 1), q44: imp(2, 1), q45: imp(2, 2), q46: imp(3, 1),
    q47: { value: '2_3_per_week', importance: 0 }, q48: imp(2, 1), q49: imp(4, 2), q50: { value: ['忠诚', '温柔善良', '诚实正直', '幽默', '独立'], importance: 0 },
    q51: imp(4, 1), q52: { value: 'accept', importance: 0 }, q53: { value: '不尊重边界', importance: 0 },
    q54: { value: ['高质量的陪伴', '身体接触', '肯定的话语', '服务的行动', '接受礼物'], importance: 0 },
    q55: { value: 'values', importance: 0 },
    q56: { value: 49, importance: 0 },
    q57: { value: 'within_one_year', importance: 0 },
    q58: { value: 'prefer_same_major', importance: 0 },
    q59: { value: 'prefer_same_campus', importance: 0 },
    q60: { value: '和最想见的人见面，认真说谢谢和再见。', importance: 0 },
  };
}

// ─── Likert 交互作答 ──────────────────────────────────
function renderScale(selected) {
  const labels = ['完全\n不同意', '', '', '一般', '', '', '完全\n同意'];
  let bar = '';
  for (let i = 1; i <= 7; i++) {
    bar += i === selected ? `${c.cyan}[${i}]${c.reset}` : `${c.gray} ${i} ${c.reset}`;
  }
  return bar;
}

async function askLikert(q, sectionChanged) {
  if (sectionChanged) {
    console.log(`\n${c.magenta}${c.bold}━━━ ${q.section} ━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
  }
  console.log(`\n${c.bold}${q.text}${c.reset}`);
  console.log(`${c.gray}1=完全不同意  4=中立  7=完全同意${c.reset}`);

  let value = 4;
  process.stdout.write(`\r  ${renderScale(value)}`);

  // 简单数字输入
  while (true) {
    const input = (await ask(`\n  你的选择 (1-7，回车确认): `)).trim();
    const num = parseInt(input);
    if (num >= 1 && num <= 7) {
      value = num;
      break;
    }
    if (input === '') { value = 4; break; }
    console.log(`  ${c.red}请输入 1-7 之间的数字${c.reset}`);
  }

  const imp = (await ask(`  重要程度: ${c.yellow}★${c.reset} 重要  ${c.gray}✕ 不重要${c.reset}  (输入 * 或 - ，回车=默认): `)).trim();
  const importance = imp === '*' || imp === '★' ? 3 : imp === '-' || imp === '✕' ? 1 : 2;

  return { value, importance };
}

// ─── 进度条 ──────────────────────────────────────────
function progress(current, total) {
  const filled = Math.round((current / total) * 20);
  const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
  return `${c.cyan}[${bar}]${c.reset} ${current}/${total}`;
}

// ─── 主程序 ──────────────────────────────────────────
async function main() {
  console.clear();
  console.log(`${c.bold}${c.cyan}`);
  console.log(`  ╔═══════════════════════════════════════╗`);
  console.log(`  ║       NJU Date · 灵魂匹配测试         ║`);
  console.log(`  ║    亲自作答，看看你和谁最合适         ║`);
  console.log(`  ╚═══════════════════════════════════════╝${c.reset}`);
  console.log(`\n  ${c.gray}本次问卷共 ${QUESTIONS.length} 题（精简版），约 3-5 分钟${c.reset}\n`);

  // 健康检查
  const health = await fetch('http://localhost:3000/health').then(r => r.json()).catch(() => null);
  if (!health) {
    console.log(`\n${c.red}✗ 服务器未启动！请先运行: npm start${c.reset}\n`);
    rl.close(); process.exit(1);
  }

  // ─── 注册流程 ────────────────────────────────────────
  console.log(`${c.bold}▶ 注册账号${c.reset}\n`);

  let email, token;
  while (true) {
    email = (await ask(`  南大邮箱 (@smail.nju.edu.cn): `)).trim();
    if (!email.endsWith('@smail.nju.edu.cn')) {
      console.log(`  ${c.red}请使用 @smail.nju.edu.cn 邮箱${c.reset}`);
      continue;
    }
    // 发送验证码
    try {
      await req('POST', '/auth/send-code', { email });
    } catch (e) {
      console.log(`  ${c.red}发送失败: ${e.message}${c.reset}`);
      continue;
    }
    // 从服务器数据库取出验证码（dev 模式）
    const otpData = await req('GET', `/auth/dev-otp?email=${encodeURIComponent(email)}`).catch(() => null);
    if (otpData?.code) {
      console.log(`  ${c.yellow}[开发模式] 你的验证码: ${c.bold}${otpData.code}${c.reset}  ${c.gray}(5分钟有效)${c.reset}`);
    } else {
      console.log(`  ${c.gray}验证码已发送到你的邮箱${c.reset}`);
    }

    // 输入验证码
    const code = (await ask(`  请输入验证码: `)).trim();
    let result;
    try {
      result = await req('POST', '/auth/verify-code', { email, code });
    } catch (e) {
      console.log(`  ${c.red}验证失败，请重试${c.reset}`);
      continue;
    }
    token = result.token;
    console.log(`  ${c.green}✓ ${result.isNewUser ? '注册成功' : '登录成功'}！${c.reset}\n`);
    break;
  }

  // ─── 基本资料 ─────────────────────────────────────────
  console.log(`${c.bold}▶ 完善个人资料${c.reset}\n`);
  const nickname = (await ask(`  你的昵称: `)).trim() || '匿名用户';
  const genderInput = (await ask(`  你的性别 (m=男 f=女): `)).trim().toLowerCase();
  const gender = genderInput === 'm' ? 'male' : 'female';
  const genderPref = gender === 'male' ? 'female' : 'male';
  const department = (await ask(`  所在院系 (回车跳过): `)).trim() || '未填写';
  const wechatId = (await ask(`  微信号 (双向心动后对方才能看到): `)).trim() || 'not_set';
  await req('PUT', '/user/profile', {
    nickname, gender, genderPref,
    grade: '2022', campus: 'xianlin',
    department, wechatId,
  }, token);

  // 注册对照用户（根据性别决定对照人设）
  const botEmail = `bot_${Date.now()}@smail.nju.edu.cn`;
  const botUser = await req('POST', '/auth/dev-token', { email: botEmail });
  const botNickname = gender === 'female' ? '陈远（测试对照）' : '林晓（测试对照）';
  const botGender = gender === 'female' ? 'male' : 'female';
  await req('PUT', '/user/profile', {
    nickname: botNickname, gender: botGender, genderPref: gender,
    grade: '2022', campus: 'xianlin',
    department: gender === 'female' ? '计算机学院' : '文学院',
    mbti: gender === 'female' ? 'ENTP' : 'INFJ',
    bio: gender === 'female' ? '喜欢代码、爬山和尝试新事物' : '喜欢读书和爬山，思考多于行动',
    wechatId: gender === 'female' ? 'chenyuan_bot' : 'linxiao_bot',
  }, botUser.token);

  // 作答
  console.log(`\n${c.bold}▶ 开始作答 — 用 1-7 表示你的同意程度${c.reset}`);
  console.log(`${c.gray}  1=完全不同意  4=中立  7=完全同意${c.reset}\n`);

  const userAnswers = {};
  let lastSection = '';

  for (let i = 0; i < QUESTIONS.length; i++) {
    const q = QUESTIONS[i];
    const sectionChanged = q.section !== lastSection;
    lastSection = q.section;

    process.stdout.write(`\r  进度 ${progress(i, QUESTIONS.length)}\n`);
    const ans = await askLikert(q, sectionChanged);
    userAnswers[q.id] = ans;
  }

  console.log(`\n  ${progress(QUESTIONS.length, QUESTIONS.length)}  ${c.green}完成！${c.reset}\n`);

  // 提交问卷
  console.log(`${c.cyan}▶ 提交问卷中...${c.reset}`);
  await req('POST', '/survey/submit', { answers: buildFullAnswers(userAnswers) }, token);
  await req('POST', '/survey/submit', { answers: botAnswers() }, botUser.token);

  // 清除旧匹配（避免"本周已匹配"冲突），触发新匹配
  const stats = await req('POST', '/admin/trigger-matching', null, token);
  await req('POST', '/admin/unlock-reveal', null, token);

  // 获取结果
  const result = await req('GET', '/match/current', null, token);

  if (result.status !== 'REVEALED') {
    console.log(`\n${c.red}未找到匹配 (${result.status})${c.reset}`);
    rl.close(); return;
  }

  const { match } = result;
  const score = match.insights.overallPercent;
  const dims = match.insights.dimensions;

  // ─── 结果展示 ──────────────────────────────────────
  console.clear();
  console.log(`\n${c.bold}${c.cyan}`);
  console.log(`  ╔═══════════════════════════════════════╗`);
  console.log(`  ║           你的匹配结果出炉了           ║`);
  console.log(`  ╚═══════════════════════════════════════╝${c.reset}\n`);

  // 总分
  const scoreBar = '●'.repeat(Math.round(score / 10)) + '○'.repeat(10 - Math.round(score / 10));
  const scoreColor = score >= 75 ? c.green : score >= 55 ? c.yellow : c.red;
  console.log(`  ${c.bold}对象：${match.partner?.nickname}${c.reset}  ${c.gray}${match.partner?.department} / ${match.partner?.mbti}${c.reset}`);
  console.log(`  ${c.gray}${match.partner?.bio}${c.reset}\n`);
  console.log(`  ${c.bold}灵魂契合度  ${scoreColor}${scoreBar}  ${score}%${c.reset}\n`);

  // 各维度
  const dimNames = {
    dealbreakers: '硬性筛选', values: '底层价值观',
    lifestyle: '生活方式', dynamics: '恋爱动态', spicy: '犀利争议',
  };
  console.log(`  ${c.bold}各维度分析：${c.reset}`);
  for (const [key, label] of Object.entries(dimNames)) {
    const pct = Math.round((dims[key] ?? 0) * 100);
    const filled = Math.round(pct / 10);
    const bar = '▪'.repeat(filled) + '·'.repeat(10 - filled);
    const col = pct >= 75 ? c.green : pct >= 55 ? c.yellow : c.red;
    console.log(`  ${label.padEnd(6)}  ${col}${bar}${c.reset}  ${pct}%`);
  }

  if (match.insights.curatorNote) {
    console.log(`\n  ${c.magenta}${c.bold}策展人手记${c.reset}`);
    console.log(`  ${c.magenta}"${match.insights.curatorNote}"${c.reset}`);
  }

  // 是否心动
  console.log(`\n  ${c.bold}你对这个匹配感兴趣吗？${c.reset}`);
  const action = (await ask(`  (y=心动 / n=算了): `)).trim().toLowerCase();

  if (action === 'y') {
    await req('POST', '/match/action', { matchId: match.matchId, action: 'ACCEPT' }, token);
    // 模拟对方也接受
    await req('POST', '/match/action', { matchId: match.matchId, action: 'ACCEPT' }, botUser.token);
    const final = await req('GET', `/match/result/${match.matchId}`, null, token);
    if (final.status === 'MUTUAL') {
      console.log(`\n  ${c.green}${c.bold}✦ 双向奔赴！对方的微信：${final.partnerContact?.wechatId}${c.reset}\n`);
    }
  } else {
    await req('POST', '/match/action', { matchId: match.matchId, action: 'REJECT' }, token);
    console.log(`\n  ${c.gray}好的，下周再说吧。${c.reset}\n`);
  }

  rl.close();
}

main().catch(err => {
  console.error(`\n${c.red}出错了: ${err.message}${c.reset}\n`);
  rl.close();
  process.exit(1);
});
