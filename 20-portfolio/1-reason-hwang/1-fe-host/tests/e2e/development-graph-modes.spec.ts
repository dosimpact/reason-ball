import { expect, test } from '@playwright/test';

test('development graph IDs and message-based graph chat modes', async ({ page }) => {
  const ids = ['starter_graph', 'simple_llm', 'price_agent', 'technical_analysis_graph', 'main_graph', 'tenk_subgraph'];
  const inputs: Record<string, unknown>[] = [];
  await page.route('**/api/langgraph-runtime/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const body = route.request().method() === 'POST' ? route.request().postDataJSON() ?? {} : {};
    if (path.endsWith('/assistants/search')) return route.fulfill({ json: ids.map(id => ({ assistant_id: id, graph_id: id })) });
    if (path.endsWith('/schemas')) return route.fulfill({ json: { input_schema: { type: 'object', properties: { messages: { type: 'array' } } } } });
    if (path.endsWith('/threads/search')) return route.fulfill({ json: [] });
    if (path.endsWith('/threads')) return route.fulfill({ json: { thread_id: 'graph-mode-thread' } });
    if (path.endsWith('/runs/stream')) {
      inputs.push(body);
      const content = body.assistant_id === 'price_agent' ? 'AAPL 가격 조회 응답' : 'OHLCV 입력을 검증하지 못해 기술적 분석을 실행하지 않았습니다.';
      return route.fulfill({ contentType: 'text/event-stream', body: `event: metadata\ndata: {"run_id":"mode-run"}\n\nevent: values\ndata: ${JSON.stringify({ messages: [{ id: 'reply', type: 'ai', content }] })}\n\n` });
    }
    if (path.endsWith('/runs/mode-run')) return route.fulfill({ json: { status: 'success' } });
    return route.fulfill({ status: 404, json: { detail: path } });
  });
  await page.goto('/langgraph-dev-chat');
  const selector = page.getByRole('combobox', { name: 'LangGraph 에이전트' });
  await expect(selector.locator('option')).toHaveText(ids);
  for (const id of ['price_agent', 'technical_analysis_graph']) {
    await selector.selectOption(id);
    const composer = page.getByRole('textbox', { name: '메시지를 입력하세요', exact: true });
    await expect(composer).toBeVisible();
    await expect(page.getByRole('heading', { name: /테스트$/ })).toHaveCount(0);
    if (id === 'technical_analysis_graph') await expect(page.getByRole('status').filter({ hasText: 'OHLCV' })).toBeVisible();
    await composer.fill('AAPL 가격');
    await composer.press('Enter');
    await expect(page.getByText(id === 'price_agent' ? 'AAPL 가격 조회 응답' : 'OHLCV 입력을 검증하지 못해 기술적 분석을 실행하지 않았습니다.', { exact: true })).toBeVisible();
    expect(inputs.at(-1)?.assistant_id).toBe(id);
    expect((inputs.at(-1)?.input as Record<string, unknown>).messages).toBeTruthy();
  }
  for (const id of ['main_graph', 'tenk_subgraph']) {
    await selector.selectOption(id);
    await expect(page.getByRole('heading', { name: /테스트$/ })).toBeVisible();
  }
});
