# NJU Match Backend - Implementation Plan (实施计划)

## 总览

分 5 个 Phase 实施，每个 Phase 完成后可独立测试。

---

## Phase 1: 项目骨架与数据库 (Day 1)

**目标：** 搭建 Express + TypeScript + SQLite 项目，建表，跑通 Hello World。

- [x] 初始化 `backend/package.json`，安装核心依赖
- [x] 配置 `tsconfig.json`（ESM + 严格模式）
- [x] 创建 `src/config.ts` 环境变量配置
- [x] 创建 `src/db/connection.ts` SQLite 连接
- [x] 创建 `src/db/schema.ts` Drizzle 表定义（users, survey_answers, matches, otp_codes）
- [x] 创建 `src/index.ts` Express 入口 + 基础中间件
- [x] 创建 `src/utils/errors.ts` 自定义错误类
- [x] 创建 `src/middleware/errorHandler.ts` 全局错误处理
- [x] 验证：`npm run dev` 启动成功，GET /health 返回 200

**交付物：** 可启动的空壳服务器 + 已建好的数据库表

---

## Phase 2: 认证 + 用户模块 (Day 2)

**目标：** 实现邮箱 OTP 登录、JWT 鉴权、用户档案 CRUD。

- [ ] 创建 `src/middleware/auth.ts` JWT 验证中间件
- [ ] 创建 `src/middleware/validate.ts` Zod 校验中间件
- [ ] 创建 `src/services/authService.ts`（OTP 生成/验证/JWT 签发）
- [ ] 创建 `src/routes/auth.ts`（POST send-code, POST verify-code）
- [ ] 创建 `src/routes/user.ts`（GET/PUT profile, PATCH status, POST avatar）
- [ ] 创建 `src/utils/email.ts` 邮件发送（开发环境打印到控制台）
- [ ] 验证：用 curl/Postman 完成完整的 注册→登录→更新档案 流程

**交付物：** 完整的用户认证与档案管理功能

---

## Phase 3: 问卷模块 (Day 3)

**目标：** 问卷题库定义、答案提交与存储。

- [ ] 创建 `src/db/seed.ts` 完整 60 题问卷数据
- [ ] 创建 `src/services/surveyService.ts`
- [ ] 创建 `src/routes/survey.ts`（GET questions, POST submit, GET answers）
- [ ] 实现答案的 Zod 校验（确保每题类型、范围、必填正确）
- [ ] 验证：提交完整问卷并能回查

**交付物：** 可用的问卷系统

---

## Phase 4: 匹配算法核心 (Day 4-5)

**目标：** 实现完整的三阶段匹配流程。

- [ ] 创建 `src/matching/dealbreakers.ts` — 硬性条件过滤
- [ ] 创建 `src/matching/compatibility.ts` — 加权曼哈顿距离 + Jaccard + Spearman
- [ ] 创建 `src/matching/pools.ts` — 按性别偏好分池
- [ ] 创建 `src/matching/galeShapley.ts` — 稳定匹配算法
- [ ] 创建 `src/services/matchService.ts` — 编排完整匹配流程
- [ ] 创建 `src/services/aiService.ts` — Gemini API 生成馆长私语
- [ ] 创建 `src/cron/weeklyMatch.ts` — 定时任务
- [ ] 创建 `src/routes/match.ts`（GET current, POST action, GET result, GET history）
- [ ] 创建 `src/routes/admin.ts`（手动触发匹配）
- [ ] 验证：创建 10+ 测试用户，运行匹配算法，检查配对结果合理性

**交付物：** 完整可运行的匹配系统

---

## Phase 5: 集成与收尾 (Day 6)

**目标：** 前后端联调准备、CORS、文件上传、最终测试。

- [ ] CORS 配置（允许前端 origin）
- [ ] 文件上传 Multer 配置
- [ ] 创建测试用种子脚本（批量创建用户+问卷数据）
- [ ] 端到端测试：注册→填问卷→匹配→揭晓→双选→交换联系方式
- [ ] 编写 `.env.example`
- [ ] README 使用说明

**交付物：** 可部署的完整后端

---

## 技术风险与应对

| 风险 | 应对 |
|------|------|
| SQLite 并发写入锁 | 单机场景下够用；写操作通过 WAL 模式优化 |
| 匹配算法性能 | 万级用户下子池划分后，每池百级规模，计算秒级完成 |
| Gemini API 限流 | 批量生成时加延迟；失败时使用兜底模板文案 |
| 邮件发送失败 | 开发环境直接打印 OTP 到控制台；生产环境接入 SMTP |

---

## 依赖清单

```json
{
  "dependencies": {
    "express": "^4.21.0",
    "better-sqlite3": "^11.0.0",
    "drizzle-orm": "^0.38.0",
    "jsonwebtoken": "^9.0.0",
    "zod": "^3.23.0",
    "node-cron": "^3.0.0",
    "nodemailer": "^6.9.0",
    "multer": "^1.4.5-lts.1",
    "cors": "^2.8.5",
    "uuid": "^10.0.0",
    "openai": "^4.0.0",
    "dotenv": "^17.0.0"
  },
  "devDependencies": {
    "typescript": "^5.8.0",
    "tsx": "^4.21.0",
    "@types/express": "^4.17.0",
    "@types/better-sqlite3": "^7.6.0",
    "@types/jsonwebtoken": "^9.0.0",
    "@types/node-cron": "^3.0.0",
    "@types/nodemailer": "^6.4.0",
    "@types/multer": "^1.4.0",
    "@types/cors": "^2.8.0",
    "@types/uuid": "^10.0.0",
    "drizzle-kit": "^0.30.0"
  }
}
```
