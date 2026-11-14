// Real Nest HTTP + isolated PostgreSQL. Only the external modeling service is a fixture.
const { execFileSync, spawn } = require('node:child_process');
const { randomUUID, createHash } = require('node:crypto');
const { createServer } = require('node:http');
const { setTimeout: delay } = require('node:timers/promises');
const assert = require('node:assert/strict');
const path = require('node:path');
const name = `sec-modeling-test-${randomUUID()}`;
let app, remote, created = false;
const remoteRuns = new Map();
let disconnect = false, hold = false;
async function cleanup() {
  if (app) await app.close();
  if (remote) await new Promise(resolve => { remote.closeAllConnections(); remote.close(resolve); });
  if (created) execFileSync('docker', ['rm', '-f', name], { stdio: 'ignore' });
}
async function main() {
  execFileSync('docker', ['run', '--rm', '-d', '--name', name, '-e', 'POSTGRES_PASSWORD=fixture', '-e', 'POSTGRES_DB=modeling_test', '-p', '127.0.0.1::5432', 'postgres:16-alpine'], { stdio: 'ignore' });
  created = true;
  const port = execFileSync('docker', ['port', name, '5432/tcp'], { encoding: 'utf8' }).trim().split(':').pop();
  for (let i = 0; i < 60; i++) {
    try { execFileSync('docker', ['exec', name, 'pg_isready', '-U', 'postgres'], { stdio: 'ignore' }); break; }
    catch { await delay(500); }
  }
  remote = createServer(async (req, res) => {
    assert.equal(req.headers['x-sec-modeling-key'], 'test-only-key');
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : {};
    res.setHeader('Content-Type', 'application/json');
    if (req.url.endsWith('/status')) return res.end(JSON.stringify({ stages: {} }));
    if (req.url.match(/model-\d\/runs$/)) {
      assert.ok(body.sourceHtml);
      assert.equal(body.sourceHash, createHash('sha256').update(body.sourceHtml).digest('hex'));
      const result = { status: 'SUCCEEDED', generationId: `generation-${body.runId}`, counts: { items: 2 } };
      if (hold) {
        hold = false; remoteRuns.set(body.runId, { status: 'RUNNING' });
        res.setHeader('Content-Type', 'application/x-ndjson');
        for (const [id,status] of [['done','SUCCEEDED'],['active','RUNNING'],['waiting','QUEUED']]) {
          res.write(JSON.stringify({ type: 'progress', runId: body.runId, workUnitId: id, status }) + '\n');
        }
        return;
      }
      remoteRuns.set(body.runId, result);
      if (disconnect) { disconnect = false; return res.end(''); }
      res.setHeader('Content-Type', 'application/x-ndjson');
      return res.end(JSON.stringify({ type: 'progress', runId: body.runId, workUnitId: 'item-1', status: 'SUCCEEDED' }) + '\n'
        + JSON.stringify({ type: 'progress', runId: body.runId, workUnitId: 'item-2', status: 'RUNNING' }) + '\n'
        + JSON.stringify({ type: 'completed', runId: body.runId, ...result }) + '\n');
    }
    const id = req.url.split('/')[4];
    if (req.url.endsWith('/cancel') && remoteRuns.get(id)?.status !== 'SUCCEEDED') remoteRuns.set(id, { status: 'CANCELLED' });
    res.end(JSON.stringify(remoteRuns.get(id) || { status: 'UNKNOWN' }));
  });
  await new Promise(resolve => remote.listen(0, '127.0.0.1', resolve));
  process.env.DATABASE_URL = `postgresql://postgres:fixture@127.0.0.1:${port}/modeling_test`;
  process.env.SEC_MODELING_URL = `http://127.0.0.1:${remote.address().port}`;
  process.env.SEC_MODELING_KEY = 'test-only-key';
  process.env.SEC_MODELING_WORKER_ENABLED = 'false';
  require('reflect-metadata');
  const { NestFactory } = require('@nestjs/core');
  const { DataSource } = require('typeorm');
  const { AppModule } = require('../dist/app.module');
  const { SecModelingStore } = require('../dist/us-corporate-filings/service/sec-modeling.store');
  const { SecModelingExecutor } = require('../dist/us-corporate-filings/service/sec-modeling.executor');
  app = await NestFactory.create(AppModule, { logger: ['error'] });
  app.setGlobalPrefix('api/sec');
  await app.listen(0, '127.0.0.1');
  const db = app.get(DataSource), store = app.get(SecModelingStore), worker = app.get(SecModelingExecutor);
  const html = '<html><body><h1>Item 1. Business</h1><p>Fixture</p></body></html>';
  await db.query(`INSERT INTO companies(cik,name,ticker) VALUES('0000320193','Apple fixture','AAPL')`);
  await db.query(`INSERT INTO filings(cik,accession_no,form_type,filing_url,document_content,checksum)
    VALUES('0000320193','0000320193-26-000026','10-K','https://example.invalid/fixture',$1,$2)`, [html, createHash('sha256').update(html).digest('hex')]);
  const base = `${await app.getUrl()}/api/sec/modeling`;
  async function request(route, body, status = 200) {
    const res = await fetch(base + route, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await res.json(); assert.equal(res.status, status, JSON.stringify(data)); return data;
  }
  await db.query(`UPDATE filings SET filing_date='2026-11-03',report_date='2026-09-26' WHERE cik='0000320193'`);
  const route = '/filings/0000320193/0000320193-26-000026';
  await request(`${route}/model-2/runs`, {}, 409);
  await db.query(`UPDATE filings SET document_content=NULL WHERE cik='0000320193'`);
  await request(`${route}/model-1/runs`, {}, 409);
  await db.query(`UPDATE filings SET document_content=$1 WHERE cik='0000320193'`, [html]);
  await request(`${route}/model-4/runs`, {}, 400);
  await request(`${route}/model-1/runs`, { extractionModel: 'unsafe-model' }, 400);
  const run = await request(`${route}/model-1/runs`, {}, 202);
  await request(`${route}/model-1/runs`, {}, 409);
  await worker.tick();
  const finished = await request(`/runs/${run.runId}`);
  assert.equal(finished.status, 'SUCCEEDED'); assert.equal(finished.workUnits.length, 2);
  assert.ok(finished.workUnits.every(unit => unit.status === 'SUCCEEDED'));
  assert.equal(finished.workUnits.find(unit => unit.id === 'item-2').payload.terminalReason.code, 'RUN_SUCCEEDED');
  assert.ok(finished.outputGenerationId);
  await db.query(`INSERT INTO sec_modeling.work_units(run_id,id,status,payload) SELECT $1,'bulk-' || n,'SUCCEEDED','{}'::jsonb FROM generate_series(1,539) AS n`, [run.runId]);
  const largeDetail = await request(`/runs/${run.runId}`);
  assert.equal(largeDetail.workUnits.length, 541, 'Initial CPNG scope must not truncate above 500 units');
  assert.equal(largeDetail.workUnitsTotal, 541);
  assert.equal(largeDetail.workUnitsTruncated, false);
  assert.ok(largeDetail.workUnits.some(unit => unit.id === 'bulk-539'));
  await db.query(`INSERT INTO sec_modeling.work_units(run_id,id,status,payload) SELECT $1,'overflow-' || n,'SUCCEEDED','{}'::jsonb FROM generate_series(1,1460) AS n`, [run.runId]);
  const boundedDetail = await request(`/runs/${run.runId}`);
  assert.equal(boundedDetail.workUnits.length, 2000);
  assert.equal(boundedDetail.workUnitsTotal, 2001);
  assert.equal(boundedDetail.workUnitsTruncated, true, 'Larger future scope must explicitly report truncation');
  assert.ok((await request(`/runs/${run.runId}/events`)).items.length >= 3);
  await request(`/runs/${run.runId}/retry`, {}, 409);
  const cancelled = await request(`${route}/model-1/runs`, {}, 202);
  await db.query(`INSERT INTO sec_modeling.work_units(run_id,id,status,payload) VALUES($1,'waiting','QUEUED','{}'),($1,'done','SUCCEEDED','{}')`, [cancelled.runId]);
  assert.equal((await request(`/runs/${cancelled.runId}/cancel`, {})).status, 'CANCELLED');
  const queuedCancelUnits = (await request(`/runs/${cancelled.runId}`)).workUnits;
  assert.equal(queuedCancelUnits.find(unit => unit.id === 'waiting').status, 'CANCELLED');
  assert.equal(queuedCancelUnits.find(unit => unit.id === 'waiting').payload.terminalReason.code, 'CANCELLED_BEFORE_EXECUTION');
  assert.equal(queuedCancelUnits.find(unit => unit.id === 'done').status, 'SUCCEEDED');
  assert.ok((await request(`/runs/${cancelled.runId}/events`)).items.some(event => event.type === 'cancel_requested'));
  const retry = await request(`/runs/${cancelled.runId}/retry`, {}, 202);
  assert.notEqual(retry.runId, cancelled.runId);
  disconnect = true; await worker.tick();
  assert.equal((await store.run(retry.runId)).status, 'SUCCEEDED', 'Reconcile lost completion response');
  const expired = await request(`${route}/model-1/runs`, {}, 202);
  const claims = await Promise.all([store.claim(), store.claim()]);
  assert.equal(claims.filter(Boolean).length, 1, 'Only one worker claim');
  for (const [id,status] of [['done','SUCCEEDED'],['active','RUNNING'],['waiting','QUEUED']]) {
    await store.progress(claims.find(Boolean), { type: 'progress', workUnitId: id, status });
  }
  await db.query(`UPDATE sec_modeling.runs SET lease_until=now()-interval '1 second' WHERE id=$1`, [expired.runId]);
  assert.equal(await store.heartbeat(expired.runId, claims.find(Boolean).executionToken), false);
  await store.finish(claims.find(Boolean), 'SUCCEEDED', { generationId: 'must-not-publish' });
  assert.equal((await store.run(expired.runId)).status, 'RUNNING', 'Expired worker cannot finish');
  await worker.tick();
  assert.equal((await store.run(expired.runId)).status, 'FAILED', 'Expired lease fenced and failed');
  const failedUnits = (await request(`/runs/${expired.runId}`)).workUnits;
  assert.equal(failedUnits.find(unit => unit.id === 'done').status, 'SUCCEEDED');
  assert.ok(failedUnits.filter(unit => unit.id !== 'done').every(unit => unit.status === 'FAILED' && unit.payload.terminalReason.code === 'INTERRUPTED'));
  await db.query(`INSERT INTO sec_modeling.work_units(run_id,id,status,payload) VALUES($1,'historical-running','RUNNING','{}')`, [expired.runId]);
  await store.reconcileTerminalUnits();
  await store.reconcileTerminalUnits();
  const repaired = (await request(`/runs/${expired.runId}`)).workUnits;
  assert.equal(repaired.find(unit => unit.id === 'historical-running').status, 'FAILED');
  assert.equal(repaired.find(unit => unit.id === 'historical-running').payload.terminalReason.code, 'INTERRUPTED');
  assert.equal(repaired.find(unit => unit.id === 'done').status, 'SUCCEEDED');
  hold = true;
  const runningCancel = await request(`${route}/model-3/runs`, {}, 202);
  const executing = worker.tick();
  for (let i = 0; i < 50 && !remoteRuns.has(runningCancel.runId); i++) await delay(20);
  for (let i = 0; i < 50 && (await store.units(runningCancel.runId)).items.length < 3; i++) await delay(20);
  await request(`/runs/${runningCancel.runId}/cancel`, {});
  const [token] = await db.query('SELECT execution_token FROM sec_modeling.runs WHERE id=$1', [runningCancel.runId]);
  await worker.renew({ ...await store.run(runningCancel.runId), executionToken: token.execution_token }, worker.active);
  await executing;
  assert.equal((await store.run(runningCancel.runId)).status, 'CANCELLED');
  const cancelledUnits = (await request(`/runs/${runningCancel.runId}`)).workUnits;
  assert.equal(cancelledUnits.length, 3);
  assert.equal(cancelledUnits.find(unit => unit.id === 'done').status, 'SUCCEEDED');
  assert.ok(cancelledUnits.filter(unit => unit.id !== 'done').every(unit => unit.status === 'CANCELLED' && unit.payload.terminalReason.message));
  await request('/runs/not-uuid', undefined, 400);
  await request(`/runs/${run.runId}/events?cursor=bad`, undefined, 400);
  const listing = await request('/filings');
  assert.equal(listing.items.length, 1);
  assert.equal(listing.items[0].reportDate, '2026-09-26');
  assert.equal(listing.items[0].filingDate, '2026-11-03');
  assert.equal((await request('/filings?offset=100')).total, 1);
  assert.ok((await request('/runs?offset=100')).total >= 4);
  await new Promise((resolve, reject) => {
    const cli = spawn('bru', ['run', '07-modeling', '--env', 'local', '--env-var', `baseUrl=${awaitUrl(base)}`], { cwd: path.join(__dirname, '../bruno-api-tests'), stdio: 'inherit' });
    cli.on('error', reject); cli.on('exit', code => code === 0 ? resolve() : reject(new Error(`Bruno exited ${code}`)));
  });
  console.log('PASS: real HTTP/PostgreSQL modeling lifecycle, duplicate claims, retries, lease recovery, lost response, events, validation + Bruno');
}
function awaitUrl(base) { return base.replace(/\/modeling$/, ''); }
main().then(cleanup).catch(async error => { console.error(error); await cleanup(); process.exitCode = 1; });
