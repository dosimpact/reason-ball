import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');
const copyTargets = ['index.ts', 'src', 'tests', 'README.md'];

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

for (const target of copyTargets) {
  copyEntry(path.join(rootDir, target), path.join(distDir, target));
}

function copyEntry(sourcePath, targetPath) {
  const stat = fs.statSync(sourcePath);
  if (stat.isDirectory()) {
    fs.mkdirSync(targetPath, { recursive: true });
    for (const entry of fs.readdirSync(sourcePath)) {
      copyEntry(path.join(sourcePath, entry), path.join(targetPath, entry));
    }
    return;
  }

  if (sourcePath.endsWith('.ts')) {
    const outPath = targetPath.replace(/\.ts$/, '.js');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, transpilePseudoTs(fs.readFileSync(sourcePath, 'utf8')));
    return;
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
}

function transpilePseudoTs(source) {
  return source
    .replace(/^\/\/ @ts-nocheck\n/, '')
    .replace(/\nexport \{\};\n?$/s, '\n');
}
