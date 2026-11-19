import { expect, test } from '@playwright/test';

const ids = ['main_graph', 'simple_llm', 'technical_analysis_graph', 'price_agent', 'starter_graph', 'tenk_subgraph', 'sec_deep_agent', 'technical_analysis_agent', 'unknown_fixture_graph', 'schema_error_fixture'];
const chat = new Set(['starter_graph', 'simple_llm', 'technical_analysis_agent', 'sec_deep_agent']);

test.beforeEach(async ({ request, page }) => {
  const fixture = await request.get('/api/langgraph/__calls');
  expect(fixture.ok(), 'Run the owned chat-graphs-server.mjs fixture upstream').toBeTruthy();
  expect(Array.isArray(await fixture.json())).toBeTruthy();
  await page.goto('/langgraph-dev-chat');
});

test('every discovered graph is selectable and executes in its input mode', async ({ page }) => {
  const selector = page.locator('select[aria-label="LangGraph 에이전트"]:visible');
  await expect(selector.locator('option')).toHaveCount(10);
  expect((await selector.locator('option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value))).sort()).toEqual([...ids].sort());
  for (const id of ids) {
    await selector.selectOption(id);
    if (id === 'schema_error_fixture') await expect(page.getByText('입력 스키마를 불러오지 못했습니다. 다시 조회하거나 JSON 입력을 확인하세요.')).toBeVisible();
    if (chat.has(id)) {
      const composer = page.locator('textarea:visible').first();
      await composer.fill(`Fixture hello ${id}`);
      await composer.press('Enter');
      await expect.poll(async () => (await page.locator(".agent-conversation__answer").last().innerText()).replaceAll("_", "")).toContain(`Fixture reply for ${id.replaceAll("_", "")}`);
    } else {
      await expect(page.getByRole('textbox', { name: '그래프 입력 JSON' })).toBeVisible();
      await page.getByRole('textbox', { name: '그래프 입력 JSON' }).fill(JSON.stringify({ input: id, turn_id: 'fixture-turn', query: 'AAPL', prices: [] }));
      await page.getByRole('button', { name: '그래프 실행', exact: true }).click();
      await expect(page.getByRole('region', { name: '그래프 실행 결과' })).toContainText(id);
    }
  }
});

test('invalid JSON never invokes a graph and server error is visible', async ({ page, request }) => {
  await page.locator('select[aria-label="LangGraph 에이전트"]:visible').selectOption('price_agent');
  const url = '/api/langgraph/__calls';
  const before = await request.get(url).then(response => response.json());
  await page.getByRole('textbox', { name: '그래프 입력 JSON' }).fill('{invalid');
  await page.getByRole('button', { name: '그래프 실행', exact: true }).click();
  await expect(page.getByRole('alert').first()).toBeVisible();
  const after = await request.get(url).then(response => response.json());
  expect(after.filter((call: { path: string }) => call.path.endsWith('/runs/stream')).length).toBe(before.filter((call: { path: string }) => call.path.endsWith('/runs/stream')).length);
  await page.getByRole('textbox', { name: '그래프 입력 JSON' }).fill('{"fail":true}');
  await page.getByRole('button', { name: '그래프 실행', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Fixture graph execution failed' })).toBeVisible();
});

test('cancelled JSON run does not overwrite a new graph result', async ({ page }) => {
  const selector = page.locator('select[aria-label="LangGraph 에이전트"]:visible');
  await selector.selectOption('price_agent');
  await page.getByRole('textbox', { name: '그래프 입력 JSON' }).fill('{"delay":true,"query":"cancel fixture"}');
  const started = page.waitForRequest(request => request.url().endsWith('/runs/stream'));
  await page.getByRole('button', { name: '그래프 실행', exact: true }).click();
  await started;
  await page.getByRole('button', { name: '실행 중단', exact: true }).click();
  await expect(selector).toBeEnabled();
  await selector.selectOption('unknown_fixture_graph');
  await page.getByRole('textbox', { name: '그래프 입력 JSON' }).fill('{"input":"new isolated result"}');
  await page.getByRole('button', { name: '그래프 실행', exact: true }).click();
  await expect(page.getByRole('region', { name: '그래프 실행 결과' })).toContainText('new isolated result');
  await page.waitForTimeout(2200);
  await expect(page.getByRole('region', { name: '그래프 실행 결과' })).not.toContainText('cancel fixture');
});
