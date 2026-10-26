import { test, expect, type Page } from '@playwright/test';
import { createParser } from '@openuidev/lang-core';
import spec from '../src/shared/ui/openui/generated/spec.json';

const hybrid = `root = Card([CardHeader("Combined regression", "6-2 preserved + 6-3 additions"), table, controls, drawing], [{title:"Fixture source", sourceName:"Test report · Page 1", url:"https://example.com/report.pdf#page=1"}])
table = Table([Col("Company", ["Demo"]), Col("Revenue", [100])])
$count = 0
$amount = 10
controls = VStack([IuiText("Count: " + $count), IuiButton("Increment", @Set($count, $count + 1)), IuiInput($amount, "Amount", "number"), IuiText("Double: " + ($amount * 2)), IuiText(@Join(@IuiSlice(["Alpha", "Beta", "Gamma"], 0, 2), ", ")), Button("Copy evidence", @CopyToClipboard("Fixture evidence"))])
drawing = Svg([Circle(50, 50, 20, "info")], "0 0 100 100", 100, 100)`;

async function send(page: Page, question: string) {
  const response = page.waitForResponse(r => r.url().endsWith('/api/chat') && r.request().method() === 'POST', {timeout:180_000});
  await page.locator('textarea:visible').fill(question);
  await page.getByRole('button', { name: /^Send(?: message)?$/ }).click();
  const result = await response;
  expect(result.status()).toBe(200);
  const raw = await result.text();
  const events = raw.split(/\r?\n/).filter(l => l.startsWith('data:')).map(l => JSON.parse(l.slice(5)));
  expect(events.filter(e => e.type === 'RUN_ERROR')).toEqual([]);
  expect(events.at(-1)?.type).toBe('RUN_FINISHED');
  const text = events.filter(e => e.type === 'TEXT_MESSAGE_CONTENT').map(e => e.delta).join('');
  const parsed = createParser(spec.schema, spec.root).parse(text);
  expect(parsed.meta.errors, text).toEqual([]);
  expect(parsed.meta.unresolved, text).toEqual([]);
  expect(parsed.root).not.toBeNull();
  await test.info().attach('provider-events', { body: raw, contentType: 'text/plain' });
  return events;
}

test('MERGE-101 original table/sources, reactive controls, function alias, SVG and clipboard coexist', async ({page, context}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(code => { Object.assign(window, {__OPENUI_PROGRAM__: code}); }, hybrid);
  await page.goto('/preview');
  await expect(page.getByText('Combined regression', {exact:true})).toBeVisible();
  await expect(page.getByRole('cell', {name:'Demo', exact:true})).toBeVisible();
  await page.getByRole('button', {name:'Increment', exact:true}).click();
  await expect(page.getByText('Count: 1', {exact:true})).toBeVisible();
  await page.getByRole('textbox', {name:'Amount'}).fill('25');
  await expect(page.getByText('Double: 50', {exact:true})).toBeVisible();
  await expect(page.getByText('Alpha, Beta', {exact:true})).toBeVisible();
  await expect(page.locator('svg.iui-svg circle')).toHaveCount(1);
  await page.getByRole('button', {name:'Copy evidence', exact:true}).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('Fixture evidence');
  expect(await page.evaluate(() => (window as unknown as {__OPENUI_ERRORS__?:string[]}).__OPENUI_ERRORS__ ?? [])).toEqual([]);
  await page.screenshot({path:test.info().outputPath('combined.png'), fullPage:true});
});

test('MERGE-102 migrated gallery renders all examples in both themes', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', e=> errors.push(e.message));
  for (const theme of ['light','dark']) {
    await page.goto(`/gallery?theme=${theme}`, {waitUntil:'domcontentloaded'});
    await expect(page.getByRole('heading', {name:'Integrated OpenUI catalog'})).toBeVisible();
    await expect(page.locator('.gallery-example')).toHaveCount(45);
    await expect(page.locator('.gallery-errors')).toHaveCount(0);
    await expect(page.locator('.gallery-preview').last()).toBeVisible();
    await page.screenshot({path:test.info().outputPath(`gallery-${theme}.png`)});
  }
  expect(errors).toEqual([]);
});

test('DOC-002/004 real document comparison, follow-up and SQLite reload', async ({page, request}) => {
  await page.goto('/comparison');
  await page.getByRole('button',{name:'Expand sidebar'}).click();
  await page.getByRole('button',{name:'Documents',exact:true}).click();
  await expect(page.getByText('NVIDIA', {exact:false}).first()).toBeVisible();
  const docs = await (await request.get('/api/documents')).json();
  // Historical reports and user PDFs may coexist with the required comparison sources.
  expect(docs.documents.map((document: {id: string}) => document.id)).toEqual(
    expect.arrayContaining(['nvidia', 'amd', 'intel']),
  );
  await page.getByRole('button',{name:'New chat',exact:true}).click();
  const created = page.waitForResponse(r=>r.url().endsWith('/api/threads/create'));
  const events = await send(page, 'Compare latest total revenue for NVIDIA and AMD. Search documents, show a Table with pages, a chart, and Card sources.');
  const thread = await (await created).json();
  try {
    expect(events.some(e=>e.type==='TOOL_CALL_START' && e.toolCallName==='search_documents')).toBe(true);
    await expect(page.getByRole('table').first()).toBeVisible();
    const saved = await (await request.get(`/api/threads/get/${thread.id}`)).json();
    expect(saved.some((m:{role:string})=>m.role==='tool')).toBe(true);
    expect(JSON.stringify(saved)).toContain('#page=');
    await request.patch(`/api/threads/update/${thread.id}`, {data:{title:'E2E restored comparison'}});
    await page.reload();
    if (await page.getByRole('button',{name:'Expand sidebar'}).count()) await page.getByRole('button',{name:'Expand sidebar'}).click();
    await page.getByRole('button',{name:'E2E restored comparison',exact:true}).click();
    await expect(page.getByRole('table').first()).toBeVisible();
    await send(page, 'For those same companies compare research and development spending too. Search and cite pages.');
    const later = await (await request.get(`/api/threads/get/${thread.id}`)).json();
    expect(later.length).toBeGreaterThan(saved.length);
    await page.screenshot({path:test.info().outputPath('document-comparison.png'),fullPage:true});
  } finally { await request.delete(`/api/threads/delete/${thread.id}`); }
});

test('MERGE-103 actual model generates a working integrated counter', async ({page, request}) => {
  await page.goto('/comparison');
  const created = page.waitForResponse(r=>r.url().endsWith('/api/threads/create'));
  await send(page, 'Create a standalone demo counter without searching documents. Use root Card containing VStack, $count = 0, IuiText("Live count: " + $count), and IuiButton("Add one", @Set($count, $count + 1)). Use default sizes. Label it Demo counter.');
  const thread = await (await created).json();
  try {
    await page.getByRole('button',{name:'Add one',exact:true}).click();
    await expect(page.getByText('Live count: 1',{exact:true})).toBeVisible();
    await page.screenshot({path:test.info().outputPath('live-counter.png'),fullPage:true});
    await request.patch(`/api/threads/update/${thread.id}`, {data:{title:'E2E restored counter'}});
    await page.reload();
    if (await page.getByRole('button',{name:'Expand sidebar'}).count()) await page.getByRole('button',{name:'Expand sidebar'}).click();
    await page.getByRole('button',{name:'E2E restored counter',exact:true}).click();
    await expect(page.getByRole('button',{name:'Add one',exact:true})).toBeVisible();
  } finally { await request.delete(`/api/threads/delete/${thread.id}`); }
});
