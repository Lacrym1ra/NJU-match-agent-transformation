# 安全审计报告

> 审计日期：2026-04-10  
> 审计范围：backend API 层、鉴权流程、数据存储  
> 状态标注：✅ 已修复 / 🔲 待修复 / ℹ️ 知情决策（接受风险）

---

## 摘要

整体安全基线较好：使用 bcrypt(12) 存储密码、OTP 暴力破解有封锁机制、管理接口有时间安全比对、输入校验覆盖主要接口、错误信息不暴露堆栈。但存在以下需要关注的问题。

---

## 问题清单

### 🔴 高危

#### #1 `/auth/login` 缺少独立限频 ✅ 已修复

**位置**：`backend/src/routes/auth.ts:81`

**描述**：登录端点仅受全局 `apiLimiter`（1000次/15分钟/IP）保护，没有应用 `authVerifyCodeLimiter`。攻击者可在 15 分钟内对同一账号尝试 1000 次密码，覆盖常见密码字典。

**修复**：为 `POST /auth/login` 添加 `authVerifyCodeLimiter`（20次/10分钟/IP）。

---

### 🟠 中危

#### #2 OTP 明文存储在数据库 🔲 待修复

**位置**：`backend/src/db/schema.ts:64`，`backend/src/services/authService.ts:118`

**描述**：`otp_codes` 表存储明文验证码。数据库泄漏时，攻击者可直接读取在有效期内的 OTP，绕过邮件验证流程。

**建议修复**：存储时改为 `SHA-256(code)`，验证时对比 hash。OTP 本身仍发送原始数字给用户。

```ts
// 存储
import { createHash } from 'crypto';
const codeHash = createHash('sha256').update(code).digest('hex');
await db.insert(otpCodes).values({ email, purpose, code: codeHash, expiresAt });

// 验证（在 consumeOtp 中对比 hash）
eq(otpCodes.code, createHash('sha256').update(code).digest('hex'))
```

#### #3 JWT 有效期 30 天，无吊销机制 ℹ️ 知情决策

**位置**：`backend/src/config.ts:32`

**描述**：Token 有效期 30 天，无 refresh token 机制，无 token 黑名单。用户注销账号后旧 token 仍然有效。

**权衡**：实现 token 吊销需要引入 Redis 或数据库黑名单，增加每次请求的查询开销。对于当前用户规模，可接受此风险。

**建议**：至少在 `DELETE /user/account` 时在 token payload 中引入 `version` 字段，并在 DB 中存储当前版本；或将有效期缩短至 7 天。

#### #4 `/user/pause-week` 缺少输入校验 ✅ 已修复

**位置**：`backend/src/routes/user.ts:191`

**描述**：直接使用类型断言 `req.body as { pause: boolean }`，未经 zod schema 验证。传入非 boolean 值（如字符串 `"true"`、数字 `1`）时行为依赖 JS 隐式类型转换。

**修复**：添加 `z.object({ pause: z.boolean() })` schema 并通过 `validate()` 中间件校验。

#### #5 OTP 频率计数器存于进程内存 ℹ️ 知情决策

**位置**：`backend/src/services/authService.ts:13-14`

**描述**：`otpCooldowns` 和 `otpVerifyFailures` 使用进程内 `Map`，服务重启或多实例部署时计数器重置，OTP 封锁机制失效。

**权衡**：当前单实例部署，重启攻击成本较高。如果扩展到多实例，需迁移至 Redis。

**建议**：记录此技术债；扩容前优先迁移至 Redis。

---

### 🟡 低危 / 配置问题

#### #6 生产环境 secret 使用默认值不抛错 ✅ 已修复

**位置**：`backend/src/config.ts:31-37`

**描述**：`JWT_SECRET` 和 `ADMIN_KEY` 未配置时退回到明文默认值 `dev-secret-change-me` / `dev-admin-key`，生产环境误部署时不会有任何告警。

**修复**：非开发环境时，若环境变量缺失直接 `throw Error`，阻止服务启动。

#### #7 `/admin/ping` 无需鉴权 ✅ 已修复

**位置**：`backend/src/routes/admin.ts:49`

**描述**：`GET /admin/ping` 不需要 `requireAdmin`，任何人均可探测 admin 端点是否存在及服务状态。

**修复**：添加 `requireAdmin` 中间件。

#### #8 Helmet 禁用了 CSP 🔲 待修复

**位置**：`backend/src/index.ts:26`

**描述**：`contentSecurityPolicy: false` 完全禁用了 Content Security Policy，浏览器层面没有针对 XSS 的防线。

**建议**：配置适合当前前端架构的 CSP，至少启用 `default-src 'self'`。注意与前端 SPA 的兼容性需要测试。

#### #9 `/match/result/:matchId` 返回冗余 `wechatId` 字段 ✅ 已修复

**位置**：`backend/src/routes/match.ts:183`

**描述**：响应中同时返回了已解析的 `contactPlatform`/`contactId` 以及原始 `wechatId`（含 `platform:id` 前缀），暴露了内部存储格式。

**修复**：从响应中删除 `wechatId` 字段，只返回解析后的字段。

---

## 已有的安全措施（良好实践）

| 项目 | 实现 |
|---|---|
| 密码存储 | bcrypt，12 rounds |
| 密码比对 | `bcrypt.compare`（时间恒定） |
| Admin key 比对 | `crypto.timingSafeEqual`（时间恒定） |
| OTP 暴力破解防护 | 10分钟内失败8次封锁15分钟 |
| JWT 算法固定 | `algorithms: ['HS256']`，防止 none 攻击 |
| 输入校验 | zod schema 覆盖主要接口 |
| 邮箱域名限制 | 仅接受 `@smail.nju.edu.cn` |
| 请求体大小限制 | `jsonBodyLimit: '256kb'` |
| 全局限频 | 1000次/15分钟 |
| OTP 60秒冷却 | 防止邮件轰炸 |
| 错误信息处理 | 不暴露堆栈，统一格式 |
| 用户数据隔离 | 所有用户接口用 `req.auth!.userId`，不接受 userId 参数 |
| CORS 白名单 | 基于 `FRONTEND_URLS` 配置 |
| Helmet | 启用（CSP 除外） |
| 审计日志 | 管理员操作记录至 `audit_logs` 表 |
| 账号注销脱敏 | PII 字段清零，不物理删除用户行 |
