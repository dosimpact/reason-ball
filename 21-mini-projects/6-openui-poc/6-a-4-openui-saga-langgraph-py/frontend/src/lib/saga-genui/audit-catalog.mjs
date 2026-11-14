/** Reconcile the stable public @grafana/ui declarations with the reviewed catalog. */
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
const require = createRequire(import.meta.url);
let root = dirname(require.resolve('@grafana/ui'));
while (!existsSync(resolve(root, 'package.json'))) root = dirname(root);
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
if (pkg.version !== '13.3.0') throw new Error(`Expected @grafana/ui@13.3.0; found ${pkg.version}`);
const manifest = JSON.parse(readFileSync(new URL('./manifest.json', import.meta.url), 'utf8'));
const names = new Set();
function collect(text, origin) {
  for (const match of text.matchAll(/export\s*\{([^{}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    for (const spec of match[1].split(',')) {
      const trimmed = spec.trim();
      if (trimmed && !trimmed.startsWith('type ')) names.add(trimmed.split(' as ').at(-1).trim());
    }
  }
  for (const match of text.matchAll(/export\s*\{([^{}]*)\}\s*;/g)) {
    for (const spec of match[1].split(',')) { const name = spec.trim(); if (name && !name.startsWith('type ')) names.add(name.split(' as ').at(-1).trim()); }
  }
  for (const match of text.matchAll(/export\s+\*\s+from\s*['"]([^'"]+)['"]/g)) {
    let path = resolve(dirname(origin), `${match[1]}.d.ts`);
    if (!existsSync(path)) path = resolve(dirname(origin), match[1], 'index.d.ts');
    if (!existsSync(path)) continue;
    const child = readFileSync(path, 'utf8');
    for (const exported of child.matchAll(/export\s+(?:declare\s+)?(?:const|let|function|class|enum)\s+(\w+)/g)) names.add(exported[1]);
    collect(child, path);
  }
}
const origin = resolve(root, 'dist/types/index.d.ts');
collect(readFileSync(origin, 'utf8'), origin);
const represented = new Set(manifest.map(entry => entry.name));
const missing = [...names].filter(name => !represented.has(name));
const phantom = [...represented].filter(name => !names.has(name));
console.log(JSON.stringify({ package: `${pkg.name}@${pkg.version}`, stableNamedRuntimeExports: names.size, catalogEntries: manifest.length, supported: manifest.filter(entry => entry.status === 'supported').length, excluded: manifest.filter(entry => entry.status === 'excluded').length, missing, phantom, unstable: 'Excluded: upstream marks unstable entrypoint MUST NOT BE USED EXTERNALLY OR IN PLUGINS; Grafana core only.' }, null, 2));
if (missing.length || phantom.length) process.exitCode = 1;
