import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.CHAT_TEST_URL || 'http://127.0.0.1:3046';
const scenarios = [
  ['expanded-shadcn', 'Return a Card containing a CollapsibleBlock titled Details with sample text and a TooltipBlock. Use these exact registered components.', ['CollapsibleBlock', 'TooltipBlock']],
  ['magic', 'Return a Card containing MagicNumberTicker showing 75 and MagicAuroraText saying Sample dashboard. Use these exact registered components.', ['MagicNumberTicker', 'MagicAuroraText']],
  ['mixed', 'Return a Card with MagicAuroraText saying Sample report, a Table of two sample rows and a Form with one email Input and a submit Button. Use the exact named registered components.', ['MagicAuroraText', 'Table', 'Form']],
];
await mkdir('output/validation', { recursive: true });
for (const [id, prompt, names] of scenarios) {
  const response = await fetch(`${base}/api/chat`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({messages:[{id,role:'user',content:prompt}]}), signal: AbortSignal.timeout(180000) });
  assert.equal(response.status, 200);
  const raw = await response.text();
  await writeFile(`output/validation/catalog-${id}.sse`, raw);
  const events = raw.split(/\r?\n/).filter(x=>x.startsWith('data:')).map(x=>JSON.parse(x.slice(5)));
  assert.equal(events.at(-1)?.type, 'RUN_FINISHED');
  assert.ok(!events.some(x=>x.type==='RUN_ERROR'));
  const program = events.filter(x=>x.type==='TEXT_MESSAGE_CONTENT').map(x=>x.delta).join('');
  for (const name of names) assert.ok(program.includes(`${name}(`), `${id}: missing ${name}`);
  await writeFile(`output/validation/catalog-${id}.openui`, program);
  console.log(`${id}: stream and requested component names PASS (${program.length} chars); browser rendering validated separately`);
}
