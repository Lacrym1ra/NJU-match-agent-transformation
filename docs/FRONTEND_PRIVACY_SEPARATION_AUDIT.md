# 全站前端隐私分离审计

<!-- markdownlint-disable MD013 -->

> 审计范围：`NJU-Date-basic/frontend/src/App.tsx` 中 42 个路由模式，以及未独立路由的嵌套页面组件。
>
> 目标：“课程衍生版”与原项目在身份、数据、运营渠道和页面承诺上分离；不是只换 Logo 或隐私页标题。

## 1. 已完成的全局修正

- 每个 App 路由在 `modules/privacy/routePrivacy.ts` 中具有显式分类；
- `PrivacyBoundaryNotice` 在全部页面显示当前数据边界并链接到隐私说明；
- 契约测试直接读取 `App.tsx`，新增未分类路由时失败；
- `/agent-local` 在 production 构建返回 404，后端 dev-token 也只在 development 注册；
- 隐私页改为课程衍生版真实边界，明确原项目/校方无隶属和邮箱验证局限；
- About、Footer、UserAgreement、AccountSettings 移除原项目邮箱和小红书入口；
- Agent 数据流、测试数据、注销/去标识化和尚未完成的物理删除流程被明确披露。
- Chromium 测试验证公开页无认证悬浮层、未登录受保护路由会返回登录页，且 390px 下隐私标识与 Agent 入口不重叠。

## 2. 全部独立路由检查表

| 页面组 | 路由 | 分类 | 已完成 | 仍需浏览器验收 |
| --- | --- | --- | --- | --- |
| 公开介绍 | `/`、`/about`、`/changelog`、`/privacy` | public | 全局标识、课程衍生说明、独立联系渠道 | 首页每个营销承诺是否与真实能力一致；移动端标识是否遮挡 CTA |
| 身份入口 | `/login` | public | 协议已改为课程衍生版 | OTP 错误不枚举账号；勾选协议键盘可达；邮箱验证文案不等同学籍证明 |
| 公开性格体验 | `/personality-test`、`/personality-result` | public | 分类为提交前本地体验 | 确认是否写 localStorage/后端；结果转入账号前再次同意 |
| Agent 演示 | `/agent-demo` | public | 分类为离线演示 | 证明不读取登录态真实资料、不触发写操作和真实 Provider |
| 本地免登录 | `/agent-local` | development | production 返回 NotFound；后端仅 development 注册 | 用实际 production 镜像访问确认 404；确认构建产物不包含测试邮箱常量 |
| 个人首页/引导 | `/dashboard`、`/profile`、`/onboarding` | personal | ProtectedRoute + 当前用户边界 | 未登录、资料未完成和刷新状态；卡片是否意外公开敏感字段 |
| 问卷 | `/survey` | personal | ProtectedRoute + 问卷边界标签 | 自动保存、错误回显、浏览器缓存和返回键是否泄露答案 |
| 匹配与揭晓 | `/reveal`、`/heartbox`、`/heartbox/reveal` | personal | 个人/双方授权分类 | 联系方式在每个中间状态都不可提前显示；截图/缓存提示 |
| 身份绑定 | `/student-id/bind` | personal | 身份资料分类 | 明文输入、错误日志、重复绑定和页面缓存；不得在社区卡片暴露 |
| 设置与资料卡 | `/settings`、`/settings/card`、`/account` | personal | 当前用户分类；注销文案已修正 | 撤回同意、导出/删除缺口；资料卡可见字段预览准确性 |
| Agent 主页面 | `/agent` | agent | 最少上下文与写确认标签 | 逐工具检查输入/输出字段；Provider disclosure；刷新后 pending action 语义 |
| 共鸣胶囊 | `/resonance`、`/resonance/:id` | personal | 双方成员边界；单边回答前端不接收；真实 DB 双账号封存/揭晓与 Chromium 创建流程通过 | 人工模拟过期恢复与更高并发压力 |
| 安心赴约 | `/meetup-safety` | personal | 当前账号所有权；真实 DB 拒绝未签到完成；Chromium 创建/签到/完成通过 | 不同时区与移动端日期控件实机验收 |
| 圈子发现/详情 | `/circles`、`/circles/:id` | community | 成员与内容可见性分类 | 非成员、申请中、已拒绝、被移除状态的内容差异 |
| 圈子管理 | `/circles/:id/manage` | privileged | 圈主/授权成员分类 | 普通成员直接输入 URL；审核、踢人、解散操作的二次确认与审计 |
| 圈子组队 | `/circles/:id/teamups`、`/circles/:id/create-teamup`、`/circles/:id/teamups/:teamupId` | community | 联系信息/发布边界标签 | 加入前联系方式隐藏；退出/结束后的展示；举报与快照字段 |
| 圈内聊天 | `/circles/:id/livechat` | community | 仅圈内成员分类 | WebSocket ticket、断线重连、被移除后连接失效、历史消息访问 |
| 论坛 | `/forum`、`/forum/ranking`、`/forum/guestbook`、`/forum/:postId` | community | 可见性/匿名/反馈边界 | 私密帖、圈内帖、匿名作者、删除内容、举报错误状态 |
| 通知/关系/私信 | `/notifications`、`/user/:userId`、`/follows`、`/messages`、`/messages/:userId` | personal/community | 路由按资料可见性和参与者分类 | 越权直接 URL、搜索索引、已拉黑/注销用户、消息参与者校验 |
| 管理后台 | `/admin` | privileged | 独立 Key Gate + 来源网络检查，不复用用户会话 | 代理 IP 信任链、Key 尝试限制、登出、缓存头、审计日志脱敏 |
| 404 | `*` | public | 未知页面默认不显示私密数据 | 错误内容不包含堆栈、内部路径或用户状态 |

## 3. 非独立路由页面/组件

| 文件 | 当前角色 | 要求 |
| --- | --- | --- |
| `CircleForum.tsx`、`CircleList.tsx` | 圈子页面的嵌套/历史组件 | 继承父路由 community 边界；确认无隐藏的直接数据请求绕过父级权限 |
| `SettingPrivacyTab.tsx` | Settings 内嵌隐私设置 | 与新 Privacy 文案一致；不能承诺尚未实现的数据导出/物理删除 |
| `NotificationBell`、`GlobalAgent` | 全局悬浮组件 | 未登录时不得请求私密数据；与隐私标识在移动端不得相互遮挡 |
| Modal/Drawer/ResultCard | 跨页面覆盖层 | 关闭后清理敏感草稿；确认框展示真实资源和参数，不显示模型思维链 |

## 4. 数据与部署隔离要求

1. 课程版使用独立 PostgreSQL volume/schema，不导入原生产库；
2. 仅使用合成 seed 数据，测试邮箱统一 `@test.local`；
3. Cookie、JWT、API Key、Origin Certificate 和管理员 Key 均为本域独立值；
4. CORS 只允许实际课程版域名；Cookie 使用 `Secure`、`HttpOnly`、适当 `SameSite` 与主机范围；
5. 原项目邮箱、小红书或其他运营入口不得出现在课程版；
6. 日志、Trace、CI Artifact、截图和种子数据不得包含真实个人信息；
7. 真正接收用户前，补齐私密联系渠道、Provider 清单、保存期限、导出和备份删除流程。

独立支持邮箱通过 `VITE_SUPPORT_EMAIL` 在前端镜像构建时注入；未配置时，
管理员模板不会回退到原项目邮箱，而会明确提示该私密渠道尚未配置。

## 5. 自动化验收

```bash
cd NJU-Date-basic/frontend
npm run lint
npm test
npm run build
```

当前本地结果（2026-08-11）：TypeScript 通过；34/34 单元测试通过，其中隐私路由契约 3/3；Vite production build 通过；Project B 新模块与隐私边界 Chromium 共 6/6 通过。另外，Docker Compose 中的 production frontend、Express backend 与 PostgreSQL 已完成一次非 Mock 浏览器创建胶囊、创建赴约、签到与完成冒烟，并从数据库复核各一条记录。production build 产物检索不含 `agent-local@test.local` 或 `AgentLocalEntry` 测试入口常量。

自动化测试只能证明路由已分类和生产入口有代码保护，不能替代角色矩阵、网络请求和视觉遮挡的人工浏览器验收。
