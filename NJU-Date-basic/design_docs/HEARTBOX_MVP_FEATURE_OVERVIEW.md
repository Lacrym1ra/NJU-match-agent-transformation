# 心动信笺 MVP 完成度说明

更新时间：2026-05-18

## 1. 当前结论

心动信笺的主流程已经具备第一版上线条件：

- 用户按 TA 的学号投递，而不是按邮箱别名或邮箱前缀投递；
- 学号邮箱注册用户自动绑定学号，无需再次操作；
- 邮箱别名注册用户首次使用前需要绑定学号；
- 单向投递保持反枚举语义，不暴露目标是否注册、是否可匹配；
- 双方互相投递后接入主线 `matches`，来源仍为 `source=heartbox`；
- 已保留双向立即激活、主线占用时排队激活、单向撤回冷却、邮件通知等能力。
- 双向成立后会自动暂停双方所有的匹配参与（`isParticipating: false`）。用户后续可完全根据自己意愿在主页或设置中重新手动开启，没有任何长期锁死限制。

## 2. 第一版产品口径

心动信笺是“指定学号的隐私型双向心动入口”：

- 用户输入目标学号，例如本科生 `221250001` 或研究生 `502024320001`；
- 系统内部按学号哈希保存投递目标，不保存目标明文学号；
- 学号邮箱用户在注册或进入绑定状态时自动完成绑定；
- 邮箱别名用户通过 `学号@smail.nju.edu.cn` 验证码完成一次绑定；
- 双方都投递给对方时，才会进入揭晓；
- 单向投递不会通知对方，也不会返回目标状态线索。

## 3. 已实现能力

### 3.1 学号绑定与自动绑定

- 提供绑定接口：
  - `GET /api/v1/student-id/bind/status`
  - `POST /api/v1/student-id/bind/send-code`
  - `POST /api/v1/student-id/bind/verify`
- 绑定策略：
  - 注册邮箱前缀是本科生 9 位或研究生 12 位学号时自动绑定；
  - 旧账号进入绑定状态或心动信笺时会懒加载自动绑定；
  - 邮箱别名账号走“目标规范邮箱 OTP”验证绑定；
- 冲突处理：
  - 同一学号只允许一个有效持有者；
  - 冲突账号标记为 merged，不可继续参与匹配或心动信笺。

### 3.2 投递与反枚举

- 提供接口：
  - `GET /api/v1/heartbox/me`
  - `POST /api/v1/heartbox/signal`
  - `DELETE /api/v1/heartbox/signal`
- `POST /api/v1/heartbox/signal` 使用 `targetStudentId` 参数；
- 对“格式合法且非本人学号”的投递请求，除双向成立外统一返回 `saved`；
- 目标不存在、未注册、被拉黑或不可匹配时，不向投递方暴露差异；
- `incomingHint` 只在 `/heartbox/me` 返回全局布尔提示，不随输入目标变化。

### 3.3 双向匹配与排队激活

- 双向命中后：
  - 无 active 主线：立即创建 `source=heartbox` 且 `status=MUTUAL` 的主线匹配；
  - 有 active 主线：进入 `queued`，等待窗口释放后 FIFO 激活；
  - 同 pair 已有 active 主线：复用，不重复建档。
- 双向成立后：
  - 自动将双方的 `isParticipating` 变更为 `false`，以暂停主线匹配活动（包括找伴侣、找朋友/搭子）免除干扰。
  - 若用户想继续参与任意类型的匹配，可随时在档案或匹配页直接重新开启参与状态，自由继续寻找伴侣或朋友/搭子。
- 数据一致性：
  - pair 去重；
  - 并发路径使用事务保护；
  - 已加 DB 硬限制，保障同一用户最多一段 active 主线。

### 3.4 撤回与风控

- 仅支持撤回单向等待中的心意；
- 双向已成立后不可撤回，包括 `queued` 和 `active` 状态；
- 单向撤回后不通知对方，对方也不会知道你曾投递过；
- 风控已启用：
  - 分钟级请求限流；
  - 24h 变更限制；
  - 单向撤回后 7 天冷却，前后端均校验。

### 3.5 通知策略

- 双向立即激活会发送邮件；
- queued 后续激活也会发送邮件；
- 邮件通知有幂等去重；
- 站内通知暂不启用。

## 4. 主要文件

- 后端核心：
  - `backend/src/services/heartboxService.ts`
  - `backend/src/services/studentIdService.ts`
  - `backend/src/routes/heartbox.ts`
  - `backend/src/routes/studentId.ts`
  - `backend/src/utils/studentId.ts`
  - `backend/src/db/schema.ts`
- 前端核心：
  - `frontend/src/pages/Heartbox.tsx`
  - `frontend/src/pages/StudentIdBind.tsx`
  - `frontend/src/pages/Dashboard.tsx`
  - `frontend/src/pages/Reveal.tsx`
  - `frontend/src/api/heartbox.ts`

## 5. 本地验证建议

1. 使用学号邮箱账号登录，进入 `/heartbox`，确认无需手动绑定即可投递；
2. 使用邮箱别名账号登录，进入 `/heartbox`，确认出现学号绑定引导；
3. 别名账号完成绑定后输入目标学号并投递：
   - 单向返回 `saved`，页面展示“等待双向心动”；
   - 双向命中返回 `matched` 或 `queued`；
4. 在单向等待时执行一次撤回，确认 7 天冷却；
5. 验证双向邮件通知链路。

## 6. 完成度判断

- 第一版核心投递链路：完成；
- 学号邮箱自动绑定：完成；
- 邮箱别名用户绑定后使用：完成；
- 第一版前端命名与交互文案：完成；
- 后续建议：上线后观察绑定冲突与误投递情况，再决定是否增加更细的账号申诉/合并流程。
