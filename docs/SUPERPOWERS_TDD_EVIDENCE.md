# Superpowers 工作流与 TDD 证据

<!-- markdownlint-disable MD013 -->

> 更新日期：2026-08-08
>
> 口径：只记录仓库、提交、PR 和当时日志可支持的事实。当前 Codex 会话没有可调用的 Superpowers skill，因此本文不能证明插件已安装或技能被真实触发；方法步骤相似不等同于使用了指定框架。

## 七步工作流映射

| Superpowers 阶段 | 现有客观证据 | 判定 | 尚需补强 |
| --- | --- | --- | --- |
| brainstorming | `SPEC_PROCESS.md` 四轮方向迭代，包含用户推翻“代码库安全 Agent”方向的决策 | 部分符合方法 | 缺插件/skill 调用记录、原始会话导出 |
| writing-plans | `PLAN.md` 按 TASK 拆分文件、依赖、失败测试和验收 | 部分符合方法 | 早期 Task 粒度超过 2–5 分钟；缺 skill 调用记录 |
| using-git-worktrees | 多个功能分支与 PR #11、#12、#14、#15 可追溯 | 分支/PR 有证据 | 没有可靠证据证明每个分支实际由 worktree 创建，不追溯声称完成 |
| subagent-driven-development / executing-plans | `AGENT_LOG.md` 记录 Codex 执行与人工修正 | 不符合 subagent 证据要求 | 历史明确未使用 subagent；后续选择独立 Task 使用新鲜 subagent 并保存输出 |
| test-driven-development | 下节列出若干真实红—绿记录 | 部分符合 | 不是所有实现都先测试；部分批次没有独立红灯输出 |
| requesting-code-review | PR Required Checks、CodeQL review conversation、人工方向修正 | 部分符合评审目标 | 缺每个 Task 的“Spec 合规 → 代码质量”两阶段人工结论与 skill 调用记录 |
| finishing-a-development-branch | PR #11、#12、#14 已进入主线，PR #15 有完整 Description 和全绿检查 | 部分符合方法 | 缺 finishing skill 的原始决策输出；最终分支仍需学生按真实状态处理 |

## 可复核的 TDD / 失败驱动证据

| Task | 红灯或失败 | 最小修复/绿灯 | 证据位置 | 严格 TDD 判定 |
| --- | --- | --- | --- | --- |
| TASK-010–012 | Mock 回调严格类型错误；Node Test Runner 未发现目录测试 | 显式 `AgentContext`；显式测试文件；10/10 | `AGENT_LOG.md` | 有失败—修复记录，但缺完整终端 Artifact |
| TASK-020–022 | Zod optional 类型不匹配；圈子 nullable description 违反 Tool 契约 | 修正 Port 契约和 Adapter 归一化；Harness 19/19、后端 307/307 | `AGENT_LOG.md` | 有失败—修复记录，不能证明所有代码测试先行 |
| TASK-072 | `codingTools.test.ts` 因模块不存在失败；首次护栏夹具只命中 Schema 错误 | 实现 Coding 模块并将夹具改为合法 UUID，使其真正命中 Policy；Harness 43/43 | `AGENT_LOG.md`、提交 `a07c9aa` | 当前最清晰的先红后绿证据 |
| CodeQL ReDoS | PR #15 出现两项 high severity Polynomial ReDoS 告警 | 提交 `095b91d` 改为线性扫描并增加 20 万字符回归测试；CodeQL 重跑成功 | `docs/CI_CD_EVIDENCE.md` | 属于安全反馈闭环，不追溯称为测试先行 |
| TASK-076 | `node --import tsx --test src/utils/secretSource.test.ts` 因 `ERR_MODULE_NOT_FOUND` 失败 | 新增最小 `loadSecret`；同一命令 5/5，随后 backend lint 通过 | 本文、`AGENT_LOG.md` | 本轮真实先红后绿；重构后以完整测试收口 |

重构后在根目录执行 `npm run bootstrap:verify`，从干净依赖安装路径完成：

- Harness 43/43；
- Backend 338/338；
- Frontend 31/31；
- 前端生产构建成功；
- 总命令退出码为 0。

统一验证脚本首次在 Windows 使用 `spawnSync npm.cmd` 时得到 `EINVAL`，随后
改为使用当前 npm CLI 的 Node 入口，并以 `shell: false` 执行；再次运行
`npm test` 成功。此记录属于跨平台反馈修正，不冒充凭据功能的初始红灯。

## TASK-076 的可重复命令

```text
cd NJU-Date-basic/backend
node --import tsx --test src/utils/secretSource.test.ts
npm run lint
npm test
```

关键验收包括：凭据文件路径 allowlist、环境变量与文件来源互斥、空文件拒绝、错误消息不包含秘密，以及 Ubuntu runtime Secret 文件读取。

## 不能追溯修复的部分

- 生产 Runtime Adapter 的测试与实现处于同一批次，没有保存独立红灯；
- 历史任务没有可靠的 Superpowers 插件版本、skill invocation 或 worktree 创建日志；
- 历史任务没有全部使用新鲜 subagent；
- 不得把 PR、普通 Codex 对话或事后补写的文档等同于 Superpowers 原始证据。

## 后续合规执行协议

1. 在学生自己的开发环境安装课程指定 Superpowers 插件并记录版本、安装命令和验证输出；
2. 对一个尚未实现的独立 Task 依次触发七步流程，保留原始会话导出；
3. 用 worktree 创建分支，记录绝对路径和 `git worktree list`；
4. 先提交失败测试或保存 CI 红灯，再提交最小实现；
5. 保存重构后同一测试命令；
6. 分别记录 Spec 合规 Review 和代码质量 Review；
7. 在 PR Description、PLAN 和 AGENT_LOG 中交叉引用 commit、subagent 和 review；
8. 历史偏差继续如实保留，不用新任务证据覆盖旧任务事实。
