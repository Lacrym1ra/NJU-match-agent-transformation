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
- 教训：Harness 的反馈和危险动作必须来自目标业务域；不能因为 Project A 名称包含 Coding Agent，就把现有产品强行降格为代码修复 Fixture。
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
