# NJU Match Backend - Architecture (框架文档)

## 技术栈

| 层 | 选型 | 理由 |
|---|------|------|
| Runtime | Node.js 20+ (ES Modules) | 与前端统一技术栈，团队学习成本最低 |
| 框架 | Express.js | 轻量灵活，生态成熟 |
| 语言 | TypeScript | 类型安全，与前端一致 |
| 数据库 | PostgreSQL 16 | 关系型数据库，支持并发，适合生产环境 |
| ORM | Drizzle ORM | 类型安全、轻量、原生 SQL 友好、零代码生成 |
| 认证 | JWT (jsonwebtoken) | 无状态，前端友好 |
| 邮件 | Nodemailer (SMTP) + 阿里云 DirectMail API | 发送 OTP 验证码及匹配通知，双 Provider 切换 |
| AI | 通义千问 (DashScope OpenAI 兼容 API) | 生成 Curator's Note（馆长私语） |
| 定时任务 | node-cron | 周二提醒、周三匹配+解锁、周五过期 |
| 校验 | Zod | Schema 校验，与 TypeScript 深度集成 |
| 容器化 | Docker Compose | 一键启动 PostgreSQL + Backend + Frontend |

---

## 项目结构

```
backend/
├── docs/                      # 文档
│   ├── API_REFERENCE.md
│   ├── ARCHITECTURE.md
│   ├── CIRCLE_SOCIAL_DESIGN.md
│   └── IMPLEMENTATION_PLAN.md
├── src/
│   ├── index.ts               # 入口：Express app 启动、中间件挂载、路由注册
│   ├── config.ts              # 环境变量与配置（JWT、邮件、AI、DB）
│   ├── db/
│   │   ├── schema.ts          # Drizzle 表定义（单一真相源）
│   │   ├── connection.ts      # PostgreSQL 连接池
│   │   ├── migrate.ts         # 运行时迁移脚本（IF NOT EXISTS）
│   │   └── seed.ts            # 问卷题库种子数据
│   ├── routes/
│   │   ├── auth.ts            # /api/v1/auth/*
│   │   ├── user.ts            # /api/v1/user/*
│   │   ├── survey.ts          # /api/v1/survey/*
│   │   ├── match.ts           # /api/v1/match/*
│   │   ├── circle.ts          # /api/v1/circles/*（圈子社交）
│   │   └── admin.ts           # /api/v1/admin/*
│   ├── middleware/
│   │   ├── auth.ts            # JWT 验证中间件
│   │   ├── validate.ts        # Zod schema 校验中间件
│   │   └── errorHandler.ts    # 全局错误处理
│   ├── services/
│   │   ├── authService.ts     # OTP 生成/验证、JWT 签发、密码哈希
│   │   ├── surveyService.ts   # 问卷 CRUD
│   │   ├── matchService.ts    # 匹配算法核心、邮件通知
│   │   ├── circleService.ts   # 圈子业务逻辑（CRUD、匹配流水线）
│   │   └── aiService.ts       # 通义千问 API 调用（馆长私语）
│   ├── matching/
│   │   ├── compatibility.ts         # 加权曼哈顿距离计算
│   │   ├── galeShapley.ts           # Gale-Shapley 稳定匹配算法
│   │   ├── dealbreakers.ts          # 硬性条件一票否决过滤
│   │   ├── pools.ts                 # 子池划分（按性别偏好、校区等）
│   │   └── circleCompatibility.ts   # 圈子问卷评分（Likert/单选/多选/排序）
│   ├── cron/
│   │   └── weeklyMatch.ts     # 定时任务：周二提醒、周三匹配+解锁、周五过期
│   └── utils/
│       ├── email.ts           # 邮件发送工具（sendMailOnce 幂等发送）
│       ├── lockdown.ts        # 锁定窗口判断（周三18:00 – 周日23:59）
│       └── errors.ts          # 自定义错误类
├── package.json
├── tsconfig.json
├── Dockerfile
└── .env.example
```

---

## 数据库 Schema

### users 表
```
id               TEXT PRIMARY KEY (UUID)
email            TEXT UNIQUE NOT NULL
password_hash    TEXT                     -- bcrypt 哈希，NULL 表示仅 OTP 账号
nickname         TEXT
gender           TEXT CHECK(gender IN ('male','female'))
gender_pref      TEXT CHECK(gender_pref IN ('male','female','any'))
intention        TEXT CHECK(intention IN ('friend','partner'))
grade            TEXT
campus           TEXT CHECK(campus IN ('xianlin','gulou','suzhou','pukou'))
department       TEXT
mbti             TEXT
bio              TEXT
avatar_url       TEXT
contact_platform TEXT
contact_id       TEXT
is_participating BOOLEAN NOT NULL DEFAULT true
email_notifications BOOLEAN NOT NULL DEFAULT true
profile_complete BOOLEAN NOT NULL DEFAULT false
survey_complete  BOOLEAN NOT NULL DEFAULT false
created_at       TIMESTAMPTZ DEFAULT NOW()
updated_at       TIMESTAMPTZ DEFAULT NOW()
```

### survey_answers 表
```
id           TEXT PRIMARY KEY (UUID)
user_id      TEXT NOT NULL REFERENCES users(id)
answers      TEXT NOT NULL  -- JSON: { "q1": { "value": 6, "importance": 3 }, ... }
version      TEXT NOT NULL DEFAULT '1.0'
submitted_at TIMESTAMPTZ DEFAULT NOW()
updated_at   TIMESTAMPTZ DEFAULT NOW()

UNIQUE(user_id)  -- 每用户只一份答案，覆盖更新
```

### matches 表
```
id            TEXT PRIMARY KEY (UUID)
week_of       TEXT NOT NULL         -- 格式 'YYYY-MM-DD'（当周周三日期）
user_a_id     TEXT NOT NULL REFERENCES users(id)
user_b_id     TEXT NOT NULL REFERENCES users(id)
score         REAL NOT NULL         -- 兼容性得分 0.0 ~ 1.0
dimensions    TEXT                  -- JSON: 各维度分数详情
curator_note  TEXT                  -- AI 生成的馆长私语
user_a_action TEXT CHECK(user_a_action IN ('ACCEPT','REJECT'))
user_b_action TEXT CHECK(user_b_action IN ('ACCEPT','REJECT'))
status        TEXT NOT NULL DEFAULT 'LOCKED'
              CHECK(status IN ('LOCKED','REVEALED','MUTUAL','MISSED','EXPIRED'))
revealed_at   TIMESTAMPTZ
created_at    TIMESTAMPTZ DEFAULT NOW()

UNIQUE(week_of, user_a_id)
UNIQUE(week_of, user_b_id)
```

### otp_codes 表
```
id         SERIAL PRIMARY KEY
email      TEXT NOT NULL
purpose    TEXT NOT NULL DEFAULT 'register'
code       TEXT NOT NULL
expires_at TIMESTAMPTZ NOT NULL
created_at TIMESTAMPTZ DEFAULT NOW()
```

### mail_logs 表（幂等发送记录）
```
id         TEXT PRIMARY KEY (UUID)
idempotency_key TEXT UNIQUE NOT NULL  -- 防重发
recipient  TEXT NOT NULL
subject    TEXT NOT NULL
sent_at    TIMESTAMPTZ DEFAULT NOW()
```

### circles 表
```
id           TEXT PRIMARY KEY (UUID)
name         TEXT NOT NULL
slug         TEXT UNIQUE NOT NULL
description  TEXT
category     TEXT
icon_url     TEXT
member_count INTEGER NOT NULL DEFAULT 0
is_active    BOOLEAN NOT NULL DEFAULT true
created_at   TIMESTAMPTZ DEFAULT NOW()
```

### circle_questions 表
```
id            TEXT PRIMARY KEY (UUID)
circle_id     TEXT NOT NULL REFERENCES circles(id)
key           TEXT NOT NULL
type          TEXT NOT NULL  -- 'scale'|'single_choice'|'multi_choice'|'ranking'
prompt        TEXT NOT NULL
options       TEXT           -- JSON
weight        REAL NOT NULL DEFAULT 1.0
display_order INTEGER NOT NULL DEFAULT 0
```

### circle_members 表
```
id               TEXT PRIMARY KEY (UUID)
circle_id        TEXT NOT NULL REFERENCES circles(id)
user_id          TEXT NOT NULL REFERENCES users(id)
answers          TEXT           -- JSON
answers_complete BOOLEAN NOT NULL DEFAULT false
is_active        BOOLEAN NOT NULL DEFAULT true
joined_at        TIMESTAMPTZ DEFAULT NOW()
updated_at       TIMESTAMPTZ DEFAULT NOW()

UNIQUE(circle_id, user_id)
```

### circle_matches 表
```
id           TEXT PRIMARY KEY (UUID)
circle_id    TEXT NOT NULL REFERENCES circles(id)
week_of      TEXT NOT NULL
user_a_id    TEXT NOT NULL REFERENCES users(id)
user_b_id    TEXT NOT NULL REFERENCES users(id)
score        REAL NOT NULL
user_a_action TEXT CHECK(user_a_action IN ('ACCEPT','REJECT'))
user_b_action TEXT CHECK(user_b_action IN ('ACCEPT','REJECT'))
status       TEXT NOT NULL DEFAULT 'LOCKED'
revealed_at  TIMESTAMPTZ
created_at   TIMESTAMPTZ DEFAULT NOW()

UNIQUE(circle_id, week_of, user_a_id)
UNIQUE(circle_id, week_of, user_b_id)
```

---

## 匹配算法架构

### 主匹配流程

```
周三 18:00 Cron 触发
       │
       ▼
┌─────────────────┐
│  1. 筛选参与者    │  is_participating=true AND survey_complete=true AND profile_complete=true
└────────┬────────┘
         ▼
┌─────────────────┐
│  2. 子池划分      │  按 (gender, gender_pref) 组合分池
│     (Pools)      │  例: {男→女} × {女→男} 形成一个匹配池
└────────┬────────┘
         ▼
┌─────────────────┐
│  3. 硬性过滤      │  dealbreaker 题目中极端差异 → 直接排除
│  (Dealbreakers)  │  例: A选7(绝不接受吸烟) + B选1(经常吸烟) → 排除
└────────┬────────┘
         ▼
┌─────────────────┐
│  4. 兼容性计算    │  加权曼哈顿距离 → 百分制兼容性得分
│  (Compatibility) │  对每对可能的组合计算双向平均分
└────────┬────────┘
         ▼
┌─────────────────┐
│  5. 稳定匹配      │  Gale-Shapley 算法
│  (Gale-Shapley)  │  生成全局最优的一对一匹配
└────────┬────────┘
         ▼
┌─────────────────┐
│  6. AI 生成       │  对每对匹配调用通义千问
│  (Curator Note)  │  生成个性化的"馆长私语"
└────────┬────────┘
         ▼
    写入 matches 表 (status=LOCKED)

周三 20:00 Cron 触发
       │
       ▼
  批量更新 status: LOCKED → REVEALED
  发送邮件通知（仅 emailNotifications=true 用户）

周五 20:00 Cron 触发
       │
       ▼
  REVEALED → EXPIRED（未操作的匹配标记为过期）
```

### 定时任务列表

| 时间 | 任务 |
|------|------|
| 周二 18:00 | 提醒未填问卷 / 问卷版本过旧的用户 |
| 周三 12:00 | 补提醒周二新注册且仍未完成问卷的用户 |
| 周三 18:00 | 运行匹配算法，锁定问卷和参与状态（lockdown 开始） |
| 周三 20:00 | 解锁匹配结果（LOCKED → REVEALED），发送邮件通知 |
| 周五 12:00 | 提醒仍未回应本期匹配的用户尽快做选择 |
| 周五 20:00 | 将未操作的 REVEALED 匹配标记为 EXPIRED |
| 每天 12:00 | 处理自动暂停满 7 天的用户，发送永久休眠通知 |

### 锁定窗口（Lockdown）

**周三 18:00 – 20:00 北京时间**，以下操作被禁止：
- `PATCH /user/status`（切换参与状态）
- `POST /survey/submit`（提交问卷）

### 兼容性得分计算公式

对于 Likert 量表题 (1-7)：

```
对于题目 i，用户 A 对 B 的惩罚分：
  Penalty_i(A→B) = Weight_A_i × |Answer_A_i - Answer_B_i|

其中：
  Weight = importance (1, 2, 3)
  最大单题惩罚 = 3 × 6 = 18

A 对 B 的总惩罚（所有 Likert 题）：
  TotalPenalty(A→B) = Σ Penalty_i(A→B)

最大可能惩罚：
  MaxPenalty = Σ (Weight_A_i × 6)  对所有 Likert 题

A 对 B 的兼容性：
  Compat(A→B) = 1 - TotalPenalty(A→B) / MaxPenalty

双向平均兼容性：
  Score(A,B) = (Compat(A→B) + Compat(B→A)) / 2
```

### Dealbreaker 规则

第一部分 "硬性筛选" 题目（q1-q8）中，如果一方 importance=3 且双方差值 ≥ 5，直接淘汰：
```
if (importance === 3 && |A_answer - B_answer| >= 5) → 排除该对
```

### 非 Likert 题目处理

| 题型 | 匹配方式 |
|------|---------|
| multi_select (核心价值观) | Jaccard 相似度 = 交集/并集 |
| ranking (爱的语言) | Spearman 等级相关系数，归一化到 [0,1] |
| open_text | 不参与算法计算，仅展示 |
| single_select (权重分配) | 用于调整维度权重 |
| number_input (自定义红线) | 该题 importance 强制设为 3 |

---

## 圈子社交匹配

圈子是独立于主匹配的兴趣分组匹配流水线，共享用户体系，使用独立的题目和匹配表。

```
circles (圈子定义)
    ↓
circle_questions (圈子专属问卷)
    ↓
circle_members (用户加入 + 提交答案)
    ↓
circle_matches (圈内匹配结果)
```

评分算法（`circleCompatibility.ts`）：
- scale → 加权 Likert 距离
- single_choice → 精确匹配 0/1
- multi_choice → Jaccard 相似度
- ranking → Spearman 相关系数归一化

---

## 安全策略

1. **JWT 签名密钥** — 环境变量，不入库
2. **密码存储** — bcrypt 哈希，不存明文
3. **OTP** — 6 位数字，5 分钟过期，验证后立即删除
4. **SQL 注入** — Drizzle ORM 参数化查询
5. **XSS** — Express 不返回 HTML，纯 JSON API
6. **CORS** — 仅允许配置的前端域名
7. **Rate Limiting** — OTP 接口 60s 限流
8. **联系方式保护** — contactId 仅在双方 ACCEPT 后才返回
9. **邮件幂等** — mail_logs 表防止重复发送

---

## 部署架构

```
Docker Compose 部署：

┌─────────────────────────────────────────┐
│           docker-compose.yml            │
│                                         │
│  ┌─────────────┐   ┌─────────────────┐  │
│  │  PostgreSQL  │   │    Backend       │  │
│  │  :5432       │◄──│  Express :3000   │  │
│  │  (healthck)  │   │  (等 PG 就绪)   │  │
│  └─────────────┘   └────────┬────────┘  │
│                              │           │
│  ┌─────────────────────────▼─────────┐  │
│  │           Frontend                 │  │
│  │      Nginx :80 → :80 (host)        │  │
│  │  / → static dist                   │  │
│  │  /api/v1 → proxy backend:3000      │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘

外部服务：
- SMTP / 阿里云 DirectMail（邮件）
- DashScope API（通义千问 AI）
```
