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
    // Valid empty ZIP: verifies real archive processing without SEC network traffic.
    fs.writeFileSync(path.join(fixtureDir, 'sec-cache/submissions.zip'), Buffer.from('504b0506000000000000000000000000000000000000', 'hex'));
  }
  require('reflect-metadata');
  const { NestFactory } = require('@nestjs/core');
  const { SwaggerModule, DocumentBuilder } = require('@nestjs/swagger');
  const { DataSource } = require('typeorm');
  const { AppModule } = require('../dist/app.module');
  const { Company } = require('../dist/sec/common/db/entities/company.entity');
  app = await NestFactory.create(AppModule, { logger: ['error'] });
  app.setGlobalPrefix('api/sec');
  SwaggerModule.setup('docs/sec', app, SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('Company pagination fixture').setVersion('1').build()));
  await app.init();
  await app.get(DataSource).getRepository(Company).save(Array.from({ length: 5 }, (_, i) => ({
    cik: String(i + 1).padStart(10, '0'), ticker: ['AAA', 'BBB', 'CCC', 'DDD', 'EEE'][i],
    name: i < 3 ? `Group ${i + 1}` : `Other ${i + 1}`, updatedAt: new Date('2026-01-01T00:00:00Z'),
  })));
  if (routeSuite) {
    const { SecClientService } = require('../dist/sec/common/sec/sec-client.service');
    // Replace only the external SEC boundary; controller/service/database stay real.
    app.get(SecClientService).getJson = async url => {
      if (url !== 'https://data.sec.gov/submissions/CIK0000000001.json') {
        throw new Error(`Unexpected fixture SEC request: ${url}`);
      }
      return { sic: 3571, filings: { recent: {
        accessionNumber: ['0000000001-26-000001'], form: ['10-K'],
        filingDate: [new Date().toISOString().slice(0, 10)],
        reportDate: ['2026-01-01'], primaryDocument: ['fixture.htm'],
      } } };
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
    let completed = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      const run = await (await fetch(`${baseUrl}/all-company-filing-sync-jobs/latest`)).json();
      if (run?.status === 'completed') { completed = true; break; }
      if (run?.status === 'failed') throw new Error('Fixture bulk job failed');
      await delay(100);
    }
    if (!completed) throw new Error('Fixture bulk job did not complete');
  }
  if (code !== 0) throw new Error(`Bruno failed: ${code}`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(cleanup);
