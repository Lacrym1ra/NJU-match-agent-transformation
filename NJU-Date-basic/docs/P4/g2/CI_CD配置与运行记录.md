# CI/CD 配置与运行记录

**团队名称：** 第二组  
**阶段：** Phase 4 - 编码开发  
**配置文件：** 项目根目录 `.gitlab-ci.yml`  
**本轮线上 CI 截图日期：** 2026-06-07  
**本轮线上 Pipeline：** `#299259`（提交 `062ded22`，分支 `P4`）  
**本轮本地复跑日期：** 2026-06-07

## 1. 记录说明

本记录同时保留线上 GitLab CI 截图与本地复跑结果。线上 Pipeline `#299259` 中，第二组相关的 `g2_all_tests` 与 `g2_fixed_issue_tests` 已通过一次，`g2_known_issue_tests` 为 CI 中配置的 `allow_failure: true` 缺陷复现 job，符合预期允许失败策略。

由于同一条流水线中仍存在非 G2 job（如 `backend:test`、`frontend:e2e`）失败，整条 Pipeline 显示为失败；该状态不影响本页对第二组 G2 专属测试 job 已在线上 CI 通过一次的记录。本地复跑结果继续用于补充覆盖率、数据库集成测试和端到端测试的细项证据。

本页仅展示第二组 G2 相关测试结果；依赖安装、构建、lint、npm audit 等非 G2 测试结果不纳入本记录展示范围。

## 2. G2 CI 测试项

| CI job | CI 中的核心命令 | 本地记录方式 | 说明 |
|--------|----------------|--------------|------|
| `g2_all_tests` | `npm --prefix backend run test:g2`；`npm --prefix frontend run test:g2` | 拆分复跑后端单元、后端数据库集成、前端单元、前端 Playwright 集成测试 | 覆盖 G2 后端服务逻辑、真实数据库流程、前端模块逻辑与端到端交互 |
| `g2_unit_coverage` | `npm --prefix backend run test:g2:coverage`；`npm --prefix frontend run test:g2:coverage` | 本地复跑覆盖率命令 | 统计 G2 显式纳入覆盖率范围的核心模块 |
| `g2_fixed_issue_tests` | `npm --prefix backend run test:g2:fixed-issues` | 本地复跑修复后回归测试 | 验证并发缺陷已被修复 |
| `g2_known_issue_tests` | `npm --prefix backend run test:g2:known-issues` | 本地复跑修复前缺陷模型 | CI 中配置为 `allow_failure: true`，用于保留缺陷复现证据 |

## 3. 线上 CI 截图记录

| 项目 | 记录 |
|------|------|
| GitLab Pipeline | `#299259` |
| 提交 | `062ded22`（`mirror`） |
| 分支 | `P4` |
| 截图时间 | 2026-06-07 23:56 |
| 第二组线上通过项 | `g2_all_tests`、`g2_fixed_issue_tests` |
| 第二组预期允许失败项 | `g2_known_issue_tests`（`allow_failure: true`） |
| 说明 | Pipeline 整体因非 G2 job 失败显示为失败；截图仍可证明第二组 G2 专属测试 job 已在线上 CI 通过一次。 |

![GitLab CI Pipeline #299259 中第二组 G2 job 通过截图](<evidence/截屏2026-06-07 23.56.37.png>)

## 4. 本地复跑环境

| 项目 | 记录 |
|------|------|
| 本地 Node.js | `v25.9.0` |
| 本地 npm | `11.12.1` |
| CI 目标镜像 | `node:20-bookworm` |
| 数据库集成测试 | 使用本机 PostgreSQL 补充记录线上截图未展开的数据库集成测试细项 |
| 前端集成测试 | 使用 Playwright Chromium 启动本地前后端服务并连接真实后端接口 |

说明：本地复跑结果用于补充线上截图未展开的细项输出，能够证明当前 G2 测试命令链路和功能验证结果；由于执行环境与 GitLab Runner 镜像不完全一致，不能等同于线上 Runner 的镜像级验证结果。

## 5. G2 测试结果汇总

| CI 对应 job | 本地复跑命令 | 结果 | 记录 |
|------------|-------------|------|------|
| `g2_all_tests` | `npm --prefix backend run test:g2:unit` | 通过 | 后端 G2 单元测试 78/78 通过 |
| `g2_all_tests` | `npm --prefix backend run test:g2:integration` | 通过 | 后端真实 PostgreSQL 集成测试 19/19 通过 |
| `g2_all_tests` | `npm --prefix frontend run test:g2:unit` | 通过 | 前端 G2 单元测试 29/29 通过 |
| `g2_all_tests` | `npm --prefix frontend run test:g2:integration` | 通过 | Playwright Chromium 集成测试 3/3 通过 |
| `g2_unit_coverage` | `npm --prefix backend run test:g2:coverage` | 通过 | 后端 G2 覆盖率：Line 92.10%、Branch 68.02%、Funcs 96.77% |
| `g2_unit_coverage` | `npm --prefix frontend run test:g2:coverage` | 通过 | 前端 G2 覆盖率：Line 94.65%、Branch 66.46%、Funcs 93.64% |
| `g2_fixed_issue_tests` | `npm --prefix backend run test:g2:fixed-issues` | 通过 | 修复后并发问题回归测试 5/5 通过 |
| `g2_known_issue_tests` | `npm --prefix backend run test:g2:known-issues` | 预期失败 | 修复前问题模型 5/5 失败；该 job 在 CI 中允许失败，用于证明缺陷修复前行为 |

## 6. 覆盖率摘要

| 范围 | Line | Branch | Funcs | 说明 |
|------|------|--------|-------|------|
| 后端 G2 核心模块 | 92.10% | 68.02% | 96.77% | 覆盖聊天内容治理、圈子加入策略、卡片快照、联系方式字段、关系策略、组队策略等模块 |
| 前端 G2 核心模块 | 94.65% | 66.46% | 93.64% | 覆盖实时聊天 API、卡片展示与转换、圈子发现/加入/管理、联系方式解锁、好友请求、组队流程等模块 |

## 7. 本轮观察

- 线上 GitLab Pipeline `#299259` 中，`g2_all_tests` 与 `g2_fixed_issue_tests` 已通过一次，可作为第二组 G2 CI 测试通过证据。
- 同一条 Pipeline 中 `backend:test`、`frontend:e2e` 为非 G2 job，二者失败导致整条 Pipeline 标红；本记录不将其计入第二组 G2 测试结论。
- 后端数据库集成测试在沙箱内连接本地 PostgreSQL 时受到本地网络权限限制；使用本地非沙箱环境复跑后，19 条数据库集成用例全部通过。
- 前端 Playwright 集成测试运行期间，后端服务输出了 `express-rate-limit` IPv6 `keyGenerator` 校验提示；该提示未导致测试失败，3 条集成用例全部通过。
- Playwright 运行期间本地旧数据中出现过联系方式密文解密失败日志；测试流程本身全部通过。该日志与本地历史数据/密钥不一致有关，不影响本轮 G2 测试结论。

## 8. 结论

第二组已在 GitLab CI Pipeline `#299259` 中获得一次 G2 专属 job 线上通过记录：`g2_all_tests` 与 `g2_fixed_issue_tests` 均通过，`g2_known_issue_tests` 按设计保留修复前失败证据并允许失败。结合本地复跑结果，G2 单元测试、数据库集成测试、Playwright 集成测试、覆盖率测试与修复后回归测试均已形成可追溯证据。本轮记录可作为 P4 阶段 G2 CI/CD 测试证据。
