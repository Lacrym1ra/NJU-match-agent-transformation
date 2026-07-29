# 圈子搭子匹配算法设计方案

## Context

NJU-Match 已有恋爱匹配系统。现在新增"搭子社交"圈子功能——基于兴趣的圈子（网球、读书、学习等），在圈内按需求匹配活动伙伴。

**核心产品逻辑**：搭子社交是工具性的。用户的痛点是"想打网球但找不到人"，不是"想深度了解一个人"。因此算法设计的第一原则是**轻量**——最小化用户填写负担，最大化匹配效率。

**与恋爱匹配的核心区别**：

- 非二部图：没有性别划分，任何人可匹配任何人
- 多匹配：每人每周 2-3 个匹配
- 组队：支持 2-4 人一组（网球双打、麻将等）
- 极简问卷：圈子只问 2-3 个活动相关问题，其余复用主 profile
- 无硬性 dealbreaker，用软降权替代

**圈子来源**：

- 管理员预设的原始圈子
- 用户自建圈子（LLM 自动审核去重）
- LLM 聚类自动建圈（基于用户兴趣标签，达到阈值自动触发）

---

## 一、数据来源设计——"零负担匹配"

### 1.1 全局时间表（用户设置一次，所有圈子共用）

在 `users` 表新增 `availableSlots` 字段，存储用户每周的可用时间段：

```typescript
// users 表新增
availableSlots: text('available_slots')  // JSON: string[]
// 格式: ["mon_morning", "mon_afternoon", "mon_evening", "tue_morning", ...]
// 7天 × 3段 = 21个可选slot
```

### 1.2 兴趣标签（用户自由输入，用于 LLM 聚类建圈）

在 `users` 表新增 `interestTags` 字段：

```typescript
// users 表新增
interestTags: text('interest_tags')  // JSON: string[]
// 用户自由输入，如 ["网球", "日语学习", "密室逃脱", "猫咖探店"]
```

这些标签是 LLM 聚类的数据来源，也可在圈子发现页展示。

### 1.3 信息分层

| 层级 | 来源 | 维度 | 用户操作 |
| --- | --- | --- | --- |
| **全局 profile** | `users` 表 | 校区、年级、院系、MBTI | 已填过，零操作 |
| **兴趣标签** | `users.interestTags` | 自由文本兴趣列表 | 设置一次 |
| **全局时间表** | `users.availableSlots` | 每周可用时间段 | 设置一次 |
| **圈子问卷** | `circleQuestions` | 技能水平、偏好等（1-5题） | 加入圈子时填 |

算法评分时自动从四层拉取数据，用户在圈子里只需填 2-3 个活动相关问题。

### 1.4 圈子问卷极简化

每个圈子的问卷由创建者/管理员定义，限制 **1-5 个问题**。典型示例：

**网球圈**：

- Q1: 你的球技水平？（1-7 scale，scoringMode: `skill_proximity`）
- Q2: 你偏好的打球方式？（single_choice: 休闲对打 / 竞技比赛 / 训练提升）

**读书会**：

- Q1: 你最近在读什么类型的书？（multi_choice: 文学/社科/科技/哲学/...）
- Q2: 你偏好的讨论方式？（single_choice: 深度讨论 / 轻松分享）

不需要问时间（全局时间表自动获取）。不需要问校区/年级（profile 自动获取）。

---

## 二、圈子创建机制

### 2.1 三种创建来源

| 来源 | 触发方式 | 问卷 | 审核 |
| --- | --- | --- | --- |
| 管理员预设 | Admin API | 管理员定义 | 无需 |
| 用户自建 | 用户提交申请 | 用户定义 1-5 题 | LLM 自动审核 |
| LLM 聚类 | 兴趣标签达到阈值 | LLM 自动生成 | 自动创建 |

### 2.2 用户自建圈子 + LLM 审核

用户提交创建请求时，LLM 执行以下检查：

```
输入：用户提交的 { name, description, category }
流程：
1. 从 DB 加载所有已有圈子的 name + description
2. 调用 LLM 判断：
   - 是否与已有圈子高度重复？→ 拒绝，建议加入已有圈子（返回推荐圈子）
   - 是否属于合理的兴趣/活动？→ 通过则自动发布
   - 是否含不当内容？→ 拒绝
3. 通过后自动发布，状态为 active
```

**Schema**：`circles` 表新增：

```diff
+ createdBy:  text('created_by').references(() => users.id)  // null = 管理员创建
+ source:     text('source').notNull().default('admin')      // 'admin' | 'user' | 'auto_cluster'
```

### 2.3 LLM 聚类自动建圈

**数据来源**：`users.interestTags` 中的自由文本标签。

**触发逻辑**：

```
1. 维护一张 interestTagCounts 视图/物化表：
   SELECT tag, COUNT(*) as user_count
   FROM (SELECT unnest(interest_tags) as tag FROM users)
   GROUP BY tag

2. 当某个标签/标签簇的 user_count >= threshold (默认 10) 时触发

3. LLM 聚类流程：
   a. 收集所有达到阈值的未建圈标签
   b. 调用 LLM 做语义聚类：
      - "网球" + "打网球" + "Tennis" → 合并为一个圈子
      - "日语" + "日语学习" + "日语N2备考" → 合并
   c. LLM 为每个聚类生成：
      - 圈子名称、描述、分类
      - 2-3 个推荐问卷问题（含 type、options、scoringMode）
   d. 自动创建圈子（source = 'auto_cluster'）
   e. 将标签匹配的用户加入圈子（isActive=true, answersComplete=false）
   f. 通知被拉入的用户填写圈子问卷
```

**阈值触发实现**：在匹配 pipeline 运行前（或独立 cron），检查未被圈子覆盖的标签计数。

**新增表 `interestTagCircleMap`**：

```sql
tag           TEXT NOT NULL
circle_id     TEXT NOT NULL REFERENCES circles(id)
PRIMARY KEY(tag, circle_id)
```

记录哪些标签已经被哪个圈子覆盖，避免重复建圈。

---

## 三、评分引擎

### 3.1 评分维度与权重

```
总分 = 时间重叠分 × W_time
     + 圈子问卷分 × W_circle
     + 校区相近分 × W_campus
```

默认权重（可在 `circles` 表配置）：

| 维度 | 默认权重 | 说明 |
| --- | --- | --- |
| `timeWeight` | 3.0 | 时间能对上是搭子的前提 |
| `circleWeight` | 2.0 | 活动偏好/水平匹配 |
| `campusWeight` | 1.0 | 同校区更方便约 |

**时间重叠是硬门槛**：若重叠 slot 数 = 0，直接跳过该 pair（等效 dealbreaker）。

### 3.2 各维度评分函数

#### 时间重叠分（`scheduleOverlapScore`）

```typescript
function scheduleOverlapScore(slotsA: string[], slotsB: string[]): number {
  const overlap = slotsA.filter(s => slotsB.includes(s)).length;
  if (overlap === 0) return 0;  // 硬门槛
  // 有 1-2 个重叠就够约一次，更多只是锦上添花
  return Math.min(overlap / 3, 1.0);  // 3个重叠即满分
}
```

#### 圈子问卷分（复用 + 扩展 `computeCircleScore`）

在 `circleQuestions` 表新增 `scoringMode` 字段，`computeCircleScore` 中按 mode 分发：

| scoringMode | 场景 | 计算方式 |
| --- | --- | --- |
| `standard`（默认） | 通用偏好 | 沿用现有 scale/choice/jaccard/spearman |
| `skill_proximity` | 球技、乐器水平 | `1 - abs(a-b) / maxDiff`，不含 importance |
| `skill_complementary` | 语言交换、互教 | `abs(a-b) / maxDiff`（差异越大越好） |

#### 校区相近分

```typescript
function campusScore(campusA: string, campusB: string): number {
  return campusA === campusB ? 1.0 : 0.3;
}
```

### 3.3 修正因子（叠加在总分上）

```typescript
function applyModifiers(baseScore: number, ctx: ModifierContext): number {
  let score = baseScore;

  // 1. 重复衰减：避免每周匹配同一对
  if (ctx.weeksSinceLastMatch !== undefined) {
    const decay = [0, 0.3, 0.6, 0.85, 1.0]; // index = weeksSince
    score *= decay[Math.min(ctx.weeksSinceLastMatch, 4)];
  }

  // 2. 新人加成：加入圈子前2周 ×1.15
  if (ctx.isNewMemberA || ctx.isNewMemberB) score *= 1.15;

  // 3. pair级历史：A曾拒绝B → ×0.3
  if (ctx.pairRejected) score *= 0.3;

  // 4. 质量信号：用户整体接受率作为微调
  // qualityScore = (accepts+1) / (revealed+2)，Laplace平滑
  score *= Math.sqrt(ctx.qualityA * ctx.qualityB);

  return Math.max(0, Math.min(score, 1.0));
}
```

---

## 四、匹配算法

### 4.1 非二部图贪心匹配（配对，groupSize=2）

**新文件 `backend/src/matching/circleMatching.ts`**

替换现有的 random 50/50 split + bipartite matching。当前实现（`circleService.ts:388-393`）随机把成员分两半再做二部图匹配，会遗漏跨组的最优 pair。

```typescript
function greedyNonBipartiteMatching(
  userIds: string[],
  scores: Map<string, number>,    // key: "idA:idB" where idA < idB
  maxMatchesPerUser: number,       // 默认 2
): { pairs: MatchPair[]; stats: MatchingStats }
```

算法：

1. 收集所有 `score > 0` 的无向边 `(A, B, score)`
2. 按 score 降序排序
3. 维护 `matchCount[userId]`，初始为 0
4. 遍历：若 `matchCount[A] < k && matchCount[B] < k`，匹配这对
5. 返回所有配对

复杂度：O(n² log n)。n=200 时约 2 万对，毫秒级。

### 4.2 组队匹配（groupSize = 3 或 4）

```typescript
function greedyGroupMatching(
  userIds: string[],
  pairScores: Map<string, number>,
  groupSize: number,              // 3 或 4
  groupsPerUser: number,          // 每人最多进几个组，默认 1
): { groups: GroupMatch[]; stats: GroupMatchingStats }
```

**算法（pair-merge 策略）**：

1. **n ≤ 50**：枚举所有 C(n, groupSize) 组合，计算组内平均配对分，按分排序贪心分配
2. **n > 50**：pair-merge 优化——
   - 先选出 top-3n 对配对（按 pairScore 排序）
   - groupSize=3：每个 top pair (A,B) 找最佳第三人 C，使 `(score(A,C) + score(B,C)) / 2` 最大
   - groupSize=4：两个 top pair 合并，取组内 C(4,2)=6 对平均分最高的合并
   - 按组分降序贪心分配

```typescript
interface GroupMatch {
  memberIds: string[];   // 长度 = groupSize
  avgScore: number;      // 组内所有 pair 的平均分
}
```

---

## 五、Schema 变更

### `users` 表新增

```diff
+ availableSlots: text('available_slots')   // JSON string[], 全局时间表
+ interestTags:   text('interest_tags')     // JSON string[], 兴趣标签
```

### `circles` 表新增字段

```diff
+ matchesPerWeek:       integer('matches_per_week').notNull().default(2)
+ groupSize:            integer('group_size').notNull().default(2)
+ timeWeight:           real('time_weight').notNull().default(3.0)
+ circleWeight:         real('circle_weight').notNull().default(2.0)
+ campusWeight:         real('campus_weight').notNull().default(1.0)
+ newMemberBoostWeeks:  integer('new_member_boost_weeks').notNull().default(2)
+ createdBy:            text('created_by').references(() => users.id)
+ source:               text('source').notNull().default('admin')
```

### `circleQuestions` 表新增字段

```diff
+ scoringMode: text('scoring_mode')  // 'standard' | 'skill_proximity' | 'skill_complementary'
```

### `circleMatches` 表

- **放松唯一索引**：`idx_circle_matches_circle_week_a` 和 `idx_circle_matches_circle_week_b` 改为非唯一（支持每人多匹配）

### 新增 `interestTagCircleMap` 表

```sql
tag           TEXT NOT NULL
circle_id     TEXT NOT NULL REFERENCES circles(id)
created_at    TIMESTAMP DEFAULT NOW()
PRIMARY KEY(tag, circle_id)
```

### 新增 `circleGroupMatches` 表

```sql
id            TEXT PRIMARY KEY
circle_id     TEXT NOT NULL REFERENCES circles(id)
week_of       TEXT NOT NULL
member_ids    TEXT NOT NULL        -- JSON: string[]
avg_score     REAL NOT NULL
status        TEXT NOT NULL DEFAULT 'LOCKED'
revealed_at   TIMESTAMP
created_at    TIMESTAMP DEFAULT NOW()
```

### 新增 `circleGroupActions` 表

```sql
id              TEXT PRIMARY KEY
group_match_id  TEXT NOT NULL REFERENCES circle_group_matches(id)
user_id         TEXT NOT NULL REFERENCES users(id)
action          TEXT               -- 'ACCEPT' | 'REJECT'
acted_at        TIMESTAMP
UNIQUE(group_match_id, user_id)
```

组 status 逻辑：全员 ACCEPT → MUTUAL；任一 REJECT → MISSED；超时 → EXPIRED。

---

## 六、Pipeline 总览

### 6.1 圈子匹配 Pipeline（`runCircleMatchingPipeline`）

```
1. 加载圈子配置（matchesPerWeek, groupSize, 权重们）
2. 加载合格成员（answersComplete + isActive）
3. JOIN users 表获取 campus + availableSlots
4. 加载历史：
   - circleMatches → 每对 weeksSinceLastMatch
   - circleMatches → 每人 qualityScore（接受率）
5. 计算评分：
   for (i, j) in allPairs:
     timeScore = scheduleOverlapScore(slotsI, slotsJ)
     if timeScore == 0: skip  // 硬门槛
     circleScore = computeCircleScore(answersI, answersJ, questions)
     campus = campusI == campusJ ? 1.0 : 0.3
     baseScore = weighted_avg(timeScore, circleScore, campus, weights)
     finalScore = applyModifiers(baseScore, context)
     scores.set(pairKey, finalScore)
6. 执行匹配：
   groupSize == 2 → greedyNonBipartiteMatching(ids, scores, matchesPerWeek)
   groupSize > 2  → greedyGroupMatching(ids, scores, groupSize, 1)
7. 写入 DB（pair → circleMatches, group → circleGroupMatches）
```

### 6.2 LLM 聚类 Pipeline（`runInterestClusteringPipeline`）

```
1. 统计所有用户 interestTags 的出现频次
2. 过滤掉已有 interestTagCircleMap 映射的标签
3. 筛选 count >= threshold（默认 10）的标签
4. 调用 LLM 做语义聚类（合并同义/近义标签）
5. 对每个聚类：
   a. 检查是否与已有圈子语义重叠（LLM 判断）
   b. 若不重叠：
      - LLM 生成圈子 name、description、category、2-3 个推荐问题
      - 创建圈子（source='auto_cluster'）
      - 插入 interestTagCircleMap 记录
      - 将匹配标签的用户加入圈子（answersComplete=false）
      - 通知用户
   c. 若重叠：更新 interestTagCircleMap 指向已有圈子
```

### 6.3 用户自建圈子审核（`reviewCircleCreation`）

```
1. 用户提交 { name, description, category, questions[] }
2. 加载所有已有圈子的 name + description
3. 调用 LLM：
   - 判断与已有圈子是否重复
   - 判断内容是否合理
4. 结果：
   - approved → 创建圈子（source='user', createdBy=userId）
   - duplicate → 返回推荐的已有圈子
   - rejected → 返回拒绝原因
```

---

## 七、需要修改/新建的关键文件

| 文件 | 操作 | 改动 |
| --- | --- | --- |
| `backend/src/db/schema.ts` | 修改 | users 加 availableSlots + interestTags；circles 加配置字段 + createdBy + source；circleQuestions 加 scoringMode；放松索引；新增 3 张表 |
| `backend/src/matching/circleMatching.ts` | **新建** | `greedyNonBipartiteMatching` + `greedyGroupMatching` |
| `backend/src/matching/circleCompatibility.ts` | 修改 | 新增 `scheduleOverlapScore`, `campusScore`, scoring mode 分发, `applyModifiers` |
| `backend/src/services/circleService.ts` | 修改 | 重构 pipeline；新增组队 CRUD/action；新增用户自建圈子 + LLM 审核 |
| `backend/src/services/circleClusterService.ts` | **新建** | LLM 聚类 pipeline：标签统计、语义聚类、自动建圈 |
| `backend/src/routes/circle.ts` | 修改 | 多匹配返回数组；新增组队端点；新增用户创建圈子端点 |
| `backend/src/routes/admin.ts` | 修改 | 圈子创建/更新支持新字段；手动触发聚类 |
| `backend/src/routes/user.ts` | 修改 | 支持 availableSlots + interestTags 的读写 |
| `backend/src/cron/weeklyMatch.ts` | 修改 | 添加圈子匹配 cron + 聚类检查 cron |

---

## 八、验证方案

1. **单元测试**（`circleMatching.test.ts`, `circleCompatibility.test.ts`）：
   - 非二部图贪心：k=1,2,3 时正确分配、边界 n=0,1,2
   - 组队匹配：groupSize=3,4 时正确分组且无人重叠
   - `scheduleOverlapScore`：0 重叠返回 0、3+ 重叠返回 1.0
   - 修正因子：重复衰减、新人加成、拒绝降权
   - scoring modes：skill_proximity、skill_complementary

2. **集成测试**（pipeline）：
   - 创建圈子 + 10 个成员 + 设置 availableSlots + 填问卷
   - 运行 pipeline，验证每人获得 matchesPerWeek 个匹配
   - 运行两周，验证第二周重复 pair 分数有衰减
   - groupSize=4 的圈子正确分组

3. **LLM 集成测试**：
   - 插入 15 个用户，其中 10 个有标签 "网球"/"打网球"/"Tennis"
   - 运行聚类 pipeline，验证自动创建一个网球圈子
   - 验证同义标签被正确合并
   - 用户自建圈子时提交重复名称，验证 LLM 返回推荐

4. **手动测试**：
   - Admin API 创建圈子（groupSize=2 和 groupSize=4）
   - 用户 API 自建圈子 → 观察 LLM 审核结果
   - API 加入 → 提交问卷 → 触发匹配 → accept/reject
   - 验证时间重叠为 0 的 pair 不被匹配
