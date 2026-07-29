# NJU Date 部署文档

> 文档状态：active
>
> 本文档是生产/测试环境部署的权威执行手册。
>
> 若与其他文档存在冲突，以本文档为准。

## 架构概览

```
用户浏览器
    │
    ▼ :80 / :443
┌─────────────────────┐
│  frontend (Nginx)   │  静态文件 + 反向代理
│  /api/* → backend   │
└────────┬────────────┘
         │ :3000 (内部)
┌────────▼────────────┐
│  backend (Node.js)  │  Express API
└────────┬────────────┘
         │ :5432 (内部)
┌────────▼────────────┐
│  postgres           │  PostgreSQL 16
└─────────────────────┘
```

三个容器通过 Docker 内部网络通信，仅前端的 80 端口对外暴露。

---

## 环境要求

- Linux 服务器（推荐 Ubuntu 22.04 / CentOS 8+）
- Docker Engine 24+
- Docker Compose V2（`docker compose` 命令）
- 最低配置：2 核 CPU / 2GB 内存 / 20GB 磁盘

### 安装 Docker（如未安装）

```bash
# Ubuntu
curl -fsSL https://get.docker.com | sh
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
# 重新登录使 docker 组生效
```

---

## 部署步骤

### 1. 克隆项目

```bash
git clone <你的仓库地址>
cd NJU-Date
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，填入真实值：

```bash
vim .env
```

**必须修改的配置：**

| 变量 | 说明 |
|------|------|
| `JWT_SECRET` | 随机字符串，用于签发 JWT token，建议 32 位以上 |
| `ADMIN_KEY` | 管理接口密钥 |
| `POSTGRES_PASSWORD` | 数据库密码，请使用强密码 |
| `ALIYUN_DM_ACCESS_KEY_ID` | 阿里云 AccessKey ID（需开通邮件推送服务） |
| `ALIYUN_DM_ACCESS_KEY_SECRET` | 阿里云 AccessKey Secret |
| `ALIYUN_DM_ACCOUNT_NAME` | 邮件推送控制台中配置的发信地址，如 `no-reply@yourdomain.com` |
| `ALIYUN_DM_REGION` | 服务地域，默认 `cn-hangzhou` |
| `ALIYUN_DM_FROM_ALIAS` | 发件人显示名，默认 `NJU Date` |
| `DASHSCOPE_API_KEY` | 通义千问 DashScope API 密钥（用于生成馆长私语，留空则使用模板文案） |
| `FRONTEND_URLS` | 你的域名，如 `https://yourdomain.com` |
| `MAINTENANCE_ALERT_TO` | 维护模式 watchdog 告警收件邮箱 |
| `BACKEND_WATCHDOG_FAILURE_THRESHOLD` | 连续失败多少次后自动开启维护模式，默认 `3` |

生成随机密钥的快捷方式：

```bash
openssl rand -hex 32  # 生成 JWT_SECRET
openssl rand -hex 16  # 生成 ADMIN_KEY
openssl rand -base64 24  # 生成 POSTGRES_PASSWORD
```

### 3. 构建并启动

```bash
docker compose up -d --build
```

首次启动会构建镜像，约 2-5 分钟。启动后检查状态：

```bash
docker compose ps
```

三个容器都应显示 `running (healthy)` 或 `running`。

### 4. 初始化数据库

```bash
docker compose exec backend npm run seed
```

### 5. 验证部署

```bash
# 检查三个容器是否都在运行
docker compose ps

# 检查后端健康状态
curl http://localhost/health
# 预期返回：{"status":"ok","timestamp":"..."}

# 检查 API 可访问
curl http://localhost/api/v1/stats
# 预期返回：{"totalUsers":0,"surveyCompletionRate":0,"successfulMatches":0}

# 检查前端页面
curl -I http://localhost
# 预期返回：HTTP/1.1 200 OK
```

浏览器访问 `http://你的服务器IP` 应能看到登录页面。

**功能冒烟测试：**

1. 注册账号（填 `@smail.nju.edu.cn` 邮箱），确认 OTP 邮件能收到
2. 登录后完成档案填写
3. 提交问卷
4. 管理员接口可用：`curl -H "X-Admin-Key: 你的ADMIN_KEY" http://localhost/api/v1/admin/trigger-matching`

---

## 日常更新部署

每次修改代码后，按以下流程更新线上版本。

### 方式一：本地 Build → 传服务器运行（推荐，节省服务器资源）

**本地执行（在项目根目录）：**

```bash
# 1. 提交代码
git add .
git commit -m "你的提交信息"
git push

# 2. 构建镜像
docker compose build

# 3. 导出镜像为文件
docker save nju-date-frontend -o nju-date-frontend.tar
docker save nju-date-backend -o nju-date-backend.tar

# 4. 上传到服务器
scp nju-date-frontend.tar nju-date-backend.tar root@8.217.168.171:~/workspace/NJU-Date/
```

**服务器执行：**

```bash
cd ~/workspace/NJU-Date

# 5. 载入镜像
docker load -i nju-date-frontend.tar
docker load -i nju-date-backend.tar

# 6. 重启服务（不重新 build，直接用刚载入的镜像）
docker compose up -d --no-build

# 7. 确认运行正常
docker compose ps
curl -I https://njumatch.com

# 8. 清理 tar 文件（可选）
rm nju-date-frontend.tar nju-date-backend.tar
```

---

### 方式二：服务器上直接 Build（简单，但占服务器资源）

```bash
# SSH 登录服务器
ssh root@8.217.168.171
cd ~/workspace/NJU-Date

git pull
docker compose up -d --build
```

---

### 仅更新配置（无需重新 Build）

如果只改了 `.env` 或 `nginx-ssl.conf`，无需重新构建镜像：

```bash
# 只改了 .env → 重启后端
docker compose up -d backend

# 只改了 nginx-ssl.conf → 重启前端
docker restart nju-date-frontend

# 两者都改了
docker compose up -d backend
docker restart nju-date-frontend
```

---

## 常用运维命令

```bash
# 查看所有容器状态
docker compose ps

# 查看日志
docker compose logs -f              # 所有服务
docker compose logs -f backend      # 仅后端
docker compose logs -f --tail=100   # 最近 100 行

# 重启服务
docker compose restart backend

# 更新部署（拉取新代码后）
git pull
docker compose up -d --build

# 停止所有服务
docker compose down

# 停止并清除数据（慎用！会删除数据库）
docker compose down -v

# admin
ssh -L 8080:localhost:443 root@njumatch.com
#访问：https://localhost:8080/admin
```

---

## 管理后台访问架构

> **状态**：设计已定，尚未实现（当前过渡方案见末尾）
>
> 权限模型详见：`design_docs/ADMIN_PERMISSION_MODEL.md`

### 设计目标

1. 管理后台代码**完全不出现**在普通用户的前端 bundle 里
2. 管理员**无需 SSH 到服务器**即可访问后台
3. 不同角色（宣传/客服/运维/版务）通过 RBAC 获得受限权限，而不是共享一个 `admin_key`

### 架构全景

```
公网（所有人可访问）
─────────────────────────────────────────────
  njumatch.com ──► frontend 容器
                   └── user build（无任何 admin 代码）
                   └── /api/* → backend :3000



WireGuard VPN 内网 10.8.0.0/24（仅管理员可访问）
─────────────────────────────────────────────
  admin.njumatch.com ──► admin-frontend 容器
                         └── admin build（独立打包）
                         └── /api/v1/admin/* → backend :3000
                                               └── RBAC 校验角色权限
```

三道隔离：

| 层级 | 隔离手段 | 效果 |
|---|---|---|
| 代码层 | 两套独立 Vite build | 用户 bundle 里字面上没有 admin 路由代码 |
| 网络层 | WireGuard VPN + Nginx IP 白名单 | 不连 VPN 则 `admin.njumatch.com` 返回 403 |
| 权限层 | 后端 RBAC（`admin_sessions` + 权限点校验） | 连上 VPN 后仍需后台账号登录，不同角色看到不同功能 |

---

### 第一步：DNS 配置（阿里云）

> 你拥有 `njumatch.com` 就自动拥有所有子域名，无需额外购买，只需在阿里云 DNS 控制台添加一条记录。

登录阿里云 DNS 控制台，在 `njumatch.com` 下新增：

| 记录类型 | 主机记录 | 记录值 | TTL |
|---|---|---|---|
| A | `admin` | `<服务器公网 IP>` | 600 |

完成后 `admin.njumatch.com` 和 `njumatch.com` 指向同一台服务器，由 nginx 在服务端区分流量。

---

### 第二步：WireGuard VPN

管理员通过 WireGuard 连入 `10.8.0.0/24` 内网，nginx 对 `admin.njumatch.com` 只放行来自该网段的请求。

**服务器安装：**

```bash
apt update && apt install -y wireguard
wg genkey | tee /etc/wireguard/server_private.key | wg pubkey > /etc/wireguard/server_public.key
chmod 600 /etc/wireguard/server_private.key
```

创建 `/etc/wireguard/wg0.conf`：

```ini
[Interface]
PrivateKey = <cat /etc/wireguard/server_private.key>
Address    = 10.8.0.1/24
ListenPort = 51820
PostUp   = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

# ── 管理员列表，每人一个 [Peer] ──────────────────────
# 项目负责人（super_admin）
[Peer]
PublicKey  = <管理员A公钥>
AllowedIPs = 10.8.0.2/32

# 运维同学（ops_runner）—— Phase B 落地后添加
[Peer]
PublicKey  = <管理员B公钥>
AllowedIPs = 10.8.0.3/32

# 宣传同学（marketing_operator）—— Phase B 落地后添加
[Peer]
PublicKey  = <管理员C公钥>
AllowedIPs = 10.8.0.4/32
```

```bash
systemctl enable --now wg-quick@wg0
ufw allow 51820/udp
wg show   # 验证启动正常
```

**为每个管理员生成配置（每人执行一次）：**

```bash
wg genkey | tee /tmp/peer_private.key | wg pubkey > /tmp/peer_public.key
# 把 peer_public.key 的内容填入 wg0.conf 对应 [Peer] 的 PublicKey
# 把生成的配置文件通过安全渠道发给管理员（微信私聊、加密邮件等，不要发群）
```

**管理员客户端配置文件**（保存为 `njumatch-admin.conf`）：

```ini
[Interface]
PrivateKey = <peer_private.key 的内容>
Address    = 10.8.0.2/32   # 每人分配不同 IP，见上方 wg0.conf
DNS        = 1.1.1.1

[Peer]
PublicKey          = <cat /etc/wireguard/server_public.key>
Endpoint           = njumatch.com:51820
AllowedIPs         = 10.8.0.0/24   # 只有 VPN 内网走隧道，其他流量不受影响
PersistentKeepalive = 25
```

管理员在 [wireguard.com/install](https://www.wireguard.com/install/) 下载客户端（支持 Windows / macOS / iOS / Android），导入 `.conf` 文件，点击连接即可。

**撤销某管理员访问（热更新，不中断其他人）：**

```bash
vim /etc/wireguard/wg0.conf        # 删除对应 [Peer] 块
wg syncconf wg0 <(wg-quick strip wg0)   # 秒级生效，无需重启 VPN
```

---

### 第三步：独立 admin-frontend 容器

> **暂未实现**。当前 admin 仍在 frontend 容器内，以 nginx IP 白名单临时隔离。
> 实现时需要：前端拆两个 Vite build + Docker Compose 新增 `admin-frontend` service。

**最终目标架构（docker-compose.yml 示意）：**

```yaml
services:
  frontend:          # 用户侧，对公网开放
    build:
      context: ./frontend
      args:
        BUILD_TARGET: user     # vite build --mode user
    ports:
      - "80:80"
      - "443:443"

  admin-frontend:    # 管理侧，仅绑定内网
    build:
      context: ./frontend
      args:
        BUILD_TARGET: admin    # vite build --mode admin
    ports:
      - "10.8.0.1:443:443"    # 只监听 WireGuard 接口，公网无法访问
    # 独立 nginx 配置：server_name admin.njumatch.com
```

**用户侧 nginx（`nginx-ssl.conf`，当前文件）关键点：**

```nginx
server {
    server_name njumatch.com;
    # 完全没有 /admin location 块
    # admin 代码不在这个容器里，不需要拒绝，根本不存在
}
```

**管理侧 nginx（`nginx-admin.conf`，待创建）关键点：**

```nginx
server {
    listen      443 ssl;
    server_name admin.njumatch.com;

    # VPN IP 白名单——双重保险（容器已只绑 WireGuard 接口）
    allow 10.8.0.0/24;
    deny  all;

    root /usr/share/nginx/html/admin;   # admin build 产物
    location / {
        try_files $uri $uri/ /index.html;
    }
    location /api/ {
        proxy_pass http://backend:3000;
    }
}
```

---

### 当前过渡方案（Phase A，RBAC 尚未落地）

在独立 admin 容器未实现之前，临时方案：

- `admin.njumatch.com` DNS 记录已加（同服务器 IP）
- 用户侧 nginx 对 `/admin` 加 `allow 10.8.0.0/24; deny all`（admin 代码仍在同一 bundle，但公网访问被拦截）
- 仅项目负责人持有 WireGuard 配置文件
- 跨部门操作由项目负责人代执行

过渡方案的局限：admin 代码仍打包在用户 bundle 里（虽然路由被 nginx 拦截，但代码可被 inspect 看到）。**这是已知的临时妥协，Phase B 落地时需彻底拆分。**

---

### 日常访问流程（目标态）

| 角色 | 操作 |
|---|---|
| 项目负责人（`super_admin`） | 开启 WireGuard → 访问 `https://admin.njumatch.com` → 后台账号登录 |
| 宣传/客服/运维同学（Phase B 后） | 开启 WireGuard → 访问 `https://admin.njumatch.com` → 各自受限角色账号登录 |
| 普通用户 | 无 WireGuard，`admin.njumatch.com` 返回 403，用户侧 bundle 无 admin 代码 |

### 一键维护模式（不依赖后端）

维护模式由前端 Nginx 直接处理，不经过后端。开启后，站点页面、健康检查和 `/api/*` 都会返回静态维护页，适合后端故障、数据库维护或发布窗口使用。

首次部署此能力或更新 `docker-compose.yml` / `nginx-ssl.conf` 后，先让前端容器应用新的挂载配置：

```bash
cd ~/workspace/NJU-Date
docker compose up -d frontend
```

日常开关：

```bash
# 开启维护
sh scripts/maintenance.sh on

# 查看状态
sh scripts/maintenance.sh status

# 关闭维护
sh scripts/maintenance.sh off
```

维护页内容来自仓库根目录的 `maintenance.html`。由于它以只读方式挂载进前端容器，修改文案后通常无需重新构建镜像。

如果执行 `sh scripts/maintenance.sh on` 时看到 `host not found in upstream "backend"`，说明前端容器仍在使用旧版 nginx 配置。先拉取包含 Docker DNS 延迟解析的新版 `nginx-ssl.conf`，再重启前端容器：

```bash
git pull
docker restart nju-date-frontend
sh scripts/maintenance.sh status
```

脚本会先创建 `ops/maintenance/enabled` 再检查 nginx 配置，所以即使命令最后失败，也可以先用 `sh scripts/maintenance.sh status` 确认维护模式是否已经打开。

如果从 Windows 用 `scp` 上传脚本后看到 `set: Illegal option -`，通常是 `.sh` 文件被 CRLF 换行污染了。服务器上执行一次：

```bash
sed -i 's/\r$//' scripts/*.sh
chmod +x scripts/*.sh
```

### 后端故障自动维护与邮件告警

watchdog 在宿主机上运行，不依赖正在运行的后端。它会检查 `nju-date-backend` 容器和容器内 `http://127.0.0.1:3000/health`；连续失败达到阈值后，会创建 `ops/maintenance/enabled`，由前端 Nginx 直接展示维护页。

告警邮件通过阿里云 DirectMail API 发送，只复用仓库根目录 `.env` 中的 `ALIYUN_DM_*` 配置，不走 SMTP，也不调用后端接口。请先在根目录 `.env` 中配置：

```bash
MAINTENANCE_ALERT_TO=你的邮箱@example.com
BACKEND_WATCHDOG_FAILURE_THRESHOLD=3
```

手动试跑一次：

```bash
cd ~/workspace/NJU-Date
sh scripts/backend-watchdog.sh
```

启用 systemd 定时检查：

```bash
cp ops/systemd/nju-maintenance-watchdog.service /etc/systemd/system/
cp ops/systemd/nju-maintenance-watchdog.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now nju-maintenance-watchdog.timer
systemctl status nju-maintenance-watchdog.timer
```

查看最近运行日志：

```bash
journalctl -u nju-maintenance-watchdog.service -n 80 --no-pager
```

如果维护模式是 watchdog 自动开启的，后端恢复后它会自动关闭维护模式；如果是 `sh scripts/maintenance.sh on` 手动开启的，watchdog 不会自动关闭。

---

## 数据库备份与恢复

### 备份

```bash
docker compose exec postgres pg_dump -U postgres nju_date > backup_$(date +%Y%m%d).sql
```

### 恢复

```bash
docker compose exec -T postgres psql -U postgres nju_date < backup_20260327.sql
```

### 定时自动备份（可选）

```bash
# 添加 crontab，每天凌晨 3 点备份
crontab -e
```

加入以下内容：

```
0 3 * * * cd /path/to/NJU-Date && docker compose exec -T postgres pg_dump -U postgres nju_date | gzip > /path/to/backups/nju_date_$(date +\%Y\%m\%d).sql.gz && find /path/to/backups -maxdepth 1 -type f -name 'nju_date_????????.sql.gz' -mtime +6 -delete
```

说明：

- `-mtime +6` 表示删除 7 天前的备份，因此最终会保留最近 7 天
- `nju_date_????????.sql.gz` 只匹配 `nju_date_20260421.sql.gz` 这种 8 位日期文件，不会误删 `nju_date_test.sql.gz`

---

## 配置 HTTPS（推荐）

上线后强烈建议配置 HTTPS。最简单的方式是在服务器上安装 Caddy 作为反向代理：

### 方式一：Caddy（最简单）

```bash
# 安装 Caddy
sudo apt install -y caddy
```

编辑 `/etc/caddy/Caddyfile`：

```
yourdomain.com {
    reverse_proxy localhost:80
}
```

```bash
sudo systemctl restart caddy
```

Caddy 会自动申请和续期 Let's Encrypt 证书。

### 方式二：Nginx + Certbot

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

配置 Nginx `/etc/nginx/sites-available/nju-date`：

```nginx
server {
    server_name yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/nju-date /etc/nginx/sites-enabled/
sudo certbot --nginx -d yourdomain.com
sudo systemctl restart nginx
```

配置好 HTTPS 后，记得更新 `.env`：

```
FRONTEND_URLS=https://yourdomain.com
```

然后重启后端：

```bash
docker compose restart backend
```

---

## 阿里云安全组配置

在阿里云 ECS 控制台的安全组中，确保开放以下端口：

| 端口 | 用途 |
|------|------|
| 22   | SSH |
| 80   | HTTP |
| 443  | HTTPS（如配置了） |

**不要** 开放 5432（数据库）和 3000（后端），它们只在 Docker 内部网络使用。

---

## 故障排查

| 问题 | 排查方式 |
|------|---------|
| 页面打不开 | `docker compose ps` 检查容器是否运行；检查安全组 80 端口 |
| API 报错 | `docker compose logs backend` 查看后端日志 |
| 数据库连接失败 | `docker compose logs postgres` 检查数据库是否健康启动 |
| 邮件发不出去 | 检查 `ALIYUN_DM_ACCESS_KEY_ID` / `SECRET` 是否正确；`ALIYUN_DM_ACCOUNT_NAME` 必须与邮件推送控制台中的发信地址完全一致；确认该发信地址已通过域名验证并处于启用状态 |
| 构建失败 | 确认服务器内存 >= 2GB；`docker compose build --no-cache` 重试 |
