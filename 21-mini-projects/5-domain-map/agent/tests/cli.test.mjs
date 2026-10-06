import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = path.join(root, 'cli/index.mjs');
const input = path.join(root, 'examples/input.json');
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'examples/analysis.json')));

function harness(t) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'domain-agent-test-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const store = path.join(temporary, 'data');
  function run(args, failure) {
    const process = spawnSync(globalThis.process.execPath, [cli, ...args, '--root', store], { encoding: 'utf8', cwd: temporary });
    if (failure) {
      assert.equal(process.status, 1, process.stdout + process.stderr);
      const result = JSON.parse(process.stderr);
      assert.equal(result.ok, false);
      assert.match(result.error.message, failure);
      return result;
    }
    assert.equal(process.status, 0, process.stderr);
    const result = JSON.parse(process.stdout);
    assert.equal(result.ok, true);
    return result.data;
  }
  run(['init']);
  const session = run(['session', 'create', '--input', input, '--request', '합성 초기 조사']);
  const s = ['--session', session.id];
  const task = run(['task', 'create', ...s, '--role', 'domain-modeler', '--objective', '합성 모델 등록']);
  const st = [...s, '--task', task.id];
  run(['task', 'start', ...st]);
  const file = path.join(task.draft_dir, 'analysis.json');
  const write = (value) => fs.writeFileSync(file, JSON.stringify(value));
  const put = (version = 0, failure) => run(['model', 'put', ...st, '--file', file, '--expected-version', String(version), '--reason', '합성 검증'], failure);
  write(fixture);
  return { run, session, s, task, st, file, write, put, store, temporary };
}

test('bootstrap registration, checkpoint, completion, resume and exchange export', (t) => {
  const h = harness(t);
  h.run(['session', 'finish', ...h.s, '--status', 'completed'], /unfinished tasks/);
  const first = h.put();
  assert.equal(first.version, 1);
  assert.equal(h.put(1).unchanged, true);
  const checkpoint = path.join(h.session.draft_dir, 'checkpoint.json');
  fs.writeFileSync(checkpoint, JSON.stringify({ nextAction: 'API 계약 확인', pendingQueue: ['question-contract'] }));
  h.run(['session', 'checkpoint', ...h.s, '--file', checkpoint]);
  h.run(['task', 'finish', ...h.st, '--status', 'completed']);
  h.run(['session', 'finish', ...h.s, '--status', 'completed']);
  const resumed = h.run(['session', 'resume', ...h.s, '--mode', 'refresh']);
  assert.equal(resumed.checkpoint.nextAction, 'API 계약 확인');
  assert.equal(resumed.tasks[0].status, 'completed');
  const output = path.join(h.temporary, 'export');
  h.run(['model', 'export', ...h.s, '--out', output]);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(output, 'domain-model.json'))), fixture.domainModel);
  assert.equal(JSON.parse(fs.readFileSync(path.join(output, 'state.json'))).modelVersion, 1);
  h.run(['model', 'export', ...h.s, '--out', output], /must not exist/);
  assert.equal(h.run(['doctor']).healthy, true);
});

test('missing input repositories and wrong input sources are rejected', (t) => {
  const h = harness(t);
  const missing = structuredClone(fixture);
  missing.repositories = [];
  h.write(missing);
  h.put(0, /every input repository/);
  const wrong = structuredClone(fixture);
  wrong.repositories[0].source = 'another-repo';
  h.write(wrong);
  h.put(0, /mismatched source/);
});

test('unsupported assertions, dangling relationship and unbound claim are rejected', (t) => {
  const h = harness(t);
  for (const [mutate, error] of [
    [(v) => { v.claims[0].evidenceIds = []; }, /references required/],
    [(v) => { v.domainModel.relationships[0].to = 'missing-system'; }, /unknown endpoint/],
    [(v) => { v.domainModel.relationships[0].claimIds = ['claim-domain']; }, /does not describe relationship/],
    [(v) => { v.claims[0].basis = 'guessed'; }, /invalid basis/],
  ]) {
    const value = structuredClone(fixture);
    mutate(value);
    h.write(value);
    h.put(0, error);
  }
});

test('dirty evidence requires a content hash', (t) => {
  const h = harness(t);
  const value = structuredClone(fixture);
  value.repositories[0].dirty = true;
  value.evidence[0].revision = 'old-commit';
  delete value.evidence[0].contentHash;
  h.write(value);
  h.put(0, /dirty source requires hash/);
});

test('evidence history and optimistic model version cannot be overwritten', (t) => {
  const h = harness(t);
  h.put();
  h.put(0, /CONFLICT/);
  const value = structuredClone(fixture);
  value.evidence[0].summary = 'rewritten past';
  h.write(value);
  h.put(1, /immutable/);
  assert.equal(h.run(['model', 'get', ...h.s]).model.version, 1);
  const next = structuredClone(fixture);
  next.evidence.push({ ...next.evidence[0], id: 'evidence-new', summary: '새 관찰' });
  next.claims[0].evidenceIds.push('evidence-new');
  h.write(next);
  assert.equal(h.put(1).version, 2);
});

test('partial state and blocked task resume without discarding prior work', (t) => {
  const h = harness(t);
  h.run(['task', 'finish', ...h.st, '--status', 'blocked', '--reason', '접근 불가']);
  h.run(['session', 'finish', ...h.s, '--status', 'partial', '--reason', '예산 종료']);
  h.put(0, /must be running/);
  h.run(['session', 'resume', ...h.s]);
  h.run(['task', 'start', ...h.st]);
  h.put();
  h.run(['task', 'finish', ...h.st, '--status', 'completed']);
  h.run(['task', 'start', ...h.st], /cannot restart/);
});

test('foreign drafts, output traversal and active writer lock are refused', (t) => {
  const h = harness(t);
  h.run(['model', 'put', ...h.st, '--file', path.join(root, 'examples/analysis.json'), '--expected-version', '0', '--reason', 'outside'], /assigned task/);
  h.put();
  h.run(['model', 'export', ...h.s, '--out', path.join(h.store, 'export')], /outside the managed store/);
  fs.writeFileSync(path.join(h.store, '.write-lock'), JSON.stringify({ pid: process.pid }));
  h.run(['session', 'resume', ...h.s], /LOCKED/);
  assert.equal(h.run(['session', 'show', ...h.s]).models.length, 1);
});

test('corrupt objects block resume and doctor without resetting the catalog', (t) => {
  const h = harness(t);
  h.put();
  const session = h.run(['session', 'show', ...h.s]);
  fs.writeFileSync(path.join(h.store, session.artifacts[0].path), 'corrupt');
  h.run(['session', 'resume', ...h.s], /CORRUPT/);
  h.run(['doctor'], /CORRUPT/);
  h.run(['init']);
  assert.equal(h.run(['session', 'list']).length, 1);
});

test('a hypothesis may lack evidence while inaccessible inputs remain explicit', (t) => {
  const h = harness(t);
  const value = structuredClone(fixture);
  value.repositories[0].status = 'inaccessible';
  value.repositories[0].reason = '권한 부족, 이전 근거는 보존';
  value.claims[0].status = 'stale';
  h.write(value);
  h.put();
  assert.equal(h.run(['model', 'get', ...h.s]).analysis.repositories[0].status, 'inaccessible');
});

test('renaming a retired entity preserves historical claims via aliases', (t) => {
  const h = harness(t);
  h.put();
  const next = structuredClone(fixture);
  next.claims[1].status = 'superseded';
  next.claims.push({ ...next.claims[1], id: 'claim-new-domain', status: 'hypothesis', entityIds: ['domain-sales'] });
  next.domainModel.domains[0].id = 'domain-sales';
  next.domainModel.domains[0].claimIds = ['claim-new-domain'];
  next.repositories[0].candidateDomainIds = ['domain-sales'];
  next.domainModel.idAliases = [{ from: 'domain-commerce', to: ['domain-sales'], reason: '업무 경계 재정의' }];
  h.write(next);
  assert.equal(h.put(1).version, 2);
});

test('clean revision-only history survives dirty refresh and a later clean snapshot', (t) => {
  const h = harness(t);
  const clean = structuredClone(fixture);
  clean.repositories[0].revision = 'clean-commit';
  clean.evidence[0].revision = 'clean-commit';
  delete clean.evidence[0].contentHash;
  h.write(clean);
  h.put();
  const previous = path.join(h.task.draft_dir, 'previous.json');
  fs.writeFileSync(previous, JSON.stringify(clean));
  const dirty = structuredClone(clean);
  dirty.repositories[0].dirty = true;
  dirty.evidence.push({ ...fixture.evidence[0], id: 'evidence-dirty', revision: 'clean-commit' });
  dirty.claims[0].evidenceIds.push('evidence-dirty');
  h.write(dirty);
  h.run(['model', 'validate', '--file', h.file, '--input', input, '--previous', previous]);
  assert.equal(h.put(1).version, 2);
  assert.deepEqual(h.run(['model', 'get', ...h.s]).analysis.evidence[0], clean.evidence[0]);
  assert.equal(h.run(['doctor']).healthy, true);
  const missingHash = structuredClone(dirty);
  missingHash.evidence.push({ ...clean.evidence[0], id: 'evidence-new-without-hash' });
  h.write(missingHash);
  h.put(2, /dirty source requires hash/);
  const cleanAgain = structuredClone(dirty);
  cleanAgain.repositories[0].dirty = false;
  cleanAgain.repositories[0].revision = 'next-clean-commit';
  h.write(cleanAgain);
  assert.equal(h.put(2).version, 3);
  assert.equal(h.run(['doctor']).healthy, true);
});

test('ambiguous source fields are rejected before creating a session', (t) => {
  const h = harness(t);
  const base = JSON.parse(fs.readFileSync(input));
  const candidate = path.join(h.temporary, 'input.json');
  for (const invalid of [
    { path: '', url: 'synthetic://commerce' },
    { path: 0, url: 'synthetic://commerce' },
    { path: null, url: 'synthetic://commerce' },
    { path: 'synthetic://commerce', url: '' },
  ]) {
    fs.writeFileSync(candidate, JSON.stringify({ ...base, repositories: [{ id: 'repo-commerce', ...invalid }] }));
    h.run(['session', 'create', '--input', candidate, '--request', 'invalid source'], /exactly one path or url/);
  }
  assert.equal(h.run(['session', 'list']).length, 1);
  fs.writeFileSync(candidate, JSON.stringify({ ...base, repositories: [{ id: 'repo-commerce', url: 'synthetic://commerce' }] }));
  const session = h.run(['session', 'create', '--input', candidate, '--request', 'URL only']);
  assert.equal(session.input.repositories[0].url, 'synthetic://commerce');
  h.run(['model', 'validate', '--file', h.file, '--input', candidate]);
});

test('unchanged refresh can complete with the existing model version', (t) => {
  const h = harness(t);
  h.put();
  h.run(['task', 'finish', ...h.st, '--status', 'completed']);
  h.run(['session', 'finish', ...h.s, '--status', 'completed']);
  h.run(['session', 'resume', ...h.s, '--mode', 'refresh']);
  const task = h.run(['task', 'create', ...h.s, '--role', 'change-reviewer', '--objective', '변경 없음 확인']);
  const st = [...h.s, '--task', task.id];
  h.run(['task', 'start', ...st]);
  const report = path.join(task.draft_dir, 'changes.json');
  fs.writeFileSync(report, JSON.stringify({ changed: false, nextActions: [] }));
  h.run(['artifact', 'put', ...st, '--kind', 'changes', '--file', report]);
  h.run(['task', 'finish', ...st, '--status', 'completed']);
  const completed = h.run(['session', 'finish', ...h.s, '--status', 'completed']);
  assert.equal(completed.models.length, 1);
});

test('placeholder hashes and non-string question targets are rejected', (t) => {
  const h = harness(t);
  for (const [mutate, error] of [
    [(v) => { v.evidence[0].contentHash = 'todo'; }, /SHA-256/],
    [(v) => { v.repositories[0].inspectedPaths[0].contentHash = 'todo'; }, /SHA-256/],
    [(v) => { v.questions[0].nextEvidenceToRead = [42]; }, /nextEvidenceToRead/],
  ]) {
    const value = structuredClone(fixture);
    mutate(value);
    h.write(value);
    h.put(0, error);
  }
});
