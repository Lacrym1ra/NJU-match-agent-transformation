import { expect, test } from '@playwright/test';
import {
  INIT_SQL_CIRCLES,
  INIT_SQL_USERS,
  apiAs,
  buildRunMarker,
  cleanupGeneratedIntegrationData,
  closeIntegrationDb,
  ensureInitSqlIntegrationFixture,
  futureDeadlineInput,
  futureEndInput,
  loginAs,
  prepareSeedPeerAsNonFriends,
  restoreInitSqlRelationshipFixture,
} from './g2-integration-db';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await ensureInitSqlIntegrationFixture();
});

test.beforeEach(async () => {
  await cleanupGeneratedIntegrationData();
  await restoreInitSqlRelationshipFixture();
});

test.afterEach(async () => {
  await cleanupGeneratedIntegrationData();
  await restoreInitSqlRelationshipFixture();
});

test.afterAll(async () => {
  await closeIntegrationDb();
});

test('circle discovery uses init.sql data and gates unauthenticated access', async ({ page, request }) => {
  await page.goto('/circles');
  await expect(page).toHaveURL(/\/login/);

  await loginAs(page, request, INIT_SQL_USERS.seed);
  await page.goto('/circles');

  await expect(page.getByRole('heading', { name: '破冰频道' })).toBeVisible();
  await expect(page.getByText(INIT_SQL_CIRCLES.joined.name)).toBeVisible();
  await expect(page.getByText('我发出的入圈申请')).toBeVisible();
  await expect(page.getByText(INIT_SQL_CIRCLES.review.name)).toBeVisible();

  await page.getByPlaceholder('按圈子名、描述、分类或标签搜索').fill(INIT_SQL_CIRCLES.review.name);
  const pendingJoinPanel = page
    .locator('section')
    .filter({ hasText: '我发出的入圈申请' })
    .filter({ hasText: INIT_SQL_CIRCLES.review.name });
  await expect(pendingJoinPanel).toBeVisible();
  await expect(pendingJoinPanel.getByRole('button', { name: '撤回' })).toBeVisible();

  const sent = await apiAs<{ requests: Array<{ circleId: string; status: string }> }>(
    request,
    INIT_SQL_USERS.seed,
    '/circles/join-requests/sent?limit=20',
  );
  expect(sent.requests).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        circleId: INIT_SQL_CIRCLES.review.id,
        status: 'pending_review',
      }),
    ]),
  );
});

test('card, friend request, and contact unlock run against the real database', async ({ page, request }) => {
  const marker = buildRunMarker();
  await prepareSeedPeerAsNonFriends();

  await loginAs(page, request, INIT_SQL_USERS.seed);
  await page.goto(`/circles/${INIT_SQL_CIRCLES.joined.id}`);
  await expect(page.getByRole('heading', { name: INIT_SQL_CIRCLES.joined.name })).toBeVisible();

  await page.getByText(INIT_SQL_USERS.peer.nickname).first().click();
  await expect(page.getByText(INIT_SQL_USERS.peer.nickname).last()).toBeVisible();
  await page.getByRole('button', { name: '递交交际申请' }).click();
  await page.getByPlaceholder('写下你的破冰寄语...').fill(`${marker} 希望约一场固定双打`);
  await page.getByRole('button', { name: '递交' }).click();
  await expect(page.getByRole('button', { name: '请等待回音...' })).toBeVisible();

  await loginAs(page, request, INIT_SQL_USERS.peer);
  await page.goto('/settings?tab=friends');
  await expect(page.getByText('收到的好友申请')).toBeVisible();
  const requestRow = page
    .locator('li')
    .filter({ hasText: INIT_SQL_USERS.seed.nickname })
    .filter({ hasText: marker })
    .first();
  await expect(requestRow).toBeVisible();
  await requestRow.getByRole('button', { name: '同意' }).click();
  await expect.poll(async () => {
    const grouped = await apiAs<{ friends: Array<{ userId: string }> }>(
      request,
      INIT_SQL_USERS.peer,
      '/friends/grouped',
    );
    return grouped.friends.some((friend) => friend.userId === INIT_SQL_USERS.seed.id);
  }).toBe(true);

  await loginAs(page, request, INIT_SQL_USERS.seed);
  await page.goto(`/circles/${INIT_SQL_CIRCLES.joined.id}`);
  await page.getByText(INIT_SQL_USERS.peer.nickname).first().click();
  await expect(page.getByRole('button', { name: '求取联络印记' })).toBeVisible();
  await page.getByRole('button', { name: '求取联络印记' }).click({ force: true });
  await expect(page.getByRole('button', { name: '信函已递，静候回音' })).toBeVisible();

  const inbox = await apiAs<{
    requests: Array<{ requestId: string; requester: { userId: string }; circleId?: string | null }>;
  }>(request, INIT_SQL_USERS.peer, '/contacts/unlock-requests');
  const contactRequest = inbox.requests.find((item) => (
    item.requester.userId === INIT_SQL_USERS.seed.id && item.circleId === INIT_SQL_CIRCLES.joined.id
  ));
  expect(contactRequest).toBeTruthy();

  const contacts = await apiAs<{ contacts: Array<{ id: string; fieldKey: string }> }>(
    request,
    INIT_SQL_USERS.peer,
    `/contacts/circles/${INIT_SQL_CIRCLES.joined.id}/settings`,
  );
  const primaryContact = contacts.contacts.find((contact) => contact.fieldKey === 'contact_primary');
  expect(primaryContact).toBeTruthy();

  await apiAs(request, INIT_SQL_USERS.peer, `/contacts/unlock-requests/${contactRequest!.requestId}`, {
    method: 'PUT',
    data: {
      action: 'approve',
      contactIds: [primaryContact!.id],
    },
  });

  await page.goto(`/circles/${INIT_SQL_CIRCLES.joined.id}`);
  await page.getByText(INIT_SQL_USERS.peer.nickname).first().click();
  await expect(page.getByRole('button', { name: '展阅同窗私录' })).toBeVisible();
  await page.getByRole('button', { name: '展阅同窗私录' }).click({ force: true });
  await expect(page.getByText('circle_peer_01')).toBeVisible();
});

test('teamup and LiveChat flows use the real backend', async ({ page, request }) => {
  const marker = buildRunMarker();
  const title = `${marker.slice(0, 24)}-双打`;
  const normalMessage = `${marker} 今晚八点在球馆集合`;

  await loginAs(page, request, INIT_SQL_USERS.seed);
  await page.goto(`/circles/${INIT_SQL_CIRCLES.joined.id}/teamups`);
  await page.getByRole('button', { name: '发起邀约' }).click();

  await page.getByPlaceholder('例如：周末玄武湖寻秋摄影').fill(title);
  await page.getByPlaceholder(/详细说明你们的行程/).fill(`${marker} 前端集成测试创建的组队邀约`);
  await page.locator('input[type="number"]').fill('4');
  await page.locator('select').nth(1).selectOption('short_term');
  await page.locator('input[type="datetime-local"]').nth(0).fill(futureDeadlineInput());
  await page.locator('input[type="datetime-local"]').nth(1).fill(futureEndInput());
  await page.getByPlaceholder('微信号').fill(`${marker}-seed-wx`);
  await page.getByRole('button', { name: '盖印发布' }).click();
  await expect(page.getByText(title)).toBeVisible();

  const created = await apiAs<{ teamups: Array<{ id: string; title: string }> }>(
    request,
    INIT_SQL_USERS.seed,
    `/circles/${INIT_SQL_CIRCLES.joined.id}/teamups?keyword=${encodeURIComponent(title)}`,
  );
  const teamup = created.teamups.find((item) => item.title === title);
  expect(teamup).toBeTruthy();

  await loginAs(page, request, INIT_SQL_USERS.peer);
  await page.goto(`/circles/${INIT_SQL_CIRCLES.joined.id}/teamups/${teamup!.id}`);
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await page.getByRole('button', { name: '立即入列' }).click();
  await page.getByPlaceholder('微信号').fill(`${marker}-peer-wx`);
  await page.getByRole('button', { name: '确认入列' }).click();
  await expect(page.getByRole('button', { name: '退出队伍' })).toBeVisible();
  await expect(page.getByText('同游茶话')).toBeVisible();

  await loginAs(page, request, INIT_SQL_USERS.seed);
  await page.goto(`/circles/${INIT_SQL_CIRCLES.joined.id}/livechat`);
  const chatBox = page.getByPlaceholder('写下圈内消息，Enter 发送，Shift+Enter 换行');
  await chatBox.fill(normalMessage);
  await page.getByTitle('发送').click();
  await expect(page.getByText(normalMessage)).toBeVisible();

  await chatBox.fill(`${marker} 微信 wx_forbidden_123`);
  await page.getByTitle('发送').click();
  await expect(
    page.getByText(/发送失败|群聊中不要直接填写手机号、微信、邮箱等联系方式/).first(),
  ).toBeVisible();
});
