import { expect, test, type Page, type Locator } from '@playwright/test';

type WireEvent = { type: string; toolCallName?: string; snapshot?: Record<string, unknown> };
const chatName = '기능 질문, 회사 검색 또는 공시 분석 요청';

async function send(page: Page, text: string): Promise<WireEvent[]> {
  const response = page.waitForResponse(value => value.url().includes('/api/copilotkit/a2ui/sec')
    && value.request().method() === 'POST' && (value.headers()['content-type'] ?? '').includes('text/event-stream'));
  const input = page.getByRole('textbox', { name: chatName });
  await input.fill(text);
  // The SDK icon button has no accessible name; use its observed stable test ID.
  await page.getByTestId('copilot-send-button').click();
  const result = await response;
  const body = await result.text();
  const events = body.split('\n').filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6)) as WireEvent);
  expect(result.status()).toBe(200);
  expect(events.some(event => event.type === 'RUN_ERROR')).toBe(false);
  expect(events.some(event => event.type === 'RUN_FINISHED')).toBe(true);
  await expect(page.getByRole('status').filter({ hasText: '작업 완료' })).toBeVisible();
  return events;
}

function tools(events: WireEvent[]) {
  return events.filter(event => event.type === 'TOOL_CALL_START').map(event => event.toolCallName);
}

async function finishAction(page: Page, button: string | RegExp, scope: Page | Locator = page) {
  const response = page.waitForResponse(value => value.url().includes('/api/copilotkit/a2ui/sec')
    && value.request().method() === 'POST' && (value.headers()['content-type'] ?? '').includes('text/event-stream'));
  await scope.getByRole('button', { name: button, exact: true }).click();
  const result = await response;
  const body = await result.text();
  const events = body.split("\n").filter(line => line.startsWith("data: ")).map(line => JSON.parse(line.slice(6)) as WireEvent);
  expect(result.status()).toBe(200);
  expect(events.some(event => event.type === "RUN_ERROR")).toBe(false);
  expect(events.some(event => event.type === "RUN_FINISHED")).toBe(true);
  await expect(page.getByRole('status').filter({ hasText: '작업 완료' })).toBeVisible();
}

test.describe('SEC-A2UI-12 reviewed UX', () => {
  test.skip(!process.env.SEC_AGENT_LIVE_TESTS, 'Explicit opt-in: real OAuth model and stored SEC BFF data');
  test.setTimeout(240_000);

  test('start is focused; help is text-only; company has a direct action', async ({ page }) => {
    await page.goto('/a2ui/sec');
    await expect(page.getByRole('heading', { name: '어느 회사의 공시를 볼까요?' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'SEC Canvas' })).toHaveCount(0);
    expect(tools(await send(page, '뭐가 가능해?'))).toEqual([]);
    await expect(page.locator('fieldset')).toHaveCount(0);
    const search = await send(page, '쿠팡(CPNG) 회사를 찾아줘');
    expect(tools(search)).toEqual(['search_companies', 'render_fixed_ui']);
    await expect(page.getByRole('button', { name: 'CPNG 공시 보기', exact: true })).toBeEnabled();
    await expect(page.locator('fieldset').getByRole('combobox')).toHaveCount(0);
    await expect(page.getByRole('table')).toHaveCount(0);
    const before = await page.locator('fieldset').innerText();
    expect(tools(await send(page, '지금 뭐가 가능해?'))).toEqual([]);
    await expect(page.locator('fieldset')).toHaveText(before, { useInnerText: true });
  });

  test('empty results explain recovery without stale companies', async ({ page }) => {
    await page.goto('/a2ui/sec');
    await send(page, 'CPNG');
    await page.getByRole('textbox', { name: '회사명 또는 티커', exact: true }).fill('NO_MATCH_SEC_AGENT_20260922');
    await finishAction(page, '회사 검색');
    await expect(page.getByText('일치하는 회사가 없습니다', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'CPNG 공시 보기', exact: true })).toHaveCount(0);
    await page.getByRole('textbox', { name: '회사명 또는 티커', exact: true }).fill('CPNG');
    await finishAction(page, '회사 검색');
    await expect(page.getByRole('button', { name: 'CPNG 공시 보기', exact: true })).toBeEnabled();
    await expect(page.locator('fieldset').getByText('일치하는 회사가 없습니다', { exact: true })).toHaveCount(0);
  });

  test('direct company → filing → risk preset; report retains context and supports agent layout change', async ({ page }) => {
    await page.goto('/a2ui/sec');
    await send(page, 'CPNG');
    await finishAction(page, 'CPNG 공시 보기');
    await expect(page.getByText('연간보고서 (10-K) · 분석 가능 · 5건', { exact: true })).toBeVisible();
    await expect(page.locator('fieldset').getByRole('combobox')).toHaveCount(0);
    const filingButton = await page.getByRole('button', { name: /^10-K · .* 선택$/ }).first().innerText();
    await finishAction(page, filingButton);
    await expect(page.getByRole('button', { name: '핵심 요약', exact: true })).toBeEnabled();
    const identity = await page.locator('fieldset').getByText(/^보고기간 /).innerText();
    expect(tools(await send(page, '이제 뭐가 가능해?'))).toEqual([]);
    await expect(page.locator('fieldset').getByText(identity, { exact: true })).toBeVisible();
    await finishAction(page, '위험 요인');
    await expect(page.getByRole('columnheader', { name: '원문 근거' })).toBeVisible();
    await expect(page.getByRole('table').getByText(/\[E\d+\]/).first()).toBeVisible();
    await expect(page.locator('fieldset').getByText(/^10-K · 보고기간 .* 제출 /)).toBeVisible();
    await page.getByRole('button', { name: '출처 · 조회 시각 · 분석 범위', exact: true }).click();
    await expect(page.getByText(/SHA-256/)).toBeVisible();
    const layout = await send(page, '같은 위험 분석 내용을 카드로 보여줘. 새로 분석하지 말고 화면 표현만 바꿔줘.');
    expect(tools(layout)).toContain('render_dynamic_ui');
    expect(tools(layout)).not.toContain('analyze_filing');
    await expect(page.locator('fieldset').last().getByText(/\[E\d+\]/).first()).toBeVisible();
    await expect(page.locator('details > summary').filter({ hasText: '이전 결과' })).toHaveCount(1);
    await page.locator('details > summary').filter({ hasText: '이전 결과' }).click();
    const previousReport = page.locator('fieldset').first();
    const previousSource = previousReport.getByRole('button', { name: '출처 · 조회 시각 · 분석 범위', exact: true });
    await expect(previousSource).toBeEnabled();
    if (await previousSource.getAttribute('aria-expanded') === 'true') await previousSource.click();
    await previousSource.click();
    await expect(previousReport.getByText(/SHA-256/)).toBeVisible();
    await previousReport.getByRole('button', { name: '다른 분석 요청 / 공시 변경', exact: true }).click();
    await expect(previousReport.getByRole('button', { name: '핵심 요약', exact: true })).toBeDisabled();
    await page.locator('details > summary').filter({ hasText: '이전 결과' }).click();
    await page.screenshot({ path: test.info().outputPath('sec-ux-risk-report.png'), fullPage: true });
  });

  test('Inline history folds; Canvas keeps its own document and replaces stale title', async ({ page }) => {
    await page.goto('/a2ui/sec');
    const inline = page.locator('[aria-label="채팅 결과"]');
    const canvas = page.getByRole('region', { name: 'SEC Canvas' });
    const location = page.getByRole('combobox', { name: '결과 표시 위치' });
    const twoStages = 'CPNG 회사를 검색해서 회사 목록 화면을 먼저 보여준 다음, 원문이 저장된 10-K 공시 목록 화면을 보여줘. render_fixed_ui를 각 단계에서 호출해 두 화면을 차례대로 보여줘.';
    const first = await send(page, twoStages);
    expect(tools(first).filter(name => name === 'render_fixed_ui')).toHaveLength(2);
    await expect(inline.locator('fieldset')).toHaveCount(2);
    expect(await inline.locator('fieldset').first().getAttribute('data-surface-id')).not.toEqual(await inline.locator('fieldset').last().getAttribute('data-surface-id'));
    const history = await inline.locator('fieldset').first().textContent();
    const previous = inline.locator('details > summary').filter({ hasText: '이전 결과' }).first();
    await expect(previous).toBeVisible();
    await expect(inline.getByRole('button', { name: 'CPNG 공시 보기', exact: true })).toBeHidden();
    await previous.click();
    await expect(inline.getByRole('button', { name: 'CPNG 공시 보기', exact: true })).toBeDisabled();
    await previous.click();
    await location.selectOption('canvas');
    await expect(canvas).toBeVisible();
    const inCanvas = await send(page, twoStages);
    expect(tools(inCanvas).filter(name => name === 'render_fixed_ui')).toHaveLength(2);
    await expect(canvas.locator('fieldset')).toHaveCount(1);
    const canvasId = await canvas.locator('fieldset').getAttribute('data-surface-id');
    await expect(inline.locator('fieldset')).toHaveCount(2);
    await location.selectOption('inline');
    await send(page, 'AAPL 회사를 검색해줘');
    await expect(inline.locator('fieldset')).toHaveCount(3);
    await expect(inline.getByRole('button', { name: 'AAPL 공시 보기', exact: true })).toBeEnabled();
    expect(await inline.locator('fieldset').first().textContent()).toEqual(history);
    const filingButton = await canvas.getByRole('button', { name: /^10-K · .* 선택$/ }).first().innerText();
    await finishAction(page, filingButton, canvas);
    await expect(canvas.getByRole('button', { name: '핵심 요약', exact: true })).toBeEnabled();
    await expect(canvas.locator('fieldset')).toHaveAttribute('data-surface-id', canvasId!);
    await expect(inline.getByRole('button', { name: 'AAPL 공시 보기', exact: true })).toBeEnabled();
    await location.selectOption('canvas');
    await send(page, 'MSFT 회사를 검색해줘');
    await expect(canvas.locator('fieldset')).toHaveAttribute('data-surface-id', canvasId!);
    await expect(canvas.getByRole('button', { name: 'MSFT 공시 보기', exact: true })).toBeEnabled();
    await expect(canvas.getByText('작업 화면 · MICROSOFT CORP', { exact: true })).toBeVisible();
    await expect(canvas.getByText(/Coupang/)).toHaveCount(0);
    await expect(inline.locator('fieldset')).toHaveCount(3);
    await page.screenshot({ path: test.info().outputPath('sec-ux-inline-canvas.png'), fullPage: true });
    await page.getByRole('button', { name: '새 대화', exact: true }).click();
    await expect(page.locator('fieldset')).toHaveCount(0);
    await expect(canvas).toHaveCount(0);
    await expect(location).toHaveValue('inline');
  });

  test('mobile direct flow and filter recovery need no dropdown reselection', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/a2ui/sec');
    const response = page.waitForResponse(value => value.url().includes('/api/copilotkit/a2ui/sec') && value.request().method() === 'POST' && (value.headers()['content-type'] ?? '').includes('text/event-stream'));
    await page.getByRole('button', { name: '쿠팡 CPNG', exact: true }).click();
    const quickStart = (await (await response).text()).split('\n').filter(line => line.startsWith('data: ')).map(line => JSON.parse(line.slice(6)) as WireEvent);
    expect(quickStart.some(event => event.type === 'RUN_FINISHED')).toBe(true);
    expect(quickStart.some(event => event.type === 'RUN_ERROR')).toBe(false);
    await expect(page.getByRole('button', { name: 'CPNG 공시 보기', exact: true })).toBeEnabled();
    await finishAction(page, 'CPNG 공시 보기');
    await finishAction(page, '분기보고서');
    await expect(page.getByText(/분기보고서 \(10-Q\) · 분석 가능/)).toBeVisible();
    await finishAction(page, '전체 공시');
    await expect(page.getByText(/모든 공시 · 저장 상태 전체/)).toBeVisible();
    await page.getByRole('button', { name: '추가 조건', exact: true }).click();
    await page.getByRole('textbox', { name: '제출 시작일 (선택)' }).fill('2999-01-01');
    await finishAction(page, '조건 적용');
    await expect(page.getByText('현재 조건에 맞는 공시가 없습니다', { exact: true })).toBeVisible();
    await finishAction(page, '연간보고서');
    const filingButton = await page.getByRole('button', { name: /^10-K · .* 선택$/ }).first().innerText();
    await finishAction(page, filingButton);
    await expect(page.getByRole('button', { name: '핵심 요약', exact: true })).toBeEnabled();
    const width = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: innerWidth }));
    expect(width.content).toBeLessThanOrEqual(width.viewport + 1);
    await page.screenshot({ path: test.info().outputPath('sec-ux-mobile.png'), fullPage: true });
  });
});
