# "AI 代码信任度实验"报告

**团队名称：** 第二组
**阶段：** Phase 4 - 编码开发
**实验功能点：** 圈内论坛发帖同步到总论坛、Settings 好友/隐私申请管理、站内通知 `actionUrl` 跳转、Dashboard 申请状态展示

## 1. 步骤一：AI 直接生成

### Prompt
> 要求 AI 先根据截图/清单检查哪些问题已解决，再只从前端视角分析未完成点；随后分批实现：
> 1. 扩展 `friends.ts/contacts.ts` 状态类型，Dashboard 增加状态 view helper；
> 2. 重构 `SettingPrivacyTab` 为收到/发出两个区块，Settings 支持 `tab=friends/privacy`；
> 3. `NotificationBell` 优先读取 `meta.actionUrl`；
> 4. `PostForm` 增加/优化 `syncToGlobal` 开关视觉修复；
> 5. Mock 数据增加 `sentRequests` 和撤回/忽略接口。
> 要求只改前端时不得改后端。

### AI 生成结果摘要
> AI 一次性生成了以下改动：
> - 扩展 `friends.ts` 的 `FriendRequestStatus/FriendRequestReplyStatus` 和 `contacts.ts` 的 `ContactUnlockRequestStatus`，新增 `withdrawn/expired/revoked` 等状态；
> - Dashboard 新增 `getFriendReplyStatusView` 和 `getContactReplyStatusView` helper，用 `switch(status)` 输出各状态文案；
> - `SettingPrivacyTab.tsx` 重构为"收到的好友申请"和"我发出的好友申请"两个区块；
> - Settings 支持 `useSearchParams` 和 `tab=friends/privacy` 条件渲染；
> - `NotificationBell.tsx` 的 `getNotificationTarget` 首行优先读取 `actionUrl`；
> - `PostForm.tsx` 将同步区域改成浅色设置行，右侧使用紧凑 toggle；
> - Mock 数据增加 `sentRequests` 和撤回/忽略接口。

### 初始运行结果
- **能否编译：** 是（`npm run lint` 通过）
- **能否运行：** 是（`npm run build` 通过，页面可正常访问）
- **是否通过已有测试：** 是（Mock 模式下各页面可正常访问，lint/build 均通过）

## 2. 步骤二：人工检查与修复

### 人工检查发现的主要问题
1. **是否符合 P3 详细设计：** 基本符合，但"撤销授权"按钮的放置位置不符合业务规则——AI 将撤销入口放在申请回音列表中，但回音列表代表"我发出的申请"，不是授权方视角，直接放按钮会导致权限错位。
2. **异常或边界情况处理：** `SettingPrivacyTab` 原先把接收方申请和发送方申请混在一个列表，动作权限不符合业务规则——收到的申请不应有"撤回"按钮，发出的申请不应有"同意/拒绝"按钮。
3. **明显 Bug 或不合理逻辑：** `NotificationBell` 原先通过 `postId/circleId/teamupId` 推断跳转目标，未优先消费后端已经给出的 `meta.actionUrl`，导致 `/settings?tab=friends/privacy` 无法稳定落点。

### 主要问题记录（1-3个）
- **问题 1：** AI 初始建议把联系方式"撤销授权"入口放到申请回音中，但回音列表代表"我发出的申请"，不是授权方视角；直接放按钮会导致权限错位。
- **问题 2：** `SettingPrivacyTab` 原先把接收方申请和发送方申请混在一个列表，动作权限不符合业务规则。
- **问题 3：** `NotificationBell` 原先通过 `postId/circleId/teamupId` 推断跳转，未优先消费后端已经给出的 `meta.actionUrl`，导致 `/settings?tab=friends/privacy` 无法稳定落点。

### 修复说明
> 人工修复如下：
> - 在 `contacts.ts` 只新增 revoke wrapper 和状态类型，不强行展示无权限按钮；
> - 在 Dashboard 中用 `selectedRevocableContactRequestId` 门控"撤销授权"按钮的展示；
> - 重写 `SettingPrivacyTab.tsx` 的两个区块，明确区分收到/发出的申请及对应动作；
> - 在 `Settings.tsx` 加 `useSearchParams` 和 tab 条件渲染；
> - 在 `NotificationBell.tsx` 的 `getNotificationTarget` 首行优先读取 `actionUrl`；
> - 在 `PostForm.tsx` 缩小同步开关尺寸并调整容器样式。

## 3. 步骤三：实验记录对比

| 指标 | AI 直出 | 人工审查修复后 |
|------|--------|-------------|
| 编译是否通过 | 是 | 是 |
| 功能是否可运行 | 是 | 是 |
| 测试是否通过 | 是（lint/build 通过） | 是（lint/build 通过，业务逻辑正确性人工验证） |
| 主要问题/修复说明 | 撤销授权按钮权限错位、申请列表混合收发方、通知跳转未消费 `actionUrl` | 门控撤销按钮展示、重写双区块、优先读取 `actionUrl`，逻辑正确 |
