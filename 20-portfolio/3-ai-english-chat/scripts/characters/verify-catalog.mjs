import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCatalog, sha256 } from './catalog.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const folder = resolve(root, 'assets/characters/talkie-homage');
const chars = validateCatalog(JSON.parse(await readFile(resolve(folder, 'catalog.json'), 'utf8')));
const base = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!base || !key) throw new Error('Supabase server credentials are required.');
async function rows(table, query) {
  const r = await fetch(`${base}/rest/v1/${table}?${query}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`Verification query failed: ${table} HTTP ${r.status}`);
  return r.json();
}
for (const c of chars) {
  const [characters, versions, instructions, assets] = await Promise.all([
    rows('characters', `id=eq.${c.id}&select=id,name,status,visibility,current_version_id`),
    rows('character_versions', `id=eq.${c.versionId}&select=greeting,personality_traits,voice_config,backstory`),
    rows('character_version_instructions', `character_version_id=eq.${c.versionId}&select=system_prompt`),
    rows('character_assets', `character_id=eq.${c.id}&select=storage_bucket,storage_path,metadata`),
  ]);
  const row = characters[0], version = versions[0], asset = assets[0];
  if (characters.length !== 1 || row.name !== c.name || row.status !== 'published' || row.visibility !== 'public' || row.current_version_id !== c.versionId) throw new Error(`${c.key}: publication mismatch`);
  if (versions.length !== 1 || version.greeting !== c.greeting || JSON.stringify(version.personality_traits) !== JSON.stringify(c.personality) || version.voice_config.style !== c.speakingStyle || version.backstory !== c.description || !instructions[0]?.system_prompt.includes(c.description)) throw new Error(`${c.key}: persona mismatch`);
  if (!asset || asset.storage_bucket !== 'character-public' || asset.metadata?.catalogSha256 !== sha256(JSON.stringify(c))) throw new Error(`${c.key}: asset mismatch`);
  const image = await fetch(`${base}/storage/v1/object/public/${asset.storage_bucket}/${asset.storage_path}`, { signal: AbortSignal.timeout(30000) });
  if (!image.ok || sha256(Buffer.from(await image.arrayBuffer())) !== asset.metadata.sha256) throw new Error(`${c.key}: public image mismatch`);
  console.log(`${c.key}: published persona and public image verified`);
}
