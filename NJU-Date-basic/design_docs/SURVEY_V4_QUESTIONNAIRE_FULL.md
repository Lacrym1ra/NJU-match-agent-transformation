# NJU Match 问卷 v4.0（完整评审版）

- 来源文件：`backend/src/db/seed.ts`
- 导出时间：2026-04-10
- 用途：供组员评审当前线上/联调使用的完整问卷结构

## 1. 问卷结构说明

### 📄 题量概览（当前版本）
- **恋爱意向（完整模式）**：
  - 无分支基础题：**68** 题
  - 加上全部分支题题库共计：**96** 题
- **找朋友意向（朋友模式）**：
  - 无分支基础题：**48** 题（自动跳过 `partnerOnly` 题目）
  - 加上全部分支题题库共计：**76** 题
> 注：每位用户实际回答的区别因为兴趣衍生题的不同触发而异。

### ⚙️ 详细机制
- UI 分区（6 个 Tab）：`basics`、`interests`、`lifestyle`、`communication`、`boundary`、`values`
- 题型：
  - `number_input`：数值输入
  - `year_range` / `height_range`：范围输入
  - `single_select`：单选
  - `multi_select`：多选（有 `maxSelect`）
  - `ranking`：排序
  - `likert`：7 点量表（含左右端标签）
- 依赖题：标记为 `dependsOn` 的题目仅在满足上游条件时出现
- 特殊项：`other_specify` 为“其他（请补充）”，前端会弹出补充输入框
- 伴侣限定题：标记为 `partnerOnly` 的题目在“找朋友”意向下为非必填，可跳过
- 阅读方式：题目清单里保留技术键名；中文展示请对照第 5 节（前端一致），格式为“中文（key）”

---

## 2. 完整题目清单（按 QUESTION_BANK 顺序）

## A. basics（基础信息）

### 1) q1
- 题干：我的出生年份：
- 题型：`number_input`
- 范围：`1991 ~ 2008`
- 必答：是

### 2) q2
- 题干：我希望匹配对象的出生年份范围：
- 题型：`year_range`
- 范围：`1991 ~ 2008`
- 必答：是

### 3) q_height
- 题干：我的身高（cm，选填）：
- 题型：`number_input`
- 范围：`140 ~ 210`
- 必答：否

### 4) q_height_range
- 题干：我希望对方身高范围（cm，选填）：
- 题型：`height_range`
- 范围：`140 ~ 210`
- 必答：否

### 5) q61
- 题干：我希望匹配对象的 MBTI 类型是（限选 4 个，选"无所谓"则不限制）：
- 题型：`multi_select`
- 最大选择：`4`
- 选项：INTJ（intj）、INTP（intp）、ENTJ（entj）、ENTP（entp）、INFJ（infj）、INFP（infp）、ENFJ（enfj）、ENFP（enfp）、ISTJ（istj）、ISFJ（isfj）、ESTJ（estj）、ESFJ（esfj）、ISTP（istp）、ISFP（isfp）、ESTP（estp）、ESFP（esfp）、无所谓（any_mbti）

### 6) q5
- 题干：我希望匹配对象的年级范围（可多选）：
- 题型：`multi_select`
- 最大选择：`3`
- 选项：与我同级（same_grade）、低年级（lower_grade）、高年级（higher_grade）

### 7) q7
- 题干：我希望匹配对象的学院和我：
- 题型：`single_select`
- 选项：一定同学院（strict_same_major）、偏好同学院（prefer_same_major）、一定不同学院（strict_diff_major）、偏好不同学院（prefer_diff_major）、无所谓（neutral）

### 8) q3
- 题干：我的家乡省份（地区）：
- 题型：`single_select`
- 选项：北京（beijing）、天津（tianjin）、河北（hebei）、山西（shanxi）、内蒙古（inner_mongolia）、辽宁（liaoning）、吉林（jilin）、黑龙江（heilongjiang）、上海（shanghai）、江苏（jiangsu）、浙江（zhejiang）、安徽（anhui）、福建（fujian）、江西（jiangxi）、山东（shandong）、河南（henan）、湖北（hubei）、湖南（hunan）、广东（guangdong）、广西（guangxi）、海南（hainan）、重庆（chongqing）、四川（sichuan）、贵州（guizhou）、云南（yunnan）、西藏（tibet）、陕西（shanxi_sx）、甘肃（gansu）、青海（qinghai）、宁夏（ningxia）、新疆（xinjiang）、香港（hongkong）、澳门（macao）、台湾（taiwan）、海外（overseas）、不透露（unknown）

### 8A) q_jiangsu_city
- 题干：我来自江苏省哪个城市：
- 题型：`single_select`
- 必答：否
- 依赖：`q3 = jiangsu`
- 选项：南京（nanjing）、苏州（suzhou）、无锡（wuxi）、常州（changzhou）、镇江（zhenjiang）、扬州（yangzhou）、泰州（taizhou）、南通（nantong）、盐城（yancheng）、连云港（lianyungang）、淮安（huaian）、宿迁（suqian）、徐州（xuzhou）

### 9) q4
- 题干：我更希望匹配对象的家乡与我：
- 题型：`single_select`
- 选项：偏好同城市（prefer_same_city）、偏好同省（prefer_same_province）、偏好邻近地区（prefer_nearby）、无所谓（neutral）

### 10) q6
- 题干：我对跨校区的接受度：
- 题型：`single_select`
- 选项：只接受同校区（same_campus_only）、南京校区都行（nanjing_campuses）、自选接受的校区（select_campuses）、都可以（any_campus）

### 10A) q6_campus_select
- 题干：我可以接受的校区（最多选 3 个，若四个都行请选「都可以」）：
- 题型：`multi_select`
- 最大选择：`3`
- 必答：否
- 依赖：`q6 = select_campuses`
- 选项：仙林校区（xianlin）、鼓楼校区（gulou）、浦口校区（pukou）、苏州校区（suzhou_campus）

---

## B. interests（兴趣爱好）

### 11) q8
- 题干：我的核心兴趣爱好（限选 4 项）：
- 题型：`multi_select`
- 最大选择：`4`
- 选项：健身（gym_fitness）、徒步户外（running_outdoor）、球类运动（ball_sports）、游泳舞蹈（swimming_dance）、电影剧集（movies_series）、游戏（gaming）、动漫二次元（anime_acg）、桌游剧本杀（boardgame_larp）、摄影看展（photo_exhibitions）、阅读写作（reading_writing）、小说同人（fiction_fanfic）、探店/美食（food_exploring）、旅行CityWalk（travel_citywalk）、听歌/音乐（music_listening）、Live/演出（live_show）、宠物（pets）、编程极客（programming_geek）、金融商业（finance_business）、其他（other_interest）

### 12) q_mv_type
- 题干：你更偏好的影视类型（可多选）：
- 题型：`multi_select`
- 最大选择：`9`
- 依赖：`q8 = movies_series`
- 选项：喜剧（comedy）、爱情（romance）、悬疑/犯罪（suspense_crime）、科幻（sci_fi）、动作（action）、恐怖（horror）、文艺片（arthouse）、动画（animation）、纪录片（documentary）

### 13) q_mv_media
- 题干：你更常看的影视媒介：
- 题型：`multi_select`
- 最大选择：`6`
- 依赖：`q8 = movies_series`
- 选项：国产剧（cn_drama）、美剧（us_drama）、英剧（uk_drama）、韩剧（kr_drama）、日剧（jp_drama）、电影（movie）

### 14) q_mv_together
- 题干：你更希望怎么一起看：
- 题型：`single_select`
- 依赖：`q8 = movies_series`
- 选项：线下一起看（watch_offline）、线上一起看（watch_online）、讨论剧情（discuss_plot）、都可以（all_fine）

### 15) q_bg_type
- 题干：你更喜欢哪类线下游戏：
- 题型：`multi_select`
- 最大选择：`5`
- 依赖：`q8 = boardgame_larp`
- 选项：狼人杀/阿瓦隆（werewolf_avalon）、聚会桌游（party_boardgame）、德策/策略桌游（german_strategy）、剧本杀（murder_mystery）、密室逃脱（escape_room）

### 16) q_bg_prio
- 题干：你最在意什么（最多选 2 项）：
- 题型：`multi_select`
- 最大选择：`2`
- 依赖：`q8 = boardgame_larp`
- 选项：不放鸽子（no_bail）、逻辑很重要（logic_matters）、氛围轻松（chill_vibe）、新手友好（newbie_friendly）、偏好和朋友一起（prefer_friends）

### 17) q_acg_contact
- 题干：你更常接触：
- 题型：`multi_select`
- 最大选择：`8`
- 依赖：`q8 = anime_acg`
- 选项：番剧（anime）、漫画（manga）、轻小说（light_novel）、同人（fanfic）、Cosplay（cosplay）、漫展（convention）、VTuber（vtuber）、周边/手办（goods）

### 18) q_acg_together
- 题干：你更希望怎么一起玩：
- 题型：`single_select`
- 依赖：`q8 = anime_acg`
- 选项：一起看番（watch_anime）、一起逛漫展（go_convention）、讨论角色/剧情（discuss_chars）、一起买周边（buy_goods）、都可以（all_fine）

### 19) q_ph_direction
- 题干：你更偏好的方向：
- 题型：`multi_select`
- 最大选择：`8`
- 依赖：`q8 = photo_exhibitions`
- 选项：人像摄影（portrait）、街拍（street）、胶片（film）、数码（digital）、美术馆（art_museum）、博物馆（museum）、摄影展（photo_exhibition）、装置艺术（installation）

### 20) q_ph_self
- 题干：你的摄影/看展经验更接近：
- 题型：`single_select`
- 依赖：`q8 = photo_exhibitions`
- 选项：纯小白（ph_newbie）、偶尔看看（ph_casual）、经验丰富（ph_experienced）、专业大佬/老法师（ph_pro）

### 21) q_ph_prio
- 题干：你更看重：
- 题型：`single_select`
- 依赖：`q8 = photo_exhibitions`
- 选项：对方很会拍照/出片（focus_photo）、探讨艺术与审美（focus_art）、纯陪伴/不看重这些（focus_company）

### 22) q_fd_type
- 题干：你更偏好：
- 题型：`multi_select`
- 最大选择：`9`
- 依赖：`q8 = food_exploring`
- 选项：平价美食（cheap_eats）、咖啡甜点（cafe_dessert）、火锅烧烤（hotpot_bbq）、日韩料理（jp_kr_food）、西餐Brunch（western_brunch）、奶茶饮品（milk_tea）、夜宵（late_night）、隐藏好店（hidden_gem）、自己做饭（home_cook）

### 23) q_fd_prio
- 题干：约饭时你更看重（最多选 2 项）：
- 题型：`multi_select`
- 最大选择：`2`
- 依赖：`q8 = food_exploring`
- 选项：味道好（taste）、性价比高（value_money）、聊得来（good_chat）、环境好（nice_ambiance）、距离近（close_by）、适合拍照（instagrammable）

### 24) q_tr_type
- 题干：你更喜欢哪种出行：
- 题型：`multi_select`
- 最大选择：`8`
- 依赖：`q8 = travel_citywalk`
- 选项：校园漫步（campus_walk）、城市漫步（city_walk）、咖啡店巡礼（cafe_hop）、周末短途（short_trip）、快节奏旅行（speed_trip）、慢慢逛（slow_stroll）、打卡拍照（photo_spot）、随机探索（random_explore）

### 25) q_tr_style
- 题干：你出门风格更接近：
- 题型：`single_select`
- 依赖：`q8 = travel_citywalk`
- 选项：详细计划（detailed_plan）、大致规划（rough_plan）、完全随机（totally_random）

### 26A) q_sp_type（新增）
- 题干：你平时主要的健身 / 户外运动项目（最多选 3 项）：
- 题型：`multi_select`
- 最大选择：`3`
- 依赖：`q8 in [gym_fitness, running_outdoor]`
- 选项：力量训练（weight_training）、跑步（running）、骑行（cycling）、游泳（swimming）、瑜伽/普拉提（yoga_pilates）、舞蹈（dancing）、徒步/登山（hiking_climbing）、其他（请补充）（other_specify）

### 26) q_ball_sport
- 题干：经常参与或喜欢的球类运动（选填，最多选 4 项）：
- 题型：`multi_select`
- 最大选择：`4`
- 必答：否
- 依赖：`q8 = ball_sports`
- 选项：羽毛球（badminton）、篮球（basketball）、乒乓球（table_tennis）、网球（tennis）、足球（football）、排球（volleyball）、台球/桌球（billiards）、其他（请补充）（other_specify）

### 27) q_sp_self
- 题干：你自身的运动频率/水平是：
- 题型：`single_select`
- 依赖：`q8 in [gym_fitness, running_outdoor, ball_sports, swimming_dance]`
- 选项：新手/偶尔动动（sp_newbie）、休闲娱乐（sp_casual）、规律运动（sp_regular）、运动达人（sp_pro）

### 28) q_sp_partner
- 题干：你更想找哪种运动搭子：
- 题型：`single_select`
- 依赖：`q8 in [gym_fitness, running_outdoor, ball_sports, swimming_dance]`
- 选项：长期运动搭子（long_term）、水平相近（similar_level）、纯陪伴（pure_company）、教我的（need_coach）

### 29) q_gm_platform
- 题干：我常玩的游戏平台：
- 题型：`multi_select`
- 最大选择：`5`
- 依赖：`q8 = gaming`
- 选项：手游（mobile）、PC/端游（pc）、Switch/主机（switch_console）、单机（single_player）、朋友玩啥我玩啥（follow_friends）

### 30) q_gm_genre
- 题干：我更偏好的游戏类型：
- 题型：`multi_select`
- 最大选择：`11`
- 依赖：`q8 = gaming`
- 选项：MOBA（moba）、FPS/射击（fps）、开放世界/RPG（open_world_rpg）、抽卡手游（gacha）、聚会/休闲（party_casual）、音游（rhythm）、卡牌/策略（card_strategy）、模拟经营（simulation）、剧情/解谜（story_puzzle）、生存/建造（survival_build）、其他（请补充）（other_specify）

### 31) q_gm_mobile
- 题干：我最近常玩的手游：
- 题型：`multi_select`
- 最大选择：`11`
- 必答：否
- 依赖：`q_gm_platform = mobile`
- 选项：王者荣耀（honor_of_kings）、金铲铲/云顶（tft）、和平精英（pubg_mobile）、蛋仔派对（eggy_party）、原神（genshin）、崩铁（star_rail）、鸣潮（wuthering）、明日方舟（arknights）、恋与/闪暖（love_nikki）、第五人格（identity_v）、其他（请补充）（other_specify）

### 32) q_gm_pc
- 题干：我最近常玩的 PC / 端游：
- 题型：`multi_select`
- 最大选择：`16`
- 必答：否
- 依赖：`q_gm_platform = pc`
- 选项：英雄联盟（lol）、瓦罗兰特（valorant）、CS2（cs2）、Apex（apex）、守望先锋（ow2）、黎明杀机（dbd）、Minecraft（minecraft）、GTA5（gta5）、星露谷（stardew）、彩六（r6）、Warframe（warframe）、双人成行（it_takes_two）、三角洲行动（delta_force）、漫威争锋（marvel_rivals）、Dota2（dota2）、其他（请补充）（other_specify）

### 33) q_gm_switch
- 题干：我最近常玩的 Switch / 主机游戏：
- 题型：`multi_select`
- 最大选择：`11`
- 必答：否
- 依赖：`q_gm_platform = switch_console`
- 选项：塞尔达传说（zelda）、马里奥赛车（mario_kart）、动物森友会（animal_crossing）、宝可梦（pokemon）、大乱斗（smash_bros）、斯普拉遁（splatoon）、胡闹厨房（overcooked）、Minecraft(NS)（minecraft_sw）、异度神剑（xenoblade）、星露谷(NS)（stardew_sw）、其他（请补充）（other_specify）

### 34) q_gm_self
- 题干：一起打游戏时，我自己的状态更接近：
- 题型：`single_select`
- 依赖：`q8 = gaming`
- 选项：新手（newbie）、休闲玩家（casual）、有经验（experienced）、认真型（tryhard）、看游戏（depends_game）

### 35) q_gm_partner
- 题干：我更希望对方和我的游戏水平：
- 题型：`single_select`
- 依赖：`q8 = gaming`
- 选项：水平必须相近（must_close）、有差距也行（some_gap_ok）、无所谓（dont_care）、带或被带都行（carry_or_carried）

### 36) q_music_style
- 题干：钟爱的音乐风格（选填）：
- 题型：`multi_select`
- 最大选择：`4`
- 必答：否
- 依赖：`q8 in [music_listening, live_show]`
- 选项：华语流行（c_pop）、韩流（k_pop）、日音（j_pop）、摇滚（rock）、说唱（hip_hop_rap）、R&B / 灵魂乐（r_and_b）、电音 / 舞曲（electronic_dance）、古典（classical）、爵士 / 布鲁斯（jazz_blues）、民谣 / 乡村（folk_country）、独立音乐（indie）、ACG / Vocaloid（acg_vocaloid）、其他（请补充）（other_specify）

### 37) q_read_type
- 题干：最近喜欢看的书籍品类（选填）：
- 题型：`multi_select`
- 最大选择：`4`
- 必答：否
- 依赖：`q8 = reading_writing`
- 选项：文学/小说（lit_fiction）、科幻/奇幻（sci_fi_fantasy）、历史/传记（history_bio）、哲学/社科（philosophy_social）、科学/技术（science_tech）、商业/经济（business_econ）、诗歌/散文（poetry_essay）、漫画/绘本（comics_picture_book）、其他（请补充）（other_specify）

### 38) q_novel_type
- 题干：偏好的小说类型（选填）：
- 题型：`multi_select`
- 最大选择：`4`
- 必答：否
- 依赖：`q8 = fiction_fanfic`
- 选项：言情（romance_novel）、悬疑/惊悚（suspense_thriller）、武侠/仙侠（wuxia_xianxia）、科幻（sci_fi_novel）、奇幻/魔法（fantasy_magic）、耽美/BL（bl_danmei）、百合/GL（gl_baihe）、同人衍生（fanfic_novel）、其他（请补充）（other_specify）

### 39) q_top_interest
- 题干：如果只能选一个最希望和对象共享的兴趣方向：
- 题型：`single_select`
- 选项：健身（gym_fitness）、徒步户外（running_outdoor）、球类运动（ball_sports）、游泳舞蹈（swimming_dance）、电影剧集（movies_series）、游戏（gaming）、动漫二次元（anime_acg）、桌游剧本杀（boardgame_larp）、摄影看展（photo_exhibitions）、阅读写作（reading_writing）、小说同人（fiction_fanfic）、探店/美食（food_exploring）、旅行CityWalk（travel_citywalk）、听歌/音乐（music_listening）、Live/演出（live_show）、宠物（pets）、编程极客（programming_geek）、金融商业（finance_business）、其他（other_interest）

### 40) q_date_content
- 题干：我理想中的约会内容更接近（最多选 3 项）：
- 题型：`multi_select`
- 最大选择：`3`
- 选项：吃饭探店（eat_explore）、散步CityWalk（walk_citywalk）、看电影/追剧（movie_series）、运动（sports）、一起打游戏（gaming）、看展拍照（exhibition_photo）、一起学习（study）、Live/演唱会（live_concert）、周边游（travel_nearby）、纯聊天（just_chat）

### 41) q_weekend_date
- 题干：周末约会我更倾向：
- 题型：`single_select`
- 选项：校内就好（campus_fine）、都可以（both_ok）、更喜欢校外（prefer_outside）

---

### 找朋友模式下可跳过题目（`partnerOnly`）

- 生活习惯：`q32`
- 相处沟通：`q_rel_mode`、`q_my_pace`、`q36`、`q_affection_need`、`q_physical_pace`
- 边界安全感：`q_rel_history`、`q_history_imp`、`q44`、`q47`、`q48`、`q_space_integration`、`q_red_flags`、`q57`
- 价值观：`q24`

---

## C. lifestyle（生活习惯）

### 42) q9
- 题干：我有吸烟或抽电子烟的习惯：
- 题型：`single_select`
- 选项：是（yes）、不是（no）

### 43) q10
- 题干：我对匹配对象吸烟或抽电子烟的接受度：
- 题型：`likert`
- 量表：`1~7`，左端=`完全不能接受`，右端=`完全可以接受`

### 44) q_drink_freq
- 题干：我饮酒的频率更接近：
- 题型：`single_select`
- 选项：几乎不喝（rarely）、偶尔小酌（occasionally）、社交场合会喝（sometimes）、经常喝（frequently）

### 45) q_drink_pref
- 题干：我对匹配对象饮酒习惯的接受度：
- 题型：`likert`
- 量表：左端=`只能接受基本不喝`，右端=`完全无所谓`

### 46) q_pet_like
- 题干：我对小动物的喜欢程度：
- 题型：`likert`
- 量表：左端=`完全不喜欢`，右端=`非常喜欢`

### 47) q_pet_partner
- 题干：我希望对方喜欢小动物的程度：
- 题型：`likert`
- 量表：左端=`完全不重要`，右端=`非常重要`

### 48) q15
- 题干：我的作息习惯：
- 题型：`single_select`
- 选项：早睡早起（early_sleep_early_rise）、早睡晚起（early_sleep_late_rise）、晚睡晚起（late_sleep_late_rise）、晚睡早起（late_sleep_early_rise）

### 49) q_schedule_imp
- 题干：我对对方作息与我一致的重视程度：
- 题型：`likert`
- 量表：左端=`完全不重要`，右端=`非常重要`

### 50) q_free_time
- 题干：我更常有空的时间（可多选）：
- 题型：`multi_select`
- 最大选择：`6`
- 选项：工作日白天（weekday_day）、工作日晚上（weekday_night）、周六白天（sat_day）、周六晚上（sat_night）、周日白天（sun_day）、周日晚上（sun_night）

### 51) q_spend_style
- 题干：消费时，我更愿意把钱花在：
- 题型：`single_select`
- 选项：体验（旅游演唱会等）（experience）、实物（material）、平衡（balanced）

### 52) q_spend_imp
- 题干：我认为两个人的消费观相近，在关系中：
- 题型：`likert`
- 量表：左端=`完全不重要`，右端=`非常重要`

### 53) q32
- 题干：恋爱中的日常开销，我更舒服的方式是：
- 题型：`single_select`
- 找朋友模式：可跳过（`partnerOnly`）
- 选项：AA（share_equally）、我多出（i_pay_more）、对方多出（partner_pays_more）、不分那么清（go_with_flow）

### 54) q_spend_mode_imp
- 题干：我对双方开销方式一致的重视程度：
- 题型：`likert`
- 找朋友模式：可跳过（`partnerOnly`）
- 量表：左端=`完全不重要`，右端=`非常重要`

### 55) q37
- 题干：我对生活环境的整洁度要求极高（有轻微或严重洁癖）：
- 题型：`likert`
- 量表：左端=`完全不符合`，右端=`非常符合`

### 56) q38
- 题干：我习惯做详尽的计划，非常不喜欢"说走就走"的突然改变：
- 题型：`likert`
- 量表：左端=`完全不符合`，右端=`非常符合`

---

## D. communication（相处沟通）

### 57) q_rel_mode
- 题干：在感情的推进与互动中，我更倾向的模式是：
- 题型：`single_select`
- 找朋友模式：可跳过（`partnerOnly`）
- 选项：我是主动的一方（proactive）、我更希望对方主动（prefer_partner_active）、双向奔赴互相主动（mutual_active）、顺其自然发展（casual_flow）

### 58) q_my_pace
- 题干：我进入一段关系的节奏更接近：
- 题型：`single_select`
- 找朋友模式：可跳过（`partnerOnly`）
- 选项：慢热谨慎（slow_careful）、来电就快（fast_if_chemistry）、看情况（depends）

### 60) q_atmosphere
- 题干：我更喜欢的相处氛围：
- 题型：`single_select`
- 选项：热闹话多（lively_talkative）、有说有笑也有安静（mix_talk_quiet）、安静舒适（quiet_comfy）、看心情（depends_mood）

### 61) q_conflict_self
- 题干：当发生矛盾时，我更接近：
- 题型：`single_select`
- 选项：立刻说清楚（talk_now）、冷静一会再说（cool_then_talk）、回避/拖延（avoid_delay）、看情况（depends）

### 62) q_conflict_partner
- 题干：我更希望对方在发生矛盾时：
- 题型：`single_select`
- 选项：立刻说清楚（talk_now）、先冷静再说（cool_first）、不给压力就好（no_pressure）、无所谓（dont_care）

### 63) q_support_pref
- 题干：我遇到挫折时，更希望对方：
- 题型：`single_select`
- 选项：情绪安抚（emotional_support）、分析问题（analyze_problem）、两者都要（both）、看情况（depends）

### 64) q_reply_speed
- 题干：我的消息回复速度通常：
- 题型：`single_select`
- 选项：秒回/很快（very_fast）、正常（normal）、比较慢（slow）、看心情（depends_mood）

### 65) q_reply_pref
- 题干：我对匹配对象消息回复速度的期待：
- 题型：`likert`
- 量表：左端=`有空再回就行`，右端=`希望非常及时`

### 66) q41
- 题干：我每天需要独处时间的程度：
- 题型：`likert`
- 量表：左端=`完全不需要`，右端=`非常需要`

### 67) q36
- 题干：恋爱中我对高频陪伴与黏性的需要程度：
- 题型：`likert`
- 量表：左端=`完全不需要`，右端=`非常需要`
- 找朋友模式：可跳过（`partnerOnly`）

### 68) q_affection_need
- 题干：我对伴侣高频表达爱意的需要程度：
- 题型：`likert`
- 量表：左端=`完全不需要`，右端=`非常需要`
- 找朋友模式：可跳过（`partnerOnly`）

### 69) q_physical_pace
- 题干：在关系初期，我对身体接触（如牵手、拥抱）的接受速度：
- 题型：`likert`
- 找朋友模式：可跳过（`partnerOnly`）
- 量表：左端=`非常慢热`，右端=`顺其自然`


---

## E. boundary（边界安全感）

### 70) q_rel_history
- 题干：我过去进入过几段较正式的恋爱关系：
- 题型：`likert`
- 量表：左端=`0段`，右端=`6段或以上`
- 找朋友模式：可跳过（`partnerOnly`）


### 71) q_history_imp
- 题干：我希望对方过往有过几段恋爱经历：
- 题型：`likert`
- 量表：左端=`0段`，右端=`6段或以上`
- 找朋友模式：可跳过（`partnerOnly`）



### 72) q44
- 题干：当我缺乏安全感时，我查看伴侣手机的倾向：
- 题型：`likert`
- 量表：左端=`完全不会`，右端=`非常可能`
- 找朋友模式：可跳过（`partnerOnly`）

### 73) q47
- 题干：我自己的占有欲 / 吃醋倾向：
- 题型：`likert`
- 量表：左端=`非常低`，右端=`非常高`
- 找朋友模式：可跳过（`partnerOnly`）

### 74) q48
- 题干：我对伴侣占有欲 / 吃醋程度的接受度：
- 题型：`likert`
- 量表：左端=`完全不能接受`，右端=`完全可以接受`
- 找朋友模式：可跳过（`partnerOnly`）

### 75) q_space_integration
- 题干：恋爱后，我更理想的相处状态是：
- 题型：`single_select`
- 找朋友模式：可跳过（`partnerOnly`）
- 选项：希望两个人尽量融入彼此的朋友圈和生活（high_integration）、希望彼此熟悉对方生活圈，但也保留各自空间（balanced_space）、更希望各自保持相对独立，不过度绑定彼此生活圈（high_independence）、看人和相处感觉，不固定（space_depends）



### 76) q_red_flags
- 题干：我最不能接受的恋爱中的问题（最多选 3 项）：
- 题型：`multi_select`
- 找朋友模式：可跳过（`partnerOnly`）
- 最大选择：`3`
- 选项：人间蒸发不回消息（ghost_msg）、暧昧不清（flirt_opposite）、情绪不稳定（emotional_unstable）、控制手机/监控（phone_control）、太粘人（too_clingy）、太冷淡/忽冷忽热（too_cold）、放鸽子/不守时（stand_up）、消费观差距大（spend_gap）、说伤人的话（hurtful_words）、不尊重我的社交圈（disrespect_circle）、其他（other_flag）

### 77) q57
- 题干：我能够接受开放式关系（如双方知情同意下的非排他性关系）：
- 题型：`likert`
- 量表：左端=`完全不能接受`，右端=`完全可以接受`
- 找朋友模式：可跳过（`partnerOnly`）


---

## F. values（价值观）

### 78) q21
- 题干：我希望匹配对象是一个非常上进、目标导向的人：
- 题型：`likert`
- 量表：左端=`完全不重要`，右端=`非常重要`

### 79) q_work_style
- 题干：我的做事风格更接近：
- 题型：`likert`
- 量表：左端=`非常佛系`，右端=`非常上进`

### 80) q27
- 题干：相比事业优先，我更看重关系与生活幸福感：
- 题型：`likert`
- 量表：左端=`完全不符合`，右端=`非常符合`

### 81) q24
- 题干：我未来希望组建家庭并拥有孩子：
- 题型：`likert`
- 量表：左端=`完全不符合`，右端=`非常符合`
- 找朋友模式：可跳过（`partnerOnly`）

### 82) q25
- 题干：在关键利益面前，善良比聪明更重要：
- 题型：`likert`
- 量表：左端=`完全不符合`，右端=`非常符合`

### 83) q33
- 题干：智商（聪明、有深度）比情商（会照顾人、提供情绪价值）更吸引我：
- 题型：`likert`
- 量表：左端=`完全不符合`，右端=`非常符合`

### 84) q26
- 题干：我愿意为了理想与热爱，放弃一部分物质舒适：
- 题型：`likert`
- 量表：左端=`完全不符合`，右端=`非常符合`

### 85) q28
- 题干：我认为世界上 99% 的烦恼都可以用钱来解决：
- 题型：`likert`
- 量表：左端=`完全不符合`，右端=`非常符合`

### 86) q30
- 题干：物质财富的积累比精神上的共鸣更重要：
- 题型：`likert`
- 量表：左端=`完全不符合`，右端=`非常符合`

### 87) q_future_base
- 题干：我未来倾向发展的地区（可多选，最多 3 项）：
- 题型：`multi_select`
- 最大选择：`3`
- 选项：江苏（jiangsu）、上海（shanghai）、浙江（zhejiang）、安徽（anhui）、北京（beijing）、广东（guangdong）、川渝（sichuan_chongqing）、华东其他（east_china_other）、华北（north_china）、华中（central_china）、华南（south_china）、西南（southwest）、西北（northwest）、东北（northeast）、港澳台/海外（hk_macao_tw_overseas）、还没想好（undecided）、机会优先（opportunity_first）

### 88) q_future_base_imp
- 题干：我对对象未来发展地区与我一致的重视程度：
- 题型：`likert`
- 量表：左端=`完全不重要`，右端=`非常重要`

### 89) q_growth_env
- 题干：我的成长环境更接近：
- 题型：`single_select`
- 选项：一线核心城区（tier1_core）、二线城市（tier2）、三四线城市（tier3_4）、县城（county）、农村（rural）

### 90) q_family_econ
- 题干：我对自己家庭经济条件的感受更接近：
- 题型：`single_select`
- 选项：紧张（tight）、正常（normal）、舒适（comfortable）、非常宽裕（very_comfortable）、不想说（prefer_not_say）

### 91) q31
- 题干：我认为两个人的家庭背景和成长环境相近，在关系中：
- 题型：`likert`
- 量表：左端=`完全不重要`，右端=`非常重要`

### 92) q29
- 题干：我自己更接近哪些品质（限选 4 项）：
- 题型：`multi_select`
- 最大选择：`4`
- 选项：善良（kindness）、诚实（honesty）、忠诚（loyalty）、正直（integrity）、自律（self_discipline）、野心（ambition）、独立（independence）、好奇心（curiosity）、创造力（creativity）、家庭（family）、自由（freedom）、友谊（friendship）、公平（fairness）、勇气（courage）、冒险（adventure）、信仰（faith）

### 93) q_partner_qualities
- 题干：我最看重对方具备哪些品质（限选 4 项）：
- 题型：`multi_select`
- 最大选择：`4`
- 选项：善良（kindness）、诚实（honesty）、忠诚（loyalty）、正直（integrity）、自律（self_discipline）、野心（ambition）、独立（independence）、好奇心（curiosity）、创造力（creativity）、家庭（family）、自由（freedom）、友谊（friendship）、公平（fairness）、勇气（courage）、冒险（adventure）、信仰（faith）

### 94) q60
- 题干：在以上所有维度里，你认为匹配中最重要的是：
- 题型：`single_select`
- 选项：兴趣爱好（interests）、生活习惯（lifestyle）、相处沟通（communication）、边界安全感（boundary）、价值观（values）

### 95) q_must_align
- 题干：如果只能有一个方面和对方高度一致，你最希望是（选填）：
- 题型：`single_select`
- 必答：否
- 选项：生活习惯（life_habit）、个人节奏与氛围（schedule_vibe）、共同爱好（interests_shared）、沟通方式（comm_style）、金钱观与消费观（values_money）、未来规划（values_future）、家庭背景（family_bg）

---

## 3. 本轮重点更新项（便于评审）

- 非伴侣意向非必填：
  - `partnerOnly` 题目在“找朋友”模式下可跳过（不计入必答校验）
- 运动分支新增：
  - `q_sp_type`（健身/户外项目偏好，依赖 `q8 in [gym_fitness, running_outdoor]`）

- 兴趣分支增加：
  - `q_ph_self`（摄影/看展 自身经验）
  - `q_sp_self`（运动 自身频率/水平）
- 摄影偏好题收敛：
  - `q_ph_prio` 选项改为 `focus_photo / focus_art / focus_company`
- 价值观题调整：
  - `q_work_style` 改为 `likert` 量表题（左“非常佛系”右“非常上进”）
- “其他补充”统一：
  - 多个兴趣子分支统一使用 `other_specify`
- 新增偏好匹配方向题：
  - `q_must_align`

---

## 4. 备注

- 本文是题库结构评审文档，不包含算法权重细节。
- 本文第 2 节已按“中文（key）”内联展示选项，评审时无需跨章节对照。

---

## 5. 术语补充（简版）

- 文中“中文（key）”格式：前者是组员阅读文案，后者是研发追踪键名。
- 若后续前端文案更新，以 [frontend/src/pages/Survey.tsx](frontend/src/pages/Survey.tsx) 中 `OPTION_LABELS` 为准。
