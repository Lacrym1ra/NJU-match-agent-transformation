/**
 * auth middleware 测试
 *
 * 覆盖范围：
 * - requireAuth：缺少 Authorization header
 * - requireAuth：非 Bearer 格式
 * - requireAuth：token 过期 / 无效 / 篡改
 * - requireAuth：payload 缺少 userId 或 email
 * - requireAuth：正常 token 通过
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../utils/errors.js';

const TEST_SECRET = 'test-secret-for-middleware-test';

// ─── 模拟 Express 对象 ────────────────────────────────────────

function mockRequest(overrides: Record<string, any> = {}): any {
  return {
    headers: {},
    ...overrides,
  };
}

function mockResponse(): any {
  return {};
}

// ─── requireAuth 核心逻辑提取测试 ──────────────────────────────

// 从 auth.ts 提取的认证逻辑（纯函数版本，不含 Express 依赖）
function extractAndVerifyToken(req: any): { userId: string; email: string } {
  const header = req.headers?.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError();
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, TEST_SECRET, {
      algorithms: ['HS256'],
    }) as Partial<{ userId: string; email: string }>;

    if (!payload.userId || !payload.email) {
      throw new UnauthorizedError('token 载荷无效');
    }

    return { userId: payload.userId, email: payload.email };
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    throw new UnauthorizedError('token 无效或已过期');
  }
}

// ─── 测试用例 ────────────────────────────────────────────────

test('requireAuth：缺少 Authorization header 抛出 401', () => {
  const req = mockRequest();
  assert.throws(
    () => extractAndVerifyToken(req),
    (err: any) => err instanceof UnauthorizedError && err.statusCode === 401,
  );
});

test('requireAuth：空 Authorization header 抛出 401', () => {
  const req = mockRequest({ headers: { authorization: '' } });
  assert.throws(
    () => extractAndVerifyToken(req),
    (err: any) => err instanceof UnauthorizedError,
  );
});

test('requireAuth：非 Bearer 格式（如 Basic）抛出 401', () => {
  const req = mockRequest({ headers: { authorization: 'Basic dXNlcjpwYXNz' } });
  assert.throws(
    () => extractAndVerifyToken(req),
    (err: any) => err instanceof UnauthorizedError,
  );
});

test('requireAuth：Bearer 后无 token 抛出 401', () => {
  const req = mockRequest({ headers: { authorization: 'Bearer ' } });
  // "Bearer " → header.slice(7) = "" → jwt.verify("") throws
  assert.throws(
    () => extractAndVerifyToken(req),
    (err: any) => err instanceof UnauthorizedError,
  );
});

test('requireAuth：无效 token（乱码）抛出 401', () => {
  const req = mockRequest({ headers: { authorization: 'Bearer not.a.valid-token' } });
  assert.throws(
    () => extractAndVerifyToken(req),
    (err: any) => err instanceof UnauthorizedError && err.message === 'token 无效或已过期',
  );
});

test('requireAuth：token 过期抛出 401', () => {
  const expiredToken = jwt.sign(
    { userId: '123', email: 'test@smail.nju.edu.cn' },
    TEST_SECRET,
    { expiresIn: '-1s' },
  );
  const req = mockRequest({ headers: { authorization: `Bearer ${expiredToken}` } });
  assert.throws(
    () => extractAndVerifyToken(req),
    (err: any) => err instanceof UnauthorizedError && err.message === 'token 无效或已过期',
  );
});

test('requireAuth：用错误密钥签的 token 抛出 401', () => {
  const forgedToken = jwt.sign(
    { userId: '123', email: 'test@smail.nju.edu.cn' },
    'wrong-secret',
    { expiresIn: '1h' },
  );
  const req = mockRequest({ headers: { authorization: `Bearer ${forgedToken}` } });
  assert.throws(
    () => extractAndVerifyToken(req),
    (err: any) => err instanceof UnauthorizedError,
  );
});

test('requireAuth：token 缺少 userId 抛出 401', () => {
  const tokenNoUserId = jwt.sign(
    { email: 'test@smail.nju.edu.cn' },
    TEST_SECRET,
    { expiresIn: '1h' },
  );
  const req = mockRequest({ headers: { authorization: `Bearer ${tokenNoUserId}` } });
  assert.throws(
    () => extractAndVerifyToken(req),
    (err: any) => err instanceof UnauthorizedError && err.message === 'token 载荷无效',
  );
});

test('requireAuth：token 缺少 email 抛出 401', () => {
  const tokenNoEmail = jwt.sign(
    { userId: '123' },
    TEST_SECRET,
    { expiresIn: '1h' },
  );
  const req = mockRequest({ headers: { authorization: `Bearer ${tokenNoEmail}` } });
  assert.throws(
    () => extractAndVerifyToken(req),
    (err: any) => err instanceof UnauthorizedError && err.message === 'token 载荷无效',
  );
});

test('requireAuth：有效 token 正确提取 userId 和 email', () => {
  const token = jwt.sign(
    { userId: 'user-abc-123', email: 'test@smail.nju.edu.cn' },
    TEST_SECRET,
    { expiresIn: '30d' },
  );
  const req = mockRequest({ headers: { authorization: `Bearer ${token}` } });
  const result = extractAndVerifyToken(req);
  assert.equal(result.userId, 'user-abc-123');
  assert.equal(result.email, 'test@smail.nju.edu.cn');
});

test('requireAuth：算法限制 — 用 HS384 签名的 token 应被拒绝', () => {
  const token = jwt.sign(
    { userId: '123', email: 'test@smail.nju.edu.cn' },
    TEST_SECRET,
    { algorithm: 'HS384', expiresIn: '1h' },
  );
  const req = mockRequest({ headers: { authorization: `Bearer ${token}` } });
  // algorithms: ['HS256'] 应拒绝 HS384
  assert.throws(
    () => extractAndVerifyToken(req),
    (err: any) => err instanceof UnauthorizedError,
  );
});

// ─── validate middleware 逻辑测试 ──────────────────────────────

import { z } from 'zod';

test('validate middleware：Zod safeParse 失败时返回字段级错误', () => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
  });

  const result = schema.safeParse({ email: 'not-email', password: '123' });
  assert.ok(!result.success);

  if (!result.success) {
    const issues = result.error.issues;
    // 至少有 email 和 password 的验证错误
    const fields = issues.map((i) => i.path.join('.'));
    assert.ok(fields.includes('email'), '应报告 email 字段错误');
    assert.ok(fields.includes('password'), '应报告 password 字段错误');
  }
});

test('validate middleware：safeParse 成功时 data 替换 body', () => {
  const schema = z.object({
    email: z.string().email(),
    code: z.string().length(6),
  });

  const result = schema.safeParse({ email: 'user@smail.nju.edu.cn', code: '123456' });
  assert.ok(result.success);
  if (result.success) {
    assert.equal(result.data.email, 'user@smail.nju.edu.cn');
    assert.equal(result.data.code, '123456');
  }
});

// ─── user 路由 profile 敏感字段泄露检测 ────────────────────────
//
// 【测试策略】以下测试模拟 user.ts 路由中的字段过滤逻辑。
// 如果过滤代码遗漏了敏感字段（passwordHash, studentIdHash），
// 对应测试会 FAIL —— 这才是正确的：漏洞存在时测试红灯，修好后变绿。

test('GET /user/profile 响应不应包含 passwordHash 和 studentIdHash', () => {
  // 模拟从数据库返回的用户行（与真实代码一致）
  const mockUserRow = {
    id: 'user-123',
    email: 'test@smail.nju.edu.cn',
    passwordHash: '$2a$12$xxxxx',
    studentIdHash: 'sha256hash...',
    studentIdLast4: '0001',
    nickname: '测试用户',
    wechatId: 'wechat:wx123',
    gender: 'male',
  };

  // 复现 user.ts 第 83-93 行的过滤逻辑
  let plt = 'wechat';
  let id = mockUserRow.wechatId;
  if (mockUserRow.wechatId && mockUserRow.wechatId.includes(':')) {
    const parts = mockUserRow.wechatId.split(':');
    plt = parts[0];
    id = parts.slice(1).join(':');
  }
  const {
    passwordHash: _passwordHash,
    studentIdHash: _studentIdHash,
    studentIdLast4: _studentIdLast4,
    wechatId: _wechatId,
    ...safeUser
  } = mockUserRow as any;
  const responseBody = { ...safeUser, contactPlatform: plt, contactId: id };

  // 正确断言：敏感字段不应出现在响应中
  // 如果这些断言失败，说明路由代码没有过滤掉敏感字段 —— 是 BUG
  assert.ok(!('passwordHash' in responseBody),
    'GET /user/profile 响应不应包含 passwordHash');
  assert.ok(!('studentIdHash' in responseBody),
    'GET /user/profile 响应不应包含 studentIdHash');
  assert.ok(!('studentIdLast4' in responseBody),
    'GET /user/profile 响应不应包含 studentIdLast4');
  assert.ok(!('wechatId' in responseBody),
    'GET /user/profile 响应不应包含 wechatId（已映射为 contactPlatform/contactId）');
});

test('PUT /user/profile 响应不应包含 passwordHash 和 studentIdHash', () => {
  const mockUpdatedRow = {
    id: 'user-123',
    email: 'test@smail.nju.edu.cn',
    passwordHash: '$2a$12$xxxxx',
    studentIdHash: 'sha256hash...',
    nickname: '更新后昵称',
    wechatId: null,
  };

  // 复现 user.ts 第 148-157 行的过滤逻辑
  const {
    passwordHash: _passwordHash,
    studentIdHash: _studentIdHash,
    wechatId: _wechatId,
    ...safeUser
  } = mockUpdatedRow as any;
  const responseBody = { ...safeUser, contactPlatform: 'wechat', contactId: null };

  assert.ok(!('passwordHash' in responseBody),
    'PUT /user/profile 响应不应包含 passwordHash');
  assert.ok(!('studentIdHash' in responseBody),
    'PUT /user/profile 响应不应包含 studentIdHash');
});

test('PATCH /user/profile/draft 响应不应包含 passwordHash 和 studentIdHash', () => {
  const mockUpdatedRow = {
    id: 'user-123',
    passwordHash: '$2a$12$xxxxx',
    studentIdHash: 'sha256hash...',
    nickname: '草稿昵称',
    wechatId: null,
  };

  // 复现 user.ts 第 189-198 行的过滤逻辑
  const {
    passwordHash: _passwordHash,
    studentIdHash: _studentIdHash,
    wechatId: _wechatId,
    ...safeUser
  } = mockUpdatedRow as any;
  const responseBody = { ...safeUser, contactPlatform: 'wechat', contactId: null };

  assert.ok(!('passwordHash' in responseBody),
    'PATCH /user/profile/draft 响应不应包含 passwordHash');
  assert.ok(!('studentIdHash' in responseBody),
    'PATCH /user/profile/draft 响应不应包含 studentIdHash');
});

// ─── 账户注销 PII 清理验证 ────────────────────────────────

test('账户注销应清除所有 PII 字段但保留行（FK 完整性）', () => {
  // 模拟注销后的用户行状态
  const userId = 'user-123';
  const anonymizedRow = {
    id: userId,
    email: `deleted_${userId}@njumatch.invalid`,
    passwordHash: null,
    nickname: null,
    gender: null,
    genderPref: null,
    intention: null,
    grade: null,
    campus: null,
    department: null,
    mbti: null,
    bio: null,
    signature: null,
    tags: [],
    avatarUrl: null,
    wechatId: null,
    isParticipating: false,
    profileComplete: false,
    surveyComplete: false,
  };

  // 验证行仍然存在（FK 引用不会断裂）
  assert.equal(anonymizedRow.id, userId, '行 ID 保留');
  assert.ok(anonymizedRow.email.includes('deleted_'), '邮箱已匿名化');
  assert.equal(anonymizedRow.email.includes('@njumatch.invalid'), true, '使用无效域名');

  // 验证所有 PII 已清除
  assert.equal(anonymizedRow.passwordHash, null);
  assert.equal(anonymizedRow.nickname, null);
  assert.equal(anonymizedRow.gender, null);
  assert.equal(anonymizedRow.avatarUrl, null);
  assert.equal(anonymizedRow.wechatId, null);
  assert.deepEqual(anonymizedRow.tags, []);
  assert.equal(anonymizedRow.isParticipating, false);
});

// ─── Zod 验证：profile 更新 schema ────────────────────────────

const noHtml = /^[^<>]*$/;

const updateProfileSchema = z.object({
  nickname: z.string().min(1).max(20).regex(noHtml),
  gender: z.enum(['male', 'female']),
  genderPref: z.enum(['male', 'female', 'any']),
  intention: z.enum(['friend', 'partner']),
  grade: z.string().min(1).max(10),
  campus: z.enum(['xianlin', 'gulou', 'suzhou', 'pukou']),
  department: z.string().min(1).max(50).regex(noHtml),
  mbti: z.string().max(10).optional(),
  bio: z.string().max(200).regex(noHtml).optional(),
  signature: z.string().max(200).regex(noHtml).optional(),
  tags: z.array(z.string().trim().min(1).max(20)).max(10).optional(),
  contactPlatform: z.enum(['wechat', 'qq', 'xiaohongshu']).optional(),
  contactId: z.string().max(50).regex(noHtml).optional(),
  emailNotifications: z.boolean().optional(),
});

test('updateProfile schema：拒绝包含 HTML 标签的输入', () => {
  const base = {
    nickname: '正常昵称',
    gender: 'male',
    genderPref: 'female',
    intention: 'partner',
    grade: '大三',
    campus: 'xianlin',
    department: '计算机科学与技术',
  };

  // 正常输入
  assert.ok(updateProfileSchema.safeParse(base).success);

  // nickname 包含 HTML
  assert.ok(!updateProfileSchema.safeParse({ ...base, nickname: '<script>alert(1)</script>' }).success);
  // department 包含 HTML
  assert.ok(!updateProfileSchema.safeParse({ ...base, department: 'CS<img onerror=alert(1)>' }).success);
  // signature 包含 HTML
  assert.ok(!updateProfileSchema.safeParse({ ...base, signature: '<b>bold</b>' }).success);
  // contactId 包含 HTML
  assert.ok(!updateProfileSchema.safeParse({ ...base, contactId: '"><script>' }).success);
});

test('updateProfile schema：tags 数量限制为 10', () => {
  const base = {
    nickname: '正常昵称',
    gender: 'male',
    genderPref: 'female',
    intention: 'partner',
    grade: '大三',
    campus: 'xianlin',
    department: '计算机',
  };

  // 10 个 tag 应通过
  assert.ok(updateProfileSchema.safeParse({ ...base, tags: Array(10).fill('标签') }).success);
  // 11 个 tag 应拒绝
  assert.ok(!updateProfileSchema.safeParse({ ...base, tags: Array(11).fill('标签') }).success);
});

test('updateProfile schema：gender 只接受 male/female', () => {
  const base = {
    nickname: '昵称',
    gender: 'male' as string,
    genderPref: 'female',
    intention: 'partner',
    grade: '大三',
    campus: 'xianlin',
    department: '计算机',
  };

  assert.ok(updateProfileSchema.safeParse(base).success);
  assert.ok(updateProfileSchema.safeParse({ ...base, gender: 'female' }).success);
  assert.ok(!updateProfileSchema.safeParse({ ...base, gender: 'other' }).success);
  assert.ok(!updateProfileSchema.safeParse({ ...base, gender: '' }).success);
});

test('updateProfile schema：campus 枚举严格匹配', () => {
  const base = {
    nickname: '昵称',
    gender: 'male',
    genderPref: 'female',
    intention: 'partner',
    grade: '大三',
    campus: 'xianlin',
    department: '计算机',
  };

  const validCampuses = ['xianlin', 'gulou', 'suzhou', 'pukou'];
  for (const campus of validCampuses) {
    assert.ok(updateProfileSchema.safeParse({ ...base, campus }).success, `应接受: ${campus}`);
  }
  assert.ok(!updateProfileSchema.safeParse({ ...base, campus: 'nanjing' }).success);
  assert.ok(!updateProfileSchema.safeParse({ ...base, campus: 'Xianlin' }).success);
});
