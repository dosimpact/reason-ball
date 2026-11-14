/** Bounded lighthouse CPU QA derivative of capture-scene-polish.mjs.
 * Exact compiled art + runtime weather poses; no browser/GPU/continuous-playback claim.
 * Baseline snapshots are read-only; current capture requires canonical export freeze. */
import sharp from 'sharp'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
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
const defaultRooms = ['premium-storm-lighthouse']
const evidenceRoot = path.join(workspace, 'artifacts/lighthouse-thunderstorm-2026-11-13')
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
import { evaluatedLayerMotion, multiply, motionMatrix } from './capture-scene-polish.mjs'
const matrixText = (matrix) => `matrix(${matrix.map((n) => Number(n.toFixed(10))).join(' ')})`
const focusPins = [
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
  'model/sceneWorldCatalog.ts',
  'lib/animalDrawing.ts',
  'model/animalLife.ts',
  'model/animalHabitats.ts',
  'model/animalSpecies.ts',
  'model/petRoutine.ts',
  'lib/pixiSceneMotion.ts',
  'model/pixiScene.ts',
  'ui/Cafe.tsx',
  'ui/SceneWindow.tsx',
  'ui/RoomWindow.tsx',
  'ui/RoomLighting.tsx',
  'ui/RoomFurnishings.tsx',
  'ui/SceneOutdoorLife.tsx',
  'ui/backgrounds.css',
  'ui/scene-effects.css',
  'ui/premium/PremiumScene.tsx',
  'ui/premium/PremiumArchitecture.tsx',
  'ui/premium/PremiumFixtures.tsx',
  'ui/premium/PremiumSignatureDetails.tsx',
  'ui/premium/PremiumHeroes.tsx',
  'ui/premium/PremiumObjects.tsx',
  'ui/premium/premiumGeometry.ts',
  'ui/premium/premium.css',
  'ui/premium/premium-signatures.css',
]
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
async function loadCaptureInputs(rooms, allRooms) {
  const sourcePaths = new Set(
    focusPins
      .map((p) => 'src/pages/focus/' + p)
      .concat([
        'scripts/capture-scene-polish.mjs',
        'scripts/capture-lighthouse-thunderstorm.mjs',
        'src/pages/focus/lib/pixiWeather.ts',
        'src/pages/focus/model/sceneWeather.ts',
        'src/pages/focus/ui/SceneWeatherDrawing.tsx',
        'src/pages/focus/ui/weather.css',
        'src/pages/focus/model/sakuraPetals.ts',
        'src/pages/focus/model/thunderstorm.ts',
        'src/pages/focus/ui/RainOverlay.tsx',
        'src/pages/focus/ui/SceneAtmosphere.tsx',
        'src/pages/focus/ui/viewport-rain.css',
        'src/pages/focus/lib/sceneEffectCycle.ts',
      ]),
  )
  const manifests = new Map(),
    manifestHashes = {},
    sourceMismatch = []
  const sourceCache = new Map()
  for (const room of phase === 'before' ? allRooms.filter((r) => rooms.includes(r.id)) : allRooms) {
    const file = manifestPath(room.id),
      bytes = await readFile(file),
      raw = JSON.parse(bytes)
    validatePixiManifest(raw, room.id)
    if (raw.animalLifeVersion !== 1 || !raw.provenance?.sourceHashes)
      throw Error(`Missing current export provenance ${room.id}`)
    manifestHashes[room.id] = hash(bytes)
    for (const expected of raw.provenance.sourceHashes) {
      sourcePaths.add(expected.path)
      if (!sourceCache.has(expected.path))
        sourceCache.set(expected.path, hash(await readFile(path.join(web, expected.path))))
      if (sourceCache.get(expected.path) !== expected.sha256)
        sourceMismatch.push({
          room: room.id,
          source: expected.path,
          expected: expected.sha256,
          actual: sourceCache.get(expected.path),
        })
    }
    if (rooms.includes(room.id)) manifests.set(room.id, raw)
  }
  if (phase === 'before') {
    const archived = (await checkBaseline()).files
    const unexplained = sourceMismatch.filter(
      (m) => !archived['source-before/apps/web/' + m.source],
    )
    if (unexplained.length)
      throw Error(
        `Baseline model/provenance changed without archived source: ${JSON.stringify(unexplained.slice(0, 8))}`,
      )
  }
  if (phase === 'after' && sourceMismatch.length)
    throw Error(
      `Stale global compiled provenance; canonical full export required: ${JSON.stringify(sourceMismatch.slice(0, 8))}`,
    )
  const assets = new Map(),
    assetHashes = {}
  for (const manifest of manifests.values()) {
    const urls = new Set(
      [
        manifest.weatherMask,
        manifest.weatherMaskHigh,
        ...manifest.layers.flatMap((l) => [l.src, l.srcHigh, l.clipMask, l.clipMaskHigh]),
      ].filter(Boolean),
    )
    for (const url of urls) {
      if (!/^\/backgrounds\/[\w/-]+\.png$/.test(url)) throw Error(`Unsafe asset ${url}`)
      if (!assets.has(url)) {
        const bytes = await readFile(assetPath(url))
        assets.set(url, bytes)
        assetHashes[url] = hash(bytes)
      }
    }
  }
  return {
    manifests,
    manifestHashes,
    sourcePaths,
    assets,
    assetHashes,
    archivedSourceDifferences: sourceMismatch,
  }
}
async function animalPaint(id, manifest) {
  const [{ getAnimalHabitat }, { AnimalLifeSimulation }, drawing] = await Promise.all([
    import('../src/pages/focus/model/animalHabitats.ts'),
    import('../src/pages/focus/model/animalLife.ts'),
    import('../src/pages/focus/lib/animalDrawing.ts'),
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
    if (!coffeeLayerVisible(layer, 0)) continue
    if (layer.kind === 'weather') {
      prepared.push({ layer, body: '', native: true, alphaCache: new Map() })
      continue
    }
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
  const weatherMask = inputs.assets.get(manifest.weatherMaskHigh ?? manifest.weatherMask)
  if (!weatherMask) throw Error('Missing stationary weather aperture')
  const weather =
    phase === 'before'
      ? 'storm'
      : (await import('../src/pages/focus/model/sceneWeather.ts')).getSceneWeather(manifest.id)
  return {
    prepared,
    masks,
    animalIds: [...animals.keys()],
    weatherMask,
    weather,
    roomId: manifest.id,
    weatherApi: await weatherApi(),
    weatherSeed: [...manifest.id].reduce((n, c) => n + c.charCodeAt(0), 0),
  }
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
    if (layer.kind === 'weather') {
      paint.push(await weatherMarkup(state, time))
      continue
    }
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

const manifestPath = (id) =>
  phase === 'before'
    ? path.join(evidenceRoot, 'assets-before', id, 'manifest.json')
    : path.join(web, 'public/backgrounds/pixi', id, 'manifest.json')
const assetPath = (url) =>
  phase === 'before'
    ? path.join(evidenceRoot, 'assets-before', ...url.split('/').slice(-2))
    : path.join(web, 'public', url)

const weatherModules = new Map()
async function weatherApi(archived = phase === 'before') {
  if (!weatherModules.has(archived)) {
    if (!archived) weatherModules.set(archived, import('../src/pages/focus/lib/pixiWeather.ts'))
    else {
      const { stripTypeScriptTypes } = await import('node:module')
      const archivedSource = async (name) =>
        stripTypeScriptTypes(
          await readFile(
            path.join(evidenceRoot, 'source-before/apps/web/src/pages/focus', name),
            'utf8',
          ),
        )
      const petals =
        'data:text/javascript;base64,' +
        Buffer.from(await archivedSource('model/sakuraPetals.ts')).toString('base64')
      const code = (await archivedSource('lib/pixiWeather.ts'))
        .replaceAll("from 'pixi.js'", `from '${import.meta.resolve('pixi.js')}'`)
        .replaceAll("from '../model/sakuraPetals.ts'", `from '${petals}'`)
      weatherModules.set(
        archived,
        import('data:text/javascript;base64,' + Buffer.from(code).toString('base64')),
      )
    }
  }
  return weatherModules.get(archived)
}
async function checkBaseline() {
  const bytes = await readFile(path.join(evidenceRoot, 'capture-baseline-pins.json'))
  const pins = JSON.parse(bytes)
  for (const [file, expected] of Object.entries(pins.files))
    if (hash(await readFile(path.join(evidenceRoot, file))) !== expected)
      throw Error(`Baseline input mutated: ${file}`)
  return { sha256: hash(bytes), files: pins.files }
}
const timeLabel = (time) => String(Number(time.toFixed(5))).replace('.', 'p')

async function capture() {
  sharp.cache(false)
  sharp.concurrency(1)
  const baseline = await checkBaseline(),
    output = path.resolve(
      workspace,
      option('--output', `artifacts/lighthouse-thunderstorm-2026-11-13/capture-${phase}`),
    )
  if (!path.relative(evidenceRoot, output).startsWith('capture-'))
    throw Error('Output must be capture-* under task evidence root')
  try {
    await readFile(path.join(output, 'manifest.json'))
    throw Error('Refusing to overwrite completed capture')
  } catch (e) {
    if (e.code !== 'ENOENT') throw e
  }
  const { ALL_BACKGROUNDS } = await import('../src/pages/focus/model/backgrounds.ts')
  const inputs = await loadCaptureInputs(defaultRooms, ALL_BACKGROUNDS),
    start = await sourceState(inputs.sourcePaths)
  const [
    { frameSceneWorld },
    { sceneWorldSvg },
    { SCENE_WORLD_BOUNDS: bounds },
    propsModel,
    propsDrawing,
  ] = await Promise.all([
    import('../src/pages/focus/model/sceneWorldCamera.ts'),
    import('../src/pages/focus/lib/sceneWorldArt.ts'),
    import('../src/pages/focus/model/sceneWorldCatalog.ts'),
    import('../src/pages/focus/model/sceneInteractiveObjects.ts'),
    import('../src/pages/focus/lib/sceneInteractiveDrawing.ts'),
  ])
  if (propsModel.SCENE_INTERACTIVE_OBJECTS.length !== 136) throw Error('Click prop catalog changed')
  for (const dir of ['rooms', 'weather', 'details'])
    await mkdir(path.join(output, dir), { recursive: true })
  const id = defaultRooms[0],
    manifest = inputs.manifests.get(id),
    state = await prepareRoom(manifest, inputs),
    props = propsModel.getSceneInteractiveObjects(id)
  if (props.length !== 2) throw Error('Room discoveries changed')
  const propSvg = inner(propsDrawing.sceneInteractiveLayerSvg(props)),
    world = { underlay: sceneWorldSvg(id, 'underlay'), joinery: sceneWorldSvg(id, 'joinery') }
  const record = {
    id,
    phase,
    manifestSha256: inputs.manifestHashes[id],
    weather: state.weather,
    weatherSeed: state.weatherSeed,
    weatherSlot: manifest.layers.findIndex((l) => l.kind === 'weather'),
    coffee: 0,
    animalTime: 60,
    animalSeed: 42,
    animalIds: state.animalIds,
    restingProps: props.map((p) => p.id),
    worldHashes: Object.fromEntries(
      Object.entries(world).map(([k, v]) => [k, hash(Buffer.from(v))]),
    ),
    frames: [],
  }
  if (record.weatherSlot < 0) throw Error('Expected original compiled weather slot')
  for (const sample of await captureTimes()) {
    const time = sample.time,
      core = await renderCore(state, time, propSvg),
      frame = {
        label: sample.label,
        clockSeconds: time,
        coreSha256: hash(core.png),
        evaluatedLayerMotions: core.motions,
        weatherEvent: await weatherEvent(state, time),
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
      const body = `<g transform="translate(${f.x} ${f.y}) scale(${f.scale})"><g transform="translate(${bounds.x} ${bounds.y})">${inner(world.underlay)}</g>${image(data(core.png), 0, 0, 800, 820)}<g transform="translate(${bounds.x} ${bounds.y})">${inner(world.joinery)}</g></g>`
      const png = await sharp(Buffer.from(svg(body, w, h)))
          .png()
          .toBuffer(),
        file = `rooms/${id}-${w}x${h}-t${timeLabel(time)}.png`
      await writeFile(path.join(output, file), png)
      frame.views[`${w}x${h}`] = { file, sha256: hash(png), framing: f }
    }
    const box = { x: 95, y: 25, width: 610, height: 600 },
      detail = await sharp(core.png)
        .extract({ left: box.x * 3, top: box.y * 3, width: box.width * 3, height: box.height * 3 })
        .resize(box.width * 2, box.height * 2)
        .png()
        .toBuffer(),
      detailFile = `details/window-${sample.label}-t${timeLabel(time)}.png`
    await writeFile(path.join(output, detailFile), detail)
    frame.windowCloseup = { file: detailFile, sha256: hash(detail), worldBox: box, scale: 2 }
    for (const kind of ['all', 'effects']) {
      const png = await sharp(Buffer.from(svg(await weatherMarkup(state, time, kind))))
          .png()
          .toBuffer(),
        file = `weather/${kind}-${sample.label}-t${timeLabel(time)}.png`,
        statistics = await rawStats(png, state.weatherMask)
      if (statistics.outsideClipPixels) throw Error('Weather outside stationary aperture')
      await writeFile(path.join(output, file), png)
      frame[kind === 'all' ? 'isolatedWeather' : 'isolatedEffects'] = {
        file,
        sha256: hash(png),
        statistics,
      }
    }
    record.frames.push(frame)
    console.log(`LIGHTHOUSE ${phase} ${sample.label} ${time}s`)
  }
  const comparisons = phase === 'after' ? await comparisonBoards(output, record) : []
  const end = await sourceState(inputs.sourcePaths),
    sourceChanged = Object.keys(start).filter((p) => start[p] !== end[p]),
    manifestChanged = [],
    assetChanged = []
  for (const [id, expected] of Object.entries(inputs.manifestHashes))
    if (hash(await readFile(manifestPath(id))) !== expected) manifestChanged.push(id)
  for (const [url, expected] of Object.entries(inputs.assetHashes))
    if (hash(await readFile(assetPath(url))) !== expected) assetChanged.push(url)
  await checkBaseline()
  const result = {
    request: '0455b4a9',
    phase,
    method:
      'Actual current/saved compiled3x paint and eligible native vectors, runtime nested CSS matrices and postmotion masks; runtime weather poses plus shared thunderstorm geometry/envelopes mapped toCPU SVG in original weather slot; animals60s seed42, propsatrest, room weather seed, shared world camera. Sampled CPU only, no browser/GPU/continuous-playback claim.',
    limitations: [
      'CPU SVG edge antialiasing can differ from native Graphics GPU output.',
      'Conformance checks are capture-author verification, not independent approval of this tool.',
      'Baseline uses exact archived sparse-storm source and compiled assets with unchanged live animal/prop/world models, guarded against unexplained source differences.',
    ],
    baselinePins: baseline,
    sourceFiles: start,
    sourceChangedDuringCapture: sourceChanged,
    manifestsChangedDuringCapture: manifestChanged,
    assetsChangedDuringCapture: assetChanged,
    canonicalExportProvenanceVerifiedRooms: phase === 'after' ? ALL_BACKGROUNDS.length : 0,
    publicManifestHashes: inputs.manifestHashes,
    referencedAssetHashes: inputs.assetHashes,
    archivedSourceDifferences: inputs.archivedSourceDifferences,
    comparisons,
    records: [record],
  }
  await saveJson(path.join(output, 'manifest.json'), result)
  if (sourceChanged.length || manifestChanged.length || assetChanged.length)
    throw Error('Capture freeze broken')
  console.log(
    JSON.stringify({
      phase,
      output,
      frames: record.frames.length,
      sourcePins: Object.keys(start).length,
      assets: Object.keys(inputs.assetHashes).length,
    }),
  )
}

async function comparisonBoards(output, record) {
  const beforeRoot = path.resolve(
      workspace,
      option('--before-output', 'artifacts/lighthouse-thunderstorm-2026-11-13/capture-before'),
    ),
    beforeBytes = await readFile(path.join(beforeRoot, 'manifest.json')),
    old = JSON.parse(beforeBytes).records[0],
    results = []
  if (JSON.stringify(old.worldHashes) !== JSON.stringify(record.worldHashes))
    throw Error('World changed between phases')
  async function verified(root, entry) {
    const b = await readFile(path.join(root, entry.file))
    if (hash(b) !== entry.sha256) throw Error('Comparison image changed')
    return b
  }
  const selected = record.frames.find((f) => f.label === 'first-peak'),
    prior = old.frames.find((f) => f.clockSeconds === selected.clockSeconds),
    paint = [],
    labels = []
  for (const [size, x, y, w, h] of [
    ['1440x900', 12, 70, 720, 450],
    ['390x844', 12, 568, 390, 844],
    ['320x568', 820, 568, 320, 568],
  ]) {
    for (const [root, frame, left] of [
      [beforeRoot, prior, x],
      [output, selected, x + w + (size === '1440x900' ? 16 : 10)],
    ])
      paint.push({
        input: await sharp(await verified(root, frame.views[size]))
          .resize(w, h)
          .png()
          .toBuffer(),
        left,
        top: y,
      })
    labels.push(
      `<text x="${x}" y="${y - 10}" font-size="12">${size}: old sparse storm / new thunderstorm at ${selected.clockSeconds}s</text>`,
    )
  }
  const label = svg(
    `<g fill="#e4e5dc" font-family="monospace"><text x="12" y="22" font-size="17">Lighthouse thunderstorm: matched first-peak clock</text><text x="12" y="43" font-size="11">Actual compiled CPU + weather poses; seed 2506, animals 60s seed 42. NOT browser/GPU.</text>${labels.join('')}</g>`,
    1470,
    1430,
  )
  const png = await sharp({
      create: { width: 1470, height: 1430, channels: 4, background: '#18201d' },
    })
      .composite([...paint, { input: Buffer.from(label), left: 0, top: 0 }])
      .png()
      .toBuffer(),
    file = 'lighthouse-before-after-board.png'
  await writeFile(path.join(output, file), png)
  results.push({
    file,
    sha256: hash(png),
    clockSeconds: selected.clockSeconds,
    beforeManifestSha256: hash(beforeBytes),
  })
  const tiles = [],
    texts = [],
    columns = record.frames.filter((f) => f.label !== 'old-sparse-peak').length
  for (const [row, root, room, title] of [
    [0, beforeRoot, old, 'BEFORE'],
    [1, output, record, 'AFTER'],
  ])
    for (const [i, frame] of room.frames.filter((f) => f.label !== 'old-sparse-peak').entries()) {
      tiles.push({
        input: await sharp(await verified(root, frame.views['1440x900']))
          .resize(400, 250)
          .png()
          .toBuffer(),
        left: i * 400,
        top: row * 290 + 40,
      })
      texts.push(
        `<text x="${i * 400 + 8}" y="${row * 290 + 23}" font-size="11">${title} ${frame.label} / ${frame.clockSeconds}s</text>`,
      )
    }
  const strip = await sharp({
      create: { width: columns * 400, height: 580, channels: 4, background: '#18201d' },
    })
      .composite([
        ...tiles,
        {
          input: Buffer.from(
            svg(
              `<g fill="#e4e5dc" font-family="monospace">${texts.join('')}</g>`,
              columns * 400,
              580,
            ),
          ),
          left: 0,
          top: 0,
        },
      ])
      .png()
      .toBuffer(),
    stripFile = 'lighthouse-before-after-time-strip.png'
  await writeFile(path.join(output, stripFile), strip)
  results.push({
    file: stripFile,
    sha256: hash(strip),
    beforeManifestSha256: hash(beforeBytes),
    clockSeconds: record.frames
      .filter((f) => f.label !== 'old-sparse-peak')
      .map((f) => f.clockSeconds),
  })
  const auxiliaryPaint = []
  for (const [i, root, room] of [
    [0, beforeRoot, old],
    [1, output, record],
  ]) {
    const frame = room.frames.find((f) => f.label === 'old-sparse-peak')
    auxiliaryPaint.push({
      input: await sharp(await verified(root, frame.views['1440x900']))
        .resize(640, 400)
        .png()
        .toBuffer(),
      left: i * 656,
      top: 48,
    })
  }
  const auxiliaryLabel = svg(
    '<g fill="#e4e5dc" font-family="monospace"><text x="10" y="20" font-size="14">Auxiliary timing reference: old sparse flash at 54.91s / new schedule at same clock</text><text x="10" y="39" font-size="11">Different schedules: this does not claim the new scene is brighter at every instant. CPU only.</text></g>',
    1296,
    460,
  )
  const auxiliary = await sharp({
      create: { width: 1296, height: 460, channels: 4, background: '#18201d' },
    })
      .composite([...auxiliaryPaint, { input: Buffer.from(auxiliaryLabel), left: 0, top: 0 }])
      .png()
      .toBuffer(),
    auxiliaryFile = 'lighthouse-old-sparse-peak-auxiliary.png'
  await writeFile(path.join(output, auxiliaryFile), auxiliary)
  results.push({
    file: auxiliaryFile,
    sha256: hash(auxiliary),
    beforeManifestSha256: hash(beforeBytes),
    clockSeconds: 54.91,
    role: 'Auxiliary schedule reference; excluded from primary time strip.',
  })
  return results
}

async function captureTimes() {
  const t = await import('../src/pages/focus/model/thunderstorm.ts'),
    timeline = t.createThunderstormTimeline(2506),
    [first, second] = timeline.events
  return [
    ['initial', 0],
    ['before-onset', first.start - 0.04],
    ['first-peak', first.start + first.pulses[0].attack],
    ['restrike', first.start + first.pulses[1].offset + first.pulses[1].attack],
    ['afterglow', first.start + 1.5],
    ['quiet', first.start + first.duration + 0.2],
    ['later-strike', second.start + second.pulses[0].attack],
    ['old-sparse-peak', 54.91],
  ].map(([label, time]) => ({ label, time: Number(time.toFixed(5)) }))
}
async function weatherEvent(state, time) {
  if (state.weather === 'storm') return state.weatherApi.stormWeatherState(time, state.weatherSeed)
  if (state.weather !== 'thunderstorm')
    throw Error('Bounded lighthouse weather must be storm/thunderstorm')
  return (await import('../src/pages/focus/model/thunderstorm.ts')).thunderstormWeatherState(
    time,
    state.weatherSeed,
  )
}
async function weatherGeometry(state, time, kind = 'all') {
  const event = await weatherEvent(state, time),
    profile = state.weatherApi.PIXI_WEATHER_PROFILES[state.weather],
    parts = []
  if (kind === 'all')
    for (const p of state.weatherApi.createWeatherParticles(
      state.weather,
      800,
      820,
      state.weatherSeed,
    )) {
      if (p.kind !== 'rain') throw Error('Lighthouse capture expects rain particles only')
      const pose = state.weatherApi.weatherParticlePosition(
          p,
          state.weather,
          800,
          820,
          event.travelTime,
        ),
        alpha = (p.depth > 0.72 ? 0.3 : profile.alpha) * (1 + event.gust * 0.11)
      parts.push(
        `<path d="M${pose.x} ${pose.y}l${profile.slant} ${profile.length}" fill="none" stroke="#c2d8d4" stroke-width="${profile.width}" stroke-opacity="${alpha}"/>`,
      )
    }
  if (state.weather === 'storm')
    parts.push(`<rect width="800" height="820" fill="#e4ebe5" opacity="${event.flash}"/>`)
  else {
    const t = await import('../src/pages/focus/model/thunderstorm.ts')
    parts.push(
      t.thunderstormSkyMarkup(event.skyAlpha, event.cloudAlpha, 800, 820),
      t.thunderstormBoltMarkup(event.variant, event.boltAlpha),
      t.thunderstormReflectionMarkup(event.variant, event.reflectionAlpha),
    )
  }
  return parts.join('')
}
async function weatherMarkup(state, time, kind = 'all') {
  return `<defs><mask id="weather-aperture" maskUnits="userSpaceOnUse" x="0" y="0" width="800" height="820" mask-type="alpha">${image(data(state.weatherMask), 0, 0, 800, 820)}</mask></defs><g mask="url(#weather-aperture)">${await weatherGeometry(state, time, kind)}</g>`
}

async function selfTest() {
  const { Texture } = await import('pixi.js'),
    t = await import('../src/pages/focus/model/thunderstorm.ts'),
    api = await weatherApi(),
    seed = 2506,
    weather = phase === 'before' ? 'storm' : 'thunderstorm',
    timeline = t.createThunderstormTimeline(seed)
  const particles = api.createWeatherParticles(weather, 800, 820, seed),
    native = api.createPixiWeather({
      weather,
      maskTexture: Texture.EMPTY,
      width: 800,
      height: 820,
      seed,
    }),
    drawing = native.container.children[0],
    nodes = drawing.children
  const clocks = [
    ...new Set([
      ...(await captureTimes()).map((s) => s.time),
      ...timeline.events.map((e) => e.start + e.pulses[0].attack),
    ]),
  ]
  let comparisons = 0,
    maxError = 0,
    shapeChecks = 0
  const equal = (actual, expected, label) => {
    const error = Math.abs(actual - expected)
    maxError = Math.max(maxError, error)
    if (error > 1e-9 || !Number.isFinite(error)) throw Error(`Native/CPU mismatch ${label}`)
    comparisons++
  }
  const color = (s) => parseInt(s.replace('#', ''), 16)
  const same = (actual, expected, label) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected))
      throw Error(`Native geometry mismatch ${label}`)
    shapeChecks++
  }
  try {
    for (const time of clocks) {
      native.update(time)
      const event =
        weather === 'storm'
          ? api.stormWeatherState(time, seed)
          : t.thunderstormWeatherState(time, seed, timeline)
      particles.forEach((p, i) => {
        const pose = api.weatherParticlePosition(p, weather, 800, 820, event.travelTime)
        equal(nodes[i].x, pose.x, 'rainx')
        equal(nodes[i].y, pose.y, 'rainy')
        equal(nodes[i].alpha, 1 + event.gust * 0.11, 'rainalpha')
      })
      if (weather === 'storm') equal(nodes[particles.length].alpha, event.flash, 'oldflash')
      else {
        equal(nodes.find((n) => n.label === 'thunderstorm:sky').alpha, event.skyAlpha, 'sky')
        equal(
          nodes.find((n) => n.label === 'thunderstorm:clouds').alpha,
          event.cloudAlpha,
          'clouds',
        )
        for (let i = 0; i < 4; i++) {
          equal(
            nodes.find((n) => n.label === `thunderstorm:bolt:${i}`).alpha,
            event.variant === i ? event.boltAlpha : 0,
            'bolt',
          )
          equal(
            nodes.find((n) => n.label === `thunderstorm:reflection:${i}`).alpha,
            event.variant === i ? event.reflectionAlpha : 0,
            'reflection',
          )
        }
      }
      const frozen = JSON.stringify(nodes.map((n) => [n.x, n.y, n.alpha]))
      native.update(time)
      if (JSON.stringify(nodes.map((n) => [n.x, n.y, n.alpha])) !== frozen)
        throw Error('Repeated absolute clock changed native pose')
      if (
        drawing.mask !== native.container.children[1] ||
        drawing.mask.x !== 0 ||
        drawing.mask.y !== 0 ||
        drawing.mask.width !== 800 ||
        drawing.mask.height !== 820
      )
        throw Error('Weather mask moved')
    }
    const profile = api.PIXI_WEATHER_PROFILES[weather]
    particles.forEach((p, i) => {
      const stroke = nodes[i].context.instructions[0]
      same(
        stroke.data.path.instructions.map((s) => s.data),
        [
          [0, 0],
          [profile.slant, profile.length],
        ],
        'rainline',
      )
      same(
        [stroke.data.style.color, stroke.data.style.width, stroke.data.style.alpha],
        [0xc2d8d4, profile.width, p.depth > 0.72 ? 0.3 : profile.alpha],
        'rainstyle',
      )
    })
    if (weather === 'thunderstorm') {
      const paintAlphas = (markup, tag) => {
        if (/<g\b[^>]*opacity=/.test(markup))
          throw Error('Group opacity differs from native per-paint alpha')
        return [...markup.matchAll(new RegExp('<' + tag + '\\b[^>]*>', 'g'))].map((m) => {
          const attr = m[0].match(/\sopacity="([^"]+)"/)
          if (!attr) throw Error('Every weather paint must own its effective alpha')
          return Number(attr[1])
        })
      }
      const trialAlpha = 0.37,
        skyMarkup = t.thunderstormSkyMarkup(0.23, trialAlpha)
      equal(paintAlphas(skyMarkup, 'rect')[0], 0.23, 'SVG sky per-paint alpha')
      paintAlphas(skyMarkup, 'ellipse').forEach((alpha, i) =>
        equal(
          alpha,
          nodes.find((n) => n.label === 'thunderstorm:clouds').context.instructions[i].data.style
            .alpha * trialAlpha,
          'SVG cloud per-paint alpha',
        ),
      )
      for (let i = 0; i < 4; i++) {
        const strokes = nodes.find((n) => n.label === `thunderstorm:bolt:${i}`).context.instructions
        paintAlphas(t.thunderstormBoltMarkup(i, trialAlpha), 'path').forEach((alpha, j) =>
          equal(alpha, strokes[j].data.style.alpha * trialAlpha, 'SVG bolt per-paint alpha'),
        )
        const fills = nodes.find((n) => n.label === `thunderstorm:reflection:${i}`).context
          .instructions
        paintAlphas(t.thunderstormReflectionMarkup(i, trialAlpha), 'ellipse').forEach((alpha, j) =>
          equal(alpha, fills[j].data.style.alpha * trialAlpha, 'SVG reflection per-paint alpha'),
        )
      }
      const style = t.THUNDERSTORM_STYLE,
        sky = nodes.find((n) => n.label === 'thunderstorm:sky').context.instructions[0]
      same(sky.data.path.instructions[0].data.slice(0, 4), [0, 0, 800, 820], 'skybox')
      same(sky.data.style.color, color(style.skyColor), 'skycolor')
      const clouds = nodes.find((n) => n.label === 'thunderstorm:clouds').context.instructions
      t.THUNDERSTORM_CLOUDS.forEach((c, i) => {
        same(
          clouds[i].data.path.instructions.find((p) => p.action === 'ellipse').data.slice(0, 4),
          [c.x, c.y, c.rx, c.ry],
          'cloud',
        )
        same(
          [clouds[i].data.style.color, clouds[i].data.style.alpha],
          [color(style.cloudColor), c.alpha],
          'cloudstyle',
        )
      })
      t.THUNDERSTORM_BOLTS.forEach((bolt, i) => {
        const strokes = nodes.find((n) => n.label === `thunderstorm:bolt:${i}`).context
            .instructions,
          paths = [bolt.spine, bolt.spine, ...bolt.branches],
          styles = [
            [style.haloColor, style.haloWidth, style.haloAlpha],
            [style.boltColor, style.boltWidth, 1],
            ...bolt.branches.map(() => [style.branchColor, style.branchWidth, style.branchAlpha]),
          ]
        paths.forEach((p, j) => {
          same(
            strokes[j].data.path.instructions.map((s) => s.data),
            p,
            'boltpath',
          )
          same(
            [
              strokes[j].data.style.color,
              strokes[j].data.style.width,
              strokes[j].data.style.alpha,
              strokes[j].data.style.cap,
              strokes[j].data.style.join,
            ],
            [color(styles[j][0]), styles[j][1], styles[j][2], 'round', 'round'],
            'boltstyle',
          )
          if (!t.thunderstormBoltMarkup(i).includes(`d="${t.thunderstormPath(p)}"`))
            throw Error('Shared SVG bolt path differs')
        })
        const fills = nodes.find((n) => n.label === `thunderstorm:reflection:${i}`).context
          .instructions
        t.THUNDERSTORM_REFLECTION_BANDS.forEach((b, j) => {
          same(
            fills[j].data.path.instructions.find((p) => p.action === 'ellipse').data.slice(0, 4),
            [bolt.reflectionX, b.y, b.rx, b.ry],
            'reflection',
          )
          same(
            [fills[j].data.style.color, fills[j].data.style.alpha],
            [color(style.reflectionColor), b.alpha],
            'reflectionstyle',
          )
        })
      })
    }
  } finally {
    native.destroy()
  }
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
    throw Error('Stationary clipping must follow pose')
  const samples = Array.from({ length: 2701 }, (_, i) =>
      t.thunderstormWeatherState(i * 0.01, seed, timeline),
    ),
    active = samples.filter((s) => s.boltAlpha > 0.01).length
  const result = {
    phase,
    method:
      'Actual native Pixi Graphics data/styles and seeded rain poses/envelopes versus CPU mapping/shared pure geometry; absolute-clock repeated-update determinism and stationary mask checks. No GPU/browser/continuous-playback claim.',
    weatherSeed: seed,
    rainParticles: particles.length,
    clockSamples: clocks,
    numericComparisons: comparisons,
    maxError,
    geometryAndStyleChecks: shapeChecks,
    svgPaintAlphaNativeEquivalent: phase === 'after' ? true : 'not-applicable-old-rect',
    repeatedClockDeterminism: true,
    nativeMaskStationary: true,
    postmotionFixedClip: true,
    firstNewOnset: timeline.events[0].start,
    firstOldOnset: 54,
    eventsPer27Seconds: timeline.events.length,
    pulsesPer27Seconds: timeline.events.reduce((n, e) => n + e.pulses.length, 0),
    sampledBoltAlphaAbovePoint01Fraction: active / samples.length,
    timeline,
    baselinePinsSha256: (await checkBaseline()).sha256,
  }
  await saveJson(path.join(evidenceRoot, `capture-selftest-${phase}.json`), result)
  console.log(JSON.stringify(result))
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (args.includes('--self-test')) await selfTest()
  else if (args.includes('--capture')) await capture()
  else
    console.log(
      'Use --self-test or --capture --phase before|after [--output capture-* artifact path]. No exporter is invoked.',
    )
}
