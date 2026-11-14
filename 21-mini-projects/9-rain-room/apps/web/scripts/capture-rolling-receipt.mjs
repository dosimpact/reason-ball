/** Production receipt mesh diagnostic. CPU projection, not DOM/browser pixels. */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import sharp from 'sharp'
const args = process.argv.slice(2)
if (args.includes('--help')) {
  console.log(
    'node scripts/capture-rolling-receipt.mjs [--output workspace-relative-dir]\nActual production vertices, front/back colors and1000px CSS perspective. Synthetic ink grid, assumed layout bounds; not DOM/browser screenshot.',
  )
  process.exit(0)
}
const root = fileURLToPath(new URL('../', import.meta.url))
const workspace = path.resolve(root, '../..')
const i = args.indexOf('--output')
const output = path.resolve(
  workspace,
  i < 0 ? 'artifacts/rolling-receipt-2026-11-12/round1' : args[i + 1],
)
if (!output.startsWith(workspace + path.sep)) throw Error('Output outside workspace')
const hash = (b) => createHash('sha256').update(b).digest('hex')
const sources = [
  'lib/receiptPaper.ts',
  'ui/ritual/ReceiptPrinter.tsx',
  'ui/ritual/receipt-printer.css',
]
const sourceFiles = Object.fromEntries(
  await Promise.all(
    sources.map(async (f) => [f, hash(await readFile(path.join(root, 'src/pages/focus', f)))]),
  ),
)
const { receiptPaperFrame, PRINT_DURATION_MS, PAPER_FEED_END_MS, RECEIPT_PAPER_BANDS } =
  await import('../src/pages/focus/lib/receiptPaper.ts')
await mkdir(output, { recursive: true })
sharp.concurrency(1)
sharp.cache(false)
const cases = [
  {
    id: 'mobile320',
    width: 320,
    height: 568,
    paperWidth: 296,
    layout: { top: 12, bottom: 568, height: 544 },
  },
  {
    id: 'mobile390',
    width: 390,
    height: 844,
    paperWidth: 366,
    layout: { top: 82, bottom: 844, height: 680 },
  },
  {
    id: 'desktop',
    width: 1440,
    height: 900,
    paperWidth: 390,
    layout: { top: 110, bottom: 900, height: 680 },
  },
]
const times = [0, 350, 450, 600, 850, 1100, 1350, 1600, 1850, 2100, 2350, 2450, 2550, 2700, 3400]
const fmt = (n) => Number(n.toFixed(4))
const polygon = (points) => points.map((p) => `${fmt(p.x)},${fmt(p.y)}`).join(' ')
const cross = (a, b, c) => (b.y - a.y) * (c.z - a.z) - (b.z - a.z) * (c.y - a.y)
const intersects = (a, b, c, d) =>
  cross(a, b, c) * cross(a, b, d) < -1e-10 && cross(c, d, a) * cross(c, d, b) < -1e-10
const violations = []
const records = []
function inspect(frame, c, ms) {
  const visible = frame.bands.filter((b) => b.visible)
  let gap = 0,
    sourceGap = 0,
    length = 0,
    crossings = 0
  for (let j = 0; j < visible.length; j++) {
    const b = visible[j],
      angle = (b.rotation * Math.PI) / 180,
      next = frame.vertices[j + 1]
    gap = Math.max(
      gap,
      Math.hypot(
        next.y - b.y - b.height * Math.cos(angle),
        next.z - b.z - b.height * Math.sin(angle),
      ),
    )
    sourceGap = Math.max(sourceGap, Math.abs(b.sourceY - length))
    length += b.sourceHeight
    for (let k = j + 2; k < visible.length; k++)
      if (
        intersects(
          frame.vertices[j],
          frame.vertices[j + 1],
          frame.vertices[k],
          frame.vertices[k + 1],
        )
      )
        crossings++
  }
  if (gap > 1e-7 || sourceGap > 1e-7 || crossings)
    violations.push({ case: c.id, ms, gap, sourceGap, crossings })
  if (frame.tailAnchored && Math.abs(frame.edge.y - c.layout.bottom) > 1e-7)
    violations.push({ case: c.id, ms, reason: 'Tail detached while anchored' })
  if (
    ms >= PAPER_FEED_END_MS &&
    (Math.abs(frame.leadingY - c.layout.top) > 1e-7 ||
      frame.bands.some((b) => Math.abs(b.z) > 1e-7 || Math.abs(b.rotation) > 1e-7))
  )
    violations.push({ case: c.id, ms, reason: 'Not exact flat handoff' })
  const projected = visible.flatMap((b) => {
    const angle = (b.rotation * Math.PI) / 180
    return [
      project(c, b.y, b.z, -c.paperWidth / 2),
      project(c, b.y, b.z, c.paperWidth / 2),
      project(
        c,
        b.y + b.height * Math.cos(angle),
        b.z + b.height * Math.sin(angle),
        -c.paperWidth / 2,
      ),
      project(
        c,
        b.y + b.height * Math.cos(angle),
        b.z + b.height * Math.sin(angle),
        c.paperWidth / 2,
      ),
    ]
  })
  const horizontalClearance = projected.length
    ? Math.min(...projected.flatMap((p) => [p.x, c.width - p.x]))
    : c.width / 2
  if (horizontalClearance < -0.1)
    violations.push({ case: c.id, ms, reason: 'Projected paper side clipped', horizontalClearance })
  return { gap, sourceGap, length, crossings, horizontalClearance }
}
function project(c, y, z, x = 0) {
  const scale = 1000 / (1000 - z)
  return { x: c.width / 2 + x * scale, y: c.height + (y - c.height) * scale }
}
function renderFront(c, frame, ms) {
  const bandPolygons = []
  for (const b of frame.bands.filter((b) => b.visible)) {
    const angle = (b.rotation * Math.PI) / 180,
      end = { y: b.y + b.height * Math.cos(angle), z: b.z + b.height * Math.sin(angle) }
    const points = [
      project(c, b.y, b.z, -c.paperWidth / 2),
      project(c, b.y, b.z, c.paperWidth / 2),
      project(c, end.y, end.z, c.paperWidth / 2),
      project(c, end.y, end.z, -c.paperWidth / 2),
    ]
    let content = `<polygon points="${polygon(points)}" fill="${b.backVisible ? 'url(#back-material)' : '#f1ebde'}"/>`
    const shade = b.shade ?? 0
    content += `<polygon points="${polygon(points)}" fill="#000" opacity="${shade}"/>`
    if (!b.backVisible) {
      for (
        let source = Math.ceil(b.sourceY / 20) * 20;
        source < b.sourceY + b.sourceHeight - 1e-7;
        source += 20
      ) {
        const s = source - b.sourceY,
          y = b.y + s * Math.cos(angle),
          z = b.z + s * Math.sin(angle)
        const a = project(c, y, z, -c.paperWidth * 0.39),
          d = project(c, y, z, c.paperWidth * 0.39)
        content += `<path d="M${fmt(a.x)} ${fmt(a.y)}L${fmt(d.x)} ${fmt(d.y)}" stroke="#282828" stroke-width="1"/>`
      }
      // A fixed material-space vertical fiducial distinguishes front and reverse.
      const a = project(c, b.y, b.z, -c.paperWidth * 0.3),
        d = project(c, end.y, end.z, -c.paperWidth * 0.3)
      content += `<path d="M${fmt(a.x)} ${fmt(a.y)}L${fmt(d.x)} ${fmt(d.y)}" stroke="#927b57" stroke-width="2"/>`
    }
    bandPolygons.push({ z: (b.z + end.z) / 2, content, points })
  }
  bandPolygons.sort((a, b) => a.z - b.z)
  const bounds = bandPolygons.flatMap((b) => b.points)
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${c.width}" height="${c.height}"><defs><linearGradient id="back-material" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#ede5d5"/><stop offset=".45" stop-color="#ded6c5"/><stop offset="1" stop-color="#eee6d7"/></linearGradient></defs><rect width="100%" height="100%" fill="#181818"/><rect x="${(c.width - c.paperWidth) / 2}" y="${c.layout.top}" width="${c.paperWidth}" height="${c.layout.height}" fill="none" stroke="#898d74" stroke-dasharray="4 5" opacity=".55"/>${bandPolygons.map((b) => b.content).join('')}<g fill="#f5f5f5" font-family="monospace" font-size="10"><text x="6" y="14">${ms}ms · ${frame.phase} · ${fmt(frame.winding)}turn</text><text x="6" y="28">CPU diagnostic ink, NOT DOM/browser</text></g></svg>`,
    bounds: bounds.length
      ? {
          minX: Math.min(...bounds.map((p) => p.x)),
          maxX: Math.max(...bounds.map((p) => p.x)),
          minY: Math.min(...bounds.map((p) => p.y)),
          maxY: Math.max(...bounds.map((p) => p.y)),
        }
      : null,
  }
}
function sideSvg(frame, ms) {
  const pts = frame.vertices,
    minY = Math.min(...pts.map((p) => p.y)),
    maxY = Math.max(...pts.map((p) => p.y)),
    minZ = Math.min(...pts.map((p) => p.z)),
    maxZ = Math.max(...pts.map((p) => p.z))
  const scale = Math.min(420 / Math.max(1, maxZ - minZ), 500 / Math.max(1, maxY - minY))
  const project = (p) => ({ x: 70 + (p.z - minZ) * scale, y: 60 + (p.y - minY) * scale })
  const lines = pts
    .slice(0, -1)
    .map(
      (p, j) =>
        `<path d="M${fmt(project(p).x)} ${fmt(project(p).y)}L${fmt(project(pts[j + 1]).x)} ${fmt(project(pts[j + 1]).y)}" stroke="${frame.bands[j].backVisible ? '#b4a98d' : '#f1ebde'}" stroke-width="2"/>`,
    )
    .join('')
  const lead = project(pts[0]),
    tail = project(pts.at(-1))
  return `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="600"><rect width="100%" height="100%" fill="#222"/><g fill="#eee" font-family="monospace" font-size="12"><text x="8" y="18">${ms}ms · actual y/z section</text><text x="8" y="36">uniform scale${fmt(scale)}, z→ y↓ · winding${fmt(frame.winding)}</text></g>${lines}<circle cx="${lead.x}" cy="${lead.y}" r="4" fill="#39d5ac"/><circle cx="${tail.x}" cy="${tail.y}" r="4" fill="#d99a73"/></svg>`
}
for (const c of cases) {
  for (let ms = 0; ms <= PRINT_DURATION_MS; ms += 5)
    inspect(receiptPaperFrame(ms / PRINT_DURATION_MS, c.layout), c, ms)
  const panels = []
  for (const ms of times) {
    const frame = receiptPaperFrame(ms / PRINT_DURATION_MS, c.layout),
      front = renderFront(c, frame, ms),
      metrics = inspect(frame, c, ms)
    const filename = `${c.id}-${ms}ms.png`
    const image = await sharp(Buffer.from(front.svg)).png().toBuffer()
    await writeFile(path.join(output, filename), image)
    const thumb = await sharp(image)
      .resize({ width: 260, height: 420, fit: 'inside' })
      .png()
      .toBuffer()
    panels.push(thumb)
    records.push({
      case: c.id,
      ms,
      feed: frame.feed,
      winding: frame.winding,
      tailAnchored: frame.tailAnchored,
      phase: frame.phase,
      vertices: frame.vertices,
      bands: frame.bands,
      projectedBounds: front.bounds,
      metrics,
      filename,
    })
    if (c.id === 'mobile390') {
      await sharp(Buffer.from(sideSvg(frame, ms)))
        .png()
        .toFile(path.join(output, `section-${ms}ms.png`))
    }
  }
  const h = 70 + Math.ceil(panels.length / 5) * 450,
    paint = []
  for (const [j, input] of panels.entries()) {
    const m = await sharp(input).metadata()
    paint.push({
      input,
      left: (j % 5) * 270 + Math.round((270 - m.width) / 2),
      top: 70 + Math.floor(j / 5) * 450,
    })
  }
  const label = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1350" height="${h}"><g fill="#eee" font-family="monospace"><text x="8" y="20">${c.id} · production mesh /1000px bottom perspective</text><text x="8" y="39">ASSUMED target bounds, diagnostic material-space ink. NOT actual receipt DOM/browser screenshot.</text><text x="8" y="58">Cream front /plain reverse; green dashed rectangle=final target. Chronological0..3400ms.</text></g></svg>`,
  )
  await sharp({ create: { width: 1350, height: h, channels: 4, background: '#222' } })
    .composite([...paint, { input: label, left: 0, top: 0 }])
    .png()
    .toFile(path.join(output, `${c.id}-timeline.png`))
}
const changed = []
for (const [f, h] of Object.entries(sourceFiles))
  if (hash(await readFile(path.join(root, 'src/pages/focus', f))) !== h) changed.push(f)
const evidence = {
  method:
    'Actual production PaperFrame vertices; equal width CSS1000px bottom perspective, far-to-near quad projection. Synthetic fiducial ink, assumed representative bounds; not DOM/browser/GPU.',
  sourceFiles,
  sourceChangedDuringCapture: changed,
  cases,
  times,
  bands: RECEIPT_PAPER_BANDS,
  violations,
  records,
}
await writeFile(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2) + '\n')
console.log(
  JSON.stringify({ output, frames: records.length, violations: violations.length, changed }),
)
if (violations.length || changed.length) process.exitCode = 1
