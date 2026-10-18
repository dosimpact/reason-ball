import {test,expect,type Page} from '@playwright/test';
const thread='registry-test';
const programs=[
 {title:'노트',program:'root = Col([Markdown("**핵심 인사이트**: 등록된 노트")])'},
 {title:'비교표',program:'root = Col([Table(["항목", "값"], [["A", 10], ["B", 20]])])'},
 {title:'입력폼',program:'root = Col([Input($name, "이름"), Text($name)])\n$name = "초기값"'},
];
async function seed(page:Page){await page.addInitScript(({thread,programs})=>{
 if(localStorage.getItem('registry-test-seeded'))return;localStorage.setItem('registry-test-seeded','1');
 localStorage.setItem('canvas-ux:threads',JSON.stringify([{id:thread,title:'등록 요소 검증',createdAt:'2026-10-18T00:00:00Z'}]));localStorage.setItem('canvas-ux:active-thread',thread);
 const content='root = Col(['+programs.map(p=>`CanvasItem("openui", ${JSON.stringify(p.title)}, ${JSON.stringify(p.program)})`).join(', ')+'])';
 localStorage.setItem(`canvas-ux:messages:${thread}`,JSON.stringify([{id:'q',role:'user',content:'노트, 비교표, 입력폼'},{id:'a',role:'assistant',content}]));
 },{thread,programs});}
async function document(page:Page){return page.evaluate(thread=>JSON.parse(localStorage.getItem(`canvas-ux:thread-canvas:${thread}`)||'{"widgets":[]}'),thread);}

test('REG/DND: Chat wrappers add, delete, drag, reorder, transfer, resize and restore without SQL or model',async({page})=>{
 await seed(page);let backendRequests=0;page.on('request',r=>{if(/\/api\/workspace\/(run|query)/.test(r.url()))backendRequests++;});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');const wrappers=page.getByTestId('canvas-registration');await expect(wrappers).toHaveCount(3);
 const canvas=page.getByRole('complementary',{name:'Canvas 대시보드'});const cards=page.getByTestId('canvas-widget');
 await wrappers.nth(0).getByRole('button',{name:'Add to Canvas',exact:true}).click();await expect(cards).toHaveCount(1);
 await wrappers.nth(0).getByRole('button',{name:'Canvas에서 보기',exact:true}).click();await expect(cards).toHaveCount(1);
 await wrappers.nth(1).getByRole('button',{name:'비교표 Canvas로 드래그'}).dragTo(canvas,{targetPosition:{x:20,y:50}});
 await expect(cards).toHaveCount(2);await expect(cards.nth(1).getByRole('table')).toBeVisible();
 await wrappers.nth(2).getByLabel('이름',{exact:true}).fill('Chat 입력');
 await wrappers.nth(2).getByRole('button',{name:'Add to Canvas',exact:true}).click();await expect(cards).toHaveCount(3);
 await expect(cards.nth(2).getByLabel('이름',{exact:true})).toHaveValue('Chat 입력');
 await cards.nth(2).getByLabel('이름',{exact:true}).fill('Canvas 입력');await expect(wrappers.nth(2).getByLabel('이름',{exact:true})).toHaveValue('Chat 입력');
 const before=await document(page);expect(before.schemaVersion).toBe(5);expect(before.widgets.every((w:Record<string,unknown>)=>!('queryId' in w))).toBe(true);
 for(const item of programs){await canvas.getByLabel(`${item.title} 너비`).selectOption('4');await canvas.getByLabel(`${item.title} 높이`).press('Home');}
 await cards.nth(2).getByRole('button',{name:'입력폼 이동',exact:true}).dragTo(cards.first());
 await expect(cards.first().getByLabel('이름',{exact:true})).toHaveValue('Canvas 입력');
 await cards.first().getByRole('button',{name:'입력폼 이동',exact:true}).press('Alt+ArrowDown');
 await expect(cards.nth(1).getByLabel('이름',{exact:true})).toHaveValue('Canvas 입력');
 await cards.first().getByLabel('노트 너비').selectOption('6');await cards.nth(1).getByLabel('입력폼 너비').selectOption('6');
 await expect.poll(async()=>{const a=await cards.first().boundingBox();const b=await cards.nth(1).boundingBox();return a!.x+a!.width<=b!.x+1||b!.x+b!.width<=a!.x+1||a!.y+a!.height<=b!.y+1||b!.y+b!.height<=a!.y+1;}).toBe(true);
 await page.getByRole('button',{name:'탭 추가',exact:true}).click();const target=page.getByRole('tab',{name:'탭 2',exact:true});await page.getByRole('tab',{name:'대시보드',exact:true}).click();
 await cards.filter({has:page.getByRole('button',{name:'비교표 이동',exact:true})}).getByRole('button',{name:'비교표 이동',exact:true}).dragTo(target);
 await expect(cards).toHaveCount(2);await target.click();await expect(cards).toHaveCount(1);await expect(cards.first().getByRole('table')).toBeVisible();
 await page.getByRole('tab',{name:'대시보드',exact:true}).click();
 await wrappers.first().getByRole('button',{name:'Delete from Canvas'}).click();await expect(cards).toHaveCount(1);
 await wrappers.first().getByRole('button',{name:'Add to Canvas',exact:true}).click();await expect(cards).toHaveCount(2);
 await page.reload();await expect(cards).toHaveCount(2);await expect(canvas.getByLabel('이름',{exact:true})).toHaveValue('Canvas 입력');
 expect(backendRequests).toBe(0);expect(errors).toEqual([]);
 await page.screenshot({path:'output/playwright/registry-dnd.png',fullPage:true});
});

test('DND: rejects cross-thread and malformed drops; deleted widgets can be added again',async({page})=>{
 await seed(page);await page.goto('/');const canvas=page.getByRole('complementary',{name:'Canvas 대시보드'});
 await expect(page.getByTestId('canvas-registration').first().getByRole('button',{name:'Add to Canvas',exact:true})).toBeEnabled();
 const transfer=await page.evaluateHandle(()=>new DataTransfer());
 await transfer.evaluate(dt=>dt.setData('application/x-openui-canvas',JSON.stringify({version:1,threadId:'another-thread',type:'registered',content:{}})));
 await canvas.dispatchEvent('drop',{dataTransfer:transfer});await expect(page.getByTestId('canvas-widget')).toHaveCount(0);await expect(canvas.getByRole('status')).toContainText('놓을 수 없는');
 await transfer.evaluate(dt=>dt.setData('application/x-openui-canvas','not JSON'));await canvas.dispatchEvent('drop',{dataTransfer:transfer});
 await expect(page.getByTestId('canvas-widget')).toHaveCount(0);
 await page.getByTestId('canvas-registration').first().getByRole('button',{name:'Add to Canvas',exact:true}).click();
 await page.getByTestId('canvas-widget').getByRole('button',{name:'삭제',exact:true}).click();
 await expect(page.getByTestId('canvas-registration').first().getByRole('button',{name:'Add to Canvas',exact:true})).toBeEnabled();
 await transfer.dispose();
});

test('REG live: Python/provider creates reusable Chat content and directly creates/updates Canvas content',async({page})=>{
 await seed(page);await page.goto('/');
 const send=async(text:string)=>{const input=page.getByPlaceholder('Ask anything...').filter({visible:true});await input.fill(text);await input.press('Enter');};
 const canvas=page.getByRole('complementary',{name:'Canvas 대시보드'});
 await send('채팅에 CanvasItem으로 등록 가능한 텍스트 노트 하나 만들어줘. 제목은 주간 메모, 내용은 이번 주 계획 검토. Add to Canvas가 필요해. 아직 Canvas에 추가하지 마.');
 const wrappers=page.getByTestId('canvas-registration');await expect(wrappers).toHaveCount(4,{timeout:120000});await expect(canvas).toHaveAttribute('aria-busy','false',{timeout:120000});
 await wrappers.last().getByRole('button',{name:'Add to Canvas',exact:true}).click();await expect(page.getByTestId('canvas-widget')).toHaveCount(1);
 await send('Canvas에 새 일반 텍스트 카드 하나 직접 생성해줘. 차트나 SQL은 필요 없어. 제목은 작업 체크, 내용은 테스트 실행하기.');
 await expect(page.getByTestId('canvas-widget')).toHaveCount(2,{timeout:120000});await expect(canvas).toHaveAttribute('aria-busy','false',{timeout:120000});
 const initial=await document(page);expect(initial.widgets.every((w:{kind:string})=>w.kind==='registered')).toBe(true);
 const target=initial.widgets[1];await page.locator(`[data-widget-id="${target.widgetId}"]`).getByRole('button',{name:/선택:/}).click();
 await send('선택한 일반 텍스트 카드의 내용만 문서 정리하기로 변경해줘. 제목과 다른 카드는 유지해줘.');
 await expect.poll(async()=>(await document(page)).widgets[1].definitionRevision,{timeout:120000}).toBe(2);
 const updated=await document(page);expect(updated.widgets[0]).toEqual(initial.widgets[0]);expect(updated.widgets[1].program).toContain('문서 정리하기');
 await page.screenshot({path:'output/playwright/registry-live.png',fullPage:true});
});

test('REG regression: original Korean memo/form request renders editable reusable content',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 const input=page.getByPlaceholder('Ask anything...').filter({visible:true});
 await input.fill('채팅에 Canvas에 추가할 수 있는 메모와 입력 폼을 만들어줘');await input.press('Enter');
 const canvas=page.getByRole('complementary',{name:'Canvas 대시보드'});
 const wrappers=page.getByTestId('canvas-registration');
 await expect(wrappers.first()).toBeVisible({timeout:120000});
 await expect(canvas).toHaveAttribute('aria-busy','false',{timeout:120000});
 await expect(page.getByText('독립 OpenUI 프로그램을 생성하지 못했습니다.',{exact:false})).toHaveCount(0);
 await expect(page.getByText('Canvas 콘텐츠 준비 중이거나 등록 형식이 올바르지 않습니다.')).toHaveCount(0);
 const field=wrappers.getByRole('textbox').first();await expect(field).toBeVisible();await field.fill('회귀 검증 입력');
 const count=await wrappers.count();
 for(let i=0;i<count;i++)await wrappers.nth(i).getByRole('button',{name:'Add to Canvas',exact:true}).click();
 await expect(page.getByTestId('canvas-widget')).toHaveCount(count);
 await expect(page.getByTestId('canvas-widget').getByRole('textbox').filter({visible:true}).first()).toHaveValue('회귀 검증 입력');
 await page.reload();await expect(page.getByTestId('canvas-widget')).toHaveCount(count);
 await expect(page.getByTestId('canvas-widget').getByRole('textbox').filter({visible:true}).first()).toHaveValue('회귀 검증 입력');
 expect(errors).toEqual([]);
 await page.screenshot({path:'output/playwright/registry-form-fix.png',fullPage:true});
});
