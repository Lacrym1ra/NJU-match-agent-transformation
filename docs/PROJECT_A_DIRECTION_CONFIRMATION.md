# Project A 领域方向确认记录

<!-- markdownlint-disable MD013 -->

> 状态：待课程教师或助教书面确认。

## 需要确认的事实

本仓库采用同一自研 Harness 内核的双轨交付：

1. 面向 NJU-Match 最终用户的 Social Agent WebUI，调用资料、问卷、匹配、圈子、论坛和消息等业务工具；
2. 隔离的 Coding adapter，提供受限文件读取/写入、命令执行、测试反馈、治理护栏和 Mock LLM 机制演示；
3. Social WebUI 不注册 Coding 工具，避免向普通用户暴露服务器文件或命令能力。

## 建议发送的确认问题

> Project A 要求 Coding Agent Harness。本项目的主要产品入口是 Social Agent，但在同一自研 AgentLoop 上另外交付了隔离 Coding adapter、Mock LLM 测试和治理/反馈机制演示。请确认这种“双轨交付”能否满足 A 项目的领域要求；若不能，是否必须将独立 Coding CLI/WebUI 提升为主要演示入口？

## 书面证据（学生填写）

| 字段 | 记录 |
| --- | --- |
| 询问日期 | 待填写 |
| 渠道 | 待填写 |
| 接收人 | 待填写 |
| 原始回复 | 待填写或附截图路径 |
| 结论 | 待填写 |
| 由结论触发的修改 | 待填写 commit/PR |

没有教师/助教原始回复前，本文件只能证明风险已识别，不能证明选题形式已获接受。
