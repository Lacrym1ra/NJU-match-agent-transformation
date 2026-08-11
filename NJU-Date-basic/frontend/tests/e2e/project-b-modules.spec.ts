import { expect, test, type Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder('学号@smail.nju.edu.cn').fill('project-b@smail.nju.edu.cn');
  await page.getByPlaceholder('请输入密码').fill('123456');
  await page.getByRole('checkbox').check();
  await page.locator('form').getByRole('button', { name: '登录' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

function localDateTime(hoursFromNow: number) {
  const value = new Date(Date.now() + hoursFromNow * 3_600_000);
  const shifted = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await login(page);
});

test('new resonance capsule has a standalone create and sealed-detail flow', async ({ page }) => {
  await page.goto('/resonance');
  await expect(page.getByRole('heading', { name: /把答案暂时封存/ })).toBeVisible();
  await page.getByLabel('胶囊标题').fill('一次真实的慢对话');
  await page.getByLabel('留给彼此的问题').fill('最近哪件小事让你觉得被理解？');
  await page.getByRole('button', { name: '生成一次性邀请码' }).click();

  await expect(page.getByText('MOCK2345')).toBeVisible();
  await expect(page.getByRole('heading', { name: '一次真实的慢对话' })).toBeVisible();
  await page.getByRole('link', { name: '打开胶囊 →' }).click();
  await expect(page.getByText('正在等待另一人加入')).toBeVisible();
  await expect(page.getByText('这段内容会在双方都提交后才同时出现。')).not.toBeVisible();
});

test('new meetup safety flow requires manual check-in before completion', async ({ page }) => {
  await page.goto('/meetup-safety');
  await expect(page.getByRole('heading', { name: /出发前留下一份计划/ })).toBeVisible();
  await page.getByLabel('计划标题').fill('先锋书店见面');
  await page.getByLabel('约定的公共地点').fill('广州路先锋书店');
  await page.getByLabel('见面时间').fill(localDateTime(2));
  await page.getByLabel('预计结束').fill(localDateTime(4));
  await page.getByRole('button', { name: '保存私有计划' }).click();

  await expect(page.getByRole('heading', { name: '先锋书店见面' })).toBeVisible();
  await expect(page.getByText('等待本人签到')).toBeVisible();
  await page.getByRole('button', { name: '我已抵达' }).click();
  await expect(page.getByText('已经抵达')).toBeVisible();
  await page.getByRole('button', { name: '平安结束' }).click();
  await expect(page.getByText('平安结束')).toBeVisible();
});

test('new modules remain usable at a mobile viewport without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/resonance');
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth }));
  expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport + 1);
  await expect(page.getByRole('button', { name: '生成一次性邀请码' })).toBeVisible();
});
