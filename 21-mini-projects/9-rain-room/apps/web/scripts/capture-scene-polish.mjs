/** Actual compiled artwork + evaluated CSS channels, captured by CPU only.
 * No browser/network, no accepted-background reuse, no autonomous click reactions.
 * This compositor is QA infrastructure, not independent proof of GPU rendering. */
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
const defaultRooms = [
  'study-library',
  'premium-last-bookstore',
  'premium-onsen-veranda',
  'study-moon',
  'forest-fireflies',
  'premium-storm-lighthouse',
  'travel-lodge',
]
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const json = async (file) => JSON.parse(await readFile(file, 'utf8'))
const saveJson = (file, value) => writeFile(file, JSON.stringify(value, null, 2) + '\n')
const inner = (svg) => svg.replace(/^\s*<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '')
const data = (bytes) => 'data:image/png;base64,' + bytes.toString('base64')
const svg = (body, width = 800, height = 820) =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`
const image = (src, x, y, width, height) =>
  `<image xlink:href="${src}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="none"/>`
const identity = () => [1, 0, 0, 1, 0, 0]
export const multiply = (l, r) => [
  l[0] * r[0] + l[2] * r[1],
  l[1] * r[0] + l[3] * r[1],
  l[0] * r[2] + l[2] * r[3],
  l[1] * r[2] + l[3] * r[3],
  l[0] * r[4] + l[2] * r[5] + l[4],
  l[1] * r[4] + l[3] * r[5] + l[5],
]
/** Exactly the local matrix of runtime's positioned/pivoted Pixi motion Container. */
export function motionMatrix(motion, value) {
  const t = cssSkewToPixi(value),
    r = value.rotation ?? 0,
    px = motion.pivotX ?? 0,
    py = motion.pivotY ?? 0
  const a = Math.cos(r + t.skewY) * t.scaleX,
    b = Math.sin(r + t.skewY) * t.scaleX
  const c = -Math.sin(r - t.skewX) * t.scaleY,
    d = Math.cos(r - t.skewX) * t.scaleY
  return [a, b, c, d, px + (value.x ?? 0) - px * a - py * c, py + (value.y ?? 0) - px * b - py * d]
}
export function evaluatedLayerMotion(layer, time) {
  const channels = (layer.motions ?? (layer.motion ? [layer.motion] : [])).map((motion) => {
    const value = evaluateMotion(motion, time)
    return { motion, value, matrix: motionMatrix(motion, value) }
  })
  return {
    channels,
    matrix: channels.reduce((matrix, channel) => multiply(matrix, channel.matrix), identity()),
    alpha: channels.reduce((a, channel) => a * (channel.value.alpha ?? 1), 1),
  }
}
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
    focusPins.map((p) => 'src/pages/focus/' + p).concat(['scripts/capture-scene-polish.mjs']),
  )
  const manifests = new Map(),
    manifestHashes = {},
    sourceMismatch = []
  const sourceCache = new Map()
  for (const room of allRooms) {
    const file = path.join(web, 'public/backgrounds/pixi', room.id, 'manifest.json'),
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
  if (sourceMismatch.length)
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
        const bytes = await readFile(path.join(web, 'public', url))
        assets.set(url, bytes)
        assetHashes[url] = hash(bytes)
      }
    }
  }
  return { manifests, manifestHashes, sourcePaths, assets, assetHashes }
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
const timeLabel = (time) => String(time).replace('.', 'p')
async function captureMotion(room, state, output, expectations = {}) {
  const channels = new Map()
  for (const item of state.prepared)
    for (const motion of item.layer.motions ?? (item.layer.motion ? [item.layer.motion] : [])) {
      if (
        !/onsen-(?:plume|wisp)|beacon-(?:sweep|lens|reflection)/.test(motion.cssName ?? motion.kind)
      )
        continue
      if (!channels.has(motion.id)) channels.set(motion.id, { motion, items: [] })
      channels.get(motion.id).items.push(item)
    }
  const results = []
  for (const { motion, items } of channels.values()) {
    const period = motion.duration * (motion.alternate ? 2 : 1)
    const values = Array.from({ length: 33 }, (_, i) => {
      const time = (period * i) / 32
      const value = evaluateMotion(motion, time)
      return { time, value, matrix: motionMatrix(motion, value) }
    })
    const ranges = Object.fromEntries(
      ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'alpha'].map((key) => {
        const n = values.map(
          (v) => v.value[key] ?? (key === 'alpha' || key.startsWith('scale') ? 1 : 0),
        )
        return [
          key,
          { min: Math.min(...n), max: Math.max(...n), span: Math.max(...n) - Math.min(...n) },
        ]
      }),
    )
    const times = [0, period * 0.2, period * 0.4, period * 0.6, period * 0.8],
      samples = []
    for (const time of times) {
      const result = await renderCore(state, time, '', new Set(items.map((i) => i.layer.id)), 72)
      const file = `motion/${room}-${motion.id}-t${timeLabel(Number(time.toFixed(5)))}.png`
      await writeFile(path.join(output, file), result.png)
      // Each logical target's layers share stationary outer aperture clipping.
      const clips = [...new Set(items.map((i) => i.layer.clipMaskHigh).filter(Boolean))]
      const statistics = await rawStats(
        result.png,
        clips.length === 1 ? state.masks.get(clips[0]).bytes : undefined,
      )
      if (statistics.outsideClipPixels > 0)
        throw Error(`Animated aperture leak ${room}/${motion.id}`)
      samples.push({ time, file, sha256: hash(result.png), statistics })
    }
    const distinctImages = new Set(samples.map((s) => s.sha256)).size
    if (distinctImages < 2 || !samples.some((s) => s.statistics.occupiedPixels > 0))
      throw Error(`Static/invisible compiled motion ${room}/${motion.cssName}`)
    const isSteam = /onsen-(?:plume|wisp)/.test(motion.cssName ?? ''),
      isLens = /beacon-lens/.test(motion.cssName ?? ''),
      isBeam = /beacon-sweep/.test(motion.cssName ?? '')
    if (isSteam && (ranges.y.span < 10 || ranges.alpha.span < 0.1))
      throw Error(`Steam must actually rise and fade ${motion.cssName}`)
    if (isLens && ranges.rotation.span < Math.PI)
      throw Error('Beacon lens must visibly rotate, not merely pulse opacity')
    if (isBeam && ranges.rotation.span < 0.15) throw Error('Beacon beam must change angle')
    if (isBeam && items.some((item) => !item.layer.clipMaskHigh))
      throw Error('Rotating beacon beam must retain its stationary compiled aperture mask')
    const expectedPivot = isLens || isBeam ? expectations.beaconPivot : undefined
    if (
      expectedPivot &&
      Math.hypot(motion.pivotX - expectedPivot.x, motion.pivotY - expectedPivot.y) > 1e-6
    )
      throw Error(
        `Compiled pivot is not emitter ${room}/${motion.cssName}: ${motion.pivotX},${motion.pivotY}; expected ${JSON.stringify(expectedPivot)}`,
      )
    results.push({
      motionId: motion.id,
      cssName: motion.cssName,
      className: motion.className,
      sourceMotionId: motion.sourceMotionId,
      pivot: { x: motion.pivotX, y: motion.pivotY },
      expectedPivot,
      layers: items.map((i) => i.layer.id),
      clipMasks: [...new Set(items.map((i) => i.layer.clipMaskHigh).filter(Boolean))],
      ranges,
      evaluated33ClockSamples: values,
      renderedSamples: samples,
      distinctImages,
    })
  }
  if (
    room === 'premium-onsen-veranda' &&
    !results.some((r) => /onsen-(?:plume|wisp)/.test(r.cssName ?? ''))
  )
    throw Error('No actual compiled onsen plume channels')
  if (
    room === 'premium-storm-lighthouse' &&
    (!results.some((r) => /beacon-lens/.test(r.cssName ?? '')) ||
      !results.some((r) => /beacon-sweep/.test(r.cssName ?? '')))
  )
    throw Error('Missing real lighthouse lens/beam channels')
  return results
}
async function comparisonBoard(record, output, before, beforeRoot) {
  const current = record.frames.find((frame) => frame.clockSeconds === 0)
  if (!current) return undefined
  const paint = [],
    labels = []
  for (const [size, x, y, width, height] of [
    ['1440x900', 12, 68, 720, 450],
    ['390x844', 12, 565, 390, 844],
    ['320x568', 820, 565, 320, 568],
  ]) {
    const prior = before.records.find((item) => item.roomId === record.id && item.size === size)
    if (!prior) throw Error(`Missing exact before evidence ${record.id}/${size}`)
    const old = await readFile(path.resolve(beforeRoot, prior.file))
    if (hash(old) !== prior.sha256) throw Error(`Before evidence changed ${record.id}/${size}`)
    const after = await readFile(path.join(output, current.views[size].file))
    const gap = size === '1440x900' ? 16 : 10
    paint.push({ input: await sharp(old).resize(width, height).png().toBuffer(), left: x, top: y })
    paint.push({
      input: await sharp(after).resize(width, height).png().toBuffer(),
      left: x + width + gap,
      top: y,
    })
    labels.push(
      `<text x="${x}" y="${y - 9}" font-size="12">${size}: preceding accepted CPU idle / current compiled CPU clock0</text>`,
    )
  }
  const text = svg(
    `<g font-family="monospace" fill="#e1e5dc"><text x="12" y="23" font-size="17">${record.id}</text><text x="12" y="44" font-size="11">Exact old files / fresh compiled layers + evaluated CSS clock0. Animals frozen60s seed42; props atrest. NOT browser/GPU.</text>${labels.join('')}</g>`,
    1470,
    1430,
  )
  const png = await sharp({
    create: { width: 1470, height: 1430, channels: 4, background: '#18201d' },
  })
    .composite([...paint, { input: Buffer.from(text), left: 0, top: 0 }])
    .png()
    .toBuffer()
  const file = `${record.id}-before-after-board.png`
  await writeFile(path.join(output, file), png)
  return {
    file,
    sha256: hash(png),
    method:
      'Exact prior CPU idle images versus current compiled clock0; desktop50%, phones100%. Before ambient phase may differ from current CSS clock0; this is visual comparison, not pixel-isolation of edits.',
  }
}
async function capture() {
  sharp.cache(false)
  sharp.concurrency(1)
  const output = path.resolve(
    workspace,
    option('--output', 'artifacts/scene-polish-2026-11-12/after'),
  )
  const rooms = option('--only', defaultRooms.join(',')).split(',')
  if (rooms.some((r) => !defaultRooms.includes(r)))
    throw Error('Capture is bounded to the seven requested rooms')
  const { ALL_BACKGROUNDS } = await import('../src/pages/focus/model/backgrounds.ts')
  const inputs = await loadCaptureInputs(rooms, ALL_BACKGROUNDS),
    start = await sourceState(inputs.sourcePaths)
  const beforePath = path.resolve(
    workspace,
    option('--before', 'artifacts/scene-polish-2026-11-12/before/manifest.json'),
  )
  const beforeBytes = await readFile(beforePath),
    before = JSON.parse(beforeBytes)
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
    throw Error('Click prop catalog changed unexpectedly')
  await mkdir(path.join(output, 'rooms'), { recursive: true })
  await mkdir(path.join(output, 'motion'), { recursive: true })
  const records = [],
    views = [
      [1440, 900],
      [390, 844],
      [320, 568],
    ]
  const pivotText = option('--beacon-pivot', '600,205'),
    [px, py] = pivotText.split(',').map(Number)
  if (![px, py].every(Number.isFinite)) throw Error('Invalid beacon pivot')
  for (const id of rooms) {
    const manifest = inputs.manifests.get(id),
      state = await prepareRoom(manifest, inputs),
      props = propsModel.getSceneInteractiveObjects(id)
    if (props.length !== 2) throw Error(`Missing resting discoveries ${id}`)
    const propSvg = inner(propsDrawing.sceneInteractiveLayerSvg(props)),
      timesArg = option('--times', ''),
      times = timesArg
        ? timesArg.split(',').map(Number)
        : id === 'premium-onsen-veranda'
          ? [0, 1.8, 3.6, 5.4, 7.2, 9, 10]
          : id === 'premium-storm-lighthouse'
            ? [0, 1.8, 3.6, 5.4, 7.2]
            : [0, 3.6]
    if (times.some((t) => !Number.isFinite(t) || t < 0)) throw Error('Invalid capture time')
    const world = { underlay: sceneWorldSvg(id, 'underlay'), joinery: sceneWorldSvg(id, 'joinery') }
    const record = {
      id,
      manifestSha256: inputs.manifestHashes[id],
      coffee: 0,
      animalTime: 60,
      animalSeed: 42,
      animalIds: state.animalIds,
      restingProps: props.map((p) => p.id),
      worldHashes: Object.fromEntries(
        Object.entries(world).map(([key, value]) => [key, hash(Buffer.from(value))]),
      ),
      frames: [],
      motionVerification: [],
    }
    for (const time of times) {
      const core = await renderCore(state, time, propSvg),
        frameRecord = {
          clockSeconds: time,
          coreSha256: hash(core.png),
          evaluatedLayerMotions: core.motions,
          views: {},
        }
      for (const [w, h] of views) {
        const f = frameSceneWorld(w, h, id)
        if (
          f.scale <= 0 ||
          f.x < -1e-6 ||
          f.y < -1e-6 ||
          f.x + f.width > w + 1e-6 ||
          f.y + f.height > h + 1e-6
        )
          throw Error(`Protected core cropped ${id}/${w}x${h}`)
        const body = `<g transform="translate(${f.x} ${f.y}) scale(${f.scale})"><g transform="translate(${bounds.x} ${bounds.y})">${inner(world.underlay)}</g>${image(data(core.png), 0, 0, 800, 820)}<g transform="translate(${bounds.x} ${bounds.y})">${inner(world.joinery)}</g></g>`
        const png = await sharp(Buffer.from(svg(body, w, h)))
            .png()
            .toBuffer(),
          file = `rooms/${id}-${w}x${h}-t${timeLabel(time)}.png`
        await writeFile(path.join(output, file), png)
        frameRecord.views[`${w}x${h}`] = { file, sha256: hash(png), framing: f }
      }
      record.frames.push(frameRecord)
      console.log(`POLISH ${id} clock${time}s`)
    }
    record.motionVerification = await captureMotion(id, state, output, {
      beaconPivot: { x: px, y: py },
    })
    record.comparisonBoard = await comparisonBoard(
      record,
      output,
      before,
      path.dirname(path.dirname(beforePath)),
    )
    records.push(record)
  }
  const end = await sourceState(inputs.sourcePaths),
    changed = Object.keys(start).filter((p) => start[p] !== end[p]),
    changedManifests = [],
    changedAssets = []
  for (const [id, expected] of Object.entries(inputs.manifestHashes))
    if (
      hash(await readFile(path.join(web, 'public/backgrounds/pixi', id, 'manifest.json'))) !==
      expected
    )
      changedManifests.push(id)
  for (const [url, expected] of Object.entries(inputs.assetHashes))
    if (hash(await readFile(path.join(web, 'public', url))) !== expected) changedAssets.push(url)
  const result = {
    request: '073007d6',
    beforeManifest: path.relative(workspace, beforePath),
    beforeManifestSha256: hash(beforeBytes),
    method:
      'Actual current 3x compiled raster layers and eligible native-vector parts, original paint order, runtime evaluateMotion/cssSkewToPixi nested matrices, stationary ordered aperture masks, current native animals frozen at60s seed42, 136-object catalog with two room props atrest, unchanged world camera. Static CPU clock samples, NOT GPU/browser screenshots or observed continuous playback. Weather precipitation excluded.',
    sourceFiles: start,
    sourceChangedDuringCapture: changed,
    manifestsChangedDuringCapture: changedManifests,
    assetsChangedDuringCapture: changedAssets,
    canonicalExportProvenanceVerifiedRooms: ALL_BACKGROUNDS.length,
    publicManifestHashes: inputs.manifestHashes,
    referencedAssetHashes: inputs.assetHashes,
    rooms: records.length,
    records,
  }
  await saveJson(path.join(output, 'manifest.json'), result)
  await saveJson(path.join(output, 'motion-verification.json'), {
    method:
      'Actual compiled CSS channels:33 numeric clock samples plus5 isolated rendered CPU samples per target, postmotion clip checks. No continuous/GPU claim.',
    sourceManifestSha256: hash(await readFile(path.join(output, 'manifest.json'))),
    records: records
      .filter((r) => r.motionVerification.length)
      .map((r) => ({ id: r.id, channels: r.motionVerification })),
  })
  if (changed.length || changedManifests.length || changedAssets.length)
    throw Error(
      `Capture freeze broken: ${JSON.stringify({ changed, changedManifests, changedAssets })}`,
    )
  console.log(
    JSON.stringify({
      output,
      rooms: records.length,
      frames: records.reduce((n, r) => n + r.frames.length, 0),
      sourcePins: Object.keys(start).length,
      assets: Object.keys(inputs.assetHashes).length,
      canonicalExportRooms: ALL_BACKGROUNDS.length,
      sourceChangedDuringCapture: changed,
    }),
  )
}
async function selfTest() {
  const { Container } = await import('pixi.js')
  const motions = [
      { kind: 'test', pivotX: 150, pivotY: 85 },
      { kind: 'test', pivotX: -20, pivotY: 40 },
    ],
    values = [
      { x: 8, y: -12, rotation: 0.4, scaleX: 0.7, scaleY: 1.2, skewX: 0.16, skewY: -0.1 },
      { x: -3, y: 5, rotation: -0.17, scaleX: 1.1, scaleY: 0.9 },
    ]
  const parent = new Container(),
    child = new Container()
  parent.addChild(child)
  for (let i = 0; i < 2; i++) {
    const node = i ? child : parent,
      m = motions[i],
      v = values[i],
      t = cssSkewToPixi(v)
    node.pivot.set(m.pivotX, m.pivotY)
    node.position.set(m.pivotX + v.x, m.pivotY + v.y)
    node.rotation = v.rotation
    node.scale.set(t.scaleX, t.scaleY)
    node.skew.set(t.skewX, t.skewY)
    node.updateLocalTransform()
    const expected = motionMatrix(m, v)
    for (const [j, key] of ['a', 'b', 'c', 'd', 'tx', 'ty'].entries())
      if (Math.abs(node.localTransform[key] - expected[j]) > 1e-9)
        throw Error(`Pixi matrix mismatch ${key}`)
  }
  const combined = multiply(
      motionMatrix(motions[0], values[0]),
      motionMatrix(motions[1], values[1]),
    ),
    native = parent.localTransform.clone().append(child.localTransform)
  for (const [j, key] of ['a', 'b', 'c', 'd', 'tx', 'ty'].entries())
    if (Math.abs(native[key] - combined[j]) > 1e-9)
      throw Error(`Nested wrapper order mismatch ${key}`)
  parent.destroy({ children: true })
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
    throw Error('Stationary clipping must follow motion')
  console.log(
    'SELFTEST PASS: actual Pixi local+two-wrapper matrices and CPU postmotion fixed clipping',
  )
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (args.includes('--self-test')) await selfTest()
  else if (args.includes('--capture')) await capture()
  else
    console.log(
      'Use --self-test or --capture [--output workspace/path] [--only comma-separated7rooms] [--times seconds,...] [--beacon-pivot x,y]. Full canonical export must be current before capture.',
    )
}
