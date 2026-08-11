# Ubuntu 生产凭据部署

此方案使用 systemd encrypted credentials。API Key 由 `systemd-creds` 加密保存，
服务启动时只在 `/run/credentials/...` 的内存文件系统中短暂解密，再以只读
文件挂载进后端容器。Key 不写入 Git、镜像、Compose、命令行或常规环境变量。

## 前提

- Ubuntu 22.04 或更新版本；
- systemd 支持 `LoadCredentialEncrypted` 和 `systemd-creds`；
- Docker Engine 与 Compose Plugin；
- 仓库安装于 `/opt/NJU-match-agent-transformation`；
- `/etc/nju-match/runtime.env` 只保存其他运行配置，权限必须为 `0600`。
- 已用 Windows 导出脚本生成并上传三个 `linux/amd64` 镜像的离线包。

如果仓库位于其他路径，先修改 `nju-match.service` 的 `WorkingDirectory`。

## 安装

```bash
sudo install -d -m 0700 /etc/nju-match
sudo install -m 0600 NJU-Date-basic/.env.example /etc/nju-match/runtime.env
sudo editor /etc/nju-match/runtime.env

sudo bash deploy/ubuntu/manage-llm-credential.sh set
sudo install -m 0644 deploy/ubuntu/nju-match.service /etc/systemd/system/nju-match.service
sudo systemctl daemon-reload
sudo systemctl enable --now nju-match.service
```

导出包中的 `nju-match-images-<commit>.env` 不含凭据，它把本次发布绑定到
确切镜像标签。校验上传文件并执行 `docker load` 后，将其合并到
`runtime.env`：

```bash
sha256sum -c nju-match-images-<commit>-linux-amd64.sha256
gzip -dc nju-match-images-<commit>-linux-amd64.tar.gz | docker load
sudo sed -i '/^BACKEND_IMAGE=/d;/^FRONTEND_IMAGE=/d;/^POSTGRES_IMAGE=/d' \
  /etc/nju-match/runtime.env
cat nju-match-images-<commit>.env | sudo tee -a /etc/nju-match/runtime.env >/dev/null
sudo chmod 0600 /etc/nju-match/runtime.env
```

`docker-compose.release.yml` 与 systemd unit 强制 `pull_policy: never` 和
`--no-build --pull never`，因此启动期间不会访问 Docker Hub，也不会把服务器
上的未验证构建冒充本次发布镜像。

在 `runtime.env` 中必须保持 `LLM_API_KEY` 和 `LLM_API_KEY_FILE` 未设置；
systemd unit 会提供唯一的文件来源。不要把真实值保存在项目 `.env`。

## 状态、更新与清除

```bash
sudo bash deploy/ubuntu/manage-llm-credential.sh status
sudo bash deploy/ubuntu/manage-llm-credential.sh update
sudo bash deploy/ubuntu/manage-llm-credential.sh clear
```

`status` 只报告是否已配置，不解密、不回显。`update` 使用隐藏输入并原子替换
加密文件。`clear` 需要人工确认，删除凭据后停止服务，防止应用无 Key 继续运行。

## 验证

```bash
sudo systemctl status nju-match.service
sudo docker compose --env-file /etc/nju-match/runtime.env \
  -f NJU-Date-basic/docker-compose.yml \
  -f deploy/ubuntu/docker-compose.release.yml \
  -f deploy/ubuntu/docker-compose.credentials.yml ps
curl --fail http://127.0.0.1:8082/health
```

不得使用 `systemctl show`、`docker inspect` 或日志来输出 Key。备份
`/etc/credstore.encrypted` 前应理解 systemd 凭据与主机密钥/TPM 的绑定方式；
跨主机迁移应在目标机重新安全录入，而不是复制明文。
