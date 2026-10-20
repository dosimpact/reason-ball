import {test,expect} from '@playwright/test';

test('splitter: live mouse resize, limits, cancel and reset preserve the workspace',async({page})=>{
 let requests=0;page.on('request',r=>{if(r.url().includes('/api/workspace/'))requests++;});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');const handle=page.getByRole('separator',{name:'Chat과 Canvas 너비 조절'});
 const chat=page.locator('.chat-shell');const canvas=page.getByRole('complementary',{name:'Canvas 대시보드'});
 const input=page.getByPlaceholder('Ask anything...').filter({visible:true});await input.fill('아직 보내지 않은 입력');
 await expect(handle).toHaveAttribute('aria-valuenow','50');
 const original=(await chat.boundingBox())!.width;const rect=(await handle.boundingBox())!;
 await page.mouse.move(rect.x+rect.width/2,400);await page.mouse.down();await page.mouse.move(rect.x+200,400,{steps:8});
 await expect.poll(async()=>(await chat.boundingBox())!.width).toBeGreaterThan(original+150);
 await expect(page.locator('.workspace-shell')).toHaveClass(/workspace-resizing/);
 await page.mouse.up();await expect(page.locator('.workspace-shell')).not.toHaveClass(/workspace-resizing/);
 await expect(input).toHaveValue('아직 보내지 않은 입력');
 const beforeCancel=(await chat.boundingBox())!.width;const next=(await handle.boundingBox())!;
 await page.mouse.move(next.x+5,400);await page.mouse.down();await page.mouse.move(next.x-160,400,{steps:5});await page.keyboard.press('Escape');await page.mouse.up();
 await expect.poll(async()=>Math.abs((await chat.boundingBox())!.width-beforeCancel)).toBeLessThan(2);
 for(const x of [0,1599]){
  const box=(await handle.boundingBox())!;await page.mouse.move(box.x+5,400);await page.mouse.down();await page.mouse.move(x,400,{steps:8});await page.mouse.up();
  expect((await chat.boundingBox())!.width).toBeGreaterThanOrEqual(429);expect((await canvas.boundingBox())!.width).toBeGreaterThanOrEqual(429);
 }
 await handle.dblclick();await expect(handle).toHaveAttribute('aria-valuenow','50');
 await expect(input).toHaveValue('아직 보내지 않은 입력');expect(requests).toBe(0);expect(errors).toEqual([]);
 await page.screenshot({path:'output/playwright/splitter.png'});
});

test('splitter: keyboard controls and mobile stacking',async({page})=>{
 await page.goto('/');const handle=page.getByRole('separator',{name:'Chat과 Canvas 너비 조절'});
 await handle.focus();await handle.press('ArrowRight');await expect(handle).toHaveAttribute('aria-valuenow','52');
 await handle.press('ArrowLeft');await expect(handle).toHaveAttribute('aria-valuenow','50');
 await handle.press('Home');await expect(handle).toHaveAttribute('aria-valuenow',await handle.getAttribute('aria-valuemin')||'');
 await handle.press('End');await expect(handle).toHaveAttribute('aria-valuenow',await handle.getAttribute('aria-valuemax')||'');
 await handle.press('Enter');await expect(handle).toHaveAttribute('aria-valuenow','50');
 await page.setViewportSize({width:800,height:1000});await expect(handle).toBeHidden();
 const chat=(await page.locator('.chat-shell').boundingBox())!;const canvas=(await page.getByRole('complementary',{name:'Canvas 대시보드'}).boundingBox())!;
 expect(canvas.y).toBeGreaterThanOrEqual(chat.y+chat.height);expect(canvas.width).toBeLessThanOrEqual(800);
 await page.setViewportSize({width:1100,height:1000});await expect(handle).toBeVisible();await expect(handle).toHaveAttribute('aria-valuenow','50');
});
