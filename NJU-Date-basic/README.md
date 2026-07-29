# NJU Match

南京大学在校生专属匹配平台。基于灵魂问卷与稳定匹配算法，每周三晚 20:00 揭晓一封写给你的锦书。

```
前端 React + Vite + TypeScript   →  port 3001
后端 Express + PostgreSQL         →  port 3000
```

---

## 目录结构

```
NJU-Match/
├── frontend/          React 前端
├── backend/           Express 后端
├── docs/              课程交付文档（P0-P4）
├── design_docs/       设计与产品文档（含 archive 历史文档）
├── docker-compose.yml 一键启动（Postgres + 后端 + 前端）
├── API_SPEC.md        接口规范
├── PROJECT.md         项目总纲（产品与架构全景）
├── DEPLOY.md          部署与运维手册（权威）
├── DOCKER.md          Docker 快速命令
└── DESIGN.md          设计规范
```

---

## 本地开发启动

> 需要两个终端窗口分别运行后端和前端。

### 前置要求

| 工具 | 版本 |
|------|------|
| Node.js | 20+ |
| npm | 10+ |
| PostgreSQL | 14+（或用 Docker） |

---

### 终端一：启动后端

```bash
# 进入后端目录
cd backend

# 安装依赖（首次或依赖变更后）
npm install

# 复制环境变量模板
cp .env.example .env
```

打开 `backend/.env`，至少填写以下字段：

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/nju_date
JWT_SECRET=任意随机字符串
ADMIN_KEY=任意随机字符串
FRONTEND_URL=http://localhost:3001
```

> **开发模式提示**：`SMTP_*` 字段留空时，OTP 验证码会直接打印到后端终端，无需配置真实邮箱即可测试登录。

```bash
# 启动后端（自动 watch 文件变更，自动运行数据库迁移）
npm run dev
```

后端就绪后终端输出：
```
Server running on port 3000
Database migrations complete
```

---

### 终端二：启动前端

```bash
# 进入前端目录
cd frontend

# 安装依赖（首次或依赖变更后）
npm install

# 启动前端开发服务器
npm run dev
```

前端就绪后访问：**http://localhost:3001**

> 前端通过 Vite proxy 将 `/api/*` 请求转发到 `http://localhost:3000`，无需手动处理 CORS。

---

### 一键启动（Docker，可选）

如果已安装 Docker，可以用以下命令一次启动 PostgreSQL + 后端 + 前端：

```bash
# 在项目根目录
docker compose up -d --build
```

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:3001 |
| 后端 | http://localhost:3000 |
| 数据库 | localhost:5432 |

停止：

```bash
docker compose down

# 同时删除数据库数据
docker compose down -v
```

---

## 验证启动成功

```bash
# 检查后端健康状态
curl http://localhost:3000/health
# → {"status":"ok","timestamp":"..."}

# 检查前端是否可访问
open http://localhost:3001
```

---

## 开发调试技巧

### 跳过邮件发送，直接获取 OTP

开发环境下，验证码打印在**后端终端**，形如：

```
[DEV] OTP for student@smail.nju.edu.cn: 123456
```

或直接调用开发专用接口：

```bash
# 发送验证码
curl -X POST http://localhost:3000/api/v1/auth/send-code \
  -H "Content-Type: application/json" \
  -d '{"email":"test@smail.nju.edu.cn"}'

# 从数据库读取验证码（开发接口）
curl "http://localhost:3000/api/v1/auth/dev-otp?email=test@smail.nju.edu.cn"

# 直接获取 token（跳过 OTP，开发接口）
curl -X POST http://localhost:3000/api/v1/auth/dev-token \
  -H "Content-Type: application/json" \
  -d '{"email":"test@smail.nju.edu.cn"}'
```

### 手动触发匹配算法（无需等到周三 18:00）

```bash
curl -X POST http://localhost:3000/api/v1/admin/trigger-matching \
  -H "X-Admin-Key: 你在.env里设置的ADMIN_KEY"
```

### 手动解锁揭晓（无需等到周三 20:00）

```bash
curl -X POST http://localhost:3000/api/v1/admin/unlock-reveal \
  -H "X-Admin-Key: 你在.env里设置的ADMIN_KEY"
```

---

## 常见问题

**后端启动报错：数据库连接失败**
- 确认 PostgreSQL 正在运行：`pg_isready` 或 `brew services list | grep postgresql`
- 确认 `DATABASE_URL` 中的用户名、密码、数据库名与本地 PostgreSQL 一致

**前端请求报 404 / 无法连接后端**
- 确认后端在 port 3000 运行
- 确认前端在 port 3001 运行（Vite proxy 依赖固定端口）
- 检查 `frontend/.env.development` 中 `VITE_API_BASE=/api/v1`

**CORS 报错**
- 确认 `backend/.env` 中 `FRONTEND_URL=http://localhost:3001`

**OTP 一直收不到邮件**
- 开发环境无需真实邮件：查看**后端终端**日志，验证码会直接打印出来

---

## 相关文档

### 课程交付
- [P0 项目启动与 AI 协作契约](docs/P0/P0-项目启动与AI协作契约.md)
- [P1 需求分析](docs/P1/P1-需求分析.md)
- [P2 体系结构设计材料](docs/P2/g2/03-架构设计文档.md)
- [P3 详细设计材料](docs/P3/g2/详细设计文档（整合版）.md)
- [P4 编码开发材料](docs/P4/g2/Sprint_合并任务看板.md)

### 核心文档
- [API 接口规范](API_SPEC.md)
- [后端完整接口文档](backend/docs/API_REFERENCE.md)
- [项目总纲](PROJECT.md)
- [三组职责与模块总表](design_docs/GROUP_RESPONSIBILITIES.md)
- [三组统一 API 协作总览](design_docs/GROUP_API_GUIDE.md)
- [部署与运维手册](DEPLOY.md)
- [安全策略](SECURITY.md)
- [设计规范](DESIGN.md)
- [贡献指南](CONTRIBUTING.md)

### 产品与规划
- [功能状态路标](design_docs/ROADMAP_STATUS.md)
- [用户视角优化方案](design_docs/PRODUCT_OPTIMIZATION_PLAN_USER_PERSPECTIVE.md)
- [开发可执行任务清单](design_docs/EXECUTABLE_TASKLIST_DEV_SAFE.md)
- [校友/毕业生适配方案](design_docs/ALUMNI_UPDATE_PLAN.md)

### 圈子社交模块
- [圈子功能设计文档](design_docs/CIRCLE_DESIGN.md)
- [圈子前后端 API 接口](design_docs/CIRCLE_API.md)
- [圈子分模块开发计划](design_docs/CIRCLE_MODULE_PLAN.md)
- [圈子开发里程碑](design_docs/CIRCLE_DEV_PLAN.md)
- [圈子搭子匹配算法](backend/docs/CIRCLE_MATCHING_ALGORITHM.md)

### 后端技术文档
- [后端架构](backend/docs/ARCHITECTURE.md)
- [安全基线](backend/docs/SECURITY_BASELINE.md)
- [维护模式操作手册](backend/docs/MAINTENANCE_MODE.md)

### 归档
- [历史桥接方案](design_docs/archive/BRIDGE_PLAN.md)
- [历史设计草案](design_docs/archive/design_plan.md)
- [历史更新计划](design_docs/archive/UPDATE_PLAN.md)
