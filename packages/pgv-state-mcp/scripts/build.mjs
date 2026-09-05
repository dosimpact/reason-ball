import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const legacyDistDir = path.join(packageDir, 'dist');
const releaseDir = path.join(packageDir, 'release');
const outfile = path.join(releaseDir, 'latest.js');

fs.rmSync(legacyDistDir, { recursive: true, force: true });
fs.mkdirSync(releaseDir, { recursive: true });

await build({
  entryPoints: [path.join(packageDir, 'index.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  loader: { '.md': 'text' },
  legalComments: 'none'
});

fs.chmodSync(outfile, 0o755);
console.log(`Bundled pgv-state-mcp to ${path.relative(packageDir, outfile)}`);
