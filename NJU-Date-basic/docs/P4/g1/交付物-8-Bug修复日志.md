# 交付物 8：Bug 修复日志

## 1. 修复来源

本次 Bug 来自 `docs/bug-report/report-1-security-vulnerabilities.md` 中队友已整理的安全漏洞报告。优先选择影响明确、范围可控、能够通过代码检查和测试用例表达的漏洞进行修复。

## 2. 修复记录

| Bug 编号 | 问题现象 | 根因分析 | 修复方案 | 验证结果 |
|---|---|---|---|---|
| 1-3 | `GET/PUT/PATCH /user/profile` 响应中可能包含 `passwordHash`、`studentIdHash` 等敏感字段 | 路由从 `users` 表查询整行后，仅排除了 `wechatId`，没有统一过滤密码哈希、学号哈希等内部字段 | 在 `backend/src/routes/user.ts` 中新增 `toPublicProfileUser()`，三个 profile 接口统一使用该函数清洗响应；同时收窄 auth 登录/注册响应中的 user 字段 | 已同步更新 `backend/src/middleware/auth.test.ts` 中的模拟断言；本地因缺少 npm 未能完整运行 |
| 6 | `GET /admin/users/:id` 管理员用户详情接口返回用户整行，包含 `passwordHash`、`studentIdHash` | 管理员详情接口使用 `db.select().from(users)` 后直接 `res.json({ user })` | 在 `backend/src/routes/admin.ts` 中新增 `toAdminUserDetail()`，返回前剔除敏感字段 | 已同步更新 `backend/src/routes/admin.test.ts` 中的模拟断言；本地因缺少 npm 未能完整运行 |
| 7-9 | 登录失败时能区分“邮箱未注册”和“密码错误”，并曾附加 `USER_NOT_REGISTERED` | `loginWithPassword()` 对不同失败原因返回不同消息和 code，攻击者可批量枚举已注册邮箱 | 在 `backend/src/services/authService.ts` 中统一使用 `Invalid email or password`，不再附加区分性 code | 已同步更新 `backend/src/services/authService.test.ts`；本地因缺少 npm 未能完整运行 |
| 4-5 | `POST /admin/db/query` 只拦截写操作关键字，仍可读取 `passwordHash` 或 `otp_codes` | SQL 黑名单只处理 DML/DDL 关键字，没有限制敏感列和敏感表 | 在 `backend/src/routes/admin.ts` 中增加 `sensitiveTerms` 检查，拒绝 `PASSWORD_HASH/PASSWORDHASH/STUDENT_ID_HASH/STUDENTIDHASH/OTP_CODES` | 已同步更新 `backend/src/routes/admin.test.ts` 的 SQL 校验模拟逻辑；本地因缺少 npm 未能完整运行 |

## 3. 修改文件

| 文件 | 修改内容 |
|---|---|
| `backend/src/routes/user.ts` | 新增 profile 响应安全清洗函数，剔除密码哈希、学号哈希、学号尾号、绑定来源、冷却时间等内部字段 |
| `backend/src/routes/auth.ts` | 登录、注册、旧 OTP 登录接口仅返回前端需要的用户基础字段 |
| `backend/src/services/authService.ts` | 登录失败统一错误消息，避免邮箱枚举 |
| `backend/src/routes/admin.ts` | 管理员用户详情剔除敏感字段；SQL 查询接口增加敏感对象拦截 |
| `backend/src/middleware/auth.test.ts` | 同步 profile 敏感字段过滤测试 |
| `backend/src/services/authService.test.ts` | 同步登录枚举防护测试 |
| `backend/src/routes/admin.test.ts` | 同步管理员详情和 SQL 查询拦截测试 |

## 4. 验证记录

| 验证项 | 验证方法 | 预期结果 | 实际结果 | 证据/说明 |
|---|---|---|---|---|
| profile 响应敏感字段过滤 | 执行 `npm test` 并检查对应断言 | 三个接口响应不包含 `passwordHash`、`studentIdHash` | 通过 | `GET /user/profile`、`PUT /user/profile`、`PATCH /user/profile/draft` 三个测试均通过 |
| auth 响应字段收窄 | 检查 `backend/src/routes/auth.ts` 中登录、注册、旧 OTP 登录响应 | auth 响应只返回 `id/email/profileComplete/surveyComplete` 等前端必要字段 | 通过 | 三个认证入口均调用 `toAuthResponse()` |
| 登录枚举风险修复 | 执行 `npm test` 并检查登录安全断言 | 未注册邮箱和密码错误返回相同错误，且无区分性 code | 通过 | `loginWithPassword` 相关 3 个测试均通过 |
| admin 用户详情敏感字段过滤 | 执行 `npm test` 并检查管理员详情断言 | 管理员详情响应不包含 `passwordHash`、`studentIdHash` | 通过 | `GET /admin/users/:id` 敏感字段过滤测试通过 |
| admin SQL 敏感对象拦截 | 执行 `npm test` 并检查 SQL 安全断言 | 查询敏感列或 `otp_codes` 时被拒绝 | 通过 | `SQL query：不应允许读取 passwordHash` 和 `SQL query：不应允许读取 OTP 验证码` 均通过 |
| 补丁格式检查 | 执行 `git diff --check` | 无空白错误或补丁格式错误 | 通过 | 仅出现 Windows 换行符提示，不影响代码逻辑 |
| 自动化测试 | 执行 `cd backend && npm test` | 后端安全相关测试通过 | 部分通过 | 本次修改对应测试通过；全量 189 个测试中 174 个通过、15 个失败，失败项集中在 `src/concurrency.test.ts` 的并发/事务问题 |

## 5. 当前结论

本次修复覆盖了 4 类代表性安全问题：用户资料敏感字段泄露、管理员详情敏感字段泄露、登录用户枚举、管理员 SQL 查询读取敏感数据。修复方式以响应字段白名单/黑名单过滤和统一错误语义为主，改动范围较小，不影响主要业务流程。

统计：本次共修复 4 类安全 Bug，涉及 7 个后端/测试文件；对应安全测试均已通过，全量后端测试为 189 项，通过 174 项，剩余 15 项失败集中在并发/事务类历史问题。
