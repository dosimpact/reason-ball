import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pgv-state-mcp-tests-'));
const outfile = path.join(testDir, 'tests.cjs');

try {
  await build({
    stdin: {
      contents: [
        "import './tests/server.test.ts';",
        "import './tests/workflow.test.ts';"
      ].join('\n'),
      resolveDir: packageDir,
      sourcefile: 'tests.ts'
    },
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    loader: { '.md': 'text' },
    legalComments: 'none'
  });

  const result = spawnSync(process.execPath, ['--test', outfile], {
    stdio: 'inherit'
  });

  if (result.error) {
    throw result.error;
  }
  process.exitCode = result.status ?? 1;
} finally {
  fs.rmSync(testDir, { recursive: true, force: true });
}
