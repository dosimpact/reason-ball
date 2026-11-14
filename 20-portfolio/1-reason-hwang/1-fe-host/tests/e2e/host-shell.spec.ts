import { expect, test } from '@playwright/test';

// HOST-SHELL-001: app pages own their headings; shell controls live in the sidebar.
test('host content starts without a duplicate global header', async ({ page }) => {
  test.setTimeout(90_000);
  for (const [path, title] of [
    ['/chat', 'Chat'],
    ['/sec-chat', 'SEC Intelligent UI'],
    ['/sec-api-agent', 'SEC API Agent'],
    ['/open-ui/dynamic', '매출 분석 · Dynamic'],
  ]) {
    await page.goto(path);
    const content = page.locator('[data-slot="sidebar-inset"]');
    await expect(content.locator(':scope > header')).toHaveCount(0);
    await expect(content.getByText('Module federation host shell', { exact: true })).toHaveCount(0);
    await expect(content.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(content.locator('textarea:visible').first()).toBeVisible();
  }
});

test('sidebar retains desktop controls and mobile menu and theme access', async ({ page }) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/chat');
  const footer = page.locator('[data-slot="sidebar-footer"]');
  await expect(footer.getByRole('button', { name: '다크 모드로 전환', exact: true })).toBeVisible();
  await footer.getByRole('button', { name: 'Toggle Sidebar', exact: true }).click();
  await expect(page.locator('[data-slot="sidebar"][data-state="collapsed"]')).toBeVisible();
  await footer.getByRole('button', { name: 'Toggle Sidebar', exact: true }).click();
  await expect(page.locator('[data-slot="sidebar"][data-state="expanded"]')).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('[data-slot="sidebar"][data-state]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Toggle Sidebar', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Sidebar', exact: true });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('link', { name: 'SEC API Agent', exact: true })).toBeVisible();
  await menu.getByRole('button', { name: '다크 모드로 전환', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(menu.getByRole('button', { name: '라이트 모드로 전환', exact: true })).toBeVisible();
  await menu.getByRole('button', { name: 'Toggle Sidebar', exact: true }).click();
  await expect(menu).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Toggle Sidebar', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Chat', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
});
