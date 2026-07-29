# 论坛智能推荐 — 架构设计文档

> **版本**: v2.0  
> **分支**: `feature/g3-forum-recommendation`  
> **状态**: 设计中  

---

## 目录

1. [背景与目标](#1-背景与目标)
2. [推荐算法设计](#2-推荐算法设计)
3. [动态画像衰减机制](#3-动态画像衰减机制)
4. [问卷画像融入](#4-问卷画像融入)
5. [查询性能优化](#5-查询性能优化)
6. [技术架构](#6-技术架构)
7. [API 规范](#7-api-规范)
8. [前端交互设计](#8-前端交互设计)
9. [隐私与安全](#9-隐私与安全)
10. [实施计划](#10-实施计划)

---

## 1. 背景与目标

### 1.1 现状

NJU Match 论坛当前提供两种帖子排序方式：

| 排序 | 算法 | 特点 |
|------|------|------|
| 最新 (`sort=latest`) | 按 `created_at` 倒序，置顶帖优先 | 非个性化，时间线 |
| 最热 (`sort=hot`) | `(赞×3 + 藏×4 + 评×5 + 观×0.2) / (1 + hours/24)` | 非个性化，全局热度 |

两者都是**全局统一排序**，每位用户看到完全相同的列表。

### 1.2 目标

新增第三种排序——**推荐 (`sort=recommended`)**，形成三标签切换栏：

```
  [ 推荐 ]  [ 最新 ]  [ 最热 ]
```

融合两类信号为每位用户生成个性化帖子排序：

- **论坛互动信号**：类型偏好、相似用户、去重
- **匹配问卷信号**：MBTI 人格类型、兴趣爱好标签（仅服务端计算，不暴露）

### 1.3 设计原则

| 原则 | 说明 |
|------|------|
| **隐私优先** | 问卷答案仅在后端 SQL 中计算，绝不通过 API 返回 |
| **低侵入** | 仅新增 3 个 GIN 索引，无需新建数据表 |
| **动态衰减** | 画像权重随用户真实互动增长而降低，数据驱动接管 |
| **性能可控** | 30 天候选池裁剪 + pg_trgm/ FTS 索引加速 |
| **风格一致** | 沿用项目东方美学设计系统 |

---

## 2. 推荐算法设计

### 2.1 算法概述

**轻量级混合推荐**，全部计算在 PostgreSQL CTE 链中完成。

### 2.2 核心创新：动态衰减权重

画像信号和论坛数据信号之间的权重**不是常数**，而是用户互动次数 `total` 的函数：

```
设 total = 用户总互动数 (likes + favorites 涉及的帖子计数)

MBTI 权重:     mbtiW = max(0, 1 − total / 50)
问卷兴趣权重:  surveyW = max(0.05, 1 − total / 30)
```

**融合曲线**：

```
total │ mbtiW │ surveyW │  含义
──────┼───────┼─────────┼────────────────────────
   0  │ 1.00  │  1.00   │  纯画像驱动（冷启动）
  10  │ 0.80  │  0.67   │  画像主导，少量数据辅助
  25  │ 0.50  │  0.17   │  MBTI 半衰，问卷接近退场
  30  │ 0.40  │  0.05   │  问卷降至 5% 底线
  50  │ 0.00  │  0.05   │  完全数据驱动
 100+ │ 0.00  │  0.05   │  同上
```

**设计理由**：

- MBTI（人格类型）比兴趣标签更稳定，衰减更慢（50 次互动才归零）
- 问卷兴趣标签（填问卷时勾选的爱好）容易过时，衰减更快（30 次互动降至底线）
- `surveyW` 保留 0.05 底线而非归零——避免行为数据偶然走偏时推荐完全失向
- `mbtiW` 可以归零——因为论坛互动类型分布已能完全覆盖"用户喜欢什么类型内容"

### 2.3 推荐分公式

```
推荐分 = 
  类型偏好分 × 0.20
  + 协同过滤分 × 0.15
  + 画像匹配分 × 0.15
  + 新鲜度分 × 0.25
  + 质量信号分 × 0.25

其中:
  类型偏好分 = forumAffinity × (1 − mbtiW) + mbtiAffinity × mbtiW
  画像匹配分 = (mbtiTypeMatch × 0.4 + interestFtsMatch × 0.6) × surveyW
  新鲜度分   = EXP(-hours_since_creation / 72)
  质量信号分 = MIN(((赞×3 + 评×5 + 藏×4) / (hours_old + 2)) × 8, 1.0)
  协同过滤分 = MIN(similar_user_engagement / 5, 1.0)
```

### 2.4 各分量详解

#### 2.4.1 类型偏好分

```
typeAffinity(total):
  forumAffinity = 用户在每种类型的互动占比（来自 forum_post_likes + favorites）
  mbtiAffinity  = MBTI 静态映射的偏好向量
  mbtiW(total)  = max(0, 1 − total / 50)

  return forumAffinity × (1 − mbtiW) + mbtiAffinity × mbtiW
```

total=0（冷启动）：纯 MBTI 映射。  
total≥50（成熟用户）：纯论坛数据驱动。

**论坛数据获取**：

```sql
SELECT fp.type, COUNT(*)::int AS cnt
FROM (
  SELECT post_id FROM forum_post_likes WHERE user_id = :uid
  UNION ALL
  SELECT post_id FROM forum_post_favorites WHERE user_id = :uid
) i
JOIN forum_posts fp ON fp.id = i.post_id
WHERE fp.deleted_at IS NULL
GROUP BY fp.type
```

#### 2.4.2 画像匹配分

```
profileMatch(total):
  mbtiTypeMatch  = MBTI 当前映射的帖子类型归一化得分
  interestFtsMatch = 问卷兴趣标签 × 帖子内容 FTS rank 得分
  surveyW(total) = max(0.05, 1 − total / 30)

  return (mbtiTypeMatch × 0.4 + interestFtsMatch × 0.6) × surveyW
```

**`interestFtsMatch` 使用 PostgreSQL 全文检索**（见 §5.3）：

```sql
ts_rank(
  to_tsvector('simple', coalesce(fp.title, '') || ' ' || coalesce(fp.content, '')),
  to_tsquery('simple', :user_interest_tsquery)   -- 如 '影视 | 电影 | 运动 | 健身 | ...'
) AS interest_fts_match
```

#### 2.4.3 协同过滤分

```
collaborativeBoost = MIN(similar_user_engagement / 5, 1.0)

相似用户 = 论坛重叠度(0.65) + MBTI相似度(0.20) + 兴趣Jaccard(0.15)
共同点赞 ≥ 2 的阈值
```

#### 2.4.4 新鲜度分

```
freshness = EXP(-hours_since_creation / 72)
```

| 1h | 24h | 72h | 1 周 |
|----|------|------|------|
| 0.986 | 0.717 | 0.368 | 0.097 |

#### 2.4.5 质量信号分

```
quality = MIN(((like×3 + comment×5 + fav×4) / (hours_old + 2)) × 8, 1.0)
```

"+2" 防止新帖分母为零；系数 8 将典型高互动帖映射到 0.8-1.0 区间。

### 2.5 去重规则

已互动帖子从推荐结果中排除：

```sql
SELECT post_id FROM forum_post_likes WHERE user_id = :uid
UNION
SELECT post_id FROM forum_post_favorites WHERE user_id = :uid
UNION
SELECT post_id FROM forum_post_views WHERE user_id = :uid
UNION
SELECT post_id FROM forum_comments WHERE user_id = :uid AND deleted_at IS NULL
```

---

## 3. 动态画像衰减机制

### 3.1 设计逻辑

```
        冷启动 ───────────────→ 成熟用户
        画像权重 1.0              画像权重 → 0
        数据权重 0.0              数据权重 → 1.0
        
                    渐变曲线
  mbtiW    ████████████████░░░░░░░░░░░░░░  (50次互动归零)
  surveyW  ██████████░░░░░░░░░░░░░░░░░░░░  (30次互动降至0.05底线)
                 ↑                    ↑
              画像主导              数据主导
```

### 3.2 为什么 MBTI 和问卷兴趣用不同的衰减速度？

| | MBTI | 问卷兴趣标签 |
|---|------|-------------|
| **稳定性** | 人格类型几乎不变 | 兴趣爱好可能随时间变化 |
| **论坛可替代性** | 需要 50 次互动来覆盖 5 种类型的分布 | 20-30 次互动就能看到用户在哪些主题活跃 |
| **衰减到 0?** | ✅ 可以归零（互动已覆盖） | ❌ 保留 0.05 底线（防止行为漂移） |

### 3.3 MBTI 归零的风险防护

Q: 如果用户 total=50 但所有互动都在 "help" 类型上，forumAffinity 会退化为 {help: 1.0, others: 0.0}，导致其他类型完全不可见？

A: 论坛数据权重接管后需要**冷门类型保底**——在 `forumAffinity` 计算时加平滑：

```
平滑后的 forumAffinity = (原始计数 + 1) / (总计数 + 5)   // 拉普拉斯平滑，每个类型加 1 伪计数
```

这样即使所有互动集中在一种类型，其他类型仍有 1/(N+5) 的小权重，不会完全消失。

---

## 4. 问卷画像融入

### 4.1 MBTI → 帖子类型偏好映射

从 `users.mbti` 字段提取 4 个维度，每维度独立映射后取平均：

| 维度 | general | squad | help | trade | activity | 理由 |
|------|---------|-------|------|-------|----------|------|
| **E** 外向 | +0.10 | +0.10 | 0.00 | −0.05 | +0.15 | 偏好线下社交 |
| **I** 内向 | +0.10 | −0.05 | +0.15 | 0.00 | −0.10 | 偏好深度交流 |
| **S** 实感 | −0.05 | +0.05 | +0.10 | +0.10 | +0.05 | 务实、具体 |
| **N** 直觉 | +0.10 | 0.00 | −0.05 | −0.05 | +0.05 | 抽象、探索 |
| **T** 思考 | +0.10 | −0.05 | +0.15 | +0.05 | −0.05 | 理性分析 |
| **F** 情感 | 0.00 | +0.10 | −0.05 | −0.05 | +0.10 | 人际连接 |
| **J** 判断 | −0.05 | +0.05 | +0.10 | +0.05 | −0.05 | 结构化 |
| **P** 感知 | +0.10 | 0.00 | −0.05 | −0.05 | +0.10 | 灵活多变 |

**示例**：INTJ → 四维度平均 → help (0.0875) > general (0.0625) > trade (0.0125) > squad (−0.0125) > activity (−0.0375)

### 4.2 兴趣标签 → FTS 匹配

从 `survey_answers.answers::jsonb` 提取 q8 和 q_top_interest，映射为中文关键词：

| 问卷选项 | 关键词 |
|---------|--------|
| `movies_series` | 影视, 电影, 剧集, 追剧, 观影 |
| `gym_fitness`, `running_outdoor`, `ball_sports` | 运动, 健身, 跑步, 打球, 比赛 |
| `gaming` | 游戏, 电竞, 开黑, 联机, 手游, 端游 |
| `reading_writing` | 读书, 阅读, 书, 文学, 写作 |
| `music_listening`, `live_show` | 音乐, 听歌, 唱歌, 演唱会, 乐队 |
| `food_exploring` | 美食, 探店, 约饭, 餐厅, 小吃 |
| `travel_citywalk` | 旅行, 出游, 景点, 徒步, 打卡 |
| `boardgame_larp` | 桌游, 剧本杀, 狼人, 密室 |
| `photo_exhibitions` | 摄影, 展览, 画展, 博物馆 |
| `anime_acg` | 动漫, 二次元, ACG, 番, cos |

在 SQL 中构建 `tsquery` 并做 FTS rank 匹配（详见 §5.3）。

### 4.3 问卷相似度 → 协同过滤增强

```
sim(A, B) = 
  forum_overlap × 0.65    (共同点赞/收藏的帖子数)
  + mbti_sim × 0.20       (MBTI 类型相似度)
  + interest_jaccard × 0.15 (兴趣标签 Jaccard)
```

| MBTI 关系 | mbti_sim |
|-----------|----------|
| 完全相同 | 1.0 |
| 仅 E/I 不同 | 0.75 |
| 2 维度相同 | 0.50 |
| 1 维度相同 | 0.25 |
| 完全不同 | 0.0 |

---

## 5. 查询性能优化

### 5.1 候选池时间窗裁剪

MUST HAVE。在 CTE 链最前端裁剪，避免全表扫描：

```sql
candidate_pool AS (
  SELECT * FROM forum_posts fp
  WHERE fp.deleted_at IS NULL
    AND fp.visibility = 'public'
    AND fp.circle_id IS NULL
    AND fp.created_at > NOW() - INTERVAL '30 days'
)
```

后续所有 CTE 操作（评分、去重、协同）都在裁剪后的候选池上进行。30 天窗保证候选量 ≤ 500 条，全量评分 < 50ms。

### 5.2 pg_trgm 索引（加速通用关键词搜索）

论坛已有的 `keyword` 搜索使用 `title ILIKE '%term%' OR content ILIKE '%term%'`，无法使用常规 B-Tree 索引。引入 pg_trgm：

```sql
-- 迁移脚本 (028_forum_recommendation_indexes.ts)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_title_trgm 
  ON forum_posts USING GIN (title gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_content_trgm 
  ON forum_posts USING GIN (content gin_trgm_ops);
```

- pg_trgm 是 PostgreSQL 内置扩展，零依赖
- GIN 索引支持 `%任意位置%` 的 ILIKE 加速
- `CONCURRENTLY` 避免锁表
- 索引体积约为原始文本的 2-3 倍，校园论坛规模完全可承受

### 5.3 全文检索（FTS 替代 ILIKE 做兴趣匹配）

问卷兴趣标签与帖子内容的匹配，从多个 `ILIKE '%keyword%'` OR 链改为单个 FTS `ts_rank` 调用：

**前（低效）：**
```sql
CASE WHEN (
  fp.title ILIKE '%影视%' OR fp.content ILIKE '%影视%' OR
  fp.title ILIKE '%电影%' OR fp.content ILIKE '%电影%' OR
  ...  -- 10+ 个标签 × 5 个关键词 = 50+ 次 ILIKE
) THEN 1.0 ELSE 0.0 END
```

**后（高效）：**
```sql
-- 在 TypeScript 中构建 tsquery 字符串（如 '影视 | 电影 | 剧集 | 运动 | 健身 | ...'）
-- 在 SQL 中注入参数:
ts_rank(
  to_tsvector('simple', coalesce(fp.title, '') || ' ' || coalesce(fp.content, '')),
  to_tsquery('simple', :interest_tsquery_str)
) AS interest_fts_match
```

配套索引：

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_fts 
  ON forum_posts USING GIN (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content, ''))
  );
```

**优势对比**：

| | ILIKE 方案 | FTS 方案 |
|---|-----------|---------|
| 索引可用 | ❌ 顺序扫描 | ✅ GIN 索引加速 |
| 相关性 | 0/1 二元匹配 | `ts_rank` 连续分数 |
| 性能 | O(P × K) 全表 × 50+ 次模式匹配 | O(log P) 索引扫描 + 一次 rank |
| 语义 | 精确字符串匹配 | `'simple'` 配置按标点/空格分词 |

**`'simple'` 配置的限制**：不对中文做智能分词，依赖空格/标点分割。对校园论坛中文帖子而言，中文关键词通常作为完整词汇出现在文本中，`'simple'` 足以捕获。未来可升级 `zhparser` 或 `jieba` 分词器。

### 5.4 性能评估（优化后）

| 场景 | 优化前 | 优化后 | 关键改进 |
|------|--------|--------|---------|
| 冷启动 + 全量帖(2000) | ~200ms | ~30ms | 30d 窗裁剪至 ~300 条 |
| 活跃用户 + keyword搜索 | ~150ms (seq scan) | ~20ms | pg_trgm 索引 |
| 兴趣标签匹配 | ~80ms (50× ILIKE) | ~5ms | FTS + GIN 索引 |
| 50 QPS 并发 | 写锁风险 | 平稳 | 纯只读事务 |

---

## 6. 技术架构

### 6.1 整体数据流

```
┌───────────────────────────────────────────────────────────┐
│                       前端 (React)                         │
│  Forum.tsx, sort='recommended'                            │
│  Tab: [推荐] [最新] [最热]                                  │
└─────────────────────┬─────────────────────────────────────┘
                      │ GET /api/v1/forum/posts?sort=recommended
                      ▼
┌───────────────────────────────────────────────────────────┐
│                  路由层 (forum.ts)                          │
│  Zod校验: forumSort.enum(['latest','hot','recommended'])   │
│  JWT鉴权: requireAuth                                     │
└─────────────────────┬─────────────────────────────────────┘
                      │
                      ▼
┌───────────────────────────────────────────────────────────┐
│                服务层 (forumService.ts)                     │
│                                                           │
│  listPosts(userId, options)                               │
│    if sort === 'recommended':                             │
│      → listRecommendedPosts(userId, options)              │
│        → 读取 users.mbti + survey_answers.answers         │
│        → 计算 mbtiW(total) + surveyW(total) 衰减权重       │
│        → 构建用户兴趣 tsquery 字符串                        │
│        → CTE SQL: 30d池 → 去重 → 评分 → 排序 → 分页       │
│        → 返回 { total, page, limit, posts }               │
└─────────────────────┬─────────────────────────────────────┘
                      │
                      ▼
┌───────────────────────────────────────────────────────────┐
│                  PostgreSQL 16                             │
│  CTE 链 (按顺序):                                          │
│    ⓪ candidate_pool  (30d裁剪 + 基础过滤)                   │
│    ① user_mbti        (MBTI类型)                           │
│    ② user_survey_tags (兴趣标签)                            │
│    ③ user_affinity    (类型互动计数)                         │
│    ④ total_inter      (总互动数 → 衰减权重)                  │
│    ⑤ interacted       (去重集合)                            │
│    ⑥ similar_users    (协同相似度)                          │
│    ⑦ collab_posts     (协同候选帖)                          │
│    ⑧ interest_query   (FTS tsquery)                        │
│    ⑨ final SELECT     (五分量加权 + ts_rank)                │
│                                                           │
│  索引:                                                     │
│    pg_trgm GIN (title, content) — keyword ILIKE            │
│    FTS GIN     (title||content) — 兴趣标签匹配              │
└───────────────────────────────────────────────────────────┘
```

### 6.2 涉及的数据表

| 表 | 读取字段 | 用途 |
|----|---------|------|
| `forum_posts` | id, type, title, content, like_count, ..., created_at | 帖子主数据 + 评分 |
| `forum_post_likes` | post_id, user_id | 偏好 + 协同 + 去重 |
| `forum_post_favorites` | post_id, user_id | 偏好 + 去重 |
| `forum_post_views` | post_id, user_id | 去重 |
| `forum_comments` | post_id, user_id | 去重 |
| `users` | id, mbti | MBTI 映射 |
| `survey_answers` | user_id, answers (JSONB cast) | 兴趣标签 + 相似度 |

### 6.3 TypeScript 常量

```typescript
// ① MBTI 维度映射
const MBTI_DIM_WEIGHTS: Record<string, Record<ForumPostType, number>> = {
  E: { general: 0.10, squad: 0.10, help: 0.00, trade: -0.05, activity: 0.15 },
  I: { general: 0.10, squad: -0.05, help: 0.15, trade: 0.00, activity: -0.10 },
  S: { general: -0.05, squad: 0.05, help: 0.10, trade: 0.10, activity: 0.05 },
  N: { general: 0.10, squad: 0.00, help: -0.05, trade: -0.05, activity: 0.05 },
  T: { general: 0.10, squad: -0.05, help: 0.15, trade: 0.05, activity: -0.05 },
  F: { general: 0.00, squad: 0.10, help: -0.05, trade: -0.05, activity: 0.10 },
  J: { general: -0.05, squad: 0.05, help: 0.10, trade: 0.05, activity: -0.05 },
  P: { general: 0.10, squad: 0.00, help: -0.05, trade: -0.05, activity: 0.10 },
};

// ② 兴趣关键词映射
const INTEREST_KEYWORD_MAP: Record<string, string[]> = {
  movies_series:     ['影视', '电影', '剧集', '追剧', '观影'],
  gym_fitness:       ['运动', '健身', '跑步', '锻炼'],
  running_outdoor:   ['跑步', '户外', '徒步'],
  ball_sports:       ['打球', '比赛', '球类'],
  gaming:            ['游戏', '电竞', '开黑', '联机', '手游', '端游'],
  reading_writing:   ['读书', '阅读', '书', '文学', '写作'],
  music_listening:   ['音乐', '听歌', '唱歌', '演唱会', '乐队'],
  food_exploring:    ['美食', '探店', '约饭', '餐厅', '小吃'],
  travel_citywalk:   ['旅行', '出游', '景点', '城市', '打卡', '徒步'],
  boardgame_larp:    ['桌游', '剧本杀', '狼人', '密室'],
  photo_exhibitions: ['摄影', '展览', '画展', '博物馆', '拍照'],
  anime_acg:         ['动漫', '二次元', 'ACG', '番', 'cos'],
};

// ③ 动态衰减函数
function mbtiWeight(totalInteractions: number): number {
  return Math.max(0, 1 - totalInteractions / 50);
}

function surveyWeight(totalInteractions: number): number {
  return Math.max(0.05, 1 - totalInteractions / 30);
}

// ④ 拉普拉斯平滑（防止类型偏好过拟合）
function smoothTypeAffinity(counts: Record<string, number>, total: number): Record<string, number> {
  const types = ['general', 'squad', 'help', 'trade', 'activity'];
  return Object.fromEntries(
    types.map(t => [t, ((counts[t] ?? 0) + 1) / (total + 5)])
  );
}
```

---

## 7. API 规范

### 7.1 端点

```
GET /api/v1/forum/posts?sort=recommended&page=1&limit=20&type=help&keyword=考试
```

### 7.2 请求参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `sort` | `'latest' \| 'hot' \| 'recommended'` | 排序模式 |
| `page` | `integer` | 页码，默认 1 |
| `limit` | `integer` | 每页条数，默认 20，最大 50 |
| `type` | `'general' \| 'squad' \| 'help' \| 'trade' \| 'activity'` | 帖子类型筛选 |
| `keyword` | `string` | 标题/正文关键词搜索 |
| `authorScope` | 忽略 | 推荐模式下此参数被忽略 |

### 7.3 响应格式

与现有 `listPosts` 完全一致，**不新增任何字段**：

```json
{
  "total": 42,
  "page": 1,
  "limit": 20,
  "posts": [{ "postId": "uuid", "title": "...", ... }]
}
```

**关键约束**：响应中不包含 `mbti`、`surveyTags`、`recScore` 或任何问卷相关字段。

---

## 8. 前端交互设计

### 8.1 排序标签栏

```
┌──────────────────────────────────────────────────┐
│  ┌────────┐ ┌────────┐ ┌────────┐               │
│  │  推荐   │ │  最新   │ │  最热   │    [搜索框]   │
│  └────────┘ └────────┘ └────────┘               │
│   (默认选中，白底+阴影)   (灰色文字)              │
└──────────────────────────────────────────────────┘
```

### 8.2 推荐模式下的 UI 变化

- **scope 按钮组**（全部/我的/赞过/收藏）：`text-[#8B7355]/30 cursor-not-allowed`，点击无响应
- **提示文字**：`text-[10px] text-[#8B7355]/40` 显示 "推荐模式下不区分范围"
- **切换到最新/最热**：scope 自动恢复

### 8.3 加载态与空态

| 状态 | UI |
|------|-----|
| 加载中 | "墨迹未干，卷轴正在展开..." |
| 无推荐结果 | "暂无新推荐，不妨换个标签看看" |

---

## 9. 隐私与安全

### 9.1 数据访问控制

| 层级 | 措施 |
|------|------|
| **SQL 层** | 问卷数据仅在 CTE 中计算，不进入最终 SELECT 列 |
| **服务层** | `listRecommendedPosts` 返回的 PostListItem 不含问卷字段 |
| **API 层** | 响应 JSON 经现有 Zod schema 校验，无额外字段泄漏 |
| **前端** | 不新增任何问卷/画像 state 或展示 |

### 9.2 防滥用

| 风险 | 缓解 |
|------|------|
| 通过反复请求推测推荐逻辑 | 推荐分不返回，无法获取中间计算值 |
| 通过帖子排序反推他人 MBTI | MBTI 映射是全局静态映射，不针对个人 IP |
| 问卷答案推断 | 仅使用 q8(兴趣) 和 q_top_interest，不使用核心价值观/情感等敏感维度 |

---

## 10. 实施计划

### 10.1 文件变更

| 文件 | 操作 | 内容 | 工作量 |
|------|------|------|--------|
| `backend/src/services/forumService.ts` | **修改** | 衰减函数 + MBTI映射 + 兴趣映射 + CTE SQL + listRecommendedPosts + listPosts 分支 | 核心 ~180 行 |
| `backend/src/routes/forum.ts` | **修改** | Zod enum 加 `'recommended'` | 1 行 |
| `backend/src/db/migrations/028_*.ts` | **新建** | pg_trgm 扩展 + 3 个 GIN 索引 | ~30 行 |
| `frontend/src/api/forum.ts` | **修改** | `ForumSort` 类型加 `'recommended'` | 1 行 |
| `frontend/src/pages/Forum.tsx` | **修改** | 三标签 + scope 禁用 | ~30 行 |

**总计**: 5 文件，~240 行代码，含 1 个新迁移脚本。

### 10.2 实施步骤

| 步骤 | 内容 | 预估 |
|------|------|------|
| 1 | 迁移: pg_trgm 扩展 + 3 个 GIN 索引 | 20min |
| 2 | 后端: 添加衰减函数 + MBTI 映射 + 兴趣关键词映射常量 | 30min |
| 3 | 后端: 实现 CTE SQL（candidate_pool + FTS + 动态权重） | 2h |
| 4 | 后端: 实现 `listRecommendedPosts()` + 修改 `listPosts()` 分支 | 1h |
| 5 | 后端: 修改路由 Zod schema | 5min |
| 6 | 前端: 更新类型 + Forum.tsx 三标签 + scope 禁用 | 40min |
| 7 | 集成测试: 启动本地 + curl 验证 + 前端交互 | 30min |
| 8 | 自查: 边界情况 + 隐私检查 + EXPLAIN 索引确认 | 20min |

**总预估**: ~5.5 小时

### 10.3 验证清单

- [ ] pg_trgm 扩展安装成功，3 个 GIN 索引创建成功
- [ ] EXPLAIN 确认 ILIKE keyword 搜索走 Index Scan（非 Seq Scan）
- [ ] EXPLAIN 确认兴趣 FTS 匹配走 GIN Index Scan
- [ ] `sort=recommended` 返回 200 且有帖子数据
- [ ] 冷启动用户(total=0)：mbtiW=1.0, surveyW=1.0，纯画像驱动
- [ ] 成熟用户(total≥50)：mbtiW=0, surveyW=0.05，数据驱动
- [ ] 30 天外帖子不出现在推荐中
- [ ] 去重正确性
- [ ] API 响应不含任何问卷字段
- [ ] 前端三标签切换正常
- [ ] 推荐模式下 scope 灰显
- [ ] 切回最新/最热 scope 恢复

### 10.4 演进路线

| 阶段 | 项目 | 触发条件 |
|------|------|---------|
| **本次 MVP** | 30d 时间窗 + pg_trgm + FTS + 动态衰减 | 立即 |
| 观察期 | 游标分页替代 OFFSET（前后端联动） | 帖量 > 1000 |
| 远期 | PG 物化视图定时刷新用户推荐分 | 日活 > 5000 |
| 远期 | Redis 缓存热点用户推荐快照 | 日活 > 10000、QPS > 200 |

---

> **设计者注**: 本方案在隐私、性能、实现成本之间寻找平衡点。问卷数据作为"暗信号"参与计算但不暴露，动态衰减确保"画像预设"平滑过渡到"数据驱动"，是 NJU Match 区别于通用论坛产品的核心差异化能力。
