# NJU Match - 核心功能与接口规划参考 (API & Functional Spec)

本文档基于业务阶段，拆解了系统后端核心功能模块，并提供接口文档（API Reference）参考。详细参数见 `backend/docs/API_REFERENCE.md`。

多人协作时，接口边界与“已实现 / 设计已定”状态请优先参考：

- 三组统一入口：`docs/GROUP_API_GUIDE.md`
- 第一组站内消息设计：`docs/MESSAGE_CENTER_DESIGN.md`
- 第二组专用：`docs/CIRCLE_API.md`
- 第三组专用：`docs/FORUM_GOVERNANCE_API.md`

---

## 1. 身份认证模块 (Auth)
**核心功能**：确保只有南大在校学生可以注册（`@smail.nju.edu.cn` 邮箱），支持密码登录与 OTP 验证码。

- `POST /api/v1/auth/send-code`
  - **功能**：发送 OTP 验证码（注册用）。
  - **参数**：`email`（必须匹配 `*@smail.nju.edu.cn`）。
  - **逻辑**：60s 内只能发一次，OTP 存入数据库，5 分钟过期。
- `POST /api/v1/auth/register`
  - **功能**：使用验证码注册账号并设置密码。
  - **参数**：`email`, `code`, `password`
  - **返回**：JWT Token，`isNewUser: true`。
- `POST /api/v1/auth/login`
  - **功能**：账号密码登录。
  - **参数**：`email`, `password`
  - **返回**：JWT Token，`isNewUser: false`。
- `POST /api/v1/auth/forgot-password/send-code`
  - **功能**：发送密码重置验证码。
  - **逻辑**：对邮箱是否存在返回统一提示，防止账号枚举。
- `POST /api/v1/auth/forgot-password/reset`
  - **功能**：使用验证码重置密码。
  - **参数**：`email`, `code`, `newPassword`

## 2. 档案与状态模块 (User & Profile)
**核心功能**：管理用户基本信息、匹配参与状态、邮件通知设置。

- `GET /api/v1/user/profile`
  - **功能**：获取当前用户档案。
- `PUT /api/v1/user/profile`
  - **功能**：创建或更新完整档案（昵称、年级、校区、MBTI、自我介绍、联系方式）。
  - 提交成功后 `profileComplete` 设为 `true`。
- `PATCH /api/v1/user/profile/draft`
  - **功能**：静默保存 Onboarding 草稿，不改变 `profileComplete`。
- `PATCH /api/v1/user/status`
  - **功能**：切换本周参与匹配状态（`isParticipating`）。
  - **限制**：周三 18:00 – 周日 23:59 北京时间锁定，无法修改。
- `PATCH /api/v1/user/pause-week`
  - **功能**：暂停/恢复本周匹配（下周自动恢复）。
  - **参数**：`pause` (Boolean)。
  - **限制**：周三 18:00 – 周日 23:59 北京时间锁定，无法修改。
- `PATCH /api/v1/user/notifications`
  - **功能**：切换邮件通知开关（`emailNotifications`）。
  - **参数**：`emailNotifications` (Boolean)，默认 `true`。
  - **说明**：这是邮件提醒偏好接口，不是站内消息中心接口。
- `DELETE /api/v1/user/account`
  - **功能**：注销账户（PII 匿名化处理，保留匹配记录用于算法完整性）。
  - **逻辑**：邮箱置为占位值，清除所有个人资料字段，删除邮件日志和拉黑记录，停用圈子成员身份，问卷数据匿名保留。
- `POST /api/v1/user/block/:targetId`
  - **功能**：拉黑指定用户。
  - **参数**：路径参数 `targetId`。
  - **限制**：不能拉黑自己，目标用户必须存在。
- `DELETE /api/v1/user/block/:targetId`
  - **功能**：解除对指定用户的拉黑。
- `POST /api/v1/user/report/:targetId`
  - **功能**：举报指定用户。
  - **参数**：`reason` (enum: `harassment | spam | fake_profile | inappropriate_content | other`)，`detail` (可选，最多 500 字)。
  - **限制**：不能举报自己，目标用户必须存在。

## 3. 灵魂问卷模块 (Survey)
**核心功能**：获取题目，保存用户的爱情观/三观选择，作为匹配算法特征输入。

- `GET /api/v1/survey/questions`
  - **功能**：拉取完整问卷题库（无需登录）。
- `POST /api/v1/survey/submit`
  - **功能**：提交或覆盖问卷结果。
  - **限制**：周三 18:00 – 周日 23:59 北京时间锁定，无法提交。
- `GET /api/v1/survey/answers`
  - **功能**：获取当前用户已提交的答案（用于回显/修改）。

## 4. 锦书与匹配模块 (Match & Reveal)
**核心功能**：倒计时状态机控制、周三晚拆信封、决定是否交换联系方式。

- `GET /api/v1/match/current`
  - **状态返回逻辑**：
    - `PENDING` — 匹配算法未跑或结果未揭晓，返回倒计时
    - `NO_MATCH` — 本周未匹配到
    - `REVEALED` — 已揭晓，返回匿名契合度报告与对方脱敏档案
    - `EXPIRED` — 48 小时选择窗口已结束，仍返回该期脱敏档案但不再允许操作
- `POST /api/v1/match/action`
  - **功能**：对本周 `REVEALED` 匹配做出选择（`ACCEPT` / `REJECT`）；已过期后拒绝操作。
- `GET /api/v1/match/result/:matchId`
  - **功能**：查询双选结果；双方 ACCEPT 时返回联系方式，超时则返回 `EXPIRED`。
- `GET /api/v1/match/history`
  - **功能**：分页获取历史匹配记录。

## 4.1 站内消息模块 (Notifications & Inbox) `设计已定`
**核心功能**：为用户提供统一的站内消息入口，集中查看匹配揭晓、问卷更新、政策更新、系统公告等提醒。详细边界见 `docs/MESSAGE_CENTER_DESIGN.md`。**

- `GET /api/v1/notifications`
  - **功能**：分页获取当前用户的站内消息列表。
  - **参数**：`page`, `limit`, `status=all|unread|read`
- `GET /api/v1/notifications/unread-count`
  - **功能**：获取当前用户未读消息数。
- `POST /api/v1/notifications/:id/read`
  - **功能**：将单条消息标记为已读。
- `POST /api/v1/notifications/read-all`
  - **功能**：将当前用户全部未读消息标记为已读。
- **第一阶段消息类型建议**：
  - `match_revealed`
  - `match_no_result`
  - `match_mutual_success`
  - `match_expiring`
  - `survey_update_required`
  - `survey_incomplete`
  - `policy_update`
  - `system_announcement`
  - `report_result`

## 5. 圈子社交模块 (Circles)
**核心功能**：兴趣分组匹配，独立于主匹配流水线。详细接口参数见 `docs/CIRCLE_API.md`。

- `GET /api/v1/circles` — 列出活跃圈子
- `GET /api/v1/circles/:id` — 圈子详情 + 问卷题目
- `GET /api/v1/circles/my` — 我加入的圈子（需登录）
- `POST /api/v1/circles/:id/join` — 加入圈子
- `DELETE /api/v1/circles/:id/leave` — 退出圈子
- `PATCH /api/v1/circles/:id/status` — 切换参与状态
- `GET /POST /api/v1/circles/:id/questionnaire` — 获取/提交圈子问卷
- `GET /api/v1/circles/:id/match/current` — 本周圈内匹配
- `POST /api/v1/circles/:id/match/action` — 操作匹配
- `GET /api/v1/circles/:id/match/history` — 历史圈内匹配
- `GET /api/v1/circles/:circleId/channel` — 圈子组队频道成员列表（带标签）

## 6. 名片模块 (Card)
**核心功能**：模块化名片系统，支持多级可见性（public/friends/hidden）。详细接口参数见 `docs/CIRCLE_API.md`。

- `GET /api/v1/card` — 获取自己的名片配置
- `PUT /api/v1/card` — 更新名片配置（全量替换 modules 数组）
- `GET /api/v1/card/modules` — 获取所有可用预设模块列表
- `GET /api/v1/card/:userId/public` — 获取指定用户的公开名片（需同圈子）
- `GET /api/v1/card/:userId/full` — 获取好友的完整名片（需互为好友）
- `GET /api/v1/card/circle/:circleId` — 获取自己在某圈子的名片覆写
- `PUT /api/v1/card/circle/:circleId` — 更新圈子专属名片覆写

## 7. 好友模块 (Friends)
**核心功能**：基于圈子的好友关系链，支持好友申请与名片快照。

- `GET /api/v1/friends` — 获取好友列表
- `POST /api/v1/friends/request` — 发送好友申请（附名片快照）
- `GET /api/v1/friends/requests` — 获取收到的好友申请列表
- `PUT /api/v1/friends/requests/:requestId` — 处理好友申请（accept/reject）
- `DELETE /api/v1/friends/:friendId` — 删除好友

## 8. 联系方式解锁模块 (Contacts)
**核心功能**：好友关系内的联系方式解锁申请与审批。

- `POST /api/v1/contacts/unlock-request` — 申请解锁好友联系方式
- `GET /api/v1/contacts/unlock-requests` — 获取收到的解锁申请
- `PUT /api/v1/contacts/unlock-requests/:requestId` — 审批解锁申请
- `GET /api/v1/contacts/:userId` — 获取好友的联系方式（需已解锁）

## 9. 论坛模块 (Forum)
**核心功能**：全站论坛 + 圈子专属论坛，支持组队帖（无门槛）和普通帖（有资格要求）。

> 当前状态：截至 2026-04-27，`/api/v1/forum` 尚未在 `backend/src/index.ts` 注册；以下为第三组设计契约，不是已可联调接口。

- `GET /api/v1/forum/posts` — 获取帖子列表
- `POST /api/v1/forum/posts` — 发布帖子（type=squad 无资格限制）
- `GET /api/v1/forum/posts/:postId` — 帖子详情 + 评论
- `POST /api/v1/forum/posts/:postId/comments` — 发表评论
- `DELETE /api/v1/forum/posts/:postId` — 删除自己的帖子（软删除）
- `DELETE /api/v1/forum/comments/:commentId` — 删除自己的评论（软删除）

## 10. 管理模块 (Admin)
**仅限内部使用，Header: `X-Admin-Key`**

- `POST /api/v1/admin/trigger-matching` — 手动触发主匹配算法（写入审计日志）
- `GET /api/v1/admin/trigger-matching/precheck` — 匹配前预检：返回合格人数、本周已匹配数、锁定状态
- `POST /api/v1/admin/unlock-reveal` — 手动解锁本周匹配揭晓（写入审计日志）
- `POST /api/v1/admin/circles` — 创建圈子
- `PUT /api/v1/admin/circles/:id` — 更新圈子
- `PATCH /api/v1/admin/circles/:id/active` — 上/下架圈子
- `POST /api/v1/admin/circles/:id/questions` — 全量替换圈子问卷
- `POST /api/v1/admin/trigger-circle-matching` — 触发全部圈子匹配
- `POST /api/v1/admin/trigger-circle-matching/:id` — 触发单个圈子匹配
- `POST /api/v1/admin/unlock-circle-reveal` — 解锁本周圈子匹配
- `GET /api/v1/admin/card-modules` — 获取所有预设模块

## 11. 心动信笺模块 (Heartbox)
**核心功能**：输入指定学号投递一次“心动信号”。仅当双方互相输入对方学号时才启封信笺，并接入主线匹配（`source=heartbox`）。

**隐私约束（最高优先级）**：
- 对“格式合法且非本人学号”的投递请求，除“双向成立”外一律返回 `saved`，不可用于判断目标是否注册/封禁/资料完成/拉黑等。
- `incomingHint` 仅允许返回全局布尔提示，不允许数量/时间/范围/命中反馈。

- `GET /api/v1/heartbox/me`
  - **功能**：获取当前心动状态（仅本人可见）。
  - **返回**：`hasActiveSignal`、`signal.targetStudentIdMasked`、`incomingHint.hasIncoming`。
- `POST /api/v1/heartbox/signal`
  - **功能**：投递或更换一次心动对象（仅格式校验）。
  - **参数**：`targetStudentId`（本科生 9 位或研究生 12 位学号）。
  - **返回**：
    - `saved` — 系统已接收（不代表目标存在）
    - `matched` — 双向成立并进入主线 `MUTUAL`
    - `queued` — 双向成立但当前主线窗口被占用
  - **副作用**：双向成立后为双方长期关闭 `partner` 主线匹配；`friend` 主线不受影响。
- `DELETE /api/v1/heartbox/signal`
  - **功能**：撤回当前单向主动心动（幂等；不通知对方；双向成立后不可撤回）。

## 12. 学号绑定模块 (Student ID Bind)
**核心功能**：为心动信笺提供“学号唯一绑定”能力。学号邮箱注册用户自动绑定；邮箱别名注册用户需通过学号规范邮箱 OTP 绑定后使用。

- `GET /api/v1/student-id/bind/status`
  - **功能**：查询当前账号绑定状态。
  - **返回**：`verified`、`last4`、`source`、`mergedIntoUserId`。
- `POST /api/v1/student-id/bind/send-code`
  - **功能**：发送绑定验证码（发往 `学号@smail.nju.edu.cn`）。
  - **参数**：`studentId`（本科生 9 位或研究生 12 位学号）。
- `POST /api/v1/student-id/bind/verify`
  - **功能**：验证验证码并完成绑定。
  - **参数**：`studentId`, `code`。
  - **约束**：
    - 同一 `student_id_hash` 只能由一个有效账号持有；
    - 冲突时当前账号进入 `merged` 状态，不再参与匹配/heartbox。

- `POST /api/v1/admin/card-modules` — 新增预设模块
- `PUT /api/v1/admin/card-modules/:key` — 编辑预设模块
- `DELETE /api/v1/admin/card-modules/:key` — 删除预设模块
- `GET /api/v1/admin/reports` — 获取用户举报列表（分页，可按状态筛选）
- `PATCH /api/v1/admin/reports/:id` — 审核举报（标记为 reviewed / dismissed）

以下论坛管理接口当前仍是设计稿，尚未在 `backend/src/routes/admin.ts` 注册：

- `GET /api/v1/admin/forum/posts` — 论坛帖子列表（含软删除）
- `DELETE /api/v1/admin/forum/posts/:postId` — 管理员强制删帖
- `PUT /api/v1/admin/forum/posts/:postId/pin` — 置顶/取消置顶

---

## 定时任务 (Cron)

| 时间 | 任务 |
|------|------|
| 周二 18:00 | 邮件提醒：未填问卷 / 问卷版本过旧的用户（仅 emailNotifications=true） |
| 周三 18:00 | 运行匹配算法 + 开始锁定窗口（问卷/状态不可修改） |
| 周三 20:00 | 解锁匹配结果（LOCKED → REVEALED），发邮件通知 |
| 周五 20:00 | 将未操作的 REVEALED 匹配标记为 EXPIRED |

---

## 后端设计提示

1. **状态机驱动**：Match Status 是核心状态机：`LOCKED → REVEALED → MUTUAL / MISSED / EXPIRED`
2. **锁定窗口**：周三 18:00 – 周日 23:59 北京时间，禁止修改问卷和参与状态
3. **匹配算法**：硬性条件（性别偏好、dealbreaker 题目）作 Filter，软性条件（量表题、多选、排序）作 Score；Gale-Shapley 保证稳定匹配
4. **邮件幂等**：通过 mail_logs.idempotency_key 防止同一通知重复发送
5. **AI 生成**：通义千问（DashScope OpenAI 兼容 API）生成馆长私语，失败时降级到模板文案
