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

async function finishAction(page: Page, button: string, scope: Page | Locator = page) {
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

test.describe('SEC-A2UI-10 live agent', () => {
  test.skip(!process.env.SEC_AGENT_LIVE_TESTS, 'Explicit opt-in: real OAuth model and stored SEC BFF data');
  test.setTimeout(240_000);

  test('help is text-only; company search is model-selected Fixed UI; help preserves it', async ({ page }) => {
    await page.goto('/a2ui/sec');
    const help = await send(page, '뭐가 가능해?');
    expect(tools(help)).toEqual([]);
    await expect(page.getByRole('textbox', { name: '회사명 또는 티커', exact: true })).toHaveCount(0);
    const search = await send(page, '쿠팡(CPNG) 회사를 찾아줘');
    expect(tools(search)).toEqual(['search_companies', 'render_fixed_ui']);
    await expect(page.getByRole('cell', { name: 'Coupang, Inc.', exact: true })).toBeVisible();
    const before = await page.getByRole('table').innerText();
    expect(tools(await send(page, '지금 뭐가 가능해?'))).toEqual([]);
    await expect(page.getByRole('table')).toHaveText(before, { useInnerText: true });
    await expect(page.getByText('검색 결과가 없습니다. 검색어를 바꿔 주세요.', { exact: true })).toHaveCount(0);
  });

  test('empty search replaces old results and subsequent search recovers', async ({ page }) => {
    await page.goto('/a2ui/sec');
    await send(page, 'CPNG');
    await expect(page.getByRole('cell', { name: 'Coupang, Inc.', exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: '회사명 또는 티커', exact: true }).fill('NO_MATCH_SEC_AGENT_20260922');
    await finishAction(page, '회사 검색');
    await expect(page.getByRole('table')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '공시 조회', exact: true })).toHaveCount(0);
    await expect(page.getByText('검색 결과가 없습니다. 검색어를 바꿔 주세요.', { exact: true }).first()).toBeVisible();
    await page.getByRole('textbox', { name: '회사명 또는 티커', exact: true }).fill('CPNG');
    await finishAction(page, '회사 검색');
    await expect(page.getByRole('cell', { name: 'Coupang, Inc.', exact: true })).toBeVisible();
    // The current A2UI fieldset must be clean even though historical assistant messages remain in chat.
    await expect(page.locator('fieldset').getByText('검색 결과가 없습니다. 검색어를 바꿔 주세요.', { exact: true })).toHaveCount(0);
  });

  test('selected filing help does not analyze; requested risk table uses Dynamic tool and citations', async ({ page }) => {
    await page.goto('/a2ui/sec');
    const filings = await send(page, '쿠팡(CPNG)의 원문이 저장된 10-K 공시 목록을 보여줘');
    expect(tools(filings)).toContain('list_filings');
    expect(tools(filings)).toContain('render_fixed_ui');
    await expect(page.getByRole('button', { name: '공시 선택', exact: true })).toBeVisible();
    await finishAction(page, '공시 선택');
    await expect(page.getByRole('button', { name: '분석·요약 보고서 생성', exact: true })).toBeEnabled();
    const selected = await page.getByText(/^선택: .*선택한 문서 한 건만 분석합니다\.$/).innerText();
    expect(tools(await send(page, '이제 뭐가 가능해?'))).toEqual([]);
    await expect(page.getByText(selected, { exact: true })).toBeVisible();
    const analysis = await send(page, '선택한 공시의 위험 요인만 표로 보여줘');
    expect(tools(analysis)).toContain('analyze_filing');
    expect(tools(analysis)).toContain('render_dynamic_ui');
    await expect(page.getByRole('columnheader', { name: '원문 근거' })).toBeVisible();
    await expect(page.getByRole('table').getByText(/\[E\d+\]/).first()).toBeVisible();
    await expect(page.getByText(/SHA-256/)).toBeVisible();
    await expect(page.locator('fieldset').last().getByText(selected, { exact: true })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath('sec-dynamic-risk-table.png'), fullPage: true });
  });
  test('Inline creates history; Canvas reuses its ID and retains its own action context', async ({ page }) => {
    await page.goto('/a2ui/sec');
    const inline = page.locator('[aria-label="채팅 결과"]');
    const canvas = page.getByRole('region', { name: 'SEC Canvas' });
    const location = page.getByRole('combobox', { name: '결과 표시 위치' });
    const twoStages = 'CPNG 회사를 검색해서 회사 목록 화면을 먼저 보여준 다음, 원문이 저장된 10-K 공시 목록 화면을 보여줘. render_fixed_ui를 각 단계에서 호출해 두 화면을 차례대로 보여줘.';
    const first = await send(page, twoStages);
    expect(tools(first).filter(name => name === 'render_fixed_ui')).toHaveLength(2);
    await expect(inline.locator('fieldset')).toHaveCount(2);
    const firstId = await inline.locator('fieldset').first().getAttribute('data-surface-id');
    const secondId = await inline.locator('fieldset').last().getAttribute('data-surface-id');
    expect(firstId).not.toEqual(secondId);
    const history = await inline.locator('fieldset').first().innerText();
    await expect(inline.locator('fieldset').first().getByRole('button', { name: '공시 조회', exact: true })).toBeDisabled();
    await expect(inline.locator('fieldset').last().getByRole('button', { name: '공시 선택', exact: true })).toBeEnabled();
    await location.selectOption('canvas');
    const inCanvas = await send(page, twoStages);
    expect(tools(inCanvas).filter(name => name === 'render_fixed_ui')).toHaveLength(2);
    await expect(canvas.locator('fieldset')).toHaveCount(1);
    const canvasId = await canvas.locator('fieldset').getAttribute('data-surface-id');
    expect(canvasId).toMatch(/^sec-canvas-/);
    await expect(canvas.getByRole('button', { name: '공시 선택', exact: true })).toBeVisible();
    await expect(inline.locator('fieldset')).toHaveCount(2);
    await location.selectOption('inline');
    await send(page, 'AAPL 회사를 검색해줘');
    await expect(inline.locator('fieldset')).toHaveCount(3);
    await expect(inline.locator('fieldset').last().getByRole('cell', { name: 'Apple Inc.', exact: true })).toBeVisible();
    await expect(inline.locator('fieldset').first()).toHaveText(history, { useInnerText: true });
    // The output selector says Inline, but a Canvas button must update its own
    // CPNG context, never the latest AAPL company selection.
    await finishAction(page, '공시 선택', canvas);
    await expect(canvas.getByText(/^선택: .*0001834584/)).toBeVisible();
    await expect(canvas.locator('fieldset')).toHaveAttribute('data-surface-id', canvasId!);
    await expect(inline.locator('fieldset').last().getByRole('cell', { name: 'Apple Inc.', exact: true })).toBeVisible();
    await location.selectOption('canvas');
    await send(page, 'MSFT 회사를 검색해줘');
    await expect(canvas.locator('fieldset')).toHaveAttribute('data-surface-id', canvasId!);
    await expect(canvas.getByRole('cell', { name: 'MICROSOFT CORP', exact: true })).toBeVisible();
    await expect(inline.locator('fieldset')).toHaveCount(3);
    await expect(inline.locator('fieldset').first()).toHaveText(history, { useInnerText: true });
    await page.screenshot({ path: test.info().outputPath('sec-inline-canvas.png'), fullPage: true });
    await page.getByRole('button', { name: '새 대화', exact: true }).click();
    await expect(page.locator('fieldset')).toHaveCount(0);
    await expect(location).toHaveValue('inline');
  });

});
