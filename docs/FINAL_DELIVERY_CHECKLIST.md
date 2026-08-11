# Project B 最终交付检查表

<!-- markdownlint-disable MD013 -->

> `REFLECTION.md` 正文必须由学生本人完成；本表不替代该项。历史 Project A 方向确认不再是提交门槛。

| 交付项 | 当前证据 | 状态 | 完成动作 |
| --- | --- | --- | --- |
| SPEC / PLAN / SPEC_PROCESS | 根目录三个文件 | 已迁移到 B，冷启动待实测 | 实测后回填 diff |
| 原有/新增功能边界 | `docs/PROJECT_B_SCOPE_AND_FEATURE_BASELINE.md` | 已建立 | 最终演示前逐项复核 |
| 3+ 本阶段模块 | 共鸣胶囊、安心赴约、Harness Agent | 本地 PostgreSQL/Chromium/Docker 非 Mock 冒烟通过 | 保存最终 SHA 和公网证据；旧系统不计入 |
| 创新 Harness Agent | `agent-harness` + 真实 `/agent` Runtime | 已实现 | 最终 SHA 重跑 Mock 场景 |
| 一键测试 | 根 `npm test`、`bootstrap:verify` | 已实现 | 最终 SHA 本地/CI 执行 |
| 前端隐私分离 | 路由契约、隐私页、全局标识 | 代码通过 | 完成 42 路由模式浏览器矩阵 |
| GitHub CI | `docs/CI_CD_EVIDENCE.md` | 历史基线已有 | 更新最终 SHA |
| GitLab `unit-test` | `.gitlab-ci.yml` | 配置已有、远端证据缺失 | 记录 Pipeline URL |
| Docker / Windows 分发 | Dockerfiles、Compose、`scripts/windows` | 实现已有 | 干净机器实测并记录 digest |
| Ubuntu 凭据 | `deploy/ubuntu`、`loadSecret` | 代码与单测已有 | 保存 set/status/update/clear 实测 |
| 公网 WebUI | `docs/DEPLOYMENT_EVIDENCE.md` | 部署中 | 完成域名、TLS、功能矩阵 |
| 数据治理 | Privacy/UserAgreement/账户注销 | 部分完成 | 配置私密联系渠道、保存期、导出/删除 |
| 陌生 Agent 冷启动 | `docs/COLD_START_EVIDENCE.md` | 未执行 | 学生使用异类型 Agent 实测 |
| 第三方许可证 | `THIRD_PARTY_NOTICES.md` | 已建立 | 最终 lockfile 后重审 |
| Superpowers/TDD | `docs/SUPERPOWERS_TDD_EVIDENCE.md` | 部分真实证据 | 只补真实后续记录 |
| 学生反思 | `REFLECTION.md` | 模板，不可提交 | 学生完成 1500–2500 字并标注 AI 辅助 |

## 最终硬门槛

- [ ] 三个以上模块均可从 WebUI 完整演示；
- [ ] Agent 在移除真实 LLM 后仍可确定性测试；
- [ ] 最终提交 SHA 的 GitHub Required Checks 全绿；
- [ ] GitLab `unit-test` 对同一候选版本为 pass；
- [ ] 公网 WebUI、`/api/health`、登录和 `/agent` 可访问；
- [ ] 镜像可在干净 Windows Docker Desktop 或 Linux 环境启动；
- [ ] 冷启动证据与 SPEC/PLAN 修订可复核；
- [ ] 所有前端路由完成隐私/权限浏览器检查；
- [ ] 仓库历史、日志、Trace 和 Artifact 均无真实凭据；
- [ ] `REFLECTION.md` 由学生本人完成。
