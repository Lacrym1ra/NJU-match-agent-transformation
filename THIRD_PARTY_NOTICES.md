# Third-Party Notices

<!-- markdownlint-disable MD013 -->

本项目使用以下直接生产依赖。版本来自 2026-08-07 的三个 `package-lock.json`；许可证标识来自包元数据。完整传递依赖及其许可证以 lockfile 和各包自带 LICENSE/NOTICE 为准。本清单不是对上游许可证文本的替代。

## Agent Harness

| Package | Resolved version | Purpose | License |
| --- | --- | --- | --- |
| zod | 4.3.6 | Action、配置和工具契约校验 | MIT |

## Backend

| Package | Resolved version | Purpose | License |
| --- | --- | --- | --- |
| @alicloud/dm20151123 | 1.9.0 | 阿里云邮件服务 API | Apache-2.0 |
| @alicloud/openapi-client | 0.4.15 | 阿里云 OpenAPI 客户端 | ISC |
| @alicloud/tea-util | 1.4.11 | 阿里云 SDK 工具 | Apache-2.0 |
| bcryptjs | 3.0.3 | 密码哈希 | BSD-3-Clause |
| cors | 2.8.6 | CORS 中间件 | MIT |
| dotenv | 17.3.1 | 本地环境配置加载 | BSD-2-Clause |
| drizzle-orm | 0.45.2 | 数据访问与 Schema | Apache-2.0 |
| express | 5.2.1 | HTTP 服务 | MIT |
| express-rate-limit | 8.6.2 | HTTP 限流 | MIT |
| file-type | 22.0.1 | 上传文件类型识别 | MIT |
| helmet | 8.1.0 | HTTP 安全头 | MIT |
| jsonwebtoken | 9.0.3 | JWT 签发与校验 | MIT |
| multer | 2.2.0 | Multipart 上传 | MIT |
| node-cron | 4.2.1 | 定时任务 | ISC |
| nodemailer | 9.0.4 | 邮件发送 | MIT-0 |
| openai | 6.33.0 | OpenAI-compatible Provider 客户端 | Apache-2.0 |
| postgres | 3.4.8 | PostgreSQL 客户端 | Unlicense |
| uuid | 13.0.2 | 标识符生成 | MIT |
| ws | 8.21.0 | WebSocket 服务 | MIT |
| zod | 4.3.6 | 请求和工具契约校验 | MIT |

`@nju-match/agent-harness` 是本仓库本地包，不属于外部第三方依赖。

## Frontend

| Package | Resolved version | Purpose | License |
| --- | --- | --- | --- |
| @fontsource/inter | 5.2.8 | Inter 字体文件 | OFL-1.1 |
| @fontsource/manrope | 5.2.8 | Manrope 字体文件 | OFL-1.1 |
| @google/genai | 1.46.0 | Google GenAI 客户端兼容能力 | Apache-2.0 |
| dotenv | 17.3.1 | 构建环境配置 | BSD-2-Clause |
| express | 4.22.2 | 本地/集成服务支持 | MIT |
| framer-motion | 12.38.0 | 动画与交互 | MIT |
| html-to-image | 1.11.13 | 页面节点图片导出 | MIT |
| html2canvas | 1.4.1 | 页面截图 | MIT |
| lucide-react | 0.546.0 | 图标组件 | ISC |
| motion | 12.38.0 | 动画能力 | MIT |
| react | 19.2.4 | UI 框架 | MIT |
| react-dom | 19.2.4 | DOM 渲染 | MIT |
| react-router-dom | 7.18.2 | 客户端路由 | MIT |
| recharts | 3.8.1 | 图表 | MIT |

## 来源与改编声明

- 当前审计未识别出复制进仓库、需要单独归属声明的第三方源码片段；若后续加入，必须在本节记录来源 URL、原许可证、修改范围和文件路径。
- 字体分别遵守 SIL Open Font License 1.1；分发时不得移除字体包随附的许可证文本。
- Apache-2.0 组件如附带上游 NOTICE，发布制品应一并保留。
- 最终提交前应对 lockfile 重新生成 Software Bill of Materials 或许可证报告，并人工处理 `UNKNOWN`、自定义或不兼容许可证。
