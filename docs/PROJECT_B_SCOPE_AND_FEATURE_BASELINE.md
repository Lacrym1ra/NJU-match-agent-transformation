# Project B 范围与功能贡献基线

<!-- markdownlint-disable MD013 -->

> 最终项目类型：AI4SE Project B 应用类项目。
>
> 目的：区分“从原 NJU-Match 继承的业务基线”和“本阶段新增或实质改进”，避免把已有功能全部包装为新贡献。

## 1. 三十秒价值陈述

NJU Match 是一个面向校园场景的慢速社交应用。本阶段不把已有匹配、圈子、论坛或私信重新计算为贡献，而是新增“共鸣胶囊”“安心赴约”两个具有独立前后端和数据状态机的业务模块；Harness Agent 同时编排旧能力与这两个新模块，并以服务端权限、写操作确认和客观工具结果保证“说已执行”与“真的执行”一致。

## 2. 原项目已经具备的功能

以下能力视为继承基线，不单独冒充本阶段创新：

| 基线模块 | 已有职责 | 典型入口 |
| --- | --- | --- |
| 身份与资料 | 邮箱注册/登录、资料初始化、个人卡片、账号设置 | `/login`、`/onboarding`、`/dashboard`、`/settings` |
| 问卷与匹配 | 问卷、参与状态、匹配结果、双向选择与联系方式解锁 | `/survey`、`/reveal`、`/heartbox` |
| 圈子 | 圈子发现、详情、加入申请和基础成员关系 | `/circles`、`/circles/:id` |
| 论坛 | 帖子、评论、基础互动、匿名/可见性和内容浏览 | `/forum`、`/forum/:postId` |
| 关系与通知 | 关注、私信、站内通知、个人主页 | `/follows`、`/messages`、`/notifications` |

这些功能构成 Project B 的业务基础。答辩时应先说明“继承了什么”，再展示本阶段如何把它们扩展为完整应用。

## 3. 本阶段新增功能

| 新增模块 | 具体能力 | 可复核证据 |
| --- | --- | --- |
| 共鸣胶囊 | 邀请码双人加入、单边回答封存、双方回答后同时揭晓、发起者取消 | `048_project_b_modules.ts`、`resonanceService.ts`、`routes/resonance.ts`、`pages/Resonance*` |
| 安心赴约 | 私有赴约计划、本人签到、签到后完成、取消与超时视图 | `meetupSafetyService.ts`、`routes/meetupSafety.ts`、`pages/MeetupSafety.tsx` |
| 自研 Harness Agent | AgentLoop、LLMPort/MockLLM、结构化 Action、Tool Registry、Observation、StopController、Memory、Trace | `agent-harness/src`、`agent-harness/tests` |
| Agent 业务工具 | 旧版资料/问卷/圈子/论坛工具 + 新版胶囊/赴约状态工具与受确认创建动作 | 后端 `agentReadService`、`agentActionService`、`agentHarnessRuntime` |
| HITL 写操作 | 服务端 PendingAction、一次性确认、过期/拒绝、参数防篡改 | Harness 与后端确认测试 |
| 双入口 Agent UI | 独立 `/agent` 页面 + 全局悬浮 Agent、结果卡片、确认弹窗、页面资源上下文 | `pages/Agent.tsx`、`components/global-agent` |
| 确定性机制测试 | 不接真实 LLM 的反馈修正、越权拒绝、停机预算和 Mock 场景 | Harness npm tests/demo scripts |
| 生产凭据与分发 | Docker、Windows 启动脚本、Ubuntu systemd encrypted credential、一键验证 | `deploy/ubuntu`、`scripts/windows`、根 package scripts |
| 全站隐私边界 | 所有路由分类、全局边界标识、课程衍生隐私页、生产禁用本地免登录入口 | `modules/privacy`、`PrivacyBoundaryNotice`、3 项契约测试 |

## 4. 原有模块的联动改进（不计作两个新增业务模块）

| 改进域 | 改进内容 | 与新增 Agent 的关系 |
| --- | --- | --- |
| 圈子/组队 | 组队大厅、详情、联系信息控制、圈内实时聊天、申请和管理测试辅助 | Agent 可检索并在确认后发起申请/发言 |
| 论坛/社交 | 更丰富的测试数据、互动/关系链、治理与通知动作 | Agent 可查找真实帖子并执行受控写动作 |
| 资料/匹配 | 更完整测试账号、资料与问卷状态工具、匹配工具化 | Agent 可解释当前状态和候选结果，不代填问卷 |
| 工程质量 | GitHub Workflow、CodeQL、Secret Scan、Docker、统一测试入口 | 保证应用可交付，不伪装成 Agent 业务工具 |
| UI | 独立 Agent 页、全局液态玻璃入口、统一结果卡与确认交互 | Agent 可以在任意业务页被调用 |

### 4.1 本阶段代码边界

| 口径 | 具体代码 | 是否计作新功能 |
| --- | --- | --- |
| 旧业务基线 | 原身份/问卷/匹配/圈子/论坛/私信的数据表、Service 与页面 | 否；只是已有系统和 Agent 工具数据源 |
| 新模块 N1 | `048_project_b_modules.ts` 中 `resonance_capsules`，`resonancePolicy/Service/Route`，`api/resonance.ts`，`ResonanceCapsules*` 页面 | 是；独立数据、API、UI 和状态机 |
| 新模块 N2 | `048_project_b_modules.ts` 中 `meetup_safety_plans`，`meetupSafetyPolicy/Service/Route`，`api/meetupSafety.ts`，`MeetupSafety.tsx` | 是；独立数据、API、UI 和状态机 |
| 新模块 N3 | `agent-harness/`、Agent Runtime/Action Store、Agent 页与全局入口 | 是；自研编排、Tool/HITL/Trace 与交互 |
| 集成改动 | `App.tsx`、`Dashboard.tsx`、`NavBar.tsx`、Agent 结果卡/确认框 | 不单独计为第四个功能；它们是新模块入口和联动层 |
| 隐私/工程改动 | 路由隐私分类、全局边界标识、production 关闭 `/agent-local`、Docker/CI | 不冒充业务功能；作为可交付性与安全证据 |

因此，旧代码被修改不等于它自动成为“新功能”。只有具备新数据模型、
独立 API、可见前端流程和客观测试的 N1/N2，以及可独立验证机制的 N3，
才纳入本阶段交付计数。

## 5. Project B 三个本阶段新增模块的验收映射

### 模块 N1：共鸣胶囊

- 独立前端：`/resonance` 与 `/resonance/:id`；
- 独立后端：`/api/v1/resonance`；
- 独立数据：`resonance_capsules`；
- 核心规则：邀请码只展示一次且数据库只存哈希；参与者不能是发起者；任何单边回答在双方完成前均不可见；
- Agent 联动：可查询当前账号胶囊状态、确认后创建；不得代写回答或替用户揭晓；
- 测试：纯状态策略、数据库双用户流程、浏览器创建/封存流程。

### 模块 N2：安心赴约

- 独立前端：`/meetup-safety`；
- 独立后端：`/api/v1/meetup-safety`；
- 独立数据：`meetup_safety_plans`；
- 核心规则：计划仅归当前账号；必须从 `scheduled` 本人签到为 `checked_in` 后才能完成；超时为视图状态，不伪造已签到；
- Agent 联动：可查询计划和确认后创建；不得代替用户签到、完成或声称应急救援已经发生；
- 测试：时间窗口/状态机、数据库所有权、浏览器签到与完成流程。

### 模块 N3：Harness Agent 编排与 HITL

- 输入：用户自然语言目标、认证上下文、当前页面受限资源，以及旧/新业务工具；
- 输出：结构化查询结果、草稿、待确认动作和客观执行结果；
- 边界：模型不决定权限，写操作必须 HITL，Coding adapter 不向 WebUI 注册；
- 对新模块的限制：只注册状态查询与创建动作，不注册胶囊回答、赴约签到/完成工具；
- 测试：Mock LLM、Tool Contract、HITL、反馈修正、Stop/Trace、Agent 新动作提议测试。

## 6. 不需要为“模块数量”新增的内容

旧版身份/匹配、圈子和论坛不计作本阶段新模块。现在由 N1、N2、N3 满足三个职责清晰模块的要求；不能再用“旧系统规模很大”代替本阶段贡献证据。下一阶段不应新增孤立的天气、翻译或通用聊天，而应补真实数据库/浏览器验收、隐私生命周期、公网稳定性、冷启动证据和学生反思。

## 7. 演示顺序

1. 用一页边界表快速说明旧匹配/圈子/论坛仅为继承基线；
2. 两个测试账号演示共鸣胶囊：加入、单边不可见、双边同时揭晓；
3. 演示安心赴约：创建、未签到不能完成、本人签到后完成；
4. 打开全局 Agent，查询旧社区内容和两个新模块的真实状态；
5. 请求 Agent 创建胶囊/赴约计划，展示确认前副作用为 0、确认后真实写入；
6. 证明 Agent 无法代写胶囊答案或代替赴约签到；
7. 运行根 `npm test` 与浏览器 E2E，说明移除真实 Provider 后机制仍可验证。
