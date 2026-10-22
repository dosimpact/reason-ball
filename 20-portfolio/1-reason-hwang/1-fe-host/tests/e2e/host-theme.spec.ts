import { test, expect } from '@playwright/test';

test('one theme controls the host, OpenUI and catalog across reloads', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/sec-api-agent');
  await page.route('**/api/sec-api-agent', route => route.fulfill({ contentType: 'text/event-stream', body: [
    { type: 'TEXT_MESSAGE_CONTENT', delta: 'root = Col([Title("테마 테스트", "lg"), Card([Text("동일한 테마의 답변")])])' },
    { type: 'RUN_FINISHED' },
  ].map(event => `data: ${JSON.stringify(event)}\n\n`).join('') }));
  await page.getByRole('button', { name: '기업 검색', exact: true }).click();
  await expect(page.getByRole('heading', { name: '테마 테스트' })).toBeVisible();
  await page.getByRole('button', { name: '다크 모드로 전환' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-openui-theme', 'dark');
  const dark = await page.evaluate(() => ({
    host: getComputedStyle(document.body).backgroundColor,
    openui: getComputedStyle(document.body).getPropertyValue('--openui-background'),
    ink: getComputedStyle(document.querySelector('.iui-card')!).getPropertyValue('--iui-ink'),
    hostInk: getComputedStyle(document.documentElement).getPropertyValue('--foreground'),
  }));
  expect(dark.ink).toBe(dark.hostInk);
  await page.reload();
  await expect(page.getByRole('button', { name: '라이트 모드로 전환' })).toBeVisible();
  await page.getByRole('button', { name: '라이트 모드로 전환' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe(dark.host);
  expect(await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--openui-background'))).not.toBe(dark.openui);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.goto('/sec-chat');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: '다크 모드로 전환' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.route('**/api/sec-chat/resolve', route => route.fulfill({ json: { action: 'reply', reply: '일반 채팅 테마 확인' } }));
  await page.getByRole('textbox', { name: '메시지', exact: true }).fill('테마 확인');
  await page.getByRole('button', { name: '메시지 보내기', exact: true }).click();
  await expect(page.getByTestId('intelligent-ui-answer')).toContainText('일반 채팅 테마 확인');
  expect(await page.getByTestId('intelligent-ui-answer').evaluate(element => getComputedStyle(element).getPropertyValue('--iui-ink'))).toBe(dark.hostInk);
});

test('first visit follows system preference', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByRole('button', { name: '라이트 모드로 전환' })).toBeVisible();
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).not.toHaveClass(/dark/);
});
