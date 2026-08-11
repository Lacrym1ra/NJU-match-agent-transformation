# NJU-Match 应用类项目（Project B）

本仓库用于完成 AI4SE Project B：以原 NJU-Match 为业务基线，交付一个可公开
访问、具有真实业务深度的校园社交应用。项目保留并扩展问卷匹配、圈子、论坛、
组队和私信等模块，同时把自行实现的 Harness Agent 作为本阶段的创新交互模块，
而不是把整个项目重新定义为 Coding Agent Harness。

NJU-Match 已有的问卷、人格画像、匹配、圈子和论坛功能只作为
继承基线，不计入本阶段新增模块。本阶段单独开发“共鸣胶囊”和
“安心赴约”两套前后端；Harness Agent 负责理解用户目标、联动旧/新业务工具
并在写操作前请求确认。原有与新增边界见
[`docs/PROJECT_B_SCOPE_AND_FEATURE_BASELINE.md`](./docs/PROJECT_B_SCOPE_AND_FEATURE_BASELINE.md)。

## Project B 功能模块

| 模块 | 来源 | 当前能力 |
| --- | --- | --- |
| 原 NJU-Match | 原项目基线，不计本阶段模块 | 身份、资料、问卷、匹配、圈子、论坛、关系与通知，作为 Agent 工具上下文 |
| 共鸣胶囊 | 本阶段新增业务模块 | 邀请码双人互动、单边封存、双方回应后同时揭晓 |
| 安心赴约 | 本阶段新增业务模块 | 私有赴约计划、本人签到、签到后完成、超时状态 |
| Harness Agent | 本阶段新增编排模块 | 联动旧/新业务，受控写操作、HITL、Mock LLM 和脱敏 Trace |
| 部署、隐私与治理 | 本阶段新增/改进 | 一键测试、Docker、CI、加密凭据、路由隐私契约与课程衍生身份分离 |

本阶段以“共鸣胶囊 + 安心赴约 + Harness Agent”构成三个可独立验收模块；
旧系统规模不作为凑数依据，Agent 也不以聊天文案替代真实数据库写入。

## 项目边界

本项目不是：

- 将问卷替换成聊天机器人；
- 让 Agent 代替用户编造问卷答案；
- 让面向普通用户的 NJU-Match WebUI 暴露任意文件或 Shell 权限；
- 使用 LangChain AgentExecutor、AutoGen、CrewAI 等高层循环代替自行实现的 Harness。

GitHub Actions、CodeQL 和 Secret Scan 是项目的工程保障。历史阶段形成的
Coding adapter 继续保存在受限的 `agent-harness` 扩展中，作为额外工程资产，
不属于 Project B 主演示路径，也不对社交 WebUI 开放。

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
  ├─ 旧基线：Profile / Questionnaire / Matching / Circle / Forum
  ├─ 新模块：Resonance Capsule
  └─ 新模块：Meetup Safety Plan
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
├─ agent-harness/        Project B 创新 Agent 的 Loop、工具、治理、反馈与记忆
├─ docs/                 CI、冷启动、部署、功能边界、隐私审计与最终交付证据
├─ .github/              GitHub Workflow 与仓库治理
├─ THIRD_PARTY_NOTICES.md
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

### Windows Docker Desktop

Windows 端使用 Docker Desktop 的 Linux container mode，构建与 Ubuntu 生产
环境相同的 OCI 镜像，而不是维护不兼容的 Windows Server 镜像：

```powershell
Copy-Item NJU-Date-basic/.env.local-test.example NJU-Date-basic/.env.local-test
npm run docker:windows:build
npm run docker:windows:up
npm run docker:windows:export
```

脚本会拒绝未启动的 Docker Desktop 和 Windows container mode。默认页面为
`http://127.0.0.1:8082`，本地测试 `.env.local-test` 不得提交。导出命令只接受
已提交的干净版本，产出 Backend、Frontend、PostgreSQL 三镜像离线包、同提交
源码包、SHA-256 和 manifest；产物保存在被 Git 忽略的 `deployment-packages/`。

完整的部署、登录、演示数据、新模块、Agent、浏览器和服务器回归流程见
[`test.md`](./test.md)。本地容器可用以下命令写入 Alice/Bob 演示账号及两个
Project B 模块的固定样例；这些命令不得对生产数据库执行：

```powershell
cd NJU-Date-basic
docker compose --project-name nju-match-local --env-file .env.local-test `
  exec backend node dist/db/seedDemoData.js --reset
docker compose --project-name nju-match-local --env-file .env.local-test `
  exec backend node dist/db/seedProjectBModules.js --reset
```

### Ubuntu 生产 LLM 凭据

Ubuntu 正式服务器使用 systemd encrypted credentials，不把 LLM Key 写入
`.env`、Compose、镜像或命令行。完整步骤见
[`deploy/ubuntu/README.md`](./deploy/ubuntu/README.md)。核心管理命令为：

```bash
sudo bash deploy/ubuntu/manage-llm-credential.sh set
sudo bash deploy/ubuntu/manage-llm-credential.sh status
sudo bash deploy/ubuntu/manage-llm-credential.sh update
sudo bash deploy/ubuntu/manage-llm-credential.sh clear
```

`status` 不回显明文；`clear` 删除凭据并停止服务。开发环境仍可使用被忽略的
`.env`，但它是明文兼容来源，不应复制到生产服务器。

## 一键验证

已有依赖时：

```bash
npm test
```

安装了 Node.js 20+ 的干净工作区：

```bash
npm run bootstrap:verify
```

该入口依次验证 Harness、后端和前端；CI 与本地都不需要真实 LLM Key。
GitHub `Workspace Verification` 和 GitLab `unit-test` 也执行
`npm run bootstrap:verify`，保证交付命令与远端传感器一致。

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
- Coding 工具是历史开发者扩展，尚无独立 Coding WebUI，也不向社交用户开放；
- `run_tests` 会执行仓库自身 npm script；当前只适用于受信任工作区，测试未知仓库
  前仍需容器/虚拟机沙箱；
- Ubuntu 已提供 systemd 加密凭据录入、状态、更新和清除；目标服务器上的
  systemd/权限/重启验收尚未完成；
- 未完成由不同类型陌生 Agent 执行的冷启动验证，见 `SPEC_PROCESS.md`；
- 生产级隐私联系渠道、完整数据导出/物理删除流程仍待部署者在接收真实用户前完成；
- `/admin` 使用独立管理员 Key 与网络来源限制，不复用普通用户会话；需要在目标服务器继续验证反向代理来源 IP 配置。

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

## 交付证据索引

- [最终交付检查表](./docs/FINAL_DELIVERY_CHECKLIST.md)
- [GitHub/GitLab CI/CD 证据](./docs/CI_CD_EVIDENCE.md)
- [陌生异类型 Agent 冷启动记录](./docs/COLD_START_EVIDENCE.md)
- [公网部署与分发证据](./docs/DEPLOYMENT_EVIDENCE.md)
- [Project B 范围与原有/新增功能基线](./docs/PROJECT_B_SCOPE_AND_FEATURE_BASELINE.md)
- [全站前端隐私分离审计](./docs/FRONTEND_PRIVACY_SEPARATION_AUDIT.md)
- [Superpowers 与 TDD 证据](./docs/SUPERPOWERS_TDD_EVIDENCE.md)
- [第三方依赖与许可证](./THIRD_PARTY_NOTICES.md)

证据文件严格区分“已有配置”“本地通过”和“远端/公网已验收”。仍标记为待填写的外部证据必须由学生在真实执行后回填，不得以计划、截图占位或 AI 推测替代。
