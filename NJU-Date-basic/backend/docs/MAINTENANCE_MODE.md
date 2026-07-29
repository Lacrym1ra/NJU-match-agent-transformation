# 维护模式切换教程

维护模式通过 Nginx 配置实现，修改服务器上的配置文件后重启容器即可生效。

---

## 开启维护模式

### 第一步：将维护页复制进容器

```bash
# 在项目根目录执行（只需执行一次，之后可跳过此步）
docker cp maintenance.html nju-date-frontend:/usr/share/nginx/html/maintenance.html
```

### 第二步：编辑服务器上的 nginx-ssl.conf

```bash
cd /path/to/project
nano nginx-ssl.conf   # 或 vim nginx-ssl.conf
```

找到维护模式开关区块，**取消下列两行注释**（删掉 `#`）：

```nginx
set $maintenance 1;
error_page 503 /maintenance.html;
```

**取消维护模式 location 区块的注释**：

```nginx
location / {
    if ($maintenance) { return 503; }
}
location = /maintenance.html {
    root /usr/share/nginx/html;
    internal;
}
```

同时**注释掉正常模式区块**中所有 location（在每行前加 `#`）。

### 第三步：验证配置并重启容器

```bash
# 先确认容器内的配置已更新
docker exec nju-date-frontend grep -n "maintenance" /etc/nginx/conf.d/default.conf

# 重启容器使配置生效
docker restart nju-date-frontend
```

### 第四步：确认生效

```bash
curl -I https://njumatch.com
# 应返回 HTTP/1.1 503
```

---

## 关闭维护模式（恢复正常）

### 第一步：编辑 nginx-ssl.conf

```bash
nano /path/to/project/nginx-ssl.conf
```

**重新注释掉**维护开关两行（加回 `#`）：

```nginx
# set $maintenance 1;
# error_page 503 /maintenance.html;
```

**重新注释掉**维护模式 location 区块，**取消注释**正常模式区块。

### 第二步：重启容器

```bash
docker restart nju-date-frontend
```

### 第三步：确认生效

```bash
curl -I https://njumatch.com
# 应返回 HTTP/1.1 200
```

---

## 快速参考

| 操作 | 命令 |
|------|------|
| 复制维护页进容器 | `docker cp maintenance.html nju-date-frontend:/usr/share/nginx/html/maintenance.html` |
| 验证容器内配置已更新 | `docker exec nju-date-frontend grep -n "maintenance" /etc/nginx/conf.d/default.conf` |
| 重启容器使配置生效 | `docker restart nju-date-frontend` |
| 确认返回状态码 | `curl -I https://njumatch.com` |
| 查看 nginx 日志 | `docker logs nju-date-frontend --tail 50` |
| 查看容器名称 | `docker ps` |

> **注意**：`nginx -s reload` 在某些情况下不能可靠地读取 volume 挂载的配置变更，推荐使用 `docker restart` 确保生效。restart 会有约 1-2 秒中断，维护期间影响可忽略。

---

## 如果想完全停止后端服务

维护模式下 Nginx 仍在运行，后端容器可以选择停止：

```bash
# 停止后端（可选）
docker compose stop backend

# 重新启动后端
docker compose start backend
```

维护页由 Nginx 直接返回，不依赖后端，停不停后端都不影响维护页显示。
