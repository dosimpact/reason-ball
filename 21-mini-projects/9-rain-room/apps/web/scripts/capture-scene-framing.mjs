/** Static thumbnail projections, never GPU/browser screenshots. */
import sharp from 'sharp'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { ALL_BACKGROUNDS as rooms } from '../src/pages/focus/model/backgrounds.ts'
import { fitScene } from '../src/pages/focus/model/pixiScene.ts'
import { sceneAssetUrl } from '../src/pages/focus/lib/sceneAsset.ts'
import { frameSceneWorld } from '../src/pages/focus/model/sceneWorldCamera.ts'
import { SCENE_WORLD_BOUNDS } from '../src/pages/focus/model/sceneWorldCatalog.ts'
import { sceneWorldSvg } from '../src/pages/focus/lib/sceneWorldArt.ts'
const args = process.argv.slice(2)
if (args.includes('--help')) {
  console.log(
    'node scripts/capture-scene-framing.mjs [--output DIRECTORY]\nStatic thumbnail projections, not GPU/browser screenshots.',
  )
  process.exit(0)
}
const root = fileURLToPath(new URL('../../../', import.meta.url)),
  pub = fileURLToPath(new URL('../public/', import.meta.url))
const out = path.resolve(
  root,
  args.includes('--output')
    ? args[args.indexOf('--output') + 1]
    : 'artifacts/expanded-scene-world-2026-11-12',
)
const sizes = [
  [320, 480],
  [390, 664],
  [390, 844],
  [667, 375],
  [834, 1112],
  [1112, 834],
  [1440, 900],
  [1920, 1080],
]
const assets = new Map(),
  records = []
const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
await mkdir(out, { recursive: true })
for (const room of rooms) {
  const manifest = JSON.parse(
    await readFile(path.join(pub, 'backgrounds/pixi', room.id, 'manifest.json'), 'utf8'),
  )
  const data = {
    manifest,
    hashes: {
      thumbnail: createHash('sha256')
        .update(await readFile(path.join(pub, sceneAssetUrl(room.id, 'thumbnail'))))
        .digest('hex'),
    },
  }
  for (const kind of ['thumbnail', 'ambience'])
    data[kind] =
      'data:image/png;base64,' +
      (
        await sharp(path.join(pub, sceneAssetUrl(room.id, kind)))
          .png()
          .toBuffer()
      ).toString('base64')
  for (const layer of ['underlay', 'joinery']) {
    data.hashes[layer] = createHash('sha256').update(sceneWorldSvg(room.id, layer)).digest('hex')
    data[layer] =
      'data:image/png;base64,' +
      (
        await sharp(Buffer.from(sceneWorldSvg(room.id, layer)))
          .png()
          .toBuffer()
      ).toString('base64')
  }
  assets.set(room.id, data)
}
function projection(id, w, h, mode, x, y, mw, mh) {
  const a = assets.get(id),
    s = Math.min(mw / w, mh / h)
  const f =
    mode === 'world'
      ? frameSceneWorld(w, h, id)
      : fitScene(w, h, a.manifest.width, a.manifest.height)
  const world = SCENE_WORLD_BOUNDS
  const layer = (kind) =>
    `<image xlink:href="${a[kind]}" x="${f.x + world.x * f.scale}" y="${f.y + world.y * f.scale}" width="${world.width * f.scale}" height="${world.height * f.scale}" preserveAspectRatio="none"/>`
  return `<svg x="${x + (mw - w * s) / 2}" y="${y + (mh - h * s) / 2}" width="${w * s}" height="${h * s}" viewBox="0 0 ${w} ${h}" overflow="hidden"><rect width="100%" height="100%" fill="#171916"/>${mode === 'world' ? layer('underlay') : `<image xlink:href="${a.ambience}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/>`}<image xlink:href="${a.thumbnail}" x="${f.x}" y="${f.y}" width="${a.manifest.width * f.scale}" height="${a.manifest.height * f.scale}" preserveAspectRatio="none"/>${mode === 'world' ? layer('joinery') : ''}</svg>`
}
async function board(name, w, h, body, title) {
  await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" style="background:#292b29;font-family:monospace;fill:#eee"><text x="12" y="20" font-size="14" textLength="${w - 24}" lengthAdjust="spacingAndGlyphs">STATIC COMPOSITION PREVIEWS · ${title}</text><text x="12" y="38" font-size="11" textLength="${w - 24}" lengthAdjust="spacingAndGlyphs">New world SVG + current core thumbnail; NOT GPU/browser screenshots; weather/animation excluded.</text>${body}</svg>`,
    ),
  )
    .png()
    .toFile(path.join(out, name))
}
for (const [w, h] of sizes) {
  let body = ''
  for (const [i, r] of rooms.entries()) {
    const x = (i % 8) * 184,
      y = 52 + Math.floor(i / 8) * 150,
      a = assets.get(r.id),
      fit = frameSceneWorld(w, h, r.id)
    const afterCrop =
      fit.x < -1e-7 ||
      fit.y < -1e-7 ||
      fit.x + fit.width > w + 1e-7 ||
      fit.y + fit.height > h + 1e-7
    if (afterCrop) throw new Error(`Unexpected crop: ${r.id}`)
    records.push({
      id: r.id,
      viewport: { width: w, height: h },
      source: { width: a.manifest.width, height: a.manifest.height },
      fit,
      previousContain: fitScene(w, h),
      worldBounds: SCENE_WORLD_BOUNDS,
      sourceHashes: a.hashes,
      worldCoversViewport:
        fit.worldX <= 1e-7 &&
        fit.worldY <= 1e-7 &&
        fit.worldX + fit.worldWidth >= w - 1e-7 &&
        fit.worldY + fit.worldHeight >= h - 1e-7,
      afterCrop,
      thumbnail: sceneAssetUrl(r.id, 'thumbnail'),
      ambience: sceneAssetUrl(r.id, 'ambience'),
    })
    body +=
      projection(r.id, w, h, 'world', x + 4, y, 176, 120) +
      `<text x="${x + 4}" y="${y + 134}" font-size="9" textLength="176" lengthAdjust="spacingAndGlyphs">${esc(r.id)}</text>`
  }
  await board(`after-${w}x${h}.png`, 1472, 1410, body, `${w}×${h} · 68 rooms`)
}
const reps = []
for (const r of rooms)
  if (!r.id.startsWith('premium-') && !reps.some((v) => v.category === r.category)) reps.push(r)
for (const id of ['premium-christmas-bookcafe', 'premium-memory-house'])
  reps.push(rooms.find((r) => r.id === id))
let body = ''
for (const [i, r] of reps.entries())
  for (const [j, [w, h]] of [
    [390, 844],
    [667, 375],
  ].entries()) {
    const y = 58 + (i * 2 + j) * 216
    body +=
      `<text x="12" y="${y + 13}" font-size="12">${esc(r.id)} · ${w}×${h} · BEFORE contain+blur / AFTER expanded world</text>` +
      projection(r.id, w, h, 'contain', 12, y + 20, 450, 188) +
      projection(r.id, w, h, 'world', 482, y + 20, 450, 188)
  }
await board(
  'before-after.png',
  944,
  64 + reps.length * 432,
  body,
  'Previous contain / expanded world',
)
for (const id of [
  'cafe-rain',
  'premium-memory-house',
  'water-moon',
  'forest-mist',
  'travel-tent',
  'premium-sakura-teahouse',
  'premium-neon-loft',
])
  for (const [w, h] of [
    [390, 844],
    [1440, 900],
  ])
    await board(
      `detail-${id}-${w}x${h}.png`,
      w,
      h + 52,
      projection(id, w, h, 'world', 0, 52, w, h),
      `${id} · ${w}×${h}`,
    )
await writeFile(
  path.join(out, 'framing.json'),
  JSON.stringify(
    {
      method:
        'Static new world SVG + current core thumbnail projection, not GPU/browser screenshot',
      viewports: sizes,
      rooms: rooms.length,
      records,
      representatives: reps.map((r) => r.id),
    },
    null,
    2,
  ) + '\n',
)
console.log(JSON.stringify({ out, rooms: rooms.length, records: records.length, boards: 23 }))
