/** Software QA of the actual authored props/pose. NOT browser/GPU screenshots.
 * Reuses verified, unchanged compiled scene compositions; never invents a background. */
import sharp from 'sharp'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const web = fileURLToPath(new URL('../', import.meta.url))
const workspace = fileURLToPath(new URL('../../../', import.meta.url))
const args = process.argv.slice(2)
const option = (name, fallback) => {
  const index = args.indexOf(name)
  return index < 0 ? fallback : args[index + 1]
}
const output = path.resolve(
  workspace,
  option('--output', 'artifacts/scene-interactions-2026-11-12/round1'),
)
const baseline = path.resolve(
  workspace,
  option('--baseline', 'artifacts/scene-seams-2026-11-12/post-export-integrity.json'),
)
const only = option('--only', '')
const selected = only ? new Set(only.split(',')) : null
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const read = (file) => readFile(file)
const json = async (file) => JSON.parse(await readFile(file, 'utf8'))
const saveJson = (file, value) => writeFile(file, JSON.stringify(value, null, 2) + '\n')
const pins = [
  'model/sceneInteractiveTypes.ts',
  'model/sceneInteractiveStandard.ts',
  'model/sceneInteractivePremium.ts',
  'model/sceneInteractiveObjects.ts',
  'model/sceneObjectInteraction.ts',
  'lib/sceneInteractiveDrawing.ts',
  'lib/pixiSceneInteractions.ts',
  'lib/pixiSceneRuntime.ts',
  'ui/pixi/PixiScene.tsx',
  'ui/pixi/SceneInteractiveTargets.tsx',
  'ui/pixi/scene-interactive.css',
  'ui/SceneFullscreen.tsx',
  'ui/ritual/ImmersiveRoom.tsx',
  'lib/sceneWorldArt.ts',
  'lib/sceneWorldArchitecture.ts',
  'lib/sceneWorldFittings.ts',
  'model/sceneWorldJunctions.ts',
  'model/sceneWorldCamera.ts',
  'lib/animalDrawing.ts',
  'model/animalLife.ts',
  'model/animalHabitats.ts',
  'model/animalSpecies.ts',
  'model/petRoutine.ts',
]
async function sourceHashes() {
  return Object.fromEntries(
    await Promise.all(
      pins.map(async (file) => [file, hash(await read(path.join(web, 'src/pages/focus', file)))]),
    ),
  )
}
const start = await sourceHashes()
const old = await json(baseline),
  baseRoot = path.dirname(baseline)
const oldManifest = await json(path.join(baseRoot, 'final-dome/after/manifest.json'))
for (const [file, expected] of Object.entries(oldManifest.sourceFiles)) {
  if (hash(await read(path.join(web, 'src/pages/focus', file))) !== expected)
    throw Error(`Background source changed; regenerate actual base compositions: ${file}`)
}
const [
  { getSceneInteractiveObjects, SCENE_INTERACTIVE_OBJECTS },
  { SceneObjectInteractionController },
  drawing,
  camera,
  world,
] = await Promise.all([
  import('../src/pages/focus/model/sceneInteractiveObjects.ts'),
  import('../src/pages/focus/model/sceneObjectInteraction.ts'),
  import('../src/pages/focus/lib/sceneInteractiveDrawing.ts'),
  import('../src/pages/focus/model/sceneWorldCamera.ts'),
  import('../src/pages/focus/lib/sceneWorldArt.ts'),
])
const rows = old.acceptedRecords.filter((r) => !selected || selected.has(r.id))
if (!rows.length || (selected && rows.length !== selected.size))
  throw Error('Unknown room selection')
if (SCENE_INTERACTIVE_OBJECTS.length < 100) throw Error('Insufficient authored props')
sharp.cache(false)
sharp.concurrency(1)
await mkdir(output, { recursive: true })
await mkdir(path.join(output, 'rooms'), { recursive: true })
await mkdir(path.join(output, 'objects'), { recursive: true })
const assets = new Map()
for (const r of old.acceptedRecords) {
  const folder = path.join(baseRoot, r.capture),
    manifest = await json(path.join(folder, 'manifest.json'))
  const row = manifest.records.find((item) => item.id === r.id)
  const bytes = await read(path.join(web, 'public/backgrounds/pixi', r.id, 'manifest.json'))
  if (hash(bytes) !== r.manifestSha256) throw Error(`Changed compiled core: ${r.id}`)
  for (const [name, expected] of Object.entries(row.assetHashes)) assets.set(name, expected)
  for (const layer of ['underlay', 'joinery'])
    if (hash(world.sceneWorldSvg(r.id, layer)) !== r.worldHashes[layer])
      throw Error(`Changed world art: ${r.id}/${layer}`)
}
for (const [name, expected] of assets)
  if (hash(await read(path.join(web, 'public', name))) !== expected)
    throw Error(`Changed compiled asset: ${name}`)

function framesAt(objects, progress, single) {
  const frames = new Map()
  for (const object of objects) {
    if (single && single !== object.id) continue
    const controller = new SceneObjectInteractionController(objects)
    if (!controller.activate(object.id)) throw Error(`Activation failed: ${object.id}`)
    controller.advance(object.reaction.durationMs * progress)
    frames.set(object.id, controller.frame(object.id))
    controller.dispose()
  }
  return frames
}
async function composite(base, objects, frame, frames = new Map()) {
  const inner = drawing
    .sceneInteractiveLayerSvg(objects, frames)
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>$/, '')
  const { width, height } = await sharp(base).metadata()
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><clipPath id="core"><rect width="800" height="820"/></clipPath></defs><g transform="translate(${frame.x} ${frame.y}) scale(${frame.scale})" clip-path="url(#core)">${inner}</g></svg>`
  return sharp(base)
    .composite([{ input: Buffer.from(svg) }])
    .png()
    .toBuffer()
}
const caption = (text, width, height = 32, size = 13) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#171c1b"/><text x="10" y="22" fill="#e4ebe5" font-family="sans-serif" font-size="${size}">${text}</text></svg>`,
  )
const records = []
for (const r of rows) {
  const objects = getSceneInteractiveObjects(r.id)
  if (objects.length !== 2) throw Error(`Expected two authored props: ${r.id}`)
  const controller = new SceneObjectInteractionController(objects)
  const idle = drawing.sceneInteractiveLayerSvg(objects)
  controller.advance(99999)
  if (controller.activeCount || idle !== drawing.sceneInteractiveLayerSvg(objects))
    throw Error('Autonomous reaction')
  for (const object of objects) controller.activate(object.id)
  controller.advance(450)
  const simultaneous = new Map(objects.map((o) => [o.id, controller.frame(o.id)]))
  controller.advance(10000)
  if (controller.activeCount || idle !== drawing.sceneInteractiveLayerSvg(objects))
    throw Error('Failed to settle')
  controller.dispose()
  const record = {
    id: r.id,
    baseCapture: r.capture,
    worldHashes: r.worldHashes,
    props: objects.map((o) => ({
      id: o.id,
      label: o.label,
      position: o.position,
      scale: o.scale,
      surface: o.surface,
      reaction: o.reaction,
    })),
    views: {},
    details: [],
  }
  const pictures = {}
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [320, 568],
  ]) {
    const size = `${width}x${height}`,
      base = await read(path.join(baseRoot, r.capture, `${r.id}-${size}.png`))
    if (hash(base) !== r.views[size]) throw Error(`Changed baseline PNG: ${r.id}/${size}`)
    const frame = camera.frameSceneWorld(width, height, r.id)
    const rest = await composite(base, objects, frame)
    const active = await composite(base, objects, frame, simultaneous)
    const restFile = `${r.id}-${size}-idle.png`,
      activeFile = `${r.id}-${size}-pressed.png`
    await writeFile(path.join(output, 'rooms', restFile), rest)
    await writeFile(path.join(output, 'rooms', activeFile), active)
    record.views[size] = {
      frame,
      baselineSha256: hash(base),
      idle: { file: `rooms/${restFile}`, sha256: hash(rest) },
      pressed: { file: `rooms/${activeFile}`, sha256: hash(active) },
    }
    pictures[size] = { rest, active, base, frame }
  }
  const pc = pictures['1440x900']
  for (const object of objects) {
    const pressed = await composite(pc.base, objects, pc.frame, framesAt(objects, 0.37, object.id))
    const cx = pc.frame.x + object.position.x * pc.frame.scale
    const cy = pc.frame.y + (object.position.y - 40 * object.scale) * pc.frame.scale
    const left = Math.max(0, Math.min(1440 - 160, Math.round(cx - 80)))
    const top = Math.max(0, Math.min(900 - 150, Math.round(cy - 75)))
    const crops = await Promise.all(
      [pc.rest, pressed].map((png) =>
        sharp(png)
          .extract({ left, top, width: 160, height: 150 })
          .resize(480, 450)
          .png()
          .toBuffer(),
      ),
    )
    const filename = object.id.replaceAll(':', '--') + '.png'
    const board = await sharp({
      create: { width: 960, height: 490, channels: 4, background: '#171c1b' },
    })
      .composite([
        {
          input: caption(`${object.id} | IDLE (3x inspection zoom)`, 480, 40, 11),
          left: 0,
          top: 0,
        },
        {
          input: caption(`EXPLICIT TAP | progress .37 | ${object.reaction.type}`, 480, 40, 12),
          left: 480,
          top: 0,
        },
        { input: crops[0], left: 0, top: 40 },
        { input: crops[1], left: 480, top: 40 },
      ])
      .png()
      .toBuffer()
    await writeFile(path.join(output, 'objects', filename), board)
    record.details.push({
      id: object.id,
      file: `objects/${filename}`,
      sha256: hash(board),
      crop: { left, top, width: 160, height: 150 },
      progress: 0.37,
    })
  }
  const board = await sharp({
    create: { width: 1160, height: 1020, channels: 4, background: '#171c1b' },
  })
    .composite([
      {
        input: caption(
          `${r.id} | native-shared props over verified scene CPU composition. NOT browser/GPU`,
          1160,
          40,
        ),
        left: 0,
        top: 0,
      },
      { input: await sharp(pc.rest).resize(720, 450).png().toBuffer(), left: 10, top: 48 },
      { input: await sharp(pc.active).resize(720, 450).png().toBuffer(), left: 10, top: 538 },
      { input: caption('PC after two explicit taps +450ms', 720, 32), left: 10, top: 502 },
      { input: pictures['390x844'].rest, left: 750, top: 48 },
      { input: caption(objects[0].id, 400, 32, 11), left: 750, top: 916 },
      { input: caption(objects[1].id, 400, 32, 11), left: 750, top: 948 },
    ])
    .png()
    .toBuffer()
  const boardFile = `${r.id}-board.png`
  await writeFile(path.join(output, boardFile), board)
  record.board = { file: boardFile, sha256: hash(board) }
  records.push(record)
  console.log(`${records.length}/${rows.length} ${r.id}: ${objects.length} props`)
}
const end = await sourceHashes(),
  changed = pins.filter((file) => start[file] !== end[file])
const manifest = {
  method:
    'Static CPU compositions using unchanged accepted compiled-core/world images, current authored prop artwork and exact native-shared reaction pose. Weather excluded. NOT browser/GPU screenshots.',
  baseline: path.relative(workspace, baseline),
  baselineSha256: hash(await read(baseline)),
  checkedStaticManifests: old.acceptedRecords.length,
  checkedStaticAssets: assets.size,
  sourceFiles: start,
  sourceChangedDuringCapture: changed,
  rooms: records.length,
  objects: records.reduce((n, r) => n + r.props.length, 0),
  tapProgress: 0.37,
  records,
}
await saveJson(path.join(output, 'manifest.json'), manifest)
await saveJson(path.join(output, 'source-guard.json'), { start, end, changed })
if (changed.length) throw Error(`Source changed during capture: ${changed.join(',')}`)
console.log(`Saved ${manifest.rooms} rooms / ${manifest.objects} props; source guard clean.`)
