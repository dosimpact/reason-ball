import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const spec = read('../src/generated/spec.json');
const coverage = read('../src/lib/shadcn-genui/expanded-shadcn/coverage.json');
const magic = read('../src/components/magicui/provenance.json');
assert.equal(spec.root, 'Card');
assert.equal(new Set(coverage.entries.map(x=>x.slug)).size, coverage.entries.length);
assert.equal(new Set(magic.map(x=>x.slug)).size, magic.length);
for (const entry of coverage.entries) {
  assert.ok(entry.source.startsWith('https://ui.shadcn.com/'));
  for (const name of entry.components) assert.ok(spec.components[name], `${entry.slug}: unregistered ${name}`);
}
for (const entry of magic) {
  assert.ok(entry.url.startsWith('https://magicui.design/'));
  assert.match(entry.sha256, /^[a-f0-9]{64}$/);
}
const magicNames = Object.keys(spec.components).filter(x=>x.startsWith('Magic'));
assert.equal(magicNames.length, magic.length, 'Magic source/definition count mismatch');
const frontend = readFileSync(new URL('../src/generated/system-prompt.txt',import.meta.url),'utf8');
const backend = readFileSync(new URL('../../backend-langgraph/agent/system-prompt.txt',import.meta.url),'utf8');
assert.equal(frontend, backend, 'Packaged backend prompt must match generated prompt');
for (const name of Object.keys(spec.components)) assert.ok(frontend.includes(`${name}(`), `Missing prompt signature ${name}`);
console.log(`PASS: ${coverage.entries.length} shadcn entries, ${magic.length} Magic sources, ${Object.keys(spec.components).length} definitions; prompt ${Buffer.byteLength(frontend)} bytes synchronized`);
