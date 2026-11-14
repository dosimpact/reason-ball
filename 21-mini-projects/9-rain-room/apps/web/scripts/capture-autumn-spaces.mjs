/** Autumn8-room CPU QA using archived/current compiled artwork + evaluated CSS channels.
 * No browser/network, no accepted-background reuse, no autonomous click reactions.
 * This compositor is QA infrastructure, not independent proof of GPU rendering. */
import sharp from 'sharp'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import { evaluateMotion } from '../src/pages/focus/lib/pixiSceneMotion.ts'
import {
  cssSkewToPixi,
  coffeeLayerVisible,
  isNativeVectorEligible,
  nativeVectorParts,
  validatePixiManifest,
} from '../src/pages/focus/model/pixiScene.ts'

const web = fileURLToPath(new URL('../', import.meta.url))
const workspace = fileURLToPath(new URL('../../../', import.meta.url))
const args = process.argv.slice(2)
const option = (key, fallback) => {
  const i = args.indexOf(key)
  return i < 0 ? fallback : args[i + 1]
}
const defaultRooms = [
  'cafe-alley',
  'study-linen',
  'forest-autumn',
  'premium-autumn-lake',
  'travel-train',
  'travel-van',
  'garden-hanok',
  'garden-court',
]
const evidenceRoot = path.join(workspace, 'artifacts/autumn-spaces-2026-11-13')
const phase = option('--phase', 'after')
if (!['before', 'after'].includes(phase)) throw Error('Invalid phase')
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const json = async (file) => JSON.parse(await readFile(file, 'utf8'))
const saveJson = (file, value) => writeFile(file, JSON.stringify(value, null, 2) + '\n')
const inner = (svg) => svg.replace(/^\s*<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '')
const data = (bytes) => 'data:image/png;base64,' + bytes.toString('base64')
const svg = (body, width = 800, height = 820) =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`
const image = (src, x, y, width, height) =>
  `<image xlink:href="${src}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="none"/>`
import { evaluatedLayerMotion, motionMatrix } from './capture-scene-polish.mjs'
const matrixText = (matrix) => `matrix(${matrix.map((n) => Number(n.toFixed(10))).join(' ')})`
async function rawStats(png, maskPng) {
  const { data: pixels, info } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const mask = maskPng
    ? await sharp(Buffer.from(svg(image(data(maskPng), 0, 0, 800, 820))))
        .resize(info.width, info.height)
        .ensureAlpha()
        .raw()
        .toBuffer()
    : null
  let alpha = 0,
    sx = 0,
    sy = 0,
    occupied = 0,
    outsideClipPixels = 0
  let left = info.width,
    top = info.height,
    right = -1,
    bottom = -1
  for (let p = 0; p < pixels.length; p += 4) {
    const a = pixels[p + 3]
    if (!a) continue
    const index = p / 4,
      x = index % info.width,
      y = Math.floor(index / info.width)
    alpha += a
    sx += a * x
    sy += a * y
    if (a > 2) {
      occupied++
      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x)
      bottom = Math.max(bottom, y)
      if (mask && mask[p + 3] <= 2) outsideClipPixels++
    }
  }
  return {
    alphaSum: alpha,
    occupiedPixels: occupied,
    alphaCentroid: alpha ? { x: sx / alpha, y: sy / alpha } : null,
    bounds: occupied ? { left, top, right, bottom } : null,
    outsideClipPixels: mask ? outsideClipPixels : undefined,
  }
}
async function sourceState(paths) {
  return Object.fromEntries(
    await Promise.all(
      [...paths].sort().map(async (p) => [p, hash(await readFile(path.join(web, p)))]),
    ),
  )
}
async function animalPaint(id, manifest) {
  const [{ getAnimalHabitat }, { AnimalLifeSimulation }, drawing] = await Promise.all([
    phaseModule('model/animalHabitats.ts'),
    phaseModule('model/animalLife.ts'),
    phaseModule('lib/animalDrawing.ts'),
  ])
  const plan = getAnimalHabitat(id),
    simulation = new AnimalLifeSimulation(plan, 42)
  let states
  try {
    for (let i = 0; i < 600; i++) simulation.step(0.1)
    states = new Map(simulation.snapshot().map((s) => [s.id, s]))
  } finally {
    simulation.dispose()
  }
  const ids = manifest.layers
    .filter((l) => l.kind === 'animal' && coffeeLayerVisible(l, 0))
    .map((l) => l.animalId)
  if (ids.length !== plan.actors.length || plan.actors.some((a) => !ids.includes(a.id)))
    throw Error(`Live actor slots mismatch ${id}`)
  const owner = new Map()
  for (const actor of plan.actors) if (!owner.has(actor.zoneId)) owner.set(actor.zoneId, actor.id)
  return new Map(
    plan.actors.map((actor) => {
      const state = states.get(actor.id),
        zone = plan.zones.find((z) => z.id === state.zoneId)
      const stations =
        owner.get(zone.id) === actor.id
          ? plan.resources
              .filter((r) => r.zoneId === zone.id && r.kind !== 'rest')
              .map((r) => {
                const consumer = plan.actors.find((a) => a.id === r.consumerId)
                return inner(
                  drawing.animalResourceSvg(
                    { ...r, scale: consumer?.scale, species: consumer?.species },
                    zone,
                  ),
                )
              })
              .join('')
          : ''
      return [
        actor.id,
        stations +
          inner(
            drawing.animalPoseSvg(
              { ...actor, tetherAnchor: zone.anchor },
              { ...state, domain: zone.domain },
            ),
          ),
      ]
    }),
  )
}
async function prepareRoom(manifest, inputs) {
  const animals = await animalPaint(manifest.id, manifest),
    prepared = [],
    masks = new Map()
  let primitiveBudget = 1024
  for (const layer of manifest.layers) {
    if (layer.kind === 'weather' || !coffeeLayerVisible(layer, 0)) continue
    // restHidden is export-proof metadata; actual runtime draws and evaluates these channels.
    const native =
      layer.kind !== 'animal' &&
      isNativeVectorEligible(layer) &&
      layer.vector.primitiveCount <= primitiveBudget
    if (native) primitiveBudget -= layer.vector.primitiveCount
    if (layer.kind !== 'animal' && !native) {
      const bytes = inputs.assets.get(layer.srcHigh)
      if (!bytes) throw Error(`Missing high-resolution paint ${manifest.id}/${layer.id}`)
      const size = await sharp(bytes).metadata()
      if (size.width !== layer.width * 3 || size.height !== layer.height * 3)
        throw Error(`High paint is not its exact 3x authored box ${manifest.id}/${layer.id}`)
    }
    let body =
      layer.kind === 'animal'
        ? animals.get(layer.animalId)
        : native
          ? nativeVectorParts(layer)
              .map((part) => `<g transform="${matrixText(part.matrix)}">${inner(part.svg)}</g>`)
              .join('')
          : image(
              data(inputs.assets.get(layer.srcHigh)),
              layer.x,
              layer.y,
              layer.width,
              layer.height,
            )
    if (!body) throw Error(`Missing actual paint ${manifest.id}/${layer.id}`)
    if (layer.clipMaskHigh) {
      const size = await sharp(inputs.assets.get(layer.clipMaskHigh)).metadata()
      if (size.width !== 2400 || size.height !== 2460)
        throw Error(`High mask is not the original full-world aperture ${manifest.id}/${layer.id}`)
      const key = `clip-${masks.size}`
      if (!masks.has(layer.clipMaskHigh))
        masks.set(layer.clipMaskHigh, { key, bytes: inputs.assets.get(layer.clipMaskHigh) })
    }
    prepared.push({ layer, body, native, alphaCache: new Map() })
  }
  return { prepared, masks, animalIds: [...animals.keys()] }
}
async function layerMarkup(prepared, state, time, selectedIds) {
  const defs = [...state.masks.values()]
    .map(
      (m) =>
        `<mask id="${m.key}" maskUnits="userSpaceOnUse" x="0" y="0" width="800" height="820" mask-type="alpha">${image(data(m.bytes), 0, 0, 800, 820)}</mask>`,
    )
    .join('')
  const paint = [],
    motions = []
  for (const item of prepared) {
    const { layer } = item
    if (selectedIds && !selectedIds.has(layer.id)) continue
    const evaluated = evaluatedLayerMotion(layer, time)
    let body = item.body
    // SVG group opacity clamps at1. Pixi alpha may exceed1 because compiled CSS
    // normalizes absolute opacity by the baked baseAlpha. Multiply real RGBA alpha
    // before geometry, preserving the same saturation rather than silently clamping.
    if (evaluated.alpha > 1) {
      const key = evaluated.alpha.toFixed(9)
      if (!item.alphaCache.has(key)) {
        const rest = await sharp(Buffer.from(svg(body)), { density: 216 })
          .png()
          .toBuffer()
        const adjusted = await sharp(rest)
          .ensureAlpha()
          .linear([1, 1, 1, evaluated.alpha], [0, 0, 0, 0])
          .png()
          .toBuffer()
        item.alphaCache.set(key, image(data(adjusted), 0, 0, 800, 820))
      }
      body = item.alphaCache.get(key)
    }
    for (const channel of [...evaluated.channels].reverse())
      body = `<g transform="${matrixText(channel.matrix)}">${body}</g>`
    if (evaluated.alpha <= 1) body = `<g opacity="${Math.max(0, evaluated.alpha)}">${body}</g>`
    if (layer.clipMaskHigh)
      body = `<g mask="url(#${state.masks.get(layer.clipMaskHigh).key})">${body}</g>`
    paint.push(body)
    if (evaluated.channels.length)
      motions.push({
        layer: layer.id,
        sourceMotionId: layer.sourceMotionId,
        clipMaskHigh: layer.clipMaskHigh,
        paint: item.native
          ? 'compiled-native-vector-parts'
          : layer.kind === 'animal'
            ? 'current-native-live-pose-svg'
            : 'actual-3x-compiled-png',
        ...evaluated,
      })
  }
  return {
    body: `<defs>${defs}<clipPath id="core-rect"><rect width="800" height="820"/></clipPath></defs><g clip-path="url(#core-rect)">${paint.join('')}</g>`,
    motions,
  }
}
async function renderCore(state, time, props, selectedIds, density = 216) {
  const result = await layerMarkup(state.prepared, state, time, selectedIds)
  return {
    png: await sharp(Buffer.from(svg(result.body + (props ?? ''))), { density })
      .png()
      .toBuffer(),
    motions: result.motions,
  }
}

const baselineFile = path.join(evidenceRoot, 'baseline.json')
const baseline = await json(baselineFile)
const phaseModule = (relative) =>
  import(
    pathToFileURL(
      path.join(
        phase === 'before' ? path.join(evidenceRoot, 'source-before/apps/web') : web,
        'src/pages/focus',
        relative,
      ),
    ).href
  )
const manifestPath = (id) =>
  phase === 'before'
    ? path.join(evidenceRoot, 'assets-before', id, 'manifest.json')
    : path.join(web, 'public/backgrounds/pixi', id, 'manifest.json')
const assetPath = (url) =>
  phase === 'before'
    ? path.join(evidenceRoot, 'assets-before', ...url.split('/').slice(-2))
    : path.join(web, 'public', url)
async function checkBaseline() {
  const bytes = await readFile(path.join(evidenceRoot, 'capture-baseline-pins.json')),
    pins = JSON.parse(bytes)
  for (const [file, expected] of Object.entries(pins.files))
    if (hash(await readFile(path.join(evidenceRoot, file))) !== expected)
      throw Error(`Archived input changed:${file}`)
  const thumbnailBytes = await readFile(path.join(evidenceRoot, 'capture-thumbnail-baseline.json')),
    thumbnails = JSON.parse(thumbnailBytes)
  for (const f of thumbnails.files)
    if (hash(await readFile(path.join(evidenceRoot, f.file))) !== f.sha256)
      throw Error('Archived production thumbnail changed')
  return { sha256: hash(bytes), files: pins.files, thumbnailPinsSha256: hash(thumbnailBytes) }
}
async function loadCaptureInputs(rooms, allRooms) {
  const sourcePaths = new Set([
    'scripts/capture-autumn-spaces.mjs',
    'scripts/capture-scene-polish.mjs',
    'src/pages/focus/model/pixiScene.ts',
    'src/pages/focus/lib/pixiSceneMotion.ts',
  ])
  if (phase === 'after')
    for (const file of Object.keys(baseline.sourceHashes))
      sourcePaths.add(file.replace(/^apps\/web\//, ''))
  const manifests = new Map(),
    manifestHashes = {},
    assets = new Map(),
    assetHashes = {},
    sourceCache = new Map(),
    mismatches = []
  for (const room of phase === 'before' ? allRooms.filter((r) => rooms.includes(r.id)) : allRooms) {
    const bytes = await readFile(manifestPath(room.id)),
      manifest = JSON.parse(bytes)
    validatePixiManifest(manifest, room.id)
    if (!manifest.provenance?.sourceHashes || manifest.animalLifeVersion !== 1)
      throw Error('Missing compiled provenance/animal slots')
    manifestHashes[room.id] = hash(bytes)
    if (phase === 'before') {
      if (manifestHashes[room.id] !== baseline.rooms[room.id].manifestSha256)
        throw Error('Archived manifest differs from parent baseline')
    } else
      for (const expected of manifest.provenance.sourceHashes) {
        sourcePaths.add(expected.path)
        if (!sourceCache.has(expected.path))
          sourceCache.set(expected.path, hash(await readFile(path.join(web, expected.path))))
        if (sourceCache.get(expected.path) !== expected.sha256)
          mismatches.push({
            room: room.id,
            source: expected.path,
            expected: expected.sha256,
            actual: sourceCache.get(expected.path),
          })
      }
    if (rooms.includes(room.id)) manifests.set(room.id, manifest)
  }
  if (mismatches.length)
    throw Error(`Stale canonical export:${JSON.stringify(mismatches.slice(0, 6))}`)
  // The only live application code executing during before is the stable compiler
  // vector/motion adapter. All other baseline modules are imported from snapshots.
  if (phase === 'before')
    for (const rel of ['model/pixiScene.ts', 'lib/pixiSceneMotion.ts']) {
      const name = 'apps/web/src/pages/focus/' + rel
      if (hash(await readFile(path.join(workspace, name))) !== baseline.sourceHashes[name])
        throw Error('Baseline live adapter changed:' + name)
    }
  for (const m of manifests.values())
    for (const url of new Set(
      [
        m.weatherMaskHigh,
        m.weatherMask,
        ...m.layers.flatMap((l) => [l.src, l.srcHigh, l.clipMask, l.clipMaskHigh]),
      ].filter(Boolean),
    )) {
      if (!/^\/backgrounds\/[\w/-]+\.png$/.test(url)) throw Error('Unsafe asset URL')
      if (!assets.has(url)) {
        const bytes = await readFile(assetPath(url))
        assets.set(url, bytes)
        assetHashes[url] = hash(bytes)
      }
    }
  return { sourcePaths, manifests, manifestHashes, assets, assetHashes }
}
async function worldPaint(id) {
  if (phase === 'before')
    return Object.fromEntries(
      await Promise.all(
        ['underlay', 'joinery'].map(async (layer) => [
          layer,
          await readFile(path.join(evidenceRoot, 'world-before', `${id}-${layer}.svg`), 'utf8'),
        ]),
      ),
    )
  const { sceneWorldSvg } = await phaseModule('lib/sceneWorldArt.ts')
  return { underlay: sceneWorldSvg(id, 'underlay'), joinery: sceneWorldSvg(id, 'joinery') }
}
async function openingBox(manifest, inputs) {
  const bytes = inputs.assets.get(manifest.weatherMaskHigh),
    { width, height } = await sharp(bytes).metadata(),
    stats = await rawStats(bytes)
  if (width !== 2400 || height !== 2460 || !stats.bounds)
    throw Error('Missing full-world3x aperture mask')
  const x = Math.max(0, Math.floor(stats.bounds.left / 3) - 8),
    y = Math.max(0, Math.floor(stats.bounds.top / 3) - 8),
    right = Math.min(800, Math.ceil((stats.bounds.right + 1) / 3) + 8),
    bottom = Math.min(820, Math.ceil((stats.bounds.bottom + 1) / 3) + 8)
  return {
    x,
    y,
    width: right - x,
    height: bottom - y,
    source: 'Actual stationary compiled weather-mask-high occupied bounds, expanded8worldpx.',
  }
}
const timeLabel = (time) => String(time).replace('.', 'p')
async function capture() {
  sharp.cache(false)
  sharp.concurrency(1)
  const archivedPins = await checkBaseline(),
    output = path.resolve(
      workspace,
      option('--output', `artifacts/autumn-spaces-2026-11-13/capture-${phase}`),
    )
  if (!path.relative(evidenceRoot, output).startsWith('capture-'))
    throw Error('Output must be capture-* under task artifacts')
  try {
    await readFile(path.join(output, 'manifest.json'))
    throw Error('Refusing to overwrite completed capture')
  } catch (e) {
    if (e.code !== 'ENOENT') throw e
  }
  const { ALL_BACKGROUNDS } = await phaseModule('model/backgrounds.ts'),
    rooms = option('--only', defaultRooms.join(',')).split(',')
  if (rooms.some((id) => !defaultRooms.includes(id))) throw Error('Bounded to8 autumn target rooms')
  const inputs = await loadCaptureInputs(rooms, ALL_BACKGROUNDS),
    start = await sourceState(inputs.sourcePaths)
  const [{ frameSceneWorld }, { SCENE_WORLD_BOUNDS: bounds }, propsModel, propsDrawing] =
    await Promise.all([
      phaseModule('model/sceneWorldCamera.ts'),
      phaseModule('model/sceneWorldCatalog.ts'),
      phaseModule('model/sceneInteractiveObjects.ts'),
      phaseModule('lib/sceneInteractiveDrawing.ts'),
    ])
  if (propsModel.SCENE_INTERACTIVE_OBJECTS.length !== 136) throw Error('Click prop catalog changed')
  for (const dir of ['rooms', 'details', 'motion', 'thumbnails'])
    await mkdir(path.join(output, dir), { recursive: true })
  const records = [],
    thumbnailHashes = {}

  for (const id of rooms) {
    const manifest = inputs.manifests.get(id),
      state = await prepareRoom(manifest, inputs),
      props = propsModel.getSceneInteractiveObjects(id),
      world = await worldPaint(id),
      windowBox = await openingBox(manifest, inputs)
    if (props.length !== 2) throw Error('Missing room discoveries')
    const thumbnailSource =
      phase === 'before'
        ? path.join(evidenceRoot, 'capture-thumbnails-before', id + '.webp')
        : path.join(web, 'public/backgrounds/thumbnail', id + '.webp')
    const thumbnailBytes = await readFile(thumbnailSource),
      thumbnailFile = `thumbnails/${id}-production.webp`,
      thumbnailMetadata = await sharp(thumbnailBytes).metadata()
    thumbnailHashes[thumbnailSource] = hash(thumbnailBytes)
    await writeFile(path.join(output, thumbnailFile), thumbnailBytes)
    const propSvg = inner(propsDrawing.sceneInteractiveLayerSvg(props)),
      record = {
        id,
        phase,
        manifestSha256: inputs.manifestHashes[id],
        weather: manifest.weather,
        weatherPrecipitationRendered: false,
        coffee: 0,
        animalSeed: 42,
        animalTime: 60,
        animalIds: state.animalIds,
        restingProps: props.map((p) => p.id),
        worldHashes: Object.fromEntries(
          Object.entries(world).map(([k, v]) => [k, hash(Buffer.from(v))]),
        ),
        windowBox,
        productionThumbnail: {
          file: thumbnailFile,
          sha256: hash(thumbnailBytes),
          source: path.relative(workspace, thumbnailSource),
          width: thumbnailMetadata.width,
          height: thumbnailMetadata.height,
          method: 'Exact production thumbnail bytes, not CPU approximation.',
        },
        frames: [],
      }
    for (const time of [0, 5.5]) {
      const core = await renderCore(state, time, propSvg),
        frame = {
          clockSeconds: time,
          coreSha256: hash(core.png),
          evaluatedLayerMotions: core.motions,
          views: {},
        }
      for (const [w, h] of [
        [1440, 900],
        [390, 844],
        [320, 568],
      ]) {
        const f = frameSceneWorld(w, h, id)
        if (
          f.x < -0.000001 ||
          f.y < -0.000001 ||
          f.x + f.width > w + 0.000001 ||
          f.y + f.height > h + 0.000001
        )
          throw Error('Protected core cropped')
        const body = `<g transform="translate(${f.x} ${f.y}) scale(${f.scale})"><g transform="translate(${bounds.x} ${bounds.y})">${inner(world.underlay)}</g>${image(data(core.png), 0, 0, 800, 820)}<g transform="translate(${bounds.x} ${bounds.y})">${inner(world.joinery)}</g></g>`,
          png = await sharp(Buffer.from(svg(body, w, h)))
            .png()
            .toBuffer(),
          file = `rooms/${id}-${w}x${h}-t${timeLabel(time)}.png`
        await writeFile(path.join(output, file), png)
        frame.views[`${w}x${h}`] = { file, sha256: hash(png), framing: f }
      }
      for (const [type, box, scale] of [
        ['core', { x: 0, y: 0, width: 800, height: 820 }, 1],
        ['window', windowBox, 2],
      ]) {
        const png = await sharp(core.png)
            .extract({
              left: box.x * 3,
              top: box.y * 3,
              width: box.width * 3,
              height: box.height * 3,
            })
            .resize(box.width * scale, box.height * scale)
            .png()
            .toBuffer(),
          file = `details/${id}-${type}-t${timeLabel(time)}.png`
        await writeFile(path.join(output, file), png)
        frame[type + 'Crop'] = { file, sha256: hash(png), worldBox: box, scale }
      }
      if (time === 0) {
        const png = await sharp(core.png).resize(240, 246).png().toBuffer(),
          file = `thumbnails/${id}-cpu-core.png`
        await writeFile(path.join(output, file), png)
        record.cpuCoreThumbnail = {
          file,
          sha256: hash(png),
          method: 'CPU capture resized to240×246; not the actual production gallery WebP.',
        }
      }
      const ids = new Set(
        state.prepared
          .filter((i) =>
            (i.layer.motions ?? (i.layer.motion ? [i.layer.motion] : [])).some((m) =>
              /autumn-leaf/.test(m.cssName ?? m.kind),
            ),
          )
          .map((i) => i.layer.id),
      )
      if (ids.size) {
        const isolated = await renderCore(state, time, '', ids, 72),
          file = `motion/${id}-autumn-leaves-t${timeLabel(time)}.png`
        await writeFile(path.join(output, file), isolated.png)
        frame.isolatedAutumnMotion = {
          file,
          sha256: hash(isolated.png),
          statistics: await rawStats(isolated.png),
          motions: isolated.motions,
        }
      }
      record.frames.push(frame)
      console.log(`AUTUMN ${phase} ${id} ${time}s`)
    }
    records.push(record)
  }
  for (const record of records)
    if (phase === 'after') {
      const poses = record.frames.map((f) => f.isolatedAutumnMotion).filter(Boolean)
      if (
        poses.length !== 2 ||
        new Set(poses.map((p) => p.sha256)).size < 2 ||
        !poses.some((p) => p.statistics.occupiedPixels > 0)
      )
        throw Error('Autumn leaf motion is static/invisible: ' + record.id)
    }
  const comparison = phase === 'after' ? await comparisons(output, records) : []
  const overview = await overviewBoard(output, records)
  const end = await sourceState(inputs.sourcePaths),
    sourceChanged = Object.keys(start).filter((p) => start[p] !== end[p]),
    manifestChanged = [],
    assetChanged = [],
    worldChanged = [],
    thumbnailChanged = []
  for (const [id, expected] of Object.entries(inputs.manifestHashes))
    if (hash(await readFile(manifestPath(id))) !== expected) manifestChanged.push(id)
  for (const [url, expected] of Object.entries(inputs.assetHashes))
    if (hash(await readFile(assetPath(url))) !== expected) assetChanged.push(url)
  for (const record of records) {
    const world = await worldPaint(record.id)
    for (const [key, value] of Object.entries(world))
      if (hash(Buffer.from(value)) !== record.worldHashes[key])
        worldChanged.push(record.id + ':' + key)
  }
  for (const [file, expected] of Object.entries(thumbnailHashes))
    if (hash(await readFile(file)) !== expected)
      thumbnailChanged.push(path.relative(workspace, file))
  await checkBaseline()
  const result = {
    request: 'f5c876cf',
    phase,
    method:
      'Archived/current actual3x compiled paint and eligible native vectors; runtime evaluated nested CSS matrices and postmotion stationary clip masks; archived/current native animal poses fixed60s seed42;136-prop catalog atrest; saved/current world SVG and actual shared camera. Weather precipitation intentionally omitted in both phases. CPU sampled images, not browser/GPU/continuous playback.',
    limitations: [
      'Weather precipitation excluded: travel-train sleet→heavy-rain is metadata only in this proof.',
      'Baseline executes archived animal/prop/camera modules with saved compiled assets/world SVGs; only stable live vector/motion adapters execute and are checked against baseline hashes.',
      'CPU raster/SVG antialiasing can differ from native GPU output; capture-author checks are not independent tooling approval.',
    ],
    archivedInputPins: archivedPins,
    sourceFiles: start,
    sourceChangedDuringCapture: sourceChanged,
    manifestsChangedDuringCapture: manifestChanged,
    assetsChangedDuringCapture: assetChanged,
    worldChangedDuringCapture: worldChanged,
    thumbnailsChangedDuringCapture: thumbnailChanged,
    canonicalCurrentExportRooms: phase === 'after' ? ALL_BACKGROUNDS.length : 0,
    manifestHashes: inputs.manifestHashes,
    referencedAssetHashes: inputs.assetHashes,
    thumbnailSourceHashes: Object.fromEntries(
      Object.entries(thumbnailHashes).map(([k, v]) => [path.relative(workspace, k), v]),
    ),
    overview,
    comparisons: comparison,
    records,
  }
  await saveJson(path.join(output, 'manifest.json'), result)
  if (
    sourceChanged.length ||
    manifestChanged.length ||
    assetChanged.length ||
    worldChanged.length ||
    thumbnailChanged.length
  )
    throw Error('Capture freeze broken')
  console.log(
    JSON.stringify({
      phase,
      output,
      rooms: records.length,
      frames: records.reduce((n, r) => n + r.frames.length, 0),
      sourcePins: Object.keys(start).length,
      assets: Object.keys(inputs.assetHashes).length,
    }),
  )
}

async function overviewBoard(output, records) {
  const paint = [],
    labels = []
  for (const [i, r] of records.entries()) {
    const v = r.frames[0].views['1440x900'],
      bytes = await readFile(path.join(output, v.file)),
      x = (i % 2) * 480,
      y = Math.floor(i / 2) * 330 + 30
    if (hash(bytes) !== v.sha256) throw Error('Overview input changed')
    paint.push({ input: await sharp(bytes).resize(480, 300).png().toBuffer(), left: x, top: y })
    labels.push(
      `<text x="${x + 8}" y="${y - 9}" font-size="12">${phase}: ${r.id}, clock0, precipitation excluded</text>`,
    )
  }
  const height = Math.ceil(records.length / 2) * 330,
    png = await sharp({ create: { width: 960, height, channels: 4, background: '#18201d' } })
      .composite([
        ...paint,
        {
          input: Buffer.from(
            svg(`<g fill="#e4e5dc" font-family="monospace">${labels.join('')}</g>`, 960, height),
          ),
          left: 0,
          top: 0,
        },
      ])
      .png()
      .toBuffer(),
    file = `autumn-eight-${phase}-overview.png`
  await writeFile(path.join(output, file), png)
  return {
    file,
    sha256: hash(png),
    method: 'All8 actual PC images at clock0, one-third size. CPU, precipitation omitted.',
  }
}
async function comparisons(output, records) {
  const beforeRoot = path.resolve(
      workspace,
      option('--before-output', 'artifacts/autumn-spaces-2026-11-13/capture-before'),
    ),
    beforeBytes = await readFile(path.join(beforeRoot, 'manifest.json')),
    before = JSON.parse(beforeBytes),
    results = []
  async function verified(root, e) {
    const b = await readFile(path.join(root, e.file))
    if (hash(b) !== e.sha256) throw Error('Comparison input changed')
    return b
  }
  const allPaint = [],
    allLabels = [],
    thumbs = [],
    thumbLabels = []
  for (const [index, r] of records.entries()) {
    const old = before.records.find((s) => s.id === r.id)
    if (!old) throw Error('Missing baseline room')
    const paint = [],
      labels = []
    for (const [size, x, y, w, h] of [
      ['1440x900', 12, 70, 720, 450],
      ['390x844', 12, 568, 390, 844],
      ['320x568', 820, 568, 320, 568],
    ]) {
      for (const [root, record, left] of [
        [beforeRoot, old, x],
        [output, r, x + w + (size === '1440x900' ? 16 : 10)],
      ])
        paint.push({
          input: await sharp(await verified(root, record.frames[0].views[size]))
            .resize(w, h)
            .png()
            .toBuffer(),
          left,
          top: y,
        })
      labels.push(
        `<text x="${x}" y="${y - 10}" font-size="12">${size}: archived BEFORE / current AFTER at clock0</text>`,
      )
    }
    const label = svg(
      `<g fill="#e4e5dc" font-family="monospace"><text x="12" y="22" font-size="17">${r.id}: autumn</text><text x="12" y="43" font-size="11">Actual compiled CPU/art + animals60s seed42 + propsrest + shared camera; precipitation excluded; NOT browser/GPU.</text>${labels.join('')}</g>`,
      1470,
      1430,
    )
    const png = await sharp({
        create: { width: 1470, height: 1430, channels: 4, background: '#18201d' },
      })
        .composite([...paint, { input: Buffer.from(label), left: 0, top: 0 }])
        .png()
        .toBuffer(),
      file = `${r.id}-before-after-board.png`
    await writeFile(path.join(output, file), png)
    results.push({
      id: r.id,
      file,
      sha256: hash(png),
      beforeManifestSha256: hash(beforeBytes),
      clockSeconds: 0,
    })
    const row = Math.floor(index / 2),
      pair = index % 2
    for (const [col, root, record, title] of [
      [0, beforeRoot, old, 'BEFORE'],
      [1, output, r, 'AFTER'],
    ]) {
      const x = (pair * 2 + col) * 480,
        y = row * 330 + 30
      allPaint.push({
        input: await sharp(await verified(root, record.frames[0].views['1440x900']))
          .resize(480, 300)
          .png()
          .toBuffer(),
        left: x,
        top: y,
      })
      allLabels.push(`<text x="${x + 8}" y="${y - 9}" font-size="12">${r.id} ${title}</text>`)
      const tx = (pair * 2 + col) * 240,
        ty = row * 276 + 30
      thumbs.push({
        input: await sharp(await verified(root, record.productionThumbnail))
          .resize(240, 246)
          .png()
          .toBuffer(),
        left: tx,
        top: ty,
      })
      thumbLabels.push(`<text x="${tx + 5}" y="${ty - 9}" font-size="10">${r.id} ${title}</text>`)
    }
  }
  for (const [file, width, height, paint, labels, method] of [
    [
      'autumn-eight-before-after-overview.png',
      1920,
      Math.ceil(records.length / 2) * 330,
      allPaint,
      allLabels,
      '8 paired actual PC clock0 frames, weather omitted.',
    ],
    [
      'autumn-eight-production-thumbnails.png',
      960,
      Math.ceil(records.length / 2) * 276,
      thumbs,
      thumbLabels,
      'Actual before/after production thumbnail WebPs, resized only for board.',
    ],
  ]) {
    const png = await sharp({ create: { width, height, channels: 4, background: '#18201d' } })
      .composite([
        ...paint,
        {
          input: Buffer.from(
            svg(`<g fill="#e4e5dc" font-family="monospace">${labels.join('')}</g>`, width, height),
          ),
          left: 0,
          top: 0,
        },
      ])
      .png()
      .toBuffer()
    await writeFile(path.join(output, file), png)
    results.push({ file, sha256: hash(png), beforeManifestSha256: hash(beforeBytes), method })
  }
  return results
}
async function selfTest() {
  const { Container } = await import('pixi.js'),
    values = { x: 8, y: -12, rotation: 0.4, scaleX: 0.7, scaleY: 1.2, skewX: 0.16, skewY: -0.1 },
    motion = { kind: 'test', pivotX: 150, pivotY: 85 },
    n = new Container(),
    t = cssSkewToPixi(values)
  n.pivot.set(motion.pivotX, motion.pivotY)
  n.position.set(motion.pivotX + values.x, motion.pivotY + values.y)
  n.rotation = values.rotation
  n.scale.set(t.scaleX, t.scaleY)
  n.skew.set(t.skewX, t.skewY)
  n.updateLocalTransform()
  const matrix = motionMatrix(motion, values)
  for (const [i, k] of ['a', 'b', 'c', 'd', 'tx', 'ty'].entries())
    if (Math.abs(n.localTransform[k] - matrix[i]) > 1e-9)
      throw Error('Actual Pixi matrix differs from CPU')
  n.destroy()
  const fixture = await sharp(
    Buffer.from(
      svg(
        '<defs><clipPath id="ap"><rect x="20" y="20" width="40" height="40"/></clipPath></defs><g clip-path="url(#ap)"><g transform="translate(25 0)"><rect x="10" y="10" width="45" height="45" fill="white"/></g></g>',
        80,
        80,
      ),
    ),
  )
    .ensureAlpha()
    .raw()
    .toBuffer()
  if (fixture[(30 * 80 + 65) * 4 + 3] !== 0 || fixture[(30 * 80 + 40) * 4 + 3] === 0)
    throw Error('Stationary mask must follow motion')
  const [{ frameSceneWorld }, { SCENE_WORLD_BOUNDS: bounds }, propsModel] = await Promise.all([
    phaseModule('model/sceneWorldCamera.ts'),
    phaseModule('model/sceneWorldCatalog.ts'),
    phaseModule('model/sceneInteractiveObjects.ts'),
  ])
  if (bounds.x !== -900 || bounds.y !== -760 || bounds.width !== 2600 || bounds.height !== 2340)
    throw Error('World bounds changed unexpectedly')
  for (const id of defaultRooms) {
    if (propsModel.getSceneInteractiveObjects(id).length !== 2)
      throw Error('Missing two room props')
    for (const [w, h] of [
      [1440, 900],
      [390, 844],
      [320, 568],
    ]) {
      const f = frameSceneWorld(w, h, id)
      if (
        f.x < -0.000001 ||
        f.y < -0.000001 ||
        f.x + f.width > w + 0.000001 ||
        f.y + f.height > h + 0.000001
      )
        throw Error('Core cropped')
    }
  }
  const result = {
    phase,
    method:
      'Capture-author self-test: actual Pixi local matrix equality; stationary postmotion clipping fixture; archived/current camera bounds and8room×3viewport protected-core checks; full saved-input/thumbnail hash guard. No independent tooling approval.',
    matrixErrorTolerance: 1e-9,
    stationaryClip: true,
    protectedCoreViews: 24,
    propsPerRoom: 2,
    archivedInputPinsSha256: (await checkBaseline()).sha256,
    sourceScriptSha256: hash(await readFile(fileURLToPath(import.meta.url))),
  }
  await saveJson(path.join(evidenceRoot, `capture-selftest-${phase}.json`), result)
  console.log(JSON.stringify(result))
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (args.includes('--self-test')) await selfTest()
  else if (args.includes('--capture')) await capture()
  else
    console.log(
      'Use --self-test or --capture --phase before|after; after requires canonical + compatibility exports. Weather omitted, no browser/export invoked.',
    )
}
