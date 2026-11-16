// Owned real Nest/PostgreSQL fixture. No real modeling/provider/SEC calls.
const { execFileSync } = require('node:child_process');
const { randomUUID, createHash } = require('node:crypto');
const { createServer } = require('node:http');
const { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const assert = require('node:assert/strict');
const packageRoot = path.resolve(__dirname, '..');
const artifact = mkdtempSync(path.join(tmpdir(), 'sec-modeling-admin-'));
const name = `sec-modeling-admin-${randomUUID()}`;
let app, remote, created = false;
let stopRequested = false, resolveStop;
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { stopRequested = true; resolveStop?.(); });
const publications = new Map();
const metrics = { bulkCalls: [], individualCalls: 0, mode: 'normal' };
async function main() {
  execFileSync('docker', ['run', '--rm', '-d', '--name', name, '-e', 'POSTGRES_PASSWORD=fixture', '-e', 'POSTGRES_DB=modeling_test', '-p', '127.0.0.1::5432', 'postgres:16-alpine'], { stdio: 'ignore' });
  created = true;
  const port = execFileSync('docker', ['port', name, '5432/tcp'], { encoding: 'utf8' }).trim().split(':').pop();
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { execFileSync('docker', ['exec', name, 'pg_isready', '-U', 'postgres'], { stdio: 'ignore' }); ready = true; break; }
    catch { await delay(250); }
  }
  assert.ok(ready, 'Owned PostgreSQL did not become ready');
  remote = createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : {};
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/qa/metrics') return res.end(JSON.stringify(metrics));
    if (req.url === '/qa/mode') { metrics.mode = body.mode; return res.end(JSON.stringify({ mode: metrics.mode })); }
    assert.equal(req.headers['x-sec-modeling-key'], 'qa-fixture-only');
    if (req.url === '/internal/sec-modeling/filings/status') {
      metrics.bulkCalls.push(body.filings);
      if (metrics.mode === 'unavailable') { res.statusCode = 503; return res.end(JSON.stringify({ detail: 'Fixture modeling unavailable' })); }
      return res.end(JSON.stringify({ items: body.filings.map(f => ({ ...f, stages: publications.get(f.accessionNo) || {} })) }));
    }
    const match = req.url.match(/^\/internal\/sec-modeling\/filings\/\d+\/([^/]+)\/status$/);
    if (match) { metrics.individualCalls++; return res.end(JSON.stringify({ stages: publications.get(match[1]) || {} })); }
    res.statusCode = 404; res.end(JSON.stringify({ message: 'Fixture endpoint not configured' }));
  });
  await new Promise(resolve => remote.listen(3986, '127.0.0.1', resolve));
  process.env.DATABASE_URL = `postgresql://postgres:fixture@127.0.0.1:${port}/modeling_test`;
  process.env.SEC_MODELING_URL = 'http://127.0.0.1:3986';
  process.env.SEC_MODELING_KEY = 'qa-fixture-only';
  process.env.SEC_MODELING_WORKER_ENABLED = 'false';
  const build = path.join(artifact, 'build');
  execFileSync('pnpm', ['exec', 'tsc', '-p', 'tsconfig.build.json', '--outDir', build, '--incremental', 'false'], { cwd: packageRoot, stdio: 'pipe' });
  process.env.NODE_PATH = path.join(packageRoot, 'node_modules');
  require('node:module').Module._initPaths();
  require('reflect-metadata');
  const { NestFactory } = require('@nestjs/core');
  const { DataSource } = require('typeorm');
  const { AppModule } = require(path.join(build, 'app.module.js'));
  app = await NestFactory.create(AppModule, { logger: ['error'] });
  app.setGlobalPrefix('api/sec');
  await app.listen(3980, '127.0.0.1');
  const db = app.get(DataSource);
  await db.query(`INSERT INTO companies(cik,name,ticker) VALUES ('0000320193','Apple fixture','AAPL'),('0000789019','Microsoft fixture','MSFT'),('0001045810','Nvidia fixture','NVDA')`);
  const specs = [
    ['0000320193', '10-K', true], ['0000320193', '10-Q', true],
    ['0000789019', '10-K', false], ['0000789019', '10-K/A', true],
    ['0001045810', '10-K', true], ['0001045810', '10-K', true],
    ['0001045810', '20-F', true],
  ];
  const filings = [];
  for (const [i, [cik, form, source]] of specs.entries()) {
    const accession = `${cik}-26-${String(i + 1).padStart(6, '0')}`;
    const html = `<html><body>Owned fixture ${i + 1}</body></html>`;
    const hash = createHash('sha256').update(html).digest('hex');
    await db.query(`INSERT INTO filings(cik,accession_no,form_type,filing_date,report_date,filing_url,document_content,checksum,status,document_downloaded_at,document_size_bytes) VALUES($1,$2,$3,$4,'2026-09-30','https://example.invalid/fixture',$5,$6,$7,CASE WHEN $5::text IS NULL THEN NULL ELSE now() END,octet_length($5::text))`, [cik, accession, form, `2026-11-${String(10 - i).padStart(2, '0')}`, source ? html : null, hash, source ? 'downloaded' : 'pending']);
    filings.push({ cik, accessionNo: accession, hash });
  }
  async function run(index, stage, status, priorStatus) {
    const f = filings[index]; const job = randomUUID(); const id = randomUUID();
    await db.query('INSERT INTO sec_modeling.jobs(id,cik,accession_no,stage) VALUES($1,$2,$3,$4)', [job, f.cik, f.accessionNo, stage]);
    if (priorStatus) await db.query(`INSERT INTO sec_modeling.runs(id,job_id,status,config,source_hash,created_at) VALUES($1,$2,$3,'{}',$4,now()-interval '1 day')`, [randomUUID(), job, priorStatus, f.hash]);
    await db.query(`INSERT INTO sec_modeling.runs(id,job_id,status,config,source_hash) VALUES($1,$2,$3,'{}',$4)`, [id, job, status, f.hash]);
    await db.query('UPDATE sec_modeling.jobs SET latest_run_id=$1 WHERE id=$2', [id, job]);
  }
  await run(0, 1, 'SUCCEEDED', 'FAILED'); await run(0, 2, 'FAILED');
  await run(1, 3, 'FAILED'); await run(2, 1, 'SUCCEEDED');
  await run(3, 1, 'QUEUED'); await run(5, 1, 'FAILED');
  publications.set(filings[0].accessionNo, { '1': { generationId: 'published-1', sourceHash: filings[0].hash }, '2': { generationId: 'published-2', sourceHash: filings[0].hash, inputGenerationId: 'published-1' } });
  publications.set(filings[5].accessionNo, { '1': { generationId: 'old-publication', sourceHash: '0'.repeat(64) } });
  writeFileSync('/tmp/sec-modeling-admin-owned.json', JSON.stringify({ pid: process.pid, container: name, artifact, baseUrl: 'http://127.0.0.1:3980/api/sec', fixtureUrl: 'http://127.0.0.1:3986', filings }));
  console.log(JSON.stringify({ ready: true, pid: process.pid, container: name, artifact, ports: [3980, 3986] }));
  if (!stopRequested) await new Promise(resolve => { resolveStop = resolve; });
}
async function cleanup() {
  if (app) await app.close();
  if (remote) await new Promise(resolve => { remote.closeAllConnections(); remote.close(resolve); });
  if (created) execFileSync('docker', ['rm', '-f', name], { stdio: 'ignore' });
  rmSync(path.join(artifact, 'build'), { recursive: true, force: true });
  const recordPath = '/tmp/sec-modeling-admin-owned.json';
  if (existsSync(recordPath)) {
    const record = JSON.parse(readFileSync(recordPath, 'utf8'));
    if (record.pid === process.pid) writeFileSync(recordPath, JSON.stringify({ ...record, cleaned: true }));
  }
  console.log(JSON.stringify({ cleaned: true, container: name, ports: [3980, 3986] }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(cleanup);
