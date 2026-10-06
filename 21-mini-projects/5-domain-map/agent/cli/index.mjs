#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { openStore, readJson, hash, id, now } from './store.mjs';
import { ensure, validateInput, validateAnalysis, validateEvolution, canonical, modes, roles } from './validate.mjs';

const agentRoot = fileURLToPath(new URL('../', import.meta.url));
const optionNames = ['root', 'input', 'previous', 'request', 'session', 'task', 'role', 'objective', 'file', 'kind', 'status', 'reason', 'mode', 'out', 'expected-version'];

function main() {
  const { values: options, positionals } = parseArgs({ allowPositionals: true, options: Object.fromEntries(optionNames.map((name) => [name, { type: 'string' }])) });
  const command = positionals.join(' ');
  const required = (name) => { ensure(options[name]?.trim(), `--${name} required`); return options[name]; };
  if (!command || command === 'help') return {
    commands: ['init', 'session create/list/show/resume/checkpoint/finish', 'task create/start/finish', 'artifact put', 'model validate/put/get/export', 'doctor'],
    usage: 'node cli/index.mjs COMMAND --root STORE (see cli/README.md)',
  };
  if (command === 'model validate') {
    const analysis = readJson(required('file'));
    const previous = options.previous ? readJson(options.previous) : undefined;
    if (previous) validateEvolution(previous, analysis);
    return validateAnalysis(analysis, options.input ? validateInput(readJson(options.input)) : undefined, previous);
  }
  const store = openStore(options.root ?? path.join(agentRoot, 'data'), command === 'init');
  if (command === 'init') return { root: store.root };
  const sessionOf = (catalog) => {
    const session = catalog.sessions.find((row) => row.id === required('session'));
    ensure(session, 'unknown session');
    return session;
  };
  const taskOf = (session) => {
    const task = session.tasks.find((row) => row.id === required('task'));
    ensure(task, 'unknown task');
    return task;
  };
  const running = (session) => ensure(session.status === 'running', 'session must be running; resume first');
  const latest = (session) => {
    ensure(session.models.length, 'no registered model');
    const model = session.models.at(-1);
    const artifact = session.artifacts.find((row) => row.id === model.artifactId);
    ensure(artifact, 'CORRUPT: missing model artifact');
    return { model, analysis: JSON.parse(store.bytes(artifact)) };
  };
  const draftFile = (session, task) => {
    const file = fs.realpathSync(required('file'));
    const draft = fs.realpathSync(store.path(task.draftPath));
    ensure(file.startsWith(`${draft}${path.sep}`), 'file must be inside the assigned task draft_dir');
    running(session);
    ensure(task.status === 'running', 'task must be running');
    return file;
  };
  if (command === 'session list') return store.read().sessions.map(({ id, request, status, mode, updatedAt }) => ({ id, request, status, mode, updatedAt }));
  if (command === 'session show') {
    const session = sessionOf(store.read());
    store.verify(session);
    return { ...session, draft_dir: store.path(session.draftPath), root: store.root };
  }
  if (command === 'model get') return latest(sessionOf(store.read()));
  if (command === 'doctor') {
    const catalog = store.read();
    for (const session of catalog.sessions) {
      store.verify(session);
      let previous;
      for (const model of session.models) {
        const artifact = session.artifacts.find((a) => a.id === model.artifactId);
        ensure(artifact, 'CORRUPT: missing model artifact');
        const analysis = JSON.parse(store.bytes(artifact));
        if (previous) validateEvolution(previous, analysis);
        validateAnalysis(analysis, session.input, previous);
        previous = analysis;
      }
    }
    return { healthy: true, sessions: catalog.sessions.length, revision: catalog.revision };
  }
  if (command === 'model export') {
    const session = sessionOf(store.read());
    store.verify(session);
    const { model, analysis } = latest(session);
    const output = path.resolve(required('out'));
    ensure(fs.existsSync(path.dirname(output)), 'export parent must exist');
    const parent = fs.realpathSync(path.dirname(output));
    const target = path.join(parent, path.basename(output));
    ensure(target !== store.root && !target.startsWith(`${store.root}${path.sep}`), 'export outside the managed store');
    ensure(!fs.existsSync(target), 'export target must not exist; preserve previous exports');
    fs.mkdirSync(target);
    const write = (name, value) => fs.writeFileSync(path.join(target, name), `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
    write('domain-model.json', analysis.domainModel);
    write('claims.json', analysis.claims);
    write('questions.json', analysis.questions);
    write('work-items.json', analysis.workItems);
    write('state.json', { schemaVersion: 1, runId: session.id, inputFingerprint: session.inputFingerprint, phase: session.mode, repositoryStates: analysis.repositories.map(({ id, status }) => ({ id, status })), pendingQueue: session.checkpoint.pendingQueue ?? [], lastPublishedRunId: session.checkpoint.lastPublishedRunId ?? null, modelVersion: model.version });
    fs.writeFileSync(path.join(target, 'evidence.jsonl'), analysis.evidence.map((row) => JSON.stringify(row)).join('\n') + (analysis.evidence.length ? '\n' : ''), { flag: 'wx' });
    fs.mkdirSync(path.join(target, 'repos'));
    for (const repo of analysis.repositories) write(`repos/${repo.id}.json`, repo);
    return { directory: target, modelVersion: model.version, mapStatus: 'NOT RUN' };
  }
  const mutations = ['session create', 'session resume', 'session checkpoint', 'session finish', 'task create', 'task start', 'task finish', 'artifact put', 'model put'];
  ensure(mutations.includes(command), `unknown command: ${command}`);
  return store.mutate((catalog) => {
    if (command === 'session create') {
      const input = validateInput(readJson(required('input')));
      const sessionId = id('session');
      const draftPath = `sessions/${sessionId}/drafts`;
      fs.mkdirSync(store.path(draftPath), { recursive: true });
      const session = { id: sessionId, request: required('request'), input, inputFingerprint: hash(canonical(input)), mode: input.mode, status: 'running', createdAt: now(), updatedAt: now(), draftPath, tasks: [], artifacts: [], models: [], checkpoint: { nextAction: 'inventory', unresolved: [], pendingQueue: input.repositories.map((repo) => repo.id), lastPublishedRunId: null }, events: [] };
      catalog.sessions.push(session);
      return { ...session, draft_dir: store.path(draftPath) };
    }
    const session = sessionOf(catalog);
    session.updatedAt = now();
    const event = { action: command, at: now() };
    session.events.push(event);
    if (command === 'session resume') {
      store.verify(session);
      const mode = options.mode ?? (session.status === 'completed' ? 'refresh' : 'continue');
      ensure(modes.includes(mode), 'invalid mode');
      session.status = 'running';
      session.mode = mode;
      return { ...session, draft_dir: store.path(session.draftPath) };
    }
    running(session);
    if (command === 'session checkpoint') {
      const checkpoint = readJson(required('file'));
      ensure(checkpoint && typeof checkpoint === 'object' && !Array.isArray(checkpoint), 'checkpoint object required');
      const allowed = ['nextAction', 'unresolved', 'pendingQueue', 'scope', 'validation', 'lastPublishedRunId'];
      ensure(Object.keys(checkpoint).every((key) => allowed.includes(key)), 'unsupported checkpoint field');
      if ('nextAction' in checkpoint) ensure(typeof checkpoint.nextAction === 'string', 'nextAction must be string');
      for (const key of ['unresolved', 'pendingQueue']) if (key in checkpoint) ensure(Array.isArray(checkpoint[key]) && checkpoint[key].every((v) => typeof v === 'string'), `${key} must be string array`);
      session.checkpoint = { ...session.checkpoint, ...checkpoint };
      return session.checkpoint;
    }
    if (command === 'session finish') {
      const status = required('status');
      ensure(['completed', 'partial', 'blocked', 'failed'].includes(status), 'invalid session status');
      if (status === 'completed') {
        ensure(session.tasks.length > 0 && session.tasks.every((t) => ['completed', 'skipped'].includes(t.status)), 'unfinished tasks');
        ensure(session.models.length > 0, 'registered analysis required');
        store.verify(session);
      } else required('reason');
      session.status = status;
      event.reason = options.reason ?? null;
      return session;
    }
    if (command === 'task create') {
      const role = required('role');
      ensure(roles.includes(role), 'invalid role');
      const taskId = id('task');
      const draftPath = `sessions/${session.id}/tasks/${taskId}/drafts`;
      fs.mkdirSync(store.path(draftPath), { recursive: true });
      const task = { id: taskId, role, objective: required('objective'), status: 'pending', draftPath };
      session.tasks.push(task);
      return { ...task, draft_dir: store.path(draftPath) };
    }
    const task = taskOf(session);
    event.taskId = task.id;
    if (command === 'task start') {
      ensure(['pending', 'running', 'blocked', 'failed'].includes(task.status), 'completed/skipped tasks cannot restart');
      task.status = 'running';
      return { ...task, draft_dir: store.path(task.draftPath) };
    }
    if (command === 'task finish') {
      const status = required('status');
      ensure(['completed', 'blocked', 'failed', 'skipped'].includes(status), 'invalid task status');
      ensure(task.status === 'running' || (status === 'skipped' && ['pending', 'blocked', 'failed'].includes(task.status)), 'invalid task transition');
      if (status === 'completed') {
        ensure(session.artifacts.some((a) => a.taskId === task.id), 'completed task needs artifact');
        store.verify(session);
      } else required('reason');
      task.status = status;
      task.reason = options.reason ?? null;
      return task;
    }
    const file = draftFile(session, task);
    if (command === 'artifact put') {
      const kind = required('kind');
      ensure(['report', 'task-result', 'likec4', 'validation', 'changes'].includes(kind), 'invalid artifact kind');
      const extension = ['task-result', 'validation', 'changes'].includes(kind) ? 'json' : kind === 'likec4' ? 'c4' : 'md';
      const data = fs.readFileSync(file);
      ensure(data.length > 0, 'artifact cannot be empty');
      if (extension === 'json') JSON.parse(data);
      return store.put(session, task, kind, data, extension);
    }
    const analysis = readJson(file);
    const currentVersion = session.models.at(-1)?.version ?? 0;
    ensure(Number(required('expected-version')) === currentVersion, 'CONFLICT: latest model version changed');
    const previous = currentVersion ? latest(session).analysis : undefined;
    if (previous) validateEvolution(previous, analysis);
    const counts = validateAnalysis(analysis, session.input, previous);
    const data = canonical(analysis);
    const artifact = store.put(session, task, 'analysis', data, 'json');
    if (session.models.at(-1)?.sha256 === hash(data)) return { ...session.models.at(-1), unchanged: true };
    const model = { version: currentVersion + 1, parentVersion: currentVersion || null, artifactId: artifact.id, sha256: artifact.sha256, createdAt: now(), reason: required('reason'), counts };
    session.models.push(model);
    return model;
  });
}

try {
  process.stdout.write(`${JSON.stringify({ ok: true, data: main() })}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({ ok: false, error: { message: error.message } })}\n`);
  process.exitCode = 1;
}
