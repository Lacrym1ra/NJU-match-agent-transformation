# 心动盲盒功能 — 主线匹配接入版详细设计文档

版本：v1.2 | 日期：2026-05-14  
适用项目：NJU-Date / NJU Match  
定位：指定学号的隐私型双向心动入口，双向成功后接入恋爱交友匹配主线

---

## 0. 本版核心调整

本版把“心动盲盒”从“圈子名片 / 好友申请”逻辑调整为“主线匹配的主动触发入口”。

关键结论：

- 心动盲盒不是好友申请，也不是圈子名片入口。
- 用户输入学号，本质是在对一个已知对象投递低压力心动。
- 双向心动成功后，应进入第一组“恋爱交友匹配主线”，而不是进入第二组“圈子关系链主线”。
- 双向成功后直接生成一条主线匹配记录，来源为 `heartbox`。
- 该主线匹配直接处于“双向愿见 / MUTUAL”状态，双方不需要再点一次愿见。
- 双向成功后，本周普通算法匹配应被跳过或视为已消耗本周匹配机会。
- 展示重点是“双方主动选择”，不是算法给出的百分制匹配度。
- 心动盲盒不能成为“查学号是否注册”的工具。对任意格式合法的学号，接口都应返回一致的投递结果，不能通过成功 / 失败区分目标账号是否存在。
- 可以向用户展示“有人心动了你”的全局提示，但不能提供任何可用于定位具体对象的线索，也不能让用户通过逐个输入学号来验证是谁。
- 不能无条件从邮箱前缀推导学号。若注册邮箱本身就是规范学号邮箱，可以自动绑定；若使用邮箱别名，则绑定学号时需要额外验证。
- 同一真实学号只能绑定一个有效账号。如果学号邮箱账号和别名邮箱账号同时存在，必须走账号合并 / 认领流程，不能让两个账号共享同一个 `student_id_hash`。

推荐核心文案：

```text
双向奔赴
你们不是被算法随机分到的，是彼此都主动选择了对方。
```

---

## 1. 设计目标

“心动盲盒”允许用户向一个指定学号投递一次心动信号。只有当双方互相输入对方学号时，系统才打开盲盒，并把两人接入主线匹配流程。

核心目标：

- 降低主动表达压力。
- 双向前严格保护隐私。
- 双向后承接主线匹配体验。
- 不暴露目标用户是否注册。
- 可展示“是否有人心动过我”的全局状态，但不暴露是谁、几个人、来自哪里、是否是某个具体学号。
- 不把低匹配度作为双向暗恋后的主要展示信息。
- 兼容邮箱别名用户：规范学号邮箱可自动绑定；别名邮箱需要单独绑定并验证。

心动盲盒的用户心理是：

```text
我已经知道 TA 的学号。
我想试探 TA 是否也对我有同样的心意。
如果 TA 也选择我，我们就直接进入一次正式的主线连接。
```

---

## 2. 产品定位

### 2.1 和主线匹配的关系

主线普通匹配是“系统推荐”：

```text
系统根据问卷和偏好，为我推荐一个本周对象。
```

心动盲盒是“主动选择”：

```text
我已经有一个明确对象，系统只负责验证是否双向。
```

因此，心动盲盒双向成功后应复用主线的这些能力：

- 对方基础资料展示；
- 双向愿见状态；
- 见面 / 破冰引导；
- 站内消息通知；
- 历史匹配记录；
- 安全、举报、拉黑能力。

但不应照搬主线的这些表现：

- 不强调百分制匹配度；
- 不用低分提示削弱用户意愿；
- 不要求双方再点击一次“愿见”；
- 不先跳到圈子名片或好友申请流程。

### 2.2 和好友 / 名片体系的关系

好友、名片、联系方式解锁属于第二组“圈子与关系链主线”。它们可以作为双向成功后的辅助入口，但不是心动盲盒的主流程。

推荐关系：

```text
心动盲盒双向成功
  → 生成主线 match
  → 状态直接为 MUTUAL
  → 展示主线匹配资料与破冰建议
  → 后续可按主线规则交换联系方式 / 举报 / 拉黑
  → 可选地查看公开名片或建立好友关系
```

不推荐关系：

```text
心动盲盒双向成功
  → 只展示圈子名片
  → 引导发送好友申请
  → 等待对方同意好友
```

原因：

- 用户输入学号时表达的是强意愿，不是普通社交加好友。
- 双向输入已经完成了“双方愿意”的确认。
- 再走好友审批会让产品体验降级。

### 2.3 和匹配度的关系

心动盲盒双向成功后，不建议展示百分制匹配度，尤其不展示低分。

原因：

- 双方已经主动选择彼此，产品不应在此时用算法分数“否定”用户。
- 匹配度适合普通主线推荐场景，因为用户在问“系统觉得谁适合我”。
- 心动盲盒场景里，用户已经在说“我想认识这个人，而且 TA 也想认识我”。

推荐策略：

- 内部仍可计算匹配分，用于生成破冰建议、共同点和风险提示。
- 前端不展示 `83%`、`42%` 这类百分比。
- 前端展示“双向奔赴”“彼此主动选择”等来源标签。
- 低分时不写“匹配度较低”，只给中性建议。

示例：

```text
推荐展示：
你们都提到了喜欢安静的线下活动，可以从一次轻量见面开始。

不推荐展示：
你们匹配度只有 42%，建议谨慎。
```

---

## 3. 核心用户流程

### 3.1 投递心动

```text
用户进入心动盲盒页面
  └→ 输入目标学号
       └→ 前端只做格式校验
            └→ 后端规范化学号并计算 hash
                 └→ 如果是本人学号：拒绝
                 └→ 如果格式合法且不是本人：
                      └→ 保存或覆盖当前 active 心动
                           └→ 后端内部尝试解析目标账号
                                ├→ 目标账号不存在：不告诉发起者，返回 saved
                                ├→ 目标账号存在但未双向：返回 saved
                                ├→ 目标账号存在但安全规则不允许：返回 saved
                                └→ 目标账号存在且反向心动也成立：
                                     └→ 创建 heartbox mutual 记录
                                     └→ 创建或排队主线 match
                                     └→ 通知双方
                                     └→ 返回 matched 或 queued
```

重要原则：

```text
saved 只表示“你的心动已被系统接收”。
saved 不表示目标账号存在。
saved 不表示目标账号不存在。
saved 不表示对方是否看过、点过、注册过。
```

前端等待态建议：

```text
你的心动已经投递。
在双向心动发生前，对方不会知道是你。

目标学号：221****89
状态：等待双向心动
```

注意：

- 不展示目标昵称。
- 不展示目标头像。
- 不展示目标院系。
- 不展示“该用户未注册”。
- 不展示“该用户已注册但还没点你”。

### 3.2 双向成功

```text
A 输入 B 的学号
B 输入 A 的学号
  └→ 系统检测到双方 active signal 互相指向
       └→ 生成 heartbox mutual 记录
            └→ 生成主线 matches 记录
                 └→ source = heartbox
                 └→ status = MUTUAL
                 └→ userAAction = ACCEPT
                 └→ userBAction = ACCEPT
                 └→ scoreVisible = false
                 └→ specialLabel = 双向奔赴
```

双向成功后的主页面应接近主线匹配结果页，但有特殊来源提示：

```text
双向奔赴
你们不是被算法随机分到的，是彼此都主动选择了对方。

对方资料：
头像 / 昵称 / 年级 / 院系 / 校区 / 简介

推荐展示：
共同点
破冰话题
见面建议
安全提示

不展示：
百分制匹配度
“匹配度偏低”一类判断
```

### 3.3 本周普通匹配跳过

心动盲盒双向成功后，两人已经获得一次强意愿主线连接。本周普通算法匹配应跳过，避免同一周同时出现多个对象，削弱主线节奏。

推荐规则：

| 场景 | 处理 |
|---|---|
| 双向发生在本周普通匹配生成前 | 立即生成 `source=heartbox` 的主线 match，并把双方排除出本周普通匹配候选池 |
| 双向发生在本周普通匹配已生成但未揭晓前 | 不建议覆盖已有第三方匹配；可将 heartbox match 标记为 `queued`，在下一可用窗口激活 |
| 双向发生在本周已有 REVEALED 匹配期间 | 不破坏现有匹配窗口；heartbox 结果可排队到下一可用窗口，或作为产品明确允许的额外匹配单独展示 |
| 双方本周都没有 active 主线 match | 立即激活 heartbox match，状态为 `MUTUAL` |

MVP 推荐：

```text
同一用户同一时间只允许一个 active mainline match。
heartbox 双向优先占用最近一个可用主线匹配窗口。
若当前已有 active match，则排队而不是静默替换。
```

如果产品决定“心动盲盒永远立即优先”，必须额外处理被替换的第三方用户补偿和通知问题，MVP 不建议这样做。

### 3.4 撤回与更换

用户可以撤回或更换当前心动对象。

规则：

- 未双向前，撤回只影响自己的 active signal，不通知任何人。
- 更换对象时，旧 signal 标记为 `cancelled`，新建 active signal。
- 已经生成主线 match 后，撤回当前心动不删除历史 match。
- 已经双向成功的主线关系，后续按主线匹配的安全 / 历史 / 拉黑规则处理。

### 3.5 被心动提示

可以在心动盲盒首页展示一个全局提示：

```text
有人悄悄心动了你。
系统不会告诉你是谁，也不会提供任何范围提示。
如果你心里也有一个名字，可以按自己的心意投递。
```

这个提示只能表达：

```text
至少存在一条可用的 incoming 心动。
```

它不能表达：

```text
是谁；
有几个人；
来自哪个院系 / 年级 / 圈子；
是否就是你刚输入的这个学号；
你输入的某个学号是否命中了 incoming；
对方是否注册、在线、完成资料。
```

为了避免“逐个试学号”，被心动提示必须和投递结果解耦：

- `GET /heartbox/me` 可以返回全局 `incomingHint`；
- `POST /heartbox/signal` 不能返回 `targetLikedYou`、`isIncomingHit`、`missed` 等字段；
- 用户输入一个未命中的学号时，仍只返回 `saved`；
- 用户输入真正双向的人时，才返回 `matched`，这是双向机制本身允许的打开盲盒；
- 更换心动对象必须有次数限制和冷却时间，避免用户把 `matched` 当作猜谜反馈批量试探。

MVP 建议：

```text
滚动 24 小时内最多设置或更换 1 次心动对象；
触发 incomingHint 后不额外增加尝试次数；
连续多日高频更换进入风控队列。
```

---

## 4. 隐私与反枚举原则

### 4.1 最高优先级原则

心动盲盒不能成为学号查询器。

用户不能通过输入学号推断：

1. 该学号是否注册了 NJU Match；
2. 该学号是否完成资料；
3. 该学号是否完成问卷；
4. 该学号是否被封禁、注销、暂停；
5. 该学号是否拉黑了自己；
6. 该学号是否已经点过自己；
7. 该学号当前是否点了别人。
8. “有人心动了我”的提示是否来自某个具体学号。

因此，接口语义必须是：

```text
格式合法的学号投递成功 ≠ 目标账号存在。
格式合法的学号投递成功 = 系统接收了我的盲投。
```

### 4.2 可以失败的情况

接口只建议对以下情况返回失败：

- 当前用户未登录；
- 当前用户自己的资料状态不满足使用条件；
- 学号格式非法；
- 输入的是自己的学号；
- 请求频率超限；
- 系统错误。

不应因为以下目标状态返回失败：

- 目标学号未注册；
- 目标账号已注销；
- 目标账号被封禁；
- 目标账号未完成资料；
- 目标账号未完成问卷；
- 目标账号拉黑了当前用户；
- 当前用户被目标账号拉黑。

这些情况应在后端内部影响“是否能形成双向 match”，但不能影响“投递请求表面结果”。

### 4.3 接口返回值约束

不推荐：

```json
{
  "success": false,
  "code": "USER_NOT_FOUND",
  "message": "该学号尚未注册"
}
```

不推荐：

```json
{
  "success": true,
  "targetExists": true,
  "targetProfileComplete": false,
  "targetLikedYou": false
}
```

推荐：

```json
{
  "success": true,
  "status": "saved"
}
```

只有双向已经成立时，才可以返回：

```json
{
  "success": true,
  "status": "matched",
  "matchId": "match_xxx",
  "source": "heartbox",
  "matchStatus": "MUTUAL"
}
```

`matched` 会暴露“对方也选择了我”，但这是心动盲盒的目标状态，且只有双方互相选择时才发生。

### 4.4 被心动提示约束

允许展示的 incoming 信息只有一个布尔提示：

```json
{
  "incomingHint": {
    "hasIncoming": true,
    "copy": "有人悄悄心动了你"
  }
}
```

不允许展示：

```json
{
  "incomingCount": 3,
  "latestIncomingAt": "2026-05-14T10:00:00+08:00",
  "possibleDepartment": "软件学院",
  "possibleGrade": "2022",
  "targetLikedYou": true
}
```

实现要求：

- `incomingHint` 只能出现在获取本人心动状态的接口中；
- `incomingHint` 不能出现在投递某个学号后的返回值中；
- `incomingHint` 不随用户当前输入的目标学号变化；
- `incomingHint` 不提供数量、时间、来源范围、院系、年级、共同圈子等线索；
- 如果安全规则判定某条 incoming 不应形成匹配，不应把它计入可展示提示；
- 前端不能在用户每次输入学号后刷新出“命中 / 未命中”式反馈。

### 4.5 数据最小化

心动盲盒不应在 `heart_signals` 中保存目标明文学号。

推荐保存：

- `target_student_id_hash`：规范化学号加服务端 pepper 后哈希；
- `target_student_id_masked`：仅用于当前用户自己回看，例如 `221****89`；
- `resolved_target_user_id`：可空，仅后端内部缓存，不返回前端。

不推荐保存：

- 目标明文学号；
- 未双向目标的昵称、院系、头像快照；
- incoming 心动列表；
- 被心动人数。

### 4.6 侧信道防护

需要避免通过非内容渠道泄露目标状态：

- 响应时间不要因为“目标存在 / 不存在”差异过大；
- 错误码不要区分目标状态；
- 前端不要额外请求目标资料；
- 不提供 `/heartbox/resolve-student-id` 之类接口；
- `GET /heartbox/me` 最多返回全局 `incomingHint.hasIncoming`，不返回 incoming 数量或来源线索；
- 管理端审计日志不能在用户侧透出。

---

## 5. 信息展示层级

| 层级 | 信息 | 触发条件 | 谁能看 |
|---|---|---|---|
| Layer 1 | 心动入口 | 登录后进入页面 | 登录用户 |
| Layer 2 | 当前主动心动对象的脱敏学号 | 用户自己投递过 | 仅本人 |
| Layer 3 | 是否存在被心动提示 | 存在可用 incoming 心动 | 仅本人 |
| Layer 4 | 等待双向状态 | 单向心动保存后 | 仅本人 |
| Layer 5 | 双向奔赴提示 | 双向心动成立 | 双方 |
| Layer 6 | 主线匹配资料 | heartbox match 激活 | 双方 |
| Layer 7 | 破冰建议 / 共同点 | heartbox match 激活 | 双方 |
| Layer 8 | 联系方式或后续互动 | 按主线 MUTUAL 规则 | 双方 |

未双向前允许展示：

- “有人悄悄心动了你”这一全局布尔提示；
- 自己当前投递目标的脱敏学号；
- 自己的等待状态。

未双向前禁止展示：

- 对方昵称；
- 对方头像；
- 对方院系；
- 对方是否注册；
- 对方是否完成问卷；
- 对方是否点过自己；
- 有多少人点过自己；
- incoming 的时间、范围、院系、年级、共同圈子；
- 任何 incoming 心动列表。

双向后推荐展示：

- 对方主线资料；
- “双向奔赴”来源标签；
- 共同点；
- 破冰话题；
- 线下见面建议；
- 安全提醒、举报、拉黑入口。

双向后不推荐展示：

- 百分制匹配度；
- “匹配度低 / 不太合适”等打击性表述；
- 圈子名片作为唯一后续路径；
- 再次要求双方发送好友申请。

---

## 6. 业务规则

### 6.1 使用资格

用户需要满足：

- 已登录；
- 完成基础档案；
- 完成主线问卷；
- 已绑定并验证本人的学号；
- 账号状态正常；
- 未触发心动盲盒风控限制。

这是当前用户自己的状态，可以明确提示。

示例：

```text
绑定学号后才能投递心动。
```

这不涉及第三方隐私。

### 6.2 目标学号规则

用户可以输入：

- 格式合法的南大学号；
- 不一定已注册的学号；
- 不一定已完成资料的学号。

用户不能输入：

- 格式非法的字符串；
- 自己的学号。

后端可以在内部识别目标账号状态，但不能把这些状态通过接口或 UI 暴露给发起者。

### 6.3 每人同时最多一次主动心动

每个用户最多存在一条 `active` 状态的心动信号。

推荐实现：

```text
旧 signal status = cancelled
新建 active signal
```

原因：

- 方便审计；
- 方便风控；
- 方便排查用户申诉；
- 避免直接覆盖导致历史不可追踪。

### 6.4 双向判定

后端判定逻辑基于“学号 hash + 用户身份”，不是前端查询。

示例：

```text
当前用户 A 的 studentIdHash = hash(A 学号)
A 输入 B 学号 → targetHash = hash(B 学号)

后端内部查找：
1. 是否存在 studentIdHash = targetHash 的用户 B；
2. 是否存在 B 的 active signal，且 targetStudentIdHash = hash(A 学号)；
3. A/B 是否通过安全规则；
4. 是否已有同一对用户的 heartbox mutual 或 mainline match。

只有全部成立，才创建双向结果。
```

如果 B 不存在、B 没有反向心动、或安全规则不允许，前端都只看到：

```json
{
  "success": true,
  "status": "saved"
}
```

### 6.5 重复匹配

推荐规则：

- 同一对用户只允许存在一条有效 heartbox mutual。
- 如果两人已经通过 heartbox 形成主线 match，再次互点不重复创建。
- 如果两人历史上有普通主线 match，是否允许 heartbox 再次触发，由产品策略决定。

MVP 建议：

```text
同一对用户已有 active 或 MUTUAL 主线 match 时，不重复创建。
返回 matched，并跳转既有 match。
```

---

## 7. 页面设计

### 7.1 心动盲盒入口页

页面内容：

```text
标题：心动盲盒

如果存在 incomingHint：
有人悄悄心动了你。
系统不会告诉你是谁，也不会提供任何范围提示。

输入 TA 的学号，悄悄投递一次心动。
只有当 TA 也选择你时，你们才会互相知道。

输入框：
- 请输入学号

按钮：
- 投递心动
```

隐私提示：

```text
系统不会告诉你 TA 是否已注册。
单向心动不会让对方知道是你。
只有双向心动成功后，双方才会收到提示。
```

### 7.2 当前心动状态页

```text
你已经投递了一次心动

目标学号：221****89
当前状态：等待双向心动

按钮：
- 更换心动对象
- 撤回心动
```

可补充说明：

```text
投递成功只代表系统已接收你的心动，不代表 TA 已注册或已看到。
```

### 7.3 双向成功页

```text
双向奔赴

你们不是被算法随机分到的，是彼此都主动选择了对方。
本周普通匹配将为你们留白。
```

展示模块：

- 对方主线资料；
- 双向奔赴标签；
- 共同点；
- 破冰话题；
- 见面建议；
- 安全提示；
- 举报 / 拉黑入口。

不展示模块：

- 百分制匹配度；
- “低匹配度”提示；
- incoming 心动数量；
- 注册状态解释。

---

## 8. 数据库设计

### 8.1 users 增加独立学号绑定字段

为了支持“输入学号但不泄露注册状态”，用户表需要具备内部学号匹配能力。

注意：不能无条件从 `email` 字段推导学号。

原因：

- 有些用户注册时使用南大邮箱别名，邮箱 local-part 不是学号；
- `@smail.nju.edu.cn` 只能证明用户拥有南大邮箱，不能保证 local-part 一定是学号；
- 如果把所有邮箱前缀都当学号，会导致心动投递无法命中真实用户，甚至误绑定到错误学号；
- 但如果邮箱 local-part 明确符合学号格式，可以视为“规范学号邮箱”，在注册时自动绑定。

建议新增：

```sql
ALTER TABLE users
ADD COLUMN student_id_hash text UNIQUE,
ADD COLUMN student_id_verified_at timestamp,
ADD COLUMN student_id_bind_source text,
ADD COLUMN student_id_last4 text,
ADD COLUMN merged_into_user_id text REFERENCES users(id),
ADD COLUMN merged_at timestamp;
```

说明：

- `student_id_hash = hash(normalize(studentId) + serverPepper)`；
- 不建议保存明文学号；
- `student_id_last4` 只用于用户自己确认绑定状态，例如展示 `****0001`；
- `student_id_verified_at` 为空时，该用户不能主动使用心动盲盒；
- `student_id_bind_source` 可取 `canonical_email_auto`、`canonical_email_otp`、`manual_review`、`campus_sso` 等。
- `merged_into_user_id` / `merged_at` 用于处理重复账号合并，合并后账号不能再登录或参与匹配。

### 8.1.1 学号绑定与验证

心动盲盒依赖“我是谁的学号”进行反向匹配，因此发起者必须先绑定本人学号。

推荐绑定方式：

| 方式 | 说明 | MVP 建议 |
|---|---|---|
| 规范学号邮箱自动绑定 | 注册邮箱 local-part 明确符合学号格式，例如 `221250001@smail.nju.edu.cn` | 作为默认路径，无需额外 OTP |
| 校园统一身份认证 / SSO | 由学校身份系统返回学号 | 最可靠，有条件优先 |
| 学号规范邮箱 OTP | 别名邮箱用户输入学号后，向该学号对应的规范邮箱发送验证码 | 别名邮箱绑定学号时使用 |
| 人工审核 | 用户提交必要证明，由管理员审核绑定 | 作为兜底 |
| 自填不验证 | 只让用户自己填写学号 | 不建议用于正式版 |

MVP 推荐流程：

```text
用户使用规范学号邮箱注册
  → 系统识别 email local-part 符合学号格式
  → 自动写入 student_id_hash
  → student_id_bind_source = canonical_email_auto
  → student_id_verified_at = now()

用户使用邮箱别名注册
  → 注册成功，但 student_id_hash 为空
  → 使用心动盲盒前输入本人学号
  → 系统向 canonicalStudentEmail(studentId) 发送 OTP
  → 验证通过后写入 student_id_hash
  → student_id_bind_source = canonical_email_otp
```

如果无法向规范学号邮箱发信，则必须接入 SSO 或人工审核；不要退回到“邮箱前缀即学号”的假设。

绑定时必须检查 `student_id_hash` 唯一性：

```text
如果该 student_id_hash 尚未被任何有效账号绑定
  → 正常绑定当前账号

如果该 student_id_hash 已被另一个有效账号绑定
  → 不允许直接覆盖
  → 在用户完成学号 OTP / SSO 验证后，进入账号合并 / 认领流程
```

旧用户迁移策略：

- 邮箱 local-part 明确符合学号格式的旧用户，可以通过一次性迁移自动写入 `student_id_hash`，来源记为 `canonical_email_auto`；
- 邮箱 local-part 不符合学号格式的旧用户，不自动写入 `student_id_hash`；
- 如果邮箱 local-part 看起来像学号但格式不完全可靠，可以只作为前端预填候选，必须由用户确认并验证；
- 未绑定学号的旧用户仍可正常使用主线匹配，但不能主动投递心动；
- 其他用户投向该学号的 signal 可以先以 `target_student_id_hash` 保存，等该用户完成学号绑定后再解析。

### 8.1.2 重复账号与账号合并

可能出现：

```text
同一个真实学生：
  A 账号 = 221250001@smail.nju.edu.cn 注册，已自动绑定 student_id_hash
  B 账号 = nickname@smail.nju.edu.cn 注册，未绑定或试图绑定同一 student_id_hash
```

处理原则：

- 同一 `student_id_hash` 只能对应一个有效账号；
- 不能让 A/B 两个账号同时参与心动盲盒或主线匹配；
- 不能静默覆盖已有绑定；
- 只有在当前操作者完成该学号的 OTP / SSO 验证后，才能告知“该学号已绑定到另一个账号”并提供合并入口；
- 在完成学号验证前，绑定冲突不能通过错误信息暴露。

推荐流程：

```text
B 账号尝试绑定 221250001
  → 系统向 221250001@smail.nju.edu.cn 发送 OTP
       └→ OTP 未通过：返回普通验证失败
       └→ OTP 通过：
            └→ 发现 student_id_hash 已绑定 A 账号
                 └→ 展示账号合并 / 认领提示
                      ├→ 选择保留 A：B 标记 merged_into_user_id = A
                      └→ 选择保留 B：A 标记 merged_into_user_id = B，并迁移可迁移数据
```

合并策略建议：

| 数据 | 处理 |
|---|---|
| 登录邮箱 | 保留两个邮箱作为同一账号的登录别名，或只保留主邮箱并记录副邮箱 |
| 用户档案 | 由用户选择保留哪一份，另一份作为草稿备份 |
| 问卷答案 | 默认保留主账号答案，允许用户手动覆盖 |
| heart_signals | 合并到主账号，同一时间仍只保留一个 active signal |
| heart_matches / matches | 保留历史记录，但去重同一对用户、同一来源的重复记录 |
| 通知 / 邮件日志 | 可保留在原账号审计中，不必全部迁移到用户可见列表 |
| 举报 / 拉黑 | 必须迁移或双向关联，避免通过合并绕过安全关系 |

MVP 可以简化为：

```text
不做复杂数据合并；
只允许用户选择一个主账号；
另一个账号标记为 merged，禁止登录和参与匹配；
管理员保留审计记录，必要时人工迁移资料。
```

注册阶段也应防重复：

```text
用户用规范学号邮箱注册时
  → 系统计算 student_id_hash
  → 若该 hash 已绑定到别名邮箱账号
       → 完成注册 OTP 后，不直接创建第二个有效账号
       → 引导登录 / 合并到既有账号
```

### 8.1.3 未绑定用户如何处理

如果 A 输入 B 的学号，但 B 已注册且使用邮箱别名、尚未绑定学号：

```text
A 的投递仍返回 saved；
heart_signals 保存 target_student_id_hash；
由于 B 尚未绑定 student_id_hash，暂时无法解析 resolved_target_user_id；
B 后续绑定学号后，系统再内部解析历史 signal；
如果 B 也投递过 A，则此时可以触发双向。
```

这样可以同时满足：

- 不泄露 B 是否注册；
- 不要求注册邮箱一定是学号；
- 不丢失别人已经投递给 B 的心动；
- 不允许未验证学号的人冒用他人学号触发双向。

### 8.2 heart_signals

用于记录用户当前或历史心动行为。

```sql
CREATE TABLE heart_signals (
  id                       text PRIMARY KEY,
  sender_id                text NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  target_student_id_hash   text NOT NULL,
  target_student_id_masked text NOT NULL,
  resolved_target_user_id  text REFERENCES users(id) ON DELETE SET NULL,

  status                   text NOT NULL DEFAULT 'active',
  -- active | cancelled | matched | expired | suppressed

  created_at               timestamp NOT NULL DEFAULT NOW(),
  updated_at               timestamp NOT NULL DEFAULT NOW(),
  cancelled_at             timestamp,
  matched_at               timestamp
);
```

建议索引：

```sql
CREATE UNIQUE INDEX uniq_active_heart_signal_sender
ON heart_signals(sender_id)
WHERE status = 'active';

CREATE INDEX idx_active_heart_signal_target_hash
ON heart_signals(target_student_id_hash)
WHERE status = 'active';

CREATE INDEX idx_heart_signal_sender_target_hash
ON heart_signals(sender_id, target_student_id_hash);
```

注意：

- `target_student_id_hash` 允许目标尚未注册。
- `resolved_target_user_id` 只是内部缓存，不作为接口返回字段。
- `suppressed` 可用于安全规则命中的场景，但前端不应知道该状态。

### 8.3 heart_matches

用于记录心动盲盒双向成功结果，并关联主线 match。

```sql
CREATE TABLE heart_matches (
  id             text PRIMARY KEY,
  user_a_id      text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id      text NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  signal_a_id    text REFERENCES heart_signals(id) ON DELETE SET NULL,
  signal_b_id    text REFERENCES heart_signals(id) ON DELETE SET NULL,
  main_match_id  text REFERENCES matches(id) ON DELETE SET NULL,

  status         text NOT NULL DEFAULT 'active',
  -- active | queued | dismissed | blocked

  created_at     timestamp NOT NULL DEFAULT NOW(),
  updated_at     timestamp NOT NULL DEFAULT NOW(),

  CHECK (user_a_id < user_b_id),
  CHECK (user_a_id <> user_b_id),
  UNIQUE(user_a_id, user_b_id)
);
```

说明：

- `heart_matches` 记录“这对用户因心动盲盒达成双向”。
- `matches` 记录“这对用户进入主线匹配状态”。
- 两者分开，便于审计来源和处理排队激活。

### 8.4 matches 建议扩展字段

主线 `matches` 表建议增加来源和分数展示控制。

```sql
ALTER TABLE matches
ADD COLUMN source text NOT NULL DEFAULT 'weekly',
ADD COLUMN score_visible boolean NOT NULL DEFAULT true,
ADD COLUMN special_label text,
ADD COLUMN activated_at timestamp,
ADD COLUMN consumed_week_of text;
```

建议枚举：

```text
source: weekly | heartbox
score_visible: true | false
special_label: 双向奔赴
```

heartbox 生成主线 match 时：

```text
source = heartbox
status = MUTUAL
userAAction = ACCEPT
userBAction = ACCEPT
scoreVisible = false
specialLabel = 双向奔赴
```

---

## 9. API 设计

### 9.1 获取当前心动状态

```http
GET /api/v1/heartbox/me
```

无 active 心动：

```json
{
  "hasActiveSignal": false,
  "signal": null,
  "incomingHint": {
    "hasIncoming": true,
    "copy": "有人悄悄心动了你"
  },
  "latestHeartboxMatch": null
}
```

有 active 心动：

```json
{
  "hasActiveSignal": true,
  "signal": {
    "targetStudentIdMasked": "221****89",
    "status": "active",
    "createdAt": "2026-05-14T10:00:00+08:00"
  },
  "incomingHint": {
    "hasIncoming": true,
    "copy": "有人悄悄心动了你"
  },
  "latestHeartboxMatch": null
}
```

注意：

- 不返回目标昵称。
- 不返回目标头像。
- 不返回目标是否注册。
- 不返回 incoming 心动数量。
- 不返回 incoming 来源线索。
- `incomingHint` 不随当前 active 目标变化。

### 9.2 投递或更换心动

```http
POST /api/v1/heartbox/signal
```

请求：

```json
{
  "targetStudentId": "221250001"
}
```

保存成功但未双向：

```json
{
  "success": true,
  "status": "saved"
}
```

双向成功并立即进入主线：

```json
{
  "success": true,
  "status": "matched",
  "matchId": "match_xxx",
  "source": "heartbox",
  "matchStatus": "MUTUAL",
  "scoreVisible": false,
  "specialLabel": "双向奔赴"
}
```

双向成功但当前主线窗口已被占用：

```json
{
  "success": true,
  "status": "queued",
  "source": "heartbox",
  "specialLabel": "双向奔赴"
}
```

格式非法：

```json
{
  "success": false,
  "code": "INVALID_STUDENT_ID_FORMAT",
  "message": "请输入正确的学号"
}
```

输入本人：

```json
{
  "success": false,
  "code": "SELF_TARGET_NOT_ALLOWED",
  "message": "不能投递给自己"
}
```

当前用户尚未绑定学号：

```json
{
  "success": false,
  "code": "STUDENT_ID_BIND_REQUIRED",
  "message": "绑定学号后才能投递心动"
}
```

说明：

- 这是当前用户自己的资格状态，可以明确提示；
- 这不涉及目标用户，因此不会泄露第三方注册状态；
- 目标用户未绑定学号时，发起者仍只会得到 `saved`。

严禁返回：

```json
{
  "success": false,
  "code": "USER_NOT_FOUND"
}
```

### 9.3 撤回当前心动

```http
DELETE /api/v1/heartbox/signal
```

返回：

```json
{
  "success": true
}
```

说明：

- 如果当前没有 active 心动，也返回成功。
- 撤回不通知目标用户。
- 撤回不删除已生成的主线 match。

### 9.4 主线当前匹配返回扩展

```http
GET /api/v1/match/current
```

heartbox match 示例：

```json
{
  "status": "MUTUAL",
  "message": "双向奔赴",
  "match": {
    "matchId": "match_xxx",
    "source": "heartbox",
    "specialLabel": "双向奔赴",
    "scoreVisible": false,
    "compatibilityScore": null,
    "partner": {
      "id": "user_xxx",
      "nickname": "小南",
      "department": "人工智能学院",
      "grade": "2022",
      "campus": "仙林",
      "bio": "...",
      "avatarUrl": "..."
    },
    "insights": {
      "sharedInterests": ["散步", "咖啡"],
      "icebreakers": ["可以从最近常去的自习地点聊起"],
      "curatorNote": "这是一次彼此主动选择的连接。"
    }
  }
}
```

说明：

- `compatibilityScore` 对 heartbox 来源返回 `null` 或不返回。
- 如果后端仍需要内部 score，可存在数据库中，但 `scoreVisible=false`。
- 前端根据 `source=heartbox` 渲染“双向奔赴”专属状态。

### 9.5 站内消息

可以复用第一组消息类型：

```text
match_mutual_success
```

payload 示例：

```json
{
  "matchId": "match_xxx",
  "reason": "heartbox",
  "specialLabel": "双向奔赴"
}
```

注意：

- 单向心动绝不发通知。
- 只有双向成立或 queued 激活时才发通知。
- 通知不应包含目标学号。

---

## 10. 后端核心逻辑

### 10.1 投递心动伪代码

```ts
async function createHeartSignal(currentUserId: string, targetStudentId: string) {
  return await db.transaction(async (tx) => {
    const currentUser = await tx.users.findById(currentUserId)
    assertCurrentUserEligible(currentUser)
    if (!currentUser.studentIdHash || !currentUser.studentIdVerifiedAt) {
      return {
        success: false,
        code: "STUDENT_ID_BIND_REQUIRED",
        message: "绑定学号后才能投递心动"
      }
    }

    const normalizedTargetStudentId = normalizeStudentId(targetStudentId)
    if (!isValidStudentId(normalizedTargetStudentId)) {
      return {
        success: false,
        code: "INVALID_STUDENT_ID_FORMAT",
        message: "请输入正确的学号"
      }
    }

    const targetHash = hashStudentId(normalizedTargetStudentId)
    if (targetHash === currentUser.studentIdHash) {
      return {
        success: false,
        code: "SELF_TARGET_NOT_ALLOWED",
        message: "不能投递给自己"
      }
    }

    await tx.heartSignals.updateMany({
      where: {
        senderId: currentUserId,
        status: "active"
      },
      data: {
        status: "cancelled",
        cancelledAt: now()
      }
    })

    const signal = await tx.heartSignals.create({
      data: {
        senderId: currentUserId,
        targetStudentIdHash: targetHash,
        targetStudentIdMasked: maskStudentId(normalizedTargetStudentId),
        status: "active"
      }
    })

    // Internal lookup only. Never expose this result to the caller.
    const targetUser = await tx.users.findByStudentIdHash(targetHash)
    if (!targetUser) {
      return {
        success: true,
        status: "saved"
      }
    }

    const reverseSignal = await tx.heartSignals.findFirst({
      where: {
        senderId: targetUser.id,
        targetStudentIdHash: currentUser.studentIdHash,
        status: "active"
      }
    })

    if (!reverseSignal) {
      return {
        success: true,
        status: "saved"
      }
    }

    const allowed = await safetyAllowsHeartboxMatch(tx, currentUser.id, targetUser.id)
    if (!allowed) {
      // Do not reveal block / safety / moderation state.
      return {
        success: true,
        status: "saved"
      }
    }

    const [userAId, userBId] = sortUserPair(currentUser.id, targetUser.id)

    const heartMatch = await tx.heartMatches.upsert({
      where: {
        userAId_userBId: {
          userAId,
          userBId
        }
      },
      create: {
        userAId,
        userBId,
        signalAId: signal.id,
        signalBId: reverseSignal.id,
        status: "active"
      },
      update: {
        status: "active",
        updatedAt: now()
      }
    })

    const activation = await createOrQueueHeartboxMainMatch(tx, {
      userAId,
      userBId,
      heartMatchId: heartMatch.id
    })

    await tx.heartSignals.updateMany({
      where: {
        id: {
          in: [signal.id, reverseSignal.id]
        }
      },
      data: {
        status: "matched",
        matchedAt: now()
      }
    })

    if (activation.status === "matched") {
      await createMatchMutualNotifications(tx, activation.matchId, {
        reason: "heartbox",
        specialLabel: "双向奔赴"
      })

      return {
        success: true,
        status: "matched",
        matchId: activation.matchId,
        source: "heartbox",
        matchStatus: "MUTUAL",
        scoreVisible: false,
        specialLabel: "双向奔赴"
      }
    }

    return {
      success: true,
      status: "queued",
      source: "heartbox",
      specialLabel: "双向奔赴"
    }
  })
}
```

### 10.2 创建主线 match

heartbox 主线 match 推荐写入：

```ts
{
  weekOf: getConsumableWeekOf(),
  userAId,
  userBId,
  score: internalScore,
  dimensions: internalInsights,
  curatorNote: heartboxCuratorNote,
  userAAction: "ACCEPT",
  userBAction: "ACCEPT",
  status: "MUTUAL",
  source: "heartbox",
  scoreVisible: false,
  specialLabel: "双向奔赴",
  revealedAt: now(),
  activatedAt: now()
}
```

`internalScore` 可以保留给排序、分析和文案生成，但前端不应展示百分比。

---

## 11. 权限矩阵

| 操作 | 游客 | 已登录用户 | 心动发起者 | 双向双方 | 管理员 |
|---|---|---|---|---|---|
| 进入心动盲盒页 | 否 | 是 | 是 | 是 | - |
| 投递心动 | 否 | 是 | 是 | 是 | - |
| 查看自己当前目标脱敏学号 | 否 | 否 | 是 | 是 | - |
| 查看目标是否注册 | 否 | 否 | 否 | 否 | 仅审计场景 |
| 查看是否有人心动自己 | 否 | 是，仅布尔提示 | 是，仅布尔提示 | 是，仅布尔提示 | 仅审计场景 |
| 查看谁点了自己 | 否 | 否 | 否 | 否 | 仅审计场景 |
| 查看被心动人数 | 否 | 否 | 否 | 否 | 仅审计场景 |
| 查看双向奔赴结果 | 否 | 否 | 否 | 是 | 仅审计场景 |
| 查看主线匹配资料 | 否 | 否 | 否 | 是 | 仅审计场景 |
| 撤回当前心动 | 否 | 是 | 是 | 是 | - |

---

## 12. 安全与反滥用设计

### 12.1 防止学号枚举

主要风险：

```text
攻击者批量输入学号，试图判断哪些学号已注册。
```

必须采用：

- 只校验学号格式，不校验目标是否存在后再决定成功 / 失败；
- 未注册、注销、封禁、被拉黑等目标状态都返回 `saved`；
- 不提供学号解析接口；
- 不返回目标资料；
- 不返回目标状态；
- 不返回“对方不可被心动”。

辅助措施：

- 每人滚动 24 小时内最多设置或更换 1 次心动对象；
- 每分钟最多请求 3 次；
- 高频失败格式触发验证码；
- 尝试绕过冷却、批量请求或异常多设备提交进入风控队列；
- 服务端记录审计日志但不暴露给用户。

由于“有人心动了你”的提示会提高用户猜测动机，不能给用户充足的试错空间。产品层应把“投递心动”设计成一次认真选择，而不是猜谜游戏。

### 12.2 防止骚扰

单向心动不发出指向发起者的通知，因此骚扰风险较低。即使启用 `incomingHint`，对方也最多看到“有人心动了你”的全局提示，不会知道是谁。

仍需处理：

- 高频更换目标；
- 脚本批量尝试；
- 对被拉黑对象继续投递；
- 对封禁 / 注销用户投递。

处理方式：

- 单向不通知；
- 安全规则命中时不形成 match；
- 返回值仍保持 `saved`；
- 管理端可审计异常行为；
- 严重异常用户可临时禁用心动盲盒。

### 12.3 防止双向后的伤害性提示

双向成功后，产品不应使用打击性算法判断。

禁止文案：

```text
你们匹配度较低。
系统不太建议你们继续。
你们只有 38% 契合。
```

推荐文案：

```text
这是一次彼此主动选择的连接。
系统为你们整理了一些可以自然开始的话题。
```

如果内部算法发现明显冲突，可以用中性、可行动的建议表达：

```text
你们的作息可能不太一样，可以先约一个双方都舒服的时间。
```

---

## 13. 与现有系统的关系

### 13.1 第一组：恋爱交友匹配主线

心动盲盒归第一组主责，因为它最终进入：

- `/match/current`；
- `/match/history`；
- 主线消息中心；
- 主线安全与举报；
- 主线双向愿见状态。

### 13.2 第二组：圈子与关系链

圈子名片和好友能力可以作为后续辅助动作，但不是心动盲盒成功后的默认主线。

可选入口：

- 查看公开名片；
- 建立好友关系；
- 联系方式二次管理。

这些入口不能取代主线 match 展示。

### 13.3 消息中心

单向心动不入站。

双向成功后入站：

```text
type = match_mutual_success
payload.reason = heartbox
```

消息标题建议：

```text
你们双向奔赴了
```

---

## 14. 前端状态机

```ts
type HeartBoxState =
  | "empty"
  | "active_waiting"
  | "matched"
  | "queued"
  | "error"
```

含义：

```text
empty：当前没有主动心动
active_waiting：已经投递，等待双向
matched：双向成功，已进入主线 MUTUAL
queued：双向成功，但主线窗口被占用，等待激活
error：当前用户状态、格式、频率或系统错误
```

状态转移：

```text
empty
  └─ submit valid studentId → active_waiting
  └─ submit valid studentId and mutual → matched / queued
  └─ submit invalid format → error

active_waiting
  └─ change target → active_waiting
  └─ change target and mutual → matched / queued
  └─ cancel → empty

matched
  └─ open main match → 主线匹配页

queued
  └─ activated → matched
  └─ cancel local signal → 不删除 queued mutual，具体按产品策略处理
```

---

## 15. 推荐文案

### 15.1 功能说明

```text
输入 TA 的学号，悄悄投递一次心动。
只有当 TA 也选择你时，你们才会互相知道。
```

### 15.2 隐私说明

```text
系统不会告诉你 TA 是否已注册。
投递成功只代表你的心动已被接收，不代表 TA 已看到或已加入。
```

### 15.3 被心动提示

```text
有人悄悄心动了你。
系统不会告诉你是谁，也不会提供任何范围提示。
```

### 15.4 单向等待态

```text
你的心动已经投递。
在双向心动发生前，对方不会知道是你。
```

### 15.5 双向成功态

```text
双向奔赴。
你们不是被算法随机分到的，是彼此都主动选择了对方。
```

### 15.6 本周匹配提示

```text
本周普通匹配将为你们留白。
这一次连接来自你们彼此的主动选择。
```

### 15.7 撤回确认

```text
撤回后，对方仍然不会收到任何通知。
你可以之后重新投递心动。
```

### 15.8 格式错误

```text
请输入正确的学号。
```

不要写：

```text
该学号尚未注册。
该用户不存在。
该用户暂不可被心动。
```

---

## 16. MVP 范围

### 16.1 第一版必须实现

- 输入学号投递心动；
- 当前用户学号绑定 / 验证流程；
- 学号邮箱账号与别名邮箱账号的重复绑定检测；
- 重复账号合并 / 认领的 MVP 处理；
- 学号格式校验；
- 目标学号 hash 存储；
- 每人最多一个 active 心动；
- 更换心动对象；
- 撤回心动；
- 双向检测；
- 双向后创建 heart_matches；
- 双向后创建或排队主线 `source=heartbox` match；
- heartbox match 状态直接为 `MUTUAL`；
- heartbox match 不展示百分制匹配度；
- 本周普通匹配跳过 / 占用策略；
- 双向成功通知；
- 全局 `incomingHint` 布尔提示；
- 基础 rate limit；
- 不展示 incoming 列表、数量、时间或来源线索；
- 不通过返回值泄露目标是否注册。

### 16.2 第一版不建议实现

- “有多少人心动了我”；
- “你认识的人心动了你”这类带范围线索的提示；
- “猜猜谁点了你”；
- 心动排行榜；
- 心动广场；
- 付费查看；
- 指名或单条单向通知；
- 按院系 / 年级筛选目标；
- 通过学号查昵称；
- 单向状态下查看目标名片。

这些功能都会削弱 zero-knowledge 设计，容易引发隐私和社交压力问题。

---

## 17. 关键实现注意事项

最重要的是：

```text
心动盲盒只在“双向成立”时打开。
在双向成立前，系统只承认“我投递过”，不透露“TA 是谁、TA 在不在、TA 有没有回应”。
```

后端接口必须保证：

```text
我点了谁：只能看到自己输入过的脱敏学号
是否有人点我：可以知道全局布尔提示
谁点了我：不能知道
有多少人点我：不能知道
目标是否注册：不能知道
目标是否完成资料：不能知道
目标是否点我：未双向前不能知道
```

双向后，用户体验应当是：

```text
我悄悄投出了一张心动票。
如果对方也把票投给我，系统才打开盲盒。
打开后，这不是一次算法打分的推荐，而是一次双向奔赴的主线连接。
```
