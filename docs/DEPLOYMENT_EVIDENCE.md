# 公网部署与分发证据

<!-- markdownlint-disable MD013 -->

> 状态：部署配置已准备，公网验收尚未记录。不得把计划中的域名写成已上线地址。

## 目标架构

```text
Browser
  → Cloudflare DNS/TLS
  → match.invertedarena.com:443
  → host reverse proxy
  → frontend container
  → /api and /ws reverse proxy
  → backend container
  → PostgreSQL
```

同一服务器未来可承载 `www.invertedarena.com`，但两个站点应以主机名区分虚拟主机；容器内部端口可以不同，对公网仍统一使用 443。证书、私钥和 `.env` 不进入 Git 或镜像。

## 待填写的发布记录

| 字段 | 真实值 |
| --- | --- |
| 公网 WebUI URL | 待部署后填写 |
| 部署 commit SHA | 待填写 |
| 镜像 registry 与不可变 tag/digest | 待填写 |
| 部署时间与执行人 | 待填写 |
| DNS 记录 | 待填写（不得记录 Cloudflare API Token） |
| TLS 模式与证书有效期 | 待填写（不得提交私钥） |
| 回滚目标版本 | 待填写 |

## 公网验收矩阵

| 检查 | 命令/操作 | 验收标准 | 结果 |
| --- | --- | --- | --- |
| DNS | `Resolve-DnsName match.invertedarena.com` | 指向预期代理或服务器 | 待验证 |
| TLS | 浏览器或 `curl -I https://match.invertedarena.com` | 证书有效、无降级到 HTTP | 待验证 |
| Health | `curl https://match.invertedarena.com/api/health` | 2xx 且返回健康状态 | 待验证 |
| WebUI | 打开根路径 | 页面资源无 4xx/5xx | 待验证 |
| 登录 | 使用测试账号 | 登录与退出可用 | 待验证 |
| Agent | 打开 `/agent` | 可对话；写操作要求确认 | 待验证 |
| WebSocket | 圈内聊天测试 | 连接、鉴权和断线恢复正常 | 待验证 |
| 回滚 | 切回上一不可变镜像 tag | 服务恢复且数据未丢失 | 待验证 |

## 分发验证

Dockerfile 和 Compose 配置不是公开制品本身。最终还需记录：公开或授权可拉取的镜像地址、digest、干净服务器上的拉取/启动命令，以及启动后 health check。若镜像不公开，应向课程评审者提供可访问方式。

## 安全检查

- 服务器 `.env` 权限限制为服务账号可读；
- Cloudflare Origin 私钥只保存在服务器，不进入 Compose、日志或 Artifact；
- 数据库端口不直接暴露公网；
- 后端端口只对反向代理网络开放；
- 日志不输出 JWT、LLM Key、Cookie、验证码或联系方式；
- 发布前运行 Secret Scan 与 CodeQL；
- 维护模式和回滚步骤必须在真实环境演练一次。
