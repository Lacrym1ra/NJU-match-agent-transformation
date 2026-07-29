# GitHub 完整工作流

## 1. 工作流目标

本仓库的 GitHub 流程需要同时证明：

1. 代码质量可自动验证；
2. Harness 核心机制可在 Mock LLM 下离线复现；
3. 凭据与依赖风险受到检查；
4. 每项功能通过 Branch → PR → Review → Required Checks → Merge；
5. Release 产物可追踪、可复现；
6. 部署只使用受保护的 GitHub Environment。

---

## 2. 当前仓库初始化

Git 可执行文件位于：

```powershell
C:\Program Files\Git\cmd\git.exe
```

可以在当前 PowerShell 会话中临时加入 PATH：

```powershell
$env:Path = "C:\Program Files\Git\cmd;$env:Path"
```

然后执行：

```powershell
cd C:\Users\X\桌面\AI4Coding\ai4coding-lab
git branch -M main
git status
```

首次提交前配置身份：

```powershell
git config user.name "你的 GitHub 用户名"
git config user.email "你的 GitHub 邮箱或 noreply 邮箱"
```

首次提交：

```powershell
git add .
git diff --cached
git commit -m "chore: bootstrap repository governance and workflows"
```

---

## 3. 创建 GitHub 远程仓库

在 GitHub 创建空仓库，建议名称：

```text
nju-match-safepatch-harness
```

创建时不要额外生成 README、License 或 `.gitignore`，避免首次 Push 冲突。

关联远程：

```powershell
git remote add origin https://github.com/<USER>/nju-match-safepatch-harness.git
git push -u origin main
```

如果使用 SSH：

```powershell
git remote add origin git@github.com:<USER>/nju-match-safepatch-harness.git
git push -u origin main
```

---

## 4. Branch Protection

在 GitHub：

```text
Settings
→ Branches / Rulesets
→ New ruleset
→ Target: main
```

启用：

- Require a pull request before merging；
- Require at least 1 approval；
- Dismiss stale approvals；
- 配置 `CODEOWNERS` 后再启用 Require review from Code Owners；
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
```

创建 `agent-harness/package-lock.json` 后增加：

```text
Harness Unit
Harness Mechanism Demo
Harness Build
```

Dockerfile 完成后增加：

```text
Docker Build
```

---

## 5. 分支和 Worktree 规则

分支格式：

```text
docs/TASK-001-spec
feat/TASK-010-action-schema
feat/TASK-020-agent-loop
feat/TASK-030-guardrail
test/TASK-040-feedback-demo
ci/TASK-050-github-actions
fix/TASK-060-...
```

每个 PLAN Task：

1. 从最新 `main` 创建分支；
2. 创建独立 Worktree；
3. 先写失败测试；
4. 保存红灯证据；
5. 最小实现；
6. 保存绿灯证据；
7. Spec 合规评审；
8. 代码质量评审；
9. Push 并开 PR；
10. Required Checks 全绿后合并；
11. 在 `PLAN.md` 标记 Commit Hash；
12. 删除 Worktree。

示例：

```powershell
git fetch origin
git worktree add ..\worktrees\TASK-010 -b feat/TASK-010-action-schema origin/main
```

---

## 6. Commit 规则

建议采用 Conventional Commits：

```text
docs: ...
test: ...
feat: ...
fix: ...
refactor: ...
ci: ...
chore: ...
```

每个 Commit 只完成一个可解释变更。

由 Agent 产生的 Commit 在正文注明：

```text
Task: TASK-010
Agent: Codex
Human changes: 修正 Action 边界与错误码
Tests: npm test -- action.test.ts
```

---

## 7. PR 流程

PR 必须填写：

- Task 编号；
- Spec 验收项；
- 红灯证据；
- 绿灯证据；
- Harness 风险；
- 凭据影响；
- Agent 与人工修改边界；
- 回滚方式。

评审顺序：

1. Spec Compliance；
2. Code Quality；
3. Security；
4. Workflow Checks；
5. Human Approval。

不允许直接 Push 到 `main`。

---

## 8. Workflow 文件

### `ci.yml`

负责：

- 仓库策略；
- 文档存在性；
- Harness Unit；
- Harness Build。

在 `agent-harness` 尚未创建时，Harness 步骤会安全跳过。

### `harness-mechanism.yml`

负责 Project A 三项机制：

- 危险动作拦截；
- 失败回灌与下一步修正；
- HITL 暂停和恢复。

生成 Trace Artifact。

### `security.yml`

负责：

- 禁止文件名；
- 疑似凭据模式；
- 依赖审计；
- CodeQL。

### `docker.yml`

创建 Dockerfile 后：

- PR 构建但不推送；
- Main / Tag 构建并推送 GHCR；
- 使用 `GITHUB_TOKEN`；
- 生成镜像元数据。

---

## 9. GitHub Secrets 与 Environments

现在不要录入 API Key。

后续用户提供 Key 后：

```text
Settings → Secrets and variables → Actions
```

建议名称：

```text
LLM_API_KEY
LLM_BASE_URL
LLM_MODEL
```

敏感值放 Secrets；非敏感配置放 Variables。

建立 Environment：

```text
demo
production
```

`production` 要求：

- Required reviewer；
- 仅允许 Tag 或 `main`；
- 独立 Secrets；
- 部署前审批。

测试和机制演示不得使用真实 `LLM_API_KEY`，只能使用 Mock。

---

## 10. 后续启用顺序

### Gate 0：仓库治理

- 首次提交；
- Push GitHub；
- Branch Protection；
- PR Template；
- CI 和 Security 通过。

### Gate 1：文档

- `SPEC.md`；
- `PLAN.md`；
- `SPEC_PROCESS.md`；
- 冷启动验证；
- 文档 PR 合并。

### Gate 2：Agent 心脏

- Action / Observation；
- Mock LLM；
- 最小 Agent Loop；
- Trace；
- Unit 和 Build 成为 Required。

### Gate 3：Harness

- Tool Dispatcher；
- Guardrail；
- HITL；
- Sensors；
- Memory；
- Stop Controller；
- 三项 Mechanism Demo 成为 Required。

### Gate 4：分发

- Dockerfile；
- Docker Build；
- GHCR；
- Release。

### Gate 5：部署

- 安全 Mock WebUI；
- `demo` Environment；
- Smoke Test；
- 公网 URL。

---

## 11. Definition of Done

一个 Task 只有同时满足以下条件才完成：

- Spec 验收项通过；
- 测试先红后绿；
- Mock 下确定性；
- 无真实凭据；
- Trace 可解释；
- PR 有人工评审；
- Required Checks 全绿；
- PLAN 和 AGENT_LOG 已更新；
- Commit Hash 已记录；
- 可安全回滚。
