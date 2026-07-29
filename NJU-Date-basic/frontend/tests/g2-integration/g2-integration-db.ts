import { type APIRequestContext, type Page } from '@playwright/test';
import { queryClient } from '../../../backend/src/db/connection.ts';

export const INTEGRATION_API_BASE = process.env.INTEGRATION_API_BASE ?? 'http://127.0.0.1:3100/api/v1';
export const INTEGRATION_MARKER = 'p4-g2-integration';

export interface IntegrationUser {
  id: string;
  email: string;
  nickname: string;
}

export const INIT_SQL_USERS = {
  seed: {
    id: '10000000-0000-4000-8000-000000000001',
    email: 'circle.seed@smail.nju.edu.cn',
    nickname: '阿球',
  },
  peer: {
    id: '20000000-0000-4000-8000-000000000002',
    email: 'circle.peer@smail.nju.edu.cn',
    nickname: '北苑杀球王',
  },
} satisfies Record<string, IntegrationUser>;

export const INIT_SQL_CIRCLES = {
  joined: {
    id: '30000000-0000-4000-8000-000000000003',
    name: '羽毛球夜场研究所',
  },
  review: {
    id: '40000000-0000-4000-8000-000000000004',
    name: '午夜观影会',
  },
};

const seedId = INIT_SQL_USERS.seed.id;
const peerId = INIT_SQL_USERS.peer.id;
const joinedCircleId = INIT_SQL_CIRCLES.joined.id;
const reviewCircleId = INIT_SQL_CIRCLES.review.id;
const generatedPattern = `${INTEGRATION_MARKER}%`;

function futureLocalInput(daysAhead: number, hour: number) {
  const date = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  date.setHours(hour, 0, 0, 0);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export const futureDeadlineInput = () => futureLocalInput(1, 20);
export const futureEndInput = () => futureLocalInput(2, 21);

export function buildRunMarker() {
  return `${INTEGRATION_MARKER}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function ensureInitSqlIntegrationFixture() {
  const rows = await queryClient<{ users: string; circles: string }[]>`
    SELECT
      (SELECT COUNT(*)::text FROM users WHERE id IN (${seedId}, ${peerId})) AS users,
      (SELECT COUNT(*)::text FROM circles WHERE id IN (${joinedCircleId}, ${reviewCircleId})) AS circles
  `;
  const row = rows[0];
  if (row?.users !== '2' || row?.circles !== '2') {
    throw new Error('前端集成测试需要先用 init.sql 启动数据库，缺少固定测试账号或固定圈子。');
  }
}

export async function cleanupGeneratedIntegrationData() {
  await queryClient`DELETE FROM teamup_forum_sync_jobs WHERE teamup_id IN (
    SELECT id FROM teamups WHERE title LIKE ${generatedPattern} OR description LIKE ${generatedPattern}
  )`;
  await queryClient`DELETE FROM teamup_chat_read_states WHERE teamup_id IN (
    SELECT id FROM teamups WHERE title LIKE ${generatedPattern} OR description LIKE ${generatedPattern}
  )`;
  await queryClient`DELETE FROM teamup_chat_messages WHERE content LIKE ${generatedPattern}
    OR teamup_id IN (SELECT id FROM teamups WHERE title LIKE ${generatedPattern} OR description LIKE ${generatedPattern})`;
  await queryClient`DELETE FROM teamup_member_contacts WHERE contacts::text LIKE ${`%${INTEGRATION_MARKER}%`}
    OR teamup_id IN (SELECT id FROM teamups WHERE title LIKE ${generatedPattern} OR description LIKE ${generatedPattern})`;
  await queryClient`DELETE FROM teamup_applications WHERE application_note LIKE ${generatedPattern}
    OR contact_payload::text LIKE ${`%${INTEGRATION_MARKER}%`}
    OR teamup_id IN (SELECT id FROM teamups WHERE title LIKE ${generatedPattern} OR description LIKE ${generatedPattern})`;
  await queryClient`DELETE FROM teamup_members WHERE teamup_id IN (
    SELECT id FROM teamups WHERE title LIKE ${generatedPattern} OR description LIKE ${generatedPattern}
  )`;
  await queryClient`DELETE FROM teamups WHERE title LIKE ${generatedPattern} OR description LIKE ${generatedPattern}`;

  await queryClient`DELETE FROM circle_chat_read_states WHERE circle_id = ${joinedCircleId}
    AND user_id IN (${seedId}, ${peerId})`;
  await queryClient`DELETE FROM circle_chat_messages WHERE circle_id = ${joinedCircleId}
    AND content LIKE ${generatedPattern}`;
}

export async function prepareSeedPeerAsNonFriends() {
  await queryClient`DELETE FROM contact_unlock_grants
    WHERE requester_id IN (${seedId}, ${peerId}) AND target_id IN (${seedId}, ${peerId})`;
  await queryClient`DELETE FROM contact_unlock_requests
    WHERE requester_id IN (${seedId}, ${peerId}) AND target_id IN (${seedId}, ${peerId})`;
  await queryClient`DELETE FROM friend_requests
    WHERE sender_id IN (${seedId}, ${peerId}) AND receiver_id IN (${seedId}, ${peerId})`;
  await queryClient`DELETE FROM friendships
    WHERE circle_id = ${joinedCircleId}
      AND user_a_id IN (${seedId}, ${peerId})
      AND user_b_id IN (${seedId}, ${peerId})`;
  await queryClient`DELETE FROM global_friendships
    WHERE user_a_id IN (${seedId}, ${peerId}) AND user_b_id IN (${seedId}, ${peerId})`;
}

export async function restoreInitSqlRelationshipFixture() {
  await prepareSeedPeerAsNonFriends();

  await queryClient`
    INSERT INTO friendships (id, circle_id, user_a_id, user_b_id, created_at)
    VALUES (
      '85300000-0000-4000-8000-000000000001',
      ${joinedCircleId},
      ${seedId},
      ${peerId},
      NOW() - INTERVAL '1 day'
    )
    ON CONFLICT (circle_id, user_a_id, user_b_id) DO UPDATE
    SET created_at = EXCLUDED.created_at
  `;
  await queryClient`
    INSERT INTO global_friendships (id, user_a_id, user_b_id, source_type, created_at)
    VALUES (
      '85400000-0000-4000-8000-000000000001',
      ${seedId},
      ${peerId},
      'circle',
      NOW() - INTERVAL '1 day'
    )
    ON CONFLICT (user_a_id, user_b_id) DO UPDATE
    SET source_type = EXCLUDED.source_type, created_at = EXCLUDED.created_at
  `;
  await queryClient`
    INSERT INTO user_circle_contacts (
      id, user_id, circle_id, field_key, label, value, contact_secret_id,
      is_enabled, display_order, created_at, updated_at
    )
    VALUES (
      '85500000-0000-4000-8000-000000000002',
      ${peerId},
      ${joinedCircleId},
      'contact_primary',
      '微信',
      'circle_peer_01',
      NULL,
      TRUE,
      0,
      NOW() - INTERVAL '1 day',
      NOW() - INTERVAL '1 day'
    )
    ON CONFLICT (user_id, circle_id, field_key) DO UPDATE
    SET label = EXCLUDED.label,
        value = EXCLUDED.value,
        contact_secret_id = EXCLUDED.contact_secret_id,
        is_enabled = EXCLUDED.is_enabled,
        display_order = EXCLUDED.display_order,
        updated_at = NOW()
  `;
  await queryClient`
    INSERT INTO user_circle_contacts (
      id, user_id, circle_id, field_key, label, value, contact_secret_id,
      is_enabled, display_order, created_at, updated_at
    )
    VALUES (
      '85500000-0000-4000-8000-000000000001',
      ${seedId},
      ${joinedCircleId},
      'contact_primary',
      '微信',
      'circle_seed_01',
      NULL,
      TRUE,
      0,
      NOW() - INTERVAL '1 day',
      NOW() - INTERVAL '1 day'
    )
    ON CONFLICT (user_id, circle_id, field_key) DO UPDATE
    SET label = EXCLUDED.label,
        value = EXCLUDED.value,
        contact_secret_id = EXCLUDED.contact_secret_id,
        is_enabled = EXCLUDED.is_enabled,
        display_order = EXCLUDED.display_order,
        updated_at = NOW()
  `;
  await queryClient`
    INSERT INTO contact_unlock_requests (
      id, circle_id, requester_id, target_id, source_type, field_key,
      card_snapshot, message, status, expires_at, revoked_at, created_at, updated_at
    )
    VALUES (
      '85600000-0000-4000-8000-000000000001',
      ${joinedCircleId},
      ${seedId},
      ${peerId},
      'circle',
      'contact_primary',
      '{"previewMode":"friend","nickname":"阿球","avatarUrl":null,"baseModules":[],"circleCards":[]}'::jsonb,
      '周五开局前方便加一下微信确认场地吗？',
      'pending',
      NOW() + INTERVAL '7 days',
      NULL,
      NOW() - INTERVAL '30 minutes',
      NOW() - INTERVAL '30 minutes'
    )
    ON CONFLICT (id) DO UPDATE
    SET message = EXCLUDED.message,
        status = EXCLUDED.status,
        expires_at = EXCLUDED.expires_at,
        revoked_at = EXCLUDED.revoked_at,
        updated_at = NOW()
  `;
}

async function getDevToken(request: APIRequestContext, email: string) {
  const response = await request.post(`${INTEGRATION_API_BASE}/auth/dev-token`, {
    data: { email },
  });
  if (!response.ok()) {
    throw new Error(`dev-token failed: ${response.status()} ${await response.text()}`);
  }
  const body = await response.json();
  return body.token as string;
}

export async function loginAs(page: Page, request: APIRequestContext, user: IntegrationUser) {
  const token = await getDevToken(request, user.email);
  try {
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  } catch {
    // The first test page may still be about:blank, where localStorage is unavailable.
  }
  await page.goto('/login');
  await page.evaluate((authToken) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('nju_date_token', authToken);
  }, token);
  return token;
}

export async function apiAs<T>(
  request: APIRequestContext,
  user: IntegrationUser,
  path: string,
  options: { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; data?: unknown } = {},
): Promise<T> {
  const token = await getDevToken(request, user.email);
  const method = options.method ?? 'GET';
  const response = await request.fetch(`${INTEGRATION_API_BASE}${path}`, {
    method,
    data: options.data,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok()) {
    throw new Error(`${method} ${path} failed: ${response.status()} ${await response.text()}`);
  }
  return await response.json() as T;
}

export async function closeIntegrationDb() {
  await queryClient.end({ timeout: 5 });
}
