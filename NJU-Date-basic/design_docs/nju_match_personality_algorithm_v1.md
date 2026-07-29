# NJU Match 人格匹配算法（调整版）

> 版本：v1.0  
> 适用题库：NJU Match 问卷 v4.0  
> 目标：
> - 13 个人格可稳定区分
> - `sloth-mode` 约控制在 2%
> - `you-know-who` 不超过 8%
> - 同时兼容恋爱模式与找朋友模式
> - 可直接拆分到 `personalityEngine.ts` / `personalityConfig.ts`

---

## 1. 总体思路

整套人格算法不采用“答几题直接贴标签”的硬分类方式，而采用四层结构：

1. **题目映射到 10 个连续维度**
2. **再计算 3 个派生气质指标**
3. **用原型权重计算 11 个常规人格分数**
4. **再处理隐藏人格 `sloth-mode` 与兜底人格 `you-know-who`**

也就是说，最终人格不是某一道题直接决定的，而是整组维度综合后得到的结果。

---

## 2. 维度定义

统一计算 10 个连续维度，范围都归一到 `[0, 1]`：

- `drive`：驱动力
- `structure`：计划感
- `social_energy`：社交力
- `warmth`：温暖度
- `analytical`：理性感
- `reserved`：独处需求
- `freeflow`：随性感
- `campus_play`：活人感
- `attachment`：亲密需求
- `aesthetic`：氛围感

---

## 3. 基础映射规则

### 3.1 Likert 题归一化

7 点量表统一映射为：

```ts
const normLikert = (v: number) => (v - 1) / 6
```

即：

- 1 -> 0
- 4 -> 0.5
- 7 -> 1

---

### 3.2 单选题映射

单选题按选项配置固定分值，例如：

```ts
const trStyleMap = {
  detailed_plan: 1.0,
  rough_plan: 0.6,
  totally_random: 0.0,
}
```

---

### 3.3 多选题映射

多选题的处理方式建议为：

- 每个选项配置一个对某维度的贡献值
- 若用户选中则累加
- 最后除以理论最大值或已选数量归一化

推荐写成：

```ts
function scoreMultiSelect(selected: string[], optionWeights: Record<string, number>) {
  if (!selected?.length) return null
  const vals = selected.map(k => optionWeights[k] ?? 0)
  return vals.reduce((a, b) => a + b, 0) / selected.length
}
```

---

### 3.4 缺失题处理

朋友模式会跳过 `partnerOnly` 题。  
所以所有维度都采用 **有效作答权重归一化**：

```ts
score = answeredWeightedSum / answeredWeightSum
```

而不是把缺失题当 0 分。

同时建议为每个维度保留一个置信度：

```ts
confidence = answeredWeightSum / fullWeightSum
```

---

## 4. 10 个基础维度计算

---

### 4.1 `drive` 驱动力

核心意义：目标感、推进力、自我要求。

#### 题目权重

- `q_work_style`：0.26
- `q21`：0.15
- `q26`：0.12
- `q30`（反向）：0.08
- `q29.ambition`：0.18
- `q29.self_discipline`：0.12
- `q_partner_qualities.ambition`：0.09

#### 公式

```ts
drive =
  0.26 * normLikert(q_work_style) +
  0.15 * normLikert(q21) +
  0.12 * normLikert(q26) +
  0.08 * (1 - normLikert(q30)) +
  0.18 * has(q29, "ambition") +
  0.12 * has(q29, "self_discipline") +
  0.09 * has(q_partner_qualities, "ambition")
```

---

### 4.2 `structure` 计划感

核心意义：有序、稳定、提前安排。

#### 题目权重

- `q38`：0.34
- `q_schedule_imp`：0.16
- `q15`：0.10
- `q37`：0.12
- `q_tr_style`：0.18
- `q_spend_mode_imp`：0.10

#### 单选映射

```ts
q15Map = {
  early_sleep_early_rise: 0.8,
  early_sleep_late_rise: 0.65,
  late_sleep_late_rise: 0.45,
  late_sleep_early_rise: 0.35,
}

q_tr_styleMap = {
  detailed_plan: 1.0,
  rough_plan: 0.6,
  totally_random: 0.0,
}
```

---

### 4.3 `social_energy` 社交力

核心意义：互动能量、会不会把场子带起来。

#### 题目权重

- `q_atmosphere`：0.30
- `q_reply_speed`：0.18
- `q_free_time`：0.10
- `q_date_content`：0.24
- `q_weekend_date`：0.08
- `q_rel_mode`：0.10

#### 映射

```ts
q_atmosphereMap = {
  lively_talkative: 1.0,
  mix_talk_quiet: 0.72,
  quiet_comfy: 0.28,
  depends_mood: 0.58,
}

q_reply_speedMap = {
  very_fast: 0.95,
  normal: 0.65,
  slow: 0.25,
  depends_mood: 0.5,
}
```

#### `q_date_content` 建议权重

高社交项：

- `just_chat`: 1.0
- `eat_explore`: 0.8
- `walk_citywalk`: 0.7
- `live_concert`: 0.8
- `travel_nearby`: 0.7

中性项：

- `movie_series`: 0.5
- `gaming`: 0.45
- `sports`: 0.55
- `exhibition_photo`: 0.45
- `study`: 0.35

---

### 4.4 `warmth` 温暖度

核心意义：好接近、能接住人、有同理心。

#### 题目权重

- `q_support_pref`：0.24
- `q25`：0.17
- `q27`：0.10
- `q29.kindness`：0.16
- `q29.honesty`：0.08
- `q29.friendship`：0.08
- `q_partner_qualities.kindness`：0.10
- `q_partner_qualities.honesty`：0.07

#### `q_support_pref`

```ts
q_support_prefWarmthMap = {
  emotional_support: 1.0,
  both: 0.85,
  depends: 0.62,
  analyze_problem: 0.35,
}
```

---

### 4.5 `analytical` 理性感

核心意义：思考、逻辑、智性吸引。

#### 题目权重

- `q33`：0.28
- `q_support_pref`：0.14
- `q8`：0.12
- `q29.curiosity`：0.14
- `q29.independence`：0.08
- `q29.creativity`：0.07
- `q_read_type`：0.17

#### `q_support_pref`

```ts
q_support_prefAnalyticalMap = {
  analyze_problem: 1.0,
  both: 0.82,
  depends: 0.55,
  emotional_support: 0.25,
}
```

#### `q8` 兴趣映射

```ts
analyticalInterestMap = {
  programming_geek: 1.0,
  finance_business: 0.85,
  reading_writing: 0.75,
  boardgame_larp: 0.68,
  gaming: 0.52,
  photo_exhibitions: 0.45,
  movies_series: 0.35,
}
```

#### `q_read_type`

```ts
readTypeAnalyticalMap = {
  science_tech: 1.0,
  philosophy_social: 0.92,
  business_econ: 0.78,
  history_bio: 0.72,
  sci_fi_fantasy: 0.52,
  lit_fiction: 0.48,
  poetry_essay: 0.35,
}
```

---

### 4.6 `reserved` 独处需求

核心意义：需要空间、安静、低打扰。

#### 题目权重

- `q41`：0.42
- `q_atmosphere`：0.18
- `q_reply_speed`：0.10
- `q29.independence`：0.14
- `q29.freedom`：0.10
- `q_space_integration`：0.06

#### 映射

```ts
q_atmosphereReservedMap = {
  quiet_comfy: 1.0,
  mix_talk_quiet: 0.65,
  depends_mood: 0.55,
  lively_talkative: 0.15,
}

q_reply_speedReservedMap = {
  slow: 0.9,
  depends_mood: 0.65,
  normal: 0.45,
  very_fast: 0.2,
}
```

---

### 4.7 `freeflow` 随性感

核心意义：看感觉、看状态、不过度按表执行。

#### 题目权重

- `q38`（反向）：0.34
- `q_tr_style`：0.20
- `q_spend_style`：0.10
- `q_atmosphere`：0.10
- `q_reply_speed`：0.08
- `q_my_pace`：0.08
- `q_rel_mode`：0.10

#### 映射

```ts
q_tr_styleFreeflowMap = {
  totally_random: 1.0,
  rough_plan: 0.55,
  detailed_plan: 0.0,
}

q_spend_styleMap = {
  experience: 0.72,
  balanced: 0.5,
  material: 0.32,
}

q_rel_modeFreeflowMap = {
  casual_flow: 1.0,
  mutual_active: 0.62,
  prefer_partner_active: 0.42,
  proactive: 0.45,
}
```

---

### 4.8 `campus_play` 活人感

核心意义：鲜活、自然、校园日常感强。

#### 题目权重

- `q8`：0.22
- `q_atmosphere`：0.18
- `q_reply_speed`：0.12
- `q_date_content`：0.22
- `q_weekend_date`：0.08
- `q_free_time`：0.08
- `q_top_interest`：0.10

#### 兴趣映射建议

高活人感：

- `food_exploring`
- `travel_citywalk`
- `movies_series`
- `gaming`
- `boardgame_larp`
- `live_show`
- `ball_sports`
- `pets`

中低活人感：

- `reading_writing`
- `programming_geek`
- `finance_business`

---

### 4.9 `attachment` 亲密需求

核心意义：回应需求、陪伴需求、情感确认。

#### 题目权重（恋爱模式）

- `q_reply_pref`：0.26
- `q36`：0.22
- `q_affection_need`：0.20
- `q29.loyalty`：0.14
- `q_space_integration`：0.10
- `q47`：0.08

#### 朋友模式

只使用弱化版：

- `q_reply_pref`
- `q29.loyalty`
- `q_atmosphere`（轻微）
- `q_reply_speed`（轻微）

---

### 4.10 `aesthetic` 氛围感

核心意义：画面感、质感、审美气质。

#### 题目权重

- `q8`：0.24
- `q_date_content`：0.20
- `q_read_type`：0.18
- `q_music_style`：0.12
- `q_tr_type`：0.10
- `q_ph_direction`：0.16

#### 高氛围感兴趣

- `photo_exhibitions`
- `reading_writing`
- `fiction_fanfic`
- `movies_series`
- `music_listening`
- `live_show`
- `travel_citywalk`

---

## 5. 3 个派生气质指标

```ts
focus_aura =
  0.40 * drive +
  0.34 * analytical +
  0.26 * structure

conversational_pull =
  0.34 * analytical +
  0.33 * social_energy +
  0.33 * warmth

clutch_reliability =
  0.42 * drive +
  0.38 * structure +
  0.20 * (1 - freeflow)
```

说明：

- `focus_aura`：专注气场
- `conversational_pull`：对话吸引力
- `clutch_reliability`：关键时刻可靠度

---

## 6. 11 个常规人格原型打分

> 注意：`you-know-who` 与 `sloth-mode` 不参与常规竞争。

---

### 6.1 `hot-nerd`

```ts
S_hot_nerd =
  0.24 * focus_aura +
  0.18 * drive +
  0.16 * analytical +
  0.16 * structure +
  0.10 * reserved +
  0.06 * aesthetic +
  0.05 * (1 - social_energy) +
  0.05 * (1 - freeflow)
```

修正项：

- 若 `drive > 0.72 && analytical > 0.68 && structure > 0.62`，`+0.06`
- 若 `social_energy > 0.78 && campus_play > 0.78`，`-0.05`

---

### 6.2 `brain-bae`

```ts
S_brain_bae =
  0.26 * conversational_pull +
  0.20 * analytical +
  0.16 * warmth +
  0.14 * social_energy +
  0.08 * aesthetic +
  0.06 * campus_play +
  0.05 * (1 - reserved) +
  0.05 * attachment
```

修正项：

- 若 `analytical > 0.70 && social_energy > 0.62`，`+0.05`
- 若 `warmth < 0.38`，`-0.06`

---

### 6.3 `lab-cutie`

```ts
S_lab_cutie =
  0.24 * reserved +
  0.18 * (1 - social_energy) +
  0.16 * structure +
  0.12 * aesthetic +
  0.10 * focus_aura +
  0.08 * warmth +
  0.06 * (1 - campus_play) +
  0.06 * (1 - freeflow)
```

修正项：

- 若 `reserved > 0.72 && social_energy < 0.42`，`+0.06`
- 若 `campus_play > 0.72`，`-0.05`

---

### 6.4 `quiz-crush`

```ts
S_quiz_crush =
  0.30 * clutch_reliability +
  0.18 * drive +
  0.16 * structure +
  0.10 * analytical +
  0.08 * (1 - freeflow) +
  0.08 * (1 - social_energy) +
  0.10 * warmth
```

修正项：

- 若 `clutch_reliability > 0.72`，`+0.07`
- 若 `drive < 0.42`，`-0.06`

---

### 6.5 `campus-fox`

```ts
S_campus_fox =
  0.24 * campus_play +
  0.20 * social_energy +
  0.14 * freeflow +
  0.12 * warmth +
  0.10 * conversational_pull +
  0.08 * (1 - reserved) +
  0.06 * aesthetic +
  0.06 * attachment
```

修正项：

- 若 `campus_play > 0.75 && social_energy > 0.65`，`+0.06`
- 若 `reserved > 0.72`，`-0.06`

---

### 6.6 `book-charm`

```ts
S_book_charm =
  0.24 * aesthetic +
  0.18 * reserved +
  0.14 * (1 - social_energy) +
  0.14 * warmth +
  0.10 * (1 - campus_play) +
  0.10 * freeflow +
  0.10 * (1 - attachment)
```

修正项：

- 若 `aesthetic > 0.72 && reserved > 0.62`，`+0.05`
- 若 `social_energy > 0.78`，`-0.05`

---

### 6.7 `art-kid`

先定义：

```ts
creativityProxy =
  0.55 * has(q29, "creativity") +
  0.45 * aesthetic
```

再计算：

```ts
S_art_kid =
  0.26 * aesthetic +
  0.18 * freeflow +
  0.14 * creativityProxy +
  0.12 * reserved +
  0.10 * warmth +
  0.08 * (1 - structure) +
  0.06 * campus_play +
  0.06 * analytical
```

修正项：

- 若 `aesthetic > 0.75 && freeflow > 0.62`，`+0.07`
- 若 `structure > 0.80 && drive > 0.80`，`-0.05`

---

### 6.8 `soft-spirit`

```ts
S_soft_spirit =
  0.28 * warmth +
  0.18 * attachment +
  0.14 * social_energy +
  0.12 * (1 - structure) +
  0.10 * freeflow +
  0.10 * (1 - analytical) +
  0.08 * aesthetic
```

修正项：

- 若 `warmth > 0.78`，`+0.07`
- 若 `analytical > 0.82 && structure > 0.75`，`-0.05`

---

### 6.9 `hidden-boss`

```ts
S_hidden_boss =
  0.22 * focus_aura +
  0.18 * clutch_reliability +
  0.16 * drive +
  0.12 * structure +
  0.12 * reserved +
  0.08 * (1 - social_energy) +
  0.06 * analytical +
  0.06 * (1 - campus_play)
```

修正项：

- 若 `drive > 0.74 && reserved > 0.58`，`+0.06`
- 若 `social_energy > 0.85`，`-0.05`

---

### 6.10 `deadline-dancer`

```ts
S_deadline_dancer =
  0.28 * freeflow +
  0.18 * campus_play +
  0.14 * social_energy +
  0.12 * (1 - structure) +
  0.10 * drive +
  0.08 * aesthetic +
  0.06 * (1 - reserved) +
  0.04 * clutch_reliability
```

修正项：

- 若 `freeflow > 0.76 && structure < 0.42`，`+0.08`
- 若 `drive < 0.25 && structure < 0.25`，`-0.05`

---

### 6.11 `office-hour-angel`

```ts
S_office_hour_angel =
  0.24 * warmth +
  0.22 * analytical +
  0.16 * conversational_pull +
  0.12 * structure +
  0.10 * social_energy +
  0.10 * attachment +
  0.06 * (1 - freeflow)
```

修正项：

- 若 `warmth > 0.68 && analytical > 0.68`，`+0.08`
- 若 `social_energy < 0.28`，`-0.04`

---

## 7. `sloth-mode` 隐藏人格

`sloth-mode` 不走常规竞争，只在强命中时触发。  
目标占比：**约 2%**。

### 7.1 倾向分数

```ts
S_sloth =
  0.30 * warmth +
  0.18 * reserved +
  0.16 * (1 - social_energy) +
  0.12 * freeflow +
  0.10 * (1 - attachment) +
  0.08 * aesthetic +
  0.06 * (1 - structure)
```

### 7.2 硬门槛

必须同时满足：

- `warmth >= 0.72`
- `reserved >= 0.56`
- `social_energy <= 0.48`
- `attachment <= 0.62`
- `q_support_pref ∈ { emotional_support, both, depends }`
- `q_reply_speed !== very_fast`
- `q_atmosphere ∈ { quiet_comfy, mix_talk_quiet, depends_mood }`

### 7.3 额外区分条件

```ts
S_soft_spirit > 0.63
S_office_hour_angel < 0.66
```

也就是说：

- 它要比普通 `soft-spirit` 更慢、更低功耗
- 又不能过于像 `office-hour-angel` 那种“能讲明白、能续命”的理性支持型

### 7.4 占比控制

正式上线不要固定阈值，而应使用离线样本的 **98 分位数** 做动态阈值：

```ts
T_sloth = quantile(S_sloth_all_users, 0.98)
```

线上判断：

```ts
if (hardGate && S_sloth >= T_sloth) return "sloth-mode"
```

这样可以把占比稳定在约 2%。

---

## 8. `you-know-who` 兜底人格

`you-know-who` 不应作为普通人格之一参与竞争，而应当作为 **典型性不足时的 fallback**。  
目标占比：**不超过 8%**。

### 8.1 先求常规人格 top1 / top2

不包含：

- `sloth-mode`
- `you-know-who`

### 8.2 触发条件

设：

```ts
top1 = max(normalScores)
top2 = secondMax(normalScores)
margin = top1 - top2
std = stdDev([drive, structure, social_energy, warmth, analytical, reserved, freeflow, campus_play, attachment, aesthetic])
```

触发 `you-know-who` 的建议条件：

```ts
top1 < 0.56
|| (margin < 0.03 && top1 < 0.65)
|| std < 0.14
```

含义：

- 没有特别强命中的人格
- 或几个类型都像一点，但谁都不像到足够典型
- 或整个人维度过于均衡，没有明显尖峰

### 8.3 占比控制

若上线后 `you-know-who` 超过 8%，优先收紧以下阈值：

- `top1 < 0.56 -> top1 < 0.54`
- `margin < 0.03 -> margin < 0.025`
- `std < 0.14 -> std < 0.13`

---

## 9. 推荐目标分布

建议先瞄准以下大致区间：

- `hot-nerd`：9%–12%
- `brain-bae`：8%–11%
- `lab-cutie`：7%–10%
- `quiz-crush`：6%–9%
- `campus-fox`：10%–13%
- `book-charm`：7%–10%
- `art-kid`：5%–8%
- `soft-spirit`：8%–11%
- `hidden-boss`：6%–9%
- `deadline-dancer`：6%–9%
- `office-hour-angel`：7%–10%
- `you-know-who`：4%–8%
- `sloth-mode`：1.5%–2.5%

---

## 10. 最终分类流程

### 10.1 伪代码

```ts
function classifyPersonality(ans: Answers, mode: "dating" | "friend", tSloth: number) {
  const dims = computeDimensions(ans, mode)
  const derived = computeDerived(dims)
  const normalScores = computeNormalPrototypeScores(ans, dims, derived)

  // Step 1: sloth-mode
  if (hitSlothMode(ans, dims, normalScores, tSloth)) {
    return "sloth-mode"
  }

  // Step 2: you-know-who fallback
  if (hitYouKnowWho(dims, normalScores)) {
    return "you-know-who"
  }

  // Step 3: 常规人格 argmax
  return argmax(normalScores)
}
```

---

## 11. 推荐工程结构

### 11.1 `personalityEngine.ts`

负责：

- 读取答卷
- 计算 10 个基础维度
- 计算 3 个派生指标
- 计算原型得分
- 判定隐藏人格 / 兜底人格
- 输出最终人格 + top2 调试信息

### 11.2 `personalityConfig.ts`

负责：

- 每个题目对维度的映射权重
- 单选 / 多选题映射字典
- 11 个原型的权重表
- `sloth-mode` 阈值配置
- `you-know-who` fallback 阈值配置

---

## 12. 建议保留的调试输出

为了方便后续调权，建议每次都返回：

```ts
{
  type: "brain-bae",
  secondary: "office-hour-angel",
  dimensions: {
    drive: 0.63,
    structure: 0.48,
    social_energy: 0.72,
    warmth: 0.69,
    analytical: 0.81,
    reserved: 0.31,
    freeflow: 0.44,
    campus_play: 0.66,
    attachment: 0.52,
    aesthetic: 0.58,
  },
  derived: {
    focus_aura: 0.65,
    conversational_pull: 0.74,
    clutch_reliability: 0.59,
  },
  scores: {
    hot_nerd: 0.61,
    brain_bae: 0.74,
    lab_cutie: 0.36,
    quiz_crush: 0.49,
    campus_fox: 0.68,
    book_charm: 0.43,
    art_kid: 0.39,
    soft_spirit: 0.58,
    hidden_boss: 0.51,
    deadline_dancer: 0.45,
    office_hour_angel: 0.70,
  }
}
```

这样便于：

- 看 top1 / top2 是否合理
- 调整人格分布
- 检查某题是否拉偏整体结果

---

## 13. 上线前校准建议

正式上线前建议至少做一轮离线校准：

### 13.1 样本要求

- 最少 500 份有效答卷
- 最好 1500+ 份
- 恋爱模式 / 找朋友模式分开看分布

### 13.2 重点观察

1. `sloth-mode` 是否控制在 2% 左右
2. `you-know-who` 是否低于 8%
3. `soft-spirit / office-hour-angel / sloth-mode` 是否混淆
4. `hot-nerd / hidden-boss / quiz-crush` 是否混淆
5. `book-charm / art-kid` 是否混淆

### 13.3 调参顺序建议

优先调：

1. `sloth-mode` 的阈值
2. `you-know-who` 的 fallback 条件
3. 容易重叠的三组人格：
   - `soft-spirit / office-hour-angel / sloth-mode`
   - `hot-nerd / hidden-boss / quiz-crush`
   - `book-charm / art-kid`

---

## 14. 结论

这版算法的核心特点是：

- 先维度化，再原型化，而不是一题一判
- 能较好贴合 13 个人格文案的气质差异
- 支持朋友模式与恋爱模式共存
- 可通过分位数阈值把 `sloth-mode` 控在约 2%
- 可通过 fallback 条件把 `you-know-who` 压在 8% 以下
- 结构上可直接工程化落地

如果后续要继续开发，下一步最值得做的是：

1. 把这一版拆成 `config + engine`
2. 用历史答卷做一次离线模拟分布
3. 再做一轮精调阈值与人格占比
