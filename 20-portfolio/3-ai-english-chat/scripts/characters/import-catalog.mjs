import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { validateCatalog, publicationPayload, sha256 } from './catalog.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const folder = resolve(root, 'assets/characters/talkie-homage');
const { values } = parseArgs({ options: { apply: { type: 'boolean', default: false }, owner: { type: 'string' } } });
const characters = validateCatalog(JSON.parse(await readFile(resolve(folder, 'catalog.json'), 'utf8')));
if (!values.apply) {
  console.log(JSON.stringify({ mode: 'dry-run', characters: characters.length, names: characters.map(c => c.name), remoteWrites: 0 }));
} else {
  if (!/^[0-9a-f-]{36}$/i.test(values.owner ?? '')) throw new Error('--owner UUID is required for publication.');
  const base = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const token = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !token) throw new Error('Supabase server credentials are required.');
  async function request(path, options = {}) {
    const response = await fetch(base + path, { ...options, headers: { apikey: token, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers }, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Supabase operation failed: HTTP ${response.status}`);
    return response;
  }
  // Validate every generated asset before the first remote write. No image-less publication.
  const plans = await Promise.all(characters.map(async c => {
    const receipt = JSON.parse(await readFile(resolve(folder, 'portraits', `${c.key}.json`), 'utf8'));
    if (receipt.promptSha256 !== sha256(c.imagePrompt)) throw new Error(`${c.key}: image prompt differs from the catalog.`);
    if (receipt.status !== 'generated' || receipt.provider !== 'google' || receipt.key !== c.key || !new RegExp(`^${c.key}\\.(png|jpg|webp)$`).test(receipt.filename)) throw new Error(`${c.key}: a verified Google image is required.`);
    const bytes = await readFile(resolve(folder, 'portraits', receipt.filename));
    if (sha256(bytes) !== receipt.sha256 || bytes.length === 0 || bytes.length > 10 * 1024 * 1024) throw new Error(`${c.key}: image integrity check failed.`);
    return { c, receipt, bytes, path: `${values.owner}/${c.id}/${receipt.sha256}.${receipt.filename.split('.').at(-1)}` };
  }));
  // Validate the owner exists without selecting unrelated users.
  await request(`/auth/v1/admin/users/${values.owner}`);
  for (const { c, receipt, bytes, path } of plans) {
    const existing = await (await request(`/rest/v1/characters?id=eq.${c.id}&select=id,owner_id,status,current_version_id`)).json();
    if (existing.length) {
      const row = existing[0];
      const assets = await (await request(`/rest/v1/character_assets?character_id=eq.${c.id}&select=storage_path,metadata`)).json();
      if (row.owner_id !== values.owner || row.status !== 'published' || row.current_version_id !== c.versionId || !assets.some(a => a.storage_path === path && a.metadata?.sha256 === receipt.sha256 && a.metadata?.catalogSha256 === sha256(JSON.stringify(c)))) throw new Error(`${c.key}: existing resource differs; refusing overwrite.`);
      console.log(`${c.key}: unchanged`);
      continue;
    }
    const object = await fetch(`${base}/storage/v1/object/character-public/${path}`, { headers: { apikey: token, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) });
    if (object.ok) {
      if (sha256(Buffer.from(await object.arrayBuffer())) !== receipt.sha256) throw new Error(`${c.key}: existing storage object differs.`);
    } else if ([400, 404].includes(object.status)) {
      await request(`/storage/v1/object/character-public/${path}`, { method: 'POST', headers: { 'Content-Type': receipt.mimeType, 'x-upsert': 'false', 'cache-control': 'max-age=31536000' }, body: bytes });
    } else throw new Error(`${c.key}: cannot inspect storage object (HTTP ${object.status}).`);
    const asset = { id: c.assetId, storageBucket: 'character-public', storagePath: path, mimeType: receipt.mimeType, accessLevel: 'public', altText: `${c.name} original character portrait`,
      metadata: { palette: c.palette, emoji: c.emoji, source: 'google-generated', model: receipt.model, sha256: receipt.sha256, catalog: 'talkie-homage-2026-09-30', catalogSha256: sha256(JSON.stringify(c)) } };
    await request('/rest/v1/rpc/create_character_with_version', { method: 'POST', body: JSON.stringify({ _character_id: c.id, _character_version_id: c.versionId, _expected_owner_id: values.owner, _payload: publicationPayload(c, asset) }) });
    console.log(`${c.key}: published`);
  }
}
