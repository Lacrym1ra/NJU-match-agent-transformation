# NJU-Match Social Agent Harness

本仓库用于完成 AI4SE Project A：在 NJU-Match 现有社交系统上构建一个**直接面向用户、内核自行实现的 Agent Harness**。

NJU-Match 已有的问卷、人格画像、匹配、圈子和论坛功能继续作为稳定业务模块。新增 Agent 负责理解用户目标、选择业务工具、执行多步骤任务、处理失败反馈，并在发帖、评论、加入圈子等写操作前请求用户确认。

## 项目边界

本项目不是：

- 将问卷替换成聊天机器人；
- 让 Agent 代替用户编造问卷答案；
- 面向代码仓库执行补丁、Shell 命令或自动修复 CI；
- 使用 LangChain AgentExecutor、AutoGen、CrewAI 等高层循环代替自行实现的 Harness。

GitHub Actions、测试、CodeQL 和 Secret Scan 是项目的工程保障，不是 Agent 的服务对象。

## 总体架构

```text
用户
  ↓
Agent 对话入口
  ↓
自行实现的 Harness
  ├─ Context Builder
  ├─ LLMPort / MockLLM
  ├─ Action Parser
  ├─ Tool Registry
  ├─ Authorization / Confirmation
  ├─ Observation Feedback
  ├─ Session Memory
  └─ Stop Controller / Trace
       ↓
NJU-Match 业务工具适配层
  ├─ Profile
  ├─ Questionnaire
  ├─ Matching
  ├─ Circle
  └─ Forum
       ↓
现有 Service、数据库与业务规则
```

Agent 不直接访问数据库，也不能自行提供 `userId`。工具必须复用后端 Service，并从服务端认证上下文取得当前用户身份。

## 推荐演示

```text
用户：我周末想在仙林找人打羽毛球，帮我看看。

Agent：
1. 查询当前用户的校区和可用画像；
2. 搜索羽毛球相关圈子；
3. 搜索近期约球帖子；
4. 返回有真实依据的候选结果；
5. 按需生成约球帖草稿；
6. 只有用户确认后才发布。
```

该场景用于展示多轮决策、跨工具编排、客观反馈、会话状态和 HITL 写操作确认。

## 仓库结构

```text
ai4coding-lab/
├─ NJU-Date-basic/       NJU-Match 业务基线
├─ agent-harness/        自研 Agent Loop、工具、治理、反馈、记忆与 API
├─ docs/                 架构、工具规范、威胁模型、评测与证据
├─ .github/              GitHub Workflow 与仓库治理
├─ SPEC.md
├─ PLAN.md
├─ SPEC_PROCESS.md
├─ AGENT_LOG.md
└─ REFLECTION.md
```

`agent-harness/` 尚未创建；必须先合并本次方向修正文档，再按照 `PLAN.md` 通过独立 PR 建立实现。

## MVP 能力

- 自行实现有限步 Agent Loop；
- 可替换的真实 Provider 与离线 Mock LLM；
- 结构化 Action、Observation 和 AgentState；
- Profile、Questionnaire、Circle、Forum 等业务工具；
- 工具参数校验和服务端身份绑定；
- Read、Draft、Write、Sensitive 风险分级；
- 写操作确认状态机；
- 工具失败回灌和下一步修正；
- 会话级记忆、预算、停止条件和脱敏 Trace；
- 不依赖网络和真实 API Key 的机制测试。

## 安全基线

- 不提交真实 API Key、证书、私钥、`.env`、Cookie 或运行时状态；
- API Key 后续仅通过运行环境或 GitHub Secrets 注入；
- Mock LLM 测试不得访问网络；
- Tool 只获得完成任务所需的最少用户字段；
- 发帖、评论、加入圈子等写操作必须显式确认；
- Trace 和 Artifact 不得包含秘密或完整敏感资料；
- Agent 不得绕过 NJU-Match 原有鉴权、内容治理和数据权限。

## 开发流程

每项工作遵循：

```text
最新 main → 单一目标分支 → 测试/规格 → 最小实现
→ 本地验证 → Pull Request → Required Checks → Squash Merge
```

详细规则见 [GIT_WORKFLOW.md](./GIT_WORKFLOW.md)，需求见 [SPEC.md](./SPEC.md)，任务顺序见 [PLAN.md](./PLAN.md)。
