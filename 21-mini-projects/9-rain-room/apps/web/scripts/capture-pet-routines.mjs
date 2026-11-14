/** Reproducible actual-choice pet audit / CPU evidence; never browser or GPU. */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import sharp from 'sharp'

const root = fileURLToPath(new URL('../', import.meta.url))
const workspace = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)))
const args = process.argv.slice(2)
if (args.includes('--help')) {
  console.log(
    'Usage: node scripts/capture-pet-routines.mjs [--baseline] [--proofs] [--scenes] [--contacts] [--rooms id,id] [--output workspace-relative-directory]\nAudits33actual pets for600s at runtime room seed plus31/591/20261112. --proofs uses actual t0/10/30/60/90/120 choices. --scenes delegates exact-mask compiled composition per room runtime seed; requires fresh exports. Static CPU only, no browser/GPU.',
  )
  process.exit(0)
}
const option = (name, fallback) => {
  const i = args.indexOf(name)
  if (i < 0) return fallback
  if (!args[i + 1] || args[i + 1].startsWith('--')) throw Error(`${name} needs a value`)
  return args[i + 1]
}
const output = path.resolve(
  workspace,
  option('--output', 'artifacts/pet-routines-2026-11-12/after'),
)
if (!output.startsWith(`${workspace}${path.sep}`)) throw Error('Output must stay in workspace')
if (args.includes('--boards-only')) {
  const rooms = await readdir(path.join(output, 'scene-rooms'))
  sharp.cache(false)
  sharp.concurrency(1)
  for (const room of rooms) {
    const paint = []
    let labels = ''
    for (const [i, time] of [0, 10, 30, 60, 90, 120].entries()) {
      const input = await sharp(
        path.join(output, 'scene-rooms', room, 'scenes', `${room}-t${time}-animals.png`),
      )
        .resize({ width: 590, height: 270, fit: 'inside' })
        .png()
        .toBuffer()
      const meta = await sharp(input).metadata(),
        x = (i % 2) * 600,
        y = 50 + Math.floor(i / 2) * 310
      paint.push({
        input,
        left: x + Math.round((600 - meta.width) / 2),
        top: y + 25 + Math.round((270 - meta.height) / 2),
      })
      labels += `<text x="${x + 8}" y="${y + 17}" font-size="13">t${time} · actual ordered/masked scene crop</text>`
    }
    const text = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="990"><g fill="#eee" font-family="monospace"><text x="8" y="22" font-size="16">${room} · actual pet routines</text><text x="8" y="41" font-size="11">CPU compositions, not browser/GPU; room-derived seed, no forced actions.</text>${labels}</g></svg>`
    await sharp({ create: { width: 1200, height: 990, channels: 4, background: '#222521' } })
      .composite([...paint, { input: Buffer.from(text), left: 0, top: 0 }])
      .png()
      .toFile(path.join(output, `${room}-actual-scene-sequence.png`))
  }
  console.log(`ACTUAL SCENE BOARDS ${rooms.length}`)
  process.exit(0)
}
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const files = [
  'model/petRoutine.ts',
  'model/animalLife.ts',
  'model/animalSpecies.ts',
  'model/animalHabitats.ts',
  'lib/animalDrawing.ts',
  'lib/pixiAnimalLife.ts',
  'lib/pixiSceneRuntime.ts',
  'lib/sceneWorldArt.ts',
  'lib/sceneWorldArchitecture.ts',
  'model/sceneWorldCamera.ts',
  'lib/sceneWorldFittings.ts',
  'model/sceneWorldCatalog.ts',
  'model/sceneSideFittings.ts',
  'model/sceneWorldEdges.ts',
  'model/sceneRenovation.ts',
  'model/sceneInterior.ts',
  'model/sceneRenovationStandard.ts',
  'model/sceneRenovationPremium.ts',
]
const sourceFiles = Object.fromEntries(
  await Promise.all(
    files.map(async (f) => [f, sha(await readFile(path.join(root, 'src/pages/focus', f)))]),
  ),
)
const { ANIMAL_HABITATS } = await import('../src/pages/focus/model/animalHabitats.ts')
const baseline = args.includes('--baseline')
const archive = path.join(workspace, 'artifacts/pet-routines-2026-11-12/baseline-source')
const lifeModule = baseline
  ? pathToFileURL(path.join(archive, 'animalLife.ts')).href
  : '../src/pages/focus/model/animalLife.ts'
const drawingModule = baseline
  ? pathToFileURL(path.join(archive, 'animalDrawing.ts')).href
  : '../src/pages/focus/lib/animalDrawing.ts'
const { AnimalLifeSimulation, animalFitsZone } = await import(lifeModule)
const { animalPoseSvg, animalPoseBounds } = await import(drawingModule)
const plans = Object.values(ANIMAL_HABITATS).filter((p) =>
  p.actors.some((a) => ['cat', 'dog'].includes(a.species)),
)
const times = [0, 10, 30, 60, 90, 120]
const runtimeSeed = (id) => [...id].reduce((n, c) => n + c.charCodeAt(0), 0)
const seedKinds = ['runtime-room', 31, 591, 20261112]
await mkdir(output, { recursive: true })
sharp.concurrency(1)
sharp.cache(false)
const records = [],
  sampled = [],
  failures = []
for (const plan of plans) {
  const pets = plan.actors.filter((a) => ['cat', 'dog'].includes(a.species))
  for (const seedKind of seedKinds) {
    const seed = seedKind === 'runtime-room' ? runtimeSeed(plan.id) : seedKind
    const sim = new AnimalLifeSimulation(plan, seed)
    const rows = new Map(
      pets.map((a) => [
        a.id,
        {
          room: plan.id,
          id: a.id,
          species: a.species,
          seedKind,
          seed,
          first120: {},
          seconds: {},
          transitions: [],
          maxDisplacement: 0,
          initial: null,
        },
      ]),
    )
    let last = new Map()
    try {
      for (let tick = 0; tick <= 6000; tick++) {
        const states = sim.snapshot()
        for (const spec of pets) {
          const state = states.find((s) => s.id === spec.id)
          const zone = plan.zones.find((z) => z.id === state.zoneId)
          const row = rows.get(spec.id)
          row.initial ??= { x: state.x, y: state.y, action: state.action }
          if (tick < 6000) {
            row.seconds[state.action] = (row.seconds[state.action] ?? 0) + 0.1
            if (tick < 1200) row.first120[state.action] = (row.first120[state.action] ?? 0) + 0.1
          }
          row.maxDisplacement = Math.max(
            row.maxDisplacement,
            Math.hypot(state.x - row.initial.x, state.y - row.initial.y),
          )
          if (last.get(spec.id) !== state.action) {
            row.transitions.push({
              time: tick / 10,
              action: state.action,
              x: state.x,
              y: state.y,
              domain: state.domain,
            })
            last.set(spec.id, state.action)
          }
          if (!animalFitsZone(spec, zone, state))
            failures.push({
              room: plan.id,
              id: spec.id,
              seed,
              time: tick / 10,
              reason: 'Leaves authored supported domain',
              state,
            })
          if (seedKind === 'runtime-room' && times.includes(tick / 10))
            sampled.push({ room: plan.id, spec, state, time: tick / 10, zone })
        }
        if (tick < 6000) sim.step(0.1)
      }
      const frozen = JSON.stringify(sim.snapshot())
      sim.setPaused(true)
      sim.step(3)
      if (JSON.stringify(sim.snapshot()) !== frozen)
        failures.push({ room: plan.id, seed, reason: 'Paused state changed' })
      sim.dispose()
      sim.step(3)
      if (JSON.stringify(sim.snapshot()) !== frozen)
        failures.push({ room: plan.id, seed, reason: 'Disposed state changed' })
    } finally {
      sim.dispose()
    }
    records.push(...rows.values())
  }
}
const summarize = (field, seconds, subset = records) => {
  const totals = {}
  for (const r of subset)
    for (const [action, duration] of Object.entries(r[field]))
      totals[action] = (totals[action] ?? 0) + duration
  return Object.fromEntries(
    Object.entries(totals).map(([k, v]) => [
      k,
      Math.round((v / (subset.length * seconds)) * 10000) / 100,
    ]),
  )
}
const petCount = records.length / seedKinds.length
if (petCount !== 33)
  failures.push({ reason: `Expected current 33 cat/dog actors, found ${petCount}` })
for (const row of records) {
  if (row.maxDisplacement <= 0.1)
    failures.push({
      id: row.id,
      seed: row.seed,
      reason: 'Stationary across600s despite authored pet route',
      maxDisplacement: row.maxDisplacement,
    })
  const acts = Object.keys(row.first120)
  row.first120DistinctActions = acts.length
  row.quietFirst120Percent =
    (['rest', 'sleep', 'sit', 'observe'].reduce((n, a) => n + (row.first120[a] ?? 0), 0) / 120) *
    100
  row.first120Transitions = row.transitions.filter((t) => t.time < 120).length
  if (!acts.some((a) => !['rest', 'eat', 'sleep', 'yield', 'walk'].includes(a)))
    failures.push({
      id: row.id,
      seed: row.seed,
      reason: 'No readable nonmeal routine first120',
      acts,
    })
  if ((row.seconds.eat ?? 0) > 120)
    failures.push({ id: row.id, seed: row.seed, reason: 'Meal dominates >20% of600s' })
}
if (args.includes('--proofs')) {
  const ids = [...new Set(sampled.map((s) => s.spec.id))]
  const escape = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c],
    )
  for (let page = 0; page < Math.ceil(ids.length / 6); page++) {
    let body = ''
    for (const [row, id] of ids.slice(page * 6, page * 6 + 6).entries()) {
      const seq = sampled.filter((s) => s.spec.id === id)
      const boxes = seq.map((s) => animalPoseBounds(s.spec, s.state))
      const half =
        Math.max(
          ...boxes.map((b, i) => Math.max(seq[i].state.x - b.x, b.x + b.width - seq[i].state.x)),
        ) + 8
      const above = Math.max(...boxes.map((b, i) => seq[i].state.y - b.y)) + 8
      const below = Math.max(...boxes.map((b, i) => b.y + b.height - seq[i].state.y)) + 8
      body += `<text x="8" y="${row * 180 + 20}" font-size="11">${escape(id)} · ${escape(seq[0].spec.species)} · actual runtime seed${runtimeSeed(seq[0].room)}</text>`
      for (const [col, sample] of seq.entries()) {
        const svg = animalPoseSvg(sample.spec, sample.state)
          .replace(/^<svg[^>]*>/, '')
          .replace(/<\/svg>$/, '')
        body += `<text x="${col * 170 + 8}" y="${row * 180 + 41}" font-size="11">t${sample.time} ${escape(sample.state.action)} · ${escape(sample.state.domain)}</text><svg x="${col * 170 + 5}" y="${row * 180 + 48}" width="160" height="125" viewBox="${sample.state.x - half} ${sample.state.y - above} ${half * 2} ${above + below}">${svg}</svg>`
      }
    }
    const height = Math.min(6, ids.length - page * 6) * 180 + 50
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1020" height="${height}"><rect width="100%" height="100%" fill="#222521"/><g fill="#eee" font-family="monospace">${body}<text x="8" y="${height - 12}" font-size="10">ACTUAL MODEL SNAPSHOTS · CPU rig anatomy only, no static support/background · NOT GPU/browser</text></g></svg>`
    const textRuns = [...svg.matchAll(/<text[^>]*>[\s\S]*?<\/text>/g)].map((m) => m[0]).join('')
    const geometrySvg = svg.replace(/<text[^>]*>[\s\S]*?<\/text>/g, '')
    const labelsSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1020" height="${height}"><g fill="#eee" font-family="monospace">${textRuns}</g></svg>`
    await sharp(Buffer.from(geometrySvg))
      .composite([{ input: Buffer.from(labelsSvg), left: 0, top: 0 }])
      .png()
      .toFile(path.join(output, `actual-pet-sequences-${page + 1}.png`))
  }
}
if (args.includes('--scenes')) {
  if (baseline)
    throw Error(
      'Baseline scenes use immutable existing baseline PNGs; live renderer cannot claim baseline',
    )
  const chosen = option(
    '--rooms',
    'cafe-rain,study-fire,cafe-rain-dome,travel-lodge,premium-last-bookstore,premium-christmas-bookcafe',
  ).split(',')
  for (const room of chosen) {
    if (!plans.some((p) => p.id === room)) throw Error(`No pet room ${room}`)
    const child = spawnSync(
      process.execPath,
      [
        'scripts/capture-animal-life.mjs',
        '--scenes',
        `--only=${room}`,
        `--times=${times.join(',')}`,
        `--seed=${runtimeSeed(room)}`,
        '--output',
        path.relative(workspace, path.join(output, 'scene-rooms', room)),
      ],
      { cwd: root, stdio: 'inherit' },
    )
    if (child.status !== 0) throw Error(`Canonical compiled/masked scene capture failed ${room}`)
  }
}
if (args.includes('--contacts')) {
  if (baseline) throw Error('Contact scene proofs require frozen current exports')
  for (const plan of plans) {
    const child = spawnSync(
      process.execPath,
      [
        'scripts/capture-animal-life.mjs',
        '--scenes',
        `--only=${plan.id}`,
        '--times=0',
        `--seed=${runtimeSeed(plan.id)}`,
        '--output',
        path.relative(workspace, path.join(output, 'contacts', plan.id)),
      ],
      { cwd: root, stdio: 'inherit' },
    )
    if (child.status !== 0) throw Error(`Compiled support contact failed ${plan.id}`)
  }
}
const changed = []
for (const [f, hash] of Object.entries(sourceFiles))
  if (sha(await readFile(path.join(root, 'src/pages/focus', f))) !== hash) changed.push(f)
const initialActions = {}
for (const r of records.filter((r) => r.seedKind === 'runtime-room'))
  initialActions[r.initial.action] = (initialActions[r.initial.action] ?? 0) + 1
const result = {
  runtimeInitialActions: initialActions,
  method:
    'Actual simulation choice, .1s authoritative steps; no forced actions. Runtime seed=sum room character codes; supplemental seeds31/591/20261112. CPU evidence, not browser/GPU.',
  baseline,
  baselineSourceFiles: baseline
    ? JSON.parse(await readFile(path.join(archive, 'hashes.json'), 'utf8'))
    : undefined,
  sourceFiles,
  sourceChangedDuringCapture: changed,
  pets: petCount,
  rooms: plans.length,
  seconds: 600,
  seedKinds,
  first120Percent: summarize('first120', 120),
  distributionPercent: summarize('seconds', 600),
  runtimeRoomSeed: {
    first120Percent: summarize(
      'first120',
      120,
      records.filter((r) => r.seedKind === 'runtime-room'),
    ),
    distributionPercent: summarize(
      'seconds',
      600,
      records.filter((r) => r.seedKind === 'runtime-room'),
    ),
  },
  failures,
  records,
  samples: sampled,
}
await writeFile(path.join(output, 'audit.json'), JSON.stringify(result, null, 2) + '\n')
console.log(
  JSON.stringify({
    output,
    pets: petCount,
    rooms: plans.length,
    records: records.length,
    failures: failures.length,
    changed,
    first120: result.first120Percent,
    all600: result.distributionPercent,
  }),
)
if (failures.length || changed.length) process.exitCode = 1
