# NJU Match - 前后端桥接实施计划 (Bridge Integration Plan)

本计划基于已完成的前端 UI（全 Mock 数据）与后端 API（全端点已实现并测试），定义将两端对接为完整可运行产品的实施路径。

**现状诊断**：前端 6 个核心页面均使用硬编码 Mock 数据，无任何 `fetch` 调用、无 Token 存储、无鉴权路由守卫。后端 `/api/v1` 下 Auth / User / Survey / Match / Admin 五大模块已就绪。

---

## 第零层：基础设施层 (Infrastructure Layer)

*所有页面对接的公共前置依赖，不可跳过。*

- [ ] **0.1 API Client 封装 (`frontend/src/api/client.ts`)**
  - 基于原生 `fetch` 封装统一请求函数（不引入 axios，保持零额外依赖）。
  - 自动注入 `Authorization: Bearer <token>` 请求头。
  - 统一拦截 `401` 响应 → 清除本地 Token → 跳转 `/login`。
  - 统一错误格式解析（适配后端 `{ error: { code, message, details } }` 结构）。
  - Base URL 读取 `import.meta.env.VITE_API_BASE`，默认 `http://localhost:3000/api/v1`。

- [ ] **0.2 Token 持久化 (`frontend/src/api/token.ts`)**
  - `getToken()` / `setToken()` / `clearToken()` 三件套。
  - 使用 `localStorage` 存储 JWT（配合 30 天有效期策略）。

- [ ] **0.3 Auth Context (`frontend/src/context/AuthContext.tsx`)**
  - React Context + Provider，管理全局认证状态。
  - 暴露 `user`、`isAuthenticated`、`isLoading`、`login()`、`logout()` 。
  - 应用启动时静默校验本地 Token（调 `GET /user/profile`），失败则清除。

- [ ] **0.4 路由守卫 (`frontend/src/components/ProtectedRoute.tsx`)**
  - 包裹需登录的路由（Dashboard / Survey / Reveal / Settings）。
  - 未登录 → 重定向 `/login`，登录后自动回跳原目标路径。
  - 已登录但 `profileComplete === false` → 重定向至档案建立流程。
  - 已登录但 `surveyComplete === false` → 重定向至问卷页。

- [ ] **0.5 环境变量与 Vite Proxy**
  - `frontend/.env.development` 增加 `VITE_API_BASE=http://localhost:3000/api/v1`。
  - `vite.config.ts` 配置 `/api` 代理到后端 3000 端口，解决本地开发 CORS。

---

## 第一层：身份认证桥接 (Auth Bridge)

*用户进入系统的唯一入口，阻塞所有后续功能。*

**对接页面**：`Login.tsx`
**对接端点**：`POST /auth/send-code` · `POST /auth/verify-code`

- [ ] **1.1 替换 Mock 登录逻辑**
  - Step 1（发送验证码）：将 `setTimeout(1000)` 替换为 `POST /auth/send-code`。
  - Step 2（验证 OTP）：将 `setTimeout(1000)` 替换为 `POST /auth/verify-code`。
  - 成功后调用 `setToken(res.token)` 持久化 JWT。

- [ ] **1.2 登录后路由决策**
  - 根据 `verify-code` 返回的 `isNewUser` / `profileComplete` / `surveyComplete` 三个字段决定跳转：
    - `isNewUser || !profileComplete` → `/settings`（建立档案）
    - `!surveyComplete` → `/survey`（填写问卷）
    - 全部完成 → `/dashboard`

- [ ] **1.3 错误状态 UI**
  - 429（频率限制）→ 显示冷却倒计时（60s）。
  - 401（验证码错误）→ 输入框震动 + 红色提示。
  - 网络错误 → Toast 提示"网络异常，请重试"。

---

## 第二层：用户档案桥接 (Profile Bridge)

*登录成功后的第一站（新用户）或低频维护入口（老用户）。*

**对接页面**：`Settings.tsx`
**对接端点**：`GET /user/profile` · `PUT /user/profile` · `PATCH /user/status` · `POST /user/avatar`

- [ ] **2.1 Settings 页数据加载**
  - 页面 mount 时调用 `GET /user/profile`，填充所有表单字段。
  - 加载中显示骨架屏（Skeleton），保持日记本视觉风格。

- [ ] **2.2 档案提交**
  - 将 inline edit 的保存动作对接 `PUT /user/profile`。
  - 新用户首次提交成功后，后端自动标记 `profileComplete = true`，前端跳转 `/survey`。

- [ ] **2.3 参与状态切换**
  - Dashboard 侧栏的"参与匹配"开关对接 `PATCH /user/status`。

- [ ] **2.4 头像上传**（可延后）
  - 对接 `POST /user/avatar`，multipart/form-data 上传。

---

## 第三层：灵魂问卷桥接 (Survey Bridge)

*匹配算法的数据源头，完成后方可参与每周匹配。*

**对接页面**：`Survey.tsx`
**对接端点**：`GET /survey/questions` · `POST /survey/submit` · `GET /survey/answers`

- [ ] **3.1 动态题目加载**
  - 替换 3 道 Mock 题为 `GET /survey/questions` 返回的 60 题完整题库。
  - 按 `sections` 分区渲染，支持 6 种题型（likert / single_select / multi_select / ranking / open_text / number_input）。

- [ ] **3.2 题型组件适配**
  - 当前 Survey 仅支持单选 UI，需新增：
    - `LikertScale` — 1-7 滑动条 + importance 1-3 权重选择。
    - `MultiSelect` — 多选（限选 N 项）。
    - `RankingInput` — 拖拽排序。
    - `OpenText` — 文本输入。
    - `NumberInput` — 数字输入。
  - 所有题型组件复用现有动画风格（framer-motion 渐入 + 自动推进）。

- [ ] **3.3 问卷提交**
  - 收集全部 60 题答案，调用 `POST /survey/submit`。
  - 成功 → 展示仪式感完成页 → 跳转 `/dashboard`。
  - 失败 400（缺题）→ 高亮未答题目，滚动定位。

- [ ] **3.4 问卷回显与修改**
  - 已提交用户再次进入问卷页，调用 `GET /survey/answers` 预填充。
  - 修改后重新提交覆盖。

---

## 第四层：仪表盘桥接 (Dashboard Bridge)

*用户主视图，聚合状态展示。*

**对接页面**：`Dashboard.tsx`
**对接端点**：`GET /user/profile` · `GET /match/current` · `GET /match/history`

- [ ] **4.1 用户信息加载**
  - 替换 Mock "李同学" 为 `GET /user/profile` 真实数据（昵称、头像、问卷/档案状态）。

- [ ] **4.2 匹配状态驱动**
  - 调用 `GET /match/current`，根据 `status` 字段切换 Dashboard 状态：
    - `PENDING` → 显示倒计时（使用返回的 `revealAt` 时间戳）。
    - `NO_MATCH` → 显示"本周暂无锦书"文案。
    - `REVEALED` → 显示"锦书已送达"按钮 → 点击跳转 `/reveal`。

- [ ] **4.3 历史记录加载**
  - "时光落叶"区域对接 `GET /match/history?page=1&limit=10`。
  - 替换 4 条 Mock 数据为真实历史匹配记录。
  - 支持滚动加载分页。

- [ ] **4.4 实时倒计时**
  - Timer 组件接收后端返回的 `revealAt` 而非硬编码时间。
  - 到达揭晓时间后自动刷新匹配状态。

---

## 第五层：锦书揭晓桥接 (Reveal Bridge)

*全站核心体验，拆信封 → 阅读报告 → 双选。*

**对接页面**：`Reveal.tsx`
**对接端点**：`GET /match/current` · `POST /match/action` · `GET /match/result/:matchId`

- [ ] **5.1 信封数据注入**
  - 进入 Reveal 页时调用 `GET /match/current`。
  - `status !== REVEALED` → 重定向回 `/dashboard`（防止直接 URL 访问）。
  - 将 `match.partner`、`match.insights`、`match.compatibilityScore` 注入信封 UI。

- [ ] **5.2 拆封后阅读真实报告**
  - 替换 Mock "宋同学 84.30%" 为真实匹配数据。
  - 维度分数（values / lifestyle / communication）映射至现有 UI 位置。
  - AI 策展寄语（`curatorNote`）展示在报告底部。

- [ ] **5.3 双选操作对接**
  - "愿见" → `POST /match/action { matchId, action: "ACCEPT" }`。
  - "止步" → `POST /match/action { matchId, action: "REJECT" }`。
  - 提交后立即查询 `GET /match/result/:matchId`：
    - `WAITING` → 显示等待对方状态。
    - `MUTUAL` → 特效 + 展示对方微信号。
    - `MISSED` → 信笺消散动画 → 返回 Dashboard。

- [ ] **5.4 防重复提交**
  - 已操作过（`myAction !== null`）→ 直接展示结果状态，禁用按钮。

---

## 第六层：全局体验增强 (Global UX Polish)

*桥接完成后的收尾打磨。*

- [ ] **6.1 全局 Loading 态**
  - 每个 API 调用期间显示与页面风格一致的加载态（非通用 Spinner）。
  - 按钮提交时 disabled + 内部 Loading 动画。

- [ ] **6.2 全局错误处理**
  - Network Error → 底部 Toast "网络不佳，请检查连接"。
  - 500 → "服务暂时开小差了"。
  - Token 过期 → 静默跳转登录页。

- [ ] **6.3 NavBar 登录态感知**
  - 已登录：显示用户昵称/头像 + "退出"。
  - 未登录：显示"登录"按钮。

- [ ] **6.4 页面切换过渡**
  - 确保 API 数据加载不破坏现有 framer-motion 页面转场动画。
  - 数据就绪后再触发入场动画（避免布局闪烁）。

---

## 实施顺序与依赖关系

```
第零层 (基础设施) ──────────────────────────────────┐
  │                                                  │
  ▼                                                  │
第一层 (Auth) ← 阻塞所有后续层                        │
  │                                                  │
  ├──▶ 第二层 (Profile)                              │ 所有层共用
  │      │                                           │ 0.1 API Client
  │      ▼                                           │ 0.2 Token
  │    第三层 (Survey)                                │ 0.3 Auth Context
  │                                                  │
  ├──▶ 第四层 (Dashboard) ← 依赖 Profile + Match API │
  │                                                  │
  └──▶ 第五层 (Reveal) ← 依赖 Match API              │
                                                     │
第六层 (UX Polish) ← 所有功能桥接完成后 ──────────────┘
```

**推荐执行序**：`0 → 1 → 2 → 3 → 4 → 5 → 6`（严格串行，每层验证通过后再推进下一层）

---

## 新增文件清单

| 路径 | 职责 |
|------|------|
| `frontend/src/api/client.ts` | 统一 fetch 封装 + 拦截器 |
| `frontend/src/api/token.ts` | JWT localStorage 读写 |
| `frontend/src/api/auth.ts` | Auth 端点调用函数 |
| `frontend/src/api/user.ts` | User/Profile 端点调用函数 |
| `frontend/src/api/survey.ts` | Survey 端点调用函数 |
| `frontend/src/api/match.ts` | Match 端点调用函数 |
| `frontend/src/context/AuthContext.tsx` | 全局认证状态 Provider |
| `frontend/src/components/ProtectedRoute.tsx` | 鉴权路由守卫 |
| `frontend/.env.development` | 开发环境 API 地址 |

**不新增**：不引入 axios / react-query / zustand / redux 等额外状态管理库。用 React Context + 页面级 `useEffect` 满足当前规模需求。

---

## 验收标准

每一层桥接完成后，应满足：

1. **Auth**：能用真实南大邮箱走通 发送OTP → 验证 → 获取Token → 自动跳转 的全流程。
2. **Profile**：新用户能建立档案，老用户能编辑并保存，数据持久化到 PostgreSQL。
3. **Survey**：60 道真题能加载、作答、提交，答案存入数据库并可回显。
4. **Dashboard**：展示真实用户信息 + 真实匹配状态 + 真实历史记录。
5. **Reveal**：拆信封看到真实匹配报告，双选操作写入数据库，双向奔赴交换微信。
6. **UX**：无布局闪烁、无未处理的 Loading/Error 态、Token 过期静默处理。
