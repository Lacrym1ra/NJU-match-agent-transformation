# 后台权限与跨部门协作模型设计

> 状态：设计已定，尚未完整实现
> 目标：解决”跨部门如何有权限，但又不能发放 `admin_key`”的问题
>
> 部署层访问控制详见：`DEPLOY.md` → “管理后台访问架构”章节

## 0. 访问入口（部署层）

本文档负责**应用层**（后端 RBAC、账号、会话、权限点）。在到达应用层之前，还有两道部署层的隔离：

```
管理员
  │
  ├─ 1. 连接 WireGuard VPN（10.8.0.0/24）
  │       └── 未连 VPN → Nginx 返回 403，请求不会到达后端
  │
  ├─ 2. 访问 https://admin.njumatch.com（独立子域名，独立前端 build）
  │       └── admin 代码不存在于用户侧 njumatch.com 的 bundle 中
  │
  └─ 3. 后台账号登录（本文档负责的部分）
          └── 邮箱 + 密码 → 服务端验证角色 → 签发 admin session
                └── 每个接口按权限点（permission）校验具体能力
```

**普通用户**即使知道 `admin.njumatch.com` 的存在，因为没有 WireGuard 配置文件，DNS 解析到的 IP 返回的始终是 403。

---

## 1. 设计结论

一句话结论：

- **跨部门同学不应持有 `admin_key`**
- **`admin_key` 只保留给项目负责人 / 超级管理员作为应急与平台级控制手段**
- **宣传、客服、运维、版务等角色应通过后台账号 + 角色权限（RBAC）获得受限能力**

## 2. 当前实现现状

当前仓库中的后台鉴权方式是：

- 请求头：`X-Admin-Key`
- 后端统一中间件：`requireAdmin`
- 配置来源：`ADMIN_KEY`

这意味着当前后台属于“**单把万能钥匙**”模式，而不是“多角色、最小权限”模式。

当前模式适合：

- 项目负责人本人
- 极少数受信任核心同学
- 本地开发或演示阶段的临时后台

当前模式不适合：

- 宣传同学直接发公告
- 客服同学直接查用户状态
- 运维同学直接开维护模式
- 多人共享后台权限

## 3. 为什么不能把 `admin_key` 发给跨部门同学

如果把 `admin_key` 直接发出去，会有这些问题：

1. 拿到密钥的人几乎拥有全部后台权限
2. 无法天然区分“宣传只能发公告”“客服只能查状态”
3. 密钥容易在聊天、截图、浏览器存储中泄漏
4. 一旦泄漏，整套后台都可能被直接调用
5. 很难追踪具体是谁执行了某个操作

所以：**跨部门协作需要的是“受限权限”，不是“共享万能钥匙”。**

## 4. 目标模型

### 4.1 核心原则

1. 最小权限
2. 角色隔离
3. 高危操作二次确认
4. 所有后台动作可审计
5. 浏览器前端不暴露 `admin_key`

### 4.2 权限分层

后台权限建议分成三层：

| 层级 | 用途 | 谁能持有 |
|---|---|---|
| 平台主密钥层 | 平台初始化、应急兜底、超高危操作 | 项目负责人 |
| 后台账号层 | 宣传 / 客服 / 运维 / 版务等受限操作 | 授权成员 |
| 业务权限层 | 具体到“能看什么、能做什么” | 由角色决定 |

## 5. 角色设计

建议先定义这 6 类角色：

| 角色 | 说明 | 建议持有人 |
|---|---|---|
| `super_admin` | 平台最高权限，拥有所有能力 | 项目负责人 |
| `moderator` | 举报审核、论坛治理、内容管理 | 第三组治理同学 / 版务 |
| `marketing_operator` | 公告发布、活动广播、模板化消息任务 | 宣传同学 |
| `support_operator` | 脱敏查询用户状态、基础账号干预 | 客服 / 运营同学 |
| `ops_runner` | 维护模式、系统状态查看、运维执行 | 运维同学 |
| `analytics_viewer` | 查看统计、漏斗、看板，不做写操作 | 运营 / 观察角色 |

## 6. 权限点设计

建议不要只做“角色名判断”，而是落成**权限点**。

### 6.1 核心权限点

| 权限点 | 含义 |
|---|---|
| `reports.read` | 查看举报列表 |
| `reports.review` | 处理举报 |
| `forum.moderate` | 删帖、置顶、锁帖等治理操作 |
| `announcement.publish` | 发布站内公告 / 政策更新 |
| `campaign.send` | 触发模板化宣传邮件 / 批量消息 |
| `system.read` | 查看系统状态、任务状态 |
| `maintenance.toggle` | 开启 / 关闭维护模式 |
| `users.lookup_masked` | 查看脱敏用户状态 |
| `users.intervene_limited` | 执行基础受限干预 |
| `stats.read` | 查看统计与漏斗 |
| `match.trigger` | 触发匹配 |
| `reveal.unlock` | 解锁揭晓 |
| `db.query` | 执行数据库查询（高危） |
| `admin.impersonate` | 管理员模拟登录（高危） |

### 6.2 角色与权限矩阵

| 角色 | 权限 |
|---|---|
| `super_admin` | 全部权限 |
| `moderator` | `reports.read`、`reports.review`、`forum.moderate`、`stats.read` |
| `marketing_operator` | `announcement.publish`、`campaign.send`、`stats.read` |
| `support_operator` | `users.lookup_masked`、`users.intervene_limited`、`stats.read` |
| `ops_runner` | `system.read`、`maintenance.toggle` |
| `analytics_viewer` | `stats.read` |

明确禁止：

- `marketing_operator` 不能触发匹配
- `support_operator` 不能看问卷答案、联系方式、原始隐私数据
- `ops_runner` 不能看用户私密数据
- `moderator` 不能拿到系统级控制能力

## 7. 数据模型建议

建议新增这几张表：

### 7.1 `admin_accounts`

后台账号表。

建议字段：

- `id`
- `email`
- `password_hash`
- `display_name`
- `role`
- `is_active`
- `last_login_at`
- `created_at`
- `updated_at`

### 7.2 `admin_sessions`

后台会话表。

建议字段：

- `id`
- `admin_id`
- `token_hash`（access token 的哈希）
- `refresh_token_hash`（refresh token 的哈希，可为 null）
- `expires_at`（access token 过期时间，8 小时）
- `refresh_expires_at`（refresh token 过期时间，7 天）
- `created_at`
- `last_seen_at`
- `ip`
- `user_agent`
- `is_revoked`（是否已被强制下线，默认 false）

### 7.3 `admin_permission_overrides`

可选，用于少量临时覆盖默认角色权限（如临时给某人授予某项目特权）。

建议字段：

- `id`
- `admin_id`（被覆盖的账号）
- `permission`（权限点，如 `campaign.send`）
- `effect`（`allow` / `deny`）
- `reason`（必填，说明为何需要覆盖，强制记录）
- `expires_at`（必填，临时授权必须有过期时间，不允许永久覆盖）
- `created_by`（操作者的 `admin_id`，只有 `super_admin` 可写入此表）
- `created_at`

**说明：**

- 此表不允许无限期授权，`expires_at` 不得超过当前时间 30 天
- `super_admin` 调用专用接口管理此表，所有写操作写入审计日志
- 过期的覆盖条目由每日 Cron 清理，清理前记录软删除日志

**配套接口（仅 `super_admin` 可调用）：**

| 接口 | 功能 |
|---|---|
| `GET /api/v1/admin/permission-overrides` | 查看所有有效覆盖 |
| `POST /api/v1/admin/permission-overrides` | 新增临时覆盖 |
| `DELETE /api/v1/admin/permission-overrides/:id` | 提前撤销覆盖 |

### 7.4 审计日志复用

现有 `audit_logs` 继续保留，但建议补充：

- `actor_type`（`user` / `admin` / `system`）
- `actor_role`
- `target_type`

这样之后可以明确知道：

- 是哪个后台账号操作的
- 这个账号属于哪个角色

**审计日志必须包含的动作类型（扩展）：**

| action | 说明 |
|---|---|
| `admin_login` | 管理员登录 |
| `admin_login_failed` | 登录失败（含失败次数） |
| `admin_role_changed` | 角色变更（含变更前、变更后角色） |
| `admin_account_created` | 新建后台账号 |
| `admin_account_deactivated` | 停用后台账号 |
| `permission_override_added` | 新增临时权限覆盖 |
| `permission_override_revoked` | 撤销临时权限覆盖 |
| `review_report` | 处理举报（已有） |
| `request_evidence` | 要求补充材料（已有） |

**super_admin 自我约束规则：**

`super_admin` 对以下操作有额外限制：

1. `super_admin` 不能修改或删除自身的审计日志记录（审计表对所有角色只读，不提供删除接口）
2. `super_admin` 执行 `db.query` 和 `admin.impersonate` 操作时，强制写入审计日志，且操作结果摘要（如查询语句、被模拟用户 ID）也一并记录
3. 如果系统只有一个 `super_admin`，建议将关键操作的审计日志异步同步到外部渠道（如项目邮箱），作为独立备份

## 8. 鉴权流程设计

### 8.1 后台登录

建议新增后台登录流程：

1. 后台账号访问 `/admin/login`
2. 使用邮箱 + 密码登录（密码需满足最低复杂度要求）
3. 服务端查 `admin_accounts` 验证凭据，写入 `admin_sessions`（存 `token_hash`）
4. 浏览器存储为 **HttpOnly + SameSite=Strict Cookie**，不暴露给 JavaScript

**会话模型选型（确定为有状态 session，不使用 JWT）：**

- 采用服务端 session 方案：每次请求查 `admin_sessions` 表验证 `token_hash`
- 不使用 JWT（无状态 token）：JWT 一旦签发无法主动撤销，不适合管理后台（需要即时踢出用户、session 强制下线等能力）
- Access token 有效期：8 小时；管理员每次操作自动续期（滑动过期）
- Refresh token：额外签发一个 refresh token（有效期 7 天，同样 HttpOnly Cookie），access token 过期后静默刷新，不打断操作

**安全措施：**

- 登录失败连续 5 次锁定账号 30 分钟，并发送告警邮件给项目负责人
- 会话绑定 IP 前缀（/24 段）和 User-Agent，变化时强制重新登录
- 管理端登录页与普通用户登录页完全分离，不共享路由和 session

建议优先：

- **后台单独登录**
- **后台单独 session**
- **与普通用户 JWT 分离**

不要复用普通用户 token 直接做管理员操作。

### 8.2 后台接口校验

建议新增中间件：

- `requireAdminSession`
- `requirePermission('announcement.publish')`

执行顺序：

1. 先校验后台是否已登录
2. 再校验是否拥有对应权限点
3. 最后记录审计日志

## 9. `admin_key` 的最终定位

在新模型下，`admin_key` 不删除，但定位应改为：

1. **仅项目负责人持有**
2. 用于平台初始化 / 应急兜底
3. 不给跨部门同学
4. 不进入浏览器前端
5. 不作为日常跨部门协作的主要鉴权方式

建议它只保留给这类高危能力：

- 初始创建后台超级管理员
- 极端情况下的应急开关
- 本地开发或封闭演示环境调试

## 10. 账号安全基线要求

### 10.1 密码要求

- 最小长度 12 位
- 必须包含大小写字母、数字、特殊字符
- 不允许与用户侧账号共用同一密码
- 每 90 天强制更换

### 10.2 二次验证（2FA）

- `super_admin` 账号：**强制开启 TOTP 2FA**（如 Google Authenticator）
- 其他角色：**强烈建议开启**，可配置为"登录时可选"或"新设备登录时必须"
- 实现路径：MVP 阶段可先在后台登录流程中预留 2FA 字段（`admin_accounts.totp_secret`），暂不强制，Phase C 后强制

### 10.3 登录安全

- 连续 5 次登录失败：锁定账号 30 分钟，向项目负责人邮箱发送告警
- 新 IP 登录成功：向账号绑定邮箱发送登录通知
- 强制下线：`super_admin` 可通过管理端将任意 session 标记为 `is_revoked = true`，即时生效

## 11. 高危操作附加规则

以下操作建议要求二次确认：

1. 维护模式开关
2. 批量广播
3. 触发匹配
4. 解锁揭晓
5. 管理员模拟登录
6. 受限账号干预

二次确认可选方式：

- 前端确认弹窗
- 重新输入密码
- 再次输入操作原因

## 12. 与跨部门协作的对应关系

### 宣传部门

应该拥有：

- 公告发布
- 活动广播
- 模板任务查看

不应该拥有：

- 用户详情查看
- 匹配触发
- 数据库查询

### 客服 / 运营

应该拥有：

- 脱敏状态查询
- 有限账号干预

不应该拥有：

- 问卷原始答案查看
- 联系方式查看
- 系统级控制

### 运维

应该拥有：

- 系统状态查看
- 维护模式切换

不应该拥有：

- 用户隐私数据查看
- 宣传广播

### 版务 / 治理

应该拥有：

- 举报审核
- 论坛治理

不应该拥有：

- 系统级控制
- 营销广播

## 13. 推荐落地顺序

为了不一次改太大，建议分三步：

### Phase A：当前阶段

- `admin_key` 只由项目负责人持有
- 跨部门操作先由项目负责人代执行
- 文档明确“不向跨部门同学分发 `admin_key`”

### Phase B：最小 RBAC

- 新增 `admin_accounts`
- 后台登录
- 至少实现 4 类角色：
  - `super_admin`
  - `marketing_operator`
  - `support_operator`
  - `ops_runner`
- 关键后台接口改成 `requireAdminSession + requirePermission`

### Phase C：完整后台治理

- 权限点细化
- 二次确认
- 更完整审计
- 高危操作复核机制

## 14. 对当前项目的直接建议

如果只给一句执行建议：

- **现在不要把 `admin_key` 发给任何跨部门同学**
- **当前跨部门能力先由第三组开发，项目负责人执行**
- **后续如果时间够，再升级到后台账号 + 角色权限系统**

这样最符合你当前的目标：

- 你仍然保留最高权限
- 别人可以在受限范围内协作
- 不会因为共享密钥把整套后台暴露出去
