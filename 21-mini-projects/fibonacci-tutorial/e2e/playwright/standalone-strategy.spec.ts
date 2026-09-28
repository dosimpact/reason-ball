import { expect, test, type Page } from '@playwright/test';

async function newDummyStrategy(page: Page, mode: 'BACKTEST' | 'FORWARD', title: string) {
  await page.goto('/monitoring');
  await page.getByRole('link', { name: '새 전략 만들기' }).click();
  await page.getByRole('textbox', { name: '전략 이름' }).fill(title);
  await page.getByRole('combobox', { name: '검증 방식' }).selectOption(mode);
  await page.getByRole('button', { name: /초안 저장하고 차트 열기/ }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  expect(page.url()).toMatch(/\/monitoring\/[0-9a-f-]+$/);
}

async function selectWaveAndConfirm(page: Page, selected = false) {
  const draft = page.getByRole('region', { name: '전략 계획 초안' });
  if (!selected) for (const candle of [1, 4, 8]) await page.getByRole('button', { name: new RegExp(`^${candle}번째 캔들`) }).click();
  await draft.getByLabel('진입가').fill('114');
  await draft.getByLabel('손절가').fill('99');
  await draft.getByLabel('목표가').fill('200');
  await draft.getByLabel('파동 무효화 규칙').selectOption('price-level');
  await draft.getByLabel('별도 무효화 가격').fill('105');
  await draft.getByLabel('계획 요약').fill('공개된 봉에서 2파 저점을 확인하고 상승 재개를 계획합니다.');
  await draft.locator('summary').click();
  for (const label of ['파동 카운팅 근거', 'Fibonacci 기준', '진입 이유', '손절 이유', '목표 이유', '무효화 이유', '청산 판단 이유']) {
    await draft.getByLabel(label).fill(`${label}를 공개된 봉에서 기록했습니다.`);
  }
  await draft.getByLabel('청산 전략').fill('목표 도달 또는 무효화에 따라 모의 포지션을 종료합니다.');
  const confirmed = page.waitForResponse((response) => response.url().endsWith('/confirm'));
  await draft.getByRole('button', { name: '계획 확정' }).click();
  const response = await confirmed;
  expect(response.status()).toBe(200);
  await expect(page.getByRole('region', { name: '확정 계획' })).toContainText('revision 1');
  return response.json();
}

test('standalone backtest persists a draft, replays and batches, exports JSON, and opens a new revision', async ({ page }) => {
  const title = `독립 백테스트 ${Date.now()}`;
  await newDummyStrategy(page, 'BACKTEST', title);
  for (const candle of [1, 4]) await page.getByRole('button', { name: new RegExp(`^${candle}번째 캔들`) }).click();
  const savedResponse = page.waitForResponse((response) => response.url().match(/\/api\/strategies\/[0-9a-f-]+$/) !== null && response.request().method() === 'PATCH');
  await page.getByRole('region', { name: '전략 계획 초안' }).getByRole('button', { name: '초안 저장' }).click();
  expect((await savedResponse).status()).toBe(200);
  await page.reload();
  await expect(page.getByRole('region', { name: '전략 계획 초안' })).toContainText('선택한 봉 1 → 4');
  await page.getByRole('button', { name: /^8번째 캔들/ }).click();
  const confirmed = await selectWaveAndConfirm(page, true);
  expect(confirmed.plans).toHaveLength(1);
  expect(confirmed.plan.monitoringConfig).toMatchObject({ policy:'auto-abort', rule:{ kind:'price-level', level:105 } });
  const started = page.waitForResponse((response) => response.url().endsWith('/runs') && response.request().method() === 'POST');
  await page.getByRole('button', { name: '새 백테스트 실행' }).click();
  expect((await started).status()).toBe(201);
  await expect(page.getByRole('region', { name: '전략 실행 모니터링' })).toContainText('진입 대기');
  const step = page.waitForResponse((response) => response.url().endsWith('/step'));
  await page.getByRole('button', { name: /한 봉 진행/ }).click();
  const stepped = await (await step).json();
  expect(stepped.runs.at(-1).monitoring.status).toBe('OPEN');
  await expect(page.getByRole('region', { name: '실행 평가' })).toContainText('관측 봉1');
  await page.clock.install();
  await page.getByRole('button', { name: '자동 재생', exact: true }).click();
  const autoStep = page.waitForResponse((response) => response.url().endsWith('/step'));
  await page.clock.runFor(1000);
  expect((await (await autoStep).json()).runs.at(-1).observedCount).toBe(2);
  await page.getByRole('button', { name: '자동 재생 중지', exact: true }).click();
  await page.clock.runFor(2000);
  await expect(page.getByRole('region', { name: '실행 평가' })).toContainText('관측 봉2');
  const batch = page.waitForResponse((response) => response.url().endsWith('/batch'));
  await page.getByRole('button', { name: '전체 구간 실행' }).click();
  const finished = await (await batch).json();
  expect(finished.runs.at(-1).controlStatus).toBe('COMPLETED');
  expect(finished.runs.at(-1).observedCount).toBe(4);
  expect(finished.runs.at(-1).monitoring.events.some((event: {kind:string}) => event.kind === 'ENTERED')).toBe(true);
  await page.reload();
  await expect(page.getByRole('region', { name: '실행 평가' })).toContainText('관측 봉4');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '전체 JSON 내보내기' }).click();
  expect((await download).suggestedFilename()).toMatch(/^strategy-.*\.json$/);
  await page.getByRole('combobox', { name: '새 검증 방식' }).selectOption('FORWARD');
  const revised = page.waitForResponse((response) => response.url().endsWith('/revise'));
  await page.getByRole('button', { name: '새 revision 만들기' }).click();
  const version = await (await revised).json();
  expect(version.status).toBe('DRAFT');
  expect(version.mode).toBe('FORWARD');
  expect(version.plans).toHaveLength(1);
  expect(version.runs).toHaveLength(1);
  await expect(page.getByRole('region', { name: '전략 계획 초안' })).toBeVisible();
});

test('standalone forward simulation pauses, resumes after reload, and records a manual abort', async ({ page }) => {
  await newDummyStrategy(page, 'FORWARD', `독립 포워드 ${Date.now()}`);
  await selectWaveAndConfirm(page);
  const created = page.waitForResponse((response) => response.url().endsWith('/runs') && response.request().method() === 'POST');
  await page.getByRole('button', { name: '새 포워드 테스트 실행' }).click();
  expect((await created).status()).toBe(201);
  const poll = page.waitForResponse((response) => response.url().endsWith('/poll'));
  await page.getByRole('button', { name: '새 확정봉 확인' }).click();
  const polled = await (await poll).json();
  expect(polled.runs.at(-1).observedCount).toBe(1);
  expect(polled.runs.at(-1).monitoring.status).toBe('OPEN');
  const pause = page.waitForResponse((response) => response.url().endsWith('/pause'));
  await page.getByRole('button', { name: '감시 일시정지' }).click();
  expect((await (await pause).json()).runs.at(-1).controlStatus).toBe('PAUSED');
  await page.reload();
  await expect(page.getByRole('button', { name: '감시 재개' })).toBeVisible();
  const resume = page.waitForResponse((response) => response.url().endsWith('/resume'));
  await page.getByRole('button', { name: '감시 재개' }).click();
  expect((await (await resume).json()).runs.at(-1).controlStatus).toBe('RUNNING');
  await page.getByRole('textbox', { name: '수동 중단 이유' }).fill('현재 공개된 봉에서 기존 파동 전제를 철회합니다.');
  const abort = page.waitForResponse((response) => response.url().endsWith('/abort'));
  await page.getByRole('button', { name: /계획 중단 · 모의 청산/ }).click();
  const aborted = await (await abort).json();
  expect(aborted.runs.at(-1).monitoring.status).toBe('ABORTED');
  expect(aborted.runs.at(-1).monitoring.events.at(-1).kind).toBe('ABORTED');
  await page.reload();
  await expect(page.getByRole('region', { name: '전략 실행 모니터링' })).toContainText('수동 중단');
  await expect(page.getByRole('region', { name: '실행 평가' })).toContainText('실현 R');
});

test('standalone Binance watch polls immediately and every 60 seconds, then stops locally', async ({ page }) => {
  await page.clock.install();
  const createdResponse = await page.request.post('/api/strategies', { data: { title:'자동 감시 타이머 검증', mode:'FORWARD', source:{ type:'dummy' } } });
  expect(createdResponse.status()).toBe(201);
  const created = await createdResponse.json();
  const route = `/api/strategies/${created.id}`;
  const confirmedResponse = await page.request.post(`${route}/confirm`, { data: { expectedVersion:created.version, waveIndices:[0,3,7], entry:114, stopLoss:99, target:200, rationale:'공개된 봉으로 포워드 계획을 검증합니다.', monitoring:{ policy:'auto-abort', rule:{ kind:'price-level', level:105 } } } });
  expect(confirmedResponse.status()).toBe(200);
  const confirmed = await confirmedResponse.json();
  const startedResponse = await page.request.post(`${route}/runs`, { data:{ expectedVersion:confirmed.version, mode:'FORWARD' } });
  expect(startedResponse.status()).toBe(201);
  const started = await startedResponse.json();
  const runId = started.activeRunId;
  let pollCount = 0;
  const asBinance = (value: Record<string, unknown>) => ({ ...value, source:{ type:'binance', symbol:'BTCUSDT', interval:'1h' }, dataset:{ ...(value.dataset as Record<string,unknown>), kind:'binance-live', label:'BTCUSDT 1h · Binance' } });
  await page.route(`**${route}`, async (request) => {
    const response = await request.fetch();
    const data = await response.json();
    await request.fulfill({ response, contentType:'application/json', body:JSON.stringify(asBinance(data)) });
  });
  await page.route(`**${route}/runs/${runId}/poll`, async (request) => {
    pollCount += 1;
    await request.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(asBinance(started)) });
  });
  await page.goto(`/monitoring/${created.id}`);
  await expect(page.getByRole('button', { name:'감시 시작' })).toBeVisible();
  const firstPoll = page.waitForResponse((response) => response.url().endsWith(`/runs/${runId}/poll`));
  await page.getByRole('button', { name:'감시 시작' }).click();
  expect((await firstPoll).status()).toBe(200);
  await expect(page.getByRole('button', { name:'감시 중지' })).toBeVisible();
  await expect(page.getByRole('button', { name:'새 확정봉 확인' })).toBeEnabled();
  expect(pollCount).toBe(1);
  await page.clock.runFor(60_000);
  await expect.poll(() => pollCount).toBe(2);
  await page.getByRole('button', { name:'감시 중지' }).click();
  await page.clock.runFor(60_000);
  expect(pollCount).toBe(2);
  await page.goto('/monitoring');
  await page.clock.runFor(60_000);
  expect(pollCount).toBe(2);
});

test('dummy cutoff and backtest horizon are chosen before the chart opens', async ({ page }) => {
  const optionsResponse = await page.request.get('/api/strategies/options');
  expect(optionsResponse.status()).toBe(200);
  const { dummyCutoffs } = await optionsResponse.json();
  const chosen = dummyCutoffs.find((option: { ordinal: number }) => option.ordinal === 7);
  expect(chosen.maxBacktestBars).toBeGreaterThanOrEqual(5);
  await page.goto('/monitoring/new');
  await page.getByRole('textbox', { name:'전략 이름' }).fill('더미 기준 봉 선택 검증');
  const lastCutoff = dummyCutoffs.find((option: { ordinal: number }) => option.ordinal === 11);
  await page.getByRole('combobox', { name:'더미 기준 봉' }).selectOption(String(lastCutoff.asOf));
  await page.getByRole('combobox', { name:'데이터 출처' }).selectOption('binance');
  await page.getByRole('combobox', { name:'데이터 출처' }).selectOption('dummy');
  await expect(page.getByRole('spinbutton', { name:'백테스트 관측 봉 수' })).toHaveValue('1');
  await page.getByRole('combobox', { name:'더미 기준 봉' }).selectOption(String(chosen.asOf));
  await page.getByRole('spinbutton', { name:'백테스트 관측 봉 수' }).fill('5');
  const createdResponse = page.waitForResponse((response) => response.url().endsWith('/api/strategies') && response.request().method() === 'POST');
  await page.getByRole('button', { name:/초안 저장하고 차트 열기/ }).click();
  const created = await (await createdResponse).json();
  expect(created.asOf).toBe(chosen.asOf);
  expect(created.backtestBars).toBe(5);
  expect(created.visibleCandles).toHaveLength(7);
  await expect(page.getByRole('heading', { name:'더미 기준 봉 선택 검증' })).toBeVisible();
  await expect(page.getByRole('group', { name:'공개된 캔들 선택' }).locator('button')).toHaveCount(7);
});
