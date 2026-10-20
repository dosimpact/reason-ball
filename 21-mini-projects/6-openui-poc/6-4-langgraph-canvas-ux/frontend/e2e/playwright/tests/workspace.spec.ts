import {test,expect,type Page} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const key='canvas-ux:thread-canvas:fixture-thread';
const envelope={schemaVersion:2,threadId:'fixture-thread',tabs:[{id:'main',title:'대시보드'}],activeTabId:'main',selectedWidgetId:null};
test.beforeEach(async({page})=>{page.on('console',m=>{if(m.type()==='error')console.log(m.text());});await page.addInitScript(()=>{if(localStorage.getItem('test-initialized'))return;localStorage.setItem('test-initialized','yes'); localStorage.setItem('canvas-ux:threads',JSON.stringify([{id:'fixture-thread',title:'저장된 분석',createdAt:'2026-10-18T00:00:00Z'}]));localStorage.setItem('canvas-ux:active-thread','fixture-thread');});});
const offlineWidgets=[{schemaVersion:1,catalogVersion:1,widgetId:'offline-sales',title:'매출',program:'root = Col([CanvasChart("매출", "bar")])',chartType:'bar',queryId:'a'.repeat(24),queryVersion:1,parameters:{months:3,region:'ALL'},snapshot:{rows:[{period:'2026-10-01',value:100}],dataVersion:1,sourceWatermark:'2026-10-18T00:00:00Z',fetchedAt:'2026-10-18T00:00:00Z',parametersHash:'fixture',provenance:'synthetic',resultSchemaVersion:1},definitionRevision:1,refreshPolicy:'manual',intervalSeconds:60,uiState:{}}];
async function widgets(page:Page){return page.evaluate(()=>JSON.parse(localStorage.getItem(`canvas-ux:thread-canvas:${encodeURIComponent(localStorage.getItem('canvas-ux:active-thread')||'')}`)||'{"widgets":[]}').widgets); }
async function send(page:Page,text:string){const input=page.getByPlaceholder('Ask anything...').filter({visible:true});await input.fill(text);await input.press('Enter');}

test.afterEach(async({page},info)=>{
 if(info.status!==info.expectedStatus) await info.attach('chart-state',{body:JSON.stringify(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([key])=>key.includes('artifacts')||key.includes('messages')||key.includes('active-thread')))),null,2),contentType:'application/json'});
});

test('real Python model + DuckDB: create, patch, model-free refresh, persist, explain',async({page,request})=>{
 // CHAT-01, CANVAS-01..04, PATCH-01/02/05, FRESH-01, SAVE-01..03.
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByText('매출과 광고비 Canvas',{exact:true}).filter({visible:true}).click();
 const cards=page.getByTestId('canvas-widget');await expect(cards).toHaveCount(2,{timeout:120000});
 await expect(cards.nth(1).getByRole('button',{name:'데이터 보기'})).toBeVisible();
 await expect.poll(async()=>(await widgets(page)).length).toBe(2);
 const initial=await widgets(page);expect(initial.every((w:{program:string})=>(w.program.match(/CanvasChart\(/g)||[]).length===1)).toBeTruthy();
 await expect(cards.first().locator('svg[role="img"]')).toBeVisible();
 await page.screenshot({path:'output/playwright/real-created.png',fullPage:true});
 const sales=initial.find((w:{title:string})=>w.title.includes('매출'));expect(sales).toBeTruthy();
 const other=initial.find((w:{widgetId:string})=>w.widgetId!==sales.widgetId);
 const salesCard=page.locator(`[data-widget-id="${sales.widgetId}"]`);
 await salesCard.getByRole('button',{name:/선택:/}).click();
 const nextType=sales.chartType==='line'?'bar':'line';
 await send(page,`선택한 매출 차트만 최근 3개월 한국 데이터로 바꾸고 ${nextType==='bar'?'막대':'선'} 차트로 변경해줘. 제목은 '한국 매출'로 바꾸고 다른 차트는 유지해줘.`);
 await expect.poll(async()=>{const w=(await widgets(page)).find((w:{widgetId:string})=>w.widgetId===sales.widgetId);return [w?.parameters.region,w?.parameters.months,w?.chartType,w?.definitionRevision];},{timeout:120000}).toEqual(['KR',3,nextType,2]);
 let current=await widgets(page);expect(current.find((w:{widgetId:string})=>w.widgetId===other.widgetId)).toEqual(other);
 const before=current.find((w:{widgetId:string})=>w.widgetId===sales.widgetId);
 expect(before.title).toBe('한국 매출');expect(before.program).not.toBe(sales.program);
 const metricsBefore=await (await request.get('/api/workspace/health')).json();
 execFileSync('uv',['run','simulate-analytics'],{cwd:path.resolve('../backend-langgraph')});
 await salesCard.getByRole('button',{name:'새로고침',exact:true}).click();
 await expect.poll(async()=>(await widgets(page)).find((w:{widgetId:string})=>w.widgetId===sales.widgetId).snapshot.dataVersion).toBe(before.snapshot.dataVersion+1);
 current=await widgets(page);const refreshed=current.find((w:{widgetId:string})=>w.widgetId===sales.widgetId);
 expect(refreshed.program).toBe(before.program);expect(refreshed.snapshot.rows.at(-1).value).toBe(before.snapshot.rows.at(-1).value+100);
 expect(current.find((w:{widgetId:string})=>w.widgetId===other.widgetId)).toEqual(other);
 const metricsAfter=await (await request.get('/api/workspace/health')).json();expect(metricsAfter.metrics.modelCalls).toBe(metricsBefore.metrics.modelCalls);
 await page.reload();await expect(cards).toHaveCount(2);expect(await widgets(page)).toEqual(current);
 const explanationResponse=page.waitForResponse(r=>r.url().endsWith('/api/workspace/run'));
 await send(page,'캔버스 차트의 의미만 채팅에서 설명해줘. 차트는 수정하지 마.');
 await expect(page.locator('.chat-shell p').filter({hasText:/합성|매출/}).first()).toBeVisible({timeout:60000});
 await explanationResponse;await expect(page.getByRole('complementary',{name:'Canvas 대시보드'})).toHaveAttribute('aria-busy','false',{timeout:60000});
 expect(await widgets(page)).toEqual(current);
 await page.screenshot({path:'output/playwright/real-refreshed.png',fullPage:true});
 fs.mkdirSync('output/validation',{recursive:true});fs.writeFileSync('output/validation/verified-widgets.json',JSON.stringify(current,null,2));
 await salesCard.getByRole('button',{name:/선택:/}).click();
 await send(page,'선택한 매출 차트만 2026년 7월 1일부터 2026년 9월 30일까지의 고정 기간으로 바꿔줘.');
 await expect.poll(async()=>{const w=(await widgets(page)).find((w:{widgetId:string})=>w.widgetId===sales.widgetId);return [w.parameters.start_date,w.parameters.end_date];},{timeout:60000}).toEqual(['2026-07-01','2026-09-30']);
 const fixed=(await widgets(page)).find((w:{widgetId:string})=>w.widgetId===sales.widgetId);
 expect(fixed.queryId).toBe(refreshed.queryId);expect(fixed.snapshot.rows.every((r:{period:string})=>r.period>='2026-07-01'&&r.period<='2026-09-30')).toBeTruthy();
 expect((await widgets(page)).find((w:{widgetId:string})=>w.widgetId===other.widgetId)).toEqual(other);
 await expect(salesCard.getByLabel(`${fixed.title} 기간`)).toHaveValue('fixed');
 expect(errors).toEqual([]);
});

test('restores snapshots offline and preserves incompatible stored documents',async({page})=>{
 const saved=offlineWidgets;
 await page.addInitScript(({key,saved,envelope})=>localStorage.setItem(key,JSON.stringify({...envelope,widgets:saved})),{key,saved,envelope});
 await page.route('**/api/workspace/query/**',r=>r.abort());await page.goto('/');
 await expect(page.getByTestId('canvas-widget')).toHaveCount(1);
 await page.getByTestId('canvas-widget').first().getByRole('button',{name:'새로고침',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'갱신 실패'}).first()).toBeVisible();expect(await widgets(page)).toEqual(saved);
 await page.evaluate(k=>localStorage.setItem(k,'{"schemaVersion":999,"important":"preserve"}'),key);
 // addInitScript would replace the document on reload: use a new page in this context without that script below.
});

test('unknown persisted version is never overwritten by Save',async({page})=>{
 const raw='{"schemaVersion":999,"important":"preserve"}';
 await page.addInitScript(({key,raw})=>localStorage.setItem(key,raw),{key,raw});await page.goto('/');
 await expect(page.getByRole('status')).toContainText('지원하지 않는');await page.getByRole('button',{name:'저장',exact:true}).click();
 expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBe(raw);
});

// Deterministic browser clock verifies real UI polling without provider calls.
test('polling refreshes data, backs off failures, and stops in snapshot mode',async({page})=>{
 const saved=offlineWidgets.map(w=>({...w,refreshPolicy:'polling',intervalSeconds:10}));
 await page.clock.install();
 await page.addInitScript(({key,saved,envelope})=>localStorage.setItem(key,JSON.stringify({...envelope,widgets:saved})),{key,saved,envelope});
 let queries=0;let runs=0;let fail=false;
 page.on('request',r=>{if(r.url().endsWith('/api/workspace/run'))runs++;});
 await page.route('**/api/workspace/query/**',async route=>{queries++;if(fail){await route.fulfill({status:503,json:{error:'temporary outage'}});return;}await route.fulfill({json:{...saved[0].snapshot,dataVersion:queries+1,rows:[{period:'2026-10-01',value:100+queries}]}});});
 await page.goto('/');await expect(page.getByTestId('canvas-widget')).toHaveCount(1);
 await page.clock.fastForward(10000);await expect.poll(()=>queries).toBe(1);
 await expect.poll(async()=>(await widgets(page))[0].snapshot.dataVersion).toBe(2);
 expect((await widgets(page))[0].program).toBe(saved[0].program);
 fail=true;await page.clock.fastForward(10000);await expect.poll(()=>queries).toBe(2);
 await expect(page.getByRole('status').filter({hasText:'자동 재시도 대기'})).toBeVisible();
 await page.clock.fastForward(10000);expect(queries).toBe(2);
 expect((await widgets(page))[0].snapshot.dataVersion).toBe(2);
 await page.getByLabel('매출 갱신 정책').selectOption('snapshot');
 await page.clock.fastForward(60000);expect(queries).toBe(2);expect(runs).toBe(0);
 await expect(page.getByRole('button',{name:'새로고침',exact:true})).toBeDisabled();
});

test('ordinary Chat uses DuckDB OpenUI and leaves Canvas unchanged',async({page,request})=>{
 await page.goto('/');const before=await (await request.get('/api/workspace/health')).json();
 await send(page,'DuckDB 합성 데이터에서 최근 3개월 한국 월별 매출을 조회해서 채팅 안에 막대 차트로 보여줘. 캔버스는 변경하지 마. period와 value를 표시해줘.');
 await expect(page.locator('.chat-shell svg[role="img"]')).toBeVisible({timeout:90000});
 await expect(page.getByRole('complementary',{name:'Canvas 대시보드'})).toHaveAttribute('aria-busy','false',{timeout:60000});
 expect(await widgets(page)).toEqual([]);
 const after=await (await request.get('/api/workspace/health')).json();expect(after.metrics.queryToolCalls).toBeGreaterThan(before.metrics.queryToolCalls);
 await page.screenshot({path:'output/playwright/ordinary-chat.png',fullPage:true});
 await send(page,'같은 조회 결과를 표로 보여줘. Canvas는 변경하지 마.');
 await expect(page.locator('.chat-shell table')).toBeVisible({timeout:90000});
 expect(await widgets(page)).toEqual([]);
});

test('unsupported catalog shows saved table without running its UI or fetching',async({page})=>{
 const raw=JSON.stringify({...envelope,widgets:offlineWidgets.map(w=>({...w,catalogVersion:99,program:'root = Query("unexpected-execution", {})'}))});
 let requests=0;page.on('request',r=>{if(r.url().includes('/api/workspace/'))requests++;});
 await page.addInitScript(({key,raw})=>localStorage.setItem(key,raw),{key,raw});await page.goto('/');
 await expect(page.getByRole('region',{name:'매출 복구 데이터'}).getByRole('cell',{name:'100',exact:true})).toBeVisible();
 await expect(page.getByTestId('canvas-widget')).toHaveCount(0);
 await page.getByRole('button',{name:'저장',exact:true}).click();expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBe(raw);expect(requests).toBe(0);
});

test('known v0 migration preserves fixed dates without a refresh on open',async({page})=>{
 const saved=offlineWidgets.map(w=>({...w,parameters:{...w.parameters,start_date:'2026-07-01',end_date:'2026-09-30'}}));
 await page.addInitScript(({saved})=>localStorage.setItem('canvas-ux:dashboard:v1',JSON.stringify({schemaVersion:0,items:saved})),{saved});
 let requests=0;page.on('request',r=>{if(r.url().includes('/api/workspace/'))requests++;});await page.goto('/');
 await expect(page.getByTestId('canvas-widget')).toHaveCount(0);await page.getByRole('button',{name:'이전 공용 Canvas 가져오기'}).click();
 await expect(page.getByTestId('canvas-widget')).toHaveCount(1);await expect(page.getByText('고정 기간: 2026-07-01 ~ 2026-09-30')).toBeVisible();
 await expect(page.getByLabel('매출 기간')).toHaveValue('fixed');expect(requests).toBe(0);
 await page.getByRole('button',{name:'저장',exact:true}).click();
 expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!).schemaVersion,key)).toBe(5);expect((await widgets(page))[0].parameters).toEqual(saved[0].parameters);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('canvas-ux:dashboard:v1')!).schemaVersion)).toBe(0);
});

test('Cancel aborts the real Python run and preserves completed widgets',async({page,request})=>{
 const saved=offlineWidgets;
 await page.addInitScript(({key,saved,envelope})=>localStorage.setItem(key,JSON.stringify({...envelope,widgets:saved})),{key,saved,envelope});await page.goto('/');
 await expect(page.getByTestId('canvas-widget')).toHaveCount(1);
 const before=await (await request.get('/api/workspace/health')).json();
 await send(page,'Canvas에 월별 광고비, 월별 매출, 지역별 매출 차트를 새로 각각 만들어줘.');
 await expect.poll(async()=>(await (await request.get('/api/workspace/health')).json()).metrics.activeRuns).toBe(1);
 await page.getByRole('button',{name:'Cancel message',exact:true}).click();
 await expect(page.getByRole('complementary',{name:'Canvas 대시보드'})).toHaveAttribute('aria-busy','false');
 await expect.poll(async()=>(await (await request.get('/api/workspace/health')).json()).metrics.cancelledRuns).toBe(before.metrics.cancelledRuns+1);
 await expect.poll(async()=>(await (await request.get('/api/workspace/health')).json()).metrics.activeRuns).toBe(0);
 expect(await widgets(page)).toEqual(saved);
});

test('duplicate titles require clarification without attempting a query',async({page,request})=>{
 const saved=[...offlineWidgets, {...offlineWidgets[0],widgetId:'another-sales'}];
 await page.addInitScript(({key,saved,envelope})=>localStorage.setItem(key,JSON.stringify({...envelope,widgets:saved})),{key,saved,envelope});await page.goto('/');await expect(page.getByTestId('canvas-widget')).toHaveCount(2);
 const before=await (await request.get('/api/workspace/health')).json();
 const response=page.waitForResponse(r=>r.url().endsWith('/api/workspace/run'));
 await send(page,'매출 차트의 지역을 한국으로 바꿔줘.');await response;
 await expect(page.locator('.chat-shell p').filter({hasText:/선택|어느|여러|두 개/}).first()).toBeVisible({timeout:60000});
 await expect(page.getByRole('complementary',{name:'Canvas 대시보드'})).toHaveAttribute('aria-busy','false');
 expect(await widgets(page)).toEqual(saved);const after=await (await request.get('/api/workspace/health')).json();expect(after.metrics.queryToolCalls).toBe(before.metrics.queryToolCalls);
});

test('interleaved partial SSE frames render each channel before final commits',async({page})=>{
 const items=[offlineWidgets[0],{...offlineWidgets[0],widgetId:'ads',title:'광고비',program:'root = Col([CanvasChart("광고비", "bar")])'}];
 await page.addInitScript(({items})=>{
  const original=window.fetch.bind(window);
  window.fetch=async(input,init)=>{
   if(String(input)!=='/api/workspace/run')return original(input,init);
   let sequence=0;const encoder=new TextEncoder();
   return new Response(new ReadableStream({start(controller){
    const emit=(event:Record<string,unknown>)=>{const bytes=encoder.encode(`data: ${JSON.stringify({runId:'interleaved',sequence:sequence++,...event})}\n\n`);const split=Math.floor(bytes.length/2);controller.enqueue(bytes.slice(0,split));controller.enqueue(bytes.slice(split));};
    emit({channel:'run',type:'start'});
    emit({channel:'chat',type:'delta',delta:'root = Col([Text("채팅 설명은 여기에 표시됩니다.")])'});
    for(const w of items)emit({channel:'canvas',type:'start',widgetId:w.widgetId,title:w.title,baseRevision:0});
    for(const w of [...items].reverse()){
     emit({channel:'canvas',type:'progress',widgetId:w.widgetId,snapshot:w.snapshot});
     emit({channel:'canvas',type:'delta',widgetId:w.widgetId,delta:w.program.slice(0,20)});
    }
    for(const w of items)emit({channel:'canvas',type:'delta',widgetId:w.widgetId,delta:w.program.slice(20)});
    window.addEventListener('complete-test-stream',()=>{
     for(const w of [...items].reverse())emit({channel:'canvas',type:'commit',widgetId:w.widgetId,baseRevision:0,widget:w});
     emit({channel:'run',type:'done'});controller.close();
    },{once:true});
   }}),{headers:{'Content-Type':'text/event-stream'}});
  };
 },{items});
 await page.goto('/');await send(page,'두 채널의 스트리밍을 보여줘');
 await expect(page.locator('.chat-shell p').filter({hasText:'채팅 설명은 여기에 표시됩니다.'})).toBeVisible();
 await expect(page.getByRole('complementary',{name:'Canvas 대시보드'}).locator('svg[role="img"]')).toHaveCount(2);
 await expect(page.getByTestId('canvas-widget')).toHaveCount(0);
 await expect(page.getByRole('complementary',{name:'Canvas 대시보드'})).toHaveAttribute('aria-busy','true');
 await page.evaluate(()=>window.dispatchEvent(new Event('complete-test-stream')));
 await expect(page.getByTestId('canvas-widget')).toHaveCount(2);
 await expect(page.getByRole('complementary',{name:'Canvas 대시보드'})).toHaveAttribute('aria-busy','false');
 const saved=await widgets(page);expect(saved.find((w:{widgetId:string})=>w.widgetId==='ads').program).toBe(items[1].program);
 expect(saved.find((w:{widgetId:string})=>w.widgetId==='offline-sales').program).toBe(items[0].program);
});

test('typed short Canvas request always displays a Chat acknowledgement',async({page})=>{
 await page.goto('/');
 await send(page,'매출과 광고비 Canvas');
 const reply=page.locator('.chat-shell p').filter({hasText:/Canvas|매출|광고비/}).first();
 await expect(reply).toBeVisible({timeout:60000});
 await expect(reply).toHaveText(/\S/);
 await expect(page.getByTestId('canvas-widget')).toHaveCount(2,{timeout:90000});
 await expect(page.getByRole('complementary',{name:'Canvas 대시보드'})).toHaveAttribute('aria-busy','false');
 await expect(reply).toBeVisible();
 await page.screenshot({path:'output/playwright/short-input-chat-fixed.png',fullPage:true});
});

test('thread Canvas tabs, resize, restore and actual Chat state context',async({page})=>{
 await page.addInitScript(({key,envelope,offlineWidgets})=>localStorage.setItem(key,JSON.stringify({...envelope,widgets:offlineWidgets})),{key,envelope,offlineWidgets});
 await page.goto('/');const cards=page.getByTestId('canvas-widget');await expect(cards).toHaveCount(1);
 let queries=0;page.on('request',r=>{if(r.url().includes('/api/workspace/query/'))queries++;});
 await page.getByLabel('매출 너비').selectOption('6');
 await page.getByLabel('매출 높이').fill('17');
 await page.getByRole('button',{name:'탭 추가',exact:true}).click();
 await page.getByLabel('탭 이름',{exact:true}).fill('광고 분석');await page.getByLabel('탭 이름',{exact:true}).press('Enter');
 await expect(cards).toHaveCount(0);await page.getByRole('tab',{name:'대시보드',exact:true}).click();
 await page.getByLabel('매출 탭 이동').selectOption({label:'광고 분석'});await expect(cards).toHaveCount(0);
 await page.getByRole('tab',{name:'광고 분석',exact:true}).click();await expect(cards).toHaveCount(1);
 expect((await widgets(page))[0].layout).toEqual({x:0,y:0,w:6,h:17});expect(queries).toBe(0);
 const handle=page.getByLabel('패널 크기 조절');await handle.scrollIntoViewIfNeeded();const box=(await handle.boundingBox())!;
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2,box.y+box.height/2+40);await page.mouse.up();
 await expect.poll(async()=>(await widgets(page))[0].layout.h).toBe(18);
 await page.getByLabel('매출 높이').fill('17');
 // Persist the fixture edits on reload instead of re-seeding.
 await page.evaluate(()=>localStorage.setItem('saved-fixture',localStorage.getItem('canvas-ux:thread-canvas:fixture-thread')!));
 await page.addInitScript(()=>{const saved=localStorage.getItem('saved-fixture');if(saved)localStorage.setItem('canvas-ux:thread-canvas:fixture-thread',saved);});
 await page.reload();await expect(page.getByRole('tab',{name:'광고 분석'})).toHaveAttribute('aria-selected','true');await expect(page.getByLabel('매출 너비')).toHaveValue('6');
 const before=await widgets(page);const sent=page.waitForRequest(r=>r.url().endsWith('/api/workspace/run'));
 await send(page,'현재 캔버스의 탭 이름, 활성 탭, 패널 수와 제목, 너비와 높이를 알려줘. 수정하거나 새로 조회하지 마.');
 const payload=(await sent).postDataJSON();expect(payload.threadId).toBe('fixture-thread');expect(payload.canvas.tabs.map((t:{title:string})=>t.title)).toEqual(['대시보드','광고 분석']);expect(payload.widgets[0].layout).toEqual({x:0,y:0,w:6,h:17});
 await expect(page.locator('.chat-shell p').filter({hasText:/17/}).first()).toBeVisible({timeout:60000});
 await expect(page.getByRole('complementary',{name:'Canvas 대시보드'})).toHaveAttribute('aria-busy','false');expect(await widgets(page)).toEqual(before);expect(queries).toBe(0);
 await page.getByRole('button',{name:'New chat',exact:true}).filter({visible:true}).click();await expect(cards).toHaveCount(0);await expect(page.getByRole('tab')).toHaveCount(1);
 await page.getByRole('button',{name:'탭 추가',exact:true}).click();await expect(page.getByRole('tab')).toHaveCount(2);
 await page.getByRole('button',{name:'New chat',exact:true}).filter({visible:true}).click();await expect(page.getByRole('tab')).toHaveCount(1);
 await page.route('**/api/workspace/run',route=>route.fulfill({contentType:'text/event-stream',body:[{channel:'chat',type:'delta',delta:'root = Col([Text("새 작업공간")])'},{channel:'canvas',type:'commit',widgetId:'second',baseRevision:0,widget:{...offlineWidgets[0],widgetId:'second',title:'두 번째 채팅 차트'}},{channel:'run',type:'done'}].map((e,i)=>`data: ${JSON.stringify({...e,sequence:i,runId:'second-run'})}\n\n`).join('')}));
 await send(page,'두 번째 분석');await expect(cards).toHaveCount(1);expect((await widgets(page))[0].title).toBe('두 번째 채팅 차트');
 const secondId=await page.evaluate(()=>localStorage.getItem('canvas-ux:active-thread'));expect(secondId).not.toBe('fixture-thread');
 await page.getByRole('button',{name:'Chat history',exact:true}).click();await page.getByRole('menuitem',{name:'저장된 분석'}).click();await expect(cards).toHaveCount(1);await expect(page.getByRole('tab',{name:'광고 분석'})).toHaveAttribute('aria-selected','true');
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'탭 삭제',exact:true}).click();await expect(cards).toHaveCount(0);await expect(page.getByRole('tab')).toHaveCount(1);
 await page.getByRole('button',{name:'Chat history',exact:true}).click();await page.getByRole('menuitem',{name:'두 번째 분석'}).click();await expect(cards).toHaveCount(1);expect((await widgets(page))[0].title).toBe('두 번째 채팅 차트');
 await cards.getByRole('button',{name:'삭제',exact:true}).click();await expect(cards).toHaveCount(0);
});

test('Chat charts add independently to Canvas and refresh without changing their source',async({page,request})=>{
 await page.goto('/');
 await send(page,'최근 3개월 한국 월별 매출과 광고비를 채팅 안에 각각 차트로 보여줘. Canvas에는 아직 추가하지 마.');
 const charts=page.getByTestId('analysis-chart');
 await expect(page.getByRole('complementary',{name:'Canvas 대시보드'})).toHaveAttribute('aria-busy','true');
 await expect(page.getByRole('complementary',{name:'Canvas 대시보드'})).toHaveAttribute('aria-busy','false',{timeout:90000});
 await expect(charts).toHaveCount(2);
 const canvas=page.getByRole('complementary',{name:'Canvas 대시보드'});await expect(canvas).toHaveAttribute('aria-busy','false');
 await expect(page.getByTestId('canvas-widget')).toHaveCount(0);
 const source=await page.evaluate(()=>{const id=localStorage.getItem('canvas-ux:active-thread')!;return JSON.parse(localStorage.getItem(`canvas-ux:artifacts:${encodeURIComponent(id)}`)!).artifacts;});
 const originalChat=await charts.allTextContents();
 await page.getByRole('button',{name:'탭 추가',exact:true}).click();await page.getByLabel('탭 이름',{exact:true}).fill('추가한 분석');await page.getByLabel('탭 이름',{exact:true}).press('Enter');
 const before=await (await request.get('/api/workspace/health')).json();
 await charts.first().getByRole('button',{name:/Canvas로 드래그/}).dragTo(canvas,{targetPosition:{x:20,y:50}});
 const cards=page.getByTestId('canvas-widget');await expect(cards).toHaveCount(1);
 const copied=(await widgets(page))[0];expect(source[copied.sourceArtifactId].queryId).toBe(copied.queryId);expect(source[copied.sourceArtifactId].snapshot).toEqual(copied.snapshot);
 const definition=await (await request.get(`/api/workspace/query/${copied.queryId}`)).json();expect(definition.sql).toBe(copied.queryDefinition.sql);expect(definition.resultSchema.columns).toHaveLength(2);
 await charts.first().getByRole('button',{name:'Canvas에서 보기'}).click();await expect(cards).toHaveCount(1);
 const added=await (await request.get('/api/workspace/health')).json();expect(added.metrics.modelCalls).toBe(before.metrics.modelCalls);expect(added.metrics.refreshCalls).toBe(before.metrics.refreshCalls);
 await cards.first().getByLabel(`${copied.title} 지역`).selectOption('US');
 await expect.poll(async()=>(await widgets(page))[0].snapshot.parameters.region).toBe('US');
 expect((await widgets(page))[0].queryId).toBe(copied.queryId);
 const after=await (await request.get('/api/workspace/health')).json();expect(after.metrics.modelCalls).toBe(before.metrics.modelCalls);
 expect((await charts.allTextContents())[1]).toBe(originalChat[1]);
 const currentSource=await page.evaluate(()=>{const id=localStorage.getItem('canvas-ux:active-thread')!;return JSON.parse(localStorage.getItem(`canvas-ux:artifacts:${encodeURIComponent(id)}`)!).artifacts;});expect(currentSource).toEqual(source);
 await page.reload();await expect(charts).toHaveCount(2);await expect(cards).toHaveCount(1);await expect(cards.first().getByLabel(`${copied.title} 지역`)).toHaveValue('US');
 await charts.nth(1).getByRole('button',{name:'Add to Canvas',exact:true}).click();await expect(cards).toHaveCount(2);
 await page.getByRole('button',{name:'New chat',exact:true}).filter({visible:true}).click();await expect(cards).toHaveCount(0);await expect(charts).toHaveCount(0);
 await page.screenshot({path:'output/playwright/add-to-canvas-thread-isolation.png',fullPage:true});
});
