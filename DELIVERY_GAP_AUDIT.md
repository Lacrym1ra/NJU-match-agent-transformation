# Project B 最终交付缺口审计

<!-- markdownlint-disable MD013 -->

> 判定依据：AI4SE 通用要求与 `AI4SE_Final_Project_B_应用类项目.md`。历史 Project A 专属要求不再作为最终判定条件。

## 1. 当前结论

项目已新增共鸣胶囊、安心赴约和 Harness Agent 三个本阶段可验收模块，并具备统一一键测试、Docker/CI 和公开 WebUI 基础。旧 NJU-Match 仅作为基线和 Agent 工具来源，不再用于满足新功能数量。当前最大缺口是学生反思、陌生 Agent 冷启动、同一候选版本的最终 CI/分发证据、公开部署验收，以及真实用户上线前的数据治理闭环。

## 2. 已经满足或达到代码级验收的部分

| Project B 要求 | 当前证据 | 判定 |
| --- | --- | --- |
| 至少 3 个职责清晰模块 | 共鸣胶囊、安心赴约、Harness Agent；旧系统不计入 | PostgreSQL 3/3、Chromium 6/6，及 Docker 非 Mock 全栈冒烟通过 |
| 有实质工作量和完整应用 | React WebUI、Express、PostgreSQL、实时聊天、Agent、管理治理 | 满足代码规模与深度 |
| 一键运行测试 | 根目录 `npm test` / `npm run bootstrap:verify` | 已实现，最终 SHA 仍需重跑 |
| 应用内 Agent 自研机制 | `agent-harness` Loop、Registry、Policy、Mock LLM | 满足 B.2 额外要求 |
| Agent 去真实模型测试 | Mock LLM 场景、HITL/反馈/越权测试 | 已实现 |
| 凭据不进仓库 | Secret 扫描、文件读取、Ubuntu encrypted credential | 代码方案已有，目标服务器生命周期需留证 |
| Windows 分发 | Docker Desktop Linux OCI 脚本 | 已实现脚本，干净机器实测证据待补 |
| 前端隐私分离基线 | 全部 App 路由分类、全局边界标识、生产关闭本地绕过入口 | 代码与 3 项契约测试通过 |

## 3. P0：完全缺失或当前不能算最终交付

### GAP-P0-01：`REFLECTION.md` 仍是学生模板

要求 1500–2500 字并由学生本人撰写。AI 样稿不能替代提交正文。学生需结合 A→B 选型转变、TDD、Superpowers、subagent、凭据和分发的真实证据完成。

### GAP-P0-02：陌生异类型 Agent 冷启动尚未实测

`docs/COLD_START_EVIDENCE.md` 目前是协议，不是结果。必须用全新会话、不同类型 Agent，只给 `SPEC.md + PLAN.md` 实施 1–2 个任务，保存问题、偏离、diff 和由此产生的规约修订。

### GAP-P0-03：最终候选版本的远端证据不完整

需要同一提交 SHA 的 GitHub Required Checks、GitLab 精确名 `unit-test` job、镜像 tag/digest、干净环境启动和公网浏览器验收。历史 PR 全绿不能替代最终版本。

### GAP-P0-04：真实用户数据治理闭环未完成

当前缺少专用的非公开隐私联系渠道、模型 Provider 数据处理说明、明确保存期限、数据导出、备份删除和完整物理删除工单。完成前，公网环境只能用于知情测试账号，不应收集真实联系方式或不必要敏感信息。

## 4. P1：已有实现但仍需收口

### GAP-P1-01：全站浏览器级隐私审计尚未完成

42 个路由模式已有代码级分类和统一标识。本地 Chromium 已验证公开页不显示认证悬浮层、未登录无法直达 14 个代表性受保护路由，以及 390px 下标识与 Agent 不重叠。仍需用未填问卷/普通成员/圈主/管理员等多角色逐页检查键盘可达性、错误页和匿名/私密内容缓存。

### GAP-P1-02：公网部署尚未形成最终验收记录

服务器、域名和容器已进入部署阶段，但需记录 `https://match.invertedarena.com`、`/api/health`、登录、Agent、圈子、论坛和 WebSocket 的最终结果；Cloudflare/Nginx/TLS 问题应以最终复测为准。

### GAP-P1-03：管理入口需要生产代理实测

`/admin` 不复用普通用户会话，而使用独立管理员 Key 与来源网络限制。需验证反向代理后的客户端 IP 信任链、错误尝试限流、Key 轮换和日志脱敏，不能只凭前端 Gate 认定安全。

### GAP-P1-04：Agent 会话记忆仍为进程内实现

当前记忆有界且按用户/会话隔离，但重启丢失、多副本不共享。课程演示可接受，部署文档和答辩必须如实说明，不得称为生产级长期记忆。

### GAP-P1-05：过程证据仍有历史缺口

部分早期任务没有保存严格的红灯输出，Superpowers 插件/skill 也不能追溯性证明。后续只能记录真实使用，不得通过改写文档补造。

## 5. 不再属于 Project B 硬门槛的历史项

- Coding adapter 独立 CLI/WebUI；
- Project A “Coding Agent Harness”领域确认；
- 将 Coding adapter 升级为主要产品入口。

这些代码和记录可以作为额外工程资产与反思材料保留，但不应挤占 Project B 主应用、隐私和分发的收口时间。

## 6. 建议完成顺序

1. 学生完成 REFLECTION 正文和陌生 Agent 冷启动；
2. 配置独立隐私联系渠道、Provider 说明和数据生命周期；
3. 完成全站 42 路由模式浏览器矩阵，并重点保存两个新模块的双账号/所有权证据；
4. 在候选 SHA 上跑根一键测试与远端 GitHub/GitLab；
5. 发布镜像、记录 digest，在干净环境启动；
6. 公网验证 HTTPS、健康检查、登录、匹配、圈子、论坛、Agent 和实时聊天；
7. 冻结提交，复扫凭据和第三方许可证。

## 7. 最终硬门槛

- [ ] `REFLECTION.md` 为学生本人完成的 1500–2500 字正文；
- [ ] 陌生异类型 Agent 冷启动有真实记录和 Spec/Plan 修订；
- [ ] 至少三个业务模块有演示路径和客观测试；
- [ ] 最终 SHA 的 GitHub 与 GitLab 测试通过；
- [ ] 公网 WebUI 与核心 API/实时链路通过；
- [ ] 镜像可在干净环境启动并记录 digest；
- [ ] 生产凭据、隐私联系渠道和数据生命周期完成验收；
- [ ] 仓库、历史、日志、Trace 和 Artifact 不含真实凭据或个人数据。
