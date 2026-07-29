# Docker Quick Start

> 文档状态：active（快捷入口）
>
> 完整部署流程、生产注意事项与运维命令请查看 `DEPLOY.md`。

## 本地快速启动

在项目根目录执行：

```bash
docker compose up -d --build
```

## 停止服务

```bash
docker compose down
```

若要同时删除数据库卷：

```bash
docker compose down -v
```

## 常用日志命令

```bash
docker compose logs -f postgres
docker compose logs -f backend
docker compose logs -f frontend
```

## 默认数据库（仅本地开发）

- DB: `nju_date`
- User: `postgres`
- Password: `postgres`

Docker 内部网络连接串：

`postgres://postgres:postgres@postgres:5432/nju_date`

## 说明

- 本文件仅保留开发阶段的快速命令。
- 线上部署、密钥配置、备份恢复与更新发布，请使用 `DEPLOY.md`。
- 生产环境必须替换数据库密码与相关密钥，请勿沿用上述默认值。
