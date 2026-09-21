/** Actual MCP smoke. Requires two independently authenticated, disposable accounts.
 * The learner must have no previous assignments. The manager must be registered
 * by an authorized server-side fixture. Credentials never enter MCP commands.
 * Required: PLAYWRIGHT_MCP_HOME, MCP_LEARNER_STORAGE_STATE,
 * MCP_MANAGER_STORAGE_STATE, MISSION_CATALOG_OWNER_ID. Run after readiness=true.
 * Account creation/deletion and direct Data API RLS checks are separate fixtures.
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { importId } from './import-mapper.mjs';

function sanitize(value) {
  if (typeof value === 'string') return value.replace(/(?:cookie|authorization):[^\n]*/gi, '[REDACTED HEADER]');
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key,item]) => [key, sanitize(item)]));
  return value;
}

const base = process.env.MCP_BASE_URL ?? 'http://dodonet.iptime.org:13000';
const home = process.env.PLAYWRIGHT_MCP_HOME;
const owner = process.env.MISSION_CATALOG_OWNER_ID;
const output = resolve(process.env.PLAYWRIGHT_MCP_EVIDENCE ?? '/tmp/mission-catalog-mcp-smoke');
for (const name of ['PLAYWRIGHT_MCP_HOME', 'MISSION_CATALOG_OWNER_ID', 'MCP_LEARNER_STORAGE_STATE', 'MCP_MANAGER_STORAGE_STATE']) {
  if (!process.env[name]) throw new Error(`Required environment variable: ${name}`);
}
const dependency = path => pathToFileURL(resolve(home, 'node_modules', path)).href;
const { Client } = await import(dependency('@modelcontextprotocol/sdk/dist/esm/client/index.js'));
const { StdioClientTransport } = await import(dependency('@modelcontextprotocol/sdk/dist/esm/client/stdio.js'));
const catalogs = ['daily', 'travel', 'social', 'work'].flatMap(category => JSON.parse(readFileSync(`assets/missions/${category}/catalog.json`, 'utf8')).missions);
const expectedIds = catalogs.map(item => importId(owner, item.key, 'mission'));
const work = catalogs.filter(item => item.categoryId === 'work');
const samples = [catalogs.find(item => item.difficulty === 'pre-A1'), ...['-developer-', '-designer-', '-it-', '-business-'].map(marker => work.find(item => item.key.includes(marker)))];
if (samples.some(item => !item)) throw new Error('Expected sample is missing from the authored catalog.');
mkdirSync(output, {recursive:true,mode:0o700});
const report = { startedAt: new Date().toISOString(), base, expectedCatalogCount: expectedIds.length, checks: [] };

async function session(kind, state, action) {
  const directory = resolve(output, kind);
  mkdirSync(directory, {recursive:true,mode:0o700});
  const client = new Client({name:`mission-${kind}-smoke`,version:'1.0.0'});
  const transport = new StdioClientTransport({command:process.execPath,args:[resolve(home,'node_modules/@playwright/mcp/cli.js'),'--headless','--isolated','--browser','chrome','--storage-state',resolve(state),'--output-dir',directory],stderr:'pipe'});
  await client.connect(transport);
  report.server = client.getServerVersion();
  async function call(name, args, label) {
    const result = await client.callTool({name,arguments:args},undefined,{timeout:180000});
    writeFileSync(resolve(directory, `${String(report.checks.length).padStart(2,'0')}-${label}.json`), JSON.stringify(sanitize(result),null,2));
    if (result.isError) throw new Error(`${kind}/${label}: MCP reported failure`);
    report.checks.push({kind,label,status:'PASS'});
    return result;
  }
  const run = (body,label) => call('browser_run_code_unsafe',{code:`async (page) => { ${body} }`},label);
  try { await action({call,run}); } finally { await client.close(); }
}

try {
  await session('manager',process.env.MCP_MANAGER_STORAGE_STATE,async ({call,run}) => {
    await call('browser_navigate',{url:`${base}/missions`},'navigate');
    await call('browser_snapshot',{},'observed-list');
    await run(`const started=Date.now(); const r=await page.request.get(${JSON.stringify(base+'/api/missions')},{timeout:30000}); if(!r.ok()) throw new Error('Catalog API failed'); const {items}=await r.json(); const forbidden=new Set(['catalogImport','directorPrompt','evaluatorPrompt','source']); const walk=value=>{ if(value&&typeof value==='object') for(const [key,nested] of Object.entries(value)){if(forbidden.has(key)) throw new Error('Private field leaked: '+key); walk(nested);} }; walk(items); const ids=new Set(items.map(x=>x.id)); const missing=${JSON.stringify(expectedIds)}.filter(id=>!ids.has(id)); if(missing.length) throw new Error('Missing authored missions: '+missing.length); return {elapsedMs:Date.now()-started,total:items.length,authoredCount:${expectedIds.length},missing:0,privateFieldsAbsent:true};`,'catalog-completeness');
    for (const sample of (process.env.MCP_FINAL_VERIFICATION === '1' ? [] : samples)) {
      const id=importId(owner,sample.key,'mission');
      await run(`await page.getByRole('searchbox',{name:'미션 검색',exact:true}).fill(${JSON.stringify(sample.title)}); await page.getByRole('link',{name:${JSON.stringify(sample.title+' 미션 상세 보기')},exact:true}).waitFor(); await page.getByRole('link',{name:${JSON.stringify(sample.title+' 미션 상세 보기')},exact:true}).click(); await page.waitForURL('**/missions/'+${JSON.stringify(id)}); await page.getByRole('heading',{name:${JSON.stringify(sample.title)},level:1,exact:true}).waitFor(); if(!page.url().includes(${JSON.stringify(id)})) throw new Error('Wrong mission detail'); const visible=await page.locator('main').innerText(); if(visible.includes('\"professionalRole\":')||visible.includes('\"caseBrief\":')) throw new Error('Raw case JSON visible'); return {title:${JSON.stringify(sample.title)},url:page.url()};`,'sample-'+sample.key);
      await call('browser_snapshot',{target:'main'},'detail-'+sample.key);
      await call('browser_navigate',{url:`${base}/missions`},'return-list');
    }
  });
  await session('learner',process.env.MCP_LEARNER_STORAGE_STATE,async ({call,run}) => {
    await call('browser_navigate',{url:`${base}/profile`},'profile');
    await run(`await page.getByRole('tab',{name:'설정',exact:true}).click(); await page.getByRole('combobox',{name:'학습자 레벨',exact:true}).selectOption('B1'); await page.getByRole('checkbox',{name:'관심 상황 직장',exact:true}).check(); await page.getByRole('button',{name:'설정 저장',exact:true}).click(); await page.getByText('학습 설정을 저장했어요.',{exact:true}).waitFor(); return {saved:true};`,'profile-save');
    await call('browser_navigate',{url:`${base}/missions`},'assigned-list');
    await run(`const r=await page.request.post(${JSON.stringify(base+'/api/me/mission-assignments')},{headers:{Origin:${JSON.stringify(base)}},data:{}}); const body=await r.json(); if(!r.ok()||body.provisioning?.mode!=='assigned'||body.provisioning?.assignedCount!==5) throw new Error('Expected five natural assignments'); const list=await page.request.get(${JSON.stringify(base+'/api/missions')}); const {items}=await list.json(); if(items.length!==5) throw new Error('Learner list must contain five'); return {provisioning:body.provisioning,missions:items.map(x=>({id:x.id,title:x.title,difficulty:x.difficulty}))};`,'five-assignments');
    await call('browser_snapshot',{target:'main'},'learner-evidence');
    if(process.env.MCP_RUN_AI === '1') {
      await run(`await page.getByRole('link',{name:'업무 실수를 알리고 복구 제안하기 미션 상세 보기',exact:true}).click(); await page.getByRole('link',{name:'미션 시작하기',exact:true}).click(); await page.getByRole('textbox',{name:'영어 메시지',exact:true}).fill('I used the old date by mistake, and I will send a corrected copy now.'); await page.getByRole('button',{name:'메시지 보내기',exact:true}).click(); await page.getByRole('button',{name:'메시지 보내기',exact:true}).waitFor({timeout:120000}); const response=page.getByTestId('message-assistant').last(); await response.waitFor(); const answer=await response.innerText(); if(!answer.trim())throw new Error('Empty AI response'); const url=page.url(); await page.reload(); await page.getByTestId('message-assistant').last().waitFor(); if(page.url()!==url||await page.getByTestId('message-assistant').last().innerText()!==answer)throw new Error('Conversation did not restore'); return {restored:true,url,answer};`,'real-ai-and-reload');
      await call('browser_snapshot',{target:'main'},'restored-conversation');
    }
    await run(`const forged=await page.request.post(${JSON.stringify(base+'/api/me/mission-assignments')},{headers:{Origin:${JSON.stringify(base)}},data:{ownerId:${JSON.stringify(owner)},count:752}}); const cross=await page.request.post(${JSON.stringify(base+'/api/me/mission-assignments')},{headers:{Origin:'https://untrusted.invalid'},data:{}}); if(forged.status()!==400||cross.status()!==403) throw new Error('Assignment request boundary failed'); return {forged:forged.status(),crossOrigin:cross.status()};`,'assignment-boundaries');
    await run(`const {items}=await (await page.request.get(${JSON.stringify(base+'/api/missions')})).json(); const denied=${JSON.stringify(expectedIds)}.find(id=>!items.some(x=>x.id===id)); const detail=await page.request.get(${JSON.stringify(base+'/api/missions/')}+denied); if(detail.status()!==404) throw new Error('Unassigned detail must return 404'); return {deniedId:denied,status:detail.status()};`,'unassigned-api');
  });
  report.status='PASS';
} catch(error) {
  report.status='FAIL';report.error=error.message;process.exitCode=1;
} finally {
  report.finishedAt=new Date().toISOString();
  writeFileSync(resolve(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
}
