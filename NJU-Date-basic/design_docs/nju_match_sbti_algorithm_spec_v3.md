# NJU Match 人格分型算法方案（SBTI 式）v3

## 目标

为 NJU Match 提供一套 **可工程落地、可解释、可调参、可做 A/B Test** 的人格分型方案。

本版在 v2 基础上继续修订，重点解决以下问题：

- 现有 `you-know-who` 兜底比例过高（已观测到约 60%）
- 部分主人格边界仍然过近，导致大量用户被送入兜底
- 找朋友 / 搭子模式下，由于题目减少，区分度下降，但旧阈值会进一步放大兜底比例
- 新增一个 **超稀有隐藏人格**（树懒人设），要求触发比例 **< 1%**

因此，本版采用：

- **9 个主人格**
- **2 个普通彩蛋人格**
- **1 个兜底人格**
- **1 个超稀有隐藏人格**

即：

> **9 + 2 + 1 + 1**

---

## 一、类型结构

### A. 9 个主人格

- `hot-nerd`｜性感书呆子
- `brain-bae`｜智性天菜
- `lab-cutie`｜工位白月光
- `quiz-crush`｜考前限定款
- `campus-fox`｜校园活人
- `book-charm`｜图书馆留白派
- `code-flirt`｜代码味桃花
- `soft-spirit`｜人间缓冲区
- `low-key-ace`｜静音大佬

### B. 2 个普通彩蛋人格

- `deadline-dancer`｜DDL 踩点艺术家
- `office-hour-angel`｜续命天使

### C. 1 个兜底人格

- `you-know-who`｜你知道的那种

### D. 1 个超稀有隐藏人格

- `sloth-mode`｜树懒人设（暂定英文键名）

说明：

- `sloth-mode` 不与普通彩蛋放在同一层处理
- `sloth-mode` 的触发逻辑更严格、频率目标更低、上线后需要单独做频率校准

---

## 二、总体流程（v3）

整个流程分为 5 层：

### Step 1：问卷答案标准化

将题目统一映射为数值特征。

### Step 2：超稀有隐藏人格判定

优先判定 `sloth-mode`，仅在极高置信度下触发。

### Step 3：普通彩蛋人格判定

判定：

- `deadline-dancer`
- `office-hour-angel`

### Step 4：9 个主人格打分

先抽中层轴与派生指标，再对 9 个主人格计算原型相似度。

### Step 5：兜底人格判定

只有在 **多项置信度信号同时偏弱** 的情况下，才落入 `you-know-who`。

---

## 三、中层人格轴设计

继续采用 10 个主轴，不直接用 90+ 题对 13 个结果类型做硬映射。

### 轴 A：上进 / 目标导向（drive）

反映：是否目标清晰、投入度高、偏效率驱动。

主要题目：

- `q21`
- `q_work_style`
- `q29` 中 `ambition` / `self_discipline`
- `q_partner_qualities` 中 `ambition` / `self_discipline`
- `q26`

### 轴 B：秩序 / 计划感（structure）

反映：是否讲条理、讲计划、讨厌随机性。

主要题目：

- `q38`
- `q_tr_style`
- `q15`
- `q_schedule_imp`

### 轴 C：社交外放度（social_energy）

反映：是否热闹、主动、表达欲强。

主要题目：

- `q_atmosphere`
- `q_rel_mode`
- `q_reply_speed`
- `q36`
- `q_affection_need`

### 轴 D：温和 / 照顾型（warmth）

反映：是否会照顾人、给人舒服感、偏情绪支持。

主要题目：

- `q_support_pref`
- `q25`
- `q27`
- `q29` / `q_partner_qualities` 中 `kindness` / `honesty` / `loyalty` / `friendship`

### 轴 E：理性分析感（analytical）

反映：是否偏脑力型、分析型、技术型。

主要题目：

- `q33`
- `q_support_pref = analyze_problem / both`
- `q29` 中 `curiosity` / `independence` / `creativity`
- `q8` 中 `programming_geek` / `finance_business` / `reading_writing`

### 轴 F：低调 / 独处需求（reserved）

反映：是否偏安静、是否需要个人空间。

主要题目：

- `q41`
- `q_atmosphere`
- `q_reply_speed`
- `q_space_integration`
- `q36`（反向）

### 轴 G：松弛 / 随性（freeflow）

反映：是否佛系、看感觉、不喜欢被强控制。

主要题目：

- `q_work_style` 反向
- `q38` 反向
- `q_tr_style`
- `q_rel_mode = casual_flow`
- `q_my_pace = depends / fast_if_chemistry`
- `q_atmosphere = depends_mood`

### 轴 H：校园活人感（campus_play）

反映：是否有活人感、会接话、会来事、参与校园生活。

主要题目：

- `q_date_content`
- `q8` 中 `boardgame_larp` / `food_exploring` / `travel_citywalk` / `gaming` / `live_show`
- `q_atmosphere`
- `q_rel_mode`
- `q_reply_speed`

### 轴 I：关系敏感 / 安全感需求（attachment）

反映：是否在意回应速度、关系节奏、亲密表达。

主要题目：

- `q_reply_pref`
- `q36`
- `q_affection_need`
- `q_physical_pace`
- `q47`
- `q48`

### 轴 J：文艺 / 氛围感（aesthetic）

反映：是否偏书影音、展览、城市漫步等氛围型内容。

主要题目：

- `q8` 中 `movies_series` / `photo_exhibitions` / `reading_writing` / `fiction_fanfic` / `travel_citywalk` / `music_listening` / `live_show`
- `q_mv_type`
- `q_music_style`
- `q_read_type`
- `q_tr_type`

---

## 四、派生指标（v3）

这几个指标不一定升级成新的主轴，但建议在主人格打分中显式参与，用来承接文案上的关键气质。

### 1. 专注感（focus_aura）

用于区分：`hot-nerd` vs `brain-bae` vs `low-key-ace`

反映：是否“认真做事时很有杀伤力”。

建议由以下题目组合：

- `q_work_style`
- `q38`
- `q21`
- `q29` 中 `self_discipline` / `ambition`
- `q_reply_speed`（`depends_mood` 降分）
- `q_atmosphere`（`quiet_comfy` / `mix_talk_quiet` 加分）

### 2. 对话吸引力（conversational_pull）

用于区分：`brain-bae` vs `hot-nerd` vs `code-flirt`

反映：是否“聊天本身就很勾人”。

建议由以下题目组合：

- `q_atmosphere`
- `q_support_pref`
- `q_reply_speed`
- `q_conflict_self`
- `q29` 中 `curiosity` / `creativity`
- `q33`

### 3. 关键时刻可靠度（clutch_reliability）

用于区分：`quiz-crush` vs `hot-nerd` vs `low-key-ace`

反映：是否在考试周、DDL 周、任务节点会“突然升值”。

建议由以下题目组合：

- `q_reply_speed`
- `q_support_pref`
- `q_conflict_self`
- `q38`
- `q_work_style`
- `q21`
- `q_date_content` 中 `study`

### 4. 稳定结果感（result_stability）

用于区分：`low-key-ace` vs `quiz-crush` vs `hot-nerd`

反映：不是短期爆发，而是长期稳定、安静但持续能打。

建议由以下题目组合：

- `q_work_style`
- `q38`
- `q_conflict_self`
- `q_reply_speed`
- `q_schedule_imp`
- `q15`

---

## 五、题目到分值的统一映射规则

### 1. Likert 题

将原始 `1~7` 映射到 `0~100`：

```text
score = ((answer - 1) / 6) * 100
```

### 2. Single Select 题

每个选项映射到一个或多个轴的固定分值。

例如 `q_atmosphere`：

- `lively_talkative` → `social_energy +100`, `reserved +0`
- `mix_talk_quiet` → `social_energy +60`, `reserved +40`
- `quiet_comfy` → `social_energy +20`, `reserved +80`
- `depends_mood` → `freeflow +80`, `social_energy +50`

### 3. Multi Select 题

不建议简单按“选没选”粗暴加满。

建议两种策略：

- **均分累计**：每项按预设权重加分，再按所选项数归一
- **Top-N capped sum**：只取最相关的前 N 项，避免“选得多的人占便宜”

### 4. Range / Number Input

以下题目不进入人格分型，只进入匹配算法：

- `q1`
- `q2`
- `q_height`
- `q_height_range`

---

## 六、10 个主轴的计算建议

### 1. drive

```text
drive =
0.30 * norm(q_work_style)
+ 0.20 * norm(q21)
+ 0.15 * ambition_traits
+ 0.15 * self_discipline_traits
+ 0.10 * norm(q26)
+ 0.10 * partner_ambition_pref
```

### 2. structure

```text
structure =
0.40 * norm(q38)
+ 0.25 * tr_style_score
+ 0.20 * norm(q_schedule_imp)
+ 0.15 * sleep_regular_score
```

其中 `q_tr_style` 建议：

- `detailed_plan = 100`
- `rough_plan = 60`
- `totally_random = 0`

### 3. social_energy

```text
social_energy =
0.35 * atmosphere_score
+ 0.20 * rel_mode_score
+ 0.20 * reply_speed_score
+ 0.15 * companionship_need
+ 0.10 * date_content_social
```

### 4. warmth

```text
warmth =
0.30 * support_pref_score
+ 0.25 * norm(q25)
+ 0.20 * norm(q27)
+ 0.15 * kindness_traits
+ 0.10 * friendship_traits
```

### 5. analytical

```text
analytical =
0.35 * norm(q33)
+ 0.20 * support_analysis_score
+ 0.20 * curiosity_independence_score
+ 0.15 * geek_interest_score
+ 0.10 * science_tech_reading_score
```

### 6. reserved

```text
reserved =
0.35 * norm(q41)
+ 0.25 * quiet_atmosphere_score
+ 0.15 * slow_reply_score
+ 0.15 * low_clinginess_score
+ 0.10 * independent_space_score
```

### 7. freeflow

```text
freeflow =
0.30 * inverse_norm(q38)
+ 0.25 * random_trip_score
+ 0.20 * casual_rel_mode_score
+ 0.15 * depends_mood_score
+ 0.10 * inverse_norm(q_work_style)
```

### 8. campus_play

```text
campus_play =
0.30 * social_interest_score
+ 0.25 * lively_atmosphere_score
+ 0.20 * active_rel_mode_score
+ 0.15 * fast_reply_score
+ 0.10 * outing_date_score
```

### 9. attachment

```text
attachment =
0.25 * norm(q_reply_pref)
+ 0.25 * norm(q36)
+ 0.20 * norm(q_affection_need)
+ 0.15 * physical_pace_score
+ 0.15 * jealousy_related_score
```

### 10. aesthetic

```text
aesthetic =
0.35 * aesthetic_interest_score
+ 0.20 * movies_music_books_score
+ 0.20 * exhibitions_photo_score
+ 0.15 * citywalk_score
+ 0.10 * aesthetic_date_score
```

---

## 七、超稀有隐藏人格：`sloth-mode`

### 定位

该人格不属于普通彩蛋，而属于 **超稀有隐藏人格**。

设计目标：

- 触发比例 **< 1%**
- 仅在非常鲜明、非常稳定命中的情况下出现
- 体现的不是“废”，而是：
  - 慢
  - 低耗能
  - 不争
  - 不急
  - 拖延但仍能活
  - 一种低速、省电、缓慢加载的生存气质

### 强门槛建议

必须同时满足：

- `drive <= 28`
- `structure <= 30`
- `freeflow >= 72`
- `social_energy <= 42`
- `q_reply_speed in [slow, depends_mood]`
- `q38 <= 2`
- `q_work_style <= 2`

再满足以下至少 2 项：

- `q_atmosphere in [quiet_comfy, depends_mood]`
- `q41 >= 5`
- `q_tr_style = totally_random`
- `q_support_pref in [emotional_support, depends]`
- `q_date_content` 偏 `just_chat / walk_citywalk`

### 软条件打分

```text
sloth_score =
0.25 * freeflow
+ 0.20 * inverse_drive
+ 0.20 * inverse_structure
+ 0.15 * reserved
+ 0.10 * low_social_energy
+ 0.10 * soft_pace_behavior
```

### 触发条件

- `sloth_score >= 85`
- 满足所有强门槛
- 比普通彩蛋第一名至少高 `6` 分
- 比主人格第一名至少高 `8` 分

### 上线后频率校准

建议每 500 或 1000 个样本做一次实际占比统计：

- 若 `sloth-mode > 1%`，提高阈值
- 若 `< 0.3%`，可适度降低阈值

建议稳定区间：

- **0.3% ~ 1.0%**

---

## 八、普通彩蛋人格规则（2 个）

彩蛋人格采用：

**规则门控 + 附加验证**

而不是和主人格一起混合竞争。

### 1. `deadline-dancer`｜DDL 踩点艺术家

#### 气质

计划感不高、临场发挥、节奏型生存，不是完全摆烂，但经常踩点活下来。

#### 硬门槛

满足以下任一：

- `structure <= 35`
- `q_tr_style = totally_random`

#### 软条件打分

```text
ddl_dancer_score =
0.28 * freeflow
+ 0.20 * campus_play
+ 0.14 * social_energy
+ 0.12 * mood_based_behavior
+ 0.10 * aesthetic
+ 0.08 * medium_drive
+ 0.08 * inverse_structure
```

其中 `medium_drive` 采用中间最优函数：

- `drive` 在 `40~70` 区间得分最高
- 太低更像纯摆
- 太高更像高压目标型

#### 触发条件

- `ddl_dancer_score >= 78`
- 满足硬门槛
- 比主人格第一名至少高 `6` 分

### 2. `office-hour-angel`｜续命天使

#### 气质

靠谱、讲逻辑、会帮人、能续命，但不是高调卷王。

#### 硬门槛

必须满足：

- `warmth >= 65`
- `analytical >= 60`

#### 软条件打分

```text
office_hour_score =
0.28 * warmth
+ 0.22 * analytical
+ 0.14 * drive
+ 0.12 * reserved
+ 0.12 * reply_reliability
+ 0.12 * study_geek_interest
```

#### 触发条件

- `office_hour_score >= 80`
- `social_energy <= 70`
- 比主人格第一名至少高 `5` 分

---

## 九、9 个主人格：v3 原型向量

仍采用原型向量：

```text
U = (drive, structure, social_energy, warmth, analytical, reserved, freeflow, campus_play, attachment, aesthetic)
```

并在打分中叠加 v3 派生指标：

- `focus_aura`
- `conversational_pull`
- `clutch_reliability`
- `result_stability`

### 主打分函数

```text
Score_p = 100 - Σ_i (w_i * |U_i - T_{p,i}|) + bonus_p + coverage_adjustment_p
```

其中：

- `T_{p,i}` 为人格原型值
- `w_i` 为人格特定权重
- `bonus_p` 为派生指标 bonus
- `coverage_adjustment_p` 为轻量覆盖率修正（详见后文）

### 1. `hot-nerd`｜性感书呆子

#### 原型

- drive 88
- structure 76
- social_energy 42
- warmth 42
- analytical 88
- reserved 58
- freeflow 18
- campus_play 28
- attachment 32
- aesthetic 30

#### 核心 bonus

```text
bonus_hot_nerd =
0.45 * focus_aura
+ 0.18 * analytical
+ 0.10 * structure
- 0.10 * excessive_freeflow
- 0.10 * excessive_campus_play
```

### 2. `brain-bae`｜智性天菜

#### 原型

- drive 64
- structure 54
- social_energy 56
- warmth 58
- analytical 90
- reserved 42
- freeflow 28
- campus_play 32
- attachment 34
- aesthetic 42

#### 核心 bonus

```text
bonus_brain_bae =
0.45 * conversational_pull
+ 0.18 * analytical
+ 0.12 * warmth
- 0.10 * excessive_focus_aura
- 0.10 * excessive_reserved
```

### 3. `lab-cutie`｜工位白月光

#### 原型

- drive 68
- structure 64
- social_energy 24
- warmth 54
- analytical 66
- reserved 86
- freeflow 24
- campus_play 14
- attachment 30
- aesthetic 44

### 4. `quiz-crush`｜考前限定款

#### 原型

- drive 86
- structure 86
- social_energy 38
- warmth 46
- analytical 76
- reserved 60
- freeflow 12
- campus_play 18
- attachment 30
- aesthetic 24

#### 核心 bonus

```text
bonus_quiz_crush =
0.42 * clutch_reliability
+ 0.16 * structure
+ 0.10 * drive
- 0.10 * excessive_campus_play
- 0.10 * excessive_freeflow
```

### 5. `campus-fox`｜校园活人

#### 原型

- drive 54
- structure 34
- social_energy 86
- warmth 60
- analytical 40
- reserved 16
- freeflow 68
- campus_play 94
- attachment 42
- aesthetic 48

### 6. `book-charm`｜图书馆留白派

#### 原型

- drive 42
- structure 50
- social_energy 18
- warmth 64
- analytical 46
- reserved 90
- freeflow 34
- campus_play 14
- attachment 36
- aesthetic 92

### 7. `code-flirt`｜代码味桃花

#### 原型

- drive 70
- structure 56
- social_energy 46
- warmth 42
- analytical 88
- reserved 48
- freeflow 36
- campus_play 40
- attachment 28
- aesthetic 24

#### 核心 bonus

```text
bonus_code_flirt =
0.30 * conversational_pull
+ 0.24 * analytical
+ 0.18 * geek_interest_score
+ 0.10 * campus_play
- 0.10 * excessive_reserved
- 0.08 * excessive_attachment
```

### 8. `soft-spirit`｜人间缓冲区

#### 原型

- drive 36
- structure 42
- social_energy 30
- warmth 92
- analytical 34
- reserved 62
- freeflow 46
- campus_play 20
- attachment 58
- aesthetic 52

### 9. `low-key-ace`｜静音大佬

#### 原型

- drive 76
- structure 72
- social_energy 26
- warmth 54
- analytical 66
- reserved 82
- freeflow 18
- campus_play 14
- attachment 26
- aesthetic 30

#### 核心 bonus

```text
bonus_low_key_ace =
0.24 * focus_aura
+ 0.20 * clutch_reliability
+ 0.18 * result_stability
+ 0.12 * reserved
- 0.15 * excessive_social_energy
- 0.10 * excessive_campus_play
```

---

## 十、9 个主人格的轴权重建议（v3）

### 1. hot-nerd

- drive 0.20
- structure 0.14
- analytical 0.18
- reserved 0.08
- social_energy 0.06
- campus_play 0.05
- focus_aura bonus 强

### 2. brain-bae

- analytical 0.18
- warmth 0.10
- social_energy 0.10
- reserved 0.06
- aesthetic 0.06
- conversational_pull bonus 强

### 3. lab-cutie

- reserved 0.20
- structure 0.12
- drive 0.10
- analytical 0.08
- social_energy 0.06

### 4. quiz-crush

- drive 0.18
- structure 0.18
- analytical 0.08
- reserved 0.08
- clutch_reliability bonus 强

### 5. campus-fox

- campus_play 0.24
- social_energy 0.20
- freeflow 0.14
- warmth 0.08
- aesthetic 0.06

### 6. book-charm

- aesthetic 0.24
- reserved 0.20
- warmth 0.12
- social_energy 0.06

### 7. code-flirt

- analytical 0.18
- campus_play 0.10
- social_energy 0.08
- reserved 0.06
- conversational_pull bonus 中强

### 8. soft-spirit

- warmth 0.26
- reserved 0.12
- attachment 0.10
- aesthetic 0.04

### 9. low-key-ace

- drive 0.16
- structure 0.14
- reserved 0.16
- analytical 0.08
- focus_aura bonus 中等
- clutch_reliability bonus 中等
- result_stability bonus 强

---

## 十一、轻量覆盖率修正（v3 新增）

为避免少数人格长期出不来、或个别人格长期过高，建议在主人格打分后增加一层非常轻量的分布修正。

### 目标

- 防止某几型长期过高
- 防止某几型长期过低
- 不硬控分布，只做轻微拉平

### 建议规则

以最近 500 个样本为窗口：

- 若某主人格占比 `< 6%`，则 `coverage_adjustment_p = +1.5`
- 若某主人格占比 `> 18%`，则 `coverage_adjustment_p = -1.0`
- 其余为 `0`

### 说明

- `you-know-who` 不参与此修正
- `sloth-mode` 不参与此修正
- 普通彩蛋不参与此修正

---

## 十二、兜底人格 `you-know-who` 的判定逻辑（v3 重点修订）

`you-know-who` 不是“没有特征”，而是：

- 多轴中庸
- 没有明显单峰
- 不极端
- 很难被一句话准确概括

### v2 的问题

若使用以下规则：

- `top1 < 72`
- 或 `top1 - top2 < 3`
- 或整体分布过平

则会导致大量正常用户被过早送入兜底。

### v3 新规则

**不再采用“任一触发即兜底”**。

改为：

> 只有在多项置信度信号同时偏弱时，才进入 `you-know-who`

### 恋爱模式

满足以下 **至少 2 条** 才兜底：

- `top1 < 66`
- `top1 - top2 < 2`
- 人格分数标准差 `< 4.5`

### 找朋友 / 搭子模式

满足以下 **至少 2 条** 才兜底：

- `top1 < 64`
- `top1 - top2 < 1.5`
- 人格分数标准差 `< 4.0`

### 目标占比

建议将 `you-know-who` 控制在：

- **10% ~ 20%**

绝不建议长期高于 **25%**。

---

## 十三、恋爱模式 vs 找朋友模式（v3）

### 原则

朋友模式不是“恋爱模式删几题”，而是：

**同一套人格名 + 一套专门降权后的 scoring 逻辑。**

### 1. 恋爱模式

完整使用 10 个主轴。

建议维度总权重：

- communication 25%
- lifestyle 20%
- values 20%
- boundary 15%
- interests 20%

### 2. 找朋友 / 搭子模式

#### 先去题

以下 `partnerOnly` 题不进入人格分型：

- `q_rel_mode`
- `q_my_pace`
- `q36`
- `q_affection_need`
- `q_physical_pace`
- `q_rel_history`
- `q_history_imp`
- `q44`
- `q47`
- `q48`
- `q_space_integration`
- `q_red_flags`
- `q57`
- `q24`

#### 再重权重

建议维度总权重：

- communication 30%
- lifestyle 22%
- values 22%
- interests 26%
- boundary 0~5%

#### 具体降权建议

- `attachment`：乘 `0.10 ~ 0.20`
- `boundary`：不参与主人格主判定，或仅保留极低权重
- `warmth`、`campus_play`、`aesthetic`、`reserved`、`analytical` 权重上升

#### 结果影响

- `office-hour-angel`：保留
- `deadline-dancer`：保留
- `quiz-crush`：保留，但更看 `clutch_reliability`，而非亲密关系节奏
- `campus-fox`：更看活人感和参与度
- `soft-spirit`：更看舒服感，不看黏性

---

## 十四、朋友模式的单独阈值建议（v3 修正）

### 原则

由于朋友模式可用题更少，区分度天然下降：

- **不应更容易兜底**
- 反而应更谨慎地使用兜底

### 普通彩蛋阈值

#### 恋爱模式

- `ddl_dancer_score >= 78`
- `office_hour_score >= 80`

#### 找朋友 / 搭子模式

建议略提高：

- `ddl_dancer_score >= 82`
- `office_hour_score >= 83`

### `you-know-who` 兜底

不再使用 v2 中更容易兜底的阈值，改为：

- `top1 < 64`
- `top1 - top2 < 1.5`
- 标准差 `< 4.0`
- 满足至少 2 条才兜底

---

## 十五、工程实现建议

### 1. 配置驱动

建议建立：

```text
personalityConfig.ts
```

配置中存放：

- 题目到轴的映射
- 选项到分值的映射
- 派生指标公式
- 超稀有人格规则
- 普通彩蛋规则
- 9 个主人格原型向量
- 各人格权重
- 模式权重
- 覆盖率修正常量
- 兜底阈值

### 2. 核心函数

#### `extractFeatures(answers, mode)`

输出：10 个主轴 + 4 个派生指标

#### `checkUltraRareType(features, answers, mode)`

输出：是否命中 `sloth-mode`

#### `checkEasterEggs(features, answers, mode)`

输出：是否命中普通彩蛋人格

#### `scorePersonalities(features, mode)`

输出：9 个主人格分数

#### `resolveFinalType(scores, easterEggResult, ultraRareResult, mode)`

输出：最终人格类型

### 3. 返回结果建议

```json
{
  "finalType": "book-charm",
  "isEasterEgg": false,
  "isUltraRare": false,
  "confidence": 0.81,
  "top3": [
    { "type": "book-charm", "score": 81 },
    { "type": "soft-spirit", "score": 77 },
    { "type": "lab-cutie", "score": 73 }
  ],
  "featureVector": {
    "drive": 46,
    "structure": 58,
    "socialEnergy": 24,
    "warmth": 74,
    "analytical": 49,
    "reserved": 87,
    "freeflow": 33,
    "campusPlay": 18,
    "attachment": 42,
    "aesthetic": 84,
    "focusAura": 61,
    "conversationalPull": 43,
    "clutchReliability": 52,
    "resultStability": 64
  }
}
```

---

## 十六、冷启动调参建议

### 第一阶段：先压低 `you-know-who`

优先目标不是把树懒调准，而是先把 `you-know-who` 从 60% 压到合理范围。

建议目标：

- 第一阶段先压到 **20% 以下**
- 再逐步稳定到 **10%~20%**

### 第二阶段：观察普通彩蛋和主人格覆盖率

重点关注：

- 哪些人格长期低于 5%
- 哪些人格长期高于 18%
- 搭子模式是否仍显著偏向兜底

### 第三阶段：再校准 `sloth-mode`

因为它本身是运营型稀有隐藏人格，必须在整体分布健康后再调。

### 建议结果页收反馈

建议在结果页增加按钮：

- 像
- 还行
- 不像

可进一步加入：

- “这个结果太像我了”
- “我更像另一个”

用于后续修正 prototype。

---

## 十七、最小可上线版本（推荐）

如果当前不想重写整套工程逻辑，建议优先完成以下最小修订：

### 必改

1. 将结构从 `2 + 9 + 1` 改为 `9 + 2 + 1 + 1`
2. 增加 `sloth-mode` 的单独判定层
3. 将 `you-know-who` 改成“至少两项弱信号同时满足才兜底”
4. 搭子模式下将 `attachment` 权重降到接近 0
5. 搭子模式下将 `boundary` 维度移出主人格主判定
6. 新增 `result_stability`

### 建议改

7. 引入轻量覆盖率修正
8. 继续优化以下 5 个主人格边界：
   - `hot-nerd`
   - `brain-bae`
   - `code-flirt`
   - `quiz-crush`
   - `low-key-ace`

### 可后改

9. 细化题目到轴的映射表
10. 为树懒人格增加专属结果页反馈标签，单独分析真实用户占比

---

## 十八、总结

v3 的核心原则是：

- **不推翻现有框架**
- **只在结构、兜底、朋友模式、隐藏人格层面做关键修正**
- **先解决覆盖率失衡，再做稀有人格精细化运营**

这样做的好处是：

- 工程成本可控
- 与现有 12 个人格文案保持一致
- 可以平滑扩展到 `9 + 2 + 1 + 1`
- 能更有效控制 `you-know-who` 过高的问题
- 更适合 NJU Match 当前的产品节奏
