# Project A 最终交付检查表

<!-- markdownlint-disable MD013 -->

> `REFLECTION.md` 正文由学生本人完成，本表不替代该项。

| 交付项 | 当前证据 | 状态 | 完成动作 |
| --- | --- | --- | --- |
| SPEC / PLAN / SPEC_PROCESS | 根目录三个文件 | 已有，冷启动段待实测 | 完成陌生 Agent 验证并回填 diff |
| Harness 内核 | `agent-harness/src/core` | 已实现 | 最终 SHA 再跑单测 |
| Mock LLM 单测与机制演示 | `agent-harness/tests`、npm demo scripts | 已实现 | 保存最终 CI Artifact |
| Coding 工具与反馈 | `agent-harness/src/tools/coding` | 已实现，受信任工作区限定 | 不得宣称未知仓库安全沙箱 |
| Social Agent WebUI | `NJU-Date-basic` | 已实现、本地与 CI 通过 | 公网浏览器验收 |
| GitHub CI | `docs/CI_CD_EVIDENCE.md` | PR #15 基线全绿 | 最终 SHA 更新记录 |
| GitLab `unit-test` | `.gitlab-ci.yml` | 配置已有，远端证据缺失 | 运行并记录 Pipeline URL |
| Docker 分发 | 两个 Dockerfile、Compose | 构建已在 CI 通过 | 发布镜像并记录 digest |
| Windows Docker Desktop | `scripts/windows` | 构建/启动脚本和语法检查已完成 | 启动 Docker 后实际构建并做浏览器验收 |
| Ubuntu LLM 凭据 | `deploy/ubuntu`、`loadSecret` | 代码与 5 项单测完成 | 在目标服务器验证 systemd 凭据生命周期 |
| 公网 WebUI | `docs/DEPLOYMENT_EVIDENCE.md` | 未验收 | 部署并填写矩阵 |
| 冷启动验证 | `docs/COLD_START_EVIDENCE.md` | 未执行 | 学生使用异类型 Agent 实测 |
| 双轨方向确认 | `docs/PROJECT_A_DIRECTION_CONFIRMATION.md` | 未确认 | 保存教师/助教书面回复 |
| 第三方许可证 | `THIRD_PARTY_NOTICES.md` | 已建立直接生产依赖清单 | 最终 lockfile 变更后重审 |
| Agent 过程记录 | `AGENT_LOG.md` | 已有，历史严格 TDD 证据不齐 | 只补真实后续记录，不追溯伪造 |
| Superpowers/TDD | `docs/SUPERPOWERS_TDD_EVIDENCE.md` | 方法映射与部分红—绿证据已有；插件调用仍缺 | 在学生环境完成一次真实七步流程 |
| 学生反思 | `REFLECTION.md` | 模板，不可提交 | 学生本人完成 1500–2500 字并标注 AI 辅助 |

## 最终硬门槛

- [ ] 最终提交 SHA 的 GitHub Required Checks 全绿；
- [ ] GitLab `unit-test` 对同一候选版本为 pass；
- [ ] 公网 WebUI、`/api/health`、登录和 `/agent` 可访问；
- [ ] 镜像可在干净环境拉取并启动；
- [ ] 冷启动证据与 SPEC/PLAN 修订可复核；
- [ ] 双轨领域形式已获得课程方确认，或 Coding 入口已按反馈升级；
- [ ] 仓库历史、日志、Trace 和 Artifact 均无真实凭据；
- [ ] `REFLECTION.md` 由学生本人完成。
