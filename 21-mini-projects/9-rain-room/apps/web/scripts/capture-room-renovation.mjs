/** Actual compiled-core / shared-live-rig CPU architectural evidence. No browser/GPU. */
import sharp from 'sharp'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { ALL_BACKGROUNDS } from '../src/pages/focus/model/backgrounds.ts'
const root = fileURLToPath(new URL('../', import.meta.url))
const workspace = fileURLToPath(new URL('../../../', import.meta.url))
const args = process.argv.slice(2)
const oi = args.indexOf('--output')
const output = path.resolve(
  workspace,
  oi < 0 ? 'artifacts/room-renovation-2026-11-12' : args[oi + 1],
)
const hash = (b) => createHash('sha256').update(b).digest('hex')
sharp.cache(false)
sharp.concurrency(1)
const blank = () =>
  sharp({
    create: { width: 2400, height: 2460, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
const inner = (s) => s.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
async function core(id, live = false) {
  const bytes = await readFile(path.join(root, 'public/backgrounds/pixi', id, 'manifest.json'))
  const manifest = JSON.parse(bytes)
  if (!manifest.animalLifeVersion || manifest.width !== 800 || manifest.height !== 820)
    throw Error(`Invalid current core: ${id}`)
  const layers = manifest.layers.filter(
    (l) =>
      l.kind !== 'weather' &&
      !l.restHidden &&
      (l.ifCoffeeMin ?? 0) <= 0 &&
      (l.ifCoffeeMax ?? Infinity) >= 0,
  )
  let plan, states, rig, resource
  if (live) {
    const { getAnimalHabitat } = await import('../src/pages/focus/model/animalHabitats.ts')
    const { AnimalLifeSimulation } = await import('../src/pages/focus/model/animalLife.ts')
    const drawing = await import('../src/pages/focus/lib/animalDrawing.ts')
    rig = drawing.animalPoseSvg
    resource = drawing.animalResourceSvg
    plan = getAnimalHabitat(id)
    const simulation = new AnimalLifeSimulation(plan, 42)
    try {
      for (let tick = 0; tick < 600; tick++) simulation.step(0.1)
      states = new Map(simulation.snapshot().map((s) => [s.id, s]))
    } finally {
      simulation.dispose()
    }
    const ids = layers.filter((l) => l.kind === 'animal').map((l) => l.animalId)
    if (
      ids.length !== plan.actors.length ||
      new Set(ids).size !== ids.length ||
      plan.actors.some((a) => !ids.includes(a.id))
    )
      throw Error(`Actor slots mismatch ${id}`)
  }
  const paint = [],
    assets = {},
    masks = new Map(),
    owner = new Map()
  for (const actor of plan?.actors ?? [])
    if (!owner.has(actor.zoneId)) owner.set(actor.zoneId, actor.id)
  const asset = async (url) => {
    const b = await readFile(path.join(root, 'public', url))
    assets[url] = hash(b)
    return b
  }
  for (const layer of layers) {
    let input,
      left = 0,
      top = 0
    if (layer.kind === 'animal') {
      if (!live) continue
      const actor = plan.actors.find((a) => a.id === layer.animalId),
        state = states.get(actor.id),
        zone = plan.zones.find((z) => z.id === state.zoneId)
      let stations = ''
      if (owner.get(zone.id) === actor.id)
        stations = plan.resources
          .filter((r) => r.zoneId === zone.id && r.kind !== 'rest')
          .map((r) => {
            const consumer = plan.actors.find((a) => a.id === r.consumerId)
            return inner(
              resource({ ...r, scale: consumer?.scale, species: consumer?.species }, zone),
            )
          })
          .join('')
      input = await sharp(
        Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="820" viewBox="0 0 800 820">${stations}${inner(rig({ ...actor, tetherAnchor: zone.anchor }, { ...state, domain: zone.domain }))}</svg>`,
        ),
        { density: 216 },
      )
        .png()
        .toBuffer()
    } else {
      if (!layer.srcHigh) throw Error(`Missing high layer ${id}/${layer.id}`)
      input = await asset(layer.srcHigh)
      left = Math.round(layer.x * 3)
      top = Math.round(layer.y * 3)
    }
    if (layer.clipMaskHigh) {
      if (!masks.has(layer.clipMaskHigh))
        masks.set(layer.clipMaskHigh, await asset(layer.clipMaskHigh))
      input = await blank().composite([{ input, left, top }]).png().toBuffer()
      input = await sharp(input)
        .composite([{ input: masks.get(layer.clipMaskHigh), blend: 'dest-in' }])
        .png()
        .toBuffer()
      left = 0
      top = 0
    }
    paint.push({ input, left, top })
  }
  return {
    png: await blank().composite(paint).png().toBuffer(),
    manifestSha256: hash(bytes),
    assets,
  }
}
async function dominant(png, band) {
  const { data, info } = await sharp(png)
    .extract({ left: band.x * 3, top: band.y * 3, width: band.width * 3, height: band.height * 3 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const bins = new Map()
  let count = 0
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] < 240) continue
    const key = `${data[i] >> 3},${data[i + 1] >> 3},${data[i + 2] >> 3}`,
      value = bins.get(key) ?? { count: 0, r: 0, g: 0, b: 0 }
    value.count++
    value.r += data[i]
    value.g += data[i + 1]
    value.b += data[i + 2]
    bins.set(key, value)
    count++
  }
  if (!count) throw Error('Edge band has no opaque source pixels')
  const best = [...bins.values()].sort((a, b) => b.count - a.count)[0]
  return {
    color:
      '#' +
      [best.r, best.g, best.b]
        .map((v) =>
          Math.round(v / best.count)
            .toString(16)
            .padStart(2, '0'),
        )
        .join(''),
    dominance: best.count / count,
    opaquePixels: count,
    band,
  }
}
async function narrowBands(png, upper, options = {}) {
  const { data, info } = await sharp(png)
    .extract({
      left: 0,
      top: (options.y ?? 4) * 3,
      width: 2400,
      height: (options.height ?? 17) * 3,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const base = [1, 3, 5].map((i) => parseInt(upper.slice(i, i + 2), 16)),
    columns = []
  const luma = (rgb) => rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
  for (let x = 0; x < 800; x++) {
    const bins = new Map()
    for (let y = 0; y < info.height; y++)
      for (let dx = 0; dx < 3; dx++) {
        const i = (y * info.width + x * 3 + dx) * info.channels
        if (data[i + 3] < 240) continue
        const rgb = [data[i], data[i + 1], data[i + 2]],
          key = rgb.map((n) => n >> 3).join(',')
        const b = bins.get(key) ?? { count: 0, sum: [0, 0, 0] }
        b.count++
        rgb.forEach((n, i) => (b.sum[i] += n))
        bins.set(key, b)
      }
    const best = [...bins.values()].sort((a, b) => b.count - a.count)[0]
    const rgb = best ? best.sum.map((n) => n / best.count) : base
    const distance = Math.hypot(...rgb.map((n, i) => n - base[i])),
      brightness = Math.abs(luma(rgb) - luma(base))
    columns.push({
      rgb,
      candidate:
        x >= (options.minX ?? 0) && x < (options.maxX ?? 800) && distance > 24 && brightness > 9,
    })
  }
  if (options.persistBottom) {
    const cut = await sharp(png)
      .extract({ left: 0, top: 2454, width: 2400, height: 6 })
      .ensureAlpha()
      .raw()
      .toBuffer()
    for (let x = 0; x < 800; x++) {
      let supported = 0
      for (let y = 0; y < 6; y++)
        for (let dx = 0; dx < 3; dx++) {
          const i = (y * 2400 + x * 3 + dx) * 4,
            rgb = [cut[i], cut[i + 1], cut[i + 2]]
          if (
            cut[i + 3] >= 240 &&
            Math.hypot(...rgb.map((n, j) => n - base[j])) > 24 &&
            Math.abs(luma(rgb) - luma(base)) > 9 &&
            Math.hypot(...rgb.map((n, j) => n - columns[x].rgb[j])) < 24
          )
            supported++
        }
      columns[x].candidate &&= supported >= 12
    }
  }
  const runs = []
  for (let x = 0; x < 800; ) {
    if (!columns[x].candidate) {
      x++
      continue
    }
    const start = x,
      sum = [0, 0, 0]
    while (x < 800 && columns[x].candidate) {
      columns[x].rgb.forEach((n, i) => (sum[i] += n))
      x++
    }
    const width = x - start
    if (width >= 3 && width <= 35)
      runs.push({
        x: start,
        width,
        color:
          '#' +
          sum
            .map((n) =>
              Math.round(n / width)
                .toString(16)
                .padStart(2, '0'),
            )
            .join(''),
      })
  }
  const merged = []
  for (const run of runs) {
    const previous = merged.at(-1),
      rgb = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
    if (
      previous &&
      run.x - (previous.x + previous.width) <= 2 &&
      run.x + run.width - previous.x <= 35 &&
      Math.hypot(...rgb(run.color).map((n, i) => n - rgb(previous.color)[i])) < 24
    ) {
      previous.width = run.x + run.width - previous.x
      previous.color =
        '#' +
        [0, 1, 2]
          .map((i) =>
            Math.round(
              columns
                .slice(previous.x, previous.x + previous.width)
                .reduce((n, c) => n + c.rgb[i], 0) / previous.width,
            )
              .toString(16)
              .padStart(2, '0'),
          )
          .join('')
    } else merged.push(run)
  }
  return merged
    .sort((a, b) => b.width - a.width)
    .slice(0, options.max ?? 8)
    .sort((a, b) => a.x - b.x)
}
async function reviewBoards() {
  const dir = path.join(output, 'after'),
    bytes = await readFile(path.join(dir, 'manifest.json')),
    manifest = JSON.parse(bytes),
    records = []
  for (const room of manifest.records) {
    const mobile = await readFile(path.join(dir, `${room.id}-390x844.png`)),
      short = await readFile(path.join(dir, `${room.id}-320x568.png`)),
      desktop = await sharp(await readFile(path.join(dir, `${room.id}-1440x900.png`)))
        .resize(720, 450)
        .png()
        .toBuffer()
    const text = `<svg xmlns="http://www.w3.org/2000/svg" width="740" height="1400" style="font-family:monospace;fill:#eee"><text x="10" y="19" font-size="14">${room.id}</text><text x="10" y="38" font-size="10">390x844 / 320x568 / desktop1440x900 at50% · actual CPU proofs, NOT browser/GPU</text><text x="10" y="916" font-size="12">DESKTOP · original framing, scaled for this per-room review board</text></svg>`
    const png = await sharp({
      create: { width: 740, height: 1400, channels: 4, background: '#181818' },
    })
      .composite([
        { input: mobile, left: 10, top: 48 },
        { input: short, left: 410, top: 48 },
        { input: desktop, left: 10, top: 930 },
        { input: Buffer.from(text), left: 0, top: 0 },
      ])
      .png()
      .toBuffer()
    const file = `${room.id}-review-board.png`
    await writeFile(path.join(dir, file), png)
    records.push({ id: room.id, file, sha256: hash(png) })
  }
  await writeFile(
    path.join(dir, 'review-boards.json'),
    JSON.stringify(
      {
        method:
          'Per-room combination of actual three captured PNGs: phones unscaled, desktop50%; not browser/GPU',
        captureManifestSha256: hash(bytes),
        records,
      },
      null,
      2,
    ) + '\n',
  )
  console.log(`REVIEW BOARDS ${records.length}`)
}
async function captureArchitecture() {
  const sourceFiles = {}
  const sources = [
    'lib/sceneWorldArt.ts',
    'lib/sceneWorldArchitecture.ts',
    'lib/sceneWorldFittings.ts',
    'model/sceneSideFittings.ts',
    'model/sceneWorldEdges.ts',
    'model/sceneRenovation.ts',
    'model/sceneRenovationStandard.ts',
    'model/sceneRenovationPremium.ts',
    'model/sceneWorldCamera.ts',
    'model/sceneWorldCatalog.ts',
    'model/sceneInterior.ts',
    'lib/animalDrawing.ts',
    'model/animalLife.ts',
    'model/animalHabitats.ts',
    'model/animalSpecies.ts',
  ]
  for (const file of sources)
    sourceFiles[file] = hash(await readFile(path.join(root, 'src/pages/focus', file)))
  const { sceneWorldSvg } = await import('../src/pages/focus/lib/sceneWorldArt.ts')
  const { frameSceneWorld } = await import('../src/pages/focus/model/sceneWorldCamera.ts')
  const { SCENE_WORLD_BOUNDS: bounds } = await import(
    '../src/pages/focus/model/sceneWorldCatalog.ts'
  )
  const baselineBytes = await readFile(
    path.join(workspace, 'artifacts/room-renovation-2026-11-12/baseline.json'),
  )
  const baseline = JSON.parse(baselineBytes)
  const only = args
    .find((a) => a.startsWith('--only='))
    ?.slice(7)
    .split(',')
  if (only?.some((id) => !ALL_BACKGROUNDS.some((r) => r.id === id)))
    throw Error('Unknown --only room')
  const rooms = ALL_BACKGROUNDS.filter((r) => !only || only.includes(r.id))
  const dir = path.join(output, 'after')
  await mkdir(dir, { recursive: true })
  const views = [
    [390, 844],
    [320, 568],
    [1440, 900],
  ]
  const galleries = new Map(views.map(([w, h]) => [`${w}x${h}`, []]))
  const records = []
  const data = (b) => 'data:image/png;base64,' + b.toString('base64')
  const project = async (id, png, world, w, h) => {
    const f = frameSceneWorld(w, h, id)
    if (
      ![f.x, f.y, f.width, f.height, f.scale].every(Number.isFinite) ||
      f.scale <= 0 ||
      f.x < -1e-6 ||
      f.y < -1e-6 ||
      f.x + f.width > w + 1e-6 ||
      f.y + f.height > h + 1e-6
    )
      throw Error(`Protected core crop ${id}/${w}x${h}`)
    const image = (src, x, y, width, height) =>
      `<image xlink:href="${src}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="none"/>`
    const body =
      image(
        world.underlay,
        f.x + bounds.x * f.scale,
        f.y + bounds.y * f.scale,
        bounds.width * f.scale,
        bounds.height * f.scale,
      ) +
      image(data(png), f.x, f.y, f.width, f.height) +
      image(
        world.joinery,
        f.x + bounds.x * f.scale,
        f.y + bounds.y * f.scale,
        bounds.width * f.scale,
        bounds.height * f.scale,
      )
    const result = await sharp(
      Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" overflow="hidden">${body}</svg>`,
      ),
    )
      .png()
      .toBuffer()
    return { result, framing: f }
  }
  for (const room of rooms) {
    const composed = await core(room.id, true),
      world = {}
    const worldHashes = {}
    for (const layer of ['underlay', 'joinery']) {
      const svg = sceneWorldSvg(room.id, layer)
      worldHashes[layer] = hash(Buffer.from(svg))
      world[layer] = data(await sharp(Buffer.from(svg)).png().toBuffer())
    }
    const record = {
      id: room.id,
      seed: 42,
      time: 60,
      coffee: 0,
      coreSha256: hash(composed.png),
      manifestSha256: composed.manifestSha256,
      assetHashes: composed.assets,
      worldHashes,
      views: {},
    }
    for (const [w, h] of views) {
      const key = `${w}x${h}`,
        { result, framing } = await project(room.id, composed.png, world, w, h)
      await writeFile(path.join(dir, `${room.id}-${key}.png`), result)
      record.views[key] = { sha256: hash(result), framing }
      galleries.get(key).push({ id: room.id, png: result })
      if (w === 390) {
        const relative = `artifacts/animal-life-2026-11-12/verified/scenes/${room.id}-t60-390x844.png`
        const before = await readFile(path.join(workspace, relative)),
          expected = baseline.files.find((f) => f.path === relative)
        if (!expected || hash(before) !== expected.sha256)
          throw Error(`Before evidence changed ${room.id}`)
        const text = `<svg xmlns="http://www.w3.org/2000/svg" width="820" height="920" style="font-family:monospace;fill:#eee"><text x="12" y="21" font-size="15">${room.id}</text><text x="12" y="40" font-size="11">BEFORE / AFTER · actual compiled core + live t60 seed42 · CPU only, not GPU/browser</text><text x="12" y="59" font-size="12">BEFORE (immutable baseline)</text><text x="418" y="59" font-size="12">AFTER (new native architecture)</text></svg>`
        await sharp({ create: { width: 820, height: 920, channels: 4, background: '#181818' } })
          .composite([
            { input: before, left: 12, top: 68 },
            { input: result, left: 418, top: 68 },
            { input: Buffer.from(text), left: 0, top: 0 },
          ])
          .png()
          .toFile(path.join(dir, `${room.id}-before-after.png`))
        record.beforeSha256 = hash(before)
      }
    }
    records.push(record)
    console.log(`RENOVATION ${room.id}`)
  }
  for (const [key, tiles] of galleries) {
    const desktop = key === '1440x900',
      tileW = desktop ? 344 : 176,
      tileH = desktop ? 245 : key === '390x844' ? 375 : 325
    const columns = desktop ? 4 : 8,
      width = columns * tileW,
      height = 68 + Math.ceil(tiles.length / columns) * tileH
    const paint = []
    let labels = ''
    for (const [i, tile] of tiles.entries()) {
      const x = (i % columns) * tileW,
        y = 68 + Math.floor(i / columns) * tileH
      const thumb = await sharp(tile.png)
          .resize({ width: tileW - 12, height: tileH - 30, fit: 'inside' })
          .png()
          .toBuffer(),
        meta = await sharp(thumb).metadata()
      paint.push({ input: thumb, left: x + Math.round((tileW - meta.width) / 2), top: y })
      labels += `<text x="${x + 6}" y="${y + tileH - 10}" font-size="8">${tile.id}</text>`
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" style="font-family:monospace;fill:#eee"><text x="12" y="24" font-size="16">ROOM RENOVATION · ${key} · ${tiles.length} actual rooms</text><text x="12" y="46" font-size="11">CPU compiled layers + live poses + native-world geometry; weather excluded; not GPU/browser screenshots.</text>${labels}</svg>`
    await sharp({ create: { width, height, channels: 4, background: '#181818' } })
      .composite([...paint, { input: Buffer.from(svg), left: 0, top: 0 }])
      .png()
      .toFile(path.join(dir, `gallery-${key}.png`))
  }
  const changed = []
  for (const [file, sha] of Object.entries(sourceFiles))
    if (hash(await readFile(path.join(root, 'src/pages/focus', file))) !== sha) changed.push(file)
  await writeFile(
    path.join(dir, 'manifest.json'),
    JSON.stringify(
      {
        method:
          'Static CPU composition of actual compiled bodyless core + shared live poses at60s seed42 + new native architecture underlay/joinery. Exact masks/order. Weather excluded. NOT GPU/browser screenshots.',
        rooms: records.length,
        baselineSha256: hash(baselineBytes),
        sourceFiles,
        sourceChangedDuringCapture: changed,
        records,
      },
      null,
      2,
    ) + '\n',
  )
  if (changed.length) throw Error(`Source changed during capture: ${changed.join(', ')}`)
  console.log(
    JSON.stringify({
      output: dir,
      rooms: records.length,
      perRoomPngs: records.length * 4,
      galleries: 3,
      sourceChangedDuringCapture: changed,
    }),
  )
}
await mkdir(output, { recursive: true })
const probe = args.find((a) => a.startsWith('--frame-probe='))?.split('=')[1]
if (probe) {
  const composed = await core(probe),
    upper = await dominant(composed.png, { x: 16, y: 4, width: 768, height: 17 })
  console.log(
    JSON.stringify(
      { id: probe, upper: upper.color, upperFrames: await narrowBands(composed.png, upper.color) },
      null,
      2,
    ),
  )
} else if (args.includes('--edges-only')) {
  const bands = {
    upper: { x: 16, y: 4, width: 768, height: 17 },
    lower: { x: 16, y: 795, width: 768, height: 22 },
    left: { x: 4, y: 24, width: 17, height: 772 },
    right: { x: 779, y: 24, width: 17, height: 772 },
    sky: { x: 100, y: 150, width: 600, height: 250 },
  }
  const materials = {},
    records = []
  for (const room of ALL_BACKGROUNDS) {
    const composed = await core(room.id),
      samples = {}
    for (const [edge, band] of Object.entries(bands))
      samples[edge] = await dominant(
        composed.png,
        edge === 'sky' && room.id === 'premium-rooftop-cinema'
          ? { x: 100, y: 150, width: 300, height: 150 }
          : band,
      )
    materials[room.id] = Object.fromEntries(
      Object.entries(samples).map(([edge, sample]) => [edge, sample.color]),
    )
    const frames = await narrowBands(composed.png, samples.upper.color)
    const supports = await narrowBands(composed.png, samples.lower.color, {
      y: 795,
      height: 22,
      minX: 70,
      maxX: 730,
      persistBottom: true,
      max: 6,
    })
    if (supports.length) materials[room.id].lowerSupports = supports
    if (frames.length) materials[room.id].upperFrames = frames
    records.push({
      id: room.id,
      manifestSha256: composed.manifestSha256,
      coreSha256: hash(composed.png),
      samples,
      upperFrames: frames,
      lowerSupports: supports,
    })
    console.log(`EDGE ${room.id}`)
  }
  await writeFile(
    path.join(root, 'src/pages/focus/model/sceneWorldEdges.ts'),
    `/** Dominant actual compiled BODYLESS core edge materials. CPU sampled; no world joinery or image padding. Sky is an aperture-region palette, used only by open envelopes. Lower bands are statistical candidates, not semantic legs. */\nexport type SceneEdgeBand = {x: number; width: number; color: string}\nexport type SceneEdgeMaterials = { upper: string; lower: string; left: string; right: string; sky?: string; upperFrames?: SceneEdgeBand[]; lowerSupports?: SceneEdgeBand[] }\nexport const SCENE_EDGE_MATERIALS: Record<string, SceneEdgeMaterials> = ${JSON.stringify(materials, null, 2)}\n`,
  )
  await writeFile(
    path.join(output, 'edge-materials.json'),
    JSON.stringify(
      {
        method:
          'Actual high-resolution compiled bodyless core, coffee0/weather excluded, exact masks/paint order; 8-level RGB modal bucket averaged from opaque pixels; no original world/joinery',
        records,
      },
      null,
      2,
    ) + '\n',
  )
  console.log(`EDGE COMPLETE ${records.length}`)
} else if (args.includes('--boards-only')) {
  await reviewBoards()
} else if (args.includes('--capture')) {
  await captureArchitecture()
} else
  console.log('Use --edges-only, or --capture after architecture source freeze; no browser/GPU.')
