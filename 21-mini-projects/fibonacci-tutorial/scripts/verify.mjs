import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { startBinanceStub } from './binance-stub.mjs';

const mode = process.argv[2] ?? 'all';
const owned = new Set();
const data = await mkdtemp(path.join(tmpdir(), 'fibonacci-verify-'));
let staticServer;
let binanceStub;
let appServer;
let finishing = false;
let stopInspection;
const inspection = new Promise(resolve => { stopInspection = resolve; });
const env = { ...process.env, FIBONACCI_DATA_DIR: data, NEXT_TELEMETRY_DISABLED: '1', CI: '1' };
async function freePort() {
  const probe = net.createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  return port;
}
function launch(command, args, options = {}) {
  const child = spawn(command, args, { stdio: 'inherit', env, ...options });
  owned.add(child);
  child.once('exit', () => owned.delete(child));
  return child;
}
async function run(command, args, options) {
  const child = launch(command, args, options);
  const [code] = await once(child, 'exit');
  if (code !== 0) throw new Error(`${command} ${args.join(' ')} exited ${code}`);
}
async function ready(url, child) {
  const end = Date.now() + 60000;
  while (Date.now() < end && child.exitCode === null) {
    try { if ((await fetch(url)).ok) return; } catch { /* starting */ }
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error(`Server unavailable: ${url}`);
}
async function stopChild(child) {
  if (child.exitCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
  await exited;
  clearTimeout(timer);
}
async function startApp() {
  const port = await freePort();
  env.BASE_URL = `http://127.0.0.1:${port}`;
  appServer = launch(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)]);
  await ready(`${env.BASE_URL}/api/catalog`, appServer);
  console.log(`OWNED_SERVER=${env.BASE_URL} PID=${appServer.pid} DATA=${data}`);
}
async function verifyRestartAndConcurrency() {
  async function post(route, body) {
    return fetch(`${env.BASE_URL}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }
  const created = await post('/api/sessions', { unitId: 'wave-three' });
  assert.equal(created.status, 201);
  const session = await created.json();
  const route = `/api/sessions/${session.id}`;
  const plan = await post(`${route}/plan`, { waveIndices: [0, 3, 6], entry: 114, stopLoss: 99, target: 142.36, rationale: 'Restart persistence verification' });
  assert.equal(plan.status, 200);
  const raced = await Promise.all([post(`${route}/replay`, { expectedCursor: 7 }), post(`${route}/replay`, { expectedCursor: 7 })]);
  assert.deepEqual(raced.map(response => response.status).sort(), [200, 409]);
  const before = await (await fetch(`${env.BASE_URL}${route}`)).json();
  assert.equal(before.cursor, 8);
  const strategyCreated = await post('/api/strategies', { title: 'Restart and concurrency probe', mode: 'BACKTEST', source: { type: 'dummy' } });
  assert.equal(strategyCreated.status, 201);
  const strategy = await strategyCreated.json();
  assert.equal(strategy.version, 1);
  const strategyRoute = `/api/strategies/${strategy.id}`;
  const confirmedResponse = await post(`${strategyRoute}/confirm`, {
    expectedVersion: 1, waveIndices: [0, 3, 7], entry: 114, stopLoss: 99, target: 135,
    rationale: 'Freeze the plan before the concurrency check',
    monitoring: { policy: 'auto-abort', rule: { kind: 'price-level', level: 105 } },
  });
  assert.equal(confirmedResponse.status, 200);
  const confirmed = await confirmedResponse.json();
  assert.equal(confirmed.version, 2);
  const runResponse = await post(`${strategyRoute}/runs`, { expectedVersion: 2, mode: 'BACKTEST' });
  assert.equal(runResponse.status, 201);
  const started = await runResponse.json();
  assert.equal(started.version, 3);
  const strategyRunRoute = `${strategyRoute}/runs/${started.activeRunId}`;
  const racedSteps = await Promise.all([
    post(`${strategyRunRoute}/step`, { expectedVersion: 3 }),
    post(`${strategyRunRoute}/step`, { expectedVersion: 3 }),
  ]);
  assert.deepEqual(racedSteps.map(response => response.status).sort(), [200, 409]);
  const strategyBefore = await (await fetch(`${env.BASE_URL}${strategyRoute}`)).json();
  assert.equal(strategyBefore.version, 4);
  assert.equal(strategyBefore.runs[0].observedCount, 1);
  assert.equal(strategyBefore.runs[0].cursor, 8);
  assert.equal(strategyBefore.runs[0].monitoring.events.filter(event => event.kind === 'ENTERED').length, 1);
  const previousUrl = env.BASE_URL;
  await stopChild(appServer);
  await assert.rejects(fetch(previousUrl));
  await startApp();
  const restored = await fetch(`${env.BASE_URL}${route}`);
  assert.equal(restored.status, 200);
  assert.deepEqual(await restored.json(), before);
  const strategyRestored = await fetch(`${env.BASE_URL}${strategyRoute}`);
  assert.equal(strategyRestored.status, 200);
  assert.deepEqual(await strategyRestored.json(), strategyBefore);
  console.log('PASS: concurrent tutorial replay and standalone strategy step each advance once; both persist across server restart.');
}
async function cleanup() {
  if (finishing) return;
  finishing = true;
  for (const child of [...owned]) {
    if (child.exitCode === null) {
      const exited = once(child, 'exit');
      child.kill('SIGTERM');
      const timer = setTimeout(() => { if (child.exitCode === null) child.kill('SIGKILL'); }, 5000);
      await exited;
      clearTimeout(timer);
    }
  }
  if (staticServer) await new Promise(resolve => staticServer.close(resolve));
  if (binanceStub) await new Promise(resolve => binanceStub.close(resolve));
  await rm(data, { recursive: true, force: true });
  console.log('CLEANUP: owned processes stopped; temporary data removed.');
}
const interrupt = () => { stopInspection(); void cleanup(); };
process.once('SIGINT', interrupt);
process.once('SIGTERM', interrupt);
try {
  if (process.env.FIBONACCI_SKIP_BUILD !== '1' && !['storybook', 'inspect-storybook'].includes(mode)) await run('pnpm', ['build']);
  if (mode === 'all' || mode === 'storybook' || mode === 'inspect-storybook') {
    if (process.env.FIBONACCI_SKIP_BUILD !== '1') await run('pnpm', ['build-storybook']);
    const root = path.resolve('storybook-static');
    const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
    staticServer = http.createServer(async (req, res) => {
      try {
        const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
        if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
        res.setHeader('Content-Type', mime[path.extname(file)] ?? 'application/octet-stream');
        res.end(await readFile(file));
      } catch { res.writeHead(404).end(); }
    });
    staticServer.listen(0, '127.0.0.1');
    await once(staticServer, 'listening');
    env.STORYBOOK_URL = `http://127.0.0.1:${staticServer.address().port}`;
    console.log(`OWNED_STORYBOOK=${env.STORYBOOK_URL}`);
  }
  if (!['storybook', 'inspect-storybook'].includes(mode)) {
    if (process.env.FIBONACCI_LIVE_BINANCE !== '1') {
      const stub = await startBinanceStub();
      binanceStub = stub.server;
      env.BINANCE_BASE_URL = stub.url;
      console.log(`OWNED_BINANCE_STUB=${stub.url}`);
    }
    await startApp();
  }
  if (mode === 'inspect' || mode === 'inspect-storybook') await inspection;
  else {
    if (mode === 'all' || mode === 'api') {
      await mkdir('e2e/bruno-api-tests/reports', { recursive: true });
      await run(path.resolve('node_modules/.bin/bru'), ['run', '--env', 'local', '--env-var', `baseUrl=${env.BASE_URL}`, '--env-var', `upstreamUrl=${env.BINANCE_BASE_URL ?? ''}`, '--reporter-json', 'reports/results.json'], { cwd: path.resolve('e2e/bruno-api-tests') });
      await verifyRestartAndConcurrency();
    }
    if (mode === 'all' || mode === 'e2e' || mode === 'storybook') {
      const project = mode === 'all' ? [] : ['--project', mode === 'storybook' ? 'storybook' : 'chromium'];
      await run('pnpm', ['exec', 'playwright', 'test', ...project]);
    }
  }
} catch (error) { console.error(error); process.exitCode = 1; }
finally { await cleanup(); }
