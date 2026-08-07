# Project A 最终交付缺口审计

> 审计日期：2026-08-07
>
> 审计基线：`a07c9aa`，分支 `feat/gateway-agent-design`
>
> 判定依据：AI4SE 通用要求与 Project A Coding Agent Harness 专属要求。

## 1. 判定口径

本文把以下情况统一视为“不能算最终交付”：

- 文件完全不存在；
- 文件存在但只有模板、计划、TODO 或未填写章节；
- 代码机制存在，但没有课程要求的客观执行证据；
- 文档宣称的状态机、凭据、安全或分发能力没有对应实现；
- 仅在本机成功，尚无远端 CI、公开制品或公网访问证据；
- 需要学生本人、陌生 Agent、课程方或远端平台完成，不能由当前代码代替。

## 2. P0：完全缺失或明确不能算交付

### GAP-P0-01：`REFLECTION.md` 不是反思报告正文

当前状态：文件存在，但内容是学生填写模板，不是 1500–2500 字反思报告。

缺失内容：

- 学生本人对 Superpowers 技能的评价；
- TDD、subagent、任务粒度和人工评审的具体案例；
- Spec/Plan 影响实现的客观案例；
- 凭据与分发带来的工程反思；
- 对方法论的个人批判；
- AI 润色范围声明。

验收标准：

- 正文由学生本人完成，1500–2500 字；
- 至少引用 3 个真实 Task、PR、测试或失败证据；
- 明确写出至少一次人工推翻或修正 AI 的判断；
- 删除当前模板提示和未完成复选框。

### GAP-P0-02：陌生异类型 Agent 冷启动证据缺失

当前状态：`SPEC_PROCESS.md` 已有执行协议，但明确标注尚未执行。

缺失内容：

- 不同类型 Agent 和全新会话的标识；
- 只提供 `SPEC.md + PLAN.md` 的输入证据；
- 陌生 Agent 暂停和提问记录；
- 错误解读、输出差异和耗时；
- 因冷启动结果产生的 SPEC/PLAN 前后 diff。

验收标准：按 `SPEC_PROCESS.md` 第 5 节执行并填入真实记录。仅写计划不能
代替冷启动证据。

### GAP-P0-03：安全凭据管理实现缺失

当前状态：只有 `.env.example` 和环境变量注入。它们能避免把 Key 写进源码，
但不满足“隐藏录入、查看状态、更新、清除”的完整要求。

缺失实现：

- Windows Credential Manager、系统钥匙串或加密凭据文件适配器；
- 首次运行的隐藏输入；
- 只显示“已配置/未配置”的状态查询；
- 更新和清除命令或管理界面；
- 对 `.env` 明文、进程环境可见性的威胁说明与迁移路径；
- 对凭据适配器的 Mock 单元测试。

验收标准：在不回显明文 Key 的前提下完成录入、状态、更新、清除四个流程，
并保留可重复测试和 README 操作说明。

### GAP-P0-04：最终 CI/CD 通过记录缺失

当前状态：GitHub Actions 和根 `.gitlab-ci.yml` 已存在，但当前分支刚推送，
仓库中没有最后一次 Pipeline 全绿的固定证据。

缺失内容：

- GitHub Actions 最后一次运行 URL、commit SHA 和全部 Required Checks 状态；
- GitLab `unit-test` job 的实际运行记录；
- Docker 两个矩阵构建均通过的记录；
- 机制演示 Artifact 下载链接或截图；
- 失败后修复和重跑记录（如发生）。

建议新增：`docs/CI_CD_EVIDENCE.md`。

验收标准：记录与最终提交 SHA 对应，最后一次执行为 pass，而不是本地测试
输出或 Workflow 文件存在本身。

### GAP-P0-05：公网部署 URL 与可访问证据缺失

当前状态：README 只有本地 `http://127.0.0.1:8082`，没有最终公网 WebUI。

缺失内容：

- 实际可访问的 `https://match.invertedarena.com` 或最终 URL；
- DNS、TLS、反向代理和容器部署完成状态；
- `/health`、主页、登录和 `/agent` 的公网验证；
- 部署版本对应的 commit SHA；
- 回滚和维护模式验证。

建议新增：`docs/DEPLOYMENT_EVIDENCE.md`，并在 README 顶部给出最终 URL。

### GAP-P0-06：Project A 领域形式尚未获得确认

当前状态：产品 WebUI 是 Social Agent；Coding adapter 是隔离的开发者机制。
Project A 原文要求 Coding Agent Harness。这一双轨实现降低了技术缺口，但不能
自动等同于课程方接受该选题形式。

缺失证据：课程教师或助教对“双轨交付”的明确确认。

验收标准：保存书面确认；若不被接受，则需要把 Coding Harness 提升为主要
入口和主要演示对象，而不只是库工厂与离线测试。

## 3. P1：文件存在，但机制或证据仍不完整

### GAP-P1-01：Coding Agent 缺少完整的最终用户入口

已有：

- `createCodingHarness()`；
- `NodeCodingPort`；
- 文件、命令、测试和确认工具；
- Mock LLM 机制演示。

仍缺：

- Coding Agent CLI 或 Coding WebUI；
- 真实 Provider 与 Coding 工具的独立启动入口；
- 工作区选择、确认展示和运行状态界面；
- 一条从“用户提出代码任务”到“测试反馈后修正”的真实端到端演示。

判定：可以算 Harness 内核与机制演示，暂时不能算完整可使用的 Coding Agent
分发产品。

### GAP-P1-02：HITL 尚未形成 Loop 内暂停/恢复状态机

已有：确认令牌与用户、资源或命令绑定，限时且不可重放。

问题：Coding 工具缺少令牌时返回 `POLICY_DENIED`；`AgentLoop` 并未真正进入
`WAITING_CONFIRMATION`，也没有保存可恢复 Run、确认后从原步骤继续的接口。

缺失实现：

- `RUNNING → WAITING_CONFIRMATION` Reducer；
- 持久化 Pending Action；
- confirm/reject/expire 状态转换；
- 恢复同一 Run，而不是重新发起一轮；
- Mock LLM 下暂停、确认、恢复和拒绝测试。

### GAP-P1-03：Trace 缺少通用确定性脱敏器

已有：测试 Trace 和有限输出截断。

问题：`MemoryTracer` 对 Action/Observation 使用结构化复制，没有统一字段级
Redactor。工具参数中的帖子内容、聊天内容、路径或 Provider 错误仍可能进入
Trace；目前主要依赖调用方不传秘密。

缺失实现：

- Key、Token、Cookie、Authorization、联系方式和敏感路径脱敏规则；
- 记录前脱敏而非上传前手工处理；
- 脱敏单元测试；
- Artifact 内容审计测试。

### GAP-P1-04：记忆只达到进程内最低实现

已有：按 `userId + sessionId` 隔离、条数上限和进程内跨请求记忆。

仍缺：

- 重启后的持久化；
- 多副本共享；
- 按需检索而不是把全部近期条目交给模型；
- 记忆删除、过期和用户数据治理；
- 对敏感信息进入记忆的字段策略。

判定：可以算“最低实现”，不能宣称持久化、长期或生产级记忆。

### GAP-P1-05：Coding 沙箱只适用于受信任工作区

已有：相对路径围栏、真实路径检查、符号链接逃逸防护、`shell: false`、
危险命令硬拒绝和命令确认。

问题：`npm test`、`npm run build` 最终执行仓库自己的 script。恶意仓库可以在
测试脚本中执行任意代码，因此当前不是面向未知代码库的安全沙箱。

缺失实现：

- 容器/虚拟机隔离；
- 只读根文件系统和临时写层；
- CPU、内存、时间、进程数和网络限制；
- 工作区挂载范围测试；
- 沙箱销毁与残留数据验证。

### GAP-P1-06：PLAN 的交付追踪信息不完整

当前状态：多数 Task 没有实际 Commit Hash、PR URL、subagent 标识和两阶段
Review 结论；部分 Task 粒度远大于要求的 2–5 分钟步骤。

缺失内容：

- 每个完成 Task 对应的 commit；
- 每个 worktree 对应 PR；
- Spec 合规检查与代码质量检查结论；
- Critical issue 的修复记录；
- 并行依赖和实际偏离说明。

### GAP-P1-07：AGENT_LOG 过程证据不完整

已有：方向修正、Harness Core、只读工具和本轮补强记录。

仍缺：

- P3/P4/P5 各 Task 的独立时间戳记录；
- 实际触发的 Superpowers Skill；
- subagent 输出片段与 commit；
- PR 链接；
- 人工两阶段 Review；
- 严格红—绿—重构证据。

特别说明：生产 Runtime 适配没有保存严格“测试先红”的独立输出，不能在
后续文档中追溯性补造成已发生。

### GAP-P1-08：第三方许可证与 NOTICE 清单缺失

当前状态：package manifests 存在，但 README 没有列出关键第三方组件、用途和
许可证，也没有 `THIRD_PARTY_NOTICES.md`。

缺失内容：

- 直接生产依赖的名称、版本范围、用途、许可证；
- OpenAI SDK、React、Express、Zod、PostgreSQL 驱动等关键依赖；
- 复制或改编的第三方代码来源；
- 不兼容许可证检查。

## 4. P2：已有实现，但最终交付前仍需补证据

以下内容不是“完全缺失”，但当前不能仅凭本地结果判为最终完成：

| 内容 | 当前状态 | 最终所需证据 |
| --- | --- | --- |
| Docker 分发 | 本地后端镜像构建成功 | GHCR 公开镜像与拉取运行记录 |
| Social Agent WebUI | 本地构建和测试通过 | 公网 URL 和真实浏览器验收 |
| Mock LLM 机制 | 43 项 Harness 测试通过 | 远端 CI Artifact 与最终 SHA |
| 后端回归 | 本地 332/332 | Required Check 通过链接 |
| Secret Scan | 本地模式扫描无匹配 | Gitleaks 全历史远端通过 |
| CodeQL | Workflow 已配置 | 最终分支/PR 无新增告警 |
| GitHub Workflow | 文件完整 | 实际 PR Checks 全绿 |
| GitLab unit-test | job 已存在 | GitLab Pipeline 实际 pass |

## 5. 当前已经可以算交付的部分

以下内容已有代码与本地确定性验证，不应再列为“完全缺失”：

- 自研 `AgentLoop`、Action Parser、Tool Registry、StopController；
- 可注入 `LLMPort` 与 Mock LLM；
- NJU Match 只读工具和服务端身份绑定；
- Social Agent 写操作确认与实际业务动作；
- Coding 文件、命令、测试工具与工作区围栏；
- 测试失败转 `VALIDATION_FAILED` 并改变下一动作；
- 有界会话记忆和声明式 Harness 配置；
- 真实 `/agent` 后端经过自研循环；
- Dockerfile、GitHub Actions 和根 `.gitlab-ci.yml`；
- README 必需章节、SPEC、PLAN 和基础过程文档。

## 6. 建议完成顺序

1. 等待并记录本次远端 GitHub Checks；修复所有失败项。
2. 创建当前分支到 `main` 的 PR，补齐 Task、人工修改和测试证据。
3. 执行陌生异类型 Agent 冷启动，修订 SPEC/PLAN。
4. 实现安全凭据管理与 Trace Redactor。
5. 补齐 Loop 内 HITL 暂停/恢复状态机。
6. 决定是否实现独立 Coding CLI/WebUI，并取得课程方方向确认。
7. 部署公网 WebUI，记录 URL、SHA、健康检查和回滚证据。
8. 生成第三方许可证清单与公开分发制品。
9. 学生本人完成 `REFLECTION.md`。
10. 将最终 CI/CD、部署、PR、commit 和机制演示证据统一归档。

## 7. 最终提交前硬门槛

- [ ] `REFLECTION.md` 是学生本人 1500–2500 字正文；
- [ ] 冷启动验证有真实问题、产出与 SPEC/PLAN diff；
- [ ] 凭据支持安全录入、状态、更新和清除；
- [ ] Project A 双轨方向已确认，或 Coding Agent 已成为主要入口；
- [ ] 最终 commit 的 GitHub/GitLab CI 全绿；
- [ ] 公网 WebUI URL 可访问；
- [ ] PR、commit、Review 和 Agent 使用过程可追溯；
- [ ] 公开容器制品可从干净机器拉取并运行；
- [ ] 第三方许可证清单完整；
- [ ] 仓库、历史、日志、Trace 和 Artifact 均不含真实凭据。
