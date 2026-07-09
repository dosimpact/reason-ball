import { expect, test } from '@playwright/test';

test('renders template remote through the host route', async ({ page }) => {
  await page.goto('/remotes/template');

  await expect(
    page.getByRole('heading', { name: 'Template', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Reusable remote app shell' }),
  ).toBeVisible();
  await expect(page.getByText('Remote failed')).toHaveCount(0);
});

test('renders todo remote through the host route', async ({ page }) => {
  await page.goto('/remotes/todo');

  await expect(
    page.getByRole('heading', { name: 'Todo', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Remote todo list' }),
  ).toBeVisible();
  await expect(
    page.getByText('Expose ./mount from the remote'),
  ).toBeVisible();
  await expect(page.getByText('Remote failed')).toHaveCount(0);
});
