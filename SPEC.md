# SPEC：NJU-Match Social Agent Harness

> 状态：方向基线，待本 PR 人工确认。
>
> 本 SPEC 只覆盖 Project A。真实模型 API Key 后续由用户提供，在此之前所有测试与演示使用 Mock LLM。

## 1. 问题陈述

NJU-Match 已经提供问卷画像、匹配、圈子和论坛等能力，但用户必须理解不同页面和操作流程，才能组合这些功能完成“根据兴趣找到同好并参与讨论”等跨模块目标。

本项目新增一个直接面向用户的 Social Agent。Agent 通过自行实现的 Harness 将自然语言目标转换成结构化业务动作，调用现有 Service，并根据工具 Observation 决定下一步。Harness 必须用确定性代码保证身份、权限、写操作确认、预算和停止条件。

## 2. 目标与非目标

### 2.1 目标

- 为 NJU-Match 增加统一自然语言入口；
- 复用而非替换现有问卷、匹配、圈子和论坛能力；
- 自行实现 Agent 主循环、工具分发、治理、反馈和记忆；
- 支持可解释、可追踪的多步骤任务；
- 使用 Mock LLM 离线验证核心机制；
- 让写操作在服务器端确认后才执行；
- 保持现有传统 UI 和业务测试无回归。

### 2.2 非目标

- 自动回答整套问卷；
- 自动替用户建立关系或发送私聊；
- 自动修改代码、执行 Shell 或消费 CI 反馈；
- 用高层 Agent 框架代替 Harness 内核；
- 四天内覆盖所有 NJU-Match 模块；
- 在仓库中保存真实 API Key。

## 3. 目标用户

主要用户是希望通过 NJU-Match 寻找朋友、伴侣、兴趣圈子或论坛讨论的学生。

次要用户是负责观察 Trace、配置 Provider 和维护工具契约的项目开发者。开发者不是 Agent 的业务服务对象。

## 4. INVEST 用户故事

### US-01：资料与问卷状态

作为新用户，我希望 Agent 告诉我资料或问卷还缺少什么，以便知道哪些信息会影响匹配。

验收：

- Agent 只读取当前登录用户；
- 返回真实完成状态；
- 不代填或编造答案；
- 可以引导用户打开原问卷页面。

### US-02：寻找兴趣圈子

作为希望认识同好的用户，我希望 Agent 根据兴趣、校区和关键词查找圈子，以便选择适合的社区。

验收：

- 使用 `search_circles`；
- 返回不超过 10 个可见圈子；
- 结果包含可验证的名称、简介和活跃度字段；
- 无结果时不编造圈子。

### US-03：查找论坛讨论

作为论坛用户，我希望 Agent 搜索近期相关帖子并整理候选，以便快速了解现有讨论。

验收：

- 使用 `search_forum_posts`；
- 支持关键词和可选圈子条件；
- 摘要只基于工具结果；
- 没有结果时返回结构化 `NO_RESULTS`。

### US-04：跨模块寻找活动

作为想参加活动的用户，我希望 Agent 同时查找圈子和帖子，以便找到最相关、最近活跃的选择。

验收：

- 至少完成两次真实工具调用；
- 第一项工具反馈影响下一项动作；
- Agent 明确说明筛选依据；
- 达到最大步骤前结束。

### US-05：生成并发布帖子

作为想发起活动的用户，我希望 Agent 生成帖子草稿，并只在我确认后发布，以便保持最终控制权。

验收：

- 生成草稿不触发数据库写入；
- 发布动作进入 `WAITING_CONFIRMATION`；
- UI 展示目标圈子、标题和正文；
- 用户确认前发布 Service 调用次数为 0；
- 确认一次性、可过期且不可篡改。

### US-06：安全拒绝越权

作为用户，我希望 Agent 无法冒用其他用户身份，以保护账户和数据。

验收：

- `userId` 来自服务端认证上下文；
- 模型参数中的 `userId` 被 Schema 或 Policy 拒绝；
- 无权限 Observation 不会通过重试绕过；
- Trace 不记录 Token、Cookie 或完整敏感资料。

## 5. 领域与机制设计

### 5.1 决策

Harness 每轮构建受限 Context，调用 `LLMPort.decide()`，解析一个结构化 Action。真实模型仅负责建议下一步，Harness 决定该动作是否有效、允许以及能否执行。

### 5.2 工具

MVP 工具：

| 名称 | 风险 | MVP |
|---|---|---|
| `get_my_profile` | Read | 是 |
| `get_questionnaire_status` | Read | 是 |
| `find_matches` | Read | 可选 |
| `search_circles` | Read | 是 |
| `get_circle_details` | Read | 可选 |
| `search_forum_posts` | Read | 是 |
| `get_forum_post` | Read | 可选 |
| `draft_forum_post` | Draft | 是 |
| `publish_forum_post` | Write | 是 |
| `join_circle` | Write | 可选 |

工具必须：

- 使用 Zod 或等价 Schema 校验输入输出；
- 复用现有后端 Service；
- 不直接拼接 SQL；
- 从认证上下文取得用户身份；
- 返回统一 Observation；
- 限制结果数量和字段；
- 将内部异常映射为稳定错误类别。

### 5.3 上下文

每轮只提供当前请求、会话摘要、最少用户资料、工具定义、最近 Observation、待确认动作和剩余预算。不得向模型提供完整数据库、完整帖子库或整个代码库。

### 5.4 记忆

MVP 使用会话级记忆，保存：

- 当前目标；
- 用户明确给出的筛选条件；
- 工具调用和结果 ID；
- 草稿及待确认动作；
- 已失败动作与错误类别；
- 剩余预算。

默认不建立跨会话敏感画像记忆。

### 5.5 治理

风险分级：

- `Read`：鉴权后可直接执行；
- `Draft`：可生成但不能发布；
- `Write`：必须暂停并等待用户确认；
- `Sensitive`：MVP 默认拒绝。

确认机制必须由服务器保存 `pendingAction`，设置过期时间并限制一次性消费。客户端确认时不能替换工具参数。

### 5.6 反馈

客观反馈来自：

- Schema 校验；
- 鉴权和权限检查；
- Service 返回结果；
- 记录是否存在；
- 查询是否为空；
- 内容治理结果；
- 写入是否成功；
- 用户确认、拒绝或超时。

Observation 至少包含：

```ts
type Observation = {
  tool: string;
  ok: boolean;
  category:
    | "SUCCESS"
    | "INVALID_ARGUMENT"
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "NO_RESULTS"
    | "POLICY_DENIED"
    | "SERVICE_ERROR";
  summary: string;
  data?: unknown;
  retryable: boolean;
};
```

### 5.7 配置

声明式配置至少包括：

- `maxSteps`，默认 6；
- `toolTimeoutMs`，默认 10000；
- `maxRetriesPerTool`，默认 1；
- `duplicateActionLimit`，默认 2；
- Provider 名称、模型名和输出限制；
- Trace 脱敏字段；
- 各工具启用状态。

配置不能削弱代码中的身份边界和写操作确认。

## 6. 主要贡献

主要贡献选择：

> **面向社交业务工具的治理与 HITL 状态机，并与多轮工具反馈闭环集成。**

需要深入证明：

- 风险分级由代码而非提示词执行；
- 写操作在确认前不会调用 Service；
- 待确认动作防篡改、一次性且可过期；
- 无权限和治理失败会成为 Observation；
- Mock LLM 下能够确定性测试暂停、恢复、拒绝和反馈修正。

## 7. 架构与核心数据

```text
Agent API
  → AgentLoop
  → LLMPort
  → ActionParser
  → PolicyEngine
  → ToolRegistry
  → NJU-Match Service Adapters
  → Observation
  → Reducer / StopController
```

核心数据结构：

- `AgentRun`：运行 ID、用户 ID、状态、步骤和预算；
- `AgentAction`：工具名、参数、动作 ID；
- `Observation`：结构化执行结果；
- `PendingAction`：动作摘要、参数哈希、过期时间和确认状态；
- `SessionMemory`：目标、约束、结果引用和摘要；
- `TraceEvent`：脱敏后的动作、观察、状态变化和耗时。

状态：

```text
RUNNING
WAITING_CONFIRMATION
SUCCEEDED
FAILED
CANCELLED
BUDGET_EXCEEDED
```

## 8. API 边界

建议 Agent API：

```text
POST /api/agent/sessions
POST /api/agent/sessions/:id/messages
GET  /api/agent/sessions/:id
POST /api/agent/sessions/:id/actions/:actionId/confirm
POST /api/agent/sessions/:id/actions/:actionId/reject
POST /api/agent/sessions/:id/cancel
```

所有接口必须使用现有认证中间件。确认接口只消费服务端已经保存的动作。

## 9. 凭据与威胁模型

主要威胁：

- 模型伪造用户身份；
- Prompt Injection 诱导越权调用工具；
- 未确认写操作；
- 确认参数被替换；
- 敏感资料进入 Context 或 Trace；
- API Key 进入 Git、日志或 Artifact；
- 无限循环、重复发布和费用失控。

控制：

- 服务端认证上下文；
- Schema + Authorization Policy；
- 一次性待确认动作；
- 参数哈希；
- 最少字段 Context；
- 日志脱敏；
- Mock 默认测试；
- 步数、重试、重复动作、超时和 Token 预算；
- Secret Scan 和 CodeQL。

## 10. 测试与机制演示

测试分层：

- Harness 单元测试；
- Tool Contract Tests；
- Policy/HITL 状态机测试；
- Service Adapter 集成测试；
- Mock LLM Scenario Tests；
- 前端确认流程测试；
- 原应用回归测试。

三项必演示：

1. `publish_forum_post` 在确认前被暂停；
2. `NO_RESULTS` 回灌后下一步 Action 改变；
3. 伪造 `userId` 被确定性代码拒绝。

以上演示不得依赖网络或真实模型。

## 11. 分发

- `agent-harness` 使用 Node.js 20 和 TypeScript；
- 使用 Docker 构建可复现运行环境；
- 本地与 CI 默认使用 Mock LLM；
- Provider Key 仅通过环境变量或 GitHub Secret 注入；
- Demo 环境不开放任意工具或管理能力。

## 12. 验收标准

- 自研主循环可运行；
- Mock LLM 可替换真实 Provider；
- 至少三个业务域工具；
- 至少一个跨模块多步骤任务；
- 写操作确认机制通过确定性测试；
- 身份越权被代码拒绝；
- 工具失败能够回灌；
- 最大步数和重复动作限制生效；
- Trace 脱敏；
- 原应用测试无回归；
- GitHub Required Checks 全绿；
- 无真实凭据进入仓库。

## 13. 风险与未决问题

- 现有 Service 的可复用边界需在实现前逐项核实；
- PostgreSQL 全栈集成仍需补做；
- 第一版是否包含 `find_matches` 取决于匹配接口的稳定性；
- 前端 Agent 入口采用嵌入原应用还是独立部署，待核心 API 完成后决定；
- Provider 和模型参数等待用户提供 API Key 后确定；
- 长期记忆不进入 MVP。
