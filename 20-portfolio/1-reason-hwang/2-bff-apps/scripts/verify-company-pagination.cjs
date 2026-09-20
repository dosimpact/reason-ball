// Opt-in real HTTP/PostgreSQL test. Owns its container, fixture rows and API port.
const { execFileSync, spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const routeSuite = process.argv.includes('--filing-routes');
let fixtureDir;
const { setTimeout: delay } = require('node:timers/promises');
const name = `sec-company-test-${randomUUID()}`;
let app;
let created = false;
async function cleanup() {
  if (app) { const current = app; app = null; await current.close(); }
  if (fixtureDir) fs.rmSync(fixtureDir, { recursive: true, force: true });
  if (created) { created = false; execFileSync('docker', ['rm', '-f', name], { stdio: 'ignore' }); }
}
async function main() {
  execFileSync('docker', ['run', '--rm', '-d', '--name', name, '-e', 'POSTGRES_PASSWORD=fixture', '-e', 'POSTGRES_DB=company_test', '-p', '127.0.0.1::5432', 'postgres:16-alpine'], { stdio: 'ignore' });
  created = true;
  const port = execFileSync('docker', ['port', name, '5432/tcp'], { encoding: 'utf8' }).trim().split(':').pop();
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { execFileSync('docker', ['exec', name, 'pg_isready', '-U', 'postgres'], { stdio: 'ignore' }); ready = true; break; }
    catch { await delay(500); }
  }
  if (!ready) throw new Error('Temporary PostgreSQL did not become ready');
  process.env.DATABASE_URL = `postgresql://postgres:fixture@127.0.0.1:${port}/company_test`;
  if (routeSuite) {
    fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-route-fixture-'));
    process.env.DATA_DIR = fixtureDir;
    fs.mkdirSync(path.join(fixtureDir, 'sec-cache'));
    // Real ZIP reader, deterministic bulk company + historical document fixture.
    execFileSync('python3', ['-c', `import zipfile,json,sys
with zipfile.ZipFile(sys.argv[1],'w') as z:
 z.writestr('CIK0000000004.json',json.dumps({'name':'Bulk Company','tickers':['DDD'],'filings':{'recent':{'accessionNumber':['0000000004-24-000001'],'form':['10-K'],'filingDate':['2024-01-01'],'primaryDocument':['bulk.htm']}}}))
 z.writestr('CIK0000000004-submissions-001.json',json.dumps({'accessionNumber':['0000000004-20-000001'],'form':['10-K'],'filingDate':['2020-01-01'],'primaryDocument':['history.htm']}))
 z.writestr('CIK0000000012.json',json.dumps({'name':'No ticker','tickers':[],'filings':{'recent':{'accessionNumber':['0000000012-24-000001'],'form':['10-K'],'filingDate':['2024-01-01'],'primaryDocument':['bulk.htm']}}}))
 z.writestr('CIK0000000012-submissions-001.json',json.dumps({'accessionNumber':['0000000012-20-000001'],'form':['10-K'],'filingDate':['2020-01-01'],'primaryDocument':['history.htm']}))
`, path.join(fixtureDir, 'sec-cache/submissions.zip')]);
  }
  require('reflect-metadata');
  const { NestFactory } = require('@nestjs/core');
  const { SwaggerModule, DocumentBuilder } = require('@nestjs/swagger');
  const { DataSource } = require('typeorm');
  const { AppModule } = require('../dist/app.module');
  const { Company } = require('../dist/us-corporate-filings/entity/company.entity');
  app = await NestFactory.create(AppModule, { logger: ['error'] });
  app.setGlobalPrefix('api/sec');
  SwaggerModule.setup('docs/sec', app, SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('Company pagination fixture').setVersion('1').build()));
  await app.init();
  await app.get(DataSource).getRepository(Company).save(Array.from({ length: 5 }, (_, i) => ({
    cik: String(i + 1).padStart(10, '0'), ticker: ['AAA', 'BBB', 'CCC', 'DDD', 'EEE'][i],
    name: i < 3 ? `Group ${i + 1}` : `Other ${i + 1}`, updatedAt: new Date('2026-01-01T00:00:00Z'),
  })));
  if (routeSuite) {
    const { SecClientService } = require('../dist/lib/sec/sec.client');
    // Replace only the external SEC boundary; controller/service/database stay real.
    const { documentFromBytes } = require('../dist/lib/sec/sec.utils');
    const { Filing } = require('../dist/us-corporate-filings/entity/filing.entity');
    const amendmentFixtures = [
      ['6','base','10-K','2025-12-31','2026-02-01','Original financial statements'],
      ['6','partial','10-K/A','2025-12-31','2026-03-01','Part III only, no financial statements'],
      ['6','full','10-K/A','2025-12-31','2026-04-01','Full restatement retained independently'],
      ['6','quarter','10-Q','2025-12-31','2026-02-01','Quarterly original'],
      ['7','other','10-K','2025-12-31','2026-02-01','Different company'],
      ['8','orphan','10-K/A','2025-12-31','2026-03-01','No original'],
      ['9','ambiguous-1','8-K','2025-12-31','2026-02-01','First event'],
      ['9','ambiguous-2','8-K','2025-12-31','2026-02-02','Second event'],
      ['9','ambiguous-a','8-K/A','2025-12-31','2026-03-01','Unclear parent'],
      ['10','undated','10-K/A',null,'2026-03-01','Unknown period'],
    ];
    await app.get(DataSource).getRepository(Company).save([6,7,8,9,10].map(cik=>({cik:String(cik).padStart(10,'0'),name:`Amendment fixture ${cik}`})));
    await app.get(DataSource).getRepository(Filing).save(amendmentFixtures.map(([cik,accessionNo,formType,reportDate,filingDate,body])=>({
      cik:cik.padStart(10,'0'),accessionNo,formType,reportDate,filingDate,filingUrl:'https://example.invalid/fixture',
      status:'downloaded',documentDownloadedAt:new Date(),...documentFromBytes(Buffer.from(body),'text/plain'),
    })));
    await app.get(DataSource).getRepository(Company).save({ cik: '0000000011', name: 'Raw content fixture' });
    await app.get(DataSource).getRepository(Company).save({ cik: '0000000012', ticker: '   ', name: 'Blank ticker fixture' });
    const rawDocuments = [
      ['000001', 'text/html', '<html><body><h1>공시 원문 HTML</h1><script>document.body.textContent="UNSAFE SCRIPT"</script></body></html>'],
      ['000002', 'application/xml', '<?xml version="1.0" encoding="UTF-8"?><report>공시 XML</report>'],
      ['000003', 'text/plain', '공시 plain text'],
      ['000004', 'application/octet-stream', 'Unknown MIME stays plain text'],
      ['000005', 'application/xhtml+xml', '<html xmlns="http://www.w3.org/1999/xhtml"><body>XHTML report</body></html>'],
    ];
    await app.get(DataSource).getRepository(Filing).save(rawDocuments.map(([suffix,mime,body]) => ({
      cik: '0000000011', accessionNo: `0000000011-26-${suffix}`, formType: '10-K',
      filingUrl: 'https://example.invalid/raw', status: 'downloaded', documentDownloadedAt: new Date(),
      ...documentFromBytes(Buffer.from(body), mime),
    })));
    await app.get(DataSource).getRepository(Filing).save(['pending', 'failed'].map((status,index) => ({
      cik: '0000000011', accessionNo: `0000000011-26-00000${index + 6}`, formType: '10-K',
      filingUrl: 'https://example.invalid/raw', filingDate: '2026-01-01', status,
    })));
    let failedOnce = false;
    app.get(SecClientService).downloadDocument = async url => {
      if (url.endsWith('/retry.htm') && !failedOnce) { failedOnce = true; throw new Error('Fixture transient document failure'); }
      if (!/\/(fixture|history|bulk|retry)\.htm$/.test(url)) throw new Error('Unexpected fixture document URL');
      return documentFromBytes(Buffer.from('<html>Fixture report</html>'), 'text/html');
    };
    const columns = (cik, year, doc) => ({ accessionNumber: [`${cik}-${year}-000001`], form: ['10-K'],
      filingDate: [`20${year}-01-01`], reportDate: [`20${year}-01-01`], primaryDocument: [doc] });
    app.get(SecClientService).getJson = async url => {
      if (url.endsWith('/company_tickers.json')) return { 0: { cik_str: 1, ticker: 'AAA', title: 'Group 1' } };
      if (url.endsWith('/CIK0000000005.json')) { await delay(300); return { filings: { recent: columns('0000000005','26','fixture.htm') } }; }
      if (url.endsWith('/CIK0000000002.json')) throw new Error('Fixture SEC unavailable');
      if (url.endsWith('/CIK0000000003.json')) return { filings: { recent: columns('0000000003','26','retry.htm') } };
      if (url.endsWith('/CIK0000000001-submissions-001.json')) return columns('0000000001','20','history.htm');
      if (url.endsWith('/CIK0000000001.json')) return { sic: 3571, filings: {
        recent: columns('0000000001','26','fixture.htm'),
        files: [{ name: 'CIK0000000001-submissions-001.json', filingTo: '2020-12-31' }],
      } };
      throw new Error(`Unexpected fixture SEC request: ${url}`);
    };
  }
  await app.listen(0, '127.0.0.1');
  const baseUrl = `${await app.getUrl()}/api/sec`;
  console.log(`Owned fixture API: ${baseUrl}`);
  if (process.argv.includes('--serve')) {
    console.log('Waiting for browser verification; stop with Ctrl-C.');
    await new Promise(resolve => process.once('SIGINT', resolve));
    return;
  }
  if (routeSuite) {
    const response = await fetch(`${baseUrl}/company-filing-sync-jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ciks:['5'],downloadDocuments:false}) });
    if (!response.headers.get('content-type').startsWith('text/event-stream')) throw new Error('Expected SSE content type');
    const reader = response.body.getReader();
    const first = new TextDecoder().decode((await reader.read()).value);
    if (!first.includes('event: started') || first.includes('event: completed')) throw new Error('SSE must arrive before work finishes');
    let remaining = '';
    while (true) { const chunk = await reader.read(); if (chunk.done) break; remaining += new TextDecoder().decode(chunk.value); }
    if (!remaining.includes('event: completed') || !remaining.includes('"skipped":true')) throw new Error('Missing metadata-only completion');
    const state = await (await fetch(`${baseUrl}/filings?cik=5&includeContent=true`)).json();
    if (state.items[0].status !== 'pending' || state.items[0].content !== null) throw new Error('Metadata-only must not download documents');
    console.log('PASS live SSE arrives before completion; metadata-only leaves pending content');
  }
  // BRUNO_CLI optionally uses an installed CLI entry file; otherwise pinned pnpm dlx.
  const command = process.env.BRUNO_CLI ? process.execPath : 'pnpm';
  const prefix = process.env.BRUNO_CLI ? [process.env.BRUNO_CLI] : ['dlx', '@usebruno/cli@4.1.0'];
  const reportDir = path.resolve(__dirname, '../bruno-api-tests/reports');
  fs.mkdirSync(reportDir, { recursive: true });
  const log = fs.createWriteStream(path.join(reportDir, routeSuite ? 'filing-routes.log' : 'company-pagination.log'));
  const child = spawn(command, [...prefix, 'run', '--env-var', `baseUrl=${baseUrl}`], {
    cwd: path.resolve(__dirname, routeSuite ? '../tests/bruno-filing-routes' : '../tests/bruno-companies'), stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', data => { process.stdout.write(data); log.write(data); });
  child.stderr.on('data', data => { process.stderr.write(data); log.write(data); });
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  await new Promise(resolve => log.end(resolve));
  if (routeSuite) {
    const result = await (await fetch(`${baseUrl}/filings?cik=4&includeContent=true`)).json();
    if (result.items.length !== 2 || result.items.some(item => item.content !== '<html>Fixture report</html>')) throw new Error('Bulk metadata/document round trip failed');
    const [{ count }] = await app.get(DataSource).query('SELECT count(*) FROM sec_backfill_runs');
    if (Number(count) !== 0) throw new Error('Backfill must not persist job entities');
    console.log('PASS bulk content round trip and zero persisted jobs');
    const { Filing } = require('../dist/us-corporate-filings/entity/filing.entity');
    const filings = app.get(DataSource).getRepository(Filing);
    if (await filings.countBy({cik:'0000000012'}) !== 0) throw new Error('Blank ticker ZIP entries must be excluded');
    for (const [suffix,status] of [['000006','pending'],['000007','failed']]) {
      const row = await filings.findOneByOrFail({cik:'0000000011',accessionNo:`0000000011-26-${suffix}`});
      if (row.status !== status || row.retryCount !== 0) throw new Error('Non-ticker pending/failed must be untouched');
    }
    await app.get(DataSource).getRepository(Company).createQueryBuilder().update().set({ticker:null}).execute();
    const empty = await (await fetch(`${baseUrl}/all-company-filing-sync-jobs`, {method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).text();
    if (!empty.includes('event: error') || !empty.includes('"statusCode":404') || empty.includes('"phase":"archive"')) throw new Error('Empty ticker scope must stop before archive');
    console.log('PASS ticker-only recent/history, excluded pending/failed, empty scope fails closed');

  }
  if (code !== 0) throw new Error(`Bruno failed: ${code}`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(cleanup);
