import { test, expect, type Page } from '@playwright/test';

const candle = (page: Page, index: number) => page.getByRole('button', { name: new RegExp(`^${index + 1}번째 캔들,`) });
async function select(page: Page, indices: number[]) { for (const index of indices) await candle(page, index).click(); }
async function session(page: Page) {
  const id = new URL(page.url()).searchParams.get('session');
  return (await page.request.get(`/api/sessions/${id}`)).json();
}
async function submit(page: Page, button: string, route: string) {
  const response = page.waitForResponse(res => res.url().endsWith(`/${route}`) && res.request().method() === 'POST');
  await page.getByRole('button', { name: button, exact: true }).click();
  const result = await response;
  expect(result.status()).toBe(200);
  return result.json();
}

test('theory chapters advance independently and restore when navigating back', async ({ page }) => {
  await page.goto('/tutorials/impulse-theory');
  await expect(page.getByText('이론 단계 1 / 4', { exact: true })).toBeVisible();
  await expect(page.getByRole('complementary').locator('.chapter-units').getByRole('link')).toHaveCount(44);
  const first = await session(page);
  expect(first.visibleCandles).toHaveLength(2);
  const next = await submit(page, 'Next', 'advance');
  expect(next.visibleCandles).toHaveLength(5);
  await expect(page.getByRole('heading', { name: next.instruction.title, exact: true })).toBeVisible();
  await page.getByRole('link', { name: '3. Impulse의 3대 규칙', exact: true }).click();
  await expect(page.getByText('이론 단계 1 / 4', { exact: true })).toBeVisible();
  expect((await session(page)).id).not.toBe(first.id);
  await page.getByRole('link', { name: '1. 상승 Impulse 구조', exact: true }).click();
  await expect(page.getByText('이론 단계 2 / 4', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('이론 단계 2 / 4', { exact: true })).toBeVisible();
  for (let i = 0; i < 3; i++) await submit(page, 'Next', 'advance');
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  await expect(page.getByText('완료', { exact: true })).toBeVisible();
});

test('six-point rules fail specifically, hint/example are gated, undo/reset correct the count', async ({ page }) => {
  await page.goto('/tutorials/wave-counting');
  await expect(page.getByRole('button', { name: 'Check Answer' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show Example' })).toBeDisabled();
  await select(page, [0, 2, 4, 5, 8, 10]);
  await expect(page.getByLabel('선택 즉시 규칙 검증').locator('[data-rule="wave-3"]')).toHaveAttribute('data-pass', 'false');
  const failed = await submit(page, 'Check Answer', 'check');
  expect(failed.complete).toBe(false);
  await expect(page.locator('.feedback-item.fail')).toContainText('wave-3');
  await submit(page, 'Show Hint', 'hint');
  await expect(page.getByText('힌트:', { exact: true })).toBeVisible();
  await submit(page, 'Show Example', 'hint');
  await expect(page.getByText(/예시 파동:/)).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Check Answer' })).toBeDisabled();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await select(page, [0, 2, 4, 6, 8, 10]);
  const passed = await submit(page, 'Check Answer', 'check');
  expect(passed.validation.every((v: { pass: boolean }) => v.pass)).toBe(true);
  await expect(page.getByText('완료', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('완료', { exact: true })).toBeVisible();
});

test('Fibonacci candidates render with values and survive chart zoom and pan', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/tutorials/fibonacci-practice');
  await expect(candle(page, 0)).toBeVisible();
  await select(page, [0, 3, 6]);
  const legend = page.getByLabel('차트 가격 기준');
  await expect(legend).toContainText('112.36');
  await expect(legend).toContainText('107.64');
  await expect(legend).toContainText('142.36');
  const chart = page.getByRole('img', { name: /공개된 가격/ });
  await chart.scrollIntoViewIfNeeded();
  const box = await chart.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + 150);
  await page.mouse.wheel(0, -250);
  await page.mouse.down(); await page.mouse.move(box!.x + box!.width / 2 + 60, box!.y + 150, { steps: 5 }); await page.mouse.up();
  await expect(legend).toContainText('142.36');
  await submit(page, 'Check Answer', 'check');
  await expect(page.getByText('완료', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('automatic Replay can pause, finish, and preserve exit reflection in export', async ({ page }) => {
  await page.goto('/tutorials/trade-review');
  await expect(candle(page, 0)).toBeVisible();
  await select(page, [0, 3, 6]);
  const confirmed = await submit(page, '계획 확정하기', 'plan');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByText(`9 / ${confirmed.totalCandles}`, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  // Bounded absence check: a paused player must not issue the next scheduled request.
  const unexpected = await page.waitForRequest(req => req.url().endsWith('/replay'), { timeout: 1200 }).catch(() => null);
  expect(unexpected).toBeNull();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeDisabled({ timeout: 20000 });
  expect((await session(page)).complete).toBe(true);
  await submit(page, 'Show Example', 'hint');
  await expect(page.getByText(/W5/).last()).toBeVisible();
  await page.getByLabel('판단 이유', { exact: true }).fill('5파 이후 조정 가능성을 고려해 청산을 선택합니다.');
  const reflected = await submit(page, '판단 저장', 'reflection');
  expect(reflected.plan).toEqual(confirmed.plan);
  expect(reflected.reflection.decision).toBe('close');
  const link = page.getByRole('link', { name: 'JSON 내보내기' });
  const exported = await (await page.request.get((await link.getAttribute('href'))!)).json();
  expect(exported.session.reflection.reason).toContain('조정 가능성');
  expect(exported.schemas.tradePlan.type).toBe('object');
});

test('revision preserves old decisions and hides old outcome until new evaluation', async ({ page }) => {
  await page.goto('/tutorials/wave-three');
  await expect(candle(page, 0)).toBeVisible();
  await select(page, [0, 3, 6]);
  const v1 = (await submit(page, '계획 확정하기', 'plan')).plan;
  const advanced = await submit(page, 'Next Candle', 'replay');
  await submit(page, '새 계획 만들기', 'revise');
  await page.getByRole('spinbutton', { name: '진입가 USD' }).fill('116');
  const revised = await submit(page, '계획 확정하기', 'plan');
  expect(revised.plan.revision).toBe(2);
  expect(revised.plan.previousPlanId).toBe(v1.id);
  expect(revised.plan.asOf).toBe(advanced.visibleCandles.at(-1).time);
  expect(revised.plans[0]).toEqual(v1);
  await expect(page.getByText('다음 캔들을 기다리고 있습니다', { exact: true })).toBeVisible();
  await submit(page, 'Next Candle', 'replay');
  await page.reload();
  await expect(page.getByText(/계획 v2 ·/)).toBeVisible();
});

test('Binance source through UI evaluates later data without modifying plan', async ({ page }) => {
  await page.goto('/tutorials/market-lab');
  await page.getByRole('combobox', { name: '데이터 소스', exact: true }).selectOption('binance');
  const created = page.waitForResponse(res => res.url().endsWith('/api/sessions') && res.request().method() === 'POST');
  await page.getByRole('button', { name: '선택한 소스로 새 세션' }).click();
  const response = await created;
  expect(response.status()).toBe(201);
  const data = await response.json();
  await expect(page.getByText('80 / 120', { exact: true })).toBeVisible();
  let indices: number[] = [];
  for (let a = 0; a < 78 && !indices.length; a++) for (let b = a + 1; b < 79 && !indices.length; b++) for (let c = b + 1; c < 80 && !indices.length; c++) {
    if (data.visibleCandles[a].low < data.visibleCandles[c].low && data.visibleCandles[c].low < data.visibleCandles[b].high && data.visibleCandles.at(-1).close > data.visibleCandles[a].low) indices = [a,b,c];
  }
  expect(indices).toHaveLength(3);
  await select(page, indices);
  const confirmed = await submit(page, '계획 확정하기', 'plan');
  const evaluated = await submit(page, '이후 시장 평가', 'evaluate');
  expect(evaluated.plan).toEqual(confirmed.plan);
  expect(evaluated.evaluations.at(-1).evaluationMode).toBe('later-market');
  await expect(page.locator('.evaluation-body').getByText('사후 시장', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('120 / 120', { exact: true })).toBeVisible();
});


test('completion persists across reload and completing another unit', async ({ page }) => {
  await page.goto('/tutorials/impulse-theory');
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled();
  for (let i = 0; i < 4; i++) await submit(page, 'Next', 'advance');
  await page.goto('/tutorials/fibonacci-theory');
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled();
  for (let i = 0; i < 3; i++) await submit(page, 'Next', 'advance');
  await page.reload();
  await expect(page.getByRole('complementary')).toContainText('02 / 44');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('fibonacci-tutorial:completed') || '[]'))).toEqual(expect.arrayContaining(['impulse-theory', 'fibonacci-theory']));
});


test('theory Prev restores chart and explanation, survives reload, and allows reviewing completed theory', async ({ page }) => {
  await page.goto('/tutorials/fibonacci-theory');
  await expect(page.getByRole('button', { name: 'Prev', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled();
  const first = await session(page);
  await submit(page, 'Next', 'advance');
  const back = await submit(page, 'Prev', 'advance');
  expect(back.instruction).toEqual(first.instruction);
  expect(back.visibleCandles).toEqual(first.visibleCandles);
  expect(back.selectedIndices).toEqual(first.selectedIndices);
  await page.reload();
  await expect(page.getByText('이론 단계 1 / 3', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Prev', exact: true })).toBeDisabled();
  for (let i = 0; i < 3; i++) await submit(page, 'Next', 'advance');
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  const review = await submit(page, 'Prev', 'advance');
  expect(review.complete).toBe(false);
  await expect(page.getByText('이론 단계 2 / 3', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled();
  await expect(page.getByRole('heading', { name: review.instruction.title, exact: true })).toBeVisible();
});
