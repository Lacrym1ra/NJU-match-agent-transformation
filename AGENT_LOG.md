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
