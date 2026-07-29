# 问卷版本管理

## 版本号位置

`backend/src/services/surveyService.ts` 中的两个常量：

```typescript
const SURVEY_VERSION = '2.1';
const CHANGED_QUESTION_IDS = ['q4', 'q5'];
```

## 更新流程

每次修改问卷题目（新增、删除、修改选项/题型）时，按以下步骤操作：

1. **修改题库** — 编辑 `backend/src/db/seed.ts` 中的 `QUESTION_BANK`
2. **更新版本号** — 在 `surveyService.ts` 中将 `SURVEY_VERSION` 加 1（如 `'2.1'` → `'2.2'`）
3. **更新变更题目列表** — 将 `CHANGED_QUESTION_IDS` 替换为本次变更涉及的题目 ID 列表
4. **同步前后端** — 如果涉及匹配逻辑（dealbreakers/compatibility），同步更新 `backend/src/matching/` 下相关文件

## 前端表现

当用户已提交的问卷版本 < 当前版本时：

- **Dashboard**：问卷便条显示红点 + "有更新"状态；右侧主区域顶部显示可关闭的横幅提示
- **Survey 页面**：顶部显示更新横幅；模块导航标签上有红点；变更的题目标题旁显示红点 + "此题已更新，请重新确认"

用户重新提交问卷后，其 `version` 字段会更新为最新版本，提示自动消失。

## 版本历史

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| 1.0 | 初始 | 初始问卷 60 题 |
| 2.0 | 2026-03 | q4 增加指定省份选项；q5 由单选改为多选 |
| 2.1 | 2026-03 | 版本检测系统上线，标记 q4/q5 为变更题目 |
