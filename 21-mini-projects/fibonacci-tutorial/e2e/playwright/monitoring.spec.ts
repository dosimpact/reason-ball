import { expect, test, type Page } from '@playwright/test';

async function openFresh(page: Page, unitId = 'wave-three') {
  const created = await page.request.post('/api/sessions', { data: { unitId } });
  expect(created.status()).toBe(201);
  const session = await created.json();
  await page.goto(`/tutorials/${unitId}?session=${session.id}`);
  return session;
}

test('default auto-abort monitor enters, records a manual abort, and rejects duplicate abort', async ({ page }) => {
  const initial = await openFresh(page);
  for (const candle of [1, 4, 7]) await page.getByRole('button', { name: new RegExp(`^${candle}번째 캔들`) }).click();
  await expect(page.getByLabel('무효화 처리')).toHaveValue('auto-abort');
  await page.getByLabel('파동 무효화 규칙').selectOption('price-level');
  await page.getByRole('spinbutton', { name: '별도 무효화 가격' }).fill('102');
  const confirmed = page.waitForResponse((response) => response.url().endsWith('/plan'));
  await page.getByRole('button', { name: '계획 확정하기' }).click();
  const saved = await (await confirmed).json();
  expect(saved.plan.monitoringConfig).toMatchObject({ policy: 'auto-abort', rule: { kind: 'price-level', level: 102 } });
  expect(saved.monitoring.status).toBe('PENDING');
  await expect(page.getByRole('region', { name: '전략 실행 모니터링' })).toContainText('진입 대기');
  const replay = page.waitForResponse((response) => response.url().endsWith('/replay'));
  await page.getByRole('button', { name: 'Next Candle' }).click();
  const entered = await (await replay).json();
  expect(entered.monitoring.status).toBe('OPEN');
  await expect(page.getByRole('region', { name: '전략 실행 모니터링' })).toContainText('모의 포지션 진행');
  await page.getByRole('textbox', { name: '수동 중단 이유' }).fill('공개된 후속 봉에서 원래 상승 가정을 철회합니다.');
  const aborted = page.waitForResponse((response) => response.url().endsWith('/monitoring/abort'));
  await page.getByRole('button', { name: '수동 중단', exact: true }).click();
  const stopped = await (await aborted).json();
  expect(stopped.monitoring.status).toBe('ABORTED');
  expect(stopped.monitoring.events.at(-1).kind).toBe('ABORTED');
  await expect(page.getByRole('region', { name: '전략 실행 모니터링' })).toContainText('확정 손익');
  const duplicate = await page.request.post(`/api/sessions/${initial.id}/monitoring/abort`, {
    data: { expectedPlanId: stopped.plan.id, expectedCursor: stopped.cursor, reason: '반복 중단은 거절해야 합니다.' },
  });
  expect(duplicate.status()).toBe(409);
});

test('warn-only plan keeps its separate boundary and distinguishes the comparison evaluation', async ({ page }) => {
  await openFresh(page);
  for (const candle of [1, 4, 7]) await page.getByRole('button', { name: new RegExp(`^${candle}번째 캔들`) }).click();
  await page.getByLabel('무효화 처리').selectOption('warn-only');
  await page.getByLabel('파동 무효화 규칙').selectOption('price-level');
  await page.getByRole('spinbutton', { name: '별도 무효화 가격' }).fill('101');
  const confirmed = page.waitForResponse((response) => response.url().endsWith('/plan'));
  await page.getByRole('button', { name: '계획 확정하기' }).click();
  const saved = await (await confirmed).json();
  expect(saved.monitoring).toMatchObject({ policy: 'warn-only', rule: { kind: 'price-level', level: 101 } });
  await expect(page.getByRole('region', { name: '전략 실행 모니터링' })).toContainText('경고만');
  await expect(page.getByText('가격 조건 비교 평가')).toBeVisible();
  await expect(page.getByText(/기존 touch-v1 가격 조건을 적용한 비교 결과/)).toBeVisible();
  await expect(page.getByRole('region', { name: '전략 실행 모니터링' })).toContainText('가격 경계 101.00');
});

test('Binance auto-watch polls closed bars every 60 seconds and stops on command', async ({ page }) => {
  await page.clock.install();
  const created = await page.request.post('/api/sessions', { data: { unitId: 'market-lab' } });
  expect(created.status()).toBe(201);
  const session = await created.json();
  let evaluateCalls = 0;
  let confirmedSession: Record<string, unknown> | null = null;
  await page.route(`**/api/sessions/${session.id}/**`, async (route) => {
    if (route.request().url().endsWith('/evaluate')) {
      evaluateCalls += 1;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(confirmedSession) });
      return;
    }
    const response = await route.fetch();
    const body = await response.json();
    if (body.id === session.id) {
      body.source = { type: 'binance', symbol: 'BTCUSDT', interval: '1h' };
      if (route.request().url().endsWith('/plan')) confirmedSession = body;
    }
    await route.fulfill({ response, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.route(`**/api/sessions/${session.id}`, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.source = { type: 'binance', symbol: 'BTCUSDT', interval: '1h' };
    await route.fulfill({ response, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto(`/tutorials/market-lab?session=${session.id}`);
  for (const candle of [1, 4, 7]) await page.getByRole('button', { name: new RegExp(`^${candle}번째 캔들`) }).click();
  const planResponse = page.waitForResponse((response) => response.url().endsWith('/plan'));
  await page.getByRole('button', { name: '계획 확정하기' }).click();
  expect((await planResponse).status()).toBe(200);
  await expect(page.getByRole('button', { name: '감시 시작' })).toBeVisible();
  await page.getByRole('button', { name: '감시 시작' }).click();
  await expect.poll(() => evaluateCalls).toBe(1);
  await expect(page.getByRole('button', { name: '감시 중지' })).toBeVisible();
  await page.clock.runFor(60_000);
  await expect.poll(() => evaluateCalls).toBe(2);
  await page.getByRole('button', { name: '감시 중지' }).click();
  await expect(page.getByRole('button', { name: '감시 시작' })).toBeVisible();
  await page.clock.runFor(60_000);
  expect(evaluateCalls).toBe(2);
});
