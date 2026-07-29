// AUTO-GENERATED from backend/src/db/seed.ts

export const MOCK_QUESTION_SECTIONS = [
  {
    "id": "q1",
    "type": "number_input",
    "section": "basics",
    "text": "我的出生年份：",
    "min": 1991,
    "max": 2008,
    "hasImportance": false
  },
  {
    "id": "q2",
    "type": "year_range",
    "section": "basics",
    "text": "我希望匹配对象的出生年份范围：",
    "min": 1991,
    "max": 2008,
    "hasImportance": false
  },
  {
    "id": "q_height",
    "type": "number_input",
    "section": "basics",
    "text": "我的身高（cm，选填）：",
    "min": 140,
    "max": 210,
    "hasImportance": false,
    "required": false
  },
  {
    "id": "q_height_range",
    "type": "height_range",
    "section": "basics",
    "text": "我希望对方身高范围（cm，选填）：",
    "min": 140,
    "max": 210,
    "hasImportance": false,
    "required": false
  },
  {
    "id": "q61",
    "type": "multi_select",
    "section": "basics",
    "text": "我希望匹配对象的 MBTI 类型是（限选 4 个，选\"无所谓\"则不限制）：",
    "options": [
      "intj",
      "intp",
      "entj",
      "entp",
      "infj",
      "infp",
      "enfj",
      "enfp",
      "istj",
      "isfj",
      "estj",
      "esfj",
      "istp",
      "isfp",
      "estp",
      "esfp",
      "any_mbti"
    ],
    "maxSelect": 4,
    "hasImportance": false
  },
  {
    "id": "q5",
    "type": "multi_select",
    "section": "basics",
    "text": "我希望匹配对象的年级范围（可多选）：",
    "options": [
      "same_grade",
      "lower_grade",
      "higher_grade"
    ],
    "maxSelect": 3,
    "hasImportance": false
  },
  {
    "id": "q7",
    "type": "single_select",
    "section": "basics",
    "text": "我希望匹配对象的学院和我：",
    "options": [
      "strict_same_major",
      "prefer_same_major",
      "strict_diff_major",
      "prefer_diff_major",
      "neutral"
    ],
    "hasImportance": false
  },
  {
    "id": "q3",
    "type": "single_select",
    "section": "basics",
    "text": "我的家乡省份（地区）：",
    "options": [
      "beijing",
      "tianjin",
      "hebei",
      "shanxi",
      "inner_mongolia",
      "liaoning",
      "jilin",
      "heilongjiang",
      "shanghai",
      "jiangsu",
      "zhejiang",
      "anhui",
      "fujian",
      "jiangxi",
      "shandong",
      "henan",
      "hubei",
      "hunan",
      "guangdong",
      "guangxi",
      "hainan",
      "chongqing",
      "sichuan",
      "guizhou",
      "yunnan",
      "tibet",
      "shanxi_sx",
      "gansu",
      "qinghai",
      "ningxia",
      "xinjiang",
      "hongkong",
      "macao",
      "taiwan",
      "overseas",
      "unknown"
    ],
    "hasImportance": false
  },
  {
    "id": "q_jiangsu_city",
    "type": "single_select",
    "section": "basics",
    "text": "我来自江苏省哪个城市：",
    "options": [
      "nanjing",
      "suzhou",
      "wuxi",
      "changzhou",
      "zhenjiang",
      "yangzhou",
      "taizhou",
      "nantong",
      "yancheng",
      "lianyungang",
      "huaian",
      "suqian",
      "xuzhou"
    ],
    "hasImportance": false,
    "required": false,
    "dependsOn": {
      "questionId": "q3",
      "value": "jiangsu"
    }
  },
  {
    "id": "q4",
    "type": "single_select",
    "section": "basics",
    "text": "我更希望匹配对象的家乡与我：",
    "options": [
      "prefer_same_city",
      "prefer_same_province",
      "prefer_nearby",
      "neutral"
    ],
    "hasImportance": false
  },
  {
    "id": "q6",
    "type": "single_select",
    "section": "basics",
    "text": "我对跨校区的接受度：",
    "options": [
      "same_campus_only",
      "nanjing_campuses",
      "select_campuses",
      "any_campus"
    ],
    "hasImportance": false
  },
  {
    "id": "q6_campus_select",
    "type": "multi_select",
    "section": "basics",
    "text": "我可以接受的校区（最多选 3 个，若四个都行请选「都可以」）：",
    "options": [
      "xianlin",
      "gulou",
      "pukou",
      "suzhou_campus"
    ],
    "maxSelect": 3,
    "hasImportance": false,
    "required": false,
    "dependsOn": {
      "questionId": "q6",
      "value": "select_campuses"
    }
  },
  {
    "id": "q8",
    "type": "multi_select",
    "section": "interests",
    "text": "我的核心兴趣爱好（限选 4 项）：",
    "options": [
      "gym_fitness",
      "running_outdoor",
      "ball_sports",
      "swimming_dance",
      "movies_series",
      "gaming",
      "anime_acg",
      "boardgame_larp",
      "photo_exhibitions",
      "reading_writing",
      "fiction_fanfic",
      "food_exploring",
      "travel_citywalk",
      "music_listening",
      "live_show",
      "pets",
      "programming_geek",
      "finance_business",
      "other_interest"
    ],
    "maxSelect": 4,
    "hasImportance": false
  },
  {
    "id": "q_mv_type",
    "type": "multi_select",
    "section": "interests",
    "text": "你更偏好的影视类型（可多选）：",
    "options": [
      "comedy",
      "romance",
      "suspense_crime",
      "sci_fi",
      "action",
      "horror",
      "arthouse",
      "animation",
      "documentary"
    ],
    "maxSelect": 9,
    "hasImportance": false,
    "dependsOn": {
      "questionId": "q8",
      "value": "movies_series"
    }
  },
  {
    "id": "q_mv_media",
    "type": "multi_select",
    "section": "interests",
    "text": "你更常看的影视媒介：",
    "options": [
      "cn_drama",
      "us_drama",
      "uk_drama",
      "kr_drama",
      "jp_drama",
      "movie"
    ],
    "maxSelect": 6,
    "hasImportance": false,
    "dependsOn": {
      "questionId": "q8",
      "value": "movies_series"
    }
  },
  {
    "id": "q_mv_together",
    "type": "single_select",
    "section": "interests",
    "text": "你更希望怎么一起看：",
    "options": [
      "watch_offline",
      "watch_online",
      "discuss_plot",
      "all_fine"
    ],
    "hasImportance": false,
    "dependsOn": {
      "questionId": "q8",
      "value": "movies_series"
    }
  },
  {
    "id": "q_bg_type",
    "type": "multi_select",
    "section": "interests",
    "text": "你更喜欢哪类线下游戏：",
    "options": [
      "werewolf_avalon",
      "party_boardgame",
      "german_strategy",
      "murder_mystery",
      "escape_room"
    ],
    "maxSelect": 5,
    "hasImportance": false,
    "dependsOn": {
      "questionId": "q8",
      "value": "boardgame_larp"
    }
  },
  {
    "id": "q_bg_prio",
    "type": "multi_select",
    "section": "interests",
    "text": "你最在意什么（最多选 2 项）：",
    "options": [
      "no_bail",
      "logic_matters",
      "chill_vibe",
      "newbie_friendly",
      "prefer_friends"
    ],
    "maxSelect": 2,
    "hasImportance": false,
    "dependsOn": {
      "questionId": "q8",
      "value": "boardgame_larp"
    }
  },
  {
    "id": "q_acg_contact",
    "type": "multi_select",
    "section": "interests",
    "text": "你更常接触：",
    "options": [
      "anime",
      "manga",
      "light_novel",
      "fanfic",
      "cosplay",
      "convention",
      "vtuber",
      "goods"
    ],
    "maxSelect": 8,
    "hasImportance": false,
    "dependsOn": {
      "questionId": "q8",
      "value": "anime_acg"
    }
  },
  {
    "id": "q_acg_together",
    "type": "single_select",
    "section": "interests",
    "text": "你更希望怎么一起玩：",
    "options": [
      "watch_anime",
      "go_convention",
      "discuss_chars",
      "buy_goods",
      "all_fine"
    ],
    "hasImportance": false,
    "dependsOn": {
      "questionId": "q8",
      "value": "anime_acg"
    }
  },
  {
    "id": "q_ph_direction",
    "type": "multi_select",
    "section": "interests",
    "text": "你更偏好的方向：",
    "options": [
      "portrait",
      "street",
      "film",
      "digital",
      "art_museum",
      "museum",
      "photo_exhibition",
      "installation"
    ],
    "maxSelect": 8,
    "hasImportance": false,
    "dependsOn": {
      "questionId": "q8",
      "value": "photo_exhibitions"
    }
  },
  {
    "id": "q_ph_self",
    "type": "single_select",
    "section": "interests",
    "text": "你的摄影/看展经验更接近：",
    "options": [
      "ph_newbie",
      "ph_casual",
      "ph_experienced",
      "ph_pro"
    ],
    "hasImportance": false,
    "dependsOn": {
      "questionId": "q8",
      "value": "photo_exhibitions"
    }
  },
  {
    "id": "q_ph_prio",
    "type": "single_select",
    "section": "interests",
    "text": "你更看重：",
    "options": [
      "focus_photo",
      "focus_art",
      "focus_company"
    ],
    "hasImportance": false,
    "dependsOn": {
      "questionId": "q8",
      "value": "photo_exhibitions"
    }
  },
  {
    "id": "q_fd_type",
    "type": "multi_select",
    "section": "interests",
    "text": "你更偏好：",
    "options": [
      "cheap_eats",
      "cafe_dessert",
      "hotpot_bbq",
      "jp_kr_food",
      "western_brunch",
      "milk_tea",
      "late_night",
      "hidden_gem",
      "home_cook"
    ],
    "maxSelect": 9,
    "hasImportance": false,
    "dependsOn": {
      "questionId": "q8",
      "value": "food_exploring"
    }
  },
  {
    "id": "q_fd_prio",
    "type": "multi_select",
    "section": "interests",
    "text": "约饭时你更看重（最多选 2 项）：",
    "options": [
      "taste",
      "value_money",
      "good_chat",
      "nice_ambiance",
      "close_by",
      "instagrammable"
    ],
    "maxSelect": 2,
    "hasImportance": false,
    "dependsOn": {
      "questionId": "q8",
      "value": "food_exploring"
    }
  },
  {
    "id": "q_tr_type",
    "type": "multi_select",
    "section": "interests",
    "text": "你更喜欢哪种出行：",
    "options": [
      "campus_walk",
      "city_walk",
      "cafe_hop",
      "short_trip",
      "speed_trip",
      "slow_stroll",
      "photo_spot",
      "random_explore"
    ],
    "maxSelect": 8,
    "hasImportance": false,
    "dependsOn": {
      "questionId": "q8",
      "value": "travel_citywalk"
    }
  },
  {
    "id": "q_tr_style",
    "type": "single_select",
    "section": "interests",
    "text": "你出门风格更接近：",
    "options": [
      "detailed_plan",
      "rough_plan",
      "totally_random"
    ],
    "hasImportance": false,
    "dependsOn": {
      "questionId": "q8",
      "value": "travel_citywalk"
    }
  },
  {
    "id": "q_sp_type",
    "type": "multi_select",
    "section": "interests",
    "text": "你平时主要的健身 / 户外运动项目（最多选 3 项）：",
    "options": [
      "weight_training",
      "running",
      "cycling",
      "swimming",
      "yoga_pilates",
      "dancing",
      "hiking_climbing",
      "other_specify"
    ],
    "maxSelect": 3,
    "hasImportance": false,
    "dependsOn": {
      "questionId": "q8",
      "value": [
        "gym_fitness",
        "running_outdoor"
      ]
    }
  },
  {
    "id": "q_ball_sport",
    "type": "multi_select",
    "section": "interests",
    "text": "经常参与或喜欢的球类运动（选填，最多选 4 项）：",
    "options": [
      "badminton",
      "basketball",
      "table_tennis",
      "tennis",
      "football",
      "volleyball",
      "billiards",
      "other_specify"
    ],
    "maxSelect": 4,
    "hasImportance": false,
    "required": false,
    "dependsOn": {
      "questionId": "q8",
      "value": "ball_sports"
    }
  },
  {
    "id": "q_sp_self",
    "type": "single_select",
    "section": "interests",
    "text": "你自身的运动频率/水平是：",
    "options": [
      "sp_newbie",
      "sp_casual",
      "sp_regular",
      "sp_pro"
    ],
    "hasImportance": false,
    "dependsOn": {
      "questionId": "q8",
      "value": [
        "gym_fitness",
        "running_outdoor",
        "ball_sports",
        "swimming_dance"
      ]
    }
  },
  {
    "id": "q_sp_partner",
    "type": "single_select",
    "section": "interests",
    "text": "你更想找哪种运动搭子：",
    "options": [
      "long_term",
      "similar_level",
      "pure_company",
      "need_coach"
    ],
    "hasImportance": false,
    "dependsOn": {
      "questionId": "q8",
      "value": [
        "gym_fitness",
        "running_outdoor",
        "ball_sports",
        "swimming_dance"
      ]
    }
  },
  {
    "id": "q_gm_platform",
    "type": "multi_select",
    "section": "interests",
    "text": "我常玩的游戏平台：",
    "options": [
      "mobile",
      "pc",
      "switch_console",
      "single_player",
      "follow_friends"
    ],
    "maxSelect": 5,
    "hasImportance": false,
    "dependsOn": {
      "questionId": "q8",
      "value": "gaming"
    }
  },
  {
    "id": "q_gm_genre",
    "type": "multi_select",
    "section": "interests",
    "text": "我更偏好的游戏类型：",
    "options": [
      "moba",
      "fps",
      "open_world_rpg",
      "gacha",
      "party_casual",
      "rhythm",
      "card_strategy",
      "simulation",
      "story_puzzle",
      "survival_build",
      "other_specify"
    ],
    "maxSelect": 11,
    "hasImportance": false,
    "dependsOn": {
      "questionId": "q8",
      "value": "gaming"
    }
  },
  {
    "id": "q_gm_mobile",
    "type": "multi_select",
    "section": "interests",
    "text": "我最近常玩的手游：",
    "options": [
      "honor_of_kings",
      "tft",
      "pubg_mobile",
      "eggy_party",
      "genshin",
      "star_rail",
      "wuthering",
      "arknights",
      "love_nikki",
      "identity_v",
      "other_specify"
    ],
    "maxSelect": 11,
    "hasImportance": false,
    "required": false,
    "dependsOn": {
      "questionId": "q_gm_platform",
      "value": "mobile"
    }
  },
  {
    "id": "q_gm_pc",
    "type": "multi_select",
    "section": "interests",
    "text": "我最近常玩的 PC / 端游：",
    "options": [
      "lol",
      "valorant",
      "cs2",
      "apex",
      "ow2",
      "dbd",
      "minecraft",
      "gta5",
      "stardew",
      "r6",
      "warframe",
      "it_takes_two",
      "delta_force",
      "marvel_rivals",
      "dota2",
      "rock_kingdom_world",
      "other_specify"
    ],
    "maxSelect": 17,
    "hasImportance": false,
    "required": false,
    "dependsOn": {
      "questionId": "q_gm_platform",
      "value": "pc"
    }
  },
  {
    "id": "q_gm_switch",
    "type": "multi_select",
    "section": "interests",
    "text": "我最近常玩的 Switch / 主机游戏：",
    "options": [
      "zelda",
      "mario_kart",
      "animal_crossing",
      "pokemon",
      "smash_bros",
      "splatoon",
      "overcooked",
      "minecraft_sw",
      "xenoblade",
      "stardew_sw",
      "other_specify"
    ],
    "maxSelect": 11,
    "hasImportance": false,
    "required": false,
    "dependsOn": {
      "questionId": "q_gm_platform",
      "value": "switch_console"
    }
  },
  {
    "id": "q_gm_self",
    "type": "single_select",
    "section": "interests",
    "text": "一起打游戏时，我自己的状态更接近：",
    "options": [
      "newbie",
      "casual",
      "experienced",
      "tryhard",
      "depends_game"
    ],
    "hasImportance": false,
    "dependsOn": {
      "questionId": "q8",
      "value": "gaming"
    }
  },
  {
    "id": "q_gm_partner",
    "type": "single_select",
    "section": "interests",
    "text": "我更希望对方和我的游戏水平：",
    "options": [
      "some_gap_ok",
      "must_close",
      "carry_or_carried",
      "dont_care"
    ],
    "hasImportance": false,
    "dependsOn": {
      "questionId": "q8",
      "value": "gaming"
    }
  },
  {
    "id": "q_music_style",
    "type": "multi_select",
    "section": "interests",
    "text": "钟爱的音乐风格（选填）：",
    "options": [
      "c_pop",
      "k_pop",
      "j_pop",
      "western_pop",
      "rock",
      "hip_hop_rap",
      "r_and_b",
      "electronic_dance",
      "classical",
      "jazz_blues",
      "folk_country",
      "indie",
      "acg_vocaloid",
      "other_specify"
    ],
    "maxSelect": 4,
    "hasImportance": false,
    "required": false,
    "dependsOn": {
      "questionId": "q8",
      "value": [
        "music_listening",
        "live_show"
      ]
    }
  },
  {
    "id": "q_read_type",
    "type": "multi_select",
    "section": "interests",
    "text": "最近喜欢看的书籍品类（选填）：",
    "options": [
      "lit_fiction",
      "sci_fi_fantasy",
      "history_bio",
      "philosophy_social",
      "science_tech",
      "business_econ",
      "poetry_essay",
      "comics_picture_book",
      "other_specify"
    ],
    "maxSelect": 4,
    "hasImportance": false,
    "required": false,
    "dependsOn": {
      "questionId": "q8",
      "value": "reading_writing"
    }
  },
  {
    "id": "q_novel_type",
    "type": "multi_select",
    "section": "interests",
    "text": "偏好的小说类型（选填）：",
    "options": [
      "romance_novel",
      "suspense_thriller",
      "wuxia_xianxia",
      "sci_fi_novel",
      "fantasy_magic",
      "bl_danmei",
      "gl_baihe",
      "fanfic_novel",
      "other_specify"
    ],
    "maxSelect": 4,
    "hasImportance": false,
    "required": false,
    "dependsOn": {
      "questionId": "q8",
      "value": "fiction_fanfic"
    }
  },
  {
    "id": "q_top_interest",
    "type": "single_select",
    "section": "interests",
    "text": "如果只能选一个最希望和对象共享的兴趣方向：",
    "options": [
      "gym_fitness",
      "running_outdoor",
      "ball_sports",
      "swimming_dance",
      "movies_series",
      "gaming",
      "anime_acg",
      "boardgame_larp",
      "photo_exhibitions",
      "reading_writing",
      "fiction_fanfic",
      "food_exploring",
      "travel_citywalk",
      "music_listening",
      "live_show",
      "pets",
      "programming_geek",
      "finance_business",
      "other_interest"
    ],
    "hasImportance": false
  },
  {
    "id": "q_date_content",
    "type": "multi_select",
    "section": "interests",
    "text": "我理想中的约会内容更接近（最多选 3 项）：",
    "options": [
      "eat_explore",
      "walk_citywalk",
      "movie_series",
      "sports",
      "gaming",
      "exhibition_photo",
      "study",
      "live_concert",
      "travel_nearby",
      "just_chat"
    ],
    "maxSelect": 3,
    "hasImportance": false
  },
  {
    "id": "q_weekend_date",
    "type": "single_select",
    "section": "interests",
    "text": "周末约会我更倾向：",
    "options": [
      "campus_fine",
      "both_ok",
      "prefer_outside"
    ],
    "hasImportance": false
  },
  {
    "id": "q9",
    "type": "single_select",
    "section": "lifestyle",
    "text": "我有吸烟或抽电子烟的习惯：",
    "options": [
      "yes",
      "no"
    ],
    "hasImportance": false
  },
  {
    "id": "q10",
    "type": "likert",
    "section": "lifestyle",
    "text": "我对匹配对象吸烟或抽电子烟的接受度：",
    "scale": {
      "min": 1,
      "max": 7,
      "minLabel": "完全不能接受",
      "maxLabel": "完全可以接受"
    },
    "hasImportance": true
  },
  {
    "id": "q_drink_freq",
    "type": "single_select",
    "section": "lifestyle",
    "text": "我饮酒的频率更接近：",
    "options": [
      "rarely",
      "occasionally",
      "sometimes",
      "frequently"
    ],
    "hasImportance": false
  },
  {
    "id": "q_drink_pref",
    "type": "likert",
    "section": "lifestyle",
    "text": "我对匹配对象饮酒习惯的接受度：",
    "scale": {
      "min": 1,
      "max": 7,
      "minLabel": "只能接受基本不喝",
      "maxLabel": "完全无所谓"
    },
    "hasImportance": true
  },
  {
    "id": "q_pet_like",
    "type": "likert",
    "section": "lifestyle",
    "text": "我对小动物的喜欢程度：",
    "scale": {
      "min": 1,
      "max": 7,
      "minLabel": "完全不喜欢",
      "maxLabel": "非常喜欢"
    },
    "hasImportance": true
  },
  {
    "id": "q_pet_partner",
    "type": "likert",
    "section": "lifestyle",
    "text": "我希望对方喜欢小动物的程度：",
    "scale": {
      "min": 1,
      "max": 7,
      "minLabel": "完全不重要",
      "maxLabel": "非常重要"
    },
    "hasImportance": true
  },
  {
    "id": "q15",
    "type": "single_select",
    "section": "lifestyle",
    "text": "我的作息习惯：",
    "options": [
      "early_sleep_early_rise",
      "early_sleep_late_rise",
      "late_sleep_late_rise",
      "late_sleep_early_rise"
    ],
    "hasImportance": false
  },
  {
    "id": "q_schedule_imp",
    "type": "likert",
    "section": "lifestyle",
    "text": "我对对方作息与我一致的重视程度：",
    "scale": {
      "min": 1,
      "max": 7,
      "minLabel": "完全不重要",
      "maxLabel": "非常重要"
    },
    "hasImportance": true
  },
  {
    "id": "q_free_time",
    "type": "multi_select",
    "section": "lifestyle",
    "text": "我更常有空的时间（可多选）：",
    "options": [
      "weekday_day",
      "weekday_night",
      "sat_day",
      "sat_night",
      "sun_day",
      "sun_night"
    ],
    "maxSelect": 6,
    "hasImportance": false
  },
  {
    "id": "q_spend_style",
    "type": "single_select",
    "section": "lifestyle",
    "text": "消费时，我更愿意把钱花在：",
    "options": [
      "experience",
      "material",
      "balanced"
    ],
    "hasImportance": false
  },
  {
    "id": "q_spend_imp",
    "type": "likert",
    "section": "lifestyle",
    "text": "我认为两个人的消费观相近，在关系中：",
    "scale": {
      "min": 1,
      "max": 7,
      "minLabel": "完全不重要",
      "maxLabel": "非常重要"
    },
    "hasImportance": true
  },
  {
    "id": "q32",
    "type": "single_select",
    "section": "lifestyle",
    "text": "恋爱中的日常开销，我更舒服的方式是：",
    "options": [
      "share_equally",
      "i_pay_more",
      "partner_pays_more",
      "go_with_flow"
    ],
    "hasImportance": false,
    "partnerOnly": true
  },
  {
    "id": "q_spend_mode_imp",
    "type": "likert",
    "section": "lifestyle",
    "text": "我对双方开销方式契合的重视程度：",
    "scale": {
      "min": 1,
      "max": 7,
      "minLabel": "完全不重要",
      "maxLabel": "非常重要"
    },
    "hasImportance": true,
    "partnerOnly": true
  },
  {
    "id": "q37",
    "type": "likert",
    "section": "lifestyle",
    "text": "我对生活环境的整洁度要求极高（有轻微或严重洁癖）：",
    "scale": {
      "min": 1,
      "max": 7,
      "minLabel": "完全不符合",
      "maxLabel": "非常符合"
    },
    "hasImportance": true
  },
  {
    "id": "q38",
    "type": "likert",
    "section": "lifestyle",
    "text": "我习惯做详尽的计划，非常不喜欢\"说走就走\"的突然改变：",
    "scale": {
      "min": 1,
      "max": 7,
      "minLabel": "完全不符合",
      "maxLabel": "非常符合"
    },
    "hasImportance": true
  },
  {
    "id": "q_rel_mode",
    "type": "single_select",
    "section": "communication",
    "text": "在感情的推进与互动中，我更倾向的模式是：",
    "options": [
      "proactive",
      "prefer_partner_active",
      "mutual_active",
      "casual_flow"
    ],
    "hasImportance": false,
    "partnerOnly": true
  },
  {
    "id": "q_my_pace",
    "type": "single_select",
    "section": "communication",
    "text": "我进入一段关系的节奏更接近：",
    "options": [
      "slow_careful",
      "fast_if_chemistry",
      "depends"
    ],
    "hasImportance": false,
    "partnerOnly": true
  },
  {
    "id": "q_atmosphere",
    "type": "single_select",
    "section": "communication",
    "text": "我更喜欢的相处氛围：",
    "options": [
      "lively_talkative",
      "mix_talk_quiet",
      "quiet_comfy",
      "depends_mood"
    ],
    "hasImportance": false
  },
  {
    "id": "q_conflict_self",
    "type": "single_select",
    "section": "communication",
    "text": "当发生矛盾时，我更接近：",
    "options": [
      "talk_now",
      "cool_then_talk",
      "avoid_delay",
      "depends"
    ],
    "hasImportance": false
  },
  {
    "id": "q_conflict_partner",
    "type": "single_select",
    "section": "communication",
    "text": "我更希望对方在发生矛盾时：",
    "options": [
      "talk_now",
      "cool_first",
      "no_pressure",
      "dont_care"
    ],
    "hasImportance": false
  },
  {
    "id": "q_support_pref",
    "type": "single_select",
    "section": "communication",
    "text": "我遇到挫折时，更希望对方：",
    "options": [
      "emotional_support",
      "analyze_problem",
      "both",
      "depends"
    ],
    "hasImportance": false
  },
  {
    "id": "q_reply_speed",
    "type": "single_select",
    "section": "communication",
    "text": "我的消息回复速度通常：",
    "options": [
      "very_fast",
      "normal",
      "slow",
      "depends_mood"
    ],
    "hasImportance": false
  },
  {
    "id": "q_reply_pref",
    "type": "likert",
    "section": "communication",
    "text": "我对匹配对象消息回复速度的期待：",
    "scale": {
      "min": 1,
      "max": 7,
      "minLabel": "有空再回就行",
      "maxLabel": "希望非常及时"
    },
    "hasImportance": true
  },
  {
    "id": "q41",
    "type": "likert",
    "section": "communication",
    "text": "我每天需要独处时间的程度：",
    "scale": {
      "min": 1,
      "max": 7,
      "minLabel": "完全不需要",
      "maxLabel": "非常需要"
    },
    "hasImportance": true
  },
  {
    "id": "q36",
    "type": "likert",
    "section": "communication",
    "text": "恋爱中我对高频陪伴与黏性的需要程度：",
    "scale": {
      "min": 1,
      "max": 7,
      "minLabel": "完全不需要",
      "maxLabel": "非常需要"
    },
    "hasImportance": true,
    "partnerOnly": true
  },
  {
    "id": "q_affection_need",
    "type": "likert",
    "section": "communication",
    "text": "我对伴侣高频表达爱意的需要程度：",
    "scale": {
      "min": 1,
      "max": 7,
      "minLabel": "完全不需要",
      "maxLabel": "非常需要"
    },
    "hasImportance": true,
    "partnerOnly": true
  },
  {
    "id": "q_physical_pace",
    "type": "likert",
    "section": "communication",
    "text": "在关系初期，我对身体接触（如牵手、拥抱）的接受速度：",
    "scale": {
      "min": 1,
      "max": 7,
      "minLabel": "非常慢热",
      "maxLabel": "顺其自然"
    },
    "hasImportance": true,
    "partnerOnly": true
  },
  {
    "id": "q_rel_history",
    "type": "likert",
    "section": "boundary",
    "text": "我过去进入过几段较正式的恋爱关系：",
    "scale": {
      "min": 1,
      "max": 7,
      "minLabel": "0段",
      "maxLabel": "6段或以上"
    },
    "hasImportance": true,
    "partnerOnly": true
  },
  {
    "id": "q_history_imp",
    "type": "likert",
    "section": "boundary",
    "text": "我希望对方过往有过几段恋爱经历：",
    "scale": {
      "min": 1,
      "max": 7,
      "minLabel": "0段",
      "maxLabel": "6段或以上"
    },
    "hasImportance": true,
    "partnerOnly": true
  },
  {
    "id": "q44",
    "type": "likert",
    "section": "boundary",
    "text": "当我缺乏安全感时，我查看伴侣手机的倾向：",
    "scale": {
      "min": 1,
      "max": 7,
      "minLabel": "完全不会",
      "maxLabel": "非常可能"
    },
    "hasImportance": true,
    "partnerOnly": true
  },
  {
    "id": "q47",
    "type": "likert",
    "section": "boundary",
    "text": "我自己的占有欲 / 吃醋倾向：",
    "scale": {
      "min": 1,
      "max": 7,
      "minLabel": "非常低",
      "maxLabel": "非常高"
    },
    "hasImportance": true,
    "partnerOnly": true
  },
  {
    "id": "q48",
    "type": "likert",
    "section": "boundary",
    "text": "我对伴侣占有欲 / 吃醋程度的接受度：",
    "scale": {
      "min": 1,
      "max": 7,
      "minLabel": "完全不能接受",
      "maxLabel": "完全可以接受"
    },
    "hasImportance": true,
    "partnerOnly": true
  },
  {
    "id": "q_space_integration",
    "type": "single_select",
    "section": "boundary",
    "text": "恋爱后，我更理想的相处状态是：",
    "options": [
      "high_integration",
      "balanced_space",
      "high_independence",
      "space_depends"
    ],
    "hasImportance": false,
    "partnerOnly": true
  },
  {
    "id": "q_red_flags",
    "type": "multi_select",
    "section": "boundary",
    "text": "我最不能接受的恋爱中的问题（最多选 3 项）：",
    "options": [
      "ghost_msg",
      "flirt_opposite",
      "emotional_unstable",
      "phone_control",
      "too_clingy",
      "too_cold",
      "stand_up",
      "spend_gap",
      "hurtful_words",
      "disrespect_circle",
      "other_flag"
    ],
    "maxSelect": 3,
    "hasImportance": false,
    "partnerOnly": true
  },
  {
    "id": "q57",
    "type": "likert",
    "section": "boundary",
    "text": "我能够接受开放式关系（如双方知情同意下的非排他性关系）：",
    "scale": {
      "min": 1,
      "max": 7,
      "minLabel": "完全不能接受",
      "maxLabel": "完全可以接受"
    },
    "hasImportance": true,
    "partnerOnly": true
  },
  {
    "id": "q21",
    "type": "likert",
    "section": "values",
    "text": "我希望匹配对象是一个非常上进、目标导向的人：",
    "scale": {
      "min": 1,
      "max": 7,
      "minLabel": "完全不重要",
      "maxLabel": "非常重要"
    },
    "hasImportance": true
  },
  {
    "id": "q_work_style",
    "type": "likert",
    "section": "values",
    "text": "我的做事风格更接近：",
    "scale": {
      "min": 1,
      "max": 7,
      "minLabel": "非常佛系",
      "maxLabel": "非常上进"
    },
    "hasImportance": true
  },
  {
    "id": "q27",
    "type": "likert",
    "section": "values",
    "text": "相比事业优先，我更看重关系与生活幸福感：",
    "scale": {
      "min": 1,
      "max": 7,
      "minLabel": "完全不符合",
      "maxLabel": "非常符合"
    },
    "hasImportance": true
  },
  {
    "id": "q24",
    "type": "likert",
    "section": "values",
    "text": "我未来希望组建家庭并拥有孩子：",
    "scale": {
      "min": 1,
      "max": 7,
      "minLabel": "完全不符合",
      "maxLabel": "非常符合"
    },
    "hasImportance": true,
    "partnerOnly": true
  },
  {
    "id": "q25",
    "type": "likert",
    "section": "values",
    "text": "在关键利益面前，善良比聪明更重要：",
    "scale": {
      "min": 1,
      "max": 7,
      "minLabel": "完全不符合",
      "maxLabel": "非常符合"
    },
    "hasImportance": true
  },
  {
    "id": "q33",
    "type": "likert",
    "section": "values",
    "text": "智商（聪明、有深度）比情商（会照顾人、提供情绪价值）更吸引我：",
    "scale": {
      "min": 1,
      "max": 7,
      "minLabel": "完全不符合",
      "maxLabel": "非常符合"
    },
    "hasImportance": true
  },
  {
    "id": "q26",
    "type": "likert",
    "section": "values",
    "text": "我愿意为了理想与热爱，放弃一部分物质舒适：",
    "scale": {
      "min": 1,
      "max": 7,
      "minLabel": "完全不符合",
      "maxLabel": "非常符合"
    },
    "hasImportance": true
  },
  {
    "id": "q28",
    "type": "likert",
    "section": "values",
    "text": "我认为世界上 99% 的烦恼都可以用钱来解决：",
    "scale": {
      "min": 1,
      "max": 7,
      "minLabel": "完全不符合",
      "maxLabel": "非常符合"
    },
    "hasImportance": true
  },
  {
    "id": "q30",
    "type": "likert",
    "section": "values",
    "text": "物质财富的积累比精神上的共鸣更重要：",
    "scale": {
      "min": 1,
      "max": 7,
      "minLabel": "完全不符合",
      "maxLabel": "非常符合"
    },
    "hasImportance": true
  },
  {
    "id": "q_future_base",
    "type": "multi_select",
    "section": "values",
    "text": "我未来倾向发展的地区（可多选，最多 3 项）：",
    "options": [
      "jiangsu",
      "shanghai",
      "zhejiang",
      "anhui",
      "beijing",
      "guangdong",
      "sichuan_chongqing",
      "east_china_other",
      "north_china",
      "central_china",
      "south_china",
      "southwest",
      "northwest",
      "northeast",
      "hk_macao_tw_overseas",
      "undecided",
      "opportunity_first"
    ],
    "maxSelect": 3,
    "hasImportance": false
  },
  {
    "id": "q_future_base_imp",
    "type": "likert",
    "section": "values",
    "text": "我对对象未来发展地区与我一致的重视程度：",
    "scale": {
      "min": 1,
      "max": 7,
      "minLabel": "完全不重要",
      "maxLabel": "非常重要"
    },
    "hasImportance": true
  },
  {
    "id": "q_growth_env",
    "type": "single_select",
    "section": "values",
    "text": "我的成长环境更接近：",
    "options": [
      "tier1_core",
      "tier2",
      "tier3_4",
      "county",
      "rural"
    ],
    "hasImportance": false
  },
  {
    "id": "q_family_econ",
    "type": "single_select",
    "section": "values",
    "text": "我对自己家庭经济条件的感受更接近：",
    "options": [
      "tight",
      "normal",
      "comfortable",
      "very_comfortable",
      "prefer_not_say"
    ],
    "hasImportance": false
  },
  {
    "id": "q31",
    "type": "likert",
    "section": "values",
    "text": "我认为两个人的家庭背景和成长环境相近，在关系中：",
    "scale": {
      "min": 1,
      "max": 7,
      "minLabel": "完全不重要",
      "maxLabel": "非常重要"
    },
    "hasImportance": true
  },
  {
    "id": "q29",
    "type": "multi_select",
    "section": "values",
    "text": "我自己更接近哪些品质（限选 4 项）：",
    "options": [
      "kindness",
      "honesty",
      "loyalty",
      "integrity",
      "self_discipline",
      "ambition",
      "independence",
      "curiosity",
      "creativity",
      "family",
      "freedom",
      "friendship",
      "fairness",
      "courage",
      "adventure",
      "faith"
    ],
    "maxSelect": 4,
    "hasImportance": false
  },
  {
    "id": "q_partner_qualities",
    "type": "multi_select",
    "section": "values",
    "text": "我最看重对方具备哪些品质（限选 4 项）：",
    "options": [
      "kindness",
      "honesty",
      "loyalty",
      "integrity",
      "self_discipline",
      "ambition",
      "independence",
      "curiosity",
      "creativity",
      "family",
      "freedom",
      "friendship",
      "fairness",
      "courage",
      "adventure",
      "faith"
    ],
    "maxSelect": 4,
    "hasImportance": false
  },
  {
    "id": "q60",
    "type": "single_select",
    "section": "values",
    "text": "在以上所有维度里，你认为匹配中最重要的是：",
    "options": [
      "interests",
      "lifestyle",
      "communication",
      "boundary",
      "values"
    ],
    "hasImportance": false
  },
  {
    "id": "q_must_align",
    "type": "single_select",
    "section": "values",
    "text": "如果只能有一个方面和对方高度一致，你最希望是（选填）：",
    "options": [
      "life_habit",
      "schedule_vibe",
      "interests_shared",
      "comm_style",
      "values_money",
      "values_future",
      "family_bg"
    ],
    "hasImportance": false,
    "required": false
  }
];
