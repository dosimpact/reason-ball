/** Bounded two-room CPU QA derivative of capture-scene-polish.mjs.
 * Exact compiled art + runtime weather poses; no browser/GPU/continuous-playback claim.
 * Baseline snapshots are read-only; current capture requires canonical export freeze. */
import sharp from 'sharp'
import {
  sakuraPetalPose,
  sakuraPetalMarkup,
  SAKURA_PETAL_CURVES,
  SAKURA_PETAL_PATH,
} from '../src/pages/focus/model/sakuraPetals.ts'
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
const defaultRooms = ['premium-sakura-teahouse', 'premium-moon-alchemy']
const evidenceRoot = path.join(workspace, 'artifacts/sakura-moon-2026-11-13')
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
        'scripts/capture-sakura-moon.mjs',
        'src/pages/focus/lib/pixiWeather.ts',
        'src/pages/focus/model/sceneWeather.ts',
        'src/pages/focus/ui/SceneWeatherDrawing.tsx',
        'src/pages/focus/ui/weather.css',
        'src/pages/focus/model/sakuraPetals.ts',
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
      ? 'rain'
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
let weatherModule
async function weatherApi() {
  if (!weatherModule) {
    if (phase === 'after') weatherModule = import('../src/pages/focus/lib/pixiWeather.ts')
    else {
      // Execute the exact archived implementation, stripping TS types only. The
      // only runtime import is resolved from this package so no archive is edited.
      const { stripTypeScriptTypes } = await import('node:module')
      const source = await readFile(
        path.join(evidenceRoot, 'source-before/apps/web/src/pages/focus/lib/pixiWeather.ts'),
        'utf8',
      )
      const compiled = stripTypeScriptTypes(source).replaceAll(
        "from 'pixi.js'",
        `from '${import.meta.resolve('pixi.js')}'`,
      )
      weatherModule = import(
        'data:text/javascript;base64,' + Buffer.from(compiled).toString('base64')
      )
    }
  }
  return weatherModule
}
function weatherParticles(state, time) {
  const api = state.weatherApi
  return api.createWeatherParticles(state.weather, 800, 820, state.weatherSeed).map((p) => ({
    particle: p,
    pose: p.petal
      ? sakuraPetalPose(p.petal, 800, 820, time)
      : api.weatherParticlePosition(p, state.weather, 800, 820, time),
  }))
}
function weatherGeometry(state, time, kind) {
  const profile = state.weatherApi.PIXI_WEATHER_PROFILES[state.weather]
  return weatherParticles(state, time)
    .filter(({ particle: p }) => !kind || p.kind === kind)
    .map(({ particle: p, pose }) => {
      if (p.kind === 'rain')
        return `<path d="M${pose.x} ${pose.y}l${profile.slant} ${profile.length}" fill="none" stroke="#c2d8d4" stroke-width="${profile.width}" stroke-opacity="${profile.alpha}"/>`
      if (p.kind === 'petal' && p.petal) return sakuraPetalMarkup(p.petal, pose)
      if (p.kind === 'snow') throw Error('This bounded capture does not support snow')
      throw Error(`Petal paint adapter not yet implemented: ${p.kind}`)
    })
    .join('')
}
async function weatherMarkup(state, time, kind) {
  return `<defs><mask id="weather-aperture" maskUnits="userSpaceOnUse" x="0" y="0" width="800" height="820" mask-type="alpha">${image(data(state.weatherMask), 0, 0, 800, 820)}</mask></defs><g mask="url(#weather-aperture)">${weatherGeometry(state, time, kind)}</g>`
}
async function checkBaseline() {
  const bytes = await readFile(path.join(evidenceRoot, 'capture-baseline-pins.json'))
  const pins = JSON.parse(bytes)
  for (const [file, expected] of Object.entries(pins.files))
    if (hash(await readFile(path.join(evidenceRoot, file))) !== expected)
      throw Error(`Archived baseline mutated: ${file}`)
  return { sha256: hash(bytes), files: pins.files }
}
const timeLabel = (time) => String(time).replace('.', 'p')
async function capture() {
  sharp.cache(false)
  sharp.concurrency(1)
  const baseline = await checkBaseline()
  const output = path.resolve(
    workspace,
    option('--output', `artifacts/sakura-moon-2026-11-13/capture-${phase}`),
  )
  if (!path.relative(evidenceRoot, output).startsWith('capture-'))
    throw Error('Output must be a capture-* artifact directory')
  try {
    await readFile(path.join(output, 'manifest.json'))
    throw Error('Refusing to overwrite completed capture')
  } catch (e) {
    if (e.code !== 'ENOENT') throw e
  }
  const { ALL_BACKGROUNDS } = await import('../src/pages/focus/model/backgrounds.ts')
  const rooms = option('--only', defaultRooms.join(',')).split(',')
  if (rooms.some((id) => !defaultRooms.includes(id)))
    throw Error('Only the two requested rooms are permitted')
  const inputs = await loadCaptureInputs(rooms, ALL_BACKGROUNDS),
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
  if (propsModel.SCENE_INTERACTIVE_OBJECTS.length !== 136)
    throw Error('Unexpected click prop count')
  for (const dir of ['rooms', 'weather', 'details'])
    await mkdir(path.join(output, dir), { recursive: true })
  const records = []
  for (const id of rooms) {
    const manifest = inputs.manifests.get(id),
      state = await prepareRoom(manifest, inputs),
      props = propsModel.getSceneInteractiveObjects(id)
    if (props.length !== 2) throw Error('Unexpected room prop count')
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
    const times = id === 'premium-sakura-teahouse' ? [0, 1.8, 3.6, 5.4, 7.2] : [0, 3.6]
    for (const time of times) {
      const core = await renderCore(state, time, propSvg),
        frame = {
          clockSeconds: time,
          coreSha256: hash(core.png),
          evaluatedLayerMotions: core.motions,
          weatherPoses: weatherParticles(state, time),
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
      if (id === 'premium-moon-alchemy') {
        const png = await sharp(core.png)
            .extract({ left: 350 * 3, top: 55 * 3, width: 300 * 3, height: 300 * 3 })
            .png()
            .toBuffer(),
          file = `details/${id}-moon-3x-t${timeLabel(time)}.png`
        await writeFile(path.join(output, file), png)
        frame.moonCloseup = {
          file,
          sha256: hash(png),
          worldBox: { x: 350, y: 55, width: 300, height: 300 },
        }
      }
      const weather = await sharp(Buffer.from(svg(await weatherMarkup(state, time))))
          .png()
          .toBuffer(),
        file = `weather/${id}-masked-t${timeLabel(time)}.png`
      await writeFile(path.join(output, file), weather)
      const stats = await rawStats(weather, state.weatherMask)
      if (stats.outsideClipPixels) throw Error('Precipitation outside stationary aperture')
      frame.isolatedWeather = { file, sha256: hash(weather), statistics: stats }
      if (state.weather === 'sakura-rain') {
        const petals = await sharp(Buffer.from(svg(await weatherMarkup(state, time, 'petal'))))
            .png()
            .toBuffer(),
          petalFile = `weather/${id}-petals-only-t${timeLabel(time)}.png`
        await writeFile(path.join(output, petalFile), petals)
        const petalStats = await rawStats(petals, state.weatherMask)
        if (petalStats.outsideClipPixels) throw Error('Petal aperture leak')
        frame.isolatedPetals = { file: petalFile, sha256: hash(petals), statistics: petalStats }
      }
      if (phase === 'before' && id === 'premium-sakura-teahouse') {
        const ids = new Set(
          state.prepared
            .filter((i) => (i.layer.motions ?? []).some((m) => /petal/.test(m.cssName ?? m.kind)))
            .map((i) => i.layer.id),
        )
        if (!ids.size) throw Error('Missing archived compiled petal layer')
        const isolated = await renderCore(state, time, '', ids, 72),
          petalFile = `weather/${id}-old-compiled-petals-t${timeLabel(time)}.png`
        await writeFile(path.join(output, petalFile), isolated.png)
        frame.isolatedCompiledPetals = {
          file: petalFile,
          sha256: hash(isolated.png),
          layerIds: [...ids],
          motions: isolated.motions,
        }
      }
      record.frames.push(frame)
      console.log(`CAPTURE ${phase} ${id} ${time}s`)
    }
    records.push(record)
  }
  const comparisons = phase === 'after' ? await comparisonBoards(output, records) : []
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
    request: '9445483d',
    phase,
    method:
      'Compiled 3x layers/native vectors in original paint order; evaluated runtime CSS matrices with postmotion stationary masks; exact runtime seeded weather poses mapped to CPU SVG; native current animals frozen60s seed42; props atrest; shared world camera. CPU clock samples, not browser/GPU/continuous playback.',
    limitations: [
      'Native Pixi Graphics weather is represented by equivalent SVG primitives and exact runtime poses; CPU antialiasing may differ from GPU.',
      'Baseline executes archived weather source and saved compiled art; live unchanged animal/prop/world models are used for both phases.',
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
    records,
  }
  await saveJson(path.join(output, 'manifest.json'), result)
  if (sourceChanged.length || manifestChanged.length || assetChanged.length)
    throw Error('Capture freeze broken')
  console.log(
    JSON.stringify({
      phase,
      output,
      rooms: records.length,
      sourcePins: Object.keys(start).length,
      assets: Object.keys(inputs.assetHashes).length,
    }),
  )
}

async function selfTest() {
  const { Container, Texture } = await import('pixi.js')
  const api = await weatherApi(),
    seed = [...'premium-sakura-teahouse'].reduce((n, c) => n + c.charCodeAt(0), 0)
  const weather = phase === 'before' ? 'rain' : 'sakura-rain',
    particles = api.createWeatherParticles(weather, 800, 820, seed)
  const native = api.createPixiWeather({
    weather,
    maskTexture: Texture.EMPTY,
    width: 800,
    height: 820,
    seed,
  })
  const nodes = native.container.children[0].children,
    times = [0, 1.8, 3.6, 5.4, 7.2]
  let checked = 0,
    maxError = 0,
    petals = 0,
    geometryChecked = 0
  try {
    for (const time of times) {
      native.update(time)
      particles.forEach((p, i) => {
        const pose = p.petal
          ? sakuraPetalPose(p.petal, 800, 820, time)
          : api.weatherParticlePosition(p, weather, 800, 820, time)
        const node = nodes[i],
          expected = {
            x: pose.x,
            y: pose.y,
            rotation: pose.rotation ?? 0,
            scaleX: pose.scaleX ?? 1,
            scaleY: pose.scaleY ?? 1,
            alpha: pose.alpha ?? 1,
          }
        const actual = {
          x: node.x,
          y: node.y,
          rotation: node.rotation,
          scaleX: node.scale.x,
          scaleY: node.scale.y,
          alpha: node.alpha,
        }
        for (const key of Object.keys(expected)) {
          const e = Math.abs(actual[key] - expected[key])
          maxError = Math.max(maxError, e)
          if (e > 1e-9) throw Error(`Native weather pose mismatch ${i}/${key}`)
          checked++
        }
        node.updateLocalTransform()
        const expectedMatrix = motionMatrix(
          { pivotX: 0, pivotY: 0 },
          { ...expected, scaleX: expected.scaleX, scaleY: expected.scaleY },
        )
        for (const [j, key] of ['a', 'b', 'c', 'd', 'tx', 'ty'].entries())
          if (Math.abs(node.localTransform[key] - expectedMatrix[j]) > 1e-9)
            throw Error(`Native particle matrix mismatch ${i}/${key}`)
        if (p.kind === 'petal') {
          petals++
          const [fill, vein] = node.context.instructions
          const curves = fill.data.path.instructions
            .filter((i) => i.action === 'bezierCurveTo')
            .map((i) => i.data.slice(0, 6))
          if (
            JSON.stringify(curves) !== JSON.stringify(SAKURA_PETAL_CURVES) ||
            fill.data.style.color !== parseInt(p.petal.color.slice(1), 16)
          )
            throw Error('Native petal fill/curves differ from shared SVG')
          const veinPath = vein.data.path.instructions
          if (
            vein.action !== 'stroke' ||
            JSON.stringify(veinPath.map((i) => i.data)) !==
              JSON.stringify([
                [0, 4.5],
                [0.2, -2.5],
              ]) ||
            vein.data.style.width !== 0.45 ||
            vein.data.style.alpha !== 0.28 ||
            vein.data.style.color !== 0xb77791
          )
            throw Error('Native petal vein differs from shared SVG')
          const markup = sakuraPetalMarkup(p.petal, pose)
          if (
            !markup.includes(`d="${SAKURA_PETAL_PATH}"`) ||
            !markup.includes(`fill="${p.petal.color}"`) ||
            !markup.includes('d="M0 4.5 .2-2.5"') ||
            !markup.includes('stroke-width=".45" opacity=".28"')
          )
            throw Error('Shared SVG geometry changed')
          geometryChecked++
        }
      })
    }
  } finally {
    native.destroy()
  }
  if (particles.filter((p) => p.kind === 'rain').length !== 330)
    throw Error('Baseline rain density changed')
  if (phase === 'after' && particles.filter((p) => p.kind === 'petal').length !== 36)
    throw Error('Petal count changed')
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
    throw Error('Stationary mask must follow pose transforms')
  const parent = new Container(),
    child = new Container()
  parent.addChild(child)
  parent.destroy({ children: true })
  const result = {
    phase,
    method:
      'Actual native Pixi Graphics nodes updated at5 clock samples and compared to shared pose functions and local transform matrices; CPU stationary postmotion clipping fixture. No GPU.',
    particles: particles.length,
    rain: 330,
    petalCount: petals / times.length,
    clockSamples: times,
    numericPoseComparisons: checked,
    nativeGeometryAndVeinComparisons: geometryChecked,
    maxError,
    postmotionFixedClip: true,
    baselinePinsSha256: (await checkBaseline()).sha256,
  }
  const output = path.join(evidenceRoot, `capture-selftest-${phase}.json`)
  await saveJson(output, result)
  console.log(JSON.stringify(result))
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (args.includes('--self-test')) await selfTest()
  else if (args.includes('--capture')) await capture()
  else
    console.log(
      'Use --self-test or --capture --phase before|after [--output artifact/capture-*] [--only premium-sakura-teahouse,premium-moon-alchemy]. No exporter is invoked.',
    )
}

async function comparisonBoards(output, records) {
  const beforeRoot = path.resolve(
    workspace,
    option('--before-output', 'artifacts/sakura-moon-2026-11-13/capture-before'),
  )
  const beforeBytes = await readFile(path.join(beforeRoot, 'manifest.json')),
    before = JSON.parse(beforeBytes),
    results = []
  async function verified(root, entry) {
    const bytes = await readFile(path.join(root, entry.file))
    if (hash(bytes) !== entry.sha256) throw Error('Comparison image hash changed')
    return bytes
  }
  for (const record of records) {
    const old = before.records.find((r) => r.id === record.id)
    if (!old) throw Error('Missing baseline comparison room')
    if (JSON.stringify(old.worldHashes) !== JSON.stringify(record.worldHashes))
      throw Error('Before/after shared world changed')
    const paints = [],
      labels = []
    for (const [size, x, y, w, h] of [
      ['1440x900', 12, 70, 720, 450],
      ['390x844', 12, 568, 390, 844],
      ['320x568', 820, 568, 320, 568],
    ]) {
      const left = await verified(
          beforeRoot,
          old.frames.find((f) => f.clockSeconds === 0).views[size],
        ),
        right = await verified(output, record.frames.find((f) => f.clockSeconds === 0).views[size]),
        gap = size === '1440x900' ? 16 : 10
      paints.push(
        { input: await sharp(left).resize(w, h).png().toBuffer(), left: x, top: y },
        { input: await sharp(right).resize(w, h).png().toBuffer(), left: x + w + gap, top: y },
      )
      labels.push(
        `<text x="${x}" y="${y - 10}" font-size="12">${size}: BEFORE / AFTER, exact same clock0 and seeds</text>`,
      )
    }
    const label = svg(
      `<g fill="#e4e5dc" font-family="monospace"><text x="12" y="22" font-size="17">${record.id}</text><text x="12" y="43" font-size="11">Actual compiled CPU artwork + exact weather poses. Animals60s seed42, weather room seed. NOT browser/GPU.</text>${labels.join('')}</g>`,
      1470,
      1430,
    )
    const png = await sharp({
        create: { width: 1470, height: 1430, channels: 4, background: '#18201d' },
      })
        .composite([...paints, { input: Buffer.from(label), left: 0, top: 0 }])
        .png()
        .toBuffer(),
      file = `${record.id}-before-after-board.png`
    await writeFile(path.join(output, file), png)
    results.push({
      roomId: record.id,
      file,
      sha256: hash(png),
      beforeManifestSha256: hash(beforeBytes),
      clockSeconds: 0,
    })
    if (record.id === 'premium-sakura-teahouse') {
      const tiles = [],
        texts = []
      let row = 0
      for (const [root, room, title] of [
        [beforeRoot, old, 'BEFORE: saved compiled petals + rain330'],
        [output, record, 'AFTER: live petals + rain330'],
      ]) {
        for (const [i, frame] of room.frames.entries()) {
          tiles.push({
            input: await sharp(await verified(root, frame.views['1440x900']))
              .resize(480, 300)
              .png()
              .toBuffer(),
            left: i * 480,
            top: row * 340 + 40,
          })
          texts.push(
            `<text x="${i * 480 + 10}" y="${row * 340 + 24}" font-size="13">${title}; ${frame.clockSeconds}s</text>`,
          )
        }
        row++
      }
      const png = await sharp({
          create: { width: 2400, height: 680, channels: 4, background: '#18201d' },
        })
          .composite([
            ...tiles,
            {
              input: Buffer.from(
                svg(`<g font-family="monospace" fill="#e4e5dc">${texts.join('')}</g>`, 2400, 680),
              ),
              left: 0,
              top: 0,
            },
          ])
          .png()
          .toBuffer(),
        file = 'premium-sakura-teahouse-before-after-time-strip.png'
      await writeFile(path.join(output, file), png)
      results.push({
        roomId: record.id,
        file,
        sha256: hash(png),
        beforeManifestSha256: hash(beforeBytes),
        clockSeconds: record.frames.map((f) => f.clockSeconds),
        method:
          'Phase-equivalent actual CPU frames, before top row / after bottom row; PC at one-third size.',
      })
    }
  }
  return results
}
