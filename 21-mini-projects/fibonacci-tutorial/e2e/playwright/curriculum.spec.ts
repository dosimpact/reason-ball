import { test, expect } from '@playwright/test';

test('home and tutorial index expose all ten chapters and forty-four units, with chapter navigation', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('파동을 읽는 과정');
  const catalog = await (await page.request.get('/api/catalog')).json();
  expect(catalog.chapters).toHaveLength(10);
  const units = catalog.chapters.flatMap((chapter: { units: { id: string }[] }) => chapter.units);
  expect(units).toHaveLength(44);
  await expect(page.locator('.curriculum-chapter')).toHaveCount(10);
  await expect(page.locator('.curriculum-unit')).toHaveCount(44);
  const last = catalog.chapters.at(-1);
  await page.locator('.curriculum-chapter h3').getByRole('link', { name: last.title, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/tutorials/chapters/${last.id}$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(last.title);
  await expect(page.locator('.curriculum-unit')).toHaveCount(5);
  await page.getByRole('link', { name: 'Fibonacci Lab 메인으로 이동', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/tutorials');
  await expect(page.locator('.curriculum-unit')).toHaveCount(44);
  expect(errors).toEqual([]);
});

test('curriculum mobile page remains navigable without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tutorials');
  await expect(page.locator('.curriculum-unit')).toHaveCount(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.curriculum-unit').last().click();
  await expect(page).toHaveURL(/\/tutorials\/ew-final-portfolio/);
  await expect(page.locator('main')).toContainText('최종 분석 포트폴리오');
});

test('new five-step theory quiz requires two correct answers and permits Prev review', async ({ page }) => {
  await page.goto('/tutorials/ew-fib-anchors');
  await expect(page.getByRole('button', { name: 'Prev', exact: true })).toBeDisabled();
  for (let step = 0; step < 4; step++) {
    const response = page.waitForResponse(r => r.url().endsWith('/advance'));
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    expect((await response).status()).toBe(200);
  }
  await expect(page.getByRole('radio')).toHaveCount(9);
  for (const name of ['107.64', 'E-r(E-S)로 방향 부호를 보존한다', '관행적으로 사용하는 중간값이며 후보 수준이다']) {
    await page.getByRole('radio', { name, exact: true }).check();
  }
  const submitted = page.waitForResponse(r => r.url().endsWith('/lesson/check'));
  await page.getByRole('button', { name: '답안 제출', exact: true }).click();
  expect((await (await submitted).json()).complete).toBe(true);
  const previous = page.waitForResponse(r => r.url().endsWith('/advance'));
  await page.getByRole('button', { name: 'Prev', exact: true }).click();
  const review = await (await previous).json();
  expect(review.theoryStep).toBe(3);
  expect(review.visibleCandles).toHaveLength(48);
  await page.reload();
  await expect(page.getByText('이론 단계 4 / 5', { exact: true })).toBeVisible();
});

test('all 44 unit routes render their own task without missing-content or browser errors', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const catalog = await (await page.request.get('/api/catalog')).json();
  const units = catalog.chapters.flatMap((chapter: { units: { id: string; title: string }[] }) => chapter.units);
  for (const unit of units) {
    const created = await page.request.post('/api/sessions', { data: { unitId: unit.id } });
    expect(created.status(), unit.id).toBe(201);
    const session = await created.json();
    await page.goto(`/tutorials/${unit.id}?session=${session.id}`);
    await expect(page.getByRole('heading', { level: 1 }), unit.id).toContainText(unit.title);
    await expect(page.locator('.chart-canvas'), unit.id).toBeVisible();
    await expect(page.locator('.notice.error, .form-error[role=alert]')).toHaveCount(0);
    if (unit.id.startsWith('ew-')) {
      expect(session.learning, unit.id).not.toBeNull();
      expect(JSON.stringify(session), unit.id).not.toContain('correctAnswers');
      expect(JSON.stringify(session), unit.id).not.toContain('acceptableAlternates');
      expect(session.learning.currentCase?.expected, unit.id).toBeUndefined();
    }
  }
  expect(errors).toEqual([]);
});
