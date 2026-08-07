BEGIN;

INSERT INTO users (
  id, email, nickname, gender, gender_pref, intention, grade, campus,
  department, mbti, bio, signature, tags, is_participating,
  profile_complete, survey_complete, credit_score, credit_level
) VALUES
  ('agent-local-main', 'agent-local@test.local', '江宁', 'female', 'any', 'friend', 'graduate', 'xianlin', '软件学院', 'INFJ', '关注 Agent、LLM 应用和校园社交产品。', '想找可以长期交流的学习搭子。', '["Agent","LLM","人工智能","产品设计"]', true, true, true, 100, 'normal'),
  ('agent-peer-01', 'agent-peer-01@test.local', '林溪', 'female', 'any', 'friend', 'graduate', 'xianlin', '计算机系', 'INTJ', '研究多 Agent 协作与评测。', '每周组会讨论一次。', '["Agent","Python","论文"]', true, true, true, 100, 'normal'),
  ('agent-peer-02', 'agent-peer-02@test.local', '沐阳', 'male', 'any', 'friend', 'undergraduate', 'xianlin', '软件学院', 'ENFP', '在做 AI 应用和前端交互。', '喜欢把想法做成可用 Demo。', '["AI应用","React","产品"]', true, true, true, 100, 'normal'),
  ('agent-peer-03', 'agent-peer-03@test.local', '清舟', 'male', 'any', 'friend', 'graduate', 'gulou', '电子科学与工程学院', 'ISTP', '关注开源模型部署和推理优化。', '偏爱实验与性能数据。', '["开源模型","Docker","推理"]', true, true, true, 100, 'normal'),
  ('agent-peer-04', 'agent-peer-04@test.local', '若曦', 'female', 'any', 'friend', 'undergraduate', 'xianlin', '新闻传播学院', 'ENFJ', '参与校园社群运营和内容策划。', '让好内容被更多人看见。', '["社群","写作","活动策划"]', true, true, true, 100, 'normal'),
  ('agent-peer-05', 'agent-peer-05@test.local', '浩然', 'male', 'any', 'friend', 'graduate', 'xianlin', '数学系', 'INTP', '喜欢算法、数据分析和桌游。', '一起研究问题，也一起放松。', '["算法","数据","桌游"]', true, true, true, 100, 'normal'),
  ('agent-peer-06', 'agent-peer-06@test.local', '苏禾', 'female', 'any', 'friend', 'undergraduate', 'gulou', '文学院', 'ISFP', '喜欢阅读、展览和校园摄影。', '记录校园里的普通时刻。', '["阅读","摄影","展览"]', true, true, true, 100, 'normal'),
  ('agent-peer-07', 'agent-peer-07@test.local', '越白', 'male', 'any', 'friend', 'undergraduate', 'xianlin', '商学院', 'ENTJ', '组织跑步和羽毛球活动。', '周末不宅，去运动。', '["羽毛球","跑步","活动"]', true, true, true, 100, 'normal'),
  ('agent-peer-08', 'agent-peer-08@test.local', '子墨', 'female', 'any', 'friend', 'graduate', 'xianlin', '环境学院', 'INFP', '关注可持续生活与校园公益。', '从小事开始改变。', '["公益","环保","志愿者"]', true, true, true, 100, 'normal'),
  ('agent-peer-09', 'agent-peer-09@test.local', '嘉宁', 'male', 'any', 'friend', 'graduate', 'gulou', '物理学院', 'ENTP', '对科技讲座、科幻和硬件制作感兴趣。', '欢迎不同专业的观点。', '["科技","科幻","硬件"]', true, true, true, 100, 'normal')
ON CONFLICT (email) DO UPDATE SET
  nickname = EXCLUDED.nickname, gender = EXCLUDED.gender,
  gender_pref = EXCLUDED.gender_pref, intention = EXCLUDED.intention,
  grade = EXCLUDED.grade, campus = EXCLUDED.campus,
  department = EXCLUDED.department, mbti = EXCLUDED.mbti,
  bio = EXCLUDED.bio, signature = EXCLUDED.signature, tags = EXCLUDED.tags,
  is_participating = true, profile_complete = true, survey_complete = true,
  credit_score = 100, credit_level = 'normal', updated_at = now();

INSERT INTO survey_answers (id, user_id, answers, version, submitted_at, updated_at)
SELECT
  'agent-survey-' || split_part(email, '@', 1), id,
  jsonb_build_object(
    'q1', jsonb_build_object('value', 2002),
    'q2', jsonb_build_object('value', jsonb_build_array(1998, 2006)),
    'q61', jsonb_build_object('value', jsonb_build_array(lower(mbti), 'any_mbti')),
    'q5', jsonb_build_object('value', jsonb_build_array('same_grade', 'higher_grade')),
    'q6', jsonb_build_object('value', 'nanjing_campuses'),
    'q8', jsonb_build_object('value', tags),
    'q_top_interest', jsonb_build_object('value', 'study_together'),
    'q_date_content', jsonb_build_object('value', jsonb_build_array('walk_citywalk', 'eat_explore', 'movie_series')),
    'q_free_time', jsonb_build_object('value', jsonb_build_array('weekday_night', 'sat_day', 'sun_day')),
    'q_reply_pref', jsonb_build_object('value', 5, 'importance', 3),
    'q_schedule_imp', jsonb_build_object('value', 4, 'importance', 3),
    'q_spend_imp', jsonb_build_object('value', 3, 'importance', 2),
    'q37', jsonb_build_object('value', 4),
    'q38', jsonb_build_object('value', 3),
    'q41', jsonb_build_object('value', 3),
    'q36', jsonb_build_object('value', 4),
    'q_history_imp', jsonb_build_object('value', 2),
    'q50', jsonb_build_object('value', 4),
    'q44', jsonb_build_object('value', 1),
    'q47', jsonb_build_object('value', 2),
    'q48', jsonb_build_object('value', 3),
    'q49', jsonb_build_object('value', 4),
    'q21', jsonb_build_object('value', 4),
    'q27', jsonb_build_object('value', 4),
    'q24', jsonb_build_object('value', 3),
    'q25', jsonb_build_object('value', 4),
    'q33', jsonb_build_object('value', 4),
    'q29', jsonb_build_object('value', jsonb_build_array('kindness', 'honesty', 'curiosity')),
    'q_partner_qualities', jsonb_build_object('value', jsonb_build_array('kindness', 'honesty', 'curiosity')),
    'q_future_base', jsonb_build_object('value', jsonb_build_array('jiangsu', 'shanghai', 'zhejiang'))
  )::text,
  '4.0', now(), now()
FROM users WHERE email LIKE 'agent-%@test.local'
ON CONFLICT (user_id) DO UPDATE SET
  answers = EXCLUDED.answers, version = '4.0', updated_at = now();

INSERT INTO circles (id, name, slug, description, category, tag, tags, join_policy, creator_id, member_count, is_active, status)
VALUES
  ('agent-circle-ai', 'AI 与 Agent 学习圈', 'agent-local-ai', '交流 LLM、Agent Harness、RAG、评测和 AI 应用工程。', 'academic', 'Agent', '["Agent","LLM","RAG","论文"]', 'review', (SELECT id FROM users WHERE email='agent-peer-01@test.local'), 3, true, 'active'),
  ('agent-circle-builder', 'AI 产品实战工坊', 'agent-local-builder', '将 AI 想法做成可演示、可测试、可部署的产品。', 'professional', 'AI 应用', '["AI应用","React","Docker","产品"]', 'public', (SELECT id FROM users WHERE email='agent-peer-02@test.local'), 3, true, 'active'),
  ('agent-circle-sports', '仙林周末运动搭子', 'agent-local-sports', '羽毛球、跑步和轻量户外活动，新手友好。', 'sports', '羽毛球', '["羽毛球","跑步","仙林"]', 'public', (SELECT id FROM users WHERE email='agent-peer-07@test.local'), 2, true, 'active'),
  ('agent-circle-culture', '阅读摄影与展览', 'agent-local-culture', '分享近期阅读、校园摄影和南京展览信息。', 'arts', '摄影', '["阅读","摄影","展览"]', 'review', (SELECT id FROM users WHERE email='agent-peer-06@test.local'), 2, true, 'active')
ON CONFLICT (id) DO UPDATE SET
  name=EXCLUDED.name, description=EXCLUDED.description, category=EXCLUDED.category,
  tag=EXCLUDED.tag, tags=EXCLUDED.tags, join_policy=EXCLUDED.join_policy,
  creator_id=EXCLUDED.creator_id, member_count=EXCLUDED.member_count,
  is_active=true, status='active', updated_at=now();

INSERT INTO circle_members (id, circle_id, user_id, membership_status, answers, answers_complete, is_active)
VALUES
  ('agent-member-ai-01','agent-circle-ai',(SELECT id FROM users WHERE email='agent-peer-01@test.local'),'active','{}',true,true),
  ('agent-member-ai-03','agent-circle-ai',(SELECT id FROM users WHERE email='agent-peer-03@test.local'),'active','{}',true,true),
  ('agent-member-ai-05','agent-circle-ai',(SELECT id FROM users WHERE email='agent-peer-05@test.local'),'active','{}',true,true),
  ('agent-member-builder-02','agent-circle-builder',(SELECT id FROM users WHERE email='agent-peer-02@test.local'),'active','{}',true,true),
  ('agent-member-builder-04','agent-circle-builder',(SELECT id FROM users WHERE email='agent-peer-04@test.local'),'active','{}',true,true),
  ('agent-member-builder-09','agent-circle-builder',(SELECT id FROM users WHERE email='agent-peer-09@test.local'),'active','{}',true,true),
  ('agent-member-sports-07','agent-circle-sports',(SELECT id FROM users WHERE email='agent-peer-07@test.local'),'active','{}',true,true),
  ('agent-member-sports-05','agent-circle-sports',(SELECT id FROM users WHERE email='agent-peer-05@test.local'),'active','{}',true,true),
  ('agent-member-culture-06','agent-circle-culture',(SELECT id FROM users WHERE email='agent-peer-06@test.local'),'active','{}',true,true),
  ('agent-member-culture-08','agent-circle-culture',(SELECT id FROM users WHERE email='agent-peer-08@test.local'),'active','{}',true,true)
ON CONFLICT (circle_id, user_id) DO UPDATE SET membership_status='active', answers_complete=true, is_active=true, updated_at=now();

INSERT INTO forum_posts (id, user_id, circle_id, title, content, type, visibility, summary, like_count, comment_count, hot_score)
VALUES
  ('agent-post-01',(SELECT id FROM users WHERE email='agent-peer-01@test.local'),'agent-circle-ai','Agent Harness 学习会招募','讨论工具调用、Trace、Guardrail 和 HITL。','squad','public','面向 Agent 工程的周末学习会。',18,6,88),
  ('agent-post-02',(SELECT id FROM users WHERE email='agent-peer-03@test.local'),'agent-circle-ai','开源模型本地部署记录','分享 Docker 环境、推理参数和性能测试结果。','general','public','开源 LLM 本地推理与性能调优。',12,4,74),
  ('agent-post-03',(SELECT id FROM users WHERE email='agent-peer-05@test.local'),'agent-circle-ai','RAG 评测数据集共建','想找同学一起设计检索与回答评价指标。','help','public','共建 RAG 检索和回答评测数据。',9,3,65),
  ('agent-post-04',(SELECT id FROM users WHERE email='agent-peer-02@test.local'),'agent-circle-builder','两天做一个 AI 应用 Demo','从用户问题、API 接入到可用的前端界面。','activity','public','AI 应用快速原型工坊。',21,8,91),
  ('agent-post-05',(SELECT id FROM users WHERE email='agent-peer-04@test.local'),'agent-circle-builder','寻找擅长用户研究的搭子','需要一起梳理 Agent 产品的用户旅程和反馈。','squad','public','寻找 Agent 产品用户研究搭子。',15,5,80),
  ('agent-post-06',(SELECT id FROM users WHERE email='agent-peer-09@test.local'),'agent-circle-builder','本周科技讲座清单','汇总人工智能、硬件和创新创业相关讲座。','general','public','校内科技讲座与活动信息。',7,2,52),
  ('agent-post-07',(SELECT id FROM users WHERE email='agent-peer-07@test.local'),'agent-circle-sports','周六仙林羽毛球缺两人','下午三点至五点，新手友好，费用 AA。','squad','public','周六仙林羽毛球搭子招募。',16,7,83),
  ('agent-post-08',(SELECT id FROM users WHERE email='agent-peer-06@test.local'),'agent-circle-culture','南京近期展览清单','整理了三个适合周末去的摄影与当代艺术展。','general','public','周末摄影与当代艺术展推荐。',14,4,76),
  ('agent-post-09',(SELECT id FROM users WHERE email='agent-peer-08@test.local'),NULL,'校园公益活动与 Agent 志愿助手招募','本周日进行环保宣传与物资整理，也欢迎一起设计志愿者 Agent 工具。','activity','public','校园公益活动与 Agent 志愿助手共建。',11,3,60)
ON CONFLICT (id) DO UPDATE SET
  title=EXCLUDED.title, content=EXCLUDED.content, type=EXCLUDED.type,
  visibility='public', summary=EXCLUDED.summary, like_count=EXCLUDED.like_count,
  comment_count=EXCLUDED.comment_count, hot_score=EXCLUDED.hot_score,
  deleted_at=NULL, updated_at=now();

-- ---------------------------------------------------------------------------
-- Weekly matching: one currently revealed match and three meaningful outcomes.
-- week_of follows the product's Wednesday-based weekly rhythm.
-- ---------------------------------------------------------------------------

INSERT INTO matches (
  id, week_of, user_a_id, user_b_id, score, dimensions, curator_note,
  user_a_action, user_b_action, status, revealed_at, source, score_visible,
  special_label, activated_at, created_at
) VALUES
  (
    'agent-match-current',
    to_char(date_trunc('week', current_date) + interval '2 days', 'YYYY-MM-DD'),
    (SELECT id FROM users WHERE email='agent-local@test.local'),
    (SELECT id FROM users WHERE email='agent-peer-01@test.local'),
    0.873,
    '{"interest":0.92,"schedule":0.84,"communication":0.88,"values":0.85,"campus":1.0}',
    '你们都在持续学习 Agent 工程，沟通节奏与周末时间也比较一致。可以从一次轻量的论文或 Demo 交流开始。',
    NULL, NULL, 'REVEALED',
    date_trunc('week', current_date) + interval '2 days 20 hours',
    'weekly', true, '本周学习搭子',
    date_trunc('week', current_date) + interval '2 days 20 hours',
    date_trunc('week', current_date) + interval '2 days 18 hours'
  ),
  (
    'agent-match-mutual',
    to_char(date_trunc('week', current_date) - interval '5 days', 'YYYY-MM-DD'),
    (SELECT id FROM users WHERE email='agent-local@test.local'),
    (SELECT id FROM users WHERE email='agent-peer-02@test.local'),
    0.846,
    '{"interest":0.91,"schedule":0.78,"communication":0.89,"values":0.82,"campus":1.0}',
    '你们都喜欢把想法做成可用的产品，并且愿意用明确反馈推进合作。',
    'ACCEPT', 'ACCEPT', 'MUTUAL',
    date_trunc('week', current_date) - interval '5 days' + interval '20 hours',
    'weekly', true, '已互选',
    date_trunc('week', current_date) - interval '5 days' + interval '20 hours',
    date_trunc('week', current_date) - interval '5 days' + interval '18 hours'
  ),
  (
    'agent-match-missed',
    to_char(date_trunc('week', current_date) - interval '12 days', 'YYYY-MM-DD'),
    (SELECT id FROM users WHERE email='agent-local@test.local'),
    (SELECT id FROM users WHERE email='agent-peer-03@test.local'),
    0.731,
    '{"interest":0.79,"schedule":0.61,"communication":0.68,"values":0.75,"campus":0.6}',
    '你们对模型工程都有兴趣，但校区和交流方式存在一些差异。',
    'ACCEPT', 'REJECT', 'MISSED',
    date_trunc('week', current_date) - interval '12 days' + interval '20 hours',
    'weekly', true, NULL,
    date_trunc('week', current_date) - interval '12 days' + interval '20 hours',
    date_trunc('week', current_date) - interval '12 days' + interval '18 hours'
  ),
  (
    'agent-match-expired',
    to_char(date_trunc('week', current_date) - interval '19 days', 'YYYY-MM-DD'),
    (SELECT id FROM users WHERE email='agent-local@test.local'),
    (SELECT id FROM users WHERE email='agent-peer-04@test.local'),
    0.704,
    '{"interest":0.73,"schedule":0.69,"communication":0.72,"values":0.70,"campus":1.0}',
    '你们在校园产品与内容表达上有交集，这次匹配未在有效期内完成选择。',
    NULL, NULL, 'EXPIRED',
    date_trunc('week', current_date) - interval '19 days' + interval '20 hours',
    'weekly', true, NULL,
    date_trunc('week', current_date) - interval '19 days' + interval '20 hours',
    date_trunc('week', current_date) - interval '19 days' + interval '18 hours'
  )
ON CONFLICT (id) DO UPDATE SET
  week_of=EXCLUDED.week_of, score=EXCLUDED.score, dimensions=EXCLUDED.dimensions,
  curator_note=EXCLUDED.curator_note, user_a_action=EXCLUDED.user_a_action,
  user_b_action=EXCLUDED.user_b_action, status=EXCLUDED.status,
  revealed_at=EXCLUDED.revealed_at, score_visible=EXCLUDED.score_visible,
  special_label=EXCLUDED.special_label, activated_at=EXCLUDED.activated_at,
  created_at=EXCLUDED.created_at;

-- Safe, visibly fake contact handles make the historical MUTUAL result testable.
UPDATE users SET wechat_id='agent_peer_02_demo'
WHERE email='agent-peer-02@test.local';

-- ---------------------------------------------------------------------------
-- Richer forum corpus: campus-scale posts plus circle-scoped discussions.
-- ---------------------------------------------------------------------------

INSERT INTO forum_posts (
  id, user_id, circle_id, title, content, type, visibility, summary,
  like_count, favorite_count, comment_count, view_count, hot_score,
  last_interaction_at, created_at, updated_at
) VALUES
  ('agent-post-10',(SELECT id FROM users WHERE email='agent-peer-06@test.local'),NULL,
   '鼓楼到仙林的周末 Citywalk 路线征集',
   '想做一条两小时左右、适合边走边拍照的路线。希望包含安静街区、旧建筑和一家能坐下来聊天的小店，欢迎补充真实体验。',
   'help','public','征集南京校园周边的轻量 Citywalk 路线。',23,8,4,126,86,now()-interval '35 minutes',now()-interval '2 days',now()-interval '35 minutes'),
  ('agent-post-11',(SELECT id FROM users WHERE email='agent-peer-08@test.local'),NULL,
   '旧教材与闲置台灯交换，不希望它们直接落灰',
   '有高数习题册、环境科学导论和一盏可调色温台灯。优先交换人文社科书或一个小型桌面收纳盒，仅限校内当面。',
   'trade','public','校内闲置教材与生活用品友好交换。',10,5,3,79,58,now()-interval '2 hours',now()-interval '4 days',now()-interval '2 hours'),
  ('agent-post-12',(SELECT id FROM users WHERE email='agent-peer-04@test.local'),NULL,
   '第一次见网友，怎样安排会更自然也更安全？',
   '匹配到同校同学后想先约在公开场所聊四十分钟。大家觉得咖啡店、食堂还是校园散步更合适？也想听听边界感方面的建议。',
   'help','public','讨论首次线下见面的节奏、安全与边界。',31,12,6,188,96,now()-interval '18 minutes',now()-interval '18 hours',now()-interval '18 minutes'),
  ('agent-post-13',(SELECT id FROM users WHERE email='agent-peer-07@test.local'),NULL,
   '周日傍晚环湖慢跑，配速 6 分 30 左右',
   '从仙林校区出发，计划跑五公里，途中不追速度。已经有两人，想再找一到两位稳定参加的同学。',
   'squad','public','仙林周日五公里慢跑招募。',19,6,5,112,82,now()-interval '50 minutes',now()-interval '1 day',now()-interval '50 minutes'),
  ('agent-post-14',(SELECT id FROM users WHERE email='agent-peer-09@test.local'),NULL,
   '小型科幻阅读夜：技术会怎样改变亲密关系',
   '选读两篇短篇，不要求提前做完整笔记。希望从技术、伦理和个人经验三个角度聊天，控制在八人以内。',
   'activity','public','围绕技术与亲密关系的轻量科幻阅读会。',27,14,7,154,90,now()-interval '1 hour',now()-interval '3 days',now()-interval '1 hour'),
  ('agent-post-15',(SELECT id FROM users WHERE email='agent-peer-01@test.local'),'agent-circle-ai',
   '本周 Agent 论文共读：从工具调用到可恢复执行',
   '每人准备一个失败案例，重点比较观察、计划、动作和恢复策略。最后一起整理成可复用的评测清单。',
   'activity','public','以失败恢复为主题的 Agent 工程共读。',20,11,5,98,87,now()-interval '40 minutes',now()-interval '22 hours',now()-interval '40 minutes'),
  ('agent-post-16',(SELECT id FROM users WHERE email='agent-peer-02@test.local'),'agent-circle-builder',
   '需要一名后端搭子完善校园活动推荐 Demo',
   '前端流程已经可以演示，希望补齐数据模型、检索接口和最小部署配置。目标不是赶功能，而是做出能被测试的完整闭环。',
   'squad','public','校园活动推荐 Demo 招募后端协作者。',17,7,4,91,79,now()-interval '3 hours',now()-interval '2 days',now()-interval '3 hours'),
  ('agent-post-17',(SELECT id FROM users WHERE email='agent-peer-05@test.local'),'agent-circle-sports',
   '羽毛球新手局的分组建议',
   '人数多时怎样轮换既不让新手紧张，也避免等待太久？目前想到按自评水平分两组，每局结束后自由流动。',
   'help','public','讨论新手友好的羽毛球轮换方式。',8,3,3,61,51,now()-interval '5 hours',now()-interval '3 days',now()-interval '5 hours'),
  ('agent-post-18',(SELECT id FROM users WHERE email='agent-peer-06@test.local'),'agent-circle-culture',
   '雨天校园摄影：不拍正脸也能讲故事',
   '准备围绕倒影、伞、走廊和灯光做一次练习。参与者可以只提交三张照片，分享时重点说选择而不是器材。',
   'activity','public','以雨天细节和叙事为主题的摄影练习。',22,13,5,117,85,now()-interval '25 minutes',now()-interval '1 day',now()-interval '25 minutes')
ON CONFLICT (id) DO UPDATE SET
  title=EXCLUDED.title, content=EXCLUDED.content, type=EXCLUDED.type,
  visibility=EXCLUDED.visibility, summary=EXCLUDED.summary,
  like_count=EXCLUDED.like_count, favorite_count=EXCLUDED.favorite_count,
  comment_count=EXCLUDED.comment_count, view_count=EXCLUDED.view_count,
  hot_score=EXCLUDED.hot_score, last_interaction_at=EXCLUDED.last_interaction_at,
  created_at=EXCLUDED.created_at, updated_at=EXCLUDED.updated_at, deleted_at=NULL;

INSERT INTO forum_comments (
  id, post_id, user_id, content, comment_type, parent_comment_id,
  root_comment_id, like_count, created_at, updated_at
) VALUES
  ('agent-comment-01','agent-post-12',(SELECT id FROM users WHERE email='agent-peer-08@test.local'),'第一次建议选白天、公开且方便随时离开的地方，也可以提前告诉朋友大致时间。','text',NULL,NULL,9,now()-interval '12 hours',now()-interval '12 hours'),
  ('agent-comment-02','agent-post-12',(SELECT id FROM users WHERE email='agent-peer-02@test.local'),'我更喜欢先在食堂或咖啡店坐二十分钟，如果聊得来再决定要不要散步。','text',NULL,NULL,7,now()-interval '10 hours',now()-interval '10 hours'),
  ('agent-comment-03','agent-post-12',(SELECT id FROM users WHERE email='agent-peer-04@test.local'),'这个节奏很好，关键是把延长行程作为双方都可以拒绝的新邀请。','text','agent-comment-02','agent-comment-02',5,now()-interval '9 hours',now()-interval '9 hours'),
  ('agent-comment-04','agent-post-10',(SELECT id FROM users WHERE email='agent-peer-09@test.local'),'颐和路一带很适合，但周末人多，建议上午去，路线终点可以放在先锋书店附近。','text',NULL,NULL,6,now()-interval '1 day',now()-interval '1 day'),
  ('agent-comment-05','agent-post-13',(SELECT id FROM users WHERE email='agent-peer-05@test.local'),'我可以参加，建议在帖子里写清集合点和遇雨取消规则。','text',NULL,NULL,4,now()-interval '20 hours',now()-interval '20 hours'),
  ('agent-comment-06','agent-post-15',(SELECT id FROM users WHERE email='agent-peer-03@test.local'),'我带一个工具调用超时后重复执行的案例，正好可以讨论幂等性。','text',NULL,NULL,8,now()-interval '16 hours',now()-interval '16 hours'),
  ('agent-comment-07','agent-post-16',(SELECT id FROM users WHERE email='agent-peer-05@test.local'),'可以先把接口契约和三条验收场景贴出来，这样更容易判断工作量。','text',NULL,NULL,3,now()-interval '1 day',now()-interval '1 day')
ON CONFLICT (id) DO UPDATE SET
  content=EXCLUDED.content, parent_comment_id=EXCLUDED.parent_comment_id,
  root_comment_id=EXCLUDED.root_comment_id, like_count=EXCLUDED.like_count,
  created_at=EXCLUDED.created_at, updated_at=EXCLUDED.updated_at, deleted_at=NULL;

INSERT INTO forum_announcements (id, title, content, created_by, is_active, priority, starts_at, ends_at, created_at)
VALUES (
  'agent-announcement-01',
  '测试社区公约：慢一点，也真诚一点',
  '请尊重拒绝与不回复的权利；首次见面优先选择公开场所；不要在帖子或聊天中公开他人的联系方式。',
  (SELECT id FROM users WHERE email='agent-peer-04@test.local'), true, 10,
  now()-interval '7 days', now()+interval '90 days', now()-interval '7 days'
)
ON CONFLICT (id) DO UPDATE SET
  title=EXCLUDED.title, content=EXCLUDED.content, is_active=true,
  priority=EXCLUDED.priority, starts_at=EXCLUDED.starts_at, ends_at=EXCLUDED.ends_at;

-- ---------------------------------------------------------------------------
-- Circle life: join requests, recruiting teamups and lightweight chat history.
-- The main agent-local user intentionally remains outside all circles.
-- ---------------------------------------------------------------------------

INSERT INTO circle_join_requests (
  id, circle_id, user_id, application_answer, application_answers,
  application_reason, status, reviewed_by, reviewed_at, created_at, updated_at
) VALUES
  ('agent-join-request-01','agent-circle-ai',(SELECT id FROM users WHERE email='agent-peer-02@test.local'),
   '做过一个带工具调用的校园活动推荐原型。','[{"question":"希望在圈内讨论什么？","answer":"Agent 工具调用与产品评测"}]',
   '希望补齐 Agent 评测方法，也愿意分享前端交互经验。','pending_review',NULL,NULL,now()-interval '18 hours',now()-interval '18 hours'),
  ('agent-join-request-02','agent-circle-culture',(SELECT id FROM users WHERE email='agent-peer-04@test.local'),
   '平时负责校园活动内容记录。','[{"question":"最近关注的作品或展览？","answer":"南京城市记忆主题影像"}]',
   '想学习更克制、尊重被拍摄者的校园记录方式。','approved',(SELECT id FROM users WHERE email='agent-peer-06@test.local'),now()-interval '2 days',now()-interval '3 days',now()-interval '2 days')
ON CONFLICT (id) DO UPDATE SET
  application_answer=EXCLUDED.application_answer,
  application_answers=EXCLUDED.application_answers,
  application_reason=EXCLUDED.application_reason, status=EXCLUDED.status,
  reviewed_by=EXCLUDED.reviewed_by, reviewed_at=EXCLUDED.reviewed_at,
  updated_at=EXCLUDED.updated_at;

INSERT INTO teamups (
  id, circle_id, leader_id, title, description, description_preview,
  max_members, current_member_count, deadline_at, end_at, teamup_type,
  join_mode, is_public, status, created_at, updated_at
) VALUES
  ('agent-teamup-01','agent-circle-ai',(SELECT id FROM users WHERE email='agent-peer-01@test.local'),
   'Agent 失败案例评测小组',
   '用两周整理工具调用、检索和人工确认三个环节的失败案例。每人负责两个案例，最终产出一份可复用评测表。',
   '两周共建 Agent 失败案例与评测表。',5,3,now()+interval '5 days',now()+interval '19 days','short_term','approval',true,'recruiting',now()-interval '2 days',now()-interval '3 hours'),
  ('agent-teamup-02','agent-circle-builder',(SELECT id FROM users WHERE email='agent-peer-02@test.local'),
   '校园活动推荐 Demo 冲刺',
   '完成检索接口、三类推荐卡片、Mock 数据和容器化运行说明。每晚同步一次，不要求全天在线。',
   '为校园活动推荐 Demo 补齐端到端闭环。',4,2,now()+interval '3 days',now()+interval '10 days','short_term','direct',true,'recruiting',now()-interval '1 day',now()-interval '2 hours'),
  ('agent-teamup-03','agent-circle-sports',(SELECT id FROM users WHERE email='agent-peer-07@test.local'),
   '四周新手羽毛球固定搭子',
   '每周六下午活动一次，以基础动作、轮换双打和低强度对抗为主，器材可以现场协调。',
   '四周新手友好羽毛球固定活动。',6,2,now()+interval '6 days',now()+interval '34 days','long_term','direct',false,'recruiting',now()-interval '3 days',now()-interval '1 day')
ON CONFLICT (id) DO UPDATE SET
  title=EXCLUDED.title, description=EXCLUDED.description,
  description_preview=EXCLUDED.description_preview,
  max_members=EXCLUDED.max_members, current_member_count=EXCLUDED.current_member_count,
  deadline_at=EXCLUDED.deadline_at, end_at=EXCLUDED.end_at,
  teamup_type=EXCLUDED.teamup_type, join_mode=EXCLUDED.join_mode,
  is_public=EXCLUDED.is_public, status=EXCLUDED.status, updated_at=EXCLUDED.updated_at;

INSERT INTO teamup_members (id, teamup_id, user_id, member_role, membership_status, joined_at, created_at, updated_at)
VALUES
  ('agent-team-member-01','agent-teamup-01',(SELECT id FROM users WHERE email='agent-peer-01@test.local'),'leader','active',now()-interval '2 days',now()-interval '2 days',now()-interval '2 days'),
  ('agent-team-member-02','agent-teamup-01',(SELECT id FROM users WHERE email='agent-peer-03@test.local'),'member','active',now()-interval '36 hours',now()-interval '36 hours',now()-interval '36 hours'),
  ('agent-team-member-03','agent-teamup-01',(SELECT id FROM users WHERE email='agent-peer-05@test.local'),'member','active',now()-interval '1 day',now()-interval '1 day',now()-interval '1 day'),
  ('agent-team-member-04','agent-teamup-02',(SELECT id FROM users WHERE email='agent-peer-02@test.local'),'leader','active',now()-interval '1 day',now()-interval '1 day',now()-interval '1 day'),
  ('agent-team-member-05','agent-teamup-02',(SELECT id FROM users WHERE email='agent-peer-09@test.local'),'member','active',now()-interval '15 hours',now()-interval '15 hours',now()-interval '15 hours'),
  ('agent-team-member-06','agent-teamup-03',(SELECT id FROM users WHERE email='agent-peer-07@test.local'),'leader','active',now()-interval '3 days',now()-interval '3 days',now()-interval '3 days'),
  ('agent-team-member-07','agent-teamup-03',(SELECT id FROM users WHERE email='agent-peer-05@test.local'),'member','active',now()-interval '2 days',now()-interval '2 days',now()-interval '2 days')
ON CONFLICT (teamup_id, user_id) DO UPDATE SET
  member_role=EXCLUDED.member_role, membership_status='active',
  joined_at=EXCLUDED.joined_at, updated_at=EXCLUDED.updated_at;

INSERT INTO circle_chat_messages (id, circle_id, sender_id, client_message_id, content, mentions, created_at, updated_at)
VALUES
  ('agent-circle-chat-01','agent-circle-ai',(SELECT id FROM users WHERE email='agent-peer-01@test.local'),'agent-client-ai-01','这周共读请每人带一个真实失败案例，不需要做长 PPT。','[]',now()-interval '20 hours',now()-interval '20 hours'),
  ('agent-circle-chat-02','agent-circle-ai',(SELECT id FROM users WHERE email='agent-peer-03@test.local'),'agent-client-ai-02','我准备工具超时后的重复执行问题，会附一段最小 Trace。','[]',now()-interval '18 hours',now()-interval '18 hours'),
  ('agent-circle-chat-03','agent-circle-builder',(SELECT id FROM users WHERE email='agent-peer-02@test.local'),'agent-client-builder-01','今晚先冻结接口字段，明天再分别补实现和测试。','[]',now()-interval '8 hours',now()-interval '8 hours'),
  ('agent-circle-chat-04','agent-circle-builder',(SELECT id FROM users WHERE email='agent-peer-04@test.local'),'agent-client-builder-02','我把用户第一次看到推荐卡片时最容易困惑的三处整理出来。','[]',now()-interval '7 hours',now()-interval '7 hours'),
  ('agent-circle-chat-05','agent-circle-sports',(SELECT id FROM users WHERE email='agent-peer-07@test.local'),'agent-client-sports-01','周六如果下雨不受影响，场地在室内，集合点稍后发。','[]',now()-interval '6 hours',now()-interval '6 hours'),
  ('agent-circle-chat-06','agent-circle-culture',(SELECT id FROM users WHERE email='agent-peer-06@test.local'),'agent-client-culture-01','雨天摄影练习不拍清晰正脸，分享时也请注意隐私。','[]',now()-interval '4 hours',now()-interval '4 hours')
ON CONFLICT (circle_id, sender_id, client_message_id) DO UPDATE SET
  content=EXCLUDED.content, mentions=EXCLUDED.mentions,
  status='visible', deleted_at=NULL, created_at=EXCLUDED.created_at,
  updated_at=EXCLUDED.updated_at;

COMMIT;
