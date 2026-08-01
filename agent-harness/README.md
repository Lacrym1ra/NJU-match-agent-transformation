# Agent Harness Core

这是 NJU-Match 面向用户的 Social Agent Harness 最小内核。
当前阶段只验证通用循环机制，不连接真实 LLM、数据库或 NJU-Match Service。

## 当前执行链

```text
RunRequest
→ build AgentContext
→ LLMPort.decide
→ parseAction
→ StopController
→ ToolRegistry.execute
→ Observation
→ reducer
→ 下一轮 AgentContext 或 finish
```

## 已实现

- `LLMPort` 抽象；
- 支持脚本或反馈函数的 `MockLLM`；
- `call_tool` 和 `finish` 结构化 Action；
- Action 运行时解析；
- 统一 Observation；
- Tool 注册、重复名拒绝和未知工具反馈；
- Tool 异常与超时标准化；
- 当前认证用户上下文传入 Tool；
- 最大步数和重复动作停止；
- LLM 异常失败状态；
- 内存 Trace；
- 严格 TypeScript 构建。

## 尚未实现

- 真实 Provider；
- NJU-Match Service Adapter；
- 业务参数 Schema；
- 授权 Policy；
- 写操作确认状态机；
- 持久化会话记忆；
- Agent API 和前端。

这些能力必须按根目录 `PLAN.md` 在后续独立 PR 中实现。

## 测试逻辑

### 1. 正常闭环

Mock LLM 先调用 `search_circles`。
Fixture Tool 返回 `SUCCESS`，下一轮 Context 必须包含该 Observation，
随后 Mock LLM 输出 `finish`。

断言：

- 最终状态为 `SUCCEEDED`；
- Tool 获得服务端提供的 `userId`；
- Trace 包含工具动作和完成动作；
- Observation 被保存在 State。

### 2. 非法动作恢复

Mock LLM 首先输出空工具名。
Parser 生成 `INVALID_ARGUMENT` Observation，
下一轮决策读取错误并正常结束。

### 3. 业务反馈改变下一步

第一步搜索论坛，Fixture 返回 `NO_RESULTS`。
第二轮 Mock LLM 必须检查该 Observation，并改为搜索圈子。
圈子搜索成功后结束。

这证明下一步不是预先执行的固定工具调用，
而是可以由上一轮结构化反馈驱动。

### 4. 最大步数

连续执行不同搜索，在两步预算耗尽后停止。
断言状态为 `BUDGET_EXCEEDED`，且第三个动作不执行。

### 5. 重复动作

连续产生完全相同的工具与参数。
超过 `duplicateActionLimit` 后停止，防止无意义循环。

### 6. 未注册工具

调用不存在的工具时不抛出未处理异常，
而是产生不可重试的 `NOT_FOUND` Observation。

### 7. 工具超时

Fixture Tool 超过配置时间，
Harness 返回可重试的 `SERVICE_ERROR`。

### 8. LLM 失败

Mock LLM 抛出 Provider 异常，
Harness 进入 `FAILED` 并记录稳定停止原因。

### 9. Tool Registry

分别验证：

- 重复工具名在注册时被拒绝；
- Tool 抛出的异常被标准化为 `SERVICE_ERROR`。

## 本地测试步骤

要求 Node.js 20 或更高版本。

```bash
cd agent-harness
npm ci
npm run lint
npm test
npm run demo:core
```

成功标准：

- TypeScript 严格检查通过；
- 构建通过；
- 10 个测试全部通过；
- Demo 最终状态为 `SUCCEEDED`；
- Demo Trace 顺序为论坛搜索、圈子搜索、完成。

所有测试使用 Mock LLM，不访问网络，也不需要 API Key。
