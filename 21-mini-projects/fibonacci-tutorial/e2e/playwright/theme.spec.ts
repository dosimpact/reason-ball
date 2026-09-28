import { test, expect } from '@playwright/test';

test('Primer modes preserve chart selections, persist on reload, and follow navigation', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/tutorials/wave-counting');
  await expect(page.getByRole('button', { name: /^1번째 캔들/ })).toBeVisible();
  await page.getByRole('button', { name: /^1번째 캔들/ }).click();
  const selection = await page.locator('.chart-selection-overlay').innerText();
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await page.getByRole('button', { name: '다크 모드로 전환' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'dark');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(13, 17, 23)');
  await expect(page.locator('.chart-selection-overlay')).toHaveText(selection);
  await expect(page.locator('.chart-canvas canvas').first()).toBeVisible();
  // Canvas background must switch too; DOM-only colors cannot verify a canvas renderer.
  await expect.poll(() => page.locator('.chart-canvas canvas').first().evaluate((node) => {
    const pixel = (node as HTMLCanvasElement).getContext('2d')!.getImageData(5, 5, 1, 1).data;
    return Array.from(pixel).slice(0, 3);
  })).toEqual([13, 17, 23]);
  await page.reload();
  await expect(page.getByRole('button', { name: '라이트 모드로 전환' })).toBeVisible();
  await page.getByRole('link', { name: 'Fibonacci Lab 메인으로 이동' }).click();
  await expect(page.locator('.curriculum-unit')).toHaveCount(44);
  await expect(page.locator('html')).toHaveAttribute('data-color-mode', 'dark');
  await page.getByRole('button', { name: '라이트 모드로 전환' }).click();
  await page.reload();
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  expect(errors).toEqual([]);
});

test('mobile theme control is visible and both modes fit the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const toggle = page.getByRole('button', { name: '다크 모드로 전환' });
  await expect(toggle).toBeInViewport();
  await toggle.click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '라이트 모드로 전환' }).click();
  await expect(page.locator('body')).toHaveCSS('color', 'rgb(31, 35, 40)');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
