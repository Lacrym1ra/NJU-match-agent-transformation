#!/usr/bin/env node
/**
 * NJU Date — 全流程终端测试脚本
 * 用法: node scripts/test-flow.js
 * 前提: 服务器已在 localhost:3000 运行 (npm run dev)
 */

const BASE = 'http://localhost:3000/api/v1';
const ADMIN_KEY = 'dev-admin-key';

// ─── 颜色输出 ───────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
};
const ok = (msg) => console.log(`${c.green}✓${c.reset} ${msg}`);
const fail = (msg) => console.log(`${c.red}✗${c.reset} ${msg}`);
const step = (msg) => console.log(`\n${c.cyan}${c.bold}▶ ${msg}${c.reset}`);
const info = (msg) => console.log(`  ${c.gray}${msg}${c.reset}`);

// ─── HTTP 工具 ──────────────────────────────────────────
async function req(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (path.includes('/admin/')) headers['X-Admin-Key'] = ADMIN_KEY;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

// ─── 生成问卷答案 ───────────────────────────────────────
function makeAnswers(profile) {
  // profile: 'A' = 内向保守型，'B' = 外向开放型，'C' = 极端不兼容型
  const defaults = {
    A: { base: 3, social: 2, open: 3 },
    B: { base: 5, social: 6, open: 6 },
    C: { base: 7, social: 7, open: 1 }, // 和 A/B 都不兼容
  }[profile];

  const answers = {};
  const imp = (v, i = 2) => ({ value: v, importance: i });

  // q1-q8 硬性筛选 (dealbreakers)
  answers.q1 = imp(2, 1);   // 宗教：不重要
  answers.q2 = imp(profile === 'C' ? 7 : 3, profile === 'C' ? 3 : 1); // 政治立场
  answers.q3 = imp(defaults.base, 2);   // 要孩子
  answers.q4 = imp(6, 2);   // 不接受吸烟
  answers.q5 = imp(2, 1);   // 酒：随意
  answers.q6 = imp(profile === 'A' ? 5 : 3, 1); // 宠物
  answers.q7 = imp(profile === 'C' ? 1 : 5, 2); // 异地
  answers.q8 = imp(2, 1);   // 感情经历：随意

  // q9 多选：核心价值观
  const valuesA = ['诚实', '忠诚', '家庭', '善良'];
  const valuesB = ['诚实', '忠诚', '好奇心', '创造力'];
  const valuesC = ['野心', '自由', '冒险', '好胜'];
  answers.q9 = { value: profile === 'A' ? valuesA : profile === 'B' ? valuesB : valuesC, importance: 0 };

  // q10-q18 价值观
  answers.q10 = imp(profile === 'C' ? 7 : 2, 2); // 物质 vs 精神
  answers.q11 = imp(defaults.social, 2);
  answers.q12 = imp(profile === 'A' ? 5 : 3, 1);
  answers.q13 = imp(profile === 'A' ? 6 : 3, 2);
  answers.q14 = imp(3, 1);
  answers.q15 = imp(defaults.base, 1);
  answers.q16 = imp(profile === 'A' ? 5 : 2, 1);
  answers.q17 = imp(profile === 'C' ? 7 : defaults.open, 1);
  answers.q18 = imp(3, 1);

  // q19-q28 生活方式
  answers.q19 = imp(profile === 'A' ? 5 : 3, 2); // 早起
  answers.q20 = imp(profile === 'A' ? 6 : 2, 2); // 宅家
  answers.q21 = imp(4, 1);
  answers.q22 = imp(profile === 'A' ? 6 : 3, 2); // 计划性
  answers.q23 = imp(defaults.social, 1);
  answers.q24 = imp(profile === 'A' ? 6 : 3, 1);
  answers.q25 = imp(profile === 'B' ? 5 : 2, 1);
  answers.q26 = imp(profile === 'A' ? 6 : 3, 2); // 独处时间
  answers.q27 = imp(4, 1);
  answers.q28 = imp(defaults.base, 1);

  // q29-q42 恋爱动态
  answers.q29 = imp(profile === 'C' ? 7 : 2, 2); // 传统性别
  answers.q30 = imp(profile === 'A' ? 2 : 5, 2); // 立刻沟通
  answers.q31 = imp(4, 1);
  answers.q32 = imp(2, 2); // 查手机
  answers.q33 = imp(defaults.base, 2);
  answers.q34 = imp(defaults.open, 1);
  answers.q35 = imp(profile === 'C' ? 7 : 3, 2); // 占有欲
  answers.q36 = imp(defaults.social, 1);
  answers.q37 = imp(3, 1);
  answers.q38 = imp(profile === 'C' ? 1 : 5, 2); // 接受异性好友
  answers.q39 = imp(3, 1);
  answers.q40 = imp(4, 1);
  answers.q41 = imp(profile === 'C' ? 7 : 3, 1); // 实时定位
  answers.q42 = imp(profile === 'A' ? 5 : 2, 2); // 冷战

  // q43-q53 犀利争议
  answers.q43 = imp(profile === 'C' ? 7 : 3, 1); // 自认聪明
  answers.q44 = imp(2, 1);
  answers.q45 = imp(profile === 'C' ? 7 : 2, 2);
  answers.q46 = imp(3, 1);
  answers.q47 = imp(3, 1);
  answers.q48 = imp(profile === 'C' ? 7 : 2, 1); // 好胜心
  answers.q49 = imp(1, 3); // 出轨：绝对不 (importance=3 dealbreaker)
  answers.q50 = imp(3, 1);
  answers.q51 = imp(3, 1);
  answers.q52 = imp(profile === 'C' ? 7 : 3, 1);
  answers.q53 = imp(3, 1);

  // q54 爱的语言排序
  const langA = ['高质量的陪伴', '肯定的话语', '服务的行动', '身体接触', '接受礼物'];
  const langB = ['高质量的陪伴', '肯定的话语', '身体接触', '接受礼物', '服务的行动'];
  const langC = ['接受礼物', '身体接触', '肯定的话语', '服务的行动', '高质量的陪伴'];
  answers.q54 = { value: profile === 'A' ? langA : profile === 'B' ? langB : langC, importance: 0 };

  // q55-q60 权重与开放题
  answers.q55 = { value: '价值观', importance: 0 };
  answers.q56 = { value: 49, importance: 0 }; // q49 出轨题
  answers.q57 = { value: profile === 'A' ? '陪父母吃最后一顿饭' : '和朋友去喝一杯', importance: 0 };
  answers.q58 = { value: profile === 'A' ? '对服务员态度差' : '一直玩手机不看我', importance: 0 };
  answers.q59 = { value: profile === 'A' ? '保研成功' : '独自背包旅行三个月', importance: 0 };
  answers.q60 = { value: '仙林食堂的鸡腿饭：价格每年涨，分量每年缩，唯一不变的是我的失望', importance: 0 };

  return answers;
}

// ─── 主流程 ─────────────────────────────────────────────
async function main() {
  console.log(`\n${c.bold}╔══════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.bold}║     NJU Date 全流程测试                  ║${c.reset}`);
  console.log(`${c.bold}╚══════════════════════════════════════════╝${c.reset}`);

  // 0. 健康检查
  step('0. 服务器健康检查');
  const health = await fetch('http://localhost:3000/health').then(r => r.json()).catch(() => null);
  if (!health) {
    fail('服务器未启动！请先运行: cd backend && npm run dev');
    process.exit(1);
  }
  ok(`服务器正常 (${health.status})`);

  // 1. 注册两个测试用户（A 内向型，B 外向型）
  step('1. 注册测试用户');
  const userA = await req('POST', '/auth/dev-token', { email: 'user_a@smail.nju.edu.cn' });
  ok(`用户 A 注册成功 | id: ${userA.userId.slice(0, 8)}...`);
  const userB = await req('POST', '/auth/dev-token', { email: 'user_b@smail.nju.edu.cn' });
  ok(`用户 B 注册成功 | id: ${userB.userId.slice(0, 8)}...`);

  const tokenA = userA.token;
  const tokenB = userB.token;

  // 2. 完善个人资料
  step('2. 完善个人资料');
  await req('PUT', '/user/profile', {
    nickname: '林晓（测试A）',
    gender: 'female',
    genderPref: 'male',
    grade: '2022',
    campus: 'xianlin',
    department: '文学院',
    mbti: 'INFJ',
    bio: '喜欢读书和爬山，不太喜欢社交',
    wechatId: 'linxiao_test',
  }, tokenA);
  ok('用户 A 资料更新完成');

  await req('PUT', '/user/profile', {
    nickname: '陈远（测试B）',
    gender: 'male',
    genderPref: 'female',
    grade: '2022',
    campus: 'xianlin',
    department: '计算机学院',
    mbti: 'ENTP',
    bio: '喜欢代码、爬山和尝试新事物',
    wechatId: 'chenyuan_test',
  }, tokenB);
  ok('用户 B 资料更新完成');

  // 3. 提交问卷
  step('3. 提交问卷（60题）');
  await req('POST', '/survey/submit', { answers: makeAnswers('A') }, tokenA);
  ok('用户 A 问卷提交完成');
  await req('POST', '/survey/submit', { answers: makeAnswers('B') }, tokenB);
  ok('用户 B 问卷提交完成');

  // 3b. 验证问卷可读取
  const surveyA = await req('GET', '/survey/answers', null, tokenA);
  ok(`用户 A 答卷确认，共 ${Object.keys(surveyA.answers).length} 题`);

  // 4. 触发匹配
  step('4. 触发本周匹配（管理员）');
  const matchStats = await req('POST', '/admin/trigger-matching', null, tokenA);
  ok(`匹配完成 | ${JSON.stringify(matchStats.stats)}`);

  // 5. 解锁揭示
  step('5. 解锁匹配揭示（管理员）');
  const unlockResult = await req('POST', '/admin/unlock-reveal', null, tokenA);
  ok(`${unlockResult.message}`);

  // 6. 查看本周匹配结果
  step('6. 查看匹配结果');
  const matchA = await req('GET', '/match/current', null, tokenA);
  const matchB = await req('GET', '/match/current', null, tokenB);

  if (matchA.status === 'REVEALED') {
    const partner = matchA.match?.partner;
    const score = matchA.match?.insights?.overallPercent;
    ok(`用户 A 找到匹配！`);
    info(`  对象: ${partner?.nickname} (${partner?.department} / ${partner?.mbti})`);
    info(`  兼容度: ${score}%`);
    info(`  各维度: ${JSON.stringify(matchA.match?.insights?.dimensions)}`);
    if (matchA.match?.insights?.curatorNote) {
      info(`  策展人手记: "${matchA.match.insights.curatorNote}"`);
    }
  } else if (matchA.status === 'NO_MATCH') {
    fail(`用户 A 未找到匹配 — 可能用户数量不足或性别偏好不匹配`);
    info(`  提示: 测试脚本注册了 female+male_pref(A) 和 male+female_pref(B)，应该能匹配`);
  } else {
    fail(`用户 A 状态异常: ${matchA.status}`);
  }

  if (matchB.status === 'REVEALED') {
    ok(`用户 B 也已匹配`);
    info(`  兼容度: ${matchB.match?.insights?.overallPercent}%`);
  }

  // 7. 双方 ACCEPT
  step('7. 双向心动（ACCEPT）');
  if (matchA.status === 'REVEALED' && matchA.match?.matchId) {
    const matchId = matchA.match.matchId;

    await req('POST', '/match/action', { matchId, action: 'ACCEPT' }, tokenA);
    ok('用户 A → ACCEPT');

    await req('POST', '/match/action', { matchId, action: 'ACCEPT' }, tokenB);
    ok('用户 B → ACCEPT');

    // 8. 查看最终结果（应该是 MUTUAL）
    step('8. 查看最终结果');
    const result = await req('GET', `/match/result/${matchId}`, null, tokenA);
    if (result.status === 'MUTUAL') {
      ok(`双向奔赴成功！`);
      info(`  用户 B 的微信: ${result.partnerContact?.wechatId}`);
    } else {
      fail(`期望 MUTUAL，实际: ${result.status}`);
    }
  } else {
    info('跳过 ACCEPT 测试（未找到匹配）');
  }

  // 9. 查看历史记录
  step('9. 历史匹配记录');
  const history = await req('GET', '/match/history', null, tokenA);
  ok(`历史记录共 ${history.total} 条`);

  // ─── 总结 ───
  console.log(`\n${c.bold}${c.green}═══════════════════════════════════════════${c.reset}`);
  console.log(`${c.bold}${c.green}  全流程测试完成 ✓${c.reset}`);
  console.log(`${c.bold}${c.green}═══════════════════════════════════════════${c.reset}\n`);
}

main().catch((err) => {
  console.error(`\n${c.red}${c.bold}测试失败:${c.reset} ${err.message}\n`);
  process.exit(1);
});
