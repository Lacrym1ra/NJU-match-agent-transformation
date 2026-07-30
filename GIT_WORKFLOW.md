# GitHub 完整工作流

## 1. 工作流目标

本仓库的 GitHub 流程用于证明：

1. NJU-Match 原业务没有因 Agent 集成而回归；
2. Social Agent Harness 核心机制可由 Mock LLM 离线复现；
3. 业务 Tool、身份边界和写操作确认可以确定性测试；
4. 凭据、依赖和代码安全受到持续检查；
5. 每项功能经过 Branch → PR → Review → Required Checks → Squash Merge；
6. Release 和部署产物可追踪、可复现。

GitHub Workflow 是质量保障，不是产品 Agent 的工具。Agent 不读取 CI 输出后自动修改代码。

## 2. 分支规则

每项工作从最新 `main` 创建单一目标分支：

```bash
git switch main
git pull --ff-only origin main
git switch -c <type>/<short-description>
```

推荐命名：

```text
docs/reframe-user-facing-agent
feat/agent-harness-core
feat/agent-read-tools
feat/agent-hitl-actions
feat/agent-user-interface
test/agent-scenarios-workflow
feat/provider-llm
fix/...
ci/...
```

一个分支只承担一个可评审目标。不得直接 Push 到 `main`。

## 3. Commit 规则

采用 Conventional Commits：

```text
docs: ...
test: ...
feat: ...
fix: ...
refactor: ...
ci: ...
chore: ...
```

提交正文建议记录：

```text
Task: TASK-...
Agent: Codex / other
Human changes: ...
Tests: ...
```

不要提交：

- `.env`；
- API Key、Token、Cookie；
- 证书或私钥；
- 运行数据库；
- 未脱敏 Agent Trace；
- `node_modules`；
- 本地 IDE 和操作系统状态。

## 4. Pull Request 流程

PR 必须填写：

- Task 编号；
- 对应 Spec 验收项；
- 修改范围；
- 红灯与绿灯证据；
- Agent Tool/权限影响；
- 凭据和隐私影响；
- AI 与人工修改边界；
- 回滚方式。

评审顺序：

1. Spec Compliance；
2. 业务和 Tool Contract；
3. Harness 机制；
4. Security/Privacy；
5. Workflow Checks；
6. Human Approval。

所有讨论解决且 Required Checks 全绿后，使用 `Squash and merge`，随后删除远程分支。

## 5. Branch Ruleset

`main` 建议启用：

- Require a pull request before merging；
- Require at least 1 approval；
- Dismiss stale approvals；
- Require status checks to pass；
- Require branches to be up to date；
- Require conversation resolution；
- Block force pushes；
- Block deletions；
- Do not allow bypassing。

初始 Required Checks：

```text
Repository Policy
Documentation
Secret Scan
CodeQL
Dependency Audit
Docker Build
Harness Mechanism Demo
```

创建 `agent-harness/package-lock.json` 并稳定运行后增加：

```text
Harness Unit
Harness Build
Tool Contract
Agent Scenario
```

Required Check 名称必须以 GitHub 实际显示的 Job 名称为准。

## 6. Workflow 职责

### `ci.yml`

负责：

- Repository Policy；
- Documentation；
- Harness Unit；
- Harness Build；
- 后续增加 Tool Contract；
- 必要的 NJU-Match 前后端回归。

在 `agent-harness` 尚未创建时，Harness 实现步骤可以安全跳过。

### `harness-mechanism.yml`

负责 Project A 三项产品 Agent 机制：

1. 写操作在用户确认前暂停且不调用 Service；
2. 业务 Tool 的失败 Observation 改变下一步 Action；
3. 模型伪造其他用户身份被确定性代码拒绝。

全部使用 Mock LLM，禁止网络，并上传脱敏 Trace Artifact。

### `security.yml`

负责：

- 禁止文件和疑似凭据模式；
- Secret Scan；
- Dependency Audit；
- CodeQL。

代码扫描发现原 NJU-Date-basic 基线问题时，应记录和分类；不能通过关闭安全 Workflow 隐藏新增风险。

### `docker.yml`

负责：

- PR 中构建但不推送；
- Main/Tag 构建可发布镜像；
- 使用 `GITHUB_TOKEN`；
- 生成可追踪镜像元数据。

## 7. GitHub Secrets 与 Environments

当前不要录入 API Key。

用户提供 Key 后，在：

```text
Settings → Secrets and variables → Actions
```

建议：

```text
LLM_API_KEY       Secret
LLM_BASE_URL      Variable（不敏感时）
LLM_MODEL         Variable
```

建立：

```text
demo
production
```

`production` 要求人工审批和独立 Secrets。

PR、单元测试、Tool Contract 和机制演示只能使用 Mock LLM。真实 Provider smoke test 应使用 `workflow_dispatch` 或受保护 Environment，不能在 Fork PR 中暴露 Secret。

## 8. 开发 Gate

### Gate 0：方向与规格

- README、SPEC、PLAN 统一为面向用户的 Social Agent；
- 业务工具、风险分级和主贡献明确；
- 文档 PR 合并。

### Gate 1：Harness 内核

- Action / Observation / State；
- LLMPort / MockLLM；
- 有限步 Loop；
- Reducer / StopController；
- 脱敏 Trace；
- Unit 和 Build 通过。

### Gate 2：业务工具

- Tool Registry；
- Profile、Questionnaire、Circle、Forum 只读工具；
- 服务端认证上下文；
- Tool Contract Tests；
- 空结果和异常 Observation。

### Gate 3：治理与 HITL

- Read/Draft/Write/Sensitive；
- PendingAction；
- 确认、拒绝、过期、防篡改和一次性消费；
- 帖子草稿和受控发布；
- 三项 Mechanism Demo。

### Gate 4：产品集成

- Agent API；
- `/agent` 页面；
- Tool/Result/Draft Cards；
- Confirmation Dialog；
- 原应用回归。

### Gate 5：评测与分发

- 10 个确定性场景；
- Docker；
- Trace Artifact；
- 文档与反思；
- 全新克隆验证。

### Gate 6：真实 Provider

- 用户提供 API Key；
- ProviderLLM；
- 输出 Schema、超时、重试和费用预算；
- 受保护的手动 smoke test。

## 9. Definition of Done

一个 Task 只有同时满足以下条件才完成：

- Spec 验收项通过；
- 测试先红后绿或有明确文档验收；
- Mock 下确定性；
- 身份和写操作边界有代码测试；
- 无真实凭据；
- Trace 可解释且脱敏；
- 原业务测试无回归；
- PR 有人工评审；
- Required Checks 全绿；
- `PLAN.md` 和 `AGENT_LOG.md` 已更新；
- Commit Hash 与 PR 已记录；
- 可安全回滚。
