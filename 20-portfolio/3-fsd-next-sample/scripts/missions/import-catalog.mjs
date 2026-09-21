#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { validateCatalog } from './validate-catalog.mjs';
import { mapMissionImport, sha256 } from './import-mapper.mjs';
import { createRemoteClient, importOne, runImport } from './import-remote.mjs';

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../assets/missions');
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));

export async function loadImportPlans(root, options) {
  await validateCatalog(root, { complete: true });
  const index = await readJson(join(root, 'catalog.json'));
  const categories = (await readJson(join(root, 'categories.json'))).categories;
  const plans = [];
  for (const category of index.catalogs) {
    const catalog = await readJson(join(root, category.file));
    for (const entry of catalog.missions) {
      const body = await readJson(join(root, entry.file));
      const categoryInfo = categories.find(item => item.id === body.categoryId);
      plans.push(mapMissionImport(body, options, categoryInfo?.name, categoryInfo?.subcategories.find(item => item.id === body.subcategoryId)?.name));
    }
  }
  return plans;
}

export async function main(args = process.argv.slice(2), env = process.env) {
  const { values } = parseArgs({ args, options: {
    visibility: { type: 'string' }, root: { type: 'string' }, owner: { type: 'string' }, character: { type: 'string' },
    'reward-file': { type: 'string' }, 'reward-prefix': { type: 'string' }, 'reward-xp': { type: 'string' },
    concurrency: { type: 'string', default: '4' }, keys: { type: 'string' }, apply: { type: 'boolean', default: false }, help: { type: 'boolean', default: false },
  } });
  if (values.help) {
    console.log('Usage: node [--env-file=apps/web/.env.local] scripts/missions/import-catalog.mjs --owner UUID --character UUID --reward-file PNG --reward-prefix OWNER/mission-catalog --reward-xp 120 --visibility public|private [--keys key1,key2] [--concurrency 4] [--apply]\nDefault: validate and report a local dry run. --apply uses SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY. Keys are read only from environment, never command arguments or output. PNG objects are unique per mission and never overwritten.');
    return;
  }
  if (!values['reward-file']) throw new Error('--reward-file PNG required');
  const image = await readFile(resolve(values['reward-file']));
  if (!image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('reward file must be PNG');
  const concurrency = Number(values.concurrency);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 6) throw new Error('--concurrency must be 1..6');
  const root = resolve(values.root ?? defaultRoot);
  const plans = await loadImportPlans(root, { visibility: values.visibility, ownerId: values.owner, characterId: values.character, rewardPrefix: values['reward-prefix'], rewardXp: values['reward-xp'] === undefined ? NaN : Number(values['reward-xp']), rewardSha256: sha256(image) });
  const selectedKeys = values.keys ? new Set(values.keys.split(',')) : null;
  if (selectedKeys && [...selectedKeys].some(key => !plans.some(plan => plan.key === key))) throw new Error('--keys includes unknown mission');
  const selected = selectedKeys ? plans.filter(plan => selectedKeys.has(plan.key)) : plans;
  console.log(JSON.stringify({ mode: values.apply ? 'apply' : 'dry-run', visibility: values.visibility, catalogMissions: plans.length, selectedMissions: selected.length, ownerId: values.owner, characterId: values.character, rewardXp: Number(values['reward-xp']), rewardSha256: sha256(image), concurrency }));
  if (!values.apply) return;
  const client = createRemoteClient({ url: env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL, serviceKey: env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY });
  // Fail before any upload if the assigned-catalog boundary is not installed.
  await client.read('mission_catalog_entries', { select: 'mission_id,authoring_key', limit: '1' });
  const characters = await client.read('characters', { select: 'id,owner_id,current_version_id,status,visibility', id: `eq.${values.character}` });
  const character = characters[0];
  if (characters.length !== 1 || !character.current_version_id || !(character.owner_id === values.owner || character.owner_id === null || (character.status === 'published' && character.visibility === 'public'))) throw new Error('Recommended character is unavailable');
  const categories = await client.read('mission_categories', { select: 'id,parent_id,depth' });
  for (const plan of selected) {
    const remote = categories.find(category => category.id === plan.categoryId);
    if (!remote || remote.depth !== 1 || remote.parent_id !== plan.payload.evaluatorConfig.catalogImport.source.categoryId) throw new Error(`${plan.key}: remote category migration mismatch`);
  }
  let finished = 0;
  const results = await runImport(selected, async plan => {
    const status = await importOne(client, plan, image);
    finished++;
    if (finished % 25 === 0 || finished === selected.length) console.log(JSON.stringify({ completed: finished, total: selected.length }));
    return status;
  }, concurrency);
  console.log(JSON.stringify({ published: results.filter(result => result.status === 'published').length, unchanged: results.filter(result => result.status === 'unchanged').length, total: results.length }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(`Mission import stopped: ${error.message}`); process.exitCode = 1; });
}
