# CI/CD 执行证据

<!-- markdownlint-disable MD013 -->

> 更新日期：2026-08-07
>
> 本文只记录可复核的远端执行结果。新提交产生后，必须用新 SHA 和新运行链接替换本页记录。

## GitHub Actions 基线

- Pull Request：[PR #15](https://github.com/Lacrym1ra/NJU-match-agent-transformation/pull/15)
- 验证提交：`095b91dacd140c9133ac2cab2ef463b9f3abc2db`
- 结论：该提交的 11 个 Check Run 均为 `success`，PR 当时为 `mergeable_state: clean`。

| Required Sensor / Job | 结果 | 远端记录 |
| --- | --- | --- |
| Harness Unit | success | [job 92805831993](https://github.com/Lacrym1ra/NJU-match-agent-transformation/actions/runs/31159322860/job/92805831993) |
| NJU-Match Backend | success | [job 92805832020](https://github.com/Lacrym1ra/NJU-match-agent-transformation/actions/runs/31159322860/job/92805832020) |
| Documentation | success | [job 92805832055](https://github.com/Lacrym1ra/NJU-match-agent-transformation/actions/runs/31159322860/job/92805832055) |
| Repository Policy | success | [job 92805832306](https://github.com/Lacrym1ra/NJU-match-agent-transformation/actions/runs/31159322860/job/92805832306) |
| Mock LLM Agent Scenarios | success | [job 92805832693](https://github.com/Lacrym1ra/NJU-match-agent-transformation/actions/runs/31159322854/job/92805832693) |
| Backend Docker Build | success | [job 92805832111](https://github.com/Lacrym1ra/NJU-match-agent-transformation/actions/runs/31159322922/job/92805832111) |
| Frontend Docker Build | success | [job 92805832089](https://github.com/Lacrym1ra/NJU-match-agent-transformation/actions/runs/31159322922/job/92805832089) |
| Secret Scan | success | [job 92805832079](https://github.com/Lacrym1ra/NJU-match-agent-transformation/actions/runs/31159322937/job/92805832079) |
| Dependency Audit | success | [job 92805831996](https://github.com/Lacrym1ra/NJU-match-agent-transformation/actions/runs/31159322937/job/92805831996) |
| CodeQL workflow | success | [job 92805832114](https://github.com/Lacrym1ra/NJU-match-agent-transformation/actions/runs/31159322937/job/92805832114) |
| Code scanning result | success | [run 92806154941](https://github.com/Lacrym1ra/NJU-match-agent-transformation/runs/92806154941) |

## 失败—修复—重跑记录

PR #15 首次 CodeQL 扫描发现 `agentQueryPlanner.ts` 中两处 Polynomial ReDoS 高危告警。提交 `095b91d` 将两处用户输入正则改为线性扫描，并增加 20 万字符规模的回归输入；后端 333 项测试通过，CodeQL 重跑成功，两个 review conversation 随后关闭。

## GitLab `unit-test`

根目录 `.gitlab-ci.yml` 已包含名称精确为 `unit-test` 的 job，但截至本页更新时间，没有可引用的 GitLab Pipeline URL。因此：

- 配置文件：已交付；
- 远端 GitLab 最后一次 pass 证据：**未完成，不能以 GitHub Actions 结果替代**。

完成后应追加 Pipeline URL、commit SHA、运行时间和 `unit-test` job URL。

## 最终提交前更新协议

1. 以最终候选提交触发全部 workflow；
2. 确认 Required Checks 全部为 success，且没有 skipped/cancelled 替代成功；
3. 下载并打开机制演示 Artifact，检查其中没有凭据或个人敏感信息；
4. 更新本页 SHA、链接和执行时间；
5. GitLab 同步同一 SHA 并保存 `unit-test` pass 链接。
