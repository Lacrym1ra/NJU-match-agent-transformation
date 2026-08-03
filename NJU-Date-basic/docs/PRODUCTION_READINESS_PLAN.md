# NJU-Match Agent 生产部署准备与修改优先级

## 1. 文档目的

本文统一记录当前生产部署审计、域名与 `www` 策略，以及正式 AI Provider
接入前的修改顺序。本文不保存真实域名解析信息、服务器地址、证书私钥、
API Key 或其他生产 Secret。

当前建议将生产准备拆成两个独立任务：

1. `chore/production-readiness`：先完善 Docker、配置模板、健康检查和运行时；
2. `feat/provider-llm`：部署基线稳定后再接入真实模型 API。

## 2. 当前架构

```text
Internet
  -> Nginx frontend container :80/:443
     -> /api/* -> backend container :3000
        -> postgres container :5432
```

合理部分：

- PostgreSQL 没有向公网发布 `5432`；
- Backend 没有直接向公网发布 `3000`；
- 前端生产构建使用同源 `/api/v1`；
- 数据库使用命名卷持久化；
- `.env`、证书和私钥被 Git 忽略；
- Nginx 已包含 SPA fallback、基础限流和 TLS 1.2/1.3。

## 3. 修改优先级

### P0：阻塞生产上线

#### P0-1 正式域名与 DNS

- 确认唯一规范域名；
- 推荐根域名作为主地址；
- 可同时配置 `www`，并使用 301 跳转到根域名；
- DNS A 记录指向云服务器；
- 只有服务器真正支持 IPv6 时才配置 AAAA；
- 最终统一修改 `FRONTEND_URLS`、`FRONTEND_PUBLIC_URL` 和 Nginx
  `server_name`。

此项暂缓，等待域名修改阶段执行。

#### P0-2 正式可信证书

当前本地证书是 `CN=localhost` 的自签名证书且没有 SAN，不能用于公网域名。

正式上线必须：

- 使用 ACME/Certbot 或云平台证书服务；
- 证书 SAN 同时覆盖根域名和 `www`；
- 挂载 `fullchain.pem` 与 `privkey.pem`；
- 配置自动续期和 Nginx reload；
- 完成 `renew --dry-run`。

此项暂缓，等待域名和服务器阶段执行。

#### P0-3 生产 Secret

以下值必须在服务器独立生成，不能沿用示例值：

- `JWT_SECRET`；
- `ADMIN_KEY`；
- `POSTGRES_PASSWORD`；
- `CONTACT_ENCRYPTION_KEY`；
- `CONTACT_BLIND_INDEX_KEY`；
- 可选但建议独立设置的 `HEARTBOX_STUDENT_ID_PEPPER`。

联系人加密 Key 和长期 Pepper 在生产数据写入后不得随意轮换。

#### P0-4 数据备份与恢复演练

- 首次迁移前执行 `pg_dump`；
- 每日自动备份；
- 备份保存在 Docker 卷之外；
- 设置保留期与失败告警；
- 至少完成一次恢复演练；
- 数据库迁移失败时不得继续切流。

#### P0-5 真实 Provider 尚未实现

当前 Harness 具备 `LLMPort` 和 `MockLLM`，但尚无真实 Provider Adapter。
只填写 `DASHSCOPE_API_KEY` 不能形成完整对话 Agent。

后续 `feat/provider-llm` 至少需要：

- Provider Adapter；
- 结构化输出校验；
- 超时、有限重试和错误分类；
- Token、步骤和费用预算；
- Tool 白名单与 HITL；
- Trace 脱敏；
- 服务端会话 API；
- Mock LLM 继续作为 CI 默认；
- 真实 Provider smoke test 只能手动触发。

此项暂缓，不在当前简单修复中实现。

### P1：上线前必须完成的工程保障

#### P1-1 环境变量模板

恢复并完善 `.env.example`，包含所有必填变量但不包含真实值。服务器使用独立
`.env` 或 Secret Manager，并将文件权限限制为仅部署用户可读。

状态：本次已处理。

#### P1-2 动态数据库健康检查

PostgreSQL healthcheck 必须使用配置后的 `POSTGRES_USER` 与 `POSTGRES_DB`，
不能写死 `postgres/nju_date`。

状态：本次已处理。

#### P1-3 Backend 健康检查与启动依赖

- Backend 通过 `/health` 接受 Docker healthcheck；
- Frontend 等待 Backend healthy；
- 为迁移和首次启动设置 `start_period`。

状态：本次已处理。

#### P1-4 受支持的 Node LTS

原 Dockerfile 使用已结束官方维护的 Node 20。生产构建和运行镜像升级到
Node 24 LTS，升级后必须执行全量测试和 Docker build。

状态：本次已处理。

#### P1-5 日志轮转

为三个服务配置 Docker `json-file` 日志上限，避免长期运行耗尽磁盘。

状态：本次已处理。

#### P1-6 迁移发布流程

当前 Backend 启动时自动执行数据库迁移。首版必须保持单 Backend 实例，并按
以下顺序部署：

```text
维护模式 -> 数据库备份 -> 迁移 -> Backend healthy -> Frontend -> Smoke Test
```

后续再将迁移拆成独立的一次性部署任务。

### P2：上线后尽快补充

- 容器 CPU/内存限制；
- 镜像版本或 digest 固定；
- 备份异地复制；
- 运行指标、5xx、磁盘和证书续期告警；
- Provider 费用与错误率告警；
- 独立 Staging 环境；
- HSTS 分阶段启用；
- 自动化回滚和灾难恢复演练。

## 4. 域名与 `www` 决策

已注册的是根域名。`www` 是否可用取决于 DNS 和服务器配置，不由注册动作自动
决定。

推荐策略：

```text
主地址：根域名
兼容地址：www 子域名
规范跳转：www -> 根域名
```

最终证书必须同时覆盖两者，CORS 可以接受两者，但系统生成的公开链接只使用
根域名。

此部分暂不修改代码，等待最终域名上线阶段统一处理。

## 5. 修改前执行步骤

1. 合并当前业务 PR，确保 `main` 具有明确提交；
2. 创建生产准备分支与预发布 Tag；
3. 清理或确认现有未提交的 Compose 修改；
4. 确认域名、服务器 IP、操作系统和 Docker Compose 版本；
5. 确认 AI Provider、模型、邮件服务和备份目标；
6. 在服务器生成生产 Secret，不从开发机 `.env` 复制；
7. 先构建并验证生产镜像；
8. 完成 DNS 和可信证书；
9. 备份并验证恢复；
10. 在维护模式下完成首次迁移和 Smoke Test；
11. 验证成功后再公开切流。

## 6. 可重复验证

```text
docker compose config --quiet
docker compose build

cd backend
npm ci --ignore-scripts
npm run lint
npm test
npm run build

cd ../frontend
npm ci --ignore-scripts
npm run lint
npm test
npm run build
```

启动后验证：

```text
docker compose ps
docker compose exec backend node -e "fetch('http://127.0.0.1:3000/health').then(r=>{console.log(r.status);process.exit(r.ok?0:1)}).catch(()=>process.exit(1))"
docker compose logs --since=5m postgres backend frontend
```

## 7. 回滚原则

- 部署前保存数据库备份和当前镜像/Tag；
- 应用失败时恢复上一镜像；
- 数据库迁移包含不可逆数据变更时，必须使用已验证的备份恢复；
- 不对共享 Git 分支执行强制回退；
- 不在日志、PR 或聊天中粘贴生产 Secret。
