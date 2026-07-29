# G2 演示与测试说明

本文是第二组 G2 功能的独立体验入口。根目录 `README.md`、`DOCKER.md`、`docker-compose.yml`、`.env.example` 保持三组公共交付口径；本文件专门说明 G2 的 mock 演示、真实数据库 Docker 演示、测试运行与 P4 验收证据。

## 1. G2 覆盖范围

G2 主线聚焦圈子与关系链：

- 圈子发现、圈子详情、圈主管理、入圈申请与审核。
- 圈内好友申请、好友列表、联系方式申请、字段级授权与隐私保护。
- 圈内组队大厅、直接加入、审核加入、候补与组队成员联系方式。
- 圈子群聊、组队聊天、已读状态、敏感联系方式拦截与实时消息。
- 后端数据库集成测试、前端真实后端 Playwright 集成测试与 CI 入口。

## 2. 快速选择

| 场景 | 适合对象 | 是否需要 Docker | 是否需要真实数据库 | 入口 |
|---|---|---:|---:|---|
| Mock 演示 | 第一次看 UI、无后端环境 | 否 | 否 | `VITE_USE_MOCK=true npm run dev` |
| G2 Docker 演示 | 完整体验真实数据、登录、圈子、组队、聊天 | 是 | 是 | `docker-compose.g2-demo.yml` |
| G2 测试 | 验收单元测试、DB 集成、前端真实后端集成 | 部分需要 | 部分需要 | `test:g2:*` scripts |

## 3. Mock 演示

Mock 演示只启动前端，适合先熟悉界面和交互，不需要 PostgreSQL、后端或 Docker。

### 3.1 启动

```bash
cd frontend
npm install
VITE_USE_MOCK=true npm run dev
```

访问：

```text
http://localhost:3001/login
```

### 3.2 登录方式

在登录页勾选用户协议，使用任意南大邮箱格式和任意非空密码：

```text
demo@smail.nju.edu.cn / 123456
```

Mock 登录会生成前端本地 token，并返回预置的 mock 用户。Mock 数据只适合浏览 UI 和基础交互，不代表真实数据库状态；实时聊天 WebSocket、真实审批流和数据落库请使用第 4 节 Docker 演示。

### 3.3 建议体验路径

1. `/dashboard`：查看消息、好友/联系方式入口、组队入口和个人状态。
2. `/circles`：浏览圈子发现、我加入的圈子、我发出的入圈申请。
3. `/circles/c1` 或从圈子列表点击「王者荣耀圈」进入：查看圈子详情、成员卡片、圈内组队与圈内聊天入口。
4. `/forum`：查看论坛列表、公告与互动入口。
5. `/settings?tab=friends`、`/settings?tab=privacy`：查看好友申请与隐私申请 UI。

Mock 模式的重点是快速看界面；若要体验真实登录、数据库持久化、好友审批、联系方式授权和聊天落库，请使用下一节 Docker 演示。

## 4. G2 真实数据库 Docker 演示

G2 Docker 演示使用独立 compose 文件，不影响三组公共 `docker-compose.yml`。首次启动时 PostgreSQL 会执行根目录 `init.sql`，写入固定账号、圈子、论坛、组队、好友关系、联系方式申请和聊天相关表。

### 4.1 前置要求

| 工具 | 建议 |
|---|---|
| Docker Desktop | 已启动 |
| Docker Compose V2 | `docker compose version` 可用 |
| 端口 | 默认使用前端 `8080`，Postgres `55432` |

如果 8080 或 55432 被占用，可以复制 `.env.g2-demo.example` 后调整端口：

```bash
cp .env.g2-demo.example .env.g2-demo
```

之后命令加上 `--env-file .env.g2-demo`。

### 4.2 启动完整演示环境

默认端口：

```bash
docker compose -f docker-compose.g2-demo.yml down -v
docker compose -f docker-compose.g2-demo.yml up -d --build
```

使用自定义 `.env.g2-demo`：

```bash
docker compose --env-file .env.g2-demo -f docker-compose.g2-demo.yml down -v
docker compose --env-file .env.g2-demo -f docker-compose.g2-demo.yml up -d --build
```

访问：

```text
http://localhost:8080/login
```

健康检查：

```bash
curl http://localhost:8080/health
```

查看日志：

```bash
docker compose -f docker-compose.g2-demo.yml logs -f postgres
docker compose -f docker-compose.g2-demo.yml logs -f backend
docker compose -f docker-compose.g2-demo.yml logs -f frontend
```

停止但保留数据库：

```bash
docker compose -f docker-compose.g2-demo.yml down
```

重置数据库并重新导入 `init.sql`：

```bash
docker compose -f docker-compose.g2-demo.yml down -v
docker compose -f docker-compose.g2-demo.yml up -d --build
```

### 4.3 固定账号

用户账号：

| 角色 | 邮箱 | 密码 | 用途 |
|---|---|---|---|
| 阿球 | `circle.seed@smail.nju.edu.cn` | `NJUdate123` | 普通用户、羽毛球圈成员、发起好友/联系方式/组队流程 |
| 北苑杀球王 | `circle.peer@smail.nju.edu.cn` | `NJUdate123` | 同伴用户、午夜观影会圈主、审批申请 |

管理员后台：

| 页面 | 管理员密钥 |
|---|---|
| `http://localhost:8080/admin` | `nju-date-admin-test` |

### 4.4 核心演示路径

建议使用普通窗口登录阿球，再用无痕窗口或另一个浏览器登录北苑杀球王，方便体验双用户流程。

#### A. 未登录访问保护

1. 退出登录或使用新浏览器打开 `http://localhost:8080/circles`。
2. 预期：跳转到 `/login`。
3. 说明：覆盖 P4 集成测试中的未登录访问异常流程。

#### B. 圈子发现与入圈申请

1. 用阿球登录。
2. 打开 `/circles`。
3. 预期能看到「羽毛球夜场研究所」和「午夜观影会」。
4. 搜索「午夜观影会」。
5. 预期能看到「我发出的入圈申请」和撤回入口。

#### C. 圈子详情、好友申请与联系方式授权

1. 阿球打开 `/circles/30000000-0000-4000-8000-000000000003`。
2. 点击成员「北苑杀球王」。
3. 点击「递交交际申请」，填写破冰寄语并提交。
4. 切换到北苑杀球王，打开 `/settings?tab=friends`。
5. 在「收到的好友申请」中同意阿球的申请。
6. 切回阿球，再次打开羽毛球圈详情并点击北苑杀球王。
7. 点击「求取联络印记」。
8. 切到北苑杀球王，打开 `/settings?tab=privacy`，审批联系方式申请。
9. 切回阿球，点击北苑杀球王并「展阅同窗私录」。
10. 预期能看到 `circle_peer_01`。

#### D. 圈内组队与组队聊天

1. 阿球打开 `/circles/30000000-0000-4000-8000-000000000003/teamups`。
2. 点击「发起邀约」。
3. 填写标题、说明、人数、截止时间、结束时间和微信号后发布。
4. 北苑杀球王打开新建组队详情页并加入。
5. 预期出现「退出队伍」和「同游茶话」。
6. 双方可在组队聊天中发送普通消息。

#### E. 圈子群聊与敏感联系方式拦截

1. 阿球打开 `/circles/30000000-0000-4000-8000-000000000003/livechat`。
2. 发送普通消息，例如「今晚八点在球馆集合」。
3. 预期消息出现在聊天记录中。
4. 再发送包含联系方式的消息，例如「微信 wx_forbidden_123」。
5. 预期前端提示发送失败，后端返回联系方式文本拦截。

#### F. 圈主管理

1. 北苑杀球王登录。
2. 打开 `/circles/40000000-0000-4000-8000-000000000004/manage`。
3. 处理阿球加入「午夜观影会」的待审核申请。

#### G. 管理员后台

1. 打开 `/admin`。
2. 输入管理员密钥 `nju-date-admin-test`。
3. 查看「用户管理」「圈子管理」「组队管理」「论坛举报」「论坛管理」「系统」等标签页。

## 5. G2 测试方法

### 5.1 安装依赖

```bash
npm install --prefix backend
npm install --prefix frontend
```

首次运行 Playwright 前安装 Chromium：

```bash
cd frontend
npx playwright install chromium
```

### 5.2 单元测试

后端 G2 单元测试：

```bash
npm --prefix backend run test:g2:unit
```

前端 G2 单元测试：

```bash
npm --prefix frontend run test:g2:unit
```

覆盖率入口：

```bash
npm --prefix backend run test:g2:coverage
npm --prefix frontend run test:g2:coverage
```

### 5.3 数据库集成测试

先启动只包含数据库的 G2 demo 服务。`down -v` 用于保证重新执行 `init.sql`：

```bash
docker compose -f docker-compose.g2-demo.yml down -v
docker compose -f docker-compose.g2-demo.yml up -d postgres
```

后端 DB 集成测试：

```bash
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55432/nju_date \
DB_SSL=false \
JWT_SECRET=nju-date-g2-test-jwt-secret \
ADMIN_KEY=nju-date-admin-test \
CONTACT_ENCRYPTION_KEY=nju-date-local-contact-encryption-key \
CONTACT_BLIND_INDEX_KEY=nju-date-local-contact-blind-index-key \
npm --prefix backend run test:g2:integration
```

前端真实后端集成测试：

```bash
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55432/nju_date \
DB_SSL=false \
JWT_SECRET=nju-date-g2-test-jwt-secret \
ADMIN_KEY=nju-date-admin-test \
CONTACT_ENCRYPTION_KEY=nju-date-local-contact-encryption-key \
CONTACT_BLIND_INDEX_KEY=nju-date-local-contact-blind-index-key \
npm --prefix frontend run test:g2:integration
```

前端集成测试会自动启动本地 backend `3100` 和 frontend `3101`，并使用 `VITE_USE_MOCK=false`。测试覆盖：

- 未登录访问 `/circles` 跳转登录。
- `init.sql` 固定圈子发现与入圈申请状态。
- 好友申请、同意好友、联系方式申请与授权展示。
- 创建组队、加入组队、圈子 LiveChat 普通消息发送。
- 聊天中直接发送微信号等联系方式被拦截。

### 5.4 CI/CD 入口

当前 GitHub Actions 与 GitLab CI 均使用 G2 脚本分组：

- 后端：`test:g2:unit`、`test:g2:coverage`、`test:g2:integration`。
- 前端：`test:g2:unit`、`test:g2:coverage`、`test:g2:integration`。
- CI 会安装依赖、执行静态检查、运行测试并构建项目。

## 6. P4 材料索引

| 材料项 | 位置 / 说明 |
|---|---|
| 可运行系统代码 | `docker-compose.g2-demo.yml` + `init.sql` 可启动完整真实后端演示 |
| 演示说明 | 本文件第 3、4 节覆盖 mock 和真实数据库演示 |
| 演示账号或测试数据 | 本文件第 4.3 节固定账号；数据来自 `init.sql` |
| 核心演示路径 | 本文件第 4.4 节 A-G |
| 单元测试 | `docs/P4/g2/单元测试代码.md`；`test:g2:unit`（后端 78、前端 29 用例全部通过） |
| 集成测试 | `docs/P4/g2/集成测试代码.md`；后端 DB 集成（`tests/db/`，19 用例）+ 前端 Playwright 真实后端集成 |
| CI/CD 配置 | `.github/workflows/ci.yml` 与 `.gitlab-ci.yml` 使用 G2 脚本分组 |
| Bug 修复日志、接口样例、测试证据 | `docs/P4/g2/Bug修复日志.md`、`API_SPEC.md`、`docs/P4/g2/演示说明.md` 与 `docs/P4/g2/evidence/` |

已有演示证据图片位于 `docs/P4/g2/evidence/`，覆盖登录、设置、好友详情、好友通知、圈子论坛、圈子组队、圈子群聊和圈子到主论坛跳转等路径。

## 7. 工程质量速览与复现说明

> 本节汇总可复跑命令、模块边界和设计取舍，便于复现当前 G2 交付状态。

### 7.1 本机实测结果（可复跑）

| 项目 | 命令 | 结果 |
|---|---|---|
| 后端 G2 单元测试 | `npm --prefix backend run test:g2:unit` | 78/78 通过 |
| 前端 G2 单元测试 | `npm --prefix frontend run test:g2:unit` | 29/29 通过 |
| 核心模块覆盖率 | `npm --prefix backend run test:g2:coverage` | 聊天风控 / 关系策略 / 名片快照 / 入圈策略 / 联系方式字段 / 组队策略等核心模块 line 覆盖见 `docs/P4/g2/AI协作反思日志_4.md` |
| DB 集成测试 | `npm --prefix backend run test:g2:integration` | 见 5.3 节（需先启动 Postgres） |

每个已修 Bug 的对应测试用例索引见 `docs/P4/g2/Bug修复日志.md` 末尾「测试覆盖对照」。

### 7.2 跨组协作与模块归属

三组共建一套模块化单体（单前端 / 单后端 / 单库）。各组业务边界与后端入口：

| 业务域 | 负责组 | 后端入口 |
|---|---|---|
| 注册 / 登录 / 认证 / 用户资料 / 问卷 / 主匹配 | 第一组 | `/api/v1/auth`、`/api/v1/user`、`/api/v1/survey`、`/api/v1/match` |
| 圈子 / 名片 / 好友 / 联系方式 / 组队 / 圈内聊天 | **第二组（本组）** | `/api/v1/circles`、`/api/v1/card`、`/api/v1/friends`、`/api/v1/contacts` |
| 论坛 / 治理 / 举报审核 / 后台 | 第三组 | `/api/v1/forum`、`/api/v1/admin` |

G2 主要跨组集成点：

1. 组队同步到论坛（TeamUp → forum）。
2. 联系方式跨模块分级解锁（圈子名片 → 好友 → 解锁授权）。
3. 复用第一组统一身份认证与共享 schema / 数据库。

> G2 自身的安全加固集中在：联系方式加密落库（`g2_contact_secrets`）、实时聊天一次性 ticket 鉴权、聊天内容联系方式风控。

### 7.3 P3 SOLID 检查清单说明

`docs/P3/g2/SOLID检查清单.md` 是 P3 任务 1.2「AI 设计缺陷注入」实验，审计对象是 **AI 生成的理想类图**（含 IRepository / EventBus / DI 等抽象）。P3 阶段侧重记录 AI 设计是否符合 SOLID 以及人工修正过程；P4 阶段的实际代码按 4 人 / 10 周约束采用更轻量的实现结构（直接经 Drizzle、按 `modules/<domain>/` 拆分）。因此本阶段以 P4 实际实现、测试脚本和演示路径作为主要复现依据，P3 文档保留为设计实验和演进背景。

## 8. 常见问题

**打开页面后没有固定测试账号数据**

PostgreSQL 只会在数据卷首次创建时执行 `init.sql`。执行：

```bash
docker compose -f docker-compose.g2-demo.yml down -v
docker compose -f docker-compose.g2-demo.yml up -d --build
```

**8080 或 55432 端口被占用**

复制 `.env.g2-demo.example`，修改 `G2_DEMO_FRONTEND_PORT` 或 `G2_DEMO_POSTGRES_PORT`，并在 compose 命令中加 `--env-file .env.g2-demo`。

**前端集成测试提示找不到浏览器**

执行：

```bash
cd frontend
npx playwright install chromium
```

**Mock 演示登录失败**

确认启动命令里有 `VITE_USE_MOCK=true`，邮箱是 `@smail.nju.edu.cn` 后缀，并勾选用户协议。

**真实 Docker 演示和公共 Docker 入口有什么区别**

公共 `docker-compose.yml` 保持三组统一交付和部署口径；`docker-compose.g2-demo.yml` 是第二组可复现演示入口，默认导入 `init.sql` 并使用本地演示密钥。
