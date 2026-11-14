/** Crop-only seam QA from current canonical CPU scene captures. No app render. */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { spawn } from 'node:child_process'
import sharp from 'sharp'
const args = process.argv.slice(2)
if (args.includes('--help')) {
  console.log(
    'node scripts/capture-scene-seams.mjs --input artifacts/capture-directory [--output artifacts/review-directory]\nUses after/manifest.json +1440x900PNG; exact camera edge strips, no rerender/browser.',
  )
  process.exit(0)
}
const workspace = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)))
const option = (key, fallback) => {
  const i = args.indexOf(key)
  if (i < 0) return fallback
  if (!args[i + 1] || args[i + 1].startsWith('--')) throw Error(`${key} requires value`)
  return args[i + 1]
}
const input = path.resolve(workspace, option('--input', 'artifacts/scene-seams-2026-11-12/before'))
const output = path.resolve(
  workspace,
  option('--output', path.relative(workspace, path.join(input, 'seam-review'))),
)
if (!output.startsWith(workspace + path.sep)) throw Error('Output must stay inside workspace')
const hash = (b) => createHash('sha256').update(b).digest('hex')
const guardPaths = [
  'apps/web/src/pages/focus/model/sceneWorldJunctions.ts',
  'apps/web/src/pages/focus/model/sceneWorldCamera.ts',
  'apps/web/src/pages/focus/lib/sceneWorldArchitecture.ts',
  'apps/web/src/pages/focus/lib/sceneWorldFittings.ts',
  'apps/web/src/pages/focus/lib/pixiSceneRuntime.ts',
]
const snapshot = async () =>
  Object.fromEntries(
    await Promise.all(
      guardPaths.map(async (p) => [p, hash(await readFile(path.join(workspace, p)))]),
    ),
  )
if (args.includes('--capture')) {
  const start = await snapshot()
  const childArgs = [
    'scripts/capture-room-renovation.mjs',
    '--output',
    path.relative(workspace, input),
    '--capture',
  ]
  const only = option('--only', null)
  if (only) childArgs.push(`--only=${only}`)
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, childArgs, {
      cwd: path.join(workspace, 'apps/web'),
      stdio: 'inherit',
    })
    child.once('error', reject)
    child.once('exit', (code) => resolve(code))
  })
  const carryFrom = option('--carry-from', null)
  if (carryFrom) {
    const previousDirectory = path.resolve(workspace, carryFrom)
    const previousBytes = await readFile(path.join(previousDirectory, 'after/manifest.json'))
    const previous = JSON.parse(previousBytes)
    const allowed = new Set((only ?? '').split(',').filter(Boolean))
    if (!allowed.size) throw Error('--carry-from requires explicit --only changed room IDs')
    const sourceChanged = []
    for (const [relative, expected] of Object.entries(previous.sourceFiles)) {
      if (relative === 'lib/sceneWorldArchitecture.ts') continue
      if (
        hash(await readFile(path.join(workspace, 'apps/web/src/pages/focus', relative))) !==
        expected
      )
        sourceChanged.push(relative)
    }
    const previousGuard = JSON.parse(
      await readFile(path.join(previousDirectory, 'seam-source-guard.json')),
    )
    for (const [relative, expected] of Object.entries(previousGuard.end)) {
      if (relative.endsWith('/sceneWorldArchitecture.ts')) continue
      if (hash(await readFile(path.join(workspace, relative))) !== expected)
        sourceChanged.push(relative)
    }
    const { sceneWorldSvg } = await import('../src/pages/focus/lib/sceneWorldArt.ts')
    const rows = [],
      checkedAssets = new Map()
    for (const room of previous.records) {
      const worldHashes = Object.fromEntries(
        ['underlay', 'joinery'].map((layer) => [
          layer,
          hash(Buffer.from(sceneWorldSvg(room.id, layer))),
        ]),
      )
      const identical = Object.entries(worldHashes).every(
        ([layer, value]) => room.worldHashes[layer] === value,
      )
      if (!identical && !allowed.has(room.id))
        throw Error(`Unexpected world artwork change outside --only: ${room.id}`)
      const manifestFile = path.join(
        workspace,
        'apps/web/public/backgrounds/pixi',
        room.id,
        'manifest.json',
      )
      if (hash(await readFile(manifestFile)) !== room.manifestSha256)
        throw Error(`Static manifest changed: ${room.id}`)
      for (const [url, expected] of Object.entries(room.assetHashes)) {
        if (!checkedAssets.has(url))
          checkedAssets.set(url, hash(await readFile(path.join(workspace, 'apps/web/public', url))))
        if (checkedAssets.get(url) !== expected) throw Error(`Static asset changed: ${url}`)
      }
      rows.push({
        id: room.id,
        identical,
        worldHashes,
        carried: identical && !allowed.has(room.id),
      })
    }
    await mkdir(input, { recursive: true })
    await writeFile(
      path.join(input, 'world-carry-comparison.json'),
      JSON.stringify(
        {
          previousManifestSha256: hash(previousBytes),
          sourceChanged,
          checkedAssets: checkedAssets.size,
          records: rows,
        },
        null,
        2,
      ) + '\n',
    )
    if (sourceChanged.length)
      throw Error(`Carry source dependencies changed: ${sourceChanged.join(',')}`)
  }
  const end = await snapshot()
  const changed = guardPaths.filter((p) => start[p] !== end[p])
  await mkdir(input, { recursive: true })
  await writeFile(
    path.join(input, 'seam-source-guard.json'),
    JSON.stringify({ start, end, changed, exitCode }, null, 2) + '\n',
  )
  if (exitCode !== 0 || changed.length)
    throw Error(
      `Canonical capture failed or guarded sources changed: exit=${exitCode}, changed=${changed.join(',')}`,
    )
}
const manifestPath = path.join(input, 'after/manifest.json'),
  manifestBytes = await readFile(manifestPath),
  manifest = JSON.parse(manifestBytes)
if (manifest.sourceChangedDuringCapture.length)
  throw Error('Canonical input capture changed source')
await mkdir(output, { recursive: true })
sharp.cache(false)
sharp.concurrency(1)
const records = []
for (const r of manifest.records) {
  const view = r.views['1440x900'],
    f = view.framing,
    filename = `${r.id}-1440x900.png`,
    bytes = await readFile(path.join(input, 'after', filename))
  if (hash(bytes) !== view.sha256) throw Error(`PNG does not match capture manifest ${r.id}`)
  const geometry = { left: f.x, right: f.x + f.width, top: f.y, bottom: f.y + f.height }
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n))
  const crops = {
    left: {
      left: clamp(Math.round(geometry.left) - 120, 0, 1200),
      top: 0,
      width: 240,
      height: 900,
    },
    right: {
      left: clamp(Math.round(geometry.right) - 120, 0, 1200),
      top: 0,
      width: 240,
      height: 900,
    },
    top: {
      left: Math.max(0, Math.round(f.x)),
      top: clamp(Math.round(f.y) - 60, 0, 760),
      width: Math.min(878, 1440 - Math.max(0, Math.round(f.x))),
      height: 140,
    },
    bottom: {
      left: Math.max(0, Math.round(f.x)),
      top: clamp(Math.round(f.y + f.height) - 70, 0, 760),
      width: Math.min(878, 1440 - Math.max(0, Math.round(f.x))),
      height: 140,
    },
  }
  const paint = [{ input: await sharp(bytes).resize(720, 450).png().toBuffer(), left: 0, top: 55 }]
  for (const [edge, crop] of Object.entries(crops)) {
    const image = await sharp(bytes)
      .extract(crop)
      .resize(
        edge === 'left' || edge === 'right' ? 240 : 720,
        edge === 'left' || edge === 'right' ? 900 : 115,
        { fit: 'fill' },
      )
      .png()
      .toBuffer()
    paint.push({
      input: image,
      left: edge === 'left' ? 740 : edge === 'right' ? 1000 : 0,
      top: edge === 'left' || edge === 'right' ? 55 : edge === 'top' ? 575 : 760,
    })
  }
  const text = `<svg xmlns="http://www.w3.org/2000/svg" width="1260" height="980"><g fill="#eee" font-family="monospace"><text x="8" y="20" font-size="15">${r.id} · PC1440x900 · current canonical CPU proof, NOT browser/GPU</text><text x="8" y="40" font-size="12">Full PC50% left. Raw left/right join crops100% right; no seam-covering overlays.</text><text x="744" y="52" font-size="11">LEFT x${geometry.left.toFixed(2)}</text><text x="1004" y="52" font-size="11">RIGHT x${geometry.right.toFixed(2)}</text><text x="8" y="550" font-size="12">TOP coreborder y${geometry.top.toFixed(2)} · external join ${geometry.top > 1 ? 'visible' : 'outside viewport'}</text><text x="8" y="737" font-size="12">BOTTOM coreborder y${geometry.bottom.toFixed(2)} · external join ${geometry.bottom < 899 ? 'visible' : 'outside viewport'}</text><text x="8" y="970" font-size="11">Source/masks/paintorder+live pets are pinned by input manifest. Crop tool adds no app geometry.</text></g></svg>`
  paint.push({ input: Buffer.from(text), left: 0, top: 0 })
  const board = `${r.id}-pc-seams.png`
  await sharp({ create: { width: 1260, height: 980, channels: 4, background: '#222' } })
    .composite(paint)
    .png()
    .toFile(path.join(output, board))
  records.push({
    id: r.id,
    filename,
    sourcePngSha256: hash(bytes),
    geometry,
    crops,
    board,
    boardSha256: hash(await readFile(path.join(output, board))),
    exposedBorders: {
      left: geometry.left > 1,
      right: geometry.right < 1439,
      top: geometry.top > 1,
      bottom: geometry.bottom < 899,
    },
  })
  console.log(`SEAM_BOARD ${r.id}`)
}
if (hash(await readFile(manifestPath)) !== hash(manifestBytes))
  throw Error('Input manifest changed while cropping')
await writeFile(
  path.join(output, 'manifest.json'),
  JSON.stringify(
    {
      method:
        'Crop-only raw border strips from canonical PC1440x900 CPU images, not browser/GPU; no stretching of source artwork or added seam-hiding frames.',
      input: path.relative(workspace, input),
      inputManifestSha256: hash(manifestBytes),
      sourceFiles: manifest.sourceFiles,
      rooms: records.length,
      records,
    },
    null,
    2,
  ) + '\n',
)
console.log(JSON.stringify({ output, rooms: records.length }))
