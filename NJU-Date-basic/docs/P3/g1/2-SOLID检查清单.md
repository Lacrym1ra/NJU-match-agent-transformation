# SOLID 检查清单（用户主线与匹配子系统）

> 阶段：P3 详细设计  
> 小组：g1  
> 实验目标：记录 AI 初稿中的设计缺陷，并给出人工修正方案

---

## 1. AI 原始设计摘要

让 AI 根据“注册 - 建档 - 问卷 - 匹配 - 揭晓 - 历史 - 消息中心”生成类图时，初稿倾向于设计一个巨大的 `UserMatchManager`：

```ts
class UserMatchManager {
  register(email, code, password) {}
  login(email, password) {}
  updateProfile(userId, profile) {}
  submitSurvey(userId, answers) {}
  runMatching() {}
  calculateScore(userA, userB) {}
  revealMatch(userId) {}
  recordAction(matchId, userId, action) {}
  sendEmail(userId, type) {}
  writeNotification(userId, type) {}
  deleteAccount(userId) {}
}
```

主要问题：认证、资料、问卷、匹配算法、通知、注销全部放入单一类，并且直接依赖数据库、邮件服务和具体算法实现。

---

## 2. SOLID 逐条检查

| SOLID 原则 | 检查问题 | AI 设计是否违反 | 违反说明 | 修正方案 |
|---|---|---|---|---|
| S - 单一职责 | 有没有类承担过多职责？ | 是 | `UserMatchManager` 同时处理认证、资料、问卷、匹配、通知、注销，修改任意业务都会影响同一类 | 拆分为 `AuthService`、`SurveyService`、`MatchService`、`NotificationService` 与 `UserController` |
| O - 开闭原则 | 新增需求类型是否需要修改现有代码？ | 是 | 新增匹配算法、消息类型、问卷版本时都要改核心管理类 | 将匹配算法抽为策略；通知通过 `type + meta + idempotencyKey` 扩展 |
| L - 里氏替换 | 子类是否可以替换父类使用？ | 部分违反 | AI 初稿将 `EmailNotification`、`InboxNotification` 继承同一父类，但发送邮件和站内已读的行为并不一致 | 不强制继承，用 `MailLog` 处理邮件幂等，用 `Notification` 处理站内消息状态 |
| I - 接口隔离 | 有没有接口太胖？ | 是 | `IUserService` 被设计成包含登录、资料、问卷、匹配、好友、论坛等大量方法 | 按边界拆接口：认证、资料、问卷、匹配、通知分别暴露小接口 |
| D - 依赖倒转 | 高层模块是否直接依赖低层实现？ | 是 | Controller 直接调用数据库与邮件发送逻辑，匹配服务直接写死算法流程 | Controller 只调用服务；匹配服务依赖算法策略；邮件/站内消息通过幂等写入服务封装 |

---

## 3. 违规数量记录

| 类型 | 数量 | 修正状态 |
|---|---:|---|
| 单一职责违反 | 2 | 已通过模块拆分修正 |
| 开闭原则违反 | 2 | 已通过策略模式与消息类型扩展修正 |
| 里氏替换风险 | 1 | 已取消不必要继承 |
| 接口隔离违反 | 1 | 已拆分接口 |
| 依赖倒转违反 | 2 | 已用 Controller-Service-Policy 分层修正 |
| 合计 | 8 | 已修正 |

---

## 4. 重点问题与修正

### 4.1 问题一：匹配算法被写死在业务服务中

AI 初稿：

```ts
class MatchService {
  runWeeklyMatching() {
    const users = db.queryUsers();
    const scores = this.calculateByMbtiOnly(users);
    return this.simplePair(scores);
  }
}
```

问题：
- 只按 MBTI 打分，忽略问卷维度、dealbreaker、性别偏好、参与状态。
- 新增朋友匹配、权重实验时必须修改 `MatchService`。

修正：
- `partitionIntoPools` 负责候选池划分。
- `passesDealbreakerFilter` 负责硬条件过滤。
- `calculateCompatibility` 负责兼容度评分。
- `greedyMaxWeightMatching` 负责配对选择。

### 4.2 问题二：通知模型混淆邮件和站内消息

AI 初稿把邮件提醒和站内消息都继承自 `Notification`，并要求都实现 `send()`、`markRead()`。

问题：
- 邮件不可标记已读，站内消息不一定需要外部投递。
- 强行继承违反接口隔离和里氏替换。

修正：
- `mail_logs` 只负责邮件发送幂等。
- 未来 `notifications` 表负责站内消息列表、已读状态和跳转。
- 两者通过不同幂等键去重，避免互相耦合。

### 4.3 问题三：用户服务接口过胖

AI 初稿：

```ts
interface IUserService {
  register()
  login()
  updateProfile()
  submitSurvey()
  runMatching()
  getMatchHistory()
  sendFriendRequest()
  createForumPost()
}
```

问题：
- 第一组、第二组、第三组的职责混在一起。
- 任一模块变化都迫使实现类重新适配。

修正：
- 第一组只保留 `/auth`、`/user`、`/survey`、`/match`、`/notifications` 边界。
- 圈子、好友、论坛、治理分别归 g2/g3。

---

## 5. 最终设计检查结论

| 原则 | 修正后结论 | 说明 |
|---|---|---|
| S | 通过 | 核心服务按业务边界拆分 |
| O | 通过 | 匹配策略和消息类型可扩展 |
| L | 通过 | 避免不合适继承，使用清晰数据模型 |
| I | 通过 | 控制器只依赖自己需要的服务 |
| D | 基本通过 | 当前代码仍直接使用 Drizzle，但逻辑上已隔离在 service/module 内 |

---

## 6. 反思

AI 在生成“标准类图”时容易套用大而全的管理类，也会把课程要求中的“用户、需求、订单、评价”等概念机械映射到本项目。人工修正的重点不是把模式堆满，而是让设计贴近当前仓库真实边界：第一组主线是用户进入系统、完成问卷、参与匹配、查看结果并接收提醒。

