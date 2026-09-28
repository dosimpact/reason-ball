import { test, expect, type Page } from '@playwright/test';

const candle = (page: Page, n: number) => page.getByRole('button', { name: new RegExp(`^${n}번째 캔들,`) });

async function openPractice(page: Page) {
  await page.goto('/tutorials/wave-three');
  await expect(page.getByText('8 / 12', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '4. Wave 3 매매 연습' })).toHaveAttribute('aria-current', 'page');
}

test('chart selection → immutable plan → server replay → outcome → reload', async ({ page, request }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await openPractice(page);
  const sessionId = new URL(page.url()).searchParams.get('session');
  const sessionPath = `/api/sessions/${sessionId}`;
  const initial = await (await request.get(sessionPath)).json();
  expect(initial.visibleCandles).toHaveLength(8);
  expect(initial).not.toHaveProperty('snapshot');
  expect(initial).not.toHaveProperty('planSnapshots');
  expect(initial.exampleIndices).toBeNull();
  await expect(page.getByRole('group', { name: '공개된 캔들 선택' }).getByRole('button')).toHaveCount(8);
  await expect(page.getByRole('button', { name: 'Next Candle' })).toBeDisabled();

  // The first chart pane has ten logical slots: eight candles plus two right-offset slots.
  const chart = page.getByRole('img', { name: /공개된 가격/ });
  await expect(chart.locator('canvas').first()).toBeVisible();
  const pane = await chart.locator('canvas').first().boundingBox();
  await chart.click({ position: { x: pane!.width / 20, y: 200 } });
  await expect(candle(page, 1)).toHaveAccessibleName(/0파 선택됨/);
  await candle(page, 4).focus();
  await page.keyboard.press('Enter');
  await candle(page, 7).click();
  await expect(page.getByRole('button', { name: '계획 확정하기', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '계획 확정하기', exact: true }).click();
  await expect(page.getByText('확정됨', { exact: true })).toBeVisible();
  await expect(page.getByText('50.0%', { exact: true })).toBeVisible();
  const confirmed = await (await request.get(sessionPath)).json();
  expect(confirmed.plan.fibonacci.extension1618).toBe(142.36);
  expect(confirmed.plan.wavePoints.map((point: {candleIndex: number}) => point.candleIndex)).toEqual([0, 3, 6]);
  await expect(page.getByRole('spinbutton')).toHaveCount(0);
  for (let count = 9; count <= 12; count++) {
    const response = page.waitForResponse(res => res.url().endsWith('/replay') && res.request().method() === 'POST');
    await page.getByRole('button', { name: 'Next Candle' }).click();
    const body = await (await response).json();
    expect(body.visibleCandles).toHaveLength(count);
    expect(body.cursor).toBe(count - 1);
    expect(body.plan).toEqual(confirmed.plan);
    await expect(page.getByText(`${count} / 12`, { exact: true })).toBeVisible();
  }
  await expect(page.getByText('목표가 도달', { exact: true })).toBeVisible();
  await expect(page.locator('.evaluation-body').getByText('+1.89R', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next Candle' })).toBeDisabled();
  const before = await (await request.get(sessionPath)).json();
  await page.reload();
  await expect(page.getByText('12 / 12', { exact: true })).toBeVisible();
  await expect(page.getByText('목표가 도달', { exact: true })).toBeVisible();
  expect(await (await request.get(sessionPath)).json()).toEqual(before);
  expect(errors).toEqual([]);
  await page.screenshot({ path: test.info().outputPath('completed-practice.png'), fullPage: true });
});

test('invalid prices show feedback and a fresh practice resets the draft', async ({ page }) => {
  await openPractice(page);
  for (const n of [1, 4, 7]) await candle(page, n).click();
  await page.getByRole('spinbutton', { name: '손절가 USD' }).fill('150');
  await page.getByRole('button', { name: '계획 확정하기', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: '손절가 < 진입가 < 목표가' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next Candle' })).toBeDisabled();
  await page.getByRole('button', { name: '새 연습 시작' }).click();
  await expect(page.getByRole('spinbutton', { name: '손절가 USD' })).toHaveValue('99');
  await expect(page.getByRole('button', { name: '계획 확정하기', exact: true })).toBeDisabled();
});

test('mobile layout has no horizontal overflow and preserves usable controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPractice(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const n of [1, 4, 7]) await candle(page, n).click();
  await page.getByRole('button', { name: '계획 확정하기', exact: true }).click();
  await expect(page.getByText('확정됨', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next Candle' }).click();
  await expect(page.getByText('9 / 12', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
