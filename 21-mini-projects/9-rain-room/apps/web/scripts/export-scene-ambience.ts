import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { ALL_BACKGROUNDS } from '../src/pages/focus/model/backgrounds.ts'
import { sceneAssetUrl } from '../src/pages/focus/lib/sceneAsset.ts'

export const AMBIENCE_RECIPE = {
  width: 64,
  height: 66,
  blur: 4,
  brightness: 0.4,
  saturation: 0.75,
  quality: 55,
} as const
export type AmbienceEntry = {
  id: string
  source: string
  sourceSha256: string
  path: string
  sha256: string
  width: number
  height: number
  bytes: number
}
export type AmbienceCatalog = {
  version: 1
  recipe: typeof AMBIENCE_RECIPE
  entries: AmbienceEntry[]
}
const base = new URL('../', import.meta.url)
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
export async function checkAmbience(): Promise<AmbienceCatalog> {
  const catalog: AmbienceCatalog = JSON.parse(
    await readFile(new URL('public/backgrounds/ambience/catalog.json', base), 'utf8'),
  )
  if (catalog.version !== 1 || JSON.stringify(catalog.recipe) !== JSON.stringify(AMBIENCE_RECIPE))
    throw new Error('Ambience recipe is stale')
  const ids = catalog.entries.map((entry) => entry.id)
  if (
    new Set(ids).size !== ids.length ||
    ids.toSorted().join() !==
      ALL_BACKGROUNDS.map((room) => room.id)
        .toSorted()
        .join()
  )
    throw new Error('Ambience ID coverage differs from the room catalog')
  let total = 0
  for (const entry of catalog.entries) {
    if (
      entry.path !== sceneAssetUrl(entry.id, 'ambience') ||
      entry.source !== sceneAssetUrl(entry.id, 'thumbnail')
    )
      throw new Error(`Ambience path mismatch: ${entry.id}`)
    const [source, bytes] = await Promise.all([
      readFile(new URL(`public${entry.source}`, base)),
      readFile(new URL(`public${entry.path}`, base)),
    ])
    const meta = await sharp(bytes).metadata()
    if (hash(source) !== entry.sourceSha256)
      throw new Error(`Ambience source is stale: ${entry.id}`)
    if (hash(bytes) !== entry.sha256 || bytes.length !== entry.bytes)
      throw new Error(`Ambience bytes differ: ${entry.id}`)
    if (
      meta.format !== 'webp' ||
      meta.width !== 64 ||
      meta.height !== 66 ||
      entry.width !== 64 ||
      entry.height !== 66
    )
      throw new Error(`Ambience dimensions differ: ${entry.id}`)
    total += bytes.length
  }
  if (total >= 128 * 1024) throw new Error(`Ambience exceeds 128 KiB: ${total}`)
  return catalog
}
async function generate() {
  await mkdir(new URL('public/backgrounds/ambience/', base), { recursive: true })
  const entries: AmbienceEntry[] = []
  for (const room of ALL_BACKGROUNDS) {
    const source = sceneAssetUrl(room.id, 'thumbnail')
    const bytes = await readFile(new URL(`public${source}`, base))
    const output = await sharp(bytes)
      .resize(64, 66, { fit: 'cover' })
      .blur(4)
      .modulate({ brightness: 0.4, saturation: 0.75 })
      .webp({ quality: 55 })
      .toBuffer()
    const path = sceneAssetUrl(room.id, 'ambience')
    await writeFile(new URL(`public${path}`, base), output)
    entries.push({
      id: room.id,
      source,
      sourceSha256: hash(bytes),
      path,
      sha256: hash(output),
      width: 64,
      height: 66,
      bytes: output.length,
    })
  }
  await writeFile(
    new URL('public/backgrounds/ambience/catalog.json', base),
    `${JSON.stringify({ version: 1, recipe: AMBIENCE_RECIPE, entries }, null, 2)}\n`,
  )
  return checkAmbience()
}
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) ===
    fileURLToPath(new URL(process.argv[1], `file://${process.cwd()}/`))
) {
  const catalog = await (process.argv.includes('--check') ? checkAmbience() : generate())
  console.log(
    `Scene ambience ${process.argv.includes('--check') ? 'validated' : 'generated'}: ${catalog.entries.length} images, ${catalog.entries.reduce((sum, entry) => sum + entry.bytes, 0)} bytes`,
  )
}
