import { test, expect, type Page } from '@playwright/test';
async function install(page: Page) {
  const reportId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const program = 'price = CanvasItem("price", "가격 차트", [Text("AAPL 가격 근거")])\nrsi = CanvasItem("rsi", "RSI 차트", [Text("RSI 55 — 중립 구간")])\nroot = Col([price, rsi])';
  const calls: {path: string; body: Record<string, unknown>}[] = [];
  const metadata = {source:'host-chat', graph_id:'technical_analysis_canvas_agent',runtime:'fastapi',title:'Canvas 검증 대화'};
  let created = false;
  const values = {messages:[{id:'question',type:'human',content:'AAPL 분석'},{id:'answer',type:'ai',content:'설명은 채팅에 유지됩니다.'}],presentation:{id:reportId,program}};
  await page.route('**/api/fastapi-langgraph/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const body = route.request().method()==='POST' ? route.request().postDataJSON()??{} : {};
    calls.push({path,body});
    if(path.endsWith('/assistants/search')) return route.fulfill({json:[{assistant_id:'technical_analysis_canvas_agent',graph_id:'technical_analysis_canvas_agent'}]});
    if(path.endsWith('/schemas')) return route.fulfill({json:{input_schema:{type:'object',properties:{messages:{type:'array'}}}}});
    if(path.endsWith('/threads/search')) return route.fulfill({json:created?[{thread_id:'canvas-fixture',metadata,updated_at:'2026-11-17T00:00:00Z',status:'idle'}]:[]});
    if(path.endsWith('/threads')) {created=true;return route.fulfill({json:{thread_id:'canvas-fixture',metadata}});}
    if(path.endsWith('/state')) return route.fulfill({json:{values}});
    if(path.endsWith('/runs')) return route.fulfill({json:[{run_id:'fixture-run',status:'success'}]});
    if(path.endsWith('/runs/fixture-run')) return route.fulfill({json:{run_id:'fixture-run',status:'success'}});
    if(path.endsWith('/runs/stream')) {
      const explaining = Boolean((body.input as Record<string, unknown> | undefined)?.canvas_context && ((body.input as Record<string, unknown>).canvas_context as Record<string, unknown>).quote);
      const response = explaining ? {messages:[...values.messages,{id:'quote-answer',type:'ai',content:'원래 RSI 근거에 대한 설명입니다.'}],presentation:null} : values;
      const events=[['metadata',{run_id:'fixture-run'}],['values',response]];
      return route.fulfill({contentType:'text/event-stream',body:events.map(([event,data])=>`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('')});
    }
    return route.fulfill({status:404,json:{detail:path}});
  });
  return {calls,reportId};
}


test('TA-CANVAS-003: explicit pin, layout restore, quote context and removal', async ({ page }) => {
  const { calls, reportId } = await install(page);
  await page.goto('/technical-analysis/canvas');
  await page.getByRole('button', {name:'AAPL 일봉 분석', exact:true}).click();
  const add = page.getByRole('button', {name:'Canvas에 추가', exact:true});
  await expect(add).toHaveCount(2);
  const panel = page.getByRole('region', {name:'기술적 분석 Canvas', exact:true});
  await expect(panel).toHaveCount(0);
  await add.first().click();
  await add.first().click();
  await expect(panel.locator('article')).toHaveCount(1);
  await add.last().click();
  await panel.getByRole('button', {name:'RSI 차트 이동', exact:true}).press('ArrowUp');
  await panel.getByRole('button', {name:'RSI 차트 크기 조절', exact:true}).press('ArrowRight');
  await expect(panel.locator('article').first()).toContainText('RSI 차트');
  await expect(panel.locator('article').first()).toHaveCSS('grid-column-start','span 2');
  await page.reload();
  await page.getByText('대화 기록', {exact:true}).last().click();
  await page.getByRole('button', {name:/Canvas 검증 대화/}).click();
  await expect(panel.locator('article')).toHaveCount(2);
  await expect(panel.locator('article').first()).toContainText('RSI 차트');
  await expect(panel.locator('article').first()).toHaveCSS('grid-column-start','span 2');
  const quote = panel.getByText('RSI 55 — 중립 구간', {exact:true});
  await quote.evaluate(element => {
    const range = document.createRange(); range.selectNodeContents(element);
    const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
  });
  await quote.dispatchEvent('mouseup');
  await panel.getByRole('button', {name:'채팅에 물어보기', exact:true}).click();
  await expect.poll(() => calls.filter(call => call.path.endsWith('/runs/stream')).length).toBe(2);
  const input = calls.filter(call => call.path.endsWith('/runs/stream')).at(-1)?.body.input as Record<string,unknown>;
  expect(input.canvas_context).toMatchObject({reportId, elementId:'rsi',quote:'RSI 55 — 중립 구간'});
  await expect(panel.locator('article')).toHaveCount(2);
  await page.screenshot({path:'test-results/canvas-wrapper-pinned.png',fullPage:true});
  await page.emulateMedia({media:'print'});
  await page.screenshot({path:'test-results/canvas-wrapper-print.png',fullPage:true});
  await page.emulateMedia({media:'screen'});
  await panel.getByRole('button', {name:'가격 차트 제거', exact:true}).click();
  await expect(panel.locator('article')).toHaveCount(1);
  await expect(page.getByRole('button', {name:'Canvas에 추가',exact:true})).toHaveCount(2);
});
