// CPU static texture proofs, NOT browser or GPU screenshots. Original resources stay untouched.
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Window } from 'happy-dom'
import sharp from 'sharp'
import { mkdir, readFile, writeFile, copyFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { HUMAN_SELECTOR } from './pixi-vector-geometry.mjs'
import { getAnimalHabitat } from '../src/pages/focus/model/animalHabitats.ts'
import { AnimalLifeSimulation } from '../src/pages/focus/model/animalLife.ts'
import { animalPoseSvg, animalResourceSvg } from '../src/pages/focus/lib/animalDrawing.ts'
const root = fileURLToPath(new URL('../', import.meta.url))
const proof = fileURLToPath(new URL('../../../artifacts/space-review-2026-11-12/', import.meta.url))
const phase = process.argv.find((v) => v.startsWith('--phase='))?.slice(8) ?? 'before'
if (!['before', 'after'].includes(phase)) throw Error('Use --phase=before|after')
const only = process.argv
  .find((v) => v.startsWith('--only='))
  ?.slice(7)
  .split(',')
  .filter(Boolean)
const coffeeCount = Number(process.argv.find((v) => v.startsWith('--coffee='))?.slice(9) ?? 0)
if (!Number.isSafeInteger(coffeeCount) || coffeeCount < 0) throw Error('Invalid --coffee count')
const directory = `${proof}/${phase}${coffeeCount ? `-coffee${coffeeCount}` : ''}`,
  scale = 3,
  W = 800,
  H = 820
sharp.cache(false)
sharp.concurrency(1)
await mkdir(directory, { recursive: true })
if (process.argv.includes('--boards-only')) {
  const report = JSON.parse(await readFile(`${directory}/manifest.json`, 'utf8'))
  for (const room of report.rooms) await board(room)
  await publishBoardIndex(report.rooms, report.method)
  console.log(`BOARDS_COMPLETE ${report.rooms.length}: ${directory}/boards.html`)
  process.exit(0)
}
if (phase === 'before' && (await readdir(directory)).length)
  throw Error('Immutable before baseline already exists; nothing overwritten')
const canvas = () =>
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
const dom = new Window(),
  document = dom.document
const server = await createServer({
  root,
  server: { middlewareMode: true, watch: null, hmr: false },
  appType: 'custom',
})
const render = (Component, props, prefix) =>
  renderToStaticMarkup(createElement(Component, props), { identifierPrefix: prefix })
async function compose(manifest) {
  let frame = await canvas().png().toBuffer()
  const plan = getAnimalHabitat(manifest.id)
  const simulation = new AnimalLifeSimulation(plan, 1)
  const states = new Map(simulation.snapshot().map((state) => [state.id, state]))
  simulation.dispose()
  const stationZones = new Set()
  for (const layer of manifest.layers) {
    if (
      layer.kind === 'weather' ||
      layer.restHidden ||
      (layer.ifCoffeeMin ?? 0) > coffeeCount ||
      (layer.ifCoffeeMax ?? Infinity) < coffeeCount
    )
      continue
    let input, left, top
    if (layer.kind === 'animal') {
      const actor = plan.actors.find((actor) => actor.id === layer.animalId)
      if (!actor) throw Error(`Unknown modeled animal ${manifest.id}/${layer.animalId}`)
      const zone = plan.zones.find((zone) => zone.id === actor.zoneId)
      let stations = ''
      if (!stationZones.has(zone.id)) {
        stationZones.add(zone.id)
        stations = plan.resources
          .filter((resource) => resource.zoneId === zone.id && resource.kind !== 'rest')
          .map((resource) => animalResourceSvg(resource, zone))
          .join('')
      }
      const posed = animalPoseSvg({ ...actor, tetherAnchor: zone.anchor }, states.get(actor.id))
      input = await sharp(Buffer.from(svg(stations + posed.replace(/^<svg[^>]*>|<\/svg>$/g, ''))), {
        density: 216,
      })
        .png()
        .toBuffer()
      left = 0
      top = 0
    } else {
      if (!layer.srcHigh) throw Error(`Texture layer missing srcHigh ${manifest.id}/${layer.id}`)
      input = await readFile(`${root}/public${layer.srcHigh}`)
      left = layer.x * scale
      top = layer.y * scale
    }
    if (layer.clipMaskHigh) {
      input = await canvas().composite([{ input, left, top }]).png().toBuffer()
      input = await sharp(input)
        .composite([
          { input: await readFile(`${root}/public${layer.clipMaskHigh}`), blend: 'dest-in' },
        ])
        .png()
        .toBuffer()
      left = 0
      top = 0
    }
    frame = await sharp(frame)
      .composite([{ input, left: Math.round(left), top: Math.round(top) }])
      .png()
      .toBuffer()
  }
  return frame
}
function parse(markup) {
  const holder = document.createElement('div')
  holder.innerHTML = markup
  return holder.querySelector('svg')
}
function isolated(node, scene) {
  let body = node.outerHTML
  for (let parent = node.parentElement; parent && parent !== scene; parent = parent.parentElement) {
    const clone = parent.cloneNode(false)
    clone.innerHTML = body
    body = clone.outerHTML
  }
  return svg(
    `<defs>${Array.from(scene.querySelectorAll('defs'))
      .map((def) => def.innerHTML)
      .join('')}</defs>${body}`,
  )
}
async function bbox(node, scene) {
  const { data, info } = await sharp(Buffer.from(isolated(node, scene)), { density: 216 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  let left = info.width,
    top = info.height,
    right = -1,
    bottom = -1
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++)
      if (data[(y * info.width + x) * 4 + 3]) {
        left = Math.min(left, x)
        top = Math.min(top, y)
        right = Math.max(right, x)
        bottom = Math.max(bottom, y)
      }
  if (right < left) return null
  const pad = 36
  left = Math.max(0, left - pad)
  top = Math.max(0, top - pad)
  right = Math.min(info.width - 1, right + pad)
  bottom = Math.min(info.height - 1, bottom + pad)
  return { left, top, width: right - left + 1, height: bottom - top + 1 }
}

const method = `CPU Sharp paint-order composite of deployed 3x srcHigh fallback PNGs and modeled animal SVG rest poses/resources at deterministic initial simulation state, coffee=${coffeeCount}, restHidden excluded. Native weather excluded. NOT a GPU screenshot/browser capture. Actor bounds use separate current authored SVG SSR; body/head PNG crops use the actual composite (including occlusion).`
const report = {
  phase,
  createdAt: new Date().toISOString(),
  method,
  weatherExcluded: true,
  coffeeCount,
  rooms: [],
  sheets: [],
}
async function sheet(records, index) {
  const items = []
  for (const [i, r] of records.entries()) {
    items.push({
      input: await sharp(`${directory}/${r.id}-full.png`).resize(240, 246).png().toBuffer(),
      left: (i % 4) * 240,
      top: Math.floor(i / 4) * 274,
    })
    items.push({
      input: Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="28"><rect width="240" height="28" fill="#18211f"/><text x="5" y="17" fill="white" font-size="10">${r.id} (${r.people.length})</text></svg>`,
      ),
      left: (i % 4) * 240,
      top: Math.floor(i / 4) * 274 + 246,
    })
  }
  const name = `contact-${String(index).padStart(2, '0')}.png`
  await sharp({
    create: {
      width: 960,
      height: Math.ceil(records.length / 4) * 274,
      channels: 4,
      background: '#18211f',
    },
  })
    .composite(items)
    .png()
    .toFile(`${directory}/${name}`)
  return name
}
async function publish() {
  await writeFile(`${directory}/manifest.json`, JSON.stringify(report, null, 2) + '\n')
  await writeFile(
    `${directory}/README.md`,
    method +
      '\n\nFull 2400x2460; mobile 390x844; desktop 1280x800. Centered cover crop matches runtime scale/offset. These are authored rest snapshots, not time-sampled motion or Pixi-native-vector output. Before baseline is immutable. Source SSR and deployed textures are separate evidence sources and may diverge if exports are stale.\n',
  )
  await writeFile(
    `${directory}/index.html`,
    `<!doctype html><meta charset="utf-8"><title>Space review ${phase}</title><style>body{background:#18211f;color:white;font:14px sans-serif}img{max-height:340px;max-width:100%;object-fit:contain;vertical-align:top}section{margin:24px 0}</style><h1>${phase}</h1><p>${method}</p>${report.sheets.map((s) => `<a href="${s}">${s}</a> `).join('')}${report.rooms.map((r) => `<section><h2>${r.id} (${r.people.length} people)</h2>${['full', 'mobile', 'desktop'].map((v) => `<a href="${r.id}-${v}.png"><img loading="lazy" decoding="async" width="${{ full: 332, mobile: 157, desktop: 544 }[v]}" height="340" src="${r.id}-${v}.png"></a>`).join('')}<div>${r.people.map((p) => `<a href="${p.body}"><img loading="lazy" decoding="async" width="240" height="300" src="${p.body}"></a><a href="${p.head}"><img loading="lazy" decoding="async" width="240" height="300" src="${p.head}"></a>`).join('')}</div></section>`).join('')}`,
  )
  await publishBoardIndex(report.rooms, method)
}
async function publishBoardIndex(rooms, note) {
  await writeFile(
    `${directory}/boards.html`,
    `<!doctype html><meta charset="utf-8"><title>Space review boards</title><style>body{background:#18211f;color:white;font:14px sans-serif}img{max-width:100%;height:auto}a{color:inherit}</style><h1>${phase} · ${rooms.length} spaces</h1><p>${note}</p>${rooms.map((r) => `<h2>${r.id}</h2><a href="${r.id}-review-board.png"><img loading="lazy" decoding="async" width="1604" height="1207" src="${r.id}-review-board.png"></a>`).join('')}`,
  )
}
try {
  const { ALL_BACKGROUNDS } = await server.ssrLoadModule('/src/pages/focus/model/backgrounds.ts')
  if (only?.some((id) => !ALL_BACKGROUNDS.some((r) => r.id === id)))
    throw Error('Unknown --only ID')
  const { default: Cafe } = await server.ssrLoadModule('/src/pages/focus/ui/Cafe.tsx')
  const { default: Premium } = await server.ssrLoadModule(
    '/src/pages/focus/ui/premium/PremiumScene.tsx',
  )
  for (const room of ALL_BACKGROUNDS.filter((r) => !only || only.includes(r.id))) {
    const source = `${root}/public/backgrounds/pixi/${room.id}/manifest.json`
    const manifest = JSON.parse(await readFile(source, 'utf8'))
    const image = await compose(manifest)
    await writeFile(`${directory}/${room.id}-full.png`, image)
    await sharp(image)
      .resize(390, 844, { fit: 'cover', position: 'centre' })
      .png()
      .toFile(`${directory}/${room.id}-mobile.png`)
    await sharp(image)
      .resize(1280, 800, { fit: 'cover', position: 'centre' })
      .png()
      .toFile(`${directory}/${room.id}-desktop.png`)
    await copyFile(source, `${directory}/${room.id}-manifest.json`)
    const premium = room.id.startsWith('premium-')
    const scene = parse(
      render(
        premium ? Premium : Cafe,
        premium
          ? { spaceId: room.id, layer: 'foreground', static: true, coffeeCount }
          : {
              backgroundId: room.id,
              layer: 'foreground',
              artOnly: true,
              paused: true,
              coffeeCount,
            },
        `space-review-${room.id}-`,
      ),
    )
    if (!scene) throw Error(`Missing source SVG ${room.id}`)
    const markers = [...scene.querySelectorAll(HUMAN_SELECTOR)]
    const actors = markers.filter((n) => !n.parentElement?.closest(HUMAN_SELECTOR)),
      people = []
    for (const [i, node] of actors.entries()) {
      const body = await bbox(node, scene)
      const headNode =
        node.querySelector(
          '[data-head-view],[data-human-head],[data-premium-head],[data-character-head]',
        ) ??
        node.querySelector('[data-face-expression]')?.parentElement ??
        node
      const head = await bbox(headNode, scene)
      if (!body || !head) throw Error(`Invisible actor ${room.id}/${i}`)
      const prefix = `${room.id}-person-${i + 1}`
      await sharp(image).extract(body).png().toFile(`${directory}/${prefix}-body.png`)
      await sharp(image).extract(head).png().toFile(`${directory}/${prefix}-head.png`)
      people.push({
        index: i + 1,
        body: `${prefix}-body.png`,
        head: `${prefix}-head.png`,
        bodyBounds3x: body,
        headBounds3x: head,
      })
    }
    report.rooms.push({
      id: room.id,
      sourceDigest: manifest.provenance?.sourceDigest,
      weather: manifest.weather,
      sourceActorCount: actors.length,
      sourceMarkerCount: markers.length,
      people,
    })
    await board(report.rooms.at(-1))
    console.log(`${phase} ${report.rooms.length}: ${room.id} (${people.length} people)`)
    if (report.rooms.length % 12 === 0) {
      report.sheets.push(await sheet(report.rooms.slice(-12), report.sheets.length + 1))
      await publish()
      console.log(`BATCH_READY ${directory} ${report.rooms.length}`)
    }
  }
  const remainder = report.rooms.length % 12
  if (remainder)
    report.sheets.push(await sheet(report.rooms.slice(-remainder), report.sheets.length + 1))
  await publish()
  console.log(
    `COMPLETE ${report.rooms.length} rooms / ${report.rooms.reduce((n, r) => n + r.people.length, 0)} people: ${directory}`,
  )
} finally {
  await dom.happyDOM.abort()
  await server.close()
}

async function board(room) {
  const filename = `${directory}/${room.id}-review-board.png`
  if (phase === 'before' && (await readdir(directory)).includes(`${room.id}-review-board.png`))
    return
  const items = []
  const tile = async (file, width, height, left, top) => {
    items.push({
      input: await sharp(`${directory}/${file}`)
        .resize(width, height, { fit: 'contain', background: '#18211f' })
        .png()
        .toBuffer(),
      left,
      top,
    })
  }
  await tile(`${room.id}-full.png`, 600, 615, 0, 40)
  await tile(`${room.id}-mobile.png`, 284, 615, 600, 40)
  await tile(`${room.id}-desktop.png`, 884, 552, 0, 655)
  const rows = Math.ceil(room.people.length / 2)
  for (const [i, p] of room.people.entries()) {
    const x = 884 + (i % 2) * 360,
      y = 40 + Math.floor(i / 2) * 380
    await tile(p.body, 180, 350, x, y)
    await tile(p.head, 180, 350, x + 180, y)
  }
  const width = 1604,
    height = Math.max(1207, 40 + rows * 380)
  items.push({
    input: Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1604" height="40"><rect width="1604" height="40" fill="#18211f"/><text x="12" y="25" fill="white" font-size="16">${room.id} | Full / mobile / desktop / bodies + heads | CPU static proof, NOT GPU; weather excluded</text></svg>`,
    ),
    left: 0,
    top: 0,
  })
  await sharp({ create: { width, height, channels: 4, background: '#18211f' } })
    .composite(items)
    .png()
    .toFile(filename)
}
