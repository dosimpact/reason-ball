import { expect, test, type Page } from '@playwright/test';

type Dataset = { datasetId: string; filing: { accessionNo: string }; observations: { exactValue: string | null }[] };
type Snapshot = { sec: { financial_dataset: Dataset }; surfaces: Record<string, unknown>; canvas_surface_id: string };
type Event = { type: string; toolCallName?: string; snapshot?: Snapshot };
const streams = new WeakMap<Page, string[]>();
async function captureStreams(page: Page) {
  const bodies: string[] = [];
  streams.set(page, bodies);
  await page.exposeBinding('__recordSecStream', (_source, body: string) => bodies.push(body));
  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const response = await original(...args);
      if (response.url.includes('/api/copilotkit/a2ui/sec') && response.headers.get('content-type')?.includes('text/event-stream')) {
        void response.clone().text().then(body => (window as unknown as { __recordSecStream: (body: string) => Promise<void> }).__recordSecStream(body));
      }
      return response;
    };
  });
}
async function send(page: Page, message: string) {
  const bodies = streams.get(page)!;
  const index = bodies.length;
  await page.getByRole('textbox', { name: '기능 질문, 회사 검색 또는 공시 분석 요청' }).fill(message);
  await page.getByTestId('copilot-send-button').click();
  console.log('SEC request:', message);
  await expect.poll(() => bodies.length, { timeout: 240_000 }).toBeGreaterThan(index);
  const events: Event[] = bodies[index].split('\n').filter(l => l.startsWith('data: ')).map(l => JSON.parse(l.slice(6)));
  expect(events.filter(e => e.type === 'RUN_ERROR')).toEqual([]);
  expect(events.some(e => e.type === 'RUN_FINISHED')).toBe(true);
  await expect(page.getByRole('status').filter({ hasText: '작업 완료' })).toBeVisible();
  console.log('SEC finished');
  return { names: events.filter(e => e.type === 'TOOL_CALL_START').map(e => e.toolCallName), snapshot: events.filter(e => e.type === 'STATE_SNAPSHOT').at(-1)!.snapshot! };
}

test.describe('SEC-CHART financial data and surface lifecycle', () => {
  test.skip(!process.env.SEC_AGENT_LIVE_TESTS, 'Real OAuth and stored SEC filings required');
  test.setTimeout(600_000);
  test('prompt guide, extraction, source values, inline preservation, canvas reuse and mobile', async ({ page }) => {
    await captureStreams(page);
    await page.goto('/a2ui/sec');
    await page.getByText('프롬프트 예시 · 재무 차트 요청 방법', { exact: true }).click();
    await expect(page.getByText(/이 보고서의 매출과 영업이익을 연도별 그룹 막대로/)).toBeVisible();
    expect((await send(page, '뭐가 가능해?')).names).toEqual([]);
    await expect(page.getByRole('figure')).toHaveCount(0);
    await send(page, 'CPNG 회사의 2026-02-26 제출 10-K를 선택해줘.');
    const first = await send(page, '이 보고서의 매출과 영업이익을 연도별 그룹 막대로 비교해줘');
    expect(first.names).toContain('extract_financial_data');
    expect(first.names).not.toContain('ExtractionProposal');
    expect(first.names).toContain('render_financial_charts');
    expect(first.names.indexOf('extract_financial_data')).toBeLessThan(first.names.indexOf('render_financial_charts'));
    const dataset = first.snapshot.sec.financial_dataset;
    expect(dataset.filing.accessionNo).toBe('0001834584-26-000024');
    expect(dataset.observations.map(o => o.exactValue)).toEqual(expect.arrayContaining(['34534000000', '30268000000', '24383000000', '473000000', '436000000']));
    const inlineId = Object.keys(first.snapshot.surfaces).find(id => id.startsWith('sec-inline-'))!;
    const firstFigure = page.getByRole('figure').last();
    await expect(firstFigure).toHaveAttribute('data-chart-kind', 'grouped_bar');
    await firstFigure.getByText('데이터 표 보기', { exact: true }).click();
    await expect(firstFigure.getByRole('cell', { name: '34534', exact: true })).toBeVisible();
    await firstFigure.getByText('출처 보기', { exact: true }).click();
    await expect(firstFigure.getByText(/Total net revenues[\s\S]*34,534/)).toBeVisible();
    const originalTable = await firstFigure.getByRole("table").innerText();
    const originalSource = await firstFigure.locator("details").last().innerText();
    await expect(firstFigure.getByRole("row")).toHaveCount(4);
    const second = await send(page, '방금 추출한 동일한 매출과 영업이익을 선 차트 하나로 바꿔줘.');
    expect(second.names).not.toContain('extract_financial_data');
    expect(second.snapshot.sec.financial_dataset.datasetId).toBe(dataset.datasetId);
    expect(Object.keys(second.snapshot.surfaces)).not.toContain(inlineId);
    await expect(page.getByRole('figure').last()).toHaveAttribute('data-chart-kind', 'line');
    const history = page.locator('details').filter({ has: page.locator('figure[data-chart-kind="grouped_bar"]') }).first();
    await history.locator(':scope > summary').click();
    const historicalFigure = page.locator('figure[data-chart-kind="grouped_bar"]');
    await historicalFigure.getByText('데이터 표 보기', { exact: true }).click();
    await historicalFigure.getByText('출처 보기', { exact: true }).click();
    await expect(historicalFigure.getByRole('table')).toHaveText(originalTable, { useInnerText: true });
    await expect(historicalFigure.locator('details').last()).toHaveText(originalSource, { useInnerText: true });
    await page.getByRole('combobox', { name: '결과 표시 위치' }).selectOption('canvas');
    const canvasFirst = await send(page, '같은 데이터로 매출 선 차트 하나를 보여줘.');
    expect(canvasFirst.names).not.toContain('extract_financial_data');
    const canvas = page.getByRole('region', { name: 'SEC Canvas' });
    await expect(canvas.getByRole('figure')).toHaveAttribute('data-chart-kind', 'line');
    const canvasSecond = await send(page, '같은 데이터의 매출을 단일 막대 차트 하나로 바꿔줘.');
    expect(canvasSecond.snapshot.canvas_surface_id).toBe(canvasFirst.snapshot.canvas_surface_id);
    expect(canvasSecond.names).not.toContain('extract_financial_data');
    await expect(canvas.getByRole('figure')).toHaveAttribute('data-chart-kind', 'bar');
    await expect(canvas.getByRole('figure')).toHaveCount(1);
    const beforeShortcut = streams.get(page)!.length;
    await page.getByRole('button', { name: '재무 시각화', exact: true }).click();
    await expect.poll(() => streams.get(page)!.length, { timeout: 240_000 }).toBeGreaterThan(beforeShortcut);
    const shortcutEvents: Event[] = streams.get(page)![beforeShortcut].split('\n').filter(l => l.startsWith('data: ')).map(l => JSON.parse(l.slice(6)));
    expect(shortcutEvents.some(e => e.type === 'RUN_ERROR')).toBe(false);
    expect(shortcutEvents.some(e => e.type === 'TOOL_CALL_START' && e.toolCallName === 'render_financial_charts')).toBe(true);
    await expect(canvas.getByRole('figure')).toBeVisible();
    await page.screenshot({ path: 'test-results/sec-financial-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await canvas.getByRole('figure').scrollIntoViewIfNeeded();
    const figure = await canvas.getByRole('figure').boundingBox();
    expect(figure!.width).toBeLessThanOrEqual(390);
    const viewport = page.getByRole('region', { name: '채팅 결과' });
    if (await viewport.count()) expect((await viewport.boundingBox())!.height).toBeLessThanOrEqual(900);
    await page.screenshot({ path: 'test-results/sec-financial-mobile.png', fullPage: true });
  });
});
