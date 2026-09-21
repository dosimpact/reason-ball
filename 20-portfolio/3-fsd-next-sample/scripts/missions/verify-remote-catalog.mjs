#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { loadImportPlans } from './import-catalog.mjs';
import { createRemoteClient, verifyState } from './import-remote.mjs';
import { canonicalJson, sha256 } from './import-mapper.mjs';

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const same = (a, b) => canonicalJson(a) === canonicalJson(b);
const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../assets/missions');

// Keep pages below both the API default cap and the import's largest step group.
// Continue until an empty page so a server cap lower than 200 does not truncate.
export async function readAllPages(client, table, query, pageSize = 200) {
  assert(Number.isInteger(pageSize) && pageSize >= 1 && pageSize <= 200, 'page size must be 1..200');
  assert(query.order, 'stable ordering required for paged verification');
  const result = [];
  for (;;) {
    const rows = await client.read(table, { ...query, limit: String(pageSize), offset: String(result.length) });
    assert(Array.isArray(rows), `${table}: expected rows`);
    if (!rows.length) return result;
    result.push(...rows);
  }
}
function only(rows, field, id, label) {
  const matches = rows.filter(row => row[field] === id);
  assert(matches.length === 1, `${label}: expected exactly one row`);
  return matches[0];
}
function requireFields(row, expected, label) {
  for (const [field, value] of Object.entries(expected)) assert(same(row[field], value), `${label}: ${field} differs`);
}

export async function verifyRemoteCatalog(client, plans, { onProgress = () => {} } = {}) {
  const [entries, managers, catalogStates] = await Promise.all([
    readAllPages(client, 'mission_catalog_entries', { select: 'mission_id,authoring_key', order: 'mission_id.asc' }),
    readAllPages(client, 'mission_catalog_managers', { select: 'user_id', order: 'user_id.asc' }),
    readAllPages(client, 'mission_catalog_state', { select: 'singleton,is_ready', order: 'singleton.asc' }),
  ]);
  assert(entries.length === plans.length, `catalog count mismatch: expected ${plans.length}, found ${entries.length}`);
  assert(new Set(entries.map(entry => entry.mission_id)).size === entries.length && new Set(entries.map(entry => entry.authoring_key)).size === entries.length, 'catalog identities are not unique');
  assert(managers.length >= 1, 'catalog manager missing');
  assert(catalogStates.length === 1 && catalogStates[0].singleton === true, 'catalog state missing');
  for (const plan of plans) {
    const entry = only(entries, 'mission_id', plan.missionId, plan.key);
    assert(entry.authoring_key === plan.key, `${plan.key}: catalog key differs`);
  }
  const counts = { missions: 0, versions: 0, instructions: 0, steps: 0, hints: 0, rewards: 0, assets: 0, characterLinks: 0 };
  const levels = {}; const categories = {}; const subcategories = {};
  for (let start = 0; start < plans.length; start += 50) {
    const group = plans.slice(start, start + 50);
    const missionFilter = `in.(${group.map(plan => plan.missionId).join(',')})`;
    const versionFilter = `in.(${group.map(plan => plan.versionId).join(',')})`;
    const assetFilter = `in.(${group.map(plan => plan.payload.rewardAsset.id).join(',')})`;
    const [missions, versions, instructions, steps, rewards, assets, links] = await Promise.all([
      readAllPages(client, 'missions', { select: '*', id: missionFilter, order: 'id.asc' }),
      readAllPages(client, 'mission_versions', { select: '*', id: versionFilter, order: 'id.asc' }),
      readAllPages(client, 'mission_version_instructions', { select: '*', mission_version_id: versionFilter, order: 'mission_version_id.asc' }),
      readAllPages(client, 'mission_steps', { select: '*', mission_version_id: versionFilter, order: 'mission_version_id.asc,step_order.asc' }),
      readAllPages(client, 'mission_rewards', { select: '*', mission_version_id: versionFilter, order: 'id.asc' }),
      readAllPages(client, 'character_assets', { select: '*', id: assetFilter, order: 'id.asc' }),
      readAllPages(client, 'mission_characters', { select: '*', mission_id: missionFilter, order: 'mission_id.asc,character_id.asc' }),
    ]);
    for (const plan of group) {
      const p = plan.payload;
      const mission = only(missions, 'id', plan.missionId, plan.key);
      const version = only(versions, 'id', plan.versionId, plan.key);
      const instruction = only(instructions, 'mission_version_id', plan.versionId, plan.key);
      const missionSteps = steps.filter(step => step.mission_version_id === plan.versionId).sort((a, b) => a.step_order - b.step_order);
      const missionRewards = rewards.filter(reward => reward.mission_version_id === plan.versionId);
      requireFields(mission, { owner_id: plan.ownerId, current_version_id: plan.versionId, status: 'published' }, plan.key);
      assert(Boolean(mission.published_at && version.published_at), `${plan.key}: publication timestamps missing`);
      requireFields(version, { mission_id: plan.missionId, created_by: plan.ownerId, version_number: 1 }, plan.key);
      verifyState({ mission, version, instructions: instruction, steps: missionSteps, rewards: missionRewards }, plan, { completed: true });
      const source = instruction.evaluator_config.catalogImport;
      assert(source.sourceSha256 === sha256(canonicalJson(source.source)) && source.sourceSha256 === plan.sourceSha256 && source.mappingSha256 === plan.mappingSha256, `${plan.key}: source fingerprint mismatch`);
      const reward = missionRewards[0];
      requireFields(reward, { mission_id: plan.missionId, minimum_score: p.passScore, minimum_stars: 1 }, plan.key);
      const asset = only(assets, 'id', p.rewardAsset.id, plan.key);
      requireFields(asset, { character_id: p.recommendedCharacterId, asset_type: 'reward', access_level: 'reward', storage_bucket: 'character-private', storage_path: plan.storagePath, mime_type: 'image/png', alt_text: p.rewardAsset.altText, is_primary: false, metadata: p.rewardAsset.metadata, created_by: plan.ownerId }, plan.key);
      assert(Boolean(asset.character_version_id), `${plan.key}: reward character version missing`);
      const link = only(links, 'mission_id', plan.missionId, plan.key);
      requireFields(link, { character_id: p.recommendedCharacterId, is_recommended: true, role_override: p.characterRole }, plan.key);
      assert(missionSteps.every(step => step.hints.length === 3), `${plan.key}: expected three hints`);
      counts.missions++; counts.versions++; counts.instructions++; counts.rewards++; counts.assets++; counts.characterLinks++;
      counts.steps += missionSteps.length; counts.hints += missionSteps.reduce((sum, step) => sum + step.hints.length, 0);
      levels[mission.difficulty] = (levels[mission.difficulty] ?? 0) + 1;
      const category = source.source.categoryId;
      categories[category] = (categories[category] ?? 0) + 1;
      subcategories[mission.category_id] = (subcategories[mission.category_id] ?? 0) + 1;
    }
    onProgress(counts.missions, plans.length);
  }
  const expectedSteps = plans.reduce((sum, plan) => sum + plan.hints.length, 0);
  assert(counts.missions === plans.length && counts.steps === expectedSteps, 'final mission/step total mismatch');
  return {
    status: 'PASS', scope: 'remote persisted catalog data contract; read-only batched comparison',
    verifiedAt: new Date().toISOString(), counts, catalogEntries: entries.length, managerCount: managers.length,
    catalogReady: catalogStates[0].is_ready, levels, categories, subcategories,
    sourceSetSha256: sha256(canonicalJson(plans.map(plan => ({ key: plan.key, sourceSha256: plan.sourceSha256, mappingSha256: plan.mappingSha256 })).sort((a, b) => a.key.localeCompare(b.key)))),
    checks: ['every catalog identity', 'all mapped mission/version/instruction fields', 'full authored private source and SHA-256', 'all ordered steps and three hints per step', 'active reward and private asset metadata/path/image fingerprint', 'recommended character links and roles'],
    limitations: ['Does not download every Storage image; verifies stored image SHA-256 metadata and paths.', 'Does not prove RLS isolation, browser flows, AI role quality, or learner outcomes.', 'Separate requests are not a single database snapshot; run after import and authoring changes stop.'],
  };
}

export async function main(args = process.argv.slice(2), env = process.env) {
  const { values } = parseArgs({ args, options: {
    root: { type: 'string' }, owner: { type: 'string' }, character: { type: 'string' }, visibility: { type: 'string' },
    'reward-file': { type: 'string' }, 'reward-prefix': { type: 'string' }, 'reward-xp': { type: 'string' },
    report: { type: 'string' }, help: { type: 'boolean' },
  } });
  if (values.help) {
    console.log('Read-only verifier: --owner UUID --character UUID --visibility public --reward-file PNG --reward-prefix OWNER/path --reward-xp 120 [--report docs/flow/2026-09-21-mission-remote-validation.json]. Use node --env-file to supply server credentials; no secrets are accepted as CLI flags or written to the report.');
    return;
  }
  assert(values['reward-file'], '--reward-file required');
  const image = await readFile(resolve(values['reward-file']));
  const plans = await loadImportPlans(resolve(values.root ?? defaultRoot), { ownerId: values.owner, characterId: values.character, visibility: values.visibility, rewardPrefix: values['reward-prefix'], rewardXp: values['reward-xp'] === undefined ? NaN : Number(values['reward-xp']), rewardSha256: sha256(image) });
  const client = createRemoteClient({ url: env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL, serviceKey: env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY });
  const report = await verifyRemoteCatalog(client, plans, { onProgress: (verified, total) => console.error(`Verified ${verified}/${total}`) });
  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (values.report) { const path = resolve(values.report); await mkdir(dirname(path), { recursive: true }); await writeFile(path, output, { mode: 0o600 }); }
  console.log(output.trimEnd());
  return report;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(`Remote catalog verification failed: ${error.message}`); process.exitCode = 1; });
}
