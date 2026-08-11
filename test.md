# NJU Match 完整测试流程

<!-- markdownlint-disable MD013 -->

本文覆盖 Windows 本地自部署、数据库初始化、登录、继承功能冒烟、Project B
两个新增模块、Harness Agent、自动化测试、镜像验收和 Ubuntu 更新后的检查。
测试数据不得用于正式用户环境；生产数据库执行任何重置命令前必须先备份。

## 1. 测试范围与通过标准

| 层级 | 通过标准 |
| --- | --- |
| 仓库 | 根目录 `npm test` 返回 0 |
| 容器 | PostgreSQL、Backend、Frontend 均为 `healthy` |
| 登录 | Alice、Bob 可以登录且不会被问卷页面强制拦截 |
| 继承功能 | Dashboard、匹配、圈子、论坛至少各完成一次读取 |
| 共鸣胶囊 | 覆盖待加入、单边封存、双方揭晓、取消和越权拒绝 |
| 安心赴约 | 覆盖待签到、签到、完成、逾期、取消和所有权隔离 |
| Agent | 读取可直接执行；创建动作确认前零副作用，确认后真实写入 |
| 分发 | 三个 `linux/amd64` 镜像可离线加载，源码与镜像校验和一致 |

## 2. Windows 本地自部署

以下命令使用 PowerShell，在仓库根目录执行。Docker Desktop 必须启动并选择
Linux containers；不要使用 Git Bash 运行 PowerShell 脚本。

```powershell
cd C:\Users\X\桌面\AI4Coding\ai4coding-lab
docker info --format '{{.OSType}}/{{.Architecture}}'
Copy-Item NJU-Date-basic\.env.local-test.example NJU-Date-basic\.env.local-test
npm run bootstrap:verify
npm run docker:windows:up
```

第一条命令必须输出 `linux/x86_64` 或等价的 `linux/amd64`。等待健康检查：

```powershell
cd NJU-Date-basic
docker compose --project-name nju-match-local --env-file .env.local-test ps
docker compose --project-name nju-match-local --env-file .env.local-test logs backend --tail 100
Invoke-WebRequest http://127.0.0.1:8082/health -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:8082/api/v1/health -UseBasicParsing
```

三个容器应为 `healthy`，两个 HTTP 请求应为 200。若需要完全重建测试数据库，
只能删除本地测试卷，禁止在生产服务器照抄：

```powershell
docker compose --project-name nju-match-local --env-file .env.local-test down --volumes
npm run docker:windows:up
```

## 3. 初始化演示账号和 Project B 数据

容器镜像已经包含编译后的种子脚本。先创建 Alice、Bob、论坛和资料数据，再写入
两个新模块的数据：

```powershell
docker compose --project-name nju-match-local --env-file .env.local-test exec backend node dist/db/seedDemoData.js --reset
docker compose --project-name nju-match-local --env-file .env.local-test exec backend node dist/db/seedProjectBModules.js --reset
```

第二条命令只更新固定 UUID 白名单中的 4 个胶囊和 5 个赴约计划，不会清理其他
业务记录。验证数据库：

```powershell
docker compose --project-name nju-match-local --env-file .env.local-test exec postgres psql -U postgres -d nju_date -c "SELECT status, count(*) FROM resonance_capsules GROUP BY status ORDER BY status;"
docker compose --project-name nju-match-local --env-file .env.local-test exec postgres psql -U postgres -d nju_date -c "SELECT status, count(*) FROM meetup_safety_plans GROUP BY status ORDER BY status;"
```

预期胶囊包含 `awaiting_participant`、`collecting`、`revealed`、`cancelled` 各一条；
赴约表包含两个 `scheduled` 以及 `checked_in`、`completed`、`cancelled` 各一条。
其中一个 `scheduled` 会由服务层按结束时间显示为 `overdue`。

## 4. 登录与基础路由

访问 <http://127.0.0.1:8082/login>，勾选用户协议后使用：

| 角色 | 邮箱 | 密码 |
| --- | --- | --- |
| Alice（主要测试账号） | `alice@smail.nju.edu.cn` | `test123` |
| Bob（第二参与者） | `bob@smail.nju.edu.cn` | `test123` |
| 本地管理员 | `admin@nju.date` | `admin123` |

登录 Alice 后依次打开 `/dashboard`、`/circles`、`/forum`、`/agent`、
`/resonance` 和 `/meetup-safety`。预期不跳转到 `/survey`，导航、隐私边界标识
和全局 Agent 均可见。退出后直接访问 `/resonance` 应跳转登录页。

## 5. 继承功能冒烟

旧 NJU Match 功能只作为继承基线和 Agent 工具数据源，但仍需确认没有回归：

1. Dashboard 能读取完整资料与问卷状态；
2. 匹配页能加载候选或明确显示无结果；
3. 圈子页能搜索并进入圈子详情，非成员操作仍受权限限制；
4. 论坛能打开演示帖子、评论和投票；
5. 通知、私信或关注列表至少能正常读取一次；
6. 公开页 `/about`、`/privacy` 不应加载已登录用户的私密悬浮数据。

## 6. 共鸣胶囊测试

### 6.1 种子状态检查

Alice 打开 `/resonance`，应看到待加入、进行中、已揭晓和已取消四类状态。
已揭晓胶囊可以看到双方答案；进行中胶囊只能看到自己的提交状态，不能看到
Bob 尚未提交的内容；已取消胶囊不能继续回答。

### 6.2 邀请码与双人揭晓

1. Alice 对自己的邀请码 `RSN2A7BC` 尝试加入，预期拒绝；
2. 使用无痕窗口登录 Bob，打开 `/resonance` 并输入 `RSN2A7BC`；
3. Bob 加入成功后，Alice 刷新，胶囊状态变为进行中；
4. Alice 先回答，Bob 页面不得显示 Alice 的答案；
5. Bob 回答后，双方刷新都应同时看到两份答案；
6. 再次使用同一邀请码，预期提示无效或已使用。

### 6.3 新建与取消

Alice 新建一个胶囊，确认页面只展示一次邀请码。刷新后邀请码明文不应再次返回；
取消后不能回答。数据库中的 `invite_code_hash` 应为 64 位哈希，不得等于邀请码。

## 7. 安心赴约测试

Alice 打开 `/meetup-safety`，应看到待签到、已签到和逾期样例：

1. 对待签到计划执行签到，状态变为 `checked_in`；
2. 签到后执行完成，状态变为 `completed`；
3. 新建计划时结束时间早于开始时间，预期前端或后端拒绝；
4. 新建合法计划后取消，之后不能再签到；
5. 逾期样例显示 `overdue`，但数据库仍保存 `scheduled`；
6. Bob 登录后看不到 Alice 的计划；Alice 也看不到 Bob 的已完成和已取消样例；
7. 页面文案不得把该模块描述为报警、定位追踪或安全担保服务。

## 8. Harness Agent 联动测试

在 `/agent` 或任意页面的全局 Agent 中依次输入：

```text
列出我当前的共鸣胶囊状态。
列出我当前的安心赴约计划状态。
创建共鸣胶囊：见面前的一个问题｜你最近最期待完成什么？
创建安心赴约：周末交流｜仙林图书馆一楼｜2026-08-20 14:00｜2026-08-20 16:00｜公共区域见面
```

前两条应返回真实数据卡片。后两条必须先出现确认弹窗：取消确认时数据库数量不变；
确认后数据库增加一条，并返回真实资源 ID。重复使用同一确认操作不得再次写入。
Agent 不应提供替用户回答胶囊、代签到或代完成的工具。

没有配置真实 LLM Key 时，只执行 Mock/确定性测试；不要把 Provider 不可用误判为
Harness 机制失败。配置真实 Key 时应使用服务器 Secret，不得粘贴到聊天、日志或
仓库文件。

## 9. 自动化测试

仓库根目录的一键验证：

```powershell
cd C:\Users\X\桌面\AI4Coding\ai4coding-lab
npm test
```

数据库集成测试使用仅绑定 `127.0.0.1:55432` 的本地 Compose 数据库，测试只清理
固定 `p4-db-` 前缀记录；绝不能把下列 URL 改为生产数据库：

```powershell
cd NJU-Date-basic\backend
$env:NODE_ENV='test'
$env:DATABASE_URL='postgres://postgres:local-test-postgres-password@127.0.0.1:55432/nju_date'
npm run test:db -- tests/db/projectBModules.test.ts
Remove-Item Env:DATABASE_URL
Remove-Item Env:NODE_ENV
```

浏览器场景：

```powershell
cd ..\frontend
npx playwright install chromium
npx playwright test tests/e2e/project-b-modules.spec.ts tests/e2e/privacy-boundaries.spec.ts --reporter=line
```

所有命令必须返回 0。失败时保存命令、首个错误和修复后的复测结果，不应只截图
最后一行。

## 10. Windows 镜像构建与离线包验收

提交并确保 tracked files 干净后，在仓库根目录执行：

```powershell
npm run docker:windows:export
Get-ChildItem deployment-packages
Get-Content deployment-packages\*.sha256
```

脚本会构建 `linux/amd64` Backend、Frontend，拉取 PostgreSQL，并生成：

- 三镜像合并的 `nju-match-images-<commit>-linux-amd64.tar.gz`；
- 同一提交的 `nju-match-source-<commit>.zip`；
- SHA-256 校验文件；
- 含提交号、平台、镜像 ID 的 JSON manifest。
- 只含三个镜像标签的 `nju-match-images-<commit>.env`（不含凭据）。

本机重新加载验证可使用一个临时标签环境；不要删除仍在运行的正式镜像：

```powershell
docker image inspect nju-match-backend:<commit>
docker image inspect nju-match-frontend:<commit>
docker image inspect postgres:16-alpine
```

## 11. Ubuntu 更新后验收

先在上传目录校验并加载本次发布的离线镜像：

```bash
sha256sum -c nju-match-images-<commit>-linux-amd64.sha256
gzip -dc nju-match-images-<commit>-linux-amd64.tar.gz | docker load
```

将新源码同步到 `/opt/NJU-match-agent-transformation`，并将不含凭据的
`nju-match-images-<commit>.env` 三行追加到 `/etc/nju-match/runtime.env`，替换其中
旧的同名项。安装新 systemd unit 后执行：

```bash
git rev-parse --short HEAD
sudo systemctl restart nju-match.service
sudo systemctl status nju-match.service --no-pager -l
docker compose --env-file /etc/nju-match/runtime.env \
  -f NJU-Date-basic/docker-compose.yml \
  -f deploy/ubuntu/docker-compose.release.yml \
  -f deploy/ubuntu/docker-compose.credentials.yml ps
curl -fsS http://127.0.0.1:8082/health
curl -fsS https://match.invertedarena.com/health
```

随后在浏览器执行第 4–8 节。生产环境默认不得导入演示账号；如确需课程演示，先
完成数据库备份，并仅运行 `seedProjectBModules.js` 到专用演示数据库。验收结束后
检查：

```bash
sudo journalctl -u nju-match.service -n 200 --no-pager
docker logs nju-date-backend --tail 200
```

日志中不得出现 API Key、邀请码明文、JWT、联系方式或完整私密对话。

## 12. 清理本地测试环境

```powershell
cd C:\Users\X\桌面\AI4Coding\ai4coding-lab\NJU-Date-basic
docker compose --project-name nju-match-local --env-file .env.local-test down
```

需要连同本地测试数据删除时才使用 `down --volumes`。服务器更新和生产环境严禁
执行该参数。
