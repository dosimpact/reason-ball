// Explicit opt-in: sync real companies, then stream the requested SEC backfill.
// Uses an owned HTTP server and the configured database. Never part of pnpm test.
const fs = require('node:fs');
const path = require('node:path');
const { NestFactory } = require('@nestjs/core');
require('reflect-metadata');
const { AppModule } = require('../dist/app.module');
const { AppConfigService } = require('../dist/shared/config.service');

async function main() {
  const years = Number(process.argv[2] ?? 20);
  if (!Number.isInteger(years) || years < 1 || years > 30) throw new Error('years must be 1..30');
  const app = await NestFactory.create(AppModule, { logger: ['warn', 'error'] });
  app.setGlobalPrefix('api/sec');
  const directory = path.join(app.get(AppConfigService).dataDir, 'runs');
  fs.mkdirSync(directory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = path.join(directory, `backfill-${stamp}.sse`);
  const log = fs.createWriteStream(logPath);
  try {
    await app.listen(0, '127.0.0.1');
    const base = `${await app.getUrl()}/api/sec`;
    console.log(JSON.stringify({ phase: 'started', pid: process.pid, baseUrl: base, years, logPath }));
    const sync = await fetch(`${base}/company-sync-jobs`, { method: 'POST' });
    if (!sync.ok) throw new Error(`Company sync failed: ${sync.status} ${await sync.text()}`);
    const companies = await sync.json();
    const page = await (await fetch(`${base}/companies?pageSize=1`)).json();
    console.log(JSON.stringify({ phase: 'companies', ...companies, totalCompanies: page.pagination.totalItems }));
    const response = await fetch(`${base}/all-company-filing-sync-jobs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ years, refreshArchive: false, downloadDocuments: true }),
    });
    if (!response.ok) throw new Error(`Backfill request failed: ${response.status}`);
    let pending = '';
    let terminal;
    const decoder = new TextDecoder();
    for await (const chunk of response.body) {
      log.write(chunk);
      pending += decoder.decode(chunk, { stream: true });
      let boundary;
      while ((boundary = pending.indexOf('\n\n')) >= 0) {
        const event = pending.slice(0, boundary); pending = pending.slice(boundary + 2);
        if (event.startsWith(':')) continue;
        console.log(event.replaceAll('\n', ' '));
        if (/^event: (completed|error)\n/.test(event)) terminal = event;
      }
    }
    if (!terminal?.startsWith('event: completed')) throw new Error(terminal ?? 'Stream ended without completion');
    const result = JSON.parse(terminal.split('\ndata: ')[1]);
    if (result.failed > 0) throw new Error(`${result.failed} documents failed; rerun to retry`);
  } finally {
    await new Promise(resolve => log.end(resolve));
    await app.close();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
