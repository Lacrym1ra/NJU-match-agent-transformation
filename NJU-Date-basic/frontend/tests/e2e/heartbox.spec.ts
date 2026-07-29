import { expect, test } from '@playwright/test';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByPlaceholder('学号@smail.nju.edu.cn').fill('nickname@smail.nju.edu.cn');
  await page.getByPlaceholder('请输入密码').fill('123456');
  await page.getByRole('checkbox').check();
  await page.locator('form').getByRole('button', { name: '登录' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function ensureHeartboxInputReady(page: import('@playwright/test').Page) {
  const activeCard = page.getByText('你已经投递了一次心动');
  if (await activeCard.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: '撤回' }).click();
  }
  await expect(page.getByPlaceholder('例如：221250001')).toBeVisible();
}

async function bindStudentId(page: import('@playwright/test').Page, studentId = '221250001') {
  await page.goto('/student-id/bind');
  await page.getByPlaceholder('例如：221250001').fill(studentId);
  await page.getByRole('button', { name: '发送验证码' }).click();
  await page.getByPlaceholder('6 位数字').fill('123456');
  await page.getByRole('button', { name: '确认绑定' }).click();
  await expect(page.getByText('已完成绑定')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    document.cookie = 'mock_register=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  });
});

test('student id bind page reflects canonical mailbox OTP flow', async ({ page }) => {
  await login(page);
  await page.goto('/student-id/bind');
  await expect(page.getByText('学号邮箱注册的账号会自动绑定')).toBeVisible();
  await expect(page.getByText('验证码会发送到你输入学号对应的规范邮箱')).toBeVisible();

  await page.getByPlaceholder('例如：221250001').fill('221250001');
  await page.getByRole('button', { name: '发送验证码' }).click();
  await page.getByPlaceholder('6 位数字').fill('123456');
  await page.getByRole('button', { name: '确认绑定' }).click();

  await expect(page.getByText('已完成绑定')).toBeVisible();
  await expect(page.getByText('****0001')).toBeVisible();
});

test('heartbox saved flow does not reveal target state', async ({ page }) => {
  await login(page);
  await bindStudentId(page, '221250001');
  await page.goto('/heartbox');
  await ensureHeartboxInputReady(page);

  await page.getByPlaceholder('例如：221250001').fill('221250002');
  await page.getByRole('button', { name: '投递心动' }).click();

  await expect(page.getByText('你已经投递了一次心动')).toBeVisible();
  await expect(page.getByText('等待双向心动')).toBeVisible();
});

test('heartbox matched flow redirects to heartbox reveal', async ({ page }) => {
  await login(page);
  await bindStudentId(page, '221250001');
  await page.goto('/heartbox');
  await ensureHeartboxInputReady(page);

  await page.getByPlaceholder('例如：221250001').fill('221250001');
  await page.getByRole('button', { name: '投递心动' }).click();

  await expect(page).toHaveURL(/\/heartbox\/reveal/);
  await expect(page.getByText('双向奔赴')).toBeVisible();
});
