import {test,expect,type Page} from '@playwright/test';
const thread='grafana-grid';
async function doc(page:Page){return page.evaluate(t=>JSON.parse(localStorage.getItem(`canvas-ux:thread-canvas:${t}`)||'{}'),thread);}
async function seed(page:Page){await page.addInitScript(t=>{
 if(localStorage.getItem('grafana-seeded'))return;localStorage.setItem('grafana-seeded','1');
 localStorage.setItem('canvas-ux:threads',JSON.stringify([{id:t,title:'Grid regression',createdAt:'2026-10-19T00:00:00Z'}]));localStorage.setItem('canvas-ux:active-thread',t);
 localStorage.setItem(`canvas-ux:messages:${t}`,JSON.stringify([{id:'u',role:'user',content:'Grid'},{id:'a',role:'assistant',content:'root = Col([Text("Grid regression")])'}]));
 localStorage.setItem(`canvas-ux:thread-canvas:${t}`,JSON.stringify({schemaVersion:4,threadId:t,tabs:[{id:'main',title:'대시보드'},{id:'other',title:'다른 탭'}],activeTabId:'main',selectedWidgetId:null,widgets:['A','B'].map(id=>({kind:'registered',registrationId:'openui',registrationVersion:1,sourceId:id,widgetId:id,schemaVersion:1,catalogVersion:1,definitionRevision:1,title:id,program:'$name = ""\nroot = Col([Input($name, "이름")])',uiState:{name:id},tabId:'main',layout:{w:6,h:8}}))}));
 },thread);}
function overlaps(a:{x:number;y:number;w:number;h:number},b:{x:number;y:number;w:number;h:number}){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
test('Grafana: migration, resize collision, coordinate drag, gravity, reload and narrow projection',async({page})=>{
 await seed(page);let calls=0;const errors:string[]=[];page.on('request',r=>{if(/\/api\/workspace\/(run|query)/.test(r.url()))calls++;});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');const cards=page.getByTestId('canvas-widget');await expect(cards).toHaveCount(2);
 await expect(cards.first().locator('.canvas-grid-size')).toHaveText('12 × 10');
 const grid=await page.locator('.canvas-grid').boundingBox();const pitch=(grid!.width+8)/24;
 const handle=page.locator('.canvas-grid-slot').first().getByLabel('패널 크기 조절');await expect(handle).toHaveCSS('opacity','1');const box=await handle.boundingBox();const before=await cards.first().boundingBox();
 await page.mouse.move(box!.x+14,box!.y+14);await page.mouse.down();await page.mouse.move(box!.x+14+pitch*6,box!.y+14+38,{steps:15});
 expect((await cards.first().boundingBox())!.width).toBeGreaterThan(before!.width);await expect(page.locator('.react-grid-placeholder')).toBeVisible();await page.mouse.up();
 let saved=await doc(page);expect(saved.schemaVersion).toBe(5);expect(saved.widgets[0].layout.w).toBe(18);expect(saved.widgets[0].layout.h).toBe(11);expect(saved.widgets[1].layout.y).toBeGreaterThan(0);expect(overlaps(saved.widgets[0].layout,saved.widgets[1].layout)).toBe(false);
 const move=cards.first().getByRole('button',{name:'A 위치 이동'});const m=await move.boundingBox();await page.mouse.move(m!.x+12,m!.y+12);await page.mouse.down();await page.mouse.move(m!.x+12+pitch*6,m!.y+12,{steps:15});await page.mouse.up();
 saved=await doc(page);expect(saved.widgets[0].layout.x).toBe(6);expect(saved.widgets[0].definitionRevision).toBe(1);expect(saved.widgets[0].uiState.name).toBe('A');
 const cancelHandle=page.locator('.canvas-grid-slot').first().getByLabel('패널 크기 조절');const cb=await cancelHandle.boundingBox();await page.mouse.move(cb!.x+14,cb!.y+14);await page.mouse.down();await page.mouse.move(cb!.x+14,cb!.y+90,{steps:6});await page.keyboard.press('Escape');await page.mouse.up();expect((await doc(page)).widgets).toEqual(saved.widgets);
 await page.reload();await expect(cards).toHaveCount(2);expect((await doc(page)).widgets).toEqual(saved.widgets);
 await page.setViewportSize({width:550,height:1000});await expect(page.locator('.react-resizable-handle').first()).toBeHidden();expect((await doc(page)).widgets).toEqual(saved.widgets);
 await page.setViewportSize({width:1600,height:1050});await cards.first().getByRole('button',{name:'삭제',exact:true}).click();await expect(cards).toHaveCount(1);expect((await doc(page)).widgets[0].layout.y).toBe(0);
 expect(calls).toBe(0);expect(errors).toEqual([]);await page.screenshot({path:'output/playwright/grafana-grid.png',fullPage:true});
});
test('Grafana: tab transfer preserves content and confines layout updates',async({page})=>{
 await seed(page);await page.goto('/');const cards=page.getByTestId('canvas-widget');await expect(cards).toHaveCount(2);
 await cards.first().getByLabel('이름',{exact:true}).fill('A');
 await cards.first().getByLabel('A 탭 이동').selectOption('other');await expect(cards).toHaveCount(1);const b=(await doc(page)).widgets.find((w:{widgetId:string})=>w.widgetId==='B');
 await page.getByRole('tab',{name:'다른 탭',exact:true}).click();await expect(cards).toHaveCount(1);await expect(cards.getByLabel('이름',{exact:true})).toHaveValue('A');
 await cards.getByRole('button',{name:'A 위치 이동'}).press('ArrowRight');
 expect((await doc(page)).widgets.find((w:{widgetId:string})=>w.widgetId==='B')).toEqual(b);
 await page.reload();await expect(cards.getByLabel('이름',{exact:true})).toHaveValue('A');
});

test('Grafana: external Chat drop uses coordinates and splitter reflows without changing saved layout',async({page})=>{
 await seed(page);await page.addInitScript(t=>localStorage.setItem(`canvas-ux:messages:${t}`,JSON.stringify([{id:'a',role:'assistant',content:'root = Col([CanvasItem("openui", "C", "root = Col([Text(\\"새 카드\\")])")])'}])),thread);
 await page.goto('/');const source=page.getByTestId('canvas-registration');await expect(source).toHaveCount(1);
 const grid=page.locator('.canvas-grid');const area=await grid.boundingBox();
 await source.getByRole('button',{name:'C Canvas로 드래그'}).dragTo(grid,{targetPosition:{x:area!.width*.55,y:20}});
 const cards=page.getByTestId('canvas-widget');await expect(cards).toHaveCount(3);
 const saved=await doc(page);const added=saved.widgets.find((w:{title:string})=>w.title==='C');expect(added.layout.x).toBe(12);
 const before=await cards.first().boundingBox();const splitter=page.getByRole('separator',{name:'Chat과 Canvas 너비 조절'});const box=await splitter.boundingBox();
 await page.mouse.move(box!.x+5,box!.y+100);await page.mouse.down();await page.mouse.move(box!.x-100,box!.y+100,{steps:12});await page.mouse.up();
 await expect.poll(async()=>(await cards.first().boundingBox())!.width).toBeGreaterThan(before!.width+30);
 expect((await doc(page)).widgets).toEqual(saved.widgets);
 await page.screenshot({path:'output/playwright/grafana-grid-expanded.png',fullPage:true});
});
