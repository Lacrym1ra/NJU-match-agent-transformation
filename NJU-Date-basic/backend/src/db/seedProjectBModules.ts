/**
 * Seeds deterministic demo records for the two Project B modules.
 *
 * Prerequisite: run seedDemoData.ts first so Alice and Bob exist.
 * This script never runs during application startup and only touches the
 * explicit UUID allowlist exported by projectBDemoFixtures.ts.
 */
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { queryClient } from './connection.js';
import {
  buildProjectBDemoFixtures,
  PROJECT_B_DEMO_RECORD_IDS,
  type DemoUserEmail,
} from './projectBDemoFixtures.js';

const DEMO_EMAILS: DemoUserEmail[] = [
  'alice@smail.nju.edu.cn',
  'bob@smail.nju.edu.cn',
];

function hashInviteCode(code: string) {
  return createHash('sha256').update(code, 'utf8').digest('hex');
}

async function loadDemoUsers() {
  const rows = await queryClient<{ id: string; email: DemoUserEmail }[]>`
    SELECT id, email
    FROM users
    WHERE email = ANY(${DEMO_EMAILS})
  `;
  const ids = new Map(rows.map((row) => [row.email, row.id]));
  const missing = DEMO_EMAILS.filter((email) => !ids.has(email));
  if (missing.length > 0) {
    throw new Error(
      `缺少演示账号：${missing.join(', ')}。请先运行 npm run seed:forum-demo -- --reset。`,
    );
  }
  return ids;
}

async function resetProjectBDemoRows() {
  await queryClient`DELETE FROM resonance_capsules WHERE id = ANY(${PROJECT_B_DEMO_RECORD_IDS})`;
  await queryClient`DELETE FROM meetup_safety_plans WHERE id = ANY(${PROJECT_B_DEMO_RECORD_IDS})`;
}

async function main() {
  const shouldReset = process.argv.includes('--reset') || process.argv.includes('-r');
  const userIds = await loadDemoUsers();
  const fixtures = buildProjectBDemoFixtures();

  if (shouldReset) await resetProjectBDemoRows();

  for (const capsule of fixtures.capsules) {
    const creatorId = userIds.get(capsule.creatorEmail)!;
    const participantId = capsule.participantEmail
      ? userIds.get(capsule.participantEmail)!
      : null;
    await queryClient`
      INSERT INTO resonance_capsules (
        id, creator_id, participant_id, invite_code_hash, title, prompt,
        creator_response, participant_response, status, expires_at,
        revealed_at, created_at, updated_at
      ) VALUES (
        ${capsule.id}, ${creatorId}, ${participantId}, ${hashInviteCode(capsule.inviteCode)},
        ${capsule.title}, ${capsule.prompt}, ${capsule.creatorResponse},
        ${capsule.participantResponse}, ${capsule.status}, ${capsule.expiresAt},
        ${capsule.revealedAt}, ${capsule.createdAt}, ${capsule.updatedAt}
      )
      ON CONFLICT (id) DO UPDATE SET
        creator_id = EXCLUDED.creator_id,
        participant_id = EXCLUDED.participant_id,
        invite_code_hash = EXCLUDED.invite_code_hash,
        title = EXCLUDED.title,
        prompt = EXCLUDED.prompt,
        creator_response = EXCLUDED.creator_response,
        participant_response = EXCLUDED.participant_response,
        status = EXCLUDED.status,
        expires_at = EXCLUDED.expires_at,
        revealed_at = EXCLUDED.revealed_at,
        updated_at = EXCLUDED.updated_at
    `;
  }

  for (const plan of fixtures.meetups) {
    const userId = userIds.get(plan.userEmail)!;
    await queryClient`
      INSERT INTO meetup_safety_plans (
        id, user_id, title, meeting_place, meeting_at, expected_end_at,
        note, status, checked_in_at, completed_at, cancelled_at,
        created_at, updated_at
      ) VALUES (
        ${plan.id}, ${userId}, ${plan.title}, ${plan.meetingPlace},
        ${plan.meetingAt}, ${plan.expectedEndAt}, ${plan.note},
        ${plan.storedStatus}, ${plan.checkedInAt}, ${plan.completedAt},
        ${plan.cancelledAt}, ${plan.createdAt}, ${plan.updatedAt}
      )
      ON CONFLICT (id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        title = EXCLUDED.title,
        meeting_place = EXCLUDED.meeting_place,
        meeting_at = EXCLUDED.meeting_at,
        expected_end_at = EXCLUDED.expected_end_at,
        note = EXCLUDED.note,
        status = EXCLUDED.status,
        checked_in_at = EXCLUDED.checked_in_at,
        completed_at = EXCLUDED.completed_at,
        cancelled_at = EXCLUDED.cancelled_at,
        updated_at = EXCLUDED.updated_at
    `;
  }

  console.log(`已写入 ${fixtures.capsules.length} 个共鸣胶囊样例。`);
  console.log(`已写入 ${fixtures.meetups.length} 个安心赴约样例。`);
  console.log('Bob 可使用邀请码 RSN2A7BC 加入 Alice 的“待加入”胶囊；该邀请码仅用于本地测试。');
}

main()
  .catch((error) => {
    console.error('Project B 演示数据导入失败：', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await queryClient.end();
  });
