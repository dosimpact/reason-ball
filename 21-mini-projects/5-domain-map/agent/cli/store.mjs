import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { ensure } from './validate.mjs';

export const hash = (data) => createHash('sha256').update(data).digest('hex');
export const now = () => new Date().toISOString();
export const id = (prefix) => `${prefix}-${randomUUID()}`;
export const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

export function safePath(root, relative) {
  const target = path.resolve(root, relative);
  ensure(target.startsWith(`${root}${path.sep}`), 'path must stay inside store');
  let current = root;
  for (const segment of path.relative(root, target).split(path.sep)) {
    current = path.join(current, segment);
    if (fs.existsSync(current) || (() => { try { fs.lstatSync(current); return true; } catch { return false; } })()) {
      ensure(!fs.lstatSync(current).isSymbolicLink(), 'managed paths must not be symlinks');
    }
  }
  return target;
}

function atomicJson(file, value) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  const descriptor = fs.openSync(temporary, 'wx', 0o600);
  try {
    fs.writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`);
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  fs.renameSync(temporary, file);
}

export function openStore(directory, initialize = false) {
  const requested = path.resolve(directory);
  if (initialize) fs.mkdirSync(requested, { recursive: true });
  ensure(fs.existsSync(requested), 'store missing; run init first');
  const root = fs.realpathSync(requested);
  const catalogPath = safePath(root, 'catalog.json');
  function read() {
    const catalog = readJson(catalogPath);
    ensure(catalog.schemaVersion === 1 && Number.isInteger(catalog.revision) && Array.isArray(catalog.sessions), 'invalid catalog');
    return catalog;
  }
  function mutate(callback) {
    const lock = safePath(root, '.write-lock');
    let fd;
    try { fd = fs.openSync(lock, 'wx', 0o600); } catch (error) {
      if (error.code === 'EEXIST') throw new Error('LOCKED: inspect .write-lock; do not remove an active writer lock');
      throw error;
    }
    try {
      fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, createdAt: now() }));
      const catalog = fs.existsSync(catalogPath) ? read() : { schemaVersion: 1, revision: 0, sessions: [] };
      const result = callback(catalog);
      catalog.revision += 1;
      atomicJson(catalogPath, catalog);
      return result;
    } finally {
      fs.closeSync(fd);
      fs.unlinkSync(lock);
    }
  }
  if (initialize) mutate(() => ({ root }));
  function bytes(artifact) {
    const data = fs.readFileSync(safePath(root, artifact.path));
    ensure(hash(data) === artifact.sha256, `CORRUPT: artifact ${artifact.id}`);
    return data;
  }
  function verify(session) {
    for (const artifact of session.artifacts) bytes(artifact);
  }
  function put(session, task, kind, data, extension) {
    const digest = hash(data);
    const existing = session.artifacts.find((a) => a.taskId === task.id && a.kind === kind && a.sha256 === digest);
    if (existing) { bytes(existing); return existing; }
    const relative = `objects/${digest}.${extension}`;
    const target = safePath(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (fs.existsSync(target)) ensure(hash(fs.readFileSync(target)) === digest, 'CORRUPT: existing object');
    else fs.writeFileSync(target, data, { flag: 'wx', mode: 0o600 });
    const artifact = { id: id('artifact'), taskId: task.id, kind, path: relative, sha256: digest, createdAt: now() };
    session.artifacts.push(artifact);
    return artifact;
  }
  return { root, read, mutate, bytes, verify, put, path: (relative) => safePath(root, relative) };
}
