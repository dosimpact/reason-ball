import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('src');
const layers = ['app', 'views', 'widgets', 'features', 'entities', 'shared'];
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]))).flat();
}
const errors = [];
for (const file of await files(root)) {
  if (!/\.tsx?$/.test(file)) continue;
  const own = path.relative(root, file).split(path.sep);
  const source = await readFile(file, 'utf8');
  for (const [, spec] of source.matchAll(/(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g)) {
    if (!spec.startsWith('@/') && !spec.startsWith('.')) continue;
    const target = spec.startsWith('@/') ? spec.slice(2).split('/') : path.relative(root, path.resolve(path.dirname(file), spec)).split(path.sep);
    const a = layers.indexOf(own[0]), b = layers.indexOf(target[0]);
    if (target[0] === 'server' && own[0] !== 'server' && !(own[0] === 'app' && own[1] === 'api')) errors.push(`${file}: server import ${spec}`);
    if (a >= 0 && b >= 0 && b < a) errors.push(`${file}: upward import ${spec}`);
    if (a === b && a > 0 && a < 5 && own[1] !== target[1] && !target.includes('@x')) errors.push(`${file}: cross-slice import ${spec}`);
    if (a >= 0 && b >= 1 && b <= 4 && a !== b && target.length > 2 && !target.includes('@x') && target[2] !== 'index') errors.push(`${file}: private slice import ${spec}`);
  }
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log('FSD imports: downward layers, public slice APIs, explicit entity relations, server boundary PASS');
