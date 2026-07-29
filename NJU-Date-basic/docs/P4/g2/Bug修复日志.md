# Bug 修复日志

**团队名称：** 第二组
**阶段：** Phase 4 - 编码开发

## 修复记录表

| 序号 | 问题现象 | 根因分析 | 修复方案 | 验证结果 |
|------|---------|---------|---------|---------|
| 1 | 同一用户在不同圈子的联系方式申请互相影响，或授权状态串到其他圈子 | 联系方式解锁最初只按 requester/target/fieldKey 判定 pending/approved，缺少 `circleId` 和 `sourceType` 作用域 | 增加 `circle_id/source_type` 维度，新增 `user_circle_contacts`、`contact_unlock_grants`，查询时必须带圈子上下文并校验双方 active 圈成员身份 | 成功 |
| 2 | 好友/联系方式申请过期后仍显示 pending，撤回后状态不完整，重复发送时容易冲突 | 请求表缺少统一的 `expires_at`、`withdrawn/expired/revoked` 状态；并发发送时没有锁住同一申请范围 | 增加请求过期字段和状态约束；发送/处理时先清理过期请求，使用事务、`FOR UPDATE` 和 advisory lock 控制重复申请 | 成功 |
| 3 | 用户退圈或圈主移除成员后，好友关系、联系方式申请、位置记录仍可能残留 | 退圈逻辑只处理成员状态，没有联动清理圈内关系链和授权数据 | 在退圈/移除成员事务中清理 pending 好友申请、联系方式申请、圈内好友关系、位置记录，并回收孤立的全局好友关系，写入 audit log | 成功 |
| 4 | 组队满员时只能直接失败，审核通过后也无法自然补位 | 组队申请只有普通 join 状态，缺少候补申请类型、候补顺位和成员退出后的自动提升逻辑 | 给 `teamup_applications` 增加 `application_type`、`waitlist_joined_at`，满员时进入 waitlist；成员退出或申请审核通过后触发候补补位并写入通知 | 成功 |
| 5 | 实时聊天若直接使用长期 JWT 连接 WebSocket，存在 URL 泄露和重复连接复用风险 | WebSocket upgrade 不能像 HTTP 请求一样稳定携带 Authorization header，直接放长期 token 不利于控制时效和一次性使用 | 新增 `/auth/realtime-ticket` 短期一次性 ticket；WebSocket 只接受 `purpose=realtime`、audience 正确且未消费过的 ticket，并校验 Origin 和房间成员权限 | 成功 |
| 6 | 聊天内容可能绕过联系方式解锁流程，直接在群聊或组队频道里发送手机号/微信/邮箱 | 聊天消息与联系方式授权链路独立，如果不做内容风控会破坏"联系方式需授权后展示"的隐私边界 | 在 `chatModeration` 中增加手机号、邮箱、微信/QQ 等联系方式样式拦截，并结合圈子 keywordRules、长度限制和发送频控返回明确错误码 | 成功 |
| 7 | Dashboard 中好友申请回音把 `withdrawn/expired` 误显示成"接纳你的交际申请" | 前端原逻辑使用 `status !== 'rejected'` 判断成功，只区分 rejected 与非 rejected；后端状态已扩展，但 UI 没有同步扩展 | 在 `frontend/src/api/friends.ts` 扩展 `FriendRequestStatus/FriendRequestReplyStatus`；在 `Dashboard.tsx` 新增 `getFriendReplyStatusView`，用明确 `switch(status)` 输出"已通过/已拒绝/已撤回/已过期" | 成功（`npm run lint`、`npm run build` 均通过） |
| 8 | 联系方式申请回音只识别 `approved/rejected`，对 `withdrawn/expired/revoked` 缺少类型和文案，可能错误展示"去名录查看" | `frontend/src/api/contacts.ts` 的回复类型过窄，Dashboard 只按 `status === 'approved'` 做二分展示 | 扩展 `ContactUnlockRequestStatus`，映射 `expiresAt/revokedAt`；在 Dashboard 新增 `getContactReplyStatusView`，只有 `approved` 展示"去名录查看/申请其他联系方式"，其他状态只显示状态标签 | 成功（`npm run lint`、`npm run build` 通过） |
| 9 | Settings 隐私管理页把"收到的 pending 好友申请"显示成"撤回申请"，动作权限错误 | 页面只调用 `getPendingRequests().requests`，这是接收方收到的申请；但 UI 同时渲染发送方才有的"撤回"按钮 | 重做 `SettingPrivacyTab.tsx`，分为"收到的好友申请"和"我发出的好友申请"两个区块；收到的申请只提供同意/拒绝/忽略/拉黑，发出的 pending 申请只提供撤回 | 成功（Mock 模式访问 `/settings?tab=friends`，收到申请区不出现"撤回"，发出申请区只出现"撤回"） |
| 10 | 圈内论坛"同步至总论坛"开关视觉突兀，滑块过大且圆点视觉溢出 | 原组件使用大胶囊容器和 44x24 开关，和发帖弹窗内其他设置项比例不一致 | 修改 `frontend/src/components/forum/PostForm.tsx`，将同步区域改成浅色设置行，右侧使用 36x20 紧凑 toggle；私密帖时禁用同步并显示提示 | 成功（`npm run lint`、`npm run build` 通过） |
| 11 | 圈子/组队聊天重复发送时，历史消息里出现两条内容完全相同的消息 | 前端重试和网络抖动会重复提交同一条消息；若只依赖后端生成 UUID，无法识别客户端重试 | `circle_chat_messages` 和 `teamup_chat_messages` 增加 `(room, sender_id, client_message_id)` 唯一索引；服务层检测重复 `clientMessageId` 时直接返回已存在消息，实现幂等 | 成功（`chatService.db.test.ts` 中 duplicate clientMessageId 用例通过） |
| 12 | 圈子、组队、联系方式等请求支持撤回后，前端仍可能看到旧的 pending 状态或重复通知 | 早期请求状态枚举只覆盖 pending/accepted/approved/rejected，缺少 `withdrawn/expired/revoked` 等状态，通知类型也没有撤回事件 | 新增 migration 扩展状态机与通知枚举；服务层增加撤回、过期与重复申请拦截逻辑 | 成功（`friendContactService.test.ts` 覆盖好友申请、联系方式申请、拒绝、撤回和异常路径） |
| 13 | 联系方式在圈内名片和组队申请中曾以普通 JSON 明文落库，存在隐私风险，且重复授权时难以按字段去重 | 旧模型把联系方式值直接存在 `user_circle_contacts.value` 或组队联系方式 payload 中，缺少统一加密、脱敏与 hash 去重层 | 新增 `g2_contact_secrets` 表和对应 migration，把联系方式值迁移为加密密文；服务层通过 `g2ContactSecretService` 做加密、解密、脱敏、valueHash 去重 | 成功（`g2ContactSecretService.test.ts` 和 `teamService.test.ts` 验证通过） |
| 14 | **双向并发好友申请会产生 2 条 pending**：当 A→B 和 B→A 同时发起好友申请时，数据库会插入两条 pending 记录，正确行为应只保留 1 条 | `friend_requests` 表缺少方向无关的唯一性约束；虽然使用了 advisory lock，但并发场景下仍可能绕过锁机制 | 新增方向无关的唯一索引 `UNIQUE (LEAST(requester_id, target_id), GREATEST(requester_id, target_id), circle_id, status='pending')`；advisory lock 保持不变作为第一道防线；唯一冲突时转换为业务错误 `REQUEST_EXISTS` | 成功（`concurrency.fixed.test.ts` 和 `friendContactService.db.test.ts` 中双向并发用例通过，修复前复现测试按预期失败） |
| 15 | **双击接受好友申请可能建立 2 次好友关系**：快速连续两次点击"接受"按钮时，可能创建两条圈内好友记录和全局好友记录，正确行为应只处理 1 次 | `handleFriendRequest` 的状态更新缺少 `WHERE status='pending'` 条件，导致第二次请求仍能匹配到已处理的记录 | 将状态更新改为 `UPDATE ... SET status='accepted' WHERE id=? AND status='pending'`；若没有更新到记录（即已被第一次请求处理），则返回业务错误 `ALREADY_PROCESSED` | 成功（`concurrency.fixed.test.ts` 和 `friendContactService.db.test.ts` 中并发接受用例通过，修复前复现测试按预期失败） |
| 16 | **并发退圈的锁顺序可能导致死锁风险**：多个用户同时退出同一个圈子时，如果各自按不同顺序锁定 teamup 行，可能形成循环等待导致死锁 | `leaveCircle` 事务中对 `teamups` 表的 `SELECT ... FOR UPDATE` 没有固定排序，不同事务可能以不同顺序获取行锁 | 在所有涉及 teamup 行锁的地方增加 `ORDER BY id FOR UPDATE`，确保所有事务按相同顺序获取锁；后续 teamup 更新也严格按 id 顺序处理 | 成功（`concurrency.fixed.test.ts` 中退圈死锁回归测试通过，修复前复现测试按预期失败） |
| 17 | **删除全部好友关系的多表删除不是原子事务，可能部分删除导致关系不一致**：删除圈内好友、全局好友、联系方式申请和授权记录时，如果中途失败会导致数据残留 | `deleteAllFriends` 虽在事务中执行，但未显式声明事务隔离级别，且未统计各表删除行数供调用方验证完整性 | 确认现有代码已在 `pool.query('BEGIN')` / `COMMIT` 包裹下执行；补充返回各表删除行数统计（圈内好友数、全局好友数、申请数、授权数），供上层业务验证原子性 | 成功（`friendContactService.db.test.ts` 中删除全部好友集成测试通过，验证四张表数据均被清理） |
| 18 | **并发审批联系方式申请可能两个决定都生效**：当接收方快速连续点击"同意"和"拒绝"时，两个操作可能都写入数据库，正确行为应只有第一个生效 | `handleContactUnlockRequest` 的最终更新缺少 `WHERE status='pending'` 条件，导致第二个操作能覆盖第一个操作的结果 | 将最终更新改为 `UPDATE ... SET status=?, approved_fields=? WHERE id=? AND status='pending'`；若没有更新到记录，则返回业务错误 `ALREADY_PROCESSED` | 成功（`concurrency.fixed.test.ts` 和 `friendContactService.db.test.ts` 中并发审批用例通过，修复前复现测试按预期失败） |
| 19 | 组队活动结束后，同行成员之间缺少举报入口，用户无法从历史组队详情直接举报同行者 | 组队详情页原本只展示成员与联系方式窗口，没有把结束态历史组队接入通用用户举报入口；同时需要避免展示"举报自己" | 在 `TeamUpDetail.tsx` 的结束态成员卡中增加除自己外成员的"举报"按钮，提交走通用 `POST /user/report/:targetId`；抽出 `canReportTeamupMember` 门控 helper | 成功（`TeamUpDetail.test.ts` 新增结束态/非本人/未登录门控单元测试，已纳入前端 `test:g2:unit`；`npm run build` 通过） |

---

## 测试覆盖对照（修复验证用例索引）

> 运行方式：`npm --prefix backend run test:g2`（单元 + `backend/tests/db/` 集成）、`npm --prefix frontend run test:g2:unit`。下表测试文件均为仓库内真实文件，用例名取自其断言。

| Bug # | 对应测试文件 | 覆盖用例 |
|---|---|---|
| 1 | `backend/tests/db/friendContactService.test.ts` | 圈内联系方式解锁授权与展示、非好友禁止申请 |
| 2 | `backend/src/services/friendService.test.ts` | 双向重复 pending 好友申请拦截 |
| 4 | `backend/tests/db/teamService.test.ts` | 满员转候补、退出后候补补位 |
| 6 | `backend/src/utils/chatModeration.test.ts` | 联系方式文本 / 圈关键词 / 超长消息拦截 |
| 7 | `frontend/src/modules/friends/requestTransforms.test.ts` | 收到 / 发出 / 已接受好友申请状态映射 |
| 8 | `frontend/src/modules/contacts/unlockTransforms.test.ts` | 联系方式回音状态与回复映射 |
| 9 | `frontend/src/modules/friends/requestTransforms.test.ts` | 收到 vs 发出申请区分 |
| 11 | `backend/tests/db/chatService.test.ts` | duplicate clientMessageId is idempotent |
| 12 | `backend/tests/db/friendContactService.test.ts` | 好友 / 联系方式申请、拒绝、撤回与异常路径 |
| 13 | `backend/src/services/g2ContactSecretService.test.ts`、`backend/tests/db/teamService.test.ts` | 联系方式加密 / 解密 / 脱敏；组队加密 payload |
| 14 | `backend/src/concurrency.fixed.test.ts`、`backend/tests/db/friendContactService.test.ts` | 双向并发好友申请只留一条 pending |
| 15 | `backend/src/concurrency.fixed.test.ts`、`backend/tests/db/friendContactService.test.ts` | 并发接受只成功一次 |
| 16 | `backend/src/concurrency.fixed.test.ts` | 并发退圈一致锁顺序（防死锁） |
| 17 | `backend/tests/db/friendContactService.test.ts`、`backend/src/concurrency.fixed.test.ts` | deleteAllFriends 多表原子删除 |
| 18 | `backend/src/concurrency.fixed.test.ts`、`backend/tests/db/friendContactService.test.ts` | 并发审批只生效一次 |
| 19 | `frontend/src/pages/TeamUpDetail.test.ts` | 组队结束后同行者举报门控 |

> Bug 3（退圈关系链清理）、Bug 5（实时聊天一次性 ticket 鉴权）、Bug 10（同步开关视觉）当前由集成演示 / 构建检查 / 人工验证覆盖，无对应独立自动化单元用例。
>
> 路径说明：早期表格中 `chatService.db.test.ts`、`friendContactService.db.test.ts` 的实际文件为 `backend/tests/db/chatService.test.ts`、`backend/tests/db/friendContactService.test.ts`。

