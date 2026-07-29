# 交付物 5：CI/CD 配置与运行记录

## 1. 配置目标

本阶段配置基础 CI 流水线，目标是在代码提交后自动完成依赖安装、代码检查、单元测试、集成/E2E 测试和项目构建，确保 P4 阶段交付代码具备可运行性和基本质量保障。

## 2. CI 配置文件

| 配置文件 | 平台 | 说明 |
|---|---|---|
| `.gitlab-ci.yml` | GitLab CI/CD | P4 阶段新增配置，覆盖安装、检查、测试、构建流程 |
| `.github/workflows/ci.yml` | GitHub Actions | 仓库已有配置，保留作为 GitHub 侧自动检查 |

本次主要交付 `.gitlab-ci.yml`。该文件按前后端拆分任务，避免单个任务过长，也便于定位失败阶段。

## 3. 流水线阶段设计

| 阶段 | 任务 | 执行内容 | 通过标准 |
|---|---|---|---|
| install | `backend:install` | 后端执行 `npm ci` | 依赖安装成功 |
| install | `frontend:install` | 前端执行 `npm ci` | 依赖安装成功 |
| check | `backend:check` | 后端执行 `npm run lint` | TypeScript 检查通过 |
| check | `frontend:check` | 前端执行 `npm run lint` | TypeScript 检查通过 |
| test | `backend:test` | 后端执行 `npm test` | 单元测试通过 |
| test | `frontend:e2e` | 前端执行 `npm run e2e` | E2E 流程测试通过 |
| build | `backend:build` | 后端执行 `npm run build` | 生成 `backend/dist/` |
| build | `frontend:build` | 前端执行 `npm run build` | 生成 `frontend/dist/` |

## 4. 关键配置说明

- 后端测试任务使用 PostgreSQL 16 服务容器，并设置 `DATABASE_URL`、`JWT_SECRET`、`ADMIN_KEY` 等 CI 环境变量。
- 后端测试前显式调用 `runMigrations()` 初始化数据库结构，避免空数据库导致测试失败。
- 前端 E2E 任务使用 Playwright 官方镜像，避免浏览器依赖缺失。
- 前端测试设置 `VITE_USE_MOCK=true`，使用 Mock 数据完成页面流程验证。
- 构建产物通过 artifacts 保留，便于查看和下载。
- `node_modules` 和 npm 缓存通过 cache/artifacts 在任务之间复用，减少重复安装时间。

## 5. 本地运行记录

| 时间 | 环境 | 命令/任务 | 结果 | 说明 |
|---|---|---|---|---|
| 2026-06-07 | Windows PowerShell | 检查 `backend/node_modules`、`frontend/node_modules` | 未安装 | 本地工作区尚无依赖目录，需要先执行依赖安装 |
| 2026-06-07 | Windows PowerShell | `cd backend && npm ci` | 未执行成功 | 当前本地环境未识别 `npm` 命令，无法进行完整本地验证；CI Runner 使用 `node:20` 镜像，不受该本地环境限制 |

后续实际运行后补充以下记录：

| 时间 | 环境 | 命令/任务 | 结果 | 说明 |
|---|---|---|---|---|
|  | 本地 | `cd backend && npm ci` |  |  |
|  | 本地 | `cd backend && npm run lint` |  |  |
|  | 本地 | `cd backend && npx tsx -e "import { runMigrations } from './src/db/migrate.ts'; import { queryClient } from './src/db/connection.ts'; await runMigrations(); await queryClient.end();" && npm test` |  |  |
|  | 本地 | `cd backend && npm run build` |  |  |
|  | 本地 | `cd frontend && npm ci` |  |  |
|  | 本地 | `cd frontend && npm run lint` |  |  |
|  | 本地 | `cd frontend && npm run e2e` |  |  |
|  | 本地 | `cd frontend && npm run build` |  |  |

## 6. 平台运行记录

当前记录项用于 GitLab CI/CD 页面截图或日志补充。

| 字段 | 内容 |
|---|---|
| 分支 |  |
| 提交号 |  |
| 流水线编号 |  |
| 触发方式 | Push / Merge Request |
| 总体结果 | Passed / Failed |
| 失败阶段 | 如无失败填写“无” |
| 修复说明 | 如有失败，记录失败原因和修复方式 |

## 7. 当前结论

CI 配置文件已覆盖 P4 要求中的自动安装依赖、自动运行静态检查、自动运行单元测试、自动运行集成/E2E 测试和自动构建项目。待代码推送到 GitLab 后，需要在流水线页面保存最近一次运行结果，作为正式验收截图或日志依据。
