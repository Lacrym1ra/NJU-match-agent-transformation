# AGENT LOG

本文件记录 AI 辅助开发过程、人工决策和可复现证据。
它记录的是“使用开发 Agent 构建 Social Agent Harness”的过程，
不是产品 Agent 的运行日志。

## 记录模板

每条记录包含：

- 时间；
- Task ID；
- 分支；
- 使用的 Agent / Skill；
- Prompt / Context 摘要；
- Agent 输出或 Commit；
- 执行的验证；
- 人工修改与取舍；
- 原因；
- 教训；
- PR 链接。

产品运行 Trace 必须存放在独立的脱敏目录或测试 Artifact 中，不得记录 API Key、Token、Cookie、完整私密资料或模型内部思维链。

---

## 2026-07-30 — TASK-001

- 分支：`docs/reframe-user-facing-agent`
- Agent：Codex
- 目标：修正项目 Agent 定位。
- 原始问题：仓库文档将 NJU-Match 当作 Coding Agent 的目标代码库，重点规划文件读写、补丁、Shell、Worktree 和测试反馈。
- 人工决策：Agent 应直接面向 NJU-Match 用户；已有问卷、匹配、圈子和论坛是 Agent 可调用的业务能力；CI 与安全扫描只负责工程保障。
- 修改：
  - 重写 `README.md`；
  - 将 `SPEC.md` 补全为面向用户的产品与 Harness 规格；
  - 将 `PLAN.md` 改为业务工具、HITL、API/UI 和场景测试路线；
  - 修正 `harness-mechanism.yml` 的机制语义；
  - 修正 `GIT_WORKFLOW.md` 的任务和检查说明。
- 保留：`NJU-Date-basic/` 业务基线及原有测试、Security、Docker 和仓库治理。
- 未包含：Agent 实现、真实 API Key、业务基线代码修改。
- 教训：Harness 的反馈和危险动作必须来自目标业务域；不能因为
  Project A 名称包含 Coding Agent，就把产品强行降格为代码修复 Fixture。
- 验证：见本分支最终 `git diff --check`、Repository Policy 和 Documentation checks。

---

## 2026-07-30 — TASK-010 至 TASK-012

- 分支：`feat/agent-harness-core`
- Agent：Codex
- 目标：建立可以由 Mock LLM 确定性验证的最小 Harness 内核。
- 实现：
  - 初始化独立 TypeScript 子项目和依赖锁文件；
  - 定义 Action、Observation、AgentState 和运行配置；
  - 实现 `LLMPort`、`MockLLM` 和有限步 Agent Loop；
  - 实现 Tool Registry、超时与异常标准化；
  - 实现 Reducer、最大步数、重复动作限制和 Memory Trace；
  - 增加 10 个单元测试和一个反馈闭环 Demo。
- 红灯 1：严格类型检查发现 Mock 决策回调的 `context` 隐式为 `any`。
- 修正 1：显式使用导出的 `AgentContext`，未放宽 TypeScript 规则。
- 红灯 2：Node Test Runner 未自动解析 `dist/tests` 目录。
- 修正 2：测试命令显式列出编译后的测试文件，兼容本地与 CI。
- 绿灯：类型检查、构建、10/10 测试和 Core Demo 全部通过。
- 范围控制：没有接入真实业务 Service、数据库、Provider 或写操作确认。
- Workflow：只有确认、反馈和授权三个脚本均存在时才运行完整机制 Demo；
  当前 Core PR 仍由 Harness Unit 执行 lint、test 和 build。
- 教训：核心循环应先以业务无关 Fixture 证明机制，
  再通过独立 Tool Adapter 接入现有系统，避免复制业务逻辑。

---

## 2026-08-01 — TASK-020 至 TASK-022

- 分支：`feat/agent-read-tools`
- Agent：Codex
- 目标：接入资料状态、问卷状态、圈子搜索和论坛搜索。
- 实现：
  - 新增 `NjuMatchReadPort` 和四个只读 Tool；
  - 使用 Zod 严格校验 Tool 输入和后端输出；
  - 从 Tool Context 注入认证用户，拒绝模型传入 `userId`；
  - 将空搜索结果标准化为可重试 `NO_RESULTS`；
  - 新增后端 `agentReadService`，复用现有圈子与论坛 Service；
  - 新增资料完成度和问卷版本状态查询；
  - 修复论坛 Service 忽略 `circleId` 的筛选问题；
  - CI 增加 NJU-Match Backend 类型检查和单元测试。
- 红灯 1：Zod 可选属性与 `exactOptionalPropertyTypes` 不匹配。
- 修正 1：在 Port 契约中明确可选字段的 `undefined` 语义，未关闭严格模式。
- 红灯 2：原圈子 `description` 可为 `null`，不符合 Agent 输出契约。
- 修正 2：后端 Adapter 将其归一化为空字符串。
- 验证：Harness 19/19、后端 307/307，两个项目类型检查均通过。
- 范围：本步骤只有只读 Tool；没有写操作、HITL、Agent API 或真实 Provider。

---

## 2026-08-07 — TASK-070 至 TASK-073

- 分支：`feat/gateway-agent-design`（现有脏工作区上的窄范围修补，尚未提交）。
- Agent：Codex；未调用 subagent 或陌生 Agent。
- 目标：优先修复 Project A 特有关键缺口及不完整交付文档。
- 审计发现：
  - 独立 Harness 有自研循环，但真实 `/agent` 仍直接单次调用 Provider；
  - 记忆与配置只有规划或最低实现不足；
  - Social Agent 与 Project A 的 Coding 领域字面要求冲突；
  - `SPEC_PROCESS.md` 与 `REFLECTION.md` 仍是占位符；
  - 后端新增本地 Harness 依赖后，原 Docker build context 无法包含该包；
  - 根 `.gitlab-ci.yml` 缺失，无法满足精确 `unit-test` job 要求。
- 实现：
  - 真实 Provider 改为每轮只给出结构化决策，由自研 Loop 执行反馈闭环；
  - 前端传入会话 UUID，Trace 增加 Harness 状态、步数和工具序列；
  - 增加按用户/会话隔离的有界内存与声明式配置；
  - 增加独立 Coding adapter、文件围栏、危险命令护栏、测试传感器和确认机制；
  - Docker 后端改用仓库根 Context 以打包本地 Harness；
  - 新增根 `.gitlab-ci.yml` 的 `unit-test` job；
  - 补全 README、SPEC、PLAN、SPEC_PROCESS，并将 REFLECTION 保留为学生本人填写模板。
- TDD 红灯：`codingTools.test.ts` 首次编译因模块不存在失败；实现后第一次
  护栏断言命中 Schema 的 `INVALID_ARGUMENT` 而非 Policy，人工将夹具改为
  合法 UUID，使测试真正覆盖危险命令 Policy 分支。
- 流程偏差：生产 Runtime 适配测试和实现处于同一修补批次，没有保留严格“先红后绿”证据；已在 PLAN 如实标注，未追溯性伪造。
- 已执行验证：Harness 原有 38 项测试曾通过；Backend Runtime 1/1；后端完整 332/332；后端类型检查；前端生产构建。
- 最终验证：Harness 43/43；Coding Demo 5/5；Backend Runtime 1/1；后端
  332/332；前端构建；后端 Docker 干净构建及容器内包导入；Markdown
  lint 0 issue；`git diff --check` 通过。
- 人工/外部硬门槛：异类型陌生 Agent 冷启动、学生反思正文、最终安全凭据管理、课程方双轨方向确认、远端 CI/PR/commit/部署证据。

---

## 2026-08-07 — TASK-075

- Agent：Codex；未使用 subagent，也未冒充异类型陌生 Agent 冷启动。
- 目标：补齐除 `REFLECTION.md` 正文外，当前完全缺失或不能算交付的证据文件与许可证清单。
- 输入依据：AI4SE 通用最终交付清单、Project A 专属要求及 `DELIVERY_GAP_AUDIT.md`。
- 已完成：
  - 固化 PR #15、提交 `095b91d` 和全部 GitHub Check Run 链接；
  - 记录 CodeQL Polynomial ReDoS 的失败—修复—重跑证据；
  - 建立冷启动、部署、课程方向确认和最终验收的统一记录文件；
  - 根据三个 lockfile 建立直接生产依赖、用途和许可证清单；
  - 更新 README、PLAN 和 SPEC_PROCESS 的证据索引与真实状态。
- 人工边界：未填写学生反思；未伪造 GitLab Pipeline、公网部署、公开镜像、教师回复或陌生 Agent 实测结果。
- 过程说明：本 Task 是交付审计与文档固化，不宣称采用严格 TDD；所有可验证事实来自仓库、lockfile 和 GitHub 远端运行记录。

---

## 2026-08-08 — TASK-076

- Agent：Codex；当前环境没有可调用的 Superpowers skill，未伪造插件触发或 subagent 记录。
- 目标：针对通用要求第三章补充 Ubuntu 安全凭据、Windows Docker Desktop 分发、技术选型、一键验证以及工作流证据。
- 人工决策：正式部署目标为 Ubuntu；Windows 只要求 Docker Desktop 运行
  同一 Linux OCI 镜像；UI 继续使用原项目 `DESIGN.md`，不引入 Open Design。
- TDD 红灯：先加入 `src/utils/secretSource.test.ts`，执行
  `node --import tsx --test src/utils/secretSource.test.ts`，因
  `ERR_MODULE_NOT_FOUND` 失败。
- 绿灯：实现 `loadSecret` 后相同测试 5/5，通过 backend TypeScript lint。
- 安全实现：环境变量和文件来源互斥；Secret 文件必须是 allowlist 目录内的绝对路径、普通文件、非空且不超过 16 KiB；错误不回显秘密。
- 部署实现：systemd encrypted credential 隐藏录入、状态、更新、清除；运行时 tmpfs 解密并只读挂载到后端容器。
- 分发实现：增加 Windows Docker Desktop Linux container mode 的镜像构建/
  Compose 启动脚本，以及仓库根 `npm test`/`bootstrap:verify`。
- 统一脚本第一次在 Windows 启动 `npm.cmd` 时因 `spawnSync EINVAL` 失败；
  改为通过当前 npm CLI 的 Node 入口、`shell: false` 执行后通过。
- 重构后验证：`npm run bootstrap:verify` 在重新安装依赖后通过；Harness
  43/43、Backend 338/338、Frontend 31/31、生产构建成功。
- 静态验证：PowerShell Parser、Git Bash `bash -n`、Compose 合并配置、
  Markdownlint 和 `git diff --check` 通过。
- 环境限制：Docker Desktop 引擎未启动，因此本轮未声称已在本机构建镜像；
  Windows 脚本会拒绝该状态，镜像仍须在 Docker 启动后或远端 CI 实际构建。
- 证据边界：`docs/SUPERPOWERS_TDD_EVIDENCE.md` 只映射可证实的流程；
  历史没有 skill invocation、worktree 或 subagent 证据的步骤仍标为缺失。

---

## 2026-08-11 — TASK-080 至 TASK-081

- Agent：Codex；未使用 subagent，也未伪造 Superpowers 调用记录。
- 目标：将最终项目类型从 A 切换为 B，保留 Harness Agent 作为创新模块，并完成原有/新增功能边界和全站前端隐私分离基线。
- 当时的需求判定（后被用户纠正）：曾认为旧身份/匹配、圈子/组队、论坛/社交可计入 Project B 模块数。最终口径已在 TASK-090–092 修正：旧功能只是基线，不计本阶段新贡献。
- 文档修改：README、SPEC、PLAN、SPEC_PROCESS、交付缺口、最终检查表、
  反思模板和 Harness README 改用 Project B 口径；Project A 方向确认文件
  保留为历史记录。
- 新增证据：`PROJECT_B_SCOPE_AND_FEATURE_BASELINE.md` 区分继承、新增和
  改进；`FRONTEND_PRIVACY_SEPARATION_AUDIT.md` 覆盖 42 个路由模式及
  嵌套页面。
- 代码红灯设计：路由契约测试读取 `App.tsx`，任何新增但未分类的 Route 会导致集合断言失败。
- 代码实现：新增路由隐私规则、全局隐私边界标识；生产关闭
  `/agent-local`；重写 Privacy，并同步 About、Footer、UserAgreement、
  AccountSettings 和历史公告/管理员联系文案，移除原项目运营邮箱和
  社交媒体入口。
- 验证：前端 TypeScript 通过；34/34 单元测试通过（新增隐私契约 3/3）；
  Vite production build 通过；仓库根 `npm test` 全部通过；Markdown lint 0 issue。
- 诚实边界：自动化尚不能替代 42 个路由模式的多角色浏览器检查；专用
  隐私联系渠道、Provider 数据说明、导出和完整物理删除仍是上线真实用户前
  的 P0 缺口。

---

## 2026-08-11 — TASK-090 至 TASK-092

- Agent：Codex；未使用 subagent，未伪造 Superpowers 调用记录。
- 用户纠正：原 NJU-Match 全部功能都是阶段前基线，不能用于满足本阶段的功能模块数量。
- 新增 N1 “共鸣胶囊”：邀请码双人加入、单边回答封存、双方完成后同时揭晓；具有独立数据表、REST API、列表/详情页和状态机。
- 新增 N2 “安心赴约”：私有计划、本人签到、签到后完成、取消和超时视图；不宣称为应急服务。
- Agent 联动：新增两类状态读工具与两个受 HITL 确认的创建动作；Agent 无胶囊代答或赴约代签到/代完成工具。
- 隐私修正：数据库只存邀请码 SHA-256；一次性明文不写入 Agent
  Action 结果；发给模型的胶囊/赴约上下文排除问题正文、地点和备注；赴约
  DTO 不返回内部 `userId`。
- TDD 红灯：先增加两个 Policy 测试时因实现模块不存在得到 2 个 `ERR_MODULE_NOT_FOUND`；最小实现后进入数据库和浏览器验收。
- 实现期修正：处理过期视图与存储状态不同、胶囊并发提交假冲突、
  Express 5 路由参数类型，并拆分 Admin 图表依赖以消除超大单页包。
- 非 Mock 冒烟首次发现：真实网络延迟下，两个表单在 `await` 后再读
  React `event.currentTarget`，导致后端已 201 写入而前端未刷新。修正为等待前保存
  form 引用，重建前端镜像后复测通过。
- 真实验证：Backend 347/347，Frontend 34/34，Harness 44/44；
  三个 TypeScript/Vite build 通过；PostgreSQL 3/3（包含 Agent 确认前
  零副作用、确认后写入与 Token 单次消费）；Chromium 6/6；
  Docker Compose production frontend + Express + PostgreSQL 非 Mock 浏览器冒烟通过。
- UI：两个新页面沿用 `DESIGN.md` 的纸白、墨色、棕/紫、衬线标题、大留白、柔和玻璃光影与 0.8 秒入场动效。
- 未伪造的外部边界：尚未产生本批次的远端 CI/PR、公网浏览器或多角色 42 路由完整矩阵证据。

---

## 2026-08-11 — TASK-093 至 TASK-094

- Agent：Codex；未使用 subagent，未伪造 Superpowers 插件调用记录。
- 目标：补齐从自部署到登录/新模块的完整测试文档、Project B 演示数据以及
  Windows 端服务器离线部署包。
- TDD 红灯：先加入 `projectBDemoFixtures.test.ts`，执行单文件测试时因
  `projectBDemoFixtures.js` 不存在得到 `ERR_MODULE_NOT_FOUND`。
- 绿灯：实现纯 Fixture Builder 后 2/2 通过；后端完整测试增加到 349 项，
  仓库根 `npm test` 返回 0。
- 数据设计：固定 UUID 白名单承载 4 个共鸣胶囊与 5 个安心赴约样例；测试覆盖
  全生命周期，逾期仅为服务层派生视图，数据库保持 `scheduled`。
- 实际写入：Docker Compose PostgreSQL 中胶囊四种持久状态各一条；赴约包含
  `scheduled` 两条及 `checked_in`、`completed`、`cancelled` 各一条。
- 真实验证：PostgreSQL 集成 3/3、Chromium 6/6；Alice 通过真实 Backend 登录，
  认证读取 4 个胶囊和 3 个本人计划，未发生 `/survey` 强制跳转。
- Windows 反馈一：npm 子进程找不到 `powershell.exe`；新增 Node 启动器，从
  `%SystemRoot%` 定位 PowerShell 后原命令成功。
- Compose 反馈：此前 `nju-local-clean` 项目占用固定容器名；确认标签来自同一
  工作区后，保留旧数据卷、替换容器，并固定新项目名为 `nju-match-local`。
- 导出反馈：Backend/Frontend 首次构建成功，但无条件重新拉 PostgreSQL 时因
  Docker Hub TLS timeout 失败；改为验证并复用本地 `linux/amd64` 镜像。
- 候选提交：`574e279`（Project B 完整实现）与 `59d46a4`（离线导出修正）。
- 产物验证：三镜像均为 `linux/amd64`；镜像包和源码 ZIP 的 SHA-256、源码包
  必需文件及 JSON manifest 均通过检查。产物被 Git 忽略，不包含 `.env`。
- 外部边界：此记录形成时远端 PR/CI 尚待创建，不能把本地通过冒充远端 Check。
