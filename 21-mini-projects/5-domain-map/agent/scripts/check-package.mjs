import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const errors = [];
let files = 0;
let skills = 0;
function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['data', 'site', 'node_modules', '.git'].includes(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      if (!fs.existsSync(file)) errors.push(`broken symlink: ${file}`);
      continue;
    }
    if (entry.isDirectory()) { visit(file); continue; }
    files += 1;
    if (file.endsWith('.mjs')) {
      const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
      if (result.status !== 0) errors.push(result.stderr);
    }
    if (!file.endsWith('.md')) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1].split('#')[0];
      if (!target || /^[a-z]+:/.test(target)) continue;
      if (!fs.existsSync(path.resolve(directory, target))) errors.push(`broken link: ${file} -> ${target}`);
    }
    if (entry.name === 'SKILL.md') {
      skills += 1;
      const frontmatter = text.match(/^---\nname: ([a-z0-9-]+)\ndescription: ([^\n]+)\n---/);
      if (!frontmatter || frontmatter[1] !== path.basename(directory)) errors.push(`invalid skill metadata: ${file}`);
    }
  }
}
visit(root);
if (skills !== 6) errors.push(`expected 6 skills, found ${skills}`);
console.log(JSON.stringify({ files, skills, errors }, null, 2));
process.exitCode = errors.length ? 1 : 0;
