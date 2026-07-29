# NJU Match 可执行任务清单（开发可直接开工，脱敏安全版）

## 0. 使用说明

本文给研发同学直接执行，默认不接触核心安全信息。

禁止接触项：
- 任何密钥、管理员口令、生产主机信息、数据库凭据。
- 生产环境配置文件与线上控制台账户。

协作方式与数据库规范：
- 研发只用本地开发环境与占位变量。
- 需要高权限操作时，由授权同学执行并反馈结果。
- 所有数据库表结构变更（如 schema.ts 新增审核日志、拉黑记录等），必须生成 Drizzle 的 migration 文件交由 CI/CD 或运维自动化执行，严禁直连生产库建表。

文档导航与使用顺序：
- 分工总表：`design_docs/GROUP_RESPONSIBILITIES.md`
- 单点功能设计文档优先级高于任务清单；任务清单优先级高于路标文档。
- 三组统一入口：`design_docs/GROUP_API_GUIDE.md`
- 第一组开工前必读：`design_docs/se_full_plan.md`、`design_docs/EXECUTABLE_TASKLIST_DEV_SAFE.md`、`design_docs/MESSAGE_CENTER_DESIGN.md`、`design_docs/REPORT_BLOCK_DESIGN.md`
- 第二组开工前必读：`design_docs/CIRCLE_MODULE_PLAN.md`、`design_docs/CIRCLE_API.md`、`design_docs/CIRCLE_DEV_PLAN.md`
- 第三组开工前必读：`design_docs/se_full_plan.md`、`design_docs/FORUM_GOVERNANCE_API.md`、`design_docs/REPORT_BLOCK_DESIGN.md`、`design_docs/ROADMAP_STATUS.md`
- 如果某功能已经有独立设计文档，开发、联调、验收一律先按该设计文档执行。
- 后台受限角色与跨部门权限模型见：`design_docs/ADMIN_PERMISSION_MODEL.md`

---

## 1. Sprint 切分总览

- Sprint -1（准备期）：协作开发基础设施搭建
- Sprint 0（1周）：体验稳定化与统一反馈
- Sprint 1（1-2周）：宣传/运维一键能力 MVP + 客服工单能力
- Sprint 2（2周）：圈子前台化与运营可视化 + 校友适配
- Sprint 3（1-2周）：测试、告警、审计完善

---

## 2. 详细任务清单（可直接建看板）

## Sprint -1：协作开发基础设施（准备期）

### ~~Task S-1-INFRA-01 创建贡献指南与开发规范~~ ✅ 已完成
- 交付物：`CONTRIBUTING.md`（分支策略、commit 规范、PR 流程、代码审查规则）

### ~~Task S-1-INFRA-02 仓库安全清理~~ ✅ 已完成
- 清理内容：
  - SSL 私钥/证书（`.key`/`.pem`）从 Git 历史彻底清除，本地保留
  - `backend/.env`（含真实密钥）从历史彻底清除，本地保留
  - `*.tar` 构建产物、`backend/node_modules/` 历史从 Git 清除
  - `API_REFERENCE.md.old` 删除，`bubbly-frolicking-hammock.md` 重命名
  - `.gitignore` 更新覆盖 `*.key`、`*.pem`、`*.env`、`*.docx`、`*.tar`

### Task S-1-INFRA-03 基础 CI 与分支保护
- 目标：PR 需通过基础自动化检查后才能合入。
- 角色：项目负责人
- ~~已完成~~（全部完成 ✅）：
  - [x] GitHub 分支保护规则配置（main 禁止直接 push）
  - [x] `.github/pull_request_template.md`（PR 模板）
  - [x] `.github/ISSUE_TEMPLATE/`（Bug 报告 + 功能建议模板）
  - [x] `.github/workflows/ci.yml`（后端 TypeScript 编译 + lint，前端 TypeScript + build）
- 当前协作备注：
  - 在 `GitHub Free + private organization repo` 组合下，branch protection 不能作为唯一强制手段。
  - 当前实际执行方式是“CI + PR + 人工纪律管理 + 项目负责人最终合并”。

---

## Sprint 0：体验稳定化

### ~~Task S0-FE-00 全局 Toast/Notification 组件（前置）~~ ✅ 已完成
- 主要文件：frontend/src/components/Toast.tsx（新建）, frontend/src/api/client.ts, frontend/src/App.tsx
- 交付：
  - `ToastProvider` + `useToast()` hook + 模块级 `toast` 命令式 API（可在非 React 代码中调用）
  - 支持 success/error/warning/info 四类，framer-motion 动画，4 秒自动消失，最多 5 条堆叠
  - client.ts 401 重定向前展示 warning toast

### ~~Task S0-FE-01 统一错误反馈组件~~ ✅ 已完成
- 主要文件：frontend/src/pages/Dashboard.tsx
- 交付：
  - Dashboard loadMatch 由 silent fail 改为 `toastError`
  - 参与状态切换（暂停/恢复）的成功/失败均改用 toast，移除 toggleError 内联 state
  - 依赖 S0-FE-00

### ~~Task S0-FE-02 登录后统一路由状态机~~ ✅ 已完成
- 主要文件：frontend/src/context/AuthContext.tsx, frontend/src/components/ProtectedRoute.tsx
- 交付：
  - AuthContext 新增 `authStatus: AuthStatus`（loading / unauthenticated / needs_profile / needs_survey / ready）
  - ProtectedRoute 改为基于 `authStatus` switch 分支，逻辑更清晰，`SURVEY_BYPASS` 白名单集合化

### ~~Task S0-BE-01 关键动作预检接口~~ ✅ 已完成
- 主要文件：backend/src/routes/admin.ts
- 交付：`GET /admin/trigger-matching/precheck`（返回可参与人数、本周是否已运行、锁定状态、safe 字段）

### ~~Task S0-DB-01 Sprint 0 数据库迁移（前置）~~ ✅ 已完成
- 主要文件：backend/src/db/schema.ts, backend/src/db/migrate.ts
- 交付：新增 `audit_logs`、`user_blocks`、`user_reports` 三张表，含索引，IF NOT EXISTS 可重复执行

### ~~Task S0-BE-02 管理动作审计日志~~ ✅ 已完成
- 主要文件：backend/src/utils/audit.ts（新建）, backend/src/routes/admin.ts
- 交付：`logAudit()` 工具函数 + 接入 trigger_matching / unlock_reveal / bulk_survey_reminder / bulk_match_revealed_notify / review_report

### Task S0-BE-03 社交合规与数据匿名化注销（后端已完成，前端入口待补）
- 主要文件：backend/src/routes/user.ts
- 详细设计：`design_docs/REPORT_BLOCK_DESIGN.md`
- 交付：
  - `POST /user/block/:targetId` / `DELETE /user/block/:targetId`（后端拉黑/解除）
  - `POST /user/report/:targetId`（后端举报提交，reason 枚举 + detail）
  - `DELETE /user/account` 改为匿名化：PII 字段置空/替换为占位邮箱，survey/mailLogs/blocks 删除，matches 保留，圈子成员停用
  - 管理端 `GET /admin/reports` + `PATCH /admin/reports/:id`（举报审核）
  - 前端待补：Reveal/历史记录页增加拉黑、举报入口，Admin 页面增加举报处理面板

#### 当前实现边界（强制对齐）
- 当前举报审核只有 `pending -> reviewed | dismissed`，不要误写成已经有处罚 / 申诉全流程。
- 当前拉黑先落在“用户动作记录 + 后续匹配排除”的能力，不要求一次性覆盖所有圈子与好友场景。
- 举报与拉黑的详细交互、三组边界、页面入口位置，一律以 `design_docs/REPORT_BLOCK_DESIGN.md` 为准。

#### S0-BE-03 运作规则（MVP，强制对齐）
- 拉黑与“已匹配排除”是两套机制：
  - “已匹配排除”用于避免重复配对。
  - “拉黑”用于跨场景长期隔离与安全边界控制。
- 拉黑生效目标（按阶段落地）：
  - 阶段 A：匹配候选池双向排除（A 拉黑 B 后，A/B 不再互相进入候选）。
  - 阶段 B：扩展到圈子推荐、互动入口、资料可见性等触点。
- 举报工单流转：`pending -> reviewed | dismissed`，所有处理动作必须落审计日志。
- 惩罚分级与申诉机制：作为后续治理增强项预留，本轮不作为必须落地项。
- 安全要求：任何自动化惩罚都必须可追溯（证据摘要、处理人、时间、理由）。

### Task S0-FE-04 揭晓页 / 历史记录页举报与拉黑入口（新增）
- 目标：补齐用户侧合规入口，让第一组可以独立开工。
- 角色：前端（第一组） + 后端联调（第三组提供接口口径）
- 主要文件：`frontend/src/pages/Reveal.tsx`、历史记录相关页面 / 组件
- 详细设计：`design_docs/REPORT_BLOCK_DESIGN.md`
- 验收：
  - Reveal / 历史记录页均可见“举报”“拉黑”入口
  - 举报弹窗支持 `reason` 枚举 + `detail`
  - 拉黑操作有二次确认
  - 成功 / 失败均有统一反馈
- 工时：1-2 人日
- 依赖：S0-BE-03

### ~~Task S0-FE-03 移动端适配审查与修复~~ ✅ 已完成
- 主要文件：frontend/src/pages/Survey.tsx, frontend/src/pages/Settings.tsx
- 交付：
  - Survey textarea/number input/search input 新增 `onFocus scrollIntoView(center)`，防止软键盘遮挡
  - Survey 底部 padding 改为 `calc(10rem + env(safe-area-inset-bottom, 0px))`，适配 iPhone 底部安全区
  - Settings bio textarea 同样加 scrollIntoView
  - Reveal 拖拽使用 framer-motion `drag="y"` 原生支持 touch，无需额外改动

---

## Sprint 1：跨部门一键能力 MVP（新增重点）

### Task S1-BE-01 运维一键维护模式 API
- 目标：提供开启/关闭维护模式接口。
- 角色：后端
- 主要文件：backend/src/routes/admin.ts, backend/src/utils/lockdown.ts, backend/src/index.ts
- 验收：
  - 开启后前端显示维护页，非关键写接口受限。
  - 关闭后自动恢复。
- 工时：3 人日
- 安全边界：研发仅实现能力，不持有生产开关权限。

### Task S1-FE-01 维护模式页面与探测
- 目标：用户侧维护提示页可控展示。
- 角色：前端
- 主要文件：frontend/src/pages/NotFound.tsx 或新建 maintenance 组件, frontend/src/App.tsx
- 验收：
  - 维护中访问关键页面可见统一提示与预计恢复信息。
- 工时：1-2 人日
- 安全边界：不涉及密钥。

### Task S1-BE-02 宣传一键邮件任务 API（模板化）
- 目标：创建”模板 + 人群 + 发送时间”的受控任务接口。
- 角色：后端
- 主要文件：backend/src/routes/admin.ts, backend/src/services/campaignService.ts（新建）, backend/src/db/schema.ts, backend/src/middleware/rateLimit.ts
- 验收：
  - 支持立即发送与预约发送。
  - 支持样本发送与任务状态查询。
  - 核心接口必须挂载 rateLimit，防止接口被恶意工具滥刷导致邮件风暴。
  - 退信率超过阈值时自动暂停任务。
- 工时：3-4 人日
- 安全边界：邮件服务凭据由授权同学配置，研发仅调用抽象层。

### Task S1-BE-03 宣传活动公告 API（新增）
- 目标：提供全局系统通告、横幅的内容与下发时间窗管理。
- 角色：后端
- 主要文件：backend/src/routes/admin.ts, backend/src/db/schema.ts
- 验收：
  - 可通过管理端下发强提醒公告并存库，过期自动下线。
- 工时：2 人日
- 安全边界：无密钥依赖。

### Task S1-FE-02 宣传运营面板（脱敏）
- 目标：宣传同学可发起任务，不可触及高危功能。
- 角色：前端
- 主要文件：frontend/src/pages/Admin.tsx（或拆分子页面）
- 验收：
  - 仅展示模板任务与统计，不展示密钥相关字段。
- 工时：2-3 人日
- 安全边界：通过角色权限隐藏高危入口。

### Task S1-BE-04 客服/运营工单支持 API
- 目标：提供用户状态脱敏查询和基础账号干预能力，支持客服处理工单。
- 角色：后端
- 主要文件：backend/src/routes/admin.ts, backend/src/db/schema.ts
- 验收：
  - 通过学号/外部 ID 查询用户的平台生命周期状态（未认证/问卷中/匹配中/被拉黑等），严格遮蔽问卷作答项与隐私数据。
  - 支持"重置建档状态""断开异常匹配"等基础干预动作。
  - 所有干预操作写入审计日志。
- 工时：2-3 人日
- 安全边界：仅返回脱敏状态，不可查看问卷答案或联系方式。
- 依赖：S0-BE-02（审计日志）。

### Task S1-FE-03 客服运营面板（脱敏）
- 目标：客服/运营同学可查询用户状态并执行受限干预，不可触及高危功能。
- 角色：前端
- 主要文件：frontend/src/pages/Admin.tsx（或拆分子页面）
- 验收：
  - 仅展示脱敏用户状态，不展示密钥相关字段。
  - 干预操作需二次确认。
- 工时：1-2 人日
- 安全边界：通过角色权限隐藏高危入口。

### Task S1-BE-05 匹配层接入拉黑排除规则（新增）
- 目标：让拉黑从“记录动作”升级为“候选排除动作”。
- 角色：后端
- 主要文件：backend/src/matching/*, backend/src/services/matchService.ts, backend/src/routes/admin.ts
- 详细设计：`design_docs/REPORT_BLOCK_DESIGN.md`
- 验收：
  - 任何 A->B 或 B->A 的拉黑关系都应在候选构建阶段被排除。
  - 周匹配统计中新增“因拉黑排除”聚合计数（仅聚合，不返回敏感明细）。
  - 不影响既有“历史已匹配排除”逻辑。
- 工时：2-3 人日
- 安全边界：仅使用脱敏统计，不透出拉黑关系明细给普通角色。

### Task S1-FE-04 举报处理面板（当前）与申诉能力预留（新增）
- 目标：完成举报审核的管理端闭环，并为后续申诉能力预留扩展位。
- 角色：前端 + 后端
- 主要文件：frontend/src/pages/Admin.tsx, backend/src/routes/admin.ts, backend/src/db/schema.ts
- 详细设计：`design_docs/REPORT_BLOCK_DESIGN.md`
- 验收：
  - Admin 可筛选 `pending/reviewed/dismissed` 举报并执行处理。
  - 当前只处理举报工单状态，不要求落地处罚等级存储。
  - 申诉能力本轮只做结构预留，不作为上线阻塞项。
- 工时：3-4 人日
- 安全边界：仅授权角色可见，所有操作二次确认并审计。

---

## Sprint 2：圈子与运营可视化 + 校友适配

### Task S2-FE-01 圈子入口与列表
- 目标：上线圈子入口、列表、详情页。
- 角色：前端
- 详细拆分：参照 `design_docs/CIRCLE_MODULE_PLAN.md`（M2 圈子频道）和 `design_docs/CIRCLE_DEV_PLAN.md`（阶段二前端任务）。
- 主要文件：frontend/src/App.tsx, frontend/src/pages/CircleList.tsx（新建）, frontend/src/pages/CircleDetail.tsx（新建）, frontend/src/api/circles.ts（新建）, frontend/src/components/NavBar.tsx
- 验收：
  - 用户可浏览圈子并加入/退出。
  - 圈子频道展示成员 + channelTag 标签。
  - 圈子详情页提供“进入圈子论坛 / 发布组队帖”入口，但论坛页本体仍由第三组负责。
- 工时：3-4 人日
- 安全边界：无敏感信息。

### Task S2-FE-02 圈子问卷与匹配流程
- 目标：完成圈内问卷提交、查看圈内匹配、圈内历史。
- 角色：前端
- 详细拆分：参照 `design_docs/CIRCLE_MODULE_PLAN.md`（M1 名片系统、M3-M4 好友与联系方式解锁）。
- 主要文件：frontend/src/api/circles.ts, frontend/src/api/friends.ts（新建）, frontend/src/api/contacts.ts（新建）, frontend/src/pages/*
- 验收：
  - 与后端 circles 接口联通，流程可走通。
  - 好友申请、名片查看、联系方式解锁端到端可用。
- 工时：4-5 人日
- 安全边界：无敏感信息。

### Task S2-FE-03 问卷断点续填
- 目标：60 道灵魂问卷支持中途退出后恢复进度。
- 角色：前端 + 后端
- 主要文件：frontend/src/pages/Survey.tsx, backend/src/routes/survey.ts
- 验收：
  - 前端显示进度条与预计剩余时间。
  - 中途退出后重新进入时提示"继续上次填写"并恢复进度。
  - 后端支持问卷草稿保存接口。
- 工时：2-3 人日
- 安全边界：无敏感信息需求。

### Task S2-FE-04 首次使用引导（Onboarding Tour）
- 目标：新用户首次进入仪表盘时显示功能引导。
- 角色：前端
- 主要文件：frontend/src/pages/Dashboard.tsx, frontend/src/components/OnboardingTour.tsx（新建）
- 验收：
  - 新用户首次登录后看到 3-5 步引导（产品节奏、问卷意义、双选机制）。
  - 用户可跳过或完成引导，状态记录在 localStorage。
- 工时：1-2 人日
- 安全边界：无敏感信息需求。

### Task S2-BE-01 运营漏斗统计接口
- 目标：提供注册->建档->问卷->参与->揭晓->双向漏斗数据。
- 角色：后端
- 主要文件：backend/src/routes/admin.ts, backend/src/services/*
- 验收：
  - 管理端可按周查看漏斗趋势。
- 工时：2-3 人日
- 安全边界：仅返回聚合数据，不返回敏感明细。

### Task S2-BE-02 校友/毕业生适配
- 目标：档案、问卷、算法全面支持"毕业生"身份。
- 角色：后端 + 前端
- 详细方案：参照 `design_docs/ALUMNI_UPDATE_PLAN.md`。
- 主要文件：backend/src/db/schema.ts, backend/src/routes/user.ts, frontend/src/pages/Onboarding.tsx, frontend/src/pages/Survey.tsx
- 验收：
  - 个人档案支持"毕业生"选项。
  - 问卷文案按身份动态适配。
  - Zod 枚举更新，后端不报 Schema Validator Error。
  - 匹配算法年级过滤池正确处理毕业生标签。
- 工时：3-4 人日
- 安全边界：不涉及密钥。

---

## Sprint 3：测试与质量保障

### Task S3-QA-01 核心链路集成测试
- 目标：覆盖登录、问卷、匹配、揭晓主链路。
- 角色：后端 + 前端 + QA
- 主要文件：backend/tests/*, frontend/tests/*（按项目实际补充）
- 验收：
  - CI 能跑通核心用例。
- 工时：4-6 人日
- 安全边界：仅使用测试配置与占位变量。

### Task S3-BE-01 审计与告警补齐
- 目标：关键失败告警与审计查询能力可用。
- 角色：后端 + 运维
- 主要文件：backend/src/routes/admin.ts, backend/src/services/*
- 验收：
  - 可查询最近失败任务，具备告警触发条件。
- 工时：2-3 人日
- 安全边界：告警渠道配置由授权同学执行。

---

## 3. 开发边界与权限模型（必须执行）

角色建议：
- Dev-Frontend：仅前端页面和 API 接入。
- Dev-Backend：仅业务逻辑与脱敏接口。
- Ops-Runner：执行生产开关、部署与密钥配置。
- Marketing-Operator：仅执行模板化任务与公告发布。

补充说明：
- `admin_key` 只应由项目负责人 / 超级管理员持有，不向跨部门同学分发。
- 宣传、客服、运维等角色的目标模型应为“后台账号 + 角色权限”，不是共享万能密钥。
- 详细设计见：`design_docs/ADMIN_PERMISSION_MODEL.md`

强制规则：
- 不在代码中写死任何密钥。
- 不在日志打印密钥、口令、原始凭据。
- 所有跨部门“一键操作”必须二次确认并写审计。

---

## 4. 任务模板（复制即用）

### 标准任务卡模板
- 标题：
- 目标：
- 影响范围：
- 改动文件：
- 接口契约：
- 验收标准：
- 安全边界检查：
- 预估工时：
- 依赖任务：
- 回滚方案：

---

## 5. 首周可立即开工清单（建议优先级）

**准备期（Sprint -1，开工前完成）：**
1. S-1-INFRA-01 创建贡献指南与开发规范
2. S-1-INFRA-02 仓库安全清理（敏感文件、构建产物）
3. S-1-INFRA-03 基础 CI 与分支保护

**第一周（Sprint 0）：**
1. S0-DB-01 数据库迁移（审计日志/拉黑表，前置）
2. S0-FE-00 全局 Toast/Notification 组件（前置）
3. S0-FE-01 统一错误反馈组件
4. S0-FE-02 登录后统一路由状态机
5. S0-BE-01 关键动作预检接口
6. S0-BE-02 管理动作审计日志
7. S0-BE-03 社交合规与数据匿名化注销（后端已完成，前端入口待补）
8. S0-FE-03 移动端适配审查与修复

以上完成后，推进 Sprint 1（跨部门一键能力）→ Sprint 2（圈子前台化 + 校友适配 + 漏斗看板）。
