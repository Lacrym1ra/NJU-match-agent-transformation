import { expect, test } from '@playwright/test';

const publicRoutes = [
  '/', '/about', '/changelog', '/privacy', '/agent-demo',
] as const;

const protectedRepresentatives = [
  '/dashboard',
  '/agent',
  '/resonance',
  '/resonance/00000000-0000-4000-8000-000000000001',
  '/meetup-safety',
  '/survey',
  '/settings',
  '/circles',
  '/circles/example-circle/manage',
  '/circles/example-circle/livechat',
  '/forum',
  '/forum/example-post',
  '/notifications',
  '/messages/example-user',
] as const;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
});

test('public pages expose their privacy boundary without authenticated overlays', async ({ page }) => {
  for (const route of publicRoutes) {
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(`${route === '/' ? '/$' : `${route}$`}`));
    await expect(page.getByLabel('当前页面隐私边界')).toBeVisible();
    await expect(page.getByLabel('打开全局 Agent')).toHaveCount(0);
    await expect(page.getByLabel('站内通知')).toHaveCount(0);
  }
});

test('unauthenticated users cannot open personal, community, agent, or privileged user routes', async ({ page }) => {
  for (const route of protectedRepresentatives) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login$/);
  }
});

test('global privacy marker and authenticated overlays do not overlap on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  await page.getByPlaceholder('学号@smail.nju.edu.cn').fill('privacy-browser@smail.nju.edu.cn');
  await page.getByPlaceholder('请输入密码').fill('123456');
  await page.getByRole('checkbox').check();
  await page.locator('form').getByRole('button', { name: '登录' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const privacy = await page.getByLabel('当前页面隐私边界').boundingBox();
  const agent = await page.getByLabel('打开全局 Agent').boundingBox();
  expect(privacy).not.toBeNull();
  expect(agent).not.toBeNull();
  if (privacy && agent) {
    const overlap = !(
      privacy.x + privacy.width <= agent.x
      || agent.x + agent.width <= privacy.x
      || privacy.y + privacy.height <= agent.y
      || agent.y + agent.height <= privacy.y
    );
    expect(overlap).toBe(false);
  }
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(391);
});
