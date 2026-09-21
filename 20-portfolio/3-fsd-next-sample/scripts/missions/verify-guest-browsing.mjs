// Real remote Supabase + actual Playwright MCP. Only its own anonymous fixture is removed.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
const require = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');
const { createServerClient } = require('@supabase/ssr');
const base = process.env.MCP_BASE_URL ?? 'http://dodonet.iptime.org:13000';
const home = process.env.PLAYWRIGHT_MCP_HOME;
if (!home) throw new Error('PLAYWRIGHT_MCP_HOME required');
const dependency = path => pathToFileURL(resolve(home, 'node_modules', path)).href;
const { Client } = await import(dependency('@modelcontextprotocol/sdk/dist/esm/client/index.js'));
const { StdioClientTransport } = await import(dependency('@modelcontextprotocol/sdk/dist/esm/client/stdio.js'));
const env = process.env;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, options);
const visitor = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, options);
const cookies = new Map();
const guest = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  cookies: { getAll: () => [...cookies.values()], setAll: values => values.forEach(cookie => cookies.set(cookie.name, cookie)) },
});
const check = (result, label) => { if (result.error) throw new Error(`${label}: ${result.error.code ?? result.error.status ?? 'failed'}`); return result.data; };
async function missionIds(client, publicOnly = false) {
  const result = [];
  for (let offset = 0;; offset += 200) {
    let query = client.from('missions').select('id').order('id').range(offset, offset + 199);
    if (publicOnly) query = query.eq('status', 'published').eq('visibility', 'public');
    const rows = check(await query, 'mission IDs');
    result.push(...rows.map(row => row.id));
    if (rows.length < 200) return result;
  }
}
const output = resolve('docs/flow/evidence/2026-09-21-guest-mission-browsing');
await mkdir(output, { recursive: true });
const temporary = await mkdtemp(join(tmpdir(), 'guest-mission-mcp-'));
const report = { status: 'RUNNING', checks: [], fixtureCleanup: 'pending' };
let fixture;
async function browser(kind, state, expected) {
  const client = new Client({ name: 'guest-mission-verification', version: '1.0.0' });
  const args = [resolve(home, 'node_modules/@playwright/mcp/cli.js'), '--headless', '--isolated', '--browser', 'chrome', '--output-dir', temporary];
  if (state) args.push('--storage-state', state);
  const transport = new StdioClientTransport({ command: process.execPath, args, stderr: 'pipe' });
  try {
    await client.connect(transport);
    report.mcpServer = client.getServerVersion();
    const call = async (name, args) => {
      const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 120000 });
      if (result.isError) throw new Error(`MCP ${kind}/${name} failed`);
      return result;
    };
    await call('browser_navigate', { url: `${base}/missions` });
    await call('browser_snapshot', {});
    // Inspect actual UI through MCP before interacting with the search control.
    const result = await call('browser_run_code_unsafe', { code: `async (page) => {
      const response=await page.request.get(${JSON.stringify(base + '/api/missions')},{timeout:60000});
      if(!response.ok())throw new Error('Mission API failed');
      const {items}=await response.json(); const expected=${JSON.stringify(expected)};
      if(JSON.stringify(items.map(x=>x.id).sort())!==JSON.stringify(expected))throw new Error('Catalog mismatch');
      await page.getByTestId('mission-results').waitFor({timeout:60000});
      await page.getByRole('searchbox',{name:'미션 검색',exact:true}).fill(items[0].title);
      const link=page.getByRole('link',{name:items[0].title+' 미션 상세 보기',exact:true}).first();
      await link.click(); await page.getByRole('heading',{name:items[0].title,level:1,exact:true}).waitFor();
      await page.screenshot({path:${JSON.stringify(join(output, kind + '-detail.png'))},fullPage:true});
      return {count:items.length,title:items[0].title,detailVisible:true};
    }` });
    report.checks.push({ kind, status: 'PASS', result: result.content.filter(x => x.type === 'text').map(x => x.text.split('### Ran Playwright code')[0].trim()) });
  } finally { await client.close(); }
}
try {
  const expected = await missionIds(admin, true);
  assert.ok(expected.length >= 752);
  assert.deepEqual(await missionIds(visitor), expected);
  const signed = check(await guest.auth.signInAnonymously(), 'create anonymous fixture');
  fixture = signed.user.id;
  assert.equal(signed.user.is_anonymous, true);
  assert.deepEqual(await missionIds(guest), expected);
  assert.equal((await guest.from('mission_version_instructions').select('*').limit(1)).error?.code, '42501');
  const target = check(await guest.from('missions').select('id,current_version_id').eq('id', expected[0]).single(), 'guest detail');
  assert.equal(check(await guest.from('mission_versions').select('id').eq('id', target.current_version_id), 'guest version').length, 1);
  assert.ok(check(await guest.from('mission_steps').select('id').eq('mission_version_id', target.current_version_id), 'guest steps').length > 0);
  const started = await admin.rpc('start_mission_run', { _expected_owner_id: fixture, _mission_id: target.id, _mission_version_id: target.current_version_id, _character_id: '11111111-1111-4111-8111-111111111111', _character_version_id: '11111111-1111-4111-8111-111111111112' });
  assert.equal(started.error?.code, '42501');
  report.checks.push({ kind: 'remote-data-api', status: 'PASS', publicCount: expected.length, unauthenticatedAndAnonymousMatchPublicIds: true, privateInstructionsDenied: true, unassignedStartDenied: true });
  const state = join(temporary, 'guest-state.json');
  await writeFile(state, JSON.stringify({ cookies: [...cookies.values()].map(({name,value}) => ({ name, value, domain: new URL(base).hostname, path: '/', expires: -1, httpOnly: false, secure: false, sameSite: 'Lax' })), origins: [] }), { mode: 0o600 });
  await browser('visitor', null, expected);
  await browser('anonymous-account', state, expected);
  assert.equal(check(await admin.from('mission_assignments').select('mission_id').eq('user_id', fixture), 'no browsing assignments').length, 0);
  report.status = 'PASS';
} finally {
  if (fixture) {
    check(await guest.auth.signOut({ scope: 'global' }), 'sign out fixture');
    check(await admin.auth.admin.deleteUser(fixture), 'delete fixture');
    report.fixtureCleanup = 'signed out and deleted';
  }
  await rm(temporary, { recursive: true, force: true });
  report.privateStateRemoved = true;
  report.verifiedAt = new Date().toISOString();
  await writeFile(join(output, 'result.json'), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify(report));
