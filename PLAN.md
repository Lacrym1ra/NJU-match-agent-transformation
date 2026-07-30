# PLAN：NJU-Match Social Agent Harness

> 状态：方向修正后的实施基线。
>
> 原则：每个任务使用独立分支和 PR；先写失败测试或明确的文档验收，再做最小实现；真实 API Key 接入最后进行。

## 任务模板

每个 Task 必须记录：

- Task ID；
- 目标与对应 Spec；
- 精确文件；
- 前置依赖；
- 失败测试或红灯证据；
- 最小实现；
- 验证命令；
- 风险和回滚方式；
- Commit Hash；
- PR 链接。

## 阶段与任务

### P0：方向修正

#### TASK-001：统一项目语义

- 分支：`docs/reframe-user-facing-agent`
- 目标：将仓库从代码修复 Agent 修正为面向用户的 NJU-Match Social Agent。
- 文件：
  - `README.md`
  - `SPEC.md`
  - `PLAN.md`
  - `AGENT_LOG.md`
  - `GIT_WORKFLOW.md`
  - `.github/workflows/harness-mechanism.yml`
- 验收：
  - 目标用户是 NJU-Match 普通用户；
  - 问卷、匹配、圈子和论坛被定义为业务工具；
  - 不再规划文件、补丁或 Shell Agent 工具；
  - Workflow 验证产品 Agent 机制；
  - `NJU-Date-basic/` 不被修改。
- 验证：

```bash
git diff --check
rg "面向用户|业务工具|用户确认" README.md SPEC.md PLAN.md
```

预期三个现行文档均能找到新方向的明确描述。

### P1：Harness 内核

状态：本地实现完成，待人工检查和 PR。

#### TASK-010：初始化 TypeScript 子项目

- 分支：`feat/agent-harness-core`
- 依赖：TASK-001
- 新增：
  - `agent-harness/package.json`
  - `agent-harness/package-lock.json`
  - `agent-harness/tsconfig.json`
  - `agent-harness/src/`
  - `agent-harness/tests/`
- 失败测试：加载最小 Harness 模块失败。
- 最小实现：Node 20、TypeScript、测试命令和构建命令。
- 验证：

```bash
cd agent-harness
npm ci
npm test
npm run build
```

#### TASK-011：Action、Observation 与状态

- 分支：与 TASK-010 同一 PR，或在 TASK-010 后单独创建。
- 新增：
  - `src/actions/schema.ts`
  - `src/core/types.ts`
  - `src/core/reducer.ts`
- 失败测试：
  - 非法工具名被拒绝；
  - 非法参数产生 `INVALID_ARGUMENT`；
  - 非法状态转换被拒绝。
- 最小实现：判别联合、Schema 和纯 Reducer。

#### TASK-012：LLMPort、MockLLM 与最小循环

- 新增：
  - `src/llm/LLMPort.ts`
  - `src/llm/MockLLM.ts`
  - `src/core/agentLoop.ts`
  - `src/core/stopController.ts`
  - `src/tracing/tracer.ts`
- 失败测试：
  - 两轮 Scripted Action 无法完成；
  - 超过 `maxSteps` 未停止；
  - Action/Observation Trace 不成对。
- 最小实现：脚本化 Mock LLM、有限步循环、内存 Trace。
- Gate：
  - 完全离线；
  - 无真实业务调用；
  - `npm test` 和 `npm run build` 通过。

本地结果：

- `npm run lint`：通过；
- `npm test`：10/10 通过；
- `npm run demo:core`：通过；
- 未推送远端。

### P2：只读业务工具

#### TASK-020：Service 边界盘点

- 分支：`feat/agent-read-tools`
- 目标：确认 Profile、Questionnaire、Circle、Forum 的现有路由、Service、认证和返回结构。
- 产出：
  - `docs/TOOL_SPECIFICATION.md`
  - Service 复用表；
  - Tool 输入输出 Schema；
  - 不稳定接口和缺口清单。
- 约束：不重写原有业务算法。

#### TASK-021：Tool Registry 与错误标准化

- 新增：
  - `src/tools/registry.ts`
  - `src/tools/types.ts`
  - `src/tools/errors.ts`
- 失败测试：
  - 未注册工具；
  - 超时；
  - Service 异常；
  - 结果超过上限。
- 最小实现：按名称分发并生成统一 Observation。

#### TASK-022：接入第一批工具

- 工具：
  - `get_my_profile`
  - `get_questionnaire_status`
  - `search_circles`
  - `search_forum_posts`
- 失败测试：
  - 模型提供 `userId` 被拒绝；
  - 未登录被拒绝；
  - 空结果返回 `NO_RESULTS`；
  - 用户不可见记录不返回。
- Gate：
  - Tool Contract Tests 通过；
  - 身份来自服务端上下文；
  - 输出字段和数量受限。

### P3：治理与 HITL

#### TASK-030：风险分级与授权

- 分支：`feat/agent-hitl-actions`
- 新增：
  - `src/policies/authorization.ts`
  - `src/policies/risk.ts`
  - `src/policies/contentPolicy.ts`
- 失败测试：Write 被直接执行、Sensitive 未被拒绝、越权可重试绕过。
- 最小实现：Read、Draft、Write、Sensitive 的确定性决策。

#### TASK-031：待确认动作状态机

- 新增：
  - `src/policies/confirmation.ts`
  - PendingAction 存储接口；
  - confirm/reject 状态转换。
- 失败测试：
  - 未确认发生写入；
  - 过期动作仍可执行；
  - 动作可重复消费；
  - 客户端能替换参数。
- 最小实现：服务器端动作、参数哈希、过期时间和一次性消费。

#### TASK-032：帖子草稿与发布

- 工具：
  - `draft_forum_post`
  - `publish_forum_post`
- Gate：
  - 草稿不写数据库；
  - 发布前进入 `WAITING_CONFIRMATION`；
  - 确认后只执行一次；
  - 取消后不执行。

### P4：Agent API 与 UI

#### TASK-040：会话 API

- 分支：`feat/agent-user-interface`
- API：
  - 创建会话；
  - 发送消息；
  - 查询状态；
  - 确认/拒绝动作；
  - 取消任务。
- 失败测试：跨用户读取会话、篡改确认、重复确认。

#### TASK-041：Agent 页面

- 路由：`/agent`
- UI：
  - 消息列表；
  - 执行状态；
  - Tool Card；
  - 候选结果；
  - 草稿；
  - 确认对话框；
  - 取消和错误提示。
- 约束：不展示模型内部思维链。
- Gate：传统问卷、圈子和论坛页面无回归。

### P5：机制演示与 CI

#### TASK-050：确定性场景

- 分支：`test/agent-scenarios-workflow`
- 至少 10 个场景：
  - 3 个单工具查询；
  - 3 个跨工具任务；
  - 2 个写操作确认；
  - 1 个身份越权拒绝；
  - 1 个工具失败/无结果修正。

#### TASK-051：三项机制演示

- npm scripts：
  - `demo:confirmation`
  - `demo:feedback`
  - `demo:authorization`
- 必须证明：
  - 写操作确认前不执行；
  - 失败 Observation 改变下一步；
  - 伪造身份被代码拒绝。
- Trace Artifact 必须脱敏。

#### TASK-052：Workflow Required Checks

- 更新：
  - `.github/workflows/ci.yml`
  - `.github/workflows/harness-mechanism.yml`
  - 必要时更新 Ruleset。
- Checks：
  - Harness Unit；
  - Tool Contract；
  - Agent Scenario；
  - Harness Mechanism Demo；
  - 原应用回归；
  - Security；
  - Docker。

### P6：真实 Provider

#### TASK-060：ProviderLLM

- 分支：`feat/provider-llm`
- 前置：用户提供 API Key 和 Provider 配置。
- 要求：
  - 实现 `LLMPort`；
  - Key 只从环境变量或 Secret 读取；
  - 超时、重试、输出 Schema 和预算；
  - Mock 仍是 CI 默认；
  - 真实 smoke test 只允许手动触发或受保护环境。

## 四天安排

| 日期 | 工作 | 预期 PR |
|---|---|---|
| Day 1 | 方向修正、SPEC、类型、MockLLM、最小循环 | TASK-001、P1 |
| Day 2 | Service 盘点、Registry、四个只读 Tool | P2 |
| Day 3 | Risk、HITL、发帖工具、Agent API/UI | P3、P4 |
| Day 4 | 10 个场景、机制演示、Workflow、文档与交付 | P5 |

## Definition of Done

Task 只有同时满足以下条件才完成：

- 对应 Spec 验收项通过；
- 有失败测试/红灯证据和修复后绿灯；
- Mock 下确定性；
- 不含真实凭据；
- Trace 可解释且脱敏；
- 原业务无回归；
- PR 有人工评审；
- Required Checks 全绿；
- 本文件和 `AGENT_LOG.md` 已更新；
- Commit Hash 和 PR 已记录；
- 可安全回滚。
