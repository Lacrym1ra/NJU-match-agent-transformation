# NJU-Match Social Agent Harness

本仓库用于完成 AI4SE Project A：在 NJU-Match 现有社交系统上构建
一个**直接面向用户、内核自行实现的 Agent Harness**，并在独立 Harness
包中实现课程要求的 coding 工具、测试传感器与治理护栏。

NJU-Match 已有的问卷、人格画像、匹配、圈子和论坛功能继续作为稳定业务模块。新增 Agent 负责理解用户目标、选择业务工具、执行多步骤任务、处理失败反馈，并在发帖、评论、加入圈子等写操作前请求用户确认。

## 项目边界

本项目不是：

- 将问卷替换成聊天机器人；
- 让 Agent 代替用户编造问卷答案；
- 让面向普通用户的 NJU-Match WebUI 暴露任意文件或 Shell 权限；
- 使用 LangChain AgentExecutor、AutoGen、CrewAI 等高层循环代替自行实现的 Harness。

GitHub Actions、CodeQL 和 Secret Scan 是项目的工程保障。课程 A 所需的
coding 机制只存在于受限的 `agent-harness` 扩展中，不对社交 WebUI 开放。

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

`agent-harness/` 是可独立构建的 TypeScript 包；真实 `/agent` 后端通过
本地包依赖调用其自研循环，不再绕过 Harness 直接完成单次模型调用。

## 安装

要求 Node.js 20+、npm、Docker Compose；全栈运行还需要 Docker Desktop 或兼容的 Docker Engine。

```bash
git clone https://github.com/Lacrym1ra/NJU-match-agent-transformation.git
cd NJU-match-agent-transformation/agent-harness
npm ci
npm test
```

业务应用依赖同仓库 Harness：

```bash
cd ../NJU-Date-basic/backend
npm ci
npm run build
cd ../frontend
npm ci
npm run build
```

## 运行

先从 `NJU-Date-basic/.env.example` 复制本机 `.env`，只填写测试环境值。
`.env` 是明文文件，已被 Git 忽略，不得提交或粘贴到 PR。LLM 配置使用
`LLM_API_KEY`、`LLM_BASE_URL`、`LLM_MODEL`。

```bash
cd NJU-Date-basic
docker compose up --build
```

默认 WebUI 为 `http://127.0.0.1:8082`。离线机制演示不需要 Key：

```bash
cd agent-harness
npm run demo:coding
npm run demo:confirmation
npm run demo:feedback
```

## 分发命令

容器分发使用仓库根目录作为后端构建上下文，以便包含本地 Harness 包：

```bash
docker build -f NJU-Date-basic/backend/Dockerfile -t nju-match-backend .
docker build -f NJU-Date-basic/frontend/Dockerfile -t nju-match-frontend NJU-Date-basic/frontend
```

生产密钥必须由部署平台 Secret、Docker Secret 或服务器受限环境文件注入；
镜像中不包含 `.env`。目标平台为 Linux amd64/arm64 容器，数据库为
PostgreSQL 16。

## 已知限制

- 会话记忆当前是进程内有界存储，重启后丢失，不适合多副本共享；
- Coding 工具是课程机制扩展，尚无独立 Coding WebUI，也不向社交用户开放；
- `run_tests` 会执行仓库自身 npm script；当前只适用于受信任工作区，测试未知仓库
  前仍需容器/虚拟机沙箱；
- `.env` 仅是开发兼容来源，不满足“系统钥匙串录入、查看状态、更新、清除”的最终增强要求；
- 未完成由不同类型陌生 Agent 执行的冷启动验证，见 `SPEC_PROCESS.md`；
- Project A 原文要求 Coding Agent，而产品主场景是 Social Agent；最终提交前需得到课程方对“双轨交付”的确认。

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
