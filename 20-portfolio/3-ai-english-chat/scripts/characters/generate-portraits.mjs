import { readFile, writeFile, mkdir, open, unlink } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const folder = resolve(root, 'assets/characters/talkie-homage');
const args = process.argv.slice(2);
const key = args[args.indexOf('--key') + 1];
const catalog = JSON.parse(await readFile(resolve(folder, 'catalog.json'), 'utf8'));
const item = catalog.characters.find(item => item.key === key);
if (!args.includes('--key') || !item) throw new Error('Use --key with one catalog character key.');
if (!args.includes('--apply')) {
  console.log(JSON.stringify({ key, model: 'gemini-3.1-flash-image', mode: 'dry-run', requests: 1 }));
} else {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is required.');
  await mkdir(resolve(folder, 'portraits'), { recursive: true });
  const receiptPath = resolve(folder, 'portraits', `${key}.json`);
  const existing = await readFile(receiptPath, 'utf8').catch(error => { if (error.code !== 'ENOENT') throw error; return null; });
  if (existing && !(args.includes('--retry-failed') && JSON.parse(existing).status === 'failed')) throw new Error('A receipt already exists. Only an explicit --retry-failed may retry a failed request.');
  const budgetPath = resolve(folder, 'production-budget.json');
  const lockPath = `${budgetPath}.lock`;
  const lock = await open(lockPath, 'wx');
  try {
    const budget = JSON.parse(await readFile(budgetPath, 'utf8'));
    if (!Number.isInteger(budget.image.maxRequests) || budget.image.maxRequests < 1 || !Number.isInteger(budget.image.reservedRequests) || budget.image.reservedRequests < 0) throw new Error('Invalid budget ledger.');
    if (budget.image.reservedRequests >= budget.image.maxRequests) throw new Error('Image request budget exhausted.');
    budget.image.reservedRequests += 1;
    budget.events.push({ kind: 'image', requests: 1, note: `Talkie homage portrait ${key}; reserved before request, no automatic retry.` });
    await writeFile(budgetPath, JSON.stringify(budget, null, 2) + '\n');
    await writeFile(receiptPath, JSON.stringify({ key, status: 'reserved', model: 'gemini-3.1-flash-image', startedAt: new Date().toISOString() }, null, 2));
  } finally { await lock.close(); await unlink(lockPath); }
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST', headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gemini-3.1-flash-image', input: item.imagePrompt,
      response_format: { type: 'image', aspect_ratio: '2:3', image_size: '1K' }, store: false }),
    signal: AbortSignal.timeout(120000), redirect: 'error',
  });
  const result = await response.json();
  if (!response.ok) {
    const receipt = { key, status: 'failed', failedAt: new Date().toISOString(), model: 'gemini-3.1-flash-image', httpStatus: response.status, code: result.error?.status,
      quota: result.error?.details?.flatMap(d => d.violations ?? []).map(v => ({ metric: v.quotaMetric, id: v.quotaId, value: v.quotaValue })) ?? [] };
    await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
    console.log(JSON.stringify(receipt));
    process.exitCode = 1;
  } else {
    const media = result.steps?.filter(s => s.type === 'model_output').flatMap(s => s.content ?? []).findLast(c => c.type === 'image' && c.data);
    const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[media?.mime_type];
    if (!extension) throw new Error('No supported image returned; reservation is retained.');
    const bytes = Buffer.from(media.data, 'base64');
    const filename = `${key}.${extension}`;
    await writeFile(resolve(folder, 'portraits', filename), bytes);
    const receipt = { key, status: 'generated', provider: 'google', model: 'gemini-3.1-flash-image', filename,
      mimeType: media.mime_type, promptSha256: createHash('sha256').update(item.imagePrompt).digest('hex'), sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
    await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
    console.log(JSON.stringify(receipt));
  }
}
