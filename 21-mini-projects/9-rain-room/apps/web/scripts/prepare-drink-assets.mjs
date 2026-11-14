// Historical photo experiment only. Active kiosk art is native SVG in DrinkCup.tsx.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import sharp from 'sharp'
import { DRINKS } from '../src/pages/focus/model/cafeRitual.ts'

const app = fileURLToPath(new URL('../', import.meta.url))
const source = path.join(app, 'artwork/drinks/v1')
const output = path.join(source, 'retired-public')
const partial = process.argv.includes('--partial')
await mkdir(output, { recursive: true })
const entries = []
for (const { id } of DRINKS) {
  let bytes
  try {
    bytes = await readFile(path.join(source, `${id}.png`))
  } catch (error) {
    if (partial && error.code === 'ENOENT') continue
    throw error
  }
  const input = sharp(bytes)
  const metadata = await input.metadata()
  const statistics = await input.stats()
  if (!metadata.hasAlpha || statistics.channels[3]?.min !== 0)
    throw new Error(`${id}: a real transparent alpha background is required`)
  const variants = {}
  for (const size of [256, 768]) {
    const filename = `${id}-${size}.webp`
    const info = await sharp(bytes)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 92, alphaQuality: 100, effort: 6 })
      .toFile(path.join(output, filename))
    variants[size] = { path: `/drinks/v1/${filename}`, width: size, height: size, bytes: info.size }
  }
  entries.push({
    id,
    source: `${id}.png`,
    sourceWidth: metadata.width,
    sourceHeight: metadata.height,
    sourceSha256: createHash('sha256').update(bytes).digest('hex'),
    variants,
  })
}
await writeFile(
  path.join(output, 'catalog.json'),
  `${JSON.stringify({ version: 1, entries }, null, 2)}\n`,
)
console.log(
  `Archived ${entries.length}/${DRINKS.length} historical drink photographs; active UI uses SVG`,
)
