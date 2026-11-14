/** Serial source inventory and CPU proofs; never browser/GPU screenshots. */
import { createServer } from 'vite'
import sharp from 'sharp'
import { createHash } from 'node:crypto'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Window } from 'happy-dom'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const args = process.argv.slice(2)
if (args.includes('--help')) {
  console.log(`Usage: node scripts/capture-animal-life.mjs MODE [--output DIRECTORY]
  --inventory-only  Serial source SSR inventory + semantic model bindings; closes its server.
  --poses-only      Shared rig anatomy, supported grooming, continuous motion and home casts.
  --scenes          Fresh compiled bodyless layers + live rigs, ordered raster masks and world framing.
Scene options: --only=id,id --times=0,24,90 --seed=42
All output is CPU evidence, not browser/GPU screenshots. Scene mode rejects stale or incomplete exports.`)
  process.exit(0)
}
const root = fileURLToPath(new URL('../', import.meta.url)),
  workspace = fileURLToPath(new URL('../../../', import.meta.url)),
  oi = args.indexOf('--output')
if (oi >= 0 && !args[oi + 1]) throw Error('--output requires a directory')
const output = path.resolve(workspace, oi < 0 ? 'artifacts/animal-life-2026-11-12' : args[oi + 1])
async function capturePoseSheets() {
  const {
    animalPoseSvg,
    animalPoseBounds,
    animalResourceSvg,
    animalRig,
    animalPartPose,
    ANIMAL_FEEDING_OFFSET,
  } = await import('../src/pages/focus/lib/animalDrawing.ts')
  const { ANIMAL_SPECIES } = await import('../src/pages/focus/model/animalSpecies.ts')
  const { ANIMAL_HABITATS } = await import('../src/pages/focus/model/animalHabitats.ts')
  const specimens = new Map()
  const domains = new Map()
  for (const plan of Object.values(ANIMAL_HABITATS))
    for (const actor of plan.actors)
      domains.set(actor.id, plan.zones.find((z) => z.id === actor.zoneId).domain)
  for (const room of Object.values(ANIMAL_HABITATS))
    for (const actor of room.actors)
      if (!specimens.has(actor.species)) specimens.set(actor.species, actor)
  const records = []
  const ordered = [...specimens.values()]
  await mkdir(output, { recursive: true })
  for (let page = 0; page < Math.ceil(ordered.length / 7); page++) {
    let body = ''
    for (const [row, spec] of ordered.slice(page * 7, page * 7 + 7).entries()) {
      const move =
        ANIMAL_SPECIES[spec.species].actions.find((a) =>
          ['walk', 'hop', 'fly', 'swim'].includes(a),
        ) ?? 'observe'
      const domain = domains.get(spec.id)
      const actions =
        domain === 'air' && spec.species !== 'spider'
          ? ['rest', 'fly', 'observe', 'yield']
          : spec.species === 'dragon'
            ? ['sleep', 'rest', 'stretch', 'observe']
            : [
                ANIMAL_SPECIES[spec.species].actions.includes('sleep') ? 'sleep' : 'rest',
                move,
                'eat',
                'observe',
              ]
      const states = actions.map((action) => ({
        id: spec.id,
        x: 400,
        y: 600,
        action,
        heading: 1,
        phase: 0.5,
        time: 1.2,
        gaitPhase: 0.25,
        emotion: 'calm',
        domain,
      }))
      const bounds = states.map((state) => animalPoseBounds(spec, state))
      const box = { x: Math.min(...bounds.map((b) => b.x)), y: Math.min(...bounds.map((b) => b.y)) }
      box.width = Math.max(...bounds.map((b) => b.x + b.width)) - box.x
      box.height = Math.max(...bounds.map((b) => b.y + b.height)) - box.y
      for (const [col, state] of states.entries()) {
        const x = col * 230,
          y = 60 + row * 190,
          factor = Math.min(206 / (box.width + 8), 142 / (box.height + 8)),
          w = (box.width + 8) * factor,
          h = (box.height + 8) * factor
        const paths = animalPoseSvg(spec, state)
          .replace(/^<svg[^>]*>/, '')
          .replace(/<\/svg>$/, '')
        body += `<text x="${x + 10}" y="${y + 17}" font-size="13">${spec.species} · ${state.action} (${domain})</text><svg x="${x + (230 - w) / 2}" y="${y + 28 + (146 - h) / 2}" width="${w}" height="${h}" viewBox="${box.x - 4} ${box.y - 4} ${box.width + 8} ${box.height + 8}">${paths}</svg>`
        records.push({
          species: spec.species,
          sourceActor: spec.id,
          state,
          bounds: bounds[col],
          normalizedPreviewScale: factor,
        })
      }
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="920" height="1390" style="font-family:monospace;fill:#eee"><rect width="920" height="1390" fill="#181818"/><text x="12" y="22" font-size="16">ANIMAL RIG CPU PROOFS · ${page + 1}/${Math.ceil(ordered.length / 7)} · NOT browser/GPU</text><text x="12" y="42" font-size="11">Actual shared geometry; per-species scale normalized for anatomy review. Phase .5 / time 1.2s.</text>${body}</svg>`
    await sharp(Buffer.from(svg))
      .png()
      .toFile(path.join(output, `species-poses-${page + 1}.png`))
  }
  const times = [0, 0.2, 0.5, 1, 1.5],
    motionRows = [
      ['cat', 'rest'],
      ['dragon', 'rest'],
      ['gull', 'observe'],
      ['bat', 'observe'],
      ['butterfly', 'fly'],
      ['firefly', 'fly'],
      ['fish', 'swim'],
      ['jellyfish', 'swim'],
      ['ray', 'swim'],
      ['snail', 'walk'],
      ['rabbit', 'hop'],
    ]
  let strip = ''
  const motionRecords = []
  for (const [row, [species, action]] of motionRows.entries()) {
    const spec = specimens.get(species),
      domain = domains.get(spec.id)
    const states = times.map((time) => ({
      id: spec.id,
      x: 400,
      y: 600,
      action,
      heading: 1,
      phase: 0.5,
      time,
      gaitPhase: (time * 1.7) % 1,
      domain,
      emotion: 'calm',
    }))
    const bounds = states.map((st) => animalPoseBounds(spec, st)),
      box = { x: Math.min(...bounds.map((b) => b.x)), y: Math.min(...bounds.map((b) => b.y)) }
    box.width = Math.max(...bounds.map((b) => b.x + b.width)) - box.x
    box.height = Math.max(...bounds.map((b) => b.y + b.height)) - box.y
    for (const [col, st] of states.entries()) {
      const x = col * 220,
        y = 60 + row * 150,
        scale = Math.min(198 / (box.width + 8), 108 / (box.height + 8)),
        w = (box.width + 8) * scale,
        h = (box.height + 8) * scale
      strip += `<text x="${x + 8}" y="${y + 15}" font-size="11">${species} ${action} · ${st.time}s</text><svg x="${x + (220 - w) / 2}" y="${y + 25 + (114 - h) / 2}" width="${w}" height="${h}" viewBox="${box.x - 4} ${box.y - 4} ${box.width + 8} ${box.height + 8}">${animalPoseSvg(
        spec,
        st,
      )
        .replace(/^<svg[^>]*>/, '')
        .replace(/<\/svg>$/, '')}</svg>`
      motionRecords.push({ species, state: st, bounds: bounds[col] })
    }
  }
  await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="1710" style="font-family:monospace;fill:#eee"><rect width="1100" height="1710" fill="#181818"/><text x="12" y="22" font-size="15">CONTINUOUS LIMB / BREATH / WING / FIN TIME STRIP · CPU ONLY</text><text x="12" y="42" font-size="11">Root position held fixed; actual shared geometry changes at 0/.2/.5/1/1.5 seconds. Not GPU/browser footage.</text>${strip}</svg>`,
    ),
  )
    .png()
    .toFile(path.join(output, 'motion-time-strip.png'))
  const { AnimalLifeSimulation } = await import('../src/pages/focus/model/animalLife.ts')
  let groomingProof = ''
  for (const [index, species] of [
    'cat',
    'dog',
    'fox',
    'rabbit',
    'squirrel',
    'owl',
    'songbird',
  ].entries()) {
    const spec = specimens.get(species),
      domain = ['owl', 'songbird'].includes(species) ? 'perch' : 'ground'
    for (const [column, action] of ['observe', 'groom'].entries()) {
      const state = {
        id: spec.id,
        x: 400,
        y: 600,
        action,
        heading: 1,
        phase: 0.5,
        time: 1.2,
        domain,
      }
      const body = animalPoseSvg({ ...spec, scale: 1 }, state)
        .replace(/^<svg[^>]*>/, '')
        .replace(/<\/svg>$/, '')
      groomingProof += `<text x="${column * 260 + 12}" y="${index * 150 + 75}" font-size="13">${species} · ${action} (${domain})</text><svg x="${column * 260}" y="${index * 150 + 78}" width="260" height="120" viewBox="280 500 240 110">${body}</svg>`
    }
  }
  await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="1110" style="font-family:monospace;fill:#eee"><rect width="520" height="1110" fill="#181818"/><text x="12" y="24" font-size="14">SUPPORTED GROOM · SHARED RIG CPU PROOF</text><text x="12" y="44" font-size="11">Ground/perch only · normalized scale · not GPU/browser</text>${groomingProof}</svg>`,
    ),
  )
    .png()
    .toFile(path.join(output, 'supported-groom.png'))
  let mealProof = ''
  for (const [row, species] of [
    'cat',
    'dog',
    'fox',
    'rabbit',
    'deer',
    'camel',
    'snail',
    'owl',
    'fish',
  ].entries()) {
    const domain = species === 'owl' ? 'perch' : species === 'fish' ? 'water' : 'ground'
    for (const [column, scale] of [1, 0.5].entries()) {
      const spec = { ...specimens.get(species), scale },
        state = {
          id: spec.id,
          x: 400,
          y: 600,
          action: 'eat',
          heading: 1,
          phase: 0.5,
          time: 1.2,
          domain,
        },
        offset = ANIMAL_FEEDING_OFFSET[species],
        resource = {
          kind: 'food',
          species,
          scale,
          position: { x: 400 + offset.x * scale, y: 600 + offset.y * scale },
        }
      const body = [animalResourceSvg(resource, { domain }), animalPoseSvg(spec, state)]
        .map((s) => s.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, ''))
        .join('')
      mealProof += `<text x="${column * 360 + 12}" y="${row * 135 + 72}" font-size="12">${species} · ${domain} · consumer scale ${scale}</text><svg x="${column * 360}" y="${row * 135 + 80}" width="360" height="110" viewBox="280 460 260 150">${body}</svg>`
    }
  }
  await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280" style="font-family:monospace;fill:#eee"><rect width="720" height="1280" fill="#181818"/><text x="12" y="24" font-size="14">CONSUMER-SCALED MEALS / SOFT FORAGE · CPU PROOF</text><text x="12" y="44" font-size="11">Shared eating mouth positions; no scene/supports here. Not GPU/browser.</text>${mealProof}</svg>`,
    ),
  )
    .png()
    .toFile(path.join(output, 'meal-stations.png'))
  const cat = { ...specimens.get('cat'), scale: 1 },
    mouth = animalRig(cat).find((p) => p.motion === 'yawn-mouth')
  let firstYawn = 0
  for (let tick = 0; tick < 2400; tick++) {
    const time = tick / 20
    if (
      animalPartPose(mouth, {
        id: cat.id,
        x: 400,
        y: 600,
        action: 'rest',
        heading: 1,
        phase: 0.5,
        time,
        domain: 'perch',
      }).alpha > 0.01
    ) {
      firstYawn = time
      break
    }
  }
  let yawnStrip = ''
  const yawnFrames = []
  for (const [column, delta] of [-0.2, 0.35, 0.8, 1.3, 1.8, 2.3, 2.8].entries()) {
    const state = {
        id: cat.id,
        x: 400,
        y: 600,
        action: 'rest',
        heading: 1,
        phase: 0.5,
        time: firstYawn + delta,
        domain: 'perch',
      },
      body = animalPoseSvg(cat, state)
        .replace(/^<svg[^>]*>/, '')
        .replace(/<\/svg>$/, '')
    yawnStrip += `<text x="${column * 180 + 8}" y="66" font-size="12">t=${state.time.toFixed(2)}s</text><svg x="${column * 180}" y="76" width="180" height="112" viewBox="300 510 180 112">${body}</svg><svg x="${column * 180}" y="196" width="180" height="128" viewBox="395 540 70 60">${body}</svg>`
    yawnFrames.push({ state, mouthPose: animalPartPose(mouth, state) })
  }
  await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1260" height="340" style="font-family:monospace;fill:#eee"><rect width="1260" height="340" fill="#181818"/><text x="12" y="22" font-size="15">OCCASIONAL CAT YAWN · CACHED MOUTH / SAME HEAD JOINT · CPU ONLY</text><text x="12" y="42" font-size="11">Supported rest/sleep only; no walk/eat/social yawn. Whole pose + head detail. Not GPU/browser.</text>${yawnStrip}</svg>`,
    ),
  )
    .png()
    .toFile(path.join(output, 'cat-yawn-strip.png'))
  await writeFile(
    path.join(output, 'cat-yawn-evidence.json'),
    JSON.stringify(
      { method: 'Pure shared cached rig CPU proof', firstYawn, frames: yawnFrames },
      null,
      2,
    ) + '\n',
  )
  let cast = ''
  const placements = []
  for (const [index, plan] of Object.values(ANIMAL_HABITATS).entries()) {
    const simulation = new AnimalLifeSimulation(plan, 42)
    let scene = ''
    for (const state of simulation.snapshot()) {
      const spec = plan.actors.find((a) => a.id === state.id),
        zone = plan.zones.find((z) => z.id === state.zoneId)
      const actual = { ...state, domain: zone.domain }
      const rigSpec = { ...spec, tetherAnchor: zone.anchor }
      scene += animalPoseSvg(rigSpec, actual)
        .replace(/^<svg[^>]*>/, '')
        .replace(/<\/svg>$/, '')
      placements.push({
        room: plan.id,
        specId: spec.id,
        state: actual,
        bounds: animalPoseBounds(spec, actual),
      })
    }
    simulation.dispose()
    const x = (index % 8) * 184,
      y = 60 + Math.floor(index / 8) * 205
    cast += `<svg x="${x + 4}" y="${y}" width="176" height="180.4" viewBox="0 0 800 820" overflow="hidden"><rect width="800" height="820" fill="#26302b"/>${scene}</svg><text x="${x + 4}" y="${y + 194}" font-size="8">${plan.id}</text>`
  }
  await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1472" height="1910" style="font-family:monospace;fill:#eee"><rect width="1472" height="1910" fill="#181818"/><text x="12" y="22" font-size="15">ALL 68 INITIAL LIVE CASTS · ACTUAL HOME SCALE · CPU ONLY / NOT GPU</text><text x="12" y="42" font-size="11">Actor placement diagnostic only; scene/supports are intentionally absent here. Full scene proofs follow compiled exports.</text>${cast}</svg>`,
    ),
  )
    .png()
    .toFile(path.join(output, 'actor-placement-68.png'))
  await writeFile(
    path.join(output, 'placement-evidence.json'),
    JSON.stringify(
      { method: 'CPU actor-only placement diagnostic; no scene/supports/GPU', placements },
      null,
      2,
    ) + '\n',
  )
  await writeFile(
    path.join(output, 'pose-evidence.json'),
    JSON.stringify(
      {
        method: 'CPU shared rig proofs, no GPU/browser; normalized specimen scale',
        species: specimens.size,
        records,
        motionRecords,
      },
      null,
      2,
    ) + '\n',
  )
  console.log(JSON.stringify({ output, species: specimens.size, poseFrames: records.length }))
}
if (args.includes('--poses-only')) {
  await capturePoseSheets()
  process.exit(0)
}
async function captureScenes() {
  const sourceFiles = {}
  for (const file of [
    'lib/animalDrawing.ts',
    'model/animalLife.ts',
    'model/animalHabitats.ts',
    'model/animalSpecies.ts',
  ])
    sourceFiles[file] = createHash('sha256')
      .update(await readFile(path.join(root, 'src/pages/focus', file)))
      .digest('hex')
  const { ANIMAL_HABITATS } = await import('../src/pages/focus/model/animalHabitats.ts')
  const { AnimalLifeSimulation } = await import('../src/pages/focus/model/animalLife.ts')
  const { animalPoseSvg, animalPoseBounds, animalResourceSvg } = await import(
    '../src/pages/focus/lib/animalDrawing.ts'
  )
  const { sceneWorldSvg } = await import('../src/pages/focus/lib/sceneWorldArt.ts')
  const { SCENE_WORLD_BOUNDS } = await import('../src/pages/focus/model/sceneWorldCatalog.ts')
  const { frameSceneWorld } = await import('../src/pages/focus/model/sceneWorldCamera.ts')
  const only = args
    .find((a) => a.startsWith('--only='))
    ?.slice(7)
    .split(',')
    .filter(Boolean)
  const times = (args.find((a) => a.startsWith('--times='))?.slice(8) ?? '0,60,300')
    .split(',')
    .map(Number)
    .sort((a, b) => a - b)
  const seed = Number(args.find((a) => a.startsWith('--seed='))?.slice(7) ?? 42)
  if (times.some((t) => !Number.isFinite(t) || t < 0) || !Number.isSafeInteger(seed))
    throw Error('Invalid --times or --seed')
  const plans = Object.values(ANIMAL_HABITATS).filter((p) => !only || only.includes(p.id))
  if (only?.some((id) => !ANIMAL_HABITATS[id])) throw Error('Unknown --only room')
  const dir = path.join(output, 'scenes'),
    scale = 3,
    W = 800,
    H = 820
  await mkdir(dir, { recursive: true })
  sharp.cache(false)
  sharp.concurrency(1)
  const blank = () =>
    sharp({
      create: {
        width: W * scale,
        height: H * scale,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
  const svg = (body) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="820" viewBox="0 0 800 820">${body}</svg>`
  const inner = (text) => text.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
  const data = (buffer) => 'data:image/png;base64,' + buffer.toString('base64')
  const hash = (buffer) => createHash('sha256').update(buffer).digest('hex')
  const sheets = new Map(),
    records = [],
    eventRecords = []
  const detailIds = new Set(
    only ?? [
      'cafe-rain',
      'garden-court',
      'forest-autumn',
      'water-lake',
      'premium-last-bookstore',
      'premium-spirit-tree',
      'premium-underwater-library',
      'premium-dragon-study',
    ],
  )
  const projection = async (id, core, ambient, w, h, maxW, maxH) => {
    const f = frameSceneWorld(w, h, id),
      b = SCENE_WORLD_BOUNDS,
      factor = Math.min(maxW / w, maxH / h)
    const image = (src, x, y, width, height) =>
      `<image xlink:href="${src}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="none"/>`
    const body =
      image(
        ambient.underlay,
        f.x + b.x * f.scale,
        f.y + b.y * f.scale,
        b.width * f.scale,
        b.height * f.scale,
      ) +
      image(data(core), f.x, f.y, f.width, f.height) +
      image(
        ambient.joinery,
        f.x + b.x * f.scale,
        f.y + b.y * f.scale,
        b.width * f.scale,
        b.height * f.scale,
      )
    return sharp(
      Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${Math.round(w * factor)}" height="${Math.round(h * factor)}" viewBox="0 0 ${w} ${h}" overflow="hidden">${body}</svg>`,
      ),
    )
      .png()
      .toBuffer()
  }
  for (const plan of plans) {
    const manifestBytes = await readFile(
        path.join(root, 'public/backgrounds/pixi', plan.id, 'manifest.json'),
      ),
      manifest = JSON.parse(manifestBytes)
    if (!manifest.animalLifeVersion) throw Error(`Stale baked-animal manifest: ${plan.id}`)
    const layers = manifest.layers.filter(
      (l) =>
        l.kind !== 'weather' &&
        !l.restHidden &&
        (l.ifCoffeeMin ?? 0) <= 0 &&
        (l.ifCoffeeMax ?? Infinity) >= 0,
    )
    const actual = layers.filter((l) => l.kind === 'animal').map((l) => l.animalId)
    if (
      actual.length !== plan.actors.length ||
      new Set(actual).size !== actual.length ||
      plan.actors.some((a) => !actual.includes(a.id))
    )
      throw Error(`Live slot mismatch: ${plan.id}`)
    const assetHashes = {},
      staticLayers = new Map(),
      masks = new Map()
    const asset = async (url) => {
      const buffer = await readFile(path.join(root, 'public', url))
      assetHashes[url] = hash(buffer)
      return buffer
    }
    const mask = async (layer) => {
      const url = layer.clipMaskHigh
      if (!url) return null
      if (!masks.has(url)) masks.set(url, await asset(url))
      return masks.get(url)
    }
    for (const layer of layers) {
      if (layer.kind === 'animal') continue
      if (!layer.srcHigh) throw Error(`Static layer missing high texture: ${plan.id}/${layer.id}`)
      let input = await asset(layer.srcHigh),
        left = Math.round(layer.x * scale),
        top = Math.round(layer.y * scale)
      const clip = await mask(layer)
      if (clip) {
        input = await blank().composite([{ input, left, top }]).png().toBuffer()
        input = await sharp(input)
          .composite([{ input: clip, blend: 'dest-in' }])
          .png()
          .toBuffer()
        left = 0
        top = 0
      }
      staticLayers.set(layer.id, { input, left, top })
    }
    const world = {}
    for (const kind of ['underlay', 'joinery'])
      world[kind] = data(
        await sharp(Buffer.from(sceneWorldSvg(plan.id, kind)))
          .png()
          .toBuffer(),
      )
    const stationOwner = new Map()
    for (const actor of plan.actors)
      if (!stationOwner.has(actor.zoneId)) stationOwner.set(actor.zoneId, actor.id)
    const render = async (states) => {
      const byId = new Map(states.map((st) => [st.id, st])),
        paint = []
      for (const layer of layers) {
        if (layer.kind !== 'animal') {
          paint.push(staticLayers.get(layer.id))
          continue
        }
        const actor = plan.actors.find((a) => a.id === layer.animalId),
          state = byId.get(actor.id),
          zone = plan.zones.find((z) => z.id === state.zoneId)
        const posed = { ...state, domain: zone.domain }
        let stations = ''
        if (stationOwner.get(zone.id) === actor.id)
          stations = plan.resources
            .filter((r) => r.zoneId === zone.id && r.kind !== 'rest')
            .map((r) => {
              const consumer = plan.actors.find((a) => a.id === r.consumerId)
              return inner(
                animalResourceSvg(
                  { ...r, scale: consumer?.scale, species: consumer?.species },
                  zone,
                ),
              )
            })
            .join('')
        let input = await sharp(
          Buffer.from(
            svg(stations + inner(animalPoseSvg({ ...actor, tetherAnchor: zone.anchor }, posed))),
          ),
          { density: 216 },
        )
          .png()
          .toBuffer()
        const clip = await mask(layer)
        if (clip)
          input = await sharp(input)
            .composite([{ input: clip, blend: 'dest-in' }])
            .png()
            .toBuffer()
        paint.push({ input, left: 0, top: 0 })
      }
      return blank().composite(paint).png().toBuffer()
    }
    const simulation = new AnimalLifeSimulation(plan, seed)
    let elapsed = 0
    try {
      for (const time of times) {
        while (elapsed + 1e-8 < time) {
          const dt = Math.min(0.1, time - elapsed)
          simulation.step(dt)
          elapsed += dt
        }
        const states = simulation.snapshot(),
          core = await render(states)
        records.push({
          room: plan.id,
          seed,
          time,
          manifestSha256: hash(manifestBytes),
          manifestAnimalVersion: manifest.animalLifeVersion,
          assetHashes,
          stationOwners: Object.fromEntries(stationOwner),
          actors: states.map((st) => {
            const a = plan.actors.find((a) => a.id === st.id),
              z = plan.zones.find((z) => z.id === st.zoneId),
              state = { ...st, domain: z.domain }
            return { spec: a, state, bounds: animalPoseBounds(a, state), zone: z }
          }),
        })
        for (const [vw, vh] of [
          [390, 844],
          [1440, 900],
        ]) {
          const key = `t${time}-${vw}x${vh}`
          if (!sheets.has(key)) sheets.set(key, [])
          const tile = await projection(plan.id, core, world, vw, vh, 212, 220)
          sheets.get(key).push({ id: plan.id, buffer: tile })
          if (vw === 390 || detailIds.has(plan.id))
            await writeFile(
              path.join(dir, `${plan.id}-t${time}-${vw}x${vh}.png`),
              await projection(plan.id, core, world, vw, vh, vw, vh),
            )
        }
        if (detailIds.has(plan.id))
          await writeFile(path.join(dir, `${plan.id}-t${time}-core.png`), core)
        if (states.length) {
          const actorBounds = states.map((state) =>
            animalPoseBounds(
              plan.actors.find((a) => a.id === state.id),
              { ...state, domain: plan.zones.find((z) => z.id === state.zoneId).domain },
            ),
          )
          const left = Math.max(0, Math.floor(Math.min(...actorBounds.map((b) => b.x)) - 28)),
            top = Math.max(0, Math.floor(Math.min(...actorBounds.map((b) => b.y)) - 28)),
            right = Math.min(
              800,
              Math.ceil(Math.max(...actorBounds.map((b) => b.x + b.width)) + 28),
            ),
            bottom = Math.min(
              820,
              Math.ceil(Math.max(...actorBounds.map((b) => b.y + b.height)) + 28),
            )
          const crop = {
            left: left * scale,
            top: top * scale,
            width: (right - left) * scale,
            height: (bottom - top) * scale,
          }
          await sharp(core)
            .extract(crop)
            .resize({ width: 1200, height: 1100, fit: 'inside', withoutEnlargement: true })
            .png()
            .toFile(path.join(dir, `${plan.id}-t${time}-animals.png`))
          records.at(-1).actorSceneCrop = crop
        }
      }
      if (detailIds.has(plan.id) && plan.actors.length) {
        const events = new AnimalLifeSimulation(plan, seed),
          found = new Set()
        try {
          for (let tick = 0; tick < 9000 && found.size < 2; tick++) {
            events.step(0.1)
            const states = events.snapshot()
            for (const kind of ['eat', 'social']) {
              if (found.has(kind)) continue
              const actorState = states.find((s) => {
                if (kind === 'eat') return s.action === 'eat'
                const partner = states.find((p) => p.id === s.partnerId)
                return (
                  partner &&
                  ['headbump', 'nuzzle', 'sniff', 'greet'].includes(s.action) &&
                  ['headbump', 'nuzzle', 'sniff', 'greet'].includes(partner.action) &&
                  s.heading === (s.x < partner.x ? 1 : -1) &&
                  partner.heading === -s.heading
                )
              })
              if (!actorState) continue
              const subjects = states.filter(
                (s) => s.id === actorState.id || s.id === actorState.partnerId,
              )
              const bounds = subjects.map((s) =>
                animalPoseBounds(
                  plan.actors.find((a) => a.id === s.id),
                  { ...s, domain: plan.zones.find((z) => z.id === s.zoneId).domain },
                ),
              )
              const food =
                kind === 'eat'
                  ? plan.resources.find((r) => r.kind === 'food' && r.consumerId === actorState.id)
                  : null
              const left = Math.max(
                0,
                Math.floor(Math.min(...bounds.map((b) => b.x), food?.position.x ?? 800) - 25),
              )
              const top = Math.max(
                0,
                Math.floor(Math.min(...bounds.map((b) => b.y), food?.position.y ?? 820) - 25),
              )
              const right = Math.min(
                800,
                Math.ceil(
                  Math.max(...bounds.map((b) => b.x + b.width), food?.position.x ?? 0) + 25,
                ),
              )
              const bottom = Math.min(
                820,
                Math.ceil(
                  Math.max(...bounds.map((b) => b.y + b.height), food?.position.y ?? 0) + 25,
                ),
              )
              const crop = {
                left: left * scale,
                top: top * scale,
                width: (right - left) * scale,
                height: (bottom - top) * scale,
              }
              const image = await sharp(await render(states))
                .extract(crop)
                .resize({ width: 960, height: 700, fit: 'inside' })
                .png()
                .toBuffer()
              const filename = `${plan.id}-${kind}-contact.png`
              await writeFile(path.join(dir, filename), image)
              eventRecords.push({
                room: plan.id,
                kind,
                seed,
                time: (tick + 1) / 10,
                filename,
                crop,
                states: subjects,
                bounds,
                food,
                method: 'Actual compiled ordered/masked scene crop; CPU, not GPU/browser',
              })
              found.add(kind)
            }
          }
          eventRecords.push({
            room: plan.id,
            searchedSeconds: 900,
            missingKinds: ['eat', 'social'].filter((k) => !found.has(k)),
          })
        } finally {
          events.dispose()
        }
      }
    } finally {
      simulation.dispose()
    }
    console.log(`SCENE_PROOF ${plan.id}`)
  }
  for (const [key, tiles] of sheets) {
    const width = 1760,
      height = 60 + Math.ceil(tiles.length / 8) * 250,
      paint = []
    let labels = ''
    for (const [i, tile] of tiles.entries()) {
      const meta = await sharp(tile.buffer).metadata(),
        x = (i % 8) * 220,
        y = 60 + Math.floor(i / 8) * 250
      paint.push({
        input: tile.buffer,
        left: x + Math.round((220 - meta.width) / 2),
        top: y + Math.round((220 - meta.height) / 2),
      })
      labels += `<text x="${x + 4}" y="${y + 237}" font-size="8">${tile.id}</text>`
    }
    const text = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" style="font-family:monospace;fill:#eee"><text x="12" y="22" font-size="16">LIVE ANIMAL CPU SCENE COMPOSITIONS · ${key} · ${tiles.length} rooms</text><text x="12" y="42" font-size="11">Current compiled BODYLESS layers + actual shared live rigs/stations; exact slot order/masks. Weather excluded; NOT GPU/browser screenshots.</text>${labels}</svg>`
    await sharp({ create: { width, height, channels: 4, background: '#181818' } })
      .composite([...paint, { input: Buffer.from(text), left: 0, top: 0 }])
      .png()
      .toFile(path.join(dir, `scene-sheet-${key}.png`))
  }
  const changedSources = []
  for (const [file, sha] of Object.entries(sourceFiles))
    if (hash(await readFile(path.join(root, 'src/pages/focus', file))) !== sha)
      changedSources.push(file)
  await writeFile(
    path.join(dir, 'scene-evidence.json'),
    JSON.stringify(
      {
        method:
          'CPU static composition of current bodyless compiled layers and shared live poses/stations, exact ordered clip masks; weather excluded; not GPU/browser',
        sourceFiles,
        sourceChangedDuringCapture: changedSources,
        rooms: plans.length,
        times,
        seed,
        records,
        eventRecords,
      },
      null,
      2,
    ) + '\n',
  )
  if (changedSources.length)
    throw Error(`Source changed during capture: ${changedSources.join(', ')}`)
  console.log(JSON.stringify({ output: dir, rooms: plans.length, frames: records.length }))
}
if (args.includes('--scenes')) {
  await captureScenes()
  process.exit(0)
}
const living = new Map([
  ['bird', 'songbird'],
  ['squirrel', 'squirrel'],
  ['web', 'spider'],
  ['moth', 'moth'],
  ['butterfly', 'butterfly'],
  ['snail', 'snail'],
  ['ray', 'ray'],
  ['jelly', 'jellyfish'],
  ['caravan', 'camel'],
  ['firefly', 'firefly'],
])
const selectors = [
  '[data-pet]',
  '[data-wildlife]',
  '[data-premium-animal]',
  '[data-premium-hero="sleeping-dragon"]',
  '.premium-fish',
  '.premium-bat',
]
const dom = new Window(),
  rooms = []
let server
try {
  await mkdir(output, { recursive: true })
  server = await createServer({
    root,
    publicDir: false,
    server: { middlewareMode: true, watch: null, hmr: false },
    appType: 'custom',
  })
  const { ALL_BACKGROUNDS } = await server.ssrLoadModule('/src/pages/focus/model/backgrounds.ts')
  const { default: Cafe } = await server.ssrLoadModule('/src/pages/focus/ui/Cafe.tsx')
  for (const room of ALL_BACKGROUNDS) {
    const wrapper = dom.document.createElement('div')
    wrapper.innerHTML = renderToStaticMarkup(
      createElement(Cafe, { backgroundId: room.id, artOnly: true, paused: true, coffeeCount: 0 }),
      { identifierPrefix: `inventory-${room.id}-` },
    )
    const svg = wrapper.querySelector('svg')
    if (!svg) throw Error(`No SVG: ${room.id}`)
    const actors = []
    const append = (el, selector, index, species, physicalCount = 1) => {
      const ancestry = []
      for (let p = el; p && p !== svg; p = p.parentElement) {
        const attrs = {}
        for (const key of [
          'transform',
          'clip-path',
          'mask',
          'data-animal-habitat',
          'data-support',
          'data-signature-layer',
        ])
          if (p.hasAttribute(key)) attrs[key] = p.getAttribute(key)
        if (Object.keys(attrs).length) ancestry.push(attrs)
      }
      actors.push({
        source: { selector, index },
        species,
        physicalCount,
        ancestry,
        sourceElement: el.outerHTML,
      })
    }
    for (const selector of selectors)
      for (const [index, el] of [...svg.querySelectorAll(selector)].entries())
        append(
          el,
          selector,
          index,
          el.getAttribute('data-pet') ||
            el.getAttribute('data-wildlife') ||
            el.getAttribute('data-premium-animal') ||
            (selector.includes('sleeping-dragon')
              ? 'dragon'
              : selector.includes('fish')
                ? 'fish'
                : 'bat'),
          selector === '.premium-bat' ? 2 : 1,
        )
    const motions = [...svg.querySelectorAll('[data-premium-motion][data-motion-kind]')]
    for (const el of motions) {
      const kind = el.getAttribute('data-motion-kind')
      if (living.has(kind))
        append(
          el,
          `[data-premium-motion="${el.getAttribute('data-premium-motion')}"]`,
          0,
          living.get(kind),
          kind === 'firefly' ? 3 : 1,
        )
    }
    const auxiliary = motions
      .filter((el) => el.getAttribute('data-motion-kind') === 'wing')
      .map((el) => ({
        selector: `[data-premium-motion="${el.getAttribute('data-premium-motion')}"]`,
        reason: 'Dragon chest-breath auxiliary; attach/remove with hero, not another animal',
      }))
    rooms.push({
      id: room.id,
      category: room.category,
      sourceElementCount: actors.length,
      physicalActorCount: actors.reduce((n, a) => n + a.physicalCount, 0),
      actors,
      auxiliary,
      motionKinds: motions.map((el) => ({
        id: el.getAttribute('data-premium-motion'),
        kind: el.getAttribute('data-motion-kind'),
        label: el.querySelector('title')?.textContent,
      })),
    })
  }
  const species = {}
  for (const room of rooms)
    for (const a of room.actors) species[a.species] = (species[a.species] || 0) + a.physicalCount
  const { ANIMAL_HABITATS } = await import('../src/pages/focus/model/animalHabitats.ts')
  const bindingErrors = []
  let verifiedBindings = 0
  for (const room of rooms) {
    const root = dom.document.createElement('div')
    root.innerHTML = room.actors.map((a) => a.sourceElement).join('')
    const elements = [...root.children],
      bound = new Map()
    for (const actor of ANIMAL_HABITATS[room.id].actors.filter((a) => a.source)) {
      const element = root.querySelectorAll(actor.source.selector)[actor.source.index]
      const index = elements.indexOf(element),
        source = room.actors[index]
      if (!source || source.species !== actor.species) {
        bindingErrors.push({
          room: room.id,
          actor: actor.id,
          error: 'Missing actual source element/species',
        })
        continue
      }
      const parts = bound.get(index) ?? []
      parts.push(actor.source.part ?? 0)
      bound.set(index, parts)
      verifiedBindings++
    }
    for (const [index, source] of room.actors.entries()) {
      const parts = bound.get(index) ?? []
      if (parts.length !== source.physicalCount || new Set(parts).size !== source.physicalCount)
        bindingErrors.push({
          room: room.id,
          source: source.source,
          expected: source.physicalCount,
          actualParts: parts,
        })
    }
  }
  const report = {
    method: 'Actual Cafe SVG serial Vite SSR inventory; not browser/GPU evidence',
    coffeeCount: 0,
    roomCount: rooms.length,
    sourceElementCount: rooms.reduce((n, r) => n + r.sourceElementCount, 0),
    physicalActorCount: rooms.reduce((n, r) => n + r.physicalActorCount, 0),
    species,
    verifiedBindings,
    bindingErrors,
    classificationNotes: [
      'One premium-bat sourcepath contains two physical bats.',
      'One explicit spirit-tree firefly body/wing source group contains three physical fireflies.',
      'Signature wing is dragon chest breathing, not another animal.',
      'Plants/mechanical motifs and atmospheric glowing particles are not animal bodies; all signature kinds are recorded for review.',
    ],
    rooms,
  }
  await writeFile(path.join(output, 'inventory.json'), JSON.stringify(report, null, 2) + '\n')
  if (bindingErrors.length)
    throw Error(`Source binding verification failed: ${JSON.stringify(bindingErrors)}`)
  console.log(
    JSON.stringify({
      output,
      roomCount: rooms.length,
      sourceElements: report.sourceElementCount,
      physicalActors: report.physicalActorCount,
      species,
    }),
  )
  if (!args.includes('--inventory-only'))
    throw Error(
      'Proof capture awaits approved simulation/pose API and fresh bodyless exports; use --inventory-only meanwhile.',
    )
} finally {
  await server?.close()
  await dom.happyDOM.abort()
}
