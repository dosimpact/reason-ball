import { expect, test, type Page } from '@playwright/test';

const inline = { id: 'technical_analysis_agent', path: '/technical-analysis', label: '기술적 분석 · 인라인' };
const canvas = { id: 'technical_analysis_canvas_agent', path: '/technical-analysis/canvas', label: '기술적 분석 · Canvas' };
const reportId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

async function installRuntime(page: Page, missing = false) {
  const calls: { path: string; body: Record<string, unknown> }[] = [];
  await page.route('**/api/langgraph-runtime/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const body = route.request().method() === 'POST' ? route.request().postDataJSON() ?? {} : {};
    calls.push({ path, body });
    if (path.endsWith('/assistants/search')) return route.fulfill({ json: (missing ? ['starter_graph'] : ['starter_graph', inline.id, canvas.id]).map(id => ({ assistant_id: id, graph_id: id })) });
    if (path.endsWith('/schemas')) return route.fulfill({ json: { input_schema: { type: 'object', properties: { messages: { type: 'array' } } } } });
    if (path.endsWith('/threads/search')) return route.fulfill({ json: [] });
    if (path.endsWith('/threads')) return route.fulfill({ json: { thread_id: 'fixture-thread', metadata: body.metadata } });
    if (path.endsWith('/runs/fixture-run')) return route.fulfill({ json: { run_id: 'fixture-run', status: 'success' } });
    if (path.endsWith('/runs/stream')) {
      const program = body.assistant_id === canvas.id
        ? 'root = Col([CanvasItem("navigation:chart", "분석 차트", [Text("OpenUI 파동 분석 테스트")])])'
        : 'root = Text("OpenUI 파동 분석 테스트")';
      const events: [string, unknown][] = [['metadata', { run_id: 'fixture-run' }]];
      events.push(['values', { messages: [{ id: 'answer', type: 'ai', content: '분석 완료' }], presentation: { id: reportId, program } }]);
      return route.fulfill({ contentType: 'text/event-stream', body: events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('') });
    }
    return route.fulfill({ status: 404, json: { detail: `Unexpected fixture path: ${path}` } });
  });
  return calls;
}

for (const target of [inline, canvas]) {
  test(`TA-NAV-001: ${target.id} menu locks the graph and renders OpenUI`, async ({ page }) => {
    const calls = await installRuntime(page);
    await page.goto('/');
    await page.getByRole('link', { name: target.label, exact: true }).click();
    await expect(page).toHaveURL(target.path);
    await expect(page.getByRole('heading', { name: target.label, exact: true })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'LangGraph 에이전트' })).toHaveCount(0);
    await expect.poll(() => calls.some(call => call.path.endsWith('/assistants/search'))).toBe(true);
    await page.getByRole('button', { name: 'AAPL 일봉 분석', exact: true }).click();
    await expect(page.getByText('OpenUI 파동 분석 테스트', { exact: true })).toBeVisible();
    const runs = calls.filter(call => call.path.endsWith('/runs/stream'));
    expect(runs).toHaveLength(1);
    expect(runs[0].body.assistant_id).toBe(target.id);
    expect(calls.filter(call => call.path.endsWith('/threads/search')).every(call => (call.body.metadata as { graph_id: string }).graph_id === target.id)).toBe(true);
    if (target === canvas) {
      await expect(page.getByRole('region', { name: '기술적 분석 Canvas' })).toHaveCount(0);
      await page.getByRole('button', { name: 'Canvas에 추가', exact: true }).click();
      await expect(page.getByRole('region', { name: '기술적 분석 Canvas' })).toBeVisible();
    }
    await page.reload();
    await expect(page.getByRole('heading', { name: target.label, exact: true })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'LangGraph 에이전트' })).toHaveCount(0);
  });
}

test('TA-NAV-001: missing graph never falls back and retry restores the dedicated agent', async ({ page }) => {
  const calls = await installRuntime(page, true);
  await page.goto(inline.path);
  await expect(page.getByRole('alert').filter({ hasText: '실행 서버에 등록되어 있지 않습니다.' })).toBeVisible();
  await page.getByRole('button', { name: 'AAPL 일봉 분석', exact: true }).click();
  expect(calls.some(call => call.path.endsWith('/runs/stream') || call.path.endsWith('/threads'))).toBe(false);
  await page.unroute('**/api/langgraph-runtime/**');
  const restored = await installRuntime(page);
  await page.getByRole('button', { name: '목록 다시 불러오기', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: '실행 서버에 등록되어 있지 않습니다.' })).toHaveCount(0);
  await page.getByRole('button', { name: 'AAPL 일봉 분석', exact: true }).click();
  await expect(page.getByText('OpenUI 파동 분석 테스트', { exact: true })).toBeVisible();
  expect(restored.find(call => call.path.endsWith('/runs/stream'))?.body.assistant_id).toBe(inline.id);
});

test('TA-NAV-001: developer chat retains graph selection and mobile dedicated navigation works', async ({ page }) => {
  await installRuntime(page);
  await page.goto('/langgraph-dev-chat');
  await expect(page.getByRole('combobox', { name: 'LangGraph 에이전트' })).toBeVisible();
  await page.getByRole('combobox', { name: 'LangGraph 에이전트' }).selectOption(canvas.id);
  await expect(page.getByText('기술적 분석 · Canvas 에이전트와 대화하세요.', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(inline.path);
  await page.getByRole('button', { name: '메뉴 열기', exact: true }).click();
  await page.getByRole('link', { name: canvas.label, exact: true }).click();
  await expect(page).toHaveURL(canvas.path);
  await expect(page.getByRole('heading', { name: canvas.label, exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Sidebar', exact: true })).toHaveCount(0);
  await page.getByRole('textbox', { name: '메시지를 입력하세요', exact: true }).fill('AAPL 일봉 분석');
  await page.getByRole('textbox', { name: '메시지를 입력하세요', exact: true }).press('Enter');
  await page.getByRole('button', { name: 'Canvas에 추가', exact: true }).click();
  await expect(page.getByRole('region', { name: '기술적 분석 Canvas' })).toBeVisible();
});
