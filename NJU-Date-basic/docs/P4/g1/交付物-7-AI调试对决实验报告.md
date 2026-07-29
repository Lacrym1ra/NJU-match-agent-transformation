# 交付物 7：AI 调试对决实验报告

## 1. 实验目标

本实验从 P4 阶段 bugreport 中选择 3 个真实安全 Bug，对比“纯人工调试”和“AI 辅助调试”的差异。重点不是证明 AI 一定更快，而是观察 AI 在不同类型 Bug 中的定位能力、修复建议质量，以及人工工程判断在最终方案中的作用。

实验记录包括：

- 人工如何根据 bugreport 和代码定位问题
- 向 AI 提供了哪些上下文
- AI 首轮判断是否准确
- AI 建议是否存在过度理想化或忽略工程约束的问题
- 最终是否采纳 AI 建议，以及为什么

## 2. 实验对象

| Bug # | Bug 描述 | 来源 |
|---|---|---|
| A | 登录失败信息区分“未注册”和“密码错误”，导致邮箱枚举风险 | `docs/bug-report/report-1-security-vulnerabilities.md` 漏洞 7-9 |
| B | `/user/profile` 系列接口返回 `passwordHash`、`studentIdHash` 等敏感字段 | `docs/bug-report/report-1-security-vulnerabilities.md` 漏洞 1-3 |
| C | 管理员 SQL 查询接口可读取密码哈希和 OTP 表 | `docs/bug-report/report-1-security-vulnerabilities.md` 漏洞 4-5 |

## 3. 对比记录

| Bug # | Bug 描述 | 纯人工定位耗时 | AI 辅助定位耗时 | AI 定位是否准确 | AI 修复方案是否可用 | 最终方案来源 |
|---|---|---:|---:|---|---|---|
| A | 登录错误信息暴露邮箱注册状态 | 18 分钟 | 4 分钟 | 准确 | 可用 | AI 建议 + 人工确认 |
| B | profile API 返回敏感字段 | 9 分钟 | 6 分钟 | 准确 | 基本可用 | AI 建议 + 人工扩展字段 |
| C | Admin SQL Query 可读取敏感列/表 | 32 分钟 | 19 分钟 | 部分准确 | 首轮不可直接采用 | 人工方案为主 |

说明：耗时为从开始阅读对应代码到形成可执行修复方案的时间，不包含最终写文档时间。

## 4. AI 输入上下文

### Bug A 输入给 AI 的信息

Prompt 摘要：

```text
这是一个登录接口安全问题。bugreport 指出 loginWithPassword 在邮箱未注册时返回“该邮箱尚未注册，请先注册账号”，密码错误时返回“密码错误，请重新输入”，并且未注册场景附加 USER_NOT_REGISTERED code。

相关代码在 backend/src/services/authService.ts 的 loginWithPassword。请判断这是否构成用户枚举风险，并给出最小范围修复方案。
```

提供给 AI 的上下文：

- `loginWithPassword()` 的失败分支代码
- bugreport 对漏洞 7-9 的描述
- 登录接口和重置密码接口的行为差异
- 要求：尽量小范围修复，不重构认证模块

AI 首轮输出摘要：

- 判断这是典型用户枚举风险
- 建议未注册和密码错误统一返回相同 message
- 建议不要暴露 `USER_NOT_REGISTERED` 这类区分性 code
- 提醒前端不能依赖该 code 判断跳转注册流程

### Bug B 输入给 AI 的信息

Prompt 摘要：

```text
profile 接口从 users 表查询整行后返回给前端。bugreport 指出 GET/PUT/PATCH /user/profile 可能返回 passwordHash 和 studentIdHash。

请阅读这类代码模式，判断根因，并建议如何避免三个接口分别遗漏字段过滤。
```

提供给 AI 的上下文：

- `backend/src/routes/user.ts` 中三个 profile 接口的返回逻辑
- `db.select().from(users)` 返回整行的事实
- bugreport 对漏洞 1-3 的描述
- 现有前端仍需要 `contactPlatform/contactId` 映射

AI 首轮输出摘要：

- 判断根因是“查询整行 + 响应前只排除少数字段”
- 建议统一封装响应清洗函数
- 建议过滤 `passwordHash`、`studentIdHash`、`wechatId`
- 建议三个 profile 接口复用同一个函数

### Bug C 输入给 AI 的信息

Prompt 摘要：

```text
管理员后台有 POST /admin/db/query，允许管理员提交 SELECT 或 WITH 查询。bugreport 指出它能读取 users.password_hash 和 otp_codes.code。

请从安全角度分析风险，并给出修复方案。注意这是管理后台运维查询能力，不能轻易破坏已有调试功能。
```

提供给 AI 的上下文：

- `/admin/db/query` 的 SQL 校验代码
- bugreport 中读取 `passwordHash` 和 `otp_codes` 的攻击路径
- 管理后台需要一定查询能力
- P4 阶段希望小范围修复，避免大改后台架构

AI 首轮输出摘要：

- 判断原有黑名单只拦截写操作，无法阻止敏感数据读取
- 首先建议直接移除自由 SQL Query 功能
- 第二建议改成预定义查询模板或只读视图白名单
- 对“保留运维查询能力”的约束考虑不足

## 5. 单 Bug 分析

### Bug A：登录用户枚举

人工调试过程：人工先根据 bugreport 定位到 `backend/src/services/authService.ts` 的 `loginWithPassword()`，发现两个失败分支返回不同文案，并且未注册分支曾设置 `USER_NOT_REGISTERED`。人工判断这会让攻击者批量测试 NJU 邮箱是否注册过平台。

AI 辅助过程：AI 在看到代码和漏洞描述后，快速识别为用户枚举风险，并建议统一失败响应。

最终修复：使用统一错误消息 `Invalid email or password`；未注册和密码错误都抛出相同的 `UnauthorizedError`，不再设置区分性 code。

结论：AI 对这类模式化安全问题表现较好，定位速度明显快于人工。人工主要负责确认前端不再依赖 `USER_NOT_REGISTERED` 做流程跳转。

### Bug B：profile 敏感字段泄露

人工调试过程：人工定位到 `backend/src/routes/user.ts` 三个 profile 接口，发现原逻辑只剔除了 `wechatId`，但 `db.select().from(users)` 返回的是整行，因此 `passwordHash`、`studentIdHash` 等字段会进入响应对象。

AI 辅助过程：AI 建议不要在三个接口里分别手写过滤逻辑，而是封装统一清洗函数。这一点比较有价值，因为它降低了以后新增字段时漏过滤的概率。

最终修复：新增 `toPublicProfileUser()`，统一剔除 `passwordHash`、`studentIdHash`、`studentIdLast4`、`studentIdVerifiedAt`、`studentIdBindSource`、`heartboxCooldownUntil` 等内部字段。人工进一步补充了学号绑定相关字段，因为 AI 首轮只点名了报告中出现的敏感字段。

结论：AI 定位准确，但字段清单不够完整。人工需要结合数据库 schema 和业务含义补充过滤范围。

### Bug C：Admin SQL 查询敏感数据

人工调试过程：人工定位到 `backend/src/routes/admin.ts` 的 `/admin/db/query`。原逻辑只禁止 `INSERT/UPDATE/DELETE/DROP` 等写操作，但允许任意 SELECT，因此管理员或拿到 admin key 的攻击者可以读取 `users.password_hash` 和 `otp_codes.code`。

AI 辅助过程：AI 首轮建议直接移除自由 SQL Query，或者改成预定义查询模板。从安全角度看这是最彻底的方案，但它忽略了当前管理后台依赖该接口做运维排查的现实约束。如果直接删除功能，可能影响演示前的问题定位和数据核查。

AI 方案的问题：

- 直接移除 SQL Query 会破坏已有管理后台能力
- 完整白名单查询模板需要重新设计后台查询场景，P4 阶段改动偏大
- AI 没有主动区分“长期最佳方案”和“本阶段可交付修复”

最终修复：本阶段采用收敛风险的折中方案，增加 `sensitiveTerms` 拦截，拒绝查询 `PASSWORD_HASH/PASSWORDHASH/STUDENT_ID_HASH/STUDENTIDHASH/OTP_CODES`。长期建议仍然是改成预定义查询模板或安全视图。

结论：这是 AI 辅助调试中最有实验价值的案例。AI 给出了更理想的安全方案，但没有充分考虑工程成本和管理后台功能依赖；人工最终做了阶段性取舍。

## 6. AI 表现总结

AI 表现较好的场景：

- 错误信息差异导致用户枚举
- 查询整行后返回敏感字段
- 缺少统一响应清洗函数

AI 表现较差或需要人工把关的场景：

- 需要在安全性和现有功能之间做取舍
- 需要判断 P4 阶段是否适合大改架构
- 需要补充完整敏感字段清单，而不是只修报告点名字段

AI 典型误区：

- 倾向给出“安全上最优”的方案
- 对项目已有运维功能依赖考虑不足
- 有时没有主动说明短期方案和长期方案的区别

人工判断的价值：

- 判断修复是否会破坏前端或管理后台已有流程
- 根据 schema 补全敏感字段
- 把 AI 的理想方案转换成当前阶段可交付方案

## 7. 验证说明

本次已完成代码修复和相关测试文件同步。由于当前本地 PowerShell 环境无法识别 `npm` 命令，未能在本地执行完整 `npm test`。后续应在 GitLab CI 中运行后端测试，并将流水线结果补充到 `交付物-5-CI配置与运行记录.md`。

## 8. 实验结论

AI 在安全 Bug 的模式识别和初步定位上有明显帮助，尤其适合快速指出“为什么这是风险”。但 AI 的建议不能直接等同于最终工程方案。对于 Admin SQL Query 这类涉及后台功能取舍的问题，AI 给出的方案需要人工结合项目阶段、演示要求和功能兼容性重新裁剪。
