#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
APP_DIR="${REPO_ROOT}/NJU-Date-basic"
ENV_FILE="${APP_DIR}/.env.codespaces"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-nju-match-codespaces}"
export COMPOSE_PROJECT_NAME

if [[ "${CODESPACES:-}" == "true" ]]; then
  FORWARDING_DOMAIN="${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
  PUBLIC_URL="https://${CODESPACE_NAME}-8082.${FORWARDING_DOMAIN}"
else
  PUBLIC_URL="http://127.0.0.1:8082"
fi

random_secret() {
  openssl rand -hex 32
}

wait_for_docker() {
  local attempt
  for attempt in $(seq 1 60); do
    if docker info >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  echo "Docker did not become ready within 120 seconds." >&2
  return 1
}

write_demo_env() {
  local jwt_secret admin_key contact_key contact_index_key student_id_pepper db_password

  jwt_secret="$(random_secret)"
  admin_key="$(random_secret)"
  contact_key="$(random_secret)"
  contact_index_key="$(random_secret)"
  student_id_pepper="$(random_secret)"
  db_password="$(random_secret)"

  umask 077
  cat >"${ENV_FILE}" <<EOF
# Generated inside this Codespace. Never commit this file.
NODE_ENV=production

JWT_SECRET=${jwt_secret}
ADMIN_KEY=${admin_key}
CONTACT_ENCRYPTION_KEY=${contact_key}
CONTACT_BLIND_INDEX_KEY=${contact_index_key}
HEARTBOX_STUDENT_ID_PEPPER=${student_id_pepper}

POSTGRES_DB=nju_date
POSTGRES_USER=nju_match
POSTGRES_PASSWORD=${db_password}
DB_POOL_MAX=5

FRONTEND_URLS=${PUBLIC_URL},http://127.0.0.1:8082,http://localhost:8082
FRONTEND_PUBLIC_URL=${PUBLIC_URL}
SUPPORT_EMAIL=demo@example.invalid
VITE_SUPPORT_EMAIL=demo@example.invalid
MATCH_BIND_PORT=8082

EMAIL_PROVIDER=aliyun_api
ALIYUN_DM_ACCESS_KEY_ID=
ALIYUN_DM_ACCESS_KEY_SECRET=
ALIYUN_DM_REGION=cn-hangzhou
ALIYUN_DM_ACCOUNT_NAME=
ALIYUN_DM_FROM_ALIAS=NJU Match Demo

DASHSCOPE_API_KEY=
QWEN_MODEL=qwen-plus
LLM_API_KEY=${LLM_API_KEY:-}
LLM_BASE_URL=${LLM_BASE_URL:-https://api.openai.com/v1}
LLM_MODEL=${LLM_MODEL:-gpt-5.6-terra}
AGENT_MAX_STEPS=10
AGENT_TOOL_TIMEOUT_MS=10000
AGENT_DUPLICATE_ACTION_LIMIT=2
AGENT_MEMORY_ENTRIES=24
EOF
  chmod 600 "${ENV_FILE}"
}

wait_for_health() {
  local attempt
  for attempt in $(seq 1 90); do
    if curl --fail --silent --show-error --max-time 5 \
      http://127.0.0.1:8082/health >/dev/null; then
      return 0
    fi
    sleep 2
  done

  echo "NJU Match did not become healthy within 180 seconds." >&2
  docker compose --env-file "${ENV_FILE}" ps >&2 || true
  docker compose --env-file "${ENV_FILE}" logs --tail 120 >&2 || true
  return 1
}

read_total_users() {
  curl --fail --silent --show-error --max-time 5 \
    http://127.0.0.1:8082/api/v1/stats \
    | python3 -c '
import json
import sys

payload = json.load(sys.stdin)
sys.stdout.write(str(payload.get("totalUsers", 0)))
'
}

seed_demo_data() {
  local total_users
  total_users="$(read_total_users)"

  if [[ "${total_users}" == "0" ]]; then
    echo "Seeding isolated Codespaces demo data..."
    docker exec nju-date-backend node dist/db/seedDemoData.js
  else
    echo "Demo database already contains ${total_users} users; skipping the base seed."
  fi

  docker exec nju-date-backend node dist/db/seedCircles.js
  docker exec nju-date-backend node dist/db/seedProjectBModules.js
}

normalize_demo_account_state() {
  docker exec -i nju-date-postgres \
    psql --set ON_ERROR_STOP=1 --username nju_match --dbname nju_date <<'SQL'
UPDATE users
SET gender_pref = 'any',
    intention = 'friend',
    profile_complete = true,
    survey_complete = true,
    is_participating = true,
    updated_at = NOW()
WHERE email IN (
  'alice@smail.nju.edu.cn',
  'bob@smail.nju.edu.cn',
  'admin@nju.date'
);

INSERT INTO survey_answers (
  id,
  user_id,
  answers,
  version,
  submitted_at,
  updated_at
)
SELECT
  'codespaces-survey-' || id,
  id,
  '{}',
  '4.0',
  NOW(),
  NOW()
FROM users
WHERE email IN (
  'alice@smail.nju.edu.cn',
  'bob@smail.nju.edu.cn',
  'admin@nju.date'
)
ON CONFLICT (user_id) DO UPDATE
SET version = EXCLUDED.version,
    updated_at = NOW();

INSERT INTO circles (
  id,
  name,
  slug,
  description,
  category,
  tag,
  tags,
  join_policy,
  creator_id,
  member_count,
  is_active,
  status
)
SELECT
  'agent-circle-ai',
  'AI 与 Agent 学习圈',
  'agent-circle-ai',
  '围绕 Agent、LLM 应用、工具调用与 AI 工程实践进行长期交流。',
  'academic',
  'AI',
  '["AI", "Agent", "LLM", "学习搭子"]'::jsonb,
  'public',
  id,
  1,
  true,
  'active'
FROM users
WHERE email = 'alice@smail.nju.edu.cn'
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    tags = EXCLUDED.tags,
    is_active = true,
    status = 'active',
    updated_at = NOW();

INSERT INTO circle_members (
  id,
  circle_id,
  user_id,
  membership_status,
  answers,
  answers_complete,
  is_active,
  joined_at,
  updated_at
)
SELECT
  'codespaces-member-alice-ai',
  'agent-circle-ai',
  id,
  'active',
  '{}',
  true,
  true,
  NOW(),
  NOW()
FROM users
WHERE email = 'alice@smail.nju.edu.cn'
ON CONFLICT (circle_id, user_id) DO UPDATE
SET membership_status = 'active',
    is_active = true,
    updated_at = NOW();

UPDATE circles
SET member_count = (
  SELECT COUNT(*)::int
  FROM circle_members
  WHERE circle_id = circles.id
    AND membership_status = 'active'
    AND is_active = true
)
WHERE id = 'agent-circle-ai';

INSERT INTO forum_posts (
  id,
  user_id,
  circle_id,
  title,
  content,
  type,
  visibility,
  summary,
  like_count,
  comment_count,
  view_count,
  hot_score,
  last_interaction_at,
  created_at,
  updated_at
)
SELECT
  'agent-post-12',
  id,
  'agent-circle-ai',
  'Agent 工具调用共读与实践招募',
  '本周一起拆解工具调用、确认边界与可验证执行。欢迎带着自己的 Agent 场景来交流。',
  'activity',
  'public',
  '面向 Agent 与 LLM 应用实践的长期学习搭子招募。',
  8,
  3,
  64,
  16,
  NOW(),
  NOW(),
  NOW()
FROM users
WHERE email = 'alice@smail.nju.edu.cn'
ON CONFLICT (id) DO UPDATE
SET circle_id = EXCLUDED.circle_id,
    title = EXCLUDED.title,
    content = EXCLUDED.content,
    summary = EXCLUDED.summary,
    updated_at = NOW();

INSERT INTO matches (
  id,
  week_of,
  user_a_id,
  user_b_id,
  score,
  dimensions,
  curator_note,
  user_a_action,
  user_b_action,
  status,
  revealed_at,
  source,
  score_visible,
  created_at
)
SELECT
  'codespaces-match-alice-bob',
  TO_CHAR(
    CASE
      WHEN EXTRACT(ISODOW FROM CURRENT_DATE)::int <= 3
        THEN CURRENT_DATE + (3 - EXTRACT(ISODOW FROM CURRENT_DATE)::int)
      ELSE CURRENT_DATE + (10 - EXTRACT(ISODOW FROM CURRENT_DATE)::int)
    END,
    'YYYY-MM-DD'
  ),
  alice.id,
  bob.id,
  0.87,
  '{"interests":0.91,"values":0.84,"lifestyle":0.82}'::text,
  '你们都重视稳定交流，也愿意通过共同活动逐步熟悉彼此。',
  'ACCEPT',
  'ACCEPT',
  'MUTUAL',
  NOW(),
  'weekly',
  true,
  NOW()
FROM users AS alice
CROSS JOIN users AS bob
WHERE alice.email = 'alice@smail.nju.edu.cn'
  AND bob.email = 'bob@smail.nju.edu.cn'
ON CONFLICT (id) DO UPDATE
SET score = EXCLUDED.score,
    dimensions = EXCLUDED.dimensions,
    curator_note = EXCLUDED.curator_note,
    user_a_action = EXCLUDED.user_a_action,
    user_b_action = EXCLUDED.user_b_action,
    status = EXCLUDED.status,
    revealed_at = EXCLUDED.revealed_at;
SQL
}

echo "Preparing NJU Match Codespaces demo at ${PUBLIC_URL}"
wait_for_docker

if [[ ! -s "${ENV_FILE}" ]]; then
  write_demo_env
else
  chmod 600 "${ENV_FILE}"
  echo "Reusing the existing ignored Codespaces environment file."
fi

cd "${APP_DIR}"
docker compose --env-file "${ENV_FILE}" up -d --build
wait_for_health
seed_demo_data
normalize_demo_account_state

echo
echo "NJU Match Codespaces demo is healthy."
echo "Public URL: ${PUBLIC_URL}"
echo "Health URL: ${PUBLIC_URL}/health"
echo "If the URL is private, set port 8082 visibility to Public in the PORTS panel."
