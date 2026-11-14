/** Frozen QA: compiled layers + current native vectors/actors/objects, CPU only.
 * Weather precipitation excluded. Does not claim browser/GPU/input execution. */
import sharp from 'sharp'
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  coffeeLayerVisible,
  isNativeVectorEligible,
  nativeVectorParts,
  validatePixiManifest,
} from '../src/pages/focus/model/pixiScene.ts'
import { evaluatedLayerMotion } from './capture-scene-polish.mjs'
const web = fileURLToPath(new URL('../', import.meta.url)),
  workspace = fileURLToPath(new URL('../../../', import.meta.url))
const output = path.join(workspace, 'artifacts/object-collection-ffdea60a/capture')
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const inner = (s) => s.replace(/^\s*<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '')
const data = (b) => 'data:image/png;base64,' + b.toString('base64')
const svg = (body, w = 800, h = 820) =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`
const image = (src, x, y, w, h) =>
  `<image xlink:href="${src}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none"/>`
const matrixText = (m) => `matrix(${m.map((n) => Number(n.toFixed(10))).join(' ')})`
const saveJson = (file, value) => writeFile(file, JSON.stringify(value, null, 2) + '\n')
async function walk(dir) {
  const entries = await readdir(path.join(web, dir), { withFileTypes: true })
  return (
    await Promise.all(
      entries.map((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : path.join(dir, e.name))),
    )
  ).flat()
}
const focusPins = (await walk('src/pages/focus')).map((p) => p.replace('src/pages/focus/', ''))
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
      .concat(['scripts/capture-scene-polish.mjs', 'scripts/capture-object-collection.mjs']),
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
async function contactSheet(records, view, mode, cols = 6) {
  const size = view === '1440x900' ? [360, 225] : view === '390x844' ? [156, 338] : [160, 284],
    tiles = []
  for (let i = 0; i < records.length; i++) {
    const r = records[i],
      f = r.frames.find((f) => f.mode === mode)
    if (!f) continue
    const img = await sharp(path.join(output, f.views[view].file))
      .resize(...size)
      .png()
      .toBuffer()
    const row = Math.floor(i / cols),
      col = i % cols
    tiles.push({ input: img, left: col * size[0], top: row * (size[1] + 24) })
    const caption = await sharp(
      Buffer.from(
        svg(
          `<rect width="${size[0]}" height="24" fill="#18231e"/><text x="4" y="15" fill="#e2decb" font-family="sans-serif" font-size="9">${r.id}</text>`,
          size[0],
          24,
        ),
      ),
    )
      .png()
      .toBuffer()
    tiles.push({ input: caption, left: col * size[0], top: row * (size[1] + 24) + size[1] })
  }
  await sharp({
    create: {
      width: cols * size[0],
      height: Math.ceil(records.length / cols) * (size[1] + 24),
      channels: 4,
      background: '#18231e',
    },
  })
    .composite(tiles)
    .png()
    .toFile(path.join(output, `sheet-${mode}-${view}-${records.length}.png`))
}
async function main() {
  sharp.cache(false)
  sharp.concurrency(1)
  const [
    { ALL_BACKGROUNDS: rooms },
    propsModel,
    drawing,
    { frameSceneWorld },
    { sceneWorldSvg },
    { SCENE_WORLD_BOUNDS: bounds },
    { projectSceneObjectTarget },
  ] = await Promise.all([
    import('../src/pages/focus/model/backgrounds.ts'),
    import('../src/pages/focus/model/sceneInteractiveObjects.ts'),
    import('../src/pages/focus/lib/sceneInteractiveDrawing.ts'),
    import('../src/pages/focus/model/sceneWorldCamera.ts'),
    import('../src/pages/focus/lib/sceneWorldArt.ts'),
    import('../src/pages/focus/model/sceneWorldCatalog.ts'),
    import('../src/pages/focus/lib/pixiSceneInteractions.ts'),
  ])
  if (propsModel.SCENE_INTERACTIVE_OBJECTS.filter((o) => o.size !== 'large').length !== 136)
    throw Error('Original136 catalog changed')
  for (const r of rooms) {
    const n = propsModel.getSceneInteractiveObjects(r.id).filter((o) => o.size === 'large').length
    if (n < 1 || n > 3) throw Error(`Await integrated large catalog ${r.id}: ${n}`)
  }
  const inputs = await loadCaptureInputs(
      rooms.map((r) => r.id),
      rooms,
    ),
    start = await sourceState(inputs.sourcePaths)
  await mkdir(path.join(output, 'rooms'), { recursive: true })
  await mkdir(path.join(output, 'galleries'), { recursive: true })
  await saveJson(path.join(output, 'freeze-before.json'), {
    sources: start,
    manifests: inputs.manifestHashes,
    textures: inputs.assetHashes,
  })
  const records = [],
    views = [
      [1440, 900],
      [390, 844],
      [320, 568],
    ],
    curated = new Set([
      'cafe-rain',
      'cafe-greenhouse',
      'study-library',
      'travel-train',
      'premium-last-bookstore',
      'premium-onsen-veranda',
      'premium-storm-lighthouse',
      'premium-observatory',
      'premium-autumn-lake',
      'premium-midnight-jazz',
    ])
  for (const room of rooms) {
    const state = await prepareRoom(inputs.manifests.get(room.id), inputs),
      props = propsModel.getSceneInteractiveObjects(room.id),
      world = {
        underlay: sceneWorldSvg(room.id, 'underlay'),
        joinery: sceneWorldSvg(room.id, 'joinery'),
      }
    const record = {
      id: room.id,
      objectIds: props.map((p) => p.id),
      animalIds: state.animalIds,
      frames: [],
    }
    for (const mode of curated.has(room.id) ? ['rest', 'active'] : ['rest']) {
      const active = mode === 'active' ? props.find((p) => p.size === 'large') : null,
        p = 0.37
      const frames = active
        ? new Map([
            [
              active.id,
              {
                id: active.id,
                type: active.reaction.type,
                progress: p,
                intensity: Math.sin(Math.PI * p) * (active.reaction.strength ?? 1),
                elapsedMs: active.reaction.durationMs * p,
                durationMs: active.reaction.durationMs,
                trigger: 1,
                reducedMotion: false,
              },
            ],
          ])
        : new Map()
      const core = await renderCore(
          state,
          60,
          inner(drawing.sceneInteractiveLayerSvg(props, frames)),
          undefined,
          144,
        ),
        recordFrame = {
          mode,
          activeId: active?.id,
          progress: active ? p : undefined,
          clockSeconds: 60,
          coreSha256: hash(core.png),
          evaluatedLayerMotions: core.motions,
          views: {},
        }
      for (const [w, h] of views) {
        const f = frameSceneWorld(w, h, room.id),
          body = `<g transform="translate(${f.x} ${f.y}) scale(${f.scale})"><g transform="translate(${bounds.x} ${bounds.y})">${inner(world.underlay)}</g>${image(data(core.png), 0, 0, 800, 820)}<g transform="translate(${bounds.x} ${bounds.y})">${inner(world.joinery)}</g></g>`,
          png = await sharp(Buffer.from(svg(body, w, h)))
            .png()
            .toBuffer(),
          file = `rooms/${room.id}-${w}x${h}-${mode}.png`
        await writeFile(path.join(output, file), png)
        const targets = props.map((o) => projectSceneObjectTarget(o, f)).filter(Boolean),
          overlaps = []
        for (let a = 0; a < targets.length; a++)
          for (let b = a + 1; b < targets.length; b++) {
            const A = targets[a],
              B = targets[b],
              ix = Math.min(A.left + A.width, B.left + B.width) - Math.max(A.left, B.left),
              iy = Math.min(A.top + A.height, B.top + B.height) - Math.max(A.top, B.top)
            if (ix > 0 && iy > 0) overlaps.push({ a: A.id, b: B.id, width: ix, height: iy })
          }
        recordFrame.views[`${w}x${h}`] = { file, sha256: hash(png), framing: f, targets, overlaps }
      }
      record.frames.push(recordFrame)
    }
    records.push(record)
    console.log(`OBJECTS ${records.length}/${rooms.length} ${room.id}`)
  }
  for (const view of ['1440x900', '390x844', '320x568']) {
    await contactSheet(records, view, 'rest')
    await contactSheet(
      records.filter((r) => r.id.startsWith('premium-')),
      view,
      'rest',
    )
    await contactSheet(
      records.filter((r) => r.frames.length > 1),
      view,
      'active',
    )
  }
  const large = propsModel.SCENE_INTERACTIVE_OBJECTS.filter((o) => o.size === 'large')
  for (const galleryMode of ['rest', 'active']) {
    const tiles = []
    for (let i = 0; i < large.length; i++) {
      const o = large[i],
        png = await sharp(
          Buffer.from(
            svg(
              `<rect width="220" height="230" fill="#26382f"/><g transform="translate(14 8) scale(2)">${inner(drawing.sceneInteractiveObjectSvg(o, galleryMode === 'active' ? { id: o.id, type: o.reaction.type, progress: 0.37, intensity: Math.sin(Math.PI * 0.37) * (o.reaction.strength ?? 1), elapsedMs: o.reaction.durationMs * 0.37, durationMs: o.reaction.durationMs, trigger: 1, reducedMotion: false } : undefined))}</g><text x="4" y="218" fill="#e1dcc6" font-family="sans-serif" font-size="7">${o.id}</text>`,
              220,
              230,
            ),
          ),
        )
          .png()
          .toBuffer()
      tiles.push({ input: png, left: (i % 8) * 220, top: Math.floor(i / 8) * 230 })
    }
    await sharp({
      create: {
        width: 1760,
        height: Math.ceil(large.length / 8) * 230,
        channels: 4,
        background: '#26382f',
      },
    })
      .composite(tiles)
      .png()
      .toFile(path.join(output, `galleries/all-large-${galleryMode}.png`))
  }
  const end = await sourceState(inputs.sourcePaths),
    changedSources = Object.keys(start).filter((p) => start[p] !== end[p]),
    endManifests = {},
    endTextures = {}
  for (const id of Object.keys(inputs.manifestHashes))
    endManifests[id] = hash(
      await readFile(path.join(web, 'public/backgrounds/pixi', id, 'manifest.json')),
    )
  for (const url of Object.keys(inputs.assetHashes))
    endTextures[url] = hash(await readFile(path.join(web, 'public', url)))
  const changedManifests = Object.keys(endManifests).filter(
      (id) => endManifests[id] !== inputs.manifestHashes[id],
    ),
    changedTextures = Object.keys(endTextures).filter(
      (url) => endTextures[url] !== inputs.assetHashes[url],
    )
  await saveJson(path.join(output, 'freeze-after.json'), {
    sources: end,
    manifests: endManifests,
    textures: endTextures,
  })
  await saveJson(path.join(output, 'manifest.json'), {
    method:
      'CPU/software static QA. Actual current compiled3x raster layers and eligible native vector parts in original paint order; evaluated motion matrices at60s, current native live animals at60s seed42, current complete combined object overlay, existing world art/camera. Weather precipitation excluded. Not browser/GPU screenshots or input execution.',
    objectCount: propsModel.SCENE_INTERACTIVE_OBJECTS.length,
    largeCount: large.length,
    animalTime: 60,
    animalSeed: 42,
    coffee: 0,
    changedSources,
    changedManifests,
    changedTextures,
    records,
  })
  if (changedSources.length || changedManifests.length || changedTextures.length)
    throw Error('Capture freeze broken; inspect manifest')
  console.log(`Complete: ${records.length} rooms,${large.length} large props; freeze intact`)
}
await main()
