# AI4Coding Lab

本仓库用于完成 AI4SE Project A：构建一个自行实现内核的 Coding Agent Harness。

当前阶段为仓库与工程工作流初始化。正式实现开始前，必须先完成：

1. `SPEC.md`；
2. `PLAN.md`；
3. `SPEC_PROCESS.md`；
4. 陌生 Agent 冷启动验证；
5. 首个失败测试。

## 计划结构

```text
ai4coding-lab/
├─ agent-harness/       自行实现的 Agent Loop、工具、治理、反馈与记忆
├─ fixtures/            离线测试代码库，后续加入 NJU-Match 最小 Fixture
├─ docs/                设计、证据与演示材料
├─ .github/             GitHub Workflow 与仓库治理
├─ SPEC.md
├─ PLAN.md
├─ SPEC_PROCESS.md
├─ AGENT_LOG.md
└─ REFLECTION.md
```

## 安全基线

- 不提交真实 API Key、证书、私钥、`.env` 或运行时状态。
- API Key 后续只通过 GitHub Secrets、系统凭据库或加密凭据文件注入。
- Mock LLM 测试不得访问网络。
- 公网 Demo 不允许对服务器宿主机执行任意代码。

## GitHub 工作流

详细操作见 [GIT_WORKFLOW.md](./GIT_WORKFLOW.md)。
